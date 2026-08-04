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
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const WRITE = process.argv.includes('--write');

const j = p => { try { return JSON.parse(fs.readFileSync(D('data', p), 'utf8')); } catch (e) { return null; } };
const mtime = p => { try { return fs.statSync(D(p)).mtime; } catch (e) { return null; } };
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
  } catch (e) { /* fall through */ }
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
    const msg = (e.stdout || e.message || '').toString().split('\n').filter(Boolean).slice(-3).join(' | ');
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
    say(`  ${d.disagreed}/${d.compared} differential comparisons disagree with Showdown   (${day(new Date(d.generated))})`);
    for (const w of (d.worst || []).slice(0, 6)) {
      say(`    ${w.att} ${w.mv} -> ${w.def}: showdown ${w.showdown}, medicham ${w.medicham}  (${w.uses} uses)`);
    }
    say('    a differential hit is NOT in the census count above — the census probes what someone thought to probe');
  } else say('  differential: NOT DERIVED (data/engine-diff.json absent — run tests/test-engine-diff.js)');

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
      const moved = [], corpus = [];
      for (const [rel, st] of Object.entries(b.measured_against)) {
        if (!st || !st.sha256_12) continue;
        let now = null;
        try { now = crypto.createHash('sha256').update(fs.readFileSync(D(rel))).digest('hex').slice(0, 12); } catch (e) { now = 'MISSING'; }
        if (now === st.sha256_12) continue;
        (/\.jsonl$/.test(rel) ? corpus : moved).push(rel);
      }
      if (moved.length) say(`    PRE-CHANGE — measured against a different build of: ${moved.join(', ')}`);
      else say('    CURRENT — every engine source the leaf reads still hashes to what it was measured against');
      if (corpus.length) say(`    (the corpus has grown since: ${corpus.join(', ')} — more power available, not staleness)`);
    }
  } else say('  leaf calibration: NOT DERIVED (data/winrate-backtest.json absent)');

  /* provenance is the canonical staleness authority; do not reimplement its rules here. Lesson 8. */
  let prov = null;
  try {
    const txt = execFileSync(process.execPath, [D('engine', 'provenance.js')], { encoding: 'utf8', maxBuffer: 1 << 24 });
    const m = txt.match(/(\d+) UNSAFE, (\d+) possibly stale, (\d+) ok, (\d+) missing/);
    if (m) prov = { unsafe: +m[1], stale: +m[2], ok: +m[3], missing: +m[4] };
    const optin = /OPT-IN FILTERS/.test(txt);
    if (prov) {
      say(`  provenance: ${prov.unsafe} unsafe, ${prov.stale} possibly stale, ${prov.ok} ok, ${prov.missing} missing`);
      if (optin) say('    a generator makes the quality filter OPT-IN — see the tail of provenance.js');
    }
  } catch (e) {
    say('  provenance: NOT DERIVED (engine/provenance.js did not run: ' + e.message.split('\n')[0] + ')');
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
    try { meta = j(require('./run_stamp.js').metaPathFor(file)); } catch (e) { meta = null; }
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
      say(`    stamped: ${m.key}${meta.git && meta.git.dirty ? '  (TREE WAS DIRTY — trust source_digests, not the commit)' : ''}`);
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
  } catch (e) { /* fall through to NOT DERIVED */ }
  if (live) {
    say(`  store: ${live.games} games, ${live.usable} usable (${live.usablePct}%), ${live.teams} teams   (live.js ${live.updated})`);
  } else say('  store: NOT DERIVED (data/live.js unreadable)');

  try {
    const n = fs.readdirSync(D('data', 'live-games')).filter(f => f.endsWith('.json')).length;
    say(`  live-games/: ${n} battles recorded`);
  } catch (e) { say('  live-games/: NOT DERIVED'); }

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
  for (const [f, note] of stores) {
    say(`  ${f.padEnd(28)} last written ${day(mtime(f))}${note}`);
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
