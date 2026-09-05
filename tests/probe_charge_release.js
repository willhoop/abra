/* probe_charge_release.js — THE RELEASE TURN OF A TWO-TURN MOVE, WHICH NO STAGED SCENARIO IN THIS
 * REPOSITORY HAD EVER PLAYED. 2026-09-05.
 *
 *   SHOWDOWN_PATH=... node tests/probe_charge_release.js
 *   SHOWDOWN_PATH=... node tests/probe_charge_release.js --only release-at-b
 *   SHOWDOWN_PATH=... node tests/probe_charge_release.js --release <id>
 *
 * ================= WHY THERE WAS NO FIXTURE, AND WHAT IT COST ==================================
 *
 * `docs/_reports/2026-09-05-fix-batch-8.md` §6 and OWED 1 recorded `vol.charging` as REAL and
 * UNSTAGEABLE. The blocker was the INSTRUMENT and not the mechanic. `scripted()` in
 * `engine/game_differential.js` read
 *
 *     const tt = (act.moves[k] && 'target' in act.moves[k]) ? act.moves[k].target : dm.target;
 *
 * and `Pokemon#getMoves(lockedMove)` (`sim/pokemon.ts:971-990`) returns `{ move, id }` with NO
 * `target` field at all for a locked move. So the encoder fell back to the DEX ROW, supplied a
 * target, and `Side#chooseMove` (`sim/side.ts:667-670`) refused the entire choice —
 * *"Can't move: You can't choose a target for Phantom Force"*. Every one of the ten two-turn moves
 * legal in this regulation is `normal` or `any` targeted (derived below, not recalled), so the
 * refusal was total: no directed scenario had ever reached a release turn.
 *
 * The UNSCRIPTED chooser in the same file already carried the right rule and a comment recording the
 * four games it cost — `const tt = ('target' in mv) ? mv.target : null;`. `'target' in mv` is the
 * AUTHORITY answering "does this click name a body"; `mv.target || dm.target` is a guess made from a
 * different object. Only `scripted()` was never updated.
 *
 * ================= WHAT THE RELEASE TURN ACTUALLY DOES WRONG ====================================
 *
 * THE AUTHORITY REMEMBERS WHERE THE CHARGE WAS AIMED. `twoturnmove.onStart`
 * (`data/conditions.ts:287-306`) stores the aim on the sub-volatile —
 *
 *     let moveTargetLoc: number = attacker.lastMoveTargetLoc!;
 *     attacker.volatiles[effect.id].targetLoc = moveTargetLoc;
 *
 * — and `Side#chooseMove`'s locked branch (`sim/side.ts:673-686`) replays it:
 *
 *     let lockedMoveTargetLoc = pokemon.lastMoveTargetLoc || 0;
 *     if (pokemon.volatiles[lockedMoveID]?.targetLoc) lockedMoveTargetLoc = ...;
 *
 * It is a LOCATION, so a body that took that slot in the meantime is hit instead — which is exactly
 * what `reaimToSlot` already does on this engine's side for every other aimed move.
 *
 * MEDICHAM2 REMEMBERED NOTHING. The release action was built as
 *
 *     const _t = live(foes)[0] || null;                       // engine/medicham2-browser.js
 *
 * — the LOWEST LIVE FOE INDEX, every time. A Phantom Force charged at the foes' slot b and released
 * while both foes were standing struck slot a instead.
 *
 * THIS WAS INVISIBLE UNTIL 2026-09-05 AND THE REASON IS THE OLD DRIVER. `chooseAction` resolved every
 * single-foe click with `foes.findIndex(q => q && !q.fainted)` — the same lowest live index — so the
 * driver aimed at slot a on every click of every game, and re-aiming a release to slot a was a
 * NO-OP BY CONSTRUCTION. `joint-empirical-click/v1` draws a real joint target and aims at slot b, and
 * the charge moves immediately dominated its unshared-address shapes
 * (`docs/_reports/2026-09-05-driver-joint-model.md` §6: 23 crit `phantomforce`, 18 `electroshot`,
 * 5 `solarbeam`, against ZERO charge-move shapes in the control arm).
 *
 * ================= NO EXPECTATION IS TYPED =====================================================
 *
 * Every arm plays the identical script on both engines under a pinned arm and the two protocol
 * streams are compared. SHOWDOWN'S AIM IS THE ANSWER; this file asserts only that the two agree,
 * that the knob moves them apart again, that the counter says the branch ran, and — on the controls —
 * that a run which could have seen a difference did not.
 *
 * The assertion reads the `|move|` line's TARGET FIELD and the `-damage` recipients out of each
 * ENGINE'S OWN STREAM. Nothing here recomputes an aim and compares the engine to it.
 *
 * ================= THE KNOB ====================================================================
 *
 * `MEDI_CHARGE_REAIMS_FIRST_LIVE_FOE=1` restores `live(foes)[0]` in a child load and stamps
 * `MEDFAILS.chargeReaimsFirstLiveFoeRestored`, asserted ABSENT on the clean load and PRESENT under the
 * knob — a knob read by a module the driver never loaded reads identically on both and stages nothing.
 *
 * ================= THE ARMS ====================================================================
 *
 *   release-at-b   RED      charge at the foes' slot b, release with BOTH foes standing.
 *   release-at-a   CONTROL  the same charge aimed at slot a. The old rule is right here by accident,
 *                           so this arm must be green BEFORE and AFTER, on the clean load AND under
 *                           the knob — that is what says the fix did not move a correct board.
 *   direct-at-b    CONTROL  THE KNOB CLEARED EXPLICITLY: the same board, the same aim, a SINGLE-turn
 *                           Ghost move. Its authority target is asserted DIFFERENT from
 *                           `release-at-a`'s, so "the two engines agree" cannot be read off a turn
 *                           where nothing could have moved. No charge is set, so the counter must
 *                           read 0 and the knob must change nothing at all.
 *   mirror-side    RED      the same charge with the two sides exchanged whole, because `mk` is called
 *                           four times with the foe array swapped and a fix that reached one side
 *                           only would pass `release-at-b`.
 *
 * ================= THE FIXTURE, DERIVED ========================================================
 *
 * The two foes differ in TYPE and in HP total, so a hit on the wrong one is unmistakable in the
 * stream and in the board: Meowstic is Psychic (Ghost x2) and Sylveon is Fairy (Ghost x1). Every
 * bystander clicks Calm Mind, which is `self`-targeted, carries no die, and raises SpD — Phantom
 * Force and Shadow Ball are read off Attack and Special Attack against Defence and Special Defence
 * respectively, and no bystander is ever hit. Protect is deliberately NOT used as filler: its
 * consecutive-use roll is a die and a `-fail` on one engine only would part the stream for a reason
 * this file is not about.
 *
 * Every species, item, ability and move is checked against `Dex.forFormat('gen9championsvgc2026regmb')`
 * AND against the learnset before a game is played, and the file refuses to run on a single illegal
 * cell. Nothing is caught silently: `buildPair` returning null is reported as NOT-STAGED and counted
 * as a failure, never as a skip.
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

/* THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE. The release turn is the whole diagnosis. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_charge_release.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_CHARGE_REAIMS_FIRST_LIVE_FOE';

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

/* THE CHARGER. Cursed Body is Gengar's only ability in this regulation and it fires when the HOLDER is
 * hit — nothing on this board ever hits Gengar, so it is inert here rather than chosen. */
