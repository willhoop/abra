/* solver/xatu/worlds.js — XATU's belief made into MEDICHAM positions for the search. HONEST INFORMATION.
 *
 * ONE implementation, two callers, so the arena that measures the searcher and the client that plays it cannot drift:
 *   - the honest arena, solver/mew/play.js --info honest (the default for a match: sprt.js, gate.js);
 *   - ROTOM's `miltank-gen5` policy, solver/rotom/policy.js.
 *
 *   const XW = require('./solver/xatu/worlds.js').create(API, { R })      R = solver/miltank/rollout.js instance
 *   XW.applySpread(m, sp, row)             set body m's stat line from an SP vector (Showdown keys) and its sheet row's nature;
 *                                          the HP FRACTION is kept (a public HP percentage stays what it was)
 *   XW.publicOpp(S, oppSide, sheetOpp, pctOf)   the ROOT view of the opponent: every body at ZERO SP under its
 *                                          sheet's nature, a revealed body's HP laid from its public percentage
 *   XW.fillHidden(S, oppSide, sheetOpp, revealed, pair)   the unrevealed back line filled from a back pair
 *   XW.rollout(hb)                         R with sampleWorld replaced: the back pair from XATU's posterior, every
 *                                          opponent body's spread drawn from XATU's spread belief (see below)
 *   XW.spreadPrior(sheets)                 XATU's SpreadBelief over both sheets, cached by sheet content
 *   XW.pctOf(hp, max)                      the percentage the Champions client shows for the other side's HP
 *   XW.hpFromPct(pct, max)                 an HP inside that displayed percentage (its middle)
 *   XW.truthSpreads(sheets, seed)          the arena's TRUE spreads (arena only; a player never has these)
 *   XW.arenaGame(G, S, PA)                 the honest arena's per-game state: both sides' leads, one XATU belief per
 *                                          viewer (game 1 of a series, no memory — what ROTOM holds then), the prior
 *   XW.arenaView(H, G, S, side, PA)        -> { V, hb }: the decider's PUBLIC VIEW of the true battle S, and its belief
 *   XW.HON                                 the arena's honest counters (views, XATU back posteriors, errors)
 *   XW.COUNTERS
 *
 *   hb = { back: [{ pair:[i,j], p }] | null, spreads: SpreadBelief | null, oppP: 'p1'|'p2' }
 *
 * WHAT A LADDER PLAYER SEES, AND SO WHAT THE SEARCHER MAY USE. Both open sheets (species, item, ability, moves,
 * NATURE — the Champions sheet carries the nature; pokemon-showdown-mc |showteam|, parse_game.js parseShowteam
 * field 5), the opponent's leads and every body it has revealed, each revealed body's HP as a PERCENTAGE, its
 * status, boosts, lost item and mega forme, the field, and its own side exactly. Not the opponent's Stat Point
 * spread (open sheets do not carry it: the pool's `evs` is null on every row) and not the two it left in the back.
 *
 *   - the unrevealed back line: drawn per world from XATU's back-pair posterior (solver/xatu/bring.js through
 *     index.js backTwo), uniform over the sheet rows not yet revealed when XATU has none (COUNTED: backUniform);
 *   - the spread of EVERY opponent body: drawn per world from XATU's SpreadBelief (spreads.js `sample`: uniform per
 *     stat over the alive values, the budget enforced). v1 feeds it NO observations, in the arena and in ROTOM
 *     alike: it is the prior XATU's plan names as the baseline. Feeding the tracker's order/damage observations can
 *     only narrow it; that is owed, and it is owed to BOTH callers at once;
 *   - the opponent's HP: the percentage the client shows, `Math.floor(100 * hp / maxhp) || 1`
 *     (pokemon-showdown-mc sim/pokemon.ts getHealth, the `champions` branch, L2066-2068 at f10d679), laid back as the
 *     middle of that percentage of whatever max HP the world's spread gives.
 *
 * HP TAKES SP. `M.spreadL50` (engine/medicham2-browser.js L12825-12840) has no HP term and says so: Champions'
 * statModify adds the SP to HP. So the HP line is spreadL50's plus sp.hp, and solver/tests/test-honest-info.js checks
 * the whole line against the checkout's own statModify (xatu/sd.js statValue).
 *
 * DELIBERATE BREAK (env HONEST_BREAK=peek): arenaView hands back the TRUE battle and no belief — the omniscient arena
 * wearing the honest label. solver/tests/test-honest-info.js VIEW must go red.
 *
 * MEGA. `_nature` is stamped (the engine's mega swap applies it to both anchors); `_sp` is NOT, because the engine's
 * spread recompute is gated on reproducing the current line WITHOUT an HP term and would refuse an HP-invested body.
 * The swap's delta path then carries the spread onto the mega forme (engine counter megaStatDeltaFallback) — the
 * same path every arena body built by teams.js has always taken.
 */
