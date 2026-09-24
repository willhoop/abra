/* medicham_api_diffhook.js -- a PRELOAD (`node -r`) that puts engine/medicham_api.js inside a live run of
 * engine/game_differential.js WITHOUT EDITING THE DIFFERENTIAL.
 *
 * Why a preload and not a flag in the differential: the differential digests its own code into every
 * artifact (`steering.driver_code`), and two runs whose driver code differs are refused as a before/after
 * pair. A hook compiled into the instrument would change that digest for every future run to answer a
 * question only this test asks. The preload is outside the instrument's require closure, so a run WITHOUT
 * it is the instrument exactly as committed, and a run WITH it says so (`MEDI_API_HOOK` is printed).
 *
 * WHAT IT DOES, chosen by the environment:
 *   MEDI_API_HOOK=inplace   every `M.battleTurn(S, rng, a, b)` the differential makes is routed through
 *                           `API.stepInPlace(S, a, b, rng)` -- T4, first leg.
 *   MEDI_API_HOOK=clone     the SHADOW STEP (see viaShadow): the real turn is played on S exactly as committed,
 *                           and the same turn is played on `API.clone(S)` by `API.stepInPlace` -- the body of
 *                           `API.step` -- on a replay of the real turn's dice; the two must agree on the digest,
 *                           the protocol and the dice consumed. Written to MEDI_API_HOOK_OUT at exit. T4, second leg.
 *   MEDI_API_HOOK=lean      (2026-09-24) a FULL copy and a LEAN copy (`newBattle({lean:true})`'s mode) of each battle
 *                           play the whole game beside the real one, on its turns' choices and a replay of its dice;
 *                           the lean board must equal the full board after every turn (see viaLean). Written to
 *                           MEDI_API_HOOK_OUT at exit. Driven by solver/tests/test-lean-mode.js.
 *   MEDI_API_LEGAL_PROBE=<file>   at every move request where both engines stand on the same turn, the
 *                           API's `legalActions(S, side)` is compared, slot by slot, with the legal set the
 *                           AUTHORITY derives from its own objects -- T3. Written to <file> at exit.
 *
 * The authority's legal set, per active slot (sim/side.ts chooseMove / chooseSwitch, sim/pokemon.ts
 * getMoves / getMoveRequestData, sim/battle.ts validTargetLoc):
 *   fainted or absent          -> pass
 *   a move entry with no `target` field on the request -> the one hard-locked action (Recharge, a charge
 *                                 release, a rampage): `getMoves(lockedMove)` omits the field
 *   otherwise every slot of `pokemon.getMoves()` that is not disabled (restrictData off, so a HIDDEN
 *   disable counts as disabled -- the truth, not the client's view), each at every location
 *   `battle.validTargetLoc` admits when `targetTypeChoices(target)`; Struggle when none is enabled;
 *   each with and without mega when the request says `canMegaEvo`;
 *   a switch to every unfainted bench body unless `pokemon.trapped` (true, OR 'hidden' -- the request
 *   shows the latter only as `maybeTrapped`, and it is counted apart).
 */
'use strict';
const Module = require('module');
const fs = require('fs');
const path = require('path');

const HOOK = process.env.MEDI_API_HOOK || '';
const PROBE = process.env.MEDI_API_LEGAL_PROBE || '';
const API_PATH = path.join(__dirname, '..', 'engine', 'medicham_api.js');
const BS = require(path.join(__dirname, '..', 'engine', 'board_state.js'));
const id = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let LAST_BATTLE = null, PATCHED_M = false, PATCHED_SD = false, API = null, ORIG = null;
const STAT = { hook: HOOK || null, probe: !!PROBE, turns_routed: 0, turns_clone: 0, shadow_agree: 0, shadow_disagree: 0, shadow_untraced: 0, shadow_disagreements: [],
               probe_turns: 0, probe_turn_mismatch: 0, slots: 0, slots_agree: 0, slots_disagree: 0,
               hidden_trapped: 0, maybe_trapped_free: 0, forced_slots: 0, mega_offered_slots: 0, switch_slots: 0,
               struggle_slots: 0, empty_target_options: 0, disagreements: [] };
