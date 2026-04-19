import MiniSearch from 'minisearch';
import type { Chunk, SearchResult } from '@/types';

interface MiniSearchDoc {
  id: string;
  text: string;
}

export class ChunkIndex {
  private miniSearch: MiniSearch<MiniSearchDoc>;
  private chunks: Map<string, Chunk> = new Map();

  constructor() {
    this.miniSearch = new MiniSearch<MiniSearchDoc>({
      fields: ['text'],
      storeFields: ['text'],
      idField: 'id',
    });
  }

  addChunks(chunks: Chunk[]): void {
    const docs = chunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.text,
    }));

    this.miniSearch.addAll(docs);

    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  search(query: string, limit = 5): SearchResult[] {
    if (!query.trim()) {
      return [];
    }

    const results = this.miniSearch.search(query).slice(0, limit);

    return results.map((result) => ({
      chunkId: result.id,
      score: result.score,
      text: result.text || this.chunks.get(result.id)?.text || '',
    }));
  }

  getChunkById(id: string): Chunk | undefined {
    return this.chunks.get(id);
  }

  clear(): void {
    this.miniSearch = new MiniSearch({
      fields: ['text'],
      storeFields: ['text'],
      idField: 'id',
    });
    this.chunks.clear();
  }
}
