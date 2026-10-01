/* solver/porygon2/v3/positions.js — MEDICHAM positions for the PORYGON2 v3 evaluation set, built from finished games.
 *
 *   const P = require('./solver/porygon2/v3/positions.js').create(API);
 *   P.fromLog({ id, log, me, source })   -> { game, positions: [{ turn, ti, w, sheets, lines }] , counters }
 *   P.complete(finalState, preview, LIB) -> { sheets: { p1:[6], p2:[6] }, filled }   (bo1 only: see COMPLETION)
 *   P.injectSheets(log, sheets)           -> the log with two |showteam| lines after the preview
 *
 * EVERY POSITION IS BUILT THE WAY ROTOM BUILDS ITS OWN (solver/rotom/world.js), from one side's chair (`me`): the parsed
 * public state before the turn (solver/human/parse_game.js), the log up to the `|turn|N` line (the exact consecutive-
 * Protect counter), and a request SYNTHESISED from the log for `me` — the side's own four (the full game's brought set:
 * a player knows their own bring), actives first in slot order, HP laid from the log's percentage on the built body's
 * max, the sheet's moves, the mega offered while the side has not mega-evolved (solver/tests/probe_dp_replay.js and
 * solver/doduo/eval_gates.js do the same). The opponent's unrevealed back line is filled BLIND (oppGuess null; world.js
 * counts it): the deep search and every net see it only through worlds redrawn over the unrevealed sheet rows, so the
 * true back line is never read.
 *
 * COMPLETION (bo1 only, stated in DESIGN.md §1 and in every artifact). A closed-sheet log does not show a whole set, and
 * MEDICHAM needs one to step a turn. Each member's set is completed from the open-sheet population: the most frequent
 * bo3 sheet row of that species that contains every move, the item and the ability the WHOLE log revealed (revealed
 * fields always win; when no row contains them all, the row with the largest overlap fills only the missing fields).
 * The count of filled fields is returned per position and printed. Revealed-at-game-end is used, not revealed-by-turn-N:
 * the completed world is one fixed world per game, which every net and the deep search share, so the comparison is fair
 * even where the completion is wrong. What it costs is stated: a bo1 position is a plausible world, not the true one.
 */
'use strict';
const X = require('../../human/dex.js');
const T = require('../../arena/teams.js');
const { parseGame } = require('../../human/parse_game.js');
const toID = X.toID;

function create(API) {
  const M = API.M;
  const WB = require('../../rotom/world.js').create(API);
  const COUNTERS = { games: 0, positions: 0, parse_errors: 0, world_errors: 0, unbuildable: 0 };

  function synthRequest(G, st, me) {
    const sheet = G.sheets[me];
    const side = st.sides[me];
    const brought = (G.brought_seen[me] || []).slice();
    for (let i = 0; brought.length < Math.min(4, sheet.length) && i < sheet.length; i++) if (!brought.includes(i)) brought.push(i);   // a bring the log never showed
    const act = side.active || [];
    const order = [];
    for (let k = 0; k < act.length; k++) {
      if (act[k] != null) { order.push(act[k]); continue; }
      const fnt = brought.filter(i => !act.includes(i) && !order.includes(i) && side.mons[i] && side.mons[i].fnt);
      const f = fnt.find(i => side.mons[i].pos === (k === 0 ? 'a' : 'b'));
      const h = f != null ? f : fnt[0];
      if (h == null) throw new Error('empty active slot with no fainted body to hold it');
      order.push(h);
    }
    for (const i of brought) if (!order.includes(i)) order.push(i);
    const megaUsed = !!side.mega_used;
    const pokemon = order.slice(0, 4).map((i, j) => {
      const r = sheet[i], pub = side.mons[i] || {};
      const b = T.buildBody(M, r);
      if (!b) { COUNTERS.unbuildable++; throw new Error('unbuildable ' + r.species); }
      const max = b.st.hp;
      const cond = pub.fnt ? '0 fnt' : `${pub.seen ? Math.max(1, Math.round((pub.hp / (pub.max || 100)) * max)) : max}/${max}${pub.status ? ' ' + pub.status : ''}`;
      return { ident: me + (j < 2 ? 'ab'[j] : 'a') + ': ' + r.nick, details: (pub.seen && pub.species ? pub.species : r.species) + ', L50', condition: cond,
               active: j < act.length && act[j] != null, item: pub.seen ? (pub.item === undefined ? r.item : (pub.item || '')) : r.item,
               ability: pub.seen && pub.ability ? pub.ability : r.ability, moves: r.moves.map(toID) };
    });
    const active = act.map(i => {
      if (i == null) return null;
      const r = sheet[i];
      const it = X.D.items.get(toID(r.item));
      const canMega = !megaUsed && !!(it && it.exists && it.megaStone) && !/-mega/i.test(String((side.mons[i] || {}).species || ''));
      return { moves: r.moves.map(m => { const mv = X.D.moves.get(toID(m)); return { move: mv.name, id: mv.id, target: mv.target, disabled: false, pp: 8, maxpp: 8 }; }), canMegaEvo: canMega };
    });
    return { active, side: { id: me, pokemon } };
  }

  /* every turn-start position of one finished game, from `me`'s chair */
  function fromLog(o) {
    COUNTERS.games++;
    let parsed;
    try { parsed = parseGame({ id: o.id, log: o.log, uploadtime: o.uploadtime }); } catch (e) { COUNTERS.parse_errors++; return { error: 'parse: ' + (e.code || e.message) }; }
    const G = parsed.game, turns = parsed.turns;
    const all = String(o.log).split('\n');
    const out = [];
    for (let ti = 0; ti < turns.length; ti++) {
      const t = turns[ti];
      const cut = all.findIndex(l => l === '|turn|' + t.n);
      if (cut < 0) continue;
      const lines = all.slice(0, cut + 1);
      const row = { game: G, turns: turns.slice(0, ti + 1) };
      try {
        const req = synthRequest(G, t.state, o.me);
        const w = WB.build({ row, sheets: G.sheets, me: o.me, req, oppGuess: null, lines });
        out.push({ turn: t.n, ti, w, sheets: G.sheets });
        COUNTERS.positions++;
      } catch (e) { COUNTERS.world_errors++; if (COUNTERS.world_errors < 6) console.error('positions: world', o.id, t.n, String(e && e.message || e).slice(0, 200)); }
    }
    return { game: G, positions: out };
  }

  return { COUNTERS, fromLog, synthRequest, worldCounters: WB.COUNTERS };
}

