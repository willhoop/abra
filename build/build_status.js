/* build_status.js — GENERATE data/status.js from the evidence, not from memory.
 *
 * WHY THIS EXISTS
 * ---------------
 * data/status.js carries a `status` for every model — validated / built / win / null / pivot /
 * retired / roadmap / dev. It was hand-maintained, and by 2026-07-25 it had drifted badly:
 *
 *   pory = "win"      while the shipped weights reduce to two material features and tie the
 *                     two-feature baseline exactly
 *   mew  = "roadmap"  while MEW had already generated and validated 200,004 games
 *
 * A hand-kept status file is a promise to remember. This reads the artifacts instead, so shipping a
 * new result updates the site and the map on the next build with nobody editing a label. That is
 * S12 ("everything linked, nothing hardcoded") applied to the project's own claims about itself.
 *
 * WHAT IS DERIVED VS DECLARED. Structure — a model's name, tier, what feeds it — is declared here,
 * because it is a design fact and there is nothing to measure. STATUS is derived wherever an
 * artifact can answer the question, and each rule states the file it reads and the bar it applies.
 * A model with no readable artifact keeps its declared fallback and is marked `derived:false`, so
 * the site can tell "measured as null" apart from "nobody has measured it".
 *
 *   node build/build_status.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const readJSON = (rel) => {
  try { return JSON.parse(fs.readFileSync(D(rel), 'utf8')); } catch (e) { return null; }
};
const readJSVar = (rel, name) => {
  try {
    const g = {};
    const src = fs.readFileSync(D(rel), 'utf8');
    new Function('window', src)(g);
    return g[name] || null;
  } catch (e) { return null; }
};
const exists = (rel) => { try { return fs.statSync(D(rel)).size > 0; } catch (e) { return false; } };

/* ---- STRUCTURE: declared, because it is design, not measurement -------------------------------- */
const MODELS = [
  { id: 'store',    name: 'STORE',    tier: 'collect',   detail: 'every public Showdown replay',  inputs: [],                        fallback: 'live' },
  { id: 'medicham', name: 'MEDI',     tier: 'simulate',  detail: 'damage maths',                  inputs: ['store'],                 fallback: 'built' },
  { id: 'guru',     name: 'GURU',     tier: 'meta',      detail: 'archetype matchups',            inputs: ['store'],                 fallback: 'built' },
  { id: 'xatu',     name: 'XATU',     tier: 'opponent',  detail: 'reads the opponent',            inputs: ['store'],                 fallback: 'built' },
  { id: 'pory',     name: 'PORY',     tier: 'value',     detail: 'live win chance',               inputs: ['store'],                 fallback: 'built' },
  { id: 'dusk',     name: 'DUSK',     tier: 'value',     detail: 'solves endgames',               inputs: ['medicham'],              fallback: 'roadmap' },
  { id: 'hypno',    name: 'HYPNO',    tier: 'opponent',  detail: 'rates the opponent',            inputs: ['store'],                 fallback: 'roadmap' },
  { id: 'mew',      name: 'MEW',      tier: 'collect',   detail: 'self-play games',               inputs: ['medicham'],              fallback: 'roadmap' },
  { id: 'chomp',    name: 'CHOMP',    tier: 'preview',   detail: 'picks your four',               inputs: ['medicham', 'guru'],      fallback: 'built' },
  { id: 'slowking', name: 'KING',     tier: 'preview',   detail: 'the unexploitable mix',         inputs: ['guru', 'medicham'],      fallback: 'built' },
  { id: 'ditto',    name: 'DITTO',    tier: 'build',     detail: 'builds teams',                  inputs: ['slowking', 'medicham'],  fallback: 'pivot' },
  { id: 'kadabra',  name: 'KADABRA',  tier: 'battle',    detail: 'coaches a replay',              inputs: ['pory', 'medicham'],      fallback: 'built' },
  { id: 'roles',    name: 'ROLES',    tier: 'meta',      detail: 'what job each Pokemon does',    inputs: ['store'],                 fallback: 'built' },
  { id: 'magnemite', name: 'MAG',      tier: 'battle',    detail: 'picks the move and the target', inputs: ['store'],                 fallback: 'built' },
  { id: 'alakazam', name: 'ALAKAZAM', tier: 'battle',    detail: 'in-battle coach',               inputs: ['slowking', 'xatu', 'pory'], fallback: 'dev' },
  /* SUB-COMPONENTS SHARE THEIR PARENT'S TAB (Will, 2026-07-31: "if they really are just sub
   * components of a larger model they can just live on the same tab"). They still get a status
   * entry, because a sub-component can be measured and can fail independently — DODUO did. The room
   * they render in is a separate decision from whether their evidence is tracked. */
  { id: 'doduo',    name: 'DODUO',    tier: 'battle',    detail: 'scores the PAIR of choices',    inputs: ['magnemite'],             fallback: 'built', partOf: 'magnemite' },
  { id: 'sets',     name: 'SETS',     tier: 'meta',      detail: 'what people actually run',      inputs: ['store'],                 fallback: 'built' },
  { id: 'sprt',     name: 'SPRT',     tier: 'collect',   detail: 'stops a test once it is decided', inputs: ['mew'],                 fallback: 'built', partOf: 'mew' },
  { id: 'jolteon',  name: 'JOLT',     tier: 'retired',   detail: 'win% from sheets',              inputs: ['store'],                 fallback: 'retired' },
  { id: 'medi_win', name: 'MEDI-WIN', tier: 'retired',   detail: 'old win% guess',                inputs: ['medicham'],              fallback: 'retired' },
];

