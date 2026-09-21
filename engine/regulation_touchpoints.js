#!/usr/bin/env node
/* regulation_touchpoints.js — EVERY TRACKED FILE THAT NAMES A CHAMPIONS REGULATION, CLASSIFIED BY
 * WHAT A ROTATION HAS TO DO ABOUT IT.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A CHECKLIST
 * ---------------------------------------------
 * "What has to change when a new regulation goes live" was asked on 2026-09-20, during the M-B -> M-C
 * rotation. The obvious answer is a typed list of files. This repository already knows what a typed
 * list is worth: fourteen handoff documents, a hand-maintained ban list of four, an auto-commit
 * described in the present tense for twelve days after it died. A list of ~1,600 files would be
 * wrong within a day and would look exactly as authoritative while wrong.
 *
 * So the list is DERIVED on every run, and the judgement is kept separate and stated as judgement:
 * docs/REGULATION-ROTATION.md is the procedure, this file is the inventory it stands on.
 *
 * WHAT THIS IS NOT
 * ----------------
 * NOT A GATE. It refuses nothing and exits 0 with findings. The gates that do refuse are named in
 * the runbook. Will's standing instruction is to fix the thing rather than build scaffolding
 * around it, and a printing derivation is a tool.
 *
 * NOT A SECOND COPY OF AN EXISTING PREDICATE. Three questions already have owners and are imported
 * rather than restated (CLAUDE.md, FACTS ARE GLOBAL):
 *
 *   engine/next_regulation.js   VGC_REG     — what a Champions regulation id LOOKS like
 *   engine/format_id_scan.js    CALL        — what a typed format id CALL SITE looks like
 *   engine/format_id_scan.js    COMMENT     — what a comment line looks like
 *   engine/next_regulation.js --checklist   — the ORDER of the flip, and the readers of the config
 *
 * The complement matters: `--checklist` derives the blast radius from files that READ
 * data/regulations.json, and `format_id_scan` derives typed ids at a `forFormat(` call. A file that
 * carries the id in a store key, a `format:` field, a shell loop in a workflow or a document does
 * NEITHER, and is invisible to both. That complement is the population this file walks.
 *
 * THE CLASSES, AND WHY THE COUNTS ARE USELESS UNDIFFERENTIATED
 * -----------------------------------------------------------
 *   CONFIGURATION  the id is a SETTING. A human edits it, and everything downstream follows.
 *   HARDCODED      the id is typed into a live line of code, a test or a workflow. After the flip
 *                  each of these keeps working, about the PREVIOUS regulation, reporting success —
 *                  this project's signature failure mode. THIS IS THE LIST WORTH SHRINKING.
 *   DERIVED        a stamped artifact or a generated bundle. NO EDIT: re-run its generator. Until
 *                  then it is a true statement about the regulation that produced it.
 *   PROSE          a living document that describes the regulation. Rewritten by a human at the
 *                  documentation pass; nothing mechanical can decide what a sentence should say.
 *   HISTORICAL     dated evidence, frozen releases, archived stores, findings records.
 *                  MUST NOT CHANGE. Rewriting these edits the evidence chain, which this
 *                  repository forbids (CLAUDE.md, "A HISTORY REWRITE IS NOT AVAILABLE").
 *
 * EVERY RULE BELOW IS STRUCTURAL AND IS PRINTED WITH --rules, so a reader can check the classifier
 * rather than trust it. Where a file cannot be classified structurally it is reported as
 * UNDECIDED and named, because a wrong class stated confidently is worse than a short list a human
 * reads in five seconds.
 *
 *   node engine/regulation_touchpoints.js                 counts, then the two actionable classes
 *   node engine/regulation_touchpoints.js --class hardcoded    one class in full, with line numbers
 *   node engine/regulation_touchpoints.js --rules         the classification rules themselves
 *   node engine/regulation_touchpoints.js --json          the whole inventory
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const NR = require(path.join(__dirname, 'next_regulation.js'));
const FMT = require(path.join(__dirname, 'format_id_scan.js'));

/* THE SHAPE IS NOT RETYPED. next_regulation.js owns "what a Champions VGC regulation id is"; it
 * anchors the pattern because it parses a whole id, and this file searches inside a line. Stripping
 * the anchors is the only edit, and it is done here rather than by keeping a second pattern. */
