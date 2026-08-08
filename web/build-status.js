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
 *
 * THE QUARANTINE — A CAPTION IS NOT A QUARANTINE
 * ----------------------------------------------
 * Will, 2026-08-08: "all engines that take medicham's output should be regarded as out of date and we
 * should stop referencing them until medicham is up to date and we can rerun them."
 *
 * `node engine/quarantine.js --check` reported this file's OUTPUT quoting five withheld verdicts —
 * data/winrate-backtest.json, rollout-r1.json, rollout-r1-explore-sweep.json, rollout-r3.json and
 * rollout-r4.json. The output is generated, so the fix is here: hand-editing web/status-data.js would
 * be WEB authoring the thing it is forbidden to author.
 *
 * The membership test and the gate are NOT reimplemented here. `engine/quarantine.js` derives both,
 * `engine/status.js` is the reference reporter, and this asks the module the same question with the
 * same helper name (`held(...files)` -> the reason, or null) so the terminal and the site cannot
 * disagree about which figures exist. A second opinion about what is downstream of the simulator is
 * exactly CLAUDE.md's FACTS ARE GLOBAL failure.
 *
 * A WITHHELD FIGURE IS ABSENT, NOT CAPTIONED. `status.js` printed `PRE-CHANGE` and "[engine moved
 * since; transfer assumed, not measured]" beside these same numbers for days and they went on being
 * quoted anyway. So the slot carries no `v` at all: it carries the artifact, why it is downstream,
 * how many gate clauses fail, and the command that re-runs it once the gate opens.
 *
 * THE GATE IS AN ARGUMENT, NOT A GLOBAL. `buildPayload(held)` takes the withholder the way
 * `quarantine.withholder(gate, rows)` does, so a test can drive this exact function with the gate
 * closed and with the gate open. A board that can never show a number again is as broken as one that
 * shows a stale one — `tests/test-web-quarantine.js` proves both directions.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

/* ---- the quarantine, asked rather than reimplemented -----------------------------------------
 * `classify()` gives the membership rows; `medichamIsCorrect()` gives the gate. They are kept apart
 * (rather than taking `state()`'s ready-made withholder) for one reason: `withholder(gate, rows)` can
 * then be handed a DIFFERENT gate by a test, which is the only way to show the numbers come back. */
const QUARANTINE = require('../engine/quarantine.js');
let QGATE = null, QROWS = null, QERR = null;
try {
  QGATE = QUARANTINE.medichamIsCorrect();
  const c = QUARANTINE.classify();
  if (c.error) throw new Error('the artifact graph could not be read — ' + c.error);
  QROWS = c.rows;
} catch (e) { QERR = (e && e.message ? e.message : String(e)).split('\n')[0]; }

/** `held(...files)` — may this figure be printed? Returns the withholding reason, or null.
 *  Takes EVERY artifact the slot rests on, because a slot that reads two files is withheld if either
 *  is. Same name, same shape and same semantics as engine/status.js's helper, deliberately. */
function makeHeld(withhold) {
  return function held(...files) {
    if (!withhold) return null;
    for (const f of files) { const h = withhold(f); if (h) return h; }
    return null;
  };
}

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
/** WITHHELD. The artifact exists and has a number in it; the number may not be published.
 *
 *  This is a THIRD state and not a flavour of NOT MEASURED, because they say opposite things to a
 *  reader: NOT MEASURED means nobody has answered the question, and QUARANTINED means somebody did
 *  and the answer is not trustworthy until MEDICHAM is. Folding them together would lose the route
 *  back — the whole substitute for a withheld number is knowing what re-runs it.
 *
 *  There is deliberately no `v`. Every consumer of this board (the page, the tests, anything that
 *  greps the JSON) reads a value out of `v`, so a slot with no `v` cannot leak one by accident.
 *  The four lines mirror engine/status.js's `sayHeld` one for one. */
