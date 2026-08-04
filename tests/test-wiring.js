/* test-wiring.js — does the bot actually USE each capability it is supposed to have?
 *
 *   SHOWDOWN_PATH=... node tests/test-wiring.js
 *
 * WHY THIS EXISTS, AND IT IS THE MOST IMPORTANT TEST IN THE REPOSITORY
 * -------------------------------------------------------------------
 * On 2026-07-28 Will played the bot for the first time. In one session he found:
 *
 *   the player had NEVER read a team sheet          setSheet() existed, six offline scripts
 *                                                   called it, magnemite.js never did
 *   self-play had NEVER used open team sheets       0 |showteam| events in 1,934 games
 *   mega evolution NEVER happened on the server     the option was not passed, and the base
 *                                                   class only megas from the LEFT slot anyway
 *   the joint layer fell back on 100% of turns      0 pairs decided, 99 fallbacks, no error
 *   the live-odds page never populated              recording was gated behind a debug flag
 *
 * Every one of those RAN CLEANLY. No exception, no discarded game, no failing test. The runs
 * reported success and the capability was simply not there. Three of them had been that way for
 * days, through a thesis defence, an exploitability study and a champion promotion.
 *
 * They are also invisible to every automated check the project already has. A head-to-head, an
 * exploitability search and a prediction score all compare two bots that SHARE the blind spot, so
 * the missing capability cancels out exactly. Only a human looking at the screen could see it, and
 * that does not scale.
 *
 * THE RULE THIS ENFORCES
 * ----------------------
 * A capability that cannot prove it ran is assumed broken.
 *
 * Not "is the code present", not "does it parse", not "did the run finish" -- those were all true
 * every time. This plays real games and asserts that each capability's own counter is NON-ZERO. A
 * feature can still be wrong after passing this; it cannot be ABSENT.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not check correctness. sheetEntries > 0 proves the
 * player read a sheet, not that it read it correctly. That is a different test and a harder one.
 * The class of bug being killed here is absence, which is the one that has actually cost time.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const GAMES = +(process.env.WIRING_GAMES || 6);

if (!process.env.SHOWDOWN_PATH) {
  console.error('test-wiring: set SHOWDOWN_PATH'); process.exit(2);
}

let failures = 0;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-wiring-'));

/* Run mew and return its stderr, which is where every capability counter is printed. */
function run(extra) {
  const out = path.join(TMP, 'g-' + Math.random().toString(36).slice(2) + '.jsonl');
  let stderr = '';
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'engine', 'mew.js'),
      '--n', String(GAMES), '--policy', 'score', '--conc', '2', '--seed', '31337',
      '--out', out, '--no-raw', ...extra],
      { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'], env: process.env });
  } catch (e) {
    stderr = String((e && e.stderr) || '');
    if (!stderr) { console.error('  run failed with no stderr'); return null; }
  }
  /* execFileSync only populates e.stderr on failure; on success it is on the result object, so
   * re-run capture via the returned buffer is not available -- read it from the spawn instead. */
  return stderr;
}

/* execFileSync discards stderr on success, so spawn it properly and keep the stream. */
function runCapture(extra) {
  const { spawnSync } = require('child_process');
  const out = path.join(TMP, 'g-' + Math.random().toString(36).slice(2) + '.jsonl');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine', 'mew.js'),
    '--n', String(GAMES), '--policy', 'score', '--conc', '2', '--seed', '31337',
    '--out', out, '--no-raw', ...extra],
    { encoding: 'utf8', env: process.env, timeout: 600000 });
  return String(r.stderr || '') + String(r.stdout || '');
}

/* Pull "  label: 1,234 ..." out of the report. Returns null when the line is absent entirely,
 * which is itself a failure -- a capability that does not even report is not wired. */
function counter(text, label) {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*([\\d,]+)');
  const m = re.exec(text);
  return m ? +m[1].replace(/,/g, '') : null;
}

