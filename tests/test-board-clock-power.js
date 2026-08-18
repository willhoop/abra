/* test-board-clock-power.js — TWO THINGS THE BOARD KNEW AND THE FEATURE VECTOR DID NOT.
 *
 *   #276  THE WEATHER NEVER EXPIRED FOR THE FEATURES. `board.setWeather` recorded the word, and
 *         since #270 also WHEN it was set and what the setter held — but `board.weather` was a bare
 *         string that only ever changed when a new weather arrived. So `deadWeather` and every
 *         weather-scaled read believed a five-turn sun was up on turn forty. #270 fixed the SEED and
 *         deliberately left this alone because it moves fitted feature values.
 *         Sized on the store: a weather is up at 32.2% of decision points, mean 2.95 turns left.
 *
 *   #283  `board.movePower` BUILT NO `side.totalFainted`. The stub's side was the literal
 *         `{ sideConditions: {} }`, so Last Respects' `50 + 50 * pokemon.side.totalFainted` returned
 *         NaN, the `bp > 0` guard rejected it, and the printed 50 was used in every damage feature
 *         MAG ranks an action with. 7,306 corpus uses. Beat Up threw on `move.allies.shift()` and
 *         fell back to its printed ZERO, so `damaging` was false and 337 uses were scored as a
 *         STATUS MOVE — the Rock Slide bug again.
 *
 * WHY ONE FILE. They are the same defect asked twice — a fact the board holds that never reached the
 * vector — and both were held back for the same reason (they move fitted values, and the refit is
 * gated behind MEDICHAM). Landing them apart would make neither result attributable.
 *
 * NOTHING IN HERE IS TYPED. The weather-setting move is the first one the FORMAT offers; the
 * weather's length is `MEDI.weatherTurns`; the rock is found by probing every legal item until one
 * lengthens it; Last Respects' `50 + 50N` is read out of `data/tags.json`; Beat Up's per-ally power is
 * computed from the dex's own base stats; and the CARRIERS of both moves are read out of
 * `data/move-priors.json`, so every body standing here is one real teams actually bring.
 *
 * THREE ARMS ARE BEHAVIOURAL RATHER THAN FIELD READS, because reading `board.weather` back would only
 * prove the accessor returned what the accessor returned:
 *   - `deadWeather` must flip 1 -> 0 across the expiry boundary. That is the fitted feature the row
 *     names, and the symptom is a model that will not re-set a weather that ran out ten turns ago.
 *   - the whole feature VECTOR of one fixed candidate must differ across that boundary, and the arm
 *     prints which columns moved — that list is what the refit needs.
 *   - Beat Up's `isStatus` must flip 1 -> 0, which is the difference between a move being ranked and
 *     being invisible.
 *
 *   node tests/test-board-clock-power.js
 */
'use strict';
require('../engine/showdown_path.js');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const B = require(D('engine', 'board.js'));
const TAGS = require(D('engine', 'tags.js'));
const CS = require(D('engine', 'champions_sim.js'));
const PRIORS = require(D('data', 'move-priors.json'));

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  if (c) { pass++; console.log('  ok   ' + msg + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + msg + (extra ? '   ' + extra : '')); }
};
const note = (msg, extra) => console.log('  note ' + msg + (extra ? '   ' + extra : ''));

console.log('\ntest-board-clock-power — the weather expires and the fallen are counted (#276, #283)\n');

if (!process.env.SHOWDOWN_PATH) {
  console.log('  FAIL SHOWDOWN_PATH is not set, so the Champions dex cannot be loaded');
  console.log('\nBOARD CLOCK/POWER TESTS: 0 passed, 1 failed');
  process.exit(1);
}
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
ok(!!B.damageEngine(), 'the damage engine is available, so the features below are real numbers');

/* THE POOL IS THE DAMAGE TABLE'S OWN KEYS, exactly as tests/test-rollout-fallen.js takes it: a name
 * that does not resolve builds nothing and the whole file would pass having scored no candidate. */
const POOL = Object.keys(globalThis.MC.mons).slice(0, 12);

/* WHO ACTUALLY BRINGS THIS MOVE, read out of the corpus rather than recalled. `data/move-priors.json`
 * is P(move | species) over real open-sheet games, so a carrier taken from it is a body somebody
 * brought — which is the standard tests/test-fixture-legality.js exists to hold the fixture to. */
