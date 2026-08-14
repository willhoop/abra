/* rollout_item_prevalence.js — HOW OFTEN IS A BODY ON THE BOARD HOLDING AN ITEM THE GAME REMOVED?
 *
 *   node engine/rollout_item_prevalence.js  [--store data/games.bo3.jsonl]
 *
 * ROADMAP #271. `board.switchIn` COPIED the item off the team sheet onto the slot object, `noteItem`
 * — the one thing `|-item|`/`|-enditem|` reaches — wrote only `itemNow`, and `dmgMon` read
 * `mon.item`. So a Life Orb, a Choice Scarf, an eaten Sitrus Berry and a spent Focus Sash all kept
 * applying, in the damage AND speed numbers MAG scores with and in every seeded playout. The fix is
 * correct whether or not it moves anything; "correct and inert" and "correct and load-bearing" are
 * different claims and this project has published them as one before. So the size is MEASURED,
 * exactly as `rollout_fallen_prevalence.js` and `rollout_seed_prevalence.js` measured theirs.
 *
 * WHAT IT COUNTS. A DECISION POINT is one (game, turn, side) read at the START of the turn — the
 * moment MAG scores its candidates and MILTANK would seed a rollout from that side's board. It is
 * the SAME denominator `data/rollout-fallen-prevalence.json` and `data/rollout-seed-prevalence.json`
 * use, deliberately, so this number is comparable to #244's 8.75% and the seed batch's 70.55%
 * rather than being an island.
 *
 * At each decision point it asks, of every body that reaches a feature or a seed:
 *
 *   active   one of the four Pokemon on the field holds something other than what its sheet
 *            declared. These are the bodies `dmgMon` builds for every damage feature MAG scores
 *            with, and the bodies `battleInit` puts on the field of every playout.
 *   bench    a live benched body of either side does. These reach `switchFeatures`, `benchRisk`
 *            and `rollout_leaf.sideTeam`.
 *
 * NOTHING IS NAMED. Every item-affecting move is enumerated out of `data/tags.json` at run time —
 * `removesItem`, `takesTargetItem` and `flingsOwnItem`, with their own params deciding whether the
 * item is destroyed, stolen or SWAPPED — so a move added by a future regulation is counted without
 * editing this file.
 *
 * THIS IS NOT DOWNSTREAM OF MEDICHAM AND IS NOT QUARANTINED. It reads the STORE and the TAG
 * artifact and plays no game — no `battleInit`, no rollout, no board, no `Dex`. It needs no engine
 * release, and an ENGINE agent rewriting the simulator underneath it cannot move a figure in it.
 * That is why it is the measurement that can honestly be taken while four agents are in the tree.
 *
 * *** EVERY FIGURE HERE IS A FLOOR, AND FOR A REASON THAT IS BIGGER THAN THE USUAL CAVEAT. ***
 * The store records no item CONSUMPTION at all. A spent Focus Sash, an eaten Sitrus Berry, a
 * detonated Air Balloon and a used Weakness Policy each emit `|-enditem|` on the live protocol and
 * NOTHING in the store, so none of them is counted below. Neither is Symbiosis, Pickpocket or
 * Magician, whose triggers the store also does not carry. What is counted is the item-removing and
 * item-swapping CLICK, which is the one item event a stored game can prove. The live path sees
 * strictly more.
 *
 * AND IT IS A CEILING ON DECISIONS, in the other direction and stated as one: it counts positions
 * where a body is priced holding something it does not hold, not decisions whose argmax flips. A
 * position can be wrong about an item and still rank its candidates in the same order.
 *
 * TWO APPROXIMATIONS IN THE COUNTING, STATED RATHER THAN BURIED:
 *   - A click is taken to have LANDED. A Knock Off that missed, was Protected, hit a Sticky Hold or
 *     was aimed at a mega stone still marks the target's item gone here. That over-counts; against
 *     it, every consumption in the paragraph above is missed entirely, which under-counts by more.
 *   - The store names a TARGET by species, so a mirror match cannot say which of the two copies was
 *     hit. Both are marked, and the count is flagged in `ambiguousTargets`.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const D = (...p) => path.join(__dirname, '..', ...p);
const TAGS = require('./tags.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* The forme a store event names is not always the sheet's key — `dragonitemega` acts, `dragonite`
 * is declared — so everything is keyed on the base, the same way `board.js` keys `sheet`, `itemNow`
 * and `pp`. Identical to the helper in rollout_seed_prevalence.js, deliberately: the two artifacts
 * have to be read side by side. */
const base = s => { const n = norm(s); return n.replace(/(mega[xy]?|gmax|tera|primal)$/, '') || n; };

const STORE = arg('store', D('data', 'games.bo3.jsonl'));

/* ---- the populations, DERIVED ---------------------------------------------------------------- */
/* Every move that can change what a body is holding, with what it DOES to the item read off the
 * tag's own params rather than from a name. `takesTargetItem` carries the three-way split
 * (`swaps` = Trick/Switcheroo, `removes` = Knock Off, `consumesAndGainsEffect` = Bug Bite), and
 * `removesItem.steals` says whether the user ends up holding it. */
