/* test-rulebook-collision.js — THERE ARE TWO RULEBOOKS FOR MOVE BEHAVIOUR. DO THEY AGREE?
 *
 *   node tests/test-rulebook-collision.js
 *   node tests/test-rulebook-collision.js --update    re-baseline (only ever DOWNWARD)
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `data/tags.json` (derived by engine/tag_dex.js from Showdown's dex) and
 * `CHOMP/data/move-effects.json` (954 moves, generated separately) BOTH state what a move does:
 * which moves flinch, at what chance, what status they inflict, how much they drain, how many times
 * they hit, what they boost. `engine/medicham2-browser.js` reads move-effects.json for most of it,
 * which is why 35 move tags read DEAD in data/tag-consumption.json.
 *
 * CLAUDE.md: *"Two files that both decide Choice Scarf multiplies Speed by 1.5 will disagree
 * eventually, and the disagreement will be invisible because both keep working."* That is exactly
 * this shape, and WIRE 71 was a weather fact that HAD already drifted between two copies.
 *
 * WHICH RULEBOOK WINS IS AN ARCHITECTURE DECISION AND IT IS NOT THIS FILE'S. This file answers the
 * one question that has to be answered first and that nobody had measured: **do they agree today?**
 * A disagreement is a live bug on whichever consumer reads the losing copy. Agreement is redundancy
 * that can be scheduled.
 *
 * HOW A COMPARISON IS MADE, AND WHAT IT REFUSES TO DO
 * --------------------------------------------------
 * Each row below states a FACT and reads it from both sides. A fact only counts as compared when
 * BOTH sides express it — the tag artifact covers moves move-effects.json does not carry and the
 * reverse — and every skip is counted and printed, because a shrinking denominator that nobody
 * prints is how a coverage claim becomes a lie. There is deliberately NO row for a fact only one
 * side states: an unopposed value cannot disagree with anything and counting it as AGREE would
 * inflate the headline.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const TAGS = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
const FXPATH = D('..', 'CHOMP', 'data', 'move-effects.json');
if (!fs.existsSync(FXPATH)) {
  console.error('NOT RUN — CHOMP/data/move-effects.json not found beside this checkout at ' + FXPATH);
  process.exit(2);
}
const FX = JSON.parse(fs.readFileSync(FXPATH, 'utf8')).moves;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const p = (id, tag) => ((TAGS.moves[id] || {}).params || {})[tag] || null;
const uses = id => (TAGS.moves[id] || {}).uses || 0;

/* the chance of a named major status, from move-effects: primary first, then the secondary list */
function fxStatus(f, st) {
  if (!f) return null;
  if (f.status && norm(f.status) === st) return 100;
  for (const s of (f.secondary || [])) if (s && norm(s.status) === st) return s.chance == null ? 100 : s.chance;
  return null;
}
function fxFlinch(f) {
  if (!f) return null;
  for (const s of (f.secondary || [])) if (s && norm(s.volatile) === 'flinch') return s.chance == null ? 100 : s.chance;
  return null;
}
const num = x => (x == null ? null : +x);
const eqNum = (a, b) => (a == null || b == null) ? null : (Math.abs(a - b) < 1e-6);

/* ---- THE FACTS, one row each -------------------------------------------------------------------
 * `tagSide` returns the tag artifact's value for a move id, or null if the artifact does not state
 * it. `fxSide` does the same for move-effects.json. A row where either is null is SKIPPED and
 * counted; a row where both are present is compared. */
const STATUSES = [['inflictsBurn', 'brn'], ['inflictsParalysis', 'par'], ['inflictsPoison', 'psn'],
  ['inflictsSleep', 'slp'], ['inflictsFreeze', 'frz'], ['inflictsToxic', 'tox']];

