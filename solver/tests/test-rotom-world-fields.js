/* solver/tests/test-rotom-world-fields.js — the world fields the ladder logs showed ROTOM's world was missing
 * (2026-10-01, docs/_reports/2026-10-01-search-blind-spots.md; solver/rotom/world_log.js, solver/rotom/world.js).
 *
 *   node solver/tests/test-rotom-world-fields.js [--release eaa5becc54eb]        exit 0 GREEN, 1 RED
 *
 * Every clause rebuilds the world from a SAVED LADDER LOG (fixtures/rotom/postmortem/, copied from solver/out/rotom/) at a
 * decision, and asks the engine what the server showed. No game is played: one engine step from a rebuilt position at most.
 *
 *   IDENTITY  yeetpheesh (chomp1 2690109794), turn 7: our Arcanine-Hisui (the log calls it "Arcanine") Protected on turn 6
 *             and its Protect FAILED on turn 7 on the server. The world lays its consecutive-Protect counter at 1, and one
 *             engine step of that Protect fails on some seeds. RED under ROTOM_WORLD_BREAK=noalias (counter 0, never fails).
 *   UNBURDEN  sbsbsh (chomp1 2690129513), turn 2: their Sneasler lost its item on turn 1 and on turn 2 moved before our
 *             Excadrill. The world lays the Unburden volatile and the engine's Speed puts Sneasler first. RED under noub.
 *   FLASHFIRE pandywulu (gen5ab 2688051443), turn 5: their Armarouge absorbed a Flamethrower on turn 3; on turn 5 its Armor
 *             Cannon KO'd our full-HP Sneasler. The world lays `_vol.flashfire`, and the engine's Armor Cannon (into our
 *             full-HP Volcarona, which survives it) hits about 1.5x harder with it than without. RED under noff.
 *   TYPEADD   ekohc (gen5ab 2688067676), turn 2: Trick-or-Treat added Ghost to our Hippowdon on turn 1, and Kowtow Cleave was
 *             super effective on it (turns 1 and 2). The world lays the added type, and the engine's Kowtow Cleave does
 *             about twice the damage it does to the plain Ground type. RED under notype.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
require('../arena/env.js');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const REL = flag('--release', 'eaa5becc54eb');

let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };

const ENGINE = require('../arena/engine.js').load(REL);
const API = ENGINE.API, M = API.M;
const T = require('../arena/teams.js');
const W = require('../rotom/world.js');
const WL = require('../rotom/world_log.js');
const LR = require('./ladder_replay.js');
const FX = path.join(__dirname, 'fixtures', 'rotom', 'postmortem');
const WB = W.create(API);
const hpOf = row => { const b = T.buildBody(M, row); return b ? b.st.hp : 100; };
const opp = s => (s === 'A' ? 'B' : 'A');
const acts = (S, s) => (s === 'A' ? S.actA : S.actB);
const team = (S, s) => (s === 'A' ? S.sfA.team : S.sfB.team);
const named = (list, re) => list.find(m => m && re.test(String(m.name)));

/* ---------------- IDENTITY ---------------- */
{
  const w = LR.worldAt(WB, { log: path.join(FX, 'yeetpheesh-alias.battle.txt'), me: 'p2', bring: [0, 1, 2, 4], cut: '|turn|7', hpOf });
  const arc = named(acts(w.S, w.side), /^arcanine/i);
  ok('IDENTITY', !!arc, 'our Arcanine-Hisui is not active in the turn-7 world');
  const laid = arc ? arc.tookProtectTurns | 0 : -1;
  ok('IDENTITY', laid === 1, 'Arcanine-Hisui consecutive-Protect counter ' + laid + ' (the server showed its Protect hold on turn 6; want 1)');
  /* the walk keys the forme to its own sheet row, and no other body of ours is marked active on its account */
  const lines = fs.readFileSync(path.join(FX, 'yeetpheesh-alias.battle.txt'), 'utf8').replace(/\r/g, '').split('\n');
  const L = WL.walk(lines.slice(0, lines.indexOf('|turn|7') + 1), w.replay.sheets);
  const activeP2 = [...L.bodies.entries()].filter(([k, b]) => k.startsWith('p2:') && b.active).length;
  ok('IDENTITY', activeP2 <= 2, 'the walk marks ' + activeP2 + ' of our bodies active at once (a switch keyed the incoming forme to the outgoing body)');
  ok('IDENTITY', L.counters.unmatched === 0, 'the walk left ' + L.counters.unmatched + ' idents unmatched');
  /* one engine step of that Protect, six seeds: the counter must make it fail on some (the server's did) */
  let failed = 0;
  if (arc) {
    const k = acts(w.S, w.side).indexOf(arc);
    const la = API.legalActions(w.S, w.side), lo = API.legalActions(w.S, opp(w.side));
    const j = la.joint.find(x => x[k] && x[k].kind === 'move' && x[k].move === 'protect');
    if (j) for (let seed = 1; seed <= 6; seed++) {
      const S2 = API.step(w.S, w.side === 'A' ? j : lo.joint[0], w.side === 'A' ? lo.joint[0] : j, API.makeRng(seed));
      const a2 = team(S2, w.side).find(m => m._solverSheet === arc._solverSheet);
      if (a2 && !a2.fainted && (a2.tookProtectTurns | 0) === 0) failed++;
    }
    ok('IDENTITY', !!j, 'the engine offers Arcanine-Hisui no Protect');
  }
  ok('IDENTITY', failed >= 1, 'Arcanine-Hisui\'s second Protect failed on ' + failed + ' of 6 engine seeds (the server\'s failed; a counter of 0 never fails)');
  console.log('  IDENTITY Arcanine-Hisui counter ' + laid + ', second Protect failed on ' + failed + '/6 seeds; walk: ' + activeP2 + ' of ours active, ' + L.counters.unmatched + ' unmatched');
}

