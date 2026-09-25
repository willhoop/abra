/* solver/mag/probe.js — ASK MEDICHAM WHAT A CLICK DID. The one engine interface both dead-click gates use
 * (MAG v2, solver/mag/gate.js, per slot; DODUO v2, solver/doduo/gate.js, per pair).
 *
 *   const P = require('./solver/mag/probe.js').create(API);
 *   const pos = P.position(W, side[, { alt: [W2], seed }])   W = the world the gate reasons in (a copy is taken)
 *   pos.la, pos.lo              legalActions of `side` and of its opponent, on that world
 *   pos.run(jSide, jOpp, d[, { board: true }])  -> { exec:[b,b], ok:[b,b], board:string|null, err }
 *   pos.steps                   engine steps this position has cost (the cache is per position)
 *
 * ONE WORLD = one step of the engine from the position: my joint, their joint, one set of dice. What the gates
 * read out of it is the ENGINE'S OWN VERDICT, never a rule typed here:
 *
 *   ok[k]    the body in my slot k had its move result set to SUCCESS during the step — MEDICHAM's `_mvRes`,
 *            its mirror of Showdown's `pokemon.moveThisTurnResult` (the field Stomping Tantrum reads). A move
 *            into an immunity, a status move onto a statused body, Fake Out off its first turn, a side
 *            condition already up: the engine writes false (or null) and never true.
 *   exec[k]  the body in slot k got as far as having ANY result written (true / false / null): its turn came.
 *            A body KO'd, forced out or never reached before it acted writes nothing — that world is
 *            UNINFORMATIVE about the click, not a failure of it. (Flinch, full paralysis and sleep write false:
 *            the engine's own "cant", so those worlds count.)
 *   board    engine/board_state.js `readMedi` of the position after the step (the MEDICHAM bar's definition of
 *            the board), from the frozen byte copy solver/doduo/board_state.frozen.js. Used by the pair gate to
 *            ask "did this click change anything the partner's click did not already change".
 *
 * The result write is watched with a property accessor on the four active bodies of the copy; nothing in the
 * engine is edited. Every world is a fresh deserialised copy of the position, played LEAN (the same board,
 * no protocol; solver/tests/test-lean-mode.js).
 *
 * THE DICE. Every world has its own dice set d, the engine's EVENT-ADDRESSED dice (`midEventDice`): a die is a
 * function of (seed, turn, category, move, target, repeat), so replacing one body's click by a pass leaves every
 * OTHER body's rolls where they were, and the pass counterfactual compares actions, not dice. On even d the two
 * streams whose low roll means "it works" are pinned at 0: `acc` (a roll above the accuracy misses) and `stall`
 * (a consecutive Protect-family click succeeds on a roll below 1/counter); odd d is unpinned.
 *
 * THE GATES JUDGE STRUCTURE, NOT DAMAGE. Every world is played TALL: each body's HP stat and current HP are multiplied
 * by K (4,096 by default; o.tall / opts.tall, `false` for the literal board), so every HP fraction is what it was and
 * no hit this turn can knock anything out — a body at 1 HP of 155 becomes 4,096 of 634,880. (K = 64 was tried first
 * and a 1%-HP last foe still fell to a 200-power hit, so a Follow Me beside it was cut; the fraction must survive the
 * largest hit in the format, not a typical one.) A click that is "futile" only because somebody is KO'd first — a Protect
 * beside a partner whose spread move OHKOs the only attacker, an attack beside a partner's finishing blow — depends
 * on damage, and damage depends on stat spreads nobody can see on an open sheet (they are not in the store) and on
 * rolls. The first held-out run cut eight human clicks of exactly that shape, the engine being right on the flat
 * spreads it plays with and the humans being right about the real ones. In the tall world those clicks have their
 * effect and nothing is cut; what the gates still cut is futile whatever the numbers are: an immunity, a status that
 * cannot stack, a side condition already up, Helping Hand beside a click that deals no damage, a second redirect.
 *
 * WHAT THE PLAYER CANNOT SEE IS NOT READ. The sleep clock (`slpTime`, drawn when the sleep landed) is hidden
 * from both players in Showdown, so the copy opens it: every sleeping body may wake this turn (`slpTime` =
 * turns slept + 1). The gate therefore never cuts a click because a body will certainly stay asleep — a missed
 * cut, never a wrong one. Rest's fixed clock is opened too, for the same reason.
 *
 * DELIBERATE BREAKS (env GATE_BREAK): `exec` — every world counts as informative, so a body KO'd before it acts
 * reads as its click failing; `anytrue` — the provisional success the engine writes when a move is used counts, so
 * a move into an immunity reads as a success; `dice` — no stream is pinned, so a roll-dependent click (a Protect on a
 * long streak) can read as dead; `short` — the worlds are not tall, so futility that needs a KO gets cut.
 * solver/tests/test-gates.js must go red under each.
 */
