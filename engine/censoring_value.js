/* censoring_value.js — did learning from the outplayed turns change how the model plays them?
 *
 *   SHOWDOWN_PATH=... node --max-old-space-size=6144 engine/censoring_value.js
 *     WEIGHTS_NEW=data/policy-weights.json     the refit under docs/CLICK-CENSORING-FIX.md
 *     WEIGHTS_OLD=<pre-censoring copy>         the incumbent, fitted with the poison in it
 *     BOOT=10000  MAXG=0
 *   ->  data/censoring-value.json
 *
 * docs/CLICK-CENSORING-FIX.md Stage D, and the spec is unusually specific about which number to
 * report, so it is worth quoting:
 *
 *     "No claim that the recovered turns improve overall top-1 — the class is ~5% of turns; the
 *      honest expectation is a real likelihood gain concentrated on redirection/Encore contexts, and
 *      Stage D's CLASS-CONDITIONAL number is the one to watch, not the corpus-wide average."
 *
 * So the corpus-wide contrast is computed and printed as a CONTROL, and the headline is what the two
 * models do on the turns the fix is about. Reporting a corpus-wide top-1 improvement here would be
 * exactly the thing the spec disclaims in advance.
 *
 * THE THREE CLASSES, AND WHY EACH IS SCORED DIFFERENTLY
 * ----------------------------------------------------
 *   CLEAN    the recorded action is the click. Ordinary log-likelihood and top-1. This is the
 *            control: neither arm should move much, because nothing about these rows changed.
 *   PARTIAL  a redirector soaked the attack, so the click is one of a known set. The measurable
 *            quantity is the MASS the model puts on that set, and whether its argmax lands inside
 *            it. Scoring against "the redirector" would be scoring against the very label this fix
 *            says is wrong.
 *   COERCED  there is NO human click — Encore replaced it, or the mon was dragged in. Agreement is
 *            undefined and no agreement number is invented for it. What IS measurable, and is the
 *            direct behavioural proof, is P(the model picks the coerced action). The old weights
 *            were trained on these rows as though a human had chosen them; if that poison was
 *            learned, the old arm puts more probability there than the new one.
 *
 * ONE PROCESS, ONE ROW BUILD, BOTH ARMS. `engine/tags.js` loads data/tags.json once per process with
 * no way to pin it, and two processes could differ by the tag database as well as by the weights.
 * `decisionsFor(..., {keepCoerced:true})` emits every class in a single replay, so the arms cannot
 * be built from different walks.
 *
 * NO ENGINE RELEASE IS OPENED, DELIBERATELY. engine_release.js exists so a measurement can read a
 * frozen tree while another division edits the live one. This measurement is OF a live-tree change —
 * the point is the new engine/click_class.js and the weights fitted under it — so freezing would
 * measure the thing it is trying to test. Every source it depends on is digested before and after
 * instead, and a source that moves mid-run marks the artifact `void: true`, the same convention
 * engine/sheet_channel_value.js uses.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FP = require('./fit_policy.js');
const B = require('./board.js');
const CS = require('./champions_sim.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const OUT = D('data', 'censoring-value.json');
const BOOT = +(process.env.BOOT || 10000);
const MAXG = +(process.env.MAXG || 0);

const SOURCES = ['engine/fit_policy.js', 'engine/click_class.js', 'engine/click_match.js',
  'engine/board.js', 'engine/sheet_channels.js', 'engine/quality.js', 'engine/medicham2-browser.js',
  'data/tags.json', 'data/engine-data.js', 'data/move-priors.json'];

const sha12 = p => {
  try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12); }
  catch (e) { console.error(`  sha12: cannot read ${p} (${e.message}) — recorded null`); return null; }
};

const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const isHeldOut = id => hash(String(id || '')) % 5 === 0;

function loadW(p, label) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const w = j[j.shipped || 'weights'] || j.weights;
  if (!Array.isArray(w) || w.length !== B.FEATURES.length) {
    throw new Error(`${label} (${p}) has ${Array.isArray(w) ? w.length : 'no'} weights against ${B.FEATURES.length} features`);
  }
  if (Array.isArray(j.features)) {
    const bad = j.features.findIndex((f, i) => f !== B.FEATURES[i]);
    if (bad >= 0) throw new Error(`${label}: feature ${bad} is '${j.features[bad]}' in the artifact and '${B.FEATURES[bad]}' in board.js`);
  }
  return { w, meta: j };
}

/* Softmax over the candidate list, max-subtracted. Returns everything the three classes need from
 * one pass so a row is never scored twice with two slightly different loops. */
