import { test, expect } from '@playwright/test';

test.describe('Chat Full Flow', () => {
  test('uploads PDF, parses, chunks, queries, and receives LLM response', async ({ page }) => {
    // Block embedding model downloads to force fast fallback (no semantic ranking)
    await page.route(/huggingface\.co|cdn\.jsdelivr\.net/, async (route) => {
      await route.abort('timedout');
    });

    // Mock parser service /api/convert
    await page.route('**/api/convert', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          filename: 'test-document.pdf',
          content_type: 'application/pdf',
          markdown:
            '# Annual Report\n\nRevenue was $10M this year.\n\nThe company grew by 20%.\n\nExpenses were $8M.',
          metadata: { title: 'Annual Report', pages: 3 },
        }),
      });
    });

    // Mock LLM /api/chat with a streaming response
    await page.route('**/api/chat', async (route) => {
      const body = [
        '0:"The"\n',
        '0:" revenue"\n',
        '0:" was"\n',
        '0:" $10M."\n',
        'd:{"finishReason":"stop"}\n',
      ].join('');
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: {
          'x-vercel-ai-data-stream': 'v1',
        },
        body,
      });
    });

    await page.goto('/');

    // Upload file via the hidden input
    const fileInput = page.locator('input#file-input');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock pdf content'),
    });

    // Wait for file to be parsed and loaded
    await expect(page.getByText(/File loaded: test-document\.pdf/i)).toBeVisible();
    await expect(page.getByText(/Context: file loaded/i)).toBeVisible();

    // Type a query
    const chatInput = page.getByLabel(/chat message/i);
    await chatInput.fill('What was the revenue?');

    // Submit
    const sendButton = page.getByRole('button', { name: /send/i });
    await sendButton.click();

    // Wait for user message to appear
    await expect(page.getByText(/What was the revenue\?/i)).toBeVisible();

    // Wait for assistant response with longer timeout
    await expect(page.getByText(/The revenue was \$10M/i)).toBeVisible({ timeout: 15000 });
  });
});
