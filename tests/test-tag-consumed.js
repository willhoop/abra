/* test-tag-consumed.js — every tag in the artifact must have a consumer in the engine.
 *
 * WILL'S ASK, 2026-08-04, verbatim:
 *   "CAN WE DESIGN TESTS THAT CHECK ALL THE MOST COMMON MOVES, ITEMS, ABILITIES, AND MONS AND SEE IF
 *    ALL THE TAGS ACTUALLY GET USED IN THE ENGINE"
 * and, on why he cannot simply list the gaps himself: "I CANNOT TELL YOU ALL THE EXAMPLES".
 *
 * He is right that he should not have to. The engine derives 174 distinct tags from Showdown's own
 * data and hand-writes a consumer for each one, so every tag needs a person to remember to wire it
 * and NOTHING FAILS when nobody does. That is the Expression Problem (Wadler, 1998) taken in the
 * direction where data is cheap to add and operations are not — a legitimate choice, but one that is
 * only safe with an exhaustiveness check, and the check was never written.
 *
 * WHAT THIS MEASURES, AND WHAT IT DELIBERATELY DOES NOT
 * ----------------------------------------------------
 * `engine/tags.js` has counted tag reads since the day it was written and NOTHING HAS EVER CALLED
 * `hits()`. Worse, it could not have answered this question: `param()` counted a tag only when the
 * entity CARRIED it and `has()` counted nothing at all, so a zero reading was ambiguous between two
 * opposite diagnoses. Split into ASKED and FOUND, the reading becomes decisive:
 *
 *   ASKED = 0             NO LINE OF ENGINE CODE LOOKS FOR THIS TAG. Dead. Decisive, and it needs no
 *                         probe, no staging and no scenario — a consumer that does not exist cannot
 *                         be hidden by a badly-chosen body.
 *   ASKED > 0, FOUND = 0  a consumer exists; this battery never handed it a body carrying the tag.
 *                         A STAGING gap in the sweep, not a defect in the engine.
 *   FOUND > 0             a consumer read real parameters off a real entity.
 *
 * Those three demand different work — write code, write a better probe, or nothing — and the single
 * counter could not tell them apart.
 *
 * **FOUND > 0 IS NECESSARY AND NOT SUFFICIENT.** A consumer can read a tag and ignore its payload;
 * `spreadAll` is read by TAG NAME to build a set while its `hitsAlly` param is never consulted, and a
 * consumer that applied a generic burn would satisfy `inflictsBurn` while modelling the wrong
 * mechanic. Proving the read CHANGES BEHAVIOUR needs the mutation tier — remove the tag, assert the
 * output moves — which is mutation testing (DeMillo, Lipton & Sayward, 1978) with the operators
 * supplied for free by the tag list rather than generated blindly. That tier is specified in
 * `docs/TAG-COVERAGE.md` and is ENGINE's.
 *
 * So this file is the CHEAP TIER and it is honest about being that. It cannot produce a false
 * "covered". It can produce a false "staged", and says so on every run.
 */
'use strict';
const path = require('path');
const fs0 = require('fs');
const fs = fs0;
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const TAGS = require(path.join(ROOT, 'engine', 'tags.js'));
const MEDI = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const ART = require(path.join(ROOT, 'data', 'tags.json'));

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

ok(typeof TAGS.asked === 'function', 'tags.js exposes asked() — ASKED and FOUND are separable');
if (typeof TAGS.asked !== 'function') { console.log('\nTAG CONSUMPTION: cannot run'); process.exit(1); }

/* ---- THE UNIVERSE OF TAGS, AND WHAT EACH IS WORTH IN REAL PLAY -------------------------------- */
const KINDS = { moves: 'move', items: 'item', abilities: 'ability' };
const uses = Object.create(null);   /* tag -> corpus uses of everything carrying it */
const carriers = Object.create(null);
for (const [box, kind] of Object.entries(KINDS)) {
  for (const [id, rec] of Object.entries(ART[box] || {})) {
    for (const tag of rec.tags || []) {
      uses[tag] = (uses[tag] || 0) + (rec.uses || 0);
      (carriers[tag] || (carriers[tag] = [])).push({ kind, id, rec });
    }
  }
}
const ALL = Object.keys(uses).sort((a, b) => uses[b] - uses[a]);
ok(ALL.length > 100, `the artifact defines ${ALL.length} distinct tags`);

