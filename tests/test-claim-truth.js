/* test-claim-truth.js — THE LISTS AUDIT THEIR MEMBERSHIP. NOTHING AUDITED THE CLAIMS INSIDE THEM.
 *
 *   node tests/test-claim-truth.js            the audit, non-zero exit on any FALSE claim
 *   node tests/test-claim-truth.js --list     one line per claim, machine-readable
 *   node tests/test-claim-truth.js --break    self-test: plant a false claim, prove this goes RED
 *
 * ══ WHY THIS EXISTS ═════════════════════════════════════════════════════════════════════════════
 *
 * `tests/run-all.js` already asserts that every name in `NOT_A_CHECK` / `PENDING_WIRE` still names a
 * file that exists and still trips the detector. That is MEMBERSHIP. The value beside the key is a
 * paragraph of prose asserting things about this tree — *"NOTHING HAS EVER RUN IT"*, *"it HAS a
 * runner"*, *"it WRITES data/format-audit.json"*, *"which IS discovered"* — and nothing tested one.
 *
 * MEASURED: on 2026-08-26 the `PENDING_WIRE` entry for `engine/derive_protocol_events.js` declared
 * *"NOTHING HAS EVER RUN IT"*. `tests/test-protocol-trace.js` PART 7 had spawned that file since
 * 2026-08-06 and failed on its non-zero exit. The claim was ONE DAY OLD, refutable by one grep, was
 * relayed to Will as fact, and was caught only because the next agent happened to check. That is
 * this project's signature failure — prose outliving what it described — arriving inside the table
 * built to stop it, and the membership assertion could not see it because the membership was fine.
 *
 * ══ WHAT A RECORD IS, AND WHY IT IS DERIVED ═════════════════════════════════════════════════════
 *
 * A hand-listed set of claim-carrying places is itself a claim that rots. So membership is derived:
 *
 *   A RECORD is any top-level `const UPPER_NAME = { ... }` in engine/, tests/ or build/ whose keys
 *   are ALL repo-relative paths and at least one of whose values is a long string.
 *
 * That shape is what a declaration table looks like here. It found FIVE, not the two this file was
 * written about: `NOT_A_CHECK` and `PENDING_WIRE` in tests/run-all.js, `DECLARED` in
 * tests/test-effective-identity.js, `HOLDERS` in tests/test-mc-key.js, and `NOT_A_MODEL` in
 * tests/test-stadium-roster.js. A sixth invented tomorrow joins by existing.
 *
 * `docs/ROADMAP.md` `VERIFIED BY:` markers are the other record shape. `engine/register_reality.js`
 * RUNS those instruments and compares the exit code to the row's status, which is the strong half;
 * what it does not do is check that the marker names something that is there at all, so that is
 * done here and nothing else about a marker is re-decided.
 *
 * ══ THE CLAIM KINDS, AND HOW EACH IS DECIDED ════════════════════════════════════════════════════
 *
 *   NAMES-A-PATH  every repo path named in the prose must exist on disk.
 *   RUNNER-NONE   "no runner" / "nothing has ever run it" -> nothing executes it AND no marker.
 *   RUNNER-SOME   "it HAS a runner" / "already run"       -> something executes it OR a marker.
 *   MARKER-NONE   "carries no VERIFIED BY marker"         -> docs/ROADMAP.md really carries none.
 *   MARKER-SOME   "docs/ROADMAP.md carries VERIFIED BY"   -> it really does.
 *   DISCOVERED    "<file> is DISCOVERED"                  -> it matches the tests/test-*.js glob.
 *   WRITES        "writes data/x.json"                    -> the subject's source names that file.
 *   REFUSES       "refuses to run without --x (exit 2)"   -> the source names the flag and the code.
 *   COMMIT        "landed in <sha>" / "commit <sha>"      -> git resolves it to a commit.
 *
 * EXECUTES is derived, never listed: a file under engine/, tests/, build/, tools/ or .github/ that
 * names the subject within 250 characters of a spawn/exec/require/`run:`, with comments stripped
 * first. `tests/run-all.js` is excluded as a candidate executor and asked properly instead — it
 * would otherwise credit itself as the runner of every file it merely EXEMPTS, which is the exact
 * inversion this check is about. Its real run list is its `tests/test-*.js` glob plus `GATES`.
 *
 * ══ WHAT WALKS PAST THIS. READ THIS BEFORE QUOTING ITS COVERAGE FIGURE ══════════════════════════
 *
 *  1. FREE PROSE. A claim in a comment, a header, a ledger or a `docs/` page is not in a record and
 *     no pattern here can find it. That is the large majority of the prose in this repository.
 *     run-all.js's own header claim that one detector clause "adds exactly TWO files and no others"
 *     is true today and was checked BY HAND; nothing re-checks it.
 *  2. QUOTED TEXT. A phrase inside double quotes is read as a REPORT of what something said, not as
 *     an assertion by the record, and is stripped before the phrase kinds are matched. That is
 *     required — the corrected derive_protocol_events entry quotes the false claim it retracts —
 *     and it is a hole: a false claim written inside quotation marks is out of reach.
 *  3. DATED MEASUREMENTS. "Measured exit 0 on 2026-08-22", "GREEN as of 2026-08-26", "RED on ONE of
 *     25 scenarios". Deciding these means re-running the thing, which plays games. Counted as
 *     UNCHECKABLE and named, never counted as true.
 *  4. MECHANISM PROSE. "the shield is step 1 and semi-invulnerability is step 0" is a claim about
 *     the GAME. This file knows nothing about the game and says so rather than guessing.
 *  5. EXTERNAL PATHS. A path inside a URL or in the Showdown checkout (`/data/mods/champions/...`)
 *     is skipped by the preceding-character rule. It is not evidence of anything either way.
 *  6. EXECUTES IS REACHABILITY, NOT EXECUTION. A runner that exists but is itself unwired still
 *     counts as a runner. The entries say so in their own words; this file does not re-litigate it.
 *
 * Reads files. Runs `git cat-file`. Plays no game, loads no simulator, writes nothing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const LIST = process.argv.includes('--list');
const BREAK = process.argv.includes('--break');

/* THE FAILURES THIS FILE IS ALLOWED TO SURVIVE ARE COUNTED, NOT SWALLOWED. A path that is absent is
 * an ANSWER here — half the claims are about absence — so ENOENT is expected and silent. Anything
 * else is a read this audit could not make, and an audit that quietly reads less than it thinks is
 * the reassuring null the whole file exists to remove. Every one is counted and printed. */
