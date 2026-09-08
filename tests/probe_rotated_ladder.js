#!/usr/bin/env node
/* probe_rotated_ladder.js — CAN THE INGEST TELL A ROTATED LADDER FROM A QUIET ONE?
 *
 * THE SILENT FAILURE THIS STAGES. `engine/durable-ingest.js` keys its ZERO-GAIN guard on
 * `idsSeen===0`, on the fact that Showdown's public replay pool is a rolling ~1,250 per format so a
 * live format always fills page one. That is true and it is the wrong discriminator for a ROTATION:
 * a rotated ladder keeps offering its ~1,250 stale ids forever, so `idsSeen` is never 0, every id is
 * already stored, `newIds===0`, and the run prints "nothing new" and exits 0. The store stops growing
 * and the shrink guard — which checks monotonicity — stays green on a file that never changes.
 *
 * A quiet ladder and a dead ladder are already distinguishable. A quiet ladder and a ROTATED one were
 * not, and that is the gap: nothing on the collection side could tell them apart.
 *
 * THE FIXTURE IS SYNTHETIC AND SELF-CONTAINED. `https.get` is replaced in a PRELOAD module written to
 * this run's own temp directory, so the real ingest binary runs unmodified against a fake replay API
 * and no network call is made. The store it appends to is in the same temp directory. Nothing under
 * `data/` is opened for writing and the real store is never read.
 *
 * THREE ARMS, and the third is the one that makes the other two mean anything:
 *   ROTATED — the pool is full, every id is already stored, and the newest replay in it is 30 h old.
 *   QUIET   — the pool is full, every id is already stored, and the newest replay is 6 minutes old.
 *             This is a genuinely quiet hour and MUST still exit 0. A guard that fires here is a
 *             guard that gets waived.
 *   DEAD    — the endpoint offers nothing at all. The existing idsSeen===0 guard owns this and must
 *             keep owning it.
 *
 * THE THRESHOLD IS MEASURED, NOT ASSUMED. Against the live endpoint on 2026-09-08 the M-B pool held
 * 1,275 ids, its newest replay was 0.02 h old and the whole pool spanned 22.5 h.
 *
 *   node tests/probe_rotated_ladder.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-rotated-'));
const PRELOAD = path.join(tmp, 'fake_replay_api.js');
fs.writeFileSync(PRELOAD, `'use strict';
/* A FAKE REPLAY API, written by tests/probe_rotated_ladder.js for its own run. Serves the pool in
 * FAKE_POOL on page 1 and an empty page after it; a .log fetch is answered with an empty body and
 * counted, because in these arms every offered id is already stored and no log should be requested. */
const https = require('https');
const { EventEmitter } = require('events');
const POOL = JSON.parse(process.env.FAKE_POOL || '[]');
https.get = (u, cb) => {
  let body = '';
  if (/search\\.json/.test(u)) {
    const p = +((/page=(\\d+)/.exec(u) || [, '1'])[1]);
    body = JSON.stringify(p === 1 ? POOL : []);
  } else { process.stderr.write('FAKE-API: unexpected log fetch ' + u + '\\n'); }
  const res = new EventEmitter();
  res.setEncoding = () => {};
  const req = new EventEmitter();
  req.setTimeout = () => {}; req.destroy = () => {};
  cb(res);
  process.nextTick(() => { res.emit('data', body); res.emit('end'); });
  return req;
};
`);

const NOW = Math.floor(Date.now() / 1000);
/* Pool shape copied from the live endpoint's own rows (measured 2026-09-08: uploadtime, id, format,
 * players, rating, private, password). Only the two fields the ingest reads are populated. */
function pool(newestAgeH, spanH, n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const age = newestAgeH + (spanH * i) / n;
    rows.push({ id: `probe-rotated-${i}`, uploadtime: NOW - Math.round(age * 3600) });
  }
  return rows;
}

function arm(label, rows, { seedStore = true } = {}) {
  const dir = path.join(tmp, label);
  fs.mkdirSync(dir, { recursive: true });
  const store = path.join(dir, 'store.jsonl');
  /* Every offered id is ALREADY STORED — that is the whole point: newIds will be 0. */
  fs.writeFileSync(store, seedStore ? rows.map(r => JSON.stringify({ id: r.id, format: 'champions-regmb' })).join('\n') + '\n' : '');
  const r = spawnSync(process.execPath, ['-r', PRELOAD, D('engine', 'durable-ingest.js'), store], {
    cwd: dir, encoding: 'utf8',
    env: Object.assign({}, process.env, { FAKE_POOL: JSON.stringify(rows), PAGES: '25', CONC: '4' }),
  });
  const err = (r.stderr || '');
  const stale = (err.split('\n').find(l => /STALE-LADDER/.test(l)) || '').trim();
  const zero = (err.split('\n').find(l => /ZERO-GAIN/.test(l)) || '').trim();
  console.log(`  ${label.padEnd(8)}: exit ${r.status}` +
    (stale ? '  STALE-LADDER' : '') + (zero ? '  ZERO-GAIN' : '') +
    (!stale && !zero ? '  (no discriminator fired)' : ''));
  if (stale) console.log('      ' + stale.slice(0, 160));
  if (zero) console.log('      ' + zero.slice(0, 120));
  return { status: r.status, stale: !!stale, zero: !!zero, err };
}

console.log('PROBE — a rotated ladder against a quiet one (fake replay API, no network, no real store)');
console.log('  live pool measured 2026-09-08: 1,275 ids, newest 0.02 h old, span 22.5 h\n');

const rotated = arm('ROTATED', pool(30, 22.5, 200));
const quiet = arm('QUIET', pool(0.1, 22.5, 200));
const dead = arm('DEAD', [], { seedStore: false });

console.log('');
let bad = 0;
if (!rotated.stale || rotated.status === 0) {
  bad++;
  console.log('RED — a rotated ladder (pool full, nothing new, newest replay 30 h old) finished at');
  console.log(`      exit ${rotated.status} with no discriminator. The store stops growing and the`);
  console.log('      shrink guard stays green, because a file that never changes never shrinks.');
}
if (quiet.stale || quiet.status !== 0) {
  bad++;
  console.log('RED (control) — a genuinely QUIET hour fired the rotation guard. A guard that cannot');
  console.log('      tell quiet from rotated is the one people learn to waive.');
}
if (!dead.zero || dead.status === 0) {
  bad++;
  console.log('RED (control) — the pre-existing idsSeen===0 guard stopped owning a DEAD endpoint.');
}
if (!bad) {
  console.log('GREEN — rotated is refused by name, quiet still exits 0, and a dead endpoint is still');
  console.log('      the ZERO-GAIN guard\'s. Three states, three answers.');
}
fs.rmSync(tmp, { recursive: true, force: true });   // this run made this directory; nothing else is touched
process.exit(bad ? 1 : 0);
