"""
Модуль провайдеров LLM для Live Hints.
Реализует BaseLLMProvider, OllamaProvider, OpenAICompatibleProvider и HybridProvider
с поддержкой прозрачного автоматического переключения при сбоях.
"""

from abc import ABC, abstractmethod
import json
import logging
import os
from typing import Generator, Optional, Dict, Any, List

import httpx

logger = logging.getLogger("LLM.Provider")


class BaseLLMProvider(ABC):
    """Абстрактный базовый класс провайдера языковой модели."""

    @abstractmethod
    def generate(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 150,
        temperature: float = 0.7,
    ) -> str:
        """Синхронная генерация полного ответа."""
        pass

    @abstractmethod
    def generate_stream(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 150,
        temperature: float = 0.7,
    ) -> Generator[str, None, None]:
        """Потоковая генерация ответа по токенам/чанкам."""
        pass

    @abstractmethod
    def check_available(self) -> bool:
        """Проверка доступности сервиса инференса."""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Имя активной модели."""
        pass


class OllamaProvider(BaseLLMProvider):
    """Провайдер для локального инференса через Ollama API."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "qwen3:8b",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def get_model_name(self) -> str:
        return self.model

    def check_available(self) -> bool:
        """Проверка ответа эндпоинта Ollama tags."""
        try:
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception as e:
            logger.debug(f"[Ollama] Проверка доступности не удалась: {e}")
            return False

    def generate(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 150,
        temperature: float = 0.7,
    ) -> str:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
            },
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "").strip()

    def generate_stream(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 150,
        temperature: float = 0.7,
    ) -> Generator[str, None, None]:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
            },
        }
        with httpx.Client(timeout=self.timeout) as client:
            with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    Провайдер для сверхбыстрых облачных API со стандартным форматом OpenAI:
    Groq (LPU), Cerebras, Gemini Flash (через openai/v1), OpenRouter, Together.
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.groq.com/openai/v1",
        model: str = "llama-3.3-70b-versatile",
        timeout: float = 8.0,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def get_model_name(self) -> str:
        return self.model

    def check_available(self) -> bool:
        """Проверка наличия ключа и ответа API."""
        if not self.api_key:
            return False
        try:
            headers = {"Authorization": f"Bearer {self.api_key}"}
            with httpx.Client(timeout=3.0) as client:
                resp = client.get(f"{self.base_url}/models", headers=headers)
                return resp.status_code == 200
        except Exception as e:
            logger.debug(f"[CloudProvider] Проверка доступности не удалась: {e}")
            return False

    def generate(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 150,
        temperature: float = 0.7,
    ) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "").strip()
            return ""

    def generate_stream(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 150,
        temperature: float = 0.7,
    ) -> Generator[str, None, None]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }
        with httpx.Client(timeout=self.timeout) as client:
            with client.stream("POST", url, headers=headers, json=payload) as response:
                response.raise_for_status()
                for raw_line in response.iter_lines():
                    line = raw_line.strip()
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            choices = chunk.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue


