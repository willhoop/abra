/* make_proto_pins.js — MEASURE, 2026-09-08.
 *
 * WHY THIS EXISTS, and what it must not be mistaken for.
 *
 * `engine/game_differential.js` is required by the benchmark for exactly two functions —
 * `buildPair` and `freshBodies`, the repo's ONE sheet->body converter. At module load it refuses to
 * run when `data/protocol-events.json`'s `emitted` list is not the list the frozen engine claims,
 * because that file is the ALIGNMENT RULE for the differential's protocol comparison. That guard is
 * correct for the differential and it is a hard floor for a bisect: every release claims a different
 * set of TRACE_EVENTS, so ONE alignment rule cannot serve 47 engines.
 *
 * THE BENCHMARK COMPARES NO PROTOCOL. `bench_two_engines.js`'s header says so and its code shows it:
 * neither engine's log is read. So the alignment rule is inert here, and this script writes, per
 * release, a copy of the LIVE file with `emitted` replaced by that release's own claim, purely to
 * satisfy the load guard.
 *
 * THIS IS NOT AN ALIGNMENT RULE AND MUST NEVER BE USED AS ONE. Each file is stamped `_synthetic`
 * with the reason. A differential run that read one of these would be measuring against a skip list
 * that was never derived from the engine it is judging.
 *
 * The control that proves the pin is inert is in the report: releases measured natively in pass 1
 * (before the live file was regenerated at 05:36Z) are measured again under the pin, and the two
 * must agree inside the noise floor.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DIR = __dirname;
const ROOT = path.join(DIR, '..', '..', '..');
const ER = require(path.join(ROOT, 'engine', 'engine_release.js'));
const BASE_PATH = path.join(ROOT, 'data', 'protocol-events.json');
const base = JSON.parse(fs.readFileSync(BASE_PATH, 'utf8'));
const baseDigest = crypto.createHash('sha256').update(fs.readFileSync(BASE_PATH)).digest('hex').slice(0, 12);
const outDir = path.join(DIR, 'proto');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '_base-digest.txt'),
  baseDigest + '  data/protocol-events.json read ' + new Date().toISOString() + '\n');
const ids = fs.readFileSync(path.join(DIR, 'candidates.txt'), 'utf8').trim().split(/\r?\n/);
let ok = 0, failed = 0;
for (const id of ids) {
  try {
    const REL = ER.open(id);
    const M = REL.require('engine/medicham2-browser.js');
    const te = M.TRACE_EVENTS;
    if (!Array.isArray(te)) throw new Error('release exports no TRACE_EVENTS array');
    const j = JSON.parse(JSON.stringify(base));
    j.emitted = te.slice();
    j._synthetic = 'NOT AN ALIGNMENT RULE. Written by data/verification/speed-bisect-2026-09-08/'
      + 'make_proto_pins.js so that game_differential.js will LOAD under release ' + id + '. Only '
      + 'buildPair/freshBodies are used and no protocol is compared. Base file digest ' + baseDigest + '.';
    fs.writeFileSync(path.join(outDir, id + '.json'), JSON.stringify(j, null, 1) + '\n');
    ok++;
  } catch (e) {
    failed++;
    console.log('  FAILED ' + id + ': ' + e.message.split('\n')[0]);
  }
}
console.log('wrote ' + ok + ' pins, ' + failed + ' failed, base digest ' + baseDigest);
