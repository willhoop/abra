/* probe_round_promotion.js — ROUND PULLS THE NEXT QUEUED ROUND FORWARD AND DOUBLES IT. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_round_promotion.js
 *   SHOWDOWN_PATH=... node tests/probe_round_promotion.js --only partner
 *   SHOWDOWN_PATH=... node tests/probe_round_promotion.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * `data/game-differential.g1350.json` (release 482e8f5ca701) parted a board on
 * `p2.party.staraptor.hp medicham 103 showdown 95`, first protocol split `|move|p1b|round <>
 * |move|p2b|bravebird`: a Sylveon Rounds, and the authority moves the partner Dragapult's Round up to
 * straight after it (`|move|p1b: Dragapult|Round|p2b: Staraptor|[from] move: Round`) at double power,
 * where this engine let the Staraptor move in speed order and priced the second Round at 60.
 *
 * THE AUTHORITY (data/moves.ts:15493-15517; `data/mods/champions/moves.ts` has no round row):
 *
 *     basePowerCallback(target, source, move) { if (move.sourceEffect === 'round') return move.basePower * 2; ... }
 *     onTry(source, target, move) {
 *       for (const action of this.queue.list) {
 *         if (!action.pokemon || !action.move || action.maxMove || action.zmove) continue;
 *         if (action.move.id === 'round') { this.queue.prioritizeAction(action, move); return; }
 *       }
 *     },
 *
 * `prioritizeAction` (sim/battle-queue.ts:277-286) stamps `sourceEffect` and `order = 3` and puts the
 * action at the head of what remains. The loop has NO SIDE TEST: a FOE's queued Round is promoted too.
 *
 * ================= THE ARMS ====================================================================
 *
 *   partner        RED. Fast and slow partners both Round the same foe; a mid-speed foe attacks in
 *                  between. The slow Round must jump the foe, at 120.
 *   foe-round      RED. The SLOW Round user is on the OTHER side. The authority promotes it anyway.
 *   chain          RED. Three Round users. The first promotes the second, which promotes the third.
 *   into-protect   RED. The first Round is aimed at a Protecting foe. `onTry` sits above every hit
 *                  step, so the partner is still promoted.
 *   no-second      CONTROL. The slow partner clicks an ordinary attack. Nothing is promoted.
 *
 * `MEDI_ROUND_UNPROMOTED=1` restores the pre-fix engine and must part exactly the four red arms. Stamp:
 * `MEDFAILS.roundUnpromotedRestored`. The judgement has NO typed expectation: an arm passes when the
 * two engines' `|move|` order and the board agree. The red arms additionally assert the authority wrote
 * at least one `[from] move: Round` line, so an arm that stopped staging the shape cannot read green.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_round_promotion.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_ROUND_UNPROMOTED';
const STAMP = 'roundUnpromotedRestored';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE FIXTURE, DERIVED FROM THE FORMAT — no species is typed ------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (s, mv) => {
  const e = LS[s.id] || (s.baseSpecies && s.baseSpecies !== s.name ? LS[dex.species.get(s.baseSpecies).id] : null);
  return !!(e && e.learnset && e.learnset[dex.moves.get(mv).id]);
};
const QUIET = ['onStart', 'onSwitchIn', 'onModifyPriority', 'onFractionalPriority', 'onUpdate', 'onTryHit',
  'onAllyTryHitSide', 'onModifySpe', 'onResidual', 'onDamagingHit', 'onSetStatus', 'onTryBoost', 'onSwitchOut',
  'onBeforeMove', 'onModifyMove', 'onModifyType', 'onBasePower', 'onModifyAtk', 'onModifySpA', 'onModifyDef',
  'onModifySpD', 'onSourceModifyDamage', 'onModifyDamage', 'onDamage', 'onAnyModifyDamage', 'onEffectiveness',
  'onSourceBasePower', 'onAnyBasePower', 'onFoeTryMove', 'onAnyTryPrimaryHit', 'onCriticalHit'];
const quiet = a => { const x = dex.abilities.get(a); return x.exists && QUIET.every(h => !x[h]); };
const SPECIES = dex.species.all().filter(s => legal(s) && !/-Mega/.test(s.name)).sort((a, b) => a.name.localeCompare(b.name));
const quietAb = s => Object.values(s.abilities).find(quiet);
const notGhost = s => !s.types.includes('Ghost');
const ROUNDERS = SPECIES.filter(s => learns(s, 'round') && learns(s, 'protect') && quietAb(s))
  .sort((a, b) => a.baseStats.spe - b.baseStats.spe || a.name.localeCompare(b.name));
/* A priority-0, single-target, perfectly accurate damaging move with no secondary: the plain attack. */
const plainAttack = s => {
  const e = LS[s.id]; if (!e || !e.learnset) return null;
  return Object.keys(e.learnset).map(id => dex.moves.get(id))
    .filter(m => legal(m) && m.category !== 'Status' && m.priority === 0 && m.target === 'normal' && m.accuracy === true
      && !m.secondary && !m.secondaries && !m.multihit && !m.onTry && !m.onHit && !m.onAfterHit && !m.onAfterMoveSecondarySelf
      && !m.basePowerCallback && !m.self && m.basePower > 0
      && m.id !== 'round' && !m.flags.charge && !m.recoil && !m.drain && !m.selfSwitch && m.type !== 'Normal')
    .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
};
const n = ROUNDERS.length;
const SLOW = ROUNDERS[0], SLOW2 = ROUNDERS[1], FAST = ROUNDERS[n - 1];
/* the foe that must be jumped: strictly between SLOW and FAST, with a plain attack of its own */
const MIDS = ROUNDERS.filter(s => s.baseStats.spe > SLOW2.baseStats.spe + 10 && s.baseStats.spe < FAST.baseStats.spe - 10 && plainAttack(s));
const MID = MIDS[Math.floor(MIDS.length / 2)];
/* bulky, non-Ghost (Round is Normal), and carrying a quiet ability the fixture assigns explicitly */
const TARGETS = SPECIES.filter(s => learns(s, 'protect') && quietAb(s) && notGhost(s)
  && s.baseStats.hp >= 80 && ![SLOW.id, SLOW2.id, FAST.id, MID && MID.id].includes(s.id));
