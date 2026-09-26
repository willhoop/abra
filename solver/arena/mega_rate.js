/* solver/arena/mega_rate.js — THE MEGA CAPABILITY COUNTER, and the human rate it is judged against.
 *
 * WHY. Mega once passed "at least one happened" while running at 56% of sides against the correct 85%
 * (CLAUDE.md, "Non-zero is not always a strong enough bar"). So mega is measured as a RATE, per bot, on the
 * sides that COULD have mega evolved, and held to a floor taken from what humans do.
 *
 * ONE DEFINITION, BOTH POPULATIONS.
 *   A side is MEGA-CAPABLE in a game when, at the START of some turn (a decision point) and before the side
 *   has mega evolved, one of its ACTIVE bodies holds the mega stone of its own species.
 *   A capable side MEGAS when it mega evolves at any point in the game.
 *   rate = megas / capable sides.  Turn = the turn number the mega happened on.
 *   Delay = mega turn − the first turn the side was capable (0 = it megaed the first turn it could).
 *
 *   Humans (solver/out/human/games.jsonl): capability is read from the sheet at `state.sides[P].active` of
 *   each turn; "mega stone of its own species" is `Dex.forFormat(...).items.get(item).megaStone[species]`,
 *   the forme filtered to the regulation (solver/human/dex.js). The mega is `actions[P][slot].mega`.
 *   Bots (MEDICHAM): capability is the engine's own `megaTargetFor(body)`, read at every decision; OFFERED
 *   (`canMegaNow`) is counted beside it; the mega is the side's `megaUsed` flag flipping over a step, and
 *   CHOSE is a joint that asked for it. A choose-without-happen or a happen-without-choose is counted.
 *
 * API.
 *   const MR = require('./mega_rate.js');
 *   const T = MR.tally();                       one per bot label
 *   const g = MR.game(API, { A: TA, B: TB }[, { trace: true }]);   per game; g.decide(S, side, joint) before the step,
 *                                               g.detail() -> per side { capable_turn, mega_turn, delay, trace } (the timing timeline),
 *                                               g.stepped(S) after it, g.end() once
 *   MR.summary(T)                               { sides, capable, offered, megas, chose, rate, ci95, turn, delay, ... }
 *   MR.humanRate(file)                          the same summary over the human dataset (one pass, ~500 MB)
 *   MR.parsedGame(parsed, me)                   one parsed battle log (solver/human/parse_game.js) -> { p1, p2, mine } (ROTOM)
 *   MR.floor(human)                             the pre-registered floor (see FLOOR below)
 *   MR.neverMega(bot)                           DELIBERATE BREAK: a bot whose every mega is stripped
 */
'use strict';
const fs = require('fs');

function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [+((c - h) / d).toFixed(4), +((c + h) / d).toFixed(4)];
}

function tally() {
  return { sides: 0, capable: 0, offered: 0, megas: 0, chose: 0, chose_not_happened: 0, happened_not_chose: 0,
           mega_not_capable: 0, turn: {}, delay: {} };
}
const bump = (h, k) => { h[k] = (h[k] || 0) + 1; };

function summary(T) {
  if (!T) return null;
  const rate = T.capable ? +(T.megas / T.capable).toFixed(4) : null;
  const q = (h, f) => { const ks = Object.keys(h).map(Number).sort((a, b) => a - b); const n = ks.reduce((s, k) => s + h[k], 0);
    let c = 0; for (const k of ks) { c += h[k]; if (c >= f * n) return k; } return null; };
  const mean = h => { const n = Object.values(h).reduce((s, v) => s + v, 0); return n ? +(Object.entries(h).reduce((s, [k, v]) => s + k * v, 0) / n).toFixed(2) : null; };
  const share = (h, k) => { const n = Object.values(h).reduce((s, v) => s + v, 0); return n ? +((h[k] || 0) / n).toFixed(4) : null; };
  return Object.assign({}, T, {
    rate, ci95: wilson(T.megas, T.capable),
    capable_share: T.sides ? +(T.capable / T.sides).toFixed(4) : null,
    turn_mean: mean(T.turn), turn_p50: q(T.turn, 0.5), turn_p90: q(T.turn, 0.9), turn1_share: share(T.turn, 1),
    delay_mean: mean(T.delay), delay0_share: share(T.delay, 0),
  });
}

