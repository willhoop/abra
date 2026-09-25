/* solver/mew/pairs.js — the TEAM PAIRS self-play and the generation gates play, split by PLAYER.
 *
 *   const P = require('./solver/mew/pairs.js').load({ file, M });
 *   P.train   team pairs whose BOTH players are MAG/DODUO/PORYGON2 train players   (self-play samples these)
 *   P.test    team pairs whose BOTH players are test players                      (the arena gates play these)
 *   P.counts  what was scanned, kept and skipped, per reason
 *   P.pick(list, n, seed)   n pairs by a seeded stride over the list (the arena's rule: spans the file's dates)
 *
 * A PAIR is solver/arena/teams.js's game shape — { id, date, sheets:{p1,p2}, brought:{p1,p2}, winner } — the
 * humans' own open sheets and their own brought four with the leads first, so a pair builds exactly as the
 * arena builds one (T.buildTeam). The eligibility rule is the arena's (both brought fours known, no custom
 * rules, both sheets six rows, all eight bodies build); only the split is added.
 *
 * WHY THE SPLIT. Self-play trains PORYGON2 and DODUO, and the gate that accepts a generation plays team pairs.
 * If the gate's pairs were self-play's pairs, a generation could pass by having memorised its test teams. The
 * split is the one every solver net already uses — sha256("abra-prior-v0:" + toID(player)) mod 100, <80 train,
 * <90 val, else test — so a test pair's players are held out of the human training data too.
 *
 * The dataset is the MAIN checkout's untracked build output (solver/out/human/games.jsonl), read only.
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const T = require('../arena/teams.js');

const SALT = 'abra-prior-v0';
const SPLITS = ['train', 'val', 'test'];
const splitOf = pid => { const h = crypto.createHash('sha256').update(SALT + ':' + pid).digest().readUInt32BE(0) % 100; return h < 80 ? 0 : h < 90 ? 1 : 2; };
const toID = T.toID;

/* THE FROZEN TEAM STORE (o.teamStore = data/team-pool-frozen-regmc in the MAIN checkout, read only). Its
 * games.bo3.jsonl is the store's own schema (engine/cut_regmc_pool.js): sheets with id-spelled names,
 * `brought` as seen species, `lead`. Each sheet row is converted to the human dataset's row shape — the names
 * read back from the Reg M-C dex (Dex.forFormat), never typed — so every net's featuriser reads the same strings
 * it was trained on. Only games.bo3.jsonl is read: the bo3 ladder is the target, and the pool's ots file is the
 * bo1 ladder. Bots (store `bot: true`) are skipped. The receipt's pool digest and the file's sha256 are returned. */