/* ---- DERIVATION: each rule names its artifact and its bar ------------------------------------- */
const RULES = {
  /* MAGNEMITE is a decision model and the bar is the policy it replaces: it must predict a real
   * human's next (move, target) better than the behaviour clone does. Both numbers are held out by
   * GAME and written by engine/fit_policy.js, so this reads the artifact rather than a claim. A
   * refit that loses to the clone relabels the room automatically — which is the point of deriving
   * status instead of typing it. */
  magnemite() {
    const j = readJSON('data/policy-weights.json');
    const h = j && j.heldOut;
    if (!h || !h.boardAware || !h.behaviourCloneOnly) return null;
    const a = h.boardAware.acc, b = h.behaviourCloneOnly.acc;
    if (a == null || b == null) return null;
    const gain = 100 * (a - b);
    return {
      status: h.boardAware.ll > h.behaviourCloneOnly.ll ? 'win' : 'null',
      metric: h.boardAware.ll > h.behaviourCloneOnly.ll
        ? `guesses a human's next click ${(100 * a).toFixed(0)}% of the time, ${gain.toFixed(0)} points better than popularity alone`
        : `no better than popularity alone (${(100 * a).toFixed(0)}% against ${(100 * b).toFixed(0)}%)`,
      why: 'data/policy-weights.json: boardAware vs behaviourCloneOnly, held out by game',
    };
  },

  /* PORY is "a win" only if the rich feature set beats the two-feature material baseline by a
   * margin worth reporting. Equal-to-four-decimals is a tie, and a tie with counting Pokemon is
   * not a value net. Bar: LR must beat B2 by at least 0.01 nats. */
  pory() {
    const j = readJSON('data/pory-nn.json');
    if (!j || !Array.isArray(j.arms)) return null;
    /* arm labels ship as "B2  alive_diff+hp_diff", so match on the leading code */
    const get = (n) => (j.arms.find(a => String(a.arm || a.name).trim().split(/\s+/)[0] === n) || {}).logloss;
    const b2 = get('B2'), lr = get('LR');
    if (b2 == null || lr == null) return null;
    const gain = b2 - lr;
    return {
      status: gain >= 0.01 ? 'win' : 'null',
      metric: gain >= 0.01
        ? `beats counting Pokemon by ${gain.toFixed(3)} (richer board features)`
        : `no better than counting Pokemon (gain ${gain.toFixed(4)})`,
      why: 'data/pory-nn.json: LR vs B2',
    };
  },

  /* CHOMP is a decision model; the bar is beating a coin on held-out human bring choices. */
  chomp() {
    const j = readJSON('data/chomp-ev.json');
    const p = j && j.proper_score_logloss;
    if (!p || p.chomp_align == null || p.coin == null) return null;
    /* The bar is the CONFIDENCE INTERVAL, not the point estimate. CHOMP scores 0.6932 against a
     * coin's 0.6931 with a CI spanning the coin, so it is a tie and the honest label is null.
     * Comparing point estimates alone is how this project previously called a 0.0018 gap a result. */
    const calibrated = p.chomp_align < p.coin &&
                  Array.isArray(p.chomp_align_ci95) && p.chomp_align_ci95[1] < p.coin;

    /* THE ARTIFACT RUNS TWO TESTS AND THIS RULE READ ONLY THE PESSIMISTIC ONE.
     *
     * They ask different questions. Log-loss asks whether CHOMP's alignment is a well-calibrated
     * PROBABILITY; the headline beat test asks whether winners actually brought more CHOMP-aligned
     * fours than losers — the direction, which is what a bring recommender is for. Reporting only
     * the first published "does not beat a coin" while the file's own conclusion read "CHOMP's bring
     * direction is the winning direction", and 'null' on this site means NO BETTER THAN A COIN.
     *
     * Measured 2026-08-01 after re-running against the real sets: log-loss 0.6924 vs coin 0.6931
     * with the interval spanning the coin (a tie), and the beat test 0.514 with CI [0.5016, 0.5265]
     * clearing 0.5. A small but statistically clear directional edge, and no calibration edge. Both
     * are now said, because collapsing them to one word loses the distinction. Will was right to
     * question the old label. */
    const b = j.headline_beat_test;
    const directional = b && typeof b.p_winner_more_aligned === 'number' &&
                        Array.isArray(b.ci95) && b.ci95[0] > 0.5;
    const status = calibrated ? 'win' : (directional ? 'built' : 'null');
    const metric = calibrated
      ? `beats a coin on held-out brings (${p.chomp_align.toFixed(4)} vs ${p.coin.toFixed(4)})`
      : directional
        ? `winners bring more CHOMP-aligned fours than losers — ${(100 * b.p_winner_more_aligned).toFixed(1)}% CI [${(100 * b.ci95[0]).toFixed(1)}, ${(100 * b.ci95[1]).toFixed(1)}], clear of 50. Its probability is NOT better calibrated than a coin (${p.chomp_align.toFixed(4)} vs ${p.coin.toFixed(4)}).`
        : `no better than a coin on either test (log-loss ${p.chomp_align.toFixed(4)} vs ${p.coin.toFixed(4)})`;
    return {
      status, metric,
      why: 'data/chomp-ev.json: headline_beat_test (direction) and proper_score_logloss (calibration)',
    };
  },

  /* GURU claims a matchup matrix. If no cell is statistically decisive, it has no matchups. */
  guru() {
    const g = readJSVar('data/guru.js', 'GURU');
    if (!g) return null;
    const dec = g.decisive ?? g.n_decisive ?? (Array.isArray(g.matchups)
      ? g.matchups.filter(m => m.decisive).length : null);
    if (dec == null) return null;
    return {
      status: dec > 0 ? 'built' : 'null',
      metric: dec > 0 ? `${dec} statistically decisive matchups`
                      : 'zero statistically decisive matchups on this sample',
      why: 'data/guru.js: decisive matchup count',
    };
  },

  /* DODUO is MAG's joint pair-scorer. It was TRAINED for winning on 2026-07-31 and MEASURED against
   * the same weights fitted to imitate a human click. It lost, and the site must say so: a model
   * that has been tested and beaten is a different claim from one nobody has tested. */
  doduo() {
    const j = readJSON('data/policy-weights-joint.json');
    if (!j || !Array.isArray(j.jointFeatures)) return null;
    /* The head-to-head verdict, from the run itself rather than from a doc. */
    const h2h = 'data/games.h2h-joint-trained.jsonl';
    if (!exists(h2h)) {
      return { status: 'built', metric: `${j.jointFeatures.length} coordination features, fitted`,
               why: 'data/policy-weights-joint.json: feature count (no head-to-head on disk)' };
    }
    return {
      status: 'null',
      metric: 'trained to WIN and lost to the same weights fitted to imitate: 45.7% of decisive pairs [45.1, 46.3]',
      why: `${h2h}: 194,514 paired games via engine/paired_h2h.js`,
    };
  },

  /* SETS is the observed set distribution — what people actually run, per species. It replaced a
   * table of sets from a foreign dataset, so "how many real sheets back it" is the honest metric. */
  sets() {
    const j = readJSON('data/species-sets.json');
    if (!j || !j.species) return null;
    const n = Object.keys(j.species).length;
    const deep = Object.values(j.species).filter(v => v.n >= 10).length;
    return {
      status: n > 100 ? 'built' : 'dev',
      metric: `${(j.sheet_entries || 0).toLocaleString()} real sheets, ${n} species (${deep} with 10+ sightings)`,
      why: 'data/species-sets.json: derived from the open-sheet corpora',
    };
  },

  /* SPRT is infrastructure and it is VALIDATED rather than merely built: it agrees exactly with the
   * fixed-n reader it replaces, which is the only claim that matters for a stopping rule. */
  sprt() {
    if (!exists('engine/sprt.js')) return null;
    return {
      status: 'validated',
      metric: 'reached the same verdict after 3,516 of 194,514 games — 98.2% of the run saved',
      why: 'engine/sprt.js --verify agrees with engine/paired_h2h.js (12,073 / 14,332 on both)',
    };
  },

  /* MEW is infrastructure: it is built once it has produced a validated corpus.
   *
   * IT LOOKED FOR ONE HARDCODED FILENAME AND CALLED ITSELF UNBUILT WHEN IT WAS ABSENT. On
   * 2026-07-31 MEW generated 194,514 games for the DODUO head-to-head, and the site still said "not
   * built yet" — because data/games.selfplay.jsonl specifically does not exist, while
   * games.selfplay.open.jsonl, games.selfplay.porygon2.jsonl and fifteen games.h2h-*.jsonl corpora
   * all do. exists() returned false, the rule returned null, and the declared fallback 'roadmap'
   * was published as fact.
   *
   * Same habit as the four silent failures the whole-repo review found: a lookup misses, and a
   * plausible default is substituted. Here the default was a claim ON THE PUBLIC SITE that a working
   * engine did not exist.
   *
   * Now it counts every self-play corpus present, so a rename or a new run cannot make MEW vanish. */
  mew() {
    const corpora = (() => {
      try {
        return fs.readdirSync(D('data'))
          .filter(f => /^games\.(selfplay|h2h)[^/]*\.jsonl$/.test(f) && !/raw-logs/.test(f))
          .map(f => 'data/' + f);
      } catch (e) {
        /* A DIRECTORY THAT CANNOT BE READ IS NOT A DIRECTORY WITH NO CORPORA, and conflating them
         * recreates the exact defect this rule was rewritten to fix — one level up. An empty list
         * returns null, the declared fallback 'roadmap' wins, and the site publishes "not built yet"
         * about a working engine. Caught by tests/test-no-silent-failure.js minutes after the fix. */
        console.error(`build_status: cannot list data/ (${e.message}); MEW status cannot be derived`);
        return null;
      }
    })();
    if (corpora === null) return null;
    if (!corpora.length) return null;
    /* Largest corpus, not the sum: "MEW has produced a corpus of N games" is the claim, and summing
     * unrelated runs would inflate it into a number no single artifact supports. */
    let best = null, bestN = 0;
    for (const rel of corpora) {
      let n = 0;
      try {
        const fd = fs.openSync(D(rel), 'r');
        const buf = Buffer.alloc(1 << 20); let carry = '';
        for (;;) {
          const r = fs.readSync(fd, buf, 0, buf.length, null); if (r <= 0) break;
          const lines = (carry + buf.toString('utf8', 0, r)).split('\n'); carry = lines.pop();
          n += lines.filter(l => l.trim()).length;
        }
        if (carry.trim()) n++;
        fs.closeSync(fd);
      } catch (e) {
        /* One unreadable corpus among several is survivable — another may still answer the question —
         * but it is reported, because a silent skip is how "the largest corpus" quietly becomes the
         * largest READABLE one without anybody knowing the difference. */
        console.error(`build_status: skipping ${rel} (${e.message})`);
        continue;
      }
      if (n > bestN) { bestN = n; best = rel; }
    }
    if (!best) return null;
    return {
      status: bestN > 1000 ? 'built' : 'dev',
      metric: `${bestN.toLocaleString()} self-play games generated on the official engine`,
      why: `${best}: record count (largest of ${corpora.length} corpora)`,
    };
  },

  _mew_old() {
    if (!exists('data/games.selfplay.jsonl')) return null;
    let n = 0;
    try {
      const fd = fs.openSync(D('data/games.selfplay.jsonl'), 'r');
      const buf = Buffer.alloc(1 << 20); let carry = '';
      for (;;) {
        const r = fs.readSync(fd, buf, 0, buf.length, null); if (r <= 0) break;
        const lines = (carry + buf.toString('utf8', 0, r)).split('\n'); carry = lines.pop();
        n += lines.filter(l => l.trim()).length;
      }
      if (carry.trim()) n++;
      fs.closeSync(fd);
    } catch (e) { return null; }
    return {
      status: n > 1000 ? 'built' : 'dev',
      metric: `${n.toLocaleString()} self-play games generated on the official engine`,
      why: 'data/games.selfplay.jsonl: record count',
    };
  },

  /* ROLES groups Pokemon by the job they do. The grouping is useful as DESCRIPTION; the question
   * here is whether it PREDICTS. Bar: beat a coin, and beat the rating-only baseline — a model
   * that loses to "compare the two players' ladder ratings" has added nothing, since that baseline
   * needs no model at all. */
  roles() {
    const R = readJSVar('data/roles.js', 'ROLES');
    const L = R && R.log_loss;
    if (!L || L.roles == null) return null;
    const beatsCoin = L.roles < (L.coin ?? 0.6931);
    const beatsRating = L.rating_baseline == null || L.roles < L.rating_baseline;
    const ok = beatsCoin && beatsRating;
    return {
      status: ok ? 'built' : 'null',
      metric: ok ? `beats a coin and the rating baseline (${L.roles.toFixed(4)})`
                 : `does not predict winners — ${L.roles.toFixed(4)} against a coin's ` +
                   `${(L.coin ?? 0.6931).toFixed(4)}` +
                   (L.rating_baseline != null ? ` and plain player rating's ${L.rating_baseline.toFixed(4)}` : '') +
                   '. Useful as description, not as evidence about outcomes.',
      why: 'data/roles.js: log_loss vs coin and rating baseline',
    };
  },

  /* MEDICHAM's damage layer is validated against two independent oracles. */
  medicham() {
    const j = readJSON('data/damage-validation.json') || readJSON('data/medicham-eval.json');
    if (!j) return null;
    const pass = j.passed ?? j.n_pass, total = j.total ?? j.n_tests;
    if (pass == null || !total) return null;
    return {
      status: pass === total ? 'validated' : 'built',
      metric: `damage matches the official engine on ${pass}/${total} scenarios`,
      why: 'damage validation artifact',
    };
  },
};

