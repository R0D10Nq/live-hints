/**
 * Jest конфигурация для Live Hints
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration'],
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.history/',
    '/tests/e2e/',
    'ui-controller.test.js',
    'session-manager.test.js',
    'audio-manager.test.js',
    'hint-manager.test.js',
    'llm-api.test.js',
  ],
  collectCoverageFrom: ['src/**/*.js', '!**/node_modules/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'text-summary'],
  verbose: true,
  testTimeout: 30000,
  moduleFileExtensions: ['js', 'json'],
  transformIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
