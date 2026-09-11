/* analyse_lines.js — reads the three phase profiles profile_turn.js wrote and answers, as SHARES:
 *   1. within ROLLOUT samples only (a sample counts if runPlayout is on its stack — the inspector's own
 *      start/stop frames and the harness are excluded from the denominator), which files and functions
 *   2. which LINES inside the hottest functions (V8 positionTicks, 1-based lines of the release file)
 *   3. which engine functions CALL into tags.js (nearest non-tags.js ancestor), since tag lookup is hot
 *   4. named categories, each with its membership PRINTED so an over-matching regex is visible
 *   5. what arming the trace adds: samples per turn, B minus mean(A1, A2), per function
 * Reads only files in this directory and the release's source text. Writes lines-summary.json.
 *
 *   node data/verification/opt-plan-2026-09-11/analyse_lines.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const DIR = __dirname;
const REL = '13257c8bc397';
const RELDIR = 'C:/Users/willj/Projects/Pokemon/ABRA/data/releases/' + REL + '/';
const SRC = {};
const srcLine = (file, n) => {
  if (!SRC[file]) { try { SRC[file] = fs.readFileSync(RELDIR + file, 'utf8').split('\n'); } catch (e) { SRC[file] = []; } }
  return (SRC[file][n - 1] || '').trim().slice(0, 150);
};
const sum = JSON.parse(fs.readFileSync(path.join(DIR, 'profile-summary.json'), 'utf8'));
const turns = { A1: sum.phases.A1.turns, B: sum.phases.B.turns, A2: sum.phases.A2.turns };

function load(ph) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, 'phase-' + ph + '.cpuprofile.gz'))).toString()); }
const relFile = (u) => { const s = String(u || '').replace(/\\/g, '/'); const i = s.indexOf('/releases/' + REL + '/'); return i >= 0 ? s.slice(i + REL.length + 11) : null; };
const fkey = (cf) => (cf.functionName || '(anonymous)') + ' @ ' + (relFile(cf.url) || String(cf.url || '').split('/').slice(-1)[0]) + (cf.url ? ':' + (cf.lineNumber + 1) : '');

function index(p) {
  const byId = new Map(); for (const n of p.nodes) byId.set(n.id, n);
  const parent = new Map(); for (const n of p.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const stack = new Map();
  const stackOf = (id) => { if (stack.has(id)) return stack.get(id); const out = []; let cur = id; while (cur !== undefined) { out.push(byId.get(cur)); cur = parent.get(cur); } stack.set(id, out); return out; };
  return { byId, parent, stackOf };
}

const PH = ['A1', 'A2', 'B'];
const P = {}; for (const ph of PH) { P[ph] = load(ph); P[ph].ix = index(P[ph]); }

/* ---- per phase: rollout-only sample set, self & inclusive by function ---------------------------- */
function tally(ph) {
  const p = P[ph], { byId, stackOf } = p.ix;
  const self = new Map(), incl = new Map(), file = new Map(), tagCaller = new Map();
  let roll = 0, tagSamples = 0;
  for (const sid of p.samples) {
    const st = stackOf(sid);
    if (!st.some(n => n.callFrame.functionName === 'runPlayout')) continue;
    roll++;
    const leaf = st[0];
    const k = fkey(leaf.callFrame); self.set(k, (self.get(k) || 0) + 1);
    const f = relFile(leaf.callFrame.url) || leaf.callFrame.functionName || '(native)'; file.set(f, (file.get(f) || 0) + 1);
    const seen = new Set(); for (const n of st) { const kk = fkey(n.callFrame); if (!seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + 1); } }
    /* tags.js: the sample is IN tag lookup if any frame is in tags.js; credit the nearest caller outside it */
    const ti = st.findIndex(n => relFile(n.callFrame.url) === 'engine/tags.js');
    if (ti >= 0) {
      tagSamples++;
      const caller = st.slice(ti).find(n => relFile(n.callFrame.url) && relFile(n.callFrame.url) !== 'engine/tags.js');
      const ck = caller ? fkey(caller.callFrame) : '(none)';
      tagCaller.set(ck, (tagCaller.get(ck) || 0) + 1);
    }
  }
  return { roll, self, incl, file, tagCaller, tagSamples };
}
const T = {}; for (const ph of PH) T[ph] = tally(ph);
const pooled = (field) => { const m = new Map(); for (const ph of ['A1', 'A2']) for (const [k, v] of T[ph][field]) m.set(k, (m.get(k) || 0) + v); return m; };
const ROLL = T.A1.roll + T.A2.roll;
const pct = (v, d) => +(100 * v / d).toFixed(2);
const top = (m, d, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([name, v]) => ({ name, pct: pct(v, d), samples: v }));

