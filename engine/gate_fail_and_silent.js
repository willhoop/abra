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
 * ================= WHAT THIS GATE DOES NOT MATCH: ONE SHAPE IN ONE CLASS ========================
 *
 * A GATE THAT CATCHES ITS INSTANCE AND NOT ITS CLASS MUST SAY SO IN ITS OWN HEADER. This project has
 * paid three times for the opposite: the species-key mismatch was found, fixed and gated twice, and
 * the third instance walked past both gates because the ratchet had been written as a list of
 * known-bad spellings rather than as one door everyone goes through. So this is stated here rather
 * than left for a reader to infer from `isFailAndSilent`.
 *
 * `isFailAndSilent` requires BOTH of:
 *   (a) the cause sits in the class `event missing from medicham2`, and
 *   (b) the AUTHORITY half (the left half, before ` <> `) is a `-fail`.
 *
 * WHAT WALKS PAST IT, AND IT IS NOT HYPOTHETICAL. An authority `-fail` that the comparator files
 * under a DIFFERENT class is invisible here. Measured 2026-08-25 on release `9cfe6b3b97a8` (961
 * games), while this gate read CLEAN at zero, `data/game-differential.json` carried in
 * `unrelated event mismatch`: the authority announcing a bare `-fail` on p2b where this engine
 * announces a Disable start on p1a. That is an authority failure this engine does not emit — it is
 * simply not SILENT, it says something else, so it falls outside (a).
 *
 * THAT IS DELIBERATE AND IT IS ALSO A LIMIT. ROADMAP #241(3) is scoped to *the authority announces a
 * failure and this engine says NOTHING*, and widening this gate to "any cause containing a `-fail`"
 * would make it a second, weaker implementation of the whole-game differential. The rows that walk
 * past are NOT unowned: every one of them is a divergence counted by `wholeGameClause` and by
 * ROADMAP #218, which is red until the whole-game differential reaches zero.
 *
 * SO: A GREEN HERE MEANS THE `-fail`-AND-SILENT CLASS IS EMPTY. IT DOES NOT MEAN NO `-fail`
 * DISAGREEMENT REMAINS. Anyone quoting this gate as the latter is quoting it wrong, and the mirror
 * shape proves the point from the other side — an OUR-side `-fail` against an authority Protect is
 * excluded by name in the selftest below, and is likewise live and likewise counted by #218.
 * * ================= WHAT IT REFUSES TO ANSWER ====================================================
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

/* THE EXIT CODE SAYS WHAT IT MEANS, IN ONE MACHINE-READABLE LINE — 2026-08-23, MEASURE.
 *
 * A CONSUMER OF AN EXIT CODE CANNOT TELL A VERDICT FROM A REFUSAL, AND ONE OF THEM GUESSED WRONG.
 * `engine/register_reality.js` read every non-zero exit as a RED verdict, so this gate's exit 2 —
 * CANNOT ANSWER, the artifact was measured against other bytes — was published as evidence that
 * ROADMAP #241 is a live, measured defect, and `openDefectClause` held the MEDICHAM gate shut on it.
 * That is a gate reporting something untrue in the direction that gets gates ignored.
 *
 * The classification now belongs to THIS file, because this file is the only one that knows. It is
 * DERIVED from the tag above rather than restated as a second table — CLAUDE.md's rule is that two
 * implementations of one fact disagree eventually and the disagreement is invisible because both keep
 * working. It matters most for exit 3: REGRESSION is a genuine RED on a code outside {0,1}, and a
 * consumer that refuses to guess would otherwise be right to call it not-evidence.
 *
 * See `classifyExit` in engine/register_reality.js for the convention. Printed on stderr so it cannot
 * land inside the `--json` document on stdout. */
function declareExit(v) {
  console.error('ABRA-EXIT ' + v.code + ' '
    + (v.tag === 'CANNOT ANSWER' ? 'CANNOT-ANSWER' : v.code === 0 ? 'VERDICT-GREEN' : 'VERDICT-RED'));
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

  /* -- THE EXIT CODE DECLARES ITS OWN MEANING (2026-08-23) --------------------------------------
   * The consumer cannot tell a refusal from a finding, so this gate says which it is. Driven through
   * the SHIPPING declareExit with console.error captured, never through a restatement of the mapping. */
  const said = [];
  const realErr = console.error;
  console.error = (s) => said.push(String(s));
  for (const c of [null, { causes: 0 }, { causes: 1 }, { causes: PIN + 1 }])
    declareExit(verdict(c, true));
  console.error = realErr;
  ok('RED — CANNOT ANSWER declares itself CANNOT-ANSWER, so a consumer stops publishing exit 2 as a '
    + 'red verdict about ROADMAP #241', said[0] === 'ABRA-EXIT 2 CANNOT-ANSWER', said);
  ok('CLEAN declares VERDICT-GREEN', said[1] === 'ABRA-EXIT 0 VERDICT-GREEN', said);
  ok('LIVE declares VERDICT-RED', said[2] === 'ABRA-EXIT 1 VERDICT-RED', said);
  ok('RED — REGRESSION declares VERDICT-RED on exit 3. Without this the undeclared-code rule in '
    + 'register_reality would soften a real regression into not-evidence',
    said[3] === 'ABRA-EXIT 3 VERDICT-RED', said);

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
  let cur = null, curWhy = null;
  try { cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'engine-release.json'), 'utf8')); }
  catch (e) { curWhy = String((e && e.message) || e).split('\n')[0]; }
  const curId = cur && (cur.id || cur.release || cur.current);
  const ranOn = art.engine_release || art.release || null;
  if (!curId) {
    /* Without the tree's release id the "different engine" clause below CANNOT FIRE, so a stale
       count would be PRINTED rather than withheld. A caption is not a quarantine — withhold it. */
    relWhy = 'THE CURRENT RELEASE ID COULD NOT BE READ — data/engine-release.json '
      + (curWhy ? '(' + curWhy + ')' : 'carries no id')
      + ', so this run cannot tell whether the artifact was measured against this engine. '
      + 'The count is WITHHELD rather than printed unchecked.';
  } else if (ranOn && ranOn !== curId) {
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

if (has('--json')) { console.log(JSON.stringify(out, null, 2)); declareExit(v); process.exit(v.code); }

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
declareExit(v);
process.exit(v.code);
