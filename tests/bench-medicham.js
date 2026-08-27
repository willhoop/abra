/* bench-medicham.js — THE CANONICAL SPEED BENCHMARK. ROADMAP #76, #61.
 *
 * WHY THIS EXISTS. Will, 2026-08-10, on the plan after MEDICHAM is correct: *"i plan to run some
 * optimization programs to speed it up"* / *"handing it over to feeble 5 and saying make this go
 * faster"*. An optimizer needs a number to beat. Until tonight there was no number: ROADMAP #61 has
 * said "MEDICHAM is half the speed the project thinks it is, and nothing watches" and the only
 * measurement anyone ever took was ad-hoc.
 *
 * The first real figure, taken 2026-08-10 with two agents competing for CPU, was 0.776 ms/turn before
 * the night's five wires and 0.825 after — +6.2%. That is enough to notice a regression and NOT enough
 * to certify an optimization, which is exactly the gap this file closes.
 *
 * WHAT IT IS NOT. It is not a correctness test and must never be read as one. "Faster" and "different"
 * are indistinguishable to a stopwatch. The instrument that separates them is the whole-board digest
 * sweep (500 moves x 4 turns = 2,000 cells, used by WIRE 147 to show only 11 moved), plus
 * tests/test-damage-stages.js at 1728/1728 exact. An optimization pass runs BOTH: this file for the
 * score, the sweep for the verdict.
 *
 *   node tests/bench-medicham.js                 measure the live tree, compare to the stored baseline
 *   node tests/bench-medicham.js --record        store the current number AS the baseline
 *   node tests/bench-medicham.js --vs <relId>    A/B the live tree against a frozen release
 *
 * THE ONE RULE THAT MAKES THE NUMBER MEAN ANYTHING: it refuses to RECORD a baseline while the machine
 * is loaded. A baseline captured under load is permanently too slow, and every later run then looks
 * like a free win. Measuring under load is allowed and warned about; recording is not.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const D = (...p) => path.join(__dirname, '..', ...p);

require(D('data', 'engine-data.js'));
const ER = require(D('engine', 'engine_release.js'));

const ARGS = process.argv.slice(2);
const RECORD = ARGS.includes('--record');
const VS = (() => { const i = ARGS.indexOf('--vs'); return i >= 0 ? ARGS[i + 1] : null; })();
const BASELINE = D('data', 'medicham-bench.json');

/* THE FIXTURE IS PINNED AND MUST NOT DRIFT. Six species chosen to exercise different paths — a
 * physical attacker, a dragon, a fast frail body, a slow bulky one, a Psychic with an ability that
 * refuses priority, and a status-heavy body. Changing this list invalidates every stored number, so
 * if it ever changes, the baseline must be re-recorded and the change said out loud.
 *
 * SAID OUT LOUD, 2026-08-27. THE SIXTH SLOT HELD A SPECIES THAT IS NOT IN THIS REGULATION AND THAT
 * THE DAMAGE TABLE HAS NEVER CARRIED, so this fixture has never once had six bodies.
 *
 *   - `amoonguss` is `isNonstandard: 'Past'`, `tier: 'Illegal'` in gen9championsvgc2026regmb. It was
 *     a TYPED literal: a human wrote it here, and CLAUDE.md's cardinal rule forbids naming it.
 *   - `data/engine-data.js` has never held a key for it — checked on every commit that touched the
 *     file back to 2026-07-23, zero hits, including `9a060821` on the day this benchmark was written.
 *   - At the baseline commit (`5884fd23`, 2026-08-10) `buildMon` was `const m = monRow(name); if (!m)
 *     return null;`, so the sixth slot was silently `null`. Every game draws all six indices exactly
 *     once, so ALL 120 games ran with a null body on one side. `turns: 450` against a 120 x 12 cap is
 *     the fingerprint of it. **The stored 0.4614 ms/turn was measured on five bodies and a hole, and
 *     was invalid the day it was recorded — not because this list changed.**
 *   - Today `monKey` throws (`engine/lookup.js`, armed 2026-08-02), so the file cannot run at all.
 *     The canonical speed benchmark has been dead, loudly, and nothing said so.
 *
 * THE REPLACEMENT IS DERIVED, NOT PICKED. The slot's job in the list above is "a status-heavy body".
 * Ranking every legal, MC-carried, buildMon-safe species by how many Status-category moves its built
 * set actually holds, keeping those that retain a damaging move (Amoonguss's real set is three status
 * and one attack, not four status), and taking the highest team-rate body in the sub-56 Speed tier —
 * the tier Amoonguss occupied at base 30, and the one farigiraf's Trick Room acts on — gives TOXAPEX:
 * 3.63% of teams / 1,554 games, base Speed 35, Regenerator + Leftovers, Infestation / Toxic / Wide
 * Guard / Baneful Bunker. Validated through `champions_sim.checkLegal`: legal, as are the other five.
 *
 * WHAT THIS CHANGES ABOUT WHAT IS MEASURED, STATED BEFORE THE RE-RECORD. Turn COUNT will rise — a
 * sixth living body plays instead of a hole — and ms/turn moves with it in an unknown direction:
 * Toxapex adds real damage, status and side-condition work per turn that the null contributed
 * nothing to. The old number is not a comparand for the new one in either direction. */
