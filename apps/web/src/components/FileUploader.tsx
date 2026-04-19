'use client';

import React, { useCallback, useRef, useState } from 'react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  error: string | null;
  fileName: string | null;
}

export function FileUploader({ onFileSelect, isUploading, error, fileName }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div className="p-4 border-b border-gray-200">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        role="button"
        tabIndex={0}
        aria-label="File upload dropzone"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          onChange={handleChange}
          className="hidden"
          accept=".pdf,.pptx,.docx,.xlsx,.md,.csv,.txt,.json,.jsonc,.jsonl"
        />
        {isUploading ? (
          <p className="text-blue-600 font-medium">Uploading and parsing...</p>
        ) : fileName ? (
          <div>
            <p className="text-green-600 font-medium">File loaded: {fileName}</p>
            <p className="text-sm text-gray-500 mt-1">Click or drop to replace</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-700 font-medium">
              Drag and drop a file here, or click to select
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Supported: PDF, PPTX, DOCX, XLSX, MD, CSV, TXT, JSON, JSONC, JSONL (max 50MB)
            </p>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
