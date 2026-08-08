/* quarantine.js — EVERYTHING DOWNSTREAM OF MEDICHAM IS WITHHELD UNTIL MEDICHAM IS CORRECT.
 *
 *   node engine/quarantine.js            print the gate, the failing clauses and the withheld set
 *   node engine/quarantine.js --graph    print the derivation: why each artifact is in or out
 *   node engine/quarantine.js --check    GATE — fails if a quarantined figure is being printed
 *   node engine/quarantine.js --selftest drive every branch on synthetic input, red and green
 *
 * WHY THIS EXISTS
 * ---------------
 * Will, 2026-08-08: "all engines that take medicham's output should be regarded as out of date and we
 * should stop referencing them until medicham is up to date and we can rerun them."
 *
 * CLAUDE.md states the rule. This file is the mechanism, because this repository's whole history says
 * a rule that exists only in prose is a preference: the fourteen stale handoffs, the hand-maintained
 * ban list of four, the auto-commit paragraph kept twelve days past the thing it described.
 *
 * A CAPTION IS NOT A QUARANTINE, AND THAT IS THE SPECIFIC BUG THIS CLOSES.
 * `status.js` has printed `PRE-CHANGE — measured against a different build of: ...` and
 * `[engine moved since; transfer assumed, not measured]` beside these numbers for days, and the
 * numbers went on being quoted anyway — including to Will, by the session that wrote the caption. It
 * is the identical failure to a red gate reported for two days as "one of the two known failures":
 * the figure is rendered, the warning is skimmed, the figure gets used. So the figure is WITHHELD.
 * Printing it with a caveat IS the bug, and a reader who wants it can run the generator.
 *
 * THE GATE IS READ, NOT REMEMBERED. It lifts on a measured condition and on nothing else. There is
 * deliberately no flag anybody can set by hand: a field that can silence a gate eventually silences
 * it wrongly, which is why `provenance.js`'s `void` is one-way and has no `valid: true` counterpart.
 *
 * A MISSING STAGE IS A FAILING CLAUSE. The deliberate roster has three stages that matter and only
 * one has ever produced an artifact. Absence must never read as success — that is the single failure
 * mode CLAUDE.md says this project actually has ("a capability was absent, and everything reported
 * success"), and reading two-out-of-three as a pass would reproduce it inside the guard written to
 * stop it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };

/* ================================================================================================
 * 1. THE GATE — is MEDICHAM correct?
 * ================================================================================================
 * Two conditions, both read out of artifacts that MEASURE the simulator rather than consume it:
 *
 *   the game differential shows no disagreements with Showdown, and
 *   the deliberate roster shows no FIRED-AND-BOARDS-DIFFER and no DID-NOT-FIRE across the items,
 *   abilities and moves stages.
 *
 * Each clause reports its MAGNITUDE, not a boolean. "false" tells a reader nothing about how far away
 * the lift is, and a gate whose distance cannot be seen is a gate that gets argued with.
 */

/* THE THREE STAGES THAT THE RULE NAMES. `tests/roster.js --stage` also accepts `spine` (its own
 * selftest) and `pairs`; neither is part of the condition, so neither is read here. */
const ROSTER_STAGES = ['items', 'abilities', 'moves'];

/* WHERE A STAGE'S ARTIFACT LIVES, AND WHY THIS TAKES THREE GUESSES RATHER THAN ONE.
 *
 * `tests/roster.js --write` writes `data/roster.json` unconditionally, whatever stage it ran, so the
 * file holds only the NEWEST stage and a second run destroys the first. Reading that one file and
 * calling it three stages would be the "capability absent, everything reports success" failure
 * exactly: two thirds of the condition would be silently satisfied by an artifact that never
 * described them.
 *
 * So a stage is satisfied only by an artifact whose OWN `stage` field names it. Three shapes count,
 * in the order tried:
 *   data/roster.<stage>.json   a per-stage artifact (what a stage-preserving writer would produce)
 *   data/roster.all.json       a `--stage all` run, which covers item, ability and move together
 *   data/roster.json           the shared file, and ONLY when its `stage` field matches
 * Anything else is MISSING, and MISSING FAILS. tests/roster.js is held by another division as this is
 * written, so the per-stage filename is a convention this reader accepts rather than one it imposes. */
function rosterStage(stage) {
  const tried = [];
  for (const f of [`roster.${stage}.json`, 'roster.all.json', 'roster.json']) {
    tried.push('data/' + f);
    const j = readJson(D('data', f));
    if (!j) continue;
    if (j.stage !== stage && j.stage !== 'all') continue;
    const c = j.counts || {};
    const differ = c['FIRED-AND-BOARDS-DIFFER'] || 0;
    const silent = c['DID-NOT-FIRE'] || 0;
    /* A RED THE ROSTER ITSELF DECLARES BAD counts too. `reds` carries the red demonstrations, each
     * with an `ok` flag; a red that did not behave as the rule predicted means the rule is not proven,
     * so the stage's greens are not evidence either. */
    const badReds = (j.reds || []).filter(r => r && r.ok === false).length;
    return {
      stage, file: 'data/' + f, generated: j.generated || null, release: j.engine_release || null,
      differ, silent, badReds, matched: c['FIRED-AND-BOARDS-MATCH'] || 0,
      couldNotStage: c['COULD-NOT-STAGE'] || 0,
      ok: differ === 0 && silent === 0 && badReds === 0,
      why: differ === 0 && silent === 0 && badReds === 0
        ? `clean: ${c['FIRED-AND-BOARDS-MATCH'] || 0} fired and matched`
        : `${differ} FIRED-AND-BOARDS-DIFFER, ${silent} DID-NOT-FIRE`
          + (badReds ? `, ${badReds} red demonstration(s) did not behave as their rule predicted` : ''),
    };
  }
  return {
    stage, file: null, ok: false, missing: true, differ: null, silent: null,
    why: `NO ARTIFACT FOR THIS STAGE — none of ${tried.join(', ')} declares stage "${stage}". `
       + `A missing stage is a FAILING clause, never a passing one: run `
       + `SHOWDOWN_PATH=... node tests/roster.js --stage ${stage} --write`,
  };
}