const GENG = ['gengar', '', 'Cursed Body', ['Phantom Force', 'Shadow Ball', 'Protect']];
/* THE BYSTANDER on the charger's side. Magic Guard touches nothing here. */
const CLEF = ['clefable', '', 'Magic Guard', ['Calm Mind', 'Protect']];
/* THE TWO CANDIDATE VICTIMS. Psychic takes Ghost at x2 and Fairy at x1, and their HP totals differ,
 * so a hit on the wrong body is visible twice over. */
const MEOW = ['meowstic', '', 'Keen Eye', ['Calm Mind', 'Protect']];
/* Pixilate, not Cute Charm: Phantom Force is a CONTACT move and Cute Charm draws an infatuation die
 * on the body that gets hit — which is the body this file is measuring. */
const SYLV = ['sylveon', '', 'Pixilate', ['Calm Mind', 'Protect']];
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

const CM = { m: 'calmmind' };
const PF0 = { m: 'phantomforce', t: 0 };
const PF1 = { m: 'phantomforce', t: 1 };
const SB1 = { m: 'shadowball', t: 1 };

const P1 = stage([GENG, CLEF]).concat(BENCH('garchomp', 'toxapex'));
const P2 = stage([MEOW, SYLV]).concat(BENCH('snorlax', 'furfrou'));

