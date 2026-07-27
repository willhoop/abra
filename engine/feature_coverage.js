/* feature_coverage.js — does every feature actually fire, in fitting AND in play?
 *
 *   SHOWDOWN_PATH=... node engine/feature_coverage.js
 *
 * WHY THIS EXISTS
 * ---------------
 * A feature that never takes a non-zero value is not a weak feature. It is a DEAD one: the fit gives
 * it a weight, the weight file records it, the player multiplies by it, and none of it means
 * anything. Nothing errors, nothing looks wrong, and the model is quietly smaller than its own
 * documentation claims.
 *
 * That is not hypothetical. Three separate cases turned up in one evening:
 *
 *   switchSurvives1/2, switchFaster   fitted from the corpus and UNREACHABLE IN PLAY, because
 *                                     engine/magnemite.js built its own candidate list and it
 *                                     contained only moves. The bot could not switch at all.
 *   movesFirst                        computed inside a block that needed a TARGET, so every
 *                                     targetless move — Tailwind, Protect, Trick Room, screens —
 *                                     silently scored "moves last" whatever its priority.
 *   killsThreat                       fired for nobody, because the threat cache was keyed on the
 *                                     wrong Pokemon and every switch candidate got the first one's
 *                                     answer.
 *
 * Each was found by accident. This finds them on purpose.
 *
 * TWO POPULATIONS, AND THE GAP BETWEEN THEM IS THE POINT
 * -----------------------------------------------------
 * FITTING  the human open-sheet corpus, scored exactly as engine/fit_policy.js scores it.
 * PLAY     a self-play run, scored exactly as engine/magnemite.js scores it.
 *
 * A feature alive in one and dead in the other is the switch bug again, and only a side-by-side
 * shows it. Reading either column alone is what let that ship.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');
const B = require('./board.js');
const FP = require('./fit_policy.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;
const PLAY_FILE = process.argv[2] || null;
const MAXG = +(process.env.MAXG || 400);

if (!B.damageEngine()) { console.error('damage engine unavailable — refusing to report'); process.exit(1); }

const blank = () => B.FEATURES.map(() => ({ nz: 0, n: 0, min: Infinity, max: -Infinity, sum: 0 }));
const note = (acc, x) => {
  for (let k = 0; k < x.length; k++) {
    const a = acc[k];
    a.n++; a.sum += x[k];
    if (x[k] !== 0) a.nz++;
    if (x[k] < a.min) a.min = x[k];
    if (x[k] > a.max) a.max = x[k];
  }
};

/* ---- FITTING: the human corpus, through the fitter's own candidate builder ------------------- */
const fit = blank();
{
  const { games } = FP.loadCorpus();
  let seen = 0;
  for (const g of games) {
    if (seen >= MAXG) break;
    seen++;
    const board = new B.Board();
    const sheet = {};
    for (const side of ['p1', 'p2']) {
      for (const m of (g.sheets && g.sheets[side]) || []) {
        if (m && m.species) {
          sheet[base(m.species)] = { side, moves: (m.moves || []).map(norm) };
          board.setSheet(side, m.species, { nature: m.nature || '', item: m.item || '' });
        }
      }
      board.setParty(side, ((g.brought || {})[side] || []));
      const lead = (g.lead || {})[side] || [];
      if (lead[0]) board.switchIn(side, 'a', lead[0]);
      if (lead[1]) board.switchIn(side, 'b', lead[1]);
    }
    for (const t of g.turns || []) {
      const ev = t.ev || [];
      for (const e of ev) {
        if (e.t !== 'm' || !e.s || !e.mon) continue;
        const side = e.s.slice(0, 2), letter = e.s.slice(2);
        const user = board.slot(side, letter);
        const sh = sheet[base(e.mon)];
        if (!user || user.fainted || !sh) continue;
        for (const c of B.candidates(sh.moves, user, board, side, dex)) {
          note(fit, B.featuresFor(c, user, board, side, dex,
            c.switchTo ? B.PRIOR_FLOOR : FP.priorFor(user.species, c.move.id)));
        }
      }
      /* THE REPLAY MUST BE THE FITTER'S REPLAY, NOT A LIGHTER ONE.
       *
       * A first version skipped noteMove and side conditions as "not needed for coverage", and the
       * report duly announced that deadSide and deadStall were DEAD features -- both of which carry
       * strong fitted weights (-2.20 and -1.04), which is impossible for a quantity that never
       * varies. The features were fine; the audit could not create the states they detect. A tool
       * that cries wolf is one people learn to scroll past, and this one nearly did it on its first
       * run about the very defect it exists to find. */
      for (const e of ev) {
        const side = e.s ? e.s.slice(0, 2) : null, L = e.s ? e.s.slice(2) : null;
        if (e.t === 'm' && side) {
          const u = board.slot(side, L);
          const mv = dex.moves.get(e.mv);
          if (u && mv && mv.exists) {
            const already = (mv.sideCondition && board.hasSide(side, mv.sideCondition)) ||
                            (B.fieldKey(mv) && board.hasField(B.fieldKey(mv)));
            B.noteMove(board, side, u, mv, !already);
          }
        }
        if (e.t === 's' && side) board.switchIn(side, L, e.mon);
        else if (e.t === 'f' && side) board.faint(side, L);
        else if (e.t === 'x' && side) { const m2 = board.slot(side, L); if (m2) m2.status = norm(e.st); }
        else if (e.t === 'hp' && side) { const m2 = board.slot(side, L); if (m2 && e.hp != null) m2.hp = Math.max(0, e.hp / 100); }
        else if (e.t === 'b' && side) { const m2 = board.slot(side, L); if (m2 && e.b) m2.boosts = { ...e.b }; }
        else if (e.t === 'm' && side && e.tgt && e.tgthp != null) {
          for (const sd of ['p1', 'p2']) for (const L2 of ['a', 'b']) {
            const m2 = board.slot(sd, L2);
            if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) m2.hp = Math.max(0, e.tgthp / 100);
          }
        }
        else if (e.t === 'w') board.setWeather(e.field);
        else if (e.t === 'fs') board.startField(e.field, 5);
      }
      /* endTurn(), NOT turn++. The counter is the visible half; endTurn also rolls
     * stalledThisTurn -> stalledLastTurn, advances turnsActive and moves moveThisTurn into
     * lastMove. Incrementing the number by hand leaves deadStall permanently 0 and every
     * Fake Out permanently legal -- silently, in a replay that otherwise looks correct.
     * engine/fit_policy.js and engine/magnemite.js always called endTurn; every analysis file
     * written on 2026-07-26 did not, and engine/feature_coverage.js is what caught it. */
    board.endTurn();
    }
  }
  console.log(`FEATURE COVERAGE — fitting: ${seen} human games, ${fit[0].n.toLocaleString()} candidates scored`);
}

