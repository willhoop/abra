/* bench_speed_consolidate.js — ONE artifact for the MEDICHAM speed question, derived from every
 * timed run rather than from whichever run happened to be last.
 *
 *   node engine/bench_speed_consolidate.js
 *
 * ================= WHY THIS EXISTS ===============================================================
 *
 * `engine/bench_speed.js` writes one file per run. On 2026-08-28 the published artifact
 * (`data/medicham-speed.json`) therefore held ONE run's numbers while the report quoted the best
 * across several — and the two disagreed by 14% on throughput and in the OPPOSITE DIRECTION on
 * process scaling. That is this repository's signature failure wearing a new hat: an artifact and a
 * document carrying different answers to the same question, with nothing able to notice.
 *
 * The fix is NOT to pick a run. The between-run spread is real and is itself the finding, so the
 * artifact carries a RANGE with every endpoint attributed to the file and the conditions that
 * produced it. A single number here would be a lie whichever run supplied it.
 *
 * NOTHING IS TYPED. Every figure is read out of a run file. The run files are the record and this is
 * an index over them; delete one and this artifact shrinks and says so, which is the correct
 * behaviour for a derived thing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const OUT = D('data', 'medicham-speed.json');

/* PRESERVE THE INCUMBENT BEFORE OVERWRITING IT. It is a real measurement — the BelowNormal leg — and
 * it is the only one carrying an 8- and 12-worker point. It becomes a peer of the other run files
 * rather than being thrown away, and its scaling arm is LABELLED below rather than deleted. */
const LEGACY = D('data', '_bench-belownormal.json');
if (fs.existsSync(OUT) && !fs.existsSync(LEGACY)) {
  const j = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  if (j.by === 'engine/bench_speed.js') {
    fs.writeFileSync(LEGACY, JSON.stringify(j, null, 2) + '\n');
    console.log('  preserved the previous data/medicham-speed.json as data/_bench-belownormal.json');
  }
}

const runs = fs.readdirSync(D('data'))
  .filter(f => /^_bench-.*\.json$/.test(f))
  .map(f => {
    let j;
    try { j = JSON.parse(fs.readFileSync(D('data', f), 'utf8')); }
    catch (e) {
      /* A bench file that will not parse is a RUN DROPPED FROM THE RANGE. Silence here would narrow
       * the published spread by discarding an endpoint, which is the opposite of what a range is for. */
      console.error('bench: skipping unreadable ' + f + ' -- it is NOT in the range below:', e.message);
      return null;
    }
    if (!j || j.by !== 'engine/bench_speed.js') return null;
    const capOrder = Object.keys(j.arms).filter(k => /^playout_cap_/.test(k))
                           .map(k => Number(k.split('_').pop()));
    return { file: 'data/' + f, generated: j.generated, release: j.engine_release,
             team_store: j.team_store_pinned_to, priority: j.priority, reps: j.reps,
             cap_order: capOrder, leaf_n: j.leaf_config && j.leaf_config.n,
             pairs: j.pairs_built, boards: j.boards_built, load_ms: j.load_ms,
             census: j.census, arms: j.arms, scaling: j.arms.scaling || null };
  }).filter(Boolean).sort((a, b) => (a.generated < b.generated ? -1 : 1));

if (!runs.length) { console.error('no data/_bench-*.json run files found'); process.exit(2); }

/* ---- COMPARABILITY. AN ARM ONLY ENTERS A RANGE IF ITS SAMPLE IS BIG ENOUGH TO BE COMPARED.
 *
 * Several runs here are PROBES, not measurements: the scaling runs set `--pairs 8 --per-pair 2`
 * (16 playouts) and the cap-order runs set `--boards 1 --leaf-n 5` (5 playouts), because in those
 * runs the playout or leaf arm was only there to keep the harness happy while a different arm was
 * the point.
 *
 * Pooling them into a range is not conservative, it is WRONG, and it was wrong in a way that looked
 * like a finding: with them in, cap 14 read "40.3 to 193.4 playouts/sec, spread 380%" and the leaf
 * read a 3,696% spread. Every one of those bottom endpoints is a 16-sample arm that never left V8's
 * interpreter. That is the same shape as judging a builder on rows it never wrote.
 *
 * The threshold is on the SAMPLE the arm actually ran, read off the arm, so a future run is admitted
 * or refused by what it measured rather than by a name in a list. Excluded arms are NOT deleted —
 * they are listed in `excluded_arms` with their size, so the filter can be audited. */
