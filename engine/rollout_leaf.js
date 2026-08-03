/* rollout_leaf.js — judge a position by PLAYING IT OUT, instead of by scoring a snapshot.
 *
 * See docs/ROLLOUT-design.md. The short version: PORYGON2 judges a position at 63.70%, and
 * "material sign" — literally counting bodies and HP — judges it at 60.28%. The whole learned value
 * function is worth 3.4 points over counting. A search that maximises it is close to a search for
 * "take the most material this turn", which greedy already does.
 *
 * MEDICHAM can now answer the question a different way: seed it from the real board and play it out.
 * That was not buildable yesterday — the engine turned 10.8% of real clicks into a NO-OP TURN, and
 * a no-op is not neutral, it says the move was worthless. After 2026-08-03 it represents 96.7%
 * (engine/medicham_coverage.js) and can switch, which matters because a rollout that cannot switch
 * misjudges every position whose answer is a switch.
 *
 * NOTHING HERE IS A NEW ENGINE. The seeding is board.js's own `dmgMon`, which already maps a tracked
 * Pokemon onto a MEDICHAM body with live HP, status, stat stages, item and the EFFECTIVE ability —
 * the same function board.js uses to price damage. Reusing it means a rollout and a damage feature
 * cannot disagree about what a Pokemon is.
 */
'use strict';
const path = require('path');

const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));                   // globalThis.MC / mcEff, for MEDICHAM
const MEDI = require('./medicham2-browser.js');
const B = require('./board.js');

/* Every Pokemon a side owns, actives first, then the bench.
 *
 * THE BENCH IS SPECIES NAMES, NOT TRACKED BODIES, and that is correct rather than a gap: `bench()`
 * returns what was brought, is not on the field and is not in the graveyard, and a Pokemon that has
 * never appeared has no live state to track — full HP, no status, no stages. So a mon-shaped object
 * is synthesised for it and handed to the SAME `dmgMon` the actives go through, rather than building
 * it a second way here. `nature` is what dmgMon reads to decide the sheet is known, so passing the
 * sheet through is what makes a benched Pokemon carry its declared item instead of the usage guess.
 *
 * Including the bench at all is new. Before voluntary switching existed it would have been
 * decorative; now it is half the rollout, and a leaf that judged 2v2 when the real position is 4v4
 * would be answering a different question. */
function sideTeam(board, side, dex) {
  const out = [];
  const seen = new Set();
  for (const L of ['a', 'b']) {
    const m = board.slot(side, L);
    if (m && !seen.has(m)) { seen.add(m); out.push(m); }
  }
  const sheets = (board.sheet && board.sheet[side]) || {};
  for (const sp of board.bench(side)) {
    const sh = sheets[sp] || null;
    out.push({ species: sp, hp: 1, status: '', boosts: {},
               item: sh ? (sh.item || '') : undefined,
               nature: sh ? (sh.nature || '') : undefined });
  }
  return out;
}

/* A tracked Pokemon -> a MEDICHAM body. Nulls are DROPPED and COUNTED, not substituted: dmgMon
 * returns null for an in-battle forme with no usage row (Aegislash-Blade, Palafin-Hero), and quietly
 * replacing it with the base forme would roll out a different Pokemon than the one on the field. */
function buildSide(board, side, dex, stats) {
  const mons = [];
  for (const m of sideTeam(board, side, dex)) {
    if (m && m.fainted) { stats.fainted++; continue; }
    let b = null;
    try { b = B.dmgMon(m, MEDI, dex); } catch (e) { stats.threw++; continue; }
    if (!b) { stats.unbuildable++; continue; }
    mons.push(b);
  }
  return mons;
}

/* Wilson, the same interval champions_sim.winProb uses and for the same stated reason: a rollout
 * estimate without one invites reading noise as signal. At N=20 the half-width near 0.5 is ~11
 * points, which is most of the gap this leaf is trying to close — see ROLLOUT-design 4.2. */
