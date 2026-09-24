/* medicham_api.js -- THE SOLVER-FACING MEDICHAM API. A WRAPPER BESIDE THE ENGINE, NOT INSIDE IT.
 *
 * Brief: docs/_reports/2026-09-23-engine-interface-brief.md. Account: docs/_reports/2026-09-24-solver-engine-api.md.
 *
 * WHAT IT IS. The new turn search (solver/, Reg M-C, open sheets) needs four things the engine never
 * exported as such: copy a battle, list what a side may click, play one turn WITHOUT touching the input,
 * and say whether the game is over WITHOUT counting the 20-turn rollout cap as an ending. Every one of
 * them is a wrapper over code the engine already runs:
 *
 *   makeRng(seed)                seeded dice, the engine's own `rngStreams({seed})`, forkable
 *   makeEventDice(seed)          the engine's event-addressed dice (`midEventDice`), no global reset
 *   newBattle(teamA, teamB, o)   `battleInit` inside the battle's OWN scratch scope (see below)
 *   adopt(S)                     give a battle built elsewhere its own scope
 *   clone(S[, {trace}])          structuredClone of the battle, the trace sink left out
 *   legalActions(S, side)        per-slot options and the joint set, as Showdown choice strings
 *   step(S, jA, jB, rng[, {trace}])  a NEW battle one turn on; S is not touched
 *   stepInPlace(S, jA, jB, rng)  the same on S itself (playouts)
 *   isTerminal(S)                a side has nothing left -- `sideWiped`, NOT `battleOver`
 *   winner(S)                    1 (side A), 0 (side B), 0.5 (a double wipe with no faint order), null
 *   atHorizon(S, cap)            S.turn >= cap -- the question `battleOver` was mixing in
 *   horizonScore(S)              `battleResult` -- the HP heuristic at a cap, named as the heuristic it is
 *   digest(S)                    sha256 of the canonical battle, stamps rank-normalised
 *
 * WHAT IT IS NOT, YET. The mid-turn decisions (who replaces a faint, where a pivot goes) are still
 * PRE-COMMITTED: a joint action may carry `replaceWith`/`pivotTo` exactly as the engine already reads
 * them, and with neither the engine's default applies. The brief's callback for them is step 6 and is
 * deliberately not here. `legalActions` answers a MOVE request only -- the engine refills a fainted slot
 * inside the turn, so a forced-switch request never reaches a caller of this module.
 *
 * THE OLD FUNCTIONS ARE UNTOUCHED. `battleOver` still stops at `maxTurns` and every existing caller keeps
 * it. Nothing here edits the engine's behaviour for a battle this module did not build.
 *
 * ONE BATTLE STEPS AT A TIME PER PROCESS. Many may be alive. A step entered while another step through
 * this module is running THROWS -- re-entrancy was never audited (brief §1.2), and a guard that throws is
 * the only kind that cannot be skimmed past. Parallelism is worker processes, each with its own engine.
 *
 * LOADING. `require('./medicham_api.js')` binds to the live engine. A measurement that opened a frozen
 * release binds to THAT engine's module: `require('./medicham_api.js').bind(REL.require('engine/medicham2-browser.js'))`.
 * A release too old to carry the symbols this needs is refused at bind, by name -- never a silent partial API.
 */
'use strict';
const crypto = require('crypto');

const NEED = ['battleInit', 'battleTurn', 'battleResult', 'playerAction', 'rngStreams', 'RNG_STREAMS', 'midEventDice',
  'canMegaNow', 'switchTrapVerdict', 'selectableMoves', 'mustStruggle', 'sideWiped', 'battleScopeNew', 'battleScopeRun',
  'moveTargetClass', 'moveTagParam', 'MEDSEEN', 'MEDFAILS'];

