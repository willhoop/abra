#!/usr/bin/env node
/* tests/probe_amf_default_populations.js — ROADMAP #425.
 * ==================================================================================================
 * DOES A DEFAULT engine/all_mechanics_fire.js RUN PUBLISH ALL THREE POPULATIONS?
 *
 * engine/quarantine.js requires per-entity rows for moves, abilities AND items in
 * data/all-mechanics-fire.json and falls back to counting every divergence UNFILTERED when any is
 * missing. all_mechanics_fire.js defaults `--kind` to `moves` (line 92), so a bare `--write` publishes
 * an artifact that silently disables its own consumer's filter.
 *
 * THE REAL TOOL, RUN SMALL, TO A TEMP PATH. `--limit 1` stages one entity per population; `--out`
 * sends the artifact to the scratch directory, so the canonical file is never touched. Both runs pin
 * `--release` (a bare run would cut a release) and the frozen team pool.
 *
 *   RED ARM   no --kind: the published artifact must carry rows for moves, abilities and items.
 *   CONTROL   --kind all, otherwise identical: must carry all three. If it does not, the population
 *             key this probe reads is wrong, and the run refuses rather than calling the default red.
 *
 * WHICH FIX THIS DECIDES. The row accepts two: default to `all`, or refuse to publish a partial
 * artifact to the CANONICAL path. This probe writes to a temp path and so decides the first; the
 * second needs the canonical path and is noted in the report, not staged here.
 * EXIT: 0 green / 1 red / 2 cannot answer. Stages a handful of short games.
 * ================================================================================================ */
'use strict';
/* A THROW IS NOT A VERDICT: node exits 1 on an uncaught exception, which the register reads as RED. */
process.on('uncaughtException', (e) => { console.log('CANNOT ANSWER — the probe threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ')); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); });
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const REL_ID = arg('--release', '2b5a6585d8cf');
const cannot = (why) => { console.log('CANNOT ANSWER — ' + why); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); };
const env = { ...process.env, SHOWDOWN_PATH: process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown' };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-425-'));
const POPS = ['moves', 'abilities', 'items'];

function amf(tag, extra) {
  const out = path.join(TMP, tag + '.json');
  const args = [path.join(ROOT, 'engine', 'all_mechanics_fire.js'), '--release', REL_ID, '--team-store', 'data/team-pool-frozen',
                '--limit', '1', '--write', '--out', out, ...extra];
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8', timeout: 900000, maxBuffer: 1 << 28 });
  /* The unreadable artifact is REPORTED, never absorbed: its reason travels into `tail`, which both
   * refusal paths below print, so "published nothing" always says why (#258/#409). */
  let j = null, readErr = null;
  try { j = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { readErr = 'artifact ' + out + ' unreadable: ' + e.message; }
  const rows = j && j.rows ? j.rows : {};
  return { tag, status: r.status, s: Math.round((Date.now() - t0) / 1000), j,
           have: POPS.filter(k => rows[k] && (Array.isArray(rows[k]) ? rows[k].length : Object.keys(rows[k]).length)),
           tail: (readErr ? readErr + ' | ' : '') + ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-3).join(' | ') };
}
console.log('\ntests/probe_amf_default_populations.js — ROADMAP #425   release ' + REL_ID);
const ctl = amf('kind-all', ['--kind', 'all']);
console.log('  CONTROL --kind all : exit ' + ctl.status + ' in ' + ctl.s + 's, populations ' + JSON.stringify(ctl.have));
if (!ctl.j || ctl.have.length !== 3)
  cannot('the control did not publish all three populations (' + JSON.stringify(ctl.have) + '), so this probe is reading the wrong key: ' + ctl.tail);
const red = amf('default', []);
console.log('  DEFAULT (no --kind): exit ' + red.status + ' in ' + red.s + 's, populations ' + JSON.stringify(red.have));
if (!red.j) cannot('the default run published nothing: ' + red.tail);

let headHave = null;
try {
  const h = JSON.parse(execFileSync('git', ['show', 'HEAD:data/all-mechanics-fire.json'], { cwd: ROOT, maxBuffer: 1 << 30 }).toString());
  headHave = POPS.filter(k => h.rows && h.rows[k]);
  console.log('  context: HEAD data/all-mechanics-fire.json carries ' + JSON.stringify(headHave) + ' (release ' + h.engine_release + ')');
} catch (e) { console.log('  context: HEAD data/all-mechanics-fire.json unreadable: ' + e.message); }

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + detail);
  if (!cond) bad++;
};
const missing = POPS.filter(k => !red.have.includes(k));
ok(!missing.length, 'a default run publishes moves, abilities and items',
   missing.length ? 'cell: engine/all_mechanics_fire.js with no --kind published ' + JSON.stringify(red.have) + ' and no rows for '
     + missing.join(' or ') + ' — the artifact engine/quarantine.js reads would disable its reach filter' : null);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.log('  (temp dir left at ' + TMP + ')'); }
console.log('\n' + (bad ? 'RED' : 'GREEN'));
console.log('ABRA-EXIT ' + (bad ? '1 VERDICT-RED' : '0 VERDICT-GREEN'));
process.exit(bad ? 1 : 0);
