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
 *   node build/build_engine_data.js
 * Overwrites data/engine-data.js. Never hand-edit that file.
 */
'use strict';
const fs = require('fs'), path = require('path');
const M = require(path.join(__dirname, '..', '..', 'CHOMP', 'engine', 'champ-model.js'));
/* The dex, for the facts the engine owns and CHOMP's model does not carry — currently weight. */
let DEX = null;
try {
  const CS = require(path.join(__dirname, '..', 'engine', 'champions_sim.js'));
  DEX = CS.sim().Dex.forFormat(CS.FORMAT);
} catch (e) { console.warn('  no dex available — weights will fall back to whatever was stored'); }
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
const preserved = Object.keys(prior.mons || {}).filter(k => !(k in mons));
for (const k of preserved) mons[k] = prior.mons[k];

/* MOVES: keep the stored t/c (champ-model's own compact table) but ENRICH from the dex with the
 * self-cost facts the rollout previously kept as hand-typed name lists (Will: every click needs a
 * cost, priced into decisions — a cost table someone typed is a cost table someone forgot to type):
 *   rc    recoil as [numerator, denominator] of damage dealt — m.recoil is a plain dex field,
 *         exactly the case Will ruled "look it up, don't restate it in a tag"
 *   self  the move's own stat drops, from m.self.boosts (Superpower, Overheat, Close Combat)
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
      if (d.self && d.self.boosts) mv.self = d.self.boosts;
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
    if (d.self && d.self.boosts) moves[key].self = d.self.boosts;
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
const stamped = out.replace(/^\/\*[\s\S]*?\*\/\r?\n/, src.includes('\r\n') ? stamp.replace(/\n/g, '\r\n') : stamp);
if (stamped === out) {
  console.error('could not replace the header stamp in ' + OUT + ' — the file does not open with a ' +
    'block comment, so the "Last generated" date would silently stay stale. Refusing to write.');
  process.exit(1);
}
fs.writeFileSync(OUT, stamped);

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
