import React from 'react';
import '@testing-library/jest-dom';

// Mock react-markdown (ESM-only package)
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: string }) {
    return React.createElement('div', null, children);
  };
});

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
    };
  },
  usePathname() {
    return '';
  },
}));
