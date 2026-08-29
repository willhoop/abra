/* build_engine_data.js — generate data/engine-data.js FROM the canonical engine.
 *
 * Why this file exists
 * --------------------
 * data/engine-data.js is what the browser (site + rollout engine) uses for species, moves and the
 * type chart. It was maintained as its own artifact, and it stored only DERIVED values: each
 * species' level-50 stat line, with no base stats. That is a quiet but serious design fault:
 *
 *   - Derived-only data cannot be recomputed. When the canonical engine learned real mega base
 *     stats, the browser engine could not follow, because it had nothing to recompute FROM. It
 *     could only copy a number that was already wrong.
 *   - Two artifacts describing the same knowledge drift. "Every piece of knowledge must have a
 *     single, unambiguous, authoritative representation within a system" (Hunt & Thomas, The
 *     Pragmatic Programmer). Where several representations are unavoidable, DRY's own answer is
 *     that one is definitive and the rest are GENERATED.
 *
 * So this generator makes engine-data.js a build output of CHOMP/engine/champ-model.js, and it now
 * carries BOTH the base stats (source) and the level-50 line (convenience), so any consumer can
 * recompute rather than copy.
 *
 *   node build/build_engine_data.js            overwrites data/engine-data.js
 *   node build/build_engine_data.js --check    writes NOTHING; exits non-zero if the artifact on
 *                                              disk is not what this script would write today
 *   node build/build_engine_data.js --purity   writes NOTHING; builds twice, once WITH the previous
 *                                              artifact and once with it hidden, and reports every
 *                                              value that still comes off this builder's own output
 *
 * Never hand-edit data/engine-data.js.
 *
 * ══ WHY `--check` EXISTS (2026-08-26) ═══════════════════════════════════════════════════════════
 *
 * engine/generated_audit.js derived that 360 generated files exist in this repository, 8 could
 * prove they match their source, and 0 carried a digest of their own content. This file was on the
 * shortlist because it is frozen into EVERY engine release (it is in engine_release.js's SOURCES)
 * and had no comparison at all.
 *
 * It is also the file the whole class of bug first bit us on. 2026-07-30: merge_mega_into_engine.js
 * keyed `venusaurmega`, the source artifact keyed `venusaur-mega`, ZERO of 67 writes matched, and
 * every mega in this format carried `ab: null`, `mv: []`, `item: null` — 26% of the format's usage,
 * scoring as though it threatened nothing. Nothing noticed, because nothing compared the two files.
 * engine/artifact_audit.js was built in response and watches ONE named file pair, which is why the
 * fourth instance of the class walked straight past it.
 *
 * The comparison is against what THIS script would write, never against a re-implementation of the
 * generator — the pattern tests/test-guru-derived.js set in 2026-08-04 and build/build_tags_js.js
 * reused in 2026-08-25. A second implementation stops being right the moment the generator changes
 * shape, and then reports a drift that is really its own staleness.
 *
 * ══ WHAT SHAPE THIS MATCHES — AND WHAT WALKS PAST IT ════════════════════════════════════════════
 *
 * READ THIS BEFORE BELIEVING A GREEN RUN. This builder reads the artifact it is about to overwrite
 * and carries part of it through, so the check divides in two and only one half is provable. A field
 * that came off the previous copy is compared TO ITSELF and passes no matter what it holds — which
 * is not a theory: that is exactly how 67 mega rows sat at `ab: null` / `mv: []` for seven weeks
 * with every check green.
 *
 *   PROVABLE — recomputed from a source outside the artifact:
 *     mons[k].t, mons[k].bs   from CHOMP/engine/champ-model.js
 *     mons[k].wt              from the Champions dex (species.weighthg)
 *     moves — ALL 500 ROWS    t and c from champ-model's MOVES table; bp, rc, self from the dex
 *     moves added by the tags.json ∩ dex backfill
 *     MC.C (the type chart)   from champ-model
 *     MC.priors               from data/mc-priors.json
 *     the rows champ-model does not carry, in full, from data/mc-declared-rows.json
 *     the wrapper / mcEff / export block from data/engine-data.template.txt
 *     the KEY SET and the KEY ORDER of mons and moves
 *
 *   NOT PROVABLE — still copied off the artifact, on the rows champ-model DOES carry:
 *     mons[k].st, .mv, .item, .ab, .nature, .sp, .set_source, .base, .mega, .mv_provenance
 *
 * ══ WHY THAT SECOND LIST IS STILL HERE, AND WHAT WOULD EMPTY IT (2026-08-26) ════════════════════
 *
 * Those fields are not this builder's. data/engine-data.js is written by THREE generators in
 * sequence, each editing the file IN PLACE:
 *
 *   1. this file                            t, bs, wt, moves, C, the key set
 *   2. build/rebuild_sets_from_sheets.js    mv, item, ab, nature, sp, st, set_source
 *                                           from data/species-sets.json (open team sheets)
 *   3. engine/merge_mega_into_engine.js     base, mega, mv_provenance, the mega rows
 *                                           from data/mega-dex-official.json + the sheet store
 *
 * Stage 1 carries stages 2 and 3 through so that re-running it does not DELETE their output — the
 * 2026-08-09 fix, and it is correct. The cost is that stage 1 cannot prove those fields, because its
 * only copy of them is the file it is checking.
 *
 * THE ONE CHANGE THAT WOULD CLOSE IT: stages 2 and 3 must write their own layer file under data/
 * instead of editing the artifact in place, and stage 1 must merge the layers. Then a wipe of
 * engine-data.js is caught, because the layers still hold the values. That is a pipeline change and
 * it is NOT free — re-deriving stage 3 from today's sheet store moves 14 mega movesets and all 76
 * mv_provenance blocks, so it carries a measured value change. It is written up in
 * docs/_reports/2026-08-26-builder-purity.md and it is not done here.
 *
 * `--purity` MEASURES the residue rather than asserting it away: it builds once with the previous
 * artifact and once without, diffs the two candidates field by field, and ratchets the count in
 * data/engine-data-purity.json. The number may fall and may never rise. Do not replace it with a
 * sentence in this header; a sentence is what went stale for seven weeks last time.
 *
 * The ROW CENSUS below is the other compensating instrument: it counts the null/empty shape of the
 * 2026-07-30 failure directly, on every run, in both modes, and DECLARES the expected ones with a
 * DERIVED reason.
 *
 * Four more things get through, named so nobody has to rediscover them:
 *
 *  1. A SECOND ARTIFACT WRITTEN BY THIS BUILDER would NOT be caught. This builder writes exactly
 *     one file, so the question is moot here — but the check is written against OUT, not against a
 *     scan of what was written, so if a second output were added it would need its own clause. This
 *     is the instance-not-class hazard engine/read_text.js spends its header on. It is the plainest
 *     hole left: `--check` proves one named path, so anything this builder wrote anywhere ELSE is
 *     unproven by construction and would go unnoticed for as long as nobody read the code.
 *  2. THE SAME ARTIFACT WRITTEN BY A DIFFERENT PATH **IS** CAUGHT, and that is the useful half: the
 *     check asks whether the BYTES ON DISK equal what this builder would produce, so a hand-edit, a
 *     merge, a later script or a stale checkout all read as drift regardless of who wrote them.
 *     That is how the missing row below was found.
 *  3. A WRONG SOURCE is invisible. If champ-model.js is itself wrong, artifact and source agree and
 *     this check goes green. It proves AGREEMENT, never correctness.
 *  4. engine/generated_audit.js WILL NOT SPAWN THIS CHECK. Its play-layer walk sees the require of
 *     engine/champions_sim.js — which is in engine_release.js's SOURCES — and refuses, by design,
 *     to run any builder that reaches the simulator. So this file stays UNPROVABLE in that report
 *     and must be run by hand. That refusal is the safe direction and is not worked around here.
 *
 * ══ THE EOL TRAP, WHICH THIS CHECK IS IMMUNE TO BY CONSTRUCTION ════════════════════════════════
 *
 * `core.autocrlf` is true on this machine, so a tracked file sits in the working tree as CRLF while
 * the committed blob is LF — same content, different bytes. Three checks in this repository have
 * already been wrong about the project because of it (see engine/read_text.js), and one of them
 * claimed the browser engine and the node engine were reading different rulebooks. Measured
 * 2026-08-26: data/engine-data.js holds 13 CRLF and zero bare LF, i.e. it is fully CRLF on disk.
 *
 * This check cannot be fooled by that, for a structural reason rather than a careful one: the
 * candidate bytes are built BY EDITING THE DISK BUFFER (`src.replace(...)`), so they inherit the
 * file's own line endings, and the only text substituted is JSON.stringify output, which contains
 * no CR. Both sides are additionally passed through engine/read_text.js's `normalise` so the
 * immunity is stated rather than relied upon. engine/generated_audit.js's CHECKOUT-EOL verdict is
 * the one answer to that hazard in this repo; a third answer is not invented here.
 */
