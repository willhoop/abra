/* solver/rotom/spreads.js — the Stat Point spread of every set ROTOM plays on the ladder. Nothing here is typed.
 *
 * WHY (2026-09-30). Open sheets carry no Stat Points (the store's `evs` is null on every slot and the raw `|showteam|`
 * field is empty), so every rotation before this one gave every set the same derived spread — 32 HP, 32 in its attack
 * stat, 2 Speed — whatever the set was for. A Choice Scarf Garchomp ran 2 Speed; a Trick Room Farigiraf ran 2 Speed
 * too. The spread undercut the set's own item and role.
 *
 * THE FORMAT'S RULES, read, not typed. Total and per-stat cap from the bo3 TeamValidator (ruleTable.evLimit; the 32 cap
 * via solver/xatu/sd.js, asserted there against a validation run). IVs are 31 and the validator refuses anything else
 * ("this format requires all IVs to be 31"), so SP and the sheet's nature are the only speed levers. A stat is the
 * checkout's own statModify (data/mods/champions/scripts.ts: base + SP + 20, THEN the nature's x1.1 / x0.9).
 *
 * SOURCE ORDER (the hook). spreadFor() asks, in order:
 *   1. OBSERVED — a Reg M-C spread table for this format, if one exists: Smogon's monthly moveset file
 *      data/smogon-stats/<YYYY-MM>/moveset/<format>-<cutoff>.txt. The most-used spread listed for the set's BATTLE forme
 *      WITH THE SHEET'S NATURE is taken (the nature is the pilot's and is never overridden), asked down a chain: the bo3
 *      file at the highest cutoff first, then the lower cutoffs, then the bo1 files, each level only if the spread's
 *      weighted count clears OBS_MIN_WEIGHT (OBSERVED_RULE_TEXT below). Reg M-B files never match the format name and are
 *      never read. The September 2026 files landed 2026-10-01 (abra/regmc 1.72.0).
 *   2. DERIVED from the set's own role against the top-meta population (below).
 *
 * THE POPULATION. The distinct (player, six) teams at or above the top-meta floor (the q0.99 rating quantile of rated
 * human open-sheet bo3 sides — the same floor, the same quality filter and the same sides as build_top_rotation.js),
 * each read from its highest-rated complete sheet. Every slot weighs 1 / teams. Recorded by store sha256.
 *
 * THE DERIVATION — one principle, "beat the median opponent with the least SP, or spend nothing", in role order:
 *   ROLE, from the set alone: `fast` if it holds Choice Scarf or carries Tailwind; `trickroom` if it carries Trick Room;
 *        a set with both roles is `other` and is named in the output.
 *   SPEED. fast -> the cap. trickroom -> 0. other -> against the TIERS: the population's EFFECTIVE speeds (the sim's
 *        getActionSpeed on a neutral field: Scarf, the mega forme, abilities — all the engine's) with every member at the
 *        top of its speed options (Trick Room sets at 0), weighted. A set whose cap speed reaches the TOP_TIER (0.75)
 *        quantile runs the cap; otherwise the least SP that strictly beats the heaviest tier between its own speed at 0
 *        SP and at the cap (the most common set it can flip by investing); 0 if there is none. (A fixed point — the
 *        median of the rule's own output — was tried first and does not exist: speed creep cycles, 114 -> 138 and back,
 *        on the 2026-09-30 store. So the tiers assume the opponent invested.)
 *        REPLACED 2026-09-30: until then `other` took the least SP beating the weighted MEDIAN, so a fast species already
 *        above the median at 0 SP ran 0 (Sneasler, Gengar-Mega) and lost to its own invested tier on the ladder.
 *   BULK. Every population set attacks with its strongest move against this set (the sim's getDamage, top roll, no
 *        crit, a spread move at the spread modifier, a fixed multi-hit count multiplied; the attacker's attack stat at
 *        the cap with its own nature, on a neutral field, both at full HP). A hit is survived when the damage is below
 *        this set's HP; a set whose item or ability endures any hit from full (the sim's Damage event says so) survives
 *        all of them. Bulk = the least HP + Def + SpD SP (within what Speed left) that survives at least the weighted
 *        MEDIAN attacker; if it survives that at 0, 0; if no split reaches it, 0.
 *   ATTACK. The rest into the attacking stat its moves use more (dex move category; the base stat breaks a tie), capped.
 *   REMAINDER. Anything the cap leaves goes to the HP / Def / SpD split that survives the most attacker weight.
 *   Ties break by more HP, then Def, then SpD. Mega formes are used for everything but HP (the sim fixes max HP at build).
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('../arena/env.js');
const X = require('../human/dex.js');
const SD = require('../xatu/sd.js');

const toID = X.toID;
const ROOT = path.join(__dirname, '..', '..');
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const SP_TOTAL = SD.SP_TOTAL, SP_CAP = SD.SP_CAP;
const N = SP_CAP + 1;
const MEDIAN = 0.5;                 // survive the median attacker of the top-meta population
const TOP_TIER = 0.75;              // a set whose cap speed reaches this quantile of the population's speeds runs the cap
const SPREADS_BREAK = (process.env && process.env.SPREADS_BREAK) || '';
const RULE_TEXT = 'solver/rotom/spreads.js: OBSERVED Reg M-C spread (Smogon moveset file for ' + X.FORMAT + ', modal spread for the species with the sheet nature) if one exists, else DERIVED: role from the set (Choice Scarf or Tailwind -> Speed at the cap; Trick Room -> Speed 0; else, with the top-meta population\'s effective speeds at full Speed investment as the tiers: the cap when the set\'s cap speed reaches the weighted ' + TOP_TIER + ' quantile of those tiers, otherwise the least SP that strictly outspeeds the heaviest tier between its speed at 0 SP and its speed at the cap, or 0 if there is none); then the least HP/Def/SpD SP that survives the weighted median top-meta attacker\'s best hit (top roll), or 0; the rest into the used attacking stat; any remainder to the bulk split surviving most. Nature and IVs are the sheet\'s / the format\'s.';

const evStr = e => STATS.map(s => e[s]).join('/');

/* ---------------- 1. the OBSERVED hook ---------------- */
/* Smogon moveset text -> { speciesId: { name, raw, avg_weight, abilities, items, spreads: [{nature, evs, pct}], moves } }.
 * Each species block is a boxed title line followed by sections; the "Spreads" section lists
 * "Nature:hp/atk/def/spa/spd/spe pct%". The numbers ARE Champions Stat Points: measured over the eight September 2026
 * Reg M-C files (2026-10-01), no listed spread has a stat above 32 or a total above 66 (the format's cap and evLimit),
 * so nothing is converted. A mega is its own block under its mega forme ("Salamence-Mega", items: its stone 100%). */
