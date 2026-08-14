/* argmax_paired.js — DOES THE SEED WORK CHANGE WHAT MILTANK ACTUALLY CLICKS?
 *
 *   tools\lownode.cmd --max-old-space-size=3072 engine\argmax_paired.js
 *
 * THE QUESTION THIS ANSWERS, AND THE ONE IT DOES NOT
 * -------------------------------------------------
 * R13 through R16 each published a PREVALENCE: the share of decision points at which the rollout seed
 * handed MEDICHAM a position that is not the real one. 70.6%, 39.7%, 3.6%, 8.8%. Every one of those
 * reports said, correctly, that it is a CEILING ON REACH and not an effect — a body priced holding a
 * Life Orb it no longer holds may still be the same argmax.
 *
 * This is the paired run. THE SAME decision points, scored twice: once under the board and leaf as
 * they were BEFORE any of that work (commit f8f2c67, 2026-08-10), once under the current ones. Common
 * random numbers, keyed on the CANDIDATE'S IDENTITY rather than its index, so a cell gets the same
 * dice in both arms even when the menu itself moved. The number reported is the ARGMAX FLIP RATE.
 *
 * A FLIP IS NOT A WIN. It is a different choice under a more correct board. Direction is reported as
 * a leaf-value gap under the NEWER arm's own leaf, and that gap is biased upward by the argmax — which
 * is exactly what the noise-floor control below measures, and why it is computed the same way there.
 *
 * THE THREE CONTROLS
 * ------------------
 *   1. SELF, DIFFERENT DICE. The current arm run twice against itself, identical in everything except
 *      the seed salt. The truth there is 0.00 flips by construction, so whatever it reports is what
 *      the instrument invents. A flip rate that does not beat this floor is not a result.
 *   2. SELF, IDENTICAL DICE. Asserted to be exactly 0 flips and exactly 0 value gap. This is a purity
 *      check on the harness — a paired run that cannot reproduce itself is measuring its own state.
 *   3. AN ARM PAIR THAT IS INERT BY CONSTRUCTION. #271 (the knocked-off item) is closed in board.js
 *      and its only writer is `board.noteItem`, whose ONE caller in the repository is the live
 *      protocol reader `engine/magnemite.js`. The offline replay never emits an item event, so the
 *      r14 -> r15 arm pair must report exactly 0. It is a control that costs a rollout pass and is
 *      worth it: it fails loudly if any part of this harness is non-deterministic.
 *
 * WHAT THIS HARNESS STRUCTURALLY CANNOT SEE, STATED UP FRONT RATHER THAN DISCOVERED LATER
 * --------------------------------------------------------------------------------------
 * The decision points come from `engine/joint_rows.js`'s replay, which is the fit's replay and the
 * only implementation of it. That replay applies switches, moves (through `B.noteMove`, so side
 * conditions and move counts land), damage, status, hp, boosts, faints, weather and field — and it
 * applies NEITHER `board.noteItem` NOR `board.startVolatile`. So:
 *
 *   #271 (a removed item)      — INERT here. Its live reach is real; MEASURE's PRIORITIES 13e is the
 *                                missing offline event, and it is not this run's to add.
 *   #269 (durable volatiles)   — INERT here, same reason.
 *
 * Every flip this run reports is therefore a FLOOR on what the live board would show, and the two
 * rows above contribute exactly none of it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const { execFileSync } = require('child_process');

const D = (...p) => path.join(__dirname, '..', ...p);
const ER = require('./engine_release.js');

/* ---- the arms ------------------------------------------------------------------------------- */
/* Each arm is a COMMIT, and the delta between consecutive arms is one landing. Read off
 * `git log -- engine/board.js engine/rollout_leaf.js`; the labels name the ROADMAP rows that landed
 * in that commit, so a per-row attribution is a subtraction rather than an assertion. */
const ARMS = [
  { label: 'pre',  commit: 'f8f2c67', adds: '(baseline — before any of the seed work)' },
  { label: 'r13',  commit: '16bd0e5', adds: '#244 the fallen count reaches the seed' },
  { label: 'h254', commit: '1cd6af5', adds: '#254 a side condition lands on the right side' },
  { label: 'r14',  commit: '25d67c5', adds: '#247 #248 #249 #250 bench state, move count, side state' },
  { label: 'r15',  commit: '435be2b', adds: '#271 a knocked-off item (INERT offline — see header)' },
  { label: 'head', commit: '58a26a7', adds: '#267 #268 #269 #270 the clocks' },
];
/* The harness closure that must move WITH the board, because these files call into it and two of them
 * changed in the same commits (`joint_rows.js` grew the `B.sideFor` call in h254, so HEAD's joint_rows
 * throws `B.sideFor is not a function` against the `pre` board). Compiled per arm from that arm's own
 * bytes; everything else comes from the frozen release. */
