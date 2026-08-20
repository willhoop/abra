/* conformance.js — does every file in this project obey the standards the project set itself?
 *
 *   node engine/conformance.js            full report
 *   node engine/conformance.js --strict   RATCHET: exit non-zero on any finding that is NOT in
 *                                         data/conformance-baseline.json (for CI)
 *   node engine/conformance.js --fix-list just the file list, for working through
 *
 * `--strict` DOES NOT MEAN "ZERO FINDINGS". It means "no finding that was not already there".
 * See THE RATCHET at the bottom of this file for why, and for the two ways this could launder
 * itself if it were written carelessly.
 *
 * WHY THIS EXISTS RATHER THAN A REVIEW
 * -----------------------------------
 * The standards are written down in docs/ARCHITECTURE.md as S1 through S13, and they are good ones.
 * Nothing checked them. They were enforced by whoever remembered them, which over one evening
 * produced: a hand-typed threshold inside a file arguing against hand-typed thresholds, a hardcoded
 * artifact list inside the tool built to catch hardcoded lists, two models quoted without checking
 * what data they were built on, and a Pokemon that is not legal in the format.
 *
 * A person reading 23,559 lines finds some of that. A person reading it again next month finds a
 * different subset. So the standards are encoded here instead, and the report is the same every time
 * anyone runs it.
 *
 * WHAT IT CANNOT DO. It checks the mechanical shadow of each standard, not the standard itself. S8
 * says "measured, never asserted" — this can find a bare numeric constant, but it cannot tell whether
 * the number was estimated or invented. Every check is therefore written to flag a SHAPE that
 * usually indicates the violation, and the report says which standard each one is a proxy for so a
 * reader can judge. False positives are worse than gaps here: a report that cries wolf is one people
 * learn to scroll past, which is how the project got into this state.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const STRICT = process.argv.includes('--strict');
const FIXLIST = process.argv.includes('--fix-list');

/* Our code, not vendored. node_modules and the pinned simulator are somebody else's problem. */
const SRC_DIRS = ['engine', 'build', 'tests', 'web', 'mcp', 'sim'];
const isOurs = p => !p.includes('node_modules') && !p.includes(`${path.sep}dist${path.sep}`);

function sources() {
  const out = [];
  const walk = (dir, rel) => {
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full, r); continue; }
      if (!/\.(js|py|sh|html)$/.test(e.name)) continue;
      if (!isOurs(full)) continue;
      out.push({ rel: r, full });
    }
  };
  for (const d of SRC_DIRS) walk(D(d), d);
  return out;
}

const findings = [];
/* `detail` is the VARIABLE part of a finding — the specific names a file typed, the specific value
 * of a constant. It is reported and recorded, but it is deliberately NOT part of the identity the
 * ratchet compares; see fingerprint(). */
const flag = (std, file, what, why, detail) => findings.push({ std, file, what, why, detail });

const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };

/* ---------------------------------------------------------------------------------------------
 * THE PROJECT'S OWN FILE CONVENTION
 *
 * Every file here opens with a block comment saying WHY it exists and what failure it prevents. That
 * is not written in ARCHITECTURE.md but it is the single most consistent thing about this codebase,
 * and it is why the code is readable at all. A file without one is a file whose reason has to be
 * reconstructed by whoever finds it next.
 * ------------------------------------------------------------------------------------------- */
