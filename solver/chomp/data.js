/* solver/chomp/data.js — the human games CHOMP is evaluated on, read ONLY from the human dataset's headers.
 *
 *   const D = require('./solver/chomp/data.js');
 *   const H = D.headers([file])     -> { games:[G], file, pool_sha256, scanned, skipped }   one pass, cached per process
 *   G = { id, date, series, players:{p1,p2}, split:{p1,p2}, sheets:{p1,p2}, leads:{p1,p2}, brought_seen:{p1,p2},
 *         bring_complete:{p1,p2}, option:{p1,p2} (the human's option index, solver/chomp/options.js, or -1), winner }
 *   D.splitOf(name)                 'train' | 'val' | 'test' — THE player split of MAG, DODUO and PORYGON2
 *                                   (sha256('abra-prior-v0:' + toID(name)) mod 100: < 80 train, < 90 val, else test)
 *   D.pick(list, n, seed)           a seeded stride over a list (dates spread, not the first hour)
 *
 * The file is the human dataset (solver/human/build_dataset.js). It lives in the MAIN checkout and is READ ONLY;
 * a worktree has no copy. It is hashed whole (pool_sha256) so every artifact can say which file it read.
 *
 * Kept: both sheets six long, no custom rules, both leads known. `option` is set only where the whole four is
 * known (bring_complete), because the back two of a side that never showed them are not in the log.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const O = require('./options.js');

const DEFAULT_FILE = path.join('C:', 'Users', 'willj', 'Projects', 'Pokemon', 'ABRA', 'solver', 'out', 'human', 'games.jsonl');
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SALT = 'abra-prior-v0';
function splitOf(name) {
  const h = crypto.createHash('sha256').update(SALT + ':' + toID(name)).digest().readUInt32BE(0) % 100;
  return h < 80 ? 'train' : h < 90 ? 'val' : 'test';
}

const CACHE = new Map();
function headers(file) {
  file = file || DEFAULT_FILE;
  if (CACHE.has(file)) return CACHE.get(file);
  if (!fs.existsSync(file)) throw new Error('chomp/data: no human dataset at ' + file);
  const fd = fs.openSync(file, 'r');
  const chunk = Buffer.alloc(1 << 22);
  const hash = crypto.createHash('sha256');
  let buf = '', pos = 0, scanned = 0;
  const games = [];
  const skipped = { custom_rules: 0, sheet_not_six: 0, no_leads: 0 };
  try {
    for (;;) {
      const k = fs.readSync(fd, chunk, 0, chunk.length, pos);
      if (!k) break;
      hash.update(chunk.subarray(0, k));
      pos += k; buf += chunk.toString('utf8', 0, k);
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line) continue;
        scanned++;
        const cut = line.indexOf(',"turns":');
        const g = JSON.parse(cut > 0 ? line.slice(0, cut) + '}' : line).game;
        if (g.custom_rules) { skipped.custom_rules++; continue; }
        if ((g.sheets.p1 || []).length !== 6 || (g.sheets.p2 || []).length !== 6) { skipped.sheet_not_six++; continue; }
        if (!g.leads || (g.leads.p1 || []).length !== 2 || (g.leads.p2 || []).length !== 2) { skipped.no_leads++; continue; }
        const option = {}, split = {}, players = {};
        for (const sd of ['p1', 'p2']) {
          players[sd] = g.players[sd].name;
          split[sd] = splitOf(g.players[sd].name);
          const leads = g.leads[sd];
          const four = leads.concat((g.brought_seen[sd] || []).filter(i => !leads.includes(i)));
          option[sd] = g.bring_complete && g.bring_complete[sd] && four.length === 4 ? O.indexOf(four) : -1;
        }
        games.push({ id: g.id, date: g.date, series: g.series || null, players, split, sheets: g.sheets, leads: g.leads,
                     brought_seen: g.brought_seen, bring_complete: g.bring_complete || {}, option, winner: g.winner || null });
      }
    }
  } finally { fs.closeSync(fd); }
  const H = { games, file, pool_sha256: hash.digest('hex'), scanned, skipped };
  CACHE.set(file, H);
  return H;
}

function pick(list, n, seed) {
  if (list.length <= n) return list.slice();
  const stride = list.length / n;
  const off = ((seed || 0) * 0.6180339887) % 1;
  const out = [];
  for (let k = 0; k < n; k++) out.push(list[Math.min(list.length - 1, Math.floor((k + off) * stride))]);
  return out;
}

module.exports = { headers, splitOf, pick, toID, DEFAULT_FILE, SALT };
