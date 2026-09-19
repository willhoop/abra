/* probe_beatup_set_species.js — BEAT UP PRICES EACH HIT OFF THE ALLY'S *SET* SPECIES, AND THIS ENGINE
 * PRICED IT OFF THE FORME STANDING ON THE FIELD. 2026-09-18, ENGINE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_beatup_set_species.js --release <id>
 *   SHOWDOWN_PATH=... node tests/probe_beatup_set_species.js --release <id> --only mega-corner
 *
 * ================= WHERE IT WAS FOUND ============================================================
 *
 * The three-lattice re-measure of 2026-09-18 (release ffc11ac41a26, census 632a699468ca, pool
 * data/team-pool-frozen, arm middle, cap 50, --end-state) parted 30 boards. Read off the FULL
 * `--dump-games` output, not the capped lists, THREE of them are one Beat Up hit priced differently:
 *
 *   --games 1350  omit-weather     Maushold's Beat Up on Metagross   hit 1  showdown 12  medicham 14
 *   --games 1350  pair-speedctrl   Annihilape's Beat Up on Floette   hit 2  showdown  5  medicham  6
 *   --games 1950  pair-redirect-priority  Maushold's Beat Up on Gholdengo  hit 2  showdown 22  medicham 24
 *
 * and in every one the hit that moves is the one thrown by a MEGA-EVOLVED ally (Staraptor-Mega,
 * Malamar-Mega, Victreebel-Mega), always with this engine hitting HARDER. The hit count and every
 * other hit agree. Account: docs/_reports/2026-09-18-lattice-remeasure.md.
 *
 * ================= THE AUTHORITY, READ AND NOT RECALLED ==========================================
 *
 *     data/moves.ts:1154-1155   beatup.basePowerCallback
 *       const setSpecies = this.dex.species.get(move.allies!.shift()!.set.species);
 *       const bp = 5 + Math.floor(setSpecies.baseStats.atk / 10);
 *
 * `set.species` is the TEAM SHEET's species — the base forme that holds the stone — and it is not
 * rewritten by mega evolution, by Transform or by any forme change. Champions does not override
 * `beatup` (checked at run time below).
 *
 * ================= WHAT THIS ENGINE DID ==========================================================
 *
 * `beatUpAllies` priced each member off `_bsAtk`, and WIRE 83 deliberately keeps `_bsAtk` on "the
 * species standing on the field": `megaEvolveNow` rewrites it to the mega's, `transformOnto` to the
 * target's, and the forme swap to the new forme's. Correct for no reader: `_bsAtk` has exactly one,
 * and it is this one.
 *
 * `MEDI_BEATUP_FIELD_FORME=1` restores the pre-fix reading and stamps
 * `MEDFAILS.beatUpFieldFormeRestored`.
 *
 * ================= THE ARMS ======================================================================
 *
 *   mega-corner        RED. The partner mega-evolves on turn 1; the lead clicks Beat Up on turn 2.
 *                      `top-tie-first`: every hit takes the same damage index, so a per-hit number is
 *                      a pure function of the base power and the difference is arithmetic.
 *   mega-middle        RED. The same script under the pin the pool was measured on.
 *   transform-corner   RED. The partner is Ditto and TRANSFORMS into the target on turn 1. Its set
 *                      species is Ditto whatever it is wearing, so the authority prices its hit off
 *                      Ditto and the pre-fix engine off the body it copied.
 *   plain-corner       CONTROL. The identical side, the partner Protects and never mega-evolves. Set
 *                      forme and field forme are the same body, so the knob must NOT part it.
 *   plain-middle       CONTROL, at `middle`, so a parted board there cannot be blamed on the dice.
 *
 * Nothing below types a base power or a damage number: both engines play the same script and the
 * authority's own per-hit sequence and board are the answer.
 */
