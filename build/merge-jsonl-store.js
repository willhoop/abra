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

/* AN UNREADABLE FILE IS NOT AN EMPTY FILE, and conflating them is how this script could destroy the
 * store. The old version was `catch (e) { return m; }` with m empty — so a permissions error, a
 * transient lock, or a wrong path made OUR side look like zero records, the union became THEIRS
 * alone, and the local store was silently replaced. It then exited 0.
 *
 * ENOENT is the one legitimate case (a first run, or a store that does not exist on this machine).
 * Everything else throws. Whole-repo review, 2026-07-31. */
function read(path) {
  const m = new Map();
  let text;
  try { text = fs.readFileSync(path, 'utf8'); }
  catch (e) {
    if (e && e.code === 'ENOENT') return { map: m, existed: false, lines: 0 };
    throw new Error(`merge-jsonl-store: cannot read ${path} (${e.code || e.message}). ` +
      'Refusing to treat an unreadable store as an empty one.');
  }
  let lines = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    lines++;
    let g;
    try { g = JSON.parse(line); } catch (e) { continue; }
    if (!g || !g.id) continue;
    const prev = m.get(g.id);
    if (!prev || line.length > prev.length) m.set(g.id, line);
  }
  return { map: m, existed: true, lines };
}

const oursR = read(A), theirsR = read(Bp);
const ours = oursR.map, theirs = theirsR.map;

/* THE REAL GUARD, because the old one could not fire. It compared the union against its own inputs:
 * `out` starts as a copy of `ours` and only ever grows, so `out.size < ours.size` is impossible and
 * `out.size < theirs.size` is impossible too — every id in theirs is added when missing. The check
 * labelled "the one thing this must never do" was a tautology and had never once protected anything.
 *
 * What can actually go wrong is PARSING: a file with content whose records all fail to parse yields
 * an empty map, and an empty map merges away silently. So the comparison is against the raw line
 * count on disk, which is the only number the parser cannot manufacture. */
for (const [label, r, file] of [['ours', oursR, A], ['theirs', theirsR, Bp]]) {
  if (!r.existed) continue;
  if (r.lines > 0 && r.map.size === 0) {
    process.stderr.write(`merge-jsonl-store: REFUSING — ${file} has ${r.lines} non-empty lines but ` +
      `produced 0 usable records (${label}). Every line failed to parse or carried no id; merging ` +
      'would drop all of them. Resolve by hand.\n');
    process.exit(1);
  }
  /* A large parse loss is not proof of corruption, but it is never normal, and the store is
   * append-only so it cannot legitimately shrink. Half is a wide margin around duplicate ids. */
  if (r.lines > 100 && r.map.size < r.lines * 0.5) {
    process.stderr.write(`merge-jsonl-store: REFUSING — ${file} has ${r.lines} lines but only ` +
      `${r.map.size} usable records (${label}). More than half were unparseable or id-less.\n`);
    process.exit(1);
  }
}

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
/* Kept as an assertion of the invariant rather than as a guard: it cannot fire given the loop above,
 * and saying so is better than implying a protection that does not exist. If it ever DOES fire, the
 * merge logic itself has changed and that is worth stopping for. */
if (out.size < ours.size || out.size < theirs.size) {
  process.stderr.write(`merge-jsonl-store: INVARIANT BROKEN — union ${out.size} is smaller than ` +
    `ours ${ours.size} / theirs ${theirs.size}. The merge loop no longer only grows the set.\n`);
  process.exit(1);
}

fs.writeFileSync(A, out.size ? [...out.values()].join('\n') + '\n' : '');
process.stderr.write(`merge-jsonl-store: ${P || A} -> ${out.size} games ` +
  `(ours ${ours.size}, theirs ${theirs.size}, ${added} taken from theirs, ${upgraded} richer copies)\n`);