const TROUBLE = [];
const read = rel => {
  try { return fs.readFileSync(D(rel), 'utf8').replace(/\r/g, ''); }
  catch (e) { if (e.code !== 'ENOENT') TROUBLE.push(`read ${rel}: ${e.message}`); return null; }
};
/* Line endings are normalised at the read for the reason engine/read_text.js gives: CR is matched by
 * \s and not by `.`, so a line-oriented pattern silently captures nothing on a CRLF working tree. */

/* ---- discovery: every file that could be an executor, and every record ------------------------ */

function walk(rel, out = []) {
  let ents = [];
  try { ents = fs.readdirSync(D(rel), { withFileTypes: true }); }
  catch (e) { if (e.code !== 'ENOENT') TROUBLE.push(`walk ${rel}: ${e.message}`); return out; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const r = rel + '/' + e.name;
    if (e.isDirectory()) walk(r, out); else out.push(r);
  }
  return out;
}

const CODE_DIRS = ['engine', 'tests', 'build', 'tools', '.github'];
const executorFiles = CODE_DIRS.flatMap(d => walk(d))
  .filter(f => /\.(js|py|yml|yaml|cmd|sh|bat|json)$/.test(f))
  .filter(f => f !== 'tests/run-all.js');   /* asked properly below — see the header */

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const codeCache = new Map();
function codeOf(rel) {
  if (!codeCache.has(rel)) {
    const s = read(rel) || '';
    codeCache.set(rel, /\.(js|py)$/.test(rel) ? stripComments(s) : s);
  }
  return codeCache.get(rel);
}