/* one game's bookkeeping for two sides; each side folds into its own bot's tally */
/* opts.trace: per side, a TIMELINE from the first capable decision to the mega (at most TRACE_MAX entries), in the
 * shape solver/arena/mega_timing.js classifies for humans and bots alike:
 *   { t, field: { weather, terrain, trickroom }, mons: [{ id, species, ability, stone, boosts }], act: [{ kind, move, mega }] }
 * Read with g.detail() after g.end(). Counters only: nothing here changes a decision. */
const TRACE_MAX = 12;
function game(API, tallies, opts) {
  const M = API.M;
  const TRACE = !!(opts && opts.trace);
  const st = {};
  for (const sd of ['A', 'B']) st[sd] = { T: tallies[sd], capableTurn: null, offered: false, chose: false, megaTurn: null, notCapable: false, turnOfLastDecision: null, trace: TRACE ? [] : null, megaSlot: null, megaId: null };
  const sfOf = (S, sd) => (sd === 'A' ? S.sfA : S.sfB);
  const actsOf = (S, sd) => (sd === 'A' ? S.actA : S.actB);
  const live = m => !!(m && !m.fainted && m.curHP > 0);
  return {
    decide(S, sd, joint) {
      const s = st[sd]; if (!s) return;
      const turn = S.turn + 1;                   // the turn this decision is for (S.turn counts turns completed)
      s.turnOfLastDecision = turn;
      if (sfOf(S, sd).megaUsed) return;
      for (const m of actsOf(S, sd)) {
        if (!live(m)) continue;
        if (M.megaTargetFor(m) && s.capableTurn == null) s.capableTurn = turn;
        if (M.canMegaNow(S, m)) s.offered = true;
      }
      if (joint && joint.some(o => o && o.mega)) s.chose = true;
      if (TRACE && s.capableTurn != null && s.trace.length < TRACE_MAX) {
        const F = S.field || {};
        const acts = actsOf(S, sd);
        s.trace.push({ t: turn, field: { weather: F.weather || null, terrain: F.terrain || null, trickroom: !!F.tr },
          mons: acts.map(m => (live(m) ? { id: m._ident != null ? String(m._ident) : m.name, species: m.name, ability: m.ability || null,
            stone: M.megaTargetFor(m) || null, boosts: Object.assign({}, m.boosts || {}) } : null)),
          act: (joint || []).map(o => (o ? { kind: o.kind, move: o.move || null, mega: !!o.mega } : null)) });
        const mi = (joint || []).findIndex(o => o && o.mega);
        if (mi >= 0 && s.megaSlot == null) { s.megaSlot = mi; const m = acts[mi]; s.megaId = m ? (m._ident != null ? String(m._ident) : m.name) : null; }
      }
    },
    stepped(S) {
      for (const sd of ['A', 'B']) {
        const s = st[sd];
        if (s.megaTurn == null && sfOf(S, sd).megaUsed) { s.megaTurn = s.turnOfLastDecision != null ? s.turnOfLastDecision : S.turn; if (s.capableTurn == null) s.notCapable = true; }
      }
    },
    detail() {
      const o = {};
      for (const sd of ['A', 'B']) { const s = st[sd]; o[sd] = { capable_turn: s.capableTurn, mega_turn: s.megaTurn, delay: s.capableTurn != null && s.megaTurn != null ? s.megaTurn - s.capableTurn : null,
        mega_slot: s.megaSlot, mega_id: s.megaId, trace: s.trace }; }
      return o;
    },
    end() {
      for (const sd of ['A', 'B']) {
        const s = st[sd], T = s.T; if (!T) continue;
        T.sides++;
        if (s.notCapable) T.mega_not_capable++;
        if (s.capableTurn == null) continue;
        T.capable++;
        if (s.offered) T.offered++;
        if (s.chose) T.chose++;
        if (s.megaTurn != null) { T.megas++; bump(T.turn, s.megaTurn); bump(T.delay, s.megaTurn - s.capableTurn); }
        if (s.chose && s.megaTurn == null) T.chose_not_happened++;
        if (!s.chose && s.megaTurn != null) T.happened_not_chose++;
      }
    },
  };
}

/* DELIBERATE BREAK: the same bot with every mega request stripped (the move and target stay; the non-mega
 * option is always legal beside its mega twin in legalActions). A test that stays green on this is blind. */
