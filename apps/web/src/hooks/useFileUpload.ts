'use client';

import { useState, useCallback } from 'react';
import type { ParseResult } from '@/types';
import { uploadFile as uploadFileToParser } from '@/lib/parser-client';
import { MAX_FILE_SIZE, SUPPORTED_EXTENSIONS, SUPPORTED_MIME_TYPES } from '@shared/constants';

const SUPPORTED_TYPES = Object.values(SUPPORTED_MIME_TYPES);

export interface FileUploadReturn {
  file: File | null;
  isUploading: boolean;
  error: string | null;
  result: ParseResult | null;
  handleFileSelect: (file: File) => Promise<void>;
  clearFile: () => void;
}

export function useFileUpload(): FileUploadReturn {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 50MB.';
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return 'Unsupported file type. Supported: PDF, PPTX, DOCX, XLSX, MD, CSV, TXT, JSON, JSONC, JSONL.';
    }

    return null;
  }, []);

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setError(null);
      setResult(null);

      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setIsUploading(true);

      try {
        const parseResult = await uploadFileToParser(selectedFile);
        console.log('[useFileUpload] parse result:', {
          filename: parseResult.filename,
          contentType: parseResult.content_type,
          markdownLength: parseResult.markdown?.length ?? 0,
          markdownPreview: parseResult.markdown?.slice(0, 200) ?? 'EMPTY',
        });
        setResult(parseResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        setFile(null);
      } finally {
        setIsUploading(false);
      }
    },
    [validateFile]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    setIsUploading(false);
  }, []);

  return {
    file,
    isUploading,
    error,
    result,
    handleFileSelect,
    clearFile,
  };
}
