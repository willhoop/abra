/* job_cost.js — write down what a run actually cost, so the next one can be planned.
 *
 *   const cost = require('./job_cost.js').track('wobbuffet-axis4');
 *   ...
 *   // nothing else. It records itself on exit.
 *
 *   node engine/job_cost.js            print what is known, per job
 *   node engine/job_cost.js --json     the same, machine-readable
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-05 the operating system killed a 40-minute R1 measurement. Nothing crashed and nothing
 * reported a failure: free RAM fell 4.03 GB -> 1.73 GB -> 0.62 GB while other work held the box, and
 * node exited 1 with no stack, no stderr and no dump. The measurement simply stopped existing.
 *
 * Will asked the question that exposes the real gap: **"how do we know how much memory a job takes"**.
 * We did not. Every guard built that night — the budget, the reserve, the heavy-job count — is a
 * PROXY: it counts processes over an arbitrary 400 MB line because nobody had ever written down what
 * a job actually costs. `engine/fit_joint.js` started small and climbed to 3.7 GB over twenty
 * minutes, and no artifact anywhere could have predicted that.
 *
 * So a run records its own peak. After a few runs the dispatcher can answer "will this fit in the
 * headroom I have" BEFORE starting, instead of reconstructing the answer from a memory log after
 * losing something.
 *
 * WHY PEAK AND NOT AVERAGE. The machine kills you at the peak. A job averaging 1 GB that spikes to
 * 3.7 is a 3.7 GB job for every purpose that matters here.
 *
 * WHY APPEND-ONLY. Same reason the store is: one line per run, never rewritten, so the SPREAD is
 * visible. A single number would hide that the joint fit costs 1.2 GB on a small corpus and 3.7 on
 * a large one, and the spread is the interesting part — it is what tells you the cost is a function
 * of the input rather than a constant.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not enforce anything, refuse to start, or kill. A
 * recorder that also polices is a recorder people stop calling. It writes a line and gets out of the
 * way.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'job-costs.jsonl');
const SAMPLE_MS = 5000;

function track(job, meta) {
  if (!job) throw new Error('job_cost.track needs a job name — an unnamed cost is not a measurement');
  const started = Date.now();
  let peak = 0, samples = 0;

  /* A failed sample is COUNTED, not swallowed. `samples` is written into the row, so a run whose
   * peak was measured twice and a run whose peak was measured two hundred times are distinguishable
   * by a reader — and `sample_errors` says which of those was an accident. A recorder that hides its
   * own blind spots reports a low peak as confidently as a real one. */
  let sampleErrors = 0, lastSampleError = null;
  const sample = () => {
    try { peak = Math.max(peak, process.memoryUsage().rss); samples++; }
    catch (e) { sampleErrors++; lastSampleError = String(e.message || e).slice(0, 120); }
  };
  sample();
  const timer = setInterval(sample, SAMPLE_MS);
  timer.unref?.();                       // never hold the process open just to watch it

  /* `exit` only. Not SIGTERM, not SIGKILL — SIGKILL cannot be caught at all, which is precisely how
   * the run that motivated this file died. A record that appears for graceful exits and is ABSENT
   * for kills is still useful: a missing row for a job you know ran is itself the signal that the
   * OS took it, and that is worth more than a row that lies about a clean finish. */
  process.on('exit', () => {
    sample();
    const row = {
      job,
      peak_mb: Math.round(peak / 1048576),
      duration_s: Math.round((Date.now() - started) / 1000),
      samples,
      node: process.version,
      at: new Date().toISOString(),
      ...(sampleErrors ? { sample_errors: sampleErrors, sample_error: lastSampleError } : {}),
      ...(meta && typeof meta === 'object' ? { meta } : {}),
    };
    try {
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
    } catch (writeErr) {
      /* Announced, not swallowed. Losing the cost record must not look like a job that cost nothing.
       *
       * ASKED, NOT TRIED. This runs inside an `exit` handler where stderr may already be closed, and
       * the obvious guard — wrapping the write in its own try — produces an EMPTY catch with nowhere
       * left to report from. An empty catch is the exact shape this repo's silent-failure ratchet
       * exists to refuse, and "it is unavoidable here" is what every one of them claimed. Checking
       * writability first removes the catch rather than excusing it. */
      const msg = '  job_cost: could not record ' + job + ' — ' + (writeErr.message || writeErr) + '\n';
      if (process.stderr && process.stderr.writable) process.stderr.write(msg);
    }
  });

  return { peakMb: () => Math.round(peak / 1048576) };
}

/* ---- reading it back ------------------------------------------------------------------------- */
function rows() {
  let text;
  try { text = fs.readFileSync(OUT, 'utf8'); }
  catch (readErr) {
    /* ENOENT is the ordinary state before the first run. Anything else is a real failure and is
     * rethrown rather than reported as "no costs recorded", which reads as a clean slate. */
    if (readErr.code === 'ENOENT') return [];
    throw readErr;
  }
  const out = [];
  let unparsable = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); }
    catch (parseErr) { unparsable++; }        // a torn append; counted below, never silently dropped
  }
  if (unparsable) {
    process.stderr.write('  job_cost: ' + unparsable + ' unreadable line(s) in ' + OUT
      + ' — probably a torn append from a killed process; the rest is still valid\n');
  }
  return out;
}

/* The summary reports the MAX and the SPREAD, never a mean on its own. A job whose cost depends on
 * its input has no single number, and printing one would invite planning against it. */
function summary() {
  const by = {};
  for (const r of rows()) {
    const b = (by[r.job] = by[r.job] || { job: r.job, runs: 0, min_mb: Infinity, max_mb: 0, last_at: null });
    b.runs++; b.min_mb = Math.min(b.min_mb, r.peak_mb); b.max_mb = Math.max(b.max_mb, r.peak_mb);
    b.last_at = r.at;
  }
  return Object.values(by).map(b => ({ ...b, min_mb: b.min_mb === Infinity ? 0 : b.min_mb }))
    .sort((a, z) => z.max_mb - a.max_mb);
}

if (require.main === module) {
  const s = summary();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }
  if (!s.length) {
    console.log('\n  No job costs recorded yet.');
    console.log('  Add `require("./job_cost.js").track("<name>")` to a long-running job and run it once.');
    console.log('  Until then, every memory budget in this repo is a guess — see the header.\n');
    process.exit(0);
  }
  console.log('\n  WHAT JOBS ACTUALLY COST  (peak resident, per run)\n');
  for (const b of s) {
    const spread = b.max_mb === b.min_mb ? '' : '   (low ' + (b.min_mb / 1024).toFixed(1) + ')';
    console.log('    ' + (b.max_mb / 1024).toFixed(1).padStart(5) + ' GB  ' + b.job.padEnd(34)
      + b.runs + ' run' + (b.runs === 1 ? '' : 's') + spread);
  }
  console.log('\n  Peak, not average — the machine kills you at the peak.');
  console.log('  A missing row for a job you know ran means it was killed; SIGKILL cannot be caught.\n');
}

module.exports = { track, rows, summary, OUT };