function carrierOf(mvId) {
  let best = null;
  for (const sp of Object.keys(PRIORS.species || {})) {
    const e = ((PRIORS.species[sp] || {}).moves || []).find(x => x && x.mv === mvId);
    if (e && (!best || e.p > best.p) && B.mcKeyFor(sp)) best = { sp, p: e.p };
  }
  return best;
}

/* =============================================================================================
 * 1. ROADMAP #276 — THE WEATHER EXPIRES FOR THE FEATURES
 * ========================================================================================== */
console.log('\n-- #276  the board\'s own weather has a clock --\n');

const legalMove = m => m && m.exists && !m.isNonstandard && m.tier !== 'Illegal';
const WMOVE = dex.moves.all().find(m => legalMove(m) && m.weather);
ok(!!WMOVE, 'a weather-setting move is derived from the format rather than named',
  WMOVE ? `${WMOVE.id} -> ${WMOVE.weather}` : '-');

const FULL = WMOVE ? (MEDI.weatherTurns(WMOVE.weather, '', TAGS) | 0) : 0;
ok(FULL > 0, 'the engine states how long that weather lasts — not this file', `${WMOVE && WMOVE.weather} = ${FULL}`);

function weatherBoard(elapsed, rock) {
  const bd = new B.Board();
  bd.setParty('p1', POOL.slice(0, 4)); bd.setParty('p2', POOL.slice(4, 8));
  bd.setSheet('p1', POOL[0], { nature: 'Serious', item: rock || '', ability: '', moves: [WMOVE.id] });
  bd.switchIn('p1', 'a', POOL[0]); bd.switchIn('p1', 'b', POOL[1]);
  bd.switchIn('p2', 'a', POOL[4]); bd.switchIn('p2', 'b', POOL[5]);
  /* THROUGH `noteMove`, NOT THROUGH `setWeather`, because that is the door the live adapter and the
   * offline replay both go through and it is where the SETTER'S ROCK is picked up (#270). */
  B.noteMove(bd, 'p1', bd.slot('p1', 'a'), WMOVE, true);
  for (let i = 0; i < elapsed; i++) bd.endTurn();
  return bd;
}