/* THE TWO RULEBOOKS MEAN DIFFERENT THINGS BY "CHANCE", AND THE FIRST RUN OF THIS FILE REPORTED THAT
 * AS EIGHT DISAGREEMENTS. `inflictsBurn.p` is the tag's END-TO-END probability -- it FOLDS IN the
 * move's accuracy, so Will-O-Wisp is 0.85 -- while move-effects.json keeps `chance: 100` and carries
 * `accuracy: 85` in a separate field. Neither is wrong and the numbers differ on every
 * primary-status move in the format.
 *
 * THAT IS WORSE THAN A VALUE DRIFT, NOT BETTER, AND IT IS WHY IT IS WRITTEN OUT HERE. A drift is
 * visible the moment anyone compares the two numbers. A units mismatch is invisible to that
 * comparison and shows up only as a consumer that multiplies the accuracy in twice -- 0.85 x 0.85 --
 * or not at all. So the comparison is made in the tag's units, explicitly, and the residue is a
 * genuine disagreement about the RULE.
 *
 * AND THE TAG IS NOT SELF-CONSISTENT, WHICH THE SECOND RUN OF THIS FILE FOUND. `statusOdds` folds
 * accuracy in for a PRIMARY status (`via: 'primary'`) and does NOT for a SECONDARY one
 * (`via: 'secondary'`): Will-O-Wisp is 0.85 and Rock Slide is 0.30 against a 90%-accurate move.
 * So `p` means two different things depending on a sibling field, and any consumer that reads it
 * without also reading `via` is wrong for one of the two families. Recorded here rather than
 * "fixed" by normalising the artifact, because changing the units of a live param is a change every
 * consumer has to be checked against and that is a decision, not a tidy-up. The comparison below
 * reads `via` and asks each side in its own units. */
const fxAcc = id => { const f = FX[id]; if (!f) return null;
  return (f.accuracy === true || f.accuracy == null) ? 100 : +f.accuracy; };

const FACTS = [];
for (const [tag, st] of STATUSES) {
  FACTS.push({
    fact: `P(${st})`, tag,
    tagSide: id => { const v = p(id, tag); return v && v.p != null ? Math.round(v.p * 100) : null; },
    fxSide: id => { const c = fxStatus(FX[id], st); if (c == null) return null;
                    const v = p(id, tag);
                    /* the tag's own `via` says which units its `p` is in */
                    return (v && v.via === 'primary') ? Math.round(c * fxAcc(id) / 100) : c; },
    cmp: eqNum });
}
FACTS.push({
  fact: 'P(flinch)', tag: 'flinches',
  tagSide: id => { const v = p(id, 'flinches'); return v && v.pFlinch != null ? Math.round(v.pFlinch * 100) : null; },
  fxSide: id => fxFlinch(FX[id]), cmp: eqNum });
FACTS.push({
  fact: 'hits (fixed multi-hit)', tag: 'multiHit',
  tagSide: id => { const v = p(id, 'multiHit'); return v && v.hits != null ? +v.hits : null; },
  fxSide: id => { const f = FX[id]; return (f && typeof f.multihit === 'number') ? f.multihit : null; },
  cmp: eqNum });
FACTS.push({
  fact: 'drain fraction', tag: 'drain',
  tagSide: id => { const v = p(id, 'drain'); return v && v.fraction != null ? +v.fraction : null; },
  fxSide: id => { const f = FX[id]; if (!f || f.drain == null) return null;
                  return Array.isArray(f.drain) ? f.drain[0] / f.drain[1] : +f.drain; },
  cmp: eqNum });
FACTS.push({
  fact: 'recoil fraction', tag: 'recoil',
  tagSide: id => { const v = p(id, 'recoil'); return v && v.fraction != null ? +v.fraction : null; },
  fxSide: id => { const f = FX[id]; if (!f || f.recoil == null) return null;
                  return Array.isArray(f.recoil) ? f.recoil[0] / f.recoil[1] : +f.recoil; },
  cmp: eqNum });
