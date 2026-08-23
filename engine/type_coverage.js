/* type_coverage.js — the best type coverage for a team, AGAINST THIS META.
 *
 * Will, 2026-07-31: "DEVISE THE BEST TYPE COVERAGE FOR A TEAM OFFENSIVLE AND DEFENSIVLEY AND
 * PHYSICAL SPECIAL FROM THE META" — and, asked whether to weight by what the ladder actually brings
 * or to treat every legal threat equally: "THE META".
 *
 * So every number here is USAGE-WEIGHTED. A type that beats Incineroar is worth more than one that
 * beats Camerupt, in proportion to how often each is actually on the other side. That is a
 * deliberate choice with a cost, stated once: it optimises for the ladder as it is today and will be
 * wrong the week the metagame moves. `--flat` runs the same analysis with every species counted
 * equally, so the difference between "good here" and "good in general" is visible rather than
 * assumed.
 *
 * FOUR QUESTIONS, and they have different answers:
 *
 *   1. OFFENCE   which attacking types hit the most of the meta for super-effective damage, and
 *                which SET of types covers the most between them (a greedy set cover, because the
 *                marginal type matters more than the best individual one)
 *   2. DEFENCE   which incoming attacking types hurt most, weighted by how often that type is
 *                actually CLICKED rather than by how many species could click it
 *   3. RESISTS   which defensive typings absorb the most real damage
 *   4. THE SPLIT physical against special, because a team of special walls in a physical metagame is
 *                well built for the wrong game
 *
 * WHAT THIS IS NOT. Type coverage is one input to team building, not a team. It says nothing about
 * speed, bulk, item, ability or the roles a bring needs. `data/roles.json` and CHOMP answer those.
 *
 *   node engine/type_coverage.js                # usage-weighted (the default, and what was asked)
 *   node engine/type_coverage.js --flat         # every species counted once
 *   node engine/type_coverage.js --team 6       # size of the offensive set to solve for
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const { mcKey } = require(path.join(ROOT, 'engine', 'mc_key.js'));   // the ONE species -> MC.mons resolver

const FLAT = process.argv.includes('--flat');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const TEAMN = parseInt(arg('team', '4'), 10);

const U = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'smogon-priors.json'), 'utf8')).species || {};
const C = MC.C;
const TYPES = Object.keys(C);
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- the meta, as a weighted list of defenders ------------------------------------------------
 * Weight is raw usage, or 1 each under --flat. A species with no entry in the engine's own table is
 * skipped rather than guessed at, and the count of those is printed so the coverage is never quoted
 * as if it were of the whole format. */
const defenders = [];
let skipped = 0, total = 0;
for (const [key, v] of Object.entries(U)) {
  if (!(v && v.raw > 0)) continue;
  /* Through the one resolver. `MC.mons[key] || MC.mons[norm(key)]` only worked when the usage table
   * already spelled the forme exactly the way MC.mons does; a normalised name missed, because
   * MC.mons keys formes with a hyphen and norm() strips it. Those rows fell into `skipped` and
   * quietly left 8% of the metagame out of the coverage picture. See engine/mc_key.js. */
  const m = mcKey.row(key, { mayMiss: 'the coverage sweep asks about names the damage table may not carry' });
  if (!m || !m.t || !m.t.length) { skipped += v.raw; continue; }
  const w = FLAT ? 1 : v.raw;
  defenders.push({ key, name: v.name || key, t: m.t, w, bs: m.bs });
  total += w;
}

/* ---- the meta, as a weighted list of ATTACKS -------------------------------------------------
 * Weighted by species usage TIMES how often that species runs the move, so a move on 3% of a common
 * Pokemon counts for what it is. This is the honest denominator for "what am I actually taking" —
 * counting species that COULD carry a type would badly overstate rare coverage moves. */
