/* web/build-status.js — bakes web/status-data.js for web/status.html.
 *
 *   node web/build-status.js
 *
 * WHY A BUILD STEP AND NOT fetch()
 * --------------------------------
 * The obvious design is `fetch('../data/mechanics-census.json')` at page load, so the board is never
 * stale. It does not survive this project. `docs/WEB.md`: some pages are opened from `file://`, and a
 * `fetch()` of a local JSON under `file://` is blocked by CORS in every current browser — the page
 * renders with every figure empty and NO error a visitor can see. That is exactly the failure mode
 * CLAUDE.md names first: *a capability was absent and everything reported success*.
 *
 * So the board uses the pattern the site already uses nine times over in `web/index.html`:
 * a generated `<script src>` publishing one global. `data/status.js` -> `window.ABRA_STATUS` is the
 * precedent; this writes `web/status-data.js` -> `window.ABRA_BOARD`. A script tag loads from
 * `file://` and from a server, so the board works in both.
 *
 * THE COST OF THAT CHOICE IS THAT THE BOARD CAN GO STALE, AND THE BOARD MUST SAY SO. Every figure
 * carries `built_at` and the mtime of the artifact it came from, and status.html prints both. A
 * snapshot that admits it is a snapshot beats a live page that silently shows nothing.
 *
 * THE RULE THIS FILE OBEYS
 * ------------------------
 * WEB may not author a number (`.claude/agents/web.md`). Concretely, in this file every numeric value
 * emitted comes from exactly one of two places and records which:
 *
 *   (1) a scalar read VERBATIM out of a `data/*.json` artifact, or
 *   (2) a line printed by `node engine/status.js`, parsed but not recomputed.
 *
 * There is no arithmetic here. No rounding, no averaging, no percentage computed from two counts, no
 * "n_missing = probed - live". Where status.js derives something the artifacts do not carry directly
 * (tag coverage is the case that matters — it joins tags.json against mechanics-census.json), this
 * takes status.js's printed line and credits status.js as the source, rather than reimplementing the
 * join and risking a second answer. Two implementations of one fact is the failure CLAUDE.md calls
 * FEATURES ARE PER-MODEL, FACTS ARE GLOBAL.
 *
 * Anything that cannot be sourced is emitted as `{state:'notmeasured'}` with a reason, and
 * status.html renders it at full weight. That is the deliverable, not a fallback.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

/* ---- readers. Every one of these returns provenance alongside the value. ---------------------- */
const readJson = rel => { try { return JSON.parse(fs.readFileSync(D(rel), 'utf8')); } catch (e) { return null; } };
const mtimeIso = rel => { try { return fs.statSync(D(rel)).mtime.toISOString(); } catch (e) { return null; } };

/** A sourced figure. `v` is verbatim from `src`; nothing here computes it. */
function fig(v, src, opts) {
  const o = opts || {};
  if (v === undefined || v === null || v === '') {
    return { state: 'notmeasured', src: src, why: o.why || ('no value in ' + src), label: o.label, note: o.note };
  }
  /* `at` must mean "when this FIGURE was produced", never "when its source file was last touched".
     For a data/*.json that is the artifact's mtime. For engine/status.js it is NOT the mtime of the
     script — that would date a live figure to whenever somebody last edited the printer — so a
     status.js figure carries no mtime and is dated by the build stamp at the top of the page. */
  return {
    state: o.state || 'ok', v: v, src: src,
    at: (src && src !== 'engine/status.js' && src.indexOf('/') > 0) ? mtimeIso(src) : null,
    live: src === 'engine/status.js' || undefined,
    label: o.label, note: o.note, unit: o.unit,
  };
}
/** No artifact says it. This is a first-class result, not an error. */
function gap(why, owner, label) {
  return { state: 'notmeasured', why: why, owner: owner, label: label };
}

