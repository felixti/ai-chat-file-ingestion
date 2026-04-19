import { NextResponse } from 'next/server';

const PARSER_URL = process.env.PARSER_SERVICE_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  const url = `${PARSER_URL}/convert`;

  // Clone headers and forward the request ID if present
  const headers = new Headers(request.headers);
  const requestId = headers.get('X-Request-ID') || crypto.randomUUID();
  headers.set('X-Request-ID', requestId);

  // Stream the request body directly to the parser service.
  // duplex: 'half' is required in Node.js 18+ to stream a Request body
  // while still being able to read the response.
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: request.body,
    // @ts-expect-error — duplex is a Node.js fetch extension required for streaming
    duplex: 'half',
  });

  // Forward the response back to the client
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
