"""Read-only WeKnora knowledge-base gateway adapter."""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote

import httpx

from octop.infra.connectors.builder import normalize_weknora_base_url

_MAX_RESULTS = 8
_MAX_CHUNK_CHARS = 1200

TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_knowledge_bases",
        "description": "List WeKnora knowledge bases visible to the configured credential.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "find_documents",
        "description": (
            "Find WeKnora documents by title or filename keyword in one knowledge base. "
            "Use this before passage search when looking for a named document or an overview "
            "(e.g. company overview). Use a short title keyword such as '概况' or 'overview', "
            "not a full question. "
            "Read a matching document with read_document using its knowledge_id."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "Title or filename keyword"},
                "knowledge_base_id": {
                    "type": "string",
                    "description": "Knowledge-base ID from list_knowledge_bases",
                },
                "page": {"type": "integer", "minimum": 1, "description": "Page, default 1"},
                "page_size": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 50,
                    "description": "Documents per page, default 10",
                },
            },
            "required": ["keyword", "knowledge_base_id"],
        },
    },
    {
        "name": "search",
        "description": (
            "Search WeKnora knowledge bases and return ranked source passages. "
            "For a named document or overview, try find_documents first. "
            "Use the returned knowledge_id with read_document for surrounding context."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "knowledge_base_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional knowledge-base scope; defaults to connector config",
                },
                "max_results": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": _MAX_RESULTS,
                    "description": f"Maximum passages (1-{_MAX_RESULTS})",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "read_document",
        "description": "Read one WeKnora document and its ordered chunks by knowledge_id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "knowledge_id": {"type": "string", "description": "Document knowledge ID"},
                "page": {"type": "integer", "minimum": 1, "description": "Page, default 1"},
                "page_size": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 50,
                    "description": "Chunks per page, default 20",
                },
            },
            "required": ["knowledge_id"],
        },
    },
]


def list_tools() -> list[dict[str, Any]]:
    return TOOLS


def _headers(creds: dict[str, Any]) -> dict[str, str]:
    headers = {"Accept": "application/json"}
    api_key = str(creds.get("api_key") or "").strip()
    tenant_id = str(creds.get("tenant_id") or "").strip()
    if api_key:
        headers["X-API-Key"] = api_key
    if tenant_id:
        headers["X-Tenant-ID"] = tenant_id
    return headers


