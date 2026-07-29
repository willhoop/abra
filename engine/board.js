/* board.js — what the board looked like at the moment a decision was made, and the features a
 * policy scores a candidate move with.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The behaviour clone (engine/policy.js -> data/move-priors.json) answers ONE question: "what does
 * this species usually click?" It is blind to the board. That blindness is visible as two numbers in
 * the realism report and neither is fixable by tuning a prior:
 *
 *     moves that were super effective   ours 10.8%   real 23.4%
 *     moves that outright failed        ours  8.7%   real  2.7%
 *
 * A player who cannot see the other side aims at random and clicks moves that cannot work. This file
 * is the eyes. It does not decide anything — engine/magnemite.js does that — it only reconstructs
 * the state and turns (move, target) pairs into numbers.
 *
 * ONE DEFINITION, TWO CONSUMERS (S12).
 * The feature vector is defined here exactly once and imported by both the fitter
 * (engine/fit_policy.js, offline, reading stored games) and the player (engine/magnemite.js,
 * online, inside the simulator). If those two ever computed features differently the fitted weights
 * would be applied to a different vector than they were learned on, and the resulting bot would be
 * wrong in a way no test would catch. That is why FEATURES is a single exported list and why both
 * adapters end up in the same `featuresFor` call.
 *
 * ALMOST NOTHING HERE IS A RULE ABOUT POKEMON (S13) — AND THE WORD "ALMOST" IS NEW.
 * Every "this move cannot work right now" test reads a DATA FIELD off the Showdown dex —
 * `move.status`, `move.sideCondition`, `move.pseudoWeather`, `move.weather`, `move.stallingMove` —
 * and compares it to tracked state. Where a rule lives in a HANDLER rather than a field, the handler
 * is CALLED with a stub of the board (see moveType, moveAccuracy, chargeTurns, effectivePriority),
 * so Weather Ball's retyping, Blizzard's accuracy in snow, Solar Beam firing at once in sun and Gale
 * Wings' full-health condition are all read from Showdown rather than restated here.
 *
 * This header used to claim there was NO list of moves in this file. One evening of adding features
 * made that false — 18 distinct Pokemon names appeared in the code. Most were derivable and are now
 * derived (see `derived()`); the rest are collected in GAME_RULES, in one place, each with the
 * reason it cannot be read from data. A claim that quietly stops being true is worse than a rule
 * that was always visible, so the exceptions are declared rather than the claim repeated.
 *
 * A move whose failure condition is expressed as code with no probeable handler (Fake Out is the
 * notable one) is still simply NOT covered, deliberately. See the FAKE OUT note on turnsActive.
 */
'use strict';

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* Mega formes act under their own name but are listed on a team sheet as the base species, so a
 * decision by "charizardmegay" must look up "charizard"'s moves. This is a rule about the NAMING
 * convention, not about any particular Pokemon, and it is the same tail-test used in
 * prior_player.js. Getting it wrong is silent: the lookup misses and the decision is dropped. It
 * accounted for every one of the 559 unresolvable decisions in the first pass over the open-sheet
 * corpus (charizardmegay 96, floettemega 72, raichumegay 45, ...). */
const baseSpecies = s => norm(s).replace(/mega[xy]?$/, '');

/* ---------------------------------------------------------------------------------------------
 * THE FEATURE VECTOR
 *
 * Order is load-bearing: the fitted weight file stores a plain array and both consumers index it
 * through this list. Adding a feature means refitting, which is why FEATURES is exported and the
 * weight file records the list it was fitted against (fit_policy.js refuses to load a mismatch).
 * ------------------------------------------------------------------------------------------- */
const FEATURES = [
  /* EFFECTIVENESS IS ONE-HOT, NOT LINEAR — and that is a correction.
   * A single `eff` term on Showdown's integer scale forces 4x to be worth EXACTLY twice 2x, by
   * construction rather than by measurement. Asked directly whether a 4x hit should be the biggest
   * pull available, the honest answer was that the old model could not say: it had assumed the
   * answer. These are the FRACTION of targets hit in each bucket (so a spread move can be 4x on one
   * foe and resisted by the other), with a neutral hit as the reference level. */
  'eff4',            // it hits a 4x weakness
  'eff2',            // it hits a 2x weakness
  'effHalf',         // it is resisted
  'effQuarter',      // it is resisted twice over
  'allyHit',         // it also hits my own partner, and my partner is not immune to it
  /* P(the target's ABILITY nullifies this move). Flash Fire eating Fire and Armor Tail refusing
   * priority are FACTS about the game, not judgements about value, so encoding them costs nothing
   * in ceiling. They are read from data/ability-blocks.json, which is measured from recorded
   * battles rather than typed, and weighted by Smogon's per-species ability odds — so this never
   * peeks at hidden information, it only knows what the population knows. */
  'abilityBlock',    // the target probably has an ability that eats it
  'immune',          // it does nothing at all
  'stab',            // it matches my own type
  'bp',              // it is a powerful move
  /* ACCURACY. A fact in the dex (`move.accuracy`) that this model could not see, so it had no way to
   * learn that people click Rock Slide over Focus Blast for reasons that have nothing to do with type
   * or power. `true` in the dex means "never misses", which is why this is not simply a division. */
  'accuracy',        // how often it hits, on THIS board (snow makes Blizzard certain)
  /* ---- MOVES THAT COST MORE THAN A TURN ---------------------------------------------------------
   * A two-turn move gives the opponent a free turn, and a recharge move gives them one afterwards.
   * Both are dex data (`flags.charge`, `self.volatileStatus === 'mustrecharge'`) and neither was
   * visible, so Hyper Beam looked like a very strong Normal move with no downside at all. Solar Beam
   * in sun and Electro Shot in rain skip the charge, which is asked of the handler, not written down. */
  'chargeTurn',      // it needs a turn to wind up on this board
  'rechargeTurn',    // it costs me the turn AFTER this one
  /* ---- PIVOTS ------------------------------------------------------------------------------------
   * U-turn, Volt Switch, Flip Turn, Parting Shot, Chilly Reception, Baton Pass, Shed Tail. They deal
   * damage AND switch, which is a different act from either, and `move.selfSwitch` says so in data. */
  'pivots',          // it damages and brings me out
  'isStatus',        // it is a status move
  'tgtHurt',         // the target is already hurt
  'deadStatus',      // the target already has a status, so it would fail
  'deadSide',        // that side effect is already up, so it would fail
  'deadField',       // that field effect is already up, so it would fail
  'deadWeather',     // that weather is already set, so it would fail
  'deadStall',       // I protected last turn, so it would probably fail
  /* PRANKSTER DOES NOT WORK ON DARK TYPES, and this is the nastiest member of the "dead move" family
   * because the ability that is supposed to HELP is what kills it. Whimsicott's Thunder Wave into
   * Kingambit does nothing whatsoever, while an ordinary Pokemon's Thunder Wave into the same
   * Kingambit lands perfectly well. So it cannot be read off the target alone or off the move alone;
   * it is the conjunction, and it is weighted by how likely this user is to have Prankster at all.
   *
   * Showdown enforces it in battle-actions rather than in a handler, so unlike Gale Wings above there
   * is nothing to probe -- the type test is written here, which makes it the one Pokemon rule in this
   * block. It is stated plainly rather than hidden. */
  'pranksterFailsDark', // my Prankster status move is aimed at a Dark type, so it does nothing
  /* ENCORE INTO A FRESH SWITCH-IN ALWAYS FAILS, and MAG did it in a real game against a person.
   *
   * Encore locks a target into its LAST MOVE, so a Pokemon that just came in -- having used nothing
   * -- cannot be Encored at all. Same for Disable, Torment, Spite, Mimic and Instruct: every one
   * operates on a move the target has already made. Encore is on 5.34% of teams in this format, so
   * this is not a corner case.
   *
   * The state was already tracked: `lastMove` is set by endTurn and a switch-in starts with none.
   * The feature simply did not exist, which is the whole "this move cannot work right now" family
   * -- deadStatus, deadSide, deadField -- missing its seventh member.
   *
   * Found by a human playing the bot for ten minutes, which no automated check had managed. */
  'deadNoLastMove', // it needs the target to have already moved, and the target just switched in
  /* ---- STATS. FACTS THE MODEL COULD NOT SEE AT ALL UNTIL NOW ------------------------------------
   * Speed is a fact. So are Attack, Defence and HP. They sit in the dex for every species and none
   * of them were features, which is why this model could not learn any of the things it was
   * repeatedly asked about: it cannot learn that burn is worth more against a physical attacker
   * when it cannot see Attack, and it cannot learn what Tailwind is for when it cannot see Speed.
   * The judgement is still fitted — only the ingredients are supplied. Each is scaled so a value
   * near 0 means "typical for this format" and the sign carries the meaning. */
  /* ---- WHO MOVES FIRST -------------------------------------------------------------------------
   * Not a judgement, a rule: priority beats speed, Tailwind doubles a side's speed, and Trick Room
   * reverses the whole order. The first version of this compared BASE SPEED and nothing else, which
   * is wrong on every Tailwind turn, every Trick Room turn and every priority move -- and Trick Room
   * teams are a pillar of this format. board.js already tracks all three; it simply was not asked. */
  'movesFirst',      // I move before the target, counting priority, Tailwind and Trick Room
  'priority',        // this move cuts the queue (Fake Out, Sucker Punch, Extreme Speed)
  'tgtPhysical',     // the target attacks physically rather than specially (negative = specially)
  'defMismatch',     // I hit its softer defence
  'tgtBulk',         // the target is bulky
  /* ---- DOES IT KILL. THE LARGEST HOLE IN THIS MODEL --------------------------------------------
   * Until now MAG could not tell whether a move removes the thing it is aimed at. Most of what a VGC
   * turn is about is exactly that, and the evidence the model was straining for it is already on
   * record: when the same 21 features were re-optimised for WINNING instead of for resembling people,
   * the weight on `tgtHurt` -- "the target is already damaged", the only KO proxy available -- rose
   * from +0.34 to +2.75. It was reaching for a kill signal through the one crude channel it had.
   *
   * A kill is a FACT. It follows from the stats, the type chart and the damage formula, so encoding
   * it costs nothing in ceiling -- the same argument that admitted speed, burn and Flash Fire. What
   * stays fitted is how much a kill is WORTH relative to everything else.
   *
   * The damage number is not computed here. engine/medicham2-browser.js already carries the one
   * damage formula in this project that has been checked move-for-move against @smogon/calc (31 of
   * 31 within 2%), and the repository has already been burned once by a second implementation
   * drifting from the first -- mega Charizard-Y's Special Attack disagreed by 30%. So this calls
   * that function. A fourth damage engine is not a feature.
   *
   * The stat lines come from the same public source as everything else the model sees: Smogon's
   * observed spreads. That is not peeking at hidden information -- both players know what a Garchomp
   * usually runs, exactly as both players know it usually has Rough Skin. */
  'koTarget',        // the odds this really kills it: the worst roll still does, and the move lands
  'dmgFrac',         // how much of what is left of the target it takes
  'tgtMayProtect',   // how often this target blocks: the biggest reason a sure kill is not one
  'killIsRoll',      // it kills some spreads and not others: a roll rather than a read
  /* WILL I BE KILLED. This cannot be a feature on its own, and the reason is structural rather than
   * a judgement call: a conditional logit compares candidates within one decision, so any quantity
   * identical across all of a Pokemon's options -- and "am I threatened" is a property of the board,
   * not of the move -- cancels exactly out of the softmax and can never receive a weight. It has to
   * enter as an INTERACTION with something the move changes. These are those interactions. */
  'killsThreat',     // it kills the thing that was about to kill me
  'koFirst',         // it kills, and I move first, so the kill lands before their attack
  'protectThreatened', // this move protects, and I am facing a kill
  /* ---- WHAT A MOVE DOES TO THE OTHER PLAYER'S OPTIONS -------------------------------------------
   * Taunt, Encore and Disable have no base power, set no status, no screen and no weather. In every
   * version of this vector before now they were INDISTINGUISHABLE from any other status move, and so
   * they rode entirely on how often people click them. A model that cannot represent what Taunt does
   * can never learn when it is right.
   *
   * No move is named here. `move.volatileStatus` is a dex DATA field and it carries all of them --
   * taunt, encore, disable, followme, ragepowder, substitute, 35 distinct values in this format. The
   * split is by `move.target`, which is also data: a volatile aimed at the opponent takes something
   * away from them, a volatile aimed at yourself adds something to you, and those are different acts.
   *
   * KNOWN GAP, STATED: the stored games do not record volatile statuses, so this cannot tell that a
   * target is ALREADY taunted -- the way deadStatus can tell they are already burned. Taunting into
   * a Taunt therefore looks the same as the first one. That is a data limitation, not a modelling
   * choice, and it will stay until the ingest records them. */
  'volatileOnFoe',   // it takes an option away from the target (Taunt, Encore, Disable)
  'volatileOnSelf',  // it puts something on me or my side (Substitute, Follow Me, Rage Powder)
  /* ---- STAT STAGES ------------------------------------------------------------------------------
   * Intimidate, Snarl, Icy Wind, Swords Dance. The stages now reach the damage estimate, so their
   * effect on how hard a move hits is already inside dmgFrac and koTarget. These four are the
   * separate question of whether a stage is worth CHASING or worth AVOIDING, which is a judgement
   * and therefore fitted rather than written down.
   *
   * `move.boosts` and `move.self.boosts` are dex data fields, so no move is named here either. */
  'myOffenseStage',  // how boosted the stat I am attacking with already is
  'tgtDefenseStage', // how boosted the defence I am attacking into already is
  'movesBoostMe',    // this move raises one of my own stats
  'movesLowerFoe',   // this move lowers one of the target's stats
  /* ---- STATUS THAT ACTUALLY BITES ---------------------------------------------------------------
   * Burn halves physical Attack. That is a rule of the game, not an opinion, which is why it is
   * allowed in here -- and it is the whole reason Will-O-Wisp into a special attacker is a wasted
   * turn. The model already had `tgtPhysical` and `isStatus` separately and could not multiply them:
   * a linear score cannot form "burn AND physical" out of two main effects, so it had no way to
   * express the difference. Paralysis is the same shape against a fast target. */
  'statusBites',     // the status this inflicts hits a stat the target actually relies on
  /* ---- AM I EVEN GOING TO GET TO DO THIS -------------------------------------------------------
   * If a kill is aimed at me and I do not move first, everything I might click is worth nothing --
   * I am gone before it happens. That is a fact about the queue, and it is the condition that makes
   * switching or Protect right rather than merely available. */
  'diesBeforeMoving', // I am facing a kill and I do not move first
  /* ---- SWITCHING -------------------------------------------------------------------------------
   * The facts, and only the facts. "Switch when threatened if the incoming Pokemon can take the hit"
   * is a good rule and it is NOT written here, because writing it would cap the model at whoever
   * wrote it. What goes in is what is measurable -- how much of the incoming attack the replacement
   * would actually eat, and whether it outruns the thing threatening it -- and the weight on each is
   * fitted from games where people did and did not switch.
   *
   * The two survival terms are separate on purpose. Run and Bun's AI, which is a hand-tuned rulebook
   * and worth reading for its shape rather than its numbers, tests exactly this pair: come in only if
   * the replacement is faster and not one-shot, OR slower and not two-shot. Whether that conjunction
   * is right is a judgement, so it is left to the fit; the two halves are supplied as facts. */
  'isSwitch',        // this candidate is a switch, not a move
  'switchSurvives1', // the replacement lives through the hardest thing aimed at me
  'switchSurvives2', // it lives through that twice
  'switchFaster',    // the replacement outruns the thing that was threatening me
  /* ---- WHAT THE CROWD DOES ---------------------------------------------------------------------
   * The only feature here that is not a fact about the game. It is what the previous bot ran on by
   * itself, kept as one term among 25 rather than as the whole model, so its pull can be measured
   * against the facts instead of assumed. */
  /* ---- PROTECTING INTO AN ENCORE -----------------------------------------------------------
   * Will's observation, and it is a rule good players follow explicitly: you do not Protect in front
   * of a Prankster or a fast Encore user unless you are Dark. Protect is the most predictable move in
   * the game, Encore locks you into your LAST move, and a Pokemon locked into Protect fails it every
   * turn afterwards and is helpless while its partner is dismantled.
   *
   * The Dark clause is the same fact pranksterFailsDark already carries, seen from the other side: a
   * Prankster-boosted Encore does nothing to a Dark type, so a Dark Pokemon may Protect freely into
   * Whimsicott. That feature is the OFFENSIVE direction -- my Prankster move into a Dark target --
   * and this is the DEFENSIVE mirror, which did not exist.
   *
   * A FEATURE, NOT A RULE, and Will was explicit about why: protecting into an Encore user can still
   * be correct, so this must not prune the option. It states the fact and the fit prices it, which is
   * the same argument that keeps every other Pokemon rule in this file out of the scoring.
   *
   * Not a corner case. Encore is 5.34% of this format's usage and 3.77% of it is PRANKSTER Encore,
   * dominated by Whimsicott -- 469,820, base Speed 116, Prankster on 100% of sets, and the fourth
   * most common Pokemon in the store. */
  'stallIntoEncore', // I am about to Protect and something across from me can Encore me for it
  'priorLogP',       // it is a popular move
];
const FEATURE_INDEX = Object.fromEntries(FEATURES.map((f, i) => [f, i]));

