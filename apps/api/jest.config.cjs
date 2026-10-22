module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  cacheDirectory: '<rootDir>/../../.cache/jest-api',
  testMatch: ['**/test/**/*.spec.ts'],
  testPathIgnorePatterns: ['integration.spec.ts'],
};
