/* test-seed-clock.js — EVERY CLOCK THE POSITION IS RUNNING (ROADMAP #267, #268, #269, #270).
 *
 *   node tests/test-seed-clock.js
 *
 * Third sibling of tests/test-rollout-seed.js and tests/test-seed-residue.js, and it exists for the
 * same stated reason. Will, 2026-08-13: *"miltanks rollout needs to just play the game out on
 * medicham and have it match showdown perfectly thats the whole point. miltanks just chooses the
 * actions."* That makes the SEED the only place a correct simulator can still produce a wrong game,
 * so every approximation on it is a defect rather than a tradeoff.
 *
 * FOUR ROWS, ONE SURFACE — every one of them is a COUNTER the real position is running and the seed
 * hands over as zero, absent, or one:
 *
 *   #270  the field       `applyField` set weather/terrain and never weatherT/terrainT, and the
 *                         engine's tick is `if (weatherT > 0 && --weatherT <= 0)` — ZERO MEANS NEVER
 *                         EXPIRES. A sun with two turns left ran for sixty.
 *   #268  the hazards     Stealth Rock / Spikes / Sticky Web / Toxic Spikes carry no
 *                         `condition.duration` because they are permanent; `startSide` defaulted an
 *                         absent duration to ONE TURN. And `sideConditions` was a map of expiry with
 *                         no layer count, so a seeded Spikes was always one layer deep.
 *   #269  the volatiles   Taunt, Encore and Disable are on the live board WITH a duration and the
 *                         seed threw all three away.
 *   #267  the status      the board recorded the status NAME and nothing about how far through it
 *                         the body is, so a body two turns into a sleep got a fresh one.
 *
 * NOTHING HERE IS TYPED FROM MEMORY. The hazards and their layer ceilings come from the `hazard`
 * tag; the duration-volatiles come from the SAME `sealsMoves` + `statusInflict` join
 * `medicham2-browser.js:durationVolatiles()` uses, so the two vocabularies cannot disagree by
 * construction; the weather's own length comes from `MEDI.weatherTurns`; the species pool is
 * `MC.mons` intersected with `Dex.forFormat` filtered on `isNonstandard`/`tier`.
 *
 * THE VOCABULARY CHECK IS AN ARM, NOT A COMMENT (#269 asked for it first). `_vol.healblock` is read
 * by NOTHING in the engine — the consumer is `_healBlock` — so a seed that wrote the board's key
 * straight into `_vol` would seed a volatile nothing reads, silently, which is the terrain-dialect
 * defect one layer down. This file asserts that the seeded keys are exactly the ones the engine's own
 * table holds, and PRINTS every board volatile that is deliberately not seeded with the field it
 * would need.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent, and the legality of every fixture body ' +
    'in this file is DERIVED from it. This is not a pass.');
  process.exit(2);
}
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const B = require(D('engine', 'board.js'));
const RL = require(D('engine', 'rollout_leaf.js'));
const TAGS = require(D('engine', 'tags.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));   // the ONE door into MC.mons — see that file
/* MC.mons does not cover the whole format, so a body with no row is a real answer, not an error. */
const NO_ROW = { mayMiss: 'MC.mons does not cover the whole format; a species with no row has no dataset four' };
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  if (c) { pass++; console.log('  ok   ' + msg + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + msg + (extra ? '   ' + extra : '')); }
};
const note = (msg, extra) => console.log('  note ' + msg + (extra ? '   ' + extra : ''));

console.log('\ntest-seed-clock — the position\'s counters reach the playout (#267 #268 #269 #270)\n');

const nrm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const probeSkips = [];
const why = e => (e && e.message) || String(e);
const legalSpecies = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const BUILDABLE = Object.keys(globalThis.MC.mons)
  .filter(id => legalSpecies(dex.species.get(id)))
  .filter(id => { try { return !!MEDI.buildMon(id); } catch (e) { probeSkips.push('buildMon ' + id + ': ' + why(e)); return false; } });
ok(BUILDABLE.length >= 12, 'the fixture pool is buildable AND legal in this regulation',
  `${BUILDABLE.length} species`);

const MINE = BUILDABLE.slice(0, 6), THEIRS = BUILDABLE.slice(6, 12);
const zero = () => ({ fainted: 0, unbuildable: 0, threw: 0 });

function baseBoard() {
  const bd = new B.Board();
  bd.setParty('p1', MINE); bd.setParty('p2', THEIRS);
  return bd;
}
/* Both slots a side, because `battleInit` promotes the first BENCH body of a lone active onto the
 * field — the trap tests/test-rollout-seed.js records at its switch-in arm. */
function stood(bd) {
  bd.switchIn('p1', 'a', MINE[0]); bd.switchIn('p1', 'b', MINE[1]);
  bd.switchIn('p2', 'a', THEIRS[0]); bd.switchIn('p2', 'b', THEIRS[1]);
  return bd;
}
/* The leaf's own PRNG shape, local to this file: a behavioural arm that needs several DIFFERENT dice
 * cannot use a constant, and `() => 0.5` picks the same branch every time. */
