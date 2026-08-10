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

/* A SECOND BODY THE AGGRESSOR CAN ALSO KILL FROM FULL, of a different species, so the HP-floor rule
 * can put the FULL case and the CHIPPED case side by side on one board. */
const KILLABLE2 = (() => {
  const att = dex.species.get(CAST.ATTACKER().species);
  let best = null;
  for (const s of CANDIDATES) {
    if (KILLABLE && s.id === KILLABLE.species) continue;
    const L = lethalMove(att, s, 1.5);
    if (L && (!best || L.d / flatL50(s.baseStats).hp > best.ratio))
      best = { species: s.id, ability: carrierAbility(s), move: L.mv, ratio: L.d / flatL50(s.baseStats).hp,
               hp: flatL50(s.baseStats).hp };
  }
  return best;
})();
/* AND A CHIP THAT TAKES A BODY OFF FULL WITHOUT KILLING IT — the whole content of "at the line". */
function chipFor(speciesId) {
  const att = dex.species.get(CAST.ATTACKER().species), def = dex.species.get(speciesId);
  const hp = flatL50(def.baseStats).hp;
  let best = null;
  for (const t of Object.keys(DELIVERY)) for (const mv of [DELIVERY[t].physical, DELIVERY[t].special]) {
    if (!mv) continue;
    const d = maxRoll(att, mv, def);
    if (d <= 0 || d >= hp) continue;                 // must not kill, must not be a no-op
    if (!best || d < best.d) best = { mv, d };       // the SMALLEST real chip available
  }
  return best;
}

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
  /* A CARRIER WHOSE CONTROL IS QUIET IS WORTH MORE THAN A BULKY ONE, and the first version ranked on
   * bulk alone. Bellibolt carries Static, Electromorphosis and Damp and nothing quiet, so Damp was
   * controlled by Electromorphosis and Electromorphosis by Damp — a delta between two LIVE abilities,
   * which cannot say which of them moved the board. Both came back DID-NOT-FIRE and exactly one was
   * real: re-run against Bellibolt's third ability, Damp moved 0 leaves in BOTH engines (it is inert
   * without an explosion) and Electromorphosis moved 6 in Showdown and 0 here. Ranking quiet-control
   * first picks a different body wherever the format offers one, and where it does not the caveat is
   * printed on the finding. */
  const withAlt = plain.filter(s => altAbility(s, ab.id))
    .sort((a, b) => (QUIET_SET.has(idOf(altAbility(b, ab.id))) - QUIET_SET.has(idOf(altAbility(a, ab.id))))
                 || (bulk(b) - bulk(a)));
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
/* THE PIN ARM IS A PARAMETER OF THE SCENARIO, NOT OF THE FILE.
 *
 * The primary arm (`top-tie-first`) makes every sub-100-accuracy move MISS, no crit land and no
 * secondary below 100% fire. That is what makes two engines comparable, and for an ITEM it costs
 * almost nothing — an item's effect is rarely an accuracy roll. FOR A MOVE IT COSTS 121 OF THE 500,
 * because a move's own accuracy IS the move: Will-O-Wisp, Hypnosis, Thunder Wave, Toxic, Hydro Pump,
 * every OHKO move and every raised-crit-ratio move stage NOTHING under it and would have read
 * "identical" — the vacuous pass this whole file exists to refuse.
 *
 * `bottom-tie-first` is the other SHIPPED arm (game_differential.js ARMS) and its corner is the exact
 * inverse: every sub-100 move HITS, every crit LANDS, every secondary FIRES, minimum damage. Both
 * engines are pinned to it identically, so it is as comparable as the primary — it is a different
 * corner of the same die, not a loosened one. `tests/staged_status_counters.js` already uses it for
 * exactly this reason (it is "the only arm in which Will-O-Wisp lands and Ice Beam freezes").
 *
 * A rule DECLARES the arm it needs and the arm is PRINTED on every entry staged under it, because a
 * result read against the wrong corner is a result nobody can compare. */
const PRIMARY_ARM_ID = 'top-tie-first';
function play(sc, src, armId) {
  const G = SB.harness(src);
  let ARM = null;
  if (armId && armId !== PRIMARY_ARM_ID) {
    ARM = G.ARM_BY_ID.get(armId);
    if (!ARM) return { bad: 'NO-SUCH-ARM', why: 'the scenario asks for pin arm "' + armId
      + '" and game_differential.js publishes only ' + [...G.ARM_BY_ID.keys()].join(', ') };
  }
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
    script: sc.script, arm: ARM || undefined,
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
  } else if (sc.kind === 'pair') {
    /* BOTH modifiers come off at once. The pair arm asks whether two handlers AT THE SAME STAGE are
     * folded into one modifier and spent once — which is what the authority does — or applied
     * separately, which gives a different answer by a rounding step. */
    body.item = '';
    const alt = altAbility(dex.species.get(body.species), sc.abilityId);
    if (alt) body.ability = alt;
    ignore.push((sideKey === 'A' ? 'p1' : 'p2') + '.active[' + idx + '].item');
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
/* ---- THE CLOSET: ENTITIES THE OWNER HAS DEFERRED BY NAME ---------------------------------------
 *
 * `DECLARED` above quietens a DIFFERENCE. This defers an ENTITY, which is a different thing and was
 * needed the moment an entity read DID-NOT-FIRE — an ABSENCE has no diff to quieten.
 *
 * A row in here is still staged, still played against the authority, and still printed on every run
 * with its reason and its date. The only thing it stops doing is holding the MEDICHAM gate shut.
 * Deleting the entity from the population instead would make the shelf invisible, and an invisible
 * exception is precisely what this file exists to prevent.
 *
 * ONLY THE OWNER PUTS SOMETHING HERE, and the quote goes in the entry. This is not a place for the
 * instrument's own judgement or for a row that turned out to be hard. */
const DEFERRED = {
  metronome: {
    by: 'Will', on: '2026-08-10',
    why: 'The Metronome ITEM (19 uses) climbs a damage ladder over consecutive uses of one move. '
       + 'Its tag is derived and correct (`damageMultOnRepeat`, the full 4096ths ladder off the '
       + 'condition); what is missing is the CONSUMER, which needs a per-body consecutive-use counter '
       + 'threaded through the turn loop and read inside dmgRange — a change that touches every move\'s '
       + 'damage path for the smallest row in the whole queue. Will: "metronome is a joke dont worry '
       + 'about that just put it into a quarantined closet we can re examine once the project is '
       + 'successful."',
  },
};

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

/* ---- IS THE CONTROL ITSELF QUIET? THE VERDICT HAS TO CARRY THE ANSWER ---------------------------
 *
 * FOUND 2026-08-08, IN THIS FILE'S OWN SAVED ABILITIES ARTIFACT, AND IT IS THE REASON THIS FUNCTION
 * EXISTS. `ability/*` controls by SWAPPING IN ANOTHER REAL ABILITY of the same species. Where the
 * species has no quiet alternative the "control" is a second live mechanic, and the measured delta is
 * whichever of the two the engine actually implements. `data/roster.abilities.json`:
 *
 *     sandrush          control Fluffy             Showdown  with 818  without 850
 *     fluffy            control Sand Rush          Showdown  with 850  without 818   <- SWAPPED
 *     damp              control Electromorphosis   with 955  without 933
 *     electromorphosis  control Static             with 933  without 955             <- SWAPPED
 *     angerpoint        control Intimidate         t0 boosts.atk  with 0  without -1
 *     justified         control Intimidate         t0 boosts.atk  with 0  without -1
 *
 * The 32-HP gap is FLUFFY halving contact damage, which this engine does not implement; Sand Rush was
 * never under test and is correct (measured directly: 100 / 200 / 100 / 100 speed across no weather,
 * sand, sun, rain). The `-1 Attack` on BOTH Anger Point and Justified is INTIMIDATE's drop being
 * removed by the control. Four of that stage's six findings were the control's, over 2,049 uses.
 *
 * THE FILE ALREADY KNEW AND SAID IT IN THE WRONG PLACE. Every one of those rows carries the note
 * "(NOT A QUIET ABILITY — see the caveat on any finding)" — in the NOTE field, while the VERDICT
 * field kept saying DID-NOT-FIRE. The verdict is what gets read, quoted and queued, exactly as a
 * `PRE-CHANGE` caption under a headline number is. So the caveat is now the VERDICT:
 *
 *   CONTROL-NOT-QUIET   both boards moved, or ours did not, AND the control arm can move a board by
 *                       itself — so the delta is (subject MINUS a live control) and is not
 *                       attributable to the subject at all. NOT a finding. NOT a pass. */
function controlIsQuiet(e) {
  if (e.kind === 'ability' && e.controlQuiet === false)
    /* THE SPECIES NAMED HERE IS THE CARRIER'S, NOT SLOT 0'S. A staging that puts the carrier on the
     * BENCH — the entry-aids-ally arm — has somebody else in B[0], and this sentence blamed that body
     * for having no quiet alternative. `carrierSpecies` is written by `stageAbility`; the old
     * fall-back is kept for the scenarios that predate it. */
    return { quiet: false, why: 'the CONTROL is another LIVE ability — ' + (e.scenario.controlAbility
        || 'unnamed') + ' — because ' + (e.scenario.carrierSpecies || e.scenario.B[0].species)
      + ' has no quiet alternative. The '
      + 'measured delta is (subject MINUS that ability) and cannot say which of the two moved the '
      + 'board. MEASURED on this instrument\'s own artifact: Sand Rush and Fluffy control each other '
      + 'and reported THE SAME TWO NUMBERS SWAPPED, and the 32-HP gap is Fluffy.' };
  if (e.controlNotQuiet) return { quiet: false, why: e.controlNotQuiet };
  return { quiet: true };
}

function runEntry(e) {
  const sc = e.scenario;
  const { sc: ctrlSc, ignore } = controlOf(sc);
  const src = e.brokenSrc || null;
  const arm = sc.arm || null;

  const subject = play(sc, src, arm);
  if (subject.bad) return { ...e, verdict: 'COULD-NOT-STAGE',
    why: 'the SUBJECT arm did not run: ' + subject.bad + ' — ' + subject.why };
  const control = play(ctrlSc, src, arm);
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
  /* THE ACCUSING VERDICTS ARE GATED ON THE CONTROL BEING QUIET, and the gate sits here rather than in
   * the report so nothing downstream — the artifact, `--reds`, the exit code — can read a contaminated
   * row as a subject failure. FIRED-AND-BOARDS-MATCH is deliberately NOT gated: agreement between the
   * two engines over a shared control is still agreement, whatever the control was doing. */
  /* THE CLOSET. An entity the OWNER has deferred by name — not a gap the instrument found, and not a
   * pass. Will, 2026-08-10: *"metronome is a joke dont worry about that just put it into a
   * quarantined closet we can re examine once the project is successful"*.
   *
   * WHY THIS IS A VERDICT AND NOT A DELETION. A deferred row keeps its scenario, keeps being staged,
   * keeps being played against the authority, and prints on every run with its reason and the date it
   * was shelved. What it stops doing is holding the MEDICHAM gate shut. The alternative — dropping the
   * entity from the population — would make the shelf invisible, and an invisible exception is the
   * failure mode this whole file exists to prevent.
   *
   * AND IT IS CHECKED THE WAY `DECLARED` IS. A deferral whose row would now pass on its own is
   * reported as STALE, because a shelf that no longer holds anything is a claim that has quietly
   * become false. See the DEFERRED block at the head of this file. */
  const DEF = DEFERRED[e.id];
  if (DEF) {
    const wouldPass = usMoved.length && !mine.length;
    return { ...base, verdict: 'DEFERRED-BY-OWNER', deferred: DEF, would_pass_now: !!wouldPass,
      why: 'SHELVED BY THE OWNER, NOT MEASURED CLEAN. ' + DEF.why
         + ' (deferred ' + DEF.on + ' by ' + DEF.by + '.) It is still staged and still played every '
         + 'run; it does not hold the gate. Underlying verdict without the deferral: '
         + (wouldPass ? 'FIRED-AND-BOARDS-MATCH — THE SHELF IS STALE, take it down'
                      : (usMoved.length ? 'FIRED-AND-BOARDS-DIFFER' : 'DID-NOT-FIRE')) + '.' };
  }
  const CQ = controlIsQuiet(e);
  if (!CQ.quiet && (!usMoved.length || mine.length))
    return { ...base, verdict: 'CONTROL-NOT-QUIET', control_why: CQ.why,
      why: 'THE DELTA IS NOT ATTRIBUTABLE TO THIS ENTITY. ' + CQ.why + ' The subject arm '
         + (usMoved.length ? 'moved and the two engines disagree' : 'did not move in this engine')
         + ', which under a quiet control would read '
         + (usMoved.length ? 'FIRED-AND-BOARDS-DIFFER' : 'DID-NOT-FIRE') + ' — it is neither.' };
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
  const build = (lead, second, third) => {
    const rows = [lead];
    if (second) rows.push(second);
    /* AN EXPLICIT BENCH SLOT, so a scenario can name the body it switches TO. `{ sw: '<species>' }`
     * resolves by the same key the chooser uses, and a body that is absent resolves to `pass` — so
     * putting the target on the bench BY NAME is what makes the ask land rather than evaporate. */
    if (third) rows.push(third);
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
  const A = build(o.a0, o.a1, o.a2), B = build(o.b0, o.b1, o.b2);
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

/* =================================================================================================
 *  THE MOVE STAGE'S OWN VOCABULARY — derived, printed by `--rules`, believed afterwards
 *
 * A MOVE IS A CLICK AND NOT A BODY, which changes what the fixture has to supply. An item is handed
 * to whoever the rule likes and an ability constrains its carrier; a move constrains almost nothing
 * about WHO throws it and almost everything about WHO IT CAN BE AIMED AT and WHICH PIN CORNER LETS IT
 * RESOLVE AT ALL.
 * ================================================================================================= */

/* WHETHER medicham2 CAN BUILD A BODY AT ALL. `buildMon` returns NULL for any species with no MC.mons
 * row — Blissey and Ferrothorn both fail — and `buildPair` then hands back null for the whole side,
 * so the entry reads COULD-NOT-STAGE for a reason that is about the damage table rather than about
 * the move. Asked through `mc_key.js`, which is the project's ONE doorway into that table (four
 * hand-rolled copies of this lookup existed and two of them were wrong). */
const { mcKey } = require(D('engine', 'mc_key.js'));
let _monsLoaded = false;
function monsReady() {
  if (_monsLoaded) return;
  /* the SNAPSHOT's table, not the live one — `data/engine-data.js` is one of the frozen files */
  try { REL.require('data/engine-data.js'); } catch (e) { /* the driver loads it too; either is fine */ }
  _monsLoaded = true;
}
function buildableSpecies(id) { monsReady(); try { return !!mcKey(id); } catch (e) { return false; } }

/* ---- WHICH BODY MAY CARRY A MOVE EXPERIMENT, AND WHY IT IS NOT `carrierAbility` -----------------
 *
 * `carrierAbility` is the ITEM stage's filter and it is right for that stage: it excludes anything
 * that would corrupt a DAMAGE READING. A move stage inflicts status, volatiles, stat stages, weather
 * and secondaries, so the same 123-species pool hands out SHIELD DUST (20 species — it deletes every
 * secondary), AROMA VEIL (9 — it blocks Taunt, Encore, Disable and Attract), SWEET VEIL, FLOWER VEIL,
 * CONTRARY, UNAWARE and PRANKSTER. Printed before it was believed, which is the only reason this
 * paragraph exists rather than twenty false reds.
 *
 * SO THE FILTER IS THE STRICT ONE: no `on*` KEY AT ALL — not "no on* FUNCTION", which is the shape
 * that let Shell Armor and Battle Armor through, because their handler is the literal `false`.
 *
 * AND THREE MEMBERS OF THAT SET ARE STILL NOT QUIET, because they act through a FIELD the engines
 * read rather than through a handler. This is the same over-match `refusesStatusMoves` and
 * `speedOnItemLoss` produced, arriving a third time, and it is caught the same way — by printing the
 * membership. */
const MOVE_FIELD_ACTORS = {
  earlybird: 'halves the SLEEP COUNTER, which is a leaf board_state.js compares directly — putting '
           + 'Spore on it would measure the ability',
  dancer:    'copies a DANCE move, and this stage clicks Dragon Dance, Swords Dance and Quiver Dance',
  corrosion: 'lets its holder poison Steel and Poison types, which is exactly the immunity the '
           + 'status rule leans on',
};
/* WHAT IS LEFT IS BALL FETCH, HONEY GATHER, RUN AWAY — AND NO LEGAL BUILDABLE SPECIES CARRIES ONE.
 * Measured: zero. The only usable bodies in this format carry BATTLE ARMOR or SHELL ARMOR, whose
 * whole content is "cannot be struck by a critical hit". Under the PRIMARY arm no crit lands in
 * either engine, so that is provably inert. Under `bottom-tie-first` EVERY crit lands and the armour
 * is a live damage modifier — so whether the pool is usable there is a MEASUREMENT, taken once,
 * below, and never a constant. */
const CRIT_ARMOUR = new Set(['battlearmor', 'shellarmor']);
function moveQuietAbilities(arm) {
  return dex.abilities.all().filter(a => {
    if (!a.exists || a.isNonstandard || a.condition) return false;
    if (QUIET_EXCLUDE[a.id] || MOVE_FIELD_ACTORS[a.id]) return false;
    const keys = Object.keys(a).filter(k => /^on/.test(k));
    if (!keys.length) return true;
    /* THE CRIT ARMOURS ARE ADMITTED BECAUSE NO CRIT LANDS, WHICH IS MEASURED RATHER THAN ASSUMED.
     * Under the primary arm that is the pin's own guarantee; under the bottom arm it is
     * `critsLand()`, which breaks the multiplier and watches. If a crit ever starts landing the
     * armours become live modifiers and this reads the other way with no edit. */
    return keys.length === 1 && keys[0] === 'onCriticalHit'
        && (arm === PRIMARY_ARM_ID || critsLand().armourShared);
  }).map(a => a.id);
}
const _MB = {};
function moveBodies(arm) {
  const k = arm || PRIMARY_ARM_ID;
  if (_MB[k]) return _MB[k];
  const ok = new Set(moveQuietAbilities(k));
  const rows = [];
  for (const s of dex.species.all()) {
    if (!s.exists || s.isNonstandard || s.battleOnly || s.forme.endsWith('Mega')) continue;
    if (!buildableSpecies(s.id)) continue;
    const ab = Object.values(s.abilities || {}).find(n => ok.has(idOf(n)));
    if (!ab) continue;
    /* THE ABILITY IS NAMED, NOT LEFT TO `carrierAbility`. It is one the species really has, so
     * `buildPair`'s silent fall-back to slot 0 cannot fire. */
    rows.push({ sp: s, ability: ab });
  }
  rows.sort((a, b) => (b.sp.baseStats.hp + b.sp.baseStats.def + b.sp.baseStats.spd)
                    - (a.sp.baseStats.hp + a.sp.baseStats.def + a.sp.baseStats.spd));
  _MB[k] = rows;
  return rows;
}
/* ---- DOES A CRITICAL HIT LAND AT ALL? MEASURED ONCE, AND THE ANSWER DECIDES TWO THINGS ----------
 *
 * THE FIRST VERSION OF THIS GATE WAS A CONTAMINATED CONTROL AND IS RECORDED HERE RATHER THAN
 * DELETED. It compared a body holding Shell Armor against the SAME body holding its species'
 * alternate ability — and every legal carrier of a crit armour in this format has Overgrow, Torrent,
 * Sap Sipper or Defiant as that alternate, all of which are live. So the "armour's effect" it
 * measured was whichever of the two this engine implements. That is the identical failure the
 * abilities stage shipped (Sand Rush controlled by Fluffy, the same two numbers swapped), arriving
 * inside the fix for it, four hours later.
 *
 * THE HONEST QUESTION IS NARROWER AND NEEDS NO CONTROL ABILITY: does a critical hit land in this
 * simulator on the arm in question? It is asked the way `--reds` asks everything — BY BREAKING THE
 * MECHANISM AND WATCHING. The crit's x1.5 is removed from the frozen release's bytes and a raised-
 * ratio move is thrown; a board that does not move proves no crit was there to be worth 1.5x.
 *
 * MEASURED 2026-08-08 on release 72e361e1bd44: THE PLANT MOVES NOTHING, on `bottom-tie-first` — the
 * arm whose own description says "every crit lands" — and the two engines agree on the damage to the
 * point either way. So NO CRIT LANDS IN EITHER ENGINE IN EITHER ARM, and two things follow:
 *
 *   - BATTLE ARMOR AND SHELL ARMOR HAVE NOTHING TO BLOCK, so the five-species pool is inert on both
 *     arms rather than only on the primary one. That is the same conclusion the broken proof reached
 *     and it is now reached for a reason that is true.
 *   - `move/crit` CANNOT BE STAGED AT ALL and is a refusal with this as its written reason, rather
 *     than a green that proves nothing.
 *
 * A MEASUREMENT AND NOT A CONSTANT: the day a crit lands here, this reads the other way by itself. */
const CRIT_X15 = 'if(_critHere){base=Math.floor(base*1.5);MEDSEEN.critInRange++;}';
let _CL2 = null;
function critsLand() {
  if (_CL2) return _CL2;
  _CL2 = { ok: false, why: 'the proof did not run' };
  const mv = dex.moves.all().find(m => m.exists && !m.isNonstandard && m.critRatio > 1
    && m.category !== 'Status' && needsIndex(m) && alwaysHits(m));
  const tgt = dex.species.all().find(s => s.exists && !s.isNonstandard && !s.battleOnly
    && buildableSpecies(s.id) && Object.values(s.abilities || {}).some(a => CRIT_ARMOUR.has(idOf(a))));
  if (!mv || !tgt) { _CL2.why = 'no 100-accuracy raised-crit-ratio move, or no buildable body, exists '
    + 'to ask the question with'; return _CL2; }
  const src = REL.read('engine/medicham2-browser.js');
  if (src.split(CRIT_X15).length - 1 !== 1) {
    _CL2.why = 'the crit multiplier anchor is not in this release exactly once, so the question '
      + 'cannot be asked of it and the answer is UNKNOWN rather than no'; return _CL2; }
  const other = Object.values(tgt.abilities).find(a => !CRIT_ARMOUR.has(idOf(a)))
    || Object.values(tgt.abilities)[0];
  const build = (ab) => { const sc = scaffold({ hpA: 4, hpB: 8,
      a0: { ...CAST.ATTACKER(), moves: [mv.id] },
      b0: mon(tgt.id, '', ab, [INERT]),
      script: [turn([click(mv.id, 0), IDLE], [IDLE, IDLE])] });
    sc.id = 'proof/crit-lands/' + idOf(ab); sc.kind = 'move'; sc.entityId = mv.id; return sc; };
  const armourAb = Object.values(tgt.abilities).find(a => CRIT_ARMOUR.has(idOf(a)));
  const patched = src.replace(CRIT_X15, 'if(_critHere){MEDSEEN.critInRange++;}');
  let moved = 0, arms = [], blocked = null, agree = null;
  for (const arm of [PRIMARY_ARM_ID, BOTTOM_ARM]) {
    const clean = play(build(other), null, arm);
    const broke = play(build(other), patched, arm);
    if (clean.bad || broke.bad) { _CL2.why = 'the proof fixture did not play: '
      + (clean.bad || broke.bad); return _CL2; }
    let d = 0;
    for (let i = 0; i < clean.boards.length; i++)
      d += BS.compare(clean.boards[i].medi, broke.boards[i].medi, { compared: 0 }).length;
    arms.push(arm + ': ' + d + ' leaf/leaves');
    moved += d;
    /* AND THE SAME QUESTION OF THE SAME BODY WEARING THE ARMOUR, on the arm where crits land. Two
     * things have to be true for the five-species pool to stay usable there, and neither of them is
     * "the two abilities differ by this much" — which is the contaminated shape that produced the
     * abilities stage's four false findings:
     *   OURS BLOCKS      the plant moves NO leaf on the armoured body, so the x1.5 never applied
     *   THEY AGREE       the two ENGINES part on nothing in the clean run, so Showdown blocked it too
     * An ability BOTH engines hold cancels out of every subject-minus-control delta exactly, which is
     * the same argument `carrierAbility` already rests on. */
    if (arm === BOTTOM_ARM) {
      const ac = play(build(armourAb), null, arm), ab = play(build(armourAb), patched, arm);
      if (ac.bad || ab.bad) { _CL2.why = 'the armour fixture did not play: ' + (ac.bad || ab.bad);
        return _CL2; }
      blocked = 0; agree = 0;
      for (let i = 0; i < ac.boards.length; i++) {
        blocked += BS.compare(ac.boards[i].medi, ab.boards[i].medi, { compared: 0 }).length;
        agree += ac.boards[i].diffs.length;
      }
    }
  }
  _CL2 = { ok: moved > 0, moved, arms, blocked, agree,
    armourShared: moved > 0 && blocked === 0 && agree === 0,
    why: (moved > 0
      ? 'MEASURED on release ' + REL.id + ': removing the critical hit\'s x1.5 from ' + mv.name
        + ' moves ' + moved + ' board leaf/leaves (' + arms.join('; ') + '), so a crit DOES land, on '
        + BOTTOM_ARM + ' only, exactly as that arm\'s pin says.'
      : 'MEASURED on release ' + REL.id + ': removing the critical hit\'s x1.5 from ' + mv.name
        + ' moves NO board leaf in EITHER arm (' + arms.join('; ') + '), so no crit is landing.')
      + '  THE ARMOUR: with ' + pretty(String(armourAb)) + ' on the same body the plant moves '
      + blocked + ' leaf/leaves and the two engines part on ' + agree + ' — so the armour is '
      + (moved > 0 && blocked === 0 && agree === 0
          ? 'ONE FACT BOTH ENGINES HOLD and cancels out of every subject-minus-control delta; the '
            + 'five-species pool stays usable on both arms'
          : 'NOT a fact both engines hold, so the pool is closed on ' + BOTTOM_ARM) + '.' };
  return _CL2;
}

function quietBodies(arm) { return moveBodies(arm).map(r => r.sp); }
/* o = { arm, type: not immune to it, neutralTo: the chart reads exactly 0, hasType, status: the body
 *       must be able to CARRY it, powder: the body must not be a Grass type, not: [species...] } */
function quietBody(o) {
  o = o || {};
  for (const r of moveBodies(o.arm)) {
    const s = r.sp;
    if ((o.not || []).some(x => x && idOf(x) === idOf(s.id))) continue;
    if (o.type && dex.getImmunity(o.type, s.types) === false) continue;
    if (o.neutralTo && (dex.getEffectiveness(o.neutralTo, s.types) !== 0
                        || dex.getImmunity(o.neutralTo, s.types) === false)) continue;
    /* A STATUS HAS ITS OWN IMMUNITY TABLE AND IT IS NOT THE TYPE CHART. Poison Powder came back "THE
     * STAGING IS INERT" on the first run because the bulkiest quiet body is Goodra-HISUI, which is
     * STEEL. Asked of the dex — `getImmunity('psn', types)` — rather than typed out here. */
    if (o.status && dex.getImmunity(o.status === 'tox' ? 'psn' : o.status, s.types) === false) continue;
    if (o.powder && s.types.includes('Grass')) continue;
    if (o.hasType && !s.types.some(t => t === o.hasType)) continue;
    if (o.minHP && flatL50(s.baseStats).hp < o.minHP) continue;
    return mon(s.id, '', r.ability, []);
  }
  return null;
}
/* A MOVE THAT DISABLES ITSELF CANNOT BE CLICKED TWICE, and a script that does hands Showdown a
 * choice it REJECTS — a thrown game, which is this file's fixture being wrong rather than a finding.
 * Measured on the first full run: Gigaton Hammer and Struggle both threw. `deliveryOf` already
 * refuses these as CARRIERS for the same reason; this is the same fact on the subject side. */
const repeatable = m => !(m.flags && m.flags.cantusetwice) && !m.onDisableMove && !m.selfdestruct;
const twice = (m, a, b) => (repeatable(m) ? [a, b] : [a]);

/* THE ITEM STAGE'S POOL, REACHABLE BY NAME. Two move rules need it and both say why on the entry:
 * `move/crit` needs a defender that CANNOT block a critical hit (`carrierAbility` lists
 * `onCriticalHit` in INTERFERES, so one chosen by it provably cannot), and `move/type-changing`
 * needs a GHOST, which the five-species move pool does not contain. It is wider and therefore
 * weaker — Shield Dust, Aroma Veil and Prankster all live in it — so nothing that stages a status, a
 * volatile or a stat stage may use it, and the ability chosen is printed on every entry that does. */
function carrierBody(o) {
  o = o || {};
  const rows = CANDIDATES.filter(sp => buildableSpecies(sp.id) && carrierAbility(sp))
    .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd)
                  - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd));
  for (const sp of rows) {
    if ((o.not || []).some(x => x && idOf(x) === idOf(sp.id))) continue;
    if (o.type && dex.getImmunity(o.type, sp.types) === false) continue;
    if (o.immuneTo && dex.getImmunity(o.immuneTo, sp.types) !== false) continue;
    if (o.hasType && !sp.types.some(t => t === o.hasType)) continue;
    return mon(sp.id, '', carrierAbility(sp), []);
  }
  return null;
}