'use strict';
const fs = require('fs'), path = require('path');
const { normalise } = require(path.join(__dirname, '..', 'engine', 'read_text.js'));
const M = require(path.join(__dirname, '..', '..', 'CHOMP', 'engine', 'champ-model.js'));
const CHECK = process.argv.includes('--check');
const PURITY = process.argv.includes('--purity');
/* The dex, for the facts the engine owns and CHOMP's model does not carry — currently weight. */
let DEX = null;
try {
  const CS = require(path.join(__dirname, '..', 'engine', 'champions_sim.js'));
  DEX = CS.sim().Dex.forFormat(CS.FORMAT);
} catch (e) { console.warn('  no dex available — weights will fall back to whatever was stored'); }
/* A DEX-LESS `--check` WOULD BE A GREEN TEST THAT ASKS NOTHING, so it is refused rather than passed.
 * Without the dex, `wt`, `bp`, `rc` and `self` all fall back to the value already stored in the
 * artifact — the candidate bytes would then be compared against themselves in every field the dex
 * owns, and the run would report agreement it never tested. A build may degrade that way (it
 * preserves what it cannot recompute, which is correct); a MEASUREMENT may not. */
if ((CHECK || PURITY) && !DEX) {
  console.error('build_engine_data --check: NO VERDICT. The Champions dex did not load, so every');
  console.error('  dex-owned field (wt, bp, rc, self) would fall back to the artifact\'s own stored');
  console.error('  value and compare equal to itself. That is not a pass, it is a check asking');
  console.error('  nothing. Fix the dex (engine/champions_sim.js / SHOWDOWN_PATH) and re-run.');
  process.exit(2);
}
/* ── THE ONE PLACE THAT TURNS A SPECIES KEY INTO A WEIGHT (2026-08-29) ───────────────────────────
 *
 * WHY THIS IS A FUNCTION AND NOT AN EXPRESSION INSIDE ONE LOOP. It was an expression inside one loop
 * — the `Object.entries(M.MONS)` walk below — and that loop only visits the rows CHOMP's model
 * carries. `mons` is assembled from THREE sources (that walk, data/mc-declared-rows.json, and any
 * row only the previous artifact holds), and the other two were appended verbatim. So the builder
 * owned `wt` (it is in OWNED) for 312 rows and silently did not own it for 10:
 *
 *     victreebel-mega, feraligatr-mega, skarmory-mega, barbaracle-mega, falinks-mega,
 *     aegislash-blade, gourgeist-small, gourgeist-large, gourgeist-super, palafin-hero
 *
 * The dex knows the weight of ALL TEN — this is not a case of the value being unavailable at build
 * time, which is how the hand list read it ("uncomputable rather than wrong"). It is the derivation
 * never being applied to those rows. Measured before the pass was wired: over all 322 rows it fills
 * exactly those 10, agrees with the stored value on the other 312, and DISAGREES with none — so it
 * is not an over-matching rewrite of the weight column.
 *
 * WHAT THE HOLE COST, since a null `wt` is not inert:
 *   - a body BUILT at one of these formes gets `wt: null` from buildMon, and medicham2's `effWeight`
 *     returns null, so Low Kick / Grass Knot / Heavy Slam / Heat Crash fall through to their dex
 *     basePower of 0 — UNCOMPUTABLE, the exact 2026-07-28 shape;
 *   - a body that FORME-CHANGES into one keeps the stamp of the body that left the field, which
 *     medicham2 counts as `MEDFAILS.weightRowNoValue` and prices at a real but wrong number.
 *
 * NO try/catch. `Dex.species.get` does not throw on an unknown key — it returns `exists: false` —
 * so a catch here could only swallow a real instrument failure, which is the census block's own
 * stated rule two hundred lines down. The dex-less case is handled by the `DEX &&` guard and by the
 * caller's fallback to the stored value, and it is announced at load. */
function dexWeightKg(key) {
  const sp = DEX && DEX.species.get(key);
  return (sp && sp.exists && sp.weighthg) ? sp.weighthg / 10 : null;
}
const OUT = path.join(__dirname, '..', 'data', 'engine-data.js');
const DATA = (...p) => path.join(__dirname, '..', 'data', ...p);

/* ── THE SOURCES THAT USED TO BE THE OUTPUT (2026-08-26) ─────────────────────────────────────────
 * Three blocks of this artifact had no upstream anywhere in the repository — the 230 opponent-model
 * priors, the species rows champ-model no longer carries, and the file's own wrapper. All three were
 * read back out of data/engine-data.js, so every check that asked "does the artifact match its
 * sources?" compared them TO THEMSELVES and passed. They are declared files now. The values were
 * RELOCATED, not regenerated: not one of them changed in the move, and the candidate bytes this
 * builder produces are identical either side of the change. */
const TEMPLATE_F = DATA('engine-data.template.txt');
const PRIORS_F   = DATA('mc-priors.json');
const DECLARED_F = DATA('mc-declared-rows.json');
const RATCHET_F  = DATA('engine-data-purity.json');

