/* solver/chomp/v2/prereg.js — CHOMP v2's PRE-REGISTRATION, written BEFORE any v2 row is built, any v2 scorer is fitted
 * and any TEST row is scored by a v2 model.
 *
 *   node solver/chomp/v2/prereg.js --v1-rows <v1 rows.jsonl>
 *   -> solver/chomp/v2/preregistration.json   (tracked)
 *
 * It refuses to overwrite an existing preregistration.json: a pre-registration is written once.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(__dirname, 'preregistration.json');
if (fs.existsSync(OUT) && !argv.includes('--force-dev')) { console.error('prereg: ' + OUT + ' exists; a pre-registration is written once'); process.exit(2); }
const shaFile = f => { const h = crypto.createHash('sha256'); const fd = fs.openSync(f, 'r'), b = Buffer.alloc(1 << 22); let n; while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(b.subarray(0, n)); fs.closeSync(fd); return h.digest('hex'); };
const V1 = path.join(__dirname, '..', 'v1');
const v1rows = flag('--v1-rows');
if (!v1rows) throw new Error('prereg: --v1-rows is required');
const v1pre = JSON.parse(fs.readFileSync(path.join(V1, 'preregistration.json'), 'utf8'));
const F = require('./features.js');

const P = {
  what: 'CHOMP v2 pre-registration (solver/chomp/v2/prereg.js). Written before any v2 row is built, any v2 scorer is fitted and any TEST row is scored by a v2 model.',
  written: new Date().toISOString(),
  engine_release: 'eaa5becc54eb',
  brief: 'Will, 2026-09-29 (memory chomp-next-evs-and-field): CHOMP should consider stat spreads and field effects.',
  data: {
    rule: 'THE SAME DATA AND SPLITS AS v1, row for row. solver/chomp/v2/build_rows.js walks v1\'s three sources in v1\'s order (targeted games, the p2v1-c0 corpus, human games) and must reproduce every v1 row: the same src, split, pair, y, a, b, species ids, and v1\'s 22 features recomputed on the flat spread and the neutral field equal to v1\'s rows file to its 4-decimal rounding. Any mismatch throws; no row is dropped or added.',
    v1_rows: { file: v1rows.split(path.sep).join('/'), sha256: shaFile(v1rows) },
    team_store: v1pre.inputs.team_store,
    human_dataset: v1pre.inputs.human_dataset,
    selfplay_corpus: v1pre.inputs.selfplay_corpus,
    counts_expected: JSON.parse(fs.readFileSync(path.join(V1, 'model', 'chomp1.metrics.json'), 'utf8')).counts,
    caveat: 'The targeted games (T1) and the self-play corpus (T2) were PLAYED at the engine table\'s stat line for each species (solver/arena/teams.js buildBody), not at any set spread, and on whatever field the bots set in play. Facts at a set spread therefore describe bodies those games did not field; only the human games (T3) were played at real (unrecorded) spreads. The field block describes what the players could put up, which the simulated games do model.',
  },
  spread: {
    rule: 'solver/rotom/spreads.js, inherited unchanged (observed Reg M-C spread if a Smogon moveset file exists, else the role rule against the top-meta population), with its two table oracles read from MEDICHAM on the release instead of the Showdown sim, for cost (solver/chomp/v2/spreads.js MediDeriver). Population: the top-meta population of the frozen pool\'s games.bo3.jsonl (solver/rotom/build_top_rotation.js topSides + spreads.population). Observed: none exists on 2026-09-30.',
    agreement_check: 'on a sample of TEST-pair sets, the MediDeriver spread against the Showdown-oracle Deriver: reported (identical spreads, identical Speed SP)',
    applied: 'each body\'s stats = spreadL50(battle-forme base stats, SP, sheet nature); HP = base line + HP SP (solver/chomp/v2/features.js)',
  },
  features: {
    v1: F.V1_NAMES,
    field: F.FIELD_NAMES,
    field_rule: 'setters read from the release\'s tags (weatherSetter, terrainSetter, setsWeather, setsTerrain, reversesSpeed, doublesSideSpeed); every field fact recomputed by MEDICHAM (dmgRange, hitProb, effSpeed, compareTurnOrder) under the field; neutral value where a side cannot set it. No entity named.',
  },
  scorer: {
    family: 'v1\'s: antisymmetric logit = tau_src (s(x,y) - s(y,x) + species bring/lead values); arms lin, mlp (32 tanh); the same optimiser, epochs (40), batch (512), L2 (1e-4), seed (1), vocabulary rule (>= 10 TRAIN appearances)',
    candidates: {
      'flat+field': 'v1\'s 22 at the table stat line + the field block at the table stat line (40 features)',
      'set+field': 'v1\'s 22 at the set spread + the field block at the set spread (40 features)',
    },
    selection: 'the (candidate, arm, epoch) with the lowest VAL log-loss over all VAL rows (targeted + corpus + human), read once',
    ablations_val_only: { 'set': 'v1\'s 22 at the set spread, no field (22)', 'flat': 'v1\'s 22 refit (a check that the pipeline reproduces v1\'s VAL log-loss, 0.65326 for lin)' },
  },
  gate_a: {
    question: 'does v2 predict held-out outcomes better than CHOMP v1 as shipped?',
    baseline: 'CHOMP v1 as shipped: solver/chomp/v1/model/chomp1.json (sha256 7dfc0d81...), evaluated by a NumPy forward pass of its exported weights on v1\'s own features. Before any TEST row is read, that pass must reproduce v1\'s recorded VAL log-loss (chomp1.metrics.json val_ll.scorer.lin) to 1e-4, or the run stops.',
    metric: 'log-loss per row (label = the win, or horizonScore on a capped game), each model at its own source temperature; delta = LL(v2) - LL(v1); 95% CI by a bootstrap over clusters (the pair; 2,000 resamples, seed 1)',
    sets: { T1: 'targeted games on TEST pairs', T2: 'corpus test fold', T3: 'human games, both players TEST (reported, not gated)' },
    pass: 'the CI upper bound of delta on T1 and T2 POOLED is below 0',
    read: 'once',
    red_on_break: 'CHOMP2_BREAK=shuffle shuffles v2\'s TRAIN labels (v1 untouched); gate (a) must FAIL',
  },
  gate_b: 'pre-registered separately, only if gate (a) passes (solver/chomp/v2/preregistration-gate-b.json)',
};
fs.writeFileSync(OUT, JSON.stringify(P, null, 1) + '\n');
console.log('wrote', OUT);
