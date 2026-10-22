module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  cacheDirectory: '<rootDir>/../../.cache/jest-api-integration',
  testMatch: ['**/test/**/*.integration.spec.ts'],
  testTimeout: 30000,
};