FACTS.push({
  fact: 'priority bracket', tag: 'priority',
  tagSide: id => { const v = p(id, 'priority'); if (!v) return null;
                   /* the tag stores only the SIGN, so this row can compare the sign and says so */
                   return v.sign === '-' ? -1 : v.sign === '+' ? 1 : null; },
  fxSide: id => { const f = FX[id]; if (!f || f.priority == null || !f.priority) return null;
                  return f.priority < 0 ? -1 : 1; },
  cmp: eqNum });
FACTS.push({
  fact: 'the weather it sets', tag: 'setsWeather',
  tagSide: id => { const v = p(id, 'setsWeather'); return v && v.weather ? norm(v.weather) : null; },
  fxSide: id => { const f = FX[id]; return f && f.weather ? norm(f.weather) : null; },
  cmp: (a, b) => (a == null || b == null) ? null : a === b });
FACTS.push({
  fact: 'the terrain it sets', tag: 'setsTerrain',
  tagSide: id => { const v = p(id, 'setsTerrain'); return v && v.terrain ? norm(v.terrain) : null; },
  fxSide: id => { const f = FX[id]; return f && f.terrain ? norm(f.terrain) : null; },
  cmp: (a, b) => (a == null || b == null) ? null : a === b });
FACTS.push({
  fact: 'the stats it drops on the user', tag: 'lowersUser',
  tagSide: id => { const v = p(id, 'lowersUser'); if (!v || !v.boosts) return null;
                   return JSON.stringify(Object.entries(v.boosts).filter(e => e[1] < 0).sort()); },
  fxSide: id => { const f = FX[id]; if (!f || !f.selfBoostsAlways) return null;
                  return JSON.stringify(Object.entries(f.selfBoostsAlways).filter(e => e[1] < 0).sort()); },
  cmp: (a, b) => (a == null || b == null) ? null : a === b });
FACTS.push({
  fact: 'the stats it changes on the target', tag: 'statChange',
  tagSide: id => { const v = p(id, 'statChange');
                   const e = v && v.target && v.target.find(x => x.chance === 100);
                   return e && e.boosts ? JSON.stringify(Object.entries(e.boosts).sort()) : null; },
  fxSide: id => { const f = FX[id]; if (!f || !f.targetBoostsAlways) return null;
                  return JSON.stringify(Object.entries(f.targetBoostsAlways).sort()); },
  cmp: (a, b) => (a == null || b == null) ? null : a === b });

/* ---- RUN --------------------------------------------------------------------------------------- */
const ids = new Set([...Object.keys(TAGS.moves), ...Object.keys(FX)].map(norm));
let compared = 0, agree = 0;
const clashes = [];
const perFact = [];
const skipped = { tagOnly: 0, fxOnly: 0, neither: 0 };

/* A THROW IN A FACT-EXTRACTOR IS NOT A SKIP. A malformed entry on either side used to be silently
 * indistinguishable from "this side does not state the fact", which shrinks the denominator without
 * shrinking the claim — the exact shape tests/test-engine-diff.js's dropped_by_exception exists to
 * stop. Counted per side, printed when nonzero, and written into the artifact. */
const probeThrew = { tag: 0, fx: 0, first: '' };
for (const F of FACTS) {
  let c = 0, a = 0, tOnly = 0, fOnly = 0;
  for (const id of ids) {
    let tv = null, fv = null;
    try { tv = F.tagSide(id); } catch (e) { tv = null; probeThrew.tag++; if (!probeThrew.first) probeThrew.first = `${F.fact} ${id}: ${e.message}`; }
    try { fv = F.fxSide(id); } catch (e) { fv = null; probeThrew.fx++; if (!probeThrew.first) probeThrew.first = `${F.fact} ${id}: ${e.message}`; }
    if (tv == null && fv == null) { skipped.neither++; continue; }
    if (tv == null) { fOnly++; skipped.fxOnly++; continue; }
    if (fv == null) { tOnly++; skipped.tagOnly++; continue; }
    const r = F.cmp(tv, fv);
    if (r == null) continue;
    c++; if (r) a++; else clashes.push({ fact: F.fact, tag: F.tag, id, uses: uses(id), tagValue: tv, fxValue: fv });
  }
  compared += c; agree += a;
  perFact.push({ fact: F.fact, tag: F.tag, compared: c, agree: a, tagOnly: tOnly, fxOnly: fOnly });
}

