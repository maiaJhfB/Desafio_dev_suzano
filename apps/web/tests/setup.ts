import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { resetMockProducts } from '@/mocks/handlers';
import { clearAdminSession } from '@/lib/admin-session';

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: jest.fn(),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  clearAdminSession();
  localStorage.clear();
  server.resetHandlers();
  resetMockProducts();
});
afterAll(() => server.close());