const SECTIONS = /^(Abilities|Items|Spreads|Moves|Teammates|Checks and Counters|Tera Types)$/;
function parseMovesetFull(text) {
  const out = {};
  const lines = text.split(/\r?\n/).map(l => l.replace(/^\s*\|\s?/, '').replace(/\s*\|\s*$/, '').trim());
  const raw = text.split(/\r?\n/);
  let cur = null, sec = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\+-+\+$/.test(raw[i].trim())) { sec = null; continue; }
    const prevSep = i > 0 && /^\+-+\+$/.test(raw[i - 1].trim()), nextSep = i + 1 < raw.length && /^\+-+\+$/.test(raw[i + 1].trim());
    if (prevSep && nextSep && l && !/^(Raw count|Avg\. weight|Viability|Abilities|Items|Spreads|Moves|Teammates|Checks)/.test(l)) {
      const sp = X.D.species.get(l); const id = sp.exists ? sp.id : toID(l);
      cur = out[id] = out[id] || { name: l, raw: null, avg_weight: null, abilities: [], items: [], spreads: [], moves: [] }; continue;
    }
    if (!cur) continue;
    let m;
    if ((m = /^Raw count:\s*(\d+)/.exec(l))) { cur.raw = +m[1]; continue; }
    if ((m = /^Avg\. weight:\s*([\d.eE+-]+)/.exec(l))) { cur.avg_weight = +m[1]; continue; }
    if (SECTIONS.test(l)) { sec = l; continue; }
    if (sec === 'Spreads') {
      if ((m = /^([A-Za-z]+):(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\s+([\d.]+)%$/.exec(l))) cur.spreads.push({ nature: m[1], evs: { hp: +m[2], atk: +m[3], def: +m[4], spa: +m[5], spd: +m[6], spe: +m[7] }, pct: +m[8] });
    } else if (sec === 'Items' || sec === 'Abilities' || sec === 'Moves') {
      if ((m = /^(.+?)\s+([\d.]+)%$/.exec(l)) && m[1] !== 'Other') cur[sec.toLowerCase()].push({ name: m[1], pct: +m[2] });
    }
  }
  return out;
}
/* the spreads only, { speciesId: [{nature, evs, pct}] } (the 1.35.0 shape every caller reads) */
function parseMoveset(text) {
  const F = parseMovesetFull(text), out = {};
  for (const [id, e] of Object.entries(F)) out[id] = e.spreads;
  return out;
}
/* THE CHAIN (2026-10-01, abra/regmc 1.72.0). The newest month holding any Reg M-C moveset file, in the order a set asks:
 * the bo3 (open sheet) file at each cutoff, highest first, then the bo1 file the same way. Reg M-B files never match. */