/* ---------------------------------------------------------------------------------------------
 * THE JOINT LAYER — what a PAIR of moves is, over and above two moves
 *
 * MAG decides its two Pokemon one at a time and neither decision ever sees the other. The play that
 * exposes this is the ordinary one: the left Pokemon Protects to survive a kill while the right one
 * removes the thing that was going to kill it. MAG does not score that badly -- it CANNOT REPRESENT
 * IT. There is no number anywhere in the 46 features that means "my partner is handling it".
 *
 * The obvious repair is to score all pairs and add the two scores. That is still wrong, and wrong in
 * a way with a number attached. Both your Pokemon can kill the Charizard; independently each scores
 * "I get a kill", the best thing available; summed, that reads as TWO kills. What actually happens
 * is one kill and one wasted turn, and the Kingambit you ignored takes a free shot. Measured: humans
 * aim both attacks at the same foe 23.4% of the time, independent choice gives ~50%, and MAG sits at
 * the 50% end.
 *
 * So a pair's score is the sum of its parts PLUS these, and every one is a fact about the pair that
 * neither half can state alone. What they are worth stays fitted.
 * ------------------------------------------------------------------------------------------- */
const JOINT_FEATURES = [
  'bothSameTarget',     // both moves are aimed at the same foe
  'overkill',           // aimed at the same foe, and one alone already removes it
  'focusFireKills',     // aimed at the same foe, neither alone removes it, together they do
  'partnerCoversMe',    // one of us is facing a kill and the OTHER removes the thing threatening it
  'redirectThenAttack', // one takes the turn's attacks (Follow Me / Rage Powder) and the other swings
  'bothStatus',         // neither move damages anything: a turn spent on nothing
  'bothSwitch',         // both Pokemon leave at once, surrendering the field entirely
  /* ---- SYNERGY: ONE MOVE MAKING THE OTHER ONE WORK -----------------------------------------------
   * Everything above is about the two moves NOT wasting each other. These are the opposite: a pair
   * where one move exists only to make the other one land or land harder. Helping Hand does nothing
   * by itself; it is 50% more damage on the partner, which turns a roll into a kill. Prankster
   * Tailwind does nothing by itself either; it goes first and flips the partner from moving second
   * to moving first, which is the difference between an Earthquake landing and not.
   *
   * Neither is expressible in a single move's vector -- Helping Hand's whole value is a property of
   * the OTHER click -- and neither is a rule about Pokemon: the ally-targeting status move, the side
   * condition, the speed order and the kill probability are all already computed facts. What the
   * combination is worth stays fitted. */
  'boostsPartnerDamage',  // one of us buffs the other and the other is actually attacking
  'boostMayConvertKill',  // ...and the partner's kill is a coin flip, so the buff could decide it
  'speedSetupHelpsPartner', // one sets Tailwind or Trick Room and the partner is currently moving second
  'weatherSetupHelpsPartner', // one sets the weather the partner's move is boosted by, this turn
  'healsPartner',           // one restores the other rather than doing anything to the opponent
  'redirectThenSetup',      // one soaks the turn's attacks and the other spends it setting up safely
  'doubleKO',               // the pair removes BOTH foes at once and the field is emptied
  'flinchThenSetup',        // one flinches a foe (Fake Out) and the other uses the free turn
  'terrainSetupHelpsPartner', // one lays the terrain the partner's move is boosted by
  'screenWhileThreatened',  // one puts a screen up while the other is facing a kill
  'spreadFreeBesideAlly',   // my spread move hits everything and my own partner does not care
];
const JOINT_INDEX = Object.fromEntries(JOINT_FEATURES.map((f, i) => [f, i]));

/* `xa`/`xb` are the two single-move vectors, so the kill and threat work already done is reused
 * rather than recomputed -- this reads them rather than calling the damage engine again. */
function jointFeaturesFor(A, B, xa, xb) {
  const j = new Array(JOINT_FEATURES.length).fill(0);
  const set = (n, v) => { j[JOINT_INDEX[n]] = v; };
  if (!A || !B) return j;

  const swA = !!A.switchTo, swB = !!B.switchTo;
  if (swA && swB) set('bothSwitch', 1);
  if (swA || swB) return j;                 // the rest are statements about two MOVES

  const F = (x, n) => x[FEATURE_INDEX[n]];
  const sameTarget = A.targetMon && B.targetMon && A.targetMon === B.targetMon;
  if (sameTarget) {
    set('bothSameTarget', 1);
    const ka = F(xa, 'koTarget'), kb = F(xb, 'koTarget');
    /* Overkill and focus fire are the two sides of aiming together, and they pull opposite ways:
     * one is a wasted move, the other is the only way to remove something bulky. Kept apart so the
     * fit can price them separately instead of averaging them into nothing. */
    if (Math.max(ka, kb) >= 0.5) set('overkill', 1);
    else if (F(xa, 'dmgFrac') + F(xb, 'dmgFrac') >= 1) set('focusFireKills', 1);
  }

  /* THE PROTECT PLAY. One of us cannot survive the turn, and the other one kills what is threatening
   * -- the exact combination that has no expression in either move's own vector. */
  const aStuck = F(xa, 'diesBeforeMoving') > 0 || F(xa, 'protectThreatened') > 0;
  const bStuck = F(xb, 'diesBeforeMoving') > 0 || F(xb, 'protectThreatened') > 0;
  if ((aStuck && F(xb, 'killsThreat') > 0) || (bStuck && F(xa, 'killsThreat') > 0)) set('partnerCoversMe', 1);

  /* Follow Me and Rage Powder are only worth a turn because the partner does something with it.
   * Measured: a redirection is followed by a partner attack 97% of the time. */
  const redirA = F(xa, 'volatileOnSelf') > 0 && F(xa, 'isStatus') > 0;
  const redirB = F(xb, 'volatileOnSelf') > 0 && F(xb, 'isStatus') > 0;
  if ((redirA && F(xb, 'isStatus') === 0) || (redirB && F(xa, 'isStatus') === 0)) set('redirectThenAttack', 1);

  if (F(xa, 'isStatus') > 0 && F(xb, 'isStatus') > 0) set('bothStatus', 1);

  /* HELPING HAND AND FRIENDS. Identified by what the dex says they aim at -- a status move pointed at
   * your own partner -- rather than by name, so anything else of that shape is covered too. The
   * "could decide it" half uses killIsRoll, which already peaks exactly where a 50% damage boost has
   * something to convert: a certain kill needs no help and a hopeless one cannot be rescued. */
  const buffs = c => c && c.move && c.move.category === 'Status' &&
    (c.move.target === 'adjacentAlly' || c.ally === true);
  const attacks = x => F(x, 'isStatus') === 0;
  if ((buffs(A) && attacks(xb)) || (buffs(B) && attacks(xa))) {
    set('boostsPartnerDamage', 1);
    const partner = buffs(A) ? xb : xa;
    if (F(partner, 'killIsRoll') > 0.5) set('boostMayConvertKill', 1);
  }

  /* SPEED SET UP FOR SOMEONE ELSE. Tailwind on a Prankster user resolves before the partner acts, so
   * the partner's Earthquake lands first this turn rather than next -- but only if it was moving
   * second to begin with, which is what makes this a fact about the pair. */
  const speedSets = c => c && c.move && ((DERIVED && DERIVED.speedSide.has(norm(c.move.sideCondition || ''))) ||
    fieldKey(c.move) === GAME_RULES.trickRoomField);
  if ((speedSets(A) && F(xb, 'movesFirst') < 1) || (speedSets(B) && F(xa, 'movesFirst') < 1)) {
    set('speedSetupHelpsPartner', 1);
  }
  /* RAIN FOR THE WATER MOVE, SUN FOR THE FIRE ONE. The weather a move sets is `move.weather`, a dex
   * data field, and what the weather does to damage is already in the formula -- what neither half
   * can say is that the setter and the beneficiary are the SAME TURN's pair. Only counted when the
   * weather is not already up, since setting it again changes nothing. */
  const WX_HELPS = GAME_RULES.weatherBoost;
  const setsWx = c => (c && c.move && norm(c.move.weather || '')) || '';
  const partnerType = c => (c && c.move ? norm(c.move.type || '') : '');
  for (const [setter, other] of [[A, B], [B, A]]) {
    const w = setsWx(setter);
    if (w && WX_HELPS[w] && partnerType(other) === WX_HELPS[w] && norm(A.__weather || '') !== w) {
      set('weatherSetupHelpsPartner', 1);
    }
  }

  /* Life Dew, Hospitality, Jungle Healing. A move aimed at your own side that restores health --
   * `move.heal` and the heal flag are both dex data, so no move is named. */
  const healsAlly = c => c && c.move && (c.move.target === 'adjacentAlly' || c.move.target === 'allies' ||
    c.move.target === 'allySide') && (c.move.heal || (c.move.flags && c.move.flags.heal));
  if (healsAlly(A) || healsAlly(B)) set('healsPartner', 1);

  /* FOLLOW ME PLUS SET UP. redirectThenAttack only fires when the partner ATTACKS, so the other half
   * of what redirection is for -- buying a free turn to boost behind it -- was invisible. */
  if ((redirA && F(xb, 'movesBoostMe') > 0) || (redirB && F(xa, 'movesBoostMe') > 0)) set('redirectThenSetup', 1);

  /* BOTH FOES GONE IN ONE TURN. The single strongest thing a pair can do in doubles and the exact
   * opposite of overkill -- same two kill probabilities, aimed at DIFFERENT things. Neither move's
   * own vector can distinguish the two cases; only the pair can. */
  if (A.targetMon && B.targetMon && A.targetMon !== B.targetMon &&
      F(xa, 'koTarget') >= 0.5 && F(xb, 'koTarget') >= 0.5) set('doubleKO', 1);

  /* FAKE OUT BUYS A TURN AND SOMEBODY HAS TO SPEND IT. A flinch is a secondary effect in the dex, so
   * this is read off `move.secondaries` rather than by naming Fake Out -- Iron Head and Rock Slide
   * carry the same flag at lower odds and are covered for free. */
  const flinches = c => c && c.move && (c.move.secondaries || []).some(s => s && s.volatileStatus === 'flinch');
  if ((flinches(A) && F(xb, 'isStatus') > 0) || (flinches(B) && F(xa, 'isStatus') > 0)) set('flinchThenSetup', 1);

  /* Terrain is the other half of the weather idea: Electric Terrain for an Electric move, Grassy for
   * Grass, Psychic for Psychic. `move.terrain` is a data field and the type match is the type chart. */
  const TERRAIN_HELPS = GAME_RULES.terrainBoost;
  for (const [setter, other] of [[A, B], [B, A]]) {
    const t2 = setter && setter.move && norm(setter.move.terrain || '');
    if (t2 && TERRAIN_HELPS[t2] && other && other.move && norm(other.move.type || '') === TERRAIN_HELPS[t2]) {
      set('terrainSetupHelpsPartner', 1);
    }
  }

  /* A screen halves what comes in, so it is worth most on the turn the partner cannot survive. */
  const screens = c => c && c.move && DERIVED && DERIVED.screens.has(norm(c.move.sideCondition || ''));
  if ((screens(A) && (F(xb, 'diesBeforeMoving') > 0 || F(xb, 'protectThreatened') > 0)) ||
      (screens(B) && (F(xa, 'diesBeforeMoving') > 0 || F(xa, 'protectThreatened') > 0))) set('screenWhileThreatened', 1);

  /* EARTHQUAKE BESIDE A FLYING PARTNER. allyHit already says the partner is not hurt by my spread
   * move; what it cannot say is that the pair is therefore free -- I hit both foes and pay nothing,
   * which is a different thing from a single-target move that also happens not to hurt anybody. */
  const freeSpread = (c, x) => c && c.move && c.spread && c.spread.length > 1 && F(x, 'allyHit') === 0;
  if (freeSpread(A, xa) || freeSpread(B, xb)) set('spreadFreeBesideAlly', 1);

  return j;
}

/* P(move|species) is a top-8 table, so a legal move can be absent from it. A floor is needed rather
 * than -Infinity, which would make the move unpickable and silently shrink every choice set. The
 * floor is derived, not chosen: it is half the smallest probability the table can express at the
 * rounding it is stored with (3 decimals), i.e. the largest probability indistinguishable from
 * "never observed". */
const PRIOR_FLOOR = 0.0005;

/* ---------------------------------------------------------------------------------------------
 * BOARD STATE
 *
 * Deliberately small. Only what a feature actually reads is tracked, because every tracked field is
 * a field that can silently drift out of sync with the simulator and produce features that look
 * plausible and are wrong.
 * ------------------------------------------------------------------------------------------- */
class Board {
  constructor() {
    this.turn = 0;
    /* Conditions are maps of name -> the turn they expire on, not sets, because "is Tailwind up"
     * is a question about duration and the duration is available as data (see startSide). */
    this.sides = {
      p1: { active: {}, sideConditions: new Map() },
      p2: { active: {}, sideConditions: new Map() },
    };
    /* THE BENCH. Until now this tracked only the field, which is why switching was not merely scored
     * badly but was UNREPRESENTABLE: there was nothing to score. `party` is what each side brought
     * (four in this format), `graveyard` is who is gone. Both worlds can supply them -- the store has
     * `brought`, the live protocol has team preview -- and a side whose party is unknown simply
     * produces no switch candidates rather than guessing at one. */
    /* WHAT THE TEAM SHEET REVEALED. On the open-sheet ladder this is nature, item, ability and moves
     * for all six — public information both players have, so using it is not peeking. It is kept
     * per side and species so a switch-in arrives already knowing what it is. */
    this.sheet = { p1: {}, p2: {} };
    /* What they are holding NOW, as observed. Empty until an item event is seen; sheetItem falls
     * back to the declared sheet for anything not in here. */
    this.itemNow = { p1: {}, p2: {} };
    this.party = { p1: [], p2: [] };
    this.graveyard = { p1: new Set(), p2: new Set() };
    this.pseudoWeather = new Map();
    this.weather = '';
    /* Counted, not hidden: when a stored target name matches a species on both sides we cannot tell
     * which one was hit. The caller reports this so an ambiguity that grows is noticed. */
    this.ambiguousTargets = 0;
  }

  /* ---- FIELD AND SIDE CONDITIONS -------------------------------------------------------------
   *
   * Weather and terrain arrive as their own events in both worlds (the store records `w` and `fs`;
   * the protocol emits |-weather| and |-fieldstart|), so they are simply set.
   *
   * SIDE conditions are the awkward case and worth stating plainly. `|-sidestart|` is not parsed
   * into the store, so "is Tailwind already up on my side" cannot be read back off a stored game the
   * way status can. Rather than drop the feature — which would leave the fitter blind to a condition
   * the live player can see, and quietly apply weights to a vector they were not learned on — it is
   * DERIVED the same way in both worlds: a successful setter move starts the condition, and it runs
   * for `move.condition.duration` turns. That duration is a dex data field (Tailwind 4, Reflect 5,
   * Safeguard 5), not a number typed here, so it stays correct if a future regulation changes it.
   *
   * The derivation is imperfect — an item or ability that extends a screen is not modelled — and it
   * is used identically offline and online precisely so that any error is COMMON to the fit and the
   * player rather than a difference between them. */
  startSide(side, cond, duration) {
    if (!cond) return;
    this.sides[side].sideConditions.set(norm(cond), this.turn + (duration || 1));
  }

  hasSide(side, cond) {
    const until = this.sides[side].sideConditions.get(norm(cond));
    return until != null && until > this.turn;
  }

