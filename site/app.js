/**
 * Live Hints — Скрипты промо-лендинга в стиле SpineEdge
 * Интерактивный симулятор оверлея, навигация, анимации.
 */

document.addEventListener('DOMContentLoaded', () => {
  initDemoSimulator();
  initMobileMenu();
  initCopyButton();
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

      // Обновляем контент
      questionEl.textContent = data.question;
      latencyEl.textContent = data.latency;

      // Очищаем и анимированно добавляем пункты
      bulletsEl.innerHTML = '';
      data.bullets.forEach((bulletText, index) => {
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
      });
    });
  });
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
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span>Скопировано</span>';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
      }, 2000);
    } catch {
      // Fallback
    }
  });
}