function findObservedChain(dir) {
  dir = dir || path.join(ROOT, 'data', 'smogon-stats');
  if (!fs.existsSync(dir)) return [];
  const fmts = [X.FORMAT, X.SINGLES_FORMAT].filter(Boolean);
  const months = fs.readdirSync(dir).filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse();
  for (const m of months) {
    const md = path.join(dir, m, 'moveset');
    if (!fs.existsSync(md)) continue;
    const have = fs.readdirSync(md);
    const chain = [];
    for (const fmt of fmts) {
      const re = new RegExp('^' + fmt + '-(\\d+)\\.txt$');
      for (const x of have.map(f => ({ f, m: re.exec(f) })).filter(x => x.m).sort((a, b) => +b.m[1] - +a.m[1]))
        chain.push({ file: path.join(md, x.f), month: m, format: fmt, cutoff: +x.m[1] });
    }
    if (chain.length) return chain;
  }
  return [];
}
/* the newest Reg M-C moveset file for this format (bo3 preferred), highest cutoff; null if none exists. */
function findObserved(dir) {
  const c = findObservedChain(dir).filter(x => x.format === X.FORMAT);
  return c.length ? c[0].file : null;
}
const relRoot = f => path.relative(ROOT, f).split(path.sep).join('/');
function level(f, meta) {
  const buf = fs.readFileSync(f);
  const full = parseMovesetFull(buf.toString('utf8'));
  const bySpecies = {}; for (const [id, e] of Object.entries(full)) bySpecies[id] = e.spreads;
  return Object.assign({ file: relRoot(f), sha256: crypto.createHash('sha256').update(buf).digest('hex'), bySpecies, full }, meta || {});
}
let _obs;
/* loadObserved()      the whole chain (findObservedChain), cached: { file, sha256 (the first level), files, chain, bySpecies }
 * loadObserved(file)  that one file as a one-level chain (DUSK's fold-in, a test) */
function loadObserved(file) {
  if (file === undefined && _obs !== undefined) return _obs;
  let v = null;
  if (file === undefined) {
    const chain = findObservedChain().map(c => level(c.file, { month: c.month, format: c.format, cutoff: c.cutoff }));
    if (chain.length) v = { file: chain[0].file, sha256: chain[0].sha256, files: chain.map(c => ({ file: c.file, sha256: c.sha256, format: c.format, cutoff: c.cutoff })), chain, bySpecies: chain[0].bySpecies };
    _obs = v;
  } else if (file) {
    const L = level(file);
    v = { file: L.file, sha256: L.sha256, files: [{ file: L.file, sha256: L.sha256 }], chain: [L], bySpecies: L.bySpecies };
  }
  return v;
}
/* ENOUGH USAGE, pre-registered 2026-10-01 before any coverage was read: a listed spread is taken from a level only if
 * its WEIGHTED count there — Raw count x Avg. weight x share — is at least OBS_MIN_WEIGHT (the file's own percentages are
 * over that weighted count, so this is how many rating-weighted team appearances carried the spread). A level whose
 * block gives no Raw count / Avg. weight (a synthetic fixture) is not gated. */
const OBS_MIN_WEIGHT = 25;
const OBSERVED_RULE_TEXT = 'solver/rotom/spreads.js observed hook (abra/regmc 1.72.0): the newest month\'s Reg M-C Smogon moveset files, asked in order bo3 (' + X.FORMAT + ') at cutoff 1760, 1630, 1500, 0, then bo1 (' + X.SINGLES_FORMAT + ') the same way; at each, the block of the set\'s BATTLE forme (species + its own mega stone -> the mega forme), the highest-share listed spread with the sheet\'s nature, taken if its weighted count (Raw count x Avg. weight x share) is >= ' + OBS_MIN_WEIGHT + ' and it is within the format\'s total and cap (a Choice Scarf set: only a spread with Speed at the cap; a Trick Room set: only Speed 0); else the next level; else derived. Smogon publishes spreads and items as separate marginals, so beyond the mega stone (the forme) and Choice Scarf (the Speed constraint) the item cannot key the spread.';
/* the observed spread for a sheet row, or null. */
function observedSpread(row, obs) {
  if (!obs) return null;
  const id = X.D.species.get(forme(row).species).id;
  const nat = X.D.natures.get(row.nature).name;
  const levels = obs.chain || [{ file: obs.file, bySpecies: obs.bySpecies }];
  /* THE ITEM, where the data can carry it. Smogon's spreads are per forme and do not say which item they ran with, so a
   * Choice Scarf set would otherwise take the modal spread of the species' other items (measured 2026-10-01: Choice
   * Scarf Gholdengo, Modest, was handed a 10 Speed SP spread). A set holding Choice Scarf takes only a listed spread with
   * Speed at the cap; a Trick Room set (no speed-up on the sheet) only one with Speed 0. Decided before the rotations were
   * re-spread. Deliberate break: env SPREADS_BREAK=itemblind turns it off (test-rotom-spreads HOOK must go red). */
  const r = role(row), scarf = toID(row.item) === 'choicescarf' && r.role === 'fast';
  const fits = x => SPREADS_BREAK === 'itemblind' ? true : scarf ? x.evs.spe === SP_CAP : r.role === 'trickroom' ? x.evs.spe === 0 : true;
  for (let k = 0; k < levels.length; k++) {
    const L = levels[k];
    const list = (L.bySpecies && L.bySpecies[id]) || [];
    const hit = list.filter(x => X.D.natures.get(x.nature).name === nat && fits(x)).sort((a, b) => b.pct - a.pct)[0];
    if (!hit) continue;
    const tot = STATS.reduce((a, s) => a + hit.evs[s], 0);
    if (tot > SP_TOTAL || STATS.some(s => hit.evs[s] > SP_CAP)) continue;
    const e = L.full && L.full[id];
    const w = e && e.raw != null && e.avg_weight != null ? e.raw * e.avg_weight * hit.pct / 100 : null;
    if (w != null && w < OBS_MIN_WEIGHT) continue;
    return { evs: Object.assign({}, hit.evs), pct: hit.pct, file: L.file, level: k, format: L.format || null, cutoff: L.cutoff == null ? null : L.cutoff, weight: w == null ? null : +w.toFixed(1), forme: id };
  }
  return null;
}

