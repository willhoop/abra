/* solver/doduo/double_protect.js — THE DOUBLE-PROTECT SOFT GATE (Will, 2026-09-29).
 *
 *   "protecting both at the same time makes sense to stall out trick room, weather, terrain, or fake out but aside
 *    from that it doesnt really make sense."
 *
 * A joint in which BOTH of my actives click a protect-type move is MOSTLY BANNED — its prior score is multiplied by
 * `weight` (default the tiered gates' floor, 0.001), never removed — UNLESS a STALL CONDITION holds on the board:
 *
 *   trickroom  Trick Room is up (the engine's `field.tr` turns left > 0) and it favours the opponent: the mean of the
 *              opponent's live actives' speed is BELOW mine (under Trick Room the slower side moves first). Speed is the
 *              engine's own `effSpeed(m, field, side)`, never a stat read here.
 *   weather    a weather is up (`field.weatherT` > 0) that only the OPPONENT's revealed bodies could have set: an ability
 *   terrain    whose switch-in sets it, or a move that sets it, read off the Reg M-C dex (the setter's ability, its sheet
 *              ability — the pre-mega one — and its moves). A weather or terrain my own revealed bodies can also set is
 *              CONTESTED and exempts nothing (counted). "Our own weather doesn't count."
 *   tailwind   the opponent's Tailwind (`field.twA`/`twB`, relative to the side) has turns left.
 *   screen     the opponent's side carries a timed own-side condition that modifies damage (`onAnyModifyDamage`, the
 *              screens: derived, never listed) with turns left (`sf.sc[id]` > 0).
 *   fakeout    a live foe can Fake Out THIS turn: the engine's legal menu for the opponent offers it a move whose purpose
 *              is the flinch (solver/mag/purpose.js) and which the engine tags first-turn-only (`firstTurnOnly`). The
 *              engine's own first-turn condition decides, because the engine refuses the move at selection after the
 *              user's first move action (`_mvActs`).
 *   firstturn  the same engine condition for any other first-turn-only move in a foe's menu (First Impression in Reg M-C,
 *              derived from the tag). NOT on Will's list; reported as its own reason so it can be switched off.
 *   perish     a live foe carries a Perish count and none of my live actives carries a count at or below the foe's
 *              lowest: protecting advances a clock that ends the foe first. Board `_perish`; when the board does not
 *              carry it (ROTOM's world lays no Perish), the public state's `vol.perish` (ctx.pubNow).
 *   residual   a live foe loses HP at the end of the turn to something protecting does not stop: poison, toxic or burn
 *              (the board's status), Leech Seed (board `_seededBy`, or public `Leech Seed`), Salt Cure (board volatile
 *              or public), Curse (board volatile). Magic Guard and similar refusals are NOT checked (named in the report).
 *
 * EXPLICITLY NOT A STALL REASON: that the opponent can SET a field effect this turn (a Trick Room click in their menu).
 * Protecting then hands them the setup turn — the case that prompted the rule (chomp1 game 1 turn 4).
 *
 * PROTECT-TYPE is the gates' own shield predicate (solver/mag/probe.js isShield): a `stallingMove` whose target is
 * `self`, read off the dex. It includes Endure; it excludes the side guards (Wide Guard, Quick Guard), which protect the
 * pair from a class of moves and are not the user's own shield.
 *
 * ONLY MY SIDE. The gate weights the joints of the side that is deciding (side === viewer). The opponent's columns in
 * MILTANK's matrix are not touched: a human's double Protect stays in the opponent model at the prior's weight.
 *
 * THE SINGLE-SLOT PROTECT AND THE REPEAT-PROTECT ROLL ARE UNCHANGED: a joint with one protect is never weighted here, and
 * the consecutive-use die is the engine's (MILTANK's playouts roll it).
 *
 * COUNTERS (a capability that cannot prove it ran is assumed broken): calls, decisions offering a double protect, the
 * joints weighted, decisions where it FIRED (weighted at least one joint), decisions EXEMPT by reason (a decision may
 * carry several reasons), contested fields, the public-state reads, and how often the prior's own top joint was a
 * double protect that the gate demoted.
 *
 * DELIBERATE BREAKS (env GATE_BREAK), each must turn solver/tests/test-double-protect.js red:
 *   dpnoexempt  the stall conditions are never read: every double protect is weighted
 *   dpoff       the gate never weights anything
 *   dpanyfield  any field timer exempts, whoever it favours (our own weather counts)
 *   dpsheetfo   Fake Out on the foe's sheet exempts whether or not the engine offers it this turn
 */
