import { createOpenAI } from '@ai-sdk/openai';
import type { LLMConfig } from '@/types';
import { fetchWithRetry } from './fetch-with-retry';

const fetchWithRetryFn = fetchWithRetry({ retries: 3, baseDelayMs: 1000, maxDelayMs: 5000 });

export function createLLMClient(config: LLMConfig) {
  const openai = createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey ?? 'ollama',
    fetch: fetchWithRetryFn,
  });

  return openai.chat(config.model);
}

export function getDefaultLLMConfig(): LLMConfig {
  return {
    baseURL: process.env.NEXT_PUBLIC_LLM_BASE_URL || 'http://localhost:11434/v1',
    model: process.env.NEXT_PUBLIC_LLM_MODEL || 'llama3.2',
    temperature: 0.7,
    maxTokens: 4096,
  };
}
