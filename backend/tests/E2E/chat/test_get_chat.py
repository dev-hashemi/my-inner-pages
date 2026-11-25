"""
E2E tests for getting a specific chat.

Tests the happy path for the GET /api/v0/chats/{chat_id} endpoint.
"""

import pytest
from httpx import AsyncClient

from app.chat.db.models import Chat, ChatMessage
from tests.config import CHAT_PREFIX


@pytest.mark.asyncio
async def test_get_chat_by_id(authenticated_client: AsyncClient, test_user: dict):
    """
    Test retrieving a specific chat by ID.

    Args:
        authenticated_client: HTTP client with authentication headers
        test_user: Test user fixture with credentials
    """
    user_id = test_user["user_id"]

    chat = Chat(
        user_id=user_id,
        title="Test Chat",
        messages=[
            ChatMessage(role="user", content="Hello"),
            ChatMessage(role="assistant", content="Hi there!"),
        ],
    )
    await chat.insert()
    chat_id = str(chat.id)

    response = await authenticated_client.get(f"{CHAT_PREFIX}/{chat_id}")

    assert response.status_code == 200
    response_data = response.json()

    assert response_data["id"] == chat_id
    assert response_data["title"] == "Test Chat"
    assert response_data["message_count"] == 2
    assert len(response_data["messages"]) == 2
    assert response_data["messages"][0]["role"] == "user"
    assert response_data["messages"][0]["content"] == "Hello"
    assert response_data["messages"][1]["role"] == "assistant"
    assert response_data["messages"][1]["content"] == "Hi there!"
    assert "created_at" in response_data
    assert "updated_at" in response_data
    assert response_data["linked_entry_id"] is None


@pytest.mark.asyncio
async def test_get_chat_not_found(authenticated_client: AsyncClient):
    """
    Test retrieving a non-existent chat returns 404.

    Args:
        authenticated_client: HTTP client with authentication headers
    """
    fake_id = "507f1f77bcf86cd799439011"
    response = await authenticated_client.get(f"{CHAT_PREFIX}/{fake_id}")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_chat_other_user(authenticated_client: AsyncClient, another_test_user: dict):
    """
    Test that a user cannot access another user's chat.

    Args:
        authenticated_client: HTTP client for first user
        another_test_user: Second test user with credentials
    """
    other_chat = Chat(
        user_id=another_test_user["user_id"],
        title="Other User's Chat",
        messages=[ChatMessage(role="user", content="Secret")],
    )
    await other_chat.insert()
    other_chat_id = str(other_chat.id)

    response = await authenticated_client.get(f"{CHAT_PREFIX}/{other_chat_id}")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_chat_invalid_id_returns_400(authenticated_client: AsyncClient):
    """Test retrieving a chat with malformed ObjectId returns 400 instead of 500."""
    response = await authenticated_client.get(f"{CHAT_PREFIX}/not-a-valid-object-id")
    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_stream_chat_invalid_id_returns_sse_error(authenticated_client: AsyncClient):
    """Test streaming with an invalid chat_id yields an SSE error rather than creating a new chat."""
    response = await authenticated_client.post(
        "/api/v0/chat/stream",
        json={"content": "Hello", "chat_id": "bad-chat-id"},
    )
    assert response.status_code == 200
    assert "event: error" in response.text
    assert "Invalid chat identifier" in response.text


@pytest.mark.asyncio
async def test_stream_chat_edit_beyond_context_window_preserves_history(
    authenticated_client: AsyncClient, test_user: dict
):
    """Editing a message at index > 40 in a long chat truncates at the true index, not the 40-msg window."""
    user_id = test_user["user_id"]
    initial_messages = [
        ChatMessage(
            role="user" if i % 2 == 0 else "assistant",
            content=f"msg-{i}",
        )
        for i in range(46)
    ]
    chat = Chat(user_id=user_id, title="Long Chat", messages=initial_messages)
    await chat.insert()
    chat_id = str(chat.id)

    # Edit message at index 44 (beyond the 40-message context window)
    response = await authenticated_client.post(
        "/api/v0/chat/stream",
        json={
            "content": "edited-44",
            "chat_id": chat_id,
            "edit_message_index": 44,
        },
    )
    assert response.status_code == 200
    assert "event: done" in response.text

    updated_chat = await Chat.get(chat_id)
    assert updated_chat is not None
    # Messages 0..43 (44 messages) preserved + edited user msg + mock assistant reply = 46
    assert len(updated_chat.messages) == 46
    assert updated_chat.messages[43].content == "msg-43"
    assert updated_chat.messages[44].content == "edited-44"
    assert updated_chat.messages[44].role == "user"
    assert updated_chat.messages[45].role == "assistant"