console.error('medicham_api_diffhook: HOOK=' + (HOOK || '-') + ' PROBE=' + (PROBE || '-')
  + ' -- this run is NOT the plain instrument');

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const mod = origLoad.apply(this, arguments);
  try {
    if (!PATCHED_M && mod && typeof mod.battleTurn === 'function' && typeof mod.battleInit === 'function'
        && typeof mod.midEventDice === 'function') patchEngine(mod, Module._resolveFilename(request, parent, isMain));
  } catch (e) { console.error('medicham_api_diffhook: patch failed: ' + e.stack); process.exitCode = 3; throw e; }
  return mod;
};

/* Found in the module cache at the first turn, not at load: the sim's modules import each other circularly and
 * touching `Battle` while they load throws a TDZ error. By the first turn every one of them has finished. */
function findShowdown() {
  if (PATCHED_SD) return;
  for (const [f, m] of Object.entries(require.cache)) {
    if (!/[\\/]dist[\\/]sim[\\/]battle\.js$/.test(f)) continue;
    const B = m.exports && m.exports.Battle;
    if (typeof B === 'function' && B.prototype && typeof B.prototype.makeRequest === 'function') { STAT.showdown_file = f; patchShowdown(B); return; }
  }
}
function patchShowdown(Battle) {
  PATCHED_SD = true;
  const mr = Battle.prototype.makeRequest;
  Battle.prototype.makeRequest = function () { LAST_BATTLE = this; return mr.apply(this, arguments); };
}

function patchEngine(M, file) {
  PATCHED_M = true; STAT.engine_file = file;
  ORIG = M.battleTurn;
  const shadow = Object.assign({}, M, { battleTurn: ORIG });
  API = require(API_PATH).bind(shadow);
  M.battleTurn = function (S, rng, a, b) {
    findShowdown();
    if (PROBE) probe(M, S);
    if (!HOOK || M.battleOver(S)) return ORIG.call(this, S, rng, a, b);
    STAT.turns_routed++;
    if (HOOK === 'inplace') return API.stepInPlace(S, a, b, rng);
    if (HOOK === 'clone') return viaShadow(M, S, rng, a, b);
    if (HOOK === 'lean') return viaLean(M, S, rng, a, b);
    throw new Error('medicham_api_diffhook: unknown MEDI_API_HOOK=' + HOOK);
  };
}

/* ---- T4 second leg: the SHADOW STEP -------------------------------------------------------------------
 *
 * WHY NOT PLAY THE GAME ON THE COPY. The differential observes medicham2 WHILE a turn runs: its trace hook reads
 * `S.actA[slot]` the instant a `|switch|` line is written, to learn which body entered (ENTRY_LOG, the forced-switch
 * mirror). Played on a copy, that observer reads the untouched original and records the wrong body, so the game parts
 * for a reason that is the harness and not the clone. That was the first version of this hook; it parted 38 of 38.
 *
 * SO THE REAL TURN IS PLAYED ON S, EXACTLY AS COMMITTED, and the copy plays the SAME turn beside it:
 *   1. before the turn, T = API.clone(S) and the two action maps are translated onto T's bodies;
 *   2. the real turn runs on S with its dice RECORDED, draw by draw, per stream;
 *   3. T plays the turn through API.stepInPlace -- clone + stepInPlace is the whole body of API.step -- on a
 *      REPLAY of those draws, with its own trace sink; MEDSEEN/MEDFAILS are put back afterwards, so the counters
 *      in the artifact are the real turn's alone;
 *   4. PASS for the turn = API.digest(T) === API.digest(S), T wrote the same protocol lines the real turn wrote,
 *      and T consumed exactly the recorded draws, no more and no fewer.
 * If the copy lost or shared anything a turn reads, 4 fails on that turn. If the shadow disturbed anything the
 * NEXT real turn reads (a process global it left behind), the game parts from the plain arm and the sample
 * fingerprint says which game. Both are asserted by tests/test-medicham-api-differential.js. */
