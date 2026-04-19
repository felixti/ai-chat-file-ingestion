/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { useChat } from '@/hooks/useChat';

jest.mock('ai/react', () => ({
  useChat: jest.fn((opts: any) => ({
    messages: opts.initialMessages || [],
    input: '',
    handleInputChange: jest.fn(),
    handleSubmit: jest.fn(),
    isLoading: false,
    error: null,
    setMessages: jest.fn(),
  })),
}));

const mockUseVercelChat = require('ai/react').useChat;

describe('useChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses default config', () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('builds system message with context chunks', () => {
    renderHook(() => useChat({ contextChunks: ['Chunk A', 'Chunk B'] }));

    const callArg = mockUseVercelChat.mock.calls[0][0];
    expect(callArg.body.system).toContain('Chunk A');
    expect(callArg.body.system).toContain('Chunk B');
    expect(callArg.body.system).toContain('[1] Chunk A');
    expect(callArg.body.system).toContain('[2] Chunk B');
  });

  it('builds system message without chunks', () => {
    renderHook(() => useChat());

    const callArg = mockUseVercelChat.mock.calls[0][0];
    expect(callArg.body.system).toBe(
      'You are a helpful assistant that answers questions based on the provided context.'
    );
  });

  it('passes initial messages', () => {
    const initialMessages = [{ id: '1', role: 'user' as const, content: 'Hello' }];
    renderHook(() => useChat({ initialMessages }));

    const callArg = mockUseVercelChat.mock.calls[0][0];
    expect(callArg.initialMessages).toEqual(initialMessages);
  });

  it('forwards chat request options to handleSubmit', () => {
    const { result } = renderHook(() => useChat());

    const mockEvent = { preventDefault: jest.fn() } as unknown as React.FormEvent<HTMLFormElement>;
    const mockOptions = { body: { system: 'custom system' } };

    result.current.handleSubmit(mockEvent, mockOptions);

    const mockHandleSubmit = mockUseVercelChat.mock.results[0].value.handleSubmit;
    expect(mockHandleSubmit).toHaveBeenCalledWith(mockEvent, mockOptions);
  });

  it('does not send baseURL or apiKey to the server', () => {
    renderHook(() => useChat({ contextChunks: ['test'] }));

    const callArg = mockUseVercelChat.mock.calls[0][0];
    expect(callArg.body.baseURL).toBeUndefined();
    expect(callArg.body.apiKey).toBeUndefined();
  });

  it('passes model to the server when provided', () => {
    renderHook(() => useChat({ contextChunks: ['test'], model: 'gemma4:31b-cloud' }));

    const callArg = mockUseVercelChat.mock.calls[0][0];
    expect(callArg.body.model).toBe('gemma4:31b-cloud');
  });

  it('does not send model when not provided', () => {
    renderHook(() => useChat({ contextChunks: ['test'] }));

    const callArg = mockUseVercelChat.mock.calls[0][0];
    expect(callArg.body.model).toBeUndefined();
  });
});
