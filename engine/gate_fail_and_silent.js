/* gate_fail_and_silent.js — ROADMAP #241 PART (3): THE AUTHORITY ANNOUNCES A FAILURE AND THIS
 * ENGINE SAYS NOTHING. The row's own `INSTRUMENT OWED`, built.
 *
 * ================= WHAT THE ROW ASKED FOR, IN ITS OWN WORDS ======================================
 *
 *   "INSTRUMENT OWED: a ratchet over the -fail-and-silent cause count in
 *    `data/game-differential.json`, which can now carry one because the artifact has been re-run —
 *    3 is the number it would be seeded at, and seeding a ratchet is a decision with an owner
 *    rather than a side effect of this measurement."
 *
 * Nothing decided this row by exit code. `engine/game_differential.js` MEASURES the class and
 * deliberately exits 0 on it — *"a divergence is a FINDING"*, its own header — and
 * `tests/test-game-differential.js` fails only when the INSTRUMENT is wrong. Pointing a `VERIFIED BY`
 * at either would have made a live defect read CONFIRMED-and-green, which is worse than the prose it
 * replaced.
 *
 * ================= WHY THE VERDICT IS "ANY AT ALL", AND THE PIN IS THE SECOND HALF ===============
 *
 * A ratchet ALONE would be the wrong instrument for an OPEN row. Seeded at today's count it reads
 * GREEN on the day it is built, `engine/register_reality.js` compares that to an OPEN status and
 * reports **STALE ROW** — the loudest verdict it has, the one that costs an agent — about a defect
 * that is demonstrably live. A gate must be RED while the thing it names is broken.
 *
 * So there are two bars and they are reported separately:
 *
 *   count === 0      GREEN. The class is empty: the authority emits no bare `-fail` this engine is
 *                    silent about. That is the day #241(3) closes, and it closes on a measurement.
 *   0 < count <= PIN RED, exit 1. The defect is live at or under the seeded count.
 *   count > PIN      RED, exit 3, and named as a REGRESSION rather than folded into the same red.
 *                    A ratchet that only ever says "still broken" cannot tell a fix that stalled
 *                    from one that went backwards.
 *
 * ================= THE COUNTING RULE IS DERIVED, NOT TYPED ======================================
 *
 * The class is `event missing from medicham2` — showdown emitted a line and this engine did not, so
 * the comparator lines the authority's orphan against OUR NEXT LINE. The row's shape is therefore
 * "the LEFT half is a `-fail`", and the left half is parsed with `engine/divergence_shape.js`'s own
 * `LINE`, never with a second regex: CLAUDE.md's rule is that two implementations of one fact
 * disagree eventually and the disagreement is invisible because both keep working. Measured
 * 2026-08-18 on release `6875c8ace00e`: exactly the three the row names — a `-fail` against a Taunt
 * click, a `-fail` against an Encore click, and a `-fail` against the sandstorm upkeep.
 *
 * ================= WHAT IT REFUSES TO ANSWER ====================================================
 *
 * A missing artifact, an artifact with no classes, or an artifact measured against other bytes:
 * exit 2. `wholeGameClause` refuses a mismatched release for the same reason and #298 is the receipt
 * for what happens when it does not. Exit 2 is RED to `register_reality.js` exactly as 1 and 3 are —
 * separating them is legibility, not leniency. A gate that exits 0 because it could not look is the
 * capability-absent-and-everything-reports-success shape.
 *
 *   node engine/gate_fail_and_silent.js              the verdict, with every matching cause named
 *   node engine/gate_fail_and_silent.js --json
 *   node engine/gate_fail_and_silent.js --selftest   every branch on synthetic input, red and green
 *
 * Reads two artifacts. Runs no games and loads no simulator. */
'use strict';
const fs = require('fs');
const path = require('path');
const SHAPE = require('./divergence_shape.js');

const ROOT = path.resolve(__dirname, '..');
const has = (f) => process.argv.includes(f);

