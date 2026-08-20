/* rollout_switch_census.js — HOW OFTEN DOES A REAL GAME SWITCH, AND HOW LONG DOES IT ACTUALLY RUN?
 *
 * ROADMAP #152/#153. This is the measurement that has to exist BEFORE anything in the rollout is
 * touched, and it is deliberately its own artifact rather than a paragraph inside a rollout change.
 *
 * IT IS NOT QUARANTINED, and that is the whole reason it is worth having right now. The store is
 * UPSTREAM of the simulator: these numbers are read off human replays that Showdown produced, so
 * nothing here passes through medicham2-browser.js, board.js, the weights or any leaf. It measures
 * the game, not our model of it. Every rollout-derived figure in this project is withheld while
 * MEDICHAM is out of gate; this one is not, because there is nothing of ours in it.
 *
 * THE STORE'S OWN EVENT LIST CANNOT ANSWER THIS, which is why the RAW LOGS are read instead.
 * `durable-ingest.js:110` matches `|switch|`, `|drag|` and `|replace|` with ONE regex and writes them
 * all as `{t:'s'}`. So the durable store cannot tell a player CHOOSING to leave from a body being
 * dragged out by Whirlwind, from a corpse being replaced after a KO, from an Illusion dropping. Those
 * are four different facts and only the first one is an action a search has to be able to represent.
 * Store raw, analyse on top — this is exactly the case that principle exists for.
 *
 * HOW A VOLUNTARY SWITCH IS IDENTIFIED, from the protocol's own ordering rather than from a name:
 *
 *   |turn|N              <- a turn block opens
 *   |switch|p2a: ...     <- VOLUNTARY. Switches resolve at priority 6, above every move priority in
 *                           this format (Helping Hand's +5 is the ceiling), so a chosen switch is
 *                           always ahead of the first |move| of its own turn.
 *   |move|...            <- moves begin
 *   |switch|p1b: ...     <- MID-TURN: driven by something that already happened this turn — a pivot
 *                           move (U-turn 3,999 / Flip Turn / Parting Shot 7,184 uses), an Eject
 *                           Button, an Emergency Exit. NOT a free action; the move was the action.
 *   |upkeep
 *   |switch|p2a: ...     <- REPLACEMENT. A body fainted and something has to come in. Showdown emits
 *                           these after upkeep and before the next |turn|. It is a forced request,
 *                           not a turn's action.
 *
 * `|drag|` is counted apart from all three (Whirlwind/Roar/Dragon Tail — the opponent's action), and
 * `|replace|` is an Illusion reveal and is not a switch at all.
 *
 * The three-way split is the point. "How often does a game contain a switch" answered on the durable
 * store's `t:'s'` would be answered almost entirely by post-KO replacements, which the rollout
 * ALREADY does (medicham2 refills a fainted slot), and would badly overstate the capability that is
 * actually missing.
 *
 *   node engine/rollout_switch_census.js            -> data/rollout-switch-census.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const D = (...p) => path.join(__dirname, '..', ...p);

/* Both human stores, named rather than picked. MEMORY: reading only games.ladder.jsonl cost a whole
 * session — the bo3 store IS the open-sheet ladder and is the population MILTANK actually plays. */
const STORES = [
  { key: 'ladder', raw: D('data', 'games.ladder.raw-logs.jsonl'), note: 'bo1 ladder' },
  { key: 'bo3', raw: D('data', 'games.bo3.raw-logs.jsonl'), note: 'bo3 ladder — the open-sheet population' },
];

const PCTS = [50, 75, 90, 95, 99, 99.9];
function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}
function summarise(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const out = { n: s.length, mean: s.length ? +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(3) : null,
                min: s[0] ?? null, max: s[s.length - 1] ?? null };
  for (const p of PCTS) out['p' + String(p).replace('.', '_')] = pct(s, p);
  return out;
}

