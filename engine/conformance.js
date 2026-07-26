/* conformance.js — does every file in this project obey the standards the project set itself?
 *
 *   node engine/conformance.js            full report
 *   node engine/conformance.js --strict   exit non-zero on any violation (for CI)
 *   node engine/conformance.js --fix-list just the file list, for working through
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
const flag = (std, file, what, why) => findings.push({ std, file, what, why });

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

function checkHardcodes(f, src) {
  if (/regulations\.json/.test(src)) return;           // it reads the config; naming a fallback is fine
  for (const c of CONFIG_VALUES) {
    if (src.includes(c.value)) {
      flag('S12', f.rel, `hardcodes "${c.value}"`, `lives in ${c.home} (${c.key}) — reference it`);
      break;                                           // one finding per file is enough to act on
    }
  }
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
    const before = src.slice(Math.max(0, at - 500), at);
    const derived = /measured|derived|estimated|fitted|from the data|counted|observed|Wilson|standard error|because/i.test(before);
    if (!derived) flag('S8', f.rel, `${m[1]} = ${m[2]} with no stated derivation`, 'a constant that decides must say where it came from');
  }
}

/* ---------------------------------------------------------------------------------------------
 * S13 — no hand-maintained state
 *
 * Two shapes: a data file nobody generates, and a generated file that does not say so.
 * ------------------------------------------------------------------------------------------- */
function checkGeneratedFiles(srcs) {
  const allSrc = srcs.map(s => read(s.full)).join('\n');
  let files; try { files = fs.readdirSync(D('data')); } catch (e) { return; }
  for (const file of files) {
    if (!/\.(json|js)$/.test(file)) continue;
    if (/^games\./.test(file)) continue;                       // stores, not artifacts
    const generated = allSrc.includes(file);
    const body = read(D('data', file)).slice(0, 400);
    const saysGenerated = /GENERATED|generated|do not hand-edit|provenance/i.test(body);
    if (!generated && !/quality-filter|regulations/.test(file)) {
      flag('S13', 'data/' + file, 'no generator writes it', 'a file nobody generates is a file that will lie');
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
checkGeneratedFiles(srcs);
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
console.log('\n  Each check is a mechanical proxy for a standard, not the standard itself. S8 can find a');
console.log('  bare constant; it cannot tell whether the number was estimated or invented. Read the');
console.log('  findings, do not just count them.');

fs.writeFileSync(D('data', 'conformance.json'), JSON.stringify({
  generated: new Date().toISOString(),
  by: 'engine/conformance.js',
  files: srcs.length, findings,
}, null, 1));

if (STRICT && findings.length) process.exit(1);
