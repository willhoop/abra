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
 * READ THIS BEFORE BELIEVING A GREEN RUN. This builder is NOT a pure transform: it reads the
 * artifact it is about to overwrite and CARRIES most of it through (`...old`, `prior.moves`,
 * `prior.priors`, and the `preserved` rows). So the check divides cleanly in two, and only one half
 * is provable:
 *
 *   PROVABLE — the fields this builder OWNS, recomputed from a source outside the artifact:
 *     mons[k].t, mons[k].bs   from CHOMP/engine/champ-model.js
 *     mons[k].wt              from the Champions dex (species.weighthg)
 *     moves[k].bp, .rc, .self from the Champions dex
 *     moves added by the tags.json ∩ dex backfill
 *     MC.C (the type chart)   from champ-model
 *     the KEY SET of mons     champ-model's keys ∪ the preserved rows
 *
 *   NOT PROVABLE — the fields this builder COPIES OFF THE ARTIFACT. They compare equal to
 *   themselves by construction and always will:
 *     mons[k].st, .mv, .item, .ab, .nature, .sp, .set_source, .mv_provenance
 *     moves[k].t and .c on any pre-existing row
 *     MC.priors, and every `preserved` row in full
 *
 * THAT SECOND LIST IS WHERE THE 2026-07-30 BUG LIVED. `ab`, `mv` and `item` are exactly the three
 * fields this check cannot compare. So it is NOT sufficient on its own, and the ROW CENSUS below —
 * printed on every run, in both modes — is the compensating instrument: it counts the null/empty
 * shape of that failure directly and DECLARES the expected ones with a DERIVED reason.
 *
 * Four more things get through, named so nobody has to rediscover them:
 *
 *  1. A SECOND ARTIFACT WRITTEN BY THIS BUILDER would NOT be caught. This builder writes exactly
 *     one file, so the question is moot here — but the check is written against OUT, not against a
 *     scan of what was written, so if a second output were added it would need its own clause. This
 *     is the instance-not-class hazard engine/read_text.js spends its header on.
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
if (CHECK && !DEX) {
  console.error('build_engine_data --check: NO VERDICT. The Champions dex did not load, so every');
  console.error('  dex-owned field (wt, bp, rc, self) would fall back to the artifact\'s own stored');
  console.error('  value and compare equal to itself. That is not a pass, it is a check asking');
  console.error('  nothing. Fix the dex (engine/champions_sim.js / SHOWDOWN_PATH) and re-run.');
  process.exit(2);
}
const OUT = path.join(__dirname, '..', 'data', 'engine-data.js');

// keep whatever move/item/ability priors the previous file carried - those are ABRA's, not the
// engine's - but rebuild everything the engine owns.
let prior = {};
try {
  const t = fs.readFileSync(OUT, 'utf8');
  prior = JSON.parse(t.match(/const MC = (\{[\s\S]*?\});/)[1]);
} catch (e) { /* first run */ }

