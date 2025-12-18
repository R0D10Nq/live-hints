/**
 * Jest конфигурация для Live Hints
 */

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests/unit'],
    testMatch: ['**/*.test.js'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    verbose: true,
    testTimeout: 10000,
    moduleFileExtensions: ['js', 'json'],
    transformIgnorePatterns: [
        '/node_modules/'
    ]
};
