/* rollout_seed_prevalence.js — HOW OFTEN CAN THE SEED BATCH CHANGE A DECISION?
 *
 *   node engine/rollout_seed_prevalence.js  [--store data/games.bo3.jsonl]
 *
 * ROADMAP #247, #248, #249, #250 — the four approximations left on the rollout seed after #244 and
 * #246 closed the fallen count. They are correct to fix whether or not they move anything, and
 * "correct and inert" and "correct and load-bearing" are different claims that this project has
 * published as one before. So the size is MEASURED, exactly as `rollout_fallen_prevalence.js`
 * measured #244's.
 *
 * WHAT IT COUNTS. A DECISION POINT is one (game, turn, side) read at the START of the turn — the
 * moment MILTANK would seed a rollout from that side's board. It is the SAME denominator
 * `data/rollout-fallen-prevalence.json` uses, deliberately, so the five numbers are comparable to
 * #244's 8.75% rather than each being an island.
 *
 * The five conditions, each the state the seed used to invent:
 *
 *   #248 moves  the acting side has a live benched body whose DECLARED moveset differs from the
 *               dataset's representative four — i.e. the body the seed built was not the body the
 *               sheet describes.
 *   #248 state  it has a live benched body that has already been on the field AND is hurt or
 *               statused — i.e. the seed handed MEDICHAM a body that is whole and is not.
 *   #250        one of its ACTIVE bodies declares a `firstTurnOnly` move and has already taken a
 *               move action — i.e. the seed offered a Fake Out the game refuses.
 *   #249        a hazard, a screen or Gravity is up anywhere — i.e. the seed deleted it.
 *   #247        an active carrier of `boostsFromFallen` entered after at least one ally had died —
 *               i.e. the seed gave it a snapshot of zero.
 *
 * NOTHING IS NAMED. Every carrier, every hazard, every screen, every first-turn-only move and every
 * hazard-removal move is enumerated out of `data/tags.json` at run time, so a move added by a future
 * regulation is counted without editing this file.
 *
 * THIS IS NOT DOWNSTREAM OF MEDICHAM AND IS NOT QUARANTINED. It reads the STORE, the TAG artifact
 * and the dataset's own moveset rows, and plays no game — no `battleInit`, no rollout, no board. It
 * needs no engine release, and an ENGINE agent rewriting the simulator underneath it cannot move a
 * figure in it. That is why it is the measurement that can honestly be taken tonight.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM. Every figure is a CEILING on reach, not a count of decisions
 * whose argmax flips. A position can satisfy all five conditions and still rank its candidates in
 * the same order. Whether the argmax moves is a paired run against a frozen release and it is not
 * taken here.
 *
 * THREE APPROXIMATIONS IN THE COUNTING, STATED RATHER THAN BURIED:
 *   - The store carries no `-sidestart`, so a hazard is inferred from the setter move being clicked
 *     and cleared when a `removesHazards` move is clicked. A hazard laid on a turn where the setter
 *     was flinched or Protected is therefore counted as up when it is not; a Court Change is not
 *     modelled. Screens use the move's own dex duration through the tag, extended by Light Clay when
 *     the sheet declares it.
 *   - Statuses come from the store's `x` events and HP from `hp`/`tgthp`; healing that the store
 *     does not record makes the HP an under-estimate, which is the same limit `board.js` documents.
 *   - A firstTurnOnly move is counted from the SHEET, so a body that declares Fake Out and never
 *     clicks it still counts. That is the right denominator: the seed offered the move regardless.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));                    // globalThis.MC — the dataset's movesets
const TAGS = require('./tags.js');
const { mcKey } = require('./mc_key.js');                 // the ONE door into MC.mons — see that file

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* The forme a store event names is not always the sheet's key — `dragonitemega` acts, `dragonite`
 * is declared — so everything is keyed on the base, the same way `board.js` keys `sheet` and `pp`. */
const base = s => { const n = norm(s); return n.replace(/(mega[xy]?|gmax|tera|primal)$/, '') || n; };

const STORE = arg('store', D('data', 'games.bo3.jsonl'));

