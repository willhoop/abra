/* feature_engine_contrast.js — DID THE ENGINE MOVE CHANGE THE FEATURE FUNCTION, OR ONLY THE ENGINE?
 *
 *   SHOWDOWN_PATH=... node engine/feature_engine_contrast.js
 *     BUNDLES=live,09acd3b404ef,032b4a2979dd   engine bundles to contrast (release ids, or `live`)
 *     GAMES=0                                  0 = the whole clean open-sheet corpus
 *   ->  data/feature-engine-contrast.json
 *
 * WHY THIS EXISTS
 * ---------------
 * `engine/provenance.js` flags an artifact whose inputs have changed CONTENT since it was read, and
 * it is right to: `data/censoring-value.json` and `data/click-censoring-census.json` were both
 * computed through a `medicham2-browser.js` and a `data/tags.json` that then moved underneath them.
 * The standing answer to that flag is a refit, because CLAUDE.md requires the fitting environment and
 * the playing environment to match — MAG's weights were once fitted with the sheet visible and played
 * without it, and MACHAMP's champion was trained under broken mega.
 *
 * But "the environment matched" is a claim about the FEATURE FUNCTION, and a feature function is a
 * function from a board to a number. Two versions of it are THE SAME FUNCTION if they agree on every
 * board. That is decidable, it is cheap, and it is not the same question as "did the engine change":
 *
 *   engine/feature_fixture.js  asks it on ~50 FROZEN boards, so a weight file can carry the hashes.
 *                              Its own header states the limit: a guard only guards what it exercises.
 *   THIS FILE                  asks it on every board the FIT ACTUALLY USES — 1.75M candidate feature
 *                              vectors over the whole corpus — so a branch that no fixture board
 *                              stands on cannot hide in it.
 *
 * A NULL FROM AN INSTRUMENT THAT CANNOT SEE IS WORTH NOTHING, so every run carries a POSITIVE
 * CONTROL: a predicate that is known to differ between the bundles is evaluated in each of them and
 * the run REFUSES to report agreement unless the control actually disagreed. Without it, a harness
 * that silently loaded the same bytes three times would publish a confident "identical".
 *
 * HOW THE BUNDLE IS SWAPPED, AND WHAT IS DELIBERATELY NOT SWAPPED
 * --------------------------------------------------------------
 * Each bundle runs in its own CHILD PROCESS. `engine/engine_release.js` opens the frozen release and
 * the two files that differ — `medicham2-browser.js` and `tags.js`, the loader that carries
 * `data/tags.json` — are registered in the module cache under their LIVE paths. So `board.js`,
 * `fit_policy.js` and `click_match.js` are the same bytes in every arm and only the simulator and the
 * tag dex move, which is the contrast provenance is asking about.
 *
 * `engine/quality.js` is NOT swapped, deliberately: it resolves the store relative to its own
 * __dirname, so a snapshot copy looks for games.ladder.jsonl inside the release directory and finds
 * nothing. The walk would have had no rows to disagree about — a null for the wrong reason.
 *
 * THE SECOND ARM — the exposure of a KNOWN-INCOMPLETE feature input
 * ----------------------------------------------------------------
 * `engine/board.js:2565` and `engine/position_features.js:231` map their priority defenders to
 * `{ability, fainted}`. medicham2's `isGrounded()` therefore sees no type list and no item, so a
 * Flying-type or Iron-Ball body is treated as grounded IN THE FEATURE VECTOR even though the
 * simulator is correct. Widening that signature moves the feature vector, which is a refit, so the
 * question is how many rows it would move. Every defender is rebuilt twice — once the way board.js
 * does it, once with the types and item the board already holds — and both the guarded count
 * (`cand.targetMon`, the guard board.js actually applies) and the unguarded upper bound are recorded.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const OUT = D('data', 'feature-engine-contrast.json');
const GAMES = +(process.env.GAMES || 0);
const BUNDLES = (process.env.BUNDLES || 'live').split(',').map(s => s.trim()).filter(Boolean);
const sha12 = require('./engine_release.js').sha12;

/* THE TWO FILES THAT ARE ALLOWED TO DIFFER BETWEEN BUNDLES. Injecting more is not safer: every extra
 * module resolves its data files inside the release, and one of them (quality.js) resolves the store. */