const OUT = { release: REL, from: 'phase-A1 + phase-A2 pooled (trace off), rollout samples only', rollout_samples: ROLL,
  rollout_share_of_all_samples: { A1: pct(T.A1.roll, P.A1.samples.length), A2: pct(T.A2.roll, P.A2.samples.length) } };
OUT.by_file_self = top(pooled('file'), ROLL, 20);
OUT.self_top = top(pooled('self'), ROLL, 50);
OUT.inclusive_top = top(pooled('incl'), ROLL, 70);
OUT.tags_js_inclusive_pct = pct(T.A1.tagSamples + T.A2.tagSamples, ROLL);
OUT.tags_js_by_caller = top(pooled('tagCaller'), ROLL, 30);

/* ---- line ticks for the hottest functions (pooled A1+A2, rollout only is implicit: they only run there) */
const WANT = ['battleTurn', 'runPlayout', 'pick', 'effSpeed', '_walk', '_updateEvent', '_updateAll', 'dmgRangeOneHit', 'dmgRange',
  'residualOrder', 'playerActionPrimary', 'norm', 'param', 'tagsFor', '_stepDamage', '_stepApply', '_stepEffects', 'residualShadowBuild',
  'residualShadowRank', 'residualExpireAt', 'residualShadowVolPresent', 'accModRow', 'hitChance', 'suppressesWeather', 'battleOver'];
OUT.lines = {};
for (const fn of WANT) {
  const ticks = new Map(); let file = null, tot = 0;
  for (const ph of ['A1', 'A2']) for (const n of P[ph].nodes) {
    if (n.callFrame.functionName !== fn || !relFile(n.callFrame.url)) continue;
    file = relFile(n.callFrame.url);
    for (const pt of (n.positionTicks || [])) { ticks.set(pt.line, (ticks.get(pt.line) || 0) + pt.ticks); tot += pt.ticks; }
  }
  if (!file) continue;
  OUT.lines[fn] = { file, self_ticks: tot, self_pct_of_rollout: pct(tot, ROLL),
    top_lines: [...ticks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([l, t]) => ({ line: l, pct_of_rollout: pct(t, ROLL), src: srcLine(file, l) })) };
}

/* ---- categories. Regex on function NAME within release files; membership printed (LESSONS §4). -- */
const CATS = [
  ['tag lookup (engine/tags.js)', n => relFile(n.callFrame.url) === 'engine/tags.js'],
  ['speed: effSpeed / turn-order compare / residual order', n => /^(effSpeed|residualOrder|compareTurnOrder|statWithBoost|sdModify|sdChain|medTieRng|orderActions|sortActions|speedOrder|turnOrder)/.test(n.callFrame.functionName)],
  ['residual shadow (residualShadow*/residualExpire*)', n => /^residual(Shadow|Expire)/.test(n.callFrame.functionName)],
  ['damage: dmgRange / dmgRangeOneHit', n => /^dmgRange/.test(n.callFrame.functionName)],
  ['accuracy: hitChance / hitProb / accModRow', n => /^(hitChance|hitProb|accModRow)/.test(n.callFrame.functionName)],
  ['event walk: _walk', n => n.callFrame.functionName === '_walk'],
  ['update pass: _updateEvent / _updateAll', n => /^_update(Event|All)$/.test(n.callFrame.functionName)],
  ['step pipeline: _step*', n => /^_step[A-Z]/.test(n.callFrame.functionName)],
  ['rollout policy: pick / playerAction*', n => /^(pick|playerAction|playerActionPrimary|pickByPrior)$/.test(n.callFrame.functionName)],
  ['trace emit (TRACE / trace*)', n => /^trace|^TR[A-Z_]|^_trace/.test(n.callFrame.functionName)],
  ['garbage collector', n => n.callFrame.functionName === '(garbage collector)'],
];
OUT.categories = [];
for (const [name, match] of CATS) {
  let s = 0; const members = new Map();
  for (const ph of ['A1', 'A2']) {
    const { stackOf } = P[ph].ix;
    for (const sid of P[ph].samples) {
      const st = stackOf(sid);
      if (!st.some(n => n.callFrame.functionName === 'runPlayout')) continue;
      const hit = st.filter(match);
      if (hit.length) { s++; for (const h of new Set(hit.map(x => x.callFrame.functionName))) members.set(h, (members.get(h) || 0) + 1); }
    }
  }
  OUT.categories.push({ category: name, inclusive_pct_of_rollout: pct(s, ROLL),
    members: [...members.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + pct(v, ROLL) + '%') });
}

