/**
 * Jest конфигурация для Live Hints
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration'],
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.history/', '/tests/e2e/'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  collectCoverageFrom: [
    'main/**/*.js',
    'renderer/**/*.js',
    'main.js',
    'preload.js',
    '!**/node_modules/**',
    '!renderer/onboarding/**',
    '!**/index.js',
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      lines: 85,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'text-summary'],
  verbose: true,
  testTimeout: 30000,
  moduleFileExtensions: ['js', 'json'],
  transformIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
