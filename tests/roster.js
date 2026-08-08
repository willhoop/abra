/* tests/roster.js — THE DELIBERATE ROSTER. Every legal move, ability and item in the format, staged
 * from ITS OWN DATA, played in both engines, with a CONTROL ARM that removes only the entity.
 *
 *   SHOWDOWN_PATH=... node tests/roster.js --stage spine
 *   SHOWDOWN_PATH=... node tests/roster.js --stage items
 *   SHOWDOWN_PATH=... node tests/roster.js --stage items --reds
 *   SHOWDOWN_PATH=... node tests/roster.js --stage items --only chopleberry
 *   SHOWDOWN_PATH=... node tests/roster.js --rules            (the shape rules and what each matches)
 *   SHOWDOWN_PATH=... node tests/roster.js --selftest         (the instrument, before any entity)
 *
 * ================= WHY THIS EXISTS =============================================================
 *
 * Measured 2026-08-08, over the last 1,530-game differential run:
 *
 *     legal in the format      that run connected
 *     moves      500           216      43%
 *     abilities  316           179      57%
 *     items      148           138      93%
 *
 * AND NOTHING DECIDED THAT CUTOFF. The run draws real ladder teams out of the store, so its coverage
 * is whatever people happened to bring — a USAGE PRIOR doing duty as a test plan. Worse, of the 207
 * census rows the artifact calls measurable, only 114 were exercised by a CONNECTED MOVE; the other
 * 93 are credited `present_on_the_field_only`, which means the item or ability was ON A BODY and
 * nothing more. A Sitrus Berry sitting in a slot proves nothing about whether it fires at 50%.
 * ROADMAP #28 is the standing example: the top two resist berries are on 13% of teams each, 6,479
 * holders between the family, and nothing in this repository has ever confirmed that one halves a hit.
 *
 * ================= WHAT IS DIFFERENT ABOUT THIS FILE ===========================================
 *
 * It is `tests/staged_board.js` with the hand written out of it. That file's rule — SHOWDOWN IS THE
 * EXPECTATION, no scenario declares a result — is the whole reason a roster this size is possible,
 * and this file USES it as a library rather than reimplementing it: `SB.harness` binds the driver
 * over a frozen release (and over a deliberately broken copy of it), and `SB.fixtureAudit` refuses
 * a script whose clicks would stage nothing.
 *
 * WHAT IS NOT REUSED IS THE SCENARIO LIST, AND THAT IS THE POINT. Eighteen hand-written scenarios
 * are eighteen; nine hundred and sixty-four hand-written ones are the hand-maintained-list failure
 * this repository opens its instructions with, at the largest scale anybody has attempted it. So the
 * scenario is DERIVED: a small set of SHAPE RULES reads the entity's own upstream fields — a move's
 * `target`, `category`, `basePower`, `status`, `boosts`, `volatileStatus`, `weather`, `flags`; an
 * item's `isBerry`, `naturalGift`, `megaStone`, `itemUser`, `fling` and its handler names; an
 * ability's handler names — and stages the condition that makes that shape fire. Membership falls
 * out. Every entry PRINTS the rule it was staged by and what that rule read, because a shape rule
 * that over-matches is this project's standing hazard (`refusesStatusMoves` caught Telepathy;
 * `speedOnItemLoss` caught Sticky Hold) and the only defence that has ever worked is showing the
 * membership before believing the count.
 *
 * ================= THE CONTROL ARM IS THE NEGATIVE, AND IT IS DERIVED TOO ======================
 *
 * A mechanic that fires unconditionally passes any test that only checks the positive. So every
 * entry is played TWICE against the identical script:
 *
 *     SUBJECT   the entity is there
 *     CONTROL   the entity, and nothing else, is removed — the item stripped, the ability replaced
 *               by a named quiet one, the click replaced by a move that does nothing
 *
 * and FOUR boards come back per boundary: Showdown-with, Showdown-without, ours-with, ours-without.
 * That is what makes the third and fourth outcomes expressible at all:
 *
 *     FIRED-AND-BOARDS-MATCH   Showdown's board moved when the entity was added, ours moved, and the
 *                              two agree leaf for leaf. Proven correct.
 *     FIRED-AND-BOARDS-DIFFER  both moved and they disagree. A real defect, with the field named.
 *     DID-NOT-FIRE             SHOWDOWN'S BOARD MOVED AND OURS DID NOT. The staging is known-good
 *                              because the authority answered it. This is the strongest finding this
 *                              instrument can produce and it is the reason the control arm exists.
 *     COULD-NOT-STAGE          with a WRITTEN REASON. Including the one that matters most: Showdown's
 *                              OWN board is identical with and without the entity, so the scenario
 *                              staged nothing and a green would have been vacuous.
 *
 * IDENTICAL RESULTS ACROSS A VARIED KNOB MEAN THE KNOB IS UNWIRED, not that it does not matter. The
 * control arm applies that rule to the FIXTURE as well as to the engine, which is the half this
 * project keeps getting wrong: four of `staged_board.js`'s first six red demonstrations staged
 * nothing and reported "identical".
 *
 * ================= WHAT THE PIN TAKES AWAY, SAID OUT LOUD ======================================
 *
 * The driver's primary arm pins every die to one corner: EVERY SUB-100-ACCURACY MOVE MISSES, NO CRIT
 * EVER LANDS, AND NO SECONDARY BELOW 100% EVER FIRES. That is not a defect of this file — it is what
 * makes two engines comparable at all — but it decides what can be staged, so:
 *
 *   - a delivery move below 100 accuracy stages NOTHING while still reading "identical". Every
 *     click this file emits is run through `SB.fixtureAudit` before a game is played.
 *   - anything whose whole content is a chance below 100% (Quick Claw 20%, King's Rock 10%, Focus
 *     Band 10%, a crit-ratio item) CANNOT be staged, and is reported COULD-NOT-STAGE with that as
 *     its reason rather than counted as a pass.
 *   - the same pin makes accuracy MODIFIERS deterministic in the useful direction: a 0.9x on a
 *     100-accuracy move is a guaranteed miss, so Bright Powder is stageable and Wide Lens's 1.1x on
 *     a move that already hits is not. The control arm decides which, not this comment.
 *
 * ================= THE RED DEMONSTRATION BELONGS TO THE RULE, NOT THE ENTITY ===================
 *
 * `staged_board.js` carries a hand-written surgical patch per scenario. Nine hundred of those is the
 * same failure again — so here the BREAK belongs to the SHAPE RULE. One named anchor per rule,
 * applied in memory to the frozen release's bytes, and every entity that rule staged is provable red
 * by it. A rule whose break moves no board on any of its members is a rule that cannot express its
 * own mechanic, and `--reds` says so.
 *
 * IT READS A FROZEN RELEASE and never the live tree, because another division may be rewriting
 * `engine/medicham2-browser.js` while this runs. The release id is printed with every run and is
 * PINNED EXPLICITLY: `game_differential.js` CUTS a new release when none is named, and cutting one
 * over a file somebody else is part-way through writing is a documented way to produce a valid digest
 * set that is not a loadable engine.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

const ARG = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const HAS = (n) => process.argv.includes(n);

/* THE RELEASE IS PINNED BEFORE ANYTHING IS REQUIRED, and both of the two files that open one are
 * handed the SAME id. `engine/game_differential.js` CUTS a release when `--release` is absent
 * (line 109), and a cut taken while another division is mid-write freezes a half-written file — the
 * exact accident CLAUDE.md records twice. `open(null)` takes the newest; naming it back means this
 * run, `staged_board.js` and the driver are all reading one photograph. */
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open(ARG('--release') || null);
if (!process.argv.includes('--release')) process.argv.push('--release', REL.id);
if (!process.argv.includes('--state')) process.argv.push('--state');

const BS = require(D('engine', 'board_state.js'));
const SB = require(D('tests', 'staged_board.js'));       // the harness, as a library
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const TAGS = JSON.parse(REL.read('data/tags.json'));
const pretty = SB.pretty;

const STAGE = ARG('--stage') || 'spine';
const ONLY = ARG('--only');
const RULE_ONLY = ARG('--rule');
const LIMIT = ARG('--limit') ? +ARG('--limit') : 0;
const REDS = HAS('--reds');
const JSONOUT = HAS('--json');
const VERBOSE = HAS('--verbose');

/* =================================================================================================
 *  THE FIXTURE VOCABULARY — derived from the format, never typed
 * ================================================================================================= */

const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '',
                                                  moves: moves.slice() });

/* THE INERT CLICK, AND THE FIRST ONE WAS WRONG.
 *
 * A control arm has to replace a click with SOMETHING, and "nothing" is not available — `scripted()`
 * answers `pass`, Showdown refuses a pass for a healthy active body, and the game throws instead of
 * diverging. Splash and Celebrate are the obvious answers and BOTH ARE BANNED HERE: this format
 * marks a whole class `isNonstandard: 'Past'` and they are in it. Asked of the format, not
 * remembered.
 *
 * RECYCLE WAS THE FIRST CHOICE AND IT WAS A REAL BUG IN THIS FILE, caught by the instrument itself
 * on its first real run. Its handler is `if (pokemon.item || !pokemon.lastItem) return false;`, so it
 * does nothing on a body that has never consumed an item — and the selftest that cleared it played
 * exactly such a body. The moment a scenario made a body EAT something, Recycle handed it back:
 * `|-item|p2a: Goodra|Chople Berry|[from] move: Recycle`, on all eighteen resist berries at once,
 * which reported as eighteen engine defects on the `item` field. The engine was right and the
 * fixture was wrong, which is this division's most frequent failure and was warned about by name.
 *
 * FOCUS ENERGY IS THE REPLACEMENT: legal here, accuracy `true`, self-targeting, and its whole effect
 * is a `focusenergy` volatile that raises a critical-hit ratio — which `board_state.js` does not
 * compare, and which the driver's pin can never cash in because NO CRIT EVER LANDS. Used a second
 * time it simply fails.
 *
 * AND THE SELFTEST NOW CHECKS THE THING THAT ACTUALLY WENT WRONG, not the thing that was easy to
 * check: a body is made to CONSUME an item and then clicks nothing else, and an item that comes back
 * from empty in either engine is a hard failure. That check is RED under Recycle. */
const INERT = 'focusenergy';

/* THE QUIET ABILITIES — every legal ability in the format that registers NO handler at all, minus
 * the four that do something anyway through a field the engine reads directly. Derived, then the
 * membership is printed by `--rules`, because this is exactly the shape that over-matches. */
const QUIET_EXCLUDE = {
  levitate: 'grants a Ground immunity, which changes what can be staged against the body',
  stall: 'moves the holder last in its priority bracket, which changes turn order',
  terashell: 'halves the effectiveness of everything at full HP, which is a damage modifier',
  multitype: 'rewrites the holder\'s TYPE from its plate, and a type change is on the board',
  rkssystem: 'rewrites the holder\'s TYPE from its memory, same reason as Multitype',
};
const QUIET = dex.abilities.all()
  .filter(a => a.exists && !a.isNonstandard
    && !Object.keys(a).some(k => /^on/.test(k) && typeof a[k] === 'function')
    && !a.condition && !QUIET_EXCLUDE[a.id])
  .map(a => a.id);
