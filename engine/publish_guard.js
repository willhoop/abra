/* publish_guard.js — a run may not silently shrink a published measurement.
 *
 *   const G = require('./publish_guard.js');
 *   const r = G.publish({ file, artifact, sampleKey: 'compared', argv: process.argv, what: '...' });
 *   G.amend(r.path, 'compared', art => { art.extra = ...; });
 *
 * WHY THIS EXISTS — ROADMAP #257
 * ------------------------------
 * `tests/test-engine-diff.js` writes `data/engine-diff.json` unconditionally, at whatever `--n` was
 * on the command line. On 2026-08-13 somebody ran it at `--n 150` as a quick check and the published
 * 6,000-comparison result became a 150-comparison result. The CLAIM did not become false; its
 * EVIDENCE was deleted, and the white paper, the deck, the technical docs and the site went on citing
 * 6,000 with nothing behind it. `tests/test-docs-current.js` caught it AFTER the fact, on a line
 * nobody had touched, which is the correct behaviour of that gate and much too late to be the only
 * defence.
 *
 * The register row asked for the mitigation "pass --out or omit --write", and the correction on the
 * same row records that the mitigation does not exist: there is no `--write` flag to omit and no
 * `--out` to pass. A rule that can only be followed by remembering it is the thing this repository
 * keeps learning is worth nothing (the ban list of four, the fourteen handoffs, "known failure").
 * So it is a MECHANISM.
 *
 * WHAT IT DOES
 * ------------
 *   1. REFUSES to overwrite a published artifact with a SMALLER sample. The run still completes and
 *      its output is still written — to `data/verification/<name>.n<sample>.json` — so a verification
 *      run loses nothing except the ability to republish. `process.exitCode` is set, because a run
 *      that did not publish what it thought it published must not look like a pass.
 *   2. Requires `--republish-smaller` to shrink deliberately. That writes the artifact AND stamps
 *      `sample_shrunk` into it, so the shrink is visible in the file itself and not only in a
 *      terminal somebody has since closed.
 *   3. Keeps a HIGH-WATER MARK per artifact in `data/published-samples.json`, so the refusal survives
 *      the artifact being replaced, hand-edited, or written by a path that never called this guard.
 *      `tests/test-publish-guard.js` reads that ratchet and fails BY NAME when an artifact on disk is
 *      below its own record — which is what makes the recurrence detectable rather than merely
 *      discouraged.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not decide whether a number is TRUE, only whether a smaller sample quietly replaced a
 * larger one. A 6,000-comparison run on a simulator that has since moved is still a photograph of a
 * build that no longer exists; that is provenance's question and status.js prints it.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
/* THE HIGH-WATER FILE. Named on its own line so engine/provenance.js can attribute it to this
 * generator by the same derivation it uses for everything else — see its `writesOnItsOwnLine`. */
const RATCHET = D('data', 'published-samples.json');
/* Where a refused run puts its output. A SUBDIRECTORY, so a verification artifact never joins the
 * top-level data/ set that provenance, quarantine and the docs gates enumerate. */
const VERIFY_DIR = D('data', 'verification');
const OVERRIDE_FLAG = '--republish-smaller';

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

function readJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) {
    /* A file that exists and does not parse is NOT treated as "no previous sample". That would turn a
     * corrupt artifact into a free pass to republish at any size, which is the failure this guard is
     * about wearing a different hat. The reason is returned so the caller can print it. */
    if (e.code === 'ENOENT') return null;
    return { __unreadable: String(e.message) };
  }
}

/* The ratchet FILE is a parameter with a default, so tests/test-publish-guard.js can exercise this
 * whole file against a temporary one instead of against the repository's real record. A guard whose
 * test has to write to the artifact it is protecting is a test nobody runs twice. */
function loadRatchet(ratchetFile = RATCHET) {
  const j = readJson(ratchetFile);
  if (!j || j.__unreadable) return { artifacts: {} };
  if (!j.artifacts || typeof j.artifacts !== 'object') return { artifacts: {} };
  return j;
}