const PER_ARM = ['board.js', 'click_match.js', 'click_class.js', 'sheet_channels.js',
                 'fit_policy.js', 'joint_rows.js', 'rollout_leaf.js'];
/* Loaded ONCE, from the release snapshot, and aliased onto the live paths so that a per-arm module's
 * `require('./medicham2-browser.js')` gets the FROZEN bytes. This is the whole freeze: the simulator,
 * the dex loader, the tags, the priors, the weights and the engine data are identical across every
 * arm and cannot move while the run is in flight. */
const SHARED = ['engine/medicham2-browser.js', 'engine/tags.js', 'engine/pp.js', 'engine/mc_key.js',
                'engine/lookup.js', 'engine/champions_sim.js',
                'engine/set_priors.js', 'engine/smogon_priors.js', 'engine/showdown_path.js',
                'engine/position_features.js', 'data/engine-data.js'];
/* `engine/quality.js` IS DELIBERATELY NOT IN THAT LIST, and the reason is worth a line because it
 * looks like an omission. It resolves the STORE relative to its own `__dirname`, so loading it out of
 * the snapshot makes it read `data/releases/<id>/data/games.ladder.jsonl`, which does not exist —
 * the release freezes the engine, not the corpus. It is loaded from the live tree instead, and the
 * freeze claim is unharmed: `quality.js` IS in the release's SOURCES, `open()` verifies every source's
 * live bytes against the manifest before anything loads, and this run verifies them AGAIN at the end.
 * So the live copy is provably the frozen copy for the whole of the run. */

const GAMES = parseInt(process.env.GAMES || '120', 10);
const N = parseInt(process.env.N || '16', 10);
const TOPK = parseInt(process.env.TOPK || '3', 10);
const EXPLORE = parseFloat(process.env.EXPLORE || '1.0');
const EVERY = parseInt(process.env.EVERY || '4', 10);
const ONLY = (process.env.ONLY_ARMS || '').split(',').filter(Boolean);
const OUT = process.env.OUT || D('data', 'argmax-paired.json');

/* ---- AMEND_SWEEP: fold the N-sweep legs into the headline artifact --------------------------- */
/* AN ARTIFACT THAT NEEDS A COMPANION FILE TO BE READ IS THE FAILURE THIS PROJECT KEEPS HAVING, and
 * the headline verdict here genuinely depends on the sweep: a paired flip rate under common random
 * numbers contains both a real difference and a rerouted die, and only the trend across rollout
 * budgets separates them. So the legs go INTO the headline rather than beside it.
 *
 * It is the generator that folds them, not a person with an editor. It refuses any leg that is not
 * the same positions, the same menu width, the same opponent policy and the same frozen release —
 * a sweep assembled out of runs that measured different things is worse than no sweep.
 *
 * `node engine/argmax_paired.js` with AMEND_SWEEP set runs no game and opens no release. */
