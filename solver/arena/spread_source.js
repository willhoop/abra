/* solver/arena/spread_source.js — WHICH Stat Point spread every arena body plays at. A named, versioned setting,
 * recorded in every artifact; never a silent default. (2026-09-30, abra/regmc 1.49.0, Will's call "3";
 * docs/_reports/2026-09-30-arena-real-spreads.md.)
 *
 *   const SS = require('./solver/arena/spread_source.js');
 *   const src = SS.open(mode, { M })     mode: 'role-v1' (DEFAULT) | 'observed-v1' | 'xatu-random' | 'flat'
 *   src.spreadsFor(G, seed)              -> { p1: [evs|null x6], p2: [...] }  one per SHEET row (seed: xatu-random only)
 *   src.dress(team, rows, evsBySheet)    lays each body's spread on it (the body's `_solverSheet` picks the row)
 *   src.bodyBuilder(buildBody[, { view }])  THE FRESH-BODY BUILDER: a buildBody whose body is laid by the same two functions
 *                                        that lay a team body (rowSpread -> applySpread), for a searcher that redraws
 *                                        hidden bodies or builds a world (solver/miltank/rollout.js body, ROTOM's world):
 *                                          view 'truth' (default)  the body at this mode's spread: role-v1 = exactly the
 *                                                                  team body buildTeam fields; flat / xatu-random = the
 *                                                                  table line (xatu-random's truth is per battle seed and
 *                                                                  a fresh body has none; an honest searcher re-spreads it)
 *                                          view 'public'           zero SP under the sheet's nature — what an honest
 *                                                                  player knows of an OPPONENT body before its belief
 *                                                                  draws a spread (solver/xatu/worlds.js publicOpp)
 *                                        Counted apart from the team's: fresh_dressed / fresh_flat / fresh_public.
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
 *   observed-v1  (abra/regmc 1.72.0) role-v1 with the OBSERVED hooks folded in, the ladder's spreads since 1.72.0:
 *                solver/arena/spreads/observed-v1.json (solver/arena/build_observed_spreads.js): a rotation set at its
 *                recorded spread, else the tournament hook, else Smogon's Reg M-C moveset chain, else role-v1's entry. A
 *                set the table has never seen is asked the Smogon chain AT PLAY TIME (the pinned files; counted
 *                `observed_at_play`), else derived as role-v1 does (`derived_at_play`); the tournament hook is not asked
 *                at play time (the store moves). The table refuses to open if the rule text, a pinned Smogon file or the
 *                role-v1 base has moved. NOT the default: switching the arena default is Will's call.
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
const OBS_TABLE_FILE = path.join(DIR, 'observed-v1.json');
const TABLES = { 'role-v1': TABLE_FILE, 'observed-v1': OBS_TABLE_FILE };   // the table-backed modes
const MODES = ['role-v1', 'observed-v1', 'xatu-random', 'flat'];
const DEFAULT = 'role-v1';
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
/* DELIBERATE BREAK (env SPREADS_SOURCE_BREAK=scarf): a role-v1 body holding Choice Scarf loses its Speed SP to HP (the
 * 1.34.0 arena Speed); =stamp: the artifact block reports 'flat' whatever was fielded. solver/tests/test-arena-spreads.js
 * PARITY / RECORD must go red. */
const BREAK = (process.env && process.env.SPREADS_SOURCE_BREAK) || '';
/* DELIBERATE BREAK (env SPREAD_FRESH_BREAK=flat): bodyBuilder's 'truth' body is the table's flat line again (the pre-1.69.0
 * rollout body). solver/tests/test-body-parity.js FRESH and solver/tests/test-miltank.js SWAP must go red. */