if (WMOVE && FULL > 0) {
  const fresh = weatherBoard(0);
  ok(fresh.weather === B.norm(WMOVE.weather), 'CONTROL — a weather set this turn is up', fresh.weather);
  ok(fresh.weatherLeft() === FULL, 'and it has its full length left', `${fresh.weatherLeft()}`);

  const nearly = weatherBoard(FULL - 1);
  ok(nearly.weather === B.norm(WMOVE.weather),
    'CONTROL — one turn before it runs out it is STILL UP, so the clock does not fire early',
    `left ${nearly.weatherLeft()}`);

  const dead = weatherBoard(FULL);
  ok(dead.weather === '', 'ROADMAP #276 — a weather that has run out is GONE for the features', `'${dead.weather}'`);
  ok(dead.weatherWord() === B.norm(WMOVE.weather),
    'and the WORD is still recorded, which is what the seed and the counters read', dead.weatherWord());
  ok(dead.weatherLeft() === 0, 'weatherLeft is 0 — "it has run out", not null', `${dead.weatherLeft()}`);

  /* ---- BEHAVIOURAL 1: the fitted feature the row names ------------------------------------- */
  const featOf = (bd, mvId) => {
    const user = bd.slot('p1', 'a');
    const cands = B.candidates([mvId], user, bd, 'p1', dex);
    if (!cands.length) return null;
    return B.featuresFor(cands[0], user, bd, 'p1', dex, 0.5);
  };
  const dw = (bd) => { const x = featOf(bd, WMOVE.id); return x ? x[B.FEATURE_INDEX.deadWeather] : null; };
  const up = weatherBoard(1), out = weatherBoard(FULL + 1);
  ok(dw(up) === 1, 'CONTROL — re-setting a weather that IS up scores deadWeather', `${dw(up)}`);
  ok(dw(out) === 0,
    'ROADMAP #276 — once it has lapsed the same click is NOT dead any more; this is the fitted value that moves',
    `deadWeather ${dw(up)} -> ${dw(out)}`);

  /* ---- BEHAVIOURAL 2: which COLUMNS move, printed rather than asserted one at a time -------- */
  /* THE PAIR IS CONSTRUCTED, NOT FOUND — and the first version of this arm went SILENT, which is
   * why it is written this way. It took the first weather-setting move the format offers, which is
   * Sandstorm, and sandstorm boosts no attacking type at all — so no move on the pool moved a damage
   * number and the arm printed a note instead of an assertion. A control that does not fire proves
   * nothing (docs/LESSONS.md, and tests/test-seed-clock.js's sound-lock fixture). So every legal
   * weather-setting move is tried against every legal single-target attacking move until one pair
   * actually changes `dmgFrac`, and the pair that worked is printed. */
  const pair = (() => {
    const feats = (bd, mvId, sp) => {
      bd.setSheet('p1', sp, { nature: 'Serious', item: '', ability: '', moves: [mvId] });
      bd.switchIn('p1', 'a', sp);
      const user = bd.slot('p1', 'a');
      const c = B.candidates([mvId], user, bd, 'p1', dex);
      return c.length ? B.featuresFor(c[0], user, bd, 'p1', dex, 0.5) : null;
    };
    const bare = () => {
      const bd = new B.Board();
      bd.setParty('p1', POOL.slice(0, 4)); bd.setParty('p2', POOL.slice(4, 8));
      bd.switchIn('p2', 'a', POOL[4]); bd.switchIn('p2', 'b', POOL[5]);
      return bd;
    };
    for (const wm of dex.moves.all()) {
      if (!legalMove(wm) || !wm.weather) continue;
      const len = MEDI.weatherTurns(wm.weather, '', TAGS) | 0;
      if (!(len > 0)) continue;
      const wet = () => {
        const bd = bare();
        bd.setSheet('p1', POOL[1], { nature: 'Serious', item: '', ability: '', moves: [wm.id] });
        bd.switchIn('p1', 'a', POOL[1]);
        B.noteMove(bd, 'p1', bd.slot('p1', 'a'), wm, true);
        return bd;
      };
      for (const am of dex.moves.all()) {
        if (!legalMove(am) || am.category === 'Status' || !(am.basePower > 0) || am.target !== 'normal') continue;
        const dry = feats(bare(), am.id, POOL[0]);
        const up = feats(wet(), am.id, POOL[0]);
        if (dry && up && dry[B.FEATURE_INDEX.dmgFrac] !== up[B.FEATURE_INDEX.dmgFrac]) {
          return { wm, am, len, feats, wet, bare };
        }
      }
    }
    return null;
  })();
  if (!pair) {
    ok(false, 'ROADMAP #276 — NO (weather, attacking move) pair on this pool moves a damage feature, ' +
      'so the damage half of this row has no observable and the arm cannot be trusted');
  } else {
    /* The same board, aged past the weather's own length. Everything else is identical, so any column
     * that moves is attributable to the sky and to nothing else. */
    const upBd = pair.wet();
    const outBd = pair.wet(); for (let i = 0; i < pair.len + 1; i++) outBd.endTurn();
    const xa = pair.feats(upBd, pair.am.id, POOL[0]);
    const xb = pair.feats(outBd, pair.am.id, POOL[0]);
    const movedCols = [];
    for (let k = 0; k < B.FEATURES.length; k++) if (xa[k] !== xb[k]) movedCols.push(B.FEATURES[k]);
    ok(movedCols.length > 0,
      `ROADMAP #276 — a weather-scaled damage feature MOVES across the expiry boundary ` +
      `(${pair.wm.id} + ${pair.am.id})`, movedCols.join(', ') || 'NONE');
    note('#276 — the columns a lapsed weather moves for one attacking candidate:', movedCols.join(', '));
  }

  /* ---- THE ROCK, derived by probing the items rather than by naming one -------------------- */
  const ROCK = (() => {
    for (const it of dex.items.all()) {
      if (!it || !it.exists || it.isNonstandard) continue;
      try { if ((MEDI.weatherTurns(WMOVE.weather, it.id, TAGS) | 0) > FULL) return it.id; } catch (e) { /* not a rock */ }
    }
    return null;
  })();
  if (!ROCK) note('#276 — no legal item extends this weather, so the rock arm has no observable', String(WMOVE.weather));
  else {
    const long = MEDI.weatherTurns(WMOVE.weather, ROCK, TAGS) | 0;
    const rb = weatherBoard(FULL, ROCK);
    ok(rb.weather === B.norm(WMOVE.weather),
      'ROADMAP #276 — the SETTER\'s rock keeps the weather up past the base length, derived not typed',
      `${ROCK}: ${long} turns, still up at ${FULL}`);
    ok(weatherBoard(long, ROCK).weather === '', 'and it does expire at the LONGER length', `${long}`);
  }

  /* ---- IDEMPOTENCE: without this the whole row is a no-op ---------------------------------- */
  const echo = weatherBoard(2);
  const before = echo.weatherLeft();
  echo.setWeather(WMOVE.weather);   /* the store's `w` event / the live |-weather| line, same turn */
  ok(echo.weatherLeft() === before,
    'ROADMAP #276 — re-announcing a weather that is already up does NOT restart its clock; without ' +
    'this the second announcement every world makes would reset the age and NOTHING would ever expire',
    `left ${before} -> ${echo.weatherLeft()}`);
  const relaid = weatherBoard(FULL + 3);
  ok(relaid.weather === '', 'CONTROL — it really had lapsed before being re-laid', `'${relaid.weather}'`);
  relaid.setWeather(WMOVE.weather);
  ok(relaid.weatherLeft() === FULL,
    'and setting the SAME weather after it lapsed starts a FRESH clock — the case naive idempotence gets wrong',
    `left ${relaid.weatherLeft()}`);

  /* ---- A REFUSAL, COUNTED: an age the board never saw must not be expired ------------------ */
  const blind = weatherBoard(FULL + 2);
  blind.weatherSince = null;
  ok(blind.weather === B.norm(WMOVE.weather) && blind.weatherLeft() === null,
    'ROADMAP #276 — a board that never saw the weather START is left alone rather than expired; ' +
    'inventing an expiry is the same class of error as never having one',
    `left ${blind.weatherLeft()}`);
}

