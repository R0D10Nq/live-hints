/**
 * Playwright конфигурация для E2E тестов Electron
 */

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { open: 'never' }]
    ],
    use: {
        actionTimeout: 10000,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    }
});
