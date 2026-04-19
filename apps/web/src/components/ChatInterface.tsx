'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useChat, buildSystemMessage } from '@/hooks/useChat';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useChunkIndex } from '@/hooks/useChunkIndex';
import { useEmbeddings } from '@/hooks/useEmbeddings';
import { useModels } from '@/hooks/useModels';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { FileUploader } from './FileUploader';
import { ModelSelector } from './ModelSelector';

export function ChatInterface() {
  const { file, isUploading, error, result, handleFileSelect, clearFile } = useFileUpload();
  const { chunks, indexMarkdown, search, clearIndex } = useChunkIndex();
  const { rankBySimilarity, isLoading: embedLoading } = useEmbeddings();

  // Use refs to avoid stale closures in event handlers
  const chunksRef = useRef(chunks);
  const searchRef = useRef(search);
  const resultRef = useRef(result);

  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  const { models, defaultModel } = useModels();
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);

  // Sync default model once loaded
  useEffect(() => {
    if (defaultModel && !selectedModel) {
      setSelectedModel(defaultModel);
    }
  }, [defaultModel, selectedModel]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error: chatError, setMessages } = useChat({
    model: selectedModel,
  });

  useEffect(() => {
    console.log('[ChatInterface] result changed:', {
      hasResult: !!result,
      markdownLength: result?.markdown?.length ?? 0,
      markdownType: typeof result?.markdown,
      filename: result?.filename,
    });
    if (result && typeof result.markdown === 'string') {
      if (result.markdown.trim().length === 0) {
        console.warn('[ChatInterface] parser returned empty markdown — no chunks will be created');
      }
      indexMarkdown(result.markdown);
    } else if (result) {
      console.warn('[ChatInterface] result has no markdown field:', Object.keys(result));
    }
  }, [result, indexMarkdown]);

  useEffect(() => {
    console.log('[ChatInterface] chunks updated:', chunks.length);
  }, [chunks]);

  const handleSubmitWithPrefilter = useCallback(async (e?: React.FormEvent<HTMLFormElement>) => {
    const currentChunks = chunksRef.current;
    const currentSearch = searchRef.current;
    const currentResult = resultRef.current;

    console.log('[chat] handleSubmitWithPrefilter called, input:', input, 'chunks.length (ref):', currentChunks.length);
    e?.preventDefault();
    if (!input.trim()) {
      console.log('[chat] empty input, returning early');
      return;
    }

    let topChunks: string[] = [];

    if (currentChunks.length > 0) {
      console.log('[chat] searching chunks for query:', input);
      const searchResults = currentSearch(input);
      const top5Texts = searchResults.map((r) => r.text);
      console.log('[chat] search results:', searchResults.map((r) => ({ score: r.score, textPreview: r.text.slice(0, 120) })));

      if (top5Texts.length > 0) {
        console.log('[chat] ranking', top5Texts.length, 'chunks');
        const ranked = await rankBySimilarity(input, top5Texts);
        console.log('[chat] ranked chunks:', ranked.map((r) => ({ similarity: r.similarity, textPreview: r.text.slice(0, 120) })));
        topChunks = ranked.slice(0, 3).map((r) => r.text);
      } else {
        console.log('[chat] search returned no results');
      }
    } else if (currentResult?.markdown) {
      // Fallback: if chunks are empty but we have raw markdown, use it directly
      console.log('[chat] no chunks available, falling back to raw markdown');
      topChunks = [currentResult.markdown];
    } else {
      console.log('[chat] no chunks available (chunks.length === 0) and no raw markdown');
    }

    const systemMessage = buildSystemMessage(topChunks);
    console.log('[chat] chunks used:', topChunks.length);
    console.log('[chat] context/system message length:', systemMessage.length);
    console.log('[chat] context/system message:', systemMessage.slice(0, 500));
    console.log('[chat] user message:', input);

    handleSubmit(e, {
      body: {
        system: systemMessage,
      },
    });
  }, [input, handleSubmit, rankBySimilarity]);

  const hasFileContext = chunks.length > 0;

  return (
    <div className="flex flex-col h-screen max-h-screen">
      <header className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">AI Chat</h1>
          <ModelSelector
            models={models}
            selected={selectedModel}
            onChange={setSelectedModel}
            disabled={isLoading}
          />
        </div>
        {hasFileContext && (
          <button
            onClick={() => {
              clearFile();
              clearIndex();
              setMessages([]);
            }}
            className="text-sm text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2 py-1"
          >
            Clear file & chat
          </button>
        )}
      </header>

      <FileUploader
        onFileSelect={handleFileSelect}
        isUploading={isUploading}
        error={error}
        fileName={result?.filename ?? null}
      />

      {chunks.length > 0 && (
        <div className="px-4 py-1 text-xs text-green-600 bg-green-50">
          {chunks.length} chunk{chunks.length === 1 ? '' : 's'} indexed
        </div>
      )}

      {embedLoading && (
        <div className="px-4 py-1 text-xs text-blue-600 bg-blue-50">Computing embeddings...</div>
      )}

      {chatError && (
        <div className="mx-4 mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <strong>Chat error:</strong> {chatError.message}
        </div>
      )}

      <MessageList messages={messages} />

      <ChatInput
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmitWithPrefilter}
        isLoading={isLoading || embedLoading}
        hasFileContext={hasFileContext}
      />
    </div>
  );
}
