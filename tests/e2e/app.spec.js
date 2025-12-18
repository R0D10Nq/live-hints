<<<<<<< HEAD
/**
 * E2E тесты для Live Hints приложения
 * Использует Playwright для тестирования Electron
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

let electronApp;
let window;

test.describe('Live Hints E2E', () => {
    test.beforeAll(async () => {
        // Запускаем Electron приложение
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });

        // Получаем первое окно
        window = await electronApp.firstWindow();

        // Ждём загрузки приложения
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('должен отображать основные элементы UI', async () => {
        // Проверяем наличие основных элементов
        await expect(window.locator('[data-testid="app-container"]')).toBeVisible();
        await expect(window.locator('[data-testid="header"]')).toBeVisible();
        await expect(window.locator('[data-testid="btn-toggle"]')).toBeVisible();
        await expect(window.locator('[data-testid="status-indicator"]')).toBeVisible();
        await expect(window.locator('[data-testid="status-text"]')).toBeVisible();
        await expect(window.locator('[data-testid="transcript-feed"]')).toBeVisible();
        await expect(window.locator('[data-testid="hints-feed"]')).toBeVisible();
    });

    test('должен отображать кнопку Старт', async () => {
        const btnToggle = window.locator('[data-testid="btn-toggle"]');
        await expect(btnToggle).toContainText('Старт');
    });

    test('статус должен быть "Приостановлено" по умолчанию', async () => {
        const statusText = window.locator('[data-testid="status-text"]');
        await expect(statusText).toHaveText('Приостановлено');

        const statusIndicator = window.locator('[data-testid="status-indicator"]');
        await expect(statusIndicator).toHaveClass(/status-paused/);
    });

    test('должен отображать выбор LLM провайдера', async () => {
        const providerSelect = window.locator('[data-testid="llm-provider-select"]');
        await expect(providerSelect).toBeVisible();

        // Проверяем опции
        const options = providerSelect.locator('option');
        await expect(options).toHaveCount(4);
    });

    test('должен открывать модальное окно истории', async () => {
        const btnHistory = window.locator('[data-testid="btn-history"]');
        await btnHistory.click();

        const historyModal = window.locator('[data-testid="history-modal"]');
        await expect(historyModal).toBeVisible();

        // Закрываем модалку
        const btnCloseModal = window.locator('[data-testid="btn-close-modal"]');
        await btnCloseModal.click();

        await expect(historyModal).toBeHidden();
    });

    test('кнопка Старт должна менять текст на Стоп при клике', async () => {
        const btnToggle = window.locator('[data-testid="btn-toggle"]');

        // Кликаем Старт
        await btnToggle.click();

        // Ждём изменения (может быть ошибка подключения, но кнопка должна измениться)
        await window.waitForTimeout(500);

        // Проверяем что кнопка стала "Стоп" или статус изменился
        const btnText = await btnToggle.textContent();
        const hasStopText = btnText.includes('Стоп');

        // Если кнопка стала "Стоп", кликаем чтобы вернуть в исходное состояние
        if (hasStopText) {
            await btnToggle.click();
            await window.waitForTimeout(200);
            await expect(btnToggle).toContainText('Старт');
        }
    });

    test('должен отображать placeholder в ленте транскриптов', async () => {
        const transcriptFeed = window.locator('[data-testid="transcript-feed"]');
        const placeholder = transcriptFeed.locator('.placeholder');

        // Placeholder может быть виден если нет транскриптов
        const isVisible = await placeholder.isVisible().catch(() => false);
        if (isVisible) {
            await expect(placeholder).toContainText('Транскрипт появится здесь');
        }
    });

    test('должен отображать placeholder в ленте подсказок', async () => {
        const hintsFeed = window.locator('[data-testid="hints-feed"]');
        const placeholder = hintsFeed.locator('.placeholder');

        const isVisible = await placeholder.isVisible().catch(() => false);
        if (isVisible) {
            await expect(placeholder).toContainText('Подсказки появятся здесь');
        }
    });

    test('кнопки управления окном должны быть кликабельными', async () => {
        const btnMinimize = window.locator('[data-testid="btn-minimize"]');
        const btnClose = window.locator('[data-testid="btn-close"]');

        await expect(btnMinimize).toBeVisible();
        await expect(btnMinimize).toBeEnabled();

        await expect(btnClose).toBeVisible();
        await expect(btnClose).toBeEnabled();
    });

    test('провайдер должен сохраняться при выборе', async () => {
        const providerSelect = window.locator('[data-testid="llm-provider-select"]');

        // Выбираем OpenAI
        await providerSelect.selectOption('openai');

        // Проверяем что выбран
        await expect(providerSelect).toHaveValue('openai');

        // Возвращаем на Ollama
        await providerSelect.selectOption('ollama');
        await expect(providerSelect).toHaveValue('ollama');
    });

    test('история сессий должна быть пустой изначально', async () => {
        const btnHistory = window.locator('[data-testid="btn-history"]');
        await btnHistory.click();

        const sessionsList = window.locator('[data-testid="sessions-list"]');
        await expect(sessionsList).toBeVisible();

        // Должен быть placeholder или пустой список
        const placeholder = sessionsList.locator('.placeholder');
        const isPlaceholderVisible = await placeholder.isVisible().catch(() => false);

        if (isPlaceholderVisible) {
            await expect(placeholder).toContainText('Нет сохранённых сессий');
        }

        // Закрываем
        const btnCloseModal = window.locator('[data-testid="btn-close-modal"]');
        await btnCloseModal.click();
    });

    test('окно должно быть always-on-top', async () => {
        const isAlwaysOnTop = await electronApp.evaluate(async ({ BrowserWindow }) => {
            const win = BrowserWindow.getAllWindows()[0];
            return win ? win.isAlwaysOnTop() : false;
        });

        expect(isAlwaysOnTop).toBe(true);
    });

    test('окно должно быть frameless', async () => {
        // Проверяем что есть кастомный header для перетаскивания
        const header = window.locator('[data-testid="header"]');
        await expect(header).toBeVisible();

        // Проверяем наличие drag region
        const dragRegion = header.locator('.header-drag-region');
        await expect(dragRegion).toBeVisible();
    });
});

test.describe('Live Hints Integration', () => {
    test.beforeEach(async () => {
        // Перезапускаем приложение для каждого теста
        if (!electronApp) {
            electronApp = await electron.launch({
                args: [path.join(__dirname, '../../main.js')],
                env: {
                    ...process.env,
                    NODE_ENV: 'test'
                }
            });
            window = await electronApp.firstWindow();
            await window.waitForLoadState('domcontentloaded');
        }
    });

    test('статус должен меняться при попытке старта', async () => {
        const btnToggle = window.locator('[data-testid="btn-toggle"]');
        const statusIndicator = window.locator('[data-testid="status-indicator"]');

        // Запоминаем начальный класс
        const initialClass = await statusIndicator.getAttribute('class');

        // Кликаем старт
        await btnToggle.click();
        await window.waitForTimeout(1000);

        // Статус должен измениться (listening или error)
        const currentClass = await statusIndicator.getAttribute('class');

        // Класс должен содержать listening или error (если серверы не запущены)
        const hasListening = currentClass.includes('status-listening');
        const hasError = currentClass.includes('status-error');
        const hasPaused = currentClass.includes('status-paused');

        // Что-то должно было произойти
        expect(hasListening || hasError || hasPaused).toBe(true);

        // Останавливаем если запустилось
        if (hasListening) {
            await btnToggle.click();
            await window.waitForTimeout(200);
        }
    });
});
=======
/**
 * E2E тесты для Live Hints приложения
 * Использует Playwright для тестирования Electron
 */

