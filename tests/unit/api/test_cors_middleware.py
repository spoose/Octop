"""CORS must wrap authentication and setup gates."""

from types import SimpleNamespace
from typing import cast

import httpx

from octop.api.app import build_app
from octop.config import OctopConfig
from octop.infra.server import OctopServer


async def test_cors_wraps_protected_routes_and_setup_lockdown() -> None:
    origin = "http://localhost:8010"
    users = SimpleNamespace(count=lambda: 1)
    server = cast(
        OctopServer,
        SimpleNamespace(
            services=None,
            config=OctopConfig(cors_origins=[origin], enable_dashboard=False),
            app_runtime=None,
            user_manager=users,
        ),
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=build_app(server)), base_url="http://testserver"
    ) as client:
        for path in ("/api/auth/me", "/api/agents"):
            preflight = await client.options(
                path,
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "authorization,content-type",
                },
            )
            assert preflight.status_code == 200
            assert preflight.headers["access-control-allow-origin"] == origin
            denied = await client.get(path, headers={"Origin": origin})
            assert denied.status_code == 401
            assert denied.json()["error"]["code"] == "AUTH_FAILED"
            assert denied.headers["access-control-allow-origin"] == origin

        blocked = await client.options(
            "/api/auth/me",
            headers={"Origin": "http://untrusted.test", "Access-Control-Request-Method": "GET"},
        )
        assert blocked.status_code == 400
        assert "access-control-allow-origin" not in blocked.headers

        users.count = lambda: 0
        locked = await client.get("/api/agents", headers={"Origin": origin})
        assert locked.status_code == 503
        assert locked.json()["setup_required"] is True
        assert locked.headers["access-control-allow-origin"] == origin