/* ---- what the trace adds: samples per turn, B minus mean(A1,A2), by function (self) ------------- */
const perTurn = (ph, k) => (T[ph].self.get(k) || 0) / turns[ph];
const keys = new Set([...T.B.self.keys(), ...T.A1.self.keys(), ...T.A2.self.keys()]);
const delta = [...keys].map(k => [k, perTurn('B', k) - (perTurn('A1', k) + perTurn('A2', k)) / 2]).sort((a, b) => b[1] - a[1]);
const aPerTurn = (T.A1.roll / turns.A1 + T.A2.roll / turns.A2) / 2;
OUT.trace = { rollout_samples_per_turn_A: +aPerTurn.toFixed(3), rollout_samples_per_turn_B: +(T.B.roll / turns.B).toFixed(3),
  added_pct_of_A_turn: pct(T.B.roll / turns.B - aPerTurn, aPerTurn),
  top_added: delta.slice(0, 15).map(([k, d]) => ({ name: k, added_samples_per_turn: +d.toFixed(3), pct_of_A_turn: pct(d, aPerTurn) })) };

fs.writeFileSync(path.join(DIR, 'lines-summary.json'), JSON.stringify(OUT, null, 2) + '\n');
const P1 = (t) => console.log(t);
P1('ROLLOUT samples (A1+A2, trace off): ' + ROLL + '   rollout share of all samples ' + JSON.stringify(OUT.rollout_share_of_all_samples));
P1('\nBY FILE (self, % of rollout)'); for (const x of OUT.by_file_self.slice(0, 10)) P1('  ' + String(x.pct).padStart(6) + '%  ' + x.name);
P1('\nCATEGORIES (inclusive, % of rollout; categories overlap)'); for (const c of OUT.categories) P1('  ' + String(c.inclusive_pct_of_rollout).padStart(6) + '%  ' + c.category + '   <= ' + c.members.slice(0, 8).join(', '));
P1('\ntags.js inclusive ' + OUT.tags_js_inclusive_pct + '% of rollout; by nearest engine caller:'); for (const x of OUT.tags_js_by_caller.slice(0, 18)) P1('  ' + String(x.pct).padStart(6) + '%  ' + x.name);
P1('\nSELF top 30 (% of rollout)'); for (const x of OUT.self_top.slice(0, 30)) P1('  ' + String(x.pct).padStart(6) + '%  ' + x.name);
P1('\nINCLUSIVE top 45 (% of rollout)'); for (const x of OUT.inclusive_top.slice(0, 45)) P1('  ' + String(x.pct).padStart(6) + '%  ' + x.name);
for (const fn of ['battleTurn', 'runPlayout', 'pick', 'effSpeed', '_walk', '_updateEvent', 'norm', 'param', 'residualOrder', 'dmgRangeOneHit']) {
  const L = OUT.lines[fn]; if (!L) continue;
  P1('\nLINES ' + fn + ' (' + L.file + ', self ' + L.self_pct_of_rollout + '% of rollout)');
  for (const x of L.top_lines.slice(0, 10)) P1('  ' + String(x.pct_of_rollout).padStart(6) + '%  :' + x.line + '  ' + x.src);
}
P1('\nTRACE: rollout samples/turn A ' + OUT.trace.rollout_samples_per_turn_A + ' vs B ' + OUT.trace.rollout_samples_per_turn_B + '  (+' + OUT.trace.added_pct_of_A_turn + '%)');
for (const x of OUT.trace.top_added.slice(0, 10)) P1('  +' + String(x.pct_of_A_turn).padStart(6) + '%  ' + x.name);
