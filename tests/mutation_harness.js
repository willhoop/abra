/* COVERAGE LAYER 2 — MUTATION: does the handler MATTER, or does it only FIRE?
 *
 *   node tests/mutation_harness.js              gate + FULL sweep, writes data/mutation-coverage.json
 *   node tests/mutation_harness.js --gate-only  just the planted-stub demonstration
 *   node tests/mutation_harness.js --tags=a,b   sweep a chosen tag list
 *   node tests/mutation_harness.js --no-write   do not touch the artifact
 *   node tests/mutation_harness.js --release=<id>   measure a named frozen release
 *
 * WHY THIS EXISTS, in the words of the thing it catches.
 * ------------------------------------------------------
 * A STUB DOES NOT SHOW UP AS DEAD. `data/tag-consumption.json` has four buckets and a stub lands in
 * the two that are not ratcheted: a registered handler that never fires reads UNREACHED (deliberately
 * never ratcheted, because it measures the sweep and not the engine), and a handler that FIRES and
 * ignores its payload reads LIVE. WIRE 71 is the standing case — `extendsDuration` had four consuming
 * routes and three wrote a literal 5 for months with every test green. Shield Dust FIRED, the partial
 * trap FIRED, Purifying Salt's damage half FIRED, and all three were wrong. Taunt was probed, marked
 * LIVE, and blocks nothing.
 *
 * So: change the FACT and see whether the BEHAVIOUR moves. If it does not, the handler is not reading
 * what it claims to read.
 *
 * IT MEASURES A FROZEN RELEASE, NOT THE LIVE TREE.
 * -----------------------------------------------
 * ENGINE rewrites `engine/medicham2-browser.js` while this runs — that is the point of the divisions,
 * and it is only safe because a measurement reads a snapshot. The engine SOURCE, `data/tags.json`,
 * `data/engine-data.js` and every lazily-required data file come out of the release, and the artifact
 * carries `REL.stamp()`, so a reader can tell exactly which bytes produced these verdicts. Compiling
 * the LIVE source here would produce a defect list describing an engine that no longer exists — which
 * is the 7,100-game failure of 2026-08-04 in a smaller costume.
 *
 * THE THREE TRAPS, and what is done about each. Getting any of them wrong produces a FALSE DEAD,
 * which is the dangerous direction.
 *
 * (a) PER-PARAM OPERATORS, NOT ONLY PER-TAG. Removing `spreadAll` moves the SPREAD set, so the tag
 *     scores LIVE while `hitsAlly` stays ignored. Every operator family below is emitted twice: once
 *     removing the tag from the carrier, once perturbing each scalar param.
 *
 * (b) THE DERIVED SETS ARE BUILT AT MODULE LOAD. `medicham2-browser.js` builds SPREAD, HITS_ALLY, the
 *     terrain residual table and the priority-block map from the artifact when the module is first
 *     evaluated (lines ~167-237). `TAGS.__setDB()` after that point silently no-ops for every one of
 *     them, and a no-op reads as "removing this changed nothing" — a false DEAD. tags.js carries a
 *     `__onSetDB` rebuild hook and NOTHING IN THE ENGINE REGISTERS ONE (grep it), so this harness does
 *     not rely on the hook: it COMPILES A FRESH ENGINE INSTANCE per mutant, after the DB is injected,
 *     so every module-load derivation is rebuilt from the mutated artifact by construction. The
 *     planted set-building stub below is the proof that this actually happens.
 *
 * (c) A SEED BATTERY, NOT ONE SEED. One seed can miss a probabilistic effect (false DEAD). And a
 *     removed tag shifts PRNG CONSUMPTION, so a downstream roll changes for an unrelated reason
 *     (false LIVE). Both directions are named in the artifact: three CONSTANT-value rngs cannot shift
 *     a stream at all, so a difference under one of those is solid; two streaming LCGs can, so a
 *     difference seen ONLY under a streaming rng is recorded as `stream-shift-suspect` rather than
 *     quietly counted as evidence.
 *
 * (d) A FOURTH TRAP, FOUND BY RUNNING IT: THE STAGING ITSELF. `speedMult` scored READ-AND-IGNORED on a
 *     Choice Scarf the engine demonstrably reads, because the only body carrying it was 80 Speed
 *     against a 161 Speed foe — x1.5 = 120 overtakes nothing and turn order is the only observable a
 *     speed change has. There is no name-based Scarf fallback anywhere in the engine (grep it); the
 *     staging simply could not express the mechanic. That is why there are now TWO PAIRINGS and why
 *     the second one is defined by a GENERIC property — two bodies within one multiplier of each
 *     other — rather than by anything to do with Choice Scarf.
 *
 * THE EQUIVALENT-MUTANT DEFENCE, kept unchanged from the original design because the review calls it
 * the best idea in it: before scoring a mutant, ask whether the REFERENCE engine's two arms differ at
 * all. The control arm removes the CARRIER from the scenario (the ability becomes 'none', the item
 * becomes '', the move click becomes a pass). If the reference engine cannot tell those apart, the
 * case cannot express the mechanic and a mutation that changes nothing proves nothing — the case is
 * INERT and is never counted as evidence in either direction.
 *
 * THE STANDING GATE. No check is committed until it has been shown failing on a known-bad input. Two
 * stubs are PLANTED in the engine source in memory — one that reads a param and writes a literal (the
 * WIRE 71 shape), one that ignores a tag-derived SET — and the harness must report both as
 * READ-AND-IGNORED while reporting the shipped engine LIVE on the same operators. The sweep REFUSES
 * TO RUN if the gate does not catch them, because a harness that has never caught a planted stub is
 * not evidence.
 *
 * READ-AND-IGNORED IS NOT THE SAME THING AS A DEFECT, AND THE RULE THAT SEPARATES THEM IS WRITTEN
 * DOWN RATHER THAN APPLIED BY FEEL — see TRIAGE below. Every downgrade is decided from the FORMAT or
 * from the ARTIFACT, never from an opinion about whether a mechanic matters, and every class prints
 * the membership it matched so an over-match is visible before it is trusted (LESSONS §4).
 *
 * WHAT THIS INSTRUMENT STRUCTURALLY CANNOT SEE, printed on every run:
 *   - a fact derived WRONG upstream. It is propagated faithfully, consumed faithfully, and mutation
 *     says LIVE. Only the differential (tests/test-engine-diff.js, tests/test-game-diff.js) and the
 *     interaction matrix see that. Layer 4 owns it.
 *   - a mechanic no scenario here stages. That is UNSTAGEABLE, and it is NOT a clean result — it is
 *     the absence of one. It is counted separately and never folded into the pass.
 *   - nesting. A param whose value is an object or an array of objects is not perturbed; it is
 *     counted as `nested-not-mutated` so the gap is a number rather than a silence.
 *   - a handler that reads the fact and does the WRONG THING with it in a way this 5-turn script
 *     never reaches. LIVE here means "the payload moved the engine", not "the engine is right".
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const D = (...p) => path.join(__dirname, '..', ...p);

require(D('engine', 'job_cost.js')).track('mutation-harness');

/* ---- THE FROZEN RELEASE ------------------------------------------------------------------------
 * Everything the mutant engine sees comes from the snapshot: the source text, the artifact, the mon
 * database, and (through medicham2's own relative requires) move-effects.js. `loadEngine` compiles
 * with the SNAPSHOT's filename, so `require('./tags.js')` inside the engine resolves to the snapshot's
 * loader — the same module instance this file drives with `__setDB`. Compiling snapshot bytes under
 * the LIVE filename would silently pair frozen engine source with a live artifact. */
const RELEASE_ARG = (process.argv.find(a => a.startsWith('--release=')) || '').slice(10) || null;
const REL = require(D('engine', 'engine_release.js')).open(RELEASE_ARG || null);

const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const SHIPPED_SRC = REL.read('engine/medicham2-browser.js');
const SHIPPED_DB = JSON.parse(REL.read('data/tags.json'));
require(REL.path('data/engine-data.js'));
const TAGS = require(REL.path('engine/tags.js'));
const MC = (typeof global.MC !== 'undefined') ? global.MC : null;
if (!MC) throw new Error('the release snapshot did not publish MC — data/engine-data.js did not load');
const OUT = D('data', 'mutation-coverage.json');

const clone = o => JSON.parse(JSON.stringify(o));
const TABLE = { move: 'moves', item: 'items', ability: 'abilities' };

function loadEngine(src) {
  const m = new Module(MEDI_PATH, null);
  m.filename = MEDI_PATH;
  m.paths = Module._nodeModulePaths(path.dirname(MEDI_PATH));
  m._compile(src, MEDI_PATH);
  return m.exports;
}

/* ---- the rng battery ---------------------------------------------------------------------------
 * Three CONSTANT rngs (no stream, so removing a tag cannot realign anything) and two LCGs (a stream,
 * so they can see a probabilistic effect the constants miss AND can realign for unrelated reasons).
 * Which one saw the difference is recorded per operator. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNGS = [
  { name: 'k05', stream: false, make: () => () => 0.05 },
  { name: 'k50', stream: false, make: () => () => 0.5 },
  { name: 'k95', stream: false, make: () => () => 0.95 },
  { name: 'lcg-20260805', stream: true, make: () => mulberry32(20260805) },
  { name: 'lcg-777', stream: true, make: () => mulberry32(777) },
];

/* ---- the state projection ----------------------------------------------------------------------
 * Everything the engine can hold that a mutation could move. Deliberately WIDE rather than targeted:
 * a targeted projection is a hand-written expectation, and every one of this project's ~27 wrong
 * probes was a human writing down what should happen. */
