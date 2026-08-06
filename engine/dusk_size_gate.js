#!/usr/bin/env node
/* DUSK SIZE GATE (task #40) — is a 1v1 endgame tablebase a weekend or a year?
 *
 * PURE STORE ANALYSIS. This file loads NO engine module: no type chart, no damage table, no speed
 * maths. There is therefore nothing here for engine/engine_release.js to freeze, and the release id
 * is recorded as "none" rather than stamped for decoration.
 *
 * TWO INDEPENDENT RECONSTRUCTIONS, and they are reported against each other.
 *   (a) the STORED TURN EVENTS written by engine/durable-ingest.js at collection time;
 *   (b) the RAW SHOWDOWN PROTOCOL in data/games.bo3.raw-logs.jsonl, parsed here.
 * (a) is lossy in three ways that matter to this question and (b) is not — a spread move overwrites
 * its own target field so `tgthp` names the last victim, |-curestatus| is not captured so a status
 * never heals, and |-weather|none is filtered so weather never ends. All three inflate the
 * distinct-position count. The headline numbers come from (b); (a) is kept because two
 * reconstructions agreeing on the 1v1 rate is worth more than one asserting it.
 *
 * The corpus is snapshotted (line count + sha256) BEFORE the counts and re-checked after. OPS
 * collects data/games.bo3.jsonl hourly; a corpus that grows mid-measurement is the failure that
 * voided 7,100 games on 2026-08-04.
 *
 * The threshold block in data/dusk-size-gate.json was written to disk BEFORE any count was run and
 * is preserved verbatim. This script appends results beside it; it does not edit it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const Q = require(path.join(__dirname, 'quality.js'));

const ROOT = path.join(__dirname, '..');
const STORE = 'data/games.bo3.jsonl';
const RAW = 'data/games.bo3.raw-logs.jsonl';
const ART = path.join(ROOT, 'data', 'dusk-size-gate.json');

// ---------------------------------------------------------------- corpus snapshot
function snapshot(rel) {
  const f = path.join(ROOT, rel);
  const st = fs.statSync(f);
  const buf = fs.readFileSync(f);
  let lines = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) lines++;
  return { file: rel, bytes: st.size, lines, mtime: st.mtime.toISOString(), sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}

// ---------------------------------------------------------------- forme normalisation
/* Same source and same fallback as engine/durable-ingest.js:baseForme, which is not exported.
 * data/battle-formes.json is the canonical mapping; the regex is that function's documented fallback. */
/* IT SPEAKS, because this map IS the matchup axis. If battle-formes.json fails to load, every
 * Charizard-Mega-Y stops folding onto Charizard and the distinct-species-pair count — the headline
 * this gate exists to produce — inflates by however many formes appear in the corpus. The regex
 * fallback below handles the common `-mega` spellings and does NOT handle the irregular ones, so a
 * silent catch here degrades the ANSWER rather than the run. Counted onto the state so the artifact
 * can carry it, and printed, rather than discovered by someone re-deriving the number later. */
let BASE_OF = {};
let BASE_OF_ERR = null;
try {
  BASE_OF = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'battle-formes.json'), 'utf8')).base_of || {};
} catch (e) {
  BASE_OF_ERR = (e && e.message) || String(e);
  console.error('dusk_size_gate: battle-formes.json unavailable (' + BASE_OF_ERR + ') — falling back to the '
    + 'regex, which misses irregular formes. THE SPECIES-PAIR COUNT IS AN OVERESTIMATE.');
}
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function baseForme(sp) {
  if (BASE_OF[sp]) return BASE_OF[sp];
  const m = /^(.*?)(mega[xy]?|primal)$/.exec(sp);
  return m && m[1] ? m[1] : sp;
}

const bkey = b => {
  const ks = Object.keys(b || {}).filter(k => b[k]).sort();
  return ks.length ? ks.map(k => k + (b[k] > 0 ? '+' : '') + b[k]).join(',') : '-';
};
const hpB = (hp, w) => Math.max(0, Math.min(Math.ceil(hp / w) - 1, Math.ceil(100 / w) - 1));

function sheetEntry(sheet, base) {
  if (!sheet) return null;
  return sheet.find(x => baseForme(x.species) === base || x.species === base) || null;
}
function setKeyOf(sheet, base) {
  const e = sheetEntry(sheet, base);
  if (!e) return null;
  return [e.item || '-', e.ability || '-', e.nature || '-', (e.moves || []).slice().sort().join('/')].join('|');
}
function itemOf(sheet, base) { const e = sheetEntry(sheet, base); return e ? (e.item || '-') : null; }

// ================================================================ (b) RAW PROTOCOL REPLAY
const rawCounters = { no_log: 0, parsed: 0, slot_unknown: 0, faints_over_four: 0 };

