/* solver/rotom/world.js — a MEDICHAM position built from what a live client OBSERVES.
 *
 *   const WB = require('./world.js').create(API);
 *   const w = WB.build({ row, sheets, me, req, oppGuess });
 *     row      the room's public log so far through solver/human/parse_game.js (the dataset schema the prior was
 *              trained on): row.turns[last].state is the public state before the decision, row.turns[..-1] history
 *     sheets   { p1: [6 sheet rows], p2: [6] } from the |showteam| lines (open team sheets, Force OTS in bo3)
 *     me       'p1' | 'p2'
 *     req      this decision's |request| JSON (my side, EXACT: HP, stats, item, who is active, who was brought)
 *     oppGuess sheet indices to fill the opponent's unrevealed back line (XATU's MAP back pair), or null
 *   -> { S, side: 'A'|'B', ctx, posOfTeam(teamIdx) -> request position (1-based), notes: [...] }
 *
 * THE SOLVER'S OWN WORLD BUILDERS. Bodies come from solver/arena/teams.js `buildBody` (the arena's builder: the
 * engine's table row by species, the sheet's moves/item/ability laid on, stones kept) and carry `_solverSheet` like
 * every arena body, so solver/miltank/prior_adapter.js, rollout.js `sampleWorld` and search.js read them unchanged.
 * The battle is `API.newBattle(..., { seeded: true })` — the literal seeded board: no entry pass, so an Intimidate
 * that already fired is not fired again — and then the observed state is laid on.
 *
 * SIDES. My MEDICHAM side is my Showdown side (p1 = A, p2 = B), so the parsed history (sheet rows keyed p1/p2)
 * is the prior adapter's history with no relabelling.
 *
 * WHAT IS LAID ON (and what is not — v0 fidelity, stated in docs/_reports/2026-09-24-rotom-v0.md):
 *   mine:  who is active and in which slot, the four brought (request order), exact HP and max HP, the request's
 *          stat line, item, status, boosts, fainted, mega forme.
 *   theirs: revealed bodies at their public HP % (never rounded to a faint), status, boosts, item removal, fainted,
 *          mega forme, `_wasOut` (revealed); unrevealed back line from `oppGuess` (the search redraws it per world).
 *   field: weather, terrain, Trick Room, Tailwind, screens and the other side conditions the engine names, with the
 *          turns left computed from the DEX's own duration (Dex.forFormat — not a typed 5 or 4) minus turns elapsed.
 *   NOT laid on: PP, sleep/toxic counters, volatiles (Substitute, Taunt, Encore, confusion, Leech Seed, Perish),
 *          Choice locks on the opponent, stat-changing items already used, turns-out beyond "came in this turn".
 *   The request, not this world, decides legality; a world gap can make the SEARCH worse, never a choice invalid.
 */
'use strict';
const X = require('../human/dex.js');
const T = require('../arena/teams.js');
const toID = X.toID;

const WEATHER_OF = { raindance: 'rain', sunnyday: 'sun', sandstorm: 'sand', snowscape: 'snow', snow: 'snow', hail: 'snow' };   // vocabulary (prior_adapter.js WEATHER, inverted)
const BOOST_OF = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp', accuracy: 'acc', evasion: 'eva' };
const live = m => !!(m && !m.fainted && m.curHP > 0);

/* a condition's base duration, read from the regulation's dex: the condition itself, or the move that sets it */
function duration(name) {
  const id = toID(name);
  const c = X.D.conditions.get(id);
  if (c && c.exists && c.duration) return c.duration;
  const mv = X.D.moves.get(id);
  if (mv && mv.exists && mv.condition && mv.condition.duration) return mv.condition.duration;
  return null;
}
function left(name, since, turn) {
  const d = duration(name);
  if (!d) return 1;
  return Math.max(1, d - Math.max(0, (turn || 0) - (since || 0)));
}
function parseCond(s) {
  const t = String(s || '').trim();
  if (!t || /\bfnt\b/.test(t) || t.startsWith('0 ') || t === '0') return { hp: 0, max: 0, fnt: true, status: null };
  const [hpPart, st] = t.split(' ');
  const m = /^(\d+)\/(\d+)/.exec(hpPart);
  return m ? { hp: +m[1], max: +m[2], fnt: false, status: st || null } : { hp: 1, max: 1, fnt: false, status: null };
}
const baseSpecies = s => { const sp = X.D.species.get(toID(s)); return sp && sp.exists ? toID(sp.baseSpecies) : toID(s); };