function correspond(a, b, map) {
  if (!a || typeof a !== 'object' || map.has(a)) return;
  map.set(a, b);
  if (a instanceof Map) { const ka = [...a], kb = [...b]; for (let i = 0; i < ka.length; i++) { correspond(ka[i][0], kb[i][0], map); correspond(ka[i][1], kb[i][1], map); } return; }
  if (a instanceof Set) { const ka = [...a], kb = [...b]; for (let i = 0; i < ka.length; i++) correspond(ka[i], kb[i], map); return; }
  for (const k of Object.keys(a)) if (k !== '_trace') correspond(a[k], b[k], map);
}
function recorder(r) {
  const logs = {};
  if (typeof r === 'function') { logs.fn = []; return { rec: (...x) => { const v = r(...x); logs.fn.push(v); return v; }, logs }; }
  const o = {};
  for (const k of Object.keys(r || {})) {
    if (typeof r[k] === 'function') { const g = r[k]; logs[k] = []; o[k] = (...x) => { const v = g(...x); logs[k].push(v); return v; }; }
    else o[k] = r[k];
  }
  return { rec: o, logs };
}
function replayer(shape, logs) {
  const at = {}; const out = { over: 0, left: () => Object.keys(logs).reduce((n, k) => n + logs[k].length - (at[k] || 0), 0), at: () => Object.assign({}, at) };
  const f = (k) => () => { const i = at[k] || 0; if (i >= logs[k].length) { out.over++; return 0.5; } at[k] = i + 1; return logs[k][i]; };
  if (typeof shape === 'function') { out.rng = f('fn'); return out; }
  const o = {};
  for (const k of Object.keys(shape || {})) o[k] = typeof shape[k] === 'function' ? f(k) : shape[k];
  out.rng = o; return out;
}
function snap(o) { const s = {}; for (const k of Object.keys(o)) s[k] = structuredClone(o[k]); return s; }
function restore(o, s) { for (const k of Object.keys(o)) if (!(k in s)) delete o[k]; for (const k of Object.keys(s)) o[k] = s[k]; }
function viaShadow(M, S, rng, a, b) {
  STAT.turns_clone++;
  const T = API.clone(S);
  const fwd = new Map(); correspond(S, T, fwd);
  const fwdDeep = (v, seen) => {
    if (!v || typeof v !== 'object') return v;
    if (fwd.has(v)) return fwd.get(v);
    seen = seen || new Map(); if (seen.has(v)) return seen.get(v);
    if (Array.isArray(v)) { const o = []; seen.set(v, o); for (const x of v) o.push(fwdDeep(x, seen)); return o; }
    if (v instanceof Map || v instanceof Set) throw new Error('diffhook: a Map/Set inside an action is not translated');
    const o = {}; seen.set(v, o); for (const k of Object.keys(v)) o[k] = fwdDeep(v[k], seen); return o;
  };
  const tmap = (m) => m instanceof Map ? new Map([...m].map(([k, v]) => [fwd.get(k) || k, fwdDeep(v)])) : m;
  const ta = tmap(a), tb = tmap(b);
  const R = recorder(rng);
  const mark = S._trace ? S._trace.length : 0;
  const out = ORIG(S, R.rec, a, b);                       // THE REAL TURN, untouched
  const sSeen = snap(M.MEDSEEN), sFail = snap(M.MEDFAILS);
  const P = replayer(rng, R.logs);
  /* A sink only when the real battle has one. Narration is not free of state: the engine's `_chipFrom` scratch is
   * consumed (reset to null) only on a traced turn, so a traced copy of an untraced battle differs by that key. */
  const tr = []; if (S._trace) T._trace = tr;
  let err = null;
  try { API.stepInPlace(T, ta, tb, P.rng); } catch (e) { err = e; }
  restore(M.MEDSEEN, sSeen); restore(M.MEDFAILS, sFail);
  const realLines = S._trace ? S._trace.slice(mark) : [];
  if (!S._trace) STAT.shadow_untraced++;
  const dS = API.digest(S), dT = err ? null : API.digest(T);
  const sameState = !err && dS === dT, sameLines = JSON.stringify(realLines) === JSON.stringify(tr);
  const sameDice = P.over === 0 && P.left() === 0;
  if (sameState && sameLines && sameDice) STAT.shadow_agree++;
  else {
    STAT.shadow_disagree++;
    if (STAT.shadow_disagreements.length < 200) {
      let where = null;
      if (!err && !sameState) {
        const x = API.digestString(S), y = API.digestString(T);
        let i = 0; while (i < x.length && x[i] === y[i]) i++;
        where = { at: i, real: x.slice(Math.max(0, i - 120), i + 80), copy: y.slice(Math.max(0, i - 120), i + 80) };
      }
      STAT.shadow_disagreements.push({ turn: S.turn, trace_len_before: mark, trace_len_after: S._trace ? S._trace.length : null,
        trace_is_array: Array.isArray(S._trace), trace_push_own: !!(S._trace && Object.prototype.hasOwnProperty.call(S._trace, 'push')),
        error: err ? String(err.stack).slice(0, 400) : null, sameState, sameLines, sameDice,
        dice_over: P.over, dice_left: P.left(), where,
        lines: sameLines ? null : { real: realLines.slice(0, 12), copy: tr.slice(0, 12) } });
    }
  }
  return out;
}