const ROSTER = ['incineroar', 'garchomp', 'dragapult', 'torterra', 'farigiraf', 'toxapex'];
const GAMES = 120;
const TURN_CAP = 12;
const REPS = 5;

/* A deterministic stream. Math.random would make two runs incomparable, and the engine's own seeded
 * rng is what the rest of the harness uses. */
function lcg(seed) { let s = seed >>> 0; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 10000) / 10000; }; }

function loadEngine(relId) {
  for (const k of Object.keys(require.cache)) if (/medicham2-browser/.test(k)) delete require.cache[k];
  if (!relId) return require(D('engine', 'medicham2-browser.js'));
  return ER.open(relId).require('engine/medicham2-browser.js');
}

function play(M) {
  const rng = lcg(20260810);
  /* A BODY THAT DID NOT BUILD IS NOT A BODY, AND A SILENT NULL IS WHAT COST THE FIRST BASELINE.
   * `buildMon` returned null for an absent species at the commit that recorded 0.4614 ms/turn, so a
   * hole rode into all 120 games and the timing was taken on five bodies. It throws today, but only
   * for the live tree — `--vs <relId>` loads a FROZEN engine whose buildMon may still return null,
   * which is exactly the run where a quiet hole would look like an optimization. */
  const mk = sp => {
    const m = M.buildMon(sp, {});
    if (!m) throw new Error('bench-medicham: buildMon("' + sp + '") returned null, so this fixture '
      + 'has ' + (ROSTER.length - 1) + ' bodies and not ' + ROSTER.length + '. Every number below '
      + 'would be timed on a hole. Fix the roster or the engine; do not record.');
    return m;
  };
  let turns = 0;
  for (let g = 0; g < GAMES; g++) {
    const a = [mk(ROSTER[g % 6]), mk(ROSTER[(g + 1) % 6]), mk(ROSTER[(g + 2) % 6])];
    const b = [mk(ROSTER[(g + 3) % 6]), mk(ROSTER[(g + 4) % 6]), mk(ROSTER[(g + 5) % 6])];
    const S = M.battleInit(a, b, { seeded: true });
    for (let t = 0; t < TURN_CAP && !M.battleOver(S); t++) { M.battleTurn(S, rng, null, null); turns++; }
  }
  return turns;
}

/* LOAD CHECK. os.loadavg() is all-zeroes on Windows, so it cannot be trusted here; instead time a
 * fixed spin of pure arithmetic and compare it to how long that spin should take on an idle core.
 * A machine under load stretches it. This is a coarse instrument and it only has one job: stop a
 * baseline being recorded on a busy machine. */
function loadFactor() {
  const t0 = process.hrtime.bigint();
  let x = 0; for (let i = 0; i < 8e6; i++) x += Math.sqrt(i);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, x };
}
function calibrate() {
  let best = Infinity;
  for (let i = 0; i < 5; i++) best = Math.min(best, loadFactor().ms);
  return best;
}

function measure(relId) {
  const M = loadEngine(relId);
  play(M);                                    // warm: let the JIT settle before anything is timed
  let best = Infinity, turns = 0;
  for (let r = 0; r < REPS; r++) {
    const s = process.hrtime.bigint();
    turns = play(M);
    const ms = Number(process.hrtime.bigint() - s) / 1e6;
    if (ms < best) best = ms;                 // MINIMUM, not mean: load can only ever ADD time, so the
  }                                           // fastest rep is the closest thing to the true cost
  return { ms: best, turns, perTurn: best / turns };
}