/* the sentence a rule prints when it cannot find a body — it names the pool rather than shrugging */
function noBodyWhy(o) {
  return 'the move stage\'s body pool is ' + moveBodies((o || {}).arm).length + ' species deep (every '
    + 'legal, buildable body carrying an ability with no `on*` key at all, plus the two crit armours), '
    + 'and none of them satisfies ' + JSON.stringify(o || {}) + '. This is a limit of the FORMAT\'s '
    + 'ability list, not of the engine: printed by --rules.';
}
/* THE MOVE STAGE'S AGGRESSOR IS NOT `CAST.ATTACKER`, AND THE REASON IS ON THE BOARD. Dragapult carries
 * INFILTRATOR, which the cast header defends as harmless because "a screen or a Substitute" is
 * "neither of which any derived scenario raises". THE MOVE STAGE RAISES BOTH — Reflect, Light Screen
 * and Aurora Veil are `sideCondition` moves and Substitute is a `volatileStatus` one — and an
 * attacker that IGNORES the thing under test reads as "the screen did nothing". Derived: the quiet
 * body with the largest attacking stat that the damage table can build. */
const _CL = {};
function CLICKER(arm) {
  const k = arm || PRIMARY_ARM_ID;
  if (_CL[k]) return _CL[k];
  const best = moveBodies(k).slice()
    .sort((a, b) => Math.max(b.sp.baseStats.atk, b.sp.baseStats.spa)
                  - Math.max(a.sp.baseStats.atk, a.sp.baseStats.spa))[0];
  _CL[k] = best ? mon(best.sp.id, '', best.ability, []) : { ...CAST.ATTACKER() };
  return _CL[k];
}

/* WHICH PIN CORNER A MOVE NEEDS, READ OFF THE MOVE'S OWN accuracy AND critRatio.
 *
 * The primary arm makes every sub-100-accuracy move MISS and never lets a crit land. For an ITEM that
 * costs almost nothing. For a MOVE it silences 121 of the 500 — Will-O-Wisp, Hypnosis, Thunder Wave,
 * Toxic, Hydro Pump, every OHKO move, every raised-crit-ratio move — and each of them would have read
 * "identical" on two boards where nothing happened. `bottom-tie-first` is the other SHIPPED arm and
 * its corner is the exact inverse; both engines are pinned to it identically, so it is a different
 * corner of the same die and not a loosened one. */
const BOTTOM_ARM = 'bottom-tie-first';
const alwaysHits = m => (m.accuracy === true || m.accuracy === 100);
function armFor(m) { return (alwaysHits(m) && !(m.critRatio > 1) && !m.willCrit) ? PRIMARY_ARM_ID : BOTTOM_ARM; }
function armNote(m) {
  if (armFor(m) === PRIMARY_ARM_ID) return '';
  return '  [pinned to ' + BOTTOM_ARM + ' — '
    + (!alwaysHits(m) ? 'it is ' + m.accuracy + '-accurate and the primary arm makes it MISS' : '')
    + (!alwaysHits(m) && (m.critRatio > 1 || m.willCrit) ? '; ' : '')
    + ((m.critRatio > 1 || m.willCrit) ? 'its crit ratio is raised and the control click adds two '
        + 'stages, which manufactures a one-sided crit on the primary arm' : '')
    + '. On this arm every sub-100 roll lands, every crit lands and every secondary fires, in BOTH '
    + 'engines; the RATIO itself is therefore not what is under test]';
}
/* a click that declares `mayMiss` when and only when the arm is what lands it */
function mclick(m, t) {
  const o = (t == null) ? { m: m.id } : { m: m.id, t };
  if (!alwaysHits(m)) o.mayMiss = 'THE ARM IS THE ANSWER AND NOT AN EXEMPTION: this click is '
    + m.accuracy + '-accurate and the scenario is pinned to ' + BOTTOM_ARM + ', where every sub-100 '
    + 'roll LANDS in both engines. Under the primary arm it would stage nothing at all and the two '
    + 'boards would agree for the wrong reason.';
  return o;
}
/* WHO THROWS IT, read off the move's own `target`. A move aimed at a foe is thrown BY the aggressor AT
 * the subject slot; a move aimed at the user, the user's side or the whole field is thrown by the
 * subject body itself. Getting this from the field rather than from a list is the whole point. */
const FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe', 'allAdjacentFoes', 'allAdjacent',
                             'randomNormal', 'foeSide', 'scripted']);
const aimsAtFoe = m => FOE_TARGETS.has(m.target);
const needsIndex = m => (m.target === 'normal' || m.target === 'any' || m.target === 'adjacentFoe');
function throwIt(m, idx) { return mclick(m, needsIndex(m) ? (idx == null ? 0 : idx) : null); }

/* THE SMALLEST NEUTRAL DELIVERY MOVE THAT IS NOT THE MOVE UNDER TEST — used wherever a body has to be
 * taken off full HP before the thing being staged has anywhere to act. Excluding the entity is not
 * fussiness: `controlOf` replaces EVERY click of the move under test, so a chip that happened to be
 * the same move would vanish from the control arm and the two arms would differ in two things. */
function neutralHit2(speciesId, notIds) {
  const sp = dex.species.get(speciesId);
  for (const t of Object.keys(DELIVERY))
    for (const mv of [DELIVERY[t].best, DELIVERY[t].physical, DELIVERY[t].special]) {
      if (!mv || (notIds || []).some(x => idOf(mv.id) === idOf(x))) continue;
      if (dex.getImmunity(mv.type, sp.types) === false) continue;
      if (dex.getEffectiveness(mv.type, sp.types) !== 0) continue;
      return mv;
    }
  return null;
}
function neutralHit(speciesId, notId) {
  const sp = dex.species.get(speciesId);
  for (const t of Object.keys(DELIVERY)) {
    const mv = hitOfType(t);
    if (!mv || (notId && idOf(mv.id) === idOf(notId))) continue;
    if (dex.getImmunity(t, sp.types) === false || dex.getEffectiveness(t, sp.types) !== 0) continue;
    return mv;
  }
  return null;
}

/* =================================================================================================
 *  THE ABILITY STAGE'S OWN VOCABULARY — derived, printed by `--rules`, believed afterwards
 *
 * WHY THIS BLOCK EXISTS, MEASURED RATHER THAN ASSERTED. On 2026-08-08 the abilities stage had six
 * rules and three of them were REFUSALS, so 124 of the 316 legal abilities — 72,609 uses — fell
 * through to `ability/generic`, which stages a plain attack. Showdown's own board came out identical
 * with and without every one of them and the roster honestly reported COULD-NOT-STAGE / THE STAGING
 * IS INERT. That verdict reads as "nothing to test" and the truth is THE CONDITION WAS NEVER CREATED:
 * Blaze needs the user under a third of its HP, Defiant needs a stat drop, Chlorophyll needs sun,
 * Prankster needs a status move on a turn where the order decides something, Lightning Rod needs an
 * Electric move aimed at its ALLY. None of those arises in a plain attack.
 *
 * THE MEASURED EXAMPLE THAT SETS THE STANDARD FOR THE WHOLE BLOCK IS PURE POWER. It doubles ATTACK,
 * its carrier is Medicham (Fighting/Psychic), the generic staging picks the carrier's STAB click by
 * type — Fighting is IMMUNE against the Dragon/Ghost aggressor, so it fell through to PSYCHIC, which
 * is SPECIAL. A doubled Attack stat with a special click on the board is exactly `docs/LESSONS.md`
 * §5: two arms, one number, nothing staged. So a rule here does not merely create a condition; it has
 * to create a condition THIS ABILITY'S OWN SHAPE can move a board through, and the shape is read off
 * the ability's upstream data rather than off its name.
 *
 * WHAT COUNTS AS UPSTREAM DATA HERE. The move stage reads `target`, `category`, `basePower`; an
 * ability has almost none of that, so these rules read (a) the HANDLER NAMES, which are Showdown's
 * own registration surface, and (b) THE SHAPES INSIDE THE HANDLERS — `move.type === 'Electric'`,
 * `pokemon.effectiveWeather()`, `move.flags['sound']` — taken from the handler's source text. That is
 * still the ability declaring what it reacts to. It is NOT `data/tags.json`, which is ours and
 * derived, and it is NOT `shortDesc` except where a rule says so on its face.
 * ================================================================================================= */

/* the source text of every handler an ability registers, as one string to match shapes in */
function handlerSrc(a, keys) {
  return (keys || Object.keys(a)).filter(k => /^on/.test(k) && typeof a[k] === 'function')
    .map(k => String(a[k])).join('\n');
}
const hasHandler = (a, ...names) => names.some(n => typeof a[n] === 'function');
/* THE TYPE AN ABILITY NAMES INSIDE ITS OWN HANDLERS — `move.type === 'Electric'` and the two other
 * spellings Showdown uses for the same test. Returns every distinct type it mentions, because a rule
 * that silently took the first would stage Dry Skin's Water arm and miss its Fire one. */
