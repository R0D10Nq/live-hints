/**
 * Live Hints — Скрипты промо-лендинга в стиле SpineEdge
 * Интерактивный симулятор оверлея, навигация, анимации.
 */

document.addEventListener('DOMContentLoaded', () => {
  initDemoSimulator();
  initMobileMenu();
  initCopyButton();
  initWindowControls();
});

// Данные для интерактивного симулятора оверлея
const DEMO_CASES = {
  arch: {
    question:
      'Как масштабировать базу данных PostgreSQL при нагрузке 50,000 RPS на чтение и частых блокировках?',
    latency: 'Задержка: 142 мс',
    bullets: [
      'Вынести тяжелые SELECT-запросы на read-only реплики через PgBouncer (Transaction Pooling).',
      'Внедрить двухуровневый кэш: локальный in-memory L1 + Redis Sentinel L2 с TTL 60 секунд.',
      'Партиционировать критичные таблицы по диапазонам дат (Declarative Partitioning).',
      'Проверить медленные транзакции: устранить N+1 запросы и оптимизировать составные B-Tree индексы.',
    ],
  },
  star: {
    question:
      'Расскажите о ситуации, когда сервис упал в продакшене под пиковой нагрузкой, и как вы справились?',
    latency: 'Задержка: 168 мс',
    bullets: [
      'Situation: В Черную Пятницу сервис заказов превысил пул соединений БД, latency выросла до 12 с.',
      'Task: Восстановить пропускную способность за 15 минут без потери платежных транзакций.',
      'Action: Включил деградацию (Circuit Breaker на второстепенные виджеты) и отмасштабировал реплики.',
      'Result: Доступность 99.98%, ни один оформленный заказ не был потерян, время ответа вернулось к 45 мс.',
    ],
  },
  algo: {
    question:
      'Как найти длину наибольшей непрерывной возрастающей подпоследовательности в массиве за O(N)?',
    latency: 'Задержка: 125 мс',
    bullets: [
      'Использовать скользящее окно (Two Pointers / Sliding Window) с динамическим сдвигом левой границы.',
      'Хранить текущую длину cur_len и глобальный максимум max_len, обновляя при array[i] > array[i-1].',
      'При нарушении возрастания сбрасывать cur_len в 1. Итоговая сложность: O(N) по времени, O(1) по памяти.',
      'Граничные случаи: пустой массив, массив из одного элемента, строго убывающая последовательность.',
    ],
  },
};

// Таймеры для построчного стриминга
let streamTimeouts = [];

/**
 * Очистить активные таймеры стриминга
 */
function clearStreamTimeouts() {
  streamTimeouts.forEach((t) => clearTimeout(t));
  streamTimeouts = [];
}

/**
 * Инициализация интерактивного симулятора оверлея
 */
function initDemoSimulator() {
  const tabs = document.querySelectorAll('.demo-tab-btn');
  const questionEl = document.getElementById('demoQuestion');
  const latencyEl = document.getElementById('demoLatency');
  const bulletsEl = document.getElementById('demoBullets');

  if (!tabs.length || !questionEl || !latencyEl || !bulletsEl) {
    return;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const scenarioKey = tab.getAttribute('data-scenario');
      const data = DEMO_CASES[scenarioKey];
      if (!data) return;

      // Обновляем состояние табов
      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Обновляем вопрос
      questionEl.textContent = data.question;

      // Сбрасываем таймеры стриминга
      clearStreamTimeouts();

      // Имитация стриминга ИИ
      latencyEl.textContent = 'Слушаю вопрос...';
      bulletsEl.innerHTML = '';

      const timerLatency = setTimeout(() => {
        latencyEl.textContent = data.latency;
      }, 140);
      streamTimeouts.push(timerLatency);

      // Построчное появление тезисов
      data.bullets.forEach((bulletText, index) => {
        const timerBullet = setTimeout(
          () => {
            const li = document.createElement('li');
            li.className = 'demo-bullet-item';

            const numSpan = document.createElement('span');
            numSpan.className = 'bullet-num';
            numSpan.textContent = String(index + 1);

            const textSpan = document.createElement('span');
            textSpan.textContent = bulletText;

            li.appendChild(numSpan);
            li.appendChild(textSpan);
            bulletsEl.appendChild(li);
          },
          150 + index * 120
        );

        streamTimeouts.push(timerBullet);
      });
    });
  });
}

/**
 * Инициализация элементов управления окном Windows HUD (Свернуть / Закрыть)
 */
function initWindowControls() {
  const minBtn = document.getElementById('demoMinBtn');
  const closeBtn = document.getElementById('demoCloseBtn');
  const demoBody = document.querySelector('.demo-body');

  if (!demoBody) return;

  const originalContent = demoBody.innerHTML;

  function toggleMinimize() {
    const isMinimized = demoBody.querySelector('.demo-minimized-notice');
    if (isMinimized) {
      demoBody.innerHTML = originalContent;
      initDemoSimulator();
      initCopyButton();
    } else {
      clearStreamTimeouts();
      demoBody.innerHTML = `
        <div class="demo-minimized-notice">
          <p style="margin-bottom: 0.75rem;">Оверлей скрыт в фоновый режим за 1 кадр.</p>
          <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
            В реальной работе для быстрого вызова используется хоткей <kbd>Ctrl + Space</kbd>.
          </p>
          <button type="button" class="btn btn-lime" id="restoreDemoBtn" style="padding: 0.45rem 1.1rem; font-size: 0.8rem;">
            <span>Развернуть оверлей</span>
          </button>
        </div>
      `;
      const restoreBtn = document.getElementById('restoreDemoBtn');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', toggleMinimize);
      }
    }
  }

  if (minBtn) {
    minBtn.addEventListener('click', toggleMinimize);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', toggleMinimize);
  }
}

/**
 * Инициализация мобильного меню
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');

  if (!toggleBtn || !navMenu) return;

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
    navMenu.classList.toggle('mobile-open');
  });

  // Закрытие при клике по ссылке
  navMenu.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('mobile-open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Инициализация кнопки копирования текста из демо
 */
function initCopyButton() {
  const copyBtn = document.getElementById('copyDemoBtn');
  const questionEl = document.getElementById('demoQuestion');
  const bulletsEl = document.getElementById('demoBullets');

  if (!copyBtn || !questionEl || !bulletsEl) return;

  copyBtn.addEventListener('click', async () => {
    const textToCopy = [
      `Вопрос: ${questionEl.textContent.trim()}`,
      '',
      'Тезисы подсказки:',
      ...Array.from(bulletsEl.querySelectorAll('li')).map(
        (li, i) => `${i + 1}. ${li.textContent.replace(/^\d+/, '').trim()}`
      ),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalHtml = copyBtn.innerHTML;
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Скопировано</span>
      `;
      setTimeout(() => {
        copyBtn.innerHTML = originalHtml;
      }, 2000);
    } catch {
      // Игнорируем в средах без доступа к Clipboard API
    }
  });
}
