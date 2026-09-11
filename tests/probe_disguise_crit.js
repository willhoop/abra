/* probe_disguise_crit.js — DOES DISGUISE REFUSE A CRIT WHERE THE AUTHORITY'S HANDLER REFUSES ONE, AND
 * NOWHERE ELSE — AND DOES IT STAY OUT OF A HIT THAT LANDS ON ITS OWN DOLL?
 *
 *   SHOWDOWN_PATH=... node tests/probe_disguise_crit.js [--release <id>] [--medi <path>]
 *
 * The parent runs itself again in TWO children, one per knob, and judges each: under a knob the child
 * asserts that knob's defect is PRESENT, so a working knob exits 0.
 *   MEDI_PREVENTSCRIT_ABILITY_ONLY=1   the crit refusal read off the ability alone (BUSTED, DOLL, VOLLEY part)
 *   MEDI_FORMEONHIT_THROUGH_DOLL=1     the disguise absorbing a hit on its own Substitute (DOLL's board parts)
 *
 * ================= THE AUTHORITY ================================================================
 *
 * The crit die is drawn inside `getDamage` (sim/battle-actions.ts:1637-1643) and a draw that comes up
 * crit is then offered to `runEvent('CriticalHit', target, null, move)` (:1645-1647). Disguise's
 * `onCriticalHit` (data/abilities.ts:969-979; data/mods/champions/abilities.ts:14-33 overrides
 * `onEffectiveness` ONLY, so mainline is the authority) returns `false` only when ALL of:
 *     target.species.id is 'mimikyu' or 'mimikyutotem'   -- Mimikyu-Busted is not on the list
 *     the hit is not landing on a Substitute             -- `hitSub` returns undefined
 *     target.runImmunity(move)                           -- an immune body is never priced anyway
 * medicham2 refused the crit on the ABILITY alone (`critChance` read `preventsCrit` off the defender's
 * ability and returned 0), so three bodies the authority crits could never be crit here: a BUSTED
 * Mimikyu, a Mimikyu behind its DOLL, and arrivals 2+ of a VOLLEY into an intact one (the forme
 * changes between hits: `eachEvent('Update')` runs inside the hit loop).
 *
 * THE DOLL ARM FOUND A SECOND DEFECT, and it is asserted here rather than filed: Disguise's absorb is its
 * `onDamage`, which a hit on a Substitute never raises (the Champions `spreadMoveHit` sends it to the doll,
 * data/mods/champions/scripts.ts:342). `formeOnHitAbsorbs` never asked the doll, so `dmgRange` priced the
 * hit on Mimikyu's Substitute at zero: `vol.substitute` 32 here, 16 in the authority, before the crit fix
 * and after it.
 *
 * THE POOL. Four bottom-corner board-material games on release 8ac9c4d888f1 are the busted arm, every
 * one: a `|detailschange|…|Mimikyu-Busted` and then the authority's `|-crit|` on that body
 * (seeds …2658446009, …2656940771, …2659986881, …2655157363). The doll and the volley arms have no pool
 * card; they are the same handler read whole, staged so a fix keyed on "busted" alone stays red.
 *
 * ================= THE ARMS — under `bottom-tie-first`, where every crit die lands ================
 *
 *   INTACT  one single-hit click into an intact Mimikyu      the CONTROL: refused in both engines
 *   BUSTED  the same click on two consecutive turns          turn 2 lands on Mimikyu-Busted and crits
 *   DOLL    Substitute on turn 1, the click on turn 2        the doll takes the crit, and the damage
 *   VOLLEY  one Dual Wingbeat into an intact Mimikyu          arrival 1 refused, arrival 2 crits
 *
 * NOTHING IS TYPED. The authority's `|-crit|p2a` lines are the expectation, the board is compared at
 * every boundary, and every body but the subject is DERIVED off the format: an ability is used only if
 * every handler it declares is in a harmless set (printed), a filler clicks a self-boost move with no
 * handler of its own, and the click is the weakest single-hit move with no secondary, no crit ratio and
 * no `bypasssub` flag that Mimikyu is not immune to. Every move is asked of the validator (ROADMAP #565).
 *
 * ================= WHAT IT CANNOT SEE =============================================================
 *
 * `runImmunity(move)`: an immune target never reaches `getDamage`, so the clause has no observable.
 * Ice Face, the only other `onCriticalHit` handler upstream, has no legal carrier in this regulation.
 * Mold Breaker, which reaches the refusal through `suppressedAbility` and is not staged. A crit ratio
 * above 1, which `critChance` answers on the same line and no arm here exercises. A volley that breaks
 * the doll on arrival 1 and meets the disguise on arrival 2, which the absorb gate does not model.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const NL = '\n';
require(path.join(ROOT, 'engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('DISGUISE CRIT');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const MEDI_SRC_PATH = argOf('--medi', null);
const KNOB = process.env.MEDI_PREVENTSCRIT_ABILITY_ONLY === '1';
const KNOB_DOLL = process.env.MEDI_FORMEONHIT_THROUGH_DOLL === '1';
const CHILD = process.argv.includes('--knob-child');
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_disguise_crit.js — Disguise refuses a crit on the INTACT forme only, and never through a doll');
console.log('  knob MEDI_PREVENTSCRIT_ABILITY_ONLY=' + (KNOB ? '1  (the ability-only refusal is RESTORED; BUSTED, DOLL and VOLLEY must PART)' : '0'));
console.log('  knob MEDI_FORMEONHIT_THROUGH_DOLL=' + (KNOB_DOLL ? '1  (the disguise absorbs a hit on its doll again; DOLL\'s board must PART)' : '0'));
if (MEDI_SRC_PATH) console.log('  engine bytes: ' + MEDI_SRC_PATH + ' (compiled under the release; NOT the release\'s own simulator)');

/* ==================================================================================================
 * 0. THE AUTHORITY
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat(require(path.join(ROOT, 'engine', 'champions_sim.js')).FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
console.log(NL + '0. THE AUTHORITY');
const DG = D.abilities.get('disguise');
const H = String(DG.onCriticalHit || '');
ok(/\[\s*["']mimikyu["']\s*,\s*["']mimikyutotem["']\s*\]\.includes\(target\.species\.id\)/.test(H),
   '`disguise.onCriticalHit` gates on the SPECIES (mimikyu / mimikyutotem), not on the ability',
   H.replace(/\s+/g, ' ').slice(0, 170));
ok(/volatiles\[["']substitute["']\]/.test(H) && /if \(hitSub\) return;/.test(H),
   'and it answers undefined — no refusal — when the hit lands on a Substitute');
ok(/effect\?\.effectType === ["']Move["']/.test(String(DG.onDamage || '')),
   'the absorb is `onDamage` — a handler on the POKEMON\'s damage event, which a hit on the doll never raises');
const CHAB = fs.readFileSync(SP + '/data/mods/champions/abilities.ts', 'utf8').replace(/\r/g, '');
const dblock = /\n\tdisguise: \{[\s\S]*?\n\t\},\n/.exec(CHAB);
ok(!!dblock && !/onCriticalHit|onDamage\(/.test(dblock[0]),
   'Champions overrides `disguise` without touching `onCriticalHit` or `onDamage`, so mainline is the authority for both',
   dblock ? 'override keys: ' + (dblock[0].match(/\n\t\t(\w+)/g) || []).map(s => s.trim()).join(', ') : 'block not found');

/* ==================================================================================================
 * 1. THE CAST — derived
 * ============================================================================================== */
