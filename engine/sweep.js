/* sweep.js — WHAT DOES EACH GATE FAIL TO CHECK ABOUT ITSELF?
 *
 *   node engine/sweep.js              the verdict and a count per section
 *   node engine/sweep.js --verbose    ... and every name behind every count
 *
 * ================= WHY THIS EXISTS (2026-09-04) =====================================================
 *
 * Six real defects were found in this repository on one day, and in EVERY ONE the repo already knew
 * and nothing acted:
 *
 *   the gate certified MEDICHAM correct on a population where 944 of 961 games never end — and
 *     `status.js` was already printing `driver policies the gate quotes — 1 of 2`, on line 103 of a
 *     253-line output, where it was skimmed;
 *   `durable-ingest.js:464` explains in a comment that the store and the raw archive drift silently
 *     and says "RUN THIS BEFORE ANY REPARSE" — nothing ran it;
 *   `tests/run-all.js` was RED reporting 59 unaccounted checks and the red was carried;
 *   `app/quarantine-data.js` publishes a gate verdict that the live gate contradicts, and
 *     `web/quarantine-data.js` publishes a DIFFERENT one;
 *   `data/engine-diff.json` — the artifact behind the clause reading `0 of 6000` — carries no release
 *     pin, so it structurally cannot notice it is answering about bytes that no longer exist;
 *   187 `MEDFAILS` counters increment and nothing reads them.
 *
 * THE COMMON SHAPE IS NOT IGNORANCE. IT IS UNEXECUTED KNOWLEDGE. Every one of those facts was
 * derivable, most of them were literally written down, and each sat behind a verdict somebody read
 * instead. So this file asks the question no existing instrument asks: not "what is the engine
 * wrong about" and not "what does a number not cover", but WHAT DOES AN INSTRUMENT NOT CHECK ABOUT
 * ITSELF.
 *
 * ================= IT IS NOT coverage.js AND IT IS NOT status.js ====================================
 *
 * `engine/status.js` prints the STATE. `engine/coverage.js` prints what a gate NUMBER does not cover —
 * the skipped rows, the unfired mechanics, the turn cap. Both are about the ENGINE. This is about the
 * INSTRUMENTS: a check nobody runs, a clause that cannot see its own inputs move, a figure published
 * off an artifact that has since changed, a counter with no reader, a store row with no source.
 *
 * If a finding is "this number excludes N rows", it belongs in coverage.js and must stay there.
 * If a finding is "nothing would notice if this number were wrong", it belongs here.
 *
 * ================= IT DERIVES OR IT SAYS SO =========================================================
 *
 * Same discipline as engine/orient.js, and for the same reason: a map that silently drops a section
 * reads as though the section does not exist. So a section that cannot compute prints
 * `CANNOT DERIVE: <SECTION> — <reason>` and the run exits non-zero. It never prints a blank, never a
 * cached value, never quietly omits itself. `SWEEP_BREAK=<n>` blanks one section's input on purpose so
 * each failure path can be shown red rather than assumed reachable.
 *
 * NOTHING BELOW IS A TYPED LIST OF TODAY'S FIVE INSTANCES. Enumerating them would be worthless — the
 * test is whether a section catches a SECOND instance, spelled differently, through another door. Each
 * section says on its own head what class it derives and what class it will miss.
 *
 * ================= AND IT IS SHORT, WHICH IS LOAD-BEARING ===========================================
 *
 * The `1 of 2` row failed because it was inside 253 lines. A sweep nobody finishes is the bug it was
 * built to fix. The default output is a verdict and one line per section; names live behind
 * `--verbose`. Do not "improve" this into a report.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose') || argv.includes('-v');
const BREAK = String(process.env.SWEEP_BREAK || '');
const broken = n => BREAK === String(n);

/* NO SILENT CATCH. Every read below can legitimately fail — an artifact that was never generated is a
 * real state. What may not happen is the failure vanishing: this file's whole subject is knowledge
 * that existed and was not acted on, so a read that failed and said nothing would be the defect
 * wearing the instrument's clothes. tests/test-no-silent-failure.js enforces the same rule. */
const SWFAILS = { read: 0, first: '', parse: 0, parseFirst: '' };
function readFile(f) {
  try { return fs.readFileSync(f, 'utf8'); }
  catch (e) { SWFAILS.read++; if (!SWFAILS.first) SWFAILS.first = f + ': ' + e.code; return null; }
}
function readJson(f) {
  const t = readFile(f);
  if (t == null) return null;
  try { return JSON.parse(t); }
  catch (e) { SWFAILS.parse++; if (!SWFAILS.parseFirst) SWFAILS.parseFirst = f + ': ' + e.message; return null; }
}

const FAILURES = [];
const SECTIONS = [];
function cannot(n, title, reason) {
  FAILURES.push(n);
  SECTIONS.push({ n, title, count: null, head: 'CANNOT DERIVE — ' + reason, detail: [] });
}
function found(n, title, count, head, detail) {
  SECTIONS.push({ n, title, count, head, detail: detail || [] });
}