/* THE SEED, AND IT IS A DECISION WITH A DATE AND AN OWNER RATHER THAN A SIDE EFFECT OF A RUN.
 *
 * ================= THE PIN CARRIES ITS SAMPLE, AND THAT COST A FALSE REGRESSION ==================
 *
 * THIS PIN WAS 3 AND IT WAS RE-SEEDED THE SAME DAY, AND THE REASON IS THE WHOLE OF THIS BLOCK.
 * The first seed — 3 causes / 3 games — was measured on a 1,230-game artifact. The differential was
 * re-run hours later on the CURRENT tree and the same predicate returned **30 causes / 51 games**, so
 * this gate exited 3 and said *"This got WORSE"*. IT HAD NOT. The driver's sample selector had moved:
 * the run steers off `data/mechanics-census.json`, which is regenerated, and picks teams from a pool
 * read LIVE from the store OPS appends to. Same predicate, different games.
 *
 * MEASURED RATHER THAN ARGUED. `engine/game_differential.js --release 6875c8ace00e` replays the OLD
 * engine bytes under TODAY's steering, so the two arms differ in the engine and in nothing else. The
 * `event missing from medicham2` block is **byte-identical across the two releases** — 92 games, 67
 * distinct causes, the same four `-fail <> upkeep` heads at 8/6/5/5 — and the primary arm is
 * 700 of 995 on both. The engine did not move at all; the SAMPLE did.
 *
 * SO A PIN WITHOUT ITS SAMPLE STAMP IS NOT A BAR, IT IS A COINCIDENCE. `SAMPLE` below records the
 * census digest that STEERED the run and the team-pool digest that supplied the pairs, both straight
 * out of the artifact, and a REGRESSION verdict is WITHHELD whenever they differ — the gate still
 * reports the defect LIVE and red, it simply refuses to attribute a movement to the engine when the
 * population underneath it changed. That refusal is the same rule `engine/arms_comparable.js` applies
 * to two arms and the same one CLAUDE.md states about SLOWKING's cycle: check the corpus stamps
 * before crediting a lever. */
const PIN = 30;
const SAMPLE = { census: '2e3953f1f882', pool: '631d4ea60a80', games: 995 };
const PIN_NOTE = 're-seeded 2026-08-18 by MEASURE at 30 causes / 51 games (995 games, arm A/middle, '
  + 'release 978ca8fe72c9, census 2e3953f1f882, team pool 631d4ea60a80). NOT a before/after against '
  + 'the earlier seed of 3 or the row\'s older upper bound of 8: the paired --release arm shows this '
  + 'class byte-identical across both releases under one sample, so every one of those differences is '
  + 'the sample and none of it is the engine.';
const CLASS = 'event missing from medicham2';

/* THE SAMPLE THIS ARTIFACT ACTUALLY MEASURED, read from the run's own stamp rather than assumed. */
function sampleOf(artifact) {
  const s = (artifact && artifact.steering) || {};
  return { census: s.input_digest || null, pool: s.team_pool_digest || null,
    games: +(artifact && artifact.games) || 0 };
}
function sampleMatches(got) {
  return !!got && got.census === SAMPLE.census && got.pool === SAMPLE.pool && got.games === SAMPLE.games;
}

/* THE ONE PLACE THAT DECIDES WHETHER A CAUSE IS THIS ROW'S SHAPE. Exported so the selftest drives
 * the shipping predicate rather than a restatement of it. */
function isFailAndSilent(cause) {
  const body = String(cause == null ? '' : cause).replace(/^[^:]*:: /, '');
  const half = body.split(' <> ');
  if (half.length !== 2) return false;
  const authority = SHAPE.LINE(half[0]);
  return !!authority && authority.event === '-fail';
}

function count(artifact) {
  const cls = Array.isArray(artifact && artifact.classes) ? artifact.classes : null;
  if (!cls) return null;
  const row = cls.find((c) => c && c.cls === CLASS);
  const hits = [];
  for (const k of ((row && row.causes) || [])) {
    if (isFailAndSilent(k && k.cause)) hits.push({ cause: String(k.cause), games: +k.n || 0 });
  }
  hits.sort((a, b) => b.games - a.games);
  return { hits, causes: hits.length, games: hits.reduce((s, h) => s + h.games, 0) };
}

/* THE VERDICT TABLE, EXTRACTED SO IT CAN BE DRIVEN DIRECTLY. `code` is the process exit code.
 *
 * `sameSample` gates the REGRESSION branch and NOTHING ELSE. A count over the pin on another
 * population is still red — the defect is still there — but it is reported LIVE, because calling it
 * a regression names a cause that has not been measured. */
function verdict(c, sameSample) {
  if (c === null) return { code: 2, tag: 'CANNOT ANSWER' };
  if (c.causes === 0) return { code: 0, tag: 'CLEAN' };
  if (c.causes > PIN && sameSample === true) return { code: 3, tag: 'REGRESSION' };
  return { code: 1, tag: 'LIVE' };
}