function wilson(wins, n) {
  if (!n) return { lo: 0, hi: 1 };
  const p = wins / n, z = 1.96, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return { lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}

/* Deterministic per call, so the same board scored twice gives the same answer. A leaf that returns a
 * different number each time it is asked cannot be compared against another leaf, and the whole point
 * of R1 is a comparison. Seed is threaded in rather than read from a global. */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* THE LEAF.
 *
 * @param board  a live engine/board.js Board
 * @param side   'p1' | 'p2' — whose win probability is wanted
 * @param opts   { n, dex, seed, field }
 * @returns      { p, wins, n, lo, hi, built, dropped } or null when a side cannot be built at all
 *
 * `field` carries the weather/terrain/room the real board is under. Rolling out a snow board with no
 * weather would silently delete Aurora Veil, Slush Rush and every weather-scaled move — the same
 * class of one-directional error as an unmodelled click. */
function rolloutWinProb(board, side, opts) {
  opts = opts || {};
  const n = opts.n || 40;
  /* 0 reproduces the deterministic-greedy playout exactly, so the sweep includes the incumbent. */
  const EXPLORE = typeof opts.explore === 'number' ? opts.explore : 0;
  const dex = opts.dex;
  const foe = side === 'p1' ? 'p2' : 'p1';
  const stats = { fainted: 0, unbuildable: 0, threw: 0 };
  let exploreThrew = 0, firstExploreError = null;

  const mine = buildSide(board, side, dex, stats);
  const theirs = buildSide(board, foe, dex, stats);
  /* A side with nothing standing is not a 0% — the caller asked about a position that does not exist,
   * and returning a confident number for it would be worse than saying so. */
  if (!mine.length || !theirs.length) return null;

  const f = opts.field || {};
  let wins = 0;
  for (let i = 0; i < n; i++) {
    /* Fresh bodies EVERY rollout. MEDICHAM mutates the mons it is handed — HP, status, boosts, the
     * bench arrays — so reusing them would make rollout 2 start from wherever rollout 1 ended. The
     * same aliasing that broke the Showdown fork this morning, one layer up. */
    const A = buildSide(board, side, dex, { fainted: 0, unbuildable: 0, threw: 0 });
    const Bt = buildSide(board, foe, dex, { fainted: 0, unbuildable: 0, threw: 0 });
    if (!A.length || !Bt.length) break;
    const S = MEDI.battleInit(A, Bt, { seeded: true });
    S._explore = EXPLORE;
    S.field.weather = f.weather || '';
    S.field.terrain = f.terrain || '';
    S.field.twA = side === 'p1' ? (f.twA || 0) : (f.twB || 0);
    S.field.twB = side === 'p1' ? (f.twB || 0) : (f.twA || 0);
    S.field.tr = f.tr || 0;
    const rng = mulberry((opts.seed || 1) * 1000003 + i);
    /* EXPLORE: with probability e, a mon clicks a RANDOM legal move instead of chooseAction's pick.
     *
     * This is not a way of playing better. It is the fix the MCTS literature prescribes for exactly
     * the pathology this leaf shows: chooseAction is deterministic greedy, so every playout from one
     * position replays the same line and the N samples are near-identical. That is why accuracy is
     * FLAT in N and why the estimate saturates -- 53% of positions land in the 0-10% or 90-100% bin,
     * and those bins are wrong by 22-29 points. "Heavy rollouts help only when they avoid becoming
     * low-variance" (An Analysis of Monte Carlo Tree Search); ours became low-variance.
     *
     * Injected HERE and not in chooseAction, deliberately: chooseAction is the Tower's policy and the
     * live bot's, and randomising it would change shipped behaviour to fix a rollout.
     */
    while (!MEDI.battleOver(S)) {
      let fa = null, fb = null;
      if (EXPLORE > 0) {
        const pick = (mon) => {
          if (!mon || mon.fainted || mon.curHP <= 0 || rng() >= EXPLORE) return null;
          const mvs = mon.moves || [];
          if (!mvs.length) return null;
          const foes = (S.actA.indexOf(mon) >= 0 ? S.actB : S.actA).filter(x => x && !x.fainted && x.curHP > 0);
          if (!foes.length) return null;
          const mv = mvs[Math.floor(rng() * mvs.length) % mvs.length];
          const tg = foes[Math.floor(rng() * foes.length) % foes.length];
          /* A throw here is NOT expected. playerAction is being handed a move off the mon's own
           * moveset and a live foe, so if it throws, the exploration is generating actions the engine
           * cannot represent -- and swallowing that would quietly reduce the exploration rate toward
           * zero and make explore=1 behave like explore=0.5, which is exactly the variable under
           * test. Counted so it is visible in the return value. */
          try {
            return MEDI.playerAction(mon, mv, tg, S.field);
          } catch (e) {
            exploreThrew++;
            if (!firstExploreError) firstExploreError = `${mon.name} ${mv}: ${e.message}`;
            return null;
          }
        };
        for (const m of S.actA) { const a = pick(m); if (a) { (fa = fa || new Map()).set(m, a); } }
        for (const m of S.actB) { const a = pick(m); if (a) { (fb = fb || new Map()).set(m, a); } }
      }
      MEDI.battleTurn(S, rng, fa, fb);
    }
    wins += MEDI.battleResult(S);          /* 1 / 0 / 0.5, side A is `side` by construction */
  }
  const iv = wilson(wins, n);
  return { p: wins / n, wins, n, lo: iv.lo, hi: iv.hi,
           built: mine.length + theirs.length, dropped: stats,
           exploreThrew, firstExploreError };
}

/* ONE STEP OF SEARCH: force MY two clicks, let the opponent play its own policy, run exactly one turn,
 * then roll the rest out. This is the transition R3 needs and it is the same machinery as the leaf --
 * only the first turn differs, and only on my side.
 *
 * The opponent is NOT modelled. It plays chooseAction during the stepped turn, identically for every
 * candidate, so the ranking across candidates is like-for-like. That makes this a best response to a
 * fixed opponent rather than an equilibrium: weaker than the design's matrix game, and the right first
 * cut, because if a best response does not diverge from MAG then a mixture over the same cells will
 * not either.
 *
 * @param myClicks  [{move, target}, {move, target}] for slots a and b, in sideTeam order
 * @returns         win probability after that pair, or null when the position cannot be built
 */
function rolloutAfterActions(board, side, opts) {
  opts = opts || {};
  const n = opts.n || 20;
  const dex = opts.dex;
  const foe = side === 'p1' ? 'p2' : 'p1';
  const f = opts.field || {};
  const clicks = opts.myClicks || [];
  const zero = () => ({ fainted: 0, unbuildable: 0, threw: 0 });
  let forcedThrew = 0, firstForcedError = null, exploreThrew2 = 0, firstExploreError2 = null;
  let wins = 0, ran = 0;
  for (let i = 0; i < n; i++) {
    const A = buildSide(board, side, dex, zero());
    const Bt = buildSide(board, foe, dex, zero());
    if (!A.length || !Bt.length) break;
    const S = MEDI.battleInit(A, Bt, { seeded: true });
    S.field.weather = f.weather || '';
    S.field.terrain = f.terrain || '';
    S.field.twA = side === 'p1' ? (f.twA || 0) : (f.twB || 0);
    S.field.twB = side === 'p1' ? (f.twB || 0) : (f.twA || 0);
    S.field.tr = f.tr || 0;
    const rng = mulberry((opts.seed || 1) * 1000003 + i);

    /* THE FORCED TURN. The click's target is a board.js mon; MEDICHAM needs one of ITS bodies, and the
     * two arrays are in the same order by construction (sideTeam puts actives first), so the target is
     * resolved by SLOT INDEX rather than by name. Resolving by species would pick the wrong body in a
     * mirror, and 58.63% of corpus games have one. */
    const forced = new Map();
    for (let k = 0; k < Math.min(2, clicks.length); k++) {
      const c = clicks[k], me = S.actA[k];
      if (!me || !c) continue;
      /* A SWITCH IS A CANDIDATE LIKE ANY OTHER, and until now the search refused to consider one.
       *
       * board.js scores a switch with a single flat `isSwitch` feature — the same constant whoever is
       * coming in and whatever is about to die — which is why MAG's switching measured 10 points
       * WORSE than never switching. A rollout needs no such feature: it brings the body in and plays
       * the game out.
       *
       * Resolved BY SPECIES, not by bench index. buildSide drops any Pokemon dmgMon cannot build (an
       * in-battle forme with no usage row), so the bench array here and board.bench() can differ in
       * length — and an index that silently slips brings in the wrong Pokemon, which is worse than
       * refusing. A switch whose target cannot be found is skipped and the slot keeps its own action. */
      if (c.switchTo) {
        const key = B.mcKeyFor(c.switchTo, { mayMiss: 'bench species with no MC row; the switch is then not offered' });
        const body = key && S.benchA.find(x => x && x.name === key && !x.fainted && x.curHP > 0);
        if (body) forced.set(me, { kind: 'switch', to: body });
        continue;
      }
      if (!c.move) continue;
      const foesLive = S.actB.filter(x => x && !x.fainted && x.curHP > 0);
      if (!foesLive.length) continue;
      /* targetMon is null for a spread move, which takes no target -- passing one anyway would make
       * playerAction treat it as aimed. */
      /* THE SLOT LETTER, which is what a board.js candidate actually carries -- `targetLetter`,
       * not a `.slot` on the target mon. Reading a field that does not exist would have defaulted
       * every aimed move to the first live foe, silently collapsing "Fake Out the left one" and
       * "Fake Out the right one" into the same candidate and understating divergence. */
      let tgt = foesLive[0];
      const idx = ['a', 'b'].indexOf(c.targetLetter || '');
      if (idx >= 0 && S.actB[idx] && !S.actB[idx].fainted && S.actB[idx].curHP > 0) tgt = S.actB[idx];
      /* A throw here means the CANDIDATE cannot be represented, which is not a detail: the caller is
       * ranking that candidate against the others, and a click that silently fails to register leaves
       * the mon on chooseAction instead -- so the cell being scored is not the cell that was asked
       * for, and it would look like a candidate that happens to score the same as the default.
       * Counted onto the state so the caller can see it rather than infer it. */
      try {
        const act = MEDI.playerAction(me, c.move, tgt, S.field);
        if (act) forced.set(me, act);
      } catch (e) {
        forcedThrew++;
        if (!firstForcedError) firstForcedError = `${c.move}: ${e.message}`;
      }
    }
    MEDI.battleTurn(S, rng, forced, null);

    /* ...and the rest is an ordinary rollout. */
    while (!MEDI.battleOver(S)) {
      let fa = null, fb = null;
      const EX = typeof opts.explore === 'number' ? opts.explore : 0;
      if (EX > 0) {
        const pick = (mon, mine) => {
          if (!mon || mon.fainted || mon.curHP <= 0 || rng() >= EX) return null;
          const mvs = mon.moves || [];
          const foesL = (mine ? S.actB : S.actA).filter(x => x && !x.fainted && x.curHP > 0);
          if (!mvs.length || !foesL.length) return null;
          const mv = mvs[Math.floor(rng() * mvs.length) % mvs.length];
          const tg = foesL[Math.floor(rng() * foesL.length) % foesL.length];
          /* Same reasoning as the leaf's own explore block: swallowing this would quietly reduce the
           * exploration rate and make explore=1 behave like something lower, which is the variable
           * under test. */
          try {
            return MEDI.playerAction(mon, mv, tg, S.field);
          } catch (e) {
            exploreThrew2++;
            if (!firstExploreError2) firstExploreError2 = `${mon.name} ${mv}: ${e.message}`;
            return null;
          }
        };
        for (const m of S.actA) { const a = pick(m, true); if (a) (fa = fa || new Map()).set(m, a); }
        for (const m of S.actB) { const a = pick(m, false); if (a) (fb = fb || new Map()).set(m, a); }
      }
      MEDI.battleTurn(S, rng, fa, fb);
    }
    wins += MEDI.battleResult(S);
    ran++;
  }
  /* Reported rather than returned quietly: the caller wants a number, and a number produced while
   * some clicks failed to register is a different number. Loud on the first occurrence only. */
  if (forcedThrew && !rolloutAfterActions._warned) {
    rolloutAfterActions._warned = true;
    console.error(`  rolloutAfterActions: ${forcedThrew} forced click(s) could not be built, first: ${firstForcedError}`);
  }
  if (exploreThrew2 && !rolloutAfterActions._warnedEx) {
    rolloutAfterActions._warnedEx = true;
    console.error(`  rolloutAfterActions: ${exploreThrew2} explore action(s) threw, first: ${firstExploreError2}`);
  }
  return ran ? wins / ran : null;
}

module.exports = { rolloutWinProb, rolloutAfterActions, sideTeam, buildSide, wilson };
