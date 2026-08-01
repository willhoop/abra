/* test-oracle-differential.js — ask the simulator, do not assume.
 *
 * WHY THIS EXISTS (whole-repo review, 2026-07-31 — 164 confirmed findings)
 * -----------------------------------------------------------------------
 * The review's own estimate was that ROUGHLY HALF the confirmed defects were checkable automatically
 * against the Pokemon Showdown simulator this repository already bundles. Every one of them is a
 * claim about the GAME that the game itself could have answered:
 *
 *   magnemite.js    "Tailwind lasts N turns"        -> the dex condition says 4. It said 3, for the
 *                                                      entire history of the project.
 *   engine-data.js  "Gengar has Pressure"           -> the dex says Cursed Body. 133 of 205 species
 *                                                      carried an ability no forme of theirs can have.
 *   engine-data.js  "Garchomp runs Thrash"          -> the learnset and 4,742 real sheets both say no.
 *   durable-ingest  "this set has four moves"       -> 39.4% of bo3 sets had more, up to twelve.
 *   board.js        "my ally is not hit"            -> the move's target field says whether it is.
 *
 * The one part of this project nothing surprising ever comes out of is the damage engine — and that
 * is the one part with a differential test against an independent implementation. That is not a
 * coincidence; it is the proof that this method works. This file extends it from damage to the rest
 * of the game.
 *
 * WHAT MAKES A GOOD ORACLE CHECK. It compares two INDEPENDENT sources for the same fact: ours, and
 * Showdown's. It must not restate our own number back to itself — a check that reads board.js and
 * asserts board.js is internally consistent proves nothing, and the review found several of those.
 *
 * SCOPE, STATED. This covers claims about RULES and DATA. It cannot check judgement (is this feature
 * predictive?), pipeline correctness (did the merge lose records?), or reporting discipline (does the
 * doc match the artifact). Those need different guards — the review was explicit that roughly half
 * the findings are not of this kind.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));

const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let pass = 0, fail = 0;
const ok = (cond, what, detail) => {
  if (cond) { pass++; console.log(`  ok   ${what}`); }
  else { fail++; console.log(`  FAIL ${what}${detail ? '   -- ' + detail : ''}`); }
};

/* A GUARD THAT CHECKED NOTHING MUST NOT REPORT SUCCESS.
 *
 * Every section below counts what it compared. If a dex lookup starts throwing — a Showdown upgrade,
 * a renamed accessor, a missing learnset file — the per-item catches would skip every item and the
 * section would print "0 species have only learnable moves" and PASS. That is exactly the shape of
 * engine/validate_damage.js, which printed PASS with 36 of 36 scenarios erroring because they left
 * both the numerator and the denominator. Coverage is asserted first, everywhere. */
const covered = (n, what, min) => ok(n >= (min == null ? 1 : min),
  `compared ${n} ${what}`, n === 0 ? 'NOTHING was compared — the oracle is not reaching the dex' : 'too few to be meaningful');

console.log('ORACLE DIFFERENTIAL — every claim about the GAME, checked against Showdown\n');

/* ============================================================================================
 * 1. DURATIONS. The bug: magnemite cached an empty table and every duration silently became 3.
 * ========================================================================================== */
console.log('1. move durations');
{
  /* Derived, not typed: every move in the format that creates a timed condition. */
  const timed = [];
  for (const m of dex.moves.all()) {
    if (!m || !m.exists || m.isNonstandard) continue;
    const d = m.condition && m.condition.duration;
    if (typeof d === 'number') timed.push({ id: m.id, name: m.name, dur: d });
  }
  ok(timed.length > 0, `the dex exposes timed conditions (${timed.length} moves)`);

  /* The engine's own answer, however it gets there. magnemite does not export volatileDuration, so
   * this asks the thing a consumer would ask: does ANY of our code know these numbers, or is the
   * fallback the only path? A table that returns the same constant for every move is the signature
   * of the bug this check exists for. */
  let M = null, loadErr = null;
  try { M = require(path.join(ROOT, 'engine', 'magnemite.js')); } catch (e) { loadErr = e; }
  ok(!loadErr, 'magnemite loads for the duration comparison', loadErr && loadErr.message);
  const durOf = M && (M.volatileDuration || (M.__test && M.__test.volatileDuration));
  if (typeof durOf !== 'function') {
    console.log('       (magnemite does not export volatileDuration; checking the dex is self-consistent only)');
    const uniq = new Set(timed.map(t => t.dur));
    ok(uniq.size > 1, `durations genuinely vary in the dex (${[...uniq].sort().join(', ')})`,
      'if every duration were identical this check could not detect a constant-returning table');
  } else {
    const wrong = timed.filter(t => durOf(t.id) !== t.dur);
    ok(wrong.length === 0, `all ${timed.length} timed conditions match the dex`,
      wrong.slice(0, 5).map(t => `${t.name}: ours ${durOf(t.id)} vs dex ${t.dur}`).join('; '));
  }
}

