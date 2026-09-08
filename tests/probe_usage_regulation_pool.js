#!/usr/bin/env node
/* probe_usage_regulation_pool.js — DOES data/meta-usage.json POOL TWO REGULATIONS UNDER ONE LABEL?
 *
 * THE SILENT FAILURE THIS STAGES. `engine/analyze.js` writes `format: ACTIVE_FORMAT` as a LABEL and
 * loads its corpus with `Q.loadGames()`, which never looks at `g.format`. The segmentation key is in
 * every stored row — `engine/durable-ingest.js` derives `champions-reg<token>` from the |tier| line,
 * added 2026-08-31 precisely so a rotation would be visible — and until today only
 * `build/triggers.js` read it. So the moment a regulation rotates, the new regulation's games pool
 * onto the old corpus and the result is stamped with the NEW regulation's name. CHOMP reads that file.
 *
 * THE FIXTURE IS REAL, NOT SYNTHETIC. `data/games.gen9championsvgc2026regmabo3.jsonl` holds 51 rows
 * stamped `champions-regma` — collected by `engine/next_regulation_ingest.js`, which does exactly what
 * it is supposed to do. Those rows are appended to a sample of the active regulation's rows in a
 * TEMPORARY store under the OS temp directory. Nothing in `data/` is read for writing, and
 * `data/meta-usage.json` is never touched: `analyze.js` writes `data/meta-usage.json` RELATIVE to the
 * working directory, so each arm runs with its own cwd and writes its own copy.
 *
 * The rotation direction (an M-C row arriving while `active` is still M-B, or an M-B row surviving
 * after the flip) is the SAME seam: any row whose token is not the active regulation's is pooled.
 * This arm uses the one that can be staged today with real rows.
 *
 *   node tests/probe_usage_regulation_pool.js
 *
 * RED means the pooled arm counted more teams than the active-regulation-only arm: the other
 * regulation's games are inside a model labelled with this one.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const Q = require(D('engine', 'quality.js'));
const DI = require(D('engine', 'durable-ingest.js'));
const ACTIVE = DI.activeStoreFormat();

/* SAMPLE SIZE. Large enough that the pooled arm is not dominated by the intruder rows, small enough
 * that both arms run in seconds. The intruder count is whatever the real M-A store holds. */
const N_ACTIVE = 2000;

const other = Q.readStore(D('data', 'games.gen9championsvgc2026regmabo3.jsonl'));
const mine = Q.readStore().filter(g => g.format === ACTIVE).slice(-N_ACTIVE);
const intruders = other.filter(g => g.format && g.format !== ACTIVE);
if (!intruders.length) {
  console.log('CANNOT STAGE — no row with a non-active format token was found to build the fixture.');
  console.log('  That is a claim about the fixture, not about the seam. Stage one and re-run.');
  process.exit(2);
}
const tally = rows => { const t = {}; for (const g of rows) t[g.format || '(no field)'] = (t[g.format || '(no field)'] || 0) + 1; return t; };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-regpool-'));
function stage(name, rows) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  const store = path.join(dir, 'store.jsonl');
  fs.writeFileSync(store, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  return { dir, store };
}
function run(label, rows) {
  const { dir, store } = stage(label, rows);
  const r = spawnSync(process.execPath, [D('engine', 'analyze.js'), store],
    { cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env, { ABRA_NO_STORE_CACHE: '1' }) });
  let model = null;
  try { model = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'meta-usage.json'), 'utf8')); }
  catch (e) { console.log(`  ${label}: analyze.js wrote no model — ${e.message}`);
    console.log((r.stdout || '').split('\n').slice(-6).join('\n'), (r.stderr || '').split('\n').slice(-6).join('\n')); }
  return { model, r };
}

console.log('PROBE — two regulations under one label');
console.log(`  active regulation store token: ${ACTIVE}`);
console.log(`  fixture: ${mine.length} rows ${JSON.stringify(tally(mine))} + ` +
  `${intruders.length} rows ${JSON.stringify(tally(intruders))}\n`);

const pooled = run('pooled', mine.concat(intruders));
const alone = run('active-only', mine);
if (!pooled.model || !alone.model) { console.log('ARM FAILED — cannot judge.'); process.exit(2); }

const sT = m => m.views && m.views.competitive ? m.views.competitive.sampledTeams : m.sampledTeams;
const top = m => (m.threats || []).slice(0, 3).map(t => `${t.sp} ${(100 * t.teamRate).toFixed(1)}%`).join(', ');
console.log(`  POOLED      : label "${pooled.model.format}", ${sT(pooled.model)} teams — ${top(pooled.model)}`);
console.log(`  ACTIVE ONLY : label "${alone.model.format}", ${sT(alone.model)} teams — ${top(alone.model)}`);
const prov = pooled.model.provenance || {};
console.log(`  pooled provenance says: formatToken=${JSON.stringify(prov.formatToken)} ` +
  `otherRegulations=${JSON.stringify(prov.otherRegulations)}`);

/* THE ROTATED-STORE ARM. After the flip, the old ladder's store holds rows and NONE of them are the
 * active regulation. A model computed from zero games of the regulation it names is not a model, so
 * this must refuse rather than write an empty one. */
const rotated = run('rotated', intruders);
console.log(`  ROTATED     : exit ${rotated.r.status}, model written: ${!!rotated.model}`);
const refusal = ((rotated.r.stderr || '').split('\n').find(l => /REFUSING/.test(l)) || '').trim();
if (refusal) console.log('      ' + refusal.slice(0, 150));

console.log('');
const pooledIn = sT(pooled.model) - sT(alone.model);
if (pooledIn > 0) {
  console.log(`RED — ${pooledIn} team-side(s) from another regulation are inside a model labelled`);
  console.log(`      "${pooled.model.format}". Nothing in the artifact says so, and CHOMP reads it.`);
} else {
  console.log('GREEN — the two arms count the same teams: the other regulation\'s rows were filtered');
  console.log(`      out by the store token, and the artifact records what it dropped.`);
}
if (rotated.model || rotated.r.status === 0) {
  console.log('RED (second arm) — a store holding NO games of the active regulation still produced a');
  console.log('      model. That is what the old ladder looks like the day after the flip.');
}
fs.rmSync(tmp, { recursive: true, force: true });   // this run made this directory; nothing else is touched
process.exit((pooledIn > 0 || rotated.model || rotated.r.status === 0) ? 1 : 0);