const EXEC_NEAR = /spawnSync|spawn\(|execFileSync|execFile\(|execSync|exec\(|fork\(|require\(|import\(|\bnode\s|run:/;
const executorCache = new Map();
function executorsOf(rel) {
  if (executorCache.has(rel)) return executorCache.get(rel);
  const base = rel.split('/').pop();
  const out = [];
  for (const f of executorFiles) {
    if (f === rel) continue;
    const c = codeOf(f);
    for (let i = c.indexOf(base); i >= 0; i = c.indexOf(base, i + 1)) {
      if (EXEC_NEAR.test(c.slice(Math.max(0, i - 250), i + 120))) { out.push(f); break; }
    }
  }
  /* run-all.js runs exactly its tests/test-*.js glob plus the GATES array. Read that, do not infer
   * it from proximity — every exemption in that file sits within a few characters of a spawn. */
  const runAll = read('tests/run-all.js') || '';
  const gates = (runAll.match(/const GATES = \[([\s\S]*?)\];/) || [, ''])[1];
  const gated = new Set((gates.match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)));
  if (gated.has(rel) || /^tests\/test-[A-Za-z0-9_.-]+\.(js|py)$/.test(rel)) out.push('tests/run-all.js');
  executorCache.set(rel, out);
  return out;
}

const PATHKEY = /^(engine|tests|build|web|data|tools|docs)\/[A-Za-z0-9_.\/-]+$/;
function recordsIn(rel) {
  const src = read(rel); if (src == null) return [];
  const out = []; const re = /^const ([A-Z][A-Z0-9_]*) = \{/gm; let m;
  while ((m = re.exec(src))) {
    const j = src.indexOf('\n};', m.index); if (j < 0) continue;
    let obj;
    try { obj = eval('(' + src.slice(m.index + ('const ' + m[1] + ' = ').length, j + 2) + ')'); }
    catch (e) {
      /* Most of these are ordinary code — `const GATES = {` style blocks that reference variables,
       * or a `{` that is not an object literal at all — and are correctly not records. But a table
       * this audit CANNOT PARSE is a table it does not audit, which is invisible unless counted.
       * Only blocks that LOOK like a path-keyed table are worth reporting, so the noise floor stays
       * at zero and a real unreadable record is not buried under it. */
      /* "Looks like a record" means the FIRST content line inside the braces is a quoted path key.
       * A looser test (a path key anywhere in the block) fired twice on this tree, both times on a
       * literal that CLOSES ON ITS OWN LINE — `const MEASURED_AGAINST = {};` followed by a loop that
       * happens to list paths — so the brace matcher had run past it into ordinary code. Reporting
       * those is how a counter gets ignored. */
      const open = src.slice(m.index, src.indexOf('\n', m.index));
      const inner = src.slice(src.indexOf('\n', m.index) + 1, j)
        .split('\n').filter(l => l.trim() && !/^\s*(\/\*|\*|\/\/)/.test(l))[0] || '';
      if (!open.includes('}') && /^\s*'(engine|tests|build|web|data|tools|docs)\/[^']*'\s*:/.test(inner))
        TROUBLE.push(`${rel}: ${m[1]} looks like a path-keyed record and could not be parsed (${e.message.split('\n')[0]})`);
      continue;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
    const ks = Object.keys(obj);
    if (!ks.length || ks.some(k => !PATHKEY.test(k))) continue;
    if (!ks.some(k => typeof obj[k] === 'string' && obj[k].length > 40)) continue;
    out.push({ file: rel, name: m[1], obj });
  }
  return out;
}

const records = ['engine', 'tests', 'build'].flatMap(d => walk(d))
  .filter(f => /\.js$/.test(f)).sort().flatMap(recordsIn);

/* ---- docs/ROADMAP.md: which files a VERIFIED BY marker names -------------------------------- */

const ROADMAP = read('docs/ROADMAP.md') || '';
const markerCmds = [];
{
  const re = /VERIFIED BY:?\*{0,2}\s*`([^`]+)`/g; let m;
  while ((m = re.exec(ROADMAP))) markerCmds.push(m[1]);
}
const markerFiles = new Set();
const markerNamedPaths = [];
for (const cmd of markerCmds) {
  for (const p of cmd.match(/(?:engine|tests|build|data)\/[A-Za-z0-9_.\/-]+/g) || []) {
    markerNamedPaths.push([cmd, p]);
    if (/\.(js|py)$/.test(p)) markerFiles.add(p);
  }
}

/* ---- claim extraction ------------------------------------------------------------------------ */

const claims = [];
const add = (at, kind, text, ok, detail) => claims.push({ at, kind, text, ok, detail: detail || '' });

/* A path token is only ours if the character before it is not part of a longer path or a URL —
 * `play.pokemonshowdown.com/data/moves.json` and `/data/mods/champions/abilities.ts` are not
 * claims about this tree. And it must end in an extension this repo uses, or a glob remnant like
 * `tests/test-` from "the tests/test-*.js glob" reads as a missing file. */
const PATHTOK = /(?:^|[^A-Za-z0-9_.\/-])((?:engine|tests|build|web|tools|data|docs)\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_](?:\.(?:js|py|json|jsonl|md|cmd|yml|sh|css|html))?)/g;
const HAS_EXT = /\.(js|py|json|jsonl|md|cmd|yml|sh|css|html)$/;

const UNCHECKABLE = [
  ['DATED-MEASUREMENT', /Measured [^.]*\bon 20\d\d-\d\d-\d\d|GREEN as of|\bRED on\b|\bRED,\b|exits? \d\b|exit \d\b/],
  ['MECHANISM',         /The mechanism:/],
];

/* ONE extractor, called by the audit and by --break. It is a function and not a loop body for the
 * reason a-green-test-can-be-asking-nothing gives: a --break that re-implements the predicates
 * proves that the COPY can go red, which is not the claim anyone cares about. */
function extract(at, subj, prose) {
  {
    /* Quoted spans are a REPORT of what something said, not an assertion by the record. Stripped
     * for the phrase kinds only; paths and shas inside a quotation are still real references. */
    const asserted = prose.replace(/"[^"]*"/g, ' ').replace(/“[^”]*”/g, ' ');

    for (const m of prose.matchAll(PATHTOK)) {
      const p = m[1].replace(/[.,;:)]+$/, '');
      if (p === subj || !HAS_EXT.test(p)) continue;
      add(at, 'NAMES-A-PATH', p, fs.existsSync(D(p)));
    }

    const runners = executorsOf(subj);
    const runs = runners.length > 0 || markerFiles.has(subj);
    const how = (runners.join(', ') || '(nothing)') + (markerFiles.has(subj) ? ' + ROADMAP marker' : '');

    if (/NO RUNNER|NOTHING HAS EVER RUN|never been run by anything|run by nobody|has been run by nobody|never been measured by anyone|never run by anything/i.test(asserted))
      add(at, 'RUNNER-NONE', subj, !runs, how);
    if (/HAS a runner|ALREADY HAS A RUNNER|ALREADY RUN\b|already has a runner/i.test(asserted))
      add(at, 'RUNNER-SOME', subj, runs, how);
    if (/carries no `?VERIFIED BY|no VERIFIED BY marker|carries no marker/i.test(asserted))
      add(at, 'MARKER-NONE', subj, !markerFiles.has(subj), how);
    if (/carries `?VERIFIED BY|carries a `?VERIFIED BY/i.test(asserted))
      add(at, 'MARKER-SOME', subj, markerFiles.has(subj), how);

    for (const m of asserted.matchAll(/((?:engine|tests|build)\/[A-Za-z0-9_.-]+\.js)(?:[^.]{0,60}?)\bIS DISCOVERED\b/gi))
      add(at, 'DISCOVERED', m[1], /^tests\/test-[A-Za-z0-9_.-]+\.js$/.test(m[1]) && fs.existsSync(D(m[1])));
    for (const m of asserted.matchAll(/((?:engine|tests|build)\/[A-Za-z0-9_.-]+\.js), which IS discovered/gi))
      add(at, 'DISCOVERED', m[1], /^tests\/test-[A-Za-z0-9_.-]+\.js$/.test(m[1]) && fs.existsSync(D(m[1])));

    /* Case-insensitive on purpose: the entries write it "writes", "Writes" and "WRITES", and a
     * case-sensitive pattern silently dropped engine/format_audit.js's claim — a claim kind that
     * quietly matches nothing is the same reassuring null as a check nobody runs. */
    for (const m of asserted.matchAll(/\bwrites? (data\/[A-Za-z0-9_.-]*[A-Za-z0-9_])/gi)) {
      const src = read(subj) || '';
      add(at, 'WRITES', `${subj} -> ${m[1]}`, src.includes(m[1].replace(/^data\//, '')), '');
    }

    /* "REFUSES to run without --release <id> (exit 2)". Weak but real, and static: the source must
     * name the flag AND carry the exit code it claims. Actually RUNNING it would play a game. */
    for (const m of asserted.matchAll(/REFUSES? to run without `?(--[a-z-]+)[^.]{0,60}?exit (\d)/gi)) {
      const src = read(subj) || '';
      add(at, 'REFUSES', `${subj} -> ${m[1]}, exit ${m[2]}`,
          src.includes(m[1]) && new RegExp('exit\\(\\s*' + m[2] + '\\s*\\)').test(src));
    }

    for (const m of asserted.matchAll(/\b(?:commit|landed [^.]{0,40}?in) ([0-9a-f]{7,40})\b/g)) {
      /* A non-zero exit from `cat-file -e` IS the verdict: the sha does not resolve. git being
       * absent or the directory not being a repository is NOT a verdict, and reporting it as one
       * would fail every COMMIT claim at once for a reason that has nothing to do with the claim.
       * The two are separated by ENOENT on the binary itself, and the second is counted. */
      let ok = false;
      try { execFileSync('git', ['cat-file', '-e', m[1] + '^{commit}'], { cwd: ROOT, stdio: 'ignore' }); ok = true; }
      catch (e) {
        if (e.code === 'ENOENT' || /not a git repository/i.test(String(e.message))) {
          TROUBLE.push(`COMMIT claims cannot be decided: ${e.message.split('\n')[0]}`);
          add(at, 'UNCHECKABLE:NO-GIT', m[1], null);
          continue;
        }
      }
      add(at, 'COMMIT', m[1], ok);
    }

    for (const [kind, re] of UNCHECKABLE) if (re.test(asserted)) add(at, 'UNCHECKABLE:' + kind, subj, null);
  }
}

for (const r of records)
  for (const subj of Object.keys(r.obj))
    if (typeof r.obj[subj] === 'string') extract(`${r.file}:${r.name}[${subj}]`, subj, r.obj[subj]);

/* The marker record: a VERIFIED BY that names something absent decides nothing and reads as though
 * it does. register_reality.js RUNS the markers; it does not assert the name resolves. */
for (const [cmd, p] of markerNamedPaths)
  add('docs/ROADMAP.md:VERIFIED BY', 'NAMES-A-PATH', p, fs.existsSync(D(p)), cmd.slice(0, 60));

/* ---- THE SECOND CENSUS: a comment naming a SOURCE FILE that is not there ---------------------
 *
 * The records above are the structured half. The unstructured half is the comments, and one claim
 * in them is mechanically decidable: a comment that names a `.js` / `.py` / `.html` file inside
 * this repository is asserting that file exists. That is the derive_protocol_events defect exactly —
 * a claim that something is checked, where nothing is.
 *
 * ITS FIRST RUN, 2026-08-26, FOUND EIGHT. Two examples, both since corrected and both kept here
 * because the shape is the point rather than the instance: `engine/lookup.js` said a contract test
 * "reads this" — the file it named was tests/test-lookup-contract.js, there is no such file and
 * there never has been, and `misses()` in fact has no reader at all. `build/build_mag_data.js`
 * described a page carrying a self-check against a fixture it generates, and named
 * web/magnemite.html; that path has never existed in this repository's history, while the self-check
 * is real and lives in `magSelfCheck()` in web/index.html. The worst of the eight had stood 32 days
 * and the oldest 34. Six were corrected on 2026-08-27 by MEASURE and two were filed to ENGINE, whose
 * files they sit in — see ROADMAP #480. The census is not a historical note: it re-derives on every
 * run and reports whatever is true today.
 *
 * SOURCE FILES ONLY, DELIBERATELY. A `data/*.json` named in a comment may be legitimately absent —
 * gitignored, regenerable, or not yet built — so its absence is not evidence. A file under
 * engine/, tests/, build/ or web/ either exists or the sentence is wrong.
 *
 * A file that SAYS the thing is missing is not making a false claim, so a negation within 200
 * characters of the name clears it ("There is no engine/lookahead_divergence.py yet"). That window
 * is tuned and it is a hole in both directions: at 300 an unrelated "NOT YET" 250 characters away
 * cleared a live false claim, and at 120 a real retraction 130 characters away read as one.
 * engine/graveyard/ is skipped — archived code, the same footing as docs/archive/.
 *
 * THIS CENSUS DOES NOT GATE, AND THAT IS A DECISION WITH A REASON RATHER THAN A SOFTENING. Every
 * name it currently reports sits in a file this division does not own; a check that goes red on
 * something its owner cannot fix becomes "one of the two known failures", which is the phrase
 * CLAUDE.md bans. The names are filed as register rows instead, and the register is the authority.
 * The exit code of this file is the RECORDS verdict only, and says so below. */

const NEG = /there is no|does not exist|never existed|has never existed|\bis gone\b|was deleted|no longer exists?|doesn't exist|used to|this tested|is not written|HAS NEVER/i;
const SRCTOK = /(?:^|[^A-Za-z0-9_.\/-])((?:engine|tests|build|web)\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_]\.(?:js|py|html))(?![A-Za-z0-9])/g;
const PLACEHOLDER = /\/(x|y|z|foo|bar|baz)\.(js|py|html)$/;

const commentFalse = [];
let commentRefs = 0;
for (const f of ['engine', 'tests', 'build'].flatMap(d => walk(d))) {
  if (!/\.js$/.test(f) || f.startsWith('engine/graveyard/')) continue;
  const src = read(f); if (src == null) continue;
  const blocks = (src.match(/\/\*[\s\S]*?\*\//g) || []).concat(src.match(/(^|[^:])\/\/[^\n]*/gm) || []);
  const seen = new Set();
  for (const blk of blocks) for (const m of blk.matchAll(SRCTOK)) {
    const p = m[1];
    commentRefs++;
    if (fs.existsSync(D(p)) || PLACEHOLDER.test(p) || p === f || seen.has(p)) continue;
    seen.add(p);
    let declared = false;
    for (let i = src.indexOf(p); i >= 0; i = src.indexOf(p, i + 1))
      if (NEG.test(src.slice(Math.max(0, i - 200), i + 200))) { declared = true; break; }
    if (!declared) commentFalse.push([f, p]);
  }
}

/* ---- --break: plant a false claim and prove this file can see it ------------------------------ */

if (BREAK) {
  /* The first plant is the REAL retracted sentence, verbatim: engine/derive_protocol_events.js
   * carried "NOTHING HAS EVER RUN IT" while tests/test-protocol-trace.js PART 7 had spawned it
   * since 2026-08-06. If this file cannot go red on the exact claim it was built for, it is
   * decoration. The other three plant one of each remaining checkable kind. */
  const plants = [
    ['engine/derive_protocol_events.js',
     'a real two-gate conformance check that NOTHING HAS EVER RUN IT and that no list here has ever named.'],
    ['engine/orient.js',
     'a REAL CHECK, and it HAS a runner: tests/test-does-not-exist.js is DISCOVERED and it writes data/no-such-artifact.json.'],
    ['tests/test-mechanics.js',
     'landed in commit 0000000 and it carries no VERIFIED BY marker in docs/ROADMAP.md.'],
  ];
  const mark = claims.length;
  for (const [subj, prose] of plants) extract('--break[' + subj + ']', subj, prose);
  const planted = claims.slice(mark).filter(c => c.ok !== null);
  const red = planted.filter(c => !c.ok);
  console.log('--break — three entries planted into the SAME extractor the audit uses.\n');
  for (const [subj, prose] of plants) console.log(`  ${subj}\n    "${prose}"`);
  console.log('');
  for (const c of planted) console.log(`  ${c.ok ? 'not seen ' : 'RED     '} ${c.kind}  ${c.text}  ${c.detail}`);
  /* engine/status.js DOES carry a VERIFIED BY marker and orient.js DOES have a runner, so the
   * MARKER-NONE and RUNNER-SOME plants are the false ones; RUNNER-SOME here is planted TRUE on
   * purpose, to show the check is not simply reporting everything red. */
  const need = ['RUNNER-NONE', 'NAMES-A-PATH', 'WRITES', 'COMMIT', 'MARKER-NONE'];
  const missed = need.filter(k => !red.some(c => c.kind === k));
  console.log(missed.length
    ? `\n  BREAK FAILED — planted claims of kind ${missed.join(', ')} were NOT reported false.`
    : `\n  BREAK OK — ${red.length} of ${planted.length} planted claims reported FALSE, covering ${need.join(', ')}.`);
  process.exit(missed.length ? 1 : 0);
}

/* ---- report ---------------------------------------------------------------------------------- */

const checkable = claims.filter(c => c.ok !== null);
const unchecked = claims.filter(c => c.ok === null);
const bad = checkable.filter(c => !c.ok);

if (LIST) {
  for (const c of claims) console.log(`${c.ok === null ? 'UNCHECKABLE' : c.ok ? 'TRUE ' : 'FALSE'}\t${c.kind}\t${c.at}\t${c.text}\t${c.detail}`);
  for (const [f, p] of commentFalse) console.log(`FALSE\tCOMMENT-NAMES-A-SOURCE-FILE\t${f}\t${p}\t(reported, not gated)`);
  process.exit(bad.length ? 1 : 0);
}

console.log('CLAIM TRUTH — the assertions INSIDE a declaration record, not its membership.\n');
console.log(`  ${records.length} record(s) derived, ` +
            `${records.reduce((a, r) => a + Object.keys(r.obj).length, 0)} entries:`);
for (const r of records) console.log(`    ${r.file}  ${r.name}  (${Object.keys(r.obj).length})`);
console.log(`    docs/ROADMAP.md  VERIFIED BY  (${markerCmds.length} markers, ${markerFiles.size} distinct files)`);

const kinds = {};
for (const c of claims) {
  const k = kinds[c.kind] || (kinds[c.kind] = { n: 0, f: 0 });
  k.n++; if (c.ok === false) k.f++;
}
console.log(`\n  ${claims.length} claim(s) extracted — ${checkable.length} checkable, ${unchecked.length} not.`);
for (const k of Object.keys(kinds).sort()) console.log(`    ${String(kinds[k].n).padStart(4)}  ${k}${kinds[k].f ? `   (${kinds[k].f} FALSE)` : ''}`);

if (bad.length) {
  console.log(`\n  FAIL — ${bad.length} FALSE CLAIM(S). A record asserting something untrue about this`);
  console.log(`  tree is the stale handoff wearing a receipt. Correct the sentence, do not delete it:`);
  for (const c of bad) console.log(`    ${c.kind}  ${c.at}\n        claims: ${c.text}\n        truth : ${c.detail || 'it is not so'}`);
} else {
  console.log(`\n  ${checkable.length} passed, 0 failed — every mechanically checkable claim in these`);
  console.log(`  records is true of this tree. See the header for the six things that walk past.`);
}

/* Counted, not swallowed. An audit that read less than it thinks it did is the reassuring null. */
if (TROUBLE.length) {
  console.log(`\n  ${TROUBLE.length} read(s) this audit could NOT make. Its coverage is lower than the`);
  console.log(`  counts above imply, by exactly this much:`);
  for (const t of TROUBLE) console.log(`    ${t}`);
}

console.log(`\n  ---- SECOND CENSUS: a comment naming a source file. REPORTED, NOT GATED. ----`);
console.log(`  ${commentRefs} reference(s) to a repo .js/.py/.html file inside a comment in engine/,`);
console.log(`  tests/ and build/. ${commentFalse.length} name(s) something that is not there and do not say so:`);
for (const [f, p] of commentFalse) console.log(`    ${f}\n        names ${p}  — ABSENT`);
console.log(`  The exit code above is the RECORDS verdict only. These are filed as register rows;`);
console.log(`  gating on them would put a permanent red beside work this division cannot land.`);

process.exit(bad.length ? 1 : 0);