function saveRatchet(r, ratchetFile = RATCHET) {
  /* THE ARTIFACT DECLARES ITS OWN WRITER. The write below is `writeFileSync(ratchetFile, ...)` — a
   * variable, not a literal — so engine/provenance.js's write-site derivation cannot attribute it and
   * reported it under NO WRITER FOUND, which is the row that means "nothing can compare this to a
   * source". `by` is the supported declaration and provenance resolves it to a script on disk. */
  r.by = 'engine/publish_guard.js';
  r.what = 'HIGH-WATER SAMPLE PER PUBLISHED ARTIFACT — ROADMAP #257. Written by engine/publish_guard.js. '
         + 'A publish below the recorded sample is refused unless the run passes ' + OVERRIDE_FLAG + '. '
         + 'tests/test-publish-guard.js fails by name when an artifact on disk sits below its record.';
  r.updated = new Date().toISOString();
  fs.writeFileSync(ratchetFile, JSON.stringify(r, null, 2) + '\n');
}

/* THE SAMPLE FIELD IS DECLARED BY THE CALLER, NEVER GUESSED. A guard that scans an artifact for a
 * field that looks like a sample size would pick `skipped_multihit` on the very first artifact it was
 * pointed at, refuse a correct run, and get switched off — lesson 4, every derivation over-matches. */
function sampleOf(artifact, sampleKey) {
  if (!artifact || typeof artifact !== 'object') return null;
  const v = artifact[sampleKey];
  return Number.isFinite(v) ? v : null;
}

/* The recorded ceiling for an artifact: the larger of what is on disk now and what the ratchet
 * remembers. Two independent records, because either one alone has already failed — the on-disk value
 * is what #257 destroyed, and a ratchet alone cannot see a hand edit. */
function ceilingFor(file, sampleKey, ratchetFile = RATCHET) {
  const key = rel(file);
  const disk = readJson(file);
  const r = loadRatchet(ratchetFile);
  const rec = r.artifacts[key];
  const diskSample = disk && !disk.__unreadable ? sampleOf(disk, sampleKey) : null;
  const recSample = rec && Number.isFinite(rec.sample) ? rec.sample : null;
  let ceiling = null, source = null;
  if (diskSample != null) { ceiling = diskSample; source = 'the artifact on disk'; }
  if (recSample != null && (ceiling == null || recSample > ceiling)) {
    ceiling = recSample; source = 'the high-water record in ' + rel(ratchetFile);
  }
  return { ceiling, source, diskSample, recSample, unreadable: disk && disk.__unreadable ? disk.__unreadable : null };
}

/* PUBLISH. Returns { published, path, sample, ceiling } and never throws on a refusal — the caller is
 * usually a long test run and killing it would discard the very measurement being protected. */
