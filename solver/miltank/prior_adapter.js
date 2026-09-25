/* solver/miltank/prior_adapter.js — the human policy prior v0, asked about a MEDICHAM position.
 *
 * The prior (solver/prior/infer.js) was trained on the human dataset's schema: a `{game, turns}` row,
 * each turn a public state plus the actions taken. A MEDICHAM battle is a different object. This file
 * is the one translation between them, in one direction only (engine -> dataset schema), and then the
 * one translation back (prior candidate -> an option `legalActions` returned). Nothing here decides a
 * game fact: types, stats, move data are read by solver/prior/features.js from the Reg M-C dex.
 *
 *   const PA = require('./solver/miltank/prior_adapter.js').create(API, prior);
 *   const ctx = PA.newGame(G)                // G from solver/arena/teams.js; bodies carry `_solverSheet`
 *   PA.record(ctx, S, jA, jB)                // after choosing, BEFORE stepping: appends the turn to history
 *   PA.scoreJoints(ctx, S, side, viewer, la) // -> Float64Array, the prior's mass on each la.joint[i]
 *
 * THE VIEWER. What a side knows is not what its opponent knows: my own four are known to me, my
 * opponent's unrevealed back line is not. `brought_seen` is therefore built per viewer — full for the
 * viewer's own side, revealed-only for the other (a body is revealed once it has been active, fainted,
 * or switched out: `_wasOut`). A side's own switch candidates are all its live bench; an opponent's are
 * only the revealed ones, exactly as in the dataset.
 *
 * VOCABULARY. MEDICHAM names weather `rain|sun|sand|snow` and terrain `psychic|grassy|...`; the dataset
 * names them as Showdown's conditions. The map is a vocabulary translation, not a Pokemon fact, and
 * anything it does not know is COUNTED (`unmapped`) rather than guessed.
 */
'use strict';
const X = require('../human/dex.js');
const toID = X.toID;

const WEATHER = { rain: 'RainDance', sun: 'SunnyDay', sand: 'Sandstorm', snow: 'Snowscape' };
const BOOST = { at: 'atk', df: 'def', sa: 'spa', sd: 'spd', sp: 'spe' };
const SIDE = { A: 'p1', B: 'p2' };
const live = m => !!(m && !m.fainted && m.curHP > 0);

