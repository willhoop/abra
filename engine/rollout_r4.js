/* rollout_r4.js — R4: does the MILTANK search actually beat the MAG policy it searches over?
 *
 *   node engine/rollout_r4.js              read the run and write data/rollout-r4.json
 *   node engine/rollout_r4.js --print      read it and print; write nothing
 *   node engine/rollout_r4.js --print data/games.r4-baseline.jsonl    read some other run
 *
 * WHY THIS EXISTS
 * ---------------
 * R1, R2 and R3 each leave an artifact. R4 — the gate that actually decided, and the only one anybody
 * quotes — left prose. `node engine/status.js` printed "NO ARTIFACT — the verdict is prose only, not
 * a file", and the 55.5% in docs/HANDOFF-2026-08-04-r4-decided.md was a number somebody remembered.
 *
 * That is not a filing problem. The same handoff records the run as "5,248 games"; the corpus holds
 * 2,624. Prose cannot track a corpus — it is off by exactly a factor of two here — and the rule is
 * that anything derivable from an artifact is generated, never typed.
 *
 * WHAT THIS FILE DOES NOT DO
 * --------------------------
 * It does not pair games and it does not decide anything. Pairing already exists twice — in
 * engine/paired_h2h.js, which established the unit, and in engine/sprt.js, which repeats it under a
 * `--verify` guard that refuses to report if the two disagree. A THIRD copy here is exactly the
 * hand-rolled-second-version habit that CLAUDE.md forbids, and it would be the copy nothing checks.
 *
 * So this shells out to both, exactly as sprt.js --verify already shells out to paired_h2h.js, and
 * every published number is parsed from their output. If a pattern does not match, this THROWS — it
 * does not fall back to a default and publish a plausible file.
 *
 * WHAT IT ADDS ON TOP OF THEM, and why each is needed to read the result honestly:
 *
 *   1. WHICH ARM IS WHICH. Neither reader can name this run's arms. sprt.js prints "NEW = score /
 *      OLD = score" because both arms carry the same policy name, and paired_h2h.js reads the greedy
 *      flags and calls arm 1 "MAG — takes a WEIGHTED ROLL over its scores", which is wrong here:
 *      arm 1 is MILTANK, and `miltankArm` is the only field that says so. The arm labels below are
 *      derived from that field, so a swapped run is visible rather than plausible.
 *
 *   2. THE STAMPS. Every record carries engine_commit and a player digest. Checking they are
 *      constant across the corpus is the difference between "a run" and "some games concatenated".
 *
 *   3. THE NOISE FLOOR, or the honest absence of one. An effect smaller than the spread between two
 *      halves of one arm is not an effect. There is no A/A run for this comparison anywhere in
 *      data/, so what is recorded is the split-half spread of THIS run — which is a weaker thing and
 *      is labelled as such — plus the coin-flip standard error at the achieved sample size.
 *
 * ARM 1 IS THE CHALLENGER, the same convention sprt.js:169 documents and defends.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const argv = process.argv.slice(2);
const PRINT_ONLY = argv.includes('--print');
const CORPUS = argv.find(a => !a.startsWith('--')) || 'data/games.r4-decided.jsonl';

/* ---- running the readers ---------------------------------------------------------------------
 * sprt.js exits 3 for "undecided, keep going", which is a verdict and not a failure. Anything else
 * non-zero is a failure and must stop this generator, because the alternative is writing an
 * artifact from the stdout of a command that died. */