function replayRaw(log) {
  const occ = {};                                   // slot -> {name, sp, hp, st, b}
  const faints = { p1: 0, p2: 0 };
  const field = { weather: null, room: null };
  const sideCond = { p1: new Set(), p2: new Set() };
  const positions = [];
  let started = false;

  const push = () => {
    const a1 = ['p1a', 'p1b'].map(s => occ[s]).filter(Boolean);
    const a2 = ['p2a', 'p2b'].map(s => occ[s]).filter(Boolean);
    const n1 = 4 - faints.p1, n2 = 4 - faints.p2;
    if (n1 <= 0 || n2 <= 0) return;
    // Once a side is down to 2 or fewer, every survivor is on the field: doubles refills both slots
    // while a bench exists. So on-field state IS complete state at 2v1 and 1v1, and only there.
    /* A side with 2 or fewer alive has NO bench, so its whole roster is on the field. That is the
     * only claim this measurement needs, and it is checked rather than assumed: if a side is down
     * to <=2 and the field does not hold exactly that many, the position is an anomaly and is
     * skipped. A side with 3 or 4 alive legitimately has mons off the field and is not an anomaly. */
    const bad = (n1 <= 2 && a1.length !== n1) || (n2 <= 2 && a2.length !== n2);
    positions.push({
      n1, n2,
      p1: a1.map(m => ({ sp: m.sp, base: baseForme(m.sp), hp: m.hp, st: m.st, b: bkey(m.b) })),
      p2: a2.map(m => ({ sp: m.sp, base: baseForme(m.sp), hp: m.hp, st: m.st, b: bkey(m.b) })),
      field: { weather: field.weather, room: field.room, tw1: sideCond.p1.has('Tailwind'), tw2: sideCond.p2.has('Tailwind') },
      onfield_complete: !bad
    });
  };

  for (const l of log.split('\n')) {
    if (l.charCodeAt(0) !== 124) continue;
    let m;
    if (l.startsWith('|turn|')) { if (started) push(); continue; }
    if (l.startsWith('|start')) { started = true; continue; }

    if ((m = /^\|(?:switch|drag)\|(p[12][ab]): ([^|]*)\|([^,|]+)[^|]*\|(?:(\d+)\\?\/(\d+)|(\d+)%)/.exec(l))) {
      const slot = m[1], sp = norm(m[3]);
      const hp = m[4] ? Math.round(100 * (+m[4]) / (+m[5])) : (m[6] ? +m[6] : 100);
      occ[slot] = { name: m[2], sp, hp, st: null, b: {} };
      continue;
    }
    if ((m = /^\|(?:switch|drag)\|(p[12][ab]): ([^|]*)\|([^,|]+)/.exec(l))) {
      occ[m[1]] = { name: m[2], sp: norm(m[3]), hp: 100, st: null, b: {} };
      continue;
    }
    if ((m = /^\|(?:detailschange|-formechange|replace)\|(p[12][ab]): ([^|]*)\|([^,|]+)/.exec(l))) {
      if (occ[m[1]]) occ[m[1]].sp = norm(m[3]); else rawCounters.slot_unknown++;
      continue;
    }
    if ((m = /^\|-(?:damage|heal|sethp)\|(p[12][ab])[^|]*\|(?:(\d+)\\?\/(\d+)|(0 fnt)|(\d+)%)/.exec(l))) {
      const o = occ[m[1]]; if (!o) { rawCounters.slot_unknown++; continue; }
      o.hp = m[4] ? 0 : (m[2] ? Math.round(100 * (+m[2]) / (+m[3])) : +m[5]);
      continue;
    }
    if ((m = /^\|-(boost|unboost|setboost)\|(p[12][ab])[^|]*\|([a-z]+)\|(-?\d+)/.exec(l))) {
      const o = occ[m[2]]; if (!o) { rawCounters.slot_unknown++; continue; }
      const st = m[3], n = +m[4];
      if (m[1] === 'setboost') o.b[st] = n;
      else o.b[st] = Math.max(-6, Math.min(6, (o.b[st] || 0) + (m[1] === 'unboost' ? -n : n)));
      continue;
    }
    if ((m = /^\|-(clearboost|clearnegativeboost|clearpositiveboost|clearallboost|invertboost)\|?(p[12][ab])?/.exec(l))) {
      if (m[1] === 'clearallboost') { for (const k of Object.keys(occ)) if (occ[k]) occ[k].b = {}; continue; }
      const o = m[2] && occ[m[2]]; if (!o) continue;
      if (m[1] === 'clearnegativeboost') { for (const k of Object.keys(o.b)) if (o.b[k] < 0) delete o.b[k]; }
      else if (m[1] === 'clearpositiveboost') { for (const k of Object.keys(o.b)) if (o.b[k] > 0) delete o.b[k]; }
      else if (m[1] === 'invertboost') { for (const k of Object.keys(o.b)) o.b[k] = -o.b[k]; }
      else o.b = {};
      continue;
    }
    if ((m = /^\|-copyboost\|(p[12][ab])[^|]*\|(p[12][ab])/.exec(l))) {
      if (occ[m[1]] && occ[m[2]]) occ[m[1]].b = { ...occ[m[2]].b };
      continue;
    }
    if ((m = /^\|-swapboost\|(p[12][ab])[^|]*\|(p[12][ab])/.exec(l))) {
      if (occ[m[1]] && occ[m[2]]) { const t = occ[m[1]].b; occ[m[1]].b = occ[m[2]].b; occ[m[2]].b = t; }
      continue;
    }
    if ((m = /^\|-status\|(p[12][ab])[^|]*\|([^|\n]+)/.exec(l))) { if (occ[m[1]]) occ[m[1]].st = m[2].trim(); continue; }
    if ((m = /^\|-curestatus\|(p[12][ab])[^|]*\|/.exec(l))) { if (occ[m[1]]) occ[m[1]].st = null; continue; }
    if ((m = /^\|faint\|(p[12][ab])/.exec(l))) {
      const side = m[1].slice(0, 2);
      if (occ[m[1]]) { faints[side]++; occ[m[1]] = null; }
      continue;
    }
    if ((m = /^\|-weather\|([^|\n]+)/.exec(l))) {
      if (/\[upkeep\]/.test(l)) continue;
      const w = m[1].trim();
      field.weather = (w === 'none' || w === '') ? null : w;
      continue;
    }
    if ((m = /^\|-fieldstart\|move: ([^|\n]+)/.exec(l))) { field.room = m[1].trim(); continue; }
    if ((m = /^\|-fieldend\|move: ([^|\n]+)/.exec(l))) { if (field.room === m[1].trim()) field.room = null; continue; }
    if ((m = /^\|-sidestart\|(p[12])[^|]*\|(?:move: )?([^|\n]+)/.exec(l))) { sideCond[m[1]].add(m[2].trim()); continue; }
    if ((m = /^\|-sideend\|(p[12])[^|]*\|(?:move: )?([^|\n]+)/.exec(l))) { sideCond[m[1]].delete(m[2].trim()); continue; }
  }
  if (faints.p1 > 4 || faints.p2 > 4) rawCounters.faints_over_four++;
  return { positions, faints };
}