function publish({ file, artifact, sampleKey, argv = process.argv, what = null, log = console.log,
                   ratchetFile = RATCHET, verifyDir = VERIFY_DIR }) {
  if (!file || !artifact || !sampleKey) throw new Error('publish() needs { file, artifact, sampleKey }');
  const sample = sampleOf(artifact, sampleKey);
  if (sample == null) {
    /* NOT A SILENT PASS-THROUGH. An artifact that cannot say how big its sample was is exactly the
     * file this guard cannot protect, and writing it quietly would hide that. */
    throw new Error(`publish(): the artifact carries no finite '${sampleKey}' — this guard cannot `
                  + 'compare samples it cannot read. Declare the right key or do not use the guard.');
  }
  const label = what || rel(file);
  const { ceiling, source, unreadable } = ceilingFor(file, sampleKey, ratchetFile);
  const override = argv.includes(OVERRIDE_FLAG);

  if (unreadable) {
    log(`\n  PUBLISH GUARD: ${rel(file)} exists and does not parse (${unreadable}).`);
    log('  Treating its sample as UNKNOWN and refusing to publish over it. Delete it deliberately or');
    log(`  re-run with ${OVERRIDE_FLAG}.`);
    if (!override) return withhold({ file, artifact, sampleKey, sample, ceiling: null, label, log, verifyDir });
  }

  if (ceiling != null && sample < ceiling && !override) {
    return withhold({ file, artifact, sampleKey, sample, ceiling, source, label, log, verifyDir });
  }

  if (ceiling != null && sample < ceiling && override) {
    /* THE SHRINK IS RECORDED IN THE ARTIFACT, not only in the terminal. A deliberate shrink is a
     * decision somebody made once; the file has to carry it or the next reader sees an ordinary
     * artifact with a small n and no idea that a bigger one was replaced. */
    artifact.sample_shrunk = {
      from: ceiling, to: sample, key: sampleKey, at: new Date().toISOString(),
      by: OVERRIDE_FLAG,
      warning: 'THIS PUBLISH REPLACED A LARGER SAMPLE. Every document citing the larger figure is '
             + 'orphaned until it is restated or the larger run is repeated — ROADMAP #257.',
    };
    log(`\n  *** PUBLISH GUARD OVERRIDDEN — ${label}`);
    log(`  ${rel(file)} held ${ceiling} and is being republished at ${sample}.`);
    log('  Every document citing the larger figure is now orphaned. tests/test-docs-current.js will');
    log('  say which ones. This is recorded in the artifact as `sample_shrunk`.');
  }

  fs.writeFileSync(file, JSON.stringify(artifact, null, 2) + '\n');
  const r = loadRatchet(ratchetFile);
  r.artifacts[rel(file)] = { sample, key: sampleKey, at: new Date().toISOString(),
                             by: artifact.by || null,
                             ...(ceiling != null && sample < ceiling ? { shrunk_from: ceiling } : {}) };
  saveRatchet(r, ratchetFile);
  if (ceiling != null && sample > ceiling) log(`\n  published ${rel(file)} at ${sampleKey}=${sample} (was ${ceiling})`);
  return { published: true, path: file, sample, ceiling };
}

function withhold({ file, artifact, sampleKey, sample, ceiling, source, label, log,
                    verifyDir = VERIFY_DIR }) {
  if (!fs.existsSync(verifyDir)) fs.mkdirSync(verifyDir, { recursive: true });
  const base = path.basename(file).replace(/\.json$/, '');
  const out = path.join(verifyDir, `${base}.n${sample}.json`);
  artifact.NOT_PUBLISHED = {
    why: `this run's ${sampleKey}=${sample} is smaller than the published ${ceiling == null ? '(unreadable)' : ceiling}`,
    published_artifact: rel(file), published_sample: ceiling, this_sample: sample,
    how_to_publish: `re-run at ${ceiling == null ? 'the published size' : 'at least ' + ceiling}, or pass `
                  + OVERRIDE_FLAG + ' to replace the published figure deliberately',
    roadmap: '#257',
  };
  fs.writeFileSync(out, JSON.stringify(artifact, null, 2) + '\n');
  log(`\n  *** PUBLISH REFUSED — ${label}`);
  log(`  this run measured ${sampleKey}=${sample}; ${rel(file)} holds ${ceiling == null ? 'an unreadable sample' : ceiling}`);
  if (source) log(`  (the larger figure comes from ${source})`);
  log(`  data/${rel(file).split('/').pop()} was NOT touched. This run went to ${rel(out)}`);
  log(`  A verification run may not republish a measurement at a smaller sample: every document citing`);
  log(`  the larger one would be orphaned with nothing behind it — ROADMAP #257.`);
  log(`  To replace it deliberately: re-run with ${OVERRIDE_FLAG}.`);
  /* THE RUN IS NOT A PASS. It did not publish what its own console output describes, and an exit code
   * of 0 here is how the original defect looked like a successful quick check. */
  process.exitCode = process.exitCode || 3;
  return { published: false, path: out, sample, ceiling };
}

