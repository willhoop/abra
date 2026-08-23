/* orient.js — WHAT IS THIS PROJECT, AND WHAT DID THE LAST SESSION LEAVE HALF-DONE?
 *
 *   node engine/orient.js              # the whole map
 *   node engine/orient.js --owed-all   # every OWED, NOT RUN block, not just the newest
 *
 * ================= WHY THIS EXISTS ==================================================================
 *
 * Will, 2026-08-23: *"MAKE IT DYNAMIC SO IT AUTO UPDATES AS THE PROJECT PROGRESSES. I WANT THIS
 * BULLETPROOF AND NOT JUST A SNAPSHOT."* and *"I WANT A NEW SESSION TO BE CAUGHT UP TO SPEED ON
 * EVERYTHING."*
 *
 * A long session is a LIABILITY — it eats the machine's RAM and degrades the coordinator. So ending one
 * early has to be cheap, which means a brand-new session must be able to reach the same capability from
 * a print. This is the orientation half of that print: what the project IS and what is IN FLIGHT.
 * `status.js` is the state half and `open_work.js` is the work half; neither answers "what is this".
 *
 * IT WAS GOING TO BE A HAND-WRITTEN SECTION IN `.claude/skills/start/SKILL.md`, AND THAT WAS THE BUG.
 * A written map of this repository is a snapshot, and this project's most expensive and most repeated
 * failure is prose kept past the thing it described: the hand-typed handoff files, the ban list of four,
 * the auto-commit described in the present tense for twelve days, CLAUDE.md's own "twenty-three files
 * are frozen" when SOURCES held twenty-five, and DIVISIONS.md still reading "Four divisions" in two
 * places after WEB was added. A section listing the divisions would have been wrong the same way, on
 * the same day someone added the sixth.
 *
 * SO EVERY LINE BELOW IS DERIVED AT RUN TIME, and the derivation is ranked by how bulletproof it is:
 *
 *   1. THE REQUIRE GRAPH   — the invalidation graph and the play layer are COMPUTED from actual
 *                            `require()` edges, via engine/quarantine.js's own `requiresOf` and
 *                            `SIMULATOR`. Not asserted, and shared with the gate so the two cannot
 *                            disagree.
 *   2. THE FILESYSTEM      — which divisions exist is `.claude/agents/*.md`, not a list. Add a division
 *                            and it appears here with no edit to this file. That is the WEB lesson.
 *   3. DECLARED REGISTRIES — `SOURCES` in engine/engine_release.js for the frozen set.
 *   4. PROSE, LAST         — and only ever for the ONE-LINE INTENT of a thing (what question a model
 *                            answers, out of docs/MODELS.md). Anything parsed out of prose is the
 *                            fragile part, and every prose parser here says what shape it keys on.
 *
 * ================= IT ANSWERS "WHAT AND WHERE", NEVER "HOW MUCH" ====================================
 *
 * Same rule as where.js: this reports STRUCTURE. It will tell you that MEASURE owns whether a number
 * can be believed and that `docs/MEASURE.md` is its ledger; it will not tell you what any number is.
 * Counts printed below are counts OF THE MAP — how many divisions, how many modules downstream of the
 * simulator — and they exist so that a silent drop is visible as a number moving. They are not project
 * results, and none of them is a gate. `status.js` computes the gate.
 *
 * ================= THE OWED SECTION COLLECTS COMMANDS, NEVER FINDINGS ===============================
 *
 * `docs/_reports/` is historical by construction. CLAUDE.md: *"never maintained, never cited as current
 * state, superseded by the register rows it feeds."* So the IN FLIGHT section below extracts only
 * STILL-ACTIONABLE COMMAND LINES out of each report's `OWED, NOT RUN` block — things a next session can
 * run. It must NEVER surface a finding, a number or a conclusion out of one of those files.
 *
 * DO NOT "IMPROVE" THIS INTO A FINDINGS DIGEST. That would rebuild the fourteen stale handoffs out of
 * thirty newer files, and it would read as current state because the generator printed it.
 *
 * ================= BULLETPROOF MEANS IT FAILS LOUDLY ================================================
 *
 * CLAUDE.md: *"A capability that cannot prove it ran is assumed broken."* Every serious bug this project
 * has had was a capability going absent while everything reported success. So:
 *
 *   - a section that cannot derive prints `CANNOT DERIVE: <SECTION> — <reason>` and the run EXITS 1.
 *     It never prints a blank, never a cached value, and never quietly omits itself. A map that
 *     silently drops ENGINE reads as "there are four divisions", which is precisely the failure.
 *   - everything enumerated prints a COUNT, so a silent drop shows up as a number moving.
 *   - anything the parsers could not classify is NAMED, not skipped.
 *   - `ORIENT_BREAK=<section>` blanks one section's input on purpose, so the test can show this red.
 *     Same convention as the engine's `MEDI_*` knobs: the defect stays reachable so the check that
 *     catches it can be demonstrated failing.
 *
 * ================= THE CLASS OF FRAGILITY THIS STILL HAS ============================================
 *
 * Sections 1, 5 and 7 parse PROSE, and a parser keyed to a shape catches that shape and nothing else —
 * the same class as the species-key ratchet that scanned for known-bad spellings and missed a new one.
 * Concretely: MODELS keys on a `**Job:**` line or a row of the per-turn pipeline table, and OWED keys
 * on a heading containing the word OWED. A model documented some third way, or a report that spells its
 * unfinished work differently, IS MISSED — so both sections print how many candidates they could not
 * classify and name them. That is the mitigation, and it is weaker than a derivation. Sections 2, 3, 4
 * and 6 do not have this problem because they read the filesystem, the require graph and a registry.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const argv = process.argv.slice(2);
const OWED_ALL = argv.includes('--owed-all');

/* ORIENT_BREAK names the ONE section whose input is blanked, so the test can prove each failure path
 * is real rather than assuming the fail() calls are reachable. */