/* Comment and string stripping, shared by every source-scanning section. A NAME DISCUSSED IN PROSE IS
 * NOT A USE — engine/quarantine.js records the same lesson twice, and here it decides whether a
 * counter has a reader. Strings go too: `console.log('MEDFAILS.foo = ...')` mentions a counter and
 * reads nothing. */
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ');
const stripStrings = s => s.replace(/'(\\.|[^'\\\n])*'/g, "''")
                           .replace(/"(\\.|[^"\\\n])*"/g, '""')
                           .replace(/`(\\.|[^\\`])*`/g, '``');

/* ================================================================================================
 * 1. CHECKS THAT NOTHING RUNS
 * ================================================================================================
 * NOT REIMPLEMENTED. `tests/run-all.js` already derives this set — it globs both directories, applies
 * its own `looksLikeACheck` predicate, and subtracts its two by-name exemption tables. A second
 * implementation of that question is the failure this repository has already paid for: three copies of
 * the closed-row detector disagreed on 24 of 292 rows, in both directions, and both kept working.
 *
 * run-all.js exports nothing and runs the whole suite at module scope, so it cannot be required. It
 * does have a read-only entrypoint built for exactly this — `--coverage` computes the verdict and
 * spawns no child — so that is what is called, and its ANSWER is parsed rather than its question
 * re-asked. The parse is checked against the runner's own declared count; if the two disagree, the
 * shape of that output has changed and this section says CANNOT DERIVE instead of guessing.
 *
 * WHAT THIS MISSES: whatever `looksLikeACheck` misses. A check that neither prints a pass/fail line
 * nor exits non-zero with the word FAIL is invisible to the runner and therefore invisible here. That
 * is one predicate for the whole repository, which is the point — widen it there, not here. */
function section1() {
  const t0 = Date.now();
  const r = broken(1) ? { stdout: '', stderr: 'SWEEP_BREAK=1', status: null }
    : spawnSync(process.execPath, [D('tests', 'run-all.js'), '--coverage'],
                { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  const m = out.match(/(\d+)\s+named NOT A CHECK,\s+(\d+)\s+named PENDING-WIRE,\s+(\d+)\s+unaccounted for/);
  if (!m) {
    return cannot(1, 'CHECKS THAT NOTHING RUNS',
      'tests/run-all.js --coverage printed no coverage summary line (exit ' + r.status + '). Its output '
      + 'shape changed, or it failed to start. NOT reimplemented here on purpose.');
  }
  const declared = +m[3];
  const lines = out.split('\n');
  const i = lines.findIndex(l => /UNACCOUNTED-FOR CHECK/.test(l));
  const names = [];
  if (i >= 0) {
    for (let j = i + 1; j < lines.length; j++) {
      const p = lines[j].match(/^ {4}(\S+\.(?:js|py))\s*$/);
      if (p) names.push(p[1]);
      else if (names.length) break;          /* the list is contiguous; the first miss after it ends it */
    }
  }
  /* AN ENUMERATION WHOSE PARTS DO NOT ADD UP IS HIDING SOMETHING (orient.js §7). The runner says how
   * many there are; if this file cannot name that many, the parse is wrong and saying "0" would be a
   * clean bill of health produced by a broken reader. */
  if (names.length !== declared) {
    return cannot(1, 'CHECKS THAT NOTHING RUNS',
      'run-all.js declares ' + declared + ' unaccounted check(s) and this parse recovered ' +
      names.length + ' name(s). The output shape moved — fix the parse, do not publish the smaller number.');
  }
  found(1, 'CHECKS THAT NOTHING RUNS', declared,
    declared + ' file(s) report a pass/fail verdict that no runner, gate or hook invokes'
    + ' (+' + m[2] + ' named PENDING-WIRE, which is a promise, not a runner)'
    + '   [' + ((Date.now() - t0) / 1000).toFixed(1) + 's, from tests/run-all.js --coverage]',
    names);
}

/* ================================================================================================
 * 2. CLAUSES THAT CANNOT NOTICE THEIR OWN ARTIFACT IS STALE
 * ================================================================================================
 * CLAUDE.md: a measurement pins THREE things — the RELEASE (which bytes), the POPULATION (which games,
 * which pool, which census) and the POLICY (what drove the decisions). A clause reading an artifact
 * that records none of them is not wrong today; it is a clause that CANNOT BECOME WRONG OUT LOUD.
 *
 * Three derivations, in decreasing strength:
 *
 *   THE PIN VOCABULARY IS DERIVED FOR THE RELEASE HALF. `engine/engine_release.js`'s `stamp()` is the
 *   one function in this repo that decides what a release pin looks like, so its returned key names
 *   are read out of its source at run time. Add a field to stamp() and this section knows about it
 *   with no edit. Zero keys recovered from it is a CANNOT DERIVE, not a silent fallback.
 *
 *   THE POPULATION AND POLICY HALVES ARE A NAME VOCABULARY, and that is weaker — the same weakness
 *   coverage.js's exclusion vocabulary declares on its own head. A pool pinned under a name outside it
 *   IS MISSED. The mitigation, and it is only partial: --verbose prints every depth<=2 key of each
 *   clause artifact that the vocabulary did not classify, so a reader auditing a new artifact sees the
 *   names that exist rather than only the ones that were recognised.
 *
 *   WHETHER THE CLAUSE READS THE PIN is derived from source: the producing function is located by its
 *   own clause-name literal inside engine/quarantine.js, together with the local functions called
 *   beside it (that second hop is what reaches `rosterStage`, which the assembler wraps). A clause
 *   whose producer cannot be located is NAMED as unattributed, never assumed clean.
 *
 * ONLY AN ARTIFACT THAT MEASURED A SAMPLE IS ASKED FOR A POPULATION PIN. A clause computing off the
 * live tree has nothing to be stale against, and a deliberate roster IS its own population. Asking
 * every clause for every pin would cry wolf, and an over-firing gate is the one people learn to
 * ignore. */
/* THE STAMP KEYS ARE THE DERIVED CORE AND THEY ARE NOT THE WHOLE SET. `data/all-mechanics-fire.json`
 * pins its release under the older, shorter name `release`, and the gate reads
 * `j.release || j.engine_release` — so a set taken from stamp() alone ACCUSES A PINNED ARTIFACT OF
 * having no pin, which is the cry-wolf failure. The anchored name form is admitted alongside it. */
const REL_NAME_RX = /(^|_)release(s)?($|_)/i;
const POP_RX = /^(pool|team_pool|team_store|teamstore|population|corpus|store|sample|census|games_from|drawn_from)/i;
const POL_RX = /^(steering|policy|driver|chooser|baseline_mode|run_mode|arm|mode)$|_(policy|driver)$/i;
const SAMPLE_RX = /^(games|games_played|compared|requested|rows|n|sample_size|played)$/i;

function stampKeys() {
  const src = readFile(D('engine', 'engine_release.js'));
  if (!src) return null;
  const m = src.match(/stamp\(\)\s*\{\s*return\s*\{([\s\S]*?)\};/);
  if (!m) return null;
  const keys = [...m[1].matchAll(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/gm)].map(x => x[1]);
  return keys.length ? keys : null;
}

/* depth<=2 only. Below that the vocabulary starts matching MECHANIC data rather than run bookkeeping —
 * the same line coverage.js draws, and for the same reason: `unshared_address_shapes["crit
 * populationbomb"]` is a fact about a move, not a population somebody pinned. */
function keyPaths(o, depth = 2) {
  const out = [];
  (function w(x, pre, d) {
    if (!x || typeof x !== 'object' || Array.isArray(x) || d > depth) return;
    for (const k of Object.keys(x)) {
      if (/\s/.test(k)) continue;                       /* a key with a space is data, not a field */
      const p = pre ? pre + '.' + k : k;
      out.push({ path: p, key: k, v: x[k] });
      w(x[k], p, d + 1);
    }
  })(o, '', 0);
  return out;
}

function section2() {
  let Q, C;
  try { Q = require('./quarantine.js'); C = require('./coverage.js'); }
  catch (e) { return cannot(2, 'CLAUSES BLIND TO THEIR OWN STALENESS',
    'engine/quarantine.js or engine/coverage.js did not load: ' + e.message); }
  const REL = broken(2) ? null : stampKeys();
  if (!REL) return cannot(2, 'CLAUSES BLIND TO THEIR OWN STALENESS',
    'could not read the key names out of stamp() in engine/engine_release.js — that function is the '
    + 'only authority on what a release pin looks like, and a typed substitute is how the ban list of '
    + 'four went stale.');
  const RELSET = new Set(REL);

  let clauses;
  try { clauses = Q.medichamIsCorrect().clauses; }
  catch (e) { return cannot(2, 'CLAUSES BLIND TO THEIR OWN STALENESS',
    'quarantine.medichamIsCorrect() threw: ' + e.message); }
  if (!clauses || !clauses.length) return cannot(2, 'CLAUSES BLIND TO THEIR OWN STALENESS',
    'the gate returned no clauses at all');

  /* THE PRODUCER MAP, derived from quarantine.js's own source. */
  const qsrc = stripComments(readFile(D('engine', 'quarantine.js')) || '');
  const fnNames = [...qsrc.matchAll(/^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm)].map(m => m[1]);
  const fnBody = {};
  for (const n of fnNames) {
    const i = qsrc.indexOf('function ' + n + '(');
    if (i < 0) continue;
    const j = qsrc.indexOf('\nfunction ', i + 1);
    fnBody[n] = qsrc.slice(i, j < 0 ? qsrc.length : j);
  }
  function producerSource(name) {
    /* the literal may be whole ('game differential') or the static head of a template
     * (`deliberate roster / ${s}`), so a prefix of decreasing length is tried. */
    for (let cut = name.length; cut >= 8; cut -= 1) {
      const frag = name.slice(0, cut);
      for (const n of fnNames) {
        const b = fnBody[n]; if (!b) continue;
        const at = b.indexOf(frag);
        if (at < 0) continue;
        /* the assembler names the clause and DELEGATES; take the local calls beside the literal too,
         * which is the hop that reaches rosterStage. */
        const win = b.slice(Math.max(0, at - 600), at + 600);
        let src = b;
        for (const c of win.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g))
          if (fnBody[c[1]] && c[1] !== n) src += '\n' + fnBody[c[1]];
        /* STRINGS OUT. A pin NAMED IN A MESSAGE is not a pin the clause READ — `'…data/team-pool-frozen,
         * cap 12, 961 games…'` sits in a `why` string one function away and would have cleared the very
         * clause this section is asking about. Same lesson as the require-inside-a-comment rule. */
        return { fn: n, src: stripStrings(src) };
      }
    }
    return null;
  }

  const cache = {};
  const rows = [], detail = [];
  let blind = 0, unattributed = 0;
  for (const c of clauses) {
    let file = null;
    try { file = C.clauseArtifact(c, cache); }
    catch (e) { SWFAILS.read++; if (!SWFAILS.first) SWFAILS.first = 'clauseArtifact: ' + e.message; }
    if (!file) {
      /* NOT A FINDING. A clause with no artifact computes off the live tree every run, so there is
       * nothing for it to be stale against. It is printed under --verbose so the count of clauses
       * examined still adds up. */
      detail.push(c.name + '  —  no artifact; computed from the live tree each run');
      continue;
    }
    const j = readJson(D('data', file));
    if (!j) { detail.push(c.name + '  —  data/' + file + ' UNREADABLE; treated as unpinned'); blind++; continue; }
    const kp = keyPaths(j);
    const hasRel = kp.filter(k => RELSET.has(k.key) || REL_NAME_RX.test(k.key));
    const hasPop = kp.filter(k => POP_RX.test(k.key));
    const hasPol = kp.filter(k => POL_RX.test(k.key));
    const isSample = kp.some(k => k.path.indexOf('.') < 0 && typeof k.v === 'number' && SAMPLE_RX.test(k.key));
    const prod = producerSource(c.name);
    if (!prod) unattributed++;
    const reads = key => prod ? new RegExp('\\b' + key + '\\b').test(prod.src) : null;

    const gaps = [];
    if (!hasRel.length) gaps.push('NO RELEASE PIN — cannot notice the bytes moved');
    else if (prod && !hasRel.some(k => reads(k.key))) gaps.push('release pin RECORDED BUT NOT READ by ' + prod.fn + '()');
    if (isSample && !hasPop.length) gaps.push('NO POPULATION PIN on a run that measured a sample');
    else if (isSample && prod && !hasPop.some(k => reads(k.key))) gaps.push('population pin RECORDED BUT NOT READ by ' + prod.fn + '()');
    if (isSample && !hasPol.length) gaps.push('NO POLICY PIN on a run that measured a sample');

    const block = gaps.length ? rows : detail;
    if (gaps.length) { blind++; block.push(c.name + '  [data/' + file + ']'); for (const g of gaps) block.push('      ' + g); }
    else block.push(c.name + '  [data/' + file + ']  pinned: '
      + hasRel.map(k => k.key).concat(hasPop.map(k => k.path), hasPol.map(k => k.path)).join(', '));
    if (VERBOSE) {
      /* THE VOCABULARY'S OWN BLIND SPOT, PRINTED. A pin spelled outside POP_RX/POL_RX is missed and
       * there is no mechanical defence against that; naming the keys that exist is the partial one. */
      const un = kp.filter(k => k.path.indexOf('.') < 0 && !RELSET.has(k.key) && !REL_NAME_RX.test(k.key)
        && !POP_RX.test(k.key) && !POL_RX.test(k.key)).map(k => k.key);
      block.push('      keys the pin vocabulary did NOT classify (' + un.length + '): '
        + (un.slice(0, 16).join(' ') || '(none)') + (un.length > 16 ? ' ...' : ''));
    }
  }
  found(2, 'CLAUSES BLIND TO THEIR OWN STALENESS', blind,
    blind + ' of ' + clauses.length + ' gate clause(s) read an artifact that does not record, or does '
    + 'not check, what it was measured under'
    + (unattributed ? '   (' + unattributed + ' clause(s) could not be attributed to a producing function)' : ''),
    rows.concat(detail));
}

