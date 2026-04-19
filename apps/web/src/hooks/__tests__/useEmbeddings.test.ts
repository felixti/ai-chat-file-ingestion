/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmbeddings } from '@/hooks/useEmbeddings';
import { EmbeddingPipeline } from '@/lib/embeddings';

const mockEmbed = jest.fn();
const mockEmbedBatch = jest.fn();

jest.mock('@/lib/embeddings', () => ({
  EmbeddingPipeline: {
    getInstance: jest.fn(),
  },
  cosineSimilarity: jest.fn(() => 0.5),
}));

describe('useEmbeddings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (EmbeddingPipeline.getInstance as jest.Mock).mockResolvedValue({
      embed: mockEmbed,
      embedBatch: mockEmbedBatch,
    });
  });

  describe('initial state', () => {
    it('returns isLoading as false and error as null on mount', () => {
      const { result } = renderHook(() => useEmbeddings());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('embed', () => {
    it('sets isLoading to true while embedding and false after success', async () => {
      mockEmbed.mockResolvedValue({ vector: [0.1, 0.2], model: 'test-model' });

      const { result } = renderHook(() => useEmbeddings());

      let embedPromise: Promise<unknown>;
      act(() => {
        embedPromise = result.current.embed('hello world');
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await embedPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('returns embedding result from the pipeline', async () => {
      const embeddingResult = { vector: [0.1, 0.2, 0.3], model: 'test-model' };
      mockEmbed.mockResolvedValue(embeddingResult);

      const { result } = renderHook(() => useEmbeddings());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.embed('hello world');
      });

      expect(returnedResult).toEqual(embeddingResult);
      expect(mockEmbed).toHaveBeenCalledWith('hello world');
      expect(mockEmbed).toHaveBeenCalledTimes(1);
    });

    it('sets error message and returns null on embed failure', async () => {
      mockEmbed.mockRejectedValue(new Error('Pipeline crashed'));

      const { result } = renderHook(() => useEmbeddings());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.embed('hello world');
      });

      expect(returnedResult).toBeNull();
      expect(result.current.error).toBe('Pipeline crashed');
      expect(result.current.isLoading).toBe(false);
    });

    it('sets generic error message when a non-Error is thrown', async () => {
      mockEmbed.mockRejectedValue('string failure');

      const { result } = renderHook(() => useEmbeddings());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.embed('hello world');
      });

      expect(returnedResult).toBeNull();
      expect(result.current.error).toBe('Embedding failed');
    });
  });

  describe('embedBatch', () => {
    it('sets isLoading to true while batch embedding and false after success', async () => {
      mockEmbedBatch.mockResolvedValue([
        { vector: [0.1], model: 'test-model' },
        { vector: [0.2], model: 'test-model' },
      ]);

      const { result } = renderHook(() => useEmbeddings());

      let batchPromise: Promise<unknown>;
      act(() => {
        batchPromise = result.current.embedBatch(['a', 'b']);
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await batchPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('returns batch results from the pipeline', async () => {
      const batchResults = [
        { vector: [0.1, 0.2], model: 'test-model' },
        { vector: [0.3, 0.4], model: 'test-model' },
      ];
      mockEmbedBatch.mockResolvedValue(batchResults);

      const { result } = renderHook(() => useEmbeddings());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.embedBatch(['text one', 'text two']);
      });

      expect(returnedResult).toEqual(batchResults);
      expect(mockEmbedBatch).toHaveBeenCalledWith(['text one', 'text two']);
      expect(mockEmbedBatch).toHaveBeenCalledTimes(1);
    });

    it('sets error message and returns null on batch embed failure', async () => {
      mockEmbedBatch.mockRejectedValue(new Error('Batch pipeline failed'));

      const { result } = renderHook(() => useEmbeddings());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.embedBatch(['a', 'b']);
      });

      expect(returnedResult).toBeNull();
      expect(result.current.error).toBe('Batch pipeline failed');
      expect(result.current.isLoading).toBe(false);
    });

    it('sets generic error message when a non-Error is thrown during batch', async () => {
      mockEmbedBatch.mockRejectedValue(42);

      const { result } = renderHook(() => useEmbeddings());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.embedBatch(['a', 'b']);
      });

      expect(returnedResult).toBeNull();
      expect(result.current.error).toBe('Batch embedding failed');
    });
  });

  describe('rankBySimilarity', () => {
    it('calls embedBatch with [query, ...texts]', async () => {
      mockEmbedBatch.mockResolvedValue([
        { vector: [1, 0], model: 'test-model' },
        { vector: [0, 1], model: 'test-model' },
        { vector: [1, 1], model: 'test-model' },
      ]);

      const { result } = renderHook(() => useEmbeddings());

      await act(async () => {
        await result.current.rankBySimilarity('query', ['chunk1', 'chunk2']);
      });

      expect(mockEmbedBatch).toHaveBeenCalledWith(['query', 'chunk1', 'chunk2']);
    });

    it('computes similarity for each text against query and returns results sorted by similarity descending', async () => {
      mockEmbedBatch.mockResolvedValue([
        { vector: [1, 0], model: 'test-model' },
        { vector: [0.5, 0.5], model: 'test-model' },
        { vector: [0, 1], model: 'test-model' },
      ]);

      const { result } = renderHook(() => useEmbeddings());

      let rankings: unknown;
      await act(async () => {
        rankings = await result.current.rankBySimilarity('query', ['chunk-a', 'chunk-b']);
      });

      expect(rankings).toEqual([
        { text: 'chunk-a', similarity: 0.5 },
        { text: 'chunk-b', similarity: 0.5 },
      ]);
    });

    it('returns empty array and sets error on rankBySimilarity failure', async () => {
      mockEmbedBatch.mockRejectedValue(new Error('Ranking pipeline failed'));

      const { result } = renderHook(() => useEmbeddings());

      let rankings: unknown;
      await act(async () => {
        rankings = await result.current.rankBySimilarity('query', ['chunk1']);
      });

      expect(rankings).toEqual([]);
      expect(result.current.error).toBe('Ranking pipeline failed');
      expect(result.current.isLoading).toBe(false);
    });

    it('returns empty array for empty texts input', async () => {
      mockEmbedBatch.mockResolvedValue([{ vector: [1, 0], model: 'test-model' }]);

      const { result } = renderHook(() => useEmbeddings());

      let rankings: unknown;
      await act(async () => {
        rankings = await result.current.rankBySimilarity('query', []);
      });

      expect(rankings).toEqual([]);
      expect(mockEmbedBatch).toHaveBeenCalledWith(['query']);
    });

    it('sets generic error message when a non-Error is thrown during ranking', async () => {
      mockEmbedBatch.mockRejectedValue(null);

      const { result } = renderHook(() => useEmbeddings());

      let rankings: unknown;
      await act(async () => {
        rankings = await result.current.rankBySimilarity('query', ['chunk1']);
      });

      expect(rankings).toEqual([]);
      expect(result.current.error).toBe('Similarity ranking failed');
    });
  });

  describe('singleton behavior', () => {
    it('calls EmbeddingPipeline.getInstance only once across multiple operations', async () => {
      mockEmbed.mockResolvedValue({ vector: [0.1], model: 'test-model' });
      mockEmbedBatch.mockResolvedValue([{ vector: [0.2], model: 'test-model' }]);

      const { result } = renderHook(() => useEmbeddings());

      await act(async () => {
        await result.current.embed('first');
      });

      await act(async () => {
        await result.current.embedBatch(['second']);
      });

      await act(async () => {
        await result.current.rankBySimilarity('third', ['fourth']);
      });

      expect(EmbeddingPipeline.getInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('error state clearing', () => {
    it('clears previous error before a successful embed call', async () => {
      mockEmbed
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({ vector: [0.1], model: 'test-model' });

      const { result } = renderHook(() => useEmbeddings());

      await act(async () => {
        await result.current.embed('fail');
      });
      expect(result.current.error).toBe('First failure');

      await act(async () => {
        await result.current.embed('success');
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('clears previous error before a successful embedBatch call', async () => {
      mockEmbedBatch
        .mockRejectedValueOnce(new Error('Batch failure'))
        .mockResolvedValueOnce([{ vector: [0.1], model: 'test-model' }]);

      const { result } = renderHook(() => useEmbeddings());

      await act(async () => {
        await result.current.embedBatch(['fail']);
      });
      expect(result.current.error).toBe('Batch failure');

      await act(async () => {
        await result.current.embedBatch(['success']);
      });

      expect(result.current.error).toBeNull();
    });

    it('clears previous error before a successful rankBySimilarity call', async () => {
      mockEmbedBatch
        .mockRejectedValueOnce(new Error('Rank failure'))
        .mockResolvedValueOnce([
          { vector: [1, 0], model: 'test-model' },
          { vector: [0.5, 0.5], model: 'test-model' },
        ]);

      const { result } = renderHook(() => useEmbeddings());

      await act(async () => {
        await result.current.rankBySimilarity('fail', ['chunk']);
      });
      expect(result.current.error).toBe('Rank failure');

      await act(async () => {
        await result.current.rankBySimilarity('success', ['chunk']);
      });

      expect(result.current.error).toBeNull();
    });

    it('sets a new error after a successful call when the next call fails', async () => {
      mockEmbed
        .mockResolvedValueOnce({ vector: [0.1], model: 'test-model' })
        .mockRejectedValueOnce(new Error('Second failure'));

      const { result } = renderHook(() => useEmbeddings());

      await act(async () => {
        await result.current.embed('success');
      });
      expect(result.current.error).toBeNull();

      await act(async () => {
        await result.current.embed('fail');
      });

      expect(result.current.error).toBe('Second failure');
    });
  });

  describe('pipeline initialization errors', () => {
    it('handles getInstance error in embed', async () => {
      (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue(
        new Error('Init failed')
      );

      const { result } = renderHook(() => useEmbeddings());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.embed('hello');
      });

      expect(returnedResult).toBeNull();
      expect(result.current.error).toBe('Init failed');
      expect(result.current.isLoading).toBe(false);
    });

    it('handles getInstance error in embedBatch', async () => {
      (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue(
        new Error('Batch init failed')
      );

      const { result } = renderHook(() => useEmbeddings());

      let returnedResult: unknown;
      await act(async () => {
        returnedResult = await result.current.embedBatch(['a']);
      });

      expect(returnedResult).toBeNull();
      expect(result.current.error).toBe('Batch init failed');
    });

    it('handles getInstance error in rankBySimilarity', async () => {
      (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue(
        new Error('Rank init failed')
      );

      const { result } = renderHook(() => useEmbeddings());

      let rankings: unknown;
      await act(async () => {
        rankings = await result.current.rankBySimilarity('query', ['chunk']);
      });

      expect(rankings).toEqual([]);
      expect(result.current.error).toBe('Rank init failed');
    });
  });
});