console.log('RULEBOOK COLLISION — data/tags.json  vs  CHOMP/data/move-effects.json\n');
console.log('  ' + 'fact'.padEnd(34) + 'tag'.padEnd(18) + 'compared  agree  clash   tag-only  fx-only');
for (const r of perFact)
  console.log('  ' + r.fact.padEnd(34) + r.tag.padEnd(18)
    + String(r.compared).padStart(8) + String(r.agree).padStart(7)
    + String(r.compared - r.agree).padStart(7) + String(r.tagOnly).padStart(11) + String(r.fxOnly).padStart(9));

console.log(`\n  ${agree} of ${compared} comparable facts AGREE`
  + (compared ? `  (${(100 * agree / compared).toFixed(2)}%)` : ''));
if (probeThrew.tag || probeThrew.fx) {
  console.error(`  WARNING — fact extractors THREW rather than declining: tag side ${probeThrew.tag}, `
    + `fx side ${probeThrew.fx}. First: ${probeThrew.first}. Those rows were NOT compared.`);
}
console.log(`  NOT COMPARED, and this is the honest half: ${skipped.tagOnly} facts only the TAG states, `
  + `${skipped.fxOnly} only MOVE-EFFECTS states.`);
console.log('  A fact only one rulebook carries cannot disagree with anything and is NOT counted as agreement.');

clashes.sort((x, y) => y.uses - x.uses);
if (clashes.length) {
  console.log('\n  DISAGREEMENTS — each one is a LIVE BUG on whichever consumer reads the losing copy:');
  for (const c of clashes.slice(0, 40))
    console.log(`    ${String(c.uses).padStart(7)} uses  ${c.id.padEnd(18)}${c.fact.padEnd(30)}`
      + `tags=${JSON.stringify(c.tagValue)}  move-effects=${JSON.stringify(c.fxValue)}`);
  if (clashes.length > 40) console.log(`    ... and ${clashes.length - 40} more`);
} else {
  console.log('\n  NO DISAGREEMENTS. The duplication is redundancy, not divergence — which is what makes');
  console.log('  it schedulable rather than urgent. It is also not permanent: the two files are generated');
  console.log('  by different scripts from different snapshots, so this number is a fact about TODAY.');
}

/* ---- THE RATCHET ------------------------------------------------------------------------------- */
const BASE = D('data', 'rulebook-collision.json');
const prev = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null;
const out = { note: 'RATCHET. `clashes` may fall and may never rise. Two rulebooks state the same '
                  + 'move facts; this counts where they DISAGREE today. Which one wins is an '
                  + 'architecture decision and is not settled here.',
  generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
  compared, agree, clashes: clashes.length,
  extractor_threw: { tag: probeThrew.tag, fx: probeThrew.fx, first: probeThrew.first || null },
  not_compared: skipped, per_fact: perFact,
  clash_detail: clashes.slice(0, 60) };

if (process.argv.includes('--update') || !prev) {
  fs.writeFileSync(BASE, JSON.stringify(out, null, 2));
  console.log('\n  wrote data/rulebook-collision.json');
  process.exit(0);
}
if (clashes.length > prev.clashes) {
  console.log(`\n  FAIL — disagreements grew ${prev.clashes} -> ${clashes.length}. A new drift between the two rulebooks.`);
  process.exit(1);
}
fs.writeFileSync(BASE, JSON.stringify(out, null, 2));
console.log(`\n  ok — disagreements ${prev.clashes} -> ${clashes.length} (may fall, may never rise)`);
