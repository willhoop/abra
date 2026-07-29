/* test-tag-wire.js — does each WIRED tag actually change a damage number?
 *
 *   node tests/test-tag-wire.js
 *
 * WHY THIS IS SEPARATE FROM test-wiring.js. That file proves a capability RAN. This one proves a
 * wired tag CHANGED THE ANSWER, which is stricter: 65 of the 172 tags were reported "read" purely
 * because their probe string appeared somewhere in the engine, and every one of those turned out to
 * be an independent hardcode rather than anything driven by the artifact. Life Orb read as wired
 * because `att.item==='lifeorb'` contains the word.
 *
 * THE BAR. Build the same attacker twice, differing only in the thing the tag describes, and assert
 * the damage moves by the factor THE TAG ITSELF declares. Not a factor typed here -- the expected
 * value is read from data/tags.json, so the test cannot drift from the artifact and cannot be
 * quietly satisfied by a number someone hardcoded to match.
 *
 * The first version of this file passed while proving nothing: it checked the tag existed in the
 * artifact and never called the damage engine, because MC was not in scope. A vacuous check inside
 * the file written to prevent vacuous checks. Loading engine-data.js is what fixed it.
 *
 * Tags are added here ONE AT A TIME as they are wired. The mechanics batch shipped ~20 mechanics
 * together, measured +0.0, and nobody could say which of the 20 was wrong.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));          // sets globalThis.MC and mcEff
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const TAGS = require(path.join(ROOT, 'engine', 'tags.js'));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); c ? pass++ : fail++; };

const FIELD = { terrain: '', weather: '', twA: 0, twB: 0 };

/* Max damage of `attacker` holding `item` into `defender` with `moveId`. Max, not min, because it
 * is a single deterministic roll and avoids floor() noise at the bottom of the range. */
function dmg(attacker, defender, moveId, item) {
  const a = M.buildMon(attacker, { [attacker]: item });
  const d = M.buildMon(defender, { [defender]: '' });
  const mv = MC.moves[moveId];
  if (!a || !d || !mv) return null;
  const r = M.dmgRange(a, d, mv, FIELD, false);
  return r ? r.max : null;
}

/* Ratio of damage with the item against damage with no item at all. */
function ratio(attacker, defender, moveId, item) {
  const with_ = dmg(attacker, defender, moveId, item);
  const without = dmg(attacker, defender, moveId, '');
  if (!with_ || !without) return null;
  return with_ / without;
}

console.log('TAG WIRE — does the artifact actually move the number?\n');

/* ---- WIRE 1: damageMultAll (Life Orb) -------------------------------------------------------- */
console.log('wire 1 — damageMultAll');
{
  const p = TAGS.param('item', 'lifeorb', 'damageMultAll');
  if (!p) ok(false, 'Life Orb carries damageMultAll in the artifact');
  else {
    const r = ratio('garchomp', 'incineroar', 'earthquake', 'lifeorb');
    if (r == null) ok(false, 'could not build the Garchomp/Incineroar pair');
    else ok(Math.abs(r - p.mult) < 0.03,
      `Life Orb moves damage by x${r.toFixed(3)}, artifact declares x${p.mult}`);
    /* The cost is in the tag and NOT yet applied anywhere -- stated so it cannot be forgotten. */
    console.log(`        note: the tag also declares ${p.costsPerAttack}, which nothing applies yet`);
  }
}

/* ---- WIRE 2: damageMultType (18 type-boost items, previously ABSENT) ------------------------- */
console.log('\nwire 2 — damageMultType');
{
  const db = require(path.join(ROOT, 'data', 'tags.json'));
  const members = Object.entries(db.items).filter(([, r]) => (r.tags || []).includes('damageMultType'));
  ok(members.length >= 15, `${members.length} type-boost items derived from handlers (was a 24-name regex)`);

  /* Black Glasses on a Dark move must move; on a non-Dark move it must NOT. Both directions,
   * because a wire that multiplies everything would pass a one-sided check. */
  const p = TAGS.param('item', 'blackglasses', 'damageMultType');
  if (!p) ok(false, 'Black Glasses carries damageMultType');
  else {
    const onType = ratio('kingambit', 'incineroar', 'knockoff', 'blackglasses');
    if (onType == null) ok(false, 'could not build the Kingambit/Incineroar pair');
    else ok(Math.abs(onType - p.mult) < 0.03,
      `Black Glasses on a ${p.onType} move: x${onType.toFixed(3)}, artifact declares x${p.mult}`);

    const offType = ratio('kingambit', 'incineroar', 'ironhead', 'blackglasses');
    if (offType != null)
      ok(Math.abs(offType - 1) < 0.03,
        `Black Glasses on a NON-${p.onType} move leaves damage alone (x${offType.toFixed(3)})`);
  }

  /* A second item, different type, to prove the wire reads the tag rather than one special case. */
  const c = TAGS.param('item', 'charcoal', 'damageMultType');
  if (c) {
    const r = ratio('incineroar', 'garchomp', 'flareblitz', 'charcoal');
    if (r != null) ok(Math.abs(r - c.mult) < 0.03,
      `Charcoal on a ${c.onType} move: x${r.toFixed(3)}, artifact declares x${c.mult}`);
  }
}

console.log('');
if (fail) {
  console.log(`${fail} wire(s) are dead — the tag exists, the run is clean, and the number did not move.`);
  process.exit(1);
}
console.log(`${pass} checks passed. The artifact is reaching the damage calculation.`);
