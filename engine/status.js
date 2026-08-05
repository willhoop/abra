// RAW-STORE-OK: reports the STORE ITSELF -- line counts and mtimes, so a reader can see which
// corpora are still collecting. Filtering for clean games here would defeat the purpose: the
// question is how big the raw store is and when it last grew, not what survives quality.js.
// The clean figure is reported separately, from live.js, and labelled as such.
/* status.js — the handoff, generated.
 *
 *   node engine/status.js           print it
 *   node engine/status.js --write   also stamp the GENERATED blocks in docs/{ENGINE,MEASURE,SEARCH,OPS}.md
 *
 * WHY THIS EXISTS
 * ---------------
 * Fourteen HANDOFF-*.md files sit in docs/. Every one was typed by hand at the end of a session,
 * and every one was wrong within a day of being written — the 2026-08-04 handoff says "172 tags,
 * 118 unprobed" against a tags.json that holds 176 unique tags with 123 unprobed. Nobody
 * mistyped anything. The corpus moved and the prose could not.
 *
 * That is S13 in the place it costs most: the document a new session trusts FIRST is the one piece
 * of state nothing regenerates. So the handoff stops being written and starts being printed. Every
 * number below is read out of an artifact that some other tool produced; where a number cannot be
 * derived this says NOT DERIVED rather than carrying a figure somebody remembered.
 *
 * IT IS ORGANISED BY DIVISION, not by subsystem, because the divisions are cut on the invalidation
 * graph — see docs/DIVISIONS.md. Each division gets exactly one headline number, so a handoff is
 * four numbers and a staleness list instead of three pages.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not judge. It reports what the artifacts say, including
 * when they say the model lost. A status tool that editorialises is a status tool people stop
 * believing, and the winrate-backtest verdict below is exactly the kind of number that would get
 * quietly softened by a human writing prose at 2am.
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const WRITE = process.argv.includes('--write');

/* ---- WHY SOMETHING IS NOT DERIVED -------------------------------------------------------------
 * `NOT DERIVED` is this tool's honest answer for "no artifact says this", and it was ALSO its answer
 * for "the artifact is there and I could not read it". Those are opposite facts: the first is work
 * nobody has done, the second is work that has ROTTED, and a reader who cannot tell them apart will
 * read every one as the first. Every reader below now records WHY, and the reasons print in a
 * DIAGNOSTICS block at the end of the run.
 *
 * ENOENT is not recorded. A missing artifact is the ordinary state this tool exists to report, and a
 * diagnostics line that fires on every unbuilt gate is a line people learn to skip — which is how
 * "known failure" became a status here once already. Anything else — a parse error, a permission
 * error, a tool that would not run — is a defect and says so. */
const NOTES = [];
/* NAMED `logUnreadable`, not `note`. tests/test-no-silent-failure.js reads a catch BODY and asks
 * whether it says anything; a helper called `note` looks like nothing from there, and a recorder
 * that a ratchet cannot see is the second half of the problem it was written for. The name is also
 * simply more accurate about what it does. */
const logUnreadable = (where, e) => {
  const why = (e && (e.code === 'ENOENT' ? null : (e.message || String(e)))) || null;
  if (why) NOTES.push(`${where}: ${String(why).split('\n')[0].slice(0, 160)}`);
  return null;
};
const j = p => { try { return JSON.parse(fs.readFileSync(D('data', p), 'utf8')); } catch (e) { return logUnreadable(`data/${p}`, e); } };
const mtime = p => { try { return fs.statSync(D(p)).mtime; } catch (e) { return logUnreadable(`mtime ${p}`, e); } };
const day = d => d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—';
const out = [];
const say = s => out.push(s);

/* ---- THE REFIT EDGE ---------------------------------------------------------------------------
 * provenance.js checks artifact-against-artifact and catches a great deal, but it reads the data
 * graph: a .json declaring what it was built from. It cannot see the edge that actually costs the
 * most here, which runs from SOURCE to artifact. board.js computes damage THROUGH medicham, so a
 * change to the engine source moves 58 features under a set of weights that were fitted before it,
 * and every artifact downstream of those weights is describing a model that no longer exists.
 *
 * Nothing declares that edge because a .js file has no provenance header.
 *
 * THE FIRST VERSION OF THIS CHECK WAS WRONG IN THE EXACT WAY THE PROJECT KEEPS BEING WRONG.
 * It carried a hand-typed `REFIT_SOURCES` list — S13 violated inside the tool written to enforce it —
 * and the list was already short: provenance.js derives a fourth input, abra-tags.js, which HAD moved
 * while this reported only medicham. It then raised REFIT OWED on an mtime, and the change turned out
 * to be confined to battleTurn, which board.js never calls. A false alarm and a real miss, in one
 * function, on day one.
 *
 * So the authority is now CONTENT, not timestamps. feature_fixture.js --check re-derives all 58
 * feature columns and hashes them against what was stamped at fit time. If the hashes match, the
 * feature function has not moved and no refit is owed — whatever any mtime says, through any route,
 * including ones nobody thought to list. If they differ, the refit is owed for a stated reason.
 * The source list is read out of provenance.js rather than retyped, so there is one definition.
 */
const WEIGHTS = 'data/policy-weights.json';

