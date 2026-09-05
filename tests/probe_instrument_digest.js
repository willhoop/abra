/* probe_instrument_digest.js — DOES arms_comparable REFUSE A PAIR THAT PLAYED DIFFERENT INSTRUMENT
 * CODE, AND DOES IT STILL PASS A PAIR THAT DID NOT?
 *
 * 2026-09-05, MEASURE. ROADMAP #81 WIRE 5, the instrument half.
 *
 *   node tests/probe_instrument_digest.js
 *
 * THE DEFECT. The pins freeze every INPUT to a differential run — the engine release freezes 26
 * sources, the census pin freezes the scenarios, the team-pool pin freezes the population — and none
 * of them freeze THE CODE THAT READS THEM. Six whole-game runs were taken on one identical set of
 * pins (release 688e696f00c8, census 9446a684709d, pool 0d103fb9fa87, 961 games, cap 12, byte-
 * identical driver_inputs) and read 121, 121, 138, 167, 167, 147, because engine/empirical_driver.js
 * was rewritten at 02:27 and engine/game_differential.js at 02:28. The arm reproduced EXACTLY on both
 * sides of the edit. It was reported as non-determinism; it was a code change nobody could see.
 *
 * WHY THIS FILE EXISTS AND NOT JUST A UNIT TEST. Two of those six artifacts are still on disk, so the
 * fixture is REAL rather than synthetic, and the check can be shown to have answered COMPARABLE about
 * them from the actual pre-fix bytes in git. Where a case had to be constructed it says so in its own
 * header and names which fields were moved and where the values came from — a constructed fixture
 * presented as a measurement is the failure this repository is named after.
 *
 * IT PLAYS NO GAMES. Every case reads artifacts that are already on disk. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const V = (f) => path.join(ROOT, 'data', 'verification', f);
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const AC = require(path.join(ROOT, 'engine', 'arms_comparable.js'));

let fails = 0;
const say = (s) => console.log(s);
function expect(label, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  say('    ' + (ok ? 'as expected' : '!! MISMATCH') + '  ' + label + ': ' + got
      + (ok ? '' : '   (expected ' + want + ')'));
}

/* ---- 0. THE SHAPE, BEFORE ANY FIELD IS QUERIED -------------------------------------------------
 * Uniformity across results is the tell that a query is reading nothing. So the population is
 * printed first: how many artifacts carry the stamp at all, and which. */
say('\n=== 0. SHAPE — which artifacts on disk carry steering.driver_code? ===\n');
const dir = path.join(ROOT, 'data', 'verification');
const stamped = [], unstamped = [];
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
  let a;
  try { a = load(path.join(dir, f)); }
  catch (e) { say('    UNREADABLE ' + f + ': ' + e.message); continue; }
  if (!a.steering) continue;                       // not a differential artifact at all
  (a.steering.driver_code ? stamped : unstamped).push(
    f + (a.steering.driver_code ? ' @ ' + a.steering.driver_code.digest : ''));
}
const gd = path.join(ROOT, 'data', 'game-differential.json');
const gdStamped = !!(fs.existsSync(gd) && (load(gd).steering || {}).driver_code);
say('    STAMPED   ' + stamped.length + ':  ' + (stamped.join('   ') || '(none)'));
say('    UNSTAMPED ' + unstamped.length + ' differential artifacts in data/verification/');
say('    data/game-differential.json (the published gate figure): '
    + (gdStamped ? 'STAMPED' : 'UNSTAMPED'));
say('\n    So the field is new. Every artifact older than 2026-09-05 07:00Z predates it, and the six');
say('    runs that produced 121/138/147/167 are ALL unstamped — the fixture below is that pair.');

/* ---- 1. RED FIRST, ON THE REAL ARTIFACTS -------------------------------------------------------
 * The two artifacts are real, unedited, and are two of the six. `leaf-widening-all16-joint.json` was
 * written at 06:26Z and read 138; `...-BEFORE.json` at 06:32Z and read 167. Same release, same census
 * pin, same pool, same games, same cap, same driver_inputs. Different driver code.
 *
 * The PRE-FIX verdict is taken from the bytes in commit 6f81649b rather than described, because "it
 * used to say COMPARABLE" typed into a comment is prose outliving what it described. */
const A138 = V('leaf-widening-all16-joint.json');
const A167 = V('leaf-widening-all16-joint-BEFORE.json');

say('\n=== 1. THE REAL FIXTURE — 138 vs 167, one set of pins, different driver code ===\n');
const a = load(A138), b = load(A167);
say('    before  ' + path.basename(A138) + '  diverged=' + a.diverged
    + '  release=' + a.engine_release + '  census=' + a.steering.input_digest
    + '  pool=' + a.steering.team_pool_digest + '  cap=' + a.turns_cap);
