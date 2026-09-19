/* probe_contact_rewrite_flags.js — MUMMY AND WANDERING SPIRIT REFUSE THE SAME ABILITY FLAGS THE MOVES DO,
 * AND THIS ENGINE ASKED THEM OF NOBODY ON THE CONTACT ROAD. 2026-09-18, ENGINE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_contact_rewrite_flags.js [--release <id>] [--only <arm>]
 *
 * ================= WHERE IT WAS FOUND ============================================================
 *
 * The 2026-09-18 lattices parted one game on Mummy overwriting Palafin's Zero to Hero. The card said
 * WHERE; the brief asked whether it is ONE ability or a CLASS. It is a class of two:
 *
 * ================= THE AUTHORITY, READ AND NOT RECALLED ==========================================
 *
 *     data/abilities.ts:2769-2777  mummy.onDamagingHit
 *       const sourceAbility = source.getAbility();
 *       if (sourceAbility.flags['cantsuppress'] || sourceAbility.id === 'mummy') return;
 *       if (this.checkMoveMakesContact(...)) source.setAbility('mummy', target);
 *     data/abilities.ts:5346-5349  wanderingspirit.onDamagingHit -> this.skillSwap(source, target)
 *     sim/battle.ts:1311-1316      Battle#skillSwap
 *       if (sourceAbility.flags['failskillswap'] || targetAbility.flags['failskillswap']) return false;
 *
 * Every OTHER legal reader of these flags was already asked by this engine: Skill Swap, Role Play,
 * Entrainment, Worry Seed, Simple Beam and Gastro Acid through `abilityFlagRefusal`
 * (tests/probe_ability_flag_refusal.js), Trace through `notrace`, Receiver through `noreceiver`.
 * Lingering Aroma shares Mummy's handler and has no legal carrier (derived below).
 *
 * ================= THE ARMS ======================================================================
 *
 * The holder (Cofagrigus / Runerigus) clicks Endure and its partner Protects, so the holder is alive
 * when the handler runs. The attacker clicks one CONTACT move into it. The ONLY thing that varies
 * between arms is the attacker, and every attacker's ability flags are PRINTED from the dex:
 *
 *   plain       Kingambit / Pressure        no flag              -> BOTH rewrite (the control)
 *   hunger      Morpeko / Hunger Switch     failskillswap only   -> Mummy rewrites, Wandering Spirit refuses
 *   zerotohero  Palafin / Zero to Hero      cantsuppress + fss   -> both refuse (the pool card)
 *   stance      Aegislash / Stance Change   cantsuppress + fss   -> both refuse
 *   disguise    Mimikyu / Disguise          cantsuppress + fss   -> both refuse
 *   (Battle Bond: not legal as a set -- Greninja-Bond is non-standard here; printed at run time)
 *
 * The expectation above is NOT asserted from this comment: the authority's own log decides whether each
 * arm rewrote, the plain control must rewrite on the authority or the file stops (a fixture that cannot
 * see a rewrite proves nothing), and both engines' boards must agree. `MEDI_CONTACT_REWRITE_FLAGS_UNREAD=1`
 * must part every arm the authority refused and no arm it allowed.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
const NL = '\n';
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) REL_ID = ER.cut('tests/probe_contact_rewrite_flags.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_CONTACT_REWRITE_FLAGS_UNREAD';
const KNOB_STAMP = 'contactRewriteFlagsUnreadRestored';

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

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const HOLDERS = [
  { id: 'mummy', row: ['cofagrigus', '', 'Mummy', ['Endure', 'Protect']] },
  { id: 'wanderingspirit', row: ['runerigus', '', 'Wandering Spirit', ['Endure', 'Protect']] },
];
const HPART = ['tinkaton', '', 'Own Tempo', ['Protect']];
const APART = ['hydreigon', '', 'Levitate', ['Protect']];
const FILL = [['sylveon', '', 'Cute Charm', ['Protect']], ['snorlax', '', 'Immunity', ['Protect']]];
const ATTACKERS = [
  { id: 'plain', sp: 'kingambit', ab: 'Pressure', mv: 'Shadow Claw' },
  { id: 'hunger', sp: 'morpeko', ab: 'Hunger Switch', mv: 'Psychic Fangs' },
  { id: 'zerotohero', sp: 'palafin', ab: 'Zero to Hero', mv: 'Aqua Jet' },
  { id: 'stance', sp: 'aegislash', ab: 'Stance Change', mv: 'Shadow Claw' },
  { id: 'disguise', sp: 'mimikyu', ab: 'Disguise', mv: 'Shadow Claw' },
];
/* BATTLE BOND IS NOT STAGED, AND THE REASON IS DERIVED BELOW: `Greninja` lists it, but a Battle Bond set
 * validates as the `Greninja-Bond` forme, which this format marks non-standard. The harness's own fixture
 * check refused it on the first run. */