/* ---- LEAN: a whole LEAN GAME played beside the real one (solver/tests/test-lean-mode.js) -----------------------
 *
 * MEDI_API_HOOK=lean. At a battle's first routed turn two copies are taken with `API.clone` (which leaves the
 * differential's trace sink behind): F, a FULL battle, and L, the same copy made lean (`API.makeLean`). From then on
 * neither is re-synchronised while it agrees: every real turn is also played on F and on L, each with the real turn's
 * two action maps translated onto its own bodies and its own REPLAY of the real turn's dice, exactly as the shadow step
 * above does it. So F and L are two whole games on the same seeds and the same choices, one full and one lean.
 *
 * THE CLAIM IS L == F, after every turn: the whole battle graph through `API.digestString` (every body's HP, status,
 * boosts, item, ability, types, volatiles, PP, the field, the turn), less LEAN_EXEMPT, and the SAME DRAWS stream by
 * stream (each copy runs on its own replay of the real turn's recording).
 * F is compared with the real battle too (`full_track_*`), less TRACE_ONLY -- that says the full copy is playing the
 * real game and the comparison is not two copies agreeing somewhere off to the side. Both are untraced, so a field a
 * trace writes is not lean mode's business and is not excused in the L == F check.
 *
 * LEAN_EXEMPT, each with its reason. Nothing else is excused:
 *   _lean    the flag itself;
 *   _eeHP    the Emergency Exit "other door" witness, skipped by a lean turn; its only reader is a MEDFAILS counter at
 *            the top of the turn (engine/medicham2-browser.js battleTurnBody), so it cannot reach a board.
 * TRACE_ONLY (F vs the real, traced battle only): `_trace`; `_chipFrom` (a formeOnHit chip's `[from]` tag, reset only
 * under `if(TR)`); `_traceFainted` (the trace's own faint-line latch, read only by TRACE.faint).
 *
 * On a disagreement both copies are re-taken from the real battle, so one fault is counted once and the rest of the
 * game is still checked. They are also re-taken BEFORE a turn when the real battle's board moved since the last turn
 * ended -- the differential's planted-divergence proofs write into it between turns -- and that is counted
 * (`lean_retaken_edited`). Every routed turn is then compared, or named: a real turn that threw, or (never expected) one
 * whose actions could not be translated onto the copies. A lean turn touches no process counter (it writes to a discarded sink); the full copy's
 * counters are put back after each turn, so the artifact's counters are the real turn's alone. */
