/* probe_accuracy_roads.js — DO THE ROADS THAT GOT STEP 4 WRONG ROLL ACCURACY THE AUTHORITY'S WAY NOW?
 *
 *   SHOWDOWN_PATH=... node tests/probe_accuracy_roads.js [--release <id>] [--medi <path>]
 *
 * The parent runs itself again in a child under ALL THREE knobs (MEDI_PIVOT_NO_ACCURACY=1,
 * MEDI_DELAYED_HIT_NO_ACCURACY=1, MEDI_ABSORB_ACC_LOCAL=1) and judges the child: under the knobs the
 * child asserts the defects are PRESENT, so working knobs exit 0.
 *
 * ================= THE AUTHORITY ================================================================
 *
 * Every move that reaches a target goes through `trySpreadMoveHit`, whose step list puts
 * `hitStepAccuracy` (sim/battle-actions.ts:690-754) at step 4: `let accuracy = move.accuracy`,
 * `ModifyAccuracy` (Bright Powder, Sand Veil, Snow Cloak), the clamped combined accuracy/evasion stage
 * (:713-727), then `randomChance(accuracy, 100)` — which still DRAWS for a printed 100. Three roads in
 * medicham2 got it wrong:
 *   PARTING SHOT   the pivot branch (`a.kind === 'switch'` with a move) ran the shield, the try-hit
 *                  refusals and the move-class block, then dropped the stats and pivoted. No step 4.
 *   FUTURE SIGHT   `futuremove.onEnd` (data/conditions.ts:394-422) pays out through `trySpreadMoveHit`,
 *                  so it rolls step 4 too; medicham2's payout said so in a comment and did not.
 *   FLASH FIRE     its `onTryHit` writes `move.accuracy = true` on the click's ONE ActiveMove before it
 *                  returns null, and the steps are step-major, so every other target of that click skips
 *                  the roll. medicham2 rolled each target's printed accuracy anyway.
 * Step 0 (semi-invulnerability) is NOT this file's question: a Parting Shot action is already refused
 * there by the generic non-attack step, because `actionMoveId` returns the pivot's move.
 *
 * THE POOL. Four top-corner board-material games on release 8ac9c4d888f1:
 *   …2634132571  Incineroar's Parting Shot into a Bright Powder Whimsicott — the authority writes
 *                `|-miss|`, medicham2 dropped the stats and pivoted
 *   …2657333637  Reuniclus's Future Sight landing on a Bright Powder Talonflame after Reuniclus had left
 *                the field — the authority writes `|-miss|p2: Reuniclus|p1a: Talonflame`, medicham2 KO'd it
 *   …2659430913, …2655570367  a Charizard's Heat Wave beside a Flash Fire Ceruledge — the authority's
 *                step 4 was handed `accuracy true` (read off `hitStepAccuracy`, wrapped) and landed on the
 *                partner; medicham2 rolled 90 under the missing die and wrote `|-miss|`
 *
 * ================= THE ARMS — under `top-tie-first`, where every sub-100 roll MISSES ==============
 *
 *   PS-CONTROL    Parting Shot into the subject, no item               lands, drops, pivots (both)
 *   PS-POWDER     the SAME subject holding Bright Powder (100 -> 90)   the authority misses
 *   PS-EVASION    the SAME subject after its own Double Team (+1 -> 75) the authority misses
 *   FS-CONTROL    Future Sight's payout onto the subject, no item      lands (both)
 *   FS-POWDER     the SAME subject holding Bright Powder               the authority misses
 *   FS-EVASION    the SAME subject after its own Double Team           the authority misses
 *   FS-BENCHED    FS-POWDER with the booker switched out before the payout — the pool card's shape, and
 *                 the one whose `-miss` names a body that is off the field (`p1: Slowking`)
 *   HW-CONTROL    Heat Wave into Arcanine (Justified) and the subject  both targets miss (90, missing die)
 *   HW-FLASHFIRE  the SAME Arcanine carrying Flash Fire                Arcanine absorbs; the subject is HIT
 *
 * NOTHING IS TYPED. The authority's `-miss` / `-unboost` / `-end` lines are the expectation and the board
 * is compared at every boundary. Each red arm is the same body as its control with ONE field moved. Every
 * filler click is a self-boost move DERIVED per body and asked of the validator (ROADMAP #565): the
 * `Iron Defense` / `Amnesia` filler two other probes use is refused by `canLearn` for most of their bodies.
 *
 * ================= WHAT IT CANNOT SEE =============================================================
 *
 * A semi-invulnerable Future Sight collector (step 0 on the payout road, still unmodelled there and
 * named in medicham2's own comment); Blunder Policy (not legal in this regulation); a bounced Parting
 * Shot's accuracy (the bounce is step 1, above step 4, and no arm stages Magic Bounce); an off-field
 * booker's Compound Eyes or Zoom Lens (no body in this fixture carries either); a Flash Fire absorb on a
 * STATUS click (Will-O-Wisp is single-target, so there is no other target to make sure).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const NL = '\n';
require(path.join(ROOT, 'engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('ACCURACY ROADS');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const MEDI_SRC_PATH = argOf('--medi', null);
const KNOBS = ['MEDI_PIVOT_NO_ACCURACY', 'MEDI_DELAYED_HIT_NO_ACCURACY', 'MEDI_ABSORB_ACC_LOCAL'];
const KNOB = KNOBS.every(k => process.env[k] === '1');
const CHILD = process.argv.includes('--knob-child');
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};
console.log(NL + 'tests/probe_accuracy_roads.js — Parting Shot, Future Sight\'s payout and a Flash Fire absorb take step 4 the authority\'s way');
console.log('  knobs ' + KNOBS.join(' + ') + ' = ' + (KNOB ? '1  (all three RESTORED; every red arm must PART)' : '0'));
if (MEDI_SRC_PATH) console.log('  engine bytes: ' + MEDI_SRC_PATH + ' (compiled under the release; NOT the release\'s own simulator)');

/* ==================================================================================================
 * 0. THE AUTHORITY
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat(require(path.join(ROOT, 'engine', 'champions_sim.js')).FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
console.log(NL + '0. THE AUTHORITY');
const BA = read('/sim/battle-actions.ts'), COND = read('/data/conditions.ts');
ok(/hitStepAccuracy\(targets: Pokemon\[\], pokemon: Pokemon, move: ActiveMove\)/.test(BA)
   && /accuracy !== true && !this\.battle\.randomChance\(accuracy, 100\)/.test(BA),
   '`hitStepAccuracy` exists and draws `randomChance(accuracy, 100)` for any non-`true` accuracy');
const FM = /\n\tfuturemove: \{[\s\S]*?\n\t\},\n/.exec(COND);
ok(!!FM && /this\.actions\.trySpreadMoveHit\(\[target\], data\.source, hitMove, true\)/.test(FM[0]),
   '`futuremove.onEnd` pays out through `trySpreadMoveHit`, the road that owns step 4');
const CHM = read('/data/mods/champions/moves.ts');
const CHC = fs.existsSync(SP + '/data/mods/champions/conditions.ts') ? read('/data/mods/champions/conditions.ts') : '';
const CHA = read('/data/mods/champions/abilities.ts');
ok(!/^\tpartingshot: \{/m.test(CHM) && !/^\tfuturesight: \{/m.test(CHM) && !/^\tfuturemove: \{/m.test(CHC) && !/^\tflashfire: \{/m.test(CHA),
   'Champions overrides neither Parting Shot, Future Sight, `futuremove` nor Flash Fire');
ok(/move\.accuracy\s*=\s*true/.test(String(D.abilities.get('flashfire').onTryHit || '')),
   'Flash Fire\'s `onTryHit` writes `move.accuracy = true` on the shared ActiveMove');
const BP = D.items.get('brightpowder');
ok(legal(BP) && typeof BP.onModifyAccuracy === 'function', 'Bright Powder is legal and carries `onModifyAccuracy`');
for (const id of ['partingshot', 'futuresight', 'doubleteam', 'heatwave']) {
  const m = D.moves.get(id);
  ok(legal(m), m.name + ' is legal (accuracy ' + m.accuracy + ', target ' + m.target + ')');
}

/* ==================================================================================================
 * 1. THE CAST
 * ============================================================================================== */
