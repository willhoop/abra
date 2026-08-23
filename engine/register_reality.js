/* register_reality.js — THE REGISTER IS AN ARTIFACT, AND NOTHING WAS CHECKING IT AGAINST REALITY.
 *
 * ================= WHY THIS EXISTS =================================================================
 *
 * Every other artifact in this repository has something that compares it to its source.
 * `engine/provenance.js` compares an artifact to the files it declares it read. `engine/artifact_audit.js`
 * compares a generated file to the source values it was built from. `engine/quarantine.js` compares a
 * printed figure to whether its generator is downstream of a simulator we know is wrong.
 *
 * `docs/ROADMAP.md` had NOTHING. A row is a sentence a person typed, and the ONLY test applied to it
 * was whether some later person remembered to type a different sentence. That is prose, and this
 * repository's whole opening argument is what prose is worth here: fourteen stale handoffs, a
 * hand-maintained ban list of four, an auto-commit paragraph kept twelve days past its subject.
 *
 * THE COST IS MEASURED, NOT SUSPECTED. In one session on 2026-08-14 four rows turned out to be stale
 * rather than live — #279 claimed a guaranteed-crit damage error that `dmgRange` already got right and
 * had been RANKED FIRST OF FOURTEEN as the place to start; #244 had been fixed since 2026-08-13 with
 * nobody flipping the row; two of #273's eight FAILs probed abilities with no legal carrier in this
 * regulation; #266 said 41 illegal declarations against a true 32. On 2026-08-15 the audit of the
 * seven rows the MEDICHAM gate was counting found ONE fully closed (#273 — 200 demonstrations, 0
 * failed, and filed as red) and two matched only by a prose fallback reading a metaphor and a
 * description of an already-repaired bug.
 *
 * **A ROW THAT OVERSTATES ITS SCOPE COSTS A WHOLE AGENT, WHICH IS MORE THAN THE DEFECT IT NAMES.**
 * And because `quarantine.js` reads the open count as a GATE INPUT, a stale row holds the gate shut on
 * a defect that no longer exists — the gate then reports something untrue in the direction that gets
 * gates ignored, which is the exact failure `openDefectClause` was narrowed to prevent.
 *
 * ================= WHAT IT DOES ====================================================================
 *
 * A row may name the instrument that decides it:
 *
 *     VERIFIED BY: `node tests/test-fixture-legality.js`
 *
 * This file finds every such row, RUNS the command, and compares the exit code to the row's status:
 *
 *   STALE ROW        the row is OPEN and its instrument is GREEN. The register overstates. Loudest
 *                    verdict here, because it is the one that costs an agent.
 *   PREMATURE CLOSE  the row is CLOSED and its instrument is RED. The register understates.
 *   CONFIRMED        open + red, or closed + green. The row and the world agree.
 *   UNVERIFIABLE     no marker. Counted and named, never hidden — the coverage figure IS the honest
 *                    measure of how much of this register is still prose.
 *
 * ================= WHAT IT DELIBERATELY DOES NOT DO ================================================
 *
 * It does not guess. A row with no marker is reported as unverifiable, not as fine and not as
 * suspicious. Inferring an instrument from a row's prose would be the same vocabulary-matching that
 * put a metaphor into a gate; #148 has been paid for three times in one detector already.
 *
 * It is not the closed-detector. `roadmapRowIsClosed` is imported from `quarantine.js`, never copied:
 * CLAUDE.md's rule is that two files deciding the same fact will disagree eventually and the
 * disagreement will be invisible because both keep working.
 *
 * An exit code is a weaker oracle than a re-derivation, and that is stated rather than glossed: a
 * green instrument means THAT instrument sees nothing, not that the row's claim is false. It is
 * nevertheless strictly more than the register had, which was nothing at all.
 *
 *   node engine/register_reality.js            # run every marked row, and WRITE the verdicts
 *   node engine/register_reality.js --list     # coverage only; runs nothing AND writes nothing
 *   node engine/register_reality.js --json
 *   node engine/register_reality.js --selftest # every verdict on synthetic input, red and green
 *
 * Exit 1 on any STALE ROW or PREMATURE CLOSE. Runs no games. The MEASURING invocations write one
 * artifact; `--list` writes nothing at all, and that is enforced structurally — see THE SPLIT. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'register-reality.json');
const Q = require('./quarantine.js');

const has = (f) => process.argv.includes(f);
const TIMEOUT_MS = 10 * 60 * 1000;

/* THE MARKER IS UPPERCASE AND FENCED, so it is visible to a human reading the table and cannot be
 * produced by ordinary prose. The command must start with `node ` and name a path inside the
 * repository: this file executes what it finds, and a register anybody can edit is not a place to
 * accept an arbitrary shell string. Refused loudly rather than skipped — a marker that silently does
 * nothing is worse than no marker, because it reads as coverage. */
