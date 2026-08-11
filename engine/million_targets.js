/* WHAT THE MILLION-GAME RUN IS FOR — every mechanic that a single staged board CANNOT settle.
 *
 * Will, 2026-08-10: *"THE MILLION GAMES IS TO CONFIRM ALL THE MECHANICS WORK AS THEY SHOULD IN ALMOST
 * EVERY SITUATION? SO ROCK SLIDE FLINCHES 30 PERCENT OF THE TIME, UPPER HAND BLOCKS PRIO, TERRAIN
 * PULSE ON ELECTRIC TERRAIN IS DOUBLED AND ELECTRIC"*, and then: *"START A LIST OF ALL THE THINGS WE
 * WANT TO TEST IN THE MILLION GAMES RUN."* This is that list, and it is DERIVED so it cannot go stale.
 *
 * ================= THE LINE THIS FILE DRAWS ========================================================
 *
 * Two of Will's three examples do NOT belong here, and saying why is the whole point of the file.
 *
 *   Upper Hand blocks priority        — a RULE. One staged board settles it. n = 1.
 *   Terrain Pulse doubles on Electric — a RULE. One board, two assertions. n = 1.
 *   Rock Slide flinches 30%           — a DIE. No board settles it. n = large.
 *
 * **A DETERMINISTIC MECHANIC THAT ONLY SHOWS UP WRONG AT A MILLION GAMES MEANS THE SCENARIO CATALOGUE
 * HAS A HOLE.** The million games must not become the place rules go to be tested slowly and late;
 * it is for the surface where a rule cannot be written as a single expected board.
 *
 * ================= WHY THE DIFFERENTIAL CANNOT DO IT ===============================================
 *
 * `engine/replay_differential.js` PINS every die identically over both engines so the two are
 * deterministic and comparable. That is right for finding a wrong RULE and it is fatal for a wrong
 * RATE: if our secondary chance is 30% where Showdown's is 10%, pinning the outcome to what was
 * observed makes a wrong probability agree with itself. Its own header says so and defers the answer
 * behind `--rates`, for want of a corpus. **The million games is that corpus.**
 *
 * ================= THE TRAP THIS FILE MUST NOT FALL INTO ===========================================
 *
 * A rate test needs the mechanic to be REACHED, not merely present. Rock Slide flinching 30% is only
 * measurable over turns where Rock Slide HIT a target that could flinch and was not already moving
 * last. The denominator is the hard part, and a rate computed over the wrong denominator is worse
 * than no rate because it looks like an answer. **Every row here carries its own denominator.**
 *
 * And the corpus must actually contain the situation. A self-play corpus in which nobody ever
 * switches gives ZERO samples for Intimidate-on-entry, hazard chip and Regenerator, however many
 * games it runs — which is why ROADMAP #63 mattered before this run, not after.
 *
 *   node engine/million_targets.js              # rebuild data/million-targets.json
 *   node engine/million_targets.js --top 40     # and print the busiest rows
 *
 * Reads the FORMAT and our own tags. Writes exactly one artifact. Runs no games. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'million-targets.json');
const TOP = (() => { const i = process.argv.indexOf('--top'); return i >= 0 ? +process.argv[i + 1] || 25 : 0; })();
const id = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const CS = require('./champions_sim.js');
const { Dex } = CS.sim();
const D = Dex.forFormat(CS.FORMAT);
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const CLICKS = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'click-counts.json'), 'utf8')).moves || {}; }
  catch (e) { return null; }
})();
const SHEETS = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sheet-usage.json'), 'utf8')); }
  catch (e) { return null; }
})();

const rows = [];
const add = (r) => rows.push(r);

/* ---- 1. SECONDARY EFFECTS ------------------------------------------------------------------------
 * The headline family and Will's own example. Read the chance off the FORMAT, never off mainline:
 * Moonblast ran at gen 9's 30% against this format's 10% until 2026-08-10, and 21 constants were
 * wrong the same way because a build script fetched play.pokemonshowdown.com/data/moves.json. */