  startField(name, duration) {
    if (!name) return;
    this.pseudoWeather.set(norm(name), this.turn + (duration || 5));
  }

  hasField(name) {
    const until = this.pseudoWeather.get(norm(name));
    return until != null && until > this.turn;
  }

  setWeather(w) { this.weather = norm(w); }

  slot(side, letter) { return this.sides[side].active[letter] || null; }

  /* Every living mon on the field, as {side, letter, mon}. */
  field() {
    const out = [];
    for (const side of ['p1', 'p2']) {
      for (const letter of Object.keys(this.sides[side].active)) {
        const mon = this.sides[side].active[letter];
        if (mon && !mon.fainted) out.push({ side, letter, mon });
      }
    }
    return out;
  }

  /* What the SHEET said this Pokemon is holding, or null when no sheet published one. Null and ''
   * are different answers: null means "no sheet", '' means "the sheet says no item". Callers must
   * fall back to population statistics only on null, or a closed-sheet game and a genuinely itemless
   * Pokemon become the same thing. */
  sheetItem(side, species) {
    /* OBSERVED BEATS DECLARED. The sheet states what they STARTED with; Knock Off (1,640 uses),
     * Trick (266), Switcheroo, Thief and Fling all change it mid-battle, and a consumed Focus Sash
     * or eaten berry is simply gone.
     *
     * This matters more since the Sash drag started trusting the sheet: it used to be a 78.6%
     * probability, which was at least a hedge after a Knock Off. Trusting the sheet made it a hard
     * 1.0 -- so without this, MAG would be CERTAIN of a Sash that a good opponent had removed on
     * purpose, and would decline kills that land every time.
     *
     * '' is a real answer meaning "no item now", distinct from null meaning "no sheet". */
    const obs = this.itemNow && this.itemNow[side] && this.itemNow[side][baseSpecies(species)];
    if (obs !== undefined) return obs;
    const e = this.sheet && this.sheet[side] && this.sheet[side][baseSpecies(species)];
    if (!e || e.item === undefined || e.item === null) return null;
    return e.item;
  }

  /* Recorded from the protocol: |-item| (gained, e.g. Trick) and |-enditem| (lost or consumed). */
  noteItem(side, species, item) {
    if (!this.itemNow) this.itemNow = { p1: {}, p2: {} };
    if (!this.itemNow[side]) this.itemNow[side] = {};
    this.itemNow[side][baseSpecies(species)] = item === null || item === undefined ? '' : norm(item);
  }

  setSheet(side, species, info) {
    if (!species || !info) return;
    this.sheet[side][baseSpecies(species)] = info;
  }

  setParty(side, list) {
    this.party[side] = (list || []).map(s => baseSpecies(s)).filter(Boolean);
  }

  /* Who could come in right now: brought, not already out, not dead. */
  bench(side) {
    const out = [];
    const onField = new Set(Object.values(this.sides[side].active)
      .filter(m => m && !m.fainted).map(m => baseSpecies(m.species)));
    for (const sp of this.party[side] || []) {
      if (onField.has(sp) || this.graveyard[side].has(sp)) continue;
      if (!out.includes(sp)) out.push(sp);
    }
    return out;
  }

  switchIn(side, letter, species) {
    this.sides[side].active[letter] = {
      species: norm(species),
      base: baseSpecies(species),
      hp: 1,
      /* FAINTED IS ITS OWN FLAG, NOT hp === 0, and the distinction is load-bearing.
       *
       * Stored games record damage but not healing — no Leftovers tick, no Sitrus, no Regenerator —
       * so a running HP total only ever falls. Treating "hp reached 0" as fainted therefore retired
       * Pokemon that were alive, removed them from the field, and made every move aimed at them look
       * untargetable: 1,219 of the first pass's unmatched clicks were aimed at a foe this had already
       * buried. Explicit faint events exist in both worlds (`t:'f'` in the store, |faint| in the
       * protocol), so presence on the field is read from those and hp is left to do the one job it is
       * good for, the tgtHurt feature. */
      fainted: false,
      status: '',
      /* Copied onto the mon so featuresFor never has to work out which side it is looking at. */
      nature: (this.sheet[side] && this.sheet[side][baseSpecies(species)] || {}).nature || '',
      /* THE ITEM, for the same reason and because move ORDER depends on it. The sheet has carried an
       * item since setSheet was written and nothing read it, so Choice Scarf -- 6.52% of every item
       * in this format, and a flat +50% Speed -- was invisible to the one feature it most affects. */
      item: norm((this.sheet[side] && this.sheet[side][baseSpecies(species)] || {}).item || ''),
      /* The forme it will actually be, if the sheet's item is its own mega stone. Filled in by
       * effSpecies, because megaFormeOf needs the dex and the Board deliberately does not hold one.
       * `megaFor` records which species the answer was computed for, so a mid-battle transformation
       * into something the stone did not predict -- Ditto copying, Illusion breaking -- invalidates
       * it instead of silently keeping the old forme. */
      mega: '', megaFor: null,
      /* STAT STAGES, absolute, cleared here because a boost belongs to the POKEMON and not to the
       * slot -- leaving them would put an Intimidate drop on the mon that replaced its victim.
       * Keys are the protocol's (atk/def/spa/spd/spe); the damage formula's own keys are different
       * and the translation happens at exactly one place, in dmgMon. */
      boosts: {},
      /* TURNS ACTIVE — and the FAKE OUT note promised in the header.
       *
       * Fake Out, First Impression and Mat Block work only on the turn the user came out, and that
       * condition lives in Showdown as procedural code (`pokemon.activeMoveActions > 1`), not as a
       * data field. So there is no honest way to read it off the dex the way `move.status` is read,
       * and this file does NOT special-case those moves.
       *
       * What it does instead is track the quantity the condition is ABOUT, and let the fit find out
       * whether it matters. The behaviour clone is separately conditioned on the same quantity
       * (engine/policy.js splits each species' distribution on whether the mon just came out), so
       * "Fake Out on turn one, not on turn four" is learned from what humans actually do rather than
       * asserted from what the move does. If that conditioning is enough, failed-move rate falls
       * without a single named move appearing in this codebase. If it is not, the residual shows up
       * in the realism report and is reported as a miss rather than patched with a special case. */
      turnsActive: 0,
      lastMove: '',
      stalledLastTurn: false,
    };
  }

  faint(side, letter) {
    const gone = this.sides[side].active[letter];
    if (gone) this.graveyard[side].add(baseSpecies(gone.species));
    const m = this.slot(side, letter);
    if (m) { m.fainted = true; m.hp = 0; }
  }

  /* Advance one turn: everything on the field has now been out one turn longer, and "stalled last
   * turn" rolls forward from the move each mon actually used. */
  endTurn() {
    for (const { mon } of this.field()) {
      mon.turnsActive++;
      mon.stalledLastTurn = !!mon.stalledThisTurn;
      mon.stalledThisTurn = false;
      mon.lastMove = mon.moveThisTurn || '';
      mon.moveThisTurn = '';
    }
    this.turn++;
  }
}

/* ---------------------------------------------------------------------------------------------
 * FEATURES
 *
 * `cand` is {move, targetMon} where move is a Showdown dex move object and targetMon is a tracked
 * mon or null (for self-targeting and field moves).
 * ------------------------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------------------------
 * ABILITY IMMUNITY, WITHOUT CHEATING
 *
 * We rarely know the opponent's ability. Rather than peek, this asks the question a good player
 * asks: how likely is it that the thing in front of me has an ability that eats this? Smogon
 * publishes the ability distribution per species over the whole ladder, so the answer is a
 * probability rather than a guess, and it is the same number offline and online.
 * ------------------------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------------------------
 * DAMAGE — BORROWED, NOT REIMPLEMENTED
 *
 * The one damage formula in this project that has been validated against an independent
 * implementation lives in engine/medicham2-browser.js. It reads its species table out of
 * data/engine-data.js through two globals, which is why the require below looks odd: loading that
 * file for its SIDE EFFECT is the documented way to use it (engine/backtest_winrate.js does the
 * same). Nothing here recomputes a stat, a type multiplier or a roll.
 *
 * WHEN IT IS UNAVAILABLE the features go to zero AND the failure is COUNTED. A damage feature that
 * silently reads zero is indistinguishable from "this move does nothing", which would be the third
 * time this file shipped a bug of exactly that shape (Rock Slide scored as a status move; an
 * immunity scored as a neutral hit). featuresFor exports the counter so callers can assert on it.
 * ------------------------------------------------------------------------------------------- */
let _dmg = null;                 // null = not tried, false = unavailable
const dmgFailures = { unavailable: 0, unknownSpecies: 0 };
function damageEngine() {
  if (_dmg !== null) return _dmg;
  try {
    require(require('path').join(__dirname, '..', 'data', 'engine-data.js'));   // sets globalThis.MC, mcEff
    const M = require('./medicham2-browser.js');
    _dmg = (M && typeof M.dmgRange === 'function' && typeof M.buildMon === 'function' && globalThis.MC) ? M : false;
  } catch (e) { _dmg = false; }
  return _dmg;
}

/* A tracked mon -> the shape the damage formula expects. Returns null when the species is not in the
 * table, which is a real condition (a forme the usage data has never seen) and not an error. */
function dmgMon(mon, D) {
  if (!mon) return null;
  const key = MC.mons[norm(mon.species)] ? norm(mon.species) : (MC.mons[baseSpecies(mon.species)] ? baseSpecies(mon.species) : null);
  if (!key) { dmgFailures.unknownSpecies++; return null; }
  const b = D.buildMon(key);
  if (!b) { dmgFailures.unknownSpecies++; return null; }
  /* Live state the tracker DOES know, applied on top: current hp as a fraction of the built max, and
   * status, because a burn halves physical damage and that is a fact the formula already handles. */
  if (typeof mon.hp === 'number') b.curHP = Math.max(0, Math.round(b.st.hp * mon.hp));
  if (mon.status) b.status = norm(mon.status);
  /* THE STAGES, TRANSLATED ONCE. dmgRange has always had boostMul and has always been handed zeros,
   * so an Intimidated attacker hit as hard as a fresh one -- worth a third of its physical damage,
   * and 8.8% of MAG's false "guaranteed kill" calls had an Intimidate sitting on the field. */
  const BK = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };
  for (const [proto, mine] of Object.entries(BK)) {
    const v = mon.boosts && mon.boosts[proto];
    if (v) b.boosts[mine] = Math.max(-6, Math.min(6, v));
  }
  return b;
}

/* THE SPREAD IS NOT KNOWN, SO STOP PRETENDING IT IS.
 *
 * Every damage number here was computed against ONE stat line: the single set the usage data lists
 * first. Measured, that line is right 4.9% of the time for Incineroar, 3.5% for Farigiraf, 10.3% for
 * Sinistcha. The bulky support Pokemon -- exactly the ones whose survival decides whether a move is
 * a kill -- are the ones the point estimate gets most wrong, because their spreads are the most
 * varied. Garchomp at 42.0% and Whimsicott at 47.7% are the concentrated exceptions.
 *
 * So a kill stops being a yes/no computed against a guess, and becomes the SHARE OF PLAUSIBLE
 * SPREADS it kills. "This kills a defensive Incineroar and does not kill a specially defensive one"
 * is a fact the old feature could not express in either direction.
 *
 * Nothing hidden is used. These are Smogon's published spreads for the format -- the same public
 * source as the ability and item odds -- and the weights are their observed shares, renormalised
 * over the ones we have. Their top six only cover about 19% of Incineroar sets, so this is a better
 * estimate and still not the truth; what it buys is a probability instead of a false certainty. */
let _spreads = null;
/* BULK ASSUMPTION, A TOGGLE RATHER THAN A DECISION (Will, 2026-07-28).
 *
 *   ABRA_BULK=weighted   every plausible EV spread, weighted by how often people run it (default)
 *   ABRA_BULK=max        collapse to the BULKIEST plausible spread and assume that
 *
 * The case for max: the two mistakes are not symmetric. Calling a kill that does not land costs
 * the turn AND the position -- you commit, they survive at 3%, your partner's move was aimed at a
 * corpse that is not one. Missing a kill you could have had is merely wasteful. So erring bulky errs
 * safely.
 *
 * The case against: MEASURED, the bulkiest plausible spread is a median 5.8% physically and 6.3%
 * specially above the usage-weighted average over 283 species -- about one damage roll. But it is
 * not evenly spread. Mega Beedrill is +31% physical, Liepard +29% special, Whimsicott +25%, because
 * those have genuinely bimodal spreads and people run both. Assume max bulk against a Whimsicott and
 * you decline kills on the offensive set all day.
 *
 * Which is why this is a FLAG and not an argument: the head-to-head decides. Nothing about this
 * project's history suggests either of us should be trusted to reason it out instead. */
const BULK_MODE = (process.env.ABRA_BULK || 'weighted').toLowerCase();

function spreadLines(species, dex, nature) {
  if (_spreads === null) {
    _spreads = {};
    try {
      const fs4 = require('fs'), p4 = require('path');
      const j = JSON.parse(fs4.readFileSync(p4.join(__dirname, '..', 'data', 'smogon-priors.json'), 'utf8'));
      for (const [k, v] of Object.entries(j.species || {})) {
        const rows = (v.spreads || []).filter(s => s && Array.isArray(s.sp));
        if (rows.length) _spreads[norm(k)] = rows;
      }
    } catch (e) { /* no priors: the caller falls back to the single stored line */ }
  }
  let rows = _spreads[norm(species)] || _spreads[baseSpecies(species)];
  if (!rows || !rows.length) return null;
  const sp0 = dex.species.get(species) || dex.species.get(baseSpecies(species));
  const bs = sp0 && sp0.exists && sp0.baseStats;
  if (!bs) return null;
  /* NARROWED BY THE NATURE, WHEN THE NATURE IS KNOWN — and on the open-sheet ladder it always is,
   * because Force Open Team Sheets publishes it on 100% of entries while publishing the investment on
   * 0%. Measured across 1,687 published spreads: 43.9% of a set's SP sits on the stat its nature
   * raises, against 14.0% on any other stat, where no signal at all would be 20% each. 82.5% of
   * spreads put at least 40% of their investment there. Adamant means Attack, Timid means Speed.
   *
   * So seeing "Adamant" removes most of the spread distribution, and what is left is the part worth
   * computing damage against. Falls back to the full distribution when no published spread matches,
   * because an empty set would silently produce no damage at all. */
  if (nature) {
    const want = norm(nature);
    const kept = rows.filter(r => norm(r.nature || '') === want);
    if (kept.length) rows = kept;
  }
  const total = rows.reduce((a, r) => a + (+r.pct || 0), 0) || 1;

  /* Champions invests SP directly into a stat rather than through EVs, which is why this is an
   * addition and not a division by four. Same formula as engine/medicham2-browser.js l50. */
  const stat = (base, put) => Math.floor((2 * base + 31) * 50 / 100) + 5 + (+put || 0);
  const out = [];
  for (const r of rows) {
    const [h, a, d, sa, sd, s] = r.sp;
    const line = {
      hp: Math.floor((2 * bs.hp + 31) * 50 / 100) + 50 + 10 + (+h || 0),
      at: stat(bs.atk, a), df: stat(bs.def, d),
      sa: stat(bs.spa, sa), sd: stat(bs.spd, sd), sp: stat(bs.spe, s),
    };
    /* Nature is a 10% swing on two stats and is published beside the spread, so leaving it out would
     * put every bulky set 10% too frail and every attacker 10% too weak. */
    const nat = r.nature && dex.natures.get(r.nature);
    if (nat && nat.exists) {
      const K = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };
      if (K[nat.plus]) line[K[nat.plus]] = Math.floor(line[K[nat.plus]] * 1.1);
      if (K[nat.minus]) line[K[nat.minus]] = Math.floor(line[K[nat.minus]] * 0.9);
    }
    out.push({ p: (+r.pct || 0) / total, st: line });
  }
  /* THE TOGGLE APPLIES HERE, at the one point every consumer goes through -- so nothing downstream
   * needs to know which mode is on and the two cannot drift apart.
   *
   * `max` keeps the single bulkiest line and gives it all the weight. Bulk is scored as
   * hp x def + hp x spd so a set that is bulky on one side only does not win on the strength of the
   * side that is not being attacked. The result is still a one-element `lines` array with p summing
   * to 1, which is exactly what every caller already handles. */
  if (BULK_MODE === 'max' && out.length > 1) {
    let best = out[0], bestScore = -1;
    for (const o of out) {
      const st = o.st; if (!st) continue;
      const score = st.hp * st.df + st.hp * st.sd;
      if (score > bestScore) { bestScore = score; best = o; }
    }
    return [{ p: 1, st: best.st, bulkMode: 'max' }];
  }
  return out;
}