function withheld(h, label) {
  return {
    state: 'quarantined', label: label,
    /* `src` names the artifact that is being WITHHELD, which is the file a reader would go to. It is
       not a claim that a figure came from there — there is no figure. */
    src: h.file, at: mtimeIso(h.file),
    headline: 'QUARANTINED — the figure is withheld, not annotated.',
    because: h.because, clause: h.clause, rerun: h.rerun,
    why: h.file + ' is downstream of engine/medicham2-browser.js: ' + h.because,
  };
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
function engine(held) {
  const CENSUS = 'data/mechanics-census.json', DIFF = 'data/engine-diff.json';
  const MX = 'data/interaction-matrix.json';

  /* ASKED, NOT ASSUMED. None of these three is quarantined today and that is not an accident — the
     census, the differential and the interaction matrix MEASURE MEDICHAM rather than consume it, and
     engine/quarantine.js exempts them by derivation with a written reason. They are still put to the
     module, because "ENGINE's artifacts are instruments" is a fact that could stop being true the day
     somebody adds a generator, and a hardcoded exemption here would not notice. */
  const qc = held(CENSUS), qd = held(DIFF), qmx = held(MX);
  const c = qc ? null : readJson(CENSUS), d = qd ? null : readJson(DIFF), mx = qmx ? null : readJson(MX);

  /* THE INTERACTION MATRIX WAS ON NO PAGE AT ALL, WHILE FOUR LIVING DOCUMENTS QUOTED IT AT
   * "899 of 899, 100%". The artifact says live 1012, agree 1011, part 1, and it names the parting
   * pair. Nothing here recomputes any of that: `agree` and `part` are read as scalars and the parting
   * row is passed through, so when MEASURE's queued re-run lands, `node web/build-status.js` restamps
   * it and the page cannot be the last place carrying the old figure. There is deliberately no
   * "1011/1012 = 99.9%" — dividing two counts is arithmetic and this division does not do arithmetic;
   * the two counts are shown side by side and a reader can see the one that parts. */
  const parting = mx && Array.isArray(mx.parting) ? mx.parting.map(p => ({
    carrier: p.carrier, reactor: p.reactor, kind: p.kind, side: p.side,
    axis: p.axis, layer: p.layer, uses: p.uses,
  })) : null;

  const missing = c ? c.results.filter(r => !r.live).map(r => ({ kind: r.kind, tag: r.tag, label: r.label })) : null;

  /* tag coverage is status.js's join of data/tags.json against the census. Take its line; do not
     re-derive it here, or the site and the terminal can disagree about the same fact. */
  const tc = statusLine(/tag coverage: (\d+)\/(\d+) probed, (\d+) unprobed/);

  return {
    headline: qc ? withheld(qc, 'probed mechanics live')
      : c ? fig(c.live + '/' + c.probed, CENSUS, { label: 'probed mechanics live', note: 'must never go down (docs/ENGINE.md)' })
      : gap('data/mechanics-census.json absent — run tests/test-mechanics.js', 'ENGINE', 'probed mechanics live'),
    live: qc ? withheld(qc, 'live') : c ? fig(c.live, CENSUS, { label: 'live' }) : gap('no census', 'ENGINE', 'live'),
    probed: qc ? withheld(qc, 'probed') : c ? fig(c.probed, CENSUS, { label: 'probed' }) : gap('no census', 'ENGINE', 'probed'),
    missing_n: qc ? withheld(qc, 'missing') : c ? fig(c.missing, CENSUS, { label: 'missing' }) : gap('no census', 'ENGINE', 'missing'),
    census_generated: qc ? withheld(qc, 'census generated') : c ? fig(c.generated, CENSUS, { label: 'census generated' }) : gap('no census', 'ENGINE'),
    /* AN EMPTY LIST AND A MISSING LIST ARE NOT THE SAME ANSWER, and this slot conflated them until
       the census reached 324/324. `rows: []` means the census ran and nothing is missing — a result,
       and a good one. NOT MEASURED means there is no census to list from. Rendering the first as the
       second tells a visitor nobody has checked, which is the opposite of what happened. */
    missing_list: qc ? withheld(qc, 'the missing mechanics, named')
      : missing
      ? { state: 'ok', src: CENSUS, at: mtimeIso(CENSUS), rows: missing }
      : gap('no census to list from — run tests/test-mechanics.js', 'ENGINE', 'the missing mechanics, named'),

    diff_headline: qd ? withheld(qd, 'differential comparisons disagree with Showdown')
      : d
      ? fig(d.disagreed + '/' + d.compared, DIFF, {
        label: 'differential comparisons disagree with Showdown',
        state: d.disagreed > 0 ? 'bad' : 'ok',
        note: 'a differential hit is NOT in the census count — the census probes what someone thought to probe',
      })
      : gap('data/engine-diff.json absent — run tests/test-engine-diff.js', 'ENGINE', 'Showdown differential'),
    diff_worst: qd ? withheld(qd, 'open Showdown differentials')
      : d && d.worst && d.worst.length
      ? { state: 'bad', src: DIFF, at: mtimeIso(DIFF), rows: d.worst.slice(0, 8) }
      : gap('no engine-diff.json', 'ENGINE', 'open differentials'),
    diff_generated: qd ? withheld(qd, 'differential run') : d ? fig(d.generated, DIFF, { label: 'differential run' }) : gap('no engine-diff.json', 'ENGINE'),

    /* --- the interaction matrix. A different question from the census and from the differential:
     *     the census asks "does this mechanic fire", the differential compares DAMAGE against
     *     Showdown, and this walks pairs — a carrier move against a reactor ability/item/type — and
     *     compares the resulting STATE. --- */
    matrix_live: qmx ? withheld(qmx, 'interaction pairs compared live')
      : mx ? fig(mx.live, MX, { label: 'interaction pairs compared live' })
      : gap('data/interaction-matrix.json absent — run tests/test-interaction-matrix.js', 'ENGINE', 'interaction matrix'),
    matrix_agree: qmx ? withheld(qmx, 'of those, agree with Showdown')
      : mx ? fig(mx.agree, MX, {
        label: 'of those, agree with Showdown',
        note: 'not a percentage: 1011 of 1012 is shown as two counts because dividing them here would be WEB computing a result',
      }) : gap('no interaction matrix', 'ENGINE', 'agreeing pairs'),
    matrix_part: qmx ? withheld(qmx, 'pairs where the two engines PART')
      : mx ? fig(mx.part, MX, {
        state: mx.part > 0 ? 'bad' : 'ok', label: 'pairs where the two engines PART',
      }) : gap('no interaction matrix', 'ENGINE', 'parting pairs'),
    matrix_ran: qmx ? withheld(qmx, 'pairs actually run')
      : mx ? fig(mx.ran, MX, { label: 'pairs actually run', note: 'of ' + (mx.theoretical && mx.theoretical.total) + ' theoretically enumerable; the generator drops a pair it cannot measure and says why' })
      : gap('no interaction matrix', 'ENGINE', 'pairs run'),
    matrix_generated: qmx ? withheld(qmx, 'matrix run') : mx ? fig(mx.generated, MX, { label: 'matrix run' }) : gap('no interaction matrix', 'ENGINE'),
    matrix_commit: qmx ? withheld(qmx, 'Showdown commit compared against') : mx ? fig(mx.showdown_commit, MX, { label: 'Showdown commit compared against' }) : gap('no interaction matrix', 'ENGINE'),
    matrix_parting: qmx ? withheld(qmx, 'the parting pairs, named')
      : parting && parting.length
      ? { state: 'bad', src: MX, at: mtimeIso(MX), rows: parting }
      : (mx ? { state: 'ok', src: MX, at: mtimeIso(MX), rows: [] }
            : gap('no interaction matrix to list from', 'ENGINE', 'the parting pairs')),
    matrix_not_compared: qmx ? withheld(qmx, 'what the matrix does not compare')
      : mx && Array.isArray(mx.not_compared)
      ? { state: 'ok', src: MX, at: mtimeIso(MX), rows: mx.not_compared }
      : gap('no interaction matrix', 'ENGINE', 'what the matrix does not compare'),

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
function measure(held) {
  const WB = 'data/winrate-backtest.json';
  /* THE WHOLE LEAF-CALIBRATION BLOCK RESTS ON ONE ARTIFACT, and that includes the three lines lifted
     out of status.js below. The reliability curve, the power line and the CURRENT / PRE-CHANGE stamp
     are all printed INSIDE status.js's winrate-backtest block, so they are the same figure in three
     sentences; withholding the verdict and keeping the curve would publish the result anyway. */
  const qb = held(WB);
  const b = qb ? null : readJson(WB);

  /* status.js prints the calibration curve, the power line and the CURRENT / PRE-CHANGE hash check.
     Those lines are the authority; taken verbatim. */
  const curve = qb ? null : statusLine(/^\s+when it says 90-100%.*$/m);
  const power = qb ? null : statusLine(/^\s+powered for MDE.*$/m);
  const currentL = qb ? null : statusLine(/^\s+(CURRENT|PRE-CHANGE) — (.*)$/m);
  /* THE VOID CLAUSE WAS NOT OPTIONAL IN THIS PATTERN AND THE WHOLE SLOT WENT DARK. status.js now
     prints `provenance: 13 unsafe, 1 void (declared), 46 possibly stale, 55 ok, 0 missing`; the
     pattern demanded `unsafe,` immediately followed by `possibly stale`, so it matched nothing and the
     board rendered "engine/provenance.js did not run under status.js" — which was false, and is the
     worst kind of NOT MEASURED because it accuses the wrong thing. The clause is now optional and its
     count is carried through rather than dropped. */
  const prov = statusLine(/provenance: (\d+) unsafe,(?: (\d+) void \(declared\),)? (\d+) possibly stale, (\d+) ok, (\d+) missing/);
  const refitClean = statusLine(/^\s+refit edge: (CLEAN|NOT DERIVED) — (.*)$/m);
  const refitOwed = statusLine(/^\s+REFIT OWED — weights fitted (.*)$/m);
  /* TWO SENTENCES, TWO MEANINGS, AND ONLY ONE OF THEM WAS BEING READ. Under a CLEAN refit status.js
     prints "(X moved DATE, but the feature function did not)"; under REFIT OWED it prints
     "moved after the fit: X  DATE". The board only knew the first, so on the day the refit went OWED
     the table silently emptied — a list that shrinks to nothing looks exactly like a list with
     nothing in it. Both are read, and each row records which sentence it came from, because
     "moved but the features did not" and "moved after the fit" are opposite readings. */
  const refitMoved = statusLines(/^\s+\((\S+) moved ([\d-]+ [\d:]+), but the feature function did not\)$/m)
    .map(m => ({ src: m[1], at: m[2], reading: 'moved, but the feature function did not' }))
    .concat(statusLines(/^\s+moved after the fit: (\S+) +([\d-]+ [\d:]+)$/m)
      .map(m => ({ src: m[1], at: m[2], reading: 'moved AFTER the fit' })));

  /* THE WEIGHTS ARE WITHHELD AND status.js SAYS SO IN ITS OWN SENTENCE, so the board says it too.
     This is not a figure — it is the statement that the fitted vector under every MAG number on this
     site is downstream of the simulator, and the refit that would clear it is gated behind ENGINE
     rather than behind compute. */
  const qw = held('data/policy-weights.json', 'data/policy-weights-joint.json');

  return {
    headline: qb ? withheld(qb, 'leaf calibration — the division\'s one number')
      : b ? fig(b.verdict, WB, { state: 'bad', label: 'leaf calibration' })
      : gap('data/winrate-backtest.json absent', 'MEASURE', 'leaf calibration'),
    n_games: qb ? withheld(qb, 'games scored') : b ? fig(b.n_games_scored, WB, { label: 'games scored' }) : gap('no backtest', 'MEASURE', 'games scored'),
    rollouts: qb ? withheld(qb, 'rollouts per game') : b ? fig(b.rollouts_per_game, WB, { label: 'rollouts per game' }) : gap('no backtest', 'MEASURE', 'rollouts'),
    curve: qb ? withheld(qb, 'reliability, extreme buckets')
      : curve ? fig(curve[0].trim(), SRC_STATUS, { state: 'bad', label: 'reliability, extreme buckets' })
      : gap('engine/status.js printed no reliability line', 'MEASURE', 'reliability curve'),
    power: qb ? withheld(qb, 'power')
      : power ? fig(power[0].trim(), SRC_STATUS, { label: 'power' })
      : gap('engine/status.js printed no power line', 'MEASURE', 'power'),

    /* THE STALENESS EDGE, MEASURE SIDE. The artifact stamps a content hash of every source the leaf
       reads, so this is a comparison and not an mtime guess. */
    build_standing: qb ? withheld(qb, 'is the leaf result about the build that exists now?')
      : currentL
      ? fig(currentL[1], SRC_STATUS, {
        state: currentL[1] === 'CURRENT' ? 'ok' : 'stale', label: 'build standing', note: currentL[2],
      })
      : gap('engine/status.js printed no CURRENT / PRE-CHANGE line', 'MEASURE', 'build standing'),

    /* NOT QUARANTINED, ON PURPOSE. provenance is a STALENESS VERDICT about the artifacts — it is one
       of the instruments that will say what has to be re-run when the gate opens, and withholding it
       would blind the page to the quarantine's own exit condition. status.js keeps printing it for
       the same reason. */
    provenance: prov
      ? {
        state: (+prov[1] > 0) ? 'bad' : (+prov[3] > 0 ? 'stale' : 'ok'), src: SRC_STATUS,
        unsafe: +prov[1], void_declared: prov[2] === undefined ? null : +prov[2],
        stale: +prov[3], ok: +prov[4], missing: +prov[5],
        note: 'engine/provenance.js is the canonical staleness authority; status.js prints its totals',
      }
      : gap('engine/provenance.js did not run under status.js', 'MEASURE', 'provenance'),

    /* THE REFIT LINE IS NOT A QUARANTINED FIGURE, and status.js says why in the same words: it is a
       claim ABOUT the weights rather than a quantity measured THROUGH them. The weights themselves
       are withheld, and that is the slot below. */
    refit: refitOwed
      ? fig('REFIT OWED', SRC_STATUS, { state: 'bad', label: 'refit edge', note: 'weights fitted ' + refitOwed[1] })
      : refitClean
        ? fig(refitClean[1], SRC_STATUS, {
          state: refitClean[1] === 'CLEAN' ? 'ok' : 'notmeasured', label: 'refit edge', note: refitClean[2],
        })
        : gap('engine/status.js printed no refit line', 'MEASURE', 'refit edge'),
    refit_owed: !!refitOwed,
    refit_moved: refitMoved,
    weights: qw ? withheld(qw, 'the fitted policy weights') : null,
  };
}

/* ================================================================= SEARCH ====================== */
function search(held) {
  const R1 = 'data/rollout-r1.json', R2 = 'data/rollout-cost.json', R3 = 'data/rollout-r3.json', R4 = 'data/rollout-r4.json';

  /* ALL FOUR RUNGS ARE DOWNSTREAM OF THE SIMULATOR TODAY, two because their generator is in the play
     layer and two because their generator reads a dump of games MEDICHAM played. R1 is asked about
     BOTH of its files for the reason status.js gives: the shipped arm (explore=1.0) has no row in the
     derived graph, they are the same measurement at two settings, and either being held holds the
     line. */
  const q1 = held(R1, 'data/rollout-r1-explore1.json'), q2 = held(R2), q3 = held(R3), q4 = held(R4);
  const r1 = q1 ? null : readJson(R1), r2 = q2 ? null : readJson(R2);
  const r3 = q3 ? null : readJson(R3), r4 = q4 ? null : readJson(R4);

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
      id: 'R1', q: 'leaf accuracy', src: R1, held: q1,
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
      id: 'R2', q: 'leaf cost', src: R2, held: q2,
      f: r2 && [fig(r2.boards, R2, { label: 'boards' }), fig(r2.games, R2, { label: 'games' })],
      generated: r2 && r2.generated,
    },
    {
      id: 'R3', q: 'divergence — does the search even disagree with the policy', src: R3, held: q3,
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
      id: 'R4', q: 'does it win', src: R4, held: q4,
      f: r4 && [
        fig(r4.arm1_share_pct, R4, { label: 'arm 1 share', unit: '%' }),
        fig(r4.decisive_pairs, R4, { label: 'decisive pairs — THE UNIT OF THE TEST' }),
        fig(r4.pairs, R4, { label: 'seed pairs' }),
        fig(r4.games, R4, { label: 'games' }),
      ],
      generated: r4 && r4.generated,
    },
  ].map(g => {
    /* THE QUARANTINE IS ASKED BEFORE THE ARTIFACT IS, so a withheld rung can never fall through into
       a value, and it is NOT collapsed into the NOT MEASURED branch below: "nobody ran this gate" and
       "this gate ran and the answer may not be quoted" send a reader to different places, and only
       the second one has a command that fixes it. */
    if (g.held) return { id: g.id, q: g.q, ...withheld(g.held, g.q) };
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
  const r4full = q4 ? withheld(q4, 'R4 — the headline result') : r4 ? {
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

  /* THE EXPLORE SWEEP. Its own artifact and its own row, because it is not a gate on the ladder — it
   * re-earns a DEFAULT that shipped citing a figure retracted on 2026-08-04 as uncheckable. It is the
   * first result on this board carrying a stamped engine release rather than an mtime, so the release
   * id is printed beside the verdict: unlike every PRE-CHANGE row below it, this one can say which
   * bytes it was measured against. Every value verbatim; the two arm accuracies sit side by side and
   * the difference is taken from the artifact's own paired_comparison rather than subtracted here.
   *
   * A STAMPED RELEASE IS NOT AN EXEMPTION FROM THE QUARANTINE, and this is the row where that is
   * tempting. It is the one result here that can name the exact bytes it was measured against — but
   * "which build" and "is that build CORRECT" are different questions, and the stamp answers only the
   * first. It is withheld like the rest. */
  const SW = 'data/rollout-r1-explore-sweep.json';
  const qsw = held(SW);
  const sw = qsw ? null : readJson(SW);
  const a1 = sw && sw.arms && sw.arms['explore_1.0'], a0 = sw && sw.arms && sw.arms['explore_0'];
  const pc = sw && sw.paired_comparison;
  const explore = qsw ? withheld(qsw, 'the --rollout-explore default, re-earned') : sw ? {
    state: 'ok', src: SW, at: mtimeIso(SW), generated: sw.generated,
    verdict: sw.verdict, verdict_code: sw.verdict_code,
    question: sw.question, what_this_is_not: sw.what_this_is_not,
    release: sw.engine_release, release_cut: sw.engine_release_cut,
    figs: [
      fig(a1 && a1.accuracy_pct, SW, { label: 'explore = 1.0 — position-judging accuracy', unit: '%' }),
      fig(a0 && a0.accuracy_pct, SW, { label: 'explore = 0, deterministic greedy', unit: '%' }),
      fig(pc && pc.diff_points, SW, {
        label: 'paired difference, points',
        note: pc && pc.ci95_pts ? '95% CI ' + pc.ci95_pts[0] + ' to ' + pc.ci95_pts[1]
          + ' — McNemar on ' + pc.discordant + ' discordant positions. ' + pc.build_caveat : undefined,
      }),
      fig(sw.sample && sw.sample.positions, SW, { label: 'positions, both arms, paired' }),
    ],
    caveats: sw.caveats,
  } : gap(SW + ' absent — nothing has re-earned the --rollout-explore default', 'SEARCH', 'the explore default');

  return {
    ladder,
    explore,
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
function ops(held) {
  const LIVE = 'data/live.js';
  /* NOT QUARANTINED, AND engine/quarantine.js DERIVES THAT RATHER THAN BEING TOLD IT. The stores are
     HUMAN replays OPS ingests — nothing MEDICHAM does can change a byte of them — so everything
     counted off them stays quotable while the gate is closed. Asked anyway, for the same reason as
     ENGINE's instruments: the exemption belongs to the module, not to this file. */
  const ql = held(LIVE);
  let live = null;
  if (!ql) try {
    live = JSON.parse(fs.readFileSync(D(LIVE), 'utf8').replace(/^\s*window\.LIVE\s*=\s*/, '').replace(/;\s*$/, ''));
  } catch (e) { /* NOT MEASURED below */ }

  const battles = statusLine(/live-games\/: (\d+) battles recorded/);
  /* THE TRAILING NOTE TRUNCATED THIS TABLE FROM THREE ROWS TO ONE. status.js annotates two of the
     three stores in-line ("<- the Force-OTS format, collected hourly", "<- FROZEN external import"),
     and the pattern was anchored to end-of-line straight after the timestamp, so only the unannotated
     row matched. A list that quietly loses two of its three entries is indistinguishable from a list
     with one entry — the exact shape of the missing-model hole one page over. The note is optional
     and is carried through verbatim rather than dropped. */
  const files = statusLines(/^ {2}(data\/\S+\.jsonl) +last written ([\d-]+ [\d:]+|—)(?: +<- ([^\n]*))?$/m)
    .map(m => ({ file: m[1], at: m[2], note: m[3] ? m[3].trim() : null }));

  const L = (v, label, opts) => ql ? withheld(ql, label) : live ? fig(v, LIVE, { label, ...(opts || {}) })
    : gap('data/live.js unreadable', 'OPS', label);

  return {
    games: L(live && live.games, 'games collected'),
    usable: L(live && live.usable, 'usable games'),
    usablePct: L(live && live.usablePct, 'usable', {
      unit: '%',
      /* NOT "the other 82%". 100 minus 18 is arithmetic, and arithmetic here is WEB authoring a
         number. The rest is described in words instead, and the definition is pointed at. */
      note: 'the remainder is bot games, forfeits and half-finished brings — data/quality-filter.json is the single definition of a usable game',
    }),
    teams: L(live && live.teams, 'teams'),
    turns: L(live && live.turns, 'clean turns'),
    dmgProfiles: L(live && live.dmgProfiles, 'move-damage profiles'),
    updated: L(live && live.updated, 'store updated'),
    battles: battles ? fig(battles[1], SRC_STATUS, { label: 'battles recorded in live-games/' })
      : gap('engine/status.js printed no live-games line', 'OPS', 'battles recorded'),
    files: files.length ? { state: 'ok', src: SRC_STATUS, rows: files }
      : gap('engine/status.js printed no store-file lines', 'OPS', 'store files'),
  };
}

/* ================================================================= WEB ========================= */
function web() {
  /* WEB's own number — "every rendered figure traces to an artifact" — was a NOT MEASURED slot on
     this board until 2026-08-04, about the board, because the division that polices drift does not
     get to exempt itself. It is now measured by web/figure-audit.js, which is the single
     implementation of what a figure is and what traced means; this file reads its result and the
     test reads the same function. Two scanners would eventually disagree — FACTS ARE GLOBAL.
     The percentage below is computed by the audit, which is that fact's generator, exactly as tag
     coverage is computed by engine/status.js and taken verbatim here rather than re-derived. */
  const rooms = fs.readdirSync(D('web')).filter(f => f.endsWith('.html')).sort()
    .map(f => ({ file: 'web/' + f, at: mtimeIso('web/' + f) }));
  const guard = fs.existsSync(D('tests', 'test-stadium-roster.js'));
  const guard2 = fs.existsSync(D('tests', 'test-web-status.js'));
  const guard3 = fs.existsSync(D('tests', 'test-web-figures.js'));

  let fa = null, faErr = null;
  try { fa = require('./figure-audit.js').audit(); } catch (e) { faErr = (e.message || String(e)).split('\n')[0]; }

  return {
    rooms: { state: 'ok', src: 'web/ directory listing', rows: rooms },
    guards: [
      { name: 'tests/test-stadium-roster.js', what: 'the Stadium cabinet rack against docs/MODELS.md', present: guard },
      { name: 'tests/test-web-status.js', what: 'this board against its artifacts', present: guard2 },
      { name: 'tests/test-web-figures.js', what: 'the share of rendered figures that cite an artifact', present: guard3 },
    ],
    traceability: fa
      ? fig(fa.pct, 'web/figure-audit.js', {
        label: 'rendered figures that cite an artifact', unit: '%',
        /* Below half is bad and is stated as bad. A metric introduced at a flattering value would
           not have been worth introducing. */
        state: fa.pct >= 50 ? 'ok' : 'bad',
        note: fa.traced + ' of ' + fa.denom + ' hardcoded figures in visible page text sit on a line that names '
          + 'their artifact. ' + fa.withdrawn + ' more are struck out as withdrawn and ' + fa.placeholders
          + ' are live placeholders, both out of the denominator. Interpolated figures are excluded — they '
          + 'are read from a bundled artifact at render time and cannot drift. Definitions: web/figure-audit.js.',
      })
      : gap('web/figure-audit.js did not run — ' + faErr, 'WEB', 'figures traceable to an artifact'),
    traceability_pages: fa
      ? {
        state: 'ok', src: 'web/figure-audit.js',
        rows: fa.pages.map(p => ({ file: p.file, pct: p.pct, traced: p.traced, denom: p.denom, withdrawn: p.withdrawn })),
      }
      : gap('web/figure-audit.js did not run', 'WEB', 'per-page traceability'),
    traceability_open: fa
      ? { state: fa.untraced ? 'bad' : 'ok', src: 'web/figure-audit.js',
        rows: fa.pages.reduce((a, p) => a.concat(p.open.map(o => ({ file: p.file, n: o.n, tok: o.tok, ctx: o.ctx }))), []).slice(0, 40) }
      : gap('web/figure-audit.js did not run', 'WEB', 'untraced figures'),
  };
}

/* ================================================================= THE GATE BLOCK ==============
 * The gate itself is rendered, not just obeyed. A page that silently drops five figures teaches a
 * visitor nothing; a page that says WHY they are gone, which clauses fail and what re-opens them is
 * the same information the terminal gives. Every string here is read out of engine/quarantine.js. */
function quarantineBlock(gate, rows, err) {
  if (err || !gate || !rows) {
    /* THE FAILURE-TO-COMPUTE CASE IS LOUD AND FAILS OPEN, exactly as engine/status.js does — it
       records a note and withholds nothing. Failing CLOSED here would be worse than it sounds: it
       would blank the whole board on a bad graph read and look identical to a working quarantine, so
       nobody would find out the classifier had broken. The banner says the gate was not computed. */
    return { state: 'notmeasured', src: 'engine/quarantine.js',
      why: 'the quarantine gate could not be computed, so NOTHING was withheld and every figure below '
         + 'may be a number that should not be published: ' + (err || 'no gate returned'),
      owner: 'MEASURE' };
  }
  return {
    state: gate.ok ? 'ok' : 'bad', src: 'engine/quarantine.js',
    open: gate.ok,
    clauses: gate.clauses.map(c => ({ name: c.name, ok: !!c.ok, why: String(c.why || '').replace(/\s+/g, ' ') })),
    failing: gate.failing.map(c => c.name),
    n_quarantined: [...rows.values()].filter(r => r.quarantined).length,
    n_artifacts: rows.size,
    rule: 'CLAUDE.md — EVERYTHING DOWNSTREAM OF MEDICHAM IS QUARANTINED UNTIL MEDICHAM IS CORRECT. '
        + 'Will, 2026-08-08: "all engines that take medicham\'s output should be regarded as out of '
        + 'date and we should stop referencing them until medicham is up to date and we can rerun them."',
    derivation: 'node engine/quarantine.js --graph',
  };
}

/* ================================================================= EMIT ========================
 * ONE FUNCTION, AND THE WITHHOLDER IS ITS ARGUMENT. `tests/test-web-quarantine.js` calls this twice —
 * once with the real gate and once with a synthetic OPEN one — and asserts the five figures vanish
 * and then come back. That is the shape engine/quarantine.js's own selftest uses, and it is the only
 * way to tell a working quarantine from a page that has simply lost the ability to print a number. */
function buildPayload(held, gateBlock) {
  return {
    built_at: new Date().toISOString(),
    built_by: 'web/build-status.js',
    status_js_ok: !!STATUS_TEXT,
    status_js_error: STATUS_ERR,
    /* THE RAW HANDOFF IS SAFE TO EMBED BECAUSE status.js WITHHOLDS AT SOURCE. It prints
       "QUARANTINED — the figure is withheld, not annotated." where the verdicts used to be, so
       copying its output verbatim cannot reintroduce one. If that ever stops being true, the leak
       shows up here first and tests/test-web-quarantine.js scans this string for it. */
    status_raw: STATUS_TEXT || null,
    quarantine: gateBlock,
    engine: engine(held),
    measure: measure(held),
    search: search(held),
    ops: ops(held),
    web: web(),
  };
}

module.exports = { buildPayload, makeHeld, quarantineBlock, gate: () => QGATE, rows: () => QROWS, error: () => QERR };

if (require.main === module) {
  const withhold = QUARANTINE.withholder(QGATE || { ok: true, clauses: [], failing: [] }, QROWS);
  const payload = buildPayload(makeHeld(QROWS ? withhold : null), quarantineBlock(QGATE, QROWS, QERR));

  const banner = '/* web/status-data.js — GENERATED by web/build-status.js. Do not hand-edit.\n' +
    ' * Every value is either a scalar read verbatim out of a data/*.json artifact or a line printed by\n' +
    ' * node engine/status.js. Nothing in here was computed, rounded or averaged by the WEB division.\n' +
    ' * Regenerate:  node web/build-status.js\n' +
    ' *\n' +
    ' * QUARANTINE: a slot with "state":"quarantined" carries NO value on purpose. Its artifact is\n' +
    ' * downstream of engine/medicham2-browser.js and CLAUDE.md withholds it until MEDICHAM is correct.\n' +
    ' * The membership test and the gate are engine/quarantine.js\'s, not this file\'s. A caption is not\n' +
    ' * a quarantine, so the number is ABSENT rather than annotated -- the slot carries the artifact,\n' +
    ' * the reason, the failing clauses and the command that re-runs it.\n' +
    ' *\n' +
    ' * RAW-STORE-OK: the store figures on this board are line counts and mtimes of the RAW corpora,\n' +
    ' * copied verbatim from `node engine/status.js`. Filtering them for clean games would defeat the\n' +
    ' * point -- a visitor needs to see which stores are still COLLECTING, which is a fact about the\n' +
    ' * raw file and not about what survives quality.js. The clean count sits beside them, sourced\n' +
    ' * separately from live.js and labelled as such.\n' +
    ' */\n';
  fs.writeFileSync(D('web', 'status-data.js'), banner + 'window.ABRA_BOARD = ' + JSON.stringify(payload, null, 1) + ';\n');

  const s = JSON.stringify(payload);
  const notmeasured = s.split('"state":"notmeasured"').length - 1;
  const heldN = s.split('"state":"quarantined"').length - 1;
  console.log('wrote web/status-data.js');
  console.log('  engine/status.js: ' + (STATUS_TEXT ? 'ran' : 'FAILED — ' + STATUS_ERR));
  console.log('  NOT MEASURED slots: ' + notmeasured);
  if (QERR) {
    console.log('  QUARANTINE GATE NOT COMPUTED — ' + QERR);
    console.log('    Nothing was withheld. The board says so at the top; do not publish it until this reads.');
  } else {
    console.log('  quarantine gate: ' + (QGATE.ok ? 'OPEN — nothing withheld'
      : 'CLOSED (' + QGATE.failing.length + ' of ' + QGATE.clauses.length + ' clauses fail)'));
    console.log('  WITHHELD slots: ' + heldN);
  }
}
