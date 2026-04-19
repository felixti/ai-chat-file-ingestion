import { ChunkIndex } from '@/lib/minisearch-index';
import type { Chunk } from '@/types';

function createChunks(): Chunk[] {
  return [
    {
      id: 'chunk-1',
      text: 'Introduction to machine learning and neural networks. Deep learning models require large datasets.',
      startIndex: 0,
      endIndex: 100,
    },
    {
      id: 'chunk-2',
      text: 'React components and hooks for building modern user interfaces. State management is crucial.',
      startIndex: 101,
      endIndex: 200,
    },
    {
      id: 'chunk-3',
      text: 'PostgreSQL database indexing strategies for query optimization. B-tree indexes improve lookup speed.',
      startIndex: 201,
      endIndex: 300,
    },
    {
      id: 'chunk-4',
      text: 'Docker container orchestration with Kubernetes. Pods, services, and deployments manage workloads.',
      startIndex: 301,
      endIndex: 400,
    },
    {
      id: 'chunk-5',
      text: 'TypeScript type safety and generic programming patterns. Generics enable reusable components.',
      startIndex: 401,
      endIndex: 500,
    },
    {
      id: 'chunk-6',
      text: 'Machine learning deployment pipelines using MLOps. Monitoring model drift in production systems.',
      startIndex: 501,
      endIndex: 600,
    },
  ];
}

