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
 *      data/smogon-stats/<YYYY-MM>/moveset/<format>-<cutoff>.txt (the September 2026 files are due about 2026-10-04).
 *      The most-used spread listed for the species WITH THE SHEET'S NATURE is taken (the nature is the pilot's and is
 *      never overridden). loadObserved() finds the newest month and the highest cutoff; Reg M-B files never match the
 *      format name and are never read. TODAY THERE IS NONE, so every set falls to 2.
 *   2. DERIVED from the set's own role against the top-meta population (below).
 *
 * THE POPULATION. The distinct (player, six) teams at or above the top-meta floor (the q0.99 rating quantile of rated
 * human open-sheet bo3 sides — the same floor, the same quality filter and the same sides as build_top_rotation.js),
 * each read from its highest-rated complete sheet. Every slot weighs 1 / teams. Recorded by store sha256.
 *
 * THE DERIVATION — one principle, "beat the median opponent with the least SP, or spend nothing", in role order:
 *   ROLE, from the set alone: `fast` if it holds Choice Scarf or carries Tailwind; `trickroom` if it carries Trick Room;
 *        a set with both roles is `other` and is named in the output.
 *   SPEED. fast -> the cap. trickroom -> 0. other -> the least SP whose EFFECTIVE speed (the sim's getActionSpeed on a
 *        neutral field: Scarf, the mega forme, abilities — all the engine's) strictly exceeds the population's weighted
 *        median effective speed with every member at the top of its speed options (Trick Room sets at 0); 0 if even the
 *        cap cannot. (A fixed point — the median of the rule's own output — was tried first and does not exist: speed
 *        creep cycles, 114 -> 138 and back, on the 2026-09-30 store. So the benchmark assumes the opponent invested.)
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
const MEDIAN = 0.5;                 // the one parameter: beat / survive the median member of the top-meta population
const RULE_TEXT = 'solver/rotom/spreads.js: OBSERVED Reg M-C spread (Smogon moveset file for ' + X.FORMAT + ', modal spread for the species with the sheet nature) if one exists, else DERIVED: role from the set (Choice Scarf or Tailwind -> Speed at the cap; Trick Room -> Speed 0; else the least SP that outspeeds the weighted median effective speed of the top-meta population at full Speed investment, or 0); then the least HP/Def/SpD SP that survives the weighted median top-meta attacker\'s best hit (top roll), or 0; the rest into the used attacking stat; any remainder to the bulk split surviving most. Nature and IVs are the sheet\'s / the format\'s.';

const evStr = e => STATS.map(s => e[s]).join('/');

/* ---------------- 1. the OBSERVED hook ---------------- */
/* Smogon moveset text -> { speciesId: [{nature, evs, pct}] }. Each species block is a boxed title line followed by
 * sections; the "Spreads" section lists "Nature:hp/atk/def/spa/spd/spe pct%". */
function parseMoveset(text) {
  const out = {};
  const lines = text.split(/\r?\n/).map(l => l.replace(/^\s*\|\s?/, '').replace(/\s*\|\s*$/, '').trim());
  const raw = text.split(/\r?\n/);
  let species = null, inSpreads = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\+-+\+$/.test(raw[i].trim())) { inSpreads = false; continue; }
    const prevSep = i > 0 && /^\+-+\+$/.test(raw[i - 1].trim()), nextSep = i + 1 < raw.length && /^\+-+\+$/.test(raw[i + 1].trim());
    if (prevSep && nextSep && l && !/^(Raw count|Abilities|Items|Spreads|Moves|Teammates|Checks)/.test(l)) {
      const sp = X.D.species.get(l); species = sp.exists ? sp.id : toID(l); out[species] = out[species] || []; continue;
    }
    if (l === 'Spreads') { inSpreads = true; continue; }
    if (/^(Abilities|Items|Moves|Teammates|Checks and Counters|Tera Types)$/.test(l)) { inSpreads = false; continue; }
    if (inSpreads && species) {
      const m = /^([A-Za-z]+):(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\s+([\d.]+)%$/.exec(l);
      if (m) out[species].push({ nature: m[1], evs: { hp: +m[2], atk: +m[3], def: +m[4], spa: +m[5], spd: +m[6], spe: +m[7] }, pct: +m[8] });
    }
  }
  return out;
}
/* the newest Reg M-C moveset file for this format (bo3 preferred), highest cutoff; null if none exists. */
function findObserved(dir) {
  dir = dir || path.join(ROOT, 'data', 'smogon-stats');
  if (!fs.existsSync(dir)) return null;
  const months = fs.readdirSync(dir).filter(m => /^\d{4}-\d{2}$/.test(m)).sort().reverse();
  for (const m of months) {
    const md = path.join(dir, m, 'moveset');
    if (!fs.existsSync(md)) continue;
    const files = fs.readdirSync(md).map(f => ({ f, m: new RegExp('^' + X.FORMAT + '-(\\d+)\\.txt$').exec(f) })).filter(x => x.m)
      .sort((a, b) => +b.m[1] - +a.m[1]);
    if (files.length) return path.join(md, files[0].f);
  }
  return null;
}
let _obs;
function loadObserved(file) {
  if (file === undefined && _obs !== undefined) return _obs;
  const f = file === undefined ? findObserved() : file;
  const v = f ? { file: path.relative(ROOT, f).split(path.sep).join('/'), sha256: crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'), bySpecies: parseMoveset(fs.readFileSync(f, 'utf8')) } : null;
  if (file === undefined) _obs = v;
  return v;
}
/* the observed spread for a sheet row, or null: the highest-share listed spread for its species with the sheet nature,
 * refused if it breaks the format's total or cap. */
function observedSpread(row, obs) {
  if (!obs) return null;
  const list = obs.bySpecies[X.D.species.get(row.species).id] || [];
  const nat = X.D.natures.get(row.nature).name;
  const hit = list.filter(x => X.D.natures.get(x.nature).name === nat).sort((a, b) => b.pct - a.pct)[0];
  if (!hit) return null;
  const tot = STATS.reduce((a, s) => a + hit.evs[s], 0);
  if (tot > SP_TOTAL || STATS.some(s => hit.evs[s] > SP_CAP)) return null;
  return { evs: Object.assign({}, hit.evs), pct: hit.pct };
}

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
    /* unique sets with summed weight */
    const u = new Map();
    for (const s of pop.slots) { const e = u.get(s.key); if (e) e.w += s.w; else u.set(s.key, { row: s.row, w: s.w, key: s.key }); }
    this.uniq = [...u.values()].sort((a, b) => b.w - a.w || (a.key < b.key ? -1 : 1));
    this._spe = new Map(); this._hits = new Map();
    this.counters = { battles: 0, damage_calls: 0, no_damage: 0, endures: 0, observed: 0, derived: 0 };
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
  speedFor(row, M) {
    const r = role(row);
    if (r.role === 'fast') return SP_CAP;
    if (r.role === 'trickroom') return 0;
    const v = Deriver.leastAbove(this.speeds(row), M);
    return v < 0 ? 0 : v;
  }
  /* the benchmark: the population's weighted median EFFECTIVE speed with every member at the top of its speed options
   * (Trick Room sets at 0) — "beat the median opponent even if it invested fully". Not a fixed point of this rule: that
   * was tried and it does not exist — best-responding to the median creeps it 114 -> 138 and then falls back
   * (speed creep has no pure equilibrium), so the benchmark is stated against full investment instead. */
  speedEquilibrium() {
    const M = Deriver.wMedian(this.uniq.map(u => [this.speeds(u.row)[role(u.row).role === 'trickroom' ? 0 : SP_CAP], u.w]));
    this.eq = { median_speed: M, benchmark: 'weighted median effective speed of the top-meta population, every set at the top of its speed options (Trick Room sets at 0), sheet natures, neutral field' };
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
             speed: { sp: spe, effective: this.speeds(row)[spe], median: this.eq.median_speed },
             bulk: { why: bulkWhy, share_survived: +fin.share.toFixed(3), share_at_zero: +first.at0.toFixed(3), endures: first.H.endures } };
  }
  spreadFor(row) {
    const o = observedSpread(row, this.obs);
    if (o) { this.counters.observed++; return { evs: o.evs, source: 'observed:' + this.obs.file + ' (' + o.pct + '%)', role: role(row).role }; }
    return this.derive(row);
  }
  provenance() {
    return { rule: RULE_TEXT, observed: this.obs ? { file: this.obs.file, sha256: this.obs.sha256 } : 'none: no Reg M-C Smogon moveset file for ' + X.FORMAT + ' under data/smogon-stats/ (the September 2026 files are due about 2026-10-04)',
             population: { teams: this.pop.teams, slots: this.pop.slots.length, unique_sets: this.uniq.length },
             speed_equilibrium: this.eq, median_quantile: MEDIAN, counters: this.counters };
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

module.exports = { Deriver, population, teamSpreads, recorded, setKey, role, attackStat, forme, parseMoveset, findObserved, loadObserved, observedSpread, evStr, RULE_TEXT, SP_TOTAL, SP_CAP, MEDIAN };
