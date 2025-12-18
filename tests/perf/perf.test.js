<<<<<<< HEAD
/**
 * Performance Test - проверка latency пайплайна
 * Запуск: npm run perf
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Конфигурация
const STT_URL = 'ws://localhost:8765';
const LLM_URL = 'http://localhost:8766';
const MAX_STT_LATENCY_MS = 2000;  // Максимальная задержка STT
const MAX_LLM_LATENCY_MS = 5000;  // Максимальная задержка LLM
const SAMPLE_RATE = 16000;

// Генерация тестового аудио (синусоида с речевым паттерном)
function generateTestAudio(durationSec = 2) {
    const samples = durationSec * SAMPLE_RATE;
    const audio = new Float32Array(samples);

    // Генерируем речеподобный сигнал
    for (let i = 0; i < samples; i++) {
        const t = i / SAMPLE_RATE;
        // Основная частота (200Hz) + гармоники
        audio[i] = 0.3 * Math.sin(2 * Math.PI * 200 * t) +
            0.2 * Math.sin(2 * Math.PI * 400 * t) +
            0.1 * Math.sin(2 * Math.PI * 800 * t);
        // Добавляем огибающую
        audio[i] *= 0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t);
    }

    return Buffer.from(audio.buffer);
}

// Тест STT сервера (проверка connectivity)
async function testSTT() {
    return new Promise((resolve, reject) => {
        console.log('\n[PERF] Тест STT сервера (connectivity)...');

        const ws = new WebSocket(STT_URL);
        const startTime = Date.now();

        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error(`STT таймаут подключения (>${MAX_STT_LATENCY_MS}ms)`));
        }, MAX_STT_LATENCY_MS);

        ws.on('open', () => {
            const latency = Date.now() - startTime;
            console.log(`[PERF] STT подключение: ${latency}ms`);
            clearTimeout(timeout);
            ws.close();
            resolve({ latency, text: 'connectivity_ok' });
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(new Error(`STT ошибка: ${err.message}`));
        });
    });
}

// Тест LLM сервера
async function testLLM(text = 'Привет, как дела? Что нового?') {
    console.log('\n[PERF] Тест LLM сервера...');

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            text: text,
            context: []
        });

        const options = {
            hostname: 'localhost',
            port: 8766,
            path: '/hint',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: MAX_LLM_LATENCY_MS + 5000
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const latency = Date.now() - startTime;

                try {
                    const result = JSON.parse(body);
                    console.log(`[PERF] Подсказка получена: "${result.hint?.substring(0, 50)}..." (${latency}ms)`);

                    if (!result.hint) {
                        reject(new Error('LLM не вернул подсказку'));
                    } else if (latency > MAX_LLM_LATENCY_MS) {
                        reject(new Error(`LLM latency слишком высокий: ${latency}ms > ${MAX_LLM_LATENCY_MS}ms`));
                    } else {
                        resolve({ latency, hint: result.hint });
                    }
                } catch (e) {
                    reject(new Error(`LLM ответ невалидный: ${body}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`LLM ошибка: ${e.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`LLM таймаут (>${MAX_LLM_LATENCY_MS}ms)`));
        });

        req.write(data);
        req.end();
    });
}

// Тест здоровья серверов
async function checkHealth() {
    console.log('[PERF] Проверка доступности серверов...');

    // Проверка STT
    try {
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(STT_URL);
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('STT сервер недоступен'));
            }, 3000);

            ws.on('open', () => {
                clearTimeout(timeout);
                ws.close();
                resolve();
            });
            ws.on('error', () => {
                clearTimeout(timeout);
                reject(new Error('STT сервер недоступен'));
            });
        });
        console.log('[PERF] ✓ STT сервер доступен');
    } catch (e) {
        throw e;
    }

    // Проверка LLM
    try {
        await new Promise((resolve, reject) => {
            http.get(`${LLM_URL}/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    reject(new Error('LLM сервер недоступен'));
                }
            }).on('error', () => {
                reject(new Error('LLM сервер недоступен'));
            });
        });
        console.log('[PERF] ✓ LLM сервер доступен');
    } catch (e) {
        throw e;
    }
}

// Главная функция
async function main() {
    console.log('='.repeat(50));
    console.log('  LIVE HINTS - PERFORMANCE TEST');
    console.log('='.repeat(50));
    console.log(`  STT max latency: ${MAX_STT_LATENCY_MS}ms`);
    console.log(`  LLM max latency: ${MAX_LLM_LATENCY_MS}ms`);
    console.log('='.repeat(50));

    try {
        // Проверка здоровья
        await checkHealth();

        // Тест STT
        const sttResult = await testSTT();

        // Тест LLM с результатом STT
        const llmResult = await testLLM(sttResult.text || 'Тестовый транскрипт для подсказки');

        // Итоги
        const totalLatency = sttResult.latency + llmResult.latency;

        console.log('\n' + '='.repeat(50));
        console.log('  РЕЗУЛЬТАТЫ');
        console.log('='.repeat(50));
        console.log(`  STT latency:   ${sttResult.latency}ms ✓`);
        console.log(`  LLM latency:   ${llmResult.latency}ms ✓`);
        console.log(`  Total latency: ${totalLatency}ms`);
        console.log('='.repeat(50));
        console.log('  ✓ ВСЕ ТЕСТЫ ПРОЙДЕНЫ');
        console.log('='.repeat(50));

        process.exit(0);

    } catch (error) {
        console.error('\n' + '='.repeat(50));
        console.error('  ✗ ТЕСТ ПРОВАЛЕН');
        console.error('='.repeat(50));
        console.error(`  Ошибка: ${error.message}`);
        console.error('='.repeat(50));

        process.exit(1);
    }
}

main();
=======
/**
 * Performance Test - проверка latency пайплайна
 * Запуск: npm run perf
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Конфигурация
const STT_URL = 'ws://localhost:8765';
const LLM_URL = 'http://localhost:8766';
const MAX_STT_LATENCY_MS = 2000;  // Максимальная задержка STT
const MAX_LLM_LATENCY_MS = 5000;  // Максимальная задержка LLM
const SAMPLE_RATE = 16000;

// Генерация тестового аудио (синусоида с речевым паттерном)
function generateTestAudio(durationSec = 2) {
    const samples = durationSec * SAMPLE_RATE;
    const audio = new Float32Array(samples);

    // Генерируем речеподобный сигнал
    for (let i = 0; i < samples; i++) {
        const t = i / SAMPLE_RATE;
        // Основная частота (200Hz) + гармоники
        audio[i] = 0.3 * Math.sin(2 * Math.PI * 200 * t) +
            0.2 * Math.sin(2 * Math.PI * 400 * t) +
            0.1 * Math.sin(2 * Math.PI * 800 * t);
        // Добавляем огибающую
        audio[i] *= 0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t);
    }

    return Buffer.from(audio.buffer);
}

// Тест STT сервера (проверка connectivity)
async function testSTT() {
    return new Promise((resolve, reject) => {
        console.log('\n[PERF] Тест STT сервера (connectivity)...');

        const ws = new WebSocket(STT_URL);
        const startTime = Date.now();

        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error(`STT таймаут подключения (>${MAX_STT_LATENCY_MS}ms)`));
        }, MAX_STT_LATENCY_MS);

        ws.on('open', () => {
            const latency = Date.now() - startTime;
            console.log(`[PERF] STT подключение: ${latency}ms`);
            clearTimeout(timeout);
            ws.close();
            resolve({ latency, text: 'connectivity_ok' });
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(new Error(`STT ошибка: ${err.message}`));
        });
    });
}

// Тест LLM сервера
async function testLLM(text = 'Привет, как дела? Что нового?') {
    console.log('\n[PERF] Тест LLM сервера...');

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            text: text,
            context: []
        });

        const options = {
            hostname: 'localhost',
            port: 8766,
            path: '/hint',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: MAX_LLM_LATENCY_MS + 5000
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const latency = Date.now() - startTime;

                try {
                    const result = JSON.parse(body);
                    console.log(`[PERF] Подсказка получена: "${result.hint?.substring(0, 50)}..." (${latency}ms)`);

                    if (!result.hint) {
                        reject(new Error('LLM не вернул подсказку'));
                    } else if (latency > MAX_LLM_LATENCY_MS) {
                        reject(new Error(`LLM latency слишком высокий: ${latency}ms > ${MAX_LLM_LATENCY_MS}ms`));
                    } else {
                        resolve({ latency, hint: result.hint });
                    }
                } catch (e) {
                    reject(new Error(`LLM ответ невалидный: ${body}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`LLM ошибка: ${e.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`LLM таймаут (>${MAX_LLM_LATENCY_MS}ms)`));
        });

        req.write(data);
        req.end();
    });
}

// Тест здоровья серверов
async function checkHealth() {
    console.log('[PERF] Проверка доступности серверов...');

    // Проверка STT
    try {
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(STT_URL);
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('STT сервер недоступен'));
            }, 3000);

            ws.on('open', () => {
                clearTimeout(timeout);
                ws.close();
                resolve();
            });
            ws.on('error', () => {
                clearTimeout(timeout);
                reject(new Error('STT сервер недоступен'));
            });
        });
        console.log('[PERF] ✓ STT сервер доступен');
    } catch (e) {
        throw e;
    }

    // Проверка LLM
    try {
        await new Promise((resolve, reject) => {
            http.get(`${LLM_URL}/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    reject(new Error('LLM сервер недоступен'));
                }
            }).on('error', () => {
                reject(new Error('LLM сервер недоступен'));
            });
        });
        console.log('[PERF] ✓ LLM сервер доступен');
    } catch (e) {
        throw e;
    }
}

// Главная функция
async function main() {
    console.log('='.repeat(50));
    console.log('  LIVE HINTS - PERFORMANCE TEST');
    console.log('='.repeat(50));
    console.log(`  STT max latency: ${MAX_STT_LATENCY_MS}ms`);
    console.log(`  LLM max latency: ${MAX_LLM_LATENCY_MS}ms`);
    console.log('='.repeat(50));

    try {
        // Проверка здоровья
        await checkHealth();

        // Тест STT
        const sttResult = await testSTT();

        // Тест LLM с результатом STT
        const llmResult = await testLLM(sttResult.text || 'Тестовый транскрипт для подсказки');

        // Итоги
        const totalLatency = sttResult.latency + llmResult.latency;

        console.log('\n' + '='.repeat(50));
        console.log('  РЕЗУЛЬТАТЫ');
        console.log('='.repeat(50));
        console.log(`  STT latency:   ${sttResult.latency}ms ✓`);
        console.log(`  LLM latency:   ${llmResult.latency}ms ✓`);
        console.log(`  Total latency: ${totalLatency}ms`);
        console.log('='.repeat(50));
        console.log('  ✓ ВСЕ ТЕСТЫ ПРОЙДЕНЫ');
        console.log('='.repeat(50));

        process.exit(0);

    } catch (error) {
        console.error('\n' + '='.repeat(50));
        console.error('  ✗ ТЕСТ ПРОВАЛЕН');
        console.error('='.repeat(50));
        console.error(`  Ошибка: ${error.message}`);
        console.error('='.repeat(50));

        process.exit(1);
    }
}

main();
>>>>>>> 19b38e4 (Initial local commit)
