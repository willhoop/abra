/* probe_encore_bracket.js — A MID-TURN ENCORE MOVES THE ENCORED BODY'S ACTION INTO THE ENCORED
 * MOVE'S PRIORITY BRACKET, AND THIS ENGINE KEPT IT IN THE CHOSEN MOVE'S. 2026-08-29.
 *
 *   SHOWDOWN_PATH=... node tests/probe_encore_bracket.js
 *   SHOWDOWN_PATH=... node tests/probe_encore_bracket.js --only up-quickattack
 *   SHOWDOWN_PATH=... node tests/probe_encore_bracket.js --release <id>
 *
 * ================= THE MECHANISM IS CHAMPIONS' OWN, AND MAINLINE DOES NOT HAVE IT ===============
 *
 * `data/mods/champions/moves.ts:286-320` REPLACES encore's `condition.onStart`. The clause mainline
 * does not have is the last one:
 *
 *     const action = this.queue.willMove(target);
 *     if (!action) {
 *       this.effectState.duration!++;
 *     } else if (action.moveid !== move.id && !target.hasItem('mentalherb')) {
 *       const priority = action.priority
 *                      - this.dex.moves.get(action.moveid).priority
 *                      + this.dex.moves.get(move.id).priority;
 *       this.queue.changeAction(target, { choice: 'move', moveid: move.id, order: action.order });
 *       this.queue.willMove(target)!.priority = priority;
 *     }
 *
 * Mainline (`data/moves.ts`, the `encore` entry) stops at `if (!this.queue.willMove(target))
 * this.effectState.duration++;` and leaves the swap to `onOverrideAction`, which runs at EXECUTION and
 * is explicitly documented in `sim/battle-queue.ts:290` as the door that "doesn't change priority
 * order". Champions took the other door. Reading `/data/moves.ts` here is reading a different game —
 * CLAUDE.md's eight-file rule, and this is the file it costs the most on.
 *
 * TWO CONSEQUENCES, AND THE SECOND IS NOT THE DELTA FORMULA. `changeAction` -> `insertChoice` ->
 * `resolveAction` (`sim/battle-queue.ts:166`) rebuilds the action from `moveid` and calls
 * `getActionSpeed` on it; the Champions line then overwrites `.priority` with the delta above. But
 * the encore lands INSIDE another body's move action, and `Battle#runAction` ends (gen >= 8) with
 *
 *     this.updateSpeed();
 *     for (const queueAction of this.queue.list) if (queueAction.pokemon) this.getActionSpeed(queueAction);
 *     this.queue.sort();                                          sim/battle.ts:2915-2922
 *
 * whose `getActionSpeed` re-derives `priority` as `dex.moves.get(action.move.id).priority` run through
 * `ModifyPriority` — so the delta is overwritten by a FULL re-derivation off the ENCORED move before
 * anything else runs. The re-sort cannot be skipped here: it is gated on `queue.peek()?.choice ===
 * 'move'`, and the relocated action is itself a queued move. `prankster-status` is the arm that
 * separates the two readings — the delta formula and this engine's old answer BOTH say 0 there, and
 * the authority says +1.
 *
 * ================= WHAT THIS ENGINE DID, AND WHY THE COMMENT ABOVE IT WAS RIGHT ==================
 *
 * WIRE 118 put `_selMv` on every collected action and made `actionPriority` read it, so an Encored
 * body kept the bracket of the move its player chose. That is `sim/battle-actions.ts`'s rule and it is
 * CORRECT for mainline and for the case Champions leaves alone — an Encore already standing at the top
 * of the turn, where the request offers only the encored move and `action.moveid` IS it. It is exactly
 * wrong for the case Champions rewrote: an Encore that lands mid-turn on a body that has not yet acted.
 *
 * ================= NO EXPECTATION IS TYPED =====================================================
 *
 * Every arm plays the identical script on both engines under the differential's own `middle` pin and
 * the two `|move|` orders are compared. Showdown's order IS the answer; this file asserts only that
 * the two agree, that the knob moves them apart again, and that the counters say the branch ran.
 *
 * ================= THE KNOB, AND WHY THERE ARE SIX CONTROLS ====================================
 *
 * `MEDI_ENCORE_KEEPS_SELECTED_BRACKET=1` restores the pre-fix reading in a child load and stamps
 * `MEDFAILS.encoreKeepsSelectedBracketRestored`, asserted ABSENT on the clean load and PRESENT under
 * the knob — a knob read by a module the driver never loaded reads identically on both and stages
 * nothing.
 *
 * An ordering fix that fires too widely reorders turns that are currently correct, which is worse than
 * the gap. Six arms exist to catch that, each clearing exactly one thing: NO ENCORE AT ALL (the knob
 * cleared explicitly — and its authority order is asserted DIFFERENT from `up-quickattack`'s, so the
 * instrument is shown able to see the relocation at all); an Encore whose move carries the SAME
 * bracket; an Encore whose target ALREADY MOVED (`willMove` returns null); an Encore REFUSED because
 * the target has never moved; a MENTAL HERB holder, which the authority's own clause excludes by name;
 * and a target whose CHOSEN move already IS the encored one (`action.moveid !== move.id` false).
 *
 * ================= THE FIXTURE, DERIVED ========================================================
 *
 * The victim must be the SLOWEST body on the field, so that "it moved second" can only be the bracket.
 * Speeds are the driver's: active slot 0 is base+52 and slot 1 is base+42 (`spreadFor` +32/+22, no
 * nature, Champions' `stat + evs + 20`). Sylveon 60 -> 102 in slot 1 is under Meowstic 156, Furfrou
 * 144 and Whimsicott 168 on every arm; Sableye 50 -> 92 likewise. Every species, ability, item and
 * move is checked against `Dex.forFormat('gen9championsvgc2026regmb')` AND against the learnset before
 * a game is played, and the file refuses to run on a single illegal cell.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time when
 * `--release` is absent, and a bare `node <file>` would write that cut into the real store. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

/* THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE. Turn 2 is the whole diagnosis and a turn-1
 * disagreement would otherwise truncate it. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_encore_bracket.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_ENCORE_KEEPS_SELECTED_BRACKET';

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

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

/* THE ENCORER. Prankster puts its Encore at +1, ahead of every priority-0 click on the board, so the
 * Encore always lands while the victim's own action is still queued. */
