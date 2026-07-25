#!/usr/bin/env bash
# publish.sh — the ONE publisher for ABRA. Commits, pushes, and verifies it actually worked.
#
# WHY THIS EXISTS, AND WHAT IT REPLACES
# ------------------------------------
# ABRA had two publishers: a generic watcher (Projects\auto-publish.bat) that ran `git add -A` and
# pushed every 2 minutes across six repos, plus whatever the current session was doing. On
# 2026-07-25 that combination produced, in one day:
#
#   * 312 failed pushes in autopublish.log
#   * a wedged interactive rebase, 43 of 45 commits in, that a handoff nearly resolved by
#     abandoning all 43
#   * 250 duplicated lines in the append-only game store, from resolving the same conflict five
#     times across five commits
#   * a 987MB in-progress data file swept into a commit by `git add -A`, which GitHub rejected
#     outright, leaving a commit that existed and could not be pushed
#   * 8 consecutive GitHub Pages build failures, every one at the Checkout step, because a new
#     commit landed while the runner was still cloning — the site went 90 minutes without deploying
#
# None of those were exotic. They are all what happens when two things push the same branch on a
# timer. S11 says one publisher; this is it, and ABRA is now removed from the shared watcher.
#
# WHAT IT GUARANTEES
#   1. It never creates a commit that cannot be pushed (size guard before staging).
#   2. It never duplicates the append-only store (dedupe once, after the rebase settles).
#   3. It never resolves a store conflict by picking a side (keep both, then dedupe by id).
#   4. It does not push into a live Pages build (waits for the previous one to finish).
#   5. It VERIFIES the push landed on origin, and reports whether Pages deployed.
#
#   bash build/publish.sh                 commit, push, verify
#   bash build/publish.sh --check         report what would happen, change nothing
#   bash build/publish.sh -m "message"    use a real commit message instead of a generated one
set -uo pipefail
cd "$(dirname "$0")/.."

REPO_API="https://api.github.com/repos/willhoop/abra"
PAGES_URL="https://willhoop.github.io/abra/app/index.html"
MAXBYTES=$((90 * 1024 * 1024))     # GitHub hard-rejects >100MB; stop well short
CHECK=0; MSG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1 ;;
    -m) shift; MSG="${1:-}" ;;
  esac
  shift
done

say() { echo "  $*"; }
PY="$(command -v python || echo python)"

# ---- 1. refuse anything GitHub will reject -----------------------------------------------------
big=""
while IFS= read -r line; do
  f="${line:3}"
  [ -f "$f" ] || continue
  sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
  [ "$sz" -gt "$MAXBYTES" ] && big="$big$f ($((sz/1048576))MB)\n"
done < <(git status --porcelain --untracked-files=all)
if [ -n "$big" ]; then
  echo "REFUSING TO PUBLISH — these exceed 90MB and GitHub will reject them:"
  printf "%b" "$big" | sed 's/^/    /'
  echo "  Add them to .gitignore. Generated data (self-play corpora, raw logs) is regenerable"
  echo "  from its seed and must never enter git."
  exit 1
fi

# ---- 2. commit local work ----------------------------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  n=$(git status --porcelain | wc -l | tr -d ' ')
  if [ "$CHECK" = "1" ]; then say "would commit $n changed file(s)"; else
    git add -A
    git commit -q -m "${MSG:-chore: publish $(date -u +%Y-%m-%dT%H:%MZ)}" || true
    say "committed $n changed file(s)"
  fi
else
  say "working tree clean"
fi

git fetch origin --quiet 2>/dev/null || true
ahead=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
behind=$(git log HEAD..origin/main --oneline 2>/dev/null | wc -l | tr -d ' ')
say "ahead $ahead / behind $behind"
if [ "$ahead" = "0" ] && [ "$behind" = "0" ]; then say "nothing to publish"; exit 0; fi
if [ "$CHECK" = "1" ]; then say "--check: stopping before rebase"; exit 0; fi