/* AMEND — re-read an artifact this run already wrote and add to it, WITHOUT letting the sample move.
 * `tests/test-engine-diff.js` appends three conformance sections after its main write, each by
 * re-reading `data/engine-diff.json` and writing it back. Two hazards live there: a run that was
 * REFUSED would amend the published artifact it was just refused permission to touch, and a `--plant`
 * run — which writes its own file by design — was amending the real one anyway. Both disappear if the
 * amend target is the path publish() actually wrote. */
function amend(file, sampleKey, mutate) {
  const before = readJson(file);
  if (!before || before.__unreadable) throw new Error(`amend(): cannot read ${rel(file)}`);
  const wasSample = sampleOf(before, sampleKey);
  mutate(before);
  const nowSample = sampleOf(before, sampleKey);
  if (wasSample !== nowSample) {
    throw new Error(`amend(): '${sampleKey}' moved from ${wasSample} to ${nowSample}. An amend adds a `
                  + 'section to a run that already happened; it may not restate the sample size.');
  }
  fs.writeFileSync(file, JSON.stringify(before, null, 2) + '\n');
  return before;
}

/* RECORD — put an artifact that is ALREADY on disk under the ratchet, at whatever sample it actually
 * carries. Derived from the file, never typed: `node engine/publish_guard.js record data/x.json key`.
 * This is how an artifact published before the guard existed joins it. */
function record(file, sampleKey, ratchetFile = RATCHET) {
  const j = readJson(file);
  if (!j || j.__unreadable) throw new Error(`record(): cannot read ${rel(file)}`);
  const s = sampleOf(j, sampleKey);
  if (s == null) throw new Error(`record(): ${rel(file)} carries no finite '${sampleKey}'`);
  const r = loadRatchet(ratchetFile);
  const prev = r.artifacts[rel(file)];
  if (prev && Number.isFinite(prev.sample) && prev.sample > s) {
    throw new Error(`record(): ${rel(file)} is at ${sampleKey}=${s} and the ratchet already holds `
                  + `${prev.sample}. Recording would LOWER the high-water mark, which is the thing `
                  + 'this file exists to stop. Re-run the generator at the larger size instead.');
  }
  r.artifacts[rel(file)] = { sample: s, key: sampleKey, at: new Date().toISOString(),
                             by: j.by || null, recorded_from_disk: true };
  saveRatchet(r, ratchetFile);
  return s;
}

module.exports = { publish, amend, ceilingFor, loadRatchet, sampleOf, record,
                   OVERRIDE_FLAG, RATCHET, VERIFY_DIR };

if (require.main === module) {
  const [cmd, file, key] = process.argv.slice(2);
  if (cmd === 'record' && file && key) {
    const s = record(path.resolve(ROOT, file), key);
    console.log(`  recorded ${rel(path.resolve(ROOT, file))} at ${key}=${s} in ${rel(RATCHET)}`);
  } else if (cmd === 'show' || !cmd) {
    const r = loadRatchet();
    const rows = Object.entries(r.artifacts);
    console.log('\n  PUBLISHED-SAMPLE HIGH-WATER MARKS — ROADMAP #257\n');
    if (!rows.length) console.log('    (none recorded yet)');
    for (const [f, v] of rows.sort()) {
      const cur = readJson(D(f));
      const now = cur && !cur.__unreadable ? sampleOf(cur, v.key) : null;
      const flag = now == null ? '  ARTIFACT MISSING OR UNREADABLE'
                 : now < v.sample ? `  BELOW ITS RECORD — on disk ${v.key}=${now}` : '';
      console.log(`    ${f.padEnd(34)} ${v.key}=${v.sample}   ${v.at}${flag}`);
    }
    console.log(`\n  record one:  node engine/publish_guard.js record data/<artifact>.json <sampleKey>`);
  } else {
    console.error('  usage: node engine/publish_guard.js [show | record <data/file.json> <sampleKey>]');
    process.exit(2);
  }
}
