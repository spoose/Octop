#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export OCTOP_BIND_HOST=0.0.0.0
export OCTOP_PORT=8088
export OCTOP_ENABLE_DASHBOARD=true
# Keep the existing qiankun origins alongside the wujie workspace origins.
export OCTOP_CORS_ORIGINS=http://localhost:8010,http://localhost:4173,http://zh-mac.local:8010,http://zh-mac.local:4173,http://zh-mac.local:8001,http://localhost:8001,http://127.0.0.1:8001

exec uv run octop run
