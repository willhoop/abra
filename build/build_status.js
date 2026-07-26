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
    const beats = p.chomp_align < p.coin &&
                  Array.isArray(p.chomp_align_ci95) && p.chomp_align_ci95[1] < p.coin;
    return {
      status: beats ? 'built' : 'null',
      metric: beats
        ? `beats a coin on held-out brings (${p.chomp_align.toFixed(4)} vs ${p.coin.toFixed(4)})`
        : `does not beat a coin on held-out brings (${p.chomp_align.toFixed(4)} vs ${p.coin.toFixed(4)}, intervals overlap)`,
      why: 'data/chomp-ev.json: proper_score_logloss vs coin, with CI',
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

  /* MEW is infrastructure: it is built once it has produced a validated corpus. */
  mew() {
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