if (has('--selftest')) {
  let ran = 0, bad = 0;
  const ok = (n, c, got) => { ran++; if (!c) bad++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '   got ' + JSON.stringify(got)}`); };
  const ART = (causes) => ({ classes: [{ cls: CLASS, causes }] });
  const C = (cause, n) => ({ cause: CLASS + ' :: ' + cause, n });

  /* -- the predicate, on the three real causes and on their neighbours in the same class -------- */
  ok('the row\'s own three causes are recognised',
    isFailAndSilent(CLASS + ' :: |-fail|p1b <> |move|p2b|taunt')
    && isFailAndSilent(CLASS + ' :: |-fail|p2a <> |move|p1b|encore')
    && isFailAndSilent(CLASS + ' :: |-fail|p1b <> |-weather|sandstorm|[upkeep]'));
  ok('RED — a sibling in the SAME class that is not a `-fail` is NOT counted, so the ratchet cannot '
    + 'drift into counting the whole class',
    !isFailAndSilent(CLASS + ' :: |-singleturn|p1b|focuspunch <> |move|p1b|focuspunch')
    && !isFailAndSilent(CLASS + ' :: |-weather|raindance|[upkeep] <> |upkeep'));
  ok('RED — a `-fail` on OUR side (the right half) is the mirror defect and is NOT this row',
    !isFailAndSilent(CLASS + ' :: |move|p1a|taunt <> |-fail|p1b'));
  ok('a cause with no ` <> ` split cannot be shaped and is not counted',
    !isFailAndSilent(CLASS + ' :: something the comparator could not shape'));
  ok('null and undefined are not counted', !isFailAndSilent(null) && !isFailAndSilent(undefined));

  /* -- the counter ----------------------------------------------------------------------------- */
  const three = count(ART([C('|-fail|p1b <> |move|p2b|taunt', 1), C('|-fail|p2a <> |move|p1b|encore', 1),
    C('|-fail|p1b <> |-weather|sandstorm|[upkeep]', 1), C('|-weather|raindance|[upkeep] <> |upkeep', 4)]));
  ok('the counter reports CAUSES and GAMES separately, and ignores the rest of the class',
    three.causes === 3 && three.games === 3, three);
  ok('a class that is absent entirely counts zero rather than failing to parse',
    count({ classes: [{ cls: 'ordering', causes: [] }] }).causes === 0);
  ok('RED — an artifact with NO classes array cannot be counted and returns null, never 0',
    count({ games: 100 }) === null);

  /* -- the verdict, every branch --------------------------------------------------------------- */
  ok('GREEN only at zero', verdict({ causes: 0, games: 0 }, true).code === 0);
  ok('RED — the defect at the seeded count is LIVE and exits 1, NOT green: an open row whose gate is '
    + 'green reads as a STALE ROW, which is the verdict that costs an agent',
    verdict({ causes: PIN, games: PIN }, true).code === 1);
  ok('RED — one BELOW the pin is still live and still red', verdict({ causes: 1, games: 1 }, true).code === 1);
  ok('RED — one ABOVE the pin ON THE PINNED SAMPLE is a REGRESSION and is named as one, on its own '
    + 'exit code',
    verdict({ causes: PIN + 1, games: 9 }, true).code === 3
    && verdict({ causes: PIN + 1, games: 9 }, true).tag === 'REGRESSION');
  ok('RED — CANNOT ANSWER is exit 2 and is never 0', verdict(null, true).code === 2);

  /* -- THE SAMPLE STAMP, which is the half that cost a false REGRESSION ------------------------- */
  ok('RED — over the pin on ANOTHER sample is LIVE, not REGRESSION: the count is still red, and the '
    + 'word that names a CAUSE is withheld because the population moved',
    verdict({ causes: PIN + 100, games: 999 }, false).code === 1
    && verdict({ causes: PIN + 100, games: 999 }, false).tag === 'LIVE');
  ok('RED — an UNKNOWN sample is not a matching one either', verdict({ causes: PIN + 1, games: 9 }, null).code === 1);
  ok('the sample stamp is read out of the run\'s own steering block, not assumed',
    sampleOf({ games: 995, steering: { input_digest: 'aa', team_pool_digest: 'bb' } }).census === 'aa'
    && sampleOf({ games: 995, steering: { input_digest: 'aa', team_pool_digest: 'bb' } }).pool === 'bb'
    && sampleOf({ games: 995, steering: { input_digest: 'aa', team_pool_digest: 'bb' } }).games === 995);
  ok('an artifact with no steering block matches nothing rather than matching by default',
    sampleMatches(sampleOf({ games: 995 })) === false);
  ok('the pinned sample matches itself, so the REGRESSION branch is reachable at all',
    sampleMatches({ census: SAMPLE.census, pool: SAMPLE.pool, games: SAMPLE.games }) === true);
  ok('RED — one digit different in EITHER digest, or a different game count, is a different sample',
    sampleMatches({ census: SAMPLE.census, pool: 'xxxxxxxxxxxx', games: SAMPLE.games }) === false
    && sampleMatches({ census: 'xxxxxxxxxxxx', pool: SAMPLE.pool, games: SAMPLE.games }) === false
    && sampleMatches({ census: SAMPLE.census, pool: SAMPLE.pool, games: SAMPLE.games + 1 }) === false);

  console.log(`\nFAIL-AND-SILENT GATE SELFTEST: ${ran - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ---- the run ---------------------------------------------------------------------------------- */
const P = path.join(ROOT, 'data', 'game-differential.json');
let art = null, readWhy = null;
try { art = JSON.parse(fs.readFileSync(P, 'utf8')); }
catch (e) { readWhy = String((e && e.message) || e).split('\n')[0]; }

let relWhy = null;
if (art) {
  let cur = null;
  try { cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'engine-release.json'), 'utf8')); } catch (e) { /* none */ }
  const curId = cur && (cur.id || cur.release || cur.current);
  const ranOn = art.engine_release || art.release || null;
  if (ranOn && curId && ranOn !== curId) {
    relWhy = 'MEASURED AGAINST A DIFFERENT ENGINE — the artifact ran on release ' + ranOn
      + ' and the tree is ' + curId + '. The count is WITHHELD rather than printed with a caveat.';
  }
}