const CASES = [
  { id: 'release-at-b', kind: 'red', arm: 'middle', counter: 1,
    A: P1, B: P2,
    script: [{ p1: [PF1, CM], p2: [CM, CM] },
      { p1: [PF1, CM], p2: [CM, CM] }],
    what: 'THE DEFECT. Phantom Force is charged at the foes\' slot b (Sylveon) and released while BOTH '
        + 'foes are standing. The authority replays the remembered targetLoc; this engine rebuilt the '
        + 'action against `live(foes)[0]` and struck slot a (Meowstic) instead. The turn-2 `t: 1` is '
        + 'ignored by the encoder — the request for a locked move carries no target field at all — so '
        + 'the aim under test is the one REMEMBERED from turn 1.' },

  { id: 'release-at-a', kind: 'control', arm: 'middle', counter: 1,
    A: P1, B: P2,
    script: [{ p1: [PF0, CM], p2: [CM, CM] },
      { p1: [PF0, CM], p2: [CM, CM] }],
    what: 'THE OLD RULE IS RIGHT HERE BY ACCIDENT, AND MUST STAY RIGHT. The charge is aimed at slot a, '
        + 'which is also `live(foes)[0]`, so both readings name Meowstic. Green on the clean load AND '
        + 'under the knob: a fix that re-aimed on the fact of a charge rather than on the remembered '
        + 'slot breaks here.' },

  { id: 'direct-at-b', kind: 'control', arm: 'middle', counter: 0,
    A: P1, B: P2, differsFrom: 'release-at-a',
    script: [{ p1: [SB1, CM], p2: [CM, CM] },
      { p1: [SB1, CM], p2: [CM, CM] }],
    what: 'THE KNOB CLEARED EXPLICITLY — the same board and the same aim with a SINGLE-turn Ghost move '
        + 'in place of the two-turn one. This arm carries the instrument\'s own proof: its authority '
        + 'target is asserted DIFFERENT from `release-at-a`\'s, so "the two engines agree" cannot be '
        + 'read off a turn where nothing could have moved. No charge is ever set, so the release '
        + 'counter must read 0 and the knob must change nothing.' },

  { id: 'mirror-side', kind: 'red', arm: 'middle', counter: 1, who: 'p2a: Gengar',
    A: P2, B: P1,
    script: [{ p1: [CM, CM], p2: [PF1, CM] },
      { p1: [CM, CM], p2: [PF1, CM] }],
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE. `mk` is called four times with the foe '
        + 'array swapped, and the empirical arm carries charge moves on p1 AND on p2 — a fix that '
        + 'reached one side only would pass `release-at-b` and fail here.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED ------------------------------------------------------------- */
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
const TTM = String((dex.conditions.get('twoturnmove') || {}).onStart || '');
const REMEMBERS = /targetLoc/.test(TTM);
const CHARGERS = dex.moves.all().filter(legal).filter(m => /twoturnmove/.test(String(m.onTryMove || '')));
console.log(NL + '  THE TWO-TURN FAMILY IN THIS REGULATION, derived at run time:');
console.log('    ' + CHARGERS.length + ' moves: '
  + CHARGERS.map(m => m.id + '(' + m.target + ')').join(' '));
console.log('    every one of them names a body: '
  + CHARGERS.every(m => ['normal', 'any', 'adjacentFoe'].includes(m.target)));
console.log('    `twoturnmove.onStart` stores a targetLoc: ' + REMEMBERS);
if (!REMEMBERS || !CHARGERS.length) {
  console.log(NL + 'NOT RUN — the format no longer carries the clause this file is about. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
/* TURN-SLICED, and every read is a FIELD of a protocol line rather than anything this file computes.
 * `|move|SOURCE|MOVE|TARGET` -> split('|') = ['', 'move', SOURCE, MOVE, TARGET, ...]. */
const sliceTurns = arr => {
  const out = [[]];
  for (const raw of arr.map(String)) {
    if (/^\|turn\|/.test(raw)) { out.push([]); continue; }
    out[out.length - 1].push(raw);
  }
  return out.slice(1);
};
const moveAim = lines => lines.filter(l => /^\|move\|/.test(l))
  .map(l => { const f = l.split('|'); return f[2] + ' -> ' + (f[4] || '(none)'); });
const damaged = lines => lines.filter(l => /^\|-damage\|/.test(l)).map(l => l.split('|')[2]);
/* THE ONE LINE THAT NAMES THE BODY THE CHARGE STRUCK. Read off the mover, not off the move name,
 * because the two engines spell move names differently and nothing here depends on that. */
const aimOfMover = (lines, who) => {
  const l = lines.find(x => /^\|move\|/.test(x) && x.split('|')[2] === who);
  return l ? (l.split('|')[4] || '(none)') : null;
};

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  const r = G.playGame(a, b, 'directed', 'probe_charge_release :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta,
    sd: sliceTurns(G.sdStream(G.lastSdLog())),
    me: sliceTurns(r.mediTrace || []),
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).chargeReaimsFirstLiveFoeRestored || 0 };
}

let bad = 0, ran = 0;
const authorityAim = new Map();
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   arm ' + c.arm);
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused side ' + clean.which); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  if (brk.notStaged) { console.log('  NOT-STAGED under the knob — buildPair refused side ' + brk.which); bad++; continue; }
  if (brk.r.err) { console.log('  THREW under the knob — ' + brk.r.err); bad++; continue; }
  harness(false);
  ran++;

  const T = c.script.length - 1;                       // the release turn (0-based)
  const sdT = clean.sd[T] || [], meT = clean.me[T] || [], meKT = (brk.me || [])[T] || [];
  const WHO = c.who || 'p1a: Gengar';
  const sdAim = aimOfMover(sdT, WHO), meAim = aimOfMover(meT, WHO), meKAim = aimOfMover(meKT, WHO);
  console.log('    showdown  T' + (T + 1) + '   ' + moveAim(sdT).join('   |   '));
  console.log('    medicham  T' + (T + 1) + '   ' + moveAim(meT).join('   |   '));
  console.log('    medicham  T' + (T + 1) + '   ' + moveAim(meKT).join('   |   ') + '   [knob]');
  console.log('    -damage   showdown ' + JSON.stringify(damaged(sdT))
    + '   medicham ' + JSON.stringify(damaged(meT))
    + '   knob ' + JSON.stringify(damaged(meKT)));
  console.log('    release counter  clean ' + (clean.delta.chargeReleasedAtRememberedSlot || 0)
    + '   knob ' + ((brk.delta || {}).chargeReleasedAtRememberedSlot || 0)
    + '   (expected clean ' + c.counter + ')');
  const shortDiv = d => (!d ? 'none' : (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 220)));
  console.log('    board divergence clean ' + shortDiv(clean.r.stateDiv));
  console.log('    board divergence knob  ' + shortDiv(brk.r.stateDiv));
  console.log('    release fallbacks  vacated ' + (clean.delta.chargeReleaseSlotVacated || 0)
    + '   no-remembered-slot ' + (clean.delta.chargeReleaseNoRememberedSlot || 0));
  console.log('    MEDFAILS stamp   clean ' + clean.restored + '   knob ' + brk.restored
    + '   |   script clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : ''));
  console.log('    locked clicks encoded with NO target   clean ' + clean.sc.lockedNoTarget
    + '   knob ' + brk.sc.lockedNoTarget + '   (expected ' + c.counter + ')');

  /* A CLICK THE REQUEST DID NOT OFFER becomes a `pass` on both engines and the arm agrees while
   * testing nothing. Asserted at EXACT zero on both loads. */
  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue;
  }
  /* THE INSTRUMENT'S OWN RECEIPT. A release turn is a turn on which the request offered a move with
   * NO target field; a charge arm that reads 0 here never reached one, whatever else it says. This
   * counter read 0 on every run in this repository's history before 2026-09-05, because `scripted()`
   * supplied a target and Showdown refused the whole choice. */
  if (clean.sc.lockedNoTarget !== c.counter || brk.sc.lockedNoTarget !== c.counter) {
    console.log('    >> FIXTURE FAILED — ' + clean.sc.lockedNoTarget + '/' + brk.sc.lockedNoTarget
      + ' locked clicks encoded, expected ' + c.counter + ' on each load.'); bad++; continue;
  }
  /* SHORT IS NOT A PASS. */
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/' + brk.r.turns
      + ' of ' + c.script.length + ').'); bad++; continue;
  }
  /* THE MOVER MUST HAVE ACTED ON THE RELEASE TURN ON BOTH ENGINES. A missing `|move|` line would make
   * every comparison below vacuous. */
  if (!sdAim || !meAim || !meKAim) {
    console.log('    >> FIXTURE FAILED — the charger has no `|move|` line on T' + (T + 1)
      + ' (sd ' + sdAim + ' / medi ' + meAim + ' / knob ' + meKAim + ').'); bad++; continue;
  }
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED — except on the arm where no charge is
   * ever set, which the knob cannot reach at all and where absence on BOTH loads is the finding. */
  const wantStamp = c.counter > 0;
  if (wantStamp ? !(clean.restored === 0 && brk.restored === 1)
    : !(clean.restored === 0 && brk.restored === 0)) {
    console.log('    >> KNOB DID NOT BIND — stamp clean ' + clean.restored + ' knob ' + brk.restored
      + ', expected ' + (wantStamp ? '0/1' : '0/0') + '.'); bad++; continue;
  }
  /* THE MECHANIC MUST HAVE FIRED. A release that never consulted a remembered slot proves nothing
   * about remembering one. */
  if ((clean.delta.chargeReleasedAtRememberedSlot || 0) !== c.counter) {
    console.log('    >> COUNTER — the remembered-slot release fired '
      + (clean.delta.chargeReleasedAtRememberedSlot || 0) + ' times, expected ' + c.counter + '.');
    bad++; continue;
  }
  authorityAim.set(c.id, sdAim);
  if (c.differsFrom) {
    const other = authorityAim.get(c.differsFrom);
    if (other === undefined) {
      console.log('    >> INSTRUMENT — `differsFrom` names an arm that has not run.'); bad++; continue;
    }
    if (other === sdAim) {
      console.log('    >> INSTRUMENT BLIND — the authority aims at ' + sdAim + ' on this arm AND on '
        + c.differsFrom + ', so agreement here says nothing.'); bad++; continue;
    }
    console.log('    instrument check  authority aims ' + sdAim + ' here and ' + other + ' on '
      + c.differsFrom + ' — the two are distinguishable.');
  }
  /* THE ASSERTION. Showdown's aim is the answer. */
  const okClean = sdAim === meAim;
  const okKnob = sdAim === meKAim;
  if (!okClean) {
    console.log('    >> FAIL — the authority aimed at ' + sdAim + ' and medicham2 at ' + meAim + '.');
    bad++; continue;
  }
  if (c.kind === 'red' && okKnob) {
    console.log('    >> KNOB SAW NOTHING — the restored engine aims at ' + meKAim + ' as well, so this '
      + 'arm cannot tell the two readings apart and is not a red arm.');
    bad++; continue;
  }
  if (c.kind === 'control' && !okKnob) {
    console.log('    >> CONTROL MOVED — the restored engine aims at ' + meKAim
      + ' where the authority aims at ' + sdAim + '. This arm agreed before the fix and must still.');
    bad++; continue;
  }
  /* A CHARGE THAT COMMITTED WITH NO BODY ATTACHED never reaches the memory at all, so the arm would
   * be measuring the fallback while claiming to measure the fix. Asserted at exact zero. */
  if (clean.delta.chargeReleaseNoRememberedSlot || clean.delta.chargeReleaseSlotVacated) {
    console.log('    >> FIXTURE FAILED — the release took a FALLBACK (vacated '
      + (clean.delta.chargeReleaseSlotVacated || 0) + ', no-slot '
      + (clean.delta.chargeReleaseNoRememberedSlot || 0) + '), not the remembered slot.');
    bad++; continue;
  }
  /* AND THE BOARDS. An aim that matches with a parted board is not a pass. */
  if (clean.r.stateDiv) {
    console.log('    >> BOARD PARTED — ' + shortDiv(clean.r.stateDiv)); bad++; continue;
  }
  console.log('    PASS  authority ' + sdAim + ' = medicham2 ' + meAim
    + (c.kind === 'red' ? '   [knob aims ' + meKAim + ', so the arm can see the defect]' : ''));
}

console.log(NL + '================================================================');
console.log('  ' + ran + ' arm(s) ran, ' + bad + ' failed.');
if (bad) { console.log('  RED — the release turn does not match the authority.'); process.exit(1); }
console.log('  GREEN — every arm agreed with the authority, every control held, and the knob moved '
  + 'exactly the arms it should.');
