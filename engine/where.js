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
/* ---- AN UNREADABLE INPUT IS SAID OUT LOUD, NOT RENDERED AS "NOTHING FOUND" ----------------------
 * This tool's whole answer is "which file owns this fact", and every one of these helpers hands its
 * caller an EMPTY answer on failure — which is a real and common result here. So a file that could
 * not be read, or a JSON that would not parse, is indistinguishable from a question with no answer,
 * in the one tool built so nobody has to guess. It is stderr rather than a counter: this is a CLI a
 * person reads, and there is nothing downstream to hand a receipt to.
 * Measured before it was wired: a normal run (`protect`, `--gates`, `--artifacts`) trips none of
 * these, so the line only ever appears when something is actually wrong. */
const unread = (what, f, e) => '  !! where: could not read ' + what + ' ' + f + ' ('
  + (e.code || e.message) + ') — it is reported below as NOTHING FOUND, which is not the same as '
  + 'nothing being there';
const rd = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { console.error(unread('file', f, e)); return null; } };
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(unread('json', f, e)); return null; } };
const ls = d => { try { return fs.readdirSync(D(d)).filter(f => f.endsWith('.js')); } catch (e) { console.error(unread('dir', d, e)); return []; } };

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const QUERY = argv.filter(a => !a.startsWith('--'))[0] || null;
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE FROZEN SET, read from the module rather than from any sentence about it ---------------- */
function sources() {
  /* `[]` here reads as "the frozen set is EMPTY", which is a claim about the release machinery and
   * not about a failed require. CLAUDE.md's own "twenty-three files are frozen" going stale three
   * times is exactly why this number is derived; a silent zero would be worse than the sentence. */
  try { return require('./engine_release.js').SOURCES || []; }
  catch (e) {
    console.error('  !! where: engine/engine_release.js would not load (' + ((e && e.message) || e)
      + ') — THE FROZEN SET IS UNKNOWN, and it is printed below as empty');
    return [];
  }
}

/* ---- EVERY GATE AND THE ROW IT DECIDES ----------------------------------------------------------
 * The register names its instruments in `VERIFIED BY: \`<cmd>\`` markers — the same regex
 * engine/register_reality.js runs them by. Reading it here means the list is whatever the register
 * actually says today, not whatever someone wrote in a doc.
 *
 * THE CLOSED TEST IS IMPORTED, AND IT WAS HAND-ROLLED HERE UNTIL 2026-08-22.
 *
 * This file tested `/\|\s*closed/i` against the whole line. `engine/quarantine.js` exports
 * `roadmapRowIsClosed` — *"EXPORTED FOR engine/open_work.js SO THERE IS ONE CLOSED-DETECTOR, NOT
 * TWO"* — and `engine/register_reality.js` already imports it. This file quietly made it three, and
 * the third one disagreed with the other two on **24 of 292 register rows, in both directions**:
 *
 *   - 18 rows read OPEN here and CLOSED everywhere else, because this register's house spelling for
 *     a finished row is `done`, `DONE 2026-08-11` or `page closed 2026-08-10` — none of which is the
 *     bare token `closed` sitting immediately after a pipe. **#92 is the visible instance**: its
 *     title says `THE DAMAGE-STAGE CLASS — DONE, 3.72.0`, its status cell says
 *     `done — kept here because docs/ENGINE.md cites it`, and `--gates` listed it as an OPEN row
 *     naming a gate. It printed 6 open gated rows where the canonical detector gives 5.
 *   - 6 rows read CLOSED here and OPEN everywhere else, which is the dangerous direction: the test
 *     scanned the WHOLE line, so any `| closed 2026-…` appearing inside a long row's own account of
 *     a part that IS finished shut the row. #167, #172, #196, #282, #293 and #294 are all live.
 *
 * The canonical detector reads the STATUS CELL first and only then guesses from the row's first 600
 * characters, and it carries two measured repairs (2026-08-15 and 2026-08-18) that this copy had
 * neither of. A second implementation of a fact is CLAUDE.md's named failure mode, and it behaved
 * exactly as advertised: both copies kept working and only the answers differed.
 *
 * IT DOES NOT FALL BACK. A tool whose whole claim is that it derives rather than remembers must not
 * degrade to a worse detector in silence — that is the silent-default shape. If quarantine cannot be
 * loaded, every row is reported UNKNOWN and the reason is printed. */