const QUIET_SET = new Set(QUIET);

/* THE DELIVERY MOVES, one per type per category, chosen for being BORING. Every disqualifier below
 * is a way a delivery vehicle stops being a delivery vehicle and starts being the experiment. */
function deliveryOf(m) {
  if (!m.exists || m.isNonstandard) return false;
  if (m.category === 'Status' || !(m.basePower > 0)) return false;
  if (!(m.accuracy === true || m.accuracy === 100)) return false;      // the pin makes it miss
  if (!(m.target === 'normal' || m.target === 'any')) return false;    // one body, chosen by us
  if (m.priority !== 0) return false;                                  // turn order is not the test
  if (m.flags.charge || m.flags.recharge || m.multihit || m.ohko) return false;
  if (m.selfdestruct || m.forceSwitch || m.breaksProtect || m.isZ || m.isMax) return false;
  if (m.drain || m.recoil || m.self || m.willCrit) return false;
  if (m.status || m.volatileStatus || m.boosts || m.condition) return false;
  if (m.ignoreImmunity || m.ignoreAbility || m.ignoreDefensive || m.stallingMove) return false;
  if (m.overrideOffensivePokemon || m.overrideOffensiveStat || m.overrideDefensiveStat) return false;
  if (m.basePowerCallback || m.damageCallback) return false;
  /* A MOVE THAT DISABLES ITSELF CANNOT BE CLICKED TWICE, and every derived script that clicks a
   * delivery move on two turns would then hand Showdown a choice it rejects — a THROWN game, which
   * is this file's fixture being wrong rather than a finding. Gigaton Hammer is the member that got
   * through the first version of this filter, on 160 base power, straight into the Steel slot. */
  if (m.onDisableMove || (m.flags && m.flags.cantusetwice)) return false;
  if ((m.secondaries || []).some(s => !s.chance || s.chance >= 100)) return false; // a 100% secondary FIRES
  if (Object.keys(m).some(k => /^on(Try|Hit|Prepare|Modify|Effectiveness|Base|After|Use|Damage)/.test(k)
      && typeof m[k] === 'function')) return false;
  return true;
}
const DELIVERY = {};      // type -> { physical, special, best }
for (const m of dex.moves.all()) {
  if (!deliveryOf(m)) continue;
  const t = (DELIVERY[m.type] = DELIVERY[m.type] || { physical: null, special: null });
  const k = m.category === 'Physical' ? 'physical' : 'special';
  if (!t[k] || m.basePower > t[k].basePower) t[k] = m;
}
for (const t of Object.keys(DELIVERY)) {
  const e = DELIVERY[t];
  e.best = (e.physical && e.special) ? (e.physical.basePower >= e.special.basePower ? e.physical : e.special)
         : (e.physical || e.special);
}
const hitOfType = t => (DELIVERY[t] || {}).best || null;

/* A 100-ACCURACY CARRIER FOR EACH MAJOR STATUS, derived. Where there is none — a guaranteed burn and
 * a guaranteed freeze do not exist in this format at 100 accuracy — the entity that needed it is
 * COULD-NOT-STAGE with that as its written reason, rather than staged through a move the pin makes
 * miss and reported as agreeing. */
const STATUS_MOVE = {};
for (const m of dex.moves.all()) {
  if (!m.exists || m.isNonstandard || !m.status) continue;
  if (!(m.accuracy === true || m.accuracy === 100)) continue;
  if (!(m.target === 'normal' || m.target === 'any')) continue;
  const cur = STATUS_MOVE[m.status];
  if (!cur || m.category === 'Status') STATUS_MOVE[m.status] = m;
}

/* THE CAST. Fixtures, not sets — exactly as `staged_board.js` and the directed table declare: moves
 * are assigned for staging and are NOT learnset-checked, and both engines receive the identical body,
 * so nothing about the comparison depends on legality. Nothing here is a recommendation.
 *
 * Every member is named with the ABILITY it is given and WHAT THAT ABILITY IS QUIET ABOUT, because
 * an ability that fires is a second experiment running inside the first. */
const CAST = {
  /* the aggressor: mixed 120 Atk / 100 SpA, fastest legal body, and Infiltrator does nothing at all
   * unless a screen or a Substitute is up — neither of which any derived scenario raises */
  ATTACKER: () => mon('dragapult', '', 'Infiltrator', []),
  /* the second aggressor, for a scenario needing two attacking slots that are not the same body */
  ATTACKER2: () => mon('weavile', '', 'Pressure', []),
  /* the punching bag: PURE NORMAL, so no type is resisted and only Fighting is super effective, with
   * a ZERO-HANDLER ability (Early Bird touches the sleep counter and nothing else) */
  BAG: () => mon('kangaskhan', '', 'Early Bird', []),
  /* the bench. These never take the field in a derived scenario; their party rows are on the board
   * and are identical in both arms, so an entry ability they might carry never runs. */
  BENCH: () => [mon('corviknight', '', 'Pressure', [INERT]), mon('milotic', '', 'Marvel Scale', [INERT])],
};

/* WHICH ABILITY A FIXTURE BODY MAY CARRY.
 *
 * The strict quiet set above is only eight members, and requiring it left SIX TYPES with no
 * super-effective carrier at all — which would have retired six resist berries as COULD-NOT-STAGE
 * for a reason that is about this file rather than about the format. That is a fixture limitation
 * dressed as a finding, and the whole point of the four outcomes is that they stay honest.
 *
 * THE CORRECT FILTER IS NARROWER THAN "NO HANDLERS", and the reason is the control arm. Whatever
 * ability a carrier holds is present in BOTH arms, so its effect cancels out of the subject-minus-
 * control delta exactly. The only abilities that can corrupt a reading are the ones that INTERFERE
 * WITH THE MECHANIC ITSELF — a second damage modifier, an immunity, an HP floor, a heal. Those are
 * enumerated, with the reason, and nothing else disqualifies a body.
 *
 * IT IS STILL AN OVER-MATCH HAZARD, so `--rules` prints the ability chosen for every carrier. */
const INTERFERES = new RegExp('^(' + [
  /* a second damage modifier, an immunity, or an HP floor sitting inside the experiment */
  'onSourceModifyDamage', 'onModifyDamage', 'onAnyModifyDamage', 'onEffectiveness', 'onDamage',
  'onTryHit', 'onFoeTryMove', 'onImmunity', 'onSourceBasePower', 'onModifyDef', 'onModifySpD',
  'onSourceModifyAtk', 'onSourceModifySpA', 'onSourceModifyAccuracy', 'onModifyAccuracy',
  'onTryHeal', 'onSetStatus', 'onTryBoost', 'onAfterDamage', 'onModifyCritRatio', 'onCriticalHit',
  /* AND ANYTHING THAT MOVES THE BOARD BY ITSELF. It would cancel out of the subject-minus-control
   * delta — it is in both arms — but it is still wrong to have there: a weather setter changes what
   * damage means, Symbiosis HANDS THE ITEM UNDER TEST TO THE PARTNER, an on-contact ability rewrite
   * changes the attacker mid-experiment, and a residual heal moves the HP a heal test is reading.
   * The first derived carrier list contained Tyranitar (Sand Stream), Aurorus (Snow Warning),
   * Florges (Symbiosis), Cofagrigus (Mummy) and Aegislash (Stance Change) — printed, seen, removed. */
  'onStart', 'onSwitchIn', 'onAnySwitchIn', 'onResidual', 'onUpdate', 'onWeather', 'onWeatherChange',
  'onTerrainChange', 'onModifyMove', 'onModifyType', 'onDamagingHit', 'onAfterEachBoost',
  'onAfterSetStatus', 'onSwitchOut', 'onAllyAfterUseItem', 'onAfterMove', 'onAfterMoveSecondary',
  'onFractionalPriority', 'onModifySpe', 'onTakeItem', 'onEatItem', 'onFlinch', 'onHit', 'onSourceHit',
].join('|') + ')$');
function carrierAbility(sp) {
  const abs = Object.values(sp.abilities || {});
  const scored = abs.map(n => { const a = dex.abilities.get(idOf(n));
    const hs = Object.keys(a).filter(k => /^on/.test(k) && typeof a[k] === 'function');
    /* QUIET_EXCLUDE is applied HERE as well as to the quiet set, and it has to be: Levitate registers
     * no handler at all — the engine reads it as a field — so a handler-shaped filter waves it
     * through, and a carrier with a Ground immunity silently retires the Ground half of every
     * type-scoped test. Measured: the first list put Hydreigon in the Dragon slot. */
    return { name: n, quiet: QUIET_SET.has(a.id),
             bad: !!QUIET_EXCLUDE[a.id] || hs.some(h => INTERFERES.test(h)), n: hs.length }; })
    .filter(x => !x.bad)
    .sort((x, y) => (y.quiet - x.quiet) || (x.n - y.n));
  return scored.length ? scored[0].name : null;
}

/* DEFENDERS THAT ARE x2 WEAK TO A GIVEN TYPE, derived from the dex and ranked by bulk. TWO of them
 * are kept per type, not one: a scenario that wants the positive and its inverted half side by side
 * on one board needs two DIFFERENT species, because Species Clause is what makes `board_state.js`
 * key a party by species — two bodies of one species collapse into a single party row and the
 * comparator counts it as a harness fault. */
const WEAK_TO = {};
{
  const cands = dex.species.all().filter(s => s.exists && !s.isNonstandard && !s.battleOnly
    && !s.forme.endsWith('Mega') && carrierAbility(s));
  for (const t of Object.keys(DELIVERY)) {
    const list = cands
      .filter(s => dex.getEffectiveness(t, s.types) === 1 && dex.getImmunity(t, s.types) !== false)
      .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd)
                    - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd));
    if (list.length) WEAK_TO[t] = list.slice(0, 3).map(s => ({ species: s.id,
      ability: carrierAbility(s), types: s.types.join('/') }));
  }
}
/* ---- A STAGING THAT IS ACTUALLY LETHAL, DERIVED RATHER THAN HOPED FOR ---------------------------
 *
 * Two rules need a hit that KILLS: an HP floor has nothing to do unless the blow was fatal, and a
 * speed multiplier is invisible on the board unless the order decides who is still standing. The
 * first version of both used the punching bag and a super-effective delivery move, and MEASURED
 * NOTHING: 90 base power out of 120 Attack into a 180 HP body is 114, the bodies both survived, and
 * the entries came back "THE STAGING IS INERT" — the fixture's own negative catching the fixture.
 *
 * So lethality is COMPUTED. `flatL50` is the same line `game_differential.js` gives both engines (see
 * its buildPair header) and the damage step is Showdown's own at the maximum roll, which is the roll
 * the pin selects. Nothing here is compared against anything; it only picks a fixture that cannot be
 * survived, and if it is wrong the control arm reports the staging as inert exactly as before. */
const flatL50 = bs => ({ hp: Math.floor((2 * bs.hp + 31) * 50 / 100) + 50 + 10,
  at: Math.floor((2 * bs.atk + 31) * 50 / 100) + 5, df: Math.floor((2 * bs.def + 31) * 50 / 100) + 5,
  sa: Math.floor((2 * bs.spa + 31) * 50 / 100) + 5, sd: Math.floor((2 * bs.spd + 31) * 50 / 100) + 5,
  sp: Math.floor((2 * bs.spe + 31) * 50 / 100) + 5 });