function probe(feats, chosen, cset, w) {
  let mx = -Infinity, bestI = -1, best = -Infinity;
  const s = new Array(feats.length);
  for (let i = 0; i < feats.length; i++) {
    let v = 0; const x = feats[i];
    for (let k = 0; k < w.length; k++) v += w[k] * x[k];
    s[i] = v;
    if (v > mx) mx = v;
    if (v > best) { best = v; bestI = i; }
  }
  let z = 0;
  for (let i = 0; i < s.length; i++) z += Math.exp(s[i] - mx);
  const pOf = i => Math.exp(s[i] - mx) / z;
  let setMass = 0;
  if (cset) for (const c of cset) setMass += pOf(c);
  return {
    ll_chosen: (s[chosen] - mx) - Math.log(z),
    p_chosen: pOf(chosen),
    top1_chosen: bestI === chosen ? 1 : 0,
    ll_set: cset ? Math.log(setMass) : null,
    p_set: cset ? setMass : null,
    top1_in_set: cset ? (cset.includes(bestI) ? 1 : 0) : null,
  };
}

function main() {
  console.log('CLICK-CENSORING VALUE — what changed on the turns the model used to get wrong\n');
  const before = {}; for (const f of SOURCES) before[f] = sha12(D(f));

  const WNEW = process.env.WEIGHTS_NEW || D('data', 'policy-weights.json');
  /* THE INCUMBENT IS IN THE REPO NOW, and the refusal below stays anyway.
   *
   * The 3.42.0 run compared against a copy living in a SESSION SCRATCHPAD — a temp directory that
   * gets cleaned. A published number whose input exists only in temp is not reproducible by anyone,
   * including us, one cleanup later. It is preserved as data/policy-weights-pre-censoring.json,
   * sha12 01bc43936324, which is the digest the artifact itself records.
   *
   * Still no default. Refusing to guess is right: silently picking a baseline is how a comparison
   * ends up measuring something nobody chose. The hint just says where the obvious one is. */
  const WOLD = process.env.WEIGHTS_OLD;
  if (!WOLD) {
    console.error('WEIGHTS_OLD must name the pre-censoring incumbent. Refusing to guess.');
    console.error('  The 3.42.0 baseline is preserved at data/policy-weights-pre-censoring.json (sha12 01bc43936324).');
    console.error('  BEFORE re-running against it, read docs/MEASURE.md on the engine confound: both vectors were');
    console.error('  fitted under the pre-WIRE-114 engine, so scoring them through the current one breaks the');
    console.error('  fitting-environment rule and measures the censoring change plus three wires at once.');
    process.exit(1);
  }
  const wNew = loadW(WNEW, 'new'), wOld = loadW(WOLD, 'old');
  const l2 = Math.sqrt(wNew.w.reduce((a, v, i) => a + (v - wOld.w[i]) ** 2, 0));
  console.log(`  old ${path.relative(ROOT, WOLD)}  fitted ${wOld.meta.generated}`);
  console.log(`  new ${path.relative(ROOT, WNEW)}  fitted ${wNew.meta.generated}`);
  console.log(`  |new - old|_2 = ${l2.toFixed(4)}`);
  if (l2 === 0) { console.error('the two vectors are IDENTICAL — nothing to measure. Refusing.'); process.exit(1); }

  const { games } = FP.loadCorpus();
  let held = games.filter(g => g.id && isHeldOut(g.id));
  if (MAXG) held = held.slice(0, MAXG);
  console.log(`  corpus ${games.length.toLocaleString()} clean open-sheet games -> ${held.length.toLocaleString()} held out\n`);

  /* per game -> per class -> per arm sums. Only sums are retained, so the whole held-out set never
   * has to be in memory at once. */
  const CLASSES = ['clean', 'partial', 'coerced'];
  const ARMS = ['old', 'new'];
  const per = new Map();
  const blank = () => {
    const o = { n: 0 };
    for (const c of CLASSES) { o[c] = { n: 0 }; for (const a of ARMS) o[c][a] = { ll: 0, top1: 0, p: 0 }; }
    return o;
  };

  const tally = { seen: 0, kept: 0, noUser: 0, noSheet: 0, trivial: 0, unmatched: 0, ambiguous: 0, coerced: 0 };
  let gi = 0;
  for (const g of held) {
    gi++;
    if (gi % 250 === 0) process.stdout.write(`\r  scoring ${gi}/${held.length}`);
    const rows = FP.decisionsFor(g, tally, null, { keepCoerced: true });
    if (!rows.length) continue;
    let rec = per.get(g.id);
    if (!rec) { rec = blank(); per.set(g.id, rec); }
    for (const r of rows) {
      const cls = r.coerced ? 'coerced' : (r.cset && r.cset.length > 1 ? 'partial' : 'clean');
      rec.n++; rec[cls].n++;
      for (const a of ARMS) {
        const p = probe(r.feats, r.chosen, cls === 'partial' ? r.cset : null, a === 'old' ? wOld.w : wNew.w);
        const slot = rec[cls][a];
        if (cls === 'partial') { slot.ll += p.ll_set; slot.top1 += p.top1_in_set; slot.p += p.p_set; }
        else { slot.ll += p.ll_chosen; slot.top1 += p.top1_chosen; slot.p += p.p_chosen; }
      }
    }
  }
  process.stdout.write('\r' + ' '.repeat(50) + '\r');

  const ids = [...per.keys()];
  const cache = ids.map(id => per.get(id));
  const total = c => cache.reduce((a, r) => a + r[c].n, 0);
  const counts = {}; for (const c of CLASSES) counts[c] = total(c);
  const N = CLASSES.reduce((a, c) => a + counts[c], 0);
  console.log(`  ${N.toLocaleString()} held-out decisions over ${ids.length.toLocaleString()} games`);
  console.log(`  clean ${counts.clean.toLocaleString()}   PARTIAL ${counts.partial.toLocaleString()}   COERCED ${counts.coerced.toLocaleString()}\n`);
  for (const c of CLASSES) {
    if (counts[c] === 0) {
      console.error(`ZERO ${c.toUpperCase()} ROWS in the held-out set. A class-conditional number cannot be`);
      console.error('computed on an empty class, and reporting the corpus-wide average instead is exactly what');
      console.error('docs/CLICK-CENSORING-FIX.md §4 disclaims. Refusing to write.');
      process.exit(1);
    }
  }

  const meanOf = (cls, arm, list) => {
    let ll = 0, t1 = 0, p = 0, n = 0;
    for (const r of list) { ll += r[cls][arm].ll; t1 += r[cls][arm].top1; p += r[cls][arm].p; n += r[cls].n; }
    return n ? { ll: ll / n, top1: 100 * t1 / n, p: p / n, n } : { ll: NaN, top1: NaN, p: NaN, n: 0 };
  };

  const point = {};
  for (const c of CLASSES) { point[c] = {}; for (const a of ARMS) point[c][a] = meanOf(c, a, cache); }

  /* ---- bootstrap over GAMES. One resample drives every class and both arms, so the contrasts
   * share their resampling noise the way the decisions share their games. -------------------- */
  const draws = {}; for (const c of CLASSES) draws[c] = { ll: [], top1: [], p: [] };
  const G = ids.length;
  for (let b = 0; b < BOOT; b++) {
    const acc = {}; for (const c of CLASSES) { acc[c] = { n: 0 }; for (const a of ARMS) acc[c][a] = { ll: 0, t1: 0, p: 0 }; }
    for (let i = 0; i < G; i++) {
      const r = cache[(Math.random() * G) | 0];
      for (const c of CLASSES) {
        acc[c].n += r[c].n;
        for (const a of ARMS) { acc[c][a].ll += r[c][a].ll; acc[c][a].t1 += r[c][a].top1; acc[c][a].p += r[c][a].p; }
      }
    }
    for (const c of CLASSES) {
      const n = Math.max(1, acc[c].n);
      draws[c].ll.push(acc[c].new.ll / n - acc[c].old.ll / n);
      draws[c].top1.push(100 * acc[c].new.t1 / n - 100 * acc[c].old.t1 / n);
      draws[c].p.push(acc[c].new.p / n - acc[c].old.p / n);
    }
  }
  const ci = arr => { const s = arr.slice().sort((p, q) => p - q); return [s[Math.floor(0.025 * s.length)], s[Math.floor(0.975 * s.length)]]; };
  const contrasts = {};
  for (const c of CLASSES) {
    contrasts[c] = {};
    for (const k of ['ll', 'top1', 'p']) {
      const pt = k === 'll' ? point[c].new.ll - point[c].old.ll
        : k === 'top1' ? point[c].new.top1 - point[c].old.top1
          : point[c].new.p - point[c].old.p;
      const iv = ci(draws[c][k]);
      contrasts[c][k] = { point: pt, ci95: iv, excludes_zero: iv[0] > 0 || iv[1] < 0 };
    }
  }

  /* ---- THE NOISE FLOOR, per class, on the NEW arm alone -----------------------------------
   * Split the shipping arm's own games in half twenty times and measure the spread. An effect
   * smaller than this is not an effect. Computed inside one arm, so it carries no information
   * about the contrast — which is the point. Per class, because the classes have wildly different
   * sample sizes and one global floor would flatter the small ones. */
  const floors = {};
  for (const c of CLASSES) {
    const cuts = [];
    for (let k = 0; k < 20; k++) {
      const shuf = cache.slice();
      for (let i = shuf.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [shuf[i], shuf[j]] = [shuf[j], shuf[i]]; }
      const h = shuf.length >> 1;
      const a = meanOf(c, 'new', shuf.slice(0, h)), b2 = meanOf(c, 'new', shuf.slice(h));
      if (a.n && b2.n) cuts.push({ top1: Math.abs(a.top1 - b2.top1), ll: Math.abs(a.ll - b2.ll), p: Math.abs(a.p - b2.p) });
    }
    const med = arr => { const s = arr.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
    floors[c] = {
      cuts: cuts.length,
      top1_median: med(cuts.map(x => x.top1)), top1_range: [Math.min(...cuts.map(x => x.top1)), Math.max(...cuts.map(x => x.top1))],
      ll_median: med(cuts.map(x => x.ll)), p_median: med(cuts.map(x => x.p)),
    };
  }

  /* ---- report ---------------------------------------------------------------------------- */
  const WHAT = {
    clean: 'CONTROL — the recorded action is the click; nothing about these rows changed',
    partial: 'HEADLINE — a redirector soaked the attack; scored on the CANDIDATE SET',
    coerced: 'HEADLINE — no human click exists; P(model picks the coerced action), LOWER IS BETTER',
  };
  for (const c of CLASSES) {
    console.log(`${c.toUpperCase()}  n=${counts[c].toLocaleString()}   ${WHAT[c]}`);
    for (const a of ARMS) {
      console.log(`  ${a === 'old' ? 'before' : 'after '}  logL ${point[c][a].ll.toFixed(6)}   ` +
        `${c === 'partial' ? 'argmax-in-set' : 'top-1'} ${point[c][a].top1.toFixed(3)}%   ` +
        `mean p ${point[c][a].p.toFixed(6)}`);
    }
    const k = contrasts[c];
    console.log(`  after - before   logL ${k.ll.point >= 0 ? '+' : ''}${k.ll.point.toFixed(6)} [${k.ll.ci95[0].toFixed(6)}, ${k.ll.ci95[1].toFixed(6)}]${k.ll.excludes_zero ? '  CLEARS ZERO' : '  contains zero'}`);
    console.log(`                   p    ${k.p.point >= 0 ? '+' : ''}${k.p.point.toFixed(6)} [${k.p.ci95[0].toFixed(6)}, ${k.p.ci95[1].toFixed(6)}]${k.p.excludes_zero ? '  CLEARS ZERO' : '  contains zero'}`);
    console.log(`                   pts  ${k.top1.point >= 0 ? '+' : ''}${k.top1.point.toFixed(3)} [${k.top1.ci95[0].toFixed(3)}, ${k.top1.ci95[1].toFixed(3)}]${k.top1.excludes_zero ? '  CLEARS ZERO' : '  contains zero'}`);
    console.log(`  NOISE FLOOR (20 split-half cuts of the AFTER arm alone): ${floors[c].top1_median.toFixed(3)} pts median, ` +
      `logL ${floors[c].ll_median.toFixed(6)}, p ${floors[c].p_median.toFixed(6)}\n`);
  }

  const after = {}; for (const f of SOURCES) after[f] = sha12(D(f));
  const moved = SOURCES.filter(f => before[f] !== after[f]);
  if (moved.length) {
    console.error(`  SOURCES MOVED WHILE THIS RAN: ${moved.join(', ')}`);
    console.error('  The measurement is not a photograph of one build. Recorded as void:true.');
  }

  const art = {
    generated: new Date().toISOString(),
    source: 'engine/censoring_value.js',
    question: 'Does removing the coerced labels and keeping the redirected turns under a marginal '
            + 'likelihood change what the model does ON THOSE TURNS?',
    headline: 'The class-conditional contrasts are the result. docs/CLICK-CENSORING-FIX.md §4 '
            + 'disclaims a corpus-wide top-1 improvement in advance, so the clean-class row is a '
            + 'CONTROL and must not be quoted as a headline.',
    no_engine_release: 'Deliberate: this measures a live-tree change, so freezing the tree would '
                     + 'measure the thing being tested. Source digests are taken before and after.',
    /* THE CANONICAL KEY TOO, not only the before/after pair.
     * `engine/provenance.js` looks for `source_digests` and nothing else, so an artifact that
     * carefully recorded its inputs under a bespoke name read to the ratchet as an artifact with no
     * digests at all — it fell to "rests on mtime alone" while carrying better evidence than most
     * files that pass. Recording something correctly under a name the checker cannot see is the same
     * outcome as not recording it. `after` is the canonical set: it is the tree the reported result
     * was produced against. The before/after pair stays, because the DIFFERENCE is this run's whole
     * subject and one snapshot cannot express it. */
    source_digests: after,
    source_digests_before: before,
    source_digests_after: after,
    showdown_path_set: !!process.env.SHOWDOWN_PATH,
    format: CS.FORMAT,
    weights: {
      old: { path: path.relative(ROOT, WOLD), generated: wOld.meta.generated, sha256_12: sha12(WOLD), shipped: wOld.meta.shipped || 'weights' },
      new: { path: path.relative(ROOT, WNEW), generated: wNew.meta.generated, sha256_12: sha12(WNEW), shipped: wNew.meta.shipped || 'weights' },
      l2_new_minus_old: l2,
    },
    corpus: { clean_open_sheet_games: games.length, held_out_games: ids.length,
              split: 'hash(game.id) % 5 === 0, identical to engine/fit_policy.js' },
    class_counts: counts,
    /* WHICH WEIGHTS MOVED, published rather than left to a reader to diff two files.
     * The mechanism claim in docs/MEASURE.md §14 rests on WHICH weights moved, not on the L2, and a
     * claim whose evidence is not in any artifact is one nobody can check. Standard errors come from
     * the NEW fit, which is the sample the movement has to be judged against. */
    weights_moved: (() => {
      const se = (wNew.meta.standardErrors || []);
      return B.FEATURES.map((f, i) => ({
        feature: f, before: wOld.w[i], after: wNew.w[i], delta: wNew.w[i] - wOld.w[i],
        se: se[i] != null ? se[i] : null,
        z: se[i] > 0 ? Math.abs(wNew.w[i] - wOld.w[i]) / se[i] : null,
      })).filter(r => r.z != null && r.z >= 2).sort((a, b) => b.z - a.z);
    })(),
    arms: point,
    contrasts,
    noise_floor: floors,
    bootstrap: { resamples: BOOT, unit: 'game', note: 'one resample drives every class and both arms' },
    n_measured: N,
    n_unit: 'held-out decisions, paired across arms',
    scoring_rules: {
      clean: 'log P(recorded click) and whether the argmax is it',
      partial: 'log SUM P(c) over the candidate set, and whether the argmax lands inside it. Scoring '
             + 'against the recorded target would be scoring against the label this fix calls wrong.',
      coerced: 'P(the coerced action). There is no human click here, so no agreement number is '
             + 'invented; a DROP in this probability is the poison being unlearned.',
    },
    caveats: [
      'Top-1 agreement with a human click is NOT a win rate. Whether MILTANK plays better is an H2H and belongs to SEARCH.',
      'Every game here is an OPEN-SHEET game.',
      'The COERCED class has no ground-truth label by construction, so its contrast measures a change '
      + 'in the model, not an improvement in accuracy. It cannot be otherwise.',
    ],
  };
  if (moved.length) { art.void = true; art.void_reason = 'sources moved during the run: ' + moved.join(', '); }
  fs.writeFileSync(OUT, JSON.stringify(art, null, 1) + '\n');
  console.log(`  -> ${path.relative(ROOT, OUT)}`);
}

if (require.main === module) main();