if (!SLOW || !SLOW2 || !FAST || !MID || TARGETS.length < 4) {
  console.log('NOT RUN — the format no longer supplies this fixture. That is a finding, not a pass.');
  process.exit(2);
}
const MIDMOVE = plainAttack(MID);
/* An IDLE click for a body that is aimed at: a self-only stat boost, no other effect. A pass is refused by
 * the authority for a body that can move, and a Protect would block the Round the arm is measuring. */
const selfBoost = s => {
  const e = LS[s.id]; if (!e || !e.learnset) return null;
  return Object.keys(e.learnset).map(id => dex.moves.get(id))
    .filter(m => legal(m) && m.category === 'Status' && m.target === 'self' && m.boosts && !m.onHit && !m.onTry
      && !m.volatileStatus && !m.heal && !m.selfSwitch && m.priority === 0)
    .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
};
const TGTS = TARGETS.filter(selfBoost);
const TGT = TGTS[0], TGT2 = TARGETS.find(s => s.id !== TGT.id);
const IDLE = selfBoost(TGT);
/* the control's slow partner: a Round learner slower than the mid foe WITH a plain attack, so the only
 * thing that differs from the red arm is that its click is not a Round */
const SLOWATK = ROUNDERS.find(s => plainAttack(s) && s.baseStats.spe < MID.baseStats.spe - 10
  && ![FAST.id, MID.id, TGT.id].includes(s.id));