/* ABILITIES THE DAMAGE FORMULA DOES NOT KNOW ABOUT, priced by how often the format runs them.
 *
 * Audited rather than guessed: of every ability in this format with a damage-affecting handler, the
 * validated formula covers all but 2.4% -- Technician, Tough Claws, Huge Power, Multiscale, Scrappy
 * and the rest are already in it. The gaps that matter are:
 *
 *   FRIEND GUARD  0.87%, the largest, and it is invisible to a damage formula by construction: it
 *                 sits on the target's PARTNER and cuts damage to the target by a quarter. A kill
 *                 that is thwarted by the thing standing next to what you aimed at.
 *   SHARPNESS     0.44%, +50% on slicing moves, read off `move.flags.slicing` rather than a list.
 *
 * Weighted by the usage odds, exactly as abilityBlock is, because whether the mon in front of you
 * has it is knowable only to the population. Applied as a multiplier on the result rather than by
 * editing the validated formula, which stays untouched. */
function unmodelledAbilityMult(m, attacker, target, targetAlly) {
  const { abil } = abilityTables();
  const odds = (mon, want) => {
    if (!mon) return 0;
    const rows = abil[norm(mon.species)] || abil[baseSpecies(mon.species)];
    if (!rows) return 0;
    for (const [ab, pr] of rows) if (ab === want) return pr;
    return 0;
  };
  let mult = 1;
  const fg = odds(targetAlly, GAME_RULES.unmodelledAbilities.friendGuard);
  if (fg) mult *= (1 - fg) + fg * 0.75;
  if (m && m.flags && m.flags.slicing) {
    const sh = odds(attacker, GAME_RULES.unmodelledAbilities.sharpness);
    if (sh) mult *= (1 - sh) + sh * 1.5;
  }
  return mult;
}

/* Estimated damage of `m` (typed as it will actually land) from `att` onto `def`.
 * `{min, max, mean}` as a FRACTION of the defender's max hp. */
/* Showdown's weather ids -> the two the damage formula multiplies on. Written as a mapping FROM the
 * tracked value rather than as a test for a named move, so a new weather setter needs no edit. */
const WEATHER_KIND = { sunnyday: 'sun', desolateland: 'sun', raindance: 'rain', primordialsea: 'rain' };

function dmgFractions(D, att, def, m, mType, spread, board, defStats, origMove) {
  if (!att || !def) return null;
  /* A stat line from the spread distribution replaces the stored one. Copied rather than mutated,
   * because the same built mon is reused across every spread and every candidate move. */
  if (defStats) def = Object.assign(Object.create(Object.getPrototypeOf(def) || Object.prototype), def, { st: defStats });

  /* MOVES THAT ATTACK WITH THE WRONG STAT. Body Press is physical but hits with DEFENCE, and Psyshock
   * is special but hits the target's Defence — both are `overrideOffensiveStat` /
   * `overrideDefensiveStat` in the dex, and the damage formula this calls reads only the category.
   * So Body Press was being computed off Attack, which for the bulky Pokemon that actually run it is
   * the stat they deliberately did not invest in. It is on 1.25% of teams here.
   *
   * Handled by swapping the number the formula will read rather than by editing the formula, so the
   * validated implementation stays untouched. */
  const oOff = origMove && origMove.overrideOffensiveStat;
  const oDef = origMove && origMove.overrideDefensiveStat;
  if (oOff || oDef) {
    const K = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };
    const phys = m.category === 'Physical';
    if (oOff && K[oOff]) {
      const st = { ...att.st }; st[phys ? 'at' : 'sa'] = att.st[K[oOff]];
      att = Object.assign(Object.create(Object.getPrototypeOf(att) || Object.prototype), att, { st });
    }
    if (oDef && K[oDef]) {
      const st = { ...def.st }; st[phys ? 'df' : 'sd'] = def.st[K[oDef]];
      def = Object.assign(Object.create(Object.getPrototypeOf(def) || Object.prototype), def, { st });
    }
  }
  const mv = { t: mType, bp: m.basePower || 0, c: m.category === 'Physical' ? 'P' : 'S' };
  if (!mv.bp) return null;
  /* THIS PASSED AN EMPTY FIELD, and the board knew the weather the whole time. Sun multiplies Fire
   * by 1.5 and rain multiplies Water by 1.5, so every damage number under weather was wrong -- on a
   * Torkoal/Drought or Pelipper/Drizzle team, which is most of what this format's damage comes from.
   * Same class of bug as scoring Weather Ball as Normal, in the code written to fix that one. */
  const field = { weather: (board && WEATHER_KIND[board.weather]) || '', terrain: '' };
  const r = D.dmgRange(att, def, mv, field, !!spread);
  if (!r || !def.st || !def.st.hp) return null;
  return { min: r.min / def.st.hp, max: r.max / def.st.hp, mean: (r.min + r.max) / 2 / def.st.hp };
}

/* ---------------------------------------------------------------------------------------------
 * DERIVED FROM THE DEX, NOT TYPED
 *
 * This file's header claims there is no list of moves in it. Over one evening of adding features
 * that claim became FALSE: 18 distinct Pokemon names appeared in the code, most of them mine. These
 * three sets put the derivable ones back where they belong.
 *
 *   speed side conditions  the only one with an onModifySpe handler is Tailwind, and the handler is
 *                          CALLED for the multiplier rather than 2 being written down
 *   screens                the side conditions that modify incoming damage: Reflect, Light Screen,
 *                          Aurora Veil. Typing the first two missed the third
 *   the Protect family     `stallingMove` gives Protect, Detect, Endure, Spiky Shield, King's Shield
 *                          and Baneful Bunker. The Protect-odds table was keyed on the NAME
 *                          "protect" alone and silently scored the other five at zero
 *
 * What remains typed is listed in GAME_RULES below, with the reason each cannot be read from data.
 * ------------------------------------------------------------------------------------------- */
/* Module-level handles, because two consumers cannot reach the dex: jointFeaturesFor is handed two
 * already-computed vectors, and protectOdds reads a usage file. Both are filled the first time
 * derived() runs, which featuresFor guarantees before either is used. */
let DERIVED = null, STALL = null;
let _derived = null;
function derived(dex) {
  if (_derived) return _derived;
  const speedSide = new Map();   // sideCondition id -> multiplier
  const screens = new Set();
  const stalling = new Set();
  /* MOVES THAT LOCK THE TARGET INTO ITS LAST MOVE. Derived from `volatileStatus === 'encore'`, a dex
   * data field, so Encore is not named and anything sharing its shape is picked up. */
  const locking = new Set();
  for (const m of dex.moves.all()) {
    if (!m || !m.exists || m.isNonstandard) continue;
    if (m.stallingMove) stalling.add(norm(m.id));
    if (norm(m.volatileStatus || '') === 'encore') locking.add(norm(m.id));
    if (!m.sideCondition) continue;
    const id = norm(m.sideCondition);
    const c = dex.conditions.get(m.sideCondition);
    if (!c || !c.exists) continue;
    if (typeof c.onModifySpe === 'function' && !speedSide.has(id)) {
      /* Ask the handler what it does to a speed of 100 rather than assuming it doubles. */
      let mult = 2;
      try {
        const got = c.onModifySpe.call({}, 100, { side: {}, hasAbility: () => false });
        if (typeof got === 'number' && got > 0) mult = got / 100;
      } catch (e) { /* keep the fallback */ }
      speedSide.set(id, mult);
    }
    if (typeof c.onAnyModifyDamage === 'function' || typeof c.onAnyModifyDamagePhase1 === 'function' ||
        typeof c.onAnyModifyDamagePhase2 === 'function') screens.add(id);
  }
  _derived = { speedSide, screens, stalling, locking };
  DERIVED = _derived; STALL = stalling;
  return _derived;
}

/* THE IRREDUCIBLE RULES, IN ONE PLACE AND DECLARED.
 *
 * Each of these is a rule of Pokemon that Showdown expresses as procedural code rather than as a
 * data field, so there is nothing to read and nothing to probe. They are written here, together,
 * with the reason -- rather than scattered through the file where they look like ordinary code.
 * If one is wrong it is wrong in exactly one visible place. */
const GAME_RULES = {
  /* Trick Room reverses the speed order. Its condition exposes only onFieldStart/onFieldEnd; the
   * reversal lives in the battle's action sort, which cannot be called without a battle. */
  trickRoomField: 'trickroom',
  /* Sun boosts Fire and rain boosts Water. Implemented in battle-actions' damage chain. */
  weatherBoost: { sunnyday: 'fire', desolateland: 'fire', raindance: 'water', primordialsea: 'water' },
  /* Terrain boosts its own type for a grounded user. Same place. */
  terrainBoost: { electricterrain: 'electric', grassyterrain: 'grass', psychicterrain: 'psychic' },
  /* Burn halves physical Attack; paralysis quarters Speed. Status effects, applied in the formula. */
  statusHitsStat: { brn: 'physical', par: 'speed' },
  /* A Prankster-boosted status move fails against a Dark type. Enforced in battle-actions, not in
   * the ability's own handler, so probing Prankster cannot reveal it. */
  pranksterFailsType: 'dark',
  /* Two damage-affecting abilities the validated formula does not implement. Chosen by AUDIT -- they
   * are the two largest gaps by usage share in this format (0.87% and 0.44%), not by taste. */
  unmodelledAbilities: { friendGuard: 'friendguard', sharpness: 'sharpness' },
  /* Moves that operate on the target's LAST MOVE, so they fail against anything that has not moved.
   * Showdown expresses each one as procedural code inside its own condition, so there is no field to
   * read and nothing to probe without a live battle -- hence the declared list. */
  needsTargetToHaveMoved: ['encore', 'disable', 'torment', 'spite', 'mimic', 'instruct', 'mirrormove'],
  /* Survives any single hit from full health. Focus Sash's onDamage is not distinguishable from
   * other damage-reducing items by shape alone. It is the most-held item in the format at 12.4%. */
  survivesFromFull: 'focussash',
};

/* WHAT IS AIMED AT ME. For each living foe, the hardest its usage-listed moves could hit this
 * Pokemon, as a share of my maximum hp.
 *
 * CACHED PER DECISION, and that is not an optimisation detail. This is a property of the BOARD, so
 * it is identical across every candidate the same Pokemon is choosing between — recomputing it eight
 * times per turn would multiply the damage calls by the size of the choice set for an answer that
 * cannot change. It is also the reason "am I threatened" cannot be a feature on its own: a quantity
 * constant across a decision cancels out of a conditional logit exactly. */
/* KEYED ON THE BOARD OBJECT, and the first version was not. It cached on a string of side, species,
 * hp, turn and field size, which two DIFFERENT boards collide on trivially — and the returned map is
 * keyed by mon OBJECTS, so a collision does not return a wrong number, it returns a map whose keys
 * are from someone else's battle and every lookup silently misses. Caught because `killsThreat` read
 * zero in a scenario built specifically to make it fire. */
const _threatCache = new WeakMap();
function incomingThreat(board, side, user, att, D) {
  /* THE DEFENDER IS PART OF THE KEY, and leaving it out is what made every switch feature useless.
   * This answers "how hard is the hardest thing aimed at THIS Pokemon", and switch candidates ask it
   * about the mon coming IN while `user` stays the one currently out. Keyed on `user` alone, every
   * switch candidate in a decision received the first one's answer -- Torkoal and Whimsicott, whose
   * bulk is nothing alike, both read survives1=1 survives2=0. Identical features cannot discriminate,
   * so the fit correctly reported a null, and the null was mine rather than the game's. */
  const who = att ? `${att.name || ''}|${att.st && att.st.hp}|${att.st && att.st.df}|${att.st && att.st.sd}` : '-';
  const key = `${side}|${who}|${user && user.hp}|${board.turn}|` +
    board.field().map(f => `${f.side}${f.letter}${f.mon.species}${f.mon.hp}`).join(',');
  const hit = _threatCache.get(board);
  if (hit && hit.key === key) return hit.val;
  const threat = new Map();
  let worst = 0;
  if (att) {
    for (const f of board.field()) {
      if (f.side === side || !f.mon || f.mon.fainted) continue;
      const fm = dmgMon(f.mon, D);
      if (!fm) continue;
      let best = 0;
      for (const id of (fm.moves || [])) {
        const fmv = MC.moves[id];
        if (!fmv || !fmv.bp) continue;
        const r = dmgFractions(D, fm, att, { basePower: fmv.bp, category: fmv.c === 'P' ? 'Physical' : 'Special' }, fmv.t, false, board);
        if (r && r.mean > best) best = r.mean;
      }
      threat.set(f.mon, best);
      if (best > worst) worst = best;
    }
  }
  const val = { threat, worst };
  _threatCache.set(board, { key, val });
  return val;
}

/* HOW OFTEN DOES THE THING IN FRONT OF ME SIMPLY BLOCK?
 *
 * Measured, and it is the single biggest reason MAG's "guaranteed kill" is not one: of 3,538 kill
 * calls that did not kill, 46.3% had the target Protecting -- five times the next cause. That is not
 * a damage error at all, and no amount of work on the damage formula would have touched it.
 *
 * The number is already in the project. data/move-priors.json holds P(move | species) over real
 * clicks, so P(Protect | this species) needs no new derivation -- it is the same public population
 * statistic as the ability odds this file already uses, and it peeks at nothing hidden. Charizard
 * clicks Protect on 59.0% of its turns, the median species on 12.5%. */
/* P(this species clicks this specific move), from the same public per-species click table
 * protectOdds reads. Generalised out of it so a second consumer does not need a second loader, and
 * cached whole rather than per query. Peeks at nothing hidden: it is a population statistic, exactly
 * like the ability odds and the spreads. */
let _mvP = null;
function movePriorOdds(species, moveId) {
  if (_mvP === null) {
    _mvP = {};
    try {
      const fs5 = require('fs'), p5 = require('path');
      const j = JSON.parse(fs5.readFileSync(p5.join(__dirname, '..', 'data', 'move-priors.json'), 'utf8'));
      for (const [sp, v] of Object.entries(j.species || {})) {
        const row = {};
        for (const mv of v.moves || []) if (mv && mv.mv) row[norm(mv.mv)] = +mv.p || 0;
        _mvP[norm(sp)] = row;
      }
    } catch (e) { /* absent priors leave every species at 0, which is the old behaviour */ }
  }
  const r = _mvP[norm(species)] || _mvP[baseSpecies(species)];
  return r ? (r[norm(moveId)] || 0) : 0;
}

let _protP = null;
function protectOdds(species) {
  if (_protP === null) {
    _protP = {};
    try {
      const fs3 = require('fs'), p3 = require('path');
      const j = JSON.parse(fs3.readFileSync(p3.join(__dirname, '..', 'data', 'move-priors.json'), 'utf8'));
      for (const [sp, v] of Object.entries(j.species || {})) {
        for (const mv of v.moves || []) {
          /* stallingMove is the flag, not the name -- but move-priors stores names, so the family is
           * matched on the dex's own flag at build time where the dex is available. Here the id is
           * all there is, and Protect is the only member with meaningful usage in this format. */
          /* EVERY stalling move, not the one called "protect". Detect, Endure, Spiky Shield,
           * King's Shield and Baneful Bunker all block, and keying on the name scored all five at
           * zero -- so a Toxapex clicking Baneful Bunker looked like a target that never blocks. */
          if (STALL && STALL.has(norm(mv.mv))) _protP[norm(sp)] = (_protP[norm(sp)] || 0) + (+mv.p || 0);
        }
      }
    } catch (e) { /* absent priors leave every species at 0, which is the old behaviour */ }
  }
  return _protP[norm(species)] || _protP[baseSpecies(species)] || 0;
}

/* The multiplier a side's speed-affecting conditions apply right now. Derived, so a future
 * regulation adding another Tailwind is handled without an edit. */
function speedMult(board, side, dex) {
  const d = derived(dex);
  let mult = 1;
  for (const [id, m] of d.speedSide) if (board.hasSide(side, id)) mult *= m;
  return mult;
}