const INJECT = ['medicham2-browser.js', 'tags.js'];

/* ---- THE SAMPLE IS PINNED, AND IT IS PINNED BECAUSE THIS FAILED ONCE ---------------------------
 *
 * The first version let every child call `FP.loadCorpus()` for itself. On 2026-08-05 another agent
 * edited `engine/fit_policy.js` between the second bundle and the third, `loadCorpus()` went from
 * 9,361 to 6,055 clean open-sheet games mid-run, and the run reported **all 58 columns moved** —
 * a REFIT verdict manufactured entirely by a corpus that changed underneath a comparison. Nothing
 * crashed. The column hashes really did differ, because they were hashes of different rows.
 *
 * So the parent resolves the game-id list ONCE and every child scores exactly those ids, in that
 * order. A child that cannot find one of them REFUSES rather than scoring a shorter list, because a
 * silently shorter list is the same failure with a smaller number on it. `row_key_hash` stays as the
 * independent witness: the pin makes the sample identical, the hash proves it was.
 *
 * This is CLAUDE.md's photograph rule applied to the one input `engine_release.js` cannot freeze —
 * the store and the loader that reads it are not in the release, and they move hourly. */
const IDS_ENV = 'FEC_IDS_FILE';
function pinned(games) {
  const f = process.env[IDS_ENV];
  if (!f) return GAMES ? games.slice(0, GAMES) : games;
  const want = JSON.parse(fs.readFileSync(f, 'utf8'));
  const have = new Map();
  for (const g of games) if (g && g.id) have.set(g.id, g);
  const out = [], missing = [];
  for (const id of want) { const g = have.get(id); if (g) out.push(g); else missing.push(id); }
  if (missing.length) {
    throw new Error(`the pinned sample moved under this run: ${missing.length} of ${want.length} game ids are `
      + `no longer in fit_policy.loadCorpus() (first: ${missing[0]}). Something changed the store or the `
      + `loader mid-measurement. Re-run against a still tree; do not compare what is left.`);
  }
  return out;
}

function bundlePaths(eng) {
  return eng === 'live'
    ? { medicham2: D('engine', 'medicham2-browser.js'), tags: D('data', 'tags.json') }
    : { medicham2: D('data', 'releases', eng, 'engine', 'medicham2-browser.js'),
        tags: D('data', 'releases', eng, 'data', 'tags.json') };
}

