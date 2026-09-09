/**
 * Live Hints — Скрипты промо-лендинга
 * Интерактивный симулятор оверлея, навигация, доступность.
 */

document.addEventListener('DOMContentLoaded', () => {
  initDemoSimulator();
  initMobileMenu();
  initCopyButtons();
});

// Данные для интерактивного симулятора оверлея
const DEMO_CASES = {
  architecture: {
    category: 'Архитектура БД • PostgreSQL',
    question: 'Как масштабировать PostgreSQL при высокой нагрузке на чтение (от 50 000 RPS)?',
    bullets: [
      {
        marker: 'Паттерн',
        text: 'Read Replicas + пул соединений PgBouncer (Streaming Replication)',
      },
      {
        marker: 'Кэширование',
        text: 'Redis Cache-Aside для горячих ключей (TTL 60–300 секунд)',
      },
      {
        marker: 'Оптимизация',
        text: 'Составные индексы, EXPLAIN ANALYZE, партиционирование таблиц по датам',
      },
      {
        marker: 'Подводный камень',
        text: 'Replication Lag при критичных транзакциях (паттерн read-your-writes)',
      },
    ],
    latency: '138 мс',
    provider: 'Groq LPU (Llama 3.3 70B)',
    tokens: '124 токена',
  },
  star: {
    category: 'Опыт по схеме STAR • Резюме кандидата',
    question: 'Расскажите о самой сложной технической задаче, которую вы решили',
    bullets: [
      {
        marker: 'Ситуация',
        text: 'Время ответа API выросло до 5 секунд при росте платформы до 400 клиентов',
      },
      {
        marker: 'Причина',
        text: 'Проблема N+1 запросов в ORM и отсутствие индексов на внешних ключах',
      },
      {
        marker: 'Действия',
        text: 'Переписал выборки на select_related, настроил Redis-кэш и фоновый Celery',
      },
      {
        marker: 'Результат',
        text: 'Снижение задержки в 16 раз (до 300 мс), нагрузка на БД снизилась на 60%',
      },
    ],
    latency: '145 мс',
    provider: 'Локальная Ollama (Qwen 2.5 7B)',
    tokens: '138 токенов',
  },
  algorithms: {
    category: 'Python Core • Concurrency & GIL',
    question: 'В чем разница между процессами и потоками в Python? Как влияет GIL?',
    bullets: [
      {
        marker: 'Концепция',
        text: 'multiprocessing (изолированная память) vs threading (общая память)',
      },
      {
        marker: 'Механизм GIL',
        text: 'Global Interpreter Lock держит 1 поток на байткод CPython для безопасности памяти',
      },
      {
        marker: 'I/O задачи',
        text: 'asyncio или threading для сети и диска (GIL отпускается при ожидании сокета)',
      },
      {
        marker: 'CPU задачи',
        text: 'multiprocessing, Cython, C-расширения или сборка Python 3.13 без GIL',
      },
    ],
    latency: '112 мс',
    provider: 'Groq LPU (Llama 3.3 70B)',
    tokens: '116 токенов',
  },
};

/**
 * Инициализация интерактивного демонстрационного симулятора оверлея
 */
function initDemoSimulator() {
  const tabs = document.querySelectorAll('.demo-tab-btn');
  const categoryEl = document.getElementById('demo-category');
  const questionEl = document.getElementById('demo-question');
  const bulletsEl = document.getElementById('demo-bullets');
  const latencyEl = document.getElementById('demo-latency');
  const providerEl = document.getElementById('demo-provider');

  if (!tabs.length || !questionEl || !bulletsEl) return;

  function applyCase(caseKey) {
    const data = DEMO_CASES[caseKey];
    if (!data) return;

    // Обновляем вопрос и категорию
    if (categoryEl) categoryEl.textContent = data.category;
    questionEl.textContent = data.question;

    // Обновляем метрики
    if (latencyEl) latencyEl.textContent = data.latency;
    if (providerEl) providerEl.textContent = data.provider;

    // Плавно рендерим пункты шпаргалки
    bulletsEl.innerHTML = '';
    data.bullets.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'demo-hint-item';
      li.style.opacity = '0';
      li.style.transform = 'translateY(6px)';
      li.style.transition = `all 0.25s ease ${index * 0.08}s`;

      li.innerHTML = `
        <span class="demo-bullet-marker" aria-hidden="true"></span>
        <div>
          <span class="demo-bullet-strong">${escapeHtml(item.marker)}:</span>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `;
      bulletsEl.appendChild(li);

      // Запуск анимации появления
      requestAnimationFrame(() => {
        li.style.opacity = '1';
        li.style.transform = 'translateY(0)';
      });
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const caseKey = tab.getAttribute('data-case');
      applyCase(caseKey);
    });
  });

  // Запуск начального сценария
  applyCase('architecture');
}

/**
 * Мобильное меню навигации
 */
function initMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
  });

  // Закрытие мобильного меню при клике на ссылку
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Кнопки копирования текста
 */
function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const textToCopy = btn.getAttribute('data-copy');
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = btn.textContent;
        btn.textContent = 'Скопировано!';
        btn.style.borderColor = 'var(--accent-emerald)';
        btn.style.color = 'var(--accent-emerald)';

        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 2000);
      } catch (err) {
        console.warn('Не удалось скопировать текст в буфер:', err);
      }
    });
  });
}

/**
 * Безопасное экранирование строк
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
