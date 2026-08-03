/* lookahead_divergence.js — PHASE 1 of the question that comes before G3.
 *
 *   SHOWDOWN_PATH=... node engine/lookahead_divergence.js
 *
 * INCOMPLETE, AND SAID SO HERE RATHER THAN DISCOVERED BY THE NEXT READER. Two things are missing:
 *
 *   1. PHASE 2 DOES NOT EXIST. There is no engine/lookahead_divergence.py yet, so nothing scores the
 *      leaves this writes and no divergence rate has been measured. The file produces input for a
 *      consumer that has not been written.
 *   2. THE PICK CAPTURE ONLY LANDS ON ~20% OF DECISIONS (3 of 15 on the smoke run; the rest are
 *      counted as `no MAG pick` and dropped). Dropped rather than guessed, so what it writes is
 *      correct — but a 20% sample chosen by a timing accident is not a random sample of decisions,
 *      and the rate must be fixed before any number off this file is quoted.
 *
 * It is committed because the enumeration and the fork side ARE working — 49 legal cells from 9x6
 * proposed options, validated by Showdown itself, 0 throws, 0 inert — and because the MEDICHAM route
 * below may make the PORYGON2 half of it unnecessary.
 *
 * THE ALTERNATIVE THIS MAY BE SUPERSEDED BY. Will's question — "can't it just be all the same calcs
 * we already do" — points at engine/medicham2-browser.js, which already plays doubles positions out.
 * `battleInit` does not reset HP, so it can be seeded mid-game, and a rollout to a result is a better
 * leaf than a snapshot k-NN that data/porygon2c.json scores 3.4 points above counting bodies.
 * engine/medicham_coverage.js measures the price: 15.3% of real clicks are moves MEDICHAM turns into
 * a no-op turn. Decide between the two routes before finishing this one.
 *
 * THE QUESTION
 * ------------
 * G3 as written asks "how much of the +4.91 does a real search recover", and G4 asks "does it win".
 * Both are expensive. There is a cheaper question that comes first and can kill the design outright:
 *
 *      DOES THE SEARCH EVEN PICK A DIFFERENT MOVE?
 *
 * If a one-step search chooses what MAG already chooses on 95% of turns, then it cannot win more
 * games than MAG no matter how good the theory is, and no SPRT is needed to know it. That is a
 * behavioural question, not a strength question, and it is answerable without a matrix solver, an
 * equilibrium, or a single played-out game.
 *
 * WHY IT IS WORTH ASKING NOW RATHER THAN AFTER G3
 * -----------------------------------------------
 * data/porygon2c.json scores its own leaf: coin 50.38%, "material sign" 60.28%, the fitted k-NN
 * 63.70%. The entire learned value function is worth 3.4 points over counting bodies. A one-step
 * search maximising it is therefore, to within 3.4 points, a search for "which move removes the most
 * material next turn" — which is what a greedy damage policy already does. The two players may be
 * near-identical by construction. That is a hypothesis; this measures it.
 *
 * WHAT IS CONTROLLED, AND WHAT IS NOT
 * -----------------------------------
 *   MY side is enumerated EXHAUSTIVELY, not pruned. The whole point is to compare choices, so
 *   introducing the top-K window here would confound "the search chose differently" with "the search
 *   never saw it". Truncation is measured separately in engine/truncation_curve.js.
 *
 *   THE OPPONENT IS FIXED, and this is the honest weakness. Every one of my candidates is stepped
 *   against the SAME opponent action, so the comparison across candidates is like-for-like, but the
 *   opponent is not being modelled and no equilibrium is being solved. A best-response-to-a-fixed-
 *   opponent is a weaker object than the design's matrix game. It is the right first cut anyway:
 *   if even this does not diverge from MAG, the equilibrium version will not either, because the
 *   equilibrium is a mixture over the same cells.
 *
 *   SWITCHES ARE EXCLUDED. Voluntary switches were measured at exactly 4 x games in every self-play
 *   corpus on disk — the opening send-outs and nothing else — so MAG's realised choice set is moves.
 *   Including switches would let the search diverge on a dimension MAG never uses, which would
 *   inflate divergence without meaning anything.
 *
 * LEGALITY IS NOT REIMPLEMENTED. Candidate action strings are proposed and then VALIDATED BY
 * ATTEMPTING THEM on a fork — Showdown's own choice parser is the source of truth, exactly as
 * champions_sim.js defers to TeamValidator rather than hand-rolling a learnset walk.
 *
 * PHASE 1 WRITES, IT DOES NOT SCORE. The leaf is PORYGON2, a k-NN in Python over 98,776 self-play
 * positions, and its features are parsed from the protocol log by porygon2.py. Rather than port that
 * parser to JS — a second implementation of the thing that defines the feature semantics — this
 * writes each fork's protocol DELTA and lets phase 2 score it with the parser that already exists.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const MAG = require('./magnemite.js');

const { BattleStream, getPlayerStreams } = CS.sim();
const D = (...p) => path.join(__dirname, '..', ...p);

const GAMES = parseInt(process.env.GAMES || '20', 10);
const MAX_DECISIONS = parseInt(process.env.MAX_DECISIONS || '400', 10);
/* The opponent action every candidate is stepped against. `default` is Showdown's own first legal
 * choice. It is crude and it is CONSTANT, which is the property that matters — a ranking is only
 * meaningful if every candidate faced the same thing. */
