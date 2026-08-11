/* tests/test-unmodelled-clicks.js — ROADMAP #125. THE TERMINAL FALL-THROUGH NOW HAS A COUNTER.
 *
 *   node tests/test-unmodelled-clicks.js
 *
 * `playerActionPrimary` ends in `return {kind:'pass', mv:id}` — "this engine models no effect for that
 * click" — and for the whole life of this file that line was SILENT. A move no branch claimed became a
 * WHOLE NO-OP TURN and nothing anywhere said so. Nine of the thirteen rows the precondition layer
 * exposed on 2026-08-10 arrived through that one line, and exactly ONE of the thirteen was named by
 * any counter (`MEDFAILS.healProceduralFirst`, naming `swallow`). That is CLAUDE.md's founding failure
 * — a capability absent and everything reporting success — sitting in the exact place built to catch
 * it, which is why those moves stayed invisible until somebody pointed a probe at each one by hand.
 *
 * WHAT THIS FILE ASSERTS, and it is deliberately not "the number is zero":
 *
 *   1. THE COUNTER IS WIRED. A move that lands there increments it and NAMES ITSELF. A capability that
 *      cannot prove it ran is assumed broken, and this counter's whole job is to prove a FAILURE ran.
 *   2. IT DOES NOT OVER-FIRE. A modelled click adds nothing, and a BARE `{kind:'pass'}` built by a
 *      caller (the idle ally in ~200 probes, game_differential's empty slot) is not counted either —
 *      that is a legitimate no-action, and counting it would drown the signal in exactly the way a
 *      counter nobody reads is born.
 *   3. THE QUEUE IS PRINTED, WITH USAGE. The number is a QUEUE LENGTH that must fall, not a bar that
 *      must be zero today. `--list` is the whole point of the row: Will is owed the list.
 *
 * IT IS A RATCHET, NOT A GATE. The set may shrink and may never grow: a new move resolving to a no-op
 * turn is a regression however small its usage, and the file goes red on it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));

let fails = 0;
const ok = (c, label, detail) => {
  console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? '   ' + detail : ''));
  if (!c) fails++;
};

console.log('UNMODELLED CLICKS — the terminal fall-through of the classifier (ROADMAP #125)\n');

const mk = (s) => { const b = M.buildMon(s, {}); b.item = ''; b.ability = 'none'; return b; };
const me = mk('garchomp'), ally = mk('skeledirge'), f1 = mk('incineroar'), f2 = mk('farigiraf');
const S = M.battleInit([me, ally], [f1, f2], { seeded: true });

/* ---- 1. THE SWEEP ------------------------------------------------------------------------------ */
const before = M.MEDFAILS.unmodelledClick;
for (const id of Object.keys(MC.moves)) {
  try { M.playerAction(me, id, f1, S.field); } catch (e) { /* a throw is a different defect */ }
}
const by = M.MEDFAILS.unmodelledClickBy;
const rows = Object.keys(by).map(id => ({ id, uses: ((TAGS.moves[id] || {}).uses) || 0 }))
  .sort((a, b) => b.uses - a.uses || a.id.localeCompare(b.id));
const clicks = rows.reduce((s, r) => s + r.uses, 0);

console.log('  THE LIST — every move in this format that resolves to a whole no-op turn:');
for (const r of rows) console.log('    ' + String(r.uses).padStart(6) + '  ' + r.id);
console.log('    ' + String(clicks).padStart(6) + '  TOTAL over ' + rows.length + ' move(s)\n');

ok(M.MEDFAILS.unmodelledClick > before, 'the counter fires at all',
   before + ' -> ' + M.MEDFAILS.unmodelledClick);
ok(!!M.MEDFAILS.unmodelledClickFirst, 'and it names its first offender',
   M.MEDFAILS.unmodelledClickFirst);
ok(rows.length > 0 && rows.every(r => !!MC.moves[r.id]),
   'every id it recorded is a real move in the compact table');

/* ---- 2. IT DOES NOT OVER-FIRE ------------------------------------------------------------------- */
{
  const n0 = M.MEDFAILS.unmodelledClick;
  M.playerAction(me, 'earthquake', f1, S.field);
  M.playerAction(me, 'protect', null, S.field);
  M.playerAction(me, 'swordsdance', null, S.field);
  ok(M.MEDFAILS.unmodelledClick === n0, 'a MODELLED click adds nothing',
     'earthquake / protect / swordsdance');
}
{
  /* A caller-built bare pass carries no `mv`, so `playerAction` is never involved and nothing is
   * counted. Asserted through the real classifier with an empty id, which is the same road. */
  const n0 = M.MEDFAILS.unmodelledClick;
  const a = M.playerAction(me, '', f1, S.field);
  ok(a && a.kind === 'pass' && M.MEDFAILS.unmodelledClick === n0,
     'a BARE pass with no move id is not counted', 'kind=' + (a && a.kind));
}

/* ---- 3. THE RATCHET ----------------------------------------------------------------------------- */
const OUT = D('data', 'unmodelled-clicks.json');
let prev = null;
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { prev = null; }
if (prev && Array.isArray(prev.moves)) {
  const grew = rows.map(r => r.id).filter(id => prev.moves.indexOf(id) < 0);
  ok(grew.length === 0,
     'the set did not GROW — a new no-op turn is a regression however small its usage',
     grew.length ? 'NEW: ' + grew.join(', ') : prev.moves.length + ' -> ' + rows.length);
  if (rows.length < prev.moves.length) {
    console.log('  note  the queue SHRANK ' + prev.moves.length + ' -> ' + rows.length + ': '
      + prev.moves.filter(id => rows.every(r => r.id !== id)).join(', '));
  }
} else {
  console.log('  note  no baseline on disk — this run writes the first one.');
}

fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(), by: 'tests/test-unmodelled-clicks.js',
  what: 'Every move in gen9championsvgc2026regmb whose click resolves to {kind:"pass"} — a whole '
      + 'no-op turn. RATCHETED: the set may shrink and may never grow.',
  count: rows.length, clicks, moves: rows.map(r => r.id), rows,
}, null, 1) + '\n');
console.log('\n  wrote data/unmodelled-clicks.json');
console.log(fails ? '\nUNMODELLED CLICKS: ' + fails + ' FAILED' : '\nUNMODELLED CLICKS: all checks passed');
process.exitCode = fails ? 1 : 0;
