#!/usr/bin/env node
/* tests/probe_sucker_reads_queued_move.js — SUCKER PUNCH READS THE TARGET'S QUEUED MOVE, WHICH IS THE
 * MOVE ENCORE REWROTE IT INTO, AND IT READS THAT MOVE'S CATEGORY. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_sucker_reads_queued_move.js --release <id>
 *   MEDI_SUCKER_READS_PRE_ENCORE=1   ... (the encore arms must go RED)
 *   MEDI_SUCKER_READS_ACTION_KIND=1  ... (the category arms must go RED)
 *
 * ================= THE AUTHORITY, READ, NOT RECALLED ===========================================
 *
 * Sucker Punch (data/moves.ts:18399-18405, Champions does not override it):
 *
 *     onTry(source, target) {
 *       const action = this.queue.willMove(target);
 *       const move = action?.choice === 'move' ? action.move : null;
 *       if (!move || (move.category === 'Status' && move.id !== 'mefirst') || target.volatiles['mustrecharge'])
 *         return false;
 *     }
 *
 * It asks two things of the queued ACTION: that there is one, and that its MOVE is not a Status move.
 *
 * Champions' Encore (data/mods/champions/moves.ts:286-320) REPLACES that action when it lands on a body
 * that has not yet acted: `this.queue.changeAction(target, { choice: 'move', moveid: move.id, ... })`
 * (:311-317), unless the target holds a Mental Herb (:307). `changeAction` -> `insertChoice` ->
 * `resolveAction` rebuilds `action.move` from the new `moveid`, so from that instant `willMove(target)
 * .move` IS the encored move. A Sucker Punch resolving after the Encore therefore reads the ENCORED
 * move's category, not the one the player clicked.
 *
 * ================= THE TWO DEFECTS, ONE KNOB EACH ================================================
 *
 * 1. PRE-ENCORE. This engine's `encoreRelocateQueued` moved the bracket and marked the action for the
 *    execution-time rebuild, but the Sucker Punch refusal kept reading the action AS CLICKED. Whole-game
 *    card `…2636045527` (g1350, turn 15): Whimsicott's Prankster Encore turns Scolipede's attack into
 *    Swords Dance, then Kingambit's Sucker Punch — the authority prints `|-fail|p2a: Kingambit`, this
 *    engine hit for 50. Knob `MEDI_SUCKER_READS_PRE_ENCORE=1`.
 * 2. ACTION KIND. The refusal asked `action.kind === 'attack'`, which is this engine's action SHAPE and
 *    not the move's category. Damaging moves this engine queues under another kind — `futurehit`
 *    (Future Sight), `allyheal` (Pollen Puff at a partner) — read as "not attacking" and Sucker Punch
 *    failed where the authority lands it. Knob `MEDI_SUCKER_READS_ACTION_KIND=1`.
 *
 * ================= THE CLASS, DERIVED =============================================================
 *
 * §0 walks the regulation for every legal move/ability/item whose handler reads the CONTENT of a queued
 * action (`willMove(...)` or `queue.list` followed by `.move`), and prints it. The arms below stage the
 * members that an Encore rewrite or a non-`attack` damaging kind can reach.
 */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
if (!process.argv.includes('--release')) {
  console.log('REFUSED — pass --release <id>. This probe measures a frozen engine, never the live tree.');
  process.exit(2);
}
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const NL = String.fromCharCode(10);

