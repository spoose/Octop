"""Scoped title lookup for the WeKnora MCP gateway."""

from __future__ import annotations

import json

import httpx
import pytest

from octop.infra.connectors.gateway.adapters import weknora
from octop.infra.connectors.gateway.protocol import handle_mcp_request


@pytest.mark.parametrize(
    ("pagination", "expected_page", "expected_size"),
    [({}, 1, 10), ({"page": 2, "page_size": 5}, 2, 5), ({"page": -1, "page_size": 100}, 1, 50)],
)
def test_find_documents_uses_scoped_title_search(
    monkeypatch: pytest.MonkeyPatch,
    pagination: dict[str, int],
    expected_page: int,
    expected_size: int,
) -> None:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "success": True,
                "total": 12,
                "data": [
                    {
                        "id": "doc-overview",
                        "title": "公司概况",
                        "file_name": "overview.md",
                        "description": "企业介绍",
                        "folder_path": "公司资料",
                        "parse_status": "completed",
                        "enable_status": "enabled",
                        "file_path": "private-storage-path",
                        "metadata": {"internal": "not for the model"},
                    },
                    {"id": "doc-filename", "file_name": "公司概况.pdf"},
                ],
            },
        )

    client_type = httpx.Client
    monkeypatch.setattr(
        weknora.httpx,
        "Client",
        lambda **kwargs: client_type(transport=httpx.MockTransport(respond), **kwargs),
    )
    response = handle_mcp_request(
        kind="weknora",
        creds={"base_url": "http://127.0.0.1:18080", "api_key": "test-key"},
        body={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "find_documents",
                "arguments": {
                    "keyword": " 概况 ",
                    "knowledge_base_id": " kb-selected ",
                    **pagination,
                },
            },
        },
    )
    assert response["result"]["isError"] is False
    result = json.loads(response["result"]["content"][0]["text"])
    assert len(requests) == 1
    request = requests[0]
    assert request.method == "GET"
    assert request.url.path == "/api/v1/knowledge-bases/kb-selected/knowledge"
    assert dict(request.url.params) == {
        "keyword": "概况",
        "page": str(expected_page),
        "page_size": str(expected_size),
    }
    assert request.headers["X-API-Key"] == "test-key"
    assert result["knowledge_base_id"] == "kb-selected"
    assert result["total"] == 12
    assert result["documents"][0] == {
        "knowledge_id": "doc-overview",
        "title": "公司概况",
        "filename": "overview.md",
        "description": "企业介绍",
        "folder_path": "公司资料",
        "parse_status": "completed",
        "enable_status": "enabled",
    }
    assert result["documents"][1]["title"] == "公司概况.pdf"


def test_find_documents_no_match_does_not_widen_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    def request(_creds: object, method: str, path: str, **_kwargs: object) -> dict[str, object]:
        assert method == "GET"
        assert path == "/knowledge-bases/kb-selected/knowledge"
        return {"success": True, "total": 0, "data": []}

    monkeypatch.setattr(weknora, "_request", request)
    result = json.loads(
        weknora.call_tool(
            {}, "find_documents", {"keyword": "missing", "knowledge_base_id": "kb-selected"}
        )
    )
    assert result["documents"] == []
    assert result["total"] == 0


@pytest.mark.parametrize(
    ("args", "missing"),
    [
        ({"keyword": " ", "knowledge_base_id": "kb-selected"}, "keyword"),
        ({"keyword": "概况"}, "knowledge_base_id"),
    ],
)
def test_find_documents_requires_keyword_and_scope(
    monkeypatch: pytest.MonkeyPatch, args: dict[str, str], missing: str
) -> None:
    def request(*_args: object, **_kwargs: object) -> None:
        pytest.fail("invalid input must not issue a request")

    monkeypatch.setattr(weknora, "_request", request)
    with pytest.raises(ValueError, match=missing):
        weknora.call_tool({}, "find_documents", args)