/* ---------------- UNBURDEN ---------------- */
{
  const f = path.join(FX, 'sbsbsh-unburden.battle.txt');
  const w = LR.worldAt(WB, { log: f, me: 'p1', bring: [1, 3, 2, 5], cut: '|turn|2', hpOf });
  const sne = named(acts(w.S, opp(w.side)), /^sneasler/i), exc = named(acts(w.S, w.side), /^excadrill/i);
  const mult = WL.itemLossSpeed('unburden');
  ok('UNBURDEN', mult > 1, 'the dex gives Unburden no Speed multiplier (' + mult + ')');
  ok('UNBURDEN', sne && sne._ubVol === mult, 'their Sneasler _ubVol ' + (sne && sne._ubVol) + ' (it lost its item on turn 1; want ' + mult + ')');
  /* the server's order on turn 2: Sneasler's first move line before Excadrill's */
  const lines = fs.readFileSync(f, 'utf8').replace(/\r/g, '').split('\n');
  const i0 = lines.indexOf('|turn|2'), i1 = lines.indexOf('|turn|3');
  const first = re => lines.slice(i0, i1).findIndex(l => l.startsWith('|move|') && re.test(l));
  const sOrder = first(/\|move\|p2[ab]: Sneasler\|/), eOrder = first(/\|move\|p1[ab]: Excadrill\|/);
  ok('UNBURDEN', sOrder >= 0 && eOrder >= 0 && sOrder < eOrder, 'the fixture no longer shows Sneasler moving before Excadrill on turn 2');
  const sS = sne ? M.effSpeed(sne, w.S.field, opp(w.side)) : 0, sE = exc ? M.effSpeed(exc, w.S.field, w.side) : 0;
  ok('UNBURDEN', sS > sE, 'engine Speed Sneasler ' + sS + ' vs Excadrill ' + sE + ' (the server moved Sneasler first)');
  ok('UNBURDEN', WB.COUNTERS.ubLaid > 0, 'COUNTERS.ubLaid is 0');
  console.log('  UNBURDEN Sneasler _ubVol ' + (sne && sne._ubVol) + ' (dex x' + mult + '): engine Speed ' + sS + ' vs our Excadrill ' + sE + '; server order Sneasler first');
}

/* ---------------- FLASHFIRE ---------------- */
{
  const w = LR.worldAt(WB, { log: path.join(FX, 'pandywulu-flashfire.battle.txt'), me: 'p2', bring: [1, 5, 3, 2], cut: '|turn|5', hpOf });
  const arm = named(acts(w.S, opp(w.side)), /^armarouge/i);
  ok('FLASHFIRE', arm && arm._vol && arm._vol.flashfire === 1, 'their Armarouge _vol.flashfire ' + (arm && arm._vol && arm._vol.flashfire) + ' (it absorbed a Flamethrower on turn 3; want 1)');
  /* Armor Cannon, with and without the volatile, same seeds, into the body in our slot b (Volcarona at full HP, which
   * resists Fire and so survives the hit: the damage is read whole). Our side stays in, protects nothing and leaves
   * Armarouge alone so it moves. The server's own evidence is the turn-5 Armor Cannon that KO'd a full-HP Sneasler. */
  let withV = 0, without = 0, aimed = '';
  if (arm) {
    const ka = acts(w.S, opp(w.side)).indexOf(arm);
    const lo = API.legalActions(w.S, opp(w.side)), lm = API.legalActions(w.S, w.side);
    const jo = lo.joint.find(x => x[ka] && x[ka].kind === 'move' && x[ka].move === 'armorcannon' && x[ka].target === 2 && !(x[1 - ka] && x[1 - ka].kind === 'move' && x[1 - ka].target === 2));
    const jm = lm.joint.find(x => x.every(o => o && o.kind === 'move' && !/protect|detect/.test(o.move) && o.target != null && o.target !== ka + 1));
    const tgt = acts(w.S, w.side)[1]; aimed = tgt ? tgt.name + ' ' + tgt.curHP + '/' + tgt.st.hp : '';
    for (let seed = 1; seed <= 6 && jo && jm; seed++) {
      const run = S => { const S2 = API.step(S, w.side === 'A' ? jm : jo, w.side === 'A' ? jo : jm, API.makeRng(seed)); const b2 = team(S2, w.side).find(m => m._solverSheet === tgt._solverSheet); return b2 ? tgt.curHP - (b2.fainted ? 0 : b2.curHP) : 0; };
      const S1 = API.clone(w.S), S0 = API.clone(w.S); const a0 = acts(S0, opp(w.side))[ka]; if (a0._vol) delete a0._vol.flashfire;
      withV += run(S1); without += run(S0);
    }
    ok('FLASHFIRE', !!jo && !!jm, 'no Armor Cannon joint into our slot b, or no stay-in joint of ours, in the rebuilt menu');
  }
  ok('FLASHFIRE', without > 0 && withV >= 1.3 * without, 'Armor Cannon damage over 6 seeds with the volatile ' + withV + ', without ' + without + ' (the volatile is a 1.5x Fire boost; want at least 1.3x)');
  console.log('  FLASHFIRE Armarouge _vol.flashfire ' + (arm && arm._vol && arm._vol.flashfire) + '; Armor Cannon into our ' + aimed + ' over 6 seeds: ' + withV + ' HP with it, ' + without + ' without (x' + (without ? (withV / without).toFixed(2) : '?') + ')');
}

