'use client';

import { useChat as useVercelChat } from 'ai/react';
import type { Message, ChatRequestOptions } from 'ai';
import { useCallback, useMemo } from 'react';

interface UseChatOptions {
  initialMessages?: Message[];
  contextChunks?: string[];
  model?: string;
}

export function useChat(options: UseChatOptions = {}) {
  const systemMessage = useMemo(
    () => buildSystemMessage(options.contextChunks),
    [options.contextChunks]
  );

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } =
    useVercelChat({
      api: '/api/chat',
      body: {
        system: systemMessage,
        model: options.model,
      },
      initialMessages: options.initialMessages,
    });

  const submitWithContext = useCallback(
    (e?: React.FormEvent<HTMLFormElement>, options?: ChatRequestOptions) => {
      console.log('[useChat] sending body:', options?.body);
      handleSubmit(e, options);
    },
    [handleSubmit]
  );

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit: submitWithContext,
    isLoading,
    error,
    setMessages,
  };
}

export function buildSystemMessage(chunks?: string[]): string {
  const base = 'You are a helpful assistant that answers questions based on the provided context.';
  if (!chunks || chunks.length === 0) return base;

  const context = chunks.map((c, i) => `[${i + 1}] ${c}`).join('\n\n');
  return `${base}\n\nUse the following context to answer:\n\n${context}`;
}