// ================================================================ (a) STORED-EVENT REPLAY (cross-check)
function replayEvents(g) {
  const side = { p1: {}, p2: {} };
  const slotOcc = {};
  let n1seen = 0;
  for (const s of ['p1', 'p2']) for (const sp of (g.brought[s] || [])) side[s][sp] = { hp: 100, alive: true };
  const aliveN = s => Object.keys(side[s]).filter(k => side[s][k].alive).length;
  let reached = false;
  for (const t of (g.turns || [])) {
    if (aliveN('p1') === 1 && aliveN('p2') === 1) { reached = true; n1seen++; }
    for (const e of (t.ev || [])) {
      const sd = e.s ? e.s.slice(0, 2) : null, base = e.mon ? baseForme(e.mon) : null;
      if (e.t === 's' && sd && base) slotOcc[e.s] = base;
      if (e.t === 'f' && sd && base && side[sd][base]) side[sd][base].alive = false;
    }
  }
  return { reached, count: n1seen };
}

// ================================================================ main
function main() {
  const before = { store: snapshot(STORE), raw: snapshot(RAW) };
  process.stderr.write(`snapshot store ${before.store.lines} lines ${before.store.sha256.slice(0, 16)} | raw ${before.raw.lines} lines ${before.raw.sha256.slice(0, 16)}\n`);

  const all = Q.loadGames({ path: STORE, clean: false });
  const clean = Q.loadGames({ path: STORE });
  const games = clean.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  process.stderr.write(`games: ${all.length} total, ${clean.length} clean\n`);

  // ---- load the raw logs we need
  const want = new Set(games.map(g => g.id));
  const logs = new Map();
  /* A SKIPPED LINE IS COUNTED, because this gate's headline rests on the RAW PROTOCOL rather than on
   * the stored events — the two were cross-checked at 98.55% and the protocol was chosen as the
   * authority precisely because the events are lossy. A malformed line therefore drops a game out of
   * the AUTHORITATIVE arm while leaving it in the cross-check arm, which would widen the disagreement
   * and read as a reconstruction problem rather than as a parse problem. Silently continuing here is
   * how a corpus defect gets attributed to the method. */
  let rawUnparsable = 0, rawFirstErr = null;
  for (const line of fs.readFileSync(path.join(ROOT, RAW), 'utf8').split('\n')) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); }
    catch (e) { rawUnparsable++; if (!rawFirstErr) rawFirstErr = (e && e.message) || String(e); continue; }
    if (want.has(o.id)) logs.set(o.id, o.log || '');
  }
  if (rawUnparsable) {
    console.error(`dusk_size_gate: ${rawUnparsable} unparsable line(s) in ${RAW} — first: ${rawFirstErr}. `
      + 'Those games are absent from the protocol arm and present in the events arm; read the '
      + 'reconstruction cross-check with that in mind.');
  }
  process.stderr.write(`raw logs matched: ${logs.size} of ${want.size}`
    + (rawUnparsable ? `  (${rawUnparsable} unparsable)` : '') + '\n');

  // ---- replay
  const onev1 = [], twov1 = [];
  const firstEntries = [];
  let reach1v1 = 0, reach2v1 = 0, reachAny = 0, replayed = 0, incompleteOnfield = 0, allDecisionPoints = 0;
  let xcheckAgree = 0, xcheckRawOnly = 0, xcheckEvOnly = 0, xcheckNeither = 0;

  for (const g of games) {
    const log = logs.get(g.id);
    const ev = replayEvents(g);
    if (log == null) { rawCounters.no_log++; if (ev.reached) xcheckEvOnly++; continue; }
    const r = replayRaw(log);
    rawCounters.parsed++;
    replayed++;
    let seen1 = false, seen2 = false, firstIdx = -1;
    for (let i = 0; i < r.positions.length; i++) {
      const p = r.positions[i];
      allDecisionPoints++;
      if (!p.onfield_complete) { incompleteOnfield++; continue; }
      if (p.n1 === 1 && p.n2 === 1) { if (!seen1) { seen1 = true; firstIdx = i; } onev1.push({ g, p }); }
      else if ((p.n1 === 2 && p.n2 === 1) || (p.n1 === 1 && p.n2 === 2)) { seen2 = true; twov1.push({ g, p }); }
    }
    if (seen1) {
      reach1v1++;
      const p = r.positions[firstIdx];
      let remaining = 0;
      for (let i = firstIdx; i < r.positions.length; i++) if (r.positions[i].n1 === 1 && r.positions[i].n2 === 1) remaining++;
      const p1win = g.winner && g.p1 && g.winner === g.p1.name;
      const p2win = g.winner && g.p2 && g.winner === g.p2.name;
      firstEntries.push({
        id: g.id, remaining, hp1: p.p1[0].hp, hp2: p.p2[0].hp,
        st1: p.p1[0].st, st2: p.p2[0].st, b1: p.p1[0].b, b2: p.p2[0].b,
        winner: p1win ? 'p1' : (p2win ? 'p2' : null), forfeit: !!g.forfeit
      });
    }
    if (seen2) reach2v1++;
    if (seen1 || seen2) reachAny++;
    if (seen1 && ev.reached) xcheckAgree++;
    else if (seen1) xcheckRawOnly++;
    else if (ev.reached) xcheckEvOnly++;
    else xcheckNeither++;
  }

  // ---- fidelity levels
  const sheetOf = (g, s) => (g.sheets || {})[s] || null;
  function sideKey(g, s, m, lvl) {
    const parts = [m.sp];
    if (lvl.set === 'full') { const k = setKeyOf(sheetOf(g, s), m.base); parts.push(k == null ? '?' : k); }
    else if (lvl.set === 'item') { const k = itemOf(sheetOf(g, s), m.base); parts.push(k == null ? '?' : k); }
    if (lvl.hp) parts.push('h' + hpB(m.hp, lvl.hp));
    if (lvl.status) parts.push('s' + (m.st || '-'));
    if (lvl.boost) parts.push('b' + m.b);
    return parts.join('#');
  }
  function posKey(rec, lvl) {
    const a = sideKey(rec.g, 'p1', rec.p.p1[0], lvl);
    const b = sideKey(rec.g, 'p2', rec.p.p2[0], lvl);
    // canonical unordered pair: one solved matrix game gives BOTH seats' strategies, so (A,B) and
    // (B,A) are one entry, not two. Field is orientation-dependent, so it is appended after.
    const flip = a > b;
    const pair = flip ? b + '||' + a : a + '||' + b;
    if (!lvl.field) return pair;
    const f = rec.p.field;
    const tw = flip ? [f.tw2, f.tw1] : [f.tw1, f.tw2];
    return pair + '||F:' + (f.weather || '-') + '/' + (f.room || '-') + '/' + (tw[0] ? 'T' : '-') + (tw[1] ? 'T' : '-');
  }

  const LEVELS = [
    { id: 'L0_species', label: 'species pair only (no state — not a solvable position, shown as the matchup count)', set: null },
    { id: 'L1_species_item', label: 'species + item', set: 'item' },
    { id: 'L2_species_set', label: 'species + full declared set (item/ability/nature/4 moves)', set: 'full' },
    { id: 'L3_set_hp10', label: 'set + HP in 10% buckets', set: 'full', hp: 10 },
    { id: 'L3b_set_hp5', label: 'set + HP in 5% buckets', set: 'full', hp: 5 },
    { id: 'L4_set_hp10_status', label: 'set + HP10 + status', set: 'full', hp: 10, status: true },
    { id: 'L5_set_hp10_status_boost', label: 'set + HP10 + status + boost stages', set: 'full', hp: 10, status: true, boost: true },
    { id: 'L6_set_hp10_status_boost_field', label: 'set + HP10 + status + boosts + field (weather/room/Tailwind)', set: 'full', hp: 10, status: true, boost: true, field: true },
    { id: 'C3_species_hp10', label: 'SETS COLLAPSED: species + HP10', set: null, hp: 10 },
    { id: 'C4_species_hp10_status', label: 'SETS COLLAPSED: species + HP10 + status', set: null, hp: 10, status: true },
    { id: 'C5_species_hp10_status_boost', label: 'SETS COLLAPSED: species + HP10 + status + boosts', set: null, hp: 10, status: true, boost: true },
    { id: 'C6_species_full', label: 'SETS COLLAPSED: species + HP10 + status + boosts + field', set: null, hp: 10, status: true, boost: true, field: true }
  ];

  const levelOut = {};
  const cutIdx = Math.floor(onev1.length / 2);
  for (const lvl of LEVELS) {
    const counts = new Map(); const trainKeys = new Set();
    let testTotal = 0, testHit = 0;
    for (let i = 0; i < onev1.length; i++) {
      const k = posKey(onev1[i], lvl);
      counts.set(k, (counts.get(k) || 0) + 1);
      if (i < cutIdx) trainKeys.add(k); else { testTotal++; if (trainKeys.has(k)) testHit++; }
    }
    const sorted = [...counts.values()].sort((a, b) => b - a);
    const N = onev1.length;
    const cover = f => { let c = 0, n = 0; for (const v of sorted) { c += v; n++; if (c >= f * N) break; } return n; };
    levelOut[lvl.id] = {
      label: lvl.label,
      distinct_positions: counts.size, positions_observed: N,
      saturation: +(counts.size / N).toFixed(4),
      coverage: { p50: cover(0.5), p80: cover(0.8), p95: cover(0.95), p99: cover(0.99) },
      singletons: sorted.filter(v => v === 1).length,
      top_share: +(sorted[0] / N).toFixed(4),
      held_out_hit_rate: testTotal ? +(testHit / testTotal).toFixed(4) : null,
      held_out_n: testTotal
    };
  }

  // ---- per-axis observed cardinality (this is what an ENUMERATED table must multiply by)
  const axis = { species: new Set(), sets: new Set(), status: new Set(), boosts: new Map(), field: new Map(), hp: new Set() };
  for (const r of onev1) for (const s of ['p1', 'p2']) {
    const m = r.p[s][0];
    axis.species.add(m.sp);
    axis.sets.add(m.sp + '#' + (setKeyOf(sheetOf(r.g, s), m.base) || '?'));
    axis.status.add(m.st || '-');
    axis.boosts.set(m.b, (axis.boosts.get(m.b) || 0) + 1);
    axis.hp.add(m.hp);
  }
  for (const r of onev1) {
    const f = r.p.field;
    const k = (f.weather || '-') + '/' + (f.room || '-') + '/' + (f.tw1 ? 'T' : '-') + (f.tw2 ? 'T' : '-');
    axis.field.set(k, (axis.field.get(k) || 0) + 1);
  }
  const covOf = (map, frac) => {
    const sorted = [...map.values()].sort((a, b) => b - a);
    const N = sorted.reduce((s, v) => s + v, 0);
    let c = 0, n = 0; for (const v of sorted) { c += v; n++; if (c >= frac * N) break; } return n;
  };
  const S = axis.species.size, K = axis.sets.size;
  const B95 = covOf(axis.boosts, 0.95), B99 = covOf(axis.boosts, 0.99), Ball = axis.boosts.size;
  const F95 = covOf(axis.field, 0.95), Fall = axis.field.size;

  // ---- ENUMERATED table designs. This is the number that decides the gate: a table of only the
  // positions that were OBSERVED has a measured held-out hit rate of ~0 once HP is in the key, so
  // the shippable object is an enumeration over covered MATCHUPS, not a memo of observed states.
  const pairsOf = n => n * (n + 1) / 2;   // unordered incl. mirror; one matrix covers both seats
  const design = (label, pairs, hpb, st, bo, fi, note) => {
    const entries = pairs * Math.pow(hpb * st * bo, 2) * fi;
    return {
      design: label, matchups: pairs, per_side_states: hpb * st * bo, entries,
      mb_packed: +(entries * 24 / 1048576).toFixed(1),
      mb_json_map: +(entries * 200 / 1048576).toFixed(1),
      axes: { hp_buckets: hpb, statuses: st, boost_states: bo, field_states: fi },
      note: note || null
    };
  };
  const pairs95species = levelOut.L0_species.coverage.p95;
  const designs = [
    // --- the sweep that locates the boundary: species pool, HP resolution only
    design('A1  species pool, ALL pairs, HP 25% (4 buckets), nothing else', pairsOf(S), 4, 1, 1, 1, 'coarsest HP that is still HP'),
    design('A2  species pool, ALL pairs, HP 20% (5 buckets), nothing else', pairsOf(S), 5, 1, 1, 1),
    design('A3  species pool, ALL pairs, HP 10% (10 buckets), nothing else', pairsOf(S), 10, 1, 1, 1, 'the declared default HP resolution'),
    design('A4  species pool, ALL pairs, HP 5% (20 buckets), nothing else', pairsOf(S), 20, 1, 1, 1),
    // --- adding one axis at a time on top of A3
    design('B1  A3 + status restricted to none/brn/par', pairsOf(S), 10, 3, 1, 1),
    design('B2  A3 + all 7 statuses', pairsOf(S), 10, 7, 1, 1),
    design('B3  A3 + 7 statuses + boosts covering 95% of observed 1v1 sides', pairsOf(S), 10, 7, B95, 1),
    design('B4  A3 + 7 statuses + every observed boost vector + field states covering 95%', pairsOf(S), 10, 7, Ball, F95),
    design('B5  A3 + 7 statuses + full analytic boost space (13^5 per side)', pairsOf(S), 10, 7, Math.pow(13, 5), 1, 'the naive enumeration DUSK exists to avoid'),
    // --- the set axis, which is what OTS is supposed to buy
    design('C1  SET pool, ALL pairs, HP 10% only', pairsOf(K), 10, 1, 1, 1),
    design('C2  SET pool, ALL pairs, HP 10% + 7 statuses', pairsOf(K), 10, 7, 1, 1),
    design('C3  SET pool, ALL pairs, HP 10% + 7 statuses + boosts 95%', pairsOf(K), 10, 7, B95, 1),
    design('C4  SET pool restricted to the top 3 sets per species, ALL pairs, HP 10% only', pairsOf(3 * S), 10, 1, 1, 1),
    // --- matchup-restricted: only the head of the observed distribution
    design('D1  the 95%-coverage species pairs only, HP 10% + 7 statuses', pairs95species, 10, 7, 1, 1, `${pairs95species} pairs cover 95% of the 1v1 positions observed IN SAMPLE; out of sample this shrinks - see held_out_hit_rate`),
    design('D2  the 95%-coverage species pairs only, HP 10% + 7 statuses + boosts 95%', pairs95species, 10, 7, B95, 1),
    design('D3  the observed SET pairs only, HP 10% + 7 statuses', levelOut.L2_species_set.distinct_positions, 10, 7, 1, 1)
  ];

  // ---- decidedness
  const fe = firstEntries;
  const labelled = fe.filter(e => e.winner);
  const hpAhead = labelled.filter(e => e.hp1 !== e.hp2);
  const hpCorrect = hpAhead.filter(e => (e.hp1 > e.hp2 ? 'p1' : 'p2') === e.winner).length;
  const wil = (k, n) => { if (!n) return null; const p = k / n, z = 1.96, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [+(100 * (c - h)).toFixed(2), +(100 * (c + h)).toFixed(2)]; };
  const remDist = {};
  for (const e of fe) { const b = e.remaining >= 10 ? '10+' : String(e.remaining); remDist[b] = (remDist[b] || 0) + 1; }

  const after = { store: snapshot(STORE), raw: snapshot(RAW) };

  // ---- verdict
  const BANDS = { SHIPPABLE: 335000, SHIPPABLE_PACKED: 2700000 };
  const band = n => n <= BANDS.SHIPPABLE ? 'SHIPPABLE' : (n <= BANDS.SHIPPABLE_PACKED ? 'SHIPPABLE_PACKED' : 'TOO_BIG');
  for (const d of designs) d.band = band(d.entries);

  /* THE ARTIFACT IS REBUILT, NOT MUTATED. Mutating it left a `two_v_one` block from an earlier run
   * sitting beside fresh numbers on the first pass of this gate — a stale key inside a file that
   * otherwise looked current. Only the pre-declared threshold block survives from disk. */
  const prev = JSON.parse(fs.readFileSync(ART, 'utf8'));
  if (!prev.threshold) throw new Error('the pre-declared threshold block is missing from ' + ART + '; refusing to write a gate with no declared threshold');
  const art = {
    gate: prev.gate, status: 'MEASURED', written_by: 'engine/dusk_size_gate.js',
    declared_at: prev.declared_at, question: prev.question, threshold: prev.threshold,
    engine_release: prev.engine_release, void: false
  };
  art.measured_at = new Date().toISOString();
  art.corpus_snapshot = { note: 'taken BEFORE the counts. data/games.bo3.jsonl is collected hourly by OPS; everything below is measured against THIS snapshot.', ...before };
  art.corpus_snapshot_after = after;

  /* THE SAME EVIDENCE, UNDER THE KEY THE RATCHET READS. engine/provenance.js looks for
   * `source_digests` and this gate recorded its digests as `corpus_snapshot`, so the first run
   * landed on the "ships without recording what CONTENT it read" list — a list that MAY SHRINK AND
   * MAY NEVER GROW. The artifact was not actually unstamped; it was stamped in a private shape,
   * which is indistinguishable from unstamped to anything automated. Emitting both is not
   * duplication: `corpus_snapshot` carries the before/after pair that proves the corpus did not move
   * mid-run, which is a stronger claim than a single digest and worth keeping in its own right.
   * These values are COPIED from the snapshot taken before counting; nothing is hashed at write
   * time, because a digest computed at the end proves only that the file is unchanged since — which
   * is not the question the ratchet asks. */
  art.source_digests = {
    [before.store.file]: before.store.sha256,
    [before.raw.file]:   before.raw.sha256,
    note: 'Content, not mtime. Copied from corpus_snapshot, taken BEFORE the counts and re-verified after (see corpus_moved). Not recomputed at write time.',
    algorithm: 'sha256 over the whole file, not the sha12 engine/run_stamp.js uses for source files',
  };
  art.corpus_moved = (after.store.sha256 !== before.store.sha256) || (after.raw.sha256 !== before.raw.sha256);

  art.corpus = {
    store: STORE, raw_logs: RAW,
    games_total: all.length, games_clean: clean.length,
    clean_filter: 'engine/quality.js loadGames(): bots, behavioural bots, action-less forfeits, short games and partial brings excluded. require_full_bring is what makes "4 alive at the start" safe to assume.',
    raw_logs_matched: logs.size, games_without_raw_log: rawCounters.no_log,
    games_replayed_from_protocol: replayed,
    open_sheet_share: +(clean.filter(g => g.openSheet).length / clean.length).toFixed(4)
  };

  art.reconstruction_crosscheck = {
    what: 'The stored turn events and the raw protocol were replayed independently and asked the same yes/no question: did this game reach 1v1?',
    both_say_yes: xcheckAgree, raw_only: xcheckRawOnly, events_only: xcheckEvOnly, both_say_no: xcheckNeither,
    agreement: +(100 * (xcheckAgree + xcheckNeither) / Math.max(1, xcheckAgree + xcheckNeither + xcheckRawOnly + xcheckEvOnly)).toFixed(2),
    note: 'Disagreements are expected and are not a defect in either: the stored events drop a slot on spread damage, and games with no raw log can only be judged by one of the two. The headline uses the protocol.'
  };

  art.reach = {
    n_games: replayed,
    reached_1v1: reach1v1, reached_1v1_pct: +(100 * reach1v1 / replayed).toFixed(2), reached_1v1_ci95: wil(reach1v1, replayed),
    reached_2v1: reach2v1, reached_2v1_pct: +(100 * reach2v1 / replayed).toFixed(2), reached_2v1_ci95: wil(reach2v1, replayed),
    reached_either: reachAny, reached_either_pct: +(100 * reachAny / replayed).toFixed(2),
    all_decision_points: allDecisionPoints,
    decision_points_1v1: onev1.length,
    decision_points_1v1_share_of_all_pct: +(100 * onev1.length / allDecisionPoints).toFixed(2),
    decision_points_2v1: twov1.length,
    decision_points_2v1_share_of_all_pct: +(100 * twov1.length / allDecisionPoints).toFixed(2),
    mean_1v1_decision_points_per_reaching_game: +(onev1.length / Math.max(1, reach1v1)).toFixed(2),
    anomalous_positions_skipped: incompleteOnfield,
    anomalous_note: 'a side down to <=2 alive whose field did not hold exactly that many. Not early-game bench positions — those are legitimate and are not counted here.'
  };

  art.decidedness = {
    what: 'Measured at the FIRST 1v1 decision point of each game that reaches one. A tablebase for positions nobody has a real choice in is worth nothing. No solver was run — these are proxies and are labelled as such.',
    n: fe.length,
    ends_within_one_decision: fe.filter(e => e.remaining <= 1).length,
    ends_within_one_decision_pct: +(100 * fe.filter(e => e.remaining <= 1).length / fe.length).toFixed(2),
    ends_within_two_decisions_pct: +(100 * fe.filter(e => e.remaining <= 2).length / fe.length).toFixed(2),
    mean_decision_points_from_entry: +(fe.reduce((s, e) => s + e.remaining, 0) / fe.length).toFixed(2),
    remaining_decision_points_histogram: remDist,
    higher_hp_side_wins: { n: hpAhead.length, correct: hpCorrect, pct: +(100 * hpCorrect / Math.max(1, hpAhead.length)).toFixed(2), ci95: wil(hpCorrect, hpAhead.length) },
    lopsided_hp_entries_pct: +(100 * fe.filter(e => Math.max(e.hp1, e.hp2) >= 90 && Math.min(e.hp1, e.hp2) <= 20).length / fe.length).toFixed(2),
    entries_with_a_status: fe.filter(e => e.st1 || e.st2).length,
    entries_with_a_boost: fe.filter(e => e.b1 !== '-' || e.b2 !== '-').length,
    forfeit_share_pct: +(100 * fe.filter(e => e.forfeit).length / fe.length).toFixed(2),
    games_with_a_1v1_worth_more_than_one_decision: fe.filter(e => e.remaining >= 2).length,
    games_with_a_1v1_worth_more_than_one_decision_pct_of_corpus:
      +(100 * fe.filter(e => e.remaining >= 2).length / replayed).toFixed(2),
    reading: 'the HP-ahead side losing about a third of the time says the 1v1 is genuinely contested rather than a formality. The volume is the problem, not the decidedness.'
  };

  art.fidelity_levels = levelOut;
  art.fidelity_levels_note = 'distinct_positions here counts positions that WERE OBSERVED. Read `saturation` beside it: at saturation near 1 the count is measuring the size of the corpus, not the size of the state space, and it must not be read as a table size. `held_out_hit_rate` is the number that matters — build the key set from the older half of the corpus and ask how often the newer half lands on a key you already have.';

  art.axes = {
    what: 'per-axis cardinality of the state actually seen at 1v1. These are the multipliers an ENUMERATED table pays.',
    distinct_species_formes_at_1v1: S,
    distinct_species_set_sides_at_1v1: K,
    sets_per_species_at_1v1: +(K / S).toFixed(2),
    distinct_statuses_seen: [...axis.status].sort(),
    distinct_boost_vectors_seen: Ball,
    boost_vectors_covering_95pct_of_sides: B95,
    boost_vectors_covering_99pct_of_sides: B99,
    share_of_sides_at_neutral_boosts: +((axis.boosts.get('-') || 0) / (2 * onev1.length)).toFixed(4),
    distinct_field_states_seen: Fall,
    field_states_covering_95pct: F95,
    distinct_hp_percentages_seen: axis.hp.size,
    hp_bucket_choice: '10% of max HP. Reasoning: a damage roll in this game spans 85-100% of its own mean, so consecutive rolls of one move already smear a target across roughly 15% of a bar; a bucket finer than 10% is finer than the resolution of the thing the tablebase would be reasoning about. 5% is reported beside it so the tradeoff is visible rather than asserted.'
  };

  // ---- 2v1, the next rung out. The "2" side is an unordered pair, the "1" side a single mon.
  function key2v1(rec, useSets) {
    const one = rec.p.n1 === 1 ? 'p1' : 'p2';
    const two = one === 'p1' ? 'p2' : 'p1';
    const lvl = { set: useSets ? 'full' : null };
    const a = sideKey(rec.g, one, rec.p[one][0], lvl);
    const bs = rec.p[two].map(m => sideKey(rec.g, two, m, lvl)).sort();
    return a + '||' + bs.join('+');
  }
  const t2 = new Map(), t2s = new Map();
  const sides2 = new Set(), sides2set = new Set();
  for (const r of twov1) {
    const a = key2v1(r, false), b = key2v1(r, true);
    t2.set(a, (t2.get(a) || 0) + 1);
    t2s.set(b, (t2s.get(b) || 0) + 1);
    for (const s of ['p1', 'p2']) for (const m of r.p[s]) { sides2.add(m.sp); sides2set.add(m.sp + '#' + (setKeyOf(sheetOf(r.g, s), m.base) || '?')); }
  }
  const covMap = (map, fr) => { const so = [...map.values()].sort((a, b) => b - a); const N = so.reduce((s, v) => s + v, 0); const o = {}; for (const f of fr) { let c = 0, n = 0; for (const v of so) { c += v; n++; if (c >= f * N) break; } o['p' + Math.round(f * 100)] = n; } return o; };
  const S2 = sides2.size;
  art.two_v_one = {
    decision_points: twov1.length,
    distinct_species_configurations_observed: t2.size,
    distinct_set_configurations_observed: t2s.size,
    saturation_species: +(t2.size / Math.max(1, twov1.length)).toFixed(4),
    coverage_species: covMap(t2, [0.5, 0.8, 0.95, 0.99]),
    coverage_sets: covMap(t2s, [0.5, 0.8, 0.95, 0.99]),
    distinct_species_formes_seen: S2,
    enumerated_species_configurations: S2 * S2 * (S2 + 1) / 2,
    enumerated_note: 'one mon against an unordered pair: S x S(S+1)/2. NOT halvable the way 1v1 is — the two seats are structurally different, so the mirror trick does not apply.',
    enumerated_with_hp10: S2 * (S2 * (S2 + 1) / 2) * Math.pow(10, 3),
    reading: 'the 2v1 matchup axis alone, before any HP or status, is already larger than the entire shippable 1v1 table. 2v1 is out of reach at any fidelity in this budget.'
  };

  art.enumerated_designs = designs;
  art.enumerated_designs_note = 'entries = matchups x (hp_buckets x statuses x boost_states)^2 x field_states. Matchups are unordered pairs INCLUDING mirrors, n(n+1)/2, because solving one simultaneous-move matrix returns both seats\' equilibrium strategies at once — engine/slowking/nash.py already does this. Halving here is real, not optimistic.';

  art.limitations = {
    reconstruction: 'headline figures come from the raw Showdown protocol, which states HP absolutely per slot on every damage line, and which carries |-curestatus|, |-weather|none, |-fieldend| and |-sidestart|. The stored-event reconstruction lacks all four and is reported only as a cross-check on the reach rate.',
    onfield_completeness: 'a 1v1 or 2v1 position is read off the FIELD. In doubles both slots stay filled while a bench exists, so at 2-or-fewer alive every survivor is on the field. Positions where the field and the faint count disagree are skipped and counted (positions_skipped_onfield_incomplete).',
    ev_spreads_absent: 'sheets carry evs: null in this corpus, so two identical declared sets on different Champions SP spreads collapse to one entry. If spreads were public and varied, the set axis would be LARGER than measured. This is the one bias that flatters DUSK and it is stated first.',
    illusion: '|replace| is honoured, so a Zoroark that was lying is corrected at the point the protocol corrects it — but every position recorded before the reveal carries the species the opponent believed. That is arguably the right state for a tablebase keyed on what a player can see, and it is not corrected retroactively.',
    decidedness_is_a_proxy: 'no equilibrium solver was run over these positions. "already decided" is proxied by how many 1v1 decision points remain and by whether the HP-ahead side goes on to win. Neither is a game value.',
    bo3_series: 'each record is one game of a best-of-three, not a series. Reach rates are per GAME.'
  };
  art.counters = rawCounters;

  // headline: the smallest ENUMERATED design that is a real tablebase — a solvable position needs
  // HP, and under OTS the set is free information, so the set pool is the honest matchup axis.
  /* THE HEADLINE IS THE FULL-FIDELITY DESIGN — species AND the declared set AND HP AND status AND
   * boosts — because that is the position DUSK claims to look up. The bands below say where it
   * stops being that. */
  const headline = designs.find(d => d.design.startsWith('C3 '));
  if (!headline) throw new Error('headline design label not found in designs[]');
  const fits = designs.filter(d => d.band !== 'TOO_BIG').sort((a, b) => b.entries - a.entries);
  art.verdict = {
    overall: headline.band === 'TOO_BIG' ? 'TOO BIG' : headline.band,
    headline_design: headline.design,
    headline_entries: headline.entries,
    headline_band: headline.band,
    largest_design_that_fits: fits[0] || null,
    where_it_becomes_shippable: fits.length
      ? `${fits[0].design} — ${fits[0].entries.toLocaleString('en-US')} entries, ${fits[0].mb_packed} MB packed. Everything above that fidelity is TOO BIG.`
      : 'no design in the sweep fits the declared budget at any fidelity.',
    bands: designs.map(d => ({ design: d.design, entries: d.entries, mb_packed: d.mb_packed, band: d.band })),
    reach_finding: `${art.reach.reached_1v1_pct}% of clean games reach 1v1 (n=${replayed}); ${art.decidedness.ends_within_one_decision_pct}% of those 1v1s are over after a single decision, so a 1v1 lasting more than one decision occurs in ${art.decidedness.games_with_a_1v1_worth_more_than_one_decision_pct_of_corpus}% of games. 1v1 turns are ${art.reach.decision_points_1v1_share_of_all_pct}% of all decision points in the corpus.`,
    memoisation_finding: `Storing only OBSERVED positions does not work: once HP is in the key the held-out hit rate is ${(100 * levelOut.L3_set_hp10.held_out_hit_rate).toFixed(2)}% (train on the older half of the corpus, test on the newer). Even at bare species-pair level it is ${(100 * levelOut.L0_species.held_out_hit_rate).toFixed(1)}%. A shippable DUSK has to ENUMERATE a matchup pool, not memoise a corpus.`
  };

  fs.writeFileSync(ART, JSON.stringify(art, null, 2));
  process.stderr.write('wrote ' + ART + '\n');
  console.log(JSON.stringify({
    corpus: art.corpus, crosscheck: art.reconstruction_crosscheck, reach: art.reach,
    decidedness: art.decidedness, axes: art.axes,
    levels: Object.fromEntries(Object.entries(levelOut).map(([k, v]) => [k, { distinct: v.distinct_positions, sat: v.saturation, cov: v.coverage, heldout: v.held_out_hit_rate }])),
    designs, verdict: art.verdict, corpus_moved: art.corpus_moved, counters: rawCounters
  }, null, 1));
}

main();
