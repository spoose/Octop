"""Integration tests for /api/update."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest

from octop.api.routers import update as update_router
from octop.api.routers.update_store import clear_cached_status
from octop.infra.setup.self_update import PyPIInfo


@pytest.fixture(autouse=True)
def _mock_pypi(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    clear_cached_status()
    monkeypatch.setattr(
        update_router,
        "fetch_pypi_info",
        lambda: PyPIInfo(version="1.0.2b8", latest_stable="1.0.1"),
    )
    yield
    clear_cached_status()


async def test_update_status_shape(env_admin_client: Any) -> None:
    c, auth = env_admin_client
    r = await c.get("/api/update/status", headers=auth)
    assert r.status_code == 200
    body = r.json()
    assert body["latest_version"] == "1.0.1"
    for key in (
        "current_version",
        "latest_version",
        "has_update",
        "is_editable",
        "service_mode",
        "desktop",
        "error",
        "last_check_time",
        "release_notes",
        "stable_only",
        "latest_is_prerelease",
    ):
        assert key in body


async def test_update_check_admin_only(env_admin_client: Any) -> None:
    c, auth = env_admin_client
    r = await c.post("/api/update/check", headers=auth)
    assert r.status_code == 200


async def test_update_settings_stable_only_roundtrip(env_admin_client: Any) -> None:
    c, auth = env_admin_client
    r = await c.patch("/api/update/settings", json={"stable_only": False}, headers=auth)
    assert r.status_code == 200
    assert r.json()["stable_only"] is False
    status = await c.get("/api/update/status", headers=auth)
    assert status.status_code == 200
    assert status.json()["stable_only"] is False
    assert status.json()["latest_version"] == "1.0.2b8"
    r = await c.patch("/api/update/settings", json={"stable_only": True}, headers=auth)
    assert r.status_code == 200
    assert r.json()["stable_only"] is True