const ID_SHAPE = new RegExp(NR.VGC_REG.source.replace(/^\^/, '').replace(/\$$/, '') + '(?:bo3)?', 'gi');
/* The bare regulation TOKEN, for paths and keys that carry `regmb` without the full id —
 * data/archive/<token>/, the key in data/regulations.json.
 *
 * THE TOKEN SET IS DERIVED FROM THE IDS THE REPOSITORY ACTUALLY NAMES, never from a pattern.
 * The first draft used /\breg[a-z]{1,3}\d?\b/ and matched the words `regex` and `regime` — a
 * classifier that manufactures touchpoints out of English is the over-match LESSONS §4 names, and
 * it put two innocent files on the list a human is asked to read. */
let TOKEN_SHAPE = null;
function tokenShapeFrom(ids) {
  const toks = new Set();
  for (const id of ids) {
    const p = NR.parseFormatId(id);
    if (p) toks.add('reg' + p.token);
  }
  if (!toks.size) return null;
  return new RegExp('\\b(?:' + [...toks].sort().join('|') + ')\\b', 'gi');
}

/* ---- what is scanned ---------------------------------------------------------------------------
 * TRACKED FILES ONLY, for the same reason the 100 MB rule checks `git ls-files`: an untracked file
 * is not part of what a rotation has to move. */
const SKIPPED = [];
const UNREADABLE = [];
const MAX_BYTES = 20 * 1024 * 1024;
const BINARY = /\.(gz|zip|png|jpg|jpeg|gif|pdf|ico|woff2?|ttf|xlsx|docx|bin)$/i;

function trackedFiles() {
  return cp.execSync('git ls-files -z', { cwd: ROOT, maxBuffer: 1 << 30 })
    .toString('utf8').split('\0').filter(Boolean).map(f => f.replace(/\\/g, '/'));
}

/* ---- the classification rules, each structural, each printable ---------------------------------
 *
 * WRITE-ONCE ROOTS. These are not a taste list: each is a place this repository has already
 * declared append-only in prose AND in a guard —
 *   data/releases/      engine/engine_release.js: a cut is an event, never rewritten
 *   data/archive/       build/archive-regulation.js: the snapshot of a CLOSED regulation
 *   data/verification/  dated verification artifacts (docs/_reports/2026-09-06-repo-cleanup.md)
 *   docs/_reports/      CLAUDE.md: "historical by construction, never cited as current state"
 *   docs/HANDOFF*       CLAUDE.md: fourteen of them, none maintained
 *   CHANGELOG.md        Keep a Changelog: "a prior conclusion is never silently rewritten"
 *   docs/RUNNING-NOTES  its own preamble forbids editing a row to agree with today
 */
const WRITE_ONCE = [
  /^data\/releases\//, /^data\/archive\//, /^data\/verification\//,
  /^docs\/_reports\//, /^docs\/archive\//, /^docs\/HANDOFF/,
  /^CHANGELOG\.md$/, /^docs\/RUNNING-NOTES\.md$/,
];
/* A DATE OR A RELEASE ID IN THE NAME MAKES A FILE AN OBSERVATION. `2026-09-06`, `2026-08`, and the
 * 12-hex release id that artifacts carry in their filename. */
const DATED_NAME = /(^|[^0-9])20\d\d-\d\d(-\d\d)?([^0-9]|$)|-[0-9a-f]{12}\./;

/* A GENERATION STAMP. Measured 2026-09-20: 99 of the 102 non-historical data/*.json files naming a
 * regulation id carry one of these at the top level. The three that do not are named by the run. */
const STAMP_KEY = /^(generated|generated_at|generatedAt|stamped|stamp|cut|when|date|run_at|timestamp|ts|created|at|source_digests|release|engine_release|meta)$/;
const GENERATED_MARKER = /GENERATED FILE|GENERATED by|\bgenerated\b\s*[:=]/i;