const MARKER = /VERIFIED BY:\s*`([^`]+)`/;
/* THE SECOND MARKER, AND IT IS THE HONEST ANSWER FOR MOST OF THIS REGISTER.
 *
 * `VERIFIED BY` needs a gate whose EXIT CODE tracks the row's claim, and for a great many rows no
 * such gate exists. Three of them were looked at on 2026-08-17 and each had a plausible candidate
 * that decided something else:
 *
 *   #241  `engine/game_differential.js` MEASURES the missing `-fail` emissions and deliberately
 *         exits 0 on them — *"a divergence is a FINDING"*, stated in its own header and in
 *         tests/test-game-differential.js, which fails only when the INSTRUMENT is wrong.
 *   #276  `tests/test-seed-clock.js` is green and covers #270, the SEED's clock. #276 is the BOARD's
 *         own `weather` field, which no gate reads.
 *   #283  `tests/test-rollout-fallen.js` is green and covers #244/#245/#246, the SEED's roster.
 *         #283 is `board.movePower`'s stub, which no gate reads.
 *
 * Pointing a `VERIFIED BY` at any of those three would have made a live defect read CONFIRMED-and-
 * green, which is worse than the prose it replaced. So the alternative is not silence: a row may
 * declare, in writing, that NOTHING decides it and name what would have to be built.
 *
 *     INSTRUMENT OWED: a gate asserting <the thing>, which does not exist
 *
 * It counts as coverage of a different KIND and is reported separately — never folded into the
 * verified figure, because a debt is not a measurement. */
const OWED = /INSTRUMENT OWED:\s*([^|]+?)(?:\s*\||$)/;
const SAFE = /^node\s+((?:engine|tests|build)[\\/][A-Za-z0-9_.\-]+\.js)((?:\s+--[A-Za-z0-9_\-=]+)*)\s*$/;

/* TWO OF MY OWN TOOLS PRINTED `register rows` AND DISAGREED — 206 HERE, 251 IN open_work.js.
 * Neither was wrong and that is the problem: `docs/ROADMAP.md` holds 251 lines shaped `| #N | …`, of
 * which 206 are DEFECT-REGISTER rows (a bolded claim and a status cell) and 45 are older planning
 * tables with four different columns (`| #33 | record which GARY ran | why | trivial |`). A marker
 * cannot be attached to those and they have no status to compare an exit code against. So the
 * denominator is stated rather than left to be inferred — CLAUDE.md's rule is that two files
 * deciding the same fact will disagree eventually and the disagreement will be invisible because
 * both keep working. This one was visible for about a minute. */
