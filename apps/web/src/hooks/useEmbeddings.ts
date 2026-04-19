'use client';

import { useState, useCallback, useRef } from 'react';
import type { EmbeddingResult } from '@/types';
import { EmbeddingPipeline, cosineSimilarity } from '@/lib/embeddings';

export interface UseEmbeddingsReturn {
  isLoading: boolean;
  error: string | null;
  embed: (text: string) => Promise<EmbeddingResult | null>;
  embedBatch: (texts: string[]) => Promise<EmbeddingResult[] | null>;
  rankBySimilarity: (
    query: string,
    texts: string[]
  ) => Promise<{ text: string; similarity: number }[]>;
}

export function useEmbeddings(): UseEmbeddingsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pipelineRef = useRef<EmbeddingPipeline | null>(null);

  const getPipeline = useCallback(async (): Promise<EmbeddingPipeline> => {
    if (!pipelineRef.current) {
      pipelineRef.current = await EmbeddingPipeline.getInstance();
    }
    return pipelineRef.current;
  }, []);

  const embed = useCallback(
    async (text: string): Promise<EmbeddingResult | null> => {
      setError(null);
      setIsLoading(true);
      try {
        const pipeline = await getPipeline();
        const result = await pipeline.embed(text);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Embedding failed';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getPipeline]
  );

  const embedBatch = useCallback(
    async (texts: string[]): Promise<EmbeddingResult[] | null> => {
      setError(null);
      setIsLoading(true);
      try {
        const pipeline = await getPipeline();
        const results = await pipeline.embedBatch(texts);
        return results;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Batch embedding failed';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getPipeline]
  );

  const rankBySimilarity = useCallback(
    async (query: string, texts: string[]): Promise<{ text: string; similarity: number }[]> => {
      setError(null);
      setIsLoading(true);
      try {
        const pipeline = await getPipeline();
        const [queryResult, ...chunkResults] = await pipeline.embedBatch([query, ...texts]);

        const rankings = texts.map((text, i) => ({
          text,
          similarity: cosineSimilarity(queryResult.vector, chunkResults[i].vector),
        }));

        rankings.sort((a, b) => b.similarity - a.similarity);
        return rankings;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Similarity ranking failed';
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getPipeline]
  );

  return {
    isLoading,
    error,
    embed,
    embedBatch,
    rankBySimilarity,
  };
}