const FRESH_BREAK = (process.env && process.env.SPREAD_FRESH_BREAK) || '';

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
  const COUNTERS = { games: 0, bodies_dressed: 0, table_hits: 0, derived_at_play: 0, observed_at_play: 0, flat_fallback: 0, bodies_flat: 0, fresh_dressed: 0, fresh_flat: 0, fresh_public: 0 };
  const realised = new Map();               // setKey -> "hp/.../spe" actually fielded (role-v1), for the digest
  let J = null, tableSha = null, MD = null, OBS = null;
  const TF = TABLES[mode];
  if (TF) {
    if (!fs.existsSync(TF)) throw new Error('spread_source: ' + mode + ' table missing (' + path.relative(ROOT, TF) + '); build it with ' + (mode === 'role-v1' ? 'solver/arena/build_spreads.js' : 'solver/arena/build_observed_spreads.js'));
    const buf = fs.readFileSync(TF);
    tableSha = sha(buf);
    J = JSON.parse(buf.toString('utf8'));
    if (J.provenance.rule !== SPR.RULE_TEXT)
      throw new Error('spread_source: solver/rotom/spreads.js\'s rule has changed since ' + mode + ' was built; a new rule is a new spread version, never a silent mix');
    if (mode === 'observed-v1') {
      /* the observed inputs are pinned: the role-v1 base, the observed rule, every Smogon file of the chain */
      if (J.provenance.base.sha256 !== sha(fs.readFileSync(TABLE_FILE))) throw new Error('spread_source: role-v1 has moved since observed-v1 was built; rebuild it as a new version');
      if (J.provenance.observed.rule !== SPR.OBSERVED_RULE_TEXT) throw new Error('spread_source: the observed hook\'s rule has changed since observed-v1 was built; a new rule is a new version');
      for (const f of J.provenance.observed.files) {
        const fp = path.join(ROOT, f.file);
        if (!fs.existsSync(fp) || sha(fs.readFileSync(fp)) !== f.sha256) throw new Error('spread_source: observed-v1 pins ' + f.file + ' at ' + f.sha256.slice(0, 12) + ' and it is missing or has moved');
      }
      const lv = J.provenance.observed.files.map(f => SPR.loadObserved(path.join(ROOT, f.file)).chain[0]);
      J.provenance.observed.files.forEach((f, k) => Object.assign(lv[k], { format: f.format, cutoff: f.cutoff }));
      OBS = { file: lv[0].file, sha256: lv[0].sha256, chain: lv };
    }
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
      const o = OBS ? SPR.observedSpread(row, OBS) : null;
      if (o) { v = encode(o.evs, SPR.role(row).role); COUNTERS.observed_at_play++; J.spreads[k] = v; }
      else {
        try { v = derive(row); COUNTERS.derived_at_play++; J.spreads[k] = v; }
        catch (e) { COUNTERS.flat_fallback++; return null; }
      }
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
  /* ONE BODY, ONE LINE: every body this source lays — a team body (dress) or a fresh one (bodyBuilder) — goes through
   * here, so the two cannot drift again (they did: abra/regmc 1.49.0 dressed the team and left the rollout's fresh body
   * on the table line; solver/tests/test-miltank.js SWAP went red). `sp` null = the body keeps the table line. */
  function lay(m, row, sp, dressed, flat) {
    if (!sp) { COUNTERS[flat]++; return false; }
    if (W.applySpread(m, sp, row)) { COUNTERS[dressed]++; return true; }
    COUNTERS[flat]++; return false;
  }
  /* one team body, before it carries `_solverSheet` (solver/arena/teams.js buildTeam): the same call, in the same order,
   * as bodyBuilder's fresh body, so the two are the same object graph key for key (the battle digest reads key order) */
  function layOne(m, row, sp) { return lay(m, row, sp, 'bodies_dressed', 'bodies_flat'); }
  function dress(team, rows, evsBySheet) {
    let n = 0;
    for (const m of team) {
      const s = m._solverSheet;
      if (lay(m, rows[s], evsBySheet ? evsBySheet[s] : null, 'bodies_dressed', 'bodies_flat')) n++;
    }
    return n;
  }
  function bodyBuilder(buildBody, o) {
    const view = (o && o.view) || 'truth';
    if (view !== 'truth' && view !== 'public') throw new Error('spread_source.bodyBuilder: view must be truth or public, not ' + view);
    if (view === 'public') return (Mx, row, opts) => {
      const b = buildBody(Mx, row, opts);
      if (b && W.applySpread(b, XW.ZERO, row)) COUNTERS.fresh_public++;
      return b;
    };
    if (!TABLES[mode] || FRESH_BREAK === 'flat') return (Mx, row, opts) => { const b = buildBody(Mx, row, opts); if (b) COUNTERS.fresh_flat++; return b; };
    return (Mx, row, opts) => {
      const b = buildBody(Mx, row, opts);
      if (b) lay(b, row, rowSpread(row), 'fresh_dressed', 'fresh_flat');
      return b;
    };
  }
  function stamp() {
    const shown = BREAK === 'stamp' ? 'flat' : mode;
    const base = { spreads: shown, modes: MODES, default: DEFAULT, counters: Object.assign({}, COUNTERS) };
    if (mode === 'flat') return Object.assign(base, { what: 'the engine table\'s flat per-species line (buildMon), no spread, no nature — the pre-1.49.0 omniscient / arena.js body' });
    if (mode === 'xatu-random') return Object.assign(base, { what: 'solver/xatu/worlds.js truthSpreads(sheets, battle seed) — the pre-1.49.0 honest match truth' });
    const keys = [...realised.keys()].sort();
    return Object.assign(base, { what: mode === 'role-v1' ? 'solver/rotom/spreads.js\'s rule (the ladder\'s until 1.72.0), per set, from the role-v1 table'
                                     : 'the ladder\'s spreads since 1.72.0, per set, from the observed-v1 table: a rotation set\'s recorded spread, else the tournament hook, else Smogon\'s Reg M-C moveset chain, else role-v1',
      table: Object.assign({ file: path.relative(ROOT, TF).split(path.sep).join('/'), sha256: tableSha, sets: Object.keys(J.spreads).length - COUNTERS.derived_at_play - COUNTERS.observed_at_play,
               release: J.provenance.release, rule_sha256: J.provenance.rule_sha256, population_sha256: J.provenance.population_sha256, store_sha256: J.provenance.store_sha256 },
               mode === 'observed-v1' ? { base_sha256: J.provenance.base.sha256, observed_files: J.provenance.observed.files.map(f => f.file + '@' + f.sha256.slice(0, 12)) } : {}),
      fielded: { sets: keys.length, sha256: sha(keys.map(k => k + '=' + realised.get(k)).join('\n')) } });
  }
  return { mode, spreadsFor, dress, layOne, bodyBuilder, stamp, rowSpread: TABLES[mode] ? rowSpread : () => null, COUNTERS, BROKEN: BREAK || FRESH_BREAK || null };
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
  const tm = modes.filter(m => TABLES[m]);
  if (tm.length && counters.flat_fallback) warnings.push('SPREADS: ' + counters.flat_fallback + ' ' + tm.join('/') + ' rows could not be derived and played the FLAT line');
  if (tm.length && counters.derived_at_play) warnings.push('SPREADS: ' + counters.derived_at_play + ' sets were not in the ' + tm.join('/') + ' table and were derived at play time (same rule, same population)');
  if (tm.length && counters.observed_at_play) warnings.push('SPREADS: ' + counters.observed_at_play + ' sets were not in the ' + tm.join('/') + ' table and took the pinned Smogon chain at play time');
  if (tm.length && !counters.bodies_dressed) warnings.push('SPREADS: ' + tm.join('/') + ' asked for and 0 bodies were dressed');
  const t = ok.find(s => s.table);
  return { spreads: modes.length === 1 ? modes[0] : (modes.length ? 'MIXED' : null), table: t ? t.table : null, what: ok[0] ? ok[0].what : null,
           counters, fielded_by_shard: ok.map(s => s.fielded || null), warnings };
}

module.exports = { open, mergeStamps, MODES, DEFAULT, TABLES, TABLE_FILE, OBS_TABLE_FILE, POP_FILE, encode, decode, population };
