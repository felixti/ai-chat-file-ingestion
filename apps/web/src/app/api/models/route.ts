import { NextResponse } from 'next/server';

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  object: string;
  data: OpenAIModel[];
}

const baseURL = process.env.LLM_BASE_URL || 'https://ollama.com/v1';
const apiKey = process.env.LLM_API_KEY || '';
const defaultModel = process.env.LLM_DEFAULT_MODEL || 'gemma4:31b-cloud';
const allowlistEnv = process.env.LLM_ALLOWLIST || '';

function getAllowlist(): string[] {
  return allowlistEnv
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

function isCloudConfigured(): boolean {
  // Consider it "cloud" if baseURL is not localhost and apiKey is set
  const isLocal =
    baseURL.includes('localhost') || baseURL.includes('127.0.0.1') || baseURL.includes('::1');
  return !isLocal && apiKey.length > 0;
}

async function fetchModelsFromProvider(): Promise<string[] | null> {
  try {
    const res = await fetch(`${baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      // Abort if it takes too long
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(`Failed to fetch models from provider: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as OpenAIModelsResponse;
    if (!Array.isArray(data.data)) return null;

    const allModels = data.data.map((m) => m.id);

    // If allowlist is configured, filter; otherwise return all
    const allowlist = getAllowlist();
    if (allowlist.length > 0) {
      return allModels.filter((m) => allowlist.includes(m));
    }

    return allModels;
  } catch (err) {
    console.warn('Error fetching models from provider:', err);
    return null;
  }
}

export async function GET() {
  // The allowlist is the definitive source of truth for which models
  // the user can select. Live provider fetching is used only to log
  // which allowlisted models are actually available.
  let models = getAllowlist();

  // If allowlist is empty, fall back to default model
  if (models.length === 0) {
    models = [defaultModel];
  }

  // Optionally validate against provider in the background (logging only)
  if (isCloudConfigured()) {
    const liveModels = await fetchModelsFromProvider();
    if (liveModels) {
      const unavailable = models.filter((m) => !liveModels.includes(m));
      if (unavailable.length > 0) {
        console.warn(
          `[models] allowlisted models not available on provider: ${unavailable.join(', ')}`
        );
      }
    }
  }

  return NextResponse.json({ models, defaultModel });
}