const K_ENC = process.env.MEDI_SUCKER_READS_PRE_ENCORE === '1';
const K_KIND = process.env.MEDI_SUCKER_READS_ACTION_KIND === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split(NL).join(NL + '          '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_sucker_reads_queued_move.js');
console.log('  MEDI_SUCKER_READS_PRE_ENCORE=' + (K_ENC ? '1 (PRE-FIX)' : '0')
  + '   MEDI_SUCKER_READS_ACTION_KIND=' + (K_KIND ? '1 (PRE-FIX)' : '0'));

/* ---- 0. THE CLASS AND THE AUTHORITY, DERIVED ON EVERY RUN -------------------------------------- */
console.log(NL + '0. WHO READS THE CONTENT OF A QUEUED ACTION, IN THIS REGULATION');
function src(o, seen = new Set()) {
  let s = '';
  for (const k in o) {
    const v = o[k];
    if (typeof v === 'function') s += v.toString() + NL;
    else if (v && typeof v === 'object' && !seen.has(v) && k !== 'flags') { seen.add(v); s += src(v, seen); }
  }
  return s;
}
const readers = [];
for (const [kind, tab] of [['move', dex.moves], ['ability', dex.abilities], ['item', dex.items]]) {
  for (const x of tab.all()) {
    if (!legal(x)) continue;
    const s = src(x);
    if (/(willMove\([^)]*\)|queue\.list)[\s\S]{0,200}\.move\b/.test(s)) readers.push(kind + ':' + x.id);
  }
}
console.log('     ' + readers.join(', '));
ok(readers.includes('move:suckerpunch'), 'suckerpunch reads the queued action\'s move');
const ENC_SRC = String((dex.moves.get('encore').condition || {}).onStart || '');
ok(/changeAction/.test(ENC_SRC) && /mentalherb/.test(ENC_SRC),
  'Champions\' encore.onStart rewrites the queued action (changeAction) and excludes a Mental Herb holder');
