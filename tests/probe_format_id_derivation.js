#!/usr/bin/env node
/* probe_format_id_derivation.js — IS ANY LIVE FORMAT ID STILL TYPED INSTEAD OF DERIVED?
 *
 * THE SILENT FAILURE THIS STAGES. A hardcoded format id keeps working after a rotation. It opens the
 * PREVIOUS regulation's dex, or asks the replay endpoint for the PREVIOUS regulation's games, and
 * reports success either way. `build/build_browser_data.js` was the worst of them, because it writes
 * two files that are frozen into every engine release AND offers a `--check` that compared what is on
 * disk against what the same hardcoded script would write today: a green test asking nothing.
 *
 * THE PREDICATE IS DERIVED, NOT A LIST OF FILES. A format id typed on a line that hands it to
 * `Dex.forFormat(...)` or to the replay `search.json?format=` endpoint is wrong by construction — it
 * decides which game the run is about. A format id typed anywhere else may be a legitimate pin on
 * HISTORY (`data/team-pool-frozen/`, `data/archive/regmb/`, the seed ids and measured reference
 * numbers in tests/test-mechanics.js, engine/medicham2-browser.js and tests/roster.js, which cite
 * what was measured), so this asks about the CALL, never about the filename. A name list here would
 * be the hand-maintained ban list of four in a new costume.
 *
 * COMMENTS ARE NOT CALL SITES, and the first draft of this scan said they were: it reported 104
 * lines, most of them prose ABOUT a format id — including this repository's own explanations of why
 * a format id must not be typed. A checker that counts its own documentation as the defect is the
 * over-match LESSONS §4 names.
 *
 * `tests/` IS SCANNED AND REPORTED, NEVER FAILED. A test's format id is usually a pin on what was
 * MEASURED, and rewriting those would be editing the record. Engine and build code has no such
 * excuse, so those two are the gate.
 *
 * THE RED ARM IS THE COMMITTED BYTES. The same scan runs against `git show HEAD:<file>`, so the
 * before/after is a measurement of this repository rather than an assertion about it.
 *
 *   node tests/probe_format_id_derivation.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

/* THE PREDICATE LIVES IN engine/format_id_scan.js AND IS NOT RESTATED HERE. Two callers ask this
 * same question for two different reasons — this probe asks IS IT RED, and
 * engine/next_regulation.js --checklist asks WHAT DOES THE FLIP HAVE TO DECIDE. Two files that both
 * decide what counts as a call site would disagree eventually, and the disagreement would be
 * invisible because both would keep working. CLAUDE.md: FEATURES ARE PER-MODEL, FACTS ARE GLOBAL. */
const SCAN = require(path.join(ROOT, 'engine', 'format_id_scan.js'));
const { offenders, filesUnder } = SCAN;
const GATED = ['engine', 'build'];
const REPORTED = ['tests'];

let NOT_IN_HEAD = 0; const GIT_FAILED = [];
function scan(dirs) {
  const files = filesUnder(dirs);
  const now = [], head = [];
  for (const rel of files) {
    now.push(...offenders(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel));
    let h = null;
    /* maxBuffer: the default 1 MB threw ENOBUFS on engine/medicham2-browser.js (3.2 MB) and on
       * tests/test-mechanics.js, so the BEFORE side silently lost the two largest files it scans.
       * stderr is CAPTURED, not ignored: without git's own message a brand-new file and a real git
       * failure are indistinguishable, and this probe was calling the former the latter. */
      try { h = execFileSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }); }
    catch (e) {
      /* A FILE NOT IN HEAD IS EXPECTED -- this probe is new and so are its neighbours. ANY OTHER
       * git failure is not, and swallowing it would silently shrink the BEFORE side of the
       * comparison, which is how a ratchet reports an improvement it did not make. */
      const msg = String((e && e.stderr) || (e && e.message) || e);
      if (/exists on disk, but not in|does not exist in|unknown revision|fatal: path/i.test(msg)) NOT_IN_HEAD++;
      else { GIT_FAILED.push(rel + ': ' + msg.split(String.fromCharCode(10))[0]); }
      h = null;
    }
    if (h) head.push(...offenders(h, rel));
  }
  /* A COUNTER NOTHING READS IS NOT A COUNTER. */
  if (GIT_FAILED.length) console.log('  ' + GIT_FAILED.length
    + ' file(s) FAILED to read from HEAD for a reason other than being new, so the BEFORE side is incomplete: '
    + GIT_FAILED.join('; '));
  else console.log('  ' + NOT_IN_HEAD + ' file(s) are not in HEAD (expected for new files); 0 git failures');
  return { files, now, head };
}

console.log('PROBE — a format id typed into the call that decides which game a run is about\n');
const gated = scan(GATED);
console.log(`  GATE: ${gated.files.length} .js files under ${GATED.join('/, ')}/`);
console.log(`    at HEAD        : ${gated.head.length} live call site(s)`);
for (const h of gated.head) console.log('        ' + h);
console.log(`    working tree   : ${gated.now.length} live call site(s)`);
for (const h of gated.now) console.log('        ' + h);

const rep = scan(REPORTED);
console.log(`\n  REPORTED, NOT FAILED: ${rep.now.length} live call site(s) under ${REPORTED.join('/, ')}/ ` +
  `across ${new Set(rep.now.map(h => h.split(':')[0])).size} file(s).`);
console.log('    A test pinned to the regulation it was measured under is citing a run, not making a');
console.log('    claim about today. It becomes a decision the day the flip happens, not before.');

/* ---- what a rotation actually does to the payload, measured ---------------------------------- */
try {
  const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
  const { Dex } = CS.sim();
  const vgc = Dex.formats.all().map(f => f.id)
    .filter(id => /^gen\d+championsvgc/.test(id) && !/bo3$/.test(id)).sort();
  const payload = (id) => {
    const D = CS.dexFor(id);
    const legal = x => x.exists && !x.isNonstandard;
    let formes = 0;
    for (const it of D.items.all()) if (legal(it) && it.megaStone) formes += Object.keys(it.megaStone).length;
    return { moves: D.moves.all().filter(legal).length, formes };
  };
  if (vgc.length >= 2) {
    const oldId = vgc[0], newId = vgc[vgc.length - 1];
    const a = payload(oldId), b = payload(newId);
    console.log('\n  THE CONSEQUENCE, measured on what build/build_browser_data.js writes, across the two');
    console.log('  Champions VGC regulations this checkout carries:');
    console.log(`      ${oldId}   ${a.moves} legal moves, ${a.formes} mega formes`);
    console.log(`      ${newId}   ${b.moves} legal moves, ${b.formes} mega formes`);
    console.log(`      A generator pinned to the older one writes ${a.formes} mega formes where the newer`);
    console.log(`      regulation has ${b.formes} — ${Math.abs(b.formes - a.formes)} missing — and its --check compares that`);
    console.log('      answer against itself, so it passes.');
  }
} catch (e) { console.log(`\n  (could not open the format dex to measure the consequence — ${e.message})`); }

console.log('');
if (gated.now.length) {
  console.log(`RED — ${gated.now.length} live call site(s) under ${GATED.join('/, ')}/ still name a format. After a`);
  console.log('      rotation each one keeps working, about the wrong game, and reports success.');
} else {
  console.log(`GREEN — every live call site under ${GATED.join('/, ')}/ derives its format. ` +
    `${gated.head.length} did not at HEAD.`);
}
process.exit(gated.now.length ? 1 : 0);
