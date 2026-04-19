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
  cosineSimilarity: jest.requireActual('@/lib/embeddings').cosineSimilarity,
}));

describe('useEmbeddings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (EmbeddingPipeline.getInstance as jest.Mock).mockResolvedValue({
      embed: mockEmbed,
      embedBatch: mockEmbedBatch,
    } as any);
  });

  it('embeds single text', async () => {
    mockEmbed.mockResolvedValue({ vector: [0.1, 0.2], model: 'test' });

    const { result } = renderHook(() => useEmbeddings());

    let embeddingResult: any;
    await act(async () => {
      embeddingResult = await result.current.embed('hello');
    });

    expect(embeddingResult).toEqual({ vector: [0.1, 0.2], model: 'test' });
    expect(result.current.isLoading).toBe(false);
  });

  it('handles embed error', async () => {
    mockEmbed.mockRejectedValue(new Error('Model failed'));

    const { result } = renderHook(() => useEmbeddings());

    let embeddingResult: any;
    await act(async () => {
      embeddingResult = await result.current.embed('hello');
    });

    expect(embeddingResult).toBeNull();
    expect(result.current.error).toBe('Model failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('embeds batch', async () => {
    mockEmbedBatch.mockResolvedValue([
      { vector: [0.1, 0.2], model: 'test' },
      { vector: [0.3, 0.4], model: 'test' },
    ]);

    const { result } = renderHook(() => useEmbeddings());

    let batchResult: any;
    await act(async () => {
      batchResult = await result.current.embedBatch(['a', 'b']);
    });

    expect(batchResult).toHaveLength(2);
  });

  it('handles batch embed error', async () => {
    mockEmbedBatch.mockRejectedValue(new Error('Batch failed'));

    const { result } = renderHook(() => useEmbeddings());

    let batchResult: any;
    await act(async () => {
      batchResult = await result.current.embedBatch(['a', 'b']);
    });

    expect(batchResult).toBeNull();
    expect(result.current.error).toBe('Batch failed');
  });

  it('ranks by similarity', async () => {
    mockEmbedBatch.mockResolvedValue([
      { vector: [1, 0], model: 'test' }, // query
      { vector: [1, 0], model: 'test' }, // chunk 1 - identical
      { vector: [0, 1], model: 'test' }, // chunk 2 - orthogonal
    ]);

    const { result } = renderHook(() => useEmbeddings());

    let rankings: any;
    await act(async () => {
      rankings = await result.current.rankBySimilarity('query', ['chunk1', 'chunk2']);
    });

    expect(rankings).toHaveLength(2);
    expect(rankings[0].text).toBe('chunk1');
    expect(rankings[0].similarity).toBeCloseTo(1, 5);
    expect(rankings[1].similarity).toBeCloseTo(0, 5);
  });

  it('handles ranking error', async () => {
    mockEmbedBatch.mockRejectedValue(new Error('Ranking failed'));

    const { result } = renderHook(() => useEmbeddings());

    let rankings: any;
    await act(async () => {
      rankings = await result.current.rankBySimilarity('query', ['chunk1']);
    });

    expect(rankings).toEqual([]);
    expect(result.current.error).toBe('Ranking failed');
  });

  it('returns empty rankings for empty texts', async () => {
    mockEmbedBatch.mockResolvedValue([{ vector: [1, 0], model: 'test' }]);

    const { result } = renderHook(() => useEmbeddings());

    let rankings: any;
    await act(async () => {
      rankings = await result.current.rankBySimilarity('query', []);
    });

    expect(rankings).toEqual([]);
  });

  it('handles pipeline getInstance error in embed', async () => {
    (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue(
      new Error('Pipeline init failed')
    );

    const { result } = renderHook(() => useEmbeddings());

    let embeddingResult: any;
    await act(async () => {
      embeddingResult = await result.current.embed('hello');
    });

    expect(embeddingResult).toBeNull();
    expect(result.current.error).toBe('Pipeline init failed');
  });

  it('handles pipeline getInstance error in embedBatch', async () => {
    (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue(
      new Error('Batch pipeline init failed')
    );

    const { result } = renderHook(() => useEmbeddings());

    let batchResult: any;
    await act(async () => {
      batchResult = await result.current.embedBatch(['a', 'b']);
    });

    expect(batchResult).toBeNull();
    expect(result.current.error).toBe('Batch pipeline init failed');
  });

  it('handles pipeline getInstance error in rankBySimilarity', async () => {
    (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue(
      new Error('Rank pipeline init failed')
    );

    const { result } = renderHook(() => useEmbeddings());

    let rankings: any;
    await act(async () => {
      rankings = await result.current.rankBySimilarity('query', ['chunk1']);
    });

    expect(rankings).toEqual([]);
    expect(result.current.error).toBe('Rank pipeline init failed');
  });

  it('handles non-Error throw in embed', async () => {
    (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue('string error');

    const { result } = renderHook(() => useEmbeddings());

    let embeddingResult: any;
    await act(async () => {
      embeddingResult = await result.current.embed('hello');
    });

    expect(embeddingResult).toBeNull();
    expect(result.current.error).toBe('Embedding failed');
  });

  it('handles non-Error throw in embedBatch', async () => {
    (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue('batch string error');

    const { result } = renderHook(() => useEmbeddings());

    let batchResult: any;
    await act(async () => {
      batchResult = await result.current.embedBatch(['a', 'b']);
    });

    expect(batchResult).toBeNull();
    expect(result.current.error).toBe('Batch embedding failed');
  });

  it('handles non-Error throw in rankBySimilarity', async () => {
    (EmbeddingPipeline.getInstance as jest.Mock).mockRejectedValue('rank string error');

    const { result } = renderHook(() => useEmbeddings());

    let rankings: any;
    await act(async () => {
      rankings = await result.current.rankBySimilarity('query', ['chunk1']);
    });

    expect(rankings).toEqual([]);
    expect(result.current.error).toBe('Similarity ranking failed');
  });
});
