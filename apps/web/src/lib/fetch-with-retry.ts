export interface FetchWithRetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<FetchWithRetryOptions> = {
  retries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }
  return true;
}

export function fetchWithRetry(
  options: FetchWithRetryOptions = {}
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const { retries, baseDelayMs, maxDelayMs } = { ...DEFAULT_OPTIONS, ...options };

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(input, init);
        // Retry on transient 5xx server errors only (502, 503, 504)
        if (
          response.status >= 500 &&
          response.status < 600 &&
          attempt < retries &&
          [502, 503, 504].includes(response.status)
        ) {
          throw new Error(`Server error ${response.status}`);
        }
        return response;
      } catch (error) {
        if (!isRetryableError(error)) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= retries) {
          break;
        }
        const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
        await sleep(delay);
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  };
}
