import { v4 as uuidv4 } from 'uuid';
import type { ParseResult } from '@/types';
import { fetchWithRetry } from './fetch-with-retry';
import { API_ROUTES } from '@shared/constants';

const PARSER_URL = API_ROUTES.CONVERT;
const UPLOAD_TIMEOUT_MS = 120_000;

const fetchWithRetryFn = fetchWithRetry({ retries: 3, baseDelayMs: 1000, maxDelayMs: 5000 });

function getRequestId(): string {
  return uuidv4();
}

export async function uploadFile(file: File): Promise<ParseResult> {
  const formData = new FormData();
  formData.append('file', file);

  const requestId = getRequestId();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetchWithRetryFn(PARSER_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        'X-Request-ID': requestId,
      },
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('File too large. Maximum size is 50MB.');
      }
      if (response.status === 415) {
        throw new Error('Unsupported file type.');
      }
      const body = await response.text();
      throw new Error(`Parser service error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as ParseResult;
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Upload timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
