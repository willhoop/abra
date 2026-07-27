/* merge-jsonl-store.js — a git merge driver for the append-only game stores.
 *
 * Registered by build/setup-git.sh and selected by .gitattributes. Git calls it as
 *
 *     node build/merge-jsonl-store.js %O %A %B %P
 *
 * with the common ancestor, OUR version, THEIR version, and the real path. The result is written
 * back over %A. Exit 0 means resolved.
 *
 * WHY THIS EXISTS
 * ---------------
 * The hourly ingest workflow pushes new games straight to main. Anything that rebuilds the store
 * locally — engine/reprocess.js, which reparses every record when the parser learns something —
 * therefore collides with it routinely, and git cannot merge a 60 MB line-per-game file on its own,
 * so it stops and asks a human.
 *
 * That question has a dangerous default. On 2026-07-26 the conflict was resolved by hand and the
 * union turned out to hold 229 games that existed ONLY on the remote. Taking either side wholesale
 * would have deleted them, and `git merge -X ours` — which this repository has been bitten by three
 * times — would have done exactly that without printing anything. Nothing about the result would
 * have looked wrong: a JSONL with 16,251 lines is precisely as valid as one with 16,480, and the
 * replays behind those games age off Showdown's server and cannot be fetched again.
 *
 * So the resolution stops being a judgement call. These stores are SETS KEYED ON GAME ID, and the
 * only correct merge of two sets that are both append-only is the union. Nothing is ever dropped.
 *
 * WHICH RECORD WINS WHEN BOTH SIDES HAVE THE SAME ID
 * --------------------------------------------------
 * The longer one. That is not a guess dressed up as a rule: the two sides differ only by which
 * version of engine/durable-ingest.js parsed them, and a parser only ever LEARNS to record more —
 * absolute hp, stat stages, miss/immune/fail flags were each added to records that already existed.
 * So more bytes means more fields recovered from the same replay. If that assumption is ever false
 * the raw logs are still on disk and engine/reprocess.js rebuilds the truth from them.
 */
'use strict';
const fs = require('fs');

const [O, A, Bp, P] = process.argv.slice(2);

function read(path) {
  const m = new Map();
  let text;
  try { text = fs.readFileSync(path, 'utf8'); } catch (e) { return m; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let g;
    try { g = JSON.parse(line); } catch (e) { continue; }
    if (!g || !g.id) continue;
    const prev = m.get(g.id);
    if (!prev || line.length > prev.length) m.set(g.id, line);
  }
  return m;
}

const ours = read(A), theirs = read(Bp);
const out = new Map(ours);
let added = 0, upgraded = 0;
for (const [id, line] of theirs) {
  const have = out.get(id);
  if (!have) { out.set(id, line); added++; continue; }
  if (line.length > have.length) { out.set(id, line); upgraded++; }
}

/* THE ONE THING THIS MUST NEVER DO. A union cannot be smaller than either input, so if it is, the
 * parse dropped records and writing the result would destroy history. Fail instead and leave git to
 * raise the conflict the ordinary way — a stopped merge is recoverable, a quietly truncated store
 * is not. */
if (out.size < ours.size || out.size < theirs.size) {
  process.stderr.write(`merge-jsonl-store: REFUSING ${P || A} — union ${out.size} is smaller than ` +
    `ours ${ours.size} / theirs ${theirs.size}. Resolve by hand.\n`);
  process.exit(1);
}

fs.writeFileSync(A, out.size ? [...out.values()].join('\n') + '\n' : '');
process.stderr.write(`merge-jsonl-store: ${P || A} -> ${out.size} games ` +
  `(ours ${ours.size}, theirs ${theirs.size}, ${added} taken from theirs, ${upgraded} richer copies)\n`);
