/* test-sprt-arm-sign.js — SPRT must not report a verdict with its sign inverted.
 *
 * WHY THIS EXISTS. `engine/sprt.js` is the tool that gates every ship decision in this project, and
 * on 2026-08-01 it reported one backwards.
 *
 * `mew.js:837` stamps `winnerArm = 1` for the `--weights`/`--policy` arm and `2` for
 * `--weights2`/`--policy2`, and `mew.js:215` documents arm 2 as the challenger: "the challenger is
 * MAG's own machinery with different numbers". sprt.js read `winnerArm === 1` as the new arm — the
 * incumbent. It also disagreed with ITSELF: the name-based fallback treats whichever arm is called
 * 'score' as new, which in the canonical `--policy prior --policy2 score` run is arm 2. The same
 * file answered opposite ways depending on which branch a record took.
 *
 * Live consequence, measured: a refit-vs-shipped run printed "NEW takes 33.3% ==> NOT an improvement
 * worth shipping" while the challenger had actually won 9,783 games to 7,567.
 *
 * A wrong NUMBER gets argued with. A wrong SIGN gets acted on, and it ships the worse arm. So the
 * test is built the way the defect demands: construct a run whose winner is known by construction,
 * and assert the verdict points at it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('SPRT ARM SIGN — the verdict must point at the arm that actually won\n');

const TMP = path.join(require('os').tmpdir(), 'abra-sprt-sign-' + process.pid);
fs.mkdirSync(TMP, { recursive: true });

/* Build a paired run in which a chosen arm wins a chosen share of DECISIVE pairs.
 *
 * A decisive pair is one arm winning both halves of the same matchup from both sides. So for each
 * pair we emit two records with the same seed and the same six, opposite `swapped`, both won by the
 * same arm. `winnerWeights` is filled the way mew.js fills it, because that is the field a reader
 * checks when they distrust the label. */
function writeRun(file, { winner, pairs }) {
  const lines = [];
  const six = { p1: ['Garchomp', 'Gyarados', 'Incineroar', 'Whimsicott', 'Torkoal', 'Grimmsnarl'],
                p2: ['Venusaur', 'Charizard', 'Blastoise', 'Clefable', 'Alakazam', 'Machamp'] };
  for (let i = 0; i < pairs; i++) {
    for (const swapped of [false, true]) {
      lines.push(JSON.stringify({
        id: `g${i}-${swapped ? 'b' : 'a'}`, six,
        selfplay: {
          seed: 1000 + i, swapped,
          policy: 'score', policy2: 'score',
          weights: 'OLD-incumbent.json', weights2: 'NEW-challenger.json',
          winnerArm: winner,
          winnerWeights: winner === 1 ? 'OLD-incumbent.json' : 'NEW-challenger.json',
        },
      }));
    }
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

const run = (file) => spawnSync(process.execPath, [path.join(ROOT, 'engine', 'sprt.js'), file],
  { encoding: 'utf8' }).stdout || '';

/* ---- 1. THE CHALLENGER (arm 2) WINS EVERYTHING ------------------------------------------------ */
const fChallenger = path.join(TMP, 'challenger-wins.jsonl');
writeRun(fChallenger, { winner: 2, pairs: 200 });
const outC = run(fChallenger);

ok(/the NEW arm is better/.test(outC),
  'when arm 2 (--weights2, the documented challenger) wins every pair, the verdict says NEW is better');
ok(/NEW takes 100\.0% of them/.test(outC), '...and it takes 100% of decisive pairs, not 0%');
ok(!/NOT an improvement/.test(outC), '...and is not reported as a null');

/* ---- 2. THE INCUMBENT (arm 1) WINS EVERYTHING — the mirror image ------------------------------ */
const fIncumbent = path.join(TMP, 'incumbent-wins.jsonl');
writeRun(fIncumbent, { winner: 1, pairs: 200 });
const outI = run(fIncumbent);

ok(/NOT an improvement worth shipping/.test(outI),
  'when arm 1 wins every pair, the challenger is correctly reported as no improvement');
ok(/NEW takes 0\.0% of them/.test(outI), '...and takes 0% of decisive pairs');

/* The two runs are exact mirrors, so a file that gets the sign wrong passes one and fails the other.
 * Asserting both is what makes this a sign test rather than a smoke test. */
ok(/the NEW arm is better/.test(outC) && /NOT an improvement/.test(outI),
  'the two mirrored runs give opposite verdicts — the sign is actually being read');

/* ---- 3. THE LABELS MUST NAME THE FILES -------------------------------------------------------- */
/* The original defect was invisible because the report said "NEW" and left which-is-which to a
 * convention. Naming the file makes a swapped run visible in the output. */
ok(/NEW\s*=\s*arm 2.*NEW-challenger\.json/.test(outC),
  'the report names the weight file NEW refers to');
ok(/OLD\s*=\s*arm 1.*OLD-incumbent\.json/.test(outC),
  'the report names the weight file OLD refers to');

/* ---- 4. AGREEMENT WITH THE UNAMBIGUOUS FIELD -------------------------------------------------- */
/* winnerWeights exists precisely because a policy NAME goes blind when both arms share one. The
 * verdict must agree with it; if they ever disagree, winnerWeights is right and the label is not. */
const winnerWeightsSays = (file) => {
  const t = {};
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    const w = JSON.parse(l).selfplay.winnerWeights;
    t[w] = (t[w] || 0) + 1;
  }
  return Object.entries(t).sort((a, b) => b[1] - a[1])[0][0];
};
ok(winnerWeightsSays(fChallenger) === 'NEW-challenger.json' && /the NEW arm is better/.test(outC),
  'the verdict agrees with winnerWeights, the field that cannot be ambiguous');
ok(winnerWeightsSays(fIncumbent) === 'OLD-incumbent.json' && /NOT an improvement/.test(outI),
  '...in both directions');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.error('  (temp cleanup failed: ' + e.message + ')'); }

console.log(`\nSPRT ARM SIGN TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
