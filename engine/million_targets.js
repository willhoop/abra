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

/* ===== EVERY ROW MUST SAY WHERE ITS NUMBER CAME FROM. THIS IS THE RULE, NOT A FIELD. ===============
 *
 * Will, 2026-08-10, after the fifth memory-typed value in one evening: *"stop typing from memory make
 * that a rule."*
 *
 * A rule that is only prose is a preference — this repo says so in three separate places and was right
 * every time. So `from` is REQUIRED and `add()` throws without it. Three legal shapes:
 *
 *   DERIVED:<expr>   read out of Dex.forFormat AT GENERATION TIME. Self-correcting: if the mod changes
 *                    tomorrow, this row changes with it and nobody has to remember.
 *   READ:<file>:<n>  read from Showdown source by a human, with the line cited. Not self-correcting,
 *                    so it is second best, and the citation is what makes it checkable at all.
 *   HAND             typed from memory. tests/test-target-provenance.js FAILS on any of these.
 *
 * WHAT THIS WOULD HAVE CAUGHT, all found by Will asking one at a time: par 25%→12.5%, slp "2 or 3"→
 * "1 or 2", frz "fixed timer"→"25%/turn AND a 3-turn cap", healer 30%→50%, Sheer Cold 30%→20%.
 * Five wrong values in one file, and the count of rows that could say where they came from was ZERO. */