# ---- 3. rebase, resolving the append-only store the documented way ------------------------------
if [ "$behind" != "0" ]; then
  git rebase origin/main >/dev/null 2>&1
  for _ in $(seq 1 40); do
    git status | grep -q "rebase in progress" || break
    conf="$(git diff --name-only --diff-filter=U)"
    if [ -n "$conf" ]; then
      for f in $conf; do
        case "$f" in
          # KEEP BOTH SIDES. Never merge=union (it doubles the file), never pick a side (it drops
          # games). Duplicates are settled once below, by id, which cannot lose a record.
          *.jsonl) grep -v '^<<<<<<<\|^=======\|^>>>>>>>' "$f" > "$f.tmp" && mv "$f.tmp" "$f" ;;
        esac
        git add "$f"
      done
    fi
    GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 || GIT_EDITOR=true git rebase --skip >/dev/null 2>&1
  done
  if git status | grep -q "rebase in progress"; then
    echo "REBASE STUCK — nothing pushed, leaving it for a human"; exit 1
  fi
  say "rebased onto origin/main"
fi

# ---- 4. dedupe the store ONCE, after everything has settled ------------------------------------
if [ -f data/games.ladder.jsonl ]; then
  before=$(wc -l < data/games.ladder.jsonl)
  "$PY" engine/dedupe_store.py --write >/dev/null 2>&1
  after=$(wc -l < data/games.ladder.jsonl)
  if [ "$before" != "$after" ]; then
    say "deduped store: $before -> $after lines ($((before-after)) duplicates)"
    git add data/games.ladder.jsonl
    git commit -q -m "store: dedupe after rebase ($((before-after)) duplicate lines)" || true
  fi
fi

# ---- 5. do not push into a live Pages build ----------------------------------------------------
# A push that lands while the runner is cloning kills the build at Checkout. That is what took the
# site down for 90 minutes. Wait for any in-flight build to finish first.
for _ in $(seq 1 20); do
  st=$(curl -s "$REPO_API/actions/runs?per_page=1" 2>/dev/null \
       | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).workflow_runs[0].status)}catch(e){console.log('unknown')}})" 2>/dev/null)
  [ "$st" = "in_progress" ] || [ "$st" = "queued" ] || break
  say "a Pages build is in flight — waiting"
  sleep 15
done

# ---- 6. push, and VERIFY it landed -------------------------------------------------------------
pushed=0
for attempt in 1 2 3 4 5; do
  if git push origin main >/dev/null 2>&1; then pushed=1; break; fi
  say "push rejected (remote moved) — refetching and retrying"
  git fetch origin --quiet 2>/dev/null
  git rebase origin/main >/dev/null 2>&1 || { GIT_EDITOR=true git rebase --abort >/dev/null 2>&1; }
  sleep 4
done
[ "$pushed" = "1" ] || { echo "FAILED to push after 5 attempts"; exit 1; }

git fetch origin --quiet 2>/dev/null
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "PUSH REPORTED SUCCESS BUT origin/main DOES NOT MATCH HEAD — investigate"; exit 1
fi
say "pushed and verified: origin/main == HEAD"

# ---- 7. report whether the site actually deployed ----------------------------------------------
say "waiting for GitHub Pages…"
for _ in $(seq 1 24); do
  sleep 15
  r=$(curl -s "$REPO_API/actions/runs?per_page=1" 2>/dev/null \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s).workflow_runs[0];console.log(j.status+':'+(j.conclusion||'-'))}catch(e){console.log('unknown:-')}})" 2>/dev/null)
  case "$r" in
    completed:success) say "Pages deployed. $PAGES_URL"; exit 0 ;;
    completed:failure) echo "  PAGES BUILD FAILED — the push landed but the site did not update."
                       echo "  Check $REPO_API/actions"; exit 1 ;;
  esac
done
say "Pages still building after 6 minutes — push is safe on origin, site will follow"
