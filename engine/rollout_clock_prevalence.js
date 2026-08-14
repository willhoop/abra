/* rollout_clock_prevalence.js — HOW OFTEN IS THE POSITION RUNNING A CLOCK THE SEED HANDED OVER AS ZERO?
 *
 *   node engine/rollout_clock_prevalence.js  [--store data/games.bo3.jsonl]
 *
 * ROADMAP #267, #268, #269, #270 — one surface and one artifact, because they are one question asked
 * four times: the real position is running a counter and the seed said nothing about it.
 *
 *   #270  a weather / terrain with turns left        the seed set no `weatherT`, and ZERO MEANS
 *                                                    NEVER EXPIRES, so a sun with two turns left ran
 *                                                    for the whole playout
 *   #268  a hazard, and how many layers deep         `startSide` gave a permanent hazard ONE turn
 *                                                    offline and five live, and counted no layers
 *   #269  Taunt / Encore / Disable with turns left   the live board holds all three with a duration
 *                                                    and the seed dropped them
 *   #267  a body some turns into slp / tox / frz     the board recorded the NAME and no counter
 *
 * WHAT IT COUNTS. A DECISION POINT is one (game, turn, side) read at the START of the turn — the
 * moment MAG scores its candidates and MILTANK would seed a rollout from that side's board. It is the
 * SAME denominator `data/rollout-fallen-prevalence.json`, `data/rollout-seed-prevalence.json` and
 * `data/rollout-item-prevalence.json` use, deliberately, so these numbers sit beside #244's 8.75%,
 * the seed batch's 70.55% and #271's 3.62% rather than being a fifth island.
 *
 * THIS IS NOT DOWNSTREAM OF MEDICHAM AND IS NOT QUARANTINED. It reads the STORE and the TAG artifact
 * and plays no game — no `battleInit`, no rollout, no board, no `Dex`. It needs no engine release, and
 * an agent rewriting the simulator underneath it cannot move a figure in it. That is why it is the
 * measurement that can honestly be taken while other divisions are in the tree.
 *
 * NOTHING IS NAMED. The hazards and their layer ceilings come from the `hazard` tag; hazard REMOVAL
 * from `removesHazards`, whose own `hazardsFrom` param says whose side is cleared; the weathers from
 * `setsWeather`; a weather's LENGTH from the rocks' own `extendsDuration` params (`insteadOf` 5,
 * `toTurns` 8), which is the only place in this repository those two numbers are data; and the
 * duration-volatiles from the `sealsMoves` + `statusInflict` join the engine itself uses.
 *
 * *** THE FLOORS AND THE CEILINGS, EACH STATED WITH ITS DIRECTION. ***
 *
 * FLOOR — #269 is the worst of them. The store records NO volatile at all: there is no `|-start|` in
 * a stored game, so a Taunt is countable only from the CLICK that caused it. An Encore or a Disable
 * from any other source, and every volatile an item or an ability starts, is invisible here. The live
 * board sees all of them, so the live rate is strictly higher and by an unknown amount.
 *
 * FLOOR — #270's terrain half. A terrain's duration is not in the tag artifact and reading it would
 * mean opening a `Dex`, which is exactly what keeps this scan honest. So the terrain figure is the
 * share of decision points AFTER a terrain was set — a CEILING on the terrain half, printed as one
 * and kept out of the headline. The WEATHER half is exact.
 *
 * CEILING — #268's removal. Rapid Spin, Mortal Spin, Defog and Tidy Up are counted from their tag; a
 * grounded Poison type ABSORBING Toxic Spikes on entry is not, because it needs the body's types and
 * therefore a Dex. So hazards are held up marginally longer here than in the real game.
 *
 * CEILING — #267's cures. The store records a status LANDING (`x`) and never a cure: a Heal Bell, a
 * Lum Berry, a Natural Cure pivot and a thaw are all invisible. A body is therefore counted as still
 * carrying a status it may have shaken off.
 *
 * AND EVERY FIGURE IS A CEILING ON DECISIONS, in the way all four of these artifacts are and which is
 * stated every time: it counts positions the seed described wrongly, not argmaxes that flip.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const D = (...p) => path.join(__dirname, '..', ...p);
const TAGS = require('./tags.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* Identical to the helper in the three sibling scans, deliberately: they are read side by side. */
const base = s => { const n = norm(s); return n.replace(/(mega[xy]?|gmax|tera|primal)$/, '') || n; };
const STORE = arg('store', D('data', 'games.bo3.jsonl'));