/* ---------------- 0. the TOURNAMENT hook (2026-10-01) ---------------- */
/* A spread a player actually ran, from the tournament store (data/tournaments/<regulation>/, solver/tournaments/). It is
 * asked BEFORE the Smogon file: a top-cut player's own set beats a ladder-wide modal spread. The key is the set's
 * species + item + nature (Will, 2026-10-01): the item fixes the role far better than the species alone (a Choice Scarf
 * and a Life Orb Garchomp are different Pokemon), and the nature is the pilot's and is never overridden. Among several
 * published spreads for one key, the best-placed team's wins (placing, then the bigger event, then the team id), so the
 * pick is deterministic and says whose it is. Only spreads the paste itself classifies as Champions Stat Points
 * (every set's total <= the format budget) are read, and each is re-checked against the format's total and cap here.
 * An OPEN TEAM SHEET CARRIES NO SPREADS, so a store of OTS pastes contributes nothing and every set falls through to the
 * Smogon file and then to the derivation — the provenance block counts how many keys the store could serve. */
const tourKey = (species, item, nature) => [X.D.species.get(species).id || toID(species), toID(item), toID(X.D.natures.get(nature).name || nature)].join('|');
function loadTournament(regulation, root) {
  regulation = regulation || process.env.ABRA_REGULATION || 'regmc';
  let ST;
  try { ST = require('../tournaments/store.js'); } catch (e) { return null; }
  const evs = ST.events(regulation, root);
  const by = new Map();
  let teams = 0, withSp = 0, sets = 0, setsSp = 0;
  for (const e of evs) {
    const f = path.join(ST.dirs(regulation, root).base, e.shard);
    for (const t of ST.readShard(f)) {
      teams++;
      if (t.spread_kind === 'stat_points') withSp++;
      for (const s of t.sets || []) {
        sets++;
        if (t.spread_kind !== 'stat_points' || !s.evs) continue;
        const tot = STATS.reduce((a, k) => a + (s.evs[k] || 0), 0);
        if (tot > SP_TOTAL || STATS.some(k => (s.evs[k] || 0) > SP_CAP)) continue;
        setsSp++;
        const k = tourKey(s.species, s.item, s.nature);
        const list = by.get(k) || []; list.push({ evs: Object.assign(zero(), s.evs), team_id: t.team_id, placing: t.placing, players: e.players || 0, event: e.key });
        by.set(k, list);
      }
    }
  }
  for (const list of by.values()) list.sort((a, b) => a.placing - b.placing || b.players - a.players || (a.team_id < b.team_id ? -1 : 1));
  return { regulation, dir: path.relative(ROOT, ST.dirs(regulation, root).base).split(path.sep).join('/'),
           events: evs.map(e => ({ key: e.key, shard_sha256: e.shard_sha256 })), teams, teams_with_spreads: withSp, sets, sets_with_spreads: setsSp, keys: by.size, bySet: by };
}
function tournamentSpread(row, tour) {
  if (!tour || !tour.bySet) return null;
  const list = tour.bySet.get(tourKey(row.species, row.item || '', row.nature));
  if (!list || !list.length) return null;
  return { evs: Object.assign({}, list[0].evs), team_id: list[0].team_id, n: list.length };
}
const TOURNAMENT_RULE_TEXT = 'solver/rotom/spreads.js tournament hook: before the Smogon file, the Stat Points a player published for the same species + item + nature in the tournament store (data/tournaments/<regulation>/), the best-placed team first; open team sheets carry none.';