/* WHAT THIS POKEMON DOES TO ITS OWN SPEED — the other half of move order, and it was missing.
 *
 * speedMult above covers SIDE conditions: Tailwind and anything a future regulation adds with the
 * same shape. It cannot see anything belonging to the Pokemon, and three families of those decide
 * move order constantly in this format:
 *
 *   Choice Scarf         +50% Speed, 6.52% of every item held here, and the single most common
 *                        reason a "slower" Pokemon moves first.
 *   paralysis            halves Speed. GAME_RULES already declared `par: 'speed'` and the only place
 *                        it was read was statusBites -- "does the status I am INFLICTING bite" --
 *                        never for the speed of the mon actually paralysed.
 *   weather Speed        Swift Swim, Chlorophyll, Sand Rush, Slush Rush all DOUBLE Speed in their
 *                        weather. Rain and Sun are the two largest archetypes in the format.
 *
 * NOTHING IS NAMED HERE. All three expose `onModifySpe` in the dex -- the item, the ability and the
 * paralysis condition alike -- so each handler is CALLED and asked, exactly as effectivePriority asks
 * onModifyPriority and moveType asks onModifyType. A regulation that adds a fourth weather-speed
 * ability or another Scarf needs no edit, and a handler this stub cannot satisfy returns nothing and
 * is skipped rather than guessed at.
 *
 * The ability term is an EXPECTED value, weighted by Smogon's per-species odds, because which
 * ability a Pokemon has is known to the population and not to the player -- the same treatment
 * abilityBlock and effectivePriority already give. The item is read from the REVEALED SHEET, which
 * is public in this regime, so it is applied at full weight rather than as a probability. */
/* EXPECTED SPEED, INVESTMENT INCLUDED — and the reason this is not base Speed.
 *
 * Both speed comparisons in this file used `baseStats.spe`, defended in a comment as "the exact
 * spread is hidden, so this is the order two informed players would both expect". That defence does
 * not survive contact with the rest of the file: spreadLines() already turns Smogon's PUBLISHED
 * spreads into probability-weighted stat lines, and the DAMAGE calculation uses it for exactly the
 * same reason abilityBlock uses the ability odds -- the population's investment is public knowledge
 * even when one player's is not. Applying that to damage and withholding it from speed is one
 * argument used inconsistently.
 *
 * And the error is large. Base 102 Garchomp is 169 Speed fully invested and 123 uninvested; base
 * Speed gets the ORDER wrong whenever two Pokemon differ in investment, which is most of the time.
 * Speed is the stat this format invests in most heavily, so base stats are at their least
 * informative precisely here.
 *
 * Weighted by each spread's share, narrowed by the nature when the sheet publishes one -- which on
 * this ladder it always does. Falls back to the base stat when the species has no published spread,
 * which is a real condition rather than an error. */
function expectedSpe(species, dex, nature) {
  const rows = spreadLines(species, dex, nature || '');
  if (rows && rows.length) {
    let s = 0, w = 0;
    for (const r of rows) { s += (r.p || 0) * (r.st && r.st.sp || 0); w += (r.p || 0); }
    if (w > 0 && s > 0) return s / w;
  }
  const sp = dex.species.get(species) || dex.species.get(baseSpecies(species));
  return (sp && sp.exists && sp.baseStats && sp.baseStats.spe) || 0;
}

function speedStub(board) {
  const wx = () => norm(board.weather);
  const field = {
    isWeather: w => (Array.isArray(w) ? w.some(x => norm(x) === wx()) : norm(w) === wx()),
    effectiveWeather: wx,
    isTerrain: t => board.hasField(t),
    getPseudoWeather: t => (board.hasField(t) ? {} : null),
  };
  return {
    field, dex: null,
    /* Showdown handlers return their answer through chainModify/finalModify rather than as a plain
     * number. Probing with a speed of 100 and reading the result back as result/100 recovers the
     * multiplier whichever route the handler takes. */
    chainModify: v => 100 * (Array.isArray(v) ? v[0] / v[1] : v),
    finalModify: v => v,
  };
}
function monSpeedMult(mon, board, dex) {
  if (!mon) return 1;
  let mult = 1;
  const ctx = speedStub(board);
  const stub = {
    effectiveWeather: () => norm(board.weather),
    hasItem: () => false, getItem: () => ({}), hasAbility: () => false,
    volatiles: {}, side: {}, status: norm(mon.status || ''), species: { name: mon.species },
  };
  const ask = h => {
    if (typeof h !== 'function') return null;
    let got; try { got = h.call(ctx, 100, stub); } catch (e) { return null; }
    return (typeof got === 'number' && got > 0) ? got / 100 : null;
  };
  /* The item, from the revealed sheet. */
  if (mon.item) {
    const it = dex.items.get(mon.item);
    if (it && it.exists) { const m = ask(it.onModifySpe); if (m) mult *= m; }
  }
  /* Paralysis, from the condition itself rather than from a 0.5 written here. */
  if (mon.status) {
    const c = dex.conditions.get(norm(mon.status));
    if (c && c.exists) { const m = ask(c.onModifySpe); if (m) mult *= m; }
  }
  /* The abilities this species might have, weighted by how often the population runs each. */
  const rows = abilityOdds(effSpecies(mon, dex), dex);
  if (rows && rows.length) {
    let expected = 1;
    for (const [ab, pr] of rows) {
      if (!pr) continue;
      const A = dex.abilities.get(ab);
      if (!A || !A.exists) continue;
      const m = ask(A.onModifySpe);
      if (m && m !== 1) expected += (m - 1) * pr;
    }
    mult *= expected;
  }
  return mult;
}

let _blocks = null, _abil = null, _sash = null;
function abilityTables() {
  if (_blocks !== null) return { blocks: _blocks, abil: _abil };
  const fs2 = require('fs'), p2 = require('path');
  const rd = f => { try { return JSON.parse(fs2.readFileSync(p2.join(__dirname, '..', 'data', f), 'utf8')); } catch (e) { return null; } };
  const b = rd('ability-blocks.json');
  _blocks = (b && b.abilities) || {};
  const sp = rd('smogon-priors.json');
  _abil = {}; _sash = {};
  for (const [k, v] of Object.entries((sp && sp.species) || {})) {
    if (v && v.abilities) _abil[norm(k)] = v.abilities.map(a => [norm(a.ability), (+a.pct || 0) / 100]);
    /* FOCUS SASH IS THE MOST COMMON ITEM IN THIS FORMAT -- 12.4% of everything held, measured off the
     * same usage file. It survives any single hit from full health at 1 HP, which means a "guaranteed
     * kill" on a healthy target is simply not guaranteed, and MAG had no way to know that. The odds
     * are per species and public, exactly like the ability odds beside them. */
    if (v && v.items) for (const it of v.items) if (norm(it.item) === GAME_RULES.survivesFromFull) _sash[norm(k)] = (+it.pct || 0) / 100;
  }
  return { blocks: _blocks, abil: _abil, sash: _sash };
}

/* Does a measured rule match this move? The rule strings come out of the derivation, so a new rule
 * discovered from data needs no edit here beyond a matcher for its shape. */
function ruleMatches(rule, m, pPrankster) {
  if (!rule || rule === 'unclear') return false;
  if (rule.startsWith('type:')) return norm(m.type) === norm(rule.slice(5));
  if (rule === 'status') return m.category === 'Status';
  if (rule === 'sound') return !!(m.flags && m.flags.sound);
  if (rule === 'bullet') return !!(m.flags && m.flags.bullet);
  if (rule === 'powder') return !!(m.flags && m.flags.powder);
  if (rule === 'priority') return m.priority > 0;
  /* EFFECTIVE priority, and it depends on WHO IS USING THE MOVE.
   *
   * Armor Tail and Queenly Majesty stop moves that go early. A status move goes early only if its
   * USER has Prankster — so Whimsicott's Thunder Wave into Farigiraf is refused and an ordinary
   * Pokemon's Thunder Wave is not. A first version returned true for every status move regardless of
   * user, which told MAG that no status move ever lands on Farigiraf. That is the exact over-claim
   * this file rejects elsewhere (see the tie-break note in build/build_ability_blocks.js) and it was
   * shipped anyway. Returned as a PROBABILITY, because whether the user has Prankster is itself only
   * known to the population. */
  if (rule === 'effective-priority') {
    if (m.priority > 0) return 1;
    return m.category === 'Status' ? (pPrankster || 0) : 0;
  }
  return false;
}

/* EFFECTIVE PRIORITY — ASKED, NOT LISTED.
 *
 * Prankster gives status moves +1. Gale Wings gives Flying moves +1, but only at full health. Triage
 * gives healing moves +3. Every one of these is an ability HANDLER in Showdown (`onModifyPriority`),
 * not a data field, and writing that list here would put a table of Pokemon rules in a file whose
 * whole claim is that it holds none — and it would go stale the moment a regulation adds another.
 *
 * So every ability the species might have is asked directly, and the answer is weighted by how often
 * the population actually runs it: the same treatment abilityBlock already gives the other side.
 * Gale Wings needing full health is not encoded here either — the stub carries the real hp and the
 * handler decides.
 *
 * Returned as an expected value, because which ability this Pokemon has is not knowable. */
function effectivePriority(m, board, dex, user) {
  const basePri = m.priority || 0;
  const { abil } = abilityTables();
  const rows = (user && (abil[norm(user.species)] || abil[baseSpecies(user.species)])) || null;
  if (!rows || !rows.length) return basePri;
  const hp = typeof user.hp === 'number' ? user.hp : 1;
  const ctx = boardStub(board, dex);
  const stubMon = {
    hp: Math.max(1, Math.round(100 * hp)), maxhp: 100,
    species: { name: user.species }, side: {}, volatiles: {},
    effectiveWeather: () => norm(board.weather),
    hasItem: () => false, getItem: () => ({}), hasAbility: () => false, hasType: () => false,
  };
  let expected = basePri;
  for (const [ab, pr] of rows) {
    if (!pr) continue;
    const A = dex.abilities.get(ab);
    if (!A || !A.exists || typeof A.onModifyPriority !== 'function') continue;
    /* A MUTABLE COPY, because some handlers WRITE to the move they are handed -- Prankster sets
     * `move.pranksterBoosted = true` before returning. Passing the dex's own frozen move object made
     * that throw, the throw was caught, and Prankster silently contributed nothing: Whimsicott's
     * Tailwind read as going last. Gale Wings, which only reads, worked the whole time, so the bug
     * looked like "the probe works" until a second ability was tested. Same construction
     * abilityBlockProb already uses, so the prototype's getters survive. */
    const probe = Object.assign(Object.create(Object.getPrototypeOf(m) || Object.prototype), m);
    let got;
    try { got = A.onModifyPriority.call(ctx, basePri, stubMon, null, probe); } catch (e) { continue; }
    if (typeof got === 'number' && got !== basePri) expected += (got - basePri) * pr;
  }
  return expected;
}

/* How likely is the USER to have Prankster — the ability that gives a status move priority, and so
 * the only way a status move can be caught by a priority blocker. Measured from the same Smogon
 * ability table as everything else. */
function pranksterProb(userSpecies) {
  const { abil } = abilityTables();
  const rows = abil[norm(userSpecies)] || abil[baseSpecies(userSpecies)];
  if (!rows) return 0;
  for (const [ab, pr] of rows) if (ab === 'prankster') return pr;
  return 0;
}

function abilityBlockProb(move, targetSpecies, mType, userSpecies) {
  const { blocks, abil } = abilityTables();
  const rows = abil[norm(targetSpecies)] || abil[baseSpecies(targetSpecies)];
  if (!rows || !rows.length) return 0;
  const probe = Object.assign(Object.create(Object.getPrototypeOf(move) || Object.prototype), move, { type: mType });
  const pPrank = userSpecies ? pranksterProb(userSpecies) : 0;
  let p = 0;
  for (const [ab, pr] of rows) {
    const e = blocks[ab];
    if (!e) continue;
    const hit = ruleMatches(e.rule, probe, pPrank);
    p += pr * (hit === true ? 1 : (+hit || 0));
  }
  return Math.min(1, p);
}

/* A POKEMON HOLDING ITS OWN MEGA STONE IS THE MEGA, AND THE SHEET SAYS SO.
 *
 * The store writes lowercase BASE forms -- across 20,387 teams and 273 distinct species strings the
 * only one matching /mega/ is `meganium` -- so every mega in this format was tracked as its base
 * species. That is not cosmetic. 76 mega formes carry 17.7% of this format's usage and they do not
 * merely have better stats, they have DIFFERENT ABILITIES:
 *
 *     Staraptor-Mega   428,748   Contrary          (base Staraptor: Intimidate)
 *     Swampert-Mega    319,208   Swift Swim        (base: Torrent)
 *     Charizard-M-Y    258,306   Drought           (base: Blaze)
 *     Gengar-Mega       89,335   Shadow Tag        (base: Cursed Body)
 *
 * So every ability-weighted feature in this file -- abilityBlock, effectivePriority, the speed
 * multiplier, the Contrary check -- was asking about the wrong Pokemon for a sixth of the format.
 *
 * DERIVED FROM THE ITEM, WHICH IS PUBLIC HERE. Showdown's item carries `megaStone`, a map from base
 * species to the forme it becomes, so no stone and no forme is named here and a regulation adding
 * another is handled with no edit. Open Team Sheets publish the item before turn one, which is
 * precisely why this is knowable rather than a guess -- it is the same public-information argument
 * that admits the ability odds and the spreads.
 *
 * STATED PLAINLY: this treats a stone-holder as ALREADY its mega forme. Before it actually megas the
 * live stats are the base form's, so this is early by up to a turn. That is the right error to make:
 * both players can read the sheet, both know it is going to mega, and the alternative -- discovering
 * Contrary after Staraptor has already clicked Close Combat -- is the one that loses games. */
function megaFormeOf(species, item, dex) {
  if (!item) return null;
  const it = dex.items.get(norm(item));
  if (!it || !it.exists || !it.megaStone) return null;
  const base = baseSpecies(species);
  const ms = it.megaStone;
  if (typeof ms === 'string') {
    /* A plain name: only apply it if it really is this species' stone, so a misread item cannot
     * turn a Garchomp into somebody else's mega. */
    return baseSpecies(ms) === base ? norm(ms) : null;
  }
  for (const [from, to] of Object.entries(ms)) {
    if (baseSpecies(from) === base) return norm(to);
  }
  return null;
}

/* The species whose ABILITIES and STATS this Pokemon will actually be using. Resolved once per
 * Pokemon and cached on it: '' means not yet asked, null means asked and it is not a mega. The Board
 * itself deliberately holds no dex, so this is done here where one is in scope. */
function effSpecies(mon, dex) {
  if (!mon) return '';
  /* THE CACHE IS KEYED ON THE SPECIES IT WAS COMPUTED FOR, and the first version was not.
   *
   * It cached on `mon.mega === ''` alone, so the answer was computed once and never revisited. That
   * is correct for mega evolution, where the stone predicts the forme and the later `detailschange`
   * agrees with it. It is WRONG for every other mid-battle transformation, and this project has two
   * that matter:
   *
   *   DITTO / Imposter        copies whatever is across from it on switch-in. Its cached forme is
   *                           stale the instant it transforms.
   *   ZOROARK-HISUI / Illusion  was never the species the board believed. When Illusion breaks the
   *                           species changes to something no stone predicted, and the cache holds
   *                           the disguise.
   *
   * Both paths already rewrite mon.species when it happens -- magnemite.js on detailschange, and
   * fit_policy.js on the mega event -- so the fix is simply to notice that it changed. Recording the
   * species the cache was computed FOR turns a stale value into a recomputed one. */
  if (mon.megaFor !== mon.species && dex) {
    mon.mega = megaFormeOf(mon.species, mon.item, dex) || null;
    mon.megaFor = mon.species;
  }
  return mon.mega || mon.species;
}

/* THE ABILITY ODDS FOR A SPECIES — and for a MEGA they are not odds at all.
 *
 * Everywhere else in this file "which ability does it have" is a population question answered by
 * Smogon's usage table. For a mega forme it is not a question: mega evolution always confers the
 * forme's own ability, and the dex states it outright.
 *
 * That distinction is not pedantry, it is a data defect this exposed. Smogon's table cannot see a
 * mega's ability and records the gap as a literal entry:
 *
 *     staraptormega:   "No Ability" 81.1%,  "Contrary" 18.9%
 *
 * Trusting those odds makes Swords Dance on a Staraptor-Mega read as raising Attack 81% of the time
 * when it never does. The usage table is authoritative about what people RUN; it is not
 * authoritative about what the game DOES, and a mega's ability is the second kind of fact.
 *
 * So: mega formes take their ability from the dex at probability 1, everything else keeps the
 * measured odds. Nothing is named -- the forme list comes from the item's own megaStone map. */
