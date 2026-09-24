/* solver/miltank/rollout.js — what fills one MILTANK cell: a world, a turn, a short playout, a leaf.
 *
 *   const R = require('./solver/miltank/rollout.js').create(API, { buildBody });
 *   R.slotSupport(S, side, k)          every option the playout policy may pick for slot k (see below)
 *   R.randomJoint(S, side, coin)       one joint drawn from that support (slot by slot)
 *   R.leaf(S)                          value in [0,1] for side A (terminal: the winner; else the heuristic)
 *   R.sampleWorld(S, oppSide, belief, coin)  a clone of S with the opponent's UNREVEALED bench re-drawn
 *                                      (belief = { sheet: [6 rows], revealed: Set(current team idx) })
 *   R.prepare(W)                       a world serialised once, for many playouts (see prepare below)
 *   R.playout(W, jA, jB, seed, depth)  copy W (or a prepared W), step (jA, jB) on seeded dice, `depth` random turns, leaf
 *
 * THE PLAYOUT POLICY IS NOT A LEGALITY AUTHORITY. `legalActions` is, and it costs ~2 ms a call because
 * it snapshots and restores every process-wide counter so that it can be a pure read (the differential
 * needs that). Inside a playout the position is a throwaway clone and `step` bumps those same counters
 * anyway, so the restore buys nothing there. `slotSupport` asks the engine's own menu functions —
 * `selectableMoves`, `mustStruggle`, `canMegaNow`, `switchTrapVerdict`, `moveTargetClass` — directly,
 * without the restore and without the joint product. The target rule is the API's (`validTargetLoc`,
 * `CHOOSABLE_TARGETS`, exported by engine/medicham_api.js). The two per-body target rewrites the API
 * applies (a `typeSplitMove` move on a body without the split type; Pollen Puff under Heal Block) are
 * mirrored below, and solver/tests/test-miltank.js pins the WHOLE support to be a subset of
 * `legalActions` on real positions — a divergence there is RED, not a silent rollout quirk.
 * Call it on a clone: the engine's menu writes to the bodies it reads.
 *
 * THE LEAF is a heuristic and is named as one: 0.5 + (s_A − s_B)/2 with s = Σ over the four bodies of
 * (alive ? 1/2 + HP fraction/2 : 0) / 4. A wipe returns the engine's own winner. It is the rollout
 * leaf of docs/_reports/2026-09-23-solver-research-turn-search.md §3.3 v1, truncated; the value net
 * replaces it later.
 *
 * THE WORLD. The searcher does not know which of the opponent's six its unrevealed back line is. A
 * world replaces every unrevealed bench body with a fresh body drawn from the opponent's sheet rows not
 * yet revealed — UNIFORMLY, the "plain uniform belief" until XATU exists. Team indices are kept, so a
 * joint action that names `switch team[k]` means "whoever sits at k in this world". The swap stamps the
 * fields battleInit stamps on a body; solver/tests/test-miltank.js proves the swap exact by swapping
 * each unrevealed body for a fresh copy of ITSELF and requiring the battle digest to be unchanged.
 *
 * DELIBERATE BREAKS (env MILTANK_BREAK): `support` (offer a move the menu refused), `swapstamp` (the
 * swap forgets `_sf`), `crn` (a cell's dice ignore the seed), `peek` (the world keeps the opponent's TRUE
 * unrevealed bodies — the search sees hidden information), `prepare` (a prepared copy loses the battle's
 * scratch scope), `rng` (the playout's five dice streams collapse into one). Loud: exported as BROKEN.
 *
 * LEAN PLAYOUTS (2026-09-24, docs/_reports/2026-09-24-lean-mode.md). A playout's own copy is made LEAN
 * (`API.makeLean`) and the whole playout -- its turns, the random joints' menu reads and the leaf -- runs under the
 * engine's lean binding (`API.leanRun`): the same boards (solver/tests/test-lean-mode.js), no protocol, no process
 * counters, tag answers from a table. The world and the prepared buffer are NOT made lean, so their digests are
 * unchanged. `opts.lean === false` or env `MILTANK_LEAN=0` plays full, for an A/B; `values_sha` in
 * solver/bench/playout_bench.js must not move between the two, and `COUNTERS.leanPlayouts` says which ran.
 */
'use strict';
const BREAK = (typeof process !== 'undefined' && process.env && process.env.MILTANK_BREAK) || '';
const LEAN_OFF = typeof process !== 'undefined' && process.env && process.env.MILTANK_LEAN === '0';
const v8 = require('v8');
const live = m => !!(m && !m.fainted && m.curHP > 0);