/* ---- worker: one bundle, one process ---------------------------------------------------------- */
function worker(eng) {
  if (eng !== 'live') {
    const REL = require('./engine_release.js').open(eng);
    for (const f of INJECT) {
      const livePath = require.resolve('./' + f);
      const m = require(path.join(REL.dir, 'engine', f));
      require.cache[livePath] = { id: livePath, filename: livePath, loaded: true, exports: m, children: [], paths: [] };
    }
  }
  const M2 = require('./medicham2-browser.js');

  /* ---- POSITIVE CONTROL, taken BEFORE anything else and reported whatever it says.
   * `priorityRefusedAbove` under a Psychic Terrain: WIRE 117 made it ask whether the body is
   * grounded, so a Levitate body reads Infinity on a post-117 engine and 0 on a pre-117 one. A run
   * whose control agrees across bundles has not proved the bundles are the same — it has proved
   * nothing, and says so. */
  const TER = { terrain: 'psychicterrain' };
  const num = v => (v === Infinity ? 'Infinity' : String(v));
  const control = {
    partial_levitate: num(M2.priorityRefusedAbove([{ ability: 'Levitate', fainted: false }], TER)),
    full_flying: num(M2.priorityRefusedAbove([{ ability: 'Flame Body', types: ['Fire', 'Flying'], fainted: false }], TER)),
    plain_body: num(M2.priorityRefusedAbove([{ ability: 'Rough Skin', fainted: false }], TER)),
    no_terrain: num(M2.priorityRefusedAbove([{ ability: 'Rough Skin', fainted: false }], { terrain: '' })),
    exports_isGrounded: typeof M2.isGrounded === 'function',
  };

  /* ---- the WIRE 117 opportunity, counted at board.js's own call site ---- */
  const PR = { calls: 0, under_psychic_terrain: 0, answer_differs_from_pre_wire_117: 0, incomplete_bodies: 0 };
  const orig = M2.priorityRefusedAbove;
  M2.priorityRefusedAbove = function (defenders, field, aimedAt) {
    const now = orig(defenders, field, aimedAt);
    PR.calls++;
    for (const d of (defenders || [])) if (d && !d.types) { PR.incomplete_bodies++; break; }
    if (field && String(field.terrain || '').toLowerCase().indexOf('psychic') === 0) {
      PR.under_psychic_terrain++;
      /* the pre-WIRE-117 rule: the terrain branch never inspected a body, so the bar was 0 outright */
      if (Math.min(orig(defenders, { terrain: '' }, aimedAt), 0) !== now) PR.answer_differs_from_pre_wire_117++;
    }
    return now;
  };

  const B = require('./board.js');
  const FP = require('./fit_policy.js');
  const FEATS = B.FEATURES;
  const { games } = FP.loadCorpus();
  const use = pinned(games);
  const H = FEATS.map(() => crypto.createHash('sha256'));
  const KH = crypto.createHash('sha256');
  const tally = {};
  let rows = 0, errored = 0;
  for (let i = 0; i < use.length; i++) {
    if (i % 500 === 0) process.stderr.write(`\r  ${eng} ${i}/${use.length}`);
    let out;
    try { out = FP.decisionsFor(use[i], tally, null, {}); } catch (e) { errored++; continue; }
    for (const r of out) {
      for (let ci = 0; ci < r.feats.length; ci++) {
        KH.update(`${r.game}|${r.turn}|${r.side}|${r.slot}|${ci}\n`);
        const x = r.feats[ci];
        for (let k = 0; k < FEATS.length; k++) H[k].update(String(Math.round((x[k] || 0) * 1e6) / 1e6) + ',');
        rows++;
      }
    }
  }
  const colHash = {};
  for (let k = 0; k < FEATS.length; k++) colHash[FEATS[k]] = H[k].digest('hex').slice(0, 12);
  const P = bundlePaths(eng);
  process.stdout.write('' + JSON.stringify({
    eng, games: use.length, corpus_total: games.length, rows, games_errored: errored,
    medicham2: sha12(P.medicham2), tags: sha12(P.tags),
    row_key_hash: KH.digest('hex').slice(0, 12), column_hashes: colHash,
    control, priority_calls: PR,
  }));
}