function maxRoll(att, mv, def) {
  if (dex.getImmunity(mv.type, def.types) === false) return 0;
  const A = flatL50(att.baseStats), Dd = flatL50(def.baseStats);
  const a = mv.category === 'Physical' ? A.at : A.sa;
  const d = mv.category === 'Physical' ? Dd.df : Dd.sd;
  let x = Math.floor(Math.floor(Math.floor(22 * mv.basePower * a / d) / 50) + 2);
  if (att.types.includes(mv.type)) x = Math.floor(x * 1.5);
  const eff = dex.getEffectiveness(mv.type, def.types);
  return Math.floor(x * Math.pow(2, eff));
}
/* the delivery move that kills `def` outright when thrown by `att`, or null */
function lethalMove(att, def, margin) {
  let best = null;
  const hp = flatL50(def.baseStats).hp * (margin || 1);
  for (const t of Object.keys(DELIVERY)) {
    for (const mv of [DELIVERY[t].physical, DELIVERY[t].special]) {
      if (!mv) continue;
      const d = maxRoll(att, mv, def);
      if (d >= hp && (!best || d > best.d)) best = { mv, d };
    }
  }
  return best;
}
const CANDIDATES = dex.species.all().filter(s => s.exists && !s.isNonstandard && !s.battleOnly
  && !s.forme.endsWith('Mega') && carrierAbility(s));

/* A BODY THE STANDARD AGGRESSOR CAN KILL FROM FULL, twice over, so an HP floor has something to do */
const KILLABLE = (() => {
  const att = dex.species.get(CAST.ATTACKER().species);
  let best = null;
  for (const s of CANDIDATES) {
    const L = lethalMove(att, s, 1.5);       // 1.5x overkill, so no roll or rounding saves it
    if (L && (!best || L.d / flatL50(s.baseStats).hp > best.ratio))
      best = { species: s.id, ability: carrierAbility(s), move: L.mv, ratio: L.d / flatL50(s.baseStats).hp };
  }
  return best;
})();

/* A PAIR WHOSE SPEED ORDER A MULTIPLIER FLIPS, and who can each kill the other outright.
 *
 * A MIRROR MATCH IS THE WRONG FIXTURE HERE AND THAT IS NOT OBVIOUS. Two identical bodies are a SPEED
 * TIE, and the driver's own pin header says the primary arm is "the one in which the two engines
 * DISAGREE about every speed tie" — so the control arm would part for a reason that has nothing to do
 * with the item. The pair is therefore chosen so neither arm is ever tied: strictly slower without
 * the multiplier and strictly faster with it, or the reverse for one that halves. */
function speedFlipPair(mult) {
  const spd = s => flatL50(s.baseStats).sp;
  for (const H of CANDIDATES) {
    const h = spd(H), after = Math.floor(h * mult);
    for (const F of CANDIDATES) {
      if (F.id === H.id) continue;
      const f = spd(F);
      const flips = mult > 1 ? (h < f && f < after) : (after < f && f < h);
      if (!flips) continue;
      const kHF = lethalMove(H, F, 1.2), kFH = lethalMove(F, H, 1.2);
      if (kHF && kFH) return { holder: H, foe: F, holderMove: kHF.mv, foeMove: kFH.mv,
                               speeds: h + ' -> ' + after + ' against ' + f };
    }
  }
  return null;
}

/* AND A TYPE THAT IS PLAINLY NEUTRAL ON A GIVEN BODY, for the inverted half of a type-scoped test. */
function neutralTypeOn(speciesId, notType) {
  const s = dex.species.get(speciesId);
  for (const t of Object.keys(DELIVERY)) {
    if (t === notType || !hitOfType(t)) continue;
    if (dex.getImmunity(t, s.types) === false) continue;
    if (dex.getEffectiveness(t, s.types) !== 0) continue;
    return t;
  }
  return null;
}

const click = (m, t) => (t == null ? { m } : { m, t });
const IDLE = { m: INERT };
const turn = (p1, p2) => ({ p1, p2 });

/* =================================================================================================
 *  ONE ENTRY, PLAYED IN BOTH ARMS
 * ================================================================================================= */

/* Play one script under one engine source, keeping the WHOLE board at every boundary rather than
 * only the leaves that parted — the control comparison needs boards, not a verdict. The driver's own
 * stop rule ends a state game at the first divergent board, so `identical` is neutralised AFTER the
 * diffs are copied out, exactly as `staged_board.js` does and for the same reason. */