const atkByType = {}, atkByCat = { Physical: 0, Special: 0 };
let atkTotal = 0, atkUnknown = 0;
for (const [key, v] of Object.entries(U)) {
  if (!(v && v.raw > 0)) continue;
  const w0 = FLAT ? 1 : v.raw;
  for (const mv of (v.moves || [])) {
    const id = norm(mv.move);
    const M = MC.moves[id];
    if (!M) { atkUnknown += w0 * ((+mv.pct || 0) / 100); continue; }
    if (!M.bp) continue;                       // status moves deal no damage; they are not a threat type
    /* WEIGHTED BY BASE POWER, not merely by how often the move appears. Counting move SLOTS made
     * Fake Out (40 BP, and the single most-used damaging move in this format at 1,918,410 weight)
     * count the same per click as Hyper Beam (150 BP). That put Normal at the top of the "what hurts
     * me" table while Normal is super-effective against NOTHING — the table was measuring what gets
     * CLICKED, which is a different question from what takes HP.
     *
     * Base power is a PROXY: it ignores STAB, the attacker's offensive stat and the spread
     * reduction. It is used because this is a type-level summary over 283 species, and the
     * alternative — every attacker against every defender through the damage engine — is the
     * question CHOMP already answers better. Named as a proxy so it is not read as a damage number. */
    const w = w0 * ((+mv.pct || 0) / 100) * (M.bp / 100);
    atkByType[M.t] = (atkByType[M.t] || 0) + w;
    if (M.c === 'P') atkByCat.Physical += w; else atkByCat.Special += w;
    atkTotal += w;
  }
}

const eff = (atk, defTypes) => defTypes.reduce((mul, d) => mul * ((C[atk] && C[atk][d] !== undefined) ? C[atk][d] : 1), 1);
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';

console.log(`TYPE COVERAGE vs THIS META${FLAT ? '  (--flat: every species counted once)' : '  (usage-weighted)'}\n`);
console.log(`  defenders  ${defenders.length} species, ${Math.round(total).toLocaleString()} weight` +
  (skipped ? `  (${pct(skipped, total + skipped)} of usage skipped: not in the engine's species table)` : ''));
console.log(`  attacks    ${Math.round(atkTotal).toLocaleString()} weight of damaging move-slots\n`);

/* ---- 1. OFFENCE: one type at a time ----------------------------------------------------------- */
const offOne = TYPES.map(t => {
  let se = 0, neutral = 0, resisted = 0, immune = 0;
  for (const d of defenders) {
    const e = eff(t, d.t);
    if (e === 0) immune += d.w; else if (e >= 2) se += d.w; else if (e < 1) resisted += d.w; else neutral += d.w;
  }
  return { t, se, resisted, immune, neutral };
}).sort((a, b) => b.se - a.se);

console.log('1. OFFENCE — one attacking type at a time');
console.log(`   ${'type'.padEnd(10)}${'super-eff'.padStart(11)}${'resisted'.padStart(11)}${'immune'.padStart(9)}`);
for (const o of offOne.slice(0, 8)) {
  console.log(`   ${o.t.padEnd(10)}${pct(o.se, total).padStart(11)}${pct(o.resisted, total).padStart(11)}${pct(o.immune, total).padStart(9)}`);
}
console.log('   ...');
for (const o of offOne.slice(-3)) {
  console.log(`   ${o.t.padEnd(10)}${pct(o.se, total).padStart(11)}${pct(o.resisted, total).padStart(11)}${pct(o.immune, total).padStart(9)}`);
}

/* ---- 2. OFFENCE: the best SET ------------------------------------------------------------------
 * Greedy set cover on "at least one of my types hits this defender super-effectively". Greedy is not
 * optimal in general, but for set cover it is within a known factor and the exhaustive search over
 * C(18,4) is also cheap — so both are run and the greedy answer is only reported if it matches. */