/* ONE GAME. Returns null for anything that is not a finished Champions Reg M-B battle. */
function walk(log) {
  const L = String(log || '').split('\n');
  let tier = '', forfeit = false, ended = false;
  let turn = 0, started = false, phase = 'pre';   // pre | turn | post(upkeep)
  let sawMoveThisTurn = false;

  const res = {
    turns: 0, forfeit: false,
    voluntary: 0, midturn: 0, replacement: 0, drag: 0,
    volTurns: [],          // turn index of each voluntary switch
    decisions: 0,          // slot-turns where somebody had an action to choose
    decisionsWithBench: 0, // ...and their side had somewhere to send them
    voluntaryWithBench: 0,
    turnsWithVol: 0,
  };
  let volThisTurn = 0;
  const actedThisTurn = new Set();

  /* CAN THIS SIDE SWITCH AT ALL? The rollout only draws a switch when a live body sits on the bench,
   * so `voluntary / all decisions` is NOT the rate to price that draw against — the two have
   * different denominators and comparing them was off by a factor of two. `|teamsize|` gives what was
   * brought and `|faint|` counts what is gone; two bodies are on the field whenever that many remain,
   * so the live bench is `brought - fainted - 2`. Counted per side, at the START of each turn, which
   * is when the decision is made. */
  const teamsize = { p1: 4, p2: 4 };
  const fainted = { p1: 0, p2: 0 };
  const benchAtTurnStart = { p1: 0, p2: 0 };
  const snapBench = () => {
    for (const s of ['p1', 'p2']) benchAtTurnStart[s] = Math.max(0, teamsize[s] - fainted[s] - 2);
  };

  const closeTurn = () => {
    if (volThisTurn) res.turnsWithVol++;
    res.decisions += actedThisTurn.size;
    for (const slot of actedThisTurn) {
      const s = slot.slice(0, 2);
      if (benchAtTurnStart[s] > 0) res.decisionsWithBench++;
    }
    volThisTurn = 0; actedThisTurn.clear();
  };

  for (const line of L) {
    if (!line.startsWith('|')) continue;
    const p = line.split('|');
    const cmd = p[1];
    if (cmd === 'tier') { tier = p[2] || ''; continue; }
    if (cmd === 'teamsize') { const s = p[2]; if (s === 'p1' || s === 'p2') teamsize[s] = parseInt(p[3], 10) || 4; continue; }
    if (cmd === 'turn') {
      if (started) closeTurn();
      started = true; phase = 'turn'; sawMoveThisTurn = false;
      turn = parseInt(p[2], 10) || turn + 1;
      res.turns = Math.max(res.turns, turn);
      snapBench();
      continue;
    }
    if (!started) continue;                                  // leads, team preview, showteam
    if (cmd === 'upkeep') { phase = 'post'; continue; }
    if (cmd === 'win' || cmd === 'tie') { ended = true; continue; }
    if (cmd === '-message' && /forfeit/i.test(p[2] || '')) forfeit = true;
    if (cmd === 'faint') { const s = (p[2] || '').slice(0, 2); if (s === 'p1' || s === 'p2') fainted[s]++; continue; }
    if (cmd === 'move' || cmd === 'cant') {
      /* NORMALISED TO THE SLOT (`p1a`), not the "p1a: Nickname" the protocol prints. The switch
       * branch below keys on the slot, and two spellings of one key would double-count every turn a
       * body both moved and switched — the third-dialect-of-terrain mistake in miniature. */
      if (phase === 'turn') { sawMoveThisTurn = true; actedThisTurn.add((p[2] || '').split(':')[0]); }
      continue;
    }
    if (cmd === 'drag') { res.drag++; continue; }
    if (cmd === 'replace') continue;                          // Illusion reveal, not a switch
    if (cmd === 'switch') {
      const slot = (p[2] || '').split(':')[0];
      if (phase === 'post') { res.replacement++; }
      else if (sawMoveThisTurn) { res.midturn++; }
      else {
        res.voluntary++; volThisTurn++; res.volTurns.push(turn); actedThisTurn.add(slot);
        /* By construction this side HAD a bench — it just used it. Counted explicitly rather than
         * inferred, because `benchAtTurnStart` is a reconstruction and a switch is ground truth. */
        res.voluntaryWithBench++;
      }
      continue;
    }
  }
  if (started) closeTurn();
  res.forfeit = forfeit;
  if (!/champions/i.test(tier)) return null;
  if (!ended) return null;
  if (!res.turns) return null;
  return res;
}

