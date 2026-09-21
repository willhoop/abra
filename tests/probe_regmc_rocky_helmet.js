#!/usr/bin/env node
/* tests/probe_regmc_rocky_helmet.js — ROCKY HELMET, UNDER REG M-C. 2026-09-21 (abra/regmc 0.17.0).
 *
 *   node tests/probe_regmc_rocky_helmet.js --regulation regmc                            # green, exit 0
 *   MEDI_ROCKY_HELMET_INERT=1 node tests/probe_regmc_rocky_helmet.js --regulation regmc  # RED, exit 1
 *   MEDI_ROCKY_HELMET_ONCE=1 node tests/probe_regmc_rocky_helmet.js --regulation regmc   # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * SHOWDOWN_PATH must be UNSET: the regulation brings its own checkout (engine/showdown_path.js). The release
 * is the NEWEST Reg M-C release; the probe refuses (exit 2) when that release's engine bytes are not the live
 * file. Cut one first: `node engine/engine_release.js cut "<why>" --regulation regmc`.
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/items.ts rockyhelmet :5295-5309 (the Champions mod does not name it)
 *       onDamagingHitOrder: 2,
 *       onDamagingHit(damage, target, source, move) {
 *         if (this.checkMoveMakesContact(move, source, target)) this.damage(source.baseMaxhp / 6, source, target);
 *       },
 *   data/mods/champions/scripts.ts:399-410 -- `runEvent('DamagingHit', damagedTargets, …)` once per arrival,
 *       only over targets that took a NUMBER (a doll's HIT_SUBSTITUTE is not one).
 *   sim/battle.ts:2091-2170 `spreadDamage` -- a target already on 0 HP takes nothing; the amount is
 *       clamped to >= 1 and floored; the line is `-damage|ATTACKER|hp|[from] item: Rocky Helmet|[of] HOLDER`.
 *   `compareLeftToRightOrder` (sim/battle.ts:421): a declared `onDamagingHitOrder` sorts before an
 *       undeclared one, so Rough Skin (order 1) pays FIRST, Rocky Helmet (order 2) second.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   CONTACT      a quiet attacker clicks a weak contact move into a Rocky Helmet holder.
 *   NONCONTACT   the same attacker clicks a weak NON-contact move. Nothing is paid. Catches "any hit".
 *   ROUGHSKIN    the holder carries Rough Skin too: the ability's toll, THEN the helmet's.
 *   VOLLEY       a fixed two-arrival contact move: two tolls, each under its own arrival.
 *   KO           two attackers hit a frail holder with contact moves in one turn and it falls; the killing
 *                blow is still tolled (the holder is on 0 HP, not yet `fainted`).
 *
 * PASS = in every arm the driver's first-protocol-divergence is NONE, every `-damage` line agrees in order,
 * and every board boundary compares identical; plus fixture checks on the AUTHORITY, and every staged set
 * legal under the Reg M-C TeamValidator (buildPair's own fixture check).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const NL = '\n';
if (!process.argv.includes('--regulation')) { process.argv.push('--regulation', 'regmc'); }
require(path.join(ROOT, 'engine', 'showdown_path.js'));
const REGN = require(path.join(ROOT, 'engine', 'regulation.js'));
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const MEDI_SRC_PATH = argOf('--medi', null);
const KNOBS = ['MEDI_ROCKY_HELMET_INERT', 'MEDI_ROCKY_HELMET_ONCE'].filter(k => process.env[k] === '1');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};
console.log(NL + 'tests/probe_regmc_rocky_helmet.js — Rocky Helmet, regulation ' + REGN.ID);
console.log('  knobs armed: ' + (KNOBS.length ? KNOBS.join(', ') + '   (the defect is RESTORED; this must exit 1)' : 'none'));
if (REGN.ID !== 'regmc') { console.log('  NOT RUN — this probe is a Reg M-C probe and ' + REGN.ID + ' is selected.'); process.exit(2); }

/* abra/regmc 0.18.0 -- a Reg M-C run needs a census pin to load the driver; see tests/regmc_probe_kit.js */
require(path.join(ROOT, 'tests', 'regmc_probe_kit.js')).scriptedCensusPin('probe_regmc_rocky_helmet');
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const G = SB.harness(MEDI_SRC_PATH ? fs.readFileSync(MEDI_SRC_PATH, 'utf8') : undefined);
{
  const strip = s => String(s).replace(/\r/g, '');
  const relBytes = strip(G.REL.read('engine/medicham2-browser.js'));
  const live = strip(fs.readFileSync(path.join(ROOT, 'engine', 'medicham2-browser.js'), 'utf8'));
  console.log('  release ' + G.REL.id + (MEDI_SRC_PATH ? '   engine bytes: ' + MEDI_SRC_PATH : ''));
  if (!MEDI_SRC_PATH && relBytes !== live) {
    console.log('  NOT RUN — the newest Reg M-C release does not hold the live engine. Cut one:\n'
      + '    node engine/engine_release.js cut "<why>" --regulation regmc');
    process.exit(2);
  }
}
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.log('  NOT STAGED — the bottom arm is not in ARM_BY_ID.'); process.exit(1); }
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });

