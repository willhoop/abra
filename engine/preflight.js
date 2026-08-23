/* preflight.js — IS THE THING YOU ARE ABOUT TO MEASURE ACTUALLY SWITCHED ON?
 *
 * WHY THIS EXISTS (Will, 2026-07-31: "bro i want small tests to avoid this")
 *
 * Two 1.5-hour self-play runs, 144,000 games each, were completed before anyone noticed that the
 * SWITCH WEIGHTS NEVER MOVED. Not "moved a little" — they were bit-identical to the behaviour clone
 * in both runs. The cause was one missing flag: `engine/train_policy.js` spawns its workers without
 * `--switching`, and `mew.js` makes switching opt-in, so MAG could not switch in a single training
 * game. Switch candidates never entered a choice set, those features never varied, the gradient for
 * that whole block was exactly zero, and a session's worth of switch work — post-KO replacement
 * scoring, entry effects, the mega moveset repair — was never exercised at all.
 *
 * The head-to-head queued off the back of that would have compared two policies differing by 1.9% in
 * the wrong features, returned a null, and invited the conclusion that the engine fixes do not help.
 * The codebase already carries this scar: `ABRA_TAGS_OFF` exists because "half this project's null
 * results came from arms that were not actually comparable."
 *
 * SO: run twenty games, not twenty thousand, and check the gradient is non-zero where you expect it.
 * Seconds instead of hours, and it fails LOUDLY rather than producing a plausible null.
 *
 * A zero gradient on a block is not a subtle statistical signal. It is proof the feature never varied
 * in any choice set, which means the lever is off, the flag is missing, or the code path is dead.
 * None of those are things a longer run fixes.
 *
 *   node engine/preflight.js                          # default weights, default flags
 *   node engine/preflight.js --n 40 --switching       # does enabling switching wake the block up?
 *   node engine/preflight.js --weights data/train3/iter-017.json --switching
 *
 * Any flag it does not recognise is passed straight through to mew_farm, so this is checked under
 * EXACTLY the configuration the real run will use. Checking a different configuration is the bug.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

require(D('data', 'engine-data.js'));
/* THE DOOR IS LOADED BESIDE THE TABLE, ALWAYS. engine/mc_key.js installs the SEAL on MC.mons --
 * a raw read of a key the table does not have then THROWS instead of returning undefined, which
 * is how the same species-key bug went unnoticed four separate times. Requiring it here is not
 * decoration: section 4 of tests/test-mc-key.js FAILS on any file that loads the table without
 * it, because a seal that depends on load order is a seal that is sometimes absent. */
require(D('engine', 'mc_key.js'));
const B = require(D('engine', 'board.js'));

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const N = parseInt(arg('n', '24'), 10);
const WEIGHTS = arg('weights', D('data', 'policy-weights.json'));
/* Everything this file does not consume is handed to the farm unchanged. */
const OWN = new Set(['--n', '--weights', '--out', '--procs', '--learn', '--keep-shards']);
const passthrough = [];
for (let i = 0; i < argv.length; i++) {
  if (OWN.has(argv[i])) { if (argv[i + 1] && !argv[i + 1].startsWith('--')) i++; continue; }
  passthrough.push(argv[i]);
}

/* ---- the blocks, derived from the feature list rather than typed out ------------------------
 * A "block" is a group of features that share a precondition, so they live or die together. If the
 * switch path is off, every switch feature is dead at once — reporting 8 separate zeros hides that
 * it is ONE cause. The grouping is by name prefix, taken from board.js's own list. */
/* THE FEATURE LIST FOLLOWS THE FLAGS. A --joint run trains 56 singles AND 18 pair weights, and this
 * file indexed only B.FEATURES -- so the gate would have run a joint training configuration, checked
 * the singles, and said nothing at all about the block that run exists to train. A gate that
 * certifies a configuration without checking its point is worse than no gate: it is the same
 * "lever believed on, silently off" failure with a green tick on top. */
const JOINT_ON = passthrough.some(f => /^--joint(-zero)?2?$/.test(f));
const F = JOINT_ON ? B.FEATURES.concat(B.JOINT_FEATURES) : B.FEATURES;
const BLOCKS = {
  'switching': F.filter(f => /^switch|^isSwitch$|^benchRisk$/.test(f)),
  'damage / KO': F.filter(f => /^ko|^dmgFrac$|^killIsRoll$|^killsThreat$/.test(f)),
  'type effectiveness': F.filter(f => /^eff|^immune$|^stab$/.test(f)),
  'speed & order': F.filter(f => /^movesFirst$|^priority$|^diesBeforeMoving$/.test(f)),
  'dead-move tests': F.filter(f => /^dead/.test(f)),
  'stat stages': F.filter(f => /Stage$|^movesBoost|^movesLower/.test(f)),
  'volatiles & protect': F.filter(f => /^volatile|Protect|^stallIntoEncore$/.test(f)),
};
/* Anything not claimed above still gets checked — silence about a feature is how this happened. */
const claimed = new Set(Object.values(BLOCKS).flat());
/* The pair block is named separately so a dead coordination layer reads as ONE cause, which is what
 * it would be -- the joint path falling back to independent choice kills all 18 together. */