console.log(NL + '1. THE CAST, DERIVED THIS RUN');
const G = SB.harness(MEDI_SRC_PATH ? fs.readFileSync(MEDI_SRC_PATH, 'utf8') : undefined);
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.log('  NOT STAGED — the bottom arm is not in ARM_BY_ID.'); process.exit(1); }
/* WHAT THE ENGINE READS, printed before anything is judged (LESSONS §4): the `preventsCrit` members
 * and their params, off the release the engine is loaded from — not off the live tree. */
{
  let tj = null, why = '';
  try { tj = JSON.parse(G.REL.read('data/tags.json')); } catch (e) { why = e.message; }
  const ab = (tj && tj.abilities) || {};
  const mem = Object.keys(ab).filter(k => (ab[k].tags || []).includes('preventsCrit'));
  console.log('     preventsCrit in release ' + G.REL.id + ': ' + (mem.length
    ? mem.map(k => k + ' ' + JSON.stringify((ab[k].params || {}).preventsCrit)).join('   ') : 'NONE READ ' + why));
}
const MIMI = D.species.get('Mimikyu');
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The raw learnset is only the
 * CANDIDATE list; every move this file hands a body is asked of `champions_sim.canLearn`, which is
 * `TeamValidator#checkCanLearn` cached per pair, and it is asked LAST, on the few candidates that already
 * pass the cheap filters. */
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const rawLearnset = sp => ((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {};
const learns = (sp, mv) => !!CS.canLearn(sp, mv);
const fnKeys = o => Object.keys(o).filter(k => /^on[A-Z]/.test(k) && typeof o[k] === 'function');
/* A handler in this set cannot write a line or move a number on these boards: no status, no weather,
 * no stat drop and no miss is ever staged. Anything else disqualifies the ability. */
const HARMLESS = /^on(ModifySpe|TryBoost|SetStatus|TryAddVolatile|Immunity|ModifyAccuracy|SourceModifyAccuracy|DragOut|TrapPokemon|MaybeTrapPokemon|FoeTrapPokemon|FoeMaybeTrapPokemon|Update|CheckShow)$/;
const quietAb = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a))
  .find(a => a.exists && fnKeys(a).every(k => HARMLESS.test(k))) || null;
