import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { resetMockProducts } from '@/mocks/handlers';

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn(),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  server.resetHandlers();
  resetMockProducts();
});
afterAll(() => server.close());