function differentialClause() {
  const j = readJson(D('data', 'engine-diff.json'));
  if (!j) {
    return { name: 'game differential', ok: false, missing: true,
             why: 'NO ARTIFACT — data/engine-diff.json is absent. Run tests/test-engine-diff.js.' };
  }
  const dis = j.disagreed || 0;
  const worst = (j.worst || [])[0];
  return {
    name: 'game differential', ok: dis === 0, generated: j.generated || null,
    why: dis === 0
      ? `clean: 0 of ${j.compared} comparisons disagree with Showdown (seed ${j.seed})`
      : `${dis} of ${j.compared} comparisons disagree with Showdown`
        + (worst ? ` — worst: ${worst.att} ${worst.mv} -> ${worst.def} (showdown ${worst.showdown}, medicham ${worst.medicham})` : ''),
  };
}

function medichamIsCorrect() {
  const clauses = [differentialClause(), ...ROSTER_STAGES.map(s => {
    const r = rosterStage(s);
    return { ...r, name: `deliberate roster / ${s}` };
  })];
  return { ok: clauses.every(c => c.ok), clauses, failing: clauses.filter(c => !c.ok) };
}

/* ================================================================================================
 * 2. THE MEMBERSHIP TEST — what is downstream of MEDICHAM
 * ================================================================================================
 * DERIVED FROM ONE ROOT, not from a list of filenames. A hand-maintained list of quarantined
 * artifacts would be the hand-maintained-ban-list failure this project's instructions open with, and
 * it would rot the first time somebody adds a model.
 *
 * THE PLAY LAYER is the transitive closure of "requires the simulator", seeded with the single file
 * `engine/medicham2-browser.js`. board.js reaches it through damageEngine(); rollout_leaf, miltank,
 * fit_policy, mag_bot and the rest reach it through board. 63 modules fall out of one root, and a
 * module added tomorrow joins by existing.
 *
 * AN ARTIFACT IS QUARANTINED if its generator is in the play layer, or if it reads a file that a
 * play-layer module wrote, or if it reads another quarantined artifact. The second clause is what
 * catches `data/rollout-r1.json` and `data/rollout-r4.json`, whose generators require nothing at all
 * and simply read a row dump or a self-play store that the play layer produced. A number computed off
 * a dump of MEDICHAM's games is a number MEDICHAM produced, however few modules the reader imports.
 *
 * WHAT IS DELIBERATELY *NOT* QUARANTINED, AND WHY THE STRICT DIRECTION IS THE DANGEROUS ONE.
 * The census, the interaction matrix, the game differential, the deliberate roster and the release
 * ladder MEASURE MEDICHAM. They are the instruments that will say when the quarantine can lift, so
 * withholding them would blind the project to its own exit condition — a quarantine that can never
 * lift is as broken as one that never engages. Most of them fall out on their own: they are written
 * by `tests/` or they drive the official engine through a subprocess or a frozen release, so they
 * never enter the closure. ONE does not, and it is declared below with its reason.
 */

const SIMULATOR = 'engine/medicham2-browser.js';

/* THE ONE THING THE GRAPH CANNOT EXPRESS, DECLARED WITH ITS REASON — the RAW-STORE-OK convention.
 *
 * MEASURED, not assumed: `engine/game_differential.js` and `engine/backtest_winrate.js` have the same
 * graph signature. Both load the simulator, both load Showdown, both play games. The only difference
 * is which QUESTION the artifact answers — the differential's number is "how often do the two engines
 * disagree", which is a measurement OF medicham and is exactly what the gate above reads; the
 * backtest's number is "how good is the leaf", which is a measurement THROUGH medicham. That
 * distinction is not present in either file's source, so no derivation can find it and a declaration
 * is the honest instrument.
 *
 * It is CHECKED rather than trusted: an exemption naming a module that is not in the play layer is a
 * claim that has quietly become false, and `--check` fails on it. That is the same discipline
 * tests/roster.js applies to its own DECLARED divergences ("a declared divergence that matched
 * nothing is a claim that has quietly become false"). */
const MEASURES_THE_ENGINE = [
  { module: 'engine/game_differential.js',
    why: 'MEDICHAM is its SUBJECT, not its input: it drives the official Showdown engine and ours '
       + 'over identical inputs and reports the disagreements. Its value does not depend on MEDICHAM '
       + 'being right — it is how we find out. It is the first clause of the gate above.' },
  { module: 'engine/derive_protocol_events.js',
    why: 'it loads the simulator only to read the event list it CLAIMS it can emit, and checks that '
       + 'claim against Showdown\'s own add() call sites. The artifact is the comparison, not a '
       + 'quantity MEDICHAM computed — and quarantining it would have withheld the game differential '
       + 'downstream of it, which is the gate\'s own first clause.' },
];