/* ================================================================================================
 * 3. PUBLISHED FIGURES THAT NO LONGER MATCH THEIR ARTIFACT
 * ================================================================================================
 * A CITATION PROVES A FIGURE HAD A SOURCE. IT NEVER PROVES THE SOURCE STILL SAYS IT.
 *
 * A publication is any file under web/ or app/ carrying an embedded object with a `generated` stamp.
 * That is derived from the shape of the file, not from a list of pages, so a new bundle is covered on
 * the day it is written. Three questions are asked of each:
 *
 *   (a) STALE BY CITATION — the publication names data/x.json and that artifact's own `generated`
 *       stamp is newer than the publication's. This is a fact about two timestamps and cannot be
 *       argued with.
 *   (b) CONTRADICTED — a number published inside a string that cites data/x.json, which does not occur
 *       anywhere in data/x.json today. This is the strong one: it catches a figure that is wrong even
 *       when the timestamps happen to look fine. Deliberately lenient — 0 and 1 are skipped as too
 *       common, and the artifact's numbers are taken from its whole serialisation including prose, so
 *       a hit here means the number is genuinely absent.
 *   (c) TWO PUBLICATIONS OF ONE FACT DISAGREE — grouped by their own `by` field, which is the
 *       publication's own claim about which generator produced it. Two files claiming one generator
 *       and holding different values is a contradiction with no interpretation required.
 *
 * WHAT THIS MISSES: a number typed into HTML prose with no embedded object and no citation. There is
 * nothing to compare it against, which is a defect in the page rather than a gap here — but it IS a
 * gap, and it is stated rather than hidden. */
