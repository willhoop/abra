/* ko_calibration.js — when MAG says "this kills", does the thing actually die?
 *
 *   SHOWDOWN_PATH=... node engine/ko_calibration.js
 *
 * WHY THIS EXISTS
 * ---------------
 * The fit came back with a NEGATIVE weight on `koTarget` twice running: given everything else the
 * model can see, a move that removes its target is LESS likely to be the one a person clicked. There
 * are two readings and they demand opposite responses.
 *
 *   1. People genuinely do not chase kills as hard as the feature assumes — a real finding about
 *      behaviour, and an argument that imitation is the wrong objective.
 *   2. The kill detector is wrong. It fires on moves that do not kill, so the weight is measuring my
 *      arithmetic rather than anyone's behaviour.
 *
 * Reading (1) off a fitted sign without checking (2) is precisely the failure this project keeps
 * having: a plausible number quoted before anyone asked what produced it. So this checks it directly
 * against the recorded games. The stored turns say who fainted; the feature says who should have.
 *
 * WHAT IT MEASURES
 *   precision — of the moves the feature called a clean kill, how many actually killed
 *   recall    — of the kills that actually happened, how many the feature saw coming
 *
 * Precision is the one that decides the question. A detector that fires on non-kills would produce
 * exactly the negative weight observed, and no conclusion about human behaviour would survive it.
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

if (!B.damageEngine()) {
  console.error('the damage engine did not load — every kill estimate would be zero. Refusing to report.');
  process.exit(1);
}

const { games } = FP.loadCorpus();
console.log(`KO CALIBRATION — ${games.length.toLocaleString()} games\n`);

/* Bucketed rather than thresholded. A single cut would need a number chosen here, and the useful
 * question is whether the estimate is calibrated ACROSS its range: when it says 0.7, do 70% die? */
const BUCKETS = [0, 0.2, 0.4, 0.6, 0.8, 0.999];
const bucket = p => { let i = 0; while (i + 1 < BUCKETS.length && p >= BUCKETS[i + 1]) i++; return i; };
const hit = new Array(BUCKETS.length).fill(0), tot = new Array(BUCKETS.length).fill(0);
let killsSeen = 0, killsForeseen = 0, decisions = 0, noEstimate = 0, misses = 0;
const why = { protect: 0, redirect: 0, screen: 0, intimidate: 0 };

