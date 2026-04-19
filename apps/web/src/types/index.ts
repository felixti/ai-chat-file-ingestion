export interface Chunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface EmbeddingResult {
  vector: number[];
  model: string;
}

export interface SearchResult {
  chunkId: string;
  score: number;
  text: string;
}

export interface LLMConfig {
  baseURL: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ParseResult {
  filename: string;
  content_type: string;
  markdown: string;
  metadata: Record<string, unknown>;
}

export interface FileUploadState {
  file: File | null;
  isUploading: boolean;
  error: string | null;
  result: ParseResult | null;
}