/* A MISSING SOURCE IS A REFUSAL, NOT A DEFAULT. `|| {}` here would delete 230 priors or 15 species
 * rows and report success — which is the exact failure shape this whole file is written about. The
 * declared `count` is checked against the rows actually present for the same reason: a file that is
 * half-written parses fine. */
function readSource(f, key) {
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) {
    console.error(`build_engine_data: cannot read data/${path.basename(f)} — ${e.message}`);
    console.error('  Refusing to build. That file is a SOURCE; an empty default would silently');
    console.error('  delete every row it holds and the build would still report success.');
    process.exit(2);
  }
  const v = j[key];
  if (!v || typeof v !== 'object') {
    console.error(`build_engine_data: data/${path.basename(f)} has no "${key}" object.`); process.exit(2);
  }
  if (j.count != null && j.count !== Object.keys(v).length) {
    console.error(`build_engine_data: data/${path.basename(f)} declares count ${j.count} and holds `
      + `${Object.keys(v).length} rows.`); process.exit(2);
  }
  return v;
}
const SRC_PRIORS   = readSource(PRIORS_F, 'priors');
const SRC_DECLARED = readSource(DECLARED_F, 'rows');
const TEMPLATE = (() => {
  try { return fs.readFileSync(TEMPLATE_F, 'utf8'); }
  catch (e) {
    console.error(`build_engine_data: cannot read data/${path.basename(TEMPLATE_F)} — ${e.message}`);
    console.error('  That file carries the wrapper, mcEff and the export block. Without it this');
    console.error('  builder would have to read them back off its own output, which is the thing');
    console.error('  it stopped doing on 2026-08-26. Refusing to build.');
    process.exit(2);
  }
})();

/* The previous artifact, or null. It is an input for the fields stages 2 and 3 own (see the header)
 * and for nothing else. `--purity` runs the identical build with this forced to null, so the size of
 * that dependency is a measured number rather than a claim. */
/* ABSENT AND UNREADABLE ARE NOT THE SAME ANSWER, and returning null for both would be this repo's
 * signature failure: a corrupt artifact would read as "there is no previous artifact", the build
 * would quietly drop 2,072 carried values and report success. ENOENT is the only quiet case. */