console.log(NL + '1. THE CAST');
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const learns = (sp, mv) => !!CS.canLearn(sp, mv);
const fnKeys = o => Object.keys(o).filter(k => /^on[A-Z]/.test(k) && typeof o[k] === 'function');
/* The subject's ability may declare only handlers that cannot touch a staged line here. `onTryBoost`
 * is NOT in the set: it would refuse Parting Shot's drop, which is a second reason on the red arms. */
const HARMLESS = /^on(ModifySpe|SetStatus|TryAddVolatile|Immunity|DragOut|TrapPokemon|MaybeTrapPokemon|FoeTrapPokemon|FoeMaybeTrapPokemon|Update|CheckShow)$/;
const quietAb = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a))
  .find(a => a.exists && fnKeys(a).every(k => HARMLESS.test(k))) || null;
const bulk = s => s.baseStats.hp + s.baseStats.def + s.baseStats.spd;
const rawLearnset = sp => ((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {};
const selfBoost = m => legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts
  && !Object.keys(m.boosts).some(k => k === 'accuracy' || k === 'evasion') && !fnKeys(m).length
  && !m.heal && !m.volatileStatus && !m.self && !m.secondary && !m.stallingMove && !m.sideCondition
  && !m.weather && !m.terrain && !m.pseudoWeather;
const selfMoves = sp => Object.keys(rawLearnset(sp)).map(id => D.moves.get(id)).filter(selfBoost)
  .filter(m => learns(sp, m.id)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 2);
/* A FILLER may alternate its one self-boost with Protect — the two clicks are never consecutive, so the
 * stall die is never asked. The SUBJECT may not (`needTwo`): it is the target on the turn it clicks its
 * second move, and a Protect there would stage a shield instead of an accuracy roll. */
function body(species, ability, lead, needTwo) {
  const s = selfMoves(species).map(m => m.id);
  if (s.length < 2 && !needTwo && learns(species, 'protect')) s.push('protect');
  if (s.length < 2) { console.log('  NOT STAGED — ' + species + ' has fewer than two legal self-boost moves'
    + (needTwo ? '' : ' and cannot learn Protect')); process.exit(1); }
  for (const mv of lead) if (!learns(species, mv)) { console.log('  NOT STAGED — ' + species + ' does not learn ' + mv); process.exit(1); }
  const sp = D.species.get(species);
  if (!Object.values(sp.abilities).map(a => D.abilities.get(a).id).includes(D.abilities.get(ability).id)) {
    console.log('  NOT STAGED — ' + species + ' does not have ' + ability); process.exit(1);
  }
  return { species, ability, lead, s1: s[0], s2: s[1], moves: lead.concat([D.moves.get(s[0]).name, D.moves.get(s[1]).name]) };
}
const set = (b, item) => ({ species: b.species, item: item || '', ability: b.ability, moves: b.moves });
/* the fixed bodies are the two existing probes' own species and abilities; only their moves are re-derived */
const SHOOTER = body('incineroar', 'Blaze', ['Parting Shot']);
const A_BENCH = [body('milotic', 'Marvel Scale', []), body('clefable', 'Unaware', []), body('garchomp', 'Rough Skin', [])];
const KING = body('slowking', 'Oblivious', ['Future Sight']);
const K_TAIL = [body('clefable', 'Unaware', []), body('milotic', 'Marvel Scale', []), body('corviknight', 'Pressure', [])];
const B_TAIL = [body('milotic', 'Marvel Scale', []), body('toxapex', 'Regenerator', []), body('weavile', 'Pressure', [])];
/* THE HEAT WAVE ARMS. The pool cards' own pair is a Charizard and a Flash Fire body; the absorber here is
 * Arcanine because it carries Flash Fire AND a control ability that has no opinion about a Fire hit
 * (Justified answers Dark moves only), so the knob is cleared on the SAME body. */
const FIRER = body('charizard', 'Blaze', ['Heat Wave']);
const ABSORBER_FF = body('arcanine', 'Flash Fire', []), ABSORBER_CTL = body('arcanine', 'Justified', []);
const TAKEN = new Set(['incineroar', 'milotic', 'clefable', 'garchomp', 'slowking', 'corviknight', 'toxapex', 'weavile', 'charizard', 'arcanine']);
const SUBJECTS = D.species.all().filter(s => legal(s) && !s.isMega && !s.battleOnly && !TAKEN.has(s.id)
  && !(s.types || []).includes('Dark') && quietAb(s) && learns(s.name, 'doubleteam') && selfMoves(s.name).length >= 2
  && D.getEffectiveness('Fire', s) < 0)
  .sort((a, b) => bulk(b) - bulk(a) || a.name.localeCompare(b.name));
console.log('     subjects (not Dark, resist Fire, a quiet ability, learn Double Team and two self-boosts), bulkiest first: '
  + SUBJECTS.slice(0, 6).map(s => s.name + ' (' + quietAb(s).name + ')').join(', '));
if (!SUBJECTS.length) { console.log('  NOT STAGED — no legal subject.'); process.exit(1); }
const SUBJ = body(SUBJECTS[0].name, quietAb(SUBJECTS[0]).name, ['Double Team'], true);
console.log('     subject       : ' + SUBJ.species + ' (' + SUBJ.ability + ', ' + SUBJECTS[0].types.join('/') + ')');
for (const b of [SHOOTER, KING, FIRER, ABSORBER_FF, ABSORBER_CTL, SUBJ].concat(A_BENCH, K_TAIL, B_TAIL))
  console.log('       ' + (b.species + ' / ' + b.ability).padEnd(26) + ' ' + b.moves.join(', '));

const c = id => ({ m: id });
const PS = { m: 'partingshot', t: 0 }, FSK = { m: 'futuresight', t: 0 }, DT = { m: 'doubleteam' }, HW = { m: 'heatwave' };
const [A1, K1, B1] = [A_BENCH[0], K_TAIL[0], B_TAIL[0]];
const MIL = K_TAIL[1];
const PS_SCRIPT = (evade) => [
  { p1: [c(SHOOTER.s1), c(A1.s1)], p2: [evade ? DT : c(SUBJ.s1), c(B1.s1)] },
  { p1: [PS, c(A1.s2)], p2: [c(SUBJ.s2), c(B1.s2)] },
];
const FS_SCRIPT = (evade, benched) => [
  { p1: [FSK, c(K1.s1)], p2: [evade ? DT : c(SUBJ.s1), c(B1.s1)] },
  { p1: [benched ? { sw: MIL.species } : c(KING.s1), c(K1.s2)], p2: [c(SUBJ.s2), c(B1.s2)] },
  { p1: [benched ? c(MIL.s1) : c(KING.s2), c(K1.s1)], p2: [c(SUBJ.s1), c(B1.s1)] },
];
const HW_SCRIPT = (abs) => [{ p1: [HW, c(A1.s1)], p2: [c(abs.s1), c(SUBJ.s1)] }];
const PS_A = [set(SHOOTER)].concat(A_BENCH.map(b => set(b))), FS_A = [set(KING)].concat(K_TAIL.map(b => set(b)));
const HW_A = [set(FIRER)].concat(A_BENCH.map(b => set(b)));
const B = item => [set(SUBJ, item)].concat(B_TAIL.map(b => set(b)));
const HW_B = abs => [set(abs), set(SUBJ)].concat(B_TAIL.slice(1).map(b => set(b)));
const ARMS = [
  { id: 'PS-CONTROL', kind: 'ctl', A: PS_A, B: B(''), script: PS_SCRIPT(false) },
  { id: 'PS-POWDER', kind: 'red', A: PS_A, B: B('Bright Powder'), script: PS_SCRIPT(false) },
  { id: 'PS-EVASION', kind: 'red', A: PS_A, B: B(''), script: PS_SCRIPT(true) },
  { id: 'FS-CONTROL', kind: 'ctl', A: FS_A, B: B(''), script: FS_SCRIPT(false, false) },
  { id: 'FS-POWDER', kind: 'red', A: FS_A, B: B('Bright Powder'), script: FS_SCRIPT(false, false) },
  { id: 'FS-EVASION', kind: 'red', A: FS_A, B: B(''), script: FS_SCRIPT(true, false) },
  { id: 'FS-BENCHED', kind: 'red', A: FS_A, B: B('Bright Powder'), script: FS_SCRIPT(false, true) },
  { id: 'HW-CONTROL', kind: 'ctl', A: HW_A, B: HW_B(ABSORBER_CTL), script: HW_SCRIPT(ABSORBER_CTL) },
  { id: 'HW-FLASHFIRE', kind: 'red', A: HW_A, B: HW_B(ABSORBER_FF), script: HW_SCRIPT(ABSORBER_FF) },
];

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness(MEDI_SRC_PATH ? fs.readFileSync(MEDI_SRC_PATH, 'utf8') : undefined);
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('  NOT STAGED — the top arm is not in ARM_BY_ID.'); process.exit(1); }
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const CNT = ['pivotAccDrawn', 'pivotMissed', 'delayedHitAccDrawn', 'delayedHitMissed', 'accTrueByTryHit'];
const STAMPS = ['pivotNoAccuracyRestored', 'delayedHitNoAccuracyRestored', 'absorbAccLocalRestored'];
const snap = () => { const o = {}; for (const k of CNT) o[k] = M.MEDSEEN[k] || 0;
  for (const k of STAMPS) o[k] = M.MEDFAILS[k] || 0; o.offField = M.MEDFAILS.traceBodyOffField || 0; return o; };
const pick = (xs, re) => xs.filter(l => re.test(l));
function play(arm) {
  const a = G.buildPair(arm.A), b = G.buildPair(arm.B);
  if (!a || !b || a.length !== arm.A.length || b.length !== arm.B.length) return { staged: false, why: 'buildPair dropped a body' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const c0 = snap();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_accuracy_roads :: ' + arm.id, { script: arm.script, arm: ARM,
    onBoundary: (s, ti) => {
      boards.push({ turn: ti, compared: s.leaves_compared, diffs: (s.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      s.identical = true; s.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== arm.script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + arm.script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const c1 = snap(), cd = {};
  for (const k of CNT) cd[k] = c1[k] - c0[k];
  for (const k of STAMPS) cd[k] = c1[k];
  cd.offField = c1.offField - c0.offField;
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const low = xs => xs.map(l => l.toLowerCase());
  return { staged: true, sd, me, c: cd,
           sdMiss: low(pick(sd, /^\|-miss\|/)), meMiss: low(pick(me, /^\|-miss\|/)),
           sdUnb: pick(sd, /^\|-unboost\|p2a/).length, meUnb: pick(me, /^\|-unboost\|p2a/).length,
           sdEnd: pick(sd, /^\|-end\|p2a[^|]*\|move: future ?sight/i).length, meEnd: pick(me, /^\|-end\|p2a[^|]*\|move: future ?sight/i).length,
           sdFF: pick(sd, /^\|-start\|p2a[^|]*\|ability: flash ?fire/i).length, meFF: pick(me, /^\|-start\|p2a[^|]*\|ability: flash ?fire/i).length,
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.slice(0, 4).join(', ')).join(' | '),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}
console.log(NL + '2. THE ARMS');
const R = {};
for (const arm of ARMS) {
  const x = R[arm.id] = play(arm);
  if (!x.staged) { console.log('  NOT STAGED (' + arm.id + ') — ' + x.why); process.exit(1); }
  console.log('  === ' + arm.id + ' ===');
  console.log('    -miss        showdown ' + JSON.stringify(x.sdMiss) + '   medicham2 ' + JSON.stringify(x.meMiss));
  console.log('    -unboost p2a showdown x' + x.sdUnb + '  medicham2 x' + x.meUnb + '      -end future sight  showdown x' + x.sdEnd + '  medicham2 x' + x.meEnd
    + '      flash fire start  showdown x' + x.sdFF + '  medicham2 x' + x.meFF);
  console.log('    boards: ' + x.boardDiffs + ' diff(s)' + (x.boardDetail ? '   ' + x.boardDetail : ''));
  console.log('    counters: ' + CNT.map(k => k + ' +' + x.c[k]).join(', ') + '   traceBodyOffField +' + x.c.offField);
  console.log('    first protocol divergence: ' + (x.div ? JSON.stringify(x.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');
const same = (x, y) => x.length === y.length && x.every((l, i) => l === y[i]);
/* the authority first — the expectations, independent of the knobs */
ok(R['PS-CONTROL'].sdMiss.length === 0 && R['PS-CONTROL'].sdUnb === 2, 'PS-CONTROL — the authority lands Parting Shot (both drops) on the bare subject');
ok(R['PS-POWDER'].sdMiss.length === 1 && R['PS-POWDER'].sdUnb === 0, 'PS-POWDER — the authority MISSES the Bright Powder subject (100 x 0.9 under a missing die)');
ok(R['PS-EVASION'].sdMiss.length === 1 && R['PS-EVASION'].sdUnb === 0, 'PS-EVASION — the authority MISSES the +1 evasion subject');
ok(R['FS-CONTROL'].sdMiss.length === 0 && R['FS-CONTROL'].sdEnd === 1, 'FS-CONTROL — the payout lands on the bare subject');
for (const id of ['FS-POWDER', 'FS-EVASION', 'FS-BENCHED'])
  ok(R[id].sdMiss.length === 1 && R[id].sdEnd === 1, id + ' — the payout announces its `-end` and then MISSES', JSON.stringify(R[id].sdMiss));
ok(/^\|-miss\|p1: slowking\|p2a: /.test(R['FS-BENCHED'].sdMiss[0] || ''), 'FS-BENCHED — the authority names the OFF-FIELD booker side-only (`p1: Slowking`)', R['FS-BENCHED'].sdMiss[0]);
ok(R['HW-CONTROL'].sdMiss.length === 2 && R['HW-CONTROL'].sdFF === 0, 'HW-CONTROL — with no absorber the authority misses BOTH targets (90 under a missing die)', JSON.stringify(R['HW-CONTROL'].sdMiss));
ok(R['HW-FLASHFIRE'].sdMiss.length === 0 && R['HW-FLASHFIRE'].sdFF === 1, 'HW-FLASHFIRE — Arcanine absorbs, and the authority lands on the subject WITHOUT a roll', JSON.stringify(R['HW-FLASHFIRE'].sdMiss));
/* this engine against it */
for (const arm of ARMS) {
  const x = R[arm.id], mustMatch = arm.kind === 'ctl' || !KNOB;
  const s = same(x.sdMiss, x.meMiss) && x.sdUnb === x.meUnb && x.sdEnd === x.meEnd && x.sdFF === x.meFF;
  ok(mustMatch ? s : !s, arm.id + ' — every `-miss`, `-unboost`, payout `-end` and Flash Fire line matches the authority'
     + (mustMatch ? '' : '   [expected to DIFFER: the knobs are armed]'),
     s ? null : 'showdown ' + JSON.stringify(x.sdMiss) + ' unb ' + x.sdUnb + ' end ' + x.sdEnd + ' ff ' + x.sdFF
              + '\nmedicham2 ' + JSON.stringify(x.meMiss) + ' unb ' + x.meUnb + ' end ' + x.meEnd + ' ff ' + x.meFF);
  ok(mustMatch ? x.boardDiffs === 0 : x.boardDiffs > 0,
     arm.id + ' — the BOARDS ' + (mustMatch ? 'stay identical at every boundary' : 'PART (the knobs are armed)'),
     x.boardDiffs + ' diff(s)' + (x.boardDetail ? ': ' + x.boardDetail : ''));
}
if (!KNOB) {
  const ps = ['PS-CONTROL', 'PS-POWDER', 'PS-EVASION'], fsA = ['FS-CONTROL', 'FS-POWDER', 'FS-EVASION', 'FS-BENCHED'];
  ok(ps.every(id => R[id].c.pivotAccDrawn === 1), 'every Parting Shot arm drew exactly ONE accuracy die on the pivot road',
     ps.map(id => id + ' +' + R[id].c.pivotAccDrawn).join('  '));
  ok(R['PS-CONTROL'].c.pivotMissed === 0 && R['PS-POWDER'].c.pivotMissed === 1 && R['PS-EVASION'].c.pivotMissed === 1,
     'the pivot road missed on exactly the two red arms', ps.map(id => id + ' +' + R[id].c.pivotMissed).join('  '));
  ok(fsA.every(id => R[id].c.delayedHitAccDrawn === 1), 'every Future Sight arm drew exactly ONE accuracy die on the payout road',
     fsA.map(id => id + ' +' + R[id].c.delayedHitAccDrawn).join('  '));
  ok(R['FS-CONTROL'].c.delayedHitMissed === 0 && fsA.slice(1).every(id => R[id].c.delayedHitMissed === 1),
     'the payout road missed on exactly the three red arms', fsA.map(id => id + ' +' + R[id].c.delayedHitMissed).join('  '));
  ok(R['HW-FLASHFIRE'].c.accTrueByTryHit === 1 && R['HW-CONTROL'].c.accTrueByTryHit === 0,
     'exactly ONE roll was made sure by the absorb, on HW-FLASHFIRE, and none on its control',
     'HW-FLASHFIRE +' + R['HW-FLASHFIRE'].c.accTrueByTryHit + '  HW-CONTROL +' + R['HW-CONTROL'].c.accTrueByTryHit);
}
ok(ARMS.every(a => R[a.id].c.offField === 0), 'no trace line named a body with no side (`traceBodyOffField` did not move)',
   ARMS.map(a => a.id + ' +' + R[a.id].c.offField).join('  '));
const st = R['PS-CONTROL'].c;
ok(KNOB ? STAMPS.every(k => st[k] === 1) : STAMPS.every(k => !st[k]),
   'the knobs mark their own run — a restored engine cannot be mistaken for a fixed one',
   STAMPS.map(k => k + ' = ' + st[k]).join(', '));

if (!CHILD) {
  console.log(NL + '4. THE KNOB CHILD (' + KNOBS.map(k => k + '=1').join(' ') + ')');
  const env = Object.assign({}, process.env); for (const k of KNOBS) env[k] = '1';
  const ch = spawnSync(process.execPath, [__filename, ...process.argv.slice(2), '--knob-child'],
    { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
  const out = String(ch.stdout || '') + String(ch.stderr || '');
  for (const l of out.split('\n').filter(l => /^\s+(green|RED)\s/.test(l) && /PS-|FS-|HW-|knobs/.test(l))) console.log('    child' + l);
  ok(ch.status === 0, 'under the knobs the child sees every red arm PART and every control HOLD — the knobs restore exactly the defects',
     'child exit ' + ch.status + (ch.error ? ' (' + ch.error.message + ')' : ''));
}
console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