const BREAK = (process.env.ORIENT_BREAK || '').toLowerCase();
const broken = s => BREAK === s;

/* AN UNREADABLE FILE IS SAID OUT LOUD. Every consumer here spells `rd(x) || ''`, so a silent null
 * renders as an EMPTY ledger — a map that reads "nothing to report" because it could not read. */
const rd = f => {
  try { return fs.readFileSync(f, 'utf8'); }
  catch (e) { console.error('  !! orient: could not read ' + f + ' (' + e.code + ') — anything derived '
    + 'from it below reads as EMPTY rather than as absent'); return null; }
};
const ageOf = f => {
  try {
    const h = (Date.now() - fs.statSync(f).mtimeMs) / 36e5;
    return h < 48 ? h.toFixed(1) + 'h' : (h / 24).toFixed(1) + 'd';
  } catch (e) { return 'NO SUCH FILE'; }
};

const FAILURES = [];
function fail(section, reason) {
  FAILURES.push(section);
  console.log('  !! CANNOT DERIVE: ' + section + ' — ' + reason);
}
const head = (n, t) => console.log('\n' + n + '. ' + t + '\n' + '-'.repeat(74));

/* Pull the body of one markdown `## ` heading. Keyed on the heading TEXT, so a renamed heading is a
 * CANNOT DERIVE rather than a blank — that is the point. */
