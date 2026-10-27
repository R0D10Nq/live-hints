"""
Комплексные модульные тесты для покрытия критических модулей Python >= 85%:
- llm/routes.py
- advanced_rag.py
- vector_db.py
- launcher.py
- stt_server.py
- mic_capture.py
- audio_capture.py
- llm/ollama_client.py
"""

import asyncio
import json
import os
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python"))


# ─── 1. Тесты llm/routes.py ──────────────────────────────────────────────────

class DummyHintReq:
    def __init__(
        self,
        text="Расскажи про декораторы в Python",
        context=None,
        model=None,
        profile="interview",
        max_tokens=200,
        temperature=0.5,
        system_prompt=None,
        user_context=None,
    ):
        self.text = text
        self.context = context or ["Контекст"]
        self.model = model
        self.profile = profile
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.system_prompt = system_prompt
        self.user_context = user_context


class DummyVisionReq:
    def __init__(self, image_base64="aGVsbG8=", model=None):
        self.image_base64 = image_base64
        self.model = model


@pytest.mark.asyncio
async def test_llm_router_all_endpoints():
    from llm.routes import LLMRouter

    ollama = MagicMock()
    ollama.model = "qwen2.5:7b"
    ollama.profile = "interview"
    ollama.base_url = "http://localhost:11434"
    ollama._last_question_type = "general"
    ollama._check_available.return_value = True
    ollama.generate.return_value = "Декоратор — это обёртка функции"
    ollama.metrics.get_stats.return_value = {"total_ms": 120, "ttft_ms": 40}
    ollama.list_models.return_value = ["qwen2.5:7b"]

    async def fake_stream(*args, **kwargs):
        yield "Чанк 1 "
        yield "Чанк 2"

    ollama.generate_stream = fake_stream

    cache = MagicMock()
    cache.get.return_value = None

    router = LLMRouter(MagicMock(), ollama, cache)

    # health
    res = await router.health()
    assert res["status"] == "ok"

    # generate_hint short text error
    with pytest.raises(HTTPException) as exc:
        await router.generate_hint(DummyHintReq(text="abc"))
    assert exc.value.status_code == 400

    # generate_hint valid with model and profile override
    hint_resp = await router.generate_hint(
        DummyHintReq(model="llama3:8b", profile="coding")
    )
    assert hint_resp.hint == "Декоратор — это обёртка функции"
    assert ollama.model == "qwen2.5:7b"
    assert ollama.profile == "interview"

    # generate_hint_stream short text
    with pytest.raises(HTTPException):
        await router.generate_hint_stream(DummyHintReq(text=" "))

    # generate_hint_stream uncached
    stream_resp = await router.generate_hint_stream(
        DummyHintReq(model="llama3:8b", profile="coding")
    )
    chunks = []
    async for item in stream_resp.body_iterator:
        chunks.append(item)
    assert any("Чанк 1" in c for c in chunks)
    assert any('"done": true' in c for c in chunks)

    # generate_hint_stream cached
    cache.get.return_value = "Из кэша"
    stream_cached = await router.generate_hint_stream(DummyHintReq())
    cached_chunks = [c async for c in stream_cached.body_iterator]
    assert any("Из кэша" in c for c in cached_chunks)

    # clear_cache ok & error
    res_clear = await router.clear_cache()
    assert res_clear["status"] == "ok"

    cache.clear.side_effect = RuntimeError("fail")
    res_clear_err = await router.clear_cache()
    assert res_clear_err["status"] == "error"

    # get_models ok & error
    models_ok = await router.get_models()
    assert models_ok["models"] == ["qwen2.5:7b"]

    ollama.list_models.side_effect = RuntimeError("fail")
    models_err = await router.get_models()
    assert "error" in models_err

    # switch_model ok & error
    sw_ok = await router.switch_model("qwen3:8b")
    assert sw_ok["status"] == "switched"

    class BrokenOllama:
        @property
        def model(self):
            return "x"

        @model.setter
        def model(self, val):
            raise RuntimeError("broken")

    router.ollama = BrokenOllama()
    with pytest.raises(HTTPException) as exc_sw:
        await router.switch_model("bad")
    assert exc_sw.value.status_code == 500

    # analyze_vision
    with pytest.raises(HTTPException) as exc_vis:
        await router.analyze_vision(DummyVisionReq(image_base64=""))
    assert exc_vis.value.status_code == 400

    with patch("llm.analyze_image", new=MagicMock(return_value="Анализ кода")), patch(
        "llm.get_available_vision_model", new=MagicMock(return_value="llava")
    ):
        vis_ok = await router.analyze_vision(DummyVisionReq())
        assert vis_ok.analysis == "Анализ кода"

    with patch("llm.analyze_image", new=MagicMock(side_effect=RuntimeError("vision fail"))), patch(
        "llm.get_available_vision_model", new=MagicMock(return_value="llava")
    ):
        with pytest.raises(HTTPException) as exc_vis500:
            await router.analyze_vision(DummyVisionReq())
        assert exc_vis500.value.status_code == 500