/* ---- the populations, DERIVED ---------------------------------------------------------------- */
const FIRST_TURN = new Set((TAGS.withTag('move', 'firstTurnOnly') || []).map(norm));
const FALLEN_ABIL = new Set((TAGS.withTag('ability', 'boostsFromFallen') || []).map(norm));
const HAZARDS = new Map();          // setter move id -> hazard key
for (const mv of (TAGS.withTag('move', 'hazard') || [])) {
  const p = TAGS.param('move', mv, 'hazard') || {};
  HAZARDS.set(norm(mv), norm(p.hazard || mv));
}
const REMOVERS = new Set((TAGS.withTag('move', 'removesHazards') || []).map(norm));
const SCREENS = new Map();          // screen move id -> base turns
for (const mv of (TAGS.withTag('move', 'halvesDamage') || [])) SCREENS.set(norm(mv), 5);
const GRAVITY = new Map();
for (const mv of (TAGS.withTag('move', 'groundsField') || [])) {
  const p = TAGS.param('move', mv, 'groundsField') || {};
  GRAVITY.set(norm(mv), +p.turns || 5);
}
/* Light Clay's extension is the item's own tag, never a number typed here. */
const CLAY = (() => {
  for (const it of (TAGS.withTag('item', 'extendsDuration') || [])) {
    const p = TAGS.param('item', it, 'extendsDuration') || {};
    if (p.toTurns && (p.extends || []).some(m => SCREENS.has(norm(m)))) return { item: norm(it), turns: +p.toTurns };
  }
  return null;
})();

/* THROUGH THE RESOLVER, FIXED 2026-08-23. This read `globalThis.MC.mons[base(sp)]`, and `base()`
 * ends in `norm()`, which strips the hyphen MC.mons keys every forme WITH. So `Rotom-Wash` asked for
 * `rotomwash`, got nothing, and returned an EMPTY dataset moveset — which the caller then compares
 * against the sheet's declared four and scores as "the moves differ". A miss could therefore only
 * push `movesDiffer` UP, and it was doing so for **47 of the 256 species names in the bo3 store,
 * 10,980 of 144,260 brought bodies (7.61%)** — Rotom-Wash, Ninetales-Alola, Arcanine-Hisui,
 * Floette-Eternal and 43 more. `data/rollout-seed-prevalence.json` (movesDiffer 105,430 of 190,378)
 * was generated under this and is OWED a re-run.
 *
 * `mcKey.row` is the accessor; the miss is DECLARED, because MC.mons genuinely does not cover the
 * whole format and "no row" is a real answer for a body the dataset has never seen. */
const NO_ROW = { mayMiss: 'MC.mons does not cover the whole format; a body with no row has no dataset four' };
const datasetMoves = sp => ((mcKey.row(base(sp), NO_ROW) || {}).mv || []).map(norm).sort();

