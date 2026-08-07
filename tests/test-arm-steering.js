/* test-arm-steering.js — THE RED DEMONSTRATION FOR THE STEERING GUARD. ROADMAP #81 WIRE 5.
 *
 *   SHOWDOWN_PATH=... node tests/test-arm-steering.js
 *
 * A GUARD THAT HAS NEVER BEEN SHOWN FIRING IS NOT A GUARD. This project has shipped that mistake, and
 * four before/after pairs in four WIREs were found resting on the defect this guard now watches.
 *
 * WHAT IS BEING PROVED, and the order matters — the CONTROL is cleared explicitly first, because
 * "identical results across a varied knob mean the knob is unwired, not that it does not matter":
 *
 *   1  GREEN CONTROL   two arms of the SAME frozen release under BYTE-IDENTICAL census bytes produce
 *                      IDENTICAL numbers, and the guard says COMPARABLE. Without this, step 3 could be
 *                      nothing but run-to-run noise.
 *   2  THE KNOB IS WIRED  the same frozen release under a DIFFERENT census produces DIFFERENT numbers.
 *                      If this failed, the census would not steer anything and the whole wire would be
 *                      guarding a hazard that does not exist. It is asserted, not assumed.
 *   3  RED             the guard REFUSES that pair — exit 1, naming the digests.
 *   4  RED, EARLIER    `game_differential.js --baseline <arm A> --census <B>` refuses with exit 3
 *                      BEFORE playing a game, so an incomparable pair costs nothing.
 *   5  FAILS CLOSED    an artifact with no `steering` block is NOT COMPARABLE. Every artifact written
 *                      before this wire has none, and the honest verdict for those is "nothing
 *                      recorded whether they were comparable", never "they were".
 *
 * THE PERTURBED CENSUS IS THE REAL EVENT, NOT A SYNTHETIC ONE. It is the live census with move rows
 * removed — which is exactly what the census looked like before a batch of probes landed, and landing
 * probes is what ENGINE does in the same session as a before/after.
 *
 * NOTHING HERE TOUCHES data/game-differential.json (`--out`) OR data/mechanics-census.json.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const GAMES = 60;

if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — the differential needs the official simulator. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-steering-'));
console.log('  working files: ' + tmp + '   (left on disk on purpose — they are the evidence)');

/* THE RELEASE IS NAMED AND NEVER CUT. Cutting here would append a cut event describing a tree this
 * test did not measure, and would re-point the live release pointer under whatever else is running. */
const RELEASE = JSON.parse(fs.readFileSync(D('data', 'engine-release.json'), 'utf8')).current;

const censusA = path.join(tmp, 'census-A.json');
const censusA2 = path.join(tmp, 'census-A-copy.json');
const censusB = path.join(tmp, 'census-B.json');
const live = fs.readFileSync(D('data', 'mechanics-census.json'), 'utf8');
fs.writeFileSync(censusA, live);
fs.writeFileSync(censusA2, live);          // byte-identical, a DIFFERENT file — the pin is on bytes
{
  const c = JSON.parse(live);
  const before = c.results.length;
  /* "as it looked before the last batch of probes landed" — the move rows carry the steering weight,
   * because covWant scores a MOVE by the census rows it can reach. */
  const moves = c.results.filter(r => r.kind === 'move');
  const drop = new Set(moves.slice(-40).map(r => r.kind + ':' + r.tag));
  c.results = c.results.filter(r => !drop.has(r.kind + ':' + r.tag));
  c.generated = '2026-01-01T00:00:00.000Z';
  fs.writeFileSync(censusB, JSON.stringify(c, null, 2) + '\n');
  console.log('  census B is census A minus ' + (before - c.results.length) + ' move rows ('
    + before + ' -> ' + c.results.length + ')');
}

let FAILS = 0;
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) FAILS++; };

function runArm(censusPath, outName, extra) {
  const out = path.join(tmp, outName);
  const args = ['engine/game_differential.js', '--release', RELEASE, '--games', String(GAMES),
                '--census', censusPath, '--write', '--out', out].concat(extra || []);
  const r = { out, code: 0, stdout: '' };
  try { r.stdout = execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) {
    /* A NON-ZERO EXIT IS THE EXPECTED OUTCOME OF STEP 4, so it is not an error here — but the REASON
     * is kept and printed, because "exit 3" and "exit 3 because node could not find the file" are
     * different facts and only one of them is the demonstration. */
    r.code = e.status === undefined ? -1 : e.status;
    r.err = String((e && e.message) || e).split('\n')[0];
    r.stdout = String(e.stdout || '') + String(e.stderr || '');
    console.log('       (arm exited ' + r.code + ': ' + r.err + ')');
  }
  return r;
}

/* The numbers a before/after table is actually written from. If the census steers, these move. */
function fingerprint(a) {
  return JSON.stringify({
    games: a.games, diverged: a.diverged, threw: a.threw,
    classes: (a.classes || []).map(c => [c.cls, c.games, c.causes.length]).sort(),
    moves_connected: a.coverage && a.coverage.distinct_moves_connected,
    exercised: a.coverage && a.coverage.exercised_by_a_connected_move,
  });
}