const MIN_PLAYOUTS = 1000;
const EXCLUDED = [];

function armSample(a) {
  const f = a && a.fastest;
  if (!f) return 0;
  return typeof f.playouts === 'number' ? f.playouts : 0;
}

function collect(prefix, metric) {
  const bucket = {};
  for (const r of runs) {
    for (const k of Object.keys(r.arms)) {
      if (!k.startsWith(prefix)) continue;
      const cap = Number(k.split('_').pop());
      const arm = r.arms[k];
      const f = arm && arm.fastest;
      if (!f || typeof f[metric] !== 'number') continue;
      const n = armSample(arm);
      if (n < MIN_PLAYOUTS) {
        const key = r.file + ' ' + k;
        if (!EXCLUDED.some(e => e.key === key)) {
          EXCLUDED.push({ key, file: r.file, arm: k, playouts: n,
                          why: 'sample below ' + MIN_PLAYOUTS + ' playouts — a probe arm from a run '
                             + 'whose point was a different arm, not a comparable measurement' });
        }
        continue;
      }
      const pos = prefix === 'playout_cap_' ? r.cap_order.indexOf(cap) + 1 : null;
      (bucket[cap] = bucket[cap] || []).push({
        value: f[metric], file: r.file, priority: r.priority, reps: r.reps, playouts: n,
        arm_position: pos, arms_in_run: prefix === 'playout_cap_' ? r.cap_order.length : null,
        cap_order: r.cap_order.join(','), leaf_n: prefix === 'leaf_cap_' ? r.leaf_n : undefined,
      });
    }
  }
  const res = {};
  for (const cap of Object.keys(bucket).map(Number).sort((a, b) => a - b)) {
    const xs = bucket[cap].slice().sort((a, b) => a.value - b.value);
    const lo = xs[0], hi = xs[xs.length - 1];
    res[cap] = {
      n_runs: xs.length,
      low: Number(lo.value.toFixed(4)), low_from: lo,
      high: Number(hi.value.toFixed(4)), high_from: hi,
      spread_pct: Number((100 * (hi.value - lo.value) / lo.value).toFixed(1)),
      all: xs.map(x => ({ value: Number(x.value.toFixed(4)), file: x.file, playouts: x.playouts,
                          arm_position: x.arm_position, cap_order: x.cap_order,
                          priority: x.priority, reps: x.reps })),
    };
  }
  return res;
}

function turnShape() {
  const o = {};
  for (const r of runs) {
    for (const k of Object.keys(r.arms)) {
      if (!k.startsWith('playout_cap_')) continue;
      const arm = r.arms[k];
      if (armSample(arm) < MIN_PLAYOUTS) continue;
      const f = arm.fastest;
      o[Number(k.split('_').pop())] = {
        mean: f.turn_distribution.mean, p50: f.turn_distribution.p50,
        p90: f.turn_distribution.p90, p99: f.turn_distribution.p99,
        max: f.turn_distribution.max, truncated_pct: f.truncated_pct,
        note: 'deterministic in the seeds and the pool, so identical across runs',
      };
    }
  }
  return o;
}

function fixedCost() {
  const keys = ['bare_node_start', 'release_open', 'engine_data', 'medicham', 'board',
                'rollout_leaf', 'dex', 'total_to_engine_ready', 'team_pool',
                'game_differential_require'];
  const o = {};
  for (const k of keys) {
    const v = runs.map(r => r.load_ms && r.load_ms[k]).filter(x => typeof x === 'number');
    if (v.length) {
      o[k] = { warmest: Number(Math.min.apply(null, v).toFixed(1)),
               coldest: Number(Math.max.apply(null, v).toFixed(1)), n_runs: v.length };
    }
  }
  return o;
}