const SOURCE_EXT = /\.(js|cjs|mjs|ts|py|html|yml|yaml|cmd|bat|sh)$/i;

/* IS THIS UNSTAMPED data/ FILE READ AS CONFIGURATION, OR IS IT A RECORD?
 *
 * The generation stamp separates "regenerate it" from "a human owns it". It does NOT separate a
 * SETTING from a RECORDING: data/regulations.json and data/trajectories.sample.json both lack a
 * stamp, and one is the source of truth while the other is one sampled game that happens to carry
 * the format it was played under. The structural difference is that something READS the setting at
 * run time, by name, with a read verb beside it — the same predicate
 * engine/next_regulation.js uses to find the readers of the active regulation, applied to any name.
 *
 * DELIBERATELY NOT provenance.js's WRITER GRAPH. That answers a different question (who produced
 * this artifact) in 800 lines, and copying it here would be the second implementation of a fact
 * this repository has already paid for twice. A file NAMED in a string with no read verb — a
 * fetch path listed in a page, say — is not a reader. */
const READ_VERB = /(readFileSync|readFile|require|createReadStream|json\.load|open\s*\(|load\s*\()/i;
let SOURCE_TEXT = null;
function sourceCorpus() {
  if (SOURCE_TEXT !== null) return SOURCE_TEXT;
  const dirs = ['engine', 'build', 'tests', 'sim', 'web', 'app', path.join('.github', 'workflows')];
  const parts = [];
  const walk = d => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); }
    catch (e) { UNREADABLE.push(d + ': ' + e.code); return; }
    for (const e of ents) {
      if (e.isDirectory()) { if (!['node_modules', '.git'].includes(e.name)) walk(path.join(d, e.name)); }
      else if (SOURCE_EXT.test(e.name)) {
        try { parts.push(fs.readFileSync(path.join(d, e.name), 'utf8')); }
        catch (err) { UNREADABLE.push(path.join(d, e.name) + ': ' + err.code); }
      }
    }
  };
  for (const d of dirs) walk(path.join(ROOT, d));
  SOURCE_TEXT = parts.join('\n');
  return SOURCE_TEXT;
}
function readAsSetting(rel) {
  const lines = sourceCorpus().split('\n');
  const needle = rel.replace(/^data\//, '');
  return lines.some(l => l.includes(needle) && READ_VERB.test(l));
}

/* NOT SILENT. An artifact that will not parse is not evidence of an absent stamp — it is evidence
 * that this classifier could not ask the question, and the two land the file in different classes.
 * Counted and printed rather than swallowed. */
const UNPARSEABLE = [];
function hasGenerationStamp(rel, text) {
  if (/\.json$/i.test(rel)) {
    try {
      const j = JSON.parse(text);
      if (j && typeof j === 'object' && !Array.isArray(j) && Object.keys(j).some(k => STAMP_KEY.test(k))) return true;
    } catch (e) {
      UNPARSEABLE.push(rel + ': ' + String(e.message).slice(0, 60));
      /* fall through to the textual marker, which is weaker but still real evidence */
    }
  }
  return GENERATED_MARKER.test(text.slice(0, 4096));
}

/* Live (non-comment) lines naming an id. COMMENT is format_id_scan's, not a second copy: its first
 * draft counted this repository's own prose ABOUT a format id as a defect, and the fix lives there. */
function liveLines(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (FMT.COMMENT.test(line)) return;
    ID_SHAPE.lastIndex = 0;
    const m = ID_SHAPE.exec(line);
    if (!m) return;
    FMT.CALL.lastIndex = 0;
    out.push({ line: i + 1, id: m[0].toLowerCase(), callSite: FMT.CALL.test(line) });
  });
  return out;
}

