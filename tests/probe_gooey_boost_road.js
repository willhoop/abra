/* probe_gooey_boost_road.js — GOOEY'S SPEED DROP IS AN ORDINARY `this.boost`, SO CONTRARY INVERTS IT,
 * DEFIANT AND COMPETITIVE ANSWER IT, CLEAR BODY REFUSES IT AND MIRROR ARMOR BOUNCES IT. THIS ENGINE
 * WROTE IT STRAIGHT INTO `boosts` AND ASKED NONE OF THEM. 2026-09-18, ENGINE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_gooey_boost_road.js [--release <id>] [--only <arm>]
 *
 * ================= WHERE IT WAS FOUND ============================================================
 *
 * The 2026-09-18 three-lattice re-measure parted two games on Defiant not firing off a Gooey Speed
 * drop (`boosts.atk 0|2` on Kingambit). The card says WHERE; the WHY below is read off the authority.
 *
 * ================= THE AUTHORITY, READ AND NOT RECALLED ==========================================
 *
 *     data/abilities.ts  gooey.onDamagingHit (1632-1638), tanglinghair.onDamagingHit (4896-4902)
 *       if (this.checkMoveMakesContact(move, source, target, true)) {
 *         this.add('-ability', target, 'Gooey');
 *         this.boost({ spe: -1 }, source, target, null, true);
 *       }
 *     sim/battle.ts  Battle#boost (2017-2086): runEvent('ChangeBoost') [Contrary], 'TryBoost'
 *       [Clear Body class, Mirror Armor], per-stat 'AfterEachBoost' [Defiant, Competitive].
 *
 * Champions overrides none of these (checked at run time below). Tangling Hair shares the handler
 * byte for byte and has NO legal carrier in this regulation (derived below), so it is not staged.
 *
 * ================= THE ARMS ======================================================================
 *
 * The Gooey body is Goodra and it clicks Endure every arm, so it neither dies nor touches anything.
 * Both partners Protect. The ONLY thing that differs between a red arm and its control is the
 * ATTACKER'S ABILITY — same species, same move (Aerial Ace, contact, no secondary, never misses).
 *
 *   contrary      Malamar / Contrary        — the drop becomes +1 Speed
 *   defiant       Kingambit / Defiant       — -1 Speed then +2 Attack
 *   competitive   Empoleon / Competitive    — -1 Speed then +2 Sp. Atk
 *   clearbody     Metagross / Clear Body    — refused
 *   mirrorarmor   Corviknight / Mirror Armor — bounced onto Goodra
 *   ctl-*         the same species on an ability that does nothing to a stat drop
 *
 * EVERY RED ARM IS CHECKED AGAINST ITS CONTROL ON THE AUTHORITY FIRST: if Showdown's attacker/Goodra
 * boosts are the same in the red arm and its control, the fixture cannot see the ability and the arm
 * is refused. Then both engines' boards must agree, and `MEDI_PUNISH_RAW_BOOST=1` must part every red
 * arm and no control.
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
if (!REL_ID) REL_ID = ER.cut('tests/probe_gooey_boost_road.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_PUNISH_RAW_BOOST';
const KNOB_STAMP = 'punishRawBoostRestored';

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
const GOODRA = ['goodra', '', 'Gooey', ['Endure', 'Protect']];
const GPART = ['tinkaton', '', 'Own Tempo', ['Protect']];
const APART = ['hydreigon', '', 'Levitate', ['Protect']];
const FILL = [['sylveon', '', 'Cute Charm', ['Protect']], ['snorlax', '', 'Immunity', ['Protect']]];
const DEF_SIDE = stage([GOODRA, GPART].concat(FILL));
const side = (sp, ab) => stage([[sp, '', ab, ['Aerial Ace', 'Protect']], APART].concat(FILL));

const HIT = { m: 'aerialace', t: 0 }, P = { m: 'protect' }, EN = { m: 'endure' };
const SCRIPT = [{ p1: [HIT, P], p2: [EN, P] }];

const PAIRS = [
  { id: 'contrary', sp: 'malamar', red: 'Contrary', ctl: 'Suction Cups' },
  { id: 'defiant', sp: 'kingambit', red: 'Defiant', ctl: 'Pressure' },
  { id: 'competitive', sp: 'empoleon', red: 'Competitive', ctl: 'Torrent' },
  { id: 'clearbody', sp: 'metagross', red: 'Clear Body', ctl: 'Light Metal' },
  { id: 'mirrorarmor', sp: 'corviknight', red: 'Mirror Armor', ctl: 'Pressure' },
];
const CASES = [];
for (const p of PAIRS) for (const pin of ['top-tie-first', 'middle']) {
  CASES.push({ id: p.id + '@' + pin, pair: p.id, kind: 'red', pin, side: side(p.sp, p.red), ab: p.red });
  CASES.push({ id: 'ctl-' + p.id + '@' + pin, pair: p.id, kind: 'control', pin, side: side(p.sp, p.ctl), ab: p.ctl });
}

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
const allRows = [DEF_SIDE].concat(CASES.map(c => c.side)).flat();
for (const row of allRows) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' / ' + row.ability); illegal++; }
  for (const mv of row.moves) {
    if (!legal(dex.moves.get(mv))) { console.log('ILLEGAL FIXTURE  ' + mv); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + mv); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

const AA = dex.moves.get('aerialace');
const CH_AB = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
const GOO_SRC = String(dex.abilities.get('gooey').onDamagingHit || '').replace(/\s+/g, ' ');
const TH_SRC = String(dex.abilities.get('tanglinghair').onDamagingHit || '').replace(/\s+/g, ' ');
const thCarriers = dex.species.all().filter(legal)
  .filter(s => Object.values(s.abilities).includes('Tangling Hair')).map(s => s.name);
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    gooey.onDamagingHit        : ' + GOO_SRC.slice(0, 160));
console.log('    tanglinghair shares it     : ' + (GOO_SRC.replace(/Gooey/g, 'X') === TH_SRC.replace(/Tangling Hair/g, 'X'))
  + '   legal carriers: ' + (thCarriers.length ? thCarriers.join(', ') : 'NONE'));
console.log('    champions overrides        : ' + ['gooey', 'tanglinghair', 'contrary', 'defiant', 'competitive',
  'clearbody', 'mirrorarmor'].filter(k => new RegExp('\\b' + k + '\\s*:').test(CH_AB)).join(',') || 'none');
console.log('    aerial ace                 : contact ' + !!AA.flags.contact + '  secondary ' + !!AA.secondary
  + '  accuracy ' + AA.accuracy);
if (!/this\.boost\(\s*\{\s*spe:\s*-1\s*\}\s*,\s*source\s*,\s*target\s*,\s*null\s*,\s*true\s*\)/.test(GOO_SRC)
    || !AA.flags.contact || AA.secondary || AA.accuracy !== true
    || ['gooey', 'contrary', 'defiant', 'competitive', 'clearbody', 'mirrorarmor'].some(k => new RegExp('\\b' + k + '\\s*:').test(CH_AB))) {
  console.log(NL + 'NOT RUN — the format no longer carries the rule this file is about. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READERS ------------------------------------------------------------------------------- */
