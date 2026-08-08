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
 * compare. Used a second time it simply fails.
 *
 * AND IT HAS ONE SHARP EDGE, WHICH THE INSTRUMENT ALSO FOUND RATHER THAN THIS COMMENT ANTICIPATING
 * IT. "The pin can never cash a crit in" is TRUE FOR AN ORDINARY MOVE and FALSE FOR A HIGH-CRIT ONE:
 * Focus Energy adds two stages, and two stages on top of a `critRatio: 2` move reaches the tier where
 * Showdown rolls `randomChance(1, 1)` and CRITS EVERY TIME — no die, so no pin. Measured: Wide Lens
 * and Zoom Lens reported as engine defects on a 14-HP damage gap that was `|-crit|p1a: Dragapult`,
 * manufactured by the control click itself through a Crabhammer.
 *
 * SO THE DELIVERY TABLE REFUSES ANY MOVE WITH A RAISED CRIT RATIO, and `critRatioAudit()` re-checks
 * EVERY click in EVERY derived script before a game is played — because the exclusion lives in one
 * function and a future rule could pick a move any other way.
 *
 * AND THE SELFTEST NOW CHECKS THE THING THAT ACTUALLY WENT WRONG, not the thing that was easy to
 * check: a body is made to CONSUME an item and then clicks nothing else, and an item that comes back
 * from empty in either engine is a hard failure. That check is RED under Recycle. */
const INERT = 'focusenergy';
const INERT_RAISES_CRIT_STAGES = 2;

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
function deliveryOf(m, opt) {
  if (!m.exists || m.isNonstandard) return false;
  if (m.category === 'Status' || !(m.basePower > 0)) return false;
  /* `allowInaccurate` is for the ONE rule whose mechanic IS the accuracy roll — an upward accuracy
   * multiplier needs a move that misses without it. Every other disqualifier below still applies, and
   * that matters: the first version of that rule ran its own filter and picked STEEL BEAM, which
   * takes half the user's own HP. Kangaskhan killed itself, a replacement walked in, and seven leaves
   * parted in both arms. One definition of "a boring delivery move", used everywhere. */
  if (!(m.accuracy === true || m.accuracy === 100) && !(opt && opt.allowInaccurate)) return false;
  if (!(m.target === 'normal' || m.target === 'any')) return false;    // one body, chosen by us
  if (m.priority !== 0) return false;                                  // turn order is not the test
  if (m.flags.charge || m.flags.recharge || m.multihit || m.ohko) return false;
  if (m.selfdestruct || m.forceSwitch || m.breaksProtect || m.isZ || m.isMax) return false;
  /* `mindBlownRecoil` IS A FLAG AND NOT A HANDLER, so a handler-shaped filter waves Steel Beam
   * through — 140 base power, 95 accuracy, and it takes half the user's own max HP. Measured: the
   * accuracy rule picked it, Kangaskhan killed itself, a replacement walked in, and seven leaves
   * parted in both arms of Wide Lens and Zoom Lens. */
  if (m.drain || m.recoil || m.self || m.willCrit || m.mindBlownRecoil || m.struggleRecoil) return false;
  /* see the INERT header: the control click adds two crit stages, and two on top of a raised ratio is
   * a GUARANTEED crit that no pin can stop */
  if (m.critRatio > 1) return false;   // NOTE: every move carries critRatio 1 by default
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

/* THE 100-ACCURACY CONFUSING MOVE and the 100-accuracy DRAINING move, derived the same way and for
 * the same reason: a berry that cures confusion and an item that scales a drain have nothing to act
 * on without one, and picking the carrier by name would put a table in this file that the format can
 * outgrow. */
const CONFUSE_MOVE = dex.moves.all().find(m => m.exists && !m.isNonstandard
  && m.volatileStatus === 'confusion' && (m.accuracy === true || m.accuracy === 100)
  && (m.target === 'normal' || m.target === 'any') && !m.boosts && !m.status) || null;
const DRAIN_MOVE = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.drain
    && (m.accuracy === true || m.accuracy === 100) && (m.target === 'normal' || m.target === 'any')
    && !m.flags.charge && !m.multihit && m.basePower > 0)
  .sort((a, b) => b.basePower - a.basePower)[0] || null;

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
  /* AND ANYTHING THAT TRIGGERS ON A FAINT, which the first list missed and the instrument caught:
   * the speed-order rule stages a mutual KO, so it derived Gyarados with MOXIE as its carrier and the
   * report read `Gyarados is at +1 Attack / ours at 0` — an Attack stage attributed to Choice Scarf.
   * A rule that KILLS something must not put a body on the field that is paid for killing. */
  'onSourceAfterFaint', 'onAnyFaint', 'onFaint', 'onAllyFaint',
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

/* A BODY THAT CAN ACTUALLY BE HIT BY A GIVEN TYPE. The punching bag is pure Normal and is therefore
 * IMMUNE TO GHOST, and the aggressor is Dragon/Ghost and is immune to Normal and Fighting — so a rule
 * that derives its delivery move first and its bodies second can end up staging `|-immune|`, which
 * reads as "the item did nothing" and is really "the click did nothing". Measured twice: Spell Tag
 * against the bag, and a Crush Claw thrown BY the bag AT the aggressor. */
function bodyNotImmuneTo(type, prefer, notSpecies) {
  const p = dex.species.get(prefer || CAST.BAG().species);
  if (dex.getImmunity(type, p.types) !== false && idOf(p.id) !== idOf(notSpecies || ''))
    return { species: p.id, ability: (prefer ? carrierAbility(p) : CAST.BAG().ability) || '' };
  const alt = CANDIDATES.filter(s => dex.getImmunity(type, s.types) !== false
      && idOf(s.id) !== idOf(notSpecies || '')
      && dex.getEffectiveness(type, s.types) === 0)
    .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd)
                  - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd))[0];
  return alt ? { species: alt.id, ability: carrierAbility(alt) } : null;
}

/* A BODY THAT ONE DERIVED HIT TAKES PAST HALF ITS HP WITHOUT KILLING IT — what a threshold heal needs,
 * and what it did not get when the delivery table stopped using high-crit moves: the entry silently
 * became "THE STAGING IS INERT" because the hit no longer crossed the line. Derived, like lethality. */
const HALVER = (() => {
  const att = dex.species.get(CAST.ATTACKER().species);
  let best = null;
  for (const s of CANDIDATES) {
    const hp = flatL50(s.baseStats).hp;
    for (const t of Object.keys(DELIVERY)) for (const mv of [DELIVERY[t].physical, DELIVERY[t].special]) {
      if (!mv) continue;
      const d = maxRoll(att, mv, s);
      if (d < hp * 0.55 || d > hp * 0.9) continue;
      if (!best || d / hp > best.frac) best = { species: s.id, ability: carrierAbility(s), move: mv,
                                                frac: d / hp, hp };
    }
  }
  return best;
})();

/* BODIES THE CHART PUTS AT 4x FOR A GIVEN TYPE, with the one fact that decides whether the 4x arm is
 * worth running: does the UNHALVED hit kill while the HALVED one does not. That is the difference a
 * resist berry actually makes at 4x, and it lands on `fainted` and `species` rather than on a damage
 * number — which is what keeps it clear of the authority's HP-loss cap. */
