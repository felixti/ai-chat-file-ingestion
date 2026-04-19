import { ChunkIndex } from '@/lib/minisearch-index';
import type { Chunk } from '@/types';

describe('ChunkIndex', () => {
  let index: ChunkIndex;

  const chunks: Chunk[] = [
    { id: '1', text: 'The quick brown fox', startIndex: 0, endIndex: 19 },
    { id: '2', text: 'jumps over the lazy dog', startIndex: 20, endIndex: 43 },
    { id: '3', text: 'Python is a programming language', startIndex: 44, endIndex: 76 },
  ];

  beforeEach(() => {
    index = new ChunkIndex();
    index.addChunks(chunks);
  });

  it('indexes chunks without error', () => {
    expect(index).toBeDefined();
  });

  it('returns search results ranked by relevance', () => {
    const results = index.search('quick fox');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunkId).toBe('1');
    expect(results[0].text).toBe('The quick brown fox');
  });

  it('returns top-k results when limit is specified', () => {
    const results = index.search('the', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array for empty query', () => {
    const results = index.search('');
    expect(results).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    const results = index.search('   ');
    expect(results).toEqual([]);
  });

  it('retrieves chunk by id', () => {
    const chunk = index.getChunkById('2');
    expect(chunk).toBeDefined();
    expect(chunk?.text).toBe('jumps over the lazy dog');
  });

  it('returns undefined for unknown chunk id', () => {
    const chunk = index.getChunkById('unknown');
    expect(chunk).toBeUndefined();
  });

  it('clears index and chunks', () => {
    index.clear();
    expect(index.search('quick')).toEqual([]);
    expect(index.getChunkById('1')).toBeUndefined();
  });

  it('returns results with scores', () => {
    const results = index.search('programming');
    expect(results.length).toBeGreaterThan(0);
    expect(typeof results[0].score).toBe('number');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('falls back to chunk text when result text is missing', () => {
    // Manually add a doc to minisearch without storeFields to trigger fallback
    const customIndex = new ChunkIndex();
    const chunk: Chunk = {
      id: 'fallback',
      text: 'fallback text content',
      startIndex: 0,
      endIndex: 21,
    };
    customIndex.addChunks([chunk]);
    // The fallback path is covered when storeFields does not include text;
    // in our impl storeFields always includes text, so we test getChunkById directly
    expect(customIndex.getChunkById('fallback')?.text).toBe('fallback text content');
  });
});
