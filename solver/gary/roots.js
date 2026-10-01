/* solver/gary/roots.js — the search's RECORDED ROOTS on held-out human decisions, read back and joined to the dataset.
 *
 * The roots are solver/miltank/eval_kl_human.js's (abra/regmc 1.34.0, docs/_reports/2026-09-30-human-regularised-search.md):
 * 580 TEST-player decisions, gen5's search at 16 passes on release eaa5becc54eb, each root recorded once — the human's
 * candidate rows and the opponent's columns (MEDICHAM joint keys), the mean table A (the HUMAN's win probability, the
 * human is the row player), the per-cell playout counts, the plain solve's row mix x (= the equilibrium prediction tau*
 * of the human's click) and the human's row (hrow, -1 when the human's joint is not among the rows). READING A FINISHED
 * RUN: nothing here plays, steps or searches.
 *
 *   const R = require('./solver/gary/roots.js');
 *   const recs = R.load(dir);                         // the evaluated records (no error, not forced, a table)
 *   const games = await R.gamesFor(humanJsonl, recs); // id -> dataset row, one streamed pass
 *   R.rowCells(rec, game, d)                          // each candidate row's DODUO (a, b) cell, or null; d = decide(...)
 *   R.humanKey(rec, game, d)                          // the human's joint rebuilt in the root's key form (a self-check)
 *
 * THE SWITCH KEY. A root names a switch `sw<n>`: n is the TEAM index of the world eval_kl_human.js built, and that world
 * is built from a request whose order is the active pair, then the rest of the brought four (eval_gates.js synthRequest;
 * solver/rotom/world.js: "at build time my team order IS the request order"). requestOrder() rebuilds that order from the
 * same public state, and humanKey() proves it on every record by rebuilding the logged key from the dataset's own action.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function load(dir) {
  const recs = [];
  for (const f of fs.readdirSync(dir)) if (/^decisions-\d+\.jsonl$/.test(f)) for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) if (l) recs.push(JSON.parse(l));
  recs.sort((a, b) => a.i - b.i);
  return recs;
}
const usable = r => !r.error && !r.unmatched && !r.forced && !r.fallback && Array.isArray(r.rows) && Array.isArray(r.A);

async function gamesFor(file, recs) {
  const want = new Set(recs.map(r => r.id)), out = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const m = /"id":"([^"]+)"/.exec(line.slice(0, 400));
    if (m && want.has(m[1])) out.set(m[1], JSON.parse(line));
  }
  return out;
}

/* eval_gates.js synthRequest's order, without the bodies: sheet indices by team index */
function requestOrder(G, st, me) {
  const side = st.sides[me], brought = G.brought_seen[me], act = side.active || [];
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
  return order;
}

/* one slot token of a root key -> the DODUO candidate index in slot k of decision d, or null */
function tokenCand(tok, k, d, order) {
  const sl = d.slots[k];
  tok = tok.trim();
  if (!sl) return tok === '-' || tok === 'pass' ? 0 : null;
  if (tok === '-' || tok === 'pass') return null;
  const C = sl.cands;
  if (C.length === 1 && C[0].key === 'LOCKED') return 0;
  let m = /^sw(\d+)$/.exec(tok);
  if (m) { const to = order[+m[1]]; const i = C.findIndex(c => c.attr.sw && c.attr.to === to); return i >= 0 ? i : null; }
  m = /^([a-z0-9]+)(?:@(-?\d+))?(\+M)?$/.exec(tok);
  if (!m) return null;
  const mv = m[1], tgt = m[2] == null ? null : +m[2], mega = m[3] ? 1 : 0;
  let tc = 4;
  if (tgt === 1) tc = 0; else if (tgt === 2) tc = 1; else if (tgt != null) tc = tgt === -(k + 1) ? 3 : 2;
  let i = C.findIndex(c => !c.attr.sw && c.attr.mv === mv && c.attr.mega === mega && c.attr.tc === tc);
  if (i < 0) i = C.findIndex(c => !c.attr.sw && c.attr.mv === mv && c.attr.mega === mega && c.attr.tc === 4);
  return i >= 0 ? i : null;
}
function keyCell(key, d, order) {
  const toks = key.split(' | ');
  const a = tokenCand(toks[0] || '-', 0, d, order), b = tokenCand(toks[1] || '-', 1, d, order);
  if (a == null || b == null) return null;
  return [a, b];
}
function rowCells(rec, game, d) {
  const G = game.game, st = game.turns[rec.ti].state;
  const order = requestOrder(G, st, rec.p);
  return rec.rows.map(k => keyCell(k, d, order));
}
/* the dataset's own action for the human, in the root's key form */
function humanKey(rec, game) {
  const G = game.game, t = game.turns[rec.ti], st = t.state;
  const order = requestOrder(G, st, rec.p);
  const A = t.actions[rec.p];
  return [A.a, A.b].map(x => !x ? 'pass' : x.kind === 'switch' ? 'sw' + order.indexOf(x.to)
    : x.kind === 'move' ? toID(x.move) + (x.target_loc != null ? '@' + x.target_loc : '') + (x.mega ? '+M' : '') : x.kind).join(' | ');
}

module.exports = { load, usable, gamesFor, requestOrder, keyCell, rowCells, humanKey, tokenCand };