const P = { m: 'protect' }, EN = { m: 'endure' };
const CASES = [];
for (const h of HOLDERS) for (const a of ATTACKERS) for (const pin of ['top-tie-first', 'middle']) {
  CASES.push({ id: h.id + ':' + a.id + '@' + pin, holder: h, atk: a, pin,
    side: stage([[a.sp, '', a.ab, [a.mv, 'Protect']], APART].concat(FILL)),
    def: stage([h.row, HPART].concat(FILL)),
    script: [{ p1: [{ m: a.mv.toLowerCase().replace(/[^a-z0-9]/g, ''), t: 0 }, P], p2: [EN, P] }] });
}

/* ---- LEGALITY, FLAGS AND THE MECHANISM, DERIVED AND REFUSED ------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => { try { return CS.canLearn(dex.species.get(sp).name, dex.moves.get(mv).id); }
  catch (e) { console.log('ILLEGAL FIXTURE  canLearn threw for ' + sp + '/' + mv + ': ' + e.message); return false; } };
let illegal = 0;
for (const row of CASES.flatMap(c => c.side.concat(c.def))) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' / ' + row.ability); illegal++; }
  for (const mv of row.moves) {
    if (!legal(dex.moves.get(mv))) { console.log('ILLEGAL FIXTURE  ' + mv); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + mv); illegal++; }
  }
}
for (const a of ATTACKERS) {
  const m = dex.moves.get(a.mv);
  if (!m.flags.contact || m.category === 'Status') { console.log('ILLEGAL FIXTURE  ' + a.mv + ' is not a damaging contact move'); illegal++; }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

const FLAGS = ['cantsuppress', 'failskillswap'];
const flagsOf = ab => FLAGS.filter(f => dex.abilities.get(ab).flags[f]);
const src = n => String(dex.abilities.get(n).onDamagingHit || '').replace(/\s+/g, ' ');
const CH_AB = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
const laCarriers = dex.species.all().filter(legal)
  .filter(s => Object.values(s.abilities).includes('Lingering Aroma')).map(s => s.name);
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    mummy.onDamagingHit           : ' + src('mummy').slice(0, 170));
console.log('    wanderingspirit.onDamagingHit : ' + src('wanderingspirit').slice(0, 170));
console.log('    lingering aroma legal carriers: ' + (laCarriers.join(', ') || 'NONE'));
console.log('    greninja-bond isNonstandard   : ' + dex.species.get('greninjabond').isNonstandard
  + '   (why Battle Bond is not staged)');
console.log('    champions overrides           : ' + (['mummy', 'wanderingspirit'].filter(k => new RegExp('\\b' + k + '\\s*:').test(CH_AB)).join(',') || 'none'));
for (const a of ATTACKERS) console.log('    ' + (a.ab + ' flags').padEnd(30) + ': ' + (flagsOf(a.ab).join(',') || '(none)'));
if (!/flags\[["']cantsuppress["']\]/.test(src('mummy')) || !/skillSwap\(/.test(src('wanderingspirit'))
    || /\b(mummy|wanderingspirit)\s*:/.test(CH_AB) || flagsOf('Pressure').length
    || !flagsOf('Hunger Switch').includes('failskillswap') || flagsOf('Hunger Switch').includes('cantsuppress')) {
  console.log(NL + 'NOT RUN — the format no longer carries the rule this file is about, or a control body now '
    + 'carries a flag. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READERS ------------------------------------------------------------------------------- */
