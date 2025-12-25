const { spawn } = require('child_process');
const path = require('path');

const electronPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const appPath = path.join(__dirname, '..');

console.log('Запуск Electron:', electronPath);
console.log('Путь к приложению:', appPath);

const proc = spawn(electronPath, [appPath], {
    stdio: 'inherit',
    shell: false
});

proc.on('error', (err) => {
    console.error('Ошибка запуска:', err);
});

proc.on('close', (code) => {
    console.log('Electron завершён с кодом:', code);
});