/* ============================================================================================
 * 2. ABILITY LEGALITY. The bug: 133 of 205 species carried an impossible ability.
 * ========================================================================================== */
console.log('\n2. every species ability is one that species can have');
{
  let checked = 0, bad = [];
  let megaErr = null;
  const megaDex = (() => {
    try { return require(path.join(ROOT, 'data', 'mega-dex-official.json')).forms; }
    catch (e) { megaErr = e; return null; }
  })();
  /* WITHOUT THE MEGA DEX THIS CHECK IS WRONG, not merely weaker: mega formes legitimately change the
   * ability and this table stores the mega's under the base key, so every one of them would read as
   * illegal. Fail rather than produce a confident false positive. */
  ok(!megaErr && megaDex, 'the mega forme table loads (mega abilities are legal and must not be flagged)',
    megaErr && megaErr.message);
  for (const [name, mon] of Object.entries(MC.mons)) {
    const have = norm(mon.ab);
    if (!have) continue;
    const legal = new Set();
    const sp = dex.species.get(name);
    if (sp && sp.exists) for (const a of Object.values(sp.abilities || {})) legal.add(norm(a));
    /* MEGA FORMES LEGITIMATELY CHANGE THE ABILITY, and this table stores the mega's under the base
     * key — Eelektross holds "eelevate", a real Champions mega ability. Counting those as illegal is
     * how the first version of this check reported 53.9% and was wrong. */
    if (megaDex) for (const k of Object.keys(megaDex)) {
      if (!k.startsWith(norm(name)) || !/mega/.test(k)) continue;
      const f = megaDex[k];
      if (f && f.ability) legal.add(norm(f.ability));
      for (const a of Object.values((f && f.all_abilities) || {})) legal.add(norm(a));
    }
    if (!legal.size) continue;
    checked++;
    if (!legal.has(have)) bad.push(`${name}="${mon.ab}" (legal: ${[...legal].join('/')})`);
  }
  covered(checked, 'species abilities', 100);
  ok(bad.length === 0, `${checked} species abilities are legal for their forme`,
    `${bad.length} illegal, e.g. ${bad.slice(0, 4).join('; ')}`);
}

/* ============================================================================================
 * 3. MOVE LEGALITY. The bug: Garchomp with Thrash and Outrage, from a foreign dataset.
 * ========================================================================================== */
console.log('\n3. every stored move is one that species can learn');
{
  let checked = 0, bad = [];
  for (const [name, mon] of Object.entries(MC.mons)) {
    if (!Array.isArray(mon.mv) || !mon.mv.length) continue;
    const sp = dex.species.get(name);
    if (!sp || !sp.exists) continue;
    let ls = null;
    try { ls = dex.species.getLearnsetData(sp.id); } catch (e) { ls = null; }
    if (!ls || !ls.learnset) continue;          // no learnset data -> nothing to compare against
    checked++;
    for (const mv of mon.mv) {
      const id = norm(mv);
      if (!id) continue;
      if (!ls.learnset[id]) bad.push(`${name} cannot learn ${mv}`);
    }
  }
  covered(checked, 'species learnsets', 100);
  ok(bad.length === 0, `${checked} species have only learnable moves`,
    `${bad.length} illegal, e.g. ${bad.slice(0, 5).join('; ')}`);
}

/* ============================================================================================
 * 4. SET SIZE. The bug: 39.4% of bo3 sets carried more than four moves, up to twelve.
 * ========================================================================================== */