function projVal(v) {
  if (v === null || v === undefined) return 'null';
  const t = typeof v;
  if (t === 'number' || t === 'string' || t === 'boolean') return String(v);
  if (t === 'function') return 'fn';
  if (v instanceof Set) return '{' + [...v].map(String).sort().join(',') + '}';
  if (v instanceof Map) return 'M' + v.size;
  if (Array.isArray(v)) return '[' + v.map(x => (x && typeof x === 'object') ? String(x.id || x.name || 'o') : String(x)).join(',') + ']';
  if (typeof v.curHP === 'number' && v.name) return 'mon:' + v.name;      // a body reference, not its state
  return '{' + Object.keys(v).sort().map(k => k + '=' + ((v[k] && typeof v[k] === 'object') ? projVal(v[k]) : String(v[k]))).join(',') + '}';
}
const MON_SKIP = new Set(['_sf', 'moves', 'st', '__mask']);   // _sf is the shared side object, projected once
const MASK_ANY = Symbol('mask-any');
/* THE MASK, AND IT IS NOT COSMETIC — WITHOUT IT THE EQUIVALENT-MUTANT DEFENCE DOES NOT WORK.
 *
 * The inertness question is "would the reference engine behave the same if the carrier were not
 * there". The control arm answers it by taking the carrier away — but `ability` and `item` are STATE,
 * so the projection contains the literal string `ability=magnetpull` in one arm and `ability=none` in
 * the other, and EVERY case comes back non-inert for a reason that has nothing to do with the
 * mechanic. The first cut of this file did exactly that and scored 32 of 32 cases expressive,
 * including Magnet Pull staged against a field with no Steel type on it.
 *
 * So the slot the carrier was planted in reports `#CTL#` for that one field FOR AS LONG AS IT STILL
 * HOLDS WHAT IT WAS GIVEN. A Knock Off or a Trick that moves it makes the value differ from the
 * planted one and the real value is printed again — the mask hides the staging, never a change. */
function projMon(m) {
  if (!m) return 'x';
  const ks = Object.keys(m).filter(k => !MON_SKIP.has(k)).sort();
  const mask = m.__mask;
  return ks.map(k => {
    if (mask && Object.prototype.hasOwnProperty.call(mask, k)
      && (mask[k] === MASK_ANY || String(m[k]) === String(mask[k]))) return k + '=#CTL#';
    return k + '=' + projVal(m[k]);
  }).join(';');
}
function projSide(sf) {
  if (!sf) return 'x';
  return Object.keys(sf).filter(k => k !== 'team').sort().map(k => k + '=' + projVal(sf[k])).join(';');
}
function projState(S) {
  return [
    'T' + S.turn,
    'F:' + projVal(S.field),
    'sA:' + projSide(S.sfA), 'sB:' + projSide(S.sfB),
    'aA:' + S.actA.map(m => m ? m.name : 'x').join(','), 'aB:' + S.actB.map(m => m ? m.name : 'x').join(','),
    'bA:' + S.benchA.map(m => m ? m.name : 'x').join(','), 'bB:' + S.benchB.map(m => m ? m.name : 'x').join(','),
  ].join(' | ');
}

/* ---- the scenarios -----------------------------------------------------------------------------
 * Six bare bodies — item and ability BLANKED on every one of them, so the carrier under test is the
 * only ability or item on the field. That is the rule this project learned from the Choice Scarf
 * probe that compared a Scarf against a Scarf.
 *
 * TWO PAIRINGS, AND THE SECOND ONE EXISTS FOR A REASON THE FIRST RUN EXPOSED — see trap (d) above.
 * Measured speeds at the release's own buildMon: incineroar 80, milotic 101, corviknight 112,
 * archaludon 130, garchomp 161, weavile 187, dragapult 205, torkoal 58.
 *
 *   p1        A0 incineroar 80   A1 milotic 101      B0 garchomp 161   B1 weavile 187
 *   p2-speed  A0 milotic 101     A1 corviknight 112  B0 archaludon 130 B1 torkoal 58
 *
 * In p2 every active body is inside one x1.5 of the body opposite it (101 -> 151 clears 130;
 * 130 -> 195 clears 112), so a speed multiplier flips a bracket and is observable. That is a GENERIC
 * property of a battery, not a fix aimed at one item.
 *
 * `stab` names a body's own-type damaging move so `stabBoost` has something to multiply — with only
 * Drain Punch on the field Adaptability came back UNSTAGEABLE. `special` is a SPECIAL, NON-CONTACT
 * attack, without which `punishesAttacker.trigger` cannot be discriminated: an unknown trigger falls
 * through to `:true` (fires on everything), so a contact-only battery reads a contact carrier
 * identically either way. */
const PAIRINGS = [
  { name: 'p1', A: ['incineroar', 'milotic', 'corviknight'], B: ['garchomp', 'weavile', 'archaludon'],
    stabA: 'nightslash', stabB: 'dragonclaw', specialA1: 'scald' },
  { name: 'p2-speed', A: ['milotic', 'corviknight', 'weavile'], B: ['archaludon', 'torkoal', 'dragapult'],
    stabA: 'scald', stabB: 'ironhead', specialA1: 'flashcannon' },
];
/* THE ARM IS (pairing x rng). Both halves are recorded on every difference, so a verdict can say
 * which staging saw it and whether the rng that saw it could have realigned a stream. */
const ARMS = [];
for (const p of PAIRINGS) for (const r of RNGS) ARMS.push({ key: p.name + '/' + r.name, pairing: p, rng: r, stream: r.stream });

function bare(M, sp) {
  const b = M.buildMon(sp, {});
  if (!b) throw new Error('no MC row for ' + sp);
  b.item = ''; b.ability = 'none';
  return b;
}

/* THE ABILITY / ITEM SCRIPT. Ten turns, and every slot on the field has a job, so a carrier can be
 * planted in any of the four and still find something to act on:
 *   T1  A0 Will-O-Wisp -> B0 (a direct status move), A1 Reflect (a SCREEN, which is what Light Clay
 *       extends). BOTH SIDES OTHERWISE IDLE — see the weather note below.
 *   T2  A0 Drain Punch (contact, and no secondary of its own — the move WIRE 115 had to switch to
 *       after Flare Blitz's own burn was misread as a Poison Touch proc), A1 a SPECIAL NON-CONTACT
 *       attack, B0 Sunny Day (a weather set, whose duration Heat Rock extends), B1 its side's STAB
 *   T3  A0 its own STAB into B0 (so a same-type multiplier has something to multiply), A1 Toxic,
 *       B0 Spore, B1 Rain Dance (a weather CHANGE, and the one Damp Rock extends)
 *   T4  A0 Icy Wind (a STAT DROP on both foes — what Defiant / Competitive / Clear Body / Contrary /
 *       Mirror Armor react to), B0 Thunder Wave, B1 Earth Power (a GROUND attack, without which
 *       Levitate and every other `typeImmunity` carrier is inert)
 *   T5  A0 and B0 switch (trapping, hazards, entry effects, Regenerator, Unburden)
 *   T6  B1 Swords Dance (a SELF boost — what Simple and Contrary react to)
 *   T7-T10  idle
 *
 * WHY IT RUNS TO TEN TURNS AND THEN STOPS ATTACKING. `extendsDuration` — WIRE 71's own tag, the
 * defect this whole file was built around — turns 5 into 8. A five-turn script CANNOT SEE THE
 * DIFFERENCE: both arms still have the screen up when the trace ends, so Light Clay and Damp Rock
 * read READ-AND-IGNORED on an engine that might read them perfectly. That is a FALSE DEFECT
 * manufactured by the battery, and a defect list full of them is a defect list nobody works through.
 * The screen goes up on T1 (expires end of T5 or end of T8) and the weather on T2 (end of T6 or end
 * of T9), so both boundaries fall strictly inside the trace. The tail is idle so that a body cannot
 * faint and truncate the very turns the duration question lives in.
 *
 * WHY THE WEATHER IS SET ON T2 AND NOT T1. A `weatherSetter` ability (Drought, Drizzle) fires on
 * ENTRY, and with Sunny Day clicked on turn 1 the control arm reached the same weather one turn
 * later — every weather ability came back INERT with asked=1392. The mechanic was fine; the script
 * was overwriting it before it could be observed.
 *
 * WHY THE THREE EXTRA STATUSES ARE LATE. Paralysis halves Speed, and Speed is the ONLY observable a
 * speed multiplier has. Paralysing A0 on turn 1 would put milotic at 50, so x1.5 = 75 never clears
 * archaludon's 130 — and `speedMult` would go back to reading READ-AND-IGNORED on an engine that
 * reads it, which is trap (d) reintroduced by the fix for a different gap. */
