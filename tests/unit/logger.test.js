/**
 * Тесты для logger.js
 */

import { logger, LOG_LEVELS } from '../../renderer/modules/utils/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    logger.setLevel('INFO');
    jest.clearAllMocks();
  });

  describe('уровни логирования', () => {
    test('должен логировать info по умолчанию', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      logger.info('Test', 'message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('не должен логировать debug в режиме INFO', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      logger.debug('Test', 'message');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    test('должен логировать debug в debug режиме', () => {
      logger.setDebugMode(true);
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      logger.debug('Test', 'message');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('форматирование', () => {
    test('должен включать timestamp и уровень', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      logger.info('Module', 'test message');
      const callArg = consoleSpy.mock.calls[0][0];
      expect(callArg).toContain('[INFO]');
      expect(callArg).toContain('[Module]');
      expect(callArg).toContain('test message');
    });
  });

  describe('методы логирования', () => {
    test('warn должен использовать console.warn', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      logger.warn('Test', 'warning');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('error должен использовать console.error', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      logger.error('Test', 'error');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('metric должен логировать в debug режиме', () => {
      logger.setDebugMode(true);
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      logger.metric('latency', 100);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[METRIC]'),
      );
    });
  });
});
