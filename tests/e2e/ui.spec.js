/**
 * E2E Tests for Live Hints - Redesigned UI
 * Tests main application functionality
 */

import { test, expect } from '@playwright/test';

const APP_URL = 'file://' + __dirname + '/../../renderer/index.html';

test.describe('Live Hints Main UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('#app');
  });

  test('should render main layout', async ({ page }) => {
    // Header
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.logo-text')).toContainText('Live Hints');

    // Sidebar
    await expect(page.locator('#transcript-sidebar')).toBeVisible();

    // Content area
    await expect(page.locator('.content-area')).toBeVisible();

    // Control bar
    await expect(page.locator('.control-bar')).toBeVisible();
  });

  test('should toggle recording state', async ({ page }) => {
    const toggleBtn = page.locator('#btn-toggle');
    
    // Initial state
    await expect(toggleBtn).toContainText('Старт');
    await expect(page.locator('#status-indicator')).toHaveClass(/idle/);

    // Start recording
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Стоп');
    await expect(page.locator('#status-indicator')).toHaveClass(/recording/);

    // Stop recording
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Старт');
    await expect(page.locator('#status-indicator')).toHaveClass(/idle/);
  });

  test('should toggle sidebar', async ({ page }) => {
    const sidebar = page.locator('#transcript-sidebar');
    const toggleBtn = page.locator('#btn-toggle-sidebar');

    // Sidebar visible initially
    await expect(sidebar).toBeVisible();

    // Toggle off
    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/collapsed/);

    // Toggle on
    await toggleBtn.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('should open settings panel', async ({ page }) => {
    const settingsBtn = page.locator('#btn-settings');
    const settingsPanel = page.locator('#settings-panel');

    await expect(settingsPanel).not.toHaveClass(/open/);

    await settingsBtn.click();
    await expect(settingsPanel).toHaveClass(/open/);

    // Close
    await page.locator('#btn-close-settings').click();
    await expect(settingsPanel).not.toHaveClass(/open/);
  });

  test('should change theme', async ({ page }) => {
    const settingsBtn = page.locator('#btn-settings');
    await settingsBtn.click();

    const themeSelect = page.locator('#theme-select');
    await themeSelect.selectOption('midnight');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
  });

  test('should add transcript entries', async ({ page }) => {
    // Simulate adding transcript via IPC
    await page.evaluate(() => {
      window.liveHintsApp.ui.transcripts.addEntry('Test transcript entry');
    });

    const transcriptFeed = page.locator('#transcript-feed');
    await expect(transcriptFeed).toContainText('Test transcript entry');
  });

  test('should display hints with pagination', async ({ page }) => {
    // Add hints via state
    await page.evaluate(() => {
      window.liveHintsApp.ui.state.addHint({
        text: 'First hint',
        timestamp: Date.now(),
        type: 'technical',
        confidence: 'high'
      });
      window.liveHintsApp.ui.state.addHint({
        text: 'Second hint',
        timestamp: Date.now(),
        type: 'general',
        confidence: 'medium'
      });
    });

    // Check counter
    await expect(page.locator('#hints-counter')).toContainText('2 / 2');

    // Navigate
    await page.locator('#btn-prev-hint').click();
    await expect(page.locator('#hints-counter')).toContainText('1 / 2');

    await page.locator('#btn-next-hint').click();
    await expect(page.locator('#hints-counter')).toContainText('2 / 2');
  });

  test('should show toast notifications', async ({ page }) => {
    await page.evaluate(() => {
      window.liveHintsApp.ui.showToast('Test message', 'success');
    });

    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Test message');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Ctrl + , opens settings
    await page.keyboard.press('Control+,');
    await expect(page.locator('#settings-panel')).toHaveClass(/open/);

    // Escape closes settings
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-panel')).not.toHaveClass(/open/);
  });

  test('should update status indicator', async ({ page }) => {
    const statusIndicator = page.locator('#status-indicator');

    await page.evaluate(() => {
      window.liveHintsApp.ui.state.setStatus('processing');
    });

    await expect(statusIndicator).toHaveClass(/processing/);
    await expect(statusIndicator).toContainText('Обработка');
  });
});

test.describe('Live Hints Onboarding', () => {
  const ONBOARDING_URL = 'file://' + __dirname + '/../../renderer/onboarding.html';

  test.beforeEach(async ({ page }) => {
    await page.goto(ONBOARDING_URL);
    await page.waitForSelector('#onboarding-app');
  });

  test('should render onboarding steps', async ({ page }) => {
    await expect(page.locator('.step-content[data-step="1"]')).toHaveClass(/active/);
    await expect(page.locator('.step-title')).toContainText('сценарий');
  });

  test('should navigate through steps', async ({ page }) => {
    // Step 1 -> Step 2
    await page.locator('#btn-next').click();
    await expect(page.locator('.step-content[data-step="2"]')).toHaveClass(/active/);

    // Step 2 -> Step 3
    await page.locator('#btn-next').click();
    await expect(page.locator('.step-content[data-step="3"]')).toHaveClass(/active/);

    // Go back
    await page.locator('#btn-back').click();
    await expect(page.locator('.step-content[data-step="2"]')).toHaveClass(/active/);
  });

  test('should select mode', async ({ page }) => {
    const modeCard = page.locator('[data-mode="business_meeting"]');
    await modeCard.click();

    await expect(modeCard).toHaveClass(/selected/);
  });

  test('should show finish button on last step', async ({ page }) => {
    // Navigate to step 4
    await page.locator('#btn-next').click();
    await page.locator('#btn-next').click();
    await page.locator('#btn-next').click();

    await expect(page.locator('#btn-finish')).toBeVisible();
    await expect(page.locator('#btn-next')).toBeHidden();
  });

  test('should handle file upload zone', async ({ page }) => {
    await page.locator('#btn-next').click(); // Go to step 2

    const uploadZone = page.locator('#resume-upload');
    await expect(uploadZone).toBeVisible();

    // Drag and drop
    await uploadZone.dispatchEvent('dragover');
    await expect(uploadZone).toHaveClass(/dragover/);

    await uploadZone.dispatchEvent('dragleave');
    await expect(uploadZone).not.toHaveClass(/dragover/);
  });

  test('should toggle text area', async ({ page }) => {
    await page.locator('#btn-next').click(); // Go to step 2

    const textArea = page.locator('#resume-text-area');
    await expect(textArea).toHaveClass(/hidden/);

    await page.locator('#toggle-resume-text').click();
    await expect(textArea).not.toHaveClass(/hidden/);
  });
});