/* THE AUTHORITY'S TARGET RULE, READ WHOLE, NOT RECALLED.
 *   sim/battle-actions.ts:3     CHOOSABLE_TARGETS = normal, any, adjacentAlly, adjacentAllyOrSelf, adjacentFoe
 *   sim/battle.ts:2399-2430     validTargetLoc(targetLoc, source, targetType)
 * Locations are the chooser's own: a foe slot is 1..n, an own slot is -1..-n, 0 is "no target". This is
 * doubles, so `activePerHalf` is 2. Emptiness is NOT checked by the authority -- a slot with nobody in it
 * is a legal thing to name (the move retargets), so it is offered here too and marked `empty`. */
const CHOOSABLE_TARGETS = new Set(['normal', 'any', 'adjacentAlly', 'adjacentAllyOrSelf', 'adjacentFoe']);
function validTargetLoc(targetLoc, sourceLoc, targetType, numSlots) {
  if (targetLoc === 0) return true;
  if (Math.abs(targetLoc) > numSlots) return false;
  const isSelf = (sourceLoc === targetLoc);
  const isFoe = targetLoc > 0;
  const acrossFromTargetLoc = -(numSlots + 1 - targetLoc);
  const isAdjacent = (targetLoc > 0 ? Math.abs(acrossFromTargetLoc - sourceLoc) <= 1 : Math.abs(targetLoc - sourceLoc) === 1);
  switch (targetType) {
    case 'randomNormal': case 'scripted': case 'normal': return isAdjacent;
    case 'adjacentAlly': return isAdjacent && !isFoe;
    case 'adjacentAllyOrSelf': return (isAdjacent && !isFoe) || isSelf;
    case 'adjacentFoe': return isAdjacent && isFoe;
    case 'any': return !isSelf;
  }
  return false;
}

const live = (m) => !!(m && !m.fainted && m.curHP > 0);
const sideKey = (side) => {
  const s = String(side).toUpperCase();
  if (s === 'A' || s === 'P1') return 'A';
  if (s === 'B' || s === 'P2') return 'B';
  throw new Error('medicham_api: side must be A/B (or p1/p2), got ' + side);
};