function digestOf(f) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); }
  catch (e) {
    /* ROADMAP #258 — a null digest is stamped so an unreadable file can never compare EQUAL to a
     * present one, and the reason is printed so a stamp that has quietly lost a file is visible. */
    console.error('  NO DIGEST — ' + f + ' (' + String((e && e.message) || e).split(String.fromCharCode(10))[0]
                + '); stamped null, which is NOT "unchanged"');
    return null;
  }
}

async function censusOne(store) {
  if (!fs.existsSync(store.raw)) return { key: store.key, error: 'missing: ' + store.raw };
  const rs = fs.createReadStream(store.raw);
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity });
  const lens = [], lensNoForfeit = [];
  const volPerGame = [], repPerGame = [], midPerGame = [];
  const volTurnHist = new Map();
  const reachedTurn = new Map();      // t -> count of games that reached turn t
  const remainByTurn = new Map();     // t -> [remaining turns]
  let games = 0, skipped = 0, gamesWithVol = 0, gamesWithVolOrMid = 0;
  let decisions = 0, voluntary = 0, midturn = 0, replacement = 0, drag = 0, turnsTot = 0, turnsWithVol = 0;
  let decisionsWithBench = 0, voluntaryWithBench = 0;
  let forfeits = 0;

  for await (const line of rl) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch (e) { skipped++; continue; }
    const r = walk(o.log);
    if (!r) { skipped++; continue; }
    games++;
    lens.push(r.turns);
    if (r.forfeit) forfeits++; else lensNoForfeit.push(r.turns);
    volPerGame.push(r.voluntary); repPerGame.push(r.replacement); midPerGame.push(r.midturn);
    if (r.voluntary) gamesWithVol++;
    if (r.voluntary || r.midturn) gamesWithVolOrMid++;
    for (const t of r.volTurns) volTurnHist.set(t, (volTurnHist.get(t) || 0) + 1);
    /* THE CAP QUESTION. A playout does not start at turn 1; it starts wherever the search is. So the
     * horizon it needs is REMAINING turns conditional on having reached turn t, not total length. */
    for (let t = 1; t <= r.turns; t++) {
      reachedTurn.set(t, (reachedTurn.get(t) || 0) + 1);
      if (t <= 20) { if (!remainByTurn.has(t)) remainByTurn.set(t, []); remainByTurn.get(t).push(r.turns - t); }
    }
    decisionsWithBench += r.decisionsWithBench; voluntaryWithBench += r.voluntaryWithBench;
    decisions += r.decisions; voluntary += r.voluntary; midturn += r.midturn;
    replacement += r.replacement; drag += r.drag; turnsTot += r.turns; turnsWithVol += r.turnsWithVol;
  }

  const remaining = {};
  for (const [t, arr] of [...remainByTurn.entries()].sort((a, b) => a[0] - b[0])) remaining['from_turn_' + t] = summarise(arr);

  /* THE CAP, DERIVED RATHER THAN ROUNDED.
   *
   * A playout does not start at turn 1, so the horizon it needs is the distribution of REMAINING
   * turns over positions weighted by HOW OFTEN THEY OCCUR — every (game, t) pair a real game passes
   * through, which is exactly the population of positions a search is asked about. `maxTurns` is a
   * cap on the playout's own clock, so it must cover `total - t`, not `total`. */
  const remAll = [];
  for (const [t, arr] of remainByTurn.entries()) { if (t <= 20) for (const r of arr) remAll.push(r); }
  const remSorted = remAll.slice().sort((a, b) => a - b);
  const coverage = {};
  for (const k of [6, 8, 10, 12, 14, 16, 20, 24, 30, 60]) {
    let i = 0; while (i < remSorted.length && remSorted[i] <= k) i++;
    coverage['cap_' + k] = { pct_positions_that_reach_a_real_terminal: +(100 * i / remSorted.length).toFixed(3),
                             pct_truncated: +(100 * (remSorted.length - i) / remSorted.length).toFixed(3) };
  }

  return {
    remaining_turns_occurrence_weighted: summarise(remAll),
    cap_coverage: coverage,
    key: store.key, note: store.note, file: path.basename(store.raw), digest: digestOf(store.raw),
    games, skipped, forfeits,
    length_all: summarise(lens),
    length_no_forfeit: summarise(lensNoForfeit),
    switches: {
      voluntary, midturn, replacement, drag,
      per_game: { voluntary: summarise(volPerGame), midturn: summarise(midPerGame), replacement: summarise(repPerGame) },
      games_with_a_voluntary_switch: gamesWithVol,
      pct_games_with_a_voluntary_switch: +(100 * gamesWithVol / games).toFixed(2),
      pct_games_with_voluntary_or_midturn: +(100 * gamesWithVolOrMid / games).toFixed(2),
      turns_total: turnsTot,
      turns_with_a_voluntary_switch: turnsWithVol,
      pct_turns_with_a_voluntary_switch: +(100 * turnsWithVol / turnsTot).toFixed(2),
      decisions_counted: decisions,
      /* Given a body has an action to choose this turn, how often is that action "leave"? This is the
       * rate a playout's action set has been pinning at exactly 0. */
      pct_decisions_that_are_a_voluntary_switch: +(100 * voluntary / decisions).toFixed(3),
      /* *** THE NUMBER THE ROLLOUT IS PRICED WITH, and it is the CONDITIONAL one. ***
       * The playout only draws a switch when a live body is on the bench, so the rate above — whose
       * denominator includes every decision made with an empty bench — is the wrong target and is
       * low by roughly the fraction of decisions that have a bench at all. Using it produced a
       * realised playout rate of 3.9% against a stated 7.7% with nothing wrong in the draw. */
      decisions_with_a_live_bench: decisionsWithBench,
      pct_decisions_with_a_bench_that_are_a_voluntary_switch:
        +(100 * voluntaryWithBench / decisionsWithBench).toFixed(3),
    },
    voluntary_switch_turn_histogram: Object.fromEntries([...volTurnHist.entries()].sort((a, b) => a[0] - b[0]).slice(0, 30)),
    remaining_turns_conditional: remaining,
  };
}