const art = {
  generated: new Date().toISOString(),
  by: 'engine/bench_speed_consolidate.js',
  what: 'MEDICHAM THROUGHPUT, consolidated across every timed run. RANGES, not points — see '
      + 'warm_state_effect. A TIMING artifact only: it makes NO claim about whether the simulator is '
      + 'correct, MEDICHAM is under quarantine for accuracy, and nothing here lifts it.',
  not_an_accuracy_claim: true,
  quotes_no_quarantined_artifact:
    'data/rollout-cost.json (R2 leaf cost) was NOT read. Every figure here was measured on '
    + '2026-08-28 by engine/bench_speed.js. A fresh timing run is a new number, not a resurrection '
    + 'of a withheld one.',
  report: 'docs/_reports/2026-08-28-medicham-speed.md',
  engine_release: [...new Set(runs.map(r => r.release))],
  team_store_pinned_to: [...new Set(runs.map(r => r.team_store))],
  census: runs[runs.length - 1].census,
  source_runs: runs.map(r => ({ file: r.file, generated: r.generated, priority: r.priority,
    reps: r.reps, cap_order: r.cap_order.join(','), leaf_n: r.leaf_n,
    pairs: r.pairs, boards: r.boards })),

  headline: {
    unit_note:
      'ms per TURN is the figure that generalises. A rollout is truncated at a depth, not played to '
      + 'a result, so every per-GAME and per-PLAYOUT figure is a claim about ONE turn cap and is '
      + 'unreadable without it. Name the cap every time.',
    whole_game: 'playout.sim_playouts_per_sec["60"] — cap 60 reaches a real result in 99.9% of games',
    shipped_leaf:
      'leaf.ms_per_leaf_call["14"] and leaf.playouts_per_sec["14"] — rolloutWinProb n=200, '
      + 'explore=1.0, foePolicy=uniform, maxTurns=14, the engine/miltank.js DEFAULTS',
    plan_against: 'the LOW end of each range. The high end needs a process whose first timed work is '
                + 'the work being measured, which a live search cannot arrange.',
  },

  warm_state_effect: {
    what: 'THE BETWEEN-RUN SPREAD IS PROCESS WARM STATE. It is much larger than the within-run noise '
        + 'floor, and conflating the two was the first version of this measurement\'s mistake.',

    within_run_noise_floor_pct: 2.5,
    within_run_evidence:
      'data/_bench-repeat.json, cap 60, 10 reps in ONE process: reps 3-9 span 171.7 to 176.1 '
      + 'playouts/sec. Reps 1-2 are tier-up and rep 10 is a collapse. That 2.5% band describes REPS '
      + 'WITHIN ONE ARM and NOTHING ELSE. It was quoted as though it described the spread between '
      + 'runs, which it does not — the between-run spread is 8% to 28% on the same quantity.',

    between_run_spread_pct: 'see spread_pct on each range: 2.3 to 28 for arms that reached steady '
                          + 'state, and up to 342 for arms that did not',

    cause_1_tier_up: {
      what: 'V8 tiers the playout loop up over roughly the first 4,000 playouts (~40,000 turns), a '
          + '5.6x effect.',
      evidence: 'The first timed arm of a fresh process, rep by rep of 1,000 playouts, runs at '
              + '2.89 / 1.78 / 1.67 / 1.58 / 0.68 / 0.51 ms per turn. Reproduced in two independent '
              + 'runs, always on whichever cap ran FIRST and never on a later one.',
      consequence: 'The harness now runs a discarded warm-up and so do the scaling children. It is '
                 + 'NOT LARGE ENOUGH: it plays ~36 playouts, against the ~4,000 the curve needs. '
                 + 'Arms that ran few reps therefore published a partly-cold number — cap 20 as the '
                 + 'first arm of a 3-rep run reads 42.7 playouts/sec against 188.7 as a later arm.',
    },

    cause_2_sporadic_collapse: {
      what: 'Individual legs collapse to between a third and a seventh of the steady-state rate, on '
          + 'an otherwise idle machine, with no reproducible trigger.',
      evidence: 'Rep 10 of the 10-rep steady-state probe fell to 65.5 from a 172-176 band. In the '
              + 'warmed interleaved scaling arm the two 1-worker legs read 191.6 and 26.2 — the SAME '
              + 'configuration, 7.3x apart — while the two 2-worker legs agreed to 2%.',
      consequence: 'NO SINGLE LEG OF THIS INSTRUMENT IS TRUSTWORTHY. Every figure here is '
                 + 'fastest-of-N, and any conclusion drawn from one leg per condition is void — '
                 + 'which is exactly how the retracted "MEDICHAM does not scale" claim was produced.',
    },

    what_is_NOT_the_cause: {
      priority: 'NOT PRIORITY. The only like-for-like comparison is data/_bench-belownormal.json '
              + '(BelowNormal) against data/_bench-normal.json (NORMAL): same cap set, same order, '
              + 'same instrument. They read 170.3 vs 170.9 at cap 14 and 158.5 vs 151.5 at cap 60 — '
              + 'under 5%, with the sign flipping between caps. So BelowNormal costs nothing '
              + 'detectable at a bound of about 5%. An earlier claim of "0.4% apart" quoted only the '
              + 'cap-14 half and was too tight; and comparing a BelowNormal run against a DIFFERENT '
              + 'cap set is not a priority comparison at all.',
      the_cap: 'NOT THE CAP, AND NOT ARM POSITION ALONE. Running the same six caps in DESCENDING '
             + 'order (data/_bench-reverse.json) made EVERY cap faster than the ascending run, '
             + 'including cap 6 which moved from first to last: 240.1 -> 283.4. Cap 60 moved from '
             + 'last to first: 151.5 -> 190.1. Three further runs put cap 60 second behind caps 6, '
             + '12 and 20 and read 165.7, 173.1 and 148.5, with no monotone relation to the '
             + 'preceding cap.',
      contention: 'NOT CONTENTION. The fastest and the slowest legs both ran on a box with 6+ GB '
                + 'free and under 10% background CPU.',
    },

    residual_unattributed:
      'PART OF THE SPREAD IS NOT ATTRIBUTED AND THIS SAYS SO RATHER THAN INVENTING A MECHANISM. Two '
      + 'runs with cap 6 as the FIRST arm read 94.3 and 240.1 playouts/sec — 2.5x apart at the same '
      + 'arm position with 3 and 5 reps. No threshold on reps, playouts or turns separated the arms '
      + 'that reached steady state from the ones that did not; two candidate heuristics were tried '
      + 'against the data and both were contradicted by it.',

    what_to_trust:
      'THE LEAF ARM. All four leaf measurements ran 4,800 playouts, comfortably past tier-up, and '
      + 'they agree to 11% (1,144 to 1,270 ms per leaf call at cap 14). That is the number the '
      + 'rollout budget is actually written against, and it is the best-conditioned figure in this '
      + 'artifact. The playout arms at caps 10-60 agree to 8-28%. Anything with a spread above 30% '
      + 'contains an arm that never warmed and should be read off `all` rather than off the range.',

    instrument_consequence:
      'MEASURE ONE CAP PER PROCESS, AS THE FIRST TIMED ARM, WITH AT LEAST 6 REPS, AND REPEAT EVERY '
      + 'CONDITION AT LEAST TWICE IN INTERLEAVED ORDER. The multi-cap sweeps published first violated '
      + 'all three.',
  },

  playout: {
    what: 'runPlayout on freshly built 4v4 bodies from the pinned pool, explore=1.0, foePolicy '
        + 'uniform, switchRate 0.0998. SIMULATION TIME ONLY — body construction is the separate '
        + 'build_ms_per_playout line.',
    sim_playouts_per_sec: collect('playout_cap_', 'sim_playouts_per_sec'),
    sim_ms_per_playout: collect('playout_cap_', 'sim_ms_per_playout'),
    sim_ms_per_turn: collect('playout_cap_', 'sim_ms_per_turn'),
    build_ms_per_playout: collect('playout_cap_', 'build_ms_per_playout'),
    turn_shape: turnShape(),
  },

  leaf: {
    what: 'rolloutWinProb — the call engine/miltank.js actually makes. Each of the n samples pays '
        + 'buildSide TWICE (fresh bodies every sample, because MEDICHAM mutates what it is handed) '
        + 'and then runPlayout. Measured on TURN-0 boards, four live bodies a side at full HP, which '
        + 'is the MOST EXPENSIVE leaf there is; a mid-game leaf is cheaper by an unmeasured amount.',
    ms_per_leaf_call: collect('leaf_cap_', 'ms_per_leaf_call'),
    playouts_per_sec: collect('leaf_cap_', 'playouts_per_sec'),
    ms_per_turn: collect('leaf_cap_', 'ms_per_turn'),
    truncated_pct: collect('leaf_cap_', 'truncated_pct'),
  },

  comparability: {
    min_playouts_to_enter_a_range: 1000,
    why: 'Several runs set a trivial playout or leaf arm (16 or 5 samples) because a DIFFERENT arm '
       + 'was the point of that run. Pooling those into a range is not conservative, it is wrong: '
       + 'with them in, cap 14 read a 380% spread and the leaf a 3,696% spread, every bottom '
       + 'endpoint being a 16-sample arm that never left the interpreter.',
    excluded_arms: EXCLUDED,
  },

  fixed_cost_ms: {
    what: 'Paid ONCE per process and amortised over every playout after it. A per-game figure that '
        + 'folds this in is useless for rollout budgeting, so it is kept apart. '
        + 'game_differential_require is HARNESS cost: a rollout engine driving rolloutWinProb off a '
        + 'live Board never pays it.',
    warm_and_cold: fixedCost(),
    worker_rss_mb: { engine_ready: 132, of_which_showdown_dex: 71, abra_own_engine: 22,
                     plus_team_pool_harness_only: 197, warmed_worker_mid_run: 385,
                     measured_by: 'process.memoryUsage().rss phase by phase, and Get-Process for the '
                                + 'mid-run figure' },
  },
};