function readPrior() {
  let t;
  try { t = fs.readFileSync(OUT, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') return null;                      // first run, or --purity's blind arm
    console.error(`build_engine_data: data/engine-data.js exists and could not be read — ${e.message}`);
    console.error('  Refusing to build: continuing would silently delete every field the later');
    console.error('  generators wrote into it.');
    process.exit(2);
  }
  const m = t.match(/const MC = (\{[\s\S]*?\});/);
  if (!m) {
    console.error('build_engine_data: data/engine-data.js has no parseable MC object.');
    console.error('  Refusing to build. An empty `prior` here reads as "first run" and would delete');
    console.error('  every set and mega field the later generators wrote.');
    process.exit(2);
  }
  try { return JSON.parse(m[1]); }
  catch (e) {
    console.error(`build_engine_data: the MC object in data/engine-data.js does not parse — ${e.message}`);
    process.exit(2);
  }
}

/* THE FIELDS THIS BUILDER OWNS. Anything else arriving on a row came off the previous artifact and
 * is counted as CARRIED, by field name, so the residue is a number and not an adjective. */
const OWNED = new Set(['t', 'bs', 'wt']);

/* THE USER'S OWN BOOST, FROM WHICHEVER FIELD SHOWDOWN PUT IT IN. Never guess between them: a move
 * that carries both would be a real upstream oddity, so it is reported rather than silently merged. */
function selfBoostsOf(d) {
  const a = d.self && d.self.boosts, b = d.selfBoost && d.selfBoost.boosts;
  if (a && b) console.warn(`  ${d.id}: carries BOTH self.boosts and selfBoost.boosts — using self.boosts`);
  return a || b || null;
}

function buildMC(prior, quiet) {
  const say = m => { if (!quiet) console.log(m); };
  const carriedBy = {};
  const mons = {};
  for (const [key, m] of Object.entries(M.MONS)) {
    const old = (prior && prior.mons && prior.mons[key]) || {};
    for (const f of Object.keys(old)) if (!OWNED.has(f)) carriedBy[f] = (carriedBy[f] || 0) + 1;
  /* EVERY FIELD THIS BUILDER DOES NOT OWN IS CARRIED THROUGH (2026-08-09). It used to construct a
   * fresh literal, so a regeneration DELETED `nature`, `sp` and `set_source` from all 318 rows —
   * fields written by a LATER builder (engine/derive_sets.js, build/rebuild_sets_from_sheets.js).
   * Measured, not guessed: a trial regeneration produced 800 semantic differences against the
   * artifact, of which 788 were these three fields disappearing and only 12 were the base powers
   * this pass came to fix. Same shape as the mega-ability hole CLAUDE.md records — "a later
   * wholesale regeneration left the nulls in place" — and it would have been invisible, because a
   * missing `set_source` reads downstream as "assumed" rather than as "deleted". The spread comes
   * FIRST so the fields below still win; this builder remains authoritative for its own.
   *
   * THIS IS THE WHOLE OF THE REMAINING SELF-READ, AND IT IS COUNTED ABOVE. See the header for the
   * one change that would remove it and what that change costs. */
    mons[key] = {
    ...old,
    t: m.t,
    bs: m.bs,                       // BASE stats — the source, so consumers can recompute
    st: old.st || null,             // level-50 line as previously stored (ABRA's assumed spread)
    mv: old.mv || [],
    item: old.item || null,
    ab: old.ab || null,
    /* WEIGHT, in kg. Absent until 2026-07-28, and its absence made four moves UNCOMPUTABLE rather
     * than merely wrong: Low Kick (1,854 uses) and Grass Knot (242) scale with the target's weight,
     * Heavy Slam (119) and Heat Crash (5) with the weight RATIO. Their dex basePower is 0, so
     * board.js returned null and scored them as NON-DAMAGING — invisible, not mis-valued.
     *
     * Taken from the dex (species.weighthg, hectograms) rather than from CHOMP's model, because the
     * dex is the engine's own truth and this is exactly the kind of number that must not be
     * restated. Falls back to whatever was previously stored so a dex-less run cannot erase it. */
    wt: (dexWeightKg(key) != null) ? dexWeightKg(key) : (old.wt != null ? old.wt : null),
  };
  // if there was no stored line, derive a neutral one so nothing breaks
    if (!mons[key].st) {
    const S = b => Math.floor(Math.floor((2 * b + 31) * 50 / 100) + 5);
    mons[key].st = { hp: Math.floor((2 * m.bs.hp + 31) * 50 / 100) + 60, at: S(m.bs.atk),
                     df: S(m.bs.def), sa: S(m.bs.spa), sd: S(m.bs.spd), sp: S(m.bs.spe) };
  }
  }

/* ROWS THE ARTIFACT HAS AND CHAMP-MODEL DOES NOT — KEPT, AND SAID OUT LOUD (2026-08-09).
 *
 * This loop used to be the whole of `mons`, so running this builder DELETED every artifact row the
 * model no longer carries. Measured before it was changed: 10 would have gone — victreebel-mega,
 * feraligatr-mega, skarmory-mega, barbaracle-mega, falinks-mega, aegislash-blade, gourgeist-small,
 * gourgeist-large, gourgeist-super, palafin-hero. Five megas and Aegislash-Blade are not cosmetic;
 * buildMon opens with `if(!m||!m.bs) return null`, so their disappearance would make those formes
 * UNBUILDABLE rather than merely approximate.
 *
 * That is the exact shape CLAUDE.md records for the mega-ability hole: "a later wholesale
 * regeneration left the nulls in place". A generator that silently narrows its own output is a
 * landmine for whoever runs it next, and it was found by asking what a regeneration WOULD do before
 * running one. Preserved rather than dropped, and printed with the count, because a preserved row is
 * a divergence between two sources that somebody should eventually reconcile — not a fact.
 *
 * THEY COME FROM data/mc-declared-rows.json NOW, NOT FROM THE ARTIFACT (2026-08-26). Reading them
 * back off the output meant a check could never see them go missing, and three of them —
 * castform-sunny/rainy/snowy — carry a TYPE their base forme does not, which is board-material: lose
 * them and a sun Castform reads Normal instead of Fire, changing STAB and every effectiveness term.
 * engine/merge_mega_into_engine.js re-adds the mega and size formes from data/mega-dex-official.json;
 * the three Castform rows, morpeko-hangry and mimikyu-busted have NO generator at all. */
  const declaredKeys = Object.keys(SRC_DECLARED).filter(k => !(k in mons));
  for (const k of declaredKeys) mons[k] = SRC_DECLARED[k];
  /* A row the ARTIFACT holds that neither champ-model nor the declared file knows would be DELETED
   * by this build. That silent narrowing is exactly what the 2026-08-09 note above is about, so it
   * is preserved AND named — the fix is to add it to data/mc-declared-rows.json, not to leave the
   * build quietly depending on its own output to keep the row alive. */
  const undeclared = prior ? Object.keys(prior.mons || {}).filter(k => !(k in mons)) : [];
  for (const k of undeclared) {
    mons[k] = prior.mons[k];
    for (const f of Object.keys(mons[k])) if (!OWNED.has(f)) carriedBy[f] = (carriedBy[f] || 0) + 1;
  }
  if (undeclared.length) {
    console.warn(`  UNDECLARED ROWS: ${undeclared.length} row(s) exist only in data/engine-data.js — `
      + `${undeclared.join(', ')}`);
    console.warn('    They survive only because this build read its own output. Add them to '
      + 'data/mc-declared-rows.json with a reason.');
  }

  /* ── `wt` IS OWNED FOR EVERY ROW, NOT ONLY THE ONES CHAMP-MODEL CARRIES (2026-08-29) ───────────
   *
   * The two loops above append rows VERBATIM, so `wt` — a field this builder declares it OWNS — was
   * whatever those sources happened to hold, which for ten of them was nothing at all. This pass is
   * the ONLY writer of `wt` outside the champ-model walk and it reads the same `dexWeightKg`, so
   * there is one implementation of "how heavy is this species" and not two.
   *
   * IT FILLS, IT NEVER OVERWRITES A DISAGREEMENT SILENTLY. A stored value that differs from the dex
   * is a real finding — the dex is authoritative and a difference means one of the three sources is
   * restating a number — so it is REPORTED with both values and then corrected, rather than being
   * assigned over in silence. Measured on the artifact this pass was written against: 10 filled,
   * 312 already equal, 0 disagreements, 0 rows the dex has no weight for.
   *
   * KEY POSITION IS DELIBERATE. The five declared rows that already carry `wt` place it after `ab`
   * and before `base`; a filled row is rebuilt in that same order so the ten join the shape the
   * artifact already uses instead of inventing a second one. Key order in this artifact is
   * load-bearing (data/mc-declared-rows.json says so) and `--check` compares bytes. */
  let wtFilled = 0; const wtFilledList = [], wtCorrected = [], wtNoDex = [];
  for (const k of Object.keys(mons)) {
    const kg = dexWeightKg(k);
    if (kg == null) { if (mons[k].wt == null) wtNoDex.push(k); continue; }
    const cur = mons[k].wt;
    if (cur === kg) continue;
    /* COPY BEFORE WRITING. `mons[k]` may be the very object held inside SRC_DECLARED (the declared
     * loop assigns the reference, not a clone), and --purity builds TWICE — so an in-place write
     * here would leak into the second build and make the two candidates agree for the wrong
     * reason. */
    if (cur != null) { wtCorrected.push(`${k}: ${cur} -> ${kg}`); mons[k] = { ...mons[k], wt: kg }; continue; }
    const src = mons[k], out = {};
    for (const f of Object.keys(src)) { out[f] = src[f]; if (f === 'ab') out.wt = kg; }
    if (out.wt == null) out.wt = kg;          // no `ab` field to anchor on — append rather than skip
    mons[k] = out;
    wtFilled++; wtFilledList.push(`${k} ${kg}`);
  }
  if (wtFilled) say(`  wt FILLED from the dex on ${wtFilled} row(s) the champ-model walk never `
    + `visits: ${wtFilledList.join(', ')}`);
  if (wtCorrected.length) console.warn(`  wt CORRECTED against the dex on ${wtCorrected.length} `
    + `row(s) — a stored weight disagreed with the format: ${wtCorrected.join(', ')}`);
  if (wtNoDex.length) console.warn(`  wt STILL NULL on ${wtNoDex.length} row(s) — the dex has no `
    + `weight for them either: ${wtNoDex.join(', ')}`);

/* MOVES: t and c come from champ-model's own compact MOVES table and are ENRICHED from the dex with
 * self-cost facts the rollout previously kept as hand-typed name lists (Will: every click needs a
 * cost, priced into decisions — a cost table someone typed is a cost table someone forgot to type):
 *   rc    recoil as [numerator, denominator] of damage dealt — m.recoil is a plain dex field,
 *         exactly the case Will ruled "look it up, don't restate it in a tag"
 *   self  the move's own stat drops (Superpower, Overheat, Close Combat)
 *
 * SHOWDOWN CARRIES THE USER'S OWN BOOST IN **TWO DIFFERENT FIELDS**, AND THIS READ ONE OF THEM.
 * (ROADMAP #110, 2026-08-09.) `self.boosts` covers Close Combat, Superpower, Draco Meteor, Overheat,
 * Leaf Storm and Make It Rain — all six of which the deliberate roster reports as MATCH, which is
 * exactly why nothing looked wrong. `selfBoost.boosts` is a SEPARATE field, and the two moves in this
 * format that use it got no self-data at all:
 *
 *     Clanging Scales   selfBoost {def:-1}          810 uses   roster: FIRED-AND-BOARDS-DIFFER
 *     Scale Shot        selfBoost {def:-1, spe:+1}  199 uses   roster: FIRED-AND-BOARDS-DIFFER
 *
 * Showdown drove Clanging Scales' user to -1 then -2 Defence across two clicks; this engine left it
 * at 0 both times. `selfBoostsOf` reads BOTH fields, and the difference between them is real rather
 * than cosmetic — `self` applies on use, `selfBoost` only once the move has actually hit something —
 * so the source field is recorded rather than flattened away.
 *
 * BASE POWER IS TAKEN FROM THE FORMAT, NOT KEPT (ROADMAP #104, 2026-08-09). It used to be kept, and
 * the stored copy was GENERIC gen-9 data: `Dex.forFormat('gen9championsvgc2026regmb')` applies
 * Champions' own modifications on top of it. Twelve moves disagreed and ours was LOW in every case —
 * Trop Kick 70 against 85 on 203 corpus uses, Mountain Gale 100 against 120, Psyshield Bash 70
 * against 90 — so every rollout that clicked one of them understated its own damage by up to 22%.
 * Measured two ways before it was changed: a direct damage sweep and the deliberate roster's staged
 * games, whose damage ratios matched the bp ratios to three decimals (tropkick 70/85 = 0.824 against
 * a measured 57/69 = 0.826). Every other field was compared in the same pass — type, accuracy,
 * priority and category all had ZERO mismatches, so base power was the only one wrong.
 *
 * This is WIRE 89's hazard one field over: that wire took a secondary's CHANCE from the
 * format-derived artifact for exactly this reason and left basePower alone. CLAUDE.md states the
 * general rule — "the ban is a MECHANISM, not a list, so read it from the FORMAT rather than from
 * memory." Guarded by check D of engine/artifact_audit.js, which is a registered gate and fails on
 * any NEW divergence. The dex is authoritative only for rows it KNOWS; for anything else the stored
 * value is kept and counted, because a silent fallback to 0 would delete a move rather than mis-price
 * it.
 *
 * THE ROWS THEMSELVES USED TO BE READ OFF THE ARTIFACT, AND THEY DID NOT HAVE TO BE (2026-08-26).
 * `t` and `c` were carried from the previous output, so 500 rows were compared to themselves.
 * champ-model.MOVES holds the same 500 keys IN THE SAME ORDER with identical `t` and `c` — measured,
 * key for key — so the whole table is now built from it and the self-read is gone. The `c` mapping is
 * champ-model's Physical/Special/Status against the artifact's P/S, and it agrees on all 500.
 *
 * The visible consequence: this run reports base power CORRECTED on 12 rows rather than 0. Those 12
 * are champ-model's generic gen-9 base powers against the Champions format's, the same 12 named
 * above. Zero was never true — it was the artifact agreeing with the copy of itself it had just been
 * handed. */
  const moves = {};
  let bpFixed = 0, bpNoDex = 0;
  const bpFixedList = [];
  for (const [key, base] of Object.entries(M.MOVES)) {
    const mv = { t: base.t, c: base.c === 'Physical' ? 'P' : 'S', bp: base.bp || 0 };
    moves[key] = mv;
  try {
    const d = DEX && DEX.moves.get(key);
    if (d && d.exists) {
      const fmtBp = d.basePower || 0;
      if ((mv.bp || 0) !== fmtBp) { bpFixedList.push(`${key} ${mv.bp}->${fmtBp}`); bpFixed++; }
      mv.bp = fmtBp;
      if (d.recoil) mv.rc = d.recoil;
      else if (mv.rc) delete mv.rc;
      const _sb = selfBoostsOf(d);
      if (_sb) mv.self = _sb;
      else if (mv.self) delete mv.self;
    } else { bpNoDex++; }
  } catch (e) { bpNoDex++; /* keep whatever was stored */ }
  }
/* MOVES THE TABLE NEVER HAD. champ-model's compact table skipped every bp-0 callback move, so Low
 * Kick (2,055 sheet uses) and Grass Knot were UNLOOKUPABLE -- not weak, absent. Any move the tag
 * artifact knows (i.e. the format actually plays) and the table lacks is added from the dex, so a
 * used move can never again be missing by construction. */
  let added = 0;
try {
  const tagMoves = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tags.json'), 'utf8')).moves || {};
  for (const key of Object.keys(tagMoves)) {
    if (moves[key]) continue;
    const d = DEX && DEX.moves.get(key);
    if (!d || !d.exists) continue;
    moves[key] = { t: d.type, c: d.category === 'Physical' ? 'P' : 'S', bp: d.basePower || 0 };
    if (d.recoil) moves[key].rc = d.recoil;
    const _sb2 = selfBoostsOf(d);
    if (_sb2) moves[key].self = _sb2;
    added++;
  }
  if (added) say(`  moves added from tags.json ∩ dex (champ-model's table lacks them): ${added}`);
} catch (e) { console.warn('  could not backfill artifact moves:', e.message); }

  const MC = { mons, moves, C: M.C, priors: SRC_PRIORS };
  return { MC, carriedBy, declaredKeys, undeclared, bpFixed, bpFixedList, bpNoDex, added };
}

/* RENDER. Swap ONLY the MC object into the WRAPPER, preserving mcEff and the export block. Rewriting
 * the whole file previously dropped those and broke every consumer — a generator must not quietly
 * change a module's public surface. The wrapper is data/engine-data.template.txt, not the artifact:
 * reading it off the output made a from-scratch build impossible and made the builder unable to run
 * at all when its own output was absent. */
function render(MC, date) {
  const src = TEMPLATE;
  const m = src.match(/const MC = \{[\s\S]*?\};/);
  if (!m) { console.error('could not locate the MC object in ' + TEMPLATE_F); process.exit(1); }
  const stamp = `/* engine-data.js — the Champions mon/move/type-chart data.
 * GENERATED for the MC object by ABRA/build/build_engine_data.js from CHOMP/engine/champ-model.js.
 * Carries BOTH base stats (bs) and the level-50 line (st) so consumers can RECOMPUTE, not just copy.
 * Last generated: ${date}. Do not hand-edit the MC object. */\n`;
  let out = src.replace(m[0], 'const MC = ' + JSON.stringify(MC) + ';');
/* THE HEADER STAMP DID NOT MATCH ON THIS MACHINE AND NOBODY KNEW (2026-08-09). The pattern ended
 * `\*\/\n`; the checked-in file has CRLF endings, so it ended `*\/\r\n` and the replace matched
 * NOTHING. "Last generated: 2026-07-24" therefore survived every regeneration since — the artifact
 * has been stating a false date in its own first four lines, which is the silent-default failure this
 * project keeps paying for, in the one place a human actually looks. `\r?\n`, and the replace is now
 * CHECKED rather than assumed: a stamp that fails to land says so and exits non-zero, because a
 * generator that cannot date its own output must not pretend it did. */
/* THE GUARD BELOW TESTED THE WRONG THING UNTIL 2026-08-26, AND A GREEN CONTROL FOUND IT. It read
 * `if (stamped === out)`, using "the string changed" as a proxy for "the pattern matched". Those are
 * not the same claim, and they come apart in the one case that matters: when the header is ALREADY
 * exactly right — i.e. any SECOND run on the same calendar day — the replacement is a no-op, the
 * strings are equal, and the builder exited 1 announcing that the file "does not open with a block
 * comment", which was false. A generator that refuses to run twice in a day while misdiagnosing why
 * is the silent-default failure this project keeps paying for, wearing a loud error message.
 *
 * Found by running `--check` against the builder's OWN freshly-stamped output as a green control,
 * which is exactly the case a same-day re-run produces. Test the PATTERN, which is the condition the
 * message actually describes. */
  const HEADER = /^\/\*[\s\S]*?\*\/\r?\n/;
  const stamped = out.replace(HEADER, src.includes('\r\n') ? stamp.replace(/\n/g, '\r\n') : stamp);
  if (!HEADER.test(src)) {
    console.error('could not replace the header stamp in ' + TEMPLATE_F + ' — the template does not '
      + 'open with a block comment, so the "Last generated" date would silently stay stale. '
      + (CHECK ? 'The stamp step is BROKEN.' : 'Refusing to write.'));
    process.exit(1);
  }
  return stamped;
}
/* The date is passed in rather than taken inside `render`, so `--purity` can render two candidates
 * that differ ONLY in payload. A midnight rollover between two renders would otherwise read as
 * drift. */
const TODAY = new Date().toISOString().slice(0, 10);

/* ── THE ROW CENSUS ──────────────────────────────────────────────────────────────────────────────
 * The 2026-07-30 failure had a SHAPE — `ab: null`, `mv: []`, `item: null` on rows that should carry
 * values — and those three fields are precisely the ones this builder copies off the artifact and
 * therefore cannot compare (see the header). So they are COUNTED instead, every run, in both modes.
 *
 * A non-zero count is not automatically a defect, and "tolerated silently" is the thing to avoid, so
 * each flagged row is put to the format and DECLARED with a DERIVED reason rather than a typed one:
 *
 *   NOT IN THIS FORMAT — isNonstandard, or tier Illegal. It cannot be brought, so a team-build fact
 *                        about it is meaningless. (CLAUDE.md: the ban is a MECHANISM, not a list.)
 *   BATTLE-ONLY FORME  — species.battleOnly is set. Nobody builds Aegislash-Blade; it is a state the
 *                        base forme enters mid-game, so it has no item, ability prior or moveset.
 *
 * WEIGHT IS DELIBERATELY JUDGED ON A DIFFERENT RULE. `item`/`ab`/`mv` are TEAM-BUILD facts and a
 * forme that is never built legitimately lacks them. `wt` is a FIELD fact: it is read the moment the
 * forme is on the board, because Low Kick and Grass Knot scale with the target's weight and Heavy
 * Slam and Heat Crash with the ratio, and their dex basePower is 0 — so a missing weight makes those
 * moves UNCOMPUTABLE rather than merely mis-priced, which is invisible. A null `wt` is therefore
 * declared benign ONLY when the dex does not know the weight either. */
/* NO try/catch AROUND THE DEX LOOKUP, DELIBERATELY. `Dex.species.get` does not throw on an unknown
 * key — it returns a species with `exists: false` (verified against `not-a-real-mon-xyz` and the
 * empty string) — so a catch here could only ever swallow a REAL instrument failure and hand back a
 * null that reads identically to "this row has no declaration". That is the silent default this
 * project keeps paying for, and tests/test-no-silent-failure.js flagged it on the first draft of
 * this function. The dex-less case is handled ONCE, above the bands, and is announced. */
/* The bands are declared ONCE. The dex-less path and the normal path both walk this list, so the two
 * cannot come apart and report different sets of rows for the same artifact. */
const CENSUS_BANDS = [
  ['bs missing (buildMon returns null — UNBUILDABLE)', m => !m.bs, 'build'],
  ['ab null', m => m.ab == null, 'build'],
  ['mv empty', m => !m.mv || !m.mv.length, 'build'],
  ['item null', m => m.item == null, 'build'],
  ['wt null (Low Kick / Grass Knot / Heavy Slam / Heat Crash uncomputable)', m => m.wt == null, 'wt'],
];
function census(rows) {
  const ks = Object.keys(rows);
  const ask = k => DEX.species.get(k);
  const WHY = {
    build: k => {
      const s = ask(k);
      if (!s.exists) return null;
      if (s.isNonstandard || s.tier === 'Illegal') return 'not in this format';
      if (s.battleOnly) return 'battle-only forme';
      return null;
    },
    wt: k => { const s = ask(k); return (!s.exists || !s.weighthg) ? 'the dex has no weight either' : null; },
  };
  return CENSUS_BANDS.map(([label, pred, kind]) => {
    const hit = ks.filter(k => pred(rows[k]));
    /* Dex-less: nothing can be declared, and every row is left OPEN rather than quietly cleared.
     * printCensus announces the state; it is never inferred from the counts. */
    if (!DEX) return { label, n: hit.length, declared: {}, open: hit };
    const why = WHY[kind], declared = {}, open = [];
    for (const k of hit) { const r = why(k); if (r) (declared[r] = declared[r] || []).push(k); else open.push(k); }
    return { label, n: hit.length, declared, open };
  });
}
function printCensus(rows, what) {
  console.log(`  row census of ${what} (${Object.keys(rows).length} rows) — the 2026-07-30 shape:`);
  /* A build may legitimately run without the dex (it preserves what it cannot recompute). The census
   * cannot DECLARE anything in that state, so it says so instead of quietly declaring nothing and
   * letting every row read as UNEXPLAINED — a count nobody can act on is a count nobody reads. */
  if (!DEX) {
    console.log('    NO DECLARATIONS — the dex did not load, so no row can be put to the format.');
    console.log('    Raw counts only; do not read the UNEXPLAINED column on this run.');
  }
  let open = 0;
  for (const b of census(rows)) {
    const decl = Object.entries(b.declared).map(([r, ks]) => `${ks.length} ${r}`).join(', ');
    console.log(`    ${b.label}: ${b.n}` + (b.n ? `  [declared: ${decl || 'none'}]  [UNEXPLAINED: ${b.open.length}` +
      (b.open.length ? ' -> ' + b.open.join(', ') : '') + ']' : ''));
    open += b.open.length;
  }
  console.log(`    UNEXPLAINED rows in total: ${open}` + (open ? '  <- these are the ones to look at' : ''));
}

/* ── PURITY ──────────────────────────────────────────────────────────────────────────────────────
 * PROVE IT, DO NOT CLAIM IT. Build the identical MC twice — once with the previous artifact and once
 * with it hidden — and diff the two candidates. Whatever differs is a value that exists only inside
 * this builder's own output and cannot be checked against anything.
 *
 * The count is RATCHETED in data/engine-data-purity.json rather than asserted at zero, because zero
 * is not reachable from inside this file: the fields still carried belong to two LATER generators
 * that edit the artifact in place (see the header). A gate that is permanently red gets called "one
 * of the known failures" and then gets ignored, which is the failure mode this repository is named
 * after. A ratchet that may only fall does not. */
function purityReport(A, B) {
  const S = JSON.stringify;
  const rows = [];
  for (const top of ['mons', 'moves', 'C', 'priors']) {
    const a = A.MC[top] || {}, b = B.MC[top] || {};
    const ka = Object.keys(a), kb = Object.keys(b);
    const onlyA = ka.filter(k => !(k in b));
    const orderSame = S(ka.filter(k => k in b)) === S(kb.filter(k => k in a));
    const fields = {};
    let diffRows = 0;
    for (const k of ka) {
      if (!(k in b)) continue;
      if (S(a[k]) === S(b[k])) continue;
      diffRows++;
      const x = a[k] || {}, y = b[k] || {};
      if (x && typeof x === 'object' && !Array.isArray(x)) {
        for (const f of new Set([...Object.keys(x), ...Object.keys(y)])) {
          if (S(x[f]) !== S(y[f])) fields[f] = (fields[f] || 0) + 1;
        }
      } else fields['(whole row)'] = (fields['(whole row)'] || 0) + 1;
    }
    rows.push({ top, lostRows: onlyA, diffRows, fields, orderSame });
  }
  return rows;
}

if (PURITY) {
  const A = buildMC(readPrior(), true);
  const B = buildMC(null, true);
  const bytesA = render(A.MC, TODAY), bytesB = render(B.MC, TODAY);
  const identical = normalise(bytesA) === normalise(bytesB);
  console.log('build_engine_data --purity — the same build, with and without its own previous output\n');
  console.log(`  with the artifact   : ${Buffer.byteLength(bytesA)} bytes`);
  console.log(`  with it hidden      : ${Buffer.byteLength(bytesB)} bytes`);
  console.log(`  IDENTICAL           : ${identical ? 'YES — this builder is a pure function of upstream' : 'NO'}\n`);
  let carried = 0;
  for (const r of purityReport(A, B)) {
    const lost = r.lostRows.length;
    if (!lost && !r.diffRows && r.orderSame) { console.log(`  ${r.top}: pure (${Object.keys(A.MC[r.top]).length} rows)`); continue; }
    console.log(`  ${r.top}: ${r.diffRows} row(s) differ, ${lost} row(s) exist only with the artifact`
      + (r.orderSame ? '' : ', AND THE KEY ORDER DIFFERS'));
    if (lost) console.log(`     lost without the artifact: ${r.lostRows.slice(0, 20).join(', ')}`);
    for (const [f, n] of Object.entries(r.fields).sort((x, y) => y[1] - x[1])) {
      console.log(`     ${f}: ${n} value(s)`);
      carried += n;
    }
    carried += lost * 8;
  }
  console.log(`\n  CARRIED FIELD VALUES (by field, over rows that survive): `
    + Object.entries(A.carriedBy).sort((x, y) => y[1] - x[1]).map(([f, n]) => `${f} ${n}`).join(', '));
  const total = Object.values(A.carriedBy).reduce((s, n) => s + n, 0);
  console.log(`  TOTAL CARRIED VALUES: ${total}`);
  console.log('  Owner: build/rebuild_sets_from_sheets.js (mv,item,ab,nature,sp,st,set_source) and');
  console.log('         engine/merge_mega_into_engine.js (base,mega,mv_provenance). Both edit');
  console.log('         data/engine-data.js IN PLACE, which is why this builder must carry them.');
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(RATCHET_F, 'utf8')); } catch (e) { /* first run */ }
  const body = { note: 'GENERATED RATCHET — do not hand-edit. Written by build/build_engine_data.js --purity.',
    rule: 'carried_values may FALL and may never RISE. It is the number of values data/engine-data.js '
        + 'holds that come off its own previous copy, so nothing can compare them to a source. Zero is '
        + 'reached when build/rebuild_sets_from_sheets.js and engine/merge_mega_into_engine.js write '
        + 'their own layer files instead of editing the artifact in place.',
    generated: new Date().toISOString(), carried_values: total, carried_by_field: A.carriedBy,
    undeclared_rows: A.undeclared, pure_sections: purityReport(A, B).filter(r => !r.lostRows.length && !r.diffRows && r.orderSame).map(r => r.top) };
  if (prev && total > prev.carried_values) {
    console.error(`\n  RATCHET BROKEN: ${prev.carried_values} -> ${total}. This builder now reads MORE of`);
    console.error('  its own output than it did. Give the new fields a source under data/ instead.');
    process.exit(1);
  }
  if (!process.argv.includes('--no-write-ratchet')) {
    fs.writeFileSync(RATCHET_F, JSON.stringify(body, null, 1) + '\n');
    console.log(`\n  ratchet: ${prev ? prev.carried_values + ' -> ' : ''}${total}  (data/engine-data-purity.json)`);
  }
  process.exit(0);
}

