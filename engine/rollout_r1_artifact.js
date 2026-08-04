/* rollout_r1_artifact.js — R1 gets an artifact, recomputed from the rows it left behind.
 *
 *   node engine/rollout_r1_artifact.js            write data/rollout-r1.json
 *   node engine/rollout_r1_artifact.js --print    print it; write nothing
 *   node engine/rollout_r1_artifact.js --print data/some-other-rows.jsonl
 *
 * WHY THIS EXISTS
 * ---------------
 * Same defect as R4, one gate above it and undetected for longer. docs/ROLLOUT-design.md publishes
 * "R1 — PASSED ON THE BASELINE, 9,201 positions, rollout 68.18% against material's 65.26%, +2.91
 * [1.79, 4.04]". engine/rollout_r1.js computes that with console.log and writes NO artifact for it.
 * The only file it writes is the row dump. Meanwhile data/rollout-r1.json — the file status.js reads
 * and calls "R1 leaf accuracy" — was written by engine/rollout_r1_join.py and holds the 230-row
 * cross-language join that ROLLOUT-design.md §5 says was WITHDRAWN. So the gate reported a withdrawn
 * result while the real one had no file at all.
 *
 * WHAT IT DOES NOT DO. It does not re-run a rollout. It is arithmetic over a frozen dump, which is
 * why it requires no engine, no Showdown and no weights: the engine is a fact about how the ROWS were
 * produced, not about how they are counted. Every formula is the one in rollout_r1.js:225-272 — acc,
 * brier, logloss, and McNemar on the discordant positions — because a second definition of the score
 * is how two files come to disagree about the same run.
 *
 * AND IT REFUSES TO CALL THE COLUMN SOMETHING IT CANNOT SEE.
 * ---------------------------------------------------------
 * The dump carries `p` and nothing that says WHICH rollout `p` is. rollout_r1.js sweeps N_LIST and
 * EXPLORE_LIST, dumps `ps[N_LIST[last]]`, and stamps neither the budget nor the exploration rate into
 * the file. So a reader cannot tell the explore=1 column from the explore=0 one, and the two differ
 * by nearly four accuracy points — which is the entire published result.
 *
 * There is one witness, so this uses it: the CALIBRATION SHAPE. ROLLOUT-design.md §4.2.1 publishes
 * the greedy playout's calibration table, and that table is parsed OUT OF THE DOC rather than typed
 * here, then compared bin-for-bin against the rows. If they match, the dumped column is the greedy
 * playout whatever anyone remembers. That comparison is the artifact-against-its-source check
 * CLAUDE.md requires, applied to the one thing the dump failed to record.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const argv = process.argv.slice(2);
const PRINT_ONLY = argv.includes('--print');
const ROWS = argv.find(a => !a.startsWith('--')) || 'data/rollout-r1-rows.jsonl';
const DESIGN = 'docs/ROLLOUT-design.md';

/* ---- the rows -------------------------------------------------------------------------------- */
function loadRows(rel) {
  let txt;
  try { txt = fs.readFileSync(D(rel), 'utf8'); }
  catch (e) { throw new Error(`rollout_r1_artifact: cannot read ${rel} — ${e.message}`); }
  const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
  const rows = [];
  let torn = 0;
  for (const line of lines) {
    let r; try { r = JSON.parse(line); } catch (e) { torn++; continue; }
    /* A ROW THAT IS MISSING A COLUMN IS NOT A ROW. rollout_r1.js writes `p` as
     * ps[N_LIST[last]], and that key does not exist when EXPLORE_LIST holds more than one value —
     * the sweep keys become "40@1" and the plain lookup returns undefined, which JSON.stringify
     * silently drops. A dump written that way would arrive here as rows with no `p` at all, and
     * scoring `undefined >= 0.5` would quietly grade every one of them as a loss. */
    if (typeof r.p !== 'number' || typeof r.mpy !== 'number' || (r.y !== 0 && r.y !== 1)) { torn++; continue; }
    rows.push(r);
  }
  if (!rows.length) throw new Error(`rollout_r1_artifact: no usable rows in ${rel}`);
  if (torn) throw new Error(`rollout_r1_artifact: ${torn} of ${lines.length} lines in ${rel} are torn or `
    + 'missing p/mpy/y. Publishing an accuracy over the survivors would be an accuracy over whatever '
    + 'happened to parse.');
  return { rows, lines: lines.length };
}