function assertUsed(text, label, what) {
  const n = counter(text, label);
  if (n === null) {
    console.log(`  FAIL  ${what}\n        no "${label}" line in the run report at all — the capability does not even report`);
    failures++; return;
  }
  if (n === 0) {
    console.log(`  FAIL  ${what}\n        "${label}" is ZERO — the code is present and the capability is not there`);
    failures++; return;
  }
  console.log(`  ok    ${what}  (${n.toLocaleString()})`);
}

console.log('WIRING — does the bot actually USE what it is supposed to have?\n');
console.log(`  ${GAMES} self-play games per configuration\n`);

console.log('default configuration (open sheets forced, mega on):');
const base = runCapture([]);
assertUsed(base, 'policy=score', 'the scoring policy decides moves');
assertUsed(base, 'aiming', 'it chooses WHICH foe to hit');
assertUsed(base, 'open team sheets', 'the PLAYER reads the open team sheet');
assertUsed(base, 'mega evolution', 'it mega evolves when it holds a stone');
assertUsed(base, 'team preview', 'it samples a bring from the priors');

console.log('\njoint layer (--joint):');
/* A NON-ZERO COUNTER IS NOT A STRONG ENOUGH BAR FOR EVERYTHING.
 *
 * Will's domain rule: "IT SHOULD BE TRULY RARE TO SEE A GAME THAT DIDNT HAVE A MEGA IN THIS
 * FORMAT." Mega would have passed an at-least-one check at 56% of sides, which IS the broken
 * state -- the base class could only mega from the LEFT slot, so it looked alive while missing
 * half of them. Measured: 56% of sides before the fix, 85% after.
 *
 * So this one gets a RATE floor taken from the domain, not from the code. */
function assertRate(text, label, perGameMin, what, note) {
  const n = counter(text, label);
  const per = n === null ? 0 : n / GAMES;
  if (per < perGameMin) {
    console.log(`  FAIL  ${what}`);
    console.log(`        ${per.toFixed(2)} per game, expected at least ${perGameMin.toFixed(2)}. ${note}`);
    failures++;
  } else {
    console.log(`  ok    ${what}  (${per.toFixed(2)}/game)`);
  }
}
assertRate(base, 'mega evolution', 1.0, 'mega happens about as often as the format implies',
  'Half that rate is the signature of the left-slot-only bug, which a non-zero check passes.');

const joint = runCapture(['--policy2', 'score', '--joint']);
assertUsed(joint, 'joint layer', 'the pair model decides both slots together');
/* EVERY CAPABILITY IS RE-CHECKED UNDER --joint, BECAUSE THE JOINT PATH IS A SECOND CODE PATH.
 *
 * This file measured the mega rate on the DEFAULT run only, and asked of the joint run merely that
 * the joint layer had run at all. The broken cell was the intersection, and no assertion stood in
 * it: _decidePair returned candsA[pa].choice directly, bypassing _withMega, which had exactly one
 * call site. So `joint: true` silently disabled mega evolution, and Will found it in the client on
 * 2026-08-01 -- "now it never emgaed" -- as the FOURTH occurrence of a mega defect in this project.
 *
 * A capability verified in one configuration is verified in one configuration. The joint path
 * decides both slots and returns through different code, so it re-earns every claim rather than
 * inheriting it. */
assertRate(joint, 'mega evolution', 1.0, 'mega still happens when the JOINT layer decides',
  'The joint path returns through _decidePair, which is not the path _withMega was called from.');
assertUsed(joint, 'aiming', 'it still chooses WHICH foe to hit when the pair decides');
assertUsed(joint, 'open team sheets', 'it still reads the open team sheet when the pair decides');

console.log('');
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}

if (failures) {
  console.log(`${failures} capability/ies are NOT WIRED. The code exists, the run succeeded, and the`);
  console.log('bot cannot do the thing. That is the exact failure this file was written for.');
  process.exit(1);
}
console.log('every capability proved it ran.');