function run(script, args, okExits) {
  const r = spawnSync(process.execPath, [D('engine', script), ...args],
    { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.error) throw new Error(`rollout_r4: could not run ${script} — ${r.error.message}`);
  if (!okExits.includes(r.status)) {
    throw new Error(`rollout_r4: ${script} exited ${r.status}\n${r.stderr || ''}\n${r.stdout || ''}`);
  }
  return String(r.stdout || '');
}

/* A MISSING PATTERN IS A HARD ERROR. sprt.js's own --verify shipped for a while grepping for "2-0",
 * a string paired_h2h.js never prints, and reported "cross-check SKIPPED" — honest and useless. A
 * parser that shrugs produces an artifact that looks exactly like a correct one. */
function grab(out, re, what, opt) {
  const m = out.match(re);
  if (!m) {
    if (opt) return null;
    throw new Error(`rollout_r4: could not find ${what} in the reader's output. The reader changed `
      + `its wording; fix this parser rather than publishing a file with a hole in it.\n--- output ---\n${out}`);
  }
  return m[1];
}
const num = s => (s == null ? null : parseFloat(String(s).replace(/,/g, '')));

/* ---- the stamps ------------------------------------------------------------------------------
 * A separate streaming pass, and deliberately NOT a second pairing implementation: it reads only the
 * per-record configuration, never who won. Streamed in chunks because a game store is bigger than a
 * JavaScript string can hold — the failure sprt.js's header records at length. */
function stamps(rel) {
  const file = D(rel);
  const CHUNK = 1 << 22;
  const buf = Buffer.allocUnsafe(CHUNK);
  let fd;
  try { fd = fs.openSync(file, 'r'); }
  catch (e) { throw new Error(`rollout_r4: cannot open ${rel} — ${e.message}`); }
  const seen = {
    config: new Set(), commit: new Set(), player: new Set(), weights: new Set(),
    jointWeights: new Set(), features: new Set(), table: new Set(), format: new Set(),
  };
  let rows = 0, miltankArm = null, greedy = null, greedy2 = null, searchKnobs = new Set();
  /* THE LINE COUNT IS NOT THE SAMPLE SIZE, AND THAT MISTAKE HAS ALREADY BEEN MADE OFF THIS FILE.
   * docs/HANDOFF-2026-08-04-r4-decided.md calls this run "5,248 games". `wc -l` agrees with the
   * handoff and both are wrong: the store writes TWO records per game under ONE id — the full game
   * record, which carries .selfplay, and a log-only companion {id, uploadtime, log}. So the file is
   * 5,248 lines, 2,624 games, 1,312 seed pairs and 535 decisive pairs, and only the last of those
   * four is the unit of the test. Counting all of it here means the artifact can state the ratio
   * instead of leaving the next reader to divide by two and hope. */
  let lines = 0, torn = 0, logOnly = 0;
  const idCounts = new Map(), seedCounts = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const onRow = (g) => {
    const s = g.selfplay; rows++;
    const p = (s.player && s.player.parts) || {};
    seen.config.add(JSON.stringify([s.greedy, s.greedy2, s.opponentModel, s.opponentModel2,
      s.switching, s.switching2, s.joint, s.joint2, s.blind, s.blind2, s.randmove,
      s.miltankArm, s.policy, s.policy2]));
    seen.commit.add(s.engine_commit || null);
    seen.player.add((s.player && s.player.digest) || null);
    seen.weights.add((p.weights && p.weights.digest) || null);
    seen.jointWeights.add((p.jointWeights && p.jointWeights.digest) || null);
    seen.features.add(p.features || null);
    seen.table.add(p.table || null);
    seen.format.add(s.format || null);
    if (miltankArm === null) { miltankArm = s.miltankArm != null ? s.miltankArm : null; greedy = !!s.greedy; greedy2 = !!s.greedy2; }
    /* WHICH SEARCH SETTINGS THE RUN USED IS A QUESTION THE CORPUS MAY NOT ANSWER. mew.js takes
     * --miltank-n, --miltank-foe, --miltank-no-defer and --miltank-preview-n but stamps only
     * miltankArm, so the rollout budget is not in the data. Record whether it is there rather than
     * copying a number out of prose. */
    for (const k of Object.keys(s)) if (/^miltank/.test(k) && k !== 'miltankArm') searchKnobs.add(k);
  };
  /* EVERY line is counted, not only the ones that carry a result, because the whole point of the
   * count is to show how far a line count sits from a sample size. */
  const countLine = (t) => {
    lines++;
    let g; try { g = JSON.parse(t); } catch (e) { torn++; return; }
    if (g && g.id != null) bump(idCounts, String(g.id));
    if (!g || !g.selfplay) { logOnly++; return; }
    bump(seedCounts, String(g.selfplay.seed));
    onRow(g);
  };
  let tail = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, CHUNK, null);
      if (!n) break;
      const chunkLines = (tail + buf.toString('utf8', 0, n)).split('\n');
      tail = chunkLines.pop();
      for (const line of chunkLines) {
        const t = line.trim(); if (!t) continue;
        countLine(t);
      }
    }
    const t = tail.trim();
    if (t) countLine(t);
  } finally { try { fs.closeSync(fd); } catch (e) { /* already closed */ } }
  if (!rows) throw new Error(`rollout_r4: no self-play records in ${rel}`);
  const one = (set, what) => {
    if (set.size !== 1) {
      throw new Error(`rollout_r4: ${rel} mixes ${set.size} values of ${what} — this is not one run, `
        + `and a verdict computed across it would compare two different things.`);
    }
    return [...set][0];
  };
  const arm = (isMiltank, isGreedy) => isMiltank ? 'MILTANK — lookahead search over MAG'
    : (isGreedy ? 'MAG — best-scoring option every time (greedy)' : 'MAG — weighted roll over its scores');
  const multiplicity = (m) => { const d = {}; for (const v of m.values()) d[v] = (d[v] || 0) + 1; return d; };
  return {
    records: rows,
    lines, torn, log_only_records: logOnly,
    distinct_ids: idCounts.size, id_multiplicity: multiplicity(idCounts),
    distinct_seeds: seedCounts.size, seed_multiplicity: multiplicity(seedCounts),
    engine_commit: one(seen.commit, 'engine_commit'),
    player_digest: one(seen.player, 'the player digest'),
    weights_digest: one(seen.weights, 'the policy weights digest'),
    joint_weights_digest: one(seen.jointWeights, 'the joint weights digest'),
    features_digest: one(seen.features, 'the feature builder digest'),
    damage_table_digest: one(seen.table, 'the damage table digest'),
    format: one(seen.format, 'the format'),
    configs: seen.config.size,
    arm1: arm(miltankArm === 1, greedy),
    arm2: arm(miltankArm === 2, greedy2),
    search_settings_in_corpus: [...searchKnobs].sort(),
  };
}

