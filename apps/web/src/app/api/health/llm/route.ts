import { NextResponse } from 'next/server';

export async function GET() {
  const requestId = crypto.randomUUID();
  const baseURL = process.env.LLM_BASE_URL || 'https://ollama.com/v1';
  const apiKey = process.env.LLM_API_KEY || '';
  const defaultModel = process.env.LLM_DEFAULT_MODEL || 'gemma4:31b-cloud';

  // Check if API key looks like a placeholder
  const isPlaceholderKey =
    apiKey === '' ||
    apiKey === 'your-ollama-api-key-here' ||
    apiKey === 'ollama';

  if (isPlaceholderKey) {
    return NextResponse.json(
      {
        status: 'misconfigured',
        error: 'LLM_API_KEY is not set or is a placeholder. Set your real Ollama Cloud API key in .env',
        baseURL,
        model: defaultModel,
        requestId,
      },
      { status: 503, headers: { 'X-Request-ID': requestId } }
    );
  }

  // Try to list models from the provider
  try {
    const res = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown');
      console.error(`[health ${requestId}] LLM provider error ${res.status}:`, body);
      return NextResponse.json(
        {
          status: 'error',
          error: `LLM provider returned ${res.status}. Check your API key and baseURL.`,
          baseURL,
          model: defaultModel,
          requestId,
        },
        { status: 503, headers: { 'X-Request-ID': requestId } }
      );
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = data.data?.map((m) => m.id) ?? [];

    return NextResponse.json(
      {
        status: 'healthy',
        baseURL,
        model: defaultModel,
        availableModels: models.slice(0, 20),
        requestId,
      },
      { headers: { 'X-Request-ID': requestId } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error(`[health ${requestId}] LLM connection failed:`, message);
    return NextResponse.json(
      {
        status: 'error',
        error: `Cannot connect to LLM provider: ${message}`,
        baseURL,
        model: defaultModel,
        requestId,
      },
      { status: 503, headers: { 'X-Request-ID': requestId } }
    );
  }
}