/* ---------------- the set, read from the dex ---------------- */
function role(row) {
  const mv = new Set((row.moves || []).map(toID));
  const scarf = toID(row.item) === 'choicescarf', tw = mv.has('tailwind'), tr = mv.has('trickroom');
  if ((scarf || tw) && tr) return { role: 'other', conflict: 'both a speed-up (' + (scarf ? 'Choice Scarf' : 'Tailwind') + ') and Trick Room' };
  if (scarf || tw) return { role: 'fast', by: scarf ? 'Choice Scarf' : 'Tailwind' };
  if (tr) return { role: 'trickroom', by: 'Trick Room' };
  return { role: 'other' };
}
function attackStat(row) {
  let phys = 0, spec = 0;
  for (const mv of row.moves || []) { const m = X.D.moves.get(toID(mv)); if (!m.exists) continue; if (m.category === 'Physical') phys++; else if (m.category === 'Special') spec++; }
  if (!phys && !spec) return null;
  const sp = X.D.species.get(toID(row.species));
  return phys > spec ? 'atk' : spec > phys ? 'spa' : (sp.baseStats.atk >= sp.baseStats.spa ? 'atk' : 'spa');
}
/* the forme it battles in: the mega its own stone makes, else the sheet species */
function forme(row) {
  const sp = X.D.species.get(row.species), it = X.D.items.get(row.item || '');
  const mega = it.exists && it.megaStone && typeof it.megaStone === 'object' ? it.megaStone[sp.name] : (it.megaEvolves === sp.name ? it.megaStone : null);
  if (mega) { const ms = X.D.species.get(mega); if (ms.exists) return { species: ms.name, ability: ms.abilities['0'], mega: true }; }
  return { species: sp.name, ability: X.D.abilities.get(row.ability).name, mega: false };
}
const setKey = r => [X.D.species.get(r.species).id, toID(r.item), toID(r.ability), toID(r.nature), (r.moves || []).map(toID).sort().join(',')].join('|');

/* ---------------- staging: a real sim battle, the two sets active, the field neutral ---------------- */
function sheetOf(row) { return { species: row.species, item: row.item || '', ability: row.ability || '', moves: row.moves.slice(), nature: row.nature, gender: '', level: 50 }; }
function stage(defRow, atkRow, spDef, spAtk) {
  const b = new SD.Battle({ formatid: X.FORMAT, seed: [7, 7, 7, 7] });
  b.setPlayer('p1', { name: 'p1', team: SD.Teams.pack([defRow, defRow].map(sheetOf).map(SD.toSet)) });
  b.setPlayer('p2', { name: 'p2', team: SD.Teams.pack([atkRow, atkRow].map(sheetOf).map(SD.toSet)) });
  b.choose('p1', 'team 12'); b.choose('p2', 'team 12');
  b.__baseLog = b.log.length;
  b.randomChance = () => false;
  const mon = (row, idx) => { const f = forme(row); return { species: f.species, sheetSpecies: X.D.species.get(row.species).name, ability: f.ability, item: row.item || '', nature: row.nature, idx, boosts: {}, vol: {}, status: '' }; };
  const snap = { field: { weather: '', terrain: '', pseudo: [] },
    sides: { p1: { totalFainted: 0, active: [mon(defRow, 0), null], conditions: [] }, p2: { totalFainted: 0, active: [mon(atkRow, 0), null], conditions: [] } } };
  SD.applySnapshot(b, snap, { p1: { 0: spDef }, p2: { 0: spAtk } });
  return { b, def: b.p1.active[0], atk: b.p2.active[0], mDef: snap.sides.p1.active[0], mAtk: snap.sides.p2.active[0] };
}
const zero = () => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

/* ---------------- the population ---------------- */
/* sides: [{g, s, r, player, six}] at or above the floor (build_top_rotation.topSides). rowOf: a store sheet row -> a
 * named row or null. -> [{row, w, key}] one per (player, six) team slot, weights summing to 6. */
function population(sides, rowOf) {
  const best = new Map();
  for (const x of sides.slice().sort((a, b) => b.r - a.r || (a.g.id < b.g.id ? -1 : 1))) {
    const k = x.player + '|' + x.six.slice().sort().join(',');
    if (best.has(k)) continue;
    const sheet = x.g.sheets && x.g.sheets[x.s];
    if (!sheet || sheet.length !== 6) continue;
    const rows = sheet.map(rowOf);
    if (rows.some(r => !r)) continue;
    best.set(k, rows);
  }
  const teams = [...best.values()];
  const out = [];
  for (const rows of teams) for (const r of rows) out.push({ row: r, w: 1 / teams.length, key: setKey(r) });
  return { slots: out, teams: teams.length };
}

