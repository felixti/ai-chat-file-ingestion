/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useChunkIndex } from '@/hooks/useChunkIndex';
import { chunkText } from '@/lib/chunking';
import { ChunkIndex } from '@/lib/minisearch-index';
import type { Chunk, SearchResult } from '@/types';

jest.mock('@/lib/chunking', () => ({
  chunkText: jest.fn(),
}));

jest.mock('@/lib/minisearch-index', () => ({
  ChunkIndex: jest.fn(),
}));

const mockedChunkText = chunkText as jest.MockedFunction<typeof chunkText>;
const MockedChunkIndex = ChunkIndex as unknown as jest.Mock;

function createMockChunks(count: number): Chunk[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `chunk-${i}`,
    text: `Chunk text ${i}`,
    startIndex: i * 100,
    endIndex: i * 100 + 50,
  }));
}

function createMockSearchResults(count: number): SearchResult[] {
  return Array.from({ length: count }, (_, i) => ({
    chunkId: `chunk-${i}`,
    score: 1.0 - i * 0.1,
    text: `Result text ${i}`,
  }));
}

describe('useChunkIndex', () => {
  let mockAddChunks: jest.Mock;
  let mockSearch: jest.Mock;
  let mockClear: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAddChunks = jest.fn();
    mockSearch = jest.fn().mockReturnValue([]);
    mockClear = jest.fn();

    MockedChunkIndex.mockImplementation(() => ({
      addChunks: mockAddChunks,
      search: mockSearch,
      clear: mockClear,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns empty chunks and isIndexing false', () => {
      const { result } = renderHook(() => useChunkIndex());

      expect(result.current.chunks).toEqual([]);
      expect(result.current.isIndexing).toBe(false);
    });

    it('returns empty array for search before indexing', () => {
      const { result } = renderHook(() => useChunkIndex());

      expect(result.current.search('any query')).toEqual([]);
    });
  });

  describe('indexMarkdown', () => {
    it('calls chunkText with the provided markdown', () => {
      const markdown = '# Title\n\nParagraph content.';
      mockedChunkText.mockReturnValue(createMockChunks(1));
      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown(markdown);
      });

      expect(mockedChunkText).toHaveBeenCalledTimes(1);
      expect(mockedChunkText).toHaveBeenCalledWith(markdown);
    });

    it('updates chunks state with returned chunks', () => {
      const mockChunks = createMockChunks(2);
      mockedChunkText.mockReturnValue(mockChunks);
      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('markdown');
      });

      expect(result.current.chunks).toEqual(mockChunks);
    });

    it('creates a ChunkIndex and adds chunks', () => {
      const mockChunks = createMockChunks(3);
      mockedChunkText.mockReturnValue(mockChunks);
      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('markdown');
      });

      expect(MockedChunkIndex).toHaveBeenCalledTimes(1);
      expect(mockAddChunks).toHaveBeenCalledTimes(1);
      expect(mockAddChunks).toHaveBeenCalledWith(mockChunks);
    });

    it('resets isIndexing to false after processing completes', () => {
      mockedChunkText.mockReturnValue(createMockChunks(1));
      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('markdown');
      });

      expect(result.current.isIndexing).toBe(false);
    });

    it('replaces the previous index on subsequent calls', () => {
      const firstChunks = createMockChunks(1);
      const secondChunks = createMockChunks(2);
      mockedChunkText.mockReturnValueOnce(firstChunks).mockReturnValueOnce(secondChunks);
      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('first');
      });
      expect(result.current.chunks).toEqual(firstChunks);
      expect(MockedChunkIndex).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.indexMarkdown('second');
      });
      expect(result.current.chunks).toEqual(secondChunks);
      expect(MockedChunkIndex).toHaveBeenCalledTimes(2);
    });

    it('handles missing markdown argument without crashing', () => {
      mockedChunkText.mockReturnValue([]);
      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown(undefined as unknown as string);
      });

      expect(result.current.isIndexing).toBe(false);
      expect(result.current.chunks).toEqual([]);
    });
  });

  describe('search', () => {
    it('returns empty array before indexing', () => {
      const { result } = renderHook(() => useChunkIndex());

      expect(result.current.search('query')).toEqual([]);
    });

    it('delegates to ChunkIndex.search with limit 5 after indexing', () => {
      const mockChunks = createMockChunks(3);
      const mockResults = createMockSearchResults(2);
      mockedChunkText.mockReturnValue(mockChunks);
      mockSearch.mockReturnValue(mockResults);

      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('markdown');
      });

      const results = result.current.search('test query');

      expect(mockSearch).toHaveBeenCalledTimes(1);
      expect(mockSearch).toHaveBeenCalledWith('test query', 5);
      expect(results).toEqual(mockResults);
    });

    it('returns different results for subsequent searches', () => {
      const mockChunks = createMockChunks(2);
      mockedChunkText.mockReturnValue(mockChunks);

      const firstResults = createMockSearchResults(1);
      const secondResults = createMockSearchResults(2);
      mockSearch.mockReturnValueOnce(firstResults).mockReturnValueOnce(secondResults);

      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('markdown');
      });

      expect(result.current.search('first')).toEqual(firstResults);
      expect(result.current.search('second')).toEqual(secondResults);
    });
  });

  describe('clearIndex', () => {
    it('clears chunks back to empty array', () => {
      const mockChunks = createMockChunks(2);
      mockedChunkText.mockReturnValue(mockChunks);
      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('markdown');
      });
      expect(result.current.chunks).toEqual(mockChunks);

      act(() => {
        result.current.clearIndex();
      });
      expect(result.current.chunks).toEqual([]);
    });

    it('clears the index and nullifies the ref so search returns empty', () => {
      const mockChunks = createMockChunks(2);
      mockedChunkText.mockReturnValue(mockChunks);
      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('markdown');
      });

      act(() => {
        result.current.clearIndex();
      });

      expect(mockClear).toHaveBeenCalledTimes(1);
      expect(result.current.search('query')).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('sets isIndexing to false when chunkText throws', () => {
      mockedChunkText.mockImplementation(() => {
        throw new Error('Chunking failed');
      });

      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('bad markdown');
      });

      expect(result.current.isIndexing).toBe(false);
      expect(result.current.chunks).toEqual([]);
    });

    it('logs the error when chunkText throws', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Chunking failed');
      mockedChunkText.mockImplementation(() => {
        throw error;
      });

      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('bad markdown');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useChunkIndex] chunking failed:',
        error
      );
      consoleErrorSpy.mockRestore();
    });

    it('does not create ChunkIndex when chunkText throws', () => {
      mockedChunkText.mockImplementation(() => {
        throw new Error('Chunking failed');
      });

      const { result } = renderHook(() => useChunkIndex());

      act(() => {
        result.current.indexMarkdown('bad markdown');
      });

      expect(MockedChunkIndex).not.toHaveBeenCalled();
      expect(mockAddChunks).not.toHaveBeenCalled();
    });
  });
});
