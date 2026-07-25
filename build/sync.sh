#!/usr/bin/env bash
# sync.sh — rebase onto origin/main and push, resolving append-only store conflicts safely.
#
# WHY THIS EXISTS
# ---------------
# The GitHub ingest workflow appends to data/games.ladder.jsonl roughly hourly, and local work
# appends to the same file. Every divergence therefore conflicts on an append-only log, and doing it
# by hand is both tedious and dangerous: this repository has had its store duplicated four times, and
# every one of those duplications entered through git reconciliation rather than through the ingest.
#
# The rules this encodes, from .gitattributes:
#   - NO merge=union driver. It concatenates both sides of a conflicting hunk in full, which doubles
#     an append-only log on every divergence, and it applies to rebase as well as merge.
#   - Resolve by KEEPING BOTH SIDES, then let engine/dedupe_store.py settle it by id. The dedupe is
#     idempotent and order-preserving, so it cannot lose a game.
#   - Duplicates compound across a multi-commit rebase (five successive resolutions produced 250),
#     so the dedupe runs ONCE at the end over the final file, not per commit.
#
# Push is retried, because the ingest can land between the rebase and the push and the remote ref
# moves under us ("cannot lock ref").
#
#   bash build/sync.sh
set -uo pipefail
cd "$(dirname "$0")/.."

PY="$(node build/../engine/python.js 2>/dev/null | sed 's/  *(Python.*//')"
[ -x "$PY" ] || PY="python"

for attempt in 1 2 3 4 5; do
  echo "== sync attempt $attempt =="
  git fetch origin --quiet || true

  if [ -z "$(git log origin/main..HEAD --oneline)" ] && [ -z "$(git log HEAD..origin/main --oneline)" ]; then
    echo "  already in sync"; exit 0
  fi

  git rebase origin/main >/dev/null 2>&1
  # resolve until the rebase is done or we give up
  for _ in $(seq 1 40); do
    git status | grep -q "rebase in progress" || break
    conf="$(git diff --name-only --diff-filter=U)"
    if [ -n "$conf" ]; then
      for f in $conf; do
        case "$f" in
          *.jsonl) grep -v '^<<<<<<<\|^=======\|^>>>>>>>' "$f" > "$f.tmp" && mv "$f.tmp" "$f" ;;
        esac
        git add "$f"
      done
    fi
    GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 || GIT_EDITOR=true git rebase --skip >/dev/null 2>&1
  done

  if git status | grep -q "rebase in progress"; then
    echo "  REBASE STUCK — leaving it for a human, nothing has been pushed"; exit 1
  fi

  # ONE dedupe over the settled file, then amend it in if it changed anything
  before="$(wc -l < data/games.ladder.jsonl)"
  "$PY" engine/dedupe_store.py --write >/dev/null 2>&1
  after="$(wc -l < data/games.ladder.jsonl)"
  if [ "$before" != "$after" ]; then
    echo "  deduped store: $before -> $after lines"
    git add data/games.ladder.jsonl
    git commit -q -m "store: dedupe after rebase ($((before-after)) duplicate lines removed)" || true
  fi

  if git push origin main >/dev/null 2>&1; then
    echo "  pushed. unpushed=$(git log origin/main..HEAD --oneline | wc -l)"
    exit 0
  fi
  echo "  push rejected (remote moved) — retrying"
  sleep 3
done

echo "FAILED to push after 5 attempts"; exit 1