# ─── 2. Тесты advanced_rag.py ────────────────────────────────────────────────

def test_advanced_rag_comprehensive(tmp_path, monkeypatch):
    import advanced_rag

    user_ctx_file = tmp_path / "user_context.txt"
    session_mem_file = tmp_path / "data" / "session_memory.json"
    user_ctx_file.write_text(
        "Опыт работы с Python, FastAPI и Docker более 5 лет.\n"
        + ("Длинное предложение про микросервисную архитектуру и высокую нагрузку. " * 10)
        + "\nРазработка распределённых систем и оптимизация SQL баз данных.",
        encoding="utf-8",
    )

    monkeypatch.setattr(advanced_rag, "USER_CONTEXT_PATH", user_ctx_file)
    monkeypatch.setattr(advanced_rag, "SESSION_MEMORY_PATH", session_mem_file)

    fake_model = MagicMock()
    fake_model.encode.return_value = np.array([1.0, 0.5, 0.2], dtype=np.float32)

    with patch(
        "semantic_cache._get_shared_embedding_model", return_value=fake_model
    ):
        rag = advanced_rag.AdvancedRAG()

    assert rag._model_loaded is True
    assert len(rag.fallback_documents) > 0

    chunks = rag._smart_chunk(user_ctx_file.read_text(encoding="utf-8"), chunk_size=120, overlap=20)
    assert len(chunks) >= 2

    assert rag._classify_complexity("Как спроектировать архитектуру системы?", []) == "complex"
    assert rag._classify_complexity("Что такое GIL в Python?", []) == "simple"
    assert rag._classify_complexity("Обычный вопрос", ["1", "2", "3", "4", "5", "6"]) == "medium"
    assert rag._classify_complexity("Обычный вопрос", ["1"]) == "simple"

    assert rag._get_context_window_size("simple") == advanced_rag.CONTEXT_SIMPLE
    assert rag._get_context_window_size("complex") == advanced_rag.CONTEXT_COMPLEX

    results = rag.retrieve("Опыт работы с Python и FastAPI", top_k=2)
    assert len(results) >= 1

    mock_col = MagicMock()
    mock_col.query.return_value = {
        "documents": [["Опыт с Python и FastAPI в продакшене"]],
        "distances": [[0.1]],
        "metadatas": [[{"source": "resume"}]],
    }
    mock_col.get.return_value = {"ids": ["old_1"]}
    rag.collection = mock_col
    rag._load_user_context()
    mock_col.delete.assert_called_once()
    mock_col.add.assert_called()

    col_results = rag.retrieve("Python FastAPI", top_k=2)
    assert len(col_results) == 1

    rag.consolidate_memory("Вопрос про python, docker и sql", "Ответ", "technical")
    assert "python" in rag.session_memory.discussed_topics
    assert session_mem_file.exists()

    rag._load_session_memory()
    assert "docker" in rag.session_memory.discussed_topics

    prompt = rag.build_enhanced_prompt(
        "Расскажи про опыт с Python",
        ["контекст 1", "контекст 2"],
        "experience",
        "Базовый промпт",
    )
    assert "РЕЛЕВАНТНАЯ ИНФОРМАЦИЯ ИЗ РЕЗЮМЕ" in prompt
    assert "Обсуждённые темы" in prompt

    adaptive = rag.get_adaptive_context(["a", "b", "c", "d", "e"], "Что такое GIL?")
    assert len(adaptive) == 3

    rag.clear_session_memory()
    assert not session_mem_file.exists()

    fake_model.encode.side_effect = RuntimeError("encode error")
    assert rag._get_embedding("тест") is None


# ─── 3. Тесты vector_db.py ───────────────────────────────────────────────────