function classify(rel, text) {
  if (WRITE_ONCE.some(re => re.test(rel))) return { cls: 'HISTORICAL', why: 'write-once root' };
  if (DATED_NAME.test(rel)) return { cls: 'HISTORICAL', why: 'dated or release-stamped filename' };

  const live = liveLines(text);

  if (rel.startsWith('data/')) {
    /* A ROW DUMP IS NEVER A SETTING, WHOEVER READS IT. The reader test below admits any file a
     * script opens by name, and four row dumps came through it on the first run — a `.jsonl` of
     * games and a `window.` bundle are read by their consumers exactly as a config file is. The id
     * in them is a RECORDED FACT about the run that wrote them, so re-pointing it would be
     * falsifying a record rather than changing a setting. */
    if (/\.jsonl$/i.test(rel)) return { cls: 'DERIVED', why: 'row dump — the id is a recorded fact, one row per game or run', live };
    if (/^\s*(window|globalThis)\s*\./.test(text)) return { cls: 'DERIVED', why: 'browser data bundle', live };
    if (hasGenerationStamp(rel, text)) return { cls: 'DERIVED', why: 'carries a generation stamp', live };
    if (readAsSetting(rel)) return { cls: 'CONFIGURATION', why: 'no generation stamp, and tracked source READS it by name', live };
    return { cls: 'UNDECIDED', why: 'under data/, no generation stamp, nothing reads it by name — a human says whether it is a setting or a record', live };
  }
  if (/^\.git(ignore|attributes)$/.test(rel)) return { cls: 'CONFIGURATION', why: 'repository-level setting', live };
  if (SOURCE_EXT.test(rel)) {
    if (!live.length) return { cls: 'COMMENTED', why: 'source file, id appears only in comments', live };
    return { cls: 'HARDCODED', why: 'id on a live line of code', live };
  }
  if (/\.md$/i.test(rel)) return { cls: 'PROSE', why: 'living document', live };
  return { cls: 'UNDECIDED', why: 'no structural rule matches this path', live };
}

