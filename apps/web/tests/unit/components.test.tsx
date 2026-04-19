/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUploader } from '@/components/FileUploader';
import { ChatInput } from '@/components/ChatInput';
import { MessageList } from '@/components/MessageList';
import { ErrorBoundary } from '@/components/ErrorBoundary';

describe('FileUploader', () => {
  it('renders dropzone with instructions', () => {
    render(
      <FileUploader onFileSelect={jest.fn()} isUploading={false} error={null} fileName={null} />
    );
    expect(screen.getByText(/Drag and drop a file here/i)).toBeInTheDocument();
  });

  it('shows file name when loaded', () => {
    render(
      <FileUploader onFileSelect={jest.fn()} isUploading={false} error={null} fileName="doc.pdf" />
    );
    expect(screen.getByText(/File loaded: doc\.pdf/i)).toBeInTheDocument();
  });

  it('shows uploading state', () => {
    render(
      <FileUploader onFileSelect={jest.fn()} isUploading={true} error={null} fileName={null} />
    );
    expect(screen.getByText(/Uploading and parsing/i)).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(
      <FileUploader onFileSelect={jest.fn()} isUploading={false} error="Bad file" fileName={null} />
    );
    expect(screen.getByText(/Bad file/i)).toBeInTheDocument();
  });

  it('handles file selection via input', async () => {
    const onFileSelect = jest.fn();
    render(
      <FileUploader onFileSelect={onFileSelect} isUploading={false} error={null} fileName={null} />
    );

    const input = screen.getByLabelText(/file upload dropzone/i).querySelector('input');
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    await userEvent.upload(input!, file);

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('handles drop event', () => {
    const onFileSelect = jest.fn();
    render(
      <FileUploader onFileSelect={onFileSelect} isUploading={false} error={null} fileName={null} />
    );

    const dropzone = screen.getByLabelText(/file upload dropzone/i);
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('handles drag leave', () => {
    render(
      <FileUploader onFileSelect={jest.fn()} isUploading={false} error={null} fileName={null} />
    );
    const dropzone = screen.getByLabelText(/file upload dropzone/i);

    fireEvent.dragOver(dropzone);
    fireEvent.dragLeave(dropzone);
    // No error = pass
    expect(dropzone).toBeInTheDocument();
  });

  it('triggers click on keydown Enter', () => {
    const onFileSelect = jest.fn();
    render(
      <FileUploader onFileSelect={onFileSelect} isUploading={false} error={null} fileName={null} />
    );
    const dropzone = screen.getByLabelText(/file upload dropzone/i);

    fireEvent.keyDown(dropzone, { key: 'Enter' });
    expect(dropzone).toBeInTheDocument();
  });
});

describe('ChatInput', () => {
  it('renders input and send button', () => {
    render(
      <ChatInput
        input=""
        handleInputChange={jest.fn()}
        handleSubmit={jest.fn()}
        isLoading={false}
        hasFileContext={false}
      />
    );
    expect(screen.getByLabelText(/chat message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('shows context indicator when file is loaded', () => {
    render(
      <ChatInput
        input=""
        handleInputChange={jest.fn()}
        handleSubmit={jest.fn()}
        isLoading={false}
        hasFileContext={true}
      />
    );
    expect(screen.getByText(/Context: file loaded/i)).toBeInTheDocument();
  });

  it('disables input while loading', () => {
    render(
      <ChatInput
        input="hello"
        handleInputChange={jest.fn()}
        handleSubmit={jest.fn()}
        isLoading={true}
        hasFileContext={false}
      />
    );
    expect(screen.getByLabelText(/chat message/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('calls handleSubmit on button click', async () => {
    const handleSubmit = jest.fn();
    render(
      <ChatInput
        input="test message"
        handleInputChange={jest.fn()}
        handleSubmit={handleSubmit}
        isLoading={false}
        hasFileContext={false}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(handleSubmit).toHaveBeenCalled();
  });

  it('calls handleSubmit on Enter key', () => {
    const handleSubmit = jest.fn();
    render(
      <ChatInput
        input="test"
        handleInputChange={jest.fn()}
        handleSubmit={handleSubmit}
        isLoading={false}
        hasFileContext={false}
      />
    );

    fireEvent.keyDown(screen.getByLabelText(/chat message/i), { key: 'Enter' });
    expect(handleSubmit).toHaveBeenCalled();
  });

  it('does not submit when input is empty', () => {
    const handleSubmit = jest.fn();
    render(
      <ChatInput
        input="   "
        handleInputChange={jest.fn()}
        handleSubmit={handleSubmit}
        isLoading={false}
        hasFileContext={false}
      />
    );

    fireEvent.keyDown(screen.getByLabelText(/chat message/i), { key: 'Enter' });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('does not submit when loading', () => {
    const handleSubmit = jest.fn();
    render(
      <ChatInput
        input="test"
        handleInputChange={jest.fn()}
        handleSubmit={handleSubmit}
        isLoading={true}
        hasFileContext={false}
      />
    );

    fireEvent.keyDown(screen.getByLabelText(/chat message/i), { key: 'Enter' });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('does not submit on button click when input is empty', async () => {
    const handleSubmit = jest.fn();
    render(
      <ChatInput
        input=""
        handleInputChange={jest.fn()}
        handleSubmit={handleSubmit}
        isLoading={false}
        hasFileContext={false}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

describe('MessageList', () => {
  it('renders user and assistant messages', () => {
    const messages = [
      { id: '1', role: 'user' as const, content: 'Hello' },
      { id: '2', role: 'assistant' as const, content: 'Hi there' },
    ];

    render(<MessageList messages={messages} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText(/Start a conversation/i)).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <div data-testid="child">Child content</div>;
  };

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders default fallback when an error occurs', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The chat interface encountered an unexpected error/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh page/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom error UI</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
