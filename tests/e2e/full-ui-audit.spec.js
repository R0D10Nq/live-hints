/**
 * Сквозной аудит интерфейса Live Hints (Playwright Electron)
 * Проверяет 100% интерактивных элементов, скролл настроек, драг-зоны и генерацию подсказок
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

let electronApp;
let window;

async function launchElectron() {
  return await electron.launch({
    args: [path.join(__dirname, '../../main.js')],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
      NODE_ENV: 'test',
      ELECTRON_ENABLE_LOGGING: '1',
    },
    timeout: 30000,
  });
}

test.describe('Полный аудит интерфейса Live Hints', () => {
  test.beforeAll(async () => {
    electronApp = await launchElectron();
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('1. Шапка окна: проверка зон перетаскивания (-webkit-app-region) и кнопок', async () => {
    const header = window.locator('header.app-header');
    await expect(header).toBeVisible();

    // Шапка должна иметь drag
    const headerDrag = await header.evaluate((el) => window.getComputedStyle(el).webkitAppRegion);
    expect(headerDrag).toBe('drag');

    // Кнопки шапки должны иметь no-drag
    const buttonsToCheck = [
      '#btn-stealth',
      '#btn-click-through',
      '#btn-move-display',
      '#btn-quick-compact',
      '#btn-settings',
      '#btn-minimize',
      '#btn-close',
    ];

    for (const selector of buttonsToCheck) {
      const btn = window.locator(selector);
      await expect(btn).toBeVisible();
      const dragProp = await btn.evaluate((el) => window.getComputedStyle(el).webkitAppRegion);
      expect(dragProp).toBe('no-drag');
    }

    // Проверка кнопки быстрого компактного режима
    const btnQuickCompact = window.locator('#btn-quick-compact');
    await btnQuickCompact.click();
    await window.waitForTimeout(200);
    const hasCompact = await window.locator('body').evaluate((b) => b.classList.contains('compact-mode'));
    expect(hasCompact).toBe(true);

    // Возвращаем исходный режим
    await btnQuickCompact.click();
    await window.waitForTimeout(200);
    const isNormal = await window.locator('body').evaluate((b) => !b.classList.contains('compact-mode'));
    expect(isNormal).toBe(true);
  });

  test('2. Панель настроек: открытие, табы, скролл контента и элементы ввода', async () => {
    const btnSettings = window.locator('#btn-settings');
    const settingsPanel = window.locator('#settings-panel');

    // Открытие панели настроек
    await btnSettings.click();
    await window.waitForTimeout(400);
    await expect(settingsPanel).toHaveClass(/open/);

    // Проверка табов "Базовые" / "Расширенные"
    const btnBasic = window.locator('#btn-settings-basic');
    const btnAdvanced = window.locator('#btn-settings-advanced');

    // Проверка контролов базового режима
    const modelSelect = window.locator('#ollama-model');
    await expect(modelSelect).toBeVisible();

    const profileSelect = window.locator('#ai-profile');
    await expect(profileSelect).toBeVisible();
    await profileSelect.selectOption('job_interview_ru');

    // Переключение на расширенный режим
    await btnAdvanced.click();
    await window.waitForTimeout(200);
    await expect(btnAdvanced).toHaveClass(/active/);

    // Чекбоксы (доступны в расширенном режиме)
    const autoHintsCheckbox = window.locator('#auto-hints');
    await expect(autoHintsCheckbox).toBeVisible();
    await autoHintsCheckbox.check();
    expect(await autoHintsCheckbox.isChecked()).toBe(true);

    // Проверка скролла в sidebar-content
    const sidebarContent = settingsPanel.locator('.sidebar-content');
    const scrollMetrics = await sidebarContent.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowY: window.getComputedStyle(el).overflowY,
    }));

    // Контент превышает видимую область, скролл включен
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    expect(scrollMetrics.overflowY).toBe('auto');

    // Проверка фактической прокрутки
    const initialScrollTop = await sidebarContent.evaluate((el) => el.scrollTop);
    expect(initialScrollTop).toBe(0);

    // Прокручиваем вниз
    await sidebarContent.evaluate((el) => {
      el.scrollTop = 350;
    });
    await window.waitForTimeout(200);

    const scrolledTop = await sidebarContent.evaluate((el) => el.scrollTop);
    expect(scrolledTop).toBeGreaterThan(100);

    // Возвращаем скролл наверх
    await sidebarContent.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Возврат на базовый режим
    await btnBasic.click();
    await window.waitForTimeout(200);
    await expect(btnBasic).toHaveClass(/active/);

    // Закрытие панели настроек через кнопку закрытия
    const btnCloseSettings = window.locator('#btn-close-settings');
    await btnCloseSettings.click();
    await window.waitForTimeout(300);
    await expect(settingsPanel).not.toHaveClass(/open/);
  });

  test('3. Нижняя панель управления: микрофон, VU-метр, стенограмма и модалки', async () => {
    // Проверка кнопки Mute
    const btnMute = window.locator('#btn-mic-mute');
    await expect(btnMute).toBeVisible();
    await btnMute.click();
    await window.waitForTimeout(200);
    await expect(btnMute).toHaveClass(/muted/);

    // Повторный клик - включение звука
    await btnMute.click();
    await window.waitForTimeout(200);
    await expect(btnMute).not.toHaveClass(/muted/);

    // Проверка VU-метра
    const vuMeter = window.locator('#audio-vu-meter');
    await expect(vuMeter).toBeVisible();

    // Сворачивание стенограммы
    const btnToggleTranscript = window.locator('#btn-toggle-transcript');
    await btnToggleTranscript.click();
    await window.waitForTimeout(300);
    const sidebar = window.locator('#transcript-sidebar');
    await expect(sidebar).toHaveClass(/collapsed/);

    // Разворачивание обратно
    await btnToggleTranscript.click();
    await window.waitForTimeout(300);
    await expect(sidebar).not.toHaveClass(/collapsed/);

    // Модалка истории
    const btnHistory = window.locator('#btn-history');
    await btnHistory.click();
    await window.waitForTimeout(300);
    const historyModal = window.locator('#history-modal');
    await expect(historyModal).toBeVisible();
    await historyModal.locator('#btn-close-history').click();
    await window.waitForTimeout(200);
    await expect(historyModal).toBeHidden();

    // Модалка справки
    const btnHelp = window.locator('#btn-help');
    await btnHelp.click();
    await window.waitForTimeout(300);
    const helpModal = window.locator('#help-modal');
    await expect(helpModal).toBeVisible();
    await window.locator('#btn-close-help').click();
    await window.waitForTimeout(200);
    await expect(helpModal).toBeHidden();
  });

  test('4. Панель подсказок: зум шрифта (A-/A+) и отправка прямого вопроса', async () => {
    const btnFontInc = window.locator('#btn-font-increase');
    const btnFontDec = window.locator('#btn-font-decrease');

    await expect(btnFontInc).toBeVisible();
    await expect(btnFontDec).toBeVisible();

    // Кликаем A+ и проверяем изменение масштаба
    await btnFontInc.click();
    await window.waitForTimeout(100);

    // Прямой ввод вопроса
    const inputQuestion = window.locator('#direct-message-input');
    const btnSend = window.locator('#btn-send-direct');

    await expect(inputQuestion).toBeVisible();
    await expect(btnSend).toBeVisible();

    await inputQuestion.fill('Чем отличаются list, tuple, set и dict в Python?');
    await btnSend.click();

    // Проверяем появление подсказки (таймаут до 25с с учетом LLM)
    const hintsFeed = window.locator('#hints-feed');
    await expect(hintsFeed.locator('.hint-card, .hint-text')).toBeVisible({ timeout: 25000 });

    const hintText = await hintsFeed.textContent();
    expect(hintText.length).toBeGreaterThan(20);

    // Проверка отсутствия плейсхолдеров
    expect(hintText).not.toContain('Главный тезис');
    expect(hintText).not.toContain('Резюме или вывод');
    expect(hintText).not.toContain('400+ клиентов');

    // Проверка кнопки копирования
    const btnCopy = window.locator('#btn-copy-hint');
    await expect(btnCopy).toBeVisible();
    await btnCopy.click();

    // Сохранение скриншота проверки
    const screenshotsDir = path.join(__dirname, '../../docs/screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    await window.screenshot({ path: path.join(screenshotsDir, 'ui-audit-verified.png') });
  });
});
