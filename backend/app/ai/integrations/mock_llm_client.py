import json
from collections.abc import AsyncGenerator
from typing import Optional

from app.ai.integrations.base import LLMClient
from app.core.logging import get_logger

logger = get_logger(__name__)


MOCK_USER_MODEL_JSON = json.dumps({
    "version": 1,
    "baseline": {
        "emotionalTone": "reflective",
        "thinkingStyle": "explorative",
        "selfFocus": "balanced",
        "confidence": 0.3
    },
    "patterns": [],
    "activeThemes": [],
    "conversationGuidelines": [
        "respond with warmth and encouragement",
        "offer reflective questions about patterns"
    ]
})


class MockLLMClient(LLMClient):
    """Mock LLM client for testing without API calls."""

    def __init__(self):
        logger.info("mock_llm_client_initialized")

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.7
    ) -> str:
        """Generate mock completion."""
        logger.info("mock_generate", has_system_prompt=bool(system_prompt))

        if self._is_user_model_update(prompt):
            return MOCK_USER_MODEL_JSON

        return (
            "I notice a theme of growth and self-awareness in your recent entries. "
            "You're becoming more attuned to your emotional responses and what triggers them. "
            "This awareness is the foundation of emotional intelligence. "
            "Keep exploring these feelings with curiosity and compassion."
        )

    def _is_user_model_update(self, prompt: str) -> bool:
        keywords = ["USER MODEL UPDATE", "update a compact user model", "recurring patterns"]
        return any(k in prompt for k in keywords)

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        response = await self.generate(prompt, system_prompt, max_tokens, temperature)
        yield response
