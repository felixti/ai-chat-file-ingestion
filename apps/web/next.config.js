/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: ['bluefin.taild2f4.ts.net', 'localhost', '127.0.0.1'],
  async rewrites() {
    const parserUrl = process.env.PARSER_SERVICE_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/convert',
        destination: `${parserUrl}/convert`,
      },
    ];
  },
};

module.exports = nextConfig;