function abilityOdds(species, dex) {
  const { abil } = abilityTables();
  const sp = dex && dex.species.get(species);
  if (sp && sp.exists && sp.isMega) {
    const fixed = Object.values(sp.abilities || {}).map(a => norm(a)).filter(Boolean);
    if (fixed.length === 1) return [[fixed[0], 1]];
  }
  return abil[norm(species)] || abil[baseSpecies(species)] || null;
}

/* WHAT DOES THIS BOOST TABLE ACTUALLY DO TO THIS POKEMON?
 *
 * `want` is +1 to ask "does it end up RAISING a stat" and -1 for "does it end up LOWERING one".
 * Returns the probability, over the species' possible abilities, that the answer is yes -- so a
 * Pokemon with no boost-modifying ability returns 1 for a move that plainly does it, and a certain
 * Contrary user returns 0. Abilities are asked, never listed: `onChangeBoost` is the handler
 * Showdown gives to Contrary (inverts) and Simple (doubles) alike. */
function expectedBoostSign(boosts, species, dex, want) {
  if (!boosts) return 0;
  const plain = Object.values(boosts).some(v => (want > 0 ? v > 0 : v < 0)) ? 1 : 0;
  const rows = abilityOdds(species, dex);
  if (!rows || !rows.length) return plain;
  let p = 0, seen = 0;
  for (const [ab, pr] of rows) {
    if (!pr) continue;
    seen += pr;
    const A = dex.abilities.get(ab);
    let out = boosts;
    if (A && A.exists && typeof A.onChangeBoost === 'function') {
      const copy = Object.assign({}, boosts);
      try { A.onChangeBoost.call({}, copy, {}, null, null); out = copy; } catch (e) { out = boosts; }
    }
    p += pr * (Object.values(out).some(v => (want > 0 ? v > 0 : v < 0)) ? 1 : 0);
  }
  /* Odds that do not sum to 1 mean the usage table is missing some of this species' abilities; the
   * remainder keeps the unmodified answer rather than silently counting as "no ability". */
  return p + Math.max(0, 1 - seen) * plain;
}

/* SOME BLOCKERS PROTECT THE WHOLE SIDE, NOT THEMSELVES.
 *
 * Armor Tail, Queenly Majesty and Dazzling refuse priority moves aimed at ANY member of their side.
 * abilityBlockProb above asks only about the mon actually targeted, so aiming Fake Out at Farigiraf
 * was correctly refused at 99% while aiming the same Fake Out at Farigiraf's PARTNER read as a clean
 * hit. Half the mechanic, and the missing half is the one that decides targeting in doubles.
 *
 * WHICH ABILITIES ARE SIDE-WIDE IS READ FROM THE DEX, NOT LISTED HERE. Showdown implements the
 * side-wide ones as `onFoeTryMove` and the self-only ones as `onTryHit` -- Armor Tail, Queenly
 * Majesty and Dazzling all carry the first, Flash Fire the second. So the handler NAME is the
 * classifier, and an ability added by a future regulation is covered without an edit.
 *
 * The measured rule still decides WHETHER a given move is refused: this only changes WHO has to be
 * carrying the ability for the refusal to apply. Weighted by the same Smogon odds as everywhere
 * else, because which ability the partner has is population knowledge, not private knowledge. */
let _sideWide = null;
function sideWideAbilities(dex) {
  if (_sideWide) return _sideWide;
  _sideWide = new Set();
  const { blocks } = abilityTables();
  for (const ab of Object.keys(blocks || {})) {
    const A = dex.abilities.get(ab);
    if (A && A.exists && typeof A.onFoeTryMove === 'function') _sideWide.add(norm(ab));
  }
  return _sideWide;
}

/* P(anything on `foeSide` other than the target refuses this move on the target's behalf). */
function allySideBlockProb(move, board, foeSide, targetSpecies, mType, userSpecies, dex) {
  const wide = sideWideAbilities(dex);
  if (!wide.size) return 0;
  const { blocks, abil } = abilityTables();
  const probe = Object.assign(Object.create(Object.getPrototypeOf(move) || Object.prototype), move, { type: mType });
  const pPrank = userSpecies ? pranksterProb(userSpecies) : 0;
  let pNone = 1;
  for (const f of board.field()) {
    if (f.side !== foeSide || !f.mon || f.mon.fainted) continue;
    /* The target itself is already handled by abilityBlockProb; counting it twice would double the
     * refusal odds of a Farigiraf aimed at directly. */
    if (baseSpecies(f.mon.species) === baseSpecies(targetSpecies)) continue;
    const rows = abilityOdds(effSpecies(f.mon, dex), dex);
    if (!rows) continue;
    let p = 0;
    for (const [ab, pr] of rows) {
      if (!wide.has(norm(ab))) continue;
      const e = blocks[ab];
      if (!e) continue;
      const hit = ruleMatches(e.rule, probe, pPrank);
      p += pr * (hit === true ? 1 : (+hit || 0));
    }
    pNone *= (1 - Math.min(1, p));
  }
  return 1 - pNone;
}

/* THE TYPE OF A MOVE IS NOT ALWAYS A FIXED FIELD.
 *
 * Thirteen moves in this format change type with the board, and `move.type` is their BASE type, not
 * the type they will actually hit with. Weather Ball is the one that matters: it is Normal on paper
 * and Water under rain — and Pelipper, which runs it, sets rain on switch-in with Drizzle. So a
 * standard rain lead was having its main attack scored as a Normal move that is neutral on
 * everything, when it is really a Water move that is super effective on Incineroar. Terrain Pulse is
 * the same story on terrain.
 *
 * The mapping is NOT written here. Showdown carries it as an `onModifyType` handler, so the handler
 * is CALLED with a stub of the board and asked what the type would be. That is the source of truth
 * answering for itself, which keeps it correct if a regulation changes a move — and a move whose
 * handler needs more context than the stub provides simply falls back to its base type rather than
 * guessing.
 *
 * The remaining twelve depend on an item, a species or a Tera type rather than the board (Judgment,
 * Techno Blast, Tera Blast, Revelation Dance...). Those still fall back, and that is a known gap
 * rather than a solved problem. */
function moveType(m, board, dex) {
  if (!m || typeof m.onModifyType !== 'function') return m ? m.type : '';
  const probe = { type: m.type };
  const field = {
    isTerrain: t => board.hasField(t),
    isWeather: w => norm(board.weather) === norm(w),
    getPseudoWeather: t => (board.hasField(t) ? {} : null),
    effectiveWeather: () => norm(board.weather),
  };
  const user = { effectiveWeather: () => norm(board.weather), hasItem: () => false, getItem: () => ({}) };
  try { m.onModifyType.call({ field, dex }, probe, user); } catch (e) { return m.type; }
  return probe.type || m.type;
}

/* THE SAME PROBE, FOR EVERYTHING ELSE THE BOARD CHANGES ABOUT A MOVE.
 *
 * moveType above exists because Weather Ball is Normal on paper and Water under rain, and scoring it
 * as Normal was the single most common way this format's rain teams attack. That was not a one-off:
 * a whole class of rules lives in Showdown as HANDLER CODE rather than as a data field, and every one
 * of them was invisible here.
 *
 *   Blizzard is 70% accurate, and 100% in snow.
 *   Solar Beam takes two turns, and one in sun. Electro Shot takes two, and one in rain.
 *
 * Both are `onModifyMove` / `onTryMove` on the move itself. So rather than write down which moves do
 * this -- which would be a rule about Pokemon, and this file has none -- the handler is CALLED with a
 * stub of the current board and asked. A move added by a future regulation is handled with no edit,
 * and a handler this stub cannot satisfy throws and falls back to the printed value rather than
 * inventing one.
 *
 * Costs nothing in ceiling: "Blizzard cannot miss in snow" is a fact, exactly like Flash Fire. */
function boardStub(board, dex) {
  const wx = () => norm(board.weather);
  const field = {
    isTerrain: t => board.hasField(t),
    isWeather: w => (Array.isArray(w) ? w.some(x => norm(x) === wx()) : norm(w) === wx()),
    getPseudoWeather: t => (board.hasField(t) ? {} : null),
    effectiveWeather: wx,
    weather: wx(),
  };
  /* The battle's own logging calls. A handler that announces itself -- `this.add('-prepare', ...)` --
   * would otherwise THROW on the stub and be silently caught, which is exactly what happened: Solar
   * Beam kept reporting a charge turn in sun because the probe died one line before the check. Any
   * handler needing more than these still falls back to the printed value rather than guessing. */
  const noop = () => {};
  /* boost/heal/damage because a charging move may DO something on the wind-up turn -- Electro Shot
   * raises Special Attack as it charges, and without a `boost` stub the probe died before reaching
   * the rain check. runEvent returns true, which is "nothing objected", the same answer a real
   * battle gives when no handler intervenes; returning false would read as "no charge needed" and
   * be wrong in the silent direction. */
  return {
    field, dex, add: noop, addMove: noop, attrLastMove: noop, hint: noop, debug: noop,
    boost: noop, heal: noop, damage: noop, effectState: {}, runEvent: () => true,
  };
}

/* BASE POWER THAT IS COMPUTED, NOT PRINTED.
 *
 * 29 moves in this format carry `basePower: 0` and a `basePowerCallback`: Low Kick and Grass Knot
 * scale with the target's weight, Heavy Slam with the ratio of the two weights, Gyro Ball and
 * Electro Ball with the ratio of speeds. Reading `m.basePower` gives zero for all of them, and this
 * file decides `damaging` by `basePower > 0` — so every one was being scored as a STATUS MOVE, with
 * no effectiveness, no damage and no kill. That is the Rock Slide bug a third time.
 *
 * Measured, they are not common but they are not nothing: Low Kick is on 1.87% of teams and was
 * clicked 237 times in 3,281 clean games, Grass Knot 45, Heavy Slam 33.
 *
 * The callback is CALLED rather than reimplemented. Weight comes from the dex; speed comes from the
 * same spread distribution the damage estimate uses, so Gyro Ball is judged against the speeds people
 * actually run. A callback the stub cannot satisfy throws and falls back to the printed value.
 *
 * Iron Ball and Float Stone change weight and are not modelled: both are under 0.1% of held items
 * here, and inventing an item the target probably does not have would be a worse error than the one
 * being fixed. */
function movePower(m, board, dex, user, target) {
  if (!m) return 0;
  if (typeof m.basePowerCallback !== 'function') return m.basePower || 0;
  const mon = (mo) => {
    const sp = mo && (dex.species.get(mo.species) || dex.species.get(baseSpecies(mo.species)));
    const bs = sp && sp.exists ? sp.baseStats : null;
    const lines = mo ? spreadLines(mo.species, dex, mo.nature) : null;
    const st = lines && lines.length ? lines[0].st : null;
    return {
      /* Showdown weighs in hectograms and getWeight returns exactly that. */
      getWeight: () => (sp && sp.exists ? (sp.weighthg || 1) : 1),
      getStat: (k) => {
        if (!st && !bs) return 1;
        const K = { spe: 'sp', atk: 'at', def: 'df', spa: 'sa', spd: 'sd', hp: 'hp' };
        if (st && K[k] != null) return st[K[k]] || 1;
        return (bs && bs[k]) || 1;
      },
      hp: Math.max(1, Math.round(100 * (mo && typeof mo.hp === 'number' ? mo.hp : 1))), maxhp: 100,
      positiveBoosts: () => 0, volatiles: {}, status: (mo && mo.status) || '',
      hasType: () => false, hasAbility: () => false, hasItem: () => false, getItem: () => ({}),
      side: { sideConditions: {} }, species: { name: mo ? mo.species : '' },
    };
  };
  try {
    const bp = m.basePowerCallback.call(boardStub(board, dex), mon(user), mon(target), m);
    if (typeof bp === 'number' && bp > 0) return bp;
    if (bp === false) return 0;
  } catch (e) { /* fall through */ }
  return m.basePower || 0;
}

/* Accuracy AFTER the board has had its say. `true` means "cannot miss" and is not the number 1. */
function moveAccuracy(m, board, dex) {
  const printed = (m.accuracy === true || m.accuracy == null) ? 1 : Math.max(0, Math.min(1, m.accuracy / 100));
  if (!m || typeof m.onModifyMove !== 'function') return printed;
  const probe = { accuracy: m.accuracy, type: m.type, basePower: m.basePower, flags: { ...(m.flags || {}) } };
  const ctx = boardStub(board, dex);
  const stubMon = { effectiveWeather: () => norm(board.weather), hasItem: () => false, getItem: () => ({}), hasAbility: () => false };
  try { m.onModifyMove.call(ctx, probe, stubMon, stubMon); } catch (e) { return printed; }
  return (probe.accuracy === true || probe.accuracy == null) ? 1
       : Math.max(0, Math.min(1, probe.accuracy / 100));
}

/* Does this move need a turn to charge on THIS board? Solar Beam does not in sun, Electro Shot does
 * not in rain. Showdown expresses that by deleting the charge flag inside onTryMove, so the probe
 * asks whether the flag survives rather than testing a weather by name. */
function chargeTurns(m, board, dex) {
  if (!m) return 0;
  if (m.self && m.self.volatileStatus === 'mustrecharge') return -1;   // the turn is spent AFTER, not before
  if (!(m.flags && m.flags.charge)) return 0;
  if (typeof m.onTryMove !== 'function') return 1;
  const probe = { flags: { ...(m.flags || {}) }, id: m.id, name: m.name };
  const ctx = boardStub(board, dex);
  const stubMon = {
    effectiveWeather: () => norm(board.weather),
    hasItem: () => false, getItem: () => ({}), hasAbility: () => false,
    removeVolatile: () => {}, addVolatile: () => {}, volatiles: {},
  };
  try {
    const r = m.onTryMove.call(ctx, stubMon, stubMon, probe);
    /* THE RETURN VALUE IS THE SIGNAL, and it is subtle enough to be worth stating. Showdown's
     * two-turn moves return `null` to mean "stop here, this turn is the charge", and fall through to
     * an implicit `undefined` when the weather lets them fire at once. So undefined means NO charge.
     * Getting this backwards is silent -- both are falsy. */
    if (r === null) return 1;
    return 0;
  } catch (e) { return 1; }
}

/* The key a field-setting move is tracked under. Trick Room reports `pseudoWeather`, the terrains
 * report `terrain`; both are dex fields and both land in the same namespace so `deadField` is one
 * feature rather than two nearly-identical ones. Returns '' for a move that sets no field. */
function fieldKey(m) {
  if (!m) return '';
  if (m.pseudoWeather) return norm(m.pseudoWeather);
  if (m.terrain) return norm(m.terrain);
  return '';
}

/* Apply a move that was actually used, so the NEXT decision sees what it did. Shared by both
 * adapters for the same reason featuresFor is: if the offline and online worlds updated state
 * differently, the fit and the player would diverge with nothing to catch it.
 *
 * `worked` is the caller's judgement that the move resolved. Offline that is "the move event
 * exists and the setter is not already up"; online it is the absence of a |-fail| for it. */
function noteMove(board, side, user, move, worked) {
  if (!user) return;
  user.moveThisTurn = norm(move && move.id || '');
  if (move && move.stallingMove) user.stalledThisTurn = true;
  if (!worked || !move) return;
  if (move.sideCondition) board.startSide(side, move.sideCondition, move.condition && move.condition.duration);
  const fk = fieldKey(move);
  if (fk) board.startField(fk, move.condition && move.condition.duration);
  if (move.weather) board.setWeather(move.weather);
}