/* ANCHORED ON `"generated"`, NOT ON `{`. The first version walked every opening brace in the file and
 * brace-matched forward from each, which is O(braces x length) on a 300 KB page and cost seconds per
 * file. A publication stamps `generated` as its first or near-first key, so the candidates are the few
 * braces immediately preceding one. */
function embeddedObjects(text) {
  const out = [];
  let from = 0, g;
  while ((g = text.indexOf('"generated"', from)) >= 0) {
    from = g + 1;
    let b = -1;
    for (let k = g; k >= Math.max(0, g - 400); k--) if (text[k] === '{') { b = k; break; }
    if (b < 0) continue;
    let d = 0, inS = false, esc = false, q = '', end = -1;
    for (let k = b; k < text.length; k++) {
      const ch = text[k];
      if (inS) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === q) inS = false; continue; }
      if (ch === '"' || ch === "'") { inS = true; q = ch; continue; }
      if (ch === '{') d++;
      else if (ch === '}') { d--; if (!d) { end = k; break; } }
    }
    if (end < 0) continue;
    let o = null;
    try { o = JSON.parse(text.slice(b, end + 1)); }
    catch (e) { SWFAILS.parse++; if (!SWFAILS.parseFirst) SWFAILS.parseFirst = 'embedded object: ' + e.message; }
    if (o && o.generated) { out.push(o); from = end + 1; }
  }
  return out;
}
const numbersIn = s => new Set((JSON.stringify(s).match(/\d+(?:\.\d+)?/g) || []));