/* ==================================================================================================
 * 1. THE CAST, DERIVED
 * ============================================================================================== */
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const D = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega && !s.battleOnly);
const learnset = s => ((D.species.getLearnsetData(s.id) || {}).learnset) || {};
const learns = (s, mv) => !!learnset(s)[mv];
const abil = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a).id);
/* abilities that react to being hit, touch HP, items, stats or the field -- the attacker and the holder must
 * carry none of them, so the only thing that can write a line on a hit is the item under test. */
const LOUD = new Set(['intimidate', 'pressure', 'unnerve', 'frisk', 'moldbreaker', 'teravolt', 'turboblaze', 'klutz',
  'pickpocket', 'magician', 'stickyhold', 'unburden', 'symbiosis', 'harvest', 'cudchew', 'ripen', 'gluttony',
  'contrary', 'simple', 'defiant', 'competitive', 'justified', 'stamina', 'weakarmor', 'berserk', 'angerpoint',
  'rattled', 'steadfast', 'mummy', 'lingeringaroma', 'wanderingspirit', 'cursedbody', 'illusion', 'disguise',
  'trace', 'imposter', 'grassysurge', 'psychicsurge', 'electricsurge', 'mistysurge', 'seedsower', 'drought',
  'drizzle', 'sandstream', 'snowwarning', 'mimicry', 'protean', 'libero', 'roughskin', 'ironbarbs', 'flamebody',
  'static', 'poisonpoint', 'effectspore', 'cutecharm', 'gooey', 'tanglinghair', 'aftermath', 'innardsout',
  'perishbody', 'wonderguard', 'sturdy', 'multiscale', 'regenerator', 'emergencyexit', 'wimpout', 'moxie',
  'beastboost', 'soulheart', 'airlock', 'cloudnine', 'neutralizinggas', 'download', 'intrepidsword',
  'dauntlessshield', 'anticipation', 'forewarn', 'costar', 'commander', 'zerotohero', 'hospitality',
  'supersweetsyrup', 'toxicdebris', 'sandspit', 'windpower', 'windrider', 'electromorphosis', 'dancer',
  'flowerveil', 'sweetveil', 'pastelveil', 'healer', 'friendguard', 'telepathy', 'goodasgold', 'magicbounce',
  'prankster', 'galewings', 'triage', 'quickdraw', 'stall', 'mycelium', 'myceliummight', 'naturalcure',
  'shedskin', 'hydration', 'poisonheal', 'guts', 'marvelscale', 'quickfeet', 'grasspelt', 'surgesurfer',
  'levitate', 'sapsipper', 'lightningrod', 'stormdrain', 'voltabsorb', 'waterabsorb', 'flashfire', 'motordrive',
  'dryskin', 'wellbakedbody', 'eartheater', 'purifyingsalt', 'thermalexchange', 'longreach', 'noguard',
  'superluck', 'sniper', 'serenegrace', 'sheerforce', 'shielddust', 'infiltrator', 'screencleaner', 'owntempo',
  'oblivious', 'synchronize', 'innerfocus', 'insomnia', 'vitalspirit', 'comatose', 'leafguard', 'chlorophyll',
  'solarpower', 'swiftswim', 'sandrush', 'slushrush', 'speedboost', 'moody', 'slowstart', 'truant', 'zenmode',
  'stancechange', 'schooling', 'powerconstruct', 'battlebond', 'gulpmissile', 'iceface', 'hungerswitch',
  'protosynthesis', 'quarkdrive', 'orichalcumpulse', 'hadronengine', 'magicguard', 'overcoat', 'bulletproof',
  'soundproof', 'damp', 'liquidooze', 'colorchange', 'receiver', 'powerofalchemy', 'opportunist', 'terashell',
  'terashift', 'teraformzero', 'sharpness', 'toughclaws', 'ironfist', 'reckless', 'rockhead', 'technician',
  'parentalbond', 'skilllink', 'hustle', 'compoundeyes', 'fluffy', 'furcoat', 'thickfat', 'heatproof',
  'filter', 'solidrock', 'prismarmor', 'shadowshield', 'icescales', 'punkrock', 'purifyingsalt', 'waterbubble']);
