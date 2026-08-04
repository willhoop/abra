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

  const gates = [
    ['R1 leaf accuracy', 'rollout-r1.json', d => `joined ${d.joined}, dropped ${d.dropped_misaligned} misaligned, k=${d.k}`],
    ['R2 leaf cost', 'rollout-cost.json', d => `${d.boards} boards over ${d.games} games`],
    ['R3 divergence', 'rollout-r3.json', d => `${d.divergence_pct.toFixed(1)}% over ${d.decisions} decisions (${d.agreed} agreed, ${d.skipped} skipped)`],
  ];
  for (const [name, file, fmt] of gates) {
    const d = j(file);
    if (d) say(`  ${name.padEnd(18)} ${fmt(d)}   (${day(new Date(d.generated))})`);
    else say(`  ${name.padEnd(18)} NOT DERIVED (data/${file} absent)`);
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

  for (const f of ['data/games.ladder.jsonl', 'data/games.ots.jsonl']) {
    say(`  ${f.padEnd(28)} last written ${day(mtime(f))}`);
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
