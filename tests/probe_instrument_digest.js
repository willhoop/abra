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
/* AND THE ALIGNMENT AXIS IS HELD STILL TOO, ADDED 2026-09-08 — CONSTRUCTED, AND SAID SO, for the
 * third time in this file and for the same reason. `steering.alignment_inputs` (the digest of
 * `data/protocol-events.json`, the declared skip list that decides which Showdown lines may count as
 * a divergence) landed today, and `cap20-control-12.json` was taken before it existed — so BOTH sides
 * of this control lack it and the pair reads UNKNOWN on an axis this case is not about. That is the
 * clause behaving correctly and it makes the control vacuous, exactly as omitting `driver_code` would
 * have. An IDENTICAL block is written into both sides; the real artifact on disk is untouched. */
say('\n=== 4. CONTROL — same instrument, same pins, only the ENGINE RELEASE differs ===\n');
const ctlBefore = JSON.parse(JSON.stringify(base));
const ALIGN_HELD = [{ file: 'data/protocol-events.json', digest: '7c9de3868d6f' }];
ctlBefore.steering.alignment_inputs = JSON.parse(JSON.stringify(ALIGN_HELD));
const after = JSON.parse(JSON.stringify(ctlBefore));
after.engine_release = 'a5c736283129';
const r4 = AC.compare(ctlBefore, after);
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

/* ---- 7. A LINE ENDING MUST NOT DECIDE COMPARABILITY — 2026-09-08, MEASURE ----------------------
 *
 * THE DEFECT. `core.autocrlf` is `true` on the working machine, so git rewrites any file it calls
 * text on checkout. On 2026-09-08 `data/protocol-events.json` — `steering.alignment_inputs`, the
 * DECLARED SKIP LIST — went 7c9de3868d6f -> 2638eb253525 with `git status` reporting it CLEAN and
 * not a character edited, and `engine/medicham2-browser.js` went 9a54ee6881cf -> 8bdea30dbb42 with a
 * CR-insensitive diff of ZERO lines. `comparable()` reads the alignment axis UNCONDITIONALLY, so two
 * runs holding a BYTE-IDENTICAL skip list would be refused as a before/after over which machine had
 * checked the file out. This is the third occurrence of the class in this repository.
 *
 * NOTHING BELOW IS A TYPED DIGEST. Both byte forms of the real file are written to a temp directory
 * and handed to the REAL producers — `ER.sha12` is what the code did before this pass and
 * `ER.sha12Content` is what it does now — so the RED arm is the pre-fix producer's actual output,
 * not a reconstruction of it. Every other field is held identical between the two arms.
 *
 * IT PLAYS NO GAMES AND IT WRITES NOTHING INTO THE REPOSITORY. The temp files are the two forms of a
 * file already on disk; the artifact is never touched. */
say('\n=== 7. LINE ENDINGS — the RED arm (pre-fix producer) then the GREEN arm (this pass) ===\n');
const ER = require(path.join(ROOT, 'engine', 'engine_release.js'));
const SRC = path.join(ROOT, 'data', 'protocol-events.json');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eol-demo-'));
/* latin1 is a byte-exact round trip, so these are the two BYTE forms of one content. */
const raw = fs.readFileSync(SRC).toString('latin1');
const lfBytes = Buffer.from(raw.replace(/\r\n/g, '\n'), 'latin1');
const crlfBytes = Buffer.from(raw.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'latin1');
const pLF = path.join(tmp, 'lf.json'), pCRLF = path.join(tmp, 'crlf.json');
fs.writeFileSync(pLF, lfBytes); fs.writeFileSync(pCRLF, crlfBytes);
say('    one content, two checkouts:  LF ' + lfBytes.length + ' bytes   CRLF ' + crlfBytes.length + ' bytes');

/* The pair is a REAL artifact cloned twice, so nothing but the alignment stamp differs. */
const base7 = load(path.join(ROOT, 'data', 'game-differential.json'));
const armWith = (align) => {
  const x = JSON.parse(JSON.stringify(base7));
  x.steering.alignment_inputs = [Object.assign({ file: 'data/protocol-events.json' }, align)];
  return x;
};
/* RED: what the producer wrote BEFORE this pass — one field, the raw byte digest. */
const preLF = { digest: ER.sha12(pLF) }, preCRLF = { digest: ER.sha12(pCRLF) };
const r7red = AC.compare(armWith(preLF), armWith(preCRLF));
say('    RED  pre-fix producer:  ' + preLF.digest + ' vs ' + preCRLF.digest);
expect('verdict', r7red.verdict, 'NOT COMPARABLE');
expect('and the reason is the ALIGNMENT RULE',
  String(r7red.proven.some(x => x.startsWith('the ALIGNMENT RULE differs'))), 'true');
expect('exactly one reason — nothing else differs between the arms', String(r7red.proven.length), '1');

/* GREEN: what the producer writes now — the content digest, with the bytes recorded beside it. */
const postLF = { digest: ER.sha12Content(pLF), raw_digest: ER.sha12(pLF) };
const postCRLF = { digest: ER.sha12Content(pCRLF), raw_digest: ER.sha12(pCRLF) };
say('    GREEN this pass:        ' + postLF.digest + ' vs ' + postCRLF.digest
    + '   (raw ' + postLF.raw_digest + ' vs ' + postCRLF.raw_digest + ', still recorded)');
