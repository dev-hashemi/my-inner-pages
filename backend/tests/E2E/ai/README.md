# AI Module E2E Tests

These tests cover listing, updating, reloading, and testing LLM providers through the admin API. The test fixtures enable mock LLM responses to avoid live provider calls.

```bash
uv run pytest tests/E2E/ai/ -v
```