/* ---- THE SWEEP -------------------------------------------------------------------------------
 * Drive the engine's real entry points across real bodies. This is deliberately NOT a probe library:
 * a probe proves one mechanic, and the question here is which tags NO code path looks for, which is
 * answered by exercising the paths rather than the mechanics.
 *
 * Species come from the engine's own table so the sweep cannot drift from what is buildable, and the
 * moves come from the ARTIFACT so a tag's own carriers are the bodies it is staged on — asking about
 * `resistBerry` while never holding one measures the sweep, not the engine. */
/* Through the ONE resolver rather than Object.keys(MC.mons) — tests/test-mc-key.js bans a private
 * index over the table's keys, and mcKey.all() exists for exactly this "what is in here at all"
 * question. It returns sorted entries, so the sweep's att/def pairing is stable across runs and
 * across key insertion order, which Object.keys never promised. */
const { mcKey } = require(path.join(ROOT, 'engine', 'mc_key.js'));
const SPECIES = mcKey.all().map(([k]) => k);
const FIELDS = [
  { weather: null, weatherT: 0, terrain: '', terrainT: 0 },
  { weather: 'rain', weatherT: 5, terrain: 'electric', terrainT: 5 },
  { weather: 'sun', weatherT: 5, terrain: 'grassy', terrainT: 5 },
  { weather: 'sand', weatherT: 5, terrain: 'psychic', terrainT: 5 },
  { weather: 'snow', weatherT: 5, terrain: 'misty', terrainT: 5 },
];
/* Every move the artifact knows, given a plausible body so `dmgRange` does not exit early on a
 * powerless move. Category and type come off the record where present. */
function moveObj(id, rec) {
  const nm = rec.name || id;
  return { id, name: nm, t: rec.type || 'Normal', c: rec.category === 'Status' ? 'T' : (rec.category === 'Special' ? 'S' : 'P'),
           bp: rec.basePower || 80, spread: /spread/i.test((rec.tags || []).join(',')) };
}

TAGS.resetHits();
let calls = 0, threw = 0;
const MOVES = Object.entries(ART.moves || {});
for (let i = 0; i < SPECIES.length; i++) {
  const att = MEDI.buildMon(SPECIES[i], {});
  const def = MEDI.buildMon(SPECIES[(i + 7) % SPECIES.length], {});
  if (!att || !def) continue;
  const field = FIELDS[i % FIELDS.length];
  /* ENTRY EFFECTS — the switch-in path, where weather setters, Intimidate and Hospitality live. */
  try { MEDI.applyEntryEffects(att, Object.assign({}, field), def); calls++; } catch (e) { threw++; }
  /* SPEED — Scarf, paralysis, Tailwind, the weather speed abilities. */
  try { MEDI.effSpeed(att, field); calls++; } catch (e) { threw++; }
  /* DAMAGE — the widest path, and the one that consults 28 tags per call. */
  for (let k = 0; k < 12; k++) {
    const [mid, mrec] = MOVES[(i * 12 + k) % MOVES.length];
    try { MEDI.dmgRange(att, def, moveObj(mid, mrec), field, k % 2 === 0); calls++; } catch (e) { threw++; }
  }
  /* THE FEATURE PATHS — bench threat and punish exposure read a different set again. */
  try { MEDI.clickFragility(att, [def], field); calls++; } catch (e) { threw++; }
  try { MEDI.punishExposure(att, [def], field); calls++; } catch (e) { threw++; }
}
/* ---- THE BATTLE LOOP, which the first sweep never entered -----------------------------------
 * That omission produced 77 UNREACHED verdicts and, before the static check existed, 132 false
 * DEADs. Flinch, redirection, Trick Room, screens, residual healing, Encore, hazards and the punish
 * abilities are all consumed inside battleTurn and nowhere else. chooseAction picks real moves off
 * the built mons, so the tags exercised are the ones real bodies actually carry — and a seeded rng
 * keeps the run reproducible, per the same rule as every other battery in this repo. */