function featuresFor(cand, user, board, side, dex, priorP) {
  derived(dex);        // fills DERIVED / STALL before anything downstream reads them
  /* A SWITCH SHARES NO FEATURE WITH A MOVE, so it returns early rather than running the move code
   * with a null move. Every move feature stays at zero, which is correct and not a gap: they are all
   * statements about a move that is not being used. */
  if (cand && cand.switchTo) return switchFeatures(cand, user, board, side, dex, priorP);
  const m = cand.move;
  const t = cand.targetMon;
  const x = new Array(FEATURES.length).fill(0);
  const set = (name, v) => { x[FEATURE_INDEX[name]] = v; };

  /* Computed, not printed — see movePower. `damaging` decided on m.basePower alone read Low Kick,
   * Grass Knot, Heavy Slam and Gyro Ball as status moves. */
  const realBP = movePower(m, board, dex, user, t || (cand.spread && cand.spread[0]) || null);
  const damaging = m.category !== 'Status' && realBP > 0;
  set('isStatus', damaging ? 0 : 1);
  /* `accuracy === true` is the dex's way of saying "cannot miss" and is NOT the number 1 -- reading
   * it as a number would give every never-miss move an accuracy of 0.01. */
  const acc = moveAccuracy(m, board, dex);
  set('accuracy', acc);
  const ch = chargeTurns(m, board, dex);
  set('chargeTurn', ch > 0 ? 1 : 0);
  set('rechargeTurn', ch < 0 ? 1 : 0);
  set('pivots', m.selfSwitch ? 1 : 0);
  /* Effective priority, not printed priority: a status move on a Prankster user cuts the queue even
   * though the dex says 0. Held as a probability because whether this species has Prankster is only
   * known to the population, exactly as abilityBlock is. */
  let effPri = effectivePriority(m, board, dex, user);
  /* The Dark check, applied to BOTH the queue and the failure feature, because a Prankster move into
   * a Dark type does not go first either -- it simply does not happen. */
  if (m.category === 'Status') {
    const pPrank = pranksterProb(user.species);
    if (pPrank > 0) {
      const aimed = cand.spread && cand.spread.length ? cand.spread : (t ? [t] : []);
      let darkShare = 0;
      for (const h of aimed) {
        const hs = dex.species.get(h.species);
        if (hs && hs.exists && (hs.types || []).map(norm).includes(GAME_RULES.pranksterFailsType)) darkShare++;
      }
      if (aimed.length && darkShare) {
        const p = pPrank * (darkShare / aimed.length);
        set('pranksterFailsDark', p);
        effPri -= p;                                  // the boost is not granted into a Dark type
      }
    }
  }
  set('priority', Math.max(-1, Math.min(1, effPri / 3)));
  /* SET HERE, NOT ONLY IN THE STAT BLOCK. That block needs a TARGET to compare speeds against, so
   * every targetless move -- Tailwind, Protect, Trick Room, every screen -- was silently scoring
   * movesFirst = 0 regardless of priority or Prankster. Whimsicott's Tailwind, the clearest case of
   * a move that goes first, read as going last. The speed comparison below only ever raises it. */
  /* Above zero means the queue is cut outright; a fraction is the chance this species runs the
   * ability that grants it. The speed comparison in the stat block can only raise this. */
  set('movesFirst', Math.max(0, Math.min(1, effPri > 0 ? Math.min(1, effPri) : 0)));

  /* Scaled by the 6-stage maximum the game itself allows, so the number is a share of the range
   * rather than a raw count and nothing here is a constant chosen by me. */
  {
    const ub2 = mySelf => mySelf;
    const off = m.category === 'Physical' ? 'atk' : 'spa';
    const def = m.category === 'Physical' ? 'def' : 'spd';
    if (damaging) {
      set('myOffenseStage', ((user.boosts && user.boosts[off]) || 0) / 6);
      const dl = cand.spread && cand.spread.length ? cand.spread : (t ? [t] : []);
      if (dl.length) set('tgtDefenseStage', dl.reduce((a, h) => a + ((h.boosts && h.boosts[def]) || 0), 0) / dl.length / 6);
    }
    /* CONTRARY INVERTS THE STAT CHANGE, so "this move raises one of my stats" is not a property of
     * the move alone. Staraptor-Mega has it, and Staraptor-Mega is the single most-used mega in this
     * format at 428,748 -- a Swords Dance on it LOWERS Attack, and Intimidate RAISES it.
     *
     * Not named here, and neither is Simple. Showdown implements both as `onChangeBoost`, so the
     * handler is CALLED with the move's own boost table and asked what it becomes: Contrary returns
     * {atk:1} as {atk:-1}, Simple returns it as {atk:2}. Any future ability of that shape is handled
     * with no edit.
     *
     * Expected values, weighted by the Smogon odds, because which ability a Pokemon has is knowable
     * to the population and not to the player -- exactly as abilityBlock and effectivePriority are.
     *
     * CORRECTING THE HANDOFF, which said Contrary "inverts myOffenseStage, MAG's strongest positive
     * feature". It does not. myOffenseStage reads stages ALREADY on the board, recorded from real
     * protocol events, so it is right whatever produced them. What Contrary changes is the PREDICTED
     * effect of a move being considered, which is these two features and only these two. */
    const selfB = (m.self && m.self.boosts) || (SELF_TARGETS.has(m.target) ? m.boosts : null);
    if (selfB) set('movesBoostMe', expectedBoostSign(selfB, effSpecies(user, dex), dex, +1));
    if (m.boosts && !SELF_TARGETS.has(m.target)) {
      const dl2 = cand.spread && cand.spread.length ? cand.spread : (t ? [t] : []);
      if (dl2.length) {
        set('movesLowerFoe',
          dl2.reduce((a, h) => a + expectedBoostSign(m.boosts, effSpecies(h, dex), dex, -1), 0) / dl2.length);
      }
    }
  }


  /* A volatile aimed at the opponent removes an option from them; aimed at yourself it adds one to
   * you. `move.target` is the dex's own field, so neither branch names a move. */
  if (m.volatileStatus) {
    if (SELF_TARGETS.has(m.target)) set('volatileOnSelf', 1); else set('volatileOnFoe', 1);
  }
  set('bp', damaging ? Math.min(2.5, realBP / 100) : 0);

  /* The type this move will ACTUALLY hit with on this board — see moveType. Using m.type here
   * scored Weather Ball as Normal under rain, which is the single most common way this format's
   * rain teams attack. */
  const mType = moveType(m, board, dex);
  const userSp = dex.species.get(user.species);
  const userTypes = (userSp && userSp.exists && userSp.types) || [];
  set('stab', damaging && userTypes.map(norm).includes(norm(mType)) ? 1 : 0);

  /* A spread move is scored against everything it will hit, averaged; a single-target move against
   * the one mon it is aimed at. Averaging is what makes the two comparable in the same units, so the
   * fitted `eff` weight means the same thing for Rock Slide as for Ice Beam. */
  const hitList = damaging ? (cand.spread && cand.spread.length ? cand.spread : (t ? [t] : [])) : [];
  if (hitList.length) {
    let immuneCount = 0, hurtSum = 0, n = 0, b4 = 0, b2 = 0, bHalf = 0, bQ = 0;
    for (const h of hitList) {
      const hSp = dex.species.get(h.species);
      const hTypes = (hSp && hSp.exists && hSp.types) || [];
      hurtSum += Math.max(0, 1 - h.hp);
      if (!hTypes.length) { n++; continue; }
      /* getImmunity is asked FIRST because getEffectiveness returns 0 for an immunity, which is the
       * same value it returns for a neutral hit. Collapsing "does nothing" into "normal damage" is
       * exactly the class of error this file exists to remove. */
      if (!dex.getImmunity(mType, hTypes)) immuneCount++;
      else {
        const e = dex.getEffectiveness(mType, hTypes);
        if (e >= 2) b4++; else if (e === 1) b2++; else if (e === -1) bHalf++; else if (e <= -2) bQ++;
      }
      n++;
    }
    if (n) {
      set('eff4', b4 / n); set('eff2', b2 / n); set('effHalf', bHalf / n); set('effQuarter', bQ / n);
      /* Immune only counts when the move does nothing to ANYTHING it hits. A spread move that one
       * foe is immune to is still a perfectly good move against the other. */
      set('immune', immuneCount === n ? 1 : 0);
      set('tgtHurt', hurtSum / n);
    }
  }

  /* ---- THE STAT FACTS -------------------------------------------------------------------------
   * Base stats, not the live in-battle numbers: the spread is hidden information in a closed-sheet
   * game and the base line is what both players genuinely know. Scaled by the format's own spread of
   * that stat so the numbers are comparable across features and nothing here is a typed constant. */
  {
    const uSp = dex.species.get(user.species);
    const ub = uSp && uSp.exists && uSp.baseStats;
    /* Averaged over everything the move hits, exactly as effectiveness is. Reading these off
     * `targetMon` alone left every SPREAD move at zero on all four stat features — a systematic
     * blind spot on a large share of the damage in doubles, and the same mistake that scored Rock
     * Slide as a status move two versions ago. */
    const statList = cand.spread && cand.spread.length ? cand.spread : (t ? [t] : []);
    const tbs = statList.map(h => { const sp2 = dex.species.get(h.species); return sp2 && sp2.exists && sp2.baseStats; }).filter(Boolean);
    if (ub && tbs.length) {
      const avg = k => tbs.reduce((a, b) => a + b[k], 0) / tbs.length;
      const tb = { hp: avg('hp'), atk: avg('atk'), def: avg('def'), spa: avg('spa'), spd: avg('spd'), spe: avg('spe') };
      /* Tailwind is a side condition and Trick Room a pseudo-weather, both already tracked. Speeds
       * are base lines -- the exact spread is hidden -- so this is the order two informed players
       * would both expect, not a claim about the actual stat. */
      const foeSide = side === 'p1' ? 'p2' : 'p1';
      /* INVESTMENT-AWARE, not base stats: see expectedSpe. The target's is averaged over everything
       * the move hits, exactly as the other stat features above are. */
      const myBaseSpe = expectedSpe(effSpecies(user, dex), dex, user.nature);
      const thBaseSpe = statList.reduce((a, h) => a + expectedSpe(effSpecies(h, dex), dex, h.nature), 0) / statList.length;
      const mySpe = myBaseSpe * speedMult(board, side, dex) * monSpeedMult(user, board, dex);
      const thSpe = thBaseSpe * speedMult(board, foeSide, dex) * monSpeedMult(t, board, dex);
      const slowFirst = board.hasField(GAME_RULES.trickRoomField);
      /* PRANKSTER, WHICH IS MY OWN ABILITY AND WAS INVISIBLE.
       *
       * This file already computed P(the user has Prankster) -- but only to ask whether Armor Tail
       * would REFUSE the move. It never asked the other half of the same fact: Prankster gives my
       * status moves +1, so Whimsicott's Tailwind and Thunder Wave go first. MAG could see the
       * ability when it hurt and not when it helped.
       *
       * That is the general shape of "does each Pokemon need its own AI". It does not. It needs its
       * OWN traits as features, so one model learns what Prankster is worth and applies it to every
       * Pokemon that has it -- including ones the corpus has barely seen. 2,103 clean games across
       * 263 species is about eight games each; there is no such thing as a per-species model here. */
      set('movesFirst', Math.max(x[FEATURE_INDEX.movesFirst],
        (slowFirst ? mySpe < thSpe : mySpe > thSpe) ? 1 : 0));
      const off = tb.atk + tb.spa;
      const physShare = off ? (tb.atk - tb.spa) / off : 0;
      if (off) set('tgtPhysical', physShare);
      /* Burn cuts Attack, so it bites a physical target and is close to wasted on a special one.
       * Paralysis cuts Speed, so it bites hardest on something that currently outruns me. Read off
       * `move.status`, a dex data field -- there is no move named here either. */
      const bites = GAME_RULES.statusHitsStat[norm(m.status || '')];
      if (bites === 'physical') set('statusBites', physShare);
      else if (bites === 'speed') set('statusBites', ub.spe < tb.spe ? 1 : 0);
      /* Which of the target's defences my move actually attacks, relative to its other one. A
       * physical move into a target whose Defence is far below its Special Defence scores high. */
      if (!damaging) { /* status moves have no attacking side */ }
      else {
        const hitsDef = m.category === 'Physical';
        const mine = hitsDef ? tb.def : tb.spd, other = hitsDef ? tb.spd : tb.def;
        if (mine + other) set('defMismatch', (other - mine) / (mine + other));
        set('tgtBulk', Math.min(2, (tb.hp * mine) / 9000));
      }
    }
  }

  /* ---- DOES IT KILL, AND AM I ABOUT TO BE KILLED ----------------------------------------------
   * A guaranteed kill is the MINIMUM roll meeting what is LEFT of the target, not the average roll
   * meeting its full bar. That is the question a player actually asks ("is this a roll or is it
   * clean?"), and using the mean here would have MAG calling coin-flips certainties. */
  {
    const D = damageEngine();
    if (!D) dmgFailures.unavailable++;
    else {
      const att = dmgMon(user, D);
      const myLeft = Math.max(0, typeof user.hp === 'number' ? user.hp : 1);
      const { threat, worst } = incomingThreat(board, side, user, att, D);
      const threatened = att && worst >= myLeft ? 1 : 0;

      const hits = cand.spread && cand.spread.length ? cand.spread : (t ? [t] : []);
      if (att && damaging && hits.length) {
        const uSp2 = dex.species.get(user.species);
        const uSpe = (uSp2 && uSp2.exists && uSp2.baseStats && uSp2.baseStats.spe) || 0;
        let kos = 0, killShare = 0, fracSum = 0, n2 = 0, killsThreatening = 0, killsFirst = 0, sashDrag = 0, protDrag = 0, protAll = 0;
        const SASH = abilityTables().sash || {};
        for (const h of hits) {
          const dm = dmgMon(h, D);
          if (!dm) continue;
          const isSpread = !!(cand.spread && cand.spread.length > 1);
          /* PER TARGET, because that is what these moves depend on: Low Kick and Grass Knot scale
           * with the target's weight, so the same click is 80 into an Incineroar and 100 into a
           * Kingambit. A single number computed once would be wrong for one of them. */
          const mForDmg = { basePower: movePower(m, board, dex, user, h), category: m.category };
          /* OVER THE SPREADS PEOPLE ACTUALLY RUN, not against one guessed stat line. Falls back to
           * the single stored line for a species the usage data has no spreads for. */
          const lines = spreadLines(h.species, dex, h.nature) || [{ p: 1, st: null }];
          /* Whoever is standing NEXT TO the target, because Friend Guard is theirs and not the
           * target's. This is the only place a damage number depends on a third Pokemon. */
          let tgtAlly = null;
          for (const f of board.field()) {
            if (f.mon === h || f.mon.fainted) continue;
            const hSide = board.field().find(z => z.mon === h);
            if (hSide && f.side === hSide.side) { tgtAlly = f.mon; break; }
          }
          const abMult = unmodelledAbilityMult(m, user, h, tgtAlly);
          let koP = 0, meanFrac = 0, minKills = false;
          for (const L of lines) {
            const r0 = dmgFractions(D, att, dm, mForDmg, mType, isSpread, board, L.st, m);
            if (!r0) continue;
            const r = { min: r0.min * abMult, max: r0.max * abMult, mean: r0.mean * abMult };
            const leftL = Math.max(0, typeof h.hp === 'number' ? h.hp : 1);
            meanFrac += L.p * (leftL > 0 ? Math.min(1, r.mean / leftL) : 1);
            if (leftL > 0 && r.min >= leftL) { koP += L.p; minKills = true; }
          }
          n2++;
          protAll += protectOdds(h.species);
          const left = Math.max(0, typeof h.hp === 'number' ? h.hp : 1);
          fracSum += meanFrac;
          killShare += koP;
          /* left > 0 is not paranoia: a fainted mon left in the hit list would make EVERY move a
           * guaranteed kill, since any roll meets zero. */
          if (left > 0 && minKills) {
            kos++;
            /* Only from FULL health: a Sash is already gone once the holder has taken a hit, so it
             * cannot save a target that is visibly damaged. This is why the drag is conditioned on
             * hp rather than applied flat. */
            /* THE SHEET OUTRANKS THE POPULATION, and this is the single clearest case of it.
             *
             * SASH[species] is "what fraction of this species holds a Focus Sash", from the usage
             * file. Focus Sash is the most-held item in the format at 11.7% of sheet entries, so
             * every kill was being discounted by roughly a tenth on a coin-flip basis -- against a
             * holder MAG called kills that cannot happen, and against everything else it under-rated
             * its own kills by the same margin.
             *
             * In an open-sheet game the answer is not a probability. The sheet names the item before
             * turn one. Known holder -> the drag is 1 and the kill from full health is off; known
             * non-holder -> 0 and the kill stands. The population figure is the fallback for a
             * closed-sheet game, which is what it was always for. */
            if (left >= 1) {
              const declared = board && board.sheetItem && board.sheetItem(h.side, h.species);
              sashDrag += declared !== null && declared !== undefined
                ? (norm(declared) === GAME_RULES.survivesFromFull ? 1 : 0)
                : (SASH[norm(h.species)] || SASH[baseSpecies(h.species)] || 0);
            }
            protDrag += protectOdds(h.species);
            /* Removing the thing that was going to remove me is a different act from removing
             * something harmless, and no combination of the existing features can say so. */
            if ((threat.get(h) || 0) >= myLeft) killsThreatening = 1;
            const hSp2 = dex.species.get(h.species);
            const hSpe = ((hSp2 && hSp2.exists && hSp2.baseStats && hSp2.baseStats.spe) || 0) *
                         speedMult(board, side === 'p1' ? 'p2' : 'p1', dex);
            const mine = uSpe * speedMult(board, side, dex);
            const first = (m.priority || 0) > 0 ||
              (board.hasField(GAME_RULES.trickRoomField) ? mine < hSpe : mine > hSpe);
            if (first) killsFirst = 1;
          }
        }
        if (n2) {
          /* SCALED BY ACCURACY, because "will this kill" is not only a damage question. A Focus Blast
           * that removes the target on its worst roll still fails three times in ten, and calling
           * that a guaranteed kill is exactly the kind of confident wrong number this file exists to
           * stop. The separate `accuracy` feature carries the general reluctance to click a shaky
           * move; this one carries the odds the KILL specifically happens. */
          /* Discounted by the odds the target simply BLOCKS. Measured as 46.3% of every false kill
           * call, and it is not a damage question -- the arithmetic was right, they pressed Protect.
           * A move already stalled last turn is far less likely to stall again, which deadStall
           * carries separately, so this is not conditioned on it here. */
          /* THE SHARE OF PLAUSIBLE SPREADS THIS KILLS, not a yes/no against one guessed stat line.
           * A move that removes a defensive Incineroar and not a specially defensive one now reads
           * as the roll it is, which the old feature could not say in either direction. */
          set('koTarget', (killShare / n2) * acc * (1 - sashDrag / Math.max(1, n2)) * (1 - protDrag / Math.max(1, n2)));
          /* IS IT A ROLL? Peaks at a coin flip and falls to zero at both certainties, so "I do not
           * know whether this kills" is expressible as its own thing rather than hiding inside a
           * middling probability -- which is the difference between a read and a gamble. */
          const kp = killShare / n2;
          set('killIsRoll', 4 * kp * (1 - kp));
          set('tgtMayProtect', protAll / n2);
          set('dmgFrac', fracSum / n2);
          set('killsThreat', killsThreatening);
          set('koFirst', killsFirst);
        }
      }
      /* stallingMove is the dex's own flag for the Protect family, so Baneful Bunker, Spiky Shield
       * and Burning Bulwark are covered without any of them being named here. */
      if (m.stallingMove) set('protectThreatened', threatened);
      /* PROTECTING INTO AN ENCORE. Fires only on the Protect family, and only when something across
       * the field can actually punish it. Three factors, each already available:
       *
       *   P(that foe carries Encore)   move-priors, the same public per-species click table
       *                                protectOdds reads. Derived family, so Encore is not named.
       *   does it move first           effectivePriority on ITS Encore, which is where Prankster
       *                                enters -- Whimsicott's Encore is +1 and lands before I move
       *                                again, an ordinary Pokemon's does not.
       *   am I Dark                    a Prankster-boosted Encore fails outright on a Dark type, so
       *                                the Prankster share of the threat is removed for a Dark user.
       *                                The non-Prankster share still applies: a fast Encore works on
       *                                a Dark type perfectly well. */
      if (m.stallingMove) {
        const d3 = derived(dex);
        const iAmDark = userTypes.map(norm).includes('dark');
        let worst = 0;
        for (const f of board.field()) {
          if (f.side === side || !f.mon || f.mon.fainted) continue;
          const foeSp = effSpecies(f.mon, dex);
          let pHas = 0;
          for (const id of d3.locking) pHas += movePriorOdds(foeSp, id);
          if (pHas <= 0) continue;
          const pPrank = pranksterProb(foeSp);
          /* Split the threat by route, because only the Prankster route is refused by a Dark type. */
          const viaPrankster = pPrank * (iAmDark ? 0 : 1);
          /* The non-Prankster route needs raw speed: it only bites if that Pokemon outruns me. */
          const foeFast = expectedSpe(foeSp, dex, f.mon.nature) * speedMult(board, f.side, dex) * monSpeedMult(f.mon, board, dex);
          const mineNow = expectedSpe(effSpecies(user, dex), dex, user.nature) * speedMult(board, side, dex) * monSpeedMult(user, board, dex);
          const slowFirst2 = board.hasField(GAME_RULES.trickRoomField);
          const outruns = slowFirst2 ? (foeFast < mineNow) : (foeFast > mineNow);
          const viaSpeed = (1 - pPrank) * (outruns ? 1 : 0);
          const p = Math.min(1, pHas) * Math.min(1, viaPrankster + viaSpeed);
          if (p > worst) worst = p;
        }
        set('stallIntoEncore', worst);
      }
      set('diesBeforeMoving', threatened && !x[FEATURE_INDEX.movesFirst] ? 1 : 0);
    }
  }

  /* ---- WOULD AN ABILITY SIMPLY EAT IT? ------------------------------------------------------- */
  {
    const list = cand.spread && cand.spread.length ? cand.spread : (t ? [t] : []);
    if (list.length) {
      const fSide = side === 'p1' ? 'p2' : 'p1';
      let pSum = 0;
      for (const h of list) {
        /* The target's own ability, and then anything on its side that refuses on its behalf.
         * Combined as "neither declines", so two blockers cannot sum past certainty. */
        const own = abilityBlockProb(m, effSpecies(h, dex), mType, effSpecies(user, dex));
        const ally = allySideBlockProb(m, board, fSide, effSpecies(h, dex), mType, effSpecies(user, dex), dex);
        pSum += 1 - (1 - own) * (1 - ally);
      }
      set('abilityBlock', pSum / list.length);
    }
  }

  /* ---- IT ALSO HITS MY OWN PARTNER -----------------------------------------------------------
   * Sixteen moves in this format are `allAdjacent`, which in doubles means they hit the ally as well
   * as both foes — Earthquake, Discharge, Lava Plume, Sludge Wave, Explosion. The first version
   * lumped those in with foe-only spreads and scored them against the opponents ONLY, so clicking
   * Earthquake next to your own Garchomp looked free. It is not, and the fit is now allowed to price
   * it. An ally that is immune (a Flying partner under Earthquake) is not counted, because that is
   * the case where it really is free. */
  if (damaging && cand.allies && cand.allies.length) {
    for (const al of cand.allies) {
      const aSp = dex.species.get(al.species);
      const aTypes = (aSp && aSp.exists && aSp.types) || [];
      if (!aTypes.length || !dex.getImmunity(mType, aTypes)) continue;   // type-immune partner: free
      /* AN ABILITY MAKES IT FREE TOO, and this only tested TYPES. Discharge next to your own
       * Lightning Rod partner, Surf next to Water Absorb, anything next to Telepathy -- all read as
       * costing something when they cost nothing, and Lightning Rod's case is not merely free but
       * beneficial. Teams are BUILT around this, so it is not an edge case.
       *
       * Uses the same measured table as abilityBlock rather than a list typed here. That covers
       * Levitate (3.40% of the format, 1,264 observations), Flash Fire, Volt Absorb and Earth Eater.
       * KNOWN GAP, STATED: Lightning Rod (1.30%) and Telepathy (0.26%) are ABSENT from the derived
       * table -- the derivation never observed them refusing a move -- so those two still read as a
       * cost. That is a data gap, not a modelling choice, and it is 1.6% of the format. */
      if (abilityBlockProb(m, al.species, mType, user.species) >= 0.5) continue;
      /* ONLY WHEN IT ACTUALLY COSTS SOMETHING. A first version fired on any non-immune ally and came
       * back with a POSITIVE weight — i.e. "humans like hitting their own partner", which is not a
       * credible reading. It was confounded: Earthquake and Discharge are strong, popular spread
       * moves, so the feature was mostly measuring "this is a good move". Real teams are built so the
       * partner RESISTS the spread move it sits next to, and that case is not a cost at all. Firing
       * only when the ally takes neutral damage or worse separates the two. */
      if (dex.getEffectiveness(mType, aTypes) >= 0) { set('allyHit', 1); break; }
    }
  }

  /* ---- MOVES THAT CANNOT WORK RIGHT NOW ------------------------------------------------------
   * Each of these is a dex data field compared against tracked state. No move is named. */
  if (m.status && t && t.status) set('deadStatus', 1);
  if (m.sideCondition && board.hasSide(side, m.sideCondition)) set('deadSide', 1);
  if (fieldKey(m) && board.hasField(fieldKey(m))) set('deadField', 1);
  if (m.weather && norm(m.weather) === norm(board.weather)) set('deadWeather', 1);
  if (m.stallingMove && user.stalledLastTurn) set('deadStall', 1);

  /* Does this move need the target to have already moved? Encore, Disable, Torment and the rest fail
   * outright against something with no last move -- the same shape as deadStatus, keyed on lastMove.
   *
   * BUT IT DEPENDS ON WHO MOVES FIRST, and that is the whole point. A fresh switch-in has no last
   * move AT THE MOMENT OF THE DECISION, yet it is about to make one. If my Encore is SLOWER, the
   * target moves, gains a last move, and Encore lands -- that is the normal way the move is used. If
   * my Encore resolves FIRST it hits a target that still has not moved, and fails.
   *
   * Which makes PRANKSTER the worst case rather than an edge case: +1 priority on a status move means
   * Whimsicott, Sableye and Grimmsnarl essentially always resolve first, so Prankster Encore into a
   * fresh switch-in fails EVERY time. The version this replaces flagged slow Encore -- the good play
   * -- just as hard as fast Encore. Gating on movesFirst is why this sits down here: move order is
   * not settled until Tailwind, Trick Room and priority have all been applied above. */
  if (GAME_RULES.needsTargetToHaveMoved.includes(norm(m.id))) {
    const aimed = cand.spread && cand.spread.length ? cand.spread : (t ? [t] : []);
    if (aimed.length) {
      let noMove = 0;
      for (const h of aimed) if (!h.lastMove && !h.moveThisTurn) noMove++;
      set('deadNoLastMove', (noMove / aimed.length) * x[FEATURE_INDEX.movesFirst]);
    }
  }

  set('priorLogP', Math.log(Math.max(PRIOR_FLOOR, priorP || 0)));
  return x;
}