const row = (s, moves) => ({ species: s.name, item: '', ability: quietAb(s) || Object.values(s.abilities)[0], moves });
const RP = ['Round', 'Protect'];
const TEAMS = {
  pair: [row(FAST, RP), row(SLOW, RP), row(TARGETS[2], ['Protect']), row(TARGETS[3], ['Protect'])],
  pairAtk: [row(FAST, RP), row(SLOWATK, ['Round', 'Protect', plainAttack(SLOWATK).name]),
    row(TARGETS[2], ['Protect']), row(TARGETS[3], ['Protect'])],
  lone: [row(FAST, RP), row(TGT2, ['Protect']), row(TARGETS[2], ['Protect']), row(TARGETS[3], ['Protect'])],
  trio: [row(FAST, RP), row(SLOW2, RP), row(TARGETS[2], ['Protect']), row(TARGETS[3], ['Protect'])],
  foes: [row(TGT, ['Protect', IDLE.name]), row(MID, [MIDMOVE.name, 'Protect']), row(TARGETS[4] || TARGETS[2], ['Protect']), row(TARGETS[5] || TARGETS[3], ['Protect'])],
  foesRound: [row(TGT, ['Protect', IDLE.name]), row(SLOW, RP), row(MID, [MIDMOVE.name, 'Protect']), row(TARGETS[5] || TARGETS[3], ['Protect'])],
};
console.log(NL + '  DERIVED FROM THE FORMAT, NOT TYPED:');
for (const [k, s] of [['fast Round', FAST], ['slow Round', SLOW], ['2nd-slow Round', SLOW2], ['mid foe', MID], ['target', TGT]])
  console.log('    ' + k.padEnd(15) + s.name + ' (base spe ' + s.baseStats.spe + ', ' + (quietAb(s) || '-') + ')');
console.log('    target idle    ' + IDLE.name);
console.log('    mid foe attack ' + MIDMOVE.name + '    control partner ' + (SLOWATK ? SLOWATK.name + ' (base spe ' + SLOWATK.baseStats.spe + ') / ' + plainAttack(SLOWATK).name : 'NONE'));
const TAGS = require(D('engine', 'tags.js'));
console.log('    tag promotesSameMoveInQueue on round : ' + JSON.stringify(TAGS.param('move', 'round', 'promotesSameMoveInQueue')));

const R0 = { m: 'round', t: 0 }, PR = { m: 'protect' }, MA = { m: MIDMOVE.id, t: 0 }, ID = { m: IDLE.id };
const SA = SLOWATK ? { m: plainAttack(SLOWATK).id, t: 0 } : null;
const CASES = [
  { id: 'partner', kind: 'red', A: 'pair', B: 'foes', script: [{ p1: [R0, R0], p2: [ID, MA] }] },
  { id: 'foe-round', kind: 'red', A: 'lone', B: 'foesRound', script: [{ p1: [R0, PR], p2: [ID, R0] }] },
  { id: 'chain', kind: 'red', A: 'trio', B: 'foesRound', script: [{ p1: [R0, R0], p2: [ID, R0] }] },
  { id: 'into-protect', kind: 'red', A: 'pair', B: 'foes', script: [{ p1: [R0, { m: 'round', t: 1 }], p2: [PR, MA] }] },
  { id: 'no-second', kind: 'control', A: 'pairAtk', B: 'foes', script: [{ p1: [R0, SA], p2: [ID, MA] }] },
];