function neverMega(bot) {
  return Object.assign({}, bot, { name: bot.name + '+nevermega', async choose(S, side, ctx) {
    const c = await bot.choose(S, side, ctx);
    if (c && c.joint && c.joint.some(o => o && o.mega)) return Object.assign({}, c, { joint: c.joint.map(o => (o && o.mega ? Object.assign({}, o, { mega: false, choice: String(o.choice || '').replace(/ mega$/, '') }) : o)) });
    return c;
  } });
}

/* ---- a parsed game (the human dataset's shape: solver/human/parse_game.js) ----------------------- */
let _megaOf = null;
/* the mega forme a sheet row's item turns its species into, if legal in the regulation; else null.
 * Read from Dex.forFormat on the Reg M-C checkout (solver/human/dex.js), never typed. */
function megaOfRow() {
  if (_megaOf) return _megaOf;
  const X = require('../human/dex.js');
  const D = X.D;
  const stoneCache = new Map();
  return (_megaOf = row => {
    if (!row || !row.item) return null;
    const key = row.species + '|' + row.item;
    if (stoneCache.has(key)) return stoneCache.get(key);
    const it = D.items.get(row.item);
    let f = null;
    if (it && it.exists && it.megaStone) {
      const sp = D.species.get(row.species);
      const tgt = it.megaStone[sp.name] || it.megaStone[row.species];
      if (tgt && X.legal(D.species.get(tgt))) f = D.species.get(tgt).name;
    }
    stoneCache.set(key, f);
    return f;
  });
}
/* one side of one parsed game -> { capable, capable_turn, mega, mega_turn, delay, mega_mon_has_stone } */
function parsedSide(g, turns, P) {
  const megaOf = megaOfRow();
  const sheet = (g.sheets && g.sheets[P]) || [];
  let capableTurn = null, megaTurn = null, megaMon = null;
  for (const t of turns || []) {
    const sd = t.state && t.state.sides && t.state.sides[P];
    if (megaTurn == null && sd && !sd.mega_used && capableTurn == null) {
      for (const i of sd.active || []) if (i != null && megaOf(sheet[i]) && !(sd.mons[i] && sd.mons[i].fnt)) { capableTurn = t.n; break; }
    }
    const acts = t.actions && t.actions[P];
    if (megaTurn == null && acts) for (const k of ['a', 'b']) if (acts[k] && acts[k].mega) { megaTurn = t.n; megaMon = acts[k].mon; }
  }
  return { capable: capableTurn != null, capable_turn: capableTurn, mega: megaTurn != null, mega_turn: megaTurn,
           delay: capableTurn != null && megaTurn != null ? megaTurn - capableTurn : null,
           mega_mon_has_stone: megaTurn == null ? null : !!megaOf(sheet[megaMon]) };
}
/* ROTOM's per-game record: both sides of a game it played, parsed from its own copy of the battle log */
function parsedGame(parsed, me) {
  if (!parsed || !parsed.game) return null;
  const out = { definition: 'capable = a stone holder of its own species active at the start of a turn before the side megaed (solver/arena/mega_rate.js)' };
  for (const P of ['p1', 'p2']) out[P] = parsedSide(parsed.game, parsed.turns, P);
  if (me) out.mine = out[me];
  return out;
}

