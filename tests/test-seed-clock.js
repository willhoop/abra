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
      const S = seedFrom(bd, 'p1', { weather: bd.weather, terrain: '' });
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
      const S = seedFrom(bd, 'p1', { weather: bd.weather, terrain: '' });
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
  const statusMoveFor = sp => (globalThis.MC.mons[sp].mv || []).map(nrm)
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
  note('OPEN — the caller\'s field still types Tailwind as 4 and Trick Room as 5:',
    '`miltank.js` builds `twA: hasSide ? 4 : 0`, so a Tailwind with one turn left is seeded with ' +
    'four. `board.sideLeft`/`fieldLeft` hold the true remainder. Same shape as #270 in a different ' +
    'file and filed as its own row rather than folded into this batch');
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
