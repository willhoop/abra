/* solver/arena/spread_source.js — WHICH Stat Point spread every arena body plays at. A named, versioned setting,
 * recorded in every artifact; never a silent default. (2026-09-30, abra/regmc 1.49.0, Will's call "3";
 * docs/_reports/2026-09-30-arena-real-spreads.md.)
 *
 *   const SS = require('./solver/arena/spread_source.js');
 *   const src = SS.open(mode, { M })     mode: 'role-v1' (DEFAULT) | 'xatu-random' | 'flat'
 *   src.spreadsFor(G, seed)              -> { p1: [evs|null x6], p2: [...] }  one per SHEET row (seed: xatu-random only)
 *   src.dress(team, rows, evsBySheet)    lays each body's spread on it (the body's `_solverSheet` picks the row)
 *   src.bodyBuilder(buildBody)           a buildBody that returns the body already at its role-v1 spread (for a searcher
 *                                        that redraws hidden bodies; identity for the other modes)
 *   src.stamp()                          the artifact block: mode, table file + sha256, rule sha, population sha, the
 *                                        digest of every spread actually fielded, counters
 *
 * WHY. The ladder plays ROTOM's role-derived spreads (solver/rotom/spreads.js, 1.35.0 / 1.44.0), and every arena game
 * played the engine table's flat per-species line (omniscient, arena.js) or a RANDOM spread from XATU's self-play
 * generator (the honest match truth, 2026-09-26). A Choice Scarf set ran 2 Speed; a Trick Room set ran 2 Speed too. The
 * fitting environment and the playing environment must match (CLAUDE.md), so the arena now fields what the ladder fields.
 *
 * THE MODES.
 *   role-v1      solver/rotom/spreads.js's rule — the ladder's — read from solver/arena/spreads/role-v1.json (built by
 *                solver/arena/build_spreads.js against the ladder rotations' own population). A set the table has never
 *                seen is derived AT PLAY TIME by the same rule on the same population (MediDeriver, observed pinned off)
 *                and COUNTED (`derived_at_play`); a set that cannot be derived stays flat and is COUNTED (`flat_fallback`).
 *                The table refuses to open if solver/rotom/spreads.js's rule text has changed since it was built: a new
 *                rule is a new version (role-v2), never a silent mix.
 *   xatu-random  the pre-1.49.0 HONEST match truth, byte for byte: solver/xatu/worlds.js truthSpreads(sheets, seed).
 *                For re-running a figure measured before this change with --info honest.
 *   flat         the pre-1.49.0 omniscient / arena.js body: the engine table's line (buildMon), no spread, no nature.
 *                For re-running a figure measured before this change with --info omniscient or arena.js.
 *
 * THE STAT LINE is laid by solver/xatu/worlds.js applySpread — the one function the honest arena and ROTOM's
 * miltank-gen5 policy already use (spreadL50 plus the SP on HP, the sheet's nature; solver/tests/test-honest-info.js
 * checks it against the checkout's statModify). No second stat formula here.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(__dirname, 'spreads');
const TABLE_FILE = path.join(DIR, 'role-v1.json');
const POP_FILE = path.join(DIR, 'population-role-v1.json');
const MODES = ['role-v1', 'xatu-random', 'flat'];
const DEFAULT = 'role-v1';
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
/* DELIBERATE BREAK (env SPREADS_SOURCE_BREAK=scarf): a role-v1 body holding Choice Scarf loses its Speed SP to HP (the
 * 1.34.0 arena Speed); =stamp: the artifact block reports 'flat' whatever was fielded. solver/tests/test-arena-spreads.js
 * PARITY / RECORD must go red. */
const BREAK = (process.env && process.env.SPREADS_SOURCE_BREAK) || '';

