#!/usr/bin/env node
/* tests/probe_stealeat_before_reactors.js — BUG BITE'S STEAL-EAT IS STEP 3, NOT `onAfterHit`.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_stealeat_before_reactors.js
 *   SHOWDOWN_PATH=... MEDI_STEALEAT_AT_AFTERHIT=1 node tests/probe_stealeat_before_reactors.js  (exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *     bugbite: {                                                      data/moves.ts:1911-1930
 *       onHit(target, source, move) {
 *         const item = target.getItem();
 *         if (source.hp && item.isBerry && target.takeItem(source)) {
 *           this.add('-enditem', target, item.name, '[from] stealeat', '[move] Bug Bite', `[of] ${source}`);
 *
 * `onHit` is STEP 3 of `spreadMoveHit` — `runMoveEffects`, data/mods/champions/scripts.ts:375 — and
 * the on-damaging-hit reactors are raised at :410, after step 6:
 *
 *     // 3. onHit event happens here
 *     damage = this.runMoveEffects(damage, targets, pokemon, move, moveData, isSecondary, isSelf);
 *     …
 *     if (this.battle.gen >= 5) this.battle.runEvent('DamagingHit', damagedTargets, pokemon, move, damagedDamage);
 *
 * So the berry is stolen and eaten BEFORE Rough Skin pays the attacker. Neither `bugbite` nor
 * `roughskin` is overridden in `data/mods/champions/` — grepped on every run below, not remembered.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `engine/medicham2-browser.js` resolved the steal-eat inside `_stepAfterHit`, which is the
 * authority's `onAfterHit` (battle-actions.ts:953) and sits BELOW the DamagingHit steps in the same
 * `_STEPS` array. That is the right home for Thief, Covet and Knock Off, whose handlers really are
 * `onAfterHit`, and the wrong one for the two moves whose handler is `onHit`.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * Row 8 of the fifteen board partings in the held-out 12,000-game draw on release `834713ccb303`
 * (`data/verification/_8347_dump_g12000.json`, seed `gen9championsvgc2026regmbbo3-2660750080`,
 * `omit-intimidate`, turn 13). A Scizor on 16/145 Bug Bites a Garchomp [Rough Skin] holding a
 * Sitrus Berry:
 *
 *     showdown   |-enditem|p1a: Garchomp|Sitrus Berry|[from] stealeat|[move] Bug Bite|[of] p2a: Scizor
 *                |-heal|p2a: Scizor|52/145|[from] item: Sitrus Berry
 *                |-damage|p2a: Scizor|34/145|[from] ability: Rough Skin|[of] p1a: Garchomp
 *                |faint|p1a: Garchomp
 *     medicham2  |-damage|p2a: Scizor|0 fnt|[from] ability: roughskin|[of] p1a: Garchomp
 *                |-enditem|p1a: Garchomp|sitrusberry|[from] move: bugbite|[of] p2a: Scizor
 *                |faint|p1a: Garchomp
 *                |faint|p2a: Scizor
 *
 * The order is the whole defect and the KO is its consequence: the authority's thief eats first and
 * lives at 34/145, ours pays Rough Skin at 16 HP and dies. Board leaves `p2.party.scizor.hp us=0
 * showdown=34`, `fainted us=true showdown=false`, `ate_berry us=0 showdown=1`.
 *
 * ================= THE FIXTURE IS ORDER-ONLY, DELIBERATELY ======================================
 *
 * Nothing may faint here. A fixture that reproduced the KO would be testing the CONSEQUENCE, and a
 * fainting body pulls a replacement onto the field that the script has no click for. Both sides
 * carry an 8x HP multiplier and the assertion is the ORDER of the two lines in each stream, plus
 * the streams agreeing at all.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const KNOB = 'MEDI_STEALEAT_AT_AFTERHIT';
const KNOB_SET = process.env[KNOB] === '1';
if (KNOB_SET) {
  console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE. The ORDER arm is expected to FAIL and');
  console.log('  this run MUST exit 1. The internal knob arm is skipped.');
}

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
const ARGV = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let REL_ID = ARGV('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_stealeat_before_reactors.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

if (!process.argv.includes('--state')) process.argv.push('--state');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const T = require(D('engine', 'tags.js'));

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
  const TAB = String.fromCharCode(9);
  const mv = fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8');
  const modM = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const modA = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
  const sc = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'scripts.ts'), 'utf8');
  const i = mv.indexOf(NL + TAB + 'bugbite: {');
  const block = i < 0 ? '' : mv.slice(i, mv.indexOf(NL + TAB + '},' + NL, i));
  const atOnHit = /onHit\(target, source, move\)/.test(block) && /\[from\] stealeat/.test(block);
  const hitFirst = sc.indexOf('runMoveEffects(damage, targets, pokemon, move, moveData, isSecondary, isSelf)');
  const dhAt = sc.indexOf("runEvent('DamagingHit', damagedTargets");
  console.log('    bugbite steals from its onHit                    : ' + atOnHit);
  console.log('    champions scripts: runMoveEffects at char ' + hitFirst + ', DamagingHit at ' + dhAt);
  console.log('    so onHit resolves BEFORE the reactors            : ' + (hitFirst > 0 && dhAt > hitFirst));
  console.log('    bugbite overridden by Champions                  : ' + /[\n\t]bugbite: \{/.test(modM));
  console.log('    roughskin overridden by Champions                : ' + /[\n\t]roughskin: \{/.test(modA));
  if (!atOnHit || !(hitFirst > 0 && dhAt > hitFirst)) {
    console.log('    THE AUTHORITY DOES NOT ORDER IT THAT WAY — this probe asserts something the');
    console.log('    format does not say, and is WRONG rather than the engine.'); bad++;
  }
}

/* ---- THE POPULATIONS, PRINTED BEFORE ANYTHING IS WIRED TO THEM -------------------------------- */
console.log(NL + '  === THE FIXTURE, DERIVED THIS RUN ===');
const G0 = harness(false);
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LEGALX = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .filter(s => !G0.CLOSET_SPECIES.has(norm(s.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const IDLE_OF = (s) => Object.keys(LS(s)).map(k => dex.moves.get(k))
  .filter(m => m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
    && !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.volatileStatus && !m.selfdestruct
    && !m.status && !m.forceSwitch && !m.onHit
    && m.boosts && Object.values(m.boosts).every(v => v > 0)
    && !('evasion' in m.boosts) && !('accuracy' in m.boosts))
  .sort((a, b) => a.pp - b.pp)[0] || null;

/* The THIEF move is derived from the tag that selects exactly the `onHit` stealers — the same
 * predicate the engine's own strip site reads (`removesItem.requiresItemClass === ['isBerry']` and
 * not a `steals`), printed here so the membership is visible before anything is wired to it. */
const STEALEAT = dex.moves.all().filter(m => {
  if (!LEGALX(m) || m.category === 'Status') return false;
  const ri = T.param('move', m.id, 'removesItem');
  return !!(ri && Array.isArray(ri.requiresItemClass) && ri.requiresItemClass.length === 1
            && ri.requiresItemClass[0] === 'isBerry' && !ri.steals);
});
console.log('    moves whose strip is the berry-class onHit : ' + (STEALEAT.map(m => m.id).join(', ') || 'NONE'));
if (!STEALEAT.length) { console.log('    POPULATION EMPTY — a claim about the artifact.'); process.exit(2); }

/* The REACTOR is any `punishesAttacker` that writes a visible line on the attacker. Rough Skin is
 * chosen by its own params — contact-triggered, a fixed fraction, no die — so the arm cannot pass or
 * fail on a roll. */
/* `onFaintOnly` is read and EXCLUDED rather than left to chance: Aftermath carries the same
 * `trigger: 'contact'` and the same flat fraction and pays only when its holder dies, which this
 * order-only fixture forbids. The first staging picked it alphabetically and read
 * `reactor@-1` on both engines — a fixture fault, printed rather than papered over. */
const abilList = [];
for (const ab of dex.abilities.all()) {
  if (!LEGALX(ab)) continue;
  const p = T.param('ability', ab.id, 'punishesAttacker');
  if (p && p.trigger === 'contact' && p.fraction && !p.inflicts && !p.onFaintOnly) abilList.push(ab.id);
}
console.log('    contact reactors that pay a flat fraction on a LIVE holder : ' + (abilList.join(', ') || 'NONE'));
if (!abilList.length) { console.log('    POPULATION EMPTY — a claim about the artifact.'); process.exit(2); }

/* The BERRY must not fire on its own before the theft. A pinch berry at full HP is quiet; a
 * type-resist berry would be eaten BY the incoming hit and steal the arm's own evidence. Both
 * exclusions are read off the item, not off its name. */
const BERRIES = dex.items.all().filter(it => LEGALX(it) && it.isBerry
  && !it.onSourceModifyDamage && !it.onDamagingHit && !it.onTryHit && !it.onEatItem);
console.log('    quiet berries (no on-hit handler)         : ' + (BERRIES.map(i => i.id).join(', ') || 'NONE'));
if (!BERRIES.length) { console.log('    POPULATION EMPTY — a claim about the format.'); process.exit(2); }
const BERRY = BERRIES[0];

const MV = STEALEAT[0];
const CARRIERS = POOL.filter(s => Object.values(s.abilities).some(a => abilList.includes(norm(a))) && IDLE_OF(s));
const THIEVES = POOL.filter(s => LS(s)[MV.id] && IDLE_OF(s));
if (!CARRIERS.length || !THIEVES.length) { console.log('    NO LEGAL CARRIER.'); process.exit(2); }
const CAR = CARRIERS[0];
const CAR_AB = Object.values(CAR.abilities).find(a => abilList.includes(norm(a)));
const TH = THIEVES.find(s => s.name !== CAR.name);
const FILL = POOL.filter(s => ![CAR.name, TH.name].includes(s.name) && IDLE_OF(s)).slice(0, 6);
if (!TH || FILL.length < 6) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log('    the HOLDER : ' + CAR.name + ' [' + CAR_AB + '] holding ' + BERRY.id);
console.log('    the THIEF  : ' + TH.name + ' clicks ' + MV.id);

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, ability, item, moves) => ({ species, item: item || '', ability: ability || '', moves });
const TEAM_P1 = [
  mon(CAR.name, CAR_AB, BERRY.name, [IDLE_OF(CAR).name]),
  mon(FILL[0].name, '', '', [IDLE_OF(FILL[0]).name]),
  mon(FILL[1].name, '', '', [IDLE_OF(FILL[1]).name]),
  mon(FILL[2].name, '', '', [IDLE_OF(FILL[2]).name]),
];
const teamP2 = (armed) => [
  mon(TH.name, '', '', armed ? [MV.name, IDLE_OF(TH).name] : [IDLE_OF(TH).name]),
  mon(FILL[3].name, '', '', [IDLE_OF(FILL[3]).name]),
  mon(FILL[4].name, '', '', [IDLE_OF(FILL[4]).name]),
  mon(FILL[5].name, '', '', [IDLE_OF(FILL[5]).name]),
];
const HP_BOOST = 8;

/* THE LINES ARE STRIPPED BEFORE THEY ARE MATCHED. The authority writes `[from] ability: Rough Skin`
 * and this engine writes `[from] ability: roughskin`; a regex over the raw text would match one and
 * not the other and would read as a missing reactor. */
const flat = l => String(l).toLowerCase().replace(/[^a-z0-9|:-]/g, '');
const idxOf = (lines, re) => lines.findIndex(l => re.test(flat(l)));
const STEAL_RE = /^\|-enditem\|.*(stealeat|bugbite|pluck)/;
const REACT_RE = new RegExp('^\\|-damage\\|.*' + norm(CAR_AB));

function play(G, armed, tag) {
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }), b = G.buildPair(teamP2(armed), { hpBoost: HP_BOOST });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  G.resetScriptCounters();
  let fainted = false;
  const script = [{
    p1: [{ m: norm(IDLE_OF(CAR).id) }, { m: norm(IDLE_OF(FILL[0]).id) }],
    p2: [armed ? { m: norm(MV.id), t: 0 } : { m: norm(IDLE_OF(TH).id) }, { m: norm(IDLE_OF(FILL[3]).id) }],
  }];
  const r = G.playGame(a, b, 'directed', 'stealeatorder/' + tag, {
    arm: G.ARM_BY_ID.get('middle'),
    script,
    onBoundary: (snap, turnIdx, S, battle) => {
      for (const side of ['p1', 'p2'])
        for (const p of ((battle && battle[side] && battle[side].pokemon) || []))
          if (p.fainted) fainted = true;
    },
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sd = (G.lastSdLog ? G.lastSdLog() : []).map(String);
  const me = ((r && r.mediTrace) || []).map(String);
  return { staged: true, fainted,
           sdSteal: idxOf(sd, STEAL_RE), sdReact: idxOf(sd, REACT_RE),
           meSteal: idxOf(me, STEAL_RE), meReact: idxOf(me, REACT_RE),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null,
           sdL: sd, meL: me };
}
const order = (s, rIdx) => (s < 0 || rIdx < 0) ? 'one of the two lines is absent' : (s < rIdx ? 'STEAL then REACTOR' : 'REACTOR then STEAL');
const show = (R) => {
  console.log('      showdown  steal@' + R.sdSteal + ' reactor@' + R.sdReact + '   ' + order(R.sdSteal, R.sdReact));
  console.log('      medicham  steal@' + R.meSteal + ' reactor@' + R.meReact + '   ' + order(R.meSteal, R.meReact));
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
  else console.log('      streams agree for the whole game');
  /* WHEN A LINE IS ABSENT, PRINT THE LOG RATHER THAN THE INDEX. A -1 is either "the mechanic did not
   * happen" or "this probe is reading the wrong array", and those are not the same finding. */
  if (process.env.PROBE_DUMP === '1') {
    console.log('      sd log (' + R.sdL.length + ' lines): ' + R.sdL.slice(-8).join(' ; '));
    console.log('      me log (' + R.meL.length + ' lines): ' + R.meL.slice(-8).join(' ; '));
  }
};

/* ---- ARM 1: QUIET. Neither line may appear, or the armed arm proves nothing. ------------------- */
console.log(NL + '  --- QUIET (the thief clicks a self-boost): neither line may appear ---');
{
  const R = play(harness(false), false, 'quiet');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  show(R);
  if (R.div) { console.log('      RED — the two engines part with nothing staged.'); bad++; }
  if (R.sdSteal >= 0 || R.sdReact >= 0 || R.meSteal >= 0 || R.meReact >= 0) {
    console.log('      RED — a steal or a reactor line appears with no ' + MV.id + ' clicked, so the');
    console.log('      armed arm below would be reading something else.'); bad++;
  } else console.log('      ok — the board is quiet, so both lines below belong to the click');
}

/* ---- ARM 2: ARMED. The claim. ------------------------------------------------------------------ */
console.log(NL + '  --- ARMED (' + MV.id + ' into the ' + CAR_AB + ' holder) ---');
let armedClean = null;
{
  const R = play(harness(false), true, 'armed');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  armedClean = R;
  show(R);
  if (R.fainted) { console.log('      RED — a body fainted; this fixture is order-only.'); bad++; }
  /* THE PARTING IS THE PRIMARY ASSERTION AND THE ORDER IS THE SECOND, in that order deliberately:
   * the comparison STOPS at the first divergence, so a parted run truncates both logs and the two
   * indices read -1 for a reason that has nothing to do with the mechanic. */
  if (R.div) {
    console.log('      RED — the streams part on the armed turn: the authority steals the berry at');
    console.log('      the moment we pay the reactor.'); bad++;
  } else if (R.sdSteal < 0 || R.sdReact < 0) {
    console.log('      RED — the AUTHORITY wrote no steal and/or no reactor line, so the order below');
    console.log('      is an order between things that did not happen.'); bad++;
  } else if (!(R.sdSteal < R.sdReact)) {
    console.log('      RED — the AUTHORITY put the reactor first. This probe is wrong, not the engine.'); bad++;
  } else if (R.meSteal < 0 || R.meReact < 0) {
    console.log('      RED — we wrote only one of the two lines.'); bad++;
  } else if (!(R.meSteal < R.meReact)) {
    console.log('      RED — we pay the reactor before the steal-eat, which is the `onAfterHit`');
    console.log('      placement the authority gives Thief and not Bug Bite.'); bad++;
  } else {
    console.log('      ok — both engines steal first, and the streams agree');
  }
}

/* ---- ARM 3: THE KNOB --------------------------------------------------------------------------- */
if (!KNOB_SET) {
  console.log(NL + '  --- KNOB ' + KNOB + '=1: the defect must come back ---');
  const R = play(harness(true), true, 'knob');
  harness(false);
  if (!R.staged) { console.log('      NOT STAGED under the knob — ' + R.why); bad++; }
  else {
    show(R);
    const moved = R.meSteal !== armedClean.meSteal || R.meReact !== armedClean.meReact
               || !!R.div !== !!armedClean.div;
    if (!moved) { console.log('      RED — THE KNOB CHANGED NOTHING, so it is unwired.'); bad++; }
    else console.log('      ok — the knob restores the late steal, so the arm above is live');
  }
}

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — the steal-eat resolves at step 3, above the reactors.') + NL);
process.exit(bad ? 1 : 0);