/* ---- THE SCALING ARMS. Three exist, they DISAGREE, and the artifact says which may be quoted and
 * why — rather than leaving a reader to guess which run the prose was written from.
 *
 * THE FIRST CONCLUSION DRAWN FROM THESE WAS WRONG AND IS RECORDED HERE RATHER THAN QUIETLY FIXED.
 * `data/_bench-scaling.json` reads 1w 167.1 -> 4w 143.2 -> 6w 144.3 aggregate playouts/sec, and was
 * published on 2026-08-28 as "MEDICHAM does not scale across processes". An aggregate that FALLS as
 * workers are added is not sub-linear scaling, it is an impossible measurement: four processes cannot
 * do less total work than one unless legs collapsed. `impossible_rows` below detects exactly that
 * from the numbers, so the same mistake cannot be made again out of this file. */
function scalingArm(r) {
  const rows = r.scaling.map(x => ({
    workers: x.workers, wall_ms: x.wall_ms,
    aggregate_playouts_per_sec_excluding_startup: x.aggregate_playouts_per_sec_excluding_startup,
    aggregate_playouts_per_sec_including_startup: x.aggregate_playouts_per_sec_including_startup,
    per_worker_playouts_per_sec: x.per_worker_playouts_per_sec, errors: x.errors,
    children_playouts_per_sec: ((x.legs && x.legs[0] && x.legs[0].rs) || [])
      .map(y => y && y.playouts_per_sec).filter(v => typeof v === 'number'),
  }));
  const warmed = r.scaling.every(x => x.legs && x.legs[0] && x.legs[0].rs
                                   && x.legs[0].rs.every(y => y && y.warmed));
  const counts = rows.map(x => x.workers);
  const interleaved = counts.length !== new Set(counts).size;

  /* BEST LEG PER WORKER COUNT, with the leg-to-leg spread beside it. Fastest-of-N is the convention
   * used everywhere in this measurement; the spread is what says whether to believe it. */
  const byCount = {};
  for (const x of rows) {
    const k = String(x.workers);
    (byCount[k] = byCount[k] || []).push(x.aggregate_playouts_per_sec_excluding_startup);
  }
  const best = {};
  for (const k of Object.keys(byCount).map(Number).sort((a, b) => a - b)) {
    const v = byCount[String(k)].slice().sort((a, b) => a - b);
    best[k] = { legs: v.length, best: v[v.length - 1], worst: v[0],
                leg_spread_x: v[0] ? Number((v[v.length - 1] / v[0]).toFixed(2)) : null };
  }
  const one = best[1] && best[1].best;
  const speedup = {};
  if (one) for (const k of Object.keys(best)) speedup[k] = Number((best[k].best / one).toFixed(2));

  /* A ROW THAT CANNOT BE TRUE. More processes cannot do less total work than fewer. */
  const baseRow = rows.reduce((a, x) => (x.workers < a.workers ? x : a), rows[0]);
  const impossible = rows
    .filter(x => x.workers > baseRow.workers
      && x.aggregate_playouts_per_sec_excluding_startup
         < baseRow.aggregate_playouts_per_sec_excluding_startup)
    .map(x => x.workers + 'w aggregate ' + x.aggregate_playouts_per_sec_excluding_startup
            + ' < ' + baseRow.workers + 'w aggregate '
            + baseRow.aggregate_playouts_per_sec_excluding_startup);

  const out = { file: r.file, warmed, interleaved, rows, best_leg_per_worker_count: best,
                speedup_vs_1_worker: one ? speedup : 'no 1-worker row in this arm',
                impossible_rows: impossible.length ? impossible : null };

  if (!warmed) {
    out.quotable_for_absolute_rates = false;
    out.quotable_for_the_scaling_ratio = 'with care';
    out.caveat = 'THE CHILDREN WERE NOT WARMED, so every absolute rate here is depressed by V8 '
      + 'tier-up: its 1-worker point reads 108.5 playouts/sec against 191.6 for a warmed child. Its '
      + 'RATIO (1w -> 4w = 2.77x) nevertheless agrees with the warmed interleaved arm (2.35x), which '
      + 'is worth saying out loud because this arm was dismissed outright at first and it was not the '
      + 'one that was wrong. Retained rather than deleted: it carries the only 8- and 12-worker '
      + 'points, and deleting a measurement to tidy a story is worse than labelling it.';
  } else if (!interleaved) {
    out.quotable_for_absolute_rates = false;
    out.quotable_for_the_scaling_ratio = false;
    out.caveat = 'WARMED BUT ONE LEG PER WORKER COUNT, so a sporadic collapse cannot be told apart '
      + 'from a real effect — and impossible_rows shows it collapsed. THIS IS THE ARM THAT PRODUCED '
      + 'THE RETRACTED "MEDICHAM DOES NOT SCALE" CLAIM. Do not quote it for scaling.';
  } else {
    out.quotable_for_absolute_rates = true;
    out.quotable_for_the_scaling_ratio = true;
    out.caveat = 'WARMED AND INTERLEAVED — worker counts repeated out of order, so a drift in machine '
      + 'conditions cannot alias onto worker count. Compare the repeated rows to each other: 2 '
      + 'workers repeats to within 2% while 1 worker differs 7.3x between its two legs. That is the '
      + 'sporadic collapse this instrument suffers, and it is why a single leg is worthless here. '
      + 'Still measured on a machine that was NOT idle.';
  }
  return out;
}

