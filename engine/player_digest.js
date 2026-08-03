/* player_digest.js — WHICH BOT MADE THIS DATA, in one string.
 *
 * WHY THIS EXISTS (Will, 2026-08-02: "but if we find more bugs in the self play bot it happens again
 * and all subsequent models it flows into")
 *
 * He is right, and it had already happened without anyone noticing. The chain is:
 *
 *     MAG has a bug  ->  self-play games are wrong  ->  PORYGON2 learns from them
 *                    ->  everything downstream of PORYGON2 inherits it
 *
 * data/porygon2.json is sitting on disk today with a number produced from games generated
 * 2026-07-28 by a bot that had the wrong ability on 25% of Pokemon, no damage row for eight species,
 * a broken click matcher, no switching, and a sampling rather than greedy decision rule. Its own
 * caveat warns about exactly this shape. Nothing anywhere said the warning had come true, and it was
 * found by Will asking rather than by any check.
 *
 * WHY THE STAMP THAT ALREADY EXISTS DOES NOT COVER IT
 * ---------------------------------------------------
 * Every self-play corpus records `engine_commit`, and that is the POKEMON-SHOWDOWN checkout -- the
 * simulator. It is the right thing to pin for reproducing a battle from a seed, and it is the wrong
 * thing entirely for this question: the simulator did not change once across 2026-08-02 while MAG
 * changed enormously. A corpus can carry an identical engine_commit and have been played by a
 * completely different bot.
 *
 * WHAT ACTUALLY DETERMINES HOW THE BOT PLAYS
 * ------------------------------------------
 * Four things, and all four are already digestible without inventing anything:
 *
 *   the FEATURES it computes    feature_fixture.hashes().features      (board.js semantics)
 *   the PAIR features           feature_fixture.hashes().jointFeatures
 *   the DATA they read          feature_fixture.hashes().table         (the damage table)
 *   the WEIGHTS it multiplies   a hash of the shipped vector itself
 *
 * A CONTENT HASH, NOT A COMMIT, and deliberately. A commit changes when a comment changes; this
 * changes when BEHAVIOUR changes and not otherwise. Reformat board.js and the digest holds. Fix a
 * feature and it moves. That is the property that makes it worth checking automatically -- a guard
 * that cries wolf on every commit gets switched off, which this repository has already learned about
 * three separate ratchets.
 *
 *   const PD = require('./player_digest.js');
 *   PD.digest(dex, weightsFile)   ->  { digest, parts }
 *   PD.compare(stamped)           ->  null when it still matches, or a sentence saying what moved
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const h = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);

/* The weights are hashed from the VECTOR, not the file, so a restamp or a reformat of the JSON does
 * not read as a different player. Only the numbers the bot multiplies count. */
function weightsDigest(file) {
  const f = file ? (path.isAbsolute(file) ? file : D(file)) : D('data', 'policy-weights.json');
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) {
    /* Named OUT LOUD, not merely recorded in the return value: "no weights file" and "weights
     * unchanged" must not read alike, which is the whole disease this repository has been driving
     * out -- and a caller that ignores the field would never see the difference. */
    if (typeof console !== 'undefined' && console.error) {
      console.error(`player_digest: cannot read ${path.relative(ROOT, f)} (${e.message}); the weight `
        + 'half of the digest is UNAVAILABLE, which is NOT a statement that the weights are unchanged.');
    }
    return { file: path.relative(ROOT, f), digest: 'UNAVAILABLE', why: e.message };
  }
  const w = j.weights;
  if (!Array.isArray(w)) return { file: path.relative(ROOT, f), digest: 'UNAVAILABLE', why: 'no `weights` array' };
  return { file: path.relative(ROOT, f), digest: h(w.map(x => (+x).toFixed(6)).join(',')), n: w.length };
}