function checkHeader(f, src) {
  const head = src.slice(0, 600);
  const hasBlock = /^\s*(\/\*|#|<!--|'''|""")/.test(src) || /^#!/.test(src);
  if (!hasBlock) { flag('convention', f.rel, 'no opening comment', 'every file states why it exists'); return; }
  /* A one-line header is a label, not an explanation. The convention is a paragraph. */
  const firstBlock = (src.match(/^\s*\/\*[\s\S]*?\*\//) || src.match(/^(#[^\n]*\n)+/) || [''])[0];
  if (firstBlock && firstBlock.split('\n').length < 3 && !/^#!/.test(src)) {
    flag('convention', f.rel, 'header is one line', 'headers explain the failure the file prevents');
  }
}

/* ---------------------------------------------------------------------------------------------
 * S12 — nothing hardcoded that lives in a config
 * ------------------------------------------------------------------------------------------- */
const CONFIG_VALUES = (() => {
  const out = [];
  try {
    const r = JSON.parse(read(D('data', 'regulations.json')));
    const a = r.regulations[r.active] || {};
    for (const k of ['showdownFormat', 'bo3Format', 'started']) {
      if (a[k]) out.push({ value: String(a[k]), home: 'data/regulations.json', key: k });
    }
  } catch (e) {}
  return out;
})();
/* The files ALLOWED to name these: the config itself, and the one loader per subsystem that reads
 * it. Everything else must go through those. */
const CONFIG_READERS = /regulations\.json|quality-filter\.json/;

/* Comments are PROSE, and prose may name a thing in order to explain it. build/triggers.js discusses
 * why two subsystems label the same format differently — that is documentation doing its job, not a
 * hardcode. Only code is checked, so the report stays about things that would actually go stale. */
function stripComments(src) {
  const NL = String.fromCharCode(10);
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(NL)
    /* A URL IS NOT A COMMENT. This stripped from the first // to end of line, so
     * `https://replay.pokemonshowdown.com/...` deleted the rest of the line -- which is
     * precisely why engine/mega_harvest.js:39, the ONE file that hardcodes the format id into a
     * network call, was the one file this guard could not see. Require the // not be preceded
     * by a colon. */
    .map(line => line.replace(/(^|[^:])\/\/.*$/, '$1').replace(/^\s*#.*$/, ''))
    .join(NL)
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function checkHardcodes(f, srcRaw) {
  const src = stripComments(srcRaw);
  /* NOTE, 2026-08-04: this tests the RAW source, so merely MENTIONING regulations.json in a
   * comment exempts the whole file -- a file that reads the config for one thing and hardcodes
   * for another is invisible. Narrowing it to an actual read takes the count from 2 to 42, and
   * OPS established that most of those 42 are LEGITIMATE catch-fallbacks in files that do read
   * the config. So the narrowing is right and lands AFTER the 42 are triaged, not before --
   * otherwise this becomes a gate that fails on correct code, which gets waived and then
   * ignored. PRIORITIES #46b. */
  if (/regulations\.json/.test(srcRaw)) return;        // it reads the config; naming a fallback is fine
  for (const c of CONFIG_VALUES) {
    if (src.includes(c.value)) {
      flag('S12', f.rel, `hardcodes "${c.value}"`, `lives in ${c.home} (${c.key}) — reference it`);
      break;                                           // one finding per file is enough to act on
    }
  }
  checkNamedPokemon(f, src);
}

/* S12b — A NAMED MOVE, ABILITY OR ITEM IS A HARDCODE TOO, AND NOTHING CHECKED FOR ONE.
 *
 * This tool only ever looked for the format id. It passed engine/board.js on a full review, and
 * hours later that file held EIGHTEEN typed Pokemon names, most added the same evening, in a file
 * whose own header said "there is no list of moves anywhere in this file".
 *
 * It was not cosmetic. The Protect-odds table keyed on the name "protect", so Toxapex -- whose only
 * stalling move is Baneful Bunker, on 28% of its sets -- scored as a target that NEVER blocks. And
 * Protect is 46% of every false kill call this model makes, so the typed name fed straight into the
 * largest measured error in the project.
 *
 * The rule is not "never name anything". Some rules genuinely live in Showdown's procedural code and
 * cannot be read from data -- Trick Room reversing the speed order is one. Those belong in ONE
 * declared block, and a file that has one is exempt: the point is that the exceptions are visible
 * and counted, not that they do not exist. */
const NAMED = [
  ['move', /\b(protect|detect|endure|tailwind|trickroom|reflect|lightscreen|auroraveil|followme|ragepowder|helpinghand|fakeout|solarbeam|electroshot|blizzard|earthquake|uturn|quash)\b/],
  ['ability', /\b(prankster|galewings|friendguard|sharpness|intimidate|levitate|flashfire|lightningrod|telepathy|technician)\b/],
  ['item', /\b(focussash|choicescarf|choiceband|lifeorb|assaultvest|leftovers|sitrusberry)\b/],
];
function checkNamedPokemon(f, src) {
  const rel = String(f.rel).split('\\').join('/');
  if (!/^(engine|build)\//.test(rel) || !/\.js$/.test(rel)) return;
  /* A file that declares its exceptions in one place has already done the work. */
  if (/GAME_RULES\s*=/.test(src)) return;
  const found = new Set();
  for (const [kind, re] of NAMED) {
    const g = new RegExp(re.source, 'g');
    let m;
    while ((m = g.exec(src))) found.add(kind + ':' + m[1]);
  }
  if (!found.size) return;
  flag('S12', f.rel, `names ${found.size} Pokemon thing(s) in code: ${[...found].slice(0, 5).join(', ')}` +
       (found.size > 5 ? ', ...' : ''),
       'derive it from the dex, or collect the irreducible ones in a declared GAME_RULES block',
       [...found].sort());
}

/* ---------------------------------------------------------------------------------------------
 * S8 — measured, never asserted
 *
 * A named constant that decides something, with no stated derivation, is the shape of an invented
 * threshold. The check is deliberately narrow: only names that announce themselves as decision
 * points, and only when no comment nearby says where the number came from.
 * ------------------------------------------------------------------------------------------- */
const DECISION_NAME = /\b(?:const|let|var)\s+([A-Z][A-Z0-9_]*(?:THRESHOLD|CUTOFF|MIN|MAX|LIMIT|WEIGHT|ALPHA|BETA|SCALE|RATE|FACTOR|BAR)[A-Z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*[;,]/g;
function checkAsserted(f, src) {
  let m;
  while ((m = DECISION_NAME.exec(src))) {
    const at = m.index;
    /* Look BOTH ways. build/triggers.js writes `const Z_ALPHA = 1.959964;  /* two-sided 95% *\/`,
     * where the justification is a trailing comment — and the first version of this check only read
     * backwards, so it reported a constant that was already explained. */
    const context = src.slice(Math.max(0, at - 500), at) + src.slice(at, at + 200);
    const derived = /measured|derived|estimated|fitted|from the data|counted|observed|Wilson|standard error|quantile|two-sided|normal|because/i.test(context);
    if (!derived) flag('S8', f.rel, `${m[1]} = ${m[2]} with no stated derivation`, 'a constant that decides must say where it came from', [m[2]]);
  }
}

/* ---------------------------------------------------------------------------------------------
 * S13 — no hand-maintained state
 *
 * Two shapes: a data file nobody generates, and a generated file that does not say so.
 * ------------------------------------------------------------------------------------------- */
const unreadable = [];
/* Every data file this standard actually LOOKED AT. The ratchet's regression-vs-discovery split needs
 * to know whether a finding's subject was in scope last time and whether it has moved since, and a
 * subject nobody recorded looking at cannot be told from a subject that did not exist. */
const judgedData = [];
/* WHO WRITES THIS FILE IS ASKED, NOT GUESSED — engine/provenance.js --graph --json.
 *
 * This check used to answer it with `allSrc.includes(file)`: a substring search for the file's NAME
 * anywhere in the concatenated source of the repository. That is a second, worse implementation of a
 * derivation that already exists, and it is wrong in both directions. It says YES to a name that
 * appears only in a comment or in a sentence about the file, and it says NO to every artifact whose
 * path is computed — `'roster.' + STAGE + '.json'`, `` `exploitability-${TAG}.json` ``, an
 * `OUT_WEIGHTS` environment variable. provenance.js has four ranked arms for exactly this and reports
 * HOW it found each writer; parsing its human table would be the same mistake one level up, so this
 * takes the `--json` shape it publishes for callers. status.js and quarantine.js already do.
 *
 * `data/roster.moves.prev.json` is the row that made this worth doing: a `.prev.json` sidecar written
 * beside a rewritten artifact, flagged for weeks as "no generator writes it" because no source names
 * that string.
 *
 * IF THE SUBPROCESS FAILS THIS CHECK GOES SILENT AND SAYS SO. Falling back to the substring search
 * would republish the answer this change exists to retire, wearing the new check's name. */
function writerIndex() {
  try {
    const rows = JSON.parse(execFileSync(process.execPath,
      [D('engine', 'provenance.js'), '--graph', '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
    const m = new Map();
    for (const r of rows) m.set(String(r.file), r);
    return { ok: true, rows: m };
  } catch (e) {
    return { ok: false, why: String((e && e.message) || e).split('\n')[0] };
  }
}
function checkGeneratedFiles() {
  const idx = writerIndex();
  if (!idx.ok) {
    unreadable.push('engine/provenance.js --graph --json did not answer (' + idx.why + ') — S13 is '
      + 'UNRUN this pass rather than answered by the substring search it replaced');
    return;
  }
  let files; try { files = fs.readdirSync(D('data')); } catch (e) { return; }
  for (const file of files) {
    if (!/\.(json|js)$/.test(file)) continue;
    judgedData.push(file);
    if (/^games\./.test(file)) continue;                       // stores, not artifacts
    /* CONFIG IS NOT AN ARTIFACT. data/quality-filter.json and data/regulations.json are the SOURCES
     * S12 points everything else at — hand-maintained on purpose, and each already carries its own
     * version and purpose fields. Flagging them as "generated but does not say so" was the checker
     * misreading the direction of the dependency. */
    if (/^(quality-filter|regulations)\.json$/.test(file)) continue;
    const row = idx.rows.get(file);
    const generated = !!(row && row.by && !row.unknown);
    const body = read(D('data', file)).slice(0, 400);
    /* AN ARTIFACT WE DID NOT GET THE BYTES OF IS NOT AN ARTIFACT WITHOUT A HEADER.
     *
     * read() returns '' both for "this file is empty" and for "this file could not be read", and
     * data/ is written by other processes while this scan runs. Caught live on 2026-08-04: another
     * division's generator was mid-write on data/rollout-r1-explore1.json, the scan read zero bytes,
     * and the ratchet went red on a file whose second line is `"generated": ...`. A gate that fires
     * on a race is a gate that gets switched off, so an unreadable file is REPORTED and not judged —
     * loud, and not a finding. It cannot hide a real violation: the next run reads the bytes. */
    if (!body.trim()) { unreadable.push(file); continue; }
    const saysGenerated = /GENERATED|generated|do not hand-edit|provenance/i.test(body);
    if (!generated && !/quality-filter|regulations/.test(file)) {
      /* THE REASON TRAVELS AS `detail`, NEVER IN `what`. provenance.js states why it found no
       * writer and that is worth printing — but `what` is the finding's IDENTITY for the ratchet
       * (see fingerprint()), and `detail` is the variable part that is deliberately excluded.
       * Appending the reason to `what` was the first version of this line and it retired 20
       * baselined findings and re-raised them under new names in one run: a rewording that reads as
       * "20 fixed, 20 new" is precisely the laundering the ratchet exists to prevent. */
      flag('S13', 'data/' + file, 'no generator writes it',
           'a file nobody generates is a file that will lie',
           [row && row.why ? row.why : 'engine/provenance.js has no row for it at all']);
    } else if (generated && !saysGenerated) {
      flag('S13', 'data/' + file, 'generated but does not say so', 'generated files carry a GENERATED header');
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * DEAD CODE — not a numbered standard, but the first thing a reviewer asks
 *
 * A module nothing imports and that has no command-line entry point is either unfinished or
 * abandoned, and either way it is a claim about the project that nobody is maintaining.
 * ------------------------------------------------------------------------------------------- */
function checkOrphans(srcs) {
  const bodies = new Map(srcs.map(s => [s.rel, read(s.full)]));
  const all = [...bodies.values()].join('\n');
  for (const s of srcs) {
    if (!/\.(js|py)$/.test(s.rel)) continue;
    if (/^tests\//.test(s.rel)) continue;                     // tests are entry points by nature
    const base = path.basename(s.rel).replace(/\.(js|py)$/, '');
    const body = bodies.get(s.rel) || '';
    const isEntry = /require\.main === module|if __name__|process\.argv|argparse|^#!/m.test(body);
    if (isEntry) continue;
    /* A TOP-LEVEL SCRIPT is an entry point too, and the first version did not know it.
     * engine/chomp-predict.js is 43 lines that run on load and write their output — no export, no
     * guard, because it needs neither. `node engine/chomp-predict.js` is exactly how the
     * predictability study documents running it. A file that exports nothing is not a library, so
     * the only way it can be used at all is by being run. */
    if (!/module\.exports|^export /m.test(body)) continue;
    /* A package marker is reached by the import system, not by a caller. */
    if (/__init__\.py$/.test(s.rel)) continue;
    /* A file that WRITES a data artifact which exists is a build step, and build steps are run by
     * hand or by CI rather than imported. The first version called build/build_engine_data.js dead —
     * it generates data/engine-data.js, which the entire site loads. Producing a live artifact is
     * the strongest possible evidence a file is reachable. */
    const producesLive = (body.match(/[a-zA-Z0-9_.-]+\.(?:json|js)/g) || [])
      .some(f2 => !/^games\./.test(f2) && f2 !== path.basename(s.rel) && fs.existsSync(D('data', f2)));
    if (producesLive) continue;
    /* Reached by ANYTHING that could run it — not only by JavaScript.
     *
     * The first version searched source files alone and reported engine/bring_priors.js as dead. The
     * hourly ingest workflow invokes it by name every hour, so acting on that would have stopped the
     * collection pipeline. A file is run by workflows, shell scripts and documented commands just as
     * much as by a require, so the search covers all of them, minus the file's own text. */
    const others = all.replace(body, '');
    const referenced = others.includes(base + '.js') || others.includes(base + '.py') ||
                       new RegExp(`require\\([^)]*${base.replace(/[-.]/g, '\\$&')}`).test(others);
    if (!referenced) flag('dead', s.rel, 'nothing runs it: no import, no entry point, no command anywhere', 'unreachable code is an unmaintained claim');
  }
}

/* ---------------------------------------------------------------------------------------------
 * RUN
 * ------------------------------------------------------------------------------------------- */
const srcs = sources();
for (const f of srcs) {
  const src = read(f.full);
  checkHeader(f, src);
  checkHardcodes(f, src);
  checkAsserted(f, src);
}
checkGeneratedFiles();
checkOrphans(srcs);

const byStd = {};
for (const v of findings) (byStd[v.std] = byStd[v.std] || []).push(v);

if (FIXLIST) {
  const files = [...new Set(findings.map(f => f.file))].sort();
  for (const f of files) console.log(f);
  process.exit(0);
}

console.log('CONFORMANCE — every file against the standards this project set itself\n');
console.log(`  ${srcs.length} source files, ${srcs.reduce((a, s) => a + read(s.full).split('\n').length, 0).toLocaleString()} lines\n`);

const LABEL = {
  S8: 'S8  measured, never asserted',
  S12: 'S12 everything linked, nothing hardcoded',
  S13: 'S13 no hand-maintained state',
  convention: 'convention — every file states why it exists',
  dead: 'dead code — unreachable and unmaintained',
};
for (const std of ['S12', 'S13', 'S8', 'dead', 'convention']) {
  const v = byStd[std] || [];
  console.log(`  ${LABEL[std]}  —  ${v.length} finding${v.length === 1 ? '' : 's'}`);
  for (const f of v.slice(0, 12)) console.log(`      ${f.file.padEnd(40)} ${f.what}`);
  if (v.length > 12) console.log(`      … and ${v.length - 12} more`);
  console.log('');
}
console.log(`  TOTAL ${findings.length} findings across ${new Set(findings.map(f => f.file)).size} files`);
if (unreadable.length) {
  console.log(`\n  NOT JUDGED — ${unreadable.length} file(s) in data/ returned no bytes at scan time`);
  console.log(`  (empty, or being written by another process). They are neither passed nor failed:`);
  for (const f of unreadable) console.log(`      data/${f}`);
}
console.log('\n  Each check is a mechanical proxy for a standard, not the standard itself. S8 can find a');
console.log('  bare constant; it cannot tell whether the number was estimated or invented. Read the');
console.log('  findings, do not just count them.');

fs.writeFileSync(D('data', 'conformance.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/conformance.js',
  files: srcs.length, findings,
}, null, 1));

/* ---------------------------------------------------------------------------------------------
 * THE RATCHET
 *
 * This file was registered as a GATE in tests/run-all.js and run WITHOUT --strict, so the exit(1)
 * below could never fire. It reported findings on every run and exited 0 — a gate that always
 * passes, which is the single defect this repository has recorded catching itself on most often.
 * The defect was written up TWICE in run-all.js, in two near-identical comment blocks, and acted on
 * zero times.
 *
 * It was not switched on, because switching it on turns the suite red on ~a hundred findings that
 * are mostly legitimate, and a red board gets normalised — tests/test-docs-current.js sat red for two
 * days across ~40 commits under the banned phrase "known failure". A gate that is waived and a gate
 * that cannot fire are the same gate.
 *
 * So: BASELINE WHAT EXISTS, FAIL ONLY ON WHAT IS NEW. The baseline may SHRINK and may never grow.
 * A finding that gets fixed leaves the baseline on the next run and can never come back.
 *
 * Three ways this could launder itself, each closed deliberately:
 *
 *   1. A COUNT instead of a LIST. One finding disappearing while another appears nets to zero and
 *      slips through silently. engine/provenance.js:746 records the same lesson from the other
 *      side — its first ratchet stored a number, fired at 91 against 90, and could only say "one
 *      more than last time"; nobody could identify the file and status.js printed NOT DERIVED for
 *      a session. The LIST is stored, so the diff names its cause.
 *
 *   2. A CORRUPT BASELINE READ AS "FIRST RUN". That adopts whatever the tree currently looks like
 *      as the new baseline and blesses everything that broke since. ABSENT and UNREADABLE are
 *      different events and only the first is benign (engine/provenance.js:729).
 *
 *   3. WRITING THE BASELINE ON A FAILING RUN. If the file were rewritten unconditionally, the new
 *      finding would be in the baseline by the time anyone re-ran it and the gate would be green on
 *      the second try. The write happens ONLY when nothing is new.
 * ------------------------------------------------------------------------------------------- */
/* `--baseline <path>` POINTS THE RATCHET AT A SCRATCH FILE, and it exists for one reason: the
 * regression-vs-discovery split below could not otherwise be SHOWN RED. Exercising it needs a
 * baseline that already carries a scope map and rule digests, and the real one cannot acquire those
 * while the gate is red — it is not rewritten while anything is new, which is the point. Without
 * this flag the only way to demonstrate the mechanism is to sabotage the published baseline, which
 * is how a chain of custody gets broken. Default is unchanged; nothing in the suite passes it. */
const BASELINE = (() => {
  const i = process.argv.indexOf('--baseline');
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : D('data', 'conformance-baseline.json');
})();

/* THE IDENTITY OF A FINDING IS ITS SHAPE, NOT ITS TEXT.
 *
 * `what` carries variable detail — how many Pokemon names a file typed, which five of them fit in
 * the line, what value a constant holds. If that text were the key, adding a ninth typed move to a
 * file already flagged for typing eight would read as a BRAND NEW finding and turn the board red on
 * a file that is already on the list. That is churn, and churn is what gets a gate switched off.
 *
 * The variable part is kept as `detail` and reported as a NOTICE when it grows, so widening an
 * already-baselined violation is visible without being fatal.
 *
 * The hash segment in a generated filename is normalised for the same reason: every new rollout
 * shard would otherwise be a new finding forever. */
function fingerprint(v) {
  const file = String(v.file).split('\\').join('/').replace(/-[0-9a-f]{8,}(?=\.)/g, '-<hash>');
  let kind;
  if (/^names \d+ Pokemon thing/.test(v.what)) kind = 'names Pokemon things in code';
  /* The config VALUE is not the identity — when the active regulation rolls over, every file that
   * hardcodes the old one still has exactly the same defect in exactly the same place. */
  else if (/^hardcodes /.test(v.what)) kind = 'hardcodes a config value';
  else if (/ with no stated derivation$/.test(v.what)) kind = `${v.what.split(' =')[0]} has no stated derivation`;
  else if (/^nothing runs it/.test(v.what)) kind = 'dead: nothing runs it';
  else kind = v.what;                       /* S13 and convention findings are already invariant */
  return `${v.std} | ${file} | ${kind}`;
}

/* ---------------------------------------------------------------------------------------------
 * REGRESSION vs DISCOVERY — ROADMAP #188
 *
 * A CHECKER THAT GETS BETTER MUST NOT BREAK THE GATE. On 2026-08-11 S13 stopped guessing who writes
 * an artifact (`allSrc.includes(file)`, a substring search over the whole repository) and started
 * asking `engine/provenance.js --graph --json`. That is strictly better and it raised NINE findings
 * the substring search had concealed — every one a true positive. The gate went red on them, on the
 * same run it went red on nineteen findings that were already there. Those two events are OPPOSITE
 * and the ratchet could not tell them apart, so the only ways out were to rewrite the baseline
 * wholesale — which buries the nineteen — or to leave a red gate and normalise it, which is the
 * failure CLAUDE.md's banned-phrase section is entirely about.
 *
 * `data/provenance-stamp.json` had already solved this from the other side: `graph_files` records
 * what the checker could SEE, a growth in that set is a DISCOVERY, a file losing its stamp is a
 * REGRESSION, and only the second is fatal. This is that shape, with the two inputs conformance
 * actually has.
 *
 *   SUBJECT   the file a finding is about, digested. `scope` in the baseline.
 *   RULE      the code that emits findings for that STANDARD, digested. `rule_digests`.
 *
 *   subject is new to the scan .................. REGRESSION  (new code must conform)
 *   subject moved ............................... REGRESSION  (the file changed and now violates)
 *   subject unchanged AND that standard's rule moved  DISCOVERY
 *   subject unchanged AND no rule moved ......... REGRESSION, and printed as UNEXPLAINED — an input
 *                                                 nothing here tracks moved, which is a fact worth
 *                                                 hearing rather than a category to fall into.
 *
 * THE RULE DIGEST IS PER STANDARD, AND THAT IS THE WHOLE GUARD. A whole-file digest of
 * conformance.js would have let one line changed in S13 bless ten S12 findings on files nobody had
 * touched — laundering wearing the new mechanism's name. The digest covers the top-level functions
 * that CALL `flag(<std>, …)`, so editing S13 moves S13's digest and nothing else's.
 *
 * WHAT IT DELIBERATELY CANNOT SEE, because a mechanism that hides its blind spot is worse than none:
 * a module-level constant those functions read (CONFIG_VALUES, the name tables) is outside the
 * slice, so changing one and re-raising a finding reads as UNEXPLAINED — which fails the gate. That
 * is the conservative direction and it is the correct one to be wrong in.
 * ------------------------------------------------------------------------------------------- */
const RS_ = require('./run_stamp.js');
/* ROADMAP #258 — a digest that could not be taken is not a digest of nothing. `null` still goes into
 * the stamp (the caller compares stamps and a missing one must not equal a present one), but the
 * reason is said, because a subject surface silently losing a file is a scan that verifies less. */
const SHA_FAILURES = [];
const sha = rel => {
  try { return RS_.sha12(rel); }
  catch (e) {
    const msg = String((e && e.message) || e).split(String.fromCharCode(10))[0];
    SHA_FAILURES.push({ file: rel, error: msg });
    console.error('  NO DIGEST — ' + rel + ' (' + msg + '); it is stamped null, which is NOT the same '
                + 'as unchanged');
    return null;
  }
};

/* The scan's whole subject surface: every source file it read, and every data file S13 looked at. */
function scopeMap() {
  const out = {};
  for (const s of srcs) out[s.rel] = sha(s.rel);
  for (const f of judgedData) out['data/' + f] = sha('data/' + f);
  return out;
}

/* THE STANDARD'S OWN CODE, SLICED OUT OF THIS FILE BY WHO CALLS `flag`. Top-level functions only —
 * this file has no nested ones — found by a `function name(` at column 0 and closed by a `}` at
 * column 0. If that shape ever stops holding, `ruleDigests()` returns an EMPTY map and every added
 * finding falls to UNEXPLAINED, which fails. It does not silently classify on a bad slice. */
function ruleDigests() {
  const src = read(__filename);
  const lines = src.split('\n');
  const byName = new Map();
  for (let i = 0; i < lines.length; i++) {
    const m = /^function\s+([A-Za-z0-9_$]+)\s*\(/.exec(lines[i]);
    if (!m) continue;
    let j = i + 1;
    while (j < lines.length && !/^\}/.test(lines[j])) j++;
    if (j >= lines.length) continue;
    byName.set(m[1], lines.slice(i, j + 1).join('\n'));
  }
  if (!byName.size) return {};
  const crypto = require('crypto');
  const out = {};
  for (const [, text] of byName) {
    for (const mm of text.matchAll(/\bflag\(\s*'([A-Za-z0-9]+)'/g)) {
      (out[mm[1]] = out[mm[1]] || []).push(text);
    }
  }
  const digests = {};
  for (const std of Object.keys(out)) {
    digests[std] = crypto.createHash('sha256').update(out[std].sort().join('\n')).digest('hex').slice(0, 12);
  }
  /* S13's ANSWER IS NOT IN THIS FILE. It comes from engine/provenance.js's graph, so that file is
   * part of S13's rule and a change there is a rule change — which is exactly what happened on
   * 2026-08-11 and what this whole split is for. Stated here rather than left implicit, because it
   * also means a provenance edit can bless an S13 finding on an unchanged subject. */
  const pv = sha('engine/provenance.js');
  if (digests.S13 && pv) digests.S13 = digests.S13 + '+' + pv;
  return digests;
}

const nowByKey = new Map();
for (const v of findings) {
  const key = fingerprint(v);
  const e = nowByKey.get(key) || { key, std: v.std, file: String(v.file).split('\\').join('/'), what: v.what, detail: [] };
  if (Array.isArray(v.detail)) for (const d of v.detail) if (!e.detail.includes(d)) e.detail.push(d);
  e.detail.sort();
  nowByKey.set(key, e);
}
const nowKeys = [...nowByKey.keys()].sort();

/* `errBaseline` rather than `unreadable`: the catch below KEEPS the reason and prints it, but
 * tests/test-no-silent-failure.js reads a catch body for the shape of a block that speaks, and an
 * assignment only counts when the name says it holds a failure. Naming it so is the cheaper fix than
 * arguing with the detector, and the name is no worse. */
let prev = null, errBaseline = null, carried = [];
if (fs.existsSync(BASELINE)) {
  try {
    prev = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    if (!prev || !Array.isArray(prev.findings)) throw new Error('no `findings` array — the baseline is not a baseline');
    if (!prev.findings.every(e => e && typeof e.key === 'string')) throw new Error('an entry has no string `key`');
  } catch (e) { errBaseline = e.message; prev = null; }
}

console.log('');
if (errBaseline) {
  /* Not "first run". A missing baseline is benign; a damaged one is a broken chain of custody. */
  console.log(`  RATCHET BASELINE UNREADABLE: ${BASELINE}`);
  console.log(`  ${errBaseline}`);
  console.log('  Refusing to adopt the current tree as a new baseline — that would launder every');
  console.log('  finding introduced since the file was last good. Restore it from git and re-run.');
  process.exitCode = 1;
} else if (!prev) {
  console.log(`  RATCHET — no baseline at ${path.relative(ROOT, BASELINE).split('\\').join('/')}; adopting the current`);
  console.log(`  ${nowKeys.length} finding(s) as the baseline. From here it may only shrink.`);
  writeBaseline({ scope: scopeMap(), rules: ruleDigests(), discovered: [], cls: new Map() });
} else {
  const prevByKey = new Map(prev.findings.map(e => [e.key, e]));
  const added = nowKeys.filter(k => !prevByKey.has(k));
  /* A RACE MUST NOT LOOK LIKE A FIX. This is the dangerous direction, and hardening the other one
   * created it: a data/ file that returned no bytes because another process was writing it produces
   * no findings, so its baselined entries would read as FIXED, leave the baseline, and turn the gate
   * permanently red the moment the file is readable again. A finding may only leave when we actually
   * looked and it was not there. Entries for a not-judged file are carried forward untouched. */
  const notJudged = new Set(unreadable.map(f => 'data/' + f));
  const held = prev.findings.filter(e => !nowByKey.has(e.key) && notJudged.has(e.file));
  carried = held;
  const removed = prev.findings.filter(e => !nowByKey.has(e.key) && !notJudged.has(e.file)).map(e => e.key);
  if (held.length) console.log(`  HELD (${held.length}) — kept in the baseline; their file was not judged this run`);
  const widened = [];
  for (const k of nowKeys) {
    const p = prevByKey.get(k); if (!p || !Array.isArray(p.detail)) continue;
    const grew = nowByKey.get(k).detail.filter(d => !p.detail.includes(d));
    if (grew.length) widened.push([k, grew]);
  }

  /* ---- the split ---- */
  const scopeNow = scopeMap();
  const rulesNow = ruleDigests();
  const scopeWas = (prev && prev.scope) || null;
  const rulesWas = (prev && prev.rule_digests) || null;
  const classify = (k) => {
    const e = nowByKey.get(k);
    const file = e.file;
    if (!scopeWas || !rulesWas) return { klass: 'REGRESSION', why: 'the previous baseline carries no '
      + 'scope map or no rule digests, so this run cannot hold the subject constant; a finding it '
      + 'cannot explain is a regression' };
    if (!Object.prototype.hasOwnProperty.call(scopeWas, file))
      return { klass: 'REGRESSION', why: 'the subject was not in the previous scan — new code must conform' };
    if (scopeWas[file] !== scopeNow[file])
      return { klass: 'REGRESSION', why: 'the subject file changed since the baseline' };
    const rw = rulesWas[e.std], rn = rulesNow[e.std];
    if (rn && rw && rn !== rw)
      return { klass: 'DISCOVERY', why: `the subject is byte-identical to the baseline and ${e.std}'s own rule moved (${rw} -> ${rn})` };
    /* A FINDING THAT WAS ALREADY NEW WHEN THE SPLIT WAS INSTALLED IS NOT AN UNEXPLAINED EVENT, AND
     * SAYING SO WOULD BE THIS FILE INVENTING A CAUSE. --seed-split records the exact set that was
     * outstanding at the seed; those predate the mechanism, cannot be attributed by it, and are
     * reported as such. They still fail — the split was never a way to make them go away. */
    if (Array.isArray(prev.new_at_seed) && prev.new_at_seed.includes(k))
      return { klass: 'REGRESSION', why: 'it was ALREADY new when --seed-split installed the split ('
        + (prev.seeded || 'unknown date') + '), so this mechanism cannot attribute it either way. '
        + 'Triage it on its merits' };
    return { klass: 'REGRESSION', why: 'UNEXPLAINED — neither the subject nor ' + e.std + '\'s rule '
      + 'moved, so an input this checker does not track did. Treated as a regression on purpose' };
  };
  const cls = new Map(added.map(k => [k, classify(k)]));
  const discoveries = added.filter(k => cls.get(k).klass === 'DISCOVERY');
  const regressions = added.filter(k => cls.get(k).klass === 'REGRESSION');

  /* `--seed-split` INSTALLS THE TWO INPUTS AND ADOPTS NOTHING, and it exists because otherwise the
   * split can never switch itself on. The baseline is not rewritten while anything is new — rule 3
   * above, and it is the right rule — so a gate that is already red can never acquire the scope map
   * the split needs, and the mechanism would sit dormant forever behind the findings it was built to
   * classify. This writes `scope` and `rule_digests` and REFUSES if the finding list would move by
   * one entry, which is the only thing rule 3 is actually protecting. It blesses nothing: every
   * finding that is new today is still new tomorrow, and every one of them still fails. */
  if (process.argv.includes('--seed-split')) {
    const body = Object.assign({}, prev, { scope: scopeNow, rule_digests: rulesNow,
      seeded: new Date().toISOString(),
      new_at_seed: added.slice(),
      seeded_note: 'scope and rule_digests were installed by --seed-split on a run that had '
        + added.length + ' new finding(s). The finding list was NOT touched and nothing was adopted. '
        + '`new_at_seed` is the set that was already outstanding, recorded so later runs report them '
        + 'as predating the split instead of inventing an UNEXPLAINED cause for them.' });
    if (JSON.stringify(body.findings) !== JSON.stringify(prev.findings)) {
      console.log('\n  --seed-split REFUSED: the finding list would change. That is not a seed.');
      process.exit(1);
    }
    fs.writeFileSync(BASELINE, JSON.stringify(body, null, 1) + '\n');
    console.log(`\n  --seed-split: wrote ${Object.keys(scopeNow).length} subject digests and `
      + `${Object.keys(rulesNow).length} per-standard rule digests into the baseline.`);
    console.log(`  ${prev.findings.length} baselined findings UNCHANGED; ${added.length} new finding(s) `
      + `still new and still failing. From the next rule change on, the split classifies them.`);
    process.exit(added.length ? 1 : 0);
  }

  console.log(`  RATCHET — ${prev.findings.length} baselined, ${added.length} new `
              + `(${regressions.length} regression, ${discoveries.length} discovery), ${removed.length} fixed`);
  if (removed.length) {
    console.log(`  FIXED (${removed.length}) — leaving the baseline, and they may never come back:`);
    for (const k of removed) console.log('    ' + k);
  }
  if (widened.length) {
    /* Informational, not fatal. The file is already on the list; this says the violation grew. */
    console.log(`  NOTICE — ${widened.length} baselined finding(s) got WIDER (already flagged, still flagged):`);
    for (const [k, grew] of widened) console.log(`    ${k}  +${grew.join(', ')}`);
  }
  /* A DISCOVERY IS PRINTED IN FULL AND RECORDED PERMANENTLY, NEVER JUST WAVED THROUGH. The growth is
   * auditable — date, reason, the standard whose rule moved, and every key — which is the only thing
   * that separates "the checker got better" from "somebody buried a hundred findings". */
  if (discoveries.length) {
    console.log('');
    console.log(`  DISCOVERY (${discoveries.length}) — the checker got BETTER; these subjects did not move.`);
    console.log('  Adopted into the baseline and listed in `discoveries` with their reason. NOT fatal:');
    for (const k of discoveries) {
      console.log(`    + ${k}`);
      console.log(`        ${cls.get(k).why}`);
    }
  }
  if (regressions.length) {
    console.log('');
    console.log(`  RATCHET BROKEN: ${regressions.length} finding(s) not in the baseline —`);
    for (const k of regressions) {
      const e = nowByKey.get(k);
      console.log(`    ${k}`);
      console.log(`        ${e.what}`);
      console.log(`        why it is a REGRESSION: ${cls.get(k).why}`);
    }
    console.log('  Fix them, or fix the standard. The baseline is NOT rewritten while anything is a');
    console.log('  regression — not even the discoveries beside them, which wait for the next clean run.');
    if (STRICT) process.exit(1);
    process.exitCode = 1;
  } else {
    writeBaseline({ scope: scopeNow, rules: rulesNow, discovered: discoveries, cls });
  }
}

/* One writer, called from two branches. Two copies of a ratchet writer is how a ratchet quietly
 * stops ratcheting (engine/provenance.js:710). */
function writeBaseline(split) {
  /* WHAT `source_digests` MEANS HERE, because the honest answer is narrower than it looks.
   *
   * engine/provenance.js verifies every entry in this map by CONTENT and marks the artifact UNSAFE
   * when one moves. The findings below are computed from every source file in the tree, but stamping
   * all of them would mark this file unsafe the moment anybody edits anything — a gate that is red by
   * design, which is the failure this whole ratchet exists to avoid. The RULE inputs are stamped
   * instead: engine/conformance.js decides what a finding IS, and data/regulations.json supplies the
   * config values S12 looks for. If either moves, these keys may no longer mean what they meant, and
   * that is exactly the restamp-versus-refit line. The whole scanned set is NOT digested here: it
   * moves on nearly every commit, so a digest of it would rewrite this file on nearly every run and
   * bury the one thing a reader wants from its history — when a finding entered or left. */
  const RS = require('./run_stamp.js');
  const body = {
    note: 'GENERATED RATCHET BASELINE — do not hand-edit. Written by engine/conformance.js.',
    source_digests: { 'engine/conformance.js': RS.sha12('engine/conformance.js'),
                      'data/regulations.json': RS.sha12('data/regulations.json') },
    source_digests_scope: 'The RULE inputs only. The findings are computed over all source files; '
        + 'a change to any of them shows up as a finding entering or leaving, not as a stamp mismatch.',
    files_scanned: srcs.length,
    rule: 'This list may SHRINK and may NEVER grow. Every entry is a conformance finding that '
        + 'already existed when the gate was switched on. `node engine/conformance.js --strict` '
        + 'fails on any finding whose key is not in here. Fix one and it leaves this file on the '
        + 'next run, and can never return. The KEY is stored rather than a count: one finding '
        + 'disappearing while another appears nets to zero and slips a count comparison silently.',
    generated: new Date().toISOString(),
    by: 'engine/conformance.js',
    count: nowKeys.length + carried.length,
    findings: [...nowKeys.map(k => nowByKey.get(k)), ...carried]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
    /* THE TWO INPUTS THE REGRESSION-vs-DISCOVERY SPLIT NEEDS, and they are recorded rather than
     * re-derived on the next run for the same reason `graph_files` is: the question is what the
     * checker saw LAST time, and only last time can answer it. `scope` is deliberately outside the
     * no-op comparison below — data/ moves constantly, and a baseline rewritten on every run buries
     * the one thing its history is for. A stale scope reads a file as CHANGED, which fails the gate;
     * that is the safe direction and it is why the staleness is tolerable. */
    rule_digests: (split && split.rules) || (prev && prev.rule_digests) || {},
    rule_digests_note: 'Per STANDARD, over the top-level functions in engine/conformance.js that call '
        + 'flag(<std>, …) — plus engine/provenance.js for S13, whose answer comes from that graph. Per '
        + 'standard rather than per file so a change to S13 cannot bless an S12 finding.',
    scope: (split && split.scope) || (prev && prev.scope) || {},
    scope_note: 'file -> sha12 of every subject this scan judged: each source file it read and each '
        + 'data/ file S13 looked at. A finding on a subject that is new to this map, or whose digest '
        + 'moved, is a REGRESSION whatever the rule did.',
    discoveries: [
      ...((prev && Array.isArray(prev.discoveries) && prev.discoveries) || []),
      ...((split && split.discovered && split.discovered.length) ? [{
        when: new Date().toISOString(),
        reason: 'the checker got better: the standard\'s own rule moved while these subjects stayed '
              + 'byte-identical, so the finding is newly VISIBLE rather than newly TRUE',
        basis: 'exact — the subject digest was compared against the previous baseline\'s scope map',
        keys: split.discovered.slice(),
        detail: split.discovered.map(k => split.cls.get(k).why),
      }] : []),
    ],
  };
  /* A NO-OP RUN MUST NOT TOUCH THE FILE. Only `generated` would differ, and this repo has an
   * unattended auto-commit on a ~2-minute timer: rewriting the baseline on every green run would
   * commit a timestamp-only diff every time anyone runs the suite and bury the only thing its
   * history is for — the run where a finding entered or left. */
  /* files_scanned is compared too, or it would sit stale on a file that was added and had nothing
   * to report — a small lie, but a field that CAN go stale is a field that eventually does. */
  /* `rule_digests` joins the comparison and `scope` deliberately does not: a rule that moved is a
   * fact worth a commit, and data/ moving is not. */
  const proj = o => JSON.stringify({ s: o.source_digests, n: o.files_scanned, f: o.findings,
                                     r: o.rule_digests || {} });
  const same = prev && proj(prev) === proj(body);
  if (same) return;
  try { fs.writeFileSync(BASELINE, JSON.stringify(body, null, 1) + '\n'); }
  catch (e) { console.log('  (could not write the ratchet baseline: ' + e.message + ')'); }
}
