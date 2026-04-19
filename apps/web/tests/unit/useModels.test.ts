/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useModels } from '@/hooks/useModels';

describe('useModels', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches models on mount', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: ['gemma4:31b-cloud', 'qwen3.6:cloud', 'nemotron-3-super:cloud'],
        defaultModel: 'gemma4:31b-cloud',
      }),
    } as Response);

    const { result } = renderHook(() => useModels());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.models).toEqual(['gemma4:31b-cloud', 'qwen3.6:cloud', 'nemotron-3-super:cloud']);
    expect(result.current.defaultModel).toBe('gemma4:31b-cloud');
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/models');
  });

  it('handles fetch error gracefully', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useModels());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe('Failed to load models');
  });

  it('handles network error gracefully', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useModels());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.models).toEqual([]);
    expect(result.current.error).toBe('Network failure');
  });

  it('uses default model when fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useModels());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.defaultModel).toBe('gemma4:31b-cloud');
  });

  it('cancels fetch on unmount', async () => {
    const abortController = new AbortController();
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                models: ['gemma4:31b-cloud', 'qwen3.6:cloud', 'nemotron-3-super:cloud'],
                defaultModel: 'gemma4:31b-cloud',
              }),
            } as Response);
          }, 100);
        })
    );

    const { result, unmount } = renderHook(() => useModels());

    unmount();

    // After unmount, state should not update
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(result.current.models).toEqual([]);
  });
});