let btTurns = 0;
{
  let seed = 987654321;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let g = 0; g < SPECIES.length; g++) {
    const A = [MEDI.buildMon(SPECIES[g % SPECIES.length], {}), MEDI.buildMon(SPECIES[(g + 3) % SPECIES.length], {})];
    const B = [MEDI.buildMon(SPECIES[(g + 5) % SPECIES.length], {}), MEDI.buildMon(SPECIES[(g + 11) % SPECIES.length], {})];
    if (A.some(x => !x) || B.some(x => !x)) continue;
    try {
      const S = MEDI.battleInit(A, B);
      for (let t = 0; t < 16 && !MEDI.battleOver(S); t++) { MEDI.battleTurn(S, rng); btTurns++; calls++; }
    } catch (e) { threw++; }
  }
}
ok(btTurns > 500, `the battle loop actually ran (${btTurns.toLocaleString()} turns) — the path the first sweep missed`);
ok(calls > 1000, `the sweep made ${calls.toLocaleString()} engine calls across ${SPECIES.length} species`);
/* A sweep that threw on everything would report every tag DEAD and look like a catastrophic finding.
 * The throw count is printed rather than swallowed, exactly as the swallowed-failure rule requires. */
ok(threw < calls * 0.5, `fewer than half the calls threw (${threw} of ${calls + threw})`);

const asked = TAGS.asked(), found = TAGS.hits();
const KINDKEYS = new Set(['move', 'item', 'ability']);
const A = t => asked[t] || 0, Fx = t => found[t] || 0;

/* ---- THE RUNTIME READING ALONE IS NOT DECISIVE, AND THE FIRST RUN PROVED IT --------------------
 *
 * The first version of this file classified every tag with ASKED = 0 as DEAD and reported 132 of
 * them, including `flinches`, `redirects`, `reversesSpeed` (Trick Room), `passiveHeal` (Leftovers)
 * and `halvesDamage` (screens) — all demonstrably wired, several of them touched the same day.
 *
 * The sweep drives `dmgRange`, `effSpeed`, `applyEntryEffects`, `clickFragility` and
 * `punishExposure`. It never enters the BATTLE LOOP, which is where flinch, redirection, speed
 * reversal and residual healing are consumed. So ASKED = 0 was measuring THE SWEEP'S PATH COVERAGE
 * and reporting it as an engine defect — a false DEAD, which is the dangerous direction: it sends
 * someone to wire a mechanic that already works.
 *
 * A runtime counter can only ever prove a path was REACHED. To prove no consumer EXISTS you need the
 * source, so the two are combined and each covers the other's blind spot:
 *
 *   not named in any engine source  AND  ASKED = 0   -> DEAD, decisive
 *   named in source                 AND  ASKED = 0   -> UNREACHED. The sweep never ran that path.
 *                                                       A gap in this file, not in the engine.
 *   ASKED > 0, FOUND = 0                             -> STAGED. Consumer ran, no carrier supplied.
 *   FOUND > 0                                        -> LIVE (necessary, not sufficient — see header)
 *
 * The static half has its own blind spot, which is why it is not used alone: a tag name built at
 * runtime rather than written as a literal is invisible to it. That is real — `withTag` takes the
 * name as an argument — so a DEAD verdict means "no literal anywhere AND never asked", which is as
 * close to decisive as this pair of instruments can get, and it is stated rather than assumed. */
/* An unreadable engine file shrinks the corpus namedInSource() searches, so a tag could read DEAD
 * because the ONE file that names it failed to open. The old comment said "counted below" and
 * nothing counted it — a lie in a comment is worse than silence. Counted for real now, and loud,
 * because a DEAD verdict derived from a partial corpus is not a verdict. */
let unreadableEngineFiles = 0;
const ENGINE_SRC = (() => {
  const dir = path.join(ROOT, 'engine');
  let all = '';
  for (const f of fs0.readdirSync(dir)) {
    if (!/\.js$/.test(f) || f === 'tag_dex.js') continue;   /* tag_dex WRITES the tags; naming one there is not consuming it */
    try { all += fs0.readFileSync(path.join(dir, f), 'utf8'); }
    catch (e) { unreadableEngineFiles++; console.error(`  WARNING — engine/${f} unreadable (${e.message}): namedInSource may under-report and a DEAD verdict below is suspect`); }
  }
  return all;
})();
const namedInSource = t => ENGINE_SRC.includes("'" + t + "'") || ENGINE_SRC.includes('"' + t + '"');

