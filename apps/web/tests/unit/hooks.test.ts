/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useChunkIndex } from '@/hooks/useChunkIndex';

// Mock parser client
jest.mock('@/lib/parser-client', () => ({
  uploadFile: jest.fn(),
}));

import { uploadFile } from '@/lib/parser-client';

const mockedUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;

describe('useFileUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts with null state', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.file).toBeNull();
    expect(result.current.isUploading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('validates file size', async () => {
    const { result } = renderHook(() => useFileUpload());
    const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 100 * 1024 * 1024 });

    await act(async () => {
      await result.current.handleFileSelect(bigFile);
    });

    expect(result.current.error).toContain('too large');
    expect(result.current.file).toBeNull();
  });

  it('validates unsupported file type', async () => {
    const { result } = renderHook(() => useFileUpload());
    const badFile = new File(['x'], 'bad.exe', { type: 'application/octet-stream' });

    await act(async () => {
      await result.current.handleFileSelect(badFile);
    });

    expect(result.current.error).toContain('Unsupported');
  });

  it('uploads valid file successfully', async () => {
    const parseResult = {
      filename: 'test.md',
      content_type: 'text/markdown',
      markdown: '# Hello',
      metadata: {},
    };
    mockedUploadFile.mockResolvedValue(parseResult);

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['# Hello'], 'test.md', { type: 'text/markdown' });

    await act(async () => {
      await result.current.handleFileSelect(file);
    });

    expect(result.current.result).toEqual(parseResult);
    expect(result.current.file).toEqual(file);
    expect(result.current.error).toBeNull();
  });

  it('handles upload error', async () => {
    mockedUploadFile.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['x'], 'test.md', { type: 'text/markdown' });

    await act(async () => {
      await result.current.handleFileSelect(file);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.file).toBeNull();
  });

  it('clears state', async () => {
    mockedUploadFile.mockResolvedValue({
      filename: 'test.md',
      content_type: 'text/markdown',
      markdown: '# Hello',
      metadata: {},
    });

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['x'], 'test.md', { type: 'text/markdown' });

    await act(async () => {
      await result.current.handleFileSelect(file);
    });

    act(() => {
      result.current.clearFile();
    });

    expect(result.current.file).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles non-Error upload failure', async () => {
    mockedUploadFile.mockRejectedValue('network failure');

    const { result } = renderHook(() => useFileUpload());
    const file = new File(['x'], 'test.md', { type: 'text/markdown' });

    await act(async () => {
      await result.current.handleFileSelect(file);
    });

    expect(result.current.error).toBe('Upload failed');
  });
});

describe('useChunkIndex', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useChunkIndex());
    expect(result.current.chunks).toEqual([]);
    expect(result.current.search('test')).toEqual([]);
  });

  it('indexes markdown and returns chunks', () => {
    const { result } = renderHook(() => useChunkIndex());

    act(() => {
      result.current.indexMarkdown('# Title\n\nParagraph one.\n\nParagraph two.');
    });

    expect(result.current.chunks.length).toBeGreaterThan(0);
  });

  it('searches indexed chunks', () => {
    const { result } = renderHook(() => useChunkIndex());

    act(() => {
      result.current.indexMarkdown('# Annual Report\n\nRevenue was $10M.');
    });

    const searchResults = result.current.search('revenue');
    expect(searchResults.length).toBeGreaterThan(0);
  });

  it('clears index', () => {
    const { result } = renderHook(() => useChunkIndex());

    act(() => {
      result.current.indexMarkdown('# Hello');
    });
    expect(result.current.chunks.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearIndex();
    });
    expect(result.current.chunks).toEqual([]);
  });
});
