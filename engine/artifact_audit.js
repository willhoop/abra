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

/* THE RAW TABLE, DECLARED. This file's SUBJECT is key spelling -- lines below deliberately ask
 * whether a normalised key resolves, and whether two keys normalise alike, because that is the
 * 2026-07-30 bug it was built to detect. Under the seal (engine/mc_key.js) a raw miss throws, and
 * an auditor that cannot ask about a miss cannot audit one. So it takes the unsealed table and
 * says why, which is greppable through mcKey.rawTable.reasons(). */
const { mcKey } = require(D('engine', 'mc_key.js'));
const mons = mcKey.rawTable('artifact_audit AUDITS key spellings -- asking whether a normalised key '
  + 'resolves, and whether two keys normalise alike, is its entire subject') || {};
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

/* ---------------------------------------------------------------------------------------------
 * D. THE FORMAT SAYS OTHERWISE — the artifact carries the field, and it DISAGREES
 *
 * ROADMAP #104. A and B ask whether a value ARRIVED. Neither asks whether the value that arrived is
 * the one this FORMAT plays, and that is a distinct hole: MC.moves carried generic gen-9 base power
 * for every move, while `Dex.forFormat('gen9championsvgc2026regmb')` applies Champions' own
 * modifications on top. Twelve moves disagreed, ours LOW in every case, Trop Kick (203 corpus uses)
 * by 70 against 85 — an 18% damage understatement on every rollout that ever clicked it.
 *
 * This is WIRE 89's hazard one field over. That wire took a secondary's CHANCE from the
 * format-derived artifact for exactly this reason and deliberately left basePower alone, and
 * CLAUDE.md states the general form: "the ban is a MECHANISM, not a list, so read it from the FORMAT
 * rather than from memory." The repair is in build/build_engine_data.js, which now takes bp from the
 * dex; this check is what stops a THIRTEENTH arriving unannounced.
 *
 * JUDGED ONLY ON THE ROWS THE BUILDER WRITES, per the lesson in check C above — the builder fills bp
 * from the dex for every move the dex knows, so rows the dex does not know are excluded AND COUNTED.
 * A builder that "passed" by skipping everything would show `judged 0` and is failed outright.
 * ------------------------------------------------------------------------------------------- */
console.log('\nD. THE FORMAT SAYS OTHERWISE — MC.moves against Dex.forFormat(champions)');

let DEX = null, dexWhy = '';
try {
  const CS = require(D('engine', 'champions_sim.js'));
  DEX = CS.sim().Dex.forFormat(CS.FORMAT);
} catch (e) { dexWhy = e.message; }