function scriptAbilItem(M, S, mons, turn, P) {
  const a2 = mons[2], b2 = mons[5];
  const PASS = { kind: 'pass' };
  const act = (m, mv, tg) => (m && !m.fainted && mv) ? M.playerAction(m, mv, tg, S.field) : PASS;
  const sw = (m, to) => (m && !m.fainted && to && !to.fainted && S.actA.indexOf(to) < 0 && S.actB.indexOf(to) < 0) ? { kind: 'switch', to } : PASS;
  const A0 = S.actA[0], A1 = S.actA[1], B0 = S.actB[0], B1 = S.actB[1];
  if (turn === 1) return [new Map([[A0, act(A0, 'willowisp', B0)], [A1, act(A1, 'reflect', null)]]),
                          new Map([[B0, PASS], [B1, PASS]])];
  if (turn === 2) return [new Map([[A0, act(A0, 'drainpunch', B0)], [A1, act(A1, P.specialA1, B0)]]),
                          new Map([[B0, act(B0, 'sunnyday', null)], [B1, act(B1, P.stabB, A0)]])];
  if (turn === 3) return [new Map([[A0, act(A0, P.stabA, B0)], [A1, act(A1, 'toxic', B1)]]),
                          new Map([[B0, act(B0, 'spore', A1)], [B1, act(B1, 'raindance', null)]])];
  if (turn === 4) return [new Map([[A0, act(A0, 'icywind', B0)], [A1, PASS]]),
                          new Map([[B0, act(B0, 'thunderwave', A0)], [B1, act(B1, 'earthpower', A0)]])];
  if (turn === 5) return [new Map([[A0, sw(A0, a2)], [A1, PASS]]), new Map([[B0, sw(B0, b2)], [B1, PASS]])];
  if (turn === 6) return [new Map([[A0, PASS], [A1, PASS]]), new Map([[B0, PASS], [B1, act(B1, 'swordsdance', null)]])];
  return [new Map([[A0, PASS], [A1, PASS]]), new Map([[B0, PASS], [B1, PASS]])];
}

/* THE MOVE SCRIPT. The move under test is clicked on T1 and the FOE ATTACKS ON THE SAME TURN, which
 * is what lets a reactive move (Protect, Wide Guard, a redirect, a counter) express itself at all —
 * without an incoming attack those all read as doing nothing. A status arrives on T1 and T2 so a
 * cure, a veil or a safeguard has something to act on. The two switches on T3 and T4 exist so a
 * hazard laid on either side and a trap applied to either side can resolve, and the tail is idle so
 * that a screen, a weather, a terrain or a trap SET BY THE MOVE UNDER TEST runs out inside the trace
 * rather than after it.
 *
 * `placement` for a move is the TARGET, not a slot: '@foe' and '@ally'. Helping Hand, Decorate and
 * Coaching are ally-targeted and a foe-only battery stages them at the wrong body — the same class of
 * staging error as trap (d), decided generically rather than by naming those moves. */
function scriptMove(M, S, mons, turn, moveId, P, targetSel) {
  const a2 = mons[2], b2 = mons[5];
  const PASS = { kind: 'pass' };
  const act = (m, mv, tg) => (m && !m.fainted && mv) ? M.playerAction(m, mv, tg, S.field) : PASS;
  const sw = (m, to) => (m && !m.fainted && to && !to.fainted && S.actA.indexOf(to) < 0 && S.actB.indexOf(to) < 0) ? { kind: 'switch', to } : PASS;
  const A0 = S.actA[0], A1 = S.actA[1], B0 = S.actB[0], B1 = S.actB[1];
  const tg = targetSel === '@ally' ? A1 : B0;
  if (turn === 1) return [new Map([[A0, act(A0, moveId, tg)], [A1, PASS]]),
                          new Map([[B0, act(B0, 'drainpunch', A0)], [B1, act(B1, 'willowisp', A0)]])];
  if (turn === 2) return [new Map([[A0, PASS], [A1, PASS]]),
                          new Map([[B0, act(B0, P.stabB, A0)], [B1, act(B1, 'thunderwave', A1)]])];
  if (turn === 3) return [new Map([[A0, PASS], [A1, PASS]]), new Map([[B0, sw(B0, b2)], [B1, PASS]])];
  if (turn === 4) return [new Map([[A0, sw(A0, a2)], [A1, PASS]]), new Map([[B0, PASS], [B1, PASS]])];
  return [new Map([[A0, PASS], [A1, PASS]]), new Map([[B0, PASS], [B1, PASS]])];
}

/* TEN, and the number is DERIVED rather than picked: the longest duration this artifact declares is
 * `extendsDuration.toTurns = 8`, and a difference between 5 and 8 is only visible on the turn the
 * shorter one expires and the longer one does not — which is turn 9 for a weather set on turn 2.
 * A shorter trace cannot see the tag WIRE 71 is about. */
const TURNS = 10;

const SLOT = { A0: 0, A1: 1, B0: 3, B1: 4 };
/* opts: { kind, id, placement, neutralize:bool, mask:bool } */
function stage(M, opts, arm) {
  const P = arm.pairing;
  const mons = [...P.A.map(s => bare(M, s)), ...P.B.map(s => bare(M, s))];
  if (opts.kind !== 'move' && opts.placement) {
    const target = mons[SLOT[opts.placement]];
    const field = opts.kind === 'ability' ? 'ability' : 'item';
    if (!opts.neutralize) target[field] = opts.id;
    if (opts.mask) target.__mask = { [field]: target[field] };
  }
  /* The move arms differ in the same trivial way: the control arm never clicks, so `_lastMove` alone
   * would make every move case look expressive. Masked for the inertness question only. */
  if (opts.kind === 'move' && opts.mask) mons[0].__mask = { _lastMove: MASK_ANY };
  const S = M.battleInit(mons.slice(0, 3), mons.slice(3), {});
  const rng = arm.rng.make();
  const trace = [];
  for (let t = 1; t <= TURNS; t++) {
    if (M.battleOver(S)) break;
    const [aActs, bActs] = (opts.kind === 'move')
      ? scriptMove(M, S, mons, t, opts.neutralize ? null : opts.id, P, opts.placement)
      : scriptAbilItem(M, S, mons, t, P);
    M.battleTurn(S, rng, aActs, bActs);
    trace.push(projState(S) + ' || ' + mons.map(projMon).join(' # '));
  }
  return trace.join('\n');
}

function digestsFor(M, opts) {
  const out = {};
  for (const a of ARMS) {
    /* NOT DISCARDED — the message becomes the digest. A staging failure has to be DISTINGUISHABLE
     * from a digest that merely differs, because a mutation that makes the engine throw is not the
     * same finding as one that changes its output; `threwAnywhere` below reads this back. */
    try { out[a.key] = stage(M, opts, a); }
    catch (e) { out[a.key] = 'THREW:' + String(e && e.message || e); }
  }
  return out;
}
const threwAnywhere = d => Object.values(d).some(v => String(v).startsWith('THREW'));
const threwEverywhere = d => Object.values(d).every(v => String(v).startsWith('THREW'));

/* ---- the operators -----------------------------------------------------------------------------
 * Two families, both read straight off the artifact so a tag added tomorrow gets the same treatment
 * without an edit here. */
function opRemoveTag(kind, id, tag) {
  return {
    key: `${kind}:${id}:${tag}:REMOVE-TAG`, family: 'remove-tag', kind, id, tag, param: null,
    apply(db) {
      const rec = db[TABLE[kind]][id];
      rec.tags = rec.tags.filter(t => t !== tag);
      if (rec.params) delete rec.params[tag];
    },
  };
}
const SENTINEL_STR = 'ZZ-MUTANT-ZZ';
function paramOps(kind, id, tag, params) {
  const ops = [];
  let nested = 0, nulls = 0;
  for (const k of Object.keys(params || {})) {
    const v = params[k];
    let values = null, shape = null;
    if (typeof v === 'boolean') { values = [!v]; shape = 'boolean'; }
    else if (typeof v === 'number') { values = [v * 3 + 7, v === 0 ? 1 : 0]; shape = 'number'; }
    else if (typeof v === 'string') { values = [SENTINEL_STR]; shape = 'string'; }
    /* A NULL PARAM IS NOT A FACT AND MUTATING IT IS NOT A MUTATION. `roughskin.setsWeather: null`
     * says Rough Skin does not set weather; writing a sentinel there asks the consumer to honour a
     * fact the artifact never asserted, and a consumer that sensibly refuses an unknown value is
     * indistinguishable from one that never looked. The first cut of this file scored 20-odd of
     * those as DEFECT-CANDIDATE. They are counted and skipped. */
    else if (v === null) { nulls++; continue; }
    else if (Array.isArray(v) && v.every(x => typeof x !== 'object')) { values = [[], [SENTINEL_STR]]; shape = 'array'; }
    else { nested++; continue; }
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      ops.push({
        key: `${kind}:${id}:${tag}.${k}:=${JSON.stringify(val)}`, family: 'param', kind, id, tag,
        param: k, paramShape: shape, paramWas: v, paramNow: val,
        apply(db) {
          const rec = db[TABLE[kind]][id];
          rec.params = rec.params || {}; rec.params[tag] = rec.params[tag] || {};
          rec.params[tag][k] = val;
        },
      });
    }
  }
  return { ops, nested, nulls };
}

/* ---- carriers ---------------------------------------------------------------------------------- */
function carriersOf(db, tag, perKind) {
  const out = [];
  for (const kind of ['move', 'item', 'ability']) {
    const T = db[TABLE[kind]];
    const rows = Object.keys(T).filter(id => (T[id].tags || []).includes(tag))
      .map(id => ({ kind, id, uses: T[id].uses || 0, params: (T[id].params || {})[tag] || {} }))
      .sort((a, b) => b.uses - a.uses);
    out.push(...rows.slice(0, perKind));
  }
  return out;
}
function placementsFor(kind) { return kind === 'move' ? ['@foe', '@ally'] : ['A0', 'A1', 'B0', 'B1']; }

