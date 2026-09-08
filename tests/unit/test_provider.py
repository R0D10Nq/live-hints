"""
Тесты для LLM провайдеров (OllamaProvider, OpenAICompatibleProvider, HybridProvider).
"""

import json
from unittest.mock import MagicMock, patch
import pytest

from llm.provider import (
    BaseLLMProvider,
    OllamaProvider,
    OpenAICompatibleProvider,
    HybridProvider,
    create_hybrid_provider,
)


class DummyMockProvider(BaseLLMProvider):
    """Тестовый мок-провайдер"""

    def __init__(self, name: str = "mock-model", should_fail: bool = False):
        self.name = name
        self.should_fail = should_fail
        self.call_count = 0
        self.stream_call_count = 0

    def get_model_name(self) -> str:
        return self.name

    def check_available(self) -> bool:
        return not self.should_fail

    def generate(self, messages, max_tokens=150, temperature=0.7) -> str:
        self.call_count += 1
        if self.should_fail:
            raise RuntimeError("Primary cloud provider connection timeout")
        return f"Response from {self.name}"

    def generate_stream(self, messages, max_tokens=150, temperature=0.7):
        self.stream_call_count += 1
        if self.should_fail:
            raise RuntimeError("Primary cloud provider stream broken")
        yield f"Chunk 1 from {self.name}"
        yield f"Chunk 2 from {self.name}"


# ==================== OLLAMA PROVIDER ====================


def test_ollama_provider_get_model_name():
    provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")
    assert provider.get_model_name() == "qwen3:8b"


