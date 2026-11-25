"""
E2E tests for listing journal entries with cursor-based pagination.

Tests the happy path for the GET /api/v0/journals endpoint.
"""

import pytest
from httpx import AsyncClient

from app.journals.api.config import JournalRoutes
from tests.config import JOURNALS_PREFIX
from tests.conftest import make_tiptap_json


@pytest.mark.asyncio
async def test_list_journals_empty(authenticated_client: AsyncClient, test_user: dict):
    """
    Test listing journals when user has no journals.
    """
    response = await authenticated_client.get(f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}")

    assert response.status_code == 200
    response_data = response.json()

    assert response_data["items"] == []
    assert response_data["next_cursor"] is None


@pytest.mark.asyncio
async def test_list_journals_with_data(authenticated_client: AsyncClient, test_user: dict):
    """
    Test listing journals when user has multiple journal entries.
    """
    journals_data = [
        {
            "title": "First Entry",
            "content_json": make_tiptap_json("Content of first entry"),
            "tags": ["tag1"]
        },
        {
            "title": "Second Entry",
            "content_json": make_tiptap_json("Content of second entry"),
            "tags": ["tag2"]
        },
        {
            "title": "Third Entry",
            "content_json": make_tiptap_json("Content of third entry"),
            "tags": ["tag1", "tag2"]
        }
    ]

    for journal_data in journals_data:
        await authenticated_client.post(
            f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}",
            json=journal_data
        )

    response = await authenticated_client.get(f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}")

    assert response.status_code == 200
    response_data = response.json()

    assert len(response_data["items"]) == 3
    assert response_data["next_cursor"] is None

    for journal in response_data["items"]:
        assert "id" in journal
        assert "title" in journal
        assert "content_json" in journal
        assert "content_text" in journal

    assert response_data["items"][0]["title"] == "Third Entry"
    assert response_data["items"][2]["title"] == "First Entry"


@pytest.mark.asyncio
async def test_list_journals_pagination(authenticated_client: AsyncClient, test_user: dict):
    """
    Test cursor-based pagination when listing journals.
    """
    for i in range(5):
        journal_data = {
            "title": f"Entry {i+1}",
            "content_json": make_tiptap_json(f"Content {i+1}"),
        }
        await authenticated_client.post(
            f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}",
            json=journal_data
        )

    response = await authenticated_client.get(
        f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}?page_size=2"
    )

    assert response.status_code == 200
    response_data = response.json()

    assert len(response_data["items"]) == 2
    assert response_data["next_cursor"] is not None

    response_page2 = await authenticated_client.get(
        f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}?page_size=2&cursor={response_data['next_cursor']}"
    )

    assert response_page2.status_code == 200
    response_data_page2 = response_page2.json()

    assert len(response_data_page2["items"]) == 2
    assert response_data_page2["next_cursor"] is not None

    response_page3 = await authenticated_client.get(
        f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}?page_size=2&cursor={response_data_page2['next_cursor']}"
    )

    assert response_page3.status_code == 200
    response_data_page3 = response_page3.json()

    assert len(response_data_page3["items"]) == 1
    assert response_data_page3["next_cursor"] is None


@pytest.mark.asyncio
async def test_list_journals_no_duplicates_across_pages(authenticated_client: AsyncClient, test_user: dict):
    """
    Test that cursor pagination does not return duplicate entries across pages.
    """
    for i in range(3):
        journal_data = {
            "title": f"Entry {i+1}",
            "content_json": make_tiptap_json(f"Content {i+1}"),
        }
        await authenticated_client.post(
            f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}",
            json=journal_data
        )

    all_ids = set()
    cursor = None
    while True:
        url = f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}?page_size=2"
        if cursor:
            url += f"&cursor={cursor}"
        response = await authenticated_client.get(url)
        assert response.status_code == 200
        data = response.json()

        for item in data["items"]:
            assert item["id"] not in all_ids, "Duplicate entry across pages"
            all_ids.add(item["id"])

        cursor = data["next_cursor"]
        if cursor is None:
            break

    assert len(all_ids) == 3


@pytest.mark.asyncio
async def test_list_journals_search_and_sort(authenticated_client: AsyncClient, test_user: dict):
    """Test server-side search query (q) and ascending sort order (date-asc)."""
    entries = [
        {"title": "Morning Walk", "content_json": make_tiptap_json("Fresh air outside"), "tags": ["morning"]},
        {"title": "Evening Thoughts", "content_json": make_tiptap_json("Quiet night reflection"), "tags": ["evening"]},
        {"title": "Afternoon Coffee", "content_json": make_tiptap_json("Walked to the cafe"), "tags": ["coffee"]},
    ]
    for entry in entries:
        resp = await authenticated_client.post(f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}", json=entry)
        assert resp.status_code == 201

    search_resp = await authenticated_client.get(f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}?q=walk")
    assert search_resp.status_code == 200
    titles = [item["title"] for item in search_resp.json()["items"]]
    assert set(titles) == {"Morning Walk", "Afternoon Coffee"}

    asc_resp = await authenticated_client.get(f"{JOURNALS_PREFIX}{JournalRoutes.ROOT}?sort=date-asc")
    assert asc_resp.status_code == 200
    asc_titles = [item["title"] for item in asc_resp.json()["items"]]
    assert asc_titles == ["Morning Walk", "Evening Thoughts", "Afternoon Coffee"]