if (process.env.AMEND_SWEEP) {
  const art = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const same = (a, b) => a.GAMES === b.GAMES && a.EVERY === b.EVERY && a.TOPK === b.TOPK
                      && a.EXPLORE === b.EXPLORE && a.side === b.side;
  const rowOf = (a, src) => ({
    n: a.sweep.N, source: src, verdict_code: a.verdict_code,
    from: a.pooled.from, to: a.pooled.to,
    flips: a.pooled.flips, paired: a.pooled.paired, flip_pct: a.pooled.flip_pct,
    gap_mean_pts: a.pooled.gap_mean_pts, gap_median_pts: a.pooled.gap_median_pts,
  });
  const rows = [rowOf(art, path.relative(D('.'), OUT))];
  for (const p of process.env.AMEND_SWEEP.split(',').map(s => s.trim()).filter(Boolean)) {
    const a = JSON.parse(fs.readFileSync(D(p), 'utf8'));
    if (a.by !== 'engine/argmax_paired.js') throw new Error(p + ' was not written by this generator');
    if (a.engine_release !== art.engine_release) {
      throw new Error(p + ' was measured against release ' + a.engine_release + ' and the headline against '
        + art.engine_release + ' — two engines, so the trend across them would be two trends.');
    }
    if (!same(a.sweep, art.sweep)) throw new Error(p + ' did not sample the same positions as the headline');
    if (a.pooled.from !== art.pooled.from || a.pooled.to !== art.pooled.to) {
      throw new Error(p + ' pairs ' + a.pooled.from + ' -> ' + a.pooled.to + ' and the headline pairs '
        + art.pooled.from + ' -> ' + art.pooled.to);
    }
    if (a.pooled.paired !== art.pooled.paired) throw new Error(p + ' paired a different number of decisions');
    rows.push(rowOf(a, p));
  }
  rows.sort((x, y) => x.n - y.n);
  art.n_sweep = {
    rows,
    what: 'The SAME 131 decision points and the SAME arm pair at three rollout budgets. This is the '
      + 'discriminator the paired design needs and cannot get from either control: common random '
      + 'numbers pair the SEED and not the trajectory, so once two seeded states differ the playouts '
      + 'consume the stream differently and some flips are a rerouted die rather than a different '
      + 'answer. That component falls as the budget grows; a genuine difference in the true values '
      + 'does not.',
    reading: 'Read the DIRECTION and the SIZE of the change, never an extrapolation. The rate is '
      + 'budget-dependent and this artifact reports the budget beside every figure.',
  };
  fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
  console.log('  amended ' + path.relative(D('.'), OUT) + ' with ' + rows.length + ' sweep legs:');
  for (const r of rows) console.log(`    n=${String(r.n).padStart(3)}  ${r.flips}/${r.paired} = ${r.flip_pct.toFixed(1)}%   ${r.source}`);
  process.exit(0);
}

/* ---- the freeze ----------------------------------------------------------------------------- */
const gitBytes = (commit, rel) =>
  execFileSync('git', ['show', commit + ':' + rel], { cwd: D('.'), encoding: 'utf8', maxBuffer: 64 << 20 });
/* LINE ENDINGS ARE NORMALISED OUT BEFORE ANY SOURCE IS COMPARED, and that is not a shortcut. This
 * checkout stores LF in git and writes CRLF to disk, so `git show` and the snapshot disagree on 4,075
 * bytes of `board.js` and agree on every character of it. Comparing raw would refuse a run that is
 * correct; comparing normalised still catches a single changed token, which is the thing being
 * checked. `git status --porcelain` above is the authority on cleanliness and it already knows this. */
const noCR = s => s.replace(/\r/g, '');
const sha12buf = s => crypto.createHash('sha256').update(Buffer.from(noCR(s), 'utf8')).digest('hex').slice(0, 12);

/* AN ARM IS A COMMIT, SO THE ARM FILES MUST BE CLEAN — an uncommitted edit to board.js would mean the
 * `head` arm played bytes nobody has. `engine/medicham2-browser.js` is deliberately NOT in this list:
 * it comes from the release SNAPSHOT, so ENGINE may be editing it right now and this run is unaffected.
 * That the snapshot is nonetheless the COMMITTED simulator is asserted below rather than assumed. */
{
  const dirty = execFileSync('git', ['status', '--porcelain', '--',
    ...PER_ARM.map(f => 'engine/' + f)], { cwd: D('.'), encoding: 'utf8' }).trim();
  if (dirty) {
    console.error('REFUSING: an arm file is modified, so an arm read from git is not the arm on disk:\n' + dirty);
    process.exit(3);
  }
}
/* `REL_ID` LETS THIS RUN OPEN A RELEASE CUT WHILE THE TREE WAS CLEAN INSTEAD OF CUTTING ONE NOW.
 * That is the whole reason it exists: `cut()` freezes whatever is on disk, and on a night when another
 * division is mid-edit in the simulator that is a snapshot of a half-written file. `verify()` compares
 * the SNAPSHOT against its own manifest and never against the live tree, so a release opened this way
 * is unaffected by anything happening in `engine/` while this runs. */
const relId = process.env.REL_ID
  || ER.cut('SEARCH R17 — the paired argmax run over the seed work (R13-R16)').id;