class Deriver {
  constructor(pop, opts) {
    this.pop = pop; this.opts = opts || {};
    this.obs = this.opts.observed === undefined ? loadObserved() : this.opts.observed;
    /* the tournament store (0. above); opts.tournament: null turns it off, an object replaces it (the tests). A published
     * tournament spread IS an observed spread, so a caller that pins the observed hook off (`observed: null`: the arena's
     * role-v1 table and its play-time derivations) gets the tournament hook off too, and its figures cannot move when the
     * store gains a paste with spreads. */
    this.tour = this.opts.tournament !== undefined ? this.opts.tournament : this.opts.observed === null ? null : loadTournament();
    /* unique sets with summed weight */
    const u = new Map();
    for (const s of pop.slots) { const e = u.get(s.key); if (e) e.w += s.w; else u.set(s.key, { row: s.row, w: s.w, key: s.key }); }
    this.uniq = [...u.values()].sort((a, b) => b.w - a.w || (a.key < b.key ? -1 : 1));
    this._spe = new Map(); this._hits = new Map();
    this.counters = { battles: 0, damage_calls: 0, no_damage: 0, endures: 0, observed: 0, derived: 0, tournament: 0 };
    this.speedEquilibrium();
  }
  /* effective speed at every SP 0..cap, by the sim */
  speeds(row) {
    const k = setKey(row);
    if (this._spe.has(k)) return this._spe.get(k);
    const st = stage(row, row, zero(), zero()); this.counters.battles++;
    const f = forme(row);
    const raw = []; for (let v = 0; v < N; v++) raw.push(SD.statValue(f.species, row.nature, 'spe', v));
    const eff = SD.actionSpeeds(st.b, st.def, raw);
    this._spe.set(k, eff);
    return eff;
  }
  static leastAbove(eff, M) { for (let v = 0; v < N; v++) if (eff[v] > M) return v; return -1; }
  static wMedian(pairs) {   // [[value, weight]]
    const s = pairs.slice().sort((a, b) => a[0] - b[0]); const tot = s.reduce((a, x) => a + x[1], 0);
    let c = 0; for (const [v, w] of s) { c += w; if (c >= tot * MEDIAN - 1e-12) return v; } return s[s.length - 1][0];
  }
  /* SPEED FOR AN `other` SET (2026-09-30, docs/_reports/2026-09-30-rotom-world-fixes.md). The 1.35.0 rule took the least
   * SP that beat the population median M — and a fast species already above M at 0 SP (Sneasler, Gengar-Mega, Raichu on
   * the 2026-09-30 store) got 0, so it lost to every invested member of its own tier (chomp1 games 9 and 26). The rule now:
   *   TOP TIER  the set's cap speed is at or above the population's TOP_TIER quantile (every member at the top of its
   *             speed options) -> the cap: a set that lives among the fastest competes with its own tier and its mirror.
   *   ELSE      the most common tier it can FLIP by investing: of the population's full-investment speeds in
   *             [its speed at 0 SP, its speed at the cap), the one with the most weight (a tie -> the faster); the least
   *             SP that strictly beats it. No such tier -> 0 (investing outspeeds nothing it does not already).
   * DELIBERATE BREAK (env SPREADS_BREAK=median): the 1.35.0 rule. solver/tests/test-rotom-spreads.js TIER must go red. */
  speedFor(row, M) {
    const r = role(row);
    if (r.role === 'fast') return SP_CAP;
    if (r.role === 'trickroom') return 0;
    const eff = this.speeds(row);
    if (SPREADS_BREAK === 'median') { const v = Deriver.leastAbove(eff, M); return v < 0 ? 0 : v; }
    if (eff[SP_CAP] >= this.eq.top_speed) return SP_CAP;
    const t = Deriver.flipTier(this.eq.tiers, eff);
    return t == null ? 0 : Deriver.leastAbove(eff, t);
  }
  /* the heaviest population speed tier in [eff[0], eff[cap]) (a tie -> the faster), or null */
  static flipTier(tiers, eff) {
    let best = null;
    for (const [s, w] of tiers) if (s >= eff[0] && s < eff[SP_CAP] && (!best || w > best[1] + 1e-12 || (Math.abs(w - best[1]) <= 1e-12 && s > best[0]))) best = [s, w];
    return best ? best[0] : null;
  }
  static wQuantile(pairs, q) {
    const s = pairs.slice().sort((a, b) => a[0] - b[0]); const tot = s.reduce((a, x) => a + x[1], 0);
    let c = 0; for (const [v, w] of s) { c += w; if (c >= tot * q - 1e-12) return v; } return s[s.length - 1][0];
  }
  /* the benchmark: the population's weighted median EFFECTIVE speed with every member at the top of its speed options
   * (Trick Room sets at 0) — "beat the median opponent even if it invested fully". Not a fixed point of this rule: that
   * was tried and it does not exist — best-responding to the median creeps it 114 -> 138 and then falls back
   * (speed creep has no pure equilibrium), so the benchmark is stated against full investment instead. */
  speedEquilibrium() {
    const pairs = this.uniq.map(u => [this.speeds(u.row)[role(u.row).role === 'trickroom' ? 0 : SP_CAP], u.w]);
    const M = Deriver.wMedian(pairs);
    const tiers = new Map(); for (const [s, w] of pairs) tiers.set(s, (tiers.get(s) || 0) + w);
    this.eq = { median_speed: M, top_speed: Deriver.wQuantile(pairs, TOP_TIER), top_quantile: TOP_TIER,
                tiers: [...tiers.entries()].sort((a, b) => a[0] - b[0]).map(([s, w]) => [s, +w.toFixed(6)]),
                benchmark: 'weighted effective speeds of the top-meta population, every set at the top of its speed options (Trick Room sets at 0), sheet natures, neutral field: the median (bulk and the record), the top-tier quantile, and the tiers (speed -> weight)' };
  }
  /* for one defending set: per population attacker, its physical and special max-damage tables over the defending
   * stat 0..cap, whether the defender endures any hit from full, and the weight. */
  hits(row) {
    const k = setKey(row);
    if (this._hits.has(k)) return this._hits.get(k);
    const f = forme(row);
    const out = [];
    let endures = null;
    for (const a of this.uniq) {
      const as = attackStat(a.row); if (!as) { out.push({ w: a.w, none: true }); continue; }
      const spA = zero(); spA[as] = SP_CAP;
      const st = stage(row, a.row, zero(), spA); this.counters.battles++;
      const tables = { def: new Array(N).fill(0), spd: new Array(N).fill(0) };
      let any = false;
      for (const mv of a.row.moves) {
        const m = X.D.moves.get(mv);
        if (!m.exists || m.category === 'Status' || m.ohko) continue;
        const spread = m.target === 'allAdjacentFoes' || m.target === 'allAdjacent';
        const which = m.overrideDefensiveStat || (m.category === 'Physical' ? 'def' : 'spd');
        const hitsN = typeof m.multihit === 'number' ? m.multihit : Array.isArray(m.multihit) ? (toID(st.atk.ability) === 'skilllink' ? m.multihit[1] : m.multihit[0]) : 1;
        for (let v = 0; v < N; v++) {
          st.def.storedStats[which] = SD.statValue(f.species, row.nature, which, v);
          const d = SD.damageRange(st.b, st.atk, st.def, m.name, { spread }); this.counters.damage_calls++;
          if (!d) { if (v === 0) this.counters.no_damage++; break; }
          any = true;
          tables[which][v] = Math.max(tables[which][v], d[1] * hitsN);
        }
      }
      if (endures === null && any) {
        /* does anything this set holds let it survive any single hit from full? ask the sim's Damage event */
        const hp = st.def.maxhp; st.def.hp = hp;
        const mvName = a.row.moves.find(mv => { const m = X.D.moves.get(mv); return m.exists && m.category !== 'Status' && !m.ohko; });
        const move = st.b.dex.getActiveMove(toID(mvName));
        const got = st.b.runEvent('Damage', st.def, st.atk, move, hp * 4, true);
        st.b.log.length = st.b.__baseLog;
        endures = typeof got === 'number' && got < hp;
        if (endures) this.counters.endures++;
      }
      out.push({ w: a.w, none: !any, t: tables });
    }
    const res = { list: out, endures: !!endures, totalW: out.reduce((s, x) => s + x.w, 0) };
    this._hits.set(k, res);
    return res;
  }
  /* weighted share of attackers survived at (hp, def, spd) SP */
  static share(H, hpVal) {
    return (d, s) => { let w = 0; for (const x of H.list) if (x.none || H.endures || Math.max(x.t.def[d], x.t.spd[s]) < hpVal) w += x.w; return w / H.totalW; };
  }
  bestBulk(row, budget, floorVec, needShare) {
    const H = this.hits(row);
    const hpv = []; for (let v = 0; v < N; v++) hpv.push(SD.statValue(X.D.species.get(row.species).name, row.nature, 'hp', v));
    let best = null;
    const f0 = floorVec || { hp: 0, def: 0, spd: 0 };
    for (let h = f0.hp; h < N; h++) {
      const sh = Deriver.share(H, hpv[h]);
      for (let d = f0.def; d < N && h + d <= budget; d++) for (let s = f0.spd; s < N && h + d + s <= budget; s++) {
        const v = sh(d, s), tot = h + d + s;
        const c = { hp: h, def: d, spd: s, tot, share: v };
        if (needShare != null) {
          if (v < needShare) continue;
          if (!best || tot < best.tot || (tot === best.tot && (v > best.share || (v === best.share && (h > best.hp || (h === best.hp && d > best.def)))))) best = c;
        } else {
          if (tot !== budget) continue;
          if (!best || v > best.share || (v === best.share && (h > best.hp || (h === best.hp && d > best.def)))) best = c;
        }
      }
    }
    return { best, H, hpv, at0: Deriver.share(H, hpv[f0.hp])(f0.def, f0.spd) };
  }
  derive(row) {
    const r = role(row);
    const spe = this.speedFor(row, this.eq.median_speed);
    const evs = zero(); evs.spe = spe;
    const left = SP_TOTAL - spe;
    const first = this.bestBulk(row, left, null, MEDIAN);
    let bulk = first.at0 >= MEDIAN ? { hp: 0, def: 0, spd: 0, tot: 0, share: first.at0 } : first.best;
    const bulkWhy = first.at0 >= MEDIAN ? 'survives the median attacker at 0 SP' : bulk ? 'least SP surviving the median attacker' : 'no split within ' + left + ' SP survives the median attacker; bulk 0';
    if (!bulk) bulk = { hp: 0, def: 0, spd: 0, tot: 0, share: first.at0 };
    const as = attackStat(row);
    let rest = left - bulk.tot;
    if (as) { evs[as] = Math.min(SP_CAP, rest); rest -= evs[as]; }
    let fin = bulk;
    if (rest > 0) fin = this.bestBulk(row, bulk.tot + rest, bulk, null).best;
    evs.hp = fin.hp; evs.def = fin.def; evs.spd = fin.spd;
    this.counters.derived++;
    return { evs, source: 'derived', role: r.role, role_by: r.by || null, conflict: r.conflict || null, attack_stat: as,
             speed: { sp: spe, effective: this.speeds(row)[spe], at_cap: this.speeds(row)[SP_CAP], median: this.eq.median_speed, top_tier: this.eq.top_speed,
                      why: r.role === 'fast' ? 'fast role: the cap' : r.role === 'trickroom' ? 'Trick Room: 0' : this.speeds(row)[SP_CAP] >= this.eq.top_speed ? 'top speed tier: the cap' : (() => { const t = Deriver.flipTier(this.eq.tiers, this.speeds(row)); return t == null ? 'no tier to flip: 0' : 'outspeeds the heaviest flippable tier ' + t; })() },
             bulk: { why: bulkWhy, share_survived: +fin.share.toFixed(3), share_at_zero: +first.at0.toFixed(3), endures: first.H.endures } };
  }
  spreadFor(row) {
    const tz = tournamentSpread(row, this.tour);
    if (tz) { this.counters.tournament++; return { evs: tz.evs, source: 'observed:tournament:' + this.tour.dir + ' ' + tz.team_id + (tz.n > 1 ? ' (best-placed of ' + tz.n + ')' : ''), role: role(row).role }; }
    const o = observedSpread(row, this.obs);
    if (o) { this.counters.observed++; return { evs: o.evs, source: 'observed:' + o.file + ' (' + o.pct + '%' + (o.weight != null ? ', weight ' + o.weight : '') + ')', role: role(row).role }; }
    return this.derive(row);
  }
  provenance() {
    return { rule: RULE_TEXT, observed: this.obs ? { file: this.obs.file, sha256: this.obs.sha256, rule: OBSERVED_RULE_TEXT, min_weight: OBS_MIN_WEIGHT, files: this.obs.files || [{ file: this.obs.file, sha256: this.obs.sha256 }] } : 'none: no Reg M-C Smogon moveset file for ' + X.FORMAT + ' under data/smogon-stats/',
             population: { teams: this.pop.teams, slots: this.pop.slots.length, unique_sets: this.uniq.length },
             speed_equilibrium: this.eq, median_quantile: MEDIAN, top_tier_quantile: TOP_TIER, counters: this.counters,
             tournament: this.tour ? { rule: TOURNAMENT_RULE_TEXT, dir: this.tour.dir, events: this.tour.events, teams: this.tour.teams, teams_with_spreads: this.tour.teams_with_spreads,
                                       sets: this.tour.sets, sets_with_spreads: this.tour.sets_with_spreads, keys: this.tour.keys } : 'none: no tournament store read' };
  }
}