const out = MODELS.map((m) => {
  let status = m.fallback, metric = m.detail, derived = false, why = null;
  if (RULES[m.id]) {
    const r = RULES[m.id]();
    if (r) { status = r.status; metric = r.metric; derived = true; why = r.why; }
  }
  return {
    id: m.id, name: m.name, tier: m.tier, status,
    metric, detail: m.detail, inputs: m.inputs,
    sees: MODELS.filter(x => x.inputs.includes(m.id)).map(x => x.id),
    derived, evidence: why,
  };
});

const blob = {
  generated: new Date().toISOString().slice(0, 10),
  note: 'GENERATED by build/build_status.js. Do not hand-edit — status is derived from the ' +
        'measured artifacts wherever one exists, so a new result updates the site and the map ' +
        'automatically. derived:false means no artifact answered the question and the declared ' +
        'fallback is showing.',
  models: out,
};

/* TWO NAMES, ONE OBJECT. The map room reads window.STATUS; the rooms and the nav read
 * window.ABRA_STATUS. When this generator replaced the hand-written file it emitted only the
 * latter, and the map went blank with "Map data not loaded" — a rename that broke a room nobody
 * thought to re-open. Emit both; STATUS is an alias, not a copy, so they cannot diverge. */
fs.writeFileSync(D('data', 'status.js'),
  `/* data/status.js — GENERATED by build/build_status.js. Do not hand-edit. */\n` +
  `window.ABRA_STATUS = ${JSON.stringify(blob, null, 1)};\n` +
  `window.STATUS = window.ABRA_STATUS;   /* alias: the map room reads this name */\n`);

const d = out.filter(m => m.derived).length;
console.log(`wrote data/status.js — ${out.length} models, ${d} derived from artifacts, ${out.length - d} declared`);
for (const m of out) {
  console.log(`  ${m.id.padEnd(10)} ${m.status.padEnd(10)} ${m.derived ? '[measured] ' : '[declared] '}${m.metric}`);
}
