/* probe_beatup_ally_order.js — BEAT UP'S HITS ARE PRICED OFF `side.pokemon`, AN ARRAY SHOWDOWN
 * PERMUTES ON EVERY SWITCH-IN, AND THIS ENGINE WALKS THE STATIC BUILD ORDER. ROADMAP #544. 2026-09-05.
 *
 *   SHOWDOWN_PATH=... node tests/probe_beatup_ally_order.js
 *   SHOWDOWN_PATH=... node tests/probe_beatup_ally_order.js --only after-a-switch
 *
 * ================= WHAT THE AUTHORITY DOES, READ AND NOT RECALLED =================================
 *
 *     data/moves.ts:1150-1172   beatup
 *       basePowerCallback(pokemon, target, move) {
 *         const setSpecies = this.dex.species.get(move.allies!.shift()!.set.species);
 *         return 5 + Math.floor(setSpecies.baseStats.atk / 10);
 *       },
 *       onModifyMove(move, pokemon) {
 *         move.allies = pokemon.side.pokemon.filter(ally => ally === pokemon || !ally.fainted && !ally.status);
 *         move.multihit = move.allies.length;
 *       },
 *
 *     sim/battle-actions.ts:119-133   switchIn(pokemon, pos), inside `if (oldActive)`
 *       oldActive.position = pokemon.position;
 *       ...
 *       pokemon.position = pos;
 *       side.pokemon[pokemon.position] = pokemon;
 *       side.pokemon[oldActive.position] = oldActive;
 *
 * `shift()` consumes the list one member per hit, so HIT n IS MEMBER n OF `side.pokemon`. And those
 * three lines are a SWAP: the entrant takes the active slot's index and the body it replaced takes the
 * entrant's old bench index. After one switch the party array is no longer the order the team was
 * built in. Champions does not override `beatup` (checked at run time below).
 *
 * ================= WHAT THIS ENGINE DOES =========================================================
 *
 *     function beatUpAllies(att, vp) {
 *       const party = (att && att._sf && att._sf.team && att._sf.team.length) ? att._sf.team : [att];
 *
 * `sf.team` is stamped ONCE, in `battleInit` (`S.sfA.team = teamA.filter(Boolean)`), and nothing in
 * this engine ever reorders it. The FILTER is the authority's and was fixed already; the ORDER never
 * was. `dmgRangeOneHit`'s own comment says the index is "in `pokemon.side.pokemon` order" — which is
 * exactly the array this engine does not have.
 *
 * ================= WHERE IT WAS FOUND ============================================================
 *
 * ROADMAP #542 filed this as bucket (b), "the Beat Up count — 1 game, #333's road", reasoning from the
 * FIRST `-damage` line of its card alone. The lines after it refute that reading: both engines print
 * `|-hitcount|p1a: Milotic|4`, and the per-hit losses are 9, 7, 10, 7 in the authority against
 * 6, 7, 10, 9 here — the COUNT agrees, the middle two hits agree exactly, and the two that move are
 * the first and the last. Two bodies had switched in on the attacking side before the click. #544 was
 * re-cut for that and says of itself: *"no fix was attempted and no arm was staged"*. This is the arm.
 *
 * ================= NOTHING BELOW IS TYPED ========================================================
 *
 * No arm declares a base power or a damage number. Both arms play the SAME four-body side against the
 * same target under the same pin; the single difference is whether one body switched before the click.
 * The file asserts (a) that the two engines print the same hit count and the same per-hit damage
 * sequence, (b) the cross-arm claim read off SHOWDOWN ALONE — the switch must REORDER the authority's
 * own per-hit sequence while leaving its MULTISET untouched, which is what "a permutation, not a
 * different move" means and is the only reading that separates this from a hit-count bug — and (c)
 * that the control, where build order and live order are the same array, agrees on both engines.
 *
 * THE CONTROL IS THE HALF THAT MATTERS AND IT WOULD PASS TODAY. #544 says so in its own words. That is
 * precisely why it is here: without it, an arm that only played the switch case could be failing for
 * any reason at all.
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
if (!REL_ID) REL_ID = ER.cut('tests/probe_beatup_ally_order.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
/* THE RESTORE KNOB. It does not exist until the fix lands, and this file says so OUT LOUD rather than
 * quietly reporting a pass. Red-first: before the fix the switch arm fails on its own evidence and the
 * knob clause fails beside it. */
