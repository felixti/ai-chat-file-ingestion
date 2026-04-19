'use client';

import type { EmbeddingResult } from '@/types';

interface ExtractorOutput {
  data: Float32Array;
}

interface FeatureExtractor {
  (text: string, options?: { pooling?: string; normalize?: boolean }): Promise<ExtractorOutput>;
  (
    texts: string[],
    options?: { pooling?: string; normalize?: boolean }
  ): Promise<ExtractorOutput[]>;
}

let pipelineInstance: EmbeddingPipeline | null = null;
let pipelineLoadPromise: Promise<EmbeddingPipeline> | null = null;

export class EmbeddingPipeline {
  private extractor: FeatureExtractor | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  static async getInstance(): Promise<EmbeddingPipeline> {
    if (pipelineInstance) {
      return pipelineInstance;
    }
    if (!pipelineLoadPromise) {
      pipelineLoadPromise = (async () => {
        const instance = new EmbeddingPipeline();
        await instance.load();
        pipelineInstance = instance;
        return instance;
      })();
    }
    return pipelineLoadPromise;
  }

  private async load(): Promise<void> {
    const { pipeline } = await import('@huggingface/transformers');
    this.extractor = (await pipeline('feature-extraction', this.modelName, {
      dtype: 'fp32',
    })) as unknown as FeatureExtractor;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.extractor) {
      throw new Error('Embedding pipeline not loaded');
    }
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data) as number[];
    return { vector, model: this.modelName };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.extractor) {
      throw new Error('Embedding pipeline not loaded');
    }
    const outputs = await this.extractor(texts, { pooling: 'mean', normalize: true });
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i++) {
      const data = outputs[i];
      const vector = Array.from(data.data) as number[];
      results.push({ vector, model: this.modelName });
    }

    return results;
  }

  static resetInstance(): void {
    pipelineInstance = null;
    pipelineLoadPromise = null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
