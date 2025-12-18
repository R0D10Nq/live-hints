/**
 * Playwright конфигурация для E2E тестов Electron
 * 
 * ВАЖНО: E2E тесты для Electron требуют запущенный дисплей.
 * На CI без дисплея используйте: xvfb-run npx playwright test
 * На Windows локально: npx playwright test
 */

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js',
    timeout: 60000,
    expect: {
        timeout: 10000
    },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { open: 'never' }]
    ],
    use: {
        actionTimeout: 15000,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    }
});