/* ---- the walk ---------------------------------------------------------------------------------- */
function inventory() {
  const rows = [];
  const seen = new Set();
  const allIds = new Set();
  const tracked = trackedFiles();
  for (const rel of tracked) {
    let st;
    try { st = fs.statSync(path.join(ROOT, rel)); } catch (e) { UNREADABLE.push(rel + ': ' + e.code); continue; }
    if (BINARY.test(rel)) { SKIPPED.push(rel + ' [binary]'); continue; }
    if (st.size > MAX_BYTES) { SKIPPED.push(rel + ' [' + (st.size / 1e6).toFixed(0) + ' MB]'); continue; }
    let text;
    try { text = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { UNREADABLE.push(rel + ': ' + e.code); continue; }

    ID_SHAPE.lastIndex = 0;
    const ids = new Set();
    let m;
    while ((m = ID_SHAPE.exec(text))) ids.add(m[0].toLowerCase());

    if (!ids.size) continue;
    for (const id of ids) allIds.add(id);
    const c = classify(rel, text);
    rows.push({ rel, ids: [...ids], tokenOnly: [], cls: c.cls, why: c.why, live: c.live || [] });
    seen.add(rel);
  }

  /* THE BARE TOKEN IS A SECOND POPULATION AND IT IS MATCHED ON THE PATH ONLY.
   * `data/archive/regmb/…` names no format id in any of its files — the regulation is in the
   * directory name and nowhere else, so an id-only scan reports the archive as untouched. Content
   * is deliberately NOT token-scanned: a document writing "Reg M-B" in a sentence is prose the
   * PROSE class already carries, and matching it would bury the actionable list in English. */
  TOKEN_SHAPE = tokenShapeFrom(allIds);
  if (TOKEN_SHAPE) {
    for (const rel of tracked) {
      if (seen.has(rel)) continue;
      TOKEN_SHAPE.lastIndex = 0;
      const t = new Set();
      let m;
      while ((m = TOKEN_SHAPE.exec(rel))) t.add(m[0].toLowerCase());
      if (!t.size) continue;
      let text = '';
      try { if (!BINARY.test(rel)) text = fs.readFileSync(path.join(ROOT, rel), 'utf8').slice(0, 8192); }
      catch (e) { UNREADABLE.push(rel + ': ' + e.code); }
      const c = classify(rel, text);
      rows.push({ rel, ids: [], tokenOnly: [...t], cls: c.cls, why: c.why + ' [regulation named in the PATH]', live: c.live || [] });
    }
  }
  return rows;
}

/* ---- THE BLIND SPOT, AND IT IS BIGGER THAN A CAVEAT --------------------------------------------
 *
 * Everything above finds a file by the regulation ID IN IT. A measurement is bound to a regulation
 * by three more things that carry no id at all — a FROZEN CORPUS path, a census pin and a release
 * id — and all three are typed into the callers as literal paths. `data/team-pool-frozen` is the
 * one this repository leans on hardest: it is the pinned pool every board-material figure rests on,
 * it is M-B's by construction, and the scan above cannot see a single one of its call sites.
 *
 * A frozen corpus ANNOUNCES ITSELF — it carries a FROZEN marker file — so the set is derived here
 * rather than typed, and a second pinned corpus added later is picked up with no edit. */
function frozenCorpora() {
  const out = [];
  const base = path.join(ROOT, 'data');
  let ents = [];
  try { ents = fs.readdirSync(base, { withFileTypes: true }); }
  catch (e) { UNREADABLE.push('data/: ' + e.code); return out; }
  for (const e of ents) {
    if (!e.isDirectory()) continue;
    let inner = [];
    /* NOT SILENT, same reason as everywhere else in this file: a directory that cannot be read is a
     * corpus whose pinned/unpinned status is UNKNOWN, not absent — and this block's whole job is to
     * name the pins the id scan is blind to. */
    try { inner = fs.readdirSync(path.join(base, e.name)); }
    catch (err) { UNREADABLE.push('data/' + e.name + '/: ' + err.code); continue; }
    if (!inner.some(f => /^FROZEN/i.test(f))) continue;
    const rel = 'data/' + e.name;
    const callers = sourceCorpus().split('\n').filter(l => l.includes(rel)).length;
    out.push({ rel, callers });
  }
  return out;
}

/* ---- reporting --------------------------------------------------------------------------------- */
const ORDER = ['CONFIGURATION', 'HARDCODED', 'UNDECIDED', 'DERIVED', 'COMMENTED', 'PROSE', 'HISTORICAL'];
const MEANS = {
  CONFIGURATION: 'EDIT — the id is a setting; everything downstream follows it',
  HARDCODED: 'DECIDE, per site — it keeps working about the OLD regulation after the flip',
  UNDECIDED: 'READ IT — no structural rule fits; a human says which class it is',
  DERIVED: 'RE-RUN its generator — no edit; the figure is about the old regulation until then',
  COMMENTED: 'READ ONCE — the id is only in a comment; stale prose inside live code',
  PROSE: 'REWRITE at the documentation pass — judgement, not a find-and-replace',
  HISTORICAL: 'LEAVE IT — dated evidence; rewriting it edits the evidence chain',
};

function printRules() {
  console.log('THE CLASSIFICATION RULES, in order — first match wins\n');
  console.log('  1. HISTORICAL   path under a write-once root:');
  for (const re of WRITE_ONCE) console.log('                    ' + re.source);
  console.log('  2. HISTORICAL   filename carries a date or a 12-hex release id: ' + DATED_NAME.source);
  console.log('  3. DERIVED      under data/ AND carries a generation stamp');
  console.log('                    a top-level key matching ' + STAMP_KEY.source);
  console.log('                    or ' + GENERATED_MARKER.source + ' in the first 4096 bytes');
  console.log('  4. CONFIGURATION  under data/, no stamp, and tracked source READS it by name');
  console.log('                    read verb: ' + READ_VERB.source);
  console.log('  5. UNDECIDED    under data/, no stamp, nothing reads it by name');
  console.log('  6. CONFIGURATION  a repository-level dotfile setting');
  console.log('  7. HARDCODED    a source file (' + SOURCE_EXT.source + ') with the id on a non-comment line');
  console.log('  8. COMMENTED    a source file whose id is only in comments');
  console.log('  9. PROSE        a living .md');
  console.log('\n  The bare regulation TOKEN is matched on the PATH only, and the token set is derived');
  console.log('  from the ids actually found — never from a pattern. A pattern matched `regex`.');
  console.log('\n  The id shape is engine/next_regulation.js VGC_REG. The comment and call-site');
  console.log('  predicates are engine/format_id_scan.js COMMENT and CALL. None is restated here.');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--rules')) return printRules();

  const rows = inventory();
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ rows, skipped: SKIPPED, unreadable: UNREADABLE }, null, 1));
    return;
  }

  const want = argv.includes('--class') ? String(argv[argv.indexOf('--class') + 1] || '').toUpperCase() : null;
  const by = new Map(ORDER.map(c => [c, []]));
  for (const r of rows) (by.get(r.cls) || by.set(r.cls, []).get(r.cls)).push(r);

  console.log('REGULATION TOUCHPOINTS — every tracked file naming a Champions regulation\n');
  console.log(`  ${rows.length} file(s) name a regulation id or token.`);
  console.log(`  ${SKIPPED.length} skipped (binary or over ${(MAX_BYTES / 1048576).toFixed(0)} MiB), ${UNREADABLE.length} unreadable.`);
  if (UNREADABLE.length) {
    /* NOT SILENT: a file this cannot read is a file whose relation to the rotation is UNKNOWN,
     * not absent, and this command's whole value is completeness. */
    console.log('  UNREADABLE, so the inventory below is INCOMPLETE: ' + UNREADABLE.join('; '));
  }
  if (UNPARSEABLE.length) {
    console.log(`  ${UNPARSEABLE.length} JSON artifact(s) would not parse, so their generation stamp could not be`);
    console.log('  read and they were classed on the weaker textual marker alone: ' + UNPARSEABLE.join('; '));
  }
  console.log('');
  for (const c of ORDER) {
    const n = (by.get(c) || []).length;
    console.log(`  ${c.padEnd(14)} ${String(n).padStart(5)}   ${MEANS[c]}`);
  }
  console.log('\n  node engine/regulation_touchpoints.js --rules   how each class was decided');

  const show = want ? [want] : ['CONFIGURATION', 'HARDCODED', 'UNDECIDED'];
  for (const c of show) {
    const list = (by.get(c) || []).slice().sort((a, b) => a.rel.localeCompare(b.rel));
    if (!list.length) continue;
    console.log(`\n  ${c} — ${MEANS[c]}\n`);
    for (const r of list) {
      const ids = r.ids.length ? r.ids.join(' ') : r.tokenOnly.join(' ') + ' [token only]';
      console.log(`    ${r.rel}`);
      console.log(`      ${ids}`);
      if (want && r.live.length) {
        for (const l of r.live) console.log(`      :${l.line}  ${l.id}${l.callSite ? '   [CALL SITE — engine/format_id_scan.js sees this one]' : ''}`);
      }
    }
  }

  const frozen = frozenCorpora();
  if (frozen.length) {
    console.log('\n  BLIND SPOT — a regulation is also pinned by paths that carry NO regulation id,');
    console.log('  so nothing above can see them. Derived from the FROZEN marker each corpus carries:\n');
    for (const f of frozen) console.log(`    ${f.rel}   named on ${f.callers} live source line(s)`);
    console.log('\n    A frozen corpus is the OUTGOING regulation by construction. It is not re-pointed:');
    console.log('    the new regulation gets its OWN pinned pool, and every caller decides which it means.');
    console.log('    The census pin and the release set are bound the same way — see docs/REGULATION-ROTATION.md.');
  }

  if (!want) {
    console.log('\n  The other classes are large and are not printed by default:');
    console.log('    node engine/regulation_touchpoints.js --class derived | prose | historical');
    console.log('\n  The ORDER of the flip is not here — it follows the invalidation graph and no scan');
    console.log('  derives that: node engine/next_regulation.js --checklist, and docs/REGULATION-ROTATION.md.');
  }
}

module.exports = { inventory, classify, ID_SHAPE, WRITE_ONCE, hasGenerationStamp };

if (require.main === module) main();