const mons = {};
for (const [key, m] of Object.entries(M.MONS)) {
  const old = (prior.mons || {})[key] || {};
  /* EVERY FIELD THIS BUILDER DOES NOT OWN IS CARRIED THROUGH (2026-08-09). It used to construct a
   * fresh literal, so a regeneration DELETED `nature`, `sp` and `set_source` from all 318 rows —
   * fields written by a LATER builder (engine/derive_sets.js, build/rebuild_sets_from_sheets.js).
   * Measured, not guessed: a trial regeneration produced 800 semantic differences against the
   * artifact, of which 788 were these three fields disappearing and only 12 were the base powers
   * this pass came to fix. Same shape as the mega-ability hole CLAUDE.md records — "a later
   * wholesale regeneration left the nulls in place" — and it would have been invisible, because a
   * missing `set_source` reads downstream as "assumed" rather than as "deleted". The spread comes
   * FIRST so the fields below still win; this builder remains authoritative for its own. */
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
    wt: (() => {
      try {
        const sp = DEX && DEX.species.get(key);
        if (sp && sp.exists && sp.weighthg) return sp.weighthg / 10;
      } catch (e) { /* fall through */ }
      return old.wt != null ? old.wt : null;
    })(),
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
 * a divergence between two sources that somebody should eventually reconcile — not a fact. */
/* THE USER'S OWN BOOST, FROM WHICHEVER FIELD SHOWDOWN PUT IT IN. Never guess between them: a move
 * that carries both would be a real upstream oddity, so it is reported rather than silently merged. */
function selfBoostsOf(d) {
  const a = d.self && d.self.boosts, b = d.selfBoost && d.selfBoost.boosts;
  if (a && b) console.warn(`  ${d.id}: carries BOTH self.boosts and selfBoost.boosts — using self.boosts`);
  return a || b || null;
}

const preserved = Object.keys(prior.mons || {}).filter(k => !(k in mons));
for (const k of preserved) mons[k] = prior.mons[k];

/* MOVES: keep the stored t/c (champ-model's own compact table) but ENRICH from the dex with the
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
 * it. */
const moves = {};
let bpFixed = 0, bpNoDex = 0;
const bpFixedList = [];
for (const [key, mv] of Object.entries(prior.moves || {})) {
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
try {
  const tagMoves = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tags.json'), 'utf8')).moves || {};
  let added = 0;
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
  if (added) console.log(`  moves added from the artifact+dex (were unlookupable): ${added}`);
} catch (e) { console.warn('  could not backfill artifact moves:', e.message); }

const MC = {
  mons,
  moves,
  C: M.C,
  priors: prior.priors || {},
};

// Surgical replacement: swap ONLY the MC object inside the existing file, preserving its wrapper,
// its mcEff helper and its export block. Rewriting the whole file previously dropped those and broke
// every consumer - a generator must not quietly change a module's public surface.
const src = fs.readFileSync(OUT, 'utf8');
const m = src.match(/const MC = \{[\s\S]*?\};/);
if (!m) { console.error('could not locate the MC object in ' + OUT); process.exit(1); }
const stamp = `/* engine-data.js — the Champions mon/move/type-chart data.
 * GENERATED for the MC object by ABRA/build/build_engine_data.js from CHOMP/engine/champ-model.js.
 * Carries BOTH base stats (bs) and the level-50 line (st) so consumers can RECOMPUTE, not just copy.
 * Last generated: ${new Date().toISOString().slice(0, 10)}. Do not hand-edit the MC object. */\n`;
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
  console.error('could not replace the header stamp in ' + OUT + ' — the file does not open with a ' +
    'block comment, so the "Last generated" date would silently stay stale. ' +
    (CHECK ? 'The stamp step is BROKEN.' : 'Refusing to write.'));
  process.exit(1);
}

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

if (CHECK) {
  /* --check. Nothing below writes. The candidate is `out` rather than `stamped`, because the header
   * carries the RUN DATE and is rewritten on every build by design — comparing it would make this
   * check permanently red for a reason that is not drift, which is how a gate becomes "one of the
   * known failures". The stamp step is still exercised above, so a stamp that could not land is a
   * failure here too; it is just not the same failure as drift.
   *
   * `normalise` on both sides is belt-and-braces: `out` is `src` with one JSON substitution, so it
   * already carries the file's own line endings. See the EOL section in the header. */
  const disk = normalise(src), want = normalise(out);
  /* The census in check mode is taken over `prior.mons` — the rows ON DISK — and NOT over the
   * candidate. The artifact is what every engine release froze and what the rollout actually reads;
   * censusing the candidate would describe a file that does not exist yet. */
  printCensus(prior.mons || {}, 'THE ARTIFACT ON DISK — the bytes every release froze');
  console.log(`  sources: CHOMP/engine/champ-model.js (${Object.keys(M.MONS).length} rows), the Champions dex, data/tags.json`);
  const stampedDate = (src.match(/Last generated: (\d{4}-\d{2}-\d{2})/) || [])[1] || 'UNSTAMPED';
  console.log(`  header stamp on disk: ${stampedDate} (excluded from the verdict — rewritten every build)`);

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

fs.writeFileSync(OUT, stamped);

printCensus(mons, 'what was just written');
console.log(`build_engine_data — ${Object.keys(mons).length} species written`);
console.log(`  base stats present: ${Object.values(mons).filter(m => m.bs).length}`);
console.log(`  species kept that champ-model no longer carries: ${preserved.length}` +
  (preserved.length ? ` -> ${preserved.join(', ')}` : ''));
console.log(`  moves preserved: ${Object.keys(MC.moves).length} | type chart: ${Object.keys(MC.C).length}`);
console.log(`  base power taken from the format: ${bpFixed} row(s) CORRECTED` +
  (bpFixed ? ` -> ${bpFixedList.join(', ')}` : '') +
  (bpNoDex ? ` | ${bpNoDex} row(s) the dex does not know, stored value kept` : ''));
console.log(`  weights present: ${Object.values(mons).filter(m => m.wt != null).length}`);
console.log('  wrapper, mcEff and exports left untouched');