say('    after   ' + path.basename(A167) + '  diverged=' + b.diverged
    + '  release=' + b.engine_release + '  census=' + b.steering.input_digest
    + '  pool=' + b.steering.team_pool_digest + '  cap=' + b.turns_cap);
say('    driver_code: before=' + (a.steering.driver_code ? a.steering.driver_code.digest : 'ABSENT')
    + '  after=' + (b.steering.driver_code ? b.steering.driver_code.digest : 'ABSENT'));

/* The pre-fix module, loaded from git. Its two local requires are rewritten to absolute paths so it
 * can run from a temp directory; nothing else is touched. NOT a silent fallback — a failure to build
 * the old modules is REPORTED and the case is marked unmeasured, never quietly skipped. */
function preFixVerdict(x, y) {
  const REV = '6f81649b';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-prefix-'));
  const get = (f) => execFileSync('git', ['show', REV + ':' + f], { cwd: ROOT, encoding: 'utf8',
                                                                    maxBuffer: 8 << 20 });
  const abs = (p) => JSON.stringify(path.join(ROOT, 'engine', p).replace(/\\/g, '/'));
  fs.writeFileSync(path.join(tmp, 'steering.js'),
    get('engine/steering.js').replace(/require\('\.\/engine_release\.js'\)/g,
                                      'require(' + abs('engine_release.js') + ')'));
  fs.writeFileSync(path.join(tmp, 'arms_comparable.js'),
    get('engine/arms_comparable.js').replace(/require\('\.\/steering\.js'\)/g,
                                             'require(' + JSON.stringify(
                                               path.join(tmp, 'steering.js').replace(/\\/g, '/')) + ')'));
  const old = require(path.join(tmp, 'arms_comparable.js'));
  const r = old.compare(x, y);
  return { verdict: r.ok ? 'COMPARABLE' : 'NOT COMPARABLE', reasons: r.reasons };
}

let pre = null;
try { pre = preFixVerdict(a, b); }
catch (e) {
  fails++;
  say('    !! could not load the pre-fix modules from commit 6f81649b: ' + e.message);
  say('       The RED half of this case is UNMEASURED. It is not being reported as passed.');
}
if (pre) {
  say('\n    PRE-FIX (commit 6f81649b, the bytes that were on disk this morning):');
  expect('verdict', pre.verdict, 'COMPARABLE');
  say('      ...on two runs that played different driver code. That is the hole.');
}

const now = AC.compare(a, b);
say('\n    NOW:');
expect('verdict', now.verdict, 'UNKNOWN');
expect('ok', String(now.ok), 'false');
for (const r of now.unknowns) say('      UNKNOWN: ' + r.slice(0, 110) + '...');

/* ---- 2a. A REAL PAIR WHOSE STAMPS ACTUALLY DIFFER ----------------------------------------------
 * Both artifacts are real and unedited and both carry the stamp, so the clause is exercised on
 * measured digests. THEY DIFFER IN OTHER WAYS TOO — different policy, pool, games — so this shows the
 * clause FIRES on real data, not that it is the only reason. Case 2b isolates it. */
say('\n=== 2a. REAL, BOTH STAMPED, DIGESTS DIFFER (confounded — other axes differ too) ===\n');
const s1 = load(V('_repro-smoke.json')), s2 = load(V('cap20-control-12.json'));
say('    ' + '_repro-smoke.json @ ' + s1.steering.driver_code.digest + '  vs  '
    + 'cap20-control-12.json @ ' + s2.steering.driver_code.digest);
const r2a = AC.compare(s1, s2);
expect('verdict', r2a.verdict, 'NOT COMPARABLE');
const instr2a = r2a.proven.filter(x => x.startsWith('the INSTRUMENT differs'));
expect('the instrument clause fired', String(instr2a.length), '1');
if (instr2a.length) say('      ' + instr2a[0].slice(0, 200) + '...');

/* ---- 2b. THE SAME QUESTION, ISOLATED — A CONSTRUCTED PAIR --------------------------------------
 * CONSTRUCTED, AND SAID SO. `cap20-control-12.json` is used for BOTH sides; the after-arm's
 * `steering.driver_code` block is replaced with the one measured in `_repro-smoke.json`. Both digests
 * are real, measured values from real runs on this tree six hours apart. NOTHING ELSE IS CHANGED, so
 * the instrument is the only axis on which the two sides differ.
 *
 * This case exists because NO REAL PAIR ON DISK differs ONLY in driver code: the field is hours old
 * and the four artifacts carrying it were taken in two sittings that also moved the cap or the pool.
 * Constructing it is the honest way to isolate the clause; claiming a real isolated pair would not be. */