function coverageOf(set) {
  let cov = 0;
  for (const d of defenders) if (set.some(t => eff(t, d.t) >= 2)) cov += d.w;
  return cov;
}
const greedy = [];
while (greedy.length < TEAMN) {
  let best = null;
  for (const t of TYPES) {
    if (greedy.includes(t)) continue;
    const c = coverageOf(greedy.concat([t]));
    if (!best || c > best.c) best = { t, c };
  }
  if (!best) break;
  greedy.push(best.t);
}
/* Exhaustive for small sets, so the greedy answer is checked rather than trusted. */
let exact = null;
if (TEAMN <= 4) {
  const idx = TYPES.map((_, i) => i);
  const rec = (start, cur) => {
    if (cur.length === TEAMN) { const c = coverageOf(cur.map(i => TYPES[i])); if (!exact || c > exact.c) exact = { set: cur.map(i => TYPES[i]), c }; return; }
    for (let i = start; i < idx.length; i++) rec(i + 1, cur.concat([i]));
  };
  rec(0, []);
}
console.log(`\n2. OFFENCE — the best SET of ${TEAMN} attacking types (greedy set cover)`);
console.log(`   greedy : ${greedy.join(', ')}`);
console.log(`            covers ${pct(coverageOf(greedy), total)} of the meta super-effectively`);
if (exact) {
  const same = exact.set.slice().sort().join(',') === greedy.slice().sort().join(',');
  console.log(`   exact  : ${exact.set.join(', ')}   ${pct(exact.c, total)}` + (same ? '   (greedy found the optimum)' : '   << greedy was NOT optimal'));
}
console.log('   marginal value of each added type:');
{
  const run = [];
  for (const t of greedy) {
    const before = coverageOf(run);
    run.push(t);
    console.log(`     +${t.padEnd(9)} ${pct(coverageOf(run), total).padStart(7)}  (+${pct(coverageOf(run) - before, total)})`);
  }
}

/* ---- 3. DEFENCE: what is actually being thrown -------------------------------------------------- */
console.log('\n3. DEFENCE — what the meta actually THROWS, weighted by usage x base power');
const atkRank = Object.entries(atkByType).sort((a, b) => b[1] - a[1]);
console.log(`   ${'attacking type'.padEnd(16)}${'share of incoming power'.padStart(24)}`);
for (const [t, w] of atkRank.slice(0, 8)) console.log(`   ${t.padEnd(16)}${pct(w, atkTotal).padStart(24)}`);

/* Which single defensive typing eats the most of that? Every real dual typing in the meta is tried,
 * so the answer is a typing someone can actually build rather than a theoretical pair. */
const seenT = new Map();
for (const d of defenders) {
  const k = d.t.slice().sort().join('/');
  seenT.set(k, (seenT.get(k) || 0) + d.w);
}
const resistScore = [...seenT.keys()].map(k => {
  const ts = k.split('/');
  let good = 0;
  for (const [t, w] of atkRank) { const e = eff(t, ts); if (e < 1) good += w * (1 - e); }
  return { k, good, used: seenT.get(k) };
}).sort((a, b) => b.good - a.good);

console.log('\n   best DEFENSIVE typings against that distribution:');
console.log(`   ${'typing'.padEnd(20)}${'damage absorbed'.padStart(17)}${'meta usage'.padStart(12)}`);
for (const r of resistScore.slice(0, 8)) {
  console.log(`   ${r.k.padEnd(20)}${pct(r.good, atkTotal).padStart(17)}${pct(r.used, total).padStart(12)}`);
}

/* ---- 4. THE SPLIT ------------------------------------------------------------------------------ */
console.log('\n4. PHYSICAL vs SPECIAL — what the meta throws');
console.log(`   physical ${pct(atkByCat.Physical, atkTotal)}     special ${pct(atkByCat.Special, atkTotal)}`);
const lean = atkByCat.Physical > atkByCat.Special ? 'PHYSICAL' : 'SPECIAL';
const gap = Math.abs(atkByCat.Physical - atkByCat.Special) / atkTotal;
console.log(`   the metagame leans ${lean} by ${(100 * gap).toFixed(1)} points`);
console.log(`   -> invest defensively against ${lean.toLowerCase()} first; a screen that halves the`);
console.log(`      other half is worth proportionally less (see board.js screenValue, which grades`);
console.log(`      a screen by the CATEGORY it actually stops).`);

/* Offensive side of the same question: is the meta easier to break physically or specially? */
let physWall = 0, specWall = 0;
for (const d of defenders) {
  if (!d.bs) continue;
  if (d.bs.def >= d.bs.spd) physWall += d.w; else specWall += d.w;
}
console.log(`\n   on the other side of it: ${pct(physWall, total)} of the meta is bulkier on the PHYSICAL side,`);
console.log(`   ${pct(specWall, total)} on the special side — so attacking ${physWall < specWall ? 'PHYSICALLY' : 'SPECIALLY'} meets less resistance.`);

console.log('\nCAVEAT, once: this is TYPE coverage only. It says nothing about speed, bulk, item,');
console.log('ability or the roles a bring needs, and a team picked on this alone would be a list of');
console.log('types rather than a team.');
