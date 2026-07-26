/* set_space.js — what can a given species actually be running, and how much of that can we see?
 *
 * WHY THIS EXISTS
 * ---------------
 * `build_lab` used to split moves with a hand-typed `LOCK_AT = 85`: at or above, the move is forced;
 * below, it is a choice. That number was invented, which S12/S13 forbid, and it was also wrong in
 * both directions. It called Garchomp's Earthquake (76.9%) a free choice when four fifths of real
 * Garchomps carry it, and it had nothing to say about how much room was left over once the standard
 * four were fixed.
 *
 * THE MEASUREMENT THAT REPLACES IT
 * --------------------------------
 * Smogon's move percentages are shares of SETS, and every set has exactly four moves, so for any
 * species the listed percentages plus "Other" sum to 400. That identity is the whole tool:
 *
 *     freedom = (400 - sum of the four most common moves) / 100
 *
 * which reads directly as "how many of the four slots does a real player change, on average". It is
 * not a threshold and nothing about it is chosen. Garchomp's top four sum to 328.9, so freedom is
 * 0.71 — most Garchomps run the standard four and about seven in ten deviate in one slot. Across 259
 * species with 2,000+ teams the average is 1.28, i.e. the four most common moves account for 68% of
 * every move slot played in the format.
 *
 * WHY 50% IS THE ONE PRINCIPLED CUTOFF
 * ------------------------------------
 * For deciding whether to force a move rather than roll for it, there is an exact answer and it does
 * not need tuning. If a move is truly on a fraction p of sets, always including it reproduces reality
 * on p of sets; sampling it with probability p reproduces reality on p^2 + (1-p)^2. Always-include
 * wins exactly when p > 1/2, since p - (p^2 + (1-p)^2) = (2p-1)(1-p). So: above half, force it;
 * below half, roll. The crossover is a property of the arithmetic, not a knob.
 *
 * Applied strictly this over-locks — 95 of 259 species come out with all four slots forced and a
 * single legal set, which contradicts the 35 distinct Garchomps in the real store. That is why
 * enumeration below works by SUBSTITUTION into the standard four rather than by filling open slots:
 * it keeps the arms realistic while still letting every one of them differ in exactly one thing.
 *
 * THE BLIND SPOT, WHICH IS THE REASON TO BE HUMBLE HERE
 * ----------------------------------------------------
 * Smogon lists moves individually down to about 1% and buckets the rest as "Other". That bucket runs
 * 15-20% for nearly every species, i.e. ~4-5% of all move slots, i.e.
 *
 *     P(a set contains at least one move we cannot see) = 1 - (1 - other/400)^4  ~= 17%
 *
 * About one real set in six contains a move this module will never propose. It is a floor on how
 * closely any generated set can match reality, and it is worth knowing before reading a build-lab
 * result as though the space were complete. Kingambit is the honourable exception at 2.7% — its four
 * best moves are Sucker Punch 99.4 / Kowtow Cleave 96.2 / Protect 76.0 / Iron Head 69.7 and there is
 * genuinely almost nothing else. Species like that are solved; the rest are sampled.
 *
 *   node engine/set_space.js Garchomp
 *   node engine/set_space.js --top 20        # the space for the 20 most-played species
 */
'use strict';
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* The one principled threshold in this file — see the header. Derived, not chosen. */
const ALWAYS_INCLUDE = 50;
/* Slots per set. The 400-sum identity depends on it, so it is named rather than sprinkled. */
const SLOTS = 4;

/* A candidate has to be common enough that a result about it generalises. Expressed as a share of
 * the freedom actually available rather than as an absolute percentage, so species with a lot of
 * room get more candidates and locked species get none, automatically. */
const CAND_SHARE_OF_FREEDOM = 0.10;

function pctOf(rows) {
  const m = {};
  for (const r of rows || []) m[norm(r.move || r.item || r.spread || r.ability)] = r.pct;
  return m;
}

/* ---- the space -------------------------------------------------------------------------------- */
function spaceFor(speciesName, SM) {
  SM = SM || (() => { try { return require('./smogon_priors.js').forSpecies(speciesName); } catch (e) { return null; } })();
  if (!SM || !SM.moves || SM.moves.length < SLOTS) return null;

  const moves = SM.moves.slice().sort((a, b) => b.pct - a.pct);
  const standard = moves.slice(0, SLOTS);
  const listed = moves.reduce((a, m) => a + m.pct, 0);
  /* "Other" is whatever the 400-sum identity says is missing. Reading it off the file would be
   * equivalent; deriving it means this stays correct if the parser ever drops a row. */
  const other = Math.max(0, SLOTS * 100 - listed);

  const freedom = (SLOTS * 100 - standard.reduce((a, m) => a + m.pct, 0)) / 100;
  const blind = other / 100;
  const pSetAffected = 1 - Math.pow(1 - other / (SLOTS * 100), SLOTS);

  /* Which of the standard four are genuinely forced, and which are merely usual. Only the merely
   * usual ones may be swapped out — swapping Fake Out off an Incineroar produces a set nobody runs. */
  const forced = standard.filter(m => m.pct >= ALWAYS_INCLUDE * 1.7);  /* 85%+: effectively part of it */
  const swappable = standard.filter(m => m.pct < ALWAYS_INCLUDE * 1.7);
  const floor = Math.max(1, freedom * 100 * CAND_SHARE_OF_FREEDOM);
  const alternates = moves.slice(SLOTS).filter(m => m.pct >= floor);

  return {
    species: speciesName,
    standard, forced, swappable, alternates,
    freedom, blind, pSetAffected, other,
    solved: alternates.length === 0,
  };
}