const FOUR_X = {};
for (const t of Object.keys(DELIVERY)) {
  const mv = hitOfType(t);
  if (!mv) continue;
  const att = dex.species.get(CAST.ATTACKER().species);
  const rows = CANDIDATES.filter(s => dex.getEffectiveness(t, s.types) === 2)
    .map(s => { const hp = flatL50(s.baseStats).hp, d = maxRoll(att, mv, s);
      return { species: s.id, ability: carrierAbility(s), types: s.types.join('/'),
               dmg: d, hp, flipsAKO: d >= hp && d < hp * 2 }; })
    .sort((a, b) => (b.flipsAKO - a.flipsAKO) || (b.hp - a.hp));
  if (rows.length) FOUR_X[t] = rows;
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

/* ---- WHO CAN CARRY AN ABILITY, AND WHAT ITS CONTROL IS -----------------------------------------
 *
 * An item is handed to any body. AN ABILITY IS NOT: `buildPair` reads the species' own ability list
 * and silently falls back to slot 0 for anything illegal, so the carrier has to be a species that
 * really has it, and the CONTROL has to be another ability THAT SAME SPECIES really has.
 *
 * FOUR TIERS FALL OUT OF THE FORMAT, and the fourth is the largest single fact in this stage:
 *
 *   ALTERNATE   173  a legal, non-mega species carries it AND has another ability. Control = that
 *                    other ability, chosen quiet-first.
 *   SUPPRESS     14  the only legal carriers have it as their ONLY ability (Mimikyu/Disguise,
 *                    Morpeko/Hunger Switch, Palafin/Zero to Hero, Aegislash/Stance Change...).
 *                    Control = Gastro Acid, proven in `selftest()` before it is used.
 *   MEGA         14  the only carrier is a MEGA forme, so the ability arrives with the forme change
 *                    and cannot be swapped at all. The base species holds the stone and asks to mega;
 *                    control = Gastro Acid, which resolves AFTER the mega (queue order 104 against
 *                    200). USAGE COUNTS CANNOT SEE THIS TIER — a team sheet records the BASE forme's
 *                    ability, so Fairy Aura reads 0 uses while sitting on a heavily-played mega.
 *   NONE        115  NO LEGAL SPECIES IN THIS FORMAT CARRIES IT. Not a limitation of this file:
 *                    Showdown marks the ABILITY standard and marks every body that has it
 *                    `isNonstandard: 'Past'`. Storm Drain's carriers are Gastrodon, Cradily and
 *                    Maractus and all three are Past here. These are reported COULD-NOT-STAGE with
 *                    that as the reason, and the count is a fact about the REGULATION.
 */
const MEGA_OF = {};      // mega forme id -> { item, base }
for (const it of dex.items.all()) {
  if (!it.exists || it.isNonstandard || !it.megaStone) continue;
  for (const b of Object.keys(it.megaStone)) MEGA_OF[idOf(it.megaStone[b])] = { item: it.id, base: idOf(b) };
}
const CARRIERS = {};
for (const s of dex.species.all()) {
  if (!s.exists || s.isNonstandard) continue;
  for (const n of Object.values(s.abilities || {})) (CARRIERS[idOf(n)] = CARRIERS[idOf(n)] || []).push(s);
}
/* the control ability for a species, given the one under test: quiet first, then fewest handlers,
 * and never one that would interfere with the staging */
function altAbility(sp, notId) {
  const opts = Object.values(sp.abilities || {}).filter(n => idOf(n) !== idOf(notId));
  const scored = opts.map(n => { const a = dex.abilities.get(idOf(n));
    const hs = Object.keys(a).filter(k => /^on/.test(k) && typeof a[k] === 'function');
    return { name: n, quiet: QUIET_SET.has(a.id), n: hs.length }; })
    .sort((x, y) => (y.quiet - x.quiet) || (x.n - y.n));
  return scored.length ? scored[0].name : null;
}
function carrierFor(ab) {
  const list = CARRIERS[ab.id] || [];
  const plain = list.filter(s => !s.battleOnly);
  /* bulk first, so a staged hit is a reading rather than a KO */
  const bulk = s => s.baseStats.hp + s.baseStats.def + s.baseStats.spd;
  const withAlt = plain.filter(s => altAbility(s, ab.id)).sort((a, b) => bulk(b) - bulk(a));
  if (withAlt.length) return { tier: 'ALTERNATE', species: withAlt[0].id,
                               control: altAbility(withAlt[0], ab.id),
                               second: withAlt[1] ? withAlt[1].id : null };
  if (plain.length) return { tier: 'SUPPRESS', species: plain.sort((a, b) => bulk(b) - bulk(a))[0].id,
                             control: null };
  const mg = list.filter(s => MEGA_OF[s.id]);
  if (mg.length) return { tier: 'MEGA', species: MEGA_OF[mg[0].id].base, forme: mg[0].id,
                          stone: MEGA_OF[mg[0].id].item, control: null };
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
  } else if (sc.kind === 'ability' && sc.controlKind === 'suppress') {
    /* THE ONE CARRIER SHAPE THAT HAS NO SECOND ABILITY. Mimikyu's only ability is Disguise, Morpeko's
     * only ability is Hunger Switch, and a MEGA forme's ability is written by the forme change — so
     * "replace the ability" is not available and `buildPair` would silently hand back slot 0 anyway.
     * The control instead SUPPRESSES it: the foe clicks Gastro Acid at the carrier on the opening
     * turn, and everything the carrier does afterwards is the delta.
     *
     * THIS IS ONLY USABLE BECAUSE IT IS PROVEN FIRST. `selftest()` stages one ability BOTH WAYS —
     * control-by-alternate-ability and control-by-Gastro-Acid — and requires the two to move the same
     * board leaves in BOTH engines. If Gastro Acid did not suppress in this simulator, every entity
     * controlled this way would read DID-NOT-FIRE and the whole tier would be a fabrication. */
    c.script[0].p1[0] = { m: 'gastroacid', t: +sc.subject[1] };
    c.A[0] = { ...c.A[0], moves: c.A[0].moves.concat(['gastroacid']) };
  } else if (sc.kind === 'ability') {
    /* THE ABILITY IS REMOVED FROM THE WHOLE SIDE, not from one slot. A residual scenario may put a
     * SECOND carrier of the same ability on the bench to test the entry gate, and if the control arm
     * left that one alone its contribution would appear in BOTH arms and cancel out of the delta —
     * the entrant's half of the test would silently disappear. Every body on the subject's side whose
     * ability is the one under test gets its own species-legal alternate. */
    let swapped = 0;
    for (const b of c[sideKey]) {
      if (idOf(b.ability) !== idOf(sc.abilityId)) continue;
      const alt = altAbility(dex.species.get(b.species), sc.abilityId);
      if (!alt) continue;
      b.ability = alt; swapped++;
    }
    if (!swapped) body.ability = sc.controlAbility;
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

/* ---- THE DECLARED DIVERGENCES ------------------------------------------------------------------
 *
 * A difference this instrument sees on EVERY scenario of a given shape, for a reason that is not the
 * entity under test. The default is that any difference fails; a declared one is quietened, COUNTED,
 * and printed on every run — and a declaration that matches NOTHING is reported as stale, because a
 * deliberate exception that is no longer there is a claim that has quietly become false.
 *
 * THERE ARE NONE, AND THE EMPTY LIST IS THE RESULT RATHER THAN AN OMISSION. One was written and then
 * RETRACTED BY ITS OWN STALENESS CHECK, which is worth leaving on the record because it is the whole
 * argument for having the check:
 *
 *   RETRACTED — "the held item on a body that has FAINTED". The Iron Ball entry printed `Charizard is
 *   holding nothing` against `Charizard is holding Iron Ball`, and the obvious reading was that
 *   Showdown clears an item on faint while medicham2 leaves it on the corpse. The declaration was
 *   added, matched ZERO leaves on the very next run, and the boards said why: Showdown's slot did not
 *   hold a dead Charizard at all. It held a LIVE MILOTIC. Iron Ball had slowed Charizard, Glimmora
 *   killed it, a replacement walked in — and the `item` difference was the last visible echo of the
 *   real finding rather than a representation quirk. A declaration written from a report instead of
 *   from the boards would have quietened part of a genuine defect on every KO scenario in the file.
 *
 * The machinery stays because the abilities and moves stages will need it, and because a mechanism
 * that can only be added under a red staleness check is a mechanism that cannot rot. */
const DECLARED = [];
let DECLARED_HITS = DECLARED.map(() => 0);
function splitDeclared(diffs, boards) {
  const kept = [], quiet = [];
  for (const d of diffs) {
    const board = (boards || []).find(b => b.turn === d.turn);
    const k = DECLARED.findIndex(x => x.test(d, board));
    if (k >= 0) { DECLARED_HITS[k]++; quiet.push({ d, k }); } else kept.push(d);
  }
  return { kept, quiet };
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
  const subjDiffs = splitDeclared(subject.boards.flatMap(b => b.diffs.map(d => ({ ...d, turn: b.turn }))),
                                  subject.boards).kept;
  const ctrlDiffs = splitDeclared(control.boards.flatMap(b => b.diffs.map(d => ({ ...d, turn: b.turn }))),
                                  control.boards).kept;

  /* WHAT THE ENTITY IS ACTUALLY ANSWERABLE FOR. A difference that appears in the CONTROL arm too — on
   * the same turn and the same leaf — is a property of the shared fixture and not of the entity, and
   * blaming the entity for it is the "fix aimed at the wrong mechanism" failure written down in
   * CLAUDE.md. MEASURED: Pecha Berry reported four Speed-stage differences, all of them Toxic Thread's
   * stat drop failing to land in this engine, on a berry that has nothing to do with Speed.
   *
   * THE SHARED DIFFERENCE IS NOT DISCARDED. It is real, it is collected, and it is reported in its own
   * block at the end — attributed to the fixture rather than to any entity, which is the only honest
   * place for it. The cost is stated: an entity whose own effect lands on exactly the same leaf as a
   * shared defect would be masked here. */
  const ctrlKeys = new Set(ctrlDiffs.map(d => d.turn + '|' + d.path));
  const mine = subjDiffs.filter(d => !ctrlKeys.has(d.turn + '|' + d.path));
  const shared = subjDiffs.filter(d => ctrlKeys.has(d.turn + '|' + d.path));

  const base = { ...e, boards: subject.boards, sd_delta: sdMoved, us_delta: usMoved,
                 subject_diffs: mine, shared_diffs: shared, control_diffs: ctrlDiffs, ignore,
                 compared: subject.boards.reduce((n, b) => n + b.compared, 0) };

  if (!sdMoved.length) return { ...base, verdict: 'COULD-NOT-STAGE',
    why: 'THE STAGING IS INERT. Showdown\'s own board is identical with and without it, over '
       + base.compared + ' compared leaves — so nothing here tests the entity and a green would have '
       + 'been vacuous. This is the honest coverage limit, not a pass.' };
  if (!usMoved.length) return { ...base, verdict: 'DID-NOT-FIRE',
    why: 'Showdown\'s board MOVED when the entity was added and ours did not move at all. The staging '
       + 'is known-good because the authority answered it.' };
  if (!mine.length) return { ...base, verdict: 'FIRED-AND-BOARDS-MATCH' };
  return { ...base, verdict: 'FIRED-AND-BOARDS-DIFFER' };
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

/* A PHYSICAL CONTACT HIT PER TYPE. The generic ability staging needs CONTACT specifically — Rough
 * Skin, Static, Flame Body, Mummy, Wandering Spirit, Pickpocket, Gooey, Tangling Hair, Cursed Body
 * and Iron Barbs all read the flag and none of them fires without it. */
const CONTACT = {};
for (const t of Object.keys(DELIVERY))
  if (DELIVERY[t].physical && DELIVERY[t].physical.flags.contact) CONTACT[t] = DELIVERY[t].physical;
function neutralContactOn(speciesId) {
  const s = dex.species.get(speciesId);
  for (const t of Object.keys(CONTACT)) {
    if (dex.getImmunity(t, s.types) === false) continue;
    if (dex.getEffectiveness(t, s.types) !== 0) continue;
    return CONTACT[t];
  }
  return null;
}

/* ONE BUILDER FOR EVERY ABILITY SCENARIO. The four kinds differ in the SCRIPT and in nothing else,
 * because the interesting variable for an ability is WHEN it acts and the boundary is what reads it.
 * The carrier, the control and the tier come from `carrierFor`. */
function abilityScenario(e, C, kind) {
  if (!C) return cannot('no legal species in this format carries it');
  const base = dex.species.get(C.species);
  if (!base || !base.exists) return cannot('the carrier species "' + C.species + '" is not in the '
    + 'format dex');
  const atk = dex.species.get(CAST.ATTACKER().species);
  const hitThem = neutralContactOn(C.tier === 'MEGA' ? (C.forme || C.species) : C.species);
  const hitUs = neutralContactOn(atk.id);
  if (!hitThem || !hitUs) return cannot('no neutral 100-accuracy physical CONTACT move exists in '
    + 'both directions between the aggressor and ' + C.species + ', and contact is what most of this '
    + 'family reads');

  /* THE CARRIER THROWS A STAB MOVE WHERE IT CAN. A neutral off-type click reaches a contact reaction
   * and a defensive modifier and NOTHING ELSE — Adaptability, Technician, Tough Claws, Sheer Force,
   * Iron Fist, Strong Jaw and every other offensive family needs the carrier's own click to be the
   * kind of move they read. Measured: with an off-type click, Adaptability came back INERT. */
  const carrierHit = (() => {
    const own = (C.tier === 'MEGA' ? dex.species.get(C.forme) : base).types;
    for (const t of own) {
      const mv = CONTACT[t] || (DELIVERY[t] && DELIVERY[t].best);
      if (mv && dex.getImmunity(mv.type, atk.types) !== false) return mv;
    }
    return hitUs;
  })();
  const stone = C.tier === 'MEGA' ? C.stone : '';
  const carrier = mon(base.id, stone, C.tier === 'MEGA' ? '' : dex.abilities.get(e.id).name,
                      [hitThem.id]);
  const partner = (() => {
    const alt = CANDIDATES.find(s => s.id !== base.id && s.id !== atk.id
      && neutralContactOn(s.id) && idOf(s.id) !== idOf(CAST.BAG().species));
    const sp = alt || dex.species.get('snorlax');
    return mon(sp.id, '', carrierAbility(sp) || '', [hitThem.id, 'uturn']);
  })();

  /* THE STAGED HP INFLATION AND A MEGA EVOLUTION CANNOT BOTH BE IN THE SAME SCENARIO, and this was
   * measured rather than reasoned: Aerilate reported `Pinsir-Mega has 140 maximum HP` against `840`
   * on every board. `alignStats` writes the inflated pool onto the Showdown body BEFORE the battle
   * starts, and Showdown then RECOMPUTES maxhp from the mega forme's own base stats when the forme
   * changes — dropping the inflation — while medicham2's `megaEvolveNow` carries the delta across and
   * keeps it. Neither engine is wrong; the harness asked them a question with two answers. The MEGA
   * tier therefore runs at natural HP, and the cost is that a hit there can saturate. */
  let script, hpA = C.tier === 'MEGA' ? 1 : 6, hpB = C.tier === 'MEGA' ? 1 : 6;
  if (kind === 'entry') {
    /* boundary 0 IS the positive; the two turns after it are the negative */
    hpA = 1; hpB = 1;
    script = [turn([IDLE, IDLE], [IDLE, IDLE]), turn([IDLE, IDLE], [IDLE, IDLE])];
  } else if (kind === 'residual') {
    hpA = 1; hpB = 1;
    script = [turn([IDLE, IDLE], [IDLE, IDLE]), turn([IDLE, IDLE], [IDLE, IDLE]),
              turn([IDLE, IDLE], [IDLE, IDLE])];
  } else if (kind === 'switchout') {
    hpB = 4;
    script = [turn([click(hitThem.id, 0), click(hitThem.id, 1)], [IDLE, IDLE]),
              turn([IDLE, IDLE], [click('uturn', 0), click('uturn', 0)])];
  } else {
    script = [turn([click(hitThem.id, 0), IDLE], [click(carrierHit.id, 0), IDLE]),
              turn([click(hitThem.id, 0), IDLE], [click(carrierHit.id, 0), IDLE]),
              turn([IDLE, IDLE], [IDLE, IDLE])];
  }
  if (kind === 'switchout') carrier.moves.push('uturn');
  if (kind === 'generic') carrier.moves = [carrierHit.id];

  /* THE SETUP TURN, for the two tiers whose control is a CLICK rather than a swapped ability. The
   * aggressor has to be free on that turn so the control arm can spend it on Gastro Acid, and the
   * MEGA tier spends the same turn asking to evolve — Showdown resolves the mega at queue order 104
   * and every move at 200, so a Gastro Acid on the same turn lands on the body the forme change has
   * already produced. */
  const suppress = C.tier === 'SUPPRESS' || C.tier === 'MEGA';
  if (suppress) {
    script = [turn([IDLE, IDLE], [C.tier === 'MEGA' ? { m: INERT, mega: true } : IDLE, IDLE])]
      .concat(script);
  }
  const sc = scaffold({ hpA, hpB, subject: 'B0',
    a0: mon(atk.id, '', CAST.ATTACKER().ability, [hitThem.id]),
    a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [hitThem.id]),
    b0: carrier, b1: partner, script });
  sc.controlAbility = C.control;
  sc.controlKind = suppress ? 'suppress' : 'ability';
  sc.abilityId = e.id;
  return { note: C.tier + ' carrier ' + base.name
      + (C.tier === 'MEGA' ? ' -> ' + pretty(C.forme) + ' via ' + pretty(C.stone) : '')
      + '; control = ' + (suppress ? 'Gastro Acid suppression' : C.control)
      + '; staged as ' + kind, scenario: sc, tier: C.tier };
}

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
    /* THE 4x ARM, AND IT IS THE HALF WHERE THE BERRY DECIDES A GAME RATHER THAN SHAVING DAMAGE.
     * (Will, 2026-08-08.) Where the format contains a body the type chart puts at 4x AND the unhalved
     * hit would KILL it while the halved one would not, that body is preferred over a 2x one — so the
     * difference the control arm reports is A FLIPPED KO rather than a damage delta.
     *
     * WHY THIS INSTRUMENT IS SAFE FROM THE TRAP THAT COMES WITH IT. A ratio test on a 4x hit reads
     * WRONG WHEN IT IS RIGHT: the authority CLAMPS recorded HP loss at the target's maximum, so
     * Conkeldurr's Drain Punch into a Chople Kingambit reads 114 of 175 against 175 of 175 and the
     * naive ratio is 0.651 when the true damage is 228 and the halving is exact. THIS FILE NEVER
     * COMPUTES A RATIO. It compares BOARDS, and the boards say `fainted` and `species` — a fact the
     * cap cannot distort. Anyone adding a ratio assertion here will "fix" a correct engine.
     *
     * The 4x pairs are SWEPT, not hand-picked: every legal species whose type combination the chart
     * puts at 4x for the berry's own `naturalGift.type`. A berry with no legal 4x carrier keeps the 2x
     * staging and the report says which arm it ran.
     *
     * PROTOCOL NOTE, RECORDED HERE BECAUSE IT WILL BITE SOMETHING THAT READS THE STREAM: one berry
     * emits TWO `-enditem` lines, `[eat]` and `[weaken]`. Anything counting berry consumption off the
     * protocol would double-count. This instrument reads live state and is unaffected. */
    const W = WEAK_TO[T] || [];
    const four = (FOUR_X[T] || []).find(x => x.flipsAKO);
    const holders = four ? [four, (W[0] && W[0].species !== four.species) ? W[0] : (W[1] || null)]
      : (W.length >= 2 ? [W[0], W[1]]
      : [{ species: CAST.BAG().species, ability: CAST.BAG().ability },
         { species: 'snorlax', ability: carrierAbility(dex.species.get('snorlax')) }]);
    if (!holders[1]) return cannot('a 4x carrier for ' + T + ' exists (' + four.species + ') but no '
      + 'second body of a different species can stand beside it holding the same berry, and the '
      + 'inverted half of the test needs one');
    if (idOf(holders[0].species) === idOf(holders[1].species))
      return cannot('only one species in the format is x2 weak to ' + T + ' with a non-interfering '
        + 'ability, and the inverted half of this test needs a SECOND body on the same side');
    const off = neutralTypeOn(holders[1].species, T);
    if (!off) return cannot('no type is plainly neutral on ' + holders[1].species + ', so the inverted '
      + 'half of the test has nowhere to stand');
    return { note: (four ? '4x ARM — ' + four.species + ' (' + four.types + ') DIES to the unhalved '
          + T + ' hit (' + four.dmg + ' into ' + four.hp + ' HP) and survives it halved; the flipped '
          + 'KO is on the board as `fainted`, never as a ratio'
        : '2x arm — halves ' + T + ' on ' + holders[0].species
          + (FOUR_X[T] ? '; a 4x body exists but none flips a KO, so the ratio arm is what runs'
                       : '; NO legal 4x carrier for ' + T + ' exists in this format'))
        + '. The inverted half is a ' + off + ' hit on ' + holders[1].species
        + ', holding the same berry, on the same board',
      scenario: scaffold({ hpB: four ? 1 : 6,
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
    /* THE TARGET MUST NOT BE IMMUNE TO THE BOOSTED TYPE, and the punching bag is pure NORMAL — which
     * is immune to Ghost. Spell Tag therefore staged a click that dealt nothing at all and came back
     * "THE STAGING IS INERT", a fixture limit wearing a coverage limit's clothes. The target is now
     * derived per type: the bag when it can be hit, and otherwise the bulkiest body that takes the
     * type NEUTRALLY with a non-interfering ability. */
    const bagSp = dex.species.get(CAST.BAG().species);
    let tgt = { species: bagSp.id, ability: CAST.BAG().ability };
    if (dex.getImmunity(T, bagSp.types) === false) {
      const alt = CANDIDATES.filter(s => dex.getImmunity(T, s.types) !== false
          && dex.getEffectiveness(T, s.types) === 0)
        .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd)
                      - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd))[0];
      if (!alt) return cannot('the punching bag is immune to ' + T + ' and no legal body takes it '
        + 'neutrally with a non-interfering ability, so the boosted click cannot land');
      tgt = { species: alt.id, ability: carrierAbility(alt) };
    }
    const off = neutralTypeOn(tgt.species, T);
    if (!off) return cannot('no second type is neutral on ' + tgt.species + ', so the negative half '
      + 'of the test has nowhere to stand');
    return { note: T + ' x' + m[2] + ' into ' + tgt.species + '; the negative is a ' + off
        + ' click on turn 2',
      scenario: scaffold({ hpA: 6, hpB: 6, subject: 'A0',
        a0: mon(CAST.ATTACKER().species, e.id, CAST.ATTACKER().ability,
                [hitOfType(T).id, hitOfType(off).id]),
        b0: mon(tgt.species, '', tgt.ability, [INERT]),
        script: [turn([click(hitOfType(T).id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(hitOfType(off).id, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/category-scoped-power', kind: 'item',
  reads: 'onBasePower + shortDesc "Holder\'s physical|special attacks have <n>x power"',
  why: 'the same shape one axis over: the scope is a damage CATEGORY rather than a type. Turn 1 is a '
     + 'click of that category and turn 2 is a click of the other one, so a multiplier that leaked '
     + 'across the category parts on the second turn.',
  /* THE ANCHOR IS A NAME CHECK, AND THAT IS WORTH RECORDING RATHER THAN TIDYING. Every other item
   * multiplier in this simulator comes out of `data/tags.json` by SHAPE; this one is
   * `if (att.item === 'muscleband' && phys)` written twice by hand — and `tags.json` carries no
   * damage tag for either member, only `flingable`. So the mechanic is live and is the one place in
   * this family that a new Gen-10 category item would not be picked up by. Reported, not fixed: the
   * simulator belongs to whoever is holding it. */
  break: { why: 'the category-scoped base-power multiplier is dropped (it is a hardcoded NAME check '
              + 'in the simulator, not a tag read — see the rule comment)',
    patch: [["if(att.item==='muscleband'&&phys)BPCH([4505,4096]);",
             "if(false&&att.item==='muscleband'&&phys)BPCH([4505,4096]);"]] },
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
    if (!HALVER) return cannot('no legal body in the format is taken past half its HP — and not '
      + 'killed — by a single derived delivery move, so the threshold cannot be crossed in one blow');
    return { note: HALVER.move.name + ' takes ' + HALVER.species + ' to '
        + Math.round((1 - HALVER.frac) * 100) + '% in one blow, twice',
      scenario: scaffold({
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [HALVER.move.id]),
        b0: mon(HALVER.species, e.id, HALVER.ability, [INERT]),
        script: [turn([click(HALVER.move.id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(HALVER.move.id, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/pp-restore', kind: 'item',
  reads: 'shortDesc naming PP',
  why: '`board_state.js` publishes PP in NOT_COMPARED with its reason — medicham2 does not track PP '
     + 'at all — so a PP restore has no leaf to appear on. This rule exists so the entity gets that '
     + 'as its reason rather than falling through to the generic staging and reading "inert", which '
     + 'would be true and useless.',
  match(e) { if (!/\bPP\b/.test(e.shortDesc || '')) return null;
    return cannot('its whole effect is on PP, and board_state.js does not compare PP in either '
      + 'engine (medicham2 does not track it at all), so there is no board leaf it could move'); } },

{ id: 'item/status-cure', kind: 'item',
  reads: 'onUpdate + shortDesc "cured if it is <status>" / "wakes up" / "confused" / "cures itself"',
  why: 'the condition the berry cures is inflicted by a 100-ACCURACY carrier derived from the dex, '
     + 'and the berry has to answer at the end of that same turn. THE PARTNER IS THE NEGATIVE: it '
     + 'takes the identical condition holding nothing and must still be carrying it on every later '
     + 'board. CONFUSION IS INCLUDED because `board_state.js` compares `vol.confusion` as a counter, '
     + 'which is what makes Persim expressible at all.',
  break: { why: 'the status cure is skipped — the berry is still held',
    patch: [["const _cs=TAGS.param('item',m.item,'curesStatus');",
             "const _cs=null&&TAGS.param('item',m.item,'curesStatus');"]] },
  match(e) {
    if (!e.onUpdate || !e.isBerry) return null;
    const S = /frozen/i.test(e.shortDesc) ? 'frz' : /paralyz/i.test(e.shortDesc) ? 'par'
            : /asleep|wakes up/i.test(e.shortDesc) ? 'slp' : /poison/i.test(e.shortDesc) ? 'psn'
            : /burn/i.test(e.shortDesc) ? 'brn'
            : /confus/i.test(e.shortDesc) ? 'confusion'
            : /non-volatile status/i.test(e.shortDesc) ? 'par' : null;
    if (!S) return null;
    const mv = S === 'confusion' ? CONFUSE_MOVE : STATUS_MOVE[S];
    if (!mv) return cannot('no 100-accuracy move in this format inflicts ' + S + ' outright, and the '
      + 'pin makes every sub-100-accuracy move miss — so the condition this berry cures cannot be '
      + 'put on a body at all. THE ITEM IS NOT ABSENT FROM THE ENGINE; IT IS UNREACHABLE FROM HERE.');
    const bag = bodyNotImmuneTo(mv.type);
    if (!bag) return cannot('the only 100-accuracy carrier of ' + S + ' is ' + mv.name + ', and no '
      + 'legal body with a non-interfering ability takes that type neutrally');
    const partner = bodyNotImmuneTo(mv.type, 'snorlax', bag.species);
    if (!partner || partner.species === bag.species)
      return cannot('no second body distinct from ' + bag.species + ' can take ' + mv.name
        + ', so the on-board negative has nowhere to stand');
    return { note: S + ' delivered by ' + mv.name + ' onto ' + bag.species,
      scenario: scaffold({
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [mv.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [mv.id]),
        b0: mon(bag.species, e.id, bag.ability, [INERT]),
        b1: mon(partner.species, '', partner.ability, [INERT]),
        script: [turn([click(mv.id, 0), click(mv.id, 1)], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'item/drain-scaled', kind: 'item',
  reads: 'onTryHeal + shortDesc "draining"',
  why: 'the holder is chipped so a heal has somewhere to go, then clicks a 100-accuracy DRAIN move — '
     + 'the only delivery that produces a heal proportional to damage dealt. THE PARTNER IS THE '
     + 'NEGATIVE and drains on the same turn holding nothing.',
  noBreak: 'THERE IS NOTHING IN THE SIMULATOR TO BREAK. `data/tags.json` gives the only member of '
         + 'this family (Big Root) the single tag `flingable`, and no code path scales a drain heal '
         + 'off a held item. The DID-NOT-FIRE verdict is the evidence; an invented anchor would not '
         + 'be, and the declaration is checked — if any member of this rule ever FIRES, the run says '
         + 'the claim is false and an anchor is owed.',
  match(e) {
    if (!e.onTryHeal || !/drain/i.test(e.shortDesc || '')) return null;
    if (!DRAIN_MOVE) return cannot('no 100-accuracy single-target draining move exists in this format');
    const bag = dex.species.get(CAST.BAG().species);
    if (dex.getImmunity(DRAIN_MOVE.type, bag.types) === false)
      return cannot('the only 100-accuracy drain carrier is ' + DRAIN_MOVE.name + ', which the '
        + 'punching bag is immune to');
    const nu = Object.keys(DELIVERY).map(hitOfType).find(mv => mv
      && dex.getEffectiveness(mv.type, bag.types) === 0 && dex.getImmunity(mv.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists to chip the holder first');
    return { note: 'chipped, then draining with ' + DRAIN_MOVE.name,
      scenario: scaffold({ hpA: 8, hpB: 4,
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [nu.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [nu.id]),
        b0: mon(bag.id, e.id, CAST.BAG().ability, [DRAIN_MOVE.id]),
        b1: mon('snorlax', '', carrierAbility(dex.species.get('snorlax')) || '', [DRAIN_MOVE.id]),
        script: [turn([click(nu.id, 0), click(nu.id, 1)], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [click(DRAIN_MOVE.id, 0), click(DRAIN_MOVE.id, 0)]),
                 turn([IDLE, IDLE], [click(DRAIN_MOVE.id, 0), click(DRAIN_MOVE.id, 0)])] }) };
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
    const found = names.map(n => dex.moves.get(idOf(n))).filter(x => x && x.exists);
    /* A MOVE WITH ITS OWN PRECONDITION IS THE WRONG DELIVERY. Light Clay names "Aurora Veil, Light
     * Screen, or Reflect" and the first version took the first of them — Aurora Veil, which FAILS
     * outright unless snow is up, so the item read "THE STAGING IS INERT" on a screen extender that
     * works. Anything carrying an `onTry` gate is skipped in favour of a sibling that has none. */
    const mv = found.find(x => !x.onTry && !x.onTryHit && !x.onTryHitSide) || found[0];
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
  /* THE FIRST ANCHOR FOR THIS RULE WAS THE WRONG LINE AND THE RED DEMONSTRATION SAID SO. It patched
   * `if (TAGS.has(kind,key,'accuracyMod') ...)`, which reads like the mechanism and is in fact only
   * the UNTABLED-CARRIER WARNING beside it; the modifier itself comes out of the engine's `ACCMOD`
   * table one line above. The break applied cleanly and moved no board — which is exactly the signal
   * `--reds` exists to give, and is why an anchor is never trusted for looking plausible. */
  break: { why: 'the accuracy modifier row is dropped, so every holder reads as untabled',
    patch: [['  if(row)return row.off?null:row;', '  if(row)return null;']] },
  match(e) {
    if (!e.onModifyAccuracy && !e.onSourceModifyAccuracy) return null;
    const m = /([\d.]+)x/.exec(e.shortDesc || '');
    const mult = m ? +m[1] : null;
    if (!mult) return cannot('the item modifies accuracy and its own description does not say by how '
      + 'much, so the delivery move whose roll it flips cannot be derived: ' + e.shortDesc);
    const bag = dex.species.get(CAST.BAG().species);
    /* THE DELIVERY MOVE IS CHOSEN SO THE MULTIPLIER FLIPS THE ROLL, WHICH IS WHY THE DIRECTION
     * MATTERS. Under the pin a move hits when its final accuracy reaches 100 and misses otherwise.
     *   mult < 1   a 100-accuracy move is dragged under 100 and becomes a guaranteed MISS
     *   mult > 1   a 100-accuracy move has NOTHING TO GAIN — which is why Wide Lens and Zoom Lens
     *              first came back "THE STAGING IS INERT", a fixture limit rather than a coverage
     *              one. The right carrier is a move whose accuracy is BELOW 100 and at or above
     *              100/mult, so the item turns a guaranteed miss into a guaranteed hit. The click
     *              declares `mayMiss`, because there the losing roll IS the mechanic. */
    /* THE MOVE IS CHOSEN FIRST AND THE BODIES SECOND, AND THAT ORDER IS WHY IMMUNITY HAS TO BE ASKED
     * ABOUT EXPLICITLY. The aggressor is Dragon/Ghost and the punching bag is pure Normal, so each is
     * immune to something the other can throw. The first version of this rule had the bag click a
     * 95-accuracy CRUSH CLAW — a Normal move — at a GHOST, and the log read `|-immune|` on every turn
     * while the entry reported "THE STAGING IS INERT". */
    const atk = dex.species.get(CAST.ATTACKER().species);
    if (mult < 1) {
      /* DEFENSIVE: the holder is HIT, and a 100-accuracy move dragged under 100 must MISS. */
      const mv = Object.keys(DELIVERY).map(hitOfType).find(x => x
        && dex.getEffectiveness(x.type, bag.types) === 0 && dex.getImmunity(x.type, bag.types) !== false);
      if (!mv) return cannot('no neutral 100-accuracy delivery move exists against the punching bag');
      return { note: 'a 100-accuracy ' + mv.name + ' dragged under 100 by x' + mult + ' must MISS',
        scenario: scaffold({ hpA: 6, hpB: 6,
          a0: mon(atk.id, '', CAST.ATTACKER().ability, [mv.id]),
          b0: mon(bag.id, e.id, CAST.BAG().ability, [INERT]),
          script: [turn([click(mv.id, 0), IDLE], [IDLE, IDLE]),
                   turn([click(mv.id, 0), IDLE], [IDLE, IDLE])] }) };
    }
    /* OFFENSIVE: a move already below 100 is lifted to 100 or past it, so it must HIT where the pin
     * would otherwise have made it miss. The AGGRESSOR is the target here and moves FIRST every turn,
     * which is also what a "1.2x if it moves after its target" item needs to be active at all. */
    const floor = 100 / mult;
    const mv = dex.moves.all().filter(x => deliveryOf(x, { allowInaccurate: true })
        && typeof x.accuracy === 'number' && x.accuracy < 100 && x.accuracy >= floor
        && dex.getImmunity(x.type, atk.types) !== false)
      .sort((a, b) => b.accuracy - a.accuracy || b.basePower - a.basePower)[0] || null;
    if (!mv) return cannot('no move exists whose roll a x' + mult + ' accuracy multiplier flips under '
      + 'the pin: it needs an accuracy between ' + Math.ceil(floor) + ' and 99, no raised crit ratio '
      + '(the control click adds two stages), and a type the aggressor is not immune to');
    const nu = Object.keys(DELIVERY).map(hitOfType).find(x => x
      && dex.getEffectiveness(x.type, bag.types) === 0 && dex.getImmunity(x.type, bag.types) !== false);
    if (!nu) return cannot('no neutral 100-accuracy delivery move exists for the aggressor to move '
      + 'FIRST with, which a "moves after its target" item needs in order to be active at all');
    const cl = { m: mv.id, t: 0, mayMiss: 'THE ACCURACY ROLL IS THE MECHANIC — this click is chosen '
      + 'BECAUSE the pin makes it miss without the item and hit with it' };
    return { note: 'a ' + mv.accuracy + '-accuracy ' + mv.name + ' lifted to '
        + Math.round(mv.accuracy * mult) + ' by x' + mult + ' must HIT, where the pin would otherwise '
        + 'have made it miss',
      scenario: scaffold({ hpA: 6, hpB: 6,
        a0: mon(atk.id, '', CAST.ATTACKER().ability, [nu.id]),
        b0: mon(bag.id, e.id, CAST.BAG().ability, [mv.id]),
        script: [turn([click(nu.id, 0), IDLE], [cl, IDLE]),
                 turn([click(nu.id, 0), IDLE], [cl, IDLE])] }) };
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
    /* THE DROP HAS TO BE NOTHING BUT A DROP, and the first version of this was not. It took the first
     * 100-accuracy single-target move with a negative boost, which is TOXIC THREAD — a Speed drop
     * bundled with a poison. This engine does not apply that move's drop at all, so the herb had
     * nothing to restore and the entry came back DID-NOT-FIRE against WHITE HERB, which is wired and
     * correct. A finding aimed at the wrong mechanism is still a bug; the carrier is now required to
     * carry nothing but the stage change. */
    const drop = dex.moves.all().find(m => m.exists && !m.isNonstandard && m.category === 'Status'
      && m.target === 'normal' && (m.accuracy === true || m.accuracy === 100)
      && m.boosts && Object.values(m.boosts).some(v => v < 0)
      && !m.status && !m.volatileStatus && !m.heal && !m.sideCondition && !m.self
      && !Object.keys(m).some(k => /^on/.test(k) && typeof m[k] === 'function'));
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
  noBreak: 'THERE IS NOTHING IN THE SIMULATOR TO BREAK. `data/tags.json` gives the only member of '
         + 'this family (Shell Bell) the single tag `flingable`, and no code path reads a heal off a '
         + 'held item after an attack. An anchor here would have to be invented, and a break that '
         + 'cannot be aimed at real code is not a demonstration. The DID-NOT-FIRE verdict is the '
         + 'evidence, and it is stronger than a plant.',
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
  noBreak: 'THERE IS NOTHING IN THE SIMULATOR TO BREAK. `data/tags.json` gives the only member of '
         + 'this family (Light Ball) the single tag `flingable`, and no code path multiplies a stat '
         + 'for a named species. Same argument as the heal-on-attack rule: the DID-NOT-FIRE verdict '
         + 'is the evidence and an invented anchor would not be.',
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

/* -------------------------------------------------------------------------- abilities ----------- */

{ id: 'ability/no-legal-carrier', kind: 'ability',
  reads: 'the format\'s own species list',
  why: 'THE LARGEST SINGLE FACT IN THIS STAGE, AND IT IS ABOUT THE REGULATION RATHER THAN ABOUT THIS '
     + 'FILE. Showdown marks the ability standard and marks every body that has it '
     + '`isNonstandard: "Past"` — Storm Drain\'s carriers are Gastrodon, Cradily and Maractus and all '
     + 'three are Past here. There is no legal body to put it on, so nothing can be staged, and no '
     + 'amount of instrument work changes that.',
  match(e) { if (carrierFor(e)) return null;
    const all = (CARRIERS[e.id] || []).map(s => s.id);
    return cannot('NO LEGAL SPECIES IN ' + CS.FORMAT + ' CARRIES IT'
      + (all.length ? ' in a form this file can put on the field (' + all.join(', ') + ')'
                    : ' — every body that has it is isNonstandard in this format')
      + '. This is a property of the REGULATION, not of the simulator and not of this instrument.'); } },

{ id: 'ability/chance-gated', kind: 'ability',
  reads: 'shortDesc — a percentage that is not 100',
  why: 'same argument as the item tier: the pin fixes every die to the corner where no sub-100% roll '
     + 'succeeds, so an ability whose whole content is such a chance would stage two agreeing boards '
     + 'on which nothing happened.',
  match(e) { const m = /(\d+)% chance/.exec(e.shortDesc || '');
    if (!m || +m[1] >= 100) return null;
    return cannot('its effect is a ' + m[1] + '% chance, and the driver\'s pin makes every sub-100% '
      + 'roll fail in both engines. Nothing staged here could tell a wired mechanic from an absent '
      + 'one.'); } },

{ id: 'ability/entry', kind: 'ability',
  reads: 'onStart / onSwitchIn, with no onResidual',
  why: 'THE MOMENT IS THE MECHANIC. An entry ability has already acted by BOUNDARY 0 — before anybody '
     + 'chooses — so the board taken as the leads stand is the whole positive case. THE NEGATIVE IS '
     + 'THE TWO BOUNDARIES AFTER IT: an entry effect that ticked every turn would show a second and a '
     + 'third application there, which is exactly the defect this session already found in the other '
     + 'direction on Speed Boost.',
  break: { why: 'the entry stat drop is skipped — the ability is still on the body and still named. '
              + 'It is aimed at one MEMBER of the family, so a rule that catches it has proved the '
              + 'entry path is live rather than that every entry ability is',
    patch: [["const _osd=TAGS.param('ability',m.ability,'onSwitchInDrop');",
             "const _osd=null&&TAGS.param('ability',m.ability,'onSwitchInDrop');"]] },
  match(e) {
    if (!(e.onStart || e.onSwitchIn) || e.onResidual) return null;
    const C = carrierFor(e);
    if (C.tier !== 'ALTERNATE') return cannot('it is an ENTRY ability on a ' + C.tier + '-tier carrier'
      + ', and the only control available there is Gastro Acid — which is a CLICK, and a click cannot '
      + 'come before boundary 0. The positive and the control would be different experiments.');
    return abilityScenario(e, C, 'entry');
  } },

{ id: 'ability/residual', kind: 'ability',
  reads: 'onResidual',
  why: 'AGAIN THE MOMENT, and this family is where this engine has already been wrong twice. The '
     + 'carrier stands for three quiet turns, so the board carries the effect ONCE PER BOUNDARY and '
     + 'an off-by-one in the schedule parts on the first of them. WHERE A SECOND LEGAL SPECIES CARRIES '
     + 'THE SAME ABILITY it is put on the bench and walked in MID-TURN behind a pivot: Showdown gates '
     + 'this class on `activeTurns`, which a body that arrived this turn reads as 0, so the entrant '
     + 'must gain NOTHING at the end of the turn it walked in on while the lead beside it gains its '
     + 'normal share. That is the Speed Boost defect and the Hunger Switch one, staged as a rule '
     + 'rather than as a scenario.',
  break: { why: 'the per-turn boost fires UNCONDITIONALLY — the entry gate is removed, which is the '
              + 'exact defect this family was written against',
    patch: [['if(_be&&_be.boosts&&m.boosts&&!m._newlySwitched)for(const k in _be.boosts){',
             'if(_be&&_be.boosts&&m.boosts)for(const k in _be.boosts){']] },
  match(e) { if (!e.onResidual) return null;
    return abilityScenario(e, carrierFor(e), 'residual'); } },

{ id: 'ability/switch-out', kind: 'ability',
  reads: 'onSwitchOut',
  why: 'the carrier is chipped and then pivots off the field, and the effect is read off the PARTY '
     + 'row because by the boundary the body is on the bench. THE PARTNER IS THE NEGATIVE and pivots '
     + 'on the same turn without the ability.',
  break: { why: 'the switch-out heal is skipped',
    patch: [["{const _hs=TAGS.param('ability',out.ability,'healsOnSwitchOut');",
             "{const _hs=null&&TAGS.param('ability',out.ability,'healsOnSwitchOut');"]] },
  match(e) { if (!e.onSwitchOut) return null;
    return abilityScenario(e, carrierFor(e), 'switchout'); } },

{ id: 'ability/generic', kind: 'ability',
  reads: 'nothing matched above — this is the residue',
  why: 'THE FALLBACK, AND IT IS DELIBERATELY BROAD RATHER THAN DELIBERATELY WEAK. The carrier leads, '
     + 'takes a neutral PHYSICAL CONTACT hit, throws one back, and stands through three residual '
     + 'phases — which between them reach a damage modifier on either side, a contact reaction, a '
     + 'type immunity, an absorb, a stat change on being hit and a forme change on being hit. If '
     + 'Showdown\'s own board moves, the comparison is real; if it does not, the entry says THE '
     + 'STAGING IS INERT, which is the honest answer and not a pass.',
  match(e) { return abilityScenario(e, carrierFor(e), 'generic'); } },

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

/* THE SECOND STATIC AUDIT, BESIDE `SB.fixtureAudit`. That one asks whether a click can miss; this one
 * asks whether a click can be turned into a GUARANTEED CRITICAL HIT by the control click sitting
 * beside it. Both are the same kind of check — a scenario that is not staging what its author thinks
 * — and both are cheap, so both run before any game. The exclusion also lives inside `deliveryOf`;
 * it is repeated here because a rule may pick a move by any route it likes and the hazard is the
 * CLICK, not the table. */
function critRatioAudit(list) {
  const bad = [];
  for (const sc of list) {
    for (const [side, team] of [['p1', sc.A], ['p2', sc.B]]) {
      sc.script.forEach((step, t) => (step[side] || []).forEach((a, i) => {
        if (!a) return;
        const mv = dex.moves.get(a.m);
        if (mv && mv.exists && (mv.critRatio > 1 || mv.willCrit)) bad.push(sc.id + ' turn ' + (t + 1) + ' '
          + side + '[' + i + ']: ' + mv.name + ' has critRatio ' + (mv.critRatio || 'willCrit')
          + ', and the control click ' + pretty(INERT) + ' adds ' + INERT_RAISES_CRIT_STAGES
          + ' stages — the pair reaches the tier Showdown rolls as randomChance(1,1), which CRITS '
          + 'EVERY TIME and no pin can stop. Measured: this reported Wide Lens and Zoom Lens as '
          + 'engine defects on a manufactured crit.');
      }));
    }
  }
  return bad;
}

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
               reads: hit.rule.reads, note: hit.m.note || '', tier: hit.m.tier || null, scenario: sc });
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
              : STAGE === 'moves' ? ['move'] : STAGE === 'all' ? ['item', 'ability', 'move'] : ['item'];
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
  const shells = staged.map(e => ({ id: e.scenario.id, A: e.scenario.A, B: e.scenario.B,
                                    script: e.scenario.script }));
  const fx = SB.fixtureAudit(shells).concat(critRatioAudit(shells));
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
    for (const r of results) if (r.ruleObj && r.verdict !== 'COULD-NOT-STAGE')
      (byRule[r.rule] = byRule[r.rule] || []).push(r);
    for (const rid of Object.keys(byRule)) {
      const rule = byRule[rid][0].ruleObj;
      /* A RULE MAY DECLARE THAT THERE IS NOTHING TO BREAK, and it is not the same as a rule with no
       * break. `noBreak` says the simulator has NO implementation of this family at all, so no anchor
       * exists to aim at — and every member coming back DID-NOT-FIRE is what proves it. That claim is
       * checked here rather than believed: if any member of such a rule FIRED, the declaration is
       * false and the run says so. Same discipline as a stale declared divergence. */
      if (rule.noBreak) {
        const fired = byRule[rid].filter(x => x.verdict !== 'DID-NOT-FIRE');
        redRows.push({ rule: rid, ok: fired.length === 0, declared: true,
          why: fired.length ? 'THE DECLARATION IS FALSE — it says the simulator has no implementation '
                 + 'of this family, and ' + fired.map(x => x.name + ' (' + x.verdict + ')').join(', ')
                 + ' says otherwise. An anchor is owed.'
               : rule.noBreak });
        continue;
      }
      if (!rule.break) continue;
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
        /* THE BOARDS THEMSELVES ARE PRINTED BESIDE THE DELTA, because "our board did not respond to
         * this entity" has a second possible cause and the delta alone cannot separate them: the
         * entity may be absent, OR SOMETHING UPSTREAM OF IT MAY NOT HAVE HAPPENED. Measured on the
         * first run: White Herb read DID-NOT-FIRE because the stat drop staged against it never
         * landed, and the herb is wired and correct. A DID-NOT-FIRE with no subject difference under
         * it is the clean case; one with a difference on ANOTHER field is a pointer upstream. */
        /* ONLY THE LEAVES THE ENTITY DOES NOT ALREADY ACCOUNT FOR. A DID-NOT-FIRE necessarily parts
         * on the leaves Showdown moved, and reprinting those as "as well" would put a confound
         * warning on every clean finding. What matters is a difference SOMEWHERE ELSE. */
        /* THE LEAF THE CONTROL ARM CANNOT SPEAK ABOUT counts as explained too. The subject's own
         * held-item leaf is excluded from the delta by construction — it differs by definition — so
         * without this it would be reported as an unexplained difference SOMEWHERE ELSE on every
         * item whose whole effect is being held. */
        const own = new Set((r.sd_delta || []).map(d => d.turn + '|' + d.path));
        for (const p of (r.ignore || [])) for (const b of (r.boards || [])) own.add(b.turn + '|' + p);
        const elsewhere = (r.subject_diffs || []).filter(d => !own.has(d.turn + '|' + d.path));
        if (elsewhere.length) {
          console.log('      AND THE TWO ENGINES PART SOMEWHERE ELSE TOO — read these FIRST, because '
            + 'a cause UPSTREAM of the entity produces this same verdict. Measured on the first run: '
            + 'White Herb read DID-NOT-FIRE because the stat drop staged against it never landed, and '
            + 'the herb is wired and correct:');
          for (const d of elsewhere.slice(0, 6))
            console.log('        turn ' + d.turn + '  SHOWDOWN ' + BS.explain(d, d.sd, pretty)
              + '  /  OURS ' + BS.explain(d, d.us, pretty));
        } else {
          console.log('      and the two engines part on NOTHING the entity does not already explain, '
            + 'so the entity itself is the whole difference.');
        }
      } else {
        for (const d of (r.subject_diffs || []).slice(0, 6)) {
          console.log('        SHOWDOWN  ' + BS.explain(d, d.sd, pretty));
          console.log('        OURS      ' + BS.explain(d, d.us, pretty)
            + '        [' + (d.slot || d.side || 'field') + ' ' + d.field + ' / ' + d.bucket + ']');
        }
        if ((r.shared_diffs || []).length) console.log('        (and ' + r.shared_diffs.length
          + ' further leaf/leaves part in the CONTROL arm too — reported under DIFFERENCES THE '
          + 'FIXTURE TRIPPED OVER, not charged to this entity)');
      }
    }
  }

  if (REDS) {
    console.log('\n  THE RED DEMONSTRATION, PER RULE — a rule whose break moves no board cannot express '
      + 'its own mechanic, and every green above it is vacuous:');
    for (const row of redRows) console.log('    '
      + (row.declared ? (row.ok ? 'NOTHING TO BREAK ' : 'FALSE DECLARATION ') : (row.ok ? 'CAUGHT   ' : 'NOT CAUGHT '))
      + row.rule
      + (row.moved ? '   via ' + row.moved.member + ' -> ' + row.moved.verdict + ' on '
                     + row.moved.fields.join(', ') : '\n        ' + row.why.replace(/\s+/g, ' ')));
  }

  /* THE DIFFERENCES THAT BELONG TO NO ENTITY. Collected rather than dropped: each is a real
   * disagreement between the two engines that the CONTROL arm shows as well, so it is a property of
   * the staging and not of the thing being staged. Reported once, with the entities whose scenarios
   * tripped over it, because a defect nobody can attribute is still a defect. */
  /* READ OFF THE CONTROL ARM, not the subject arm. The subject's copy of a shared leaf carries the
   * entity's effect mixed into it — Lum Berry's control shows the confusion counter failing to decay
   * while its subject shows the berry curing the confusion outright, and only the first of those is
   * attributable to nothing. */
  const sharedFam = {};
  for (const r of results) for (const d of (r.control_diffs || [])) {
    const k = d.field + ' — SHOWDOWN ' + BS.explain(d, d.sd, pretty) + '  /  OURS ' + BS.explain(d, d.us, pretty);
    (sharedFam[k] = sharedFam[k] || new Set()).add(r.name);
  }
  const sharedKeys = Object.keys(sharedFam);
  if (sharedKeys.length) {
    console.log('\n  DIFFERENCES THE FIXTURE TRIPPED OVER, ATTRIBUTABLE TO NO ENTITY   ' + sharedKeys.length);
    console.log('    Each appears in the CONTROL arm too, so it is a property of the staging rather '
      + 'than of the thing staged.\n    Blaming the entity for it is the wrong-mechanism failure; it '
      + 'is reported here instead of being dropped.');
    for (const k of sharedKeys.slice(0, 25))
      console.log('      ' + k + '\n        seen while staging: ' + [...sharedFam[k]].slice(0, 8).join(', '));
  }

  console.log('\n  THE DECLARED DIVERGENCES — quietened, counted, and printed every run:');
  DECLARED.forEach((x, i) => {
    console.log('    ' + (DECLARED_HITS[i] ? String(DECLARED_HITS[i]).padStart(4) + ' leaves' : '   0 leaves — STALE')
      + '   ' + x.id);
    console.log('        ' + x.why.replace(/\s+/g, ' '));
  });
  const staleDecl = DECLARED_HITS.filter(n => !n).length;
  if (staleDecl) console.log('    A DECLARED DIVERGENCE THAT MATCHED NOTHING IS A CLAIM THAT HAS '
    + 'QUIETLY BECOME FALSE. Remove it or find out why.');

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
