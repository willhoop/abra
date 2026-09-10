#!/usr/bin/env node
/* tests/probe_sucker_try_above_terrain.js — NARRATION, A MOVE'S OWN `Try` OUTRANKS THE TERRAIN BAR
 * ==================================================================================================
 * `singleEvent('Try')` IS A STEP ABOVE `runEvent('TryHit')`, SO SUCKER PUNCH REFUSES ITSELF BEFORE
 * PSYCHIC TERRAIN GETS TO REFUSE IT.
 *
 * THE AUTHORITY, read this run:
 *
 *   sim/battle-actions.ts:590   const hitResult = this.battle.singleEvent('Try', move, null, pokemon, targets[0], move) && ...
 *   sim/battle-actions.ts:592-596   if (!hitResult) { if (hitResult === false) {
 *                                     this.battle.add('-fail', pokemon); this.battle.attrLastMove('[still]'); } ... }
 *   sim/battle-actions.ts:559     this.hitStepTryHitEvent,        <- one of `moveSteps`, RUN BELOW the block above
 *   sim/battle-actions.ts:644       const hitResults = this.battle.runEvent('TryHit', targets, pokemon, move);
 *   data/moves.ts:18399         suckerpunch.onTry: if (!move || (move.category === 'Status' && ...) || mustrecharge) return false;
 *   data/moves.ts:14117-14131   psychicterrain.condition.onTryHitPriority: 4 / onTryHit -> this.add('-activate', target, 'move: Psychic Terrain')
 *
 * `moveSteps` is DECLARED above the `Try` gate and RUN below it, which is the one thing about that
 * function that reads backwards; the gate `return`s before the step loop, so a `false` from `onTry`
 * means `hitStepTryHitEvent` never runs and the terrain never speaks.
 *
 * THE MECHANISM, versus what the divergence card claimed. The card reads
 * `unrelated event mismatch :: |-fail|p2b <> |-activate|p1a|psychicterrain` — a LOCATION, and a
 * classification ("unrelated") that is wrong: the two lines are the same event, refused by two
 * different sources. This engine folds BOTH sources of the priority bar into one gate
 * (`priorityRefusedAbove`) placed at the `TryMove` position, which is right for the ABILITY half
 * (Queenly Majesty, Armor Tail and Dazzling all hang on `onFoeTryMove`, battle-actions.ts:486) and two
 * steps too early for the TERRAIN half. So a Sucker Punch that the game refuses for its own reason was
 * refused by the floor instead.
 *
 * ================= THE ARMS, AND WHY TWO OF THEM MUST STAY GREEN ================================
 *
 *   SUCKER-IDLE-TARGET   RED before the fix. Psychic Terrain is up and the aimed body has a STATUS
 *                        move queued, so Sucker Punch's own `onTry` returns false: `|-fail|<mover>`,
 *                        bare, with `[still]`, and NO terrain line. The pool card's own shape.
 *   SUCKER-ATTACKING     CONTROL, GREEN BEFORE AND AFTER. Same terrain, same bodies, but the aimed
 *                        body has an ATTACK queued — so `onTry` passes and the TERRAIN is what
 *                        refuses, writing `|-activate|<target>|move: Psychic Terrain`. A fix that
 *                        moved the terrain bar out of the way entirely breaks here and only here.
 *   SUCKER-NO-TERRAIN    CONTROL, GREEN BEFORE AND AFTER. No terrain, idle target: the bare `-fail`
 *                        with nothing else to compete with it. This is the knob-cleared arm — the
 *                        terrain is the only thing that varies against SUCKER-IDLE-TARGET.
 *
 * Every arm also asserts the BOARDS are identical at every boundary.
 *
 * ================= WHAT THIS PROBE READS RATHER THAN DERIVES ===================================
 *
 * §0 re-reads the `Try` gate, the `moveSteps` position of `hitStepTryHitEvent`, Sucker Punch's own
 * handler and Psychic Terrain's handler from the authority on every run. It also asserts this format
 * has NO Psychic Surge carrier, which is why the terrain has to be staged from the MOVE — a fact that
 * would otherwise be a silent assumption in the cast.
 *
 * RED-FIRST KNOB: `MEDI_TERRAIN_BAR_AT_TRYMOVE=1` puts the terrain half of the bar back at the
 * `TryMove` position, above the move's own `Try` — the engine exactly as it stood before this pass.
 * Under it SUCKER-IDLE-TARGET goes RED and both controls stay green. Any run carrying it also carries
 * `MEDFAILS.terrainBarAtTryMoveRestored`.
 *
 *   SHOWDOWN_PATH=... node tests/probe_sucker_try_above_terrain.js
 *   MEDI_TERRAIN_BAR_AT_TRYMOVE=1 SHOWDOWN_PATH=... node tests/probe_sucker_try_above_terrain.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '8');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_TERRAIN_BAR_AT_TRYMOVE === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_sucker_try_above_terrain.js — a move refuses itself before the terrain refuses it');
console.log('  MEDI_TERRAIN_BAR_AT_TRYMOVE=' + (KNOB ? '1  (PRE-FIX ENGINE: the terrain bar sits at TryMove)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const ACTIONS = read('/sim/battle-actions.ts');
const MOVES = read('/data/moves.ts');
const CH_MOVES = read('/data/mods/champions/moves.ts');
const CH_SCR = read('/data/mods/champions/scripts.ts');
const block = (src, id) => {
  const m = new RegExp('\\n\\t' + id + ': \\{\\n([\\s\\S]*?)\\n\\t\\},\\n').exec(src);
  return m ? m[1] : null;
};

console.log(NL + '0. THE AUTHORITY');
const iTry = ACTIONS.indexOf("const hitResult = this.battle.singleEvent('Try', move, null, pokemon, targets[0], move)");
const iStepRun = ACTIONS.indexOf('for (const step of moveSteps)');
const iTryHitDef = ACTIONS.indexOf('hitStepTryHitEvent(targets: Pokemon[], pokemon: Pokemon, move: ActiveMove)');
ok(iTry > 0 && iStepRun > 0 && iTry < iStepRun,
   "`singleEvent('Try')` is evaluated ABOVE the `moveSteps` loop that runs `hitStepTryHitEvent`",
   "Try gate at char " + iTry + ', step loop at char ' + iStepRun);
ok(iTryHitDef > 0 && /runEvent\('TryHit', targets, pokemon, move\)/.test(ACTIONS),
   '`hitStepTryHitEvent` is the `TryHit` runner, which is where a terrain hangs its refusal');
ok(/if \(!hitResult\) \{\s*\n\s*if \(hitResult === false\) \{\s*\n\s*this\.battle\.add\('-fail', pokemon\);\s*\n\s*this\.battle\.attrLastMove\('\[still\]'\);/.test(ACTIONS),
   'a `false` from `Try` writes the BARE `|-fail|<mover>` and `[still]`, then returns',
   (ACTIONS.slice(iTry, iTry + 480).match(/if \(!hitResult\)[\s\S]{0,300}/) || [''])[0]);
const SPk = block(MOVES, 'suckerpunch');
ok(!!SPk && /onTry\(source, target\) \{[\s\S]*?return false;/.test(SPk),
   "`suckerpunch.onTry` returns false — so it takes the generic bare line, not one of its own",
   (SPk || '').match(/onTry[\s\S]{0,300}/)[0]);
ok(!!SPk && /move\.category === 'Status'/.test(SPk),
   'and the clause this probe stages is "the target has a STATUS move queued"');
const PT = block(MOVES, 'psychicterrain');
ok(!!PT && /onTryHitPriority: 4,/.test(PT) && /this\.add\('-activate', target, 'move: Psychic Terrain'\);/.test(PT),
   "`psychicterrain.condition` hangs on `onTryHit` and announces `|-activate|<target>|move: Psychic Terrain`",
   (PT || '').match(/onTryHitPriority[\s\S]{0,420}/)[0]);
ok(!/\n\tsuckerpunch: \{/.test(CH_MOVES) && !/\n\tpsychicterrain: \{/.test(CH_MOVES),
   'Champions overrides neither `suckerpunch` nor `psychicterrain`');
ok(!/trySpreadMoveHit\(/.test(CH_SCR),
   'Champions does not override `trySpreadMoveHit`, so mainline IS the step order');

/* THE CAST IS FORCED BY THE REGULATION AND THAT IS ASSERTED, not assumed: with no Psychic Surge
 * carrier the terrain can only be staged from the MOVE, which is why arm 1 spends a turn on it. */
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const surge = dex.species.all().filter(legal)
  .filter(sp => Object.keys(sp.abilities).some(k => sp.abilities[k] === 'Psychic Surge'));
