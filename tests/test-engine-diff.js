/* DIFFERENTIAL TEST — where does MEDICHAM disagree with Showdown?
 *
 *   SHOWDOWN_PATH=... node tests/test-engine-diff.js [--n 200]
 *
 * WHY THIS EXISTS, AND WHY IT REPLACES GUESSING
 * ---------------------------------------------
 * Every mechanic gap found on 2026-08-03 was found one of two ways: Will noticed something wrong in
 * a live game, or I picked a tag off a list and probed it. Neither is a method. tests/test-mechanics
 * covers 54 of 172 tags and I chose which 54, and the two attempts to systematise the choice both
 * failed -- tests/mechanics_surface.js reports Intimidate as unhandled, and it is verified working.
 *
 * Showdown is the authority. Anywhere the two engines disagree about the same attack is a MEDICHAM
 * bug, including bugs nobody has imagined. That is the property guessing cannot have.
 *
 * It found Freeze-Dry immediately: an Ice move that is SUPER EFFECTIVE on Water, which MEDICHAM was
 * pricing BELOW Ice Beam into a Water type. 1,247 corpus clicks, and the move's whole identity.
 *
 * WHAT IT COMPARES. One attacker, one move, one defender, no items or abilities unless the scenario
 * asks for them, damage only. Damage is where the engines can be compared cleanly -- it is a number
 * both produce for the same inputs. Turn ORDER, status duration and switch behaviour need a
 * different harness and are not attempted here rather than attempted badly.
 *
 * WHAT A DISAGREEMENT IS. Showdown's damage varies over a 16-roll spread; MEDICHAM reports a min and
 * a max. They agree when the ranges overlap and the midpoints are within 12%. A tighter bound would
 * report rounding as a bug; a looser one would miss a resisted-vs-neutral error.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const CS = require(D('engine', 'champions_sim.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));

const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
/* ARGUMENTS, PARSED LOUDLY. `argv[argv.indexOf('--n') + 1]` reads argv[0] -- the node binary path --
 * when the flag is absent, because indexOf returns -1. parseInt of that is NaN, and the first version
 * of the seed below printed `seed NaN` while quietly running seed 1. Exactly the silent default the
 * project's first rule is about: it looked like a configured run and was not one. */
const argInt = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  if (i < 0) return dflt;
  const v = parseInt(process.argv[i + 1], 10);
  if (!Number.isFinite(v)) { console.error(`  ${flag} needs a number, got ${process.argv[i + 1]}`); process.exit(2); }
  return v;
};
const N = argInt('--n', 150);

/* THE SAMPLER IS SEEDED, because the HEADLINE OF THIS FILE IS A COUNT and a count nobody can
 * reproduce is not a measurement.
 *
 * It drew its matchups from bare Math.random(). engine/status.js prints "3/120 differential
 * comparisons disagree with Showdown" beside artifact-backed figures, as though re-running would
 * produce it again -- and it would not: a second run draws a different 120 rows and reports a
 * different number, with different names under it. That is the same defect as an unpinned damage
 * roll, one level up. Two runs of the unseeded sampler on the same source gave 6 and then 3.
 *
 * So the draw is an LCG (Numerical Recipes constants) with a CONSTANT default seed, and
 * `--seed N` moves it. A residual quoted anywhere must name its seed and its --n; a residual that
 * changes when only the seed changes is sampling noise, not an engine change. */
const SEED = argInt('--seed', 20260804);

/* ---- ROADMAP #88 HERE: THE ROLL IS TWO CORNERS, AND THE MIDPOINT COULD NOT SEE EITHER -----------
 *
 * THIS FILE'S HEADLINE — "0 of 6000 disagree" — WAS A CLAIM ABOUT MIDPOINTS. `sMid` and `mMid` are
 * averages of the two endpoints, and `rel` is computed on them alone. That is strictly weaker than it
 * reads, and the weakness is not hypothetical: a MEDICHAM range that is too WIDE or too NARROW by the
 * same amount at both ends has an IDENTICAL midpoint and cannot move `rel` at all. The whole 16-roll
 * interior sits behind one averaged number.
 *
 * IT IS THE SAME SHAPE AS THE PIN IN `engine/game_differential.js`, which is why it carries the same
 * roadmap number. There the dice were pinned to one corner; here both corners were computed and then
 * ADDED TOGETHER before anything was compared, which throws the corners away just as thoroughly.
 * CHANGELOG 3.75.0 records what that costs: the rolled crit sat in the wrong position in the damage
 * formula, 46.5% wrong at the BOTTOM roll and invisible at the top, and every check in this repo was
 * green throughout.
 *
 * SO: TWO ARMS, EACH AT THE SAME 12% RELATIVE BAND THE MIDPOINT ALREADY USED.
 *   top     Showdown's roll index 0  against MEDICHAM's `max`
 *   bottom  Showdown's roll index 15 against MEDICHAM's `min`
 * The tolerance policy is deliberately UNCHANGED — this pass is about which quantity is compared, not
 * about how close it has to be, and moving both at once would make a red row unattributable.
 *
 * `--plant spread` IS THE RED DEMONSTRATION AND IT IS BUILT INTO THE FILE. It widens MEDICHAM's range
 * symmetrically, which leaves the midpoint EXACTLY where it was: the old number stays at whatever it
 * was and the two new arms light up. A probe that only ever agrees with the number beside it is not
 * coverage, so the plant is the evidence that these arms see something the midpoint structurally
 * cannot. It must never be on in a run whose artifact is kept, and the artifact records it. */
const PLANT = (() => {
  const i = process.argv.indexOf('--plant');
  if (i < 0) return null;
  const k = process.argv[i + 1];
  /* ROADMAP #304 — `band` IS THE INTERIOR ARMS' OWN RED DEMONSTRATION, and it is the exact inverse of
   * `spread`. `spread` widens the RANGE, so the midpoint cannot move and the two corners must; `band`
   * perturbs the FOURTEEN INTERIOR ROLLS and leaves indices 0 and 15 alone, so the midpoint AND both
   * corners must read their unplanted values while the interior arms light up. An arm with no plant
   * that can move it is an arm nobody has checked. */
  if (k !== 'spread' && k !== 'band') {
    console.error('  --plant takes:\n'
      + '    spread   widen MEDICHAM\'s range symmetrically — midpoint unmoved, BOTH CORNERS light up\n'
      + '    band     perturb the 14 INTERIOR rolls only — midpoint and both corners unmoved, the\n'
      + '             interior arms light up');
    process.exit(2);
  }
  return k;
})();
const PLANT_HALFWIDTH = argInt('--plant-halfwidth', 12);