if (CHECK) {
  /* --check. Nothing below writes. The RUN DATE is normalised out on both sides — it is rewritten on
   * every build by design, and comparing it would make this check permanently red for a reason that
   * is not drift, which is how a gate becomes "one of the known failures". The stamp step is still
   * exercised, so a stamp that could not land is a failure here too; it is just not the same failure
   * as drift.
   *
   * IT COMPARES THE STAMPED CANDIDATE NOW, NOT THE UNSTAMPED ONE. The wrapper used to come off the
   * artifact itself, so the header matched by construction and could not be checked. It comes from
   * data/engine-data.template.txt now, so the artifact's own header shape is compared too — a hand
   * edit to the first four lines is drift and reads as drift.
   *
   * `normalise` on both sides is belt-and-braces against the CRLF trap. See the EOL section in the
   * header. */
  const prior = readPrior();
  if (!prior) {
    console.error('build_engine_data --check: NO VERDICT. data/engine-data.js is absent or its MC');
    console.error('  object does not parse, so there is nothing on disk to compare. Run the builder.');
    process.exit(2);
  }
  const built = buildMC(prior);
  const MC = built.MC;
  const src = fs.readFileSync(OUT, 'utf8');
  const undate = s => normalise(s).replace(/Last generated: \d{4}-\d{2}-\d{2}/, '<DATE>');
  const disk = undate(src), want = undate(render(MC, TODAY));
  /* The census in check mode is taken over `prior.mons` — the rows ON DISK — and NOT over the
   * candidate. The artifact is what every engine release froze and what the rollout actually reads;
   * censusing the candidate would describe a file that does not exist yet. */
  printCensus(prior.mons || {}, 'THE ARTIFACT ON DISK — the bytes every release froze');
  console.log(`  sources: CHOMP/engine/champ-model.js (${Object.keys(M.MONS).length} mons, `
    + `${Object.keys(M.MOVES).length} moves), the Champions dex, data/tags.json, data/mc-priors.json `
    + `(${Object.keys(SRC_PRIORS).length}), data/mc-declared-rows.json (${Object.keys(SRC_DECLARED).length}), `
    + 'data/engine-data.template.txt');
  const stampedDate = (src.match(/Last generated: (\d{4}-\d{2}-\d{2})/) || [])[1] || 'UNSTAMPED';
  console.log(`  header stamp on disk: ${stampedDate} (excluded from the verdict — rewritten every build)`);
  const carriedTotal = Object.values(built.carriedBy).reduce((s, n) => s + n, 0);
  console.log(`  NOT PROVEN BY THIS CHECK: ${carriedTotal} field values carried off the artifact `
    + 'itself. Run --purity for the breakdown.');

  if (disk === want) {
    console.log('data/engine-data.js is exactly what its sources would produce today.');
    process.exit(0);
  }

  console.error('data/engine-data.js DOES NOT MATCH its sources — the artifact frozen into every');
  console.error('engine release disagrees with the model it is generated from.');
  const S = JSON.stringify;
  let had = null;
  try { had = JSON.parse(disk.match(/const MC = (\{[\s\S]*?\});/)[1]); }
  catch (e) { console.error(`  the MC object on disk is not parseable — ${e.message}`); }
  if (had) {
    for (const top of new Set([...Object.keys(had), ...Object.keys(MC)])) {
      if (S(had[top]) === S(MC[top])) continue;
      const a = had[top] || {}, b = MC[top] || {};
      if (a && b && typeof a === 'object' && typeof b === 'object') {
        const rows = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(r => S(a[r]) !== S(b[r]));
        console.error(`  ${top}: ${rows.length} row(s) differ — ${rows.slice(0, 12).join(', ')}${rows.length > 12 ? ' …' : ''}`);
        /* Named per FIELD, not "row 210 differs". A diff nobody can act on gets waived. */
        for (const r of rows.slice(0, 8)) {
          if (!(r in a)) { console.error(`     ${r}: MISSING FROM THE ARTIFACT — the source carries it`); continue; }
          if (!(r in b)) { console.error(`     ${r}: PRESENT ONLY IN THE ARTIFACT — no source row and no preserve rule`); continue; }
          const x = a[r] || {}, y = b[r] || {};
          const flds = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(f => S(x[f]) !== S(y[f]));
          console.error(`     ${r}: ${flds.map(f => `${f} ${S(x[f])} -> ${S(y[f])}`).join(' | ').slice(0, 200)}`);
        }
      } else { console.error(`  ${top}: differs`); }
    }
    /* KEY ORDER, WHICH THIS CHECK COULD NOT SEE UNTIL 2026-08-26. Every comparison above is over
     * PARSED objects, so a section whose rows are identical but re-ordered reported "0 rows differ"
     * while the byte comparison said drift — a diff that named nothing, which is worse than none.
     * The order is load-bearing here: this artifact is frozen into every engine release, so a
     * reordered key set is a byte change in all of them. Measured on the day this clause was added:
     * five rows (castform-snowy/rainy/sunny at 35-37, morpeko-hangry at 182, mimikyu-busted at 200)
     * sit mid-file in the artifact and at the end in the candidate, because champ-model dropped them
     * after the artifact was last built. */
    for (const top of ['mons', 'moves', 'C', 'priors']) {
      const a = Object.keys(had[top] || {}), b = Object.keys(MC[top] || {});
      const common = k => a.includes(k) && b.includes(k);
      const ao = a.filter(common), bo = b.filter(common);
      if (S(ao) === S(bo)) continue;
      const i = ao.findIndex((k, j) => k !== bo[j]);
      console.error(`  ${top}: KEY ORDER differs from index ${i} — artifact has "${ao[i]}", the `
        + `sources produce "${bo[i]}". Same rows, different order; the bytes are not the same.`);
    }
    /* Bytes outside the MC object — a hand-edit to the wrapper, mcEff or the export block. It is a
     * separate failure from a payload drift and would otherwise be reported as neither. */
    const strip = s => s.replace(/const MC = \{[\s\S]*?\};/, '<PAYLOAD>').replace(/Last generated: \d{4}-\d{2}-\d{2}/, '<DATE>');
    if (strip(disk) !== strip(want)) console.error('  AND the wrapper/mcEff/export block differs from what this builder would leave.');
  }
  console.error('  fix: node build/build_engine_data.js — BUT READ THIS FIRST. data/engine-data.js is');
  console.error('  in engine_release.js SOURCES, so it is frozen into every release. Regenerating it');
  console.error('  changes the bytes every future release freezes and is a decision, not a chore.');
  process.exit(1);
}