/* ---------- bo1 completion (store-only; no engine) ---------- */

/* the open-sheet set library: species id -> [{ item, ability, moves:[4 names], nature, n }] by count, from bo3 sheet rows */
function addToLibrary(LIB, row) {
  const sp = toID(row.species);
  const key = [toID(row.item), toID(row.ability), row.moves.map(toID).sort().join(','), row.nature || ''].join('|');
  const L = LIB[sp] || (LIB[sp] = {});
  if (!L[key]) L[key] = { item: row.item, ability: row.ability, moves: row.moves.slice(), nature: row.nature || null, n: 0 };
  L[key].n++;
}
function finishLibrary(LIB) {
  const out = {};
  for (const sp of Object.keys(LIB).sort()) out[sp] = Object.values(LIB[sp]).sort((a, b) => b.n - a.n || (a.moves.join() < b.moves.join() ? -1 : 1));
  return out;
}

/* one member: revealed { species, moves:[names, '<UNK>'], item, ability } -> a full sheet row + the count of filled fields */
function completeMember(rev, LIB) {
  const UNK = '<UNK>';
  const sp = X.species(rev.species);
  const known = { moves: (rev.moves || []).filter(m => m && m !== UNK), item: rev.item && rev.item !== UNK ? rev.item : null, ability: rev.ability && rev.ability !== UNK ? rev.ability : null };
  const cands = LIB[toID(sp.name)] || LIB[toID(sp.baseSpecies)] || [];
  const kmv = new Set(known.moves.map(toID));
  const score = c => {
    const cm = new Set(c.moves.map(toID));
    let s = 0; for (const m of kmv) if (cm.has(m)) s += 2;
    if (known.item && toID(c.item) === toID(known.item)) s += 1;
    if (known.ability && toID(c.ability) === toID(known.ability)) s += 1;
    return s;
  };
  const full = 2 * kmv.size + (known.item ? 1 : 0) + (known.ability ? 1 : 0);
  let best = null, bs = -1;
  for (const c of cands) { const s = score(c); if (s > bs) { bs = s; best = c; } if (s === full) break; }     // cands are sorted by count: first full match is the modal one
  const filled = { moves: 0, item: 0, ability: 0, nature: 0, library_miss: best ? 0 : 1, consistent: best && bs === full ? 1 : 0 };
  const moves = known.moves.slice(0, 4);
  if (best) for (const m of best.moves) { if (moves.length >= 4) break; if (!moves.some(x => toID(x) === toID(m))) { moves.push(m); filled.moves++; } }
  let item = known.item, ability = known.ability, nature = null;
  if (!item && best) { item = best.item; filled.item = 1; }
  if (!ability) {
    const legal = Object.values(sp.abilities || {}).filter(a => { const A = X.D.abilities.get(toID(a)); return A && A.exists && !A.isNonstandard; });
    if (best) { ability = best.ability; filled.ability = 1; } else if (legal.length === 1) ability = legal[0];
  }
  if (best && best.nature) { nature = best.nature; filled.nature = 1; }
  return { row: { species: sp.name, item: item || '', ability: ability || '', moves, nature }, filled };
}

/* reveal.js final_state (per side, 6 mons) -> completed packed sheets */
function complete(finalState, LIB) {
  const sheets = {}, filled = { moves: 0, item: 0, ability: 0, nature: 0, library_miss: 0, consistent: 0, members: 0 };
  for (const s of ['p1', 'p2']) {
    sheets[s] = (finalState[s] || []).map(m => {
      const c = completeMember({ species: m.species, moves: m.moves, item: m.item && m.item.orig, ability: m.ability && m.ability.base }, LIB);
      for (const k in c.filled) filled[k] += c.filled[k];
      filled.members++;
      return c.row;
    });
  }
  return { sheets, filled };
}
const pack = rows => rows.map(r => [r.species, '', r.item || '', r.ability || '', r.moves.join(','), r.nature || '', '', '', '', '', '50', ''].join('|')).join(']');
/* |showteam| lines go after the last |poke| line (the preview), where Showdown prints them in an open-sheet room */
function injectSheets(log, sheets) {
  const L = String(log).split('\n');
  let at = -1; L.forEach((l, i) => { if (l.startsWith('|poke|')) at = i; });
  if (at < 0) throw new Error('no preview in the log');
  L.splice(at + 1, 0, '|showteam|p1|' + pack(sheets.p1), '|showteam|p2|' + pack(sheets.p2));
  return L.join('\n');
}

module.exports = { create, addToLibrary, finishLibrary, completeMember, complete, injectSheets, pack };