for (const g of games) {
  const boardOf = new B.Board();
  const sheet = {};
  for (const side of ['p1', 'p2']) {
    for (const m of (g.sheets && g.sheets[side]) || []) {
      if (m && m.species) {
        sheet[base(m.species)] = { side, moves: (m.moves || []).map(norm) };
        /* The sheet's nature reaches the board, so the damage estimate is computed against the
         * spreads consistent with it rather than all of them. Public information on this ladder. */
        boardOf.setSheet(side, m.species, { nature: m.nature || '', item: m.item || '' });
      }
    }
  }
  for (const side of ['p1', 'p2']) {
    const lead = (g.lead || {})[side] || [];
    if (lead[0]) boardOf.switchIn(side, 'a', lead[0]);
    if (lead[1]) boardOf.switchIn(side, 'b', lead[1]);
  }

  for (const t of g.turns || []) {
    const ev = t.ev || [];
    for (const e of ev) if (e.t === 'mega' && e.s) { const mn = boardOf.slot(e.s.slice(0, 2), e.s.slice(2)); if (mn) mn.species = norm(e.mon); }

    for (let k = 0; k < ev.length; k++) {
      const e = ev[k];
      if (e.t !== 'm' || !e.s || !e.mon || !e.mv || !e.tgt) continue;
      const side = e.s.slice(0, 2), letter = e.s.slice(2);
      const user = boardOf.slot(side, letter);
      const sh = sheet[base(e.mon)];
      if (!user || user.fainted || !sh) continue;

      const cands = B.candidates(sh.moves, user, boardOf, side, dex);
      const mvId = norm((dex.moves.get(e.mv) && dex.moves.get(e.mv).id) || e.mv);
      const c = cands.find(x => norm(x.move.id) === mvId && x.targetMon && base(x.targetMon.species) === base(e.tgt));
      if (!c) continue;

      const x = B.featuresFor(c, user, boardOf, side, dex, FP.priorFor(user.species, c.move.id));
      const p = x[B.FEATURE_INDEX.koTarget];
      decisions++;
      if (!(p > 0) && !(p === 0)) { noEstimate++; continue; }

      /* GROUND TRUTH: did the thing this move was aimed at faint later in this same turn? Later in
       * the event list, not anywhere in the turn — a faint recorded BEFORE the move cannot have been
       * caused by it, and counting those would credit the estimate for kills it had nothing to do
       * with. This is the same slot-vs-order distinction that once faked a 22.2%/3.5% split. */
      let died = false;
      for (let j = k + 1; j < ev.length; j++) {
        const f = ev[j];
        if (f.t === 'f' && f.mon && base(f.mon) === base(e.tgt)) { died = true; break; }
      }

      const b = bucket(p);
      tot[b]++; if (died) hit[b]++;
      if (died) { killsSeen++; if (p >= 0.5) killsForeseen++; }

      /* WHY DID THE "CLEAN KILL" NOT KILL? Guessing at this would pick the wrong thing to build
       * next, so each candidate is counted from the recorded turn itself. Not exclusive -- a target
       * can both protect and be behind a screen -- so these are shares of the misses, not a
       * partition, and they are read off the same event list the ground truth comes from. */
      if (p >= 0.999 && !died) {
        misses++;
        const tgtBase = base(e.tgt);
        for (let j = 0; j < ev.length; j++) {
          const f = ev[j];
          if (f.t !== 'm' || !f.mon) continue;
          const fm = dex.moves.get(f.mv);
          if (base(f.mon) === tgtBase && fm && fm.exists && fm.stallingMove) why.protect++;
          /* Redirection sends the attack somewhere else entirely, so the target was never hit. */
          if (fm && fm.exists && fm.volatileStatus && /followme|ragepowder/.test(fm.volatileStatus)) why.redirect++;
          if (fm && fm.exists && /reflect|lightscreen|auroraveil/.test(norm(fm.id))) why.screen++;
        }
        /* Intimidate is the format's most common ability and cuts physical damage by a third. It is
         * counted by presence on the field, not by a switch-in event, because it may have landed
         * turns earlier. */
        if ((m0 => m0)(true)) {
          for (const fl of boardOf.field()) {
            if (fl.side === side) continue;
            const sp0 = dex.species.get(fl.mon.species);
            const abils = sp0 && sp0.exists ? Object.values(sp0.abilities || {}).map(norm) : [];
            if (abils.includes('intimidate') && c.move.category === 'Physical') { why.intimidate++; break; }
          }
        }
      }
    }

    for (const e of ev) {
      const side = e.s ? e.s.slice(0, 2) : null, letter = e.s ? e.s.slice(2) : null;
      if (e.t === 's' && side) boardOf.switchIn(side, letter, e.mon);
      else if (e.t === 'm' && side) {
        const u = boardOf.slot(side, letter); if (u) B.noteMove(u, dex.moves.get(e.mv), boardOf);
        /* The same absolute-HP rule the fitter uses, or the calibration would be measured against a
         * board reconstructed differently from the one the features were computed on. */
        if (e.tgt && (e.tgthp != null || e.dmg)) {
          const foe = side === 'p1' ? 'p2' : 'p1';
          let done2 = false;
          for (const sd of [foe, side]) { for (const L of ['a', 'b']) {
            const m2 = boardOf.slot(sd, L);
            if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) {
              m2.hp = e.tgthp != null ? Math.max(0, e.tgthp / 100) : Math.max(0, m2.hp - e.dmg / 100);
              done2 = true; break;
            } } if (done2) break; }
        }
      }
      else if (e.t === 'f' && side) { const u = boardOf.slot(side, letter); if (u) u.fainted = true; }
      else if (e.t === 'hp' && side) { const u = boardOf.slot(side, letter); if (u && e.hp != null) u.hp = Math.max(0, e.hp / 100); }
      /* Stat stages, absolute -- Intimidate, Snarl, Icy Wind, Swords Dance. Written as a whole set
       * by the ingest rather than as a delta, so a dropped event cannot corrupt everything after it. */
      else if (e.t === 'b' && side) { const u = boardOf.slot(side, letter); if (u && e.b) u.boosts = { ...e.b }; }
      else if (e.t === 'w') boardOf.setWeather(e.field);
      else if (e.t === 'fs') boardOf.startField(e.field, 5);
    }
    /* endTurn(), NOT turn++. The counter is the visible half; endTurn also rolls
     * stalledThisTurn -> stalledLastTurn, advances turnsActive and moves moveThisTurn into
     * lastMove. Incrementing the number by hand leaves deadStall permanently 0 and every
     * Fake Out permanently legal -- silently, in a replay that otherwise looks correct.
     * engine/fit_policy.js and engine/magnemite.js always called endTurn; every analysis file
     * written on 2026-07-26 did not, and engine/feature_coverage.js is what caught it. */
    boardOf.endTurn();
  }
}

const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '   n/a';
console.log('  what the feature said        how many actually died');
console.log('  ' + '-'.repeat(60));
for (let i = 0; i < BUCKETS.length; i++) {
  const lo = BUCKETS[i], hi = i + 1 < BUCKETS.length ? BUCKETS[i + 1] : 1;
  const label = i === BUCKETS.length - 1 ? 'a clean kill (>=1.0)' : `${lo.toFixed(1)} - ${hi.toFixed(1)}`;
  console.log(`  ${label.padEnd(28)} ${pct(hit[i], tot[i]).padStart(7)}   (${tot[i].toLocaleString()} moves)`);
}
console.log(`\n  ${decisions.toLocaleString()} aimed moves scored, ${noEstimate.toLocaleString()} with no estimate`);
console.log(`  kills that actually happened: ${killsSeen.toLocaleString()}`);
console.log(`  of those, the feature saw coming (>=0.5): ${pct(killsForeseen, killsSeen)}`);
console.log(`
  WHY THE ${misses.toLocaleString()} "CLEAN KILL" CALLS DID NOT KILL (overlapping, not a partition)`);
for (const [k, v] of Object.entries(why).sort((a,b)=>b[1]-a[1]))
  console.log(`    ${k.padEnd(12)} ${pct(v, misses).padStart(7)}  (${v.toLocaleString()})`);
console.log(`
  READ THE TOP ROW AND THE BOTTOM ROW. If "a clean kill" is not overwhelmingly followed by a death,
  the feature is wrong and the negative fitted weight is MY arithmetic, not anyone's behaviour.`);
