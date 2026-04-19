import { createLLMClient, getDefaultLLMConfig } from '@/lib/llm-client';

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn((config) => ({
    chat: (model: string) => ({ model, ...config }),
  })),
}));

describe('createLLMClient', () => {
  it('creates client with provided config', () => {
    const client = createLLMClient({
      baseURL: 'http://localhost:11434/v1',
      model: 'llama3.2',
    });

    expect(client).toBeDefined();
    expect((client as any).model).toBe('llama3.2');
    expect((client as any).baseURL).toBe('http://localhost:11434/v1');
  });

  it('uses provided apiKey', () => {
    const client = createLLMClient({
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o',
    });

    expect((client as any).apiKey).toBe('sk-test');
  });

  it('uses default apiKey when not provided', () => {
    const client = createLLMClient({
      baseURL: 'http://localhost:11434/v1',
      model: 'llama3.2',
    });

    expect((client as any).apiKey).toBe('ollama');
  });

  it('formats custom baseURL correctly', () => {
    const baseURL = 'https://custom-api.example.com/v1';
    const client = createLLMClient({
      baseURL,
      model: 'custom-model',
    });

    expect((client as any).baseURL).toBe(baseURL);
  });
});

describe('getDefaultLLMConfig', () => {
  it('returns default Ollama configuration', () => {
    const config = getDefaultLLMConfig();
    expect(config.baseURL).toBe('http://localhost:11434/v1');
    expect(config.model).toBe('llama3.2');
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(4096);
  });
});