for (const m of D.moves.all()) {
  if (m.isNonstandard) continue;
  const secs = [].concat(m.secondaries || (m.secondary ? [m.secondary] : []));
  for (const s of secs) {
    if (!s || typeof s.chance !== 'number' || s.chance >= 100) continue;
    const what = s.status ? ('inflicts ' + s.status)
      : s.volatileStatus ? ('applies ' + s.volatileStatus)
      : s.boosts ? ('moves ' + Object.keys(s.boosts).join('/'))
      : s.self ? 'boosts the user' : 'a secondary';
    add({
      family: 'secondary', subject: m.id, kind: 'move',
      expect: s.chance, unit: '% of connecting hits', what,
      denominator: 'turns where ' + m.id + ' CONNECTED with a target that could receive it — not turns '
                 + 'where it was clicked. A miss, a Protect, a Substitute and an immunity are all '
                 + 'outside the denominator, and Shield Dust / Covert Cloak suppress the roll itself.',
      clicks: CLICKS ? (CLICKS[m.id] || 0) : null,
    });
  }
}

/* ---- 2. ACCURACY ---------------------------------------------------------------------------------
 * A sub-100 move is a die on every use. The differential's pin makes every one of them MISS on both
 * sides, so accuracy has never been observed at all — it is agreed-upon rather than measured. */
for (const m of D.moves.all()) {
  if (m.isNonstandard || m.accuracy === true || typeof m.accuracy !== 'number' || m.accuracy >= 100) continue;
  add({
    family: 'accuracy', subject: m.id, kind: 'move',
    expect: m.accuracy, unit: '% of attempts that connect', what: 'lands',
    denominator: 'attempts against a target that was not immune, protected or semi-invulnerable. '
               + 'Compound Eyes, Hustle, Victory Star, Tailwind-independent accuracy stages and Gravity '
               + 'all move the true rate, so those turns need their own bucket rather than pooling.',
    clicks: CLICKS ? (CLICKS[m.id] || 0) : null,
  });
}

/* ---- 3. OHKO MOVES -------------------------------------------------------------------------------
 * Their accuracy is a FORMULA, not a constant — 30 + (user level - target level) — and it fails
 * outright against a higher-level target. At level 50 both sides it is a flat 30, which is exactly
 * the sort of thing that looks like a constant until the level assumption changes. */
for (const m of D.moves.all()) {
  if (m.isNonstandard || !m.ohko) continue;
  add({
    family: 'ohko', subject: m.id, kind: 'move', expect: 30, unit: '% at equal level', what: 'connects',
    denominator: 'attempts against a target of EQUAL level that is not immune (Sturdy refuses it '
               + 'outright, and an Ice-type refuses Sheer Cold). The rate is level-dependent by '
               + 'formula; at Level 50 mirror it is 30.',
    clicks: CLICKS ? (CLICKS[m.id] || 0) : null,
  });
}

/* ---- 4. MULTI-HIT COUNT --------------------------------------------------------------------------
 * The 2-5 family is a DISTRIBUTION, not a mean. ROADMAP #103 records the count once BEING the mean,
 * and the constructed-game run then showed both engines pinned to 2 — so the distribution has never
 * been observed free-running. Loaded Dice and Skill Link both rewrite it and need their own arms. */
for (const m of D.moves.all()) {
  if (m.isNonstandard || !Array.isArray(m.multihit)) continue;
  const [lo, hi] = m.multihit;
  if (lo === hi) continue;
  add({
    family: 'multihit', subject: m.id, kind: 'move',
    expect: (lo === 2 && hi === 5) ? '2:35 3:35 4:15 5:15' : lo + '-' + hi, unit: '% per hit count',
    what: 'hit-count distribution',
    denominator: 'uses that CONNECTED at least once, split into a separate arm for Loaded Dice (4-5) '
               + 'and Skill Link (always 5). Pooling those with the bare case hides both.',
    clicks: CLICKS ? (CLICKS[m.id] || 0) : null,
  });
}

/* ---- 5. CRIT RATE --------------------------------------------------------------------------------
 * Will: *"FOCUS ENERGY (DRAGON CHEER, SCOPE LENS, ETC) WILL BE PART OF THE MILLION GAMES, IF INCREASED
 * CRIT RATE, THEN IT WORKS."* The base rate is 1/24 in this generation and every stage roughly halves
 * the denominator. The pin never lets a crit land, so none of this family has ever been observed.
 *
 * NOTE WHAT IS *NOT* HERE. `preventsCrit` — Battle Armor, Shell Armor, Disguise, Ice Face — does NOT
 * need the die, because three legal moves ALWAYS crit: Storm Throw, Flower Trick and Frost Breath.
 * One staged board settles those four. Keeping them here would be the exact mistake this file's
 * header warns about. */