const encode = (evs, role) => STATS.map(s => evs[s] | 0).join('/') + ' ' + (role || 'other');
function decode(v) { const [e, role] = String(v).split(' '); const a = e.split('/').map(Number); const evs = {}; STATS.forEach((s, i) => { evs[s] = a[i]; }); return { evs, role }; }
function population() {
  const P = JSON.parse(fs.readFileSync(POP_FILE, 'utf8'));
  const SPR = require('../rotom/spreads.js');
  return Object.assign(P, { slots: P.slots.map(s => ({ row: s.row, w: s.w, key: SPR.setKey(s.row) })) });
}

const OPEN = new Map();
function open(mode, o) {
  mode = mode || DEFAULT;
  if (!MODES.includes(mode)) throw new Error('spread_source: unknown spread mode ' + mode + ' (one of ' + MODES.join(', ') + ')');
  const M = o && (o.M || (o.API && o.API.M));
  if (!M) throw new Error('spread_source.open: { M } is required');
  const list = OPEN.get(mode) || [];
  const hit = list.find(v => v.M === M);
  if (hit) return hit.src;
  const src = make(mode, M);
  list.push({ M, src }); OPEN.set(mode, list);
  return src;
}

function make(mode, M) {
  const X = require('../human/dex.js');
  const SPR = require('../rotom/spreads.js');
  const XW = require('../xatu/worlds.js');
  const W = XW.create({ M }, { R: null });   // applySpread only (it reads M.spreadL50 and the dex)
  const COUNTERS = { games: 0, bodies_dressed: 0, table_hits: 0, derived_at_play: 0, flat_fallback: 0, bodies_flat: 0 };
  const realised = new Map();               // setKey -> "hp/.../spe" actually fielded (role-v1), for the digest
  let J = null, tableSha = null, MD = null;
  if (mode === 'role-v1') {
    if (!fs.existsSync(TABLE_FILE)) throw new Error('spread_source: role-v1 table missing (' + path.relative(ROOT, TABLE_FILE) + '); build it with solver/arena/build_spreads.js');
    const buf = fs.readFileSync(TABLE_FILE);
    tableSha = sha(buf);
    J = JSON.parse(buf.toString('utf8'));
    if (J.provenance.rule !== SPR.RULE_TEXT)
      throw new Error('spread_source: solver/rotom/spreads.js\'s rule has changed since role-v1 was built; a new rule is a new spread version (rebuild as role-v2), never a silent mix');
  }
  function derive(row) {
    if (!MD) {
      const S2 = require('../chomp/v2/spreads.js');
      MD = S2.make({ M }, population(), { observed: null });
    }
    const z = MD.spreadFor(row);
    if (MD._hits.size > 64) MD._hits.clear();
    return encode(z.evs, z.role);
  }
  function rowSpread(row) {
    if (!row || !row.species || !row.nature) { COUNTERS.flat_fallback++; return null; }
    const k = SPR.setKey(row);
    let v = J.spreads[k];
    if (v) COUNTERS.table_hits++;
    else {
      try { v = derive(row); COUNTERS.derived_at_play++; J.spreads[k] = v; }
      catch (e) { COUNTERS.flat_fallback++; return null; }
    }
    const d = decode(v);
    if (BREAK === 'scarf' && X.toID(row.item) === 'choicescarf') { d.evs.hp += d.evs.spe; d.evs.spe = 0; }
    realised.set(k, SPR.evStr(d.evs));
    return d.evs;
  }
  function spreadsFor(G, seed) {
    COUNTERS.games++;
    if (mode === 'flat') return null;
    if (mode === 'xatu-random') {
      if (seed == null) throw new Error('spread_source: xatu-random needs the battle seed');
      return XW.truthSpreads(G.sheets, seed);
    }
    const out = {};
    for (const p of ['p1', 'p2']) out[p] = (G.sheets[p] || []).map(rowSpread);
    return out;
  }
  function dress(team, rows, evsBySheet) {
    let n = 0;
    for (const m of team) {
      const s = m._solverSheet, sp = evsBySheet ? evsBySheet[s] : null;
      if (!sp) { COUNTERS.bodies_flat++; continue; }
      if (W.applySpread(m, sp, rows[s])) { n++; COUNTERS.bodies_dressed++; }
    }
    return n;
  }
  function bodyBuilder(buildBody) {
    if (mode !== 'role-v1') return buildBody;
    return (Mx, row, opts) => {
      const b = buildBody(Mx, row, opts);
      if (!b) return b;
      const sp = rowSpread(row);
      if (sp) { W.applySpread(b, sp, row); COUNTERS.bodies_dressed++; } else COUNTERS.bodies_flat++;
      return b;
    };
  }
  function stamp() {
    const shown = BREAK === 'stamp' ? 'flat' : mode;
    const base = { spreads: shown, modes: MODES, default: DEFAULT, counters: Object.assign({}, COUNTERS) };
    if (mode === 'flat') return Object.assign(base, { what: 'the engine table\'s flat per-species line (buildMon), no spread, no nature — the pre-1.49.0 omniscient / arena.js body' });
    if (mode === 'xatu-random') return Object.assign(base, { what: 'solver/xatu/worlds.js truthSpreads(sheets, battle seed) — the pre-1.49.0 honest match truth' });
    const keys = [...realised.keys()].sort();
    return Object.assign(base, { what: 'solver/rotom/spreads.js\'s rule (the ladder\'s), per set, from the role-v1 table',
      table: { file: path.relative(ROOT, TABLE_FILE).split(path.sep).join('/'), sha256: tableSha, sets: Object.keys(J.spreads).length - COUNTERS.derived_at_play,
               release: J.provenance.release, rule_sha256: J.provenance.rule_sha256, population_sha256: J.provenance.population_sha256, store_sha256: J.provenance.store_sha256 },
      fielded: { sets: keys.length, sha256: sha(keys.map(k => k + '=' + realised.get(k)).join('\n')) } });
  }
  return { mode, spreadsFor, dress, bodyBuilder, stamp, rowSpread: mode === 'role-v1' ? rowSpread : () => null, COUNTERS, BROKEN: BREAK || null };
}