/* The authority's own statement that it rewrote: Mummy's `-activate|HOLDER|ability: Mummy|...` or the
 * Skill Swap `-activate|ATTACKER|Skill Swap|...`, both written only when the write happened. */
const rewroteSd = lines => lines.some(l => /^\|-activate\|[^|]*\|ability: Mummy\|/.test(l)
  || /^\|-activate\|p1a[^|]*\|Skill Swap\|/.test(l));
function play(G, c) {
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get(c.pin);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.pin); process.exit(2); }
  const a = G.buildPair(c.side), b = G.buildPair(c.def);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_contact_rewrite_flags :: ' + c.id, {
    script: c.script, arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical,
                                           diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) }),
  });
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  const say = ls => ls.filter(l => /^\|-activate\||^\|-ability\||^\|-endability\|/.test(l));
  return { r, boards, sdRewrote: rewroteSd(sdAll), sdSay: say(sdAll), meSay: say(meAll),
           sdHit: sdAll.some(l => /^\|-damage\|p2a/.test(l)),
           sc: G.scriptCounters(), cc: G.choiceCounters(),
           restored: (globalThis.MEDFAILS || {})[KNOB_STAMP] || 0 };
}
const boardEq = rows => rows.length > 0 && rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');
const J = o => JSON.stringify(o);

let bad = 0, ran = 0, knobBound = false, refusedArms = 0;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY && c.holder.id !== ONLY && c.atk.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   attacker ' + c.atk.sp + ' / ' + c.atk.ab + ' [' + (flagsOf(c.atk.ab).join(',') || 'no flag')
    + ']  ' + c.atk.mv + ' into ' + c.holder.row[0] + ' / ' + c.holder.row[2]);
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  if (brk.notStaged || brk.r.err) { console.log('  NOT-STAGED or THREW under the knob'); bad++; continue; }
  ran++;
  if (brk.restored) knobBound = true;

  console.log('    authority rewrote ' + clean.sdRewrote);
  console.log('    lines   showdown ' + J(clean.sdSay));
  console.log('            medicham ' + J(clean.meSay));
  console.log('    board          ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards));
  for (const b of clean.boards) if (!b.identical) console.log('      clean b' + b.t + ' diffs ' + J(b.diffs));
  for (const b of brk.boards) if (!b.identical) console.log('      knob  b' + b.t + ' diffs ' + J(b.diffs));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored
    + '   |   clicks not on request ' + clean.sc.moveNotOnRequest + '   |   choices refused ' + clean.cc.refused);

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.cc.refused || brk.cc.refused) { console.log('    >> FIXTURE FAILED — the authority refused a choice.'); bad++; continue; }
  if (!clean.sdHit) { console.log('    >> FIXTURE FAILED — the contact move never damaged the holder on the authority.'); bad++; continue; }
  if (c.atk.id === 'plain' && !clean.sdRewrote) {
    console.log('    >> FIXTURE BLIND — the CONTROL was not rewritten on the authority, so no refusal arm here can be '
      + 'told apart from a handler that never ran.'); bad++; continue; }

  const agree = boardEq(clean.boards);
  if (!agree) { console.log('    >> DEFECT — the engines part on the board.'); bad++; }
  else console.log('    >> the two engines agree on the board.');
  const knobAgree = boardEq(brk.boards);
  if (!clean.sdRewrote) {
    refusedArms++;
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE A REFUSED ARM — this arm proves nothing.'); bad++; }
    else console.log('    >> the authority REFUSED, and the knob parts the boards: a red arm.');
  } else if (!knobAgree) { console.log('    >> OVER-FIRE — an arm the authority ALLOWED moved under the knob.'); bad++; }
  else console.log('    >> the authority ALLOWED it and the knob leaves it alone: a control.');
}

if (!ONLY && !knobBound) {
  console.log(NL + '  KNOB ABSENT — `' + KNOB + '` set no `MEDFAILS.' + KNOB_STAMP + '` on any arm. The fix has '
    + 'not landed. This is the red-first state, not a pass.');
  bad++;
}
if (!ONLY && !refusedArms) { console.log(NL + '  NO REFUSED ARM — nothing here exercised the refusal.'); bad++; }
console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear')
  + '   (' + refusedArms + ' refused by the authority)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