const rows = [];
const add = (r) => {
  if (!r.from) throw new Error('million_targets: row "' + r.subject + '" has no `from` — every number '
    + 'must declare DERIVED:<expr>, READ:<file>:<line>, or HAND. Typing a Pokemon value from memory is '
    + 'the single most common defect in this project.');
  rows.push(r);
};

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
      from: 'DERIVED:D.moves.get(' + m.id + ').secondary.chance',
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
  /* AN OHKO MOVE'S `accuracy` FIELD IS A LIE AND THIS LOOP WAS PUBLISHING IT. `battle-actions.ts:696`
   * says outright "bypasses accuracy modifiers" and OVERWRITES accuracy with 30 (or 20 for a non-Ice
   * Sheer Cold) plus the level difference. Sheer Cold was landing in this family at 30 AND in the ohko
   * family at 20 — two rows, one subject, two different numbers for the run to chase. Family 3 owns it. */
  if (m.ohko) continue;
  add({
    family: 'accuracy', subject: m.id, kind: 'move',
    expect: m.accuracy, unit: '% of attempts that connect', what: 'lands',
    from: 'DERIVED:D.moves.get(' + m.id + ').accuracy',
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
    /* THIS ROW SAID A FLAT 30 FOR EVERY OHKO MOVE AND THAT IS WRONG FOR SHEER COLD. Showdown sets
     * accuracy = 30, then `if (move.ohko === 'Ice' && gen >= 7 && !pokemon.hasType('Ice')) accuracy = 20`.
     * A non-Ice user's Sheer Cold is TWO THIRDS the rate this file claimed. Caught by reading the
     * source for a citation, which is the entire argument for requiring one. */
    family: 'ohko', subject: m.id, kind: 'move',
    expect: m.ohko === 'Ice' ? '30 if the user is Ice-type, 20 if it is not' : 30,
    unit: '% at equal level', what: 'connects',
    from: 'READ:sim/battle-actions.ts:697-704 (accuracy=30; Ice-clause 20; then += level diff)',
    denominator: 'attempts against a target of EQUAL level that is not immune (Sturdy refuses it '
               + 'outright, and an Ice-type refuses Sheer Cold). The rate is level-dependent by '
               + 'formula; at Level 50 mirror it is the base. A non-Ice-type user of Sheer Cold needs '
               + 'its OWN arm at 20 — pooling the two hides both.',
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
    /* THE 2-5 WEIGHTING IS HARDCODED AND CHAMPIONS COPIES IT VERBATIM. `battle-actions.ts:869` samples
     * [2 x7, 3 x7, 4 x3, 5 x3] out of 20 = 35/35/15/15, and `mods/champions/scripts.ts:441` contains the
     * identical line — so `hitStepMoveHitLoop`, one of the eleven overrides mod_audit.js can only NAME,
     * is VERIFIED IDENTICAL for hit count. Every other array is a flat random(lo, hi+1). */
    from: 'DERIVED:D.moves.get(' + m.id + ').multihit=[' + lo + ',' + hi + '] + READ:sim/battle-actions.ts:869 and mods/champions/scripts.ts:441 (identical sample)',
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
/* THE STAGE INDEX WAS OFF BY ONE AGAINST SHOWDOWN'S OWN AND THAT MATTERS FOR COMPARING.
 * `dex-moves.ts:486` sets `critRatio = Number(data.critRatio) || 1` — the BASE is stage 1, not 0 — and
 * `battle-actions.ts:1633` picks `critMult = [0, 24, 8, 2, 1]` for gen >= 7, clamped to 0..4. So the
 * rate is 1/critMult[stage]. The percentages here were right; the labels were mine, and a row labelled
 * "stage 0" cannot be lined up against a log that says critRatio 1. */
const CRIT_MULT = [0, 24, 8, 2, 1];
const CRIT_LADDER = CRIT_MULT.map((d, i) => d ? 'stage ' + i + ': 1/' + d + ' = '
                                    + (100 / d).toFixed(3) + '%' : null).filter(Boolean).join(', ');
const CRIT_BASE = (100 / CRIT_MULT[1]).toFixed(3);
for (const kind of ['abilities', 'items', 'moves']) {
  const box = TAGS[kind] || {};
  for (const [key, row] of Object.entries(box)) {
    if (!(row.tags || []).includes('critRatioUp')) continue;
    add({
      family: 'crit', subject: key, kind: kind.replace(/ies$/, 'y').replace(/s$/, ''),
      expect: 'above ' + CRIT_BASE + '%', unit: '% of hits that crit', what: 'raises the crit stage',
      from: 'READ:sim/battle-actions.ts:1633 critMult=[0,24,8,2,1] + dex-moves.ts:486 base critRatio=1',
      note: 'Showdown ladder — ' + CRIT_LADDER,
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
/* THIS TABLE USED TO CARRY TWELVE HAND-TYPED PERCENTAGES AND HEALER'S WAS WRONG — 30, which is
 * mainline's, against Champions' `randomChance(1, 2)` = 50. Nothing in the table could have told you
 * that, because a number typed next to a name looks exactly as authoritative as a number that was read.
 *
 * So the rate is now READ OUT OF THE HANDLER ITSELF. Every one of these effects rolls its die in its own
 * `onDamagingHit`/`onResidual`/`onModifyMove`, and the roll is visible in the function source:
 *   `this.randomChance(a, b)`             -> a/b            (10 of the 12)
 *   `this.random(100)` + `r < N` ladders  -> the thresholds  (Effect Spore: 11 slp / 10 par / 9 psn)
 *   a pushed `{chance: N}` secondary      -> N              (King's Rock)
 * If the mod re-rolls any of them tomorrow this file follows without an edit. That is the difference
 * between a value and a derivation, and it is the whole reason the healer bug was possible. */
const PROC_WHAT = {
  cursedbody: 'disables the move that hit it', cutecharm: 'infatuates on contact',
  effectspore: 'poison/paralysis/sleep on contact', flamebody: 'burns on contact',
  poisonpoint: 'poisons on contact', poisontouch: 'poisons what it touches',
  quickdraw: 'moves first within its bracket', harvest: 'restores its berry',
  healer: 'cures an ally\'s status',
  focusband: 'survives on 1 HP', kingsrock: 'flinches', quickclaw: 'moves first',
};
const handlerSrc = (e) => Object.entries(e).filter(([, v]) => typeof v === 'function')
                                           .map(([, v]) => String(v)).join(' ');
function procRate(entry) {
  const src = handlerSrc(entry);
  const rc = [...src.matchAll(/randomChance\((\d+),\s*(\d+)\)/g)];
  if (rc.length) {
    const set = [...new Set(rc.map(m => +m[1] / +m[2]))];
    if (set.length === 1) return { expect: +(100 * set[0]).toFixed(3), from: 'DERIVED:randomChance(' + rc[0][1] + ',' + rc[0][2] + ') in the handler' };
    return { expect: set.map(x => (100 * x).toFixed(3) + '%').join(' / '), from: 'DERIVED:several randomChance calls in the handler' };
  }
  /* a this.random(100) ladder — read the thresholds and DIFFERENCE them, because `r < 21` after
   * `r < 11` is a 10% band, not a 21% one. Effect Spore is 11/10/9, never the flat 30 I had. */
  const rnd = src.match(/this\.random\((\d+)\)/);
  if (rnd) {
    const cuts = [...src.matchAll(/r\s*<\s*(\d+)\)\s*\{\s*[^}]*?trySetStatus\("([a-z]+)"/g)]
      .map(m => ({ upto: +m[1], status: m[2] }));
    if (cuts.length) {
      let prev = 0; const bands = [];
      for (const c of cuts) { bands.push(c.status + ' ' + (100 * (c.upto - prev) / +rnd[1]).toFixed(3) + '%'); prev = c.upto; }
      return { expect: bands.join(' / ') + '  (total ' + (100 * prev / +rnd[1]).toFixed(3) + '%)',
               from: 'DERIVED:this.random(' + rnd[1] + ') threshold ladder in the handler' };
    }
  }
  const sec = src.match(/secondaries\.push\(\{\s*chance:\s*(\d+)/);
  if (sec) return { expect: +sec[1], from: 'DERIVED:the {chance} of the secondary the handler pushes' };
  return { expect: null, from: null };   /* -> add() throws, which is the point */
}
for (const key of Object.keys(PROC_WHAT)) {
  const what = PROC_WHAT[key];
  const isItem = !!D.items.get(key).exists;
  const entry = isItem ? D.items.get(key) : D.abilities.get(key);
  const { expect, from } = procRate(entry);
  if (expect === null) throw new Error('million_targets: could not DERIVE a rate for ' + key
    + ' from its handler source. Do NOT type one in — find the roll, or drop the row and say so.');
  add({
    family: 'proc', subject: key, kind: isItem ? 'item' : 'ability',
    expect, from, unit: '% of eligible triggers', what,
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
  from: 'DERIVED:D.abilities.all() flags.notrace + READ:data/abilities.ts trace.onUpdate — sample() over eligible foes',
  denominator: 'entries with TWO eligible adjacent foes — the only case where the choice is observable. '
             + 'Eligible means the foe\'s ability lacks flags.notrace; ' + notrace.length + ' legal '
             + 'abilities are ineligible in this format.',
  clicks: null, sheet_teams: SHEETS ? ((SHEETS.abilities.trace || {}).teams ?? null) : null,
  note: 'ineligible: ' + notrace.join(' '),
});


/* ---- THE THREE STATUS ROWS WERE WRITTEN FROM MAINLINE AND ALL THREE ARE WRONG ------------------
 *
 * Will, 2026-08-10: *"where else might mainline data have snuck in aside from the champions mod?"*
 * The answer was `data/mods/champions/conditions.ts`, which overrides par, slp and frz, and which
 * nothing in this project had ever read:
 *
 *     par   randomChance(1, 8)      = 12.5%, not the 25% I wrote
 *     slp   sample([2,3,3]) startTime, and mainline's onBeforeMove decrements BEFORE acting, so
 *           the holder MISSES 1 or 2 turns — 1/3 chance of 1. Will: "i thought champions is either
 *           1 or 2 turns of sleep". Right. I reported the internal COUNTER as if it were turns.
 *     frz   BOTH a 25% thaw roll every turn AND a hard 3-turn ceiling. Will: "freeze has a chance
 *           to dethaw each turn double check". Right again — I stopped reading at line 45 and the
 *           frz block's onBeforeMove starts at 46. Mainline is 20%; Champions is 25%.
 *
 * Paralysis is HALF what this file claimed. Freeze is not a die at all. Every one of these would
 * have failed a correct engine, or — far worse — passed a wrong one that happened to match mainline.
 * It is the Moonblast error again: 30% written where the format says 10%.
 *
 * THE GENERAL RULE, and it is bigger than these three: the Champions mod overrides EIGHT files —
 * abilities, moves, items, conditions, learnsets, rulesets, formats-data and scripts. Two of the
 * eight have been audited, both only after they bit us. `scripts.ts` alone overrides `modifyDamage`,
 * `statModify`, `calculatePP`, `formeChange`, `getActionSpeed`, `canMegaEvo`, `spreadMoveHit` and
 * `hitStepMoveHitLoop` — the damage formula, the SP formula, and the multi-hit loop. Read the MOD. */
/* ---- 8. STATUS DURATIONS AND SELF-HARM ------------------------------------------------------------
 * Every one of these is a die the pin freezes, and each has a denominator that is easy to get wrong.
 * Confusion in particular is a rate per ATTEMPTED move while confused, not per turn. */
add({ family: 'duration', subject: 'slp', kind: 'status', expect: '1 or 2 turns asleep, 1/3 chance of 1', unit: 'turns',
      what: 'sleep length', clicks: null,
      from: 'READ:data/mods/champions/conditions.ts:11 slp — sample([2,3,3]) is a startTime and onBeforeMove decrements BEFORE acting, so the OBSERVABLE is one fewer than the counter',
      denominator: 'bodies that FELL asleep and were not woken early by Wake-Up Slap, Uproar or an '
                 + 'ability. Early Bird halves it and needs its own arm.' });
add({ family: 'duration', subject: 'frz', kind: 'status', expect: '25% thaw per turn, AND a hard 3-turn ceiling', unit: '% per turn + cap',
      what: 'thaw chance', clicks: null,
      from: 'READ:data/mods/champions/conditions.ts:31 frz — BOTH clauses; the block runs to 55 and I stopped at 45 the first time',
      denominator: 'frozen upkeeps. A Fire-type move or Scald thaws outright and is NOT a sample of '
                 + 'the 20%.' });
add({ family: 'chance', subject: 'par', kind: 'status', expect: 12.5, unit: '% full paralysis',
      what: 'fails to move', clicks: null,
      from: 'READ:data/mods/champions/conditions.ts:5 par — randomChance(1, 8). Mainline is 1/4, and 25 is what I typed.',
      denominator: 'attempted moves while paralysed.' });
add({ family: 'chance', subject: 'confusion', kind: 'volatile', expect: 33, unit: '% self-hit',
      what: 'hits itself', clicks: null,
      from: 'READ:data/conditions.ts:187 confusion.onBeforeMove randomChance(33, 100) — a flat 33, NOT 1/3. Not overridden by the mod: the mod\'s moves.ts confusion entry is the MOVE Confusion, marked isNonstandard Past.',
      denominator: 'attempted moves while confused — per ATTEMPT, not per turn, and the 1-4 turn '
                 + 'duration is a second die needing its own row.' });
/* THIS ROW WAS THE SLEEP ERROR A SECOND TIME AND NOBODY HAD CAUGHT IT YET. `this.random(2, 6)` seeds
 * an internal counter of 2-5, and `onBeforeMove` DECREMENTS IT BEFORE ROLLING — at zero the body is
 * cured and moves freely. So the counter is 2-5 and the OBSERVABLE is 1-4 attempted moves that are
 * actually at risk. Will caught exactly this shape on sleep ("i thought champions is either 1 or 2");
 * I had shipped the same mistake one row down and would have failed a correct engine with it. */
add({ family: 'duration', subject: 'confusion-length', kind: 'volatile',
      expect: '1-4 attempted moves at risk (internal counter 2-5; Axe Kick seeds 3-5)',
      unit: 'attempted moves', what: 'confusion length', clicks: null,
      from: 'READ:data/conditions.ts:174 random(min,6) with min=2, and :183 the pre-decrement in onBeforeMove',
      denominator: 'bodies that became confused and were not cured early. Count ATTEMPTED MOVES, not '
                 + 'turns: a turn spent switching or asleep never reaches the confusion roll.' });
add({ family: 'chance', subject: 'attract', kind: 'volatile', expect: 50, unit: '% immobilised',
      what: 'fails to move', clicks: null,
      from: 'READ:data/moves.ts:745 attract condition randomChance(1, 2) — the mod does not override attract, checked',
      denominator: 'attempted moves while infatuated.' });

/* ---- 9. PROTECT-CHAIN FAILURE ---------------------------------------------------------------------
 * The counter is x3 per consecutive success in this generation, so the SECOND Protect succeeds one
 * third of the time and the third one ninth. ROADMAP #59 records that our tags collapse three
 * distinct protect behaviours into two, which makes this row a check on the tagging as much as the
 * rate. */
add({ family: 'chance', subject: 'protect-chain', kind: 'move',
      expect: '1/3 then 1/9 then 1/27', unit: 'success rate by consecutive use',
      what: 'consecutive protect succeeds', clicks: CLICKS ? (CLICKS.protect || 0) : null,
      from: 'READ:data/conditions.ts:439-462 stall — counter starts 3, *=3 per restart, counterMax 729, randomChance(1, counter). Not overridden by the mod, checked.',
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
