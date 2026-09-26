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
 *     lines    the room's public protocol lines so far (ROTOM's B.lines), for the consecutive-Protect counter; absent =
 *              no counter laid, and COUNTERS.stallNoLines says so
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
 *   the consecutive-Protect counter (2026-09-26, docs/_reports/2026-09-26-protect-overuse.md): with `lines` (the room's
 *          public protocol so far) every body's `tookProtectTurns` is laid from the log — see stallStreaks below. Before
 *          this the world carried none, so a SECOND Protect looked as safe as the first to every playout.
 *   NOT laid on: PP, sleep/toxic counters, the other volatiles (Substitute, Taunt, Encore, confusion, Leech Seed, Perish),
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

/* THE CONSECUTIVE-PROTECT COUNTER, READ OFF THE PUBLIC LOG (2026-09-26, docs/_reports/2026-09-26-protect-overuse.md).
 *
 * The rule is Showdown's `stall` volatile (pokemon-showdown-mc data/conditions.ts, printed by
 * solver/tests/probe_protect_repeat.js): a SUCCESSFUL protect-family use adds or restarts it (the counter
 * triples) and refreshes `duration: 2`; a lost roll deletes it; a turn with no successful use lets it lapse. So at the
 * start of a turn a body's counter is the length of its unbroken run of successful uses ending on the last closed
 * turn. MEDICHAM holds that as `tookProtectTurns` (engine/medicham2-browser.js `_stallRoll`, `_stallExpire`).
 *
 * What the log shows. A use is the user's own `|move|` line of a protect-family move (solver/arena/protect_stats.js,
 * derived from the format); it SUCCEEDED when the protect condition announces itself on the user before that user's
 * next line — `|-singleturn|<user>|…` (the onStart / onSideStart of every family member, data/moves.ts). A turn is the
 * block between two `|turn|` lines; the block still open counts as closed once it reaches `|upkeep|` (a replacement
 * request after the residual). A body that leaves the field (switched, dragged, fainted) loses the volatile.
 * Bodies are keyed by side and nickname, then mapped to sheet rows by the sheet's nickname.
 *   stallStreaks(lines, sheets) -> Map('p1:<sheet row>' -> n >= 1)
 * DELIBERATE BREAK (env ROTOM_WORLD_BREAK=nostall): the map comes back empty — the pre-fix world.
 * solver/tests/test-rotom-world-stall.js must go red under it. */
const WORLD_BREAK = (typeof process !== 'undefined' && process.env && process.env.ROTOM_WORLD_BREAK) || '';
function stallStreaks(lines, sheets) {
  const FAM = require('../arena/protect_stats.js').family();
  const out = new Map();
  if (WORLD_BREAK === 'nostall') return out;
  const identKey = id => { const m = /^(p[12])[ab]?:\s?(.*)$/.exec(String(id || '').trim()); return m ? m[1] + ':' + m[2] : null; };
  const streak = new Map();          // body key -> run length ending on the last closed turn
  let succ = new Set(), pending = new Set(), used = false, upkeep = false;
  const close = () => {
    for (const k of [...streak.keys()]) if (!succ.has(k)) streak.delete(k);
    for (const k of succ) streak.set(k, (streak.get(k) || 0) + 1);
    succ = new Set(); pending = new Set(); used = false; upkeep = false;
  };
  const leave = k => { if (!k) return; streak.delete(k); succ.delete(k); pending.delete(k); };
  const posOcc = new Map();          // 'p1a' -> body key
  for (const raw of lines || []) {
    const p = String(raw).split('|');
    const cmd = p[1];
    if (cmd === 'turn') { if (used) close(); else { succ = new Set(); pending = new Set(); } used = true; continue; }
    if (cmd === 'upkeep') { upkeep = true; continue; }
    if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
      const pos = /^(p[12][ab]?)/.exec(p[2] || ''); const k = identKey(p[2]);
      if (pos) { leave(posOcc.get(pos[1])); posOcc.set(pos[1], k); }
      leave(k); continue;
    }
    if (cmd === 'faint') { leave(identKey(p[2])); continue; }
    if (cmd === 'move') {
      const k = identKey(p[2]);
      pending.delete(k);
      const mv = X.D.moves.get(toID(p[3]));
      if (k && mv && mv.exists && FAM.has(mv.id)) pending.add(k);
      continue;
    }
    if (cmd === '-singleturn') { const k = identKey(p[2]); if (pending.has(k)) { succ.add(k); pending.delete(k); } continue; }
    if (cmd === 'cant') { pending.delete(identKey(p[2])); continue; }
  }
  if (upkeep) close();
  for (const [k, n] of streak) {
    const [side, nick] = [k.slice(0, 2), k.slice(3)];
    const i = ((sheets && sheets[side]) || []).findIndex(r => r && r.nick === nick);
    if (i >= 0 && n > 0) out.set(side + ':' + i, n);
  }
  return out;
}