const KNOB = 'MEDI_BEATUP_BUILD_ORDER';
const KNOB_STAMP = 'beatUpBuildOrderRestored';

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
 * FOUR BODIES WITH FOUR DIFFERENT BASE ATTACKS, WHICH IS THE WHOLE FIXTURE. `5 + floor(atk/10)` has to
 * give four DISTINCT powers or the order is unobservable and a green arm would mean nothing — so the
 * four are derived and REFUSED below if any two collide. Nothing here types a base power.
 *
 * THE USER IS THE LEAD AND NEVER MOVES SLOTS. `beatup`'s filter short-circuits on `ally === pokemon`,
 * so the user is member 0 of `side.pokemon` on both arms and hit 1 is the same on both — an arm where
 * every hit moved could not tell a permutation from a different move.
 *
 * THE BODY THAT SWITCHES IS THE PARTNER, AND ITS REPLACEMENT IS THE LAST BENCH MEMBER, because the
 * authority's swap exchanges exactly those two indices. Their two powers therefore trade places and
 * the two in between do not, which is the same shape as the pool card's 9,7,10,7 against 6,7,10,9.
 *
 * THE TARGET IS NEUTRAL AND SURVIVES FOUR HITS. Beat Up is Dark; Snorlax is Normal, so nothing about
 * the type chart moves between arms, and at these base powers four hits are nowhere near its HP. A
 * body that fainted mid-move would truncate the sequence this file reads. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));

const USER = ['weavile', '', 'Pickpocket', ['Beat Up', 'Protect']];
const PARTNER = ['whimsicott', '', 'Infiltrator', ['Protect']];
const MIDDLE = ['kangaskhan', '', 'Inner Focus', ['Protect']];
const ENTRANT = ['hydreigon', '', 'Levitate', ['Protect']];
const TARGET = ['snorlax', '', 'Immunity', ['Protect', 'Stockpile']];
const TWALL = ['tinkaton', '', 'Own Tempo', ['Protect']];

const ATT_SIDE = stage([USER, PARTNER, MIDDLE, ENTRANT]);
const DEF_SIDE = stage([TARGET, TWALL, ['sylveon', '', 'Cute Charm', ['Protect']],
                                       ['milotic', '', 'Marvel Scale', ['Protect']]]);

/* THE TWO SCRIPTS, IDENTICAL EXCEPT FOR ONE CLICK.
 *
 *   t1  the partner SWITCHES OUT to the last bench member   (or Protects, on the control)
 *   t2  the lead clicks BEAT UP at the target
 *
 * THE PIN IS A CORNER, NOT `middle`, AND THAT IS DELIBERATE. `middle` draws a real damage index PER
 * HIT, so four hits carry four different rolls and the cross-arm claim below — that one arm's
 * sequence is a PERMUTATION of the other's — could not be stated exactly. At `top-tie-first` the roll
 * is the same constant on every hit of both arms, so a per-hit number is a pure function of the base
 * power and the multiset claim is arithmetic rather than approximate. */
const P = { m: 'protect' }, BU = { m: 'beatup', t: 0 }, SP = { m: 'stockpile' };
const SCRIPT = sw => ([
  { p1: [P, sw ? { sw: ENTRANT[0] } : P], p2: [P, P] },
  { p1: [BU, P], p2: [SP, P] },
]);

