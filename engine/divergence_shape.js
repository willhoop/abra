/* divergence_shape.js — WHAT THE TWO PROTOCOL LINES ACTUALLY DISAGREE ABOUT. ONE IMPLEMENTATION.
 *
 * This was written inside `engine/divergence_report.js` on 2026-08-11 and stayed there for a day. It
 * moved out the moment a SECOND reader needed it: `engine/game_differential.js` cross-tabs the
 * end-state verdict against the shape, and a second copy of "same event, different slot means
 * ORDERING" is exactly the two-implementations-of-one-fact CLAUDE.md forbids. The two would have
 * agreed on the day they were written and diverged the first time either was tuned.
 *
 * THE SHAPES, and why the differential's own class names are the wrong grouping:
 *
 *   ORDERING  same event, different slot   — the two engines did the same thing in a different order.
 *   RULE      same slot, different event   — they disagree about what happened to that body.
 *   FIELD     same event and slot, a field differs — they agree on the event and not on its value.
 *   EMISSION  one side has a line the other does not.
 *   UNPARSED  the cause string is not two protocol lines and cannot be shaped at all. It is NOT a
 *             fifth kind of disagreement and must never be read as one — it is the comparator saying
 *             it could not tell, which is a gap in this file rather than a fact about the engines.
 *
 * The weather-residual defect was SIX causes that read as separate rows and turned out to be one rule.
 * Protect is FIFTEEN causes spread across FOUR of the differential's classes at once.
 *
 * `PINNED` marks a cause naming a mechanic that reads one of Mode A's pinned dice. It is a SUSPECT
 * flag and never an exclusion: the Protect case proved a coupling suspect can still be a real
 * disagreement, because the authority was pinned the same way and the divergence survived anyway.
 *
 * ---- THE CLASS NAME IS STRIPPED AT THE SEPARATOR, NOT AT A COLON (2026-08-20, MEASURE) -----------
 *
 * `stripClass` was `String(cause).replace(/^[^:]*:: /, '')`, and `[^:]*` cannot pass a class name
 * that CONTAINS a colon. `classify()` in `engine/game_differential.js` builds
 * `<class> :: <line> <> <line>`, and one of its classes is `sdEv + ': a different body'` — so every
 * `drag:`, `switch:` and `-damage: a different body` fell out of the shaper with its class name still
 * attached, failed `startsWith('|')`, and landed in UNPARSED.
 *
 * THAT MADE UNPARSED READ AS A CLASS OF DISAGREEMENT WHEN IT IS THIS FILE'S OWN GAP, which is exactly
 * what the header above says it must never be read as. Measured on the 797-game end-state run
 * (`data/verification/gd-endstate-982.json`, release `94a84744346d`): **26 of 145 parted games** were
 * shaped UNPARSED and 22 of them ended on a different board — 85%, the highest rate of the five, and
 * the reason a bucket meaning "could not tell" was being quoted as the most dangerous shape.
 *
 * The separator is ` :: ` and no class classify() writes contains it (`ordering`, `turn order`,
 * `unrelated event mismatch`, `<event>: a different body`, `<event> field <n>`, the two truncation
 * classes, and the two emission classes). Splitting there passes a colon inside the class name and
 * leaves a genuine non-pair — a TRUNCATION cause carries ONE line — still UNPARSED, which is the only
 * thing that word should ever mean. The old regex is kept as a fallback for a cause written by
 * something older that used `<class>:: ` with no leading space; it is tried second, so it can no
 * longer eat a class name it cannot parse.
 */
'use strict';

const LINE = (s) => {
  const t = String(s || '').trim();
  if (!t.startsWith('|')) return null;
  const parts = t.split('|').slice(1);
  return { event: parts[0] || '', slot: (parts[1] || '').split(':')[0], rest: parts.slice(2).join('|') };
};

const PINNED = /accuracy|acc\b|crit|secondar|damage|protect|stall|miss|-fail/i;

/* THE SEPARATOR `classify()` WRITES, ONE PLACE. A second spelling of it here and in the differential
 * would agree on the day it was written and part the first time either moved. */