/* ---- split-half, through the canonical reader --------------------------------------------------
 * Both records of a seed go to the same half, so the halves are still properly paired runs and
 * sprt.js can read them unmodified. Halves are chosen by a function of the SEED rather than by
 * position in the file, so each half draws evenly from every shard of the farm.
 *
 * SEVERAL CUTS, NOT ONE, AND THAT IS THE WHOLE POINT. The first version of this cut the run once,
 * on seed parity, and got halves of 55.6% and 55.4% — a spread of 0.2 points. A different cut of the
 * SAME 535 pairs gives 52.6% and 58.4%, a spread of 5.8. Both are honest; a single split-half is one
 * draw from a distribution whose own standard deviation here is about 4.3 points, so publishing one
 * of them as "the noise floor" would be publishing a coin flip as a measurement. Three independent
 * cuts and their range say what one cannot: how noisy the floor estimate itself is. */
/* ---- does this run describe the build we are running NOW? -------------------------------------
 * status.js already answers that, per run file, by comparing the corpus mtime against the newest
 * ENGINE_INPUTS source — and it derives that input list by reading provenance.js rather than
 * restating it. So ask status.js; do not grow a third copy of the rule here. If its wording ever
 * changes this records NOT DERIVED, which is a missing answer and not a guessed one. */
function engineStanding(rel) {
  const base = path.basename(rel);
  const out = run('status.js', [], [0]);
  const line = out.split('\n').find(l => l.includes(base) && /PRE-CHANGE|current/.test(l));
  const src = out.match(/newest engine source: ([^)]+)\)/);
  return {
    classed_by: 'engine/status.js',
    standing: line ? (line.includes('PRE-CHANGE') ? 'PRE-CHANGE' : 'current') : 'NOT DERIVED',
    as_printed: line ? line.trim() : null,
    newest_engine_source: src ? src[1].trim() : null,
    corpus_written: new Date(fs.statSync(D(rel)).mtime).toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
  };
}

/* ---- and the same question asked the strong way ------------------------------------------------
 * engineStanding above is MTIME evidence, and status.js says so itself: a touch with no semantic
 * change trips it. engine/player_digest.js answers by CONTENT — it hashes the feature builder, the
 * joint features, the damage table and both weight vectors, and compares them to the digest stamped
 * into the corpus. "Produced by the bot that runs now" is a far stronger statement than "the file is
 * older than a .js", and it is the difference between this run being stale and merely being old.
 *
 * IT NEEDS SHOWDOWN_PATH, so it cannot be a hard dependency of a generator. When it cannot run, this
 * records NOT DERIVED and why — a missing answer, never a guessed one. */