const WHIM = ['whimsicott', '', 'Prankster', ['Encore', 'Charm', 'Protect']];
/* THE SAME ENCORER WITH PRANKSTER TRADED FOR INFILTRATOR, FOR THE ONE ARM WHOSE VICTIM IS DARK.
 * A Prankster-boosted status move cannot touch a Dark type at all (`pranksterBoosted` is refused in
 * `Pokemon#runImmunity`'s caller, `sim/battle-actions.ts` `hitStepTryImmunity`), and the only slow
 * Prankster carriers this regulation has — Sableye and Grimmsnarl — are both Dark. The Encore simply
 * bounced, which the `-start` count caught. Whimsicott is still the fastest body on the board at 168,
 * so at priority 0 it still acts before the victim and the Encore still lands mid-turn. */
const WHIM_I = ['whimsicott', '', 'Infiltrator', ['Encore', 'Charm', 'Protect']];
/* THE TWO STRADDLERS, both faster than either victim and both in the priority-0 bracket. Fur Coat and
 * Keen Eye touch neither speed nor bracket. */
const FURF = ['furfrou', '', 'Fur Coat', ['Charm', 'Protect']];
const MEOW = ['meowstic', '', 'Keen Eye', ['Charm', 'Protect']];
/* THE VICTIM. Cute Charm needs contact to fire and nothing on this board contacts it. */
const SYLV = item => ['sylveon', item || '', 'Cute Charm',
  ['Helping Hand', 'Charm', 'Quick Attack', 'Moonblast', 'Protect', 'Calm Mind']];
/* THE PRANKSTER VICTIM, for the arm that separates a re-derivation from the delta formula. */
const SABL = ['sableye', '', 'Prankster', ['Calm Mind', 'Shadow Ball', 'Protect']];

const CH = { m: 'charm', t: 0 };
const CM = { m: 'calmmind' };
const QA = { m: 'quickattack', t: 0 };
const PR = { m: 'protect' };
const HH = { m: 'helpinghand' };
const ENC1 = { m: 'encore', t: 1 };   // at the foes' slot 1
const ENC0 = { m: 'encore', t: 0 };   // at the foes' slot 0

/* p1 = the encorer's side; p2 slot 1 = the victim. `mirror` swaps the two sides whole. */
const SIDE_ENC = (enc) => stage([enc || WHIM, FURF]).concat(BENCH('clefable', 'snorlax'));
const SIDE_VIC = (row, item) => stage([MEOW, row === SABL ? SABL : SYLV(item)])
  .concat(BENCH('garchomp', 'toxapex'));

