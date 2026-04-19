import { EmbeddingPipeline, cosineSimilarity } from '@/lib/embeddings';

const mockPipeline = jest.fn();
const mockExtractor = jest.fn();

jest.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => mockPipeline(...args),
}));

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
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
      'Vectors must have the same length'
    );
  });

  it('returns correct value for proportional realistic embeddings', () => {
    const a = [0.1, 0.2, 0.3, 0.4];
    const b = [0.2, 0.4, 0.6, 0.8];
    // b = 2 * a, so cosine similarity should be exactly 1
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('returns correct value for non-parallel realistic embeddings', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // dot = 4 + 10 + 18 = 32
    // normA = sqrt(1 + 4 + 9) = sqrt(14)
    // normB = sqrt(16 + 25 + 36) = sqrt(77)
    // similarity = 32 / sqrt(14 * 77) = 32 / sqrt(1078)
    const expected = 32 / Math.sqrt(1078);
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5);
  });
});

describe('EmbeddingPipeline', () => {
  beforeEach(() => {
    EmbeddingPipeline.resetInstance();
    jest.clearAllMocks();
    mockPipeline.mockResolvedValue(mockExtractor);
    mockExtractor.mockImplementation((texts: string | string[]) => {
      if (typeof texts === 'string') {
        return Promise.resolve({ data: new Float32Array([0.1, 0.2, 0.3]) });
      }
      return Promise.resolve(
        (texts as string[]).map((_, i) => ({
          data: new Float32Array([0.1 * (i + 1), 0.2 * (i + 1), 0.3 * (i + 1)]),
        }))
      );
    });
  });

  describe('getInstance', () => {
    it('returns the same instance on multiple calls (singleton)', async () => {
      const instance1 = await EmbeddingPipeline.getInstance();
      const instance2 = await EmbeddingPipeline.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('loads the model on first call', async () => {
      await EmbeddingPipeline.getInstance();
      expect(mockPipeline).toHaveBeenCalledTimes(1);
      expect(mockPipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { dtype: 'fp32' }
      );
    });

    it('does not reload the model on subsequent calls', async () => {
      await EmbeddingPipeline.getInstance();
      await EmbeddingPipeline.getInstance();
      expect(mockPipeline).toHaveBeenCalledTimes(1);
    });
  });

  describe('embed', () => {
    it('returns an EmbeddingResult with vector and model name', async () => {
      const pipeline = await EmbeddingPipeline.getInstance();
      const result = await pipeline.embed('hello world');

      expect(result).toHaveProperty('vector');
      expect(result).toHaveProperty('model');
      expect(result.model).toBe('Xenova/all-MiniLM-L6-v2');
    });

    it('returns vector as number[] not Float32Array', async () => {
      mockExtractor.mockResolvedValue({
        data: new Float32Array([0.5, 0.25, 0.75]),
      });

      const pipeline = await EmbeddingPipeline.getInstance();
      const result = await pipeline.embed('hello world');

      expect(Array.isArray(result.vector)).toBe(true);
      expect(result.vector).toEqual([0.5, 0.25, 0.75]);
      expect(result.vector).not.toBeInstanceOf(Float32Array);
    });

    it('passes pooling and normalize options to extractor', async () => {
      const pipeline = await EmbeddingPipeline.getInstance();
      await pipeline.embed('hello');

      expect(mockExtractor).toHaveBeenCalledWith('hello', {
        pooling: 'mean',
        normalize: true,
      });
    });

    it('throws if pipeline not loaded', async () => {
      const pipeline = new EmbeddingPipeline();
      await expect(pipeline.embed('test')).rejects.toThrow(
        'Embedding pipeline not loaded'
      );
    });
  });

  describe('embedBatch', () => {
    it('returns array of results matching input length', async () => {
      const pipeline = await EmbeddingPipeline.getInstance();
      const results = await pipeline.embedBatch(['hello', 'world', 'foo']);

      expect(results).toHaveLength(3);
    });

    it('returns correct shape for each result', async () => {
      const pipeline = await EmbeddingPipeline.getInstance();
      const results = await pipeline.embedBatch(['hello', 'world']);

      results.forEach((result) => {
        expect(result).toHaveProperty('vector');
        expect(result).toHaveProperty('model');
        expect(Array.isArray(result.vector)).toBe(true);
        expect(result.model).toBe('Xenova/all-MiniLM-L6-v2');
      });
    });

    it('returns distinct vectors for each input', async () => {
      const pipeline = await EmbeddingPipeline.getInstance();
      const results = await pipeline.embedBatch(['a', 'b']);

      expect(results[0].vector).toEqual(Array.from(new Float32Array([0.1, 0.2, 0.3])));
      expect(results[1].vector).toEqual(Array.from(new Float32Array([0.2, 0.4, 0.6])));
    });

    it('passes pooling and normalize options to extractor', async () => {
      const pipeline = await EmbeddingPipeline.getInstance();
      await pipeline.embedBatch(['hello', 'world']);

      expect(mockExtractor).toHaveBeenCalledWith(
        ['hello', 'world'],
        { pooling: 'mean', normalize: true }
      );
    });

    it('returns empty array for empty input', async () => {
      const pipeline = await EmbeddingPipeline.getInstance();
      const results = await pipeline.embedBatch([]);

      expect(results).toEqual([]);
    });

    it('throws if pipeline not loaded', async () => {
      const pipeline = new EmbeddingPipeline();
      await expect(pipeline.embedBatch(['test'])).rejects.toThrow(
        'Embedding pipeline not loaded'
      );
    });
  });

  describe('resetInstance', () => {
    it('after reset, next getInstance() creates a new pipeline', async () => {
      const instance1 = await EmbeddingPipeline.getInstance();
      EmbeddingPipeline.resetInstance();
      const instance2 = await EmbeddingPipeline.getInstance();

      expect(instance1).not.toBe(instance2);
      expect(mockPipeline).toHaveBeenCalledTimes(2);
    });

    it('new instance is functional after reset', async () => {
      const instance1 = await EmbeddingPipeline.getInstance();
      await instance1.embed('first');

      EmbeddingPipeline.resetInstance();

      const instance2 = await EmbeddingPipeline.getInstance();
      const result = await instance2.embed('second');

      expect(result.vector).toEqual(Array.from(new Float32Array([0.1, 0.2, 0.3])));
      expect(result.model).toBe('Xenova/all-MiniLM-L6-v2');
    });
  });
});
