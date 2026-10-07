#!/usr/bin/env bash
# PostToolUse (Edit|Write): format otomatis + pemeriksaan cepat untuk file yang baru diubah.
# Selalu exit 0 — hasil pemeriksaan hanya informasi, tidak memblokir.
f=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$f" ] || [ ! -f "$f" ] && exit 0
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
case "$f" in
  *.go)
    gofmt -w "$f" 2>/dev/null
    command -v goimports >/dev/null && goimports -w "$f" 2>/dev/null
    (cd "$root/backend" && go vet ./... 2>&1 | tail -5) >&2
    ;;
  "$root"/frontend/*.ts|"$root"/frontend/*.tsx|"$root"/frontend/*.js|"$root"/frontend/*.css|"$root"/frontend/*.json)
    (cd "$root/frontend" && npx --no-install prettier --write --log-level warn "$f" 2>&1 | tail -3) >&2
    case "$f" in *.ts|*.tsx)
      (cd "$root/frontend" && npx --no-install eslint "$f" 2>&1 | tail -10) >&2 ;;
    esac
    ;;
esac
exit 0