/* ---- the scores, exactly as engine/rollout_r1.js:225-272 computes them ------------------------- */
const accOf = (rows, f) => rows.filter(r => (f(r) >= 0.5) === (r.y === 1)).length / rows.length;
const brierOf = (rows, f) => rows.reduce((s, r) => s + Math.pow(f(r) - r.y, 2), 0) / rows.length;
const loglossOf = (rows, f) => rows.reduce((s, r) => {
  const q = Math.min(1 - 1e-9, Math.max(1e-9, f(r)));
  return s - (r.y * Math.log(q) + (1 - r.y) * Math.log(1 - q));
}, 0) / rows.length;

/* McNemar on the DISCORDANT positions, and the same normal-approximation half-width rollout_r1.js
 * prints: 1.96*sqrt(b+c)/n in points. The two judges saw identical positions with identical labels,
 * so treating their accuracies as independent samples would overstate the noise. */
function mcnemar(rows, f, g) {
  let b = 0, c = 0;
  for (const r of rows) {
    const ff = (f(r) >= 0.5) === (r.y === 1);
    const gg = (g(r) >= 0.5) === (r.y === 1);
    if (ff && !gg) b++; else if (!ff && gg) c++;
  }
  const disc = b + c;
  const half = disc ? 100 * 1.96 * Math.sqrt(disc) / rows.length : 0;
  return { b, c, disc, half };
}

/* The verdict ladder is rollout_r1.js's own, thresholds included, so this file cannot reach a
 * different conclusion than the script whose output it is recording. PORY_LIFT is PORYGON2's
 * published lift over the same baseline (data/porygon2c.json, quoted in rollout_r1.js:286). */
const PORY_LIFT = 3.42;
function verdictFor(diff, half) {
  if (diff - half > PORY_LIFT) return ['PASS_OUTRIGHT', 'R1 PASSES OUTRIGHT — the lower bound clears '
    + `PORYGON2's published +${PORY_LIFT} lift over the same baseline.`];
  if (diff - half > 0) return ['PASS_ON_BASELINE', 'R1 PASSES ON THE BASELINE — significantly better '
    + `than counting bodies, and PORYGON2's +${PORY_LIFT} sits INSIDE this interval, so the two are `
    + 'not separated by this sample.'];
  if (diff + half < 0) return ['FAIL', 'R1 FAILS — the rollout is measurably WORSE than counting bodies.'];
  return ['UNDECIDED', 'UNDECIDED — the interval spans zero, so this sample cannot tell the rollout '
    + 'from counting bodies. Not a pass and NOT a failure.'];
}

/* ---- reliability, in the ten bins the design doc uses ------------------------------------------ */
function curve(rows, f) {
  const out = [];
  for (let i = 0; i < 10; i++) {
    const lo = i / 10, hi = (i + 1) / 10;
    const s = rows.filter(r => (i === 9 ? (f(r) >= lo && f(r) <= 1) : (f(r) >= lo && f(r) < hi)));
    out.push({ bin: `${i * 10}-${(i + 1) * 10}%`, n: s.length,
      observed: s.length ? Math.round(1000 * s.filter(r => r.y === 1).length / s.length) / 1000 : null });
  }
  return out;
}

/* ---- WHICH COLUMN IS THIS? --------------------------------------------------------------------
 * Parsed out of the design doc, never typed here. §4.2.1 publishes the deterministic-greedy
 * playout's saturation table in the form
 *
 *     rollout says       n      actually wins
 *     0-10%           2,245         26.0%
 *     90-100%         2,612         75.9%
 *
 * If the rows reproduce those two bins, the dumped column IS that playout — which settles a question
 * the dump itself does not record. A pattern that stops matching records NOT DERIVED rather than
 * quietly returning "no evidence of a mismatch", because those two are opposite answers. */
