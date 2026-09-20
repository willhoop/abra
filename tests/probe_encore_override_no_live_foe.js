#!/usr/bin/env node
/* tests/probe_encore_override_no_live_foe.js — ENCORE FORCES THE MOVE WITH THE FIELD EMPTY.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_encore_override_no_live_foe.js
 *   SHOWDOWN_PATH=... MEDI_ENCORE_OVERRIDE_NEEDS_A_LIVE_FOE=1 node tests/probe_encore_override_no_live_foe.js  (must exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * `BattleActions#runMove` (sim/battle-actions.ts:227-234), in full:
 *
 *     if (baseMove.id !== 'struggle' && !zMove && !maxMove && !externalMove) {
 *       const changedMove = this.battle.runEvent('OverrideAction', pokemon, target, baseMove);
 *       if (changedMove && changedMove !== true) {
 *         baseMove = this.dex.getActiveMove(changedMove);
 *         baseMove.priority = priority;
 *         if (pranksterBoosted) baseMove.pranksterBoosted = pranksterBoosted;
 *         target = this.battle.getRandomTarget(pokemon, baseMove);
 *       }
 *     }
 *
 * THERE IS NO FOE CLAUSE. The override runs on the move; the foe question belongs to the TARGET
 * only, and `getRandomTarget` answers it without a foe for half the target classes:
 *
 *     getRandomTarget(pokemon, move) {                                     sim/battle.ts:2487
 *       if (['self','all','allySide','allyTeam','adjacentAllyOrSelf'].includes(move.target)) return pokemon;
 *       ...
 *       return pokemon.side.randomFoe() || pokemon.side.foe.active[0];
 *     }
 *
 * — `self` and `all` return the user, and even the far-side road falls back to `foe.active[0]`
 * rather than declining. Champions overrides `encore`'s condition (data/mods/champions/moves.ts:286)
 * and overrides neither of these two functions.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `engine/medicham2-browser.js`'s execution-time Encore override (WIRE 143) was wrapped in
 *
 *     const _efoes = ..., _elive = live(_efoes);
 *     if (_elive.length) { ...the whole override... }
 *
 * so a body whose foes had ALL FAINTED earlier in the same turn played THE MOVE ITS PLAYER PICKED
 * instead of the move Encore forces. The gate was written for the random-target draw and swallowed
 * the override with it — a silent default that looks exactly like a working feature.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * Row 9 of the NINE board partings in the held-out 12,000-game draw on release `51b80f9fcf08`
 * (`data/verification/game-differential.g12000.json`):
 *
 *     pair-speedctrl  …bo3-2663796709 vs …bo3-2663795844   turn 10
 *       Whimsicott Encores a Meowstic that has Trick Room standing; Primarina then KOs BOTH p1
 *       bodies with Hyper Voice before Meowstic moves.
 *       showdown  |move|p2a: Meowstic|Trick Room|p2a: Meowstic   -> |-fieldend|move: Trick Room
 *       medicham  |move|p2a: Meowstic|psychic|p2a: Meowstic|[notarget]  -> |-fail|
 *       -> field.trickroom_turns  3 here, 0 there; p2.pp[0].trickroom 1 here, 2 there
 *
 * ================= THE FIXTURE ===================================================================
 *
 * One turn of set-up and then the turn that matters, all four clicks scripted:
 *
 *   turn 1  the TARGET clicks X (a self-aimed status move), so Encore has something to lock.
 *   turn 2  the ENCORER clicks Encore at the TARGET       -- lands
 *           the SACRIFICE clicks Healing Wish             -- faints itself
 *           the GAMBIT (the TARGET's own ALLY) clicks Final Gambit at the ENCORER
 *                                                         -- a damageCallback KO, and faints itself
 *           the TARGET clicks Y, with no living foe left on the field.
 *
 * Final Gambit deals `pokemon.hp` and is not a damage-formula roll, so the KO is certain once the
 * user's HP exceeds the target's; the probe checks that and refuses to stage otherwise. Both engines
 * are asked the same board and the same script.
 *
 * ================= THE ARMS ======================================================================
 *
 *   CONTROL   the identical board with the GAMBIT clicking a self-hold instead, so the ENCORER
 *             survives and a foe is standing. Encore must force X in BOTH engines — that is what
 *             says the fixture can see an override at all, and that the emptied field is the one
 *             varied thing. Identical results across a varied knob mean the knob is unwired.
 *   EMPTY     the field is cleared. Encore must still force X, and the two streams must not part.
 *   KNOB      a reload under MEDI_ENCORE_OVERRIDE_NEEDS_A_LIVE_FOE=1. In the EMPTY arm the TARGET
 *             must go back to playing Y. A knob that changes nothing is reported RED.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const KNOB = 'MEDI_ENCORE_OVERRIDE_NEEDS_A_LIVE_FOE';
const KNOB_SET = process.env[KNOB] === '1';
if (KNOB_SET) {
  console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so the EMPTY arm is expected to');
  console.log('  FAIL and this run MUST exit 1. The internal knob arm is skipped.');
}

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
const ARG = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_encore_override_no_live_foe.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

process.argv.push('--state');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else if (!KNOB_SET) delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

let bad = 0;
console.log(NL + '  === THE AUTHORITY, GREPPED THIS RUN ===');
{
  const fs = require('fs');
  const SP = process.env.SHOWDOWN_PATH;
  const ba = fs.readFileSync(path.join(SP, 'sim', 'battle-actions.ts'), 'utf8');
  const bt = fs.readFileSync(path.join(SP, 'sim', 'battle.ts'), 'utf8');
  const sc = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'scripts.ts'), 'utf8');
  const i = ba.indexOf("runEvent('OverrideAction'");
  const block = i < 0 ? '' : ba.slice(ba.lastIndexOf('if (', i), ba.indexOf('}', ba.indexOf('getRandomTarget', i)) + 1);
  console.log('    runMove\'s OverrideAction block, verbatim:');
  block.split(NL).forEach(l => console.log('      ' + l.trim()));
  const gi = bt.indexOf('getRandomTarget(pokemon: Pokemon');
  const gblock = gi < 0 ? '' : bt.slice(gi, gi + 1400);
  const nearSide = (gblock.match(/if \(\[([^\]]*)\]\.includes\(move\.target\)\) \{\s*\n\s*return pokemon;/) || [])[1];
  console.log('    getRandomTarget returns the USER for : ' + (nearSide || 'NOT FOUND'));
  console.log('    ...and its far-side fallback is      : '
    + ((gblock.match(/(pokemon\.side\.randomFoe\(\)[^;]*)/) || [])[1] || 'NOT FOUND'));
  console.log('    champions overrides runMove?         : ' + /\brunMove\s*\(/.test(sc));
  if (/live|fainted|foes\(\)\.length/.test(block)) {
    console.log('    THE AUTHORITY GATES THE OVERRIDE ON A LIVING FOE — this probe asserts something');
    console.log('    the simulator does not say, and is WRONG rather than the engine.'); bad++;
  } else if (!block) { console.log('    COULD NOT READ THE BLOCK.'); process.exit(2); }
  else console.log('    -> no foe clause anywhere in the override. It runs on the MOVE.');
}

/* ---- THE POPULATIONS, PRINTED BEFORE ANYTHING IS WIRED TO THEM -------------------------------- */
console.log(NL + '  === THE FIXTURE, DERIVED THIS RUN ===');
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const G0 = harness(false);
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .filter(s => !G0.CLOSET_SPECIES.has(norm(s.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
/* Nothing that changes who moves, refuses a status move, redirects, or rewrites a type. */
const QUIET = new Set(['refusesStatusMoves', 'reflectsStatusMoves', 'statusImmune', 'redirects',
  'speedMultiplier', 'priorityBoostStatus', 'onSwitchInDrop', 'refusesDrops', 'protectsAllyFromStatus',
  'allyRefusesStatus', 'copiesAbilityOnEntry', 'changesOwnType', 'tracesAbility']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => QUIET.has(t)));

/* A self-aimed status move with no volatile, no charge and no pivot — the inert click every filler
 * and both set-up turns use, and the pair the TARGET is Encored between. */
const SELF_MOVES = (s) => Object.keys(LS(s)).filter(k => {
  const m = dex.moves.get(k);
  /* `slotCondition` and `selfdestruct` are how Healing Wish and the explosion family are READ rather
   * than named: a hold whose user faints would empty the field in the CONTROL arm too, which is the
   * one thing the two arms must differ on. Healing Wish is itself a `self` status move and was the
   * first one this filter handed back for its own sacrifice, collapsing that body to one move slot. */
  /* THE HOLD MAY NOT TOUCH SPEED OR EVASION. A hold that boosts `spe` re-orders the very turn this
   * probe is about — the Gambit user outsped the Encorer and killed it before Encore ever landed —
   * and one that boosts `evasion` can make the Gambit MISS, which would empty nothing. */
  const B = m.boosts || null;
  if (B && (B.spe || B.evasion || B.accuracy)) return false;
  return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
    && !!m.boosts && m.priority === 0
    && !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.flags.failencore
    && !m.slotCondition && !m.selfdestruct
    && !m.volatileStatus && !m.sideCondition && !m.pseudoWeather && !m.weather && !m.terrain;
});
const SELF_HOLD = (s) => SELF_MOVES(s)[0] || null;

const FG = POOL.filter(s => LEARNS(s, 'finalgambit') && SELF_HOLD(s) && okAbility(s))
  .sort((a, b) => b.baseStats.hp - a.baseStats.hp)[0];
const SAC = POOL.filter(s => LEARNS(s, 'healingwish') && SELF_HOLD(s) && okAbility(s))
  .sort((a, b) => b.baseStats.spe - a.baseStats.spe)[0];
console.log('    legal Final Gambit users : ' + POOL.filter(s => LEARNS(s, 'finalgambit')).map(s => s.name).join(', '));
console.log('    legal Healing Wish users : ' + POOL.filter(s => LEARNS(s, 'healingwish')).map(s => s.name).join(', '));
if (!FG || !SAC) { console.log('    A POPULATION IS EMPTY — a claim about the format, not the engine.'); process.exit(2); }

/* THE ENCORER must be killable by Final Gambit (not Ghost — `hitStepTypeImmunity` is the one thing a
 * damageCallback still answers to) and must have LESS max HP than the Gambit user, so the KO is
 * arithmetic rather than a roll. Base HP stands in for max HP: both bodies are built by the same
 * builder at the same level, so the ordering carries. */
const ENC = POOL.filter(s => LEARNS(s, 'encore') && SELF_HOLD(s) && okAbility(s)
  && !s.types.map(norm).includes('ghost')
  && s.baseStats.hp + 25 < FG.baseStats.hp
  && s.baseStats.spe > 60)
  .sort((a, b) => b.baseStats.spe - a.baseStats.spe)[0];
/* THE TARGET must be SLOWER than all three of them, and must carry two distinct encorable self
 * moves so the click on turn 2 differs from the move Encore locks. */
const TGT = POOL.filter(s => s !== ENC && s !== FG && s !== SAC && okAbility(s)
  && SELF_MOVES(s).length >= 2
  && s.baseStats.spe + 30 < Math.min(ENC ? ENC.baseStats.spe : 0, FG.baseStats.spe, SAC.baseStats.spe))
  .sort((a, b) => a.baseStats.spe - b.baseStats.spe)[0];
if (!ENC || !TGT) { console.log('    COULD NOT STAGE — no encorer/target pair with the speed and HP ordering.'); process.exit(2); }

const [X, Y] = SELF_MOVES(TGT);
const FILL = POOL.filter(s => ![ENC.name, TGT.name, FG.name, SAC.name].includes(s.name) && SELF_HOLD(s)).slice(0, 4);
if (FILL.length < 4) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log(NL + '    the ENCORER   p1a : ' + ENC.name + ' [' + okAbility(ENC) + ']  hp ' + ENC.baseStats.hp + ' spe ' + ENC.baseStats.spe);
console.log('    the SACRIFICE p1b : ' + SAC.name + ' [' + okAbility(SAC) + ']  spe ' + SAC.baseStats.spe + '  (Healing Wish)');
console.log('    the TARGET    p2a : ' + TGT.name + ' [' + okAbility(TGT) + ']  spe ' + TGT.baseStats.spe
  + '  locks ' + X + ', then clicks ' + Y);
console.log('    the GAMBIT    p2b : ' + FG.name + ' [' + okAbility(FG) + ']  hp ' + FG.baseStats.hp + ' spe ' + FG.baseStats.spe);
console.log('    AUTHORITY    : Encore forces ' + X + ' with the field empty');
console.log('    DEFECT       : the override was gated on a living foe, so ' + Y + ' is played' + NL);

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, moves, ability) => ({ species, item: '', ability: ability || '', moves });
const NAME = id => dex.moves.get(id).name;
const sides = () => ([
  [mon(ENC.name, [NAME('encore'), SELF_HOLD(ENC)], okAbility(ENC)),
   mon(SAC.name, [NAME('healingwish'), SELF_HOLD(SAC)], okAbility(SAC)),
   mon(FILL[0].name, [SELF_HOLD(FILL[0])]), mon(FILL[1].name, [SELF_HOLD(FILL[1])])],
  [mon(TGT.name, [NAME(X), NAME(Y)], okAbility(TGT)),
   mon(FG.name, [NAME('finalgambit'), SELF_HOLD(FG)], okAbility(FG)),
   mon(FILL[2].name, [SELF_HOLD(FILL[2])]), mon(FILL[3].name, [SELF_HOLD(FILL[3])])],
]);
const script = (clearTheField) => ([
  /* turn 1 — the TARGET's lastMove becomes X. The ENCORER holds: an Encore clicked here would have
   * nothing to lock, and a click this engine cannot BUILD ends the game at the lead board. */
  { p1: [{ m: norm(SELF_HOLD(ENC)) }, { m: norm(SELF_HOLD(SAC)) }],
    p2: [{ m: norm(X) }, { m: norm(SELF_HOLD(FG)) }] },
  /* turn 2 — Encore lands, and in the EMPTY arm both p1 bodies are gone before the TARGET moves */
  { p1: [{ m: 'encore', t: 0 }, clearTheField ? { m: 'healingwish' } : { m: norm(SELF_HOLD(SAC)) }],
    p2: [{ m: norm(Y) }, clearTheField ? { m: 'finalgambit', t: 0 } : { m: norm(SELF_HOLD(FG)) }] },
]);
const spent = (pp, id) => (pp && pp[norm(id)] != null ? pp[norm(id)] : 0);
function play(G, clearTheField, tag) {
  const [SA, SB] = sides();
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'encorenofoe/' + tag, {
    arm: G.ARM_BY_ID.get('top-tie-first'),
    script: script(clearTheField),
    onBoundary: (snap) => seen.push({
      meX: spent(snap.medi.sides.p2.pp[0], X), meY: spent(snap.medi.sides.p2.pp[0], Y),
      sdX: spent(snap.sd.sides.p2.pp[0], X), sdY: spent(snap.sd.sides.p2.pp[0], Y),
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  /* `seen[0]` is the LEAD board, before turn 1 — three boundaries for a two-turn script. The board
   * that carries the answer is the last one. */
  if (seen.length < 3) return { staged: false, why: 'only ' + seen.length + ' turn boundary(ies) reached' };
  return { staged: true, M: seen[seen.length - 1], sd: G.sdStream(G.lastSdLog()),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}
const show = (R) => {
  console.log('      ' + X + ' uses   me ' + R.M.meX + '   sd ' + R.M.sdX);
  console.log('      ' + Y + ' uses   me ' + R.M.meY + '   sd ' + R.M.sdY);
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
  else console.log('      streams agree for the whole game');
};

/* ---- ARM 1: CONTROL. A foe is standing; the override must already work. ------------------------ */
console.log('  --- CONTROL (a foe still standing): Encore forces ' + X + ' ---');
let controlClean = null;
{
  const R = play(harness(false), false, 'control');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  controlClean = R;
  show(R);
  if (R.div) { console.log('      RED — the two engines part on the control board.'); bad++; }
  else if (R.M.sdX !== 2 || R.M.sdY !== 0) {
    console.log('      RED — the AUTHORITY did not force ' + X + ' on turn 2 (' + R.M.sdX + '/' + R.M.sdY
      + '). THE FIXTURE CANNOT SEE AN OVERRIDE, so the EMPTY arm would pass for the wrong reason.'); bad++;
  } else if (R.M.meX !== 2 || R.M.meY !== 0) {
    console.log('      RED — this engine did not force ' + X + ' even with a foe standing.'); bad++;
  } else console.log('      ok — both engines play ' + X + ' twice and never play ' + Y);
}

/* ---- ARM 2: EMPTY. The claim. ------------------------------------------------------------------ */
console.log(NL + '  --- EMPTY (both foes fainted first): Encore still forces ' + X + ' ---');
let emptyClean = null;
{
  const R = play(harness(false), true, 'empty');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  emptyClean = R;
  /* THE FIXTURE HAS TO HAVE EMPTIED THE FIELD, AND THAT IS READ OFF THE AUTHORITY'S OWN STREAM
   * rather than assumed from the script: two faints on p1, both above the TARGET's move line. */
  const S = R.sd || [];
  const t2 = S.findIndex(l => /^\|turn\|2/.test(l));
  const after = t2 < 0 ? [] : S.slice(t2);
  const mvI = after.findIndex(l => /^\|move\|p2a/.test(l));
  const faints = after.slice(0, mvI < 0 ? after.length : mvI).filter(l => /^\|faint\|p1[ab]/.test(l)).length;
  const encored = S.some(l => /^\|-start\|p2a[^|]*\|Encore/i.test(l));
  if (!encored || faints < 2) {
    console.log('      NOT STAGED — the authority\'s own stream shows Encore=' + encored
      + ' and ' + faints + ' p1 faint(s) above the target\'s turn-2 move. The fixture did not');
    console.log('      empty the field, so nothing below would be about the gate.'); process.exit(2);
  }
  console.log('      (the authority\'s stream: Encore landed, ' + faints + ' p1 bodies fainted above the target\'s move)');
  show(R);
  if (R.div) { console.log('      RED — the streams part with the field empty.'); bad++; }
  if (R.M.sdX !== 2 || R.M.sdY !== 0) {
    console.log('      RED — the AUTHORITY played ' + Y + ' with the field empty. This probe is wrong,');
    console.log('      not the engine.'); bad++;
  } else if (R.M.meX !== 2 || R.M.meY !== 0) {
    console.log('      RED — we played the picked move instead of the encored one (' + R.M.meX + '/' + R.M.meY + ').'); bad++;
  } else if (!R.div) console.log('      ok — Encore forces ' + X + ' on both sides with no foe left standing');
}

/* ---- ARM 3: THE KNOB. A knob that changes nothing is unwired. ---------------------------------- */
if (!KNOB_SET) {
  console.log(NL + '  --- KNOB ' + KNOB + '=1: the defect must come back ---');
  const R = play(harness(true), true, 'knob');
  harness(false);
  if (!R.staged) { console.log('      NOT STAGED under the knob — ' + R.why); bad++; }
  else {
    show(R);
    const moved = R.M.meY !== emptyClean.M.meY || R.M.meX !== emptyClean.M.meX || !!R.div !== !!emptyClean.div;
    if (!moved) {
      console.log('      RED — THE KNOB CHANGED NOTHING. Identical results across a varied knob mean');
      console.log('      the knob is unwired, not that the gate does not matter.'); bad++;
    } else console.log('      ok — the knob restores the live-foe gate, so the arm above is live');
    const C = play(harness(true), false, 'knob-control');
    harness(false);
    if (C.staged && (C.M.meX !== controlClean.M.meX || C.M.meY !== controlClean.M.meY)) {
      console.log('      RED — the knob also moved the CONTROL arm, so it is not scoped to the empty field.'); bad++;
    } else console.log('      ok — the knob leaves the control arm exactly where it was');
  }
}

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — the Encore override needs no living foe.') + NL);
process.exit(bad ? 1 : 0);