const CASES = [
  { id: 'after-a-switch', kind: 'red', sw: true, pin: 'top-tie-first', control: 'no-switch',
    what: 'THE PARTNER LEAVES AND THE LAST BENCH MEMBER TAKES ITS SLOT, so `side.pokemon` indices 1 '
        + 'and 3 SWAP and the authority prices hits 2 and 4 the other way round. This engine walks '
        + '`_sf.team`, which battleInit stamped once and nothing has touched since.' },
  { id: 'no-switch', kind: 'control', sw: false, pin: 'top-tie-first',
    what: 'THE SAME BOARD WITH NOTHING SWITCHED — the partner Protects instead. Build order and live '
        + 'order are the same array here, so both engines must agree, and #544 predicted in advance '
        + 'that an arm playing only this would pass today. It is the reason the red arm above is '
        + 'attributable to the ORDER rather than to Beat Up in general.' },
  /* AND THE SAME PAIR AT `middle`, BECAUSE THE CORNER CANNOT SHOW WHETHER THIS PARTS A BOARD.
   *
   * At `top-tie-first` every hit takes the SAME damage index, so a permutation of the four packets
   * sums to the same total and the turn-boundary board is IDENTICAL — the divergence is real, is
   * visible on the wire, and writes no board leaf. That is worth knowing and it is not the whole
   * story: at `middle` the four hits draw four DIFFERENT indices, so the same permutation lands
   * different rolls on different packets and the total moves. The pool game that produced #544 was a
   * board-material game on `middle`, and this pair is what connects the two.
   *
   * The cross-arm multiset claim below is NOT made about these two, deliberately: with a per-hit roll
   * the packets are no longer a pure function of the base power, so "same multiset" would be a
   * coincidence to assert rather than an arithmetic fact. */
  { id: 'after-a-switch-middle', kind: 'red', sw: true, pin: 'middle',
    what: 'THE SAME SWITCH UNDER REAL PER-HIT DICE. This is the pin the pool card was measured on, '
        + 'and the one where a permuted ally list changes the TOTAL and therefore the board.' },
  { id: 'no-switch-middle', kind: 'control', sw: false, pin: 'middle',
    what: 'AND ITS CONTROL, so a parted board under `middle` cannot be blamed on the dice.' },
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
for (const row of ATT_SIDE.concat(DEF_SIDE)) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
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
const BU_MOD = String(BU_MOVE.onModifyMove || '').replace(/\s+/g, ' ');
const CHAMP_MV = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
const SWITCHIN = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'sim', 'battle-actions.ts'), 'utf8')
  .replace(/\s+/g, ' ');
/* THE FOUR POWERS, DERIVED FROM THE FORMAT'S OWN BASE STATS THROUGH THE AUTHORITY'S OWN EXPRESSION.
 * Printed so the reader can see the order, and refused if any two collide — a fixture whose powers
 * are not distinct cannot observe an order at all, and would report a permutation as agreement. */
const powerOf = sp => 5 + Math.floor(dex.species.get(sp).baseStats.atk / 10);
const BUILD = ATT_SIDE.map(r => r.species);
const POWERS = BUILD.map(powerOf);
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    beatup basePowerCallback   : ' + BU_SRC.slice(0, 130));
console.log('    beatup onModifyMove        : ' + BU_MOD.slice(0, 130));
console.log('    champions overrides beatup : ' + /\bbeatup\s*:/.test(CHAMP_MV));
console.log('    the four bodies, in BUILD order and their 5+floor(atk/10):');
BUILD.forEach((s, i) => console.log('      ' + i + '  ' + dex.species.get(s).name.padEnd(14)
  + ' base atk ' + String(dex.species.get(s).baseStats.atk).padStart(4) + '   power ' + POWERS[i]));
console.log('    after the swap of index 1 and index 3, the authority walks: '
  + [BUILD[0], BUILD[3], BUILD[2], BUILD[1]].map(dex.species.get.bind(dex.species)).map(x => x.name).join(', '));
