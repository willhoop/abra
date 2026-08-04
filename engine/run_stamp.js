/* run_stamp.js — the sidecar that says WHICH CONFIGURATION produced a set of numbers.
 *
 *   node engine/run_stamp.js --reconstruct data/rollout-cost.json
 *   node engine/run_stamp.js --show        data/rollout-r3.json
 *
 * WHY THIS FILE EXISTS, IN ONE PARAGRAPH
 * --------------------------------------
 * R1 published "68.18% against material's 65.26%, +2.91 [1.79, 4.04]" and the only committed evidence
 * recomputes to +0.456, 95% CI [-0.717, +1.630] — UNDECIDED. Nothing was falsified and nothing was
 * hidden. `data/rollout-r1-rows.jsonl` records {gid, turn, p, mpy, y, aliveDiff, hpDiff} and no N, no
 * explore setting and no build digest, so a dump taken at explore=0 and a dump taken at explore=1 are
 * BYTE-COMPATIBLE and differ by nearly four accuracy points. Only the calibration shape told them
 * apart, and only in hindsight. R2 and R3 had the identical hole.
 *
 * ONE IMPLEMENTATION, NOT THREE
 * -----------------------------
 * `engine/rollout_r1.js` hand-rolled the first sidecar inline. This is that same shape lifted into a
 * module so the next gate does not hand-roll a second one that drifts — the `buildMon("Scizor")`
 * lesson. The field names here are r1's field names deliberately; a reader who has read one sidecar
 * has read all of them.
 *
 * A SIDECAR AND NOT A HEADER, for a reason that only applies to r1 but is kept for uniformity:
 * `engine/rollout_r1_join.py` parses every line of the row dump as a position, so a stamp written into
 * the dump would be read as data. The convention is `<artifact-with-extension-stripped>.meta.json`,
 * which is why `data/rollout-r1-rows.jsonl` is described by `data/rollout-r1-rows.meta.json`.
 *
 * TWO MODES, AND THE DIFFERENCE BETWEEN THEM IS THE WHOLE POINT
 * ------------------------------------------------------------
 *   writeStamp()  — LIVE. The run itself calls it while it still knows its own settings and can hash
 *                   the bytes it just read. This is the only mode that produces a stamp worth trusting.
 *   reconstruct() — RETROSPECTIVE, for an artifact written before any of this existed. It infers the
 *                   build from the commit that carried the artifact and marks itself `reconstructed:
 *                   true` on every line. It is evidence about a commit, not a record of a run, and it
 *                   says so. A stamp that hashed TODAY's sources would describe this file rather than
 *                   that run and would be worse than nothing — that is r1's own stated reason for
 *                   recording null instead.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

/* The files every rollout gate reaches. A gate that reaches more passes them in `sources`; the union
 * is what gets hashed. Listed rather than derived because `require` graph walking would pull in the
 * whole Showdown tree and drown the signal. */
const LEAF_SOURCES = [
  'engine/rollout_leaf.js',
  'engine/medicham2-browser.js',
  'engine/board.js',
  'data/engine-data.js',
  'data/abra-tags.js',
];

function sha12(rel) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(D(rel))).digest('hex').slice(0, 12); }
  catch (e) { return 'MISSING'; }
}

function git(args) {
  try { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim(); }
  catch (e) { return null; }
}

/* THE SIDECAR'S PATH IS DERIVED FROM THE ARTIFACT'S, never passed separately. Two arguments that must
 * agree is two chances to disagree, and a sidecar sitting beside the wrong file is indistinguishable
 * from a correct one. */
function metaPathFor(rel) {
  return rel.replace(/\\/g, '/').replace(/\.[^./]+$/, '') + '.meta.json';
}

/* Content, not mtime. A checkout moves an mtime without moving code — `data/engine-data.js` was newer
 * than the merge script that was supposed to have written it and had still lost every one of its 67
 * writes. */
function sourceDigests(sources) {
  const out = {};
  for (const s of (sources || LEAF_SOURCES)) out[s] = sha12(s);
  out.note = 'Content, not mtime. A checkout moves an mtime without moving code.';
  return out;
}

/* The commit is the stamp `data/rollout-r4.json` has and the rollout dumps did not: mew.js writes one
 * into every game record, nothing writes one here. `dirty` is not decoration — a clean commit id over
 * a dirty tree is a lie of exactly the kind this module exists to stop. */
function gitState(sources) {
  const commit = git(['rev-parse', 'HEAD']);
  if (!commit) return { commit: null, why_null: 'git was not available when this stamp was written' };
  const watched = (sources || LEAF_SOURCES);
  const porcelain = git(['status', '--porcelain', '--'].concat(watched)) || '';
  const dirty = porcelain.split('\n').map(s => s.trim()).filter(Boolean).map(s => s.replace(/^\S+\s+/, ''));
  return {
    commit,
    dirty_sources: dirty,
    dirty: dirty.length > 0,
    note: dirty.length
      ? 'THE TREE WAS DIRTY. The commit id below does NOT describe what ran; source_digests does. '
        + 'Trust the digests over the commit whenever these two disagree.'
      : 'Every watched source matched the commit at write time.',
  };
}