def _request(
    creds: dict[str, Any],
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base_url = normalize_weknora_base_url(str(creds.get("base_url") or ""))
    try:
        with httpx.Client(timeout=30.0, follow_redirects=False) as client:
            response = client.request(
                method,
                f"{base_url}{path}",
                headers=_headers(creds),
                params=params,
                json=body,
            )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        raise ValueError(f"WeKnora request failed: HTTP {status}") from exc
    except (httpx.HTTPError, ValueError) as exc:
        if isinstance(exc, ValueError) and str(exc).startswith("WeKnora request failed"):
            raise
        raise ValueError(f"WeKnora request failed: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError("WeKnora returned an invalid JSON response")
    if payload.get("success") is False:
        reason = payload.get("message") or payload.get("error") or "request rejected"
        raise ValueError(f"WeKnora request failed: {reason}")
    return payload


def _data_list(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data")
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    return []


def _configured_ids(creds: dict[str, Any], raw: Any = None) -> list[str]:
    value = raw if raw is not None else creds.get("knowledge_base_ids")
    if isinstance(value, list):
        ids = [str(item).strip() for item in value if str(item).strip()]
    else:
        ids = [part.strip() for part in str(value or "").split(",") if part.strip()]
    return list(dict.fromkeys(ids))


def _visible_knowledge_base_ids(creds: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for item in _data_list(_request(creds, "GET", "/knowledge-bases")):
        kb_id = str(item.get("id") or "").strip()
        if kb_id:
            ids.append(kb_id)
    return ids


def _clip_passage(item: dict[str, Any]) -> dict[str, Any]:
    content = str(item.get("content") or "")
    clipped = content[:_MAX_CHUNK_CHARS]
    return {
        "knowledge_id": item.get("knowledge_id"),
        "knowledge_title": item.get("knowledge_title") or item.get("knowledge_filename"),
        "chunk_index": item.get("chunk_index"),
        "score": item.get("score"),
        "content": clipped,
        "truncated": len(content) > len(clipped),
    }


def _list_knowledge_bases(creds: dict[str, Any]) -> dict[str, Any]:
    rows = _data_list(_request(creds, "GET", "/knowledge-bases"))
    return {
        "knowledge_bases": [
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "description": item.get("description"),
                "knowledge_count": item.get("knowledge_count"),
                "chunk_count": item.get("chunk_count"),
            }
            for item in rows
        ]
    }


def _find_documents(creds: dict[str, Any], args: dict[str, Any]) -> dict[str, Any]:
    keyword = str(args.get("keyword") or "").strip()
    if not keyword:
        raise ValueError("keyword is required")
    kb_id = str(args.get("knowledge_base_id") or "").strip()
    if not kb_id:
        raise ValueError("knowledge_base_id is required")
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(int(args.get("page_size") or 10), 50))
    payload = _request(
        creds,
        "GET",
        f"/knowledge-bases/{quote(kb_id, safe='')}/knowledge",
        params={"keyword": keyword, "page": page, "page_size": page_size},
    )
    return {
        "keyword": keyword,
        "knowledge_base_id": kb_id,
        "page": page,
        "page_size": page_size,
        "total": payload.get("total", 0),
        "documents": [
            {
                "knowledge_id": item.get("id"),
                "title": item.get("title") or item.get("file_name"),
                "filename": item.get("file_name"),
                "description": str(item.get("description") or "")[:_MAX_CHUNK_CHARS],
                "folder_path": item.get("folder_path"),
                "parse_status": item.get("parse_status"),
                "enable_status": item.get("enable_status"),
            }
            for item in _data_list(payload)
        ],
    }


def _search(creds: dict[str, Any], args: dict[str, Any]) -> dict[str, Any]:
    query = str(args.get("query") or "").strip()
    if not query:
        raise ValueError("query is required")
    ids = _configured_ids(creds, args.get("knowledge_base_ids"))
    if not ids:
        ids = _visible_knowledge_base_ids(creds)
    if not ids:
        raise ValueError("no visible WeKnora knowledge bases")
    max_results = max(1, min(int(args.get("max_results") or _MAX_RESULTS), _MAX_RESULTS))
    payload = _request(
        creds,
        "POST",
        "/knowledge-search",
        params={"resource_urls": "handle"},
        body={"query": query, "knowledge_base_ids": ids},
    )
    passages = [_clip_passage(item) for item in _data_list(payload)[:max_results]]
    return {"query": query, "knowledge_base_ids": ids, "passages": passages}


def _read_document(creds: dict[str, Any], args: dict[str, Any]) -> dict[str, Any]:
    knowledge_id = str(args.get("knowledge_id") or "").strip()
    if not knowledge_id:
        raise ValueError("knowledge_id is required")
    page = max(1, int(args.get("page") or 1))
    page_size = max(1, min(int(args.get("page_size") or 20), 50))
    escaped_id = quote(knowledge_id, safe="")
    detail_payload = _request(creds, "GET", f"/knowledge/{escaped_id}")
    chunks_payload = _request(
        creds,
        "GET",
        f"/chunks/{escaped_id}",
        params={"page": page, "page_size": page_size},
    )
    detail = detail_payload.get("data")
    if not isinstance(detail, dict):
        detail = {}
    chunks = sorted(
        _data_list(chunks_payload),
        key=lambda item: int(item.get("chunk_index") or 0),
    )
    return {
        "knowledge_id": knowledge_id,
        "title": detail.get("title") or detail.get("file_name"),
        "description": detail.get("description"),
        "summary": detail.get("summary"),
        "page": chunks_payload.get("page", page),
        "page_size": chunks_payload.get("page_size", page_size),
        "total": chunks_payload.get("total"),
        "chunks": [_clip_passage(item) for item in chunks],
    }


def call_tool(creds: dict[str, Any], name: str, args: dict[str, Any]) -> str:
    if name == "list_knowledge_bases":
        result = _list_knowledge_bases(creds)
    elif name == "find_documents":
        result = _find_documents(creds, args)
    elif name == "search":
        result = _search(creds, args)
    elif name == "read_document":
        result = _read_document(creds, args)
    else:
        raise ValueError(f"unknown tool: {name}")
    return json.dumps(result, ensure_ascii=False)


def probe_credentials(creds: dict[str, Any]) -> None:
    _request(creds, "GET", "/knowledge-bases")