console.log('\n4. no stored set exceeds four moves');
{
  const over = Object.entries(MC.mons).filter(([, m]) => Array.isArray(m.mv) && m.mv.length > 4);
  ok(over.length === 0, 'every stored moveset is four moves or fewer',
    over.slice(0, 5).map(([n, m]) => `${n} has ${m.mv.length}`).join('; '));
  const dup = Object.entries(MC.mons).filter(([, m]) =>
    Array.isArray(m.mv) && new Set(m.mv.map(norm)).size !== m.mv.length);
  ok(dup.length === 0, 'no stored moveset repeats a move',
    dup.slice(0, 5).map(([n]) => n).join('; '));
}

/* ============================================================================================
 * 5. TYPE CHART. Ours against the dex's, every ordered pair.
 * ========================================================================================== */
console.log('\n5. the type chart matches the dex');
{
  const types = dex.types.all().map(t => t.name).filter(Boolean);
  let compared = 0, bad = [];
  const mcEff = globalThis.mcEff;
  if (typeof mcEff !== 'function') {
    ok(false, 'engine-data exposes mcEff for comparison', 'not a function');
  } else {
    for (const atk of types) {
      for (const def of types) {
        const theirs = dex.getEffectiveness(atk, [def]);
        const immune = !dex.getImmunity(atk, [def]);
        const expect = immune ? 0 : Math.pow(2, theirs);
        let ours;
        try { ours = mcEff(atk, [def]); } catch (e) { continue; }
        if (typeof ours !== 'number') continue;
        compared++;
        if (Math.abs(ours - expect) > 1e-9) bad.push(`${atk}->${def}: ours ${ours} vs dex ${expect}`);
      }
    }
    covered(compared, 'type pairings', 100);
    ok(bad.length === 0, `${compared} type pairings match the dex`,
      `${bad.length} differ, e.g. ${bad.slice(0, 5).join('; ')}`);
  }
}

/* ============================================================================================
 * 6. BASE STATS. Ours against the dex's, so a stat line cannot drift.
 * ========================================================================================== */
console.log('\n6. base stats match the dex');
{
  const map = { hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe' };
  let checked = 0, bad = [];
  for (const [name, mon] of Object.entries(MC.mons)) {
    if (!mon.bs) continue;
    const sp = dex.species.get(name);
    if (!sp || !sp.exists || !sp.baseStats) continue;
    checked++;
    for (const k of Object.keys(map)) {
      if (mon.bs[k] == null) continue;
      if (mon.bs[k] !== sp.baseStats[k]) { bad.push(`${name}.${k}: ours ${mon.bs[k]} vs dex ${sp.baseStats[k]}`); break; }
    }
  }
  covered(checked, 'base-stat lines', 100);
  ok(bad.length === 0, `${checked} species base-stat lines match the dex`,
    `${bad.length} differ, e.g. ${bad.slice(0, 4).join('; ')}`);
}

/* ============================================================================================
 * 7. SPREAD MOVES AND THE ALLY. The bug Will found: a partner's Protect spares the ally, and
 *    allyHit could not see it. This checks the simpler half the dex can settle alone — whether a
 *    move hits the ally at all is its `target`, not something to infer.
 * ========================================================================================== */
console.log('\n7. spread-move targeting matches the dex');
{
  let checked = 0, bad = [];
  for (const [id, mv] of Object.entries(MC.moves || {})) {
    const d = dex.moves.get(norm(id));
    if (!d || !d.exists) continue;
    checked++;
    /* Our table marks spread moves; the dex names exactly which targets they reach. A move our data
     * calls spread that the dex says is single-target (or vice versa) is a real divergence. */
    const dexSpread = d.target === 'allAdjacent' || d.target === 'allAdjacentFoes';
    const ourSpread = !!(mv && (mv.spread || mv.isSpread));
    if (mv && ('spread' in mv || 'isSpread' in mv) && dexSpread !== ourSpread)
      bad.push(`${id}: ours spread=${ourSpread} vs dex target=${d.target}`);
  }
  covered(checked, 'moves for spread targeting', 100);
  ok(bad.length === 0, `${checked} moves agree with the dex on spread targeting`,
    `${bad.length} differ, e.g. ${bad.slice(0, 5).join('; ')}`);
}

console.log(`\nORACLE DIFFERENTIAL: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\n  Each failure above is a claim this project makes about Pokemon that the bundled');
  console.log('  simulator disagrees with. The simulator is the authority; fix the data or the code,');
  console.log('  not this test.');
}
process.exit(fail ? 1 : 0);