const cand = ALL.filter(t => !KINDKEYS.has(t));
const live = cand.filter(t => Fx(t) > 0);
const staged = cand.filter(t => Fx(t) === 0 && A(t) > 0);
const dead = cand.filter(t => Fx(t) === 0 && A(t) === 0 && !namedInSource(t));
const unreached = cand.filter(t => Fx(t) === 0 && A(t) === 0 && namedInSource(t));

console.log('');
console.log(`  LIVE    ${String(live.length).padStart(3)}  a consumer read real parameters off a real entity`);
console.log(`  STAGED  ${String(staged.length).padStart(3)}  a consumer exists; this sweep never handed it a carrier`);
console.log(`  UNREACHED ${String(unreached.length).padStart(1)}  named in engine source; THIS SWEEP never ran that path (a gap here, not in the engine)`);
console.log(`  DEAD    ${String(dead.length).padStart(3)}  no literal in any engine file AND never asked for at runtime`);

if (dead.length) {
  console.log('\n  DEAD, ordered by what they are worth in real play:');
  for (const t of dead.slice(0, 40)) {
    const c = carriers[t] || [];
    console.log(`    ${t.padEnd(26)} ${String(uses[t] || 0).padStart(7)} uses  ${c.length} carrier(s)  e.g. ${c.slice(0, 3).map(x => x.id).join(', ')}`);
  }
  if (dead.length > 40) console.log(`    ... and ${dead.length - 40} more`);
}
if (staged.length) {
  console.log('\n  STAGED — the engine asks, this sweep never supplied a carrier. Widen the sweep, do not wire:');
  console.log('    ' + staged.slice(0, 24).join(', ') + (staged.length > 24 ? `, ... (${staged.length - 24} more)` : ''));
}

/* ---- THE RATCHET -----------------------------------------------------------------------------
 * DEAD may fall and may never rise, the same shape as `unarmed` in the mechanics census and
 * `mtime_only` in provenance. A count alone proved insufficient in provenance within an hour of being
 * written — it fired, named nothing, and a division lost a session to it — so the LIST is the
 * baseline and the diff names the tag. */
const STAMP = path.join(ROOT, 'data', 'tag-consumption.json');
let prev = null;
if (fs.existsSync(STAMP)) {
  try { prev = JSON.parse(fs.readFileSync(STAMP, 'utf8')); }
  catch (e) {
    /* ok(false) already fails the file; the console.error is for the scanner in
     * tests/test-no-silent-failure.js, whose SPEAKS patterns cannot know what ok() does. */
    console.error(`  baseline unreadable: ${e.message}`);
    ok(false, `the baseline exists and cannot be read (${e.message}) — refusing to adopt a new one`);
  }
}
const prevDead = prev && Array.isArray(prev.dead) ? prev.dead : null;
if (prevDead) {
  const added = dead.filter(t => !prevDead.includes(t));
  const fixed = prevDead.filter(t => !dead.includes(t));
  if (fixed.length) console.log(`\n  WIRED since the baseline (${fixed.length}): ${fixed.join(', ')}`);
  ok(added.length === 0, added.length
    ? `${added.length} tag(s) newly have NO consumer: ${added.join(', ')}`
    : 'no tag lost its consumer since the baseline');
}
if (!prevDead || dead.length <= prevDead.length) {
  fs.writeFileSync(STAMP, JSON.stringify({
    note: 'RATCHET. `dead` may shrink and may never grow. A tag here is one NO line of engine code '
        + 'looks for — decisive, and independent of how the sweep was staged. `staged` is a property '
        + 'of the sweep and is recorded for information only, never ratcheted.',
    method: 'engine/tags.js counts ASKED (any lookup) and FOUND (the entity carried it). ASKED=0 is '
          + 'the decisive reading. FOUND>0 is necessary and NOT sufficient — proving the read changes '
          + 'behaviour is the mutation tier in docs/TAG-COVERAGE.md.',
    total_tags: ALL.length, live: live.length, staged: staged.length,
    unreached: unreached.length, unreached_this_run: unreached, dead: dead.length,
    dead_by_uses: dead.map(t => ({ tag: t, uses: uses[t] || 0, carriers: (carriers[t] || []).length })),
    dead,
    staged_this_run: staged,
    generated: new Date().toISOString(),
  }, null, 2) + '\n');
}

console.log(`\nTAG CONSUMPTION TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