if (JOINT_ON) {
  BLOCKS['joint (pair terms)'] = B.JOINT_FEATURES.slice();
  for (const j of B.JOINT_FEATURES) claimed.add(j);
}
BLOCKS['other'] = F.filter(f => !claimed.has(f));

const OUT = D('data', '.preflight.jsonl');
const shardDir = path.join(path.dirname(OUT), '.mew-shards');

console.log('PREFLIGHT — does the gradient actually reach the features you care about?\n');
console.log(`  games      ${N}   (this is meant to be small; it is a wiring check, not a measurement)`);
console.log(`  weights    ${path.relative(ROOT, WEIGHTS)}`);
console.log(`  flags      ${passthrough.join(' ') || '(none — DEFAULTS, which is what the real run will use)'}\n`);

if (fs.existsSync(shardDir)) {
  for (const f of fs.readdirSync(shardDir)) if (/\.grad\.json$/.test(f)) fs.unlinkSync(path.join(shardDir, f));
}

const t0 = Date.now();
const r = spawnSync(process.execPath, [
  D('engine', 'mew_farm.js'), '--n', String(N), '--procs', '2',
  '--policy', 'score', '--weights', WEIGHTS, '--learn', '--keep-shards',
  '--out', OUT, ...passthrough,
], { env: process.env, encoding: 'utf8', maxBuffer: 1 << 28 });

if (r.status !== 0) {
  console.error(`farm exited ${r.status}`);
  console.error(String(r.stderr || '').split('\n').slice(-15).join('\n'));
  process.exit(2);
}

/* Sum the shards exactly as train_policy.js does, so this measures the same quantity the trainer
 * will act on rather than a lookalike computed here. */
const grad = new Array(F.length).fill(0);
let games = 0, decisions = 0, files = 0;
if (fs.existsSync(shardDir)) {
  for (const f of fs.readdirSync(shardDir)) {
    if (!/\.grad\.json$/.test(f)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(shardDir, f), 'utf8')); } catch (e) { continue; }
    files++; games += j.games || 0; decisions += j.decisions || 0;
    for (let k = 0; k < grad.length && k < (j.grad || []).length; k++) grad[k] += j.grad[k];
  }
}

console.log(`  ran in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${files} shards, ${games} games, ${decisions.toLocaleString()} decisions\n`);
if (!decisions) {
  console.log('  NOTHING WAS LEARNED. Zero decisions contributed a gradient.');
  process.exit(1);
}

const mag = i => Math.abs(grad[i]);
let dead = 0;
console.log(`  ${'block'.padEnd(22)}${'live'.padStart(8)}${'dead'.padStart(7)}   |gradient|`);
console.log('  ' + '-'.repeat(62));
const deadBlocks = [];
for (const [name, feats] of Object.entries(BLOCKS)) {
  if (!feats.length) continue;
  const idx = feats.map(f => F.indexOf(f)).filter(i => i >= 0);
  const live = idx.filter(i => mag(i) > 0).length;
  const tot = Math.sqrt(idx.reduce((s, i) => s + grad[i] * grad[i], 0));
  const allDead = live === 0;
  if (allDead) { dead++; deadBlocks.push([name, feats]); }
  console.log(`  ${name.padEnd(22)}${String(live).padStart(8)}${String(idx.length - live).padStart(7)}   ${tot.toFixed(2).padStart(10)}${allDead ? '   << ENTIRE BLOCK DEAD' : ''}`);
}

if (dead) {
  console.log('\n  AT LEAST ONE WHOLE BLOCK RECEIVED NO GRADIENT.\n');
  console.log('  This is not a small effect or a power problem. A feature with an exactly zero');
  console.log('  gradient never varied inside any choice set, so no amount of extra games will');
  console.log('  change it. Something is switched off.\n');
  for (const [name, feats] of deadBlocks) {
    console.log(`    ${name}: ${feats.slice(0, 6).join(', ')}${feats.length > 6 ? ', …' : ''}`);
    if (name === 'switching') {
      console.log('      -> mew.js makes switching OPT-IN (`--switching`). Without it MAG cannot');
      console.log('         switch, so no switch candidate is ever scored. train_policy.js does not');
      console.log('         pass it: that is how 288,000 training games left these weights untouched.');
    }
  }
  console.log('\n  Fix the flag, re-run this, and only then start the long run.');
  process.exit(1);
}

console.log('\n  every block received a gradient — the wiring is live under THESE flags.');
console.log('  (this says nothing about whether the policy is any good; it says the experiment');
console.log('   is capable of moving the thing you are about to measure.)');