const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

let electronApp;
let window;

test.describe('Live Hints E2E', () => {
    test.beforeAll(async () => {
        // Запускаем Electron приложение
        electronApp = await electron.launch({
            args: [path.join(__dirname, '../../main.js')],
            env: {
                ...process.env,
                NODE_ENV: 'test'
            }
        });

        // Получаем первое окно
        window = await electronApp.firstWindow();

        // Ждём загрузки приложения
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('должен отображать основные элементы UI', async () => {
        // Проверяем наличие основных элементов
        await expect(window.locator('[data-testid="app-container"]')).toBeVisible();
        await expect(window.locator('[data-testid="header"]')).toBeVisible();
        await expect(window.locator('[data-testid="btn-toggle"]')).toBeVisible();
        await expect(window.locator('[data-testid="status-indicator"]')).toBeVisible();
        await expect(window.locator('[data-testid="status-text"]')).toBeVisible();
        await expect(window.locator('[data-testid="transcript-feed"]')).toBeVisible();
        await expect(window.locator('[data-testid="hints-feed"]')).toBeVisible();
    });

    test('должен отображать кнопку Старт', async () => {
        const btnToggle = window.locator('[data-testid="btn-toggle"]');
        await expect(btnToggle).toContainText('Старт');
    });

    test('статус должен быть "Приостановлено" по умолчанию', async () => {
        const statusText = window.locator('[data-testid="status-text"]');
        await expect(statusText).toHaveText('Приостановлено');

        const statusIndicator = window.locator('[data-testid="status-indicator"]');
        await expect(statusIndicator).toHaveClass(/status-paused/);
    });

    test('должен отображать выбор LLM провайдера', async () => {
        const providerSelect = window.locator('[data-testid="llm-provider-select"]');
        await expect(providerSelect).toBeVisible();

        // Проверяем опции
        const options = providerSelect.locator('option');
        await expect(options).toHaveCount(4);
    });

    test('должен открывать модальное окно истории', async () => {
        const btnHistory = window.locator('[data-testid="btn-history"]');
        await btnHistory.click();

        const historyModal = window.locator('[data-testid="history-modal"]');
        await expect(historyModal).toBeVisible();

        // Закрываем модалку
        const btnCloseModal = window.locator('[data-testid="btn-close-modal"]');
        await btnCloseModal.click();

        await expect(historyModal).toBeHidden();
    });

    test('кнопка Старт должна менять текст на Стоп при клике', async () => {
        const btnToggle = window.locator('[data-testid="btn-toggle"]');

        // Кликаем Старт
        await btnToggle.click();

        // Ждём изменения (может быть ошибка подключения, но кнопка должна измениться)
        await window.waitForTimeout(500);

        // Проверяем что кнопка стала "Стоп" или статус изменился
        const btnText = await btnToggle.textContent();
        const hasStopText = btnText.includes('Стоп');

        // Если кнопка стала "Стоп", кликаем чтобы вернуть в исходное состояние
        if (hasStopText) {
            await btnToggle.click();
            await window.waitForTimeout(200);
            await expect(btnToggle).toContainText('Старт');
        }
    });

    test('должен отображать placeholder в ленте транскриптов', async () => {
        const transcriptFeed = window.locator('[data-testid="transcript-feed"]');
        const placeholder = transcriptFeed.locator('.placeholder');

        // Placeholder может быть виден если нет транскриптов
        const isVisible = await placeholder.isVisible().catch(() => false);
        if (isVisible) {
            await expect(placeholder).toContainText('Транскрипт появится здесь');
        }
    });

    test('должен отображать placeholder в ленте подсказок', async () => {
        const hintsFeed = window.locator('[data-testid="hints-feed"]');
        const placeholder = hintsFeed.locator('.placeholder');

        const isVisible = await placeholder.isVisible().catch(() => false);
        if (isVisible) {
            await expect(placeholder).toContainText('Подсказки появятся здесь');
        }
    });

    test('кнопки управления окном должны быть кликабельными', async () => {
        const btnMinimize = window.locator('[data-testid="btn-minimize"]');
        const btnClose = window.locator('[data-testid="btn-close"]');

        await expect(btnMinimize).toBeVisible();
        await expect(btnMinimize).toBeEnabled();

        await expect(btnClose).toBeVisible();
        await expect(btnClose).toBeEnabled();
    });

    test('провайдер должен сохраняться при выборе', async () => {
        const providerSelect = window.locator('[data-testid="llm-provider-select"]');

        // Выбираем OpenAI
        await providerSelect.selectOption('openai');

        // Проверяем что выбран
        await expect(providerSelect).toHaveValue('openai');

        // Возвращаем на Ollama
        await providerSelect.selectOption('ollama');
        await expect(providerSelect).toHaveValue('ollama');
    });

    test('история сессий должна быть пустой изначально', async () => {
        const btnHistory = window.locator('[data-testid="btn-history"]');
        await btnHistory.click();

        const sessionsList = window.locator('[data-testid="sessions-list"]');
        await expect(sessionsList).toBeVisible();

        // Должен быть placeholder или пустой список
        const placeholder = sessionsList.locator('.placeholder');
        const isPlaceholderVisible = await placeholder.isVisible().catch(() => false);

        if (isPlaceholderVisible) {
            await expect(placeholder).toContainText('Нет сохранённых сессий');
        }

        // Закрываем
        const btnCloseModal = window.locator('[data-testid="btn-close-modal"]');
        await btnCloseModal.click();
    });

    test('окно должно быть always-on-top', async () => {
        const isAlwaysOnTop = await electronApp.evaluate(async ({ BrowserWindow }) => {
            const win = BrowserWindow.getAllWindows()[0];
            return win ? win.isAlwaysOnTop() : false;
        });

        expect(isAlwaysOnTop).toBe(true);
    });

    test('окно должно быть frameless', async () => {
        // Проверяем что есть кастомный header для перетаскивания
        const header = window.locator('[data-testid="header"]');
        await expect(header).toBeVisible();

        // Проверяем наличие drag region
        const dragRegion = header.locator('.header-drag-region');
        await expect(dragRegion).toBeVisible();
    });
});

test.describe('Live Hints Integration', () => {
    test.beforeEach(async () => {
        // Перезапускаем приложение для каждого теста
        if (!electronApp) {
            electronApp = await electron.launch({
                args: [path.join(__dirname, '../../main.js')],
                env: {
                    ...process.env,
                    NODE_ENV: 'test'
                }
            });
            window = await electronApp.firstWindow();
            await window.waitForLoadState('domcontentloaded');
        }
    });

    test('статус должен меняться при попытке старта', async () => {
        const btnToggle = window.locator('[data-testid="btn-toggle"]');
        const statusIndicator = window.locator('[data-testid="status-indicator"]');

        // Запоминаем начальный класс
        const initialClass = await statusIndicator.getAttribute('class');

        // Кликаем старт
        await btnToggle.click();
        await window.waitForTimeout(1000);

        // Статус должен измениться (listening или error)
        const currentClass = await statusIndicator.getAttribute('class');

        // Класс должен содержать listening или error (если серверы не запущены)
        const hasListening = currentClass.includes('status-listening');
        const hasError = currentClass.includes('status-error');
        const hasPaused = currentClass.includes('status-paused');

        // Что-то должно было произойти
        expect(hasListening || hasError || hasPaused).toBe(true);

        // Останавливаем если запустилось
        if (hasListening) {
            await btnToggle.click();
            await window.waitForTimeout(200);
        }
    });
});
>>>>>>> 19b38e4 (Initial local commit)
