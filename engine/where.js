/* where.js — WHERE DOES THIS LIVE, AND WHAT DECIDES IT?
 *
 *   node engine/where.js protect          # a mechanic, move, ability or item
 *   node engine/where.js damageMultAll    # a tag
 *   node engine/where.js --gates          # every instrument and the row it decides
 *   node engine/where.js --artifacts      # every data artifact and who writes it
 *
 * ================= WHY THIS EXISTS =================================================================
 *
 * Will, 2026-08-22: *"this project is huge and it just destroys your context window... can we create a
 * skill or a knowledge base or memory that can be easily handed between sessions"*.
 *
 * Audited on the session that prompted it, the coordinator's context went to roughly twenty-five
 * separate "grep the source for X" excursions at 500-2000 tokens each. Almost every one was the same
 * question in a different costume: WHERE DOES THIS FACT LIVE, and WHAT WOULD TELL ME IF IT WERE WRONG.
 *
 * A WRITTEN MAP OF THIS REPOSITORY WOULD BE WRONG WITHIN A DAY. That is not a guess — it is the
 * fourteen stale handoffs, the ban list of four, the auto-commit described in the present tense for
 * twelve days, and CLAUDE.md's own "twenty-three files are frozen" when SOURCES held 25. So this
 * DERIVES: it reads SOURCES, the tests, the register's VERIFIED BY markers and data/tags.json at run
 * time and reports what is actually there. It cannot go stale, for the same reason status.js cannot.
 *
 * IT ANSWERS "WHERE", NEVER "WHAT". It will tell you that `data/residual-order.json` carries the
 * ordering numbers and that `engine/medicham2-browser.js` reads them; it will not tell you what the
 * numbers are. A tool that cached VALUES would be a knowledge base, and a knowledge base of Pokemon
 * facts is the thing this project bans outright — read the format, every time.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const rd = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } };
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const ls = d => { try { return fs.readdirSync(D(d)).filter(f => f.endsWith('.js')); } catch (e) { return []; } };

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const QUERY = argv.filter(a => !a.startsWith('--'))[0] || null;
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE FROZEN SET, read from the module rather than from any sentence about it ---------------- */
function sources() {
  try { return require('./engine_release.js').SOURCES || []; } catch (e) { return []; }
}

/* ---- EVERY GATE AND THE ROW IT DECIDES ----------------------------------------------------------
 * The register names its instruments in `VERIFIED BY: \`<cmd>\`` markers — the same regex
 * engine/register_reality.js runs them by. Reading it here means the list is whatever the register
 * actually says today, not whatever someone wrote in a doc. */
function gates() {
  const md = rd(D('docs', 'ROADMAP.md')) || '';
  const out = [];
  for (const line of md.split('\n')) {
    const row = line.match(/^\|\s*#(\d+)\s*\|/);
    const mk = line.match(/VERIFIED BY:\s*`([^`]+)`/);
    if (row && mk) out.push({ row: +row[1], cmd: mk[1], closed: /\|\s*closed/i.test(line) });
  }
  return out;
}

/* ---- WHO WRITES WHICH ARTIFACT ------------------------------------------------------------------
 * Derived by scanning engine/ and tests/ for writeFileSync targets naming data/. An artifact whose
 * writer cannot be found is REPORTED AS SUCH rather than omitted: an unattributed artifact is exactly
 * the shape data/status.js's graph row got wrong (#154), and a silent omission reads as "nothing
 * writes it", which is a different and much more comfortable claim. */
function writers() {
  const map = new Map();
  for (const dir of ['engine', 'tests', 'build']) {
    for (const f of ls(dir)) {
      const src = rd(D(dir, f)); if (!src) continue;
      const re = /['"`](data\/[A-Za-z0-9_.\-\/]+\.(?:json|jsonl|js))['"`]|D\(\s*['"]data['"]\s*,\s*['"]([A-Za-z0-9_.\-]+)['"]/g;
      let m;
      while ((m = re.exec(src))) {
        const art = m[1] || ('data/' + m[2]);
        if (!/writeFileSync|writeFile\(/.test(src.slice(Math.max(0, m.index - 400), m.index + 200))) continue;
        if (!map.has(art)) map.set(art, new Set());
        map.get(art).add(dir + '/' + f);
      }
    }
  }
  return map;
}

