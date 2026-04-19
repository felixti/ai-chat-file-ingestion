/**
 * Shared constants used by both frontend and backend.
 * Keep in sync with backend Python constants where applicable.
 */

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const SUPPORTED_EXTENSIONS: readonly string[] = [
  '.pdf',
  '.pptx',
  '.docx',
  '.xlsx',
  '.md',
  '.csv',
  '.txt',
  '.json',
  '.jsonc',
  '.jsonl',
];

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const SUPPORTED_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  md: 'text/markdown',
  csv: 'text/csv',
  txt: 'text/plain',
  json: 'application/json',
  jsonc: 'application/json',
  jsonl: 'application/jsonlines',
};

export const API_ROUTES = {
  CHAT: '/api/chat',
  CONVERT: '/api/convert',
} as const;
