/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: ['bluefin.taild2f4.ts.net', 'localhost', '127.0.0.1'],
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