/* ---- THE ANSWER FOR ONE NAME -------------------------------------------------------------------- */
function lookup(q) {
  const n = norm(q);
  const out = { tags: [], engine: [], tests: [], data: [], gates: [] };

  const tags = rj(D('data', 'tags.json'));
  if (tags) {
    for (const kind of ['moves', 'abilities', 'items']) {
      const rec = (tags[kind] || {})[n];
      if (rec) out.tags.push({ kind: kind.slice(0, -1), tags: rec.tags || [], params: Object.keys(rec.params || {}) });
    }
    /* The query may BE a tag rather than an entity. Report how many entities carry it — a tag with
     * one carrier and a tag with two hundred are different objects and the count is the cheapest way
     * to tell them apart. */
    for (const kind of ['moves', 'abilities', 'items']) {
      const carriers = Object.keys(tags[kind] || {}).filter(id => (tags[kind][id].tags || []).some(t => norm(t) === n));
      if (carriers.length) out.tags.push({ asTag: true, kind: kind.slice(0, -1), carriers: carriers.length,
        sample: carriers.slice(0, 6) });
    }
  }

  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  for (const dir of ['engine', 'tests']) {
    for (const f of ls(dir)) {
      const src = rd(D(dir, f)); if (!src) continue;
      if (!rx.test(src)) continue;
      const hits = src.split('\n').reduce((a, l) => a + (rx.test(l) ? 1 : 0), 0);
      (dir === 'engine' ? out.engine : out.tests).push({ file: dir + '/' + f, hits });
    }
  }
  out.engine.sort((a, b) => b.hits - a.hits);
  out.tests.sort((a, b) => b.hits - a.hits);

  for (const g of gates()) if (rx.test(g.cmd)) out.gates.push(g);
  return out;
}

/* ---- OUTPUT ------------------------------------------------------------------------------------- */
const FROZEN = new Set(sources());
const mark = f => (FROZEN.has(f) ? '  [frozen]' : '');

if (has('--gates')) {
  const g = gates();
  console.log('\nEVERY INSTRUMENT THE REGISTER NAMES — read from VERIFIED BY markers, not from a doc\n');
  const open = g.filter(x => !x.closed), shut = g.filter(x => x.closed);
  console.log('  ' + open.length + ' open row(s) name a gate:');
  for (const x of open) console.log('    #' + String(x.row).padEnd(5) + x.cmd);
  console.log('\n  ' + shut.length + ' closed row(s) still name one (kept — a closed row\'s gate is its regression test):');
  for (const x of shut.slice(0, 12)) console.log('    #' + String(x.row).padEnd(5) + x.cmd);
  console.log('\n  Run them all and compare against the register: node engine/register_reality.js');
  process.exit(0);
}

if (has('--artifacts')) {
  const w = writers();
  console.log('\nWHO WRITES WHICH ARTIFACT — derived from writeFileSync targets, not from a list\n');
  const keys = [...w.keys()].sort();
  for (const k of keys) console.log('  ' + k.padEnd(46) + [...w.get(k)].join(', '));
  console.log('\n  ' + keys.length + ' artifact(s) with an identifiable writer.');
  console.log('  An artifact NOT listed here is written by something this scan cannot see — that is a');
  console.log('  finding, not an absence. #154 is the row where a wrong attribution hid a defect.');
  process.exit(0);
}

if (!QUERY) {
  console.log('\nwhere.js — where does this live, and what decides it?\n');
  console.log('  node engine/where.js <name>        a move, ability, item, mechanic or tag');
  console.log('  node engine/where.js --gates       every instrument the register names');
  console.log('  node engine/where.js --artifacts   every artifact and who writes it\n');
  console.log('  It answers WHERE, never WHAT. For what a mechanic DOES, read the format:');
  console.log('    node engine/mod_audit.js         did Champions change this?');
  console.log('  A cached Pokemon value is a knowledge base, and this project bans those.\n');
  process.exit(0);
}

const r = lookup(QUERY);
console.log('\nWHERE: ' + QUERY + '\n');

if (r.tags.length) {
  console.log('  THE ARTIFACT (data/tags.json)');
  for (const t of r.tags) {
    if (t.asTag) console.log('    as a TAG on ' + t.kind + 's: ' + t.carriers + ' carrier(s) — ' + t.sample.join(', ') + (t.carriers > 6 ? ' …' : ''));
    else console.log('    as a ' + t.kind + ': tags [' + t.tags.join(', ') + ']' + (t.params.length ? '  params {' + t.params.join(', ') + '}' : ''));
  }
  console.log('');
}

if (r.engine.length) {
  console.log('  ENGINE — the file with the most references usually owns the fact');
  for (const e of r.engine.slice(0, 8)) console.log('    ' + String(e.hits).padStart(4) + '  ' + e.file + mark(e.file));
  console.log('');
}

if (r.tests.length) {
  console.log('  WHAT WOULD TELL YOU IF IT WERE WRONG');
  for (const t of r.tests.slice(0, 8)) console.log('    ' + String(t.hits).padStart(4) + '  ' + t.file);
  console.log('');
} else {
  console.log('  WHAT WOULD TELL YOU IF IT WERE WRONG');
  console.log('    NOTHING IN tests/ NAMES THIS. That is a finding: a mechanic no instrument mentions');
  console.log('    is one whose breakage nothing would announce.\n');
}

if (r.gates.length) {
  console.log('  REGISTER ROWS DECIDED BY AN INSTRUMENT NAMING IT');
  for (const g of r.gates) console.log('    #' + String(g.row).padEnd(5) + g.cmd + (g.closed ? '   (closed)' : ''));
  console.log('');
}

console.log('  For what it DOES rather than where it lives: node engine/mod_audit.js — Champions');
console.log('  overrides eight mainline files, and reading /data/*.ts is reading the wrong game.\n');