/* ---- PLAY: the recorded thoughts of a real self-play run ------------------------------------- */
let play = null, playDecisions = 0;
if (PLAY_FILE && fs.existsSync(PLAY_FILE)) {
  /* The player records WHICH OPTIONS it had, which is the thing that matters here: a feature can
   * only fire on a candidate the player actually built. */
  const kinds = { move: 0, switch: 0 };
  for (const line of fs.readFileSync(PLAY_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let g; try { g = JSON.parse(line); } catch (e) { continue; }
    for (const d of g.thoughts || []) {
      playDecisions++;
      for (const o of d.opts || []) {
        if (/^switch/.test(o.mv)) kinds.switch++; else kinds.move++;
      }
    }
  }
  play = kinds;
}

console.log('');
console.log('  feature              fires    min      max     mean    verdict');
console.log('  ' + '-'.repeat(78));
const dead = [], rare = [];
B.FEATURES.forEach((f, k) => {
  const a = fit[k];
  const pct = a.n ? (100 * a.nz / a.n) : 0;
  const mean = a.n ? a.sum / a.n : 0;
  let verdict = '';
  if (a.nz === 0) { verdict = 'DEAD — never non-zero'; dead.push(f); }
  else if (pct < 0.1) { verdict = 'almost never fires'; rare.push(f); }
  console.log('  ' + f.padEnd(20) +
    (pct.toFixed(2) + '%').padStart(8) +
    (a.min === Infinity ? '   -' : a.min.toFixed(2).padStart(8)) +
    (a.max === -Infinity ? '   -' : a.max.toFixed(2).padStart(8)) +
    mean.toFixed(3).padStart(9) + '   ' + verdict);
});

console.log('');
if (dead.length) console.log(`  DEAD IN FITTING (${dead.length}): ${dead.join(', ')}`);
else console.log('  every feature fires at least once in fitting.');
if (rare.length) console.log(`  under 0.1% (${rare.length}): ${rare.join(', ')}`);

if (play) {
  console.log(`\n  IN PLAY — ${PLAY_FILE}`);
  console.log(`    decisions with recorded scores: ${playDecisions.toLocaleString()}`);
  console.log(`    options that were MOVES:        ${play.move.toLocaleString()}`);
  console.log(`    options that were SWITCHES:     ${play.switch.toLocaleString()}` +
    (play.switch === 0 ? '   <- THE PLAYER CANNOT SWITCH. Every switch feature is dead in play.' : ''));
} else {
  console.log('\n  No play file given. Run with --thoughts and pass the store to check the PLAYER too:');
  console.log('    node engine/mew.js --n 200 --thoughts --policy score --policy2 random --out data/x.jsonl');
  console.log('    node engine/feature_coverage.js data/x.jsonl');
}