class HybridProvider(BaseLLMProvider):
    """
    Интеллектуальный гибридный провайдер:
    - Отправляет запрос в быстрый облачный провайдер (Groq/Gemini/Cerebras).
    - При отсутствии ключа, ошибке сети, квоты или таймауте выполняет
      мгновенный и прозрачный fallback на локальную Ollama.
    """

    def __init__(
        self,
        fallback_provider: BaseLLMProvider,
        primary_provider: Optional[BaseLLMProvider] = None,
        mode: str = "hybrid",
    ):
        self.fallback_provider = fallback_provider
        self.primary_provider = primary_provider
        self.mode = mode.lower()  # 'local', 'hybrid', 'cloud'
        self.last_source = "none"

    def get_model_name(self) -> str:
        if self.mode == "cloud" and self.primary_provider:
            return self.primary_provider.get_model_name()
        if self.mode == "hybrid" and self.primary_provider:
            return f"{self.primary_provider.get_model_name()} (hybrid)"
        return self.fallback_provider.get_model_name()

    def check_available(self) -> bool:
        if self.mode == "cloud":
            return bool(self.primary_provider and self.primary_provider.check_available())
        if self.mode == "local":
            return self.fallback_provider.check_available()
        # В режиме hybrid сервис доступен, если доступен хотя бы один провайдер
        return bool(
            (self.primary_provider and self.primary_provider.check_available())
            or self.fallback_provider.check_available()
        )

    def get_status(self) -> Dict[str, Any]:
        """Детальный статус доступности провайдеров."""
        cloud_ok = bool(self.primary_provider and self.primary_provider.check_available())
        local_ok = bool(self.fallback_provider and self.fallback_provider.check_available())
        return {
            "mode": self.mode,
            "active_model": self.get_model_name(),
            "last_source": self.last_source,
            "cloud_available": cloud_ok,
            "local_available": local_ok,
        }

    def generate(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 150,
        temperature: float = 0.7,
    ) -> str:
        if self.mode == "local" or not self.primary_provider:
            self.last_source = "local"
            return self.fallback_provider.generate(messages, max_tokens, temperature)

        try:
            self.last_source = "cloud"
            return self.primary_provider.generate(messages, max_tokens, temperature)
        except Exception as err:
            logger.warning(
                f"[HybridProvider] Ошибка облачного провайдера: {err}. "
                f"Переключение на локальный fallback..."
            )
            if self.mode == "cloud":
                raise err
            self.last_source = "ollama_fallback"
            return self.fallback_provider.generate(messages, max_tokens, temperature)

    def generate_stream(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 150,
        temperature: float = 0.7,
    ) -> Generator[str, None, None]:
        if self.mode == "local" or not self.primary_provider:
            self.last_source = "local"
            yield from self.fallback_provider.generate_stream(messages, max_tokens, temperature)
            return

        try:
            self.last_source = "cloud"
            cloud_gen = self.primary_provider.generate_stream(messages, max_tokens, temperature)
            # Получаем первый токен для проверки отсутствия ошибок инициализации стрима
            first_chunk = next(cloud_gen)
            yield first_chunk
            yield from cloud_gen
        except Exception as err:
            logger.warning(
                f"[HybridProvider] Ошибка облачного стрима: {err}. "
                f"Переключение на локальный fallback..."
            )
            if self.mode == "cloud":
                raise err
            self.last_source = "ollama_fallback"
            yield from self.fallback_provider.generate_stream(messages, max_tokens, temperature)


def create_hybrid_provider(
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "qwen3:8b",
    mode: Optional[str] = None,
    api_key: Optional[str] = None,
    cloud_base_url: Optional[str] = None,
    cloud_model: Optional[str] = None,
) -> HybridProvider:
    """Фабричная функция создания настроенного HybridProvider из конфигурации."""
    active_mode = mode or os.getenv("LLM_PROVIDER", "hybrid").lower()
    active_api_key = api_key or os.getenv("CLOUD_LLM_API_KEY", "")
    active_cloud_url = (
        cloud_base_url
        or os.getenv("CLOUD_LLM_BASE_URL", "https://api.groq.com/openai/v1")
    )
    active_cloud_model = (
        cloud_model
        or os.getenv("CLOUD_LLM_MODEL", "llama-3.3-70b-versatile")
    )

    ollama_prov = OllamaProvider(base_url=ollama_url, model=ollama_model)

    cloud_prov = None
    if active_api_key:
        cloud_prov = OpenAICompatibleProvider(
            api_key=active_api_key,
            base_url=active_cloud_url,
            model=active_cloud_model,
        )
    else:
        logger.info(
            "[ProviderFactory] CLOUD_LLM_API_KEY не задан. "
            "HybridProvider будет использовать локальный fallback."
        )

    return HybridProvider(
        fallback_provider=ollama_prov,
        primary_provider=cloud_prov,
        mode=active_mode,
    )