def test_vector_db_with_mocked_collection(tmp_path, monkeypatch):
    import vector_db

    q_file = tmp_path / "questions_db.json"
    q_file.write_text(
        json.dumps(
            {
                "questions": [
                    {
                        "id": "1",
                        "question": "Что такое замыкание?",
                        "answer": "Функция, запоминающая лексическое окружение.",
                        "category": "python",
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(vector_db, "QUESTIONS_PATH", q_file)

    db = vector_db.VectorDB()
    assert db.search("тест") == []
    assert db.add("вопрос", "ответ") is False
    assert db.load_prepared_questions() == 0
    assert db.count == 0

    db._initialized = True
    mock_col = MagicMock()
    mock_client = MagicMock()
    db.collection = mock_col
    db.client = mock_client

    mock_col.query.return_value = {
        "ids": [["id1", "id2"]],
        "documents": [["Что такое GIL?", "Что такое декоратор?"]],
        "metadatas": [
            [
                {"answer": "Global Interpreter Lock", "category": "python"},
                {"answer": "Обёртка", "category": "python"},
            ]
        ],
        "distances": [[0.05, 0.25]],
    }
    res = db.search("Что такое GIL?")
    assert len(res) == 2
    assert db.get_instant_answer("Что такое GIL?") == "Global Interpreter Lock"
    ctx_ans = db.get_context_answers("Что такое GIL?")
    assert len(ctx_ans) == 1

    mock_col.query.return_value = {"ids": [[]]}
    assert db.search("нет") == []
    assert db.get_instant_answer("нет") is None

    mock_col.query.side_effect = RuntimeError("db err")
    assert db.search("ошибка") == []

    assert db.add_session_qa("Вопрос", "Ответ") is True
    mock_col.add.side_effect = RuntimeError("add err")
    assert db.add("Вопрос", "Ответ") is False
    mock_col.add.side_effect = None

    mock_col.get.return_value = {"ids": []}
    assert db.load_prepared_questions() == 1
    mock_col.get.return_value = {"ids": ["prepared_1"]}
    assert db.load_prepared_questions() == 0

    mock_col.count.return_value = 5
    assert db.count == 5
    db.clear()
    mock_client.delete_collection.assert_called_once_with("interview_qa")


# ─── 4. Тесты launcher.py ────────────────────────────────────────────────────

def test_launcher_functions(monkeypatch):
    import launcher

    assert launcher.find_electron() is not None
    assert isinstance(launcher.find_python(), str)

    monkeypatch.setattr(os.path, "exists", lambda p: False)
    assert launcher.start_server("missing.py") is None

    monkeypatch.setattr(os.path, "exists", lambda p: True)
    mock_proc = MagicMock()
    mock_proc.pid = 1234
    mock_proc.poll.return_value = 0
    with patch("subprocess.Popen", return_value=mock_proc):
        proc = launcher.start_server("stt_server.py")
        assert proc is mock_proc

    with patch("socket.create_connection", return_value=MagicMock()):
        assert launcher.wait_for_port(8765, timeout=1) is True

    with patch("socket.create_connection", side_effect=OSError("refused")), patch(
        "time.sleep"
    ):
        assert launcher.wait_for_port(8765, timeout=0.1) is False

    with patch.object(launcher, "start_server", return_value=mock_proc), patch.object(
        launcher, "wait_for_port", return_value=True
    ), patch("subprocess.Popen", return_value=mock_proc), patch(
        "signal.signal"
    ) as sig_mock:
        launcher.main()
        assert sig_mock.call_count == 2
        shutdown_fn = sig_mock.call_args_list[0][0][1]
        mock_proc.poll.return_value = None
        shutdown_fn(2, None)
        mock_proc.terminate.assert_called()


# ─── 5. Тесты stt_server.py ──────────────────────────────────────────────────

class FakeWebSocket:
    def __init__(self, messages=None):
        self.messages = list(messages or [])
        self.sent = []
        self.closed = False

    async def send(self, data):
        self.sent.append(json.loads(data))

    async def close(self, code=1000, reason=""):
        self.closed = True

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.messages:
            raise StopAsyncIteration
        msg = self.messages.pop(0)
        if isinstance(msg, Exception):
            raise msg
        return msg


@pytest.mark.asyncio
async def test_stt_server_full():
    from stt_server import DynamicSTTServer

    with pytest.raises(ValueError):
        DynamicSTTServer(mode="loopback", port=70000)

    srv = DynamicSTTServer(mode="loopback", port=8765)

    with patch("stt_server.StreamingTranscriber") as mock_tr_cls:
        mock_tr = MagicMock()
        mock_tr.model_name = "small"
        mock_tr.add_audio.return_value = True
        mock_tr.transcribe.return_value = "Распознанный текст"
        mock_tr.metrics.get_latency_ms.return_value = 55
        mock_tr_cls.return_value = mock_tr
        srv.init_model()
        assert srv.transcriber is mock_tr

    with patch("stt_server.DynamicAudioCapture") as mock_cap_cls, patch(
        "threading.Thread"
    ) as mock_thread:
        mock_cap = MagicMock()
        mock_cap_cls.return_value = mock_cap
        srv.start_audio_capture()
        mock_cap.start.assert_called_once()
        mock_thread.return_value.start.assert_called_once()

        srv.running = True
        srv.loop = asyncio.get_running_loop()
        ws_client = FakeWebSocket()
        srv.clients.add(ws_client)

        def get_chunk_once(timeout=0.1):
            srv.running = False
            return np.zeros(1024, dtype=np.int16)

        mock_cap.get_audio_chunk.side_effect = get_chunk_once
        srv._audio_processing_loop()
        await asyncio.sleep(0.05)

        srv.stop_audio_capture()
        assert srv.audio_capture is None

    ws = FakeWebSocket([json.dumps({"type": "get_status"}), "{invalid_json"])
    await srv.handle_client(ws)
    assert len(ws.sent) == 2
    assert ws.sent[0]["type"] == "status"
    assert ws.sent[1]["model"] == "small"

    ws2 = FakeWebSocket()
    srv.clients.add(ws2)
    srv._shutdown_event = asyncio.Event()
    await srv.stop_server()
    assert ws2.closed is True


# ─── 6. Тесты mic_capture.py ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mic_capture_full():
    from mic_capture import MicrophoneCapture

    mic = MicrophoneCapture(device_index=0)
    mic.set_muted(True)
    assert mic.muted is True
    mic.set_muted(False)
    mic.switch_device(1)
    assert mic.device_index == 1

    fake_pyaudio = types.ModuleType("pyaudiowpatch")
    fake_pyaudio.paFloat32 = 1
    mock_pa_inst = MagicMock()
    mock_pa_inst.get_device_count.return_value = 1
    mock_pa_inst.get_device_info_by_index.return_value = {
        "index": 0,
        "name": "Test Mic",
        "maxInputChannels": 2,
        "defaultSampleRate": 16000,
    }
    mock_stream = MagicMock()

    def read_once(*args, **kwargs):
        mic.stop()
        return np.zeros(1024, dtype=np.float32).tobytes()

    mock_stream.read.side_effect = read_once
    mock_pa_inst.open.return_value = mock_stream
    fake_pyaudio.PyAudio = MagicMock(return_value=mock_pa_inst)

    with patch.dict(sys.modules, {"pyaudiowpatch": fake_pyaudio}):
        devs = mic.list_devices()
        assert len(devs) == 1
        assert devs[0]["name"] == "Test Mic"

        mic.ws = AsyncMock()
        mic.running = True
        await mic._capture_pyaudio(fake_pyaudio)
        mic.ws.send.assert_called_once()

    # _capture_sounddevice
    fake_sd = types.ModuleType("sounddevice")
    fake_sd.default = MagicMock()
    fake_sd.default.device = [0, 0]
    fake_sd.query_devices = MagicMock(
        return_value={"name": "SD Mic", "max_input_channels": 1, "default_samplerate": 16000}
    )

    class FakeInputStream:
        def __init__(self, **kwargs):
            self.cb = kwargs.get("callback")

        def __enter__(self):
            if self.cb:
                self.cb(np.zeros((16, 1), dtype=np.float32), 16, None, "status")
            mic.running = False
            return self

        def __exit__(self, *args):
            pass

    fake_sd.InputStream = FakeInputStream
    mic.ws = AsyncMock()
    mic.running = True
    await mic._capture_sounddevice(fake_sd)


# ─── 7. Тесты audio_capture.py ───────────────────────────────────────────────

def test_audio_capture_functions(monkeypatch):
    import audio_capture

    monkeypatch.setattr(sys, "argv", ["audio_capture.py", "--mode=loopback"])
    args = audio_capture.parse_args()
    assert args.mode == "loopback"

    fake_pyaudio = types.ModuleType("pyaudiowpatch")
    fake_pyaudio.paFloat32 = 1
    fake_pyaudio.paContinue = 0
    fake_pyaudio.paComplete = 1

    mock_pa = MagicMock()
    mock_pa.get_device_count.return_value = 1
    mock_pa.get_device_info_by_index.return_value = {
        "index": 0,
        "name": "Loopback Speaker",
        "isLoopbackDevice": True,
        "defaultSampleRate": 48000,
        "maxInputChannels": 2,
        "maxOutputChannels": 2,
    }
    mock_pa.get_default_input_device_info.return_value = {
        "index": 0,
        "name": "Default Mic",
        "defaultSampleRate": 48000,
        "maxInputChannels": 2,
    }

    captured_cb = {}

    def open_stream(**kwargs):
        captured_cb["cb"] = kwargs.get("stream_callback")
        s = MagicMock()
        s.is_active.side_effect = [True, False]
        return s

    mock_pa.open.side_effect = open_stream
    fake_pyaudio.PyAudio = MagicMock(return_value=mock_pa)

    fake_stdout = MagicMock()
    fake_stdout.buffer = MagicMock()
    monkeypatch.setattr(sys, "stdout", fake_stdout)

    with patch.dict(sys.modules, {"pyaudiowpatch": fake_pyaudio}), patch("time.sleep"):
        audio_capture.list_audio_devices()
        audio_capture.capture_wasapi_loopback()
        raw = np.zeros(2048, dtype=np.float32).tobytes()
        res = captured_cb["cb"](raw, 1024, None, 0)
        assert res[1] == fake_pyaudio.paContinue

        audio_capture.capture_microphone(device_index=0)
        res2 = captured_cb["cb"](raw, 1024, None, 1)
        assert res2[1] == fake_pyaudio.paContinue

    # capture_fallback
    fake_sd = types.ModuleType("sounddevice")
    fake_sd.CallbackAbort = RuntimeError
    fake_sd.default = MagicMock()
    fake_sd.default.device = [0, 0]
    fake_sd.query_devices = MagicMock(
        side_effect=lambda dev=None: (
            [{"name": "Loopback Mix"}] if dev is None else {"name": "Loopback Mix"}
        )
    )

    class FakeSDStream:
        def __init__(self, **kwargs):
            self.cb = kwargs.get("callback")

        def __enter__(self):
            if self.cb:
                self.cb(np.zeros((64, 1), dtype=np.float32), 64, None, "ok")
            raise RuntimeError("stop loop")

        def __exit__(self, *args):
            pass

    fake_sd.InputStream = FakeSDStream
    with patch.dict(sys.modules, {"sounddevice": fake_sd}):
        audio_capture.capture_fallback(mode="loopback")


# ─── 8. Тесты llm/ollama_client.py ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_ollama_client_provider_and_stream():
    from cache import HintCache
    from llm.ollama_client import OllamaClient

    with patch.object(OllamaClient, "_check_available", return_value=True):
        client = OllamaClient(
            base_url="http://localhost:11434",
            model="qwen2.5:7b",
            hint_cache=HintCache(),
        )

    # Provider generate success & error
    mock_prov = MagicMock()
    mock_prov.generate.return_value = "Ответ от облачного провайдера"
    mock_prov.generate_stream.return_value = iter(["Токен 1 ", "Токен 2"])
    client.provider = mock_prov
    client.hint_cache.clear()

    ans = client.generate("Уникальный вопрос для провайдера 12345")
    assert ans == "Ответ от облачного провайдера"

    mock_prov.generate.side_effect = RuntimeError("cloud error")
    ans_err = client.generate("Другой уникальный вопрос 67890")
    assert "Ошибка:" in ans_err

    # Provider generate_stream success & error
    chunks = []
    async for ch in client.generate_stream(
        "Стрим вопрос провайдеру 111",
        temperature="0.7",
        custom_system_prompt="Доп промпт",
    ):
        chunks.append(ch)
    assert "".join(chunks) == "Токен 1 Токен 2"

    mock_prov.generate_stream.side_effect = RuntimeError("stream error")
    err_chunks = [
        ch
        async for ch in client.generate_stream(
            "Стрим вопрос с ошибкой 222", temperature="invalid"
        )
    ]
    assert any("Ошибка:" in c for c in err_chunks)