const c = (art && !relWhy) ? count(art) : null;
const got = art ? sampleOf(art) : null;
const same = art ? sampleMatches(got) : null;
const v = verdict(c, same);
const sampleLine = got
  ? 'census ' + (got.census || '(none)') + ' / pool ' + (got.pool || '(none)') + ' / ' + got.games + ' games'
  : '(no artifact)';
const out = {
  row: 241, part: 3, gate: 'engine/gate_fail_and_silent.js',
  what: 'causes in the `' + CLASS + '` class where the AUTHORITY half is a bare `-fail` this engine '
      + 'never emits',
  pin: PIN, pin_note: PIN_NOTE, pinned_sample: SAMPLE, run_sample: got, sample_matches: same,
  artifact: 'data/game-differential.json',
  generated: (art && art.generated) || null,
  engine_release: (art && (art.engine_release || art.release)) || null,
  causes: c ? c.causes : null, games: c ? c.games : null,
  verdict: v.tag, exit: v.code,
  why: readWhy ? 'NO ARTIFACT — data/game-differential.json could not be read (' + readWhy + ').'
     : relWhy ? relWhy
     : c === null ? 'THE ARTIFACT CARRIES NO `classes` ARRAY, so this row cannot be counted at all.'
     : c.causes === 0 ? 'CLEAN — the authority emits no bare `-fail` that this engine is silent about.'
     : v.code === 3 ? 'REGRESSION — ' + c.causes + ' cause(s) over ' + c.games + ' game(s), against '
        + 'a pin of ' + PIN + ' ON THE SAME SAMPLE. This got WORSE.'
     : c.causes + ' cause(s) over ' + c.games + ' game(s) — the defect is LIVE. This clause is green '
        + 'only at zero.'
        + (c.causes > PIN && same !== true
          ? '  THE REGRESSION VERDICT IS WITHHELD: the pin was seeded on census ' + SAMPLE.census
            + ' / pool ' + SAMPLE.pool + ' / ' + SAMPLE.games + ' games and this run is ' + sampleLine
            + '. A count over the pin on another population names no cause. Re-seed the pin against '
            + 'this sample, or replay the pinned one.'
          : ''),
  causes_seen: c ? c.hits : [],
};

if (has('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(v.code); }

console.log('');
console.log('ROADMAP #241(3) — a `-fail` the authority emits and this engine does not');
console.log('  artifact  data/game-differential.json   generated ' + (out.generated || '?')
          + '   release ' + (out.engine_release || '(unstamped)'));
console.log('  pin       ' + PIN + '   [' + PIN_NOTE + ']');
console.log('  sample    pinned: census ' + SAMPLE.census + ' / pool ' + SAMPLE.pool + ' / '
          + SAMPLE.games + ' games');
console.log('            this run: ' + sampleLine + '   -> ' + (same === true ? 'SAME SAMPLE, a '
          + 'movement is attributable' : 'A DIFFERENT SAMPLE, so no movement is attributable'));
console.log('');
console.log('  ' + v.tag + '   ' + out.why);
for (const h of out.causes_seen) console.log('      ' + String(h.games).padStart(4) + '  ' + h.cause);
console.log('');
console.log('  exit ' + v.code + '   [0 clean, 1 live at or under the pin, 2 cannot answer, 3 REGRESSION]');
console.log('');
process.exit(v.code);
