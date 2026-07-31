/* artifact_audit.js — DOES EVERY FACT ACTUALLY REACH THE ARTIFACT THAT CARRIES IT?
 *
 * WHY THIS EXISTS (Will, 2026-07-30: "arent we making sure all fixes get applied to every
 * applicaiton? how was this not caught? i want a thorough audit")
 *
 * It was not caught because the rule this project already has covers a different axis. "FEATURES ARE
 * PER-MODEL, FACTS ARE GLOBAL" governs a fact reaching every MODEL. This is a fact failing to reach
 * an ARTIFACT: data/mega-dex-official.json carries an ability for all 340 formes, engine/
 * merge_mega_into_engine.js exists precisely to apply them, and data/engine-data.js has `ab: null`
 * on all 57 mega entries. The builder's output was overwritten by a later regeneration and NOTHING
 * asserted it was still there.
 *
 * That is the gap class this file closes: a DERIVED ARTIFACT is never checked against the SOURCE it
 * was derived from. A build step can be silently undone and every downstream consumer keeps running
 * on a null.
 *
 * Three checks, each of which would have caught the mega hole on its own:
 *
 *   A  COHORT COMPLETENESS   A field that is null for ~100% of one cohort and ~0% of another is a
 *                            build gap, not a property of the game. No source needed: the artifact
 *                            is inconsistent with ITSELF. This is the cheapest and most general
 *                            check here and it needs no knowledge of what built what.
 *
 *   B  SOURCE HAS IT, ARTIFACT DOES NOT   For every artifact key, look the same entity up in the
 *                            declared source and report fields the source could have filled and did
 *                            not. Reported WEIGHTED BY USAGE, because a hole on Staraptor-Mega is
 *                            not the same size as a hole on something nobody brings.
 *
 *   C  KEY CONVENTION        A builder that writes `charizardmegax` into an artifact keyed
 *                            `charizard-mega-x` does not update the entry, it ADDS a second one.
 *                            Re-running such a builder to "fix" a gap doubles the dex instead. This
 *                            check is what makes the repair safe to attempt.
 *
 * Findings are reported, never repaired. This file writes nothing.
 *
 *   node engine/artifact_audit.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

require(D('data', 'engine-data.js'));

const rd = f => { try { return JSON.parse(fs.readFileSync(D('data', f), 'utf8')); } catch (e) { return null; } };
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';

let problems = 0;
const flag = (sev, msg) => { if (sev === 'GAP') problems++; console.log(`  ${sev === 'GAP' ? 'GAP ' : 'ok  '} ${msg}`); };

console.log('ARTIFACT AUDIT — does every fact reach the artifact that carries it?\n');

/* ---- usage weights, so a hole is reported at the size it actually is ------------------------- */
const USAGE = (rd('smogon-priors.json') || {}).species || {};
const rawOf = k => {
  const v = USAGE[k] || USAGE[norm(k)] || null;
  return v && v.raw > 0 ? v.raw : 0;
};
const TOTAL_USAGE = Object.values(USAGE).reduce((s, v) => s + (v && v.raw > 0 ? v.raw : 0), 0);

/* ---------------------------------------------------------------------------------------------
 * A. COHORT COMPLETENESS — the artifact against itself
 * ------------------------------------------------------------------------------------------- */
console.log('A. COHORT COMPLETENESS — a field null for one whole cohort and no other is a build gap');

const mons = MC.mons || {};
const keys = Object.keys(mons);
/* The cohort split is read off the KEY SHAPE rather than off a `.mega` flag, because the missing
 * flag is itself one of the symptoms — the builder that sets `mega: true` is the one whose output
 * went missing, so trusting the flag would hide exactly the case being looked for. */
const isMega = k => /-(mega|primal)(-|$)/i.test(k);
const cohorts = { mega: keys.filter(isMega), other: keys.filter(k => !isMega(k)) };

/* `bs` is here because it was NOT, and that omission shipped a bug. The 2026-07-30 mega repair wrote
 * `st` (the level-50 line) and forgot `bs` (base stats) on the 19 entries it newly added; buildMon
 * opens with `if(!m||!m.bs) return null`, so those formes could not be built by the damage engine at
 * all. This list is the audit's entire field of view — anything missing from it is invisible, which
 * is the failure mode the audit exists to prevent, so it is kept deliberately wide. */