/* Every data/*.json named inside a string that also carries a figure — that string is a published
 * claim about that artifact. A citation standing alone in a list is membership, not a figure. */
function citationsWithFigures(o) {
  const out = [];
  (function walk(x, d) {
    if (d > 6 || !x) return;
    if (typeof x === 'string') {
      const m = x.match(/data\/[A-Za-z0-9_.\-]+\.json/g);
      if (!m) return;
      const rest = x.replace(/data\/[A-Za-z0-9_.\-]+\.json/g, ' ');
      if (!/\d/.test(rest)) return;
      out.push(...m);
      return;
    }
    if (typeof x === 'object') for (const k of Object.keys(x)) walk(x[k], d + 1);
  })(o, 0);
  return out;
}

function section3() {
  const pubs = [];
  for (const dir of ['web', 'app']) {
    let fl = [];
    try { fl = fs.readdirSync(D(dir)); }
    catch (e) { SWFAILS.read++; if (!SWFAILS.first) SWFAILS.first = dir + ': ' + e.code; continue; }
    for (const f of fl) {
      if (!/\.(js|json|html)$/.test(f)) continue;
      const t = broken(3) ? '' : (readFile(D(dir, f)) || '');
      for (const o of embeddedObjects(t)) pubs.push({ file: dir + '/' + f, o });
    }
  }
  if (!pubs.length) return cannot(3, 'PUBLISHED FIGURES OUT OF DATE',
    'no file under web/ or app/ carries an embedded object with a `generated` stamp — either the '
    + 'publication shape changed or those directories are gone. A clean answer here would be a '
    + 'reader that found nothing, not a site that publishes nothing.');

  const artCache = {};
  const art = f => (f in artCache) ? artCache[f] : (artCache[f] = readJson(D(f)));
  /* CACHED, because it is a full re-serialisation of a multi-megabyte artifact and the walk below hits
   * the same file once per published string. Uncached it cost 37 of this file's 40 seconds. */
  const numCache = {};
  const numsOf = f => (f in numCache) ? numCache[f] : (numCache[f] = numbersIn(art(f)));
  const rows = [];
  let stale = 0, contra = 0, disagree = 0, missing = 0;

  for (const p of pubs) {
    const pg = Date.parse(p.o.generated);
    /* A CITATION WITH NO NUMBER BESIDE IT PUBLISHES NO FIGURE. The first version of this matched every
     * `data/*.json` anywhere in the file and reported 34 of them per page, because the quarantine
     * bundle carries the WITHHELD LIST — a membership roll, not a claim about a value. Drowning the
     * real row in thirty-three true-but-irrelevant ones is precisely the failure this file exists to
     * fix, so a citation counts only where it sits in the same string as a published figure. */
    const cited = [...new Set(citationsWithFigures(p.o))];
    const hits = [];
    for (const c of cited) {
      const j = art(c);
      /* A CITATION TO A FILE THAT IS NOT THERE IS WORSE THAN A STALE ONE — the figure has no source at
       * all, and it reads exactly like a sourced figure. Counted here rather than skipped, which is
       * what the first version did. */
      if (!j) { hits.push(c + ' DOES NOT EXIST — this figure has no source at all'); missing++; continue; }
      if (!j.generated) continue;
      const ag = Date.parse(j.generated);
      if (Number.isFinite(pg) && Number.isFinite(ag) && ag > pg)
        hits.push(c + ' regenerated ' + ((ag - pg) / 864e5).toFixed(1) + ' days after this was published');
    }
    if (hits.length) { stale++; rows.push('STALE   ' + p.file + '  (' + p.o.generated + ')');
      for (const h of hits.slice(0, VERBOSE ? 99 : 3)) rows.push('      ' + h); }

    /* (b) the strong one — a cited number the artifact does not contain. */
    const bad = [];
    (function walk(o, d) {
      if (d > 6 || !o) return;
      if (typeof o === 'string') {
        const m = o.match(/data\/[A-Za-z0-9_.\-]+\.json/);
        if (!m) return;
        if (!art(m[0])) return;
        const have = numsOf(m[0]);
        const said = (o.replace(/data\/[A-Za-z0-9_.\-]+\.json/g, ' ').match(/\d+(?:\.\d+)?/g) || [])
          .filter(n => +n > 1);
        const miss = [...new Set(said)].filter(n => !have.has(n));
        if (miss.length) bad.push(m[0] + ' no longer contains ' + miss.slice(0, 6).join(', '));
        return;
      }
      if (typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], d + 1);
    })(p.o, 0);
    if (bad.length) { contra++; rows.push('CONTRA  ' + p.file);
      for (const b of [...new Set(bad)].slice(0, VERBOSE ? 99 : 3)) rows.push('      ' + b); }
  }

  /* (c) two publications claiming one generator. */
  const byGen = {};
  for (const p of pubs) if (p.o.by) (byGen[p.o.by] = byGen[p.o.by] || []).push(p);
  for (const gen of Object.keys(byGen)) {
    const g = byGen[gen];
    if (g.length < 2) continue;
    for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) {
      const diff = [];
      for (const k of Object.keys(g[a].o)) {
        if (k === 'generated' || !(k in g[b].o)) continue;
        const x = g[a].o[k], y = g[b].o[k];
        if (typeof x === 'object' || typeof y === 'object') continue;
        if (x !== y) diff.push(k + ': ' + JSON.stringify(x) + ' vs ' + JSON.stringify(y));
      }
      if (diff.length) { disagree++;
        rows.push('DISAGREE ' + g[a].file + '  vs  ' + g[b].file + '   (both claim ' + gen + ')');
        for (const d of diff.slice(0, VERBOSE ? 99 : 4)) rows.push('      ' + d); }
    }
  }

  found(3, 'PUBLISHED FIGURES OUT OF DATE', stale + contra + disagree,
    stale + ' publication(s) stale against a cited artifact, ' + contra + ' publishing a number that '
    + 'artifact no longer contains, ' + disagree + ' pair(s) disagreeing'
    + (missing ? ', ' + missing + ' citation(s) to an artifact that does not exist' : '')
    + '   [' + pubs.length + ' publication(s) scanned under web/ and app/]', rows);
}

