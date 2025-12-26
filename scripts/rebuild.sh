#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT=$(cd -- "$(dirname -- "$0")/.." && pwd)
HTML_FILE=${1:-}
BASE_URL=${BASE_URL:-"https://pages.lijie.space/pages/"}
DATA_FILE=${DATA_FILE:-"$PROJECT_ROOT/data/pages.json"}
SCAN_DIR=${SCAN_DIR:-"/WWW_ROOT/static/pages"}

cd "$PROJECT_ROOT"

if [[ -n "$HTML_FILE" ]]; then
  echo "[rebuild] 解析功能已移除；仅触发构建: $HTML_FILE"
else
  echo "[rebuild] 解析功能已移除；执行全量构建"
fi

echo "[rebuild] 触发构建"
docker compose run --rm builder