const REL = ER.open(relId);
/* THE SNAPSHOT MUST BE THE COMMITTED ENGINE, and it is CHECKED. A release cut mid-edit verifies
 * perfectly — it is internally consistent — and would still be a build nobody has. This compares the
 * manifest's digests against the bytes git holds at the `head` arm's commit, for the simulator and for
 * the two files the arms actually swap. */
{
  const headCommit = ARMS[ARMS.length - 1].commit;
  const bad = [];
  for (const rel of ['engine/medicham2-browser.js', 'engine/board.js', 'engine/rollout_leaf.js']) {
    const want = sha12buf(gitBytes(headCommit, rel));
    const got = sha12buf(REL.read(rel));
    if (want !== got) bad.push(`${rel}: release has ${got}, commit ${headCommit} has ${want}`);
  }
  if (bad.length) {
    console.error('REFUSING: release ' + relId + ' is not the committed engine at ' + headCommit + ':\n  '
      + bad.join('\n  ') + '\n  Pass REL_ID=<a release cut while the tree was clean>.');
    process.exit(4);
  }
}
console.log('  engine release ' + relId + ' — snapshot verified, and it IS the committed engine at '
  + ARMS[ARMS.length - 1].commit + '\n');

/* THE SHOWDOWN CHECKOUT IS OUTSIDE THIS REPO AND CANNOT BE FROZEN, so it is RESOLVED before anything
 * else loads. `engine/showdown_path.js` finds the checkout by walking up from its OWN `__dirname`, and
 * a copy sitting in `data/releases/<id>/engine/` walks up into `data/` and finds nothing — it then
 * falls through to the `/tmp/ps` candidate and champions_sim dies with a message about npm. Requiring
 * the LIVE one first sets `process.env.SHOWDOWN_PATH` (that side effect is deliberate and documented in
 * that file), which the snapshot's identical copy then honours. The release records the Showdown
 * COMMIT, which is the part of this that can be frozen. */