/* THE AUTHORITY'S OUTCOME, off its own log: net stage change per slot per stat. */
function netBoosts(lines) {
  const out = {};
  for (const raw of lines.map(String)) {
    const m = /^\|-(un)?boost\|(p[12][ab])[^|]*\|(\w+)\|(\d+)/.exec(raw);
    if (!m) continue;
    const k = m[2] + '.' + m[3];
    out[k] = (out[k] || 0) + (m[1] ? -1 : 1) * (+m[4]);
  }
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}
const sawLine = (lines, re) => lines.map(String).some(l => re.test(l));

function play(G, c) {
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get(c.pin);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.pin); process.exit(2); }
  const a = G.buildPair(c.side), b = G.buildPair(DEF_SIDE);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_gooey_boost_road :: ' + c.id, {
    script: SCRIPT, arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical,
                                           diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) }),
  });
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  return { r, boards, sdNet: netBoosts(sdAll), meNet: netBoosts(meAll),
           sdGoo: sawLine(sdAll, /^\|-ability\|p2a[^|]*\|Gooey/),
           /* case-insensitive: this engine's trace carries the ability ID (`gooey`), never a Showdown
            * display string, by design (`TR.announced`, medicham2-browser.js). */
           meGoo: sawLine(meAll, /^\|-ability\|p2a[^|]*\|Gooey/i),
           meGooRaw: meAll.filter(l => /gooey/i.test(l)).slice(0, 2),
           /* INFORMATIONAL, NOT ASSERTED: the stat-change narration on each engine, so a reader can see
            * the line shape beside the board verdict. Commentary may differ; boards may not. */
           sdSay: sdAll.filter(l => /^\|-(un)?boost\||^\|-fail\||^\|-ability\|/.test(l)),
           meSay: meAll.filter(l => /^\|-(un)?boost\||^\|-fail\||^\|-ability\|/.test(l)),
           sc: G.scriptCounters(), cc: G.choiceCounters(),
           restored: (globalThis.MEDFAILS || {})[KNOB_STAMP] || 0 };
}
const boardEq = rows => rows.length > 0 && rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');
const J = o => JSON.stringify(o);