const selfBoost = m => legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts
  && !Object.keys(m.boosts).some(k => k === 'accuracy' || k === 'evasion') && !fnKeys(m).length
  && !m.heal && !m.volatileStatus && !m.self && !m.secondary && !m.stallingMove && !m.sideCondition
  && !m.weather && !m.terrain && !m.pseudoWeather;
const selfMoveOf = sp => Object.keys(rawLearnset(sp)).map(id => D.moves.get(id)).filter(selfBoost)
  .filter(m => learns(sp, m.id)).sort((a, b) => a.name.localeCompare(b.name))[0] || null;
const hitMoveOf = sp => Object.keys(rawLearnset(sp)).map(id => D.moves.get(id)).filter(m => legal(m)
  && m.target === 'normal' && m.category !== 'Status' && !m.multihit && !m.willCrit && (Number(m.critRatio) || 1) === 1
  && m.basePower > 0 && !m.secondary && !m.secondaries && !m.self && !m.recoil && !m.drain && !m.flags.charge
  && !m.flags.recharge && !m.flags.bypasssub && !m.volatileStatus && !m.status && !m.boosts && !m.sideCondition
  && !m.forceSwitch && !m.selfSwitch && !m.selfdestruct && !m.ohko && !m.damage && !m.damageCallback
  && !m.basePowerCallback && !fnKeys(m).length && D.getImmunity(m.type, MIMI) && learns(sp, m.id))
  .sort((a, b) => a.basePower - b.basePower || a.name.localeCompare(b.name))[0] || null;
const VOLLEY_MOVE = D.moves.get('dualwingbeat');
ok(legal(MIMI) && Object.values(MIMI.abilities).map(a => D.abilities.get(a).id).join() === 'disguise',
   'Mimikyu is legal and its only ability is Disguise');