/**
 * LIVE stamp. Call it from the run, at the moment the run writes its numbers.
 *
 *   describes   relative path of the artifact or dump this stamp is about
 *   by          the script writing it
 *   rows        how many units the artifact is built from (see n_unit)
 *   n_unit      what one row IS — position, board, decision, decisive pair. The series had no common
 *               `n` field and four different names for the count, so cross-checking two gates meant
 *               reading two generators first.
 *   measured    the configuration the numbers describe: {key, n_rollouts, explore, ...}. r1 calls this
 *               `p_column` because its dump has literally one probability column; the general case is
 *               "which configuration is this", so both names are written and carry the same object.
 *   sweep       every knob the run was given, including the ones it left at their default
 *   sources     extra files this gate reaches beyond LEAF_SOURCES
 */
function writeStamp(o) {
  if (!o || !o.describes || !o.by) throw new Error('writeStamp needs at least {describes, by}');
  const sources = LEAF_SOURCES.concat(o.sources || []);
  const measured = o.measured || null;
  const stamp = {
    generated: new Date().toISOString(),
    by: o.by,
    describes: o.describes.replace(/\\/g, '/'),
    reconstructed: false,
    rows: typeof o.rows === 'number' ? o.rows : null,
    n_unit: o.n_unit || null,
    /* BOTH NAMES, ONE OBJECT. `p_column` is what data/rollout-r1-rows.meta.json calls it and renaming
     * it here would silently break a reader that already knows the r1 shape; `measured` is what it
     * means for a gate whose output is a duration or a disagreement rate rather than a probability. */
    p_column: measured,
    measured,
    sweep: o.sweep || null,
    source_digests: sourceDigests(sources),
    git: gitState(sources),
  };
  if (o.extra) Object.assign(stamp, o.extra);
  const META = metaPathFor(o.describes);
  fs.writeFileSync(D(META), JSON.stringify(stamp, null, 2) + '\n');
  return { path: META, stamp };
}

/**
 * RETROSPECTIVE stamp for an artifact that predates writeStamp.
 *
 * The inference and its one assumption, stated rather than buried: the commit that last touched the
 * artifact carries a whole tree, so if the artifact's own `generated` timestamp is minutes before that
 * commit's date, the tree at that commit is very probably the build that produced it. Very probably is
 * not certainly — the working tree could have held uncommitted edits — so every field here is labelled
 * `reconstructed` and the gap in seconds is published so a reader can judge the inference instead of
 * inheriting it.
 */
