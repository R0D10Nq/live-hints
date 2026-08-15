/**
 * Onboarding UI Verification and Screenshot Generator via Playwright
 */

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/RODION/.gemini/antigravity/brain/4e83fa28-db39-4017-b112-f2a154aaa5c9');

async function run() {
  console.log('[E2E-Verify] Запуск Electron приложения для верификации онбординга...');

  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'main.js'), '--onboarding'],
    env: {
      ...process.env,
      NODE_ENV: 'development', // НЕ 'test', чтобы открылось окно онбординга!
    },
  });

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);

    const title = await window.title();
    console.log('[E2E-Verify] Заголовок окна:', title);

    // 1. Скриншот Шаг 1: Выбор сценария
    const step1Path = path.join(ARTIFACT_DIR, 'onboarding_step1.png');
    await window.screenshot({ path: step1Path });
    console.log('[E2E-Verify] Сохранен скриншот Шага 1:', step1Path);

    // Проверяем карточки
    const modeCards = await window.$$('.mode-card');
    console.log('[E2E-Verify] Найдено карточек сценариев:', modeCards.length);

    // Кликаем по первой карточке (Собеседование)
    await modeCards[0].click();
    await window.waitForTimeout(300);

    // Кликаем Далее
    const btnNext = await window.$('#btnNext');
    await btnNext.click();
    await window.waitForTimeout(500);

    // 2. Скриншот Шаг 2: Резюме
    const step2Path = path.join(ARTIFACT_DIR, 'onboarding_step2.png');
    await window.screenshot({ path: step2Path });
    console.log('[E2E-Verify] Сохранен скриншот Шага 2:', step2Path);

    // Переключаем на ввод текста
    const toggleText = await window.$('#toggleResumeText');
    if (toggleText) {
      await toggleText.click();
      await window.waitForTimeout(300);
      const textarea = await window.$('#resumeTextarea');
      if (textarea) {
        await textarea.fill('Опыт работы: 5 лет Senior Full-Stack разработчик (React, Node.js, Python, Electron)');
      }
    }

    // Кликаем Далее
    await btnNext.click();
    await window.waitForTimeout(500);

    // 3. Скриншот Шаг 3: Вакансия
    const step3Path = path.join(ARTIFACT_DIR, 'onboarding_step3.png');
    await window.screenshot({ path: step3Path });
    console.log('[E2E-Verify] Сохранен скриншот Шага 3:', step3Path);

    // Кликаем Далее
    await btnNext.click();
    await window.waitForTimeout(500);

    // 4. Скриншот Шаг 4: Настройка аудио
    const step4Path = path.join(ARTIFACT_DIR, 'onboarding_step4.png');
    await window.screenshot({ path: step4Path });
    console.log('[E2E-Verify] Сохранен скриншот Шага 4:', step4Path);

    console.log('[E2E-Verify] ВСЕ 4 ЭТАПА ОНБОРДИНГА УСПЕШНО ПРОЙДЕНЫ И СФОТОГРАФИРОВАНЫ!');
  } catch (err) {
    console.error('[E2E-Verify] Ошибка в процессе тестирования:', err);
  } finally {
    await app.close();
  }
}

run();
