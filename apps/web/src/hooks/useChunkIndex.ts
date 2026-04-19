'use client';

import { useState, useCallback, useRef } from 'react';
import type { Chunk, SearchResult } from '@/types';
import { chunkText } from '@/lib/chunking';
import { ChunkIndex } from '@/lib/minisearch-index';

export interface UseChunkIndexReturn {
  chunks: Chunk[];
  isIndexing: boolean;
  indexMarkdown: (markdown: string) => void;
  search: (query: string) => SearchResult[];
  clearIndex: () => void;
}

export function useChunkIndex(): UseChunkIndexReturn {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const indexRef = useRef<ChunkIndex | null>(null);

  const indexMarkdown = useCallback((markdown: string) => {
    console.log('[useChunkIndex] indexMarkdown called, markdown length:', markdown?.length ?? 0);
    setIsIndexing(true);
    try {
      const newChunks = chunkText(markdown);
      console.log('[useChunkIndex] chunks created:', newChunks.length);
      if (newChunks.length > 0) {
        console.log('[useChunkIndex] first chunk preview:', newChunks[0].text.slice(0, 120));
      }
      const index = new ChunkIndex();
      index.addChunks(newChunks);
      indexRef.current = index;
      setChunks(newChunks);
    } catch (err) {
      console.error('[useChunkIndex] chunking failed:', err);
    } finally {
      setIsIndexing(false);
    }
  }, []);

  const search = useCallback((query: string): SearchResult[] => {
    if (!indexRef.current) return [];
    return indexRef.current.search(query, 5);
  }, []);

  const clearIndex = useCallback(() => {
    indexRef.current?.clear();
    indexRef.current = null;
    setChunks([]);
  }, []);

  return {
    chunks,
    isIndexing,
    indexMarkdown,
    search,
    clearIndex,
  };
}