describe('ChunkIndex', () => {
  let index: ChunkIndex;

  beforeEach(() => {
    index = new ChunkIndex();
  });

  afterEach(() => {
    index.clear();
  });

  describe('constructor', () => {
    it('should create an instance with no indexed documents', () => {
      expect(index.search('machine learning')).toEqual([]);
      expect(index.getChunkById('chunk-1')).toBeUndefined();
    });
  });

  describe('addChunks', () => {
    it('should add documents to the index so they become searchable', () => {
      const chunks = createChunks();
      index.addChunks(chunks);

      const results = index.search('machine learning');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.chunkId === 'chunk-1')).toBe(true);
    });

    it('should store chunks internally for retrieval by id', () => {
      const chunks = createChunks();
      index.addChunks(chunks);

      chunks.forEach((chunk) => {
        expect(index.getChunkById(chunk.id)).toEqual(chunk);
      });
    });

    it('should handle an empty array without error', () => {
      expect(() => index.addChunks([])).not.toThrow();
      expect(index.search('anything')).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      index.addChunks(createChunks());
    });

    it('should return ranked results with scores and text', () => {
      const results = index.search('machine learning');

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result).toHaveProperty('chunkId');
        expect(typeof result.chunkId).toBe('string');
        expect(result).toHaveProperty('score');
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThan(0);
        expect(result).toHaveProperty('text');
        expect(typeof result.text).toBe('string');
        expect(result.text.length).toBeGreaterThan(0);
      });
    });

    it('should rank more relevant documents higher', () => {
      const results = index.search('machine learning');
      // chunk-1 and chunk-6 both mention machine learning; chunk-1 has it in the first sentence
      expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
    });

    it('should return empty array for empty query', () => {
      expect(index.search('')).toEqual([]);
    });

    it('should return empty array for whitespace-only query', () => {
      expect(index.search('   ')).toEqual([]);
      expect(index.search('\t\n')).toEqual([]);
    });

    it('should return empty array when no documents match', () => {
      expect(index.search('xyznonexistent')).toEqual([]);
    });

    it('should respect the limit parameter', () => {
      const unlimited = index.search('and');
      expect(unlimited.length).toBeGreaterThan(2);

      const limited = index.search('and', 2);
      expect(limited.length).toBe(2);
      expect(limited[0].chunkId).toBe(unlimited[0].chunkId);
      expect(limited[1].chunkId).toBe(unlimited[1].chunkId);
    });

    it('should default limit to 5 when not provided', () => {
      // Add enough similar chunks to exceed the default limit of 5
      const extraChunks: Chunk[] = Array.from({ length: 10 }, (_, i) => ({
        id: `extra-${i}`,
        text: `Common keyword shared across all extra documents for testing default limits.`,
        startIndex: i * 100,
        endIndex: i * 100 + 50,
      }));
      index.addChunks(extraChunks);

      const results = index.search('common');
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should return fewer results than limit when index has fewer matches', () => {
      const results = index.search('PostgreSQL', 10);
      expect(results.length).toBe(1);
    });

    it('should fall back to chunk text when stored result text is falsy', () => {
      const chunks = createChunks();

      // Force miniSearch.search to return a result with a falsy text field
      const miniSearchInstance = (index as any).miniSearch;
      const originalSearch = miniSearchInstance.search.bind(miniSearchInstance);
      jest.spyOn(miniSearchInstance, 'search').mockImplementation((query: unknown) => {
        const raw = originalSearch(query);
        return raw.map((r: any) => ({ ...r, text: '' }));
      });

      const results = index.search('React');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].text).toBe(chunks.find((c) => c.id === results[0].chunkId)!.text);
    });

    it('should return empty string when both stored text and chunk lookup fail', () => {
      const miniSearchInstance = (index as any).miniSearch;
      jest.spyOn(miniSearchInstance, 'search').mockReturnValue([
        { id: 'ghost-id', score: 1.0, text: '' },
      ] as any);

      const results = index.search('anything');
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('');
    });
  });

  describe('getChunkById', () => {
    beforeEach(() => {
      index.addChunks(createChunks());
    });

    it('should return the correct chunk for a known id', () => {
      const chunk = index.getChunkById('chunk-3');
      expect(chunk).toBeDefined();
      expect(chunk!.id).toBe('chunk-3');
      expect(chunk!.text).toContain('PostgreSQL');
    });

    it('should return undefined for an unknown id', () => {
      expect(index.getChunkById('does-not-exist')).toBeUndefined();
    });

    it('should return undefined before any chunks are added', () => {
      const freshIndex = new ChunkIndex();
      expect(freshIndex.getChunkById('chunk-1')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all indexed documents so search returns nothing', () => {
      index.addChunks(createChunks());
      expect(index.search('machine learning').length).toBeGreaterThan(0);

      index.clear();
      expect(index.search('machine learning')).toEqual([]);
    });

    it('should remove all stored chunks so getChunkById returns undefined', () => {
      index.addChunks(createChunks());
      expect(index.getChunkById('chunk-1')).toBeDefined();

      index.clear();
      expect(index.getChunkById('chunk-1')).toBeUndefined();
    });

    it('should allow re-adding chunks after clear', () => {
      index.addChunks(createChunks());
      index.clear();

      const newChunks: Chunk[] = [
        {
          id: 'chunk-new',
          text: 'Fresh document after clearing the index.',
          startIndex: 0,
          endIndex: 50,
        },
      ];
      index.addChunks(newChunks);

      expect(index.getChunkById('chunk-new')).toEqual(newChunks[0]);
      expect(index.search('Fresh').length).toBeGreaterThan(0);
      expect(index.getChunkById('chunk-1')).toBeUndefined();
    });
  });

  describe('multiple addChunks calls', () => {
    it('should be additive and index documents from all calls', () => {
      const firstBatch: Chunk[] = [
        {
          id: 'batch-a-1',
          text: 'First batch document about astronomy and stars.',
          startIndex: 0,
          endIndex: 50,
        },
      ];
      const secondBatch: Chunk[] = [
        {
          id: 'batch-b-1',
          text: 'Second batch document about geology and rocks.',
          startIndex: 51,
          endIndex: 100,
        },
      ];

      index.addChunks(firstBatch);
      index.addChunks(secondBatch);

      const astronomyResults = index.search('astronomy');
      expect(astronomyResults.length).toBeGreaterThan(0);
      expect(astronomyResults[0].chunkId).toBe('batch-a-1');

      const geologyResults = index.search('geology');
      expect(geologyResults.length).toBeGreaterThan(0);
      expect(geologyResults[0].chunkId).toBe('batch-b-1');

      expect(index.getChunkById('batch-a-1')).toEqual(firstBatch[0]);
      expect(index.getChunkById('batch-b-1')).toEqual(secondBatch[0]);
    });

    it('should throw when adding chunks with duplicate ids because MiniSearch rejects duplicates', () => {
      const first: Chunk = {
        id: 'dup',
        text: 'Original text about cats.',
        startIndex: 0,
        endIndex: 30,
      };
      const second: Chunk = {
        id: 'dup',
        text: 'Updated text about dogs.',
        startIndex: 31,
        endIndex: 60,
      };

      index.addChunks([first]);
      expect(() => index.addChunks([second])).toThrow('duplicate ID');
    });
  });
});