const built = buildMC(readPrior());
const MC = built.MC, mons = MC.mons;
fs.writeFileSync(OUT, render(MC, TODAY));

printCensus(mons, 'what was just written');
console.log(`build_engine_data — ${Object.keys(mons).length} species written`);
console.log(`  base stats present: ${Object.values(mons).filter(m => m.bs).length}`);
console.log(`  rows from data/mc-declared-rows.json (champ-model does not carry them): ${built.declaredKeys.length}` +
  (built.declaredKeys.length ? ` -> ${built.declaredKeys.join(', ')}` : ''));
/* DERIVED, NOT TYPED. The declared file says three of these carry a type their base forme does not;
 * that claim is re-checked here against the dex and the artifact's own base row on every run, so it
 * cannot rot inside a JSON header the way the ban list of four did. */
if (DEX) {
  const material = built.declaredKeys.filter(k => {
    const base = DEX.species.get(k).baseSpecies;
    const bk = base && Object.keys(mons).find(x => DEX.species.get(x).name === base);
    return bk && mons[bk] && JSON.stringify(mons[bk].t) !== JSON.stringify(mons[k].t);
  });
  console.log(`    of those, BOARD-MATERIAL (type differs from the base forme's): ${material.length}`
    + (material.length ? ` -> ${material.map(k => `${k} ${JSON.stringify(mons[k].t)}`).join(', ')}` : ''));
}
console.log(`  moves built from champ-model.MOVES + the dex: ${Object.keys(MC.moves).length}`
  + (built.added ? ` (${built.added} added from tags.json ∩ dex)` : '')
  + ` | type chart: ${Object.keys(MC.C).length} | priors from data/mc-priors.json: ${Object.keys(MC.priors).length}`);
console.log(`  base power taken from the format: ${built.bpFixed} row(s) CORRECTED` +
  (built.bpFixed ? ` -> ${built.bpFixedList.join(', ')}` : '') +
  (built.bpNoDex ? ` | ${built.bpNoDex} row(s) the dex does not know, stored value kept` : ''));
console.log(`  weights present: ${Object.values(mons).filter(m => m.wt != null).length}`);
console.log(`  field values carried off the previous artifact: `
  + Object.values(built.carriedBy).reduce((s, n) => s + n, 0) + '  (run --purity for the breakdown)');
console.log('  wrapper, mcEff and exports taken from data/engine-data.template.txt');