function create(API, opts) {
  const M = API.M;
  const buildBody = opts.buildBody;
  const COUNTERS = { playouts: 0, playoutTurns: 0, worlds: 0, bodiesSwapped: 0, wipes: 0, leafHeuristic: 0, prepared: 0, fastClones: 0, leanPlayouts: 0 };
  const LEAN = !LEAN_OFF && opts.lean !== false && typeof API.makeLean === 'function';

  function targetType(m, id) {
    const tc = M.moveTargetClass(id);
    let t = (tc && tc.target) || 'normal';
    const split = M.moveTagParam(id, 'typeSplitMove');
    if (split && split.splitsOnType && split.elseTarget && !(m.types || []).includes(split.splitsOnType)) t = split.elseTarget;
    if (id === 'pollenpuff' && m._vol && m._vol.healblock > 0) t = 'adjacentFoe';
    return t;
  }
  function forcedMove(m) {
    if (m._recharge) return 'recharge';
    if (m._charging) return String(m._charging);
    if (m._mtLock && m._mtLock.left > 0) return String(m._mtLock.move);
    return null;
  }

  function slotSupport(S, side, k) {
    const own = side === 'A' ? S.actA : S.actB, foes = side === 'A' ? S.actB : S.actA;
    const sf = side === 'A' ? S.sfA : S.sfB, bench = side === 'A' ? S.benchA : S.benchB;
    const m = own[k];
    if (!live(m)) return [{ kind: 'pass' }];
    const f = forcedMove(m);
    if (f) return [{ kind: 'move', move: f, forced: true, target: null, mega: false }];
    const menu = M.mustStruggle(m) ? ['struggle'] : M.selectableMoves(m).slice();
    if (BREAK === 'support') { const bad = (m.moves || []).find(x => !menu.includes(x)) || 'splash'; menu.push(bad); }
    const canMega = !!M.canMegaNow(S, m);
    const out = [];
    const src = -(k + 1);
    for (const id of menu) {
      const tt = id === 'struggle' ? 'randomNormal' : targetType(m, id);
      let locs = API.CHOOSABLE_TARGETS.has(tt) ? [1, 2, -1, -2].filter(l => API.validTargetLoc(l, src, tt, 2)) : [null];
      /* the policy aims at somebody who is there when it can */
      const full = locs.filter(l => l == null || live(l > 0 ? foes[l - 1] : own[-l - 1]));
      if (full.length) locs = full;
      for (const loc of locs) for (const mega of (canMega && id !== 'struggle') ? [false, true] : [false]) {
        out.push({ kind: 'move', move: id, target: loc, mega });
      }
    }
    if (!M.switchTrapVerdict(m, foes, S.field).block) {
      for (const b of bench) if (live(b)) out.push({ kind: 'switch', to: sf.team.indexOf(b) });
    }
    return out;
  }

  /* one joint, slot by slot, uniform over each slot's support, never two megas or two switches to one body */
  function randomJoint(S, side, coin) {
    const own = side === 'A' ? S.actA : S.actB;
    const j = [];
    for (let k = 0; k < own.length; k++) {
      let sup = slotSupport(S, side, k);
      if (k === 1 && j[0]) {
        const p = j[0];
        sup = sup.filter(o => !(o.mega && p.mega) && !(o.kind === 'switch' && p.kind === 'switch' && p.to === o.to));
        if (!sup.length) sup = [{ kind: 'pass' }];
      }
      j.push(sup[Math.floor(coin() * sup.length)]);
    }
    return j;
  }

  function leaf(S) {
    if (API.isTerminal(S)) { COUNTERS.wipes++; return API.winner(S); }
    COUNTERS.leafHeuristic++;
    const s = team => team.reduce((a, m) => a + (live(m) ? 0.5 + 0.5 * Math.max(0, m.curHP) / m.st.hp : 0), 0) / Math.max(1, team.length);
    return 0.5 + (s(S.sfA.team) - s(S.sfB.team)) / 2;
  }

  /* the fields battleInit stamps on each body (engine/medicham2-browser.js battleInit: `_sf`, `_hadItem`,
   * `_ubNoVol`, `_ubVol`, `_ident`); the identity-swap test is what says this list is complete */
  function swapBody(S, side, k, nb) {
    const sf = side === 'A' ? S.sfA : S.sfB, bench = side === 'A' ? S.benchA : S.benchB;
    const old = sf.team[k];
    if (BREAK !== 'swapstamp') nb._sf = sf;
    nb._hadItem = !!nb.item; nb._ubNoVol = false; nb._ubVol = 0;
    if (!nb._ident) nb._ident = nb.name;
    sf.team[k] = nb;
    const bi = bench.indexOf(old);
    if (bi >= 0) bench[bi] = nb;
    COUNTERS.bodiesSwapped++;
  }

  /* belief = { sheet:[6 rows], revealed:Set(team idx in S, now) }. Uniform over the sheet rows no
   * revealed body carries (`_solverSheet`); the built bodies are cached per row and structuredCloned
   * per world, and carry their row as `_solverSheet` like every arena body. */
  const cache = new Map();
  function body(row, s) {
    /* keyed by the row's CONTENT, not its identity: a pool worker receives a fresh copy of the sheet with
     * every decision, and an identity key would rebuild every body and grow the cache without bound */
    const key = JSON.stringify(row);
    if (!cache.has(key)) cache.set(key, buildBody(M, row));
    const b = cache.get(key);
    if (!b) return null;
    const c = structuredClone(b); c._solverSheet = s;
    return c;
  }
  function sampleWorld(S, oppSide, belief, coin) {
    const W = API.clone(S);
    COUNTERS.worlds++;
    const sf = oppSide === 'A' ? W.sfA : W.sfB;
    const hidden = []; for (let k = 0; k < sf.team.length; k++) if (!belief.revealed.has(k)) hidden.push(k);
    if (!hidden.length || BREAK === 'peek') return W;
    const revSheet = new Set([...belief.revealed].map(k => sf.team[k]._solverSheet));
    const pool = []; belief.sheet.forEach((r, s) => { if (!revSheet.has(s) && body(r, s)) pool.push(s); });
    for (const k of hidden) {
      if (!pool.length) break;
      const s = pool.splice(Math.floor(coin() * pool.length), 1)[0];
      swapBody(W, oppSide, k, body(belief.sheet[s], s));
    }
    return W;
  }

  /* PREPARE A WORLD ONCE, PLAY IT MANY TIMES. A pass plays every cell from the same world, and each
   * playout needs its own copy. `API.clone` is structuredClone: serialise AND deserialise, per copy. Here
   * the world is serialised once (`v8.serialize` — the same V8 ValueSerializer structuredClone runs) and
   * each playout only deserialises. The copy is the same graph: solver/tests/test-playout-speed.js asserts
   * the digest of a prepared copy equals `API.clone`'s on every position, and that the values do not move.
   * A prepared world is a SNAPSHOT: mutating W after prepare() is not seen, which is why it is a separate
   * handle and not a cache keyed on W. The trace sink is an I/O handle and a world must not carry one
   * (sampleWorld's API.clone already drops it); prepare() refuses one rather than copy it. */
  function prepare(W) {
    if (Object.prototype.hasOwnProperty.call(W, '_trace') && W._trace) throw new Error('rollout.prepare: a world must not carry a trace sink');
    COUNTERS.prepared++;
    return { prepared: true, buf: v8.serialize(W) };
  }

  /* the playout's own copy of a world: prepared -> deserialise, plain -> API.clone */
  function copy(W) {
    if (!(W && W.prepared)) return API.clone(W);
    const S = v8.deserialize(W.buf);
    COUNTERS.fastClones++;
    if (BREAK === 'prepare') delete S._scope;   // DELIBERATE BREAK: the copy loses the battle's own dice scratch
    return S;
  }
  /* the engine's own seeded streams, unwrapped: API.makeRng adds draw COUNTS (for fork) on top of the same
   * generators, and a playout never forks — the draws are identical and the wrapper costs 0.1 ms a call */
  function dice(seed) {
    if (BREAK === 'rng') return M.rngStreams(M.rngStreams({ seed }).any);   // DELIBERATE BREAK: every stream is one stream
    return M.rngStreams({ seed });
  }

  function playFrom(S, jA, jB, seed, depth) {
    const rng = dice(BREAK === 'crn' ? Math.floor(Math.random() * 1e9) : seed);
    const coin = M.rngStreams({ seed: seed + 7919 }).any;
    API.stepInPlace(S, jA, jB, rng);
    COUNTERS.playouts++;
    for (let d = 0; d < depth && !API.isTerminal(S); d++) {
      API.stepInPlace(S, randomJoint(S, 'A', coin), randomJoint(S, 'B', coin), rng);
      COUNTERS.playoutTurns++;
    }
    return leaf(S);
  }
  function playout(W, jA, jB, seed, depth) {
    const S = copy(W);
    if (!LEAN) return playFrom(S, jA, jB, seed, depth);
    API.makeLean(S);
    COUNTERS.leanPlayouts++;
    return API.leanRun(() => playFrom(S, jA, jB, seed, depth));
  }

  return { COUNTERS, LEAN, slotSupport, randomJoint, leaf, sampleWorld, swapBody, body, prepare, copy, dice, playout, BROKEN: BREAK || null };
}

module.exports = { create };