/* a spread source that replays a rotation's RECORDED spreads (keyed by the set), for a rebuild that re-checks the team
 * choice without re-deriving: provenance() returns the recorded block, so a rebuild's output equals the file. */
function recorded(rot) {
  const m = new Map();
  for (const t of rot.teams) for (const z of t.spreads || []) m.set(setKey(z), z);
  return { spreadFor: row => { const z = m.get(setKey(row)); if (!z) throw new Error('spreads.recorded: no recorded spread for ' + setKey(row)); const o = Object.assign({}, z); delete o.species; delete o.nature; delete o.item; delete o.ability; delete o.moves; return o; },
           provenance: () => { const p = Object.assign({}, rot.spread_source); for (const k of ['store', 'store_sha256', 'floor']) delete p[k]; return p; } };
}

/* a whole team: rows -> [{species, ...set, evs, ...why}] (the set is recorded so the spread can be matched to it) */
function teamSpreads(D, rows) { return rows.map(r => Object.assign({ species: r.species, item: r.item, ability: r.ability, nature: r.nature, moves: r.moves.slice() }, D.spreadFor(r))); }

module.exports = { Deriver, population, teamSpreads, recorded, setKey, role, attackStat, forme, parseMoveset, parseMovesetFull, findObserved, findObservedChain, loadObserved, observedSpread, OBS_MIN_WEIGHT, OBSERVED_RULE_TEXT, loadTournament, tournamentSpread, tourKey, TOURNAMENT_RULE_TEXT, evStr, RULE_TEXT, SP_TOTAL, SP_CAP, MEDIAN, TOP_TIER };