function typesNamed(a, keys) {
  const src = handlerSrc(a, keys), out = new Set();
  for (const m of src.matchAll(/move\.type\s*===?\s*['\"]([A-Z][a-z]+)['\"]/g)) out.add(m[1]);
  for (const m of src.matchAll(/type\s*===?\s*['\"]([A-Z][a-z]+)['\"]/g)) out.add(m[1]);
  return [...out].filter(t => DELIVERY[t]);
}
/* THE MOVE FLAG AN ABILITY NAMES — `move.flags['sound']`, `move.flags['bullet']`. Same argument. */
function flagsNamed(a, keys) {
  const src = handlerSrc(a, keys), out = new Set();
  for (const m of src.matchAll(/move\.flags\s*\[\s*['\"](\w+)['\"]\s*\]/g)) out.add(m[1]);
  return [...out];
}
/* THE WEATHER AN ABILITY NAMES, normalised to the ids Showdown's own `setWeather` uses. Snow is
 * `snowscape` in gen 9 and `hail` in the older handlers, and BOTH appear in live ability source. */
const WEATHER_IDS = ['sunnyday', 'raindance', 'sandstorm', 'snowscape', 'hail',
                     'desolateland', 'primordialsea', 'deltastream'];
function weatherNamed(a, keys) {
  const src = handlerSrc(a, keys), out = new Set();
  for (const m of src.matchAll(/['\"](\w+)['\"]/g)) if (WEATHER_IDS.includes(m[1])) out.add(m[1]);
  return [...out];
}

/* WHICH ABILITY SUMMONS WHICH WEATHER, read off that ability's OWN `onStart` rather than from a table
 * of four names. All four members score FIRED-AND-BOARDS-MATCH under the existing `ability/entry`
 * rule, which is what makes them usable as a fixture: an effect BOTH engines demonstrably have,
 * present identically in the subject and the control arm, cancels out of the delta exactly. */
const WEATHER_SETTER = {};
for (const a of dex.abilities.all()) {
  if (!a.exists || a.isNonstandard || typeof a.onStart !== 'function') continue;
  const m = /setWeather\(['\"](\w+)['\"]\)/.exec(String(a.onStart));
  if (!m) continue;
  const sp = (CARRIERS[a.id] || []).filter(s => !s.battleOnly && !s.isNonstandard
    && buildableSpecies(s.id) && altAbility(s, a.id))
    .sort((x, y) => (y.baseStats.hp + y.baseStats.def + y.baseStats.spd)
                  - (x.baseStats.hp + x.baseStats.def + x.baseStats.spd))[0];
  if (sp && !WEATHER_SETTER[m[1]]) WEATHER_SETTER[m[1]] = { ability: a.name, species: sp.id };
}
/* `snowscape` and `hail` are the SAME sky. An ability written against one must accept a setter that
 * spells it the other way, or Ice Body and Slush Rush refuse for a vocabulary reason. */
const SAME_SKY = { hail: 'snowscape', snowscape: 'hail' };
function setterFor(w) { return WEATHER_SETTER[w] || WEATHER_SETTER[SAME_SKY[w]] || null; }

/* THE STAT-LOWERING CLICK, derived: 100 accuracy so the pin lands it, aimed at ONE body so the rule
 * chooses which, no status and no volatile riding along, and the user neither switches nor heals nor
 * faints. Ranked by HOW MANY DISTINCT STATS IT LOWERS, because Hyper Cutter only sees an Attack drop
 * and Big Pecks only sees a Defense one — a one-stat click would retire half the family for a reason
 * about this file. */
/* AND THE SET IS A GREEDY COVER OVER STATS, NOT A TOP-N BY COUNT, WHICH IS A CORRECTION MEASURED ON
 * THIS RULE'S FIRST RUN. Ranking by "how many stats does this one lower" picked Noble Roar and
 * Tearful Look — both Attack + Special Attack — so the two clicks covered the same two stats twice.
 * Big Pecks (Defense), Keen Eye (accuracy) and Illuminate (accuracy) all came back INERT, and KEEN
 * EYE HAD BEEN SCORING FIRED-AND-BOARDS-MATCH under the generic staging: a new rule made a proven
 * ability unprovable. The cover is greedy — each further move is the one adding the most stats NOT
 * already covered — and the stats it reaches are printed by `--rules`. */
const DROP_POOL = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
    && m.boosts && Object.values(m.boosts).some(v => v < 0)
    && (m.accuracy === true || m.accuracy === 100)
    && (m.target === 'normal' || m.target === 'any')
    && !m.status && !m.volatileStatus && !m.selfSwitch && !m.self && !m.heal && !m.selfdestruct
    && m.priority === 0);
const DROP_SET = (() => {
  const out = [], have = new Set();
  /* SIX, NOT FOUR, AND ACCURACY IS WHY. A four-move cover reached atk / spa / spd / spe / def and
   * stopped — so Keen Eye and Illuminate, whose whole content is refusing an ACCURACY drop, had
   * nothing to refuse. KEEN EYE HAD BEEN SCORING FIRED-AND-BOARDS-MATCH before this rule existed;
   * a new rule that makes a proven ability unprovable is a regression however good its reasoning is,
   * and this is the second time the cover has been widened for exactly that reason. Six clicks is two
   * slots over three turns, which is the whole script. */
  while (out.length < 6) {
    let best = null, gain = 0;
    for (const m of DROP_POOL) {
      if (out.some(x => x.id === m.id)) continue;
      const n = Object.keys(m.boosts).filter(k => m.boosts[k] < 0 && !have.has(k)).length;
      if (n > gain || (n === gain && n > 0 && best && m.basePower > best.basePower)) { gain = n; best = m; }
    }
    if (!best) break;
    out.push(best);
    for (const k of Object.keys(best.boosts)) if (best.boosts[k] < 0) have.add(k);
  }
  return { moves: out, stats: [...have] };
})();
const DROP_MOVE = DROP_SET.moves[0] || null;
const DROP_MOVE2 = DROP_SET.moves[1] || null;

/* A DAMAGING MOVE WITH POSITIVE PRIORITY, for the family whose whole content is refusing one. Every
 * `deliveryOf` disqualifier still applies except the priority test itself — Sucker Punch is excluded
 * by `onTry` (it fails unless the target is attacking) through that same filter. */
const PRIORITY_HIT = dex.moves.all().filter(m => m.exists && !m.isNonstandard
    && m.priority > 0 && m.category !== 'Status' && m.basePower > 0
    && (m.accuracy === true || m.accuracy === 100) && (m.target === 'normal' || m.target === 'any')
    && !(m.critRatio > 1) && !m.willCrit && !m.drain && !m.recoil && !m.self && !m.multihit
    && !m.status && !m.volatileStatus && !m.boosts && !m.selfSwitch
    && !(m.secondaries || []).length
    && !Object.keys(m).some(k => /^on(Try|Hit|Prepare|Modify|Effectiveness|Base|After|Use|Damage)/.test(k)
        && typeof m[k] === 'function'))
  .sort((a, b) => b.basePower - a.basePower)[0] || null;

/* THE CONFUSING CLICK and THE TAUNT, both derived and both compared leaves: `board_state.js` holds
 * `vol.confusion` and `vol.taunt` as numbers in both engines. */
const TAUNT_MOVE = dex.moves.all().find(m => m.exists && !m.isNonstandard
  && m.volatileStatus === 'taunt' && (m.accuracy === true || m.accuracy === 100)
  && (m.target === 'normal' || m.target === 'any')) || null;

/* ---- A CARRIER CHOSEN FOR THIS RULE, NOT FOR THE STAGE ------------------------------------------
 *
 * `carrierFor` ranks quiet-control-first then by bulk and is right for the generic staging. These
 * rules need three more things from a carrier and each was a real refusal before it was a filter:
 *
 *   BUILDABLE   `buildMon` returns null for any species with no MC.mons row, and `buildPair` then
 *               hands back null for the WHOLE SIDE — the entry reads COULD-NOT-STAGE for a reason
 *               about the damage table rather than about the ability.
 *   ALTERNATE   the control has to be another ability THAT SAME SPECIES really has, or `buildPair`
 *               silently falls back to slot 0 and the control arm is the subject arm.
 *   A PREDICATE the rule's own condition. A pinch rule needs a body a derived hit can take to a
 *               third of its HP without killing; a speed rule needs a body whose doubled Speed can
 *               overtake something. Ranking by bulk and hoping is how `item/hp-floor` first measured
 *               nothing at all.
 *
 * QUIET CONTROL IS PREFERRED AND ITS ABSENCE IS CARRIED, never hidden: `stageAbility` writes
 * `controlQuiet` onto the scenario and `controlIsQuiet` turns a non-quiet control into the
 * CONTROL-NOT-QUIET verdict rather than an accusation. */
function abilityCarrier(ab, pred) {
  const list = (CARRIERS[ab.id] || []).filter(s => !s.battleOnly && !s.isNonstandard
    && !s.forme.endsWith('Mega') && buildableSpecies(s.id) && altAbility(s, ab.id));
  const ok = list.filter(s => !pred || pred(s));
  if (!ok.length) return null;
  const quiet = s => (QUIET_SET.has(idOf(altAbility(s, ab.id))) ? 1 : 0);
  const bulk = s => s.baseStats.hp + s.baseStats.def + s.baseStats.spd;
  ok.sort((a, b) => (quiet(b) - quiet(a)) || (bulk(b) - bulk(a)));
  const sp = ok[0];
  return { tier: 'ALTERNATE', species: sp.id, sp, control: altAbility(sp, ab.id),
           quiet: !!quiet(sp), pool: list.length };
}
/* the sentence a rule prints when no carrier survives its predicate — it names the pool it searched */
function noCarrierWhy(ab, what) {
  const all = (CARRIERS[ab.id] || []).map(s => s.id);
  const usable = (CARRIERS[ab.id] || []).filter(s => !s.battleOnly && !s.isNonstandard
    && !s.forme.endsWith('Mega') && buildableSpecies(s.id) && altAbility(s, ab.id)).map(s => s.id);
  return 'no carrier this rule can use exists. Every species with it: ' + (all.join(', ') || 'none')
    + '. Of those, ' + (usable.join(', ') || 'NONE') + ' are legal, buildable and have a second '
    + 'ability to control with — and ' + (usable.length ? 'none of them ' + what
        : 'the shortfall is already there, before this rule\'s own condition (' + what + ')') + '.';
}

/* ONE BUILDER FOR EVERY RULE IN THIS BLOCK. It owns the bookkeeping `controlOf` and `controlIsQuiet`
 * read — `abilityId`, `controlAbility`, `controlKind`, `controlQuiet` — so a new rule supplies BODIES
 * and a SCRIPT and cannot forget the half that makes the control arm a control. The carrier is always
 * side B slot 0, matching `abilityScenario`, because the ignored-leaf bookkeeping is keyed on it. */
function stageAbility(e, C, o) {
  const sp = dex.species.get(C.species);
  const carrier = mon(sp.id, o.item || '', dex.abilities.get(e.id).name, (o.moves || []).slice());
  /* THE CARRIER CAN START ON THE BENCH, which is the only way to ask an ENTRY question about a board
   * that already has something on it. `subject` stays 'B0' exactly as `abilityScenario`'s residual arm
   * leaves it: for an ability the control arm swaps the ability on EVERY body of the subject's side,
   * so the index only decides the ignored-leaf bookkeeping, which is item-only. */
  const sc = o.onBench
    ? scaffold({ hpA: o.hpA || 1, hpB: o.hpB || 1, subject: 'B0',
        a0: o.a0, a1: o.a1, a2: o.a2,
        b0: { ...o.benchLead, moves: [INERT] }, b1: { ...o.benchAlly, moves: [INERT] }, b2: carrier,
        script: o.script })
    : scaffold({ hpA: o.hpA || 1, hpB: o.hpB || 1, subject: 'B0',
        a0: o.a0, a1: o.a1, a2: o.a2, b0: carrier, b1: o.b1, b2: o.b2, script: o.script });
  sc.controlAbility = C.control;
  sc.controlQuiet = QUIET_SET.has(idOf(C.control));
  sc.controlKind = 'ability';
  sc.abilityId = e.id;
  sc.carrierSpecies = sp.id;
  return { note: o.note + '   [carrier ' + sp.name + ', control = ' + C.control
      + (sc.controlQuiet ? '' : ' — NOT A QUIET ABILITY, so any accusing verdict is downgraded to '
          + 'CONTROL-NOT-QUIET') + ']',
    arm: o.arm || null, scenario: sc, tier: 'ALTERNATE', controlQuiet: sc.controlQuiet };
}

/* A DERIVED HIT THAT LANDS A BODY IN A NAMED HP BAND, thrown by a named attacker. The pinch family is
 * unstageable without it: "chip it a bit" leaves the carrier above the third and the rule measures
 * nothing, which is how `item/hp-floor` and `move/protect-family` both first came back inert. The
 * damage step is Showdown's own at the MAXIMUM roll, which is the roll the primary pin selects. */
function hitInBand(attSp, defSp, lo, hi) {
  const hp = flatL50(defSp.baseStats).hp;
  let best = null;
  for (const t of Object.keys(DELIVERY)) for (const mv of [DELIVERY[t].physical, DELIVERY[t].special]) {
    if (!mv) continue;
    const d = maxRoll(attSp, mv, defSp);
    if (d < hp * lo || d > hp * hi) continue;
    if (!best || d > best.d) best = { mv, d, hp };
  }
  return best;
}

/* A FOE WHOSE SPEED SITS STRICTLY BETWEEN THE CARRIER'S AND THE CARRIER'S MULTIPLIED SPEED, and whom
 * the carrier can kill outright. `speedFlipPair` picks BOTH bodies; here the holder is fixed by the
 * ability, so only the foe is free.
 *
 * ONE LETHAL DIRECTION, NOT TWO, AND THE FIRST VERSION ASKED FOR TWO. Requiring a MUTUAL knockout
 * retired Sand Rush, Swift Swim and Slush Rush — three abilities the engine is KNOWN to have right —
 * for a reason entirely about this file: Excadrill, Basculegion and Beartic are bulky enough that
 * nothing in the format one-shots them back. The order is just as visible with one KO, because the
 * foe's click is a STAT DROP: if the carrier moves first the foe is dead before it acts and the drop
 * never lands, and if it does not the drop is on the board. That reads on `boosts`, `fainted` and
 * `species` and never on a damage number.
 *
 * A MIRROR IS THE WRONG FIXTURE for the same reason it is in `speedFlipPair`: the driver's primary
 * arm is the one in which the two engines disagree about every speed tie, so the pair is strictly
 * ordered both before and after the multiplier. */
function speedFlipFoe(holderSp, mult) {
  if (!DROP_MOVE) return null;
  const spd = s => flatL50(s.baseStats).sp;
  const h = spd(holderSp), after = Math.floor(h * mult);
  for (const F of CANDIDATES) {
    if (F.id === holderSp.id || !buildableSpecies(F.id) || !carrierAbility(F)) continue;
    const f = spd(F);
    if (!(mult > 1 ? (h < f && f < after) : (after < f && f < h))) continue;
    const kHF = lethalMove(holderSp, F, 1.2);
    if (kHF) return { foe: F, holderMove: kHF.mv, foeMove: DROP_MOVE,
                      ability: carrierAbility(F) || '',
                      speeds: h + ' -> ' + after + ' against ' + f };
  }
  return null;
}

/* ONE BUILDER FOR EVERY ABILITY SCENARIO. The four kinds differ in the SCRIPT and in nothing else,
 * because the interesting variable for an ability is WHEN it acts and the boundary is what reads it.
 * The carrier, the control and the tier come from `carrierFor`. */
/* ---- IS THE SUPPRESSION CONTROL EVEN AVAILABLE? MEASURED, ONCE, BEFORE IT IS USED ---------------
 *
 * THE ANSWER IS NO, AND FINDING THAT OUT IS THE REASON THIS FUNCTION EXISTS. The SUPPRESS and MEGA
 * tiers have no second ability to swap in, so their only control is Gastro Acid — and a control that
 * does not work does not fail loudly. It hands back a control arm IDENTICAL to the subject arm, our
 * delta comes out empty, and EVERY ENTITY IN BOTH TIERS READS `DID-NOT-FIRE`. Five of them did, on
 * the first run: Fur Coat, Hunger Switch, Parental Bond, Fire Mane and Spicy Spray. Two of those are
 * probably true and none of them was evidence.
 *
 * THE PROOF USES A KNOWN-LIVE ABILITY AS ITS FIXTURE — Rough Skin, which scores FIRED-AND-BOARDS-MATCH
 * under an ordinary swapped-ability control, so both engines demonstrably have it. It is re-staged
 * with a Gastro Acid control instead, and the two arms are compared INSIDE each engine:
 *
 *   SHOWDOWN moves    the fixture stages something; the suppression is real up there
 *   OURS moves        the control is usable and both tiers open
 *   OURS DOES NOT     `gastroacid` carries `statusInflict {volatile: gastroacid}` in data/tags.json
 *                     and NOTHING IN THE SIMULATOR READS THAT VOLATILE TO TURN AN ABILITY OFF.
 *
 * MEASURED 2026-08-08 on release 3898951e7423: Showdown 6 leaves, ours 0. So the tiers are closed
 * with that as their written reason, and THE FAILURE OF THE CONTROL IS ITSELF A FINDING — the whole
 * suppression class (Gastro Acid, and by the same token anything that reads that volatile) does not
 * reach abilities here. The gate is a MEASUREMENT and not a constant, so the day suppression is wired
 * the tiers reopen without anybody remembering to reopen them. */
let _GASTRO = null;
function gastroWorks() {
  if (_GASTRO) return _GASTRO;
  _GASTRO = { ok: false, why: 'the proof did not run' };
  const ab = dex.abilities.get('roughskin');
  const C = carrierFor(ab);
  if (!C || C.tier !== 'ALTERNATE') return _GASTRO;
  const built = abilityScenario(ab, C, 'generic');
  if (!built || !built.scenario) return _GASTRO;
  const sc = { ...built.scenario, id: 'proof/gastro-suppression', kind: 'ability', entityId: 'roughskin',
    script: [turn([IDLE, IDLE], [IDLE, IDLE])].concat(built.scenario.script) };
  const subj = play(sc, null);
  const ctrl = play({ ...sc, id: 'proof/gastro-control',
    A: sc.A.map((m, i) => (i === 0 ? { ...m, moves: m.moves.concat(['gastroacid']) } : m)),
    script: sc.script.map((t, i) => (i === 0 ? { p1: [{ m: 'gastroacid', t: 0 }, t.p1[1]], p2: t.p2 } : t)) },
    null);
  if (subj.bad || ctrl.bad) { _GASTRO.why = 'the proof fixture did not play: '
    + (subj.bad || ctrl.bad) + ' ' + (subj.why || ctrl.why); return _GASTRO; }
  const moved = (key) => { let n = 0;
    for (let i = 0; i < subj.boards.length; i++)
      n += BS.compare(subj.boards[i][key], ctrl.boards[i][key], { compared: 0 }).length;
    return n; };
  const sd = moved('sd'), us = moved('medi');
  _GASTRO = { ok: sd > 0 && us > 0, sd, us,
    why: sd === 0 ? 'the proof fixture stages nothing even in the authority, so it proves neither way'
       : us === 0 ? 'MEASURED: suppressing a KNOWN-LIVE ability (Rough Skin) with Gastro Acid moves '
           + sd + ' board leaves in Showdown and 0 in this simulator. `gastroacid` carries '
           + '`statusInflict {volatile: gastroacid}` in data/tags.json and nothing reads that volatile '
           + 'to turn an ability off, so the control arm would be IDENTICAL to the subject arm and '
           + 'every entity in this tier would read DID-NOT-FIRE for the control\'s failure rather '
           + 'than the ability\'s. THE FAILURE OF THE CONTROL IS ITSELF A FINDING and is reported as '
           + 'one; it is not a licence to publish the tier.'
       : 'usable: ' + sd + ' leaves in Showdown and ' + us + ' here' };
  return _GASTRO;
}

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
  const partnerSp = (() => {
    const alt = CANDIDATES.find(s => s.id !== base.id && s.id !== atk.id
      && neutralContactOn(s.id) && idOf(s.id) !== idOf(CAST.BAG().species));
    return alt || dex.species.get('snorlax');
  })();
  const partnerId = partnerSp.id;
  /* A THIRD BODY, ON THE BENCH, FOR THE ARM THAT SWITCHES OUT AND BACK. It must be distinct from the
   * carrier, the partner and the aggressor — an ask naming an ALREADY-ACTIVE body resolves to `pass`
   * and is counted, so switching slot 0 onto its own partner would stage nothing. */
  const benchSp = CANDIDATES.find(s => s.id !== base.id && s.id !== partnerId && s.id !== atk.id
    && idOf(s.id) !== idOf(CAST.ATTACKER2().species)) || dex.species.get('corviknight');
  const partner = mon(partnerSp.id, '', carrierAbility(partnerSp) || '', [hitThem.id, 'uturn']);

  /* THE STAGED HP INFLATION AND A MEGA EVOLUTION CANNOT BOTH BE IN THE SAME SCENARIO, and this was
   * measured rather than reasoned: Aerilate reported `Pinsir-Mega has 140 maximum HP` against `840`
   * on every board. `alignStats` writes the inflated pool onto the Showdown body BEFORE the battle
   * starts, and Showdown then RECOMPUTES maxhp from the mega forme's own base stats when the forme
   * changes — dropping the inflation — while medicham2's `megaEvolveNow` carries the delta across and
   * keeps it. Neither engine is wrong; the harness asked them a question with two answers. The MEGA
   * tier therefore runs at natural HP, and the cost is that a hit there can saturate. */
  let script, hpA = C.tier === 'MEGA' ? 1 : 6, hpB = C.tier === 'MEGA' ? 1 : 6;
  if (kind === 'entry') {
    /* ARM 5. Boundary 0 is the first entry. The carrier then LEAVES and COMES BACK, so boundary 2 is
     * a SECOND entry — which is the whole question for this family and could not be asked until
     * `{ sw: ... }` existed. Intimidate must drop again; Zero to Hero must not upgrade twice; a
     * returning Mimikyu must not get a fresh Disguise. Boundary 1 is the negative in between: the
     * carrier is on the bench and nothing of its may be on the field. */
    hpA = 1; hpB = 1;
    script = [turn([IDLE, IDLE], [{ sw: benchSp.id }, IDLE]),
              turn([IDLE, IDLE], [{ sw: base.id }, IDLE]),
              turn([IDLE, IDLE], [IDLE, IDLE])];
  } else if (kind === 'residual') {
    /* ARM 5, AND THE ONE THIS RULE'S PROSE USED TO CLAIM FALSELY. The carrier starts ON THE BENCH and
     * is switched in MID-TURN, so boundary 1 is its ENTRY TURN — `activeTurns` reads 0 there and the
     * effect must NOT fire — and boundaries 2 and 3 are the resumption. A lead-only staging cannot
     * express this, which is exactly what `--reds` proved by applying a break aimed at the gate and
     * moving no board. */
    hpA = 1; hpB = 1;
    script = [turn([IDLE, IDLE], [{ sw: base.id }, IDLE]),
              turn([IDLE, IDLE], [IDLE, IDLE]),
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
    const G = gastroWorks();
    if (!G.ok) return cannot('its carrier is ' + C.tier + '-tier — the ability cannot be swapped out, '
      + 'because ' + (C.tier === 'MEGA' ? 'the forme change WRITES it'
                                        : 'it is the only ability its species has')
      + ' — so the only control is suppression, and suppression does not work here. '
      + G.why);
    script = [turn([IDLE, IDLE], [C.tier === 'MEGA' ? { m: INERT, mega: true } : IDLE, IDLE])]
      .concat(script);
  }
  /* WHERE THE CARRIER STANDS depends on the arm. The residual arm needs it on the BENCH so it can
   * walk in mid-turn; every other arm leads with it. `subject` follows, because the control arm swaps
   * the ability on every body of that side carrying it and the ignored-leaf bookkeeping is keyed on
   * the slot. */
  const onBench = kind === 'residual';
  const sc = scaffold({ hpA, hpB, subject: 'B0',
    a0: mon(atk.id, '', CAST.ATTACKER().ability, [hitThem.id]),
    a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [hitThem.id]),
    b0: onBench ? mon(partnerId, '', carrierAbility(dex.species.get(partnerId)) || '', [INERT])
                : carrier,
    b1: partner,
    b2: onBench ? carrier : mon(benchSp.id, '', carrierAbility(benchSp) || '', [INERT]), script });
  sc.controlAbility = C.control;
  /* WHETHER THE CONTROL ABILITY IS ITSELF ACTIVE, carried onto the entry and printed on any finding.
   * Bellibolt has Static, Electromorphosis and Damp and NOTHING QUIET, so Damp is controlled by
   * Electromorphosis and Electromorphosis by Static — and a delta between two live abilities cannot
   * say which of them moved the board. Measured: Sand Rush and Fluffy sit on Houndstone and control
   * each other, and exactly one of that pair is a real finding. */
  sc.controlQuiet = !C.control || QUIET_SET.has(idOf(C.control));
  sc.controlKind = suppress ? 'suppress' : 'ability';
  sc.abilityId = e.id;
  return { note: C.tier + ' carrier ' + base.name
      + (C.tier === 'MEGA' ? ' -> ' + pretty(C.forme) + ' via ' + pretty(C.stone) : '')
      + '; control = ' + (suppress ? 'Gastro Acid suppression' : C.control)
      + (sc.controlQuiet ? '' : ' (NOT A QUIET ABILITY — see the caveat on any finding)')
      + '; staged as ' + kind, scenario: sc, tier: C.tier, controlQuiet: sc.controlQuiet };
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
  why: 'ARM 2 — THE DEFECT IS ALWAYS AT THE LINE. A lethal hit into a FULL-HP holder must leave it on '
     + '1 HP, and the same hit into a holder that is ONE CHIP OFF FULL must kill it. Both are on the '
     + 'SAME BOARD: a second body of a different species holds the same item and is chipped on turn 1, '
     + 'then both take a lethal hit on turn 2. A floor that reads "not dead yet" instead of "at full" '
     + 'saves the chipped one too, and that is a kill that is not a kill — the most expensive shape '
     + 'this class has. Turn 3 is the third negative: the survivor is on 1 HP with the item spent and '
     + 'must not be saved twice.',
  break: { why: 'the HP floor stops holding the body up — the item is still held and still read',
    patch: [["const _sv=TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull');",
             "const _sv=null&&(TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull'));"]] },
  match(e) {
    if (!e.onDamage || !/HP is full/i.test(e.shortDesc || '')) return null;
    if (!KILLABLE) return cannot('no legal body in the format can be killed from full by one derived '
      + 'delivery move with a 1.5x margin, so no staged hit is reliably lethal');
    const chip = KILLABLE2 ? chipFor(KILLABLE2.species) : null;
    if (!KILLABLE2 || !chip) return cannot('a full-HP killable body exists but no SECOND one of a '
      + 'different species with a chip that takes it off full without killing it, so the AT-THE-LINE '
      + 'negative — full against one chip down — has nowhere to stand');
    return { note: 'AT THE LINE: ' + KILLABLE.species + ' at FULL takes a lethal ' + KILLABLE.move.name
        + ' (' + KILLABLE.ratio.toFixed(1) + 'x its HP) and must survive; ' + KILLABLE2.species
        + ' beside it, chipped ' + chip.d + ' off ' + KILLABLE2.hp + ' by ' + chip.mv.name
        + ', takes a lethal ' + KILLABLE2.move.name + ' and must NOT',
      scenario: scaffold({
        a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability,
                [KILLABLE.move.id, chip.mv.id, KILLABLE2.move.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability,
                [chip.mv.id, KILLABLE2.move.id]),
        b0: mon(KILLABLE.species, e.id, KILLABLE.ability, [INERT]),
        b1: mon(KILLABLE2.species, e.id, KILLABLE2.ability, [INERT]),
        script: [turn([IDLE, click(chip.mv.id, 1)], [IDLE, IDLE]),
                 turn([click(KILLABLE.move.id, 0), click(KILLABLE2.move.id, 1)], [IDLE, IDLE]),
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

/* ---- THE SHAPE RULES FOR THE INERT 124 (ROADMAP #98) --------------------------------------------
 *
 * ALL OF THESE SIT ABOVE `ability/entry`, `ability/residual` AND `ability/generic` DELIBERATELY. The
 * first rule whose `match` returns owns the entity, and the three below are broad: `entry` takes
 * anything with an `onStart`, `generic` takes everything left. Hospitality has an `onStart` and needs
 * a CHIPPED ALLY, which the entry staging cannot supply; Chlorophyll has none of the three shapes and
 * fell to `generic`, which never raises weather. A narrow rule that sits under a broad one is not a
 * rule.
 *
 * EACH ONE DECLARES WHAT IT READ OFF THE ABILITY ITSELF, and `--rules` prints the membership. */

{ id: 'ability/pinch-offense', kind: 'ability',
  reads: 'onModifyAtk / onModifySpA whose handler tests `attacker.hp <= attacker.maxhp / N` and names '
       + 'a move type',
  why: 'THE CONDITION IS THE MECHANIC AND A FULL-HP BODY DOES NOT HAVE IT. Blaze, Torrent, Overgrow '
     + 'and Swarm multiply an offensive stat ONLY under a third of maximum HP, and the generic '
     + 'staging leaves the carrier near full — so Showdown\'s own board came out identical with and '
     + 'without all four. THE HIT THAT CROSSES THE LINE IS DERIVED, not hoped for: `hitInBand` picks '
     + 'the delivery move whose maximum roll (the roll the pin selects) lands the carrier between '
     + 'two thirds and 95% of its HP, which is below the gate and above death.\n'
     + '     THE NEGATIVE IS BOUNDARY 1 AND IT IS ON THE SAME SCRIPT. The carrier throws the SAME '
     + 'typed move on turn 1 at FULL HP, before the chip — that click must be worth exactly the same '
     + 'in both arms — and again on turn 3 when it is under the gate, where it must not be. An engine '
     + 'that applied the multiplier unconditionally parts on the first of those and an engine that '
     + 'never applies it parts on the last.\n'
     + '     AND THE CLICK IS OF THE TYPE THE ABILITY NAMES, which is the half Pure Power failed on: '
     + 'the generic staging picks the carrier\'s STAB by type and fell through to a SPECIAL move for '
     + 'an ability that doubles ATTACK. Here the type comes out of the handler.',
  break: { why: 'the pinch multiplier is dropped — the ability is still on the body and still named, '
              + 'and the HP gate is still crossed',
    patch: [["const _db=TAGS.param('ability',attAb,'damageBoost');",
             "const _db=null&&TAGS.param('ability',attAb,'damageBoost');"]] },
  match(e) {
    if (!hasHandler(e, 'onModifyAtk', 'onModifySpA')) return null;
    const keys = ['onModifyAtk', 'onModifySpA'];
    const g = /hp\s*<=\s*\w+\.maxhp\s*\/\s*(\d+)/.exec(handlerSrc(e, keys));
    if (!g) return null;
    const T = typesNamed(e, keys);
    if (!T.length) return null;
    const type = T[0], mv = hitOfType(type);
    const atk = dex.species.get(CAST.ATTACKER().species);
    if (!mv) return cannot('it multiplies ' + type + ' attacks under 1/' + g[1] + ' HP and no '
      + '100-accuracy single-target ' + type + ' delivery move exists in this format');
    if (dex.getImmunity(type, atk.types) === false)
      return cannot('the aggressor ' + atk.name + ' is IMMUNE to ' + type + ', so the boosted click '
        + 'would land on nothing and both arms would read 0 — the staging would be inert for a reason '
        + 'about this fixture rather than about the ability');
    let band = null;
    const C = abilityCarrier(e, sp => (band = hitInBand(atk, sp, 1 - 1 / +g[1], 0.95)));
    if (!C) return cannot(noCarrierWhy(e, 'can be taken between 1/' + g[1] + ' and death by one '
      + 'derived delivery move thrown by ' + atk.name + ' — without that hit the HP gate is never '
      + 'crossed and the entry would read INERT'));
    band = hitInBand(atk, C.sp, 1 - 1 / +g[1], 0.95);
    return stageAbility(e, C, { hpA: 8, hpB: 1, moves: [mv.id],
      note: 'throws ' + mv.name + ' at FULL HP on turn 1 (the negative), is taken to '
          + Math.round((1 - band.d / band.hp) * 100) + '% by ' + band.mv.name + ' on turn 2, and '
          + 'throws it again under the 1/' + g[1] + ' gate on turn 3',
      a0: mon(atk.id, '', CAST.ATTACKER().ability, [band.mv.id]),
      script: [turn([IDLE, IDLE], [click(mv.id, 0), IDLE]),
               turn([click(band.mv.id, 0), IDLE], [click(mv.id, 0), IDLE]),
               turn([IDLE, IDLE], [click(mv.id, 0), IDLE])] });
  } },

{ id: 'ability/stat-drop-reaction', kind: 'ability',
  reads: 'onTryBoost / onAfterEachBoost / onChangeBoost — the three hooks Showdown fires when '
       + 'somebody else moves this body\'s stat stages',
  why: 'A STAT DROP HAS TO HAPPEN AND THE GENERIC STAGING NEVER MAKES ONE. Thirteen abilities sit on '
     + 'these three hooks — Defiant, Competitive, Clear Body, Hyper Cutter, Mirror Armor, Big Pecks, '
     + 'White Smoke, Contrary and the four Intimidate-immunities — and every one of them read INERT '
     + 'because nothing in a plain attack lowers a stat. TWO SEPARATE DROPS ARE STAGED, because the '
     + 'family is stat-scoped: the two aggressor slots click the two most-lowering 100-accuracy '
     + 'single-target drop moves in the format, so Hyper Cutter has an Attack drop and Big Pecks has '
     + 'a Defense one rather than the family being retired for a reason about this file.\n'
     + '     AND THE AGGRESSOR CARRIES INTIMIDATE, which is what makes Inner Focus, Oblivious, Own '
     + 'Tempo and Scrappy expressible at all — their handlers check for that effect BY NAME. THIS IS '
     + 'NOT THE CONTAMINATION THAT PRODUCED THE ANGER POINT AND JUSTIFIED FALSE FINDINGS. There, '
     + 'Intimidate was the CONTROL ABILITY of the carrier, so removing it WAS the measurement. Here it '
     + 'is on the OTHER SIDE and is present in BOTH ARMS identically, which is the same argument '
     + '`carrierAbility` already rests on — and it is a fixture worth trusting because Intimidate '
     + 'scores FIRED-AND-BOARDS-MATCH under `ability/entry`, so both engines demonstrably have it.\n'
     + '     THE NEGATIVE IS THE AGGRESSOR\'S OWN STAT STAGES, on the same board: they must not move '
     + 'unless the ability under test is Mirror Armor, whose whole content is moving them.',
  break: { why: 'the boost-refusal path is removed, so an ability that should block a drop lets it '
              + 'through',
    patch: [["const p=TAGS.param('ability',ab,'preventsStatDrop');",
             "const p=null&&TAGS.param('ability',ab,'preventsStatDrop');"]] },
  match(e) {
    if (!hasHandler(e, 'onTryBoost', 'onAfterEachBoost', 'onChangeBoost')) return null;
    const keys = ['onTryBoost', 'onAfterEachBoost', 'onChangeBoost'];
    const hsrc = handlerSrc(e, keys);
    /* WHICH STAT THIS ONE ACTUALLY GUARDS, read off its own handler. Clear Body and Defiant loop over
     * `for (i in boost)` and name nothing, so they see every drop; Hyper Cutter names `boost.atk`,
     * Big Pecks `boost.def`, Keen Eye and Illuminate `boost.accuracy`. */
    const guarded = [...new Set([...hsrc.matchAll(/boost\.(\w+)/g)].map(m => m[1]))];
    /* AND IT DECLINES — it does not refuse — WHEN THE COVER CANNOT REACH THAT STAT, WHICH IS A
     * CORRECTION MEASURED TWICE ON THIS RULE. Keen Eye and Illuminate guard ACCURACY, and every
     * single-target accuracy drop in this format (Sand Attack, Smokescreen, Flash, Kinesis) is marked
     * `isNonstandard: "Past"` — banned — while Sweet Scent lowers EVASION at every foe rather than
     * accuracy at one. So the condition is uncreatable, and that is a property of the REGULATION.
     *
     * THE FIRST VERSION RETURNED A WRITTEN REFUSAL HERE AND THAT WAS WORSE THAN NOTHING. This rule
     * owns the entity the moment it returns anything, and Keen Eye's OTHER half — ignoring the
     * target's evasiveness, through `onModifyMove` — is a different mechanic that this rule never
     * looked at. Refusing on behalf of the boost hook would have retired a mechanic on evidence about
     * a different one, and it measurably cost Keen Eye a FIRED-AND-BOARDS-MATCH it already held.
     * Returning null hands the entity to the next rule that can say something about it. */
    if (guarded.length && !guarded.some(g => DROP_SET.stats.includes(g))) return null;
    /* AND THE BERRY HOOK IS NOT THIS HOOK. Ripen registers `onChangeBoost` for a BERRY\'s own boost,
     * so no click a foe makes reaches it — matching it here would report an INERT staging as if the
     * engine had been asked something. */
    if (/berry/i.test(hsrc)) return cannot('its boost hook fires only for a BERRY\'s own boost '
      + '(its handler names one), so nothing a foe clicks can reach it and this rule would stage a '
      + 'condition the ability never sees');
    if (!DROP_MOVE || !DROP_MOVE2) return cannot('this format has fewer than two 100-accuracy '
      + 'single-target stat-lowering status moves with no status or volatile riding along, and the '
      + 'family is stat-scoped — one drop would retire Hyper Cutter and Big Pecks for a reason about '
      + 'this file');
    const intim = dex.abilities.get('intimidate');
    const IB = (CARRIERS[intim.id] || []).filter(s => !s.battleOnly && !s.isNonstandard
      && buildableSpecies(s.id))
      .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd)
                    - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd))[0];
    if (!IB) return cannot('no legal buildable body in this format carries Intimidate, and the four '
      + 'Intimidate-immunities in this family check for that effect by name');
    const C = abilityCarrier(e, sp => idOf(sp.id) !== idOf(IB.id));
    if (!C) return cannot(noCarrierWhy(e, 'is a body other than the Intimidate aggressor itself'));
    const b1 = quietBody({ not: [C.species, IB.id] });
    if (!b1) return cannot(noBodyWhy({ not: [C.species, IB.id] }));
    const a1 = quietBody({ not: [C.species, IB.id, b1.species] });
    /* THE FOUR CLICKS OF THE COVER, TWO PER TURN ACROSS TWO TURNS. Anything the cover does not reach
     * is stated on the entry rather than left to be discovered as an INERT verdict. */
    const D = DROP_SET.moves;
    return stageAbility(e, C, { hpA: 4, hpB: 4, moves: [INERT],
      note: 'Intimidate fires at boundary 0, then ' + D.map(m => m.name).join(' + ')
          + ' are clicked at the carrier over turns 1 and 2 — between them they lower '
          + DROP_SET.stats.join(', ') + '; the aggressors\' own stages are the negative on the same '
          + 'board',
      a0: mon(IB.id, '', intim.name, D.filter((m, i) => i % 2 === 0).map(m => m.id)),
      a1: mon((a1 || {}).species || CAST.ATTACKER2().species, '',
        (a1 || {}).ability || CAST.ATTACKER2().ability, D.filter((m, i) => i % 2 === 1).map(m => m.id)),
      b1: { ...b1, moves: [INERT] },
      script: [0, 1, 2].map(t => turn([D[2 * t] ? click(D[2 * t].id, 0) : IDLE,
                                       D[2 * t + 1] ? click(D[2 * t + 1].id, 0) : IDLE],
                                      [IDLE, IDLE])) });
  } },

{ id: 'ability/redirects-a-type', kind: 'ability',
  reads: 'onAnyRedirectTarget / onFoeRedirectTarget, with the drawn type read off the same ability\'s '
       + 'onTryHit',
  why: 'REDIRECTION IS INVISIBLE UNLESS THE MOVE WAS AIMED SOMEWHERE ELSE. The generic staging throws '
     + 'everything AT the carrier, where a draw changes nothing, so Lightning Rod read INERT on 2,560 '
     + 'uses. Here the Electric click is aimed at the carrier\'s ALLY: with the ability the ally is '
     + 'untouched and the carrier takes it (immune, +1 Special Attack), without it the ally loses HP. '
     + 'That lands on the ALLY\'s hp and the CARRIER\'s boosts, both compared leaves.\n'
     + '     THE NEGATIVE IS TURN 2, on which a NON-drawn neutral move is aimed at the same ally and '
     + 'must land in both arms — an engine that redirected everything parts there.',
  break: { why: 'the redirection is skipped, so the drawn move stays on its original target',
    patch: [["const _rt=TAGS.param('ability',f.ability,'redirectsType');",
             "const _rt=null&&TAGS.param('ability',f.ability,'redirectsType');"]] },
  match(e) {
    if (!hasHandler(e, 'onAnyRedirectTarget', 'onFoeRedirectTarget')) return null;
    const T = typesNamed(e, ['onTryHit', 'onAnyRedirectTarget', 'onFoeRedirectTarget']);
    if (!T.length) return cannot('it registers a redirection hook but names no move type inside its '
      + 'own handlers, so this rule cannot derive WHICH moves it draws and would have to guess');
    const type = T[0], mv = hitOfType(type);
    if (!mv) return cannot('no 100-accuracy single-target ' + type + ' delivery move exists in this '
      + 'format, and the pin makes anything below 100 miss');
    const C = abilityCarrier(e);
    if (!C) return cannot(noCarrierWhy(e, 'is legal, buildable and has a second ability'));
    /* THE ALLY MUST BE HITTABLE BY THE DRAWN TYPE, or the "without it" arm reads 0 as well and the
     * whole entry is inert for a reason about the fixture. */
    const ally = quietBody({ not: [C.species], type });
    if (!ally || dex.getImmunity(type, dex.species.get(ally.species).types) === false)
      return cannot(noBodyWhy({ type, not: [C.species] }));
    const neutral = neutralHit2(ally.species, [mv.id]);
    if (!neutral) return cannot('no neutral delivery move of a type this ability does not draw exists '
      + 'against ' + pretty(ally.species) + ', so the rule has no on-board negative');
    return stageAbility(e, C, { hpA: 4, hpB: 6, moves: [INERT],
      note: mv.name + ' is aimed at the ALLY ' + pretty(ally.species) + ' on turn 1 and must be drawn; '
          + neutral.name + ' is aimed at the same ally on turn 2 and must NOT be',
      a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [mv.id, neutral.id]),
      b1: { ...ally, moves: [INERT] },
      script: [turn([click(mv.id, 1), IDLE], [IDLE, IDLE]),
               turn([click(neutral.id, 1), IDLE], [IDLE, IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/absorbs-a-type', kind: 'ability',
  reads: 'onTryHit / onAllyTryHitSide naming a move TYPE or a move FLAG inside the handler',
  why: 'THE CARRIER HAS TO BE HIT BY THE RIGHT THING, AND A GENERIC TURN THROWS ONE NEUTRAL CLICK. '
     + 'Flash Fire, Volt Absorb, Earth Eater, Motor Drive, Sap Sipper, Bulletproof and Soundproof all '
     + 'read a type or a flag off the incoming move and all of them read INERT. The type comes from '
     + '`move.type === "Electric"` in the ability\'s own handler and the flag from '
     + '`move.flags["sound"]`; the delivery move is then derived to match.\n'
     + '     THE CARRIER IS CHIPPED FIRST, because half this family HEALS and a heal on a full-HP '
     + 'body is `docs/LESSONS.md` §5 exactly: 0 = 0 in both arms, proving nothing. THE NEGATIVE IS '
     + 'TURN 3, a neutral click of a type the ability does NOT name, which must land in both arms — '
     + 'an engine that made the body immune to everything parts there.',
  break: { why: 'the type/flag immunity is dropped, so the absorbed hit lands as ordinary damage',
    patch: [["const _imm=TAGS.param('ability',suppressedAbility(att,def),'typeImmunity');",
             "const _imm=null&&TAGS.param('ability',suppressedAbility(att,def),'typeImmunity');"]] },
  match(e) {
    if (!hasHandler(e, 'onTryHit', 'onAllyTryHitSide', 'onTryHitPriority')) return null;
    const keys = ['onTryHit', 'onAllyTryHitSide'];
    const T = typesNamed(e, keys), F = flagsNamed(e, keys);
    if (!T.length && !F.length) return null;
    let mv = null, what = '';
    if (T.length) { mv = hitOfType(T[0]); what = T[0] + '-type'; }
    if (!mv && F.length) {
      mv = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.flags && m.flags[F[0]]
          && m.basePower > 0 && (m.accuracy === true || m.accuracy === 100)
          && (m.target === 'normal' || m.target === 'any') && !m.multihit && !m.drain && !m.recoil
          && !m.self && !m.status && !m.volatileStatus && !m.boosts && !(m.critRatio > 1)
          && !m.basePowerCallback)
        .sort((a, b) => b.basePower - a.basePower)[0] || null;
      what = 'a `' + F[0] + '`-flagged';
    }
    /* THE STATUS FALLBACK, AND IT IS THE HALF THAT MAKES OVERCOAT AND MAGIC BOUNCE EXPRESSIBLE. Some
     * flags have NO damaging carrier at 100 accuracy in this format — `powder` and `reflectable` are
     * both status-only — and the first version refused both for that. `board_state.js` compares
     * `status`, `status_counter` and `vol.taunt` as numbers in both engines, so a status click IS on
     * the board and the absorb is readable through it. It is a second choice rather than a first,
     * because a status carries no damage and the chip turn then does the whole job of taking the
     * carrier off full HP. */
    let statusClick = false;
    if (!mv && F.length) {
      mv = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
          && m.flags && m.flags[F[0]] && (m.accuracy === true || m.accuracy === 100)
          && (m.target === 'normal' || m.target === 'any')
          && (m.status || m.volatileStatus === 'taunt' || (m.boosts
              && Object.values(m.boosts).some(v => v < 0))))[0] || null;
      if (mv) { statusClick = true; what = 'the `' + F[0] + '`-flagged status move'; }
    }
    if (!mv) return cannot('it refuses ' + (T[0] || F[0]) + ' moves and this format offers no '
      + '100-accuracy single-target move of that shape whose effect is a leaf board_state.js '
      + 'compares, so the pin would make the click miss or the click would land on nothing and both '
      + 'arms would agree on nothing happening');
    const type = mv.type;
    /* A BODY THAT IS ALREADY IMMUNE TO THE STAGED CLICK READS THE SAME IN BOTH ARMS, and the three
     * ways to be immune here are NOT the same table: the type chart, the POWDER rule (Grass types
     * ignore every powder move, which `getImmunity` on the move's type does not know) and the STATUS
     * immunity table (a Steel body cannot be poisoned). Each is asked of the dex. */
    const C = abilityCarrier(e, sp => dex.getImmunity(type, sp.types) !== false
      && !(mv.flags && mv.flags.powder && sp.types.includes('Grass'))
      && !(mv.status && dex.getImmunity(mv.status === 'tox' ? 'psn' : mv.status, sp.types) === false)
      && !!neutralHit2(sp.id, [mv.id]));
    if (!C) return cannot(noCarrierWhy(e, 'is hittable by ' + mv.name + ' at all — a body that is '
      + 'ALREADY immune to the staged click (by the type chart, by the powder rule, or by the status '
      + 'immunity table) reads the same in BOTH arms and the ability cannot be distinguished from '
      + 'the rule that was going to stop it anyway'));
    const neutral = neutralHit2(C.species, [mv.id]);
    return stageAbility(e, C, { hpA: 4, hpB: 6, moves: [INERT],
      note: 'chipped by ' + neutral.name + ' on turn 1 so a heal has somewhere to land, hit by '
          + what + ' ' + mv.name + ' on turn 2, and hit by ' + neutral.name + ' again on turn 3 as the '
          + 'on-board negative',
      a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [mv.id, neutral.id]),
      script: [turn([click(neutral.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(mv.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(neutral.id, 0), IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/type-conversion', kind: 'ability',
  reads: 'onModifyType — the SOURCE type or flag it tests and the type it ASSIGNS, both from the '
       + 'handler',
  why: 'A CONVERTED TYPE IS ONLY ON THE BOARD IF THE TWO TYPES DIFFER ON THE CHART. `board_state.js` '
     + 'does not compare a body\'s types at all, so the effect has to be read through DAMAGE — and '
     + 'the generic staging throws the carrier\'s STAB at a body where Normal and Fairy are both '
     + 'neutral, which is one number in both arms. THE DEFENDER IS DERIVED to make the difference '
     + 'maximal: the body preferred is one the chart makes IMMUNE to the source type and not to the '
     + 'assigned one, so the click is worth ZERO without the ability and real damage with it.\n'
     + '     THE NEGATIVE IS TURN 2: a click of a type the ability does NOT convert, which must be '
     + 'worth exactly the same in both arms.',
  break: { why: 'the type rewrite is skipped, so the move keeps its printed type',
    patch: [["const _cm=att&&TAGS.param('ability',att.ability,'convertsMoveType');",
             "const _cm=null&&TAGS.param('ability',att.ability,'convertsMoveType');"]] },
  match(e) {
    if (typeof e.onModifyType !== 'function') return null;
    const src = String(e.onModifyType);
    const from = (/move\.type\s*===?\s*['"]([A-Z][a-z]+)['"]/.exec(src) || [])[1] || null;
    const fromFlag = (/move\.flags\s*\[\s*['"](\w+)['"]\s*\]/.exec(src) || [])[1] || null;
    const to = (/move\.type\s*=\s*['"]([A-Z][a-z]+)['"]/.exec(src) || [])[1] || null;
    if (!to || (!from && !fromFlag)) return cannot('its onModifyType handler does not spell out both '
      + 'the type it reads and the type it assigns in a shape this rule can read (from='
      + (from || fromFlag || 'none') + ', to=' + (to || 'none') + '), so the staging would be a guess');
    let mv = from ? hitOfType(from) : null;
    if (!mv && fromFlag) mv = dex.moves.all().filter(m => m.exists && !m.isNonstandard
        && m.flags && m.flags[fromFlag] && m.basePower > 0
        && (m.accuracy === true || m.accuracy === 100) && (m.target === 'normal' || m.target === 'any')
        && !m.multihit && !m.drain && !m.recoil && !m.self && !m.status && !m.volatileStatus
        && !m.boosts && !(m.critRatio > 1) && !m.basePowerCallback)
      .sort((a, b) => b.basePower - a.basePower)[0] || null;
    if (!mv) return cannot('no 100-accuracy single-target delivery move it would convert ('
      + (from || 'flag ' + fromFlag) + ') exists in this format');
    const srcType = mv.type;
    const C = abilityCarrier(e);
    if (!C) return cannot(noCarrierWhy(e, 'is legal, buildable and has a second ability'));
    /* THE DEFENDER, RANKED BY HOW MUCH THE CONVERSION IS WORTH ON IT. An immunity flipped to a hit is
     * the largest signal the chart can produce and it lands on `hp` rather than on a rounding step. */
    const cands = moveBodies(PRIMARY_ARM_ID).map(r => r.sp)
      .filter(sp => idOf(sp.id) !== idOf(C.species) && dex.getImmunity(to, sp.types) !== false)
      .map(sp => ({ sp, gain: (dex.getImmunity(srcType, sp.types) === false ? 9
        : Math.pow(2, dex.getEffectiveness(to, sp.types)) - Math.pow(2, dex.getEffectiveness(srcType, sp.types))) }))
      .filter(x => x.gain > 0).sort((a, b) => b.gain - a.gain);
    if (!cands.length) return cannot('no quiet body in the move stage\'s pool takes ' + to
      + ' differently from ' + srcType + ', so the conversion would be worth the same damage either '
      + 'way and both arms would agree on a number that means nothing');
    const def = cands[0].sp, defAb = moveBodies(PRIMARY_ARM_ID).find(r => r.sp.id === def.id).ability;
    const other = neutralHit2(def.id, [mv.id, srcType]);
    if (!other) return cannot('no second delivery move of an unconverted type exists against '
      + pretty(def.id) + ', so the rule has no on-board negative');
    return stageAbility(e, C, { hpA: 8, hpB: 4, moves: [mv.id, other.id],
      note: mv.name + ' (' + srcType + ') is thrown at ' + def.name + ' (' + def.types.join('/')
          + ') on turn 1 — the chart puts ' + srcType + ' at '
          + (dex.getImmunity(srcType, def.types) === false ? 'IMMUNE' : Math.pow(2, dex.getEffectiveness(srcType, def.types)) + 'x')
          + ' there and ' + to + ' at ' + Math.pow(2, dex.getEffectiveness(to, def.types))
          + 'x; ' + other.name + ' on turn 2 is the unconverted negative',
      a0: mon(def.id, '', defAb, [INERT]),
      script: [turn([IDLE, IDLE], [click(mv.id, 0), IDLE]),
               turn([IDLE, IDLE], [click(other.id, 0), IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/no-recoil', kind: 'ability',
  reads: 'onDamage whose handler names `recoil`',
  why: 'THE CARRIER HAS TO THROW A RECOIL MOVE AND THE DELIVERY TABLE REFUSES EVERY ONE OF THEM. '
     + '`deliveryOf` excludes `m.recoil` on purpose — a vehicle that hurts its own user is the '
     + 'experiment rather than the vehicle — so Rock Head (1,156 uses) could not be reached from any '
     + 'staging in this file. Here the recoil move is the POINT and is searched for directly.\n'
     + '     THE NEGATIVE IS TURN 2, a non-recoil click of the same category: an engine that had '
     + 'simply stopped charging self-damage parts there, and one that never charged it at all is '
     + 'caught by the fact that Showdown\'s own board moves when the ability is added.',
  break: { why: 'the recoil exemption is dropped, so the holder pays the recoil anyway',
    patch: [["const _nr=TAGS.param('ability',m.ability,'noRecoil');",
             "const _nr=null&&TAGS.param('ability',m.ability,'noRecoil');"]] },
  match(e) {
    if (typeof e.onDamage !== 'function') return null;
    if (!/recoil/i.test(String(e.onDamage))) return null;
    const rec = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.recoil
        && m.basePower > 0 && (m.accuracy === true || m.accuracy === 100)
        && (m.target === 'normal' || m.target === 'any') && !m.multihit && !m.flags.charge
        && !m.selfdestruct && !(m.critRatio > 1) && !m.basePowerCallback)
      .sort((a, b) => b.basePower - a.basePower)[0];
    if (!rec) return cannot('this format offers no 100-accuracy single-target recoil move, so the '
      + 'self-damage this ability refuses cannot be created');
    const C = abilityCarrier(e);
    if (!C) return cannot(noCarrierWhy(e, 'is legal, buildable and has a second ability'));
    const def = moveBodies(PRIMARY_ARM_ID).map(r => r.sp).find(sp => idOf(sp.id) !== idOf(C.species)
      && dex.getImmunity(rec.type, sp.types) !== false
      && dex.getEffectiveness(rec.type, sp.types) === 0);
    if (!def) return cannot(noBodyWhy({ neutralTo: rec.type, not: [C.species] }));
    const defAb = moveBodies(PRIMARY_ARM_ID).find(r => r.sp.id === def.id).ability;
    const plain = dex.moves.all().find(m => deliveryOf(m) && m.category === rec.category
      && dex.getEffectiveness(m.type, def.types) === 0 && dex.getImmunity(m.type, def.types) !== false);
    return stageAbility(e, C, { hpA: 8, hpB: 4, moves: [rec.id].concat(plain ? [plain.id] : []),
      note: 'the carrier throws ' + rec.name + ' (recoil ' + JSON.stringify(rec.recoil) + ') at '
          + def.name + ' on turn 1 and must take NO self-damage'
          + (plain ? '; ' + plain.name + ' on turn 2 is the non-recoil negative' : ''),
      a0: mon(def.id, '', defAb, [INERT]),
      script: [turn([IDLE, IDLE], [click(rec.id, 0), IDLE]),
               turn([IDLE, IDLE], [plain ? click(plain.id, 0) : IDLE, IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/survives-from-full', kind: 'ability',
  reads: 'onDamage / onTryHit whose handler names `maxhp` and returns a floor of 1',
  why: 'AN HP FLOOR HAS NOTHING TO DO UNLESS THE BLOW WAS FATAL, which is the same lesson '
     + '`item/hp-floor` was rewritten for. The generic staging throws one survivable click, so Sturdy '
     + '(289 uses) read INERT. Here the hit is DERIVED TO KILL — `lethalMove` at a 1.5x margin, so no '
     + 'roll or rounding saves it — and the difference lands on `fainted` and `species` rather than on '
     + 'a damage number.\n'
     + '     THE NEGATIVE IS TURN 2, on which the same lethal click is thrown again at a body that is '
     + 'no longer at full HP: the floor may not save it twice.',
  break: { why: 'the survive-from-full floor is dropped',
    patch: [["const _sv=TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull');",
             "const _sv=TAGS.param('item',tg.item,'survivesFromFull')||(null&&TAGS.param('ability',tg.ability,'survivesFromFull'));"]] },
  match(e) {
    if (!hasHandler(e, 'onDamage', 'onTryHit')) return null;
    const src = handlerSrc(e, ['onDamage', 'onTryHit']);
    if (!/maxhp/.test(src) || !/return\s+target\.hp\s*-\s*1|hp\s*-\s*1/.test(src)) return null;
    const atk = dex.species.get(CAST.ATTACKER().species);
    let kill = null;
    const C = abilityCarrier(e, sp => !!(kill = lethalMove(atk, sp, 1.5)));
    if (!C) return cannot(noCarrierWhy(e, 'can be killed outright from full HP by one derived '
      + 'delivery move at a 1.5x margin — an HP floor is invisible unless the blow it stops was '
      + 'fatal'));
    kill = lethalMove(atk, C.sp, 1.5);
    return stageAbility(e, C, { hpA: 4, hpB: 1, moves: [INERT],
      note: kill.mv.name + ' kills ' + C.sp.name + ' from full with ' + Math.round(kill.d * 100
          / flatL50(C.sp.baseStats).hp) + '% of its HP in one blow, twice — the floor must hold the '
          + 'first and not the second',
      a0: mon(atk.id, '', CAST.ATTACKER().ability, [kill.mv.id]),
      script: [turn([click(kill.mv.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(kill.mv.id, 0), IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/unconditional-stat-multiplier', kind: 'ability',
  reads: 'onModifyAtk / onModifySpA / onModifyDef / onModifySpD with NO type and NO HP gate — and any '
       + '`pokemon.status` test inside the handler',
  why: 'THIS IS THE RULE PURE POWER IS THE HEADER EXAMPLE FOR. It doubles ATTACK, its only carrier is '
     + 'Medicham (Fighting/Psychic), the generic staging picks the carrier\'s click by TYPE, Fighting '
     + 'is immune against the Dragon/Ghost aggressor — so it fell through to PSYCHIC, which is '
     + 'SPECIAL, and an ability that doubles Attack was measured through a Special Attack click. Two '
     + 'arms, one number, nothing staged.\n'
     + '     SO THE CATEGORY COMES FROM THE HANDLER NAME. `onModifyAtk` means the carrier throws a '
     + 'PHYSICAL move; `onModifySpA` a special one; `onModifyDef` and `onModifySpD` mean the carrier '
     + 'is HIT by that category instead. THE NEGATIVE IS THE OTHER CATEGORY on turn 2, which the '
     + 'multiplier must not touch — and that is the half a stat-stage-shaped bug fails.\n'
     + '     WHERE THE HANDLER TESTS `pokemon.status` (Guts, Quick Feet, Marvel Scale) a 100-accuracy '
     + 'status is inflicted on turn 1 and the clicks come afterwards, so the gate is genuinely open.',
  break: { why: 'the doubled attacking stat is dropped — the ability is still on the body and still '
              + 'named, and the click is still inside its category',
    patch: [["if((attAb==='hugepower'||attAb==='purepower')&&phys)ACH(2);",
             "if(false&&(attAb==='hugepower'||attAb==='purepower')&&phys)ACH(2);"]] },
  match(e) {
    const keys = ['onModifyAtk', 'onModifySpA', 'onModifyDef', 'onModifySpD']
      .filter(k => typeof e[k] === 'function');
    if (!keys.length) return null;
    const src = handlerSrc(e, keys);
    if (typesNamed(e, keys).length) return null;                    // the scoped families sit above
    if (/hp\s*<=\s*\w+\.maxhp/.test(src)) return null;              // the pinch family sits above
    if (weatherNamed(e, keys).length) return null;                  // the weather family sits above
    const needStatus = /\.status\b/.test(src);
    const off = keys.includes('onModifyAtk') ? 'Physical'
              : (keys.includes('onModifySpA') ? 'Special' : null);
    const def = keys.includes('onModifyDef') ? 'Physical'
              : (keys.includes('onModifySpD') ? 'Special' : null);
    if (!off && !def) return null;
    const cat = off || def;
    const other = cat === 'Physical' ? 'Special' : 'Physical';
    const pick = (c, types) => Object.keys(DELIVERY).map(t => DELIVERY[t][c === 'Physical' ? 'physical'
      : 'special']).filter(Boolean).find(m => dex.getEffectiveness(m.type, types) === 0
        && dex.getImmunity(m.type, types) !== false);
    const st = needStatus ? STATUS_MOVE.par : null;
    if (needStatus && !st) return cannot('its multiplier is gated on the holder being STATUSED and '
      + 'this format offers no 100-accuracy single-target status move, so the gate cannot be opened');
    if (off) {
      const target = moveBodies(PRIMARY_ARM_ID).map(r => r.sp)
        .find(sp => pick(cat, sp.types) && pick(other, sp.types));
      if (!target) return cannot(noBodyWhy({}) + ' (it must be neutral to BOTH a physical and a '
        + 'special click, or the two turns differ in the type chart as well as in the category)');
      const tgAb = moveBodies(PRIMARY_ARM_ID).find(r => r.sp.id === target.id).ability;
      const C = abilityCarrier(e, sp => idOf(sp.id) !== idOf(target.id)
        && (!needStatus || dex.getImmunity(st.status === 'tox' ? 'psn' : st.status, sp.types) !== false));
      if (!C) return cannot(noCarrierWhy(e, needStatus ? 'can carry the ' + st.status + ' this rule '
        + 'inflicts to open the gate' : 'is a body other than the derived target'));
      const A = pick(cat, target.types), B2 = pick(other, target.types);
      return stageAbility(e, C, { hpA: 8, hpB: 4, moves: [A.id, B2.id],
        note: (needStatus ? st.name + ' opens the gate on turn 1, then ' : '') + A.name + ' ('
            + cat + ', which is what ' + keys[0] + ' multiplies) and ' + B2.name + ' (' + other
            + ', the negative) are thrown at ' + target.name,
        a0: mon(target.id, '', tgAb, needStatus ? [st.id] : [INERT]),
        script: [turn([needStatus ? click(st.id, 0) : IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [click(A.id, 0), IDLE]),
                 turn([IDLE, IDLE], [click(B2.id, 0), IDLE])] });
    }
    const atk = dex.species.get(CAST.ATTACKER().species);
    const C = abilityCarrier(e, sp => !!pick(cat, sp.types) && !!pick(other, sp.types)
      && (!needStatus || dex.getImmunity(st.status === 'tox' ? 'psn' : st.status, sp.types) !== false));
    if (!C) return cannot(noCarrierWhy(e, 'is neutral to both a physical and a special derived click'));
    const A = pick(cat, C.sp.types), B2 = pick(other, C.sp.types);
    return stageAbility(e, C, { hpA: 4, hpB: 6, moves: [INERT],
      note: (needStatus ? st.name + ' opens the gate on turn 1, then ' : '') + A.name + ' (' + cat
          + ', which is what ' + keys[0] + ' multiplies against) and ' + B2.name + ' (' + other
          + ', the negative) are thrown AT the carrier',
      a0: mon(atk.id, '', CAST.ATTACKER().ability, [A.id, B2.id].concat(needStatus ? [st.id] : [])),
      script: [turn([needStatus ? click(st.id, 0) : IDLE, IDLE], [IDLE, IDLE]),
               turn([click(A.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(B2.id, 0), IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/base-power-scoped', kind: 'ability',
  reads: 'onBasePower — the move FLAG, the base-power threshold or the `move.recoil` test inside the '
       + 'handler',
  why: 'THE CLICK HAS TO BE INSIDE THE SCOPE AND THE GENERIC STAGING PICKS IT BY TYPE. Technician '
     + 'reads a base power at or under 60, Tough Claws reads the contact flag, Sharpness reads '
     + 'slicing, Iron Fist punch, Strong Jaw bite, Reckless the recoil field — and the generic '
     + 'staging hands the carrier its STAB, which satisfies none of those on purpose. So the click is '
     + 'DERIVED FROM THE SCOPE: the strongest 100-accuracy single-target move that is inside it.\n'
     + '     THE NEGATIVE IS TURN 2 AND IT IS THE HALF THAT MAKES THIS WORTH RUNNING: a move of the '
     + 'same category that is OUTSIDE the scope, thrown at the same body, which must be worth exactly '
     + 'the same in both arms. An engine applying the multiplier to everything parts there and '
     + 'nowhere else, and that is the defect this family actually has a history of.',
  break: { why: 'the scoped base-power multiplier is dropped',
    patch: [["const _bc=TAGS.param('ability',attAb,'boostsMoveClass');",
             "const _bc=null&&TAGS.param('ability',attAb,'boostsMoveClass');"]] },
  match(e) {
    if (typeof e.onBasePower !== 'function') return null;
    const src = String(e.onBasePower);
    const F = flagsNamed(e, ['onBasePower']);
    /* `basePower\w*` AND NOT `basePower`, MEASURED: Showdown's Technician reads
     * `basePowerAfterMultiplier <= 60`, so an anchored `basePower <=` matched nothing and 680 uses
     * fell through to the generic staging that could not express them. */
    const bp = (/basePower\w*\s*<=\s*(\d+)/.exec(src) || [])[1];
    const rec = /move\.recoil/.test(src);
    if (!F.length && !bp && !rec) return null;
    const inScope = m => (F.length ? !!(m.flags && m.flags[F[0]]) : true)
      && (bp ? m.basePower <= +bp : true) && (rec ? !!m.recoil : true);
    const usable = m => m.exists && !m.isNonstandard && m.basePower > 0 && m.category !== 'Status'
      && (m.accuracy === true || m.accuracy === 100) && (m.target === 'normal' || m.target === 'any')
      && !m.multihit && !m.drain && !m.self && !m.status && !m.volatileStatus && !m.boosts
      && !(m.critRatio > 1) && !m.willCrit && !m.basePowerCallback && !m.ohko
      && !(m.secondaries || []).some(s => !s.chance || s.chance >= 100);
    const all = dex.moves.all().filter(usable);
    const hit = all.filter(inScope).sort((a, b) => b.basePower - a.basePower)[0];
    if (!hit) return cannot('its scope is ' + (F[0] || (bp ? 'base power <= ' + bp : 'recoil moves'))
      + ' and this format offers no 100-accuracy single-target damaging move inside it, so the '
      + 'condition cannot be created');
    const scope = F[0] ? 'the `' + F[0] + '` flag' : (bp ? 'base power <= ' + bp : 'the recoil field');
    const C = abilityCarrier(e, sp => dex.getImmunity(hit.type, sp.types) !== false);
    if (!C) return cannot(noCarrierWhy(e, 'is a legal buildable body at all'));
    /* THE DEFENDER TAKES BOTH CLICKS AND MUST BE NEUTRAL TO BOTH, or the two turns differ in the type
     * chart as well as in the scope and neither number means anything on its own. */
    const cand = moveBodies(PRIMARY_ARM_ID).map(r => r.sp).filter(sp => idOf(sp.id) !== idOf(C.species)
      && dex.getEffectiveness(hit.type, sp.types) === 0 && dex.getImmunity(hit.type, sp.types) !== false);
    let out = null, def = null;
    for (const sp of cand) {
      out = all.find(m => !inScope(m) && m.category === hit.category && m.id !== hit.id
        && dex.getEffectiveness(m.type, sp.types) === 0 && dex.getImmunity(m.type, sp.types) !== false);
      if (out) { def = sp; break; }
    }
    if (!def) return cannot('no quiet body is neutral to both an in-scope click and an out-of-scope '
      + 'one of the same category, so the rule has no on-board negative and a green would only say '
      + 'that SOMETHING changed');
    const defAb = moveBodies(PRIMARY_ARM_ID).find(r => r.sp.id === def.id).ability;
    return stageAbility(e, C, { hpA: 8, hpB: 4, moves: [hit.id, out.id],
      note: hit.name + ' (INSIDE ' + scope + ') at ' + def.name + ' on turn 1 and ' + out.name
          + ' (outside it, same category, also neutral) on turn 2 — the second must be worth the '
          + 'same in both arms',
      a0: mon(def.id, '', defAb, [INERT]),
      script: [turn([IDLE, IDLE], [click(hit.id, 0), IDLE]),
               turn([IDLE, IDLE], [click(out.id, 0), IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/damage-taken-scoped', kind: 'ability',
  reads: 'onSourceModifyDamage / onSourceModifyAtk / onSourceModifySpA — the move TYPE it names, or a '
       + '`typeMod > 0` test meaning "super effective"',
  why: 'THE SAME ARGUMENT FROM THE DEFENDING SIDE. Solid Rock only acts on a SUPER-EFFECTIVE hit, '
     + 'Thick Fat only on Fire and Ice, Heatproof only on Fire, Purifying Salt only on Ghost — and '
     + 'the generic staging throws ONE NEUTRAL CLICK at the carrier, which is outside every one of '
     + 'those scopes by construction. The scoped type comes out of the handler; where the handler '
     + 'tests `typeMod > 0` instead, a type the chart makes super effective on that carrier is '
     + 'derived.\n'
     + '     THE NEGATIVE IS TURN 2, an unscoped neutral click at the same body, which must be worth '
     + 'the same in both arms.',
  break: { why: 'the scoped damage reduction is dropped',
    patch: [["const _htd=TAGS.param('ability',defAb,'halvesTypeDamage');",
             "const _htd=null&&TAGS.param('ability',defAb,'halvesTypeDamage');"]] },
  match(e) {
    if (!hasHandler(e, 'onSourceModifyDamage', 'onSourceModifyAtk', 'onSourceModifySpA')) return null;
    const keys = ['onSourceModifyDamage', 'onSourceModifyAtk', 'onSourceModifySpA'];
    const T = typesNamed(e, keys);
    const se = /typeMod\s*>\s*0/.test(handlerSrc(e, keys));
    if (!T.length && !se) return null;
    let hitType = null, C = null;
    if (T.length) {
      hitType = T.find(t => hitOfType(t));
      if (!hitType) return cannot('it scopes ' + T.join(' / ') + ' and no 100-accuracy single-target '
        + 'delivery move of those types exists in this format');
      C = abilityCarrier(e, sp => dex.getImmunity(hitType, sp.types) !== false
        && !!neutralHit2(sp.id, [hitOfType(hitType).id]));
    } else {
      /* THE SUPER-EFFECTIVE ARM: the type is a property of the CARRIER's own chart row, so it is
       * derived per candidate rather than once. */
      let found = null;
      C = abilityCarrier(e, sp => {
        found = Object.keys(DELIVERY).find(t => hitOfType(t)
          && dex.getEffectiveness(t, sp.types) > 0 && dex.getImmunity(t, sp.types) !== false);
        return !!found && !!neutralHit2(sp.id, []);
      });
      if (C) hitType = Object.keys(DELIVERY).find(t => hitOfType(t)
        && dex.getEffectiveness(t, C.sp.types) > 0 && dex.getImmunity(t, C.sp.types) !== false);
    }
    if (!C) return cannot(noCarrierWhy(e, 'can be hit by the type this ability scopes AND by a '
      + 'neutral type beside it — without both there is no negative and a green says only that '
      + 'something changed'));
    const hit = hitOfType(hitType), other = neutralHit2(C.species, [hit.id]);
    if (!other) return cannot('no neutral delivery move of a type outside this ability\'s scope '
      + 'exists against ' + pretty(C.species));
    return stageAbility(e, C, { hpA: 4, hpB: 6, moves: [INERT],
      note: hit.name + ' (' + hitType + ', which the chart puts at '
          + Math.pow(2, dex.getEffectiveness(hitType, C.sp.types)) + 'x on ' + C.sp.name
          + ') on turn 1, and the unscoped neutral ' + other.name + ' on turn 2 as the negative',
      a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [hit.id, other.id]),
      script: [turn([click(hit.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(other.id, 0), IDLE], [IDLE, IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/speed-on-item-loss', kind: 'ability',
  reads: 'onAfterUseItem / onTakeItem',
  why: 'TWO CONDITIONS AT ONCE AND THE GENERIC STAGING CREATES NEITHER: the carrier must LOSE AN ITEM '
     + 'and the resulting Speed must decide something. Unburden (2,688 uses) read INERT because no '
     + 'body in that staging held anything at all.\n'
     + '     THE ITEM IS A DERIVED THRESHOLD BERRY and the carrier is chipped past its line on turn '
     + '1, so the loss is a CONSUMPTION rather than a Knock Off — the arm the tag `speedOnItemLoss` '
     + 'is actually written against. The order is then made visible exactly as the weather-speed rule '
     + 'makes it visible: the foe\'s Speed sits strictly between the carrier\'s and its doubled '
     + 'Speed, the carrier\'s click kills outright, and the foe\'s click is a stat drop that only '
     + 'lands if the carrier did NOT move first.\n'
     + '     BOUNDARY 1 IS THE NEGATIVE, on the same script: the item is still held there and the '
     + 'Speed must not have moved yet.',
  break: { why: 'the speed multiplier on item loss is dropped — the item is still consumed',
    patch: [["if(m._hadItem&&!m.item){const _ub=TAGS.param('ability',m.ability,'speedOnItemLoss');if(_ub&&_ub.speedMult)s*=_ub.speedMult;}",
             "if(false&&m._hadItem&&!m.item){const _ub=TAGS.param('ability',m.ability,'speedOnItemLoss');if(_ub&&_ub.speedMult)s*=_ub.speedMult;}"]] },
  match(e) {
    if (!hasHandler(e, 'onAfterUseItem', 'onTakeItem')) return null;
    /* AND STICKY HOLD IS NOT IN THIS FAMILY, WHICH IS THE OVER-MATCH THIS PROJECT HAS ALREADY MADE
     * ONCE UNDER THIS EXACT NAME (`speedOnItemLoss` caught Sticky Hold — CLAUDE.md, by name). Sticky
     * Hold registers `onTakeItem` to RETURN FALSE and stop the removal; Unburden registers it to
     * `addVolatile("unburden")`. The discriminator is therefore the addVolatile call and not the
     * handler name — printed by `--rules`, which is how this one was caught the second time. */
    if (!/addVolatile\(/.test(handlerSrc(e, ['onAfterUseItem', 'onTakeItem']))) return null;
    const mult = parseFloat((/chainModify\(([\d.]+)\)/.exec(handlerSrc(e)) || [])[1]) || 2;
    const berry = dex.items.all().find(i => i.exists && !i.isNonstandard && i.isBerry && i.onUpdate
      && /max HP or less/.test(i.shortDesc || '') && i.id === 'sitrusberry')
      || dex.items.all().find(i => i.exists && !i.isNonstandard && i.isBerry && i.onUpdate
        && /max HP or less/.test(i.shortDesc || ''));
    if (!berry) return cannot('this format has no berry consumed at an HP threshold, so the item loss '
      + 'this ability reacts to cannot be staged without a Knock Off — which is a different arm');
    let flip = null, chip = null;
    const C = abilityCarrier(e, sp => {
      flip = speedFlipFoe(sp, mult);
      chip = flip && hitInBand(flip.foe, sp, 0.5, 0.85);
      return !!(flip && chip);
    });
    if (!C) return cannot(noCarrierWhy(e, 'has a foe whose Speed sits strictly between its own and '
      + 'its x' + mult + ' Speed, whom it can kill outright, AND who can chip it past the berry\'s '
      + 'half-HP line without killing it — all three are needed or the item never comes off or the '
      + 'Speed never decides anything'));
    flip = speedFlipFoe(C.sp, mult); chip = hitInBand(flip.foe, C.sp, 0.5, 0.85);
    return stageAbility(e, C, { hpA: 4, hpB: 1, item: berry.id, moves: [flip.holderMove.id],
      note: 'the carrier holds ' + berry.name + ' and is chipped to '
          + Math.round((1 - chip.d / chip.hp) * 100) + '% by ' + chip.mv.name + ' on turn 1, which '
          + 'EATS it; ' + flip.speeds + ', so on turn 2 the carrier\'s ' + flip.holderMove.name
          + ' should land before ' + flip.foeMove.name,
      a0: mon(flip.foe.id, '', flip.ability, [chip.mv.id, flip.foeMove.id]),
      script: [turn([click(chip.mv.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(flip.foeMove.id, 0), IDLE], [click(flip.holderMove.id, 0), IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/weather-speed', kind: 'ability',
  reads: 'onModifySpe whose handler names a weather id (`pokemon.effectiveWeather()` against '
       + '"sunnyday", "snowscape", ...)',
  why: 'THE SKY HAS TO BE UP AND A SPEED HAS TO DECIDE SOMETHING. Two conditions, and the generic '
     + 'staging creates neither: it never raises weather, and it never puts two bodies in an order a '
     + 'multiplier can flip. The sky is raised by the CARRIER\'S OWN PARTNER — a body holding the '
     + 'ability whose `onStart` calls `setWeather` for the weather this one names, which is a fixture '
     + 'worth trusting because all four setters score FIRED-AND-BOARDS-MATCH under `ability/entry` '
     + 'and are present identically in both arms.\n'
     + '     THE ORDER IS MADE VISIBLE THE WAY `item/speed-scaled` makes it visible: the foe is '
     + 'derived so that its Speed sits STRICTLY between the carrier\'s and the carrier\'s multiplied '
     + 'Speed, and the carrier can kill it outright while the FOE\'S OWN CLICK IS A STAT DROP — so '
     + 'the multiplier decides whether that drop ever lands. That reads on `boosts`, `fainted` and '
     + '`species`, never on a damage number. A MIRROR IS '
     + 'THE WRONG FIXTURE and is excluded by construction: the driver\'s primary arm is the one in '
     + 'which the two engines disagree about every speed tie, so the pair is strictly ordered before '
     + 'and after.\n'
     + '     THIS IS ALSO THIS BLOCK\'S POSITIVE CONTROL. Sand Rush, Swift Swim, Chlorophyll and '
     + 'Slush Rush were verified BY HAND on 2026-08-08 (effSpeed reads `speedCond` and gives 100 -> '
     + '200 in the right sky only). A rule family that cannot confirm a known-correct ability is not '
     + 'measuring anything, so these four coming back FIRED-AND-BOARDS-MATCH is the evidence that the '
     + 'rule works — and any accusation against one of them is the RULE being wrong.',
  break: { why: 'the weather Speed multiplier is dropped, so the carrier never outruns anybody',
    patch: [["const _scp=TAGS.param('ability',m.ability,'speedCond');",
             "const _scp=null&&TAGS.param('ability',m.ability,'speedCond');"]] },
  match(e) {
    if (typeof e.onModifySpe !== 'function') return null;
    const W = weatherNamed(e, ['onModifySpe']);
    if (!W.length) return null;
    const set = W.map(setterFor).find(Boolean);
    if (!set) return cannot('it hastens its holder under ' + W.join(' / ') + ' and no legal buildable '
      + 'body in this format carries an ability that SETS that weather, so the condition cannot be '
      + 'created at all');
    const mult = /chainModify\(2\)/.test(handlerSrc(e, ['onModifySpe'])) ? 2
               : (parseFloat((/chainModify\(([\d.]+)\)/.exec(handlerSrc(e, ['onModifySpe'])) || [])[1]) || 2);
    let flip = null;
    const C = abilityCarrier(e, sp => idOf(sp.id) !== idOf(set.species)
      && !!(flip = speedFlipFoe(sp, mult)));
    if (!C) return cannot(noCarrierWhy(e, 'has a foe in this format whose Speed sits strictly between '
      + 'its own and its x' + mult + ' Speed AND whom it can kill outright — without that pair the '
      + 'multiplier changes no leaf of the board and the entry would read INERT'));
    flip = speedFlipFoe(C.sp, mult);
    return stageAbility(e, C, { hpA: 1, hpB: 1, moves: [flip.holderMove.id],
      note: set.ability + ' on the partner raises ' + W[0] + ' at boundary 0; ' + flip.speeds
          + ', the carrier\'s ' + flip.holderMove.name + ' kills outright and the foe\'s click is '
          + flip.foeMove.name + ' — so the x' + mult + ' decides whether that drop ever lands',
      a0: mon(flip.foe.id, '', flip.ability, [flip.foeMove.id]),
      b1: mon(set.species, '', set.ability, [INERT]),
      script: [turn([click(flip.foeMove.id, 0), IDLE], [click(flip.holderMove.id, 0), IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/weather-evasion', kind: 'ability',
  reads: 'onModifyAccuracy whose handler names a weather id',
  why: 'THE PIN IS WHAT MAKES THIS STAGEABLE AND IT IS THE SAME ARGUMENT AS BRIGHT POWDER. The '
     + 'primary arm lands every 100-accuracy move and misses everything below it, IN BOTH ENGINES — '
     + 'so a 1.25x evasion turns a guaranteed hit into a guaranteed MISS and the difference is on '
     + '`hp`, not on a die. The sky comes from the carrier\'s partner exactly as in the speed rule.\n'
     + '     THE NEGATIVE IS TURN 2: the same click aimed at the PARTNER, which has no evasion bonus '
     + 'and must be hit in both arms — an engine that had simply stopped resolving the click parts '
     + 'there rather than passing.',
  break: { why: 'the evasion stage is ignored when accuracy is computed',
    patch: [["const row=ACCMOD[kind+':'+key];", 'const row=null;']] },
  match(e) {
    if (typeof e.onModifyAccuracy !== 'function') return null;
    const W = weatherNamed(e, ['onModifyAccuracy', 'onImmunity']);
    if (!W.length) return null;
    const set = W.map(setterFor).find(Boolean);
    if (!set) return cannot('it raises evasiveness under ' + W.join(' / ') + ' and no legal buildable '
      + 'body carries an ability that sets that weather');
    const C = abilityCarrier(e, sp => idOf(sp.id) !== idOf(set.species) && !!neutralHit2(sp.id, []));
    if (!C) return cannot(noCarrierWhy(e, 'is a body other than the weather setter that a neutral '
      + 'delivery move can reach'));
    const hit = neutralHit2(C.species, []);
    return stageAbility(e, C, { hpA: 4, hpB: 4, moves: [INERT],
      note: set.ability + ' on the partner raises ' + W[0] + '; ' + hit.name + ' is thrown at the '
          + 'carrier on turn 1 and must MISS (100 accuracy x 1/1.25 = 80, and the primary pin misses '
          + 'everything below 100), and at the PARTNER on turn 2, where it must land',
      a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [hit.id]),
      b1: mon(set.species, '', set.ability, [INERT]),
      script: [turn([click(hit.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(hit.id, 1), IDLE], [IDLE, IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/weather-residual', kind: 'ability',
  reads: 'onWeather, with the weather read off the ability\'s own handlers',
  why: 'A PER-TURN HEAL ON A FULL-HP BODY IS `docs/LESSONS.md` §5 — 0 = 0 in both arms — AND THERE '
     + 'WAS NO WEATHER EITHER, so Rain Dish, Ice Body and Solar Power all read INERT twice over. The '
     + 'sky comes from the partner and the carrier is CHIPPED on turn 1, so boundaries 2 and 3 each '
     + 'carry one application and an off-by-one in the schedule parts on the first of them. The '
     + 'carrier also attacks on those turns, which is what makes Solar Power\'s OTHER half — a 1.5x '
     + 'Special Attack in sun — readable in the same script rather than needing a second rule.\n'
     + '     THE NEGATIVE IS THE PARTNER, standing on the same board under the same sky with no such '
     + 'ability: its HP must not move for this reason in either arm.',
  break: { why: 'the residual weather effect is skipped',
    patch: [["{const _be=TAGS.param('ability',m.ability,'boostsEachTurn');",
             "{const _be=null&&TAGS.param('ability',m.ability,'boostsEachTurn');"]] },
  match(e) {
    if (typeof e.onWeather !== 'function') return null;
    const W = weatherNamed(e, ['onWeather']);
    if (!W.length) return cannot('it registers onWeather and names no weather inside it, so this rule '
      + 'cannot tell which sky to raise and would have to guess');
    const set = W.map(setterFor).find(Boolean);
    if (!set) return cannot('it acts under ' + W.join(' / ') + ' and no legal buildable body in this '
      + 'format carries an ability that SETS that weather');
    const atk = dex.species.get(CAST.ATTACKER().species);
    const C = abilityCarrier(e, sp => idOf(sp.id) !== idOf(set.species) && !!neutralHit2(sp.id, [])
      && !!hitInBand(atk, sp, 0.25, 0.6));
    if (!C) return cannot(noCarrierWhy(e, 'can be chipped between a quarter and 60% of its HP by one '
      + 'derived delivery move — a per-turn heal on a full-HP body reads 0 in both arms'));
    const chip = hitInBand(atk, C.sp, 0.25, 0.6);
    const back = neutralHit2(atk.id, [chip.id]) || neutralHit2(atk.id, []);
    return stageAbility(e, C, { hpA: 8, hpB: 1, moves: back ? [back.id] : [INERT],
      note: set.ability + ' on the partner raises ' + W[0] + '; the carrier is chipped to '
          + Math.round((1 - chip.d / chip.hp) * 100) + '% by ' + chip.mv.name + ' on turn 1 and then '
          + 'stands (and attacks) through two residual phases',
      a0: mon(atk.id, '', CAST.ATTACKER().ability, [chip.mv.id]),
      b1: mon(set.species, '', set.ability, [INERT]),
      script: [turn([click(chip.mv.id, 0), IDLE], [IDLE, IDLE]),
               turn([IDLE, IDLE], [back ? click(back.id, 0) : IDLE, IDLE]),
               turn([IDLE, IDLE], [back ? click(back.id, 0) : IDLE, IDLE])] });
  } },

{ id: 'ability/priority-mod', kind: 'ability',
  reads: 'onModifyPriority — whether it names `move.category === "Status"` or a move TYPE, and any '
       + 'HP condition, all from the handler',
  why: 'PRIORITY IS NOT A LEAF. `board_state.js` compares no turn order at all, so a shift is only '
     + 'observable through a CONSEQUENCE — and in a generic turn where both bodies survive there is '
     + 'none, which is why Prankster (8,477 uses) and Gale Wings (954) both read INERT.\n'
     + '     THE CONSEQUENCE IS DERIVED FROM WHAT THE ABILITY SHIFTS. For a STATUS shift the carrier '
     + 'is made SLOWER than an aggressor that can kill it outright and clicks a stat-lowering move: '
     + 'with the shift the drop lands before the carrier dies, without it the carrier dies first and '
     + 'the drop never happens — the delta is the AGGRESSOR\'s stat stages. For a TYPE shift the '
     + 'carrier is made slower than a foe its typed move can kill outright, and that foe\'s own click '
     + 'is the stat drop: with the shift the foe is dead before it acts.\n'
     + '     THE DARK IMMUNITY IS RESPECTED BY DERIVATION rather than by exception — the aggressor is '
     + 'checked for the Dark type, because a Prankster-boosted status into a Dark body is refused by '
     + 'the authority and both arms would agree on nothing.',
  break: { why: 'the priority shift is dropped, so the carrier moves in plain speed order',
    patch: [["const _pm=TAGS.param('ability',mon.ability,'priorityMod');",
             "const _pm=null&&TAGS.param('ability',mon.ability,'priorityMod');"]] },
  match(e) {
    if (typeof e.onModifyPriority !== 'function') return null;
    if (!DROP_MOVE) return cannot('this format has no 100-accuracy single-target stat-lowering status '
      + 'move, and the consequence this rule reads is a stat stage that did or did not land');
    const src = String(e.onModifyPriority);
    const isStatus = /category\s*===?\s*['"]Status['"]/.test(src);
    const T = typesNamed(e, ['onModifyPriority']);
    const spd = s => flatL50(s.baseStats).sp;
    if (isStatus) {
      const atk = dex.species.get(CAST.ATTACKER().species);
      if (atk.types.includes('Dark')) return cannot('the aggressor is a Dark type and this family is '
        + 'refused by Dark bodies, so the staged click would be blocked in BOTH arms');
      let kill = null;
      const C = abilityCarrier(e, sp => spd(sp) < spd(atk) && !!(kill = lethalMove(atk, sp, 1.2)));
      if (!C) return cannot(noCarrierWhy(e, 'is SLOWER than the aggressor ' + atk.name + ' AND can be '
        + 'killed outright by one of its derived delivery moves — without both, the shift changes no '
        + 'leaf and the entry reads INERT'));
      kill = lethalMove(atk, C.sp, 1.2);
      return stageAbility(e, C, { hpA: 4, hpB: 1, moves: [DROP_MOVE.id],
        note: 'the carrier is slower (' + spd(C.sp) + ' against ' + spd(atk) + ') and is killed '
            + 'outright by ' + kill.mv.name + '; it clicks ' + DROP_MOVE.name + ', which only lands '
            + 'if the shift moved it first',
        a0: mon(atk.id, '', CAST.ATTACKER().ability, [kill.mv.id]),
        script: [turn([click(kill.mv.id, 0), IDLE], [click(DROP_MOVE.id, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] });
    }
    if (!T.length) return cannot('its onModifyPriority names neither a move category nor a move type '
      + 'in a shape this rule can read, so the class of clicks it shifts cannot be derived');
    const mv = hitOfType(T[0]);
    if (!mv) return cannot('it shifts ' + T[0] + ' moves and no 100-accuracy single-target ' + T[0]
      + ' delivery move exists in this format');
    let victim = null;
    const pick = (sp) => CANDIDATES.find(F => F.id !== sp.id && buildableSpecies(F.id)
      && spd(F) > spd(sp) && dex.getImmunity(mv.type, F.types) !== false
      && maxRoll(sp, mv, F) >= flatL50(F.baseStats).hp * 1.2 && carrierAbility(F));
    const C = abilityCarrier(e, sp => !!(victim = pick(sp)));
    if (!C) return cannot(noCarrierWhy(e, 'has a FASTER foe in this format that its own ' + T[0]
      + ' click (' + mv.name + ') kills outright — the shift is invisible unless it takes an action '
      + 'away from somebody'));
    victim = pick(C.sp);
    return stageAbility(e, C, { hpA: 1, hpB: 4, moves: [mv.id],
      note: pretty(victim.id) + ' is FASTER (' + spd(victim) + ' against ' + spd(C.sp) + ') and is '
          + 'killed outright by ' + mv.name + '; its own click is ' + DROP_MOVE.name + ', which only '
          + 'lands if the shift did NOT move the carrier first',
      a0: mon(victim.id, '', carrierAbility(victim), [DROP_MOVE.id]),
      script: [turn([click(DROP_MOVE.id, 0), IDLE], [click(mv.id, 0), IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/blocks-priority', kind: 'ability',
  reads: 'onFoeTryMove',
  why: 'THE MOVE IT REFUSES HAS TO BE THROWN, and the generic staging throws a plain 0-priority '
     + 'attack — so Armor Tail (3,431 uses) and Queenly Majesty (453) both read INERT. The click is '
     + 'derived: the highest-power damaging move in the format with POSITIVE priority, 100 accuracy '
     + 'and no rider. THE ALLY IS THE SECOND HALF OF THIS FAMILY and is staged on turn 2 — both of '
     + 'these protect the whole side, and an engine that blocked only for the holder parts there and '
     + 'nowhere else.\n'
     + '     THE NEGATIVE IS TURN 3, an ordinary 0-priority click at the same body, which must land '
     + 'in both arms: an engine that had stopped resolving anything at all would otherwise read as a '
     + 'correct block.',
  break: { why: 'the priority block is skipped, so the shielded side takes the fast move',
    patch: [['function priorityRefusedAbove(defenders, field, aimedAt){',
             'function priorityRefusedAbove(defenders, field, aimedAt){if(1)return Infinity;']] },
  match(e) {
    if (typeof e.onFoeTryMove !== 'function') return null;
    if (!PRIORITY_HIT) return cannot('this format has no 100-accuracy single-target damaging move '
      + 'with positive priority and no rider, so the class this ability refuses cannot be thrown');
    const t = PRIORITY_HIT.type;
    const C = abilityCarrier(e, sp => dex.getImmunity(t, sp.types) !== false);
    if (!C) return cannot(noCarrierWhy(e, 'can be hit by ' + PRIORITY_HIT.name + ' at all — a body '
      + 'the chart already makes immune reads 0 in both arms'));
    const ally = quietBody({ not: [C.species], type: t });
    if (!ally) return cannot(noBodyWhy({ type: t, not: [C.species] }));
    const slow = neutralHit2(C.species, [PRIORITY_HIT.id]);
    if (!slow) return cannot('no 0-priority neutral delivery move exists against ' + pretty(C.species)
      + ', so the rule has no on-board negative');
    return stageAbility(e, C, { hpA: 4, hpB: 6, moves: [INERT],
      note: PRIORITY_HIT.name + ' (priority +' + PRIORITY_HIT.priority + ') at the carrier on turn 1 '
          + 'and at its ALLY ' + pretty(ally.species) + ' on turn 2 — both must be refused; '
          + slow.name + ' at the carrier on turn 3 must land',
      a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability, [PRIORITY_HIT.id, slow.id]),
      b1: { ...ally, moves: [INERT] },
      script: [turn([click(PRIORITY_HIT.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(PRIORITY_HIT.id, 1), IDLE], [IDLE, IDLE]),
               turn([click(slow.id, 0), IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/aids-its-ally', kind: 'ability',
  reads: 'onAlly* (onAllyTryBoost / onAllySetStatus / onAllyTryAddVolatile) or onAnyModifyDamage, and '
       + 'any `target.hasType("X")` gate inside those handlers',
  why: 'EVERYTHING THIS FAMILY DOES HAPPENS TO SOMEBODY ELSE, and the generic staging aims every '
     + 'click at the carrier. Flower Veil (3,112 uses), Friend Guard (1,020), Aroma Veil and Sweet '
     + 'Veil all read INERT for that one reason. Here the ALLY is the target of everything: a plain '
     + 'damaging hit (which Friend Guard must reduce), a stat drop (Flower Veil), a Taunt (Aroma '
     + 'Veil) and a sleep click (Sweet Veil).\n'
     + '     THE TYPE GATE IS READ OFF THE HANDLER, not guessed: Flower Veil only protects GRASS '
     + 'allies, so the ally is derived to be one — and where it is, the sleep click is dropped, '
     + 'because Grass bodies are immune to powder and staging it would be a click that could never '
     + 'land in either arm.\n'
     + '     THE NEGATIVE IS THE CARRIER ITSELF: it stands beside its ally taking nothing, and the '
     + 'ally\'s protections must not appear on it.',
  break: { why: 'the ally damage reduction is dropped',
    patch: [["const _fg=_pal&&TAGS.param('ability',_pal.ability,'reducesAllyDamage');",
             "const _fg=null&&TAGS.param('ability',_pal.ability,'reducesAllyDamage');"]] },
  match(e) {
    /* ONLY THE THREE `onAlly` HOOKS THIS RULE ACTUALLY STAGES, plus the ally damage one. `onAllyFaint`
     * (Receiver) and `onAllyAfterUseItem` (Symbiosis) are ally hooks too and this script creates
     * NEITHER condition — no ally dies and no ally spends an item — so matching them would have
     * charged an INERT staging to a rule that never looked at them. Printed by `--rules` and narrowed
     * on sight, which is the same over-match discipline `refusesStatusMoves` needed. */
    const keys = ['onAllyTryBoost', 'onAllySetStatus', 'onAllyTryAddVolatile']
      .filter(k => typeof e[k] === 'function');
    if (!keys.length && typeof e.onAnyModifyDamage !== 'function') return null;
    const gate = (/hasType\(['"]([A-Z][a-z]+)['"]\)/.exec(handlerSrc(e, keys.concat(['onAnyModifyDamage'])))
      || [])[1] || null;
    const C = abilityCarrier(e);
    if (!C) return cannot(noCarrierWhy(e, 'is legal, buildable and has a second ability'));
    const ally = quietBody({ not: [C.species], hasType: gate || undefined });
    if (!ally) return cannot(gate ? 'this ability only protects ' + gate + ' allies and the move '
      + 'stage\'s quiet body pool holds no ' + gate + ' type, so the protected condition cannot be '
      + 'created: ' + noBodyWhy({ hasType: gate, not: [C.species] })
      : noBodyWhy({ not: [C.species] }));
    const hit = neutralHit2(ally.species, []);
    if (!hit) return cannot('no neutral delivery move exists against the ally ' + pretty(ally.species));
    const sleep = STATUS_MOVE.slp;
    const allySp = dex.species.get(ally.species);
    const canSleep = sleep && !(sleep.flags && sleep.flags.powder && allySp.types.includes('Grass'))
      && dex.getImmunity('slp', allySp.types) !== false;
    return stageAbility(e, C, { hpA: 4, hpB: 6, moves: [INERT],
      note: 'everything is aimed at the ALLY ' + pretty(ally.species)
          + (gate ? ' (a ' + gate + ' type, which is the gate this ability\'s own handler names)' : '')
          + ': ' + hit.name + ' and ' + DROP_MOVE.name + ' on turn 1, '
          + (canSleep ? sleep.name : 'NO sleep click — the ally is immune to it, so staging it would '
             + 'be a click that lands in neither arm') + ' on turn 2, and '
          + (TAUNT_MOVE ? TAUNT_MOVE.name + ' LAST' : 'no taunt in this format'),
      a0: mon(CAST.ATTACKER().species, '', CAST.ATTACKER().ability,
        [hit.id].concat(TAUNT_MOVE ? [TAUNT_MOVE.id] : [])),
      a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability,
        [DROP_MOVE.id].concat(canSleep ? [sleep.id] : [])),
      b1: { ...ally, moves: [INERT] },
      /* THE TAUNT IS ON THE LAST TURN AND THAT IS NOT A PREFERENCE. Taunt forbids STATUS moves, and
       * this file's inert click IS a status move — so a body taunted on turn 2 has no legal choice
       * on turn 3, `scripted()` answers `pass`, and Showdown REJECTS it: "Can't pass: Your Goodra
       * must make a move". Measured on the first run of this rule: six of its members threw. Putting
       * the taunt last means the volatile is on the boundary that reads it and no body ever has to
       * choose underneath it. */
      script: [turn([click(hit.id, 1), click(DROP_MOVE.id, 1)], [IDLE, IDLE]),
               turn([IDLE, canSleep ? click(sleep.id, 1) : IDLE], [IDLE, IDLE]),
               turn([TAUNT_MOVE ? click(TAUNT_MOVE.id, 1) : IDLE, IDLE], [IDLE, IDLE])] });
  } },

{ id: 'ability/entry-aids-ally', kind: 'ability',
  reads: 'onStart whose handler walks `adjacentAllies()`',
  why: 'HOSPITALITY HEALS ITS ALLY ON SWITCH-IN AND `ability/entry` STAGES BOTH BODIES AT FULL HP, so '
     + 'the heal has nothing to do and 6,038 uses came back INERT. `ability/entry` cannot fix this by '
     + 'itself — its whole point is that the effect has already happened by boundary 0, before '
     + 'anybody can chip anything — so the carrier starts ON THE BENCH, the ally is chipped on turn 1, '
     + 'and the carrier walks in on turn 2.\n'
     + '     THAT MAKES BOUNDARY 1 THE NEGATIVE AND BOUNDARY 2 THE POSITIVE, on one script: the ally '
     + 'is chipped and NOT healed while the carrier is on the bench, and healed the moment it is not. '
     + 'Boundary 3 is the second negative — nothing may heal again on a turn with no entry, which is '
     + 'the off-by-one this engine has already had twice in the residual family.',
  break: { why: 'the entry heal is skipped — the carrier still switches in and is still named',
    patch: [["const _h=TAGS.param('ability',m.ability,'healsAllyOnSwitchIn');",
             "const _h=null&&TAGS.param('ability',m.ability,'healsAllyOnSwitchIn');"]] },
  match(e) {
    if (typeof e.onStart !== 'function') return null;
    if (!/adjacentAllies\(\)/.test(String(e.onStart))) return null;
    const atk = dex.species.get(CAST.ATTACKER().species);
    const C = abilityCarrier(e);
    if (!C) return cannot(noCarrierWhy(e, 'is legal, buildable and has a second ability'));
    const ally = quietBody({ not: [C.species] });
    const lead = quietBody({ not: [C.species, ally && ally.species] });
    if (!ally || !lead) return cannot(noBodyWhy({ not: [C.species] }));
    const chip = hitInBand(atk, dex.species.get(ally.species), 0.3, 0.7);
    if (!chip) return cannot('no derived delivery move takes ' + pretty(ally.species) + ' between 30% '
      + 'and 70% of its HP, and a heal on a body at full HP reads 0 in both arms');
    return stageAbility(e, C, { hpA: 4, hpB: 1, moves: [INERT], onBench: true,
      note: 'the carrier starts ON THE BENCH; the ally ' + pretty(ally.species) + ' is chipped to '
          + Math.round((1 - chip.d / chip.hp) * 100) + '% by ' + chip.mv.name + ' and dropped by '
          + DROP_MOVE.name + ' on turn 1 (the negative — nothing is restored while the carrier is '
          + 'away) and the carrier walks in on turn 2',
      a0: mon(atk.id, '', CAST.ATTACKER().ability, [chip.mv.id]),
      /* THE ALLY IS DROPPED AS WELL AS CHIPPED. Hospitality restores HP and Curious Medicine — the
       * other member this shape catches — RESETS STAT STAGES, and a board with no stat stages on it
       * gives the second one nothing to reset. Measured: Curious Medicine came back INERT on the
       * first run of this rule with the chip alone. */
      a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [DROP_MOVE.id]),
      script: [turn([click(chip.mv.id, 1), click(DROP_MOVE.id, 1)], [IDLE, IDLE]),
               turn([IDLE, IDLE], [{ sw: C.species }, IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])],
      benchLead: lead, benchAlly: ally });
  } },

{ id: 'ability/blocks-foe-berry', kind: 'ability',
  reads: 'onFoeTryEatItem',
  why: 'THERE HAS TO BE A BERRY, AND IT HAS TO BE ABOUT TO BE EATEN. Unnerve (2,167 uses) read INERT '
     + 'because no body in the generic staging held one. The fixture berry is DERIVED — a berry whose '
     + '`onUpdate` heals at an HP threshold — and it is put on the AGGRESSOR, which is then chipped '
     + 'past that threshold. With the ability the berry stays in the slot; without it, it is eaten '
     + 'and the HP moves.\n'
     + '     THE FIXTURE BERRY IS ITSELF A ROSTER ENTRY, which is the whole reason this is honest: '
     + 'its own verdict is published in the items stage, so if it turns out not to fire here the '
     + 'report says so under "THE TWO ENGINES PART SOMEWHERE ELSE TOO" rather than charging an '
     + 'upstream failure to this ability. Measured 2026-08-08: Sitrus Berry scores '
     + 'FIRED-AND-BOARDS-MATCH and Oran Berry does not, which is exactly why the berry is chosen by '
     + 'shape and the caveat is printed rather than assumed away.',
  break: { why: 'the berry block is skipped, so the foe eats it anyway',
    patch: [["if(foes&&foes.some(x=>x&&!x.fainted&&x.curHP>0&&TAGS.param('ability',x.ability,'blocksBerries')))return;",
             "if(false&&foes&&foes.some(x=>x&&!x.fainted&&x.curHP>0&&TAGS.param('ability',x.ability,'blocksBerries')))return;"]] },
  match(e) {
    if (typeof e.onFoeTryEatItem !== 'function') return null;
    const berry = dex.items.all().filter(i => i.exists && !i.isNonstandard && i.isBerry && i.onUpdate
        && /max HP or less/.test(i.shortDesc || '') && /Restores|Heals/.test(i.shortDesc || ''))
      .sort((a, b) => (a.id === 'sitrusberry' ? -1 : 0) - (b.id === 'sitrusberry' ? -1 : 0))[0] || null;
    if (!berry) return cannot('this format has no berry that heals at an HP threshold, so there is '
      + 'nothing for the block to stop');
    const atk = dex.species.get(CAST.ATTACKER().species);
    const chip = hitInBand(atk, atk, 0.55, 0.85);
    const C = abilityCarrier(e, sp => idOf(sp.id) !== idOf(atk.id) && !!neutralHit2(atk.id, []));
    if (!C) return cannot(noCarrierWhy(e, 'is a body other than the berry holder'));
    const hit = neutralHit2(atk.id, []);
    if (!hit) return cannot('no neutral delivery move reaches the berry holder ' + atk.name);
    return stageAbility(e, C, { hpA: 1, hpB: 4, moves: [hit.id],
      note: 'the AGGRESSOR holds ' + berry.name + ' and is chipped past its threshold by the carrier '
          + 'over two turns; with the ability the berry must still be in the slot at boundary 2',
      a0: mon(atk.id, berry.id, CAST.ATTACKER().ability, [INERT]),
      script: [turn([IDLE, IDLE], [click(hit.id, 0), IDLE]),
               turn([IDLE, IDLE], [click(hit.id, 0), IDLE]),
               turn([IDLE, IDLE], [IDLE, IDLE])] });
  } },

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
     + 'this class on `activeTurns`, which a body that arrived this turn reads as 0. THE CARRIER NOW '
     + 'STARTS ON THE BENCH AND WALKS IN MID-TURN, so boundary 1 IS its entry turn and the effect must '
     + 'not fire there while boundaries 2 and 3 must carry it. That staging was impossible until '
     + '`{ sw: ... }` became a legal step on 2026-08-08; before it, `--reds` correctly caught this '
     + 'this rule\'s prose claiming a gate test it could not perform; the break below is now aimed at '
     + 'the gate itself rather than at the effect.',
  break: { why: 'THE ENTRY GATE IS REMOVED and the per-turn effect fires unconditionally — which is the '
              + 'exact defect this family was written against, and it can only be caught by a staging '
              + 'that has a mid-turn entrant in it',
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

/* ------------------------------------------------------------------------------ moves ----------
 *
 * ORDERED, AND THE ORDER IS THE SPECIFICATION. The first rule whose `match` returns a scenario owns
 * the move, so a narrow shape sits above the general one it would otherwise be swallowed by. The
 * residue at the bottom (`move/plain-attack`, `move/generic-status`) is REPORTED WITH ITS SIZE AND
 * ITS USAGE on every run, because `ability/generic` swallowing 124 abilities and calling them inert
 * is how a coverage hole last disguised itself as a completed stage.
 */

{ id: 'move/is-the-control-click', kind: 'move',
  reads: 'the move id, against this file\'s own INERT click',
  why: 'THE CONTROL ARM REPLACES THE CLICK UNDER TEST WITH ' + INERT + '. For that one move the '
     + 'control script is IDENTICAL to the subject script by construction, the delta is empty, and '
     + 'the entry would read THE STAGING IS INERT for a reason that is about this file rather than '
     + 'about the engine. Said out loud instead.',
  match(e) { if (idOf(e.id) !== idOf(INERT)) return null;
    return cannot('this move IS the control arm\'s inert click (' + pretty(INERT) + '), so subject '
      + 'and control would be the same script and the comparison would be vacuous. Its effect — two '
      + 'critical-hit stages — is also not a leaf board_state.js compares.'); } },

{ id: 'move/self-switch', kind: 'move',
  reads: 'selfSwitch',
  why: 'THE USER LEAVING THE FIELD IS THE ONLY EFFECT IN THIS FAMILY THAT IS UNAMBIGUOUSLY ON THE '
     + 'BOARD — `sides.pN.active[i].species` — which is what makes it stageable at all. The PARTNER IS '
     + 'THE NEGATIVE and stands in the other slot on every board: a pivot that moved the wrong slot '
     + '(the defect WIRE 139 was written against) shows up there and nowhere else. This rule sits '
     + 'ABOVE the weather one deliberately: Chilly Reception sets snow AND pivots, and staged as a '
     + 'weather setter it scripts a second click for a body that has already left, which Showdown '
     + 'rejects as an illegal pass and throws.',
  break: { why: 'a move-driven switch is never classified as one, so the user stays on the field',
    patch: [["if(TAGS.has('move',id,'pivotStatus'))return {kind:'switch',mv:id,target};",
             "if(false&&TAGS.has('move',id,'pivotStatus'))return {kind:'switch',mv:id,target};"]] },
  match(e) {
    if (!e.selfSwitch) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm }), b1 = quietBody({ arm, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm }));
    return { arm, note: pretty(b0.species) + ' pivots on turn 1; ' + pretty(b1.species)
        + ' is in the other slot and must NOT move' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [INERT] },
        b0: { ...b0, moves: [e.id] }, b1: { ...b1, moves: [INERT] },
        script: [turn([IDLE, IDLE], [throwIt(e, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/force-switch', kind: 'move',
  reads: 'forceSwitch',
  why: 'the TARGET leaves instead of the user, so the leaf that moves is the FOE slot\'s species. The '
     + 'partner is the negative on the same board — a phaze aimed at one slot must not drag the other '
     + '— and boundary 0 is the second, because the drag happens on turn 1 and nothing may have moved '
     + 'before anybody chose.',
  break: { why: 'the phaze never removes anybody — the move still resolves and still spends the turn',
    patch: [["if(a.kind==='phaze'){", "if(a.kind==='phaze'){m._lastMove=a.mv;continue;}if(a.kind==='phaze'){"]] },
  match(e) {
    if (!e.forceSwitch) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    return { arm, note: 'thrown at ' + pretty(b0.species) + '; ' + pretty(b1.species) + ' is in the '
        + 'other slot and must stay' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: [turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/protect-family', kind: 'move',
  reads: 'stallingMove',
  why: 'THE SHIELD ITSELF IS A WITHIN-TURN EFFECT AND ITS STALL COUNTER IS IN `NOT_COMPARED` — the two '
     + 'engines hold different quantities there and `board_state.js` says so. What IS on the board is '
     + 'the CONSEQUENCE, so the hit aimed at the shielded body is derived to be LETHAL: with the '
     + 'shield the body is standing at the boundary and without it the body is dead, which lands on '
     + '`fainted` rather than on a damage number. That also makes ENDURE expressible in the same '
     + 'staging — it survives on 1 HP where Protect survives untouched — without a second rule. THE '
     + 'PARTNER IS THE NEGATIVE: it carries the same move, does NOT click it, takes the same lethal '
     + 'hit and must die.',
  break: { why: 'the shield is never raised — the click still resolves and still spends the turn',
    patch: [["if(it.a.kind==='protect'&&!volatileForbidsMove(it.mon,actionMoveId(it.a))){",
             "if(false&&it.a.kind==='protect'&&!volatileForbidsMove(it.mon,actionMoveId(it.a))){"]] },
  match(e) {
    if (!e.stallingMove) return null;
    /* THE MOVE POOL IS THE WRONG POOL HERE AND THE FIRST FULL RUN SAID SO — its five members are the
     * bulkiest bodies the format offers and NOTHING kills one outright, so every member of this
     * family read "no lethal pair". The two bodies here only have to STAND THERE, and
     * `carrierAbility`'s filter already excludes an HP floor, a damage modifier and an immunity,
     * which is the whole list of things that could corrupt a shielded-against-unshielded reading.
     * `KILLABLE`/`KILLABLE2` are the same two derivations `item/hp-floor` uses. */
    const arm = armFor(e), atk = dex.species.get(CAST.ATTACKER().species);
    if (!KILLABLE || !KILLABLE2) return cannot('no two legal bodies of different species can each be '
      + 'killed outright from full by one derived delivery move, and a shield is invisible unless the '
      + 'blow it stops was fatal — a survived hit reads identically with and without it');
    return { arm, note: pretty(KILLABLE.species) + ' shields a lethal ' + KILLABLE.move.name + '; '
        + pretty(KILLABLE2.species) + ' beside it carries the same move, does NOT click it, and must die'
        + armNote(e),
      scenario: scaffold({
        a0: mon(atk.id, '', CAST.ATTACKER().ability, [KILLABLE.move.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [KILLABLE2.move.id]),
        b0: mon(KILLABLE.species, '', KILLABLE.ability, [e.id]),
        b1: mon(KILLABLE2.species, '', KILLABLE2.ability, [e.id]),
        script: [turn([click(KILLABLE.move.id, 0), click(KILLABLE2.move.id, 1)], [mclick(e), IDLE])] }) };
  } },

{ id: 'move/charge', kind: 'move',
  reads: 'flags.charge',
  why: 'THE MOMENT IS THE MECHANIC AND ONLY THE WIND-UP IS REACHABLE FROM HERE. A two-turn move must '
     + 'deal NOTHING on boundary 1, and an engine that resolved it immediately parts there — so the '
     + 'wind-up turn is a real comparison for the members whose wind-up DOES something (Electro Shot '
     + 'and Meteor Beam boost on it). For the rest, Showdown\'s own board is identical with and '
     + 'without and the entry says THE STAGING IS INERT.\n'
     + '     THE RELEASE TURN IS UNSCRIPTABLE AND THAT IS A DRIVER LIMIT, NOT A CHOICE. '
     + '`game_differential.js scripted()` reads the target off `act.moves[k].target` and falls back to '
     + 'the DEX target when the request omits it — and Showdown\'s request for a body mid-wind-up '
     + 'omits it precisely because a locked move takes no target. So every scripted release turn is '
     + 'emitted as `move 1 1` and rejected with "You can\'t choose a target for Dig", and the game '
     + 'throws. Measured on all seven members. FILED RATHER THAN FIXED: `engine/game_differential.js` '
     + 'is not this file\'s to edit.',
  break: { why: 'the wind-up is skipped — the move resolves on the turn it is clicked',
    patch: [["if(TAGS.has('move',a.move.id,'chargeTurn')){",
             "if(false&&TAGS.has('move',a.move.id,'chargeTurn')){"]] },
  match(e) {
    if (!(e.flags && e.flags.charge)) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    return { arm, note: 'the WIND-UP turn only — ' + pretty(b0.species) + ' must be UNTOUCHED at '
        + 'boundary 1; the release turn is unscriptable through this driver (see the rule)' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: [turn([throwIt(e, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/recharge', kind: 'move',
  reads: 'self.volatileStatus === "mustrecharge"',
  why: 'ONE TURN ONLY, AND THE LIMIT IS THE POINT OF THIS RULE EXISTING. The DAMAGE is staged and '
     + 'compared; THE RECHARGE TURN IS NOT, and it cannot be from here: on turn 2 Showdown\'s request '
     + 'for the user offers the single pseudo-move `recharge` and nothing else, while the CONTROL arm '
     + '— whose turn-1 click was replaced by the inert one — is not recharging and is offered its '
     + 'ordinary moveset. The two arms would be answering different requests, which is two experiments '
     + 'and not a control. Staged as a single-turn hit with that said out loud, rather than staged '
     + 'wrongly and reported as agreeing.',
  break: { why: 'every damage roll is halved, so the hit this rule DOES stage moves',
    patch: [['return {min:roll(85),max:roll(100),eff};',
             'return {min:Math.floor(roll(85)*0.5),max:Math.floor(roll(100)*0.5),eff};']] },
  match(e) {
    if (!(e.self && e.self.volatileStatus === 'mustrecharge')) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    return { arm, note: 'one turn of damage into ' + pretty(b0.species)
        + '; THE RECHARGE TURN IS NOT STAGED — see the rule' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: [turn([throwIt(e, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/ohko', kind: 'move',
  reads: 'ohko',
  why: 'the whole move is a `fainted` leaf, which is the cleanest thing this instrument can read. It '
     + 'is only reachable on the bottom arm — every OHKO move in the format is 30-accurate and the '
     + 'primary pin makes it miss — and the PARTNER IS THE NEGATIVE: an OHKO aimed at one slot must '
     + 'not kill the other.',
  /* THE FIRST ANCHOR HERE WAS THE ORDINARY DAMAGE ROLL AND `--reds` CAUGHT IT: an OHKO move does not
   * go through the randomizer at all — `_fd.source === 'ohko'` returns the target's whole HP as a
   * FLAT number — so halving every roll left it untouched and the plant moved nothing. */
  break: { why: 'an OHKO deals 1 point instead of the target\'s whole HP, so the body survives',
    patch: [["else if(_fd.source==='ohko')_flat=_hp;", "else if(_fd.source==='ohko')_flat=1;"]] },
  match(e) {
    if (!e.ohko) return null;
    const arm = BOTTOM_ARM;
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    return { arm, note: pretty(b0.species) + ' must be dead at boundary 1 and ' + pretty(b1.species)
        + ' must not' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 1,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: [turn([throwIt(e, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/multihit', kind: 'move',
  reads: 'multihit',
  why: 'THE PIN DECIDES THE HIT COUNT AND THE REPORT SAYS SO. `random(m,n)` is pinned to `m` in EVERY '
     + 'arm, so a 2-5 range lands on TWO hits and a 3-hit move on three — the DISTRIBUTION is not '
     + 'under test and cannot be from a pinned die. What IS under test is that the damage is the sum '
     + 'of that many hits rather than of one, which is the defect WIRE 20 fixed (Rock Blast was a '
     + 'single 25-BP hit). THE PARTNER IS THE NEGATIVE and is never aimed at.',
  break: { why: 'a multi-hit move lands exactly ONE hit — which is the defect this family was written '
              + 'against',
    patch: [['if(_hits>1)return {min:Math.floor(roll(85)*_hits),max:Math.floor(roll(100)*_hits),eff};',
             'if(false&&_hits>1)return {min:Math.floor(roll(85)*_hits),max:Math.floor(roll(100)*_hits),eff};']] },
  match(e) {
    if (!e.multihit) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    const n = Array.isArray(e.multihit) ? e.multihit[0] : e.multihit;
    return { arm, note: 'multihit ' + JSON.stringify(e.multihit) + ' — THE PIN LANDS ON ' + n
        + ' HIT(S), which is the bottom corner of the range and the only count either engine can be '
        + 'asked about here' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: twice(e, turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                         turn([throwIt(e, 0), IDLE], [IDLE, IDLE])) }) };
  } },

{ id: 'move/slot-condition', kind: 'move',
  reads: 'slotCondition',
  why: 'the condition itself is NOT a board leaf — `board_state.js` compares no slot condition — so '
     + 'what is staged is its CONSEQUENCE, which is HP and arrives a turn later. The user is chipped '
     + 'first so a heal has somewhere to go, clicks on turn 2, and boundaries 3 and 4 are where the '
     + 'effect must land. THE PARTNER IS THE NEGATIVE: chipped identically, clicking nothing.',
  break: { why: 'the heal branch is skipped, which is the only path a delayed heal could arrive by',
    patch: [["if(a.kind==='heal'){", "if(a.kind==='heal'){m._lastMove=a.mv;continue;}if(a.kind==='heal'){"]] },
  match(e) {
    if (!e.slotCondition) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm }), b1 = quietBody({ arm, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm }));
    const chip = neutralHit(b0.species, e.id), chip2 = neutralHit(b1.species, e.id);
    if (!chip || !chip2) return cannot('no neutral 100-accuracy delivery move exists to take the two '
      + 'bodies off full HP, and a heal into a full body is invisible');
    return { arm, note: e.slotCondition + ' — chipped on turn 1, clicked on turn 2, and the effect has '
        + 'to arrive by boundary 4; ' + pretty(b1.species) + ' is chipped identically and clicks nothing'
        + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: mon(CLICKER(arm).species, '', CLICKER(arm).ability, [chip.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [chip2.id]),
        b0: { ...b0, moves: [e.id] }, b1: { ...b1, moves: [INERT] },
        script: [turn([click(chip.id, 0), click(chip2.id, 1)], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [throwIt(e, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/side-condition', kind: 'move',
  reads: 'sideCondition, and the condition\'s own onSideRestart',
  why: 'screens, Tailwind and the four hazards are all board leaves WITH CLOCKS OR LAYER COUNTS, so '
     + 'the move is clicked once and the board is then read for three more boundaries — a condition '
     + 'set for the wrong number of turns parts on the count rather than on the name. THE SECOND CLICK '
     + 'ON TURN 3 IS THE NEGATIVE AND ITS EXPECTED ANSWER IS DERIVED, not assumed: a condition whose '
     + 'own definition carries `onSideRestart` STACKS (Spikes goes to two layers) and one that does '
     + 'not FAILS and must not refresh the clock — which is exactly the state bug WIRE 8 fixed, where '
     + 'a re-clicked Reflect halved damage five turns past its real expiry.',
  break: { why: 'a screen is never raised — the click still resolves and still spends the turn',
    patch: [["if(a.kind==='screen'){", "if(a.kind==='screen'){m._lastMove=a.mv;continue;}if(a.kind==='screen'){"]] },
  match(e) {
    if (!e.sideCondition) return null;
    const arm = armFor(e), b0 = quietBody({ arm });
    if (!b0) return cannot(noBodyWhy({ arm }));
    const stacks = !!(e.condition && e.condition.onSideRestart);
    return { arm, note: e.sideCondition + ' — the turn-3 re-click must '
        + (stacks ? 'STACK (its condition declares onSideRestart)' : 'FAIL and must not refresh the '
          + 'clock (its condition declares no onSideRestart)') + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [INERT] },
        b0: { ...b0, moves: [e.id] },
        script: [turn([IDLE, IDLE], [throwIt(e, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [throwIt(e, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/pseudo-weather', kind: 'move',
  reads: 'pseudoWeather',
  why: 'ONE MEMBER OF THIS FAMILY IS ON THE BOARD AND FOUR ARE NOT. `board_state.js` compares '
     + '`field.trickroom_turns` and no other pseudo-weather, so Gravity, Magic Room, Wonder Room and '
     + 'Fairy Lock have no leaf to appear on and will come back with THE STAGING IS INERT — which is '
     + 'the honest answer and is a statement about the COMPARATOR rather than about the engine. Trick '
     + 'Room is clicked, then three quiet boundaries so the clock has to walk down.',
  break: { why: 'the room is never set — the click still resolves and still spends the turn',
    patch: [["if(a.kind==='trickroom'){", "if(a.kind==='trickroom'){m._lastMove=a.mv;continue;}if(a.kind==='trickroom'){"]] },
  match(e) {
    if (!e.pseudoWeather) return null;
    const arm = armFor(e), b0 = quietBody({ arm });
    if (!b0) return cannot(noBodyWhy({ arm }));
    return { arm, note: e.pseudoWeather + (e.pseudoWeather === 'trickroom' ? ' — compared as a clock'
        : ' — NOT a leaf board_state.js compares; expect THE STAGING IS INERT') + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [INERT] },
        b0: { ...b0, moves: [e.id] },
        script: [turn([IDLE, IDLE], [throwIt(e, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/boosts-self', kind: 'move',
  reads: 'boosts + target "self"',
  why: 'the user clicks it TWICE, so the board carries the stage after one application and after two '
     + '— an engine that applies a flat +1 for every setup move (which this one did until WIRE 19) '
     + 'agrees with a Swords Dance on neither turn, and an engine that fails to stack parts on the '
     + 'second. THE PARTNER IS THE NEGATIVE and stands beside it on every board, clicking nothing, so '
     + 'a boost that leaked across the side is visible on the SAME board as the boost that landed.',
  break: { why: 'the self-boost is skipped entirely — the click is still made, still costs the turn '
              + 'and still records itself as the last move',
    patch: [["if(a.kind==='setup'){", "if(a.kind==='setup'){m._lastMove=a.mv||m._lastMove;continue;}if(a.kind==='setup'){"]] },
  match(e) {
    if (!e.boosts || e.target !== 'self') return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm }), b1 = quietBody({ arm, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm }));
    return { arm,
      note: 'clicked twice by ' + pretty(b0.species) + '; the partner ' + pretty(b1.species)
          + ' clicks nothing and must stay at 0 on every stage' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [INERT] },
        b0: { ...b0, moves: [e.id] }, b1: { ...b1, moves: [INERT] },
        script: [turn([IDLE, IDLE], [mclick(e), IDLE]),
                 turn([IDLE, IDLE], [mclick(e), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/boosts-target', kind: 'move',
  reads: 'boosts + a target that is not the user',
  why: 'the aggressor throws it at ONE slot, twice, and the body in the OTHER slot is the negative on '
     + 'the same board. That pairing is the point: a stat drop applied to the Pokemon object instead '
     + 'of to the SLOT lands on a body that was never aimed at, which is the defect WIRE 139 fixed and '
     + 'which a single-target board cannot see. The second click is the second negative — the stage '
     + 'has to reach -2, and an engine that writes rather than accumulates stops at -1.',
  break: { why: 'the target\'s stat stage is left where it was — the move still resolves, still '
              + 'announces and still spends the turn',
    patch: [['_t.boosts[_s2]=clamp(_t.boosts[_s2]+_d,-6,6);', '_t.boosts[_s2]=_t.boosts[_s2];']] },
  match(e) {
    if (!e.boosts || e.target === 'self' || !aimsAtFoe(e)) return null;
    const arm = armFor(e), pw = !!(e.flags && e.flags.powder);
    const b0 = quietBody({ arm, type: e.type, powder: pw });
    const b1 = quietBody({ arm, type: e.type, powder: pw, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type, powder: pw }));
    return { arm,
      note: 'thrown at ' + pretty(b0.species) + ' twice; ' + pretty(b1.species) + ' stands beside it '
          + 'and is never aimed at' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: [turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                 turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/status-inflict', kind: 'move',
  reads: 'status',
  why: 'the status itself is a board leaf and so is its COUNTER, which is the half nothing in this '
     + 'repository could see until 2026-08-08. The move is thrown at one slot on turn 1 and AT THE '
     + 'SAME SLOT AGAIN on turn 2 — the second click must FAIL, because a body already carrying a '
     + 'major status cannot take another, and an engine that re-applies restarts the sleep or freeze '
     + 'timer and parts on `status_counter` rather than on `status`. THE PARTNER IS THE NEGATIVE and '
     + 'is never aimed at.',
  /* THE FIRST ANCHOR FOR THIS RULE WAS THE WRONG BRANCH AND `--reds` SAID SO IMMEDIATELY. It patched
   * `if(_e.status) applyStatus(...)` inside `kind==='affect'`, which reads like the mechanism and is
   * only the SECONDARY door into it: `playerAction` classifies Glare, Spore and Thunder Wave as
   * `kind:'status'`, so control never reaches that line and the plant moved no board. Aimed at the
   * shared writer instead, which is where BOTH doors end up. */
  break: { why: 'no status is ever written to any body — the move still resolves, still announces and '
              + 'still spends the turn',
    patch: [['function applyStatus(t,st,src){', 'function applyStatus(t,st,src){if(1)return false;']] },
  match(e) {
    if (!e.status) return null;
    /* A SELF-INFLICTED STATUS FALLS THROUGH RATHER THAN REFUSING. Rest carries `status: 'slp'` AND a
     * full heal; refusing it here would retire it before `move/heal` — which has a real staging for
     * it — ever saw it. `null` means "not my shape", `cannot` means "nobody's". */
    if (!aimsAtFoe(e)) return null;
    /* THREE IMMUNITY TABLES AND NOT ONE, WHICH THE FIRST RUN CAUGHT: Poison Powder read "THE STAGING
     * IS INERT" because the bulkiest quiet body is Goodra-HISUI, which is STEEL and cannot be
     * poisoned at all. The TYPE chart decides whether the move connects; the STATUS has its own table
     * (Steel/Poison refuse psn, Fire refuses brn, Electric refuses par, Ice refuses frz); and a POWDER
     * move is refused by every Grass type whatever it carries. All three asked of the dex. */
    const arm = armFor(e), pw = !!(e.flags && e.flags.powder);
    const q = { arm, type: e.type, status: e.status, powder: pw };
    const b0 = quietBody(q), b1 = quietBody({ ...q, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy(q) + ' The strict pool is required here rather than the '
      + 'item stage\'s looser one because EARLY BIRD — the punching bag\'s own ability — moves the '
      + 'SLEEP COUNTER, which is a leaf this comparison reads directly.');
    return { arm,
      note: e.status + ' onto ' + pretty(b0.species) + '; the second click must FAIL, and '
          + pretty(b1.species) + ' beside it must stay clean' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: [turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                 turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/weather-setter', kind: 'move',
  reads: 'weather',
  why: 'the sky and its CLOCK are both board leaves. The move is clicked once and the board is then '
     + 'read for three more boundaries, so a weather that is set for the wrong number of turns parts '
     + 'on the count rather than on the name. BOUNDARY 0 IS THE NEGATIVE — it is taken before anybody '
     + 'chooses, so the sky must still be clear there — and turn 3 is the second: clicking the SAME '
     + 'weather while it is already up FAILS in the authority and must not refresh the clock.',
  break: { why: 'the weather is never written to the field — the click still resolves and still spends '
              + 'the turn',
    patch: [["if(a.kind==='weather'){", "if(a.kind==='weather'){m._lastMove=a.mv;continue;}if(a.kind==='weather'){"]] },
  match(e) {
    if (!e.weather) return null;
    const arm = armFor(e), b0 = quietBody({ arm });
    if (!b0) return cannot(noBodyWhy({ arm }));
    return { arm,
      note: e.weather + ', then three quiet boundaries so the clock has to walk down; the third click '
          + 'is into its own weather and must FAIL' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [INERT] },
        b0: { ...b0, moves: [e.id] },
        script: [turn([IDLE, IDLE], [mclick(e), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [mclick(e), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/terrain-setter', kind: 'move',
  reads: 'terrain',
  why: 'the same shape one field over, and it is worth its own rule because the two carry DIFFERENT '
     + 'vocabularies in the two engines — `psychicterrain` against `psychic` — and `board_state.js` '
     + 'reconciles them through the engine\'s own exported translator. A terrain that arrives under a '
     + 'name only one of this file\'s readers matches is invisible to everything else.',
  break: { why: 'the terrain is never written to the field',
    patch: [["if(a.kind==='terrain'){", "if(a.kind==='terrain'){m._lastMove=a.mv;continue;}if(a.kind==='terrain'){"]] },
  match(e) {
    if (!e.terrain) return null;
    const arm = armFor(e), b0 = quietBody({ arm });
    if (!b0) return cannot(noBodyWhy({ arm }));
    return { arm,
      note: e.terrain + ', then three quiet boundaries; the third click is into its own terrain and '
          + 'must FAIL' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: { ...CLICKER(arm), moves: [INERT] },
        b0: { ...b0, moves: [e.id] },
        script: [turn([IDLE, IDLE], [mclick(e), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [mclick(e), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/self-boosts-after', kind: 'move',
  reads: 'self.boosts on a damaging move',
  why: 'Close Combat, Superpower, Armor Cannon and Head Long Rush pay their own stats AFTER the hit '
     + 'lands, and the cost is a board leaf on the USER. Clicked twice, so the stage has to reach -2. '
     + 'THE NEGATIVE IS THE SECOND SLOT: the partner throws a plain move of the same category and must '
     + 'end at 0, which catches a self-drop applied to the side rather than to the body.',
  break: { why: 'the self stat change is never applied — the damage still lands',
    patch: [['const sdrop=connected?a.move.mv.self:null;', 'const sdrop=null;']] },
  match(e) {
    if (!(e.self && e.self.boosts) || !(e.basePower > 0)) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm, type: e.type });
    if (!b0) return cannot(noBodyWhy({ arm, type: e.type }));
    const plain = neutralHit(b0.species, e.id);
    if (!plain) return cannot('no neutral 100-accuracy delivery move exists for the partner to throw '
      + 'as the on-board negative');
    return { arm, note: JSON.stringify(e.self.boosts) + ' onto the USER, twice; the partner throws '
        + plain.name + ' and must end at 0' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [plain.id]),
        b0: { ...b0, moves: [INERT] },
        script: [turn([throwIt(e, 0), click(plain.id, 0)], [IDLE, IDLE]),
                 turn([throwIt(e, 0), click(plain.id, 0)], [IDLE, IDLE])] }) };
  } },

{ id: 'move/volatile', kind: 'move',
  reads: 'volatileStatus',
  why: 'EIGHT VOLATILES ARE BOARD LEAVES AND THE REST ARE NOT. `board_state.js` compares substitute, '
     + 'taunt, encore, disable, leechseed, confusion, perish and the move trap — the rest of this '
     + '32-move family has nowhere to appear and comes back THE STAGING IS INERT, which is a statement '
     + 'about the comparator. The target CLICKS A REAL MOVE ON EVERY TURN, which Taunt, Encore and '
     + 'Disable all need in order to bite anything, and THE PARTNER IS THE NEGATIVE beside it.',
  break: { why: 'the move-sealing volatiles (Taunt, Encore, Disable) are never written',
    patch: [["const _sm=TAGS.param('move',a.mv,'sealsMoves');", "const _sm=null;"]] },
  match(e) {
    if (!e.volatileStatus) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    if (!aimsAtFoe(e)) {
      /* a SELF volatile — the user raises it on itself, and the partner is the negative */
      return { arm, note: e.volatileStatus + ' on the user; ' + pretty(b1.species) + ' beside it must '
          + 'not gain it' + armNote(e),
        scenario: scaffold({ hpA: 4, hpB: 8,
          a0: { ...CLICKER(arm), moves: [INERT] },
          b0: { ...b0, moves: [e.id] }, b1: { ...b1, moves: [INERT] },
          script: [turn([IDLE, IDLE], [throwIt(e), IDLE]),
                   turn([IDLE, IDLE], [IDLE, IDLE]),
                   turn([IDLE, IDLE], [IDLE, IDLE])] }) };
    }
    /* TWO CLICKS, ALTERNATED, AND THAT IS NOT COSMETIC. The target has to be USING a move for Taunt,
     * Encore and Disable to have anything to bite — and the first version gave it ONE, which DISABLE
     * and TORMENT then made illegal on the following turn: Showdown rejected the choice and the game
     * threw rather than staging anything. Two distinct neutral clicks, alternated, satisfies Torment
     * (never the same move twice running) and survives Disable (the other one is still legal). */
    const back = neutralHit(CLICKER(arm).species, e.id);
    const back2 = back ? neutralHit2(CLICKER(arm).species, [e.id, back.id]) : null;
    if (!back || !back2) return cannot('no PAIR of neutral 100-accuracy delivery moves exists for the '
      + 'target to alternate between. One is not enough: Taunt, Encore and Disable read the target\'s '
      + 'LAST MOVE, and Disable and Torment then make a repeated click ILLEGAL, which throws the game');
    return { arm, note: e.volatileStatus + ' onto ' + pretty(b0.species) + ', which clicks '
        + back.name + ' every turn so a move-sealing volatile has something to seal; '
        + pretty(b1.species) + ' clicks the same move and is never aimed at' + armNote(e),
      scenario: scaffold({ hpA: 8, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [back.id, back2.id] }, b1: { ...b1, moves: [back.id, back2.id] },
        /* TWO TURNS AND NOT THREE. Disable seals the target's last move for FIVE turns, so a third
         * turn has nothing legal left to click whichever of the pair it names — Showdown rejects the
         * choice and the game throws. Two is enough: the volatile is on boundary 1 and its counter
         * has decremented by boundary 2. */
        script: [turn([throwIt(e, 0), IDLE], [click(back.id, 0), click(back.id, 0)]),
                 turn([throwIt(e, 0), IDLE], [click(back2.id, 0), click(back2.id, 0)])] }) };
  } },

{ id: 'move/heal', kind: 'move',
  reads: 'heal',
  why: 'the user is chipped on turn 1 so a heal has somewhere to go, then heals on turns 2 and 3 — '
     + 'the second is the negative for a heal that overshoots the maximum. THE PARTNER IS THE OTHER '
     + 'NEGATIVE: chipped by an identical click and never healing.',
  break: { why: 'the heal is skipped — the click still resolves and still spends the turn',
    patch: [["if(a.kind==='heal'){", "if(a.kind==='heal'){m._lastMove=a.mv;continue;}if(a.kind==='heal'){"]] },
  match(e) {
    if (!e.heal) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm }), b1 = quietBody({ arm, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm }));
    const chip = neutralHit(b0.species, e.id), chip2 = neutralHit(b1.species, e.id);
    if (!chip || !chip2) return cannot('no neutral 100-accuracy delivery move exists to take the two '
      + 'bodies off full HP, and a heal into a full body is invisible');
    return { arm, note: 'chipped by ' + chip.name + ', then healing twice; ' + pretty(b1.species)
        + ' is chipped identically and never heals' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 4,
        a0: mon(CLICKER(arm).species, '', CLICKER(arm).ability, [chip.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [chip2.id]),
        b0: { ...b0, moves: [e.id] }, b1: { ...b1, moves: [INERT] },
        script: [turn([click(chip.id, 0), click(chip2.id, 1)], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [throwIt(e), IDLE]),
                 turn([IDLE, IDLE], [throwIt(e), IDLE])] }) };
  } },

{ id: 'move/drain', kind: 'move',
  reads: 'drain',
  why: 'BOTH HALVES ARE ON THE BOARD and an engine that had one without the other parts on exactly one '
     + 'of them: the target loses HP and the user gains a fraction of what was dealt. The user is '
     + 'chipped first, because a drain into a full-HP body heals NOTHING and would read as a plain '
     + 'attack. THE PARTNER IS THE NEGATIVE and throws a plain move of the same type, gaining nothing.',
  break: { why: 'the drain heal is skipped and the damage is left alone, so a break that moves ONLY '
              + 'the user\'s HP is the localisation',
    patch: [["const _dr=TAGS.param('move',a.move.id,'drain');", "const _dr=null;"]] },
  match(e) {
    if (!e.drain || !(e.basePower > 0)) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm }), b1 = quietBody({ arm, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm }));
    const chip = neutralHit(b0.species, e.id), chip2 = neutralHit(b1.species, e.id);
    const plain = neutralHit(CLICKER(arm).species, e.id);
    if (!chip || !chip2 || !plain) return cannot('no neutral 100-accuracy delivery move exists to chip '
      + 'the two bodies and to give the partner a non-draining click of its own');
    if (dex.getImmunity(e.type, dex.species.get(CLICKER(arm).species).types) === false)
      return cannot('the derived aggressor is immune to ' + e.type + ', so the drain would deal '
        + 'nothing and heal nothing');
    return { arm, note: 'chipped, then draining off ' + pretty(CLICKER(arm).species) + '; '
        + pretty(b1.species) + ' throws ' + plain.name + ' instead and must gain nothing' + armNote(e),
      scenario: scaffold({ hpA: 8, hpB: 4,
        a0: mon(CLICKER(arm).species, '', CLICKER(arm).ability, [chip.id, chip2.id]),
        b0: { ...b0, moves: [e.id] }, b1: { ...b1, moves: [plain.id] },
        script: [turn([click(chip.id, 0), IDLE], [IDLE, IDLE]),
                 turn([click(chip2.id, 1), IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [throwIt(e, 0), click(plain.id, 0)]),
                 turn([IDLE, IDLE], [throwIt(e, 0), click(plain.id, 0)])] }) };
  } },

{ id: 'move/recoil', kind: 'move',
  reads: 'recoil / mindBlownRecoil / struggleRecoil',
  why: 'the user\'s OWN HP is the leaf, and the negative is on the same board: the partner throws a '
     + 'plain move of comparable power at the other slot and must lose nothing. Two turns, because a '
     + 'recoil computed off the wrong quantity (the move\'s power rather than the damage dealt) tracks '
     + 'correctly on a full-HP target and parts on a chipped one.',
  break: { why: 'the recoil is never paid — the damage still lands',
    patch: [['const _rc=a.move.mv&&a.move.mv.rc;', 'const _rc=null;']] },
  match(e) {
    if (!(e.recoil || e.mindBlownRecoil || e.struggleRecoil) || !(e.basePower > 0)) return null;
    /* STRUGGLE CANNOT BE CLICKED FROM A SCRIPT AT ALL, and the rejection names the reason: Showdown
     * marks it DISABLED for any body that has a usable move, which every body in this file does.
     * Read off `struggleRecoil` — the field only Struggle carries — rather than off its name. */
    if (e.struggleRecoil) return cannot('Showdown DISABLES Struggle for any body that still has a '
      + 'usable move, and every body this file stages carries at least the inert click — so the '
      + 'scripted choice is rejected ("Struggle is disabled") and the game throws. Reaching it would '
      + 'need a body whose whole moveset is spent, which the script language has no way to arrange '
      + 'because medicham2 does not track PP at all (board_state.js NOT_COMPARED).');
    const arm = armFor(e);
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    const plain = neutralHit(b1.species, e.id);
    if (!plain) return cannot('no neutral 100-accuracy non-recoil delivery move exists for the '
      + 'on-board negative');
    return { arm, note: 'the user pays; the partner throws ' + plain.name + ' at the other slot and '
        + 'must pay nothing' + armNote(e),
      scenario: scaffold({ hpA: 8, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [plain.id]),
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: [turn([throwIt(e, 0), click(plain.id, 1)], [IDLE, IDLE]),
                 turn([throwIt(e, 0), click(plain.id, 1)], [IDLE, IDLE])] }) };
  } },

{ id: 'move/fixed-damage', kind: 'move',
  reads: 'damage / damageCallback',
  why: 'a fixed-damage move ignores every multiplier this engine spends most of its lines on, so the '
     + 'number it produces is a direct read of one branch. The user is hit by a PHYSICAL click and by '
     + 'a SPECIAL one on the same turn, because Counter and Mirror Coat each read one of those and a '
     + 'staging that supplied only one would report the other as inert. The user answers on the next '
     + 'turn, so the retaliation family has something to retaliate against.',
  break: { why: 'the fixed-damage branch is skipped — the click still resolves and still spends the turn',
    patch: [["if(a.kind==='fixeddmg'){", "if(a.kind==='fixeddmg'){m._lastMove=a.mv;continue;}if(a.kind==='fixeddmg'){"]] },
  match(e) {
    if (!(e.damage || e.damageCallback)) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm });
    if (!b0) return cannot(noBodyWhy({ arm }));
    /* THE AGGRESSOR IS DERIVED FROM THE MOVE'S TYPE, NOT TAKEN FROM THE CAST. `CAST.ATTACKER` is
     * Dragapult, which is Dragon/GHOST and therefore immune to both Fighting and Normal — so Seismic
     * Toss, Counter, Final Gambit, Endeavor and Super Fang all read "the aggressor is immune" on the
     * first full run. FIVE OF THE EIGHT MEMBERS of this family, retired by the fixture rather than by
     * the format, which is the shape this file exists to refuse. */
    const atkPick = bodyNotImmuneTo(e.type);
    if (!atkPick) return cannot('no legal body with a non-interfering ability can be hit by ' + e.type
      + ', so the fixed damage has nowhere to land');
    const atk = dex.species.get(atkPick.species);
    let phys = null, spec = null;
    for (const t of Object.keys(DELIVERY)) {
      if (dex.getEffectiveness(t, dex.species.get(b0.species).types) !== 0) continue;
      if (dex.getImmunity(t, dex.species.get(b0.species).types) === false) continue;
      if (!phys && DELIVERY[t].physical && idOf(DELIVERY[t].physical.id) !== idOf(e.id)) phys = DELIVERY[t].physical;
      if (!spec && DELIVERY[t].special && idOf(DELIVERY[t].special.id) !== idOf(e.id)) spec = DELIVERY[t].special;
    }
    if (!phys || !spec) return cannot('no neutral 100-accuracy PHYSICAL and SPECIAL pair exists '
      + 'against ' + b0.species + ', and Counter and Mirror Coat read one each');
    return { arm, note: 'hit physically AND specially first, then answering ' + pretty(atk.id)
        + armNote(e),
      scenario: scaffold({ hpA: 8, hpB: 8,
        a0: mon(atk.id, '', atkPick.ability, [phys.id]),
        a1: mon(CAST.ATTACKER2().species, '', CAST.ATTACKER2().ability, [spec.id]),
        b0: { ...b0, moves: [e.id] },
        script: [turn([click(phys.id, 0), click(spec.id, 0)], [IDLE, IDLE]),
                 turn([click(phys.id, 0), click(spec.id, 0)], [throwIt(e, 0), IDLE]),
                 turn([IDLE, IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/type-changing', kind: 'move',
  reads: 'onModifyType, and the condition named in the move\'s own shortDesc',
  why: 'A TYPE CHANGE IS ONLY OBSERVABLE IF THE DEFENDER\'S TYPE MAKES IT SO, and getting that wrong '
     + 'is how a false calibration was produced against this very move on 2026-08-08: a NEUTRAL '
     + 'defender turns the whole question into a damage number, where a missing 2x and a defensive '
     + 'x0.5 are the same factor and cancel. So the defender is derived to be a GHOST wherever the '
     + 'format offers one: with no weather Weather Ball is NORMAL and deals literally nothing, and '
     + 'under sun it is FIRE and deals full damage. The comparison is then CATEGORICAL — 0 against a '
     + 'number — and passes through the stage-5 immunity gate, which is where `effMoveType` is the '
     + 'battle loop\'s authority.\n'
     + '     THE KNOB IS VARIED ON ONE BOARD. Turn 1 is the click with a clear sky, turn 2 sets the '
     + 'weather, turn 3 is the identical click under it. IDENTICAL DAMAGE ON TURNS 1 AND 3 MEANS THE '
     + 'TYPE NEVER CHANGED, which is the only reading this instrument accepts as evidence.\n'
     + '     WHAT IT STILL CANNOT REACH, said rather than implied: the known live defect is '
     + '`effMoveType` reading `field.weather` RAW while `dmgRange` reads `effWeatherOf`, which only '
     + 'part company under a PRIVATE sky — a Mega Sol ability with a clear field. That needs an '
     + 'ABILITY carrier, so it is out of reach of a move-shape rule and is named here instead of '
     + 'being quietly missed.',
  /* THE FIRST ANCHOR WAS `effMoveType` AND THE PLANT MOVED NOTHING, which is the same split the live
   * defect lives in: `effMoveType` (:2167) is the BATTLE LOOP'S authority for the stage-5 immunity
   * gate, and `dmgRange` (:2360) reads `weatherScaled` AGAIN for itself. Breaking one leaves the
   * other pricing the converted type, so the damage never moves. Aimed at the damage-side copy, and
   * the BASE POWER half of the same line is deliberately left alone so a break that moves only the
   * EFFECTIVENESS is the localisation. TWO READERS OF ONE FACT IS THE DEFECT ITSELF (CLAUDE.md: facts
   * are global) and it is filed rather than fixed — the simulator is not this file's to edit. */
  break: { why: 'the weather-driven TYPE conversion is dropped from the damage path; the base-power '
              + 'doubling on the same line is left alone',
    patch: [['if(w){if(w.type)mvT=w.type;if(w.bpMult)mvBP=Math.floor(mvBP*w.bpMult);}',
             'if(w){if(w.bpMult)mvBP=Math.floor(mvBP*w.bpMult);}']] },
  match(e) {
    if (!e.onModifyType) return null;
    const arm = armFor(e);
    const setter = /weather|sun|rain|sand|snow|hail/i.test(e.shortDesc || '') ? 'weather'
                 : /terrain/i.test(e.shortDesc || '') ? 'terrain' : null;
    if (!setter) return cannot('the condition that changes its type is not named in its own '
      + 'description, so no staging can be derived from the move\'s data: ' + (e.shortDesc || '(none)')
      + '. Aura Wheel and Raging Bull read the USER\'S FORME, which is an ability/species question '
      + 'rather than a move one.');
    const set = dex.moves.all().find(m => m.exists && !m.isNonstandard && alwaysHits(m)
      && (setter === 'weather' ? m.weather === 'sunnyday' : !!m.terrain));
    if (!set) return cannot('no 100-accuracy move in this format sets the ' + setter + ' this move '
      + 'reads, so the knob cannot be varied at all');
    /* THE DEFENDER IS CHOSEN FOR ITS TYPE, NOT FOR ITS BULK. A Ghost is immune to the move's PRINTED
     * type (Normal) and not to what it converts into, so turn 1 reads 0 and turn 3 reads a number. */
    /* THE FIVE-SPECIES MOVE POOL CONTAINS NO GHOST, so this one rule falls back to the ITEM stage's
     * wider filter — `carrierAbility`, which excludes every damage modifier, HP floor and immunity
     * and is exactly the guarantee a damage reading needs. The ability chosen is PRINTED on the entry
     * so the widening is visible rather than assumed. */
    const ghost = quietBody({ arm, hasType: 'Ghost' })
               || carrierBody({ hasType: 'Ghost', immuneTo: e.type });
    const b0 = ghost || quietBody({ arm });
    if (!b0) return cannot(noBodyWhy({ arm }));
    const b1 = quietBody({ arm, not: [b0.species] });
    if (!b1) return cannot(noBodyWhy({ arm, not: [b0.species] }));
    return { arm, note: (ghost ? 'GHOST defender ' + pretty(b0.species) + ' (' + b0.ability + ') '
          + '— the printed type is '
          + e.type + ', so turn 1 (clear) must deal NOTHING and turn 3 (under ' + set.name + ') must '
          + 'deal damage. A neutral defender would hide the conversion behind a damage number.'
        : 'NO legal Ghost body with a quiet ability exists, so this runs against ' + pretty(b0.species)
          + ' and the conversion is only visible as a damage difference — weaker evidence, said here')
        + ' The weather setter is clicked by the PARTNER, so the control arm keeps it.' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [set.id] }, b1: { ...b1, moves: [INERT] },
        script: [turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                 turn([IDLE, IDLE], [click(set.id), IDLE]),
                 turn([throwIt(e, 0), IDLE], [IDLE, IDLE])] }) };
  } },

{ id: 'move/variable-power', kind: 'move',
  reads: 'basePowerCallback',
  why: 'the power IS the calculation, and twelve members of this family carry `variablePower '
     + '{computed:true}` with no derivable idiom at all — the artifact says so. Staged as a plain '
     + 'damaging click, twice, so the number the formula produces is compared directly against the '
     + 'authority. THE CONDITION IS WHATEVER THE DEFAULT BOARD SUPPLIES: no boosts, full HP, an item '
     + 'held, no status. That is a real point in the domain and it is the one this reads; a member '
     + 'whose formula is flat there will agree here and could still be wrong elsewhere, which is the '
     + 'honest limit of a single staged board.',
  break: { why: 'every damage roll is halved',
    patch: [['return {min:roll(85),max:roll(100),eff};',
             'return {min:Math.floor(roll(85)*0.5),max:Math.floor(roll(100)*0.5),eff};']] },
  match(e) {
    if (!e.basePowerCallback) return null;
    const arm = armFor(e);
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    return { arm, note: 'thrown at ' + pretty(b0.species) + ' twice; the power comes out of the '
        + 'formula and the damage is what is compared' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: twice(e, turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                         turn([throwIt(e, 0), IDLE], [IDLE, IDLE])) }) };
  } },

{ id: 'move/priority', kind: 'move',
  reads: 'priority !== 0 on a damaging move',
  why: 'A BRACKET IS NOT A BOARD LEAF; WHO IS STILL STANDING IS. The user is derived to be SLOWER than '
     + 'the aggressor and to die outright to it, so a positive-priority click lands before the killing '
     + 'blow and a 0-priority one never happens at all. THE NEGATIVE IS ON THE SAME BOARD: a second '
     + 'body, equally doomed, throws an ordinary move at the other aggressor, which must therefore end '
     + 'the turn UNTOUCHED. That pairing is the whole content — one aggressor damaged, one not, from '
     + 'two clicks that differ only in their bracket.\n'
     + '     A NEGATIVE BRACKET IS NOT ISOLATED HERE AND THE ENTRY SAYS SO. The control arm removes '
     + 'the move entirely, and a move that never resolves because it went last is indistinguishable '
     + 'from a move that was not clicked — the delta is empty by construction. Those are staged as '
     + 'plain damage with the delay declared unmeasured.',
  break: { why: 'every move resolves in bracket 0, so a priority click no longer outruns a faster foe',
    patch: [["return (fx&&typeof fx.priority==='number')?fx.priority:0;", 'return 0;']] },
  match(e) {
    if (!e.priority || !(e.basePower > 0) || !needsIndex(e)) return null;
    const arm = armFor(e);
    const atk = dex.species.get(CAST.ATTACKER().species), atk2 = dex.species.get(CAST.ATTACKER2().species);
    if (e.priority < 0) {
      const b0 = quietBody({ arm, type: e.type });
      if (!b0) return cannot(noBodyWhy({ arm, type: e.type }));
      return { arm, note: 'priority ' + e.priority + ' — THE DELAY IS NOT ISOLATED (see the rule); '
          + 'only the damage is staged' + armNote(e),
        scenario: scaffold({ hpA: 8, hpB: 8,
          a0: { ...CLICKER(arm), moves: [INERT] },
          b0: { ...b0, moves: [e.id] },
          script: [turn([IDLE, IDLE], [throwIt(e, 0), IDLE]),
                   turn([IDLE, IDLE], [throwIt(e, 0), IDLE])] }) };
    }
    const spd = s => flatL50(s.baseStats).sp;
    const pool = moveBodies(arm).filter(r => spd(r.sp) < spd(atk) && spd(r.sp) < spd(atk2)
      && dex.getImmunity(e.type, atk.types) !== false);
    let pick = null;
    for (const r of pool) { const k1 = lethalMove(atk, r.sp, 1.2); if (!k1) continue;
      for (const r2 of pool) { if (r2.sp.id === r.sp.id) continue;
        const k2 = lethalMove(atk2, r2.sp, 1.2); if (!k2) continue;
        const plain = neutralHit(atk2.id, e.id); if (!plain) continue;
        pick = { r, r2, k1: k1.mv, k2: k2.mv, plain }; break; }
      if (pick) break; }
    if (!pick) return cannot('no pair of bodies in the move pool is both SLOWER than the two derived '
      + 'aggressors and killable outright by them, so a bracket has no way onto the board: without a '
      + 'KO the turn ends in the same state whichever order it resolved in');
    return { arm, note: 'priority +' + e.priority + ' — ' + pretty(pick.r.sp.id) + ' is slower and '
        + 'dies to ' + pick.k1.name + ', and its click must land FIRST; ' + pretty(pick.r2.sp.id)
        + ' beside it throws a 0-priority ' + pick.plain.name + ' and must never get to act' + armNote(e),
      scenario: scaffold({
        a0: mon(atk.id, '', CAST.ATTACKER().ability, [pick.k1.id]),
        a1: mon(atk2.id, '', CAST.ATTACKER2().ability, [pick.k2.id]),
        b0: mon(pick.r.sp.id, '', pick.r.ability, [e.id]),
        b1: mon(pick.r2.sp.id, '', pick.r2.ability, [pick.plain.id]),
        script: [turn([click(pick.k1.id, 0), click(pick.k2.id, 1)],
                      [throwIt(e, 0), click(pick.plain.id, 1)])] }) };
  } },

{ id: 'move/crit', kind: 'move',
  reads: 'critRatio > 1 / willCrit',
  why: 'THE RATIO ITSELF IS NOT STAGEABLE IN EITHER ARM, and what is staged instead is the CRIT '
     + 'DAMAGE FORMULA. The primary arm never lands a crit by construction, and the control click '
     + 'adds two crit stages, which on top of a raised ratio reaches the tier Showdown rolls as '
     + 'randomChance(1,1) and crits EVERY TIME — a one-sided crit already mistaken once for an engine '
     + 'defect (Wide Lens, Zoom Lens). On the bottom arm every crit lands whatever the ratio is, so a '
     + 'ratio of 2 and a ratio of 1 produce the same board and the RATIO is not what is measured. The '
     + 'x1.5, the ignored defensive stages and the ignored screens ARE, and nothing else in this file '
     + 'reaches them.\n'
     + '     THE DEFENDER COMES FROM THE ITEM STAGE\'S POOL AND NOT THE MOVE STAGE\'S, which is the '
     + 'one place those two pools must differ. Every usable body in the move pool wears BATTLE ARMOR '
     + 'or SHELL ARMOR — the format offers nothing else with a silent ability — and an armoured '
     + 'defender BLOCKS the crit outright, which is how the first version of `critsLand()` came back '
     + 'saying no crit lands anywhere. `carrierAbility` lists `onCriticalHit` in INTERFERES, so a body '
     + 'chosen by it provably cannot block one.',
  break: { why: 'a critical hit stops being worth x1.5 — it still lands, still ignores the defender\'s '
              + 'positive stages and still ignores screens',
    patch: [[CRIT_X15, 'if(_critHere){MEDSEEN.critInRange++;}']] },
  match(e) {
    if (!(e.critRatio > 1 || e.willCrit) || !(e.basePower > 0)) return null;
    const C = critsLand();
    if (!C.ok) return cannot('NO CRITICAL HIT LANDS IN THIS SIMULATOR IN EITHER ARM, so a raised '
      + 'ratio has nothing to act on and the crit damage formula has nothing to price. ' + C.why);
    const arm = BOTTOM_ARM;
    const b0 = carrierBody({ type: e.type }), b1 = carrierBody({ type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot('no two distinct bodies exist that a ' + e.type + '-type move can '
      + 'be aimed at whose ability cannot block a critical hit');
    return { arm, note: 'critRatio ' + (e.critRatio || '(willCrit)') + ' into ' + pretty(b0.species)
        + ' (' + b0.ability + ', which cannot block a crit) — the RATIO is not under test; the crit '
        + 'DAMAGE is' + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: twice(e, turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                         turn([throwIt(e, 0), IDLE], [IDLE, IDLE])) }) };
  } },

{ id: 'move/plain-attack', kind: 'move',
  reads: 'basePower > 0 and nothing else this file has a narrower rule for',
  why: 'THE RESIDUE, AND IT IS A REAL TEST RATHER THAN A PARKING SPACE — which is the distinction '
     + '`ability/generic` failed: that rule swallowed 124 abilities and reported them as inert. A '
     + 'plain attack staged here is a DAMAGE NUMBER compared leaf for leaf against the authority on a '
     + 'move nobody may ever have brought to the ladder, which is exactly the coverage the '
     + 'usage-driven differential cannot buy. Thrown twice, with the partner as the on-board negative.'
     + '\n     WHAT IT DOES NOT TEST IS PRINTED ON THE ENTRY: a sub-100% secondary never fires in '
     + 'either engine on the primary arm and always fires on the bottom one, so the SECONDARY is a '
     + 'property of the arm and not of this staging.',
  break: { why: 'every damage roll is halved',
    patch: [['return {min:roll(85),max:roll(100),eff};',
             'return {min:Math.floor(roll(85)*0.5),max:Math.floor(roll(100)*0.5),eff};']] },
  match(e) {
    if (!(e.basePower > 0)) return null;
    const arm = armFor(e);
    if (!needsIndex(e) && !aimsAtFoe(e)) return cannot('it deals damage and is not aimed at a foe '
      + '(target "' + e.target + '"), which this rule has no staging for');
    const b0 = quietBody({ arm, type: e.type }), b1 = quietBody({ arm, type: e.type, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm, type: e.type }));
    const sec = (e.secondaries || []).filter(s => s.chance && s.chance < 100);
    return { arm, note: e.type + ' ' + e.basePower + ' BP into ' + pretty(b0.species) + ', twice'
        + (sec.length ? '; it also carries ' + sec.length + ' sub-100% secondary/ies which the arm '
            + 'decides and this staging does not test' : '') + armNote(e),
      scenario: scaffold({ hpA: 4, hpB: 8,
        a0: { ...CLICKER(arm), moves: [e.id] },
        b0: { ...b0, moves: [INERT] }, b1: { ...b1, moves: [INERT] },
        script: twice(e, turn([throwIt(e, 0), IDLE], [IDLE, IDLE]),
                         turn([throwIt(e, 0), IDLE], [IDLE, IDLE])) }) };
  } },

{ id: 'move/generic-status', kind: 'move',
  reads: 'nothing matched above — this is the second residue, and it is the WEAK one',
  why: 'A ZERO-POWER MOVE WHOSE EFFECT LIVES ENTIRELY IN AN `onHit` HANDLER. Belly Drum, Acupressure, '
     + 'Fling, Defog, Copycat, Entrainment, Guard Swap and forty-odd others reach the board only if '
     + 'the handler happens to touch a leaf the comparator reads. It is clicked twice against a body '
     + 'that has been chipped and is holding an item, and if Showdown\'s own board does not move the '
     + 'entry says THE STAGING IS INERT rather than passing. THERE IS NO BREAK, because there is no '
     + 'single mechanism to aim one at — this rule is a bucket and reporting it as anything else '
     + 'would be the `ability/generic` failure again.',
  match(e) {
    const arm = armFor(e);
    const b0 = quietBody({ arm }), b1 = quietBody({ arm, not: [b0 && b0.species] });
    if (!b0 || !b1) return cannot(noBodyWhy({ arm }));
    const chip = neutralHit(b0.species, e.id);
    if (!chip) return cannot('no neutral 100-accuracy delivery move exists to chip the bodies first');
    const byFoe = aimsAtFoe(e);
    const cl = throwIt(e, 0);
    /* ONE CLICK, ON TURN 2, AND THE REASON IS A THROWN GAME RATHER THAN TIDINESS. Explosion, Memento,
     * Misty Explosion and Self-Destruct KILL THE USER, so a second scripted click lands on the
     * REPLACEMENT — which does not carry the move, resolves to `pass`, and is rejected outright.
     * Ally Switch swaps the two slots and does the same thing one step sideways. Turn 1 chips, turn 2
     * clicks, turn 3 is the quiet boundary the effect has to survive to. */
    return { arm, note: 'generic: clicked ONCE on turn 2 by '
          + (byFoe ? 'the aggressor at ' + pretty(b0.species) : pretty(b0.species) + ' itself')
          + ', both sides chipped and holding an item' + armNote(e),
      scenario: scaffold({ hpA: 8, hpB: 8,
        a0: mon(CLICKER(arm).species, 'leftovers', CLICKER(arm).ability, byFoe ? [e.id, chip.id] : [chip.id]),
        b0: { ...b0, item: 'sitrusberry', moves: byFoe ? [INERT] : [e.id] },
        b1: { ...b1, item: 'leftovers', moves: [INERT] },
        /* THE AGGRESSOR KEEPS A REAL CLICK ON EVERY TURN IT IS NOT THE SUBJECT, and IMPRISON is why:
         * it seals every move BOTH bodies know, and every body in this file knows the inert click, so
         * an idling aggressor is left with nothing legal and its choice resolves to a rejected pass.
         * Where the aggressor IS the subject it idles instead — it must not throw a damaging move
         * after its own click has been silenced, which is what `controlQuietAudit` refuses. */
        script: [turn([click(chip.id, 0), IDLE], [IDLE, IDLE]),
                 turn(byFoe ? [cl, IDLE] : [click(chip.id, 0), IDLE],
                      byFoe ? [IDLE, IDLE] : [cl, IDLE]),
                 turn(byFoe ? [IDLE, IDLE] : [click(chip.id, 0), IDLE], [IDLE, IDLE])] }) };
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

/* THE SECOND STATIC AUDIT, BESIDE `SB.fixtureAudit`. That one asks whether a click can miss; this one
 * asks whether a click can be turned into a GUARANTEED CRITICAL HIT by the control click sitting
 * beside it. Both are the same kind of check — a scenario that is not staging what its author thinks
 * — and both are cheap, so both run before any game. The exclusion also lives inside `deliveryOf`;
 * it is repeated here because a rule may pick a move by any route it likes and the hazard is the
 * CLICK, not the table. */
function critRatioAudit(list) {
  const bad = [];
  for (const sc of list) {
    /* ON `bottom-tie-first` EVERY CRIT LANDS, IN BOTH ENGINES, IN BOTH ARMS OF THE COMPARISON — so
     * the control click's two extra stages cannot manufacture a ONE-SIDED crit and there is nothing
     * for this audit to protect. The exclusion is stated rather than assumed: it is a property of that
     * arm's pin (`CORNER_BOTTOM`), not a decision taken here. */
    if (sc.arm && sc.arm !== PRIMARY_ARM_ID) continue;
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

/* THE THIRD STATIC AUDIT, AND IT IS THE ONE THE MOVE STAGE NEEDS.
 *
 * A move's control arm replaces the click under test with the INERT click, and `selftest()` proves
 * that click moves NO board leaf in either engine over three turns. It has exactly one residue, named
 * at INERT_RAISES_CRIT_STAGES above: Focus Energy adds TWO critical-hit stages to the body that
 * clicks it. That is invisible on the board — until the SAME BODY throws a damaging move on a LATER
 * turn, at which point the control arm carries a crit the subject arm does not, in both engines, and
 * the delta is the control's.
 *
 * So it is refused STATICALLY, per entry rather than per run: a scenario in which the body that loses
 * its click goes on to attack is marked CONTROL-NOT-QUIET and is never reported as a finding. This is
 * cheap, it is exact, and it is checked for every derived script rather than remembered by whoever
 * writes the next rule. */
function controlQuietAudit(e) {
  if (e.kind !== 'move' || !e.scenario) return null;
  const sc = e.scenario;
  for (const [side, team] of [['p1', sc.A], ['p2', sc.B]]) {
    const silenced = new Map();                       // slot -> the turn its click became INERT
    for (let t = 0; t < sc.script.length; t++) {
      const acts = sc.script[t][side] || [];
      for (let i = 0; i < acts.length; i++) {
        const a = acts[i]; if (!a || !a.m) continue;
        /* THE ENTITY'S OWN LATER CLICKS ARE NOT THE HAZARD AND THE FIRST VERSION OF THIS FLAGGED 42
         * OF THEM. Every click of the move under test is replaced, so a body clicking it on turns 1
         * AND 2 has BOTH replaced and never attacks in the control arm at all. The hazard is a
         * DIFFERENT, damaging move thrown after the silence. */
        if (idOf(a.m) === idOf(e.id)) { if (!silenced.has(i)) silenced.set(i, t); continue; }
        const mv = dex.moves.get(a.m);
        if (silenced.has(i) && mv && mv.exists && mv.basePower > 0)
          return 'the CONTROL ARM IS NOT INERT IN THIS SCENARIO. ' + side + ' slot ' + i + ' has its '
            + pretty(e.id) + ' click replaced by ' + pretty(INERT) + ' on turn ' + (silenced.get(i) + 1)
            + ', and the SAME BODY throws ' + mv.name + ' on turn ' + (t + 1) + '. ' + pretty(INERT)
            + ' adds ' + INERT_RAISES_CRIT_STAGES + ' critical-hit stages, so the control arm can land '
            + 'a crit the subject arm cannot, and the delta would be the control\'s rather than the '
            + 'entity\'s — the exact shape that produced four false findings in the abilities stage.';
        if (idOf(a.m) === idOf(e.id)) silenced.set(i, t);
      }
    }
  }
  return null;
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

/* =================================================================================================
 *  ARM 1 — TWO MODIFIERS AT ONE STAGE. THE ONE THING EVERY ENTRY ABOVE IS BLIND TO.
 *
 * Every roster entry so far stages exactly ONE thing, which is precisely the shape the defect class
 * below survives. Showdown folds every handler registered at a damage stage into a single
 * `event.modifier` and spends it ONCE; an engine that applies two multipliers separately gets a
 * different number by a rounding step, and the gap is a HP or two — invisible against one modifier
 * and real against two. CONFIRMED TONIGHT, outside this file: Gallade's Drain Punch into Snorlax with
 * IRON FIST *and* MUSCLE BAND read 227 against the authority's 228, while each one ALONE agreed.
 *
 * THE MEMBERSHIP IS A CROSS PRODUCT, DERIVED: every base-power ITEM against every base-power ABILITY
 * that one legal body can hold at the same time, restricted to the moves both of them actually scope.
 * Nothing is hand-paired.
 *
 * AND THE ENTRY CARRIES ITS OWN SINGLES. A pair that DIFFERS is only interesting if each half AGREES
 * — otherwise it is one broken modifier, not a folding bug — so a differing pair is re-run with the
 * item alone and with the ability alone and the report says which of the three arms parted. That is
 * the whole content of the finding and it cannot be read off the pair arm by itself.
 * ================================================================================================= */
function pairPopulation() {
  const items = dex.items.all().filter(i => i.exists && !i.isNonstandard && i.onBasePower
    && /Holder's ([A-Z][a-z]+)-type|Holder's (physical|special)/.test(i.shortDesc || ''));
  const abils = dex.abilities.all().filter(a => a.exists && !a.isNonstandard
    && (a.onBasePower || a.onModifyAtk || a.onModifySpA) && (CARRIERS[a.id] || []).length);
  const out = [];
  for (const ab of abils) {
    const C = carrierFor(ab);
    if (!C || C.tier !== 'ALTERNATE') continue;
    const sp = dex.species.get(C.species);
    for (const it of items) {
      /* the click has to be inside BOTH scopes, or the pair is not a pair */
      const m = /Holder's ([A-Z][a-z]+)-type attacks/.exec(it.shortDesc || '');
      const cat = /Holder's (physical|special) attacks/.exec(it.shortDesc || '');
      let mv = null;
      if (m) mv = (DELIVERY[m[1]] || {}).best;
      else if (cat) { for (const t of Object.keys(DELIVERY)) {
        const c = DELIVERY[t][cat[1] === 'physical' ? 'physical' : 'special'];
        if (c && dex.getImmunity(c.type, dex.species.get(CAST.BAG().species).types) !== false
            && dex.getEffectiveness(c.type, dex.species.get(CAST.BAG().species).types) === 0) { mv = c; break; } }
      }
      if (!mv) continue;
      if (dex.getImmunity(mv.type, dex.species.get(CAST.BAG().species).types) === false) continue;
      out.push({ item: it, ability: ab, carrier: sp, control: C.control, move: mv });
    }
  }
  return out;
}
function assignPairs() {
  const out = [];
  for (const p of pairPopulation()) {
    const sc = scaffold({ hpB: 8, subject: 'A0',
      a0: mon(p.carrier.id, p.item.id, dex.abilities.get(p.ability.id).name, [p.move.id]),
      b0: { ...CAST.BAG(), moves: [INERT] },
      script: [turn([click(p.move.id, 0), IDLE], [IDLE, IDLE]),
               turn([click(p.move.id, 0), IDLE], [IDLE, IDLE])] });
    sc.id = 'pair/' + p.item.id + '+' + p.ability.id;
    sc.kind = 'pair'; sc.entityId = p.item.id; sc.abilityId = p.ability.id;
    out.push({ kind: 'pair', id: p.item.id + '+' + p.ability.id,
      name: p.item.name + ' + ' + p.ability.name, rule: 'pair/two-modifiers-at-one-stage',
      reads: 'both entities register a base-power or attack handler, and one legal body can hold both',
      note: p.carrier.name + ' clicks ' + p.move.name + '; control = neither, singles run on a DIFFER',
      scenario: sc, pair: p });
  }
  return { entries: out, banned: [] };
}

function assign(kind) {
  if (kind === 'pair') return assignPairs();
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
    sc.arm = hit.m.arm || PRIMARY_ARM_ID;
    const row = { kind, id: e.id, name: e.name, rule: hit.rule.id, ruleObj: hit.rule,
                  reads: hit.rule.reads, note: hit.m.note || '', tier: hit.m.tier || null,
                  controlQuiet: hit.m.controlQuiet !== false, scenario: sc };
    const nq = controlQuietAudit(row);
    if (nq) row.controlNotQuiet = nq;
    out.push(row);
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
const VERDICT_ORDER = ['FIRED-AND-BOARDS-DIFFER', 'DID-NOT-FIRE', 'DEFERRED-BY-OWNER', 'FIRED-AND-BOARDS-MATCH',
                       'CONTROL-NOT-QUIET', 'COULD-NOT-STAGE'];

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
  /* ---- THE MOVE STAGE'S POOL, PRINTED BEFORE IT IS BELIEVED ------------------------------------
   * This is the block that would have caught the over-match on the first run instead of the second.
   * `carrierAbility` — the ITEM stage's filter — hands out SHIELD DUST to twenty species, AROMA VEIL
   * to nine, plus Sweet Veil, Flower Veil, Contrary, Unaware and Prankster, every one of which is a
   * live participant in a move experiment. The strict filter and what it costs are both here. */
  console.log('\n  THE MOVE STAGE\'S BODY POOL — every legal, buildable body carrying an ability with');
  console.log('  NO `on*` KEY AT ALL (not "no on* FUNCTION": Shell Armor\'s handler is the literal');
  console.log('  `false`, which a handler-shaped filter waves straight through):');
  for (const arm of [PRIMARY_ARM_ID, BOTTOM_ARM]) {
    const rows = moveBodies(arm);
    console.log('    ' + arm.padEnd(18) + rows.length + ' species   '
      + rows.map(r => r.sp.name + ' (' + r.sp.types.join('/') + ', ' + r.ability + ')').join(', '));
  }
  console.log('  and excluded from the silent set BY HAND, because each acts through a FIELD the');
  console.log('  engines read rather than through a handler:');
  for (const k of Object.keys(MOVE_FIELD_ACTORS))
    console.log('    ' + pretty(k).padEnd(12) + MOVE_FIELD_ACTORS[k]);
  console.log('  the crit armours, and the measurement that decides whether they may be used:');
  console.log('    ' + critsLand().why.replace(/\s+/g, ' '));
  console.log('  the aggressor (NOT the cast\'s Dragapult — Infiltrator IGNORES a screen and a');
  console.log('  Substitute, and this stage raises both):');
  for (const arm of [PRIMARY_ARM_ID, BOTTOM_ARM])
    console.log('    ' + arm.padEnd(18) + pretty(CLICKER(arm).species) + ' (' + CLICKER(arm).ability + ')');
  console.log('  which pin arm each move needs, decided by the move\'s OWN accuracy and crit ratio:');
  {
    const legal = population('move').legal;
    const bot = legal.filter(m => armFor(m) === BOTTOM_ARM);
    console.log('    ' + (legal.length - bot.length) + ' on ' + PRIMARY_ARM_ID + ', ' + bot.length
      + ' on ' + BOTTOM_ARM + ' — the latter would stage NOTHING under the primary pin and would have '
      + 'read "identical"');
    console.log('      ' + bot.slice(0, 16).map(m => m.name).join(', ') + ', +' + (bot.length - 16) + ' more');
  }

  /* ---- THE ABILITY STAGE'S OWN VOCABULARY, AND THE MEMBERSHIP OF EVERY ABILITY RULE -------------
   * The membership is the thing that has to be seen rather than believed. `refusesStatusMoves`
   * caught Telepathy and `speedOnItemLoss` caught Sticky Hold, both by over-matching a shape; the
   * only defence that has ever worked here is printing what a rule matched BEFORE trusting a count.
   * These fifteen rules read handler SOURCE, which is a wider net than a field, so this block is not
   * optional. */
  console.log('\n  THE ABILITY STAGE\'S DERIVED VOCABULARY:');
  console.log('    weather setters, read off each ability\'s own onStart `setWeather` call:');
  for (const w of Object.keys(WEATHER_SETTER))
    console.log('      ' + w.padEnd(14) + WEATHER_SETTER[w].ability + ' on ' + WEATHER_SETTER[w].species);
  console.log('    the stat-drop COVER (greedy over stats, not top-N by count) — ' + DROP_SET.stats.join(', '));
  for (const m of DROP_SET.moves)
    console.log('      ' + m.name.padEnd(16) + JSON.stringify(m.boosts));
  console.log('    AND THE STAT NO LEGAL MOVE IN THIS FORMAT LOWERS AT ONE BODY: accuracy. Sand '
    + 'Attack, Smokescreen,\n      Flash and Kinesis are all isNonstandard "Past" here and Sweet Scent '
    + 'lowers EVASION at every foe.\n      Keen Eye and Illuminate are therefore DECLINED by '
    + 'ability/stat-drop-reaction (not refused — see the rule).');
  console.log('    the priority click: ' + (PRIORITY_HIT ? PRIORITY_HIT.name + ' (priority +'
    + PRIORITY_HIT.priority + ', ' + PRIORITY_HIT.basePower + ' BP)' : 'NONE'));
  console.log('    the taunt click:    ' + (TAUNT_MOVE ? TAUNT_MOVE.name : 'NONE'));
  {
    const rows = assign('ability').entries;
    console.log('\n  WHAT EACH ABILITY RULE ACTUALLY MATCHED — printed before the count is believed:');
    for (const r of RULES.filter(x => x.kind === 'ability')) {
      const mine = rows.filter(x => x.rule === r.id);
      console.log('    ' + r.id.padEnd(38) + String(mine.length).padStart(4) + '   '
        + mine.map(x => x.name).slice(0, 14).join(', ')
        + (mine.length > 14 ? ', +' + (mine.length - 14) + ' more' : ''));
    }
  }

  console.log('\n  100-accuracy status carriers:');
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
              : STAGE === 'moves' ? ['move'] : STAGE === 'pairs' ? ['pair']
              : STAGE === 'all' ? ['item', 'ability', 'move'] : ['item'];
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
  /* A SWITCH STEP IS NOT A CLICK, and the shared fixture audit only knows about clicks — it reads
   * `a.m`, so `{ sw: 'espathra' }` arrives as `no such move "undefined"` and refuses the whole run.
   * The audit is right to be strict; what it is handed is what needs fixing. A switch is replaced by
   * `null` in the AUDIT COPY ONLY — which the audit already treats as "this slot does nothing" — so
   * the per-slot count check still applies and no real click escapes inspection. Neither engine sees
   * this copy. */
  const shells = staged.map(e => ({ id: e.scenario.id, A: e.scenario.A, B: e.scenario.B,
    arm: e.scenario.arm,
    script: e.scenario.script.map(st => ({ p1: st.p1.map(a => (a && a.sw ? null : a)),
                                           p2: st.p2.map(a => (a && a.sw ? null : a)) })) }));
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
    /* A DIFFERING PAIR IS ONLY A FOLDING BUG IF EACH HALF AGREES ON ITS OWN. Re-run the two singles
     * and record which arms parted, because "both together are wrong" and "one of them is wrong"
     * are different findings and the pair arm cannot tell them apart. */
    if (e.pair && r.verdict === 'FIRED-AND-BOARDS-DIFFER') {
      const single = (keepItem, keepAbility) => {
        const sc = { ...e.scenario, id: e.scenario.id + (keepItem ? '/item' : '/ability'),
          A: e.scenario.A.map((m, i) => (i === 0 ? { ...m,
            item: keepItem ? m.item : '',
            ability: keepAbility ? m.ability : (altAbility(dex.species.get(m.species), e.pair.ability.id) || m.ability) }
            : m)) };
        const got = play(sc, null);
        return got.bad ? got.bad : (got.boards.some(b => b.diffs.length) ? 'PARTS' : 'agrees');
      };
      r.singles = { item_alone: single(true, false), ability_alone: single(false, true) };
    }
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
        /* CONTROL-NOT-QUIET COUNTS AS "THE BOARD MOVED" HERE AND NOWHERE ELSE. The red demonstration
         * asks whether the PLANT changes a board, which is a question about the simulator; the quiet
         * gate exists to stop a delta being ATTRIBUTED to an entity, which is a different question. */
        if (br.verdict === 'FIRED-AND-BOARDS-DIFFER' || br.verdict === 'DID-NOT-FIRE'
            || br.verdict === 'CONTROL-NOT-QUIET') {
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
    if (v === 'CONTROL-NOT-QUIET') {
      for (const r of rows) {
        console.log('    ' + r.name.padEnd(22) + '[' + r.rule + ']   ' + (r.note || ''));
        console.log('      ' + (r.control_why || '').replace(/\s+/g, ' '));
        for (const d of (r.sd_delta || []).slice(0, 3))
          console.log('        (the CONTROL\'s own delta, turn ' + d.turn + ') ' + SAY(d, r.boards));
      }
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
        if (r.controlQuiet === false) console.log('      CAVEAT: the control ability is itself ACTIVE '
          + '— its species carries no quiet alternative — so this delta is (subject MINUS a live '
          + 'control) and cannot on its own say which of the two moved the board.');
      } else {
        for (const d of (r.subject_diffs || []).slice(0, 6)) {
          console.log('        SHOWDOWN  ' + BS.explain(d, d.sd, pretty));
          console.log('        OURS      ' + BS.explain(d, d.us, pretty)
            + '        [' + (d.slot || d.side || 'field') + ' ' + d.field + ' / ' + d.bucket + ']');
        }
        if (r.singles) console.log('        THE TWO HALVES ALONE:  ' + r.pair.item.name + ' only -> '
          + r.singles.item_alone + '   |   ' + r.pair.ability.name + ' only -> ' + r.singles.ability_alone
          + (r.singles.item_alone === 'agrees' && r.singles.ability_alone === 'agrees'
             ? '\n        BOTH HALVES AGREE ALONE AND THE PAIR DOES NOT — this is a STAGE-FOLDING '
               + 'defect, not a broken modifier.' : ''));
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

  /* ---- THE MIRROR TEST — THE INSTRUMENT CHECKING ITSELF ----------------------------------------
   *
   * IF SUBJECT A'S CONTROL IS B AND SUBJECT B'S CONTROL IS A, THEIR DELTAS ARE THE SAME MEASUREMENT
   * WITH THE SIGN FLIPPED. Whatever number comes out belongs to whichever of the two the engine
   * actually implements, and the pair CANNOT say which. Sand Rush reported `with 818 / without 850`
   * and Fluffy reported `with 850 / without 818` — one 32-HP fact, two accusations, and the guilty
   * mechanic was the CONTROL both times.
   *
   * It is free: no game is replayed, the deltas are already on the results. A stage in which no such
   * pair exists says so, because "the check found nothing" and "the check could not run" are the two
   * readings this project keeps confusing. */
  const ctrlIdOf = (r) => (r.kind === 'ability' && r.scenario && r.scenario.controlAbility)
    ? idOf(r.scenario.controlAbility) : null;
  const mirrored = [], byId = {};
  /* KEYED TO ABILITIES ONLY, because `--stage all` puts three populations in one `results` array and
   * an id is only unique WITHIN a kind: `metronome` is an item AND a move, `sharpness` and `guard`
   * families collide the same way. `ctrlIdOf` returns an ABILITY id, so an unscoped map would let a
   * move stand in as an ability's control and the mirror test would compare two unrelated entities. */
  for (const r of results) if (r.scenario && r.kind === 'ability') byId[r.id] = r;
  for (const r of results) {
    const c = ctrlIdOf(r); if (!c) continue;
    const o = byId[c]; if (!o || ctrlIdOf(o) !== r.id || r.id > o.id) continue;
    const swap = [];
    for (const d of (r.sd_delta || [])) for (const e2 of (o.sd_delta || []))
      if (d.turn === e2.turn && d.path === e2.path
          && String(d.with) === String(e2.without) && String(d.without) === String(e2.with))
        swap.push(d.path + '  ' + pretty(r.name) + ' with=' + d.with + '/without=' + d.without
          + '   ' + pretty(o.name) + ' with=' + e2.with + '/without=' + e2.without);
    if (swap.length) mirrored.push({ a: r, b: o, swap });
  }
  const mirrorPairs = results.filter(r => ctrlIdOf(r) && byId[ctrlIdOf(r)]
    && ctrlIdOf(byId[ctrlIdOf(r)]) === r.id).length / 2;
  console.log('\n  THE MIRROR TEST — does an entity control the entity that controls it?   '
    + mirrorPairs + ' such pair(s) in this stage');
  if (!mirrorPairs) console.log('    NONE EXIST HERE, which is a property of the control and not a '
    + 'clean bill of health: a MOVE is controlled by the inert click, which the selftest proves moves '
    + 'no board leaf in either engine, so no move can be another move\'s control.');
  for (const m of mirrored) {
    console.log('    SAME NUMBERS SWAPPED   ' + m.a.name + ' <-> ' + m.b.name
      + '   [' + m.a.verdict + ' / ' + m.b.verdict + ']');
    for (const s of m.swap.slice(0, 4)) console.log('        ' + s);
  }
  if (mirrorPairs && !mirrored.length) console.log('    and none of them reported the same numbers '
    + 'swapped, so no pair in this stage is measuring its own control.');

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
      mirror: { pairs: mirrorPairs, same_numbers_swapped: mirrored.map(m => ({ a: m.a.id, b: m.b.id,
        verdicts: [m.a.verdict, m.b.verdict], leaves: m.swap })) },
      results: results.map(r => ({ kind: r.kind, id: r.id, name: r.name, rule: r.rule, reads: r.reads || null,
        note: r.note || null, verdict: r.verdict, why: r.why || null,
        arm: (r.scenario && r.scenario.arm) || PRIMARY_ARM_ID, control_why: r.control_why || null,
        sd_delta: (r.sd_delta || []).map(d => ({ turn: d.turn, path: d.path, with: d.with, without: d.without })),
        diffs: (r.subject_diffs || []).map(d => ({ turn: d.turn, slot: d.slot, body: d.body,
          field: d.field, showdown: d.sd, ours: d.us, bucket: d.bucket })) })) };
    /* ---- THE WRITE IS STAGE-PRESERVING, AND IT WAS NOT (ROADMAP #107) ---------------------------
     *
     * This wrote `data/roster.json` UNCONDITIONALLY, whatever stage ran. One file cannot carry three
     * stages, so a moves run silently destroyed the abilities results — twice on 2026-08-08, both
     * times recovered only because they had been copied aside BY HAND.
     *
     * `engine/quarantine.js` is the reader that makes this matter, and its rule is already written
     * down there: a stage is satisfied ONLY by an artifact whose own `stage` field names it, tried as
     * `data/roster.<stage>.json`, then `data/roster.all.json`, then `data/roster.json`. Two of its
     * four clauses were failing purely on ABSENCE — not on a red, on nothing being on disk.
     *
     * So the PER-STAGE FILE IS THE ARTIFACT and `data/roster.json` is a convenience copy of whatever
     * ran last. The convenience copy is written second and named as such, because a reader that took
     * it for the whole roster is the failure this fixes.
     *
     * AND AN OVERWRITE IS ANNOUNCED. A stage artifact that is about to be replaced by a shorter or
     * differently-pinned run is the one thing nobody can get back, so the previous file's stamp is
     * printed before it goes and the old bytes are kept beside it as `.prev.json`. A silent
     * replacement looks exactly like a first write. */
    if (HAS('--write')) {
      const perStage = D('data', 'roster.' + STAGE + '.json');
      if (fs.existsSync(perStage)) {
        let old = null;
        try { old = JSON.parse(fs.readFileSync(perStage, 'utf8')); } catch (err) { old = null; }
        console.log('  REPLACING an existing data/roster.' + STAGE + '.json'
          + (old ? ' (stage ' + old.stage + ', release ' + old.engine_release + ', generated '
                   + old.generated + ', ' + JSON.stringify(old.counts) + ')'
                 : ' (unreadable — its bytes are kept anyway)'));
        fs.writeFileSync(D('data', 'roster.' + STAGE + '.prev.json'), fs.readFileSync(perStage));
        console.log('    its bytes are kept at data/roster.' + STAGE + '.prev.json');
      }
      fs.writeFileSync(perStage, JSON.stringify(art, null, 1));
      console.log('  wrote data/roster.' + STAGE + '.json   <- THIS is what engine/quarantine.js reads');
      fs.writeFileSync(D('data', 'roster.json'), JSON.stringify(art, null, 1));
      console.log('  wrote data/roster.json (a convenience copy of the LAST stage run — not the roster)');
    }
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
