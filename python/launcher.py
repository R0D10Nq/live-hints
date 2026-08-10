"""
Launcher — запускает STT + LLM сервера и открывает Electron Portable GUI.
Запускается напрямую через Python или в составе скомпилированного exe.
"""

import sys, os, subprocess, time, signal, urllib.request

base_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


def find_electron():
    """Возвращает путь к Live Hints.exe — в одном из вариантов упаковки."""
    candidates = [
        # Portable .exe (сформировано electron-builder)
        os.path.join(base_dir, "Live Hints.exe"),
        # Прямой доступ к unpacked архиву (вложенность в app.asar.unpacked)
        next(
            (
                p
                for p in [
                    os.path.join(base_dir, "dist", "win-unpacked", "Live Hints.exe"),
                ]
                if os.path.exists(p)
            ),
            None,
        ),
    ]
    return candidates[0] if candidates else None


def find_python():
    venv_py = os.path.join(os.path.dirname(base_dir), "venv", "Scripts", "python.exe")
    exe_paths = [venv_py, r"C:\Python311\python.exe"]
    for p in exe_paths:
        if os.path.exists(p):
            return p
    return "python"


def start_server(script_name, *args) -> subprocess.Popen | None:
    python_exe = find_python()
    script_path = os.path.join(base_dir, "python", script_name)
    if not os.path.exists(script_path):
        print(f"[Launcher] Не найден {script_name} в {base_dir}")
        return None
    proc = subprocess.Popen(
        [python_exe, script_path, *args],
        cwd=base_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        close_fds=True,
    )
    print(f"[Launcher] Запущен {script_name} — PID {proc.pid}")
    return proc


def wait_for_port(port: int, timeout: int = 30) -> bool:
    for _ in range(int(timeout * 10)):
        try:
            urllib.request.urlopen(f"http://localhost:{port}", timeout=0.2)
            return True
        except Exception:
            time.sleep(0.1)
    return False


def main():
    stt = start_server("stt_server.py", "--mode", "auto")
    llm = start_server("llm_server.py")

    print("[Launcher] Жду STT сервер (порт 8765)...")
    if not wait_for_port(8765, timeout=30):
        print("[Launcher] STT не готов. Запуск GUI всё равно...")

    print("[Launcher] Жду LLM сервер (порт 8766)...")
    if not wait_for_port(8766, timeout=30):
        print("[Launcher] LLM не готов. Продолжаем.")

    electron_exe = find_electron()
    if electron_exe and os.path.exists(electron_exe):
        subprocess.Popen([electron_exe, "--no-sandbox"])
        print(f"[Launcher] GUI открыт: {electron_exe}")
    else:
        print("[Launcher] Live Hints.exe не найден. Запуск через npm start:")
        subprocess.Popen(["npm", "start"], cwd=base_dir)

    def shutdown(signum, frame):
        print("[Launcher] Остановка...")
        for proc in [stt, llm]:
            if proc and proc.poll() is None:
                try:
                    proc.terminate()
                    proc.wait(timeout=3)
                except Exception:
                    if proc.poll() is None:
                        proc.kill()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    for proc in [stt, llm]:
        while proc and proc.poll() is None:
            time.sleep(0.25)


if __name__ == "__main__":
    main()
