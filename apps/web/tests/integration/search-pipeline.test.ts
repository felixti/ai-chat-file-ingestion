import { chunkText } from '@/lib/chunking';
import { ChunkIndex } from '@/lib/minisearch-index';
import { EmbeddingPipeline, cosineSimilarity } from '@/lib/embeddings';

const mockPipeline = jest.fn();
const mockExtractor = jest.fn();

jest.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => mockPipeline(...args),
}));

describe('Two-Stage Search Pipeline (MiniSearch + MiniLM)', () => {
  const sampleMarkdown = `
# Machine Learning Overview

Machine learning is a subset of artificial intelligence that enables systems to learn from data.
Supervised learning uses labeled datasets to train models.
Unsupervised learning discovers hidden patterns in unlabeled data.

# React Development

React is a JavaScript library for building user interfaces.
Components are the building blocks of React applications.
Hooks like useState and useEffect manage state and side effects.

# Database Optimization

PostgreSQL provides advanced indexing strategies including B-tree and GiST.
Query optimization reduces execution time for complex joins.
Connection pooling improves throughput for high-traffic applications.
`.trim();

  beforeEach(() => {
    EmbeddingPipeline.resetInstance();
    jest.clearAllMocks();
    mockPipeline.mockResolvedValue(mockExtractor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('chunks markdown, indexes with MiniSearch, and retrieves relevant chunks', () => {
    const chunks = chunkText(sampleMarkdown);
    expect(chunks.length).toBeGreaterThan(0);

    const index = new ChunkIndex();
    index.addChunks(chunks);

    const results = index.search('machine learning');
    expect(results.length).toBeGreaterThan(0);

    // The first result should be the ML chunk
    const mlChunk = chunks.find((c) => c.text.includes('Machine learning'));
    expect(mlChunk).toBeDefined();
    expect(results[0].chunkId).toBe(mlChunk!.id);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].text).toContain('Machine learning');
  });

  it('ranks MiniSearch results by MiniLM embedding similarity', async () => {
    // Setup: chunk and index
    const chunks = chunkText(sampleMarkdown);
    const index = new ChunkIndex();
    index.addChunks(chunks);

    // Stage 1: MiniSearch keyword retrieval
    const query = 'React hooks and components';
    const searchResults = index.search(query, 5);
    expect(searchResults.length).toBeGreaterThan(0);

    // Stage 2: MiniLM semantic reranking
    // Mock extractor to return deterministic embeddings
    // We'll simulate that the React chunk is most similar to the query
    const reactChunk = chunks.find((c) => c.text.includes('React'))!;
    const mlChunk = chunks.find((c) => c.text.includes('Machine learning'))!;
    const dbChunk = chunks.find((c) => c.text.includes('PostgreSQL'))!;

    const embeddings: Record<string, number[]> = {
      [query]: [1.0, 0.9, 0.8], // query vector
      [reactChunk.text]: [0.95, 0.85, 0.75], // very similar to query
      [mlChunk.text]: [0.2, 0.1, 0.3], // dissimilar
      [dbChunk.text]: [0.1, 0.2, 0.15], // dissimilar
    };

    mockExtractor.mockImplementation((texts: string | string[]) => {
      const arr = Array.isArray(texts) ? texts : [texts];
      const outputs = arr.map((t) => {
        const key = Object.keys(embeddings).find((k) => t.includes(k.slice(0, 20))) || t;
        const vec = embeddings[key] || embeddings[t] || [0, 0, 0];
        return { data: new Float32Array(vec) };
      });
      return Promise.resolve(Array.isArray(texts) ? outputs : outputs[0]);
    });

    const pipeline = await EmbeddingPipeline.getInstance();

    // Embed query + top search results
    const topTexts = searchResults.map((r) => r.text);
    const allEmbeddings = await pipeline.embedBatch([query, ...topTexts]);

    expect(allEmbeddings.length).toBe(1 + topTexts.length);

    // Compute similarities
    const queryVector = allEmbeddings[0].vector;
    const rankings = topTexts.map((text, i) => ({
      text,
      similarity: cosineSimilarity(queryVector, allEmbeddings[i + 1].vector),
    }));

    rankings.sort((a, b) => b.similarity - a.similarity);

    // The React-related chunk should rank highest
    expect(rankings[0].text).toContain('React');
    // If there's only 1 result, similarity equals itself; if multiple, highest > lowest
    if (rankings.length > 1) {
      expect(rankings[0].similarity).toBeGreaterThanOrEqual(rankings[rankings.length - 1].similarity);
    }
  });

  it('returns empty results when query matches no chunks', () => {
    const chunks = chunkText(sampleMarkdown);
    const index = new ChunkIndex();
    index.addChunks(chunks);

    const results = index.search('xyznonexistentquery12345');
    expect(results).toEqual([]);
  });

  it('limits MiniSearch results before MiniLM reranking', async () => {
    const chunks = chunkText(sampleMarkdown);
    const index = new ChunkIndex();
    index.addChunks(chunks);

    const query = 'optimization';
    const limit = 2;
    const searchResults = index.search(query, limit);

    expect(searchResults.length).toBeLessThanOrEqual(limit);
    expect(searchResults.length).toBeGreaterThan(0);

    // Verify the pipeline only reranks the limited subset
    mockExtractor.mockImplementation((texts: string | string[]) => {
      const arr = Array.isArray(texts) ? texts : [texts];
      const outputs = arr.map(() => ({ data: new Float32Array([0.5, 0.5, 0.5]) }));
      return Promise.resolve(Array.isArray(texts) ? outputs : outputs[0]);
    });

    const pipeline = await EmbeddingPipeline.getInstance();
    const allEmbeddings = await pipeline.embedBatch([query, ...searchResults.map((r) => r.text)]);
    expect(allEmbeddings.length).toBe(1 + searchResults.length);
  });

  it('produces stable reranking with identical embeddings', async () => {
    const chunks = chunkText(sampleMarkdown);
    const index = new ChunkIndex();
    index.addChunks(chunks);

    const query = 'data';
    const searchResults = index.search(query, 3);

    mockExtractor.mockImplementation((texts: string | string[]) => {
      const arr = Array.isArray(texts) ? texts : [texts];
      // Return identical embeddings for everything
      const outputs = arr.map(() => ({ data: new Float32Array([0.5, 0.5, 0.5]) }));
      return Promise.resolve(Array.isArray(texts) ? outputs : outputs[0]);
    });

    const pipeline = await EmbeddingPipeline.getInstance();
    const allEmbeddings = await pipeline.embedBatch([query, ...searchResults.map((r) => r.text)]);

    const queryVector = allEmbeddings[0].vector;
    const similarities = searchResults.map((_, i) =>
      cosineSimilarity(queryVector, allEmbeddings[i + 1].vector)
    );

    // All similarities should be exactly 1.0 since vectors are identical
    similarities.forEach((sim) => {
      expect(sim).toBeCloseTo(1.0, 5);
    });
  });

  it('handles the full pipeline with multiple additive chunk batches', () => {
    const index = new ChunkIndex();

    const batch1 = chunkText('First document about cats and dogs.');
    const batch2 = chunkText('Second document about birds and fish.');

    index.addChunks(batch1);
    index.addChunks(batch2);

    const catResults = index.search('cats');
    expect(catResults.length).toBeGreaterThan(0);
    expect(catResults[0].text).toContain('cats');

    const birdResults = index.search('birds');
    expect(birdResults.length).toBeGreaterThan(0);
    expect(birdResults[0].text).toContain('birds');
  });

  it('end-to-end: chunk → index → search → embed → rank → top-N selection', async () => {
    const markdown = `
# Cloud Computing

Cloud computing delivers computing services over the internet.
Major providers include AWS, Azure, and Google Cloud Platform.
Serverless computing abstracts infrastructure management completely from developers.

# DevOps Practices

DevOps combines development and operations to shorten the development lifecycle significantly.
CI/CD pipelines automate testing and deployment across all environments.
Infrastructure as Code manages resources through declarative definitions and templates.
    `.trim();

    // Step 1: Chunk
    const chunks = chunkText(markdown, { maxTokens: 50, overlapTokens: 5 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // Step 2: Index with MiniSearch
    const index = new ChunkIndex();
    index.addChunks(chunks);

    // Step 3: Search
    const query = 'automated deployment pipelines';
    const searchResults = index.search(query, 5);
    expect(searchResults.length).toBeGreaterThan(0);

    // Step 4: Mock embeddings for semantic reranking
    // Simulate that the DevOps chunk is more semantically similar
    const devopsChunk = chunks.find((c) => c.text.includes('DevOps'))!;
    const cloudChunk = chunks.find((c) => c.text.includes('Cloud computing'))!;

    mockExtractor.mockImplementation((texts: string | string[]) => {
      const arr = Array.isArray(texts) ? texts : [texts];
      const outputs = arr.map((t) => {
        if (t.includes('DevOps') || t.includes('CI/CD') || t.includes('deployment')) {
          return { data: new Float32Array([0.9, 0.8, 0.85]) };
        }
        if (t.includes('Cloud') || t.includes('AWS') || t.includes('serverless')) {
          return { data: new Float32Array([0.3, 0.2, 0.25]) };
        }
        return { data: new Float32Array([0.5, 0.5, 0.5]) };
      });
      return Promise.resolve(Array.isArray(texts) ? outputs : outputs[0]);
    });

    // Step 5: Embed and rank
    const pipeline = await EmbeddingPipeline.getInstance();
    const topTexts = searchResults.map((r) => r.text);
    const allEmbeddings = await pipeline.embedBatch([query, ...topTexts]);

    const queryVector = allEmbeddings[0].vector;
    const ranked = topTexts
      .map((text, i) => ({
        text,
        similarity: cosineSimilarity(queryVector, allEmbeddings[i + 1].vector),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    // Step 6: Select top-N (e.g., top 2)
    const topN = ranked.slice(0, 2);
    expect(topN.length).toBeLessThanOrEqual(2);

    // The highest-ranked result should be DevOps-related
    const highestRankedText = topN[0].text;
    expect(
      highestRankedText.includes('DevOps') ||
        highestRankedText.includes('CI/CD') ||
        highestRankedText.includes('deployment')
    ).toBe(true);

    // Verify we have distinct similarity scores
    if (topN.length >= 2) {
      expect(topN[0].similarity).toBeGreaterThanOrEqual(topN[1].similarity);
    }
  });
});