/* ---- one tag, one engine source ---------------------------------------------------------------- */
function sweepTag(src, tag, opt) {
  const perKind = (opt && opt.perKind) || 2;
  const carriers = carriersOf(SHIPPED_DB, tag, perKind);
  const row = { tag, carriers: carriers.map(c => `${c.kind}:${c.id}`), cases: [], operators: [], nestedParamsSkipped: 0, nullParamsSkipped: 0 };
  if (!carriers.length) { row.verdict = 'NO-CARRIER'; row.why = 'no move, item or ability in data/tags.json carries this tag — nothing to mutate'; return row; }

  /* THE REFERENCE PASS. A fresh engine over the SHIPPED artifact, compiled while the shipped artifact
   * is installed, so its lazily-memoised tables (terrainPerTurnHP, priorityBlockAbilities) can never
   * be built under a mutated DB and poison the baseline. */
  TAGS.__setDB(null);
  /* ASKED IS COUNTED IN TWO PLACES AND THE FIRST ONE USED TO BE THROWN AWAY. `resetHits()` sat
   * immediately after `loadEngine`, so every MODULE-LOAD read — `TAGS.withTag`, which is how SPREAD,
   * HITS_ALLY and the priority-block map are built — was wiped before it could be recorded, and the
   * artifact printed `asked=0` for tags the engine reads on every single load. `asked=0` is tags.js's
   * own documented DECISIVE signal ("a tag absent from this is one no line of engine code looks
   * for"), so publishing a false zero there would have handed over a defect list whose headline class
   * was an artefact of where this line sat. */
  TAGS.resetHits();
  const refM = loadEngine(src);
  row.askedAtLoad = (TAGS.asked()[tag] || 0);
  row.foundAtLoad = (TAGS.hits()[tag] || 0);
  TAGS.resetHits();
  const cases = [];
  for (const c of carriers) {
    for (const pl of placementsFor(c.kind)) {
      const opts = { kind: c.kind, id: c.id, placement: pl, neutralize: false };
      /* UNMASKED, for the mutation comparison — both of its arms stage the carrier identically, so
       * nothing needs hiding and nothing is hidden. */
      const base = digestsFor(refM, opts);
      /* MASKED, for the equivalent-mutant question only. */
      const expr = digestsFor(refM, { ...opts, mask: true });
      const ctl = digestsFor(refM, { ...opts, neutralize: true, mask: true });
      const differing = ARMS.filter(a => expr[a.key] !== ctl[a.key]).map(a => a.key);
      const threw = ARMS.filter(a => String(base[a.key]).startsWith('THREW')).map(a => a.key);
      /* A CASE THE HARNESS COULD NOT STAGE AT ALL IS NOT AN INERT CASE. Both arms read the same
       * exception text, they compare equal, and without this the whole tag reports UNSTAGEABLE with
       * no hint that the harness — rather than the engine — is what failed. It is how a broken
       * refactor of this file scored every tag DEAD and looked plausible. */
      const allThrew = threwEverywhere(base);
      cases.push({ carrier: `${c.kind}:${c.id}`, placement: pl, base, inert: differing.length === 0 && !allThrew, allThrew, expressedUnder: differing, threw });
      row.cases.push({ carrier: `${c.kind}:${c.id}`, placement: pl, uses: c.uses, inert: differing.length === 0 && !allThrew, ...(allThrew ? { allThrew: true, threwWith: String(base[ARMS[0].key]).slice(0, 160) } : {}), expressedUnder: differing, threw });
    }
  }
  row.asked = (TAGS.asked()[tag] || 0);
  row.found = (TAGS.hits()[tag] || 0);
  if (cases.some(c => c.allThrew)) {
    row.verdict = 'THREW';
    row.why = 'the harness could not stage this tag — ' + String(cases.find(c => c.allThrew).base[ARMS[0].key]).slice(0, 200);
    return row;
  }
  const liveCases = cases.filter(c => !c.inert);
  if (!liveCases.length) {
    row.verdict = 'UNSTAGEABLE';
    row.why = 'the REFERENCE engine behaves identically with and without every carrier of this tag in '
      + 'this battery, so no mutation of it could prove anything. asked=' + row.asked + ' (+' + row.askedAtLoad
      + ' at module load), found=' + row.found
      + ((row.asked + row.askedAtLoad) === 0 ? ' — asked=0 everywhere means no line of engine code looks this tag up at all' : '');
    return row;
  }

  /* THE OPERATORS. One mutant engine per operator, compiled AFTER the mutated DB is installed. */
  const ops = [];
  for (const c of carriers) {
    /* AN OPERATOR IS ONLY EMITTED FOR A CARRIER THAT HAS A NON-INERT CASE. A mutation of a carrier no
     * scenario here can stage tells you nothing at all, and reporting it as READ-AND-IGNORED beside
     * real findings is how a report gets ignored. */
    if (!liveCases.some(x => x.carrier === `${c.kind}:${c.id}`)) {
      row.cases.filter(x => x.carrier === `${c.kind}:${c.id}`).forEach(x => { x.unstageable = true; });
      continue;
    }
    ops.push({ op: opRemoveTag(c.kind, c.id, tag), carrier: c });
    const { ops: pops, nested, nulls } = paramOps(c.kind, c.id, tag, c.params);
    row.nestedParamsSkipped += nested;
    row.nullParamsSkipped += nulls;
    for (const p of pops) ops.push({ op: p, carrier: c });
  }

  for (const { op, carrier } of ops) {
    const cname = `${carrier.kind}:${carrier.id}`;
    const db = clone(SHIPPED_DB);
    op.apply(db);
    TAGS.__setDB(db);
    const mutM = loadEngine(src);
    const changedUnder = [], sameUnder = [];
    let threwUnderMutation = false;
    for (const c of liveCases) {
      if (c.carrier !== cname) continue;
      const mut = digestsFor(mutM, { kind: op.kind, id: op.id, placement: c.placement, neutralize: false });
      if (threwAnywhere(mut) && !threwAnywhere(c.base)) threwUnderMutation = true;
      for (const a of ARMS) {
        const where = `${c.carrier}@${c.placement}/${a.key}`;
        if (mut[a.key] !== c.base[a.key]) changedUnder.push({ where, stream: a.stream });
        else sameUnder.push(where);
      }
    }
    TAGS.__setDB(null);
    const verdict = changedUnder.length === 0 ? 'READ-AND-IGNORED' : 'LIVE';
    const streamOnly = changedUnder.length > 0 && changedUnder.every(x => x.stream);
    row.operators.push({
      key: op.key, family: op.family, kind: op.kind, id: op.id, carrier: cname, uses: carrier.uses,
      param: op.param, paramShape: op.paramShape,
      paramWas: op.paramWas === undefined ? undefined : op.paramWas, paramNow: op.paramNow,
      verdict, changed: changedUnder.length, same: sameUnder.length,
      ...(threwUnderMutation ? { threw: true } : {}),
      ...(streamOnly ? { note: 'stream-shift-suspect — every difference came from a STREAMING rng, so a realigned PRNG cannot be ruled out', streamShiftWhere: changedUnder.map(x => x.where) } : {}),
    });
  }
  TAGS.__setDB(null);

  row.verdict = row.operators.some(o => o.family === 'remove-tag' && o.verdict === 'LIVE') ? 'LIVE'
    : row.operators.some(o => o.family === 'remove-tag' && o.verdict === 'READ-AND-IGNORED') ? 'READ-AND-IGNORED'
      : 'UNSTAGEABLE';
  return row;
}

/* ---- TRIAGE: which READ-AND-IGNORED results are DEFECTS ----------------------------------------
 *
 * Will, 2026-08-05: a read-and-ignored handler on a 2,888-use move is a live bug; one on a 0-use move
 * is bookkeeping. The rules below are the ONLY way an operator gets downgraded out of the defect
 * list, they are applied in this order, and each one prints what it matched. Anything none of them
 * decides stays a CANDIDATE, because "I could not decide" and "it does not matter" are different
 * answers and collapsing them is how a report gets ignored.
 *
 *  1  BANNED-BY-FORMAT      the carrier is isNonstandard != null in gen9championsvgc2026regmb. Asked
 *                           of the FORMAT, never of a remembered ban list (CLAUDE.md: the ban is a
 *                           MECHANISM). A payload nobody can bring to a game is not a live bug.
 *  2  NO-LEGAL-CARRIER      an ability no LEGAL SPECIES in the format has. The ability itself is
 *                           standard, so rule 1 misses it — Comatose is `isNonstandard: null` and its
 *                           only body is Komala, which is 'Past'. ENGINE.md already declares Comatose
 *                           dead for exactly this reason; this derives it instead of remembering it.
 *  3  ZERO-USE-IN-CORPUS    the carrier has uses == 0 across every sheet ABRA has ingested. A corpus
 *                           fact, not a format fact, so it is a separate and weaker class.
 *  4  PRESENCE-ONLY         a BOOLEAN param on a tag whose removal is LIVE. Membership already
 *                           carries the same bit — `spreadAll.hitsAlly` is exactly that shape. That is
 *                           redundant, not broken.
 *  5  RESTATES-THE-TAG      a STRING param whose value is IDENTICAL on every carrier of the tag
 *                           (>= 2 carriers), on a tag whose removal is LIVE. `spreadFoes.target` is
 *                           'allAdjacentFoes' on all 47 carriers: the tag IS the selector.
 *                           DELIBERATELY NOT EXTENDED TO NUMBERS. `extendsDuration.toTurns` is 8 on
 *                           every carrier, and a handler writing a literal 8 would be downgraded by a
 *                           number-shaped version of this rule — which is WIRE 71, the defect this
 *                           whole file was built to catch, being triaged away by its own instrument.
 *
 * A tag-level READ-AND-IGNORED is NOT downgraded by rules 4 or 5 and gets its own class,
 * TAG-NOT-CONSUMED, because it says the engine does not read the tag AT ALL for that carrier. The
 * previous cut of this file gave those no class, so they were absent from `defectCandidates` — the
 * biggest findings in the sweep were the ones the count did not include. */
