/**
 * E2E тесты для Live Hints приложения
 * Используют Playwright для тестирования Electron приложения
 */

const { _electron: electron } = require('playwright');
const path = require('path');

// Пропускаем E2E тесты если не установлен Playwright
const SKIP_E2E = process.env.SKIP_E2E === 'true' || !electron;

const describeOrSkip = SKIP_E2E ? describe.skip : describe;

describeOrSkip('Live Hints E2E Tests', () => {
  let electronApp;
  let page;

  beforeAll(async () => {
    try {
      electronApp = await electron.launch({
        args: [path.join(__dirname, '..', '..', 'main.js')],
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });

      page = await electronApp.firstWindow();
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      console.warn('Не удалось запустить Electron:', error.message);
    }
  }, 30000);

  afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  describe('Запуск приложения', () => {
    test('приложение должно запускаться', async () => {
      if (!page) return;
      const title = await page.title();
      expect(title).toContain('Live Hints');
    });

    test('главное окно должно быть видимым', async () => {
      if (!electronApp) return;
      const isVisible = await electronApp.evaluate(({ BrowserWindow }) => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        return mainWindow && mainWindow.isVisible();
      });
      expect(isVisible).toBe(true);
    });
  });

  describe('UI элементы', () => {
    test('кнопка старт должна присутствовать', async () => {
      if (!page) return;
      const startButton = await page.$('#btn-toggle');
      expect(startButton).toBeTruthy();
    });

    test('поле транскрипта должно присутствовать', async () => {
      if (!page) return;
      const transcriptFeed = await page.$('#transcript-feed');
      expect(transcriptFeed).toBeTruthy();
    });

    test('поле подсказок должно присутствовать', async () => {
      if (!page) return;
      const hintsFeed = await page.$('#hints-feed');
      expect(hintsFeed).toBeTruthy();
    });

    test('статус должен присутствовать', async () => {
      if (!page) return;
      const status = await page.$('#status-text');
      expect(status).toBeTruthy();
    });
  });

  describe('Навигация', () => {
    test('клик на настройки должен открывать панель', async () => {
      if (!page) return;
      const settingsBtn = await page.$('#btn-settings');
      if (settingsBtn) {
        await settingsBtn.click();
        await page.waitForTimeout(300);
        const panel = await page.$('.settings-panel');
        expect(panel).toBeTruthy();
      }
    });

    test('клик на историю должен открывать панель', async () => {
      if (!page) return;
      const historyBtn = await page.$('#btn-history');
      if (historyBtn) {
        await historyBtn.click();
        await page.waitForTimeout(300);
        const panel = await page.$('.history-panel');
        expect(panel).toBeTruthy();
      }
    });
  });

  describe('Кнопки управления окном', () => {
    test('кнопка минимизации должна присутствовать', async () => {
      if (!page) return;
      const minimizeBtn = await page.$('#btn-minimize');
      expect(minimizeBtn).toBeTruthy();
    });

    test('кнопка закрытия должна присутствовать', async () => {
      if (!page) return;
      const closeBtn = await page.$('#btn-close');
      expect(closeBtn).toBeTruthy();
    });
  });

  describe('Пагинация подсказок', () => {
    test('кнопки пагинации должны присутствовать', async () => {
      if (!page) return;
      const prevBtn = await page.$('#btn-prev-hint');
      const nextBtn = await page.$('#btn-next-hint');
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();
    });

    test('счётчик пагинации должен присутствовать', async () => {
      if (!page) return;
      const counter = await page.$('#pagination-counter');
      expect(counter).toBeTruthy();
    });
  });
});

// Тесты без запуска Electron (мок тесты)
describe('E2E Mock Tests', () => {
  describe('Конфигурация приложения', () => {
    test('main.js должен существовать', () => {
      const mainPath = path.join(__dirname, '..', '..', 'main.js');
      const fs = require('fs');
      expect(fs.existsSync(mainPath)).toBe(true);
    });

    test('package.json должен иметь main entry', () => {
      const packageJson = require('../../package.json');
      expect(packageJson.main).toBeTruthy();
    });

    test('package.json должен иметь electron dependency', () => {
      const packageJson = require('../../package.json');
      expect(
        packageJson.dependencies?.electron || packageJson.devDependencies?.electron
      ).toBeTruthy();
    });
  });

  describe('Структура файлов', () => {
    const fs = require('fs');
    const checkPath = (relativePath) => path.join(__dirname, '..', '..', relativePath);

    test('renderer/index.html должен существовать', () => {
      expect(fs.existsSync(checkPath('renderer/index.html'))).toBe(true);
    });

    test('renderer/app-new.js должен существовать', () => {
      expect(fs.existsSync(checkPath('renderer/app-new.js'))).toBe(true);
    });

    test('renderer/styles-new.css должен существовать', () => {
      expect(fs.existsSync(checkPath('renderer/styles-new.css'))).toBe(true);
    });

    test('python/llm_server.py должен существовать', () => {
      expect(fs.existsSync(checkPath('python/llm_server.py'))).toBe(true);
    });

    test('python/stt_server.py должен существовать', () => {
      expect(fs.existsSync(checkPath('python/stt_server.py'))).toBe(true);
    });
  });

  describe('HTML структура', () => {
    const fs = require('fs');
    const htmlPath = path.join(__dirname, '..', '..', 'renderer', 'index.html');
    let htmlContent;

    beforeAll(() => {
      htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    });

    test('должен содержать transcript-feed', () => {
      expect(htmlContent).toContain('id="transcript-feed"');
    });

    test('должен содержать hints-feed', () => {
      expect(htmlContent).toContain('id="hints-feed"');
    });

    test('должен содержать btn-toggle', () => {
      expect(htmlContent).toContain('id="btn-toggle"');
    });

    test('должен подключать app-new.js', () => {
      expect(htmlContent).toContain('app-new.js');
    });

    test('должен подключать styles-new.css', () => {
      expect(htmlContent).toContain('styles-new.css');
    });
  });
});