/* the shards' stamps -> one artifact block: the mode (MIXED if they disagree), the table, the counters summed, each
 * shard's fielded digest, and warnings (a mixed run, a set derived at play time, a body left flat under role-v1) */
function mergeStamps(stamps, wanted) {
  const ok = stamps.filter(Boolean);
  const modes = [...new Set(ok.map(s => s.spreads))];
  const counters = {};
  for (const s of ok) for (const [k, v] of Object.entries(s.counters || {})) counters[k] = (counters[k] || 0) + v;
  const warnings = [];
  if (modes.length > 1) warnings.push('SPREADS: shards played different spread modes ' + modes.join(', '));
  if (wanted && modes.length && !modes.every(m => m === wanted)) warnings.push('SPREADS: asked for ' + wanted + ', shards report ' + modes.join(', '));
  if (modes.includes('role-v1') && counters.flat_fallback) warnings.push('SPREADS: ' + counters.flat_fallback + ' role-v1 rows could not be derived and played the FLAT line');
  if (modes.includes('role-v1') && counters.derived_at_play) warnings.push('SPREADS: ' + counters.derived_at_play + ' sets were not in the role-v1 table and were derived at play time (same rule, same population)');
  if (modes.includes('role-v1') && !counters.bodies_dressed) warnings.push('SPREADS: role-v1 asked for and 0 bodies were dressed');
  const t = ok.find(s => s.table);
  return { spreads: modes.length === 1 ? modes[0] : (modes.length ? 'MIXED' : null), table: t ? t.table : null, what: ok[0] ? ok[0].what : null,
           counters, fielded_by_shard: ok.map(s => s.fielded || null), warnings };
}

module.exports = { open, mergeStamps, MODES, DEFAULT, TABLE_FILE, POP_FILE, encode, decode, population };
