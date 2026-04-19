import { chunkText } from '@/lib/chunking';

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    const result = chunkText('');
    expect(result).toEqual([]);
  });

  it('creates a single chunk for short text', () => {
    const text = 'Hello world';
    const result = chunkText(text);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hello world');
    expect(result[0].startIndex).toBe(0);
    expect(result[0].endIndex).toBe(text.length);
  });

  it('splits on paragraph boundaries', () => {
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.';
    const result = chunkText(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].text).toContain('Paragraph one');
  });

  it('respects max token limit', () => {
    const longText = 'word '.repeat(200);
    const result = chunkText(longText, { maxTokens: 50 });
    const maxChars = 50 * 4;
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(maxChars + 50);
    }
  });

  it('preserves markdown structure in chunks', () => {
    const markdown = '# Heading\n\nSome body text here.\n\n## Subheading\n\nMore text.';
    const result = chunkText(markdown);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const combined = result.map((c) => c.text).join('\n\n');
    expect(combined).toContain('# Heading');
    expect(combined).toContain('## Subheading');
  });

  it('generates unique ids for chunks', () => {
    const text = 'a\n\nb\n\nc\n\nd';
    const result = chunkText(text);
    const ids = new Set(result.map((c) => c.id));
    expect(ids.size).toBe(result.length);
  });

  it('has correct start and end indices', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const result = chunkText(text);
    expect(result[0].startIndex).toBe(0);
    expect(result[0].endIndex).toBeGreaterThan(0);
    expect(result[0].endIndex).toBeLessThanOrEqual(text.length);
  });

  it('handles overlap option', () => {
    const longText = 'word '.repeat(200);
    const result = chunkText(longText, { maxTokens: 30, overlapTokens: 5 });
    expect(result.length).toBeGreaterThan(1);
  });

  it('handles single paragraph longer than maxChars', () => {
    const singleParagraph = 'a'.repeat(800);
    const result = chunkText(singleParagraph, { maxTokens: 50 });
    expect(result.length).toBeGreaterThan(1);
  });

  it('trims whitespace from chunks', () => {
    const text = '  hello world  ';
    const result = chunkText(text);
    expect(result[0].text).toBe('hello world');
  });

  it('handles paragraph that fits after flushing current chunk', () => {
    const text = 'short\n\n' + 'x'.repeat(600);
    const result = chunkText(text, { maxTokens: 50 });
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('handles sentence boundary detection', () => {
    const text = 'First sentence. Second sentence. Third sentence here.';
    const result = chunkText(text, { maxTokens: 10 });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('handles text with no sentence boundaries', () => {
    const text = 'word '.repeat(100);
    const result = chunkText(text, { maxTokens: 20 });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('merges small chunks when possible', () => {
    const text = 'a\n\nb\n\nc\n\nd';
    const result = chunkText(text, { maxTokens: 512 });
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('returns single chunk for one paragraph under limit', () => {
    const text = 'Only one paragraph here.';
    const result = chunkText(text);
    expect(result).toHaveLength(1);
  });

  it('handles paragraph that does not fit but is under maxChars', () => {
    // First paragraph fills most of the chunk, second paragraph is short but doesn't fit
    const text = 'a'.repeat(1800) + '\n\n' + 'b'.repeat(300);
    const result = chunkText(text, { maxTokens: 512 });
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('handles multiple short paragraphs that merge', () => {
    const text = 'a\n\nb\n\nc\n\nd\n\ne';
    const result = chunkText(text, { maxTokens: 512 });
    expect(result.length).toBe(1);
    expect(result[0].text).toContain('a');
    expect(result[0].text).toContain('e');
  });

  it('does not merge chunks that exceed maxChars', () => {
    const p1 = 'a'.repeat(1100);
    const p2 = 'b'.repeat(1100);
    const text = p1 + '\n\n' + p2;
    const result = chunkText(text, { maxTokens: 512 });
    expect(result.length).toBe(2);
  });

  it('handles overlap larger than maxChars gracefully', () => {
    // Use non-periodic text so indexOf finds correct positions
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const result = chunkText(text, { maxTokens: 10, overlapTokens: 20 });
    expect(result.length).toBeGreaterThan(1);
    // Ensure forward progress by checking start indices are strictly increasing
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startIndex).toBeGreaterThan(result[i - 1].startIndex);
    }
  });
});