if (!/move\.allies!?\.shift\(\)!?\.set\.species/.test(BU_SRC)
    || !/baseStats\.atk \/ 10/.test(BU_SRC)
    || !/move\.allies = pokemon\.side\.pokemon\.filter/.test(BU_MOD)
    || !/move\.multihit = move\.allies\.length/.test(BU_MOD)
    || !/side\.pokemon\[pokemon\.position\] = pokemon; side\.pokemon\[oldActive\.position\] = oldActive;/.test(SWITCHIN)
    || /\bbeatup\s*:/.test(CHAMP_MV)
    || new Set(POWERS).size !== POWERS.length) {
  console.log(NL + 'NOT RUN — the format no longer carries the rule this file is about, or the four '
    + 'powers are not distinct. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READERS -------------------------------------------------------------------------------- */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const KEEP = /^\|(move|switch|cant|-damage|-fail|-crit|-supereffective|-resisted|-immune|faint|-activate|-singleturn|-boost|-hitcount|-ability)\|/;
function shape(lines) {
  const out = [];
  for (const raw of lines.map(String)) {
    if (!KEEP.test(raw)) continue;
    const p = raw.split('|');
    const tag = p[1], who = norm(String(p[2] || '').split(':').slice(-1)[0]);
    const rest = p.slice(3).filter(x => !/^p[12][ab]:/.test(x))
      .map(x => norm(String(x).replace(/^\s*(move|ability|item):\s*/i, ''))).filter(Boolean);
    out.push(tag + '|' + who + '|' + rest.join('|'));
  }
  return out;
}
/* THE PER-HIT DAMAGE, in order, off each stream's own `-damage` lines on the target. Beat Up is the
 * only thing that touches this body in the whole file, so the i-th drop IS hit i. */
function hits(lines) {
  const out = []; let prev = null;
  for (const raw of lines.map(String)) {
    const m = /^\|-damage\|p[12][ab]: ?([^|]*)\|(\d+)\/(\d+)/.exec(raw);
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

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get(c.pin);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.pin); process.exit(2); }
  const a = G.buildPair(ATT_SIDE), b = G.buildPair(DEF_SIDE);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_beatup_ally_order :: ' + c.id, {
    script: SCRIPT(c.sw), arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical,
                                           diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) }),
  });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  return { r, delta, boards, sd: shape(sdAll), me: shape(meAll),
           sdHits: hits(sdAll), meHits: hits(meAll),
           sdCount: hitcount(sdAll), meCount: hitcount(meAll),
           sc: G.scriptCounters(), cc: G.choiceCounters(),
           restored: (globalThis.MEDFAILS || {})[KNOB_STAMP] || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const sortedEq = (x, y) => eq([...x].sort((p, q) => p - q), [...y].sort((p, q) => p - q));
const boardEq = rows => rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');

let bad = 0, ran = 0;
const seen = new Map();
let knobBound = false;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   pin ' + c.pin
    + '   a body switches before the click: ' + c.sw);
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;
  if (brk.restored) knobBound = true;

  console.log('    hit count      showdown ' + clean.sdCount + '   medicham ' + clean.meCount
    + '   |   knob medicham ' + brk.meCount);
  console.log('    per-hit damage showdown ' + JSON.stringify(clean.sdHits)
    + '   medicham ' + JSON.stringify(clean.meHits) + '   |   knob ' + JSON.stringify(brk.meHits));
  console.log('    board          ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards));
  if (!boardEq(clean.boards)) for (const b of clean.boards) if (!b.identical) console.log('      b' + b.t + ' diffs ' + JSON.stringify(b.diffs));
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored
    + '   |   clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : '')
    + '   |   choices refused ' + clean.cc.refused
    + '   |   beatUpAllyNoBaseAtk ' + ((globalThis.MEDFAILS || {}).beatUpAllyNoBaseAtk || 0));

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.cc.refused || brk.cc.refused) {
    console.log('    >> FIXTURE FAILED — the authority refused a choice.'); bad++; continue; }
  /* THE COUNT IS ASSERTED BEFORE THE ORDER, because #542 read this as a count bug and it is not one.
   * A run where the counts diverge is a DIFFERENT finding and must not be reported as this one. */
  if (clean.sdCount !== BUILD.length || clean.meCount !== BUILD.length) {
    console.log('    >> FIXTURE FAILED — the hit count is not ' + BUILD.length + ' on both engines, so '
      + 'this arm is not measuring an ORDER.'); bad++; continue; }
  if (clean.sdHits.length !== BUILD.length || clean.meHits.length !== BUILD.length) {
    console.log('    >> FIXTURE FAILED — ' + BUILD.length + ' damage lines were not read on the target.');
    bad++; continue; }

  seen.set(c.id, { sdHits: clean.sdHits, meHits: clean.meHits });

  /* NARRATION IS REPORTED APART FROM THE VERDICT, on the standing bar — commentary may differ, boards
   * may not. Counted as a MULTISET so one inserted line is not reported as twenty. */
  {
    const bag = new Map();
    for (const k of clean.sd) bag.set(k, (bag.get(k) || 0) + 1);
    for (const k of clean.me) bag.set(k, (bag.get(k) || 0) - 1);
    const only = s => s.map(([k, v]) => k + ' x' + Math.abs(v)).join(', ') || 'none';
    const sdOnly = [...bag].filter(([, v]) => v > 0), meOnly = [...bag].filter(([, v]) => v < 0);
    if (sdOnly.length || meOnly.length) {
      console.log('    NARRATION (second gate, not this file\'s verdict) — only in showdown: '
        + only(sdOnly) + '   |   only in medicham: ' + only(meOnly));
    }
  }

  const agree = boardEq(clean.boards) && eq(clean.sdHits, clean.meHits);
  if (!agree) {
    console.log('    >> DEFECT — the engines part on the per-hit sequence or on the board.');
    console.log('       the same multiset? ' + (sortedEq(clean.sdHits, clean.meHits)
      ? 'YES — same four packets, different ORDER, which is exactly what #544 derived'
      : 'NO — the packets themselves differ, which would be a DIFFERENT defect'));
    bad++;
  } else console.log('    >> the two engines agree on the hit count, every hit AND the board.');

  const knobAgree = boardEq(brk.boards) && eq(clean.sdHits, brk.meHits);
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this a red arm.');
  } else {
    if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob, so the change is not confined.'); bad++; }
  }
}

