import { uploadFile } from '@/lib/parser-client';
import { chunkText } from '@/lib/chunking';
import { ChunkIndex } from '@/lib/minisearch-index';

jest.mock('@/lib/fetch-with-retry', () => ({
  fetchWithRetry: () => (input: RequestInfo | URL, init?: RequestInit) => global.fetch(input, init),
}));

function createMockResponse(body: string, status: number, contentType = 'text/plain') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', contentType]]),
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

describe('File Upload Flow', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads file, parses, chunks, and indexes', async () => {
    fetchMock.mockResolvedValue(
      createMockResponse(
        JSON.stringify({
          filename: 'test.md',
          content_type: 'text/markdown',
          markdown: '# Hello\n\nThis is a test document.\n\nIt has multiple paragraphs.',
          metadata: { title: 'Test' },
        }),
        200,
        'application/json'
      )
    );

    const file = new File(['dummy'], 'test.md', { type: 'text/markdown' });
    const result = await uploadFile(file);

    expect(result.filename).toBe('test.md');
    expect(result.markdown).toContain('# Hello');

    const chunks = chunkText(result.markdown);
    expect(chunks.length).toBeGreaterThan(0);

    const index = new ChunkIndex();
    index.addChunks(chunks);

    const searchResults = index.search('test');
    expect(searchResults.length).toBeGreaterThan(0);
  });

  it('handles parser service 413 error', async () => {
    fetchMock.mockResolvedValue(createMockResponse('Payload Too Large', 413));

    const file = new File(['dummy'], 'large.pdf', { type: 'application/pdf' });
    await expect(uploadFile(file)).rejects.toThrow('File too large');
  });

  it('handles parser service 415 error', async () => {
    fetchMock.mockResolvedValue(createMockResponse('Unsupported Media Type', 415));

    const file = new File(['dummy'], 'file.exe', { type: 'application/octet-stream' });
    await expect(uploadFile(file)).rejects.toThrow('Unsupported file type');
  });

  it('handles generic parser service error', async () => {
    fetchMock.mockResolvedValue(createMockResponse('Internal Server Error', 500));

    const file = new File(['dummy'], 'test.txt', { type: 'text/plain' });
    await expect(uploadFile(file)).rejects.toThrow('Parser service error (500)');
  });

  it('handles upload timeout', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    const file = new File(['dummy'], 'test.md', { type: 'text/markdown' });
    await expect(uploadFile(file)).rejects.toThrow('Upload timed out');
  });
});