const CRIT_STAGE = { 0: 4.167, 1: 12.5, 2: 50, 3: 100 };
for (const kind of ['abilities', 'items', 'moves']) {
  const box = TAGS[kind] || {};
  for (const [key, row] of Object.entries(box)) {
    if (!(row.tags || []).includes('critRatioUp')) continue;
    add({
      family: 'crit', subject: key, kind: kind.replace(/ies$/, 'y').replace(/s$/, ''),
      expect: 'above ' + CRIT_STAGE[0] + '%', unit: '% of hits that crit', what: 'raises the crit stage',
      denominator: 'HITS delivered while the effect is active, against a target WITHOUT Battle Armor '
                 + 'or Shell Armor. Compare to the same carrier without it — the claim is that the '
                 + 'rate MOVES, not that it hits a particular number, because stages compose.',
      clicks: CLICKS && kind === 'moves' ? (CLICKS[key] || 0) : null,
    });
  }
}

/* ---- 6. ABILITY AND ITEM PROC RATES ---------------------------------------------------------------
 * Named individually by the roster as COULD-NOT-STAGE with the reason *"its effect is a 30% chance,
 * and the driver's pin makes every sub-100% roll fail in both engines"*. That is not a fixture that
 * needs improving; it is this run's job. */
const PROC = {
  cursedbody: [30, 'disables the move that hit it'], cutecharm: [30, 'infatuates on contact'],
  effectspore: [30, 'poison/paralysis/sleep on contact'], flamebody: [30, 'burns on contact'],
  poisonpoint: [30, 'poisons on contact'], poisontouch: [30, 'poisons what it touches'],
  quickdraw: [30, 'moves first within its bracket'], harvest: [50, 'restores its berry'],
  healer: [30, 'cures an ally\'s status'],
  focusband: [10, 'survives on 1 HP'], kingsrock: [10, 'flinches'], quickclaw: [20, 'moves first'],
};
for (const [key, [pct, what]] of Object.entries(PROC)) {
  const isItem = !!D.items.get(key).exists;
  add({
    family: 'proc', subject: key, kind: isItem ? 'item' : 'ability',
    expect: pct, unit: '% of eligible triggers', what,
    denominator: 'occasions the trigger was actually REACHED — a contact ability needs a contact move '
               + 'that connected, Focus Band needs a hit that would otherwise have been lethal from '
               + 'full-ish HP, Quick Claw needs a turn where moving first would change the board.',
    clicks: null,
    sheet_teams: SHEETS && !isItem ? ((SHEETS.abilities[key] || {}).teams ?? null)
               : SHEETS && isItem ? ((SHEETS.items[key] || {}).teams ?? null) : null,
  });
}

/* ---- 7. TRACE — RANDOM AMONG ELIGIBLE FOES --------------------------------------------------------
 * Will: *"TRACE IS RANDOM BUT SOME ABILITIES ARENT TRACEABLE."* Both halves are true and both are
 * derivable. Showdown samples uniformly among adjacent foes whose ability lacks `flags.notrace`
 * (`data/abilities.ts`, `onUpdate`), so in doubles with two eligible foes it is a coin flip. Trace is
 * modelled as NOTHING in our tags today, on 274 sheet teams. */
const notrace = D.abilities.all().filter(a => !a.isNonstandard && a.flags && a.flags.notrace).map(a => a.id).sort();
add({
  family: 'random-choice', subject: 'trace', kind: 'ability',
  expect: 'uniform over eligible adjacent foes', unit: '% per foe', what: 'copies a random eligible foe',
  denominator: 'entries with TWO eligible adjacent foes — the only case where the choice is observable. '
             + 'Eligible means the foe\'s ability lacks flags.notrace; ' + notrace.length + ' legal '
             + 'abilities are ineligible in this format.',
  clicks: null, sheet_teams: SHEETS ? ((SHEETS.abilities.trace || {}).teams ?? null) : null,
  note: 'ineligible: ' + notrace.join(' '),
});

/* ---- 8. STATUS DURATIONS AND SELF-HARM ------------------------------------------------------------
 * Every one of these is a die the pin freezes, and each has a denominator that is easy to get wrong.
 * Confusion in particular is a rate per ATTEMPTED move while confused, not per turn. */
add({ family: 'duration', subject: 'slp', kind: 'status', expect: '1-3 turns, uniform', unit: 'turns',
      what: 'sleep length', clicks: null,
      denominator: 'bodies that FELL asleep and were not woken early by Wake-Up Slap, Uproar or an '
                 + 'ability. Early Bird halves it and needs its own arm.' });