/* ---- the populations, DERIVED ---------------------------------------------------------------- */
/* THE HAZARDS AND THEIR CEILINGS. The `hazard` param's own `hazard` field is the side-condition key —
 * the same field `rollout_leaf.applySideState` and `board.hazardSideTable` key on. */
const HAZARD = new Map();               // move id -> { key, maxLayers }
for (const mv of (TAGS.withTag('move', 'hazard') || [])) {
  const p = TAGS.param('move', mv, 'hazard') || {};
  HAZARD.set(norm(mv), { key: norm(p.hazard || mv), maxLayers: Math.max(1, +p.maxLayers || 1) });
}
/* WHO GETS CLEARED IS THE TAG'S OWN ANSWER (`hazardsFrom`: `self` for Rapid Spin and Mortal Spin,
 * `both` for Defog and Tidy Up), so this file does not decide it and cannot get it wrong. */
const CLEARS = new Map();               // move id -> { from, keys[] }
for (const mv of (TAGS.withTag('move', 'removesHazards') || [])) {
  const p = TAGS.param('move', mv, 'removesHazards') || {};
  CLEARS.set(norm(mv), { from: norm(p.hazardsFrom || 'self'), keys: (p.hazards || []).map(norm) });
}
/* THE WEATHERS, AND THE ONLY PLACE THEIR LENGTHS ARE DATA. `extendsDuration` carries both numbers:
 * `insteadOf` is what the weather lasts bare and `toTurns` is what it lasts with that rock. */
const WEATHER_LEN = new Map();          // weather key -> { base, extended, rock }
for (const it of (TAGS.withTag('item', 'extendsDuration') || [])) {
  const p = TAGS.param('item', it, 'extendsDuration') || {};
  for (const w of (p.extends || [])) {
    const k = norm(w);
    /* Screens are extended by Light Clay through the same tag and are NOT weathers; they are kept out
     * by the `setsWeather` join below rather than by a name. */
    WEATHER_LEN.set(k, { base: +p.insteadOf || 5, extended: +p.toTurns || 8, rock: norm(it) });
  }
}
const IS_WEATHER = new Set((TAGS.withTag('move', 'setsWeather') || [])
  .map(mv => norm((TAGS.param('move', mv, 'setsWeather') || {}).weather || mv)));
/* Snow/hail and the rest arrive on the wire under the move's own word, so the join is on the key the
 * store writes; anything the store names that is not in the weather set is counted and reported. */

/* THE DURATION-VOLATILES, by the engine's own join (`durationVolatiles()` in medicham2-browser.js). */
const VOL = new Map();                  // move id -> { key, turns }
for (const mv of (TAGS.withTag('move', 'sealsMoves') || [])) {
  const sm = TAGS.param('move', mv, 'sealsMoves');
  const si = TAGS.param('move', mv, 'statusInflict');
  if (!sm || !(+sm.turns > 0) || !si || !Array.isArray(si.effects)) continue;
  for (const e of si.effects) if (e.volatile) VOL.set(norm(mv), { key: norm(e.volatile), turns: +sm.turns });
}
/* THE STATUSES THAT CARRY A COUNTER, which is the engine's split and not a preference: `par` and
 * `brn` do not change with time, so a body three turns into either is a body with a burn. */