console.log('MEDICHAM BENCHMARK — ' + GAMES + ' games, cap ' + TURN_CAP + ' turns, best of ' + REPS + '\n');
console.log('  node ' + process.version + '  ' + os.cpus().length + ' cpus');

const spin = calibrate();
console.log('  calibration spin ' + spin.toFixed(1) + ' ms');

if (VS) {
  const a = measure(VS), b = measure(null);
  console.log('\n  FROZEN ' + VS + '   ' + a.perTurn.toFixed(4) + ' ms/turn   (' + a.turns + ' turns)');
  console.log('  LIVE TREE          ' + b.perTurn.toFixed(4) + ' ms/turn');
  const d = 100 * (b.perTurn - a.perTurn) / a.perTurn;
  console.log('\n  delta ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%');
  process.exit(0);
}

const cur = measure(null);
console.log('\n  live tree   ' + cur.perTurn.toFixed(4) + ' ms/turn   (' + cur.turns + ' turns, ' + cur.ms.toFixed(0) + ' ms)');

let base = null;
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) {}

if (RECORD) {
  /* THE REFUSAL. A baseline is a promise that the number was taken fairly. */
  if (base && spin > base.calibration_spin_ms * 1.25) {
    console.log('\n  REFUSED to record: the calibration spin is ' +
                (100 * spin / base.calibration_spin_ms - 100).toFixed(0) + '% slower than when the ' +
                'baseline was taken, so this machine is busy. A baseline recorded under load is ' +
                'permanently too slow and makes every later run look like a free win. Run it quiet.');
    process.exit(1);
  }
  const rec = {
    recorded: new Date().toISOString(),
    ms_per_turn: +cur.perTurn.toFixed(4),
    turns: cur.turns,
    games: GAMES, turn_cap: TURN_CAP, reps: REPS, roster: ROSTER,
    calibration_spin_ms: +spin.toFixed(1),
    node: process.version, cpus: os.cpus().length,
    note: 'Best-of-N on a pinned fixture. NOT a correctness test — pair every optimization with the ' +
          '500-move whole-board digest sweep and tests/test-damage-stages.js.',
  };
  fs.writeFileSync(BASELINE, JSON.stringify(rec, null, 2) + '\n');
  console.log('\n  recorded as the baseline.');
  process.exit(0);
}

if (!base) {
  console.log('\n  NO BASELINE STORED. Run quiet, then: node tests/bench-medicham.js --record');
  process.exit(0);
}

/* THE BASELINE ALREADY CARRIED THE ROSTER AND NOTHING COMPARED IT. The header has said since this
 * file was written that changing the list invalidates every stored number; that was PROSE, so the
 * one time the list had to change, the comparison would have gone on subtracting a number taken on a
 * different fixture and reported a percentage. Same shape as every stale artifact in this repo: the
 * warning is written, the number is read. This refuses instead of annotating. */
const sameRoster = Array.isArray(base.roster)
  && base.roster.length === ROSTER.length
  && base.roster.every((s, i) => s === ROSTER[i]);
if (!sameRoster) {
  console.log('\n  NO COMPARISON. The stored baseline was taken on a DIFFERENT fixture, so the two');
  console.log('  numbers are not comparands and a delta between them would be meaningless.');
  console.log('    baseline roster  ' + JSON.stringify(base.roster || null));
  console.log('    this roster      ' + JSON.stringify(ROSTER));
  console.log('  Re-record on a quiet machine: node tests/bench-medicham.js --record');
  process.exit(0);
}

const d = 100 * (cur.perTurn - base.ms_per_turn) / base.ms_per_turn;
console.log('  baseline    ' + base.ms_per_turn.toFixed(4) + ' ms/turn   (recorded ' + base.recorded.slice(0, 16) + ')');
console.log('\n  delta ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%');

const busy = base.calibration_spin_ms ? spin / base.calibration_spin_ms : 1;
if (busy > 1.25) {
  console.log('  NOTE: this machine is ' + (100 * busy - 100).toFixed(0) + '% slower on the calibration ' +
              'spin than when the baseline was taken. Treat a regression here as unproven.');
  process.exit(0);
}
if (d > 10) { console.log('\n  SLOWER by more than 10% on a quiet machine. Say so; do not file it.'); process.exit(1); }
console.log('\n  within budget.');