const scalingRuns = runs.filter(r => r.scaling && r.scaling.length);
art.process_scaling = {
  what: 'Independent child processes, each playing playouts at cap 14. `warmed` says whether the '
      + 'child ran discarded playouts before its timed section; `interleaved` says whether worker '
      + 'counts were repeated out of order so machine drift cannot alias onto worker count.',
  verdict: 'MEDICHAM SCALES ACROSS PROCESSES, SUB-LINEARLY. Best leg per worker count on the warmed '
         + 'interleaved arm: 1w 191.6, 2w 276.7 (1.44x), 4w 449.7 (2.35x) aggregate playouts/sec. '
         + 'AN EARLIER CLAIM THAT IT DOES NOT SCALE AT ALL IS RETRACTED — see the arm carrying '
         + 'impossible_rows.',
  confidence: 'LOW. Legs of the same configuration disagree by up to 7.3x, the box was not idle, and '
            + 'no worker count above 4 has a trustworthy point. Plan against ONE worker and treat '
            + 'extra workers as upside rather than as budget.',
  why_warming_and_interleaving_decide_the_answer:
    'A cold MEDICHAM process is up to 5.6x slower than a warm one for roughly its first 4,000 '
    + 'playouts, so an unwarmed arm measures tier-up. And this instrument suffers sporadic 1.5x to '
    + '7x collapses of individual legs, so one leg per worker count cannot be told apart from a real '
    + 'effect. Both guards are needed; the first arm published had neither.',
  machine: 'AMD Ryzen 7 7735HS, 8 physical cores / 16 threads, 14.3 GB. NOT idle: Brave held roughly '
         + '1.4 to 2.9 cores throughout. Under multi-worker load the package ran at 86-95% of its '
         + '3.2 GHz nominal against a 4.75 GHz single-thread boost.',
  worker_cpu_check: 'During the 6-worker leg each worker received 1.17 cores over a 15-second sample, '
                  + '9.36 cores busy of 8 physical. The workers were not starved of scheduler time.',
  control: {
    what: 'Does this machine scale independent node processes at all? Two throwaway workloads with '
        + 'tiny working sets, same spawn driver, same machine, minutes after the warmed arm.',
    cpu_bound_speedup: { 1: 1.00, 2: 1.97, 4: 3.69, 6: 5.21, 8: 6.61 },
    alloc_bound_speedup: { 1: 1.00, 2: 1.88, 4: 3.67, 6: 4.88, 8: 5.58 },
    conclusion: 'The machine scales near-linearly for a workload that fits in cache. MEDICHAM at '
              + '2.35x on 4 workers is well short of the control at 3.69x, which is consistent with '
              + 'a 385 MB working set against a 16 MB L3 — a HYPOTHESIS, not a measurement.',
    scripts: 'session scratchpad only — cpuctl.js, allocctl.js, ctl_driver.js. Throwaway '
           + 'microbenchmarks, deliberately not added to the tree.',
  },
  arms: scalingRuns.map(scalingArm),
};