function reconstruct(artifactRel) {
  const rel = artifactRel.replace(/\\/g, '/');
  if (!fs.existsSync(D(rel))) throw new Error('no such artifact: ' + rel);
  const art = JSON.parse(fs.readFileSync(D(rel), 'utf8'));

  const line = git(['log', '-1', '--format=%H%x09%aI', '--', rel]);
  const [commit, commitISO] = line ? line.split('\t') : [null, null];
  const genISO = art.generated || null;
  /* A NAKED isoformat() PARSES AS LOCAL TIME IN JS AND SILENTLY SHIFTS BY THE OFFSET.
   * data/rollout-r1-withdrawn-join.json carries "2026-08-03T04:14:10" from Python's isoformat(); JS
   * reads that as 08:14:10Z. Assuming Z when there is no zone is a second guess, so it is refused. */
  const zoned = genISO && /(?:Z|[+-]\d{2}:?\d{2})$/.test(genISO);
  const gap = (zoned && commitISO)
    ? Math.round((new Date(commitISO) - new Date(genISO)) / 1000) : null;

  const sources = LEAF_SOURCES.concat(
    /rollout-r3/.test(rel)
      ? ['engine/rollout_r3.js', 'engine/joint_rows.js', 'engine/fit_policy.js', 'engine/click_match.js', 'data/policy-weights.json']
      : /rollout-cost/.test(rel) ? ['engine/rollout_r2.js', 'engine/joint_rows.js', 'engine/fit_policy.js'] : []);

  const blobs = {};
  if (commit) for (const s of sources) blobs[s] = git(['rev-parse', `${commit}:${s}`]) || 'ABSENT AT THAT COMMIT';

  const stamp = {
    generated: new Date().toISOString(),
    by: 'engine/run_stamp.js --reconstruct',
    describes: rel,
    reconstructed: true,
    reconstructed_why:
      'The run that wrote this artifact recorded no configuration of any kind. This stamp is INFERRED '
      + 'from the commit that carried the artifact, not observed. Read `confidence` before using it.',
    artifact_generated: genISO,
    artifact_generated_has_timezone: zoned,
    rows: null,
    n_unit: null,
    p_column: null,
    measured: null,
    source_digests: null,
    source_digests_why_null:
      'A sha256 of the worktree TODAY would describe this file, not that run — data/rollout-r1.json '
      + 'records null for the same reason. The git blob ids below are the honest substitute: they name '
      + 'exact bytes and any reader with the repository can resolve them. They are NOT comparable to a '
      + 'live stamp\'s source_digests, which hash worktree bytes; on Windows those differ from the blob '
      + 'by line-ending translation (data/engine-data.js does).',
    git: {
      commit,
      commit_date: commitISO,
      artifact_written_seconds_before_commit: gap,
      blobs,
      inferred: true,
    },
    confidence: gap === null ? 'UNKNOWN — the artifact carries no zoned timestamp to compare'
      : gap >= 0 && gap < 3600 ? `HIGH — written ${gap}s before the commit that carried it, so the commit tree is very probably the build`
      : gap >= 0 ? `LOW — written ${gap}s before the commit; long enough for the tree to have moved in between`
      : `NONE — the artifact's timestamp is AFTER the commit that carries it by ${-gap}s, which cannot happen if the commit tree is the build`,
    what_this_cannot_recover:
      'Every setting the run took from an environment variable or a library default. git records the '
      + 'code; nothing records the invocation. They are named per gate in `unrecorded_settings` below.',
  };

  /* THE PER-GATE HOLES, NAMED. Generic prose here would be useless — what a reader needs is which
   * specific published number rests on which specific unrecorded setting. */
  if (/rollout-cost/.test(rel)) {
    stamp.n_unit = 'timed leaf calls, on sampled boards';
    stamp.rows = typeof art.boards === 'number' ? art.boards : null;
    stamp.unrecorded_settings = {
      explore: 'NOT RECORDED AND NOT PASSED. engine/rollout_r2.js calls RL.rolloutWinProb without an '
        + '`explore` key, and engine/rollout_leaf.js:197 defaults it to 0. So these timings are the '
        + 'DETERMINISTIC-GREEDY playout. The shipped in-game leaf runs at explore=1.0.',
      maxTurns: 'NOT RECORDED AND NOT PASSED. Defaults to 20 (engine/medicham2-browser.js:1079). The '
        + 'shipped in-game leaf runs maxTurns=60, so it plays three times the horizon these timings '
        + 'measured.',
      games: 'The artifact\'s `games` field is the GAMES environment CAP, not a count of games '
        + 'traversed. engine/status.js prints it as "over N games", which reads as a measurement.',
      machine: 'A duration is a fact about a machine under a load. Nothing records the CPU, the node '
        + 'version or what else was running, and nothing can recompute it — unlike every other gate '
        + 'here, this one is re-run or it is nothing.',
    };
  }
  if (/rollout-r3/.test(rel)) {
    stamp.n_unit = 'decisions compared';
    stamp.rows = typeof art.decisions === 'number' ? art.decisions : null;
    stamp.unrecorded_settings = {
      noise_floor: 'THE CONTROL IS MISSING. engine/rollout_r3.js computes `selfDisagree` — the same '
        + 'search on a different seed disagreeing with ITSELF, where the truth is 0.00 by construction '
        + '— prints it, and does not write it. The script\'s own verdict branches on it: `rate <= floor` '
        + 'prints NOT A RESULT. So this artifact cannot say which branch its own run took.',
      switches: 'THE ARTIFACT\'S CAVEAT IS FALSE ABOUT THE RUN IT DESCRIBES. It reads "Switch '
        + 'candidates are excluded and counted", but commit b4ec80b deleted the `if (ca.switchTo || '
        + 'cb.switchTo) continue;` line and did not update the string. Switches were ON the menu for '
        + 'this run. `withSwitch` and `choseSwitch` were counted, printed, and not written.',
      EVERY: 'The decision-sampling stride is an environment variable and is not recorded.',
    };
  }

  const META = metaPathFor(rel);
  fs.writeFileSync(D(META), JSON.stringify(stamp, null, 2) + '\n');
  return { path: META, stamp };
}

module.exports = { writeStamp, reconstruct, metaPathFor, sourceDigests, sha12, LEAF_SOURCES };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const target = argv.find(a => !a.startsWith('--'));
  if (argv.includes('--reconstruct')) {
    if (!target) { console.error('usage: node engine/run_stamp.js --reconstruct data/<artifact>.json'); process.exit(2); }
    const { path: p, stamp } = reconstruct(target);
    console.log(`wrote ${p}`);
    console.log(`  ${stamp.confidence}`);
  } else if (argv.includes('--show')) {
    const p = metaPathFor(target || '');
    if (!target || !fs.existsSync(D(p))) { console.error('no sidecar at ' + p); process.exit(1); }
    console.log(fs.readFileSync(D(p), 'utf8'));
  } else {
    console.log('run_stamp.js — write or read the sidecar that says which configuration produced a file.');
    console.log('  node engine/run_stamp.js --reconstruct data/rollout-cost.json');
    console.log('  node engine/run_stamp.js --show        data/rollout-r3.json');
  }
}