function bind(M) {
  const missing = NEED.filter(k => !(k in (M || {})));
  if (missing.length) {
    throw new Error('medicham_api: this engine lacks ' + missing.join(', ') + ' -- it predates the solver API '
      + '(abra/regmc 0.87.0). Bind to an engine or release cut after it; there is no partial API.');
  }
  const STREAMS = ['any'].concat(M.RNG_STREAMS);
  /* SAID ON EVERY RUN THAT USES THEM: which capabilities fired. A zero is the finding. */
  const COUNTERS = { battles: 0, adopted: 0, clones: 0, steps: 0, stepsInPlace: 0, legalCalls: 0,
                     forcedSlots: 0, sharedScratch: 0 };
  /* THE DELIBERATE BREAKS, for the acceptance tests to show they can see a fault. Each one is loud: it
   * stamps MEDFAILS the moment it acts, so a run that had one on cannot pass for a clean run. */
  const env = (k) => typeof process !== 'undefined' && process.env && process.env[k] === '1';
  const RED_SHARED_SCRATCH = env('MEDI_API_SHARED_SCRATCH');   // do not give a battle its own scope
  const RED_SHALLOW_CLONE = env('MEDI_API_SHALLOW_CLONE');     // clone = {...S}
  const RED_STEP_MUTATES = env('MEDI_API_STEP_IN_PLACE');      // step() does not clone
  const RED_MEGA_ALWAYS = env('MEDI_API_MEGA_ALWAYS');         // offer mega to every body

  /* ---- DICE ------------------------------------------------------------------------------------ */
  /* The engine's own seeded streams (`rngStreams({seed})`: one LCG per stream, keyed by the stream's
   * name), wrapped only to COUNT draws. A fork is a fresh set advanced by the same counts, so a fork is
   * the same generator at the same point and there is no second copy of the arithmetic. Cost is linear
   * in draws taken, which is fine at one game's worth; a search that forks deep trees owes a cheaper
   * fork (a state export from the engine), and that is a decision for when one is measured. */
  function makeRng(seed, counts) {
    if (typeof seed !== 'number' || !Number.isFinite(seed)) throw new Error('makeRng: numeric seed required');
    const base = M.rngStreams({ seed });
    const c = {};
    const h = { split: true, seed };
    for (const k of STREAMS) {
      const f = base[k];
      if (typeof f !== 'function') throw new Error('makeRng: engine stream ' + k + ' missing');
      const n = (counts && counts[k]) | 0;
      for (let i = 0; i < n; i++) f();
      c[k] = n;
      h[k] = () => { c[k]++; return f(); };
    }
    Object.defineProperty(h, 'counts', { get: () => Object.assign({}, c) });
    h.fork = () => makeRng(seed, c);
    return h;
  }
  /* Event-addressed dice. `reset:false`: the process-wide repeat map belongs to whoever else is using it
   * (the differential clears it once per game); a battle built here counts in its own scope instead. The
   * dice hold no state of their own, so a fork is the same object. */
  function makeEventDice(seed) {
    const d = M.midEventDice({ seed, reset: false });
    d.fork = () => d;
    return d;
  }

  /* ---- BATTLES --------------------------------------------------------------------------------- */
  function newBattle(teamA, teamB, opts) {
    opts = opts || {};
    const init = { autoMega: opts.autoMega === true, seeded: !!opts.seeded };
    if (opts.rng) init.rng = opts.rng;
    if (opts.trace) init.trace = opts.trace;
    let S;
    if (RED_SHARED_SCRATCH) {
      M.MEDFAILS.apiSharedScratchRestored = 1; COUNTERS.sharedScratch++;
      S = M.battleInit(teamA, teamB, init);
    } else {
      const scope = M.battleScopeNew();
      S = M.battleScopeRun(scope, () => M.battleInit(teamA, teamB, init));
      S._scope = scope;
    }
    /* NO HORIZON unless the caller names one. `battleTurn` refuses to play once `battleOver`, and
     * `battleOver` stops at `maxTurns || 20`; a real game has no such cap. */
    S.maxTurns = opts.maxTurns == null ? Infinity : opts.maxTurns;
    COUNTERS.battles++;
    return S;
  }
  function adopt(S) {
    if (!S._scope && !RED_SHARED_SCRATCH) { S._scope = M.battleScopeNew(); COUNTERS.adopted++; }
    return S;
  }

  /* ---- CLONE ----------------------------------------------------------------------------------- */
  /* structuredClone keeps cycles (`sfX._S === S`, `m._sf`) and shared references (`actA[i] === sfA.team[j]`,
   * `_seededBy`, `replaceWith`, a parked redirect's body) INSIDE the copied graph, which is exactly what the
   * engine's `indexOf` lookups need. The trace sink is an I/O handle, not state: taken off for the copy and
   * put back on the original in a `finally`, so a throw cannot strip it. A function-valued field throws
   * DataCloneError here -- by design; the fix for one is to move it off the state. */
  /* THE SINK IS BLANKED IN PLACE, NOT DELETED: a delete-and-re-add would move `_trace` to the end of S's
   * key order, and the key order of a battle is part of what a canonical dump of it reads. */
  const DROP = (typeof process !== 'undefined' && process.env && process.env.MEDI_API_CLONE_DROP) || '';
  function clone(S, opts) {
    const had = Object.prototype.hasOwnProperty.call(S, '_trace');
    const tr = S._trace;
    let T;
    if (RED_SHALLOW_CLONE) { M.MEDFAILS.apiShallowCloneRestored = 1; T = Object.assign({}, S); }
    else {
      if (had) S._trace = undefined;
      try { T = structuredClone(S); } finally { if (had) S._trace = tr; }
    }
    if (had) { if (opts && opts.trace) T._trace = opts.trace; else delete T._trace; }
    else if (opts && opts.trace) T._trace = opts.trace;
    /* DELIBERATE BREAK for the differential's clone arm: one body field left out of every copy. */
    if (DROP) {
      M.MEDFAILS.apiCloneDropRestored = DROP;
      for (const m of [].concat(T.actA || [], T.actB || [], T.benchA || [], T.benchB || [])) if (m) delete m[DROP];
    }
    COUNTERS.clones++;
    return T;
  }

  /* ---- LEGAL ACTIONS --------------------------------------------------------------------------- */
  /* THE ENGINE'S MENU IS NOT A PURE READ, so it is asked under a restore. `lockStillBinds` drops a Choice
   * lock whose item is gone, `ppLeft` fills the lazy PP table, and `moveDisabledBy` bumps MEDSEEN. All
   * three are put back exactly: the active bodies' own fields (by reference, plus the contents of `_pp`)
   * and every key of MEDSEEN / MEDFAILS. tests/test-medicham-api.js asserts the digest of every sampled
   * position is unchanged by a call, and the differential probe (MEDI_API_LEGAL_PROBE) asserts the whole
   * game stream is. */
  function snapCounters(o) { const s = {}; for (const k of Object.keys(o)) s[k] = structuredClone(o[k]); return s; }
  function restoreCounters(o, s) {
    for (const k of Object.keys(o)) if (!(k in s)) delete o[k];
    for (const k of Object.keys(s)) o[k] = s[k];
  }
  function withMenuRestore(bodies, fn) {
    const snaps = bodies.map(m => {
      const own = {}; for (const k of Object.keys(m)) own[k] = m[k];
      return { m, own, pp: m._pp ? Object.assign({}, m._pp) : null };
    });
    const sSeen = snapCounters(M.MEDSEEN), sFail = snapCounters(M.MEDFAILS);
    try { return fn(); }
    finally {
      for (const { m, own, pp } of snaps) {
        for (const k of Object.keys(m)) if (!(k in own)) delete m[k];
        for (const k of Object.keys(own)) m[k] = own[k];
        if (pp && m._pp) { for (const k of Object.keys(m._pp)) if (!(k in pp)) delete m._pp[k]; Object.assign(m._pp, pp); }
      }
      restoreCounters(M.MEDSEEN, sSeen); restoreCounters(M.MEDFAILS, sFail);
    }
  }
  /* THE TARGET CLASS THE REQUEST WOULD CARRY for this body. The engine's tag (`targetClass.target`, which
   * is Showdown's own `move.target`), with the two per-body rewrites the authority applies in
   * `Pokemon#getMoves` (sim/pokemon.ts:997-1015): Curse is `self` on a non-Ghost -- read off the move's
   * own `typeSplitMove` param, not a name -- and Pollen Puff is `adjacentFoe` under Heal Block. */
  function targetTypeFor(m, moveId) {
    const tc = M.moveTargetClass(moveId);
    let t = tc && tc.target;
    if (!t) { M.MEDFAILS.apiTargetClassUnknown = (M.MEDFAILS.apiTargetClassUnknown || 0) + 1; t = 'normal'; }
    const split = M.moveTagParam(moveId, 'typeSplitMove');
    if (split && split.splitsOnType && split.elseTarget && !(m.types || []).includes(split.splitsOnType)) t = split.elseTarget;
    if (moveId === 'pollenpuff' && m._vol && m._vol.healblock > 0) t = 'adjacentFoe';
    return t;
  }
  function forcedMoveOf(m) {
    /* A HARD LOCK is one forced action and no switch -- `getMoveRequestData` sets `trapped = true` when
     * `getLockedMove()` answers (sim/pokemon.ts:1084-1087). The engine's three hard locks: recharge,
     * a charging two-turn move, a rampage. */
    if (m._recharge) return 'recharge';
    if (m._charging) return String(m._charging);
    if (m._mtLock && m._mtLock.left > 0) return String(m._mtLock.move);
    return null;
  }

  function legalActions(S, side) {
    COUNTERS.legalCalls++;
    const sd = sideKey(side);
    const own = sd === 'A' ? S.actA : S.actB, foes = sd === 'A' ? S.actB : S.actA;
    const sf = sd === 'A' ? S.sfA : S.sfB;
    const team = (sf && sf.team) || [];
    const bench = (sd === 'A' ? S.benchA : S.benchB) || [];
    const slots = [];
    withMenuRestore(own.filter(Boolean), () => {
      own.forEach((m, i) => {
        const opts = [];
        if (!live(m)) { opts.push({ kind: 'pass', choice: 'pass' }); slots.push({ slot: i, options: opts }); return; }
        const forced = forcedMoveOf(m);
        if (forced) {
          COUNTERS.forcedSlots++;
          opts.push({ kind: 'move', move: forced, forced: true, target: null, mega: false, choice: 'move 1' });
          slots.push({ slot: i, body: m._ident || m.name, options: opts });
          return;
        }
        const menu = M.mustStruggle(m) ? ['struggle'] : M.selectableMoves(m);
        const canMega = RED_MEGA_ALWAYS ? (M.MEDFAILS.apiMegaAlwaysRestored = 1, true) : !!M.canMegaNow(S, m);
        const src = -(i + 1);
        for (const id of menu) {
          const idx = id === 'struggle' ? 1 : (m.moves || []).indexOf(id) + 1;
          const tt = id === 'struggle' ? 'randomNormal' : targetTypeFor(m, id);
          /* doubles: two slots a side whether or not both are filled -- the authority's `activePerHalf` */
          const locs = CHOOSABLE_TARGETS.has(tt) ? [1, 2, -1, -2].filter(l => validTargetLoc(l, src, tt, 2)) : [null];
          for (const loc of locs) {
            const empty = loc == null ? false : !live(loc > 0 ? foes[loc - 1] : own[-loc - 1]);
            for (const mega of (canMega && id !== 'struggle') ? [false, true] : [false]) {
              opts.push({ kind: 'move', move: id, target: loc, mega, empty,
                          choice: 'move ' + idx + (loc == null ? '' : ' ' + loc) + (mega ? ' mega' : '') });
            }
          }
        }
        const trap = M.switchTrapVerdict(m, foes, S.field);
        if (!trap.block) {
          for (const b of bench) {
            if (!live(b)) continue;
            const ti = team.indexOf(b);
            opts.push({ kind: 'switch', to: ti, ident: b._ident || b.name, choice: 'switch ' + (b._ident || b.name) });
          }
        }
        slots.push({ slot: i, body: m._ident || m.name, options: opts, trapped: trap.block || null });
      });
    });
    /* THE JOINT SET: the product of the slots, less the two things the authority refuses across slots --
     * one body switched in twice (sim/side.ts chooseSwitch, "can only switch in once") and a second mega
     * in one turn (chooseMove, "can only mega-evolve once per battle"). */
    let joint = [[]];
    for (const s of slots) {
      const next = [];
      for (const pre of joint) for (const o of s.options) {
        if (o.kind === 'switch' && pre.some(p => p.kind === 'switch' && p.to === o.to)) continue;
        if (o.mega && pre.some(p => p.mega)) continue;
        next.push(pre.concat([o]));
      }
      joint = next;
    }
    const kind = slots.some(s => s.options.some(o => o.kind !== 'pass')) ? 'move' : 'wait';
    return { side: sd, kind, slots, joint };
  }

  /* ---- STEP ------------------------------------------------------------------------------------ */
  /* A joint action is an array, one entry per active slot, of options as `legalActions` returns them (or
   * any object with the same fields). A Map is passed straight through: that is the engine's own
   * `actsFor` shape, and it is how a caller that already builds one (the differential) routes a turn here.
   * An option may carry `replaceWith` / `pivotTo` -- the engine's pre-committed mid-turn answers. */
  function toActs(S, sd, joint) {
    if (joint instanceof Map) return joint;
    const own = sd === 'A' ? S.actA : S.actB, foes = sd === 'A' ? S.actB : S.actA;
    const team = (sd === 'A' ? S.sfA : S.sfB).team || [];
    const map = new Map();
    own.forEach((m, i) => {
      if (!m) return;
      const o = joint && joint[i];
      if (!o || o.kind === 'pass' || o.forced) { map.set(m, { kind: 'pass' }); return; }
      if (o.kind === 'switch') {
        const to = team[o.to];
        if (!live(to)) throw new Error('medicham_api: switch to team[' + o.to + '] (' + o.ident + ') which cannot come in');
        map.set(m, { kind: 'switch', to }); return;
      }
      const tgt = o.target == null ? null : (o.target > 0 ? foes[o.target - 1] : own[-o.target - 1]) || null;
      const pa = M.playerAction(m, o.move, tgt, S.field);
      if (!pa) throw new Error('medicham_api: the engine could not build ' + o.move + ' for ' + (m._ident || m.name));
      if (o.mega) pa.mega = true;
      if (o.pivotTo != null) pa.pivotTo = team[o.pivotTo] || o.pivotTo;
      map.set(m, pa);
    });
    return map;
  }
  let DEPTH = 0;
  function stepInPlace(S, jA, jB, rng) {
    if (DEPTH > 0) { M.MEDFAILS.apiReentrantStep = (M.MEDFAILS.apiReentrantStep || 0) + 1;
                     throw new Error('medicham_api: a step was entered while another step is running (re-entrancy is not supported)'); }
    if (!M.sideWiped(S) && S.turn >= (S.maxTurns || 20)) {
      throw new Error('medicham_api: S.turn ' + S.turn + ' is at its horizon (maxTurns ' + (S.maxTurns || 20)
        + '); battleTurn would do nothing. Raise S.maxTurns or read atHorizon() first.');
    }
    /* THE PRE-COMMITTED FAINT REPLACEMENT: a joint array may carry `.replaceWith = <team index>`, written where the
     * engine already reads it (`S.replaceWith[side]`, consumed once when it is used). Absent, the engine's default. */
    for (const [sd, j] of [['A', jA], ['B', jB]]) {
      if (!j || j instanceof Map || j.replaceWith == null) continue;
      const team = (sd === 'A' ? S.sfA : S.sfB).team || [];
      if (!team[j.replaceWith]) throw new Error('medicham_api: replaceWith team[' + j.replaceWith + '] does not exist');
      S.replaceWith = S.replaceWith || {};
      S.replaceWith[sd] = team[j.replaceWith];
    }
    DEPTH++;
    try {
      M.battleTurn(S, rng, toActs(S, 'A', jA), toActs(S, 'B', jB));
    } finally { DEPTH--; }
    COUNTERS.stepsInPlace++;
    return S;
  }
  /* The new battle carries NO trace sink unless one is handed in (`opts.trace`): a sink is I/O, and two battles
   * writing into one array would interleave their protocol. */
  function step(S, jA, jB, rng, opts) {
    if (RED_STEP_MUTATES) { M.MEDFAILS.apiStepInPlaceRestored = 1; return stepInPlace(S, jA, jB, rng); }
    const T = clone(S, opts);
    stepInPlace(T, jA, jB, rng);
    COUNTERS.steps++;
    return T;
  }

  /* ---- ENDINGS --------------------------------------------------------------------------------- */
  const isTerminal = (S) => M.sideWiped(S);
  const atHorizon = (S, cap) => S.turn >= (cap == null ? (S.maxTurns || 20) : cap);
  function winner(S) {
    if (!M.sideWiped(S)) return null;
    return M.battleResult(S);   // on a wiped side this is the live-body count, or the last-faint rule
  }
  const horizonScore = (S) => M.battleResult(S);

  /* ---- DIGEST ---------------------------------------------------------------------------------- */
  /* Canonical JSON of the battle graph: keys in insertion order, a shared reference written as the path of
   * its first sighting, the trace sink dropped. PROCESS-GLOBAL STAMPS ARE RANK-NORMALISED, because only
   * their order or equality inside one battle is ever read (brief §1.2, the interleave audit's rule):
   * `_faintSeq`, `_rtieGen`, `_leftEpoch`, and every number inside a `_volSeq` table. The battle's faint
   * epoch (`S._faintEpoch`, echoed on bodies as `_fEpoch`) is written as OWN or as a rank. */
  const RANKED = ['_faintSeq', '_rtieGen', '_leftEpoch'];
  function digestString(S) {
    const objs = new Set();
    (function walk(v) {
      if (!v || typeof v !== 'object' || objs.has(v)) return;
      objs.add(v);
      if (v instanceof Map) { for (const [k, x] of v) { walk(k); walk(x); } return; }
      if (v instanceof Set) { for (const x of v) walk(x); return; }
      for (const k of Object.keys(v)) if (k !== '_trace') walk(v[k]);
    })(S);
    const ranks = {};
    const collect = (key, vals) => { ranks[key] = new Map([...new Set(vals)].sort((a, b) => a - b).map((x, i) => [x, i])); };
    for (const key of RANKED) collect(key, [...objs].map(o => o[key]).filter(x => typeof x === 'number'));
    const seqVals = []; for (const o of objs) if (o._volSeq && typeof o._volSeq === 'object') for (const x of Object.values(o._volSeq)) if (typeof x === 'number') seqVals.push(x);
    collect('_volSeq', seqVals);
    const ep = S._faintEpoch;
    const epVals = [...objs].map(o => o._fEpoch).filter(x => typeof x === 'number' && x !== ep);
    collect('_fEpoch', epVals);
    const seen = new Map();
    const rec = (v, p, key, parentKey) => {
      if (v === null) return null;
      const t = typeof v;
      if (t === 'number') {
        if (parentKey === '_volSeq') return '<seq#' + ranks._volSeq.get(v) + '>';
        if (ranks[key] && key !== '_volSeq' && key !== '_fEpoch') return '<' + key + '#' + ranks[key].get(v) + '>';
        if (key === '_fEpoch' || key === '_faintEpoch') return v === ep ? '<own-epoch>' : '<epoch#' + ranks._fEpoch.get(v) + '>';
        return Number.isFinite(v) ? (Object.is(v, -0) ? '<-0>' : v) : '<' + String(v) + '>';
      }
      if (t === 'string' || t === 'boolean') return v;
      if (t === 'undefined') return '<undef>';
      if (t === 'function') return '<fn ' + (v.name || '') + '>';
      if (t === 'bigint' || t === 'symbol') return '<' + String(v) + '>';
      if (seen.has(v)) return '<@' + seen.get(v) + '>';
      seen.set(v, p);
      if (Array.isArray(v)) return v.map((x, i) => rec(x, p + '[' + i + ']', null, null));
      if (v instanceof Map) { const a = []; let i = 0; for (const [k, x] of v) { a.push([rec(k, p + '<k' + i + '>'), rec(x, p + '<' + i + '>')]); i++; } return { '<Map>': a }; }
      if (v instanceof Set) return { '<Set>': [...v].map((x, i) => rec(x, p + '{' + i + '}')) };
      const o = {};
      for (const k of Object.keys(v)) { if (k === '_trace') continue; o[k] = rec(v[k], p + '.' + k, k, key); }
      return o;
    };
    return JSON.stringify(rec(S, '$', null, null));
  }
  const digest = (S) => crypto.createHash('sha256').update(digestString(S)).digest('hex');

  return { bind, M, COUNTERS, makeRng, makeEventDice, newBattle, adopt, clone, legalActions, step, stepInPlace,
           isTerminal, atHorizon, winner, horizonScore, digest, digestString, validTargetLoc, CHOOSABLE_TARGETS };
}

let _default = null;
module.exports = new Proxy({ bind }, {
  get(t, k) {
    if (k === 'bind') return bind;
    /* The damage table first: the engine reads `globalThis.MC` at use time. engine/regulation.js resolves this
     * require to the selected regulation's own table. A release-bound caller does the same with
     * `REL.require('data/engine-data.js')` before `bind`. */
    if (!_default) {
      require('./regulation.js');            // the table resolver, BEFORE the table (it refuses otherwise)
      require('../data/engine-data.js');
      _default = bind(require('./medicham2-browser.js'));
    }
    return _default[k];
  },
});
