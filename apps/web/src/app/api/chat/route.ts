import { convertToCoreMessages, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(4000),
      })
    )
    .max(100),
  system: z.string().max(8000).optional(),
  model: z.string().max(100).optional(),
});

const baseURL = process.env.LLM_BASE_URL || 'https://ollama.com/v1';
const apiKey = process.env.LLM_API_KEY || '';
const defaultModel = process.env.LLM_DEFAULT_MODEL || 'gemma4:31b-cloud';
const allowlist = (process.env.LLM_ALLOWLIST || 'gemma4:31b-cloud,qwen3.6-cloud,nemotron-3-super:cloud')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

function isModelAllowed(model: string): boolean {
  return allowlist.includes(model);
}

// Simple in-memory rate limiter: max 20 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function getClientIP(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: Request) {
  const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.', requestId },
        { status: 429, headers: { 'X-Request-ID': requestId } }
      );
    }

    // Input validation
    const rawBody = await req.json();
    const parseResult = chatSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.format(), requestId },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    const { messages, system, model: requestedModel } = parseResult.data;

    console.log(`[chat ${requestId}] received request:`);
    console.log(`[chat ${requestId}] model:`, requestedModel || defaultModel);
    console.log(`[chat ${requestId}] system length:`, system?.length ?? 0);
    console.log(`[chat ${requestId}] system preview:`, system?.slice(0, 300));
    console.log(`[chat ${requestId}] messages count:`, messages.length);
    console.log(`[chat ${requestId}] last message:`, messages[messages.length - 1]);

    // Validate model against allowlist
    const model = requestedModel && isModelAllowed(requestedModel) ? requestedModel : defaultModel;

    if (requestedModel && !isModelAllowed(requestedModel)) {
      return NextResponse.json(
        {
          error: `Model '${requestedModel}' is not allowed. Allowed: ${allowlist.join(', ')}`,
          requestId,
        },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      );
    }

    const openai = createOpenAI({
      baseURL,
      apiKey,
    });

    const result = streamText({
      model: openai.chat(model),
      system,
      messages: convertToCoreMessages(messages),
      headers: { 'X-Request-ID': requestId },
      onError: (event) => {
        console.error(`[chat ${requestId}] streaming error:`, event.error);
      },
    });

    return result.toDataStreamResponse({
      headers: { 'X-Request-ID': requestId },
      getErrorMessage: (error) => {
        console.error(`[chat ${requestId}] stream error:`, error);
        return error instanceof Error ? error.message : 'Stream error';
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[chat ${requestId}] error:`, message);
    return NextResponse.json(
      { error: message, requestId },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    );
  }
}