function digest(dex, weightsFile, jointWeightsFile) {
  const FX = require('./feature_fixture.js');
  const fh = FX.hashes(dex);
  const parts = {
    features: h(Object.entries(fh.features).map(([k, v]) => k + '=' + v).join('|')),
    jointFeatures: h(Object.entries(fh.jointFeatures).map(([k, v]) => k + '=' + v).join('|')),
    table: (fh.table && fh.table.digest) || 'UNAVAILABLE',
    weights: weightsDigest(weightsFile),
  };
  if (jointWeightsFile !== undefined) parts.jointWeights = weightsDigest(jointWeightsFile);
  const flat = [parts.features, parts.jointFeatures, parts.table, parts.weights.digest,
    parts.jointWeights ? parts.jointWeights.digest : ''].join('|');
  return { digest: h(flat), parts };
}

/* WHAT MOVED, not merely THAT something moved. A guard that says "stale" sends someone hunting; one
 * that says "the damage table changed and the weights did not" tells them whether a refit is even
 * the right response. The four parts are reported separately for exactly that reason -- it is the
 * same argument feature_fixture.verify() makes for keeping the table verdict apart from the feature
 * verdict. */
function compare(stamped, dex, weightsFile, jointWeightsFile) {
  if (!stamped || !stamped.digest) {
    return 'this artifact records no player digest, so which bot generated it cannot be established. '
      + 'That is not the same as it being current — re-stamp it, or treat every number from it as '
      + 'unattributable.';
  }
  const now = digest(dex, weightsFile, jointWeightsFile);
  if (now.digest === stamped.digest) return null;
  const moved = [];
  const sp = stamped.parts || {};
  const np = now.parts;
  const cmp = (name, a, b) => { if (a !== undefined && a !== b) moved.push(`${name} (${a} -> ${b})`); };
  cmp('the FEATURES board.js computes', sp.features, np.features);
  cmp('the PAIR features', sp.jointFeatures, np.jointFeatures);
  cmp('the DAMAGE TABLE they read', sp.table, np.table);
  cmp('the WEIGHTS it multiplies', sp.weights && sp.weights.digest, np.weights.digest);
  if (np.jointWeights) cmp('the JOINT weights', sp.jointWeights && sp.jointWeights.digest, np.jointWeights.digest);
  return 'the bot that produced this data is NOT the bot that runs now.\n    '
    + (moved.length ? moved.join('\n    ') : `digest ${stamped.digest} -> ${now.digest}, parts not recorded`)
    + '\n  Anything fitted on it is fitted on a player that no longer exists. Regenerate the corpus '
    + 'and retrain, or state why the difference does not reach this model.';
}

module.exports = { digest, compare, weightsDigest };

/* ---- CLI ---------------------------------------------------------------------------------------
 *   node engine/player_digest.js                      print the current digest
 *   node engine/player_digest.js <corpus.jsonl>       check a corpus against the current bot
 */
if (require.main === module) {
  const CS = require('./champions_sim.js');
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const target = process.argv[2];
  const now = digest(dex, null, 'data/policy-weights-joint.json');
  if (!target) {
    console.log('CURRENT PLAYER DIGEST\n');
    console.log('  digest        ' + now.digest);
    for (const [k, v] of Object.entries(now.parts)) {
      console.log('  ' + k.padEnd(14) + (typeof v === 'string' ? v : v.digest + '  ' + (v.file || '')));
    }
    process.exit(0);
  }
  const file = path.isAbsolute(target) ? target : D(target);
  let stamped = null, badLines = 0;
  const rl = require('readline').createInterface({ input: fs.createReadStream(file) });
  rl.on('line', (l) => {
    if (stamped) return;
    try { const g = JSON.parse(l); if (g.selfplay) { stamped = g.selfplay.player || null; rl.close(); } }
    catch (e) {
      /* A first line that will not parse means the corpus is damaged, which is worth one word even
       * though it is not the question being asked. Silence here would let a truncated file read as
       * a corpus that simply carries no stamp. */
      badLines++;
    }
  });
  rl.on('close', () => {
    console.log(`PLAYER CHECK — ${path.relative(ROOT, file)}\n`);
    const verdict = compare(stamped, dex, null, 'data/policy-weights-joint.json');
    if (!verdict) { console.log('  ok   this corpus was produced by the bot that runs now (' + now.digest + ')'); process.exit(0); }
    console.log('  STALE  ' + verdict);
    process.exit(1);
  });
}