const CASES = [
  /* ---- THE DEFECT, BOTH DIRECTIONS -------------------------------------------------------------- */
  { id: 'up-quickattack', kind: 'red', vic: 'sylveon', reloc: 1,
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, ''),
    script: [{ p1: [CH, CH], p2: [CH, QA] },
      { p1: [ENC1, CH], p2: [CH, CH] }],
    what: 'THE BRACKET GOES UP. Turn 1 the victim clicks Quick Attack; turn 2 it clicks Charm (0) and '
        + 'is Encored back into Quick Attack (+1) while its action is still queued. The victim is the '
        + 'slowest body on the field, so at 0 it moves LAST and at +1 it moves SECOND — the position '
        + 'is the bracket and can be nothing else.' },

  { id: 'down-quickattack', kind: 'red', vic: 'sylveon', reloc: 1,
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, ''),
    script: [{ p1: [CH, CH], p2: [CH, CH] },
      { p1: [ENC1, CH], p2: [CH, QA] }],
    what: 'AND DOWN, WHICH IS THE ARM A "MOVE IT TO THE FRONT" FIX FAILS. Turn 1 Charm; turn 2 the '
        + 'victim clicks Quick Attack (+1) and is Encored back into Charm (0), so it must fall from '
        + 'SECOND to LAST.' },

  { id: 'up-protect', kind: 'red', vic: 'sylveon', reloc: 1,
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, ''),
    script: [{ p1: [CH, CH], p2: [CH, PR] },
      { p1: [ENC1, CH], p2: [CH, CH] }],
    what: 'THE SHAPE THE EMPIRICAL ARM ACTUALLY CARRIES — game 2656709541 turn 4, a body Encored into '
        + 'Protect (+4) that the authority moves up and this engine leaves at the foot, where '
        + '`willAct()` is false and the shield fails. Kept apart from `up-quickattack` because the '
        + 'shield draws its own stall die and Quick Attack does not.' },

  { id: 'prankster-status', kind: 'red', vic: 'sableye', reloc: 1,
    A: SIDE_ENC(WHIM_I), B: SIDE_VIC(SABL, ''),
    script: [{ p1: [CH, CH], p2: [CH, CM] },
      { p1: [ENC1, CH], p2: [CH, { m: 'shadowball', t: 1 }] }],
    what: 'THE ARM THAT SEPARATES A RE-DERIVATION FROM THE DELTA FORMULA. A Prankster victim clicks a '
        + 'damaging move (0) and is Encored into Calm Mind. Champions\' own arithmetic gives '
        + '`0 - 0 + 0 = 0`; the post-action re-sort then runs ModifyPriority over the ENCORED move and '
        + 'Prankster answers +1. The delta reading and this engine\'s old reading BOTH say 0 here, so '
        + 'an implementation of the printed formula alone stays red on this arm.' },

  { id: 'mirror-side', kind: 'red', vic: 'sylveon', reloc: 1,
    A: SIDE_VIC(SYLV, ''), B: SIDE_ENC(),
    script: [{ p1: [CH, QA], p2: [CH, CH] },
      { p1: [CH, CH], p2: [ENC1, CH] }],
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE. The empirical arm carries this on p1 and on '
        + 'p2; a fix that reached one side only would pass `up-quickattack` and fail here.' },

  /* ---- THE CONTROLS. Each clears exactly one thing and must hold on BOTH loads ------------------- */
  { id: 'no-encore', kind: 'control', vic: 'sylveon', reloc: 0, differsFrom: 'up-quickattack',
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, ''),
    script: [{ p1: [CH, CH], p2: [CH, QA] },
      { p1: [CH, CH], p2: [CH, CH] }],
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board and the identical clicks with Charm in '
        + 'place of the Encore. This arm also carries the instrument\'s own proof: its AUTHORITY order '
        + 'is asserted DIFFERENT from `up-quickattack`\'s, so "the two engines agree" cannot be read '
        + 'off a turn where nothing could have moved.' },

  { id: 'same-bracket', kind: 'control', vic: 'sylveon', reloc: 1,
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, ''),
    script: [{ p1: [CH, CH], p2: [CH, CM] },
      { p1: [ENC1, CH], p2: [CH, CH] }],
    what: 'THE ENCORE RELOCATES AND THE ORDER MUST NOT MOVE. Calm Mind and Charm are both priority 0, '
        + 'so `changeAction` fires on the authority and changes nothing about the position. A fix that '
        + 'reordered on the fact of an Encore rather than on the bracket breaks here.' },

  { id: 'already-moved', kind: 'control', vic: 'sylveon', reloc: 0,
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, ''),
    script: [{ p1: [CH, CH], p2: [CH, CH] },
      { p1: [ENC1, CH], p2: [CH, HH] }],
    what: '`willMove(target)` RETURNS NULL AND THE AUTHORITY TAKES THE OTHER BRANCH. The victim clicks '
        + 'Helping Hand (+5) and has already acted when the Encore lands, so nothing is relocated and '
        + 'the duration is bumped instead. Nothing may move. THE FIRST DRAFT USED PROTECT HERE AND THE '
        + '`-start` COUNT CAUGHT IT: Encore carries the `protect` flag, so the shield refused the '
        + 'Encore outright and the arm staged a bounced move rather than a bumped duration.' },

  { id: 'encore-fails', kind: 'control', vic: 'sylveon', reloc: 0,
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, ''),
    script: [{ p1: [ENC1, CH], p2: [CH, CH] }],
    what: 'A REFUSED ENCORE MOVES NOTHING. Turn 1: the victim has never moved, so `onStart` returns '
        + 'false at `!move` and no volatile is written at all. A relocation hung off the ask rather '
        + 'than off the volatile fires here.' },

  { id: 'mental-herb', kind: 'control', vic: 'sylveon', reloc: 0,
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, 'Mental Herb'),
    script: [{ p1: [CH, CH], p2: [CH, QA] },
      { p1: [ENC1, CH], p2: [CH, CH] }],
    what: 'THE AUTHORITY\'S OWN EXCLUSION, BY NAME: `&& !target.hasItem(\'mentalherb\')`. Identical to '
        + '`up-quickattack` but for the item. The herb frees the Encore in the same breath, so the '
        + 'victim plays what it chose, at the bracket it chose, and must stay at the foot.' },

  { id: 'same-move', kind: 'control', vic: 'sylveon', reloc: 0,
    A: SIDE_ENC(), B: SIDE_VIC(SYLV, ''),
    script: [{ p1: [CH, CH], p2: [CH, CH] },
      { p1: [ENC1, CH], p2: [CH, CH] }],
    what: '`action.moveid !== move.id` IS FALSE. The victim clicked the encored move already, so the '
        + 'authority relocates nothing. The victim is at 0 either way; this arm fails if the fix '
        + 'rebuilds or re-brackets an action it had no business touching.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED ------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
const seenRow = new Set();
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const key = row.species + '|' + row.item + '|' + row.ability + '|' + row.moves.join(',');
  if (seenRow.has(key)) continue;
  seenRow.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.item && !legal(dex.items.get(row.item))) {
    console.log('ILLEGAL FIXTURE  ' + row.item + ' is not in this format'); illegal++;
  }
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