const SEP = ' :: ';
function stripClass(cause) {
  const s = String(cause == null ? '' : cause);
  const i = s.indexOf(SEP);
  if (i >= 0) return s.slice(i + SEP.length);
  return s.replace(/^[^:]*:: /, '');
}

function shapeOf(cause) {
  const body = stripClass(cause);
  const half = body.split(' <> ');
  const a = LINE(half[0]), b = LINE(half[1]);
  if (!a || !b) return { shape: 'UNPARSED', key: body.slice(0, 40) };
  if (a.event === b.event && a.slot !== b.slot) return { shape: 'ORDERING', key: a.event };
  if (a.slot === b.slot && a.event !== b.event) return { shape: 'RULE', key: a.event + ' vs ' + b.event };
  if (a.event === b.event && a.slot === b.slot) return { shape: 'FIELD', key: a.event };
  return { shape: 'EMISSION', key: a.event + ' vs ' + b.event };
}

/* ---- THE SELF-PROOF, ON SYNTHETIC CAUSES, IN MILLISECONDS ---------------------------------------
 *
 * Every row is a REAL cause shape `classify()` writes — the first four are copied from
 * `data/game-differential.json`. Two of them are the whole point and each FAILS BY NAME under the old
 * `^[^:]*:: ` strip: a class name carrying a colon must shape as the pair it is, and its key must be
 * the EVENT rather than the class, so a half fix that strips the wrong amount is caught too.
 *
 * AND THE OTHER DIRECTION IS PROVEN, because the danger of a looser strip is that UNPARSED stops
 * meaning anything: a TRUNCATION cause carries ONE line and MUST stay UNPARSED, and so must a string
 * that is not a cause at all. A strip that turned those into pairs would be silently inventing
 * disagreements — the opposite error, and equally invisible in a count.
 *
 *   node engine/divergence_shape.js --selftest
 */
const PROOF = [
  ['a class with no colon still strips', 'ordering :: |move|p1a|protect <> |move|p2b|protect', 'ORDERING', 'move'],
  ['A CLASS NAME CONTAINING A COLON — the defect', 'drag: a different body :: |drag|p1a|talonflame,l50|H/H <> |drag|p1a|sableye,l50|H/H', 'FIELD', 'drag'],
  ['the same, one event over', '-damage: a different body :: |-damage|p2a|H/H <> |-damage|p2b|H/H', 'ORDERING', '-damage'],
  ['a TRUNCATION carries one line and stays UNPARSED', 'showdown stopped emitting while medicham2 continued :: |switch|p1b|klefki,l50|H/H', 'UNPARSED', null],
  ['one side has a line the other does not', 'x :: |-damage|p1a|H/H <> |-sideend|p2|tailwind', 'EMISSION', null],
  ['same slot, different event', 'x :: |-activate|p1a|x <> |-damage|p1a|H/H', 'RULE', null],
  ['a string that is not a cause at all', 'nothing parseable here', 'UNPARSED', null],
  ['the legacy `<class>:: ` spelling, no leading space', 'ordering:: |move|p1a|protect <> |move|p2b|protect', 'ORDERING', 'move'],
];
function selfProof() {
  return PROOF.map(([what, cause, want, wantKey]) => {
    const got = shapeOf(cause);
    return { what, cause, want, got: got.shape, key: got.key,
             ok: got.shape === want && (wantKey == null || got.key === wantKey) };
  });
}

module.exports = { LINE, PINNED, shapeOf, stripClass, selfProof, SEP,
                   SHAPES: ['ORDERING', 'RULE', 'FIELD', 'EMISSION', 'UNPARSED'] };

if (require.main === module && process.argv.includes('--selftest')) {
  const rows = selfProof();
  for (const r of rows) console.log('  ' + (r.ok ? 'ok   ' : 'FAIL ') + r.want.padEnd(9)
    + (r.ok ? '' : 'got ' + r.got + ' key=' + JSON.stringify(r.key) + '  ') + r.what);
  const bad = rows.filter(r => !r.ok).length;
  console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'all ' + rows.length + ' shapes as declared'));
  process.exit(bad ? 1 : 0);
}