add({ family: 'duration', subject: 'frz', kind: 'status', expect: 20, unit: '% thaw per turn',
      what: 'thaw chance', clicks: null,
      denominator: 'frozen upkeeps. A Fire-type move or Scald thaws outright and is NOT a sample of '
                 + 'the 20%.' });
add({ family: 'chance', subject: 'par', kind: 'status', expect: 25, unit: '% full paralysis',
      what: 'fails to move', clicks: null,
      denominator: 'attempted moves while paralysed.' });
add({ family: 'chance', subject: 'confusion', kind: 'volatile', expect: 33, unit: '% self-hit',
      what: 'hits itself', clicks: null,
      denominator: 'attempted moves while confused — per ATTEMPT, not per turn, and the 1-4 turn '
                 + 'duration is a second die needing its own row.' });
add({ family: 'duration', subject: 'confusion-length', kind: 'volatile', expect: '2-5 turns',
      unit: 'turns', what: 'confusion length', clicks: null,
      denominator: 'bodies that became confused and were not cured early.' });
add({ family: 'chance', subject: 'attract', kind: 'volatile', expect: 50, unit: '% immobilised',
      what: 'fails to move', clicks: null,
      denominator: 'attempted moves while infatuated.' });

/* ---- 9. PROTECT-CHAIN FAILURE ---------------------------------------------------------------------
 * The counter is x3 per consecutive success in this generation, so the SECOND Protect succeeds one
 * third of the time and the third one ninth. ROADMAP #59 records that our tags collapse three
 * distinct protect behaviours into two, which makes this row a check on the tagging as much as the
 * rate. */
add({ family: 'chance', subject: 'protect-chain', kind: 'move',
      expect: '1/3 then 1/9 then 1/27', unit: 'success rate by consecutive use',
      what: 'consecutive protect succeeds', clicks: CLICKS ? (CLICKS.protect || 0) : null,
      denominator: 'CONSECUTIVE uses only — the counter resets the moment any other action succeeds, '
                 + 'and Baneful Bunker / Spiky Shield / Silk Trap share one counter with Protect.' });

/* ---- THE ARTIFACT --------------------------------------------------------------------------------- */
rows.sort((a, b) => (b.clicks || b.sheet_teams || 0) - (a.clicks || a.sheet_teams || 0));
const byFamily = {};
for (const r of rows) byFamily[r.family] = (byFamily[r.family] || 0) + 1;

const art = {
  generated: new Date().toISOString(),
  by: 'engine/million_targets.js',
  what: 'Every mechanic a single staged board cannot settle, with the rate it must show and the '
      + 'denominator it must be measured over. The work list for the million-game run.',
  the_line: 'A RULE is settled by one board and belongs in the scenario catalogue. A DIE needs this '
          + 'run. A deterministic mechanic that only shows up wrong here means the catalogue has a hole, '
          + 'and fixing it here is the slow, late way round.',
  why_not_the_differential: 'engine/replay_differential.js pins every die identically over both '
      + 'engines. That is correct for finding a wrong RULE and fatal for a wrong RATE: pinning the '
      + 'outcome to what was observed makes a wrong probability agree with itself. Its --rates arm is '
      + 'designed and deferred for want of exactly this corpus.',
  denominator_warning: 'A rate over the wrong denominator is worse than no rate, because it looks like '
      + 'an answer. Every row states its own.',
  corpus_warning: 'A self-play corpus where nobody switches yields ZERO samples for Intimidate on '
      + 'entry, hazard chip and Regenerator however many games it runs. Coverage is a property of the '
      + 'action set, not of N.',
  not_here: 'preventsCrit (Battle Armor, Shell Armor, Disguise, Ice Face) is deliberately EXCLUDED: '
          + 'Storm Throw, Flower Trick and Frost Breath always crit, so one staged board settles those '
          + 'four without a die.',
  counts: { rows: rows.length, by_family: byFamily },
  rows,
};
fs.writeFileSync(OUT, JSON.stringify(art, null, 2) + '\n');

console.log('  ' + rows.length + ' targets for the million-game run');
for (const [f, n] of Object.entries(byFamily).sort((a, b) => b[1] - a[1]))
  console.log('     ' + String(n).padStart(4) + '  ' + f);
if (TOP) {
  console.log('\n    busiest rows:');
  for (const r of rows.slice(0, TOP))
    console.log('      ' + String(r.clicks ?? r.sheet_teams ?? '—').padStart(8) + '  '
              + String(r.subject).padEnd(18) + String(r.expect).padEnd(22) + r.what);
}
console.log('\n  wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