function guard(x, y) {
  try { execFileSync(process.execPath, ['engine/arms_comparable.js', x, y],
                     { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return 0; }
  catch (e) {
    /* exit 1 IS the guard firing, which is what step 3 is for. Exit 2 (unreadable file) and a crash
     * would both be "non-zero" too, and reporting either as a successful refusal is how a broken
     * demonstration passes. The reason is printed so the two cannot be confused. */
    const code = e.status === undefined ? -1 : e.status;
    console.log('       (guard exited ' + code + ': ' + String((e && e.message) || e).split('\n')[0] + ')');
    return code;
  }
}

console.log('\n--- 1  GREEN CONTROL: identical census bytes ------------------------------------------');
const A = runArm(censusA, 'arm-A.json');
const A2 = runArm(censusA2, 'arm-A2.json');
check(A.code === 0 && A2.code === 0, 'both control arms ran (exit ' + A.code + '/' + A2.code + ')');
const jA = JSON.parse(fs.readFileSync(A.out, 'utf8'));
const jA2 = JSON.parse(fs.readFileSync(A2.out, 'utf8'));
check(jA.steering.input_digest === jA2.steering.input_digest,
  'the two control arms report the SAME steering digest ' + jA.steering.input_digest);
check(fingerprint(jA) === fingerprint(jA2),
  'the two control arms produce IDENTICAL numbers — the instrument is deterministic under a fixed census');
check(guard(A.out, A2.out) === 0, 'the guard says COMPARABLE (exit 0) for the control pair');

console.log('\n--- 2  THE KNOB IS WIRED: a different census ------------------------------------------');
const B = runArm(censusB, 'arm-B.json');
check(B.code === 0, 'the perturbed arm ran (exit ' + B.code + ')');
const jB = JSON.parse(fs.readFileSync(B.out, 'utf8'));
check(jB.steering.input_digest !== jA.steering.input_digest,
  'arm B reports a DIFFERENT steering digest (' + jA.steering.input_digest + ' -> ' + jB.steering.input_digest + ')');
check(jB.engine_release === jA.engine_release,
  'both arms name the SAME frozen engine release ' + jA.engine_release + ' — the ENGINE did not move');
const moved = fingerprint(jA) !== fingerprint(jB);
check(moved, moved
  ? 'the SAME frozen engine produced DIFFERENT numbers under a different census — the census STEERS'
  : 'THE CENSUS DID NOT CHANGE THE NUMBERS. Either covWant no longer steers (then this guard guards '
    + 'nothing and should be deleted) or the perturbation was too small to bite. Do NOT read this as a pass.');
if (moved) {
  console.log('       A: diverged ' + jA.diverged + '/' + jA.games + ', ' + jA.classes.length + ' classes, '
    + jA.coverage.distinct_moves_connected + ' moves connected');
  console.log('       B: diverged ' + jB.diverged + '/' + jB.games + ', ' + jB.classes.length + ' classes, '
    + jB.coverage.distinct_moves_connected + ' moves connected');
  const cls = c => { const m = new Map(); for (const x of c.classes) m.set(x.cls, x.games); return m; };
  const ca = cls(jA), cb = cls(jB);
  for (const k of new Set([...ca.keys(), ...cb.keys()])) {
    if ((ca.get(k) || 0) !== (cb.get(k) || 0)) console.log('       class `' + k + '`: ' + (ca.get(k) || 0) + ' -> ' + (cb.get(k) || 0));
  }
}

console.log('\n--- 3  RED: the guard must REFUSE that pair -------------------------------------------');
const g = guard(A.out, B.out);
check(g === 1, 'the guard says NOT COMPARABLE (exit 1, got ' + g + ') for two arms of one release under two censuses');

console.log('\n--- 4  RED, EARLIER: the differential refuses before spending the run -----------------');
const refused = runArm(censusB, 'arm-refused.json', ['--baseline', A.out]);
check(refused.code === 3, '--baseline against an incomparable steering exits 3 (got ' + refused.code + ')');
check(!fs.existsSync(path.join(tmp, 'arm-refused.json')), 'it wrote no artifact — it refused before playing a game');
check(/NOT COMPARABLE/.test(refused.stdout), 'and it said NOT COMPARABLE out loud');
const accepted = runArm(censusA2, 'arm-accepted.json', ['--baseline', A.out]);
check(accepted.code === 0, 'THE CONTROL FOR (4): --baseline with the SAME census runs normally (exit ' + accepted.code + ')');

console.log('\n--- 5  FAILS CLOSED: an artifact that declares no steering ----------------------------');
const STEERING = require('../engine/steering.js');
const old = STEERING.comparable(undefined, jA.steering);
check(old.ok === false, 'an arm with no `steering` block is NOT COMPARABLE — it is not silently waved through');
check(/predates/.test(old.reasons.join(' ')), 'and the reason names why: nothing recorded what selected its sample');

console.log('\n' + (FAILS ? FAILS + ' FAILED' : 'all steering-guard demonstrations passed'));
process.exit(FAILS ? 1 : 0);