/* ---- THE WIRE PROVES IT RAN ---------------------------------------------------------------- */
ok((B.weatherCounters.up | 0) > 0, 'the weather clock reported a LIVE weather during this run', JSON.stringify(B.weatherCounters));
ok((B.weatherCounters.expired | 0) > 0, 'and it reported an EXPIRED one');
ok((B.weatherCounters.reDeclared | 0) > 0, 'and it refused at least one re-declaration');
note('#276 DECLARED — the store\'s `w` event and the live `|-weather|` line name no setter,',
  `so a rock-extended weather laid by an ABILITY is clocked at its base length and ends early. ` +
  `Erring SHORT is the direction #270 chose; setRockless counts it: ${B.weatherCounters.setRockless}`);

/* =============================================================================================
 * 2. ROADMAP #283 — THE FALLEN COUNT AND THE ALLY LIST REACH THE FEATURE VECTOR
 * ========================================================================================== */
console.log('\n-- #283  movePower builds the state the callbacks read --\n');

const PF = TAGS.param('move', 'lastrespects', 'powerFromFallen');
ok(!!PF && +PF.base > 0 && +PF.perFallen > 0,
  'Last Respects\' 50 + 50N is read out of data/tags.json, not typed here',
  PF ? `base ${PF.base} +${PF.perFallen}/fallen` : 'ABSENT');

const LRC = carrierOf('lastrespects');
ok(!!LRC, 'the Last Respects carrier comes from the corpus — a body real teams bring',
  LRC ? `${LRC.sp} p=${LRC.p}` : 'NONE IN data/move-priors.json');