/* ---- engine/status.js: run it once, keep the raw text, parse only what it alone derives -------- */
let STATUS_TEXT = null, STATUS_ERR = null;
try {
  STATUS_TEXT = execFileSync(process.execPath, [D('engine', 'status.js')], {
    encoding: 'utf8', maxBuffer: 1 << 26, cwd: ROOT,
    env: { ...process.env, SHOWDOWN_PATH: process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown' },
  });
} catch (e) {
  STATUS_ERR = (e.message || String(e)).split('\n')[0];
}
const SRC_STATUS = 'engine/status.js';
/** Pull one line out of the status.js output. Returns the line VERBATIM; no reformatting. */
function statusLine(re) {
  if (!STATUS_TEXT) return null;
  const m = STATUS_TEXT.match(re);
  return m ? m : null;
}
function statusLines(re) {
  if (!STATUS_TEXT) return [];
  const out = [];
  let m; const g = new RegExp(re.source, re.flags.indexOf('g') < 0 ? re.flags + 'g' : re.flags);
  while ((m = g.exec(STATUS_TEXT)) !== null) out.push(m);
  return out;
}

/* ================================================================= ENGINE ====================== */
function engine() {
  const CENSUS = 'data/mechanics-census.json', DIFF = 'data/engine-diff.json';
  const c = readJson(CENSUS), d = readJson(DIFF);

  const missing = c ? c.results.filter(r => !r.live).map(r => ({ kind: r.kind, tag: r.tag, label: r.label })) : null;

  /* tag coverage is status.js's join of data/tags.json against the census. Take its line; do not
     re-derive it here, or the site and the terminal can disagree about the same fact. */
  const tc = statusLine(/tag coverage: (\d+)\/(\d+) probed, (\d+) unprobed/);

  return {
    headline: c
      ? fig(c.live + '/' + c.probed, CENSUS, { label: 'probed mechanics live', note: 'must never go down (docs/ENGINE.md)' })
      : gap('data/mechanics-census.json absent — run tests/test-mechanics.js', 'ENGINE', 'probed mechanics live'),
    live: c ? fig(c.live, CENSUS, { label: 'live' }) : gap('no census', 'ENGINE', 'live'),
    probed: c ? fig(c.probed, CENSUS, { label: 'probed' }) : gap('no census', 'ENGINE', 'probed'),
    missing_n: c ? fig(c.missing, CENSUS, { label: 'missing' }) : gap('no census', 'ENGINE', 'missing'),
    census_generated: c ? fig(c.generated, CENSUS, { label: 'census generated' }) : gap('no census', 'ENGINE'),
    missing_list: missing && missing.length
      ? { state: 'ok', src: CENSUS, at: mtimeIso(CENSUS), rows: missing }
      : gap('no census to list from', 'ENGINE', 'the missing twelve'),

    diff_headline: d
      ? fig(d.disagreed + '/' + d.compared, DIFF, {
        label: 'differential comparisons disagree with Showdown',
        state: d.disagreed > 0 ? 'bad' : 'ok',
        note: 'a differential hit is NOT in the census count — the census probes what someone thought to probe',
      })
      : gap('data/engine-diff.json absent — run tests/test-engine-diff.js', 'ENGINE', 'Showdown differential'),
    diff_worst: d && d.worst && d.worst.length
      ? { state: 'bad', src: DIFF, at: mtimeIso(DIFF), rows: d.worst.slice(0, 8) }
      : gap('no engine-diff.json', 'ENGINE', 'open differentials'),
    diff_generated: d ? fig(d.generated, DIFF, { label: 'differential run' }) : gap('no engine-diff.json', 'ENGINE'),

    tags: tc
      ? fig(tc[1] + '/' + tc[2], SRC_STATUS, {
        label: 'tags probed', note: 'status.js joins data/tags.json against data/mechanics-census.json',
      })
      : gap('engine/status.js printed no tag-coverage line', 'ENGINE', 'tag coverage'),
    tags_unprobed: tc ? fig(tc[3], SRC_STATUS, { label: 'unprobed', state: 'bad' })
      : gap('engine/status.js printed no tag-coverage line', 'ENGINE', 'unprobed tags'),
    tags_at: mtimeIso('data/tags.json'),
  };
}

/* ================================================================= MEASURE ===================== */
function measure() {
  const WB = 'data/winrate-backtest.json';
  const b = readJson(WB);

  /* status.js prints the calibration curve, the power line and the CURRENT / PRE-CHANGE hash check.
     Those lines are the authority; taken verbatim. */
  const curve = statusLine(/^\s+when it says 90-100%.*$/m);
  const power = statusLine(/^\s+powered for MDE.*$/m);
  const currentL = statusLine(/^\s+(CURRENT|PRE-CHANGE) — (.*)$/m);
  const prov = statusLine(/provenance: (\d+) unsafe, (\d+) possibly stale, (\d+) ok, (\d+) missing/);
  const refitClean = statusLine(/^\s+refit edge: (CLEAN|NOT DERIVED) — (.*)$/m);
  const refitOwed = statusLine(/^\s+REFIT OWED — weights fitted (.*)$/m);
  const refitMoved = statusLines(/^\s+\((\S+) moved ([\d-]+ [\d:]+), but the feature function did not\)$/m)
    .map(m => ({ src: m[1], at: m[2] }));

  return {
    headline: b ? fig(b.verdict, WB, { state: 'bad', label: 'leaf calibration' })
      : gap('data/winrate-backtest.json absent', 'MEASURE', 'leaf calibration'),
    n_games: b ? fig(b.n_games_scored, WB, { label: 'games scored' }) : gap('no backtest', 'MEASURE', 'games scored'),
    rollouts: b ? fig(b.rollouts_per_game, WB, { label: 'rollouts per game' }) : gap('no backtest', 'MEASURE', 'rollouts'),
    curve: curve ? fig(curve[0].trim(), SRC_STATUS, { state: 'bad', label: 'reliability, extreme buckets' })
      : gap('engine/status.js printed no reliability line', 'MEASURE', 'reliability curve'),
    power: power ? fig(power[0].trim(), SRC_STATUS, { label: 'power' })
      : gap('engine/status.js printed no power line', 'MEASURE', 'power'),

    /* THE STALENESS EDGE, MEASURE SIDE. The artifact stamps a content hash of every source the leaf
       reads, so this is a comparison and not an mtime guess. */
    build_standing: currentL
      ? fig(currentL[1], SRC_STATUS, {
        state: currentL[1] === 'CURRENT' ? 'ok' : 'stale', label: 'build standing', note: currentL[2],
      })
      : gap('engine/status.js printed no CURRENT / PRE-CHANGE line', 'MEASURE', 'build standing'),

    provenance: prov
      ? {
        state: (+prov[1] > 0) ? 'bad' : (+prov[2] > 0 ? 'stale' : 'ok'), src: SRC_STATUS,
        unsafe: +prov[1], stale: +prov[2], ok: +prov[3], missing: +prov[4],
        note: 'engine/provenance.js is the canonical staleness authority; status.js prints its totals',
      }
      : gap('engine/provenance.js did not run under status.js', 'MEASURE', 'provenance'),

    refit: refitOwed
      ? fig('REFIT OWED', SRC_STATUS, { state: 'bad', label: 'refit edge', note: 'weights fitted ' + refitOwed[1] })
      : refitClean
        ? fig(refitClean[1], SRC_STATUS, {
          state: refitClean[1] === 'CLEAN' ? 'ok' : 'notmeasured', label: 'refit edge', note: refitClean[2],
        })
        : gap('engine/status.js printed no refit line', 'MEASURE', 'refit edge'),
    refit_moved: refitMoved,
  };
}

/* ================================================================= SEARCH ====================== */
function search() {
  const R1 = 'data/rollout-r1.json', R2 = 'data/rollout-cost.json', R3 = 'data/rollout-r3.json', R4 = 'data/rollout-r4.json';
  const r1 = readJson(R1), r2 = readJson(R2), r3 = readJson(R3), r4 = readJson(R4);

  /* The gate ladder. Each rung is its own artifact; a rung with no artifact is a rung nobody climbed,
     and it renders as NOT MEASURED rather than as an empty row.
     *
     * A RUNG WHOSE ARTIFACT CHANGED SHAPE ALSO RENDERS NOT MEASURED, PER FIELD. This is not
     * defensive coding — it caught a real event while this file was being written. MEASURE replaced
     * data/rollout-r1.json with a different schema (joined / dropped_misaligned / k gone, positions /
     * judges / verdict in their place) and engine/status.js, which reads the old keys by name, began
     * printing "joined undefined, dropped undefined misaligned, k=undefined" without erroring. The
     * board said NOT MEASURED for those three slots, which is the correct answer and is how the
     * change became visible at all. `fig()` returns a gap for undefined, so the page cannot render an
     * "undefined" and cannot render a blank. */
  const ladder = [
    {
      id: 'R1', q: 'leaf accuracy', src: R1,
      /* Read what the artifact CARRIES, not what an older reader expects it to carry. status.js
         still asks for joined / dropped_misaligned / k; the artifact now publishes positions and a
         verdict. Listing the retired keys here would print three NOT MEASUREDs forever, and CLAUDE.md
         is explicit that a check which keeps firing after the fix gets ignored. The genuine signal —
         that status.js's R1 line is now printing `undefined` — is raised ONCE, below, as its own row. */
      f: r1 && [
        fig(r1.positions, R1, { label: 'positions scored' }),
        fig(r1.corpus_shape && r1.corpus_shape.distinct_games, R1, { label: 'distinct games' }),
      ],
      generated: r1 && r1.generated,
    },
    {
      id: 'R2', q: 'leaf cost', src: R2,
      f: r2 && [fig(r2.boards, R2, { label: 'boards' }), fig(r2.games, R2, { label: 'games' })],
      generated: r2 && r2.generated,
    },
    {
      id: 'R3', q: 'divergence — does the search even disagree with the policy', src: R3,
      f: r3 && [
        /* THE ARTIFACT HOLDS THE RAW FLOAT (72.85714285714286). status.js prints it to one decimal.
           Rounding it here would be WEB authoring a number, so this takes status.js's already-rounded
           line when it is available and falls back to the artifact's raw value when it is not — ugly
           and exact beats tidy and invented. */
        (function () {
          const m = statusLine(/R3 divergence\s+([\d.]+)% over/);
          return m ? fig(m[1], SRC_STATUS, { label: 'divergence', unit: '%', note: 'rounded by status.js from data/rollout-r3.json' })
            : fig(r3.divergence_pct, R3, { label: 'divergence', unit: '%', note: 'raw, unrounded — status.js was not available to format it' });
        })(),
        fig(r3.decisions, R3, { label: 'decisions' }),
        fig(r3.agreed, R3, { label: 'agreed' }),
        fig(r3.skipped, R3, { label: 'skipped' }),
      ],
      generated: r3 && r3.generated,
    },
    {
      id: 'R4', q: 'does it win', src: R4,
      f: r4 && [
        fig(r4.arm1_share_pct, R4, { label: 'arm 1 share', unit: '%' }),
        fig(r4.decisive_pairs, R4, { label: 'decisive pairs — THE UNIT OF THE TEST' }),
        fig(r4.pairs, R4, { label: 'seed pairs' }),
        fig(r4.games, R4, { label: 'games' }),
      ],
      generated: r4 && r4.generated,
    },
  ].map(g => {
    if (!g.f) return { id: g.id, q: g.q, src: g.src, state: 'notmeasured', why: g.src + ' absent — nothing has written this gate' };
    /* The artifact's OWN verdict string, verbatim, when it carries one. R1 and R4 both do; R2 and R3
       do not, and their rows simply have no verdict line rather than a sentence written here. */
    const raw = { 'data/rollout-r1.json': r1, 'data/rollout-cost.json': r2, 'data/rollout-r3.json': r3, 'data/rollout-r4.json': r4 }[g.src];
    return {
      id: g.id, q: g.q, src: g.src, at: mtimeIso(g.src), generated: g.generated,
      figs: g.f, state: 'ok',
      verdict: (raw && raw.verdict) || null,
      verdict_code: (raw && raw.verdict_code) || null,
      verdict_note: (raw && raw.verdict_note) || null,
    };
  });

  /* R4 in full, because it is the result the whole project is quoted on and every one of its caveats
     is load-bearing. All strings verbatim out of the artifact. */
  const r4full = r4 ? {
    state: 'ok', src: R4, at: mtimeIso(R4),
    verdict: r4.verdict, verdict_code: r4.verdict_code,
    share: r4.arm1_share_pct, ci: r4.ci95_pct,
    decisive_pairs: r4.decisive_pairs, pairs: r4.pairs, games: r4.games,
    lines: r4.corpus_shape && r4.corpus_shape.lines,
    line_note: r4.corpus_shape && r4.corpus_shape.note,
    counts: r4.counts, sprt: r4.sprt, arms: r4.arms, stamps: r4.stamps,
    standing: r4.standing, noise_floor: r4.noise_floor, caveats: r4.caveats,
    corpus: r4.corpus,
  } : gap('data/rollout-r4.json absent', 'SEARCH', 'R4');

  /* THE STALENESS BOARD, SEARCH SIDE — status.js classes every run against the newest engine source.
     This is the single most valuable thing on the page: which results describe a build that is gone. */
  const newest = statusLine(/runs vs engine \(newest engine source: (\S+) ([\d-]+ [\d:]+)\):/);
  const runs = statusLines(/^ {4}(PRE-CHANGE|current {3}) (\S+\.jsonl) {2}([\d-]+ [\d:]+)$/m)
    .map(m => ({ standing: m[1].trim(), file: m[2], at: m[3] }));

  /* THE HANDOFF ITSELF CAN BE WRONG, AND NOTHING ELSE CHECKS IT.
   * status.js reads gate artifacts by KEY NAME. When a generator changes its schema, the template
   * literal interpolates `undefined` and status.js prints a line that looks like a result. Found on
   * 2026-08-04: R1's artifact moved to a positions/judges/verdict schema and status.js began printing
   * "joined undefined, dropped undefined misaligned, k=undefined". No error, no exit code, and the
   * terminal handoff — the document a new session trusts FIRST — carried it.
   * WEB may not fix status.js. It can render the fact, and does, at full weight. */
  const broken = statusLines(/^ {2}(R\d[^\n]*undefined[^\n]*)$/m).map(m => m[1].trim());

  return {
    ladder,
    handoff_drift: broken.length
      ? { state: 'bad', src: SRC_STATUS, rows: broken }
      : { state: 'ok', src: SRC_STATUS, rows: [] },
    r4: r4full,
    engine_edge: newest
      ? { state: 'ok', src: SRC_STATUS, newest_src: newest[1], newest_at: newest[2] }
      : gap('engine/status.js printed no runs-vs-engine block', 'SEARCH', 'engine edge'),
    runs: runs.length ? { state: 'ok', src: SRC_STATUS, rows: runs }
      : gap('engine/status.js listed no r4/h2h corpora', 'SEARCH', 'run standings'),
  };
}

/* ================================================================= OPS ========================= */
function ops() {
  const LIVE = 'data/live.js';
  let live = null;
  try {
    live = JSON.parse(fs.readFileSync(D(LIVE), 'utf8').replace(/^\s*window\.LIVE\s*=\s*/, '').replace(/;\s*$/, ''));
  } catch (e) { /* NOT MEASURED below */ }

  const battles = statusLine(/live-games\/: (\d+) battles recorded/);
  const files = statusLines(/^ {2}(data\/\S+\.jsonl) +last written ([\d-]+ [\d:]+|—)$/m)
    .map(m => ({ file: m[1], at: m[2] }));

  return {
    games: live ? fig(live.games, LIVE, { label: 'games collected' }) : gap('data/live.js unreadable', 'OPS', 'games'),
    usable: live ? fig(live.usable, LIVE, { label: 'usable games' }) : gap('data/live.js unreadable', 'OPS', 'usable'),
    usablePct: live ? fig(live.usablePct, LIVE, {
      label: 'usable', unit: '%',
      /* NOT "the other 82%". 100 minus 18 is arithmetic, and arithmetic here is WEB authoring a
         number. The rest is described in words instead, and the definition is pointed at. */
      note: 'the remainder is bot games, forfeits and half-finished brings — data/quality-filter.json is the single definition of a usable game',
    }) : gap('data/live.js unreadable', 'OPS', 'usable %'),
    teams: live ? fig(live.teams, LIVE, { label: 'teams' }) : gap('data/live.js unreadable', 'OPS', 'teams'),
    turns: live ? fig(live.turns, LIVE, { label: 'clean turns' }) : gap('data/live.js unreadable', 'OPS', 'turns'),
    dmgProfiles: live ? fig(live.dmgProfiles, LIVE, { label: 'move-damage profiles' }) : gap('data/live.js unreadable', 'OPS', 'damage profiles'),
    updated: live ? fig(live.updated, LIVE, { label: 'store updated' }) : gap('data/live.js unreadable', 'OPS', 'updated'),
    battles: battles ? fig(battles[1], SRC_STATUS, { label: 'battles recorded in live-games/' })
      : gap('engine/status.js printed no live-games line', 'OPS', 'battles recorded'),
    files: files.length ? { state: 'ok', src: SRC_STATUS, rows: files }
      : gap('engine/status.js printed no store-file lines', 'OPS', 'store files'),
  };
}

/* ================================================================= WEB ========================= */
function web() {
  /* WEB's own number is "every rendered figure traces to an artifact", and NOTHING MEASURES IT.
     docs/WEB.md says so in its Open section. It renders as NOT MEASURED on the board, about the
     board, because the alternative is the division that polices drift exempting itself. */
  const rooms = fs.readdirSync(D('web')).filter(f => f.endsWith('.html')).sort()
    .map(f => ({ file: 'web/' + f, at: mtimeIso('web/' + f) }));
  const guard = fs.existsSync(D('tests', 'test-stadium-roster.js'));
  const guard2 = fs.existsSync(D('tests', 'test-web-status.js'));
  return {
    rooms: { state: 'ok', src: 'web/ directory listing', rows: rooms },
    guards: [
      { name: 'tests/test-stadium-roster.js', what: 'the Stadium cabinet rack against docs/MODELS.md', present: guard },
      { name: 'tests/test-web-status.js', what: 'this board against its artifacts', present: guard2 },
    ],
    traceability: gap(
      'No guard measures what fraction of rendered figures on the site trace to an artifact. ' +
      'docs/WEB.md lists it under Open. Two guards compare a LIST against its source; neither ' +
      'compares a NUMBER against its source across every page.', 'WEB', 'figures traceable to an artifact'),
  };
}

/* ================================================================= EMIT ======================== */
const payload = {
  built_at: new Date().toISOString(),
  built_by: 'web/build-status.js',
  status_js_ok: !!STATUS_TEXT,
  status_js_error: STATUS_ERR,
  status_raw: STATUS_TEXT || null,
  engine: engine(),
  measure: measure(),
  search: search(),
  ops: ops(),
  web: web(),
};

const banner = '/* web/status-data.js — GENERATED by web/build-status.js. Do not hand-edit.\n' +
  ' * Every value is either a scalar read verbatim out of a data/*.json artifact or a line printed by\n' +
  ' * node engine/status.js. Nothing in here was computed, rounded or averaged by the WEB division.\n' +
  ' * Regenerate:  node web/build-status.js\n' +
  ' */\n';
fs.writeFileSync(D('web', 'status-data.js'), banner + 'window.ABRA_BOARD = ' + JSON.stringify(payload, null, 1) + ';\n');

const notmeasured = JSON.stringify(payload).split('"state":"notmeasured"').length - 1;
console.log('wrote web/status-data.js');
console.log('  engine/status.js: ' + (STATUS_TEXT ? 'ran' : 'FAILED — ' + STATUS_ERR));
console.log('  NOT MEASURED slots: ' + notmeasured);
