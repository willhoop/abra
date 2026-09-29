/* solver/chomp/score.js — CHOMP's cell scorer: every one of the 90 x 90 preview cells, scored by PORYGON2 v0.
 *
 *   const SC = require('./solver/chomp/score.js').create(API[, { model, mode, memo }]);
 *   const r = SC.table(sheets[, { seed, deadline, only }])   sheets = { p1:[6 rows], p2:[6 rows] } (dataset rows)
 *     deadline   an epoch ms; past it the table THROWS 'chomp: over budget' (the caller counts the fallback)
 *     only       { la:[lead-pair idx], lb:[...] } score only those lead-pair blocks (tests); other cells stay NaN
 *     r.A[i][j]   P(p1 wins) when p1 plays option i and p2 plays option j (solver/chomp/options.js indices)
 *     r.ms, r.counters
 *
 * A CELL IS THE TURN-1 POSITION AFTER THE LEADS. For every pair of lead pairs (15 x 15 = 225) MEDICHAM builds the
 * battle (`API.newBattle`: the four leads come in, switch-in abilities fire — weather, terrain, Intimidate), and
 * the PUBLIC position is read through the one engine -> dataset translation (solver/miltank/prior_adapter.js
 * publicState). Then for each of the 6 x 6 back-pair choices under that lead pair the position is completed and
 * PORYGON2 v0 scores it through its own encode() and forward pass (solver/porygon2/features.js, infer.js) — no
 * second copy of any feature.
 *
 * THE BACK TWO AS BELIEF (mode 'revealed', the default). The cell names both sides' back two, so the belief over
 * each back line is a point mass. It is written into the position the way the value net already reads a known
 * back line: the two brought back members are SEEN on the bench at full HP (the entry is publicState's own, taken
 * from a battle in which that member sat on the bench), and the two benched sheet members stay unseen. With four
 * seen per side, features.js gives the unseen weight (4 - 4)/(6 - 4) = 0, so the benched two leave every pool and
 * every damage-race fact. Mode 'public' is the ablation: only the leads are seen, each unseen member carries the
 * uniform weight 1/2 — the net cannot tell the back lines apart, so every cell under one lead pair ties.
 *
 * THE BENCH ENTRY ASSUMES THE TURN-1 POSITION DEPENDS ON THE LEADS ONLY. Nothing on the bench acts on switch-in,
 * so the 225 lead battles are built with a fixed filler back line and the chosen back pair is written in after.
 * solver/tests/test-chomp.js checks this against building the full battle for sampled cells.
 *
 * MEMO. Every damage-race fact is MEDICHAM's `dmgRange` / `hitProb` (features.js `hits`). Inside one table the
 * same attacker meets the same defender on the same field thousands of times, so both calls are memoised on the
 * body's identity (its sheet row, forme and ability, stamped `_ck` at build) plus everything features.js writes
 * onto a body before asking (HP, status, item, ability, boosts) and the field. It caches the engine's answer; it
 * decides nothing. solver/tests/test-chomp.js holds the memoised table EQUAL to the unmemoised one.
 *
 * PRE-GATE caveat does not apply to the engine (release eaa5becc54eb and later are post-gate), but PORYGON2 v0 was
 * trained on HUMAN outcomes, so a cell is P(win) under human-like play, not under the arena bot's play.
 *
 * DELIBERATE BREAKS (env CHOMP_BREAK): `memokey` (the memo key forgets the move — every move of an attacker
 * returns the first one's damage), `back` (the back pair is not written in: every revealed cell reads as the
 * public position). Loud: exported as BROKEN.
 */
'use strict';
const path = require('path');
const O = require('./options.js');

const BREAK = (typeof process !== 'undefined' && process.env && process.env.CHOMP_BREAK) || '';