function mdSection(md, headingRe) {
  if (md == null) return null;
  const lines = md.split('\n');
  const i = lines.findIndex(l => /^##\s/.test(l) && headingRe.test(l));
  if (i < 0) return null;
  const out = [];
  for (let j = i + 1; j < lines.length && !/^##\s/.test(lines[j]); j++) out.push(lines[j]);
  const body = out.join('\n').trim();
  return body || null;
}

console.log('ABRA — ORIENTATION MAP. Derived at run time; nothing here is typed.');
console.log('Structure only. The STATE is `node engine/status.js`; the WORK is `node engine/open_work.js`.');

/* ---- 1. WHAT ABRA IS ---------------------------------------------------------------------------
 * PROSE PARSER. Keys on two CLAUDE.md headings. Rank-4 source, used only for intent. */
head(1, 'WHAT ABRA IS  [source: CLAUDE.md, prose]');
{
  const md = broken('abra') ? '' : rd(D('CLAUDE.md'));
  if (md == null) fail('WHAT ABRA IS', 'CLAUDE.md is unreadable');
  else {
    const what = mdSection(md, /What ABRA is/i);
    const principle = mdSection(md, /principle that governs the data/i);
    if (!what) fail('WHAT ABRA IS', 'no "## What ABRA is" heading in CLAUDE.md — renamed or removed');
    else console.log(what.replace(/\n/g, '\n'));
    if (!principle) fail('WHAT ABRA IS', 'no "## The one principle that governs the data" heading');
    else console.log('\n' + principle.split('\n').slice(0, 3).join('\n'));
    console.log('\n  [CLAUDE.md age ' + ageOf(D('CLAUDE.md')) + ']');
  }
}

/* ---- 2. THE DIVISIONS --------------------------------------------------------------------------
 * FILESYSTEM. The division list IS `.claude/agents/*.md`. Nothing here is typed, so a sixth division
 * appears the day its agent file does. Its question comes from the agent's own `description:`, which
 * is a declared registry rather than prose; its hands come from `tools:`, which is the restriction
 * that is actually enforced. */
head(2, 'THE DIVISIONS  [source: .claude/agents/, filesystem + frontmatter]');
{
  const dir = D('.claude', 'agents');
  let files = [];
  try { files = broken('divisions') ? [] : fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort(); }
  catch (e) { files = []; }
  if (!files.length) fail('THE DIVISIONS', '.claude/agents/ holds no agent definitions — a map with no divisions is not a map');
  else {
    let noLedger = 0;
    for (const f of files) {
      const md = rd(path.join(dir, f)) || '';
      const name = (md.match(/^name:\s*(.+)$/m) || [, path.basename(f, '.md')])[1].trim();
      const desc = (md.match(/^description:\s*(.+)$/m) || [, ''])[1].trim();
      const tools = (md.match(/^tools:\s*(.+)$/m) || [, ''])[1].trim();
      const ledger = D('docs', name.toUpperCase() + '.md');
      const hasLedger = fs.existsSync(ledger);
      if (!hasLedger) noLedger++;
      const readOnly = tools && !/\b(Write|Edit|Bash)\b/.test(tools);
      console.log('  ' + name.toUpperCase().padEnd(8) + (readOnly ? '[READ-ONLY] ' : '') +
                  desc.split(/\.\s/)[0]);
      console.log('           ledger docs/' + name.toUpperCase() + '.md' +
                  (hasLedger ? ' (age ' + ageOf(ledger) + ')' : '  <-- MISSING'));
    }
    console.log('\n  ' + files.length + ' divisions, ' + (files.length - noLedger) + ' with a ledger.');
    if (noLedger) fail('THE DIVISIONS', noLedger + ' division(s) have no docs/<NAME>.md ledger');
    console.log('  Routing question — WHICH ARTIFACT DOES FIXING THIS INVALIDATE? Spans two: run the');
    console.log('  UPSTREAM one first. See docs/DIVISIONS.md and the start skill §5.');
  }
}

/* ---- 3. THE INVALIDATION GRAPH -----------------------------------------------------------------
 * REQUIRE GRAPH — the most bulletproof source available. Computed from real `require()` edges through
 * quarantine.js's own `requiresOf`, so the gate and the map cannot disagree about what is downstream.
 * Layer N is "reachable from the simulator in N require hops", which is exactly what invalidation
 * means: change the simulator and every one of these is measuring something else. */
head(3, 'THE INVALIDATION GRAPH  [source: the require graph, computed]');
let SRC = null, PLAY = null;
{
  let Q = null;
  try { Q = require('./quarantine.js'); } catch (e) { Q = null; }
  if (!Q || typeof Q.requiresOf !== 'function' || !Q.SIMULATOR) {
    fail('THE INVALIDATION GRAPH', 'engine/quarantine.js did not export requiresOf/SIMULATOR');
  } else {
    SRC = broken('graph') ? {} : Q.sources();
    const ids = Object.keys(SRC || {});
    if (ids.length < 2) fail('THE INVALIDATION GRAPH', 'the source reader returned ' + ids.length + ' modules');
    else {
      const dependents = {};
      for (const id of ids) for (const d of Q.requiresOf(SRC, id)) (dependents[d] = dependents[d] || []).push(id);
      let layer = [Q.SIMULATOR], seen = new Set(layer), depth = 0;
      console.log('  L0  ' + Q.SIMULATOR + '   (the simulator — everything below is downstream OF IT)');
      while (layer.length && depth < 32) {
        const next = [];
        for (const id of layer) for (const dep of (dependents[id] || [])) if (!seen.has(dep)) { seen.add(dep); next.push(dep); }
        if (!next.length) break;
        depth++;
        const hubs = next.slice().sort((a, b) => (dependents[b] || []).length - (dependents[a] || []).length);
        console.log('  L' + depth + '  ' + String(next.length).padStart(3) + ' modules   hubs: ' +
                    hubs.slice(0, 4).map(x => x.replace('engine/', '')).join(', '));
        layer = next;
      }
      PLAY = seen;
      if (seen.size < 2) fail('THE INVALIDATION GRAPH', 'nothing is downstream of the simulator — the require parser found no edges');
      console.log('\n  ' + seen.size + ' of ' + ids.length + ' modules are downstream of the simulator by require.');
      console.log('  IT IS ONE-WAY. That is why dividing is worth doing, and why a wrong simulator does');
      console.log('  not stay in ENGINE: every figure downstream was measured under an engine that does');
      console.log('  not play this game. Those figures are QUARANTINED — WITHHELD, never captioned.');
      console.log('  The gate is COMPUTED, not decided: `node engine/status.js` says which clause fails.');
    }
  }
}

/* ---- 4. WHAT PLAYS A GAME ----------------------------------------------------------------------
 * REQUIRE GRAPH again. This is the concurrency rule the whole scheduling discipline rests on: several
 * agents at once is the POINT of the divisions, but only one may play a game. Deriving the list means
 * a new heavy entrypoint is covered by the rule the day it is written. An entrypoint is a play-layer
 * module with a `require.main === module` block. */
head(4, 'WHAT PLAYS A GAME — only ONE of these may run at a time  [computed]');
{
  if (!SRC || !PLAY) fail('WHAT PLAYS A GAME', 'the require graph above did not derive, so this cannot');
  else {
    const entry = [...PLAY].filter(id => /require\.main\s*===\s*module/.test(SRC[id] || '')).sort();
    if (!entry.length) fail('WHAT PLAYS A GAME', 'no runnable entrypoint is downstream of the simulator');
    else {
      for (let i = 0; i < entry.length; i += 3) {
        console.log('  ' + entry.slice(i, i + 3).map(x => x.replace('engine/', '').padEnd(28)).join(''));
      }
      console.log('\n  ' + entry.length + ' runnable entrypoints load the simulator. Everything else (register rows,');
      console.log('  docs, the registry) is safely parallel. Heavy runs go through tools\\lownode.cmd.');
    }
  }
}

/* ---- 5. THE MODELS -----------------------------------------------------------------------------
 * PROSE PARSER, and the most fragile section here. Two shapes, both from docs/MODELS.md:
 *   - a row of the per-turn pipeline table (`| 3 | **MILTANK** | what happens if we play it out? |`)
 *   - a `**Job:**` line under a `## CODENAME` heading
 * A model documented a third way is MISSED, so every ALL-CAPS heading that matched neither is NAMED
 * below rather than dropped. Results and build status are STATE and are deliberately not read. */
head(5, 'THE MODELS — the QUESTION each answers, never its result  [source: docs/MODELS.md, prose]');
{
  const md = broken('models') ? '' : rd(D('docs', 'MODELS.md'));
  if (md == null) fail('THE MODELS', 'docs/MODELS.md is unreadable');
  else {
    const asks = new Map();
    for (const m of md.matchAll(/^\|\s*[0-9—-]+\s*\|\s*\*\*([A-Z0-9][A-Z0-9 _-]*)\*\*\s*\|\s*([^|]+)\|/gm)) {
      asks.set(m[1].trim(), m[2].trim());
    }
    const fromTable = asks.size;
    const lines = md.split('\n');
    let cur = null;
    const order = [], jobs = new Map();
    for (const ln of lines) {
      const h = ln.match(/^##\s+([A-Z][A-Z0-9_ /-]*[A-Z0-9])(?:\s*[(—-]|\s*$)/);
      if (/^##\s/.test(ln)) { cur = h ? h[1].trim() : null; if (cur && !order.includes(cur)) order.push(cur); continue; }
      if (cur && !jobs.has(cur)) {
        const j = ln.match(/^\*\*Job:\*\*\s*(.+)$/);
        if (j) jobs.set(cur, j[1].replace(/\*\*/g, '').trim());
      }
    }
    const named = [], unclassified = [];
    for (const name of order) {
      const q = asks.get(name) || jobs.get(name) || null;
      if (q) named.push([name, q]); else unclassified.push(name);
    }
    /* A MODEL IN THE PIPELINE TABLE WITH NO `## ` SECTION WAS BEING DROPPED SILENTLY, and that is the
     * failure this whole file exists to prevent — the first run of this section printed neither HYPNO
     * nor MAG, because the table names MAG and the ledger heading says MAGNEMITE. Anything the table
     * knows about is a model whether or not it has a section of its own. */
    for (const [name, q] of asks) if (!order.includes(name)) named.push([name + ' *', q]);
    for (const [name, q] of named) {
      console.log('  ' + name.padEnd(14) + (q.length > 88 ? q.slice(0, 85) + '...' : q));
    }
    if (!named.length) fail('THE MODELS', 'no model heading carried a **Job:** line or a pipeline-table row');
    console.log('\n  ' + named.length + ' models carry a question (' + fromTable + ' from the per-turn pipeline table;');
    console.log('  `*` = named by that table with no ledger section of its own).');
    if (unclassified.length) {
      console.log('  ' + unclassified.length + ' ALL-CAPS heading(s) matched NEITHER shape and are NOT classified — named, not dropped:');
      console.log('    ' + unclassified.join(', '));
    }
    console.log('  [docs/MODELS.md age ' + ageOf(D('docs', 'MODELS.md')) + ']');
    console.log('  FEATURES ARE PER-MODEL — these are differently-shaped questions and sharing a vector');
    console.log('  is a category error. FACTS (damage, speed order, the sheet) are GLOBAL: one');
    console.log('  implementation everyone calls. Composition (who runs when) is MODELS.md\'s pipeline table.');
  }
}

/* ---- 6. WHAT A MEASUREMENT MUST PIN ------------------------------------------------------------
 * DECLARED REGISTRY. The frozen set is read from SOURCES, never from a sentence about it — CLAUDE.md
 * said "twenty-three" while SOURCES held twenty-five, twice. */
head(6, 'WHAT A MEASUREMENT MUST PIN  [source: SOURCES in engine/engine_release.js]');
{
  let n = 0;
  try { n = broken('frozen') ? 0 : (require('./engine_release.js').SOURCES || []).length; } catch (e) { n = 0; }
  if (!n) fail('WHAT A MEASUREMENT MUST PIN', 'engine_release.js exported no SOURCES list');
  else {
    console.log('  A release freezes ' + n + ' SOURCE files. IT DOES NOT FREEZE:');
    console.log('    the STORE     — ingest appends hourly, and the team pool is drawn from it LIVE');
    console.log('    the CENSUS    — it steers WHICH scenarios play, so two runs are not a before/after');
    console.log('    the ARTIFACTS — any run rewrites them; a release does not protect them');
    console.log('  So a measurement pins THREE things: --release <id>, a census pin, and');
    console.log('  --team-store data/team-pool-frozen. Then PROVE the samples are identical.');
  }
}

/* ---- 7. IN FLIGHT ------------------------------------------------------------------------------
 * PROSE PARSER over docs/_reports/. COMMANDS ONLY — see the header. Keys on a heading containing the
 * word OWED; a report that spells its unfinished work differently is missed, so the count of reports
 * WITHOUT such a heading is printed rather than the miss being invisible. */
head(7, 'IN FLIGHT — OWED, NOT RUN, collected as COMMANDS  [source: docs/_reports/]');
{
  const dir = D('docs', '_reports');
  let files = [];
  try {
    files = broken('owed') ? [] : fs.readdirSync(dir).filter(f => f.endsWith('.md'))
      .map(f => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.m - a.m).map(x => x.f);
  } catch (e) { files = null; }
  if (files === null) fail('IN FLIGHT', 'docs/_reports/ cannot be read');
  else if (!files.length) fail('IN FLIGHT', 'docs/_reports/ holds no reports — every division brief is required to write one');
  else {
    const withOwed = [];
    let noOwed = 0, owedNoCmd = 0;
    for (const f of files) {
      const md = rd(path.join(dir, f)) || '';
      const lines = md.split('\n');
      const i = lines.findIndex(l => /^#{2,3}\s.*\bOWED\b/.test(l));
      if (i < 0) { noOwed++; continue; }
      const level = (lines[i].match(/^#+/) || ['##'])[0].length;
      const body = [];
      for (let j = i + 1; j < lines.length; j++) {
        const h = lines[j].match(/^(#+)\s/);
        if (h && h[1].length <= level) break;
        body.push(lines[j]);
      }
      /* COMMANDS ONLY. A line that starts with a runner, inside a fence or a backticked span. Prose,
       * findings and numbers are deliberately not extracted — see the header. */
      const cmds = [];
      for (let ln of body) {
        ln = ln.replace(/^[\s>*+-]*/, '').trim();
        /* A BACKTICKED COMMAND INSIDE A SENTENCE MUST STOP AT ITS CLOSING BACKTICK. Stripping only the
         * leading and trailing ones dragged the prose after it in — one line arrived as
         * "node engine/status.js --write` — **not run**, by instruction", which is a finding glued to
         * a command, and this section is forbidden from surfacing findings. */
        if (ln.startsWith('`')) ln = ln.slice(1).split('`')[0].trim();
        if (/^(node|cmd|npx|git|python3?|powershell|tools[\\/])/.test(ln) && ln.length < 200) cmds.push(ln);
      }
      if (cmds.length) withOwed.push({ f, cmds: [...new Set(cmds)] });
      else owedNoCmd++;
    }
    const show = OWED_ALL ? withOwed : withOwed.slice(0, 5);
    for (const r of show) {
      console.log('  ' + r.f + '   (age ' + ageOf(path.join(dir, r.f)) + ')');
      for (const c of r.cmds.slice(0, 6)) console.log('      ' + c);
      if (r.cmds.length > 6) console.log('      ... ' + (r.cmds.length - 6) + ' more in that file');
    }
    const total = withOwed.reduce((a, r) => a + r.cmds.length, 0);
    /* THREE BUCKETS, AND THEY MUST SUM. The first version printed two of them and 30 did not equal
     * 4 + 21 — five reports had an OWED heading whose block held no runnable line, and they were
     * invisible. An enumeration whose parts do not add up is hiding something. */
    console.log('\n  ' + files.length + ' reports scanned = ' + withOwed.length + ' with runnable OWED commands (' +
                total + ' commands) + ' + owedNoCmd + ' with an OWED heading but no command line + ' +
                noOwed + ' with no OWED heading at all.');
    if (withOwed.length + owedNoCmd + noOwed !== files.length) {
      fail('IN FLIGHT', 'the three buckets do not sum to the file count — a report was classified twice or not at all');
    }
    if (!OWED_ALL && withOwed.length > show.length) console.log('  Showing the newest ' + show.length + '. `--owed-all` for the rest.');
    console.log('  THESE ARE INSTRUCTIONS, NOT FINDINGS. Never quote a _reports/ file as current state.');
    console.log('  Uncommitted work is a separate hazard — `git status` first (start skill §1): a killed');
    console.log('  agent leaves the simulator half-edited AND IT STILL LOADS.');
  }
}

/* ---- 8. WHO MAY WRITE --------------------------------------------------------------------------
 * FILESYSTEM. The inbox/outbox split is a real directory pair, so its existence is checked rather
 * than described. */
head(8, 'WHO MAY WRITE  [source: filesystem]');
{
  const inbox = D('docs', '_inbox'), outbox = D('docs', '_outbox');
  const hasIn = fs.existsSync(inbox), hasOut = fs.existsSync(outbox);
  console.log('  ONE PUBLISHER. Claude Code holds the credentials and is the only agent that runs git.');
  console.log('  Cowork proposes and NEVER runs git — its shell cannot authenticate, and a push that');
  console.log('  fails partway is how this repo reached a detached HEAD mid-rebase.');
  console.log('  Single writer per folder: Cowork writes docs/_inbox/' + (hasIn ? '' : '  <-- MISSING') +
              ', Claude Code writes docs/_outbox/' + (hasOut ? '' : '  <-- MISSING'));
  if (!hasIn || !hasOut) fail('WHO MAY WRITE', 'the inbox/outbox pair does not exist on disk');
  else {
    /* AN UNLISTABLE INBOX IS NOT AN EMPTY ONE. Printing `0 draft(s)` for a directory that could not
     * be read tells a reader there is no work waiting, which is the opposite of what is known. */
    let pending = null;
    try { pending = fs.readdirSync(inbox).filter(f => f.endsWith('.md')).length; }
    catch (e) { fail('WHO MAY WRITE', 'docs/_inbox/ exists but could not be listed (' + e.code
      + '), so how many drafts are waiting on "apply inbox" is UNKNOWN, not zero'); }
    if (pending != null) console.log('  docs/_inbox/ holds ' + pending + ' draft(s) waiting on "apply inbox".');
  }
  console.log('  NEVER run two writing agents against this repo at once — they cannot see each other\'s');
  console.log('  edits and the later write silently wins.');
}

/* ---- the verdict -------------------------------------------------------------------------------- */
const SECTIONS = 8;
console.log('\n' + '='.repeat(76));
if (FAILURES.length) {
  console.log('ORIENT: ' + (SECTIONS - new Set(FAILURES).size) + '/' + SECTIONS + ' sections derived. ' +
              new Set(FAILURES).size + ' COULD NOT: ' + [...new Set(FAILURES)].join('; '));
  console.log('A section that cannot derive is a renamed file or a moved heading. FIX IT IN THIS SESSION —');
  console.log('a map that quietly drops a section reads as though the section does not exist.');
  process.exit(1);
}
console.log('ORIENT: ' + SECTIONS + '/' + SECTIONS + ' sections derived from code, the filesystem and the register.');
console.log('Nothing above was typed. If a line here is wrong, the DERIVATION is wrong — fix orient.js.');
