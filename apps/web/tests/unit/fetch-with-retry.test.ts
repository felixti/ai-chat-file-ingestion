/**
 * @jest-environment jsdom
 */

import { fetchWithRetry } from '@/lib/fetch-with-retry';

function createMockResponse(body: string, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

describe('fetchWithRetry', () => {
  let fetchMock: jest.Mock;
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    // Make setTimeout execute immediately in tests
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      if (typeof fn === 'function') fn();
      return 0 as unknown as NodeJS.Timeout;
    });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('returns successful response on first attempt', async () => {
    fetchMock.mockResolvedValue(createMockResponse('ok', 200));
    const fetchFn = fetchWithRetry({ retries: 2, baseDelayMs: 100, maxDelayMs: 500 });

    const response = await fetchFn('/test');
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses default options when called without arguments', async () => {
    fetchMock.mockResolvedValue(createMockResponse('ok', 200));
    const fetchFn = fetchWithRetry();

    const response = await fetchFn('/test');
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles non-Error thrown values', async () => {
    fetchMock.mockImplementation(() => {
      throw 'string error';
    });

    const fetchFn = fetchWithRetry({ retries: 0, baseDelayMs: 10, maxDelayMs: 50 });

    await expect(fetchFn('/test')).rejects.toThrow('string error');
  });

  it('retries on transient 5xx server errors and eventually returns', async () => {
    fetchMock
      .mockResolvedValueOnce(createMockResponse('error', 503))
      .mockResolvedValueOnce(createMockResponse('error', 502))
      .mockResolvedValue(createMockResponse('ok', 200));

    const fetchFn = fetchWithRetry({ retries: 2, baseDelayMs: 100, maxDelayMs: 500 });
    const response = await fetchFn('/test');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries on network errors and eventually throws', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));

    const fetchFn = fetchWithRetry({ retries: 2, baseDelayMs: 100, maxDelayMs: 500 });

    await expect(fetchFn('/test')).rejects.toThrow('Network failure');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-transient 5xx like 500', async () => {
    fetchMock.mockResolvedValue(createMockResponse('error', 500));

    const fetchFn = fetchWithRetry({ retries: 2, baseDelayMs: 100, maxDelayMs: 500 });
    const response = await fetchFn('/test');

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on AbortError', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    const fetchFn = fetchWithRetry({ retries: 2, baseDelayMs: 100, maxDelayMs: 500 });

    await expect(fetchFn('/test')).rejects.toThrow('Aborted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('respects maxDelayMs cap', async () => {
    fetchMock.mockRejectedValue(new Error('fail'));

    const fetchFn = fetchWithRetry({ retries: 3, baseDelayMs: 1000, maxDelayMs: 1500 });

    await expect(fetchFn('/test')).rejects.toThrow('fail');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
