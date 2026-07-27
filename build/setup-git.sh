#!/usr/bin/env bash
# setup-git.sh — one-time local git configuration for this clone.
#
#     bash build/setup-git.sh
#
# WHY IT IS NEEDED AT ALL
# -----------------------
# .gitattributes selects a merge driver by NAME; the name has to be bound to a command in local git
# config, and git deliberately will not let a repository configure that for you (a repo that could
# would be a repo that can run arbitrary commands on clone). So this is the one thing that cannot be
# committed and must be run once per clone.
#
# WHAT IT BINDS
# -------------
# The append-only game stores are sets keyed on game id, and the hourly ingest pushes to main while
# local work rebuilds them, so they conflict routinely. Without a driver the resolution is a human
# judgement with a dangerous default: on 2026-07-26 the union held 229 games that existed only on
# the remote, and `-X ours` would have deleted every one of them silently. Replays age off
# Showdown's server; that loss is permanent.
set -euo pipefail
cd "$(dirname "$0")/.."

git config merge.jsonl-store.name "union the append-only game stores by game id"
git config merge.jsonl-store.driver "node build/merge-jsonl-store.js %O %A %B %P"

echo "bound merge.jsonl-store -> node build/merge-jsonl-store.js"
echo "covers:"
git check-attr merge -- data/games.ladder.jsonl data/games.bo3.jsonl \
                       data/games.ladder.raw-logs.jsonl data/games.bo3.raw-logs.jsonl | sed 's/^/  /'