def test_ollama_provider_check_available_success():
    provider = OllamaProvider(base_url="http://localhost:11434")
    with patch("httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_client.__enter__.return_value.get.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        assert provider.check_available() is True


def test_ollama_provider_check_available_failure():
    provider = OllamaProvider(base_url="http://localhost:11434")
    with patch("httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.__enter__.return_value.get.side_effect = Exception("Connection refused")
        mock_client_cls.return_value = mock_client

        assert provider.check_available() is False


def test_ollama_provider_generate():
    provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")
    with patch("httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"message": {"content": "Тестовая подсказка"}}
        mock_client.__enter__.return_value.post.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        result = provider.generate([{"role": "user", "content": "Привет"}])
        assert result == "Тестовая подсказка"


def test_ollama_provider_generate_stream():
    provider = OllamaProvider(base_url="http://localhost:11434", model="qwen3:8b")
    with patch("httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.iter_lines.return_value = [
            json.dumps({"message": {"content": "Пункт 1\n"}}),
            "",
            json.dumps({"message": {"content": "Пункт 2"}}),
        ]
        mock_client.__enter__.return_value.stream.return_value.__enter__.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        chunks = list(provider.generate_stream([{"role": "user", "content": "Привет"}]))
        assert chunks == ["Пункт 1\n", "Пункт 2"]


# ==================== OPENAI COMPATIBLE PROVIDER ====================


def test_openai_compatible_provider_no_key():
    provider = OpenAICompatibleProvider(api_key="", base_url="https://api.groq.com/openai/v1")
    assert provider.check_available() is False


def test_openai_compatible_provider_check_available():
    provider = OpenAICompatibleProvider(
        api_key="test-key", base_url="https://api.groq.com/openai/v1"
    )
    with patch("httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_client.__enter__.return_value.get.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        assert provider.check_available() is True


def test_openai_compatible_provider_generate():
    provider = OpenAICompatibleProvider(
        api_key="test-key",
        base_url="https://api.groq.com/openai/v1",
        model="llama-3.3-70b-versatile",
    )
    with patch("httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "Быстрый ответ из облака"}}]
        }
        mock_client.__enter__.return_value.post.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        result = provider.generate([{"role": "user", "content": "Вопрос"}])
        assert result == "Быстрый ответ из облака"


def test_openai_compatible_provider_generate_stream():
    provider = OpenAICompatibleProvider(
        api_key="test-key",
        base_url="https://api.groq.com/openai/v1",
        model="llama-3.3-70b-versatile",
    )
    with patch("httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.iter_lines.return_value = [
            'data: {"choices": [{"delta": {"content": "Часть 1"}}]}',
            "",
            'data: {"choices": [{"delta": {"content": " и Часть 2"}}]}',
            "data: [DONE]",
        ]
        mock_client.__enter__.return_value.stream.return_value.__enter__.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        chunks = list(provider.generate_stream([{"role": "user", "content": "Вопрос"}]))
        assert chunks == ["Часть 1", " и Часть 2"]


# ==================== HYBRID PROVIDER ====================


def test_hybrid_provider_local_mode():
    fallback = DummyMockProvider("ollama-local")
    primary = DummyMockProvider("cloud-fast")
    hybrid = HybridProvider(fallback_provider=fallback, primary_provider=primary, mode="local")

    assert hybrid.get_model_name() == "ollama-local"
    assert hybrid.check_available() is True

    result = hybrid.generate([{"role": "user", "content": "Тест"}])
    assert result == "Response from ollama-local"
    assert hybrid.last_source == "local"
    assert fallback.call_count == 1
    assert primary.call_count == 0


def test_hybrid_provider_cloud_success():
    fallback = DummyMockProvider("ollama-local")
    primary = DummyMockProvider("cloud-fast")
    hybrid = HybridProvider(fallback_provider=fallback, primary_provider=primary, mode="hybrid")

    result = hybrid.generate([{"role": "user", "content": "Тест"}])
    assert result == "Response from cloud-fast"
    assert hybrid.last_source == "cloud"
    assert primary.call_count == 1
    assert fallback.call_count == 0


def test_hybrid_provider_fallback_on_cloud_failure():
    fallback = DummyMockProvider("ollama-local")
    primary = DummyMockProvider("cloud-fast", should_fail=True)
    hybrid = HybridProvider(fallback_provider=fallback, primary_provider=primary, mode="hybrid")

    result = hybrid.generate([{"role": "user", "content": "Тест"}])
    # Успешный прозрачный fallback на локальную Ollama
    assert result == "Response from ollama-local"
    assert hybrid.last_source == "ollama_fallback"
    assert primary.call_count == 1
    assert fallback.call_count == 1


def test_hybrid_provider_cloud_only_mode_raises():
    fallback = DummyMockProvider("ollama-local")
    primary = DummyMockProvider("cloud-fast", should_fail=True)
    hybrid = HybridProvider(fallback_provider=fallback, primary_provider=primary, mode="cloud")

    with pytest.raises(RuntimeError):
        hybrid.generate([{"role": "user", "content": "Тест"}])


def test_hybrid_provider_stream_fallback():
    fallback = DummyMockProvider("ollama-local")
    primary = DummyMockProvider("cloud-fast", should_fail=True)
    hybrid = HybridProvider(fallback_provider=fallback, primary_provider=primary, mode="hybrid")

    chunks = list(hybrid.generate_stream([{"role": "user", "content": "Тест"}]))
    assert hybrid.last_source == "ollama_fallback"
    assert chunks == ["Chunk 1 from ollama-local", "Chunk 2 from ollama-local"]


def test_hybrid_provider_get_status():
    fallback = DummyMockProvider("ollama-local")
    primary = DummyMockProvider("cloud-fast")
    hybrid = HybridProvider(fallback_provider=fallback, primary_provider=primary, mode="hybrid")

    status = hybrid.get_status()
    assert status["mode"] == "hybrid"
    assert status["cloud_available"] is True
    assert status["local_available"] is True


def test_create_hybrid_provider_factory():
    # Без ключа: primary is None
    provider_no_key = create_hybrid_provider(api_key="")
    assert provider_no_key.primary_provider is None
    assert provider_no_key.mode == "hybrid"

    # С ключом: primary is OpenAICompatibleProvider
    provider_with_key = create_hybrid_provider(
        api_key="mock-api-key",
        cloud_base_url="https://api.groq.com/openai/v1",
        cloud_model="llama-3.3-70b-versatile",
    )
    assert provider_with_key.primary_provider is not None
    assert provider_with_key.primary_provider.get_model_name() == "llama-3.3-70b-versatile"