function create(API, prior) {
  const COUNTERS = { calls: 0, unmapped: {}, nullDecision: 0, optionsUnmatched: 0, optionsMatched: 0 };
  const miss = k => { COUNTERS.unmapped[k] = (COUNTERS.unmapped[k] || 0) + 1; };

  /* A BODY'S SHEET ROW IS A TAG ON THE BODY (`_solverSheet`, stamped by solver/arena/teams.js), never
   * its team index: the engine REORDERS `sf.team` when a body switches (Showdown swaps party positions
   * the same way), so an index taken at turn 1 names somebody else by turn 3. That was measured, not
   * assumed — the first version keyed on the index and the prior scored the wrong body's moves. */
  function newGame(G) {
    return { G, hist: [] };
  }
  /* DELIBERATE BREAK (env PRIOR_ADAPTER_BREAK=teamindex): the original bug — the body's CURRENT team
   * index read as if it were its sheet row. solver/tests/test-miltank.js must go red under it. */
  const BREAK = (typeof process !== 'undefined' && process.env && process.env.PRIOR_ADAPTER_BREAK) || '';
  const sheetIdx = m => {
    if (BREAK === 'teamindex' && m._sf) return m._sf.team.indexOf(m);
    if (m._solverSheet == null) throw new Error('prior_adapter: body without _solverSheet');
    return m._solverSheet;
  };
  const sf = (S, sd) => (sd === 'A' ? S.sfA : S.sfB);
  const acts = (S, sd) => (sd === 'A' ? S.actA : S.actB);
  function revealed(S, sd) {
    const team = sf(S, sd).team, act = acts(S, sd);
    const out = new Set();
    team.forEach((m, k) => { if (act.includes(m) || m.fainted || m.curHP <= 0 || m._wasOut) out.add(k); });
    return out;
  }

  function monState(m, s) {
    const hp = Math.max(0, Math.round(100 * m.curHP / m.st.hp));
    const vol = {};
    const v = m._vol || {};
    if (v.taunt) vol.Taunt = {}; if (v.encore) vol.Encore = {}; if (v.confusion) vol.confusion = {};
    if (v.perish != null) vol.perish = {};
    if (m._sub) vol.Substitute = {};
    const spec = X.D.species.get(toID(m.name));
    if (spec && spec.exists && m.types && m.types.join('/') !== spec.types.join('/')) vol.typechange = m.types.join('/');
    const boosts = {};
    for (const k in (m.boosts || {})) if (BOOST[k] && m.boosts[k]) boosts[BOOST[k]] = m.boosts[k];
    return { i: s, seen: true, species: m.name, hp, max: 100, status: m.status || null, fnt: !live(m),
             item: m.item || null, ability: m.ability || null, boosts, vol, used: [], mega: /-mega/.test(String(m.name)) };
  }

  function publicState(ctx, S) {
    const f = S.field;
    const st = { weather: null, terrain: null, pseudo: {}, sides: {} };
    if (f.weather) { if (WEATHER[f.weather]) st.weather = { name: WEATHER[f.weather] }; else miss('weather:' + f.weather); }
    if (f.terrain) {
      const t = X.D.moves.get(toID(f.terrain + 'terrain'));
      if (t && t.exists) st.terrain = { name: t.name }; else miss('terrain:' + f.terrain);
    }
    if (f.tr > 0) st.pseudo['Trick Room'] = {};
    for (const sd of ['A', 'B']) {
      const P = SIDE[sd];
      const team = sf(S, sd).team;
      const rev = revealed(S, sd);
      const mons = ctx.G.sheets[P].map((_, s) => ({ i: s, seen: false }));
      team.forEach((m, k) => { if (rev.has(k)) mons[sheetIdx(m)] = monState(m, sheetIdx(m)); });
      const cond = {};
      if ((sd === 'A' ? f.twA : f.twB) > 0) cond.Tailwind = {};
      for (const k of Object.keys(sf(S, sd).sc || {})) {
        if (!(sf(S, sd).sc[k] > 0)) continue;
        const mv = X.D.moves.get(k);
        if (mv && mv.exists) cond[mv.name] = {}; else miss('sc:' + k);
      }
      const act = acts(S, sd);
      const active = [0, 1].map(i => (act[i] && live(act[i]) ? sheetIdx(act[i]) : null));
      st.sides[P] = { mega_used: !!sf(S, sd).megaUsed, conditions: cond, active, mons };
    }
    return st;
  }

  /* what the dataset calls an action, from an API joint */
  function toDatasetActions(ctx, S, sd, joint) {
    const out = {}; const team = sf(S, sd).team;
    acts(S, sd).forEach((m, i) => {
      const o = joint && joint[i]; const pos = i === 0 ? 'a' : 'b';
      if (!o || !live(m)) return;
      const mon = sheetIdx(m);
      if (o.kind === 'switch') out[pos] = { kind: 'switch', to: sheetIdx(team[o.to]), mon };
      else if (o.forced) out[pos] = { kind: 'locked', move: o.move, mon };
      else if (o.kind === 'move') out[pos] = { kind: 'move', move: o.move, target_loc: o.target, mega: !!o.mega, mon };
    });
    return out;
  }

  function record(ctx, S, jA, jB) {
    ctx.hist.push({ n: S.turn + 1, state: publicState(ctx, S),
                    actions: { p1: toDatasetActions(ctx, S, 'A', jA), p2: toDatasetActions(ctx, S, 'B', jB) } });
  }

  function row(ctx, S, viewer) {
    const G = ctx.G;
    const bs = {};
    for (const sd of ['A', 'B']) {
      const P = SIDE[sd];
      const team = sf(S, sd).team;
      if (sd === viewer) bs[P] = team.map(sheetIdx);
      else { const rev = revealed(S, sd); bs[P] = team.filter((_, k) => rev.has(k)).map(sheetIdx); }
    }
    const game = { sheets: G.sheets, teamsize: { p1: 4, p2: 4 }, brought_seen: bs };
    const turns = ctx.hist.concat([{ n: S.turn + 1, state: publicState(ctx, S), actions: { p1: {}, p2: {} } }]);
    return { game, turns };
  }

  /* the prior's candidate for an API option, or -1 */
  function matchOption(slotD, o, k, sheetToTeam) {
    if (!slotD) return -1;
    const C = slotD.cands;
    if (o.kind === 'switch') return C.findIndex(c => c.attr.sw && sheetToTeam[c.attr.to] === o.to);
    if (o.kind !== 'move' || o.forced) return -1;
    const mega = o.mega ? 1 : 0;
    let tc = 4;
    if (o.target === 1) tc = 0; else if (o.target === 2) tc = 1;
    else if (o.target != null) tc = (o.target === -(k + 1)) ? 3 : 2;
    let i = C.findIndex(c => !c.attr.sw && c.attr.mv === o.move && c.attr.mega === mega && c.attr.tc === tc);
    if (i < 0 && !o.empty) i = C.findIndex(c => !c.attr.sw && c.attr.mv === o.move && c.attr.mega === mega && c.attr.tc === 4);
    return i;
  }

  /* prior mass on each joint of `la` (legalActions(S, side)) as seen by `viewer`. Unmatched options
   * get no mass; a joint the prior cannot see at all gets a floor far below any matched joint, so the
   * ranking still orders it last and a caller can tell (`p < 1e-12`). */
  function scoreJoints(ctx, S, side, viewer, la) {
    COUNTERS.calls++;
    const P = SIDE[side];
    const r = prior.predict(row(ctx, S, viewer), ctx.hist.length, P);
    const out = new Float64Array(la.joint.length);
    if (!r) { COUNTERS.nullDecision++; out.fill(1 / la.joint.length); return out; }
    const d = r.decision;
    const sheetToTeam = {}; sf(S, side).team.forEach((m, k) => { sheetToTeam[sheetIdx(m)] = k; });
    const cellP = new Map(); for (const c of r.cells) cellP.set(c.a + ',' + c.b, c.p);
    const memo = la.slots.map(() => new Map());
    la.joint.forEach((j, n) => {
      const idx = [0, 0];
      let matched = true;
      for (let k = 0; k < 2; k++) {
        const o = j[k];
        const slotD = d.slots[k];
        if (!slotD) { idx[k] = 0; continue; }            // the prior has no decision here: one dummy row
        if (!o || o.kind === 'pass' || o.forced) { idx[k] = -2; continue; }
        let m = memo[k].get(o);
        if (m === undefined) { m = matchOption(slotD, o, k, sheetToTeam); memo[k].set(o, m); if (m < 0) COUNTERS.optionsUnmatched++; else COUNTERS.optionsMatched++; }
        if (m < 0) { matched = false; break; }
        idx[k] = m;
      }
      if (!matched) { out[n] = 1e-15; return; }
      /* a forced / pass slot while the prior enumerated choices there: use that slot's marginal-free sum */
      if (idx[0] === -2 || idx[1] === -2) {
        let s = 0;
        for (const c of r.cells) if ((idx[0] === -2 || c.a === idx[0]) && (idx[1] === -2 || c.b === idx[1])) s += c.p;
        out[n] = s || 1e-15; return;
      }
      out[n] = cellP.get(idx[0] + ',' + idx[1]) || 1e-15;
    });
    return out;
  }

  /* THE PRIOR'S CELL FOR EACH JOINT (self-play targets, solver/mew). For each of `joints` (API joints for
   * `side`, as seen by `viewer`), the (a, b) candidate indices of the prior's decision — the same match
   * scoreJoints uses — or null when a slot is forced / passing while the prior enumerated choices there, or
   * an option matches no candidate. An absent prior slot is index 0 (the trainer's one null candidate).
   * The candidate KEYS ride along so a later re-featurisation can prove it rebuilt the same candidates.
   * Reads only; counts nothing into COUNTERS (the search's counters stay the search's). */
  function jointCells(ctx, S, side, viewer, joints) {
    const r = prior.predict(row(ctx, S, viewer), ctx.hist.length, SIDE[side]);
    if (!r) return null;
    const d = r.decision;
    const sheetToTeam = {}; sf(S, side).team.forEach((m, k) => { sheetToTeam[sheetIdx(m)] = k; });
    const cells = joints.map(j => {
      const idx = [0, 0];
      for (let k = 0; k < 2; k++) {
        const o = j[k], slotD = d.slots[k];
        if (!slotD) continue;
        if (!o || o.kind === 'pass' || o.forced) return null;
        const m = matchOption(slotD, o, k, sheetToTeam);
        if (m < 0) return null;
        idx[k] = m;
      }
      return idx;
    });
    const key = (k, i) => (d.slots[k] ? d.slots[k].cands[i].key : null);
    return { cells, keys: cells.map(c => (c ? [key(0, c[0]), key(1, c[1])] : null)),
             n: [d.slots[0] ? d.slots[0].cands.length : 1, d.slots[1] ? d.slots[1].cands.length : 1] };
  }

  return { COUNTERS, newGame, record, row, publicState, scoreJoints, jointCells, revealed, sheetIdx, BROKEN: BREAK || null };
}

module.exports = { create };
