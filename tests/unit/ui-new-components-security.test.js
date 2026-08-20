/**
 * @jest-environment jsdom
 */

jest.mock('../../renderer/modules/ui-new/animation-engine.js', () => ({
  animations: {
    addHoverEffect: jest.fn(),
    entrance: jest.fn(() => Promise.resolve()),
    fadeOut: jest.fn(() => Promise.resolve()),
  },
}));

const { HintComponent, ToastComponent } = require('../../renderer/modules/ui-new/components.js');

describe('Безопасный вывод данных в новом интерфейсе', () => {
  const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';

  beforeEach(() => {
    document.body.innerHTML = '<div id="hints"></div><div id="toasts"></div>';
  });

  test('подсказка, контекст и метки не создают HTML из пользовательских данных', () => {
    const component = new HintComponent(document.getElementById('hints'));
    const card = component.createHintCard(
      {
        text: payload,
        context: payload,
        type: payload,
        confidence: payload,
        timestamp: Date.now(),
      },
      0,
      1
    );

    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('script')).toBeNull();
    expect(card.querySelector('.hint-content').textContent).toBe(payload);
    expect(card.querySelector('.hint-context-text').textContent).toBe(payload);
    expect(card.querySelector('.hint-badges').textContent).toContain(payload);
  });

  test('уведомление выводит сообщение только как текст', () => {
    const component = new ToastComponent(document.getElementById('toasts'));
    const toast = component.show(payload, 'error', 60_000);

    expect(toast.querySelector('img')).toBeNull();
    expect(toast.querySelector('script')).toBeNull();
    expect(toast.querySelector('.toast-message').textContent).toBe(payload);
  });
});
