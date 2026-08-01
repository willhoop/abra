/* test-sprt-arm-sign.js — SPRT must not report a verdict with its sign inverted.
 *
 * WHY THIS EXISTS. `engine/sprt.js` is the tool that gates every ship decision in this project. On
 * 2026-08-01 its sign was CHANGED on a bad reading and nearly shipped, which is the same hazard as
 * the sign being wrong and is what this test now prevents.
 *
 * THE CONVENTION, established by the file that defined the unit: **arm 1 is the challenger.**
 * `mew.js:837` stamps `winnerArm = 1` for the `--policy`/`--weights`/`--greedy` arm and `2` for the
 * `2`-suffixed one. `paired_h2h.js:183` builds its NEW label from arm 1 and prints it as NEW, and the
 * run that measured greedy at 79.7% put `--greedy` on arm 1. So NEW = arm 1.
 *
 * The near-miss: `mew.js:215` calls `--weights2` "the challenger", which is true of the
 * EXPLOITABILITY search (WOBBUFFET hunting a vector that beats a fixed MAG) and not of the standard
 * A/B. Reading it as a global convention and flipping sprt would have put it at odds with
 * paired_h2h.js and inverted every run already analysed.
 *
 * A wrong NUMBER gets argued with. A wrong SIGN gets acted on, and it ships the worse arm. So the
 * test constructs runs whose winner is known by construction and asserts the verdict points at it —
 * in BOTH directions, because a file with the sign flipped passes one and fails the other.
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

const ARM1 = 'NEW-challenger.json';     // --weights,  arm 1, the one SPRT calls NEW
const ARM2 = 'OLD-baseline.json';       // --weights2, arm 2, the incumbent

/* Build a paired run in which a chosen arm wins every DECISIVE pair.
 *
 * A decisive pair is one arm winning both halves of the same matchup from both sides, so each pair
 * is two records with the same seed and six, opposite `swapped`, won by the same arm. winnerWeights
 * is filled the way mew.js fills it, because that is the field a reader checks when the label is in
 * doubt — and the one that settled this question. */
function writeRun(file, winner) {
  const lines = [];
  const six = { p1: ['Garchomp', 'Gyarados', 'Incineroar', 'Whimsicott', 'Torkoal', 'Grimmsnarl'],
                p2: ['Venusaur', 'Charizard', 'Blastoise', 'Clefable', 'Alakazam', 'Machamp'] };
  for (let i = 0; i < 200; i++) {
    for (const swapped of [false, true]) {
      lines.push(JSON.stringify({
        id: `g${i}-${swapped ? 'b' : 'a'}`, six,
        selfplay: {
          seed: 1000 + i, swapped,
          policy: 'score', policy2: 'score',
          weights: ARM1, weights2: ARM2,
          winnerArm: winner,
          winnerWeights: winner === 1 ? ARM1 : ARM2,
        },
      }));
    }
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

const run = (file) => spawnSync(process.execPath, [path.join(ROOT, 'engine', 'sprt.js'), file],
  { encoding: 'utf8' }).stdout || '';

/* ---- 1. ARM 1 — the challenger — WINS EVERYTHING ---------------------------------------------- */
const fArm1 = path.join(TMP, 'arm1-wins.jsonl');
writeRun(fArm1, 1);
const out1 = run(fArm1);

ok(/the NEW arm is better/.test(out1),
  'when arm 1 (--policy/--weights, the challenger) wins every pair, the verdict says NEW is better');
ok(/NEW takes 100\.0% of them/.test(out1), '...and it takes 100% of decisive pairs, not 0%');
ok(!/NOT an improvement/.test(out1), '...and is not reported as a null');

/* ---- 2. ARM 2 — the incumbent — WINS EVERYTHING, the mirror image ----------------------------- */
const fArm2 = path.join(TMP, 'arm2-wins.jsonl');
writeRun(fArm2, 2);
const out2 = run(fArm2);

ok(/NOT an improvement worth shipping/.test(out2),
  'when arm 2 wins every pair, the challenger is correctly reported as no improvement');
ok(/NEW takes 0\.0% of them/.test(out2), '...and takes 0% of decisive pairs');

/* This pair of assertions is what makes it a SIGN test rather than a smoke test: the two runs are
 * exact mirrors, so a file reading the sign backwards passes one and fails the other. */
ok(/the NEW arm is better/.test(out1) && /NOT an improvement/.test(out2),
  'the two mirrored runs give opposite verdicts — the sign is actually being read');

/* ---- 3. AGREEMENT WITH paired_h2h.js ---------------------------------------------------------- */
/* The two analysers must not disagree about which arm is which. paired_h2h.js is the file that
 * established the decisive-pair unit, so it is the reference, and this asserts sprt matches the line
 * it uses rather than trusting that both were read correctly. */
const ph = fs.readFileSync(path.join(ROOT, 'engine', 'paired_h2h.js'), 'utf8');
const sp = fs.readFileSync(path.join(ROOT, 'engine', 'sprt.js'), 'utf8');
const armRule = src => (/winnerArm === 1 \? 1 : 0/.test(src) ? 'arm1=NEW'
                     : /winnerArm === 2 \? 1 : 0/.test(src) ? 'arm2=NEW' : 'unrecognised');
ok(armRule(ph) === 'arm1=NEW', `paired_h2h.js treats arm 1 as NEW (${armRule(ph)})`);
ok(armRule(sp) === armRule(ph),
  `sprt.js uses the SAME rule as paired_h2h.js (sprt ${armRule(sp)}, paired_h2h ${armRule(ph)})`);

/* ---- 4. THE LABELS MUST NAME THE FILES -------------------------------------------------------- */
/* What made this hard to see was a report that said "NEW" and left which-is-which to a convention
 * the reader had to already know. Naming the file makes a run set up the other way round visible in
 * the output instead of plausible. */
ok(/NEW\s*=\s*arm 1[^\n]*NEW-challenger\.json/.test(out1),
  'the report names the weight file NEW refers to, and says which arm it is');
ok(/OLD\s*=\s*arm 2[^\n]*OLD-baseline\.json/.test(out1),
  'the report names the weight file OLD refers to, and says which arm it is');

/* ---- 5. AGREEMENT WITH THE UNAMBIGUOUS FIELD -------------------------------------------------- */
/* winnerWeights exists because a policy NAME goes blind when both arms share one. If the label and
 * winnerWeights ever disagree, winnerWeights is right. */
const winnerWeightsSays = (file) => {
  const t = {};
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    const w = JSON.parse(l).selfplay.winnerWeights;
    t[w] = (t[w] || 0) + 1;
  }
  return Object.entries(t).sort((a, b) => b[1] - a[1])[0][0];
};
ok(winnerWeightsSays(fArm1) === ARM1 && /the NEW arm is better/.test(out1),
  'the verdict agrees with winnerWeights, the field that cannot be ambiguous');
ok(winnerWeightsSays(fArm2) === ARM2 && /NOT an improvement/.test(out2),
  '...in both directions');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { console.error('  (temp cleanup failed: ' + e.message + ')'); }

console.log(`\nSPRT ARM SIGN TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