const LR = dex.moves.get('lastrespects');
if (PF && LRC && LR && LR.exists) {
  const MINE = [LRC.sp].concat(POOL.filter(s => s !== LRC.sp).slice(0, 3));
  const THEIRS = POOL.filter(s => !MINE.includes(s)).slice(0, 4);
  const boardWith = (nDead) => {
    const bd = new B.Board();
    bd.setParty('p1', MINE); bd.setParty('p2', THEIRS);
    bd.setSheet('p1', MINE[0], { nature: 'Serious', item: '', ability: '', moves: [LR.id] });
    bd.switchIn('p1', 'a', MINE[0]);
    bd.switchIn('p2', 'a', THEIRS[0]); bd.switchIn('p2', 'b', THEIRS[1]);
    for (let i = 0; i < nDead; i++) { bd.switchIn('p1', 'b', MINE[1 + i]); bd.faint('p1', 'b'); }
    return bd;
  };
  const bpAt = (n) => { const bd = boardWith(n); return B.movePower(LR, bd, dex, bd.slot('p1', 'a'), bd.slot('p2', 'a')); };
  ok(bpAt(0) === PF.base,
    'CONTROL — with nobody in the ground it is the printed floor, so the fix does not invent deaths',
    `${bpAt(0)} vs ${PF.base}`);
  for (const n of [1, 2, 3]) {
    ok(bpAt(n) === PF.base + PF.perFallen * n,
      `ROADMAP #283 — ${n} in the ground prices it at ${PF.base + PF.perFallen * n}`, `${bpAt(n)}`);
  }
  /* WHOSE DEAD. A side-blind read would double the foe's power off my graveyard, which is the
   * failure #254 measured for hazards. */
  const bd3 = boardWith(3);
  ok(B.movePower(LR, bd3, dex, bd3.slot('p2', 'a'), bd3.slot('p1', 'a')) === PF.base,
    'ROADMAP #283 — MY dead do not price THEIR Last Respects; the count is the user\'s side',
    `${B.movePower(LR, bd3, dex, bd3.slot('p2', 'a'), bd3.slot('p1', 'a'))}`);

  /* BEHAVIOURAL: the feature vector, not the helper. */
  const vec = (n) => {
    const bd = boardWith(n);
    const user = bd.slot('p1', 'a');
    const c = B.candidates([LR.id], user, bd, 'p1', dex);
    return c.length ? B.featuresFor(c[0], user, bd, 'p1', dex, 0.5) : null;
  };
  const v0 = vec(0), v3 = vec(3);
  if (!v0 || !v3) note('#283 — the carrier produced no Last Respects candidate, so the vector arm has no observable');
  else {
    const moved = [];
    for (let k = 0; k < B.FEATURES.length; k++) if (v0[k] !== v3[k]) moved.push(B.FEATURES[k]);
    ok(moved.length > 0, 'ROADMAP #283 — the FEATURE VECTOR MAG ranks with moves with the graveyard', moved.join(', '));
    ok(v3[B.FEATURE_INDEX.dmgFrac] > v0[B.FEATURE_INDEX.dmgFrac],
      'and it moves in the right direction — three dead allies make it hit HARDER',
      `dmgFrac ${v0[B.FEATURE_INDEX.dmgFrac].toFixed(4)} -> ${v3[B.FEATURE_INDEX.dmgFrac].toFixed(4)}`);
    note('#283 — the columns the fallen count moves for a Last Respects candidate:', moved.join(', '));
  }
}

