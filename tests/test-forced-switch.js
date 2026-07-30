/* WHICH POKEMON COMES IN AFTER A KO — the gate for scoring a forced replacement.
 *
 * Until now this decision was the inherited uniform die:
 *     protected chooseSwitch(...) { return this.prng.sample(switches).slot; }
 * Measured on 6,000 self-play games: 3.55 forced replacements per game across both sides, of which
 * 1.91 had TWO live options and 1.63 had exactly one. So about one real decision per side per game
 * was a coin flip, and it decides what stands on the field for the rest of the game.
 *
 * WHAT THIS PROVES, and the order matters:
 *   1. the two candidates get DIFFERENT feature vectors. This is the gate that actually matters,
 *      because the failure mode here is not a wrong pick, it is an INDISCRIMINATE one. board.js
 *      line ~1081 records exactly this bug in the voluntary path: incomingThreat was keyed without
 *      the defender, so Torkoal and Whimsicott both read survives1=1 survives2=0 and the fit
 *      reported a null that belonged to the cache rather than to the game. Identical vectors score
 *      identically and the argmax silently degenerates to "first in the list" -- a die with worse
 *      manners. If this check ever fails, nothing below it means anything.
 *   2. the scorer returns the argmax of w.x, computed here independently from board.js features and
 *      the shipped weights. Expected values are DERIVED, never typed.
 *   3. the lever off, and a pool of one, both return null rather than a slot -- so the caller falls
 *      back to the die and stats.forcedFellBack can say how often.
 *
 * The two candidate species are DERIVED as the bulkiest and frailest in the engine's own table, and
 * the attacker as the biggest base power in it, so this test does not name a Pokemon and cannot rot
 * when the format changes underneath it.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const B = require(path.join(ROOT, 'engine', 'board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const { makeScoringPlayer, loadWeights } = require(path.join(ROOT, 'engine', 'magnemite.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};

/* ---- DERIVE THE CAST FROM THE TABLE, do not name it ---------------------------------------- */
const names = Object.keys(MC.mons);
const bulkOf = n => { const s = MC.mons[n].st; return s.hp * (s.df + s.sd); };
const sorted = names.slice().sort((a, b) => bulkOf(b) - bulkOf(a));
const BULKY = sorted[0], FRAIL = sorted[sorted.length - 1];
/* The attacker: whoever carries the single biggest base power, so the incoming hit is real. */
let ATT = null, attBP = -1;
for (const n of names) {
  for (const id of (MC.mons[n].mv || [])) {
    const mv = MC.moves[id];
    if (mv && mv.bp > attBP) { attBP = mv.bp; ATT = n; }
  }
}
console.log('FORCED REPLACEMENT — SCORING THE POST-KO SWITCH\n');
console.log(`  cast derived from the table: bulkiest=${BULKY}  frailest=${FRAIL}  attacker=${ATT} (bp ${attBP})\n`);

/* ---- A BOARD WHERE MY ACTIVE JUST FAINTED AND TWO THINGS COULD COME IN --------------------- */
function boardWith() {
  const b = new B.Board();
  b.turn = 3;
  b.sides.p2.active = { a: { species: ATT, hp: 1, boosts: {}, status: '', fainted: false, nature: '' } };
  b.sides.p1.active = {};                       // mine is gone; that is why we are here
  b.party.p1 = [BULKY, FRAIL];
  b.party.p2 = [ATT];
  return b;
}

const board = boardWith();
const featFor = sp => B.featuresFor({ raw: null, move: null, targetMon: null, switchTo: sp },
  null, board, 'p1', dex, B.PRIOR_FLOOR);
const xB = featFor(BULKY), xF = featFor(FRAIL);

/* 1. THE GATE THAT MATTERS: the vectors must differ. */
const differs = xB.some((v, i) => v !== xF[i]);
const diffNames = B.FEATURES.filter((f, i) => xB[i] !== xF[i]);
ok(differs, 'the two candidates get DIFFERENT feature vectors',
  differs ? `differ on: ${diffNames.join(', ')}` : 'IDENTICAL — the argmax is a die with worse manners');
const s1 = B.FEATURE_INDEX.switchSurvives1, s2 = B.FEATURE_INDEX.switchSurvives2;
console.log(`        ${BULKY.padEnd(18)} survives1=${xB[s1]} survives2=${xB[s2]}`);
console.log(`        ${FRAIL.padEnd(18)} survives1=${xF[s1]} survives2=${xF[s2]}`);
ok(xB[s1] >= xF[s1] && xB[s2] >= xF[s2],
  'the bulkiest survives at least as much as the frailest', '(a fact, not a preference)');

/* ---- 2. THE SCORER RETURNS THE ARGMAX, and the argmax is computed here --------------------- */
const W = loadWeights();
const w = W.weights;
const dot = x => { let s = 0; for (let k = 0; k < w.length; k++) s += w[k] * x[k]; return s; };
const scoreB = dot(xB), scoreF = dot(xF);
console.log(`        shipped weights score: ${BULKY}=${scoreB.toFixed(3)}  ${FRAIL}=${scoreF.toFixed(3)}`);

const Cls = makeScoringPlayer();
const pick = Cls.prototype._scoreForcedPick;
ok(typeof pick === 'function', '_scoreForcedPick exists on the player');

const mkPool = () => [
  { slot: 2, pokemon: { details: `${BULKY}, L50, F`, condition: '185/185' } },
  { slot: 3, pokemon: { details: `${FRAIL}, L50, F`, condition: '150/150' } },
];
const stub = (on) => ({ scoreForced: on, w, board, me: 'p1', stats: { forcedScored: 0, forcedFellBack: 0 } });

const expectSlot = scoreB >= scoreF ? 2 : 3;
const live = stub(true);
const got = pick.call(live, mkPool());
ok(got === expectSlot, 'picks the argmax of w.x over the two candidates',
  `expected slot ${expectSlot} (${expectSlot === 2 ? BULKY : FRAIL}), got ${got}`);
ok(live.stats.forcedScored === 1 && live.stats.forcedFellBack === 0,
  'counts itself as having decided', `scored=${live.stats.forcedScored} fellBack=${live.stats.forcedFellBack}`);

/* ---- 3. THE HONEST NULLS ------------------------------------------------------------------- */
const off = stub(false);
ok(pick.call(off, mkPool()) === null, 'lever OFF returns null, so the caller keeps the inherited die');
ok(off.stats.forcedFellBack === 0, 'lever OFF is not counted as a fallback', '(it never tried)');

const one = stub(true);
ok(pick.call(one, [mkPool()[0]]) === null, 'a pool of ONE returns null — there is no decision to make');

const junk = stub(true);
ok(pick.call(junk, [{ slot: 2, pokemon: null }, { slot: 3, pokemon: null }]) === null,
  'unresolvable candidates return null rather than a guess');
ok(junk.stats.forcedFellBack === 1, 'an attempt that could not decide IS counted as a fallback',
  `fellBack=${junk.stats.forcedFellBack}`);

/* ---- the damage engine must have been live for any of the above to mean anything ----------- */
ok(B.dmgFailures.unavailable === 0,
  'the damage engine was live', `unavailable=${B.dmgFailures.unavailable}`);

console.log(`\nFEATURES: ${B.FEATURES.length}`);
console.log(fails ? `\nFORCED SWITCH: ${fails} FAILED` : '\nFORCED SWITCH: all checks passed');
process.exit(fails ? 1 : 0);
