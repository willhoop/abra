/* probe_entry_announce.js — THE TWO ARRIVAL ANNOUNCEMENTS NOTHING COULD MAKE RED. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_entry_announce.js
 *   SHOWDOWN_PATH=... node tests/probe_entry_announce.js --only frisk
 *   SHOWDOWN_PATH=... node tests/probe_entry_announce.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ==========================================================
 *
 * ANTICIPATION and FRISK are `announcesOnEntry` abilities whose entire effect is a protocol line —
 * `data/tags.json` DERIVES `visibleOnABoard: false` for both — so a board comparator handed either can
 * only ever answer "the boards agreed", which is a green that asked nothing. The roster now grades them
 * with the ANNOUNCEMENT-ONLY verdict, and `engine/quarantine.js` accepts that verdict only on a receipt
 * whose fifth clause is: SOMETHING CAN MAKE THIS ROW RED. This file is that something.
 *
 *   MEDI_ANTICIPATION_SILENT=1   the `-ability`-on-self arrival branch does not fire; the ability falls
 *                                back to the old `entryAnnounceUnmodelled` road and the shudder is never
 *                                written. The knob existed and NO probe named it.
 *   MEDI_FRISK_SILENT=1          the `-item`-on-foe arrival branch does not fire. Until 2026-09-19 that
 *                                branch fired UNCONDITIONALLY — there was no knob at all, so the Frisk
 *                                census row's green was unfalsifiable by construction.
 *
 * THE AUTHORITY IS THE ANSWER. No arm types an expected line: each plays one script through BOTH engines
 * and compares the protocol streams whole plus the board at every turn boundary. The `shape` predicate
 * asserts the AUTHORITY staged the thing under test, so an arm that has quietly stopped staging reads
 * FIXTURE FAILED rather than green.
 *
 * READ OFF THE AUTHORITY, NOT RECALLED:
 *   ANTICIPATION  data/abilities.ts:174-190 — walks each foe's `moveSlots`, skips `category === 'Status'`,
 *                 and announces ONCE (`break`) on the first move that is either `move.ohko` or whose
 *                 `runEffectiveness > 0` with `getImmunity` true. No die.
 *   FRISK         data/abilities.ts:1539 — loops `pokemon.foes()` and writes
 *                 `-item|TARGET|<item>|[from] ability: Frisk|[of] <holder>` for each foe HOLDING one.
 *
 * EVERY species, move, item and ability here is derived from the format, filtered to the regulation,
 * and printed before it is used.
 */
