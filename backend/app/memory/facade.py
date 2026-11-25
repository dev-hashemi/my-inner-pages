from typing import Optional
from app.journals.db.repository import JournalRepository
from app.journals.db.models import Journal
from app.memory.config import MemoryModuleConfig
from app.memory.db.repository import UserModelRepository
from app.memory.prompts.context_injection import build_injected_context
from app.core.logging import get_logger

logger = get_logger(__name__)


class MemoryFacade:
    def __init__(
        self,
        journal_repository: JournalRepository,
        user_model_repository: UserModelRepository,
        config: MemoryModuleConfig,
    ):
        self.journal_repository = journal_repository
        self.user_model_repository = user_model_repository
        self.config = config

    async def get_recent_journals(
        self,
        user_id: str,
        limit: int
    ) -> list[Journal]:
        limit = min(limit, self.config.max_context_limit)

        logger.info("fetching_journals", user_id=user_id, limit=limit)

        journals, _ = await self.journal_repository.find_all_by_user(
            user_id=user_id,
            limit=limit
        )
        
        logger.info("journals_fetched", user_id=user_id, count=len(journals))
        return journals

    async def build_injected_context(
        self,
        user_id: str,
        chat_history: Optional[list[dict]] = None,
    ) -> str:
        logger.info("building_injected_context", user_id=user_id)

        user_model = await self.user_model_repository.find_by_user_id(user_id)
        recent_entries = await self.get_recent_journals(
            user_id, limit=self.config.max_journals_for_context
        )

        context = build_injected_context(user_model, recent_entries, chat_history)
        logger.info("injected_context_built", user_id=user_id, context_length=len(context))

        return context