const SP_SRC = String(dex.moves.get('suckerpunch').onTry || '');
ok(/category === ['"]Status['"]/.test(SP_SRC), 'suckerpunch.onTry refuses on the queued move\'s CATEGORY');

/* ---- THE FIXTURE, CHECKED AGAINST THE FORMAT ---------------------------------------------------- */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const WHIM = mon('whimsicott', '', 'Prankster', ['Encore', 'Protect']);
const GAMB = mon('kingambit', '', 'Pressure', ['Sucker Punch', 'Protect', 'Iron Head']);
const SIDE_A = () => [WHIM, GAMB, mon('garchomp', '', 'Rough Skin', ['Protect']), mon('clefable', '', 'Unaware', ['Protect'])];
const CHOMP = (item) => mon('garchomp', item, 'Rough Skin', ['Swords Dance', 'Dragon Claw', 'Protect']);
const CLEF = mon('clefable', '', 'Unaware', ['Protect', 'Future Sight']);
const FLOR = mon('florges', '', 'Flower Veil', ['Pollen Puff', 'Protect']);
const BENCH = [mon('toxapex', '', 'Regenerator', ['Protect']), mon('corviknight', '', 'Pressure', ['Protect'])];
const SIDE_B = (lead0, lead1) => [lead0, lead1].concat(BENCH);
const RCHOMP = mon('garchomp', '', 'Rough Skin', ['Round', 'Protect']);
const RLAX = mon('snorlax', '', 'Thick Fat', ['Round', 'Amnesia', 'Protect']);

const PR = { m: 'protect' }, SD = { m: 'swordsdance' }, DC = { m: 'dragonclaw', t: 1 };
const ENC = { m: 'encore', t: 0 }, SUCK = { m: 'suckerpunch', t: 0 };

const SCEN = [
  { id: 'encored-attack-into-status', gov: 'enc', sdFails: true,
    what: 'THE CARD. Turn 1 Garchomp clicks Swords Dance. Turn 2 it clicks Dragon Claw; Prankster '
        + 'Encore (+1, faster) rewrites the queued action into Swords Dance; then Kingambit\'s Sucker '
        + 'Punch reads a Status move and must FAIL.',
    A: SIDE_A(), B: SIDE_B(CHOMP(''), CLEF),
    script: [{ p1: [PR, PR], p2: [SD, PR] },
             { p1: [ENC, SUCK], p2: [DC, PR] }] },
  { id: 'encored-status-into-attack', gov: 'enc', sdFails: false,
    what: 'THE MIRROR. Turn 1 Garchomp clicks Dragon Claw. Turn 2 it clicks Swords Dance and is Encored '
        + 'back into Dragon Claw; Sucker Punch reads an attack and must LAND. A fix that fails Sucker '
        + 'Punch on "the target was Encored" rather than on the rewritten move breaks here.',
    A: SIDE_A(), B: SIDE_B(CHOMP(''), CLEF),
    script: [{ p1: [PR, PR], p2: [DC, PR] },
             { p1: [ENC, SUCK], p2: [SD, PR] }] },
  { id: 'future-sight-is-special', gov: 'kind', sdFails: false,
    what: 'Clefable clicks Future Sight (Special, queued here as `futurehit`). Sucker Punch into it must '
        + 'LAND: the authority reads the category, not the fact that nothing hits this turn.',
    A: SIDE_A(), B: SIDE_B(CHOMP(''), CLEF),
    script: [{ p1: [PR, { m: 'suckerpunch', t: 1 }], p2: [PR, { m: 'futuresight', t: 1 }] }] },
  { id: 'pollen-puff-at-partner', gov: 'kind', sdFails: false,
    what: 'Florges clicks Pollen Puff at its own partner (Special, queued here as `allyheal`). Sucker '
        + 'Punch into Florges must LAND.',
    A: SIDE_A(), B: SIDE_B(FLOR, CLEF),
    script: [{ p1: [PR, SUCK], p2: [{ m: 'pollenpuff', ally: true }, PR] }] },
  /* ROUND READS THE SAME QUEUED MOVE. `round.onTry` walks `this.queue.list` for `action.move.id ===
   * 'round'` (data/moves.ts:15509-15517) — after a Champions Encore that is the encored move. Turn 1 the
   * slow Snorlax Rounds (its lastMove). Turn 2 it clicks Amnesia (priority 0, so still queued) and the Prankster Encore rewrites the
   * queued action into Round; Garchomp's Round then finds it and promotes it ahead of the mid-speed
   * Kingambit, at double power. */
  { id: 'round-promotes-encored-round', gov: 'enc', round: true,
    what: 'The Round queue scan reads the ENCORED move: the rewritten Snorlax Round is promoted ahead of '
        + 'the Kingambit Iron Head and doubled.',
    A: [WHIM, GAMB].concat(BENCH), B: [RCHOMP, RLAX].concat(BENCH),
    script: [{ p1: [PR, PR], p2: [{ m: 'round', t: 0 }, { m: 'round', t: 0 }] },
             { p1: [{ m: 'encore', t: 1 }, { m: 'ironhead', t: 1 }], p2: [{ m: 'round', t: 1 }, { m: 'amnesia' }] }] },
  /* ---- CONTROLS: each must agree on every load, knob or not ---------------------------------- */
  { id: 'control-no-encore-attack', sdFails: false,
    what: 'No Encore (Whimsicott protects). Garchomp clicks Dragon Claw; Sucker Punch lands on both.',
    A: SIDE_A(), B: SIDE_B(CHOMP(''), CLEF),
    script: [{ p1: [PR, PR], p2: [SD, PR] },
             { p1: [PR, SUCK], p2: [DC, PR] }] },
  { id: 'control-no-encore-status', sdFails: true,
    what: 'No Encore. Garchomp clicks Swords Dance; Sucker Punch fails on both. The positive twin of '
        + 'the card: the instrument can see a refusal.',
    A: SIDE_A(), B: SIDE_B(CHOMP(''), CLEF),
    script: [{ p1: [PR, PR], p2: [DC, PR] },
             { p1: [PR, SUCK], p2: [SD, PR] }] },
  { id: 'control-mental-herb', sdFails: false,
    what: 'The card with a Mental Herb on Garchomp: the authority\'s own exclusion. No rewrite, the herb '
        + 'frees the Encore, the queued Dragon Claw stands and Sucker Punch LANDS.',
    A: SIDE_A(), B: SIDE_B(CHOMP('Mental Herb'), CLEF),
    script: [{ p1: [PR, PR], p2: [SD, PR] },
             { p1: [ENC, SUCK], p2: [DC, PR] }] },
];

/* every species, ability, item and move, against the format and the validator's learnset */
let illegal = 0;
const seen = new Set();
for (const sc of SCEN) for (const row of sc.A.concat(sc.B)) {
  const key = JSON.stringify(row); if (seen.has(key)) continue; seen.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('  ILLEGAL  ' + row.species); illegal++; continue; }
  if (row.item && !legal(dex.items.get(row.item))) { console.log('  ILLEGAL  ' + row.item); illegal++; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id).includes(dex.abilities.get(row.ability).id)) {
    console.log('  ILLEGAL  ' + sp.name + ' / ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    if (!legal(dex.moves.get(mv))) { console.log('  ILLEGAL  ' + mv); illegal++; continue; }
    if (!CS.canLearn(row.species, mv)) { console.log('  ILLEGAL  ' + sp.name + ' does not learn ' + mv); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture cell(s). This is not a pass.'); process.exit(2); }

/* ---- 1. THE ARMS -------------------------------------------------------------------------------- */
console.log(NL + '1. THE ARMS, BOTH ENGINES');
const G = SB.harness();
const FAIL_RE = /^\|-fail\|p1b: Kingambit\s*$/;
const SUCK_RE = /^\|move\|p1b: Kingambit\|Sucker Punch/;
for (const sc of SCEN) {
  const r = SB.runOne(sc);
  const sdLog = G.sdStream(G.lastSdLog()).map(String);
  /* THE DIAGNOSTIC TURN ONLY: from `|turn|N` to `|turn|N+1`, N the script's last turn. */
  const N = sc.script.length;
  const from = sdLog.indexOf('|turn|' + N), to = sdLog.indexOf('|turn|' + (N + 1));
  const tail = from < 0 ? [] : sdLog.slice(from, to < 0 ? sdLog.length : to);
  const sdUsed = tail.some(l => SUCK_RE.test(l));
  const sdFail = tail.some(l => FAIL_RE.test(l));
  const redExpected = (sc.gov === 'enc' && K_ENC) || (sc.gov === 'kind' && K_KIND);
  const detail = r.verdict === 'IDENTICAL' ? null
    : (r.why ? r.why : r.boards.map(b => (b.unexplained || [])
        .map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us) + ' / authority ' + JSON.stringify(d.sd))
        .join(NL)).filter(Boolean).join(NL));
  console.log(NL + '  ' + sc.id + (sc.gov ? '   [governed by ' + (sc.gov === 'enc' ? 'MEDI_SUCKER_READS_PRE_ENCORE' : 'MEDI_SUCKER_READS_ACTION_KIND') + ']' : '   [control]'));
  console.log('    ' + sc.what);
  /* THE INSTRUMENT: the authority's own stream must show the Sucker Punch used and the outcome the arm
   * claims, or the arm staged something else. */
  if (sc.round) {
    const promoted = tail.some(l => /^\|move\|p2b: Snorlax\|Round\|.*\[from\] move: Round/.test(l));
    const mi = tail.findIndex(l => /^\|move\|p2b: Snorlax\|Round/.test(l)), ki = tail.findIndex(l => /^\|move\|p1b: Kingambit\|Iron Head/.test(l));
    ok(promoted && mi >= 0 && ki > mi, 'authority: the encored Snorlax Round is promoted ([from] move: Round) and moves before Kingambit',
      promoted && mi >= 0 && ki > mi ? null : tail.filter(l => /^\|(move|-start|-fail|-damage)\|/.test(l)).join(NL));
  } else ok(sdUsed && sdFail === sc.sdFails,
    'authority: Sucker Punch ' + (sc.sdFails ? 'FAILS' : 'LANDS') + ' (used=' + sdUsed + ', -fail=' + sdFail + ')');
  ok(r.script && r.script.moveNotOnRequest === 0, 'every scripted click was on the request',
    r.script && r.script.moveNotOnRequest ? 'first missing: ' + r.script.firstMissing : null);
  if (redExpected) {
    ok(r.verdict !== 'IDENTICAL', 'boards DIFFER under the knob -> ' + r.verdict + ' (this is what makes the arm a red one)');
  } else {
    ok(r.verdict === 'IDENTICAL', 'boards -> ' + r.verdict, detail);
  }
}

/* ---- 2. THE COUNTERS AND THE STAMPS ----------------------------------------------------------- */
console.log(NL + '2. THE KNOB STAMPS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const F = (M && M.MEDFAILS) || {};
ok((F.suckerReadsPreEncoreRestored || 0) === (K_ENC ? 1 : 0),
  'MEDFAILS.suckerReadsPreEncoreRestored = ' + F.suckerReadsPreEncoreRestored + ' (expected ' + (K_ENC ? 1 : 0) + ')');
ok((F.suckerReadsActionKindRestored || 0) === (K_KIND ? 1 : 0),
  'MEDFAILS.suckerReadsActionKindRestored = ' + F.suckerReadsActionKindRestored + ' (expected ' + (K_KIND ? 1 : 0) + ')');

console.log(NL + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed') + '   release ' + G.REL.id);
process.exit(bad ? 1 : 0);