/* ---- READING BOTH STREAMS -------------------------------------------------------------------- */
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const flat = xs => (xs || []).map(l => Array.isArray(l) ? '|' + l.join('|') : String(l));
function readout(lines) {
  const order = [], dmg = [];
  let fromRound = 0, skip = 0;
  /* `|split|` precedes a SECRET line and its PUBLIC twin; read the secret one, drop the twin. */
  for (const l of flat(lines)) {
    const p = l.split('|');
    if (p[1] === 'split') { skip = 2; continue; }
    if (skip === 1) { skip = 0; continue; }
    if (skip === 2) skip = 1;
    if (p[1] === 'move') { order.push(String(p[2]).slice(0, 3) + norm(p[3])); if (/\[from\]\s*move:\s*round/i.test(l)) fromRound++; }
    if (p[1] === '-damage' && !/\[from\]/.test(l)) dmg.push(String(p[2]).slice(0, 3) + String(p[3]).split('/')[0]);
  }
  return { order: order.join(' '), dmg: dmg.join(' '), fromRound };
}
function play(G, c) {
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  const a = G.buildPair(TEAMS[c.A]), b = G.buildPair(TEAMS[c.B]);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  let sdLog = null;
  const S0 = globalThis.MEDSEEN || {};
  const p0 = S0.sameMovePromoted || 0, w0 = S0.promotedPowerApplied || 0;
  const r = G.playGame(a, b, 'directed', 'probe_round_promotion :: ' + c.id, { script: c.script, arm,
    onBoundary: (snap, turnIdx, S, battle) => { sdLog = battle.log.slice(); } });
  const S1 = globalThis.MEDSEEN || {};
  return { r, sdLog, sd: readout(sdLog), med: readout(r.mediTrace), sc: G.scriptCounters(),
           restored: (globalThis.MEDFAILS || {})[STAMP] || 0,
           promoted: (S1.sameMovePromoted || 0) - p0, powered: (S1.promotedPowerApplied || 0) - w0 };
}

let bad = 0, ran = 0;
const knobParted = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']');
  if (c.kind === 'control' && !SA) { console.log('  NOT-STAGED — the slow partner learns no plain attack'); bad++; continue; }
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused side ' + clean.which); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  if (brk.notStaged || brk.r.err) { console.log('  NOT-STAGED / THREW under the knob ' + (brk.r && brk.r.err)); bad++; continue; }
  harness(false);
  ran++;
  const same = x => x.sd.order === x.med.order && x.sd.dmg === x.med.dmg && !x.r.stateDiv;
  console.log('    authority   order ' + clean.sd.order + '   dmg ' + clean.sd.dmg + '   [from] Round x' + clean.sd.fromRound);
  console.log('    medicham    order ' + clean.med.order + '   dmg ' + clean.med.dmg + '   [from] Round x' + clean.med.fromRound
    + '   (promoted ' + clean.promoted + ', doubled ' + clean.powered + ')');
  console.log('    knob        order ' + brk.med.order + '   dmg ' + brk.med.dmg + '   board ' + (brk.r.stateDiv ? 'PARTS' : 'agrees'));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '   knob ' + brk.restored);
  if (process.argv.includes('--dump')) {
    console.log('    --- authority ---' + NL + flat(clean.sdLog).map(l => '      ' + l).join(NL));
    console.log('    --- medicham ---' + NL + flat(clean.r.mediTrace).map(l => '      ' + l).join(NL));
  }
  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (c.kind === 'red' && clean.sd.fromRound === 0) { console.log('    >> FIXTURE FAILED — the authority promoted nothing; the arm does not stage the shape.'); bad++; continue; }
  if (c.kind === 'control' && clean.sd.fromRound !== 0) { console.log('    >> FIXTURE FAILED — the control promoted on the authority.'); bad++; continue; }
  if (!same(clean) || clean.sd.fromRound !== clean.med.fromRound) {
    console.log('    >> RED — the engines disagree with the fix in' + (clean.r.stateDiv ? ': ' + JSON.stringify(clean.r.stateDiv).slice(0, 300) : '.'));
    bad++; continue; }
  if (!same(brk)) knobParted.push(c.id);
  console.log('    OK');
}
console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
if (!ONLY) {
  const want = CASES.filter(c => c.kind === 'red').map(c => c.id).sort().join(',');
  const got = knobParted.slice().sort().join(',');
  console.log('knob parted: [' + got + ']   expected: [' + want + ']');
  if (got !== want) { console.log('>> THE KNOB DOES NOT ISOLATE THE DEFECT.'); bad++; }
}
console.log(bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