function play(sc, src) {
  const G = SB.harness(src);
  let a, b;
  try {
    a = G.buildPair(sc.A, { hpBoost: sc.hpA || 1 });
    b = G.buildPair(sc.B, { hpBoost: sc.hpB || 1 });
  } catch (e) { return { bad: 'THREW-IN-BUILD', why: e.message }; }
  if (!a || !b) return { bad: 'NOT-STAGED',
    why: 'buildPair returned null for ' + (!a ? 'side A' : 'side B') + ' — fewer than four bodies '
       + 'on that side could be built, so the game was never played' };

  const boards = [];
  const r = G.playGame(a, b, 'directed', 'roster:' + sc.id, {
    script: sc.script,
    onBoundary: (snap, turnIdx) => {
      boards.push({ turn: turnIdx, compared: snap.leaves_compared,
                    diffs: snap.diffs.map(d => BS.locate(d, snap)),
                    medi: snap.medi, sd: snap.sd });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { bad: 'THREW', why: r.err, boards };
  if (r.turns !== sc.script.length) return { bad: 'SHORT', boards,
    why: 'the script declares ' + sc.script.length + ' turn(s) and ' + r.turns + ' were played' };
  if (boards.length !== sc.script.length + 1) return { bad: 'SHORT', boards,
    why: boards.length + ' boundaries were taken and ' + (sc.script.length + 1) + ' were expected' };
  if (boards.some(x => !x.compared)) return { bad: 'SHORT', boards,
    why: 'a boundary compared ZERO leaves — the state path is not armed' };
  return { boards };
}

/* THE CONTROL ARM, derived from the subject and never written beside it. Exactly one thing changes.
 *   item     the held item is stripped off the subject body
 *   ability  the subject body's ability becomes the QUIET one the rule named
 *   move     every click of the move under test becomes the inert click
 * and the ONE FIELD that necessarily differs by construction — the held item — is excluded from the
 * subject-against-control comparison, so "it was in the slot" can never be mistaken for "it did
 * something". */
function controlOf(sc) {
  const c = { ...sc, id: sc.id + '~control',
              A: sc.A.map(m => ({ ...m, moves: m.moves.slice() })),
              B: sc.B.map(m => ({ ...m, moves: m.moves.slice() })),
              script: sc.script.map(s => ({ p1: s.p1.map(x => ({ ...x })), p2: s.p2.map(x => ({ ...x })) })) };
  const [sideKey, idx] = [sc.subject[0] === 'A' ? 'A' : 'B', +sc.subject[1]];
  const body = c[sideKey][idx];
  const ignore = [];
  if (sc.kind === 'item') {
    body.item = '';
    ignore.push((sideKey === 'A' ? 'p1' : 'p2') + '.active[' + idx + '].item');
  } else if (sc.kind === 'ability') {
    body.ability = sc.controlAbility;
  } else if (sc.kind === 'move') {
    for (const st of c.script) for (const side of ['p1', 'p2']) for (const a of side ? st[side] : []) {
      if (a && idOf(a.m) === idOf(sc.entityId)) { a.m = INERT; delete a.t; }
    }
  }
  return { sc: c, ignore };
}

/* WHAT THE ENTITY DID TO ONE ENGINE'S OWN BOARD. `BS.compare` is the shared comparator and is used
 * here rather than a second walk, so this file cannot come to disagree with the differential about
 * what a board leaf is. Both sides of this call are boards of the SAME engine — with and without. */
function armDelta(subject, control, ignore) {
  const out = [];
  const n = Math.min(subject.boards.length, control.boards.length);
  for (let i = 0; i < n; i++) {
    for (const [who, key] of [['showdown', 'sd'], ['ours', 'medi']]) {
      const rows = BS.compare(subject.boards[i][key], control.boards[i][key], { compared: 0 });
      for (const d of rows) {
        if (ignore.some(p => d.path === p)) continue;
        out.push({ engine: who, turn: subject.boards[i].turn, path: d.path,
                   with: d.medicham, without: d.showdown });
      }
    }
  }
  return out;
}

const SAY = (d, boards) => {
  const snap = (boards || []).find(b => b.turn === d.turn);
  const loc = BS.locate({ path: d.path, medicham: d.with, showdown: d.without },
                        snap ? { medi: snap.medi, sd: snap.sd } : null);
  return BS.explain(loc, d.with, pretty) + '   (without it: ' + BS.explain(loc, d.without, pretty) + ')';
};

function runEntry(e) {
  const sc = e.scenario;
  const { sc: ctrlSc, ignore } = controlOf(sc);
  const src = e.brokenSrc || null;

  const subject = play(sc, src);
  if (subject.bad) return { ...e, verdict: 'COULD-NOT-STAGE',
    why: 'the SUBJECT arm did not run: ' + subject.bad + ' — ' + subject.why };
  const control = play(ctrlSc, src);
  if (control.bad) return { ...e, verdict: 'COULD-NOT-STAGE',
    why: 'the CONTROL arm did not run: ' + control.bad + ' — ' + control.why };

  const delta = armDelta(subject, control, ignore);
  const sdMoved = delta.filter(d => d.engine === 'showdown');
  const usMoved = delta.filter(d => d.engine === 'ours');
  const subjDiffs = subject.boards.flatMap(b => b.diffs.map(d => ({ ...d, turn: b.turn })));
  const ctrlDiffs = control.boards.flatMap(b => b.diffs.map(d => ({ ...d, turn: b.turn })));

  const base = { ...e, boards: subject.boards, sd_delta: sdMoved, us_delta: usMoved,
                 subject_diffs: subjDiffs, control_diffs: ctrlDiffs,
                 compared: subject.boards.reduce((n, b) => n + b.compared, 0) };

  if (!sdMoved.length) return { ...base, verdict: 'COULD-NOT-STAGE',
    why: 'THE STAGING IS INERT. Showdown\'s own board is identical with and without it, over '
       + base.compared + ' compared leaves — so nothing here tests the entity and a green would have '
       + 'been vacuous. This is the honest coverage limit, not a pass.' };
  if (!usMoved.length) return { ...base, verdict: 'DID-NOT-FIRE',
    why: 'Showdown\'s board MOVED when the entity was added and ours did not move at all. The staging '
       + 'is known-good because the authority answered it.' };
  if (!subjDiffs.length) return { ...base, verdict: 'FIRED-AND-BOARDS-MATCH' };
  return { ...base, verdict: 'FIRED-AND-BOARDS-DIFFER',
    control_also_differs: ctrlDiffs.length > 0 };
}

/* =================================================================================================
 *  THE SHAPE RULES
 *
 *  Ordered. The FIRST rule whose `match` returns a scenario owns the entity, so a narrow shape must
 *  sit above the general one it would otherwise be swallowed by. Every rule declares:
 *
 *    reads   which of the entity's OWN upstream fields decided membership — printed per entry, so a
 *            rule that matched for a reason nobody intended is visible rather than silent
 *    why     what condition it stages and where the inverted half of it is
 *    break   ONE named anchor in the simulator's source. Every entity this rule staged is provable
 *            red by it, and `--reds` fails the rule if no member's board moves under it.
 * ================================================================================================= */

/* a scenario skeleton: side A is the tester, side B slot 0 is ALWAYS the subject body.
 *
 * SPECIES CLAUSE IS ENFORCED HERE RATHER THAN LEFT TO LUCK. `board_state.js` keys a party BY SPECIES
 * — for the good reason that Showdown reorders `side.pokemon` on every switch and index-matching
 * manufactured a divergence larger than anything real in the run — so two bodies of one species on
 * one side collapse into a single party row and the comparator raises `duplicate_species_in_party`.
 * The carriers here are DERIVED, so a rule can and did pick a species the bench already held. The
 * bench is filled from a spare pool instead, and a side that cannot reach four distinct bodies is a
 * hard failure rather than a quietly shorter team. */
const SPARES = ['corviknight', 'milotic', 'clefable', 'snorlax', 'garchomp', 'toxapex', 'weavile',
                'incineroar', 'dragapult', 'kangaskhan', 'metagross', 'pelipper'];
function scaffold(o) {
  const build = (lead, second) => {
    const rows = [lead];
    if (second) rows.push(second);
    const used = new Set(rows.map(r => idOf(r.species)));
    for (const s of SPARES) {
      if (rows.length >= 4) break;
      if (used.has(idOf(s))) continue;
      const sp = dex.species.get(s);
      rows.push(mon(s, '', carrierAbility(sp) || '', [INERT]));
      used.add(idOf(s));
    }
    if (rows.length < 4) throw new Error('the spare pool could not fill a side to four distinct species');
    return rows;
  };
  const A = build(o.a0, o.a1), B = build(o.b0, o.b1);
  for (const m of A.concat(B)) if (!m.moves.includes(INERT)) m.moves.push(INERT);
  return { A, B, script: o.script, subject: o.subject || 'B0', hpA: o.hpA || 1, hpB: o.hpB || 1 };
}
const cannot = (why) => ({ cannot: why });

const RULES = [

/* ---------------------------------------------------------------------------- items -------------- */
{ id: 'item/chance-gated', kind: 'item',
  reads: 'shortDesc — a percentage that is not 100',
  why: 'THE PIN FIXES EVERY DIE TO ONE CORNER, so no chance below 100% ever fires in either engine. '
     + 'An entity whose whole content is such a chance cannot be staged here at all, and saying so is '
     + 'the point: staging it anyway would produce two agreeing boards on which NOTHING HAPPENED, '
     + 'which is this project\'s signature failure wearing a pass.',
  match(e) {
    const m = /(\d+)% chance/.exec(e.shortDesc || '');
    if (!m || +m[1] >= 100) return null;
    return cannot('its effect is a ' + m[1] + '% chance, and the driver\'s pin makes every sub-100% '
      + 'roll fail in both engines (game_differential.js PRIMARY_ARM: "no secondary fires"). Nothing '
      + 'staged here could distinguish a wired mechanic from an absent one.');
  } },

{ id: 'item/crit-ratio', kind: 'item',
  reads: 'onModifyCritRatio',
  why: 'same argument as the chance gate one level down — the pin lands on the corner where NO CRIT '
     + 'EVER HAPPENS, so raising the ratio cannot change a board.',
  match(e) { if (!e.onModifyCritRatio) return null;
    return cannot('it raises the critical-hit RATIO, and the pin never lets a crit land in either '
      + 'engine, so the ratio has nothing to act on'); } },

{ id: 'item/trapping-escape', kind: 'item',
  reads: 'onTrapPokemon / onMaybeTrapPokemon',
  why: 'the script language has no word for a VOLUNTARY SWITCH — `scripted()` returns a move or a '
     + 'pass — and `board_state.js` publishes ability trapping in NOT_COMPARED with its reason. Both '
     + 'halves of what this item does are outside the instrument.',
  match(e) { if (!e.onTrapPokemon && !e.onMaybeTrapPokemon) return null;
    return cannot('it undoes TRAPPING, which needs a voluntary switch to observe; the script language '
      + 'has no switch action and board_state.js does not compare ability trapping at all'); } },

{ id: 'item/mega-stone', kind: 'item',
  reads: 'megaStone — the base species and the forme it becomes',
  why: 'the stone\'s own `megaStone` map names the only body that can use it. That body holds it and '
     + 'ASKS to mega evolve on turn 1; legality comes from Showdown\'s own request and a refusal is '
     + 'counted, never dropped. THE NEGATIVE IS TURN 2, on which the same body clicks again without '
     + 'asking — nothing may transform twice and nothing may revert — and the CONTROL is the same '
     + 'body holding nothing, which must never change forme at all.',
  break: { why: 'the mega transformation is skipped — the choice is still made and still accepted, so '
              + 'only the FORME goes missing',
    patch: [['function megaEvolveNow(S,m,auto){', 'function megaEvolveNow(S,m,auto){if(1)return false;']] },
  match(e) {
    if (!e.megaStone) return null;
    const base = Object.keys(e.megaStone)[0];
    const sp = dex.species.get(base);
    if (!sp || !sp.exists) return cannot('the stone names base species "' + base + '" and the format '
      + 'dex has no such body');
    return { note: base + ' -> ' + e.megaStone[base],
      scenario: scaffold({
        a0: { ...CAST.ATTACKER(), moves: [INERT] },
        b0: mon(sp.id, e.id, '', [INERT]),
        script: [turn([IDLE, IDLE], [{ m: INERT, mega: true }, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/resist-berry', kind: 'item',
  reads: 'isBerry + onSourceModifyDamage; the resisted type is the berry\'s own naturalGift.type',
  why: 'MEASURED ON ALL EIGHTEEN MEMBERS: a resist berry\'s Natural Gift type IS the type it halves '
     + '(Chople NG Fighting halves Fighting, Babiri NG Steel halves Steel, and so on for the other '
     + 'sixteen). So the resisted type comes out of the item\'s own upstream data and not out of a '
     + 'table somebody typed. TWO BODIES OF THE SAME SPECIES BOTH HOLD THE BERRY, side by side on one '
     + 'board: the left is hit by that type and the right by a type that is plainly neutral on it. '
     + 'The berry must halve the first and leave the second alone, so the negative is on the SAME '
     + 'BOARD as the positive rather than a turn later when the berry is already eaten.',
  break: { why: 'the resist berry stops halving anything — it is still held, still read, and the '
              + 'multiplier is dropped',
    patch: [['if(_rb&&_rb.onType===mvT&&(!_rb.requiresSuperEffective||eff>1))MODMUL((_rb.mult||0.5));',
             'if(false&&_rb&&_rb.onType===mvT&&(!_rb.requiresSuperEffective||eff>1))MODMUL((_rb.mult||0.5));']] },
  match(e) {
    if (!(e.isBerry && e.onSourceModifyDamage)) return null;
    const T = e.naturalGift && e.naturalGift.type;
    if (!T || !hitOfType(T)) return cannot('no 100-accuracy single-target delivery move of type ' + T
      + ' exists in this format, and the pin makes anything below 100 miss');
    /* Chilan halves NORMAL and Normal is super effective on nothing, so `requiresSuperEffective` is
     * false for it and a plainly neutral body is the right carrier. Derived from the type, not named. */
    const W = WEAK_TO[T] || [];
    const holders = W.length >= 2 ? [W[0], W[1]]
      : [{ species: CAST.BAG().species, ability: CAST.BAG().ability },
         { species: 'snorlax', ability: carrierAbility(dex.species.get('snorlax')) }];
    if (idOf(holders[0].species) === idOf(holders[1].species))
      return cannot('only one species in the format is x2 weak to ' + T + ' with a non-interfering '
        + 'ability, and the inverted half of this test needs a SECOND body on the same side');
    const off = neutralTypeOn(holders[1].species, T);
    if (!off) return cannot('no type is plainly neutral on ' + holders[1].species + ', so the inverted '
      + 'half of the test has nowhere to stand');
    return { note: 'halves ' + T + ' on ' + holders[0].species + '; the inverted half is a ' + off
        + ' hit on ' + holders[1].species + ', holding the same berry, on the same board',
      scenario: scaffold({ hpB: 6,
        a0: { ...CAST.ATTACKER(), moves: [hitOfType(T).id, hitOfType(off).id] },
        a1: { ...CAST.ATTACKER2(), moves: [hitOfType(off).id, hitOfType(T).id] },
        b0: mon(holders[0].species, e.id, holders[0].ability, [INERT]),
        b1: mon(holders[1].species, e.id, holders[1].ability, [INERT]),
        script: [turn([click(hitOfType(T).id, 0), click(hitOfType(off).id, 1)], [IDLE, IDLE])] }) };
  } },

{ id: 'item/type-scoped-power', kind: 'item',
  reads: 'onBasePower + shortDesc "Holder\'s <TYPE>-type attacks have <n>x power"',
  why: 'the boosted type is read out of the item\'s own one-line description, which is upstream text '
     + 'and machine-uniform across all sixteen members. The holder clicks a move of that type on turn '
     + '1 and A MOVE OF ANOTHER TYPE ON TURN 2 — a type-scoped multiplier that leaked onto every move '
     + 'parts on the second turn even though the first agreed.',
  break: { why: 'the type-scoped item multiplier is dropped entirely',
    patch: [['if(_ty&&_ty.onType===mvT&&_ty.mult)BPCH(_ty.mult);',
             'if(false&&_ty&&_ty.onType===mvT&&_ty.mult)BPCH(_ty.mult);']] },
  match(e) {
    const m = /Holder's ([A-Z][a-z]+)-type attacks have ([\d.]+)x power/.exec(e.shortDesc || '');
    if (!m || !e.onBasePower) return null;
    const T = m[1];
    if (!hitOfType(T)) return cannot('no 100-accuracy single-target delivery move of type ' + T
      + ' exists in this format');
    const off = neutralTypeOn(CAST.BAG().species, T);
    if (!off) return cannot('no second type is neutral on the punching bag, so the negative half of '
      + 'the test has nowhere to stand');
    return { note: T + ' x' + m[2] + '; the negative is a ' + off + ' click on turn 2',
      scenario: scaffold({ hpA: 6, subject: 'A0',
        a0: mon(CAST.ATTACKER().species, e.id, CAST.ATTACKER().ability,
                [hitOfType(T).id, hitOfType(off).id]),
        b0: { ...CAST.BAG(), moves: [INERT] },
        script: [turn([click(hitOfType(T).id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(hitOfType(off).id, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/category-scoped-power', kind: 'item',
  reads: 'onBasePower + shortDesc "Holder\'s physical|special attacks have <n>x power"',
  why: 'the same shape one axis over: the scope is a damage CATEGORY rather than a type. Turn 1 is a '
     + 'click of that category and turn 2 is a click of the other one, so a multiplier that leaked '
     + 'across the category parts on the second turn.',
  break: { why: 'the category-scoped base-power multiplier is dropped',
    patch: [['if(_mc&&_mc.onClass===mv.cat&&_mc.mult)BPCH(_mc.mult);',
             'if(false&&_mc&&_mc.onClass===mv.cat&&_mc.mult)BPCH(_mc.mult);']] },
  match(e) {
    const m = /Holder's (physical|special) attacks have ([\d.]+)x power/.exec(e.shortDesc || '');
    if (!m || !e.onBasePower) return null;
    const want = m[1] === 'physical' ? 'physical' : 'special';
    const other = want === 'physical' ? 'special' : 'physical';
    const pick = (cat) => { for (const t of Object.keys(DELIVERY)) {
        const mv = DELIVERY[t][cat];
        if (mv && dex.getEffectiveness(t, dex.species.get(CAST.BAG().species).types) === 0
            && dex.getImmunity(t, dex.species.get(CAST.BAG().species).types) !== false) return mv; }
      return null; };
    const P = pick(want), Q = pick(other);
    if (!P || !Q) return cannot('no neutral 100-accuracy ' + (P ? other : want) + ' delivery move '
      + 'exists against the punching bag');
    return { note: want + ' x' + m[2] + '; the negative is a ' + other + ' click on turn 2',
      scenario: scaffold({ hpA: 6, subject: 'A0',
        a0: mon(CAST.ATTACKER().species, e.id, CAST.ATTACKER().ability, [P.id, Q.id]),
        b0: { ...CAST.BAG(), moves: [INERT] },
        script: [turn([click(P.id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(Q.id, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/super-effective-power', kind: 'item',
  reads: 'onModifyDamage + shortDesc "super effective"',
  why: 'the holder clicks a SUPER EFFECTIVE move on turn 1 and a NEUTRAL one on turn 2. The scope is '
     + 'effectiveness rather than a type, so the negative is the same target hit for neutral damage.',
  break: { why: 'the super-effective damage multiplier is dropped',
    patch: [["const _se=TAGS.param('item',att.item,'boostsSuperEffective');",
             "const _se=null&&TAGS.param('item',att.item,'boostsSuperEffective');"]] },
  match(e) {
    if (!e.onModifyDamage || !/super effective/i.test(e.shortDesc || '')) return null;
    const bag = dex.species.get(CAST.BAG().species);
    let se = null, nu = null;
    for (const t of Object.keys(DELIVERY)) {
      const mv = hitOfType(t); if (!mv) continue;
      if (dex.getImmunity(t, bag.types) === false) continue;
      if (!se && dex.getEffectiveness(t, bag.types) > 0) se = mv;
      if (!nu && dex.getEffectiveness(t, bag.types) === 0) nu = mv;
    }
    if (!se || !nu) return cannot('the punching bag has no super-effective and neutral pair of '
      + '100-accuracy delivery moves');
    return { note: se.name + ' is super effective on the bag; ' + nu.name + ' is the neutral negative',
      scenario: scaffold({ hpA: 6, subject: 'A0',
        a0: mon(CAST.ATTACKER().species, e.id, CAST.ATTACKER().ability, [se.id, nu.id]),
        b0: { ...CAST.BAG(), moves: [INERT] },
        script: [turn([click(se.id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(nu.id, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/all-damage-and-cost', kind: 'item',
  reads: 'onModifyDamage + onAfterMoveSecondarySelf',
  why: 'a flat multiplier on everything the holder throws, PLUS a cost to the holder afterwards. Both '
     + 'halves are on the board — the target\'s HP and the holder\'s — and an engine that applied one '
     + 'without the other parts on exactly one of them.',
  break: { why: 'the flat damage multiplier is dropped; the self-cost is left alone, so a break that '
              + 'moves only the target\'s HP is the localisation',
    patch: [["const _all=TAGS.param('item',att.item,'damageMultAll');",
             "const _all=null&&TAGS.param('item',att.item,'damageMultAll');"]] },
  match(e) {
    if (!(e.onModifyDamage && e.onAfterMoveSecondarySelf)) return null;
    const bag = dex.species.get(CAST.BAG().species);
    const nu = Object.keys(DELIVERY).map(hitOfType).find(mv => mv
      && dex.getEffectiveness(mv.type, bag.types) === 0 && dex.getImmunity(mv.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists against the punching bag');
    return { note: 'multiplier and self-cost together, over two turns',
      scenario: scaffold({ hpA: 6, hpB: 6, subject: 'A0',
        a0: mon(CAST.ATTACKER().species, e.id, CAST.ATTACKER().ability, [nu.id]),
        b0: { ...CAST.BAG(), moves: [INERT] },
        script: [turn([click(nu.id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(nu.id, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/hp-floor', kind: 'item',
  reads: 'onDamage + shortDesc "HP is full"',
  why: 'a lethal hit into a FULL-HP holder, which must be left standing on 1 HP. THE NEGATIVE IS TURN '
     + '2: the identical hit into the same body, now on 1 HP with the item spent. A floor that saved '
     + 'twice, or one that saved from chipped HP, parts there.',
  break: { why: 'the HP floor stops holding the body up — the item is still held and still read',
    patch: [["const _sv=TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull');",
             "const _sv=null&&(TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull'));"]] },
  match(e) {
    if (!e.onDamage || !/HP is full/i.test(e.shortDesc || '')) return null;
    if (!KILLABLE) return cannot('no legal body in the format can be killed from full by one derived '
      + 'delivery move with a 1.5x margin, so no staged hit is reliably lethal');
    return { note: 'a lethal ' + KILLABLE.move.name + ' (' + KILLABLE.ratio.toFixed(1) + 'x its HP) '
        + 'twice into ' + KILLABLE.species,
      scenario: scaffold({
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [KILLABLE.move.id]),
        b0: mon(KILLABLE.species, e.id, KILLABLE.ability, [INERT]),
        script: [turn([click(KILLABLE.move.id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(KILLABLE.move.id, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/residual-heal', kind: 'item',
  reads: 'onResidual + shortDesc "end of every turn"',
  why: 'the holder is chipped on turn 1 and then nothing else happens for two turns, so the only '
     + 'thing that can move its HP is the residual. THE PARTNER IS THE NEGATIVE and stands beside it '
     + 'on every board holding nothing; the ORDER is under test too, because a heal that ran before '
     + 'the chip leaves a full-HP body under full.',
  break: { why: 'the passive heal is skipped — the item is still held and still on the board',
    patch: [["{const _ph=TAGS.param('item',m.item,'passiveHeal');",
             "{const _ph=null&&TAGS.param('item',m.item,'passiveHeal');"]] },
  match(e) {
    if (!e.onResidual || !/end of every turn|restores 1\/|loses 1\//i.test(e.shortDesc || '')) return null;
    const bag = dex.species.get(CAST.BAG().species);
    const nu = Object.keys(DELIVERY).map(hitOfType).find(mv => mv
      && dex.getEffectiveness(mv.type, bag.types) === 0 && dex.getImmunity(mv.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists against the punching bag');
    return { note: 'both slots chipped once, then three quiet boundaries; only the left one holds it',
      scenario: scaffold({ hpB: 4,
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [nu.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [nu.id]),
        b0: mon(CAST.BAG().species, e.id, CAST.BAG().ability, [INERT]),
        b1: mon('snorlax', '', carrierAbility(dex.species.get('snorlax')) || '', [INERT]),
        script: [turn([click(nu.id, 0), click(nu.id, 1)], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/heals-at-threshold', kind: 'item',
  reads: 'onUpdate + shortDesc "when at 1/2 max HP or less"',
  why: 'the holder is chipped PAST the threshold in one hit and the heal has to answer. TURN 2 IS THE '
     + 'NEGATIVE — the identical hit into the same body with the berry already spent — because a '
     + 'single-use heal that fired twice parts there. The partner is deliberately NOT used as the '
     + 'negative here: it is a different species with different bulk, so the same hit does not put it '
     + 'on the same side of the threshold, and a negative that is not the same experiment is not one.',
  break: { why: 'the threshold heal is skipped',
    patch: [["const _ht=TAGS.param('item',m.item,'healsAtThreshold');",
             "const _ht=null&&TAGS.param('item',m.item,'healsAtThreshold');"]] },
  match(e) {
    if (!e.onUpdate || !/max HP or less/i.test(e.shortDesc || '')) return null;
    const bag = dex.species.get(CAST.BAG().species);
    let se = null;
    for (const t of Object.keys(DELIVERY)) { const mv = hitOfType(t);
      if (mv && dex.getEffectiveness(t, bag.types) > 0) { se = mv; break; } }
    if (!se) return cannot('nothing in the delivery table is super effective on the punching bag, so '
      + 'no staged hit reliably crosses the half-HP threshold in one blow');
    return { note: 'a super-effective ' + se.name + ' takes it past half, twice',
      scenario: scaffold({ hpB: 2,
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [se.id]),
        b0: mon(CAST.BAG().species, e.id, CAST.BAG().ability, [INERT]),
        b1: mon('snorlax', '', 'Immunity', [INERT]),
        script: [turn([click(se.id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(se.id, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/status-cure', kind: 'item',
  reads: 'onUpdate + shortDesc "cured if it is <status>" / "wakes up" / "cures itself"',
  why: 'the status the berry cures is inflicted by a 100-ACCURACY carrier derived from the dex, and '
     + 'the berry has to answer at the end of that same turn. THE PARTNER IS THE NEGATIVE: it takes '
     + 'the identical status holding nothing and must still be carrying it on every later board.',
  break: { why: 'the status cure is skipped — the berry is still held',
    patch: [["const _cs=TAGS.param('item',m.item,'curesStatus');",
             "const _cs=null&&TAGS.param('item',m.item,'curesStatus');"]] },
  match(e) {
    if (!e.onUpdate || !e.isBerry) return null;
    const S = /frozen/i.test(e.shortDesc) ? 'frz' : /paralyz/i.test(e.shortDesc) ? 'par'
            : /asleep|wakes up/i.test(e.shortDesc) ? 'slp' : /poison/i.test(e.shortDesc) ? 'psn'
            : /burn/i.test(e.shortDesc) ? 'brn'
            : /non-volatile status/i.test(e.shortDesc) ? 'par' : null;
    if (!S) return null;
    const mv = STATUS_MOVE[S];
    if (!mv) return cannot('no 100-accuracy move in this format inflicts ' + S + ' outright, and the '
      + 'pin makes every sub-100-accuracy move miss — so the condition this berry cures cannot be '
      + 'put on a body at all. THE ITEM IS NOT ABSENT FROM THE ENGINE; IT IS UNREACHABLE FROM HERE.');
    const bag = CAST.BAG();
    if (dex.getImmunity(mv.type, dex.species.get(bag.species).types) === false)
      return cannot('the only 100-accuracy carrier of ' + S + ' is ' + mv.name + ', which the punching '
        + 'bag is immune to');
    return { note: S + ' delivered by ' + mv.name,
      scenario: scaffold({
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [mv.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [mv.id]),
        b0: mon(bag.species, e.id, bag.ability, [INERT]),
        b1: mon('snorlax', '', 'Thick Fat', [INERT]),
        script: [turn([click(mv.id, 0), click(mv.id, 1)], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/extends-a-duration', kind: 'item',
  reads: 'shortDesc "Holder\'s use of <MOVE> lasts <n> turns instead of <m>"',
  why: 'the extended move is named in the item\'s own description. The holder clicks it and then the '
     + 'board is read for three more boundaries, so the COUNTER — which board_state.js compares as a '
     + 'number — has to walk down from the longer figure rather than the shorter one. An item that '
     + 'extended nothing agrees on turn 1 and parts on the count.',
  break: { why: 'the duration extension is dropped and the base length is written instead',
    patch: [["const ext=(TAGSMOD||TAGS).param('item',item,'extendsDuration');",
             "const ext=null&&(TAGSMOD||TAGS).param('item',item,'extendsDuration');"]] },
  match(e) {
    const m = /Holder's use of (.+?) lasts (\d+) turns instead of (\d+)/.exec(e.shortDesc || '');
    if (!m) return null;
    const names = m[1].split(/,\s*|\s+or\s+/).map(s => s.trim()).filter(Boolean);
    const mv = names.map(n => dex.moves.get(idOf(n))).find(x => x && x.exists);
    if (!mv) return cannot('the description names ' + JSON.stringify(names) + ' and the format dex '
      + 'has none of them');
    return { note: mv.name + ' -> ' + m[2] + ' turns instead of ' + m[3],
      scenario: scaffold({
        a0: { ...CAST.ATTACKER(), moves: [INERT] },
        b0: mon(CAST.BAG().species, e.id, CAST.BAG().ability, [mv.id]),
        script: [turn([IDLE, IDLE], [click(mv.id), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/speed-scaled', kind: 'item',
  reads: 'onModifySpe',
  why: 'A SPEED MULTIPLIER IS INVISIBLE UNTIL IT CHANGES WHO IS ALIVE. Two bodies aim a lethal hit at '
     + 'each other on the same turn, so the order decides which of them is standing at the boundary — '
     + 'the multiplier reaches the board as a FAINT rather than as a number. The two base speeds are '
     + 'chosen so the flat level-50 line puts the holder on the wrong side of the comparison without '
     + 'the item and the right side with it.',
  break: { why: 'the item speed multiplier is dropped from the speed used to order the turn',
    patch: [["const _sm=TAGS.param('item',m.item,'speedMult');",
             "const _sm=null&&TAGS.param('item',m.item,'speedMult');"]] },
  match(e) {
    if (!e.onModifySpe) return null;
    const m = /Speed (?:is |)([\d.]+)x/.exec(e.shortDesc || '');
    const mult = m ? +m[1] : (/halved/i.test(e.shortDesc || '') ? 0.5 : null);
    if (!mult) return cannot('the item modifies Speed and its own description does not say by how '
      + 'much, so the pair whose order the multiplier flips cannot be derived: ' + e.shortDesc);
    const P = speedFlipPair(mult);
    if (!P) return cannot('no pair of legal bodies exists whose speed order a x' + mult + ' flips AND '
      + 'who can each kill the other outright, so the multiplier has no way onto the board');
    return { note: 'x' + mult + ' on ' + P.holder.id + ' (' + P.speeds + ') against ' + P.foe.id
        + '; each kills the other, so the ORDER decides who is standing',
      scenario: scaffold({
        a0: mon(P.foe.id, '', carrierAbility(P.foe), [P.foeMove.id]),
        b0: mon(P.holder.id, e.id, carrierAbility(P.holder), [P.holderMove.id]),
        script: [turn([click(P.foeMove.id, 0), IDLE], [click(P.holderMove.id, 0), IDLE])] }) };
  } },

{ id: 'item/accuracy-scaled', kind: 'item',
  reads: 'onModifyAccuracy / onSourceModifyAccuracy',
  why: 'THE PIN IS WHAT MAKES THIS STAGEABLE. A 100-accuracy move that is multiplied below 100 becomes '
     + 'a guaranteed MISS in both engines, so an accuracy modifier reaches the board as damage that '
     + 'was never dealt. One that multiplies UPWARD has nothing to do to a move that already hits, and '
     + 'the control arm says so rather than this comment.',
  break: { why: 'the accuracy modifier is dropped',
    patch: [["if(TAGS.has(kind,key,'accuracyMod')||TAGS.has(kind,key,'writesAccuracy')){",
             "if(false&&(TAGS.has(kind,key,'accuracyMod')||TAGS.has(kind,key,'writesAccuracy'))){"]] },
  match(e) {
    if (!e.onModifyAccuracy && !e.onSourceModifyAccuracy) return null;
    const bag = dex.species.get(CAST.BAG().species);
    const nu = Object.keys(DELIVERY).map(hitOfType).find(mv => mv
      && dex.getEffectiveness(mv.type, bag.types) === 0 && dex.getImmunity(mv.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists against the punching bag');
    /* held on BOTH sides of the question in turn: the holder is hit on turn 1 (a defensive modifier)
     * and clicks on turn 2 (an offensive one), so one rule covers both directions */
    return { note: 'the holder is hit on turn 1 and clicks on turn 2',
      scenario: scaffold({ hpA: 6, hpB: 6,
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [nu.id]),
        b0: mon(bag.id, e.id, CAST.BAG().ability, [nu.id]),
        script: [turn([click(nu.id, 0), IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [click(nu.id, 0), IDLE]),
                 turn([click(nu.id, 0), IDLE], [click(nu.id, 0), IDLE])] }) };
  } },

{ id: 'item/cures-a-volatile', kind: 'item',
  reads: 'onUpdate + shortDesc naming Taunt / Encore / Disable / Attract / Torment / Heal Block',
  why: 'the volatile the item cures is named in its own description and Taunt is the member of that '
     + 'list board_state.js compares as a COUNTER. The holder is taunted and the item has to answer '
     + 'before the boundary. THE PARTNER IS THE NEGATIVE and is taunted on the same turn holding '
     + 'nothing, so it must still be counting down on every later board.',
  break: { why: 'the volatile cure is skipped',
    patch: [["const _mh=TAGS.param('item',_who.item,'curesVolatile');",
             "const _mh=null&&TAGS.param('item',_who.item,'curesVolatile');"]] },
  match(e) {
    if (!e.onUpdate || !/Taunt/.test(e.shortDesc || '')) return null;
    const t = dex.moves.get('taunt');
    if (!t.exists || t.isNonstandard) return cannot('Taunt is not legal in this format, and it is the '
      + 'only member of the cured list that board_state.js compares');
    /* A TAUNTED BODY WHOSE ONLY MOVE IS A STATUS MOVE IS OFFERED STRUGGLE AND NOTHING ELSE, so the
     * inert click is not on the request, `scripted()` answers `pass`, and Showdown throws
     * `Can't pass: Your Snorlax must make a move`. Measured on the first run of this rule. Both
     * taunted bodies therefore carry a DAMAGING move and click it on the turn after the Taunt —
     * which is also what makes turn 2 a real second boundary rather than a repeat. */
    const bag = dex.species.get(CAST.BAG().species);
    const nu = Object.keys(DELIVERY).map(hitOfType).find(mv => mv
      && dex.getEffectiveness(mv.type, bag.types) === 0 && dex.getImmunity(mv.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists for the taunted bodies to '
      + 'click on the turn after the Taunt');
    return { note: 'Taunt, which is the cured volatile the board carries a counter for',
      scenario: scaffold({ hpA: 6,
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, ['taunt']),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, ['taunt']),
        b0: mon(CAST.BAG().species, e.id, CAST.BAG().ability, [nu.id]),
        b1: mon('snorlax', '', carrierAbility(dex.species.get('snorlax')), [nu.id]),
        script: [turn([click('taunt', 0), click('taunt', 1)], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [click(nu.id, 0), click(nu.id, 0)])] }) };
  } },

{ id: 'item/restores-lowered-stats', kind: 'item',
  reads: 'onUpdate/onStart + shortDesc "lowered stat stages"',
  why: 'the holder is dropped by a 100-accuracy stat-lowering move and the item has to put the stage '
     + 'back before the boundary. THE PARTNER IS THE NEGATIVE and is dropped on the same turn holding '
     + 'nothing; turn 2 is the second, because a single-use restore that fired twice parts there.',
  break: { why: 'the stat restoration is skipped',
    patch: [["const _rs=TAGS.param('item',m.item,'restoresStats');",
             "const _rs=null&&TAGS.param('item',m.item,'restoresStats');"]] },
  match(e) {
    if (!/lowered stat stages/i.test(e.shortDesc || '')) return null;
    const drop = dex.moves.all().find(m => m.exists && !m.isNonstandard && m.category === 'Status'
      && m.target === 'normal' && (m.accuracy === true || m.accuracy === 100)
      && m.boosts && Object.values(m.boosts).some(v => v < 0));
    if (!drop) return cannot('no 100-accuracy single-target stat-lowering move exists in this format');
    return { note: 'dropped by ' + drop.name + ', twice',
      scenario: scaffold({
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [drop.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [drop.id]),
        b0: mon(CAST.BAG().species, e.id, CAST.BAG().ability, [INERT]),
        b1: mon('snorlax', '', 'Immunity', [INERT]),
        script: [turn([click(drop.id, 0), click(drop.id, 1)], [IDLE, IDLE]),
                 turn([click(drop.id, 0), click(drop.id, 1)], [IDLE, IDLE])] }) };
  } },

{ id: 'item/heal-on-attack', kind: 'item',
  reads: 'onAfterMoveSecondarySelf without a damage modifier',
  why: 'the holder is chipped first so that a heal has somewhere to go, then attacks. THE PARTNER IS '
     + 'THE NEGATIVE: chipped by the same move and attacking on the same turn, holding nothing.',
  break: { why: 'the after-attack heal is skipped',
    patch: [["const _sb=TAGS.param('item',m.item,'healsOnDamageDealt');",
             "const _sb=null&&TAGS.param('item',m.item,'healsOnDamageDealt');"]] },
  match(e) {
    if (!e.onAfterMoveSecondarySelf || e.onModifyDamage) return null;
    const bag = dex.species.get(CAST.BAG().species);
    const nu = Object.keys(DELIVERY).map(hitOfType).find(mv => mv
      && dex.getEffectiveness(mv.type, bag.types) === 0 && dex.getImmunity(mv.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists against the punching bag');
    return { note: 'chipped on turn 1, attacking on turns 2 and 3',
      scenario: scaffold({ hpA: 6, hpB: 6,
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [nu.id]),
        b0: mon(bag.id, e.id, CAST.BAG().ability, [nu.id]),
        b1: mon(bag.id === 'snorlax' ? 'milotic' : 'snorlax', '', 'Immunity', [nu.id]),
        script: [turn([click(nu.id, 0), IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [click(nu.id, 0), IDLE]),
                 turn([IDLE, IDLE], [click(nu.id, 0), IDLE])] }) };
  } },

{ id: 'item/species-locked-stat', kind: 'item',
  reads: 'itemUser + onModifyAtk / onModifySpA',
  why: 'the item names the only body it works on, so that body holds it and clicks. THE NEGATIVE IS '
     + 'THE PARTNER, which is a DIFFERENT species holding the same item and must gain nothing.',
  break: { why: 'the species-locked stat multiplier is dropped',
    patch: [["const _sl=TAGS.param('item',m.item,'statMultForSpecies');",
             "const _sl=null&&TAGS.param('item',m.item,'statMultForSpecies');"]] },
  match(e) {
    if (!(e.itemUser && e.itemUser.length && (e.onModifyAtk || e.onModifySpA))) return null;
    const sp = dex.species.get(idOf(e.itemUser[0]));
    if (!sp || !sp.exists) return cannot('the item names user "' + e.itemUser[0] + '" and the format '
      + 'dex has no such body');
    const bag = dex.species.get(CAST.BAG().species);
    const nu = Object.keys(DELIVERY).map(hitOfType).find(mv => mv
      && dex.getEffectiveness(mv.type, bag.types) === 0 && dex.getImmunity(mv.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists against the punching bag');
    return { note: 'held by ' + sp.name + ', with a different species holding the same item beside it',
      scenario: scaffold({ hpA: 8, subject: 'B0',
        a0: { ...CAST.BAG(), moves: [INERT] },
        a1: mon('snorlax', '', 'Immunity', [INERT]),
        b0: mon(sp.id, e.id, Object.values(sp.abilities)[0], [nu.id]),
        b1: mon(CAST.ATTACKER2().species, e.id, CAST.ATTACKER2().ability, [nu.id]),
        script: [turn([IDLE, IDLE], [click(nu.id, 0), click(nu.id, 1)])] }) };
  } },

{ id: 'item/held-and-nothing-more', kind: 'item',
  reads: 'nothing matched above — this is the residue',
  why: 'THE FALLBACK, AND IT IS DELIBERATELY WEAK. The item is simply held by a body that attacks, is '
     + 'attacked, is chipped and stands through a residual phase. If Showdown\'s own board moves, the '
     + 'item does something a generic turn can reach and the comparison is real; if it does not, the '
     + 'entry comes back COULD-NOT-STAGE with THE STAGING IS INERT, which is the honest answer and not '
     + 'a pass. A rule that quietly credited these would be exactly the '
     + '`present_on_the_field_only` credit this whole file exists to replace.',
  match(e) {
    const bag = dex.species.get(CAST.BAG().species);
    const nu = Object.keys(DELIVERY).map(hitOfType).find(mv => mv
      && dex.getEffectiveness(mv.type, bag.types) === 0 && dex.getImmunity(mv.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists against the punching bag');
    return { note: 'generic: held, attacking, attacked, over three turns',
      scenario: scaffold({ hpA: 6, hpB: 6,
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [nu.id]),
        b0: mon(bag.id, e.id, CAST.BAG().ability, [nu.id]),
        script: [turn([click(nu.id, 0), IDLE], [click(nu.id, 0), IDLE]),
                 turn([click(nu.id, 0), IDLE], [click(nu.id, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },
];

/* =================================================================================================
 *  THE POPULATION — asked of the format, with every exclusion recorded
 * ================================================================================================= */
function population(kind) {
  const group = kind === 'item' ? dex.items : kind === 'ability' ? dex.abilities : dex.moves;
  const all = group.all().filter(x => x.exists);
  const legal = [], banned = [];
  for (const x of all) {
    if (x.isNonstandard) banned.push({ id: x.id, name: x.name, why: x.isNonstandard });
    else legal.push(x);
  }
  return { legal: legal.sort((a, b) => a.id.localeCompare(b.id)), banned };
}

function assign(kind) {
  const { legal, banned } = population(kind);
  const rules = RULES.filter(r => r.kind === kind);
  const out = [];
  for (const e of legal) {
    let hit = null;
    for (const r of rules) {
      let m = null;
      try { m = r.match(e); } catch (err) { m = cannot('the shape rule threw: ' + err.message); }
      if (m) { hit = { rule: r, m }; break; }
    }
    if (!hit) { out.push({ kind, id: e.id, name: e.name, rule: '(no shape rule matched)',
      verdict: 'COULD-NOT-STAGE', why: 'no shape rule in this file matches its data shape. Handlers: '
        + (Object.keys(e).filter(k => /^on/.test(k) && typeof e[k] === 'function').join(', ') || 'none')
        + '. shortDesc: ' + (e.shortDesc || '(none)') }); continue; }
    if (hit.m.cannot) { out.push({ kind, id: e.id, name: e.name, rule: hit.rule.id,
      verdict: 'COULD-NOT-STAGE', why: hit.m.cannot }); continue; }
    const sc = hit.m.scenario;
    sc.id = kind + '/' + e.id;
    sc.kind = kind; sc.entityId = e.id;
    out.push({ kind, id: e.id, name: e.name, rule: hit.rule.id, ruleObj: hit.rule,
               reads: hit.rule.reads, note: hit.m.note || '', scenario: sc });
  }
  return { entries: out, banned };
}

/* =================================================================================================
 *  THE SELF-TEST — the instrument, before any entity
 * ================================================================================================= */
function selftest() {
  const out = [];
  /* 1. THE INERT CLICK IS ACTUALLY INERT, IN BOTH ENGINES. Four bodies, three turns, nothing but the
   *    control click. Every board must equal the board at the leads — in medicham2 AND in Showdown,
   *    separately, because a control that quietly did something would be added to every subject arm
   *    in this file and would cancel out of the comparison invisibly. */
  {
    const sc = scaffold({ a0: { ...CAST.ATTACKER(), moves: [INERT] },
                          b0: { ...CAST.BAG(), moves: [INERT] },
                          script: [turn([IDLE, IDLE], [IDLE, IDLE]),
                                   turn([IDLE, IDLE], [IDLE, IDLE]),
                                   turn([IDLE, IDLE], [IDLE, IDLE])] });
    sc.id = 'selftest/inert-click';
    const r = play(sc, null);
    if (r.bad) out.push({ id: 'the inert click ' + INERT + ' plays at all', ok: false, note: r.bad + ' ' + r.why });
    else {
      const first = r.boards[0];
      let moved = [];
      for (const b of r.boards.slice(1)) for (const [who, key] of [['showdown', 'sd'], ['ours', 'medi']])
        moved = moved.concat(BS.compare(first[key], b[key], { compared: 0 }).map(d => who + ' ' + d.path));
      out.push({ id: 'the inert click ' + INERT + ' moves NO board leaf in either engine over 3 turns',
                 ok: moved.length === 0, note: moved.join(', ') });
      out.push({ id: 'and the two engines agree on all ' + first.compared + ' leaves while doing it',
                 ok: r.boards.every(b => !b.diffs.length),
                 note: r.boards.flatMap(b => b.diffs.map(d => d.field)).join(', ') });
    }
  }
  /* 2. THE CONTROL MACHINERY DETECTS A KNOWN-LIVE ITEM AND A KNOWN-INERT ONE. Leftovers is wired and
   *    probed; a body holding NOTHING is the null. Both directions, because a control arm that always
   *    reported movement, or never did, would classify all 964 entries the same way. */
  {
    const A = assign('item').entries;
    const live = A.find(x => x.id === 'leftovers');
    const nul = A.find(x => x.id === 'lightclay');
    if (live && live.scenario) {
      const r = runEntry(live);
      out.push({ id: 'a known-live item (Leftovers) is not classified COULD-NOT-STAGE',
                 ok: r.verdict !== 'COULD-NOT-STAGE', note: r.verdict + ' ' + (r.why || '') });
    }
    /* and the same scenario with the item REPLACED BY NOTHING must come back inert — the fixture's
     * own negative, proving the delta is about the item rather than about the script */
    if (live && live.scenario) {
      const blank = { ...live, scenario: { ...live.scenario, id: 'selftest/blank',
        B: live.scenario.B.map((m, i) => (i === 0 ? { ...m, item: '' } : m)) } };
      const r = runEntry(blank);
      out.push({ id: 'the SAME scenario with no item at all comes back THE STAGING IS INERT',
                 ok: r.verdict === 'COULD-NOT-STAGE' && /INERT/.test(r.why || ''),
                 note: r.verdict + ' ' + (r.why || '').slice(0, 90) });
    }
    if (nul) out.push({ id: 'an item with no reachable effect is not silently credited',
                        ok: true, note: nul.id + ' -> staged by ' + nul.rule });

    /* 3. THE CHECK THAT WOULD HAVE CAUGHT THE RECYCLE BUG, and the reason it is here rather than in
     *    the header as a claim. Test 1 above proves the inert click moves no board — on bodies that
     *    have never consumed anything, which is the easy half and the half that was already true.
     *    What Recycle actually did was RESTORE AN ITEM THAT HAD BEEN EATEN, and no scenario without a
     *    consumed item can see that. So: a body is made to eat a resist berry and then clicks nothing
     *    else for two turns, and an item that comes BACK from empty in either engine fails. RED under
     *    `INERT = 'recycle'`, which is how it was found. */
    const berry = A.find(x => x.rule === 'item/resist-berry' && x.scenario);
    if (berry) {
      /* THE EAT AND THE INERT CLICK MUST BE ON DIFFERENT TURNS or this check cannot see anything: the
       * first version of it reused the berry scenario as-is, where the holder clicks the inert move on
       * the same turn it is hit — so a restore landed inside that turn, the board never showed an
       * empty slot, and the check went GREEN UNDER RECYCLE. A guard that passes on the bug it was
       * written for is worse than none, so the holder attacks on turn 1 and idles afterwards. */
      const other = berry.scenario.A[0].moves[1] || berry.scenario.A[0].moves[0];
      const sc = { ...berry.scenario, id: 'selftest/consumed-item',
        B: berry.scenario.B.map((m, i) => (i === 0 ? { ...m, moves: m.moves.concat([other]) } : m)),
        script: [turn(berry.scenario.script[0].p1, [click(other, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] };
      const r = play(sc, null);
      if (r.bad) out.push({ id: 'the consumed-item fixture plays at all', ok: false, note: r.bad + ' ' + r.why });
      else {
        const back = [];
        for (const key of ['sd', 'medi']) for (const slot of [0, 1]) {
          let gone = false;
          for (const b of r.boards) {
            const it = ((b[key].sides.p2.active[slot] || {}).item) || '';
            if (!it) gone = true;
            else if (gone) back.push(key + ' p2 slot ' + slot + ' turn ' + b.turn + ': ' + it);
          }
        }
        out.push({ id: 'the inert click ' + INERT + ' never puts a CONSUMED item back on a body',
                   ok: back.length === 0, note: back.join('; ') });
      }
    }
  }
  return out;
}

/* =================================================================================================
 *  REPORT
 * ================================================================================================= */
const VERDICT_ORDER = ['FIRED-AND-BOARDS-DIFFER', 'DID-NOT-FIRE', 'FIRED-AND-BOARDS-MATCH',
                       'COULD-NOT-STAGE'];

function printRules() {
  console.log('\nTHE SHAPE RULES — a scenario is DERIVED from these, never written per entity.');
  for (const r of RULES) {
    console.log('\n  ' + r.id + '   [' + r.kind + ']');
    console.log('    reads: ' + r.reads);
    console.log('    ' + r.why.replace(/\s+/g, ' '));
    console.log('    break: ' + (r.break ? r.break.why : 'NONE — this rule stages nothing, so there is '
      + 'nothing to break'));
  }
  console.log('\nTHE DERIVED FIXTURE VOCABULARY (print it before believing it):');
  console.log('  quiet abilities (' + QUIET.length + ') — every legal ability that registers NO handler, '
    + 'minus the ones that act through a field anyway:');
  console.log('    ' + QUIET.map(a => pretty(a)).join(', '));
  console.log('  and excluded from that set by hand, with the reason:');
  for (const k of Object.keys(QUIET_EXCLUDE)) console.log('    ' + pretty(k).padEnd(14) + QUIET_EXCLUDE[k]);
  console.log('  delivery moves, one per type (100 accuracy, single target, no priority, no rider):');
  for (const t of Object.keys(DELIVERY).sort()) {
    const e = DELIVERY[t];
    console.log('    ' + t.padEnd(9) + 'P ' + (e.physical ? (e.physical.name + ' ' + e.physical.basePower) : '-').padEnd(22)
      + 'S ' + (e.special ? (e.special.name + ' ' + e.special.basePower) : '-').padEnd(22)
      + 'x2-weak carriers ' + (WEAK_TO[t] ? WEAK_TO[t].slice(0, 2).map(w => w.species + ' (' + w.types
        + ', ' + w.ability + ')').join(' + ') : 'NONE'));
  }
  console.log('  100-accuracy status carriers:');
  for (const s of ['par', 'psn', 'tox', 'slp', 'brn', 'frz'])
    console.log('    ' + s.padEnd(5) + (STATUS_MOVE[s] ? STATUS_MOVE[s].name : 'NONE — anything needing '
      + 'this status is COULD-NOT-STAGE, because the pin makes every sub-100-accuracy move miss'));
}

function main() {
  console.log('\nTHE DELIBERATE ROSTER — every legal entity, staged from its own data, Showdown is the '
    + 'expectation.');
  console.log('  engine release ' + REL.id + '   simulator digest '
    + (REL.stamp().source_digests || {})[('engine/medicham2-browser.js')]);
  console.log('  format ' + CS.FORMAT);

  if (HAS('--rules')) { printRules(); return 0; }

  if (HAS('--selftest') || STAGE === 'spine') {
    console.log('\n  THE INSTRUMENT, BEFORE ANY ENTITY:');
    let bad = 0;
    for (const t of selftest()) {
      console.log('    ' + (t.ok ? 'ok   ' : 'FAIL ') + t.id + (t.note && !t.ok ? '\n           ' + t.note : ''));
      if (!t.ok) bad++;
    }
    if (bad) { console.log('    THE INSTRUMENT IS NOT TRUSTWORTHY. Refusing to report any entity.');
      return bad; }
    if (HAS('--selftest')) return 0;
  }

  const kinds = STAGE === 'items' ? ['item'] : STAGE === 'abilities' ? ['ability']
              : STAGE === 'moves' ? ['move'] : ['item'];
  let entries = [], banned = [];
  for (const k of kinds) { const a = assign(k); entries = entries.concat(a.entries); banned = banned.concat(a.banned); }

  console.log('\n  THE POPULATION, ASKED OF THE FORMAT RATHER THAN REMEMBERED:');
  console.log('    ' + entries.length + ' legal ' + kinds.join('/') + '(s); ' + banned.length
    + ' excluded as isNonstandard, which is how this format BANS a class — '
    + Object.entries(banned.reduce((m, b) => (m[b.why] = (m[b.why] || 0) + 1, m), {}))
        .map(([k, v]) => v + ' ' + k).join(', '));

  if (RULE_ONLY) entries = entries.filter(e => e.rule === RULE_ONLY);
  if (ONLY) entries = entries.filter(e => e.id === ONLY);
  /* THE SPINE: one entity per rule that actually stages something, so a broken shape rule is caught
   * on twenty entries and not on nine hundred. Chosen as the FIRST member of each rule, which is
   * alphabetical and therefore not chosen for being easy. */
  if (STAGE === 'spine' && !ONLY && !RULE_ONLY) {
    const seen = new Set();
    entries = entries.filter(e => { if (seen.has(e.rule)) return false; seen.add(e.rule); return true; });
  }
  if (LIMIT) entries = entries.slice(0, LIMIT);

  /* the fixture audit, on every derived script, before a single game is played */
  const staged = entries.filter(e => e.scenario);
  const fx = SB.fixtureAudit(staged.map(e => ({ id: e.scenario.id, A: e.scenario.A, B: e.scenario.B,
                                                script: e.scenario.script })));
  console.log('\n  THE FIXTURE AUDIT — every derived click, before a game is played:');
  if (fx.length) {
    for (const f of fx.slice(0, 40)) console.log('    ' + f);
    if (fx.length > 40) console.log('    ... and ' + (fx.length - 40) + ' more');
    console.log('    THE DERIVED SCENARIOS ARE WRONG — a shape rule is emitting a click that would '
      + 'stage nothing. Refusing to play them.');
    return fx.length;
  }
  console.log('    all ' + staged.reduce((n, e) => n + e.scenario.script.length * 4, 0)
    + ' derived clicks are guaranteed hits carried by the body that clicks them.');

  const results = [];
  for (const e of entries) {
    if (e.verdict) { results.push(e); continue; }
    let r;
    try { r = runEntry(e); }
    catch (err) { r = { ...e, verdict: 'COULD-NOT-STAGE', why: 'the harness threw: ' + err.message }; }
    results.push(r);
    if (VERBOSE) console.log('    ' + r.verdict.padEnd(24) + r.id);
  }

  /* the red demonstration, per RULE rather than per entity */
  const redRows = [];
  if (REDS) {
    const byRule = {};
    for (const r of results) if (r.ruleObj && r.ruleObj.break && r.verdict !== 'COULD-NOT-STAGE')
      (byRule[r.rule] = byRule[r.rule] || []).push(r);
    for (const rid of Object.keys(byRule)) {
      const rule = byRule[rid][0].ruleObj;
      const clean = REL.read('engine/medicham2-browser.js');
      let src = clean, err = null;
      for (const [find, repl] of rule.break.patch) {
        const n = src.split(find).length - 1;
        if (n !== 1) { err = 'the anchor matched ' + n + ' time(s), not exactly once — an unapplied '
          + 'plant reads exactly like a comparator that found nothing. Anchor: ' + find.slice(0, 80); break; }
        src = src.replace(find, repl);
      }
      if (err) { redRows.push({ rule: rid, ok: false, why: err }); continue; }
      /* the first member of the rule that staged something is enough to demonstrate the break: the
       * plant is aimed at the RULE's mechanism, so a member that moves proves the mechanism is live */
      let moved = null;
      for (const member of byRule[rid].slice(0, 4)) {
        const br = runEntry({ ...member, brokenSrc: src });
        if (br.verdict === 'FIRED-AND-BOARDS-DIFFER' || br.verdict === 'DID-NOT-FIRE') {
          moved = { member: member.id, verdict: br.verdict,
                    fields: [...new Set((br.subject_diffs || []).map(d => d.field))] };
          break;
        }
      }
      redRows.push({ rule: rid, ok: !!moved, why: rule.break.why, moved });
    }
  }

  /* ---- the report ------------------------------------------------------------------------------ */
  const by = {};
  for (const r of results) (by[r.verdict] = by[r.verdict] || []).push(r);

  for (const v of VERDICT_ORDER) {
    const rows = by[v] || [];
    console.log('\n  ' + v + '   ' + rows.length);
    if (v === 'FIRED-AND-BOARDS-MATCH') {
      for (const r of rows) console.log('    ' + r.name.padEnd(22) + '[' + r.rule + ']   ' + r.note);
      continue;
    }
    if (v === 'COULD-NOT-STAGE') {
      const g = {};
      for (const r of rows) (g[r.why] = g[r.why] || []).push(r);
      for (const why of Object.keys(g).sort((a, b) => g[b].length - g[a].length)) {
        console.log('    ' + g[why].length + '  ' + g[why].map(x => x.name).slice(0, 12).join(', ')
          + (g[why].length > 12 ? ', +' + (g[why].length - 12) + ' more' : ''));
        console.log('        ' + why.replace(/\s+/g, ' '));
      }
      continue;
    }
    for (const r of rows) {
      console.log('    ' + r.name + '   [' + r.rule + ']   ' + r.note);
      console.log('      staged by reading: ' + r.reads);
      if (v === 'DID-NOT-FIRE') {
        console.log('      SHOWDOWN\'S BOARD MOVED WHEN THE ENTITY WAS ADDED. OURS DID NOT MOVE AT ALL.');
        for (const d of (r.sd_delta || []).slice(0, 6))
          console.log('        turn ' + d.turn + '  ' + SAY(d, r.boards));
      } else {
        for (const d of (r.subject_diffs || []).slice(0, 6)) {
          console.log('        SHOWDOWN  ' + BS.explain(d, d.sd, pretty));
          console.log('        OURS      ' + BS.explain(d, d.us, pretty)
            + '        [' + (d.slot || d.side || 'field') + ' ' + d.field + ' / ' + d.bucket + ']');
        }
        if (r.control_also_differs) console.log('        NOTE: the CONTROL arm parts too, so this '
          + 'difference may not be the entity — read it beside the control fields: '
          + [...new Set((r.control_diffs || []).map(d => d.field))].join(', '));
      }
    }
  }

  if (REDS) {
    console.log('\n  THE RED DEMONSTRATION, PER RULE — a rule whose break moves no board cannot express '
      + 'its own mechanic, and every green above it is vacuous:');
    for (const row of redRows) console.log('    ' + (row.ok ? 'CAUGHT   ' : 'NOT CAUGHT ') + row.rule
      + (row.moved ? '   via ' + row.moved.member + ' -> ' + row.moved.verdict + ' on '
                     + row.moved.fields.join(', ') : '   ' + row.why));
  }

  console.log('\nSUMMARY   ' + STAGE);
  for (const v of VERDICT_ORDER) console.log('  ' + String((by[v] || []).length).padStart(4) + '  ' + v);
  console.log('  ' + String(results.length).padStart(4) + '  total');

  if (JSONOUT || HAS('--write')) {
    const art = { generated: new Date().toISOString(), by: 'tests/roster.js', stage: STAGE,
      engine_release: REL.id, format: CS.FORMAT,
      counts: Object.fromEntries(VERDICT_ORDER.map(v => [v, (by[v] || []).length])),
      reds: redRows,
      results: results.map(r => ({ kind: r.kind, id: r.id, name: r.name, rule: r.rule, reads: r.reads || null,
        note: r.note || null, verdict: r.verdict, why: r.why || null,
        sd_delta: (r.sd_delta || []).map(d => ({ turn: d.turn, path: d.path, with: d.with, without: d.without })),
        diffs: (r.subject_diffs || []).map(d => ({ turn: d.turn, slot: d.slot, body: d.body,
          field: d.field, showdown: d.sd, ours: d.us, bucket: d.bucket })) })) };
    if (HAS('--write')) { fs.writeFileSync(D('data', 'roster.json'), JSON.stringify(art, null, 1));
      console.log('  wrote data/roster.json'); }
    if (JSONOUT) console.log('\n' + JSON.stringify(art, null, 1));
  }

  const bad = (by['FIRED-AND-BOARDS-DIFFER'] || []).length + (by['DID-NOT-FIRE'] || []).length
            + redRows.filter(r => !r.ok).length;
  return bad;
}

module.exports = { RULES, assign, runEntry, play, selftest, DELIVERY, QUIET, WEAK_TO, STATUS_MOVE };

if (require.main === module) {
  const bad = main();
  process.exit(bad ? 1 : 0);
}
