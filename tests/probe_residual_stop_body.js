#!/usr/bin/env node
/* tests/probe_residual_stop_body.js — THE RESIDUAL WALK STOPS AT A BODY, NOT AT A GROUP
 *   node tests/probe_residual_stop_body.js        node tests/probe_residual_stop_body.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY HAS TWO LINES IN `Battle#fieldEvent`, AND IT IS THE PAIR THAT MATTERS:
 *
 *   a duration EXPIRY:   handler.end.call(...); if (this.ended) return; continue;   sim/battle.ts:516-524
 *   every other handler: this.faintMessages(); if (this.ended) return;              sim/battle.ts:565-566
 *
 * So an expiry that kills a side's last body does NOT end the battle at its own line — `Pokemon#faint`
 * only QUEUES — and the VERY NEXT handler drains the queue, ends the battle and stops the whole walk.
 *
 * THIS ENGINE STOPPED AT A GROUP. The group loop's own header called that "a DECLARED approximation
 * rather than a claim" and argued the cost away: *"within one group the difference is whether a
 * second body on the LOSING side also takes its own chip after the side is already dead — which
 * cannot change the outcome and cannot bring anybody in"*. **The argument is false and a board says
 * so.** The second body can be on the WINNING side, and then the difference is whether it lives.
 *
 * MEASURED, pinned pool, release `f8266a5c48b7`, `pair-redirect-priority ...bo3-2661747717` turn 6 —
 * a board-material game. Three bodies carry a perish clock at order 24, in speed order
 * Gengar(0) / Basculegion(3) / Annihilape(0):
 *
 *     showdown   |-start|p2b: Gengar|perish0   |-start|p1a: Basculegion|perish3
 *                |faint|p2b: Gengar   |win|A                 <- ANNIHILAPE NEVER TICKS
 *     medicham   ... |-start|p1b: Annihilape|perish0   |faint|p2b: Gengar   |faint|p1b: Annihilape
 *
 * parting `p1.party.annihilape.fainted  medi true / sd false` — a body that lives in the real game
 * and dies here. Instrumented on the AUTHORITY at that boundary: `battle.ended === true` while
 * Annihilape still holds `perishsong {duration: 1}`.
 *
 * WHAT THE `_expiryQueuedFaint` ASYMMETRY BUYS, because without it this fix would be a new defect
 * wearing the old one's name: stopping on Gengar's OWN line would lose Basculegion's `perish3`, which
 * the authority does emit. The stop belongs to the next NON-expiry handler.
 *
 * RED FIRST: `MEDI_RESIDUAL_STOP_GROUP_ONLY=1` restores the group-only granularity.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_RESIDUAL_STOP_GROUP_ONLY = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const PIN_GAMES = 1200;
process.argv.push('--steering', 'empirical', '--arm', 'middle', '--state', '--end-state',
                  '--games', String(PIN_GAMES), '--turns', '20',
                  '--team-store', D('data', 'team-pool-frozen'),
                  '--census', D('data', 'verification', 'census-pin-9446a684709d.json'));
const G = require(D('engine', 'game_differential.js'));
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');
let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};
console.log(NL + (RED ? 'RED ARM — MEDI_RESIDUAL_STOP_GROUP_ONLY=1 (the engine as it stood before the fix)'
                      : 'CLEAN ARM'));

/* ---- A. THE EXPIRY THAT FAINTS, DERIVED --------------------------------------------------------- */
console.log(NL + 'A. THE HANDLER THAT MAKES THIS REACHABLE');
{
  const ps = dex.moves.get('perishsong');
  const c = ps && ps.condition;
  const end = String(c && c.onEnd || '');
  console.log('  perishsong.condition: duration=' + (c && c.duration)
    + ' onResidualOrder=' + (c && c.onResidualOrder));
  console.log('  perishsong.condition.onEnd, READ: ' + end.replace(/\s+/g, ' '));
  claim(!!c && c.duration === 4 && c.onResidualOrder === 24,
    'the clock is a DURATION on a residual-ordered condition — which is what makes it an EXPIRY '
      + 'handler and not an ordinary one', 'duration=' + (c && c.duration)
      + ' onResidualOrder=' + (c && c.onResidualOrder));
  claim(/\.faint\(\s*\)/.test(end),
    'and its expiry FAINTS the holder, which is the only way an expiry can end a battle',
    end.replace(/\s+/g, ' '));
  /* THE WHOLE LEGAL FAMILY, printed rather than assumed — a second residual expiry that faints would
   * reach the same branch and should be visible here rather than discovered later. */
  const fam = [];
  for (const m of dex.moves.all()) {
    if (!m.exists || m.isNonstandard || m.tier === 'Illegal') continue;
    const cc = m.condition;
    if (!cc || !cc.duration || cc.onResidualOrder === undefined) continue;
    if (/\.faint\(\s*\)/.test(String(cc.onEnd || ''))) fam.push(m.id + '@' + cc.onResidualOrder);
  }
  console.log('  every legal move whose residual EXPIRY faints, DERIVED: ' + (fam.join(', ') || '(none)'));
}