/* ================================================================================================
 * 4. COUNTERS THAT NOTHING READS
 * ================================================================================================
 * CLAUDE.md: "A capability that cannot prove it ran is assumed broken." A counter is how a capability
 * proves it ran — and a counter with no reader proves nothing at all. `++` is not recording; it is
 * arithmetic performed in private.
 *
 * DERIVED, NOT ACCEPTED FROM A LIST. A counter is any `NAME.prop++` or `NAME.prop +=` where NAME is
 * capitalised, found by scanning source with comments AND string literals stripped. A counter is READ
 * if `.prop` occurs ANYWHERE in that corpus in a position that is not another write — deliberately
 * generous about what counts as a reader, and generous in the safe direction: it under-reports, so a
 * count coming back large is a floor rather than a guess.
 *
 * BULK EXPOSURE IS REPORTED SEPARATELY AND IS NOT THE SAME THING. An object hung on `root` or spread
 * into `module.exports` is REACHABLE; that is what makes a per-name reader possible, and it is not one.
 * The distinction matters because a bulk-exported counter reads as instrumented in a review.
 *
 * WHAT THIS MISSES: a counter on a lowercase object, a counter incremented through a computed key
 * (`FAILS[kind]++` — the prop is not a literal), and a counter read only by a test that spells it
 * through a variable. All three under-report. */