function create(API) {
  const M = API.M;
  const COUNTERS = { built: 0, failed: 0, megaApplied: 0, megaFailed: 0, mineUnmatched: 0, oppGuessUsed: 0, oppFilledBlind: 0,
                     stallLaid: 0, stallNoLines: 0 };

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
    /* THE SLOTS KEEP THEIR PLACES. An opposing slot left empty by a faint the opponent could not refill must stay
     * empty in ITS position: compacting the survivors moved a slot-b body into slot a, so a move aimed at slot b
     * (target 2) landed on the empty side of this world (found by solver/doduo/eval_gates.js, 2026-09-25). The
     * empty slot is held by the fainted body the log last saw there (`pos`), else by any fainted revealed body. */
    const act = [];
    for (let k = 0; k < (os.active || []).length; k++) {
      const i = os.active[k];
      if (i != null) { act.push(i); continue; }
      const posName = k === 0 ? 'a' : 'b';
      const fnt = os.mons.filter(m => m.seen && m.fnt && !(os.active || []).includes(m.i) && !act.includes(m.i));
      const hold = fnt.find(m => m.pos === posName) || fnt[0];
      if (hold) act.push(hold.i);
    }
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

    /* ---- came in this turn: first-turn-only moves (Fake Out) read the MOVE-ACTION count `_mvActs` (the engine's
     * mirror of Showdown's activeMoveActions, zeroed on switch-in; engine/medicham2-browser.js firstTurnOnlyRefused),
     * and `_turnsOut` is kept with it. A body active at the start of the previous turn has had its move action; a body
     * that came in since (a switch, a pivot, a replacement) has not. */
    const prevTurn = turns.length >= 2 ? turns[turns.length - 2] : null;
    const prev = prevTurn ? prevTurn.state : null;
    /* A BODY THAT LEFT AND CAME BACK INSIDE THE LAST TURN IS NEW. Active at the start of both turns is not enough: a
     * body switched out and brought back in the same turn (a Parting Shot or U-turn partner's pivot, a faint
     * replacement) has a fresh move-action count, so its first-turn-only moves are selectable again. Found by
     * solver/doduo/eval_gates.js (2026-09-25): two human Fake Out / First Impression clicks the world refused. */
    const cameBack = (p, s) => !!prevTurn && ([].concat(prevTurn.midturn_switches || [], prevTurn.replacements || [])
      .some(x => x && x.side === p && x.to === s));
    for (const [p, list] of [[me, mine.map(x => ({ b: x.b, s: x.s }))], [opp, theirs.map(x => ({ b: x.b, s: x.s }))]]) {
      const was = prev && prev.sides[p] ? prev.sides[p].active || [] : [];
      const now = (st.sides[p] && st.sides[p].active) || [];
      for (const x of list) {
        const stayed = turnN > 1 && was.includes(x.s) && now.includes(x.s) && !cameBack(p, x.s);
        x.b._turnsOut = stayed ? 1 : 0;
        x.b._mvActs = stayed ? 1 : 0;
      }
    }

    /* ---- what the log shows about each body's own recent clicks (2026-09-25, docs/_reports/2026-09-25-mag-doduo-gates.md).
     * Three engine fields a click's SUCCESS reads, which this world left at their battle-start values, so a gate asking
     * the engine "does this click fail?" was told yes where the real game said no:
     *   `_lastMove`         the body's last move since it came in (Encore and Disable fail on a target with none): the
     *                       latest turn this body was active and its action was a move; a turn it could not act keeps the
     *                       earlier one, as Showdown's lastMove does.
     *   `tookProtectTurns`  the Protect-family streak: consecutive latest turns it clicked a stalling move (read off the
     *                       move's own `stallingMove` in the dex, never a list). The log does not always show whether each
     *                       one held; counting them all can only lengthen the streak, which makes the next one likelier to
     *                       fail — the direction in which a gate keeps more, never cuts more.
     *   `_usedEntry`        the moves it clicked since this entry (Showdown's per-entry moveSlot.used, which Last Resort
     *                       reads), from the same walk back to the turn it came in.
     *   `_pp`               one PP spent on every move the log has seen this body use (`used`, the whole battle); the
     *                       count beyond one is unknown.
     * Found by solver/doduo/eval_gates.js: human Encore, Last Resort and ally-targeting clicks the world made fail. */
    const turnOf = k => turns[k];
    for (const [p, list] of [[me, mine.map(x => ({ b: x.b, s: x.s }))], [opp, theirs.map(x => ({ b: x.b, s: x.s }))]]) {
      const now = (st.sides[p] && st.sides[p].active) || [];
      for (const x of list) {
        if (!now.includes(x.s)) continue;
        let last = null, streak = 0, streakOpen = true;
        const stint = new Set();
        for (let k = turns.length - 2; k >= 0; k--) {
          const T0 = turnOf(k);
          const act = (T0.state.sides[p] && T0.state.sides[p].active) || [];
          if (!act.includes(x.s)) break;                                   // it came in after this turn started
          if ([].concat(T0.midturn_switches || [], T0.replacements || []).some(y => y && y.side === p && y.to === x.s)) break;   // it left and came back inside this turn
          const A = (T0.actions && T0.actions[p]) || {};
          const a = [A.a, A.b].find(y => y && y.mon === x.s);
          const mv = a && (a.kind === 'move' || a.kind === 'locked') && a.move ? X.D.moves.get(toID(a.move)) : null;
          if (streakOpen) { if (mv && mv.exists && mv.stallingMove && a.executed !== false) streak++; else streakOpen = false; }
          if (mv && mv.exists) { if (!last) last = mv.id; stint.add(mv.id); }
          if (a && a.kind === 'switch') break;
        }
        if (last) x.b._lastMove = last;
        /* the counter is laid EXACTLY from the protocol below when the log is given (stallStreaks); this approximation
         * (every stalling click counted, held or not) stands only for a build without the log */
        if (streak && !o.lines) x.b.tookProtectTurns = streak;
        /* `_usedEntry`: the moves clicked since this entry (Showdown's per-entry moveSlot.used; Last Resort reads it) */
        if (stint.size) { x.b._usedEntry = x.b._usedEntry || {}; for (const id of stint) x.b._usedEntry[id] = true; }
      }
      const monsPub = (st.sides[p] && st.sides[p].mons) || [];
      for (const x of list) {
        const pub = monsPub[x.s];
        for (const u of (pub && pub.used) || []) {
          const id = toID(u);
          if (!(x.b.moves || []).includes(id)) continue;
          const pp = M.moveTagParam(id, 'pp');
          if (!pp || !(+pp.max > 0)) continue;
          x.b._pp = x.b._pp || {};
          if (!(id in x.b._pp)) x.b._pp[id] = +pp.max - 1;
        }
      }
    }

    /* ---- the consecutive-Protect counter, EXACT, from the public log (stallStreaks above; 2026-09-26). It overrides the
     * walk above: that walk counts every stalling click, held or not, and misses the side guards that feed the counter;
     * a failed Protect deletes the volatile (the next one is 100% again) and a Wide Guard triples it. Checked against
     * the engine's own counter by solver/tests/test-rotom-world-stall.js. ---- */
    if (o.lines) {
      const st2 = stallStreaks(o.lines, sheets);
      for (const [p, list] of [[me, mine], [opp, theirs]]) for (const x of list) {
        const n = st2.get(p + ':' + x.s) || 0;
        x.b.tookProtectTurns = live(x.b) ? n : 0; x.b._stallFresh = false;
        if (n && live(x.b)) COUNTERS.stallLaid++;
      }
    } else COUNTERS.stallNoLines++;

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

module.exports = { create, duration, parseCond, stallStreaks };