/* ---- enumeration: the standard build, plus one single-move substitution at a time ---------------
 * Every arm differs from the reference in exactly ONE move, which is what makes a win-rate
 * difference attributable. Combining that with items and spreads at the call site gives a full
 * factorial over the three factors without the move axis exploding. */
function moveCombos(space) {
  if (!space) return [];
  const base = space.standard.map(m => m.move);
  const out = [{ moves: base.slice(), label: 'standard', changed: null }];
  for (const drop of space.swappable) {
    for (const add of space.alternates) {
      out.push({
        moves: base.filter(m => m !== drop.move).concat([add.move]),
        label: `-${drop.move} +${add.move}`,
        changed: { drop: drop.move, add: add.move },
      });
    }
  }
  return out;
}

/* Items and spreads that carry enough usage to be worth an arm. Same share-of-mass logic.
 * `label` is what the caller applies; spreads are a nature plus six EVs, not a single string. */
function axis(rows, minShare, label) {
  const tot = (rows || []).reduce((a, r) => a + r.pct, 0) || 100;
  return (rows || []).filter(r => r.pct / tot >= minShare)
    .map(r => ({ value: r, pct: r.pct, label: label(r) }));
}

function factorial(speciesName, SM, opts) {
  opts = opts || {};
  const space = spaceFor(speciesName, SM);
  if (!space) return null;
  SM = SM || require('./smogon_priors.js').forSpecies(speciesName);
  const mc = moveCombos(space);
  const items = axis(SM.items, opts.itemShare || 0.05, r => r.item);
  const spreads = axis(SM.spreads, opts.spreadShare || 0.05, r => r.nature + ':' + (r.sp || []).join('/'));
  return {
    space, moveCombos: mc,
    items: items.length ? items : [{ value: null, pct: 100, label: '(prior)' }],
    spreads: spreads.length ? spreads : [{ value: null, pct: 100, label: '(prior)' }],
    get cells() { return mc.length * this.items.length * this.spreads.length; },
  };
}

/* ---- report ------------------------------------------------------------------------------------ */
function main() {
  const argv = process.argv.slice(2);
  const S = require('./smogon_priors.js');
  const P = S.priors();
  const topI = argv.indexOf('--top');
  /* A flag's VALUE is not a species name. Passing --top 14 used to look up a Pokemon called "14". */
  const names = argv.filter((a, i) => !a.startsWith('--') && !(topI >= 0 && i === topI + 1));
  let list = names;
  if (!list.length) {
    const n = topI >= 0 ? parseInt(argv[topI + 1], 10) || 15 : 15;
    list = Object.values(P.species || {}).sort((a, b) => (b.raw || 0) - (a.raw || 0)).slice(0, n)
      .map(x => x.name);
  }
  console.log('SET SPACE — what each species can be running, and what we cannot see\n');
  console.log('  species          freedom  visible  blind   sets we    move   x item  x spread  = cells');
  console.log('                   (slots)                   would miss combos');
  console.log('  ' + '-'.repeat(88));
  let total = 0;
  for (const nm of list) {
    const f = factorial(nm);
    if (!f) { console.log('  ' + String(nm).padEnd(17) + '(no Smogon entry)'); continue; }
    const s = f.space;
    total += f.cells;
    console.log('  ' + String(nm).padEnd(17) +
      s.freedom.toFixed(2).padStart(6) +
      (s.freedom - s.blind).toFixed(2).padStart(9) +
      s.blind.toFixed(2).padStart(8) +
      ((100 * s.pSetAffected).toFixed(0) + '%').padStart(10) +
      String(f.moveCombos.length).padStart(9) +
      String(f.items.length).padStart(8) +
      String(f.spreads.length).padStart(10) +
      String(f.cells).padStart(9) + (s.solved ? '  solved' : ''));
  }
  console.log('  ' + '-'.repeat(88));
  console.log('  total cells across these species: ' + total.toLocaleString());
  console.log('  at 2,000 games per cell that is ' + (total * 2000).toLocaleString() +
    ' games, ~' + (total * 2000 / 46 / 3600).toFixed(1) + ' hours at 46 games/sec\n');
  console.log('  freedom  = slots a real player changes away from the four most common moves');
  console.log('  blind    = the part of that hidden in Smogon\'s "Other" bucket');
  console.log('  cells    = full factorial, so move/item/spread INTERACTIONS are visible.');
  console.log('             One-factor-at-a-time cannot see them (Fisher 1926; Box/Hunter/Hunter ch.5).');
}

module.exports = { spaceFor, moveCombos, factorial, ALWAYS_INCLUDE, SLOTS };
if (require.main === module) main();