'use strict';
const path = require('path');
const D_ = (...p) => path.join(__dirname, '..', ...p);
require(D_('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D_('tests', '_live_release.js'));
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D_('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_entry_announce.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D_('engine', 'game_differential.js');
const ALL_KNOBS = ['MEDI_ANTICIPATION_SILENT', 'MEDI_FRISK_SILENT'];

let _cur = null, _G = null;
function harness(knob) {
  const key = knob || '(clean)';
  if (_G && _cur === key) return _G;
  for (const k of ALL_KNOBS) delete process.env[k];
  if (knob) process.env[knob] = '1';
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE FORMAT, AND THE FIXTURE DERIVED FROM IT ------------------------------------------------ */
const CS = require(D_('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (s, mv) => {
  const e = LS[s.id] || (s.baseSpecies && s.baseSpecies !== s.name ? LS[dex.species.get(s.baseSpecies).id] : null);
  return !!(e && e.learnset && e.learnset[dex.moves.get(mv).id]);
};
/* An ability that registers none of these handlers cannot move a board or a line by itself. Same list
 * probe_narration_d.js uses, for the same reason: the fixture's bodies must be silent so the only thing
 * that can speak is the mechanic under test. */
const QUIET_H = ['onStart', 'onSwitchIn', 'onModifyPriority', 'onFractionalPriority', 'onUpdate', 'onTryHit',
  'onAllyTryHitSide', 'onModifySpe', 'onResidual', 'onDamagingHit', 'onSetStatus', 'onAfterSetStatus', 'onTryBoost',
  'onSwitchOut', 'onBeforeMove', 'onAnyTryPrimaryHit', 'onFoeTryMove', 'onDamage', 'onAfterMoveSecondary',
  'onAfterMoveSecondarySelf', 'onSourceModifyDamage', 'onModifyMove', 'onAnyInvulnerability', 'onFaint', 'onAnyFaint',
  'onEnd', 'onImmunity', 'onAfterBoost', 'onAllyBoost', 'onFoeAfterBoost', 'onChangeBoost', 'onTryAddVolatile',
  'onDragOut', 'onTrapPokemon', 'onFoeTrapPokemon', 'onModifyType', 'onEmergencyExit', 'onAfterUseItem',
  'onAllyAfterUseItem', 'onTakeItem', 'onAllyTryBoost'];
const quiet = a => { const x = dex.abilities.get(a); return x.exists && QUIET_H.every(h => !x[h]); };
const quietAb = s => Object.values(s.abilities).find(quiet);
const ALL_LEGAL = dex.species.all().filter(s => legal(s) && !/-Mega/.test(s.name) && !s.battleOnly)
  .sort((a, b) => a.name.localeCompare(b.name));
const SPECIES = ALL_LEGAL.filter(s => quietAb(s));
const hasAb = (s, a) => Object.values(s.abilities).includes(dex.abilities.get(a).name);
const row = (s, moves, ab, item) => ({ species: s.name, item: item || '', ability: ab || quietAb(s), moves });
const used = new Set();
const take = (xs, why) => {
  const s = xs.find(x => !used.has(x.id) && !used.has(x.baseSpecies));
  if (!s) throw new Error('NOT-STAGEABLE — the format supplies no ' + why);
  used.add(s.id); used.add(s.baseSpecies); return s;
};
const fresh = () => used.clear();
const say = (k, v) => console.log('    ' + String(k).padEnd(26) + ' ' + v);
const P = { m: 'protect' };

/* ---- THE TWO CLASSES, DERIVED AND PRINTED BEFORE ANYTHING IS STAGED ----------------------------- */
const carriersOf = ab => ALL_LEGAL.filter(s => hasAb(s, ab));
function printClass() {
  console.log(NL + '  CLASS (derived from the format and data/tags.json on this run)');
  const TAGS = require(D_('data', 'tags.json'));
  for (const ab of ['anticipation', 'frisk']) {
    const p = (((TAGS.abilities || {})[ab] || {}).params || {}).announcesOnEntry;
    say(dex.abilities.get(ab).name + ' emits', p ? JSON.stringify(p.emits) + '  visibleOnABoard=' + JSON.stringify(p.visibleOnABoard) : 'NO announcesOnEntry PARAM');
    say(dex.abilities.get(ab).name + ' carriers', carriersOf(ab).map(s => s.name).join(', ') || 'NONE');
  }
}

/* Effectiveness and immunity are asked of the format, never assumed from a type chart typed here. */
const seOn = (m, s) => m.category !== 'Status' && dex.getImmunity(m.type, s.types)
  && dex.getEffectiveness(m.type, s.types) > 0;
const dullOn = (m, s) => m.category !== 'Status' && !m.ohko
  && (!dex.getImmunity(m.type, s.types) || dex.getEffectiveness(m.type, s.types) <= 0);

const ARMS = [];
function arm(id, knob, build, opts) { ARMS.push(Object.assign({ id, knob, build }, opts || {})); }

/* ==== ANTICIPATION. The carrier arrives at turn 1 against two foes. RED: the lead foe carries a move
 *      super-effective on the carrier, so the authority writes ONE `|-ability|<carrier>|Anticipation`.
 *      CONTROL: the same board where every foe move is neutral or resisted or immune and none is an
 *      OHKO, so the authority says nothing. ========================================================= */
arm('anticipation', 'MEDI_ANTICIPATION_SILENT', () => {
  fresh();
  const DMG = dex.moves.all().filter(m => legal(m) && m.category !== 'Status' && m.target === 'normal')
    .sort((a, b) => a.id.localeCompare(b.id));
  let pick = null;
  for (const c of carriersOf('anticipation')) {
    if (!learns(c, 'protect')) continue;
    const seFoes = SPECIES.filter(s => s.id !== c.id && learns(s, 'protect'))
      .map(s => ({ s, m: DMG.find(m => seOn(m, c) && learns(s, m.id)) })).filter(x => x.m);
    const dullFoes = SPECIES.filter(s => s.id !== c.id && learns(s, 'protect'))
      .map(s => ({ s, m: DMG.find(m => dullOn(m, c) && learns(s, m.id)) })).filter(x => x.m);
    if (seFoes.length && dullFoes.length >= 2) { pick = { c, se: seFoes[0], dull: dullFoes }; break; }
  }
  if (!pick) throw new Error('NOT-STAGEABLE — no Anticipation carrier has both a super-effective and a dull legal foe');
  const { c } = pick;
  used.add(c.id); used.add(c.baseSpecies);
  const se = pick.se; used.add(se.s.id); used.add(se.s.baseSpecies);
  const d1 = pick.dull.find(x => !used.has(x.s.id)); used.add(d1.s.id); used.add(d1.s.baseSpecies);
  const d2 = pick.dull.find(x => !used.has(x.s.id)); used.add(d2.s.id); used.add(d2.s.baseSpecies);
  const lead = take(SPECIES.filter(s => learns(s, 'protect')), 'side-A lead');
  const mate = take(SPECIES.filter(s => learns(s, 'protect')), 'side-A partner');
  const bench = [0, 1].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'side-B bench'));
  say('carrier', c.name + ' [' + c.types.join('/') + ']');
  say('super-effective foe', se.s.name + ' with ' + se.m.name + ' (' + se.m.type + ', x'
    + Math.pow(2, dex.getEffectiveness(se.m.type, c.types)) + ')');
  say('dull foes', d1.s.name + ' with ' + d1.m.name + ', ' + d2.s.name + ' with ' + d2.m.name);
  const A = [row(lead, ['Protect']), row(mate, ['Protect']),
             row(c, ['Protect'], dex.abilities.get('anticipation').name), row(bench[0], ['Protect'])];
  const B = xs => xs.map(x => row(x.s, [x.m.name, 'Protect']))
    .concat([row(bench[0], ['Protect']), row(bench[1], ['Protect'])]);
  const script = [{ p1: [{ sw: c.id }, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }];
  return {
    line: /^\|-ability\|p1[ab]:[^|]*\|anticipation/,
    red: { A, B: B([se, d1]), script, want: 1,
           shapeWhy: 'the carrier arrives against a super-effective move and shudders exactly once' },
    control: { A, B: B([d1, d2]), script, want: 0,
               shapeWhy: 'the same arrival against two dull foes says nothing' },
  };
});

/* ==== FRISK. The carrier arrives at turn 1. RED: both foes hold an item, so the authority writes one
 *      `|-item|<foe>|<item>|[from] ability: Frisk|[of] <carrier>` per HOLDING foe. CONTROL: the same
 *      arrival against two EMPTY-HANDED foes, where the authority writes nothing. ==================== */
arm('frisk', 'MEDI_FRISK_SILENT', () => {
  fresh();
  const c = take(carriersOf('frisk').filter(s => learns(s, 'protect')), 'Frisk carrier that learns Protect');
  const item = dex.items.get('leftovers');
  if (!legal(item)) throw new Error('FIXTURE NAMES AN ITEM OUTSIDE THE REGULATION: ' + item.id);
  const f1 = take(SPECIES.filter(s => learns(s, 'protect')), 'side-B lead');
  const f2 = take(SPECIES.filter(s => learns(s, 'protect')), 'side-B partner');
  const lead = take(SPECIES.filter(s => learns(s, 'protect')), 'side-A lead');
  const mate = take(SPECIES.filter(s => learns(s, 'protect')), 'side-A partner');
  const bench = [0, 1, 2].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('carrier', c.name + ' [' + c.types.join('/') + ']');
  say('foes', f1.name + ', ' + f2.name + '   item ' + item.name);
  const A = [row(lead, ['Protect']), row(mate, ['Protect']),
             row(c, ['Protect'], dex.abilities.get('frisk').name), row(bench[0], ['Protect'])];
  const B = held => [row(f1, ['Protect'], null, held ? item.name : ''),
                     row(f2, ['Protect'], null, held ? item.name : ''),
                     row(bench[1], ['Protect']), row(bench[2], ['Protect'])];
  const script = [{ p1: [{ sw: c.id }, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }];
  return {
    line: new RegExp('^\\|-item\\|p2[ab]:[^|]*\\|' + fold(item.name) + '\\|\\[from\\]ability:frisk\\|\\[of\\]p1a:'),
    red: { A, B: B(true), script, want: 2,
           shapeWhy: 'the carrier arrives and names BOTH holding foes’ items, one line each' },
    control: { A, B: B(false), script, want: 0,
               shapeWhy: 'the same arrival against two empty-handed foes says nothing' },
  };
});

/* ---- PLAYING ONE ARM --------------------------------------------------------------------------- */
/* ---- THE COMPARATOR CANNOT SEE ONE OF THESE TWO, AND THAT IS THE FINDING UNDERNEATH THIS FILE ----
 *
 * `game_differential.js`'s EQUIV rule `ability-announcement` DROPS every `|-ability|` line from both
 * streams before they are compared. The argument for it is sound and is written out there: Showdown's
 * `-ability` announces that an ability is ABOUT to do something, and the something is a separate line
 * that is kept — so dropping the announcement cannot hide an ability that did not fire.
 *
 * ANTICIPATION IS THE EXCEPTION THAT ARGUMENT HAS NO ROOM FOR. There is no something. The `-ability`
 * line IS the whole mechanic (`data/tags.json` derives `visibleOnABoard: false`), so the normaliser
 * deletes the only evidence that exists and the two engines agree by construction. Measured here on
 * the first run of this file: under `MEDI_ANTICIPATION_SILENT=1` the whole-game comparison read
 * `first divergence none` — a green asking nothing.
 *
 * SO THE VERDICT FOR THIS CLASS IS TAKEN OFF THE RAW STREAMS, one on each side, counted and compared.
 * `playGame` hands back `mediTrace`; the authority's half is `lastSdLog()`. Both are folded to one
 * spelling before they are counted, because the two engines punctuate names differently and a case
 * difference is not a mechanic. The whole-game comparison is still run and still reported — it is the
 * check that the fixture moved no board — it is simply no longer the only thing asked.
 *
 * I am NOT changing the EQUIV rule. It is MEASURE's file, it carries its own red demonstration, and an
 * exception carved into it for one ability is exactly the name-match this repository forbids. The gap
 * is reported in docs/_reports/2026-09-19-announcement-receipts.md and left. */
const fold = l => String(l).toLowerCase().replace(/\s+/g, '');
function play(G, sc, name) {
  G.resetScriptCounters();
  const armObj = G.ARM_BY_ID.get('middle');
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { notStaged: 'buildPair refused side ' + (!a ? 'A' : 'B') };
  const r = G.playGame(a, b, 'directed', 'probe_entry_announce :: ' + name, { script: sc.script, arm: armObj });
  return { r, sd: G.sdStream(G.lastSdLog()).map(String), me: (r.mediTrace || []).map(String),
           sc: G.scriptCounters(), fails: Object.assign({}, globalThis.MEDFAILS || {}) };
}
const count = (lines, re) => lines.filter(l => re.test(fold(l))).length;
const divOf = r => (r.div ? (r.div.agreedLines + '  SD ' + r.div.sdRaw + '  <>  US ' + r.div.meRaw) : 'none');

printClass();
let bad = 0, ran = 0;
for (const A of ARMS) {
  if (ONLY && A.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + A.id + '    knob ' + A.knob);
  let fx;
  try { fx = A.build(); } catch (e) { console.log('  ' + String(e.message || e)); bad++; continue; }
  for (const kind of ['red', 'control']) {
    const sc = fx[kind];
    const clean = play(harness(null), sc, A.id + ' ' + kind + ' clean');
    const brk = play(harness(A.knob), sc, A.id + ' ' + kind + ' knob');
    harness(null);
    ran++;
    console.log('  [' + kind + ']  ' + sc.shapeWhy);
    if (clean.notStaged || brk.notStaged) { console.log('    NOT-STAGED — ' + (clean.notStaged || brk.notStaged)); bad++; continue; }
    if (clean.r.err || brk.r.err) { console.log('    THREW — ' + (clean.r.err || brk.r.err)); bad++; continue; }
    const leaked = Object.keys(clean.fails).filter(k => /Restored$/.test(k) && clean.fails[k]);
    console.log('    clean  first divergence ' + divOf(clean.r) + '   board '
      + (clean.r.stateDiv ? 'PARTED t' + clean.r.stateDiv.turn : 'held ' + clean.r.boundariesAgreed + '/' + clean.r.boundaries));
    console.log('    knob   first divergence ' + divOf(brk.r) + '   board '
      + (brk.r.stateDiv ? 'PARTED t' + brk.r.stateDiv.turn : 'held'));
    const nSd = count(clean.sd, fx.line), nMe = count(clean.me, fx.line);
    const kSd = count(brk.sd, fx.line), kMe = count(brk.me, fx.line);
    console.log('    lines  clean  authority ' + nSd + '  ours ' + nMe + '   knob  authority ' + kSd + '  ours ' + kMe
      + '   (expected ' + sc.want + ')');
    if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
      console.log('    >> FIXTURE FAILED — a scripted click was refused (' + JSON.stringify(clean.sc) + ')'); bad++; continue; }
    if (process.argv.includes('--show')) console.log(clean.sd.map(l => '      | ' + l).join(NL));
    if (nSd !== sc.want) {
      console.log('    >> FIXTURE FAILED — the authority wrote ' + nSd + ' line(s), not ' + sc.want + ': ' + sc.shapeWhy); bad++; continue; }
    if (!clean.sd.some(l => /^\|switch\|p1a: /.test(l))) {
      console.log('    >> FIXTURE FAILED — the carrier never arrived; nothing here tests an arrival.'); bad++; continue; }
    if (leaked.length) { console.log('    >> the CLEAN run carries a restore stamp (' + leaked.join(', ') + '); the harness leaked a knob.'); bad++; continue; }
    if (nMe !== nSd) { console.log('    >> RED — our engine wrote ' + nMe + ' of the authority\'s ' + nSd + ' line(s) with the fix in.'); bad++; continue; }
    if (clean.r.div) { console.log('    >> RED — the protocol parts with the fix in.'); bad++; continue; }
    if (clean.r.stateDiv) { console.log('    >> RED — the boards part with the fix in.'); bad++; continue; }
    if (kind === 'red' && kMe === kSd && !brk.r.div) {
      console.log('    >> THE KNOB DOES NOT REACH THE MECHANISM — the old engine writes the line too. '
        + '[identical output across a varied knob means the knob is UNWIRED]'); bad++; continue; }
    if (kind === 'red' && brk.r.stateDiv) {
      console.log('    >> THE KNOB PARTS A BOARD — this mechanic is announcement-only and a board must not see it.'); bad++; continue; }
    if (kind === 'control' && (brk.r.div || kMe !== kSd)) {
      console.log('    >> THE KNOB PARTS THE CONTROL — it reaches more than the mechanism.'); bad++; continue; }
    console.log('    OK');
  }
}
console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
console.log(bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