(async () => {
  const out = { generated: new Date().toISOString(), node: process.version,
                what: 'switch rate and game length, read from the RAW human replay logs of both stores',
                quarantined: false,
                why_not_quarantined: 'the store is upstream of MEDICHAM; nothing here reads the simulator, board.js, the weights or any leaf',
                method: 'voluntary = a |switch| ahead of the first |move| of its turn block; midturn = after a |move| (pivot move, Eject Button, Emergency Exit); replacement = after |upkeep|; |drag| counted apart; |replace| is an Illusion reveal and is not a switch',
                stores: [] };
  for (const s of STORES) {
    process.stderr.write('  reading ' + path.basename(s.raw) + ' ...\n');
    out.stores.push(await censusOne(s));
  }
  /* Pooled, because the cap and the switch rate are one decision for one rollout. */
  const ok = out.stores.filter(s => !s.error);
  const g = ok.reduce((a, s) => a + s.games, 0);
  out.pooled = {
    games: g,
    voluntary: ok.reduce((a, s) => a + s.switches.voluntary, 0),
    midturn: ok.reduce((a, s) => a + s.switches.midturn, 0),
    replacement: ok.reduce((a, s) => a + s.switches.replacement, 0),
    decisions: ok.reduce((a, s) => a + s.switches.decisions_counted, 0),
    decisions_with_a_live_bench: ok.reduce((a, s) => a + s.switches.decisions_with_a_live_bench, 0),
    turns_total: ok.reduce((a, s) => a + s.switches.turns_total, 0),
  };
  out.pooled.pct_decisions_that_are_a_voluntary_switch =
    +(100 * out.pooled.voluntary / out.pooled.decisions).toFixed(3);
  /* THE ONE `rollout_leaf.js` READS. Conditional on a bench existing, because that is the only
   * circumstance in which the playout has a switch to draw. */
  out.pooled.pct_decisions_with_a_bench_that_are_a_voluntary_switch =
    +(100 * out.pooled.voluntary / out.pooled.decisions_with_a_live_bench).toFixed(3);
  out.pooled.pct_games_with_a_voluntary_switch =
    +(100 * ok.reduce((a, s) => a + s.switches.games_with_a_voluntary_switch, 0) / g).toFixed(2);

  /* THE CAP, AS A RULE RATHER THAN AS A ROUND NUMBER (ROADMAP #153).
   *
   * `maxTurns` was 60. Nothing derived it; MEDICHAM's own default is 20 and 60 was chosen to buy a
   * horizon long enough that stalling stops paying. Against the store that is roughly ten times the
   * game: median total length 6 (ladder) / 7 (bo3), p99 16 in both.
   *
   * The right quantity is NOT total length. A playout starts wherever the search is, and `maxTurns`
   * caps the playout's own clock, so what it has to cover is REMAINING turns from a position — and
   * positions have to be weighted by how often they occur, which is every (game, t) pair a real game
   * passes through. THE RULE: the smallest integer horizon at which 99% of those positions reach a
   * real terminal state, taken as the MAX over the two stores so neither population is the one that
   * gets truncated. 99% and not 99.9% because the tail is a stall tail — p99.9 remaining is 33 turns
   * on the ladder, which is most of the way back to 60 for one position in a thousand.
   *
   * A truncated playout is not a coin: `battleResult` scores it on HP totals. So the cost of the
   * remaining 1% is that the leaf answers those positions with a material comparison, which is the
   * thing R1 measured at 65.3% on its own — a degradation, not a hole. */
  out.derived_cap = {
    rule: 'smallest integer K with >=99% of occurrence-weighted (game,t) positions having <=K turns remaining, maxed over both stores',
    per_store: Object.fromEntries(ok.map(s => [s.key, s.remaining_turns_occurrence_weighted.p99])),
    max_turns: Math.max(...ok.map(s => s.remaining_turns_occurrence_weighted.p99)),
    was: 60,
    was_derived_from: 'nothing — a round number; MEDICHAM default is 20',
    note: 'this is derived from REAL games. A uniformly-random playout is less lethal than a person, so the rate at which this cap actually BINDS inside the simulator is a different number and is measured separately by engine/rollout_switch_probe.js',
  };

  const f = D('data', 'rollout-switch-census.json');
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log('wrote ' + f);
  for (const s of out.stores) {
    if (s.error) { console.log(s.key + ': ' + s.error); continue; }
    console.log(`\n${s.key} (${s.note}) — ${s.games} games, ${s.skipped} skipped, ${s.forfeits} forfeits`);
    console.log(`  length  median ${s.length_all.p50}  mean ${s.length_all.mean}  p90 ${s.length_all.p90}  p99 ${s.length_all.p99}  p99.9 ${s.length_all.p99_9}  max ${s.length_all.max}`);
    console.log(`  length (no forfeit) median ${s.length_no_forfeit.p50}  p99 ${s.length_no_forfeit.p99}  p99.9 ${s.length_no_forfeit.p99_9}  max ${s.length_no_forfeit.max}`);
    console.log(`  voluntary ${s.switches.voluntary}  midturn ${s.switches.midturn}  replacement ${s.switches.replacement}  drag ${s.switches.drag}`);
    console.log(`  games with a voluntary switch: ${s.switches.pct_games_with_a_voluntary_switch}%   turns: ${s.switches.pct_turns_with_a_voluntary_switch}%`);
    console.log(`  P(a chosen action is a voluntary switch) = ${s.switches.pct_decisions_that_are_a_voluntary_switch}%  (${s.switches.voluntary}/${s.switches.decisions_counted})`);
    console.log(`  P(switch | the side HAD a live bench)    = ${s.switches.pct_decisions_with_a_bench_that_are_a_voluntary_switch}%  (${s.switches.voluntary}/${s.switches.decisions_with_a_live_bench})   <- what the playout is priced with`);
  }
  console.log(`\npooled: ${out.pooled.games} games, P(switch|decision) = ${out.pooled.pct_decisions_that_are_a_voluntary_switch}%, ${out.pooled.pct_games_with_a_voluntary_switch}% of games contain one`);
})();