function playerStanding(rel) {
  const r = spawnSync(process.execPath, [D('engine', 'player_digest.js'), D(rel)],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = String(r.stdout || '') + String(r.stderr || '');
  if (/this corpus was produced by the bot that runs now/.test(out)) {
    return {
      checked_by: 'engine/player_digest.js',
      result: 'SAME PLAYER AS NOW',
      as_printed: (out.split('\n').find(l => /bot that runs now/.test(l)) || '').trim(),
      covers: 'the feature builder, the joint features, the damage table digest and both weight '
        + 'vectors. It does NOT cover simulator mechanics that leave all of those unchanged.',
    };
  }
  if (/PLAYER CHECK/.test(out)) {
    return { checked_by: 'engine/player_digest.js', result: 'DIFFERS FROM NOW', as_printed: out.trim().slice(0, 600) };
  }
  return {
    checked_by: 'engine/player_digest.js',
    result: 'NOT DERIVED',
    why: 'player_digest.js could not run here (it loads the Showdown simulator and needs '
      + 'SHOWDOWN_PATH). Re-run this generator with SHOWDOWN_PATH set to fill this in.',
  };
}

const SPLITS = [
  ['seed parity', s => s % 2],
  ['seed pair parity', s => Math.floor(s / 2) % 2],
  ['seed hash parity', s => crypto.createHash('sha1').update('r4:' + s).digest()[0] % 2],
];

function splitHalfRates(rel, label, sideOf) {
  const src = D(rel);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-r4-split-'));
  const outA = path.join(dir, 'a.jsonl'), outB = path.join(dir, 'b.jsonl');
  try {
    /* STREAMED IN AND STREAMED OUT. readFileSync would be fine on this 45 MB corpus and fatal the
     * first time somebody pointed --print at a 1.6 GB one, which is the failure sprt.js's header
     * records. The half is chosen by the parity of the seed rather than by position in the file, so
     * both records of a pair land together and each half draws evenly from every shard of the farm. */
    const outFd = { A: fs.openSync(outA, 'w'), B: fs.openSync(outB, 'w') };
    const pendingOut = { A: '', B: '' };
    const kept = { A: 0, B: 0 };
    const emit = (side, line) => {
      pendingOut[side] += line + '\n';
      kept[side]++;
      if (pendingOut[side].length > (1 << 22)) { fs.writeSync(outFd[side], pendingOut[side]); pendingOut[side] = ''; }
    };
    const CHUNK = 1 << 22;
    const buf = Buffer.allocUnsafe(CHUNK);
    const inFd = fs.openSync(src, 'r');
    let tail = '';
    const take = (t) => {
      let g; try { g = JSON.parse(t); } catch (e) { return; }
      if (!g || !g.selfplay) return;
      emit(sideOf(Number(g.selfplay.seed)) === 0 ? 'A' : 'B', t);
    };
    try {
      for (;;) {
        const n = fs.readSync(inFd, buf, 0, CHUNK, null);
        if (!n) break;
        const lines = (tail + buf.toString('utf8', 0, n)).split('\n');
        tail = lines.pop();
        for (const line of lines) { const t = line.trim(); if (t) take(t); }
      }
      if (tail.trim()) take(tail.trim());
    } finally { try { fs.closeSync(inFd); } catch (e) { /* already closed */ } }
    for (const side of ['A', 'B']) {
      if (pendingOut[side]) fs.writeSync(outFd[side], pendingOut[side]);
      fs.closeSync(outFd[side]);
    }
    if (!kept.A || !kept.B) {
      throw new Error(`rollout_r4: the "${label}" split put every record on one side, so there is `
        + 'no split-half spread to measure. Do not publish a noise floor computed from nothing.');
    }
    const read = (f) => {
      const out = run('sprt.js', [f], [0, 3]);
      return {
        decisive: num(grab(out, /decisive pairs\s+([\d,]+)\s+NEW takes/, 'the decisive pair count')),
        pct: num(grab(out, /NEW takes ([\d.]+)% of them/, 'the NEW share')),
      };
    };
    const a = read(outA), b = read(outB);
    return { cut: label, a, b, spread_pts: Math.round(Math.abs(a.pct - b.pct) * 10) / 10 };
  } finally {
    for (const f of [outA, outB]) { try { fs.unlinkSync(f); } catch (e) { /* never written */ } }
    try { fs.rmdirSync(dir); } catch (e) { /* not empty; leave it to the OS */ }
  }
}

/* ---- main ------------------------------------------------------------------------------------ */
const sprtOut = run('sprt.js', [CORPUS, '--verify'], [0, 3]);
const pairedOut = run('paired_h2h.js', [CORPUS], [0]);

const both = num(grab(sprtOut, /2-0 to NEW\s+([\d,]+)/, 'the 2-0 count'));
const neither = num(grab(sprtOut, /0-2 to OLD\s+([\d,]+)/, 'the 0-2 count'));
const split = num(grab(sprtOut, /1-1 split\s+([\d,]+)/, 'the 1-1 count'));
const games = num(grab(sprtOut, /games read\s+([\d,]+)/, 'the game count'));
const pairs = num(grab(sprtOut, /^\s+pairs\s+([\d,]+)/m, 'the pair count'));
const decisive = num(grab(sprtOut, /decisive pairs\s+([\d,]+)\s+NEW takes/, 'the decisive pair count'));
const newPct = num(grab(sprtOut, /NEW takes ([\d.]+)% of them/, 'the NEW share'));
const llr = num(grab(sprtOut, /log-likelihood\s+(-?[\d.]+)/, 'the log-likelihood'));
const p0 = num(grab(sprtOut, /H0\s+p = ([\d.]+)/, 'H0'));
const p1 = num(grab(sprtOut, /H1\s+p = ([\d.]+)/, 'H1'));
const alpha = num(grab(sprtOut, /alpha ([\d.]+)\s+beta/, 'alpha'));
const beta = num(grab(sprtOut, /beta ([\d.]+)\s+bounds/, 'beta'));
const boundH1 = num(grab(sprtOut, /accept-H1 >= (-?[\d.]+)/, 'the accept-H1 bound'));
const boundH0 = num(grab(sprtOut, /accept-H0 <= (-?[\d.]+)/, 'the accept-H0 bound'));
const decidedAt = num(grab(sprtOut, /DECIDED after ([\d,]+) decisive pairs/, 'the stopping point', true));
const unpaired = num(grab(sprtOut, /unpaired halves\s+([\d,]+)/, 'unpaired halves', true)) || 0;
const mismatched = num(grab(sprtOut, /mismatched pairs\s+([\d,]+)/, 'mismatched pairs', true)) || 0;
const crossCheck = grab(sprtOut, /--verify vs paired_h2h\.js:.*?(AGREE|DISAGREE|SKIPPED)/, 'the cross-check line');

let verdictCode;
if (/Accept H1 at/.test(sprtOut)) verdictCode = 'H1';
else if (/Accept H0 at/.test(sprtOut)) verdictCode = 'H0';
else if (/UNDECIDED/.test(sprtOut)) verdictCode = 'continue';
else throw new Error('rollout_r4: sprt.js printed no verdict this parser recognises.\n' + sprtOut);

/* THE INTERVAL COMES FROM paired_h2h.js, which owns it: it is the Wilson interval on the DECISIVE
 * pairs, the honest denominator, and re-deriving it here would be an eleventh copy of `wilson` in
 * this repo with nothing checking it against the other ten. */
const ciLo = num(grab(pairedOut, /95% CI \[([\d.]+),/, 'the lower bound of the CI'));
const ciHi = num(grab(pairedOut, /95% CI \[[\d.]+, ([\d.]+)\]/, 'the upper bound of the CI'));
const pairedPct = num(grab(pairedOut, /NEW took ([\d.]+)%/, "paired_h2h's NEW share"));
if (Math.abs(pairedPct - newPct) > 0.05) {
  throw new Error(`rollout_r4: sprt.js says ${newPct}% and paired_h2h.js says ${pairedPct}%. `
    + 'One of them is wrong and no number here may be quoted until that is settled.');
}
if (crossCheck !== 'AGREE') {
  throw new Error(`rollout_r4: the two readers did not agree (${crossCheck}). Nothing is published `
    + 'from a corpus the readers read differently.');
}

const st = stamps(CORPUS);
if (st.records !== games) {
  throw new Error(`rollout_r4: sprt.js read ${games} records and this file read ${st.records}. `
    + 'Two readers over the same file must agree on how big it is.');
}

/* THE PAIRING INVARIANTS, ASSERTED RATHER THAN DESCRIBED. If they ever stop holding, the sentence
 * this artifact prints about the line count would become a lie, so it is checked before it is
 * written: every id appears exactly twice (game record + log companion) and every seed appears
 * exactly twice (the same matchup from both sides). */
const twiceOnly = (m) => Object.keys(m).length === 1 && m['2'] > 0;
if (!twiceOnly(st.id_multiplicity) || !twiceOnly(st.seed_multiplicity) || st.lines !== 2 * st.records) {
  throw new Error(`rollout_r4: the pairing invariants do not hold on ${CORPUS} — lines ${st.lines}, `
    + `records ${st.records}, id multiplicity ${JSON.stringify(st.id_multiplicity)}, seed multiplicity `
    + `${JSON.stringify(st.seed_multiplicity)}. Do not publish an n from a file that is not shaped the `
    + 'way this generator claims it is.');
}

const standing = engineStanding(CORPUS);
const player = playerStanding(CORPUS);
const halves = SPLITS.map(([label, fn]) => splitHalfRates(CORPUS, label, fn));
/* The coin-flip floor at the sample actually achieved: one standard error of a 50/50 Bernoulli over
 * the decisive pairs, in percentage points. Anything inside roughly two of these is chance. */
const seCoinPts = 100 * Math.sqrt(0.25 / decisive);
/* And the floor on the FLOOR: how far apart two halves of a null run would sit by chance alone.
 * Each half holds about half the decisive pairs, and the difference of two independent estimates has
 * sd sqrt(2) times one of them. This is why one split-half number cannot be read on its own. */
const seSplitPts = Math.SQRT2 * 100 * Math.sqrt(0.25 / (decisive / 2));
const spreads = halves.map(h => h.spread_pts);

const verdict = verdictCode === 'H1'
  ? `ACCEPT H1 — arm 1 (${st.arm1.split(' —')[0]}) beats arm 2 (${st.arm2.split(' —')[0]}): `
    + `${newPct}% of ${decisive.toLocaleString()} decisive pairs, 95% CI [${ciLo}, ${ciHi}], ${games.toLocaleString()} games`
  : verdictCode === 'H0'
    ? `ACCEPT H0 — no gain worth shipping: ${newPct}% of ${decisive.toLocaleString()} decisive pairs, `
      + `95% CI [${ciLo}, ${ciHi}], ${games.toLocaleString()} games`
    : `UNDECIDED — ${newPct}% of ${decisive.toLocaleString()} decisive pairs, 95% CI [${ciLo}, ${ciHi}], `
      + `${games.toLocaleString()} games; neither bound reached`;
/* THE STANDING RIDES ON THE VERDICT STRING because status.js prints that string and nothing else
 * from this file. But it must ride as the right claim: the engine moving AFTER the games were played
 * is not a defect in the run. Both arms shared one engine and one model, so the contrast is fair and
 * the measurement stands; what is open is only whether the edge TRANSFERS to the build running now.
 * An earlier draft of this line appended a bare "[PRE-CHANGE]", which reads as "ignore this result"
 * and is a different — and wrong — statement. */
const transferTag = standing.standing === 'PRE-CHANGE'
  ? 'engine moved since; transfer assumed, not measured'
  : standing.standing === 'current' ? 'engine unmoved since the run'
    : 'engine standing NOT DERIVED';
const verdictLine = `${verdict}  [${transferTag}]`;

const artifact = {
  generated: new Date().toISOString(),
  by: 'engine/rollout_r4.js',
  gate: 'R4 — does the search beat the policy it searches over',
  corpus: CORPUS,
  verdict: verdictLine,
  verdict_code: verdictCode,
  games,
  pairs,
  decisive_pairs: decisive,
  /* THE FOUR NUMBERS THIS RUN CAN BE DESCRIBED BY, all of them, so nobody has to guess which one a
   * quoted figure meant. The handoff quoted the first and called it the second. */
  corpus_shape: {
    lines: st.lines,
    games: st.records,
    log_only_records: st.log_only_records,
    seed_pairs: pairs,
    decisive_pairs: decisive,
    torn_lines: st.torn,
    distinct_ids: st.distinct_ids,
    records_per_id: st.id_multiplicity,
    distinct_seeds: st.distinct_seeds,
    games_per_seed: st.seed_multiplicity,
    note: 'The store writes TWO lines per game under one id: the game record, which carries '
      + '.selfplay, and a log-only companion {id, log, uploadtime}. A line count is therefore twice '
      + 'the game count, and the game count is twice the pair count. The UNIT OF THE TEST is the '
      + 'decisive pair — the last number here, not the first.',
  },
  arm1_share_pct: newPct,
  ci95_pct: [ciLo, ciHi],
  counts: { arm1_2_0: both, split_1_1: split, arm2_0_2: neither, unpaired_halves: unpaired, mismatched_pairs: mismatched },
  sprt: {
    p0, p1, alpha, beta,
    bound_accept_h1: boundH1,
    bound_accept_h0: boundH0,
    llr_at_stop: llr,
    decided_after_decisive_pairs: decidedAt,
    margin_over_bound: decidedAt == null ? null : Math.round((llr - boundH1) * 100) / 100,
  },
  arms: {
    arm1: st.arm1,
    arm2: st.arm2,
    note: 'arm 1 is the challenger (sprt.js:169). Derived from miltankArm and the greedy flags in '
      + 'the records — NOT from the reader output, which cannot name a MILTANK arm: sprt.js prints '
      + 'both arms as "score" and paired_h2h.js labels arm 1 by its greedy flag alone.',
    search_settings_in_corpus: st.search_settings_in_corpus,
    search_settings_note: st.search_settings_in_corpus.length ? undefined
      : 'mew.js stamps miltankArm but not --miltank-n, --miltank-foe, --miltank-no-defer or '
        + '--miltank-preview-n, so the rollout budget this run used is NOT recoverable from the '
        + 'corpus. Any figure for it is prose, and is deliberately not copied in here.',
  },
  stamps: {
    engine_commit: st.engine_commit,
    player_digest: st.player_digest,
    weights_digest: st.weights_digest,
    joint_weights_digest: st.joint_weights_digest,
    features_digest: st.features_digest,
    damage_table_digest: st.damage_table_digest,
    format: st.format,
    distinct_configs: st.configs,
    note: 'one config, one commit, one player across every record, or this file would not exist — '
      + 'the generator throws instead of averaging two different runs together.',
  },
  /* WHAT THIS RUN IS EVIDENCE FOR, AND WHAT IT IS ONLY AN ASSUMPTION ABOUT. Two different claims,
   * kept in two different fields, because collapsing them into one sentence is how "R4 says the
   * search wins" ends up describing a build that no longer exists. */
  standing: {
    valid_as_measured: 'YES. Both arms ran the same engine commit, the same feature builder, the '
      + 'same damage table and the same fitted weights (see stamps above; the generator refuses to '
      + 'write if any of those varies across the corpus). Whatever was wrong with the rollout model '
      + 'was wrong for BOTH arms, so the contrast between them is fair and this is a real '
      + 'measurement of that build.',
    transfers_to_current_build: 'ASSUMPTION, NOT A RESULT. Nothing here was measured on HEAD.',
    engine_standing: standing,
    player_standing: player,
    what_to_do_about_it: 'Re-run the SPRT on the next frozen engine release (docs/DIVISIONS.md, the '
      + 'frozen-engine-release rule) before quoting this as a current figure.',
  },
  noise_floor: {
    aa_run: null,
    aa_note: 'NOT ESTABLISHED. There is no A/A run for this comparison anywhere in data/ — nothing '
      + 'plays this arm against itself — so the floor below is the weaker substitute: the spread '
      + 'between two halves of THIS run, which measures sampling noise but cannot see a bias both '
      + 'halves share.',
    split_half_of_this_run: {
      cuts: halves,
      spread_pts_range: [Math.min(...spreads), Math.max(...spreads)],
      note: 'Three independent cuts, each by a function of the seed so both records of a pair stay '
        + 'together and each half draws evenly from every shard. Read through engine/sprt.js, not '
        + 're-paired here. READ THE RANGE, NOT ONE CUT: the spread of a single cut is itself a draw '
        + `with sd about ${(Math.round(seSplitPts * 10) / 10)} points at this sample size.`,
    },
    coin_se_pts_at_this_n: Math.round(seCoinPts * 100) / 100,
    coin_se_pts_of_a_split_half: Math.round(seSplitPts * 100) / 100,
    effect_pts_over_50: Math.round((newPct - 50) * 100) / 100,
    reading: `The effect is ${Math.round((newPct - 50) * 100) / 100} points over a coin. Chance alone `
      + `moves this number by ${Math.round(seCoinPts * 100) / 100} points (1 sd) at ${decisive} decisive `
      + `pairs, so the effect is about ${Math.round(((newPct - 50) / seCoinPts) * 10) / 10} sd. At HALF `
      + `this sample the same effect would sit inside the split-half noise and would not be visible: `
      + `that is why the run needed the size it got, and why nothing smaller should be believed.`,
  },
  caveats: [
    'THE POINT ESTIMATE IS BIASED HIGH. The run was stopped at the SPRT boundary, and a stopping '
      + 'rule that fires on a favourable excursion selects for one. The verdict carries its stated '
      + 'error rate; the 55.5%-style share does not, and the CI is a fixed-n formula applied to a '
      + 'sequentially stopped run. Quote the verdict, treat the share as an upper-ish estimate.',
    'IT DOES NOT SAY THE BOT IS GOOD. It says one arm beat the other arm on this team pool, under '
      + 'self-play, with the search settings the corpus does not record.',
    'TRANSFER TO THE CURRENT BUILD IS AN ASSUMPTION, NOT A RESULT. Both arms shared the same engine '
      + 'and the same model, so the contrast is fair and the run stands as a measurement. Engine '
      + 'source moved after the games were played; whether the edge survives that is untested. '
      + 'See standing.engine_standing, which is status.js\'s own classification of this corpus.',
    'READ THE SPRT VERDICT, NOT A P-VALUE. This run stopped at a boundary, so an interval or a '
      + 'p-value computed as though n had been fixed in advance does not hold here (sprt.js:41). '
      + 'The CI above is recorded because paired_h2h.js prints it, and is exactly that fixed-n '
      + 'formula: it is context, not the inference.',
  ],
};

if (PRINT_ONLY) {
  console.log(JSON.stringify(artifact, null, 2));
} else {
  /* NAMED LITERALLY, RIGHT HERE, AND NOT BEHIND A CONSTANT DECLARED AT THE TOP OF THE FILE.
   * engine/provenance.js derives the artifact graph from source: it credits a generator with an
   * output when the filename sits beside a write verb. With the path hidden in an `OUT` constant 350
   * lines up, that scan found no writer for data/rollout-r4.json, so the file did not appear in the
   * audit at all — a published artifact nothing was checking, which is the exact hole this whole
   * exercise is closing. */
  const OUT = 'data/rollout-r4.json';
  fs.writeFileSync(D(OUT), JSON.stringify(artifact, null, 2) + '\n');
  console.log(`wrote ${OUT}`);
  console.log(`  ${verdictLine}`);
  console.log(`  ${st.lines} lines = ${st.records} games = ${pairs} seed pairs = ${decisive} decisive pairs (the unit)`);
  console.log(`  engine standing (mtime, via status.js): ${standing.standing} — measurement stands, transfer is the open question`);
  console.log(`  player standing (content, via player_digest.js): ${player.result}`);
  for (const h of halves) console.log(`  split-half [${h.cut}] ${h.a.pct}% n=${h.a.decisive} vs ${h.b.pct}% n=${h.b.decisive}  spread ${h.spread_pts} pts`);
  console.log(`  effect ${artifact.noise_floor.effect_pts_over_50} pts over 50, coin SE ${artifact.noise_floor.coin_se_pts_at_this_n} pts at n=${decisive}`);
  console.log('  noise floor: NOT ESTABLISHED — no A/A run exists for this comparison.');
}