const FOE_ACTION = process.env.FOE_ACTION || 'default';
const OUT = D('data', 'lookahead-divergence.jsonl');

/* Which move targets need to be named in doubles. Read from the request's own `target` field rather
 * than from a table here, so a move whose targeting changes upstream does not silently generate
 * illegal candidates that then look like a smaller choice set. */
function targetsFor(move) {
  const t = move && move.target;
  if (t === 'normal' || t === 'adjacentFoe') return ['1', '2'];
  if (t === 'any') return ['1', '2', '-1', '-2'];
  if (t === 'adjacentAlly') return ['-1', '-2'];
  if (t === 'adjacentAllyOrSelf') return ['-1', '-2'];
  return [null];                    /* spread, self, side and field moves take no target */
}

function slotOptions(slot) {
  if (!slot || slot.trapped === undefined && !slot.moves) return [];
  const out = [];
  const moves = slot.moves || [];
  for (let j = 0; j < moves.length; j++) {
    if (moves[j].disabled) continue;
    for (const tg of targetsFor(moves[j])) {
      out.push(tg === null ? `move ${j + 1}` : `move ${j + 1} ${tg}`);
    }
  }
  return out;
}

async function playGame(gameIdx, sink, budget) {
  const bs = new BattleStream();
  const streams = getPlayerStreams(bs);

  const mk = () => MAG.makeScoringPlayer();
  const PA = mk(), PB = mk();
  const p1 = new PA(streams.p1, {});
  const p2 = new PB(streams.p2, {});

  /* CAPTURE WHAT MAG ACTUALLY CHOSE, from the player itself rather than from the protocol. The
   * protocol records the resolved action, which has already been through target resolution and
   * redirection; what this needs is the string MAG clicked, so that "did the search pick something
   * else" compares two objects of the same kind. */
  /* KEYED TO THE REQUEST OBJECT, not to a variable set nearby. The first version parked the picks in
   * a `pending` set just before an await, which collected every click of the whole game into one
   * decision: MAG chooses when the request arrives, which is BEFORE this loop sees the |turn| line,
   * so there is no moment at which "the picks so far" means "the picks for this decision". Showdown
   * hands the player one request object per decision and calls chooseMove once per active slot, so
   * that object is the natural key and identity comparison is exact. */
  const picksByReq = new Map();
  const wrap = (player) => {
    const orig = player.chooseMove.bind(player);
    player.chooseMove = (active, moves) => {
      const pick = orig(active, moves);
      const req = player._req;
      if (req) {
        if (!picksByReq.has(req)) picksByReq.set(req, []);
        picksByReq.get(req).push(String(pick));
      }
      return pick;
    };
  };
  wrap(p1);
  p1.start(); p2.start();

  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: CS.FORMAT })}\n` +
    `>player p1 ${JSON.stringify({ name: 'MAG-A' })}\n` +
    `>player p2 ${JSON.stringify({ name: 'MAG-B' })}`);

  let decisions = 0;
  for await (const chunk of streams.omniscient) {
    if (!/\|turn\|/.test(chunk)) continue;
    const battle = bs.battle;
    if (!battle || battle.ended) break;
    /* Only a quiescent move request is forkable — see the note in lookahead_cost.js. Anything else
     * is skipped rather than forced, and the skip is counted. */
    if (battle.requestState !== 'move' || !battle.sides.every(s => s.activeRequest)) { budget.notQuiet++; continue; }

    const req = battle.sides[0].activeRequest;
    const act = (req && req.active) || [];
    if (act.length < 2) { budget.notDoubles++; continue; }

    const A = slotOptions(act[0]), B = slotOptions(act[1]);
    if (!A.length || !B.length) { budget.noOptions++; continue; }

    const json = CS.snapshot(battle);
    const baseLen = json.log.length;
    const cells = [];
    for (const a of A) for (const b of B) {
      const str = `${a}, ${b}`;
      let fork;
      try { fork = CS.forkBattle(json); } catch (e) { budget.forkThrew++; continue; }
      /* A rejected candidate is EXPECTED here — proposing action strings and letting Showdown's own
       * parser reject the illegal ones is the point (see the header). But "returned false" and
       * "threw" are different answers and were being collapsed into one: false means the choice was
       * illegal, a throw means the parser could not even evaluate it, and only the second is a
       * problem with this file. Counted apart so a rise in the second is visible. */
      let okChoice = false;
      try { okChoice = fork.choose('p1', str); }
      catch (e) {
        budget.chooseThrew++;
        if (!budget.firstChooseError) budget.firstChooseError = `${str}: ${e.message}`;
        continue;
      }
      if (!okChoice) { budget.illegal++; continue; }
      try { fork.choose('p2', FOE_ACTION); } catch (e) { budget.forkThrew++; continue; }
      /* Same advance test as lookahead_cost.js: ended and awaiting-a-replacement both count. */
      const advanced = fork.ended || fork.turn > battle.turn || fork.requestState === 'switch';
      if (!advanced) { budget.inert++; continue; }
      cells.push({ action: str, delta: fork.log.slice(baseLen), ended: !!fork.ended });
    }
    if (cells.length < 2) { budget.tooFewCells++; continue; }

    /* MAG chose for THIS request before this loop saw the turn line, so the picks are already
     * recorded against p1's current request object. A decision whose picks did not land is dropped
     * rather than written with an empty pick — a divergence rate computed against a missing baseline
     * would read as 100% agreement or 100% disagreement depending only on how the comparison is
     * written, and neither would mean anything. */
    const magPick = (picksByReq.get(p1._req) || []).slice();
    if (magPick.length !== 2) { budget.noMagPick++; continue; }

    sink.write(JSON.stringify({
      game: gameIdx, turn: battle.turn,
      baseLog: json.log, cells, magPick,
      nOptions: { slotA: A.length, slotB: B.length, cells: cells.length },
    }) + '\n');
    decisions++;
    budget.decisions++;
    if (budget.decisions >= MAX_DECISIONS) break;
  }
  return decisions;
}

async function main() {
  console.log('LOOKAHEAD DIVERGENCE — phase 1: does the search have anything different to say?\n');
  const sink = fs.createWriteStream(OUT);
  const budget = { decisions: 0, notQuiet: 0, notDoubles: 0, noOptions: 0,
                   illegal: 0, inert: 0, forkThrew: 0, tooFewCells: 0, noMagPick: 0, chooseThrew: 0, firstChooseError: null };
  for (let g = 0; g < GAMES && budget.decisions < MAX_DECISIONS; g++) {
    const n = await playGame(g, sink, budget);
    process.stdout.write(`  game ${g + 1}/${GAMES}: ${n} decision(s), ${budget.decisions} total\r`);
  }
  sink.end();
  console.log('\n');
  console.log('  decisions recorded      ' + budget.decisions);
  console.log('  skipped: not quiescent  ' + budget.notQuiet);
  console.log('           not doubles    ' + budget.notDoubles);
  console.log('           no options     ' + budget.noOptions);
  console.log('           too few cells  ' + budget.tooFewCells);
  console.log('           no MAG pick    ' + budget.noMagPick);
  console.log('  cells:   illegal        ' + budget.illegal + '   (proposed then rejected by Showdown)');
  console.log('           inert          ' + budget.inert);
  console.log('           threw          ' + budget.forkThrew);
  if (budget.chooseThrew) console.log('           choose threw   ' + budget.chooseThrew + '   first: ' + budget.firstChooseError);
  console.log(`\n  wrote ${path.relative(D('.'), OUT)}`);
  console.log('  next: python engine/lookahead_divergence.py');
}

main().catch(e => { console.error('lookahead_divergence: ' + (e.stack || e.message)); process.exit(1); });