function section4() {
  const dirs = ['engine', 'tests', 'build', 'tools', 'web', 'app'];
  const files = [];
  for (const d of dirs) {
    let fl = [];
    try { fl = fs.readdirSync(D(d)); }
    catch (e) { SWFAILS.read++; if (!SWFAILS.first) SWFAILS.first = d + ': ' + e.code; continue; }
    for (const f of fl) if (f.endsWith('.js')) files.push(d + '/' + f);
  }
  if (broken(4) || !files.length) return cannot(4, 'COUNTERS THAT NOTHING READS',
    'no source files were listed under ' + dirs.join(', ') + ' — nothing to scan');
  const clean = {}, noStr = {};
  for (const f of files) {
    const s = readFile(D(f));
    if (s == null) continue;
    clean[f] = stripComments(s);
    noStr[f] = stripStrings(clean[f]);
  }
  const corpus = Object.values(noStr).join('\n');
  const counters = new Map();                       /* "file|OBJ" -> Set(prop) */
  for (const f of Object.keys(noStr))
    for (const m of noStr[f].matchAll(/\b([A-Z][A-Za-z0-9_$]{2,})\.([A-Za-z_$][A-Za-z0-9_$]*)\s*(\+\+|\+=)/g)) {
      const k = f + '|' + m[1];
      if (!counters.has(k)) counters.set(k, new Set());
      counters.get(k).add(m[2]);
    }
  if (!counters.size) return cannot(4, 'COUNTERS THAT NOTHING READS',
    'the increment pattern matched nothing in ' + files.length + ' file(s) — that is a broken scan, '
    + 'not a repository without counters');

  /* ONE PASS OVER THE CORPUS, NOT ONE PER COUNTER. Testing 1,048 property regexes against ~10 MB of
   * source cost 54 seconds, and a sweep nobody waits for is the bug this file was built to fix. Every
   * `.prop` NOT immediately followed by a write operator is a read; collected once, tested by lookup. */
  const READ = new Set();
  for (const m of corpus.matchAll(/\.([A-Za-z_$][A-Za-z0-9_$]*)\s*(\+\+|--|\+=|-=|=(?!=))?/g))
    if (!m[2]) READ.add(m[1]);

  let total = 0, unread = 0, objects = 0;
  const rows = [];
  for (const [k, props] of [...counters].sort()) {
    const [f, obj] = k.split('|');
    /* THE DECLARATION IS NOT AN EXPOSURE. `const SKIP = {...}` satisfies any bare-name test, so the
     * first version of this flag read TRUE for every object on earth — a reassuring label produced by
     * the definition of the thing being labelled. */
    const bare = corpus.replace(new RegExp('\\b(?:const|let|var)\\s+' + obj + '\\s*='), ' ');
    const bulk = new RegExp('(?<![.\\w$])' + obj + '(?![\\w$]*\\s*\\.)').test(bare);
    const dead = [];
    for (const p of props) {
      total++;
      if (!READ.has(p)) { dead.push(p); unread++; }
    }
    if (dead.length) {
      objects++;
      rows.push(obj + ' in ' + f + ' — ' + dead.length + ' of ' + props.size
        + ' never read by name' + (bulk ? '  (the object IS exported/dumped in bulk, so it reads as '
        + 'instrumented and is not)' : '  (and the object is not exposed either)'));
      /* CAPPED. 544 counter names on one line is a wall, and a wall does not get read — which is the
       * failure this whole file is about. The COUNT is the finding; the names are a sample. */
      if (VERBOSE) rows.push('      ' + dead.sort().slice(0, 12).join(' ')
        + (dead.length > 12 ? '  ... and ' + (dead.length - 12) + ' more' : ''));
    }
  }
  found(4, 'COUNTERS THAT NOTHING READS', unread,
    unread + ' of ' + total + ' counter field(s) across ' + objects + ' of ' + counters.size
    + ' counter object(s) are incremented '
    + 'and never read by name anywhere in the tree', rows);
}

/* ================================================================================================
 * 5. STORE ROWS WITH NO RAW LOG
 * ================================================================================================
 * `engine/durable-ingest.js:464` states the defect in its own comment — the hourly CI job appends to
 * the store, the raw archive is gitignored so a CI-ingested game never gets a local log, the two drift
 * apart silently, and "a new question is a re-parse, never a re-pull" quietly stops being true for
 * exactly the games CI collected. It says RUN THIS BEFORE ANY REPARSE. Nothing runs it, and a reparse
 * DELETES every orphan.
 *
 * THIS IS THE ONE SECTION THAT DUPLICATES ARITHMETIC, AND IT IS DECLARED RATHER THAN HIDDEN. The set
 * difference lives inside `main()` in durable-ingest.js, is not exported, and the pass that wrote this
 * file was not permitted to edit that file. So the loop is repeated here — six lines — and everything
 * around it is derived from durable-ingest.js and the workflow rather than typed:
 *
 *   WHICH STORES     — the `durable-ingest.js <path>` invocations in .github/workflows/. Anything else
 *                      under data/*.jsonl is written by some other tool and is not this defect.
 *   THE RAW PAIRING  — the suffix is read out of durable-ingest.js's own `const RAW=` line, so if that
 *                      naming rule changes this section fails loudly instead of comparing two files
 *                      that were never a pair.
 *
 * OWED: export the orphan count from durable-ingest.js and delete the loop below. Until then the two
 * can disagree, which is the failure this repository has a receipt for. */