'use strict';
const X = require('../human/dex.js');
const toID = X.toID;
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const ZERO = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const live = m => !!(m && !m.fainted && m.curHP > 0);
const BREAK = (typeof process !== 'undefined' && process.env && process.env.HONEST_BREAK) || '';

/* the displayed percentage of the other side's HP, Champions (see the header) */
function pctOf(hp, max) { if (!(hp > 0)) return 0; return Math.floor(100 * hp / max) || 1; }
/* an HP whose display is `pct`: the middle of [pct, pct+1) percent of max, clamped to the body */
function hpFromPct(pct, max) {
  if (!(pct > 0)) return 0;
  return Math.max(1, Math.min(max, Math.round((pct + 0.5) / 100 * max)));
}

/* seeded xorshift, the same generator solver/xatu/selfplay.js uses */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function create(API, deps) {
  const M = API.M;
  const R = deps.R;
  if (typeof M.spreadL50 !== 'function') throw new Error('xatu/worlds: this engine release has no spreadL50 export');
  const COUNTERS = { worlds: 0, backXatu: 0, backUniform: 0, backNone: 0, bodiesFilled: 0, spreadsSampled: 0, spreadsApplied: 0, spreadMissingBase: 0,
                     views: 0, hpLaid: 0, hiddenReplaced: 0 };

  const baseStats = name => { const sp = X.D.species.get(toID(name)); return sp && sp.exists ? sp.baseStats : null; };
  /* row = the body's sheet row (species, nature). Max HP is the SHEET species' line: Showdown fixes it when the mon is
   * built and a forme change never recomputes it (sim/pokemon.ts setSpecies `if (!this.maxhp)`, as xatu/sd.js notes);
   * the other five follow the body's CURRENT forme (a mega). */
  function applySpread(m, sp, row) {
    row = row || {};
    const bs = baseStats(m.name), bh = baseStats(row.species || m.name) || bs;
    if (!bs) { COUNTERS.spreadMissingBase++; return false; }
    sp = sp || ZERO;
    const nature = row.nature || null;
    const st = M.spreadL50(bs, { at: sp.atk || 0, df: sp.def || 0, sa: sp.spa || 0, sd: sp.spd || 0, sp: sp.spe || 0 }, nature || undefined);
    st.hp = M.spreadL50(bh, null, undefined).hp + (sp.hp || 0);
    const frac = m.st && m.st.hp > 0 ? m.curHP / m.st.hp : 1;
    m.st = st;
    if (nature) m._nature = nature; else delete m._nature;
    if (m.fainted || m.curHP <= 0) m.curHP = 0;
    else m.curHP = Math.max(1, Math.min(st.hp, Math.round(frac * st.hp)));
    COUNTERS.spreadsApplied++;
    return true;
  }

  const sfOf = (S, side) => (side === 'A' ? S.sfA : S.sfB);
  const actOf = (S, side) => (side === 'A' ? S.actA : S.actB);

  /* the ROOT view of the opponent (see the header): zero SP under the sheet's nature; a revealed live body's HP from
   * its public percentage. pctOf(m) -> the displayed percentage of that body, or null to keep the body's HP as is */
  function publicOpp(S, oppSide, sheetOpp, pctOfBody) {
    for (const m of sfOf(S, oppSide).team) {
      if (!m) continue;
      const row = sheetOpp[m._solverSheet] || {};
      const pct = pctOfBody ? pctOfBody(m) : null;
      applySpread(m, ZERO, row);
      if (pct != null && live(m)) { m.curHP = hpFromPct(pct, m.st.hp); COUNTERS.hpLaid++; }
    }
    return S;
  }

  /* fill the opponent's unrevealed team slots from `pair` (sheet rows), in order; a row already on the team is skipped */
  function fillHidden(S, oppSide, sheetOpp, revealed, pair) {
    const sf = sfOf(S, oppSide);
    const hidden = []; for (let k = 0; k < sf.team.length; k++) if (!revealed.has(k)) hidden.push(k);
    const onTeam = new Set([...revealed].map(k => sf.team[k]._solverSheet));
    const fill = (pair || []).filter(s => !onTeam.has(s));
    if (fill.length < hidden.length) {   // no usable pair: uniform over the rows not revealed
      const pool = []; sheetOpp.forEach((r, s) => { if (!onTeam.has(s) && !fill.includes(s)) pool.push(s); });
      while (fill.length < hidden.length && pool.length) fill.push(pool.splice(0, 1)[0]);
    }
    hidden.forEach((k, i) => { const s = fill[i]; if (s == null) return; const nb = R.body(sheetOpp[s], s); if (nb) { R.swapBody(S, oppSide, k, nb); COUNTERS.hiddenReplaced++; } });
    return S;
  }

  function drawPair(back, coin) {
    let u = coin(), acc = 0, pair = back[back.length - 1].pair;
    for (const x of back) { acc += x.p; if (u <= acc) { pair = x.pair; break; } }
    return pair;
  }

  /* R with an honest sampleWorld. belief = { sheet, revealed } as search.js builds it (the opponent's sheet rows, the
   * revealed team indices); hb = { back, spreads, oppP }. The world coin is the pass's own seeded stream (cells.js),
   * so a pass is still a pure function of (job, p). */
  function rollout(hb) {
    return Object.assign({}, R, { sampleWorld(S, oppSide, belief, coin) {
      const W = API.clone(S);
      COUNTERS.worlds++;
      const sf = sfOf(W, oppSide);
      const hidden = []; for (let k = 0; k < sf.team.length; k++) if (!belief.revealed.has(k)) hidden.push(k);
      if (hidden.length) {
        const onTeam = new Set([...belief.revealed].map(k => sf.team[k]._solverSheet));
        let fill = [];
        if (hb && hb.back && hb.back.length) fill = drawPair(hb.back, coin).filter(s => !onTeam.has(s));
        if (fill.length >= hidden.length) COUNTERS.backXatu++;
        else {
          COUNTERS.backUniform++;
          const pool = []; belief.sheet.forEach((r, s) => { if (!onTeam.has(s)) pool.push(s); });
          fill = [];
          for (let i = 0; i < hidden.length && pool.length; i++) fill.push(pool.splice(Math.floor(coin() * pool.length), 1)[0]);
        }
        hidden.forEach((k, i) => { const s = fill[i]; if (s == null) return; const nb = R.body(belief.sheet[s], s); if (nb) { R.swapBody(W, oppSide, k, nb); COUNTERS.bodiesFilled++; } });
      } else COUNTERS.backNone++;
      if (hb && hb.spreads) {
        for (const m of sf.team) {
          if (!m || m._solverSheet == null) continue;
          const sp = hb.spreads.sample(hb.oppP, m._solverSheet, coin);
          COUNTERS.spreadsSampled++;
          applySpread(m, sp, belief.sheet[m._solverSheet]);
        }
      }
      return W;
    } });
  }

  const PRIORS = new Map();
  function spreadPrior(sheets) {
    const key = JSON.stringify(['p1', 'p2'].map(p => (sheets[p] || []).map(r => [r.species, r.nature, r.item, r.ability])));
    if (PRIORS.has(key)) return PRIORS.get(key);
    const { SpreadBelief } = require('./spreads.js');
    const b = new SpreadBelief(sheets);
    if (PRIORS.size > 64) PRIORS.clear();
    PRIORS.set(key, b);
    return b;
  }

  /* ---- the honest arena (solver/mew/play.js --info honest) ---- */
  const HON = { games: 0, views: 0, truth_bodies: 0, back_xatu: 0, back_none: 0, back_error: 0, back_errors: [] };
  let XATU = null, BringMemory = null, BRING_MODEL = null;
  function arenaGame(G, S) {
    if (!XATU) { XATU = require('./index.js'); BringMemory = require('./bring.js').BringMemory; BRING_MODEL = XATU.loadModel(); }
    HON.games++;
    const leads = { p1: S.actA.map(m => m._solverSheet), p2: S.actB.map(m => m._solverSheet) };
    const bel = {};
    for (const me of ['p1', 'p2']) bel[me] = XATU.createBelief({ me, model: BRING_MODEL, memory: new BringMemory(), context: { series: null, gnum: 1, players: { p1: 'p1', p2: 'p2' } } });
    return { leads, bel, spreads: spreadPrior(G.sheets) };
  }
  function arenaView(H, G, S, side, PA) {
    const me = side === 'A' ? 'p1' : 'p2', oppP = side === 'A' ? 'p2' : 'p1', O = side === 'A' ? 'B' : 'A';
    if (BREAK === 'peek') { HON.views++; return { V: S, hb: null, broken: 'peek' }; }
    const sfO = sfOf(S, O);
    const rev = PA.revealed(S, O);
    const revSheet = new Set([...rev].map(k => sfO.team[k]._solverSheet));
    const b = H.bel[me];
    b.tracker.sheets = G.sheets;               // the open sheets, as |showteam| gives them to ROTOM
    b.leads[oppP] = H.leads[oppP].slice();
    b.seen[oppP] = new Set(revSheet);
    let back = null;
    try { back = b.backTwo(oppP); if (back && back.length) HON.back_xatu++; else HON.back_none++; }
    catch (e) { HON.back_error++; if (HON.back_errors.length < 5) HON.back_errors.push(String(e.message).slice(0, 160)); }
    const V = API.clone(S);
    const map = back && back.length ? back.reduce((a, x) => (x.p > a.p ? x : a)).pair : null;
    fillHidden(V, O, G.sheets[oppP], PA.revealed(V, O), map);
    publicOpp(V, O, G.sheets[oppP], m => (revSheet.has(m._solverSheet) ? pctOf(m.curHP, m.st.hp) : null));
    HON.views++; COUNTERS.views++;
    return { V, hb: { back, spreads: H.spreads, oppP } };
  }

  return { COUNTERS, HON, applySpread, publicOpp, fillHidden, rollout, spreadPrior, pctOf, hpFromPct, truthSpreads, arenaGame, arenaView, BROKEN: BREAK || null };
}

/* THE ARENA'S TRUE SPREADS — the hidden information the honest arena hides. Drawn per team pair from a seed, both
 * sides, all six rows, by XATU's own self-play generator (solver/xatu/selfplay.js randomSpread: half the time two
 * stats at the cap and the rest in a third, half a random capped partition of 60-100% of the budget). It is NOT the
 * belief's prior (uniform per stat), so the searcher's belief is not calibrated to the truth by construction. */
function truthSpreads(sheets, seed) {
  const { randomSpread } = require('./selfplay.js');
  const R0 = rng(seed);
  return { p1: (sheets.p1 || []).map(() => randomSpread(R0)), p2: (sheets.p2 || []).map(() => randomSpread(R0)) };
}

module.exports = { create, pctOf, hpFromPct, truthSpreads, STATS, ZERO, rng };
