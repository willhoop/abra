#!/usr/bin/env python3
"""dedupe_store.py - remove duplicate game records from the append-only store.

WHY THIS EXISTS. `data/games.ladder.jsonl` is append-only, and the ingest already refuses to write an
id it has seen (durable-ingest.js reads every existing id before appending). Duplicates therefore do
NOT come from the ingest. They come from GIT: an append-only file reconciled by a non-fast-forward
merge replays the same appended block twice. That happened once via `merge -X ours` (7,040 dupes) and
again on 2026-07-24 (401 dupes).

Because the cause is external to the ingest, a one-off cleanup cannot hold. This script is idempotent
and safe to run at any time: it keeps the FIRST occurrence of each id, preserves file order, and
rewrites atomically via a temp file so an interrupted run cannot truncate the store.

  python3 engine/dedupe_store.py            # report only
  python3 engine/dedupe_store.py --write    # rewrite the file
"""
import json, os, sys, tempfile

STORE = os.path.join(os.path.dirname(__file__), '..', 'data', 'games.ladder.jsonl')

def scan(path):
    seen, keep, dup, bad = set(), [], 0, 0
    with open(path, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                gid = json.loads(line).get('id')
            except Exception:
                bad += 1
                keep.append(line)      # never silently discard a line we cannot read
                continue
            if gid in seen:
                dup += 1
                continue
            seen.add(gid)
            keep.append(line)
    return keep, dup, bad, len(seen)

def main():
    path = os.path.abspath(STORE)
    keep, dup, bad, uniq = scan(path)
    print(f"store: {len(keep) + dup} lines -> {len(keep)} unique ({dup} duplicates, {bad} unparseable)")
    if dup == 0:
        print("nothing to do")
        return 0
    if '--write' not in sys.argv:
        print("run again with --write to rewrite the file")
        return 1
    d = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=d, suffix='.tmp')   # same filesystem, so the replace is atomic
    with os.fdopen(fd, 'w', encoding='utf-8') as out:
        out.write('\n'.join(keep) + '\n')
    os.replace(tmp, path)
    after, dup_after, _, _ = scan(path)
    print(f"rewritten: {len(after)} lines, {dup_after} duplicates remaining")
    return 0 if dup_after == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