if (!DEX) {
  /* LOUD, not silent. A dex-less run cannot check this and must not look like a clean one — that is
   * the "silent default looks exactly like a working feature" failure this repo keeps paying for. */
  flag('GAP', `could not open the format dex, so base power was NOT CHECKED — ${dexWhy}`);
  console.log('           needs a built pokemon-showdown checkout (SHOWDOWN_PATH or the sibling dir).');
} else {
  /* One entry per artifact field the FORMAT is authoritative for. Registered here so a new one is
   * declared rather than discovered by reading the builder. */
  const FMT_FIELDS = [
    { art: 'bp', of: d => d.basePower || 0, label: 'base power' },
  ];
  const mvKeys = Object.keys(MC.moves || {});
  const known = mvKeys.filter(k => { const d = DEX.moves.get(k); return d && d.exists; });
  console.log(`     ${mvKeys.length} move rows, ${known.length} of which the builder WRITES ` +
    `(the dex knows them); ${mvKeys.length - known.length} the dex does not know and are excluded`);
  if (!known.length) flag('GAP', 'judged 0 rows — a check that judges nothing clears everything');
  for (const F of FMT_FIELDS) {
    const bad = [];
    for (const k of known) {
      const ours = MC.moves[k][F.art] || 0, fmt = F.of(DEX.moves.get(k));
      if (ours !== fmt) bad.push([k, ours, fmt]);
    }
    if (bad.length) {
      flag('GAP', `${F.art}: ${bad.length} of ${known.length} rows disagree with the format on ${F.label}`);
      for (const [k, o, f] of bad.slice(0, 15)) {
        console.log(`           ${k.padEnd(20)} ours ${String(o).padStart(4)}   format ${String(f).padStart(4)}`);
      }
    } else {
      flag('ok', `${F.art}: all ${known.length} written rows agree with the format on ${F.label}`);
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * E. TWO ROWS, ONE BODY — and the mega SOURCE POINTER underneath it
 *
 * ROADMAP #138, 2026-08-10. Check C asks whether two keys differ only in SPELLING. That is a
 * different question from whether two keys name the same POKEMON, and the difference cost a forme:
 *
 *     floette-mega            mv: []   ab: "Fairy Aura"   base: "floette"
 *     floette-eternal-mega    mv: []   ab: null
 *
 * `norm()` puts those in different buckets — `floettemega` against `floetteeternalmega` — so check C
 * saw nothing. The FORMAT resolves BOTH to the single species Floette-Mega, which is in ~10.4% of
 * stored games. CLAUDE.md already states this exactly: "ask whether the ARTIFACT has two keys that
 * NORMALISE ALIKE, not whether the two files spell keys the same" — and normalising is precisely what
 * was too weak. The authority on whether two names are one body is the dex, not a regexp.
 *
 * THE SECOND HALF IS THE POINTER, which is what actually emptied the row. A mega forme's source is
 * `changesFrom`, NOT `baseSpecies`, and for three formes in this format they differ:
 *
 *     Floette-Mega      changesFrom Floette-Eternal   baseSpecies Floette   <- and plain Floette is
 *                                                                             ILLEGAL here, so the
 *                                                                             baseSpecies route lands
 *                                                                             on a body with no row
 *     Meowstic-F-Mega   changesFrom Meowstic-F        baseSpecies Meowstic
 *
 * Anything inheriting a mega's moves through `baseSpecies` therefore writes `mv: []`, and a body with
 * no moves reads to every scorer as threatening NOTHING — the same consequence CLAUDE.md records for
 * the original mega-ability hole, one field over.
 *
 * BOTH HALVES ARE ASKED OF THE FORMAT rather than listed, so a regulation change that adds a fourth
 * such forme is caught without anybody editing this file.
 * ------------------------------------------------------------------------------------------- */
console.log('\nE. TWO ROWS, ONE BODY — artifact keys the FORMAT resolves to the same species');
/* the artifact's own spelling map, at this scope — check B builds a private one per source and this
 * check is not tied to a source */
const artNormAll = new Map(keys.map(k => [norm(k), k]));
if (!DEX) {
  flag('GAP', 'could not open the format dex, so duplicate-body and mega-pointer were NOT CHECKED');
} else {
  const bySpecies = new Map();
  let unresolved = 0;
  for (const k of keys) {
    const sp = DEX.species.get(k);
    if (!sp || !sp.exists) { unresolved++; continue; }
    if (!bySpecies.has(sp.id)) bySpecies.set(sp.id, []);
    bySpecies.get(sp.id).push(k);
  }
  const dupes = [...bySpecies.entries()].filter(([, ks]) => ks.length > 1);
  console.log(`     ${keys.length} rows, ${keys.length - unresolved} of which the format dex resolves` +
    `${unresolved ? `; ${unresolved} it does not know and are excluded` : ''}`);
  if (!bySpecies.size) flag('GAP', 'judged 0 rows — a check that judges nothing clears everything');
  else if (dupes.length) {
    flag('GAP', `${dupes.length} species is/are carried by MORE THAN ONE artifact row`);
    for (const [id, ks] of dupes) {
      console.log(`           ${DEX.species.get(id).name.padEnd(22)} <- ` + ks.map(k =>
        `${k} [mv=${(mons[k].mv || []).length} ab=${mons[k].ab}]`).join('   ||   '));
    }
    console.log('           two representations of one body WILL diverge, and the emptier one wins ' +
      'wherever a\n           consumer resolves by concatenation rather than through the artifact.');
  } else flag('ok', 'every artifact row names a distinct body in this format');

  /* the pointer. Judged ONLY on the rows that HAVE a source in the format and whose source is a legal
   * body here — a mega whose source is banned in this regulation is a fact about the regulation. */
  const megaRows = keys.filter(k => { const sp = DEX.species.get(k); return sp && sp.exists && sp.changesFrom; });
  let judged = 0; const orphan = [], divergent = [];
  for (const k of megaRows) {
    const sp = DEX.species.get(k);
    const from = DEX.species.get(norm(sp.changesFrom));
    if (!from || !from.exists || from.isNonstandard) continue;   // source is not legal here
    judged++;
    if (norm(sp.changesFrom) !== norm(sp.baseSpecies)) divergent.push(`${sp.name} changesFrom ` +
      `${sp.changesFrom}, baseSpecies ${sp.baseSpecies}`);
    const srcKey = (from.id in mons) ? from.id : artNormAll.get(norm(from.id));
    if (!srcKey) { orphan.push(`${k}: the format says its source is ${from.name} and the artifact has ` +
      'no row for that body at all'); continue; }
    if (!(mons[k].mv || []).length && (mons[srcKey].mv || []).length)
      orphan.push(`${k}: mv is EMPTY while its source ${srcKey} carries ` +
        `${mons[srcKey].mv.length} move(s) — the inheritance did not happen`);
  }
  console.log(`     ${megaRows.length} rows the format calls a forme change, ${judged} of which have a ` +
    'source that is LEGAL in this regulation and are judged');
  if (divergent.length) console.log('           changesFrom differs from baseSpecies on: ' +
    divergent.join(' | ') + '  — a builder reading baseSpecies lands on the wrong body for these');
  if (!judged) flag('GAP', 'judged 0 forme rows — a check that judges nothing clears everything');
  else if (orphan.length) {
    flag('GAP', `${orphan.length} forme row(s) did not inherit from the source the format names`);
    for (const o of orphan) console.log('           ' + o);
  } else flag('ok', `all ${judged} forme rows resolve to their source and carry moves`);
}

/* ---------------------------------------------------------------------------------------------
 * F. A ROW THAT IS PRESENT, NON-EMPTY, AND CARRIES NO INFORMATION
 *
 * ROADMAP #138, 2026-08-10, and it is the third distinct shape of the same root cause. Checks A, B and
 * E all ask whether a value is ABSENT or EMPTY. None of them can see a moveset that is neither:
 *
 *     venusaur-mega   ["venoshock", "round", "snore", "protect"]
 *     meganium-mega   ["round", "snore", "protect"]
 *
 * Round, Snore, Facade, Frustration — moves nobody brings on purpose, filled into rows that nothing had
 * ever observed. Measured: of 76 mega rows whose source forme has a real set, only 8 shared it, and ALL
 * 68 that differed carried no `set_source` at all while their base carried thousands of sheets. Every
 * structural check passed on every one of them.
 *
 * AN EMPTY ROW IS A VISIBLE GAP AND A FILLER ROW IS AN INVISIBLE ONE. That asymmetry is the whole
 * lesson, and it is why the builder now writes EMPTY rather than filler when it has no evidence.
 *
 * THE TEST IS PROVENANCE, NOT A LIST OF FILLER MOVES. "Which moves are filler" is a judgement that
 * rots; "how many observations back this row, and from where" is a fact the builder records. A row
 * whose declared observation count is zero — or which carries no provenance at all, meaning it was
 * written by something that never asked — is suspect. THIN rows are reported separately and are not
 * failures: two observations is a real set, it is just not a distribution, and a consumer should be
 * able to see which it is holding.
 * ------------------------------------------------------------------------------------------- */
console.log('\nF. PRESENT, NON-EMPTY, AND UNBACKED — a moveset nothing ever observed');
{
  const isMegaRow = k => !!mons[k].mega || /-(mega|primal)(-|$)/i.test(k);
  const megaKeys = keys.filter(isMegaRow);
  const THIN = 10;
  const unbacked = [], thin = [], empty = [];
  for (const k of megaKeys) {
    const P = mons[k].mv_provenance;
    const n = (mons[k].mv || []).length;
    if (!P) { if (n) unbacked.push(`${k} carries ${n} move(s) and NO provenance — nothing recorded `
      + 'where they came from, which is what a filler row looks like'); continue; }
    if (P.source === 'none' || !P.observations) {
      if (n) unbacked.push(`${k} carries ${n} move(s) with source="${P.source}" and `
        + `${P.observations || 0} observations — present, non-empty, and backed by nothing`);
      else empty.push(k);
      continue;
    }
    if (P.observations < THIN) thin.push(`${k} ${P.observations} obs from ${P.source}`);
  }
  console.log(`     ${megaKeys.length} mega/primal rows, `
    + `${megaKeys.filter(k => mons[k].mv_provenance).length} of which record where their moveset came from`);
  if (!megaKeys.length) flag('GAP', 'judged 0 rows — a check that judges nothing clears everything');
  else if (unbacked.length) {
    flag('GAP', `${unbacked.length} mega row(s) carry moves that nothing observed`);
    for (const u of unbacked.slice(0, 10)) console.log('           ' + u);
    console.log('           a filler moveset passes every ABSENT/EMPTY check while carrying no '
      + 'information.\n           The honest value where there is no evidence is EMPTY, which is '
      + 'visible.');
  } else flag('ok', 'every mega row with a moveset records an observed source for it');
  if (empty.length) console.log(`     ${empty.length} row(s) are EMPTY with a stated reason, which is `
    + `the honest gap rather than a defect: ${empty.join(', ')}`);
  if (thin.length) console.log(`     ${thin.length} row(s) are THIN (< ${THIN} observations) — a set, `
    + `not a distribution, and reported rather than failed: ${thin.join('; ')}`);
}

/* ---------------------------------------------------------------------------------------------
 * G. THE BROWSER COPY AGAINST THE NODE ORIGINAL — a generated file with a source and no comparison
 *
 * 2026-08-25. Checks A–F all interrogate ONE artifact, data/engine-data.js. This file's stated
 * subject is wider than that — "a DERIVED ARTIFACT is never checked against the SOURCE it was
 * derived from" — and the same class bit this repo again in a different pair:
 *
 *     data/tags.json     rewritten by a tag_dex run at 2026-08-24 23:37
 *     data/abra-tags.js  left at its 22:59 content, and both were COMMITTED that way
 *
 * The node engine reads tags.json and the browser engine reads abra-tags.js, so HEAD carried two
 * engines that disagreed about three moves — Bug Bite and Pluck stealing any item instead of only a
 * berry, and Thunder Wave ignoring the type chart. Both params have live consumers in
 * medicham2-browser.js. An earlier instance of the same drift ran for TWO DAYS. Nothing caught
 * either one; it surfaced because a release cut happened to look.
 *
 * MEMBERSHIP IS DERIVED, NOT LISTED. Every browser bundle under data/ declares its own builder in a
 * `GENERATED by <builder> from <source>` header, so the pairs are read off the files at run time.
 * A hand-typed list here would rot exactly like the one engine/provenance.js had to delete.
 *
 * THE COMPARISON IS THE BUILDER'S OWN --check, NEVER A RE-IMPLEMENTATION. Two implementations of
 * one fact is this repo's most expensive recurring failure, and a re-implementation would also stop
 * being right the moment a wrapper changed shape. tests/test-guru-derived.js established this
 * pattern for data/guru.js in 2026-08-04; this reuses it rather than inventing a second one.
 *
 * A BUILDER WITH NO --check IS PRINTED, NOT FAILED. Those pairs are uncovered, which is worth
 * saying out loud on every run — but turning eight of them red at once would make this gate
 * something people waive, and a check nobody acts on is not a check.
 * ------------------------------------------------------------------------------------------- */
console.log('\nG. THE BROWSER COPY AGAINST THE NODE ORIGINAL — generated bundles vs their sources');
{
  const { spawnSync } = require('child_process');
  /* `[\s\S]{0,200}?` and not `[^*]*?`: two of these headers put "GENERATED FILE" and "Generated by
   * <builder>" on separate comment lines, so a pattern that cannot cross a ` * ` prefix silently
   * skipped data/move-effects.js and data/mega-formes.js — the check quietly covering less than it
   * looked like it covered, which is the failure this whole file is about. */
  const HDR = /GENERATED\b[\s\S]{0,200}?\bby\s+(?:ABRA\/)?((?:build|engine)\/[A-Za-z0-9_.-]+\.js)(?:[\s\S]{0,200}?\bfrom\s+((?:data|CHOMP)\/[A-Za-z0-9_.\/-]+\.(?:json|js)))?/i;
  let bundles = [];
  try { bundles = fs.readdirSync(D('data')).filter(f => f.endsWith('.js')).sort(); }
  catch (e) { flag('GAP', `cannot list data/ — ${e.message}`); }

  const pairs = [];
  for (const f of bundles) {
    let head = '';
    try { head = fs.readFileSync(D('data', f), 'utf8').slice(0, 600); }
    catch (e) { flag('GAP', `data/${f} exists and could not be read — ${e.message}`); continue; }
    const m = head.match(HDR);
    if (!m) continue;                       // not a self-declaring generated bundle
    const builder = m[1], source = m[2] || null;
    let hasCheck = false;
    try { hasCheck = fs.readFileSync(D(builder), 'utf8').includes('--check'); }
    catch (e) { flag('GAP', `data/${f} names builder ${builder}, which cannot be read — ${e.message}`); continue; }
    pairs.push({ art: 'data/' + f, builder, source, hasCheck });
  }

  console.log(`     ${pairs.length} generated bundle(s) under data/ declare a builder; ` +
    `${pairs.filter(p => p.hasCheck).length} of those builders offer --check and are COMPARED`);
  if (!pairs.length) flag('GAP', 'judged 0 bundles — a check that judges nothing clears everything');

  /* ONE RUN PER BUILDER, NOT ONE PER ARTIFACT. build_browser_data.js writes two bundles and opens the
   * Champions dex to do it — spawning it twice doubled this section's cost for the same answer. */
  const ran = new Map();
  for (const p of pairs.filter(x => x.hasCheck)) {
    if (!ran.has(p.builder)) ran.set(p.builder,
      spawnSync(process.execPath, [D(p.builder), '--check'], { encoding: 'utf8' }));
    const r = ran.get(p.builder);
    const out = ((r.stdout || '') + (r.stderr || '')).trimEnd();
    if (r.error) { flag('GAP', `${p.art}: could not run ${p.builder} --check — ${r.error.message}`); continue; }
    if (r.status === 0) {
      flag('ok', `${p.art} is what ${p.builder} would write` + (p.source ? ` from ${p.source}` : ''));
    } else {
      flag('GAP', `${p.art} is NOT what ${p.builder} would write` + (p.source ? ` from ${p.source}` : ''));
      for (const l of out.split('\n')) console.log('           ' + l);
    }
  }

  const uncovered = pairs.filter(x => !x.hasCheck);
  if (uncovered.length) {
    /* "no --check", not "no comparison" — one of these rows is data/engine-data.js, which checks A–F
     * above compare against its source field by field. A gate line that overstates its own finding is
     * how a gate stops being read. */
    console.log(`\n     ${uncovered.length} bundle(s) have a builder and NO --check — reported, not failed:`);
    for (const p of uncovered) console.log(`       ${p.art.padEnd(24)} <- ${p.builder}` +
      (p.source ? `  from ${p.source}` : '  (source not declared in the header)'));
    console.log('       each becomes covered by giving its builder a --check mode; this check picks');
    console.log('       it up with no edit here.');
  }
}

console.log(`\n${problems ? problems + ' GAP(S) FOUND' : 'no gaps found'}`);
process.exit(problems ? 1 : 0);