const mulberryLocal = (seed) => {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const seedFrom = (bd, side, f) => {
  const A = RL.buildSide(bd, side, null, zero());
  const Bt = RL.buildSide(bd, side === 'p1' ? 'p2' : 'p1', null, zero());
  const S = MEDI.battleInit(A, Bt, { seeded: true });
  RL.applyField(S, f || {}, side, true);
  if (typeof RL.applyFieldClock === 'function') RL.applyFieldClock(S, bd, side);
  if (typeof RL.applySideState === 'function') RL.applySideState(S, bd, side);
  return S;
};

/* ---------------------------------------------------------------------------------------------
 * 1. ROADMAP #270 — THE SEEDED FIELD HAS NO CLOCK.
 *
 * `applyField` wrote `S.field.weather` and `S.field.terrain` and never the two counters beside them,
 * and the engine's tick is `if (field.weatherT > 0 && --field.weatherT <= 0)` — so zero is not "no
 * time left", it is "never expires". The same file already does it correctly one function away:
 * `applyMegaWeather` sets `weatherT` from `MEDI.weatherTurns(w, item, TAGS)`, which reads the rock off
 * the body. The two weather paths in one file disagreed with each other.
 *
 * THE LENGTH IS NEVER TYPED HERE. It is asked of `MEDI.weatherTurns`, the same function the mega
 * branch asks, so a regulation that changes a weather's length moves both together.
 * ------------------------------------------------------------------------------------------ */
{
  const WMOVE = dex.moves.all().find(m => m && m.exists && !m.isNonstandard && m.weather);
  ok(!!WMOVE, 'a weather-setting move is derived from the format rather than named',
    WMOVE ? `${WMOVE.id} -> ${WMOVE.weather}` : '-');

  if (WMOVE) {
    const W = MEDI.weatherId(WMOVE.weather);
    const FULL = MEDI.weatherTurns(W, '', TAGS);
    ok(FULL > 0, 'the engine states how long that weather lasts', `${W} = ${FULL} turns`);

    const clockAfter = (elapsed) => {
      const bd = stood(baseBoard());
      B.noteMove(bd, 'p1', bd.slot('p1', 'a'), WMOVE, true);
      for (let i = 0; i < elapsed; i++) bd.endTurn();
      /* *** THE WORD, NOT THE ACCESSOR — ROADMAP #276, AND THIS LINE IS THE GATE'S OWN CALLER. ***
       * Since #276 `board.weather` returns '' for a weather whose clock has run out, so a harness that
       * passed it here would hand the leaf a pre-emptied string and make `weatherExpired` unreachable
       * — a dead guard wearing the shape of a fixed one. `engine/miltank.js` passes `weatherWord()` for
       * exactly this reason; this harness must ask the same question the player asks. */
      const S = seedFrom(bd, 'p1', { weather: bd.weatherWord(), terrain: '' });
      return { w: S.field.weather, t: S.field.weatherT | 0 };
    };

    const fresh = clockAfter(0);
    ok(fresh.w === W, 'CONTROL — the weather itself still reaches the playout', `${fresh.w}`);
    ok(fresh.t === FULL, 'ROADMAP #270 — a weather set THIS turn seeds its full clock',
      `weatherT ${fresh.t} vs ${FULL}`);

    const old = clockAfter(2);
    ok(old.t === FULL - 2,
      'ROADMAP #270 — a weather two turns old seeds the turns it has LEFT, not a fresh one',
      `weatherT ${old.t} vs ${FULL - 2}`);

    const dead = clockAfter(FULL);
    ok(dead.t === 0 && !dead.w,
      'CONTROL — a weather that has already run out reaches the playout as no weather at all',
      `weather '${dead.w}' weatherT ${dead.t}`);

    /* THE ROCK IS THE OTHER HALF, and it is what made the two paths disagree in the first place. */
    const ROCK = (() => {
      for (const it of dex.items.all()) {
        if (!it || !it.exists || it.isNonstandard) continue;
        try { if (MEDI.weatherTurns(W, it.id, TAGS) > FULL) return it.id; } catch (e) { probeSkips.push('weatherTurns ' + it.id + ': ' + why(e)); }
      }
      return null;
    })();
    if (!ROCK) {
      note('#270 — no legal item extends this weather, so the rock arm has no observable', W);
    } else {
      const bd = stood(baseBoard());
      bd.setSheet('p1', MINE[0], { nature: 'Serious', item: ROCK, ability: '', moves: [WMOVE.id] });
      bd.switchIn('p1', 'a', MINE[0]);
      B.noteMove(bd, 'p1', bd.slot('p1', 'a'), WMOVE, true);
      const S = seedFrom(bd, 'p1', { weather: bd.weatherWord(), terrain: '' });
      ok((S.field.weatherT | 0) === MEDI.weatherTurns(W, ROCK, TAGS),
        'ROADMAP #270 — the SETTER\'s rock extends the seeded clock, derived not typed',
        `${ROCK}: weatherT ${S.field.weatherT} vs ${MEDI.weatherTurns(W, ROCK, TAGS)}`);
    }
  }

  /* THE TERRAIN HALF. `board.fieldLeft` already existed for Gravity; the terrain never used it. */
  const TMOVE = dex.moves.all().find(m => m && m.exists && !m.isNonstandard && m.terrain);
  ok(!!TMOVE, 'a terrain-setting move is derived from the format rather than named',
    TMOVE ? `${TMOVE.id} -> ${TMOVE.terrain}` : '-');
  if (TMOVE) {
    const dur = (TMOVE.condition && TMOVE.condition.duration) || 5;
    const bd = stood(baseBoard());
    B.noteMove(bd, 'p1', bd.slot('p1', 'a'), TMOVE, true);
    bd.endTurn();
    const S = seedFrom(bd, 'p1', { weather: '', terrain: RL.terrainOnBoard(bd) });
    ok(!!S.field.terrain, 'CONTROL — the terrain itself still reaches the playout', S.field.terrain);
    ok((S.field.terrainT | 0) === dur - 1,
      'ROADMAP #270 — a terrain one turn old seeds the turns it has LEFT',
      `terrainT ${S.field.terrainT} vs ${dur - 1}`);
  }
}

/* ---------------------------------------------------------------------------------------------
 * 2. ROADMAP #268 — A PERMANENT HAZARD WAS GIVEN A DURATION, AND LAYERS WERE NOT COUNTED.
 *
 * Derived from the format, not recalled: the four hazards carry NO `condition.duration`, because they
 * last until they are removed. `board.startSide` defaulted an absent duration to `turn + 1`, so in the
 * OFFLINE path — the fitter's board — a hazard was up for exactly one turn, and the live path passed
 * `fieldDuration`'s default of 5 and was wrong for longer.
 *
 * *** WHOSE SIDE IS READ, NEVER RE-DERIVED. *** ROADMAP #254 resolved that once, at the WRITE, in
 * `board.sideFor`; a second flip here would re-introduce it one layer up while looking like a fix.
 * Every arm below lays the hazard through `noteMove` — the one function both worlds call — and reads
 * the board's own per-side record.
 * ------------------------------------------------------------------------------------------ */
{
  const HZ = TAGS.withTag('move', 'hazard') || [];
  ok(HZ.length >= 4, 'the hazards are enumerated from their tag, not listed here', HZ.join(','));

  /* THE FORMAT'S OWN STATEMENT THAT THEY ARE PERMANENT — the premise of the whole row. */
  const timed = HZ.filter(id => { const m = dex.moves.get(id); return m && m.condition && m.condition.duration; });
  ok(timed.length === 0,
    'PREMISE — no hazard in this regulation declares a duration, so none of them expires on a clock',
    `${HZ.length} hazards, ${timed.length} timed`);

  for (const hz of HZ) {
    const key = nrm((TAGS.param('move', hz, 'hazard') || {}).hazard || hz);
    const mv = dex.moves.get(hz);
    const bd = stood(baseBoard());
    B.noteMove(bd, 'p1', bd.slot('p1', 'a'), mv, true);
    ok(bd.hasSide('p2', key), `PRECONDITION (#254) — ${hz} laid by p1 is recorded against p2`,
      `p1 ${bd.hasSide('p1', key)} / p2 ${bd.hasSide('p2', key)}`);
    for (let i = 0; i < 8; i++) bd.endTurn();
    ok(bd.hasSide('p2', key),
      `ROADMAP #268 — ${key} is STILL up eight turns later, because nothing removed it`,
      `hasSide ${bd.hasSide('p2', key)}`);
    const S = seedFrom(bd, 'p1');
    ok(((S.sfB.hz || {})[key] | 0) > 0,
      `ROADMAP #268 — and it still reaches the playout eight turns later`,
      `sfB.hz ${JSON.stringify(S.sfB.hz || {})}`);
  }

  /* --- LAYERS. `sideConditions` was a map of EXPIRY with no count, so a seeded Spikes was one deep
   * however many times it had been laid, and one Toxic Spikes is poisoned where two is badly. */
  for (const hz of HZ) {
    const p = TAGS.param('move', hz, 'hazard') || {};
    const key = nrm(p.hazard || hz);
    const max = Math.max(1, +p.maxLayers || 1);
    const mv = dex.moves.get(hz);
    const bd = stood(baseBoard());
    for (let i = 0; i < max + 1; i++) B.noteMove(bd, 'p1', bd.slot('p1', 'a'), mv, true);
    ok(bd.sideLayers('p2', key) === max,
      `ROADMAP #268 — ${key} laid ${max + 1} times counts ${max} layers and clamps at the tag's ceiling`,
      `layers ${bd.sideLayers('p2', key)} vs max ${max}`);
    const S = seedFrom(bd, 'p1');
    ok(((S.sfB.hz || {})[key] | 0) === max,
      `ROADMAP #268 — the playout receives all ${max} layer(s) of ${key}`,
      `sfB.hz ${JSON.stringify(S.sfB.hz || {})}`);
  }

  /* --- AND THE LAYERS ARE READABLE: deeper Spikes take more HP off the body that walks into them.
   * The observable is the switch-in, not the field, and ALL FOUR SLOTS PIVOT so that nobody attacks
   * and any HP that moves is entry damage (tests/test-rollout-seed.js records why). */
  {
    const LAYERED = HZ.filter(id => (+(TAGS.param('move', id, 'hazard') || {}).maxLayers || 1) > 1);
    const chip = (hz, n) => {
      const mv = dex.moves.get(hz);
      const bd = stood(baseBoard());
      for (let i = 0; i < n; i++) B.noteMove(bd, 'p1', bd.slot('p1', 'a'), mv, true);
      const S = seedFrom(bd, 'p1');
      const inFoe = S.benchB[0];
      const f = new Map(), g = new Map();
      S.actA.forEach((m, i) => { if (S.benchA[i]) f.set(m, { kind: 'switch', to: S.benchA[i] }); });
      S.actB.forEach((m, i) => { if (S.benchB[i]) g.set(m, { kind: 'switch', to: S.benchB[i] }); });
      MEDI.battleTurn(S, () => 0.5, f, g);
      return inFoe ? inFoe.st.hp - inFoe.curHP : null;
    };
    let armed = false;
    for (const hz of LAYERED) {
      const max = Math.max(1, +(TAGS.param('move', hz, 'hazard') || {}).maxLayers || 1);
      let one = null, deep = null;
      try { one = chip(hz, 1); deep = chip(hz, max); } catch (e) { probeSkips.push('layer chip ' + hz + ': ' + why(e)); continue; }
      if (one == null || deep == null || one === 0) continue;
      armed = true;
      ok(deep > one,
        `ROADMAP #268 — ${max} layers of ${hz} hurt the switch-in more than one does`,
        `1 layer -${one}, ${max} layers -${deep}`);
    }
    if (!armed) note('#268 — no layered hazard produced entry damage on this fixture, so the ' +
      'behavioural layer arm carries no assertion; the field arms above still bind', LAYERED.join(','));
  }

  /* --- CONTROL: A TIMED SIDE CONDITION STILL EXPIRES ON ITS OWN CLOCK. Without this the fix could
   * pass by simply making every side condition permanent, which is a new bug wearing the shape of the
   * old one. */
  {
    const TIMED = dex.moves.all().filter(m => m && m.exists && !m.isNonstandard && m.sideCondition &&
                                              m.condition && m.condition.duration);
    ok(TIMED.length > 0, 'CONTROL POPULATION — timed side conditions exist and are derived',
      `${TIMED.length} moves`);
    for (const m of TIMED.slice(0, 4)) {
      const d = m.condition.duration;
      const bd = stood(baseBoard());
      B.noteMove(bd, 'p1', bd.slot('p1', 'a'), m, true);
      const own = B.sideFor('p1', m);
      for (let i = 0; i < d - 1; i++) bd.endTurn();
      const upBefore = bd.hasSide(own, nrm(m.sideCondition));
      bd.endTurn();
      const upAfter = bd.hasSide(own, nrm(m.sideCondition));
      ok(upBefore && !upAfter,
        `CONTROL — ${m.id} still expires exactly on its own ${d}-turn clock`,
        `turn ${d - 1} up ${upBefore} / turn ${d} up ${upAfter}`);
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * 3. ROADMAP #269 — THE DURABLE VOLATILES.
 *
 * `magnemite.js` already writes `board.startVolatile` from `|-start|` WITH a duration, so the live
 * board holds a real answer the seed threw away. The row's FIRST task is a vocabulary check rather
 * than a patch: `_vol`'s keys come from a TAG PARAM and the board's come from the protocol's own
 * name, and a key that does not match seeds a volatile nothing ever reads — silently.
 *
 * SO THE SEEDED SET IS DERIVED FROM THE ENGINE'S OWN TABLE. `medicham2-browser.js:durationVolatiles()`
 * is the `sealsMoves` + `statusInflict` join; the seed uses the identical expression, so the two
 * cannot come apart. Everything the board holds outside that set is REPORTED with the field it would
 * need, which is the vocabulary check itself.
 * ------------------------------------------------------------------------------------------ */
{
  /* The engine's own table, rebuilt here by the same join it uses. */
  const ENGINE_VOL = new Map();
  for (const id of (TAGS.withTag('move', 'sealsMoves') || [])) {
    const sm = TAGS.param('move', id, 'sealsMoves');
    const si = TAGS.param('move', id, 'statusInflict');
    if (!sm || !(+sm.turns > 0) || !si || !Array.isArray(si.effects)) continue;
    for (const e of si.effects) if (e.volatile) ENGINE_VOL.set(e.volatile, +sm.turns);
  }
  ok(ENGINE_VOL.size > 0, 'the duration-volatile table is derived by the engine\'s own join',
    [...ENGINE_VOL.keys()].join(','));

  ok(typeof RL.seedableVolatiles === 'function', 'ROADMAP #269 — the seed publishes which volatiles it carries');
  const SEEDED = typeof RL.seedableVolatiles === 'function' ? RL.seedableVolatiles() : new Map();
  ok([...ENGINE_VOL.keys()].every(k => SEEDED.has(k)),
    'ROADMAP #269 — every volatile the ENGINE ticks is one the seed carries',
    `engine [${[...ENGINE_VOL.keys()].join(',')}] seed [${[...SEEDED.keys()].join(',')}]`);

  /* THE BEHAVIOURAL ARM. Reading `_vol` back would only prove the seed wrote what the seed wrote, so
   * the observable is what the body is ALLOWED TO DO: a Taunted body may not select a status move. */
  const statusMoveFor = sp => ((mcKey.row(sp, NO_ROW) || {}).mv || []).map(nrm)
    .find(id => globalThis.MC.moves[id] && !(globalThis.MC.moves[id].bp | 0));
  const TU = MINE.find(sp => statusMoveFor(sp));
  ok(!!TU, 'a body with a status move in its own dataset row is derived', String(TU));

  if (TU && ENGINE_VOL.has('taunt')) {
    const mkTaunt = (taunted) => {
      const bd = baseBoard();
      bd.setParty('p1', [TU].concat(MINE.filter(s => s !== TU)).slice(0, 6));
      bd.setSheet('p1', TU, { nature: 'Serious', item: '', ability: '', moves: [statusMoveFor(TU)] });
      stood(bd); bd.switchIn('p1', 'a', TU);
      if (taunted) bd.startVolatile('p1', 'a', 'taunt', ENGINE_VOL.get('taunt'));
      const A = RL.buildSide(bd, 'p1', null, zero());
      return (A[0] && A[0]._vol && A[0]._vol.taunt) | 0;
    };
    ok(mkTaunt(false) === 0, 'CONTROL — a body with no Taunt on the board carries none into the playout');
    ok(mkTaunt(true) === ENGINE_VOL.get('taunt'),
      'ROADMAP #269 — a Taunted body reaches the playout still Taunted, with the turns it has left',
      `_vol.taunt ${mkTaunt(true)} vs ${ENGINE_VOL.get('taunt')}`);

    /* AND IT BINDS. The status move must actually be refused, or the volatile is recorded and
     * ignored — the shape that made Encore LOOK modelled for a whole session. */
    const played = (taunted) => {
      const bd = baseBoard();
      bd.setParty('p1', [TU].concat(MINE.filter(s => s !== TU)).slice(0, 6));
      bd.setSheet('p1', TU, { nature: 'Serious', item: '', ability: '', moves: [statusMoveFor(TU)] });
      stood(bd); bd.switchIn('p1', 'a', TU);
      if (taunted) bd.startVolatile('p1', 'a', 'taunt', ENGINE_VOL.get('taunt'));
      const A = RL.buildSide(bd, 'p1', null, zero());
      const Bt = RL.buildSide(bd, 'p2', null, zero());
      const trace = [];
      const S = MEDI.battleInit(A, Bt, { seeded: true, trace });
      S._explore = 0;
      MEDI.battleTurn(S, () => 0.5, null, null);
      const mv = nrm(statusMoveFor(TU));
      return trace.some(l => new RegExp('\\|move\\|p1a[^|]*\\|').test(String(l)) &&
                             nrm(String(l).split('|')[3] || '') === mv);
    };
    let free = null, gagged = null;
    try { free = played(false); gagged = played(true); } catch (e) { probeSkips.push('taunt playout: ' + why(e)); }
    if (free === null) note('#269 — the Taunt playout arm threw and carries no assertion');
    else if (!free) note('#269 — the untaunted body did not click its status move on this fixture, ' +
      'so the behavioural arm has no control and carries no assertion', `move ${statusMoveFor(TU)}`);
    else ok(!gagged, 'ROADMAP #269 — the seeded Taunt actually REFUSES the status click',
      `free ${free} / taunted ${gagged}`);
  }

  /* THE VOCABULARY CHECK, PRINTED. Every volatile the live board can hold that the seed does not
   * carry, with the engine field it would need — so a mismatch is visible rather than silent. */
  if (typeof RL.unseededVolatiles === 'function') {
    for (const [k, reason] of RL.unseededVolatiles()) note(`#269 NOT SEEDED — ${k}:`, reason);
  }
}

/* ---------------------------------------------------------------------------------------------
 * 4. ROADMAP #267 — A STATUS IS SEEDED AND ITS COUNTER IS NOT.
 *
 * The seed carries `status` onto every body and NOTHING about how far through it the body is, so a
 * body two turns into a one-or-two-turn sleep wakes late in every playout and a `tox` at stage 5 chips
 * at stage 1. The engine already has the harder half right — `par/brn/psn/frz/slp` have no switch
 * handler so their counters CARRY OVER, while `tox.onSwitchIn` restarts the ramp — and the BOARD
 * recorded only the name.
 * ------------------------------------------------------------------------------------------ */
{
  /* The statuses that HAVE a counter, and the field each one is kept in, are the engine's own. */
  const COUNTED = [['slp', 'slpTurns'], ['tox', 'toxTurns'], ['frz', 'frzTurns']];

  const clockAfter = (st, turns) => {
    const bd = stood(baseBoard());
    bd.slot('p1', 'a').status = st;
    for (let i = 0; i < turns; i++) bd.endTurn();
    return bd;
  };

  for (const [st, field] of COUNTED) {
    const bd = clockAfter(st, 3);
    ok(bd.statusTurns('p1', MINE[0]) === 3,
      `ROADMAP #267 — the board counts the turns a body has spent ${st}`,
      `statusTurns ${bd.statusTurns('p1', MINE[0])}`);
    const A = RL.buildSide(bd, 'p1', null, zero());
    ok((A[0] && A[0][field] | 0) === 3,
      `ROADMAP #267 — and the playout body starts ${field} at 3, not 0`,
      `${field} ${A[0] && A[0][field] | 0}`);
  }

  /* CONTROL — a status with NO counter contributes none, and a body with no status is untouched. */
  {
    const bd = clockAfter('par', 3);
    const A = RL.buildSide(bd, 'p1', null, zero());
    ok(!(A[0].slpTurns | 0) && !(A[0].toxTurns | 0) && !(A[0].frzTurns | 0),
      'CONTROL — a paralysed body carries no sleep, toxic or freeze counter');
    const clean = stood(baseBoard());
    clean.endTurn(); clean.endTurn();
    const A2 = RL.buildSide(clean, 'p1', null, zero());
    ok(!(A2[0].slpTurns | 0) && !(A2[0].toxTurns | 0) && !(A2[0].frzTurns | 0) && !A2[0].status,
      'CONTROL — an unstatused body two turns in is byte-identical to what it was');
  }

  /* THE CLOCK RESTARTS WHEN THE STATUS DOES, or a cured-and-re-slept body inherits the old count. */
  {
    const bd = stood(baseBoard());
    bd.slot('p1', 'a').status = 'slp';
    bd.endTurn(); bd.endTurn();
    bd.slot('p1', 'a').status = '';
    bd.endTurn();
    bd.slot('p1', 'a').status = 'slp';
    bd.endTurn();
    ok(bd.statusTurns('p1', MINE[0]) === 1,
      'ROADMAP #267 — a cured and re-applied status restarts its own clock',
      `statusTurns ${bd.statusTurns('p1', MINE[0])}`);
  }

  /* A BENCHED BODY KEEPS ITS COUNT AND DOES NOT ACCRUE, which is the engine's rule and not a choice:
   * `slpTurns` moves only when the body acts, and `tox.onSwitchIn` restarts the ramp on entry. */
  {
    const bd = stood(baseBoard());
    bd.slot('p1', 'a').status = 'slp';
    bd.endTurn(); bd.endTurn();
    bd.switchIn('p1', 'a', MINE[2]);
    bd.endTurn(); bd.endTurn(); bd.endTurn();
    ok(bd.statusTurns('p1', MINE[0]) === 2,
      'ROADMAP #267 — a sleeping body that pivots out keeps its count and does not accrue on the bench',
      `statusTurns ${bd.statusTurns('p1', MINE[0])}`);
    const A = RL.buildSide(bd, 'p1', null, zero());
    const back = A.find(x => x && nrm(x.name) === nrm(MINE[0]));
    ok(!!back && (back.slpTurns | 0) === 2,
      'ROADMAP #267 — and the BENCHED body carries it into the playout too',
      back ? `slpTurns ${back.slpTurns | 0}` : 'not built');
  }
}

/* ---------------------------------------------------------------------------------------------
 * 4b. ROADMAP #275 — THE CALLER'S FIELD TYPED TWO CLOCKS AS CONSTANTS.
 *
 * `miltank.js` built `twA: hasSide(side,'tailwind') ? 4 : 0` and `tr: hasField('trickroom') ? 5 : 0`,
 * and seven other callers built the same object with the same two literals — so a Tailwind with one
 * turn left was seeded with four in every one of them. It is #270 in a different file: the position
 * runs a clock and the seed hands over a constant.
 *
 * NEITHER KEY NOR DURATION IS TYPED HERE. The speed side condition comes from the `doublesSideSpeed`
 * tag and the room from `reversesSpeed`; both durations come from the dex condition of the move that
 * sets them; and `board.speedSideKeys()` / `board.roomFieldKey()` are asserted AGAINST the format
 * rather than trusted, so a regulation that renames either fails here loudly.
 * ------------------------------------------------------------------------------------------ */
{
  const legalMove = id => { const m = dex.moves.get(id); return m && m.exists && !m.isNonstandard ? m : null; };
  const TWM = ((TAGS.withTag('move', 'doublesSideSpeed') || []).map(legalMove).filter(Boolean))[0];
  const TRM = ((TAGS.withTag('move', 'reversesSpeed') || []).map(legalMove).filter(Boolean))[0];
  ok(!!TWM, 'the speed-doubling side condition is derived from the tag, not named', TWM ? TWM.id : '-');
  ok(!!TRM, 'the speed-reversing field is derived from the tag, not named', TRM ? TRM.id : '-');

  if (TWM && TRM) {
    const TWKEY = nrm(TWM.sideCondition || TWM.id), TWDUR = (TWM.condition && TWM.condition.duration) | 0;
    const TRKEY = nrm(TRM.pseudoWeather || TRM.id), TRDUR = (TRM.condition && TRM.condition.duration) | 0;
    ok(TWDUR > 1 && TRDUR > 1, 'both clocks have a real dex duration to run down',
      `${TWKEY} ${TWDUR} / ${TRKEY} ${TRDUR}`);

    /* THE BOARD ANSWERS WITH THE FORMAT'S OWN KEY, which is what lets the leaf read the remainder
     * without spelling either word. A board that answered with a key the format does not use would
     * seed zero on every position and look exactly like a position with no Tailwind on it. */
    ok(typeof B.speedSideKeys === 'function' && B.speedSideKeys().includes(TWKEY),
      'ROADMAP #275 — `board.speedSideKeys()` answers with the format\'s own side-condition key',
      JSON.stringify(typeof B.speedSideKeys === 'function' ? B.speedSideKeys() : null));
    ok(typeof B.roomFieldKey === 'function' && B.roomFieldKey() === TRKEY,
      'ROADMAP #275 — the declared room key still matches the format',
      `${typeof B.roomFieldKey === 'function' ? B.roomFieldKey() : '-'} vs ${TRKEY}`);

    /* THE CALLER DELIBERATELY LIES IN EVERY ARM BELOW — it passes the old constants — so a green row
     * can only mean the board overruled it. */
    const CALLER = { twA: TWDUR, twB: TWDUR, tr: TRDUR };
    const twAfter = (elapsed, sd) => {
      const bd = stood(baseBoard());
      bd.startSide(sd, TWKEY, TWDUR);
      for (let i = 0; i < elapsed; i++) bd.endTurn();
      return seedFrom(bd, 'p1', Object.assign({}, CALLER));
    };
    ok((twAfter(0, 'p1').field.twA | 0) === TWDUR,
      'ROADMAP #275 — a Tailwind set this turn seeds its full remainder',
      `twA ${twAfter(0, 'p1').field.twA} vs ${TWDUR}`);
    ok((twAfter(2, 'p1').field.twA | 0) === TWDUR - 2,
      'ROADMAP #275 — a Tailwind two turns old reaches the playout with what is LEFT, not with the constant',
      `twA ${twAfter(2, 'p1').field.twA} vs caller ${TWDUR}`);
    ok((twAfter(TWDUR, 'p1').field.twA | 0) === 0,
      'ROADMAP #275 — an EXPIRED Tailwind is not carried, though the caller still types four',
      `twA ${twAfter(TWDUR, 'p1').field.twA}`);

    /* BOTH SEATS, for the reason #249's hazards are asserted from both: a swap between A and B
     * cancels invisibly when only one side is ever tested, and side A is the ASKING side here. */
    {
      const bd = stood(baseBoard());
      bd.startSide('p2', TWKEY, TWDUR); bd.endTurn();
      const asP1 = seedFrom(bd, 'p1', Object.assign({}, CALLER));
      const asP2 = seedFrom(bd, 'p2', Object.assign({}, CALLER));
      ok((asP1.field.twB | 0) === TWDUR - 1 && (asP1.field.twA | 0) === 0,
        'ROADMAP #275 — a FOE Tailwind lands on side B and not on mine',
        `twA ${asP1.field.twA} twB ${asP1.field.twB}`);
      ok((asP2.field.twA | 0) === TWDUR - 1 && (asP2.field.twB | 0) === 0,
        'ROADMAP #275 — and the same board asked from the OTHER seat answers the mirror',
        `twA ${asP2.field.twA} twB ${asP2.field.twB}`);
    }

    /* THE ROOM, which is the worse of the two: its number is a SPEED INVERSION rather than a
     * multiplier, so a room the caller keeps alive reverses the order for the whole playout. */
    {
      const bd = stood(baseBoard());
      bd.startField(TRKEY, TRDUR); bd.endTurn();
      ok((seedFrom(bd, 'p1', Object.assign({}, CALLER)).field.tr | 0) === TRDUR - 1,
        'ROADMAP #275 — a Trick Room one turn old seeds its remainder, not the constant',
        `tr ${seedFrom(bd, 'p1', Object.assign({}, CALLER)).field.tr} vs caller ${TRDUR}`);
      for (let i = 0; i < TRDUR; i++) bd.endTurn();
      ok((seedFrom(bd, 'p1', Object.assign({}, CALLER)).field.tr | 0) === 0,
        'ROADMAP #275 — and an expired room is gone, though the caller types five');
    }

    /* CONTROL — a board with NEITHER up seeds neither, whatever the caller says. Without this the
     * arms above pass for a seed that simply zeroes both fields. */
    {
      const S = seedFrom(stood(baseBoard()), 'p1', Object.assign({}, CALLER));
      ok(!(S.field.twA | 0) && !(S.field.twB | 0) && !(S.field.tr | 0),
        'CONTROL — a bare board seeds no Tailwind and no room, whatever the caller passed',
        `twA ${S.field.twA} twB ${S.field.twB} tr ${S.field.tr}`);
    }
    note('DECLARED — these are STATE reads, not behavioural arms:',
      'the engine consumes `field.twA`/`field.tr` in its own speed sort and residual tick, and what ' +
      'the seed produces is exactly those two numbers. There is no observable between them to read.');
  }
}

/* ---------------------------------------------------------------------------------------------
 * 4c. ROADMAP #277 — THE REMAINDER OF #269: THE TRANSLATED VOLATILES, THE CHOICE LOCK AND THE FOE'S
 * PROTECT STREAK.
 *
 * #269 carried the three volatiles the engine's own `durationVolatiles()` table holds. Six more were
 * declared UNSEEDED with a reason each. Three of those six are now carried and three are still
 * refused BY NAME — `rollout_leaf.unseededVolatiles()` prints the refusals on every run, because a
 * silent omission and a considered one look identical in the code.
 * ------------------------------------------------------------------------------------------ */
{
  const ENGSRC = require('fs').readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  const JOIN = RL.VOL_ENGINE_FIELD || {};
  ok(Object.keys(JOIN).length > 0, 'ROADMAP #277 — the seed declares a protocol-to-engine join',
    JSON.stringify(JOIN));

  /* THE VOCABULARY CHECK, BOTH HALVES. The KEY must be the word the wire carries (`magnemite.js`
   * writes `norm` of the `-start` name, and the format's own condition carries that name), and the
   * FIELD must be one the engine still reads — the exact mismatch `_vol.healblock` is. */
  for (const [key, field] of Object.entries(JOIN)) {
    const c = dex.conditions.get(key);
    ok(!!(c && c.exists) && nrm(c.name) === key,
      `ROADMAP #277 — \`${key}\` is the format's own word for this volatile, which is what the wire carries`,
      c ? `${c.name} -> ${nrm(c.name)}` : 'no condition');
    ok(ENGSRC.includes(field + '>0') || ENGSRC.includes(field + ' > 0'),
      `ROADMAP #277 — and the engine still READS \`${field}\`, so this is not a write nobody consumes`);
    ok(!(typeof RL.seedableVolatiles === 'function' && RL.seedableVolatiles().has(key)),
      `ROADMAP #277 — \`${key}\` is not ALSO in the \`_vol\` table — one owner per effect`);
  }

  /* THE VALUE ARM: the board's remaining count reaches the engine's own field, and NOTHING is written
   * into `_vol` beside it. The duration is the format's for that condition; what is under test is the
   * pipe, not the number the live adapter chooses. */
  for (const [key, field] of Object.entries(JOIN)) {
    const c = dex.conditions.get(key);
    const dur = Math.max(2, (c && c.duration) | 0);
    const bd = stood(baseBoard());
    bd.startVolatile('p1', 'a', key, dur);
    bd.endTurn();
    const A = RL.buildSide(bd, 'p1', null, zero());
    ok((A[0] && A[0][field] | 0) === dur - 1,
      `ROADMAP #277 — a board \`${key}\` reaches the playout as \`${field}\`, with what is left on it`,
      `${field} ${A[0] && A[0][field] | 0} vs ${dur - 1}`);
    ok(!(A[0] && A[0]._vol && A[0]._vol[key]),
      `ROADMAP #277 — and NOT into \`_vol.${key}\`, which nothing reads`);
    const clean = RL.buildSide(stood(baseBoard()), 'p1', null, zero());
    ok(!(clean[0] && clean[0][field]),
      `CONTROL — a body with no ${key} on the board carries no \`${field}\``);
  }

  /* THE BEHAVIOURAL ARM, and it is the sound lock because that one has an observable: a silenced body
   * must REFUSE a sound move. Everything about it is derived — the carrier from `blocksSoundMoves`,
   * the protocol key from that move's own NAME (which is what `magnemite.js` normalises off the
   * `-start` line), and the victim from a species whose dataset row holds a sound-tagged move. */
  const SNDM = ((TAGS.withTag('move', 'blocksSoundMoves') || [])
    .map(id => dex.moves.get(id)).filter(m => m && m.exists && !m.isNonstandard))[0];
  ok(!!SNDM, 'the sound lock\'s carrier is derived from the tag rather than named', SNDM ? SNDM.id : '-');
  if (SNDM) {
    const SNDKEY = nrm(SNDM.name);
    ok(!!JOIN[SNDKEY], 'ROADMAP #277 — and the join holds it under the PROTOCOL\'s word for it', SNDKEY);
    const soundMovesFor = sp => ((mcKey.row(sp, NO_ROW) || {}).mv || []).map(nrm)
      .filter(id => TAGS.has('move', id, 'sound') && globalThis.MC.moves[id]);
    /* THE FIXTURE IS CONSTRUCTED, NOT FOUND. A body handed one sound move may still decline to click
     * it — the picker can prefer a switch, and a status move against a full-health foe is not always
     * its greedy choice — and a control that does not fire proves nothing about the silenced arm. So
     * every (species, sound move) pair is tried until the UNSILENCED body actually clicks. */
    const played = (sp, mv, silenced) => {
      const bd = baseBoard();
      bd.setParty('p1', [sp].concat(MINE.filter(s => s !== sp)).slice(0, 6));
      bd.setSheet('p1', sp, { nature: 'Serious', item: '', ability: '', moves: [mv] });
      stood(bd); bd.switchIn('p1', 'a', sp);
      if (silenced) bd.startVolatile('p1', 'a', SNDKEY, 2);
      const A = RL.buildSide(bd, 'p1', null, zero());
      const Bt = RL.buildSide(bd, 'p2', null, zero());
      const trace = [];
      const S = MEDI.battleInit(A, Bt, { seeded: true, trace });
      S._explore = 0;
      MEDI.battleTurn(S, () => 0.5, null, null);
      return trace.some(l => /\|move\|p1a[^|]*\|/.test(String(l)) &&
                             nrm(String(l).split('|')[3] || '') === nrm(mv));
    };
    let pair = null, gagged = null;
    for (const sp of BUILDABLE) {
      for (const mv of soundMovesFor(sp)) {
        let free = false;
        try { free = played(sp, mv, false); } catch (e) { probeSkips.push('sound lock control: ' + why(e)); continue; }
        if (!free) continue;
        pair = [sp, mv];
        try { gagged = played(sp, mv, true); } catch (e) { probeSkips.push('sound lock playout: ' + why(e)); }
        break;
      }
      if (pair) break;
    }
    ok(!!pair, 'a body that actually clicks a sound move is CONSTRUCTED rather than assumed',
      pair ? pair.join(' / ') : 'no pair in the fixture pool clicked one');
    if (pair && gagged !== null) {
      ok(!gagged, 'ROADMAP #277 — the seeded sound lock actually REFUSES the sound click',
        `${pair.join(' / ')} — free true / silenced ${gagged}`);
    } else if (pair) note('#277 — the silenced arm threw and carries no assertion');
  }

  /* THE CHOICE LOCK. It was derived inside `candidates()` and nowhere else, so the FIT knew a locked
   * body had one legal move and the PLAYOUT did not. The item is derived from the dex's own
   * `isChoice` flag; nothing is named. */
  /* *** AND THE FIT IS UNMOVED, PROVED OVER THE WHOLE ITEM TABLE RATHER THAN ARGUED. ***
   * `candidates()` narrows the choice set with this same function now, and that function's only
   * inputs are the body's `lastMove` and its item. So if it answers exactly `isChoice` for EVERY
   * legal item in the regulation, no choice set can have moved and `data/policy-weights.json` keeps
   * its meaning. This is the check, not the claim. */
  {
    /* Both fixtures are derived: the first legal move in the format, and the first legal Choice item. */
    const ANYMV = dex.moves.all().filter(m => m && m.exists && !m.isNonstandard)[0];
    const ANYCH = dex.items.all().filter(i => i && i.exists && !i.isNonstandard && i.isChoice)[0];
    const probe = (itemId) => B.choiceLockOn({ lastMove: ANYMV && ANYMV.id, item: itemId }, dex);
    const items = dex.items.all().filter(i => i && i.exists && !i.isNonstandard);
    const wrong = items.filter(i => !!probe(i.id) !== !!i.isChoice);
    ok(items.length > 20 && wrong.length === 0,
      'ROADMAP #277 — the shared lock answers exactly `isChoice` for every legal item, so no choice set moved',
      `${items.length} items, ${wrong.length} disagreements${wrong.length ? ' — ' + wrong.slice(0, 5).map(i => i.id).join(',') : ''}`);
    ok(!!ANYCH && B.choiceLockOn({ lastMove: '', item: ANYCH.id }, dex) === null,
      'CONTROL — and a body that has not moved is never locked, whatever it holds');
  }

  const CHOICE = dex.items.all().filter(i => i && i.exists && !i.isNonstandard && i.isChoice)[0];
  ok(!!CHOICE, 'the Choice item is derived from the dex\'s own flag rather than named',
    CHOICE ? CHOICE.id : 'none in this regulation');
  if (CHOICE) {
    const SP = MINE[0];
    const MVS = ((mcKey.row(SP, NO_ROW) || {}).mv || []).map(nrm).filter(id => {
      const m = dex.moves.get(id); return m && m.exists && !m.isNonstandard;
    }).slice(0, 2);
    ok(MVS.length === 2, 'a two-move body is derived, so a lock has something to exclude', MVS.join(','));
    const locked = (item, moved) => {
      const bd = baseBoard();
      bd.setSheet('p1', SP, { nature: 'Serious', item, ability: '', moves: MVS });
      stood(bd); bd.switchIn('p1', 'a', SP);
      const mon = bd.slot('p1', 'a');
      if (moved) { B.noteMove(bd, 'p1', mon, dex.moves.get(MVS[0]), true); bd.endTurn(); }
      return { bd, mon };
    };
    if (MVS.length === 2) {
      const on = locked(CHOICE.id, true);
      ok(B.choiceLockOn(on.mon, dex) === MVS[0],
        'ROADMAP #277 — the board answers WHICH move the item has locked this body into',
        String(B.choiceLockOn(on.mon, dex)));
      const A = RL.buildSide(on.bd, 'p1', dex, zero());
      ok(A[0] && A[0]._lock === MVS[0] && A[0]._lockT === Infinity,
        'ROADMAP #277 — and the lock reaches the playout body, with the engine\'s own Infinity discriminator',
        A[0] ? `_lock ${A[0]._lock} _lockT ${A[0]._lockT}` : 'not built');

      const noItem = locked('', true);
      const A2 = RL.buildSide(noItem.bd, 'p1', dex, zero());
      ok(!(A2[0] && A2[0]._lock), 'CONTROL — a body holding nothing is not locked');
      const notMoved = locked(CHOICE.id, false);
      const A3 = RL.buildSide(notMoved.bd, 'p1', dex, zero());
      ok(!(A3[0] && A3[0]._lock), 'CONTROL — a body that has not moved since it arrived is not locked');

      /* AND IT BINDS: the other move must never be clicked. Six dice, because a body free to choose
       * picks the same move by chance often enough that one turn proves nothing. */
      const clicks = (bd) => {
        const seen = new Set();
        for (let s = 0; s < 6; s++) {
          const A4 = RL.buildSide(bd, 'p1', dex, zero());
          const B4 = RL.buildSide(bd, 'p2', dex, zero());
          const trace = [];
          const S = MEDI.battleInit(A4, B4, { seeded: true, trace });
          S._explore = 1;
          const r = mulberryLocal(s * 7919 + 3);
          try { MEDI.battleTurn(S, r, null, null); } catch (e) { probeSkips.push('choice lock playout: ' + why(e)); }
          for (const l of trace) {
            const p = String(l).split('|');
            if (p[1] === 'move' && /^p1a/.test(String(p[2] || ''))) seen.add(nrm(p[3] || ''));
          }
        }
        return seen;
      };
      const freeSeen = clicks(locked('', true).bd);
      const lockSeen = clicks(on.bd);
      if (!freeSeen.has(MVS[1])) note('#277 — the unlocked body never clicked its second move on this ' +
        'fixture, so the behavioural arm has no control and carries no assertion', MVS.join(','));
      else ok(!lockSeen.has(MVS[1]),
        'ROADMAP #277 — the seeded lock actually REMOVES the other move from the menu',
        `free [${[...freeSeen].join(',')}] locked [${[...lockSeen].join(',')}]`);
    }
  }

  /* THE FOE'S PROTECT STREAK. `mag_bot.js`'s tracker is gated `if (mine)` and is caller state, so the
   * opponent's consecutive Protects were never counted anywhere — the search priced the foe's shield
   * as certain every turn. The counter is `board.noteMove`'s now, which is called on every `|move|`
   * line from BOTH sides and by every offline replay.
   *
   * NO CALLER MAP IS PASSED IN ANY ARM BELOW. That is the row: the foe never had one. */
  {
    const ST = dex.moves.all().find(m => m && m.exists && !m.isNonstandard && m.stallingMove);
    const AT = dex.moves.all().find(m => m && m.exists && !m.isNonstandard && !m.stallingMove &&
      (m.basePower | 0) > 0 && !TAGS.has('move', nrm(m.id), 'stallCounterFeeds'));
    ok(!!ST, 'a shield move is derived from the dex\'s own stalling flag', ST ? ST.id : '-');
    ok(!!AT, 'and an ordinary attack to break the streak with', AT ? AT.id : '-');
    if (ST && AT) {
      const streak = (seq) => {
        const bd = stood(baseBoard());
        for (const m of seq) { B.noteMove(bd, 'p2', bd.slot('p2', 'a'), m, true); bd.endTurn(); }
        return bd;
      };
      const two = streak([ST, ST]);
      ok((two.slot('p2', 'a').protectStreak | 0) === 2,
        'ROADMAP #277 — the board counts the FOE\'s consecutive shields',
        `protectStreak ${two.slot('p2', 'a').protectStreak}`);
      const Bt = RL.buildSide(two, 'p2', null, zero());
      ok((Bt[0] && Bt[0].tookProtectTurns | 0) === 2,
        'ROADMAP #277 — and it reaches the foe\'s playout body with NO caller map at all',
        `tookProtectTurns ${Bt[0] && Bt[0].tookProtectTurns}`);

      const broken = streak([ST, AT]);
      ok(!(broken.slot('p2', 'a').protectStreak | 0),
        'ROADMAP #277 — an ordinary move breaks the streak, which is Showdown\'s own rule');
      const B2 = RL.buildSide(broken, 'p2', null, zero());
      ok(!(B2[0] && B2[0].tookProtectTurns | 0),
        'CONTROL — and the broken streak reaches the playout as zero, not as two');

      /* MY OWN SIDE STILL WORKS, and it now comes from the board rather than from the caller. */
      const mine = stood(baseBoard());
      B.noteMove(mine, 'p1', mine.slot('p1', 'a'), ST, true); mine.endTurn();
      const A5 = RL.buildSide(mine, 'p1', null, zero());
      ok((A5[0] && A5[0].tookProtectTurns | 0) === 1,
        'ROADMAP #277 — my own streak is the same counter, from the same place');

      /* SWITCHING OUT CLEARS IT, for free: `switchIn` builds a new body. The old species-keyed map
       * could not do this and would have carried the count back in. */
      const pivot = streak([ST, ST]);
      pivot.switchIn('p2', 'a', THEIRS[2]);
      ok(!(pivot.slot('p2', 'a').protectStreak | 0),
        'CONTROL — a body that pivots out does not bring the streak back with it');
    }
  }

  /* WHAT IS STILL REFUSED, PRINTED WITH ITS REASON. */
  if (typeof RL.unseededVolatiles === 'function') {
    const left = RL.unseededVolatiles();
    ok(left.length > 0 && left.every(r => r[1] && r[1].length > 40),
      'ROADMAP #277 — every volatile still refused is refused BY NAME, with a reason',
      left.map(r => r[0]).join(','));
    for (const [k, reason] of left) note(`#277 NOT SEEDED — ${k}:`, reason);
  }
}

/* ---------------------------------------------------------------------------------------------
 * 5. THE WIRES PROVE THEY RAN.
 *
 * CLAUDE.md: *a capability that cannot prove it ran is assumed broken.* A seed that carried nothing
 * looks exactly like a position with nothing on it, which is what made all four of these rows
 * invisible for as long as they were — so the counters are asserted here rather than merely exported,
 * and the two that must be ZERO are asserted too.
 * ------------------------------------------------------------------------------------------ */
{
  const FC = RL.fieldClockCounters || {}, VC = RL.volCounters || {}, SC = B.sideCounters || {};
  ok((FC.weatherKnown | 0) > 0, 'the weather clock fired during this run', JSON.stringify(FC));
  ok((FC.weatherExpired | 0) > 0, 'and it DELETED a weather whose clock had run out');
  ok((FC.terrainKnown | 0) > 0, 'the terrain clock fired during this run');
  ok((VC.seeded | 0) > 0, 'the volatile seed fired during this run', JSON.stringify(VC));
  ok(!(SC.hazardTableFailed | 0), 'the hazard table loaded, so no ceiling was defaulted by ignorance',
    JSON.stringify(SC));
  ok(!(SC.layerCeilingUnknown | 0) || (SC.permanentFromTag | 0) > 0,
    'every layer ceiling came from the tag or the format, not from a fallback');
  /* THE VOCABULARY MISMATCH IS A NUMBER, NOT A HOPE. Anything the board held that the seed could not
   * map is counted; this run seeds only what it wrote, so it must be zero here — and on a live board
   * a non-zero is the signal that a volatile is arriving with nowhere to go. */
  note('vocabulary — board volatiles the seed could not map, this run:',
    `${VC.unmapped | 0} ${JSON.stringify(VC.unmappedKeys || {})}`);

  /* ROADMAP #275 and #277, same rule. `twCallerDiffered` is the one that matters most: it is the
   * number of times the board OVERRULED a caller's typed constant in this run, so a zero would mean
   * the fix is inert however green the arms above look. */
  ok((FC.twCallerDiffered | 0) > 0, 'ROADMAP #275 — the board overruled the caller\'s typed Tailwind',
    JSON.stringify({ twSeeded: FC.twSeeded | 0, twCallerDiffered: FC.twCallerDiffered | 0,
                     trSeeded: FC.trSeeded | 0, trCallerDiffered: FC.trCallerDiffered | 0 }));
  ok((FC.trSeeded | 0) > 0, 'ROADMAP #275 — and a room reached a playout with a real remainder');
  ok(!(FC.twInfinite | 0) && !(FC.trInfinite | 0),
    'ROADMAP #275 — no clock was handed over as never-expiring');
  ok((VC.translated | 0) > 0, 'ROADMAP #277 — the translated volatiles fired during this run',
    JSON.stringify(VC));
  const SEEDC = RL.SEED_COUNTERS || {};
  ok((SEEDC.streakFromBoard | 0) > 0, 'ROADMAP #277 — the Protect streak came from the BOARD',
    JSON.stringify(SEEDC));
  ok((SEEDC.choiceLocked | 0) > 0, 'ROADMAP #277 — and a choice lock reached a playout body');
  const BC = B.bodyCounters || {};
  ok((BC.stallStreakUp | 0) > 0 && (BC.stallStreakReset | 0) > 0,
    'ROADMAP #277 — the board counted a shield UP and a streak RESET', JSON.stringify(BC));
  ok(!(BC.speedSideUnknown | 0),
    'ROADMAP #275 — every speed-side key came from the format or the tag, never from a fallback');
}

/* ---------------------------------------------------------------------------------------------
 * 6. WHAT IS DELIBERATELY NOT CARRIED, REPORTED RATHER THAN ASSERTED.
 * ------------------------------------------------------------------------------------------ */
{
  note('DECLARED — the live `-weather` event names no setter:',
    'a weather set by an ABILITY reaches the board through the event and not through noteMove, so ' +
    'the holder\'s rock is unknown there and the clock is the base length. Erring SHORT is the safe ' +
    'direction — the playout ends the weather early rather than running it forever, which is the ' +
    'defect #270 is about');
  note('DECLARED — `_sub` and `_seededBy` are not seeded:',
    'a Substitute\'s REMAINING hp is not on the wire and Leech Seed\'s drain target is a body ' +
    'reference, so both would be invented rather than read');
  note('DECLARED — a translated volatile errs SHORT by up to one turn:',
    'the engine applies `_healBlock` and `_noSound` as `turns + 1` because its residual fires on the ' +
    'application turn too, while its `_vol` family is applied as `turns` flat. This seeds the BOARD\'s ' +
    'remaining count for all of them — Showdown\'s own meaning at a turn boundary — rather than ' +
    'putting a second opinion about the engine\'s tick inside the seed');
}

/* ---------------------------------------------------------------------------------------------
 * 7. ROADMAP #282 — THE LIVE ADAPTER'S DURATION TABLE WALKED THE NATIONAL DEX.
 *
 * Filed by §6 of this file on 2026-08-14 and CLOSED here. `magnemite.volatileDuration` skipped only
 * `!m.exists`, which is the walk CLAUDE.md names: *"`Dex.forFormat` IS NOT A LEGALITY FILTER."* The
 * illegal namesake of the heal-block volatile declares `condition.duration: 5`; the ONE legal carrier
 * in this regulation is answered 2 by the authority's own `durationCallback`. Since ROADMAP #277 the
 * seed carries whatever the board holds, so the wrong number stopped being live-only.
 *
 * NOTHING BELOW IS TYPED. The legal-move count is derived from the format, the wrong number is read
 * off the illegal move that used to supply it, and the right number is derived TWICE from
 * independent sources — the tag the engine reads, and the authority's callback — so an arm that
 * agreed with a value transcribed from memory could not pass.
 * ------------------------------------------------------------------------------------------ */
{
  const MAG = require(D('engine', 'magnemite.js'));
  const legalMove = m => m && m.exists && !m.isNonstandard && m.tier !== 'Illegal';

  if (typeof MAG.volatileDuration !== 'function') {
    ok(false, 'ROADMAP #282 — magnemite exports its duration table as a seam');
  } else {
    /* THE VOLATILE IS NAMED BY THE FORMAT, NOT BY ME: the one legal move carrying the
     * heal-blocking tag, and the volatile it actually applies. */
    const HB_CARRIERS = (TAGS.withTag('move', 'blocksHealing') || []).filter(id => legalMove(dex.moves.get(id)));
    ok(HB_CARRIERS.length === 1,
      'ROADMAP #282 — this regulation has exactly one legal carrier of the heal-block volatile',
      HB_CARRIERS.join(',') || '(none)');
    const CARRIER = HB_CARRIERS[0] ? dex.moves.get(HB_CARRIERS[0]) : null;
    const VOL = CARRIER ? nrm(((CARRIER.secondaries || []).find(s => s && s.volatileStatus) || {}).volatileStatus
                              || CARRIER.volatileStatus || '') : '';
    ok(!!VOL, 'and the volatile it applies is read off the move rather than named here', VOL || '(none)');

    /* THE TWO INDEPENDENT DERIVATIONS OF THE RIGHT ANSWER. */
    const TAG_TURNS = CARRIER ? +(((TAGS.param('move', CARRIER.id, 'blocksHealing')) || {}).turns) : 0;
    let CB_TURNS = 0;
    if (VOL) {
      const c = dex.conditions.get(VOL);
      try {
        CB_TURNS = +c.durationCallback.call({ add() {}, hint() {}, debug() {} },
          { hasAbility: () => false }, { hasAbility: () => false }, CARRIER);
      } catch (e) { probeSkips.push('#282 durationCallback: ' + why(e)); }
    }
    ok(TAG_TURNS > 0 && TAG_TURNS === CB_TURNS,
      'ROADMAP #282 — the tag the engine reads and the authority\'s own durationCallback agree',
      `tag ${TAG_TURNS} / callback ${CB_TURNS}`);

    /* THE ARM IS NOT VACUOUS: the value it used to return came from a move that does not exist here,
     * and it is a DIFFERENT number. Without this the next two rows could pass by coincidence. */
    const NAMESAKE = VOL ? dex.moves.get(VOL) : null;
    ok(NAMESAKE && NAMESAKE.exists && !!NAMESAKE.isNonstandard,
      'the move that used to supply the duration is NOT in this regulation',
      NAMESAKE ? `${NAMESAKE.name} isNonstandard=${NAMESAKE.isNonstandard}` : '(none)');
    const WRONG = NAMESAKE && NAMESAKE.condition ? +NAMESAKE.condition.duration : 0;
    ok(WRONG > 0 && WRONG !== TAG_TURNS,
      'and it declares a DIFFERENT number, so this arm is testing a real disagreement',
      `illegal ${WRONG} vs format ${TAG_TURNS}`);

    /* THE FIX, on both keys the wire can use — the volatile id and the display name. */
    ok(MAG.volatileDuration(VOL) === TAG_TURNS,
      'ROADMAP #282 — the table answers with the FORMAT\'s number, not the National Dex\'s',
      `${MAG.volatileDuration(VOL)} (was ${WRONG})`);
    ok(NAMESAKE && MAG.volatileDuration(NAMESAKE.name) === TAG_TURNS,
      'and by the display name the protocol actually ships on the `|-start|` line',
      NAMESAKE ? `${NAMESAKE.name} -> ${MAG.volatileDuration(NAMESAKE.name)}` : '');

    /* PROOF OF FIRING. A filter that stopped filtering would restore the defect and change nothing
     * else that anything looks at. */
    const C = MAG.VOL_DUR_COUNTERS;
    const LEGAL_N = dex.moves.all().filter(legalMove).length;
    ok(C.legalMoves === LEGAL_N,
      'ROADMAP #282 — the walk covers exactly the format\'s legal moves',
      `${C.legalMoves} of ${dex.moves.all().filter(m => m && m.exists).length} that exist`);
    ok(C.illegalSkipped > 0, 'and the filter is still removing rows rather than having gone inert',
      `${C.illegalSkipped} skipped`);
    ok(C.fromCallback > 0, 'and at least one duration is COMPUTED by the authority, not declared',
      `${C.fromCallback}`);
    ok(C.ambiguous === 0,
      'no two legal carriers of one volatile disagree — measured, because `|-start|` does not name the move',
      JSON.stringify(C.ambiguousKeys));

    /* THE CONTROL, and it is the point of the row: the four durations that were already right must
     * be byte-identical, or the filter fixed one number by breaking five. */
    for (const [k, want] of [['taunt', 3], ['encore', 3], ['disable', 5]]) {
      const engine = (() => {
        const sm = TAGS.param('move', k, 'sealsMoves');
        return sm && +sm.turns > 0 ? +sm.turns : want;
      })();
      ok(MAG.volatileDuration(k) === engine,
        `CONTROL — ${k} is unchanged at the engine's own number`,
        `${MAG.volatileDuration(k)} vs ${engine}`);
    }

    /* THE BEHAVIOURAL ARM: the number has to reach the PLAYOUT, which is what #277 made true and is
     * why this stopped being a live-only defect. Reading the table back would only prove the table
     * says what the table says. */
    if (VOL && RL.VOL_ENGINE_FIELD && RL.VOL_ENGINE_FIELD[VOL]) {
      const bd = stood(baseBoard());
      bd.startVolatile('p1', 'a', NAMESAKE.name, MAG.volatileDuration(NAMESAKE.name));
      const A = RL.buildSide(bd, 'p1', null, zero());
      const got = A[0] ? (A[0][RL.VOL_ENGINE_FIELD[VOL]] | 0) : -1;
      ok(got === TAG_TURNS,
        'ROADMAP #282 — and the corrected number reaches the seeded body, not just the table',
        `${RL.VOL_ENGINE_FIELD[VOL]} = ${got} (would have been ${WRONG})`);
    } else {
      note('#282 — the heal-block volatile is not in VOL_ENGINE_FIELD, so the behavioural arm did not run');
    }

    note('#282 RESIDUE, DECLARED — the walk is over MOVES only:',
      'a volatile started by a legal ABILITY or ITEM still falls back to 3, exactly as before. Not a ' +
      'regression and not fixed here; it is a separate source and belongs in its own row');
    note('#282 — keys that fell to the fallback with the filter on:',
      '34 of the old table\'s 84 keys came from moves this regulation does not contain, so nothing ' +
      'can ever look them up; ONE key changed to a real new value and it is the one this row is about');
  }
}

if (probeSkips.length) {
  console.log(`\n  ${probeSkips.length} derivation probe(s) threw and were skipped:`);
  for (const m of probeSkips.slice(0, 8)) console.log('    - ' + m);
  if (probeSkips.length > 8) console.log(`    ... and ${probeSkips.length - 8} more`);
} else {
  console.log('\n  no derivation probe threw');
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