/* ---- the human rate ---------------------------------------------------------------------------- */
function humanRate(file, opts) {
  opts = opts || {};
  const megaOf = megaOfRow();
  const T = tally(), Tseen = tally();
  const extra = { games: 0, sides_with_stone_on_sheet: 0, sides_with_stone_brought_seen: 0, megas_seen_on_mon_without_stone: 0,
                  by_rating: {}, by_end: {}, forms: {} };
  const fd = fs.openSync(file, 'r'); const chunk = Buffer.alloc(1 << 22);
  let buf = '', pos = 0;
  const each = line => {
    const { game: g, turns } = JSON.parse(line);
    extra.games++;
    for (const P of ['p1', 'p2']) {
      const sheet = g.sheets[P] || [];
      if (sheet.some(r => megaOf(r))) extra.sides_with_stone_on_sheet++;
      const seenCap = (g.brought_seen[P] || []).some(i => megaOf(sheet[i]));
      if (seenCap) extra.sides_with_stone_brought_seen++;
      const ps = parsedSide(g, turns, P);
      const capableTurn = ps.capable_turn, megaTurn = ps.mega_turn;
      if (ps.mega_mon_has_stone === false) extra.megas_seen_on_mon_without_stone++;
      for (const [TT, cap] of [[T, capableTurn != null], [Tseen, seenCap]]) {
        TT.sides++;
        if (!cap) { if (megaTurn != null) TT.mega_not_capable++; continue; }
        TT.capable++;
        if (megaTurn != null) { TT.megas++; bump(TT.turn, megaTurn); if (capableTurn != null) bump(TT.delay, megaTurn - capableTurn); }
      }
      if (capableTurn != null) {
        const r = (g.players && g.players[P] && g.players[P].rating) || 0;
        const band = r >= 1300 ? '1300+' : r >= 1200 ? '1200-1299' : r >= 1100 ? '1100-1199' : '<1100';
        const b = extra.by_rating[band] || (extra.by_rating[band] = [0, 0]); b[0]++; if (megaTurn != null) b[1]++;
        const e = extra.by_end[g.end || '?'] || (extra.by_end[g.end || '?'] = [0, 0]); e[0]++; if (megaTurn != null) e[1]++;
        const tl = turns.length >= 3 ? 'turns>=3' : 'turns<3';
        const f = extra.forms[tl] || (extra.forms[tl] = [0, 0]); f[0]++; if (megaTurn != null) f[1]++;
      }
    }
  };
  try {
    for (;;) {
      const k = fs.readSync(fd, chunk, 0, chunk.length, pos);
      if (!k) break;
      pos += k; buf += chunk.toString('utf8', 0, k);
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, nl); buf = buf.slice(nl + 1); if (line) each(line); if (opts.limit && extra.games >= opts.limit) break; }
      if (opts.limit && extra.games >= opts.limit) break;
    }
    if (buf.trim() && !(opts.limit && extra.games >= opts.limit)) each(buf);
  } finally { fs.closeSync(fd); }
  const rate = o => Object.fromEntries(Object.entries(o).map(([k, [n, m]]) => [k, { capable: n, megas: m, rate: +(m / n).toFixed(4), ci95: wilson(m, n) }]));
  return { definition: 'capable = a stone holder of its own species active at the start of a turn before the side megaed',
           turn_start: summary(T), brought_seen: summary(Tseen),
           games: extra.games, sides_with_stone_on_sheet: extra.sides_with_stone_on_sheet, sides_with_stone_brought_seen: extra.sides_with_stone_brought_seen,
           megas_on_mon_without_stone: extra.megas_seen_on_mon_without_stone,
           by_rating: rate(extra.by_rating), by_end: rate(extra.by_end), by_length: rate(extra.forms) };
}

/* ---- THE FLOOR. Pre-registered 2026-09-25, BEFORE any bot was measured against it. --------------------
 *   floor = HUMAN_RATE − MARGIN, MARGIN = 0.15 absolute.
 * The human rate is the turn-start definition over the whole dataset (solver/out/human, manifest in the report).
 * A bot FAILS when the UPPER end of its Wilson 95% interval on capable sides is below the floor — i.e. it is
 * far below the human rate with the arena's sample noise already allowed for — and the test needs at least
 * MIN_CAPABLE capable sides per bot to answer at all (fewer = CANNOT ANSWER, never a pass). */
const HUMAN_RATE = 0.9488;     // measured: solver/out/mega/human-rate.json turn_start.rate, 45,952 of 48,430 capable sides (docs/_reports/2026-09-25-mega-rate.md §1)
const MARGIN = 0.15;
const MIN_CAPABLE = 20;
const floor = (h) => +(((h == null ? HUMAN_RATE : h)) - MARGIN).toFixed(4);

module.exports = { tally, game, summary, humanRate, parsedGame, parsedSide, neverMega, wilson, floor, HUMAN_RATE, MARGIN, MIN_CAPABLE, _megaOfRow: megaOfRow };

if (require.main === module) {
  require('./env.js');
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const file = flag('--human', require('./teams.js').DEFAULT_FILE);
  const r = humanRate(file, { limit: +flag('--limit', 0) });
  r.file = file;
  try { r.manifest_generated = JSON.parse(fs.readFileSync(require('path').join(require('path').dirname(file), 'manifest.json'), 'utf8')).generated; } catch (e) {}
  const out = flag('--out', null);
  if (out) { fs.mkdirSync(require('path').dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(r, null, 1)); }
  console.log(JSON.stringify(r, null, 1));
}