/* ---- BEAT UP: the format's own ally filter, not a re-implementation ------------------------- */
const BUC = carrierOf('beatup');
const BU = dex.moves.get('beatup');
ok(!!BUC, 'the Beat Up carrier also comes from the corpus', BUC ? `${BUC.sp} p=${BUC.p}` : 'NONE');
if (BUC && BU && BU.exists) {
  /* THE USER IS DELIBERATELY NOT FIRST IN THE PARTY. `move.allies.shift()` takes the FIRST body, so a
   * party with the user at the front can never show that the FILTER does anything. */
  const ALLY = POOL.find(s => s !== BUC.sp);
  const REST = POOL.filter(s => s !== BUC.sp && s !== ALLY).slice(0, 2);
  const mk = (statusOnAlly) => {
    const bd = new B.Board();
    bd.setParty('p1', [ALLY, BUC.sp].concat(REST));
    bd.setParty('p2', POOL.filter(s => s !== BUC.sp && s !== ALLY && !REST.includes(s)).slice(0, 4));
    bd.setSheet('p1', BUC.sp, { nature: 'Serious', item: '', ability: '', moves: [BU.id] });
    bd.switchIn('p1', 'a', BUC.sp);
    bd.switchIn('p1', 'b', ALLY);
    bd.switchIn('p2', 'a', bd.party.p2[0]);
    if (statusOnAlly) bd.slot('p1', 'b').status = statusOnAlly;
    return bd;
  };
  const perAlly = (name) => {
    const sp = dex.species.get(name) || dex.species.get(B.baseSpecies(name));
    return sp && sp.exists ? 5 + Math.floor(sp.baseStats.atk / 10) : null;
  };
  const clean = mk(null);
  const got = B.movePower(BU, clean, dex, clean.slot('p1', 'a'), clean.slot('p2', 'a'));
  ok(got > 0,
    'ROADMAP #283 — Beat Up computes a base power at all; it used to THROW and fall back to its ' +
    'printed ZERO, which made isStatus 1 and hid the move from the ranking entirely', `${got}`);
  ok(got === perAlly(ALLY),
    'and the number is the FORMAT\'s own 5 + floor(baseAtk/10) for the first ally, computed from the dex',
    `${got} vs ${perAlly(ALLY)} (${ALLY})`);
  /* THE FILTER IS SHOWDOWN'S: `ally === pokemon || (!ally.fainted && !ally.status)`. */
  const sick = mk('brn');
  const got2 = B.movePower(BU, sick, dex, sick.slot('p1', 'a'), sick.slot('p2', 'a'));
  ok(got2 === perAlly(BUC.sp),
    'ROADMAP #283 — a STATUSED ally drops out of the list and the next body prices the hit; the ' +
    'filter is the format\'s onModifyMove, run on a copy, not re-implemented here',
    `${got} -> ${got2}, expected ${perAlly(BUC.sp)} (${BUC.sp})`);
  /* BEHAVIOURAL: isStatus is the column that actually decided whether MAG could see this move. */
  const user = clean.slot('p1', 'a');
  const c = B.candidates([BU.id], user, clean, 'p1', dex);
  const x = c.length ? B.featuresFor(c[0], user, clean, 'p1', dex, 0.5) : null;
  ok(!!x && x[B.FEATURE_INDEX.isStatus] === 0,
    'ROADMAP #283 — and Beat Up is scored as a DAMAGING move in the vector now, not a status one',
    x ? `isStatus ${x[B.FEATURE_INDEX.isStatus]}` : 'no candidate');
}

/* ---- WHAT IS STILL REFUSED, DERIVED AND PRINTED --------------------------------------------- */
const still = B.unmodelledBasePower(dex, (() => {
  const bd = new B.Board();
  bd.setParty('p1', POOL.slice(0, 4)); bd.setParty('p2', POOL.slice(4, 8));
  bd.switchIn('p1', 'a', POOL[0]); bd.switchIn('p2', 'a', POOL[4]);
  return bd;
})());
const ids = still.map(r => r.id);
ok(still.length > 0,
  'ROADMAP #283 — the refusals are DERIVED from the callbacks and PRINTED, never a typed list: a ' +
  'silent omission and a considered one look identical in the code', ids.join(', '));
for (const [id, why] of [
  ['ragefist', 'pokemon.timesAttacked — the board keeps no per-body hit ledger'],
  ['avalanche', 'pokemon.attackedBy — the same ledger plus within-turn damage attribution'],
  ['payback', 'this.queue.willMove — whether the target has already acted is the TURN\'s order'],
]) {
  ok(ids.includes(id), `still refused, by name: ${id} — ${why}`);
}
for (const id of ['lastrespects', 'beatup', 'tripleaxel', 'watershuriken']) {
  ok(!ids.includes(id), `NO LONGER refused: ${id} computes a number rather than falling back`);
}
note('#283 CORRECTED — data/seed-source-audit.json named this class by substring-matching the',
  'callback source against a hand-typed set of fifteen field names, and it is wrong in BOTH ' +
  'directions: it caught Water Shuriken on the `battle` inside hasAbility("battlebond"), and it ' +
  'missed Triple Axel (899 uses), Rage Fist (585) and Avalanche (29). unmodelledBasePower() asks ' +
  'the callbacks instead.');

ok((B.bpCounters.computed | 0) > 0, 'the base-power wire proves it ran', JSON.stringify(B.bpCounters));
ok((B.bpCounters.fallenSupplied | 0) > 0, 'and a non-zero fallen count actually reached a callback');
ok((B.bpCounters.alliesBuilt | 0) > 0, 'and an ally list was built from the board\'s party');

console.log(`\nBOARD CLOCK/POWER TESTS: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