let _closedFn = null, _closedWhy = null;
function rowIsClosed(line) {
  if (!_closedFn) {
    try {
      const Q = require('./quarantine.js');
      if (typeof Q.roadmapRowIsClosed !== 'function') throw new Error('quarantine.js exports no roadmapRowIsClosed');
      _closedFn = Q.roadmapRowIsClosed;
    } catch (e) {
      _closedWhy = String((e && e.message) || e).split('\n')[0];
      _closedFn = () => null;              /* null, never false — UNKNOWN is not OPEN */
    }
  }
  return _closedFn(line);
}
function gates() {
  const md = rd(D('docs', 'ROADMAP.md')) || '';
  const out = [];
  for (const line of md.split('\n')) {
    const row = line.match(/^\|\s*#(\d+)\s*\|/);
    const mk = line.match(/VERIFIED BY:\s*`([^`]+)`/);
    if (row && mk) out.push({ row: +row[1], cmd: mk[1], closed: rowIsClosed(line) });
  }
  out.closedDetectorWhy = _closedWhy;
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
  const open = g.filter(x => x.closed === false);
  const shut = g.filter(x => x.closed === true);
  const unk = g.filter(x => x.closed === null);
  console.log('  ' + open.length + ' open row(s) name a gate:');
  for (const x of open) console.log('    #' + String(x.row).padEnd(5) + x.cmd);
  console.log('\n  ' + shut.length + ' closed row(s) still name one (kept — a closed row\'s gate is its regression test):');
  for (const x of shut.slice(0, 12)) console.log('    #' + String(x.row).padEnd(5) + x.cmd);
  if (unk.length) {
    console.log('\n  ' + unk.length + ' row(s) could not be classified at all — the canonical closed-detector '
      + 'would not load (' + (g.closedDetectorWhy || 'reason unknown') + ').');
    console.log('  These are UNKNOWN, not open. Nothing below this line is a coverage claim.');
  }
  /* NAMING A GATE IS NOT THE SAME QUESTION AS HAVING A VERDICT, AND THE TWO WERE READ AS ONE.
   *
   * 2026-08-22: this list said six open rows name a gate; `engine/quarantine.js`'s `no open, known
   * engine defect` clause counted #318 and #319 among *"13 open rows that assert breakage with NO
   * instrument that decides them"*. Neither was lying. This file reads the REGISTER — does a row name
   * an instrument. The clause reads `data/register-reality.json` — has that instrument been RUN and
   * what did it exit with. A row can name a gate and still have no verdict, and #318/#319 are exactly
   * that: their marker is `SHOWDOWN_PATH=... node tests/roster.js --stage moves`, which
   * register_reality.js's SAFE pattern refuses to execute (it accepts `node <repo script> [--flags]`
   * and nothing else), so no verdict exists for them and none ever will while the marker is spelled
   * that way. #316 is the same refusal, already recorded in the artifact.
   *
   * So the line below is printed here rather than left to be inferred: the artifact's own age against
   * the register's, because a clause reading a stale artifact states a claim about the register in
   * the present tense. It is a caption on a difference, not a merge — the two questions stay two. */
  const rr = rj(D('data', 'register-reality.json'));
  const mdRows = ((rd(D('docs', 'ROADMAP.md')) || '').match(/^\|\s*#\d+\s*\|/gm) || []).length;
  if (!rr) {
    console.log('\n  data/register-reality.json is MISSING or unreadable, so no row in this list has a '
      + 'verdict. Run: node engine/register_reality.js');
  } else {
    const seen = new Set((rr.results || []).map(r => String(r.n)));
    const noVerdict = g.filter(x => !seen.has(String(x.row)));
    console.log('\n  NAMING A GATE IS NOT HAVING A VERDICT — those are two questions and two readers:');
    console.log('    this list          the register: does the row NAME an instrument  -> ' + g.length + ' row(s) do');
    console.log('    quarantine clause  data/register-reality.json: was it RUN, and did it exit 0');
    console.log('    register-reality.json: generated ' + (rr.generated || 'UNSTAMPED') + ', '
      + ((rr.counts || {}).id_rows || '?') + ' id rows then vs ' + mdRows + ' in docs/ROADMAP.md now'
      + (((rr.counts || {}).id_rows || 0) < mdRows ? '  <- STALE, the register has grown since' : ''));
    if (noVerdict.length) {
      console.log('    ' + noVerdict.length + ' row(s) here have NO verdict in that artifact: '
        + noVerdict.map(x => '#' + x.row).join(', ') + '.');
      console.log('    The quarantine clause counts those as DEBT. That is a statement about the '
        + 'artifact, not about the register.');
    }
  }
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
