/* test-next-regulation.js — the next-regulation collector can prove it ran, and prove it declined.
 *
 * WHY THIS SHAPE. The capability under test spends the next two weeks doing NOTHING, on purpose.
 * "Collected nothing" and "was never wired up" produce identical output on every day but one, and
 * the one day they differ is the day it matters. That is this project's founding failure — a
 * capability absent while everything reports success — so the checks below are counters and varied
 * knobs, never "does the code exist".
 *
 *   1  the detector finds Champions VGC regulation formats AT ALL          (a zero is the alarm)
 *   2  the format named in data/regulations.json is one of them            (the pattern matches
 *                                                                          reality, not nothing)
 *   3  the ordering knob MOVES the classification                          (identical output across
 *                                                                          a varied knob = unwired)
 *   4  the absent path exits clean and says so in words                    (not a crash, not silence)
 *   5  the per-game format tag follows the tier line                       (it was a constant, and
 *                                                                          the rotation alarm reads it)
 *   6  the collector's stores can never be the tracked stores              (no regulation is pooled)
 *
 * NETWORK. There are two authorities: the live server's format list and the local checkout. The
 * live one is what will actually detect the arrival; the local one is offline and deterministic.
 * Checks 1-3 run on the OFFLINE arm so this test is not a network test. The live arm is exercised
 * once and reported. It fails only if BOTH are unreachable — at which point nothing can detect
 * anything and the capability really is dead.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const NR = require(path.join(ROOT, 'engine', 'next_regulation.js'));
const NRI = require(path.join(ROOT, 'engine', 'next_regulation_ingest.js'));
const { extract } = require(path.join(ROOT, 'engine', 'durable-ingest.js'));

let fails = 0;
const ok = (cond, msg, detail) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + msg + (detail ? '   ' + detail : ''));
  if (!cond) fails++;
};

(async () => {
  console.log('NEXT-REGULATION COLLECTOR');
  console.log('');

  /* ---- 1 + 2: the offline authority, and the counter that must not be zero -------------------- */
  const off = await NR.detect({ net: false });
  console.log(`  local dex: ${off.authorities.dex.reached ? off.authorities.dex.formats_listed + ' formats' : 'NOT REACHED'}`);
  ok(off.counters.vgc_regulation_formats_detected > 0,
    'the detector finds Champions VGC regulation formats',
    `counter = ${off.counters.vgc_regulation_formats_detected}`);

  const active = off.active_format;
  const row = off.formats.find(r => r.id === active);
  ok(!!row, 'the active format from data/regulations.json is one of the detected formats', String(active));
  ok(!!row && row.classification === 'known', 'and it classifies as known', row ? row.classification : 'n/a');

  /* ---- 3: THE KNOB. Same detected rows, active regulation moved back one, outcome must move. ---
   * Both ids below are REAL formats on the live server today; nothing is invented. */
  const older = off.formats.filter(r => r.classification === 'superseded').map(r => r.id);
  ok(older.length > 0,
    'there is at least one detected format older than the active one to swing the knob with',
    older.join(', ') || 'NONE — check 3 cannot be run');

  if (older.length) {
    const swung = await NR.detect({ net: false, active: older[0], knownIds: older });
    const before = off.counters.candidates;
    const after = swung.counters.candidates;
    ok(after !== before,
      'moving the active regulation back CHANGES the candidate count (the ordering rule is wired)',
      `candidates ${before} -> ${after}`);
    ok(after > 0 && swung.candidates.every(r => NR.laterThan(r, NR.parseFormatId(older[0]))),
      'and every candidate it produces really does sort after the (overridden) active regulation',
      swung.candidates.map(r => r.id).join(', '));
    /* The reverse direction, because a rule that says "everything is a candidate" would also pass
     * the check above. */
    ok(NR.laterThan(NR.parseFormatId(active), NR.parseFormatId(older[0])) === true &&
       NR.laterThan(NR.parseFormatId(older[0]), NR.parseFormatId(active)) === false,
      'the ordering is asymmetric in the right direction',
      `${active} > ${older[0]}`);
  }

  /* ---- the live arm, reported ------------------------------------------------------------------ */
  const live = await NR.detect({ net: true });
  const liveOK = live.authorities.live.reached;
  console.log(`  live authority: ${liveOK ? live.authorities.live.formats_listed + ' formats listed' : 'UNREACHABLE — ' + (live.problems[0] || 'no reason given')}`);
  ok(liveOK || off.authorities.dex.reached,
    'at least one format authority answered (both dead = nothing can ever detect the arrival)',
    `live=${liveOK} dex=${off.authorities.dex.reached}`);
  if (liveOK) {
    ok(live.counters.vgc_regulation_formats_detected > 0,
      'the live authority also yields Champions VGC regulation formats',
      String(live.counters.vgc_regulation_formats_detected));
  }

  /* ---- 4: the absent path is a stated decline, not a crash and not a silence ------------------- */
  const r = spawnSync(process.execPath,
    [path.join(ROOT, 'engine', 'next_regulation_ingest.js'), '--dry-run', '--no-net', '--no-write'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  ok(r.status === 0, 'the collector exits 0 when there is no next regulation', 'exit ' + r.status);
  const declared = off.counters.candidates === 0
    ? /COLLECTED NOTHING, AND THAT IS THE CORRECT ANSWER TODAY/.test(out)
    : /would collect/.test(out);
  ok(declared, 'and it says in words what it did', off.counters.candidates === 0 ? 'declined' : 'would collect');
  ok(/COUNTERS \{/.test(out), 'and it prints its counters', (out.match(/COUNTERS \{[^\n]*/) || [''])[0].slice(0, 120));
  ok(!/wrote data\/next-regulation.json/.test(out), '--no-write really writes nothing');

  /* ---- 5: the per-game format tag. CONSTRUCTED fixture, so no store file is needed. ------------
   * The two tier strings are the two real Champions VGC regulations Showdown serves today, quoted
   * from the live format list. The knob is the tier line; the outcome is the stored label. */
  const logFor = tier => `|player|p1|a||1500\n|player|p2|b||1500\n|tier|${tier}\n|turn|1\n`;
  const mb = extract('x-1', 0, logFor('[Gen 9 Champions] VGC 2026 Reg M-B (Bo3)')).format;
  const ma = extract('x-2', 0, logFor('[Gen 9 Champions] VGC 2026 Reg M-A (Bo3)')).format;
  ok(mb === 'champions-regmb', 'the active regulation keeps the label the store already holds', mb);
  ok(ma === 'champions-regma', 'a DIFFERENT Champions regulation gets a DIFFERENT label', ma);
  ok(mb !== ma, 'so build/triggers.js can see a rotation at all (it tallies this field)', `${mb} vs ${ma}`);

  /* ---- 6: the tracked stores are not reachable by this collector ------------------------------- */
  const owned = NRI.ownStores().map(p => path.basename(p));
  const tracked = ['games.ladder.jsonl', 'games.bo3.jsonl', 'games.ots.jsonl'];
  ok(owned.every(f => !tracked.includes(f)),
    'the collector never claims one of the three tracked stores',
    owned.length ? owned.join(', ') : 'no next-regulation store on disk');
  /* A .gz in this list handed reconcile() a compressed path, which read the binary as text and
   * wrote it back out as text — the archive destroyed by the code meant to protect it. */
  ok(owned.every(p => /\.jsonl$/.test(p)),
    'and it only ever names PLAIN store paths (a .gz here destroys the archive)',
    owned.join(', ') || 'none on disk');
  const nameOf = f => path.basename(NRI.storeFor(f));
  ok(nameOf(active) === 'games.' + active + '.jsonl',
    'a store name IS the format id, so two regulations cannot share a file',
    nameOf(active));

  console.log('');
  console.log(fails ? `RED — ${fails} check(s) failed` : 'GREEN — all checks passed');
  process.exit(fails ? 1 : 0);
})();