function stripComments(s) {
  /* A NAME DISCUSSED IN PROSE IS NOT A DEPENDENCY. provenance.js records the same lesson twice (a
   * comment credited this very file with generating pokemon-roles.json; a comment one file away
   * picked the corpus for winrate-backtest.json). A require inside a comment block is a citation. */
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function sources() {
  const src = {};
  for (const dir of ['engine', 'build']) {
    let list = []; try { list = fs.readdirSync(D(dir)); } catch (e) { continue; }
    for (const f of list) {
      if (!/\.js$/.test(f)) continue;
      try { src[dir + '/' + f] = fs.readFileSync(D(dir, f), 'utf8'); } catch (e) {}
    }
  }
  return src;
}

/* Local module dependencies, in the three spellings this repository actually uses:
 *   require('./board.js')                      the ordinary one
 *   REL.require('engine/board.js')             the frozen-release loader — a real dependency that
 *                                              names the path from the repo root rather than relatively
 *   require(D('engine','board.js'))            occasionally, through the path helper
 * A module reached only by execFileSync is NOT a require: a subprocess is a separate process with its
 * own release, which is precisely how wire_ladder.js orchestrates the differential without inheriting
 * its engine. */
function requiresOf(src, id) {
  const code = stripComments(src[id] || '');
  const out = new Set();
  for (const m of code.matchAll(/require\(\s*['"]\.\/([A-Za-z0-9_.-]+?)(?:\.js)?['"]/g)) out.add('engine/' + m[1] + '.js');
  for (const m of code.matchAll(/\.require\(\s*['"](engine\/[A-Za-z0-9_.-]+\.js)['"]/g)) out.add(m[1]);
  for (const m of code.matchAll(/require\(\s*D\(\s*['"]engine['"]\s*,\s*['"]([A-Za-z0-9_.-]+\.js)['"]/g)) out.add('engine/' + m[1]);
  return [...out].filter(x => src[x]);
}

function playLayer(src) {
  const play = new Set([SIMULATOR]);
  for (let i = 0; i < 32; i++) {
    let grew = false;
    for (const id of Object.keys(src)) {
      if (play.has(id)) continue;
      if (requiresOf(src, id).some(r => play.has(r))) { play.add(id); grew = true; }
    }
    if (!grew) break;
  }
  return play;
}

/* Files a play-layer module WRITES that are not artifacts in the graph — row dumps and self-play game
 * stores. These are MEDICHAM's output in the most literal sense, and a generator that reads one is
 * reporting on games MEDICHAM played. */
function playProducts(src, play) {
  const out = new Set();
  const WRITE = /writeFileSync|createWriteStream|appendFileSync/;
  for (const id of play) {
    for (const ln of stripComments(src[id] || '').split('\n')) {
      if (!WRITE.test(ln)) continue;
      for (const m of ln.matchAll(/['"]([A-Za-z0-9_.\-]+\.jsonl)['"]/g)) out.add(m[1]);
    }
  }
  /* AND EVERY ROW DUMP AND SELF-PLAY STORE ON DISK, because the literal filename is usually not in the
   * writer at all. `rollout_r1.js` resolves its dump from a `DUMP` environment variable and `mew.js`
   * takes its output store as an argument, so scanning writers for string literals finds neither —
   * and those two are exactly the runs behind R1 and R4, the gates whose generators require nothing
   * and simply read what a previous run left behind.
   *
   * THE STORE IS UPSTREAM OF THE SIMULATOR, NOT DOWNSTREAM, and that is the boundary that must not be
   * got wrong in the strict direction. `games.ladder.jsonl`, `games.bo3.jsonl` and `games.ots.jsonl`
   * are HUMAN replays that OPS ingests; nothing MEDICHAM does can change a byte of them, so everything
   * OPS reports out of them — usable %, battles recorded, meta-usage — stays quotable while the gate
   * is closed. They are identified by their INGEST WRITER rather than by name, so a store added by a
   * new collector is exempt for the right reason instead of by spelling. Everything else under data/
   * with a .jsonl extension is something one of our own runs produced. */
  const ingested = new Set();
  /* WHO COLLECTS IS THE AUTHORITY ON WHAT IS COLLECTED. The hourly Action is what actually pulls
   * replays into this repository, so the stores it names are the ones nothing of ours produced.
   * `engine/durable-ingest.js` names none of them — it takes the path as an argument — which is why
   * reading the ingest SCRIPTS alone left `games.bo3.jsonl` classed as one of our own runs and
   * quarantined every OPS figure counted off it. */
  const collectors = ['.github/workflows/ingest.yml'];
  for (const f of fs.existsSync(D('engine')) ? fs.readdirSync(D('engine')) : []) {
    if (/ingest/i.test(f) && /\.(js|py)$/.test(f)) collectors.push('engine/' + f);
  }
  {
    for (const rel of collectors) {
      let s = ''; try { s = fs.readFileSync(D(rel), 'utf8'); } catch (e) { continue; }
      for (const m of stripComments(s).matchAll(/(games\.[A-Za-z0-9_.\-]+?)(?:\.jsonl)\b/g)) {
        /* THE GREEDY CAPTURE ATE THE EXTENSION and produced `games.ladder.jsonl.jsonl`, so NOTHING was
         * ever removed from the product set and every store reader in the repository was quarantined —
         * including data/live.js and data/meta-usage.json, which are OPS's and are explicitly NOT
         * quarantined. Caught by reading the output rather than by trusting the regex. */
        const base = m[1].replace(/\.jsonl$/, '').replace(/\.raw-logs$/, '');
        ingested.add(base + '.jsonl');
        ingested.add(base + '.raw-logs.jsonl');
      }
    }
  }
  let disk = []; try { disk = fs.readdirSync(D('data')); } catch (e) {}
  for (const f of disk) if (/\.jsonl$/.test(f) && !ingested.has(f)) out.add(f);
  for (const f of ingested) out.delete(f);
  return out;
}

/* WHAT MEDICHAM READS IS NOT WHAT MEDICHAM PRODUCED.
 *
 * `data/tags.json`, `data/abra-tags.js` and `data/engine-data.js` are the rulebook and the species
 * table the simulator READS. Their generators require the simulator — `tag_dex.js` uses it to resolve
 * a move's shape — so a naive closure marks them downstream and then drags in everything that reads
 * them, including the game differential itself. That is the strict-direction error CLAUDE.md warns
 * about: it would withhold the tag file the engine is fixed WITH, and the instrument that says when
 * the fixing is done.
 *
 * The set is not typed here. `provenance.js` already derives which files are ENGINE INPUTS — the same
 * list `status.js` reads for the refit edge — and an artifact that IS one, or that one is built FROM,
 * sits upstream of the arrow in docs/DIVISIONS.md rather than to the right of it. */
function engineInputArtifacts(g) {
  const out = new Set();
  try {
    const s = fs.readFileSync(D('engine', 'provenance.js'), 'utf8');
    const m = s.match(/ENGINE_INPUTS\s*=\s*\[([^\]]*)\]/);
    if (!m) return out;
    for (const n of m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)) out.add(n);
  } catch (e) { return out; }
  if (!Array.isArray(g)) return out;
  const by = new Map(g.map(a => [a.file, a]));
  for (let i = 0; i < 16; i++) {
    let grew = false;
    for (const f of [...out]) {
      const a = by.get(f);
      if (!a) continue;
      for (const dep of a.from || []) {
        if (/\.jsonl$/.test(dep) || dep.includes('/')) continue;   // stores and engine sources, not artifacts
        if (!out.has(dep)) { out.add(dep); grew = true; }
      }
    }
    if (!grew) break;
  }
  return out;
}

function graph() {
  /* ONE DERIVATION OF THE ARTIFACT GRAPH, and it is provenance.js's. status.js shells out to
   * provenance.js rather than reimplementing its staleness rules; this does the same for its edges. */
  try {
    return JSON.parse(execFileSync(process.execPath, [D('engine', 'provenance.js'), '--graph', '--json'],
      { encoding: 'utf8', maxBuffer: 1 << 26 }));
  } catch (e) {
    return { error: String((e && e.message) || e).split('\n')[0] };
  }
}

function classify(opts = {}) {
  const src = opts.src || sources();
  const play = opts.play || playLayer(src);
  const exempt = new Map((opts.exemptions || MEASURES_THE_ENGINE).map(e => [e.module, e.why]));
  const products = opts.products || playProducts(src, play);
  const g = opts.graph || graph();
  const staleExemptions = [...exempt.keys()].filter(m => !play.has(m));

  if (g.error) return { error: g.error, play, exempt, staleExemptions };

  const upstream = opts.upstream || engineInputArtifacts(g);
  /* A row dump is almost never in provenance's `from` — that arm tracks .json/.js artifacts and the
   * game stores, not an arbitrary .jsonl — so the generator's own source is asked directly. */
  /* NEAR A READ VERB, exactly as provenance.js does it, and for the reason it learned: a bare
   * substring match turned every filename mentioned anywhere into a dependency and gave one artifact
   * seventeen of them. A dump named in a usage string or an error message is not a dump being read. */
  const READ = /readFileSync|createReadStream|require\s*\(|open\s*\(|read_json|json\.load|loadGames|load_games/;
  const WROTE = /writeFileSync|createWriteStream|appendFileSync|json\.dump/;
  const namesProduct = (id) => {
    const code = stripComments(src[id] || '');
    const hits = [];
    /* A READ VERB IS THE STRONG SIGNAL, AND A BARE MENTION IS THE COMMON ONE. Both R1 and R4 — the two
     * gates this clause exists to catch — bind their input through a default:
     *     const ROWS   = argv.find(a => !a.startsWith('--')) || 'data/rollout-r1-rows.jsonl';
     *     const CORPUS = argv.find(a => !a.startsWith('--')) || 'data/games.r4-decided.jsonl';
     * There is no read verb on either line; the read happens hundreds of lines later through the
     * identifier. Requiring proximity to a read verb found NEITHER, which is how the first version of
     * this file cleared R1 and R4 — the two artifacts CLAUDE.md's quarantine list names first.
     *
     * So a product named in LIVE CODE counts unless this generator is the one that WRITES it: naming a
     * dump you do not write is reading it. Comments are stripped first, so a filename discussed in
     * prose still does not count — the fault provenance.js records twice about itself. */
    for (const p of products) {
      let i = code.indexOf(p), mention = false, written = false;
      while (i >= 0) {
        /* A SUBSTRING IS NOT A FILENAME. `rows.jsonl` is a substring of `rollout-r1-rows.jsonl`, which
         * is provenance.js's `ladder.json` inside `games.ladder.jsonl` fault in a new pair of names —
         * it credited R1 with reading a dump it has never heard of. The character before the match
         * must not continue the name. */
        if (/[A-Za-z0-9_.\-]/.test(code[i - 1] || '')) { i = code.indexOf(p, i + 1); continue; }
        const near = code.slice(Math.max(0, i - 140), i + 60);
        if (WROTE.test(near)) written = true; else mention = true;
        i = code.indexOf(p, i + 1);
      }
      if (mention && !written) hits.push(p);
    }
    return hits;
  };

  const rows = new Map();
  for (const a of g) {
    const consumes = play.has(a.by) && !exempt.has(a.by);
    const reads = (a.from || []).filter(f => products.has(f) || products.has(f.replace(/^data\//, '')));
    const dumps = reads.length ? [] : namesProduct(a.by);
    let reason = null;
    if (upstream.has(a.file)) reason = null;      /* what the simulator READS is upstream of it */
    else if (consumes) reason = `its generator ${a.by} is in the play layer (it reaches ${SIMULATOR} through require)`;
    else if (reads.length) reason = `${a.by} reads ${reads.join(', ')}, which one of our own runs wrote`;
    else if (dumps.length) reason = `${a.by} reads ${dumps.slice(0, 2).join(', ')} — a dump of games MEDICHAM played`;
    rows.set(a.file, { file: a.file, by: a.by, from: a.from || [], quarantined: !!reason, reason,
                       upstream: upstream.has(a.file),
                       exempt: exempt.has(a.by) ? exempt.get(a.by) : null });
  }
  /* TRANSITIVE: an artifact that reads a quarantined artifact carries the quarantine. This is what
   * puts data/weight-multiplicity.json, data/mag.js, data/scoreboard.js and data/ladder.json in the
   * set — they read policy-weights.json, and the weights were fitted on features computed through a
   * simulator we know is wrong. The refit is exactly the event that clears them, and it is gated. */
  for (let i = 0; i < 32; i++) {
    let grew = false;
    for (const r of rows.values()) {
      if (r.quarantined || r.upstream) continue;
      const hit = r.from.find(f => rows.has(f) && rows.get(f).quarantined);
      if (hit) { r.quarantined = true; r.reason = `it reads ${hit}, which is quarantined`; grew = true; }
    }
    if (!grew) break;
  }
  return { rows, play, exempt, staleExemptions, products };
}

/* THE ONE ENTRY POINT EVERY CALLER USES. status.js asks two questions — is the gate open, and is this
 * artifact in the set — and must never grow its own answer to either. */
/* ARTIFACTS THE GRAPH CANNOT SEE AT ALL, reported rather than guessed at.
 *
 * `provenance.js` derives the graph by finding a WRITER in engine/ or build/. An artifact written by
 * `tests/` — the census, the differential, the interaction matrix, the deliberate roster — has no row,
 * and neither does one whose writer resolves its output path through a variable this repository's
 * detectors do not follow (`data/rollout-r1-explore1.json`, the arm MILTANK actually runs).
 *
 * THEY ARE NOT DEFAULTED EITHER WAY, and that is deliberate. The unclassified set holds both
 * instruments (the census) and consumers (`exploitability-mag.json`, seven `policy-weights-*.json`
 * variants), so defaulting to CLEAN hides a withheld figure and defaulting to HELD withholds the
 * instrument that says when the quarantine lifts. An unknown that is silently resolved either way is
 * the failure this whole file exists to stop, so it is printed as an unknown. */
function unclassified(rows) {
  const out = [];
  let disk = []; try { disk = fs.readdirSync(D('data')); } catch (e) { return out; }
  for (const f of disk) {
    if (!/\.(json|js)$/.test(f) || /^games\./.test(f) || /\.meta\.json$/.test(f)) continue;
    if (!rows || !rows.has(f)) out.push(f);
  }
  return out;
}

/* WITHHOLD is the question a caller actually has, and it is deliberately ONE function rather than two
 * facts a caller has to combine — combining them wrongly (printing while the gate is closed) is the
 * only way left to reintroduce the bug this file closes.
 *
 * IT TAKES THE GATE AS AN ARGUMENT so the selftest can drive the REAL function with a passing gate and
 * with a failing one. A `--force-open` flag would have done the same job and would have been a hole:
 * anything that can silence this from the command line eventually does, which is why provenance.js's
 * `void` is one-way and has no `valid: true`. A parameter is visible in the caller; a flag is not. */
function withholder(gate, rows) {
  const set = new Set();
  if (rows) for (const r of rows.values()) if (r.quarantined) set.add(r.file);
  const fn = function withhold(file) {
    if (gate.ok) return null;
    const f = String(file).replace(/^data\//, '');
    if (!set.has(f)) return null;
    const r = rows && rows.get(f);
    return {
      file: 'data/' + f,
      because: r ? r.reason : 'downstream of ' + SIMULATOR,
      rerun: r ? `node ${r.by}` : null,
      /* THE CLAUSE SUMMARY IS A COUNT, NOT THE FIRST CLAUSE'S PROSE. Repeating one clause's full
       * sentence under every withheld line printed the same 150 characters six times and buried the
       * fact that the other three clauses fail too. The banner carries the detail once. */
      clause: `${gate.failing.length} of ${gate.clauses.length} gate clauses fail `
            + `(${gate.failing.map(c => c.name).join('; ')})`,
    };
  };
  fn.set = set;
  return fn;
}

let CACHE = null;
function state() {
  if (CACHE) return CACHE;
  const gate = medichamIsCorrect();
  const c = classify();
  const withhold = withholder(gate, c.rows);
  CACHE = {
    ok: gate.ok, gate, rows: c.rows, error: c.error, play: c.play,
    staleExemptions: c.staleExemptions || [],
    unclassified: unclassified(c.rows),
    withhold,
    set: withhold.set,
  };
  return CACHE;
}

module.exports = { medichamIsCorrect, classify, state, withholder, playLayer, sources, requiresOf,
                   MEASURES_THE_ENGINE, ROSTER_STAGES, rosterStage, SIMULATOR };

/* ================================================================================================
 * 3. CLI — report, derivation, gate, selftest
 * ============================================================================================== */
if (require.main === module) {
  const ARG = process.argv.slice(2);
  const has = f => ARG.includes(f);

  /* ---- SELFTEST: shown RED on a deliberately-quarantined figure before it is trusted -------------
   * `.githooks/pre-commit` was demonstrated red on a deliberate break before it was armed, and
   * `status.js --selftest` exists because `refit edge: CLEAN` printed for two days over a contrast
   * that had measured three columns moving. A gate that has only ever been green is not evidence.
   *
   * Both directions are driven. The RED cases prove the quarantine engages; the LIFT cases prove it
   * disengages, because a quarantine that can never lift is as broken as one that never fires. */
  if (has('--selftest')) {
    let bad = 0, ran = 0;
    /* THE TOTAL IS COUNTED, NOT TYPED. The first draft printed a literal 19 beside 18 cases — a
     * hand-maintained number inside the guard written against hand-maintained numbers. */
    const ok = (name, cond, got) => {
      ran++;
      if (!cond) bad++;
      console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : '   got ' + JSON.stringify(got)}`);
    };

    /* -- the gate's clauses, on synthetic artifacts ------------------------------------------- */
    const stage = (counts, reds) => ({ counts, reds: reds || [] });
    const clause = j => {
      const c = j.counts || {};
      const differ = c['FIRED-AND-BOARDS-DIFFER'] || 0, silent = c['DID-NOT-FIRE'] || 0;
      const badReds = (j.reds || []).filter(r => r && r.ok === false).length;
      return differ === 0 && silent === 0 && badReds === 0;
    };
    ok('a stage with 2 DIFFER and 4 DID-NOT-FIRE fails',
      !clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 2, 'DID-NOT-FIRE': 4 })));
    ok('a clean stage passes', clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 0, 'DID-NOT-FIRE': 0, 'FIRED-AND-BOARDS-MATCH': 31 })));
    ok('a clean stage with a FAILED red demonstration still fails',
      !clause(stage({ 'FIRED-AND-BOARDS-DIFFER': 0, 'DID-NOT-FIRE': 0 }, [{ ok: false }])));
    /* THE CASE THE WHOLE FILE TURNS ON. A stage with no artifact must FAIL, not pass by absence. */
    const missing = rosterStage('__no_such_stage__');
    ok('a MISSING stage is a FAILING clause, not a passing one', missing.ok === false && missing.missing === true, missing);

    /* -- membership, on a synthetic source tree ------------------------------------------------ */
    const src = {
      'engine/medicham2-browser.js': 'module.exports={battle}',
      'engine/board.js': "const M=require('./medicham2-browser.js');",
      'engine/rollout_leaf.js': "const B=require('./board.js');",
      'engine/consumer.js': "const L=require('./rollout_leaf.js'); fs.writeFileSync('data/consumer.json',x)",
      'engine/instrument.js': "const R=require('./board.js'); // drives both engines",
      'engine/dumper.js': "const L=require('./rollout_leaf.js'); fs.writeFileSync('rows.jsonl',x)",
      'engine/reader.js': "JSON.parse(fs.readFileSync('rows.jsonl'))",
      'engine/store_only.js': "const Q=require('./quality.js');",
      /* A NAME IN A COMMENT IS NOT A REQUIRE — the fault provenance.js records twice. */
      'engine/prose.js': "/* this one day may require('./board.js') */ const x=1;",
    };
    const play = playLayer(src);
    ok('the play layer reaches board.js from the simulator', play.has('engine/board.js'));
    ok('the play layer reaches rollout_leaf.js transitively', play.has('engine/rollout_leaf.js'));
    ok('a store-only generator is NOT in the play layer', !play.has('engine/store_only.js'));
    ok('a require inside a COMMENT does not taint', !play.has('engine/prose.js'));
    ok('a play-layer row dump is detected', playProducts(src, play).has('rows.jsonl'));

    const g = [
      { file: 'consumer.json', by: 'engine/consumer.js', from: [] },
      { file: 'instrument.json', by: 'engine/instrument.js', from: [] },
      { file: 'reader.json', by: 'engine/reader.js', from: ['rows.jsonl'] },
      { file: 'downstream.json', by: 'engine/store_only.js', from: ['consumer.json'] },
      { file: 'clean.json', by: 'engine/store_only.js', from: [] },
    ];
    const c = classify({ src, play, graph: g,
      exemptions: [{ module: 'engine/instrument.js', why: 'it drives both engines' }] });
    const q = f => c.rows.get(f).quarantined;
    ok('a play-layer generator is QUARANTINED', q('consumer.json'));
    ok('a DECLARED instrument is not', !q('instrument.json'));
    ok('a generator reading a play-layer row dump is QUARANTINED', q('reader.json'));
    ok('an artifact reading a quarantined artifact is QUARANTINED (transitive)', q('downstream.json'));
    ok('a store-only artifact is NOT quarantined', !q('clean.json'));
    ok('an exemption naming a module outside the play layer is reported STALE',
      classify({ src, play, graph: g, exemptions: [{ module: 'engine/nope.js', why: 'x' }] })
        .staleExemptions.length === 1);

    /* -- WITHHOLDING, both directions, THROUGH THE REAL FUNCTION -------------------------------
     * The first draft of this block wrote its own two-line withhold() and asserted against that,
     * which proves the test can implement a quarantine and says nothing about the one that ships.
     * `withholder` is the function `state()` hands to status.js; only the GATE differs between the
     * two cases below, which is exactly the variable under test. */
    const CLOSED = { ok: false, clauses: [{}, {}], failing: [{ name: 'game differential' }] };
    const OPEN = { ok: true, clauses: [{}, {}], failing: [] };
    const wClosed = withholder(CLOSED, c.rows), wOpen = withholder(OPEN, c.rows);
    ok('RED — with the gate closed, a quarantined figure is withheld', !!wClosed('data/consumer.json'));
    ok('the withheld line carries the reason and what re-runs it',
      !!(wClosed('data/consumer.json').because && wClosed('data/consumer.json').rerun), wClosed('data/consumer.json'));
    ok('a NON-quarantined figure is never withheld', !wClosed('data/clean.json'));
    /* THE NEGATIVE, AND IT MATTERS AS MUCH AS THE POSITIVE. A quarantine that can never lift is as
     * broken as one that never engages: the same artifact, the same classification, gate open. */
    ok('LIFT — with the gate open, the same figure is released', !wOpen('data/consumer.json'));
    ok('LIFT — with the gate open, NOTHING is withheld',
      [...wOpen.set].every(f => !wOpen('data/' + f)));

    console.log(`\nQUARANTINE SELFTEST: ${ran - bad} passed, ${bad} failed`);
    process.exit(bad ? 1 : 0);
  }

  const S = state();

  if (has('--graph')) {
    console.log('QUARANTINE DERIVATION — nothing here is typed; the root is ' + SIMULATOR + '\n');
    console.log(`  play layer: ${S.play.size} modules reach the simulator through require`);
    for (const e of MEASURES_THE_ENGINE) console.log(`  DECLARED INSTRUMENT: ${e.module}\n    ${e.why.replace(/\s+/g, ' ')}`);
    console.log('');
    if (S.error) { console.log('  GRAPH UNAVAILABLE: ' + S.error); process.exit(1); }
    const pad = (s, n) => String(s).padEnd(n);
    console.log('  ' + pad('artifact', 34) + pad('', 6) + 'why');
    console.log('  ' + '-'.repeat(110));
    for (const r of [...S.rows.values()].sort((a, b) => a.file.localeCompare(b.file))) {
      console.log('  ' + pad(r.file, 34) + pad(r.quarantined ? 'HELD' : 'ok', 6) +
        (r.quarantined ? r.reason : (r.exempt ? 'DECLARED INSTRUMENT' : 'not downstream of the simulator')));
    }
    process.exit(0);
  }

  console.log('');
  console.log('QUARANTINE — everything downstream of MEDICHAM is withheld until MEDICHAM is correct');
  console.log('');
  console.log(`  GATE: ${S.ok ? 'OPEN — MEDICHAM passes both conditions; nothing is withheld'
                              : 'CLOSED — ' + S.gate.failing.length + ' of ' + S.gate.clauses.length + ' clauses fail'}`);
  for (const c of S.gate.clauses) console.log(`    ${c.ok ? 'PASS' : 'FAIL'}  ${pad2(c.name, 30)} ${c.why.replace(/\s+/g, ' ')}`);
  if (S.staleExemptions.length) {
    console.log('');
    console.log('  STALE EXEMPTION — a declared instrument that is no longer in the play layer:');
    for (const m of S.staleExemptions) console.log('    ' + m);
  }
  console.log('');
  if (S.error) {
    console.log('  THE ARTIFACT GRAPH COULD NOT BE READ: ' + S.error);
    console.log('  Nothing can be classified, so nothing is cleared. Fix engine/provenance.js first.');
    process.exitCode = 1;
  } else {
    const held = [...S.rows.values()].filter(r => r.quarantined).sort((a, b) => a.file.localeCompare(b.file));
    console.log(`  ${held.length} of ${S.rows.size} artifacts are downstream of MEDICHAM and are WITHHELD:`);
    for (const r of held) console.log('    data/' + pad2(r.file, 34) + ' re-run: node ' + r.by);
    console.log('');
    console.log('  Re-running is not optional once the gate opens. A quarantined number does not become');
    console.log('  true when MEDICHAM becomes correct; it becomes re-runnable. ROADMAP #57.');
    if (S.unclassified.length) {
      console.log('');
      console.log(`  ${S.unclassified.length} artifact(s) on disk have NO ROW IN THE GRAPH and are neither cleared`);
      console.log('  nor withheld — provenance.js finds a writer only in engine/ and build/, so anything');
      console.log('  written by tests/ or through an unfollowed path variable is invisible to this test.');
      console.log('  The set holds instruments AND consumers, so it cannot be defaulted either way:');
      for (const f of S.unclassified) console.log('    ' + f);
    }
  }
  console.log('');

  /* ---- THE GATE ---------------------------------------------------------------------------------
   * Fails when a quarantined FIGURE is being printed. The check is on `status.js`, because that is the
   * one command every session is required to run first and therefore the one place a withheld number
   * would be read from. It re-runs status.js and asserts two things at once: the withheld artifact's
   * own verdict string does not appear, and the word QUARANTINED does.
   *
   * IT DOES NOT GATE ON docs/ OR web/. Those are other divisions' files — WEB may not author a number
   * and MEASURE may not edit web/ — so failing on them would leave a gate that cannot be satisfied by
   * the division that owns it, which CLAUDE.md names as how a red check becomes "one of the known
   * failures". They are REPORTED instead, in full, every run. */
  if (has('--check')) {
    let fail = 0;
    /* THE CLASSIFIER IS PROVED BEFORE THE TREE IS JUDGED. --check asks whether a real leak exists; if
     * the classifier underneath it is broken, "no leak" is the answer it returns either way. Running
     * the selftest here rather than registering the file twice in tests/run-all.js keeps one entry and
     * makes the dependency explicit: a red selftest is a red gate. */
    try {
      execFileSync(process.execPath, [__filename, '--selftest'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      console.log('QUARANTINE CHECK: the selftest is RED, so this gate cannot be believed:');
      console.log(String((e && e.stdout) || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
      fail++;
    }
    if (S.staleExemptions.length) {
      console.log('QUARANTINE CHECK: a declared instrument exemption names a module that is not in the');
      console.log('play layer. The claim has quietly become false — remove it or find out why.');
      fail++;
    }
    if (S.error) { console.log('QUARANTINE CHECK: the artifact graph could not be read — ' + S.error); fail++; }

    if (!S.ok && !S.error) {
      let out = '';
      try {
        out = execFileSync(process.execPath, [D('engine', 'status.js')],
          { encoding: 'utf8', maxBuffer: 1 << 26 });
      } catch (e) { out = (e && (e.stdout || '')) || ''; }
      if (!out) {
        console.log('QUARANTINE CHECK: engine/status.js produced no output, so nothing could be checked.');
        fail++;
      } else {
        /* A VERDICT STRING IS THE FIGURE. Every quarantined artifact that carries one carries its whole
         * headline in it — "MILTANK takes 55.5% of 535 DECISIVE PAIRS", "is WORSE than a coin on Brier
         * (paired +0.0502...)". If that sentence is on the screen, the number was not withheld. This is
         * a stronger test than looking for a bare number: it is the exact text a reader would quote. */
        const leaked = [];
        for (const r of S.rows.values()) {
          if (!r.quarantined) continue;
          const j = readJson(D('data', r.file));
          if (!j) continue;
          for (const k of ['verdict', 'headline', 'summary']) {
            const v = j[k];
            if (typeof v !== 'string' || v.length < 24) continue;
            const probe = v.slice(0, 60);
            if (out.includes(probe)) leaked.push(`data/${r.file} (${k}): ${probe}...`);
          }
        }
        if (leaked.length) {
          console.log('QUARANTINE CHECK FAILED — engine/status.js is printing a QUARANTINED figure:');
          for (const l of leaked) console.log('  ' + l);
          console.log('  A caption is not a quarantine. Withhold the number; print what would re-run it.');
          fail++;
        }
        if (!/QUARANTINED/.test(out)) {
          console.log('QUARANTINE CHECK FAILED — the gate is CLOSED and engine/status.js never says');
          console.log('  QUARANTINED. Either the withholding is not wired, or it silently did nothing.');
          fail++;
        }
      }
    }

    /* ---- WHERE A WITHHELD NUMBER IS STILL CITED — reported, ratcheted, never edited from here ---- */
    const cites = citations(S);
    const stampPath = D('data', 'quarantine-stamp.json');
    const prev = readJson(stampPath);
    const nowList = cites.map(c => c.where).sort();
    const prevList = prev && Array.isArray(prev.citation_sites) ? prev.citation_sites : null;
    const added = prevList ? nowList.filter(f => !prevList.includes(f)) : [];
    if (cites.length) {
      console.log(`  ${cites.length} file(s) outside engine/ still quote a QUARANTINED artifact's verdict:`);
      for (const c of cites) console.log(`    ${c.where}  <- data/${c.file}`);
      console.log('  These are not edited from here — docs/ and web/ belong to other divisions, and a');
      console.log('  gate its owner cannot satisfy becomes a "known failure". RATCHETED instead.');
    }
    if (prevList && added.length) {
      console.log('');
      console.log(`  CITATION RATCHET BROKEN: ${added.length} NEW place(s) quote a withheld number —`);
      for (const f of added) console.log('    ' + f);
      console.log('  This list may shrink and may never grow while the gate is closed.');
      fail++;
    }
    try {
      fs.writeFileSync(stampPath, JSON.stringify({
        note: 'RATCHET. citation_sites may SHRINK and may never grow while the MEDICHAM quarantine is '
            + 'closed. A new entry means a withheld figure was just published somewhere.',
        /* STAMPED, BECAUSE AN UNSTAMPED NEW ARTIFACT BREAKS provenance.js's OWN RATCHET — and it did,
         * on the first run of this file: `RATCHET BROKEN: 1 artifact newly rests on mtime alone —
         * quarantine-stamp.json`. That ratchet may shrink and may never grow, and a gate that adds a
         * red row while installing itself is the "known failure" pattern arriving with the guard.
         * The two files whose CONTENT decides everything in here are the classifier and the graph it
         * reads; run_stamp owns the digest format so there is not a second one. */
        source_digests: (() => {
          try { return require('./run_stamp.js').sourceDigests(['engine/quarantine.js', 'engine/provenance.js']); }
          catch (e) { return undefined; }
        })(),
        not_store_derived: 'it records which artifacts are downstream of the simulator and where they '
            + 'are still cited. No game is counted anywhere in it, so the quality filter has no bearing.',
        gate_open: S.ok,
        failing_clauses: S.gate.failing.map(c => c.name),
        quarantined: [...S.set].sort(),
        citation_sites: nowList,
        generated: new Date().toISOString(),
      }, null, 2) + '\n');
    } catch (e) { console.log('  (could not write data/quarantine-stamp.json: ' + e.message + ')'); }

    console.log('');
    console.log(`QUARANTINE CHECK: ${fail ? fail + ' failure(s)' : 'clean — no withheld figure is being printed'}`);
    process.exit(fail ? 1 : 0);
  }
}

function pad2(s, n) { return String(s).padEnd(n); }

/* Where a quarantined artifact's headline sentence still appears outside engine/. Reported so the
 * list of places already citing a number they should not is a MEASUREMENT rather than a memory. */
function citations(S) {
  const out = [];
  if (!S.rows) return out;
  const probes = [];
  for (const r of S.rows.values()) {
    if (!r.quarantined) continue;
    const j = readJson(D('data', r.file));
    if (!j) continue;
    for (const k of ['verdict', 'headline', 'summary']) {
      const v = j[k];
      if (typeof v === 'string' && v.length >= 30) probes.push({ file: r.file, probe: v.slice(0, 50) });
    }
  }
  if (!probes.length) return out;
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let list = []; try { list = fs.readdirSync(D(dir), { withFileTypes: true }); } catch (e) { return; }
    for (const e of list) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (!/^(node_modules|\.git|releases|_inbox)$/.test(e.name)) walk(rel, depth + 1); continue; }
      if (!/\.(md|html|js)$/.test(e.name)) continue;
      let s = ''; try { s = fs.readFileSync(D(rel), 'utf8'); } catch (e2) { continue; }
      for (const p of probes) if (s.includes(p.probe)) out.push({ where: rel, file: p.file });
    }
  };
  walk('docs', 0); walk('web', 0);
  return out;
}