/* ---- THE CROSS-ARM CLAIM, READ OFF SHOWDOWN ALONE ----------------------------------------------
 *
 * The switch must REORDER the authority's own per-hit sequence and must NOT change the four packets
 * it is made of. Both halves are needed and neither is typed:
 *   - a different SEQUENCE proves `side.pokemon` moved;
 *   - the same MULTISET proves it moved by a PERMUTATION and not because the eligibility filter, the
 *     hit count or the damage formula changed. That second half is what separates #544 from #542's
 *     original reading, and it cannot be read off one arm.
 *
 * AND ONE DIAGNOSIS, printed rather than asserted: this engine's sequence on the SWITCH arm should be
 * the CONTROL's authority sequence, because build order is what it walks either way.
 */
const R = seen.get('after-a-switch'), C = seen.get('no-switch');
if (R && C) {
  console.log(NL + '  THE RULE, READ OFF SHOWDOWN ALONE');
  console.log('    with a switch    ' + JSON.stringify(R.sdHits));
  console.log('    without one      ' + JSON.stringify(C.sdHits));
  const moved = !eq(R.sdHits, C.sdHits), same = sortedEq(R.sdHits, C.sdHits);
  console.log('    reordered? ' + (moved ? 'YES' : 'NO') + '     same multiset? ' + (same ? 'YES' : 'NO'));
  if (!moved) {
    console.log('    >> THE SWITCH DID NOT REORDER THE AUTHORITY — either the fixture staged no switch '
      + 'or `side.pokemon` is not what this file believes. Nothing above is attributable.'); bad++; }
  if (!same) {
    console.log('    >> THE SWITCH CHANGED THE PACKETS THEMSELVES, so this is not a permutation and '
      + '#544 is the wrong row for it.'); bad++; }
  /* PRINTED, NOT ASSERTED, and it has a different meaning on either side of the fix — which is why it
   * says which. Before: identical means this engine walked build order straight through the switch.
   * After: it MUST stop being identical, and a run where it is still identical while the arm passes
   * would mean the arm went green for some other reason. */
  console.log('    DIAGNOSIS — medicham on the switch arm ' + JSON.stringify(R.meHits)
    + '   against the authority WITHOUT a switch ' + JSON.stringify(C.sdHits)
    + '   -> ' + (eq(R.meHits, C.sdHits)
      ? 'IDENTICAL: this engine walked BUILD ORDER through the switch — the #544 defect, exactly'
      : 'DIFFERENT: this engine is no longer walking build order through the switch'));
}

if (!ONLY && !knobBound) {
  console.log(NL + '  KNOB ABSENT — `' + KNOB + '` set no `MEDFAILS.' + KNOB_STAMP + '` on any arm.');
  console.log('    The restore knob does not exist in this engine, so the fix has not landed. This is '
    + 'the red-first state, not a pass.');
  bad++;
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
