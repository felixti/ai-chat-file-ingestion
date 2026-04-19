import { EmbeddingPipeline, cosineSimilarity } from '@/lib/embeddings';

const mockPipeline = jest.fn();
const mockExtractor = jest.fn();

jest.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => mockPipeline(...args),
}));

describe('EmbeddingPipeline', () => {
  beforeEach(() => {
    EmbeddingPipeline.resetInstance();
    jest.clearAllMocks();
    mockPipeline.mockResolvedValue(mockExtractor);
  });

  it('returns a singleton instance', async () => {
    const instance1 = await EmbeddingPipeline.getInstance();
    const instance2 = await EmbeddingPipeline.getInstance();
    expect(instance1).toBe(instance2);
    expect(mockPipeline).toHaveBeenCalledTimes(1);
  });

  it('embeds text and returns vector', async () => {
    const mockOutput = {
      data: new Float32Array([0.1, 0.2, 0.3]),
    };
    mockExtractor.mockResolvedValue(mockOutput);

    const pipeline = await EmbeddingPipeline.getInstance();
    const result = await pipeline.embed('hello');

    expect(result.vector).toEqual(Array.from(mockOutput.data));
    expect(result.model).toBe('Xenova/all-MiniLM-L6-v2');
  });

  it('embeds batch and returns multiple vectors', async () => {
    const mockOutputs = [
      { data: new Float32Array([0.1, 0.2]) },
      { data: new Float32Array([0.3, 0.4]) },
    ];
    mockExtractor.mockResolvedValue(mockOutputs);

    const pipeline = await EmbeddingPipeline.getInstance();
    const results = await pipeline.embedBatch(['hello', 'world']);

    expect(results).toHaveLength(2);
    expect(results[0].vector).toEqual(Array.from(mockOutputs[0].data));
    expect(results[1].vector).toEqual(Array.from(mockOutputs[1].data));
  });

  it('throws if embed called before load', async () => {
    const pipeline = new EmbeddingPipeline();
    await expect(pipeline.embed('test')).rejects.toThrow('Embedding pipeline not loaded');
  });

  it('handles extractor rejection with string in embed', async () => {
    mockExtractor.mockReset();
    mockExtractor.mockRejectedValue('extraction failed');
    const instance = await EmbeddingPipeline.getInstance();
    await expect(instance.embed('test')).rejects.toEqual('extraction failed');
  });

  it('returns empty array for embedBatch with empty input', async () => {
    mockExtractor.mockReset();
    const instance = await EmbeddingPipeline.getInstance();
    const results = await instance.embedBatch([]);
    expect(results).toEqual([]);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('throws for different length vectors', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Vectors must have the same length');
  });
});