function section5() {
  const ing = readFile(D('engine', 'durable-ingest.js'));
  if (!ing || broken(5)) return cannot(5, 'STORE ROWS WITH NO RAW LOG',
    'engine/durable-ingest.js is unreadable, so neither the store list nor the raw-archive naming '
    + 'rule can be derived');
  const rawRule = ing.match(/const\s+RAW\s*=[^;]*?\+\s*'([^']+)'/);
  if (!rawRule) return cannot(5, 'STORE ROWS WITH NO RAW LOG',
    "could not read the raw-archive suffix out of durable-ingest.js's `const RAW=` line — comparing a "
    + 'store against a guessed filename would compare two files that were never a pair');
  const suffix = rawRule[1];

  const stores = new Set();
  const wf = D('.github', 'workflows');
  let wfiles = [];
  try { wfiles = fs.readdirSync(wf).filter(f => /\.ya?ml$/.test(f)); }
  catch (e) { SWFAILS.read++; if (!SWFAILS.first) SWFAILS.first = '.github/workflows: ' + e.code; }
  for (const f of wfiles) {
    const t = readFile(path.join(wf, f)) || '';
    for (const m of t.matchAll(/durable-ingest\.js\s+(\S+\.jsonl)/g)) stores.add(m[1]);
  }
  if (!stores.size) return cannot(5, 'STORE ROWS WITH NO RAW LOG',
    'no `durable-ingest.js <store>.jsonl` invocation was found in .github/workflows/ — the set of '
    + 'stores this defect applies to cannot be derived, and guessing it would either miss a store or '
    + 'invent one');

  const ids = f => {
    const out = new Set();
    let rem = '';
    let fd;
    try { fd = fs.openSync(f, 'r'); }
    catch (e) { SWFAILS.read++; if (!SWFAILS.first) SWFAILS.first = f + ': ' + e.code; return null; }
    try {
      const buf = Buffer.alloc(1 << 22);
      for (;;) {
        const n = fs.readSync(fd, buf, 0, buf.length, null);
        if (!n) break;
        const parts = (rem + buf.toString('latin1', 0, n)).split('\n');
        rem = parts.pop();
        for (const l of parts) { const m = /^\{"id":"([^"]+)"/.exec(l); if (m) out.add(m[1]); }
      }
      const m = /^\{"id":"([^"]+)"/.exec(rem); if (m) out.add(m[1]);
    } finally { fs.closeSync(fd); }
    return out;
  };

  const rows = [];
  let orphans = 0, scanned = 0, unpaired = 0;
  for (const s of [...stores].sort()) {
    const raw = s.replace(/\.jsonl$/, '') + suffix;
    const S = ids(D(s));
    if (!S) { rows.push(s + ' — store is UNREADABLE; orphan count UNKNOWN, which is not zero'); unpaired++; continue; }
    const R = ids(D(raw));
    if (!R) { rows.push(s + ' — ' + S.size + ' rows, and ' + raw + ' does not exist: EVERY row is an orphan');
      orphans += S.size; unpaired++; continue; }
    let o = 0;
    for (const id of S) if (!R.has(id)) o++;
    scanned++;
    orphans += o;
    rows.push(s + ' — ' + o + ' of ' + S.size + ' stored rows have no raw log (archive holds ' + R.size + ')');
  }
  found(5, 'STORE ROWS WITH NO RAW LOG', orphans,
    orphans + ' stored game(s) have no raw log across ' + stores.size + ' ingest store(s); a reparse '
    + 'DELETES every one of them' + (unpaired ? '   (' + unpaired + ' store(s) could not be paired)' : ''),
    rows);
}

/* ---- run ---------------------------------------------------------------------------------------- */
section1();
section2();
section3();
section4();
section5();

const TOTAL = 5;
const findings = SECTIONS.filter(s => s.count).length;
const sumFindings = SECTIONS.reduce((a, s) => a + (s.count || 0), 0);

console.log('ABRA SWEEP — what the INSTRUMENTS do not check about themselves. Derived; nothing typed.');
console.log('Not engine coverage (that is engine/coverage.js) and not project state (engine/status.js).');
console.log('');
if (FAILURES.length)
  console.log('  VERDICT: ' + findings + ' of ' + TOTAL + ' section(s) found something, and ' +
              FAILURES.length + ' COULD NOT DERIVE. A section that cannot derive is a renamed file or');
else
  console.log('  VERDICT: ' + sumFindings + ' finding(s) across ' + findings + ' of ' + TOTAL +
              ' sections. None of this is new — every one was already derivable and nothing acted.');
console.log('');
for (const s of SECTIONS.sort((a, b) => a.n - b.n)) {
  const badge = s.count === null ? '!! CANNOT DERIVE' : s.count ? String(s.count).padStart(6) : '  clean';
  console.log('  ' + s.n + '  ' + s.title.padEnd(38) + badge);
  console.log('        ' + s.head);
  if (VERBOSE || s.count === null) for (const d of s.detail) console.log('        ' + d);
  else if (s.detail.length) console.log('        (' + s.detail.length + ' line(s) of detail — `--verbose`)');
}
console.log('');
if (SWFAILS.read || SWFAILS.parse)
  console.log('  reads that failed: ' + SWFAILS.read + (SWFAILS.first ? ' (first: ' + SWFAILS.first + ')' : '')
            + '; parses that failed: ' + SWFAILS.parse + (SWFAILS.parseFirst ? ' (first: ' + SWFAILS.parseFirst + ')' : ''));
if (FAILURES.length) {
  console.log('  FIX THE DERIVATION IN THIS SESSION. A sweep that quietly drops a section reads as a');
  console.log('  clean bill of health for the thing it stopped looking at.');
  process.exit(2);
}
/* EXIT NON-ZERO ON A FINDING, so this can be a gate rather than a nag. It is deliberately NOT
 * registered in tests/run-all.js yet — that is a separate decision, and wiring a red gate on the day
 * it is written is how "known failure" gets said out loud. */
process.exit(sumFindings ? 1 : 0);