function create(API, opts) {
  opts = opts || {};
  const M = API.M;
  const T = require('../arena/teams.js');
  const PA = require('../miltank/prior_adapter.js').create(API, null);
  const mode = opts.mode || 'revealed';
  if (!['revealed', 'public'].includes(mode)) throw new Error('chomp/score: mode must be revealed|public');
  const memoOn = opts.memo !== false;
  const COUNTERS = { tables: 0, cells: 0, leadBattles: 0, benchBattles: 0, dmgCalls: 0, dmgMemoHits: 0, hitCalls: 0, hitMemoHits: 0, unkeyed: 0, nonFinite: 0 };

  /* ---- the memo: MEDICHAM's answer, cached on exactly what it reads ----
   * A body's key string is built once per body object (WeakMap) and interned to a small integer, as is the
   * field's; a cell key is then one number. The string is the whole identity — the integer is only its name. */
  let DM, HM, BID, FID, INTERN_B, INTERN_F;
  const reset = () => { DM = new Map(); HM = new Map(); BID = new WeakMap(); FID = new WeakMap(); INTERN_B = new Map(); INTERN_F = new Map(); };
  reset();
  const bkStr = b => (b._ck == null ? null : b._ck + '|' + b.curHP + '|' + (b.status || '') + '|' + (b.item || '') + '|' + (b.ability || '') + '|' + JSON.stringify(b.boosts || {}));
  const bid = b => {
    let id = BID.get(b);
    if (id === undefined) {
      const s = bkStr(b);
      if (s == null) id = -1;
      else { id = INTERN_B.get(s); if (id === undefined) { id = INTERN_B.size; INTERN_B.set(s, id); } }
      BID.set(b, id);
    }
    return id;
  };
  const fid = f => {
    let id = FID.get(f);
    if (id === undefined) { const s = JSON.stringify(f); id = INTERN_F.get(s); if (id === undefined) { id = INTERN_F.size; INTERN_F.set(s, id); } FID.set(f, id); }
    return id;
  };
  const cellKey = (a, d, f, bit) => { const ia = bid(a), id = bid(d); if (ia < 0 || id < 0) return -1; return ((ia * 65536 + id) * 4096 + fid(f)) * 2 + bit; };
  const MM = Object.create(M);
  MM.dmgRange = function (a, d, mv, field, spread) {
    COUNTERS.dmgCalls++;
    const k = memoOn ? cellKey(a, d, field, spread ? 1 : 0) : -1;
    if (k < 0) { if (memoOn) COUNTERS.unkeyed++; return M.dmgRange(a, d, mv, field, spread); }
    const slot = BREAK === 'memokey' ? DM : mv;
    let per = DM.get(slot); if (!per) { per = new Map(); DM.set(slot, per); }
    const r0 = per.get(k);
    if (r0 !== undefined) { COUNTERS.dmgMemoHits++; return r0; }
    const r = M.dmgRange(a, d, mv, field, spread); per.set(k, r); return r;
  };
  MM.hitProb = function (a, d, id, field) {
    COUNTERS.hitCalls++;
    const k = memoOn ? cellKey(a, d, field, 0) : -1;
    if (k < 0) return M.hitProb(a, d, id, field);
    let per = HM.get(id); if (!per) { per = new Map(); HM.set(id, per); }
    const r0 = per.get(k);
    if (r0 !== undefined) { COUNTERS.hitMemoHits++; return r0; }
    const r = M.hitProb(a, d, id, field); per.set(k, r); return r;
  };
  const keyedBuild = (m, row) => { const b = T.buildBody(m, row); if (b) b._ck = JSON.stringify([row.species, row.item, row.ability, row.moves]); return b; };
  const F = require('../porygon2/features.js').create(MM, { buildBody: keyedBuild });
  const NET = require('../porygon2/infer.js').load(opts.model || path.join(__dirname, '..', 'porygon2', 'model', 'porygon2-v0.json'));

  function table(sheets, o) {
    o = o || {};
    if (!sheets || !sheets.p1 || !sheets.p2 || sheets.p1.length !== 6 || sheets.p2.length !== 6) throw new Error('chomp/score: two six-member open sheets are required');
    const t0 = Date.now();
    reset();   // one table's memo; nothing carries between matchups
    COUNTERS.tables++;
    const ctx = { G: { sheets } };
    const cache = { p1: [], p2: [] };
    const body = (sd, s) => {
      if (cache[sd][s] === undefined) cache[sd][s] = T.buildBody(M, sheets[sd][s]) || null;
      if (!cache[sd][s]) throw new Error('chomp/score: ' + sd + ' sheet member ' + s + ' (' + (sheets[sd][s] && sheets[sd][s].species) + ') does not build');
      const b = structuredClone(cache[sd][s]); b._solverSheet = s; return b;
    };
    const seed = o.seed == null ? 1 : o.seed;
    const battle = (ordA, ordB) => API.newBattle(ordA.map(s => body('p1', s)), ordB.map(s => body('p2', s)), { rng: API.makeRng(seed) });

    /* the bench entry of every sheet member: publicState's own entry, from a battle where it sat on the bench */
    const bench = { p1: [], p2: [] };
    if (mode === 'revealed') {
      for (let k = 0; k < 3; k++) {
        const bp = [2 * k, 2 * k + 1], front = [0, 1, 2, 3, 4, 5].filter(x => !bp.includes(x)).slice(0, 2);
        const S = battle(front.concat(bp), front.concat(bp));
        COUNTERS.benchBattles++;
        for (const sf of [S.sfA, S.sfB]) for (const m of sf.team) if (bp.includes(m._solverSheet)) m._wasOut = true;
        const st = PA.publicState(ctx, S);
        for (const sd of ['p1', 'p2']) for (const s of bp) {
          const e = st.sides[sd].mons[s];
          if (!e || !e.seen || e.fnt) throw new Error('chomp/score: bench entry for ' + sd + ' ' + s + ' is not a live seen member');
          bench[sd][s] = e;
        }
      }
    }

    const N = O.N;
    const A = Array.from({ length: N }, () => new Array(N).fill(NaN));
    /* options grouped by lead pair */
    const byLead = O.leadPairs.map(() => []);
    O.OPTIONS.forEach((op, i) => byLead[O.leadPairOf[i]].push(i));
    for (let la = 0; la < O.leadPairs.length; la++) {
      if (o.only && !o.only.la.includes(la)) continue;
      if (o.deadline && Date.now() > o.deadline) { COUNTERS.overBudget = (COUNTERS.overBudget || 0) + 1; throw new Error('chomp: over budget after ' + la + ' of 15 lead pairs'); }
      for (let lb = 0; lb < O.leadPairs.length; lb++) {
        if (o.only && !o.only.lb.includes(lb)) continue;
        const LA = O.leadPairs[la], LB = O.leadPairs[lb];
        const fill = L => L.concat([0, 1, 2, 3, 4, 5].filter(x => !L.includes(x)).slice(0, 2));
        const S = battle(fill(LA), fill(LB));
        COUNTERS.leadBattles++;
        const base = PA.publicState(ctx, S);
        const turn = S.turn + 1;
        for (const i of byLead[la]) {
          for (const j of byLead[lb]) {
            const state = Object.assign({}, base, { sides: {} });
            for (const [sd, op] of [['p1', O.OPTIONS[i]], ['p2', O.OPTIONS[j]]]) {
              const mons = base.sides[sd].mons.slice();
              if (mode === 'revealed' && BREAK !== 'back') for (const s of op.back) mons[s] = bench[sd][s];
              state.sides[sd] = Object.assign({}, base.sides[sd], { mons });
            }
            const v = NET.value(F.encode({ sheets, state, turn }));
            if (!Number.isFinite(v)) { COUNTERS.nonFinite++; throw new Error('chomp/score: non-finite cell value'); }
            A[i][j] = v;
            COUNTERS.cells++;
          }
        }
      }
    }
    return { A, ms: Date.now() - t0, mode, memo: memoOn };
  }

  return { table, COUNTERS, net: NET, features: F, mode, BROKEN: BREAK || null };
}

module.exports = { create, BREAK };
