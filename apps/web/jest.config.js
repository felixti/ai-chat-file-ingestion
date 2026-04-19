/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/app/**/*.{ts,tsx}'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/e2e/'],
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|rettime|@open-draft|outvariant|strict-event-emitter|react-markdown|devlop|bail|is-plain-obj|trim-lines|unist-.+|vfile|markdown-table|mdast-.+|micromark|decode-named-character-reference|character-entities|property-information|hast-util-.+|comma-separated-tokens|space-separated-tokens|remark-.+|unified)/)',
  ],
};

module.exports = config;