/* ---------------- TYPEADD ---------------- */
{
  const w = LR.worldAt(WB, { log: path.join(FX, 'ekohc-typeadd.battle.txt'), me: 'p2', bring: [4, 0, 1, 3], cut: '|turn|2', hpOf });
  const hip = named(acts(w.S, w.side), /^hippowdon/i), gam = named(acts(w.S, opp(w.side)), /^kingambit/i);
  const types = hip ? [...hip.types] : [];
  ok('TYPEADD', types.map(t => String(t).toLowerCase()).includes('ghost') && hip.types._added && String(hip.types._added).toLowerCase() === 'ghost', 'our Hippowdon types ' + JSON.stringify(types) + ' added ' + (hip && hip.types._added) + ' (Trick-or-Treat on turn 1; want Ghost added)');
  let dW = 0, dO = 0;
  if (hip && gam) {
    const kg = acts(w.S, opp(w.side)).indexOf(gam), kh = acts(w.S, w.side).indexOf(hip);
    const lo = API.legalActions(w.S, opp(w.side)), lm = API.legalActions(w.S, w.side);
    const jo = lo.joint.find(x => x[kg] && x[kg].kind === 'move' && x[kg].move === 'kowtowcleave' && x[kg].target === kh + 1 && !(x[1 - kg] && x[1 - kg].kind === 'move' && x[1 - kg].target === kh + 1));
    const jm = lm.joint.find(x => x[kh] && x[kh].kind === 'move' && !(x[1 - kh] && x[1 - kh].kind === 'switch')) || lm.joint[0];
    for (let seed = 1; seed <= 6 && jo; seed++) {
      const run = S => { const h = acts(S, w.side)[kh]; h.curHP = h.st.hp; const S2 = API.step(S, w.side === 'A' ? jm : jo, w.side === 'A' ? jo : jm, API.makeRng(seed)); const b = team(S2, w.side).find(m => m._solverSheet === hip._solverSheet); return b ? h.st.hp - (b.fainted ? 0 : b.curHP) : 0; };
      const S1 = API.clone(w.S), S0 = API.clone(w.S);
      const h0 = acts(S0, w.side)[kh]; const base = [...h0.types].filter(t => t !== h0.types._added); h0.types = base;
      dW += run(S1); dO += run(S0);
    }
    ok('TYPEADD', !!jo, 'no Kowtow Cleave joint into our Hippowdon in the rebuilt menu');
  }
  ok('TYPEADD', dO > 0 && dW >= 1.8 * dO, 'Kowtow Cleave into a full-HP Hippowdon over 6 seeds: ' + dW + ' with the added Ghost, ' + dO + ' without (the server showed it super effective; want about 2x)');
  console.log('  TYPEADD Hippowdon ' + JSON.stringify(types) + '; Kowtow Cleave over 6 seeds ' + dW + ' HP with Ghost added vs ' + dO + ' without (x' + (dO ? (dW / dO).toFixed(2) : '?') + ')');
}

console.log(fails ? `RED  ${fails} of ${checks} checks failed${process.env.ROTOM_WORLD_BREAK ? ' (ROTOM_WORLD_BREAK=' + process.env.ROTOM_WORLD_BREAK + ')' : ''}` : `GREEN  ${checks} checks`);
process.exit(fails ? 1 : 0);