const LEAN_EXEMPT = new Set(['_lean', '_eeHP']);
const TRACE_ONLY = new Set(['_trace', '_chipFrom', '_traceFainted']);
const LEAN_PAIR = new WeakMap();
STAT.lean_turns = 0; STAT.lean_agree = 0; STAT.lean_disagree = 0; STAT.lean_battles = 0; STAT.lean_resynced = 0; STAT.lean_real_turn_threw = 0; STAT.lean_untranslated = 0; STAT.lean_retaken_edited = 0;
STAT.full_track_agree = 0; STAT.full_track_disagree = 0; STAT.lean_disagreements = []; STAT.full_track_disagreements = [];
STAT.lean_exempt = [...LEAN_EXEMPT]; STAT.trace_only = [...TRACE_ONLY];
function canonLess(S, drop) {
  /* the sink is blanked IN PLACE for the copy (as API.clone does), so it is neither copied nor reordered */
  const had = Object.prototype.hasOwnProperty.call(S, '_trace'), tr = S._trace;
  let T;
  if (had) S._trace = undefined;
  try { T = structuredClone(S); } finally { if (had) S._trace = tr; }
  const seen = new Set();
  (function strip(v) {
    if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v);
    if (v instanceof Map) { for (const [k, x] of v) { strip(k); strip(x); } return; }
    if (v instanceof Set) { for (const x of v) strip(x); return; }
    for (const k of Object.keys(v)) { if (drop.has(k)) delete v[k]; else strip(v[k]); }
  })(T);
  return API.digestString(T);
}
function firstDiff(x, y) { let i = 0; while (i < x.length && x[i] === y[i]) i++; return { at: i, a: x.slice(Math.max(0, i - 160), i + 80), b: y.slice(Math.max(0, i - 160), i + 80) }; }
function leanPair(S) { STAT.lean_battles++; return { F: API.clone(S), L: API.makeLean(API.clone(S)) }; }
function translate(S, T, a) {
  const fwd = new Map(); correspond(S, T, fwd);
  const fwdDeep = (v, seen) => {
    if (!v || typeof v !== 'object') return v;
    if (fwd.has(v)) return fwd.get(v);
    seen = seen || new Map(); if (seen.has(v)) return seen.get(v);
    if (Array.isArray(v)) { const o = []; seen.set(v, o); for (const x of v) o.push(fwdDeep(x, seen)); return o; }
    /* an action may carry its own Map or Set (the shadow step above refuses one; the lean pair translates it, entry by
     * entry, so no turn goes uncompared for want of it) */
    if (v instanceof Map) { const o = new Map(); seen.set(v, o); for (const [k, x] of v) o.set(fwdDeep(k, seen), fwdDeep(x, seen)); return o; }
    if (v instanceof Set) { const o = new Set(); seen.set(v, o); for (const x of v) o.add(fwdDeep(x, seen)); return o; }
    const o = {}; seen.set(v, o); for (const k of Object.keys(v)) o[k] = fwdDeep(v[k], seen); return o;
  };
  return a instanceof Map ? new Map([...a].map(([k, v]) => [fwd.get(k) || k, fwdDeep(v)])) : a;
}
function viaLean(M, S, rng, a, b) {
  STAT.lean_turns++;
  let pr = LEAN_PAIR.get(S);
  /* THE REAL BATTLE EDITED BETWEEN TURNS (the differential's planted-divergence proofs write HP, boosts, status,
   * volatiles and items straight into it) is no longer the battle the pair copied, so the pair is re-taken from it
   * before the turn. Seen by the real battle's own board moving since the end of the last compared turn. */
  const cS0 = pr ? canonLess(S, TRACE_ONLY) : null;
  if (pr && pr.lastS !== cS0) { STAT.lean_retaken_edited++; pr = null; }
  if (!pr) { pr = leanPair(S); LEAN_PAIR.set(S, pr); }
  let fa, fb, la, lb;
  try { fa = translate(S, pr.F, a); fb = translate(S, pr.F, b); la = translate(S, pr.L, a); lb = translate(S, pr.L, b); }
  catch (e) {   /* the harness could not map this turn's actions; the real turn is still played, untouched, and counted */
    STAT.lean_untranslated++; LEAN_PAIR.delete(S);
    STAT.lean_untranslated_why = STAT.lean_untranslated_why || {};
    const why = String(e && e.message || e).slice(0, 160); STAT.lean_untranslated_why[why] = (STAT.lean_untranslated_why[why] || 0) + 1;
    return ORIG(S, rng, a, b);
  }
  const R = recorder(rng);
  const mark = S._trace ? S._trace.length : 0;
  let out;
  /* a REAL turn that throws is the differential's to handle (its planted-divergence proofs can make one); nothing was
   * played to compare, so it is counted apart and the pair is re-taken at the next turn */
  try { out = ORIG(S, R.rec, a, b); }                     // THE REAL TURN, untouched
  catch (e) { STAT.lean_real_turn_threw++; LEAN_PAIR.delete(S); throw e; }
  const lines = S._trace ? S._trace.slice(mark) : null;
  const sSeen = snap(M.MEDSEEN), sFail = snap(M.MEDFAILS);
  const PF = replayer(rng, R.logs), PL = replayer(rng, R.logs);
  let errF = null, errL = null;
  try { API.stepInPlace(pr.F, fa, fb, PF.rng); } catch (e) { errF = e; }
  try { API.stepInPlace(pr.L, la, lb, PL.rng); } catch (e) { errL = e; }
  restore(M.MEDSEEN, sSeen); restore(M.MEDFAILS, sFail);
  const cF = errF ? null : canonLess(pr.F, LEAN_EXEMPT), cL = errL ? null : canonLess(pr.L, LEAN_EXEMPT);
  const diceF = PF.over === 0 && PF.left() === 0, diceL = PL.over === 0 && PL.left() === 0;
  /* THE LEAN CLAIM IS AGAINST THE FULL COPY: the same board AND the same draws, stream by stream (both ran on their own
   * replay of the same recording). Whether the FULL copy consumed exactly the real turn's draws is the tracking
   * question below, and a miss there is the harness (the real battle was edited between turns), not lean mode. */
  const sameDiceLF = PL.over === PF.over && JSON.stringify(PL.at()) === JSON.stringify(PF.at());
  const leanOk = !errF && !errL && cF === cL && sameDiceLF;
  const cS1 = canonLess(S, TRACE_ONLY);
  pr.lastS = cS1;
  const trackOk = !errF && diceF && cS1 === canonLess(pr.F, TRACE_ONLY);
  if (trackOk) STAT.full_track_agree++;
  else {
    STAT.full_track_disagree++;
    if (STAT.full_track_disagreements.length < 50) STAT.full_track_disagreements.push({ turn: S.turn, error: errF ? String(errF.stack).slice(0, 300) : null, diceF,
      where: errF ? null : firstDiff(canonLess(S, TRACE_ONLY), canonLess(pr.F, TRACE_ONLY)) });
  }
  if (leanOk) STAT.lean_agree++;
  else {
    STAT.lean_disagree++;
    if (STAT.lean_disagreements.length < 200) STAT.lean_disagreements.push({ turn: S.turn,
      error: (errL || errF) ? String((errL || errF).stack).slice(0, 400) : null, sameBoard: !!(cF && cL && cF === cL), sameDice: sameDiceLF, leanDiceExact: diceL, fullDiceExact: diceF,
      dice_over: PL.over, dice_left: PL.left(), dice_left_full: PF.left(), dice_by_stream: { lean: PL.at(), full: PF.at(), recorded: Object.fromEntries(Object.entries(R.logs).map(([k, v]) => [k, v.length])) },
      teams: [(S.sfA && S.sfA.team || []).map(m => m && (m._ident || m.name)), (S.sfB && S.sfB.team || []).map(m => m && (m._ident || m.name))],
      real_turn_lines: lines ? lines.slice(0, 60).map(l => Array.isArray(l) ? l.join('|') : String(l)) : null,
      where: (cF && cL && cF !== cL) ? firstDiff(cF, cL) : null });
  }
  if (!leanOk || !trackOk) { STAT.lean_resynced++; const np = leanPair(S); np.lastS = cS1; LEAN_PAIR.set(S, np); }
  return out;
}