'use strict';
const path = require('path');
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
if (!REL_ID) REL_ID = ER.cut('tests/probe_beatup_set_species.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_BEATUP_FIELD_FORME';
const KNOB_STAMP = 'beatUpFieldFormeRestored';

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

/* ---- THE BOARD ---------------------------------------------------------------------------------
 *
 * THE PARTNER IS THE ONLY BODY WHOSE FORME CHANGES, and its set forme and field forme must give
 * DIFFERENT powers or the arm cannot see the rule — derived and refused below.
 *
 * Staraptor carries Reckless, not Intimidate: an Intimidate on the lead turn writes an Attack drop
 * onto the target side that has nothing to do with this file. The target is Snorlax, a Normal type,
 * so Beat Up (Dark) is neutral on it; it clicks Stockpile on both turns so it never Protects and every
 * arm's target does the identical thing. Four hits at these powers are nowhere near its HP. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));

const USER = ['weavile', '', 'Pickpocket', ['Beat Up', 'Protect']];
const RAPTOR = ['staraptor', 'Staraptite', 'Reckless', ['Protect']];
const DITTO = ['ditto', '', 'Limber', ['Transform']];
const MIDDLE = ['kangaskhan', '', 'Inner Focus', ['Protect']];
const LAST = ['hydreigon', '', 'Levitate', ['Protect']];
const TARGET = ['snorlax', '', 'Immunity', ['Protect', 'Stockpile']];
const TWALL = ['tinkaton', '', 'Own Tempo', ['Protect']];
const DEF_SIDE = stage([TARGET, TWALL, ['sylveon', '', 'Cute Charm', ['Protect']],
                                       ['milotic', '', 'Marvel Scale', ['Protect']]]);
const SIDE_RAPTOR = stage([USER, RAPTOR, MIDDLE, LAST]);
const SIDE_DITTO = stage([USER, DITTO, MIDDLE, LAST]);

const P = { m: 'protect' }, PM = { m: 'protect', mega: true }, BU = { m: 'beatup', t: 0 };
const SP = { m: 'stockpile' }, TF = { m: 'transform', t: 0 };

const CASES = [
  { id: 'mega-corner', kind: 'red', pin: 'top-tie-first', side: SIDE_RAPTOR,
    script: [{ p1: [P, PM], p2: [SP, P] }, { p1: [BU, P], p2: [SP, P] }],
    what: 'THE POOL SHAPE. Staraptor mega-evolves on turn 1 and Weavile clicks Beat Up on turn 2. The '
        + 'authority prices Staraptor\'s hit off the SET species (Staraptor); the pre-fix engine off the '
        + 'mega standing on the field.' },
  { id: 'mega-middle', kind: 'red', pin: 'middle', side: SIDE_RAPTOR,
    script: [{ p1: [P, PM], p2: [SP, P] }, { p1: [BU, P], p2: [SP, P] }],
    what: 'THE SAME SCRIPT UNDER REAL PER-HIT DICE, the pin the three pool games were measured on.' },
  { id: 'transform-corner', kind: 'red', pin: 'top-tie-first', side: SIDE_DITTO,
    script: [{ p1: [P, TF], p2: [SP, P] }, { p1: [BU, P], p2: [SP, P] }],
    what: 'THE SAME RULE THROUGH TRANSFORM. Ditto copies Snorlax on turn 1; its set species is still Ditto, '
        + 'so the authority prices its hit off Ditto and the pre-fix engine off Snorlax. The transformed '
        + 'Ditto clicks the Protect it copied on turn 2.' },
  { id: 'plain-corner', kind: 'control', pin: 'top-tie-first', side: SIDE_RAPTOR,
    script: [{ p1: [P, P], p2: [SP, P] }, { p1: [BU, P], p2: [SP, P] }],
    what: 'THE CONTROL — the identical side and clicks with no mega evolution. Set forme and field forme '
        + 'are one body, so both engines agree before the fix, after it, and under the knob.' },
  { id: 'plain-middle', kind: 'control', pin: 'middle', side: SIDE_RAPTOR,
    script: [{ p1: [P, P], p2: [SP, P] }, { p1: [BU, P], p2: [SP, P] }],
    what: 'AND ITS CONTROL AT `middle`, so a parted board under real dice cannot be blamed on the dice.' },
];

/* ---- LEGALITY AND THE MECHANISM, DERIVED AND REFUSED ------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const mid = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[mid]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const row of SIDE_RAPTOR.concat(SIDE_DITTO, DEF_SIDE)) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.item && !legal(dex.items.get(row.item))) { console.log('ILLEGAL FIXTURE  ' + row.item); illegal++; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

const fs = require('fs');
const BU_MOVE = dex.moves.get('beatup');
const BU_SRC = String(BU_MOVE.basePowerCallback || '').replace(/\s+/g, ' ');
const CHAMP_MV = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
const powerOf = sp => 5 + Math.floor(dex.species.get(sp).baseStats.atk / 10);
const MEGA_OF = Object.values(dex.items.get('Staraptite').megaStone || {})[0];
const PAIRS = [['staraptor', MEGA_OF], ['ditto', 'snorlax']];
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    beatup basePowerCallback   : ' + BU_SRC.slice(0, 140));
console.log('    champions overrides beatup : ' + /\bbeatup\s*:/.test(CHAMP_MV));
for (const [set, field] of PAIRS) {
  console.log('    set ' + dex.species.get(set).name.padEnd(10) + ' power ' + powerOf(set)
    + '   field ' + String(dex.species.get(field).name).padEnd(14) + ' power ' + powerOf(field));
}
if (!/move\.allies!?\.shift\(\)!?\.set\.species/.test(BU_SRC) || !/baseStats\.atk \/ 10/.test(BU_SRC)
    || /\bbeatup\s*:/.test(CHAMP_MV) || !MEGA_OF
    || PAIRS.some(([s, f]) => powerOf(s) === powerOf(f))) {
  console.log(NL + 'NOT RUN — the format no longer carries the rule this file is about, or a set forme and '
    + 'its field forme give the same power. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READERS ------------------------------------------------------------------------------- */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/* THE PER-HIT DAMAGE on the target, in order. Beat Up is the only thing that damages it here. */
function hits(lines) {
  const out = []; let prev = null;
  for (const raw of lines.map(String)) {
    const m = /^\|-damage\|p2a: ?([^|]*)\|(\d+)\/(\d+)/.exec(raw);
    if (!m || norm(m[1]) !== norm(TARGET[0])) continue;
    const rem = +m[2], max = +m[3];
    out.push((prev === null ? max : prev) - rem);
    prev = rem;
  }
  return out;
}
const hitcount = lines => {
  for (const raw of lines.map(String)) {
    const m = /^\|-hitcount\|p[12][ab]: ?[^|]*\|(\d+)/.exec(String(raw));
    if (m) return +m[1];
  }
  return null;
};
const sawLine = (lines, re) => lines.map(String).some(l => re.test(l));

function play(G, c) {
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get(c.pin);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.pin); process.exit(2); }
  const a = G.buildPair(c.side), b = G.buildPair(DEF_SIDE);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_beatup_set_species :: ' + c.id, {
    script: c.script, arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical,
                                           diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) }),
  });
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  return { r, boards, sdHits: hits(sdAll), meHits: hits(meAll),
           sdCount: hitcount(sdAll), meCount: hitcount(meAll),
           sdMega: sawLine(sdAll, /^\|-mega\|/), meMega: sawLine(meAll, /^\|-mega\|/),
           sdTf: sawLine(sdAll, /^\|-transform\|/), meTf: sawLine(meAll, /^\|-transform\|/),
           sc: G.scriptCounters(), cc: G.choiceCounters(),
           restored: (globalThis.MEDFAILS || {})[KNOB_STAMP] || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const boardEq = rows => rows.length > 0 && rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');

let bad = 0, ran = 0, knobBound = false;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   pin ' + c.pin);
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  if (brk.notStaged || brk.r.err) { console.log('  NOT-STAGED or THREW under the knob'); bad++; continue; }
  ran++;
  if (brk.restored) knobBound = true;

  console.log('    mega line      showdown ' + clean.sdMega + '   medicham ' + clean.meMega
    + '   |   transform line showdown ' + clean.sdTf + '   medicham ' + clean.meTf);
  console.log('    hit count      showdown ' + clean.sdCount + '   medicham ' + clean.meCount
    + '   |   knob medicham ' + brk.meCount);
  console.log('    per-hit damage showdown ' + JSON.stringify(clean.sdHits)
    + '   medicham ' + JSON.stringify(clean.meHits) + '   |   knob ' + JSON.stringify(brk.meHits));
  console.log('    board          ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards));
  for (const b of clean.boards) if (!b.identical) console.log('      clean b' + b.t + ' diffs ' + JSON.stringify(b.diffs));
  for (const b of brk.boards) if (!b.identical) console.log('      knob  b' + b.t + ' diffs ' + JSON.stringify(b.diffs));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored
    + '   |   clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : '')
    + '   |   choices refused ' + clean.cc.refused);

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.cc.refused || brk.cc.refused) {
    console.log('    >> FIXTURE FAILED — the authority refused a choice.'); bad++; continue; }
  const wantMega = c.script.some(t => t.p1.some(x => x.mega));
  const wantTf = c.script.some(t => t.p1.some(x => x.m === 'transform'));
  if (clean.sdMega !== wantMega || clean.meMega !== wantMega) {
    console.log('    >> FIXTURE FAILED — the mega evolution did not happen as scripted on both engines.'); bad++; continue; }
  if (clean.sdTf !== wantTf || clean.meTf !== wantTf) {
    console.log('    >> FIXTURE FAILED — the transform did not happen as scripted on both engines.'); bad++; continue; }
  if (clean.sdCount !== 4 || clean.meCount !== 4 || clean.sdHits.length !== 4 || clean.meHits.length !== 4) {
    console.log('    >> FIXTURE FAILED — four hits were not read on both engines, so this arm is not '
      + 'measuring the per-hit power.'); bad++; continue; }

  const agree = boardEq(clean.boards) && eq(clean.sdHits, clean.meHits);
  if (!agree) { console.log('    >> DEFECT — the engines part on the per-hit sequence or on the board.'); bad++; }
  else console.log('    >> the two engines agree on every hit AND the board.');

  const knobAgree = boardEq(brk.boards) && eq(clean.sdHits, brk.meHits);
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else if (!brk.boards.some(b => !b.identical && JSON.stringify(b.diffs).includes('snorlax'))) {
      console.log('    >> THE KNOB PARTED SOMETHING OTHER THAN THE TARGET\'S HP.'); bad++; }
    else console.log('    >> and the knob puts them back apart, on the target, which is what makes this a red arm.');
  } else if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob.'); bad++; }
}

if (!ONLY && !knobBound) {
  console.log(NL + '  KNOB ABSENT — `' + KNOB + '` set no `MEDFAILS.' + KNOB_STAMP + '` on any arm. The '
    + 'restore knob does not exist in this engine, so the fix has not landed. This is the red-first '
    + 'state, not a pass.');
  bad++;
}
console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