function greedySignature(rows) {
  let doc;
  try { doc = fs.readFileSync(D(DESIGN), 'utf8'); }
  catch (e) { return { checked: false, why: `could not read ${DESIGN}: ${e.message}` }; }
  const block = doc.match(/rollout says\s+n\s+actually wins\n([\s\S]{0,400}?)```/);
  if (!block) return { checked: false, why: `no greedy calibration table found in ${DESIGN} §4.2.1` };
  const published = [];
  for (const m of block[1].matchAll(/^\s*(\d+)-(\d+)%\s+([\d,]+)\s+([\d.]+)%/gm)) {
    published.push({ bin: `${m[1]}-${m[2]}%`, n: parseInt(m[3].replace(/,/g, ''), 10), observed: parseFloat(m[4]) / 100 });
  }
  if (!published.length) return { checked: false, why: `the table in ${DESIGN} §4.2.1 did not parse` };
  const mine = curve(rows, r => r.p);
  const cmp = published.map(p => {
    const got = mine.find(x => x.bin === p.bin);
    return { bin: p.bin, published_n: p.n, rows_n: got ? got.n : null,
      published_observed: p.observed, rows_observed: got ? got.observed : null,
      matches: !!got && got.n === p.n && Math.abs(got.observed - p.observed) <= 0.0005 };
  });
  return { checked: true, source: `${DESIGN} §4.2.1`, bins: cmp, all_match: cmp.every(x => x.matches) };
}

/* ---- what the doc currently claims for this gate ------------------------------------------------
 * Recorded verbatim so the artifact and the prose can be compared by anyone, in either direction,
 * without a human holding both open. Not parsed into numbers: the point is the sentence. */
function docsSay() {
  let doc;
  try { doc = fs.readFileSync(D(DESIGN), 'utf8'); }
  catch (e) { return { source: DESIGN, text: null, why: e.message }; }
  const lines = doc.split('\n');
  const at = lines.findIndex(l => /^\*\*R1 —/.test(l));
  if (at < 0) return { source: DESIGN, text: null, why: 'no "**R1 —" verdict line in §5' };
  const para = [];
  for (let i = at; i < lines.length && lines[i].trim(); i++) para.push(lines[i].trim());
  return { source: `${DESIGN}:${at + 1}`, text: para.join(' ') };
}

/* ---- did the engine move under the rows? --------------------------------------------------------
 * status.js already owns this rule and derives its source list by reading provenance.js. Ask it;
 * do not grow a third copy. It classifies self-play CORPORA and this is a row dump, so only the
 * "newest engine source" it names is taken from it, and the comparison against this file's mtime is
 * made here — the same mtime comparison, on a file status.js does not scan.
 *
 * MTIME IS ALL THIS CAN BE. The dump stamps no engine commit, no player digest and no weight digest,
 * so unlike data/rollout-r4.json there is nothing to hash a build against. That absence is recorded
 * as an absence. */
function engineStanding(rel) {
  const r = spawnSync(process.execPath, [D('engine', 'status.js')], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = String(r.stdout || '');
  const m = out.match(/newest engine source: ([^)]+)\)/);
  const rowsAt = fs.statSync(D(rel)).mtime;
  if (!m) {
    return { classed_by: 'engine/status.js', standing: 'NOT DERIVED',
      why: 'status.js printed no "newest engine source" line to compare against',
      rows_written: rowsAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' };
  }
  const label = m[1].trim();
  const at = label.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
  const srcAt = at ? new Date(at[1] + 'Z') : null;
  return {
    classed_by: 'engine/status.js',
    standing: srcAt ? (rowsAt < srcAt ? 'PRE-CHANGE' : 'current') : 'NOT DERIVED',
    newest_engine_source: label,
    rows_written: rowsAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    how: 'mtime only. The dump records no engine commit and no digests, so there is nothing here to '
      + 'compare by CONTENT the way data/rollout-r4.json can.',
  };
}

const sha12 = rel => {
  try { return crypto.createHash('sha256').update(fs.readFileSync(D(rel))).digest('hex').slice(0, 12); }
  catch (e) { return 'MISSING'; }
};

/* ---- main ------------------------------------------------------------------------------------- */
const { rows, lines } = loadRows(ROWS);
const n = rows.length;

const rAcc = 100 * accOf(rows, r => r.p);
const mAcc = 100 * accOf(rows, r => r.mpy);
const cAcc = 100 * accOf(rows, () => 0.5);
const mn = mcnemar(rows, r => r.p, r => r.mpy);
const diff = rAcc - mAcc;
const [code, sentence] = verdictFor(diff, mn.half);

const r3 = x => Math.round(x * 1000) / 1000;
const r4d = x => Math.round(x * 10000) / 10000;
const sig = greedySignature(rows);
/* THE SIDECAR, IF THE DUMP HAS ONE. engine/rollout_r1.js now writes N, explore and the source
 * digests beside the rows, and a stamp always outranks an inference drawn from a calibration shape.
 * It is matched by NAME AND ROW COUNT, because a meta file left over from a different run is worse
 * than none — it would look like a stamp and describe another dump. */
const sidecar = (() => {
  const rel = ROWS.replace(/\.jsonl$/, '.meta.json');
  let m; try { m = JSON.parse(fs.readFileSync(D(rel), 'utf8')); } catch (e) { return null; }
  if (!m || m.rows !== n || (m.describes && path.basename(m.describes) !== path.basename(ROWS))) {
    return { file: rel, usable: false,
      why: `it describes ${m && m.describes} with ${m && m.rows} rows, not ${ROWS} with ${n}. A `
        + 'stamp from a different run is worse than no stamp, so it is not read.' };
  }
  return { file: rel, usable: true, p_column: m.p_column, sweep: m.sweep, source_digests: m.source_digests };
})();
const doc = docsSay();
const standing = engineStanding(ROWS);
const baseRate = rows.filter(r => r.y === 1).length / n;
const tiedMaterial = rows.filter(r => r.mpy === 0.5).length;

const verdict = `${code} — rollout ${r3(rAcc)}% against material's ${r3(mAcc)}% on ${n.toLocaleString()} `
  + `positions: ${diff >= 0 ? '+' : ''}${r3(diff)} points, 95% CI ${r3(diff - mn.half)} to ${r3(diff + mn.half)}`;

const artifact = {
  generated: new Date().toISOString(),
  by: 'engine/rollout_r1_artifact.js',
  gate: 'R1 — is playing a position out a better judge than the k-NN',
  corpus: ROWS,
  verdict,
  verdict_code: code,
  verdict_note: sentence,
  /* A COMMON COUNT AND ITS UNIT, the same pair engine/rollout_r2.js and engine/rollout_r3.js carry.
   * R1 published `positions`, R2 `boards`, R3 `decisions` and R4 `decisive_pairs` — four names for
   * one slot, so comparing two rungs meant opening two generators first. `n_measured` is the number;
   * `n_unit` says what one of them IS, which is the part that genuinely differs between rungs. The
   * old name stays beside it so no reader breaks.
   *
   * NOT called `n`: data/rollout-r3.json has published `n` as the ROLLOUT BUDGET since 2026-08-03,
   * and a key meaning a sample size in one rung and a budget in the next is worse than no common key.
   *
   * The unit here is a POSITION, and it is not a game: this dump holds 3.68 scored positions per
   * game from 2,500 games, so `n_measured` and any game count in this file are different quantities
   * and neither substitutes for the other. */
  n_measured: n,
  n_unit: 'scored positions (one row per position; several per game)',
  positions: n,

  corpus_shape: {
    lines,
    positions: n,
    distinct_games: new Set(rows.map(r => r.gid)).size,
    positions_per_game: r3(n / new Set(rows.map(r => r.gid)).size),
    turn_min: Math.min(...rows.map(r => r.turn)),
    turn_max: Math.max(...rows.map(r => r.turn)),
    turn_mean: r3(rows.reduce((s, r) => s + r.turn, 0) / n),
    label_base_rate_p1_wins: r4d(baseRate),
    sha256_12: sha12(ROWS),
    note: 'One row per scored position, not one per game. The sample is EARLY-GAME HEAVY — see '
      + 'turn_mean — and every judge sits closer to the base rate on an early board than on a late '
      + 'one, so these accuracies are not comparable to a figure measured on a different turn mix.',
  },

  judges: {
    rollout: {
      what: 'the `p` column of the dump',
      accuracy_pct: r3(rAcc), brier: r4d(brierOf(rows, r => r.p)), logloss: r4d(loglossOf(rows, r => r.p)),
      reliability_curve: curve(rows, r => r.p),
    },
    material_porygon2_form: {
      what: 'the `mpy` column: clip(0.5 + 0.15*alive_diff, 0.02, 0.98), the graded bodies-only '
        + 'baseline copied in form from engine/porygon2.py:530, recomputed on THESE positions',
      accuracy_pct: r3(mAcc), brier: r4d(brierOf(rows, r => r.mpy)), logloss: r4d(loglossOf(rows, r => r.mpy)),
      ties_at_exactly_0_5: tiedMaterial,
      ties_note: `${r3(100 * tiedMaterial / n)}% of positions have alive_diff 0, where this baseline `
        + 'returns exactly 0.5 and the >= 0.5 rule grades it as "p1 wins". On those rows it is not a '
        + 'judge at all, it is the base rate — which is most of why it scores as high as it does.',
    },
    coin: {
      what: 'constant 0.5; graded by the same >= 0.5 rule, so it also predicts p1 every time',
      accuracy_pct: r3(cAcc),
      note: 'This equals the base rate by construction and is a floor, not a competitor.',
    },
  },

  mcnemar: {
    rollout_only_right: mn.b,
    material_only_right: mn.c,
    discordant: mn.disc,
    diff_points: r3(diff),
    ci95_half_width_pts: r3(mn.half),
    ci95_pts: [r3(diff - mn.half), r3(diff + mn.half)],
    method: 'Normal approximation to the sign test on the discordant positions; half-width '
      + '1.96*sqrt(b+c)/n in points. Same formula and same pairing as engine/rollout_r1.js:262-272. '
      + 'The two judges scored identical positions with identical labels, so the pairing is real and '
      + 'comparing the two accuracies as independent samples would overstate the noise.',
    fixed_n: 'This gate was NOT sequentially stopped, so unlike data/rollout-r4.json the interval '
      + 'here is a legitimate fixed-n interval rather than context beside a boundary verdict.',
  },

  /* THE FIELD THIS WHOLE FILE EXISTS FOR. */
  which_rollout_is_this: {
    recorded_in_the_dump: sidecar,
    why_null: sidecar ? undefined
      : 'engine/rollout_r1.js dumps ps[N_LIST[last]] and stamps neither N nor `explore` into '
      + 'the rows. A dump from explore=0 and a dump from explore=1 are byte-compatible and differ by '
      + 'nearly four accuracy points, which is the whole published result.',
    granularity: 'every p is an exact multiple of 1/80, consistent with n=40 rollouts scored 1/0/0.5 '
      + '(battleResult returns a half for a draw) or with n=80 and no draws. The dump cannot separate '
      + 'those two and neither can this file.',
    calibration_signature: sig,
    inference: sidecar && sidecar.usable
      ? `RECORDED, not inferred: n=${sidecar.p_column.n_rollouts}, explore=${sidecar.p_column.explore}, `
        + `key "${sidecar.p_column.key}", stamped by the run that wrote the rows. The calibration `
        + 'comparison below is kept as a cross-check, not as the answer.'
      : sig.checked && sig.all_match
      ? 'THE DUMPED COLUMN IS THE DETERMINISTIC-GREEDY PLAYOUT (explore=0). Its reliability bins '
        + 'reproduce, count for count and point for point, the greedy saturation table the design doc '
        + 'publishes in §4.2.1. It is NOT the explore=1 column that the §5 gate verdict is computed '
        + 'from. Two different runs over the same positions: `mpy` is deterministic given a position, '
        + 'so an identical material accuracy proves the same SAMPLE, never the same run.'
      : 'NOT DERIVED — the calibration comparison did not run, so nothing here identifies the column.',
    consequence: 'The published +2.91 gate result cannot be recomputed from anything committed. What '
      + 'survives is the incumbent arm of that comparison, and on it R1 is UNDECIDED.',
  },

  docs_say: doc,

  standing: {
    valid_as_measured: 'YES as arithmetic. Both columns are scored on identical positions with '
      + 'identical labels by construction (engine/rollout_r1.js writes them on the same row), so the '
      + 'contrast between them is fair whatever the engine was doing.',
    what_it_measures: 'The dumped rollout column against the graded material baseline. It is NOT a '
      + 'head-to-head against PORYGON2 — that route was built and withdrawn; see '
      + 'data/rollout-r1-withdrawn-join.json.',
    engine_standing: standing,
    stamps: {
      engine_commit: null,
      player_digest: null,
      weights_digest: null,
      damage_table_digest: null,
      why_null: 'THE DUMP CARRIES NO STAMPS. data/rollout-r4.json can name the commit, the player and '
        + 'both weight digests because mew.js writes them into every game record. rollout_r1.js writes '
        + '{gid, turn, p, mpy, y, aliveDiff, hpDiff} and nothing else, so there is no build recorded '
        + 'to check this run against. r2 and r3 have the same hole. Recording it as null is the '
        + 'honest answer; a digest of the sources as they are TODAY would describe this file, not the '
        + 'run, and would be worse than nothing.',
      source_digests: (sidecar && sidecar.usable && sidecar.source_digests) || null,
      fixed_going_forward: 'engine/rollout_r1.js now writes a sidecar beside the dump — see '
        + 'data/rollout-r1-rows.meta.json — carrying N, explore, the sweep and content digests of '
        + 'every source the leaf reaches.'
        + (sidecar && sidecar.usable ? ' This run has one; see source_digests above.'
          : ' The committed rows predate it, so this artifact has none to use.'),
    },
    what_to_do_about_it: 'Re-run engine/rollout_r1.js at the exploration rate the gate claims, with '
      + 'DUMP set, and regenerate this file. Until then the published R1 PASS has no evidence behind '
      + 'it that anyone can check, and --rollout-explore=1.0 is a shipped default resting on it.',
  },

  noise_floor: {
    aa_run: null,
    aa_note: 'NOT ESTABLISHED. No A/A run exists for this comparison. The substitute below splits '
      + 'THESE rows by a hash of the GAME id, so every position from one game stays on one side and '
      + 'the halves are not correlated through a shared game.',
    split_half_of_this_run: null,   // filled in below
    reading: null,                  // filled in below
  },

  provenance_note: 'engine/provenance.js derives an artifact\'s inputs from the data files its '
    + 'generator reads, and its scan covers *.json, *.js and games.*.jsonl — data/rollout-r1-rows.jsonl '
    + 'matches none of those, so provenance cannot see this file\'s input and will not call it stale '
    + 'when the rows move. corpus_shape.sha256_12 above is what a reader should check instead.',

  caveats: [
    'THIS IS A RECOMPUTATION FROM A ROW DUMP, NOT A RE-RUN. Every number here is arithmetic over '
      + `${ROWS}; nothing was rolled out to produce it. Compare it against docs_say above — that is `
      + 'what the design doc claims for this gate — and read which_rollout_is_this before assuming '
      + 'the two describe the same run. They did not on 2026-08-04.',
    'THE MATERIAL BASELINE IS FLATTERED BY ITS TIES. It returns exactly 0.5 on '
      + r3(100 * tiedMaterial / n) + '% of positions and the >= 0.5 rule scores every one of those as '
      + 'a p1 call. Read judges.material_porygon2_form.ties_note before comparing this baseline to a '
      + 'figure measured anywhere else.',
    'IT IS NOT A TEST AGAINST PORYGON2. R1 as specified asks whether the rollout beats the k-NN. '
      + 'Material is a stand-in for the k-NN and the cross-language head-to-head was withdrawn, so the '
      + 'gate as WRITTEN has never been answered by any artifact in this repository.',
    'THE SAMPLE IS EARLY-GAME HEAVY (mean turn ' + r3(rows.reduce((s, r) => s + r.turn, 0) / n) + '). '
      + 'Accuracy on a turn-2 board is close to the base rate for every judge, so this number is not '
      + 'comparable to one measured on a different turn mix — including PORYGON2\'s published 63.70%.',
  ],
};

/* The floor, computed after the object so the reading can quote it. Cut by a hash of the game id
 * rather than by position in the file: rows from one game are correlated through one outcome, and a
 * cut that separates them would understate the spread — the same reasoning rollout_r4.js applies to
 * keeping both records of a seed pair together. */
{
  const h = s => { let x = 0; for (const ch of String(s)) x = (Math.imul(x, 31) + ch.charCodeAt(0)) >>> 0; return x; };
  const cuts = [
    ['game-id hash parity', r => h('r1a:' + r.gid) % 2],
    ['game-id hash /2 parity', r => Math.floor(h('r1b:' + r.gid) / 2) % 2],
    ['game-id hash /4 parity', r => Math.floor(h('r1c:' + r.gid) / 4) % 2],
  ].map(([label, f]) => {
    const A = rows.filter(r => f(r) === 0), B = rows.filter(r => f(r) === 1);
    const d = s => 100 * (accOf(s, r => r.p) - accOf(s, r => r.mpy));
    const a = { n: A.length, diff_pts: r3(d(A)) }, b = { n: B.length, diff_pts: r3(d(B)) };
    return { cut: label, a, b, spread_pts: r3(Math.abs(a.diff_pts - b.diff_pts)) };
  });
  const spreads = cuts.map(c => c.spread_pts);
  artifact.noise_floor.split_half_of_this_run = {
    cuts, spread_pts_range: [Math.min(...spreads), Math.max(...spreads)],
    note: 'Three independent cuts, each a function of the GAME id so every position from one game '
      + 'stays on one side. READ THE RANGE, NOT ONE CUT — a single split-half spread is itself a draw.',
  };
  artifact.noise_floor.reading = `The effect is ${r3(diff)} points and the split-half spread of this `
    + `run ranges ${Math.min(...spreads)} to ${Math.max(...spreads)} points. An effect smaller than the `
    + 'spread between two halves of one run is not an effect.';
}

if (PRINT_ONLY) {
  console.log(JSON.stringify(artifact, null, 2));
} else {
  /* NAMED LITERALLY HERE, not behind a constant declared at the top of the file. provenance.js
   * credits a generator with an output when the filename sits beside a write verb; hiding the path
   * in an OUT constant two hundred lines up is what kept data/rollout-r4.json out of the audit. */
  fs.writeFileSync(D('data', 'rollout-r1.json'), JSON.stringify(artifact, null, 2) + '\n');
  console.log('wrote data/rollout-r1.json');
  console.log('  ' + verdict);
  console.log(`  rollout ${r3(rAcc)}%   material ${r3(mAcc)}%   coin/base-rate ${r3(cAcc)}%   over ${n.toLocaleString()} positions`);
  console.log(`  discordant: rollout-only-right ${mn.b}, material-only-right ${mn.c}, of ${n.toLocaleString()}`);
  console.log(`  column identity: ${artifact.which_rollout_is_this.inference.split('.')[0]}.`);
  console.log(`  engine standing (mtime, via status.js): ${standing.standing}`);
  console.log(`  stamps: NONE — the dump records no commit, no player and no weight digest.`);
  if (doc.text) console.log(`  ${doc.source} says: ${doc.text.slice(0, 160)}`);
}