say('\n=== 2b. CONSTRUCTED — identical artifact, driver_code swapped for another REAL measured one ===\n');
const base = load(V('cap20-control-12.json'));
const swapped = JSON.parse(JSON.stringify(base));
swapped.steering.driver_code = JSON.parse(JSON.stringify(s1.steering.driver_code));
const r2b = AC.compare(base, swapped);
expect('verdict', r2b.verdict, 'NOT COMPARABLE');
expect('exactly one reason, and it is the instrument', String(r2b.proven.length), '1');
say('      ' + (r2b.proven[0] || '(none)').slice(0, 240) + '...');

/* ---- 3. REAL, BOTH STAMPED, SAME INSTRUMENT ----------------------------------------------------
 * Two real 961-game runs taken two minutes apart with the same driver code and a different turn cap.
 * The instrument clause must stay SILENT: a guard that fires on everything is one people route
 * around, and the cap difference is a real, separate reason that must still be reported. */
say('\n=== 3. REAL, BOTH STAMPED, SAME INSTRUMENT — the clause must not over-fire ===\n');
const c12 = load(V('cap20-control-12.json')), c20 = load(V('cap20-empirical.json'));
const r3 = AC.compare(c12, c20);
expect('verdict', r3.verdict, 'NOT COMPARABLE');
expect('no instrument reason', String(r3.reasons.filter(x => x.startsWith('the INSTRUMENT')).length), '0');
expect('the cap is still caught', String(r3.proven.some(x => x.startsWith('`turns_cap`'))), 'true');

/* ---- 4. THE CONTROL — A PAIR THAT DIFFERS ONLY IN THE CHANGE UNDER TEST ------------------------
 * WITHOUT THIS THE CHECK COULD SIMPLY REFUSE EVERYTHING and look like it worked.
 *
 * CONSTRUCTED, AND SAID SO, FOR THE SAME REASON AS 2b: a before/after differs in `engine_release`,
 * and no two artifacts on disk carry the instrument stamp AND two different releases — the stamp is
 * six hours old and both sittings used release 688e696f00c8. So the after-arm here is the real
 * artifact with `engine_release` set to a5c736283129, a real release id from earlier the same night.
 * That is exactly what a controlled before/after looks like: the engine moved, nothing else did. */
say('\n=== 4. CONTROL — same instrument, same pins, only the ENGINE RELEASE differs ===\n');
const after = JSON.parse(JSON.stringify(base));
after.engine_release = 'a5c736283129';
const r4 = AC.compare(base, after);
expect('verdict', r4.verdict, 'COMPARABLE');
expect('ok', String(r4.ok), 'true');
if (!r4.ok) for (const x of r4.reasons) say('      unexpected refusal: ' + x);

/* ---- 5. THE ONE-SIDED CASE, ON TWO REAL 961-GAME ARTIFACTS -------------------------------------
 * Real, unedited, and the strongest pair on disk: identical release, census pin, pool, policy, games,
 * cap, pin set and driver_inputs. They read 121 and 147. One carries the stamp and one does not, and
 * the honest verdict is that nothing recorded whether they ran the same instrument. */
say('\n=== 5. REAL ONE-SIDED — 121 vs 147, every other pin identical ===\n');
const u121 = load(V('leaf-widening-all16-empirical.json'));
const r5 = AC.compare(u121, c12);
say('    diverged ' + u121.diverged + ' vs ' + c12.diverged + '   driver_code ABSENT vs '
    + c12.steering.driver_code.digest);
expect('verdict', r5.verdict, 'UNKNOWN');

/* ---- 6. WHAT NOT GRANDFATHERING COSTS, PRICED RATHER THAN ASSERTED -----------------------------
 * A real before/after taken tonight: two 961-game runs on the same census, pool, cap and policy with
 * two different engine releases — the textbook controlled pair. Both predate the stamp. Under the new
 * rule it reads UNKNOWN. This case is here so the cost is a printed number rather than a claim. */
say('\n=== 6. THE COST — a real tonight before/after, both unstamped ===\n');
const f7 = load(V('fix-batch-7.json')), f8 = load(V('fix-batch-8.json'));
const r6 = AC.compare(f7, f8);
say('    fix-batch-7 (release ' + f7.engine_release + ', ' + f7.diverged + ') vs '
    + 'fix-batch-8 (release ' + f8.engine_release + ', ' + f8.diverged + ')');
expect('verdict', r6.verdict, 'UNKNOWN');
say('    Every pre-2026-09-05 before/after in this repository reads UNKNOWN on the instrument axis.');
say('    That is not a new defect in those pairs. It is the axis never having been recorded.');

say('\n' + (fails ? '!! ' + fails + ' EXPECTATION(S) NOT MET' : 'ALL EXPECTATIONS MET') + '\n');
process.exit(fails ? 1 : 0);
