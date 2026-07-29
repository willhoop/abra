/* probe.js — one mechanic, everything the artifact and the engine believe about it, one command.
 *
 *   node tests/probe.js move heatwave
 *   node tests/probe.js move solarbeam --vs garchomp --by venusaur --weather sun --bench pelipper
 *   node tests/probe.js ability flamebody --by garchomp --vs incineroar
 *   node tests/probe.js item lifeorb
 *
 * Will: "can we run selective tests where we see exactly the move or feature we want to test and
 * make sure it works". The suite proves nothing broke (3m15s, tests/run-all.js); this answers the
 * other question — does THIS mechanic read right — in one second, before and after a change.
 * It prints reads only: tags and params from data/tags.json, then the engine numbers those params
 * produce (damage under every sky, accuracy, the punisher price of touching it, bench fragility).
 * Nothing here asserts; eyes on numbers is the point. Wire assertions still belong in the gates.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const TAGS = require(path.join(ROOT, 'engine', 'tags.js'));
const db = require(path.join(ROOT, 'data', 'tags.json'));

const argv = process.argv.slice(2);
const kind = argv[0], id = (argv[1] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const opt = name => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : null; };
if (!/^(move|item|ability)$/.test(kind) || !id) {
  console.log('usage: node tests/probe.js <move|item|ability> <id> [--by mon] [--vs mon] [--weather w] [--bench mon,mon]');
  process.exit(1);
}

const KINDMAP = { move: 'moves', item: 'items', ability: 'abilities' };
const rec = db[KINDMAP[kind]][id];
console.log(`\nPROBE ${kind} ${id}`);
console.log('='.repeat(40));
if (!rec) {
  console.log('NOT IN THE ARTIFACT — below the usage floor or not in this format. The engine prices it at nothing.');
  process.exit(0);
}
console.log(`artifact: "${rec.name}"${rec.uses != null ? ` — ${rec.uses} uses on sheets` : ''}`);
for (const t of rec.tags || []) {
  const p = rec.params && rec.params[t];
  console.log(`  ${t}${p ? '  ' + JSON.stringify(p) : ''}`);
}

const by = opt('by') || 'garchomp', vs = opt('vs') || 'incineroar';
const att = M.buildMon(by, {}), tgt = M.buildMon(vs, {});
if (!att || !tgt) { console.log(`\n(cannot build ${!att ? by : vs} — pick mons from the dataset for engine numbers)`); process.exit(0); }
const F = w => ({ terrain: '', weather: w, twA: 0, twB: 0 });

if (kind === 'move') {
  const mv = MC.moves[id];
  if (!mv) { console.log('\nnot in the compact move table.'); process.exit(0); }
  console.log(`\nengine: type ${mv.t}, class ${mv.c}, bp ${mv.bp}${mv.rc ? `, recoil ${mv.rc[0]}/${mv.rc[1]}` : ''}${mv.self ? `, self ${JSON.stringify(mv.self)}` : ''}`);
  console.log(`\n${by} clicks it into ${vs}:`);
  for (const w of ['', 'sun', 'rain', 'sand', 'snow']) {
    const d = M.dmgRange(att, tgt, mv, F(w), false);
    const acc = M.moveAccuracy(id, F(w));
    console.log(`  ${(w || 'clear').padEnd(5)}  ${String(d.min).padStart(4)}-${String(d.max).padEnd(4)} HP (${Math.round(100 * d.min / tgt.st.hp)}-${Math.round(100 * d.max / tgt.st.hp)}% of its ${tgt.st.hp})  eff x${d.eff}  acc ${acc}`);
  }
  const x = M.punishExposure(att, tgt, id, { field: F(opt('weather') || '') });
  console.log(`touch cost vs ${vs} (${tgt.ability}): ${x ? JSON.stringify({ total: x.total, parts: x.parts }) : 'none'}`);
  const bench = (opt('bench') || '').split(',').filter(Boolean).map(n => M.buildMon(n.trim(), {})).filter(Boolean);
  if (bench.length) {
    const fr = M.clickFragility(att, id, tgt, bench, F(opt('weather') || ''));
    console.log(`bench risk [${bench.map(b => b.name).join(', ')}]: ${fr ? JSON.stringify(fr) : 'none'}`);
  }
}

if (kind === 'ability') {
  tgt.ability = id;
  console.log(`\ntouching a ${id} body (${by} → ${vs}-as-${id}):`);
  for (const mvId of ['ironhead', 'earthquake', 'dragonpulse']) {
    const x = M.punishExposure(att, tgt, mvId, { field: F(opt('weather') || '') });
    console.log(`  ${mvId.padEnd(12)} ${x ? JSON.stringify({ total: x.total, parts: x.parts.map(p => p.what) }) : 'free'}`);
  }
  const f2 = F(opt('weather') || '');
  M.applyEntryEffects(Object.assign({}, att, { ability: id }), f2);
  if (f2.weather || f2.terrain) console.log(`on entry it sets: ${f2.weather || f2.terrain}`);
}

if (kind === 'item') {
  att.item = id;
  const bare = M.buildMon(by, {}); bare.item = '';
  console.log(`\n${by} holding it, ironhead into ${vs}:`);
  const d1 = M.dmgRange(att, tgt, MC.moves.ironhead, F(''), false);
  const d0 = M.dmgRange(bare, tgt, MC.moves.ironhead, F(''), false);
  console.log(`  with: ${d1.min}-${d1.max}  without: ${d0.min}-${d0.max}  ratio x${(d1.max / d0.max).toFixed(3)}`);
  tgt.item = id; att.item = '';
  const d2 = M.dmgRange(att, tgt, MC.moves.ironhead, F(''), false);
  console.log(`  ${vs} holding it as DEFENDER, same click: ${d2.min}-${d2.max} (vs ${d0.min}-${d0.max} bare)`);
}
console.log('');