/* ---- second arm: how many rows would a COMPLETE defender body change? -------------------------- */
function groundedExposure() {
  const M2 = require('./medicham2-browser.js');
  const B = require('./board.js');
  const FP = require('./fit_policy.js');
  const CS = require('./champions_sim.js');
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const TERRAINS = ['psychicterrain', 'electricterrain', 'grassyterrain', 'mistyterrain'];
  const C = {
    candidate_vectors: 0, with_priority_move: 0, reaching_board_js_guard: 0,
    under_psychic_terrain: 0, guarded_under_psychic_terrain: 0,
    complete_body_changes_answer: 0, and_reaches_the_guard: 0, by_move: {}, by_body: {},
  };
  const origFF = B.featuresFor;
  B.featuresFor = function (c, user, board, side) {
    try {
      C.candidate_vectors++;
      if (c.switchTo || !c.move) return origFF.apply(this, arguments);
      const terrain = TERRAINS.find(k => board.hasField(k)) || '';
      const field = { terrain };
      if (!(M2.movePriority(c.move.id, field) > 0)) return origFF.apply(this, arguments);
      C.with_priority_move++;
      const guarded = !!c.targetMon;                       /* board.js:2509/:2560 */
      if (guarded) C.reaching_board_js_guard++;
      if (terrain !== 'psychicterrain') return origFF.apply(this, arguments);
      C.under_psychic_terrain++;
      if (guarded) C.guarded_under_psychic_terrain++;
      const foe = side === 'p1' ? 'p2' : 'p1';
      const partial = [], full = [];
      for (const f of board.field()) {
        if (f.side !== foe || !f.mon || f.mon.fainted) continue;
        /* THROUGH board.js's OWN ACCESSORS, not off the raw body. A mega that gains its ability on
         * evolving has a pre-mega `.ability` on the record, and a mega's TYPES are not its base
         * forme's — Charizard-Mega-X is Fire/Dragon. effAbility/effTypes are what board.js:2570 uses,
         * so the partial arm reproduces the shipped feature path exactly and the full arm differs
         * from it in one respect only: it carries the types and the item. */
        partial.push({ ability: B.effAbility(f.mon, dex), fainted: false });
        full.push({ ability: B.effAbility(f.mon, dex), fainted: false, types: B.effTypes(f.mon, dex), item: f.mon.item || '' });
      }
      if (partial.length && M2.priorityRefusedAbove(partial, field) !== M2.priorityRefusedAbove(full, field)) {
        C.complete_body_changes_answer++;
        if (guarded) C.and_reaches_the_guard++;
        C.by_move[c.move.id] = (C.by_move[c.move.id] || 0) + 1;
        for (const d of full) {
          const k = ((d.types || []).join('/') || '?') + (d.item ? '+' + d.item : '');
          C.by_body[k] = (C.by_body[k] || 0) + 1;
        }
      }
    } catch (e) {
      /* IT SPEAKS. A wrapper that swallows its own failure would report "0 rows are exposed" for the
       * reason that it never managed to look, which is the exact failure this whole run is about. */
      C.errors = (C.errors || 0) + 1;
      if (!C.first_error) { C.first_error = String((e && e.message) || e); console.error('  exposure arm: ' + C.first_error); }
    }
    return origFF.apply(this, arguments);
  };
  const { games } = FP.loadCorpus();
  const use = pinned(games);
  const tally = {};
  for (let i = 0; i < use.length; i++) {
    if (i % 500 === 0) process.stderr.write(`\r  exposure ${i}/${use.length}`);
    /* A GAME THAT CANNOT BE WALKED IS COUNTED AND NAMED. Swallowing it would shrink the denominator
     * of an exposure rate without anybody being able to see that it had shrunk. */
    try { FP.decisionsFor(use[i], tally, null, {}); }
    catch (e) {
      C.games_errored = (C.games_errored || 0) + 1;
      if (!C.first_game_error) { C.first_game_error = String((e && e.message) || e); console.error('  exposure arm, first unwalkable game: ' + C.first_game_error); }
    }
  }
  C.games = use.length;
  process.stdout.write('' + JSON.stringify(C));
}

/* ---- parent ------------------------------------------------------------------------------------ */
function runChild(mode, eng) {
  const out = execFileSync(process.execPath, [__filename, '--' + mode, eng || ''], {
    cwd: ROOT, env: process.env, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  });
  const i = out.indexOf('');
  if (i < 0) throw new Error(`${mode} ${eng}: child produced no result payload`);
  return JSON.parse(out.slice(i + 1));
}