ok(learns('Mimikyu', 'substitute') && learns('Mimikyu', 'swordsdance'), 'Mimikyu learns Substitute and Swords Dance');
ok(legal(VOLLEY_MOVE) && VOLLEY_MOVE.multihit === 2 && D.getImmunity(VOLLEY_MOVE.type, MIMI) && !VOLLEY_MOVE.secondary,
   'Dual Wingbeat is legal, a FIXED two-hit volley, reaches Mimikyu, and carries no secondary',
   'multihit ' + JSON.stringify(VOLLEY_MOVE.multihit) + ', type ' + VOLLEY_MOVE.type);
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega && !s.battleOnly && s.id !== MIMI.id)
  .sort((a, b) => a.name.localeCompare(b.name));
const ATTS = SPEC.filter(s => quietAb(s) && learns(s.name, 'dualwingbeat') && selfMoveOf(s.name) && hitMoveOf(s.name));
console.log('     attackers (learn Dual Wingbeat, quiet ability, a self move, a clean single hit): '
  + ATTS.slice(0, 6).map(s => s.name).join(', ') + (ATTS.length > 6 ? ', …' : ''));
if (!ATTS.length) { console.log('  NOT STAGED — no legal attacker.'); process.exit(1); }
const ATT = ATTS[0], HIT = hitMoveOf(ATT.name), ATTSELF = selfMoveOf(ATT.name);
const F = [];
for (const s of SPEC) { if (F.length >= 6) break; if (s.id !== ATT.id && quietAb(s) && selfMoveOf(s.name)) F.push(s); }
if (F.length < 6) { console.log('  NOT STAGED — fewer than six legal fillers.'); process.exit(1); }
console.log('     attacker      : ' + ATT.name + ' (' + quietAb(ATT).name + ')  click ' + HIT.name + ' ('
  + HIT.type + ', ' + HIT.basePower + ' bp, ' + HIT.category + ')  self ' + ATTSELF.name);
console.log('     fillers       : ' + F.map(s => s.name + ' (' + quietAb(s).name + ', ' + selfMoveOf(s.name).name + ')').join('; '));

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const mon = (s, a, mv) => ({ species: s, item: '', ability: a || '', moves: mv });
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const snap = () => ({ species: M.MEDSEEN.critRefusalLiftedBySpecies || 0, sub: M.MEDSEEN.critRefusalLiftedBySub || 0,
                      after: M.MEDSEEN.critRefusalLiftedAfterBreak || 0, doll: M.MEDSEEN.formeOnHitDollTookIt || 0,
                      unknown: M.MEDFAILS.preventsCritShapeUnknown || 0, noBody: M.MEDFAILS.preventsCritNoBody || 0,
                      restored: M.MEDFAILS.preventsCritAbilityOnlyRestored || 0,
                      dollRestored: M.MEDFAILS.formeOnHitThroughDollRestored || 0 });
const isCrit = l => /^\|-crit\|p2a/.test(String(l));
const isBreak = l => /^\|-activate\|p2a[^|]*\|ability: disguise$/i.test(String(l));
const A = [mon(ATT.name, quietAb(ATT).name, [HIT.name, VOLLEY_MOVE.name, ATTSELF.name]),
           mon(F[0].name, quietAb(F[0]).name, [selfMoveOf(F[0].name).name]),
           mon(F[1].name, quietAb(F[1]).name, [selfMoveOf(F[1].name).name]),
           mon(F[2].name, quietAb(F[2]).name, [selfMoveOf(F[2].name).name])];
const B = [mon('Mimikyu', 'Disguise', ['Substitute', 'Swords Dance']),
           mon(F[3].name, quietAb(F[3]).name, [selfMoveOf(F[3].name).name]),
           mon(F[4].name, quietAb(F[4]).name, [selfMoveOf(F[4].name).name]),
           mon(F[5].name, quietAb(F[5]).name, [selfMoveOf(F[5].name).name])];