const quiet = s => abil(s).find(a => !LOUD.has(a)) || null;
const show = xs => xs.slice(0, 6).map(s => s.id).join(', ') + (xs.length > 6 ? ', …' : '');
/* a plain single-target damaging move: 100% or never-miss, no secondary, no self effect, no priority, no charge */
const plain = m => legal(m) && m.category !== 'Status' && m.target === 'normal' && !m.secondary && !m.secondaries
  && !m.self && !m.recoil && !m.drain && !m.flags.charge && !m.flags.recharge && !m.priority && !m.selfSwitch
  && !m.basePowerCallback && !m.damageCallback && !m.ohko && !m.selfdestruct && !m.volatileStatus && !m.onHit
  && !m.onAfterHit && !m.onTry && !m.onTryHit && !m.onBasePower && !m.onModifyMove && !m.onModifyType
  && !m.onModifyPriority && m.basePower >= 20 && !m.flags.futuremove;
const sure = m => m.accuracy === true || m.accuracy === 100;
/* the VOLLEY arm takes a fixed two-arrival contact move; no legal one is 100% accurate in this format (printed by
 * the cast block), so it takes the most accurate and the authority fixture check asserts both arrivals landed */
const hitFor = (att, tgt, contact, multihit) => D.moves.all().filter(m => plain(m) && (multihit ? m.accuracy === true || m.accuracy >= 90 : sure(m)) && learns(att, m.id)
  && !!m.flags.contact === contact && (multihit ? m.multihit === multihit : !m.multihit)
  && D.getImmunity(m.type, tgt) && D.getEffectiveness(m.type, tgt) <= 0)
  .sort((a, b) => a.basePower - b.basePower)[0] || null;
const strongContact = (att, tgt) => D.moves.all().filter(m => plain(m) && sure(m) && learns(att, m.id) && m.flags.contact && !m.multihit
  && D.getImmunity(m.type, tgt)).sort((a, b) => (b.basePower * D.getEffectiveness(b.type, tgt)) - (a.basePower * D.getEffectiveness(a.type, tgt))
  || b.basePower - a.basePower)[0] || null;

/* the holder's own click: a self-targeted move that neither protects nor touches HP, so the foe's hit lands */
const idle = s => ['splash', 'celebrate', 'focusenergy', 'harden', 'defensecurl', 'withdraw', 'growl', 'tailwhip', 'leer']
  .map(x => D.moves.get(x)).find(m => legal(m) && learns(s, m.id) && m.target !== 'normal') || null;

