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

const CACHE = new Map();
function load(o) {
  o = o || {};
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

module.exports = { load, pick, splitOf, SALT, SPLITS };