function buildFormatOracle() {
  const p = process.env.SHOWDOWN_PATH;
  if (!p) {
    /* LOUD. A silent default here would silently stop downgrading anything, which happens to be the
     * SAFE direction, and that is exactly why it must still be said: a reader comparing two runs
     * would see the defect count jump and have no way to know the oracle was missing. */
    console.log('  !! SHOWDOWN_PATH is not set — the FORMAT could not be consulted, so no operator is');
    console.log('     downgraded as BANNED-BY-FORMAT or NO-LEGAL-CARRIER. Those stay CANDIDATES.');
    return { consulted: false, banned: () => null, legalAbility: () => true };
  }
  /* THE FORMAT ID IS READ OUT OF THE RELEASE, NEVER TYPED. CLAUDE.md: the ban is a MECHANISM, not a
   * list, and `data/regulations.json` is one of the release's own frozen sources — so the format a
   * verdict was triaged under is part of the same snapshot as the engine it describes. There is no
   * literal fallback: a triage rule that quietly ran against the wrong regulation would downgrade
   * real defects, and that is the one direction this file must not fail in. */
  const REG = JSON.parse(REL.read('data/regulations.json'));
  const FORMAT = ((REG.regulations || {})[REG.active] || {}).showdownFormat;
  if (!FORMAT) throw new Error('the release\'s data/regulations.json names no showdownFormat for active regulation "'
    + REG.active + '" — refusing to guess one, because every BANNED-BY-FORMAT downgrade below depends on it');
  const { Dex } = require(p + '/dist/sim');
  const F = Dex.forFormat(FORMAT);
  const legalAbilities = new Set();
  for (const s of F.species.all()) {
    if (s.isNonstandard) continue;
    for (const k of Object.keys(s.abilities || {})) legalAbilities.add(F.toID(s.abilities[k]));
  }
  const GET = { move: id => F.moves.get(id), item: id => F.items.get(id), ability: id => F.abilities.get(id) };
  return {
    consulted: true, format: FORMAT, legalAbilityCount: legalAbilities.size,
    banned(kind, id) { const e = GET[kind](id); return (e && e.exists) ? (e.isNonstandard || null) : 'NOT-IN-DEX'; },
    legalAbility(id) { return legalAbilities.has(id); },
  };
}

/* ---- WHICH TAGS THE ENGINE SOURCE ACTUALLY LOOKS UP -------------------------------------------
 *
 * THIS EXISTS BECAUSE THE OBVIOUS SIGNAL WAS WRONG AND ALMOST SHIPPED. `engine/tags.js`'s own header
 * calls ASKED = 0 "decisive — a tag absent from this is one no line of engine code looks for", and a
 * first cut of this triage took it at its word and published a class called NO-CONSUMER-ANYWHERE.
 * The receipt that it is false: **`survivesFromFull` came back asked = 0**, and its consumer is
 * `medicham2-browser.js:3508`, WIRE 12, Focus Sash — 13,125 uses, the fifth row of the ranked defect
 * list. It reads zero because the branch it lives in only runs when a LETHAL hit lands on a FULL-HP
 * body, and no scripted turn in this battery does that. tags.js's sentence is true of a battery of
 * real games; it is not true of a ten-turn script, and the difference is the whole class.
 *
 * So the decision is taken from the SOURCE, which cannot be unreached: collect every tag name that
 * appears as a literal inside a `TAGS.param / has / withTag / reactorsTo` call. Then
 *
 *   asked = 0, tag IS in this set   -> UNREACHED-BY-THIS-BATTERY. A consumer exists and no scripted
 *                                      turn reached it. That is the ABSENCE of a result, exactly like
 *                                      UNSTAGEABLE, and it is NEVER counted as a defect.
 *   asked = 0, tag is NOT in it     -> NO-CONSUMER-IN-SOURCE. Decisive: no line of the simulator
 *                                      mentions this tag. The Taunt shape.
 *
 * SCOPE, STATED SO THE VERDICT IS NOT OVER-READ: this greps `engine/medicham2-browser.js` ONLY.
 * `engine/board.js` and `engine/position_features.js` read tags too, so NO-CONSUMER-IN-SOURCE means
 * "the SIMULATOR does not read this tag", never "nothing in ABRA does".
 *
 * The three KIND arguments ('move', 'item', 'ability') are excluded because they sit in the same
 * argument list and are not tags. The membership is PRINTED on every run rather than trusted. */