'use strict';
const PR = require('../mag/probe.js');
const PU = require('../mag/purpose.js');
const BREAK = (typeof process !== 'undefined' && process.env && process.env.GATE_BREAK) || '';
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const live = m => !!(m && !m.fainted && m.curHP > 0);

let SETTERS = null;
/* { abilityWeather: Map(abilityId -> dex weather id), abilityTerrain, moveWeather: Map(moveId -> weather), moveTerrain, screens: Set(sideCondition id) }
 * read off the Reg M-C dex, filtered to the regulation */
function setters() {
  if (SETTERS) return SETTERS;
  const D = require('../human/dex.js').D;
  const legal = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
  const S = { abilityWeather: new Map(), abilityTerrain: new Map(), moveWeather: new Map(), moveTerrain: new Map(), screens: new Set() };
  for (const a of D.abilities.all().filter(legal)) {
    const src = String(a.onStart || '') + String(a.onSwitchIn || '');
    const w = /setWeather\(\s*['"](\w+)['"]/.exec(src), t = /setTerrain\(\s*['"](\w+)['"]/.exec(src);
    if (w) S.abilityWeather.set(a.id, toID(w[1]));
    if (t) S.abilityTerrain.set(a.id, toID(t[1]));
  }
  for (const m of D.moves.all().filter(legal)) {
    if (m.weather) S.moveWeather.set(m.id, toID(m.weather));
    if (m.terrain) S.moveTerrain.set(m.id, toID(m.terrain));
    if (m.sideCondition && m.target === 'allySide') {
      const c = D.conditions.get(m.sideCondition);
      if (c && c.duration > 1 && typeof c.onAnyModifyDamage === 'function') S.screens.add(toID(m.sideCondition));
    }
  }
  SETTERS = S;
  return S;
}

function create(API, opts) {
  opts = opts || {};
  const M = API.M;
  const WEIGHT = opts.weight == null ? 1e-3 : opts.weight;
  const OFF = new Set(opts.exemptOff || []);          // diagnostics: exemptions switched off by name
  const COUNTERS = { calls: 0, offered: 0, jointsWeighted: 0, fired: 0, exempt: 0, topDemoted: 0,
    by: { trickroom: 0, weather: 0, terrain: 0, tailwind: 0, screen: 0, fakeout: 0, firstturn: 0, perish: 0, residual: 0 },
    contested: { weather: 0, terrain: 0 }, pubReads: 0, weight: WEIGHT, exemptOff: [...OFF] };

  const isProtect = o => !!(o && o.kind === 'move' && !o.forced && PR.isShield(o));
  const isDouble = j => !!(j && j.length >= 2 && isProtect(j[0]) && isProtect(j[1]));

  const acts = (S, sd) => (sd === 'A' ? S.actA : S.actB);
  const sfOf = (S, sd) => (sd === 'A' ? S.sfA : S.sfB);
  const pOf = sd => (sd === 'A' ? 'p1' : 'p2');
  function revealedBodies(S, sd) {
    const team = sfOf(S, sd).team || [], act = acts(S, sd);
    return team.filter(m => m && (act.includes(m) || m.fainted || m.curHP <= 0 || m._wasOut));
  }
  /* the engine ids of weather/terrain a body could set: its ability now, its sheet ability, its moves */
  function canSet(ctx, sd, m, kind) {
    const T = setters();
    const out = new Set();
    const abil = [toID(m.ability)];
    const sheet = ctx && ctx.G && ctx.G.sheets && ctx.G.sheets[pOf(sd)];
    const row = sheet && m._solverSheet != null ? sheet[m._solverSheet] : null;
    if (row && row.ability) abil.push(toID(row.ability));
    const aMap = kind === 'weather' ? T.abilityWeather : T.abilityTerrain, mMap = kind === 'weather' ? T.moveWeather : T.moveTerrain;
    for (const a of abil) if (aMap.has(a)) out.add(aMap.get(a));
    for (const mv of (m.moves || [])) { const id = toID(mv && mv.id || mv); if (mMap.has(id)) out.add(mMap.get(id)); }
    const norm = kind === 'weather' ? (x => M.weatherId(x)) : (x => M.terrainId(x));
    return new Set([...out].map(norm).filter(Boolean));
  }
  const teamCanSet = (ctx, S, sd, kind, id) => revealedBodies(S, sd).some(m => canSet(ctx, sd, m, kind).has(id));
  const meanSpeed = (S, sd) => {
    const L = acts(S, sd).filter(live);
    if (!L.length) return null;
    return L.reduce((a, m) => a + (M.effSpeed(m, S.field, sd) | 0), 0) / L.length;
  };
  /* the public state's actives (ctx.pubNow, ROTOM's world.js; the eval harness) -> [{ vol }] or null */
  function pubActives(ctx, sd) {
    const st = ctx && ctx.pubNow;
    const side = st && st.sides && st.sides[pOf(sd)];
    if (!side) return null;
    return (side.active || []).map(i => (i == null ? null : side.mons[i])).filter(x => x && !x.fnt);
  }

  /* THE STALL CONDITIONS for `side` in S -> { reasons: [names], detail } */
  function stall(S, side, ctx) {
    const opp = side === 'A' ? 'B' : 'A';
    const f = S.field || {};
    const reasons = [], detail = {};
    const add = (r, d) => { if (OFF.has(r)) return; reasons.push(r); if (d != null) detail[r] = d; };
    const anyField = BREAK === 'dpanyfield';
    /* Trick Room */
    if ((f.tr | 0) > 0) {
      const me = meanSpeed(S, side), them = meanSpeed(S, opp);
      detail.trSpeed = { me, them, left: f.tr };
      if (anyField || (me != null && them != null && them < me)) add('trickroom', f.tr);
    }
    /* weather and terrain: whose is it */
    for (const kind of ['weather', 'terrain']) {
      const id = f[kind], left = f[kind + 'T'] | 0;
      if (!id || left <= 0) continue;
      const theirs = teamCanSet(ctx, S, opp, kind, id), mine = teamCanSet(ctx, S, side, kind, id);
      detail[kind + 'Setter'] = { id, left, theirs, mine };
      if (anyField) { add(kind, left); continue; }
      if (theirs && mine) { COUNTERS.contested[kind]++; continue; }
      if (theirs) add(kind, left);
    }
    /* Tailwind (side-bound) */
    const twOpp = (opp === 'A' ? f.twA : f.twB) | 0, twMe = (side === 'A' ? f.twA : f.twB) | 0;
    if (twOpp > 0 || (anyField && twMe > 0)) add('tailwind', twOpp || twMe);
    /* screens on the opponent's side */
    const T = setters();
    const scOf = sd => sfOf(S, sd).sc || {};
    const scr = Object.keys(scOf(opp)).filter(k => T.screens.has(toID(k)) && scOf(opp)[k] > 0);
    if (anyField) for (const k of Object.keys(scOf(side))) if (T.screens.has(toID(k)) && scOf(side)[k] > 0) scr.push(k);
    if (scr.length) add('screen', scr);
    /* Fake Out this turn: the engine's menu for the opponent */
    const foeActs = acts(S, opp);
    let fo = [], ft = [];
    const first = id => !!M.moveTagParam(id, 'firstTurnOnly');
    if (BREAK === 'dpsheetfo') {
      foeActs.forEach((m, k) => { if (live(m) && (m.moves || []).some(mv => { const id = toID(mv && mv.id || mv); return PU.purposeOf(id) === 'flinch' && first(id); })) fo.push(k); });
    } else {
      try {
        const lo = API.legalActions(S, opp);
        lo.slots.forEach((sl, k) => {
          if (!sl || !live(foeActs[k])) return;
          const mv = sl.options.filter(o => o && o.kind === 'move' && !o.forced && first(o.move));
          if (mv.some(o => PU.purposeOf(o.move) === 'flinch')) fo.push(k);
          else if (mv.length) ft.push(k + ':' + mv[0].move);
        });
      } catch (e) { detail.fakeoutError = String(e && e.message || e).slice(0, 120); }
    }
    if (fo.length) add('fakeout', fo);
    /* firstturn: any OTHER move the engine tags first-turn-only in a foe's menu this turn (the same engine condition as
     * Fake Out; in Reg M-C that is First Impression). Not on Will's list: reported separately, switchable (exemptOff). */
    if (ft.length) add('firstturn', ft);
    /* Perish: a foe's clock that ends before any of mine */
    const pubCounts = sd => { const L = pubActives(ctx, sd); if (L) COUNTERS.pubReads++; return (L || []).map(x => x.vol && typeof x.vol.perish === 'number' ? x.vol.perish : null).filter(x => x != null); };
    const boardCounts = sd => acts(S, sd).filter(live).map(m => m._perish).filter(x => x != null);
    let foeP = boardCounts(opp), myP = boardCounts(side);
    if (!foeP.length && !myP.length && ctx && ctx.pubNow) { foeP = pubCounts(opp); myP = pubCounts(side); }
    if (foeP.length) {
      const lo = Math.min(...foeP);
      if (!myP.length || Math.min(...myP) > lo) add('perish', { foe: lo, mine: myP.length ? Math.min(...myP) : null });
    }
    /* residual chip on a foe */
    const chip = [];
    foeActs.forEach((m, k) => {
      if (!live(m)) return;
      const v = m._vol || {};
      if (m.status === 'psn' || m.status === 'tox' || m.status === 'brn') chip.push(k + ':' + m.status);
      else if (m._seededBy) chip.push(k + ':leechseed');
      else if (v.saltcure) chip.push(k + ':saltcure');
      else if (v.curse) chip.push(k + ':curse');
    });
    if (!chip.length && ctx && ctx.pubNow) {
      const L = pubActives(ctx, opp);
      if (L) { COUNTERS.pubReads++; L.forEach((x, k) => { const v = x.vol || {}; if (v['Leech Seed'] != null) chip.push(k + ':leechseed(pub)'); else if (v['Salt Cure'] != null) chip.push(k + ':saltcure(pub)'); }); }
    }
    if (chip.length) add('residual', chip);
    return { reasons, detail };
  }

  /* the per-joint multiplier for `la` (side's legal joints), or null when nothing is weighted */
  function weights(ctx, S, side, viewer, la, raw) {
    COUNTERS.calls++;
    if (BREAK === 'dpoff') return null;
    if (side !== viewer) return null;
    const dbl = la.joint.map(isDouble);
    if (!dbl.some(Boolean)) return null;
    COUNTERS.offered++;
    let st = { reasons: [] };
    if (BREAK !== 'dpnoexempt') st = stall(S, side, ctx);
    if (st.reasons.length) { COUNTERS.exempt++; for (const r of new Set(st.reasons)) COUNTERS.by[r]++; return null; }
    const w = new Float64Array(la.joint.length).fill(1);
    let n = 0;
    dbl.forEach((d, i) => { if (d) { w[i] = WEIGHT; n++; } });
    COUNTERS.jointsWeighted += n; COUNTERS.fired++;
    if (raw) { let top = 0; for (let i = 1; i < raw.length; i++) if (raw[i] > raw[top]) top = i; if (dbl[top]) COUNTERS.topDemoted++; }
    return w;
  }

  return { COUNTERS, isProtect, isDouble, stall, weights, setters, WEIGHT, BROKEN: /^dp/.test(BREAK) ? BREAK : null };
}

module.exports = { create, setters };