const fa = { m: selfMoveOf(F[0].name).id }, fb = { m: selfMoveOf(F[3].name).id };
const T_HIT = { p1: [{ m: HIT.id, t: 0 }, fa], p2: [{ m: 'swordsdance' }, fb] };
const SCRIPTS = {
  INTACT: [T_HIT],
  BUSTED: [T_HIT, T_HIT],
  DOLL: [{ p1: [{ m: ATTSELF.id }, fa], p2: [{ m: 'substitute' }, fb] }, T_HIT],
  VOLLEY: [{ p1: [{ m: VOLLEY_MOVE.id, t: 0 }, fa], p2: [{ m: 'swordsdance' }, fb] }],
};
function play(tag, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b || a.length !== A.length || b.length !== B.length) return { staged: false, why: 'buildPair dropped a body' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const c0 = snap();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_disguise_crit :: ' + tag, { script, arm: ARM,
    onBoundary: (s, ti) => {
      boards.push({ turn: ti, compared: s.leaves_compared, diffs: (s.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      s.identical = true; s.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const c1 = snap();
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const pos = (xs, f) => xs.findIndex(f);
  return { staged: true, sd, me,
           sdCrit: sd.filter(isCrit).length, meCrit: me.filter(isCrit).length,
           sdBreak: sd.filter(isBreak).length, meBreak: me.filter(isBreak).length,
           sdCritAfterBreak: pos(sd, isBreak) >= 0 && pos(sd, isCrit) > pos(sd, isBreak),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.join(', ')).join(' | '),
           c: { species: c1.species - c0.species, sub: c1.sub - c0.sub, after: c1.after - c0.after, doll: c1.doll - c0.doll,
                unknown: c1.unknown - c0.unknown, noBody: c1.noBody - c0.noBody, restored: c1.restored, dollRestored: c1.dollRestored },
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}
console.log(NL + '2. THE ARMS');
const R = {};
for (const tag of Object.keys(SCRIPTS)) {
  R[tag] = play(tag, SCRIPTS[tag]);
  const x = R[tag];
  if (!x.staged) { console.log('  NOT STAGED (' + tag + ') — ' + x.why); process.exit(1); }
  console.log('  === ' + tag + ' ===');
  console.log('    |-crit|p2a       showdown x' + x.sdCrit + '   medicham2 x' + x.meCrit
    + '      disguise break  showdown x' + x.sdBreak + '   medicham2 x' + x.meBreak);
  console.log('    boards: ' + x.boardDiffs + ' diff(s)' + (x.boardDetail ? '   ' + x.boardDetail : ''));
  console.log('    counters: lifted by species +' + x.c.species + ', by doll +' + x.c.sub + ', after the break +' + x.c.after
    + '   doll took the hit +' + x.c.doll + '   shapeUnknown +' + x.c.unknown + '   noBody +' + x.c.noBody);
  console.log('    first protocol divergence: ' + (x.div ? JSON.stringify(x.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');
/* the authority first — these are the EXPECTATIONS and they do not depend on a knob */
ok(R.INTACT.sdCrit === 0 && R.INTACT.sdBreak === 1, 'INTACT — the authority breaks the disguise and REFUSES the crit (the control can see a refusal)');
ok(R.BUSTED.sdCrit === 1 && R.BUSTED.sdBreak === 1, 'BUSTED — the authority crits the busted body on turn 2');
ok(R.DOLL.sdCrit === 1 && R.DOLL.sdBreak === 0, 'DOLL — the authority crits the doll and the disguise never breaks');
ok(R.VOLLEY.sdCrit === 1 && R.VOLLEY.sdBreak === 1 && R.VOLLEY.sdCritAfterBreak,
   'VOLLEY — the authority refuses arrival 1, breaks the disguise, and crits arrival 2');
/* this engine against it */
for (const tag of ['INTACT', 'BUSTED', 'DOLL', 'VOLLEY']) {
  const x = R[tag], same = x.sdCrit === x.meCrit && x.sdBreak === x.meBreak;
  const critMust = tag === 'INTACT' || !KNOB;
  ok(critMust ? same : !same,
     tag + ' — the `|-crit|` and disguise-break counts match the authority' + (critMust ? '' : '   [expected to DIFFER: the crit knob is armed]'),
     'showdown crit ' + x.sdCrit + ' break ' + x.sdBreak + ' / medicham2 crit ' + x.meCrit + ' break ' + x.meBreak);
  if (KNOB && tag !== 'INTACT') {
    ok(true, tag + ' — the BOARDS are not asserted under the crit knob');
  } else if (KNOB_DOLL && tag === 'DOLL') {
    ok(x.boardDiffs > 0, 'DOLL — the BOARDS PART (the doll knob is armed: the disguise takes the hit meant for the doll)',
       x.boardDiffs + ' diff(s)' + (x.boardDetail ? ': ' + x.boardDetail : ''));
  } else {
    ok(x.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary',
       x.boardDiffs + ' diff(s)' + (x.boardDetail ? ': ' + x.boardDetail : ''));
  }
}
/* the engine's own receipts */
if (!KNOB) {
  ok(R.BUSTED.c.species > 0, 'BUSTED lifted the refusal because the body is not the intact forme', 'critRefusalLiftedBySpecies +' + R.BUSTED.c.species);
  ok(R.DOLL.c.sub > 0, 'DOLL lifted the refusal because the hit lands on the doll', 'critRefusalLiftedBySub +' + R.DOLL.c.sub);
  ok(R.VOLLEY.c.after > 0, 'VOLLEY lifted the refusal for the arrivals after the break', 'critRefusalLiftedAfterBreak +' + R.VOLLEY.c.after);
}
if (!KNOB_DOLL) {
  ok(R.DOLL.c.doll > 0 && R.INTACT.c.doll === 0 && R.BUSTED.c.doll === 0 && R.VOLLEY.c.doll === 0,
     'the disguise stood aside for the doll on DOLL and on no other arm', Object.keys(R).map(t => t + ' +' + R[t].c.doll).join('  '));
}
ok(Object.values(R).every(x => x.c.unknown === 0 && x.c.noBody === 0),
   'no refusal was decided without a body or on a tag shape the engine could not read (the silent-default doors stayed shut)',
   Object.keys(R).map(t => t + ' unknown +' + R[t].c.unknown + ' noBody +' + R[t].c.noBody).join('   '));
ok(KNOB ? R.INTACT.c.restored === 1 : !R.INTACT.c.restored,
   'the crit knob marks its own run — a restored engine cannot be mistaken for a fixed one',
   'preventsCritAbilityOnlyRestored = ' + R.INTACT.c.restored);
ok(KNOB_DOLL ? R.INTACT.c.dollRestored === 1 : !R.INTACT.c.dollRestored,
   'the doll knob marks its own run', 'formeOnHitThroughDollRestored = ' + R.INTACT.c.dollRestored);

/* ==================================================================================================
 * 4. THE KNOBS, EACH IN ITS OWN CHILD — the engine reads them at module load
 * ============================================================================================== */
if (!CHILD) {
  for (const [name, env] of [['MEDI_PREVENTSCRIT_ABILITY_ONLY=1', { MEDI_PREVENTSCRIT_ABILITY_ONLY: '1' }],
                             ['MEDI_FORMEONHIT_THROUGH_DOLL=1', { MEDI_FORMEONHIT_THROUGH_DOLL: '1' }]]) {
    console.log(NL + '4. THE KNOB CHILD (' + name + ')');
    const ch = spawnSync(process.execPath, [__filename, ...process.argv.slice(2), '--knob-child'],
      { env: Object.assign({}, process.env, env), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
    const out = String(ch.stdout || '') + String(ch.stderr || '');
    for (const l of out.split('\n').filter(l => /^\s+(green|RED)\s/.test(l) && /INTACT|BUSTED|DOLL|VOLLEY|knob/.test(l))) console.log('    child' + l);
    ok(ch.status === 0, 'under ' + name + ' the child sees exactly that knob\'s defect and nothing else',
       'child exit ' + ch.status + (ch.error ? ' (' + ch.error.message + ')' : ''));
  }
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