function sourceConsumers(src) {
  const KINDS = new Set(['move', 'item', 'ability']);
  const set = new Set();
  const re = /TAGS\.(?:param|has|withTag|reactorsTo)\(([^;]{0,220}?)\)/g;
  let m;
  while ((m = re.exec(src))) {
    for (const s of (m[1].match(/['"`][A-Za-z][A-Za-z0-9_]*['"`]/g) || [])) {
      const v = s.slice(1, -1);
      if (!KINDS.has(v)) set.add(v);
    }
  }
  return set;
}

/* Which (tag, param) pairs restate the tag: identical STRING value on every carrier. Computed over
 * the WHOLE artifact, not over the two carriers this sweep sampled, so a tag whose 47th carrier
 * disagrees is not downgraded on the strength of the two most-used ones. */
function restatementIndex(db) {
  const seen = new Map();   // tag -> param -> {values:Set, n}
  for (const kind of ['moves', 'items', 'abilities']) {
    for (const id of Object.keys(db[kind])) {
      const rec = db[kind][id];
      for (const tag of (rec.tags || [])) {
        const ps = (rec.params || {})[tag] || {};
        for (const k of Object.keys(ps)) {
          if (typeof ps[k] !== 'string') continue;
          if (!seen.has(tag)) seen.set(tag, new Map());
          const m = seen.get(tag);
          if (!m.has(k)) m.set(k, { values: new Set(), n: 0 });
          m.get(k).values.add(ps[k]); m.get(k).n++;
        }
      }
    }
  }
  const out = new Map();
  for (const [tag, m] of seen) for (const [k, v] of m) {
    if (v.n >= 2 && v.values.size === 1) out.set(tag + '.' + k, { value: [...v.values][0], carriers: v.n });
  }
  return out;
}

function triage(rows, oracle, restates, consumers) {
  const matched = { BANNED_BY_FORMAT: [], NO_LEGAL_CARRIER: [], ZERO_USE: [], PRESENCE_ONLY: [], RESTATES: [], NO_CONSUMER: [], UNREACHED: [] };
  for (const row of rows) {
    const tagLevelLive = (row.operators || []).some(o => o.family === 'remove-tag' && o.verdict === 'LIVE');
    const askedTotal = (row.asked || 0) + (row.askedAtLoad || 0);
    for (const o of (row.operators || [])) {
      if (o.verdict !== 'READ-AND-IGNORED') continue;
      const ban = oracle.banned(o.kind, o.id);
      if (ban) { o.class = 'BANNED-BY-FORMAT'; o.classWhy = `${o.kind} ${o.id} is isNonstandard:${ban} in the format`; matched.BANNED_BY_FORMAT.push(o.key); continue; }
      if (o.kind === 'ability' && oracle.consulted && !oracle.legalAbility(o.id)) {
        o.class = 'NO-LEGAL-CARRIER'; o.classWhy = `no species with isNonstandard:null in the format has ${o.id}`;
        matched.NO_LEGAL_CARRIER.push(o.key); continue;
      }
      if (!o.uses) { o.class = 'ZERO-USE-IN-CORPUS'; o.classWhy = `${o.kind} ${o.id} has 0 uses in the ingested sheets`; matched.ZERO_USE.push(o.key); continue; }
      /* NOTHING ASKED FOR THIS TAG DURING THE WHOLE REFERENCE PASS. Two causes, told apart from the
       * SOURCE rather than from the counter — see sourceConsumers() for the receipt that the counter
       * alone gets this wrong on a 13,125-use item. */
      if (askedTotal === 0) {
        if (consumers.has(row.tag)) {
          o.class = 'UNREACHED-BY-THIS-BATTERY';
          o.classWhy = 'the simulator DOES look this tag up, and no scripted turn reached the branch that does. '
            + 'This is the absence of a result, not a defect — it is this battery\'s coverage gap.';
          matched.UNREACHED.push(o.key);
        } else {
          o.class = 'NO-CONSUMER-IN-SOURCE';
          o.classWhy = 'no TAGS.param/has/withTag/reactorsTo call in engine/medicham2-browser.js names this tag';
          matched.NO_CONSUMER.push(o.key);
        }
        continue;
      }
      /* A CONSUMER RAN, AND REMOVING THE TAG FROM THIS CARRIER STILL CHANGED NOTHING. The carrier is
       * reached another way (a name list, MC.moves, MOVE_EFFECTS) or the consumer is gated off. Open,
       * because a fact with two sources is CLAUDE.md's FACTS ARE GLOBAL at risk — but it is not the
       * same finding as "the simulator has never heard of this tag" and must not be ranked as one. */
      if (o.family === 'remove-tag') {
        o.class = 'TAG-NOT-CONSUMED';
        o.classWhy = 'a consumer asked for this tag ' + askedTotal + ' times, but removing it from this carrier changed nothing';
        continue;
      }
      if (o.paramShape === 'boolean' && tagLevelLive) { o.class = 'PRESENCE-ONLY'; o.classWhy = 'a boolean on a tag whose membership already carries the same bit'; matched.PRESENCE_ONLY.push(o.key); continue; }
      const r = restates.get(row.tag + '.' + o.param);
      if (o.paramShape === 'string' && tagLevelLive && r) {
        o.class = 'RESTATES-THE-TAG'; o.classWhy = `${row.tag}.${o.param} is "${r.value}" on all ${r.carriers} carriers — the tag IS the selector`;
        matched.RESTATES.push(o.key); continue;
      }
      o.class = 'DEFECT-CANDIDATE';
    }
  }
  return matched;
}

/* ---- THE PLANTED STUBS ------------------------------------------------------------------------- */
/* Each is a textual patch of the engine source applied IN MEMORY. Nothing is written to disk. Each
 * one asserts it matched — a patch that silently failed to apply would make a broken engine look
 * fixed, which is this project's signature failure arriving through the check meant to catch it. */
function plant(src, from, to, label) {
  if (from instanceof RegExp) {
    if (!from.test(src)) throw new Error('PLANT FAILED — the source no longer contains the site for "' + label + '". Fix the patch, do not skip it.');
    return src.replace(from, to);
  }
  if (src.indexOf(from) < 0) throw new Error('PLANT FAILED — the source no longer contains the site for "' + label + '". Fix the patch, do not skip it.');
  return src.split(from).join(to);
}
const STUBS = [
  {
    name: 'param-level stub (the WIRE 71 shape)',
    tag: 'speedMult',
    /* Reads the tag, then writes a literal. `asked()` counts it, the census sees Choice Scarf working,
     * and the artifact's own number is never consulted. */
    op: /^item:choicescarf:speedMult\.mult:/,
    make: src => plant(src,
      "{const _sm=TAGS.param('item',m.item,'speedMult');if(_sm&&_sm.mult)s*=+_sm.mult;}",
      "{const _sm=TAGS.param('item',m.item,'speedMult');if(_sm&&_sm.mult)s*=1.5;}",
      'speedMult literal'),
    mustBe: 'READ-AND-IGNORED',
  },
  {
    name: 'set-building stub (proves the mutated DB reaches a MODULE-LOAD derivation)',
    tag: 'spreadFoes',
    op: /^move:rockslide:spreadFoes:REMOVE-TAG$/,
    make: src => plant(src,
      /const SPREAD = \(TAGS\.off[\s\S]{0,200}?HITS_ALLY\]\);/,
      "const SPREAD = SPREAD_LEGACY;",
      'SPREAD derived set'),
    mustBe: 'READ-AND-IGNORED',
  },
];

function runGate() {
  console.log('\n  THE GATE — the harness must catch a PLANTED STUB before any green from it is believed.\n');
  let failures = 0;
  const rows = [];
  for (const st of STUBS) {
    const shipped = sweepTag(SHIPPED_SRC, st.tag, { perKind: 1 });
    const stubSrc = st.make(SHIPPED_SRC);
    const stubbed = sweepTag(stubSrc, st.tag, { perKind: 1 });
    const findOp = r => r.operators.find(o => st.op.test(o.key));
    const a = findOp(shipped), b = findOp(stubbed);
    const okShipped = a && a.verdict === 'LIVE';
    const okStub = b && b.verdict === st.mustBe;
    const ok = okShipped && okStub;
    if (!ok) failures++;
    rows.push({ stub: st.name, operator: (a && a.key) || (b && b.key) || '(operator not emitted)', shipped: a ? a.verdict : 'MISSING', stubbed: b ? b.verdict : 'MISSING', expectedStub: st.mustBe, caught: ok });
    console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} ${st.name}`);
    console.log(`           operator  ${(a && a.key) || (b && b.key) || '(none emitted)'}`);
    console.log(`           shipped engine -> ${a ? a.verdict : 'MISSING'}   (must be LIVE)`);
    console.log(`           stubbed engine -> ${b ? b.verdict : 'MISSING'}   (must be ${st.mustBe})`);
  }
  return { failures, rows };
}

/* ---- the sweep list ----------------------------------------------------------------------------
 * EVERY TAG IN THE ARTIFACT, derived. The previous cut swept a hand-picked dozen with the comment
 * "a working harness over a chosen dozen beats a half-working one over everything" — true while the
 * harness was being built, and it stopped being true the moment it worked: 64 of 93 operators over
 * those twelve tags fired and ignored their payload. A dozen is a sample, and a sample of a defect
 * class this size is an argument for measuring the rest of it.
 *
 * Tags declared in db.tags with no carrier at all are INCLUDED so they report NO-CARRIER rather than
 * vanishing. A tag missing from the list is indistinguishable from a tag that passed. */
function allTags(db) {
  const s = new Set();
  for (const kind of ['moves', 'items', 'abilities']) {
    for (const id of Object.keys(db[kind])) for (const t of (db[kind][id].tags || [])) s.add(t);
  }
  for (const r of (db.tags || [])) if (r && r.tag) s.add(r.tag);
  return [...s].sort();
}

/* ---- the ranked defect list --------------------------------------------------------------------
 * RANKED BY USAGE, NOT BY COUNT, and the denominator is PER KIND. A move's `uses` is a click count
 * and an ability's is a sheet count; adding them and calling the result a share would be the Blaze
 * error (docs/ENGINE.md: 4,585 uses on an ability that never fires) with an extra step. */
function rankDefects(allOps, db) {
  const denom = {};
  for (const kind of ['move', 'item', 'ability']) {
    denom[kind] = Object.values(db[TABLE[kind]]).reduce((s, r) => s + (r.uses || 0), 0);
  }
  const OPEN = new Set(['DEFECT-CANDIDATE', 'TAG-NOT-CONSUMED', 'NO-CONSUMER-IN-SOURCE']);
  const defects = allOps.filter(o => OPEN.has(o.class));
  /* One ROW per carrier x tag, because twelve ignored params on one ability is one thing to go and
   * look at, not twelve. The count of ignored operators rides along as `ops`. */
  const byCarrier = new Map();
  for (const o of defects) {
    const k = o.carrier + ' / ' + o.tag;
    if (!byCarrier.has(k)) byCarrier.set(k, { carrier: o.carrier, kind: o.kind, id: o.id, tag: o.tag, uses: o.uses, ops: 0, grade: 'params-ignored', params: [] });
    const r = byCarrier.get(k);
    r.ops++;
    if (o.class === 'NO-CONSUMER-IN-SOURCE') r.grade = 'NO-CONSUMER-IN-SOURCE';
    else if (o.class === 'TAG-NOT-CONSUMED' && r.grade !== 'NO-CONSUMER-IN-SOURCE') r.grade = 'TAG-NOT-CONSUMED';
    else r.params.push(o.param);
  }
  /* SORTED BY GRADE FIRST, THEN USAGE. "The simulator has never heard of this tag" and "one param of
   * a working handler is ignored" are different jobs, and interleaving them by usage alone would put
   * a param nobody reads above a mechanic that does not exist. */
  const GRADE = { 'NO-CONSUMER-IN-SOURCE': 0, 'TAG-NOT-CONSUMED': 1, 'params-ignored': 2 };
  const rows = [...byCarrier.values()].sort((a, b) => GRADE[a.grade] - GRADE[b.grade] || b.uses - a.uses || a.carrier.localeCompare(b.carrier));
  /* Cumulative share is computed WITHIN a kind and over the DISTINCT carriers already listed, so a
   * carrier appearing under three tags is not counted three times against the denominator. It is
   * cumulative DOWN THIS LIST, which is the fix order, not down a usage ranking. */
  const seen = { move: new Set(), item: new Set(), ability: new Set() };
  const cum = { move: 0, item: 0, ability: 0 };
  for (const r of rows) {
    if (!seen[r.kind].has(r.id)) { seen[r.kind].add(r.id); cum[r.kind] += r.uses; }
    r.shareOfKind = denom[r.kind] ? r.uses / denom[r.kind] : 0;
    r.cumShareOfKind = denom[r.kind] ? cum[r.kind] / denom[r.kind] : 0;
  }
  return { denom, rows };
}

/* ---- --explain: WHY did this one operator get the verdict it got ------------------------------
 *
 * `stream-shift-suspect` says "every difference came from a STREAMING rng, so a realigned PRNG cannot
 * be ruled out". That is an honest hedge and it is not an explanation, and an unexplained hedge in an
 * artifact is exactly the kind of thing that gets quoted later as if it were a finding. This replays
 * one operator and prints the FIRST TURN at which the two traces diverge, per arm, so the difference
 * can be read rather than guessed at.
 *
 *   node tests/mutation_harness.js --explain=poisontouch:poisonsOnMyContact.needsContact
 */
function explain(needle) {
  const hits = [];
  for (const tag of allTags(SHIPPED_DB)) {
    for (const c of carriersOf(SHIPPED_DB, tag, 2)) {
      const cand = [opRemoveTag(c.kind, c.id, tag), ...paramOps(c.kind, c.id, tag, c.params).ops];
      for (const op of cand) if (op.key.includes(needle)) hits.push({ tag, c, op });
    }
  }
  if (!hits.length) { console.log('  no operator key contains "' + needle + '"'); return; }
  for (const { tag, c, op } of hits) {
    console.log('\n  ' + op.key);
    TAGS.__setDB(null);
    const refM = loadEngine(SHIPPED_SRC);
    const db = clone(SHIPPED_DB); op.apply(db);
    TAGS.__setDB(db);
    const mutM = loadEngine(SHIPPED_SRC);
    for (const pl of placementsFor(c.kind)) {
      for (const a of ARMS) {
        const opts = { kind: c.kind, id: c.id, placement: pl, neutralize: false };
        let base, mut;
        try { base = stage(refM, opts, a); } catch (e) { base = 'THREW:' + e.message; }
        try { mut = stage(mutM, opts, a); } catch (e) { mut = 'THREW:' + e.message; }
        if (base === mut) continue;
        const bl = base.split('\n'), ml = mut.split('\n');
        let i = 0; while (i < bl.length && i < ml.length && bl[i] === ml[i]) i++;
        console.log(`    ${pl}/${a.key}${a.stream ? ' (STREAMING)' : ' (CONSTANT)'} diverges at turn ${i + 1}`);
        /* The two projections are long; print only the fields that actually differ, so the reason is
         * legible instead of buried. */
        const bf = String(bl[i] || '(trace ended)').split(/[;|#]/), mf = String(ml[i] || '(trace ended)').split(/[;|#]/);
        for (let j = 0; j < Math.max(bf.length, mf.length); j++) {
          if (bf[j] !== mf[j]) console.log('        base ' + String(bf[j]).trim() + '\n        mut  ' + String(mf[j]).trim());
        }
      }
    }
    TAGS.__setDB(null);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const explainArg = (argv.find(a => a.startsWith('--explain=')) || '').slice(10);
  if (explainArg) { explain(explainArg); return; }
  const arg = k => { const a = argv.find(x => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : null; };
  const gateOnly = argv.includes('--gate-only');
  const noWrite = argv.includes('--no-write');
  const tagArg = arg('--tags');
  const perKind = +(arg('--per-kind') || 2);

  console.log('\n  ENGINE RELEASE ' + REL.id + '  (first frozen ' + REL.manifest.cut + ')');
  console.log('  every verdict below describes THOSE bytes, not the live tree.');

  const t0 = Date.now();
  const gate = runGate();
  if (gate.failures) {
    console.log('\n  THE GATE FAILED. The sweep is NOT run and no artifact is written.');
    console.log('  A harness that cannot catch a stub it planted itself cannot be trusted about one it did not.\n');
    process.exit(1);
  }
  const gateMs = Date.now() - t0;
  console.log(`\n  gate passed in ${(gateMs / 1000).toFixed(1)}s — both planted stubs caught.\n`);
  if (gateOnly) return;

  const tags = tagArg ? tagArg.split(',').map(s => s.trim()).filter(Boolean) : allTags(SHIPPED_DB);
  console.log(`  THE SWEEP — ${tags.length} tags, ${ARMS.length} arms per case (${PAIRINGS.length} pairings x ${RNGS.length} rngs), ${TURNS}-turn scripts.\n`);
  const t1 = Date.now();
  const rows = [];
  for (const tag of tags) {
    const r = sweepTag(SHIPPED_SRC, tag, { perKind });
    rows.push(r);
    const ops = r.operators || [];
    const ri = ops.filter(o => o.verdict === 'READ-AND-IGNORED');
    console.log(`  ${String(r.verdict).padEnd(17)} ${tag.padEnd(24)} ${String(ops.length).padStart(2)} operators, ` +
      `${ops.filter(o => o.verdict === 'LIVE').length} live, ${ri.length} read-and-ignored`
      + (r.verdict === 'UNSTAGEABLE' ? `   (asked=${r.asked}, found=${r.found})` : '')
      + (r.verdict === 'NO-CARRIER' ? '   (declared in db.tags, carried by nothing)' : ''));
  }
  const sweepMs = Date.now() - t1;

  /* ---- triage, then rank ----------------------------------------------------------------------- */
  const oracle = buildFormatOracle();
  const restates = restatementIndex(SHIPPED_DB);
  const consumers = sourceConsumers(SHIPPED_SRC);
  const matched = triage(rows, oracle, restates, consumers);
  const allTagNames = allTags(SHIPPED_DB);
  const noConsumerTags = allTagNames.filter(t => !consumers.has(t));
  const allOps = rows.flatMap(r => (r.operators || []).map(o => ({ ...o, tag: r.tag })));
  const ranked = rankDefects(allOps, SHIPPED_DB);

  /* PRINT WHAT EVERY DOWNGRADE MATCHED BEFORE ANY OF IT IS TRUSTED. LESSONS §4 — `refusesStatusMoves`
   * caught Telepathy and Wonder Guard, `speedOnItemLoss` caught Sticky Hold. Both were found by
   * printing the membership. */
  console.log('\n  TAG LOOKUPS FOUND IN engine/medicham2-browser.js: ' + consumers.size + ' distinct names; '
    + noConsumerTags.length + ' of ' + allTagNames.length + ' artifact tags are named by NO lookup at all.');
  console.log('  (printed, not trusted — this is a source grep of TAGS.param/has/withTag/reactorsTo)');
  console.log('    ' + noConsumerTags.join(' '));

  console.log('\n  TRIAGE — what each downgrade rule matched (printed, not trusted):');
  for (const [k, v] of Object.entries(matched)) {
    console.log(`    ${k.padEnd(20)} ${String(v.length).padStart(3)}  ${v.slice(0, 6).join('  ') || '(none)'}${v.length > 6 ? '  …' : ''}`);
  }

  const summary = {
    tagsInArtifact: allTags(SHIPPED_DB).length,
    tagsSwept: rows.length,
    operators: allOps.length,
    live: allOps.filter(o => o.verdict === 'LIVE').length,
    readAndIgnored: allOps.filter(o => o.verdict === 'READ-AND-IGNORED').length,
    defectCandidates: allOps.filter(o => o.class === 'DEFECT-CANDIDATE').length,
    noConsumerInSource: allOps.filter(o => o.class === 'NO-CONSUMER-IN-SOURCE').length,
    tagNotConsumed: allOps.filter(o => o.class === 'TAG-NOT-CONSUMED').length,
    unreachedByThisBattery: allOps.filter(o => o.class === 'UNREACHED-BY-THIS-BATTERY').length,
    tagsWithNoLookupInSimulator: noConsumerTags,
    presenceOnly: allOps.filter(o => o.class === 'PRESENCE-ONLY').length,
    restatesTheTag: allOps.filter(o => o.class === 'RESTATES-THE-TAG').length,
    bannedByFormat: allOps.filter(o => o.class === 'BANNED-BY-FORMAT').length,
    noLegalCarrier: allOps.filter(o => o.class === 'NO-LEGAL-CARRIER').length,
    zeroUseInCorpus: allOps.filter(o => o.class === 'ZERO-USE-IN-CORPUS').length,
    unstageableTags: rows.filter(r => r.verdict === 'UNSTAGEABLE').map(r => r.tag),
    noCarrierTags: rows.filter(r => r.verdict === 'NO-CARRIER').map(r => r.tag),
    threwTags: rows.filter(r => r.verdict === 'THREW').map(r => r.tag),
    streamShiftSuspect: allOps.filter(o => o.note).length,
    nestedParamsSkipped: rows.reduce((s, r) => s + (r.nestedParamsSkipped || 0), 0),
    nullParamsSkipped: rows.reduce((s, r) => s + (r.nullParamsSkipped || 0), 0),
    threwUnderMutation: allOps.filter(o => o.threw).length,
    inertCases: rows.reduce((s, r) => s + (r.cases || []).filter(c => c.inert).length, 0),
    liveCases: rows.reduce((s, r) => s + (r.cases || []).filter(c => !c.inert).length, 0),
  };
  summary.defectRows = ranked.rows.length;

  /* ---- the ratchet ------------------------------------------------------------------------------
   * TWO RATCHETS, and they answer different questions.
   *   per-operator  an operator that was LIVE may never come back anything else. That is the only
   *                 direction that means a handler stopped reading its fact.
   *   the CEILING   defectCandidates + tagNotConsumed may fall and may never rise. It is keyed on the
   *                 SWEEP SCOPE (which tags, how many carriers each), because a count over 177 tags
   *                 and a count over 12 are not comparable and silently ratcheting one against the
   *                 other would either wave through a regression or block every run forever. A new
   *                 scope records a new ceiling and SAYS SO. */
  const scope = require('crypto').createHash('sha256')
    .update(JSON.stringify({ tags, perKind, arms: ARMS.map(a => a.key), turns: TURNS })).digest('hex').slice(0, 12);
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const regressions = [];
  /* THE PER-OPERATOR RATCHET IS SCOPED TOO, AND IT WAS NOT, AND IT IMMEDIATELY LIED.
   * The first full sweep ran a 5-turn battery; the second runs a 10-turn one with a different action
   * script. Comparing an operator's verdict across those is comparing two different measurements, and
   * it duly reported `item:blackglasses:damageMultType.mult LIVE -> READ-AND-IGNORED` as a
   * regression in an engine that had not moved at all — the release id is identical in both runs.
   * A ratchet that fires on its own instrument changing is a ratchet that gets switched off. */
  const scopeMatches = !!(prev && prev.ratchet && prev.ratchet.scope === scope);
  if (prev && prev.operators && scopeMatches) {
    const was = new Map(prev.operators.map(o => [o.key, o.verdict]));
    for (const o of allOps) {
      const w = was.get(o.key);
      if (w === 'LIVE' && o.verdict !== 'LIVE') regressions.push({ key: o.key, was: w, now: o.verdict });
    }
  }
  const openDefects = summary.defectCandidates + summary.tagNotConsumed + summary.noConsumerInSource;
  const prevCeil = (prev && prev.ratchet && prev.ratchet.ceiling) || null;
  let ceiling, ceilingNote;
  if (prevCeil && prevCeil.scope === scope) {
    ceiling = { scope, value: Math.min(prevCeil.value, openDefects), setAt: openDefects < prevCeil.value ? new Date().toISOString() : prevCeil.setAt };
    ceilingNote = openDefects > prevCeil.value
      ? 'RATCHET BROKEN — open defects rose from ' + prevCeil.value + ' to ' + openDefects
      : 'ok — ' + openDefects + ' open against a ceiling of ' + prevCeil.value;
  } else {
    ceiling = { scope, value: openDefects, setAt: new Date().toISOString() };
    ceilingNote = 'NEW SCOPE — no comparable ceiling existed' + (prevCeil ? ' (previous scope ' + prevCeil.scope + ' at ' + prevCeil.value + ')' : '')
      + '. Recorded ' + openDefects + ' as the ceiling; it may fall and may never rise.';
  }
  const ceilingBroken = !!(prevCeil && prevCeil.scope === scope && openDefects > prevCeil.value);

  const artifact = Object.assign({
    generated: new Date().toISOString(),
    by: 'tests/mutation_harness.js',
    design: 'Layer 2 of docs/ENGINE-COVERAGE-PLAN.md. Change the FACT, watch the BEHAVIOUR. A handler that fires and ignores its payload reads LIVE everywhere else in this repo; here it reads READ-AND-IGNORED.',
  }, REL.stamp(), {
    gate: { rows: gate.rows, ms: gateMs, note: 'The sweep refuses to run unless both planted stubs are caught. A harness that has never caught a planted stub is not evidence.' },
    battery: {
      arms: ARMS.map(a => a.key), rngs: RNGS.map(r => ({ name: r.name, stream: r.stream })),
      turns: TURNS, pairings: PAIRINGS, perKind,
      placements: { move: placementsFor('move'), item: placementsFor('item'), ability: placementsFor('ability') },
    },
    triage: {
      rules: [
        'UNREACHED-BY-THIS-BATTERY — nothing asked for the tag during the whole reference pass AND the simulator source contains a TAGS lookup for it. A consumer exists and no scripted turn reached it. NEVER counted as a defect. tags.js says ASKED=0 is decisive; that is true of a battery of real games and FALSE of a ten-turn script — survivesFromFull (Focus Sash, 13,125 uses, wired at medicham2:3508) reads asked=0 here because no turn lands a lethal hit on a full-HP body.',
        'NO-CONSUMER-IN-SOURCE — nothing asked for the tag AND no TAGS.param/has/withTag/reactorsTo call in engine/medicham2-browser.js names it. Decisive, and scoped to the SIMULATOR: board.js and position_features.js read tags too.',
        'BANNED-BY-FORMAT — the carrier is isNonstandard != null in the active format, asked of the format rather than of a remembered ban list.',
        'NO-LEGAL-CARRIER — an ability that no species with isNonstandard:null in the format has (Comatose/Komala). Rule 1 cannot see this: the ability is standard, its only body is not.',
        'ZERO-USE-IN-CORPUS — the carrier has 0 uses across every ingested sheet. A corpus fact, not a format fact.',
        'PRESENCE-ONLY — a BOOLEAN param on a tag whose removal is LIVE; membership already carries the same bit.',
        'RESTATES-THE-TAG — a STRING param identical on every carrier of the tag (>=2 carriers), on a tag whose removal is LIVE. NOT extended to numbers: extendsDuration.toTurns is 8 on every carrier, and a number-shaped version of this rule would triage away WIRE 71, the defect this file exists to catch.',
        'TAG-NOT-CONSUMED — removing the tag from the carrier changed nothing. Never downgraded; counted as an open defect. The previous cut of this file gave these no class at all, so the largest findings in the sweep were absent from the defect count.',
        'anything none of these decides stays DEFECT-CANDIDATE. "I could not decide" and "it does not matter" are different answers.',
      ],
      formatOracle: { consulted: oracle.consulted, format: oracle.format || null, legalAbilityCount: oracle.legalAbilityCount || null },
      simulatorTagLookups: [...consumers].sort(),
      matched,
      restatementIndex: [...restates.entries()].map(([k, v]) => ({ key: k, value: v.value, carriers: v.carriers })),
    },
    cannotSee: [
      'a fact derived WRONG upstream — propagated faithfully, consumed faithfully, scores LIVE. Layer 4 (test-engine-diff, test-game-diff, the interaction matrix) owns it.',
      'a mechanic no scenario here stages — reported as UNSTAGEABLE, which is the ABSENCE of a result and is never folded into the pass.',
      'a param whose value is an object or an array of objects — counted as nestedParamsSkipped, never silently.',
      'whether a LIVE handler is RIGHT. LIVE means the payload moved the engine, not that it moved it correctly.',
      'a consumer whose BRANCH no scripted turn reaches — reported as UNREACHED-BY-THIS-BATTERY and never as a defect. That count IS this battery\'s coverage gap and the honest way to shrink it is to widen the script, not to reclassify it.',
      'anything outside engine/medicham2-browser.js. board.js and position_features.js consume tags and are not loaded here.',
    ],
    cost: { gate_ms: gateMs, sweep_ms: sweepMs, ms_per_tag: Math.round(sweepMs / Math.max(1, rows.length)), peak_rss_mb: Math.round(process.memoryUsage().rss / 1048576) },
    summary,
    ranked: { denominators: ranked.denom, rows: ranked.rows },
    ratchet: {
      rule: 'An operator that was LIVE may never come back anything else. Separately, the OPEN count '
        + '(NO-CONSUMER-IN-SOURCE + TAG-NOT-CONSUMED + DEFECT-CANDIDATE) may fall and may never rise. '
        + 'BOTH are scoped: a verdict measured under one battery is not comparable with one measured '
        + 'under another, and comparing them across scopes produced a false regression the first time '
        + 'the script changed.',
      scope, scopeComparedWithPrevious: scopeMatches, ceiling, ceilingNote, openDefects, broken: ceilingBroken,
      regressions,
    },
    tags: rows,
    operators: allOps.map(o => ({ key: o.key, tag: o.tag, kind: o.kind, id: o.id, uses: o.uses, family: o.family, verdict: o.verdict, class: o.class, classWhy: o.classWhy, changed: o.changed, same: o.same, note: o.note })),
  });

  console.log('\n  ' + summary.operators + ' operators over ' + summary.tagsSwept + ' tags: '
    + summary.live + ' LIVE, ' + summary.readAndIgnored + ' READ-AND-IGNORED');
  console.log('    of the ignored:  ' + summary.noConsumerInSource + ' NO-CONSUMER-IN-SOURCE, ' + summary.tagNotConsumed
    + ' TAG-NOT-CONSUMED, ' + summary.defectCandidates + ' DEFECT-CANDIDATE  ->  ' + openDefects + ' OPEN');
  console.log('    not a result:    ' + summary.unreachedByThisBattery + ' UNREACHED-BY-THIS-BATTERY (a consumer exists '
    + 'and no scripted turn reached it — this battery\'s gap, not the engine\'s)');
  console.log('    downgraded:      ' + summary.bannedByFormat + ' banned-by-format, ' + summary.noLegalCarrier
    + ' no-legal-carrier, ' + summary.zeroUseInCorpus + ' zero-use, ' + summary.presenceOnly + ' presence-only, '
    + summary.restatesTheTag + ' restates-the-tag');
  console.log('  ' + summary.liveCases + ' staged cases expressed the mechanic, ' + summary.inertCases
    + ' were INERT and scored nothing;  ' + summary.unstageableTags.length + ' tags UNSTAGEABLE, '
    + summary.noCarrierTags.length + ' NO-CARRIER, ' + summary.threwTags.length + ' THREW');
  console.log('  ' + summary.nestedParamsSkipped + ' nested params not perturbed, ' + summary.nullParamsSkipped
    + ' null params skipped, ' + summary.streamShiftSuspect + ' stream-shift-suspect');
  console.log('  cost: gate ' + (gateMs / 1000).toFixed(1) + 's, sweep ' + (sweepMs / 1000).toFixed(1)
    + 's (' + artifact.cost.ms_per_tag + ' ms/tag), peak rss ' + artifact.cost.peak_rss_mb + ' MB');

  console.log('\n  TOP 20 OPEN DEFECTS — graded first, then by usage. (Share is within the carrier KIND: a move');
  console.log('  click count and an ability sheet count are different denominators and adding them would be');
  console.log('  the Blaze error. `cum` is cumulative down THIS list, which is the fix order.)\n');
  console.log('     uses   share   cum    carrier / tag                                  grade');
  for (const r of ranked.rows.slice(0, 20)) {
    console.log('    ' + String(r.uses).padStart(6) + '  ' + (r.shareOfKind * 100).toFixed(2).padStart(5) + '%  '
      + (r.cumShareOfKind * 100).toFixed(1).padStart(5) + '%  ' + (r.carrier + ' / ' + r.tag).padEnd(46)
      + r.grade + (r.params.length ? '  params:' + r.params.join(',') : ''));
  }

  console.log('\n  ' + ceilingNote);
  if (regressions.length) {
    console.log('\n  RATCHET BROKEN — an operator that used to move the engine no longer does:');
    for (const r of regressions) console.log('    ' + r.key + '   ' + r.was + ' -> ' + r.now);
  }
  if (!noWrite) { fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2)); console.log('\n  wrote ' + path.relative(D('.'), OUT)); }
  console.log('');
  if (regressions.length || ceilingBroken) process.exit(1);
}

if (require.main === module) main();
module.exports = { sweepTag, loadEngine, runGate, allTags, SHIPPED_DB, SHIPPED_SRC, REL };