let bad = 0, ran = 0, knobBound = false;
const sdByCase = {};
for (const c of CASES) {
  if (ONLY && c.pair !== ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   attacker ' + c.side[0].species + ' / ' + c.ab);
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  if (brk.notStaged || brk.r.err) { console.log('  NOT-STAGED or THREW under the knob'); bad++; continue; }
  ran++;
  if (brk.restored) knobBound = true;
  sdByCase[c.id] = clean.sdNet;

  console.log('    gooey line     showdown ' + clean.sdGoo + '   medicham ' + clean.meGoo + '   ' + J(clean.meGooRaw));
  console.log('    net boosts     showdown ' + J(clean.sdNet) + '   medicham ' + J(clean.meNet) + '   |   knob ' + J(brk.meNet));
  console.log('    lines          showdown ' + J(clean.sdSay));
  console.log('                   medicham ' + J(clean.meSay));
  console.log('    board          ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards));
  for (const b of clean.boards) if (!b.identical) console.log('      clean b' + b.t + ' diffs ' + J(b.diffs));
  for (const b of brk.boards) if (!b.identical) console.log('      knob  b' + b.t + ' diffs ' + J(b.diffs));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored
    + '   |   clicks not on request ' + clean.sc.moveNotOnRequest + '   |   choices refused ' + clean.cc.refused);

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.cc.refused || brk.cc.refused) { console.log('    >> FIXTURE FAILED — the authority refused a choice.'); bad++; continue; }
  if (!clean.sdGoo) { console.log('    >> FIXTURE FAILED — Gooey never fired on the authority, so nothing was measured.'); bad++; continue; }

  /* THE CONTROL IS CLEARED EXPLICITLY: a red arm whose authority outcome equals its control's cannot
   * see the ability. The control runs second in CASES order, so this is checked on the control row. */
  if (c.kind === 'control') {
    const redId = c.id.replace(/^ctl-/, '');
    if (sdByCase[redId] && J(sdByCase[redId]) === J(clean.sdNet)) {
      console.log('    >> FIXTURE BLIND — the authority gives the red arm and this control the SAME outcome, '
        + 'so the red arm proves nothing.'); bad++;
    } else if (sdByCase[redId]) console.log('    >> the authority separates the red arm from this control ('
      + J(sdByCase[redId]) + ' vs ' + J(clean.sdNet) + ').');
  }

  const agree = boardEq(clean.boards);
  if (!agree) { console.log('    >> DEFECT — the engines part on the board.'); bad++; }
  else console.log('    >> the two engines agree on the board.');
  const knobAgree = boardEq(brk.boards);
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob parts them, which is what makes this a red arm.');
  } else if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob.'); bad++; }
}

if (!ONLY && !knobBound) {
  console.log(NL + '  KNOB ABSENT — `' + KNOB + '` set no `MEDFAILS.' + KNOB_STAMP + '` on any arm. The fix has '
    + 'not landed. This is the red-first state, not a pass.');
  bad++;
}
console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