(async () => {
  const t0 = Date.now();
  const out = {
    generated: new Date().toISOString(),
    what: 'ceiling on the reach of ROADMAP #247/#248/#249/#250 — the rollout seed batch',
    store: path.relative(D(), STORE).replace(/\\/g, '/'),
    derived_populations: {
      firstTurnOnly: [...FIRST_TURN], fallenAbility: [...FALLEN_ABIL],
      hazards: [...HAZARDS.keys()], hazardRemovers: [...REMOVERS],
      screens: [...SCREENS.keys()], gravity: [...GRAVITY.keys()],
      lightClay: CLAY,
    },
    games: 0, gamesSkipped: 0, decisionPoints: 0,
    dp: { movesDiffer: 0, benchHurt: 0, staleFirstTurn: 0, sideState: 0, entrySnapshot: 0, any: 0 },
    detail: { benchLive: 0, benchEverOut: 0, hazardUp: 0, screenUp: 0, gravityUp: 0,
              firstTurnCarrierActive: 0, fallenCarrierActive: 0 },
    node: process.version,
  };

  const rl = readline.createInterface({ input: fs.createReadStream(STORE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let g = null;
    try { g = JSON.parse(line); } catch (e) { out.gamesSkipped++; continue; }
    if (!g || !Array.isArray(g.turns)) { out.gamesSkipped++; continue; }
    out.games++;

    /* ---- the sheets, by base species ---------------------------------------------------------- */
    const sheet = { p1: {}, p2: {} };
    for (const s of ['p1', 'p2']) {
      for (const e of (g.sheets && g.sheets[s]) || []) sheet[s][base(e.species)] = e;
      for (const [sp, e] of Object.entries(g.sets || {})) if (!sheet[s][base(sp)]) sheet[s][base(sp)] = e;
    }
    const brought = { p1: ((g.brought || {}).p1 || []).map(base), p2: ((g.brought || {}).p2 || []).map(base) };

    /* ---- the live state this scan reconstructs ------------------------------------------------ */
    const st = {};
    for (const s of ['p1', 'p2']) {
      st[s] = { field: {}, everOut: new Set(), dead: new Set(), hp: {}, status: {},
                acts: {}, entered: {}, deaths: 0, hz: new Set(), sc: {} };
      const lead = ((g.lead || {})[s] || []).map(base);
      ['a', 'b'].forEach((L, i) => {
        if (!lead[i]) return;
        st[s].field[L] = lead[i]; st[s].everOut.add(lead[i]); st[s].entered[lead[i]] = 0;
      });
    }
    let gravityUntil = 0;

    for (let ti = 0; ti < g.turns.length; ti++) {
      const turn = g.turns[ti], tn = ti + 1;

      /* ---- THE DECISION POINT, read before the turn's events -------------------------------- */
      for (const me of ['p1', 'p2']) {
        const foe = me === 'p1' ? 'p2' : 'p1';
        const S = st[me];
        out.decisionPoints++;
        const onField = new Set(Object.values(S.field));
        const bench = brought[me].filter(sp => !onField.has(sp) && !S.dead.has(sp));
        if (bench.length) out.detail.benchLive++;

        /* #248 (a) — a benched body the seed would build on the dataset's moveset instead of its own */
        let movesDiffer = false, benchHurt = false, everOut = false;
        for (const sp of bench) {
          const sh = sheet[me][sp];
          const declared = ((sh && sh.moves) || []).map(norm).filter(m => globalThis.MC.moves[m]).sort();
          if (declared.length && declared.join(',') !== datasetMoves(sp).join(',')) movesDiffer = true;
          if (S.everOut.has(sp)) {
            everOut = true;
            if ((S.hp[sp] != null && S.hp[sp] < 100) || S.status[sp]) benchHurt = true;
          }
        }
        if (everOut) out.detail.benchEverOut++;

        /* #250 — an active body that declares a first-turn-only move and has already moved */
        let stale = false, ftCarrier = false;
        for (const sp of Object.values(S.field)) {
          const sh = sheet[me][sp];
          const has = ((sh && sh.moves) || []).map(norm).some(m => FIRST_TURN.has(m));
          if (!has) continue;
          ftCarrier = true;
          if ((S.acts[sp] | 0) > 0) stale = true;
        }
        if (ftCarrier) out.detail.firstTurnCarrierActive++;

        /* #249 — anything on either side's half of the board that the seed dropped */
        const scUp = s2 => Object.values(st[s2].sc).some(u => u > tn);
        const hazUp = st[me].hz.size > 0 || st[foe].hz.size > 0;
        const screenUp = scUp(me) || scUp(foe);
        const gravUp = gravityUntil > tn;
        if (hazUp) out.detail.hazardUp++;
        if (screenUp) out.detail.screenUp++;
        if (gravUp) out.detail.gravityUp++;

        /* #247 — an active fallen-count carrier that walked in over graves */
        let snapshot = false, fCarrier = false;
        for (const sp of Object.values(S.field)) {
          const sh = sheet[me][sp];
          if (!sh || !FALLEN_ABIL.has(norm(sh.ability))) continue;
          fCarrier = true;
          if ((S.entered[sp] | 0) > 0) snapshot = true;
        }
        if (fCarrier) out.detail.fallenCarrierActive++;

        const sideState = hazUp || screenUp || gravUp;
        if (movesDiffer) out.dp.movesDiffer++;
        if (benchHurt) out.dp.benchHurt++;
        if (stale) out.dp.staleFirstTurn++;
        if (sideState) out.dp.sideState++;
        if (snapshot) out.dp.entrySnapshot++;
        if (movesDiffer || benchHurt || stale || sideState || snapshot) out.dp.any++;
      }

      /* ---- then play the turn's events forward ---------------------------------------------- */
      for (const e of (turn.ev || [])) {
        if (!e || typeof e.s !== 'string') { if (e && e.t === 'fs') continue; continue; }
        const side = e.s.slice(0, 2), L = e.s.slice(2, 3);
        if (side !== 'p1' && side !== 'p2') continue;
        const foe = side === 'p1' ? 'p2' : 'p1';
        const S = st[side];
        if (e.t === 's') {
          const sp = base(e.mon);
          S.field[L] = sp; S.everOut.add(sp);
          /* THE ENTRY SNAPSHOT, recorded where the entry happens — the same rule `board.switchIn`
           * follows, and the reason #247 is closable at all. */
          S.entered[sp] = S.deaths;
        } else if (e.t === 'f') {
          const sp = base(e.mon || S.field[L]);
          S.dead.add(sp); S.deaths++; delete S.field[L]; S.hp[sp] = 0;
        } else if (e.t === 'hp') {
          if (e.hp != null) S.hp[base(e.mon)] = e.hp;
        } else if (e.t === 'x') {
          if (e.st) S.status[base(e.mon)] = String(e.st);
        } else if (e.t === 'm') {
          const sp = base(e.mon), mv = norm(e.mv);
          S.acts[sp] = (S.acts[sp] | 0) + 1;
          if (e.tgt && e.tgthp != null) {
            /* The target may be on either side; the store names a species, so it is keyed on both
             * and the wrong one is simply never read (a mirror is the only collision and both
             * copies then hold the same number). */
            st[side].hp[base(e.tgt)] = e.tgthp; st[foe].hp[base(e.tgt)] = e.tgthp;
          }
          if (HAZARDS.has(mv)) st[foe].hz.add(HAZARDS.get(mv));          /* foeSide, per move.target */
          if (REMOVERS.has(mv)) {
            const p = TAGS.param('move', mv, 'removesHazards') || {};
            const from = String(p.hazardsFrom || 'self');
            if (from === 'self' || from === 'both') S.hz.clear();
            if (from === 'both') st[foe].hz.clear();
            for (const id of (p.alsoRemoves || [])) delete st[foe].sc[norm(id)];
          }
          if (SCREENS.has(mv)) {
            const it = norm((sheet[side][sp] || {}).item || '');
            const turns = (CLAY && it === CLAY.item) ? CLAY.turns : SCREENS.get(mv);
            S.sc[mv] = tn + turns;                                        /* allySide, per move.target */
          }
          if (GRAVITY.has(mv)) gravityUntil = tn + GRAVITY.get(mv);
        }
      }
    }
  }

  const pct = (a, b) => b ? +(100 * a / b).toFixed(3) : null;
  const N = out.decisionPoints;
  out.rates = {
    pct_248_bench_moves_differ: pct(out.dp.movesDiffer, N),
    pct_248_bench_hurt_or_statused: pct(out.dp.benchHurt, N),
    pct_250_first_turn_move_offered_but_illegal: pct(out.dp.staleFirstTurn, N),
    pct_249_hazard_screen_or_gravity_up: pct(out.dp.sideState, N),
    pct_247_carrier_entered_over_graves: pct(out.dp.entrySnapshot, N),
    /* THE HEADLINE, and it is a CEILING: the share of decision points at which the seed handed
     * MEDICHAM a position that differs from the real one in AT LEAST ONE of the five. */
    pct_any: pct(out.dp.any, N),
  };
  out.elapsedMs = Date.now() - t0;
  const dst = D('data', 'rollout-seed-prevalence.json');
  fs.writeFileSync(dst, JSON.stringify(out, null, 2));

  console.log(`\nROADMAP #247/#248/#249/#250 prevalence — ${out.store}`);
  console.log(`  ${out.games} games, ${N} decision points, ${out.gamesSkipped} skipped`);
  console.log(`  #248 a benched body's declared moves differ from the dataset's : ${out.rates.pct_248_bench_moves_differ}%`);
  console.log(`  #248 a benched body is hurt or statused                        : ${out.rates.pct_248_bench_hurt_or_statused}%`);
  console.log(`  #250 a first-turn-only move was offerable and is not legal     : ${out.rates.pct_250_first_turn_move_offered_but_illegal}%`);
  console.log(`  #249 a hazard, a screen or Gravity is up                       : ${out.rates.pct_249_hazard_screen_or_gravity_up}%`);
  console.log(`  #247 a fallen-count carrier entered over graves                : ${out.rates.pct_247_carrier_entered_over_graves}%`);
  console.log(`  ANY of the five — the ceiling on this batch's reach            : ${out.rates.pct_any}%`);
  console.log(`  wrote ${path.relative(D(), dst).replace(/\\/g, '/')} in ${out.elapsedMs} ms\n`);
})();
