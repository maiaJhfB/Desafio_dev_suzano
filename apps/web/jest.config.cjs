const nextJest = require('next/jest');
const createConfig = nextJest({ dir: './' });
const config = createConfig({
  testEnvironment: 'jsdom',
  cacheDirectory: '<rootDir>/../../.cache/jest-web',
  setupFiles: ['<rootDir>/tests/polyfills.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testTimeout: 15000,
  testEnvironmentOptions: { customExportConditions: ['node', 'node-addons'] },
});
module.exports = async () => ({
  ...(await config()),
  transformIgnorePatterns: [
    'node_modules[\\\\/](?!\\.pnpm)(?!(msw|@mswjs|@open-draft|until-async|is-node-process|strict-event-emitter|rettime)[\\\\/])',
    'node_modules[\\\\/]\\.pnpm[\\\\/](?!(msw|@mswjs\\+|@open-draft\\+|until-async|is-node-process|strict-event-emitter|rettime))',
  ],
});