art.what_this_does_not_cover = [
  'ACCURACY. MEDICHAM is quarantined for correctness and speed says nothing about it.',
  'Any per-game figure is a claim about ONE turn cap. Name the cap or do not quote the number.',
  'The playouts run about 45% longer than real games: mean 10.75 turns here against a human '
    + 'non-forfeit mean of 7.11 (ladder) and 7.74 (bo3) in data/rollout-switch-census.json, 42,818 '
    + 'games. A uniform-random player is less lethal, so a real game costs fewer turns.',
  'The leaf figures are TURN-0 boards, four live bodies a side. That is the worst case; a mid-game '
    + 'leaf is cheaper by an amount nobody has measured.',
  'Mechanics coverage is whatever the pinned pool brings. This is the usage-weighted pool, not the '
    + 'census roster, so rare and expensive mechanics are under-weighted, and game_differential '
    + 'drops every Zoroark/Zorua team before pairing, so no Illusion is in the timed sample.',
  'It is the cost of the LEAF, not of a MILTANK decision. A real decision also pays board '
    + 'construction, feature extraction, MAG scoring and candidate enumeration.',
  'One machine, and not an idle one. Nothing transfers to a different box without re-measuring.',
  'The pool is bo3 + ots only. data/games.ladder.jsonl is not in data/team-pool-frozen.',
];

fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');
console.log('  consolidated ' + runs.length + ' run files -> data/medicham-speed.json ('
  + fs.statSync(OUT).size.toLocaleString() + ' bytes)');
for (const r of runs) {
  console.log('    ' + r.file.padEnd(44) + 'caps=[' + r.cap_order.join(',') + ']  reps=' + r.reps);
}
for (const a of art.process_scaling.arms) {
  console.log('    scaling arm ' + a.file.padEnd(40) + ' warmed=' + String(a.warmed).padEnd(6)
    + ' interleaved=' + String(a.interleaved).padEnd(6)
    + ' QUOTABLE=' + a.quotable_for_absolute_rates
    + (a.impossible_rows ? '   <-- carries an IMPOSSIBLE row: ' + a.impossible_rows[0] : ''));
}