/* ---- T3: legalActions against the authority ---------------------------------------------------------- */
function sdOptions(battle, side, i) {
  const p = side.active[i];
  const act = side.activeRequest && side.activeRequest.active && side.activeRequest.active[i];
  if (!p || p.fainted || !act) return ['pass'];
  if (p.volatiles && p.volatiles.commanding) return ['pass'];
  const out = [];
  if ((act.moves || []).some(m => !('target' in m))) { STAT.forced_slots++; return ['forced:' + id(act.moves[0].id)]; }
  /* HIDDEN DISABLES (Imprison) count as disabled -- `getMoves()` with restrictData off -- and are counted apart. */
  if ((p.moveSlots || []).some(ms => ms.disabled === 'hidden')) STAT.hidden_disabled = (STAT.hidden_disabled || 0) + 1;
  const valid = p.getMoves().filter(m => !m.disabled);
  const megas = act.canMegaEvo ? [false, true] : [false];
  if (act.canMegaEvo) STAT.mega_offered_slots++;
  if (!valid.length) { STAT.struggle_slots++; out.push('move:struggle'); }
  for (const m of valid) {
    const locs = battle.actions.targetTypeChoices(m.target) ? [1, 2, -1, -2].filter(l => battle.validTargetLoc(l, p, m.target)) : [null];
    for (const l of locs) for (const mg of megas) out.push('move:' + id(m.id) + (l == null ? '' : '@' + l) + (mg ? '+mega' : ''));
  }
  if (p.trapped) { if (p.trapped === 'hidden' || act.maybeTrapped) STAT.hidden_trapped++; }
  else {
    if (act.maybeTrapped) STAT.maybe_trapped_free++;
    for (const q of side.pokemon.slice(side.active.length)) if (q && !q.fainted) out.push('switch:' + BS.stableKey(q, id));
  }
  return out.sort();
}
function apiOptions(S, sd, slot) {
  const own = slot.options;
  const team = (sd === 'A' ? S.sfA : S.sfB).team;
  return own.map(o => {
    if (o.kind === 'pass') return 'pass';
    if (o.forced) return 'forced:' + id(o.move);
    if (o.kind === 'switch') return 'switch:' + BS.stableKey(team[o.to], id);
    if (o.empty) STAT.empty_target_options++;
    return 'move:' + id(o.move) + (o.target == null ? '' : '@' + o.target) + (o.mega ? '+mega' : '');
  }).sort();
}
function probe(M, S) {
  const battle = LAST_BATTLE;
  if (!battle || battle.requestState !== 'move' || battle.turn !== S.turn + 1) {
    STAT.probe_turn_mismatch++;
    const k = !battle ? 'no battle' : battle.requestState + ' sd' + battle.turn + ' medi' + S.turn;
    STAT.mismatch_kinds = STAT.mismatch_kinds || {}; STAT.mismatch_kinds[k] = (STAT.mismatch_kinds[k] || 0) + 1;
    return;
  }
  STAT.probe_turns++;
  for (const [sd, side] of [['A', battle.p1], ['B', battle.p2]]) {
    const la = API.legalActions(S, sd);
    la.slots.forEach((slot, i) => {
      const want = sdOptions(battle, side, i), got = apiOptions(S, sd, slot);
      if (got.some(x => x.startsWith('switch:'))) STAT.switch_slots++;
      STAT.slots++;
      const ws = new Set(want), gs = new Set(got);
      const missing = want.filter(x => !gs.has(x)), extra = got.filter(x => !ws.has(x));
      if (!missing.length && !extra.length) { STAT.slots_agree++; return; }
      STAT.slots_disagree++;
      if (STAT.disagreements.length < 40) {
        const p = side.active[i];
        STAT.disagreements.push({ game: battle.p1 && battle.p1.name + ' v ' + (battle.p2 && battle.p2.name), turn: battle.turn,
          side: sd, slot: i, body: p && p.name, missing, extra,
          medi_body: slot.body || null, trapped_medi: slot.trapped || null, trapped_sd: p ? p.trapped : null,
          /* what each engine holds about the body, for the report -- read only */
          medi_state: (() => { const m = (sd === 'A' ? S.actA : S.actB)[i]; if (!m) return null;
            return { mvActs: m._mvActs, lastMove: m._lastMove, lock: m._lock, lockT: m._lockT === Infinity ? 'inf' : m._lockT,
                     encore: m._encoreMove || null, vol: m._vol || null, pp: m._pp || null, item: m.item, moves: m.moves }; })(),
          sd_state: p ? { activeMoveActions: p.activeMoveActions, activeTurns: p.activeTurns, lastMove: p.lastMove && p.lastMove.id,
                          volatiles: Object.keys(p.volatiles || {}), item: p.item,
                          slots: (p.moveSlots || []).map(ms => ms.id + ':' + ms.pp + (ms.disabled ? ':dis=' + ms.disabled + '/' + (ms.disabledSource || '') : '')) } : null });
      }
    });
  }
}

process.on('exit', () => {
  STAT.api_counters = API ? API.COUNTERS : null;
  STAT.patched = { engine: PATCHED_M, showdown: PATCHED_SD };
  const OUT = PROBE || process.env.MEDI_API_HOOK_OUT;
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(STAT, null, 1) + '\n');
  console.error('medicham_api_diffhook: ' + JSON.stringify({ hook: STAT.hook, routed: STAT.turns_routed,
    clone_turns: STAT.turns_clone, shadow_agree: STAT.shadow_agree, shadow_disagree: STAT.shadow_disagree, probe_turns: STAT.probe_turns, slots: STAT.slots, disagree: STAT.slots_disagree }));
});