/* ---- THE MECHANISM, READ OUT OF THE FORMAT RATHER THAN QUOTED ---------------------------------- */
const ENC_SRC = String((dex.moves.get('encore').condition || {}).onStart || '');
const RELOCATES = /changeAction/.test(ENC_SRC);
const HERB_CLAUSE = /mentalherb/.test(ENC_SRC);
console.log(NL + '  CHAMPIONS\' OWN encore.condition.onStart, read at run time:');
console.log('    rewrites the queued action (`changeAction`) : ' + RELOCATES);
console.log('    excludes a Mental Herb holder by name       : ' + HERB_CLAUSE);
console.log('    priority arithmetic present                : ' + /action\.priority/.test(ENC_SRC));
for (const m of ['quickattack', 'charm', 'protect', 'calmmind', 'shadowball', 'encore']) {
  const x = dex.moves.get(m);
  console.log('    ' + x.name.padEnd(12) + ' priority ' + String(x.priority).padStart(2)
    + '  category ' + x.category + '  failencore=' + !!x.flags['failencore']);
}
if (!RELOCATES || !HERB_CLAUSE) {
  console.log(NL + 'NOT RUN — the format no longer carries the clause this file is about. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
const ACT = /^\|(move|switch)\|/;
const orderOf = arr => {
  const out = [[]];
  for (const raw of arr.map(String)) {
    if (/^\|turn\|/.test(raw)) { out.push([]); continue; }
    if (ACT.test(raw)) out[out.length - 1].push(raw.split('|')[2].replace(/\s+/g, ' ').trim());
  }
  return out.slice(1);   // the leading block is the leads' |switch| burst
};
const ENC_START = /^\|-start\|[^|]*\|(move: )?encore/i;

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_encore_bracket :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const sd = orderOf(G.sdStream(G.lastSdLog()));
  return { r, delta, sd, me: orderOf(r.mediTrace),
    sdEnc: G.sdStream(G.lastSdLog()).filter(l => ENC_START.test(String(l))).length,
    meEnc: (r.mediTrace || []).filter(l => ENC_START.test(String(l))).length,
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).encoreKeepsSelectedBracketRestored || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const LAST = a => (a && a.length ? a[a.length - 1] : []);

let bad = 0, ran = 0;
const seen = new Map();
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']');
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  const T = c.script.length - 1;                       // the diagnostic turn (0-based)
  const sdT = clean.sd[T] || [], meT = clean.me[T] || [], meKT = (brk.me || [])[T] || [];
  console.log('    showdown  T' + (T + 1) + '   ' + sdT.join('  ->  '));
  console.log('    medicham  T' + (T + 1) + '   ' + meT.join('  ->  '));
  console.log('    medicham  T' + (T + 1) + '   ' + meKT.join('  ->  ') + '   [knob]');
  console.log('    encore -start lines   showdown ' + clean.sdEnc + '   medicham ' + clean.meEnc);
  console.log('    relocations counted   clean ' + (clean.delta.encoreRelocatedQueuedAction || 0)
    + '   knob ' + ((brk.delta || {}).encoreRelocatedQueuedAction || 0)
    + '   (expected clean ' + c.reloc + ')');
  console.log('    MEDFAILS stamp        clean ' + clean.restored + '   knob ' + brk.restored
    + '   |   script clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : ''));

  /* A CLICK THE REQUEST DID NOT OFFER becomes a `pass` on both engines and the arm agrees while
   * testing nothing. Asserted at EXACT zero. */
  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  /* SHORT IS NOT A PASS. */
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/' + brk.r.turns
      + ' of ' + c.script.length + ').'); bad++; continue;
  }
  /* THE ENCORE MUST HAVE LANDED, OR NOT, AS THE ARM CLAIMS — and identically on both engines. */
  const wantEnc = c.id === 'no-encore' || c.id === 'encore-fails' ? 0 : 1;
  if (clean.sdEnc !== wantEnc || clean.meEnc !== wantEnc) {
    console.log('    >> FIXTURE FAILED — expected ' + wantEnc + ' `-start ... Encore` on each stream.');
    bad++; continue;
  }
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED. */
  if (!(clean.restored === 0 && brk.restored === 1)) {
    console.log('    >> KNOB DID NOT BIND — the load-time stamp is not absent-clean/present-on-knob.');
    bad++; continue;
  }
  /* THE RELOCATION COUNTER, EXACT. A control at 0 and a red arm at 1, so "it agreed" cannot be read
   * off a branch that never ran. */
  if ((clean.delta.encoreRelocatedQueuedAction || 0) !== c.reloc) {
    console.log('    >> THE BRANCH DID NOT RUN AS CLAIMED.'); bad++;
  }

  seen.set(c.id, { sd: sdT, me: meT, meKnob: meKT });

  if (!eq(sdT, meT)) { console.log('    >> DEFECT — the two engines order the turn differently.'); bad++; }
  else console.log('    >> the two engines order the turn identically.');

  if (c.kind === 'red') {
    if (eq(sdT, meKT)) { console.log('    >> THE KNOB DID NOT MOVE THE ORDER — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this arm a red one.');
  } else {
    if (!eq(sdT, meKT)) { console.log('    >> OVER-FIRE — the control moved under the knob, so the change is not confined.'); bad++; }
  }
}

/* THE INSTRUMENT'S OWN CONTROL: `no-encore` must order the turn DIFFERENTLY from `up-quickattack` on
 * the AUTHORITY. Without it, every "the engines agree" above could be a turn the Encore could not
 * have moved. */
for (const c of CASES) {
  if (!c.differsFrom) continue;
  const a = seen.get(c.id), b = seen.get(c.differsFrom);
  if (!a || !b) continue;
  const moved = !eq(a.sd, b.sd);
  console.log(NL + '  INSTRUMENT CONTROL — showdown orders `' + c.id + '` differently from `'
    + c.differsFrom + '`: ' + (moved ? 'YES' : 'NO'));
  if (!moved) { console.log('    >> THE KNOB IS UNWIRED IN THE AUTHORITY TOO — nothing here measures anything.'); bad++; }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