const FIELDS = ['ab', 'mv', 'item', 't', 'st', 'bs', 'wt'];
const empty = (v) => v == null || (Array.isArray(v) && !v.length) ||
  (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

console.log(`     cohorts: ${cohorts.mega.length} mega/primal, ${cohorts.other.length} other\n`);
console.log(`     ${'field'.padEnd(8)}${'mega null'.padStart(14)}${'other null'.padStart(14)}   verdict`);
console.log('     ' + '-'.repeat(60));
for (const f of FIELDS) {
  const mn = cohorts.mega.filter(k => empty(mons[k][f])).length;
  const on = cohorts.other.filter(k => empty(mons[k][f])).length;
  const mr = cohorts.mega.length ? mn / cohorts.mega.length : 0;
  const or = cohorts.other.length ? on / cohorts.other.length : 0;
  /* A field the whole format lacks is a modelling choice; a field ONE cohort lacks is a build gap. */
  const gap = mr > 0.9 && or < 0.5;
  console.log(`     ${f.padEnd(8)}${(mn + ' (' + pct(mn, cohorts.mega.length) + ')').padStart(14)}` +
    `${(on + ' (' + pct(on, cohorts.other.length) + ')').padStart(14)}   ${gap ? '<< BUILD GAP' : ''}`);
  if (gap) problems++;
}

/* The size of the hole, in the only unit that matters. */
const megaRaw = cohorts.mega.reduce((s, k) => s + rawOf(k), 0);
console.log(`\n     the mega cohort is ${pct(megaRaw, TOTAL_USAGE)} of format usage ` +
  `(${megaRaw.toLocaleString()} of ${TOTAL_USAGE.toLocaleString()})`);

/* ---------------------------------------------------------------------------------------------
 * B. SOURCE HAS IT, ARTIFACT DOES NOT
 * ------------------------------------------------------------------------------------------- */
console.log('\nB. SOURCE HAS IT, ARTIFACT DOES NOT');

/* Declared source -> artifact mappings. Each entry says which file is supposed to fill which field,
 * so a new builder is registered here rather than discovered by reading code. */
const SOURCES = [
  {
    source: 'mega-dex-official.json', builder: 'engine/merge_mega_into_engine.js',
    rows: () => (rd('mega-dex-official.json') || {}).forms || {},
    /* The builder's own guard, restated: it skips anything not in the store and anything that is not
     * a mega or primal forme. Kept in step with merge_mega_into_engine.js so the audit judges it on
     * the rows it is actually responsible for. */
    writes: r => (!!r.in_our_store || !!mons[norm(r.name || '')] ||
      !!mons[(r.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')]) &&
      /mega|primal/i.test(r.forme || ''),
    fields: { ab: 'ability', mv: null, item: 'required_item' },
    /* DECLARED EXCEPTIONS, in the same spirit as the RAW-STORE-OK marker: a gap that is a JUDGEMENT
     * rather than an oversight has to be written down with its reason, or the audit gets ignored for
     * crying wolf and stops protecting anything.
     *
     * Ditto: the source reports the dex's ability SLOT 0, which is Limber. Every Ditto that matters
     * in this format runs IMPOSTER, and Imposter is not a passive tag — it copies the Pokemon across
     * from it, which board.js handles reactively through forme-cache invalidation rather than as a
     * stored ability string. Writing "Limber" here would replace a correct null with a confident
     * wrong answer. */
    except: { ab: { ditto: 'runs Imposter, not the dex slot-0 Limber; handled reactively in board.js' } },
  },
];

for (const S of SOURCES) {
  const rows = S.rows();
  const srcKeys = Object.keys(rows);
  if (!srcKeys.length) { flag('GAP', `${S.source}: unreadable or empty`); continue; }

  /* C. KEY CONVENTION, checked here because it decides whether B can even be evaluated.
   *
   * JUDGED ON THE ROWS THE BUILDER ACTUALLY WRITES, not on all of them. The first version of this
   * check compared every source row and reported "conventions agree" because 206 of 340 matched
   * exactly — but those 206 are the NON-mega rows, which this builder skips outright, and every row
   * it does write was in the other group. A check that averages over rows a builder never touches
   * will clear the builder that is broken, which is worse than not checking at all. */
  const artNorm = new Map(keys.map(k => [norm(k), k]));
  const written = srcKeys.filter(k => S.writes(rows[k]));
  const direct = written.filter(k => k in mons).length;
  const viaNorm = written.filter(k => !(k in mons) && artNorm.has(norm(k))).length;
  console.log(`\n   ${S.source}  ->  data/engine-data.js   (builder: ${S.builder})`);
  console.log(`     ${srcKeys.length} source rows, ${written.length} of which this builder WRITES:`);
  console.log(`       ${direct} match the artifact key EXACTLY, ${viaNorm} match only after normalising`);
  const example = written.find(k => !(k in mons) && artNorm.has(norm(k)));
  /* THE QUESTION IS WHETHER THE BUILDER RESOLVES THE MISMATCH, NOT WHETHER ONE EXISTS. The two files
   * are always going to spell keys differently; what matters is that the builder normalises before
   * it looks up, so it updates the existing entry instead of adding a second one. Checked by the
   * only evidence that settles it — the artifact having no two keys that normalise to the same
   * string. A raw-spelling comparison alone reports a GAP forever after the bug is fixed, and a
   * check that cries wolf gets ignored, which is how the original hole survived. */
  const collisions = [];
  const byN = new Map();
  for (const k of keys) {
    const n = norm(k);
    if (byN.has(n)) collisions.push([byN.get(n), k]); else byN.set(n, k);
  }
  if (collisions.length) {
    flag('GAP', `DUPLICATE ENTRIES — ${collisions.length} pair(s) differ only in spelling, ` +
      `e.g. '${collisions[0][0]}' and '${collisions[0][1]}'`);
    console.log('           a builder wrote its own key convention instead of resolving the artifact\'s.');
  } else if (viaNorm > direct) {
    flag('ok', `spellings differ (e.g. source '${example}' vs artifact '${artNorm.get(norm(example))}') ` +
      'but the builder resolves them — no duplicate entries exist');
  } else {
    flag('ok', 'key conventions agree on the written rows');
  }

  for (const [artField, srcField] of Object.entries(S.fields)) {
    if (!srcField) continue;
    let missing = 0, missingRaw = 0, fillable = 0;
    const worst = [], excused = [];
    for (const sk of srcKeys) {
      const ak = (sk in mons) ? sk : artNorm.get(norm(sk));
      if (!ak) continue;
      const srcVal = rows[sk][srcField];
      if (empty(srcVal)) continue;
      fillable++;
      if (empty(mons[ak][artField])) {
        const why = S.except && S.except[artField] && S.except[artField][ak];
        if (why) { excused.push(`${ak} (${why})`); continue; }
        missing++; missingRaw += rawOf(ak);
        worst.push([ak, rawOf(ak), srcVal]);
      }
    }
    worst.sort((a, b) => b[1] - a[1]);
    if (missing) {
      flag('GAP', `${artField}: ${missing} of ${fillable} entries the source could fill are null ` +
        `— ${pct(missingRaw, TOTAL_USAGE)} of format usage`);
      for (const [k, r, v] of worst.slice(0, 8)) {
        console.log(`           ${k.padEnd(20)} ${String(r).padStart(9)}  source says: ${v}`);
      }
    } else {
      flag('ok', `${artField}: every value the source carries is present in the artifact`);
    }
    for (const e of excused) console.log(`           excused: ${e}`);
  }
}

/* ---------------------------------------------------------------------------------------------
 * C. STALENESS — an artifact older than the thing that builds it
 * ------------------------------------------------------------------------------------------- */
console.log('\nC. STALENESS — derived artifact older than its builder or its source');
const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch (e) { return null; } };
for (const S of SOURCES) {
  const art = mtime(D('data', 'engine-data.js'));
  const src = mtime(D('data', S.source));
  const bld = mtime(D(S.builder));
  const older = [];
  if (src && art && art < src) older.push(`source ${S.source}`);
  if (bld && art && art < bld) older.push(`builder ${S.builder}`);
  if (older.length) flag('GAP', `data/engine-data.js is older than ${older.join(' and ')}`);
  else flag('ok', `data/engine-data.js is newer than ${S.source} and its builder`);
}
console.log('\n     NOTE: newer is NOT proof of correct. engine-data.js is newer than the mega merge');
console.log('     and still lost its output, because a LATER regeneration rewrote the whole MC table.');
console.log('     Timestamps catch stale artifacts; only check B catches overwritten ones.');

console.log(`\n${problems ? problems + ' GAP(S) FOUND' : 'no gaps found'}`);
process.exit(problems ? 1 : 0);
