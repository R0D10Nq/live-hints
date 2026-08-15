/**
 * HintManager - Управление подсказками и взаимодействием с LLM
 */

import { SERVERS, TIMEOUTS, CONTEXT, LLM, STORAGE, SYSTEM_PROMPTS } from './constants.js';
import { logger } from './utils/logger.js';

export class HintManager {
  constructor(app) {
    this.app = app;
    this.hintRequestPending = false;
    this.transcriptContext = [];
    this.lastContextHash = '';
    this.contextWindowSize = CONTEXT.WINDOW_SIZE_DEFAULT;
    this.maxContextChars = CONTEXT.MAX_CHARS_DEFAULT;
    this.maxTokens = LLM.MAX_TOKENS_DEFAULT;
    this.temperature = LLM.TEMPERATURE_DEFAULT;
    this.currentProfile = 'job_interview_ru';
    this.customInstructions = '';
    this.currentModel = null; // Текущая модель Ollama
    this.userContext = ''; // Контекст пользователя (резюме)

    this.metrics = {
      t_hint_request_start: null,
      t_hint_response: null,
      t_hint_done: null,
      stt_latency_ms: null,
      llm_client_latency_ms: null,
      llm_server_latency_ms: null,
    };
  }

  async requestHint(transcriptText, source = 'interviewer') {
    // Сохраняем с информацией об источнике
    const entry =
      typeof transcriptText === 'object'
        ? transcriptText
        : { text: transcriptText, source, timestamp: Date.now() };

    this.transcriptContext.push(entry);
    if (this.transcriptContext.length > this.contextWindowSize) {
      this.transcriptContext = this.transcriptContext.slice(-this.contextWindowSize);
    }

    const context = this.buildContext();
    const contextHash = context.join('|');

    if (this.lastContextHash === contextHash) {
      if (this.app.debugMode) logger.debug('LLM', 'Дубликат контекста, пропускаем');
      return;
    }

    if (this.hintRequestPending) {
      if (this.app.debugMode) logger.debug('LLM', 'Запрос уже в процессе');
      return;
    }

    this.hintRequestPending = true;
    this.lastContextHash = contextHash;
    this.metrics.t_hint_request_start = performance.now();
    const startTime = this.metrics.t_hint_request_start;

    this.app.ui.showHintLoading();

    if (this.app.debugMode) {
      logger.debug(
        'LLM',
        `Streaming запрос: maxTokens=${this.maxTokens}, temperature=${this.temperature}`
      );
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.LLM_REQUEST);

      const systemPrompt = this.buildSystemPrompt();

      const response = await fetch(`${SERVERS.LLM}/hint/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcriptText,
          context: context,
          profile: this.currentProfile,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          model: this.currentModel,
          system_prompt: systemPrompt,
          user_context: this.userContext,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errorText = await response.text().catch(() => 'Не удалось прочитать ответ');
        logger.error('LLM', `Ошибка ${response.status}:`, errorText.substring(0, 300));
        this.app.ui.showError(`LLM ошибка ${response.status}`);
        this.app.ui.hideHintLoading();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedHint = '';
      let hintElement = null;
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.chunk) {
              if (isFirstChunk) {
                this.metrics.t_hint_response = performance.now();
                const ttft = Math.round(this.metrics.t_hint_response - startTime);
                if (this.app.debugMode) logger.debug('LLM', `TTFT: ${ttft}ms`);

                this.app.ui.hideHintLoading();
                hintElement = this.app.ui.createStreamingHintElement();
                isFirstChunk = false;
              }

              accumulatedHint += data.chunk;
              if (hintElement) {
                this.app.ui.updateStreamingHint(hintElement, accumulatedHint);
              }
            }

            if (data.done) {
              clearTimeout(timeoutId);
              this.metrics.t_hint_done = performance.now();
              const totalLatency = Math.round(this.metrics.t_hint_done - startTime);

              this.metrics.llm_client_latency_ms = totalLatency;
              this.metrics.llm_server_latency_ms = data.latency_ms || null;

              if (this.app.debugMode) {
                this.app.ui.updateMetricsPanel(this.metrics);
              }

              if (this.app.debugMode) {
                logger.debug(
                  'LLM',
                  `Streaming завершён: total=${totalLatency}ms, server=${data.latency_ms}ms, cached=${data.cached}`
                );
              }

              if (hintElement && accumulatedHint.trim()) {
                this.app.ui.finalizeStreamingHint(hintElement, accumulatedHint, {
                  latencyMs: data.latency_ms,
                  cached: data.cached || false,
                  questionType: data.question_type || 'general',
                });
                this.app.ui.lastHintText = accumulatedHint.trim();
              } else if (!accumulatedHint.trim()) {
                this.app.ui.hideHintLoading();
                this.app.ui.showToast('LLM вернул пустой ответ', 'warning');
              }
            }
          } catch (parseError) {
            if (this.app.debugMode) logger.warn('LLM', 'SSE parse error:', parseError);
          }
        }
      }
    } catch (error) {
      this.app.ui.hideHintLoading();
      const errorMessage = this.getReadableError(error);
      logger.error('LLM', 'Ошибка:', errorMessage);
      this.app.ui.showError(errorMessage);
    } finally {
      this.hintRequestPending = false;
    }
  }

  async manualRequestHint() {
    // Синхронизируем контекст из app.transcriptContext если там есть данные
    if (this.app.transcriptContext && this.app.transcriptContext.length > 0) {
      this.transcriptContext = [...this.app.transcriptContext];
    }

    if (!this.app.isRunning || this.transcriptContext.length === 0) {
      this.app.ui.showError('Нет транскрипта для анализа. Дождитесь речи.');
      return;
    }

    // Извлекаем последний вопрос интервьюера для фокусированного ответа
    const lastInterviewerQuestion = this.getLastInterviewerQuestion();
    const questionToAnswer = lastInterviewerQuestion || this.getLastTranscriptText();

    await this.requestHint(questionToAnswer, 'interviewer');
  }

  getLastInterviewerQuestion() {
    // Ищем последний вопрос от интервьюера
    for (let i = this.transcriptContext.length - 1; i >= 0; i--) {
      const item = this.transcriptContext[i];
      if (typeof item === 'object' && item.source === 'interviewer') {
        return item.text;
      } else if (typeof item === 'string') {
        // Для обратной совместимости — если это строка с иконкой интервьюера
        if (item.includes('🎙️') || item.includes('Интервьюер')) {
          return item.replace(/🎙️\s*Интервьюер:\s*/g, '');
        }
        return item;
      }
    }
    return null;
  }

  getLastTranscriptText() {
    const last = this.transcriptContext[this.transcriptContext.length - 1];
    if (typeof last === 'object' && last.text) {
      return last.text;
    }
    return typeof last === 'string' ? last : '';
  }

  buildContext() {
    const items = this.transcriptContext.slice(-this.contextWindowSize);
    let totalChars = 0;
    const result = [];

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      // Поддерживаем как объекты с source, так и простые строки
      let formattedText;
      if (typeof item === 'object' && item.text) {
        const icon = item.source === 'candidate' ? '🗣️ Ты' : '🎙️ Интервьюер';
        formattedText = `${icon}: ${item.text}`;
      } else {
        formattedText = typeof item === 'string' ? item : String(item);
      }

      if (totalChars + formattedText.length <= this.maxContextChars) {
        result.unshift(formattedText);
        totalChars += formattedText.length;
      } else {
        break;
      }
    }

    return result;
  }

  buildSystemPrompt() {
    if (this.currentProfile === 'custom') {
      const trimmed = (this.customInstructions || '').trim();
      if (trimmed.length > 0) {
        return trimmed.length > STORAGE.MAX_PROMPT_LENGTH
          ? trimmed.substring(0, STORAGE.MAX_PROMPT_LENGTH)
          : trimmed;
      }
      return SYSTEM_PROMPTS.default_fallback;
    }

    return SYSTEM_PROMPTS[this.currentProfile] || SYSTEM_PROMPTS.job_interview_ru;
  }

  getReadableError(error) {
    if (error.name === 'AbortError') {
      return 'Таймаут запроса к LLM (60 сек)';
    }
    if (error.message?.includes('NetworkError') || error.message?.includes('network')) {
      return 'Ошибка сети. Проверьте подключение.';
    }
    if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      return `LLM сервер недоступен (${SERVERS.LLM})`;
    }
    if (error.message?.includes('ECONNREFUSED')) {
      return 'LLM сервер не запущен. Запустите: python python/llm_server.py';
    }
    return `Ошибка: ${error.message || 'Неизвестная ошибка'}`;
  }

  async checkHealth() {
    try {
      const response = await fetch(`${SERVERS.LLM}/health`, {
        method: 'GET',
        timeout: 5000,
      });

      if (response.ok) {
        const data = await response.json();
        const msg = `LLM: ${data.status}, модель: ${data.model}`;
        this.app.ui.showToast(msg, 'success');
        logger.info('Health', 'LLM статус:', data);
      } else {
        this.app.ui.showError('LLM сервер недоступен');
      }
    } catch (error) {
      this.app.ui.showError(`LLM сервер не отвечает: ${error.message}`);
    }
  }

  clearContext() {
    this.transcriptContext = [];
    this.lastContextHash = '';
  }

  setProfile(profile, customInstructions = '') {
    this.currentProfile = profile;
    this.customInstructions = customInstructions;
  }

  setParams(params) {
    if (params.contextWindowSize !== undefined) this.contextWindowSize = params.contextWindowSize;
    if (params.maxContextChars !== undefined) this.maxContextChars = params.maxContextChars;
    if (params.maxTokens !== undefined) this.maxTokens = params.maxTokens;
    if (params.temperature !== undefined) this.temperature = params.temperature;
  }

  setUserContext(context) {
    this.userContext = context || '';
    if (this.app.debugMode && context) {
      logger.debug('HintManager', `Установлен контекст пользователя: ${context.length} символов`);
    }
  }

  setupDirectMessage() {
    const input = document.getElementById('direct-message-input');
    const btn = document.getElementById('btn-send-direct');

    if (!input || !btn) return;

    const sendMessage = () => {
      const message = input.value.trim();
      if (!message) return;

      input.value = '';
      this.sendDirectMessage(message);
    };

    btn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  async sendDirectMessage(message) {
    if (!message || message.trim().length === 0) return;

    // Строим контекст с учётом всей истории диалога
    const context = this.buildContext();
    const fullPrompt = `Пользователь просит уточнить или дополнить ответ:\n\n"${message}"\n\nКонтекст диалога:\n${context.join('\n')}`;

    this.app.ui.showToast('Обрабатываю запрос...', 'info');

    try {
      await this.requestHint(fullPrompt, 'candidate');
    } catch (error) {
      this.app.ui.showError(`Ошибка: ${error.message}`);
    }
  }
}