function sheetRow(D, x, i) {
  const sp = D.species.get(toID(x.species)), it = x.item ? D.items.get(toID(x.item)) : null, ab = x.ability ? D.abilities.get(toID(x.ability)) : null;
  const name = sp && sp.exists ? sp.name : x.species;
  return { i, nick: name, species: name, species_id: toID(name), item: it && it.exists ? it.name : (x.item || null),
           ability: ab && ab.exists ? ab.name : (x.ability || null),
           moves: (x.moves || []).map(m => { const mv = D.moves.get(toID(m)); return mv && mv.exists ? mv.name : m; }),
           nature: x.nature || null, gender: x.gender || null, level: x.level || 50 };
}
function loadStore(o) {
  const path = require('path');
  const D = require('../human/dex.js').D;
  const file = path.join(o.teamStore, 'games.bo3.jsonl');
  if (!fs.existsSync(file)) throw new Error('mew/pairs: no games.bo3.jsonl in team store ' + o.teamStore);
  let receipt = null; try { receipt = JSON.parse(fs.readFileSync(path.join(o.teamStore, 'pool-receipt.json'), 'utf8')); } catch (e) {}
  const h = crypto.createHash('sha256');
  const counts = { scanned: 0, bot: 0, bring_incomplete: 0, sheet_not_six: 0, mixed_split: 0, train: 0, val: 0, test: 0 };
  const out = { train: [], val: [], test: [] };
  /* streamed in 4 MB chunks, hashed as read: the file is 236 MB and a worker heap is 1.5 GB */
  const fd = fs.openSync(file, 'r'), chunk = Buffer.alloc(1 << 22); let buf = '', k;
  const dec = new (require('string_decoder').StringDecoder)('utf8');   // a chunk can end inside a multi-byte character
  try {
    while ((k = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      h.update(chunk.subarray(0, k)); buf += dec.write(chunk.subarray(0, k));
      let nl; while ((nl = buf.indexOf('\n')) >= 0) { row(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
    }
    buf += dec.end(); if (buf) row(buf);
  } finally { fs.closeSync(fd); }
  function row(line) {
    if (!line) return;
    counts.scanned++;
    const g = JSON.parse(line);
    if ((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot)) { counts.bot++; return; }
    if (!g.sheets || (g.sheets.p1 || []).length !== 6 || (g.sheets.p2 || []).length !== 6) { counts.sheet_not_six++; return; }
    const sheets = {}, brought = {};
    let ok = true;
    for (const sd of ['p1', 'p2']) {
      sheets[sd] = g.sheets[sd].map((x, i) => sheetRow(D, x, i));
      const idx = n => sheets[sd].findIndex(r => r.species_id === toID(n) || toID(g.sheets[sd][r.i].species) === toID(n));
      /* slot order of the leads: the pre-turn switch-ins name the slot (p1a, p1b); the store's `lead` list does not */
      const pre = (g.preTurn || []).filter(e => e.t === 's' && (e.s === sd + 'a' || e.s === sd + 'b')).sort((a, b) => (a.s < b.s ? -1 : 1)).map(e => e.mon);
      const leadNames = pre.length === 2 ? pre : ((g.lead || {})[sd] || []);
      const lead = leadNames.map(idx), seen = ((g.brought || {})[sd] || []).map(idx);
      const b = lead.concat(seen.filter(i => !lead.includes(i)).sort((x, y) => x - y));   // the back two in sheet order, as teams.js orders them
      if (b.length !== 4 || b.some(i => i < 0) || new Set(b).size !== 4) { ok = false; break; }
      brought[sd] = b;
    }
    if (!ok) { counts.bring_incomplete++; return; }
    const s1 = splitOf(toID(g.p1.name)), s2 = splitOf(toID(g.p2.name));
    if (s1 !== s2) { counts.mixed_split++; return; }
    out[SPLITS[s1]].push({ id: g.id, date: g.date, sheets, brought, winner: g.winner === g.p1.name ? 'p1' : g.winner === g.p2.name ? 'p2' : null });
    counts[SPLITS[s1]]++;
  }
  return { file, file_sha256: h.digest('hex'), pool_digest: receipt ? (receipt.pool_digest || receipt.digest || null) : null, receipt_generated: receipt ? receipt.generated : null,
           kind: 'team-store', train: out.train, val: out.val, test: out.test, counts, pick,
           ids_sha256: list => crypto.createHash('sha256').update(list.map(g => g.id).join('\n')).digest('hex').slice(0, 16) };
}

const CACHE = new Map();
function load(o) {
  o = o || {};
  if (o.teamStore) { const k = 'store|' + o.teamStore; if (!CACHE.has(k)) CACHE.set(k, loadStore(o)); return CACHE.get(k); }
  const file = o.file || T.DEFAULT_FILE;
  const key = file + '|' + (o.M ? 'M' : '');
  if (CACHE.has(key)) return CACHE.get(key);
  if (!fs.existsSync(file)) throw new Error('mew/pairs: no human dataset at ' + file);
  const fd = fs.openSync(file, 'r');
  const chunk = Buffer.alloc(1 << 22);
  let buf = '', pos = 0;
  const counts = { scanned: 0, bring_incomplete: 0, custom_rules: 0, sheet_not_six: 0, unbuildable: 0, mixed_split: 0, train: 0, val: 0, test: 0 };
  const out = { train: [], val: [], test: [] };
  try {
    for (;;) {
      const k = fs.readSync(fd, chunk, 0, chunk.length, pos);
      if (!k) break;
      pos += k; buf += chunk.toString('utf8', 0, k);
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line) continue;
        counts.scanned++;
        const cut = line.indexOf(',"turns":');
        const g = JSON.parse(cut > 0 ? line.slice(0, cut) + '}' : line).game;
        if (!g.bring_complete || !g.bring_complete.p1 || !g.bring_complete.p2) { counts.bring_incomplete++; continue; }
        if (g.custom_rules) { counts.custom_rules++; continue; }
        if ((g.sheets.p1 || []).length !== 6 || (g.sheets.p2 || []).length !== 6) { counts.sheet_not_six++; continue; }
        const brought = {};
        for (const sd of ['p1', 'p2']) {
          const leads = g.leads[sd] || [];
          brought[sd] = leads.concat(g.brought_seen[sd].filter(i => !leads.includes(i)));
        }
        if (brought.p1.length !== 4 || brought.p2.length !== 4) { counts.bring_incomplete++; continue; }
        const s1 = splitOf(toID(g.players.p1.name)), s2 = splitOf(toID(g.players.p2.name));
        if (s1 !== s2) { counts.mixed_split++; continue; }
        const G = { id: g.id, date: g.date, sheets: g.sheets, brought, winner: g.winner };
        if (o.M && (!T.buildTeam(o.M, G, 'p1') || !T.buildTeam(o.M, G, 'p2'))) { counts.unbuildable++; continue; }
        out[SPLITS[s1]].push(G); counts[SPLITS[s1]]++;
      }
    }
  } finally { fs.closeSync(fd); }
  const r = { file, train: out.train, val: out.val, test: out.test, counts, pick,
    ids_sha256: list => crypto.createHash('sha256').update(list.map(g => g.id).join('\n')).digest('hex').slice(0, 16) };
  CACHE.set(key, r);
  return r;
}

/* n pairs by a seeded stride (solver/arena/teams.js loadGames' rule) */
function pick(list, n, seed) {
  const stride = Math.max(1, Math.floor(list.length / n));
  const off = (seed || 0) % stride;
  const out = [];
  for (let i = off; i < list.length && out.length < n; i += stride) out.push(list[i]);
  return out;
}

module.exports = { load, pick, splitOf, sheetRow, SALT, SPLITS };