ok(surge.length === 0,
   'this regulation has ZERO Psychic Surge carriers, so the terrain is staged from the move',
   surge.map(s => s.name).join(', ') || '(none)');

/* ==================================================================================================
 * 1. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('  NOT STAGED — the top arm is not in ARM_BY_ID.'); process.exit(1); }
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const IDLE = { m: 'nastyplot' };

function play(tag, A, B, script, opts) {
  const a = G.buildPair(A, (opts && opts.optA) || undefined);
  const b = G.buildPair(B, (opts && opts.optB) || undefined);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_sucker_try_above_terrain :: ' + tag, {
    script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).slice(0, 4) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW/REJECTED: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  /* names compared with the spaces out — the authority writes `move: Psychic Terrain`, this engine
   * writes `move: psychicterrain`, and the whole-game differ normalises exactly that away */
  const flat = (l) => String(l).toLowerCase().replace(/[\s:,]/g, '');
  const keep = (s) => s.map(flat).filter(l => /^\|-fail\|/.test(l) || /^\|-activate\|[^|]*\|movepsychicterrain$/.test(l));
  return { staged: true, boards, sd, me, sdSeq: keep(sd), meSeq: keep(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* THE CAST. Mawile runs HYPER CUTTER rather than Intimidate so the switch-in writes nothing, and its
 * idle click is Swords Dance, a self-target that cannot reach the terrain question. Meowstic is
 * Psychic-typed and grounded, which is what makes it a body the terrain protects. */
const TERR = [mon('meowstic', '', 'Keen Eye', ['Psychic Terrain', 'Nasty Plot', 'Psychic']),
              mon('farigiraf', '', 'Cud Chew', ['Nasty Plot']),
              mon('sableye', '', 'Prankster', ['Nasty Plot']),
              mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const PUNCH = [mon('mawile', '', 'Hyper Cutter', ['Sucker Punch', 'Swords Dance']),
               mon('incineroar', '', 'Intimidate', ['Nasty Plot']),
               mon('milotic', '', 'Marvel Scale', ['Recover']),
               mon('garchomp', '', 'Rough Skin', ['Swords Dance'])];
const SD = { m: 'swordsdance' };
const SUCK = { m: 'suckerpunch', t: 0 };
const SET = { m: 'psychicterrain' };
const PSY = { m: 'psychic', t: 0 };

const IDLE_TGT = play('SUCKER-IDLE-TARGET', TERR, PUNCH, [
  { p1: [SET, IDLE], p2: [SD, IDLE] },
  { p1: [IDLE, IDLE], p2: [SUCK, IDLE] },
]);
const ATTACKING = play('SUCKER-ATTACKING', TERR, PUNCH, [
  { p1: [SET, IDLE], p2: [SD, IDLE] },
  { p1: [PSY, IDLE], p2: [SUCK, IDLE] },
]);
const NO_TERRAIN = play('SUCKER-NO-TERRAIN', TERR, PUNCH, [
  { p1: [IDLE, IDLE], p2: [SD, IDLE] },
  { p1: [IDLE, IDLE], p2: [SUCK, IDLE] },
]);

/* ==================================================================================================
 * 2. THE JUDGEMENT
 * ============================================================================================== */
console.log(NL + '1. THE ARMS');
const arms = [['SUCKER-IDLE-TARGET', IDLE_TGT], ['SUCKER-ATTACKING', ATTACKING], ['SUCKER-NO-TERRAIN', NO_TERRAIN]];
for (const [tag, R] of arms) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag);
  console.log('     showdown : ' + (R.sdSeq.join('   ') || '(no refusal line at all)'));
  console.log('     medicham : ' + (R.meSeq.join('   ') || '(no refusal line at all)'));
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(JSON.stringify(R.sdSeq) === JSON.stringify(R.meSeq),
     tag + ' — the two engines write the SAME refusal lines, in order',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

console.log(NL + '2. THE SHAPES THE ARMS EXIST FOR');
const has = (R, re) => R.sdSeq.some(l => re.test(l));
if (IDLE_TGT.staged) {
  ok(has(IDLE_TGT, /^\|-fail\|p2amawile$/) && !has(IDLE_TGT, /psychicterrain/),
     'SUCKER-IDLE-TARGET — the authority wrote the mover\'s OWN bare `-fail` and NO terrain line',
     IDLE_TGT.sdSeq.join(' | '));
}
if (ATTACKING.staged) {
  ok(has(ATTACKING, /^\|-activate\|p1ameowstic\|movepsychicterrain$/),
     'SUCKER-ATTACKING — with the target attacking, the TERRAIN is what refuses, and it still does '
     + '(the control that stops the bar being moved out of the way)', ATTACKING.sdSeq.join(' | '));
  ok(!has(ATTACKING, /^\|-fail\|p2amawile$/),
     'SUCKER-ATTACKING — and the mover writes no `-fail` of its own on that road');
}
if (NO_TERRAIN.staged) {
  ok(has(NO_TERRAIN, /^\|-fail\|p2amawile$/) && !has(NO_TERRAIN, /psychicterrain/),
     'SUCKER-NO-TERRAIN — the knob-cleared control: the same bare `-fail` with no terrain in play',
     NO_TERRAIN.sdSeq.join(' | '));
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