const bulk = s => s.baseStats.hp + s.baseStats.def + s.baseStats.spd;
const HOLD = SPEC.filter(s => quiet(s) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
const FRAIL = SPEC.filter(s => !/['’]/.test(s.name) && quiet(s) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(a) - bulk(b));
const ROUGH = SPEC.filter(s => abil(s).includes('roughskin') && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
const ATT = SPEC.filter(s => quiet(s) && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));

console.log(NL + '1. THE CAST, DERIVED THIS RUN (' + CS.FORMAT + ')');
console.log('     holders (bulk first)   : ' + show(HOLD));
console.log('     Rough Skin carriers    : ' + show(ROUGH));
for (const [t, xs] of [['HOLD', HOLD], ['ROUGH', ROUGH], ['ATT', ATT], ['FILL', FILL]])
  if (!xs.length) { console.log('  NOT STAGED — no legal ' + t); process.exit(1); }
if (!legal(D.items.get('rockyhelmet'))) { console.log('  NOT STAGED — rockyhelmet is not legal in ' + CS.FORMAT); process.exit(1); }

const mon = (s, item, mv, ab) => ({ species: s.id, item: item || '', ability: ab || quiet(s), moves: mv });
const pickDistinct = (pool, used, n) => { const out = []; for (const s of pool) { if (used.has(s.baseSpecies) || used.has(s.id)) continue; out.push(s); used.add(s.baseSpecies); used.add(s.id); if (out.length === n) break; } return out; };

/* ==================================================================================================
 * 2. PLAYING AN ARM
 * ============================================================================================== */
const counters = () => ({ paid: M.MEDSEEN.rockyHelmetPaid || 0, refused: M.MEDSEEN.rockyHelmetRefusedIndirect || 0,
  unknown: M.MEDFAILS.itemPunishTriggerUnknown || 0 });
const canon = l => String(l).toLowerCase().replace(/[\s']/g, '');
const KEEP = /^\|(-damage|faint|switch|-enditem|-item)\|/;
const OWN = /^\|(-damage|faint)\|/;

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b || a.length !== A.length || b.length !== B.length) return { staged: false, why: 'buildPair dropped a body' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const c0 = counters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_regmc_rocky_helmet :: ' + tag, { script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const c1 = counters();
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const d = {}; for (const k in c1) d[k] = c1[k] - c0[k];
  return { staged: true, tag, turns: r.turns, sd, me, sdK: sd.filter(l => KEEP.test(l)).map(canon), meK: me.filter(l => KEEP.test(l)).map(canon),
    boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
    boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.slice(0, 6).join(', ')).join(' | '),
    div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, counters: d };
}
const P = { protect: { m: 'protect' } };
const helmets = R => R.sdK.filter(l => /^\|-damage\|/.test(l) && /rockyhelmet/.test(l));

/* ==================================================================================================
 * 3. THE ARMS
 * ============================================================================================== */
const used = new Set();
const holder = pickDistinct(HOLD, used, 1)[0];
/* the attacker: quiet, and carries both a plain contact hit and a plain non-contact hit into the holder */
const att = ATT.find(s => !used.has(s.baseSpecies) && hitFor(s, holder, true) && hitFor(s, holder, false));
if (!att) { console.log('  NOT STAGED — no attacker with a plain contact AND a plain non-contact hit into ' + holder.id); process.exit(1); }
used.add(att.baseSpecies); used.add(att.id);
const fills = pickDistinct(FILL, used, 4);
const cHit = hitFor(att, holder, true), nHit = hitFor(att, holder, false);
console.log('     holder ' + holder.id + ' (' + quiet(holder) + ')   attacker ' + att.id + ' (' + quiet(att) + '): contact ' + cHit.id + ', non-contact ' + nHit.id);

function arm(tag, holderMon, attMon, hitId, extraTurns) {
  const hIdle = idle(D.species.get(holderMon.species));
  if (!hIdle) return { staged: false, why: holderMon.species + ' learns no idle self move' };
  holderMon.moves = ['Protect', hIdle.name];
  const A = [holderMon, mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [attMon, mon(fills[3], '', ['Protect']), mon(fills[2] === fills[3] ? fills[1] : fills[2], '', ['Protect']), mon(fills[1], '', ['Protect'])];
  const script = [{ p1: [{ m: hIdle.id }, P.protect], p2: [{ m: hitId, t: 0 }, P.protect] }];
  for (let i = 0; i < (extraTurns || 0); i++) script.push(script[0]);
  return play(tag, A, B, script);
}

const RUNS = [];
const CT = arm('contact', mon(holder, 'rockyhelmet', []), mon(att, '', [cHit.name, 'Protect']), cHit.id);
const NC = arm('noncontact', mon(holder, 'rockyhelmet', []), mon(att, '', [nHit.name, 'Protect']), nHit.id);
RUNS.push(['CONTACT', CT], ['NONCONTACT', NC]);

/* ROUGHSKIN: a Rough Skin carrier holding the helmet; an attacker with a plain contact hit into it */
let RS = null;
for (const r of ROUGH) {
  if (used.has(r.baseSpecies)) continue;
  const a2 = ATT.find(s => !used.has(s.baseSpecies) && s.baseSpecies !== r.baseSpecies && hitFor(s, r, true));
  if (!a2) continue;
  const h = hitFor(a2, r, true);
  RS = arm('roughskin', mon(r, 'rockyhelmet', [], 'roughskin'), mon(a2, '', [h.name, 'Protect']), h.id);
  RS.cast = r.id + ' <- ' + a2.id + ' (' + h.id + ')';
  if (RS.staged) break;
}
if (RS) RUNS.push(['ROUGHSKIN', RS]);

/* VOLLEY: a fixed two-arrival contact move */
let VL = null;
for (const s of ATT) {
  if (used.has(s.baseSpecies)) continue;
  const h = hitFor(s, holder, true, 2);
  if (!h) continue;
  VL = arm('volley', mon(holder, 'rockyhelmet', []), mon(s, '', [h.name, 'Protect']), h.id);
  VL.cast = holder.id + ' <- ' + s.id + ' (' + h.id + ')';
  if (VL.staged) break;
}
if (VL) RUNS.push(['VOLLEY', VL]);

/* KO: a frail holder; both foes hit it with their strongest plain contact move every turn until it falls */
let KO = null;
for (const fr of FRAIL.slice(0, 12)) {
  if (used.has(fr.baseSpecies)) continue;
  const hIdle = idle(fr);
  if (!hIdle) continue;
  const u = new Set([...used, fr.baseSpecies, fr.id]);
  const two = ATT.filter(s => !u.has(s.baseSpecies) && strongContact(s, fr)).slice(0, 40)
    .sort((a, b) => b.baseStats.atk - a.baseStats.atk);
  const [x, y] = pickDistinct(two, u, 2);
  if (!x || !y) continue;
  const hx = strongContact(x, fr), hy = strongContact(y, fr);
  const fl = pickDistinct(FILL, u, 3);
  const A = [mon(fr, 'rockyhelmet', ['Protect', hIdle.name]), mon(fl[0], '', ['Protect']), mon(fl[1], '', ['Protect']), mon(fl[2], '', ['Protect'])];
  const B = [mon(x, '', [hx.name, 'Protect']), mon(y, '', [hy.name, 'Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
  const t = { p1: [{ m: hIdle.id }, P.protect], p2: [{ m: hx.id, t: 0 }, { m: hy.id, t: 0 }] };
  const R = play('ko:' + fr.id, A, B, [t]);
  if (!R.staged) continue;
  if (!R.sdK.some(l => /^\|faint\|p1a:/.test(l))) continue;
  R.cast = fr.id + ' <- ' + x.id + ' (' + hx.id + '), ' + y.id + ' (' + hy.id + ')';
  KO = R; break;
}
if (KO) RUNS.push(['KO', KO]);

console.log(NL + '2. THE ARMS');
for (const [tag, R] of RUNS) {
  if (!R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + R.why); process.exit(1); }
  console.log('  === ' + tag + ' ===' + (R.cast ? '   ' + R.cast : ''));
  console.log('    showdown : ' + R.sdK.filter(l => !/^\|switch\|/.test(l)).join('  '));
  console.log('    medicham2: ' + R.meK.filter(l => !/^\|switch\|/.test(l)).join('  '));
  console.log('    boards: ' + R.boardDiffs + ' diff(s)' + (R.boardDetail ? '   ' + R.boardDetail : ''));
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none'));
  console.log('    counters: ' + JSON.stringify(R.counters));
}
for (const [tag, R] of [['ROUGHSKIN', RS], ['VOLLEY', VL], ['KO', KO]])
  if (!R) { console.log('  NOT STAGED (' + tag + ') — no legal cast found'); process.exit(1); }
const ill = G.fixtureIllegal ? G.fixtureIllegal() : null;
ok(Array.isArray(ill) && ill.length === 0, 'every staged set is legal under the ' + CS.FORMAT + ' TeamValidator (buildPair\'s fixture check)',
   Array.isArray(ill) ? (ill.length ? JSON.stringify(ill.slice(0, 3)) : null) : 'the fixture check is not exported');

/* ==================================================================================================
 * 4. THE AUTHORITY EXERCISED WHAT EACH ARM IS FOR
 * ============================================================================================== */
console.log(NL + '3. THE FIXTURES, ON THE AUTHORITY');
ok(helmets(CT).length === 1 && /^\|-damage\|p2a:/.test(helmets(CT)[0]), 'CONTACT — the authority tolls the attacker once', JSON.stringify(helmets(CT)));
ok(helmets(NC).length === 0, 'NONCONTACT — the authority tolls nothing', JSON.stringify(helmets(NC)));
{
  const i = RS.sdK.findIndex(l => /\[from\]ability:roughskin/.test(l)), j = RS.sdK.findIndex(l => /rockyhelmet/.test(l));
  ok(i >= 0 && j > i, 'ROUGHSKIN — the authority pays Rough Skin (order 1) and THEN the helmet (order 2)', 'rough ' + i + ' helmet ' + j);
}
{
  const hs = helmets(VL), dm = VL.sdK.filter(l => /^\|-damage\|p1a:/.test(l));
  ok(hs.length === 2 && dm.length === 2, 'VOLLEY — the authority tolls once per arrival', JSON.stringify(hs));
}
{
  const f = KO.sdK.findIndex(l => /^\|faint\|p1a:/.test(l));
  const last = KO.sdK.slice(0, f).filter(l => /^\|-damage\|/.test(l)).slice(-2);
  ok(f >= 0 && last.length === 2 && /^\|-damage\|p1a:.*\|0fnt/.test(last[0]) && /rockyhelmet/.test(last[1]),
     'KO — the killing blow is still tolled (the holder is on 0 HP, not yet fainted)', JSON.stringify(last));
}

/* ==================================================================================================
 * 5. THIS ENGINE AGAINST THE AUTHORITY
 * ============================================================================================== */
console.log(NL + '4. MEDICHAM AGAINST THE AUTHORITY');
for (const [tag, R] of RUNS) {
  const sdO = R.sdK.filter(l => OWN.test(l)), meO = R.meK.filter(l => OWN.test(l));
  const same = sdO.length === meO.length && sdO.every((l, i) => l === meO[i]);
  ok(!R.div && same, tag + ' — no protocol divergence, and every -damage / faint line agrees in order',
     R.div ? JSON.stringify(R.div) : (same ? null : 'showdown  ' + sdO.join(' ') + '\nmedicham2 ' + meO.join(' ')));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
}

if (!KNOBS.length && !MEDI_SRC_PATH) {
  console.log(NL + '5. THE COUNTERS');
  ok(CT.counters.paid === 1 && NC.counters.paid === 0, 'CONTACT paid one toll, NONCONTACT none', JSON.stringify([CT.counters, NC.counters]));
  ok(VL.counters.paid === 2, 'VOLLEY paid two tolls', JSON.stringify(VL.counters));
  ok(RUNS.every(([, R]) => R.counters.unknown === 0), 'no helmet-shaped item arrived with a trigger this engine does not model');
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