const COUNTED_STATUS = new Set(['slp', 'tox', 'frz']);

(async () => {
  const t0 = Date.now();
  const out = {
    generated: new Date().toISOString(),
    what: 'ROADMAP #267/#268/#269/#270 — how often the position is running a clock the seed dropped',
    store: path.relative(D(), STORE).replace(/\\/g, '/'),
    floors: {
      volatiles: 'FLOOR. The store records no |-start| at all, so a Taunt/Encore/Disable is countable ' +
        'only from the CLICK that caused it. Any other source — an item, an ability, a move whose ' +
        'secondary applies one — is invisible. The live board sees all of them.',
      terrain: 'CEILING, and kept out of the headline. A terrain\'s duration is not in the tag ' +
        'artifact and reading it would mean opening a Dex, which is what keeps this scan honest. ' +
        'The figure is the share of decision points AFTER a terrain was set, never expired.',
      hazardRemoval: 'CEILING. Rapid Spin / Mortal Spin / Defog / Tidy Up are counted from the ' +
        '`removesHazards` tag; a grounded Poison type ABSORBING Toxic Spikes on entry is not, ' +
        'because it needs the body\'s types and therefore a Dex.',
      statusCures: 'CEILING. The store records a status LANDING and never a cure, so a Heal Bell, a ' +
        'Lum Berry, a Natural Cure pivot and a thaw all leave the body counted as still statused.',
      decisions: 'AND ALL OF IT IS A CEILING ON DECISIONS: it counts positions the seed described ' +
        'wrongly, not argmaxes that flip.',
    },
    derived_populations: {
      hazards: [...HAZARD.entries()].map(([mv, v]) => `${mv}->${v.key} x${v.maxLayers}`).sort(),
      hazardRemovers: [...CLEARS.entries()].map(([mv, v]) => `${mv}(${v.from})`).sort(),
      weathers: [...IS_WEATHER].sort(),
      weatherLengths: [...WEATHER_LEN.entries()].map(([k, v]) => `${k}:${v.base}/${v.extended} (${v.rock})`).sort(),
      durationVolatiles: [...VOL.entries()].map(([mv, v]) => `${mv}->${v.key}:${v.turns}`).sort(),
      countedStatuses: [...COUNTED_STATUS],
    },
    games: 0, gamesSkipped: 0, decisionPoints: 0,
    clicks: { hazard: 0, hazardRemove: 0, volatile: 0, weatherEvents: 0, fieldEvents: 0, statusEvents: 0 },
    unknownWeatherKeys: {},
    dp: {
      weatherUp: 0, weatherWithRock: 0, terrainEverSet: 0,
      hazardUp: 0, hazardOlderThan1: 0, hazardOlderThan5: 0, hazardMultiLayer: 0,
      volatileUp: 0,
      statusClock: 0, statusClockActive: 0,
      any: 0,
    },
    detail: { weatherTurnsLeftSum: 0, weatherUpPoints: 0, hazardLayerSum: 0, hazardPoints: 0 },
    games_with: { weather: 0, hazard: 0, volatile: 0, countedStatus: 0 },
    node: process.version,
  };

  const rl = readline.createInterface({ input: fs.createReadStream(STORE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let g = null;
    try { g = JSON.parse(line); } catch (e) { out.gamesSkipped++; continue; }
    if (!g || !Array.isArray(g.turns)) { out.gamesSkipped++; continue; }
    out.games++;

    /* WHAT EACH BODY DECLARED — needed for one thing only: the rock the weather's SETTER was holding,
     * which is what makes a five-turn weather an eight-turn one. */
    const declared = { p1: {}, p2: {} };
    for (const s of ['p1', 'p2']) {
      for (const e of (g.sheets && g.sheets[s]) || []) declared[s][base(e.species)] = norm(e.item);
      for (const [sp, e] of Object.entries(g.sets || {})) {
        if (declared[s][base(sp)] === undefined) declared[s][base(sp)] = norm(e && e.item);
      }
    }

    const st = { p1: { field: {}, dead: new Set() }, p2: { field: {}, dead: new Set() } };
    for (const s of ['p1', 'p2']) {
      const lead = ((g.lead || {})[s] || []).map(base);
      ['a', 'b'].forEach((L, i) => { if (lead[i]) st[s].field[L] = lead[i]; });
    }
    const hz = { p1: new Map(), p2: new Map() };      // key -> { layers, laid }
    const vol = { p1: new Map(), p2: new Map() };     // species -> Map(key -> until)
    const sclock = { p1: {}, p2: {} };                // species -> { status, turns }
    let weather = null;                               // { key, until, rock }
    let terrainSet = false;
    const had = { weather: false, hazard: false, volatile: false, status: false };

    for (let ti = 0; ti < g.turns.length; ti++) {
      const turn = g.turns[ti];
      const T = ti;                                   // turns are 0-based here, as on the Board

      /* ---- THE DECISION POINT, read before the turn's events -------------------------------- */
      const wUp = !!(weather && weather.until > T);
      const wLeft = wUp ? weather.until - T : 0;
      let hzUp = false, hzOld1 = false, hzOld5 = false, hzDeep = false;
      for (const s of ['p1', 'p2']) {
        for (const [, v] of hz[s]) {
          hzUp = true;
          if (T - v.laid >= 1) hzOld1 = true;
          if (T - v.laid >= 5) hzOld5 = true;
          if (v.layers > 1) hzDeep = true;
          out.detail.hazardLayerSum += v.layers;
          out.detail.hazardPoints++;
        }
      }
      let volUp = false;
      for (const s of ['p1', 'p2']) for (const [, m] of vol[s]) for (const [, until] of m) if (until > T) volUp = true;
      let stAny = false, stActive = false;
      for (const s of ['p1', 'p2']) {
        const onField = new Set(Object.values(st[s].field));
        for (const [sp, e] of Object.entries(sclock[s])) {
          if (!COUNTED_STATUS.has(e.status) || !(e.turns > 0)) continue;
          if (st[s].dead.has(sp)) continue;
          stAny = true;
          if (onField.has(sp)) stActive = true;
        }
      }

      for (let k = 0; k < 2; k++) {          /* two decision points per turn, one per side */
        out.decisionPoints++;
        if (wUp) { out.dp.weatherUp++; out.detail.weatherTurnsLeftSum += wLeft; out.detail.weatherUpPoints++; if (weather.rock) out.dp.weatherWithRock++; }
        if (terrainSet) out.dp.terrainEverSet++;
        if (hzUp) out.dp.hazardUp++;
        if (hzOld1) out.dp.hazardOlderThan1++;
        if (hzOld5) out.dp.hazardOlderThan5++;
        if (hzDeep) out.dp.hazardMultiLayer++;
        if (volUp) out.dp.volatileUp++;
        if (stAny) out.dp.statusClock++;
        if (stActive) out.dp.statusClockActive++;
        if (wUp || hzUp || volUp || stAny) out.dp.any++;
      }
      if (wUp) had.weather = true;
      if (hzUp) had.hazard = true;
      if (volUp) had.volatile = true;
      if (stAny) had.status = true;

      /* ---- then play the turn's events forward ---------------------------------------------- */
      for (const e of (turn.ev || [])) {
        if (!e) continue;
        const side = typeof e.s === 'string' ? e.s.slice(0, 2) : null;
        const L = typeof e.s === 'string' ? e.s.slice(2, 3) : null;
        const foe = side === 'p1' ? 'p2' : 'p1';

        if (e.t === 's' && side) { st[side].field[L] = base(e.mon); vol[side].delete(base(e.mon)); continue; }
        if (e.t === 'f' && side) { st[side].dead.add(base(e.mon || st[side].field[L])); delete st[side].field[L]; continue; }
        if (e.t === 'x' && side) {
          out.clicks.statusEvents++;
          const sp = base(e.mon || st[side].field[L]);
          /* The clock starts at 0 and is booked at the END of the turn, exactly as `board.endTurn`
           * books it — see the note there for why the two must agree. */
          if (sp) sclock[side][sp] = { status: norm(e.st), turns: 0 };
          continue;
        }
        if (e.t === 'w') {
          out.clicks.weatherEvents++;
          const key = norm(e.field);
          if (!key) continue;
          if (!IS_WEATHER.has(key) && !WEATHER_LEN.has(key)) {
            out.unknownWeatherKeys[key] = (out.unknownWeatherKeys[key] | 0) + 1;
          }
          const len = WEATHER_LEN.get(key);
          const setterItem = side && e.mon ? declared[side][base(e.mon)] : '';
          const rock = !!(len && setterItem && setterItem === len.rock);
          const turns = len ? (rock ? len.extended : len.base) : 5;
          weather = { key, until: T + turns, rock };
          continue;
        }
        if (e.t === 'fs') { out.clicks.fieldEvents++; terrainSet = true; continue; }
        if (e.t !== 'm' || !side) continue;

        const mv = norm(e.mv);
        /* A HAZARD LANDS ON THE SIDE IT WAS LAID AGAINST — all four are `foeSide`, which is ROADMAP
         * #254's fact and is taken from the tag rather than re-derived: the `hazard` tag exists only
         * on the four, and every one of them targets the opponent. */
        const h = HAZARD.get(mv);
        if (h) {
          out.clicks.hazard++;
          const cur = hz[foe].get(h.key);
          hz[foe].set(h.key, { layers: Math.min(h.maxLayers, cur ? cur.layers + 1 : 1), laid: cur ? cur.laid : T });
          continue;
        }
        const c = CLEARS.get(mv);
        if (c) {
          out.clicks.hazardRemove++;
          for (const s of (c.from === 'both' ? ['p1', 'p2'] : [side])) {
            for (const k of c.keys) hz[s].delete(k);
          }
          continue;
        }
        const v = VOL.get(mv);
        if (v && e.tgt) {
          out.clicks.volatile++;
          const tgt = base(e.tgt);
          /* The store names a TARGET by species, so a mirror cannot say which copy was hit — the same
           * ambiguity the item scan flags. Marked on the FOE's side, which is where all three land. */
          if (!vol[foe].has(tgt)) vol[foe].set(tgt, new Map());
          vol[foe].get(tgt).set(v.key, T + v.turns);
        }
      }

      /* ---- the end of the turn: the status clock books one turn for every ACTIVE statused body,
       * which is the rule `board.endTurn` uses and `medicham2` implements (the counter moves when the
       * body ACTS, so a benched sleeper keeps its count and does not deepen). ------------------- */
      for (const s of ['p1', 'p2']) {
        const onField = new Set(Object.values(st[s].field));
        for (const sp of onField) {
          const e2 = sclock[s][sp];
          if (e2 && e2.status) e2.turns++;
        }
      }
    }
    for (const k of ['weather', 'hazard', 'volatile']) if (had[k]) out.games_with[k]++;
    if (had.status) out.games_with.countedStatus++;
  }

  const pct = (a, b) => b ? +(100 * a / b).toFixed(3) : null;
  const N = out.decisionPoints;
  out.rates = {
    /* #270 */
    pct_dp_a_weather_is_up: pct(out.dp.weatherUp, N),
    pct_dp_that_weather_was_rock_extended: pct(out.dp.weatherWithRock, N),
    mean_weather_turns_left_when_up: out.detail.weatherUpPoints
      ? +(out.detail.weatherTurnsLeftSum / out.detail.weatherUpPoints).toFixed(3) : null,
    pct_dp_after_a_terrain_was_set_CEILING: pct(out.dp.terrainEverSet, N),
    /* #268 */
    pct_dp_a_hazard_is_up: pct(out.dp.hazardUp, N),
    pct_dp_a_hazard_older_than_1_turn: pct(out.dp.hazardOlderThan1, N),
    pct_dp_a_hazard_older_than_5_turns: pct(out.dp.hazardOlderThan5, N),
    pct_dp_a_hazard_is_more_than_one_layer: pct(out.dp.hazardMultiLayer, N),
    /* #269 */
    pct_dp_a_duration_volatile_is_up_FLOOR: pct(out.dp.volatileUp, N),
    /* #267 */
    pct_dp_a_body_is_some_turns_into_slp_tox_frz: pct(out.dp.statusClock, N),
    pct_dp_that_body_is_on_the_field: pct(out.dp.statusClockActive, N),
    /* the union */
    pct_any: pct(out.dp.any, N),
    pct_games_with_a_weather: pct(out.games_with.weather, out.games),
    pct_games_with_a_hazard: pct(out.games_with.hazard, out.games),
    pct_games_with_a_duration_volatile_FLOOR: pct(out.games_with.volatile, out.games),
    pct_games_with_a_counted_status: pct(out.games_with.countedStatus, out.games),
  };
  out.elapsedMs = Date.now() - t0;
  const dst = D('data', 'rollout-clock-prevalence.json');
  fs.writeFileSync(dst, JSON.stringify(out, null, 2));

  const R = out.rates;
  console.log(`\nROADMAP #267/#268/#269/#270 prevalence — ${out.store}`);
  console.log(`  ${out.games} games, ${N} decision points, ${out.gamesSkipped} skipped`);
  console.log(`  #270  a WEATHER is up                                    : ${R.pct_dp_a_weather_is_up}%  (mean ${R.mean_weather_turns_left_when_up} turns left)`);
  console.log(`  #270  ...and it was rock-extended                        : ${R.pct_dp_that_weather_was_rock_extended}%`);
  console.log(`  #270  after a TERRAIN was set (CEILING)                  : ${R.pct_dp_after_a_terrain_was_set_CEILING}%`);
  console.log(`  #268  a HAZARD is up                                     : ${R.pct_dp_a_hazard_is_up}%`);
  console.log(`  #268  ...laid more than 1 turn ago (the OFFLINE blind spot): ${R.pct_dp_a_hazard_older_than_1_turn}%`);
  console.log(`  #268  ...laid more than 5 turns ago (the LIVE blind spot)  : ${R.pct_dp_a_hazard_older_than_5_turns}%`);
  console.log(`  #268  ...more than ONE layer deep                        : ${R.pct_dp_a_hazard_is_more_than_one_layer}%`);
  console.log(`  #269  a duration VOLATILE is up (FLOOR)                  : ${R.pct_dp_a_duration_volatile_is_up_FLOOR}%`);
  console.log(`  #267  a body is some turns into slp/tox/frz              : ${R.pct_dp_a_body_is_some_turns_into_slp_tox_frz}%`);
  console.log(`  #267  ...and that body is on the field                   : ${R.pct_dp_that_body_is_on_the_field}%`);
  console.log(`  ANY of them — the CEILING on this batch's reach          : ${R.pct_any}%`);
  console.log(`  clicks: hazard ${out.clicks.hazard}, hazard-removal ${out.clicks.hazardRemove}, volatile ${out.clicks.volatile}, weather events ${out.clicks.weatherEvents}, status events ${out.clicks.statusEvents}`);
  if (Object.keys(out.unknownWeatherKeys).length) {
    console.log(`  UNRECOGNISED weather keys on the wire: ${JSON.stringify(out.unknownWeatherKeys)}`);
  }
  console.log(`  wrote ${path.relative(D(), dst).replace(/\\/g, '/')} in ${out.elapsedMs} ms\n`);
})();
