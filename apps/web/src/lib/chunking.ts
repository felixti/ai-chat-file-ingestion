import { v4 as uuidv4 } from 'uuid';
import type { Chunk } from '@/types';

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP_TOKENS = 50;
const CHARS_PER_TOKEN = 4;

export function chunkText(text: string, options?: ChunkOptions): Chunk[] {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const chunks: Chunk[] = [];
  const paragraphs = splitIntoParagraphsWithPositions(text);

  let currentChunk = '';
  let currentChunkStart = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const { text: paragraph, start: paraStart } = paragraphs[i];

    if (currentChunk.length + paragraph.length + 2 <= maxChars) {
      if (!currentChunk) {
        currentChunkStart = paraStart;
      }
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(createChunk(currentChunk, currentChunkStart, text));
        currentChunk = '';
      }

      if (paragraph.length > maxChars) {
        const subChunks = splitLongParagraph(paragraph, maxChars, overlapChars);
        const effectiveOverlap = Math.min(overlapChars, maxChars - 1);
        let subStart = paraStart;
        for (let j = 0; j < subChunks.length; j++) {
          const sub = subChunks[j];
          chunks.push(createChunk(sub, subStart, text));
          subStart = subStart + sub.length - effectiveOverlap;
        }
        currentChunkStart = paraStart + paragraph.length;
      } else {
        currentChunk = paragraph;
        currentChunkStart = paraStart;
      }
    }
  }

  if (currentChunk) {
    chunks.push(createChunk(currentChunk, currentChunkStart, text));
  }

  return mergeSmallChunks(chunks, maxChars);
}

function splitIntoParagraphsWithPositions(text: string): Array<{ text: string; start: number }> {
  const regex = /\n\n+/g;
  const paragraphs: Array<{ text: string; start: number }> = [];
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const paragraph = text.slice(lastEnd, match.index).trim();
    if (paragraph.length > 0) {
      paragraphs.push({ text: paragraph, start: lastEnd });
    }
    lastEnd = match.index + match[0].length;
  }

  const lastParagraph = text.slice(lastEnd).trim();
  if (lastParagraph.length > 0) {
    paragraphs.push({ text: lastParagraph, start: lastEnd });
  }

  return paragraphs;
}

function splitLongParagraph(paragraph: string, maxChars: number, overlapChars: number): string[] {
  const parts: string[] = [];
  let start = 0;
  const effectiveOverlap = Math.min(overlapChars, maxChars - 1);

  while (start < paragraph.length) {
    let end = start + maxChars;
    if (end >= paragraph.length) {
      parts.push(paragraph.slice(start));
      break;
    }

    const sentenceEnd = findSentenceBoundary(paragraph, end);
    if (sentenceEnd > start && sentenceEnd - start <= maxChars) {
      end = sentenceEnd;
    }

    parts.push(paragraph.slice(start, end));
    // Ensure we always make forward progress (at least 1 character)
    start = Math.max(start + 1, end - effectiveOverlap);
  }

  return parts;
}

function findSentenceBoundary(text: string, aroundIndex: number): number {
  const searchRange = 200;
  const start = Math.max(0, aroundIndex - searchRange);
  const end = Math.min(text.length, aroundIndex + searchRange);
  const slice = text.slice(start, end);

  const sentenceEnds: number[] = [];
  const regex = /[.!?]\s+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(slice)) !== null) {
    sentenceEnds.push(start + match.index + match[0].length);
  }

  let closest = aroundIndex;
  let minDiff = Infinity;
  for (const pos of sentenceEnds) {
    const diff = Math.abs(pos - aroundIndex);
    if (diff < minDiff) {
      minDiff = diff;
      closest = pos;
    }
  }

  return closest;
}

function createChunk(text: string, startIndex: number, fullText: string): Chunk {
  const actualStart = Math.max(0, startIndex);
  const endIndex = Math.min(fullText.length, actualStart + text.length);
  return {
    id: uuidv4(),
    text: text.trim(),
    startIndex: actualStart,
    endIndex,
  };
}

function mergeSmallChunks(chunks: Chunk[], maxChars: number): Chunk[] {
  if (chunks.length <= 1) return chunks;

  const merged: Chunk[] = [];
  let current = chunks[0];

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i];
    if (current.text.length + next.text.length + 2 <= maxChars) {
      current = {
        id: current.id,
        text: current.text + '\n\n' + next.text,
        startIndex: current.startIndex,
        endIndex: next.endIndex,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}