function parse(lines) {
  const rows = [];
  let idRows = 0;
  for (const l of lines) {
    if (/^\|\s*#\d+\s*\|/.test(l)) idRows++;
    const m = l.match(/^\|\s*#(\d+)\s*\|\s*\*\*(.{0,140})/);
    if (!m) continue;
    const mk = l.match(MARKER);
    rows.push({
      n: +m[1],
      title: m[2].replace(/\s+/g, ' ').slice(0, 90),
      closed: Q.roadmapRowIsClosed(l),
      saysBroken: Q.roadmapRowSaysBroken(l),
      cmd: mk ? mk[1].trim() : null,
      owed: (!mk && l.match(OWED)) ? l.match(OWED)[1].replace(/\s+/g, ' ').trim() : null,
    });
  }
  rows.idRows = idRows;
  return rows;
}

/* THE VERDICT TABLE, EXTRACTED SO THE SELFTEST DRIVES THE SHIPPING FUNCTION RATHER THAN A RESTATEMENT
 * OF IT. `green` is a tri-state: true, false, or null when the instrument could not be run at all —
 * and null is NOT green. An instrument that will not start says nothing about the row, and calling
 * that agreement is the "a capability was absent and everything reported success" shape. */
function verdict(row, green) {
  if (!row.cmd) return row.owed ? 'INSTRUMENT OWED' : 'UNVERIFIABLE';
  if (green === null) return 'INSTRUMENT UNRUNNABLE';
  if (!row.closed && green) return 'STALE ROW';
  if (row.closed && !green) return 'PREMATURE CLOSE';
  return 'CONFIRMED';
}
const BAD = new Set(['STALE ROW', 'PREMATURE CLOSE', 'INSTRUMENT UNRUNNABLE']);

/* ONE RUN PER DISTINCT COMMAND. Four rows closed on tests/test-seed-clock.js is the normal shape —
 * a gate is built for a defect and the defect splits — and running it four times costs four times as
 * much for an identical answer. Cached on the exact command STRING, so `--flag` variants stay
 * separate; there is no staleness risk because the whole cache lives for one process. */
const RUN_CACHE = new Map();
function run(cmd) {
  if (RUN_CACHE.has(cmd)) return { ...RUN_CACHE.get(cmd), cached: true };
  const r = runUncached(cmd);
  RUN_CACHE.set(cmd, r);
  return r;
}
function runUncached(cmd) {
  const m = cmd.match(SAFE);
  if (!m) return { green: null, why: 'the marker is not a plain `node <repo script>.js [--flags]` command, so it was NOT run' };
  const args = [path.join(ROOT, m[1])].concat((m[2] || '').trim() ? m[2].trim().split(/\s+/) : []);
  const t0 = Date.now();
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: TIMEOUT_MS });
    return { green: true, why: 'exit 0', ms: Date.now() - t0 };
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.killed))
      return { green: null, why: 'the instrument could not be run: ' + String(e.message).split('\n')[0], ms: Date.now() - t0 };
    return { green: false, why: 'exit ' + (e && e.status), ms: Date.now() - t0 };
  }
}

/* ================= THE SPLIT: ENUMERATING IS NOT MEASURING ========================================
 *
 * ROADMAP #369. `--list` advertised *"coverage only; runs nothing"*, and that was TRUE of the
 * INSTRUMENTS and FALSE of the ARTIFACT. Both modes ran down ONE code path, differing only in a
 * ternary, and fell through together into the write site at the bottom of the file. So a listing —
 * the thing you do to LOOK at the register without disturbing it — republished it.
 *
 * MEASURED ON THIS FILE'S OWN PRE-FIX BYTES, 2026-08-23. One `--list` took the settled
 * 2026-08-22T01:55:12.569Z artifact from `premature_closes: 2, unrunnable: 1,
 * distinct_commands_run: 22` to `0, 0, 0` — 306 insertions and 144 deletions against HEAD, every
 * verdict replaced by `NOT RUN` — and then printed *"REGISTER REALITY: every marked row agrees with
 * its instrument"*, a verdict sentence about 22 instruments not one of which had been started.
 * That second half is the worse half: the wipe leaves a trace in git, the false sentence does not.
 *
 * THE BLAST RADIUS IS A GATE. `openDefectClause` in engine/quarantine.js sorts each open row by the
 * `green` tri-state it finds here (quarantine.js:1570-1576): `false` -> withRed, `true` -> staleRows,
 * anything else -> unrunnable, and `ok` is `withRed.length === 0`. A wiped artifact carries `green:
 * null` on every row, so the FIVE rows whose instruments were measured RED (#218, #224, #241, #258,
 * #273) stop holding the clause shut — it reports OK for exactly the reason that should make it
 * loudest.
 *
 * THE FIX IS A SPLIT, NOT A FLAG CHECK BOLTED TO THE WRITE SITE. `if (!has('--list')) write(...)` is
 * one careless edit away from being wandered around, and it leaves the two behaviours sharing a body
 * that a reader has to hold two states in their head to follow. Instead:
 *
 *   enumerate(lines)   PURE. Parses the register and computes coverage. Starts no instrument, opens
 *                      no artifact. This is all `--list` gets to call.
 *   measure(en)        The ONLY thing that runs an instrument, and the ONLY producer of a
 *                      MEASUREMENT — an object carrying the module-private token below.
 *   publish(m, art)    THROWS unless it is handed a real measurement. The listing path never
 *                      constructs one, so it cannot write even if a later edit calls publish from it.
 *
 * AND `NOT RUN` IS GONE FROM THE VERDICT VOCABULARY. There is no longer a value this artifact could
 * carry meaning "this row was never checked", because there is no longer a code path that builds a
 * row without checking it. `publish` re-asserts that at the write site: a verdict outside VERDICTS
 * refuses the write rather than recording it.
 *
 * NOT MADE IDEMPOTENT, DELIBERATELY. Rewriting the file with identical content would still move its
 * mtime and its provenance, and the artifact's whole job is to say WHEN a verdict was measured.
 *
 * `--json` STILL WRITES, and that is not an inconsistency. `--json` runs every instrument; it is the
 * measurement wearing a different renderer, so its timestamp is honest. `--list` runs none. */