expect('the two checkouts now produce ONE digest', String(postLF.digest === postCRLF.digest), 'true');
expect('and the byte difference is still on the record',
  String(postLF.raw_digest !== postCRLF.raw_digest), 'true');
const r7green = AC.compare(armWith(postLF), armWith(postCRLF));
expect('verdict', r7green.verdict, 'COMPARABLE');
if (!r7green.ok) for (const x of r7green.reasons) say('      unexpected refusal: ' + x);

/* THE MIGRATION HALF, which a new digest function usually gets wrong. Every artifact on disk holds
 * ONE field — a RAW digest — and `data/game-differential.json` holds 2638eb253525, taken while this
 * machine's checkout was CRLF. A new run on that same machine must still meet it on the value they
 * share, or the fix would refuse every existing before/after for the reason it exists to remove. */
const r7mig = AC.compare(armWith({ digest: ER.sha12(pCRLF) }), armWith(postCRLF));
expect('an OLD raw stamp against a NEW pair of stamps, same checkout', r7mig.verdict, 'COMPARABLE');
/* AND THE LIMIT, MEASURED RATHER THAN LEFT FOR SOMEBODY TO DISCOVER. An old artifact stamped on a
 * CRLF checkout against a new run on an LF one shares no value, because the old arm never recorded
 * what its CONTENT digest was. That pair is still refused. It is a real gap and it is not repairable
 * after the fact — the same shape as the pre-2026-09-05 pairs in case 6 — and it closes as soon as
 * both arms are re-taken under the stamp. */
const r7limit = AC.compare(armWith({ digest: ER.sha12(pCRLF) }), armWith(postLF));
expect('an OLD raw-CRLF stamp against a NEW run on an LF checkout', r7limit.verdict, 'NOT COMPARABLE');
/* AND IT MUST STILL REFUSE A REAL EDIT. Without this the clause could simply accept everything. */
const pEdit = path.join(tmp, 'edited.json');
const edited = JSON.parse(raw); edited.notEmitted = (edited.notEmitted || []).slice(1);
fs.writeFileSync(pEdit, JSON.stringify(edited));
const r7ctl = AC.compare(armWith(postLF),
  armWith({ digest: ER.sha12Content(pEdit), raw_digest: ER.sha12(pEdit) }));
say('    CONTROL a row removed from the skip list: ' + ER.sha12Content(pEdit));
expect('a real content change is still refused', r7ctl.verdict, 'NOT COMPARABLE');
for (const f of [pLF, pCRLF, pEdit]) fs.unlinkSync(f);
fs.rmdirSync(tmp);

/* ---- 8. THE SAME AXIS, ON THE INSTRUMENT ITSELF ------------------------------------------------
 * `driver_code` is the wider exposure: 8 of the 11 files in the closure were CRLF in the working
 * tree on 2026-09-08 and pure LF in the index, so a checkout alone moved the roll. Taken from the
 * LIVE producer rather than constructed — `driverCode()` is run here and must record a content roll
 * and a byte roll that a reader can tell apart. */
say('\n=== 8. THE INSTRUMENT ROLL — content digest and byte digest are BOTH recorded ===\n');
const STEERING = require(path.join(ROOT, 'engine', 'steering.js'));
const dc = STEERING.driverCode({ entry: path.join(ROOT, 'engine', 'game_differential.js') });
say('    ' + Object.keys(dc.files).length + ' instrument file(s)   digest ' + dc.digest
    + '   raw_digest ' + dc.raw_digest);
expect('the roll records a content digest', String(!!dc.digest), 'true');
expect('and the byte roll beside it', String(!!dc.raw_digest), 'true');
const crlfNow = Object.keys(dc.files).filter(f => dc.files[f] !== dc.files_raw[f]);
say('    ' + crlfNow.length + ' of ' + Object.keys(dc.files).length
    + ' differ raw-vs-content right now: ' + (crlfNow.join(', ') || '(none)'));
/* A pair that differs ONLY on the raw roll must be COMPARABLE; the content roll is what decides. */
const dcOther = JSON.parse(JSON.stringify(dc)); dcOther.raw_digest = 'ffffffffffff';
const armDC = (d) => { const x = JSON.parse(JSON.stringify(base7)); x.steering.driver_code = d; return x; };
expect('a pair differing only in the BYTE roll', AC.compare(armDC(dc), armDC(dcOther)).verdict, 'COMPARABLE');
const dcMoved = JSON.parse(JSON.stringify(dc));
dcMoved.digest = 'aaaaaaaaaaaa'; dcMoved.raw_digest = 'bbbbbbbbbbbb';
const firstFile = Object.keys(dcMoved.files)[0];
dcMoved.files[firstFile] = 'cccccccccccc'; dcMoved.files_raw[firstFile] = 'dddddddddddd';
const r8 = AC.compare(armDC(dc), armDC(dcMoved));
expect('a real instrument change is still refused', r8.verdict, 'NOT COMPARABLE');
expect('and it names the file that moved',
  String(r8.proven.some(x => x.includes(firstFile))), 'true');

say('\n' + (fails ? '!! ' + fails + ' EXPECTATION(S) NOT MET' : 'ALL EXPECTATIONS MET') + '\n');
process.exit(fails ? 1 : 0);