function main() {
  console.log('FEATURE / ENGINE CONTRAST — is the new engine the same FEATURE FUNCTION as the old one?\n');

  /* PIN THE SAMPLE BEFORE ANY BUNDLE RUNS. See the note on `pinned` above: an unpinned run reported
   * 58 moved columns on 2026-08-05 because the loader changed between two children. */
  const FP = require('./fit_policy.js');
  const all = FP.loadCorpus().games;
  const sample = (GAMES ? all.slice(0, GAMES) : all).map(g => g && g.id).filter(Boolean);
  if (sample.length < (GAMES ? Math.min(GAMES, all.length) : all.length)) {
    throw new Error(`${all.length - sample.length} corpus games carry no id and cannot be pinned`);
  }
  const idsFile = path.join(require('os').tmpdir(), `fec-ids-${process.pid}.json`);
  fs.writeFileSync(idsFile, JSON.stringify(sample));
  process.env[IDS_ENV] = idsFile;
  console.log(`  sample pinned: ${sample.length.toLocaleString()} game ids, loader ${sha12(D('engine', 'fit_policy.js'))}\n`);

  const arms = BUNDLES.map(b => { console.log(`  bundle ${b}`); return runChild('worker', b); });
  console.log('\n  exposure arm (live tree)');
  const exposure = runChild('exposure');
  console.log('');

  const base = arms[0];
  const FEATS = Object.keys(base.column_hashes);
  const contrasts = arms.slice(1).map(a => {
    const moved = FEATS.filter(f => a.column_hashes[f] !== base.column_hashes[f]);
    return {
      a: base.eng, b: a.eng,
      medicham2: [base.medicham2, a.medicham2], tags: [base.tags, a.tags],
      same_rows: base.row_key_hash === a.row_key_hash,
      columns_that_moved: moved, identical: moved.length === 0 && base.row_key_hash === a.row_key_hash,
    };
  });

  /* THE CONTROL DECIDES WHETHER THE NULL MAY BE REPORTED AT ALL. */
  const ctlKeys = ['partial_levitate', 'full_flying', 'plain_body', 'no_terrain', 'exports_isGrounded'];
  const controlSaw = arms.some(a => ctlKeys.some(k => String(a.control[k]) !== String(base.control[k])));
  const allIdentical = contrasts.length > 0 && contrasts.every(c => c.identical);

  /* ROWS FIRST, ALWAYS. A comparison whose two sides scored different boards has not measured the
   * feature function at all, and reporting MOVED for it would order a refit off a corpus that grew. */
  const rowsMoved = contrasts.filter(c => !c.same_rows);
  const verdict = arms.length < 2
    ? 'ONE BUNDLE ONLY — nothing was contrasted. Pass BUNDLES=live,<release-id>[,...].'
    : rowsMoved.length
      ? 'NOT COMPARABLE — the ROWS differ between bundles (' + rowsMoved.map(c => c.b).join(', ')
        + '), so the column hashes are hashes of different boards and say nothing about the feature '
        + 'function. The store or engine/fit_policy.js moved mid-run. Re-run against a still tree.'
      : !controlSaw
        ? 'NOT A RESULT — the positive control did not separate the bundles, so this run cannot tell '
          + '"the feature function is unchanged" from "the same bytes were loaded twice". Do not quote it.'
        : allIdentical
          ? 'IDENTICAL — every feature column agrees across the bundles on every row of the corpus. The '
            + 'engine changed and the feature function did not, so weights fitted under one of these '
            + 'bundles are being scored under the same function in the others.'
          : 'MOVED — at least one feature column differs on identical rows. This is a REFIT, not a restamp.';

  const SOURCES = ['engine/board.js', 'engine/fit_policy.js', 'engine/click_match.js',
    'engine/click_class.js', 'engine/medicham2-browser.js', 'engine/quality.js',
    'data/tags.json', 'data/engine-data.js', 'data/move-priors.json'];
  const digests = {}; for (const f of SOURCES) digests[f] = sha12(D(f));

    const loader = sha12(D('engine', 'fit_policy.js'));
const art = {
    generated: new Date().toISOString(),
    source: 'engine/feature_engine_contrast.js',
    question: 'Two artifacts were computed through an engine that then changed. Did the change move '
            + 'the FEATURE FUNCTION on the rows those artifacts used, or only the simulator?',
    verdict,
    positive_control: {
      what: 'priorityRefusedAbove under a Psychic Terrain. WIRE 117 made it ask isGrounded(), so a '
          + 'Levitate body reads Infinity after it and 0 before it.',
      separated_the_bundles: controlSaw,
      per_bundle: Object.fromEntries(arms.map(a => [a.eng, a.control])),
      note: 'A null from an instrument that cannot see is worth nothing. If this is false the verdict '
          + 'above refuses to report agreement.',
    },
    bundles: arms.map(a => ({
      eng: a.eng, medicham2: a.medicham2, tags: a.tags, rows: a.rows, games: a.games,
      games_errored: a.games_errored, row_key_hash: a.row_key_hash, priority_calls: a.priority_calls,
    })),
    contrasts,
    sample_pinned: { game_ids: sample.length, loader_at_start: loader,
      note: 'every bundle scored exactly these ids in this order; a child that could not find one refuses' },
    n_measured: base.rows,
    n_unit: 'candidate feature vectors (one per candidate per scored decision)',
    corpus: { clean_games: base.corpus_total, games_scored: base.games,
              note: 'fit_policy.loadCorpus() — clean OPEN-SHEET games (bo3 + ots + ladder), the fit\'s own corpus' },
    grounded_body_exposure: Object.assign({
      what: 'board.js:2565 and position_features.js:231 hand priorityRefusedAbove a {ability, fainted} '
          + 'body, so isGrounded() cannot see types or item and an airborne foe is over-refused in the '
          + 'FEATURE vector. Widening that signature is a refit, so this is its size.',
      guard: 'board.js:2560 only calls it when cand.targetMon exists, so a self-targeted priority move '
           + '(Protect, Rage Powder) never reaches it. Both counts are kept: the unguarded one is an '
           + 'upper bound, the guarded one is the exposure.',
    }, exposure),
    limits: [
      'This measures the columns board.js computes on the OPEN-SHEET fit corpus. engine/position_features.js '
      + 'has its own call site and its own feature set and is NOT measured here.',
      'Identical columns today is a fact about THIS corpus. A metagame that pairs Psychic Surge with '
      + 'Flying bodies moves the exposure without a line of code changing.',
      'Values are rounded to 1e-6 before hashing, the same convention as engine/feature_fixture.js: a '
      + 'feature\'s meaning is not carried by its sixteenth decimal place.',
    ],
    source_digests: digests,
  };
  fs.writeFileSync(OUT, JSON.stringify(art, null, 1) + '\n');
  console.log(verdict);
  for (const c of contrasts) {
    console.log(`  ${c.a} vs ${c.b}: ${c.identical ? 'all ' + FEATS.length + ' columns identical'
      : c.columns_that_moved.length + ' columns moved: ' + c.columns_that_moved.join(', ')}`
      + `  (medicham2 ${c.medicham2[0]} vs ${c.medicham2[1]}, tags ${c.tags[0]} vs ${c.tags[1]})`);
  }
  console.log(`  rows ${base.rows.toLocaleString()} over ${base.games.toLocaleString()} games`);
  console.log(`  grounded-body exposure: ${exposure.and_reaches_the_guard} rows reach board.js's guard and change`
    + ` (upper bound ${exposure.complete_body_changes_answer}, of ${exposure.candidate_vectors.toLocaleString()} candidate vectors)`);
  console.log(`  -> ${path.relative(ROOT, OUT)}`);
}

if (require.main === module) {
  if (process.argv[2] === '--worker') worker(process.argv[3] || 'live');
  else if (process.argv[2] === '--exposure') groundedExposure();
  else main();
}