/* ---- B. THE WORKED EXAMPLE ---------------------------------------------------------------------- */
console.log(NL + 'B. THE BOARD-MATERIAL POOL GAME');
const W = { cfg: 'pair-redirect-priority', turn: 6,
            tag: 'gen9championsvgc2026regmbbo3-2661747717 vs gen9championsvgc2026regmbbo3-2661834987',
            leaves: ['p1.party.annihilape.fainted'] };
/* THE TWO GAMES THE FIRST VERSION OF THIS FIX BROKE, CARRIED AS CONTROLS. They are not hypothetical:
 * the first version asked only `sideWiped(S)` after every BODY and the 961-game pinned run answered
 * BOARD-MATERIAL **9 -> 10** — it closed W and opened these two, both `p1.screens.special medi 4 /
 * sd 3`, a Light Screen turn the authority spends and this engine threw away. `residualOrder` walks
 * every live body for every group, so a group has iterations with NO handler to run and the authority
 * has nothing there to call `faintMessages()` after. Both must hold on BOTH arms. */
const CONTROL_GAMES = [
  { cfg: 'omit-spread',
    tag: 'gen9championsvgc2026regmbbo3-2654567638 vs gen9championsvgc2026regmbbo3-2654612503',
    why: 'one perish expiry, then a side condition the authority still ticks' },
  { cfg: 'omit-spread',
    tag: 'gen9championsvgc2026regmbbo3-2661861148 vs gen9championsvgc2026regmbbo3-2661855904',
    why: 'the same shape with a single clocked body — the stop must not fire at all' },
];
{
  const SW = SWARM.buildSwarm(PIN_GAMES * 2, { storeDir: D('data', 'team-pool-frozen') });
  for (const CG of CONTROL_GAMES) {
    const cc = SW.out.find(x => x.config === CG.cfg);
    const [ia, ib] = CG.tag.split(' vs ');
    const tta = cc && cc.picked_teams.find(t => t.id === ia);
    const ttb = cc && cc.picked_teams.find(t => t.id === ib);
    if (!tta || !ttb) { claim(false, 'CONTROL pair is in the PINNED pool: ' + CG.tag, 'fixture fault'); continue; }
    const r = G.playGame(G.buildPair(tta.team), G.buildPair(ttb.team), CG.cfg, CG.tag,
                         { driverSeed: CG.cfg + '|' + CG.tag });
    claim(!r.stateDiv, 'CONTROL — ' + CG.why + ': boards agree   [must hold on BOTH arms]',
      r.stateDiv ? 'PARTED at t' + r.stateDiv.turn + ' ' + JSON.stringify(r.stateDiv.diffs.map(d =>
        d.path + ' medi ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown)))
                 : 'identical at every boundary');
  }
  const c = SW.out.find(x => x.config === W.cfg);
  const [ida, idb] = W.tag.split(' vs ');
  const ta = c && c.picked_teams.find(t => t.id === ida);
  const tb = c && c.picked_teams.find(t => t.id === idb);
  if (!ta || !tb) claim(false, 'the pair is in the PINNED pool', 'a FIXTURE fault, not a mechanic claim');
  else {
    const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
    const r = G.playGame(a, b, W.cfg, W.tag, { driverSeed: W.cfg + '|' + W.tag });
    const diffs = r.stateDiv ? r.stateDiv.diffs.map(d => d.path) : [];
    console.log('  replay: turns=' + r.turns + '  boardDiv=' + (r.stateDiv ? 't' + r.stateDiv.turn : 'none')
      + '  protoDiv=' + (r.div ? r.div.index : 'none') + '  err=' + (r.err || '-'));
    if (r.stateDiv) console.log('  board diffs: ' + JSON.stringify(r.stateDiv.diffs.map(d =>
      d.path + ' medi ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown))));
    /* THE AUTHORITY'S OWN LAST TURN, so the claim below is readable rather than asserted. */
    const sd = G.lastSdLog();
    const perish = sd.filter(l => /^\|-start\|.*\|perish\d/.test(String(l)));
    console.log('  the authority\'s perish lines this game: ' + JSON.stringify(perish.slice(-4)));
    if (RED) {
      claim(!!r.stateDiv && r.stateDiv.turn === W.turn,
        'the published game PARTS its board at t' + W.turn + '   [--red: must PART]',
        r.stateDiv ? 'parted at t' + r.stateDiv.turn : 'boards identical — the knob did not reach it');
      claim(W.leaves.every(L => diffs.includes(L)),
        'and it parts on the leaf the artifact records',
        'want ' + JSON.stringify(W.leaves) + ' got ' + JSON.stringify(diffs));
      claim((M.MEDFAILS.residualStopGroupOnlyRestored || 0) === 1,
        'the revert knob was actually READ — the clause under test was REACHED',
        'MEDFAILS.residualStopGroupOnlyRestored = ' + (M.MEDFAILS.residualStopGroupOnlyRestored || 0));
    } else {
      claim(!r.stateDiv, 'the published game agrees at every boundary',
        r.stateDiv ? 'STILL PARTS at t' + r.stateDiv.turn + ': ' + JSON.stringify(diffs)
                   : 'identical at every boundary');
      claim(!r.div, 'and its protocol streams agree end to end',
        r.div ? 'protocol parted at index ' + r.div.index : 'no protocol divergence');
      claim((M.MEDSEEN.turnEndedSideWipedMidGroup || 0) >= 1,
        'the new per-body stop FIRED — a zero would make the two claims above vacuous',
        'MEDSEEN.turnEndedSideWipedMidGroup = ' + (M.MEDSEEN.turnEndedSideWipedMidGroup || 0)
          + ', drains at that boundary = ' + (M.MEDSEEN.faintDrainResidualBody || 0));
    }
  }
}

/* ---- C. THE SILENT CONTROLS — the ordinary residual must not move ------------------------------- */
console.log(NL + 'C. THE CONTROLS — a residual that ends a turn WITHOUT the new boundary mattering');
{
  const mk = (sp, it, ab, mv) => ({ species: sp, item: it, ability: ab, moves: mv });
  const P = { m: 'protect' };
  /* EVERY STAGED ENTITY IS CHECKED AGAINST THE FORMAT. The first draft of the burn arm carried a
   * Flame Orb, which this regulation marks `isNonstandard: 'Past'` — the arm then read as an engine
   * that never burns its holder, and the engine was innocent. */
  const legalEnt = (kind, id) => { const e = dex[kind].get(id);
    return !!(e && e.exists && !e.isNonstandard && e.tier !== 'Illegal'); };
  const CASES = [
    /* THERE IS NO STAGED "ORDINARY WIPE" ARM HERE, AND THE REASON IS WRITTEN DOWN RATHER THAN LEFT
     * AS AN ABSENCE. Wiping a side needs FOUR bodies taken off it, `buildPair` refuses a side of
     * fewer than four, and the only residual chip slow enough to script is a burn at 1/16 — which
     * runs past the filler's Protect PP before it kills anything. Two drafts of that arm failed on
     * the FIXTURE (an `isNonstandard: 'Past'` Flame Orb, then a spent Protect) and neither said
     * anything about the engine.
     *
     * THE OVER-FIRE CONTROL FOR THE ORDINARY WIPE IS THE 961-GAME PINNED MEASUREMENT, which is run
     * for this change alone and reported with it: if the new per-body stop fired where the authority
     * keeps walking, BOARD-MATERIAL goes UP. That is a stronger statement than one staged board and
     * it is the number this batch publishes.
     *
     * WHAT IS STAGED HERE is the arm that isolates the ASYMMETRY: the same expiry handler on a board
     * where nobody runs out of bodies. It must hold on BOTH arms. */
    { name: 'CONTROL  a PERISH that kills without wiping a side',
      what: 'The same expiry handler on a board where nobody runs out of bodies. The walk must run '
          + 'to its end on BOTH arms — this is the arm that says the stop is a STOP and not a new '
          + 'rule about perish.',
      p1: [mk('gengar', '', 'Cursed Body', ['Perish Song', 'Protect']),
           mk('kingambit', '', 'Defiant', ['Protect']),
           mk('incineroar', '', 'Intimidate', ['Protect']),
           mk('milotic', '', 'Marvel Scale', ['Protect'])],
      p2: [mk('tyranitar', '', 'Sand Stream', ['Protect']),
           mk('kommoo', '', 'Overcoat', ['Protect']),
           mk('incineroar', '', 'Intimidate', ['Protect']),
           mk('milotic', '', 'Marvel Scale', ['Protect'])],
      script: [{ p1: [{ m: 'perishsong' }, P], p2: [P, P] },
               { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] },
               { p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }] },
  ];
  for (const c of CASES) {
    let illegal = [];
    for (const side of [c.p1, c.p2]) for (const m of side) {
      if (!legalEnt('species', m.species)) illegal.push('species:' + m.species);
      if (m.item && !legalEnt('items', m.item)) illegal.push('item:' + m.item);
      for (const mv of m.moves) if (!legalEnt('moves', mv)) illegal.push('move:' + mv);
    }
    claim(!illegal.length, c.name.slice(0, 22).trim() + ' — every staged entity is IN the regulation',
      illegal.length ? 'NOT IN THIS FORMAT: ' + illegal.join(', ') : 'all legal');
    if (illegal.length) continue;
    const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
    if (!a || !b) { claim(false, c.name + ' — staged', 'buildPair refused'); continue; }
    const r = G.playGame(a, b, 'directed', 'probe_residual_stop_body :: ' + c.name,
                         { script: c.script, arm: ARM });
    if (r.err) { claim(false, c.name + ' — played', 'THREW ' + r.err); continue; }
    const sd = G.lastSdLog();
    const faints = sd.filter(l => /^\|faint\|/.test(String(l))).length;
    const burns = sd.filter(l => /^\|-status\|p2[ab]: [^|]+\|brn/.test(String(l))).length;
    if (c.wantBurns) claim(burns === c.wantBurns,
      c.name.slice(0, 22).trim() + ' — the AUTHORITY burned BOTH bodies, so two chips really share '
        + 'the group', 'want ' + c.wantBurns + ' `-status ... brn` line(s), got ' + burns
        + ' (Will-O-Wisp is 85 accuracy; a miss is a FIXTURE fault and is reported as one)');
    console.log(NL + '  ' + c.name);
    console.log('    ' + c.what);
    console.log('    authority |faint| lines: ' + faints + '   board: '
      + (r.stateDiv ? 'PARTED at t' + r.stateDiv.turn + ' ' + JSON.stringify(r.stateDiv.diffs)
                    : 'identical at every boundary'));
    claim(faints > 0, c.name.slice(0, 22).trim() + ' — the AUTHORITY actually killed something here',
      'a zero makes the agreement below vacuous');
    claim(!r.stateDiv, c.name.slice(0, 22).trim() + ' — the boards agree   [must hold on BOTH arms]',
      r.stateDiv ? 'parted at t' + r.stateDiv.turn : 'identical at every boundary');
  }
}

console.log('');
if (!RED) claim((M.MEDFAILS.residualStopGroupOnlyRestored || 0) === 0,
  'no revert knob is in play on the clean arm',
  'MEDFAILS.residualStopGroupOnlyRestored = ' + (M.MEDFAILS.residualStopGroupOnlyRestored || 0));

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed' : 'GREEN — every claim held'));
process.exit(fails ? 1 : 0);
