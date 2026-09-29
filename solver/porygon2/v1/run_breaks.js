/* solver/porygon2/v1/run_breaks.js — solver/tests/test-porygon2-v1.js GREEN, then once under every deliberate break, which must
 * each turn it RED (exit 1). Prints one line per run and exits 1 if a break came back GREEN or the clean run was RED.
 *
 *   node solver/porygon2/v1/run_breaks.js [--model m.json --fixture f.json --metrics x.json]
 */
'use strict';
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..', '..');
const pass = process.argv.slice(2);
const RUNS = [{ name: 'clean', env: {}, want: 0 },
  { name: 'PORY2V1_INFER_BREAK=mask', env: { PORY2V1_INFER_BREAK: 'mask' }, want: 1 },
  { name: 'PORY2V1_BREAK=honest', env: { PORY2V1_BREAK: 'honest' }, want: 1 },
  { name: 'PORY2V1_BREAK=protect', env: { PORY2V1_BREAK: 'protect' }, want: 1 },
  { name: 'PORY2V1_BREAK=tr', env: { PORY2V1_BREAK: 'tr' }, want: 1 },
  { name: 'MILTANK_BREAK=leaf', env: { MILTANK_BREAK: 'leaf' }, want: 1 }];
let bad = 0;
for (const r of RUNS) {
  const t = Date.now();
  const p = cp.spawnSync(process.execPath, [path.join(ROOT, 'solver', 'tests', 'test-porygon2-v1.js'), ...pass], { cwd: ROOT, env: Object.assign({}, process.env, r.env), encoding: 'utf8' });
  const out = (p.stdout || '') + (p.stderr || '');
  const fails = out.split('\n').filter(l => /FAIL|GREEN|RED/.test(l)).slice(0, 6).join(' | ');
  const good = p.status === r.want;
  if (!good) bad++;
  console.log(`${good ? 'ok ' : 'BAD'} ${r.name}: exit ${p.status} (${((Date.now() - t) / 1000).toFixed(0)}s) ${fails}`);
}
process.exit(bad ? 1 : 0);
