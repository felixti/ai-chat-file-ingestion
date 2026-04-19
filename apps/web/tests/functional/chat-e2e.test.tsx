/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '@/components/ChatInterface';

function createMockResponse(body: string, status: number, contentType = 'text/plain') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', contentType]]),
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

// Mock transformers.js
jest.mock('@huggingface/transformers', () => ({
  pipeline: jest.fn(() =>
    Promise.resolve((texts: string | string[]) => {
      const inputs = Array.isArray(texts) ? texts : [texts];
      const results = inputs.map(() => ({
        data: new Float32Array([0.1, 0.2, 0.3]),
      }));
      return Array.isArray(texts) ? results : results[0];
    })
  ),
}));

// Mock useModels
jest.mock('@/hooks/useModels', () => ({
  useModels: () => ({
    models: ['gemma4:31b-cloud', 'qwen3.6:cloud', 'nemotron-3-super:cloud'],
    defaultModel: 'gemma4:31b-cloud',
    isLoading: false,
    error: null,
  }),
}));

// Mock ai/react useChat
const mockMessages: { id: string; role: 'user' | 'assistant'; content: string }[] = [];
let mockInput = '';
let mockIsLoading = false;

jest.mock('ai/react', () => ({
  useChat: ({ body }: any) => {
    const [messages, setMessages] = React.useState(mockMessages);
    const [input, setInput] = React.useState(mockInput);
    const [isLoading, setIsLoading] = React.useState(mockIsLoading);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    };

    const handleSubmit = (e?: React.FormEvent, options?: any) => {
      e?.preventDefault();
      if (!input.trim()) return;

      const system = options?.body?.system || body?.system || 'none';

      const userMessage = { id: String(Date.now()), role: 'user' as const, content: input };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      setTimeout(() => {
        const assistantMessage = {
          id: String(Date.now() + 1),
          role: 'assistant' as const,
          content: `Answer based on context: ${system?.slice(0, 200) || 'none'}`,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 100);

      setInput('');
    };

    return {
      messages,
      input,
      handleInputChange,
      handleSubmit,
      isLoading,
      error: null,
      setMessages,
    };
  },
}));

describe('ChatInterface E2E', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    mockMessages.length = 0;
    mockInput = '';
    mockIsLoading = false;
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uploads a file and asks a question', async () => {
    fetchMock.mockResolvedValue(
      createMockResponse(
        JSON.stringify({
          filename: 'report.md',
          content_type: 'text/markdown',
          markdown: '# Annual Report\n\nRevenue was $10M this year.\n\nThe company grew by 20%.',
          metadata: {},
        }),
        200,
        'application/json'
      )
    );

    render(<ChatInterface />);

    const dropzone = screen.getByRole('button', { name: /file upload/i });
    expect(dropzone).toBeInTheDocument();

    const file = new File(['# Annual Report'], 'report.md', { type: 'text/markdown' });
    await userEvent.upload(screen.getByLabelText(/file upload/i).querySelector('input')!, file);

    await waitFor(() => {
      expect(screen.getByText(/file loaded: report\.md/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/chat message/i);
    await userEvent.type(input, 'What was the revenue?');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/What was the revenue\?/i)).toBeInTheDocument();
    });
  });

  it('shows context indicator when file is loaded', async () => {
    fetchMock.mockResolvedValue(
      createMockResponse(
        JSON.stringify({
          filename: 'doc.txt',
          content_type: 'text/plain',
          markdown: 'Simple document content here.',
          metadata: {},
        }),
        200,
        'application/json'
      )
    );

    render(<ChatInterface />);

    const file = new File(['content'], 'doc.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText(/file upload/i).querySelector('input')!, file);

    await waitFor(() => {
      expect(screen.getByText(/Context: file loaded/i)).toBeInTheDocument();
    });
  });

  it('sends message without file context', async () => {
    render(<ChatInterface />);

    const input = screen.getByLabelText(/chat message/i);
    await userEvent.type(input, 'Hello without context');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/Hello without context/i)).toBeInTheDocument();
    });
  });

  it('clears file and chat when clear button is clicked', async () => {
    fetchMock.mockResolvedValue(
      createMockResponse(
        JSON.stringify({
          filename: 'doc.txt',
          content_type: 'text/plain',
          markdown: 'Simple document content here.',
          metadata: {},
        }),
        200,
        'application/json'
      )
    );

    render(<ChatInterface />);

    const file = new File(['content'], 'doc.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText(/file upload/i).querySelector('input')!, file);

    await waitFor(() => {
      expect(screen.getByText(/File loaded: doc\.txt/i)).toBeInTheDocument();
    });

    const clearButton = screen.getByText(/Clear file & chat/i);
    await userEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText(/File loaded: doc\.txt/i)).not.toBeInTheDocument();
    });
  });

  it('includes context chunks in the chat request body', async () => {
    fetchMock.mockResolvedValue(
      createMockResponse(
        JSON.stringify({
          filename: 'report.md',
          content_type: 'text/markdown',
          markdown:
            '# Annual Report\n\nRevenue was $10M this year.\n\nThe company grew by 20%.\n\nExpenses were $8M.',
          metadata: {},
        }),
        200,
        'application/json'
      )
    );

    render(<ChatInterface />);

    const file = new File(['# Annual Report'], 'report.md', { type: 'text/markdown' });
    await userEvent.upload(screen.getByLabelText(/file upload/i).querySelector('input')!, file);

    await waitFor(() => {
      expect(screen.getByText(/file loaded: report\.md/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/chat message/i);
    await userEvent.type(input, 'What was the revenue?');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(sendButton);

    await waitFor(() => {
      const assistantMessage = screen.getByText(/Answer based on context:/i);
      expect(assistantMessage).toBeInTheDocument();
      // The assistant message content includes the system message slice.
      // With context chunks present, the system message should contain chunk text.
      expect(assistantMessage.textContent).toContain('Revenue was');
    });
  });
});