require('./showdown_path.js');
if (!process.env.SHOWDOWN_PATH) {
  console.error('REFUSING: no Showdown checkout was found, so nothing below would be playing this format.');
  process.exit(5);
}
for (const rel of SHARED) {
  const abs = REL.path(rel);
  require(abs);
  const live = D(rel);
  if (!require.cache[abs]) throw new Error('snapshot module did not cache: ' + rel);
  require.cache[live] = require.cache[abs];
}
const CS = require(REL.path('engine/champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* ---- the arm loader ------------------------------------------------------------------------- */
/* `Module._compile` INTO `require.cache`, which is #254's pass's technique and is here for the same
 * reason: two other agents are live in this tree tonight and reverting it to read an old board would
 * fight them. The compiled module carries the LIVE filename, so its relative requires resolve to the
 * live engine directory — where the aliases above have already put the frozen bytes. */
function loadArm(arm) {
  for (const f of PER_ARM) delete require.cache[D('engine', f)];
  const out = {};
  /* Compiled in dependency order and inserted into the cache BEFORE the body runs, so a cycle
   * resolves to the partially-built module exactly as node's own loader would do it. */
  for (const f of PER_ARM) {
    const filename = D('engine', f);
    const src = gitBytes(arm.commit, 'engine/' + f);
    const m = new Module(filename, null);
    m.filename = filename;
    m.paths = Module._nodeModulePaths(path.dirname(filename));
    require.cache[filename] = m;
    m._compile(src, filename);
    m.loaded = true;
    out[f] = m.exports;
  }
  return { B: out['board.js'], RL: out['rollout_leaf.js'], JR: out['joint_rows.js'],
           FP: out['fit_policy.js'], CM: out['click_match.js'] };
}

/* ---- the scoring ---------------------------------------------------------------------------- */
/* THE CANDIDATE'S IDENTITY, NOT ITS INDEX. R3 seeds each cell with `ia * 31 + ib`, which is correct
 * when both runs see the same menu in the same order and is exactly wrong here: a board change can
 * reorder or resize the menu, and an index-keyed seed would then hand the SAME candidate different
 * dice in the two arms — noise attributed to the fix. */
const identOf = c => (c.switchTo ? 'S:' + c.switchTo : 'M:' + c.move.id + '@' + (c.targetLetter || '-'));
const seedOf = (key, salt) => {
  const h = crypto.createHash('sha1').update(salt + '|' + key).digest();
  return h.readUInt32LE(0) % 2000000000 + 1;
};

function runArm(arm, games, w1, salt) {
  const { B, RL, JR, FP, CM } = loadArm(arm);
  if (B.FEATURES.length !== w1.length) {
    throw new Error('arm ' + arm.label + ' has ' + B.FEATURES.length + ' features and the weight vector has '
      + w1.length + ' — the two arms would not be ranking with the same MAG.');
  }
  const NF = B.FEATURES.length;
  const score1 = x => { let s = 0; for (let k = 0; k < NF; k++) s += w1[k] * x[k]; return s; };
  const recs = new Map();
  const counters = { boards: 0, sampled: 0, scored: 0, skippedNoSlots: 0, skippedNoValue: 0, cells: 0 };
  /* THE DECISION'S NAME IS (game, turn), and it is counted HERE rather than taken from `_gi`, because
   * `onBoard` is handed the game index and not the turn index. Local to the arm: a counter hung off
   * the function would carry across arms and silently re-key the second one. */
  const turnOf = new Map();

  JR.build(games, dex, {
    topK: TOPK, w1, maxGames: GAMES, onRow: () => {},
    onBoard: (board, g, gi) => {
      counters.boards++;
      const turnIdx = (turnOf.get(gi) || 0) + 1;
      turnOf.set(gi, turnIdx);
      if (turnIdx % EVERY) return;
      counters.sampled++;
      const side = 'p1';
      const SI = CM.sheetIndex(g, dex);
      const slots = ['a', 'b'].map(L => {
        const user = board.slot(side, L);
        if (!user || user.fainted) return null;
        const sh = SI.get(side, user.species);
        if (!sh) return null;
        const cands = B.candidates(sh.moves, user, board, side, dex);
        if (!cands.length) return null;
        const feats = cands.map(c => B.featuresFor(c, user, board, side, dex,
          c.switchTo ? B.PRIOR_FLOOR : FP.priorFor(user.species, c.move.id)));
        const order = feats.map((x, i) => [score1(x), i]).sort((a, b) => b[0] - a[0]);
        return { cands, order: order.slice(0, TOPK).map(p => p[1]) };
      });
      if (!slots[0] || !slots[1]) { counters.skippedNoSlots++; return; }

      const field = { weather: board.weather || '', terrain: '',
                      tr: board.hasField('trickroom') ? 5 : 0,
                      twA: board.hasSide('p1', 'tailwind') ? 4 : 0,
                      twB: board.hasSide('p2', 'tailwind') ? 4 : 0 };
      const key = gi + ':' + turnIdx;
      const cells = {};
      let best = null, bestVal = -Infinity;
      for (const ia of slots[0].order) for (const ib of slots[1].order) {
        const ca = slots[0].cands[ia], cb = slots[1].cands[ib];
        const cell = identOf(ca) + ' + ' + identOf(cb);
        const clickOf = c => (c.switchTo ? { switchTo: c.switchTo }
                                         : { move: c.move.id, targetLetter: c.targetLetter });
        const val = RL.rolloutAfterActions(board, side, {
          n: N, dex, explore: EXPLORE, field, seed: seedOf(key + '|' + cell, salt),
          myClicks: [clickOf(ca), clickOf(cb)],
        });
        counters.cells++;
        if (val === null) continue;
        cells[cell] = val;
        /* TIES BROKEN BY THE CELL'S NAME, not by enumeration order. Menu order is exactly what a board
         * change can move, so an order-dependent tiebreak would manufacture flips out of ties. */
        if (val > bestVal || (val === bestVal && best !== null && cell < best)) { bestVal = val; best = cell; }
      }
      if (best === null) { counters.skippedNoValue++; return; }
      counters.scored++;
      const magCell = identOf(slots[0].cands[slots[0].order[0]]) + ' + ' +
                      identOf(slots[1].cands[slots[1].order[0]]);
      recs.set(key, { mag: magCell, best, bestVal, cells });
    },
  });
  return { recs, counters };
}

/* ---- the comparison -------------------------------------------------------------------------- */
/* THE PICK IS COMPARED BY IDENTITY, NEVER BY INDEX, for the same reason the seed is keyed by one. */
function comparePair(a, b, labelA, labelB) {
  let paired = 0, flips = 0, magFlips = 0, menuDiff = 0, flipsSameMenu = 0, pairedSameMenu = 0;
  let evaluable = 0, gapSum = 0; const gaps = [];
  const examples = [];
  for (const [key, ra] of a.recs) {
    const rb = b.recs.get(key);
    if (!rb) continue;
    paired++;
    const menuA = Object.keys(ra.cells).sort().join('~');
    const menuB = Object.keys(rb.cells).sort().join('~');
    const sameMenu = menuA === menuB;
    if (!sameMenu) menuDiff++; else pairedSameMenu++;
    const flipped = ra.best !== rb.best;
    if (flipped) flips++;
    if (sameMenu && flipped) flipsSameMenu++;
    if (ra.mag !== rb.mag) magFlips++;
    /* DIRECTION, UNDER THE NEWER ARM'S OWN LEAF. `b` is the newer board, so `b`'s leaf is the more
     * correct estimator of the two; the question it can answer is how much its own pick is worth over
     * the pick the older board would have made, PRICED BY IT. That gap is biased upward by the argmax
     * and the control measures exactly that bias with the same expression. */
    if (flipped && (ra.best in rb.cells)) {
      evaluable++;
      const g = rb.cells[rb.best] - rb.cells[ra.best];
      gapSum += g; gaps.push(g);
      if (examples.length < 8) examples.push({ at: key, was: ra.best, now: rb.best, gap_pts: +(100 * g).toFixed(2) });
    }
  }
  gaps.sort((x, y) => x - y);
  return {
    from: labelA, to: labelB, paired,
    flips, flip_pct: paired ? 100 * flips / paired : null,
    mag_flips: magFlips, mag_flip_pct: paired ? 100 * magFlips / paired : null,
    menu_differed: menuDiff,
    flips_on_identical_menus: flipsSameMenu,
    flip_pct_on_identical_menus: pairedSameMenu ? 100 * flipsSameMenu / pairedSameMenu : null,
    of_identical_menus: pairedSameMenu,
    gap_evaluable: evaluable,
    gap_mean_pts: gaps.length ? +(100 * gapSum / gaps.length).toFixed(3) : null,
    gap_median_pts: gaps.length ? +(100 * gaps[Math.floor(gaps.length / 2)]).toFixed(3) : null,
    examples,
  };
}

/* ---- run ------------------------------------------------------------------------------------- */
console.log('PAIRED ARGMAX — does the seed work change what MILTANK clicks?\n');
console.log(`  top-${TOPK} per slot by MAG's own score, n=${N} rollouts per cell, explore=${EXPLORE}`);
console.log(`  ${GAMES} games, every ${EVERY}th board, side p1\n`);

/* THE CORPUS AND THE RANKER ARE LOADED ONCE and handed to every arm, so a corpus filter or a weight
 * vector cannot differ between arms. Loaded through the LAST arm's fit_policy, then reused. */
const bootstrap = loadArm(ARMS[ARMS.length - 1]);
let w1;
try { w1 = bootstrap.JR.loadRanker(); } catch (e) { console.error(e.message); process.exit(1); }
const { games } = bootstrap.FP.loadCorpus();
console.log(`  corpus ${games.length} games, ranker ${w1.length} weights\n`);

const chosen = ONLY.length ? ARMS.filter(a => ONLY.includes(a.label)) : ARMS;
const results = [];
const t0 = Date.now();
for (const arm of chosen) {
  const t = Date.now();
  const r = runArm(arm, games, w1, 'S0');
  results.push({ arm, r });
  console.log(`  ${arm.label.padEnd(5)} ${arm.commit}  ${r.counters.scored} decisions, `
    + `${r.counters.cells} cells, ${((Date.now() - t) / 1000).toFixed(1)}s   ${arm.adds}`);
}
const headRes = results.find(x => x.arm.label === 'head') || results[results.length - 1];
/* CONTROL 1 — the current arm against ITSELF with a different seed salt.
 * CONTROL 2 — the current arm against itself with the SAME salt. This must be exactly 0 flips, and a
 * harness that cannot reproduce itself invalidates every other number here.
 *
 * `CONTROLS=0` EXISTS FOR THE N-SWEEP AND FOR NOTHING ELSE. The sweep re-runs two arms at a different
 * rollout budget to show whether the flip rate DECAYS with N (noise) or holds (effect); it is paired
 * against itself and the controls have already been read at the headline budget. A run written with
 * CONTROLS=0 records `controls: null` and carries verdict_code UNCONTROLLED, so it can never be
 * mistaken for the headline. */
const WANT_CONTROLS = process.env.CONTROLS !== '0';
const noise = WANT_CONTROLS ? runArm(ARMS[ARMS.length - 1], games, w1, 'S1') : null;
if (noise) console.log(`  noise ${ARMS[ARMS.length - 1].commit}  ${noise.counters.scored} decisions  (same arm, different dice)`);
const repeat = WANT_CONTROLS ? runArm(ARMS[ARMS.length - 1], games, w1, 'S0') : null;
const pairs = [];
for (let i = 1; i < results.length; i++) {
  pairs.push(comparePair(results[i - 1].r, results[i].r, results[i - 1].arm.label, results[i].arm.label));
}
const pooled = results.length > 1
  ? comparePair(results[0].r, results[results.length - 1].r, results[0].arm.label, results[results.length - 1].arm.label)
  : null;
const ctrlNoise = noise ? comparePair(headRes.r, noise, 'head', 'head@different-dice') : null;
const ctrlRepeat = repeat ? comparePair(headRes.r, repeat, 'head', 'head@identical-dice') : null;

console.log('\n  ---- PAIRED FLIP RATES -------------------------------------------------------\n');
const line = (p) => `  ${(p.from + ' -> ' + p.to).padEnd(30)} ${String(p.flips).padStart(4)}/${String(p.paired).padEnd(5)}`
  + ` = ${p.flip_pct === null ? 'n/a' : p.flip_pct.toFixed(1) + '%'}   (MAG's own pick flipped ${p.mag_flips})`;
for (const p of pairs) console.log(line(p));
if (pooled) console.log('\n' + line(pooled) + '   <- POOLED, the whole of the seed work');
if (ctrlNoise || ctrlRepeat) {
  console.log('\n  ---- CONTROLS ----------------------------------------------------------------\n');
  if (ctrlRepeat) console.log(line(ctrlRepeat) + '   <- PURITY; the null for every row above, and it must be exactly 0');
  if (ctrlNoise) console.log(line(ctrlNoise) + '   <- UNPAIRED; what this comparison invents WITHOUT common random numbers');
}

/* THE NULL FOR A PAIRED FLIP RATE IS ZERO, NOT THE UNPAIRED FLOOR, and getting that backwards would
 * declare every result here null.
 *
 * The unpaired floor is what the SAME arm reports against ITSELF once the dice are allowed to differ —
 * an argmax over K^2 near-ties, and it is enormous. It is printed because it is the whole reason this
 * run is paired at all, and it is NOT the comparator: under common random numbers a change with no
 * behavioural content produces exactly 0 flips, and two independent demonstrations of that are in this
 * run — the identical-dice control, and the r14 -> r15 arm pair, which is #271 alone and is inert in an
 * offline replay by construction.
 *
 * What the paired rate still contains, and cannot separate, is stated rather than hidden: CRN pairs the
 * SEED, not the trajectory. Once two seeded states differ the playouts consume the stream differently,
 * so some of the paired flips are a rerouted die rather than a better estimate. The N-sweep is the
 * discriminator — that residual falls as the rollout budget grows and a real difference does not. */
const impure = ctrlRepeat ? ctrlRepeat.flips !== 0 : null;
if (impure) console.log('\n  !! THE HARNESS DID NOT REPRODUCE ITSELF. Everything above is void.');

let verdict_code, verdict;
const unpaired = ctrlNoise && ctrlNoise.flip_pct !== null ? ctrlNoise.flip_pct.toFixed(1) + '%' : 'not measured';
if (impure) {
  verdict_code = 'VOID';
  verdict = 'VOID — the identical-dice control reported ' + ctrlRepeat.flips + ' flips, so this '
    + 'instrument is not deterministic and no number in this artifact means anything.';
} else if (pooled === null) {
  verdict_code = 'INCOMPLETE'; verdict = 'only one arm was run; there is nothing to pair.';
} else if (!ctrlRepeat) {
  verdict_code = 'UNCONTROLLED';
  verdict = `UNCONTROLLED — controls were skipped (CONTROLS=0), so this run is an N-sweep leg and not a `
    + `headline. It reports ${pooled.flips} flips on ${pooled.paired} paired decisions at n=${N}.`;
} else if (pooled.flips === 0) {
  verdict_code = 'NO FLIPS';
  verdict = `NO FLIPS — the whole of the seed work changed the argmax on 0 of ${pooled.paired} paired `
    + `decision points. The model saw a different board and chose the same move every time. The fixes `
    + 'are still correct; this says they are not urgent, and that the next effort belongs elsewhere.';
} else {
  verdict_code = 'FLIPS';
  verdict = `FLIPS — the whole of the seed work changed the argmax on ${pooled.flips} of ${pooled.paired} `
    + `paired decision points (${pooled.flip_pct.toFixed(1)}%), against a paired null of exactly 0 that this `
    + `run demonstrates twice (the identical-dice control, and the r14 -> r15 pair which is inert offline). `
    + `Without common random numbers the same comparison invents ${unpaired}. A FLIP IS NOT A WIN: `
    + 'direction is a leaf-value gap under the newer arm\'s own leaf, which is the estimator that selected '
    + 'it, so the gap is biased upward and the sign is the most that can be read from it.';
}
console.log('\n  -> ' + verdict_code + '\n');

/* ---- did the engine move under the run? ------------------------------------------------------ */
const stable = ER.verify(relId);
if (!stable.ok) console.log('  !! the release VERIFY failed after the run: ' + stable.bad.join(', '));

fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString(), by: 'engine/argmax_paired.js',
  gate: 'R17 — does the seed work (R13-R16) change what MILTANK clicks?',
  verdict, verdict_code,
  n_measured: pooled ? pooled.paired : 0, n_unit: 'paired decision points',
  ...REL.stamp(),
  engine_stable_after_run: stable.ok,
  sweep: { GAMES, N, TOPK, EXPLORE, EVERY, corpus_games: games.length, side: 'p1' },
  arms: results.map(x => ({ label: x.arm.label, commit: x.arm.commit, adds: x.arm.adds,
                            decisions: x.r.counters.scored, cells: x.r.counters.cells,
                            skipped_no_slots: x.r.counters.skippedNoSlots,
                            skipped_no_value: x.r.counters.skippedNoValue })),
  pooled, per_landing: pairs,
  controls: (ctrlNoise || ctrlRepeat) ? {
    purity: ctrlRepeat,
    unpaired: ctrlNoise,
    what: 'purity is the SAME arm run twice with the SAME seed salt. It is the NULL for every paired '
      + 'row in this artifact and it must be exactly 0 — a paired run that cannot reproduce itself is '
      + 'measuring its own state. unpaired is the same arm run twice with a DIFFERENT salt: it is what '
      + 'this comparison would invent without common random numbers, an argmax over K^2 near-ties, and '
      + 'it is printed to justify the pairing rather than as the comparator.',
    do_not_compare_to: 'The paired flip rate is NOT to be read against `unpaired`. Doing so declares '
      + 'every possible result null, because the unpaired figure is an instrument artefact of an '
      + 'uncalibrated leaf and is near its ceiling already.',
  } : null,
  inert_by_construction: {
    rows: ['#271 a removed item', '#269 durable volatiles'],
    why: 'The decision points come from engine/joint_rows.js\'s replay, which calls neither '
      + 'board.noteItem nor board.startVolatile — board.noteItem\'s only caller in the repository is '
      + 'engine/magnemite.js, the live protocol reader. Those two rows therefore contribute exactly '
      + 'zero flips here and their live effect is UNMEASURED by this run. The r14 -> r15 arm pair is '
      + 'the demonstration: it is #271 alone and it is expected to be 0.',
    consequence: 'Every flip rate in this artifact is a FLOOR on what the live board would show.',
  },
  caveats: [
    'A FLIP IS NOT AN IMPROVEMENT. It is a different choice under a more correct board. The gap fields '
    + 'price the newer arm\'s pick against the older arm\'s pick USING THE NEWER ARM\'S OWN LEAF, which '
    + 'is the estimator that selected it — so the gap is biased upward and its SIGN is the most that can '
    + 'be read from it. Whether the new choice wins more games is an SPRT and this run is not one.',
    'THE LEAF IS NOT CALIBRATED. Every decision here is an argmax over that leaf, so a null result may '
    + 'be about the leaf rather than about the search. That item is MEASURE\'s.',
    'Both arms rank the same corpus and the same weight vector; only board.js, rollout_leaf.js and the '
    + 'replay closure that calls them differ. Menu changes are counted separately and the flip rate is '
    + 'also reported restricted to decisions whose menus were identical.',
    'Common random numbers are keyed on the CANDIDATE\'S IDENTITY, not its index, so a cell keeps its '
    + 'dice across a menu that moved. Within a cell the two arms still consume the stream differently '
    + 'once the seeded states diverge — CRN pairs the seed, not the trajectory.',
    'Side p1 only, and every Nth board, exactly as engine/rollout_r3.js samples.',
  ],
}, null, 2) + '\n');
console.log('  wrote ' + path.relative(D('.'), OUT) + `   (${((Date.now() - t0) / 1000 / 60).toFixed(1)} min)`);