'use strict';
const v8 = require('v8');
const path = require('path');
const BS = require('../doduo/board_state.frozen.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.GATE_BREAK) || '';
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const live = m => !!(m && !m.fainted && m.curHP > 0);

/* an option's identity, independent of which copy of the position it came from */
const optKey = o => !o ? '-' : o.kind === 'switch' ? 'sw' + o.to : o.kind === 'pass' ? 'pass'
  : (o.forced ? 'F' : 'm') + ':' + o.move + ':' + (o.target == null ? '' : o.target) + (o.mega ? ':M' : '');
const jointKey = j => j.map(optKey).join('|');
const PASS = { kind: 'pass' };

function create(API, opts) {
  opts = opts || {};
  const M = API.M;
  const COUNTERS = { positions: 0, steps: 0, errors: 0, cacheHits: 0, boards: 0, sleepClocksOpened: 0, tallWorlds: 0 };
  const SEEDS = opts.seeds || [0x5eed01, 0x5eed02];

  /* dice set d of a position: FRESH rolls for every d (so a chance event — a consecutive Protect, a thaw, full
   * paralysis — is re-rolled world by world, never decided once for the whole position), and on even d the two
   * named streams whose low roll means "it works" pinned there: `acc` (a roll above the accuracy misses) and
   * `stall` (a consecutive Protect succeeds on randomChance(1, counter)). Every other stream rolls. */
  function dice(d, salt) {
    const e = M.midEventDice({ seed: (SEEDS[d % 2] + Math.imul(d, 7919) + (salt | 0)) >>> 0, reset: false });
    return (d % 2 === 0 && BREAK !== 'dice') ? Object.assign({}, e, { acc: () => 0, stall: () => 0 }) : e;
  }

  const TALL = (opts.tall === false || BREAK === 'short') ? 1 : (opts.tall || 4096);
  function prep(W, tall) {
    const C = API.clone(W);
    delete C._trace;
    for (const sf of [C.sfA, C.sfB]) for (const m of (sf && sf.team) || []) {
      if (!m) continue;
      if (m.status === 'slp') { m.slpTime = (m.slpTurns || 0) + 1; COUNTERS.sleepClocksOpened++; }
      /* THE TALL WORLD: every body's HP stat and current HP multiplied by K (so every HP FRACTION is unchanged, and no
       * hit this turn can KO). Substitute HP and the Emergency Exit thresholds scale with it. */
      if (tall > 1 && m.st && m.st.hp > 0) {
        m.st = Object.assign({}, m.st, { hp: m.st.hp * tall });
        if (m.curHP > 0) m.curHP = m.curHP * tall;
        if (m._sub > 0) m._sub = m._sub * tall;
        if (m._eeHP > 0) m._eeHP = m._eeHP * tall;
        if (m._eeResHP > 0) m._eeResHP = m._eeResHP * tall;
      }
    }
    if (tall > 1) COUNTERS.tallWorlds++;
    return C;
  }

  /* THE RESULT IS THE LAST ONE WRITTEN, NOT ANY ONE. The engine writes a provisional `true` the moment a move is
   * used ("the move was used, so the default result is success", ROADMAP #84) and overwrites it with the move's own
   * result after the hit steps — a Normal move into a Ghost ally reads true, then false. Showdown's field is what
   * `useMove` leaves at the end of the action, so ok = the last true/false/null written. The turn-end roll
   * (`_mvResLast = _mvRes; _mvRes = undefined`) and a switch-out's clear write `undefined`, which is ignored. */
  function watch(m) {
    const w = { exec: false, ok: false };
    if (!m) return w;
    let v = m._mvRes;
    Object.defineProperty(m, '_mvRes', { configurable: true, enumerable: true,
      get() { return v; },
      set(x) { v = x; if (x === true || x === false || x === null) { w.exec = true; w.ok = BREAK === 'anytrue' ? (w.ok || x === true) : x === true; } } });
    return w;
  }

  /* W: the world. o.alt: other worlds (the opponent's hidden back line drawn differently) the MAG gate re-checks
   * a would-be HARD cut on. o.salt: mixes into the dice so two positions do not share rolls by accident. */
  function position(W, side, o) {
    o = o || {};
    COUNTERS.positions++;
    const opp = side === 'A' ? 'B' : 'A';
    const tall = (o.tall === false || BREAK === 'short') ? 1 : (o.tall || TALL);
    const C = prep(W, tall);
    const la = API.legalActions(C, side), lo = API.legalActions(C, opp);
    const bufs = [v8.serialize(C)].concat((o.alt || []).map(x => v8.serialize(prep(x, tall))));
    const cache = new Map();
    const pos = { side, opp, la, lo, steps: 0, errors: 0, worlds: bufs.length, salt: o.salt | 0 };
    pos.run = function run(jS, jO, d, ro) {
      ro = ro || {};
      const wi = ro.world | 0;
      const key = wi + '#' + d + '#' + jointKey(jS) + '#' + jointKey(jO) + (ro.board ? '#b' : '');
      const hit = cache.get(key);
      if (hit) { COUNTERS.cacheHits++; return hit; }
      const S = v8.deserialize(bufs[wi]);
      const own = side === 'A' ? S.actA : S.actB;
      const w = [watch(own[0]), watch(own[1])];
      let err = null;
      try {
        API.makeLean(S);
        const jA = side === 'A' ? jS : jO, jB = side === 'A' ? jO : jS;
        API.leanRun(() => API.stepInPlace(S, jA, jB, dice(d, pos.salt)));
      } catch (e) { err = String(e && e.message || e).slice(0, 200); COUNTERS.errors++; pos.errors++; }
      pos.steps++; COUNTERS.steps++;
      let board = null;
      if (ro.board && !err) { board = JSON.stringify(BS.readMedi(S, { id: toID, fails: {} })); COUNTERS.boards++; }
      const exec = BREAK === 'exec' ? [true, true] : [w[0].exec, w[1].exec];
      const r = { exec: err ? [false, false] : exec, ok: err ? [false, false] : [w[0].ok, w[1].ok], board, err };
      cache.set(key, r);
      return r;
    };
    return pos;
  }

  return { COUNTERS, position, BROKEN: BREAK || null };
}

/* A SEEDED PERMUTATION (Fisher-Yates on a small LCG): the covering designs below must be a function of the
 * position and the click, so a gate verdict replays exactly. */
function perm(n, seed) {
  let s = (seed >>> 0) || 1;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }

/* THE OPPONENT'S JOINTS AS A COVERING DESIGN: `rounds` passes, each a sequence in which every option of each of
 * the opponent's two slots appears at least once (so 2 appearances over 2 rounds, each with a different companion),
 * every entry a joint `legalActions` offers. Returns [{ o: joint, di }] — di is the entry's own dice set. */
function oppCover(lo, seed, rounds) {
  const two = lo.slots.length > 1;
  const S0 = lo.slots[0] ? lo.slots[0].options : [PASS], S1 = two ? lo.slots[1].options : [PASS];
  const ok = new Set(lo.joint.map(jointKey));
  const mk = (a, b) => (two ? [a, b] : [a]);
  const out = [], seen = new Set();
  for (let r = 0; r < (rounds || 2); r++) {
    const p0 = perm(S0.length, seed + 101 * r + 1), p1 = perm(S1.length, seed + 101 * r + 2);
    const got0 = new Set(), got1 = new Set();
    const add = j => {
      const k = jointKey(j) + '#' + r;
      got0.add(optKey(j[0])); if (two) got1.add(optKey(j[1]));
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ o: j, di: out.length });
    };
    /* pass 1: slot 0's options in a shuffled order, each with the next slot-1 option that forms a legal joint */
    const n = Math.max(S0.length, S1.length);
    for (let i = 0; i < n; i++) {
      const a = S0[p0[i % S0.length]];
      for (let t = 0; t < S1.length; t++) { const j = mk(a, S1[p1[(i + t) % S1.length]]); if (ok.has(jointKey(j))) { add(j); break; } }
    }
    /* pass 2: EVERY option of each slot must appear. A slot-1 option pass 1 never paired (its only partners were
     * refused — a second switch to one body, a second mega) is added here with a companion that makes it legal. */
    for (let i = 0; i < S1.length && two; i++) {
      const b = S1[p1[i]];
      if (got1.has(optKey(b))) continue;
      for (let t = 0; t < S0.length; t++) { const j = mk(S0[p0[(i + t) % S0.length]], b); if (ok.has(jointKey(j))) { add(j); break; } }
    }
    for (let i = 0; i < S0.length; i++) {
      const a = S0[p0[i]];
      if (got0.has(optKey(a))) continue;
      for (let t = 0; t < S1.length; t++) { const j = mk(a, S1[p1[(i + t) % S1.length]]); if (ok.has(jointKey(j))) { add(j); break; } }
    }
  }
  return out;
}
/* THE GATES' BUDGET: o.maxSteps engine steps for the position, and/or an absolute o.deadline (Date.now()). Past either,
 * a gate stops asking and KEEPS what it has not proved dead. */
const over = (pos, o) => !!o && ((o.maxSteps && pos.steps >= o.maxSteps) || (o.deadline && Date.now() >= o.deadline));
const hasSwitch = j => j.some(x => x && x.kind === 'switch');
const isMove = o => !!(o && o.kind === 'move' && !o.forced);

module.exports = { create, optKey, jointKey, perm, hashStr, oppCover, hasSwitch, isMove, over, PASS, live };