function engineInputs() {
  /* One definition, in provenance.js, which derives what depends on it. Read it, do not restate it. */
  try {
    const src = fs.readFileSync(D('engine', 'provenance.js'), 'utf8');
    const m = src.match(/ENGINE_INPUTS\s*=\s*\[([^\]]*)\]/);
    if (m) return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    NOTES.push('engine/provenance.js: ENGINE_INPUTS did not match — the refit edge has no input list');
  } catch (e) { logUnreadable('engine/provenance.js (ENGINE_INPUTS)', e); }
  return null;
}

function refitOwed() {
  const w = mtime(WEIGHTS);
  if (!w) return { verdict: 'NOT DERIVED', reason: 'no ' + WEIGHTS };

  /* mtime is the CHEAP screen, not the verdict. It says only "something might have moved". */
  const inputs = engineInputs();
  const newer = (inputs || []).map(f => {
    for (const dir of ['engine', 'data']) {
      const p = dir + '/' + f;
      if (fs.existsSync(D(p))) return { src: p, at: mtime(p) };
    }
    return null;
  }).filter(r => r && r.at && r.at > w);

  if (!inputs) return { verdict: 'NOT DERIVED', reason: 'could not read ENGINE_INPUTS from provenance.js', weights: w };
  if (!newer.length) return { verdict: 'CLEAN', weights: w, newer: [], how: 'no engine input is newer than the weights' };

  /* Something moved. Now ask the only question that matters: did the FEATURE FUNCTION move with it? */
  try {
    execFileSync(process.execPath, [D('engine', 'feature_fixture.js'), '--check', D('data', 'policy-weights.json')],
      { encoding: 'utf8', maxBuffer: 1 << 24, env: { ...process.env, SHOWDOWN_PATH: process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown' } });
    return { verdict: 'CLEAN', weights: w, newer, how: 'feature_fixture --check passes: all 58 columns hash-identical to fit time' };
  } catch (e) {
    const all = ((e.stdout || '') + '\n' + (e.stderr || '') + '\n' + (e.message || '')).toString();
    const msg = all.split('\n').filter(Boolean).slice(-3).join(' | ');
    /* TWO DIFFERENT FACTS ARRIVED HERE AS ONE. `feature_fixture --check` exits non-zero when a
     * column's hash MOVED, and it also exits non-zero when it could not run at all — a bad
     * SHOWDOWN_PATH, a missing dex, a throw inside the fixture. Both printed REFIT OWED, which is
     * the safe direction and the wrong sentence: one says the weights are stale, the other says
     * this tool has no opinion. P0 #40 records two ratchets that CRASHED rather than failed for
     * exactly this reason and stayed invisible for it. */
    const ran = /FEATURE SEMANTICS CHECK FAILED/.test(all);
    if (!ran) {
      NOTES.push('engine/feature_fixture.js --check could not RUN, so the refit edge is unknown, not clean: ' + msg);
      return { verdict: 'NOT DERIVED', weights: w, newer,
               reason: 'feature_fixture --check did not run: ' + msg };
    }
    return { verdict: 'REFIT OWED', weights: w, newer, how: 'feature_fixture --check FAILED: ' + msg };
  }
}

/* ---- ENGINE ---------------------------------------------------------------------------------- */
function engine() {
  const c = j('mechanics-census.json');
  const d = j('engine-diff.json');
  const t = j('tags.json');

  say('ENGINE — does the simulator do what Pokémon does');
  if (c) {
    say(`  ${c.live}/${c.probed} probed mechanics live, ${c.missing} missing   (census ${day(new Date(c.generated))})`);
    const dead = c.results.filter(r => !r.live);
    if (dead.length) {
      say('  missing:');
      for (const r of dead) say(`    ${r.kind.padEnd(7)} ${r.tag.padEnd(22)} ${r.label}`);
    }
  } else say('  census: NOT DERIVED (data/mechanics-census.json absent — run tests/test-mechanics.js)');

  if (d) {
    /* THE SEED AND THE SKIPS BELONG ON THIS LINE. The artifact carries `seed`, `requested`,
     * `skipped_multihit`, `skipped_non_finite` and `dropped_by_exception`, and this print used to
     * read none of them — so "1/150 disagree" read as unconditional when rows had been skipped as
     * not-comparable and the denominator was a SAMPLE, not the corpus. The sampler used a bare
     * Math.random() until 2026-08-04 and two runs over identical source returned 6 then 3, which is
     * the whole argument: a residual quoted without its seed is a residual quoted from one draw. */
    const skipped = (d.skipped_multihit || 0) + (d.skipped_non_finite || 0) + (d.dropped_by_exception || 0);
    say(`  ${d.disagreed}/${d.compared} differential comparisons disagree with Showdown   (${day(new Date(d.generated))})`);
    say(`    seed ${d.seed == null ? 'NOT RECORDED — this residual is one draw and cannot be reproduced' : d.seed}`
      + `, requested ${d.requested == null ? '?' : d.requested}`
      + (skipped ? `, ${skipped} not comparable (multihit ${d.skipped_multihit || 0}, non-finite ${d.skipped_non_finite || 0}, threw ${d.dropped_by_exception || 0})` : ''));
    for (const w of (d.worst || []).slice(0, 6)) {
      say(`    ${w.att} ${w.mv} -> ${w.def}: showdown ${w.showdown}, medicham ${w.medicham}  (${w.uses} uses)`);
    }
    say('    a differential hit is NOT in the census count above — the census probes what someone thought to probe');
  } else say('  differential: NOT DERIVED (data/engine-diff.json absent — run tests/test-engine-diff.js)');

  /* THE INTERACTION MATRIX — the largest instrument, and this file printed nothing about it.
   *
   * The census asks whether ONE mechanic is live and the differential asks whether ONE hit's damage
   * is right. Neither can see a pair: Grassy Terrain never setting a terrain, sandstorm chipping on
   * the turn it expired, Liquid Voice wholly inert — all ten of those wires were found here and
   * were invisible to both other instruments. Leaving the matrix off the status print meant the
   * handoff said nothing about whether the mechanics work TOGETHER, which is now a bigger surface
   * than either of the things it did print.
   *
   * EMITTED-AGAINST-THEORETICAL IS THE HONEST COVERAGE LINE and is deliberately printed beside the
   * agreement rate. "899 of 899 agree" alone reads as "the engine is correct"; what it means is
   * "the engine is correct on the pairs the generator could stage". Those are different claims and
   * the second one is the true one. */
  const m = j('interaction-matrix.json');
  if (m) {
    const theo = (m.theoretical && m.theoretical.total) || null;
    const pct = m.live ? (100 * m.agree / m.live) : 0;
    say(`  interaction matrix: ${m.agree}/${m.live} live carrier x reactor pairs agree with the official engine`
      + ` (${pct.toFixed(1)}%)   (${day(new Date(m.generated))})`);
    if (theo) {
      say(`    ${m.ran} of ${theo} theoretical pairs staged — agreement is a claim about the ${m.ran} that ran, not about the ${theo}`);
    }
    const notScored = [
      ['inert', m.inert, 'the reference engine behaves identically with and without the reactor'],
      ['saturated', m.saturated, 'the control arm already dealt 100% of HP, so a damage ratio is clamped'],
      ['ko-timing', m.ko_timing, 'a damage-magnitude question — tests/test-engine-diff.js owns it'],
      ['threw', m.threw, 'the harness could not stage it'],
    ].filter(r => r[1]);
    for (const [name, n, why] of notScored) say(`    ${String(n).padStart(5)} ${name.padEnd(10)} not scored — ${why}`);
    for (const p of (m.parting || []).slice(0, 6)) {
      say(`    DISAGREES  ${p.carrier} -> ${p.reactor}  (${p.layer}, ${p.uses} uses)`);
    }
    if (m.shrink_declared) {
      say(`    declared shrink ${m.shrink_declared.from} -> ${m.shrink_declared.to}: ${m.shrink_declared.reason}`);
    }
  } else say('  interaction matrix: NOT DERIVED (data/interaction-matrix.json absent — run tests/test-interaction-matrix.js --full)');

  if (c && t) {
    const names = [...new Set(t.tags.map(x => x.tag || x.name || x.id))];
    const probed = new Set(c.results.map(r => r.tag));
    const un = names.filter(n => !probed.has(n));
    say(`  tag coverage: ${names.length - un.length}/${names.length} probed, ${un.length} unprobed`);
  }
}

/* ---- MEASURE --------------------------------------------------------------------------------- */
function measure() {
  say('MEASURE — can we believe a number');

  const b = j('winrate-backtest.json');
  if (b) {
    say(`  leaf calibration: ${b.verdict}`);
    say(`    n=${b.n_games_scored} games, ${b.rollouts_per_game} rollouts each   (${day(mtime('data/winrate-backtest.json'))})`);
    /* THE CURVE, NOT JUST THE VERDICT. Four words collapse "overconfident but ranks correctly" and
     * "no signal at all" into the same line, and those need opposite responses. Printing the extreme
     * buckets shows which one it is: the region a maximiser spends its whole time in is the top
     * bucket, so that is the number that decides whether the search is being fed a lie. */
    const head = b.results && (b.results.live_ingame?.held_out_fifth || b.results.live_ingame_n40?.held_out_fifth);
    if (head) {
      const c = head.reliability_curve || [];
      const top = c[9], bot = c[0];
      if (top && top.n) say(`    when it says 90-100% it wins ${(100 * top.observed).toFixed(0)}% (n=${top.n}); ` +
        `when it says 0-10% it wins ${bot && bot.n ? (100 * bot.observed).toFixed(0) + '%' : 'n/a'} (n=${bot ? bot.n : 0})` +
        `  — ECE ${head.calibration.ece}`);
      if (b.power) say(`    powered for MDE ${(100 * b.power.mde_heldout).toFixed(1)}% held-out / ` +
        `${(100 * b.power.mde_full_clean).toFixed(1)}% full corpus; the prior effect needed n=${b.power.n_required_for_prior_effect}`);
    }
    /* DID THE ENGINE MOVE UNDER IT? The artifact stamps a content hash of every source the leaf reads,
     * so this is a comparison rather than an mtime inference — a checkout moves an mtime without
     * moving code, and the 2026-08-02 artifact was quoted for two days against an engine that had
     * gained "one mega per side" in between. */
    /* THE STORE IS NOT A BUILD. It is append-only and OPS grows it continuously, so hashing it
     * alongside the engine sources made the line read PRE-CHANGE within minutes of a clean run —
     * and a staleness flag that is always on is a staleness flag nobody reads. A grown corpus means
     * "more games are available now", which is a reason to re-run for POWER; a moved engine source
     * means the number describes a build that no longer exists, which is a reason to distrust it.
     * Separate sentences, because they call for different actions. */
    if (b.measured_against) {
      const crypto = require('crypto');
      const moved = [], corpus = [], unstamped = [], gone = [];
      for (const [rel, st] of Object.entries(b.measured_against)) {
        /* A SOURCE WITH NO HASH WAS SKIPPED IN SILENCE, AND THE SENTENCE UNDERNEATH SAID "EVERY".
         * backtest_winrate.js:71 catches a failed stat/read and stamps `{mtime: null, error}` with
         * no `sha256_12`. This loop then `continue`d past it and, finding nothing in `moved`,
         * printed "CURRENT — every engine source the leaf reads still hashes to what it was
         * measured against". With every stamp failed that sentence is printed over ZERO
         * comparisons. Two silent catches composing into a clean bill on this division's own
         * provenance line — count them and say so. */
        if (!st || !st.sha256_12) { unstamped.push(rel); continue; }
        let now = null;
        try { now = crypto.createHash('sha256').update(fs.readFileSync(D(rel))).digest('hex').slice(0, 12); }
        catch (e) { now = 'MISSING'; logUnreadable(`re-hashing ${rel} for the leaf-calibration stamp`, e); }
        if (now === st.sha256_12) continue;
        /* GONE IS NOT MOVED. A source that no longer exists was being reported as "measured against
         * a different build of", which reads as an ordinary engine edit. */
        if (now === 'MISSING') { gone.push(rel); continue; }
        (/\.jsonl$/.test(rel) ? corpus : moved).push(rel);
      }
      const compared = Object.keys(b.measured_against).length - unstamped.length;
      if (moved.length) say(`    PRE-CHANGE — measured against a different build of: ${moved.join(', ')}`);
      else if (compared) say(`    CURRENT — all ${compared} engine sources the leaf reads still hash to what they were measured against`);
      else say('    NOT DERIVED — no source in measured_against carries a hash, so nothing was compared');
      if (gone.length) say(`    A SOURCE THE LEAF WAS MEASURED AGAINST NO LONGER EXISTS: ${gone.join(', ')}`);
      if (unstamped.length) say(`    ${unstamped.length} source(s) were never hashed at measure time and could not be checked: ${unstamped.join(', ')}`);
      if (corpus.length) say(`    (the corpus has grown since: ${corpus.join(', ')} — more power available, not staleness)`);
    }
  } else say('  leaf calibration: NOT DERIVED (data/winrate-backtest.json absent)');

  /* provenance is the canonical staleness authority; do not reimplement its rules here. Lesson 8. */
  let prov = null, provRan = false;
  /* A NON-ZERO EXIT IS A VERDICT, NOT A CRASH, AND THIS USED TO DISCARD IT.
   *
   * provenance.js exits 1 when the mtime_only ratchet GROWS — a new generator shipped without
   * stamping its inputs. That is a finding, and it is a finding it prints in full: the counts line,
   * the UNSAFE list and the names of the newly-unstamped artifacts are all on stdout before it
   * sets the exit code. execFileSync throws on non-zero and threw that output away, so the entire
   * provenance section collapsed to NOT DERIVED and the handoff went blind to 90-odd artifacts
   * because three new ones lacked a stamp.
   *
   * Observed doing exactly that on 2026-08-05 while three divisions were mid-flight. A gate that
   * hides the picture when it fires is a gate people learn to route around, which is the failure
   * this repo has already paid for once. So: keep the output, print the counts, and say the ratchet
   * tripped — the two facts are separate and both belong on screen. */
  const readProv = () => {
    try {
      return { txt: execFileSync(process.execPath, [D('engine', 'provenance.js')],
        { encoding: 'utf8', maxBuffer: 1 << 24 }), tripped: false, err: null };
    } catch (e) {
      const txt = typeof e.stdout === 'string' ? e.stdout : (e.stdout ? String(e.stdout) : '');
      /* OUTPUT PRESENT means it RAN and reached a verdict — a non-zero exit IS that verdict here
       * (the ratchet grew) and the caller prints it, so there is nothing to record. EMPTY OUTPUT
       * means the tool genuinely died, which is a defect: record it so it reaches DIAGNOSTICS
       * instead of being swallowed by a catch that returns a plausible empty result. */
      if (!txt) logUnreadable('engine/provenance.js (exited non-zero with no output)', e);
      return { txt, tripped: !!txt, err: e };
    }
  };
  {
    const r = readProv();
    const m = r.txt && r.txt.match(/(\d+) UNSAFE, (\d+) possibly stale, (\d+) ok, (\d+) missing/);
    if (m) prov = { unsafe: +m[1], stale: +m[2], ok: +m[3], missing: +m[4] };
    if (prov) {
      provRan = true;
      say(`  provenance: ${prov.unsafe} unsafe, ${prov.stale} possibly stale, ${prov.ok} ok, ${prov.missing} missing`);
      if (/OPT-IN FILTERS/.test(r.txt)) say('    a generator makes the quality filter OPT-IN — see the tail of provenance.js');
      if (r.tripped) {
        /* Name the artifacts. A ratchet that fires without naming its cause is a ratchet someone
         * switches off — provenance.js learned that lesson about itself and records it in place. */
        const grew = (r.txt.match(/^\s{4}([\w.-]+\.json)\s*$/gm) || []).map(s => s.trim());
        say('    RATCHET TRIPPED — the unstamped list grew; provenance.js exited non-zero'
          + (grew.length ? ': ' + grew.slice(0, 6).join(', ') : ''));
        say('    their generators ship without recording what CONTENT they read — stamp source_digests');
        NOTES.push('provenance ratchet tripped: ' + (grew.slice(0, 6).join(', ') || 'see engine/provenance.js'));
      }
    } else {
      const why = r.err ? String(r.err.message || r.err).split('\n')[0] : 'output did not contain a counts line';
      NOTES.push('engine/provenance.js did not run: ' + why);
      say('  provenance: NOT DERIVED (engine/provenance.js did not run: ' + why + ')');
    }
  }
  /* THE OTHER HALF OF THE SAME QUESTION, AND IT WAS MISSING. provenance.js exiting 0 with output
   * this regex does not match leaves `prov` null, no line is printed at all, and the section simply
   * has one fewer row — which reads as "there is no provenance line" rather than "the provenance
   * line could not be parsed". */
  if (provRan && !prov) { NOTES.push('engine/provenance.js ran but its summary line did not parse'); say('  provenance: NOT DERIVED (summary line did not parse)'); }

  /* ---- CLICK CENSORING — read out of the artifacts, never typed ------------------------------
   * docs/CLICK-CENSORING-FIX.md. Three numbers belong on this screen: how much of the labelled set
   * was NOT a click (the poison that was being fitted), how much is kept under a candidate set
   * instead of a wrong certainty, and whether removing the poison changed BEHAVIOUR on those turns.
   *
   * The class-conditional contrast is the headline and the corpus-wide one is a control — §4 of the
   * spec disclaims a corpus-wide top-1 claim in advance, so printing that as the result here would
   * be manufacturing the thing the spec says not to claim. */
  const cen = j('click-censoring-census.json');
  if (!cen) say('  click censoring: NOT DERIVED (data/click-censoring-census.json absent)');
  else {
    const a1 = cen.event_stream_arm || {};
    say(`  click censoring: ${(a1.coerced || 0).toLocaleString()} of ${(a1.actions_seen || 0).toLocaleString()} recorded actions ` +
      `were NOT clicks (${(100 * (a1.rates || {}).coerced).toFixed(3)}%) and left the labeled set; ` +
      `${(a1.partial || 0).toLocaleString()} (${(100 * (a1.rates || {}).partial).toFixed(3)}%) are kept under a candidate set`);
    const ag = cen.agreement || {};
    const pc2 = (h, t) => (t ? (100 * h / t).toFixed(1) + '%' : 'n/a');
    say(`    classifier vs the raw protocol on ${((cen.raw_protocol_arm || {}).games_with_log || 0).toLocaleString()} games ` +
      `(${(100 * ((cen.raw_protocol_arm || {}).coverage || 0)).toFixed(1)}% of the corpus): ` +
      `encore recall ${pc2((ag.encore || {}).hit, (ag.encore || {}).truth)} precision ${pc2((ag.encore || {}).hit, (ag.encore || {}).found)}, ` +
      `drag recall ${pc2((ag.drag || {}).hit, (ag.drag || {}).truth)} precision ${pc2((ag.drag || {}).hit, (ag.drag || {}).found)}`);
    /* AN OLDER ARTIFACT MUST NOT CRASH THIS TOOL. The first version of this line did `.toFixed()` on
     * a field a pre-noise-floor run does not carry, and status.js died on the whole handoff. A status
     * tool that throws on a stale input is worse than one that says NOT DERIVED, which is the same
     * argument the NOTES/logUnreadable block at the top of this file makes. */
    const em = j('partial-label-em.json');
    const A = em && em.regimes && em.regimes.amplified;
    const num = v => (typeof v === 'number' && isFinite(v));
    if (A && num(A.em_recovered_fraction) && num(A.censoring_bias) && num(A.noise_floor_oracle_spread)) {
      say(`    EM recovers ${(100 * A.em_recovered_fraction).toFixed(1)}% of a planted censoring bias of ` +
        `${A.censoring_bias.toFixed(3)} against a ${A.noise_floor_oracle_spread.toFixed(3)} noise floor (amplified regime)` +
        (A.bias_exceeds_noise_floor ? '' : '  — BUT THE BIAS IS INSIDE ITS OWN NOISE FLOOR, so this regime says nothing'));
    } else if (A) {
      NOTES.push('data/partial-label-em.json predates the replicated noise-floor arm — re-run engine/em_validation.js');
      say('    EM estimator: artifact present but PRE-NOISE-FLOOR shape — re-run engine/em_validation.js');
    } else {
      say('    EM estimator: NOT DERIVED (data/partial-label-em.json absent) — the fit is running an unvalidated estimator');
    }
    const cv = j('censoring-value.json');
    if (!cv) say('    behaviour change: NOT DERIVED (data/censoring-value.json absent)');
    else if (cv.void) say(`    behaviour change: VOID — ${cv.void_reason}`);
    else {
      const f = (c, k) => { const x = ((cv.contrasts || {})[c] || {})[k]; return x ? `${x.point >= 0 ? '+' : ''}${x.point.toFixed(6)} [${x.ci95[0].toFixed(6)}, ${x.ci95[1].toFixed(6)}]${x.excludes_zero ? '' : ' (contains zero)'}` : 'n/a'; };
      say(`    behaviour on the OUTPLAYED turns, after - before, paired and game-bootstrapped:`);
      say(`      redirection turns, mass on the candidate set  ${f('partial', 'p')}   n=${(cv.class_counts || {}).partial}`);
      say(`      coerced turns, P(the coerced action)          ${f('coerced', 'p')}   n=${(cv.class_counts || {}).coerced}  (lower is better)`);
      say(`      CONTROL, clean turns, logL                    ${f('clean', 'll')}   n=${(cv.class_counts || {}).clean}`);
    }
  }

  const r = refitOwed();
  if (r.verdict === 'NOT DERIVED') say(`  refit edge: NOT DERIVED (${r.reason})`);
  else if (r.verdict === 'REFIT OWED') {
    say(`  REFIT OWED — weights fitted ${day(r.weights)}`);
    say(`    ${r.how}`);
    for (const n of r.newer) say(`    moved after the fit: ${n.src}  ${day(n.at)}`);
  } else {
    say(`  refit edge: CLEAN — ${r.how}`);
    for (const n of r.newer) say(`    (${n.src} moved ${day(n.at)}, but the feature function did not)`);
  }
}

/* ---- SEARCH ---------------------------------------------------------------------------------- */
function search() {
  say('SEARCH — does MILTANK choose better than MAG');

  /* R1 PRINTS ITS VERDICT, THE SAME WAY R4 DOES, AND FOR THE SAME REASON IT HAD TO CHANGE.
   *
   * This line used to read data/rollout-r1.json as `joined N, dropped M misaligned, k=K` — the shape
   * of engine/rollout_r1_join.py's cross-language join. That join was WITHDRAWN on 2026-08-03; the
   * script prints "THE JOIN IS UNVALIDATED — DO NOT READ THE TABLE ABOVE AS A HEAD-TO-HEAD" and
   * docs/ROLLOUT-design.md §5 says so too. Nothing was hidden. The GATE READ IT ANYWAY, because it
   * owned the filename, so this tool reported a withdrawn result as R1's status while R1's real
   * result — published in prose at 68.18% — had no file at all. The identical defect this file
   * already calls out for R4, one gate above it.
   *
   * The join now lives at data/rollout-r1-withdrawn-join.json, the gate name belongs to
   * engine/rollout_r1_artifact.js, and the guard below means a `withdrawn: true` artifact can never
   * again be printed as a result — whatever it is called. */
  /* AND THEN IT REPORTED THE WRONG ARM, WHICH IS THE SAME BUG WEARING THE NEXT MASK.
   *
   * data/rollout-r1.json holds the DETERMINISTIC-GREEDY playout (explore=0), because that is the
   * arm the committed dump happens to contain. MILTANK does not run it: engine/miltank.js:44 sets
   * `explore: 1.0` and that is what reaches the leaf. So this gate printed UNDECIDED — an honest
   * verdict about a configuration nothing ships — as though it were R1's status.
   *
   * The explore=1.0 arm was dumped on 2026-08-04 over the SAME 9,201 positions, verified row for
   * row, and on it R1 PASSES: 67.97% against material's 65.26%, +2.706 [1.596, 3.817] — reproducing
   * the 68.18% that was published in prose and then retracted as uncheckable. The retraction was
   * right about provenance and wrong about the arm.
   *
   * So the shipped arm is the headline and the incumbent is kept underneath it, because deleting it
   * would repeat the original mistake in the other direction. Prefer the shipped arm when it exists;
   * fall back rather than print NOT DERIVED, since the greedy arm is still a real measurement. */
  const r1Ship = j('rollout-r1-explore1.json');
  const gates = [
    ['R1 leaf accuracy', r1Ship ? 'rollout-r1-explore1.json' : 'rollout-r1.json',
      d => (d.verdict || JSON.stringify(d).slice(0, 80)) + (r1Ship ? '   [explore=1.0 — THE ARM MILTANK RUNS]' : '')],
    ['R2 leaf cost', 'rollout-cost.json', d => `${d.boards} boards over ${d.games} games`],
    ['R3 divergence', 'rollout-r3.json', d => `${d.divergence_pct.toFixed(1)}% over ${d.decisions} decisions (${d.agreed} agreed, ${d.skipped} skipped)`],
  ];
  for (const [name, file, fmt] of gates) {
    const d = j(file);
    if (!d) { say(`  ${name.padEnd(18)} NOT DERIVED (data/${file} absent)`); continue; }
    if (d.withdrawn) {
      say(`  ${name.padEnd(18)} WITHDRAWN ARTIFACT — data/${file} says withdrawn:true. Not a result.`);
      if (d.withdrawn_reason) say(`    ${String(d.withdrawn_reason).split('.')[0]}.`);
      continue;
    }
    say(`  ${name.padEnd(18)} ${fmt(d)}   (${day(new Date(d.generated))})`);
    /* R1's verdict is arithmetic over a row dump that stamps no build, and the dump does not record
     * WHICH rollout its column is. Both change how the line above should be read, so both are
     * printed under it rather than left inside the file where only a reader of JSON finds them. */
    const w = d.which_rollout_is_this;
    if (w) {
      if (w.inference) say(`    ${w.inference.split('.')[0]}.`);
      if (w.consequence) say(`    ${w.consequence}`);
    }
    /* THE STAMP, OR THE ABSENCE OF ONE, ON THE SAME SCREEN AS THE NUMBER.
     *
     * R1's published +2.91 was quoted for a day against a dump that could not say which of two runs
     * four accuracy points apart it was. Nothing was hidden then either — the fact simply lived in a
     * file nobody opened. A sidecar that says "this run's control was never written down" is worth
     * nothing if the gate line above it prints clean, so it prints here.
     *
     * The path is DERIVED by the same function the writer uses, not spelled a second time. */
    let meta = null;
    /* `j()` already records a parse failure. What this catch adds is the OTHER failure: run_stamp.js
     * itself not loading, or metaPathFor throwing. That produced the same "NO SIDECAR" line as a
     * gate that genuinely has no stamp — accusing the gate of a defect belonging to the stamper. */
    try { meta = j(require('./run_stamp.js').metaPathFor(file)); }
    catch (e) { meta = null; NOTES.push(`engine/run_stamp.js could not give a sidecar path for data/${file}: ${String(e.message || e).split('\n')[0]}`); }
    /* An artifact that carries its OWN stamps block has already answered this question in the two
     * lines above — data/rollout-r1.json does, at length. Repeating "NO SIDECAR" underneath it would
     * be a third statement of one fact, and a line that fires forever after the fix is a line people
     * learn to skip. That is how "known failure" became a status in this repository once already. */
    const inArtifact = d.stamps || (d.standing && d.standing.stamps);
    if (!meta && !inArtifact) {
      say('    NO SIDECAR — nothing records which configuration produced this. See engine/run_stamp.js.');
    } else if (meta && meta.reconstructed) {
      say(`    STAMP RECONSTRUCTED, NOT OBSERVED — inferred from commit ${String(meta.git && meta.git.commit).slice(0, 12)}; ${String(meta.confidence).split(',')[0]}`);
      for (const [k, v] of Object.entries(meta.unrecorded_settings || {})) {
        say(`      ${k}: ${String(v).split('.')[0]}.`);
      }
    } else if (meta && meta.measured) {
      const m = meta.measured;
      /* THREE STATES, NOT TWO. `dirty: null` means run_stamp could not ask git — see its gitState.
       * Rendering that as the clean case is the same collapse this line exists to expose. */
      const gd = meta.git && meta.git.dirty;
      say(`    stamped: ${m.key}${gd === true ? '  (TREE WAS DIRTY — trust source_digests, not the commit)'
        : gd === null ? '  (DIRTINESS UNKNOWN — git did not answer when this was stamped)' : ''}`);
    }
  }

  /* R4 IS THE ONE THAT DECIDED AND IT IS THE ONE WITH NO ARTIFACT. Its verdict exists only in
   * prose, which is the exact failure this file was written to end. Until a generator writes
   * data/rollout-r4.json the way r1/r2/r3 do, this prints what it can see and refuses to quote
   * the number — because the number is not here to quote. */
  const r4 = j('rollout-r4.json');
  if (r4) {
    say(`  R4 does it win     ${r4.verdict || JSON.stringify(r4).slice(0, 80)}   (${day(new Date(r4.generated))})`);
  } else {
    const f = mtime('data/games.r4-decided.jsonl');
    say('  R4 does it win     NO ARTIFACT — the verdict is prose only, not a file.');
    if (f) say(`    games present: data/games.r4-decided.jsonl (${day(f)}). Read it with: node engine/sprt.js data/games.r4-decided.jsonl`);
    say('    write data/rollout-r4.json from that run before anyone quotes 55.5% again.');
  }

  /* A run measures the engine it ran on. If the engine moved afterwards, the run is a fact about a
   * build that no longer exists — the frozen-release rule in docs/DIVISIONS.md exists for this. */
  const newestSrc = (engineInputs() || []).map(f => {
    for (const dir of ['engine', 'data']) {
      const p = dir + '/' + f;
      if (fs.existsSync(D(p))) return { s: p, at: mtime(p) };
    }
    return null;
  }).filter(x => x && x.at).sort((a, b) => b.at - a.at)[0];
  const runs = fs.readdirSync(D('data'))
    .filter(f => /^games\.(r4|h2h)[^.]*\.jsonl$/.test(f))
    .map(f => ({ f, at: mtime(path.join('data', f)) }))
    .sort((a, b) => b.at - a.at).slice(0, 5);
  if (newestSrc && runs.length) {
    say(`  runs vs engine (newest engine source: ${newestSrc.s} ${day(newestSrc.at)}):`);
    for (const r of runs) {
      const stale = r.at < newestSrc.at;
      say(`    ${stale ? 'PRE-CHANGE' : 'current   '} ${r.f}  ${day(r.at)}`);
    }
  }
}

/* ---- OPS ------------------------------------------------------------------------------------- */
function ops() {
  say('OPS — the live bot and the store');
  let live = null;
  try {
    const src = fs.readFileSync(D('data', 'live.js'), 'utf8');
    live = JSON.parse(src.replace(/^\s*window\.LIVE\s*=\s*/, '').replace(/;\s*$/, ''));
  } catch (e) { logUnreadable('data/live.js', e); }
  if (live) {
    say(`  store: ${live.games} games, ${live.usable} usable (${live.usablePct}%), ${live.teams} teams   (live.js ${live.updated})`);
  } else say('  store: NOT DERIVED (data/live.js unreadable)');

  try {
    const n = fs.readdirSync(D('data', 'live-games')).filter(f => f.endsWith('.json')).length;
    say(`  live-games/: ${n} battles recorded`);
  } catch (e) { logUnreadable('data/live-games/', e); say('  live-games/: NOT DERIVED'); }

  /* THIS LIST PRINTED A FROZEN ARCHIVE BESIDE THE LIVE STORE AND OMITTED THE ONE ACTUALLY
   * COLLECTING OPEN TEAM SHEETS, which read as "OTS collection stopped in July" to every session
   * that saw it — including several that then went looking for a broken ingest.
   *
   * The hourly Action (.github/workflows/ingest.yml) pulls exactly two formats:
   * gen9championsvgc2026regmb -> games.ladder.jsonl, and gen9championsvgc2026regmbbo3 ->
   * games.bo3.jsonl. The bo3 ruleset carries Force Open Team Sheets, so THAT is the continuously
   * collected OTS corpus, and it is the most recently written store on disk.
   *
   * games.ots.jsonl is a COMPLETED external import (cameronangliss/vgc-battle-logs, collected
   * 2026-06-17..20) written once by hand via engine/ingest_ots.js, whose logs_*.json inputs are not
   * in the repo. It cannot grow and it is not broken — ten consumers read it, and all 4,167 lines
   * carry declared:true, so the |showteam| merge fix is present in it. Its date is an IMPORT date,
   * not a heartbeat, and the label has to say so or the next reader draws the same wrong conclusion. */
  const stores = [
    ['data/games.ladder.jsonl', ''],
    ['data/games.bo3.jsonl', '  <- the Force-OTS format, collected hourly'],
    ['data/games.ots.jsonl', '  <- FROZEN external import, complete; date is an import, not a heartbeat'],
  ];
  /* `tag`, not `note` — `note` is the diagnostics recorder at the top of this file and a loop
   * variable of that name shadows it for the whole body. */
  for (const [f, tag] of stores) {
    say(`  ${f.padEnd(28)} last written ${day(mtime(f))}${tag}`);
  }
}

/* ---- EMIT ------------------------------------------------------------------------------------ */
const SECTIONS = { ENGINE: engine, MEASURE: measure, SEARCH: search, OPS: ops };
const blocks = {};
for (const [name, fn] of Object.entries(SECTIONS)) {
  const start = out.length;
  fn();
  blocks[name] = out.slice(start).join('\n');
  say('');
}

console.log('');
console.log('ABRA STATUS — generated ' + day(new Date()) + ' by engine/status.js');
console.log('Every figure is read from an artifact. NOT DERIVED means no artifact says it. Times are UTC.');
console.log('');
console.log(out.join('\n'));
/* DELIBERATELY OUTSIDE THE SECTION BLOCKS, so `--write` never stamps it into a ledger. A diagnostic
 * is a fact about THIS RUN of this tool — an artifact that would not parse, a subprocess that would
 * not start — not a fact about the project, and pasting it into a document would make a transient
 * read as a finding. It prints on the screen where the person who can fix it is looking. */
if (NOTES.length) {
  console.log(`DIAGNOSTICS — ${NOTES.length} thing(s) this run could not read. Each was previously an`);
  console.log('unexplained NOT DERIVED, which is indistinguishable from work nobody has done yet.');
  for (const n of NOTES) console.log('  ' + n);
  console.log('');
}
console.log('Rules: CLAUDE.md.   Divisions and routing: docs/DIVISIONS.md.   Lessons: docs/LESSONS.md.');
console.log('');

if (WRITE) {
  /* The ledgers carry judgement — what counts as done, what this division may not touch — which is
   * a human's to write. The numbers are stamped between markers so regenerating never eats it. */
  for (const [name, body] of Object.entries(blocks)) {
    const f = D('docs', name + '.md');
    if (!fs.existsSync(f)) { console.log('  skip ' + name + '.md (not present)'); continue; }
    const src = fs.readFileSync(f, 'utf8');
    const re = /(<!-- GENERATED: engine\/status\.js -->\n)[\s\S]*?(<!-- \/GENERATED -->)/;
    if (!re.test(src)) { console.log('  skip ' + name + '.md (no GENERATED block)'); continue; }
    const stamped = src.replace(re, `$1\n\`\`\`\n${body}\n\`\`\`\n\n_stamped ${day(new Date())}_\n\n$2`);
    fs.writeFileSync(f, stamped);
    console.log('  stamped docs/' + name + '.md');
  }
}