/* Enumerate the (move, target) pairs a mon may choose between.
 *
 * Target legality comes from `move.target` on the dex object, so a move that hits both foes offers
 * ONE candidate and a move that hits one foe offers one candidate per living foe. This is where the
 * current bot loses most of its super-effective rate: RandomPlayerAI picks the foe slot with
 * `this.prng.random(2)` BEFORE chooseMove is ever called, so aiming is a coin flip no matter how
 * good the move choice is. */
/* Targets the player does NOT aim: the move goes where it goes, so the move is one candidate. */
const SELF_TARGETS = new Set(['self', 'allySide', 'all', 'allyTeam', 'foeSide', 'randomNormal', 'scripted', 'adjacentAlly']);
/* Targets that hit EVERY foe at once. Not aimed either, but unlike the above they very much do have
 * type effectiveness — against both foes. Treating them as target-less scored Rock Slide, Heat Wave
 * and Dazzling Gleam as if they were status moves, which in doubles is a large fraction of all the
 * damage in the format. */
const SPREAD_TARGETS = new Set(['allAdjacentFoes', 'allAdjacent']);

function candidates(moves, user, board, side, dex) {
  const foeSide = side === 'p1' ? 'p2' : 'p1';
  const foes = board.field().filter(f => f.side === foeSide);
  const allies = board.field().filter(f => f.side === side && f.mon !== user);
  const out = [];
  for (const mv of moves) {
    const m = dex.moves.get(mv);
    if (!m || !m.exists) continue;
    const tgt = m.target || 'normal';
    if (SPREAD_TARGETS.has(tgt)) {
      /* `allAdjacent` reaches the ally as well; `allAdjacentFoes` does not. Lumping the two was the
       * bug that made Earthquake look free beside your own partner. */
      const alsoAlly = tgt === 'allAdjacent' ? allies.map(f => f.mon) : null;
      out.push({ move: m, targetMon: null, spread: foes.map(f => f.mon), allies: alsoAlly, targetKey: '' });
    } else if (tgt === 'adjacentAlly') {
      out.push({ move: m, targetMon: allies.length ? allies[0].mon : null, ally: true, targetKey: '' });
    } else if (SELF_TARGETS.has(tgt)) {
      out.push({ move: m, targetMon: null, targetKey: '' });
    } else if (['normal', 'any', 'adjacentFoe', 'adjacentAllyOrSelf'].includes(tgt)) {
      if (!foes.length) { out.push({ move: m, targetMon: null, targetKey: '' }); continue; }
      for (const f of foes) out.push({ move: m, targetMon: f.mon, targetKey: f.side + f.letter, targetSide: f.side, targetLetter: f.letter });
    } else {
      out.push({ move: m, targetMon: null, targetKey: '' });
    }
  }
  /* SWITCHING IS A CHOICE, AND IT WAS NOT ON THE LIST. Everything above is a move; a switch has no
   * type, no power and no target, so none of the move features mean anything for it and MAG simply
   * had no opinion -- the decision fell through to the random player it inherits from, in both the
   * forced and the voluntary case. Measured: MAG switches 8.4 times a game against a human 10.7, so
   * roughly the right NUMBER of switches and the wrong ones, which is worse than not switching at
   * all: you take a free hit on the way in and land in a matchup you did not choose. */
  for (const sp of board.bench(side)) out.push({ move: null, targetMon: null, switchTo: sp, targetKey: 's:' + sp });
  return out;
}

/* The feature vector for bringing something else in. Deliberately short: the only things knowable
 * about a replacement before it arrives are what it takes and how fast it is. */
function switchFeatures(cand, user, board, side, dex, priorP) {
  const x = new Array(FEATURES.length).fill(0);
  const set = (n, v) => { x[FEATURE_INDEX[n]] = v; };
  set('isSwitch', 1);
  set('priorLogP', Math.log(Math.max(PRIOR_FLOOR, priorP || PRIOR_FLOOR)));

  const D = damageEngine();
  if (!D) { dmgFailures.unavailable++; return x; }

  /* The replacement arrives at full health, so what matters is whether the hardest incoming attack
   * takes all of it, or half of it. Measured against the same spread distribution everything else
   * now uses, so a bulky switch-in is not judged on a stat line nobody runs. */
  const incoming = { species: cand.switchTo, hp: 1, boosts: {}, fainted: false };
  const inMon = dmgMon(incoming, D);
  const { worst } = incomingThreat(board, side, user, inMon, D);
  if (inMon) {
    set('switchSurvives1', worst < 1 ? 1 : 0);
    set('switchSurvives2', worst < 0.5 ? 1 : 0);
  }

  /* Faster than the biggest threat on the field. Investment-aware speeds, adjusted for Tailwind and
   * reversed under Trick Room, exactly as movesFirst does -- one definition of the queue, not two.
   * The incoming mon's own item and status are not applied: it is on the bench, so its status is not
   * tracked and its item is only known if the sheet published one. speedMult (side conditions) does
   * apply, because those belong to the side and are already in effect when it lands. */
  const mySpe = expectedSpe(cand.switchTo, dex, '') * speedMult(board, side, dex);
  const foeSide = side === 'p1' ? 'p2' : 'p1';
  let fastest = 0;
  for (const f of board.field()) {
    if (f.side === side || !f.mon || f.mon.fainted) continue;
    const s2 = expectedSpe(effSpecies(f.mon, dex), dex, f.mon.nature) *
               speedMult(board, foeSide, dex) * monSpeedMult(f.mon, board, dex);
    if (s2 > fastest) fastest = s2;
  }
  const slowFirst = board.hasField(GAME_RULES.trickRoomField);
  set('switchFaster', (slowFirst ? mySpe < fastest : mySpe > fastest) ? 1 : 0);
  return x;
}

/* dmgFailures is exported so a caller can ASSERT the damage features were live. A run in which the
 * damage engine failed to load produces a full, plausible-looking feature vector with four zeros in
 * it, and nothing about the output would say so. */
module.exports = { FEATURES, FEATURE_INDEX, JOINT_FEATURES, JOINT_INDEX, jointFeaturesFor, PRIOR_FLOOR, Board, featuresFor, candidates, noteMove, fieldKey, moveType, moveAccuracy, chargeTurns, spreadLines, movePower, abilityBlockProb, norm, baseSpecies, SELF_TARGETS, dmgFailures, damageEngine };