const MEASUREMENT_TOKEN = Symbol('register_reality: this came from a real run of the instruments');
const VERDICTS = new Set(['STALE ROW', 'PREMATURE CLOSE', 'CONFIRMED', 'UNVERIFIABLE',
  'INSTRUMENT OWED', 'INSTRUMENT UNRUNNABLE']);

/* PURE. Everything `--list` is allowed to touch lives in here. */
function enumerate(lines) {
  const rows = parse(lines);
  const marked = rows.filter(r => r.cmd);
  const owed = rows.filter(r => !r.cmd && r.owed);
  const openBroken = rows.filter(r => !r.closed && r.saysBroken);
  return {
    rows, marked, owed, openBroken,
    coverage: {
      register_rows: rows.length,
      id_rows: rows.idRows,
      open_asserting_breakage: openBroken.length,
      marked: marked.length,
      open_asserting_breakage_and_marked: openBroken.filter(r => r.cmd).length,
      instrument_owed: owed.length,
      open_asserting_breakage_and_owed: openBroken.filter(r => !r.cmd && r.owed).length,
    },
    unverifiable_open_defects: openBroken.filter(r => !r.cmd && !r.owed).map(r => ({ n: r.n, title: r.title })),
  };
}
const readRegister = () =>
  enumerate(fs.readFileSync(path.join(ROOT, 'docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/));

/* THE ONLY PLACE AN INSTRUMENT IS STARTED, AND THE ONLY PLACE A MEASUREMENT IS MINTED. */
function measure(en) {
  const results = [];
  for (const r of en.marked) {
    const res = run(r.cmd);
    results.push({ ...r, ...res, verdict: verdict(r, res.green) });
  }
  return { token: MEASUREMENT_TOKEN, en, results };
}

function buildArtifact(m) {
  if (!m || m.token !== MEASUREMENT_TOKEN)
    throw new Error('register_reality: buildArtifact() was not handed a measurement. Only measure() '
      + 'produces one, and only a run of the instruments produces verdicts (ROADMAP #369).');
  const c = m.en.coverage, results = m.results;
  return {
    generated: new Date().toISOString(),
    by: 'engine/register_reality.js',
    what: 'Every register row that names the instrument deciding it, run, with its exit code compared '
        + 'to the row\'s open/closed status.',
    why: 'docs/ROADMAP.md is read by engine/quarantine.js as a GATE INPUT and nothing checked it against '
       + 'reality. On 2026-08-14 four rows were stale rather than live and two of them were put in front '
       + 'of a human as the place to start. A row nobody re-verifies is prose.',
    weaker_than_it_looks: 'A green instrument means THAT instrument sees nothing. It is not a '
        + 'derivation of the row\'s claim. It is strictly more than the register had, which was nothing.',
    counts: {
      register_rows: c.register_rows,
      id_rows: c.id_rows,
      open_asserting_breakage: c.open_asserting_breakage,
      marked: c.marked,
      open_asserting_breakage_and_marked: c.open_asserting_breakage_and_marked,
      stale_rows: results.filter(r => r.verdict === 'STALE ROW').length,
      premature_closes: results.filter(r => r.verdict === 'PREMATURE CLOSE').length,
      unrunnable: results.filter(r => r.verdict === 'INSTRUMENT UNRUNNABLE').length,
      /* KEPT SEPARATE FROM `marked` ON PURPOSE. A row that has DECLARED nothing decides it is better
       * than a row that says nothing at all, and it is not the same thing as a verified row. Folding
       * the two into one coverage figure would be the caption-instead-of-a-quarantine move. */
      instrument_owed: c.instrument_owed,
      open_asserting_breakage_and_owed: c.open_asserting_breakage_and_owed,
      distinct_commands_run: RUN_CACHE.size,
    },
    instrument_owed: m.en.owed.map(r => ({ n: r.n, owes: r.owed, title: r.title })),
    /* WRITTEN THROUGH THE READER'S OWN KEY, NEVER SPELLED AGAIN — 2026-08-18.
     *
     * This said `results,` and `engine/quarantine.js`'s open-defect clause read `rr.rows`, `v.command`
     * and `v.exit` against this file's `results`, `cmd` and `green`. THREE key names, none matching, so
     * the clause saw zero verdicts on every run it has ever made and printed *"no open row names an
     * instrument that is RED"* — while #258's instrument was exiting 1. Nothing failed; the number was
     * simply never true. That is the `merge_mega_into_engine.js` failure to the letter: 67 writes, zero
     * matching keys, and no check comparing the two files.
     *
     * The key now comes from the consumer. The selftest above round-trips a built artifact back through
     * `Q.registerRealityRows`, so a rename on either side is RED rather than silent. */
    [Q.REGISTER_REALITY.rowsKey]: results,
    unverifiable_open_defects: m.en.unverifiable_open_defects,
  };
}

/* THE WRITE SITE, AND THE ONLY ONE. It refuses on the DATA rather than on the FLAG: a caller that is
 * not holding a measurement cannot publish, and neither can a measurement carrying a verdict that no
 * instrument produced. A `has('--list')` check here would be a restatement of the mode, which is what
 * failed. */
function publish(m, art) {
  if (!m || m.token !== MEASUREMENT_TOKEN)
    throw new Error('register_reality: REFUSING to write data/register-reality.json — publish() was not '
      + 'handed a measurement. This artifact records WHEN each verdict was measured; writing it from '
      + 'anything but a run of the instruments makes that timestamp a lie (ROADMAP #369).');
  for (const r of art[Q.REGISTER_REALITY.rowsKey])
    if (!VERDICTS.has(r.verdict))
      throw new Error('register_reality: REFUSING to write data/register-reality.json — row #' + r.n
        + ' carries verdict ' + JSON.stringify(r.verdict) + ', which no instrument produced.');
  fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
}

/* ---- rendering, shared by both paths so the coverage block cannot drift between them ------------ */
function renderCoverage(c) {
  console.log('  ' + String(c.register_rows).padStart(4) + '  defect-register rows  (of ' + c.id_rows
    + ' `| #N |` rows in the file; the other ' + (c.id_rows - c.register_rows)
    + ' are planning tables with no status cell to check an exit code against)');
  console.log('  ' + String(c.open_asserting_breakage).padStart(4) + '  OPEN and asserting breakage  (the MEDICHAM gate counts these)');
  console.log('  ' + String(c.open_asserting_breakage_and_marked).padStart(4) + '  of those, naming the instrument that decides them');
  console.log('  ' + String(c.open_asserting_breakage_and_owed).padStart(4) + '  of those, DECLARING that nothing decides them (a debt, not coverage)');
  console.log('  ' + String(c.marked).padStart(4) + '  rows carrying a VERIFIED BY marker in total');
  console.log('  ' + String(c.instrument_owed).padStart(4) + '  rows declaring INSTRUMENT OWED — nothing decides them and they say so');
}
function renderOwedAndProse(en) {
  if (en.owed.length) {
    console.log('  INSTRUMENT OWED — no gate decides these, and the row now says what would have to be built:');
    for (const r of en.owed) console.log('      #' + String(r.n).padEnd(5) + String(r.owed).slice(0, 110));
    console.log('');
  }
  if (en.unverifiable_open_defects.length) {
    console.log('  NO INSTRUMENT NAMED — these rows are still prose, and that is the coverage number:');
    for (const r of en.unverifiable_open_defects) console.log('      #' + String(r.n).padEnd(5) + r.title);
    console.log('');
  }
  console.log('  Add one to a row with:   VERIFIED BY: `node tests/<the gate that decides it>.js`');
  console.log('  If nothing decides it:   INSTRUMENT OWED: <the gate that would have to exist>');
}

/* THE WHOLE LISTING PATH, IN ONE FUNCTION THAT CANNOT WRITE. It does not call process.exit either —
 * the driver does — so the selftest can run it end to end with fs.writeFileSync booby-trapped and
 * assert the trap never fires. A claim that a path does not write is worth what its demonstration is
 * worth; this one is demonstrated on every run of the selftest. */
function renderListing(en, opts) {
  if (opts && opts.json) {
    console.log(JSON.stringify({
      listing: true,
      wrote: null,
      not_a_verdict: 'This is a COVERAGE LISTING. No instrument was run and data/register-reality.json '
        + 'was neither read nor written. The verdicts in that file are whatever the last real run measured.',
      coverage: en.coverage,
      marked: en.marked.map(r => ({ n: r.n, cmd: r.cmd, title: r.title })),
      instrument_owed: en.owed.map(r => ({ n: r.n, owes: r.owed, title: r.title })),
      unverifiable_open_defects: en.unverifiable_open_defects,
    }, null, 2));
    return;
  }
  console.log('\nREGISTER REALITY --list — COVERAGE ONLY. NO INSTRUMENT WAS RUN AND NOTHING WAS WRITTEN.\n');
  renderCoverage(en.coverage);
  console.log('');
  for (const r of en.marked)
    console.log('  ' + 'NOT RUN'.padEnd(22) + '#' + String(r.n).padEnd(5) + '--list: not run'.padEnd(22) + r.title);
  console.log('');
  renderOwedAndProse(en);
  console.log('\n  THIS IS NOT A VERDICT. data/register-reality.json was NOT written, and no row above was\n'
    + '  compared to anything. For the verdicts, run:   node engine/register_reality.js\n');
}

if (has('--selftest')) {
  let ran = 0, bad = 0;
  const ok = (n, c, got) => { ran++; if (!c) bad++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '   got ' + JSON.stringify(got)}`); };
  const R = (closed, cmd, owes) => ({ n: 1, title: 't', closed, saysBroken: true, cmd, owed: owes || null });
  const C = 'node tests/x.js';
  ok('RED — an OPEN row whose instrument is GREEN is a STALE ROW, the case that costs an agent',
    verdict(R(false, C), true) === 'STALE ROW', verdict(R(false, C), true));
  ok('RED — a CLOSED row whose instrument is RED is a PREMATURE CLOSE',
    verdict(R(true, C), false) === 'PREMATURE CLOSE', verdict(R(true, C), false));
  ok('an OPEN row with a RED instrument is CONFIRMED', verdict(R(false, C), false) === 'CONFIRMED');
  ok('a CLOSED row with a GREEN instrument is CONFIRMED', verdict(R(true, C), true) === 'CONFIRMED');
  ok('a row with no marker is UNVERIFIABLE, never assumed fine', verdict(R(false, null), true) === 'UNVERIFIABLE');
  ok('a row that DECLARES nothing decides it reads INSTRUMENT OWED, not UNVERIFIABLE',
    verdict(R(false, null, 'a gate on board.movePower'), true) === 'INSTRUMENT OWED');
  ok('RED — an INSTRUMENT OWED row is NOT counted as a failure; it is declared debt, not disagreement',
    !BAD.has('INSTRUMENT OWED'));
  ok('a VERIFIED BY marker WINS over an INSTRUMENT OWED note on the same row — a runnable gate is '
    + 'always stronger than a declaration that none exists',
    verdict(R(false, C, 'something'), false) === 'CONFIRMED');
  ok('RED — an instrument that will not run is NOT treated as agreement',
    verdict(R(false, C), null) === 'INSTRUMENT UNRUNNABLE' && BAD.has('INSTRUMENT UNRUNNABLE'));
  /* THE PARSER, ON SYNTHETIC ROWS. A marker that is not picked up reads as coverage that does not
   * exist, which is the failure this file is about wearing its own uniform. */
  const p = parse([
    '| #1 | **A THING.** VERIFIED BY: `node tests/a.js` | open — DEFECT |',
    '| #2 | **ANOTHER.** nothing here | open — DEFECT |',
    '| #3 | **A CLOSED ONE.** VERIFIED BY: `node tests/b.js --flag` | closed 2026-08-15 |',
  ]);
  ok('the marker is parsed off a row', p[0].cmd === 'node tests/a.js', p[0]);
  ok('a row without one carries null, not a guess', p[1].cmd === null);
  ok('flags survive the marker', p[2].cmd === 'node tests/b.js --flag', p[2]);
  ok('the closed-detector is the one the GATE uses, not a second copy', p[2].closed === true && p[0].closed === false);
  ok('RED — a marker that is not a plain node command is REFUSED rather than run',
    run('rm -rf /').green === null && /NOT run/.test(run('rm -rf /').why), run('rm -rf /'));
  ok('RED — a shell chain hidden after a legitimate script is refused too',
    run('node tests/a.js && curl evil').green === null);
  /* THE OWED MARKER, THROUGH THE PARSER, because a marker that is not picked up reads as prose and a
   * marker picked up off the wrong row reads as debt somebody else owes. */
  const po = parse([
    '| #4 | **NO GATE.** INSTRUMENT OWED: a gate asserting board.weather expires | open — DEFECT |',
    '| #5 | **HAS ONE.** VERIFIED BY: `node tests/a.js` INSTRUMENT OWED: ignored | open — DEFECT |',
    '| #6 | **NEITHER.** plain prose | open — DEFECT |',
  ]);
  ok('the owed note is parsed off a row and stops at the table cell boundary',
    po[0].owed === 'a gate asserting board.weather expires', po[0]);
  ok('a row with a real gate does NOT also read as owed — otherwise the debt figure double-counts',
    po[1].owed === null && po[1].cmd === 'node tests/a.js', po[1]);
  ok('a row with neither carries null for both', po[2].owed === null && po[2].cmd === null);
  /* THE CACHE, because a wrong cache would report one gate's exit code under another gate's name. */
  RUN_CACHE.clear();
  const c1 = run('node tests/does-not-exist-xyz.js');
  const c2 = run('node tests/does-not-exist-xyz.js');
  ok('the same command runs once and the second read is served from the cache',
    c2.cached === true && c1.cached !== true && c2.green === c1.green, { c1, c2 });
  ok('RED — a DIFFERENT command is not served from the first one cache entry',
    run('node tests/other-missing-xyz.js').cached !== true);
  /* -- THE WIRE TO THE GATE, ROUND-TRIPPED THROUGH BOTH SHIPPING SIDES ----------------------
   *
   * The clause in `quarantine.js` reads this file's artifact. For its whole life it read `rr.rows`,
   * `v.command` and `v.exit` against the `results`, `cmd` and `green` written here: three key names,
   * none matching, zero rows carried, and the clause reported "no open row names an instrument that
   * is RED" while #258's instrument exited 1. Nothing could catch it because nothing compared the two
   * files — the `merge_mega_into_engine.js` shape exactly.
   *
   * So the artifact below is built with the SHIPPING key (`Q.REGISTER_REALITY.rowsKey`) and read back
   * with the SHIPPING reader (`Q.registerRealityRows`). A rename on either side is RED here. The RED
   * case is the one that matters: an artifact under any other key must come back NULL, never `[]`,
   * because "no rows" and "I cannot see the rows" are the two answers this bug confused. */
  const WIRE = { [Q.REGISTER_REALITY.rowsKey]: [
    { n: 258, cmd: 'node tests/x.js', green: false, verdict: 'CONFIRMED' },
    { n: 99, cmd: 'node tests/y.js', green: true, verdict: 'STALE ROW' },
    { n: 98, cmd: null, green: null, verdict: 'UNVERIFIABLE' }] };
  const back = Q.registerRealityRows(WIRE);
  ok('THE WIRE — an artifact written with this file KEYS is READ by the gate reader, not dropped',
    Array.isArray(back) && back.length === 3, back);
  ok('THE WIRE — the command and the tri-state exit survive the crossing intact',
    back && back[0].n === 258 && back[0].cmd === 'node tests/x.js' && back[0].green === false
    && back[1].green === true && back[2].cmd === null && back[2].green === null, back);
  ok('RED — an artifact under the OLD key comes back NULL, not an empty list: "no rows" and '
    + '"I cannot see the rows" are the two answers this bug confused',
    Q.registerRealityRows({ rows: [{ n: 1, cmd: 'node tests/x.js', green: false }] }) === null);
  ok('RED — a row spelling its command the OLD way carries no command rather than a silent pass',
    (Q.registerRealityRows({ [Q.REGISTER_REALITY.rowsKey]: [{ n: 1, command: 'node tests/x.js', exit: 1 }] })
      || [{}])[0].cmd === null);

  /* -- ROADMAP #369: A READ-ONLY FLAG THAT WRITES ---------------------------------------------
   *
   * These four are the structural half of the fix. The behavioural half — that the real `--list`
   * process leaves data/register-reality.json byte-identical — is asserted from OUTSIDE this file,
   * by tests/test-register-reality-readonly.js, because a claim about a whole process is not one a
   * function inside that process can make honestly.
   *
   * Each was shown RED on the pre-fix bytes before being trusted: `verdict()` had no `NOT RUN` case
   * because the driver spelled it inline, the driver reached `fs.writeFileSync` unconditionally, and
   * there was no publish() to refuse anything. */
  const threw = (f) => { try { f(); return null; } catch (e) { return e; } };
  ok('RED — `NOT RUN` is not a verdict this file can produce for ANY row, at any tri-state. It was '
    + 'the value the listing path wrote over 22 measured verdicts with',
    [true, false, null].every(g => [true, false].every(cl =>
      [null, 'node tests/x.js'].every(cmd => verdict(R(cl, cmd), g) !== 'NOT RUN'))));
  ok('RED — buildArtifact REFUSES anything that is not a measurement, so an artifact cannot be '
    + 'assembled out of rows nothing ran',
    /REFUS|not handed a measurement/i.test(String(threw(() => buildArtifact({ results: [], en: {} })))));
  /* THE WRITER IS BOOBY-TRAPPED FOR THE REST OF THIS BLOCK. If any of it reaches the real
   * fs.writeFileSync the selftest fails LOUDLY instead of quietly republishing the artifact — the
   * exact accident #369 records, arriving through the check written to prevent it. */
  const realWrite = fs.writeFileSync, realLog = console.log;
  const trap = [];
  fs.writeFileSync = (...a) => { trap.push(String(a[0])); throw new Error('THE WRITER WAS REACHED'); };
  const EN0 = enumerate(['| #7 | **NO MARKER HERE.** plain prose | open — DEFECT |']);
  const m0 = measure(EN0);                       /* no row names an instrument, so nothing is run */
  const notMine = threw(() => publish({ token: {}, results: [] }, { [Q.REGISTER_REALITY.rowsKey]: [] }));
  const badVerdict = threw(() => publish(m0, { [Q.REGISTER_REALITY.rowsKey]: [{ n: 1, verdict: 'NOT RUN' }] }));
  let listingErr = null;
  console.log = () => {};
  listingErr = threw(() => { renderListing(EN0); renderListing(EN0, { json: true }); });
  console.log = realLog;
  fs.writeFileSync = realWrite;
  ok('RED — publish() REFUSES a caller that is not holding a measurement, and refuses at the WRITE '
    + 'SITE rather than by re-reading the mode flag',
    notMine && /REFUSING to write/.test(String(notMine)) && trap.length === 0, String(notMine));
  ok('RED — publish() REFUSES a row carrying a verdict no instrument produced, even from a real '
    + 'measurement: the artifact may not record "never checked" as a finding',
    badVerdict && /REFUSING to write/.test(String(badVerdict)) && /NOT RUN/.test(String(badVerdict)),
    String(badVerdict));
  ok('RED — THE WHOLE LISTING PATH RUNS, BOTH RENDERERS, WITH fs.writeFileSync BOOBY-TRAPPED, AND '
    + 'NEVER TOUCHES IT. This is the assertion #369 is about',
    listingErr === null && trap.length === 0, { listingErr: listingErr && listingErr.message, trap });

  console.log(`\nREGISTER-REALITY SELFTEST: ${ran - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ================= THE DRIVER — THIN, AND THE TWO PATHS DO NOT MEET =============================
 *
 * Read this and the read-only claim is checkable by eye: the listing branch calls readRegister() and
 * renderListing() and exits. It never names measure(), buildArtifact() or publish(), and publish()
 * would refuse it if it did. Everything below the exit is the MEASUREMENT, and it writes because it
 * measured. */
const en = readRegister();

if (has('--list')) {
  renderListing(en, { json: has('--json') });
  process.exit(0);          /* --list is an inventory, not a verdict, and never a publication. */
}

const m = measure(en);
const art = buildArtifact(m);
publish(m, art);
const results = m.results;
const failing = results.filter(r => BAD.has(r.verdict));

if (has('--json')) { console.log(JSON.stringify(art, null, 2)); process.exit(failing.length ? 1 : 0); }

const c = art.counts;
console.log('\nREGISTER REALITY — the register checked against the instruments, not against itself\n');
renderCoverage(c);
console.log('  ' + String(c.distinct_commands_run).padStart(4) + '  distinct instrument(s) actually run\n');
for (const r of results)
  console.log('  ' + r.verdict.padEnd(22) + '#' + String(r.n).padEnd(5)
    + ((r.why || '') + (r.cached ? ' (cached)' : '')).padEnd(22) + r.title);
console.log('');
renderOwedAndProse(en);
console.log('  wrote data/register-reality.json\n');
if (failing.length) {
  console.log('REGISTER REALITY: ' + failing.length + ' row(s) disagree with their own instrument. '
    + 'A stale row holds a gate shut on a defect that does not exist.');
  process.exit(1);
}
console.log('REGISTER REALITY: every marked row agrees with its instrument.');