const ITEM_MOVES = new Map();
const addMove = (id, patch) => {
  const k = norm(id);
  ITEM_MOVES.set(k, Object.assign({ target: true, swaps: false, steals: false, self: false },
    ITEM_MOVES.get(k) || {}, patch));
};
for (const mv of (TAGS.withTag('move', 'takesTargetItem') || [])) {
  const p = TAGS.param('move', mv, 'takesTargetItem') || {};
  addMove(mv, { swaps: !!p.swaps });
}
for (const mv of (TAGS.withTag('move', 'removesItem') || [])) {
  const p = TAGS.param('move', mv, 'removesItem') || {};
  addMove(mv, { steals: !!p.steals });
}
/* Fling spends the USER's item and touches the target's not at all. */
for (const mv of (TAGS.withTag('move', 'flingsOwnItem') || [])) addMove(mv, { target: false, self: true });

/* Counted and reported, never modelled: these change an item and the store cannot see the trigger. */
const UNSEEN_ABILITIES = [
  ...(TAGS.withTag('ability', 'stealsItem') || []),
  ...(TAGS.withTag('ability', 'passesItemToAlly') || []),
  ...(TAGS.withTag('ability', 'picksUpUsedItem') || []),
].map(norm);

(async () => {
  const t0 = Date.now();
  const out = {
    generated: new Date().toISOString(),
    what: 'ROADMAP #271 — how often a body on the board is priced holding an item the game removed',
    store: path.relative(D(), STORE).replace(/\\/g, '/'),
    floor: 'The store records NO item consumption (a spent Focus Sash, an eaten berry, a detonated ' +
           'Air Balloon) and no Symbiosis / Pickpocket / Magician trigger. Only the item-affecting ' +
           'CLICK is countable here, so every rate below is a FLOOR on what the live path sees.',
    derived_populations: {
      itemMoves: [...ITEM_MOVES.keys()].sort(),
      swappers: [...ITEM_MOVES.entries()].filter(([, v]) => v.swaps).map(([k]) => k).sort(),
      stealers: [...ITEM_MOVES.entries()].filter(([, v]) => v.steals).map(([k]) => k).sort(),
      selfSpenders: [...ITEM_MOVES.entries()].filter(([, v]) => v.self).map(([k]) => k).sort(),
      unmodelledAbilities: UNSEEN_ABILITIES,
    },
    games: 0, gamesSkipped: 0, gamesWithItemClick: 0, decisionPoints: 0, itemClicks: 0,
    ambiguousTargets: 0,
    dp: { activeStale: 0, benchStale: 0, mineStale: 0, foeStale: 0, any: 0, afterAnyClick: 0 },
    detail: { staleBodyTurns: 0, bodiesEverStale: 0, sheetEntries: 0 },
    node: process.version,
  };

  const rl = readline.createInterface({ input: fs.createReadStream(STORE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let g = null;
    try { g = JSON.parse(line); } catch (e) { out.gamesSkipped++; continue; }
    if (!g || !Array.isArray(g.turns)) { out.gamesSkipped++; continue; }
    out.games++;

    /* ---- what each body DECLARED, by base species -------------------------------------------- */
    const declared = { p1: {}, p2: {} };
    for (const s of ['p1', 'p2']) {
      for (const e of (g.sheets && g.sheets[s]) || []) {
        declared[s][base(e.species)] = norm(e.item); out.detail.sheetEntries++;
      }
      for (const [sp, e] of Object.entries(g.sets || {})) {
        if (declared[s][base(sp)] === undefined) declared[s][base(sp)] = norm(e && e.item);
      }
    }
    const brought = { p1: ((g.brought || {}).p1 || []).map(base), p2: ((g.brought || {}).p2 || []).map(base) };

    /* ---- what each body is HOLDING, as the clicks change it ---------------------------------- */
    const held = { p1: {}, p2: {} };
    for (const s of ['p1', 'p2']) for (const [sp, it] of Object.entries(declared[s])) held[s][sp] = it;

    const st = {};
    for (const s of ['p1', 'p2']) {
      st[s] = { field: {}, dead: new Set() };
      const lead = ((g.lead || {})[s] || []).map(base);
      ['a', 'b'].forEach((L, i) => { if (lead[i]) st[s].field[L] = lead[i]; });
    }
    let anyClick = false;
    const everStale = new Set();

    const isStale = (s, sp) => {
      const d = declared[s][sp], h = held[s][sp];
      return d !== undefined && h !== undefined && d !== h;
    };

    for (let ti = 0; ti < g.turns.length; ti++) {
      const turn = g.turns[ti];

      /* ---- THE DECISION POINT, read before the turn's events -------------------------------- */
      for (const me of ['p1', 'p2']) {
        const foe = me === 'p1' ? 'p2' : 'p1';
        out.decisionPoints++;
        if (anyClick) out.dp.afterAnyClick++;

        let active = false, bench = false, mine = false, theirs = false;
        for (const s of [me, foe]) {
          const onField = new Set(Object.values(st[s].field));
          for (const sp of onField) if (isStale(s, sp)) {
            active = true; if (s === me) mine = true; else theirs = true;
            out.detail.staleBodyTurns++; everStale.add(s + '/' + sp);
          }
          for (const sp of brought[s]) {
            if (onField.has(sp) || st[s].dead.has(sp)) continue;
            if (isStale(s, sp)) {
              bench = true; if (s === me) mine = true; else theirs = true;
              out.detail.staleBodyTurns++; everStale.add(s + '/' + sp);
            }
          }
        }
        if (active) out.dp.activeStale++;
        if (bench) out.dp.benchStale++;
        if (mine) out.dp.mineStale++;
        if (theirs) out.dp.foeStale++;
        if (active || bench) out.dp.any++;
      }

      /* ---- then play the turn's events forward ---------------------------------------------- */
      for (const e of (turn.ev || [])) {
        if (!e || typeof e.s !== 'string') continue;
        const side = e.s.slice(0, 2), L = e.s.slice(2, 3);
        if (side !== 'p1' && side !== 'p2') continue;
        const foe = side === 'p1' ? 'p2' : 'p1';
        if (e.t === 's') { st[side].field[L] = base(e.mon); continue; }
        if (e.t === 'f') { st[side].dead.add(base(e.mon || st[side].field[L])); delete st[side].field[L]; continue; }
        if (e.t !== 'm') continue;

        const mv = norm(e.mv);
        const rule = ITEM_MOVES.get(mv);
        if (!rule) continue;
        out.itemClicks++; anyClick = true;
        const user = base(e.mon);

        if (rule.self) { held[side][user] = ''; continue; }
        if (!e.tgt) continue;
        const tgt = base(e.tgt);
        /* THE TARGET IS A SPECIES NAME, so a mirror cannot say which copy was hit. Counted rather
         * than guessed at, the same convention `board.ambiguousTargets` uses. */
        const onBoth = declared[side][tgt] !== undefined && declared[foe][tgt] !== undefined;
        if (onBoth) out.ambiguousTargets++;
        const victimSide = declared[foe][tgt] !== undefined ? foe : side;

        if (rule.swaps) {
          const a = held[victimSide][tgt], b = held[side][user];
          if (a !== undefined) held[side][user] = a;
          if (b !== undefined) held[victimSide][tgt] = b;
        } else {
          const taken = held[victimSide][tgt];
          if (taken !== undefined) held[victimSide][tgt] = '';
          if (rule.steals && taken) held[side][user] = taken;
        }
      }
    }
    if (anyClick) out.gamesWithItemClick++;
    out.detail.bodiesEverStale += everStale.size;
  }

  const pct = (a, b) => b ? +(100 * a / b).toFixed(3) : null;
  const N = out.decisionPoints;
  out.rates = {
    pct_games_with_an_item_click: pct(out.gamesWithItemClick, out.games),
    pct_dp_after_any_item_click: pct(out.dp.afterAnyClick, N),
    pct_dp_active_body_priced_with_a_removed_item: pct(out.dp.activeStale, N),
    pct_dp_bench_body_priced_with_a_removed_item: pct(out.dp.benchStale, N),
    pct_dp_my_own_side_wrong: pct(out.dp.mineStale, N),
    pct_dp_the_foe_wrong: pct(out.dp.foeStale, N),
    /* THE HEADLINE, and it is a FLOOR on reach: the share of decision points at which at least one
     * body reaching a feature or a seed is priced holding something it does not hold. */
    pct_any: pct(out.dp.any, N),
  };
  out.elapsedMs = Date.now() - t0;
  const dst = D('data', 'rollout-item-prevalence.json');
  fs.writeFileSync(dst, JSON.stringify(out, null, 2));

  console.log(`\nROADMAP #271 prevalence — ${out.store}`);
  console.log(`  ${out.games} games, ${N} decision points, ${out.gamesSkipped} skipped`);
  console.log(`  item-affecting clicks                                         : ${out.itemClicks}`);
  console.log(`  games containing at least one                                 : ${out.rates.pct_games_with_an_item_click}%`);
  console.log(`  decision points after one has been clicked                    : ${out.rates.pct_dp_after_any_item_click}%`);
  console.log(`  an ACTIVE body is priced holding an item it does not hold      : ${out.rates.pct_dp_active_body_priced_with_a_removed_item}%`);
  console.log(`  a BENCHED body is                                             : ${out.rates.pct_dp_bench_body_priced_with_a_removed_item}%`);
  console.log(`  my own side is wrong                                          : ${out.rates.pct_dp_my_own_side_wrong}%`);
  console.log(`  the foe is wrong                                              : ${out.rates.pct_dp_the_foe_wrong}%`);
  console.log(`  ANY of them — the FLOOR on this fix's reach                    : ${out.rates.pct_any}%`);
  console.log(`  wrote ${path.relative(D(), dst).replace(/\\/g, '/')} in ${out.elapsedMs} ms\n`);
})();