function create(API) {
  const M = API.M;
  const COUNTERS = { built: 0, failed: 0, megaApplied: 0, megaFailed: 0, mineUnmatched: 0, oppGuessUsed: 0, oppFilledBlind: 0 };

  /* my request position -> my sheet row: by nickname first (the ident), then by base species */
  function mySheetIndex(sheet, p) {
    const nick = String(p.ident || '').replace(/^p[12][ab]?:\s*/, '').trim();
    let i = sheet.findIndex(r => r.nick === nick);
    if (i < 0) { const sp = baseSpecies(String(p.details || '').split(',')[0]); i = sheet.findIndex(r => baseSpecies(r.species) === sp); }
    return i;
  }

  function applyMega(S, side, m) {
    const act = side === 'A' ? S.actA : S.actB;
    let slot = act.indexOf(m), swapped = -1, saved = null;
    if (slot < 0) { swapped = 0; saved = act[0]; act[0] = m; }
    try {
      const run = () => M.megaEvolveNow(S, m, true);
      const ok = S._scope ? M.battleScopeRun(S._scope, run) : run();
      if (ok) COUNTERS.megaApplied++; else COUNTERS.megaFailed++;
    } catch (e) { COUNTERS.megaFailed++; }
    finally { if (swapped >= 0) act[swapped] = saved; }
  }

  function build(o) {
    const { row, sheets, me, req } = o;
    const opp = me === 'p1' ? 'p2' : 'p1';
    const side = me === 'p1' ? 'A' : 'B';
    const notes = [];
    const turns = row.turns || [];
    const cur = turns[turns.length - 1];
    if (!cur || !cur.state) throw new Error('world: no public state yet');
    const st = cur.state;
    const turnN = cur.n || turns.length;

    /* ---- my four, in request order (actives first) ---- */
    const reqMons = (req.side && req.side.pokemon) || [];
    const mine = [];
    for (let j = 0; j < reqMons.length; j++) {
      const s = mySheetIndex(sheets[me], reqMons[j]);
      if (s < 0) { COUNTERS.mineUnmatched++; throw new Error('world: my ' + reqMons[j].ident + ' is not on my sheet'); }
      const b = T.buildBody(M, sheets[me][s]);
      if (!b) throw new Error('world: could not build my ' + sheets[me][s].species);
      b._solverSheet = s;
      mine.push({ b, p: reqMons[j], s });
    }

    /* ---- their four: actives, the rest revealed, then the guess (never a revealed body twice) ---- */
    const os = st.sides[opp];
    const seen = os.mons.filter(m => m.seen).map(m => m.i);
    const act = (os.active || []).filter(x => x != null);
    const order = [];
    for (const i of act) if (!order.includes(i)) order.push(i);
    for (const i of seen) if (!order.includes(i)) order.push(i);
    const guess = (o.oppGuess || []).filter(i => !order.includes(i));
    for (const i of guess) if (order.length < 4) { order.push(i); COUNTERS.oppGuessUsed++; }
    for (let i = 0; order.length < 4 && i < 6; i++) if (!order.includes(i)) { order.push(i); COUNTERS.oppFilledBlind++; }
    const theirs = order.slice(0, 4).map(s => { const b = T.buildBody(M, sheets[opp][s]); if (!b) throw new Error('world: could not build their ' + sheets[opp][s].species); b._solverSheet = s; return { b, s, pub: os.mons[s] }; });

    const teamMe = mine.map(x => x.b), teamOp = theirs.map(x => x.b);
    /* an active slot the opponent has not refilled keeps its fainted body, so the slots stay aligned */
    const S = side === 'A' ? API.newBattle(teamMe, teamOp, { seeded: true }) : API.newBattle(teamOp, teamMe, { seeded: true });
    const sfMe = side === 'A' ? S.sfA : S.sfB, sfOp = side === 'A' ? S.sfB : S.sfA;
    const sideOp = side === 'A' ? 'B' : 'A';
    S.turn = Math.max(0, turnN - 1);

    /* ---- megas first (a mega keeps damage taken; the HP below is then laid on the mega's own line) ---- */
    for (const x of mine) if (/-Mega/.test(String(x.p.details || '')) && !/-mega/.test(String(x.b.name))) applyMega(S, side, x.b);
    for (const x of theirs) if (x.pub && x.pub.mega && !/-mega/.test(String(x.b.name))) applyMega(S, sideOp, x.b);
    sfMe.megaUsed = !!(st.sides[me] && st.sides[me].mega_used) || mine.some(x => /-Mega/.test(String(x.p.details || '')));
    sfOp.megaUsed = !!os.mega_used;

    /* ---- mine: exact ---- */
    for (const x of mine) {
      const m = x.b, p = x.p, c = parseCond(p.condition);
      if (p.stats) m.st = { hp: c.max || m.st.hp, at: p.stats.atk, df: p.stats.def, sa: p.stats.spa, sd: p.stats.spd, sp: p.stats.spe };
      else if (c.max) m.st = Object.assign({}, m.st, { hp: c.max });
      if (c.fnt) { m.curHP = 0; m.fainted = true; } else m.curHP = Math.max(1, Math.min(m.st.hp, c.hp));
      m.status = c.status || '';
      if (m.status === 'slp') m.slp = m.slp || 1;
      if (p.item != null) m.item = toID(p.item);
      if (p.ability) m.ability = toID(p.ability);
      const pub = st.sides[me] && st.sides[me].mons[x.s];
      if (pub && pub.boosts) for (const [k, v] of Object.entries(pub.boosts)) if (BOOST_OF[k]) m.boosts[BOOST_OF[k]] = v;
      if (pub && pub.seen) m._wasOut = true;
    }
    /* ---- theirs: public ---- */
    for (const x of theirs) {
      const m = x.b, pub = x.pub;
      if (!pub || !pub.seen) continue;
      m._wasOut = true;
      if (pub.fnt) { m.curHP = 0; m.fainted = true; }
      else m.curHP = Math.max(1, Math.min(m.st.hp, Math.ceil((pub.hp / (pub.max || 100)) * m.st.hp)));
      m.status = pub.status || '';
      if (m.status === 'slp') m.slp = m.slp || 1;
      if (pub.item === null && m.item) m.item = '';
      for (const [k, v] of Object.entries(pub.boosts || {})) if (BOOST_OF[k]) m.boosts[BOOST_OF[k]] = v;
    }
    /* fallen counts (Last Respects, Supreme Overlord) from the roster, as battleInit derives them */
    sfMe.fainted = teamMe.filter(m => !live(m)).length;
    sfOp.fainted = teamOp.filter(m => !live(m)).length;

    /* ---- came in this turn: Fake Out and first-turn moves read `_turnsOut` ---- */
    const prev = turns.length >= 2 ? turns[turns.length - 2].state : null;
    for (const [p, list] of [[me, mine.map(x => ({ b: x.b, s: x.s }))], [opp, theirs.map(x => ({ b: x.b, s: x.s }))]]) {
      const was = prev && prev.sides[p] ? prev.sides[p].active || [] : [];
      for (const x of list) x.b._turnsOut = (turnN > 1 && was.includes(x.s)) ? 1 : 0;
    }

    /* ---- field ---- */
    const f = S.field;
    if (st.weather && st.weather.name) {
      const w = WEATHER_OF[toID(st.weather.name)];
      if (w) { f.weather = w; f.weatherT = left(st.weather.name, st.weather.since, turnN); } else notes.push('weather not mapped: ' + st.weather.name);
    }
    if (st.terrain && st.terrain.name) {
      f.terrain = toID(st.terrain.name).replace(/terrain$/, '');
      f.terrainT = left(st.terrain.name, st.terrain.since, turnN);
    }
    const pseudo = st.pseudo || {};
    if (pseudo['Trick Room'] != null) f.tr = left('trickroom', typeof pseudo['Trick Room'] === 'number' ? pseudo['Trick Room'] : pseudo['Trick Room'].since, turnN);
    if (pseudo['Gravity'] != null) f.gravity = left('gravity', typeof pseudo['Gravity'] === 'number' ? pseudo['Gravity'] : pseudo['Gravity'].since, turnN);
    for (const [p, sf, key] of [[me, sfMe, side === 'A' ? 'twA' : 'twB'], [opp, sfOp, side === 'A' ? 'twB' : 'twA']]) {
      const cond = (st.sides[p] && st.sides[p].conditions) || {};
      for (const [name, c] of Object.entries(cond)) {
        const id = toID(name);
        if (id === 'tailwind') { f[key] = left('tailwind', c.since, turnN); continue; }
        const mv = X.D.moves.get(id);
        if (mv && mv.exists) sf.sc[id] = duration(id) ? left(id, c.since, turnN) : (c.layers || 1);
        else notes.push('side condition not mapped: ' + name);
      }
    }

    COUNTERS.built++;
    const ctx = { G: { sheets }, hist: turns.slice(0, -1).map(t => ({ n: t.n, state: t.state, actions: t.actions || { p1: {}, p2: {} } })) };
    /* at build time my team order IS the request order, so team index k is request position k+1; the engine
     * reorders `sf.team` on a switch, so a caller maps through the body's sheet row, never through k later */
    const posOfSheet = new Map(mine.map((x, j) => [x.s, j + 1]));
    const posOfTeam = k => { const b = sfMe.team[k]; return b ? posOfSheet.get(b._solverSheet) : undefined; };
    return { S, side, ctx, posOfTeam, posOfSheet, mine, theirs, notes };
  }

  return { COUNTERS, build, duration, parseCond };
}

module.exports = { create, duration, parseCond };