let _rngState = (SEED >>> 0) || 1;
const rnd = () => { _rngState = (Math.imul(1664525, _rngState) + 1013904223) >>> 0; return _rngState / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/* THE SCENARIOS COME FROM REAL USAGE, not from a hand-written list -- otherwise this inherits the
 * same blind spot as the probes it replaces. Attackers are the species people bring, moves are what
 * that species actually clicks, defenders are drawn from the same pool. */
const tags = JSON.parse(fs.readFileSync(D('data', 'abra-tags.js'), 'utf8')
  .replace(/^[^{]*/, '').replace(/;\s*$/, ''));
const movePriors = JSON.parse(fs.readFileSync(D('data', 'move-priors.json'), 'utf8'));

/* EVERY ROW THIS HARNESS DROPS BECAUSE SOMETHING THREW IS COUNTED, and the reason is kept.
 *
 * Five catch blocks in this file returned a plausible `null` and said nothing, so a row that failed
 * to BUILD and a row that was never sampled were the same event. That matters more here than almost
 * anywhere: the headline number is a RESIDUAL -- "1 of 400 disagree" -- and a silent drop shrinks the
 * denominator without shrinking the claim. tests/test-no-silent-failure.js flagged all five;
 * `--requested` minus `--compared` was already visible in the artifact, but not WHY.
 *
 * `errs.n` non-zero is not automatically a bug (a species with no dex row genuinely cannot be
 * compared). It is the difference between knowing that and assuming it.
 *
 * DECLARED HERE, above the species filter, because that filter is the FIRST caller and a const
 * declared lower down would have been in its temporal dead zone -- a ReferenceError thrown from
 * inside a catch block, which is the silent-failure bug wearing the fix's clothes. */
const errs = { n: 0, where: {} };
/* NAMED `log...` DELIBERATELY. tests/test-no-silent-failure.js reads the catch BODY, and it cannot
 * see through a helper -- a call to `noteErr(...)` looked exactly as silent as `{}` to it. Rather
 * than exempt the file, the recorder is named for what it does, which makes the body say so to a
 * reader and to the check at the same time. It really does record AND print AND write the artifact;
 * a rename alone would be gaming the ratchet. */
const logDroppedRow = (where, e) => {
  errs.n++;
  const k = where + ': ' + String((e && e.message) || e).slice(0, 60);
  errs.where[k] = (errs.where[k] || 0) + 1;
};

/* ---- THE POOL, AND THE 138 SPECIES IT DROPPED WITHOUT SAYING SO -------------------------------
 *
 * `MEDI.buildMon(s.toLowerCase())` was a FIFTH HAND-ROLLED DOORWAY into MC.mons, and it had the
 * same defect the other four had: `move-priors.json` keys a forme the way Showdown does
 * (`gardevoirmega`, `rotomwash`) and MC.mons keys it WITH A HYPHEN (`gardevoir-mega`,
 * `rotom-wash`). `buildMon` returns null rather than throwing on a key it has never seen, so the
 * filter read that null as "not comparable" and the run reported nothing at all.
 *
 * MEASURED BEFORE THE FIX: 345 species in the priors, 207 drawable, **138 dropped in silence** --
 * 76 of them megas, so the damage differential had NEVER COMPARED A MEGA, and megas are 26.0% of
 * this format's usage. The other 53 are the forme hole `engine/mc_key.js` was written for
 * (rotom-wash, slowking-galar, tauros-paldea-*, the Vivillon patterns). AFTER: 336 drawable.
 *
 * THE RESOLVER IS `mcKey`, not a sixth copy of these three lines -- that is what
 * tests/test-mc-key.js exists to forbid. `mayMiss` is required by engine/lookup.js: without it a
 * miss THROWS, which is the loudness we want everywhere except here, where a species genuinely
 * absent from MC.mons is a real and reportable condition rather than a crash.
 *
 * AND THE DROP IS NOW COUNTED AND NAMED. "A capability was absent and everything reported success"
 * is the failure this project is named after; a pool that silently loses 40% of its species is that
 * failure sitting inside the instrument that is supposed to catch it. `pool` is printed on every run
 * and written into the artifact, so a future drop shows up as a number that moved. */
const { mcKey } = require(D('engine', 'mc_key.js'));
const MAY_MISS = { mayMiss: 'a priors species with no MC.mons row is reportable, not a crash' };
const pool = { priors: 0, drawable: 0, dropped: 0, droppedNames: [], megas: 0 };
/* THE ONE TRANSLATION FROM A PRIORS KEY TO A MEDICHAM BODY. Every caller goes through here, so the
 * pool filter and compareRow cannot disagree about which species exist. */
function mediBody(id) {
  const k = mcKey(id, MAY_MISS);
  if (!k) return null;
  return MEDI.buildMon(k, {});
}
const species = Object.keys(movePriors.species || {})
  .filter(s => {
    pool.priors++;
    let body = null;
    try { body = mediBody(s); } catch (e) { logDroppedRow('buildMon(' + s + ')', e); }
    /* `-mega(-|$)`, NOT `-mega$`: Charizard-Mega-X/Y and Mewtwo-Mega-X/Y carry a suffix after the
     * forme, and the first version of this counter read 72 where the truth is 76. A counter that is
     * four short is the same class of error as the drop it was written to expose. */
    if (body) { pool.drawable++; if (/-mega(-|$)/.test(mcKey(s, MAY_MISS) || '')) pool.megas++; return true; }
    pool.dropped++; pool.droppedNames.push(s);
    return false;
  });
console.log('POOL — species this differential can draw at all, counted rather than assumed:\n'
  + '  move-priors species ' + pool.priors + '   DRAWABLE ' + pool.drawable
  + '   (' + pool.megas + ' of them megas)   DROPPED ' + pool.dropped
  + (pool.dropped ? ':\n    ' + pool.droppedNames.join(' ') : '')
  + '\n  A DROP HERE IS A SPECIES THE DAMAGE DIFFERENTIAL HAS NEVER COMPARED. It is not a pass.\n');

/* CONTROL FIX 5 -- SHOWDOWN'S OWN moveHit SKIPS THE ABILITY'S onTryHit, so the REFERENCE was wrong.
 *
 * battle.actions.moveHit -> spreadMoveHit runs singleEvent('TryHit', MOVE, ...) and nothing else. The
 * ABILITY's onTryHit is run by runEvent('TryHit') inside hitStepTryHitEvent, which lives one level up
 * in trySpreadMoveHit -- an entry point this harness cannot use, because it also rolls accuracy and
 * priority. So Water Absorb never fired and Showdown reported Pelipper's Muddy Water doing 40-48 to a
 * VAPOREON. MEDICHAM's 0-0 was right and the authority was wrong; without this the harness reports the
 * engine's correct immunity as its bug. Proved three ways: forcing Vaporeon to Hydration gives the
 * same 40-48 (so the ability was doing nothing), single-target Hydro Pump also lands (so it is not a
 * spread or targeting rule), and Thunderbolt lands normally (so the body is otherwise fine).
 *
 * Levitate was NOT affected and that is the whole tell: Levitate is onImmunity, which getDamage does
 * reach. The artifact already records the split -- typeImmunity.via is 'onTryHit' or it is not -- so
 * MEMBERSHIP IS DERIVED, never typed. Printed below before it is used, per docs/LESSONS.md 4.
 *
 * Showdown stays the authority for the OUTCOME: the artifact only says where to look, and the
 * ability's own handler is then asked directly. */
const ONTRYHIT_IMMUNE = new Set(Object.keys(tags.abilities || {}).filter(a => {
  const p = tags.abilities[a] && tags.abilities[a].params && tags.abilities[a].params.typeImmunity;
  return !!(p && p.via === 'onTryHit');
}));
/* CONTROL FIX 10 -- THE SAME HOLE, ONE TAG OVER, AND IT WAS SCORING A FALSE PASS.
 *
 * CONTROL FIX 5 closed `typeImmunity.via === 'onTryHit'` because moveHit does not run the ability's
 * TryHit. `immuneToMoveClass` answers through exactly the same handler and was not in the set, so
 * `forretress rockblast -> kommoo` read 5-6 on BOTH sides and was scored AGREE -- Showdown was
 * wrong for the harness's reason and MEDICHAM was wrong for its own, and the two errors cancelled.
 * A false agreement is the more expensive kind, because nothing prints.
 *
 * LANDED IN THE SAME PASS AS THE ENGINE FIX, never before it. On its own this turns a green row red
 * with no fix beside it, which is the one thing CLAUDE.md forbids filing. WIRE 22 in
 * medicham2-browser.js is the other half. */
const ONTRYHIT_CLASS = new Set(Object.keys(tags.abilities || {}).filter(a => {
  const p = tags.abilities[a] && tags.abilities[a].params && tags.abilities[a].params.immuneToMoveClass;
  return !!(p && p.blocksFlag);
}));

const FILLER = ['Ditto', 'Ditto', 'Ditto'];
/* THE INERT SLOT'S MOVE IS DERIVED, NOT NAMED (2026-08-09, ROADMAP #116). This file padded every
 * non-acting slot with 'Tackle', and TACKLE IS `isNonstandard: 'Past'` — it does not exist in this
 * format. Harmless here, because those slots never move, and the same habit that has now been caught
 * four times in two days: a name recalled instead of read. */
const inertMove = (species) => CS.firstLegalMove(species) || CS.INERT_MOVE;
const mkSet = (name, moveName) => ({
  name, species: name, item: '', ability: dex.species.get(name).abilities['0'] || '',
  moves: [moveName], nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
  /* CONTROL FIX 6 -- GENDERLESS ON BOTH SIDES.
   *
   * gender:'' does not mean "no gender" to Showdown; it means "roll one off the species ratio and
   * the battle seed". MEDICHAM has no gender at all -- MC.mons carries none and buildMon returns
   * none -- so every gender-reading mechanic was being compared against a coin.
   *
   * It showed up as luxray superpower -> alcremie, showdown 37-44 against medicham 50-59. 37/50 is
   * 0.74: RIVALRY, x0.75 into the opposite gender, and Alcremie is female-only. Nothing MEDICHAM
   * could ever match, and it would have flipped to 1.25 and a different verdict on a different seed.
   * A seed-dependent "bug" is the worst kind, because re-running looks like the fix worked.
   *
   * 'N' makes Rivalry 1.0 and Cute Charm/Attract/Captivate inert on both sides, which is exactly the
   * state MEDICHAM is in. The COST is recorded rather than hidden: Rivalry is now untestable here,
   * and it stays on the ENGINE hand list as blocked on data (engine-data.js belongs to MEASURE). */
  gender: 'N',
});

/* A distinct value, so a skip can never be confused with a legitimate null or a legitimate 0. */
const NOT_FINITE = Symbol('showdown damage was not a finite number');
const skipped = { n: 0, moves: {} };
const skippedMulti = { n: 0, moves: {} };
/* DERIVED, not a list of names, and printed below before it is used. */
const MULTIHIT = new Set(Object.keys(tags.moves || {}).filter(id =>
  (tags.moves[id].tags || []).indexOf('multiHit') >= 0));
/* CONTROL FIX 12 -- A MOVE WHOSE BASE POWER IS A COIN, AND THIS FILE WAS READING THE COIN. 2026-08-10.
 *
 * DERIVED from the artifact, never a name: every move carrying `conditionalPower {when: 'chance'}`.
 * Today that is Fickle Beam alone (30% for x2) and the set is PRINTED below before it is used, because
 * every derived set in this project over-matched on its first try.
 *
 * WHY IT IS A CONTROL FAILURE AND NOT A DETAIL. `battle.randomChance` goes STRAIGHT to `this.prng`
 * (sim/battle.js:213) and does not pass through the `battle.random` override on line 235, so the
 * double was drawn off the battle seed while everything else in the row was pinned. It happened to
 * draw FALSE at seed [1,2,3,4], on every row, in both the top and the bottom call. So after the engine
 * fix below these rows read rel 0.0% — AND THEY WOULD HAVE READ 0.0% BY LUCK. That is the exact shape
 * this file has already been burned by four times (CONTROL FIX 6's gender coin, most closely), and a
 * false agreement is the expensive one because nothing prints.
 *
 * SO IT IS PINNED, AND PINNED BOTH WAYS RATHER THAN OFF. CONTROL FIX 11 pins a random crit off because
 * MEDICHAM's `dmgRange` deliberately excludes a crit RATE; the same reasoning says the un-procced
 * branch is what a pure price returns. But pinning only that would leave the 30% branch — the whole
 * mechanic — untested by the differential, which is worse than the bug it replaces. So a carrier is
 * compared TWICE, once with the die pinned false and once true, and MEDICHAM is asked for the matching
 * branch through the seventh argument its battle loop already uses. The row's residual is the WORSE of
 * the two, so an engine that is right on one branch and wrong on the other cannot average out.
 *
 * The override is installed ONLY for a carrier, so every other row in this file draws exactly the
 * stream it drew before and the 19,981 agreements are not disturbed by this fix. */
const CONDCHANCE = new Set(Object.keys(tags.moves || {}).filter(id => {
  const p = (tags.moves[id].params || {}).conditionalPower;
  return !!(p && p.when === 'chance');
}));

/* Showdown's damage for ONE hit, with the roll pinned. The traps here are recorded in
 * engine/validate_damage_sim.js and cost that file two debugging rounds: randomChance() bypasses a
 * battle.random override entirely, so crits must be pinned with willCrit, and a fresh active move is
 * needed per call because moveHitData caches the crit decision per target slot. */
function showdownDamage(attName, moveName, defName, roll, stats, defAbilId, condPin) {
  const teamA = [mkSet(attName, moveName), ...FILLER.map(f => mkSet(f, inertMove(f)))];
  const teamB = [mkSet(defName, inertMove(defName)), ...FILLER.map(f => mkSet(f, inertMove(f)))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const src = battle.p1.active[0], tgt = battle.p2.active[0];
  if (!src || !tgt) return null;
  /* ALIGN THE STATS TO MEDICHAM'S, or this measures the EV spread rather than the damage math.
   *
   * The first run reported twenty "disagreements" and MEDICHAM was higher on EVERY row by a
   * consistent ~1.4x. A systematic offset on every row is never twenty separate bugs -- it was this:
   * the Showdown sets carried 0 EVs and a neutral nature while buildMon gives MEDICHAM a real
   * competitive spread. Same class of error as comparing a Choice Scarf against a Choice Scarf.
   * engine/validate_damage_sim.js already had this exact fix and says why. */
  /* CONTROL FIX 8 -- ALL FOUR OFFENSIVE/DEFENSIVE STATS ON BOTH BODIES, not just the two the
   * ordinary damage formula reads.
   *
   * This aligned the ATTACKER's atk/spa and the DEFENDER's def/spd, which is every stat an ordinary
   * move touches -- and exactly the wrong set for the moves worth checking. FOUL PLAY reads the
   * TARGET's Attack and BODY PRESS reads the USER's Defence; both of those were left at Showdown's
   * 0-EV neutral value while MEDICHAM used a real competitive spread. So the two moves whose whole
   * identity is a swapped stat were the two the harness could not judge: any disagreement on them
   * was the EV spread, and any agreement was luck. Foul Play is on the ENGINE hand list as a real
   * bug (dmgRange reads the `statSwap` tag, which Foul Play does not carry) and the harness could
   * not confirm it. */
  if (stats) {
    src.storedStats.atk = stats.at;  src.storedStats.spa = stats.sa;
    src.storedStats.def = stats.adf; src.storedStats.spd = stats.asd;
    tgt.storedStats.atk = stats.dat; tgt.storedStats.spa = stats.dsa;
    tgt.storedStats.def = stats.df;  tgt.storedStats.spd = stats.sd;
    src.maxhp = stats.ahp; src.hp = stats.ahp;
    tgt.maxhp = stats.hp;  tgt.hp = stats.hp;
  }
  /* CONTROL FIX 7 -- CLEAR THE SWITCH-IN, DO NOT TRY TO MIRROR IT.
   *
   * showdownDamage answers team preview, so both leads are really sent out and every entry ability
   * fires before moveHit. CONTROL FIX 4 handled that by replaying the effects on the MEDICHAM side
   * through applyEntryEffects/applyIntimidate. That works for the three things MEDICHAM models --
   * Intimidate, weather setters, terrain setters -- and silently does not for everything else
   * Showdown fires on entry: Download, Intrepid Sword, Dauntless Shield, Protosynthesis, Quark
   * Drive, Trace, Air Lock. Each of those is an uncontrolled input that would read as a MEDICHAM
   * damage bug, and Lesson 5 is that an input which is not held equal is where every one of this
   * file's control failures came from.
   *
   * Clearing is complete where mirroring is a list, so it is the one that cannot rot. The stat
   * alignment above must come FIRST: clearBoosts only resets the multipliers, and getStat reads
   * storedStats underneath them.
   *
   * WHAT IT COSTS, stated rather than hidden: Intimidate's sign and Sand Stream's special-defence
   * boost are no longer on this file's surface. They belong to tests/test-mechanics.js, which is a
   * behaviour census; this file's declared scope is damage only. */
  for (const p of [...battle.p1.active, ...battle.p2.active]) if (p) p.clearBoosts();
  battle.field.clearWeather();
  battle.field.clearTerrain();
  battle.random = (n) => (n === 16 ? roll : 0);
  /* CONTROL FIX 12 -- the coin, held. Installed only when the caller named a branch, so a non-carrier
   * row draws the identical stream it drew before this fix. The header above says why it cannot ride
   * the `battle.random` override on the line above. */
  if (condPin != null) battle.randomChance = () => !!condPin;
  let move = battle.dex.getActiveMove(moveName);
  /* CONTROL FIX 11 -- PIN THE CRIT OFF FOR MOVES WHOSE CRIT IS RANDOM, AND ONLY THOSE. 2026-08-04.
   *
   * This read a flat `move.willCrit = false`, which is right for the reason it was written -- a random
   * crit is noise and both engines must be held to the same roll -- and WRONG for the three moves whose
   * crit is not random at all. Flower Trick, Storm Throw and Frost Breath carry `willCrit: true` in the
   * dex: they crit EVERY time, for x1.5, and forcing the reference to a non-crit number made Showdown
   * report a damage the real move never deals.
   *
   * It surfaced the moment MEDICHAM learned the mechanic (WIRE 35): the residual went 1/400 to 5/400
   * and FOUR of the five new rows were Flower Trick and Frost Breath, with MEDICHAM exactly 1.5x above
   * the reference. That is the harness's control being wrong, not the engine -- the same shape as the
   * Volt-Absorb-on-a-Garchomp wire and the Dragon-Claw-at-a-Fairy redirect probe.
   *
   * `getActiveMove` already copies the dex value, so this line now only ever CLEARS a crit that would
   * otherwise be rolled. Written explicitly rather than deleted, because a reader has to be able to see
   * that the pin is deliberate and conditional. */
  move.willCrit = !!battle.dex.moves.get(moveName).willCrit;
  /* CONTROL FIX 9 -- move.hit IS SET BY THE HIT LOOP, AND THIS HARNESS DOES NOT RUN THE HIT LOOP.
   *
   * Triple Axel's power is `basePowerCallback: (p, t, move) => 20 * move.hit`. `move.hit` is assigned
   * in battle.actions.hitLoop, one level above the moveHit entry point used here, so it arrived
   * undefined: 20 * undefined = NaN, damage NaN, and Showdown reported ZERO. Every Triple Axel row
   * therefore read `showdown 0-0, medicham 5-6` and was filed as a MEDICHAM bug -- two of the three
   * disagreements engine/status.js was printing on 2026-08-04, and neither was real.
   *
   * 1 is the value the loop starts at, so this asks for the FIRST hit -- which is exactly what
   * MEDICHAM's dmgRange returns, since MC.moves.tripleaxel.bp is 20, the first hit's power. Set
   * unconditionally, not off a list of move ids, for the same reason CONTROL FIX 7 clears instead of
   * mirroring. The moves it covers are printed below so the coverage is visible rather than assumed.
   *
   * NOT the same question as whether MEDICHAM prices a multi-hit move over ALL its hits. It does not
   * -- Rock Blast is one 25-BP hit in dmgRange -- and this harness cannot see that, because
   * single-call moveHit hits once too. That is on the ENGINE list as its own item. */
  move.hit = 1;
  /* CONTROL FIX 13 -- RUN `ModifyType` BEFORE THE MOVE, BECAUSE THE AUTHORITY DOES AND THIS ENTRY
   * POINT IS 932 LINES BELOW WHERE IT HAPPENS. 2026-08-23.
   *
   * `battle.actions.moveHit` is sim/battle-actions.ts:1370. Every `-ate` ability fires from
   * `onModifyType`, which the authority runs in `useMoveInner` at sim/battle-actions.ts:430 (the
   * move's own handler, via singleEvent) and :438 (the pokemon's, via runEvent) -- both far above
   * this entry point. So the reference priced a plain Normal move: after the moveHit call
   * `move.type === 'Normal'` and `move.typeChangerBoosted === undefined`.
   *
   * IT LOSES BOTH HALVES, not one. Refrigerate (data/abilities.ts:3804-3817) sets `move.type='Ice'`
   * AND `move.typeChangerBoosted = this.effect`, and its `onBasePower` returns chainModify only
   * `if (move.typeChangerBoosted === this.effect)` -- so skipping ModifyType drops the retype, the
   * new STAB, the type chart AND the 1.2x. Measured on aurorus hypervoice -> aggron: reference
   * 18-21, authority's own real turn 64-76, MEDICHAM 64-76 at BOTH corners. The five
   * `aurorus hypervoice` rows this file was reporting were FALSE REDS -- the engine was right and
   * the instrument was asking at the wrong point. Same family as CONTROL FIX 5 and CONTROL FIX 10.
   *
   * PLACED BEFORE THE onTryHit BLOCK ON PURPOSE. The authority runs ModifyType before
   * `hitStepTryHitEvent`, so a Galvanize Body Slam is already ELECTRIC when Volt Absorb is asked
   * whether it takes it. Asking in the other order would answer about Normal.
   *
   * BLAST RADIUS, DERIVED not assumed -- 7 legal abilities (dragonize aerilate galvanize liquidvoice
   * normalize pixilate refrigerate) and 4 legal moves (aurawheel ragingbull terrainpulse
   * weatherball). Everything else has no ModifyType handler and cannot move. The controls that prove
   * it: `tauros bodyslam -> gallade` (a Normal move from a body with no -ate ability) and
   * `aurorus ancientpower -> gallade` (a non-Normal move from the SAME Aurorus body) both read
   * identically before and after.
   *
   * ONLY `ModifyType`. `useMoveInner` runs `ModifyMove` on the next line and this does NOT, because
   * that is a separate and much wider question and a red row must stay attributable. Recorded as
   * owed rather than smuggled in here. */
  battle.singleEvent('ModifyType', move, null, src, tgt, move, move);
  move = battle.runEvent('ModifyType', src, tgt, move, move);
  /* Ask the defender's ability its OWN TryHit question, which moveHit below will not. Only for the
   * abilities the artifact says answer it -- everything else pays nothing. A null or false from the
   * handler is the ability saying "this move does not happen to me", which is zero damage. */
  if (defAbilId && (ONTRYHIT_IMMUNE.has(defAbilId) || ONTRYHIT_CLASS.has(defAbilId))) {
    const ab = battle.dex.abilities.get(defAbilId);
    if (ab && ab.exists && typeof ab.onTryHit === 'function') {
      let r;
      try { r = battle.singleEvent('TryHit', ab, tgt.abilityState, tgt, src, move); } catch (e) { logDroppedRow('showdown onTryHit', e); r = undefined; }
      if (r === null || r === false) return 0;
    }
  }
  const before = tgt.hp;
  /* WITH THE SCENARIO NAMED, and naming it immediately earned its keep.
   *
   * At seed 20260804 --n 400 this fires 12 times and ALL TWELVE ARE THE SAME DEFENDER, Bellibolt.
   * The throw is inside SHOWDOWN, not here: Electromorphosis's onDamagingHit adds the `charge`
   * volatile, and Charge's onStart reads a `source` that only the full move pipeline sets --
   * moveHit, the entry point this harness must use, leaves it null. So every Bellibolt row is
   * silently excluded from the residual, and until this counter existed the exclusion looked
   * exactly like a row that was never drawn.
   *
   * NOT a MEDICHAM bug and not fixable from here without leaving the moveHit layer, which is the
   * same boundary the Disguise SUSPECT row sits on. Recorded in docs/ENGINE.md as a known harness
   * exclusion rather than papered over -- but it is now COUNTED, which is the part that was wrong. */
  try { battle.actions.moveHit(tgt, src, move); }
  catch (e) { logDroppedRow('showdown moveHit ' + attName + ' ' + moveName + ' -> ' + defName, e); return null; }
  const dealt = before - tgt.hp;
  /* A NON-FINITE RESULT IS A HARNESS FAILURE AND MUST NEVER REACH THE COMPARISON.
   *
   * SAID ACCURATELY, because the first version of this comment had the mechanism wrong and the wrong
   * mechanism is still a bug. A starved basePowerCallback does produce NaN internally, but Showdown
   * does NOT let a NaN reach the target's HP -- it clamps, and the row comes back as a clean,
   * plausible, entirely fake ZERO. Measured: with `move.hit` unset, Triple Axel returns 0; with it
   * set, 72. So THIS guard is not what protects that case. CONTROL FIX 9 is.
   *
   * The guard is kept anyway and its record is stated rather than implied: 18 corpus moves have a
   * basePowerCallback with a real base power, and on this corpus this branch has NEVER FIRED. It
   * costs nothing and it means a future callback that does leak a NaN is dropped loudly instead of
   * being filed as a MEDICHAM disagreement. The phantom-zero case -- the one that actually happens --
   * is caught downstream by the SUSPECT marker, not here. */
  return Number.isFinite(dealt) ? dealt : NOT_FINITE;
}

let compared = 0, agreed = 0;
const bad = [];
/* THE TWO CORNER ARMS, KEPT APART FROM `bad` AND FROM EACH OTHER. "The engines agree at the top roll"
 * and "the engines agree at the bottom roll" are different claims about different numbers; pooling
 * them would produce a figure that describes neither, which is the same rule
 * `engine/game_differential.js` states for its pinned arms. */
const armBad = { top: [], bottom: [] };
const armAgreed = { top: 0, bottom: 0 };
/* ---- ROADMAP #304 / #322 — THE FOURTEEN INDICES BETWEEN THE CORNERS -----------------------------
 *
 * The two arms above are index 0 and index 15, and this file's own scope note says it "structurally
 * cannot see the INTERIOR of the damage roll". That was true for a reason that has since gone away:
 * the corners were the only two points where an INDEX and a SPAN coincide, so they were the only two
 * a range-versus-range comparison could ask about. Since #304 landed, `dmgRangeOneHit` fills a
 * sixteen-entry `rolls` band in the authority's own index order, so index i has a MEDICHAM
 * counterpart and the question can simply be asked.
 *
 * IT IS NOT A THEORETICAL GAP. On 2026-08-22 `engine/status.js` printed this clause as PASS —
 * "clean at BOTH corners of the damage roll: midpoint 0 of 6000, top 0/6000, bottom 0/6000" — beside
 * a 157-row red in `data/roster.moves.json`. Three sampled points of a sixteen-index band cannot
 * speak for the thirteen they never sampled, and a passing clause is not evidence about an interval
 * it never visits.
 *
 * `engine/quarantine.js`'s `differentialClause` iterates whatever `arms` the artifact carries, so
 * these fourteen join the gate with no change on that side. */
const BAND_IDX = [];
for (let i = 1; i <= 14; i++) BAND_IDX.push(i);
const bandKey = (i) => 'idx' + String(i).padStart(2, '0');
for (const i of BAND_IDX) { armBad[bandKey(i)] = []; armAgreed[bandKey(i)] = 0; }
/* THE LOUD FALLBACK. A row whose `rolls` band did not arrive is UNMEASURED at every interior index,
 * and counting it as agreement is the silent default this repository is named after. It is counted,
 * named once, printed on every run, and carried into the artifact. */
const bandMissing = { n: 0, first: '' };
const seen = new Set();
const touched = { intimidate: 0, weather: 0, absorbMon: 0, absorbFired: 0, bpCallback: 0 };
let guard = 0;

/* PRINT WHAT THE DERIVATION MATCHED, BEFORE IT IS USED. Every derived set in this project
 * over-matched on its first try -- refusesStatusMoves caught Telepathy and Wonder Guard,
 * speedOnItemLoss caught Sticky Hold. This one is checked by eye every run rather than trusted. */
console.log('DERIVED — abilities whose typeImmunity is via onTryHit (Showdown\'s moveHit skips these):');
console.log('  ' + [...ONTRYHIT_IMMUNE].sort().map(a =>
  a + '(' + tags.abilities[a].params.typeImmunity.type + ')').join(' '));
{
  const other = Object.keys(tags.abilities).filter(a => {
    const p = tags.abilities[a].params && tags.abilities[a].params.typeImmunity;
    return p && p.via !== 'onTryHit';
  });
  console.log('  NOT matched, typeImmunity by another route: ' + other.join(' ') + '   (these already work)');
  console.log('DERIVED — abilities that refuse a MOVE CLASS through the same skipped handler (CONTROL FIX 10): '
    + [...ONTRYHIT_CLASS].sort().map(a => a + '(' + tags.abilities[a].params.immuneToMoveClass.blocksFlag + ')').join(' '));
  const inPool = species.filter(s => {
    const sp = dex.species.get(s);
    return sp.exists && ONTRYHIT_IMMUNE.has(String(sp.abilities['0'] || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  });
  console.log('  ' + ONTRYHIT_IMMUNE.size + ' abilities, carried by ' + inPool.length + ' of ' + species.length +
    ' drawable defenders: ' + inPool.join(' ') + '\n');
  /* WHAT CONTROL FIX 9 COVERS, printed for the same reason. Derived by reading the callback source,
   * because a hand list of "the multi-hit ones" is exactly the kind of thing that goes stale. */
  const hitReaders = Object.keys(tags.moves || {}).filter(id => {
    const dm = dex.moves.get(id);
    return dm.exists && typeof dm.basePowerCallback === 'function' && /move\.hit\b/.test(String(dm.basePowerCallback));
  });
  console.log('DERIVED — corpus moves whose base power reads move.hit (NaN without CONTROL FIX 9): '
    + (hitReaders.join(' ') || 'none'));
  console.log('DERIVED — corpus multi-hit moves, SKIPPED because MEDICHAM prices an expectation and '
    + 'one moveHit call is one sample:\n  ' + [...MULTIHIT].sort().join(' '));
  /* CONTROL FIX 12's set, printed before it is used, with its probability and multiplier, so that an
   * over-match is readable by eye rather than trusted. A member here costs two extra Showdown battles
   * per row and is compared on BOTH faces of its die. */
  console.log('DERIVED — corpus moves whose base power is a COIN (conditionalPower when=chance), '
    + 'compared on BOTH faces with battle.randomChance pinned:\n  '
    + ([...CONDCHANCE].sort().map(id => {
        const p = tags.moves[id].params.conditionalPower;
        return id + '(p=' + p.p + ' x' + p.mult + ')';
      }).join(' ') || 'none') + '\n');
}
/* ONE ROW, BOTH ENGINES. Extracted from the sampling loop so that `--case att,move,def` can run a
 * SINGLE named matchup. That is not a convenience: a control fix is only proved by the row it
 * targets going to rel 0.0%, and judging it by the total count instead lets a fix that changed
 * nothing hide behind a sample that happened to move. Every fix in this file was checked that way. */
function compareRow(attId, mvId, defId) {
  const dexMove = dex.moves.get(mvId);
  if (!dexMove.exists || !dexMove.basePower) return null;   // status moves are a different harness
  /* MULTI-HIT MOVES ARE NOT COMPARABLE THROUGH THIS ENTRY POINT, and skipping them is honest where
   * comparing them would not be.
   *
   * moveHit is called ONCE here, so Showdown returns exactly one hit. MEDICHAM's dmgRange returns
   * the EXPECTATION over the hit distribution -- 3.1 hits for Rock Blast -- because it is a pure
   * pricing function with no rng. Those are different quantities, and putting them side by side
   * would report a correct engine as ~3x too high on every Rock Blast row.
   *
   * The temptation was to scale Showdown's single hit by MEDICHAM's own expected hit count. That is
   * constructing the answer from the thing under test, which is how this file's first six control
   * failures happened. So: skipped, counted, and printed. tests/test-mechanics.js `multiHit` is the
   * guard on the mechanic instead, and it is the ONLY guard -- said out loud so nobody deletes it
   * believing the differential covers it. */
  if (MULTIHIT.has(mvId)) { skippedMulti.n++; skippedMulti.moves[mvId] = (skippedMulti.moves[mvId] || 0) + 1; return null; }
  const attSp = dex.species.get(attId), defSp = dex.species.get(defId);
  if (!attSp.exists || !defSp.exists) return null;

  /* MEDICHAM FIRST, because its stats are what Showdown must be aligned to. */
  let A, B;
  try {
    /* THROUGH `mediBody`, THE ONE RESOLVER — see the POOL block. A raw `buildMon(attId)` here would
     * reinstate the silent mega drop for `--case`, which is the mode a fix gets checked in. */
    A = mediBody(attId); B = mediBody(defId);
    A.item = ''; B.item = '';
    /* THE SAME ABILITY ON BOTH SIDES. Stripping MEDICHAM's to 'none' while handing Showdown the
     * species' real slot-0 ability made the harness report immunities as bugs: Hydreigon's LEVITATE
     * (0 vs 73 from Earthquake), Mimikyu's DISGUISE, and Araquanid's WATER BUBBLE in the other
     * direction (Showdown 158 vs MEDICHAM 80). Every one of those was the two engines being right
     * about different Pokemon. Fourth control failure in this file; they all have the same shape,
     * which is an input that was not held equal. */
    A.ability = String(attSp.abilities['0'] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    B.ability = String(defSp.abilities['0'] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    /* NO ENTRY EFFECTS ON EITHER SIDE. The counterpart of CONTROL FIX 7 in showdownDamage: what
     * used to happen here was CONTROL FIX 4's replay of Intimidate and the weather setters onto the
     * MEDICHAM bodies, to match a Showdown side that had really switched in. That is now cleared on
     * the Showdown side instead, because clearing is complete and a replay is a list of three. Both
     * engines therefore start from an empty field and zero boosts, and this file is damage only, as
     * its header has always claimed. */
  } catch (e) { logDroppedRow('medicham build ' + attId + ' ' + mvId + ' -> ' + defId, e); return null; }
  if (!A || !B) return null;
  const stats = { at: A.st.at, sa: A.st.sa, adf: A.st.df, asd: A.st.sd, ahp: A.st.hp,
                  dat: B.st.at, dsa: B.st.sa, df: B.st.df, sd: B.st.sd, hp: B.st.hp };

  /* SHOWDOWN'S DAMAGE IS CAPPED AT THE TARGET'S HP and MEDICHAM'S IS NOT.
   *
   * `before - tgt.hp` cannot exceed maxhp, so a lethal hit reports exactly the target's HP on BOTH
   * rolls -- which is why the second run's remaining "disagreements" all showed an impossible
   * 165-165 or 145-145 from a sixteen-roll spread. The two engines agreed it was a kill; the
   * comparison did not know that. Capping both sides asks the question that matters: would this hit
   * take the same amount off, up to death. */
  const cap = (x) => Math.min(x, B.st.hp);
  /* CONTROL FIX 12 -- ONE PASS PER BRANCH OF A DIE THIS FILE USED TO READ RATHER THAN HOLD. `null` is
   * "there is no die", which is every move but one and is the single unpinned pass this file has
   * always made; a carrier is compared on BOTH faces and keeps the WORSE residual, so being right on
   * the 70% branch cannot pay for being wrong on the 30% one. Full reasoning at CONDCHANCE. */
  const branches = CONDCHANCE.has(mvId) ? [false, true] : [null];
  let worst = null;
  /* ONE PER CORNER, WORST-OF-BRANCHES exactly as the midpoint is, so a carrier that is right on its
   * 70% face cannot pay for being wrong on its 30% one at either endpoint either. */
  let worstTop = null, worstBottom = null;
  /* ROADMAP #304 — the interior, worst-of-branches on the same rule as the two corners. */
  const worstBand = {};
  for (const pin of branches) {
    let m;
    const rollsOut = [];
    try {
      /* THE SEVENTH ARGUMENT IS THE BRANCH, AND IT IS ABSENT FOR A NON-CARRIER. Absent means "nobody
       * drew", which is the PURE PRICE -- and after WIRE 155 that is the un-procced branch and not an
       * expectation, so the two paths deliberately return different numbers and this file compares the
       * DRAWN one. Passing it here is the same call `battleTurn`'s `_hitCtx` makes. */
      /* ROADMAP #304 — `rolls` IS AN OUT-PARAMETER AND IT IS THE WHOLE BAND SWEEP. `dmgRangeOneHit`
       * fills it only when the caller hands over an array, so a caller that does not ask pays
       * nothing; asking is what turns "min and max" into "the sixteen values the authority can
       * emit". The seventh argument was already this object — the conditional-power branch rides on
       * it — so nothing about the existing call changes except that it now carries the array. */
      m = MEDI.dmgRange(A, B, MC.moves[mvId], { weather: '', terrain: '', twA: 0, twB: 0, tr: 0 },
                        false, false, Object.assign({ rolls: rollsOut },
                                                    pin == null ? {} : { condPower: pin }));
    } catch (e) { logDroppedRow('medicham dmgRange ' + attId + ' ' + mvId + ' -> ' + defId, e); return null; }
    if (!m) return null;

    /* READ BEFORE THE PLANT TOUCHES IT. "This move has no randomizer" is a property of the MOVE and
     * `--plant spread` widens every range by construction, so asking after the plant turns ten
     * fixed-damage rows into ten `band_missing` ones and quietly shrinks the interior denominator —
     * which is what the first version of this block did, 190 of 200 under the plant and 200 without. */
    const noRandomizer = (m.min === m.max);
    const flatValue = m.min;      // the constant such a move deals, read before `--plant spread` widens it
    let hi, lo;
    try {
      hi = showdownDamage(attSp.name, dexMove.name, defSp.name, 0, stats, B.ability, pin);
      lo = showdownDamage(attSp.name, dexMove.name, defSp.name, 15, stats, B.ability, pin);
    } catch (e) { logDroppedRow('showdownDamage ' + attId + ' ' + mvId + ' -> ' + defId, e); return null; }
    if (hi === NOT_FINITE || lo === NOT_FINITE) {
      skipped.n++;
      skipped.moves[mvId] = (skipped.moves[mvId] || 0) + 1;
      return null;
    }
    if (hi == null || lo == null) return null;
    /* THE PLANT, APPLIED TO MEDICHAM'S RANGE AND NOTHING ELSE. Symmetric by construction, so
     * `(min+max)/2` is untouched to the floating-point bit and the midpoint arm cannot see it. */
    if (PLANT === 'spread') m = { ...m, min: m.min - PLANT_HALFWIDTH, max: m.max + PLANT_HALFWIDTH };
    const sMid = (cap(hi) + cap(lo)) / 2, mMid = (cap(m.max) + cap(m.min)) / 2;
    /* Both zero is agreement: an immunity both engines honour. */
    const r = (sMid === 0 && mMid === 0) ? 0 : Math.abs(sMid - mMid) / Math.max(1, sMid);
    const label = pin == null ? '' : (pin ? '[proc] ' : '[no-proc] ');
    if (!worst || r > worst.rel) {
      worst = { rel: r, suspect: sMid === 0 && mMid > 0,
                showdown: label + cap(lo) + '-' + cap(hi), medicham: cap(m.min) + '-' + cap(m.max) };
    }
    /* THE TWO CORNERS, EACH COMPARED TO ITS OWN COUNTERPART. `cap` applies on both sides for the same
     * reason it does above: Showdown's damage stops at the target's HP and MEDICHAM's does not, so an
     * overkill would otherwise read as a disagreement about a number neither engine will ever apply. */
    const corner = (sd, me) => ((sd === 0 && me === 0) ? 0 : Math.abs(sd - me) / Math.max(1, sd));
    const sTop = cap(hi), mTop = cap(m.max), sBot = cap(lo), mBot = cap(m.min);
    const rT = corner(sTop, mTop), rB = corner(sBot, mBot);
    if (!worstTop || rT > worstTop.rel) {
      worstTop = { rel: rT, suspect: sTop === 0 && mTop > 0,
                   showdown: label + String(sTop), medicham: String(mTop) };
    }
    if (!worstBottom || rB > worstBottom.rel) {
      worstBottom = { rel: rB, suspect: sBot === 0 && mBot > 0,
                      showdown: label + String(sBot), medicham: String(mBot) };
    }
    /* ---- ROADMAP #304 — THE FOURTEEN INDICES THE CORNERS CANNOT SPEAK FOR --------------------
     *
     * `rollsOut[i]` is MEDICHAM's value at the authority's index i and `showdownDamage(..., i, ...)`
     * is the authority's, because `battle.random = (n) => (n === 16 ? roll : 0)` makes the index a
     * PARAMETER of the reference call. Same 12% band, same cap, same worst-of-branches rule as the
     * corners — the only thing that changes is WHICH of the sixteen is being asked about.
     *
     * A MISSING BAND IS NOT AGREEMENT. `dmgRange` fills `rolls` on both of its paths, but a third
     * path (or a release predating #304) would leave it empty, and treating that as "nothing
     * disagreed" is the silent default. It is counted and named instead, and the interior arms are
     * skipped for that row rather than credited. */
    /* A MOVE WITH NO RANDOMIZER HAS NO BAND, AND THAT IS NOT A MISSING ONE. `dmgRangeOneHit` returns
     * before it fills `rolls` for exactly the cases the authority also decides above its randomizer:
     * an immunity (`{0,0}`), a type-chart zero, and the fixed-damage family (Seismic Toss, Super
     * Fang, the OHKO moves — `getDamage`'s four early returns sit above `randomizer`). For those the
     * value IS the same at all sixteen indices, so `min` is the right counterpart and the interior
     * keeps its full denominator. A row with a real SPAN and no band is the genuine fault and is the
     * only thing counted below. */
    const flat = rollsOut.length !== 16 && noRandomizer;
    if (rollsOut.length !== 16 && !flat) {
      bandMissing.n++;
      if (!bandMissing.first) bandMissing.first = attId + ' ' + mvId + ' -> ' + defId
        + ' (medicham ' + m.min + '-' + m.max + ')';
    } else {
      for (const i of BAND_IDX) {
        let sIdx;
        try { sIdx = showdownDamage(attSp.name, dexMove.name, defSp.name, i, stats, B.ability, pin); }
        catch (e) { logDroppedRow('showdownDamage idx' + i + ' ' + attId + ' ' + mvId + ' -> ' + defId, e); sIdx = null; }
        if (sIdx == null || sIdx === NOT_FINITE) continue;
        /* THE PLANT PERTURBS THE INTERIOR AND NOTHING ELSE — see `--plant band` above. */
        const mRaw = (flat ? flatValue : rollsOut[i]) + (PLANT === 'band' ? PLANT_HALFWIDTH : 0);
        const sV = cap(sIdx), mV = cap(mRaw);
        const rI = corner(sV, mV);
        const k = bandKey(i);
        if (!worstBand[k] || rI > worstBand[k].rel) {
          worstBand[k] = { rel: rI, suspect: sV === 0 && mV > 0,
                           showdown: label + String(sV), medicham: String(mV) };
        }
      }
    }
  }
  if (!worst) return null;
  const rel = worst.rel;
  /* SUSPECT — a PHANTOM ZERO, which is the shape the Triple Axel bug actually had.
   *
   * Showdown says the move did nothing, MEDICHAM says it did something, and the move computes its
   * own base power from state that trySpreadMoveHit sets and this entry point does not. That is far
   * more likely to be a starved callback than a real MEDICHAM bug -- it was, three times, and the
   * three rows were printed as engine bugs by engine/status.js for a day.
   *
   * IT IS STILL COUNTED AS A DISAGREEMENT. Marking it must not soften the number, or the marker
   * becomes a way to make the residual look better; it only tells the reader where to look first. */
  /* WIDENED, because the Triple Axel shape turned out to be one instance of a general one: SHOWDOWN
   * SAYS ZERO AND MEDICHAM SAYS SOMETHING is nearly always a layer mismatch in this harness rather
   * than a MEDICHAM bug. Two confirmed causes, neither an engine fault:
   *   - a basePowerCallback starved of state trySpreadMoveHit would have set (Triple Axel);
   *   - a nullification Showdown applies at a layer moveHit only half-runs, which MEDICHAM applies
   *     in its BATTLE LOOP instead of in dmgRange. DISGUISE is exactly this.
   *     ROADMAP #89 -- THE REASON THIS PARAGRAPH GAVE WAS FICTION AND IS CORRECTED HERE. It said the
   *     maxhp/8 "never lands because battle.update() is never called". THERE IS NO SUCH METHOD:
   *     enumerating `Battle.prototype` returns `sendUpdates`, `faintMessages` and `commitChoices`
   *     and nothing named `update`. The true mechanism is that Disguise splits itself across two
   *     handlers -- `onDamage` returns 0 and sets `effectState.busted` (data/abilities.ts:962-966),
   *     and the eighth is dealt separately inside `onUpdate`, after the forme change
   *     (`this.damage(pokemon.baseMaxhp / 8, ...)`, data/abilities.ts:996). A single-hit damage
   *     comparison sees the 0 and never reaches the second event, which is a LAYER mismatch exactly
   *     as this paragraph claims -- the claim was right and its reason was invented.
   *     MEDICHAM's dmgRange correctly reports the raw damage because WIRE 23 substitutes one level
   *     up. Both engines are right and the comparison is asking dmgRange a question about battleTurn.
   * A true immunity is NOT caught by this, because both sides read 0 and the row agrees before it
   * gets here. STILL COUNTED AS A DISAGREEMENT -- flagging must never move the number, or the marker
   * becomes a way to make the residual look better than it is. */
  const suspect = worst.suspect;
  return { att: attId, mv: mvId, def: defId, A, B, dexMove, rel, suspect,
           showdown: worst.showdown, medicham: worst.medicham,
           top: worstTop, bottom: worstBottom, band: worstBand,
           uses: ((tags.moves[mvId] || {}).uses) || 0 };
}

/* SINGLE-CASE MODE. `--case tauros,ironhead,mimikyu`, semicolons for several. */
const caseArg = process.argv[process.argv.indexOf('--case') + 1];
if (process.argv.includes('--case') && caseArg) {
  for (const one of caseArg.split(';')) {
    const [a, mv, d] = one.split(',').map(s => s.trim());
    const r = compareRow(a, mv, d);
    if (!r) { console.log(`  ${one}  -> NOT COMPARABLE (unknown id, no base power, or buildMon refused)`); continue; }
    console.log(`  ${a.padEnd(14)}${mv.padEnd(16)}-> ${d.padEnd(14)}` +
      ` showdown ${r.showdown.padStart(9)}   medicham ${r.medicham.padStart(9)}` +
      `   rel ${(100 * r.rel).toFixed(1)}%   ${r.rel <= 0.12 ? 'AGREE' : 'DISAGREE'}` +
      `   [${r.A.ability || 'none'} vs ${r.B.ability || 'none'}]`);
  }
  process.exit(0);
}

while (compared < N && guard++ < N * 40) {
  const attId = pick(species);
  const defId = pick(species);
  const rows = (movePriors.species[attId] || {}).moves || [];
  if (!rows.length) continue;
  const mv = pick(rows);
  if (!mv || !mv.mv) continue;
  const key = attId + '|' + mv.mv + '|' + defId;
  if (seen.has(key)) continue;
  const r = compareRow(attId, mv.mv, defId);
  if (!r) continue;
  seen.add(key);

  compared++;
  /* HOW MANY COMPARISONS THE CONTROL FIXES ABOVE TOUCH AT ALL. Counted rather than assumed:
   * before the fixes these rows either disagreed for a reason that was not a MEDICHAM bug, or AGREED
   * BY LUCK -- and a false agreement is the more expensive of the two, because nothing prints. */
  if (r.B.ability === 'intimidate') touched.intimidate++;
  if (tags.abilities[r.B.ability] && tags.abilities[r.B.ability].params
      && tags.abilities[r.B.ability].params.weatherSetter) touched.weather++;
  if (ONTRYHIT_IMMUNE.has(r.B.ability)) {
    touched.absorbMon++;
    const _p = tags.abilities[r.B.ability].params.typeImmunity;
    if (_p && _p.type === r.dexMove.type) touched.absorbFired++;
  }
  if (typeof r.dexMove.basePowerCallback === 'function') touched.bpCallback++;
  /* THE CORNERS ARE COUNTED BEFORE THE MIDPOINT'S `continue`, or a row that agreed on the midpoint
   * would never reach the corner arms — which is the exact blindness this pass exists to remove. */
  const armRows = [['top', r.top], ['bottom', r.bottom]];
  /* ROADMAP #304 — the interior joins the same accumulator on the same rule. A row whose band did
   * not arrive contributes NOTHING here (no `w`), which is why `band_missing` is published beside
   * the counts: an interior arm's denominator is not automatically `compared`. */
  for (const i of BAND_IDX) armRows.push([bandKey(i), r.band ? r.band[bandKey(i)] : null]);
  for (const [arm, w] of armRows) {
    if (!w) continue;
    if (w.rel <= 0.12) { armAgreed[arm]++; continue; }
    armBad[arm].push({ att: r.att, mv: r.mv, def: r.def, showdown: w.showdown, medicham: w.medicham,
                       rel: w.rel, uses: r.uses, suspect: w.suspect });
  }
  if (r.rel <= 0.12) { agreed++; continue; }
  bad.push({ att: r.att, mv: r.mv, def: r.def, showdown: r.showdown, medicham: r.medicham,
             rel: r.rel, uses: r.uses, suspect: r.suspect });
}

bad.sort((a, b) => b.uses - a.uses);
console.log(`DIFFERENTIAL TEST — MEDICHAM against Showdown, ${compared} real matchups, seed ${SEED}\n`);
console.log(`  agreed      ${agreed}`);
console.log(`  disagreed   ${bad.length}   (${(100 * bad.length / Math.max(1, compared)).toFixed(1)}%)\n`);
/* ---- THE CORNERS, PER ARM, NEVER POOLED ------------------------------------------------------- */
console.log('  THE ROLL IS TWO CORNERS. The line above is a MIDPOINT and cannot see a range that is');
console.log('  wrong by the same amount at both ends. Each arm below is the same 12% band applied to');
console.log('  ONE endpoint against its own counterpart. These are not averaged and not added.');
console.log('     compared  agreed  disagreed   arm');
for (const arm of ['top', 'bottom']) {
  const d = armBad[arm].length;
  console.log('  ' + String(compared).padStart(9) + '  ' + String(armAgreed[arm]).padStart(6) + '  '
    + String(d).padStart(9) + '   ' + arm + '  ('
    + (arm === 'top' ? 'Showdown roll index 0 = MAXIMUM vs MEDICHAM max'
                     : 'Showdown roll index 15 = MINIMUM vs MEDICHAM min') + ')');
}
/* ---- ROADMAP #304 — THE FOURTEEN INDICES BETWEEN THEM ----------------------------------------- */
console.log('\n  AND THE ROLL IS SIXTEEN INDICES, NOT TWO. The two lines above are the ENDPOINTS, which');
console.log('  are the only points where an index and a span coincide — so they cannot speak for the');
console.log('  thirteen values between them. Each row below compares Showdown at index i against');
console.log('  MEDICHAM\'s own `rolls[i]`, the band dmgRange fills in the authority\'s index order.');
console.log('     compared  agreed  disagreed   index');
{
  let interiorBad = 0;
  for (const i of BAND_IDX) {
    const k = bandKey(i), d = armBad[k].length;
    interiorBad += d;
    const n = armAgreed[k] + d;
    console.log('  ' + String(n).padStart(9) + '  ' + String(armAgreed[k]).padStart(6) + '  '
      + String(d).padStart(9) + '   ' + k + '  (roll ' + (100 - i) + '%)');
  }
  console.log('  ' + (interiorBad ? '  INTERIOR TOTAL ' + interiorBad + ' disagreement(s) across the 14 indices'
                                  : '  the interior is clean across all 14 indices'));
  if (bandMissing.n) {
    console.log('  *** ' + bandMissing.n + ' row(s) HANDED BACK NO SIXTEEN-ENTRY BAND and are UNMEASURED at every');
    console.log('  *** interior index — not counted as agreement. First: ' + bandMissing.first);
  }
}
if (PLANT === 'spread') {
  console.log('  *** --plant spread IS ON (halfwidth ' + PLANT_HALFWIDTH + '). MEDICHAM\'s range was');
  console.log('  *** deliberately widened symmetrically. THE MIDPOINT LINE ABOVE IS UNMOVED BY');
  console.log('  *** CONSTRUCTION; if either corner arm also reads 0 the arm is not wired.');
  console.log('  *** It does NOT touch `rolls`, so the interior arms are unmoved BY CONSTRUCTION too —');
  console.log('  *** their own red demonstration is --plant band.');
}
if (PLANT === 'band') {
  console.log('  *** --plant band IS ON (halfwidth ' + PLANT_HALFWIDTH + '). The FOURTEEN INTERIOR rolls');
  console.log('  *** were shifted and indices 0 and 15 were left alone. THE MIDPOINT AND BOTH CORNER');
  console.log('  *** ARMS ARE UNMOVED BY CONSTRUCTION; if the interior rows also read 0 they are not wired.');
}
for (const arm of ['top', 'bottom']) {
  if (!armBad[arm].length) continue;
  console.log('\n  WORST AT THE ' + arm.toUpperCase() + ' CORNER, by how often the move is clicked:');
  console.log('     uses  attacker      move            defender        showdown   medicham');
  for (const b of armBad[arm].slice().sort((x, y) => y.uses - x.uses).slice(0, 12)) {
    console.log('  ' + String(b.uses).padStart(7) + '  ' + b.att.padEnd(13) + b.mv.padEnd(16)
      + b.def.padEnd(15) + String(b.showdown).padStart(9) + '  ' + String(b.medicham).padStart(9)
      + (b.suspect ? '   SUSPECT' : ''));
  }
}
console.log('');
console.log('  comparisons the two control fixes touch (these were wrong or right-by-luck before):');
console.log(`    defender has Intimidate            ${touched.intimidate}`);
console.log(`    defender sets weather on entry      ${touched.weather}`);
console.log(`    defender has an onTryHit absorb     ${touched.absorbMon}   (${touched.absorbFired} where the move's type actually matched)`);
/* LOUD, PER docs/LESSONS.md 1. A silently dropped row is indistinguishable from a row that agreed,
 * and this is the drop most likely to be hiding something: it fires when Showdown's own damage came
 * back non-finite, which means a basePowerCallback read state this entry point never set. */
if (skipped.n) {
  console.log(`\n  SKIPPED — Showdown returned a NON-FINITE damage, so the row was dropped rather than`);
  console.log(`  filed as a MEDICHAM bug. ${skipped.n} comparison(s). A basePowerCallback read state this`);
  console.log(`  harness does not set; each of these needs its own control fix before it can be judged:`);
  for (const [id, n] of Object.entries(skipped.moves).sort((a, b) => b[1] - a[1])) {
    console.log('    ' + id.padEnd(20) + n + '   (' + (((tags.moves[id] || {}).uses) || 0) + ' uses)');
  }
} else {
  console.log('\n  skipped for non-finite Showdown damage: 0   (this branch has never fired on this corpus)');
}
/* THE EXPOSURE, COUNTED RATHER THAN ASSUMED. How many rows in this sample ran a move that computes
 * its own base power -- the class CONTROL FIX 9 exists for. A zero here would mean the fix is
 * untested by this run and should be read as such. */
console.log(`  comparisons whose move has a basePowerCallback: ${touched.bpCallback}`
  + `   (${bad.filter(b => b.suspect).length} of them are SUSPECT — see below)`);
console.log(`  rows skipped as MULTI-HIT (not comparable through moveHit): ${skippedMulti.n}`
  + (skippedMulti.n ? '   ' + Object.entries(skippedMulti.moves).sort((a, b) => b[1] - a[1])
      .map(([id, n]) => id + ' x' + n).join(' ') : ''));
/* ROWS DROPPED BECAUSE SOMETHING THREW. Printed unconditionally, including the zero: "0 rows were
 * dropped by an exception" is a claim worth being able to read, and a line that only appears when
 * it is non-zero cannot be distinguished from a line nobody wrote. */
console.log(`  rows dropped by an exception: ${errs.n}`);
for (const [k, n] of Object.entries(errs.where).sort((x, y) => y[1] - x[1]).slice(0, 8)) {
  console.log('    x' + String(n).padEnd(5) + k);
}
console.log('');
if (bad.length) {
  console.log('  WORST DISAGREEMENTS, by how often the move is clicked:');
  console.log('     uses  attacker      move            defender        showdown   medicham');
  for (const b of bad.slice(0, 20)) {
    console.log('  ' + String(b.uses).padStart(7) + '  ' + b.att.padEnd(13) + b.mv.padEnd(16) +
      b.def.padEnd(15) + b.showdown.padStart(9) + '  ' + b.medicham.padStart(9) +
      (b.suspect ? '   SUSPECT — Showdown reports 0 where MEDICHAM does not; check the harness first' : ''));
  }
  if (bad.some(b => b.suspect)) {
    console.log('\n  A SUSPECT ROW IS STILL COUNTED ABOVE. It is not excused, only flagged. Showdown says the');
    console.log('  move did nothing and MEDICHAM says it did, which in this harness has twice meant a LAYER');
    console.log('  MISMATCH rather than an engine bug: a base power computed from state moveHit never sets,');
    console.log('  or a nullification MEDICHAM applies in its battle loop while dmgRange reports raw damage');
    console.log('  (Disguise). Check tests/test-mechanics.js for the mechanic before touching the engine.');
  }
}
/* A PLANTED RUN NEVER TOUCHES THE GATE'S ARTIFACT. It writes beside it under its own name, so a red
 * demonstration cannot be mistaken for a measurement by anything that reads `data/engine-diff.json` —
 * which is `engine/quarantine.js` and `engine/status.js`. Declared rather than trusted to a habit. */
const OUT_NAME = PLANT ? 'engine-diff-PLANTED-' + PLANT + '.json' : 'engine-diff.json';
/* ROADMAP #257 — A VERIFICATION RUN MAY NOT REPUBLISH A SMALLER MEASUREMENT.
 *
 * This write used to be an unconditional `fs.writeFileSync`, so `--n 150` typed as a quick check
 * replaced a 6,000-comparison published result with a 150-comparison one and orphaned every document
 * citing it. The register row's stated mitigation — "pass --out or omit --write" — was measured to be
 * a no-op: this file has neither flag. So the protection is a MECHANISM rather than a habit.
 * engine/publish_guard.js refuses the shrink, writes this run to data/verification/ instead so nothing
 * is lost, and sets a non-zero exit code so a refused run cannot read as a pass. */
const GUARD = require(D('engine', 'publish_guard.js'));
const PUBLISHED = GUARD.publish({
  file: D('data', OUT_NAME),
  sampleKey: 'compared',
  what: 'the damage differential (' + OUT_NAME + ')',
  artifact: {
  generated: new Date().toISOString(), by: 'tests/test-engine-diff.js',
  design: 'Showdown is the authority. Same attacker, move and defender through both engines; a '
        + 'disagreement is a MEDICHAM bug, including one nobody thought to look for.',
  scope: 'damage only, no items or abilities. Turn order, status duration and switching need a '
       + 'different harness and are not attempted here rather than attempted badly.',
  /* THE SEED IS PART OF THE RESULT. Without it "3/120 disagree" is not reproducible and should not
   * be quoted as an artifact-backed number, which it was. Re-run with --seed to resample. */
  seed: SEED, requested: N,
  compared, agreed, disagreed: bad.length, worst: bad.slice(0, 40),
  /* ROADMAP #88 — THE TWO CORNERS OF THE DAMAGE ROLL, EACH ITS OWN CLAIM. `disagreed` above is a
   * MIDPOINT residual and is kept unchanged so the series stays comparable; `arms` is the stronger
   * question and `engine/quarantine.js` requires BOTH of them to be clean. `plant` records a run that
   * was deliberately broken so nobody can mistake a demonstration for a measurement. */
  plant: PLANT ? { kind: PLANT, halfwidth: PLANT_HALFWIDTH,
                   warning: 'THIS RUN WAS DELIBERATELY BROKEN. It is a red demonstration of the corner '
                          + 'arms and NOTHING in it may be quoted as a measurement.' } : null,
  arms: ['top', 'bottom'].concat(BAND_IDX.map(bandKey)).map(arm => ({
    arm,
    what: arm === 'top' ? 'Showdown damage roll index 0 (MAXIMUM) against MEDICHAM\'s `max`'
        : arm === 'bottom' ? 'Showdown damage roll index 15 (MINIMUM) against MEDICHAM\'s `min`'
        : 'Showdown damage roll index ' + +arm.slice(3) + ' (roll ' + (100 - +arm.slice(3))
          + '%) against MEDICHAM\'s own `rolls[' + +arm.slice(3) + ']`',
    tolerance: 'the same 12% relative band the midpoint uses — this pass changed WHICH quantity is '
             + 'compared, not how close it must be',
    /* THE INTERIOR ARMS CARRY THEIR OWN DENOMINATOR. A row whose band did not arrive is UNMEASURED
     * at every interior index, so `compared` for those arms is what was actually asked, never the
     * run's row count. */
    compared: (arm === 'top' || arm === 'bottom') ? compared : armAgreed[arm] + armBad[arm].length,
    agreed: armAgreed[arm], disagreed: armBad[arm].length,
    worst: armBad[arm].slice().sort((x, y) => y.uses - x.uses).slice(0, 40),
  })),
  /* ROADMAP #304 — rows that handed back no sixteen-entry band. Must be 0; a non-zero means some
   * path through `dmgRange` does not fill the out-parameter and the interior is partly unmeasured. */
  band_missing: bandMissing.n, band_missing_first: bandMissing.first || null,
  band_why: 'THREE SAMPLED POINTS OF A SIXTEEN-INDEX BAND CANNOT SPEAK FOR THE THIRTEEN THEY NEVER '
          + 'SAMPLE. On 2026-08-22 this clause read PASS — midpoint 0/6000, top 0/6000, bottom '
          + '0/6000 — beside a 157-row red in data/roster.moves.json. The corners are the only two '
          + 'points where an index and a span coincide, which is exactly why they agreed. `--plant '
          + 'band` is the interior arms\' own red demonstration and leaves the midpoint and both '
          + 'corners at their unplanted values.',
  arms_why: 'A MIDPOINT CANNOT SEE A RANGE THAT IS WRONG BY THE SAME AMOUNT AT BOTH ENDS. `--plant '
          + 'spread` widens MEDICHAM\'s range symmetrically and leaves `disagreed` at exactly its '
          + 'unplanted value while both arms light up, which is the demonstration that these two '
          + 'numbers are not restatements of the one above them.',
  /* Dropped rows are RECORDED, not just printed -- a skip that only exists in a console line is a
   * silent default one terminal-clear later. */
  skipped_non_finite: skipped.n, skipped_moves: skipped.moves,
  skipped_multihit: skippedMulti.n, skipped_multihit_moves: skippedMulti.moves,
  /* Five catch blocks used to drop a row and say nothing, which shrank the DENOMINATOR of the
   * headline residual without shrinking the claim built on it. */
  dropped_by_exception: errs.n, dropped_where: errs.where,
  /* THE POOL, CARRIED SO THE COVERAGE CLAIM IS AUDITABLE FROM THE ARTIFACT ALONE. `compared` says
   * how many rows were drawn; it cannot say from how small a universe. Before 2026-08-23 that
   * universe was 207 of 345 species with 76 megas missing and nothing printed it. */
  pool,
  pool_why: 'A species with no MC.mons row can never be drawn, so it is invisible to `compared`. '
          + 'Resolved through engine/mc_key.js, the one doorway; a raw buildMon(id.toLowerCase()) '
          + 'dropped every hyphenated forme and all 76 megas in silence.',
  controls: 'both leads are really sent out on the Showdown side, so MEDICHAM is given the same '
          + 'switch-in (Intimidate, weather setters) through the engine\'s own applyEntryEffects/'
          + 'applyIntimidate; and the defender ability\'s onTryHit is asked directly, because '
          + 'Showdown\'s moveHit entry point does not run it.',
  touched,
  },
});
/* THE THREE CONFORMANCE SECTIONS BELOW AMEND THE FILE THIS RUN ACTUALLY WROTE, NOT A FIXED PATH.
 * They each used to re-read `data/engine-diff.json` by name and write it back — so a `--plant` run,
 * which goes out of its way to write beside the artifact rather than over it, stamped three sections
 * onto the published artifact anyway, and a REFUSED run would amend the file it had just been refused
 * permission to touch. */
const ART_PATH = PUBLISHED.path;
console.log('\n  wrote ' + require('path').relative(D('.'), ART_PATH).replace(/\\/g, '/')
  + (PLANT ? '   (PLANTED — data/engine-diff.json was NOT touched)' : ''));

/* ---- WIRE 124 — THE ACCURACY TABLE, CHECKED AGAINST THE FORMAT RATHER THAN REMEMBERED -----------
 *
 * This harness compares DAMAGE and structurally cannot see accuracy: it calls dmgRange, which never
 * rolls to hit. So a move the engine believed could never miss compared clean here for the whole life
 * of the file, and 78 of the 500 moves in MC.moves were exactly that — `moveAccuracy` ended
 * `ACC[id]||100` over a hand-typed 35-move literal, and Heat Wave (7,405 clicks) could not miss.
 *
 * The fix derives accuracy from data/move-effects.js, with a four-row ACC_FIX list for the places
 * that GENERATED artifact disagrees with the dex. A correction list nobody re-derives is the same
 * hand list one layer down, so it is re-derived here, over every move, against the live format —
 * which is the one authority in this repo that cannot go stale (ADR-002).
 *
 * IT IS A HARD FAILURE, unlike the damage residual above. A damage disagreement is a magnitude and
 * gets a tolerance; an accuracy disagreement is a number that is simply wrong, and the whole point of
 * the list is that a fifth row must not be able to arrive silently. */
{
  const cleanField = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0, sgA: {}, sgB: {} };
  const accBad = [];
  let accCompared = 0;
  for (const id of Object.keys(MC.moves)) {
    const dm = dex.moves.get(id);
    if (!dm || !dm.exists) continue;
    accCompared++;
    const expect = dm.accuracy === true ? 100 : dm.accuracy;
    const got = MEDI.moveAccuracy(id, cleanField);
    if (got !== expect) accBad.push({ move: id, medicham: got, showdown: expect,
                                      uses: ((tags.moves[id] || {}).uses) || 0 });
  }
  const unknown = (MEDI.fails && MEDI.fails.accuracyUnknown) || 0;
  console.log(`\n  ACCURACY CONFORMANCE — ${accCompared} moves in MC.moves against ${CS.FORMAT}`);
  console.log(`    disagree: ${accBad.length}`);
  console.log(`    moves whose accuracy NEITHER source knows (fell back to 100): ${unknown}`
    + (unknown ? '   first: ' + MEDI.fails.accuracyUnknownFirst : ''));
  for (const b of accBad.sort((a, c) => c.uses - a.uses).slice(0, 20)) {
    console.log(`    ${b.move.padEnd(20)} medicham ${String(b.medicham).padStart(4)}   `
      + `showdown ${String(b.showdown).padStart(4)}   (${b.uses} uses)`);
  }
  GUARD.amend(ART_PATH, 'compared', (art) => {
    art.accuracy_conformance = { compared: accCompared, disagreed: accBad.length,
                                 unknown_accuracy: unknown, worst: accBad.slice(0, 20) };
  });
  if (accBad.length || unknown) {
    console.log('\n  FAILED: the accuracy table no longer matches the format. Either data/move-effects.js');
    console.log('  moved under the engine, or ACC_FIX in engine/medicham2-browser.js needs a row — and');
    console.log('  a move the engine thinks is 100%% is a move that can never miss in any rollout.');
    process.exitCode = 1;
  }
}

/* ---- WIRE 129 — THE ACCURACY-MODIFIER TABLE, RE-DERIVED RATHER THAN REMEMBERED ------------------
 *
 * `ACCMOD` in engine/medicham2-browser.js carries the MULTIPLIER and the DIRECTION for every ability
 * and item that touches a to-hit roll. It has to be a table in the engine and not a read of
 * data/abra-tags.js, because the artifact's `writesAccuracy.scope` is INVERTED on every carrier:
 * tag_dex put `onModifyAccuracy` under "its own moves" and `onSourceModifyAccuracy` under "moves
 * aimed at it", and Showdown fires the first on the TARGET and the second on the ATTACKER. So the
 * artifact records Sand Veil as sharpening its own moves and Compound Eyes as sharpening the foe's.
 *
 * A table nobody re-derives is the hand list it replaced one layer down — WIRE 124's whole lesson —
 * so this block reads the handlers straight out of the live format and fails on any row the engine
 * has wrong, missing or invented. The DIRECTION is read from the HOOK NAME, which is the fact:
 *
 *     onModifyAccuracy        the handler is on the TARGET      -> side 'def'
 *     onSourceModifyAccuracy  the handler is on the ATTACKER    -> side 'att'
 *     onAnyAccuracy           neither end may miss              -> side 'both', never
 *     onAnyModifyAccuracy     the whole SIDE, ally included     -> not expressible in hitChance
 *
 * A row the engine deliberately does NOT apply carries `off:` with the reason, and that is accepted
 * — but only if the dex still HAS the entity, so an `off` row cannot be used to hide a deletion. */
{
  const HOOKS = { onModifyAccuracy: 'def', onSourceModifyAccuracy: 'att',
                  onAnyAccuracy: 'both', onAnyModifyAccuracy: 'side' };
  const derived = new Map();
  for (const kind of ['abilities', 'items']) {
    for (const e of dex[kind].all()) {
      const hook = Object.keys(HOOKS).find(h => e[h]);
      if (!hook) continue;
      const src = String(e[hook]);
      const m = src.match(/chainModify\(\[?\s*([\d.]+)/);
      const mult = m ? (+m[1] > 100 ? +(+m[1] / 4096).toFixed(2) : +m[1]) : null;
      const setTo = (src.match(/return\s+(\d+)\s*;/) || [])[1];
      derived.set((kind === 'abilities' ? 'ability' : 'item') + ':' + e.id, {
        side: HOOKS[hook], hook, mult, setTo: setTo == null ? null : +setTo,
        never: /return\s+true\s*;/.test(src), past: e.isNonstandard === 'Past' });
    }
  }
  /* THE THIRD NAMESPACE. This walk read abilities and items — the block's own charter above still
   * says "every ability and item" — and a FIELD effect can modify accuracy too. Gravity's handler
   * lives on `move.condition`, not on a standalone entry (`dex.conditions.all` does not exist), so
   * nothing here could ever see it: the engine's correct ACCMOD row was reported as INVENTED, a row
   * that fires with no handler behind it. The checker was wrong about the engine, which is this
   * project's most common failure and the reason the row is derived here instead of listed.
   *
   * ONE ROW COMES BACK, and a family of one is exactly the shape CLAUDE.md warns does not look
   * truncated — so it is derived over every legal move's condition rather than named. If a later
   * regulation gives another field effect an accuracy handler, this finds it without an edit. */
  for (const mv of dex.moves.all()) {
    if (!mv.exists || mv.isNonstandard || !mv.condition) continue;
    const hook = Object.keys(HOOKS).find(h => mv.condition[h]);
    if (!hook) continue;
    const src = String(mv.condition[hook]);
    const m = src.match(/chainModify\(\[?\s*([\d.]+)/);
    const mult = m ? (+m[1] > 100 ? +(+m[1] / 4096).toFixed(2) : +m[1]) : null;
    const setTo = (src.match(/return\s+(\d+)\s*;/) || [])[1];
    /* THE DIRECTION RULE DOES NOT CROSS THIS NAMESPACE, AND SAYING SO IS THE POINT OF THE ROW.
     *
     * "onModifyAccuracy means the handler sits on the TARGET" is true because an ability or an item
     * has a HOLDER, and the hook name says which end of the move that holder is. A field condition
     * has no holder. Gravity's handler takes `(accuracy)` alone — no target, no source, no move —
     * and fires for every move either side clicks. Reading `def` off the hook name here would assert
     * that Gravity sharpens moves aimed at one particular body, which is not what it does.
     *
     * So the side is `field`, and the engine already says `field`. This clause failing was the
     * checker generalising a rule past the namespace it was derived in. */
    derived.set('condition:' + mv.id, {
      side: 'field', hook, mult, setTo: setTo == null ? null : +setTo,
      never: /return\s+true\s*;/.test(src), past: mv.isNonstandard === 'Past' });
  }
  const T = MEDI.ACCMOD || {};
  const bad = [];
  for (const [k, d] of derived) {
    const row = T[k];
    if (!row) { bad.push(`${k}: the format has it (${d.hook}) and ACCMOD has NO ROW`); continue; }
    /* An `off` row is a declared non-implementation. It still has to name the right direction and the
     * right number, so turning it back on later is a one-word change and not a re-derivation. */
    if (d.never !== !!row.never) bad.push(`${k}: never-miss format=${d.never} engine=${!!row.never}`);
    if (d.side !== 'side' && d.side !== row.side)
      bad.push(`${k}: DIRECTION format=${d.side} (${d.hook}) engine=${row.side}`);
    if (d.side === 'side' && !row.off)
      bad.push(`${k}: ${d.hook} covers the whole SIDE and hitChance has no side — it must be declared off`);
    if (d.mult != null && row.mult != null && Math.abs(d.mult - row.mult) > 0.005)
      bad.push(`${k}: MULTIPLIER format=${d.mult} engine=${row.mult}`);
    if (d.mult != null && row.mult == null && row.setTo == null && !row.never)
      bad.push(`${k}: the format scales by ${d.mult} and ACCMOD carries no number`);
    if (d.setTo != null && row.setTo !== d.setTo && !d.never)
      bad.push(`${k}: SET-TO format=${d.setTo} engine=${row.setTo}`);
  }
  const invented = [];
  for (const k of Object.keys(T)) {
    if (derived.has(k)) continue;
    /* An INVENTED row that FIRES is as bad as a missing one — it applies a modifier the real game does
     * not have. One that is declared `off` is a NOTE rather than a failure, and `skilllink` is the
     * live example and the reason the clause is split: data/abra-tags.js tags it `writesAccuracy`
     * because tag_dex matches /accuracy/ against `delete move.multiaccuracy`, so the row exists to
     * stop MEDFAILS.accModUntabled counting a false positive forever. It applies nothing. */
    if (T[k].off) invented.push(`${k}: no accuracy handler in the format — declared off: ${T[k].off}`);
    else bad.push(`${k}: ACCMOD has a row that FIRES and the format has no accuracy handler for it`);
  }
  console.log(`\n  ACCURACY-MODIFIER CONFORMANCE — ${derived.size} accuracy handlers in ${CS.FORMAT} `
    + `against ${Object.keys(T).length} ACCMOD rows`);
  for (const [k, d] of derived)
    console.log(`    ${k.padEnd(24)} ${String(d.side).padEnd(5)} ${d.hook.padEnd(24)} `
      + `${d.never ? 'never-miss' : (d.setTo != null ? 'set ' + d.setTo : 'x' + d.mult)}`
      + `${d.past ? '   [isNonstandard: Past — banned in this format]' : ''}`
      + `${T[k] && T[k].off ? '   ENGINE: OFF — ' + T[k].off : ''}`);
  for (const n of invented) console.log('    note  ' + n);
  console.log(`    disagree: ${bad.length}`);
  for (const b of bad) console.log('    !! ' + b);
  const untabled = (MEDI.fails && MEDI.fails.accModUntabled) || 0;
  console.log(`    carriers the artifact tags and ACCMOD has no row for (MEDFAILS.accModUntabled): `
    + `${untabled}${untabled ? '   first: ' + MEDI.fails.accModUntabledFirst : ''}`);
  GUARD.amend(ART_PATH, 'compared', (art) => {
    art.accuracy_modifier_conformance = { handlers: derived.size, rows: Object.keys(T).length,
                                          disagreed: bad.length, problems: bad };
  });
  if (bad.length) {
    console.log('\n  FAILED: ACCMOD no longer matches the format. A wrong DIRECTION here is silent and');
    console.log('  expensive — it hands the attacker the defender\'s evasion bonus and vice versa,');
    console.log('  which is exactly the inversion data/abra-tags.js still carries.');
    process.exitCode = 1;
  }
}

/* ---- WIRE 130 — WHAT GOES THROUGH A SUBSTITUTE, RE-DERIVED RATHER THAN REMEMBERED ---------------
 *
 * Showdown's fact is the move flag `bypasssub`, and NO artifact this engine reads carries it:
 * data/move-effects.js has no flags block at all and data/abra-tags.js has no tag for it. So the set
 * lives in the engine as `SUBPASS` and is re-derived here over every move in MC.moves against the
 * live format, exactly as ACC_FIX is.
 *
 * IT IS A HARD FAILURE AND THE DIRECTION IS THE REASON. A move missing from SUBPASS is BLOCKED by a
 * substitute that should not stop it, and the three biggest ones in this format are Encore (4,848
 * corpus uses), Taunt (1,503) and Disable (730) — all of which really do bypass. Getting this list
 * short is a worse engine than having no substitute at all. */
{
  const missing = [], extra = [];
  let considered = 0;
  const SUBPASS = MEDI.SUBPASS || new Set();
  for (const id of Object.keys(MC.moves)) {
    const dm = dex.moves.get(id);
    if (!dm || !dm.exists) continue;
    considered++;
    const should = !!(dm.flags && dm.flags.bypasssub);
    const has = SUBPASS.has(id);
    const uses = ((tags.moves[id] || {}).uses) || 0;
    if (should && !has) missing.push({ id, uses });
    if (!should && has) extra.push({ id, uses });
  }
  console.log(`\n  SUBSTITUTE-BYPASS CONFORMANCE — ${considered} moves in MC.moves against ${CS.FORMAT}`);
  console.log(`    SUBPASS carries ${SUBPASS.size};  missing from it: ${missing.length};  in it and not bypasssub: ${extra.length}`);
  for (const r of missing.sort((a, b) => b.uses - a.uses).slice(0, 20))
    console.log(`    !! MISSING  ${r.id.padEnd(20)} bypasses a substitute in the real game  (${r.uses} uses)`);
  for (const r of extra.sort((a, b) => b.uses - a.uses).slice(0, 20))
    console.log(`    !! EXTRA    ${r.id.padEnd(20)} does NOT bypass, and the engine lets it through  (${r.uses} uses)`);
  GUARD.amend(ART_PATH, 'compared', (art) => {
    art.substitute_bypass_conformance = { compared: considered, inSet: SUBPASS.size,
                                          missing, extra };
  });
  if (missing.length || extra.length) {
    console.log('\n  FAILED: SUBPASS no longer matches the format. A move MISSING from it is silently');
    console.log('  blocked by every substitute in every rollout, and Encore/Taunt/Disable are the ones');
    console.log('  that would go first.');
    process.exitCode = 1;
  }
}
