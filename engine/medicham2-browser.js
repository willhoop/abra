/* MEDICHAM v3 — a real Gen-9 DOUBLES rollout engine (browser + node).
 * Expects MC (mons/moves/C type-chart/priors) and mcEff to be in scope.
 * In the browser these come from the embedded data block; in node tests they're injected.
 * Exposes winProb2(namesA, namesB, N, itemsOverride) -> P(A wins).
 *
 * Why doubles: the previous engine was a 1v1 OHKO chain, which collapses to speed-
 * deterministic 0/100 results. Real doubles (two active per side, spread moves, Protect,
 * positioning, redirection) restores the non-transitivity that makes win rates meaningful. */
(function(root){
'use strict';
// ---- curated metadata the compact move table lacks (only fields we can't derive) ----
/* THE TAG ARTIFACT is the source of truth for mechanics; see engine/tags.js.
 *
 * This file runs in BOTH node and the browser, so a bare require() would throw on the live site.
 * Under node it loads the module; in the browser it expects window.ABRA_TAGS (the same JSON) and
 * degrades to a null lookup if the page did not ship it -- which keeps the site working while
 * making the absence visible through TAGS.missing rather than silently scoring everything at x1. */
const TAGS = (function(){
  /* AN A/B SWITCH, so both arms of a head-to-head share one binary. ABRA_TAGS_OFF=1 makes every
   * lookup return null, which reverts the engine to exactly its pre-wire behaviour -- the honest
   * control for "did wiring the artifact make the bot stronger". Without this the comparison would
   * be against a different build, and half this project's null results came from arms that were not
   * actually comparable. */
  if (typeof process !== 'undefined' && process.env) {
    const OFF_STUB = { off: true, param(){ return null; }, has(){ return false; },
                       tagsFor(){ return null; },
                       reactorsTo(){ return {abilities:[],items:[],moves:[]}; }, hits(){ return {}; } };
    OFF_STUB.withTag=function(){return [];};
    if (process.env.ABRA_TAGS_OFF === '1') return OFF_STUB;
    /* ABRA_TAGS_OFF_TREE=<path> turns tags off ONLY for the copy of this file living under <path>.
     * The global switch above cannot arm a paired head-to-head: both arms battle inside ONE process
     * (mew.js --policy score --policy2 score@<worktree>), so a process-wide env var flips both arms
     * together. Scoping the switch to a directory lets a worktree of the SAME commit be the control
     * arm — identical code, identical tracked data, the artifact lookup is the only difference.
     * The trailing-slash compare stops ../ABRA from matching ../ABRA-old (a real prefix hazard). */
    if (process.env.ABRA_TAGS_OFF_TREE && typeof __dirname === 'string') {
      const norm = s => String(s).replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase() + '/';
      if (norm(__dirname).startsWith(norm(process.env.ABRA_TAGS_OFF_TREE))) return OFF_STUB;
    }
  }
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try { return require('./tags.js'); } catch (e) { /* fall through to the browser path */ }
  }
  const db = (typeof window !== 'undefined' && window.ABRA_TAGS) || null;
  const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const T = { move:'moves', item:'items', ability:'abilities' };
  return {
    missing: !db,
    withTag(kind, tag){
      const t=db&&db[T[kind]]; if(!t) return [];
      return Object.keys(t).filter(id=>(t[id].tags||[]).includes(tag));
    },
    param(kind, id, tag){
      if(!db) return null;
      const rec = (db[T[kind]]||{})[norm(id)];
      if(!rec || !rec.tags || !rec.tags.includes(tag)) return null;
      return (rec.params && rec.params[tag]) || {};
    },
    /* The WHOLE record, so a consumer can ask what ELSE an entity carries. ROADMAP #92 needs it:
     * `damageBoost` is only safe to read on an ability that carries NOTHING ELSE, because on the
     * nine that do it duplicates a sharper tag this engine already spends. Mirrors tags.js's own
     * `tagsFor` so the browser path and the node path answer the same question. */
    tagsFor(kind, id){ if(!db) return null; return (db[T[kind]]||{})[norm(id)] || null; },
    has(kind,id,tag){ return !!this.param(kind,id,tag); },
    reactorsTo(k){ return (db && db.linkage && db.linkage[k]) || {abilities:[],items:[],moves:[]}; },
    hits(){ return {}; }
  };
})();

/* EVERY SWALLOWED FAILURE IN THIS FILE COUNTS ITSELF. Two catch blocks here fall back to a
 * plausible-looking default (skip the Encore click; leave a second mega un-reverted) and used to say
 * nothing at all, which is the exact shape CLAUDE.md records as this project's characteristic bug --
 * "a capability was absent and everything reported success". A zero here is the claim that the
 * fallback never ran; a non-zero one is the receipt that it did. Exported as `fails` so a test or a
 * run can print it. Caught by tests/test-no-silent-failure.js, which is what made these visible. */
/* CAPABILITIES THAT FIRED, not failures. Separate object because the two are read for opposite
 * reasons: a non-zero MEDFAILS is bad news, a ZERO here is.
 *
 * CLAUDE.md: *"A capability that cannot prove it ran is assumed broken. Every capability emits a
 * counter, the run prints it, and a zero is called out."* Flinch had no counter, and on 2026-08-04
 * Will asked the obvious question -- "are we sure those tags like flinch actually work" -- which took
 * four failed probes to not answer. `_flinch` is set and CONSUMED inside a single turn (set at the
 * secondary, read at line ~2073, cleared at end of turn), so no caller can observe it afterwards and
 * every post-turn check reads false whether or not the mechanic fired. The instrument had to be
 * inside the engine; there was no probe that could have worked from outside.
 *
 * That is the general shape rather than a flinch quirk: any mechanic resolved and cleared within one
 * turn is unobservable from outside and needs a counter here. Add to this object rather than writing
 * a fifth external probe. */
const MEDSEEN = { flinch: 0, flinchBlockedByInnerFocus: 0, flinchTooLate: 0,
  /* ROADMAP #81 WIRE 12 -- the four capabilities this wire armed, each with a name so a ZERO reads as
   * the finding it is (CLAUDE.md: a capability that cannot prove it ran is assumed broken).
   *   auraApplied      a Fairy/Dark Aura multiplier reached a base power -- from ANY body on the
   *                    field, the holder's own moves and the foe's alike;
   *   perishTicked     a perish clock counted down at a residual; perishKO is the faint at zero, and
   *                    the two are separate because the counter being present never proved the KO;
   *   perishClearedOnSwitch  the standard escape: a body left the field and lost the clock;
   *   passesStateSwitch      Baton Pass or Shed Tail actually MOVED a body, which neither did;
   *   passesStateBoosts / passesStateVolatiles  what the incoming body inherited;
   *   curseGhost / curseNonGhost  the two halves of a move that is two moves. */
  auraApplied: 0, perTurnDamageChip: 0,
  /* WIRE 138 -- a per-turn boost (Speed Boost) REFUSED because the body arrived this turn, which is
   * Showdown's `activeTurns` gate. Counted rather than silent for the usual reason and one extra: the
   * gate reads a flag another wire owns (`_newlySwitched`, WIRE 135), so if that flag ever stopped
   * being set this would fall to zero and the ability would quietly go back to firing a turn early. */
  perTurnBoostGatedOnEntry: 0,
  /* WIRE 139 -- THE SLOT-FIRST TARGET RULE, three counters because they are three different events.
   *   reaimedToSlot     a move resolved onto a DIFFERENT body than the one it was aimed at, because
   *                     that body left the slot. A zero after real games means the rule is not on
   *                     the path -- doubles is full of pivots and this should be common;
   *   reaimSlotEmpty    the aimed slot was empty and the move failed. Showdown retargets instead;
   *                     this is the FILED gap, counted so its size is readable rather than argued;
   *   targetTracksBody  the exception fired -- Stalwart, Propeller Tail or Snipe Shot kept its
   *                     original body. A zero is expected on most runs (44 uses in the corpus) and
   *                     says only that nobody brought one. */
  reaimedToSlot: 0, reaimSlotEmpty: 0, targetTracksBody: 0,
  /* WIRE 140 -- Ally Switch actually swapping two bodies, and the consecutive-use roll refusing one.
   * A zero on the first after real games means the branch is not on the path (202 corpus uses). */
  allySwitchSwapped: 0, allySwitchStalled: 0,
  /* ROADMAP #92 -- CONFUSION, which did not exist in this engine at all until this pass, so every
   * one of these was structurally zero and there was nothing to notice. Each is a different event and
   * a zero on each says a different thing:
   *   confusionSet              a body was actually confused. Zero after real games means the whole
   *                             mechanic is off the path;
   *   confusionMinDuration      the clock was taken at the AUTHORITY'S MINIMUM rather than drawn.
   *                             It equals confusionSet by construction today and is counted anyway,
   *                             because the day somebody wires a real range draw this number is the
   *                             receipt that the floor stopped being taken;
   *   confusionSelfHit          the body hurt itself instead of moving -- the consequence, which is
   *                             the half a counter alone never proves;
   *   confusionExpired          the clock ran out and the volatile was removed. A confusionSet with
   *                             no confusionExpired is the ORIGINAL defect, wearing a counter;
   *   confusionAlreadyOn        a second Confuse Ray refused, so the clock was not extended free;
   *   confusionRefusedByAbility / confusionRefusedBySideBuff  Own Tempo and Safeguard. A zero is
   *                             expected unless one is brought and says only that;
   *   volatileCuredByItem       a Lum or a Persim spent on a volatile rather than on a status. */
  confusionSet: 0, confusionMinDuration: 0, confusionSelfHit: 0, confusionExpired: 0,
  confusionAlreadyOn: 0, confusionRefusedByAbility: 0, confusionRefusedBySideBuff: 0,
  volatileCuredByItem: 0,
  /* ROADMAP #92 -- THE DAMAGE-STAGE CLASS, one counter per family that MOVED STAGE, because moving a
   * multiplier is invisible in a head-to-head (both arms apply it, one arm applies it late) and the
   * only receipt that the new site is on the path is a non-zero here.
   *   bpChainSpent      the `onBasePower` relay was spent with at least one member folded in;
   *   bpChainMembers    how many members went into it, summed -- a 1 forever means nothing co-occurs
   *                     and the CHAIN half of the fix (as against the STAGE half) is untested;
   *   statChainSpent    the ModifyAtk/ModifyDef relay was spent with a member in it;
   *   damageBoostStat   the narrowed `damageBoost` family fired at the stat stage;
   *   helpingHandBP / friendGuardChain  the two hit-site facts reaching the right chain;
   *   critInRange       a crit's x1.5 was applied inside dmgRange, before the roll, where the
   *                     authority applies it -- a zero means the battle loop is still doing it. */
  bpChainSpent: 0, bpChainMembers: 0, statChainSpent: 0, damageBoostStat: 0,
  helpingHandBP: 0, friendGuardChain: 0, critInRange: 0,
  /* ROADMAP #103 -- a REAL TURN priced a multi-hit move off a ROLLED count instead of the 3.1
   * expectation. A zero here with multi-hit moves being clicked means the battle loop stopped handing
   * `hit.hits` over and dmgRange fell back to the expectation, which is precisely the silent default
   * this cluster was: it looks identical to a working feature and is wrong by up to three hits.
   * multiHitAccuracyStopped counts the per-hit accuracy break (Triple Axel, Population Bomb). */
  multiHitRolledCount: 0, multiHitAccuracyStopped: 0,
  perishTicked: 0, perishKO: 0, perishClearedOnSwitch: 0,
  passesStateSwitch: 0, passesStateBoosts: 0, passesStateVolatiles: 0,
  curseGhost: 0, curseNonGhost: 0,
  /* WIRE 132 -- the three recoveries the mega path now makes, each named so a ZERO is readable.
   * megaKeyFromSuffix: the artifact's `megaStone.into` had no answer and the concatenated guess was
   * taken; megaMovesFromBase: a mega row with `mv: []` inherited the base row's moves; 
   * megaAbilityFromSibling: a mega row with no ability took its sibling forme's. */
  megaKeyFromSuffix: 0, megaKeyFromSuffixFirst: '',
  megaMovesFromBase: 0, megaMovesFromBaseFirst: '',
  megaAbilityFromSibling: 0, megaAbilityFromSiblingFirst: '',
  /* WIRE 129 -- a SPREAD move rolled to hit with no defender in hand, so the target's evasion stage,
   * Bright Powder and Sand Veil did not apply to it. A declared divergence from Showdown, which rolls
   * per target; counted rather than commented so the size of it is readable rather than argued. */
  accSpreadNoDefender: 0,
  /* ROADMAP #81 WIRE 9 -- a SPREAD click that arrived with no target named (which is every one of
   * them from a driver reading Showdown's request) and was aimed off the board instead of falling
   * through to a no-op. A zero after real games means the fix is not on the path. */
  spreadClickWithoutNamedTarget: 0,
  /* ROADMAP #84 -- Stomping Tantrum or Temper Flare priced at 150 because last turn's move result was
   * literally `false`. A zero after real games means the move-result split is not reaching dmgRange. */
  powerDoubledAfterFailure: 0,
  /* WIRE 92 -- a voluntary switch refused because a live foe carries `preventsSwitch` (Shadow Tag on
   * Gengar-Mega). A zero here after real games with a Mega Gengar on the field is the finding. */
  trapBlockedSwitch: 0,
  /* WIRE 116 -- a voluntary switch refused by a partial-trapping MOVE (Fire Spin, Infestation,
   * Wrap, Whirlpool, Sand Tomb, Thunder Cage, Magma Storm). Counted apart from the ability above
   * because the two have different exemptions and a merged counter could not tell them apart. */
  trapBlockedSwitchByMove: 0,
  /* WIRE 115 -- a move SECONDARY dropped by the target's Shield Dust. This is the only scope at
   * which Shield Dust acts, so a zero here after games with a Vivillon on the field is the finding;
   * before this pass the ability was refusing direct status moves and Static as well. */
  dustBlockedSecondary: 0,
  /* WIRE 90 -- an entry hazard that RESOLVED on a switch-in (toxic spikes' poison, sticky web's
   * drop). The old MEDFAILS.hazardUnresolved counter is gone because the gap it declared is wired;
   * this is its receipt, so the counter did not merely vanish (docs/ENGINE.md rule). */
  hazardResolvedOnEntry: 0,
  /* ROADMAP #81 WIRE 11 -- a White Herb that actually came off and put a negative stage back to
   * zero. It fires at four triggers now (switch-in, mega, after every action, residual) and had one
   * before; a zero here after real games with a Sneasler or an Incineroar on the field is the
   * finding, not the absence of the finding. */
  statsRestoredByItem: 0,
  /* WIRE 3 -- the one refusal gate fired. A ZERO here means every Clear Body, Hyper Cutter and
   * Inner Focus in the run took its drop, which is what the engine did before the gate existed. */
  statDropRefused: 0,
  /* WIRE 117 -- a Psychic Terrain priority bar that was NOT applied because the body being aimed at
   * is airborne. Before this wire the terrain refused priority against everything on the field, so
   * this branch could not fire at all. */
  terrainSparedAirborne: 0,
  /* WIRE 117 -- the Grassy Terrain heal SKIPPED because the body is not grounded. This is the
   * receipt for MEDFAILS.terrainHealUngrounded, which is gone: that counter existed to declare that
   * the Levitate and Air Balloon halves of this test were known-wrong and applied anyway. The gap is
   * wired, so the failure counter is replaced by a capability counter rather than deleted
   * (docs/ENGINE.md rule -- a counter must not merely vanish). */
  terrainHealSkippedAirborne: 0,
  /* WIRE 119 -- a move REFUSED at execution time by a category-forbidding volatile (Taunt). This is
   * the half the interaction matrix was failing on: the holder clicks Taunt in the same turn, so the
   * target's already-chosen status move has to FAIL when it runs. A zero here after games with a
   * Taunt in them is the finding. */
  tauntRefusedAtExecution: 0,
  /* WIRE 119 -- a status move taken OFF THE MENU before it could be chosen, the other half of the
   * same mechanic (Showdown's `onDisableMove`). Counted apart from the execution refusal because the
   * two fire in different places and a merged counter cannot say which one is dead. */
  tauntRefusedAtSelection: 0,
  /* ROADMAP #31 -- MEGA EVOLUTION AS A MID-TURN CHOICE. Four counters because four different things
   * can be dead and a merged one could not tell them apart, and because mega has already passed an
   * "at least one happened" check in this project while firing on 56% of the sides it should have.
   *   megaCapableBuilt   buildMon handed back a BASE forme carrying a stone -- the capability exists
   *   megaEvolved        an evolution actually resolved in a turn
   *   megaEvolvedSlotB   ...from the RIGHT-HAND slot, counted apart because the last mega defect in
   *                      this project was "the base class could only mega from the LEFT slot"
   *   megaEvolvedAuto    the engine chose it itself rather than being told (S._autoMega) */
  megaCapableBuilt: 0, megaEvolved: 0, megaEvolvedSlotB: 0, megaEvolvedAuto: 0,
  /* WIRE 133 -- THE ELEVEN MECHANICS THIS PASS ARMED, each with a name so a ZERO reads as the finding
   * it is (CLAUDE.md: a capability that cannot prove it ran is assumed broken).
   *   switchOutTrigger    an ability fired because a body LEFT the field -- the class, not a member;
   *   switchOutCure       Natural Cure specifically, which did not exist here at all;
   *   formeSwapped        a body changed forme; formeAnnouncedOnReturn is the `-activate` that goes
   *                       with it, counted apart because the two are different moments and reading
   *                       the announcement as the mechanic is what put Zero to Hero in the wrong one;
   *   moodyRolled         a random-boost residual actually rolled;
   *   punishBurned        a boosted target was punished for having boosted;
   *   instructRepeat      an ally took a SECOND action in one turn;
   *   dualPurposeHeal     Pollen Puff resolved as a heal because it was aimed at an ally;
   *   sideBuffRefused     Safeguard refused a status the other side tried to write;
   *   itemRoomHidden      Magic Room parked an item;
   *   wonderRoomSwap      a damage calculation read the SWAPPED defence;
   *   powerDoubledOnRead  Avalanche/Assurance/Payback doubled off a condition they can now read. */
  /* WIRE 134 -- a speed tie was actually resolved, and how big the largest tied group was. A ZERO
   * after real games would mean the selection sort never recognised a tie, which is the shape of the
   * defect it replaces: `Array.prototype.sort` swallowed every tie silently for the life of this
   * project and nothing counted them. */
  speedTieResolved: 0, speedTieLargestGroup: 0,
  switchOutTrigger: 0, switchOutCure: 0, formeSwapped: 0, formeAnnouncedOnReturn: 0,
  /* WIRE 136 -- a forme change performed as a RENAME because the target forme has no row and the
   * artifact states it is identical to the base in stats and types. Mimikyu-Busted is the one. */
  formeRenamedNoRow: 0,
  /* WIRE 137 -- a status move whose named target had left the field and was re-aimed at the body now
   * standing in that slot. A move targets a SLOT; this counts how often that actually bites.
   * WIRE 139 SUBSUMED IT: the status branch now asks the shared `reaimToSlot`, which counts every
   * branch on `reaimedToSlot`. Kept at 0 rather than deleted because it is a published figure and a
   * silently vanishing counter is worse than a visibly retired one. */
  statusReaimedToSlot: 0,
  moodyRolled: 0, punishBurned: 0, punishConfused: 0, instructRepeat: 0, dualPurposeHeal: 0,
  sideBuffRefused: 0, itemRoomHidden: 0, wonderRoomSwap: 0, powerDoubledOnRead: 0,
  /* WIRE 141 -- the TRANSFORM, counted apart from `formeSwapped` because it is a different mechanic
   * wearing the same word: a forme swap becomes a KNOWN row and a transform becomes an ARBITRARY
   * opposing body. `transformedOnEntry` is the copy landing; `transformRefusedNoBody` is the entry
   * with nothing to copy, which is the mechanic's own negative and must not read as a failure. */
  transformedOnEntry: 0, transformRefusedNoBody: 0, transformRefusedAlready: 0,
  /* WIRE 141 -- a forme that flipped on the CLOCK (Hunger Switch). A zero after real games with a
   * Morpeko in them means the residual block never reached the ability.
   * flingThrown / flingRefused are the two halves of Fling and are counted APART because the refusal
   * IS the mechanic on a body holding its own mega stone -- a fail that could not be told from a
   * mechanic that never fired is exactly the silent default this project keeps meeting. */
  formeCycled: 0, flingThrown: 0, flingRefused: 0,
  /* ROADMAP #111 -- THE DURATION FAMILY, five counters, because every one of them was a place the old
   * code was silently doing nothing and reporting success:
   *   volDurationApplied    a counter was written THROUGH the shared model (Taunt, Encore, Disable,
   *                         Cursed Body). A zero after real games means the model is unreachable;
   *   volDurationTicked     a residual actually spent one. Encore's read zero in every scripted game
   *                         ever played here, because its only tick lived in the chooser;
   *   volDurationExpired    a clock reached zero and the volatile came OFF with its side fields;
   *   volRestartRefused     a second click into a body already carrying it, refused rather than
   *                         refreshing the counter -- the Taunt row;
   *   volSealNoLastMove     Encore or Disable refused against a target that has never moved. THE
   *                         DISABLE HALF OF THIS HAD NEVER FIRED AT ALL, and it is the whole of the
   *                         `showdown=0 ours=4` turn-1 row. */
  volDurationApplied: 0, volDurationTicked: 0, volDurationExpired: 0,
  volRestartRefused: 0, volSealNoLastMove: 0 };
const MEDFAILS = { encoreAction: 0, megaRevert: 0, weatherUnknown: 0, weatherUnknownFirst: '',
  /* ROADMAP #92 -- MISTY TERRAIN ALSO REFUSES CONFUSION to a grounded body, and this engine has no
   * per-terrain volatile refusal to hang that on. 9 corpus uses. Counted every time confusion is
   * written while misty terrain is up, so the size of the gap is a number in the run rather than a
   * sentence in a comment that nobody re-checks. */
  confusionMistyUnmodelled: 0,
  /* WIRE 133 -- the three ways the switch-out class can be WRONG rather than absent, each named:
   *   switchOutTriggerUnhandled  an ability declares `onSwitchOut` and the derivation could not say
   *                              what it DOES. A silent default here would look exactly like a
   *                              working feature, which is the whole reason this counter exists;
   *   formeSwapNoRow             the target forme has no row in the mon table, so nothing swapped;
   *   formeSwapLateOnReturn      a body came back still carrying the base forme -- the switch-out
   *                              trigger did not run and bringIn had to cover for it. A non-zero
   *                              here is a bug report about this file, not about the format. */
  switchOutTriggerUnhandled: 0, switchOutTriggerUnhandledFirst: '',
  formeSwapNoRow: 0, formeSwapNoRowFirst: '',
  formeSwapLateOnReturn: 0, formeSwapLateOnReturnFirst: '',
  /* WIRE 133 -- a `punishesBoostedTarget` member whose effect this engine cannot land. Alluring Voice
   * is the one: its punishment is CONFUSION and this engine holds no confusion volatile at all. The
   * condition fires, the effect does not, and that is counted rather than skipped in silence. */
  punishEffectUnmodelled: 0, punishEffectUnmodelledFirst: '',
  /* WIRE 135 -- a `needsTargetToAttack` member whose `when` this engine cannot evaluate. Nothing
   * defaults to doubling here: a free x2 on a priority move is an error a rollout cannot recover. */
  needsTargetWhenUnknown: 0, needsTargetWhenUnknownFirst: '',
  /* WIRE 136 -- a `formeOnHit` member whose target forme has NO row in the mon table and whose stats
   * are NOT identical to the base's. Ice Face is the one; renaming it without rebuilding would put a
   * body on the board with the wrong stats, so it is refused and counted. Fixing it means a row in
   * `data/engine-data.js`, which is downstream of this division. */
  formeOnHitNoRow: 0, formeOnHitNoRowFirst: '',
  /* WIRE 141 -- a `formeCycleResidual` member whose two formes are NOT identical in stats and types
   * AND whose target forme has no row. Zero members today (Hunger Switch is the whole class and its
   * pair is identical), so a non-zero here is a new carrier arriving, not a Morpeko. */
  formeCycleNoRow: 0, formeCycleNoRowFirst: '',
  /* WIRE 141 -- a flung item whose `fling.volatileStatus` is something this engine cannot land. The
   * only volatile any legal item names is `flinch`, which IS modelled, so this reads 0 today and a
   * non-zero means a new member arrived rather than that Fling is broken. */
  flingEffectUnmodelled: 0, flingEffectUnmodelledFirst: '',
  /* ROADMAP #81 WIRE 12 -- an `auraBoost` row whose multiplier is not a [num,den] pair. The artifact
   * carried the lossy float `1.33` until this wire and `md4096` truncs it to 5447/4096, so applying
   * it would be one 4096th wrong on every Fairy move in the format and would look exactly like the
   * wire working. Refused rather than approximated, and counted so a refusal is readable.
   * ROADMAP #81 WIRE 12 -- a `perishClock` row with no `turns`. The number used to be typed into this
   * file as `||3`, which is the wrong number AND a silent default; there is no fallback now. */
  auraMultUnusable: 0, auraMultUnusableFirst: '',
  /* ROADMAP #111 -- the duration table could not be built. An empty table is EXACTLY what this engine
   * looked like before the wire (three volatiles that never expire on their own), so it must not be
   * indistinguishable from it. */
  volDurTableFailed: 0, volDurTableFailedFirst: '',
  perishTurnsMissing: 0,
  /* ROADMAP #103 -- the two ways `rollHitsOf` can be asked a question the artifact cannot answer.
   * multiHitRangeNot2To5: a multi-hit range the authority resolves with `random(min,max+1)` rather
   * than its 2-5 sample table. Zero members in this format today, so a non-zero is a new move
   * arriving -- and its two engines DISAGREE under the pin, which is why it must be visible.
   * multiHitNoCount: a `multiHit` row with neither a range nor a `hits`. One hit is dealt and said
   * out loud, because a silent 1 here is exactly the defect WIRE 20 fixed. */
  multiHitRangeNot2To5: 0, multiHitRangeNot2To5First: '',
  multiHitNoCount: 0, multiHitNoCountFirst: '',
  /* ROADMAP #81 WIRE 12 -- a `passesState` click that could not switch (an empty bench). Showdown's
   * Baton Pass and Shed Tail both `-fail` outright in that case; this counts how often it happens so
   * "the pivot never fired" and "the pivot had nowhere to go" are different readings. */
  passesStateNoBench: 0,
  /* WIRE 132 -- a mega row this dataset cannot complete. megaRowNoMoves is a body that threatens
   * NOTHING and reads to every scorer as harmless; megaRowNoAbility is a mega with no ability at
   * all; megaIntoNoTable means the tag artifact could not be asked and every mega key is a guess. */
  megaRowNoMoves: 0, megaRowNoMovesFirst: '',
  megaRowNoAbility: 0, megaRowNoAbilityFirst: '',
  megaIntoNoTable: 0, megaIntoNoTableFirst: '',
  /* ROADMAP #31 -- a body HOLDING a mega stone that this dataset cannot evolve, because megaKeyFor
   * resolved no MC.mons row. It keeps its BASE ability and never megas, which is a silent hole
   * exactly the size of that species' usage. Reads 0 over all 74 stones in this format. */
  megaStoneNoRow: 0, megaStoneNoRowFirst: '',
  /* ROADMAP #31 -- the mega row carries no base stats, so the forme swap could not move the stat
   * block and the body megas with its BASE numbers. Loud, because that is a mega in name only. */
  megaNoBaseStats: 0, megaNoBaseStatsFirst: '',
  /* WIRE 124 -- a move whose accuracy NEITHER data/move-effects.js NOR the ACC_FIX correction list
   * knows. It falls back to 100, which is indistinguishable from a never-miss move, and that
   * indistinguishability is the whole bug this wire fixed: for 78 moves the fallback WAS the answer.
   * Reads 0 over all 500 moves in MC.moves today. */
  accuracyUnknown: 0, accuracyUnknownFirst: '',
  /* WIRE 124 -- data/move-effects.js could not be loaded AT ALL, so no move has an accuracy and the
   * whole game becomes never-missing. A different and much larger failure than the row above, so it
   * is a different counter and it keeps the exception's own message. */
  accuracyNoTable: 0, accuracyNoTableFirst: '',
  /* WIRE 129 -- an ability or item that data/abra-tags.js says TOUCHES ACCURACY and ACCMOD has no row
   * for. It is applied as nothing, which is exactly what the pre-wire engine did for all of them, so
   * the fallback is indistinguishable from the bug and has to announce itself. Reads 0 across every
   * accuracyMod / writesAccuracy carrier in the artifact today; a non-zero means the format grew a
   * carrier and its evasion or accuracy bonus is silently absent. */
  accModUntabled: 0, accModUntabledFirst: '',
  /* WIRE 129 -- an ACCMOD row named a CONDITION _accWhen cannot evaluate. It resolves to false (the
   * modifier does not fire), which is the safe direction and the invisible one, so it is counted. */
  accModUnknownWhen: 0,
  /* WIRE 125 -- the side's ROSTER was not available at the end-of-turn death recount, so the count
   * fell back to the active+bench arrays, which is the expression that lost the dead in the first
   * place. battleInit always stamps `sf.team`, so this must read 0; a non-zero means a battle state
   * was built by some other route and its Last Respects / Supreme Overlord numbers are undercounts. */
  fallenNoRoster: 0,
  /* WIRE 119 -- the artifact named a forbidden move CATEGORY this engine has no predicate for, so the
   * move was allowed through. Today the only member is Taunt's "Status" and this must read 0; a
   * non-zero means `forbidsStatusMoves` grew a category and the gate is silently passing it. */
  forbidCategoryUnknown: 0, forbidCategoryUnknownFirst: '',
  /* WIRE 119 -- the forbid table itself could not be built. It would return EMPTY, which is
   * indistinguishable from the pre-wire engine in which Taunt did nothing at all, so the failure is
   * counted rather than swallowed. */
  forbidTableFailed: 0, forbidTableFailedFirst: '',
  /* A heal whose SIZE no artifact this engine reads can state — Rest (full, plus sleep), Synthesis /
   * Moonlight / Morning Sun (weather-dependent), Wish (delayed a turn), Healing Wish (the user
   * faints), Swallow (needs Stockpile), Strength Sap (scales off the TARGET's Attack). The tag says
   * `heal: true`, which is a boolean in a fraction's clothing. Counted so "these do nothing" is a
   * READABLE claim rather than a silent default. */
  healProcedural: 0, healProceduralFirst: '',
  /* ROADMAP #102 -- a `fromTargetStat` this engine cannot map onto a stat slot. `SD2ENG` covers all
   * five, so a non-zero here means the artifact grew a sixth name and the heal was refused rather
   * than sized from a stat that does not exist. */
  healFromStatUnreadable: 0, healFromStatUnreadableFirst: '',
  /* ROADMAP #101 -- a `buffsHolderOnHit` whose `when` this engine cannot evaluate. Four shapes are
   * readable (crit, moveType, moveCategory, moveFlag) and `when: null` is unconditional; anything
   * else REFUSES the buff and lands here. Refusing is the safe direction only because the defect
   * this replaces failed OPEN -- Anger Point maxed Attack off any connecting hit. */
  buffOnHitUnknownCond: 0, buffOnHitUnknownCondFirst: '',
  /* ROADMAP #101 -- a `buffsHolderOnHit` member whose payload is a VOLATILE and not a boost table:
   * electromorphosis and windpower bank `charge` (nothing in this engine multiplies an Electric move
   * by it) and perishbody grants `perishsong` (the clock exists, but its DURATION is carried by the
   * MOVE's `perishClock` tag and no ability states one). The old guard dropped all three silently;
   * they are now counted at the moment the condition HOLDS, so the number is "buffs this engine
   * owed and did not pay" rather than "carriers on the board". */
  buffOnHitVolatileUnwired: 0, buffOnHitVolatileUnwiredFirst: '',
  /* ROADMAP #81 WIRE 9 -- a damaging click that could not be aimed at anything and therefore fell
   * through to the status chain, where it becomes a no-op turn. Reachable three ways: a SINGLE-target
   * move with the target withheld (which Showdown rejects as a choice), a `randomNormal` or
   * `scripted` move whose target Showdown picks with a die this engine does not model, and a body
   * that never went through battleInit so it has no board to read. Counted rather than swallowed,
   * because the swallowing is exactly what hid 56,524 uses of the spread family. */
  damagingClickWithoutTarget: 0, damagingClickWithoutTargetFirst: '',
  /* A Magic Guard body that took the sandstorm residual anyway (WIRE 31). It blocks indirect damage
   * through `onDamage`, which no derivation in tag_dex reads, so the ability carries `untagged` and
   * the chip cannot see it. Counted rather than name-checked -- see the comment at WIRE 31. */
  magicGuardChip: 0,
  /* A terrain string neither vocabulary recognises (see terrainId). Returning the raw value is what
   * made the weather bug: truthy, and matching nothing. */
  terrainUnknown: 0, terrainUnknownFirst: '',
  /* A `critRatioUp` carrier this engine deliberately does NOT read (WIRE 35). The tag's only param is
   * `critRatio: 2`, which cannot express Merciless's condition -- it is a GUARANTEED crit into a
   * poisoned target, not a permanent stage bump -- and Super Luck, which genuinely is a permanent
   * bump, is indistinguishable from it in the artifact. Wiring both would hand Merciless an
   * unconditional 1/8 it never has. 15 corpus uses between them; counted rather than name-checked. */
  critRatioAbility: 0,
  /* A `damageReduce` carrier whose `onlyWhen` this engine cannot evaluate (WIRE 36). Ripen carries
   * `damageMult: 0.5, onlyWhen: null` and is not a damage cut at all -- it DOUBLES berry effects --
   * so the derivation over-matched and the consumer refuses anything it cannot name a condition for. */
  damageReduceUnknown: 0, damageReduceUnknownFirst: '',
  /* ROADMAP #112 -- the same refusal on the OTHER side of the damage chain. A `damageBoost` carrier
   * whose `onlyWhen` this engine cannot evaluate is refused, not guessed.
   *
   * THIS COUNTER READS ZERO TODAY AND THAT IS THE CORRECT VALUE, which is worth stating because a
   * zero counter is normally this project's signature symptom. Every `onlyWhen` in the artifact is
   * now an `hpFraction` structure, so nothing reaches the null branch: Blaze, Torrent, Overgrow and
   * Swarm used to be refused here and now evaluate. The abilities still NOT served -- Analytic,
   * Rivalry, Reckless, Stakeout -- are refused one clause EARLIER, by `_db.onType`, because they
   * carry `onlyWhen: null` and name no type; their conditions are absent from the artifact rather
   * than unreadable in it. The counter exists so that the next condition kind added upstream cannot
   * be silently dropped on the floor here. */
  damageBoostUnknownCond: 0, damageBoostUnknownCondFirst: '',
  /* WIRE 91 -- a `speedCond` carrier whose condition is NOT in its params (`inWeather: []`): Quick
     Feet (a status condition), Surge Surfer (a terrain), Slow Start (a turn clock). Applying the bare
     multiplier would be Quick Feet x1.5 forever, so they are refused and counted. The enrichment
     (deriving the condition kind out of the handler) is STAGED in tag_dex. */
  speedCondUnconditional: 0, speedCondUnconditionalFirst: '',
  /* WIRE 93 -- a `priorityMod` whose `condition` prose this engine cannot evaluate. The only value in
     the artifact today is Gale Wings' 'only at full HP', which IS evaluated; anything else fails
     closed (no shift) and is counted, because a silently applied conditional shift is a wrong number
     in whatever direction the unknown condition points. */
  priorityModUnknownCond: 0, priorityModUnknownCondFirst: '',
  /* WIRE 117 -- `terrainHealUngrounded` LIVED HERE and is gone, wired rather than declared. It
     counted a Levitate body that Grassy Terrain healed anyway, and its own comment said WIRE 90 had
     already made the derivation available. Its replacement is MEDSEEN.terrainHealSkippedAirborne,
     which counts the same event now that the engine gets it right. */
  /* WIRE 117 -- grounded-ness asked of a body that carries no `types` list, so only the ability
     clause could be evaluated. board.js maps its priority defenders to `{ability, fainted}` and is
     not ENGINE's file to change; a Flying type read through that path is still over-refused, and
     this is that gap being loud instead of silent. */
  groundedBodyIncomplete: 0, groundedBodyIncompleteFirst: '',
  /* A `convertsMoveType.converts` string this engine cannot parse (WIRE 75). The artifact writes either
     a capitalised TYPE ("Normal moves"), a lowercase FLAG ("sound moves") or "its moves"; anything
     else would silently mean "the ability does not apply", which is how Liquid Voice was inert. */
  convertsUnparsed: 0, convertsUnparsedFirst: '',
  /* WIRE 83. A `variablePower` or `conditionalPower` rule the artifact NOW states and this engine
     still cannot evaluate: Lash Out needs "was I stat-dropped this turn", Rage Fist needs a per-mon
     times-hit counter, Last Respects' own counter is handled by powerFromFallen. Counted with the
     first offender named, because the alternative -- falling through to the base power -- is exactly
     the silent default that made these 35 of the interaction matrix's divergences. */
  variablePowerUnknown: 0, variablePowerUnknownFirst: '',
  /* WIRE 83. A speed ratio asked of a body whose SIDE is unknown, so Tailwind cannot be applied to
     it. Only a bare dmgRange call outside a battle can produce this; the battle loop stamps
     `_sf.side` on every body. Loud, because a Tailwind silently missing from one side of a ratio is
     a Gyro Ball that is wrong by a factor of two. */
  speedSideUnknown: 0,
  /* WIRE 89. A secondary whose CHANCE differs between the two rulebooks -- the format-derived
     `data/tags.json` and the generic `CHOMP/data/move-effects.json`. The format wins. Counted with
     the first offender named, because there are exactly two today (Iron Head, Toxic Thread) and a
     third arriving unannounced is the whole failure mode two rulebooks have. */
  rulebookChanceDrift: 0, rulebookChanceDriftFirst: '',
  /* WIRE 123. Two leads arriving on the same speed. Showdown breaks that with a coin (speedSort's
     Fischer-Yates); battleInit is handed no rng, so it keeps declaration order and counts the event.
     Non-zero is not a bug — it is the share of battle starts whose entry-ability order this engine
     could not decide, and for two Drizzle bodies on the same speed it decides the weather. */
  entryOrderTie: 0,
  /* ROADMAP #68. A trace emit asked for the slot of a body that is in neither active array. The line
     is still emitted, with `??` where the identifier goes, because a HOLE in the stream is worse than
     a wrong label -- a missing line reads to the differ as a missing MECHANIC. Must read 0. */
  traceBodyOffField: 0, traceBodyOffFieldFirst: '' };

/* ================= THE SHOWDOWN-SHAPED PROTOCOL TRACE — ROADMAP #68, step one ====================
 *
 * WHY. The whole-game differential (docs/GAME-DIFFERENTIAL-DESIGN.md §5) compares two engines by
 * diffing their EVENT STREAMS rather than their end-of-turn state, because Showdown's protocol log is
 * already a step-level trace LABELLED WITH THE MECHANISM THAT MADE EACH DECISION. A missing
 * `|-unboost|` is Intimidate; an out-of-order `|move|` pair is turn order; an absent `|-enditem|` is
 * the Sash. Showdown emits one. This engine emitted nothing, so there was nothing to diff.
 *
 * OFF BY DEFAULT AND THE HOT PATH DOES NOT PAY. `TR` is a module-level `let` that is null unless a
 * caller asked for a trace, and every emit site is `if(TR)TR.x(...)` -- one global load and a falsy
 * test. It is armed by `battleInit(A,B,{trace:[]})` (or by setting `S._trace` directly) and is
 * re-bound at the top of every `battleTurn` and cleared on the way out, so a rollout leaf that shares
 * this module cannot inherit somebody else's sink.
 *
 * IDENTIFIERS ARE IDS, AND THAT IS A DECISION RATHER THAN AN OMISSION. Showdown writes display names
 * -- `p1a: Incineroar`, `Fake Out`, `Sitrus Berry`, `SunnyDay`. This engine holds ids -- `incineroar`,
 * `fakeout`, `sitrusberry`, `sunnyday` -- and has no display-name table at all. Inventing one would be
 * a TRANSLATION LAYER THAT CAN ITSELF BE WRONG, which is the failure this instrument exists to
 * remove. So the GRAMMAR is Showdown's exactly (event name, argument order, `[from]`/`[of]` tags,
 * `n/max` health, `0 fnt`) and the NAMES inside are ids. `traceCanon()` below is the ONE normaliser,
 * and the comparison driver applies it to BOTH streams -- Showdown's `Fake Out` and this engine's
 * `fakeout` both canonicalise to `fakeout`. One symmetric canonicalisation is not a translation.
 *
 * THE SHAPES CAME OUT OF THE FORMAT, NOT OUT OF PROTOCOL.md. `data/mods/champions/scripts.ts:271`
 * overrides the base emit: this format writes `|-supereffective|p2b: Tyranitar|1`, with an
 * effectiveness magnitude the generic protocol has no third argument for. Every shape below was read
 * off a real `battle.log` from `Dex.forFormat('gen9championsvgc2026regmb')` -- CLAUDE.md's "the ban is
 * a MECHANISM, read it from the FORMAT" rule, one field over.
 *
 * COUNTERS ARE DERIVED FROM THE STREAM, NOT KEPT BESIDE IT. `traceCounts(lines)` parses the lines it
 * is handed. A counter maintained separately is a second implementation of "what did we emit" and
 * would eventually disagree with the thing it counts. */
let TR=null;
const TRACE=(function(){
  const SLOTCH=['a','b','c','d'];
  /* Both maps are INVERTED FROM THE ENGINE'S OWN, first key wins, rather than typed a second time --
   * SD2WEATHER carries `snow` and `hail` as aliases of `snowscape` and declaration order picks the
   * protocol's spelling. Built lazily because those tables are declared further down this file. */
  let _E2S=null,_E2W=null,_E2T=null;
  const inv=src=>{const o={};for(const k in src)if(!(src[k] in o))o[src[k]]=k;return o;};
  const sdStat   =k=>{if(!_E2S)_E2S=inv(SD2ENG);       return _E2S[k]||k;};
  const sdWeather=w=>{if(!_E2W)_E2W=inv(SD2WEATHER);   return _E2W[w]||w;};
  const sdTerrain=t=>{if(!_E2T)_E2T=inv(SD2TERRAIN);   return _E2T[t]||t;};
  /* THE IDENTIFIER IS THE NICKNAME, AND IT DOES NOT FOLLOW THE FORME. Showdown's `|switch|p1a: X`
   * field is `pokemon.name` -- the SET's name -- and `formeChange()` never touches it: a Tyranitar
   * that megas keeps emitting `p1a: Tyranitar` for the rest of the battle, and the new forme appears
   * only in the `|detailschange|` DETAILS field. This engine keyed the identifier off `m.name`, which
   * IS the forme, so every line after a forme change would have named a body Showdown never named.
   *
   * It was unreachable before mega evolution existed in-battle, with ONE exception that was already
   * live: Zero to Hero rewrites `m.name` to `palafin-hero` inside bringIn(), so a Palafin that
   * pivoted parted the two streams on every subsequent line it appeared in.
   *
   * `_ident` is stamped by buildMon and re-stamped for anything battleInit is handed that lacks one,
   * so a hand-built body in a probe cannot arrive without it. */
  const identName=m=>(m&&m._ident)||(m&&m.name)||'?';
  function ident(m){
    if(!m)return '??';
    const S=TR&&TR.S;
    if(S){
      let i=S.actA?S.actA.indexOf(m):-1; if(i>=0)return 'p1'+(SLOTCH[i]||'?')+': '+identName(m);
      i=S.actB?S.actB.indexOf(m):-1;     if(i>=0)return 'p2'+(SLOTCH[i]||'?')+': '+identName(m);
    }
    MEDFAILS.traceBodyOffField++;
    if(!MEDFAILS.traceBodyOffFieldFirst)MEDFAILS.traceBodyOffFieldFirst=String((m&&m.name)||'');
    return '??: '+((m&&m.name)||'?');
  }
  /* `n/max`, `n/max status`, or `0 fnt` — sim/pokemon.ts:2065 getHealth, including the status suffix
   * at :2103 which the protocol document does not spell out. */
  function health(m){
    if(!m||!m.st)return '?';
    if(m.curHP<=0||m.fainted)return '0 fnt';
    return m.curHP+'/'+m.st.hp+(m.status?' '+m.status:'');
  }
  const sideOf=m=>{const S=TR&&TR.S;if(!S)return 'p1';return (S.actB&&S.actB.indexOf(m)>=0)?'p2':'p1';};
  const T={
    S:null, out:null,
    /* Showdown splits a chosen switch (`|switch|`) from a forced one (`|drag|`). This engine reaches
     * both through the single bringIn() path -- deliberately, WIRE 40 -- so the caller raises this
     * flag around a phaze and lowers it after. A flag rather than an argument because bringIn has four
     * call sites and three of them are not switches at all. */
    drag:false,
    push(parts){ this.out.push('|'+parts.filter(x=>x!=null&&x!=='').join('|')); },
    /* --- the turn frame --- */
    turn(n){ this.push(['turn',n]); },
    upkeep(){ this.push(['upkeep']); },
    /* --- actions --- */
    mv(user,id,target,extra){ this._mvLine=this.out.length; this.push(['move',ident(user),id,target?ident(target):'',extra]); },
    /* Showdown's own `attrLastMove` (sim/battle.ts:3120): an attribute is APPENDED to the `|move|`
     * line already in the log rather than emitted as a new event, and `[still]` additionally BLANKS
     * the target field. Reproduced here rather than approximated, because a differ aligning two
     * streams line by line would otherwise see an extra event on one side. */
    attr(s){ if(this._mvLine==null||this._mvLine>=this.out.length)return; this.out[this._mvLine]+='|'+s; },
    attrStill(){ if(this._mvLine==null||this._mvLine>=this.out.length)return;
      const p=this.out[this._mvLine].split('|'); p[4]=''; this.out[this._mvLine]=p.join('|')+'|[still]'; },
    _mvLine:null,
    cant(m,reason,id,of){ this.push(['cant',ident(m),reason,id,of?'[of] '+ident(of):'']); },
    prep(m,id){ this.push(['-prepare',ident(m),id]); },
    recharge(m){ this.push(['-mustrecharge',ident(m)]); },
    fail(m,what){ this.push(['-fail',ident(m),what]); },
    /* A REFUSED STAT DROP IS AN ANNOUNCEMENT, and Showdown writes it in two shapes depending on
     * whether the refuser blocks EVERY stat or one named stat (data/abilities.ts, verified live):
     *     |-fail|p2a: Metagross|unboost|[from] ability: Clear Body|[of] p2a: Metagross
     *     |-fail|p2b: Gallade|unboost|Attack|[from] ability: Inner Focus|[of] p2b: Gallade
     * push() drops an empty field, so the blanket shape falls out of the same call with no label.
     * The ability is passed as an ID: traceCanon folds case, spaces and hyphens on every field from
     * 2 up, so `ability: clearbody` and `ability: Clear Body` are the same string to the differ and
     * this engine does not need a display-name table it would have to keep true. */
    failUnboost(m,label,ab){ this.push(['-fail',ident(m),'unboost',label||'',
                                       '[from] ability: '+ab,'[of] '+ident(m)]); },
    miss(src,tgt){ this.push(['-miss',ident(src),tgt?ident(tgt):'']); },
    act(m,eff,extra){ this.push(['-activate',ident(m),eff,extra]); },
    actOf(m,eff,of){ this.push(['-activate',ident(m),eff,of?'[of] '+ident(of):'']); },
    /* WIRE 133 -- `of` is Instruct's `[of] SOURCE`: `this.add('-singleturn', target, 'move: Instruct',
     * '[of] ' + source)` (data/moves.ts:9665). The instructed body is the SUBJECT and the instructor
     * is the attribution, which is the opposite way round from most `[of]` lines and is why it is
     * spelled out here. */
    st1(m,eff,of){ this.push(['-singleturn',ident(m),eff,of?'[of] '+ident(of):'']); },
    /* --- the hit --- */
    eff(m,mult){ if(mult>1)this.push(['-supereffective',ident(m),Math.min(Math.round(Math.log2(mult)),2)]);
                 else if(mult>0&&mult<1)this.push(['-resisted',ident(m),Math.min(Math.round(-Math.log2(mult)),2)]); },
    crit(m){ this.push(['-crit',ident(m)]); },
    imm(m,from){ this.push(['-immune',ident(m),from]); },
    dmg(m,from,of){ this.push(['-damage',ident(m),health(m),from,of?'[of] '+ident(of):'']); },
    heal(m,from,of){ this.push(['-heal',ident(m),health(m),from,of?'[of] '+ident(of):'']); },
    faint(m){ if(m._traceFainted)return; m._traceFainted=true; this.push(['faint',ident(m)]); },
    /* --- stages, status, volatiles --- */
    bst(m,eng,d,from){ if(!d)return;
      this.push([d>0?'-boost':'-unboost',ident(m),sdStat(eng),Math.abs(d),from]); },
    clearAll(){ this.push(['-clearallboost']); },
    /* ROADMAP #81 WIRE 11 -- `[silent]` is the item handler's own third field:
     * `this.add('-clearnegativeboost', pokemon, '[silent]')` (data/items.ts, whiteherb onUse). This
     * emitter existed and had no caller until the herb gained its three missing triggers. */
    clearNeg(m){ this.push(['-clearnegativeboost',ident(m),'[silent]']); },
    sta(m,s,from){ this.push(['-status',ident(m),s,from]); },
    /* WIRE 133 -- `extra` is Natural Cure's `[silent]`, which is the authority's own FIFTH field:
     * `this.add('-curestatus', pokemon, pokemon.status, '[from] ability: Natural Cure', '[silent]')`
     * (data/abilities.ts:2874). Dropping it would part the two streams on a line we do emit. */
    cure(m,s,from,extra){ this.push(['-curestatus',ident(m),s,from,extra]); },
    vstart(m,eff,extra){ this.push(['-start',ident(m),eff,extra]); },
    vend(m,eff){ this.push(['-end',ident(m),eff]); },
    /* --- items and abilities --- */
    item(m,it,from){ this.push(['-item',ident(m),it,from]); },
    enditem(m,it,tag,of){ this.push(['-enditem',ident(m),it,tag,of?'[of] '+ident(of):'']); },
    ab(m,a,extra){ this.push(['-ability',ident(m),a,extra]); },
    /* --- the field --- */
    wx(w,from,of,up){ this.push(['-weather',sdWeather(w),from,of?'[of] '+ident(of):'',up?'[upkeep]':'']); },
    wxNone(){ this.push(['-weather','none']); },
    terrainStart(t,from,of){ this.push(['-fieldstart','move: '+sdTerrain(t),from,of?'[of] '+ident(of):'']); },
    terrainEnd(t){ this.push(['-fieldend','move: '+sdTerrain(t)]); },
    fstart(cond,of){ this.push(['-fieldstart','move: '+cond,of?'[of] '+ident(of):'']); },
    fend(cond){ this.push(['-fieldend','move: '+cond]); },
    /* SIDE is `p1: NAME` in Showdown. This engine has no player names, so the id alone is emitted and
     * traceCanon() reduces Showdown's `p1: A` to `p1:` — see the canon rule for the `: ` split. */
    sstart(m,cond){ this.push(['-sidestart',sideOf(m)+': ','move: '+cond]); },
    /* WIRE 133 -- the same line with the label VERBATIM. Showdown is not uniform here: Reflect,
     * Safeguard, Spikes and Mist announce a bare name while Light Screen, Aurora Veil, Stealth Rock,
     * Sticky Web, Tailwind and Toxic Spikes announce `move: NAME`. `sstart` above hard-codes the
     * prefix, so it can only be right for one half; this emitter takes whatever the condition's own
     * `-sidestart` call says, which the `sideBuff` tag now carries as `startsAs`. */
    sstartLabel(m,label){ this.push(['-sidestart',sideOf(m)+': ',label]); },
    send(m,cond){ this.push(['-sideend',sideOf(m)+': ','move: '+cond]); },
    sstartSide(sd,cond){ this.push(['-sidestart',sd+': ','move: '+cond]); },
    sendSide(sd,cond){ this.push(['-sideend',sd+': ','move: '+cond]); },
    /* Showdown's `retargetLastMove` (sim/battle.ts:3140): redirection REWRITES the target field of
     * the move line already in the log. Not a new event, so the trace must not invent one. */
    retarget(m){ if(this._mvLine==null||this._mvLine>=this.out.length)return;
      const p=this.out[this._mvLine].split('|'); p[4]=ident(m); this.out[this._mvLine]=p.join('|'); },
    /* --- entry --- */
    swin(m,drag){ this.push([drag?'drag':'switch',ident(m),m.name+', L50',health(m)]); },
    /* --- MEGA EVOLUTION, ROADMAP #31. Two lines, in Showdown's own order and shapes, read off a
     * real Champions battle.log rather than off SIM-PROTOCOL.md:
     *     |detailschange|p1a: Tyranitar|Tyranitar-Mega, L50
     *     |-mega|p1a: Tyranitar|Tyranitar|Tyranitarite
     * `data/mods/champions/scripts.ts:92` emits the `-mega` and the base `sim/pokemon.ts` emits the
     * `detailschange` first, INSIDE the isPermanent branch and before the ability is set -- so the
     * entry-ability lines that follow are emitted by applyEntryEffects/applyEntryDrops afterwards,
     * which is the order Showdown produces them in.
     *
     * DETAILS FOLLOW THE FORME and the IDENTIFIER DOES NOT -- see identName() above. */
    detailschange(m){ this.push(['detailschange',ident(m),m.name+', L50']); },
    mega(m,apparent,stone){ this.push(['-mega',ident(m),apparent,stone]); },
  };
  return T;
})();
/* WHAT THIS ENGINE CLAIMS IT CAN EMIT. A CLAIM, AND THREE THINGS CHECK IT.
 *
 * `engine/derive_protocol_events.js` reads Showdown's own `add()` call sites (sim/*.ts plus
 * data/mods/champions/*.ts, because the format overrides two of them) and FAILS if a name here is
 * not one Showdown emits -- an invented event would be a false agreement, which is the failure this
 * instrument exists to remove -- and FAILS again if a Showdown event is neither claimed here nor
 * given a written reason in data/protocol-events.json.
 *
 * `tests/test-protocol-trace.js` plays real games and FAILS if any name here NEVER fires. A trace
 * that claims an event and cannot produce one is CLAUDE.md's "capability that cannot prove it ran". */
const TRACE_EVENTS=['turn','upkeep','move','cant','switch','drag','faint','detailschange','-mega',
  '-damage','-heal','-status','-curestatus','-boost','-unboost','-clearallboost','-clearnegativeboost',
  '-ability','-item','-enditem','-weather','-fieldstart','-fieldend','-fieldactivate',
  '-sidestart','-sideend','-start','-end','-activate','-singleturn','-fail','-miss',
  '-crit','-supereffective','-resisted','-immune','-prepare','-mustrecharge'];
/* ARM / DISARM. Returns the previous sink so a nested call restores rather than clobbers. */
function traceBind(S){
  const t=S&&S._trace;
  const prev=TR;
  if(t&&typeof t.push==='function'){ TRACE.out=t; TRACE.S=S; TR=TRACE; }
  else TR=null;
  return prev;
}
function traceRelease(prev){ TR=prev; if(!prev){TRACE.out=null;TRACE.S=null;} }
/* THE ONE NORMALISER, applied to BOTH streams by the comparison driver.
 * Per ARGUMENT FIELD: lowercase, strip whitespace, strip the two punctuation marks that appear only
 * INSIDE A NAME. `Fake Out` -> `fakeout`; `Double-Edge` -> `doubleedge`; `Farfetch'd` -> `farfetchd`;
 * `p2a: Garchomp` -> `p2a:garchomp`; `[from] item: Sitrus Berry` -> `[from]item:sitrusberry`;
 * `154/175 brn` -> `154/175brn`. Nothing else is touched: the `/`, the `,` and the bracket tags
 * survive, so a shape difference stays visible.
 *
 * TWO CORRECTIONS, 2026-08-06, BOTH FOUND BY THE COMPARISON DRIVER ON ITS FIRST RUN — and both were
 * already CLAIMED by this comment before they were true, which is the worse half.
 *
 *   THE HYPHEN. This engine holds ids (`doubleedge`) and Showdown writes display names
 *   (`Double-Edge`). Lowercasing alone leaves `double-edge`, so every hyphenated move, every
 *   apostrophe species and every `-mega-y` forme read as a divergence. `engine/game_differential.js`
 *   reported `move field 3  |move|p2b|double-edge|p1a <> |move|p2b|doubleedge|p1a` — a normaliser
 *   failure wearing a rules-engine's clothes.
 *
 *   THE SIDE FIELD. The comment above used to say "`p1: A` -> `p1:a`, and this engine emits `p1: ` ->
 *   `p1:`, so the player name is dropped from both". It is not dropped from EITHER: `p1: A` lowercases
 *   to `p1:a` and `p1: ` to `p1:`, and those are different strings. Every `-sidestart` and `-sideend`
 *   in every game parted on a player name this engine does not have.
 *
 * FIELDS 0 AND 1 ARE STRUCTURE, NOT NAMES, and are left alone. Stripping `-` from field 1 would turn
 * `-damage` into `damage` and quietly rename half the protocol. */
function traceCanon(line){
  return String(line).split('|').map((f,i)=>{
    let v=f.toLowerCase().replace(/\s+/g,'');
    if(i<2)return v;
    /* THE FOUR THINGS THAT LIVE ONLY INSIDE A NAME. The hyphen (`Double-Edge`), the apostrophe
     * (`Farfetch'd`), the full stop (`Mr. Rime`, which the driver reported as
     * `switch: a different body  mr.rime <> mrrime`) and combining diacritics (`Flabébé`). Each is
     * upstream's SPELLING of an id this engine holds unpunctuated, and folding them is symmetric.
     * KNOWN RESIDUE, stated rather than discovered later: `Type: Null` carries a COLON, which is
     * structural in `[from] item: X` and in `p1a: Garchomp`, so it is not folded and that one species
     * will still part the streams. */
    v=v.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[-'.]/g,'');
    /* the SIDE field only: `p1:` with no slot letter. `p1a:garchomp` does not match and must not. */
    if(/^p[12]:/.test(v))v=v.slice(0,3);
    return v;
  }).join('|');
}
/* COUNTS ARE PARSED OUT OF THE STREAM, never kept beside it — see the block header. */
function traceCounts(lines){
  const c={};
  for(const l of (lines||[])){
    const k=String(l).split('|')[1];
    if(k)c[k]=(c[k]||0)+1;
  }
  return c;
}

/* WIRE 15 -- the spread table is DERIVED. The 34-name set below is kept ONLY as the tags-off
 * control arm's world (pre-wire behaviour, exactly), and as the browser fallback when no artifact
 * shipped. With tags on, membership comes from the artifact's two spread tags -- and the split
 * matters: spreadFoes is ally-safe (Heat Wave), spreadAll HITS YOUR PARTNER (Earthquake, Discharge,
 * Surf -- "the one that killed its own Archaludon"), which the old set flattened into one shape
 * and the battle loop then ignored: no rollout Earthquake has ever hit its own ally. */
const SPREAD_LEGACY = new Set(['earthquake','rockslide','heatwave','blizzard','muddywater','dazzlinggleam','hypervoice','makeitrain','glaciate','icywind','snarl','bulldoze','discharge','lavaplume','eruption','waterspout','surf','electroweb','strugglebug','sludgewave','mistyexplosion','explosion','selfdestruct','breakingswipe','petalblizzard','glaciallance','astralbarrage','originpulse','precipiceblades','landswrath','diamondstorm','sparklingaria','swift','pollenpuff']);
const HITS_ALLY = new Set(TAGS.withTag ? TAGS.withTag('move', 'spreadAll') : []);
const SPREAD = (TAGS.off || TAGS.missing || !TAGS.withTag)
  ? SPREAD_LEGACY
  : new Set([...TAGS.withTag('move', 'spreadFoes'), ...HITS_ALLY]);
/* WIRE 73 -- WHICH TERRAIN TICKS HP, DERIVED. A move that both SETS a terrain and carries `perTurnHP`
 * is describing the terrain's residual, not its own: Grassy Terrain's `{effect:'heal', per:16}` is the
 * 1/16 every grounded body gets at end of turn for as long as the terrain is up. Keyed by the ENGINE's
 * terrain word through terrainId, so the residual loop does one lookup and names no move. A fifth
 * terrain added next regulation with a residual arrives without an edit here -- docs/TAGS.md
 * invariant 3, the same argument as passiveHeal replacing the Leftovers name check.
 *
 * BUILT LAZILY, and that is not style: it reads `terrainId`, whose ENG_TERRAIN table is declared
 * further down this file, so building it at load order threw on require. */
let _TPTH=null;
function terrainPerTurnHP(){
  if(_TPTH) return _TPTH;
  _TPTH={};
  if(!TAGS.withTag) return _TPTH;
  for(const id of TAGS.withTag('move','setsTerrain')){
    const pt=TAGS.param('move',id,'perTurnHP'), st=TAGS.param('move',id,'setsTerrain');
    if(!pt||!st||!st.terrain) continue;
    const k=terrainId(st.terrain); if(k) _TPTH[k]=pt;
  }
  return _TPTH;
}
/* PRIORITY. Every move sits in a bracket from +5 (Helping Hand) down to -7 (Trick Room), and the
 * bracket is decided BEFORE speed. This was a hand-typed table of 18 positive-priority moves, and
 * everything absent from it resolved at 0 - so all 14 negative-priority moves went at normal speed.
 * Trick Room, which is -7 and must resolve last, was being treated as 0. Priority now comes from the
 * shared rulebook (Showdown's own value), so the bracket is right for all 954 moves.
 *
 * ONE documented exception: Grassy Glide is +1 only while Grassy Terrain is up, so Showdown stores no
 * static priority for it. It is kept here as a conditional, not as a hand-maintained duplicate. */
const PRIO_CONDITIONAL = { grassyglide:{ prio:1, needsTerrain:'grassy' } };
function movePriority(id, field){
  if(!id) return 0;
  const key=String(id).toLowerCase().replace(/[^a-z0-9]/g,'');
  const c=PRIO_CONDITIONAL[key];
  /* THROUGH terrainId, so a caller may hand this either vocabulary. A raw `===` against the short
   * word read 0 for every board-sourced `grassyterrain` — see the terrainId header. */
  if(c) return (field&&terrainId(field.terrain)===c.needsTerrain)?c.prio:0;
  const fx=moveFx(key);
  return (fx&&typeof fx.priority==='number')?fx.priority:0;
}
/* WHO REFUSES PRIORITY, in one place, because four consumers were each answering it differently.
 *
 * Will: "farig and tsareena blocking prio, same with psychic terrain, is that all coded in" -- and
 * the honest answer was that data/tags.json has carried armortail, queenlymajesty and dazzling
 * tagged blocksMove {what:'priority', priorityAbove:0} since tag_dex was written, while the only
 * thing that ever read it was clickFragility's bench check. The battle loop below sorted priority
 * moves to the front and let them connect; board.js's move-order features never heard of them; and
 * Psychic Terrain's block was not modelled anywhere at all.
 *
 * Returns the highest priority that still RESOLVES against this side -- so `Infinity` means nothing
 * is refused, and 0 means anything above +0 fails. A blocked move does not lose the speed tie, it
 * FAILS, which is why callers drop it rather than reorder it.
 *
 * DERIVED, NOT NAMED: the ability set and the threshold both come out of the artifact, so an ability
 * added later with the same tag shape is picked up without editing this file. */
let _prioBar=null;
function priorityBlockAbilities(){
  if(_prioBar) return _prioBar;
  _prioBar=new Map();
  try{
    for(const id of (TAGS.withTag?TAGS.withTag('ability','blocksMove'):[])){
      const p=TAGS.param('ability',id,'blocksMove');
      if(p&&p.what==='priority') _prioBar.set(id, typeof p.priorityAbove==='number'?p.priorityAbove:0);
    }
  }catch(e){}
  return _prioBar;
}
/* WIRE 119 -- A VOLATILE THAT FORBIDS A WHOLE CATEGORY OF MOVE. TAUNT, 1,503 corpus clicks, and this
 * engine did not implement it: the volatile was written onto the target by the generic `statusInflict`
 * applier, decremented in the chooser, and read by NOTHING. A Taunted body still landed Hypnosis,
 * Stun Spore, Decorate, Screech, Disable, Feather Dance, Strength Sap, Trick-or-Treat and another
 * Taunt. `tests/test-interaction-matrix.js` found it as twelve separate `X -> taunt` rows, and the
 * comment at chooseAction claimed the opposite in words ("Taunt forbids status moves, so the mon
 * falls through to the normal chooser with its status options removed") beside a line that only
 * decremented a counter. A constraint that nothing reads is not a constraint.
 *
 * THE TABLE IS volatile -> the move CATEGORY that volatile refuses, and BOTH halves come out of the
 * artifact: `forbidsStatusMoves.forbids` says WHICH category, and the same move's `statusInflict`
 * says which volatile carries it. No move is named here, so a second member arriving in a later
 * regulation is picked up without an edit. Membership was PRINTED before this was wired
 * (docs/LESSONS §4) and it is exactly one entry:
 *
 *     taunt  ->  forbids "Status"   via volatile `taunt`, sealsMoves.turns = 3
 *
 * AND THE CATEGORY TEST IS THE ARTIFACT'S TOO. `statusCategory` was checked against the format dex
 * before being trusted as the category predicate: over every move in data/tags.json it agrees with
 * Showdown's own `move.category === 'Status'` on ALL of them -- zero moves tagged and not Status,
 * zero Status and not tagged. A category this table names that no predicate here can decide is
 * COUNTED, not silently allowed (MEDFAILS.forbidCategoryUnknown). */
let _forbidVol=null;
function forbidByVolatile(){
  if(_forbidVol) return _forbidVol;
  _forbidVol=new Map();
  try{
    for(const id of (TAGS.withTag?TAGS.withTag('move','forbidsStatusMoves'):[])){
      const f=TAGS.param('move',id,'forbidsStatusMoves');
      const si=TAGS.param('move',id,'statusInflict');
      if(!f||!f.forbids||!si||!Array.isArray(si.effects)) continue;
      for(const e of si.effects) if(e.volatile) _forbidVol.set(e.volatile,String(f.forbids));
    }
  }catch(e){
    /* IT SPEAKS. An empty catch here would return an EMPTY TABLE, and an empty table is exactly what
     * the engine looked like before this wire -- Taunt silently doing nothing again, reported as
     * success. tests/test-no-silent-failure.js caught the first version of this block swallowing it. */
    MEDFAILS.forbidTableFailed++;
    if(!MEDFAILS.forbidTableFailedFirst) MEDFAILS.forbidTableFailedFirst=String((e&&e.message)||e);
  }
  return _forbidVol;
}
/* The mutation harness swaps the artifact in memory (`TAGS.__setDB`), and a table built once at first
 * demand would keep serving the old membership and score this wire READ-AND-IGNORED -- the false-DEAD
 * direction. tags.js publishes the hook for exactly this; `SPREAD` and the terrain tables do not
 * register one, which is a separate pre-existing gap and is not fixed here. */
if(TAGS&&typeof TAGS.__onSetDB==='function') TAGS.__onSetDB(function(){ _forbidVol=null; _volDur=null; });
/* ============ ROADMAP #111 -- THE VOLATILE DURATION FAMILY, AS ONE MECHANISM ======================
 *
 * `Battle#residualEvent` (sim/battle.js:341-348) decrements EVERY handler carrying BOTH an `end` and
 * a `duration`, INSIDE the Residual event, ordered by `onResidualOrder` (taunt 15, encore 16,
 * disable 17):
 *
 *     if (eventid === 'Residual' && handler.end && handler.state?.duration) {
 *       handler.state.duration--;
 *       if (!handler.state.duration) { handler.end.call(...endCallArgs); continue; }
 *     }
 *
 * So a volatile applied on turn N HAS ALREADY SPENT ONE OF ITS TURNS by the end of turn N. This file
 * documents that exact defect at the Perish Song wire (`perishsong.condition.duration` is 4 and the
 * engine wrote 3), FIXED ONE VOLATILE WITH IT, and left the general defect standing -- so Taunt,
 * Encore and Disable each re-created it in their own way. `data/roster.moves.json` came back with
 * three FIRED-AND-BOARDS-DIFFER rows, 9,092 corpus uses between them, and they are ONE BUG:
 *
 *     taunt        t2 counter  showdown 1  ours 2      the counter was REFRESHED by a second click
 *     disable      t1 counter  showdown 0  ours 4      applied against a target that had never moved
 *                  t2 counter  showdown 3  ours 4      and the application-time offset was missing
 *     encore       t2 counter  showdown 2  ours 3      ticked in the CHOOSER, so a scripted or
 *                  t3 counter  showdown 1  ours 3      caller-supplied action never spent a turn
 *
 * ---- THE SET IS THE ARTIFACT'S ------------------------------------------------------------------
 * Every move whose `sealsMoves.turns` is a POSITIVE NUMBER contributes `volatile -> turns` through
 * its own `statusInflict`. A member whose `turns` is null is deliberately EXCLUDED: Torment and
 * Imprison carry no duration in gen 9, and handing them a counter would EXPIRE them, which is a
 * worse error than the gap. Membership was printed before this was wired (docs/LESSONS §4):
 *
 *     taunt 3     encore 3     disable 5           <- in the table
 *     torment, imprison (turns null), gravity (no volatile)   <- correctly NOT in it
 *
 * ---- THE APPLICATION-TIME OFFSET ----------------------------------------------------------------
 * Showdown writes it into each condition's `onStart`, and the three it writes are the SAME RULE twice
 * and a base correction once:
 *
 *     taunt    if (target.activeTurns && !this.queue.willMove(target)) duration++
 *     encore   if (!this.queue.willMove(target))                       duration++
 *     disable  if (this.queue.willMove(pokemon) || <is moving RIGHT NOW>) duration--
 *
 * "+1 when the target has already spent this turn" is the general rule, and it is the same statement
 * the residual makes: a turn the target no longer has must not be one of the N. Taunt's extra
 * `activeTurns` clause is subsumed by this engine's predicate -- a body dragged or switched in
 * mid-turn holds no action in `acts`, so it reads NOT-already-moved, which is the WIRE 119 argument
 * unchanged. Disable is the one row that is not covered by it, because its DECLARED 5 is one more
 * than the four turns it actually seals; that -1 is written down as a named offset with Showdown's
 * own line beside it rather than being folded into a literal.
 *
 * ---- AND WHICH ONES NEED A LAST MOVE IS DERIVED, NOT LISTED --------------------------------------
 * A `sealsMoves` volatile that also declares a CATEGORY (`forbidsStatusMoves`) seals a category and
 * needs nothing from the target. One that does not must be naming a MOVE -- and Showdown refuses both
 * of those against a target that has never moved (`disable.onTryHit` returns false on `!target.
 * lastMove`; `encore.condition.onStart` returns false on `!target.lastMove`). So the membership falls
 * out of the artifact as `durationVolatiles - forbidByVolatile` = {encore, disable}, which is what
 * WIRE 69 hand-wrote for encore alone and what Disable never had at all. */
let _volDur=null;
function durationVolatiles(){
  if(_volDur) return _volDur;
  _volDur=new Map();
  try{
    for(const id of (TAGS.withTag?TAGS.withTag('move','sealsMoves'):[])){
      const sm=TAGS.param('move',id,'sealsMoves');
      const si=TAGS.param('move',id,'statusInflict');
      if(!sm||sm.turns==null||!(+sm.turns>0)) continue;
      if(!si||!Array.isArray(si.effects)) continue;
      for(const e of si.effects) if(e.volatile) _volDur.set(e.volatile,+sm.turns);
    }
  }catch(e){
    /* IT SPEAKS, for the reason forbidByVolatile's catch does: an empty table here is exactly what
     * the engine looked like BEFORE this wire -- three volatiles that never expire on their own --
     * and that is a silent default wearing the shape of a working feature. */
    MEDFAILS.volDurTableFailed++;
    if(!MEDFAILS.volDurTableFailedFirst) MEDFAILS.volDurTableFailedFirst=String((e&&e.message)||e);
  }
  return _volDur;
}
/* Disable's declared duration is one longer than the number of turns it seals; every other member
 * needs no correction. Written as a table of ONE so a second exception cannot be smuggled in as a
 * literal, and so `durationVolatiles()` stays the authority on the SET. */
const VOL_DUR_OFFSET={disable:-1};
/* The counter to write at application, or null if this volatile carries no duration at all (in which
 * case the caller keeps whatever it was doing before -- this function never invents one).
 *
 * THE NUMBER IS PASSED IN, NOT LOOKED UP, AND THAT IS NOT AN ACCIDENT. `tests/roster.js` demonstrates
 * this rule RED by nulling the `sealsMoves` read AT THE CALL SITE; a function that fetched the turns
 * from `durationVolatiles()` instead would sail straight past that break and the red demonstration
 * would be green with the wire cut. The table decides the SET (and is what the end-of-turn tick walks);
 * the call site supplies the NUMBER, so severing either one is visible. */
function volDurationOnApply(vol,alreadyMoved,sm){
  if(!durationVolatiles().has(vol)) return null;
  if(!sm||sm.turns==null||!(+sm.turns>0)) return null;
  const t=(+sm.turns)+(alreadyMoved?1:0)+(VOL_DUR_OFFSET[vol]||0);
  return t>0?t:1;
}
/* Does this volatile seal a NAMED MOVE (and therefore fail against a target that has never moved)?
 * Derived -- see the header above -- never listed. */
function volNeedsLastMove(vol){ return durationVolatiles().has(vol)&&!forbidByVolatile().has(vol); }
/* THE EXPIRY, in one place, because each member owns a second field beside the counter and freeing
 * the name while leaving the field behind is how a volatile ends and keeps working. */
function endDurationVolatile(m,vol){
  if(!m||!m._vol) return;
  delete m._vol[vol];
  if(vol==='disable') m._sealed=null;
  if(vol==='encore'){ m._encoreMove=null; if(m._lockT!==Infinity){ m._lock=null; m._lockT=0; } }
  if(TR) TR.vend(m,'move: '+vol);
}
/* WIRE 119 -- THREE ACTION KINDS CARRY NO MOVE ID, and every one of them is a status move: the
 * chooser (chooseAction, not playerAction) returns a bare `{kind:'protect'}`, `{kind:'wideguard'}`
 * and `{kind:'tail'}`. It exists so the gate below can ask the ARTIFACT what category the action is
 * rather than assuming one.
 *
 * ROADMAP #81 WIRE 6 -- AND THIS MAP IS A BACKSTOP, NOT THE AUTHORITY, WHICH IS WHY IT WAS WRONG.
 * It was three hand-written rows standing in for "playerAction forgot to put the id on the action",
 * and a hand-written list is missing whatever nobody thought of: `{kind:'trickroom'}` (8,077 corpus
 * uses) and `{kind:'pass'}` (46 moves) were not in it, so `actionMoveId` returned null for them and
 * every rule keyed off it -- Taunt, Throat Chop, the priority bracket, and the `|move|` line the
 * protocol trace emits -- was silently skipped. playerAction now stamps `mv` on every action it
 * builds; these three rows remain only for an action a CALLER hand-built without one. */
const KIND_MOVE={protect:'protect',wideguard:'wideguard',tail:'tailwind'};
function actionMoveId(a){
  if(!a) return null;
  return a.mv||(a.move&&a.move.id)||KIND_MOVE[a.kind]||null;
}
/* Does a volatile this body is carrying refuse this move? One function, called by the SELECTION-time
 * menu filter and by the EXECUTION-time gate above the kind dispatch, because they are the same
 * question asked at two moments (Showdown answers them in two handlers -- `onDisableMove` and
 * `onBeforeMove` -- off one condition). */
function volatileForbidsMove(me,id){
  if(!me||!me._vol||!id) return false;
  const tbl=forbidByVolatile();
  for(const [vol,cat] of tbl){
    if(!(me._vol[vol]>0)) continue;
    if(cat==='Status'){ if(TAGS.has('move',id,'statusCategory')) return true; continue; }
    /* A SILENT DEFAULT LOOKS EXACTLY LIKE A WORKING FEATURE. If the artifact ever names a category
     * this engine has no predicate for, the move is allowed through AND the event is counted. */
    MEDFAILS.forbidCategoryUnknown++;
    if(!MEDFAILS.forbidCategoryUnknownFirst) MEDFAILS.forbidCategoryUnknownFirst=vol+':'+cat;
  }
  return false;
}
/* ROADMAP #68 -- WHICH volatile did the refusing, for the `|cant|` label. It reads the same table
 * volatileForbidsMove reads, so a second forbidding volatile is labelled with its own name rather
 * than being reported as Taunt. Trace-only: it never decides anything. */
function _traceForbidder(me){
  if(!me||!me._vol) return 'taunt';
  for(const vol of forbidByVolatile().keys()) if(me._vol[vol]>0) return vol;
  return 'taunt';
}
/* WIRE 117 -- IS THIS BODY ON THE GROUND. ONE FUNCTION, because the fact was written by hand in
 * THREE places and none of them was the one that mattered.
 *
 * Will: *"Psych terrain is sorta like queenly majesty"* -- correct, and they resolve through the same
 * function, which is why the defect below was invisible. `priorityRefusedAbove` walked the defenders
 * for the ability bar and then applied the Psychic Terrain bar OUTSIDE that loop, never inspecting a
 * body at all. Real Psychic Terrain refuses priority only against a GROUNDED target, so MEDICHAM was
 * refusing Fake Out (12,872 uses), Extreme Speed, Sucker Punch, Aqua Jet and Upper Hand into every
 * Flying type, every Levitate body and every Air Balloon on the field. The comment that sat there
 * said grounded-ness "is not tracked in this engine"; that stopped being true at WIRE 90 and the
 * comment survived the change, which is how a declared gap outlives the gap.
 *
 * THE THREE HAND-WRITTEN COPIES it replaces, all of them CLAUDE.md's "FACTS ARE GLOBAL" broken:
 *   the hazard block (Spikes / Toxic Spikes / Sticky Web), the `preventsSwitch.onlyGrounded` test in
 *   the switch branch, and the Grassy Terrain heal -- whose copy applied the TYPE half only and
 *   COUNTED its own known-wrong ability half in `MEDFAILS.terrainHealUngrounded`. Someone knew that
 *   one was wrong and the counter is the receipt.
 *
 * THE RULE IS SHOWDOWN'S OWN `Pokemon#isGrounded` (sim/pokemon.ts:2153), clause for clause, and every
 * clause below was CHECKED AGAINST THE FORMAT rather than remembered:
 *
 *   Iron Ball        grounds, and beats the Flying clause     isNonstandard null -- LEGAL, 113 uses. WIRED
 *   Flying type      airborne                                 WIRED
 *   Levitate         airborne                                 2,540 uses. WIRED
 *   Eelevate         airborne                                 Eelektross-Mega. 0 sheets (Lesson 3). WIRED
 *   Air Balloon      airborne                                 isNonstandard 'Past' -- BANNED here, and
 *                                                             absent from data/tags.json's items
 *                                                             entirely. Kept as the RULE, unreachable
 *                                                             in this format, stated rather than dropped
 *   Telekinesis      would ground                             isNonstandard 'Past' -- BANNED. NOT wired,
 *                                                             and this HONOURS the declaration at the
 *                                                             hazard block rather than contradicting it
 *   Magnet Rise      would float                              legal, 1 corpus use, a VOLATILE this engine
 *                                                             does not carry. NOT wired, declared
 *   Gravity          grounds EVERYTHING                       legal, 79 corpus uses, a pseudo-weather
 *                                                             this engine has no field slot for. NOT
 *                                                             wired, declared -- the largest live gap here
 *   Smack Down       grounds                                  legal, 10 uses, a volatile. NOT wired
 *   Ingrain          grounds                                  legal, 0 uses. NOT wired
 *   Roost            grounds the user for the turn            legal, 2,109 uses -- but the grounding is
 *                                                             a one-turn TYPE deletion and this engine
 *                                                             holds no per-turn type override. NOT wired,
 *                                                             declared, and it is the second-largest gap
 *
 * THE ABILITY SET IS A NAME AND THAT IS THE STANDING DECLARATION HONOURED, NOT AN EXCEPTION TO IT.
 * The tempting shape is `typeImmunity {type:'Ground'}`, and its membership was PRINTED before being
 * trusted (LESSONS §4): `eelevate`, `levitate` AND **`eartheater`** (45 uses, Orthworm). Earth Eater
 * is Ground-IMMUNE and firmly on the floor, and the official engine says so out loud -- Fake Out into
 * an Orthworm under Psychic Terrain came back `|-activate|p2a: Orthworm|move: Psychic Terrain`, i.e.
 * BLOCKED, in the same run in which Talonflame and Hydreigon took it. Consuming that tag by shape
 * would have made Orthworm airborne. Showdown itself hard-names the pair in `isGrounded`, so this
 * mirrors the reference engine's own implementation rather than inventing a naming.
 *
 * THE RECEIPTS, all played at the pinned commit under gen9championsvgc2026regmb, Incineroar's Fake
 * Out into a Psychic Terrain put up by the opposing Indeedee's Psychic Surge:
 *
 *     Garchomp    Rough Skin              -activate Psychic Terrain    BLOCKED, 0 damage
 *     Orthworm    Earth Eater             -activate Psychic Terrain    BLOCKED, 0 damage
 *     Talonflame  Flame Body              -hint "doesn't affect airborne Pokemon"   LANDS 237->216
 *     Hydreigon   Levitate                -hint "doesn't affect airborne Pokemon"   LANDS 251->233
 *     Talonflame  Flame Body + Iron Ball  -activate Psychic Terrain    BLOCKED
 *     Hydreigon   Levitate  + Iron Ball   -activate Psychic Terrain    BLOCKED
 *
 * A BODY THAT CARRIES NO TYPE LIST IS COUNTED, LOUDLY. board.js maps its defenders to
 * `{ability, fainted}` and hands them here (:2565), so the Levitate clause reaches them and the
 * Flying and item clauses cannot. That is a real remaining over-refusal in the FEATURE vector, it is
 * not ENGINE's file to fix (a board.js signature change is a refit, which MEASURE owns), and a silent
 * default there would look exactly like a working feature. */
const AIRBORNE_ABIL=new Set(['levitate','eelevate']);
function isGrounded(mon){
  if(!mon) return true;
  const g=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const it=g(mon.item);
  if(it==='ironball') return true;                       // beats every airborne clause, as it does upstream
  if(!mon.types){                                        // a partial body -- see the loud-counter note above
    MEDFAILS.groundedBodyIncomplete++;
    if(!MEDFAILS.groundedBodyIncompleteFirst) MEDFAILS.groundedBodyIncompleteFirst=g(mon.ability)||'(no ability)';
  }
  if((mon.types||[]).indexOf('Flying')>=0) return false;
  if(AIRBORNE_ABIL.has(g(mon.ability))) return false;
  return it!=='airballoon';
}
/* `aimedAt` IS OPTIONAL AND THE TWO ARMS ARE NOT THE SAME QUESTION. The ability bar is a SIDE fact --
 * Queenly Majesty and Armor Tail protect their partner as well as themselves, so it is right to fold
 * it over every live defender. Psychic Terrain is a TARGET fact: it asks whether the body being aimed
 * at is standing on the terrain. Passing both foes and folding the terrain over them would let a
 * grounded partner block a Fake Out aimed at the Talonflame beside it. Callers that know the target
 * pass it; callers that do not (board.js's feature read, which has no target object) fall back to
 * "any live defender is grounded", which is the old unconditional behaviour minus the bodies that are
 * provably airborne. */
function priorityRefusedAbove(defenders, field, aimedAt){
  const bar=priorityBlockAbilities();
  let out=Infinity;
  for(const d of (defenders||[])){
    if(!d||d.fainted) continue;
    const ab=String(d.ability||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(ab&&bar.has(ab)) out=Math.min(out,bar.get(ab));
  }
  /* THROUGH terrainId. This line tested `psychicterrain` — the BOARD's spelling — while the artifact's
   * `psychicsurge` sets `psychic`, so the ability that puts the terrain up could never trigger it. */
  if(field&&terrainId(field.terrain)==='psychic'){
    const aim=aimedAt?[aimedAt]:(defenders||[]);
    let blocked=false,airborne=false;
    for(const d of aim){
      if(!d||d.fainted) continue;
      if(isGrounded(d)) blocked=true; else airborne=true;
    }
    if(blocked) out=Math.min(out,0);
    /* ONCE PER CALL, AND ONLY WHEN THE BAR GENUINELY WAS NOT APPLIED. Counting per airborne body, or
     * on every call under the terrain, would make the number mean "Psychic Terrain was up" rather
     * than "this branch changed an outcome", and a counter nobody can read is a counter nobody acts
     * on. A zero here after games under a Psychic Terrain with a Flying body on the field IS the
     * finding -- that is the whole reason this wire needed a counter and not only a probe. */
    else if(airborne) MEDSEEN.terrainSparedAirborne++;
  }
  return out;
}

/* WIRE 124 -- ACCURACY IS DERIVED. `const ACC = {hydropump:80, ...}` was a hand-typed 35-move literal
 * and `moveAccuracy` ended `return ACC[id]||100`, so every move NOT on the list could not miss. Of
 * the 500 moves in this engine's own table, 78 carry an accuracy below 100 in
 * gen9championsvgc2026regmb and 78 of them were absent -- HEAT WAVE (7,405 corpus clicks, 90%),
 * Matcha Gotcha (5,352, 90%), Dual Wingbeat, Draco Meteor, Hyper Beam, Icy Wind, Toxic, Rock Tomb,
 * Triple Axel, Population Bomb. 35,608 clicks of never-missing moves that miss in the real game.
 *
 * The source is data/move-effects.js, which this file ALREADY reads for every secondary and which
 * already carries `accuracy` for all 954 moves in it -- and which two other sites in this same file
 * were already using for exactly this purpose (`(fx&&fx.accuracy===true)?100:...`, the status
 * branches). So the defect was also a FACTS-ARE-GLOBAL violation: two accuracy engines in one file,
 * one derived and one hand-typed, disagreeing on 78 moves. All three sites now call moveAccuracy().
 *
 * ACC_FIX IS NOT THE OLD LIST SHRUNK. It is the set of rows where the GENERATED artifact disagrees
 * with the format dex, measured over all 500 moves at the pinned commit 20ad99ff on 2026-08-06, and
 * it is exactly four. The 35 hand-typed entries all AGREED with the dex and are simply redundant now.
 * data/move-effects.js is generated from CHOMP's move-effects.json and is not ENGINE's to correct, so
 * the deviation is carried here, named, with the dex's number:
 *
 *     crabhammer      artifact 90  -> dex 95
 *     makeitrain      artifact 100 -> dex 95     (2,443 clicks — the one that matters)
 *     syrupbomb       artifact 85  -> dex 90
 *     clangoroussoul  artifact 100 -> dex true (never misses)
 *
 * tests/test-engine-diff.js re-derives the whole comparison against the live format dex and FAILS on
 * a fifth row, so this list is checked rather than remembered -- which is the only thing that makes
 * it different in kind from the literal it replaces. */
const ACC_FIX = {crabhammer:95,makeitrain:95,syrupbomb:90,clangoroussoul:100};
const PROTECTMOVES = new Set(['protect','detect','spikyshield','kingsshield','banefulbunker','burningbulwark','silktrap','maxguard']);

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* Showdown spells stats atk/def/spa/spd/spe; this engine uses at/df/sa/sd/sp. A naming convention,
 * not a mechanic, so the map lives here rather than in data/tags.json. */
/* WIRE 129 -- accuracy and evasion were mapped to NULL, so every boost applier in this file (there
 * are eleven, all keyed off this map) silently DISCARDED them. Coil's +1 accuracy, Minimize's +2
 * evasion, Double Team, Sweet Scent and every accuracy/evasion secondary went in and vanished --
 * `data/move-effects.js` carried `targetBoostsAlways:{atk:1,def:1,accuracy:1}` the whole time and
 * two thirds of it landed. They are real stages now, on their own table (see accStageMul). */
const SD2ENG={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp',accuracy:'acc',evasion:'eva'};
/* Same species of map as SD2ENG: the artifact speaks Showdown's names ("paralysis", "sandstorm"),
 * this engine speaks its own ('par', 'sand'). Naming conventions, not mechanics, so they live here. */
const CODE_OF_STATUS={paralysis:'par',burn:'brn',poison:'psn','bad poison':'tox',sleep:'slp',freeze:'frz'};
const SD2WEATHER={sandstorm:'sand',raindance:'rain',sunnyday:'sun',snowscape:'snow',snow:'snow',hail:'snow'};
/* THE ONE TRANSLATION INTO THIS ENGINE'S WEATHER VOCABULARY, and it is exported because the boundary
 * that needed it could not reach it.
 *
 * `board.weather` holds Showdown's `|-weather|` line, which is a MOVE name -- `sunnyday`, `raindance`,
 * `sandstorm`, `snowscape` (all four, and only those four, across 41,122 weather events in the store).
 * Every formula in this file compares against `sun`/`rain`/`sand`/`snow` (:493-494, :515-516, :965).
 * `rollout_leaf.applyField` assigned the untranslated string straight into `S.field.weather`, so the
 * weather a mid-battle board reported was TRUTHY ENOUGH TO SUPPRESS A GUARD AND MEANINGLESS TO EVERY
 * FORMULA: 0 of 9,040 playouts ever began in a weather this engine could read while 5,320 carried a
 * string. Charizard Flamethrower into Garchomp read 92-109 under `sun` and 61-72 under `sunnyday` --
 * identical to no weather at all.
 *
 * A SECOND MAP WAS NOT WRITTEN. FACTS ARE GLOBAL: `SD2WEATHER` already existed here and was already
 * correct, so the fix is to export the translation rather than copy it into rollout_leaf.js -- which
 * is exactly how `choiceLock` came to have two engines disagreeing.
 *
 * IDEMPOTENT ON PURPOSE. `weatherSetter` in the artifact already emits this engine's own words
 * ('sun', 'rain', 'sand', 'snow'), and those reach `S.field.weather` through applyMegaWeather and
 * through the entry effects. A caller must be able to pass either vocabulary and get the same answer,
 * or the translation itself becomes a place two paths can disagree.
 *
 * AN UNKNOWN VALUE RETURNS '' AND IS COUNTED. Returning the raw string is what caused the bug --
 * a value that is truthy and matches nothing. A silent default looks exactly like a working feature,
 * so the drop is recorded in `fails.weatherUnknown` and names the first one it saw. `deltastream` is
 * the one known real value with no mapping: this engine models no primal weather and Rayquaza is not
 * in this format, so it resolves to no weather rather than to a word no formula reads. */
const ENG_WEATHER=new Set(['sun','rain','sand','snow']);
function weatherId(w){
  const k=String(w||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!k)return '';
  if(ENG_WEATHER.has(k))return k;
  const m=SD2WEATHER[k];
  if(m)return m;
  MEDFAILS.weatherUnknown++; if(!MEDFAILS.weatherUnknownFirst)MEDFAILS.weatherUnknownFirst=k;
  return '';
}
/* HOW LONG THE SKY LASTS IS ONE FACT, AND IT LIVED IN ONE OF FOUR BRANCHES.
 *
 * Weather can be set four ways -- an ability on switch-in (Drought, Drizzle, Sand Stream, Snow
 * Warning), a MOVE (Sunny Day, Rain Dance, Sandstorm, Snowscape), MEGA evolution (Charizard-Y's
 * Drought arriving with the stone), and a punish ability (the Sand Spit class). WIRE 70 taught the
 * MOVE branch to read `extendsDuration` off the rock. The other three kept writing a literal 5, so
 * a Torkoal holding a Heat Rock set five turns of sun and a Torkoal clicking Sunny Day set eight --
 * the same held item, the same sky, two different answers depending on how it arrived.
 *
 * That is FACTS ARE GLOBAL broken in the ordinary way: not a missing mechanic, a correct mechanic
 * with three callers short. 14 of 496 declared setters in the store carry the matching rock (Damp
 * Rock on Pelipper is the common one at 6.2%), and three extra turns of rain is most of a game.
 *
 * The two vocabularies meet here. `extendsDuration.extends` holds MOVE ids (`sunnyday`), because the
 * rock's rulebook text names the move; `weatherSetter.weather` holds ENGINE words (`sun`). Both go
 * through `weatherId` before they are compared, so neither spelling is authoritative and adding a
 * fifth setter route cannot reintroduce the split. */
function weatherTurns(weather, item, TAGSMOD){
  const w=weatherId(weather);
  if(!w)return 0;
  const ext=(TAGSMOD||TAGS).param('item',item,'extendsDuration');
  if(ext&&ext.toTurns&&(ext.extends||[]).some(nm=>weatherId(nm)===w))return +ext.toTurns;
  return 5;
}
/* TERRAIN HAS THE SAME TWO-VOCABULARY SPLIT AS THE WEATHER, AND UNLIKE THE WEATHER THE SPLIT RAN
 * THROUGH THE MIDDLE OF THIS FILE.
 *
 * Three writers, two vocabularies, nobody translating:
 *   - `board.startField` stores `norm(move.terrain)`, so a Board carries `electricterrain`;
 *     `position_features.js:296` reads that spelling back out.
 *   - the artifact's `terrainSetter` param carries `electric` (Electric Surge, Hadron Engine), and
 *     that is what :1191 assigns straight into `field.terrain`.
 *   - `miltank.js:781` and `rollout_r1.js:175` extract with the SHORT words, against a Board that
 *     stores the LONG ones, so they hand the leaf `''` every time.
 *
 * And the READERS in this file disagreed with each other. Measured on the engine as it stood:
 *
 *     Surf under Hadron Engine (:576)   clear 99   'electric' 130   'electricterrain' 99
 *     movePriority(grassyglide) (:97)   'grassy' 1                  'grassyterrain' 0
 *     priorityRefusedAbove (:144)       'psychic' Infinity          'psychicterrain' 0
 *
 * So Psychic Surge, which sets `psychic` from the artifact, has NEVER blocked a priority move, and a
 * board's `electricterrain` has never boosted or hastened anything. Both halves were live-looking and
 * both were dead, in opposite directions.
 *
 * A SECOND MAP WAS NOT WRITTEN, and this is the sibling of `weatherId` rather than a new idea:
 * same shape, same idempotence, same loud unknown. Idempotent matters here more than it did for the
 * weather, because BOTH vocabularies genuinely arrive — the artifact's on a switch-in and the board's
 * at the leaf boundary — so a caller must be able to pass either and get the same answer.
 *
 * EXPOSURE, MEASURED BEFORE THE FIX RATHER THAN ASSUMED. Over 69,623 corpus boards (every board of
 * all 8,759 clean open-sheet games), 863 carry a terrain by the Board's own key — 1.24%, against
 * 48.1% for weather — and they are electric 597, psychic 243, grassy 18, misty 5. The store holds
 * exactly four values over 1,845 field-start events: `Electric Terrain`, `Psychic Terrain`,
 * `Grassy Terrain`, `Misty Terrain`, so the translation covers 100% of what exists. The SHORT-word
 * extractor that miltank and rollout_r1 use found 0 of the 863, which is why the leaf-side exposure
 * is zero and stays zero until an owner of those files changes them — filed in docs/ENGINE.md. */
const ENG_TERRAIN=new Set(['electric','grassy','misty','psychic']);
const SD2TERRAIN={electricterrain:'electric',grassyterrain:'grassy',mistyterrain:'misty',psychicterrain:'psychic'};
function terrainId(t){
  const k=String(t||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!k)return '';
  if(ENG_TERRAIN.has(k))return k;
  const m=SD2TERRAIN[k];
  if(m)return m;
  MEDFAILS.terrainUnknown++; if(!MEDFAILS.terrainUnknownFirst)MEDFAILS.terrainUnknownFirst=k;
  return '';
}
/* WIRE 33 -- MAGIC BOUNCE. A bounced status move is not a move that FAILED, it is a move that landed
 * on the person who threw it, and that is a two-stage difference in the score: Will-O-Wisp aimed at a
 * Magic Bounce body burns the ATTACKER. The engine had no concept of it -- Charm read -2 on the target
 * either way (measured: `ability none -2/0, Magic Bounce -2/0`).
 *
 * A JOIN BY SHAPE, NOT A NAME. The ability carries `reflectsStatusMoves {requiresFlag:'reflectable'}`
 * and the move carries `moveClass {classes:[...,'reflectable']}` -- the same ability-names-a-flag /
 * move-carries-it pattern `immuneToMoveClass` already uses, so a second bouncer arrives with no edit.
 * `reflectable` was added to the moveClass derivation in the same pass for exactly this; 60 moves
 * carry it.
 *
 * THE DERIVATION OVER-MATCHED FIRST AND THE MEMBERSHIP PRINT IS WHAT CAUGHT IT -- `onAllyTryHitSide`
 * alone matched magicbounce, sapsipper AND soundproof, and wiring that would have sent a Will-O-Wisp
 * back at its user off a SOUNDPROOF body (355 uses). See tag_dex's comment.
 *
 * WHAT IS NOT MODELLED, stated rather than discovered: the tag's own `scope` says the bounce covers
 * the whole SIDE including hazards and the partner. This engine keeps no side conditions and no
 * hazards, and a move aimed at the partner is aimed at a different body, so only the holder's own
 * bounce is here. A bounce cannot bounce again -- returning the user means the recursion cannot
 * happen, because a user never reflects its own move. */
function bounceOff(user,target,moveId){
  if(!target||target===user||!moveId) return target;
  const r=TAGS.param('ability',target.ability,'reflectsStatusMoves');
  if(!r) return target;
  const c=TAGS.param('move',moveId,'moveClass');
  const flag=r.requiresFlag||'reflectable';
  if(!(c&&c.classes&&c.classes.indexOf(flag)>=0)) return target;
  return user;
}
const boostMul=s=>{s=clamp(s||0,-6,6);return s>=0?(2+s)/2:2/(2-s);};
/* ROADMAP #81 WIRE 4 -- SHOWDOWN DOES EVERY DAMAGE MULTIPLIER IN FIXED POINT ON 4096ths, AND THIS
 * ENGINE DID THEM IN FLOAT. `sim/battle.ts:2318-2340`:
 *
 *     modify(value, num, den) { const modifier = tr(num * 4096 / den);
 *                               return tr((tr(value * modifier) + 2048 - 1) / 4096); }
 *     chain(prev, next)       { return ((prev * next + 2048) >> 12) / 4096; }
 *
 * The `+2047` is a ROUND-HALF-UP baked into integer arithmetic. `Math.floor(v * m)` is a TRUNCATION,
 * so the two agree only when `m` is a clean power of two (x2, x1.5, x0.5, x0.25 on their own do
 * agree -- checked, which is why every probe in this file that used those never saw it) and disagree
 * on everything else. MEASURED against the authority on 300 sampled real matchups per arm, exact
 * agreement on BOTH the 85 and the 100 roll, before this landed:
 *
 *     no modifier at all   293/300 exact   <- the control: the residual is other bugs, not arithmetic
 *     a SPREAD move        226/300         <- x0.75 disagrees on ~50% of base-damage values
 *     a LIFE ORB holder    107/300         <- x1.3 disagrees on ~64%
 *     an attacker at -1    293/300         <- boostMul is NOT part of this family; measured, not assumed
 *
 * ONE IMPLEMENTATION, EVERY CALLER (CLAUDE.md: a FACT is global). `md4096` is Showdown's `modify`
 * and `ch4096` is Showdown's `chain`; a modifier chain is accumulated in 4096ths and applied ONCE,
 * exactly as `runEvent` does with `this.event.modifier`.
 *
 * THE FLOAT ARGUMENT IS NOT AN APPROXIMATION -- it is how Showdown itself spells most of these.
 * `tr(1.3 * 4096) = 5324` is Life Orb's literal `[5324, 4096]`; 1.2 -> 4915, 1.1 -> 4505,
 * 4/3 -> 5461, 0.75 -> 3072, all exact. The one place a float loses a unit is the OTHER 1.3 --
 * Tough Claws and the terrains are `[5325, 4096]` -- so `md4096` also takes an explicit [num,den]
 * pair for a caller that has one. 1/4096 of a multiplier is two orders of magnitude smaller than
 * the error being removed, and the pair form means a corrected artifact needs no engine edit. */
const _tr4096=n=>Math.trunc(n)||0;
const _num4096=m=>Array.isArray(m)?_tr4096(m[0]*4096/m[1]):_tr4096(m*4096);
/* Showdown's `modify`: apply ONE modifier (float or [num,den]) to a value. */
const md4096=(v,m)=>_tr4096((_tr4096(v*_num4096(m))+2047)/4096);
/* Showdown's `chain`: fold a modifier into a running chain. Both sides are in 4096ths; the chain
 * starts at CH_ONE and is spent by `mdChain`. `>> 12` is Showdown's own, 32-bit and all. */
const CH_ONE=4096;
const ch4096=(prev,m)=>((prev*_num4096(m)+2048)>>12);
/* Spend a chain. `runEvent` ends with `modify(relayVar, this.event.modifier)`, and event.modifier is
 * the chain over 4096 -- so `tr(modifier * 4096)` recovers the integer chain exactly. */
const mdChain=(v,chain)=>chain===CH_ONE?v:_tr4096((_tr4096(v*chain)+2047)/4096);
/* ROADMAP #92 -- THE ARTIFACT STORES A FLOAT AND THE AUTHORITY STORES A PAIR, AND FOR 1.3 THEY ARE
 * NOT THE SAME NUMBER. `tr(1.3 * 4096) = 5324`, which is EXACTLY right for Life Orb (`[5324,4096]`
 * in data/items.ts) and one 4096th LOW for Tough Claws, Sheer Force, Punk Rock, Transistor, Analytic
 * and the three terrains, every one of which is written `[5325,4096]`. There is no rule that
 * recovers the difference from the float — the authority genuinely spells the same ratio two ways —
 * so the members that need the pair are NAMED, and the name list is the derivation's output rather
 * than a memory: tests/test-damage-stages.js re-reads every handler out of the live dex, extracts
 * its literal `chainModify` argument and FAILS if this table disagrees with it. A hand list that is
 * checked against its source every run is not the hand list this repo keeps getting burned by.
 * Anything not named falls through to the tag's own value, which is exact for 1.2, 1.1, 1.5, 2 and
 * 0.75.
 *
 * ONLY THE MEMBERS THIS ENGINE ACTUALLY SPENDS ARE LISTED. Analytic and Sand Force are also
 * `[5325,4096]` and are NOT here, because nothing reads them -- their `damageBoost` carries a
 * condition the tag states as prose, so they are not wired at all. An entry for an unwired ability
 * would pass the check above and cover nothing, which is a hand list pretending to be a fix. */
const CH_EXACT = { toughclaws:[5325,4096], sheerforce:[5325,4096], punkrock:[5325,4096],
                   transistor:[5325,4096] };
const exact4096=(id,m)=>CH_EXACT[id]||m;
/* ROADMAP #112 -- `onlyWhen`, EVALUATED. ONE READER OF THE CONDITION, FOR EVERY TAG THAT CARRIES ONE.
 *
 * Returns TRUE (the condition holds, or there is none), FALSE (it does not), or NULL (this engine
 * cannot read this shape). NULL IS NOT FALSE and the caller must not treat it as such: it means
 * "refuse AND say so", which is the fail-closed rule ROADMAP #92 wrote after `damageReduce` nearly
 * handed every Ripen body a permanent halving. A silent default looks exactly like a working feature.
 *
 * THE ARITHMETIC IS INTEGER, DELIBERATELY, AND THAT IS THE WHOLE BOUNDARY. Showdown's gate is
 *
 *     if (move.type === 'Fire' && attacker.hp <= attacker.maxhp / 3) return this.chainModify(1.5);
 *
 * -- a real division. `hp <= maxhp * (1/3)` is a DIFFERENT predicate, because the nearest double to
 * 1/3 is below it: 150 * (1/3) is 49.999999999999993, so a body at exactly 50 out of 150 would be
 * refused a boost it is owed. `hp*den <= maxhp*num` is exact for every maxhp in the game. An
 * off-by-one here reads as correct at every HP except the one that decides the game, which is why
 * tests/test-pinch-family.js stages both parities of maxhp and both sides of the line.
 *
 * `of: 'self'` is the body whose ability this is. The caller passes it; this function never guesses
 * which body it means.
 *
 * ROADMAP #101 -- THE SIGNATURE WIDENED, AND THAT WAS THE WHOLE COST WIRE 112 PREDICTED. `hpFraction`
 * asks about the HOLDER and needs nothing else; every condition the `buffsHolderOnHit` family carries
 * asks about the INCOMING MOVE (`crit`, `moveType`, `moveCategory`, `moveFlag`), which no amount of
 * looking at `self` can answer. So a third argument arrives carrying the hit: `{crit, moveType,
 * category, moveId}`. It is OPTIONAL and its absence is not silent -- a move-shaped condition asked
 * without a hit context returns NULL, the same refusal an unknown shape gets, so a caller that
 * forgets to pass it is counted rather than served a comfortable `false`.
 *
 * `moveType` is the type the move RESOLVED to (the caller passes effMoveType's answer), not `mv.t`:
 * a Pixilate Body Slam is Fairy by the time it lands, so a Justified body must not react to it as
 * Normal. `moveFlag` joins through the move's own tag exactly as mvMakesContact does -- the ability
 * names a flag, the move carries it -- so a future ability keyed on `sound` needs no edit here. */
function condHolds(w,self,hit){
  if(w==null)return true;
  if(typeof w!=='object')return null;
  if(w.cond==='hpFraction'&&w.of==='self'
     &&Number.isInteger(w.num)&&Number.isInteger(w.den)&&w.den>0&&w.num>0
     &&self&&self.st&&self.st.hp>0&&self.curHP!=null){
    const hp=self.curHP,mx=self.st.hp;
    if(w.cmp==='<=')return hp*w.den<=mx*w.num;
    if(w.cmp==='>=')return hp*w.den>=mx*w.num;
    return null;
  }
  /* Everything below needs the HIT. No hit in hand is a refusal, never a false. */
  if(!hit)return null;
  if(w.cond==='crit')return typeof hit.crit==='boolean'?hit.crit:null;
  if(!Array.isArray(w.is)||!w.is.length)return null;
  if(w.cond==='moveType')  return hit.moveType?w.is.indexOf(hit.moveType)>=0:null;
  if(w.cond==='moveCategory')return hit.category?w.is.indexOf(hit.category)>=0:null;
  if(w.cond==='moveFlag')  return hit.moveId
    ?w.is.some(f=>TAGS.has('move',hit.moveId,String(f)))
    :null;
  return null;
}
/* HEALING IS A CLASS, AND blocksHealing IS ITS COUNTER — one gate, asked in every place HP goes up.
 *
 * Psychic Noise (196 uses) is the only member and it carries `blocksHealing {turns:2}`. Wiring the
 * healing family without it would make every healer in the format strictly better than it is, which
 * is a one-directional error of exactly the kind this engine keeps being caught by.
 *
 * WHAT IT GATES, AND WHY THAT LIST AND NOT ANOTHER. Heal Block stops HP being restored to a body that
 * is standing on the field: healing moves, the heal half of a drain (the DAMAGE still lands), a
 * passive item tick, a pinch berry (which is not consumed either), and Leech Seed's return to the
 * seeder. It does NOT gate `healsOnSwitchOut` — that fires as the body LEAVES, and leaving is what
 * ends the volatile — and it does not gate Hospitality, which heals a partner on ENTRY. Both
 * exclusions are stated here rather than left to whoever reads the diff. */
const healBlocked=m=>!!(m&&m._healBlock>0);
/* THE HEAL FRACTION FROM THE ARTIFACT, not from a second copy in the dex blob.
 *
 * `healsSelf`/`healsAlly` carry the same `[1,2]` / `[1,4]` the dex does — verified move by move
 * across all 14 members before the switch was made, so this is a no-op behaviourally and a real
 * change structurally: membership is now DERIVED (docs/TAGS.md invariant 3). Life Dew carries BOTH
 * tags and that is what makes it spread across the side; Roost and Recover carry only `healsSelf`.
 * Reading `fx.target === 'allies'` for that was asking a string what a tag already says.
 *
 * Heal Pulse (91 uses) carries `healsAlly {heal:true}` with no fraction and stays honestly unwired.
 *
 * ROADMAP #102 -- TWO OF THE `heal: true` MEMBERS ARE NOW SIZEABLE, AND THE ARTIFACT IS WHAT CHANGED.
 * The comment above and MEDFAILS.healProcedural both said the same true thing -- "the tag says
 * `heal: true`, which is a boolean in a fraction's clothing" -- and it stopped being true when
 * tag_dex started carrying `weatherScaled.baseHealFraction` and `healsSelf.fromTargetStat`.
 *
 *   weatherScaled.baseHealFraction   synthesis, moonlight, morningsun   1/2, 2/3 in sun, 1/4 in
 *                                    rain/sand/snow -- and the numbers come from the artifact, which
 *                                    carries Showdown's own literal 0.667 rather than 2/3.
 *   healsSelf.fromTargetStat         strengthsap, and ONLY strengthsap -- membership printed over
 *                                    the whole move table before a line of this was written.
 *
 * Rest, Wish, Healing Wish, Swallow and Heal Pulse still arrive here with nothing but `true` and are
 * still counted. The counter therefore keeps meaning what it meant; it just stops covering 1,024 uses
 * it can now size.
 *
 * THE FRACTION IS NOT RESOLVED HERE. `fromTargetStat` needs the TARGET and the weather members need
 * the sky AT THE MOMENT THE MOVE GOES OFF -- an ally's Sunny Day earlier in the same turn changes a
 * Synthesis from 1/2 to 2/3 -- and this function is called by `playerAction` at CLICK time, one whole
 * turn-sort earlier. So it returns the RECIPE and the resolution site spends it. */
function healParam(id){
  const s=TAGS.param('move',id,'healsSelf'), al=TAGS.param('move',id,'healsAlly');
  const fr=(s&&s.heal)||(al&&al.heal)||null;
  if(Array.isArray(fr)&&fr[1])return {fr,allies:Array.isArray(al&&al.heal)};
  if(fr===true){
    const _ws=TAGS.param('move',id,'weatherScaled');
    if(_ws&&_ws.baseHealFraction)return {weather:_ws,allies:false};
    if(s&&s.fromTargetStat)return {fromTargetStat:String(s.fromTargetStat),allies:false};
    MEDFAILS.healProcedural++;if(!MEDFAILS.healProceduralFirst)MEDFAILS.healProceduralFirst=id;
  }
  return null;
}
/* ROADMAP #102 -- `Pokemon#getStat(stat, false, true)`: the stored stat with its BOOST applied and no
 * modifier events. Strength Sap heals by exactly this, so it is spelled the way sim/pokemon.ts spells
 * it -- MULTIPLY on a positive stage, DIVIDE on a negative one.
 *
 * NOT `boostMul`, DELIBERATELY, AND THE DIFFERENCE IS REAL. `Math.floor(x * 2/(2-s))` and
 * `Math.floor(x / ((2-s)/2))` disagree wherever the float lands just under an integer -- at s = -1 and
 * x = 3 they give 1 and 2. dmgRange uses the multiply form on A and D and that is a pre-existing
 * difference from the authority, filed here rather than fixed in the same breath: it is a DAMAGE
 * change and this is a heal. */
const BOOST_TABLE=[1,1.5,2,2.5,3,3.5,4];
function statWithBoost(mon,k){
  const b=clamp((mon.boosts&&mon.boosts[k])||0,-6,6),v=mon.st[k];
  return b>=0?Math.floor(v*BOOST_TABLE[b]):Math.floor(v/BOOST_TABLE[-b]);
}

// Mega abilities — sourced from Serebii's Champions data (not guessed). Champions runs BOTH the
// classic Megas (mainline abilities) AND a set of new Champions-only Megas with their own abilities.
const MEGA_ABIL={
  // classic Megas (mainline abilities) — stones present in the ladder data
  swampert:'swiftswim',venusaur:'thickfat',blastoise:'megalauncher',mawile:'hugepower',gengar:'shadowtag',
  gardevoir:'pixilate',gallade:'innerfocus',metagross:'toughclaws',aerodactyl:'toughclaws',tyranitar:'sandstream',
  garchomp:'sandforce',kangaskhan:'parentalbond',blaziken:'speedboost',scizor:'technician',sceptile:'lightningrod',
  alakazam:'trace',lucario:'adaptability',medicham:'purepower',manectric:'intimidate',absol:'magicbounce',
  sableye:'magicbounce',lopunny:'scrappy',heracross:'skilllink',pinsir:'aerilate',abomasnow:'snowwarning',
  altaria:'pixilate',beedrill:'adaptability',sharpedo:'strongjaw',camerupt:'sheerforce',banette:'prankster',houndoom:'solarpower',
  // Champions-specific Megas (Serebii megaabilities.shtml)
  staraptor:'contrary',malamar:'contrary',dragonite:'multiscale',glimmora:'adaptability',froslass:'snowwarning',
  chandelure:'infiltrator',delphox:'levitate',chimecho:'levitate',meowstic:'trace',clefable:'magicbounce',
  starmie:'hugepower',scrafty:'intimidate',greninja:'protean',dragalge:'regenerator',barbaracle:'toughclaws',
  chesnaught:'bulletproof',scolipede:'shellarmor',emboar:'moldbreaker',falinks:'defiant',drampa:'berserk',
  victreebel:'innardsout',golurk:'unseenfist',floette:'fairyaura',skarmory:'stalwart',crabominable:'ironfist',
  // Champions NEW abilities (effects added incrementally; labels correct now)
  excadrill:'piercingdrill',eelektross:'eelevate',pyroar:'firemane',meganium:'megasol',feraligatr:'dragonize',scovillain:'spicyspray',hawlucha:'noguard'};
/* AN ABILITY IS ONE SHAPE OR IT IS NOT COMPARABLE. Every ability test in this file is a lowercase
 * alphanumeric literal -- att.ability==='technician', m.ability==='intimidate' -- and 85 of the 318
 * MC.mons rows (all of them megas, written by the mega merge) store `ab` in DISPLAY case: "Technician",
 * "Huge Power", "Tough Claws". buildMon copied that through untouched, so a body built from its MEGA
 * ROW carried exactly the right ability and not one line of it fired: Mega Scizor's Bullet Punch read
 * 52 where Technician makes it 78.
 *
 * It hid because the OTHER construction path was always correct -- base row + stone goes through
 * megaAbility(), which returns from the lowercase MEGA_ABIL map above. Only the mega-keyed path was
 * wrong, and board.js overwrites the ability with effAbility() before its own damage call, which is
 * why the live bot never showed it either. Probed by tests/test-mechanics.js `megaRowAbilityCase`. */
const normAb=a=>String(a||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function megaAbility(name,item,baseAb){ if(!item)return baseAb;
  if(name==='charizard'){ if(/itey$/.test(item))return 'drought'; if(/itex$/.test(item))return 'toughclaws'; }
  if(name==='raichu'){ if(/y$/.test(item))return 'noguard'; if(/x$/.test(item))return 'electricsurge'; }   // Raichunite Y / X
  if(MEGA_ABIL[name] && (TAGS.has('item',item,'megaStone')||/ite[xy]?$/.test(item))) return MEGA_ABIL[name];   // WIRE 111
  return baseAb; }
/* Mega formes, from the SAME generated source the canonical engine uses (CHOMP/data/mega-formes.json,
 * exposed to the browser as window.MEGA_FORMES). This engine previously kept its own hand-written
 * mega table and never swapped mega STATS at all, so when the canonical engine learned real mega
 * stats the two silently disagreed by 30% on Charizard-Mega-Y's Special Attack. Reading one shared
 * file is what makes tests/test-engine-contract.js able to hold them together. */
function megaForme(item){
  const F=(typeof window!=='undefined'&&window.MEGA_FORMES)||null;
  if(!F||!item) return null;
  return F[String(item).toLowerCase().replace(/[^a-z0-9]/g,'')]||null;
}
/* ---- WIRE 132 — THE MEGA FORME KEY IS IN THE ARTIFACT AND THE ENGINE WAS GUESSING IT --------------
 *
 * `buildMonFromSet` built the mega key by CONCATENATION -- `key + '-mega'` -- and `data/abra-tags.js`
 * has carried the real mapping all along in `item|megaStone.into`. Measured over all 76 pairs in the
 * artifact before a line was written, per docs/LESSONS.md 4:
 *
 *     76 into-pairs;  the suffix guess agrees on 74;  it DIFFERS on exactly 2:
 *       floettite     base floette-eternal   guess floette-eternal-mega [row exists]  artifact floette-mega
 *       meowsticite   base meowstic          guess meowstic-mega  [NO ROW]            artifact meowstic-m-mega
 *
 * So this cannot over-match: 74 of 76 are the same string either way. What the two that differ cost:
 *
 *   FLOETTE. Floettite is held on 2,747 sheet lines and Floette-Eternal is on ~10.5% of ladder sides.
 *   The guess resolves to `floette-eternal-mega`, which is the ONE row in the whole mon table with
 *   `ab: null`, and which also carries `mv: []`. The artifact's own answer, `floette-mega`, carries
 *   Fairy Aura and the right base stats. The engine was reaching the empty twin of a row that was
 *   correct beside it.
 *
 *   MEOWSTIC. `meowstic-mega` does not exist at all, so the mega branch simply did not fire and a
 *   Meowsticite set built the BASE forme -- a silent no-op, which is this project's signature failure.
 *
 * THE HAND-TYPED `MEGA_ABIL` KEYS FLOETTE AS `floette:'fairyaura'`, WHICH IS NEITHER KEY. That is the
 * merge_mega_into_engine.js failure from CLAUDE.md verbatim ("the builder keyed venusaurmega while the
 * artifact keyed venusaur-mega, so zero of its 67 writes ever matched"), the same shape on a new pair.
 * It is left in place -- it is the fallback for a stone the artifact has not derived -- and the
 * artifact is asked FIRST.
 *
 * THE TABLE IS BUILT ONCE AND CACHED, and that is stated rather than hidden: a `TAGS.__setDB` swap
 * after the first call will not be seen, so the red demonstration for this wire is a SOURCE revert
 * and not an artifact strip. */
let _MEGA_INTO=null;
function megaIntoTable(){
  if(_MEGA_INTO)return _MEGA_INTO;
  const K=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const fwd=Object.create(null);   // 'itemid|basekey' -> mega key
  const forBase=Object.create(null);
  const rev=Object.create(null);   // mega key -> base key
  let ids=[];
  try{ ids=(TAGS.withTag&&TAGS.withTag('item','megaStone'))||[]; }
  catch(e){ MEDFAILS.megaIntoNoTable++; if(!MEDFAILS.megaIntoNoTableFirst)MEDFAILS.megaIntoNoTableFirst=String(e.message).slice(0,60); }
  for(const id of ids){
    const p=TAGS.param('item',id,'megaStone');
    if(!p||!p.into)continue;
    for(const from of Object.keys(p.into)){
      const b=K(from), t=K(p.into[from]);
      fwd[K(id)+'|'+b]=t; forBase[b]=t; rev[t]=b;
    }
  }
  _MEGA_INTO={fwd,forBase,rev};
  return _MEGA_INTO;
}
/* The one answer to "what forme does THIS stone make of THIS body". The suffix guess stays as the
 * OR-fallback for a stone the artifact has not derived, and taking it is COUNTED -- a silent default
 * here is exactly the shape that made a Meowsticite set build a base Meowstic. */
function megaKeyFor(baseKey,item){
  const K=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const T=megaIntoTable();
  const named=T.fwd[K(item)+'|'+K(baseKey)];
  if(named&&monRow(named))return named;
  const suffix=/itex$/.test(item)?'-mega-x':(/itey$/.test(item)?'-mega-y':'-mega');
  const guess=baseKey+suffix;
  if(monRow(guess)){
    MEDSEEN.megaKeyFromSuffix++;
    if(!MEDSEEN.megaKeyFromSuffixFirst)MEDSEEN.megaKeyFromSuffixFirst=item+' -> '+guess;
    return guess;
  }
  return null;
}
/* ---- ROADMAP #31 -- THE CAPABILITY, DERIVED FROM THE BODY AND NEVER STAMPED --------------------
 *
 * "Can this body still mega?" is a question about the SPECIES it is standing as and the ITEM it is
 * holding right now, so it is answered from those two fields every time it is asked. A flag stamped
 * at build time would be wrong the moment anything moved the item -- Knock Off, Trick, a bench swap,
 * or simply `b.item = x` after buildMon, which is what engine/game_differential.js and every probe in
 * tests/ do. A stamp that did not happen looks exactly like a body that cannot mega, which is this
 * project's signature failure shape.
 *
 * THE ITEM TEST IS THE ARTIFACT'S FIRST AND THE NAME-SHAPE SECOND, and the shape was MEASURED before
 * it was wired rather than assumed safe: of the legal items in
 * `Dex.forFormat('gen9championsvgc2026regmb')`, 75 carry `megaStone` and ALL 75 match `/ite(x|y)?$/`,
 * and ZERO non-stones match it. So the fallback cannot over-match today; it exists because the X/Y
 * suffix lives in the item name and the artifact's `into` table does not distinguish the two
 * Charizardites by shape (the same reason WIRE 111 kept it).
 *
 * A STONE WITH NO MEGA ROW IS COUNTED, NOT SWALLOWED -- `megaStoneNoRow`. Silently returning null
 * there would make a whole species quietly incapable of megaing and read as "nobody megaed". */
function holdsMegaStone(item){
  if(!item)return false;
  return TAGS.has('item',item,'megaStone')||/ite(x|y)?$/.test(String(item));
}
function megaTargetFor(m){
  if(!m||!m.item)return null;
  /* already a mega forme: nothing left to become. The suffix test is on the FORME key this engine
   * holds, which is how data/engine-data.js spells its own mega rows, not string arithmetic on a
   * species name -- nothing is constructed here, only recognised. */
  if(/-mega(-[xyz])?$/.test(String(m.name)))return null;
  if(!holdsMegaStone(m.item))return null;
  const k=megaKeyFor(m.name,m.item);
  if(!k){ MEDFAILS.megaStoneNoRow++;
          if(!MEDFAILS.megaStoneNoRowFirst)MEDFAILS.megaStoneNoRowFirst=m.name+' @ '+m.item; }
  return k;
}
/* ROADMAP #81 WIRE 7 -- THE ONE ITEM CLASS IN THIS FORMAT THAT REFUSES `takeItem`.
 *
 * `Pokemon#takeItem` (sim/pokemon.ts) runs a `TakeItem` event and returns false when a handler
 * refuses. MEASURED over the format rather than assumed: of every legal item in
 * `Dex.forFormat('gen9championsvgc2026regmb')`, exactly 75 declare an `onTakeItem` and ALL 75 are mega
 * stones -- there is no Z-crystal, no Griseous Orb, no plate in this format. So the whole rule reduces
 * to the mega stones' own handler:
 *     onTakeItem(item, source) { if (item.megaEvolves === source.baseSpecies.baseSpecies) return false; }
 * A Gengarite cannot be knocked off a Gengar; it CAN be knocked off anything else.
 *
 * READ FROM `megaStone.into`, WHICH IS THE ARTIFACT'S OWN (item, base) -> forme table -- the same
 * table WIRE 132 landed and the same one megaKeyFor consults. The SUFFIX FALLBACK IS DELIBERATELY NOT
 * USED HERE and that is the whole care in this function: `megaKeyFor('garchomp','gengarite')` falls
 * back to `garchomp` + `-mega`, finds a real row, and would refuse to knock a Gengarite off a
 * Garchomp. A fallback that is right for "what does this body become" is wrong for "does this item
 * belong to this body", so only the named pair is honoured.
 *
 * A BODY THAT HAS ALREADY MEGAED STILL REFUSES, because Showdown compares against
 * `baseSpecies.baseSpecies` and a Gengar-Mega's is still Gengar. `megaTargetFor` returns null for a
 * mega forme (nothing left to become), so it cannot answer this question and is not asked -- the base
 * key comes back through the inverted `into` map instead. */
/* WIRE 141 -- WHAT IS THIS BODY'S FLING WORTH RIGHT NOW. ONE FUNCTION, TWO CALLERS.
 *
 * Fling has base power 0 in the dex and gets it from the held item at `onPrepareHit`
 * (`move.basePower = item.fling.basePower`). Two places need the answer and they run at DIFFERENT
 * MOMENTS: `dmgRange` prices the click before anything has happened, and the hit step prices the
 * damage after the item has already been spent. Two readers would disagree the moment the item left,
 * which is the FACTS-ARE-GLOBAL breach CLAUDE.md names, so the resolved number is stamped on the body
 * when the throw commits and this function prefers the stamp when there is one.
 *
 * A body with no item, or with an item the artifact does not call `flingable`, is worth 0 -- and 0 is
 * not a damage number here, it is the signal the CALLER uses to fail the move outright. */
function flingBasePower(att){
  if(!att)return 0;
  if(att._flingBP!=null)return +att._flingBP||0;
  /* THE REFUSAL IS PART OF THE PRICE, not only part of the turn. Without this line a Charizard
   * holding its own Charizardite Y prices Fling at 80 base power at CLICK time and then fails it at
   * TURN time -- the damage table would offer a searcher a move that cannot happen, which is the one
   * direction a valuation error is not recoverable from. Same reader Knock Off's boost asks. */
  if(itemRefusesTake(att))return 0;
  const p=TAGS.param('item',att.item,'flingable');
  return (p&&+p.basePower)||0;
}
function itemRefusesTake(m){
  if(!m||!m.item||!holdsMegaStone(m.item))return false;
  const K=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const T=megaIntoTable();
  const here=K(m.name);
  const base=T.rev[here]||here;      // a mega forme maps back to the base the stone names
  return !!T.fwd[K(m.item)+'|'+base];
}
/* A MEGA NEVER CHANGES ITS MOVESET, so a mega row with `mv: []` is never legitimate -- it is a hole in
 * data/engine-data.js and the body it produces THREATENS NOTHING, which every scorer in this project
 * reads as a harmless Pokemon. Six of the 81 mega rows are empty and the base is found through the
 * INVERTED `into` map rather than by stripping the suffix, because `floette-mega`'s base is
 * `floette-eternal` and no string surgery gets there. Both outcomes are counted: recovering the base's
 * moves, and failing to (salamence-mega, latios-mega, latias-mega and diancie-mega have no base row in
 * this dataset at all -- 6, 0, 0 and 0 ladder sides between them). */
function megaRowMoves(key,m){
  const mv=(m&&m.mv)||[];
  if(mv.length||!/-mega(-x|-y)?$/.test(String(key)))return mv;
  const base=megaIntoTable().rev[key];
  const b=monRow(base);
  if(b&&(b.mv||[]).length){
    MEDSEEN.megaMovesFromBase++;
    if(!MEDSEEN.megaMovesFromBaseFirst)MEDSEEN.megaMovesFromBaseFirst=key+' <- '+base;
    return b.mv;
  }
  MEDFAILS.megaRowNoMoves++;
  if(!MEDFAILS.megaRowNoMovesFirst)MEDFAILS.megaRowNoMovesFirst=key;
  return mv;
}
/* A mega row with NO ABILITY OF ITS OWN. Exactly one exists (`floette-eternal-mega`), and the answer
 * is NOT its base's ability -- a mega's whole point is that the ability changes. It is the SIBLING
 * forme the artifact names for the same base (`floette-mega`, Fairy Aura). Counted either way. */
function megaRowAbility(key,m){
  if(m&&m.ab)return m.ab;
  if(!/-mega(-x|-y)?$/.test(String(key)))return (m&&m.ab)||'';
  const T=megaIntoTable();
  const sib=T.forBase[T.rev[key]||''];
  const s=(sib&&sib!==key)?monRow(sib):null;
  if(s&&s.ab){
    MEDSEEN.megaAbilityFromSibling++;
    if(!MEDSEEN.megaAbilityFromSiblingFirst)MEDSEEN.megaAbilityFromSiblingFirst=key+' <- '+sib;
    return s.ab;
  }
  MEDFAILS.megaRowNoAbility++;
  if(!MEDFAILS.megaRowNoAbilityFirst)MEDFAILS.megaRowNoAbilityFirst=String(key);
  return '';
}
/* ---- THE NATURE, WHICH IS A FACT AND THEREFORE LIVES IN ONE PLACE -------------------------------
 *
 * A Showdown OPEN TEAM SHEET reveals the NATURE. It does NOT reveal the spread -- every stored sheet
 * reads `"evs": null`, on 173,784 of 173,784 bodies in the frozen store, and that is not an ingest gap
 * but what the game shows. So the nature is the largest legal lever left on a body we can observe, and
 * it was being thrown away: engine/game_differential.js hardcoded `nature: 'Serious'` on both sides.
 *
 * WHY IT IS HERE AND NOT IN THE HARNESS. CLAUDE.md: FEATURES ARE PER-MODEL, FACTS ARE GLOBAL. "Modest
 * is +SpA / -Atk" and "the multiply truncates in fixed point" are facts about Pokemon; two files that
 * both decide them will disagree eventually and the disagreement will be invisible because both keep
 * working. This file already had the chart TWICE in spirit -- PASTE_NAT with a float `Math.floor(x*1.1)`
 * -- and the differential was about to grow a third copy. One function, everybody calls it.
 *
 * THE ARITHMETIC IS SHOWDOWN'S, VERBATIM (sim/battle.ts statModify, and data/mods/champions/scripts.ts
 * which overrides the pre-nature half and not this half):
 *     stat = tr(tr(stat * 110, 16) / 100)          tr(n, 16) === (n >>> 0) % 65536
 * The 16-bit wrap is UNREACHABLE at level 50 -- it first bites at a stat of 596 and the largest legal
 * line in this format is ~232 -- and is carried anyway, because "the same in the range we use" is
 * exactly how two engines come apart later. Measured: float `floor(s*1.1)` and this agree on every
 * s < 596 and part on 405 values above it.
 *
 * HP TAKES NO NATURE. Champions applies the multiplier AFTER adding SP (CLAUDE.md), which is what
 * natureL50 does and what buildMonFromSet's pasted spreads have always done. */
const NATURE_SHIFT={adamant:['at','sa'],jolly:['sp','sa'],modest:['sa','at'],timid:['sp','at'],
  bold:['df','at'],calm:['sd','at'],careful:['sd','sa'],impish:['df','sa'],relaxed:['df','sp'],
  sassy:['sd','sp'],quiet:['sa','sp'],brave:['at','sp'],naive:['sp','sd'],hasty:['sp','df'],
  lonely:['at','df'],mild:['sa','df'],rash:['sa','sd'],gentle:['sd','df'],naughty:['at','sd'],lax:['df','sd']};
/* The five neutral natures (Hardy, Docile, Serious, Bashful, Quirky) are ABSENT ON PURPOSE and read
 * as {plus:null,minus:null} -- they shift nothing, so a membership row for them would be a row that
 * does nothing, and tests/test-nature-differential.js checks all 25 against the format dex. */
function natureShift(n){ const p=NATURE_SHIFT[String(n||'').toLowerCase()];
  return {plus:p?p[0]:null,minus:p?p[1]:null}; }
function natureStat(stat,nature,key){
  const p=NATURE_SHIFT[String(nature||'').toLowerCase()];
  if(!p)return stat;
  const pct=p[0]===key?110:(p[1]===key?90:0);
  if(!pct)return stat;
  return Math.trunc((((stat*pct)>>>0)%65536)/100);
}
// level-50 stat line, identical convention to champ-model's statL50/hpL50 (Champions SP system)
/* `nature` is the THIRD argument and defaults to nothing, so every existing caller -- buildMon, the
 * mega swap, board.js's consumers, every probe -- gets byte-identical numbers to before. A nature is
 * something a caller must ASK for; it is never inferred. */
function l50(bs,sp,nature){ const S=(b,v,k)=>natureStat(Math.floor((Math.floor((2*b+31)*50/100)+5+(+v||0))),nature,k);
  return { hp:Math.floor((2*bs.hp+31)*50/100)+50+10, at:S(bs.atk,sp&&sp.at,'at'), df:S(bs.def,sp&&sp.df,'df'),
           sa:S(bs.spa,sp&&sp.sa,'sa'), sd:S(bs.spd,sp&&sp.sd,'sd'), sp:S(bs.spe,sp&&sp.sp,'sp') }; }
/* The flat level-50 line under a NAMED nature, no SP. Exported because engine/game_differential.js
 * needs exactly this and used to write its own copy of the formula; see its buildPair header. */
function natureL50(bs,nature){ return l50(bs,null,nature); }
/* ONE DOORWAY INTO MC.mons FROM THIS FILE, and it is a ratchet rather than a preference.
 * tests/test-mc-key.js bans a computed index into the species table because four separate callers
 * wrote their own and two of them were silently broken for 8.17% of the metagame. This file is
 * BASELINED as an exception -- it is a browser file and cannot `require('./mc_key.js')` -- but an
 * exception is not a licence to grow, and WIRE 132 needed four more lookups. So every computed index
 * in this file now goes through this one line, which is what the exception was for. */
function monRow(key){ return (key&&MC.mons[key])||null; }
function buildMon(name,ov){ const m=monRow(name); if(!m)return null;
  /* AN EXPLICIT EMPTY STRING MEANS NO ITEM, and `||` could not express that: buildMon(n,{n:''})
   * fell through to the table item, so an item-less mon was unbuildable. Every with-item/without-item
   * ratio was therefore item vs THE TABLE'S ITEM, not item vs nothing -- it only looked right while
   * the table happened to store something inert. The moment real sheets put Life Orb on Garchomp,
   * tests/test-tag-wire.js measured Life Orb against Life Orb and got x1.000. Caught 2026-07-31 when
   * the sets were rebuilt from open sheets. */
  const item=(ov&&ov[name]!=null)?ov[name]:(m.item||'');
  const mf=megaForme(item);
  const types = mf&&mf.t&&mf.t.length ? mf.t.slice() : m.t.slice();
  /* Swap ONLY the base stats, keeping whatever SP investment this dataset already baked into m.st.
     Recomputing from scratch would silently drop the spread and make the mega look weaker than the
     base form. So: work out the SP the stored line implies, then re-apply it to the mega's bases. */
  let st = {...m.st};
  if(mf&&mf.bs){
    const base=l50(m.bs||{hp:0,atk:0,def:0,spa:0,spd:0,spe:0});
    const meg =l50(mf.bs);
    if(m.bs){ st={ hp:meg.hp+(m.st.hp-base.hp), at:meg.at+(m.st.at-base.at), df:meg.df+(m.st.df-base.df),
                   sa:meg.sa+(m.st.sa-base.sa), sd:meg.sd+(m.st.sd-base.sd), sp:meg.sp+(m.st.sp-base.sp) }; }
    else { st=meg; }
  }
  /* WIRE 83 -- BEAT UP READS BASE ATTACK, not the built stat, so the row's own number is carried on
     the body. Stamped here because this is the one place that already holds the MC.mons row: a
     second hand-rolled index into the mon table inside dmgRange would be a fifth doorway into it,
     which is exactly what tests/test-mc-key.js ratchets against. A mega's base stats win, because
     Beat Up asks the species standing on the field. */
  const _bsAtk=((mf&&mf.bs&&mf.bs.atk)||(m.bs&&m.bs.atk)||0);
  /* WIRE 132 -- a mega ROW is allowed to be incomplete in data/engine-data.js and the body built
   * from it is not: an empty `mv` means this Pokemon threatens nothing, which is invisible to
   * every scorer in the project. Both recoveries are counted. */
  const _rowAb=megaRowAbility(name,m);
  /* ---- ROADMAP #31 -- A STONE-HOLDER IS BUILT AS ITS BASE FORME, HOLDING THE STONE ---------------
   *
   * It used to be built as a CHIMERA and nobody could see it, because the two halves failed in
   * opposite directions and cancelled: `megaForme()` reads `window.MEGA_FORMES`, which does not exist
   * under node, so the STATS stayed base; `megaAbility()` reads a module-level table, which always
   * works, so the ABILITY was already the mega's. Measured before a line of this changed:
   *
   *     buildMon('gengar', {})  ->  stats 135/76/80/200/95/170  (BASE)   ability shadowtag  (MEGA)
   *
   * Showdown's Gengar has Cursed Body until it evolves on a CHOICE, mid-turn. So on line one of every
   * game carrying a stone the two engines already disagreed about the ability standing on the field,
   * and engine/game_differential.js had to strip 460 stone sets to run at all.
   *
   * The body now carries the base row's ability and the capability -- `megaTargetFor()` reads the
   * name and the item back off it -- and battleTurn's mega phase performs the evolution. The mega's
   * ability arrives from `megaRowAbility(megaKey)`, which equals the dex's slot-0 ability for the
   * mega forme on ALL 74 megas in this format (measured; tests/test-mega-timing.js asserts it against
   * `Dex.forFormat(...)` rather than trusting this sentence).
   *
   * megaAbility() IS STILL THE ANSWER for a body built FROM its mega row (`buildMon('gengar-mega')`,
   * which buildMonFromSet resolves a pasted "Gengar @ Gengarite" to) -- that body is already
   * evolved. The branch below is only for a BASE forme that can still become one. */
  const _canMega=megaTargetFor({name,item});
  if(_canMega){ MEDSEEN.megaCapableBuilt++; }
  return {name,types,st,item,wt:m.wt||null,_bsAtk,_ident:name,
    ability:normAb(_canMega?(_rowAb||''):megaAbility(name,item,_rowAb||'')),baseAbility:normAb(_rowAb||''),moves:megaRowMoves(name,m).slice(),
    curHP:st.hp,boosts:{at:0,df:0,sa:0,sd:0,sp:0,acc:0,eva:0},status:'',slp:0,fainted:false,protect:false,tookProtectTurns:0,_turnsOut:0,_flinch:false,_seededBy:null,
    /* THE DEATH COUNTER (Will: "the supreme overlord needs a count of the dead like last
     * respects"). _sf is a per-SIDE live counter shared by reference — Last Respects reads it at
     * each use. _fallenStuck is the SNAPSHOT taken when this mon entered — Supreme Overlord's
     * number, frozen for the stay exactly as its handler freezes effectState.fallen ("that only
     * works on first switchin, then the status is tuck" — confirmed against the source). */
    _sf:null,_fallenStuck:0}; }

/* ---- POKEPASTE IMPORT (Will: "can i pokepaste a team?") --------------------------------------
 * Mirrors CHOMP/engine/champ-model.js parsePaste + its VALIDATED stat math, and
 * tests/test-paste.js pins the two implementations together against Will's own myteam.txt so they
 * cannot drift apart. The math that matters and would have been silently wrong from memory:
 * Champions EVs are FLAT stat points added on top (statL50 adds +sp inside the nature multiply,
 * hpL50 adds +sp after) — NOT the mainline EV/4 formula. Nature is the standard 10% chart.
 *
 * THE CHART USED TO LIVE HERE AS `PASTE_NAT` AND IT IS NOW `NATURE_SHIFT`, one screen up, because the
 * differential needed the same fact and a second copy of "Modest is +SpA / -Atk" is the two-files-one-
 * fact breach CLAUDE.md names. The paste path's own multiply was `Math.floor(x * 1.1)`; it is now
 * `natureStat`, which is Showdown's fixed-point form. The two agree on every value below 596 (measured)
 * so no pasted team changes, and they part above it, where the float one was simply wrong. */
function parsePaste(text){
  const sets=[];
  for(const block of String(text||'').split(/\n\s*\n/)){
    const lines=block.trim().split('\n').map(l=>l.trim()).filter(Boolean);
    if(!lines.length)continue;
    let head=lines[0]; if(/^(===|\[)/.test(head))continue;
    const at=head.split(' @ ');
    const item=at.length>1?at[1].trim():null;
    let species=at[0].trim();
    const par=species.match(/\(([^)]+)\)\s*$/);
    if(par&&!['M','F'].includes(par[1]))species=par[1];
    species=species.replace(/\s*\((M|F)\)\s*$/,'').trim();
    const set={species,item,ability:null,nature:null,sp:{hp:0,at:0,df:0,sa:0,sd:0,sp:0},moves:[]};
    for(let i=1;i<lines.length;i++){
      const L=lines[i];
      if(/^Ability:/i.test(L))set.ability=L.split(':')[1].trim();
      else if(/Nature/i.test(L))set.nature=L.replace(/Nature/i,'').trim();
      else if(/^EVs:/i.test(L)){L.split(':')[1].split('/').forEach(p=>{
        const m2=p.trim().match(/(\d+)\s*(\w+)/);
        if(m2){const k={hp:'hp',atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp'}[m2[2].toLowerCase()];if(k)set.sp[k]=+m2[1];}});}
      else if(/^-\s/.test(L))set.moves.push(L.replace(/^-\s*/,'').split('/')[0].trim());
    }
    if(set.species)sets.push(set);
  }
  return sets;
}
/* species name -> MC.mons key: lowercase, spaces to hyphens (the table's own convention),
 * -mega suffix stripped because the STONE decides the forme, exactly as buildMon does */
function pasteKey(name){
  let n=String(name||'').toLowerCase().trim().replace(/[’'.]/g,'').replace(/\s+/g,'-');
  n=n.replace(/-mega(-[xy])?$/,'');
  if(monRow(n))return n;
  const flat=n.replace(/-/g,'');
  for(const k in MC.mons)if(k.replace(/-/g,'')===flat)return k;
  return null;
}
function buildMonFromSet(set){
  let key=pasteKey(set.species);
  if(!key)return null;
  const item=String(set.item||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  /* THE STONE DECIDES THE FORME, and in THIS table megas are their own species entries with real
   * base stats — so "Gengar @ Gengarite" must resolve to gengar-mega's bs, or the import builds a
   * mega with base stats (caught by the champ-model contract test: SpA 182 where truth is 222). */
  let becameMega=false;
  /* WIRE 111 -- "is this item a mega stone" is the artifact's (`megaStone`, 75 carriers), not a
   * name-shape regex. The regex stays as the OR-fallback so a stone the artifact has not derived yet
   * still megas, and because the X/Y SUFFIX genuinely lives in the item name -- the tag's `into`
   * table does not distinguish the two Charizardites' formes by shape. */
  /* WIRE 132 -- the forme comes from the artifact's `megaStone.into`, not from a concatenated
   * suffix. Both differing pairs are named at megaIntoTable(); the suffix stays as the counted
   * fallback inside megaKeyFor. */
  if((TAGS.has('item',item,'megaStone')||/ite(x|y)?$/.test(item))&&!/-mega/.test(key)){
    const mk=megaKeyFor(key,item);
    if(mk){key=mk;becameMega=true;}
  }
  const m=monRow(key);
  if(!m||!m.bs)return null;
  const bs=m.bs;
  const types=m.t.slice();
  /* ONE CHART, ONE MULTIPLY — see the header above. `l50` cannot be reused wholesale here because a
   * pasted set adds SP to HP as well, which l50 (and every sheet-built body) never does. */
  const S=(b,sp2,st2)=>natureStat(Math.floor((Math.floor((2*b+31)*50/100)+5+(+sp2||0))),set.nature,st2);
  const st={hp:Math.floor((2*bs.hp+31)*50/100)+50+10+(+set.sp.hp||0),
    at:S(bs.atk,set.sp.at,'at'),df:S(bs.def,set.sp.df,'df'),
    sa:S(bs.spa,set.sp.sa,'sa'),sd:S(bs.spd,set.sp.sd,'sd'),sp:S(bs.spe,set.sp.sp,'sp')};
  const norm2=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const declaredAb=norm2(set.ability);
  /* Keep every move the engine can DO anything with: damaging (move table), protect-class, or a
   * rulebook status move. Protect and Perish Song were being dropped by a damaging-only filter —
   * a pasted team without its Protects is a different team. Truly invisible moves are recorded on
   * droppedMoves so a UI can disclose them instead of silently thinning the set. */
  const ids=set.moves.map(norm2);
  const usable=ids.filter(id=>MC.moves[id]||PROTECTMOVES.has(id)||id==='wideguard'||id==='tailwind'||moveFx(id));
  /* THE STONE DECIDES THE ABILITY TOO, not just the forme -- and this line used to let the SHEET win.
   * A team sheet lists the PRE-mega ability ("Scizor ... Ability: Swarm"), so `declaredAb ||` handed
   * a mega body its base forme's ability every single time a paste declared one, which is the exact
   * gap tests/test-effective-identity.js was written about, living in the engine rather than in
   * board.js. `becameMega` is true only on the branch that just swapped the key to a mega row, so a
   * NON-mega set keeps the old precedence and a declared Rough Skin still beats the dataset's Sand
   * Veil. If the mega row has no ability of its own the sheet is still better than nothing. */
  const rowAb=normAb(megaAbility(key,item,megaRowAbility(key,m)||''));
  /* `_nature` RIDES ON THE BODY because the stat line is not the last time it is needed: megaEvolveNow
   * recomputes both of its anchors and must apply the same shift, or a mega lands short by
   * (mul - 1) x (mega - base) on exactly the stat the nature moved. A body with no `_nature` is treated
   * as neutral, which is every body built before this existed. */
  return {name:key,types,st,item,wt:m.wt||null,_nature:set.nature||null,
    ability:(becameMega&&rowAb)?rowAb:(declaredAb||rowAb),baseAbility:normAb(m.ab||''),
    moves:usable,droppedMoves:ids.filter(id=>usable.indexOf(id)<0),
    curHP:st.hp,boosts:{at:0,df:0,sa:0,sd:0,sp:0,acc:0,eva:0},status:'',slp:0,fainted:false,protect:false,
    tookProtectTurns:0,_turnsOut:0,_flinch:false,_seededBy:null,_sf:null,_fallenStuck:0};
}

/* Does this move make contact? Read from the move's own flag via the tag artifact, which is the
 * `contact` linkage key -- 141 moves and 77,226 move-slots. No name list. */
const _contactCache=Object.create(null);
function mvMakesContact(id){
  if(!id) return false;
  const k=String(id).toLowerCase().replace(/[^a-z0-9]/g,'');
  if(k in _contactCache) return _contactCache[k];
  return (_contactCache[k]=TAGS.has('move',k,'contact'));
}

/* WIRE 35 -- THE CRIT RATE, IN ONE PLACE, because this engine had exactly two crit facts and both
 * were wrong. The battle loop rolled a flat `rng()<1/24` for EVERY move and every defender, and
 * `dmgRange` carried no crit at all -- so Flower Trick, Storm Throw and Frost Breath, which crit
 * ALWAYS, were priced and resolved as ordinary moves, and Shell Armor did nothing whatever.
 *
 * MEASURED BEFORE IT WAS WIRED, the way the terrain vocabulary was: over 48,274 stored games, 7.53%
 * carry a crit-tag move on an observed set -- 1.68% an `alwaysCrit` move, 5.98% a `critRatioUp` one.
 * `preventsCrit` outside Disguise (Shell Armor, Battle Armor, Ice Face) is 41 games, 0.08%.
 * The two halves are NOT the same size of error: alwaysCrit is a DETERMINISTIC x1.5 the pricer was
 * missing on every one of 278 clicks, while critRatioUp moves 1/24 to 1/8, an expectation difference
 * of about 4% on 1,162 clicks.
 *
 * WHICH IS WHY THE TWO HALVES LAND IN DIFFERENT PLACES. `alwaysCrit` is a certainty and belongs in
 * `dmgRange`, where it becomes part of the range the searcher prices -- and it is what Showdown's own
 * `willCrit` does, so the differential agrees with it. `critRatioUp` is a RATE and must NOT go in
 * dmgRange: folding an expectation into a min/max would stop `max` being the maximum roll and would
 * put every ratio move permanently out of step with the differential's no-crit comparison. It rides
 * the battle loop's roll instead, which is where the 1/24 already lived.
 *
 * STAGES, NOT MULTIPLIERS: Gen-6+ crit chance is 1/24, 1/8, 1/2, 1 by stage, and `critRatio: 2` in
 * the artifact means one stage up. Move and ITEM (Scope Lens) stack; the two ABILITY carriers are
 * refused and counted -- see MEDFAILS.critRatioAbility. */
const CRIT_BY_STAGE=[1/24,1/8,1/2,1];
function critChance(moveId,att,defAbility){
  /* THE DEFENDER ARRIVES AS AN ABILITY STRING, NOT A BODY, so a Mold Breaker attacker can hand in the
   * SUPPRESSED ability (WIRE 37) without this function having to know what suppression is. */
  if(defAbility&&TAGS.param('ability',defAbility,'preventsCrit'))return 0;
  const _ac=TAGS.param('move',moveId,'alwaysCrit');
  if(_ac&&+_ac.pCrit===1)return 1;
  let stage=0;
  const _mv=TAGS.param('move',moveId,'critRatioUp');
  if(_mv&&+_mv.critRatio>1)stage+=(+_mv.critRatio-1);
  if(att){
    const _it=TAGS.param('item',att.item,'critRatioUp');
    if(_it&&+_it.critRatio>1)stage+=(+_it.critRatio-1);
    if(TAGS.param('ability',att.ability,'critRatioUp'))MEDFAILS.critRatioAbility++;
  }
  return CRIT_BY_STAGE[Math.min(stage,CRIT_BY_STAGE.length-1)];
}
/* The compact move table stores no id on the move object, and dmgRange's signature is shared with
 * every caller, so the id is stamped ONTO the table once -- derived from the table's own key, which
 * is the id. Lazy because in the browser this module can load before window.MC does. */
let _mvIdsStamped=false;
function stampMoveIds(){
  if(_mvIdsStamped)return;
  const T=(typeof MC!=='undefined'&&MC&&MC.moves)?MC.moves:null; if(!T)return;
  for(const k in T)if(T[k]&&typeof T[k]==='object')T[k].id=k;
  _mvIdsStamped=true;
}
/* WIRE 7 -- weatherScaled, accuracy half. Thunder and Hurricane are 100-acc in rain and 50 in sun,
 * Blizzard is 100 in snow; the ACC table alone said 70/70/70 in every sky. The artifact names the
 * weather and the number; this helper is the single accuracy authority for both the battle loop's
 * to-hit roll and chooseAction's expected-value scoring. */
/* WIRE 129 -- THE PRINTED ACCURACY, WITH `true` KEPT AS `true`. moveAccuracy() collapses "cannot
 * miss" and "prints 100" onto the same number, and for a to-hit ROLL that is the same thing. It is
 * NOT the same thing once evasion exists: Showdown skips the boost table and every ModifyAccuracy
 * handler when `accuracy === true`, so Swift is unaffected by a +6 Minimize while Ice Beam is cut to
 * 3/9 of its 100. This is the one function that can tell them apart; moveAccuracy is now its wrapper,
 * unchanged in signature and in every value it returns, because it is one of the exports board.js and
 * engine/position_features.js read and its meaning may not move under them. */
function printedAccuracy(id,field){
  stampMoveIds();
  const _ws=TAGS.param('move',id,'weatherScaled');
  /* WIRE 78 — Thunder is 70 again under Air Lock. `field.wSup` is the only reader available here:
     moveAccuracy is handed no bodies at all, which is the same signature gap writesAccuracy and
     accuracyMod are blocked on (see docs/ENGINE.md). */
  if(_ws&&_ws.byWeather&&field&&field.weather&&!field.wSup){
    const w=_ws.byWeather[field.weather];
    /* THE ARTIFACT WRITES 100 WHERE SHOWDOWN WRITES `true`. Thunder's onModifyMove in rain is
     * `move.accuracy = true`, and data/abra-tags.js records it as the number 100 -- a lossy step in
     * tag_dex's derivation, not a rule. Read back as "cannot miss", which is what the real move does:
     * a rain Thunder goes through a Double Team. Stated rather than silently rounded. */
    if(w&&w.accuracy!=null)return w.accuracy>=100?true:w.accuracy;
  }
  /* WIRE 124 -- the printed accuracy, from the generated artifact rather than a hand list. `true` is
   * how the dex spells "cannot miss"; a number is the number. A move neither source knows is the one
   * case that still defaults to 100, and it COUNTS ITSELF: a silent default here reads exactly like a
   * never-miss move, which is the bug this wire is fixing. */
  const key=String(id||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(ACC_FIX[key]!=null)return ACC_FIX[key];
  let fx=null;
  /* THE ONLY WAY moveFx THROWS is data/move-effects.js not being loaded at all, and the reason is
   * KEPT rather than discarded: without it every move in the game silently becomes 100% accurate,
   * which is the exact defect this wire exists to remove, and a caller looking at `fails` afterwards
   * needs to be able to tell that from "the table was there and this move was not in it". */
  try{ fx=moveFx(key); }
  catch(e){ MEDFAILS.accuracyNoTable++;
            if(!MEDFAILS.accuracyNoTableFirst)MEDFAILS.accuracyNoTableFirst=String(e.message).slice(0,80); }
  if(fx&&fx.accuracy!=null)return fx.accuracy===true?true:+fx.accuracy;
  MEDFAILS.accuracyUnknown++;
  if(!MEDFAILS.accuracyUnknownFirst)MEDFAILS.accuracyUnknownFirst=key;
  return 100;
}
/* THE UNCHANGED EXPORT. Same signature, same numbers, `true` folded back to 100 exactly as before --
 * so board.js, position_features.js and chooseAction see nothing move. */
function moveAccuracy(id,field){const a=printedAccuracy(id,field);return a===true?100:a;}

/* ---- WIRE 129 — ACCURACY MODIFICATION -----------------------------------------------------------
 *
 * ~5,000 corpus uses of "does this move actually hit" reaching the engine through FOUR doors, none
 * of them wired and none of them probed: move|accuracyMod (Coil 2,351 / Minimize 1,050 / Gravity
 * 616), item|accuracyMod (Wide Lens 757 / Bright Powder 208 / Zoom Lens 43), ability|accuracyMod
 * (Sand Veil 307 / Snow Cloak 353 / Compound Eyes / Hustle) and ability|writesAccuracy (No Guard).
 *
 * THE STAGE TABLE IS NOT THE STAT TABLE, and this is the half a hand-rolled version gets wrong.
 * Stat stages are (2+n)/2; accuracy and evasion stages are (3+n)/3 -- sim/battle-actions.ts,
 * `const boostTable = [1, 4/3, 5/3, 2, 7/3, 8/3, 3]`. Reusing boostMul would price +1 accuracy at
 * 1.5x instead of 1.33x and +6 at 4x instead of 3x. */
const ACC_STAGE=[3/9,3/8,3/7,3/6,3/5,3/4,1,4/3,5/3,2,7/3,8/3,3];
const accStageMul=(n)=>ACC_STAGE[clamp(Math.round(+n||0),-6,6)+6];

/* THE MODIFIER TABLE, AND WHY THE ARTIFACT CANNOT SUPPLY IT.
 *
 * Membership is asked of the TAG -- an entity carrying accuracyMod or writesAccuracy with NO row
 * here is COUNTED and named (MEDFAILS.accModUntabled), which is the difference between a table and a
 * hand list. What the table adds is the NUMBER and the DIRECTION, and data/abra-tags.js has the
 * direction BACKWARDS on every carrier: tag_dex derives `scope` by putting onModifyAccuracy under
 * "its own moves" and onSourceModifyAccuracy under "moves aimed at it", and Showdown fires
 * onModifyAccuracy on the TARGET and onSourceModifyAccuracy on the ATTACKER. So the artifact records
 * Sand Veil as boosting its own moves and Compound Eyes as boosting the foe's. tag_dex.js is
 * corrected in this pass; the artifact could not be regenerated (see docs/ENGINE.md), so NOTHING here
 * reads `scope` and the correction is checked instead:
 *
 * tests/test-engine-diff.js re-derives every accuracy-touching ability and item out of the live
 * format dex and FAILS on a row this table has wrong, missing or invented -- the same treatment
 * ACC_FIX gets, and the only thing that makes a table different in kind from a literal. */
const ACCMOD={
  'item:widelens':      {side:'att',mult:1.1},
  'item:zoomlens':      {side:'att',mult:1.2,when:'targetAlreadyMoved'},
  'item:brightpowder':  {side:'def',mult:0.9},
  'item:laxincense':    {side:'def',mult:0.9},
  'ability:compoundeyes':{side:'att',mult:1.3},
  'ability:hustle':      {side:'att',mult:0.8,when:'physical'},
  'ability:sandveil':    {side:'def',mult:0.8,when:'sand'},
  'ability:snowcloak':   {side:'def',mult:0.8,when:'snow'},
  'ability:wonderskin':  {side:'def',setTo:50,when:'status'},
  'ability:noguard':     {side:'both',never:true},
  /* DECLARED NO-OPS, so they are not counted as untabled and not silently applied either.
   * `tangledfeet` needs the CONFUSION volatile and this engine has no confusion at all -- there is
   * no state for it to read, so it is off rather than half-on (4 corpus uses).
   * `skilllink` is a FALSE POSITIVE in the artifact: tag_dex's writesAccuracy probe matches /accuracy/
   * and Skill Link's onModifyMove says `delete move.multiaccuracy`. It writes multihit, not accuracy. */
  'ability:tangledfeet': {side:'def',mult:0.5,off:'no confusion volatile exists in this engine'},
  'ability:skilllink':   {side:'att',off:'artifact false positive — it writes multihit, not accuracy'},
  /* Victory Star's hook is onAnyModifyAccuracy and its guard is `source.isAlly(...)` -- it boosts the
   * WHOLE SIDE's accuracy, its partner's as well as its own. hitChance sees one attacker and one
   * defender and has no side in its hands, so wiring it as a self-only 1.1x would be half the
   * mechanic. Victini has no usage in this regulation, so the honest state is off-with-a-reason
   * rather than half-on: a tag consumed half-right is how the 20-mechanic batch went wrong. */
  'ability:victorystar': {side:'att',mult:1.1,off:'its onAnyModifyAccuracy boosts the whole SIDE and hitChance has no side'},
};
/* A CARRIER WITH NO ROW IS LOUD. A silent default here looks exactly like a working feature, which is
 * this project's signature failure -- and the tag set is generated, so a new Gen-10 evasion ability
 * arrives in the artifact and has to announce itself rather than quietly doing nothing. */
function accModRow(kind,id){
  const key=String(id||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!key||key==='none')return null;
  const row=ACCMOD[kind+':'+key];
  if(row)return row.off?null:row;
  if(TAGS.has(kind,key,'accuracyMod')||TAGS.has(kind,key,'writesAccuracy')){
    MEDFAILS.accModUntabled++;
    if(!MEDFAILS.accModUntabledFirst)MEDFAILS.accModUntabledFirst=kind+':'+key;
  }
  return null;
}
/* Does an entity refuse to miss in BOTH directions? No Guard is the only one, and it is asked by
 * SHAPE (`never`) rather than by name so a second one needs a table row and no code. */
const _neverMissAb=(mon)=>{
  if(!mon)return false;
  const r=accModRow('ability',mon.ability);
  return !!(r&&r.never);
};
/* THE ONE PLACE A CONDITION ON A MODIFIER IS EVALUATED. Each `when` is a real gate in the reference
 * engine, and getting one wrong is invisible -- Sand Veil outside sand is a 20% evasion bonus that
 * never appears in a log. */
function _accWhen(w,ctx){
  if(!w)return true;
  if(w==='sand')return ctx.weather==='sand';
  if(w==='snow')return ctx.weather==='snow';
  if(w==='physical')return ctx.cat==='Physical';
  if(w==='status')return ctx.cat==='Status';
  /* Zoom Lens: Showdown asks `!this.queue.willMove(target)` -- the holder is slower, so the target
   * has already gone. `unresolved` is this turn's outstanding actions and is the same set WIRE 118's
   * flinch timing reads, so there is one answer to "has this body acted yet" and not two. */
  if(w==='targetAlreadyMoved')return ctx.targetAlreadyMoved===true;
  MEDFAILS.accModUnknownWhen++;
  return false;
}

/* ---- WIRE 130 — THE SUBSTITUTE WAS PAID FOR AND NEVER BUILT ------------------------------------
 *
 * `playerAction` resolves Substitute to kind `affect` (it carries statusInflict with a
 * volatile), so the `kind==='sub'` branch WIRE 42 wrote for it is unreachable and always was. What
 * ran instead was the generic costsUserHP deduction at the top of the resolution loop: the click paid
 * a quarter of max HP and produced nothing at all. Measured before a line changed, a Garchomp on 183:
 *
 *     clicked Howl       then took Ice Beam ->  turn-1 cost 0    turn-2 damage 183
 *     clicked Substitute then took Ice Beam ->  turn-1 cost 45   turn-2 damage 138   _sub 0
 *
 * That is 1,976 corpus clicks of a move that is STRICTLY WORSE THAN PASSING — the exact
 * one-directional error WIRE 42's own comment says it was landed to avoid, sitting under no probe.
 *
 * MEMBERSHIP PRINTED BEFORE IT WAS WIRED, per docs/LESSONS.md 4. `move|substitute` matches exactly
 * two rows and both are real: substitute (buffer 0.25) and shedtail (buffer 0.25, and it pays HALF
 * for the same quarter-size doll — the buffer is read from the tag, never from the cost). */
/* ROADMAP #81 WIRE 7 -- THE DOLL ANNOUNCES ITS SOURCE MOVE.
 *
 * ROADMAP #81 WIRE 12 -- AND WIRE 7's OTHER CLAIM WAS A MISQUOTE THAT COST A WORKING MECHANIC. That
 * wire's comment quoted `this.effectState.hp = Math.ceil(target.maxhp / 4);` and moved this line from
 * `Math.floor` to `Math.ceil` on the strength of it. **data/moves.ts:18328 says `Math.floor`.**
 * Staged against the authority and read out of the live volatile rather than inferred from a break:
 *
 *     Heliolisk 137 maxhp, Shed Tail   ->  doll 34   (floor 34, ceil 35)  -- this engine built 35
 *     Farigiraf 195 maxhp, Substitute  ->  doll 48   (floor 48, ceil 49)  -- this engine built 49
 *
 * So WIRE 7 was a REGRESSION on a mechanic that had been right, and the probe that was written for it
 * asserted the wrong rounding and went green. The number is now READ OUT OF THE HANDLER by tag_dex
 * (`substitute.rounds`), for both members, because a third reading of the same line by hand is the
 * one thing certain to happen otherwise. The COST is unchanged and is a separate rounding again --
 * `directDamage(maxhp / 4)` truncs for Substitute, `directDamage(Math.ceil(maxhp / 2))` rounds UP for
 * Shed Tail -- and both now come from `costsUserHP.rounds`.
 *
 * THE `[from]` LABEL IS READ OFF THE MOVE ID THIS FUNCTION IS ALREADY HANDED, which is the declared
 * fact -- the same read the encore/disable branches make. `substitute` is the move whose own condition
 * this is, so it labels nothing; anything else that raises the doll says so, which today is Shed Tail
 * and tomorrow is whatever else the tag picks up. */
function grantSubstitute(m,moveId){
  const _sb=TAGS.param('move',moveId,'substitute');
  if(!_sb||m._sub>0||!m.st)return;
  const _rd=_sb.rounds==='ceil'?Math.ceil:_sb.rounds==='round'?Math.round:Math.floor;
  m._sub=Math.max(1,_rd(m.st.hp*(+_sb.buffer||0.25)));
  if(TR)TR.vstart(m,'Substitute',moveId&&moveId!=='substitute'?'[from] move: '+moveId:'');
}
/* ---- ROADMAP #81 WIRE 7 -- A BERRY IS AN `onUpdate`, NOT A RESIDUAL -----------------------------
 *
 * Sitrus is the second-most-held item in the format (13,079 uses) and Lum's family is beside it, and
 * both fired in this engine ONLY at the end of the turn. In the authority they are `onUpdate`
 * handlers, and `Battle.eachEvent('Update')` runs after EVERY action -- and once more inside
 * `spreadMoveHit`, immediately after the damage (sim/battle-actions.ts:1003). So the berry is eaten
 * between the two attackers of a double, not after both of them.
 *
 * THAT IS A STATE BUG, NOT A STREAM ONE, AND THE STATE IS A LIFE. Heal and damage commute, so a body
 * that survives either way ends the turn on the same HP whichever order they run in -- which is why
 * this looked like a missing `|-enditem|` line and nothing more. The case that does not commute is the
 * one that matters: a body on 55% takes a hit to 40%, eats to 65%, and SURVIVES the partner's second
 * hit. Eaten at the residual instead, the second hit kills it and the berry is never eaten at all.
 *
 * ONE IMPLEMENTATION EACH, TWO CALL SITES EACH. The residual keeps calling these at its own two
 * positions (the cure BEFORE the status chips, the pinch heal AFTER Leftovers), because the residual
 * order is Showdown's and is not what this wire is changing. What is added is the after-action pass. */
function berryCureUpdate(m){
  if(!m||m.fainted||m.curHP<=0)return;
  /* ROADMAP #92 -- A BERRY CAN BE SPENT ON A VOLATILE, NOT ONLY ON A STATUS. Lum's `onUpdate` fires on
   * `pokemon.status || pokemon.volatiles['confusion']` and Persim's fires on the volatile ALONE -- it
   * has no status handler at all, which is why the derivation gave it no cure tag until `curesVolatile`
   * learned to read `onEat`. Placed first because `curesStatus` returns early on an unstatused body,
   * so a Persim holder never reached the rest of this function. */
  if(m._vol&&m._vol.confusion>0&&itemCuresVolatile(m,'confusion'))return;
  const _cs=TAGS.param('item',m.item,'curesStatus');
  if(!(_cs&&m.status&&_cs.statuses))return;
  if(!(_cs.statuses==='any'||(Array.isArray(_cs.statuses)&&_cs.statuses.indexOf(m.status)>=0)))return;
  if(TR){TR.enditem(m,m.item,'[eat]');TR.cure(m,m.status,'[from] item: '+m.item);}
  m.status='';m.toxTurns=0;m.item='';
}
function berryPinchUpdate(m,foes){
  if(!m||m.fainted||m.curHP<=0)return;
  const _ht=TAGS.param('item',m.item,'healsAtThreshold');
  /* A FLAT RESTORE COUNTS TOO. This demanded `_ht.restores` — a FRACTION — and Oran Berry's handler
   * is `this.heal(10)`, a flat ten with no `maxhp` in it, so its param was null and the berry stayed
   * unwired. That was declared honestly in the residual loop's comment rather than hidden, and the
   * roster still read it DID-NOT-FIRE, which is the difference between a documented gap and a closed
   * one. `restoresFlat` is derived now; either form arms the berry, neither is guessed. */
  if(!(_ht&&_ht.triggersBelow&&(_ht.restores||_ht.restoresFlat)))return;
  if(healBlocked(m))return;
  /* UNNERVE stops the OTHER SIDE eating at all -- the berry is not consumed and is still there
   * afterwards, which is why the gate wraps the whole block and not only the HP line. */
  if(foes&&foes.some(x=>x&&!x.fainted&&x.curHP>0&&TAGS.param('ability',x.ability,'blocksBerries')))return;
  const _fr=s=>{const p=String(s).match(/(\d+)\s*\/\s*(\d+)/);return p?+p[1]/+p[2]:0;};
  if(m.curHP>m.st.hp*_fr(_ht.triggersBelow))return;
  const _it=m.item;
  /* The flat amount is an absolute HP count and must NOT be scaled by max HP — that is the whole
   * distinction the two fields exist to keep. */
  const _amt=_ht.restores?Math.floor(m.st.hp*_fr(_ht.restores)):+_ht.restoresFlat;
  m.curHP=Math.min(m.st.hp,m.curHP+_amt);m.item='';
  if(TR){TR.enditem(m,_it,'[eat]');TR.heal(m,'[from] item: '+_it);}
}
/* WHAT GOES THROUGH A SUBSTITUTE. Showdown's flag is `bypasssub` and NO artifact this engine reads
 * carries it -- data/move-effects.js has no flags block and data/abra-tags.js has no tag for it. So
 * it is a SET here, derived once over MC.moves against the format at the pinned commit and re-derived
 * on every run by the SUBSTITUTE-BYPASS CONFORMANCE block in tests/test-engine-diff.js, which fails
 * on a single row it does not agree with. That is the ACC_FIX pattern and the only thing that makes a
 * list different in kind from a memory.
 *
 * GETTING IT WRONG IN THE OTHER DIRECTION WOULD HAVE BEEN THE BIGGER BUG, and it was measured before
 * anything was written: the three most-clicked status moves that reach a substitute in this format --
 * ENCORE (4,848), TAUNT (1,503) and DISABLE (730) -- all carry `bypasssub` in the real game. A
 * "substitute blocks status moves" rule built on the `sound` tag alone would have blocked all three,
 * which is a worse engine than the one that blocks nothing. */
const SUBPASS=new Set(["round","snore","bugbuzz","uproar","snarl","alluringvoice","psychicnoise",
  "hypervoice","eeriespell","boomburst","sparklingaria","clangingscales","torchsong","dragoncheer",
  "encore","howl","afteryou","aromaticmist","attract","coaching","curse","defog","destinybond",
  "disable","fairylock","guardswap","haze","healbell","helpinghand","imprison","instruct","lifedew",
  "magneticflux","metalsound","nobleroar","partingshot","perishsong","powerswap","psychup",
  "reflecttype","roar","roleplay","screech","sing","skillswap","speedswap","spite","taunt","teatime",
  "torment","whirlwind"]);
/* Does the doll eat this? One implementation, asked by the damage path and by every status path, so
 * "a substitute is up" cannot mean two different things in one turn. Infiltrator comes from the
 * artifact's own `ignoresScreensAndSubs.ignoresSubstitute`, never from its name. */
function subBlocks(att,def,mvId){
  if(!def||!(def._sub>0)||def===att)return false;
  if(SUBPASS.has(String(mvId||'').toLowerCase().replace(/[^a-z0-9]/g,'')))return false;
  const _inf=att&&TAGS.param('ability',att.ability,'ignoresScreensAndSubs');
  if(_inf&&_inf.ignoresSubstitute)return false;
  return true;
}

/* THE ONE TO-HIT AUTHORITY. Every roll in the battle loop goes through it; a second implementation
 * of any part of this is WIRE 124 arriving again.
 *
 * Order follows sim/battle-actions.ts `hitStepAccuracy`: the printed accuracy, then the attacker's
 * accuracy stage and the defender's evasion stage (both skipped entirely when the move cannot miss),
 * then the modifiers. Returns a PERCENTAGE, or Infinity for "cannot miss" so that every caller's
 * `acc<100` guard reads the same and nobody has to remember a sentinel. */
function hitChance(att,def,id,field,ctx){
  const c=ctx||{};
  const raw=printedAccuracy(id,field);
  /* NO GUARD IS CHECKED FIRST AND ON BOTH BODIES. Its handler is onAnyAccuracy -- it does not care
   * which end of the move it is on, so a Machamp's Stone Edge cannot miss and nothing aimed at it
   * can miss either. Half of that is the half an attacker-only version would ship. */
  if(_neverMissAb(att)||_neverMissAb(def))return Infinity;
  if(raw===true)return Infinity;
  let acc=+raw;
  if(!(acc>0))return Infinity;
  /* Stages. `ignoreAccuracy`/`ignoreEvasion` are not modelled here and neither is in this format's
   * corpus; a move that carried one would read as an ordinary move and is not silently special-cased. */
  const _ab=(att&&att.boosts&&att.boosts.acc)||0;
  const _eb=(def&&def.boosts&&def.boosts.eva)||0;
  if(_ab)acc*=accStageMul(_ab);
  if(_eb)acc/=accStageMul(_eb);
  const _mv=(typeof MC!=='undefined'&&MC&&MC.moves&&MC.moves[id])||null;
  /* THE CATEGORY, AND THE FAILURE IS COUNTED RATHER THAN SWALLOWED. Only Hustle and Wonder Skin gate
   * on it today, so a miss here silently turns two conditional modifiers off — which is exactly the
   * shape of an absent capability reporting success. moveAccuracy already keeps its own reason for
   * the same throw; this one reuses that counter because it is the same failure. */
  let _cat=null;
  try{const _fx=moveFx(id); _cat=(_fx&&_fx.category)||null;}
  catch(e){ MEDFAILS.accuracyNoTable++;
            if(!MEDFAILS.accuracyNoTableFirst)MEDFAILS.accuracyNoTableFirst=String(e.message).slice(0,80); }
  if(!_cat&&_mv)_cat=(_mv.bp>0)?(_mv.cat==='phy'?'Physical':'Special'):'Status';
  const cond={weather:(field&&!field.wSup)?field.weather:'',cat:_cat,
              targetAlreadyMoved:c.targetAlreadyMoved};
  for(const [who,mon] of [['att',att],['def',def]]){
    if(!mon)continue;
    for(const kind of ['ability','item']){
      const r=accModRow(kind,kind==='ability'?mon.ability:mon.item);
      if(!r||r.never)continue;
      if(r.side!=='both'&&r.side!==who)continue;
      if(!_accWhen(r.when,cond))continue;
      /* Wonder Skin RETURNS 50 rather than scaling -- `return 50`, not a chainModify -- so a hard set
       * is what the reference does and Math.min would be a second, quieter rule. */
      if(r.setTo!=null)acc=r.setTo;
      else if(r.mult!=null)acc*=r.mult;
    }
  }
  return acc;
}
/* ---- WIRE 131 — THE VALUATION PATH ASKED A BODILESS ACCURACY ------------------------------------
 *
 * WIRE 129 converted the five RESOLUTION sites (the to-hit rolls) to hitChance. It did not convert
 * the VALUATION sites — the four places that ask "what is this click WORTH" — and those kept calling
 * moveAccuracy(id,field), which is handed no bodies, plus a hand-written `att.ability==='noguard'`
 * check beside it. So the engine DODGED with Sand Veil while the bot PRICED every click as if Sand
 * Veil, Bright Powder, Minimize, Wide Lens and the defender's No Guard did not exist. Measured before
 * a line changed, Hydro Pump (80 printed) out of a Milotic, all seven arms:
 *
 *   plain defender            bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 80
 *   defender has NO GUARD     bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance Infinity
 *   ATTACKER has No Guard     bestMoveVs.acc 1     playerAction.acc 0.8   hitChance Infinity
 *   defender Bright Powder    bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 72
 *   defender at +6 evasion    bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 26.7
 *   attacker at +6 accuracy   bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 240
 *   attacker Wide Lens        bestMoveVs.acc 0.8   playerAction.acc 0.8   hitChance 88
 *
 * Identical results across a varied knob mean the knob is unwired — and the ONE arm that moved is the
 * hand-written attacker-only No Guard, which is the fifth copy of a rule ACCMOD already owns. Note
 * that even that copy is HALF the ability: No Guard's hook is onAnyAccuracy, so a move aimed AT a
 * No Guard body cannot miss either, and every one of the four sites priced that at 80%. This format
 * gives No Guard to Pidgeot-Mega, Raichu-Mega-Y, Machamp, Golurk, Hawlucha-Mega and Lycanroc-Midnight.
 *
 * hitProb IS THE VALUATION WRAPPER AND NOT A SECOND RULE: it is hitChance, clamped into [0,1], with
 * Infinity reading as 1. Every valuation site calls it, so the number a click is scored at and the
 * number it is rolled at come from one function.
 *
 * ZOOM LENS IS DECLARED OFF AT VALUATION TIME, RATHER THAN GUESSED. Its `when` is
 * `targetAlreadyMoved`, which is a fact about an order that does not exist yet when a click is being
 * priced — the valuation happens before the turn is queued. Passing no ctx makes _accWhen return
 * false, which is the honest answer ("we do not know that we are slower yet") rather than a coin
 * flip; the RESOLUTION site still applies it, so the mechanic is not lost, only unpriced. */
function hitProb(att,def,id,field,ctx){
  const h=hitChance(att,def,id,field,ctx||{});
  if(!isFinite(h))return 1;
  return Math.max(0,Math.min(1,h/100));
}
/* the type a move actually HAS under the current sky — one authority for the damage calc, the
 * absorb check in the battle loop, and the fragility pricer, so sand Weather Ball is a Rock move
 * to all three or to none */
/* WIRE 126 -- "WHAT TYPE IS THIS MOVE REALLY" HAD TWO IMPLEMENTATIONS AND ONE OF THEM WAS HALF DONE.
 *
 * The -ate abilities (Aerilate, Pixilate, Galvanize, Refrigerate, Dragonize, Normalize) and Liquid
 * Voice rewrite a move's type. That rewrite lived INSIDE dmgRange and nowhere else, while
 * effMoveType -- the helper the battle loop calls, and which is handed no attacker -- knew only about
 * Weather Ball. So the loop's own type-immunity gate read the RAW type.
 *
 * AND THE COMMENT AT THAT GATE SAID THE OPPOSITE, in as many words: *"effMoveType, not mv.t: the
 * -ate abilities rewrite a Normal move to Flying or Fairy, and a converted move DOES hit a Ghost."*
 * That is WIRE 119's Taunt failure exactly -- a capability absent while a comment reports success --
 * and it is the second time in three days this file has been caught by one.
 *
 * WHAT IT COST: an Aerilate Staraptor's Body Slam into a Ghost. dmgRange priced it at 136-162 and the
 * battle loop dealt ZERO, so every rollout played the ability's headline interaction as a whiffed
 * turn. Four more sites read the same helper and were wrong the same way -- the Lightning Rod draw, a
 * typeImmunity absorb, the Fire thaw and Protean's own retype -- so a Galvanized Body Slam was not
 * drawn by a Rod, not absorbed by Volt Absorb, and did not make a Protean body Electric.
 *
 * ONE IMPLEMENTATION NOW. The conversion is this function; dmgRange calls it for the type and keeps
 * only the POWER half (`damageMult`), which is a power question and belongs where the power lives. */
function convertsMoveTypeTo(mv,moveId,att,curT){
  const _cm=att&&TAGS.param('ability',att.ability,'convertsMoveType');
  if(!_cm||!_cm.into)return null;
  /* WIRE 75 -- `converts` NAMES EITHER A TYPE OR A FLAG. Liquid Voice's param is `converts: "sound
   * moves"` -- a FLAG, not a type -- and reading only the type half left it unwired. The flag half is
   * the same join `immuneToMoveClass` and `reflectsStatusMoves` already use: the ability names a
   * flag, the move carries it as its own tag, so a future ability that converts punch moves arrives
   * with no edit here. The discriminator is CASE, which is the artifact's own convention (`Normal
   * moves` is a type, `sound moves` is a flag), and a `converts` matching neither shape is COUNTED
   * rather than silently treated as "does not apply". */
  const _from=String(_cm.converts||'').trim();
  let _applies=false;
  if(/^its moves$/i.test(_from)) _applies=true;
  else{
    const _m=/^(\S+)\s+moves$/.exec(_from);
    if(!_m){MEDFAILS.convertsUnparsed++;if(!MEDFAILS.convertsUnparsedFirst)MEDFAILS.convertsUnparsedFirst=_from;}
    else if(/^[A-Z]/.test(_m[1])) _applies=(curT===_m[1]);
    else _applies=!!(moveId&&TAGS.has('move',moveId,_m[1].toLowerCase()));
  }
  return (_applies&&curT!==_cm.into)?_cm:null;
}
/* THE ATTACKER IS OPTIONAL AND ITS ABSENCE IS NOT SILENT: a caller that cannot supply one gets the
 * PUBLIC weather answer only, which is what every caller got before WIRE 126.
 * ROADMAP #96 / WIRE 3: there is no longer a caller in this file that has an attacker and withholds
 * it -- clickFragility was the one and it now passes `att`. An attacker-less call is therefore a
 * caller that genuinely HAS no attacker, and the answer it gets is a strictly smaller true one:
 * no -ate conversion and no private sky. */
function effMoveType(mv,moveId,field,att){
  let t=mv?mv.t:'';
  const _cm=convertsMoveTypeTo(mv,moveId,att,t);
  if(_cm)t=_cm.into;
  const w=moveId&&TAGS.param('move',moveId,'weatherScaled');
  /* WIRE 78 — a suppressed sky leaves Weather Ball NORMAL. The weather override runs AFTER the
   * conversion, matching dmgRange's own order, so Weather Ball in sand is Rock on a Pixilate body. */
  /* ROADMAP #96 / WIRE 3 -- THIS LINE READ `field.weather` AND dmgRange READ `effWeatherOf`, SO THE
   * TWO TYPE AUTHORITIES DISAGREED ABOUT THE SKY. WIRE 126 made "what type is this move really" one
   * function; it did not make "what weather is this attacker under" one function, and the second
   * split cost exactly what the first one did.
   *
   * `effWeatherOf` is the sky a FORMULA should read: it applies the private weather (WIRE 99, Mega
   * Sol -- the holder's own moves resolve as if its sun were up while the field reports none) and it
   * applies suppression, which is the `field.wSup` clause this line used to spell out by hand. So a
   * Meganium-Mega's Weather Ball was priced at 128-151 by dmgRange as a FIRE move and refused by the
   * battle loop's stage-5 gate as a NORMAL one: into a Ghost it dealt LITERALLY ZERO, and the mega's
   * headline interaction was a whiffed turn in every rollout. Measured against the official engine:
   * ours 0, Showdown non-zero, and a public sun over the same body was correct all along -- which is
   * why neither half's probe could see it. The census had `weatherBall` (public skies only) and
   * `privateWeather` (Flamethrower, whose type never moves) and no probe crossed them.
   *
   * NOT A COPY OF effWeatherOf's LOGIC -- a CALL to it, because two implementations of a fact is the
   * defect being fixed and re-deriving the private sky here would rebuild it one line later.
   *
   * THE DEFENDER'S OWN SUPPRESSION IS NOT VISIBLE FROM HERE, and that is stated rather than silently
   * handled: this helper is handed no defender. In the battle loop it does not matter -- `field.wSup`
   * is the loop's answer over all four actives and effWeatherOf honours it, so a Cloud Nine target is
   * already covered. A PURE call (clickFragility) holding a Cloud Nine defender would see the sky
   * dmgRange blanks. Adding a `def` parameter would be dead code at all five loop sites, so it is not
   * added; the gap is written down instead. */
  if(w&&w.byWeather){const _w=effWeatherOf(field,att);if(_w){const x=w.byWeather[_w];if(x&&x.type)return x.type;}}
  return t;
}
/* WIRE 21 -- variablePower: does this move have power AT ALL, and what is it right now?
 * Low Kick and Grass Knot carry bp 0 in the table (the power IS the calculation), so the old
 * `!mv.bp` gate scored them as non-damaging everywhere -- 1.27% of move slots doing zero. The
 * absolute kinds (weight brackets) grant power through the gate; the conditional kinds multiply
 * a real base. */
function hasPower(mv){
  if(!mv)return false;
  if(mv.bp)return true;
  stampMoveIds();
  const v=mv.id&&TAGS.param('move',mv.id,'variablePower');
  /* WIRE 83 -- the ABSOLUTE kinds all grant power through this gate. Five more joined: a move whose
     dex base power is 0 because the power IS the calculation was rejected here and dealt LITERALLY
     NOTHING, which is where 35 of the interaction matrix's 68 divergences came from. The
     CONDITIONAL kinds (targetStatused, userNoItem, positiveBoosts...) multiply a real base and must
     NOT be listed here, or a move whose condition is false would be admitted at bp 0. */
  if(v&&(v.kind==='targetWeightKg'||v.kind==='weightRatio'||v.kind==='speedRatioLinear'
        ||v.kind==='speedRatioTable'||v.kind==='targetHPFrac'||v.kind==='userHPBrackets'
        ||v.kind==='alliesBaseAtk'))return true;
  /* WIRE 141 -- FLING SHIPS AT BASE POWER 0 BECAUSE THE POWER IS THE HELD ITEM, and this gate is why
   * the move was a NO-OP TURN rather than a weak one: `playerAction` fell all the way through to
   * `{kind:'pass'}`, so the click never became an attack, never reached the hit steps, and could not
   * have spent an item even if the disposition had been written. Exactly the shape ROADMAP #84 found
   * on the spread moves -- a dex base power of 0 read as "this move does nothing".
   * A body with nothing to throw is still a real failure and is refused LOUDLY in the attack branch
   * (MEDSEEN.flingRefused), which is where the authority refuses it too. Admitting it here and
   * failing it there is not a contradiction: `hasPower` answers "can this move deal damage at all",
   * and "not while my hands are empty" is a turn-time question. */
  if(mv.id&&TAGS.param('move',mv.id,'flingsOwnItem'))return true;
  /* A FIXED-DAMAGE MOVE HAS NO BASE POWER AND STILL DOES DAMAGE. Without this line dmgRange
   * short-circuits at its !hasPower guard and Super Fang is worth zero. Only the shapes dmgRange can
   * actually compute count as "has power".
   *
   * THE EXCLUSION OF THE RETALIATION FAMILY EXPIRED, 2026-08-10, AND NOTHING NOTICED. What stood here
   * said: "Counter and Mirror Coat need turn state and would otherwise be admitted here only to
   * return zero one branch later, which is a slower way of being wrong." That was TRUE and it was the
   * right call — while the turn state did not exist. It does now (`_took`, recorded where every
   * damage packet lands), and `dmgRange` has the branch that reads it. Leaving the whitelist alone
   * would have made the new branch UNREACHABLE: the gate rejects the move before the branch runs, and
   * the roster would have kept reading DID-NOT-FIRE with the fix sitting in the file.
   *
   * That is the shape this project keeps hitting — a guard written against a real limitation, kept
   * past the limitation. `retaliates` is the tag's own word for "reads damage taken", so the gate now
   * asks the artifact rather than carrying a second list. A body that took nothing still returns 0,
   * one branch later, which is exactly what the authority does. */
  const f=mv.id&&TAGS.param('move',mv.id,'fixedDamage');
  return !!(f&&(f.damage==='level'||f.source==='halfTargetCurrentHP'||f.source==='myRemainingHP'
                ||f.source==='targetDownToMine'||f.source==='ohko'||f.retaliates));
}
/* WIRE 78 -- WEATHER SUPPRESSION. Air Lock and Cloud Nine leave the weather ON THE FIELD and make it
 * do nothing: the sky is still raining, and Swift Swim, Solar Power, the Fire/Water multipliers, the
 * sandstorm chip, Thunder's accuracy, Weather Ball's type and Aurora Veil's legality all stop reading
 * it. So this is NOT "clear the weather" -- clearing it would let a second Drizzle re-set it and would
 * make Aurora Veil's failure look like the absence of snow rather than its suppression.
 *
 * THE TAG IS DERIVED, and correcting the record matters as much as the wire: the previous pass filed
 * this as *"no artifact to wire from"*. Showdown carries it as the flat property `suppressWeather`
 * rather than as a handler, so every handler-probing derivation in tag_dex missed it; it is now
 * derived and matches EXACTLY two abilities.
 *
 * EXPOSURE, MEASURED, because it decides how much machinery this deserves: Air Lock's only carrier is
 * Rayquaza and Rayquaza is not in this format, so Air Lock is ZERO. Cloud Nine has two carriers that
 * are (Altaria, Drampa) and 18 declared sheets across 40,595 stored games. */
function suppressesWeather(m){ return !!(m&&TAGS.param('ability',m.ability,'weatherSuppression')); }
/* The weather a FORMULA should read. `field.wSup` is the battle loop's answer over all four actives;
 * the two-body test is what a pure call to dmgRange can see on its own, and it is stated rather than
 * silently equivalent: a pure dmgRange handed an Air Lock ALLY cannot know, and the battle loop is
 * the only caller that can. */
function effWeatherOf(field,att,def){
  /* WIRE 99 -- PRIVATE WEATHER (Mega Sol, Meganium's Champions mega). The holder's own moves resolve
   * AS IF its weather were up while the field reports none -- so it is read here, where the shadow at
   * the top of dmgRange asks "what weather does THIS attacker see", and never written to the field.
   * The tag's own note: every other weather read asks the FIELD and gets 'none'. The speed abilities
   * and the defender's own weather reads are deliberately untouched -- `affects: only this Pokemon`.
   * Sheet usage reads 0 because sheets list the PRE-mega ability (Lesson 3); the exposure is every
   * Meganium holding its stone. */
  {const _pw=TAGS.param('ability',att&&att.ability,'privateWeather');
   if(_pw&&Array.isArray(_pw.actsAsWeather)&&_pw.actsAsWeather.length){
     const _w=weatherId(_pw.actsAsWeather[0]);
     if(_w)return _w;
   }}
  if(!field||!field.weather)return '';
  if(field.wSup||suppressesWeather(att)||suppressesWeather(def))return '';
  return field.weather;
}
/* ---- ROADMAP #81 WIRE 12 -- THE AURAS. A DAMAGE MULTIPLIER THAT BELONGS TO THE FIELD -------------
 *
 * Fairy Aura, Dark Aura and Aura Break are `onAnyBasePower` / `onAnyTryPrimaryHit`. `Any` is the whole
 * mechanic: the handler fires for EVERY move on the field regardless of whose body carries the
 * ability, so a Floette-Mega makes the FOE'S Moonblast 1.33x as well as its own. Nothing else in this
 * engine's taxonomy does that -- every other ability-sourced multiplier belongs to the attacker or to
 * the defender, which is why `dmgRange(att, def, ...)` could express all of them and not this one.
 * ROADMAP #64 routed it rather than patching it, on the grounds that `dmgRange` is handed two bodies
 * and a field with no occupants. That is still true, and it is the SAME shape WIRE 78 already solved
 * for Air Lock: THE FIELD CARRIES THE ANSWER. `field.aura` is recomputed at the top of every turn
 * from whoever is standing there, exactly as `field.wSup` is, and no signature widens.
 *
 * A FIX THAT BOOSTED ONLY THE HOLDER'S MOVES WOULD MEASURE AS AN IMPROVEMENT AND BE WRONG. Half the
 * exposure of this mechanic is the half that helps the opponent; an implementation that keeps only the
 * flattering half is exactly the kind of change this division cannot detect from a win rate.
 *
 * THE NUMBER IS 5448/4096, NOT 1.33. `md4096(v, 1.33)` truncs the float to 5447/4096 and would have
 * been off by one 4096th on every Fairy move in the format -- so the artifact carries the PAIR, read
 * out of `chainModify([move.hasAuraBreak ? 3072 : 5448, 4096])`, and this consumer refuses anything
 * that is not a pair rather than reaching for a number nobody derived (MEDFAILS.auraMultUnusable).
 *
 * AURA BREAK INVERTS, IT DOES NOT CANCEL. 3072/4096 = 0.75, so a Fairy move under Fairy Aura AND Aura
 * Break is WEAKER than with no aura at all. Both numbers come off the aura's own handler.
 *
 * NO STACKING. Showdown's `move.auraBooster` guard means one booster claims the move and any second
 * carrier of the same aura returns early, so two Fairy Auras are 1.33x and not 1.77x. Applied once
 * per matching TYPE here for the same reason.
 *
 * ZERO EXPOSURE FOR TWO OF THE THREE IN THIS FORMAT, MEASURED AND STATED: the only legal Fairy Aura
 * body is Floette-Mega; Dark Aura's carrier (Yveltal) and Aura Break's (Zygarde, Zygarde-10%) are
 * `isNonstandard: 'Past'` and Zygarde-Mega is `'Future'`. They are wired because the ENGINE matches on
 * tag shape and a family with a member left out is a list. */
function auraStateOf(bodies){
  let types=null,brk=false;
  for(const x of bodies){
    if(!x||x.fainted||x.curHP<=0)continue;
    const ab=(x.ability||'').replace(/[^a-z0-9]/g,'');
    const a=TAGS.param('ability',ab,'auraBoost');
    if(a&&a.type){(types||(types={}))[a.type]={mult:a.mult||null,breakMult:a.breakMult||null};}
    if(TAGS.param('ability',ab,'auraBreak'))brk=true;
  }
  return types?{types,brk}:null;
}
/* The aura a FORMULA should read, and the limitation is stated rather than silently equivalent --
 * the same split `effWeatherOf` documents. `field.aura` is the battle loop's answer over all FOUR
 * actives and is authoritative whenever the loop has run; a PURE `dmgRange` call outside a turn can
 * only see the two bodies it was handed, so an aura sitting on an unseen PARTNER is invisible to it.
 * Not a fallback that invents anything: the two-body read is a strictly smaller true answer. */
function auraFor(field,att,def){
  if(field&&field.aura!==undefined)return field.aura;
  return auraStateOf([att,def]);
}
/* ROADMAP #81 WIRE 11 -- `isCrit` IS THE SIXTH PARAMETER AND IT IS OPTIONAL ON PURPOSE. Every caller
 * that existed before this wire passes five arguments and gets `undefined`, which is the non-crit
 * price it always got. The battle loop is the only caller that can know a ROLLED crit landed, so it
 * is the only one that passes `true`; the three certain-crit moves are decided inside, from the
 * artifact, so a pure pricing caller (bestMoveVs, playerAction, the leaf) still gets them right
 * without being told anything. */
/* ROADMAP #92 -- `hit` IS THE SEVENTH PARAMETER AND IT CARRIES THE FACTS ONLY THE HIT SITE KNOWS.
 * Helping Hand is `onBasePower` and Friend Guard is `onAnyModifyDamage`, so BOTH belong inside a
 * chain this function spends -- and neither is derivable from (att, def). They used to be applied by
 * the battle loop to dmgRange's OUTPUT, which is one stage late for Helping Hand and one CHAIN late
 * for Friend Guard (docs/DAMAGE-STAGES.md §2a, §4: 5/5 rows wrong and 21.4% respectively).
 *   { helpingHand: true, allyDamageMult: 0.75, rolls: [] }
 * `rolls` is an OUT parameter: hand it an array and it is filled with all sixteen damage rolls, in
 * Showdown's own `random(16)` index order (index i is percent 100-i). tests/test-damage-stages.js is
 * the only caller that asks for it -- an exact per-roll comparison is the one shape that can see a
 * stage error, because at the TOP roll the randomizer is the identity and half of this class hides.
 * Every existing caller passes six arguments or fewer and gets `undefined`, which is the behaviour
 * it always had. */
function dmgRange(att,def,mv,field,spread,isCrit,hit){
  stampMoveIds();
  if(!mv||!hasPower(mv))return {min:0,max:0,eff:mcEff(mv?mv.t:'',def.types)};
  /* Shadowed once, at the top, so every weather read BELOW this line -- weatherScaled, Weather Ball's
     type, the snow/sand defence bumps, Solar Power, Orichalcum Pulse and the Fire/Water multipliers --
     goes through the suppression without a gate per site. `field` is never mutated. */
  {const _ew=effWeatherOf(field,att,def);
   /* Either direction: a suppressed sky is blanked, and a PRIVATE weather (WIRE 99) is written into
    * the shadow -- field itself is never mutated in both cases. */
   if((field&&field.weather||'')!==_ew)field=Object.assign({},field||{},{weather:_ew});}
  /* WIRE 7 -- weatherScaled, damage half. Weather Ball was Normal 50 BP in every sky; in sand it is
   * a 100 BP Rock move, which is a different move. Solar Beam sheds half its power in rain, sand and
   * snow. The type and power overrides happen HERE, before STAB, effectiveness, the rain/sun x1.5,
   * items and absorb abilities, so every downstream read sees the move the weather actually makes.
   * chargeSkip is carried by the artifact but has no state to land on: this engine plays every move
   * in one turn, so Solar Beam is (wrongly, pre-existing) never charged anywhere -- stated, not fixed
   * by pretending. Pure: mv is never mutated, the overrides live in locals. */
  let mvT=mv.t,mvBP=mv.bp;
  /* THE -ATE ABILITIES. Aerilate, Pixilate, Galvanize, Refrigerate, Dragonize and Normalize rewrite
   * a NORMAL move's type and add 20% power. Both halves are declared in the dex -- onModifyType
   * names the type, onBasePower carries the multiplier -- and this engine read neither, so an
   * Aerilate Staraptor dealt exactly what one without the ability dealt: 94 either way. On a Pokemon
   * built entirely around the ability that is not a rounding error.
   *
   * Applied HERE, before STAB and effectiveness, because the whole point is that the move becomes a
   * DIFFERENT TYPE -- so everything downstream must see the new one. Normalize converts in the other
   * direction and the tag says so, hence the check on what it converts FROM. */
  /* WIRE 126 -- THE TYPE HALF MOVED OUT, to convertsMoveTypeTo(), because the battle loop needed the
   * identical answer and had been getting the raw type. What stays here is the POWER half: the -ate
   * abilities are worth x1.2 as well as a retype, and a base-power multiplier belongs where the base
   * power is. Two copies of "what type is this move" is what let an Aerilate Body Slam be priced at
   * 162 by this function and dealt as 0 by the loop. */
  /* ROADMAP #92 -- THE POWER HALF IS A CHAIN MEMBER, NOT ITS OWN FLOOR. `pixilate.onBasePower` is
   * `chainModify([4915,4096])` at priority 23, so it folds into the ONE BasePower modifier that
   * `runEvent` spends at the end -- it does not truncate on its own. It is captured here (where the
   * type conversion is decided) and spent below with every other `onBasePower` member. */
  let _ateMult=null;
  {
    const _cm=convertsMoveTypeTo(mv,mv.id,att,mvT);
    if(_cm){
      mvT=_cm.into;
      if(_cm.damageMult&&_cm.damageMult!==1)_ateMult=_cm.damageMult;
    }
  }
  const _ws=mv.id&&TAGS.param('move',mv.id,'weatherScaled');
  if(_ws&&_ws.byWeather&&field&&field.weather){
    const w=_ws.byWeather[field.weather];
    if(w){if(w.type)mvT=w.type;if(w.bpMult)mvBP=Math.floor(mvBP*w.bpMult);}
  }
  /* WIRE 9 -- the death counter, both freshness rules (Will's split). Last Respects reads the
   * side's LIVE count at each use; Supreme Overlord multiplies by the snapshot FROZEN at this
   * attacker's entry. Both zero when no counter is attached (site calls, unit tests). */
  const _pf=mv.id&&TAGS.param('move',mv.id,'powerFromFallen');
  if(_pf&&att._sf&&att._sf.fainted)mvBP=_pf.base+_pf.perFallen*Math.min(att._sf.fainted,5);
  /* WIRE 141 -- FLING'S BASE POWER *IS* THE ITEM. The dex ships it at 0 and `onPrepareHit` writes
   * `move.basePower = item.fling.basePower`, so an engine reading the dex number prices every Fling
   * at nothing. Through the shared `flingBasePower` so the click-time price and the hit-time damage
   * cannot come apart once the item has been spent. `powerFromItem` is the tag's own field; nothing
   * here names the move. */
  {const _fo=mv.id&&TAGS.param('move',mv.id,'flingsOwnItem');
   if(_fo&&_fo.powerFromItem)mvBP=flingBasePower(att);}
  /* WIRE 21, the power itself: weight brackets (kg, from the handler's own table), user-HP scaling
   * (a hurt Eruption is a weak Eruption), doubled-vs-status (Hex), doubled-itemless (Acrobatics),
   * and Knock Off's x1.5 when the target actually holds something -- sheet-known on open sheets. */
  const _vp=mv.id&&TAGS.param('move',mv.id,'variablePower');
  /* ROADMAP #84 -- THE GATE WAS `_vp.kind`, WHICH LOCKED OUT EVERY MEMBER THE DERIVATION COULD NOT
   * NAME. Twelve moves carry `variablePower {computed:true}` with no `kind` at all -- the artifact
   * says `idiom not yet derivable` -- so the whole block was skipped for them and, because the
   * unknown-kind counter below is ALSO gated on `_vp.kind`, skipped SILENTLY. Every branch inside
   * tests `_vp.kind === '...'` for itself, so opening the gate changes nothing for the members that
   * have one. */
  if(_vp){
    if(_vp.kind==='targetWeightKg'&&def.wt){for(const _b of _vp.brackets){if(def.wt>=_b[0]){mvBP=_b[1];break;}}}
    else if(_vp.kind==='weightRatio'&&att.wt&&def.wt){const _r=att.wt/def.wt;for(const _b of _vp.brackets){if(_r>=_b[0]){mvBP=_b[1];break;}}}
    else if(_vp.kind==='userHPFrac'&&att.st&&att.curHP!=null)mvBP=Math.max(1,Math.floor(mvBP*att.curHP/att.st.hp));
    else if(_vp.kind==='targetStatused'&&def.status)mvBP=mvBP*_vp.mult;
    else if(_vp.kind==='userNoItem'&&!att.item)mvBP=mvBP*_vp.mult;
    /* THE PRODUCT IS TRUNCATED, AND THIS IS THE ONLY MEMBER WHERE THAT SHOWS.
     *
     * Showdown reaches this through `onBasePower -> chainModify(1.5)`, and chainModify is FIXED
     * POINT: `tr(tr(bp * 6144) / 4096)`, so 65 x 1.5 is 97 and not 97.5. This engine kept the half
     * and the half survived every later floor:
     *     showdown  22*97 *135/85 /50 +2 = 69 -> STAB x1.5 -> 103
     *     medicham  22*97.5*135/85 /50 +2 = 70 -> STAB x1.5 -> 105
     * Two points on 3,341 corpus uses of Knock Off. Found by the whole-game differential's damage
     * INTERIOR on 2026-08-07, and it had been invisible: the staged bodies used to carry the
     * dataset's spread and the two engines happened to land on the same integer, so
     * `endpoints_agree` read true for a reason that had nothing to do with the arithmetic being
     * right. Flattening the harness's stat line for ROADMAP #31 moved it off that coincidence.
     *
     * ONLY THIS BRANCH IS FLOORED, deliberately. `targetStatused` and `userNoItem` are the other two
     * multipliers and BOTH are x2 on an integer base power (Hex 65, Infernal Parade 20, Acrobatics
     * 55) -- and Hex and Acrobatics reach it through `basePowerCallback` returning `bp * 2`, which is
     * a PLAIN multiply upstream and does not truncate. Flooring them would assert a rounding rule
     * Showdown does not apply there; it is a no-op today either way, and knockoff is the only member
     * of the three carrying a non-integer `mult` (1.5). */
    /* WIRE 141 -- AND THE BOOST IS NOT ABOUT HAVING AN ITEM, IT IS ABOUT BEING ABLE TO TAKE ONE.
     *
     * `data/moves.ts` knockoff, in order:
     *     const item = target.getItem();
     *     if (!this.singleEvent('TakeItem', item, target.itemState, target, target, move, item)) return;
     *     if (item.id) { return this.chainModify(1.5); }
     * The refusal is asked FIRST and the boost is skipped entirely when it comes back false. This
     * engine already honoured the refusal at the STRIP (see the removesItem block) and not here, so
     * a Charizard holding its own Charizardite Y kept the stone -- correctly -- and still ate the
     * x1.5. Measured on the staged board before this line changed: Showdown 84/153, ours 50/153.
     *
     * `itemRefusesTake` IS THE READER BOTH SITES ASK, which is the FACTS-ARE-GLOBAL rule; a second
     * copy of "can this item leave this body" is how the two halves came apart in the first place.
     * IT IS NOT "MEGA STONES ARE IMMUNE" and the difference is the whole care in it: the refusal is
     * keyed on `source.baseSpecies.baseSpecies`, so a Charizardite Y on a SNORLAX is taken normally
     * and boosts normally. MEASURED over the format rather than assumed: of every legal item in
     * `Dex.forFormat('gen9championsvgc2026regmb')`, exactly 75 declare an `onTakeItem` and all 75 are
     * mega stones -- there is no Z-crystal, no plate and no Griseous Orb in this format, so the item
     * half of the refusal class IS the stones and nothing is being special-cased.
     *
     * STICKY HOLD IS NOT PART OF THIS QUESTION, AND THAT IS A READING RATHER THAN AN OMISSION. The
     * line above is `singleEvent`, which runs the ITEM's handler only; the ability never sees it. It
     * does refuse the STRIP, through `runEvent('TakeItem')` inside `Pokemon#takeItem` -- but Sticky
     * Hold carries no row in `data/tags.json` at all (0 uses, and it is not reachable from this
     * format's species pool), so there is no shape to match on and naming it would be the hand-typed
     * list this project bans. Reported rather than wired. */
    else if(_vp.kind==='targetHasItem'&&def.item&&!itemRefusesTake(def))mvBP=Math.floor(mvBP*_vp.mult);
    /* ---- WIRE 83 -----------------------------------------------------------------------------
     * GYRO BALL: floor(25 x THEIR speed / MY speed) + 1, capped at 150. Every multiplier that makes
     * a speed real belongs in it -- a Choice Scarf on the target is most of the move -- so it goes
     * through effSpeed rather than the raw stat, which is the one function this engine has for
     * "how fast is this" (see FACTS ARE GLOBAL). */
    else if(_vp.kind==='speedRatioLinear'){
      const _as=effSpeed(att,field),_ds=effSpeed(def,field);
      if(_as>0&&_ds>0){
        let _p=Math.floor(_vp.mult*(_vp.invert?_ds/_as:_as/_ds))+(+_vp.plus||0);
        if(_vp.cap&&_p>_vp.cap)_p=_vp.cap;
        mvBP=Math.max(1,_p);
      } else mvBP=1;
    }
    /* ELECTRO BALL: a table indexed by floor(MY speed / THEIR speed), clamped to the table's end. */
    else if(_vp.kind==='speedRatioTable'){
      const _as=effSpeed(att,field),_ds=effSpeed(def,field);
      const _r=_ds>0?Math.floor(_as/_ds):0;
      mvBP=_vp.table[Math.min(Math.max(_r,0),+_vp.clampAt||_vp.table.length-1)];
    }
    /* HARD PRESS: the base power IS the target's remaining HP as a percentage of its maximum. */
    else if(_vp.kind==='targetHPFrac'&&def.st&&def.curHP!=null)
      mvBP=Math.max(+_vp.min||1,Math.floor((+_vp.ofMax||100)*def.curHP/def.st.hp));
    /* REVERSAL / FLAIL: brackets on the USER's remaining HP in 48ths -- 200 BP at death's door. */
    else if(_vp.kind==='userHPBrackets'&&att.st&&att.curHP!=null){
      const _r=Math.max(Math.floor(att.curHP*(+_vp.scale||48)/att.st.hp),1);
      mvBP=+_vp.floorBP||1;
      for(const _b of _vp.brackets)if(_r<_b[0]){mvBP=_b[1];break;}
    }
    /* STORED POWER / POWER TRIP: base + per x the number of POSITIVE stat stages, which is what
     * makes them the punish for a setup sweeper rather than a 20 BP move. */
    else if(_vp.kind==='positiveBoosts'&&att.boosts){
      let _n=0;for(const _k in att.boosts)if(att.boosts[_k]>0)_n+=att.boosts[_k];
      mvBP=mvBP+(+_vp.per||0)*_n;
    }
    /* BEAT UP: one hit per eligible party member, each at 5 + floor(that member's base Atk / 10).
     * ROLLED AS ONE PACKET, summed, which is the same declared divergence this engine already
     * carries for every multi-hit move against a Focus Sash and is stated here rather than hidden.
     * Eligibility is Showdown's: not fainted and carrying no major status. */
    else if(_vp.kind==='alliesBaseAtk'){
      const _party=(att._sf&&att._sf.team&&att._sf.team.length)?att._sf.team:[att];
      let _sum=0,_hits=0;
      for(const _al of _party){
        if(!_al||_al.fainted||_al.curHP<=0||(_al.status&&_al.status!=='none'))continue;
        if(!_al._bsAtk)continue;
        _sum+=(+_vp.base||5)+Math.floor(_al._bsAtk/(+_vp.div||10));_hits++;
      }
      mvBP=_hits?_sum:((+_vp.base||5)+Math.floor((att._bsAtk||0)/(+_vp.div||10)));
    }
    /* ROADMAP #84 -- DOUBLE IF LAST TURN'S MOVE FAILED. Stomping Tantrum (3,545 corpus uses) and
     * Temper Flare (48), and the two are ONE handler written twice:
     *     if (pokemon.moveLastTurnResult === false) return move.basePower * 2;
     * `=== false` and not merely falsy, which is the whole of ROADMAP #84 -- see the split recorded
     * at the refusal sites in battleTurn. A recharge, a Protect and a fresh switch-in all leave it
     * null or undefined and none of them doubles.
     *
     * NAME-WIRED, AND THE MEMBERSHIP WAS MEASURED BEFORE THE NAMES WERE TYPED, both directions:
     *   - in the AUTHORITY, `moveLastTurnResult === false` appears exactly twice in data/moves.ts
     *     (18048 stompingtantrum, 19184 temperflare) and nowhere else in the move set;
     *   - in the ARTIFACT there is no shape to match on. Both carry
     *     `variablePower {computed:true, note:"idiom not yet derivable"}` -- and so do TEN other moves
     *     (ragefist, assurance, avalanche, lastrespects, payback, risingvoltage, round, spitup,
     *     tripleaxel, watershuriken). Matching that shape would double Last Respects and Rage Fist
     *     after any failed turn, which is six times the usage of the thing being fixed.
     * So this is the `damageBoost` situation the tag ledger already describes: the param does not
     * carry the condition, and inventing one would be worse than naming the two carriers. It is
     * counted, so a zero after real games is readable.
     *
     * NOT WIRED, AND NAMED SO IT IS NOT MISTAKEN FOR DONE: the Metronome ITEM (items.ts:4010, legal
     * in this format) reads `moveLastTurnResult` as a TRUTHY test to decide whether its consecutive-use
     * counter survives. That is a different consumer of the same fact and this engine has no Metronome
     * item at all; the state it would need now exists. */
    else if(_vp.kind==null&&(mv.id==='stompingtantrum'||mv.id==='temperflare')){
      if(att._mvResLast===false){mvBP=mvBP*2;MEDSEEN.powerDoubledAfterFailure++;}
    }
    else if(_vp.kind&&!/^(targetWeightKg|weightRatio|userHPFrac|targetStatused|userNoItem|targetHasItem)$/.test(_vp.kind)){
      MEDFAILS.variablePowerUnknown++;
      if(!MEDFAILS.variablePowerUnknownFirst)MEDFAILS.variablePowerUnknownFirst=mv.id+':'+_vp.kind;
    }
  }
  /* WIRE 135 -- THE POWER-DOUBLING HALF OF `needsTargetToAttack`, AND THE FIX WAS A TAG BEFORE IT WAS
   * ANY CODE. The census carried this MISSING with the reason written out: all nine members shared
   * `{needs: "target attacking"}` and those nine DOUBLE, REFLECT, FAIL or GO FIRST. There was nothing
   * in the artifact that told Avalanche's doubling from Counter's reflection, so nothing could be
   * wired without naming moves. tag_dex now reads each member's own callback and the param carries
   * `effect` and `when`; this is the consumer for the doubling third of it.
   *
   *   damagedByTargetThisTurn   Avalanche (and Revenge). `_hitBy` is the turn's own record of who
   *                             damaged this body, cleared at the top of every turn.
   *   targetHurtThisTurn        Assurance. `_hurtThisTurn` on the target, same clock.
   *   targetHasNotMovedYet      Payback, and the NAME IS THE AUTHORITY'S SIGN INVERTED ON PURPOSE:
   *                             the handler returns the UNDOUBLED power when the target still has an
   *                             action queued, so the double lands when it has ALREADY moved and was
   *                             not just switched in.
   * A member whose `when` this engine cannot evaluate is COUNTED and left alone; nothing here
   * defaults to doubling, because a free x2 on a priority move is the error that cannot be recovered
   * from a rollout. */
  {
    const _nt=mv.id?TAGS.param('move',mv.id,'needsTargetToAttack'):null;
    if(_nt&&_nt.effect==='doublePower'&&_nt.mult){
      let _fires=null;
      if(_nt.when==='damagedByTargetThisTurn')_fires=!!(att._hitBy&&att._hitBy.has(def));
      else if(_nt.when==='targetHurtThisTurn')_fires=!!def._hurtThisTurn;
      else if(_nt.when==='targetHasNotMovedYet')_fires=!!def._acted&&!def._newlySwitched;
      if(_fires===null){MEDFAILS.needsTargetWhenUnknown++;
        if(!MEDFAILS.needsTargetWhenUnknownFirst)MEDFAILS.needsTargetWhenUnknownFirst=mv.id+':'+_nt.when;}
      else if(_fires){mvBP=Math.floor(mvBP*+_nt.mult);MEDSEEN.powerDoubledOnRead++;}
    }
  }
  /* WIRE 83 -- conditionalPower, and the tag used to say `{conditional: true}`: a boolean across
   * eleven members with wildly different rules, which is why the census carried it MISSING. It now
   * names the CONDITION and the MULTIPLIER, read out of each handler's own chainModify.
   * `userStatsLoweredThisTurn` (Lash Out) has no state here and is COUNTED rather than defaulted;
   * `chance` (Fickle Beam) is applied as its EXPECTED multiplier, because dmgRange is a range and
   * has no rng -- stated, because a 30% double silently ignored is the same class of silent default.
   * The members whose condition lives in weatherScaled / terrainScaled / variablePower carry only
   * `conditional:true` and are correctly skipped here rather than double-counted. */
  {
    const _cp=mv.id&&TAGS.param('move',mv.id,'conditionalPower');
    if(_cp&&_cp.when&&_cp.mult){
      const _st=x=>x&&x.status&&x.status!=='none'?x.status:'';
      if(_cp.when==='userStatused'){
        const _s=_st(att);
        if(_s&&!(_cp.exceptStatus||[]).includes(_s))mvBP=Math.floor(mvBP*_cp.mult);
      } else if(_cp.when==='targetStatusIn'){
        if((_cp.statuses||[]).includes(_st(def)))mvBP=Math.floor(mvBP*_cp.mult);
      } else if(_cp.when==='chance'){
        mvBP=Math.floor(mvBP*(1+(_cp.p||0)*((_cp.mult||1)-1)));
      } else {
        MEDFAILS.variablePowerUnknown++;
        if(!MEDFAILS.variablePowerUnknownFirst)MEDFAILS.variablePowerUnknownFirst=mv.id+':'+_cp.when;
      }
    }
  }
  const phys=mv.c==='P';
  /* WHICH STAT ATTACKS, AND WHICH STAT IS ATTACKED INTO -- from the statSwap tag.
   *
   * Body Press attacks with DEFENCE and Psyshock attacks INTO defence. The dex states both as plain
   * fields and this engine read neither, so Body Press was computed off Attack: a Corviknight with
   * 125 Def and one with 250 Def both dealt 54. Read from the artifact so a third one needs no edit.
   *
   * IGNORED STAT STAGES too (Sacred Sword, Darkest Lariat): the boost multiplier is skipped rather
   * than the stat replaced, which is the actual rule -- the defender keeps its stat, it just does not
   * get to keep the boost. Measured missing at 65 unboosted against 23 into +4 Defence. */
  const _ss=mv.id?TAGS.param('move',mv.id,'statSwap'):null;
  const _ib=mv.id?TAGS.param('move',mv.id,'ignoresBoosts'):null;
  const _S2E={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp'};
  const _aKey=(_ss&&_ss.attackWith&&_S2E[_ss.attackWith])||(phys?'at':'sa');
  const _dKey=(_ss&&_ss.attackInto&&_S2E[_ss.attackInto])||(phys?'df':'sd');
  /* FOUL PLAY USES THE TARGET'S ATTACK, and the engine used the attacker's -- 734 corpus clicks,
   * and confirmed against Showdown in BOTH directions rather than assumed: spiritomb foulplay ->
   * wyrdeer read 178 there against 132 here, klefki foulplay -> pangoro read 19 against 8.
   *
   * WHY IT WAS MISSED, because the shape matters more than the fix. Body Press and Psyshock work,
   * and they work because they carry `statSwap`, whose attackWith/attackInto the block above reads.
   * Foul Play carries a DIFFERENT tag -- `swapsStat` -- whose params say `offensiveFrom: "target"`,
   * and no line in this file had ever read that field. So the mechanic was fully described in the
   * artifact and entirely absent from the engine, which is the failure CLAUDE.md's artifact rule is
   * about: a derived fact is not a fact until something compares it to its source.
   *
   * THE TARGET'S BOOSTS COME WITH IT. Foul Play uses the target's Attack stage as well as its
   * Attack, so the body reading the boost has to move too -- taking `def.st` while still applying
   * `att.boosts` would be a new wrong number in a Swords Dance matchup, which is exactly where the
   * move is played. `_ib` (Darkest Lariat, Sacred Sword) still gates the DEFENSIVE stage below,
   * unchanged. */
  const _sw=mv.id?TAGS.param('move',mv.id,'swapsStat'):null;
  const _offFromTarget=!!(_sw&&_sw.offensiveFrom==='target');
  const _aBody=_offFromTarget?def:att;
  let A=_aBody.st[_aKey],D=def.st[_dKey];
  /* WIRE 133 -- WONDER ROOM. While it is up, EVERY STORED DAMAGE NUMBER IN THIS FORMAT IS WRONG, and
   * the tag (`swapsDefences`, 11 uses) had no consumer at all.
   *
   * WHAT IS SWAPPED IS THE STORED STAT AND NOTHING ELSE, which is the half a plain "swap def and spd"
   * gets wrong. `Pokemon#getStat` (sim/pokemon.ts) swaps `storedStats` at the TOP of the function and
   * then applies `boosts[statName]` -- the ORIGINAL stat's stage -- so a body at +2 Defence under
   * Wonder Room is applying that +2 to its Special Defence's number. The stages below this line are
   * keyed off `_dKey`, which is deliberately NOT rewritten here for exactly that reason.
   *
   * It applies to whichever defence the move actually attacks into, so Psyshock and Body Press get it
   * for free through `_dKey` rather than through a second rule. */
  if(field&&field.wonderRoom>0&&(_dKey==='df'||_dKey==='sd')){
    D=def.st[_dKey==='df'?'sd':'df'];MEDSEEN.wonderRoomSwap++;
  }
  /* ROADMAP #81 WIRE 11 -- IS THIS HIT A CRITICAL ONE, ASKED BEFORE THE STAGES ARE APPLIED.
   *
   * `attAb` and `defAb` used to be declared thirty lines below, under the stat multipliers. They are
   * pure reads of two fields and nothing between here and there writes either, so hoisting them is a
   * move and not a change -- and it is necessary, because `critChance` needs the SUPPRESSED defender
   * ability (a Mold Breaker punches through Shell Armor) and the stages have to be decided above the
   * two `Math.floor` lines that apply them.
   *
   * TWO DOORS INTO ONE FACT. `isCrit` is the battle loop's ROLLED crit, handed down after the die;
   * `critChance(...) === 1` is Flower Trick / Storm Throw / Frost Breath, which are certain and which
   * every pure caller (bestMoveVs, playerAction, the leaf) must price as crits without being told.
   * Both land on `_critHere` so there is one implementation of "this hit crits" rather than two. */
  const attAb=att.ability;
  /* WIRE 37 -- MOLD BREAKER, and it is ONE local rather than seven guards. Mold Breaker, Teravolt and
   * Turboblaze suppress the DEFENDER's ability for the duration of the move, and this calc consulted
   * `def.ability` in six independent places (Tablets/Vessel of Ruin, typeImmunity, immuneToMoveClass,
   * damageReduce, halvesTypeDamage, preventsCrit). Guarding each site is six chances to miss one and
   * six places for the next reader to disagree; shadowing the value at the top means every one of
   * them sees the same suppressed ability, which is exactly what the real mechanic does.
   * The DEFENDER's own body is untouched -- types, stats and boosts all still apply -- because Mold
   * Breaker ignores the ABILITY and nothing else. Levitate is the sharpest case and the probe uses it:
   * a hard zero becomes a number, which no partial implementation can fake. */
  const defAb=TAGS.param('ability',attAb,'ignoresDefenderAbility')?'none':def.ability;
  const _critHere=!!isCrit||!!(mv.id&&critChance(mv.id,null,defAb)===1);
  /* WIRE 94 -- UNAWARE (294 uses), the ABILITY half of `ignoresStatStages`. The MOVE half (Sacred
   * Sword, Darkest Lariat) has been live all along under the `ignoresBoosts` tag read two lines
   * down, which makes the move-side `ignoresStatStages` a REDUNDANT second spelling of one fact --
   * flagged for the staged tag_dex cleanup. Unaware carried only the orphan tag, so a +6 attacker
   * into an Unaware wall was priced at +6. Both directions, which is the real rule: defending, it
   * ignores the attacker's offensive stages; attacking, it ignores the defender's defensive stages.
   * A Mold Breaker attacker ignores the defender's Unaware, through the same suppression the other
   * defender-ability reads use. */
  const _uaDef=!TAGS.param('ability',att.ability,'ignoresDefenderAbility')
    &&TAGS.param('ability',def.ability,'ignoresStatStages');
  const _uaAtt=TAGS.param('ability',att.ability,'ignoresStatStages');
  /* ROADMAP #81 WIRE 11 -- A CRIT IGNORES *ONE SIGN* OF EACH STAGE, AND THE SIGN IS THE WHOLE RULE.
   *
   *     const ignoreOffensive = !!(move.ignoreOffensive || (moveHit.crit && atkBoosts < 0));
   *     const ignoreDefensive = !!(move.ignoreDefensive || (moveHit.crit && defBoosts > 0));
   *
   * (sim/battle-actions.ts:1683-1691, with `moveHit.crit` setting both flags at :1683.) So a crit
   * refuses the attacker's NEGATIVE offensive stage and the defender's POSITIVE defensive stage, and
   * keeps the other two -- a crit from a Swords Dance user still gets the +2, and a crit into a body
   * at -2 Defence still gets that. Writing this as "a crit ignores boosts" would be a new wrong
   * number in the opposite direction on exactly the turns setup matters, which is why the probes
   * carry the minus-signed arm as well.
   *
   * WHY THIS ONE IS EXPENSIVE: Intimidate is on 31,129 observed sets. An Intimidated attacker landing
   * a crit hits at FULL Attack and this engine priced it at -1 -- Meowscarada's Flower Trick into
   * Garchomp read 76 where the rule says 113. */
  const _critIgnA=_critHere&&_aBody.boosts[_aKey]<0;
  const _critIgnD=_critHere&&def.boosts[_dKey]>0;
  A=Math.floor(A*(((_ib&&_ib.offensive)||_uaDef||_critIgnA)?1:boostMul(_aBody.boosts[_aKey])));
  D=Math.floor(D*(((_ib&&_ib.defensive)||_uaAtt||_critIgnD)?1:boostMul(def.boosts[_dKey])));
  /* EVERY STAT MULTIPLIER FROM HERE DOWN GOES THROUGH `md4096` (WIRE 4). Showdown reaches all of
   * them through `runEvent('ModifyAtk'/'ModifySpA'/'ModifyDef'/'ModifySpD')`, whose handlers
   * chainModify and whose relay is spent by `modify`. x1.5 and x2 happen to be the values where a
   * truncation and a round-half-up agree, so these three lines do not move -- the 0.75 Ruin pair
   * and the 5461/4096 pair below DO, and routing the whole block through one call is what stops the
   * next multiplier added here from being wrong by default.
   *
   * ROADMAP #92 -- AND IT IS ONE CHAIN PER STAT NOW, NOT ONE SPEND PER MEMBER. WIRE 4 got the
   * ARITHMETIC right and left the SHAPE wrong: `runEvent('ModifyAtk')` folds every handler -- the
   * attacker's `onModifyAtk` AND the defender's `onSourceModifyAtk` -- into a single
   * `event.modifier` and spends it once at `finalModify`. Twelve separate `md4096` calls truncate
   * twelve times where the authority truncates once, and that is invisible until two of them
   * co-occur (a Guts body into a Thick Fat body; Sword of Ruin under snow). `_aCh` and `_dCh` are
   * the two relays; every member below folds, and the two spends happen immediately before the
   * damage formula. */
  let _aCh=CH_ONE,_dCh=CH_ONE;
  const ACH=m=>{_aCh=ch4096(_aCh,m);},DCH=m=>{_dCh=ch4096(_dCh,m);};
  /* THESE THREE LINES WERE HARDCODED TO ITEMS THIS FORMAT BANS, AND THE TAG THAT SHOULD HAVE STOOD
   * HERE HAD NO CONSUMER AT ALL. (2026-08-10, the items queue.)
   *
   *     if(phys && att.item==='choiceband')  ACH(1.5);
   *     if(!phys && att.item==='choicespecs')ACH(1.5);
   *     if(!phys && def.item==='assaultvest')DCH(1.5);
   *
   * Choice Band, Choice Specs and Assault Vest are all `isNonstandard: 'Past'` here — CLAUDE.md names
   * all three on the ban list — so every one of those conditions was permanently false. Meanwhile
   * `statMult`, the tag that describes exactly this, was itself hardcoded to the SAME four dead names
   * in `tag_dex.js` and read by nothing. A dead producer and a dead consumer, describing each other.
   *
   * Both are derived now. The only member this format has is **Light Ball** (41 uses, x2 to Atk and
   * SpA, and ONLY on Pikachu) — a roster DID-NOT-FIRE row. The species lock is carried in the tag and
   * honoured here, because an item that doubles everybody's Attack is a different item.
   *
   * The attacker's side and the defender's side are asked separately: a stat this move does not use
   * must not fold into its chain. `_aKey`/`_dKey` are already the two stats in play. */
  {
    const _sm=(body,key,apply)=>{
      if(!body||!body.item)return;
      const p=TAGS.param('item',body.item,'statMult');
      if(!p||!p.mult||!Array.isArray(p.stats))return;
      /* THE LOCK COMPARES BASE SPECIES, because Showdown's own check is
       * `pokemon.baseSpecies.baseSpecies === "Pikachu"` — the BASE name, so every Pikachu forme
       * qualifies and nothing else does. Our body carries a key like `pikachu` or `pikachu-world`;
       * the segment before the first hyphen is that base name. Deliberately not a whole-key equality,
       * which would silently exclude a forme the authority includes. */
      if(p.onlySpecies&&pasteKey(p.onlySpecies)!==String(body.name||'').split('-')[0])return;
      if(p.stats.some(s=>_S2E[s]===key))apply(+p.mult);
    };
    _sm(att,_aKey,ACH);
    _sm(def,_dKey,DCH);
  }
  /* WEATHER RAISES A DEFENCE, and both halves were missing. Snow gives an Ice type x1.5 DEFENCE and
   * sand gives a Rock type x1.5 SPECIAL DEFENCE -- these are passive properties of the weather, not
   * abilities, so nothing in the ability chain above could ever have caught them. Found by Will
   * asking whether the engine knew; grep returned zero for both.
   *
   * Not a corner case: Snow Warning is 287,161 usage in this format and Sand Stream 147,107, and the
   * teams built around them are exactly the ones that field the Ice and Rock types this protects. The
   * effect is to OVERESTIMATE damage into every Rock in sand and every Ice in snow, which flows
   * straight into koTarget -- so MAG has been calling kills that cannot happen against the two
   * archetypes most likely to be running those types.
   *
   * Defence-raising only. Neither weather boosts the matching ATTACK, which is the natural
   * mis-statement of the rule and would be wrong in the opposite direction. */
  if(phys&&field.weather==='snow'&&def.types.includes('Ice'))DCH(1.5);
  if(!phys&&field.weather==='sand'&&def.types.includes('Rock'))DCH(1.5);
  /* ONE READ OF THE ATTACKER'S ABILITY, reused. The ratcheted raw-identity count is a fitness
     function, not a style rule: it fired when the Infiltrator check below added a 235th raw read
     against a baseline of 234. Hoisting is the fix rather than a re-baseline -- the value cannot
     change inside a pure damage calc, so one local is strictly better than four lookups.
     ROADMAP #81 WIRE 11 -- `attAb` and `defAb` were DECLARED HERE and are now declared above the
     stage lines, because `_critHere` needs the suppressed defender ability before the stages are
     applied. The two comments moved with them; this note is what is left at the old site. */
  if((attAb==='hugepower'||attAb==='purepower')&&phys)ACH(2);
  // --- stat-multiplying abilities (validated gaps vs @smogon/calc) ---
  if(attAb==='guts'&&phys&&att.status&&att.status!=='none')ACH(1.5);
  if(att.ability==='solarpower'&&!phys&&field.weather==='sun')ACH(1.5);
  if(att.ability==='orichalcumpulse'&&phys&&field.weather==='sun')ACH([5461,4096]);
  if(att.ability==='hadronengine'&&!phys&&terrainId(field.terrain)==='electric')ACH([5461,4096]);
  /* ROADMAP #92 -- THICK FAT, HEATPROOF, PURIFYING SALT AND WATER BUBBLE MODIFY A **STAT**, AND WE
   * MODIFIED THE DAMAGE. All four reach the game through `onSourceModifyAtk`/`onSourceModifySpA`
   * (the DEFENDER halving the attacker's stat) and Water Bubble's offensive half through
   * `onModifyAtk`/`onModifySpA` -- never through `onModifyDamage`. This block used to sit in the
   * final MODMUL chain two hundred lines below, which is a different stage: a stat passes through
   * `tr(22*bp*A/D)` and `tr(/50)` before it becomes damage and a final multiplier does not, and the
   * truncations do not commute. Measured at 73.1% (19/26) disagreement for the halving trio and
   * 77.3% (17/22) for Water Bubble -- docs/DAMAGE-STAGES.md §2a -- against a 4.1% control.
   *
   * `basePowerTypes` (Dry Skin) does NOT come here. It is `onSourceBasePower`, a third stage again,
   * and it is folded into the base-power chain below. One tag, two routes, and the tag already
   * names which is which -- reading the wrong field is how this would silently come back. */
  {
    const _htdA=TAGS.param('ability',defAb,'halvesTypeDamage');
    if(_htdA&&_htdA.types&&_htdA.types.indexOf(mvT)>=0&&_htdA.attackerStatMult)ACH(_htdA.attackerStatMult);
  }
  if(att.ability==='waterbubble'&&mvT==='Water')ACH(2);
  /* ROADMAP #92 -- THE STAT-STAGE HALF OF `damageBoost`, AND THE MEMBERSHIP WAS PRINTED FIRST.
   *
   * 44 abilities carry `damageBoost` and NOTHING read it. It cannot be wired as a class, and that is
   * a fact about the tag rather than a lack of nerve: the param carries a multiplier and NO STAGE
   * (Analytic/Reckless/Rivalry/Sand Force are `onBasePower`; Steelworker/Transistor/Dragon's Maw/
   * Rocky Payload/Stakeout/Hustle/Gorilla Tactics are `onModifyAtk`) and NO CONDITION -- Blaze,
   * Torrent, Overgrow and Swarm carry `onlyWhen: "only below 1/3 HP"` as PROSE, Analytic needs "every
   * other body has already moved", Rivalry needs gender, Reckless needs the recoil flag, Stakeout
   * needs "the target switched in this turn". Wiring the class would hand Blaze a permanent x1.5 on
   * 5,808 sheets. It also DUPLICATES nine abilities that are already live under a sharper tag (Tough
   * Claws, Huge Power, Guts, Sheer Force, Pixilate, Solar Power, Orichalcum, Hadron, Water Bubble),
   * which would double them.
   *
   * SO THE SHAPE IS NARROWED UNTIL IT IS DERIVABLE, and the membership is printed by
   * tests/test-damage-stages.js rather than typed here: a `damageBoost` with a MULTIPLIER, a TYPE,
   * no weather, no `onlyWhen`, and NO OTHER TAG ON THE ABILITY. That is exactly the
   * "multiply my attacking stat for moves of this type, always" family, and every member of it in
   * this format is `onModifyAtk`/`onModifySpA` -- verified handler by handler against the dex, and
   * asserted by the probe, not remembered. Members today: dragonsmaw, firemane, rockypayload,
   * steelworker, transistor. All five are 0 corpus uses; they are wired because they are right.
   *
   * ROADMAP #112 -- AND THE FOUR EVERYBODY RUNS. The paragraph above was true and the shape it
   * describes was armed for the wrong half of the family: `!_db.onlyWhen` refused BLAZE (5,903 uses),
   * TORRENT (1,924), OVERGROW (651) and SWARM (46) -- 8,524 uses that had never fired once -- while
   * serving five abilities with zero. The refusal itself was never the defect and is not removed: a
   * condition is still refused unless it can be READ. What changed is upstream, in tag_dex, where
   * `onlyWhen` stopped being the sentence "only below 1/3 HP" and became `{cond:'hpFraction',
   * of:'self', cmp:'<=', num:1, den:3}` derived from Showdown's own `attacker.hp <= attacker.maxhp/3`.
   * `condHolds` evaluates it in integers; anything it cannot read returns null and is COUNTED, which
   * is the only difference between failing closed and failing silently.
   *
   * `att`, not `_aBody`: the condition is about the body whose ability this is, and `attAb` two
   * hundred lines up is `att.ability`. A Foul Play user reading its TARGET's stat is the one case
   * where Showdown would pair the ability and the HP differently, and that pairing is wrong here
   * already -- filed, not fixed, because it is the `attAb` read and not this condition. */
  {
    const _db=TAGS.param('ability',attAb,'damageBoost');
    const _rec=_db&&TAGS.tagsFor&&TAGS.tagsFor('ability',attAb);
    if(_db&&_db.mult&&_db.onType&&!_db.inWeather&&_db.onType===mvT
       &&_rec&&_rec.tags&&_rec.tags.length===1){
      const _dbw=condHolds(_db.onlyWhen,att);
      if(_dbw===null){MEDFAILS.damageBoostUnknownCond++;
        if(!MEDFAILS.damageBoostUnknownCondFirst)
          MEDFAILS.damageBoostUnknownCondFirst=String(attAb)+'/'+JSON.stringify(_db.onlyWhen);}
      else if(_dbw){ACH(exact4096(attAb,+_db.mult));MEDSEEN.damageBoostStat++;}
    }
  }
  /* WIRE 112 (STAGED consumer) -- MARVEL SCALE, through `condStatMult`: a stat multiplied while a
   * body condition holds ({stat:'def', mult:1.5, when:'statused'}). The derivation is written in
   * tag_dex and its regeneration is staged, so this matches nothing in the shipped artifact today;
   * the probe injects the staged tag through TAGS.__setDB. `when` values this engine cannot
   * evaluate fail CLOSED (no multiplier) -- a guessed condition is the boolean-in-a-fraction's-
   * clothing defect. Reads defAb, so Mold Breaker punches through it, which is the real rule. */
  {const _cs=TAGS.param('ability',defAb,'condStatMult');
   if(_cs&&_cs.mult&&_cs.when==='statused'&&def.status&&def.status!=='none'){
     if(_cs.stat===(phys?'def':'spd'))DCH(+_cs.mult);
   }}
  // Ruin abilities lower everyone-else's stat (field-wide; handled pairwise)
  if(phys&&att.ability==='swordofruin')DCH(0.75);
  if(!phys&&att.ability==='beadsofruin')DCH(0.75);
  if(phys&&defAb==='tabletsofruin')ACH(0.75);
  if(!phys&&defAb==='vesselofruin')ACH(0.75);
  /* THE TWO STAT RELAYS ARE SPENT HERE, ONCE EACH, exactly where `getDamage` spends them
   * (battle-actions.ts:1708-1709) -- above the formula and below every handler. */
  if(_aCh!==CH_ONE){A=mdChain(A,_aCh);MEDSEEN.statChainSpent++;}
  if(_dCh!==CH_ONE){D=mdChain(D,_dCh);MEDSEEN.statChainSpent++;}
  /* ROADMAP #81 WIRE 12 -- THE AURAS, APPLIED TO BASE POWER AND NOT TO THE DAMAGE.
   *
   * `onAnyBasePower` runs inside `runEvent('BasePower', ...)`, ABOVE `getDamage`'s formula, so the
   * 5448/4096 multiplies mvBP and is then truncated by the formula's own two floors. Applying it to
   * `base` instead would be a different number on roughly half of all values, which is exactly the
   * class of error WIRE 4 was landed to remove. It sits here, at the bottom of the base-power block
   * and immediately above the formula, so nothing that reads mvBP misses it.
   *
   * `target === source` IS THE AUTHORITY'S OWN FIRST GUARD -- a move a body aims at itself takes no
   * aura -- and the STATUS half of that guard is already served by the `hasPower` early return at
   * the top of this function. */
  /* IT IS A CHAIN, NOT A SPEND, AND THAT IS THE POINT OF THE SHAPE RATHER THAN OF THIS ONE MEMBER.
   * `runEvent('BasePower')` folds EVERY `onBasePower` handler into one `event.modifier` and spends
   * it ONCE (`battle.ts:2318`/`2302`, then `finalModify` -> `modify`), so two handlers in one chain
   * truncate once and not twice. Demonstrated by the stage audit: Gallade Drain Punch into Snorlax
   * with Iron Fist AND Muscle Band reads 228 in the authority and 227 here, while each ONE ALONE
   * agrees -- the missing unit is the second truncation.
   *
   * ROADMAP #92 -- AND THE CHAIN NOW HAS EVERY MEMBER, WHICH IS THE WHOLE OF THIS WIRE. What was
   * written above as the next pass's job is this block. Fourteen multipliers moved here from three
   * different wrong places: the final ModifyDamage chain (the 18 type items, Muscle Band, Wise
   * Glasses, Dry Skin), the BASE DAMAGE (Technician, Tough Claws / Sharpness / Iron Fist / Mega
   * Launcher / Strong Jaw / Punk Rock, Sheer Force, Supreme Overlord, Expanding Force / Rising
   * Voltage), a bare `Math.floor` on mvBP (the -ate x1.2), and the HIT SITE (Helping Hand). Two more
   * were absent entirely: the four field terrains and the narrowed type-scoped abilities.
   *
   * A STAGE FIX ALONE IS NOT SUFFICIENT. Every one of these is a `chainModify`, so they fold into
   * ONE relay and truncate ONCE. Gallade Drain Punch into Snorlax with Iron Fist AND Muscle Band
   * reads 228 in the authority and read 227 here, while each one ALONE agreed -- a fix that moved
   * every member to the right stage but kept a floor apiece would pass every single-modifier test
   * and stay wrong on real boards. `_bpMembers` counts what went in so a chain that never holds two
   * members reads as the untested case it is rather than as a pass. */
  {
    let _bpChain=CH_ONE,_bpMembers=0;
    const BPCH=m=>{_bpChain=ch4096(_bpChain,m);_bpMembers++;};
    const _au=(att!==def)?auraFor(field,att,def):null;
    const _ae=_au&&_au.types&&_au.types[mvT];
    if(_ae){
      const _m=_au.brk?_ae.breakMult:_ae.mult;
      /* NO SILENT DEFAULT. An artifact generated before the pair was derived carries `mult: 1.33`,
       * which md4096 would trunc to 5447/4096 -- one 4096th wrong on every Fairy move and invisible.
       * Refuse it, count it, and leave the damage alone rather than be quietly off. */
      if(Array.isArray(_m)&&_m.length===2){BPCH(_m);MEDSEEN.auraApplied++;}
      else {MEDFAILS.auraMultUnusable++;if(!MEDFAILS.auraMultUnusableFirst)MEDFAILS.auraMultUnusableFirst=mvT+'/'+JSON.stringify(_m);}
    }
    /* THE -ATE x1.2 (`[4915,4096]`, priority 23). The TYPE half was decided at the top of this
     * function; only the power half is a chain member. */
    if(_ateMult&&_ateMult!==1)BPCH(_ateMult);
    /* HELPING HAND, 4,306 clicks and the highest-usage row in the whole stage class. The condition's
     * own `onBasePower` is `chainModify(this.effectState.multiplier)`, and the multiplier is 1.5 per
     * application. It was `Math.floor(rolled * 1.5)` at the hit site -- one stage AND one chain late,
     * and wrong on 5 of 5 audited rows. */
    if(hit&&hit.helpingHand){BPCH(+hit.helpingHandMult||1.5);MEDSEEN.helpingHandBP++;}
    /* TECHNICIAN, and the `<= 60` gate reads the RAW base power on purpose. Its
     * `onBasePowerPriority` is 30, the highest in this format, so when its handler runs
     * `this.modify(basePower, this.event.modifier)` the relay is still 1 and `modify(bp, 1) === bp`.
     * Proved rather than assumed: Body Slam (85 BP) + Technician + Silk Scarf takes no Technician
     * boost in either engine. Moved here from a `Math.floor` on the BASE DAMAGE -- 40.3% wrong. */
    if(attAb==='technician'&&mvBP<=60)BPCH(1.5);
    /* WIRE 13's boostsMoveClass -- Tough Claws (contact), Sharpness (slicing), Mega Launcher (pulse),
     * Strong Jaw (bite), Punk Rock (sound, the OFFENSIVE half), Iron Fist (punch). Every one is
     * `onBasePower`; every one used to multiply the base DAMAGE. Tough Claws measured 34.0% wrong,
     * Sharpness 48.0%. */
    {
      const _bc=TAGS.param('ability',attAb,'boostsMoveClass');
      if(_bc&&_bc.mult&&mv.id){
        const _f=_bc.boostsFlag;
        const _has=_f==='contact'?mvMakesContact(mv.id)
                 :_f==='sound'?TAGS.has('move',mv.id,'sound')
                 :(()=>{const c=TAGS.param('move',mv.id,'moveClass');return !!(c&&c.classes&&c.classes.indexOf(_f)>=0);})();
        if(_has)BPCH(exact4096(attAb,_bc.mult));
      }
    }
    /* SHEER FORCE's x1.3 is `[5325,4096]` and applies only to a move that HAD a secondary to remove. */
    {
      const _ros=TAGS.param('ability',attAb,'removesOwnSecondaries');
      if(_ros&&_ros.powerMult&&mv.id){
        const _fx2=moveFx(mv.id);
        if(_fx2&&_fx2.secondary&&_fx2.secondary.length)BPCH(exact4096(attAb,+_ros.powerMult));
      }
    }
    /* SUPREME OVERLORD, and the table is the authority's EXACT 4096ths rather than `1 + 0.1n`:
     * `[4096, 4506, 4915, 5325, 5734, 6144]`. `1+0.1*3 = 1.3 -> 5324` where the handler says 5325,
     * and `1+0.1*1 = 1.1 -> 4505` where it says 4506. The tag carries `perFallen: 0.1`, which is the
     * handler's INTENT and not its arithmetic, so the table is read off the source and the tag's
     * `max` still bounds the index. */
    {
      const _bf=TAGS.param('ability',attAb,'boostsFromFallen');
      if(_bf&&att._fallenStuck){
        const _POW=[4096,4506,4915,5325,5734,6144];
        const _n=Math.min(att._fallenStuck,+_bf.max||5,5);
        if(_n>0)BPCH([_POW[_n],4096]);
      }
    }
    /* THE MOVE'S OWN TERRAIN SCALING -- Expanding Force `chainModify(1.5)` in Psychic Terrain and
     * Rising Voltage's doubling in Electric Terrain. Both used to multiply the base DAMAGE. The
     * grounded-ness gate is still not applied and the reason is unchanged and stated at the old
     * site: the tag carries `{terrain, mult}` and no SUBJECT, and the two members disagree about
     * whose feet matter (Expanding Force the user's, Rising Voltage the target's). */
    {
      const _ts=TAGS.param('move',mv&&mv.id,'terrainScaled');
      if(_ts&&_ts.terrain&&_ts.mult&&terrainId(field.terrain)===terrainId(_ts.terrain))BPCH(+_ts.mult);
    }
    /* ROADMAP #92 -- THE FIELD TERRAINS THEMSELVES, ABSENT ENTIRELY UNTIL NOW. Not "in most games":
     * measured, all terrain setters combined are 161 corpus uses against Fake Out's 15,106. The
     * MAGNITUDES are what make it worth landing -- a Grassy-Terrain Earthquake was priced at 118 here
     * against the authority's 60, so this engine dealt DOUBLE on the one move the terrain exists to
     * blunt. Grounded-ness is real here and the SUBJECT is the authority's, per condition:
     *   electric  x[5325,4096] on Electric, the ATTACKER grounded
     *   psychic   x[5325,4096] on Psychic,  the ATTACKER grounded
     *   grassy    x0.5 on earthquake/bulldoze/magnitude, the DEFENDER grounded;
     *             x[5325,4096] on Grass,    the ATTACKER grounded
     *   misty     x0.5 on Dragon,           the DEFENDER grounded
     * Typed as literal 4096ths because they are field constants with no tag to read them from -- the
     * terrain CONDITION carries these handlers, and this artifact tags moves, items and abilities. */
    {
      const _tid=terrainId(field.terrain);
      if(_tid){
        const _ag=isGrounded(att),_dg=isGrounded(def);
        if(_tid==='electric'&&mvT==='Electric'&&_ag)BPCH([5325,4096]);
        else if(_tid==='psychic'&&mvT==='Psychic'&&_ag)BPCH([5325,4096]);
        else if(_tid==='misty'&&mvT==='Dragon'&&_dg)BPCH(0.5);
        else if(_tid==='grassy'){
          if(/^(earthquake|bulldoze|magnitude)$/.test(mv.id||'')&&_dg)BPCH(0.5);
          else if(mvT==='Grass'&&_ag)BPCH([5325,4096]);
        }
      }
    }
    /* THE 18 TYPE ITEMS (Fairy Feather 3,015; Black Glasses 2,591; Mystic Water 1,711; Charcoal
     * 1,167 ... ~8,500 uses combined) -- the single biggest class in the audit. Every one is
     * `onBasePower` x[4915,4096] and every one of them was spent on the FINAL DAMAGE. Black Glasses
     * measured 65.0% wrong, Charcoal 40.0%. */
    {
      const _ty=TAGS.param('item',att.item,'damageMultType');
      if(_ty&&_ty.onType===mvT&&_ty.mult)BPCH(_ty.mult);
    }
    /* MUSCLE BAND / WISE GLASSES, `[4505,4096]`. Name-wired because both are `untagged` in the
     * artifact; the value is the authority's pair rather than the 1.1 that used to be typed here. */
    if(att.item==='muscleband'&&phys)BPCH([4505,4096]);
    if(att.item==='wiseglasses'&&!phys)BPCH([4505,4096]);
    /* DRY SKIN takes x1.25 from Fire through `onSourceBasePower` -- the DEFENDER reaching into the
     * attacker's base power, which is a third route again and the reason `halvesTypeDamage` is read
     * in two places with two different fields. 40.0% wrong at the old stage. */
    {
      const _htd=TAGS.param('ability',defAb,'halvesTypeDamage');
      if(_htd&&_htd.basePowerTypes&&_htd.basePowerTypes.indexOf(mvT)>=0&&_htd.basePowerMult)
        BPCH(+_htd.basePowerMult);
    }
    /* SPENT ONCE, and clamped to 1 exactly as `battle-actions.ts:1653` clamps it after the event. */
    if(_bpChain!==CH_ONE){mvBP=Math.max(1,mdChain(mvBP,_bpChain));MEDSEEN.bpChainSpent++;MEDSEEN.bpChainMembers+=_bpMembers;}
  }
  let base=Math.floor(Math.floor(22*mvBP*A/D)/50)+2;
  if(spread)base=md4096(base,0.75);
  if(field.weather==='rain'){if(mvT==='Water')base=md4096(base,1.5);if(mvT==='Fire')base=md4096(base,0.5);}
  if(field.weather==='sun'){if(mvT==='Fire')base=md4096(base,1.5);if(mvT==='Water')base=md4096(base,0.5);}
  /* WIRE 35 -- THE CERTAIN HALF OF THE CRIT. Placed exactly where Showdown's getDamage puts it:
   * after the spread and weather multipliers, before the random roll. `att` is passed as NULL on
   * purpose -- the attacker's Scope Lens and Super Luck raise a RATE, and a rate has no place in a
   * min/max range (see the comment on critChance). Only pCrit === 1 lands here, so this fires for
   * Flower Trick, Storm Throw and Frost Breath and for nothing else, and a Shell Armor / Battle
   * Armor / Disguise defender turns it back off.
   *
   * ROADMAP #81 WIRE 11 -- THE THREE PARTS THIS COMMENT USED TO DECLARE UNMODELLED ARE WIRED, AND
   * THEY ARE WIRED ABOVE, NOT HERE. From `sim/battle-actions.ts:1683-1691`, `moveHit.crit` sets both
   * `ignoreNegativeOffensive` and `ignorePositiveDefensive`, applied as
   * `ignoreOffensive = (ignoreNegativeOffensive && atkBoosts < 0)` and
   * `ignoreDefensive = (ignorePositiveDefensive && defBoosts > 0)`. So:
   *   1. a crit ignores the ATTACKER'S NEGATIVE offensive stages  -> `_critIgnA`, at the A line;
   *   2. a crit ignores the DEFENDER'S POSITIVE defensive stages  -> `_critIgnD`, at the D line;
   *   3. a crit ignores SCREENS                                   -> `_critHere` at the screen block.
   * The stated blocker was that "dmgRange recomputes A and D without a crit flag"; the flag is now a
   * sixth parameter and `_critHere` is where the two doors into it meet.
   *
   * AND ONE THING A CRIT DOES *NOT* IGNORE, recorded so nobody "completes" this list wrongly:
   * BURN. Will: *"i dont think it ignores burn tho"* — correct. The three rules above operate on
   * BOOST STAGES; burn's halving is an `onModifyAtk` multiplier and is not a stage, so it survives a
   * critical hit. Gen 2 did ignore burn on a crit and Gen 3 onward does not, which is why this is
   * the half people misremember. Applying it here would be a new bug wearing a fix's clothes, and
   * `tests/test-mechanics.js` now carries a probe that goes RED on any engine that adds it.
   *
   * ROADMAP #92 -- AND IT NOW READS `_critHere`, WHICH IS THE FIX. The certain-crit path was always
   * in the right place and passed at both endpoints; the ROLLED crit was applied by the battle loop
   * to a number that had already been rolled, STAB'd, type-charted, burnt and chain-spent. That is
   * four stages late, and it hid because the audit harness pins the top roll, where the randomizer is
   * the identity: no crit / bottom roll disagreed on 5.5% of rows, crit / bottom roll on 46.5%, crit
   * + Life Orb / bottom roll on 61.8%. Worked example, Kowtow Cleave at base 61: six of sixteen rolls
   * disagree, and roll 0 -- the one every existing check pins -- is one of the ten that AGREE.
   * The battle loop no longer multiplies; it asks for the crit price through `isCrit` and reads it.
   *
   * SNIPER LEFT THIS LINE. It is `onModifyDamage`, so it belongs in the FINAL chain beside Life Orb
   * and the screens, not folded into a plain truncated multiply that is not a modifier at all. It is
   * applied below, gated on `_critHere`, and the battle loop's copy is gone with it. */
  if(_critHere){base=Math.floor(base*1.5);MEDSEEN.critInRange++;}
  /* WIRE 98 -- PARENTAL BOND (Kangaskhanite, 217 corpus uses). The second hit is a quarter, so a
   * single-target damaging move is x1.25 total. NOT applied to spread moves (the real rule in
   * doubles) and NOT to moves that already multi-hit. The flinch/secondary doubling is not modelled
   * and is stated here rather than discovered. */
  {
    const _h2=TAGS.param('ability',attAb,'hitsTwice');
    if(_h2&&_h2.hits>1&&!spread&&mv.id&&expectedHitsOf(mv.id)<=1)
      base=Math.floor(base*(1+(+_h2.secondHitMult||0.25)));
  }
  /* WIRE 128 -- THE TYPE CHART, THE OVERRIDES AND SCRAPPY ARE ONE FUNCTION NOW (see typeEffAgainst).
   * They used to live inline here, and the battle loop's own immunity gate re-derived the same
   * question as a bare `mcEff(effMoveType(...), tg.types)` -- so a Scrappy body's Body Slam was
   * priced at 88 by this calc and refused outright by the loop that executes it. */
  let eff=typeEffAgainst(att,def,mv,mvT);
  if(eff===0)return{min:0,max:0,eff:0};
  // type-immunity abilities (defender absorbs the type)
  const _imm=absorbedBy(att,def,mvT);
  if(_imm)return{min:0,max:0,eff:0};
  /* WIRE 22 -- immuneToMoveClass, and WIRE 128 collapsed it: this block was a second, independent
   * copy of moveClassBlocked() sitting inside the damage calc, and the two had already drifted --
   * that one honoured Mold Breaker through `defAb` and the shared function did not. One owner. */
  if(mv.id&&moveClassBlocked(def,mv.id,att))return{min:0,max:0,eff:0};
  /* WIRE 21 -- fixedDamage. These moves have NO BASE POWER, so hasPower() rejected them and dmgRange
   * returned a flat zero: Super Fang (578 uses), Final Gambit (251), Endeavor (93) and the OHKO moves
   * were worth LITERALLY NOTHING to every rollout and every score.
   *
   * PLACED HERE ON PURPOSE -- after the type chart and after the absorb abilities, before stats,
   * STAB and every modifier. That is the real rule and the tag states it as ignoresStatsAndSTAB:
   * Seismic Toss still does nothing to a Ghost and Super Fang still does nothing to a Ghost, but
   * neither cares about Attack, Defence, a screen, a boost or a Life Orb.
   *
   * ONLY THE SHAPES THAT ARE ACTUALLY COMPUTABLE FROM (att, def) ARE DONE, and the rest are left at
   * zero LOUDLY rather than approximated. Counter, Mirror Coat, Metal Burst and Comeuppance need the
   * damage taken THIS TURN, which is turn state that a pure pricing function is not given and must
   * not invent -- 41 corpus uses between them. If dmgRange ever gains that state, they are one branch
   * away and the tag already names the source.
   *
   * The OHKO moves return the target's full HP, which is the damage IF IT LANDS; their 30% accuracy
   * lives in moveAccuracy where every other accuracy does, and folding it in here would double-count
   * it for any caller that asks both. */
  {
    const _fd=mv.id?TAGS.param('move',mv.id,'fixedDamage'):null;
    if(_fd){
      const _hp=(def.curHP!=null?def.curHP:(def.st?def.st.hp:0));
      const _mine=(att.curHP!=null?att.curHP:(att.st?att.st.hp:0));
      let _flat=null;
      if(_fd.damage==='level')_flat=50;                       // Champions is Level 50 throughout
      else if(_fd.source==='halfTargetCurrentHP')_flat=Math.floor(_hp/2);
      else if(_fd.source==='myRemainingHP')_flat=_mine;
      else if(_fd.source==='targetDownToMine')_flat=Math.max(0,_hp-_mine);
      else if(_fd.source==='ohko')_flat=_hp;
      /* THE RETALIATION BRANCH — the one this comment block promised and did not have (2026-08-10).
       *
       * Counter, Mirror Coat, Metal Burst and Comeuppance return a multiple of the damage the USER
       * took this turn. The old note was right that a pure pricing function must not INVENT turn
       * state — so the state was added to the body instead (`_took`, recorded on the one line every
       * damage packet passes through) and this reads it. Nothing is invented here: an unfilled `_took`
       * means no qualifying hit landed, and the move correctly returns 0, which is what the authority
       * returns too (`if (!pokemon.volatiles['counter']) return 0`).
       *
       * The multiplier and the category filter come from the TAG, derived from the condition — x2 on
       * a physical hit for Counter, x2 special for Mirror Coat, x1.5 on any for Metal Burst and
       * Comeuppance. None of those four numbers is written here.
       *
       * A HYPOTHETICAL PRICE STILL READS 0, correctly and for the same reason: `board.js` scoring a
       * click into the future has no `_took` on its bodies, and a Counter thrown at a body that has
       * not hit you does nothing. That is the move, not a gap. */
      if(_flat==null&&_fd.retaliates&&_fd.mult){
        const _t=att._took;
        const _src=_t?(_fd.category==='physical'?_t.phys:_fd.category==='special'?_t.spec:_t.any):0;
        /* NO QUALIFYING HIT MEANS ZERO, AND IT HAS TO BE RETURNED HERE RATHER THAN FALLEN THROUGH.
         * Measured the moment the hasPower gate opened: Mirror Coat after a PHYSICAL hit read 1, and
         * a Counter on a body that had taken nothing read 2 — because falling through runs the
         * ordinary damage formula at base power 0, which floors at 1 rather than at 0. The authority
         * is explicit: `if (!pokemon.volatiles['counter']) return 0`. A retaliation move with nothing
         * to retaliate against FAILS; it does not chip. */
        if(_src>0)_flat=Math.max(1,Math.floor(_src*+_fd.mult));
        else return{min:0,max:0,eff};
      }
      if(_flat!=null)return{min:_flat,max:_flat,eff};
    }
  }
  /* WIRE 95 -- the STAB factor reads `stabBoost` (Adaptability's x2) off the artifact instead of a
   * name. The 1.5 base is the game's own constant and stays typed. */
  const _sbT=TAGS.param('ability',att.ability,'stabBoost');
  const stab=att.types.includes(mvT)?((_sbT&&+_sbT.stab)||1.5):1;
  /* WIRE 83 -- A MOVE POWERED BY MY OWN STATUS IS NOT ALSO PENALISED BY IT. Showdown's
   * battle-actions applies the burn halving `if (this.gen < 6 || move.id !== "facade")`, so from
   * Gen 6 Facade takes the x2 and NOT the x0.5. This engine applied both and they cancel exactly --
   * which is why the census probe read `clean 51 -> burnt 50` and looked like a dead knob when the
   * doubling was in fact working.
   *
   * KEYED ON THE TAG SHAPE, NOT ON THE NAME, and the shape is the rule: a move whose
   * `conditionalPower.when` is `userStatused` draws its power FROM the status. Showdown hardcodes a
   * single move id because it has no property for this; the closest DERIVABLE statement is the one
   * above, and its membership was printed before it was wired -- exactly one move, `facade`. Stated
   * this way so a future move with the same shape is covered without an edit, and so the claim is
   * checkable rather than a list. */
  const _burnExempt=(()=>{const c=mv.id&&TAGS.param('move',mv.id,'conditionalPower');return !!(c&&c.when==='userStatused');})();
  const burn=(phys&&att.status==='brn'&&att.ability!=='guts'&&!_burnExempt)?0.5:1;
  /* WIRE 1 of N -- damageMultAll, from data/tags.json instead of a hardcoded name.
   * Was `att.item==='lifeorb'?1.3:1`, which is why the tag showed as "read": the string appeared.
   * The tag carries the same 1.3 AND the 1/10 max HP it charges per attack, which this calc still
   * does not apply -- recorded here rather than silently dropped, and owed a wire of its own. */
  const _all=TAGS.param('item',att.item,'damageMultAll');
  const lo=(_all&&_all.mult)||1;
  /* THE FINAL-MODIFIER CHAIN, AND IT IS NOW LITERALLY A CHAIN (WIRE 4). It was a float product
   * spent with one `Math.floor`; it is now accumulated in 4096ths through `ch4096` exactly as
   * Showdown's `runEvent` accumulates `this.event.modifier`, and spent once by `mdChain`. Two
   * modifiers rarely co-occur, but when they do a float product is wrong in its own right:
   * 1.1 x 1.2 = 1.32 -> 5406/4096, where the chain gives 5405/4096. */
  let mod=CH_ONE;
  const MODMUL=m=>{mod=ch4096(mod,m);};
  /* WIRE 36 -- damageReduce, from the artifact instead of two hardcoded name lists. The two lines
   * that used to sit here (`filter|solidrock|prismarmor` at 0.75 on super-effective,
   * `multiscale|shadowshield` at 0.5 from full) were CORRECT and covered five of the tag's eight
   * members. The three they could not reach were the point: ICE SCALES halves every SPECIAL hit and
   * Punk Rock halves every SOUND one, and neither had any representation at all.
   *
   * MEMBERSHIP PRINTED BEFORE WIRING, per docs/LESSONS.md 4, and it over-matched exactly once:
   *   filter 0.75/superEffective, solidrock 0.75/superEffective, prismarmor 0.75/superEffective,
   *   multiscale 0.5/fullHP, shadowshield 0.5/fullHP, icescales 0.5/special, punkrock 0.5/sound,
   *   RIPEN 0.5/null.
   * Ripen does not reduce damage at all -- it DOUBLES berry effects, and the derivation caught it
   * because the handler multiplies by two somewhere. A consumer that treated a null condition as
   * "always" would have handed every Ripen body a permanent 50% damage reduction. So an unnameable
   * condition REFUSES and is counted (MEDFAILS.damageReduceUnknown) rather than defaulting on.
   *
   * ICE SCALES IS ZERO CORPUS USES (Lesson 3 in reverse: the count is a sheet count and this sheet
   * count is 0). It is wired because it is correct, not because it moves a number. */
  {
    const _dr=TAGS.param('ability',defAb,'damageReduce');
    if(_dr&&_dr.damageMult){
      const _w=_dr.onlyWhen;
      const _ok=_w==='superEffective'?eff>1
              :_w==='fullHP'?(def.curHP==null||def.st==null||def.curHP>=def.st.hp)
              :_w==='special'?mv.c==='S'
              :_w==='physical'?mv.c==='P'
              :_w==='sound'?!!(mv.id&&TAGS.has('move',mv.id,'sound'))
              :null;
      if(_ok===null){MEDFAILS.damageReduceUnknown++;
        if(!MEDFAILS.damageReduceUnknownFirst)MEDFAILS.damageReduceUnknownFirst=String(defAb)+'/'+String(_w);}
      else if(_ok)MODMUL(_dr.damageMult);
    }
  }
  if(att.ability==='neuroforce'&&eff>1)MODMUL(1.25);
  if(att.ability==='tintedlens'&&eff<1)MODMUL(2);
  /* SCREENS. In DOUBLES the reduction is x2732/4096, not the x0.5 the tag carries — the tag states
   * the singles value and this is a doubles engine, so using 0.5 would overvalue every screen click
   * by a third. Stated here rather than corrected in the artifact, because the artifact is right
   * about singles and other consumers read it.
   * ROADMAP #81 WIRE 11 -- A CRITICAL HIT IGNORES SCREENS, AND THAT IS NO LONGER A SIMPLIFICATION.
   * The comment that stood here said "dmgRange has no crit flag to branch on, so the alternative was
   * to skip screens entirely — a third off every hit is closer than nothing off any hit." There is a
   * flag now (`_critHere`), so the reduction is skipped on a crit, which is the real rule. Showdown
   * reaches it through the screen condition's own `onAnyModifyDamage`, which returns early when
   * `target.getMoveHitData(move).crit` is set (data/moves.ts, reflect/lightscreen/auroraveil).
   * Infiltrator ignores screens, and the ability tag says which abilities do. */
  const _sf=def&&def._sf;
  if(_sf&&!_critHere&&!TAGS.has('ability',attAb,'ignoresScreensAndSubs')){
    if(mv.c==='P'&&screenUp(_sf,'Physical'))MODMUL(DOUBLES_SCREEN);
    if(mv.c==='S'&&screenUp(_sf,'Special'))MODMUL(DOUBLES_SCREEN);
  }
  /* WIRE 18 -- halvesTypeDamage, from the artifact instead of the four-name list that used to sit
   * here. Thick Fat, Heatproof, Purifying Salt and the DEFENSIVE half of Water Bubble were four
   * hardcoded lines saying 0.5 -- correct, and exactly the shape the tags exist to delete.
   *
   * CONVERTING THEM IS NOT THE POINT. The point is that the tag now carries a SECOND route into the
   * same question and the list could never have expressed it: Showdown answers "how much does a move
   * of this type do to me" either by halving the attacker's stat (all four above) or by scaling BASE
   * POWER, and DRY SKIN takes x1.25 from Fire through the second one. That is not a resistance, it
   * does not appear in the type chart, and it had no row in the artifact at all until tonight -- so
   * the engine could not have had it at any price. Found by the differential:
   * houndoom fireblast -> heliolisk read 123-137 on Showdown against 99-117 here, which is 1.24.
   *
   * The multiplier is READ FROM THE TAG in both routes. A defender-side 1.25 and a defender-side 0.5
   * go through one line now, so a member that multiplies cannot be silently truncated to a member
   * that halves. Membership was printed before this was wired and matched exactly one new ability
   * (dryskin); see engine/tag_dex.js.
   *
   * Water Bubble's ATTACKING x2 on Water stays a separate line below: it is a different question
   * (what do I do to others) carried by a different tag, and folding it in here would have made the
   * defensive read fire on the attacker's ability.
   *
   * ROADMAP #92 -- AND ALL THREE ROUTES HAVE LEFT THIS CHAIN, WHICH IS WHERE NONE OF THEM BELONGED.
   * `attackerStatMult` is `onSourceModifyAtk`/`onSourceModifySpA` (Thick Fat, Heatproof, Purifying
   * Salt, Water Bubble defensive) and is now folded into the ATTACK relay two hundred lines above;
   * `basePowerMult` is `onSourceBasePower` (Dry Skin) and is folded into the BASE POWER relay; Water
   * Bubble's offensive x2 is `onModifyAtk` and went with the first group. Measured at the old stage:
   * 73.1% wrong for the halving trio, 77.3% for Water Bubble, 40.0% for Dry Skin, against a 4.1%
   * control. This comment is what is left at the old site so the move is readable rather than
   * archaeological. */
  /* Expert Belt is its own tag because it is conditional on the MATCHUP, not the type. */
  const _se=TAGS.param('item',att.item,'boostsSuperEffective');
  if(_se&&eff>1)MODMUL((_se.mult||1.2));
  /* WIRE 3 of N -- resistBerry, on the DEFENDER. 6,479 holders and this calc had nothing for any of
   * them, which makes it the biggest single source of a kill that is not a kill.
   *
   * Will asked whether reading it here procs it. It does not, and the distinction matters: dmgRange
   * is a PURE read -- it never assigns to att or def -- and it is called dozens of times per turn
   * while scoring hypothetical moves. A mutation here would eat the berry during attacks that never
   * happen. The halve belongs here; the CONSUMPTION happens once, where real damage is applied.
   *
   * Chilan is the exception the tag already separates: it halves Normal with no effectiveness
   * requirement, so the condition comes from requiresSuperEffective rather than being assumed. */
  const _rb=TAGS.param('item',def.item,'resistBerry');
  if(_rb&&_rb.onType===mvT&&(!_rb.requiresSuperEffective||eff>1))MODMUL((_rb.mult||0.5));
  /* ROADMAP #92 -- SNIPER IS `onModifyDamage`, SO IT IS A MEMBER OF *THIS* CHAIN. It used to be
   * folded into the crit's plain `Math.floor(base*1.5*critMult)` in two places, which is neither the
   * right stage nor a modifier at all -- the crit is one of the two steps the authority's own source
   * labels "not a modifier". Measured 34.8% wrong at the top roll and 54.1% at the bottom. */
  if(_critHere){
    const _cdU=TAGS.param('ability',attAb,'critDamageUp');
    if(_cdU&&+_cdU.critMult)MODMUL(+_cdU.critMult);
  }
  /* ROADMAP #92 -- FRIEND GUARD (`onAnyModifyDamage`, 1,015 sheets) IS THE RIGHT STAGE AND WAS THE
   * WRONG CHAIN. The battle loop spent it as its own `md4096` on the number this function had already
   * spent `mod` on -- two spends against the authority's one, and over base damages 20..300 with a
   * Life Orb in the chain, 60 of 281 values disagree (21.4%); at d=45 the authority says 44 and this
   * engine said 43. It cannot be derived from (att, def) -- the ally is not in this function's
   * arguments -- so it arrives on `hit` and folds in here, where it belongs. */
  if(hit&&hit.allyDamageMult&&+hit.allyDamageMult!==1){MODMUL(+hit.allyDamageMult);MEDSEEN.friendGuardChain++;}
  /* THE ROLL, IN SHOWDOWN'S ORDER AND SHOWDOWN'S ARITHMETIC (WIRE 4).
   * `modifyDamage` (sim/battle-actions.ts:1724): randomizer, STAB (modify), type chart (a literal
   * x2 / tr(/2) per step and NOT a modifier), burn (modify 0.5), then the ModifyDamage chain.
   *   - the randomizer really is `tr(tr(d*(100-r))/100)`, which for integers is this floor;
   *   - `eff` stays a floor because `floor(d/4) === floor(floor(d/2)/2)` for every d, so the
   *     type chart is the one step where truncation IS the reference;
   *   - LIFE ORB IS PART OF THE SAME CHAIN, not a step after it: it is `onModifyDamage` in
   *     data/items.ts and so are the resist berries and Expert Belt. Spending them separately
   *     truncated twice where the real game truncates once. */
  const roll=r=>{
    let d=Math.floor(base*r/100);
    if(stab!==1)d=md4096(d,stab);
    d=Math.floor(d*eff);
    if(burn<1)d=md4096(d,burn);
    const _ch=lo>1?ch4096(mod,lo):mod;
    return mdChain(d,_ch);
  };
  /* WIRE 20 -- multiHit. Rock Blast was ONE 25-BP hit and Population Bomb ONE 20-BP hit, so the
   * engine priced them at a third and a seventh of what they do. 4,655 corpus clicks, led by Dual
   * Wingbeat (2,675), which is exactly HALF its real damage as a single hit.
   *
   * expectedHitsOf() already existed and was read by punishExposure alone -- the number was sitting
   * right there, computed from the artifact's own distribution string, and the damage calculation
   * never asked for it. That is the shape of most of what this file has been missing.
   *
   * AN EXPECTATION, NOT A ROLL, and that is a deliberate divergence worth stating: the real move
   * rolls 2-5 hits and this returns the mean (3.1 for the 2:35/3:35/4:15/5:15 family, 2 for the
   * fixed pairs). dmgRange is a pure min/max used for pricing, it has no rng, and every consumer
   * already treats its range as a distribution summary. The cost is that a Rock Blast which rolls
   * two hits and a Rock Blast which rolls five are the same number here.
   *
   * THIS IS WHY tests/test-mechanics.js IS THE ONLY GUARD ON IT. The differential cannot see this
   * mechanic in either direction: its harness calls moveHit ONCE, so Showdown reports a single hit
   * there, and comparing an expectation over the hit distribution against one sample of it is not a
   * comparison. tests/test-engine-diff.js now skips multi-hit moves and says so out loud. */
  /* ROADMAP #103 -- THE COUNT IS ROLLED WHEN A CALLER HAS ROLLED IT, AND ONLY AN EXPECTATION WHEN
   * NOBODY HAS. `expectedHitsOf` returns 3.1 for the whole 2-5 family, which is the right answer for
   * PRICING (a board feature, a rollout leaf, an exposure estimate) and the wrong answer for a TURN
   * that actually happened: the authority draws a count, and the roster measured us against it at
   * both pin corners. Showdown's own `|-hitcount|` reads 5 at the top corner and 2 at the bottom for
   * every member of the 2-5 family; this engine said 3.1 at both, so it was wrong by two hits in one
   * direction and by one hit in the other, on the SAME move. That is the whole of the cluster and it
   * is a COUNT defect -- with an integer count `Math.floor(v*n)` and `n*v` are the same number, so
   * the per-hit floor was never in it.
   * `hit.hits` arrives from the battle loop, which draws it through `rollHitsOf` off the same rng it
   * draws the damage index and the crit from. */
  const _hits=(hit&&+hit.hits>0)?+hit.hits:expectedHitsOf(mv&&mv.id);
  if(hit&&+hit.hits>0)MEDSEEN.multiHitRolledCount++;
  /* ROADMAP #92 -- ALL SIXTEEN ROLLS, ON REQUEST, IN THE AUTHORITY'S OWN INDEX ORDER. Index i is
   * percent 100-i (`battle.ts:2388` uses `100 - this.random(16)`), so index 0 is the top roll. This
   * exists because EVERY existing check in this repo compares the ENDPOINTS, and the endpoints are
   * where a stage error is smallest: at 100% the randomizer is the identity. The interior is where a
   * misplaced truncation shows, and nothing could see it. Filled only when a caller hands over an
   * array, so the hot path allocates nothing. */
  /* AN INTACT DISGUISE TAKES **NOTHING** FROM THE MOVE, AND THIS FUNCTION SAID 120-130.
   *
   * ROADMAP #110 / the damage differential's ONLY remaining disagreement, and it is a whole clause of
   * the MEDICHAM gate on its own: `chesnaught woodhammer -> mimikyu` reads `showdown 0-0, medicham
   * 120-130`. Showdown's `disguise.onDamage` returns false, so the MOVE deals zero; the 1/8 chip that
   * busts the disguise is applied SEPARATELY, by the ability, and does not appear in the move's own
   * damage. Both facts are visible in a real turn: Showdown loses exactly `maxhp/8`.
   *
   * THE BATTLE LOOP ALREADY HAD THIS RIGHT (WIRE 136, `:8495`) — it substitutes the chip and busts the
   * forme, and both engines land on the same HP, which is why ROADMAP #89 could call the Disguise
   * MODEL correct and be telling the truth. What nobody checked is that `dmgRange` — the calculator
   * every board feature, every rollout leaf and `punishExposure` ask — never knew. Measured with a
   * control: it returned the SAME 120-142 with Disguise and with no ability at all, which is the
   * roster's own definition of an unwired knob.
   *
   * THIS IS THE `effMoveType` / `effWeatherOf` DEFECT AGAIN (3.87.0): two readers of one fact, one
   * right and one silent, and nothing compared them because each was internally consistent. So the
   * fact is stated ONCE now, in `formeOnHitAbsorbs`, and the loop reads the same function.
   *
   * ZERO AND NOT THE CHIP, deliberately. This function answers "what does the MOVE do", which is the
   * question the authority answers with 0 and the question the differential compares. The chip is the
   * ABILITY's damage and belongs to the loop, which still applies it. A hypothetical price therefore
   * understates a click into a fresh Mimikyu by `maxhp/8` — stated here rather than hidden, and it is
   * a far smaller error than the full 120 it replaces. */
  if(formeOnHitAbsorbs(def)){
    if(hit&&Array.isArray(hit.rolls)){hit.rolls.length=0;for(let i=0;i<16;i++)hit.rolls.push(0);}
    return {min:0,max:0,eff};
  }
  if(hit&&Array.isArray(hit.rolls)){
    hit.rolls.length=0;
    for(let i=0;i<16;i++){const v=roll(100-i);hit.rolls.push(_hits>1?Math.floor(v*_hits):v);}
  }
  if(_hits>1)return {min:Math.floor(roll(85)*_hits),max:Math.floor(roll(100)*_hits),eff};
  return {min:roll(85),max:roll(100),eff};
}

/* THE FACT, IN ONE PLACE, because two implementations of it is what produced the row above.
 * Returns null when nothing absorbs, else the ability's own params and the chip it costs the holder.
 * `_disguiseBusted` is the state the loop sets; an unbuilt hypothetical body has it undefined, which
 * correctly reads as INTACT. */
function formeOnHitAbsorbs(tg){
  if(!tg||tg._disguiseBusted)return null;
  const fh=TAGS.param('ability',tg&&tg.ability,'formeOnHit');
  if(!fh||!fh.becomes)return null;
  const max=(tg.st&&tg.st.hp)||0;
  return {fh,chip:Math.floor(max/(+fh.costsMaxHPDiv||8))};
}
/* Recoil and self stat drops now ride ON THE MOVE TABLE (mv.rc = [num,den] of damage dealt,
 * mv.self = the drop in Showdown stat names), generated into data/engine-data.js from the dex by
 * build/build_engine_data.js. The RECOIL and SELFDROP name tables that lived here priced 12 and 11
 * moves respectively — the format's dex says 9 and 10, so the hand tables carried entries for moves
 * not even in the pool while staying silent on any future addition. Look it up, never restate it. */
const recoilOf=mv=>(mv&&mv.rc)?mv.rc[0]/mv.rc[1]:0;

/* ---- THE PRICING-RISK ENGINE (Will: "what is the cost/risk of clicking this move" ... "that
 * actually get priced into decisions"). Lives HERE, not in a helper module, because the scorer
 * below consumes it and exposure.js already requires this file — a copy in each place is how the
 * price and the simulation drift apart. exposure.js re-exports these for its own callers.
 *
 * Channels, unit-clean, weights deliberately NOT mixed here (board.js features + fit_policy own
 * the real weights; `total` is a default view for the rollout heuristic and UIs):
 *   selfHPFrac        fraction of own max HP (Rough Skin 1/8, burn/poison chip over the horizon)
 *   outputHalvedFrac  share of own damage output lost (burn x physical share; GUTS INVERTS — a
 *                     statused Guts body is +50%, so the channel goes NEGATIVE: seek the proc)
 *   actionsLostFrac   share of remaining actions lost (full-para 12.5%, sleep 1.667, freeze 1.3125
 *                     — the battle loop's own Champions numbers above)
 *   stagesLost        negative stat stages taken (Gooey -1 speed a touch)
 *   speedFlipsFrac    share of foes whose move ORDER flips at paralysed speed, via effSpeed;
 *                     Trick Room inverts the sign, scaled by its remaining turns vs the horizon
 * HORIZON measured, not guessed: median self-play game is 9 turns (29,256 games, 2026-07-29),
 * so a mid-game click sees ~5 more. */
const EXPOSURE_HORIZON=5;
const SLEEP_TURNS_LOST=1+2/3, FREEZE_TURNS_LOST=0.75+0.75*0.75, FULL_PARA=0.125;
function physicalShare(att){
  let p=0,n=0;
  for(const id of (att.moves||[])){const mv=MC.moves[id];if(!mv||!mv.bp)continue;n++;if(mv.c==='P')p++;}
  return n?p/n:0.5;
}
function statusCostOf(att,status,H){
  const out={selfHPFrac:0,outputHalvedFrac:0,actionsLostFrac:0};
  const guts=att.ability==='guts';
  if(guts)out.outputHalvedFrac=-0.5*physicalShare(att);       // dmgRange's own x1.5-when-statused
  if(status==='burn'){if(!guts)out.outputHalvedFrac=physicalShare(att);out.selfHPFrac=H/16;}
  else if(status==='poison')out.selfHPFrac=H/8;
  else if(status==='bad poison'){let s=0;for(let n2=1;n2<=H;n2++)s+=Math.min(15,n2)/16;out.selfHPFrac=s;}
  else if(status==='paralysis')out.actionsLostFrac=FULL_PARA; // speed half priced via flips below
  else if(status==='sleep')out.actionsLostFrac=Math.min(H,SLEEP_TURNS_LOST)/H;
  else if(status==='freeze')out.actionsLostFrac=Math.min(H,FREEZE_TURNS_LOST)/H;
  return out;
}
function speedFlipShare(att,foes,field,side,H){
  if(!foes||!foes.length)return 0;
  field=field||{terrain:'',weather:'',twA:0,twB:0,tr:0};
  const mySide=side||'A',foeSide=mySide==='A'?'B':'A';
  const para=Object.assign({},att,{status:'par'});
  const now=effSpeed(att,field,mySide),then=effSpeed(para,field,mySide);
  let flips=0,n=0;
  for(const f of foes){
    if(!f||f.fainted)continue;n++;
    const fs=effSpeed(f,field,foeSide);
    let firstNow=now>fs,firstThen=then>fs;
    if(field.tr>0){firstNow=!firstNow;firstThen=!firstThen;}
    if(firstNow&&!firstThen)flips+=1;
    else if(!firstNow&&firstThen)flips-=(field.tr>0?Math.min(field.tr,H)/H:1);
  }
  return n?flips/n:0;
}
/* WIRE 59 -- multiAccuracy, and it is applied to the HIT COUNT rather than to the accuracy, which is
 * the opposite of what the census probe used to ask for.
 *
 * Triple Axel (539 uses) and Population Bomb (387) roll accuracy on EVERY hit and stop at the first
 * miss. The tempting reading is "three 90% rolls compound to 73%, so the move is 73% accurate" -- and
 * that is wrong twice over: the move still CONNECTS 90% of the time (only the first roll decides
 * that), and the damage is proportional to how many hits landed. Modelling it as a 73%-accurate
 * three-hit move both under-counts the connections and over-counts the damage when it does connect.
 *
 * The correct expectation, given the first hit landed, is 1 + p + p^2 + ... + p^(n-1). For Triple Axel
 * at p = 0.9, n = 3 that is 2.71 rather than 3; for Population Bomb at n = 10 it is 6.51 rather than
 * 10 -- a 35% over-price this engine has been carrying since WIRE 20 gave multi-hit moves their real
 * count. Rock Blast and Dual Wingbeat do NOT carry the tag (one accuracy roll for the whole move) and
 * are untouched, which is the control the probe asserts. */
function expectedHitsOf(moveId){
  const p=TAGS.param('move',moveId,'multiHit');
  if(!p)return 1;
  /* THE FIXED COUNT IS READ, and it used to be a typed 2 for every one of them. The tag said only
   * `distribution: 'fixed'`, so Dual Wingbeat (2), Triple Axel (3) and POPULATION BOMB (10) were the
   * same number here -- Population Bomb at a fifth of its damage on 387 corpus clicks. The
   * derivation now emits `hits`; the 2 remains only as the fallback for a member the artifact cannot
   * size, which today is none. */
  let n=(p.distribution&&p.distribution.indexOf('2:35')===0)?3.1:(+p.hits||2);
  const _ma=TAGS.param('move',moveId,'multiAccuracy');
  if(_ma&&_ma.perHit&&n>1){
    /* THE ACCURACY COMES FROM THE TAG, not from moveAccuracy, and that is not a style choice: the ACC
     * table in this file is a hand-typed 35-move literal and carries NEITHER Triple Axel nor
     * Population Bomb, so moveAccuracy returns 100 for both and the discount would be exactly zero --
     * a silent default wearing the shape of a working feature. The table's own gap is FILED in
     * docs/ENGINE.md; it is the same class of hand list this file has been deleting all session. */
    const _p=(+_ma.accuracy||100)/100;
    if(_p<1){let e=0,k=1;for(let i=0;i<Math.round(n);i++){e+=k;k*=_p;}n=e;}
  }
  return n;
}
/* ROADMAP #103 -- THE COUNT A TURN ACTUALLY GETS, DRAWN, IN THE AUTHORITY'S OWN TABLE.
 *
 * `expectedHitsOf` above is a PRICE and stays one. This is the other question -- how many hits did
 * this click land -- and the engine never asked it. Every 2-5 move was 3.1 hits in a real turn, so
 * the eleven-move cluster in `data/roster.moves.json` split BOTH WAYS around the authority: 3.1 is
 * too many when Showdown rolls 2 and too few when it rolls 5. Measured directly out of Showdown's
 * `|-hitcount|` under the differential's two pin corners: Icicle Spear and Water Shuriken report
 * FIVE at the top corner and TWO at the bottom. This engine reported 3.1 at both.
 *
 * THE TABLE IS COPIED FROM `sim/battle-actions.ts:869` VERBATIM -- twenty entries, 7/7/3/3, which is
 * the 35/35/15/15 its comment states -- and it is copied rather than summarised because the PIN
 * reads an INDEX into it, not a probability. `battle.sample(items)` is `items[random(items.length)]`
 * (sim/prng.ts), so the pinned corner selects element 0 or element 19, and any table with the same
 * distribution but a different length or order would answer differently at exactly the two corners
 * every instrument in this repository measures at. `Math.floor(rnd()*20)` is the same index off this
 * engine's [0,1) scalar; the `min` guards the caller who hands back exactly 1.
 *
 * A range that is NOT [2,5] goes through the authority's other branch (`random(min, max+1)`), and
 * there is no such move in this format today -- so it is COUNTED rather than assumed, because a new
 * one arriving silently is how this file loses a mechanic. Its pinned answers differ between the two
 * engines (Showdown pins the RANGE form to its bottom in every arm, this draws uniformly), which is
 * a divergence stated here rather than discovered later.
 *
 * THE PER-HIT ACCURACY IS ROLLED AND BREAKS, exactly as `battle-actions.ts:910` does: hits 2..n each
 * roll, and the FIRST miss ends the move. That is not the same object as the expectation above --
 * 1+p+p^2 is a mean and this is a draw -- and it agrees with the authority at both corners, where
 * `randomChance(90,100)` is `0 < 90` (hit) and `99 < 90` (miss). */
const MULTIHIT_2_5=[2,2,2,2,2,2,2,3,3,3,3,3,3,3,4,4,4,5,5,5];
function rollHitsOf(moveId,rnd){
  const p=TAGS.param('move',moveId,'multiHit');
  if(!p)return 1;
  const r=p.range;
  let n;
  if(Array.isArray(r)&&r.length===2&&+r[0]!==+r[1]){
    if(+r[0]===2&&+r[1]===5){
      n=MULTIHIT_2_5[Math.min(MULTIHIT_2_5.length-1,Math.floor(rnd()*MULTIHIT_2_5.length))];
    }else{
      n=+r[0]+Math.floor(rnd()*(+r[1]-+r[0]+1));
      MEDFAILS.multiHitRangeNot2To5++;
      if(!MEDFAILS.multiHitRangeNot2To5First)MEDFAILS.multiHitRangeNot2To5First=moveId+' '+JSON.stringify(r);
    }
  }else if(+p.hits>0){n=+p.hits;}
  else{
    /* NO COUNT IN THE ARTIFACT AT ALL. One hit is the only answer that cannot invent damage, and it
     * is counted so it can never be mistaken for a move that really hits once. */
    MEDFAILS.multiHitNoCount++;
    if(!MEDFAILS.multiHitNoCountFirst)MEDFAILS.multiHitNoCountFirst=String(moveId);
    return 1;
  }
  const _ma=TAGS.param('move',moveId,'multiAccuracy');
  if(_ma&&_ma.perHit&&n>1){
    const _p=(+_ma.accuracy||100)/100;
    if(_p<1)for(let h=2;h<=n;h++){
      if(rnd()>=_p){n=h-1;MEDSEEN.multiHitAccuracyStopped++;break;}
    }
  }
  return Math.max(1,Math.floor(n));
}
function punishExposure(att,tgt,moveId,opts){
  opts=opts||{};
  if(!att||!tgt||!moveId)return null;
  const pun=TAGS.param('ability',tgt.ability,'punishesAttacker');
  if(!pun||pun.requiresForme)return null;
  const mv=MC.moves[moveId];
  if(!mv||!mv.bp)return null;
  const trig=pun.trigger==='contact'?TAGS.has('move',moveId,'contact')
           :pun.trigger==='physical'?mv.c==='P'
           :pun.trigger==='special'?mv.c==='S':true;
  if(!trig)return null;
  const H=opts.horizon||EXPOSURE_HORIZON;
  const hits=expectedHitsOf(moveId);
  const out={selfHPFrac:0,outputHalvedFrac:0,actionsLostFrac:0,stagesLost:0,speedFlipsFrac:0,parts:[]};
  let pApply=1;
  if(pun.onFaintOnly){
    const dr=dmgRange(att,tgt,mv,opts.field||{terrain:'',weather:'',twA:0,twB:0},false);
    pApply=dr.min>=tgt.curHP?1:(dr.max>=tgt.curHP?0.5:0);
    if(!pApply)return null;
  }
  if(pun.fraction){
    const f=hits*pApply/(+pun.fraction);
    out.selfHPFrac+=f;
    out.parts.push({what:'1/'+pun.fraction+' max HP per hit',p:pApply,cost:+f.toFixed(4)});
  }
  if(pun.boosts)for(const k in pun.boosts)if(pun.boosts[k]<0){
    const st=hits*pApply*-pun.boosts[k];
    out.stagesLost+=st;
    out.parts.push({what:k+' '+pun.boosts[k]+' per hit',p:pApply,cost:+st.toFixed(4)});
  }
  if(pun.inflicts)for(const inf of pun.inflicts){
    if(!canTakeStatus(att,CODE_OF_STATUS[inf.status]||inf.status))continue;
    const pProc=(1-Math.pow(1-inf.chance,hits))*pApply;
    const c=statusCostOf(att,inf.status,H);
    out.selfHPFrac+=pProc*c.selfHPFrac;
    out.outputHalvedFrac+=pProc*c.outputHalvedFrac;
    out.actionsLostFrac+=pProc*c.actionsLostFrac;
    if(inf.status==='paralysis'&&opts.foes)
      out.speedFlipsFrac+=pProc*speedFlipShare(att,opts.foes,opts.field,opts.side,H);
    out.parts.push({what:inf.status+' '+(100*inf.chance)+'%',p:+pProc.toFixed(4),
      cost:+(pProc*(c.selfHPFrac+c.outputHalvedFrac+c.actionsLostFrac)).toFixed(4)});
  }
  if(!out.parts.length)return null;
  out.total=+(out.selfHPFrac+out.outputHalvedFrac+out.actionsLostFrac
            +0.125*out.stagesLost+0.25*out.speedFlipsFrac).toFixed(4);
  return out;
}
/* CLICK FRAGILITY — Will's Solar Beam scenario as a number: "the risk of me clicking solar beam
 * but them switching in pelipper mid beam". A click's value can depend on a precondition the
 * OPPONENT can delete with a switch that resolves before moves. Three threat classes, his list
 * verbatim ("weather, type immunities, or farigaraf blocking prio"), all read from the artifact:
 *
 *   weather flip     their benched setter replaces the sky; the click is re-valued under the new
 *                    weather through the same dmgRange (Weather Ball's type, Solar Beam's half,
 *                    rain/sun on Water/Fire — all of it moves together)
 *   type immunity    the pivot absorbs the click to zero AND may gain from it (heal 1/4, +1 SpA,
 *                    +2 Def, the Flash Fire volatile) — worse than zero, and the gain says so
 *   priority block   Armor Tail-class: a positive-priority click fails outright into the pivot
 *
 * Returns worst-case retention (0..1) of the click's damage and WHO causes it. Worst-case is the
 * right default for a risk the opponent controls — the same reason a 70-acc nuke is never a
 * "guaranteed" KO here. What they WOULD click is a behavior question the ladder will answer;
 * nothing here pretends to know it. Pure read. */
function clickFragility(att,moveId,tgt,benchFoes,field){
  const mv=MC.moves[moveId];
  if(!mv||!mv.bp||!benchFoes||!benchFoes.length)return null;
  field=field||{terrain:'',weather:'',twA:0,twB:0};
  const base=dmgRange(att,tgt,mv,field,false);
  if(!base.max)return null;
  let worst={retention:1,cause:null,how:null};
  const consider=(ret,cause,how,extra)=>{if(ret<worst.retention)worst={retention:+ret.toFixed(3),cause,how,extra:extra||null};};
  for(const b of benchFoes){
    if(!b||b.fainted)continue;
    const ws=TAGS.param('ability',b.ability,'weatherSetter');
    if(ws&&ws.weather&&ws.weather!==field.weather){
      const flipped=dmgRange(att,tgt,mv,Object.assign({},field,{weather:ws.weather}),false);
      consider(flipped.max/base.max,b.name,'flips the sky to '+ws.weather);
    }
    const im=TAGS.param('ability',b.ability,'typeImmunity');
    /* ROADMAP #96 / WIRE 3 -- THE ATTACKER IS NOW PASSED, AND WIRE 126'S HOLD IS LIFTED WITH ITS
     * REASON RECORDED RATHER THAN DELETED.
     *
     * WIRE 126 left `att` off deliberately: clickFragility is one of the six exports board.js reaches
     * this engine through, it feeds the `benchRisk` feature, and moving a fitted feature owes MEASURE
     * a refit. THAT HOLD WAS HALF-EFFECTIVE AT BEST AND THE OTHER HALF WAS A CONTRADICTION INSIDE ONE
     * FUNCTION: `base` two lines above is `dmgRange(att,...)`, which already sees the -ate conversion
     * AND the private sky, so a Meganium-Mega's Weather Ball was measured at 128-151 by this
     * function's own first statement and then declared "type-immune to Normal (chart), retention 0"
     * by its third. One function, two answers, from the exact two authorities #96 exists to reconcile.
     *
     * THE COST IS DECLARED, NOT AVOIDED: `benchRisk` moves for -ate bodies and for private-weather
     * bodies, so the fitted vector is owed a refit at the next release cut. That is the normal
     * ENGINE->MAG edge (docs/DIVISIONS.md), not a new expense -- what is NOT normal is a feature
     * disagreeing with the damage number computed beside it. */
    const mvType=effMoveType(mv,moveId,field,att);  // the type the click has UNDER the current sky
    if(im&&im.type===mvType)
      consider(0,b.name,'absorbs '+mvType+' entirely',im.gain?{feedsIt:im.gain}:null);
    else if(mcEff(mvType,b.types)===0)
      consider(0,b.name,'type-immune to '+mvType+' (chart)');
    if(movePriority(moveId,field)>priorityRefusedAbove([b],field))
      consider(0,b.name,'blocks priority outright');
  }
  return {retention:worst.retention,cause:worst.cause,how:worst.how,extra:worst.extra,
    fragile:worst.retention<0.75};
}
function bestMoveVs(att,def,field){ let best=null,bs=-1e18;
  for(const id of att.moves){const mv=MC.moves[id];if(!mv||!hasPower(mv))continue;
    /* LEGALITY AT PICK TIME, not just at execution: the loop already refuses a turn-2 Fake Out,
     * but nothing stopped the bot CLICKING one -- a silent no-op turn, sampled constantly off
     * Incineroar's priors. Found by Will asking whether Fake Out was modeled at all. */
    if(id==='fakeout'&&att._turnsOut>0)continue;
    /* WIRE 131 — hitProb, not moveAccuracy: bestMoveVs has both bodies in its own signature, and the
     * bodiless call plus a hand-written attacker-only No Guard check was the bug. */
    const acc=hitProb(att,def,id,field);const d=dmgRange(att,def,mv,field,SPREAD.has(id));
    /* value = expected damage MINUS the priced cost of the click (Will: "that actually get priced
     * into decisions"). The old line multiplied recoil moves by a flat 0.85 — a fudge that charged
     * Brave Bird and Head Smash identically and charged Rough Skin nothing. Both costs are now in
     * HP on the same scale as the damage: recoil as the dex fraction of what lands, the punisher
     * price as its exposure total times own max HP (the 1-own-HP = 1-enemy-HP exchange is this
     * heuristic's one modeling choice — the fitted policy learns its own weights instead). */
    const exp=((d.min+d.max)/2)*acc;
    const x=punishExposure(att,def,id,{field});
    const sc=exp-recoilOf(mv)*exp-(x?x.total*att.st.hp*acc:0);
    if(sc>bs){bs=sc;best={id,mv,spread:SPREAD.has(id),d,acc,cost:x?+(x.total*att.st.hp).toFixed(1):0};}}
  return best;
}
// pick the best target (max damage) for a SPECIFIC move
/* ROADMAP #81 WIRE 9 -- WHO IS THIS BODY FIGHTING, ASKED FROM A BODY ALONE.
 *
 * `playerAction` is handed one Pokemon, one move id, one target and a field. When the target is null
 * because the move HAS no target -- which is the whole of the spread family -- it has to reach the
 * board to price the click at all. Every body already carries `_sf`, the per-side object battleInit
 * stamps by reference (the death counter, the party, the named side conditions); the battle state is
 * put on that same object rather than on the mon, so there is ONE new reference and it lives where
 * every other shared side fact already lives.
 *
 * IT RETURNS AN EMPTY LIST RATHER THAN THROWING, and the caller COUNTS the empty case. A body built
 * by a probe or by the browser page and never passed through battleInit has no board, and that is a
 * legitimate state -- what is not legitimate is treating it as "no foes are alive". */
/* ROADMAP #84 -- ONE WRITER FOR "THIS MOVE FAILED", AND IT IS NOT THE TRACE.
 *
 * Twenty-one sites in the turn loop announce a failed move, and every one of them was written
 * `if(TR)TR.fail(m)` -- so on a run with no trace attached (which is every rollout, every self-play
 * game and every probe that does not ask for one) the failure was not merely unannounced, it was not
 * KNOWN. Stomping Tantrum's base power is a fact about what happened last turn, so recording it
 * inside the announcement would have made the mechanic depend on whether anybody was watching, which
 * is the shape docs/LESSONS.md calls a capability that cannot prove it ran.
 *
 * TR is module-level and may be null; the state write is not conditional and the announcement is. */
function mvFail(mon){ if(mon)mon._mvRes=false; if(TR)TR.fail(mon); }
function liveFoesOf(me){
  const _s=me&&me._sf, _S=_s&&_s._S;
  if(!_S)return [];
  const _f=_s.side==='A'?_S.actB:_S.actA;
  return (_f||[]).filter(x=>x&&!x.fainted&&x.curHP>0);
}
function targetForMove(me,id,live,field){ const mv=MC.moves[id]; if(!mv||!hasPower(mv))return null;
  if(id==='fakeout'&&me._turnsOut>0)return null;   // same pick-time legality as bestMoveVs
  let bt=null,bs=-1; for(const f of live){const d=dmgRange(me,f,mv,field,SPREAD.has(id));const sc=(d.min>=f.curHP?1e6:0)+d.max;if(sc>bs){bs=sc;bt={id,mv,spread:SPREAD.has(id),d,target:f};}}
  return bt; }
// MEDICHAM policy = behaviour cloning: sample what a real ladder player would click, but always
// take an obvious KO, and Protect defensively when threatened. This is the whole point of the model —
// the win rate is the expected outcome under *realistic* play by both sides, not optimal play.
/* POLICY SWITCH. `PURE_PRIORS` disables the three damage-dependent heuristics below, leaving only the
 * behaviour-clone prior sampling. It exists so this engine can be compared LIKE FOR LIKE against the
 * official simulator: the Showdown player (engine/prior_player.js) can sample priors but cannot run
 * the KO / Protect / Wide Guard heuristics, because the request object carries no damage numbers.
 * With this flag set, both sides are pure prior samplers, and any remaining difference in win rate is
 * attributable to the RULES rather than to how well each side plays. Off by default - normal rollouts
 * keep the heuristics, which is what makes them resemble real play. */
let PURE_PRIORS = false;
function setPurePriors(v){ PURE_PRIORS = !!v; }

/* DISABLE IS THE OTHER HALF OF sealsMoves, and it is the exact opposite of the Choice lock: the lock
 * says "only this move", Disable says "any move but this one". It is applied by taking the sealed move
 * out of `me.moves` for the duration of ONE decision and putting it back, because every reader inside
 * the chooser -- bestMoveVs, the priors sampler, the Protect check -- enumerates `me.moves`, and
 * filtering in one of them would be the half-wire this file keeps getting bitten by.
 *
 * IT WAS NOT MERELY UNIMPLEMENTED, IT WAS FALSELY PASSING. `tests/test-mechanics.js` reported the
 * Disable probe LIVE because the freed chooser happened to pick a different move; with the Disable
 * click removed it picked the same different move. Identical results across the knob mean the knob is
 * unwired. The probe now prints both arms.
 *
 * NEVER LEAVES A MON WITH NOTHING: a single-move body keeps its move rather than being pushed into
 * Struggle, which is the real rule and also stops a Disable on a one-move rollout body deleting it. */
/* WIRES 45 AND 44 RIDE THE SAME FILTER, and that is the point of putting it here rather than beside
 * the Disable line: "which of my moves are illegal this turn" is ONE question, and Throat Chop's
 * silence and Gigaton Hammer's lockout are two more answers to it. Three separate filters would be
 * three chances for the priors sampler -- which picks by NAME and never consults me.moves -- to leak
 * one of them, which is exactly the bug WIRE 26 found on Disable.
 *
 * NEVER LEAVES A MON WITH NOTHING: if every move is illegal the filter is abandoned whole, the same
 * rule the Disable version already carried. */
/* WIRE 119 RIDES IT TOO -- TAUNT IS "WHICH OF MY MOVES ARE ILLEGAL THIS TURN" WITH A CATEGORY
 * INSTEAD OF A NAME, which is why it belongs in this filter and not in a branch of its own. Hoisted
 * to module scope for one reason: the PRIORS SAMPLER picks a move by NAME out of MC.priors and never
 * consults `me.moves`, so it needs to ask the identical question. It had a hand-copied Disable clause
 * and nothing else -- exactly the three-copies shape the comment above warns about -- and that clause
 * is now this call, so Throat Chop's silence and the Gigaton Hammer lockout stop leaking through the
 * single most-used path in the chooser as well. */
function illegalMoveNow(me,id){
  if(!me||!id) return false;
  if(me._vol&&me._vol.disable>0&&me._sealed===id)return true;
  if(me._noSound>0&&TAGS.has('move',id,'sound'))return true;
  if(me._noRepeat===id)return true;
  if(volatileForbidsMove(me,id)){ MEDSEEN.tauntRefusedAtSelection++; return true; }
  return false;
}
function chooseAction(me,foes,ally,field,side,rng){
  const _illegal=id=>illegalMoveNow(me,id);
  if(me&&me.moves&&me.moves.length>1&&me.moves.some(_illegal)){
    const _save=me.moves;
    const _keep=_save.filter(id=>!_illegal(id));
    if(_keep.length){
      me.moves=_keep;
      try{ return _chooseAction(me,foes,ally,field,side,rng); }
      finally{ me.moves=_save; }
    }
  }
  return _chooseAction(me,foes,ally,field,side,rng);
}
function _chooseAction(me,foes,ally,field,side,rng){
  // asleep? still pick a move — the turn loop applies Champions wake rules (33% turn 2, 100% turn 3)
  const live=foes.filter(f=>f&&!f.fainted&&f.curHP>0); if(!live.length)return{kind:'struggle'};
  /* WIRE 18 -- choiceLock. A Scarf holder (4,159 sheets) clicked a move and is LOCKED into it:
   * no priors sampling, no heuristics, no re-aiming to a status move -- the one move, best legal
   * target, exactly the constraint the item's tag declares. Freed only by leaving the field,
   * which in this rollout means fainting. Scarf mons re-picked freely every turn before this,
   * which quietly overstated every Scarf team the bot ever simulated. */
  /* ENCORE AND TAUNT ACTUALLY CONSTRAIN THE CHOICE, rather than being recorded and ignored.
   *
   * Recording a volatile and then choosing freely is the shape that made Encore LOOK modelled for a
   * whole session: playerAction returned a kind that was not 'pass', the probe accepted it, and the
   * target went on picking whatever it liked. A constraint that nothing reads is not a constraint.
   *
   * Encore repeats the last move. Taunt forbids status moves, so the mon falls through to the normal
   * chooser with its status options removed rather than being handed a specific click. Both decrement
   * and expire, because a lock that never ends is its own bug.
   *
   * WIRE 119 -- AND THAT SENTENCE WAS FALSE FOR TAUNT UNTIL 2026-08-06. What stood here was
   * `if(me._vol.taunt>0)me._vol.taunt--;` and nothing else: no option was ever removed. The filter
   * is now `illegalMoveNow`, which runs above this function on every path into it, and the TICK has
   * moved to end-of-turn beside Disable's -- for Disable's own stated reason, that a duration which
   * only counts down on turns the engine happens to be CHOOSING lasts forever in a rollout driven
   * from outside (the WIRE 24 rule). */
  if(me._vol){
    if(me._vol.encore>0){
      /* ROADMAP #111 -- THE DECREMENT THAT USED TO BE ON THIS LINE IS GONE, and that is the whole
       * Encore row. It was the SECOND decrement site for one volatile: the counter fell here, during
       * action SELECTION, and Encore is the only member of the duration family that was not also
       * ticked at end of turn. Both halves were wrong in opposite directions -- a rollout driven from
       * outside (a scripted turn, a caller-supplied action) never reaches this function, so the clock
       * never moved at all and the lock was permanent; and when it DID reach it, the counter fell at
       * the wrong moment relative to the residual. `data/roster.moves.json` saw only the first half
       * (`vol.encore` showdown 2/1, ours 3/3 across two boundaries) because its turns are scripted.
       * The tick now lives at end of turn with Taunt's and Disable's, for the reason Disable's own
       * comment there gives: a duration that only counts down when the engine happens to be the one
       * choosing is a duration that lasts forever. */
      const _mv=me._encoreMove;
      if(_mv&&MC.moves[_mv]){
        const _t=live[Math.floor(rng()*live.length)%live.length];
        /* Falling through means the Encore is silently NOT honoured this turn — a real behaviour
         * change dressed as a no-op, so it counts itself rather than vanishing. */
        try{const _a=playerAction(me,_mv,_t,field); if(_a&&_a.kind!=='pass')return _a;}catch(e){ MEDFAILS.encoreAction++; }
      }
    }
  }
  if(me._lock){
    const chosen=targetForMove(me,me._lock,live,field);
    if(chosen)return{kind:'attack',move:chosen,target:chosen.target};
    return{kind:'struggle'};
  }
  // strongest option + is a KO available?
  let bestAtk=null,bestKO=-1,tgt=null;
  /* WIRE 131 — hitProb against the FOE BEING SCANNED, not moveAccuracy against nobody. The old line
   * priced a Sand Veil / Bright Powder / Minimize body exactly like a bare one. */
  for(const f of live){const b=bestMoveVs(me,f,field);if(!b)continue;const acc=hitProb(me,f,b.id,field);const ko=(b.d.min>=f.curHP?1:(b.d.max>=f.curHP?0.5:0))*acc;const sc=ko*1e4+b.d.max*acc;if(sc>bestKO){bestKO=sc;bestAtk=b;tgt=f;}}
  // a KO is only "guaranteed" if the move is accurate too — no relying on a 70% nuke
  /* WIRE 131 — hitChance>=100 covers the never-miss case (it returns Infinity) AND the evasion case
   * the old moveAccuracy read could not see, so the attacker-only No Guard clause is gone. */
  const bestKOsNow=bestAtk&&tgt&&bestAtk.d.min>=tgt.curHP&&hitChance(me,tgt,bestAtk.id,field,{})>=100;
  const incoming=live.reduce((mx,f)=>{const b=bestMoveVs(f,me,field);return b?Math.max(mx,b.d.max):mx;},0);
  const inDanger=incoming>=me.curHP*0.8;
  const canProtect=me.moves.some(id=>PROTECTMOVES.has(id));
  if(!PURE_PRIORS){
    // 1) take a guaranteed KO most of the time (real players do)
    if(bestKOsNow&&rng()<0.85) return {kind:'attack',move:bestAtk,target:tgt};
    // 2) Protect when threatened and can't KO back
    if(inDanger&&!bestKOsNow&&canProtect&&!me.protect&&me.tookProtectTurns<2&&rng()<0.5) return {kind:'protect'};
    // 3) Wide Guard against a spread threat
    if(me.moves.includes('wideguard')&&live.length>1&&me.tookProtectTurns<2&&!me.protect&&rng()<0.35){const foeSpread=live.some(fo=>(fo.moves||[]).some(id=>SPREAD.has(id)));if(foeSpread)return{kind:'wideguard'};}
  }
  // behaviour clone: sample the move this species actually clicks, at its real frequency
  const pr=MC.priors[me.name];
  if(pr){ let r=rng(),pick=null; for(const q of pr){r-=q[1];if(r<=0){pick={mv:q[0],kind:q[2]};break;}}
    /* DISABLE BINDS THE PRIORS SAMPLER TOO, and this is the exit that made a filtered move list look
     * like a working seal. The sampler picks a move by NAME out of MC.priors and never consults
     * `me.moves`, so taking the sealed move out of the list left the single most-used path in this
     * function untouched. Caught by the probe printing BOTH arms: control and disabled arm each
     * clicked Dragon Claw. A banned pick falls through to the best attack over the filtered list.
     * WIRE 119 -- AND SO DOES TAUNT, through the SAME call the move-list filter uses. The hand-copied
     * Disable clause that stood here is gone: a second copy of "which moves are illegal" is how a
     * fourth constraint gets added to one of them and not the other, which is what happened to Throat
     * Chop and Gigaton Hammer, both of which were filtered out of `me.moves` and then sampled straight
     * back in by name. */
    if(pick&&illegalMoveNow(me,pick.mv))pick=null;
    if(pick){
      if(pick.kind==='protect'&&!me.protect&&me.tookProtectTurns<2)return{kind:'protect'};
      if(pick.kind==='setup'&&!inDanger&&(me.boosts.at+me.boosts.sa+me.boosts.sp)<4)return{kind:'setup',mv:pick.mv};
      /* WIRE 119 -- ASK ABOUT THE ACTION THIS BRANCH PRODUCES, NOT ABOUT THE MOVE THAT WAS SAMPLED.
       * The `speed` prior is a coarse INTENT label and this branch converts it into a Tailwind
       * whatever move carried it: Milotic's priors label ICY WIND as `speed`, so a sampled Icy Wind
       * came out of here as `{kind:'tail'}`. Under a Taunt that mattered -- Icy Wind is a Special move
       * and is legal, a Tailwind is not -- and the gate five lines up, which asks about `pick.mv`,
       * correctly let Icy Wind through. Refusing the produced action instead makes the body fall
       * through to the attack below, which is the click the reference engine makes.
       * (That the label converts a damaging move into Tailwind at all is a SEPARATE pre-existing
       * defect in the priors mapping, filed rather than fixed here.) */
      if(pick.kind==='speed'&&((side==='A'?field.twA:field.twB)<=0)&&!illegalMoveNow(me,'tailwind'))return{kind:'tail'};
      // carry the MOVE through, not just the intent: which status lands depends on which move it is
      if(pick.kind==='status'&&live.some(f=>!f.status))return{kind:'status',mv:pick.mv,target:live.find(f=>!f.status)};
      const chosen=targetForMove(me,pick.mv,live,field);            // the sampled damaging move
      if(chosen)return{kind:'attack',move:chosen,target:chosen.target};
    }}
  // 4) fallback: best available attack
  if(bestAtk)return{kind:'attack',move:bestAtk,target:tgt};
  return{kind:'struggle'};
}
function effSpeed(m,field,side){
  /* WIRE 83 -- THE SIDE MAY BE OMITTED, and then it is READ off the body rather than assumed. Gyro
     Ball and Electro Ball are base-power-from-a-speed-RATIO, computed inside dmgRange, which is
     handed two bodies and a field and no side; the alternative was a second speed function, and two
     implementations of "how fast is this" is precisely the FACTS-ARE-GLOBAL failure CLAUDE.md names.
     A body with no side stamp (a bare unit-test call) is COUNTED, not silently given no Tailwind. */
  if(side===undefined){
    side=(m&&m._sf&&m._sf.side)||null;
    if(!side){MEDFAILS.speedSideUnknown++;side='';}
  }
  /* WIRE 91 -- the item speed multiplier is the artifact's (`speedMult`, Choice Scarf x1.5), not a
   * name. The only carrier in the format is the Scarf, so behaviour is identical today; what changes
   * is that a future speed item arrives without an edit here. */
  let s=m.st.sp*boostMul(m.boosts.sp);
  {const _sm=TAGS.param('item',m.item,'speedMult');if(_sm&&_sm.mult)s*=+_sm.mult;}
  /* UNBURDEN. Speed doubles once the item is GONE, from the speedOnItemLoss param -- which was
   * itself wrong until today: it matched any onTakeItem and so included STICKY HOLD, whose handler
   * exists to refuse the loss. Reading that would have doubled the Speed of an ability that does
   * the opposite. */
  if(m._hadItem&&!m.item){const _ub=TAGS.param('ability',m.ability,'speedOnItemLoss');if(_ub&&_ub.speedMult)s*=_ub.speedMult;}
if((side==='A'?field.twA:field.twB)>0)s*=2;
  /* WIRE 78 — a suppressed sky does not haste anybody. effSpeed sees ONE body, so it reads the
     field's own answer (set by battleTurn over all four actives) as well as this body's ability. */
  {const _w=(field&&field.wSup)||suppressesWeather(m)?'':(field&&field.weather);
   /* WIRE 91 -- the weather-speed abilities read `speedCond` (which weather, what multiplier) off
    * the artifact instead of four name literals. A carrier whose condition is NOT in its params
    * (`inWeather: []` -- Quick Feet's status, Surge Surfer's terrain, Slow Start's clock) is REFUSED
    * and counted: applying the bare multiplier would be Quick Feet x1.5 forever, the
    * boolean-in-a-fraction's-clothing defect. Enrichment staged in tag_dex. Both spellings go
    * through weatherId so 'hail' and 'heavy rain' land on the engine's words. */
   const _scp=TAGS.param('ability',m.ability,'speedCond');
   if(_scp&&_scp.speedMult){
     if(Array.isArray(_scp.inWeather)&&_scp.inWeather.length){
       if(_w&&_scp.inWeather.some(x=>weatherId(x)===_w||x===_w))s*=+_scp.speedMult;
     }else{
       MEDFAILS.speedCondUnconditional++;
       if(!MEDFAILS.speedCondUnconditionalFirst)MEDFAILS.speedCondUnconditionalFirst=m.ability;
     }
   }}
  if(m.status==='par')s*=0.5;return s;}

/* ===== WHO MOVES FIRST — ONE IMPLEMENTATION, AND EVERY ENGINE CALLS IT ==========================
 *
 * WIRE 118. There were TWO answers to this question and they had measurably diverged.
 *   - HERE: `acts` was sorted once, at the top of the turn, and then walked as a frozen list. This
 *     engine had NO dynamic speed at all.
 *   - board.js:2791 wrote its own `(slowFirst ? mySpe < thSpe : mySpe > thSpe)` — the Trick Room
 *     inversion and the speed comparison, restated by hand, twelve lines below a call it already
 *     makes into this file (`D2.priorityRefusedAbove`). MAG's `speedSwing` and
 *     `speedSetupHelpsPartner` therefore believe a Tailwind speeds the partner up THIS turn
 *     (board.js:466 says so in words, and is right), while the rollout the search actually believes
 *     said it did nothing. Tailwind is the dominant strategy in this format.
 * Two implementations of a FACT is the failure CLAUDE.md names. board.js's copy is deleted; it calls
 * compareTurnOrder below. Its EXPECTED-speed wrapper stays, because the opponent's spread is hidden
 * and expected-speed-across-a-distribution is a legitimately different question from this engine's
 * exact speed for a built body — what must not be duplicated is the ORDERING RULE underneath.
 *
 * THE RULE IS SHOWDOWN'S OWN, in Showdown's own words at the pinned commit
 * (sim/battle-queue.ts, file header):
 *     "Actions are sorted based on order (lower first) followed by priority (higher first)
 *      followed by speed (higher first). Ties are broken with Fischer-Yates."
 * and the re-sort is sim/battle.ts, gated on gen >= 8 and run after every action:
 *     "In gen 8, speed is updated dynamically so update the queue's speed properties and sort it."
 *         this.updateSpeed(); ...getActionSpeed(queueAction)...; this.queue.sort();
 * It re-derives the SPEED only. `order` and `priority` are resolved once when the action is queued,
 * which is why `_pri` is frozen at the top of the turn below rather than recomputed on each re-sort —
 * a Grassy Terrain set halfway through the turn does not retroactively give Grassy Glide priority.
 *
 * `order` is the field After You and Quash write in Showdown's own data (`action.order = 3` for
 * next, `= 201` for last, against 200 for a plain move action). It is what makes those two survive a
 * re-sort; splicing the array did not, and under a dynamic order it silently would not have.
 *
 * MEASURED, not remembered, against the official engine at the pinned commit — L50 / 0 EV / 31 IV /
 * Serious, Whimsicott 136, Garchomp 122, Milotic 101, Incineroar 80 (160 under Tailwind):
 *     control : Whimsicott -> Garchomp -> Milotic -> Incineroar
 *     tailwind: Whimsicott -> Incineroar -> Garchomp -> Milotic
 * Incineroar overtakes INSIDE the turn. Pinned by the `doublesSideSpeed` probe
 * "Tailwind speeds the PARTNER up inside the same turn", which was shown RED on the frozen list
 * (115 damage taken in both arms — identical arms across a varied knob).
 */
const TURN_ORDER = { move: 200, next: 3, last: 201 };
/* The bracket, lifted out of battleTurn so the comparator is one module-level function rather than a
 * closure nothing outside the turn could reach. Behaviour is unchanged from the closure it replaces. */
function actionPriority(it, field){
  const k=it.a.kind;
  /* WIRE 93 -- `priorityMod` read by SHAPE. Prankster was the hardcoded name here; Gale Wings
     (765 uses) carried the same tag and had no consumer at all, so a full-HP Talonflame's Brave
     Bird went in speed order. `movesOfClass` is the tag's own discriminator: 'status' shifts the
     status kinds below, a TYPE name shifts attacks of that type. The one `condition` string in
     the artifact ('only at full HP') is evaluated; any OTHER condition fails closed and is
     counted, because silently applying a conditional shift points a wrong number in an unknown
     direction. */
  const _pmOf=(mon,cls,isAtk,moveId)=>{
    const _pm=TAGS.param('ability',mon.ability,'priorityMod');
    if(!_pm||!_pm.shift)return 0;
    if(_pm.condition){
      if(/full hp/i.test(String(_pm.condition))){ if(mon.curHP<mon.st.hp)return 0; }
      else{
        MEDFAILS.priorityModUnknownCond++;
        if(!MEDFAILS.priorityModUnknownCondFirst)MEDFAILS.priorityModUnknownCondFirst=mon.ability+':'+_pm.condition;
        return 0;
      }
    }
    if(_pm.movesOfClass==='status')return isAtk?0:+_pm.shift;
    if(isAtk&&moveId){const _mvR=MC.moves[moveId];
      if(_mvR&&String(_mvR.t||'').toLowerCase()===String(_pm.movesOfClass||'').toLowerCase())return +_pm.shift;}
    return 0;
  };
  /* THE BRACKET IS THE SELECTED MOVE'S, and `_selMv` carries it when a lock overrode the choice.
   * `sim/battle-actions.js` reads `baseMove.priority` and `baseMove.pranksterBoosted` one line BEFORE
   * it runs OverrideAction, so an Encored body keeps the bracket of what its player picked and
   * executes what Encore forces. `_pmOf` is handed the same id for the identical reason — Prankster
   * and Gale Wings are captured on that same pre-override line. Absent `_selMv` (every unlocked
   * action) this is exactly what it always was. */
  if(k==='attack'){ const _pmv=it._selMv||it.a.move.id;
                    return movePriority(_pmv, field)+_pmOf(it.mon,null,true,_pmv); }
  /* PRANKSTER, +1 TO ANY STATUS CLICK (now via the tag above). Every kind below is a status
     move; only 'attack' is not, and it returns above. The Dark-type immunity stays in
     pranksterBlocked -- that half is Prankster-specific in the real engine too. */
  const pk=_pmOf(it.mon,null,false,null);
  /* A VOLUNTARY SWITCH RESOLVES BEFORE ANY MOVE. Not a priority bracket in the real game -- it
     is a separate phase that happens first (Showdown expresses it as `order` 103, below a move's
     200) -- but this engine orders everything through one comparator, so it sits above Protect's
     +4. That ordering is the whole reason switching out of a predicted attack works, and getting
     it wrong would make every switch eat the hit it was meant to dodge. Prankster does not touch
     it. Left in the PRIORITY key rather than moved to `order`, because no move in this format
     reaches +6 and re-expressing it would be a behaviour change smuggled into a refactor. */
  /* WIRE 120 -- A PIVOT MOVE IS A MOVE, AND IT WAS JUMPING THE QUEUE AT +6. `kind:'switch'` serves
     two completely different actions in this engine: a BARE switch, which really is a separate phase
     that happens first, and a pivot MOVE (`a.mv` present -- Parting Shot at 7,475 corpus clicks and
     Chilly Reception at 27), which is an ordinary status move that switches the user out AFTER it
     resolves. Giving both +6 made Parting Shot the fastest action in the game: it dodged every hit
     aimed at its user, it out-sped the Taunt and the Throat Chop that are supposed to stop it, and
     the replacement -- not the pivot user -- ate the attack.
     MEASURED AT THE PINNED COMMIT, both arms printed before this line changed: Milotic (101) Scalds
     an Incineroar (80) that clicked Parting Shot, and the Scald lands FIRST -- `|move|p2a: Milotic|
     Scald` then `|-damage|p1a: Incineroar|54/170` then `|move|p1a: Incineroar|Parting Shot`. Against
     a Knock Off control the damage is identical, which is the point: the pivot changes nothing about
     when the user is hit. medicham2 had the user take 0 and the replacement take 54.
     This is the #1 disagreement by pair volume in data/interaction-matrix.json
     (`partingshot -> throatchop`, 7475 x 2946) and the cause of `partingshot -> taunt` (7475 x 1503)
     too -- both read as a species mismatch in slot 0 because medicham2 had already pivoted. */
  if(k==='switch')    return it.a.mv?movePriority(it.a.mv,field)+pk:6;
  if(k==='protect')   return 4+pk;
  if(k==='wideguard') return 3+pk;
  /* Read from each move's own data, which is what makes Trick Room -7 and Rage Powder +2 without
     either being written here. ROADMAP #81 WIRE 6: `tail` and `trickroom` DO carry an mv now, so the
     general line below already answers for them -- these two rows are the backstop for a bare action
     a caller hand-built, exactly like KIND_MOVE. Kept rather than deleted because chooseAction still
     emits `{kind:'tail'}` with no id and Trick Room's -7 is the one bracket in this format where
     getting it wrong inverts the whole turn. */
  if(k==='tail')      return movePriority('tailwind', field)+pk;
  if(k==='trickroom') return movePriority('trickroom', field)+pk;
  return movePriority(it.a.mv, field)+pk;
}
/* The sort key for one queued action. `_pri` frozen at turn start, `_qc` rolled once per turn
 * (WIRE 101), `_order` written only by After You / Quash, `_tie` rolled once on first demand. SPEED
 * is the one field re-read on every re-sort, which is exactly what makes the order dynamic. */
function turnOrderKey(it, field){
  return { order: it._order==null?TURN_ORDER.move:it._order,
           pri:   it._pri==null?actionPriority(it,field):it._pri,
           qc:    it._qc||0,
           spe:   effSpeed(it.mon,field,it.side),
           tie:   it._tie==null?0:it._tie };
}
/* THE ORDERING RULE ITSELF. Pure, deterministic, consumes no RNG, and takes plain keys rather than
 * bodies — which is what lets board.js ask it about an EXPECTED speed it computed from a hidden
 * spread. Negative means `a` resolves first. Every field defaults, so a caller that knows only the
 * two speeds passes only the two speeds; a genuine tie returns 0 and the caller decides what that
 * means (board.js reads 0 as "not first", which is what its hand-rolled `>` did). */
function compareTurnOrder(a, b, field){
  const A=a||{}, B=b||{};
  const oa=A.order==null?TURN_ORDER.move:A.order, ob=B.order==null?TURN_ORDER.move:B.order;
  if(oa!==ob)return oa-ob;                                   // order: LOWER first
  const dp=(B.pri||0)-(A.pri||0); if(dp)return dp;            // priority: HIGHER first
  const dq=(B.qc||0)-(A.qc||0);   if(dq)return dq;            // Quick Claw, inside the bracket
  let sp=(B.spe||0)-(A.spe||0);                               // speed: HIGHER first
  if(field&&field.tr>0)sp=-sp;                                // Trick Room inverts the SPEED key only
  if(sp)return sp;
  return (B.tie||0)-(A.tie||0);
}
/* Sorts a live action list into resolution order, in place. Called at the top of the turn and again
 * before every remaining action.
 *
 * THE TIE IS ROLLED ONCE PER ACTION, ON FIRST DEMAND, AND STORED — the same shape as `_qc`. The old
 * comparator ended `sp||(rng()<0.5?-1:1)`, a coin flipped INSIDE the sort: re-sorting each iteration
 * would re-draw it, the RNG stream would diverge, and every seeded run in the repo would change for
 * reasons that have nothing to do with speed. Rolling lazily also means a turn with no speed tie
 * draws exactly as many numbers as it did before this wire, so the existing seeded probes are
 * untouched rather than merely "close". */
/* WIRE 134 -- THE TIE. THIS ENGINE AND THE AUTHORITY HAVE DISAGREED ABOUT EVERY SPEED TIE FOR THE
 * LIFE OF THE PROJECT, AND THE CAUSE IS THE SORT ALGORITHM RATHER THAN THE COMPARATOR.
 *
 * Measured on a staged pure tie (Volcarona vs Charizard, both 100 base Speed, 120 exactly on both
 * sides, both clicking a damaging move) under the differential's own primary pin:
 *
 *     Showdown    |move|p2a: Charizard ...   then  |move|p1a: Volcarona
 *     medicham2   |move|p1a: Volcarona  ...   then  |move|p2a: Charizard
 *
 * The comparator was never the problem. `Array.prototype.sort` is STABLE, so a comparator returning
 * 0 leaves the two in input order; `Battle#speedSort` (sim/battle.ts:429) is a SELECTION SORT whose
 * swaps move untied elements around, and the tied group's order when the shuffle finally sees it is
 * therefore NOT the input order. In the trace above the two Protects resolve first, and the swap that
 * lifted the faster Protect to the front is what put Volcarona BEHIND Charizard before either of them
 * was compared. A stable sort cannot produce that permutation from any comparator.
 *
 * SO THE ALGORITHM IS REPRODUCED LINE FOR LINE, and only then is the residual tie resolved.
 *
 * WHAT THE TIE RESOLVER MUST BE, AND WHY THE OBVIOUS FIX IS WRONG. "Take the later body" is what the
 * authority PRODUCES UNDER THIS HARNESS'S PIN -- the pin replaces `PRNG.shuffle` with a no-op -- and
 * it is NOT the game's rule. In a real battle `speedSort` ends with `prng.shuffle(list, sorted,
 * sorted + nextIndexes.length)`, a Fisher-Yates over the tied group: a speed tie is a COIN FLIP.
 * Hardcoding the pinned answer would make this engine match the differential and be wrong in every
 * rollout and every live game -- the fitting-environment-versus-playing-environment error, arriving
 * green.
 *
 * THE KEY-PER-ACTION SHUFFLE IS KEPT, because it is already the right device and it is the one that
 * makes both pins land together. Each action draws one uniform on first demand; the tied group is
 * ordered by that key. Sorting k items by iid uniform keys IS a uniform random permutation, so under
 * real dice this is exactly the coin flip the authority rolls. Under a CONSTANT pinned die every key
 * is equal, the group keeps the order the selection sort handed it, and that is precisely what
 * Showdown's neutralised shuffle does -- so the two engines land on the same body under identical
 * pinned dice without either of them being told the answer.
 *
 * THE COMPARATOR IS ASKED WITH THE TIE FIELD ZEROED, deliberately. `_tie` is drawn lazily and this
 * function runs again before every action, so a key carrying an already-drawn `_tie` would make a
 * genuine tie compare NON-zero on the second pass -- the group would never be recognised, and the
 * whole mechanism would silently degrade to the stable sort it replaces. */
function sortTurnOrder(acts, field, rng){
  /* Keys built once per ACTION, not once per comparison: effSpeed is not free and this now runs
   * before every action instead of once a turn. */
  const K=new Map(); for(const it of acts){const k=turnOrderKey(it,field);k.tie=0;K.set(it,k);}
  const tie=it=>{ if(it._tie==null)it._tie=rng?rng():0; return it._tie; };
  const list=acts;
  let sorted=0;
  while(sorted+1<list.length){
    let next=[sorted];
    for(let i=sorted+1;i<list.length;i++){
      const d=compareTurnOrder(K.get(list[next[0]]),K.get(list[i]),field);
      if(d<0)continue;
      if(d>0)next=[i]; else next.push(i);
    }
    /* `next` is ascending by construction, so an earlier swap can never disturb a later one -- the
     * authority's own comment, and it is load-bearing rather than decorative. */
    for(let i=0;i<next.length;i++){
      const idx=next[i];
      if(idx!==sorted+i){const t=list[sorted+i];list[sorted+i]=list[idx];list[idx]=t;}
    }
    if(next.length>1){
      const grp=list.slice(sorted,sorted+next.length);
      grp.sort((x,y)=>tie(y)-tie(x));
      for(let i=0;i<grp.length;i++)list[sorted+i]=grp[i];
      MEDSEEN.speedTieResolved++;
      if(next.length>MEDSEEN.speedTieLargestGroup)MEDSEEN.speedTieLargestGroup=next.length;
    }
    sorted+=next.length;
  }
  return acts;
}

/* ---- SECONDARY AND PRIMARY MOVE EFFECTS -------------------------------------------------------
 * Read from the SHARED rulebook (CHOMP/data/move-effects.json, exposed here as window.MOVE_EFFECTS
 * by build/build_browser_data.js). Before this, the rollout had its own rules and they were wrong:
 *   - a status move applied a UNIFORMLY RANDOM status from ['brn','par','slp'], so Thunder Wave
 *     burned a third of the time and Will-O-Wisp could paralyse;
 *   - only Fake Out could ever flinch, so Rock Slide's 30% did nothing.
 * Reading the one rulebook is what lets the contract test hold this engine and champ-model together.
 */
let _FX=null;
function moveFxTable(){
  if(_FX) return _FX;
  _FX=(typeof window!=='undefined'&&window.MOVE_EFFECTS)||
      (typeof globalThis!=='undefined'&&globalThis.MOVE_EFFECTS)||null;
  /* In node the site's script tags do not exist, so load the generated file on first use. Without
   * this a node consumer silently gets NO secondary effects - the exact failure mode this change is
   * fixing - so it must load rather than degrade quietly. */
  if(!_FX&&typeof require!=='undefined'){
    try{ require('path'); require(require('path').join(__dirname,'..','data','move-effects.js'));
         _FX=(typeof globalThis!=='undefined'&&globalThis.MOVE_EFFECTS)||null; }catch(e){}
  }
  if(!_FX) throw new Error('MOVE_EFFECTS not loaded: include data/move-effects.js (generated by build/build_browser_data.js)');
  return _FX;
}
function moveFx(id){ if(!id) return null;
  return moveFxTable()[String(id).toLowerCase().replace(/[^a-z0-9]/g,'')]||null; }

/* Type and ability immunities. A Pokemon that cannot take a status must not take it - otherwise the
 * simulation paralyses Electric types and burns Fire types, which changes who wins. */
const STATUS_IMMUNE_TYPE={ brn:['Fire'], par:['Electric'], frz:['Ice'], psn:['Poison','Steel'], tox:['Poison','Steel'] };
const STATUS_IMMUNE_ABIL={ brn:['waterveil','waterbubble','thermalexchange'],
                           par:['limber'],
                           frz:['magmaarmor'],
                           psn:['immunity','poisonheal'],
                           tox:['immunity','poisonheal'],
                           slp:['insomnia','vitalspirit','sweetveil'] };
/* WIRE 114 -- ABILITIES THAT REFUSE *EVERY* MAJOR STATUS, held in ONE list rather than repeated
 * across the six above, because the failure this fixes is exactly what per-status lists produce:
 * PURIFYING SALT (Garganacl, 51 sheets, legal and played in Reg M-B) was in NONE of them, so a
 * Garganacl took Will-O-Wisp, Thunder Wave, Spore and Toxic like any other Rock type. Verified
 * against the official engine at the pinned commit before the wire -- Will-O-Wisp into Purifying
 * Salt leaves it clean and into Sturdy burns it; Spore likewise. Its handler is one unconditional
 * `return false` in onSetStatus, so a seventh status added tomorrow is covered without an edit,
 * which a sixth list entry would not be.
 *
 * WHY A NAME AND NOT THE TAG. The artifact's `statusImmune` param is a bare `{immune:true}` on all
 * twelve carriers -- it does not say WHICH status -- so consuming it by shape would make LEAF GUARD
 * (sun only) and PASTEL VEIL (poison only) block everything always. docs/ENGINE.md already declares
 * that: the hand table is RICHER than the artifact and an enrichment reading onSetStatus is future
 * tag_dex work. This entry is that declaration honoured, not an exception to it.
 *
 * COMATOSE IS DECLARED DEAD AND KEPT. It belongs here on the same handler shape (an unconditional
 * `return false`), and it CANNOT FIRE in this format: its only carrier is Komala, which
 * `Dex.forFormat('gen9championsvgc2026regmb')` marks `isNonstandard: 'Past'`. It sat in five of the
 * six lists above with nothing saying so, and a table carrying an unreachable entry invites trust in
 * the rest of it. Kept rather than deleted because the rule is right and a regulation change is the
 * trigger -- the same treatment Primordial Sea gets in the weather block. */
const STATUS_IMMUNE_ABIL_ANY=['purifyingsalt',
                              'comatose'/* UNREACHABLE in Reg M-B: Komala is isNonstandard 'Past' */];
/* POWDER MOVES. Grass types are immune to all of them, as are Overcoat and Safety Goggles. This is
 * why Spore misses Rillaboom and Amoonguss entirely - a fact any bring recommendation depends on. */
/* Screens last 5 turns (8 with Light Clay, which this engine does not model). The DOUBLES
 * multiplier is 2732/4096, not the 0.5 the tag states for singles -- see the note in dmgRange. */
const SCREEN_TURNS=5, DOUBLES_SCREEN=2732/4096;
/* ROADMAP #81 WIRE 8 -- THE SIDE'S NAMED SCREENS, and the three questions the old pair of counters
 * could not answer.
 *
 * Showdown keeps Reflect, Light Screen and Aurora Veil as THREE independent side conditions with
 * three clocks (sim/side.ts:411, `addSideCondition`). This engine kept `scrP` and `scrS`, one per
 * damage CATEGORY, and that representation cost three separate defects: it could not tell whether
 * the specific condition being clicked was already up (Showdown returns false and the move FAILS),
 * it announced an expiring Aurora Veil as a Reflect AND a Light Screen, and it could not carry two
 * overlapping screens with different expiries -- a limit tests/test-game-diff.js had to paper over
 * with a Math.max on the reference side.
 *
 * `sf.sc` is keyed by the MOVE ID that set it, so the announcement is the move's own name and the
 * category comes from that move's own `halvesDamage` tag. No screen is named in this file.
 *
 * THE ITERATION ORDER IS THE ARTIFACT'S CATEGORY, NOT AN INSERTION ORDER. Showdown breaks and
 * expires screens in a fixed order -- Brick Break walks `['reflect','lightscreen','auroraveil']`
 * (data/moves.ts:1833) and the residual sub-orders are 1, 2 and 10 in the same sequence. Sorting on
 * `halvesDamage.category` -- Physical, then Special, then both -- reproduces exactly that sequence
 * for the three screens this format has, and does it without writing one of their names down. */
const SCREEN_CAT_ORDER={Physical:0,Special:1,both:2};
function screenCat(id){const hd=TAGS.param('move',id,'halvesDamage');return hd?String(hd.category||'both'):null;}
function screenIds(sf){
  if(!sf||!sf.sc)return [];
  return Object.keys(sf.sc).filter(id=>sf.sc[id]>0&&screenCat(id))
    .sort((a,b)=>(SCREEN_CAT_ORDER[screenCat(a)]|0)-(SCREEN_CAT_ORDER[screenCat(b)]|0));
}
/* Is a screen covering this damage category? ONE multiplier however many are up: Showdown chains a
 * second `onAnyModifyDamage` when a Reflect and an Aurora Veil overlap, and this engine has always
 * applied the reduction once. That is left exactly as it was -- WIRE 8 changed the REPRESENTATION,
 * and folding a damage change into it would make the ladder unable to say which did what. */
function screenUp(sf,cat){
  return screenIds(sf).some(id=>{const c=screenCat(id);return c==='both'||c===cat;});
}
const POWDER=new Set(['spore','sleeppowder','stunspore','poisonpowder','cottonspore','ragepowder',
                      'magicpowder','powder']);
/* WIRE 66 -- SOUNDPROOF REFUSES A SOUND MOVE, INCLUDING ONE THAT DEALS NO DAMAGE, and until now the
 * only consumer of `immuneToMoveClass` was inside dmgRange. So a Soundproof body took PARTING SHOT
 * (7,184 uses, a sound move) at full effect and was pivoted off, and Bulletproof would take any
 * status bullet move the format ever gains.
 *
 * FOUND BY tests/test-game-diff.js's GENERATED PAIR MATRIX, which is what that instrument is for: the
 * census probes `immuneToMoveClass` through a damaging Rock Blast and passes, because the damage half
 * has been correct since WIRE 22. The cross product asked the same ability a question nobody had
 * thought to ask it.
 *
 * SAME EXCLUSIONS AS WIRE 22, for the same reasons: `powder` belongs to powderBlocked(), which is the
 * single owner of that question, and `reflectable` is Magic Bounce, which BOUNCES rather than refuses
 * and is handled by bounceOff(). */
/* WIRE 128 -- ONE ANSWER TO "WHICH ABILITY DOES THE DEFENDER EFFECTIVELY HAVE".
 *
 * Mold Breaker, Teravolt and Turboblaze suppress the defender's ability for the duration of the
 * move. dmgRange has known that since WIRE 37 and shadowed `defAb` at the top of the calc; the
 * BATTLE LOOP did not, and read `tg.ability` raw at three separate gates. So the damage half and the
 * execution half disagreed on the same fact, which is the FACTS-ARE-GLOBAL failure CLAUDE.md names.
 * One function, four callers.
 *
 * `att` IS OPTIONAL AND THE ABSENCE IS NOT A SILENT DEFAULT -- a caller with no attacker (a chooser
 * scoring a hypothetical, board.js pricing a click) genuinely has nobody to suppress with, and
 * returning the raw ability is the right answer for that question rather than a fallback. */
function suppressedAbility(att,def){
  if(!def)return 'none';
  return (att&&TAGS.param('ability',att.ability,'ignoresDefenderAbility'))?'none':def.ability;
}
/* WIRE 128 -- ONE ANSWER TO "HOW EFFECTIVE IS THIS MOVE AGAINST THIS BODY", AND IT TAKES THE ATTACKER.
 *
 * There were two. dmgRange computed the chart, then Freeze-Dry's override, then Scrappy's immunity
 * exemption; the battle loop's stage-5 gate computed `mcEff(effMoveType(...), tg.types)` and nothing
 * else. So the calc said a Scrappy Incineroar's Body Slam into Gengar was 88 and the loop that
 * executes the click refused it as a type immunity -- MEASURED, both arms, before this was written.
 * Thousand Arrows into a Flying type is the same shape through the override half.
 *
 * WIRE 38 -- SCRAPPY / MIND'S EYE. The tag names both halves of the rule: `movesOfType` is the
 * slash-joined pair of types the ability applies to (Fighting/Normal) and `nowHits` is the type
 * that stops being immune (Ghost). NOT a blanket "ignore immunities" -- a Scrappy Incineroar's
 * Flare Blitz is still nothing to nothing, and its Earthquake is still nothing to a Flying type.
 * The recomputation DROPS the named type from the defender's list rather than forcing eff to 1,
 * which is the difference that matters on a dual type: Normal into Gengar (Ghost/Poison) must come
 * out x1, not x1 forced over a 0.
 *
 * WIRE 60 -- FREEZE-DRY (1,286 uses), P0 #7, and independently confirmed against Showdown:
 * `mrrime freezedry -> araquanid` reads 96-114 there and 24-28 here. Ice is RESISTED by Water in
 * every chart there is; Freeze-Dry is super effective on it, so the error is the full 4x and it is
 * the move's entire identity.
 * THE OVERRIDE IS THE ARTIFACT'S NOW. The param used to be a bare `{overrides:true}` -- it said the
 * chart was wrong and not how -- and the derivation now reads the handler's own
 * `if (type === "Water") return 1`, which is Showdown's per-type MODIFIER: +1 is one step super
 * effective, replacing the chart's -1. So the recomputation drops the named type out of mcEff and
 * multiplies 2^mod back in, which is exactly right on a dual type -- Swampert is Water/Ground and
 * takes 4x, not 2x.
 * FLYING PRESS carries the tag with `perType: null` because it ADDS a type rather than overriding
 * one, and stays visibly unwired rather than being given a number it does not have.
 *
 * `mvT` IS PASSED IN RATHER THAN DERIVED, because dmgRange has already resolved the click's real
 * type (conversion, then weather) alongside a base-power multiplier it needs from the same read.
 * The loop hands it effMoveType(mv,id,field,att), which is that same resolution. */
function typeEffAgainst(att,def,mv,mvT){
  if(!def||!mv)return 1;
  let eff=mcEff(mvT,def.types);
  const _oe=mv.id?TAGS.param('move',mv.id,'overridesEffectiveness'):null;
  if(_oe&&_oe.perType){
    let _hit=false,_e2=1;
    for(const t of def.types){
      if(Object.prototype.hasOwnProperty.call(_oe.perType,t)){_hit=true;_e2*=Math.pow(2,+_oe.perType[t]);}
      else{const r=MC.C[mvT];_e2*=(r&&r[t]!=null)?r[t]:1;}
    }
    if(_hit)eff=_e2;
  }
  const _iti=att&&TAGS.param('ability',att.ability,'ignoresTypeImmunity');
  if(_iti&&_iti.nowHits&&_iti.movesOfType
     &&String(_iti.movesOfType).split('/').indexOf(mvT)>=0
     &&def.types.indexOf(_iti.nowHits)>=0)
    eff=mcEff(mvT,def.types.filter(t=>t!==_iti.nowHits));
  return eff;
}
/* WIRE 11 -- typeImmunity, from the artifact instead of a 12-name table. The tag carries the
 * TYPE (checked against the weather-effective type, so a sand Weather Ball sails past Volt Absorb)
 * and the GAIN, which the old table never knew existed -- the battle loop feeds the absorber.
 * Levitate/Eelevate ride the artifact's one documented name-exception.
 *
 * WIRE 128 -- and it is asked of the SUPPRESSED ability, which the loop was not doing: a Mold
 * Breaker Tinkaton's Earthquake was priced at 60 by dmgRange and absorbed by Levitate in the loop.
 * Returns the PARAM so the absorber's gain is read from one place too. */
function absorbedBy(att,def,mvT){
  const _imm=TAGS.param('ability',suppressedAbility(att,def),'typeImmunity');
  return (_imm&&_imm.type===mvT)?_imm:null;
}
function moveClassBlocked(t,moveId,att){
  if(!t||!moveId)return false;
  const _imc=TAGS.param('ability',suppressedAbility(att,t),'immuneToMoveClass');
  const _flag=_imc&&_imc.blocksFlag;
  if(!_flag||_flag==='reflectable'||_flag==='powder')return false;
  if(_flag==='sound')return TAGS.has('move',moveId,'sound');
  const _c=TAGS.param('move',moveId,'moveClass');
  return !!(_c&&_c.classes&&_c.classes.indexOf(_flag)>=0);
}
function powderBlocked(t,moveId){
  if(!POWDER.has(String(moveId||'').replace(/[^a-z0-9]/g,''))) return false;
  const ab=(t.ability||'').replace(/[^a-z0-9]/g,'');
  return (t.types||[]).includes('Grass') || ab==='overcoat' ||
         String(t.item||'').replace(/[^a-z0-9]/g,'')==='safetygoggles';
}
/* PRANKSTER. Its +1 priority does not apply against Dark types, and the move fails on them outright
 * (Gen 7+). Prankster Thunder Wave into a Dark type does nothing at all. */
/* ONE PLACE THAT ANSWERS "IS THIS PRANKSTER". Two callers now -- the Dark-type block below and the
   +1 priority in battleTurn -- and they were about to normalise the ability string separately, which
   is how the two halves of one ability drift apart. Will asked whether a universal fix existed; this
   is it for THIS engine. It is deliberately not shared with board.js, which asks a different question
   (pranksterProb: the probability an unseen species HAS the ability) because board.js scores real
   games where the opponent's ability is not known and a rollout's is. */
function isPrankster(mon){
  return (mon&&(mon.ability||'')).replace(/[^a-z0-9]/g,'')==='prankster';
}
/* WIRE 100b -- the Contrary sign, read ONCE off the artifact (`invertsBoosts`) instead of seven
 * `==='contrary'` literals. Same fact, one reader; a second inverting ability arrives without an
 * edit anywhere.
 *
 * WIRE 113 -- THE DERIVATION OVER-MATCHED AND THIS READER MADE IT LIVE (found by
 * tests/test-rollout-effects.js the day the tag gained a consumer). The shipped artifact tags
 * Contrary, SIMPLE and RIPEN with invertsBoosts, because all three carry onChangeBoost -- but
 * Simple's handler is `boost[i] *= 2` (it DOUBLES; official engine, real battle: Intimidate into
 * Simple is -2, this reader was producing +1) and Ripen's doubles only BERRY boosts. The tightened
 * derivation (invertsBoosts = Contrary alone; new `amplifiesBoosts {mult:2}` = Simple) is STAGED;
 * until the regeneration lands, the two known non-inverters are excluded HERE by name, stated as
 * the bridge it is -- the same pattern as the Defiant amounts in applyStatDrop. Post-regeneration
 * both name checks go structurally dead.
 * The DOUBLING at these move-driven sites (a Simple body's Swords Dance is +4) is not modelled --
 * it was not modelled before WIRE 100b either -- and only applyStatDrop applies the x2, exactly as
 * the pre-rewire code did. Declared, not discovered. */
const _NOT_INVERTERS=new Set(['simple','ripen']);   // WIRE 113 bridge; dead after the staged regen
const invSign=x=>{
  const _ab=String((x&&x.ability)||'').replace(/[^a-z0-9]/g,'');
  if(_NOT_INVERTERS.has(_ab))return 1;
  return TAGS.param('ability',_ab,'invertsBoosts')?-1:1;
};
function pranksterBlocked(attacker,target,moveId){
  if(!isPrankster(attacker)) return false;
  const fx=moveFx(moveId);
  if(!fx||fx.category!=='Status') return false;
  return (target.types||[]).includes('Dark');
}
function canTakeStatus(t,st){
  if(!t||t.fainted||t.curHP<=0) return false;
  if(t.status) return false;                                  // one major status at a time
  const ab=(t.ability||'').replace(/[^a-z0-9]/g,'');
  /* WIRE 115 -- SHIELD DUST USED TO BE REFUSED HERE AND THAT WAS THE WRONG SCOPE, in the direction
   * that makes the ability far too strong. `canTakeStatus` is the gate for EVERY status this engine
   * applies, and its two callers are the DIRECT status-move path (Will-O-Wisp, Thunder Wave, Spore,
   * Toxic) and the punish-ability exposure loop (Static, Flame Body). Shield Dust blocks NEITHER --
   * it filters a MOVE'S SECONDARIES and nothing else. Confirmed in the official engine at the pinned
   * commit, both arms printed: Will-O-Wisp into Shield Dust BURNS (as into Compound Eyes), and a
   * Shield Dust body that attacks a Static body is PARALYSED (as with any other ability).
   * The suppression now lives at the one site where it is correct -- the secondary loop in the
   * attack branch, `dustBlocked` -- plus the two effects Showdown's own source special-cases onto it
   * (King's Rock, and Poison Touch, which carries the comment "Despite not being a secondary, Shield
   * Dust / Covert Cloak block Poison Touch's effect"). Covert Cloak is banned in this format, so
   * Shield Dust is the live carrier of every one of those. */
  const byType=STATUS_IMMUNE_TYPE[st]||[];
  if((t.types||[]).some(ty=>byType.includes(ty))) return false;
  if(STATUS_IMMUNE_ABIL_ANY.includes(ab)) return false;        // WIRE 114 -- refuses every status
  if((STATUS_IMMUNE_ABIL[st]||[]).includes(ab)) return false;
  return true;
}
/* INTIMIDATE. This used to be an unconditional `boosts.at - 1` on every foe, which is wrong three
 * different ways, and Intimidate is on Incineroar - the most-used Pokemon in the format - so the
 * error was paid in almost every game:
 *   BLOCKED  by Clear Body, White Smoke, Full Metal Body, Hyper Cutter, Inner Focus, Oblivious,
 *            Own Tempo, Scrappy and Guard Dog. These take no drop at all.
 *   REVERSED by Defiant (+2 Attack) and Competitive (+2 Special Attack) - the target ends up
 *            STRONGER. Treating that as -1 gets the sign wrong, a 3-stage swing on Attack.
 *   FLIPPED  by Contrary (+1) and doubled by Simple (-2); Mirror Armor reflects it back.
 * Getting Defiant backwards means the engine thought a Defiant switch-in was punished when it is
 * actually rewarded - the exact read a bring/lead recommendation depends on. */
/* WIRE 3 (ROADMAP #81) -- ONE GATE FOR "IS THIS STAT DROP REFUSED", AND THERE WERE THREE OF THEM
 * THAT DISAGREED. Measured on STATE before a line changed, because the whole-game differential can
 * only see the PROTOCOL and the two possible diagnoses are completely different bugs:
 *
 *   Intimidate -> Clear Body   medi atk stage 0, Showdown 0    BLOCKED, and SILENT -- the engine
 *                              emitted nothing where Showdown writes a `-fail`. Cosmetic to state.
 *   Charm      -> Inner Focus  medi atk stage 0, Showdown -2    APPLIED in the real game and
 *                              REFUSED here. A two-stage Attack error for the rest of the game.
 *
 * So it is BOTH, and the second half is the expensive one. Three sites answered this question and
 * not one of them read the tag's own `blocks` parameter, which has been in the artifact since
 * tag_dex learned to read `onTryBoost`:
 *   - `INTIM_IMMUNE`, a ten-name list, on the Intimidate/Sticky Web path;
 *   - `TAGS.has(...,'preventsStatDrop')` as a BOOLEAN at the secondary-boost and `statChangeInCode`
 *     sites, so Keen Eye / Illuminate / Mind's Eye (accuracy only) and Big Pecks (Defense only)
 *     refused EVERY drop, and Inner Focus / Oblivious / Own Tempo / Scrappy refused every Attack
 *     drop when Showdown's handlers refuse only `effect.name === 'Intimidate'`;
 *   - a hardcoded clearbody/whitesmoke/fullmetalbody triple in the secondary `targetBoosts` block,
 *     so Hyper Cutter kept taking Breaking Swipe's -1 Attack and Big Pecks kept taking Crunch's -1.
 *
 * Rules read out of `data/abilities.ts` and confirmed on a live Champions battle, not out of a
 * description of them. `blocks` comes from the artifact. The INTIMIDATE-ONLY scoping is not in the
 * artifact yet -- tag_dex now derives `onlyFrom` and this reads it first; the name list below is the
 * pre-regeneration bridge, exactly as WIRE 113's Simple/Defiant numbers are.
 *
 * ACCURACY IS A STAGE THIS ENGINE HAS NO SLOT FOR, so an accuracy-only blocker refuses NOTHING here.
 * That is the right answer rather than a skipped one, and it is why the map below has no entry for it.
 *
 * THE MESSAGE IS SUPPRESSED FOR A MOVE'S SECONDARY and for Octolock (`!effect.secondaries` in every
 * one of these handlers); the BLOCK is not. Backwards, that would fire a `-fail` on every Icy Wind
 * and part the two streams in a new place instead of an old one. */
const STAT_LABEL={at:'Attack',df:'Defense',sa:'Special Attack',sd:'Special Defense',sp:'Speed'};
const SD_BLOCK2ENG={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp'};
/* STAGED tag_dex enrichment (`preventsStatDrop.onlyFrom`). Read the tag first; this list is only
 * consulted for an artifact generated before that field existed. */
const INTIM_ONLY_BRIDGE=['innerfocus','oblivious','owntempo','scrappy','guarddog'];
/* Mirror Armor REFLECTS the drop back at the source and emits `|-ability|X|Mirror Armor|`, not a
 * `-fail`. It blocks here exactly as it did before this wire and is announced by nothing; the
 * reflection is filed rather than guessed at. */
const REFLECTS_DROP=['mirrorarmor'];
function statDropRefusal(target,engStat,effectName,isSecondary){
  if(!target)return null;
  const ab=(target.ability||'').replace(/[^a-z0-9]/g,'');
  const p=TAGS.param('ability',ab,'preventsStatDrop');
  if(!p)return null;
  /* Flower Veil guards only GRASS-TYPE bodies. The tag carries the scope and this is its one
   * reader, so the format's 1,465-sheet member does not become a blanket immunity. */
  if(p.onlyGrassTypes&&!(target.types||[]).some(t=>String(t).toLowerCase()==='grass'))return null;
  /* The effect is compared as an ID, so a caller may hand over `intimidate` or `Intimidate` and a
   * mismatch is a real mismatch rather than a capitalisation. */
  const _eid=String(effectName||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const only=p.onlyFrom||(INTIM_ONLY_BRIDGE.indexOf(ab)>=0?'Intimidate':null);
  if(only&&String(only).toLowerCase().replace(/[^a-z0-9]/g,'')!==_eid)return null;
  const blocks=String(p.blocks||'');
  if(blocks!=='all stats'&&SD_BLOCK2ENG[blocks]!==engStat)return null;
  MEDSEEN.statDropRefused++;
  return {ab, label:blocks==='all stats'?'':(STAT_LABEL[engStat]||''),
          announce:!isSecondary&&_eid!=='octolock'&&REFLECTS_DROP.indexOf(ab)<0};
}
/* The one place a refusal turns into a protocol line, so the shape cannot drift between the four
 * callers. Returns true when the drop was refused. */
function refuseStatDrop(target,engStat,effectName,isSecondary){
  const r=statDropRefusal(target,engStat,effectName,isSecondary);
  if(!r)return false;
  if(TR&&r.announce)TR.failUnboost(target,r.label,r.ab);
  return true;
}
/* WIRE 100 -- ONE OPPONENT-INFLICTED STAT-DROP PATH, shared by Intimidate and Sticky Web, because
 * the REACTIONS are one fact: blocked by the Clear Body class, inverted by Contrary (from the
 * artifact's `invertsBoosts`), doubled by Simple, and RETALIATED by Defiant/Competitive.
 *
 * THE RETALIATION ARITHMETIC WAS WRONG AND IS FIXED HERE, verified against the official engine
 * before the probe was trusted: in Showdown the drop LANDS and then the +2 fires, so Intimidate
 * into Defiant is net +1 Attack (this code read +2), and into Competitive it is Attack -1 AND
 * SpA +2 (this code left Attack untouched). Membership for the retaliation is the artifact's
 * (`boostsWhenLowered`); the params carry no stat or amount yet ({retaliates:true}), so the
 * two known handlers' numbers are typed beside a STAGED tag_dex enrichment. */
/* `eff` is the NAME OF THE THING INFLICTING THE DROP and it is not optional: Inner Focus, Oblivious,
 * Own Tempo, Scrappy and Guard Dog refuse `effect.name === 'Intimidate'` and nothing else, so a
 * caller that does not say what it is cannot be answered. WIRE 3. */
/* WIRE 138 -- DEFIANT AND COMPETITIVE FIRE ONCE PER **STAT LOWERED**, AND THIS ENGINE FIRED THEM ON
 * EXACTLY ONE ROUTE.
 *
 * Will, 2026-08-07: *"WHEN PARTING SHOT GOES INTO A DEFIANT OR COMPETITIVE MON IT GETS DOUBLE BOOSTS,
 * ONE FOR EACH DROP. I DONT THINK THATS THE CASE FOR CHARM BUT IDK."* Both halves are right and the
 * mechanism is the HOOK NAME: `Battle#boost` runs `runEvent('AfterEachBoost', …, currentBoost)` INSIDE
 * its per-stat loop (sim/battle.ts:2073), so `defiant.onAfterEachBoost` fires per STAT. Parting Shot
 * lowers two stats: -1 +2 +2 = **+3 Attack**. Charm lowers ONE stat by TWO stages, fires once, and the
 * -2 cancels the +2 exactly: **0**.
 *
 * THE BIGGER HALF IS THE ROUTE, NOT THE COUNT. The retaliation lived inside `applyStatDrop`, and
 * `applyStatDrop` is only reached by Intimidate and Sticky Web. Every MOVE-driven stat drop — Charm,
 * Parting Shot, Icy Wind, Snarl, Growl, Breaking Swipe, Crunch's secondary — resolved in branches that
 * write `target.boosts[...]` directly and never asked the ability anything at all. Measured before a
 * line changed: Parting Shot into a Defiant body read `-1,-1`, identical to a body with no ability.
 * So on 7,661 Defiant sheets and 1,916 Competitive ones, the punisher did not punish anything a player
 * actually clicks.
 *
 * ONE IMPLEMENTATION, CALLED AT EVERY SITE THAT LOWERS A STAT, which is CLAUDE.md's FACTS-ARE-GLOBAL
 * rule: "does this ability retaliate" is a fact about the game and not a property of whichever branch
 * happened to apply the drop.
 *
 * THE TWO GUARDS ARE THE HANDLER'S OWN FIRST LINE (`if (!source || target.isAlly(source)) return;`)
 * and they are the negatives a fix aimed only at Parting Shot would miss: an ALLY lowering your stats
 * does NOT trigger it, and neither does a source-less drop. Both come from the artifact
 * (`needsSource`, `notFromAlly`) rather than being written here.
 *
 * A CALLER THAT CANNOT NAME THE SOURCE keeps the pre-wire behaviour and is COUNTED, because a silent
 * default here reads exactly like the ability working. */
function retaliateWhenLowered(f,src){
  if(!f||f.fainted||!f.boosts)return false;
  const ab=(f.ability||'').replace(/[^a-z0-9]/g,'');
  const p=TAGS.param('ability',ab,'boostsWhenLowered');
  if(!p)return false;
  if(src===undefined){MEDSEEN.retaliateSourceUnknown++;}
  else{
    if(p.needsSource&&!src)return false;
    if(p.notFromAlly&&src&&src._sf&&f._sf&&src._sf===f._sf)return false;
    if(src===f)return false;
  }
  const bo=p.boosts||(ab==='defiant'?{atk:2}:ab==='competitive'?{spa:2}:null);
  if(!bo)return false;
  if(TR)TR.ab(f,ab,'boost');
  for(const k in bo){const _s=SD2ENG[k];if(_s&&f.boosts[_s]!=null){
    const _b=f.boosts[_s];f.boosts[_s]=clamp(f.boosts[_s]+bo[k],-6,6);
    if(TR)TR.bst(f,_s,f.boosts[_s]-_b);}}
  MEDSEEN.retaliateWhenLowered++;
  return true;
}
function applyStatDrop(f,stat,n,eff,src){
  if(!f||f.fainted) return 'none';
  const ab=(f.ability||'').replace(/[^a-z0-9]/g,'');
  if(refuseStatDrop(f,stat,eff,false)) return 'blocked';
  /* THROUGH invSign, the ONE reader of the inverting fact -- which is where the WIRE 113 bridge
   * lives. Asking the tag directly here is exactly how Simple got +1 from Intimidate against the
   * official engine's -2: the shipped artifact over-tags it as an inverter. */
  if(invSign(f)===-1){
    const _b0=f.boosts[stat];
    f.boosts[stat]=clamp(f.boosts[stat]+n,-6,6);
    if(TR)TR.bst(f,stat,f.boosts[stat]-_b0); return 'contrary';
  }
  /* Simple DOUBLES the drop (official engine: Intimidate into Simple is -2). By shape from the
   * staged `amplifiesBoosts {mult:2}`; the name is the pre-regeneration bridge, WIRE 113. */
  const _amp=TAGS.param('ability',ab,'amplifiesBoosts');
  const _b1=f.boosts[stat];
  f.boosts[stat]=clamp(f.boosts[stat]-n*((_amp&&+_amp.mult)||(ab==='simple'?2:1)),-6,6);
  if(TR)TR.bst(f,stat,f.boosts[stat]-_b1);
  /* WIRE 138 -- THROUGH THE SHARED READER. This block used to be the only place the retaliation
   * happened, which is why every move-driven drop escaped it. `src` is optional and `undefined` keeps
   * the pre-wire behaviour with a counter, so no existing caller changes meaning silently. */
  if(TAGS.param('ability',ab,'boostsWhenLowered')){retaliateWhenLowered(f,src);return ab;}
  return ab==='simple'?'simple':'dropped';
}
function applyIntimidate(f){ return applyStatDrop(f,'at',1,'Intimidate'); }
/* WIRE 100a -- every entry drop reads `onSwitchInDrop` membership from the artifact. The params
 * carry no stat table yet ({drop:true} -- and Download is an over-match in the current artifact,
 * which is exactly why the amounts are NOT taken from it), so Intimidate's -1 Atk is typed beside
 * the STAGED enrichment; a member without a table does nothing rather than guessing. Supersweet
 * Syrup's drop is evasion, a stat this engine has no slot for, and skips honestly through SD2ENG. */
function applyEntryDrops(m,foes){
  const _osd=TAGS.param('ability',m.ability,'onSwitchInDrop');
  if(!_osd)return;
  const _bo=_osd.boosts||(m.ability==='intimidate'?{atk:-1}:null);
  if(!_bo)return;
  /* `|-ability|p1a: X|Intimidate|boost` once, then one `|-unboost|` per foe — Showdown's own order,
   * read off a real Champions battle.log. The `boost` third argument is the protocol's marker for
   * "this ability announcement is about a stat change". */
  if(TR&&foes.some(f=>f&&!f.fainted))TR.ab(m,m.ability,'boost');
  for(const f of foes){
    if(!f||f.fainted)continue;
    /* WIRE 138 -- the ENTRY-DROP source is the body that just arrived, and it is named now so the
       retaliation can apply the authority's ally guard instead of assuming a foe. */
    for(const k in _bo){const _s=SD2ENG[k];if(_s&&_bo[k]<0)applyStatDrop(f,_s,-_bo[k],m.ability,m);}
  }
}
/* WIRE 56 / ROADMAP #81 WIRE 11 -- WHITE HERB, AND THE DEFECT WAS THE *TIMING*, NOT THE EFFECT.
 *
 * 2,380 corpus sheets, the most-held item in this format after the Focus Sash. WIRE 56 wired what it
 * DOES -- every negative stage back to zero, positives untouched, the item then gone -- and wired it
 * at exactly one trigger: the residual. `data/items.ts` gives whiteherb FOUR:
 *
 *     onAnySwitchIn  (priority -2)    onAnyAfterMega    onAnyAfterMove    onResidual
 *
 * all four calling the same `onStart` body. Three of them were missing, so the herb was a whole turn
 * late. Observed live: Incineroar Intimidates a Sneasler, the authority writes
 * `|-enditem|Sneasler|White Herb` then `|-clearnegativeboost|Sneasler|[silent]` on the switch-in, and
 * this engine left Sneasler at -1 Attack for the whole of the turn that followed.
 *
 * AND THE THIRD EFFECT IS THE ONE THAT MATTERS. `unburden.onAfterUseItem` adds the Unburden volatile
 * the moment the item is spent, and that volatile is `onModifySpe -> chainModify(2)`. So the herb
 * coming off is not an announcement, it is a SPEED TIER CHANGE MID-TURN -- an Intimidate makes the
 * body it just weakened move FIRST. This engine gets that for free through `effSpeed`'s existing
 * `_hadItem && !m.item` read, but only if the item is actually gone by the time the turn is ordered,
 * which at the residual it never was. Unburden is 2,509 sheets and Sneasler's own usage item IS a
 * White Herb, so the pair is not a corner case in this format.
 *
 * MEMBERSHIP IS THE ARTIFACT'S AND IT MATCHES EXACTLY ONE ITEM -- printed before this was wired, per
 * docs/LESSONS.md §4: `restoresStats` is White Herb and nothing else.
 *
 * ONE PASS OVER THE WHOLE FIELD, not over the entrant. `onAnySwitchIn` fires on EVERY holder for
 * EVERY switch-in, so the body that gets its stage back is usually not the body that just arrived.
 * Returns true when it fired, so a caller can be counted. */
function restoreStatsUpdate(m){
  if(!m||m.fainted||m.curHP<=0||!m.item||!m.boosts)return false;
  const _rs=TAGS.param('item',m.item,'restoresStats');
  if(!(_rs&&_rs.restores))return false;
  let _any=false;
  for(const k in m.boosts)if(m.boosts[k]<0){_any=true;break;}
  if(!_any)return false;
  /* The item goes FIRST and the stages second, which is the order the protocol shows: `useItem()`
   * writes the `-enditem` and the handler's `onUse` writes the `-clearnegativeboost` after it. */
  const _it=m.item; m.item='';
  if(TR)TR.enditem(m,_it);
  for(const k in m.boosts)if(m.boosts[k]<0)m.boosts[k]=0;
  if(TR)TR.clearNeg(m);
  MEDSEEN.statsRestoredByItem++;
  return true;
}
function restoreStatsAll(a,b){
  let n=0;
  for(const x of [...(a||[]),...(b||[])])if(x&&restoreStatsUpdate(x))n++;
  return n;
}
/* WIRE 133 -- IS THERE A SIDE BUFF ON THE TARGET'S SIDE THAT REFUSES THIS?
 *
 * Read by SHAPE and not by name: the condition is whatever move laid it, and `sideBuff` now carries
 * `blocksStatus` / `blocksStatDrop` / `blocksVolatile` derived from the condition's own handlers. That
 * split is the whole reason the tag could not be wired before -- Safeguard refuses a STATUS and Mist
 * refuses a STAT DROP, and treating the class as one thing would have made Mist a second Safeguard.
 *
 * IT ONLY REFUSES SOMETHING WRITTEN BY THE OTHER SIDE. `onSetStatus` opens `if (!effect || !source)
 * return;` and ends `if (target !== source)`, so a self-inflicted status (Rest, a Toxic Orb) and a
 * source-less one go straight through. The engine expresses that by requiring a SOURCE: every caller
 * that knows who wrote the status passes one, and the ones that do not (the residual, the hazards,
 * Yawn's delayed sleep) are exactly the cases the authority also lets through -- Yawn explicitly, by
 * name, at data/moves.ts:15591. Stated rather than left as an accident of which call sites were
 * edited; Toxic Spikes is the one member where the authority's answer has NOT been checked, and it
 * keeps its current behaviour rather than acquiring a guess. */
function sideBuffRefuses(t,src,what){
  if(!t||!src||src===t)return null;
  const sf=t._sf; if(!sf||!sf.sc)return null;
  if(src._sf&&src._sf===sf)return null;                       // an ally is not the other side
  for(const id in sf.sc){
    if(!(sf.sc[id]>0))continue;
    const p=TAGS.param('move',id,'sideBuff');
    if(p&&p[what])return p;
  }
  return null;
}
function applyStatus(t,st,src){
  {const _sb=sideBuffRefuses(t,src,'blocksStatus');
   if(_sb){MEDSEEN.sideBuffRefused++;
     /* `-activate|TARGET|move: Safeguard` -- the authority emits it for a MOVE with no secondaries
      * (data/moves.ts:15595), which is exactly the direct status-move path this engine routes here. */
     if(TR)TR.act(t,'move: '+(_sb.startsAs||_sb.sideCondition));
     return false;}}
  if(!canTakeStatus(t,st))return false;t.status=st;
  if(TR)TR.sta(t,st);
  if(st==='slp')t.slpTurns=0;if(st==='frz')t.frzTurns=0;if(st==='tox')t.toxTurns=0;return true;}

/* ================= CONFUSION, WHICH THIS ENGINE DID NOT HAVE AT ALL ==============================
 *
 * ROADMAP #92. Until this pass the string `confusion` appeared in this file only in comments saying
 * it was absent -- the `tangledfeet` row in the damage table is switched OFF with `off: 'no confusion
 * volatile exists in this engine'`, and Alluring Voice's whole punish arm was counted as unmodelled.
 * What DID happen was worse than nothing: Confuse Ray, Dynamic Punch, Swagger, Flatter, Sweet Kiss,
 * Teeter Dance, Water Pulse, Hurricane and Axe Kick all carry `statusInflict {volatile:'confusion'}`,
 * so the generic volatile branch wrote `_vol.confusion = 1` onto the target and NOTHING EVER READ IT
 * OR DECREMENTED IT. Measured on a staged board (tests/staged_status_counters.js
 * `confusion-counter-decays`): our Snorlax carries `confusion 1` on every board for the rest of the
 * game while Showdown's has none from turn 2 -- and the CONSEQUENCE, a body that sometimes hits
 * itself instead of moving, never happened once in any rollout this project has ever run.
 *
 * THE DURATION IS THE MINIMUM OF THE AUTHORITY'S RANGE, AND THAT IS A DECISION RATHER THAN A DEFAULT.
 * `data/conditions.ts:174` draws it as `this.random(min, 6)` -- 2 to 5 attempts, or 3 to 5 after an
 * Axe Kick. Showdown's RANGE form of `random` is what the differential pins, and every arm in
 * `engine/game_differential.js` pins it to the BOTTOM (`return m;`), so the authority always draws 2
 * under measurement. This engine's `rng` is a plain float and cannot express a range draw at all: a
 * `min + floor(rng()*span)` would read 5 under the top-corner arm and 2 under the bottom one, so the
 * two engines would part on the arm the staged boards actually run. The flat minimum is the same
 * choice the partial-trap already makes (`turns:(_tn?+_tn[0]:4)`), it is the only value that can ever
 * be CHECKED against the authority, and it is stated here rather than left to be discovered.
 * THE COST IS REAL AND IS NOT HIDDEN: against real dice confusion lasts 3.5 attempts on average and
 * this engine gives it 2, so a search will under-value landing one. `MEDSEEN.confusionMinDuration`
 * counts every time the floor is taken, so it is a number in the run rather than a sentence here. */
/* DERIVED, not chosen: it is the low end of the authority's own draw at data/conditions.ts:174,
 * `this.effectState.time = this.random(min, 6)`, and it is the value the differential's pinned range
 * form observed in EVERY arm -- measured, see the paragraph above. */
const CONFUSION_TURNS_MIN = 2;
const CONFUSION_SELF_HIT_BP = 40;                 // data/conditions.ts:191 -- getConfusionDamage(pokemon, 40)
/* THE ITEM THAT TAKES A VOLATILE OFF, read by SHAPE from `curesVolatile.cures`. Lum and Persim reach
 * it because tag_dex now derives that list from `onEat`'s own `removeVolatile` calls; Mental Herb
 * keeps its separate site because it carries per-volatile bookkeeping (`_sealed`, the Encore lock)
 * that a berry has nothing to do with. Returns true when the item was spent. */
function itemCuresVolatile(m,vol){
  if(!m||!m.item)return false;
  const p=TAGS.param('item',m.item,'curesVolatile');
  if(!(p&&Array.isArray(p.cures)&&p.cures.indexOf(vol)>=0))return false;
  const it=m.item;
  if(m._vol)delete m._vol[vol];
  m.item='';
  if(TR){TR.enditem(m,it,'[eat]');TR.vend(m,vol);}
  MEDSEEN.volatileCuredByItem++;
  return true;
}
/* `addVolatile('confusion')`, with every refusal the authority applies and no others.
 *   ALREADY CONFUSED       `addVolatile` returns false for a volatile with no onRestart, and the
 *                          clock is NOT re-rolled -- an engine that overwrote it would make a second
 *                          Confuse Ray a free extension.
 *   OWN TEMPO              `refusesVolatile`, derived from `onTryAddVolatile`. 64 sheets. Read by
 *                          shape, so Inner Focus's flinch refusal comes off the same tag.
 *   SAFEGUARD              the existing `sideBuff.blocksVolatile`, through the shared reader, so this
 *                          cannot disagree with the status path beside it.
 * DECLARED AND NOT MODELLED, because an unstated gap is the thing this project keeps finding: MISTY
 * TERRAIN also refuses confusion to a GROUNDED body (`data/moves.ts` mistyterrain onTryAddVolatile).
 * This engine has no per-terrain volatile refusal and the move is 9 corpus uses; it is counted as
 * `MEDFAILS.confusionMistyUnmodelled` whenever the terrain is up, rather than silently allowed. */
/* `viaSecondary` says which road the confusion arrived by, and it exists for ONE reason: Safeguard's
 * refusal is ANNOUNCED for a move with no secondaries and SILENT for a secondary
 * (`if (effect.effectType === 'Move' && !effect.secondaries) this.add('-activate', ...)`), which is
 * the same split WIRE 133 already honours on the status path. Own Tempo announces NOTHING at all --
 * its handler is a bare `return null` -- so nothing is emitted there either. Getting this wrong would
 * put a line in our stream the authority never writes, which is the protocol differential's business
 * and is invisible to the board. */
function applyConfusion(t,src,field,viaSecondary){
  if(!t||t.fainted||t.curHP<=0)return false;
  if(t._vol&&t._vol.confusion>0){MEDSEEN.confusionAlreadyOn++;return false;}
  {const _rv=TAGS.param('ability',t.ability,'refusesVolatile');
   if(_rv&&Array.isArray(_rv.refuses)&&_rv.refuses.indexOf('confusion')>=0&&!_rv.requiresForme){
     MEDSEEN.confusionRefusedByAbility++;
     return false;}}
  {const _sb=sideBuffRefuses(t,src,'blocksVolatile');
   if(_sb){MEDSEEN.confusionRefusedBySideBuff++;
     if(TR&&!viaSecondary)TR.act(t,'move: '+(_sb.startsAs||_sb.sideCondition));
     return false;}}
  if(field&&field.terrain==='misty'){MEDFAILS.confusionMistyUnmodelled++;}
  (t._vol=t._vol||{}).confusion=CONFUSION_TURNS_MIN;
  MEDSEEN.confusionSet++;MEDSEEN.confusionMinDuration++;
  if(TR)TR.vstart(t,'confusion');
  /* THE BERRY IS AN `onUpdate` AND FIRES BEFORE THE BODY EVER ACTS, which is why it is here and not
   * only in the update pass: a Lum holder confused by a move it was aimed at must lose the volatile
   * inside the same turn, not at the next boundary. The update pass calls the same reader, so a
   * confusion arriving by any other route is caught there. */
  itemCuresVolatile(t,'confusion');
  return true;
}
/* THE TICK, AND IT IS WHERE SHOWDOWN PUTS IT: `onBeforeMove`, at the TOP of the attempt, BEFORE the
 * roll that decides whether the body hurts itself (data/conditions.ts:181). So a confusion whose
 * clock has just run out costs nothing at all -- the volatile is removed and the move goes through.
 * Returns TRUE when the body loses its action. */
function confusionSelfDamage(m,rng){
  const A=Math.floor(m.st.at*boostMul(m.boosts.at));
  const D=Math.floor(m.st.df*boostMul(m.boosts.df));
  /* `battle-actions.ts:1856`, with level 50 folded into the 22 the damage function already uses.
   * NO STAB, NO TYPE CHART, NO CRIT, NO SCREEN, NO BURN -- the move is typeless and getConfusionDamage
   * calls neither getDamage's modifier chain nor moveHit. The one thing it DOES pick up that this does
   * not is an `onModifyAtk` ability (a burned Guts body hits itself harder); declared rather than
   * modelled, and it needs a burn and a Guts body and a confusion at once. */
  const base=Math.floor(Math.floor(22*CONFUSION_SELF_HIT_BP*A/D)/50)+2;
  /* THE SAME ROLL IDIOM THE ATTACK PATH USES, so the two cannot pin differently: 16 sides, the top
   * corner is the maximum roll and the bottom corner is 85%. */
  const r=Math.min(15,Math.floor(rng()*16));
  return Math.max(1,Math.floor(base*(85+r)/100));
}
function confusionBeforeMove(m,rng){
  if(!m||!m._vol||!(m._vol.confusion>0))return false;
  if(--m._vol.confusion<=0){delete m._vol.confusion;if(TR)TR.vend(m,'confusion');MEDSEEN.confusionExpired++;return false;}
  if(TR)TR.act(m,'confusion');
  /* `this.randomChance(33, 100)` at data/conditions.ts:187 -- one attempt in three. */
  if(rng()>=1/3)return false;
  const d=confusionSelfDamage(m,rng);
  m.curHP-=d;MEDSEEN.confusionSelfHit++;
  if(TR)TR.dmg(m,'[from] confusion');
  if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);}
  return true;
}

/* ON-ENTRY FIELD EFFECTS, from the artifact instead of a four-name list. Called for the leads AND
 * for every faint replacement — the gap Will's Solar Beam/Pelipper question exposed: refill()
 * applied only Intimidate, so a mid-game Drizzle entrant set no rain in any rollout, ever. The
 * entrant's weather OVERRIDES what stands, exactly as the real setWeather does. Terrain now exists
 * on the field for the same reason (Psychic Surge blocks priority the way Armor Tail does; Grassy
 * Glide's +1 already reads field.terrain and could never see one). */
/* `ally` is optional and is what Hospitality needs: an entry effect that touches the PARTNER, not
 * the field. Every existing caller passes two arguments and is unaffected. */
function applyEntryEffects(m,field,ally){
  if(!m)return;
  /* HOSPITALITY -- Sinistcha and Gardevoir, 4,968 uses, and the third most common ability in the
   * format. It restores a quarter of the partner's HP on entry and the engine did nothing at all,
   * so every Sinistcha pivot in every rollout was worth less than it is.
   *
   * Chosen over Blaze deliberately. Blaze shows 4,585 uses and 30 of its 54 sheet entries are a
   * Charizard holding a Charizardite -- it megas on turn one and the ability becomes Drought, so the
   * Blaze is never live. Ability usage is counted off SHEETS, which over-counts every pre-mega
   * ability; Will spotted that from the number alone. */
  /* ROADMAP #81 WIRE 7 -- A HEAL THAT HEALS NOTHING IS NOT AN EVENT, AND IT WAS THE SINGLE LARGEST
   * CAUSE AT THE TOP RUNG OF THE RELEASE LADDER (127 games across two divergence classes).
   *
   * `Battle.heal()` (sim/battle.ts) refuses BEFORE it announces:
   *     if (target.hp >= target.maxhp) return false;
   * -- so a Sinistcha leading beside an untouched partner emits NOTHING AT ALL. This engine clamped
   * with Math.min and announced unconditionally, which is why the shape read
   *     SD  |-unboost|p2a: Staraptor|atk|1
   *     MC  |-heal|p2a: Staraptor|160/160|[from] ability: hospitality|[of] p2b: Sinistcha
   * on turn one of every game with a Hospitality body in it. MEASURED ON HP FIRST, as the roadmap
   * required: the partner is at FULL, so the clamp made the heal a no-op and the two engines' STATE
   * already agreed. This is a stream defect and nothing else, and saying so is the finding.
   *
   * THE `|-ability|` LINE GOES TOO, and that is a second defect in the same three lines. Hospitality's
   * handler is a bare `for (const ally of pokemon.adjacentAllies()) this.heal(...)` with no
   * `this.add('-ability', ...)` in it -- unlike Intimidate, which announces itself explicitly. Every
   * Hospitality entry emitted one line Showdown never writes, INCLUDING the entries where the partner
   * was damaged and the heal itself was correct.
   *
   * WHAT IS NOT FIXED HERE, AND IS REPORTED RATHER THAN FILED: Hospitality carries
   * `onSwitchInPriority: -2`, so in the authority it resolves after EVERY priority-0 entry ability
   * regardless of speed. This engine speed-sorts entrants (WIRE 123) and has no priority term, and the
   * priority is not in data/tags.json -- wiring it would mean typing the sixteen abilities that carry
   * one. It can only bite when a partner is ALREADY DAMAGED as the pair enters, which turn-1 leads
   * never are; the full-HP gate above is what the ladder actually sees. */
  const _h=TAGS.param('ability',m.ability,'healsAllyOnSwitchIn');
  if(_h&&_h.heals&&ally&&!ally.fainted&&ally.curHP>0&&ally.st&&ally.curHP<ally.st.hp){
    ally.curHP=Math.min(ally.st.hp,ally.curHP+Math.floor(ally.st.hp/4));
    if(TR)TR.heal(ally,'[from] ability: '+m.ability,m);
  }
  /* SETTING THE WEATHER THAT IS ALREADY STANDING IS A NO-OP, AND IT IS NOT A REFRESH EITHER.
   * `sim/field.ts setWeather()`: `if (this.weather === status.id) { if (sourceEffect.effectType ===
   * 'Ability') { if (this.battle.gen > 5 ...) return false; } }` -- gen 9 is > 5, so the second
   * Drizzle body to arrive under rain changes nothing and ANNOUNCES nothing, and the clock does not
   * go back to 5. This engine set and emitted unconditionally.
   *
   * IT WAS REACHABLE BEFORE THIS PASS (two weather setters, one switching in under the other's sky)
   * and ROADMAP #31 makes it constant: a Tyranitar sets sand on entry and then megas into Sand Stream
   * on turn one, so EVERY mega weather setter emitted a `-weather` line Showdown does not, on the line
   * immediately after the `-mega`. Fixing it here rather than in the mega path because it is one rule
   * about the field, not a rule about evolving. */
  const w=TAGS.param('ability',m.ability,'weatherSetter');
  if(w&&w.weather){const _w=weatherId(w.weather);if(_w&&field.weather!==_w){field.weather=_w;field.weatherT=weatherTurns(_w,m.item);
    if(TR)TR.wx(_w,'[from] ability: '+m.ability,m);}}
  /* NORMALISED ON THE WAY IN AS WELL AS ON THE WAY OUT. `terrainSetter` happens to carry the engine's
   * own word today, so this is a no-op — and that is exactly the reason to route it: if the artifact
   * ever spells it the Board's way, the ability keeps working instead of silently setting a string no
   * reader matches. Same call the readers make, so the two cannot drift. */
  /* AND THE SAME RULE FOR TERRAIN, from the same file: `setTerrain()` opens with
   * `if (this.terrain === status.id) return false;` -- unconditionally, no gen check. */
  const t=TAGS.param('ability',m.ability,'terrainSetter');
  if(t&&t.terrain){const _t=terrainId(t.terrain);if(_t&&field.terrain!==_t){field.terrain=_t;field.terrainT=5;
    if(TR)TR.terrainStart(_t,'[from] ability: '+m.ability,m);}}
}
/* ---- ROADMAP #31 -- MEGA EVOLUTION, PERFORMED MID-TURN --------------------------------------------
 *
 * Showdown resolves this as its own queued action at ORDER 104 (`sim/battle-queue.ts:184`), which is
 * BELOW `switch` at 103 and ABOVE every move at 200. So: all switches, then every mega, then the
 * moves -- and the caller places the call, not this function. See battleTurn.
 *
 * WHAT `formeChange(species, item, isPermanent=true)` DOES, read out of the format's own override at
 * `data/mods/champions/scripts.ts:57-120` rather than out of mainline memory, because Champions
 * differs from mainline in one respect that matters (it drops `formeRegression`, so a Champions mega
 * does NOT revert on fainting):
 *
 *   1. `add('detailschange', this, details)`      the new forme, on the OLD identifier
 *   2. `updateMaxHp()`                            no mega in this format changes the HP base stat, so
 *                                                 this moves nothing -- measured over all 74
 *   3. `add('-mega', this, apparentSpecies, requiredItem)`
 *   4. `setAbility(species.abilities[0], null, null, true)`
 *
 * STEP 4 IS AN OVERWRITE, NOT A CHANGE, AND THAT IS THE WHOLE MECHANIC. Whatever the body's ability
 * had become -- Worry Seed's Insomnia, a Skill Swap, an Entrainment, a Trace -- it EQUALS the mega
 * forme's slot-0 ability afterwards. A test asserting "the ability string changed" is wrong twice: it
 * passes on a no-op that happened to differ, and it FAILS on the megas that legitimately keep their
 * base ability. Measured against `Dex.forFormat('gen9championsvgc2026regmb')`: 8 of the 74 megas in
 * this format have the same slot-0 ability as their base (Tyranitar-Mega Sand Stream, Medicham-Mega
 * Pure Power, Abomasnow-Mega Snow Warning, Malamar-Mega Contrary, Barbaracle-Mega Tough Claws,
 * Drampa-Mega Berserk, Chimecho-Mega Levitate, Audino-Mega Healer). The list is read from the dex in
 * tests/test-mega-timing.js and is never maintained by hand.
 *
 * AND setAbility STILL FIRES THE ABILITY'S `Start` EVENT with `isFromFormeChange = true`
 * (`sim/pokemon.ts` -- the flag suppresses the SetAbility event and the `-ability` announcement, not
 * the Start handler). So an entry-style ability on the MEGA forme fires ON EVOLUTION: Mega Manectric
 * and Mega Scrafty Intimidate, Mega Tyranitar re-sets the sand, Mega Charizard Y the sun. That is
 * applyEntryEffects + applyEntryDrops here, the same two calls battleInit makes for a lead -- one
 * implementation, so a mechanic wired for a switch-in cannot be missing for an evolution. WIRE 123
 * was these two resolving in the wrong order, which is why they are called and not re-implemented. */
function megaEvolveNow(S,m,auto){
  if(!m||m.fainted||m.curHP<=0)return false;
  const key=megaTargetFor(m);
  if(!key)return false;
  const onB=S.actB.indexOf(m);
  const slot=onB>=0?onB:S.actA.indexOf(m);
  if(slot<0)return false;                       // a benched body cannot mega
  const sd=onB>=0?'B':'A';
  const sf=sd==='B'?S.sfB:S.sfA;
  /* ONE MEGA PER SIDE PER BATTLE. The flag lives on the per-side object battleInit already hands
   * every body by reference, so a bench member that comes in later shares the same answer. */
  if(sf.megaUsed)return false;
  const megRow=monRow(key), baseRow=monRow(m.name);
  if(megRow&&megRow.bs&&baseRow&&baseRow.bs){
    /* buildMon's own rule, verbatim: swap the BASE STATS and keep whatever spread this body already
     * carries, so a mega does not silently lose its investment. Showdown's updateMaxHp keeps the
     * DAMAGE TAKEN constant rather than the fraction, which is what the curHP line below does.
     *
     * BOTH ANCHORS CARRY THE BODY'S NATURE, and getting that wrong is silent. The swap is
     * `megaL50 + (st - baseL50)`; if `st` is natured and the anchors are not, the delta is
     * (mul - 1) x baseL50 rather than the spread, and the mega lands one or two points short on
     * exactly the stat the nature moved -- which surfaces as a turn-order divergence in hundreds of
     * games and reads as an engine bug. Showdown has no such seam: formeChange -> setSpecies
     * RECOMPUTES storedStats from the SET, nature included, so it is always right and we are always
     * the one that drifts. A body with no `_nature` is neutral and this is byte-identical to before. */
    const b=l50(baseRow.bs,null,m._nature), g=l50(megRow.bs,null,m._nature);
    const st={hp:g.hp+(m.st.hp-b.hp),at:g.at+(m.st.at-b.at),df:g.df+(m.st.df-b.df),
              sa:g.sa+(m.st.sa-b.sa),sd:g.sd+(m.st.sd-b.sd),sp:g.sp+(m.st.sp-b.sp)};
    const dHP=st.hp-m.st.hp;
    m.st=st; m.curHP=Math.max(1,Math.min(st.hp,m.curHP+dHP));
  }else{
    MEDFAILS.megaNoBaseStats++;
    if(!MEDFAILS.megaNoBaseStatsFirst)MEDFAILS.megaNoBaseStatsFirst=String(key);
  }
  /* THE APPARENT SPECIES IS THE ARTIFACT'S OWN BASE KEY, never the forme name with a suffix removed.
   * `megaIntoTable().rev` is the INVERTED `megaStone.into` map, which is the same table WIRE 132
   * added for exactly this reason. DECLARED RESIDUE, measured rather than discovered later: Showdown
   * writes `species.baseSpecies`, and that differs from the artifact's base key on exactly 2 of the
   * 74 -- Floette-Mega (baseSpecies "Floette", artifact base "Floette-Eternal") and Meowstic-F-Mega
   * (baseSpecies "Meowstic", artifact base "Meowstic-F"). Both are display fields; the FORME is
   * carried by `detailschange` and agrees on all 74.
   *
   * `m._ident` IS ASKED FIRST AND IS THE BETTER ANSWER WHEN A CALLER SET IT. Showdown's apparent
   * species is `species.baseSpecies` of the MEGA forme, and the identifier a caller stamps is
   * `baseSpecies` of the BASE forme — measured equal on both oddballs (Floette-Mega and
   * Floette-Eternal are both "Floette"; Meowstic-F-Mega and Meowstic-F are both "Meowstic"), so a
   * harness that stamps identifiers gets the right field here for free rather than inheriting the
   * residue. */
  const apparent=m._ident||megaIntoTable().rev[key]||m.name;
  m.name=key;
  if(megRow&&megRow.t&&megRow.t.length)m.types=megRow.t.slice();
  if(megRow&&megRow.bs&&megRow.bs.atk)m._bsAtk=megRow.bs.atk;                 // WIRE 83, Beat Up
  if(TR){TR.detailschange(m);TR.mega(m,apparent,m.item);}
  const ab=normAb(megaRowAbility(key,megRow));
  m.ability=ab; m.baseAbility=ab;
  const own=sd==='B'?S.actB:S.actA, foes=sd==='B'?S.actA:S.actB;
  applyEntryEffects(m,S.field,own.find(x=>x&&x!==m));
  applyEntryDrops(m,_live(foes));
  /* ROADMAP #81 WIRE 11 -- `onAnyAfterMega`, White Herb's third trigger and the one that only exists
   * because a mega evolution can carry an Intimidate into a slot that had none. Same helper, same
   * whole-field pass, for the same reason: the drop lands on the FOES and the herb is theirs. */
  restoreStatsAll(S.actA,S.actB);
  sf.megaUsed=true;
  MEDSEEN.megaEvolved++;
  if(slot===1)MEDSEEN.megaEvolvedSlotB++;
  if(auto)MEDSEEN.megaEvolvedAuto++;
  return true;
}
/* "Could this body mega right now?" -- the same question megaEvolveNow asks, exported so a caller
 * (engine/game_differential.js, a probe) can decide WITHOUT reimplementing the rule. Two
 * implementations of "can it mega" is exactly the FACTS-ARE-GLOBAL breach CLAUDE.md names. */
function canMegaNow(S,m){
  if(!m||m.fainted||m.curHP<=0)return false;
  if(!megaTargetFor(m))return false;
  const onB=S.actB.indexOf(m);
  if(onB<0&&S.actA.indexOf(m)<0)return false;
  return !((onB>=0?S.sfB:S.sfA).megaUsed);
}
/* THE STEP-WISE BATTLE API (the Battle Tower's spine). battle() was a sealed 20-turn loop, which is
 * right for a rollout and useless for a PLAYER — the Tower needs the same engine to stop each turn
 * and take side A's actions from a human. So the loop body moved verbatim into battleTurn():
 * identical code path, identical rng call order, and battle() is reimplemented on top of it — the
 * gate tests hold because nothing about a rollout changed. actsForA is a Map(mon -> action) built
 * by playerAction(); absent, side A plays itself exactly as before. */
const _live=arr=>arr.filter(m=>m&&!m.fainted&&m.curHP>0);
/* WIRE 125 -- THE DEATH COUNTER FORGOT THE DEAD, ONE TURN AFTER THEY DIED.
 *
 * The end-of-turn recount was `[...act,...bench].filter(x=>x.fainted).length`, and bringIn() -- the
 * one path a replacement arrives through -- does `bench.splice(...)` and then `act[i]=nx`. The
 * fainted body is overwritten in the active slot and is in neither array afterwards. So the count was
 * right for exactly the turn of the death and fell back to ZERO at the end of the next one.
 *
 * WHAT IT COST. Last Respects (19,299 corpus uses, and a move whose entire identity is that it grows
 * as your team dies) read `att._sf.fainted` at every use: correct on the turn the ally died, back to
 * 50 BP forever after. Supreme Overlord's `_fallenStuck` is stamped from the same field at bringIn,
 * so every body that entered later than the turn of a death got an undercount too -- and the deeper
 * into a game, the more of the roster is dead and the wronger it gets, which is precisely the phase
 * both mechanics exist for.
 *
 * THE ROSTER IS THE RIGHT DENOMINATOR and it was already there: battleInit stamps `sf.team` with the
 * full side. Still derived from the live `fainted` flags every turn -- no tally to drift -- and the
 * one case where the roster is absent is COUNTED rather than falling silently back to the arrays that
 * caused this, because a quiet fallback here is indistinguishable from the bug. */
function fallenCount(sf,act,bench){
  if(sf&&sf.team&&sf.team.length)return sf.team.filter(x=>x&&x.fainted).length;
  MEDFAILS.fallenNoRoster++;
  return [...act,...bench].filter(x=>x&&x.fainted).length;
}
/* WIRE 133 -- ONE FORME SWAP, CALLED FROM BOTH MOMENTS.
 *
 * `switchOut` needs it (Zero to Hero fires as the body leaves) and `bringIn` still needs it as a
 * LOUD fallback, so it is one function rather than two copies that would disagree about HP the first
 * time a forme with a different total arrived. Returns the key it swapped to, or null.
 *
 * `|detailschange|IDENT|NAME, L50` is emitted here because the emitter and the swap are one event:
 * Showdown's `formeChange(..., isPermanent = true)` adds the line inside itself
 * (sim/pokemon.ts) and every caller inherits it. The IDENTIFIER does not follow the forme -- see
 * identName() -- so `_ident` is deliberately not touched, which is what keeps every later line on
 * this body naming `Palafin` the way the authority does. */
function formeSwap(mon,becomes,why){
  if(!mon||!becomes)return null;
  /* THROUGH THE FILE'S OWN RESOLVER, not a second hand-rolled one. This used to normalise `becomes`
   * itself and then index MC.mons directly -- the fourth private doorway into that table, which is
   * exactly what tests/test-mc-key.js bans. pasteKey() does the same normalisation AND the flat
   * rescan, so a forme whose table key punctuates differently still resolves instead of silently
   * never transforming. */
  const key=pasteKey(becomes);
  if(!key||mon.name===key)return null;
  const nu=buildMon(key,{});
  if(!nu){MEDFAILS.formeSwapNoRow++;
    if(!MEDFAILS.formeSwapNoRowFirst)MEDFAILS.formeSwapNoRowFirst=becomes+' ('+why+')';
    return null;}
  /* HP IS CARRIED ACROSS EXACTLY WHEN THE TOTAL DOES NOT MOVE, and only rescaled when it does.
   * Palafin and Palafin-Hero are both 100 base HP, so a proportional rescale here would round a body
   * off its own total for no reason at all -- and Showdown's formeChange does not touch `hp` either.
   * The rescale survives for the member whose total DOES move, and it says which case it is for. */
  const frac=mon.curHP/mon.st.hp;
  const sameHP=nu.st.hp===mon.st.hp;
  mon.name=nu.name; mon.types=nu.types; mon.st=nu.st;
  mon.curHP=sameHP?Math.min(mon.curHP,nu.st.hp):Math.max(1,Math.round(nu.st.hp*frac));
  MEDSEEN.formeSwapped++;
  if(TR)TR.detailschange(mon);
  return key;
}
/* WIRE 133 -- MAGIC ROOM, AND IT IS IMPLEMENTED AS A SWAP OF THE ITEM SLOT RATHER THAN AS A GATE.
 *
 * `suppressesItems` (4 corpus uses, and it turns off Focus Sash, the Choice items and every residual
 * item in the format for five turns) had no consumer at all. There were two ways to build it:
 *
 *   a GATE -- a `heldItem(mon, field)` reader that every item lookup calls. That is the right shape
 *   and it is ~40 call sites in this file, every one of which is a chance to miss one silently. A
 *   missed site is a Focus Sash that still saves inside Magic Room, which reads exactly like the
 *   mechanic working.
 *   a SWAP -- while the room is up, the body simply has no item as far as every existing reader is
 *   concerned, and the real item is parked. Four call sites, all of them switch/field events, and a
 *   missed one leaves an item VISIBLY on or off rather than half-applied.
 *
 * The swap is taken, and the cost is stated: Showdown's `ignoringItem()` suppresses the item's
 * EFFECTS while the body still HOLDS it, so a Knock Off landing inside Magic Room removes an item
 * this engine has already parked. The parked slot is cleared with it (`itemRoomForget`) so the two
 * cannot come apart, and the residue is that `-enditem` names nothing. Written down rather than
 * discovered.
 *
 * ROOM-OFF IS THE OTHER HALF AND IT IS THE ONE THAT WOULD ROT SILENTLY: a body must get its item
 * back when the clock runs out, when it leaves the field, and when the battle asks. */
/* WIRE 133 -- DID ANY STAT OF THIS BODY GO UP THIS TURN? Showdown's `statsRaisedThisTurn`, answered
 * from the snapshot battleTurn takes as the turn opens rather than from a flag every raise site has to
 * remember to set. A body with no snapshot (one that arrived mid-turn) answers FALSE, which is right:
 * it has not been on the field long enough to have been boosted on this turn. */
function statsRoseThisTurn(m){
  if(!m||!m.boosts||!m._boostSnap)return false;
  for(const k in m.boosts)if((m.boosts[k]||0)>(m._boostSnap[k]||0))return true;
  return false;
}
function itemRoomHide(m){ if(!m)return; if(m.item&&m._roomItem==null){m._roomItem=m.item;m.item='';MEDSEEN.itemRoomHidden++;} }
function itemRoomShow(m){ if(!m)return; if(m._roomItem!=null){if(!m.item)m.item=m._roomItem;m._roomItem=null;} }
function itemRoomForget(m){ if(m)m._roomItem=null; }
function itemRoomSync(field,bodies){
  const up=field&&field.magicRoom>0;
  for(const m of bodies){ if(!m)continue; if(up)itemRoomHide(m); else itemRoomShow(m); }
}
/* ---- WIRE 141 -- THE TRANSFORM, AND IT IS NOT A FORME SWAP -------------------------------------
 *
 * `formeSwap` above turns a body into a KNOWN forme: Palafin-Hero, Mimikyu-Busted, a mega. Every one
 * of those has a row in the mon table, so the new body is LOOKED UP. Imposter has no such target --
 * Ditto becomes whatever is standing opposite it, which may be any of 318 species carrying any
 * spread, any boosts and any moveset. So the new body is COPIED off the thing it faced, and that is
 * why this is a second function rather than an extra branch in the first one. Checked before it was
 * written, as the roadmap asked.
 *
 * WHICH BODY, AND THIS IS THE HALF NOBODY GUESSES. `data/abilities.ts:2111`:
 *     const target = pokemon.side.foe.active[pokemon.side.foe.active.length - 1 - pokemon.position];
 * In doubles that is the DIAGONAL: a Ditto arriving in slot 0 becomes the foe's slot 1, and in
 * singles it degenerates to the body opposite. The arithmetic is READ OFF THE HANDLER by tag_dex
 * (`transformsOnEntry.diagonal`) rather than typed here, so an engine that copied "the one opposite"
 * is wrong on exactly half the doubles boards and the tag is what says so.
 *
 * WHAT CROSSES AND WHAT DOES NOT (`Pokemon#transformInto`, sim/pokemon.ts:1276):
 *     species, types, EVERY STAT EXCEPT HP, weight, the moveset, and the CURRENT STAT STAGES cross;
 *     HP, max HP, the item and the status DO NOT.
 * The HP line is the one that separates this from a forme swap on the board -- a Ditto that copied
 * a Clefable keeps Ditto's own 123 max HP -- and it is why `st.hp` is carried over the copied line
 * rather than taken from it.
 *
 * THE COPIED ABILITY IS LIVE, WHICH IS NOT OBVIOUS AND IS NOT A GUESS. `transformInto` ends with
 * `setAbility(pokemon.ability, this, null, true, true)` and `setAbility` fires the new ability's
 * `Start` handler whenever the id actually changed (sim/pokemon.ts:1946). A Ditto that copies an
 * Incineroar therefore Intimidates. This engine gets that for free by transforming BEFORE the
 * entry-effect pass the caller already runs, which is why the call site is where it is.
 *
 * THE NEGATIVE IS AN EMPTY OR FAINTED DIAGONAL, and it is counted rather than silent: an entry with
 * nothing to copy is the mechanic behaving, and a counter that could not tell that from a broken
 * transform would be exactly the silent default CLAUDE.md names.
 *
 * DECLARED RESIDUE, written down rather than discovered later:
 *   - NO `|-transform|` LINE IS EMITTED. The protocol side is a separate instrument with its own
 *     claimed-event list, and adding an event that fires only when an Imposter body enters would put
 *     `tests/test-protocol-trace.js` at the mercy of whether a random game happened to contain one.
 *     The engine emitted nothing here before this wire and still does, so nothing regresses.
 *   - PP IS NOT MODELLED IN THIS ENGINE AT ALL, so the copied moves' 5 PP has nowhere to land. The
 *     tag carries `movePP: 5` for the day it does.
 *   - THE HAZARDS BITE FIRST, on the ORIGINAL body's types, because this engine resolves them before
 *     the entry-ability pass. Showdown speed-sorts hazards and abilities into one list, so a body
 *     that transforms into a Rock-weak forme is a case the two engines can still part on.
 *   - THE REFUSALS THAT ARE NOT WRITTEN HERE, each with the reason it is absent rather than left as
 *     a gap somebody has to rediscover. `transformInto`'s guard list is Eternatus-Eternamax (not in
 *     this format), an Illusion on either body (this engine models no Illusion), and a terastallized
 *     Ogerpon or Terapagos (this engine models no Terastallization). The `species.name === 'Ditto'`
 *     refusal reads as if it belonged here and DOES NOT: it is inside a
 *     `currentMod === 'gen1stadium'` branch, so a gen-9 Ditto copying a Ditto is legal and adding
 *     that guard would be a new bug wearing a citation. Read, not remembered. */
function imposterCopy(m,foes,slot){
  if(!m||m.fainted||m.curHP<=0)return false;
  const p=TAGS.param('ability',m.ability,'transformsOnEntry');
  if(!p)return false;
  if(m._transformed){MEDSEEN.transformRefusedAlready++;return false;}
  const arr=foes||[];
  const idx=p.diagonal?(arr.length-1-slot):slot;
  const t=arr[idx];
  /* `transformed && gen >= 2` and `substitute && gen >= 5` are the authority's own refusals; a body
   * that is already somebody else, or hiding behind a doll, cannot be copied. */
  if(!t||t.fainted||t.curHP<=0){MEDSEEN.transformRefusedNoBody++;return false;}
  if(t._transformed||t._sub>0){MEDSEEN.transformRefusedAlready++;return false;}
  const st=Object.assign({},t.st); st.hp=m.st.hp;      // EVERY STAT EXCEPT HP
  m.name=t.name;
  m.types=(t.types||[]).slice();
  m.st=st;
  m.wt=t.wt;
  m._bsAtk=t._bsAtk;                                    // WIRE 83, Beat Up reads the species standing
  m.moves=(t.moves||[]).slice();
  m.boosts=Object.assign({},t.boosts);                  // the CURRENT stages, not a clean slate
  m.ability=t.ability; m.baseAbility=t.ability;
  m._transformed=true;
  MEDSEEN.transformedOnEntry++;
  return true;
}
/* BRING A BENCHED POKEMON IN. Shared by faint replacement and by voluntary/pivot switching.
   WHICH mon: live(bench)[0], the same choice refill() has always made. A rollout needs SOME policy
   and the honest first version reuses the existing one rather than inventing a matchup heuristic
   here -- the engine's job is to make the switch possible, and choosing well is the searcher's.
   Stated because "it picks the first healthy body" is a real limitation, not a detail. */
function bringIn(act,i,bench,foes,sf,field,wanted,carry){
  /* WHICH mon, when the caller knows. live(bench)[0] is the right default for a FAINT replacement --
     nobody chose it -- but a voluntary switch is a choice, and a search that cannot say WHO it is
     bringing in is not evaluating a switch, it is evaluating "leave". Will: switching is
     non-negotiable, and "switch to something" is not the decision; "switch to Amoonguss" is. */
  const nx=(wanted&&bench.indexOf(wanted)>=0&&!wanted.fainted&&wanted.curHP>0)?wanted:_live(bench)[0];
  if(!nx) return null;
  let _announceForme=false;
  /* ZERO TO HERO. Palafin leaves and comes back as Palafin-Hero -- 154 Attack to 233. The engine
   * could BUILD palafin-hero all along; nothing ever transformed anything, so Palafin was a
   * permanently weak body and pivoting it looked pointless. Will asked for 'special AI' to make it
   * switch turn one; it needs no AI, it needs the mechanic, and a 233-Attack body earns the turn on
   * its own. The target forme comes from switchInForme, derived from the species table.
   *
   * WIRE 133 -- THE TRANSFORM ITSELF HAS MOVED TO switchOut(), WHICH IS THE MOMENT THE AUTHORITY
   * USES, and what is left here is the two things that genuinely belong on the RETURN:
   *
   *   1. THE ANNOUNCEMENT. `onSwitchIn` emits `-activate|POKEMON|ability: Zero to Hero` once per
   *      transform, guarded upstream by `heroMessageDisplayed` (data/abilities.ts:5625). This engine
   *      emitted NEITHER line -- not the detailschange on the way out, not this one on the way back.
   *   2. A LOUD FALLBACK. A body that has been out and still carries the base forme means the
   *      switch-out trigger did not run: a seeded mid-game board, or a bug. It is transformed here so
   *      behaviour does not regress, and COUNTED so that a fallback carrying real traffic is readable
   *      instead of looking exactly like the mechanic working.
   *
   * Only on a RETURN: _wasOut is set by switchOut, so the first entry of the battle does not
   * transform, which is the actual rule. */
  if(nx._wasOut){
    const _sf=TAGS.param('ability',nx.ability,'switchInForme');
    if(_sf&&_sf.becomes){
      const _key=pasteKey(_sf.becomes);
      if(_key&&nx.name!==_key){
        MEDFAILS.formeSwapLateOnReturn++;
        if(!MEDFAILS.formeSwapLateOnReturnFirst)MEDFAILS.formeSwapLateOnReturnFirst=nx.ability+' -> '+_key;
        formeSwap(nx,_sf.becomes,'bringIn fallback');
      }
      /* THE MESSAGE IS ONCE PER TRANSFORM, not once per entry -- `heroMessageDisplayed` is reset by
       * the forme change and by nothing else, so a Palafin-Hero that pivots twice more announces
       * nothing on the second and third returns. IT IS ONLY ARMED HERE AND EMITTED BELOW, AFTER THE
       * SLOT IS FILLED: `ident()` reads the body's position on the field, so a line written before
       * `act[i]=nx` prints `??` and lands in MEDFAILS.traceBodyOffField. That is the same trap the
       * `|switch|` line's own comment records. */
      if(nx.name===_key&&!nx._formeAnnounced)_announceForme=true;
    }
  }
  bench.splice(bench.indexOf(nx),1);
  nx._turnsOut=0; nx._fallenStuck=sf.fainted; act[i]=nx;
  /* WIRE 135 -- Payback refuses its double against a body that arrived this turn (`newlySwitched`),
   * so the arrival has to be recorded. Cleared at the top of the next turn with the rest of the
   * per-turn facts. */
  nx._newlySwitched=true;
  /* ROADMAP #81 WIRE 12 -- THE PASSED STATE ARRIVES HERE, ABOVE THE HAZARDS, WHICH IS THE ORDER THE
     AUTHORITY USES. `Pokemon#copyVolatileFrom` is called from `switchIn` (battle-actions.ts:114) and
     `runSwitch` -- the entry-effect pass that fires Stealth Rock, Spikes, Sticky Web and Intimidate --
     is queued AFTER it (:157). The order is not cosmetic: a Baton Pass into Sticky Web must end at
     the passed stage MINUS one Speed, and writing the boosts in afterwards would throw the web's drop
     away on every such entry.
     `carry` is built by switchOut BEFORE it clears the outgoing body, because everything switchOut
     does below that point deliberately erases exactly what this move exists to carry. */
  if(carry)applyPassedState(nx,carry);
  /* AFTER the slot is filled, because the identifier IS the slot -- an emit before `act[i]=nx` would
   * have to look the body up on the bench and would print `??`. `drag` is a caller flag: Showdown
   * distinguishes a chosen switch from a Roar/Dragon Tail one and the differ needs the same split. */
  if(TR)TR.swin(nx,TR.drag);
  /* WIRE 133 -- AND THE FORME'S OWN `-activate`, ONE LINE BELOW THE SWITCH, WHICH IS THE ORDER
   * SHOWDOWN PRODUCES: `onSwitchIn` runs after the entry is announced. Armed above, emitted here,
   * for the reason written there. */
  if(_announceForme){nx._formeAnnounced=true;MEDSEEN.formeAnnouncedOnReturn++;
    if(TR)TR.act(nx,'ability: '+nx.ability);}
  /* WIRE 133 -- MAGIC ROOM REACHES A BODY THAT ARRIVES WHILE IT IS UP. The suppression is a swap of
   * the item slot (see itemRoomSync), and a switch-in is the one path that can put an item on the
   * field after the room went down over an empty one. */
  if(field&&field.magicRoom>0)itemRoomHide(nx);
  /* WIRE 41 -- THE HAZARD BITES ON ENTRY, and it is here rather than in the switch branches because
     bringIn is the ONE path a Pokemon arrives through: a faint replacement, a voluntary switch, a
     U-turn pivot and a Roar drag all come here, and putting it in any one of them would silently
     exempt the other three.
     STEALTH ROCK IS TYPE-SCALED and that is its whole identity -- a quarter of max HP off a
     4x-weak body against a sixteenth off a resist -- so it is asked of mcEff rather than being a flat
     fraction. Spikes is a flat 1/8, 1/6, 1/4 by layer.
     THE FRACTIONS ARE STATED HERE WITH THE REASON, the same call WIRE 31 made for the sandstorm's
     1/16: no artifact this engine reads carries them. The `hazard` param names WHICH hazard and stops.
     WIRE 90 -- TOXIC SPIKES AND STICKY WEB RESOLVE ON ENTRY NOW. The old comment said grounded-ness
     "is not tracked at all", and that was a claim about a FIELD nobody had derived rather than about
     the body: Flying is on `types`, Levitate is on `ability`, an Air Balloon is on `item`, and those
     three ARE the grounded question for this format (Magnet Rise and Telekinesis are volatiles this
     engine does not hold, stated). Found live by the interaction matrix: `uturn -> toxicdebris` laid
     the layer and the pivot's replacement walked in unpoisoned, `.A.active[0].status medi="" sd="psn"`.
     One layer poisons, two badly poison; a GROUNDED POISON TYPE ABSORBS the layers on entry, which is
     the counter-play the mechanic exists for. Sticky Web's -1 Spe goes through applyStatDrop so
     Defiant, Contrary and the Clear Body class react exactly as they do to Intimidate. Spikes now
     read the same grounded test instead of the bare Flying check -- a Levitate body walks over them,
     which is the real rule and was the declared half of the old gap. */
  if(sf&&sf.hz){
    /* WIRE 117 -- through the shared `isGrounded`. This line WAS the predicate, hand-written, and two
       more hand-written copies of it lived elsewhere in this file disagreeing about Iron Ball and
       about Eelevate. One function now answers it for the hazards, the switch branch, the Grassy
       Terrain heal and Psychic Terrain's priority bar. */
    const _grounded=isGrounded(nx);
    if(sf.hz.stealthrock){nx.curHP-=Math.floor(nx.st.hp*mcEff('Rock',nx.types)/8);
      if(TR)TR.dmg(nx,'[from] Stealth Rock');}
    if(sf.hz.spikes&&_grounded){
      nx.curHP-=Math.floor(nx.st.hp/[8,8,6,4][Math.min(sf.hz.spikes,3)]);
      if(TR)TR.dmg(nx,'[from] Spikes');}
    if(sf.hz.toxicspikes&&_grounded&&nx.curHP>0){
      if(nx.types.indexOf('Poison')>=0){sf.hz.toxicspikes=0;if(TR)TR.send(nx,'Toxic Spikes');}
      else if(applyStatus(nx,sf.hz.toxicspikes>=2?'tox':'psn'))MEDSEEN.hazardResolvedOnEntry++;
    }
    if(sf.hz.stickyweb&&_grounded&&nx.curHP>0){
      if(TR)TR.act(nx,'move: Sticky Web');
      /* WIRE 138 -- THE SETTER, recorded when the layer went down (`hzBy`). Showdown's stickyweb
         condition boosts with `this.effectState.source`, so the drop HAS a source and Defiant fires on
         it. A layer with no recorded setter (a seeded mid-game board) passes `undefined`, which keeps
         the pre-wire behaviour and is counted in MEDSEEN.retaliateSourceUnknown. */
      applyStatDrop(nx,'sp',1,'Sticky Web',(sf.hzBy&&sf.hzBy.stickyweb)||undefined);MEDSEEN.hazardResolvedOnEntry++;
    }
    if(nx.curHP<=0){nx.curHP=0;nx.fainted=true;if(nx._sf)nx._sf.fainted++;if(TR)TR.faint(nx);}
  }
  /* WIRE 141 -- BEFORE the entry-effect pass, because the transform REPLACES the ability and the
   * replacement's own Start handler is what that pass runs. Doing it afterwards would fire Imposter's
   * (nothing) instead of the copied body's. */
  imposterCopy(nx,foes,i);
  applyEntryEffects(nx,field,act[1-i]);
  applyEntryDrops(nx,_live(foes));   // WIRE 100a -- membership from `onSwitchInDrop`, not a name
  return nx;
}
/* ---- ROADMAP #81 WIRE 12 -- WHAT A BATON PASS ACTUALLY HANDS OVER --------------------------------
 *
 * Baton Pass and Shed Tail are the only two moves in this format whose `selfSwitch` is a STRING, and
 * the string IS the rule. `Pokemon#copyVolatileFrom(pokemon, switchCause)` (sim/pokemon.ts:1252):
 *
 *     if (switchCause !== 'shedtail') this.boosts = pokemon.boosts;
 *     for (const i in pokemon.volatiles) {
 *       if (switchCause === 'shedtail' && i !== 'substitute') continue;
 *       if (this.battle.dex.conditions.getByID(i).noCopy) continue;
 *
 * So Baton Pass hands over THE BOOSTS AND EVERY COPYABLE VOLATILE, and Shed Tail hands over THE
 * SUBSTITUTE AND NOTHING ELSE -- explicitly not the boosts, which is the difference between the two
 * moves. Both halves come off `passesState.passesBoosts` / `passesState.passesVolatiles`, derived
 * from that same `selfSwitch` field, so neither move is named here.
 *
 * WHICH VOLATILES, AND THE `noCopy` VERDICT BESIDE EACH, read out of the dex rather than guessed --
 * this engine names its volatiles by hand, so the MAPPING is unavoidably a list and it is written out
 * with its authority so a wrong entry is visible:
 *
 *     _sub        substitute        noCopy false  -> carried   (and it is all Shed Tail carries)
 *     _seededBy   leechseed         noCopy false  -> carried
 *     _perish     perishsong        noCopy false  -> carried   (you cannot Baton Pass out of a perish)
 *     _trap       partiallytrapped  noCopy false  -> carried
 *     _healBlock  healblock         noCopy false  -> carried
 *     _noSound    throatchop        noCopy false  -> carried
 *     _ptDmg      curse             noCopy false  -> carried
 *     _yawn       yawn              noCopy TRUE   -> NOT carried
 *     _lock       encore            noCopy TRUE   -> NOT carried (and the Choice lock belongs to the
 *                                                   ITEM, which stays on the body that left)
 *     _sealed     disable           noCopy TRUE   -> NOT carried
 *
 * NOT CARRIED AND STATED RATHER THAN MISSED: a `taunt` seal is held in `_vol`, which this engine
 * treats as one bag rather than per-condition, so copying it would drag Disable and Encore across
 * with it -- both `noCopy: true`. The bag is left behind whole. That is one volatile short of the
 * authority (taunt is copyable) and it is the direction that under-carries, which is the one a search
 * cannot exploit. */
function applyPassedState(nx,c){
  if(!nx||!c)return;
  if(c.boosts){nx.boosts=Object.assign({},c.boosts);MEDSEEN.passesStateBoosts++;}
  let any=false;
  for(const k of ['_sub','_seededBy','_perish','_trap','_healBlock','_noSound','_ptDmg']){
    if(!(k in c))continue;
    nx[k]=c[k];
    if(c[k])any=true;
  }
  if(any)MEDSEEN.passesStateVolatiles++;
}
/* What the OUTGOING body is carrying, read before switchOut erases it. `passesVolatiles` is either
 * the string 'all' (Baton Pass) or an explicit list (Shed Tail's ['substitute']); an unknown value
 * carries NOTHING rather than everything, because over-carrying is the direction that invents state. */
function capturePassedState(out,p){
  if(!out||!p)return null;
  const c={};
  if(p.passesBoosts)c.boosts=Object.assign({},out.boosts);
  const wants=(v)=>p.passesVolatiles==='all'||(Array.isArray(p.passesVolatiles)&&p.passesVolatiles.indexOf(v)>=0);
  if(wants('substitute'))c._sub=out._sub||0;
  if(wants('leechseed'))c._seededBy=out._seededBy||null;
  if(wants('perishsong'))c._perish=out._perish==null?null:out._perish;
  if(wants('partiallytrapped'))c._trap=out._trap||null;
  if(wants('healblock'))c._healBlock=out._healBlock||0;
  if(wants('throatchop'))c._noSound=out._noSound||0;
  if(wants('curse'))c._ptDmg=out._ptDmg||null;
  return c;
}
/* SWITCH A LIVING MON OUT. The outgoing body goes back to the bench, so it can return later and its
   damage persists -- that is the whole point of pivoting. Volatile, one-turn state is cleared on the
   way out because it does not survive a switch in the real game: Protect's consecutive counter, the
   redirection mark and the Leech Seed link all belong to the body's time on the field. Boosts go too.
   Returns the incoming mon, or null when the bench is empty and the switch simply cannot happen. */
function switchOut(act,i,bench,foes,sf,field,wanted,pass){
  const out=act[i]; if(!out||out.fainted) return null;
  if(!_live(bench).length) return null;
  /* ROADMAP #81 WIRE 12 -- CAPTURED HERE, at the top, BEFORE the clearing below. Every line from
     `out.protect=false` down exists to erase what does not survive a switch, and what Baton Pass
     exists to do is survive one; reading after the clear would have handed the replacement a body
     with no boosts and no doll and looked exactly like the mechanic working. */
  const _carry=pass?capturePassedState(out,pass):null;
  out.protect=false; out.tookProtectTurns=0; out._redirect=null; out._seededBy=null;
  /* A charge does not survive leaving the field, and neither does the invulnerability. Left set,
   * a benched mon would come back locked into a move it started two switches ago -- or worse,
   * come back untargetable. */
  out._charging=null; out._invuln=false;
  /* THE STATE ADDED BY WIRES 42-54 LEAVES WITH THE BODY, and each of these is a volatile in the real
     game: the substitute is gone, Throat Chop's silence ends, the Gigaton Hammer lockout ends, the
     recharge is not owed by a body that left, the partial trap releases, and Protean converts again
     on the next entry (`oncePerSwitchIn` is per switch-in, which is what makes the flag resettable
     here and NOT resettable for _disguiseBusted two lines down). */
  out._sub=0; out._noSound=0; out._noRepeat=null; out._noRepeatT=0; out._recharge=false;
  out._trap=null; out._proteanUsed=false;
  /* ROADMAP #92 -- THE CONFUSION LEAVES WITH THE BODY. Showdown clears every volatile in
   * `Pokemon#clearVolatile()` on the way out, and this list erases the substitute, the trap, the
   * charge and the silence BY HAND while never touching `_vol` -- so a confusion written on turn 1
   * would still be on the body two switches later, which is the never-decays defect arriving by a
   * second road. Placed AFTER `capturePassedState` above, deliberately: Baton Pass exists to carry a
   * volatile through a switch and reads the body before any of these lines run.
   * FILED, NOT FIXED HERE: the SAME line would be correct for `taunt`, `encore` and `disable`, which
   * also survive a switch in this engine and should not. There is no failing probe on them --
   * `board_state.js` compares volatiles only on the ACTIVE bodies, so a taunt riding the bench is
   * invisible to every staged board -- and a mechanic is not open work until a probe fails on it. */
  if(out._vol)delete out._vol.confusion;
  /* _disguiseBusted IS DELIBERATELY NOT CLEARED HERE. A Mimikyu that leaves and comes back does not
   * get a second disguise -- the forme change lasts the battle. It sits beside these two because the
   * natural instinct on reading this line is to reset every underscore flag alongside them, and that
   * would silently hand every Mimikyu a free hit per switch-in. */
  /* IT HAS NOW BEEN OUT. Zero to Hero fires on the RETURN, never on the first entry, so the
   * transform needs to know this body has already left once. Written here rather than in bringIn
   * because leaving is the event -- and the first version read this flag without anything ever
   * setting it, which would have made the whole mechanic silently never fire. */
  out._wasOut=true;
  out._lock=null; out._lockT=0; out._flinch=false;
  /* ROADMAP #84 -- a body that leaves the field forgets how its last turn ended, exactly as
     `Pokemon.clearVolatile` does (sim/pokemon.ts:1551). Without this a Stomping Tantrum user could
     pivot out, come back three turns later and still be doubling off a flinch it took before it left. */
  out._mvRes=undefined; out._mvResLast=undefined;
  /* ROADMAP #81 WIRE 12 -- THE PERISH CLOCK LEAVES WITH THE BODY, AND THAT IS THE MOVE'S ONLY
   * COUNTER-PLAY. `perishsong` is an ordinary volatile in the authority, so `Pokemon#clearVolatile`
   * takes it on the way out and a body that switches before zero NEVER FAINTS. Staged against the
   * authority: a Primarina that clicks Perish Song on turn 1 and switches on turn 2 finishes the
   * game alive at 105/155 while its partner, which stayed, keeps counting down.
   *
   * This engine kept `_perish` on the benched body, so it came back mid-count and died to a clock it
   * had already escaped. It was not visible as a bug because a benched mon is not in `[...actA,
   * ...actB]` and so did not TICK -- the clock froze rather than resetting, which reads as working
   * right up until the body returns. Yawn is the same shape and is cleared beside it for the same
   * reason: `yawn` is a volatile and `slp` (the status it eventually applies) is not, so clearing the
   * countdown does not touch a mon that has already fallen asleep. */
  if(out._perish!=null){out._perish=null;MEDSEEN.perishClearedOnSwitch++;}
  out._yawn=null;
  /* ROADMAP #81 WIRE 12 -- and the Curse chip goes with them. `curse` is an ordinary volatile
     (noCopy false, so a Baton Pass DOES carry it -- see applyPassedState) and an ordinary switch
     ends it, which is the counter-play to the Ghost half exactly as it is to Leech Seed above. */
  out._ptDmg=null;
  out.boosts={at:0,df:0,sa:0,sd:0,sp:0,acc:0,eva:0};
  /* WIRE 27 -- healsOnSwitchOut. Regenerator, 845 uses, and the strongest argument for pivoting that
   * exists: leaving the field is a THIRD of max HP back. The engine did nothing at all, so every
   * Regenerator pivot in every rollout was priced as a plain switch.
   *
   * THE TAG OVER-MATCHED AND WAS FIXED BEFORE IT WAS WIRED, which is the whole reason to print a
   * derivation's membership first. `tag_dex.js` read `a.onSwitchOut ? {heal:1/3}`, so Natural Cure
   * (cures status, heals nothing) and Zero to Hero (forme-changes Palafin) both carried a 33% heal
   * they do not have -- 227 corpus uses of invented healing. The derivation now READS the number out
   * of the handler (`pokemon.heal(pokemon.baseMaxhp / 3)`) and membership went 3 -> 1.
   *
   * NOT GATED ON blocksHealing. Heal Block is a volatile on a Pokemon that is standing there; this
   * fires as the body leaves, and leaving is what ends the volatile. Stated rather than assumed,
   * because the natural instinct is to gate every heal in the file at once. */
  {const _hs=TAGS.param('ability',out.ability,'healsOnSwitchOut');
   if(_hs&&_hs.heal&&out.st&&out.curHP>0){
     out.curHP=Math.min(out.st.hp,out.curHP+Math.floor(out.st.hp*_hs.heal));
     if(TR)TR.heal(out,'[from] ability: '+out.ability);}}
  /* WIRE 133 -- THE SWITCH-OUT TRIGGER, AND IT IS A CLASS RATHER THAN THREE ABILITIES.
   *
   * Will, 2026-08-07: *"ALL THE SWITCH OUT ABILITIES ACTIVATE ON SWITCH OUT LIKE REGENERATOR OR
   * NATURAL CURE OR ZERO TO HERO."* He is naming a MOMENT, and this engine had no word for it -- it
   * had one ability that healed here (above), one that forme-changed in bringIn() at the WRONG
   * moment, and one that did not exist at all. Measured against the authority: exactly three
   * abilities in this format declare `onSwitchOut` and they are those three, so the class is
   * complete rather than a first instalment.
   *
   * `switchOutTrigger` carries `does`, DERIVED FROM THE HANDLER in tag_dex.js, and this block
   * dispatches on the shape. The heal member is deliberately left to the WIRE 27 block above rather
   * than moved here: that block is the anchor tests/staged_board.js patches for its red
   * demonstration, and re-homing a working mechanic to make a new one look tidy is how a green test
   * stops testing anything.
   *
   * AN UNRECOGNISED `does` IS COUNTED, NOT IGNORED. A silent default looks exactly like a working
   * feature, and this is precisely the place a fourth ability would land silently. */
  {const _sot=TAGS.param('ability',out.ability,'switchOutTrigger');
   if(_sot){
     MEDSEEN.switchOutTrigger++;
     if(_sot.does==='cure'){
       /* NATURAL CURE, 97 uses, and `data/tags.json` read `["untagged"]` for it. The status is gone
        * the moment the body leaves -- which is why a Toxapex or an Amoonguss can absorb a Will-o-Wisp
        * and pivot it away for free, and why nothing in this engine could represent that.
        * Showdown emits `-curestatus ... [from] ability: Natural Cure|[silent]` (data/abilities.ts
        * :2874). The `[silent]` field is the authority's own and is reproduced rather than dropped;
        * the doubles disambiguation above it (`onCheckShow`) resolves to showCure = true whenever the
        * cured body is the only statused one on its side, which is every case this engine can stage. */
       if(out.status){const _s0=out.status;out.status='';out.frzTurns=0;out.slpTurns=0;out._toxN=0;
         MEDSEEN.switchOutCure++;
         if(TR)TR.cure(out,_s0,'[from] ability: '+out.ability,'[silent]');}
     } else if(_sot.does==='forme'){
       /* ZERO TO HERO FIRES AS THE BODY LEAVES, AND THIS ENGINE FIRED IT ON THE RETURN.
        *
        * `onSwitchOut(pokemon) { ... pokemon.formeChange('Palafin-Hero', this.effect, true); }` --
        * data/abilities.ts:5618. The `-activate` line people see is the SWITCH-IN handler, guarded by
        * `heroMessageDisplayed`, and reading the announcement as the mechanic is exactly how the
        * moment got put in the wrong place. Proven on the staged board before this line was written:
        * after Palafin pivots out, Showdown's party holds `palafinhero` and ours held `palafin` --
        * two engines disagreeing about a benched body, which no HP-reading probe can see.
        *
        * THE MAX HP IS UNCHANGED between the two formes (both 100 base), so the current HP is carried
        * ACROSS EXACTLY rather than rescaled -- a proportional rescale would round a body off its own
        * total for no reason. The rescale is kept for the case where a future member's max HP does
        * move, and it says so. */
       formeSwap(out,_sot.becomes,'switchOut');
     } else if(_sot.does!=='heal'){
       MEDFAILS.switchOutTriggerUnhandled++;
       if(!MEDFAILS.switchOutTriggerUnhandledFirst)
         MEDFAILS.switchOutTriggerUnhandledFirst=out.ability+' does='+_sot.does;
     }
   }}
  out._healBlock=0;
  /* WIRE 133 -- THE BODY TAKES ITS ITEM WITH IT. Magic Room suppresses the item of a body ON THE
   * FIELD; a benched one holds what it held, and a room that expires while it sits there must not
   * leave it empty-handed. */
  itemRoomShow(out);
  bench.push(out);
  return bringIn(act,i,bench,foes,sf,field,wanted,_carry);
}
/* `opts.seeded` starts the battle from a position that is ALREADY UNDER WAY, which is what a rollout
   leaf needs. The difference is entry effects: a fresh battle applies weather/terrain reactions and
   Intimidate as the leads arrive, and a mid-game seed must not, because those already happened in the
   real game. Re-applying Intimidate would drop the foe's Attack a SECOND time on every leaf, in the
   same direction, on every board with an Incineroar -- a silent, systematic bias exactly where the
   format is most crowded. */
/* ONE MEGA PER SIDE. A team may CARRY two stones; it may not have two megas on the field.
 *
 * buildMonFromSet turns a stone-holder straight into its mega body, so a team with two stones was
 * simulated with BOTH megaed -- an illegal board, on 105 of the 231 complete open-sheet teams. 45%
 * of every rollout MILTANK has ever run was reasoning about a side stronger than the rules allow,
 * and nothing caught it because nothing checks that a position is LEGAL.
 *
 * The first stone in team order keeps its mega, matching the live bot, which takes the first mega it
 * is offered. The rest revert to their base forme, which the MC table carries under the name with
 * the -mega suffix stripped -- so this is a lookup, not a hand-written pairing.
 *
 * NOT A DAMAGE-TABLE CHANGE: dmgRange is untouched and board.js prices damage from the LIVE board,
 * where the real game has already said who megaed. This only fixes teams built for SIMULATION. */
function oneMegaPerSide(team){
  if(!team) return team;
  /* THE LEAD KEEPS THE MEGA, not "whichever stone sits first in the packed string".
   *
   * The first version kept team order, which is arbitrary and has a real cost: Will's point is that
   * some Pokemon are only worth bringing AS their mega -- base Meganium is role-dead in a way base
   * Charizard is not -- so reverting the wrong one wastes a slot entirely.
   *
   * "Biggest stat gain" was the obvious heuristic and it was MEASURED AND DISCARDED: every Champions
   * mega is worth about the same on paper (Meganium +104, Charizard +104, Staraptor +101, Tyranitar
   * +102), so it cannot discriminate. The difference is ability and role, which a stat total does
   * not see.
   *
   * The lead is at least tied to how the game is actually played -- you mega what you brought to the
   * front. The RIGHT answer is to make it a search decision, since MILTANK already enumerates every
   * bring and only the two-stone brings would branch; that is written down and not yet built. */
  let seen=false;
  for(let i=0;i<team.length;i++){
    const m=team[i];
    if(!m||!m.name||!/-mega/.test(m.name)) continue;
    if(!seen){ seen=true; continue; }
    /* pasteKey() ALREADY strips the -mega suffix and resolves the base row, so asking it is both the
     * one doorway into MC.mons and strictly less code than doing it here. The previous version wrote
     * out the same suffix strip and then indexed the table by hand -- banned by tests/test-mc-key.js,
     * and it was the second of the two lookups that pushed medicham2 from 5 to 7. */
    let b=null;
    try{ const base=pasteKey(m.name); b=base?buildMon(base,{}):null; }
    catch(e){ b=null; MEDFAILS.megaRevert++; }       // no base row: leave it rather than break it
    if(!b) continue;
    const frac=(m.st&&m.st.hp)?m.curHP/m.st.hp:1;
    m.name=b.name; m.types=b.types; m.st=b.st; m.ability=b.ability;
    m.curHP=Math.max(1,Math.round(b.st.hp*frac));
  }
  return team;
}
function battleInit(teamA,teamB,opts){
  oneMegaPerSide(teamA); oneMegaPerSide(teamB);
  const S={field:{weather:null,weatherT:0,terrain:'',terrainT:0,twA:0,twB:0,tr:0,wgA:false,wgB:false},
    /* one shared death counter per side, handed to every mon by reference */
    /* `side` is stamped here so a body can answer "which Tailwind is mine" without being handed a
       side argument -- WIRE 83's speed ratio is computed inside dmgRange, which is given two bodies
       and a field and nothing else. */
    /* `sc` is the side's NAMED conditions -- keyed by the move that set them, valued in turns
       remaining. ROADMAP #81 WIRE 8: this replaces the two category counters `scrP`/`scrS`, which
       could not answer "is Reflect already up" (Showdown FAILS a duplicate) and announced an
       expiring Aurora Veil as a Reflect and a Light Screen. */
    sfA:{fainted:0,side:'A',sc:{}},sfB:{fainted:0,side:'B',sc:{}},
    actA:[teamA[0],teamA[1]].filter(Boolean),actB:[teamB[0],teamB[1]].filter(Boolean),
    benchA:teamA.slice(2),benchB:teamB.slice(2),turn:0};
  /* the PARTY, by reference, on the same per-side object the death counter already rides. Beat Up
     hits once per eligible party member and dmgRange is handed one body -- WIRE 83. */
  S.sfA.team=teamA.filter(Boolean); S.sfB.team=teamB.filter(Boolean);
  /* ROADMAP #81 WIRE 9 -- the battle state on the same per-side object, so liveFoesOf() can answer
     "who is this body fighting" from the body alone. playerAction is handed one Pokemon and has to
     price a SPREAD click, which names no target; without this the click was a no-op turn. One
     reference, on the object that already carries the party and the death counter by reference. */
  S.sfA._S=S; S.sfB._S=S;
  teamA.forEach(m=>{if(m)m._sf=S.sfA;});teamB.forEach(m=>{if(m)m._sf=S.sfB;});
  /* What each body STARTED holding, so Unburden can tell 'never had one' from 'lost it'. Stamped
   * once here rather than at each of the six places an item is cleared -- a flag set in six places
   * is a flag that will be missed in a seventh. */
  teamA.concat(teamB).forEach(m=>{if(m)m._hadItem=!!m.item;});
  /* ROADMAP #31 -- THE PROTOCOL IDENTIFIER, and it must not follow the forme. See identName(). A
   * body handed in by a probe or a harness may have been built anywhere, so anything missing one
   * gets it here rather than emitting a name that changes under a mega or a Zero to Hero. */
  teamA.concat(teamB).forEach(m=>{if(m&&!m._ident)m._ident=m.name;});
  /* ROADMAP #31 -- ONE MEGA PER SIDE PER BATTLE, and the flag starts SPENT for a side that was handed
   * an already-evolved body. Two builders reach this engine: buildMon leaves a stone-holder in its
   * BASE forme with the capability, and buildMonFromSet (the pasted-team / live-sheet path) resolves
   * "Gengar @ Gengarite" straight to the mega row. Without this line a team could evolve twice --
   * once at build and once in the turn -- which is the rule this format is strictest about.
   * oneMegaPerSide() above still reverts a SECOND pre-built mega; this is the in-battle half. */
  const _pre=t=>t.some(m=>m&&/-mega(-[xyz])?$/.test(String(m.name)));
  S.sfA.megaUsed=_pre(S.sfA.team); S.sfB.megaUsed=_pre(S.sfB.team);
  /* WHO DECIDES TO MEGA. Default: the engine does it itself at the first opportunity, which is what
   * every caller got before this change (a stone-holder was simply BUILT as its mega) and is what
   * Will's standing rule implies -- "it should be truly rare to see a game that didn't have a mega in
   * this format". A caller that drives the choice itself -- engine/game_differential.js, which must
   * issue the SAME choice to both engines -- passes `autoMega:false` and flags the action instead.
   * Both paths are counted apart (MEDSEEN.megaEvolvedAuto) so an auto-mega can never be mistaken for
   * a decision somebody made. */
  S._autoMega=!(opts&&opts.autoMega===false);
  /* ROADMAP #68 -- THE TRACE IS ARMED HERE AND NOWHERE ELSE IS IT DEFAULTED ON. `opts.trace` is any
   * pushable sink (an Array is what callers pass). Absent, `S._trace` is undefined, traceBind() sets
   * TR to null, and every emit site in this file is a falsy test. */
  if(opts&&opts.trace&&typeof opts.trace.push==='function')S._trace=opts.trace;
  const _trPrev=traceBind(S);
  if(!(opts&&opts.seeded)){
    /* Showdown announces the leads before any entry ability fires, in SLOT order (p1a, p1b, p2a,
     * p2b) rather than in the speed order the abilities then resolve in -- read off a real
     * battle.log, where the four `|switch|` lines precede `|-weather|` and `|-ability|`. */
    if(TR){for(const _m of S.actA)if(_m)TR.swin(_m,false);for(const _m of S.actB)if(_m)TR.swin(_m,false);}
    /* WIRE 123 -- THE LEADS' ENTRY ABILITIES RESOLVE IN SPEED ORDER, ACROSS BOTH SIDES.
     *
     * This was ARRAY ORDER: A[0], A[1], B[0], B[1], every effect then every drop. For Intimidate that
     * is invisible -- both drops land and the board is the same either way -- which is exactly why it
     * survived. For the WEATHER it is a live correctness bug with the largest blast radius in the
     * file: `applyEntryEffects` OVERRIDES the standing weather, so the last setter to run owns the
     * sky, and under array order that was always side B's lead. Every damage roll for the rest of the
     * battle is then multiplied by the wrong number.
     *
     * SHOWDOWN'S RULE, read out of Showdown at the pinned commit 20ad99ff: `runSwitch` gathers every
     * simultaneous switch-in and fires ONE field event over all of them
     * (`sim/battle-actions.ts:184`, `this.battle.fieldEvent('SwitchIn', switchersIn)`), and
     * `fieldEvent` speed-sorts its handlers (`sim/battle.ts:794`, `this.speedSort(handlers)`).
     * Faster resolves FIRST, so the SLOWER weather setter wins the field.
     *
     * MEASURED IN THE REFERENCE ENGINE BEFORE A LINE OF THIS CHANGED (L50, Champions SP):
     *     Pelipper 117 Drizzle  v Tyranitar  81 Sand Stream                       -> SAND
     *     Pelipper  85 Drizzle  v Tyranitar 113 Sand Stream                       -> RAIN
     *     Pelipper 117 + its ALLY Torkoal 40 Drought  v Tyranitar 113             -> SUN
     * The third row is why the sort is over ONE list containing both sides rather than per side: a
     * slow ALLY resolves after the opposing lead.
     *
     * ONE IMPLEMENTATION OF "WHO IS FASTER", which is WIRE 118's whole point -- `effSpeed` for the
     * number and `compareTurnOrder` for the rule. No second copy of the comparison is written here.
     *
     * MID-BATTLE SWITCHING IS NOT TOUCHED AND DID NOT NEED TO BE. Showdown queues one `runSwitch` per
     * switch action, so a mid-turn double switch resolves entry abilities in the order the SWITCH
     * ACTIONS ran -- i.e. by the OUTGOING body's speed, not the incoming one's. `bringIn` is called
     * from inside those already-sorted actions and therefore already agrees; measured on four arms
     * (outgoing speed flipped, incoming speed flipped) and it tracked the reference on all four.
     *
     * EFFECTS AND DROPS INTERLEAVE PER BODY rather than running as two passes, because Showdown has
     * one `onStart` handler per Pokemon and it does both. Neither reads the other's output today, so
     * no behaviour turns on it; it is written this way so it stays true when one of them grows. */
    const entrants=[];
    for(const m of S.actA)if(m)entrants.push({mon:m,side:'A',slot:S.actA.indexOf(m),ally:S.actA.find(x=>x&&x!==m),foes:S.actB});
    for(const m of S.actB)if(m)entrants.push({mon:m,side:'B',slot:S.actB.indexOf(m),ally:S.actB.find(x=>x&&x!==m),foes:S.actA});
    for(const e of entrants)e.spe=effSpeed(e.mon,S.field,e.side);
    entrants.sort((x,y)=>compareTurnOrder({spe:x.spe},{spe:y.spe},S.field));
    /* A SPEED TIE IS A COIN FLIP IN SHOWDOWN (speedSort's Fischer-Yates) AND A STABLE ARRAY ORDER
     * HERE, because battleInit is handed no rng and inventing one would move every seeded run in the
     * repo for a reason that has nothing to do with entry abilities. That is an approximation, so it
     * is COUNTED rather than silent -- a non-zero here says some fraction of leads resolved in
     * declaration order because this engine could not break the tie. */
    for(let i=1;i<entrants.length;i++)if(entrants[i].spe===entrants[i-1].spe)MEDFAILS.entryOrderTie++;
    for(const e of entrants){
      /* WIRE 141 -- a LEAD can carry Imposter too, and it resolves inside this same speed-sorted pass
       * because Showdown runs an ability's `onStart` AS its `onSwitchIn` (sim/battle.ts:1018). So a
       * Ditto that leads copies whatever the diagonal foe looks like at the moment its own handler
       * comes up in the order, boosts included. */
      imposterCopy(e.mon,e.foes,e.slot);
      applyEntryEffects(e.mon,S.field,e.ally);
      applyEntryDrops(e.mon,_live(e.foes));   // WIRE 100a -- membership from `onSwitchInDrop`
    }
    /* ROADMAP #81 WIRE 11 -- `onAnySwitchIn`, THE FIRST OF WHITE HERB'S FOUR TRIGGERS. It runs at
     * priority -2, i.e. AFTER every entry ability has had its say, which is exactly what "one pass
     * once the whole lead has landed" reproduces: a herb spent against the first Intimidate would
     * otherwise be gone before the second one arrived. */
    restoreStatsAll(S.actA,S.actB);
  }
  traceRelease(_trPrev);
  return S;
}
/* THE HORIZON IS A PARAMETER NOW, because a SEARCH can exploit it and a rollout alone cannot.
   battleResult scores LIVE BODIES first, so inside a fixed 20-turn cap a side that keeps everything
   alive wins the readout -- and a search maximising that discovers switching back and forth, which
   loses no Pokemon before the horizon. Observed exactly: the live bot alternated between the same
   two switch pairs forever and never attacked.
   S.maxTurns lets a caller buy a horizon long enough that stalling stops paying. The default is
   unchanged, so every measurement taken before this still means what it meant. */
function battleOver(S){
  return S.turn>=(S.maxTurns||20)||_live(S.actA).length+_live(S.benchA).length===0||_live(S.actB).length+_live(S.benchB).length===0;
}
/* WIRE 139 -- A MOVE TARGETS A SLOT, AND FIVE OF THE SEVEN BRANCHES STILL TARGETED A POKEMON.
 *
 * Will, 2026-08-08: *"we gotta target slots, not mons, maybe that would help with things pivoting
 * out"*. He is right, and the code already agreed with him in TWO places and nowhere else: the
 * attack branch has re-aimed by `tgtSlot` since voluntary switching existed, WIRE 137 gave the
 * status branch the same treatment, and the generic-effect branch, the pivot move's own stat drop
 * and the trace announcement were each carrying their own answer or none at all. FACTS ARE GLOBAL
 * (CLAUDE.md): "which body does this move hit" is one question about the game, not a property of
 * whichever branch happens to be resolving it, and three copies of it had already drifted apart.
 *
 * THE AUTHORITY, READ RATHER THAN ASSUMED. `Battle#getTarget` (sim/battle.ts:2434) is called from
 * `runMove` at EXECUTION time with the `targetLoc` the choice named, and its normal path is
 * `pokemon.getAtLoc(targetLoc)` — the occupant of the SLOT, whoever that now is. The body the
 * chooser had in mind is not consulted at all.
 *
 * THE ONE EXCEPTION, WHICH IS THE NEGATIVE CASE. `tracksTarget` returns the ORIGINAL body when it is
 * still active — `move.tracksTarget` (Snipe Shot, and Pursuit against a body being called back) or
 * the user holding Stalwart or Propeller Tail, which Showdown checks BY NAME inside getTarget
 * (:2440) because the abilities implement it through `onModifyMove` and getTarget runs first. A
 * blanket "resolve to whatever is in the slot" would be wrong for those, so the exception is wired
 * with the rule rather than after somebody notices. Exposure in this format: Stalwart 44 uses;
 * Propeller Tail and Snipe Shot have no corpus entry at all. Small, and it is the negative that
 * proves the re-aim is a rule and not a reflex.
 *
 * WHAT THIS DOES NOT DO, SAID OUT LOUD. When the aimed slot is EMPTY — the occupant fainted mid-turn
 * and the replacement has not walked in yet — Showdown falls through to `getRandomTarget`, which in
 * a double redirects a single-target foe move to the OTHER foe. This engine fails the move instead,
 * which is what both existing sites already did. It is COUNTED (`MEDSEEN.reaimSlotEmpty`) rather
 * than left as a silent default, and it is filed rather than fixed here: it is a different rule with
 * a different negative and it must not ride along with this one. */
function tracksTargetOf(mvId,user){
  /* Tag first, name second. `tracksTarget` is derived by tag_dex.js as of 2026-08-08 (from the dex
   * row's own `tracksTarget` for a move, and from a handler that WRITES `move.tracksTarget` for an
   * ability); the names below are the pre-regeneration bridge, exactly as WIRE 3's INTIM_ONLY_BRIDGE
   * and WIRE 113's Simple/Defiant numbers are, and they stop being consulted the moment the artifact
   * carries the tag. */
  if(mvId&&TAGS.has('move',mvId,'tracksTarget'))return true;
  const ab=user?String(user.ability||'').replace(/[^a-z0-9]/g,''):'';
  if(ab&&TAGS.has('ability',ab,'tracksTarget'))return true;
  if(mvId&&String(mvId).replace(/[^a-z0-9]/g,'')==='snipeshot')return true;
  return ab==='stalwart'||ab==='propellertail';
}
/* `quiet` is passed by the TRACE site only, which asks the same question to decide whom to NAME on
 * the `|move|` line. Counting there as well would double every figure below and make a counter that
 * exists to be read a counter that cannot be. */
function reaimToSlot(t,it,actA,actB,mvId,quiet){
  /* -1 means the action named no FOE slot: a self-target, an ally-target or a spread move. Those are
   * resolved elsewhere and must not be dragged onto the foe side by this function. */
  if(!it||it.tgtSlot<0)return t;
  if(t&&tracksTargetOf(mvId,it.mon)&&(actA.indexOf(t)>=0||actB.indexOf(t)>=0)){
    if(!quiet)MEDSEEN.targetTracksBody++;return t;}
  const foes=it.side==='A'?actB:actA;
  const now=foes[it.tgtSlot]||null;
  if(now!==t&&!quiet){ if(now)MEDSEEN.reaimedToSlot++; else MEDSEEN.reaimSlotEmpty++; }
  return now;
}
function battleTurn(S,rng,actsForA,actsForB){
  rng=rng||Math.random;
  if(battleOver(S))return S;
  /* ROADMAP #68 -- bound at entry and released at every exit, so a nested rollout that shares this
   * module cannot inherit somebody else's sink. `_trPrev` is the OUTER binding, restored rather than
   * nulled. */
  const _trPrev=traceBind(S);
  const field=S.field,actA=S.actA,actB=S.actB,benchA=S.benchA,benchB=S.benchB,sfA=S.sfA,sfB=S.sfB;
  const live=_live;
  /* Showdown prints `|turn|N` at the TOP of the turn it is about to play; S.turn is incremented at
   * the bottom of this function, so the turn about to run is S.turn + 1. */
  if(TR)TR.turn(S.turn+1);
  {
    /* WIRE 133 -- `_boostSnap`, AND IT IS A SNAPSHOT RATHER THAN TWELVE INSTRUMENTED CALL SITES.
     *
     * Showdown carries `Pokemon#statsRaisedThisTurn`, written inside `boost()` and cleared at the top
     * of the turn. This engine raises a stat from at least a dozen places -- the setup branch, the
     * ally boost, statChangeInCode, the secondary loop, Contrary inverting a drop, the White Herb
     * restore, Speed Boost, Moody -- and instrumenting each is a dozen chances to miss one silently,
     * which is exactly how a conditional mechanic comes to fire unconditionally.
     *
     * ONE READING, TAKEN ONCE: the stages as the turn opens. "Did a stat rise" is then a comparison,
     * and it cannot be wrong about a raise that happened through a path nobody thought of. */
    /* WIRE 135 -- AND THE THREE FACTS THE `needsTargetToAttack` DOUBLERS READ, on the same clock.
     *   _hitBy          who has damaged this body THIS TURN (Avalanche, Revenge). A Set of bodies,
     *                   not a boolean: Avalanche asks whether THE TARGET hit it, so "was I hit" is
     *                   the wrong question and would double off the partner's Earthquake.
     *   _hurtThisTurn   did this body take damage this turn at all (Assurance).
     *   _acted          has this body already taken its action (Payback).
     *   _newlySwitched  did it arrive this turn (Payback refuses the double against one that did).
     * All four are cleared HERE, at the one point that opens a turn, rather than at the several
     * points that could end one. */
    [...actA,...actB].forEach(m=>{if(m){m.protect=false;m._redirect=null;m._helpingHand=false;
      m._boostSnap=m.boosts?Object.assign({},m.boosts):null;
      m._hitBy=null;m._hurtThisTurn=false;m._acted=false;m._newlySwitched=false;
      /* `_took` clears with the rest: Counter reads damage taken THIS turn, and a counter that
       * remembered last turn's hit would fire off a hit that is over. */
      m._took=null;}});
    field.wgA=false;field.wgB=false;
    /* WIRE 78 -- AIR LOCK / CLOUD NINE. Recomputed at the top of every turn from whoever is standing
       there, because it is a property of the FIELD for as long as a carrier is on it, and a switch or
       a faint changes it. Stored on the field so every reader asks one place. */
    field.wSup=[...actA,...actB].some(x=>x&&!x.fainted&&x.curHP>0&&suppressesWeather(x));
    /* ROADMAP #81 WIRE 12 -- THE AURAS, recomputed on the same line and for the same reason as Air
       Lock above: an `onAny` handler is a property of the FIELD for as long as a carrier is standing
       on it, on EITHER side, and a switch or a faint changes it. Stored on the field so `dmgRange`
       asks one place rather than being handed a roster (ROADMAP #64's open question, answered the
       way WIRE 78 answered it). `undefined` means "no loop has run"; `null` means "a loop ran and
       there is no aura", and auraFor distinguishes the two -- so a pure call still gets its own
       two-body answer instead of silently inheriting a stale one. */
    field.aura=auraStateOf([...actA,...actB]);
    const acts=[];
    /* actsForB exists for the Tower's LOWER floors: a floor-3 guardian clicks random legal moves,
     * so the caller hands the weak actions in rather than this engine growing a "play badly" mode. */
    const mk=(mon,side,foes,ally)=>{if(!mon||mon.fainted||mon.curHP<=0)return;
      const forced=(side==='A'?actsForA&&actsForA.get(mon):actsForB&&actsForB.get(mon));
      /* A CHARGING POKEMON HAS NO CHOICE. The release turn is not a decision in the real game and
         must not be one here, or the engine would let it wind up Solar Beam and then click
         something else -- a free stat boost and no turn ever spent. Target is re-aimed at
         execution, so a stale body is not carried across the turn. */
      let _a;
      if(mon._charging&&MC.moves[mon._charging]){
        const _t=live(foes)[0]||null;
        _a=playerAction(mon,mon._charging,_t,field);
        if(!_a||_a.kind!=='attack'){mon._charging=null;mon._invuln=false;_a=forced||chooseAction(mon,foes,ally,field,side,rng);}
      } else _a=forced||chooseAction(mon,foes,ally,field,side,rng);
      /* WIRE 24 -- THE LOCK BINDS A HANDED-IN ACTION TOO, and until now it only bound a CHOSEN one.
       *
       * chooseAction has honoured _lock since WIRE 18 (Choice items) and WIRE 20 (Encore), so a
       * rollout picking for itself was correct. Every action supplied by a CALLER went straight
       * through: `_a = forced || chooseAction(...)`. So a Choice Scarf holder handed a second,
       * different move simply used it -- turn 1 crunch, turn 2 closecombat, no complaint.
       *
       * WHY THAT MATTERED MORE THAN A ROLLOUT BUG. tests/test-choice-lock.js asserts this rule four
       * ways and PASSES -- on board.js, which removes the illegal moves from the SEARCH's candidate
       * set. So the two engines disagreed about whether a Choice item locks you, each was internally
       * consistent, and both kept working. That is CLAUDE.md's FACTS ARE GLOBAL rule: whether a
       * Choice item locks you is a fact about the game, not a per-model feature, and two
       * implementations of one fact drift invisibly because neither ever fails.
       *
       * A SWITCH IS STILL LEGAL, and that is the half a naive fix gets wrong: being stuck on a bad
       * move is a REASON to leave, so narrowing the move list must never narrow the switch list.
       * A pass stays a pass. Everything else re-aims to the locked move, which is what the real
       * client offers -- it does not let you click the others at all. */
      /* THE BRACKET BELONGS TO THE MOVE YOU SELECTED, NOT THE ONE THE LOCK FORCES.
       * (Will, 2026-08-10: "if you use a prio move but get encored into something you still get prio
       * on it or something like that ... its obscure look it up". He is right, and the authority's
       * own source is explicit about it — `sim/battle-actions.js`:
       *
       *     let baseMove = this.dex.getActiveMove(moveOrMoveName);
       *     const priority = baseMove.priority;              <-- read from the SELECTED move
       *     const pranksterBoosted = baseMove.pranksterBoosted;
       *     if (baseMove.id !== "struggle" && ...) {
       *       const changedMove = this.battle.runEvent("OverrideAction", ...);   <-- Encore swaps HERE
       *       if (changedMove && changedMove !== true) baseMove = ...changedMove;
       *     }
       *
       * `priority` is captured ONE LINE BEFORE the override is allowed to run. So an Encored body
       * moves in the bracket of the move its player chose and executes the move Encore forces —
       * and `pranksterBoosted` is captured on the same line, so a Prankster boost carries across too.
       *
       * THIS ENGINE HAD IT BACKWARDS. `_pri` is computed from `acts` AFTER this rewrite, so the lock's
       * move decided the bracket. WIRE 118's comment claims the bracket is frozen "exactly as Showdown
       * resolves an action's priority when it is queued" — TRUE for every action except a locked one,
       * and false precisely here. `_selMv` records what was chosen before the rewrite; `actionPriority`
       * reads it. Nothing else about the action changes: the MOVE executed is still the locked one. */
      const _selMv=(_a&&_a.kind==='attack'&&_a.move&&_a.move.id)||(_a&&_a.mv)||null;
      if(_a&&mon._lock&&_a.kind!=='switch'&&_a.kind!=='pass'
         &&!(_a.kind==='attack'&&_a.move&&_a.move.id===mon._lock)){
        const _lk=targetForMove(mon,mon._lock,live(foes),field);
        if(_lk)_a={kind:'attack',move:_lk,target:_lk.target};
      }
      /* AND DISABLE BINDS A HANDED-IN ACTION TOO — the same WIRE 24 rule with the opposite sign. A
       * caller that hands in the disabled move is re-asked rather than obeyed; chooseAction has the
       * move filtered out, so it cannot come back with it. Only fires on a FORCED action, because a
       * chosen one was already picked from the filtered list. */
      if(_a&&_a.kind==='attack'&&_a.move&&mon._vol&&mon._vol.disable>0&&mon._sealed&&_a.move.id===mon._sealed)
        _a=chooseAction(mon,foes,ally,field,side,rng);
      /* WHICH SLOT the click was aimed at, captured now while the board is still the pre-switch one.
         A move targets a SLOT, not a body: if the intended target switches out, the Pokemon that
         replaces it takes the hit. Without this the outgoing mon stayed targetable from the bench and
         a switch neither dodged the attack nor handed it to the replacement -- it hit a Pokemon that
         was no longer on the field. Only surfaced once voluntary switching existed to expose it. */
      /* `_selMv` rides along so `actionPriority` can read the SELECTED move rather than the locked
       * one — see the block above. It is null whenever nothing was overridden, and the priority
       * function falls back to the executed move in that case, so every ordinary action is unchanged. */
      acts.push({mon,side,a:_a,_selMv,tgtSlot:_a&&_a.target?foes.indexOf(_a.target):-1});};
    mk(actA[0],'A',actB,actA[1]);mk(actA[1],'A',actB,actA[0]);mk(actB[0],'B',actA,actB[1]);mk(actB[1],'B',actA,actB[0]);
    /* what was actually clicked this turn, both sides, for observers (the Tower's local game
     * record). A summary, not the live objects -- nothing outside can mutate the turn. */
    S.lastActs=acts.map(it=>({side:it.side,name:it.mon.name,kind:it.a.kind,
      move:(it.a.move&&it.a.move.id)||it.a.mv||null,
      target:(it.a.target&&it.a.target.name)||null}));
    /* WIRE 101 -- QUICK CLAW (`fractionalPriority`): 20% of turns the holder jumps its own priority
       bracket, decided ONCE per turn per holder before the sort (a roll inside a comparator would be
       re-drawn per comparison). The rng is consumed only for a body that actually carries the tag, so
       every existing seeded probe draws the same stream. Trick Room does not flip it -- the claw wins
       within the bracket under either ordering, which is the real rule. */
    for(const it of acts){
      const _fp=TAGS.param('item',it.mon.item,'fractionalPriority');
      it._qc=(_fp&&_fp.chance&&rng()<+_fp.chance)?1:0;
    }
    /* WIRE 118 -- the bracket is FROZEN here, once, exactly as Showdown resolves an action's priority
       when it is queued and never again. The comparator, the Trick Room inversion and the tie now
       live in compareTurnOrder/sortTurnOrder at module scope, next to movePriority and effSpeed,
       because board.js calls the same rule. See the block above effSpeed. */
    for(const it of acts) it._pri=actionPriority(it,field);
    sortTurnOrder(acts,field,rng);
    /* WIRE 119 -- THE SHIELD IS RAISED BEFORE ANY MOVE RESOLVES, so a body Taunted on an EARLIER turn
     * would otherwise still get its Protect up: the gate above the kind dispatch fires too late for
     * this pre-pass. It is asked here as well, and only here, because a body Taunted THIS turn is
     * correctly still allowed to Protect -- Protect is +4 and Taunt is +0 (+1 under Prankster), so
     * the shield has already resolved by the time the Taunt lands, which is the real rule. A refused
     * shield falls into the same branch as any other action and resets the stall counter.
     *
     * ROADMAP #81 WIRE 2 -- MOVED BELOW sortTurnOrder, AND THE POSITION IS NOW PART OF THE MECHANIC.
     * It used to sit above the priority pass, which was fine while the only question a shield asked
     * was "how many in a row"; Showdown asks a second question that only the RESOLUTION ORDER can
     * answer, so the list has to be sorted before the shields go up. Nothing between the two points
     * reads `protect` or `tookProtectTurns` -- actionPriority takes Protect's +4 from the move table
     * and the Quick Claw roll is per-item -- so this is a move, not a re-ordering of the mechanic.
     * The RNG STREAM does shift for a turn that has BOTH a Quick Claw holder or a speed tie AND a
     * repeated shield, because those draws now happen first. The census is the guard on that.
     *
     * THE TWO RULES BELOW ARE SHOWDOWN'S `stall` VOLATILE, WHICH THIS ENGINE HAD ONLY HALF OF.
     * Every shield in data/moves.ts opens with the same line -- protect, detect, spikyshield,
     * kingsshield, banefulbunker, and the two Guards:
     *
     *     onPrepareHit(pokemon) { return !!this.queue.willAct() && this.runEvent('StallMove', pokemon); }
     *     onHit(pokemon)        { pokemon.addVolatile('stall'); }
     *
     * 1. THE COUNTER IS DELETED THE INSTANT THE ROLL FAILS. data/conditions.ts, `stall`:
     *    `const success = this.randomChance(1, counter); if (!success) delete pokemon.volatiles['stall'];`
     *    so the shield AFTER a failed one is a guaranteed 100% again. This engine incremented on every
     *    attempt and never came back down, so a body that lost one roll kept decaying 1/27, 1/81 --
     *    and a search that reads those odds was pricing a click that does not exist. The counter is
     *    added by `onHit`, i.e. by consecutive USE and not by consecutive BLOCKING; that is WIRE 1's
     *    correction and it is unchanged here. `counterMax: 729` is 3^6, so the depth caps at 6.
     * 2. A SHIELD FAILS OUTRIGHT WHEN ITS USER HOLDS THE LAST ACTION OF THE TURN.
     *    `BattleQueue.willAct()` (sim/battle-queue.ts:310) scans the actions STILL IN THE QUEUE behind
     *    the current one and returns the first `move`/`switch`/`instaswitch`/`shift`; the shield fails
     *    if there is none. It is SHORT-CIRCUITED before `runEvent('StallMove')`, so a shield that
     *    moves last draws no die and does not touch the counter at all. In this engine the queue is
     *    `acts`, now sorted, so "is anything left to act" is "is there an entry after this index".
     *    Switches sit at priority 6 and shields at +4, so a switch is never behind a shield here --
     *    which is the same answer Showdown gives, because its switches resolve at order 103 and are
     *    off the queue before any move runs.
     *    A FAILURE ON THIS GATE ALSO LEAVES THE BODY FRESH NEXT TURN. `stall` carries `duration: 2`
     *    and is only refreshed by a successful use, so a turn that fails here lets it expire at the
     *    end of that turn -- indistinguishable from a reset, which is what is written.
     * ONE THING THIS DOES NOT MODEL, STATED: a mega evolution mid-turn re-sorts the tail (see the
     * mega block below), so a shield's position could in principle change after this pre-pass ran.
     * It can only move WITHIN the +4 bracket, and only when the last two actions of the turn are both
     * shields and one of them megas. Not modelled, not silently: it is written here. */
    for(let i=0;i<acts.length;i++){
      const it=acts[i];
      if(it.a.kind==='protect'&&!volatileForbidsMove(it.mon,actionMoveId(it.a))){
        if(i+1>=acts.length){it.mon.protect=false;it.mon.tookProtectTurns=0;}   // willAct() === null
        else{
          const _ok=(it.mon.tookProtectTurns===0||rng()<Math.pow(1/3,it.mon.tookProtectTurns));
          it.mon.protect=_ok;
          it.mon.tookProtectTurns=_ok?Math.min(6,it.mon.tookProtectTurns+1):0;
        }
        it.mon._lastMove=it.a.mv||'protect';it.mon._protectMove=it.a.mv||null;
      }
      else if(it.a.kind==='wideguard'&&!volatileForbidsMove(it.mon,actionMoveId(it.a))){if(it.side==='A')field.wgA=true;else field.wgB=true;it.mon.tookProtectTurns=0;}
      else it.mon.tookProtectTurns=0;
    }
    /* WIRE 118 -- "HAS THIS BODY ALREADY ACTED?" IS NOW "HAS IT RESOLVED?", AND THAT IS THE POINT.
     * A flinch only stops a body that has not yet moved. That used to be an INDEX into a list frozen
     * at the top of the turn (`actedAt`), which stops meaning anything once the list can re-sort
     * under it. A set of the actions still outstanding is the same question asked directly, and it
     * keeps the half the index was quietly also answering: a body with NO action this turn (dragged
     * in by Roar, or switched in mid-turn) is not in this set either, so it cannot be given a flinch
     * that would then leak into the next turn. */
    const unresolved=new Set(acts.map(it=>it.mon));
    /* WIRE 82 -- THE PRE-TURN MOVE CLASS. Will: "BEAK BLAST IS LIKE SPICY SPRAY FOCUS PUNCH OR
     * SOMETHING." He is naming a real class: Focus Punch and Beak Blast (and Shell Trap, which this
     * format bans) commit at the START of the turn and then react to what happened while they waited.
     * Both were UNCONDITIONAL ATTACKS here -- Focus Punch landed after being hit, and Beak Blast's
     * whole reason for existing, the burn, did not happen at all.
     *
     * THE SHIELD GOES UP BEFORE ANY MOVE RESOLVES, which is the entire mechanic and is why this sits
     * above the resolution loop rather than in the attack branch: by the time Beak Blast's own -3
     * priority action comes round, everything that could touch it has already gone.
     *
     * From `preTurnShield`, derived from Showdown's `priorityChargeCallback` plus the volatile's own
     * onHit. No move is named here; `mode`, `trigger` and `status` all come out of the tag. */
    for(const it of acts){
      const _pid=it.a&&it.a.kind==='attack'&&it.a.move&&it.a.move.id;
      const _pt=_pid&&TAGS.param('move',_pid,'preTurnShield');
      it.mon._preTurn=_pt?{id:_pid,p:_pt,hit:false,hitSide:null}:null;
    }
    /* WIRE 118 -- DYNAMIC SPEED. THE REMAINING ACTIONS ARE RE-SORTED BEFORE EACH ONE RESOLVES, which
       is what the official engine does after every action (sim/battle.ts, gen >= 8: "speed is updated
       dynamically so update the queue's speed properties and sort it"). Only the tail [i..] is
       touched: what has already resolved cannot be reordered, and every index below i stays valid.
       Costs one sort of at most four keys per action and consumes no RNG -- see sortTurnOrder. */
    /* ROADMAP #31 -- THE MEGA PHASE, AND ITS POSITION IN THE TURN IS THE MECHANIC.
     *
     * Showdown queues mega evolution at ORDER 104: strictly after `switch` (103) and strictly before
     * every move (200). This engine has no separate order key -- it orders everything through one
     * comparator -- and a BARE switch sits at priority 6, above every move priority in the format
     * (Helping Hand's +5 is the ceiling). So "after the switches, before the moves" is exactly "the
     * first time an action with priority below 6 comes up", which is where this fires. A pre-pass
     * before the loop would be WRONG and observably so: a Pelipper switching in sets rain at 103 and
     * a Charizard megaing into Drought at 104 must overwrite it with sun, not the other way round.
     *
     * AND THE TAIL IS RE-SORTED AFTERWARDS, because THE MEGA'S NEW SPEED GOVERNS THIS TURN'S MOVE
     * ORDER. Showdown gets this for free: gen >= 8 re-sorts the queue before every `move` action, so
     * the sort that decides who attacks first happens AFTER the megaEvo actions have run. This
     * engine's WIRE 118 re-sort only fires for `actIdx > 0`, so a mega on the very first action would
     * have left the whole turn ordered by PRE-mega speed -- a Mega Manectric (135 base Speed against
     * 105) moving second, which is the kind of divergence that reads as unattributable turn-order
     * noise later. */
    /* ROADMAP #81 WIRE 7 -- the Update pass. See the call site at the top of the action loop. */
    const _updateAll=()=>{
      const _all=[];
      for(const x of actA)if(x&&!x.fainted&&x.curHP>0)_all.push({m:x,s:'A'});
      for(const x of actB)if(x&&!x.fainted&&x.curHP>0)_all.push({m:x,s:'B'});
      for(const e of _all)e.spe=effSpeed(e.m,field,e.s);
      _all.sort((p,q)=>q.spe-p.spe);
      for(const e of _all){berryCureUpdate(e.m);berryPinchUpdate(e.m,e.s==='A'?actB:actA);}
      /* ROADMAP #81 WIRE 11 -- `onAnyAfterMove` AND `onAnySwitchIn` FOR THE MID-TURN CASES, both of
       * White Herb's remaining triggers, landed on the pass that already runs after every action.
       * This is where the Unburden half becomes real: `_updateAll` runs BEFORE each action and the
       * turn order of the remaining actions is re-sorted immediately after it (WIRE 118's dynamic
       * speed), so a herb spent here changes who moves next WITHIN the same turn -- which is the
       * whole mechanic. At the residual the item came off after the order had already been spent.
       *
       * NOT INSIDE THE SORTED LOOP ABOVE on purpose: that loop is `eachEvent('Update')`, a different
       * Showdown event with its own ordering, and the herb is not one of its handlers. Same schedule,
       * separate pass, so a future change to either does not silently move the other. */
      restoreStatsAll(actA,actB);
    };
    let _megaPhaseDone=false;
    const _megaPhase=(from)=>{
      if(_megaPhaseDone)return;
      _megaPhaseDone=true;
      /* TWO MEGAS IN ONE TURN RESOLVE IN SPEED ORDER, AND ONLY IN SPEED ORDER.
       *
       * The first version of this walked `acts` in the order the turn had already been sorted into,
       * which is (priority, speed) -- and megaEvo actions carry NO priority. `sim/battle.ts
       * comparePriority` breaks the tie at order 104 on `speed` alone, so a slow body clicking
       * Protect (+4) megaed before a fast body clicking an attack. The differential caught it as
       * `|detailschange|p1b: Glimmora-Mega <> |detailschange|p2b: Drampa-Mega` -- the two engines
       * evolving the same pair of bodies in opposite orders.
       *
       * THE SPEED IS THE PRE-MEGA ONE, which is not an approximation: Showdown sorts its queue once
       * at the top of the turn and re-sorts only when the NEXT action is a `move` (gen >= 8), so the
       * megaEvo actions keep the order the un-evolved bodies were sorted into. The re-sort of the
       * remaining tail below is what gives the new Speed the move order.
       *
       * ONE COMPARATOR, WIRE 118's -- `compareTurnOrder` carries the Trick Room inversion, and
       * battleInit's entry-ability sort is the same two lines for the same reason. */
      let any=false;
      const _cand=[];
      for(let k=from;k<acts.length;k++){
        const a=acts[k];
        if(!a||!a.mon||!a.a)continue;
        const want=!!a.a.mega;
        /* A BODY WITH NO ACTION DOES NOT MEGA under the auto policy. Showdown never offers the choice
         * without a move, and `pass` here is "this slot is doing nothing", which is not a click. */
        if(!want&&!(S._autoMega&&a.a.kind!=='pass'))continue;
        _cand.push({mon:a.mon,want,side:S.actB.indexOf(a.mon)>=0?'B':'A'});
      }
      /* AN EXPLICIT CHOICE OUTRANKS THE AUTO POLICY ON ITS OWN SIDE, and it is done by REMOVING the
       * auto candidates rather than by sorting them last -- because there is one mega per side, and a
       * sort that put the caller's body second would let the faster auto body silently spend it. The
       * ORDER of what remains is then purely speed, which is the rule above. */
      const _asked=new Set(_cand.filter(c=>c.want).map(c=>c.side));
      const _run=_cand.filter(c=>c.want||!_asked.has(c.side));
      for(const c of _run)c.spe=effSpeed(c.mon,field,c.side);
      _run.sort((x,y)=>compareTurnOrder({spe:x.spe},{spe:y.spe},field));
      for(const c of _run)if(megaEvolveNow(S,c.mon,!c.want))any=true;
      if(!any)return;
      const _rest=sortTurnOrder(acts.slice(from),field,rng);
      for(let _k=0;_k<_rest.length;_k++)acts[from+_k]=_rest[_k];
    };
    for(let actIdx=0;actIdx<acts.length;actIdx++){
      if(!_megaPhaseDone&&acts[actIdx]&&(acts[actIdx]._pri||0)<6)_megaPhase(actIdx);
      if(actIdx>0&&actIdx<acts.length-1){
        const _rest=sortTurnOrder(acts.slice(actIdx),field,rng);
        for(let _k=0;_k<_rest.length;_k++)acts[actIdx+_k]=_rest[_k];
      }
      /* ROADMAP #81 WIRE 7 -- `eachEvent('Update')`, THE THING THAT MAKES A BERRY A BERRY.
       *
       * Showdown runs it after every action (sim/battle.ts:2858, gen >= 5). Running it at the TOP of
       * each iteration -- so before action k means after action k-1 -- plus once below the loop is the
       * same schedule with no restructuring: the loop body carries ~30 `continue`s and a call at the
       * bottom would be skipped by every one of them, which is the silent-default shape.
       *
       * BEFORE ACTION 0 IS A NO-OP AND IS LEFT IN RATHER THAN GUARDED. Showdown skips the update after
       * `start`; here, turn 1 opens with everything at full HP and unstatused, and every later turn
       * opens with the previous residual's own calls already made. So the first call can only fire on
       * a body that entered mid-turn last turn -- which is a case Showdown updates too.
       *
       * SPEED ORDER, FASTEST FIRST, AND NOT THROUGH TRICK ROOM: `eachEvent` sorts with a bare
       * `(a, b) => b.speed - a.speed`, so the field's inversion does not apply to it. */
      _updateAll();
      const it=acts[actIdx];const m=it.mon;
      /* Marked BEFORE the body runs, so a move cannot flinch the Pokemon using it. */
      unresolved.delete(m);
      /* WIRE 135 -- `_acted` is the SAME fact `unresolved` carries, written onto the body so that a
       * pure `dmgRange` call can read it. Payback asks "has the target already moved" and dmgRange is
       * handed two bodies and a field and nothing else -- it has no queue to ask. Written here, on the
       * one line that already answers the question, so the two cannot come apart. */
      m._acted=true;
      if(m.fainted||m.curHP<=0)continue;
      /* ROADMAP #68 -- `|cant|POKEMON|REASON`, and the REASON strings are Showdown's own, read off the
       * add() calls in data/conditions.ts (par :42, slp :76, frz :103, flinch :203, recharge :369) and
       * data/mods/champions/conditions.ts, which overrides par and frz for this format. A refusal that
       * emits nothing is indistinguishable in the stream from a body that had no action. */
      /* ROADMAP #84 -- AND EACH OF THESE RECORDS *WHICH KIND* OF NON-MOVE IT WAS.
       *
       * `sim/battle-actions.ts:255` splits "my move did not happen" in two, and says so in a comment
       * that names the move it matters for:
       *     false indicates that this counts as a move failing for the purpose of calculating
       *       Stomping Tantrum's base power
       *     null indicates the opposite, as the Pokemon didn't have an option to choose anything
       * `pokemon.moveThisTurnResult = willTryMove` -- the raw return of the BeforeMove event.
       *
       * EVERY MEMBER BELOW WAS READ OFF ITS OWN HANDLER RATHER THAN GROUPED BY INTUITION, because the
       * split is NOT "was I stopped" versus "did I choose":
       *     flinch     conditions.ts:205  return false
       *     par        conditions.ts:43   return false
       *     frz        conditions.ts:104  return false
       *     slp        conditions.ts:76   return false   (a sleepUsable move returns undefined, which
       *                                                   leaves the event's relayVar true and is not
       *                                                   this branch at all)
       *     recharge   conditions.ts:372  return NULL    -- the one that does not count
       *     Throat Chop / Taunt / Disable  moves.ts      return false
       * Nothing here is a judgement; each is one line in the authority. */
      /* ROADMAP #92 -- THE ORDER OF THESE FIVE IS `onBeforeMovePriority`, WHICH IS AN AUTHORITY FACT
       * AND WAS WRONG HERE. A HIGHER NUMBER RUNS FIRST:
       *     slp        conditions.ts:64    priority 10
       *     frz        conditions.ts:96    priority 10
       *     flinch     conditions.ts:201   priority  8
       *     confusion  conditions.ts:179   priority  3
       *     par        conditions.ts:38    priority  1
       * This loop ran flinch FIRST, so a body that was ASLEEP AND FLINCHED consumed the flinch and
       * never ticked its sleep counter -- and the sleeper then woke a whole turn late. Not a counter
       * curiosity: measured on a staged board (tests/staged_status_counters.js
       * `sleep-counter-under-a-flinch`, Fake Out and Spore into the same Snorlax on one turn), the
       * two engines part on `status`, on `status_counter` AND on `boosts.atk` -- Showdown's Snorlax
       * wakes on turn 3 and gets a Swords Dance that ours does not get until turn 4. THE CONTROL WITH
       * THE FAKE OUT REMOVED IS IDENTICAL ON THE SAME RELEASE, so the ordering is the whole cause.
       * PAR MOVING BELOW SLP AND FRZ CHANGES NOTHING TODAY -- a body cannot hold two major statuses --
       * and it moves anyway, because a list that is four fifths of the authority's list is the shape
       * that comes apart the day somebody adds the fifth member. */
      if(m.status==='frz'){m.frzTurns=(m.frzTurns||0)+1;if(m.frzTurns>=3||rng()<0.25){m.status='';if(TR)TR.cure(m,'frz');}else {m._mvRes=false;if(TR)TR.cant(m,'frz');continue;}}   // Champions: 25%/attempt, guaranteed thaw turn 3
      if(m.status==='slp'){m.slpTurns=(m.slpTurns||0)+1;if(m.slpTurns>=3||(m.slpTurns===2&&rng()<1/3)){m.status='';if(TR)TR.cure(m,'slp');}else {m._mvRes=false;if(TR)TR.cant(m,'slp');continue;}}   // Champions: 33% wake turn 2, 100% turn 3
      /* `_flinch` is cleared for every active body at the end of the turn (the `forEach` below the
       * action loop), so a flinch that sleep got to first does NOT survive into the next turn -- which
       * is Showdown's `duration: 1` on the volatile, arriving by a different road. */
      if(m._flinch){m._flinch=false;m._mvRes=false;if(TR)TR.cant(m,'flinch');continue;}
      /* ONLY A MOVE RUNS `onBeforeMove`. A PASS AND A VOLUNTARY SWITCH ARE NOT MOVES, and Showdown
       * resolves a switch in a different phase entirely -- so a confused body that pivots does NOT
       * spend a turn of its clock. Measured on the probe that carries this row: with the tick applied
       * to a passing body, the CONTROL arm (a body standing still while nobody moves) lost its
       * confusion in two turns of doing nothing, which is not a game anybody plays.
       * FILED, NOT FIXED HERE: `slp`, `frz` and the flinch above are on the same footing and are NOT
       * guarded, so a sleeping body still ticks its counter on a pass and -- worse -- a `continue`
       * there means it CANNOT VOLUNTARILY SWITCH AT ALL. That is a pre-existing turn-resolution bug
       * with no failing probe on it, and changing how every switch resolves is not a line to add
       * beside a confusion fix. */
      if(!(it.a&&(it.a.kind==='pass'||it.a.kind==='switch'))
         &&confusionBeforeMove(m,rng)){m._mvRes=false;continue;}
      if(m.status==='par'&&rng()<0.125){m._mvRes=false;if(TR)TR.cant(m,'par');continue;}   // Champions: 12.5% full-para (was 25%)
      const a=it.a;
      /* WIRE 43 -- THE RECHARGE TURN. Hyper Beam is 1,627 corpus clicks and Giga Impact 29, and both
         were free: the engine played the move and then let the user act again next turn, so the
         single largest drawback in the format did not exist. The flag is set when the move lands and
         SPENDS the following turn whatever the caller or the chooser asked for -- which is the WIRE 24
         rule again, since a rollout driven from outside supplies its own actions. Cleared as it is
         spent, so the cost is exactly one turn. */
      /* ROADMAP #84 -- `_mvRes = null`, NOT false, and this is the whole point of the split. The
         recharge handler returns null (conditions.ts:372) because the Pokemon never had an option to
         choose anything, so a Stomping Tantrum thrown the turn AFTER a Hyper Beam recharge stays at
         75 while one thrown after a Fake Out flinch is 150. Written as an explicit null rather than
         left undefined so the three states are distinguishable in the state itself. */
      if(m._recharge){m._recharge=false;m._mvRes=null;m._lastMove=m._lastMove||null;if(TR)TR.cant(m,'recharge');continue;}
      /* WIRE 77 -- THE THROAT CHOP SILENCE APPLIES TO EVERY KIND OF ACTION, not only to a damaging
         one. WIRE 45 put the gate inside the attack branch and WIRE 26's menu filter put it in
         chooseAction, and both are one CLASS of action: ROAR is a sound move that resolves down the
         `phaze` branch, and a silenced body phazed anyway. Found by the generated matrix as
         `roar -> throatchop`, where the reference engine left the target on the field and medicham2
         had already dragged it out.
         Placed HERE, above the kind dispatch, so a sound move of ANY kind is refused once -- the
         alternative is a copy of this line in every branch, which is exactly the shape that let Roar
         through. It binds a caller-SUPPLIED action too, which is the WIRE 24 rule. */
      if(m._noSound>0&&(a.mv||(a.move&&a.move.id))&&TAGS.has('move',a.mv||a.move.id,'sound')){
        m._lastMove=a.mv||a.move.id;m._mvRes=false;   // ROADMAP #84 -- throatchop's onBeforeMove returns false
        /* `cant|POKEMON|move: Throat Chop` with NO move argument -- data/moves.ts:19407, which is the
         * one refusal in this family that does not name the refused move. */
        if(TR)TR.cant(m,'move: Throat Chop');
        continue;
      }
      /* WIRE 119 -- TAUNT AT EXECUTION TIME, AND THIS IS WIRE 77's PLACE FOR WIRE 77's REASON.
       * Showdown answers Taunt in TWO handlers off one condition: `onDisableMove` takes the status
       * moves off next turn's menu, and `onBeforeMove` FAILS a status move that was already chosen
       * when the Taunt lands in the same turn. The menu filter is in chooseAction (illegalMoveNow);
       * this is the other half, and it is the half every one of the twelve `X -> taunt` rows in the
       * interaction matrix was hitting -- the holder clicks Taunt, moves first, and medicham2 landed
       * Hypnosis / Stun Spore / Decorate / Screech / Disable / Feather Dance / Strength Sap /
       * Trick-or-Treat anyway.
       *
       * ABOVE THE KIND DISPATCH, because Taunt refuses a status move of ANY kind: `affect` (Charm),
       * `status` (Will-O-Wisp), `setup` (Swords Dance), `tail` (Tailwind), `haze`, `hazard`, `sub`
       * and `phaze` (Roar) are all status moves in this engine and all of them are separate branches.
       * A copy of this line per branch is exactly the shape that let Roar through Throat Chop.
       *
       * `_lastMove` IS DELIBERATELY NOT SET, unlike WIRE 77 one line above. Showdown's `runMove`
       * calls `pokemon.moveUsed()` -- the only writer of `lastMove` -- AFTER the BeforeMove event, so
       * a move refused by Taunt never becomes the last move and cannot be what an Encore repeats. */
      {
        const _fid=actionMoveId(a);
        if(_fid&&volatileForbidsMove(m,_fid)){ MEDSEEN.tauntRefusedAtExecution++;
          m._mvRes=false;   // ROADMAP #84 -- taunt's and disable's onBeforeMove both return false
          /* `cant|POKEMON|move: Taunt|MOVE` -- data/moves.ts:19001. The volatile is named from the
           * forbid table rather than typed, so a second category-forbidding volatile arrives labelled
           * with its own name instead of Taunt's. */
          if(TR)TR.cant(m,'move: '+_traceForbidder(m),_fid);
          continue; }
      }
      /* ROADMAP #68 -- `|move|USER|MOVE|TARGET`, AND ITS POSITION IS THE MECHANIC.
       *
       * Showdown emits the move line inside `useMoveInner` (sim/battle-actions.ts:453) AFTER the
       * BeforeMove event and BEFORE the TryMove event. Everything above this line is a BeforeMove
       * refusal -- flinch, paralysis, sleep, freeze, recharge, Throat Chop, Taunt -- and every one of
       * them emits `|cant|` INSTEAD of a move line, which is what the official engine does. Everything
       * below is a TryMove or onTry failure and emits the move line FIRST and then `|-fail|`. Putting
       * this emit in the wrong place would make a refusal look like a different refusal, which is the
       * one thing this instrument exists to tell apart.
       *
       * A bare switch carries no move and emits none. Showdown names the USER as the target of a
       * self-targeting move (`|move|p1b: Whimsicott|Tailwind|p1b: Whimsicott`), which is why the
       * fallback is `m` rather than an empty field. */
      {
        /* ROADMAP #81 WIRE 6 -- THE GATE IS "IS THERE A MOVE", AND IT USED TO BE "IS THERE A MOVE AND
         * IS THE KIND ONE I LIKE". `a.kind!=='pass'` stood here because a `pass` action carried no id
         * and the test was redundant belt-and-braces; once playerAction started naming the unmodelled
         * click it became the thing SUPPRESSING 10 of the 25 silent games. A bare `{kind:'pass'}` a
         * caller built has no `mv` and is still silent, which is what it should be. */
        const _mid=actionMoveId(a);
        if(TR&&_mid){
          /* THE TARGET IS A SLOT, NOT A BODY, and the action was built before the sort -- so the
           * Pokemon it names can already have switched out. Resolved the same way the attack branch
           * resolves `aim` below (by `tgtSlot` against the LIVE foe array); a body that is on the
           * bench has no `p1a:`-style identifier at all and emitting one produced `??` four times
           * before this line existed. */
          /* WIRE 139 -- through the ONE reader now. It used to re-aim only when the body had left the
           * field entirely, which is a weaker rule than the authority's and disagreed with the attack
           * branch three lines of reasoning away. */
          const _tt=reaimToSlot(a.target,it,actA,actB,_mid,true);
          TR.mv(m,_mid,_tt||m);
        }
        /* ROADMAP #84 -- THE MOVE WAS USED, SO THE DEFAULT RESULT IS SUCCESS, and it is set exactly
         * here for the same reason the announcement is: everything ABOVE this line is a BeforeMove
         * refusal that has already written its own false-or-null and `continue`d, and everything
         * BELOW is a move that ran. `useMove` does the same thing one level up
         * (battle-actions.ts:374): it takes `useMoveInner`'s return unless the inner call already
         * wrote a result of its own. The failure sites below overwrite this through mvFail(); the
         * damaging branch overwrites it with all three values. */
        if(_mid)m._mvRes=true;
      }
      /* WIRE 42, the other members. Clangorous Soul (343 uses) and Shed Tail (60) pay HP for an
         effect this engine ALREADY models -- a setup and a pivot -- so they must not be captured by
         the `sub` kind, which would replace a modelled effect with an unmodelled one. The cost is
         charged here instead, before the kind is dispatched, and the move FAILS below the threshold
         the tag names. `sub` is excluded because it charges its own cost and would otherwise pay
         twice. */
      /* WIRE 85 -- BLOCKED PRIORITY APPLIES TO EVERY KIND OF ACTION, and it was checked only inside
       * the attack branch. Armor Tail, Queenly Majesty, Dazzling and Psychic Terrain refuse ANY
       * priority move aimed at their side, and most of the priority moves in this format are STATUS
       * moves -- Baby-Doll Eyes (+1), Thunder Wave in terrain, Whirlwind's negative bracket. So a
       * Farigiraf took a Baby-Doll Eyes it is built to refuse.
       *
       * THIS IS WIRE 77 EXACTLY ONE FIELD OVER, and that is the reason it is written here rather
       * than copied into the affect branch: a rule that belongs to every action kind goes ABOVE the
       * kind dispatch, or the next branch added below inherits the hole. Found by the generated
       * matrix as `babydolleyes -> armortail` and `-> queenlymajesty`, on both of which medicham2's
       * own two arms were IDENTICAL -- the definition of an unwired knob. */
      {
        const _pmv=(a.move&&a.move.id)||a.mv;
        const _pf=it.side==='A'?actB:actA;
        /* ONLY A MOVE AIMED AT THE OTHER SIDE. Protect is +4 and Quick Guard is +3, and neither is
         * refused by Queenly Majesty in the real game because neither targets the holder -- gating
         * on the action carrying a FOE as its target is what keeps this from blocking the user's own
         * setup. The attack branch keeps its own copy for the spread case, where target is null. */
        if(_pmv&&a.target&&_pf.indexOf(a.target)>=0){
          const _pk=(a.kind==='attack'?0:(isPrankster(m)?1:0));
          /* WIRE 117 -- the TARGET is handed over, because Psychic Terrain is a per-body question and
             the ability bar is a per-side one. Without it a grounded partner would refuse a priority
             move aimed at the airborne body standing next to it. */
          if(movePriority(_pmv,field)+_pk>priorityRefusedAbove(_pf,field,a.target)){m._lastMove=_pmv;
            /* `cant|HOLDER|ability: Armor Tail|MOVE|[of] ATTACKER` -- data/abilities.ts:225, and the
             * POKEMON field is the REFUSER rather than the attacker, which is the one shape in this
             * family that inverts. The holder is found by asking which live foe carries a
             * priority-refusing tag; Psychic Terrain's bar has no holder and emits nothing, which is
             * declared in data/protocol-events.json rather than approximated with the terrain's name
             * on a body that did not refuse. */
            if(TR){const _h=_pf.find(x=>x&&!x.fainted&&x.curHP>0&&TAGS.param('ability',x.ability,'blocksMove'));
                   if(_h)TR.cant(_h,'ability: '+_h.ability,_pmv,m);}
            continue;}
        }
      }
      /* ROADMAP #81 WIRE 12 -- `passstate` PAYS ITS OWN COST, INSIDE ITS OWN BRANCH, and is excluded
         here for the same reason `sub` is: THE ORDER OF THE CHECKS IS PART OF THE MOVE. Shed Tail's
         `onTryHit` asks `canSwitch(source.side)` FIRST and returns NOT_FAIL, so a Shed Tail with an
         empty bench costs nothing at all; paid here, it would have charged half the user's HP for a
         switch that then could not happen. */
      if(a.kind!=='sub'&&a.kind!=='passstate'&&(a.mv||(a.move&&a.move.id))){
        const _cu=TAGS.param('move',a.mv||a.move.id,'costsUserHP');
        if(_cu&&_cu.costsFraction&&m.st){
          /* WIRE 130 -- A SECOND SUBSTITUTE FAILS AND COSTS NOTHING. Showdown's Substitute returns
             early when the volatile is already up, so the HP is never paid. Checked BEFORE the
             deduction, because paying for a doll you do not get is worse than either outcome. */
          if(m._sub>0&&TAGS.has('move',a.mv||a.move.id,'substitute')){m._lastMove=a.mv||a.move.id;mvFail(m);continue;}
          /* ROADMAP #81 WIRE 12 -- THE ROUNDING IS THE ARTIFACT'S. `costsUserHP.rounds` is read off
             the handler: Substitute and Clangorous Soul pay `directDamage(maxhp / n)` which truncs,
             Shed Tail pays `directDamage(Math.ceil(maxhp / 2))`. One shared floor was wrong for one
             of the three, and Shed Tail no longer reaches this block at all (it has its own branch,
             which needs the check ORDER as well as the number) -- but the rounding is fixed here too
             so the two sites cannot disagree the next time a member is added. */
          const _rnd=(_cu.rounds==='ceil')?Math.ceil:Math.floor;
          if(m.curHP<=_rnd(m.st.hp*(+_cu.failsBelow||+_cu.costsFraction))){m._lastMove=a.mv||a.move.id;mvFail(m);continue;}
          /* WIRE 130 -- AND THE DOLL IS ACTUALLY BUILT. See grantSubstitute: the paying half of this
             move ran and the granting half did not, on 1,976 corpus clicks.
             ROADMAP #81 WIRE 7 -- AND IT IS BUILT *BEFORE* THE HP IS PAID. `moveHit` adds
             `moveData.volatileStatus` and only THEN calls `moveData.onHit`, which is where the
             `directDamage` lives, so the authority reads
                 |-start|p1a: Cyclizar|Substitute|[from] move: Shed Tail
                 |-damage|p1a: Cyclizar|72/145
             and this engine read those two lines the other way round on EVERY Substitute (657 uses)
             and every Shed Tail (64) in the corpus. The `kind==='sub'` branch further down already
             had the right order and is DEAD: playerAction classifies both moves as `affect`, because
             both carry a `statusInflict` volatile, so control has never reached it. */
          grantSubstitute(m,a.mv||a.move.id);
          m.curHP-=_rnd(m.st.hp*+_cu.costsFraction);
          if(TR)TR.dmg(m);
          if(m.curHP<=0){m.curHP=0;m.fainted=true;m._sub=0;if(TR)TR.faint(m);continue;}
        }
      }
      /* WIRE 19 -- REAL setup boosts. This applied a generic +1 to Attack, SpA AND Speed for every
       * setup click, so Swords Dance was one-third right, Iron Defense entirely wrong, and Dragon
       * Dance half right. The rulebook states each move's actual boosts (targetBoostsAlways); the
       * generic guess remains only as the fallback for a move the rulebook lacks. Contrary flips
       * the sign here exactly as it does for self-drops. */
      if(a.kind==='setup'){
        const _fx=a.mv&&moveFx(a.mv);
        const _bo=_fx&&_fx.targetBoostsAlways;
        m._lastMove=a.mv||m._lastMove;
        if(_bo){
          const _sg=invSign(m);          // WIRE 100b
          for(const k in _bo){const _s2=SD2ENG[k];if(_s2&&m.boosts[_s2]!=null){
            const _b0=m.boosts[_s2];m.boosts[_s2]=clamp(m.boosts[_s2]+_bo[k]*_sg,-6,6);
            if(TR)TR.bst(m,_s2,m.boosts[_s2]-_b0);}}
        } else {
          const _b={at:m.boosts.at,sa:m.boosts.sa,sp:m.boosts.sp};
          m.boosts.at=clamp(m.boosts.at+1,-6,6);m.boosts.sa=clamp(m.boosts.sa+1,-6,6);m.boosts.sp=clamp(m.boosts.sp+1,-6,6);
          if(TR)for(const k of ['at','sa','sp'])TR.bst(m,k,m.boosts[k]-_b[k]);
        }
        continue;
      }
      /* THE GENERIC EFFECT APPLIER. Everything it does comes from the artifact, so a move added to
       * the format arrives here with no edit -- which is the whole point of deriving the spec rather
       * than writing branches. Accuracy, Protect and the Prankster/Dark immunity are checked the same
       * way the existing status branch checks them, because a target-drop is a status move. */
      if(a.kind==='affect'){
        m._lastMove=a.mv;
        /* WIRE 139 -- THE SLOT, BEFORE ANYTHING ELSE LOOKS AT THE BODY. This branch is where Charm,
         * Fake Tears, Growl, Leer, Screech, Tickle and every other generic effect resolves, and it
         * held the Pokemon OBJECT the chooser aimed at. Measured on a board before this line existed
         * (tests/staged_board.js --only pivot-then-the-slot-is-hit): Weavile pivots out, Toxapex walks
         * in, and Showdown has Toxapex at -2 Attack while this engine had it at 0 and had quietly
         * dropped a body sitting on the BENCH. */
        let _t=reaimToSlot(a.target,it,actA,actB,a.mv);
        _t=_t&&!_t.fainted&&_t.curHP>0?_t:null;
        _t=bounceOff(m,_t,a.mv);
        if(!_t){mvFail(m);continue;}
        if(_t.protect){if(TR)TR.act(_t,'move: Protect');continue;}
        if(subBlocks(m,_t,a.mv)){if(TR)TR.act(_t,'move: Substitute','[damage]');continue;}   // WIRE 130 -- the doll takes the status move
        /* GOOD AS GOLD REFUSES A STATUS MOVE OUTRIGHT. Gholdengo was taking Charm for -2, which
         * makes it a different Pokemon to the one people build around. The tag is derived from the
         * ability's own onTryHit -- and tightened after the first version caught Telepathy, which
         * tests category !== 'Status' and blocks an ALLY'S DAMAGE, and Wonder Guard, which tests
         * for Status and then bare-returns to ALLOW it. */
        if(TAGS.has('ability',_t.ability,'refusesStatusMoves')&&_t!==m){if(TR)TR.imm(_t,'[from] ability: '+_t.ability);continue;}
        if(moveClassBlocked(_t,a.mv,m)){if(TR)TR.imm(_t);continue;}               // WIRE 66 -- Soundproof, Bulletproof
        if(powderBlocked(_t,a.mv)){if(TR)TR.imm(_t);continue;}
        if(pranksterBlocked(m,_t,a.mv)){if(TR)TR.imm(_t);continue;}
        /* WIRE 129 -- hitChance, not moveAccuracy: a Minimize'd target dodges a Will-O-Wisp exactly
         * as it dodges an Ice Beam, and No Guard lands one exactly as it lands a Stone Edge. */
        const _acc=hitChance(m,_t,a.mv,field,{targetAlreadyMoved:!unresolved.has(_t)});
        if(_acc<100&&rng()*100>_acc){if(TR)TR.miss(m,_t);continue;}
        /* ROADMAP #102 -- STRENGTH SAP'S HEAL, WHICH WIRE 79 FILED AS UNREACHABLE AND NO LONGER IS.
         *
         * The note left here said "the heal scales off the TARGET's Attack and no artifact this engine
         * reads carries it". That was true when it was written; `data/tags.json` now carries
         * `healsSelf {heal:true, fromTargetStat:'atk'}` and it matches exactly one move -- membership
         * printed over the whole table before this was wired. 710 uses, the largest single member of
         * the procedural heal family, and the heal was 0.000 HP on every one of them.
         *
         * THREE THINGS COME OUT OF THE HANDLER AND ONLY ONE IS THE HEAL
         * (`if (target.boosts.atk === -6) return false; const atk = target.getStat('atk', false, true);
         *   const success = this.boost({atk: -1}, ...); return !!(this.heal(atk, source, target) || success);`)
         *   1. A TARGET ALREADY AT -6 ATTACK MAKES THE WHOLE MOVE FAIL -- no heal either, and this
         *      engine would otherwise have healed off a drop that could not happen.
         *   2. THE ATTACK IS READ BEFORE THE DROP. Computed here, above the boost loop, deliberately:
         *      reading it after would undercount every sap by one stage.
         *   3. IT IS THE STAT, NOT A FRACTION OF IT -- boosted, unmodified. See statWithBoost.
         * The user's own Heal Block still gates it, like every other place HP goes up. */
        let _sapHeal=null;
        {const _hs=TAGS.param('move',a.mv,'healsSelf');
         if(_hs&&_hs.heal===true&&_hs.fromTargetStat){
           const _k=SD2ENG[_hs.fromTargetStat];
           if(!_k||!_t.st||_t.st[_k]==null||!_t.boosts||_t.boosts[_k]==null){
             MEDFAILS.healFromStatUnreadable++;
             if(!MEDFAILS.healFromStatUnreadableFirst)
               MEDFAILS.healFromStatUnreadableFirst=String(a.mv)+'/'+String(_hs.fromTargetStat);
           }
           else if(_t.boosts[_k]<=-6){mvFail(m);continue;}
           else _sapHeal=statWithBoost(_t,_k);
         }}
        /* Stat changes. Contrary flips them and Clear Body refuses drops, both already modelled for
         * Intimidate -- asked here the same way so one ability does not behave differently by route. */
        for(const _e of ((a.sc&&a.sc.target)||[])){
          if(_e.chance<100&&rng()*100>=_e.chance) continue;
          const _sg=invSign(_t);         // WIRE 100b
          /* WIRE 3 -- the refusal is ONE gate now, and it is asked per STAT while the ANNOUNCEMENT
           * is once per boost table: Showdown's onTryBoost deletes each blocked key inside a single
           * boost() call and then adds at most one `-fail`. Emitting per stat would invent a second
           * line for a two-stat drop. */
          let _ref=null;
          for(const _k in _e.boosts){
            const _s2=SD2ENG[_k]; if(!_s2||_t.boosts[_s2]==null) continue;
            const _d=_e.boosts[_k]*_sg;
            if(_d<0){ const _r=statDropRefusal(_t,_s2,a.mv,false); if(_r){ _ref=_ref||_r; continue; } }
            const _b0=_t.boosts[_s2];
            _t.boosts[_s2]=clamp(_t.boosts[_s2]+_d,-6,6);
            if(TR)TR.bst(_t,_s2,_t.boosts[_s2]-_b0);
              /* WIRE 138 -- ONCE PER STAT LOWERED. `retaliateWhenLowered` is the shared reader; the
                 attacker is named so an ALLY's drop does not trigger it. */
            if(_d<0&&_t.boosts[_s2]!==_b0)retaliateWhenLowered(_t,m);
          }
          if(TR&&_ref&&_ref.announce)TR.failUnboost(_t,_ref.label,_ref.ab);
        }
        /* ROADMAP #102 -- and the sap is paid, after the drop and out of the amount read before it. */
        if(_sapHeal!=null&&!m.fainted&&!healBlocked(m)){
          const _sh0=m.curHP;
          m.curHP=Math.min(m.st.hp,m.curHP+_sapHeal);
          if(TR&&m.curHP>_sh0)TR.heal(m,'[from] move: '+a.mv,_t);
        }
        /* Status and volatiles. applyStatus already enforces the type and ability immunities; a
         * VOLATILE is a different thing and is recorded by name on the mon so a consumer can see
         * which ones it does and does not act on, instead of a silent no-op. */
        for(const _e of ((a.si&&a.si.effects)||[])){
          const _who=_e.to==='user'?m:_t;
          if(!_who||_who.fainted) continue;
          if(_e.chance<100&&rng()*100>=_e.chance) continue;
          if(_e.status) applyStatus(_who,_e.status);
          /* WIRE 26 -- sealsMoves, and it is where the tag actually resolves.
           *
           * The consumer that read this tag lived in the `kind==='status'` branch and its guard could
           * never pass: playerAction classifies Encore, Disable and Taunt as `affect` (they carry a
           * VOLATILE and no major status), so control never reached it. `tests/test-tag-wire.js` has
           * printed "Encore pins the foe to its last move (undefined) for undefined turns" since
           * before 2026-08-04 for exactly that reason. The dead branch is gone; this is the live one.
           *
           * THE DURATION COMES FROM THE ARTIFACT, not from three typed literals. It read
           * `encore?3:taunt?3:1`, so Disable — which the tag says lasts 5 — got ONE turn, and any
           * future duration change in the artifact would have been silently ignored. Now
           * `sealsMoves.turns`.
           *
           * BRANCHING ON THE VOLATILE NAME IS READING A DECLARED FACT, not typing a list. Showdown
           * names the volatile; the tag cannot tell "pin to the last move" from "forbid the last
           * move" because both carry the same params (`turns`, `scope`, `fromUsersOwnMoves:false`).
           * The tag supplies the number, the flag supplies the direction — that is the split
           * docs/TAGS.md describes, not an exception to it.
           *
           * ENCORE RIDES THE SAME `_lock` THE CHOICE ITEMS USE, so a caller-SUPPLIED action is bound
           * as well as a chosen one — the WIRE 24 rule, which nothing about Encore honoured. A Choice
           * lock (`_lockT === Infinity`) is never shortened by it. */
          if(_e.volatile){
            /* WIRE 69 -- A MOVE-SEALING VOLATILE FAILS AGAINST A TARGET WITH NO LAST MOVE, and this
               guard has to come BEFORE the volatile is written. The first version sat two lines lower,
               after the assignment, so it skipped the bookkeeping and left the volatile on -- the pair
               matrix kept reading `vol medi=["encore"] sd=[]` and the fix looked landed.
               ROADMAP #111 -- AND IT WAS WRITTEN `=== 'encore'`, SO DISABLE NEVER HAD IT. Showdown
               refuses both (`disable.onTryHit` returns false on `!target.lastMove`; encore's
               `onStart` does the same), and `data/roster.moves.json` measured the cost: on the turn
               before its target had ever moved, `vol.disable` read showdown=0 ours=4. The membership
               is now derived -- see volNeedsLastMove -- so a third sealer arriving is covered. */
            if(volNeedsLastMove(_e.volatile)&&!_who._lastMove){ MEDSEEN.volSealNoLastMove++; continue; }
            /* ROADMAP #111 -- AND RE-APPLYING ONE THE BODY ALREADY CARRIES FAILS. `Pokemon#addVolatile`
               returns false when the volatile is present and its condition declares no `onRestart`,
               and none of this family does. Writing the counter again REFRESHED it, which is why a
               Taunt clicked on two consecutive turns read 2 at both boundaries where Showdown reads
               2 then 1 -- the clock never ran down while the move was being re-clicked. Restricted to
               the duration family on purpose: Protect, Follow Me, Rage Powder and Helping Hand are
               per-turn volatiles that MUST be re-settable, and a blanket no-restart rule would have
               caught all four (docs/LESSONS §4 -- print what the rule matches before wiring it). */
            if(durationVolatiles().has(_e.volatile)&&_who._vol&&_who._vol[_e.volatile]>0){
              MEDSEEN.volRestartRefused++; continue; }
            /* ROADMAP #81 WIRE 7 -- THE SUBSTITUTE VOLATILE IS ALREADY OWNED, AND THIS LOOP WAS
               ANNOUNCING IT A SECOND TIME. `grantSubstitute` holds the doll's size, its failure rule
               and its `-start`; this generic path then wrote `_vol.substitute = 1` and emitted a
               SECOND `|-start|X|move: substitute` that Showdown never writes -- measured on a plain
               Garchomp Substitute, three lines out where the authority writes two. Skipping by the
               DECLARED volatile name is the same read the encore and disable branches two lines above
               already make: the tag supplies the effect, the name says which handler owns it. */
            if(_e.volatile==='substitute') continue;
            /* ROADMAP #92 -- CONFUSION IS OWNED TOO, for exactly the reason Substitute is. This
             * generic path writes a bare turn count and knows nothing about Own Tempo, Safeguard, a
             * body that is already confused, a Lum Berry or the self-hit -- and what it wrote was
             * never read by anything. `applyConfusion` is the one implementation and the secondary
             * path two thousand lines below calls the same function. */
            if(_e.volatile==='confusion'){applyConfusion(_who,m,field);continue;}
            /* WIRE 119 -- TAUNT LASTS THREE OF THE TARGET'S TURNS, NOT THREE TURNS. Showdown's taunt
             * condition bumps its own duration when the target has ALREADY MOVED this turn
             * (`if (target.activeTurns && !this.queue.willMove(target)) this.effectState.duration++`),
             * because the turn it just spent must not be one of the three. Measured at the pinned
             * commit both ways -- a faster Taunter blocks the target on turns 1(exec), 2, 3; a slower
             * one blocks turns 2, 3, 4 -- three refusals either way, and without this bump the slow
             * case gets two.
             * `unresolved` is this turn's outstanding actions (WIRE 118), so "was queued to move and
             * no longer will" is `acts.some(...) && !unresolved.has(...)` -- the same pair of clauses
             * Showdown asks, including the `activeTurns` half: a body dragged or switched in mid-turn
             * is in neither set and is correctly NOT bumped.
             * ROADMAP #111 -- THE PREDICATE IS UNCHANGED AND THE MEMBERSHIP IS NOT. It used to be
             * gated on `forbidByVolatile()`, which is a table of ONE (taunt), so Encore -- which
             * Showdown bumps by the same rule minus the `activeTurns` clause -- never got it. The
             * whole duration family now shares it, and Disable's declared-5-seals-4 correction rides
             * in the same function rather than as a literal here. */
            const _sm=TAGS.param('move',a.mv,'sealsMoves');
            const _amv=!unresolved.has(_who)&&acts.some(x=>x.mon===_who);
            const _dur=volDurationOnApply(_e.volatile,_amv,_sm);
            /* NO SILENT DEFAULT. A volatile with no duration in the artifact keeps the pre-existing
             * bare `1`, which is what every non-sealing volatile in this loop has always been given;
             * the difference is that it is now visibly the fallback rather than the rule. */
            const _tn=_dur!=null?_dur:((_sm&&+_sm.turns)||1);
            if(_dur!=null) MEDSEEN.volDurationApplied++;
            (_who._vol=_who._vol||{})[_e.volatile]=_tn;
            /* `|-start|p1b: Amoonguss|move: Taunt` -- the `move: ` prefix is what Showdown writes for
             * a volatile whose source effect is a move, read off a real battle.log. */
            if(TR)TR.vstart(_who,'move: '+_e.volatile);
            /* `_sealed` is Disable's alone. Encore carries its move in `_encoreMove` and `_lock`, and
             * one field serving two volatiles is a field that expires the wrong one. */
            if(_e.volatile==='disable')_who._sealed=_who._lastMove||null;
            /* Encore's own guard is WIRE 69, four lines above: there is nothing to repeat against a
               target that has never moved, and Showdown's condition bails on `!target.lastMove`.
               THE FIRST VERSION OF THAT RULE WAS TOO STRICT AND THE CENSUS CAUGHT IT: it demanded the
               target had moved THIS TURN, which dropped `live` 148 -> 146, because Showdown's
               `lastMove` persists across turns -- an Encore on turn 3 repeating a turn-1 move is
               legal. The rule is "has ever moved", not "has moved this turn". */
            if(_e.volatile==='encore'){
              _who._encoreMove=_who._lastMove||null;
              /* ROADMAP #111 -- `_tn` AND NOT `_tn + 1`. The +1 was compensating for the counter being
                 decremented a second time inside `_chooseAction`; that second decrement is gone, so
                 the lock and the volatile now start on the same number and expire on the same turn
                 boundary. Two clocks for one effect is how a lock outlives the volatile that made it. */
              if(_who._lastMove&&_who._lockT!==Infinity){_who._lock=_who._lastMove;_who._lockT=_tn;}
            }
            /* WIRE 62 -- MENTAL HERB, 684 sheets, and it undoes the whole point of the click that
             * just landed -- so any value a search assigns to landing a Taunt or an Encore is wrong
             * against a holder. Applied HERE, the instant the volatile is set, because the real item
             * is an onUpdate: it never spends a turn taunted.
             * THE SET IS THE ARTIFACT'S. The param was `{oneShot:true}`, which named the shape and
             * not WHICH volatiles -- and the set is the mechanic: the herb frees Taunt, Encore,
             * Disable, Attract, Torment and Heal Block and does NOT touch confusion, a Leech Seed or
             * a partial trap. A consumer reading the boolean would have built a universal eraser.
             * It clears the ENGINE-SIDE state each volatile owns as well as the volatile itself,
             * because `_sealed` and the Encore `_lock` are separate fields (WIRE 26) and leaving
             * either behind would free the name and keep the effect. */
            {
              const _mh=TAGS.param('item',_who.item,'curesVolatile');
              if(_mh&&Array.isArray(_mh.cures)&&_mh.cures.indexOf(_e.volatile)>=0){
                delete _who._vol[_e.volatile];
                if(_e.volatile==='disable')_who._sealed=null;
                if(_e.volatile==='encore'){_who._encoreMove=null;if(_who._lockT!==Infinity){_who._lock=null;_who._lockT=0;}}
                if(_e.volatile==='healblock')_who._healBlock=0;
                if(TR){TR.vend(_who,'move: '+_e.volatile);TR.enditem(_who,_who.item);}
                _who.item='';
              }
            }
          }
        }
        /* WIRE 86 -- MEMENTO FAINTS ITS USER, AND THE CHECK LIVED IN THE ATTACK BRANCH.
         * WIRE 46 wired `userFaints` where damaging moves resolve, gated on `dealt > 0`. Memento is
         * a STATUS move: it resolves here, in `affect`, so its whole cost -- the user dies -- never
         * happened. A -2/-2 drop on the foe for free is not the move that is in the game, and the
         * search would take it every time.
         * Reaching this line means the effect LANDED (every refusal above `continue`s out), which is
         * exactly what `faints: 'ifHit'` asks. `faints: 'always'` cannot reach here -- Explosion is
         * a damaging move -- so both branches read one artifact and neither names a move. */
        {
          const _ufa=TAGS.param('move',a.mv,'userFaints');
          if(_ufa&&_ufa.faints&&!m.fainted){m.curHP=0;m.fainted=true;if(TR){TR.dmg(m);TR.faint(m);}}
        }
        continue;
      }
      /* WIRE 39 -- HAZE. BOTH SIDES, including the user's own, which is the whole shape of the move:
         it is the answer to a sweeper you cannot outstat, and it costs you your own setup too. A
         version that only wiped the foe would be a strictly better move than the one in the game. */
      if(a.kind==='haze'){
        for(const x of [...actA,...actB])if(x&&!x.fainted&&x.boosts)x.boosts={at:0,df:0,sa:0,sd:0,sp:0,acc:0,eva:0};
        /* `|-clearallboost|` carries no POKEMON -- it is a field-wide event, sim/SIM-PROTOCOL.md:401. */
        if(TR)TR.clearAll();
        m._lastMove=a.mv;continue;
      }
      /* WIRE 40 -- ROAR / WHIRLWIND, the phazing half. The drag goes through switchOut, the ONE
         switch path, so the replacement gets its entry effects, its Intimidate and now its hazard
         chip exactly as a voluntary switch does -- two paths is how the voluntary switch nearly
         skipped Intimidate. A drag into an empty bench simply fails and still costs the turn.
         WIRE 102 -- WHO COMES IN IS A DIE, rolled here, because that is the real rule: Showdown's
         dragIn is `this.sample(possibleSwitches)`. The previous version took live(bench)[0] with a
         comment conceding the point, and under the interaction matrix's pinned dice the two engines
         then dragged DIFFERENT bodies (`whirlwind -> suckerpunch`: `.B.active[0].species
         medi=corviknight sd=weavile`) -- a policy difference reading as a rule divergence. A uniform
         pick over the live bench is the rule; which body a given seed produces is luck, exactly like
         a damage roll. */
      /* WIRE 141 -- AND THE PHAZE BRANCH WAS THE SIXTH SITE, WHICH IS THE FINDING RATHER THAN THE FIX.
       *
       * Will, 2026-08-08: *"roar has super negative priority so switch happens first"* — and *"same
       * with dragon tail"*. Both right, and the priority is what makes this branch the WORST place in
       * the file to hold a Pokemon-first target: Roar, Whirlwind, Dragon Tail and Circle Throw are all
       * **-6**, so every voluntary switch, every pivot and every faint replacement in the turn has
       * already happened by the time they fire. A move that resolves last is the move most likely to
       * find somebody else standing in the slot it named.
       *
       * WIRE 139 FOLDED FIVE BRANCHES INTO `reaimToSlot` AND MISSED THIS ONE. `const _t=a.target;
       * const _i=_foes.indexOf(_t)` is a lookup of the ORIGINAL OBJECT in the CURRENT active array, so
       * a body that pivoted out scored -1 and the whole move failed silently — our Roar dragged
       * nobody. Measured on the staged board before this line changed: Corviknight pivots out, Snorlax
       * walks in, Showdown drags Snorlax and puts Corviknight back while ours left Snorlax standing.
       * 4 games of the 1,530-game residue at release 3dd96ca88574.
       *
       * `indexOf` STILL RUNS, and deliberately: the re-aim answers WHO, and the branch still needs
       * WHICH SLOT to hand `switchOut`. What changed is that the body is resolved first and the index
       * is taken of the resolved body, so the two can no longer disagree. An EMPTY aimed slot returns
       * null and falls through to the same `mvFail` both other sites use — the declared residue WIRE
       * 139 filed as `MEDSEEN.reaimSlotEmpty`, unchanged and still counted. */
      if(a.kind==='phaze'){
        const _t=reaimToSlot(a.target,it,actA,actB,a.mv);
        const _foes=it.side==='A'?actB:actA, _fb=it.side==='A'?benchB:benchA, _fsf=it.side==='A'?sfB:sfA;
        const _own=it.side==='A'?actA:actB;
        const _i=_t?_foes.indexOf(_t):-1;
        /* WIRE 66 REACHES HERE TOO, and the pair matrix caught it not doing so: ROAR IS A SOUND MOVE
           (405 corpus uses), so a Soundproof body cannot be phazed -- Showdown left Bastiodon on the
           field where medicham2 had already dragged it out. Protect does not stop Roar (it carries
           ignoresProtect) and that half was already right. */
        if(_i>=0&&!_t.fainted&&!(_t.protect&&!TAGS.has('move',a.mv,'ignoresProtect'))
           &&!moveClassBlocked(_t,a.mv,m)&&!TAGS.has('ability',_t.ability,'refusesStatusMoves')){
          const _lb=_live(_fb);
          /* THE ONE PLACE `|drag|` COMES FROM. bringIn() serves four callers and only the phaze pair
           * is a forced switch, so the flag is raised here and lowered immediately -- Showdown's split
           * between `|switch|` and `|drag|` is exactly "did the owner choose this". */
          if(TR)TR.drag=true;
          switchOut(_foes,_i,_fb,_own,_fsf,field,_lb.length?_lb[Math.floor(rng()*_lb.length)]:null);
          if(TR)TR.drag=false;
        } else mvFail(m);
        m._lastMove=a.mv;continue;
      }
      /* WIRE 41 -- LAYING A HAZARD. It lands on the OPPOSING side's `_sf`, which every member of that
         team shares by reference, so a body still on the bench is already standing behind it. Layers
         accumulate because Spikes stacks to three; Stealth Rock does not and re-laying it is a wasted
         turn either way. */
      if(a.kind==='hazard'){
        const _h=TAGS.param('move',a.mv,'hazard');
        const _fsf=(it.side==='A'?actB:actA).map(x=>x&&x._sf).find(Boolean);
        if(_h&&_h.hazard&&_fsf){(_fsf.hz=_fsf.hz||{})[_h.hazard]=(_fsf.hz[_h.hazard]||0)+1;
          /* WIRE 138 -- WHO LAID IT. Sticky Web's own handler boosts with `this.effectState.source`
             (data/moves.ts, the stickyweb condition), so its -1 Speed HAS a source and DOES trigger
             Defiant. This engine recorded no setter, and the first cut of WIRE 138 passed `null` and
             turned an existing green probe red -- which is the probe doing its job. The layer outlives
             whoever set it, exactly as `effectState.source` does, so it is stored on the layer. */
          (_fsf.hzBy=_fsf.hzBy||{})[_h.hazard]=m;
          /* The SIDE is the one the layer lands on, which is the FOE's -- taken from a body standing
           * in that side's slots rather than from `it.side`, because the hazard chooses the target. */
          if(TR)TR.sstartSide(it.side==='A'?'p2':'p1',_h.hazard);}
        m._lastMove=a.mv;continue;
      }
      /* WIRE 42 -- SUBSTITUTE, both halves. It FAILS outright below the threshold the tag names
         (`failsBelow`), which is the rule and matters: a Substitute clicked at 24% HP does not kill
         its user. A substitute already up is not replaced and the click is wasted.
         WHAT IS MODELLED: the doll takes damage until it breaks, and while it stands the body behind
         it takes no damage, no secondary and no status. WHAT IS NOT, and is stated rather than
         discovered: sound moves and Infiltrator go through a real substitute, and this engine does
         not track either at the hit site. */
      if(a.kind==='sub'){
        const _cu=TAGS.param('move',a.mv,'costsUserHP')||{};
        const _need=Math.floor(m.st.hp*(+_cu.failsBelow||+_cu.costsFraction||0.25));
        if(!m._sub&&m.curHP>_need){
          m.curHP-=Math.floor(m.st.hp*(+_cu.costsFraction||0.25));
          grantSubstitute(m,a.mv);                        // WIRE 130 -- one authority for the doll's size
          /* Showdown emits `|-start|X|Substitute` BEFORE the `|-damage|` that pays for it -- read off
           * a real battle.log -- which is why grantSubstitute() emits and this line follows it. */
          if(TR)TR.dmg(m);
          if(m.curHP<=0){m.curHP=0;m.fainted=true;m._sub=0;if(TR)TR.faint(m);}
        } else mvFail(m);
        m._lastMove=a.mv;continue;
      }
      /* WIRE 67 -- BELLY DRUM maxes Attack and pays HALF its max HP for it, and it FAILS if it cannot
         pay -- which is the rule that stops it being a free +6 on a body at 40%. Both numbers are the
         artifact's: `boosts {atk:12}` (six stages, in Showdown's twelve-half-stages spelling) and
         `costFraction 0.5`, read out of the handler's own boost call and directDamage. */
      if(a.kind==='statcode'){
        const _sc4=TAGS.param('move',a.mv,'statChangeInCode')||{};
        const _cost=_sc4.costFraction?Math.floor(m.st.hp*+_sc4.costFraction):0;
        if(_cost&&m.curHP<=_cost){m._lastMove=a.mv;mvFail(m);continue;}          // it cannot pay: the move fails
        if(_cost){m.curHP-=_cost;if(TR)TR.dmg(m);}
        const _sg=invSign(m);          // WIRE 100b
        for(const k in (_sc4.boosts||{})){
          const _s=SD2ENG[k]; if(!_s||m.boosts[_s]==null) continue;
          const _b0=m.boosts[_s];
          m.boosts[_s]=clamp(m.boosts[_s]+_sc4.boosts[k]*_sg,-6,6);
          if(TR)TR.bst(m,_s,m.boosts[_s]-_b0);
        }
        m._lastMove=a.mv;continue;
      }
      /* ROADMAP #81 WIRE 8 -- A TAILWIND ALREADY UP IS NOT REFRESHED, AND THE SECOND CLICK FAILS.
         `Side.addSideCondition` returns false on a condition that is already present unless it
         declares an `onSideRestart`, and tailwind declares none -- so Showdown writes `|-fail|` and
         the ORIGINAL clock keeps running. This engine wrote a second `|-sidestart|` and reset the
         counter to 4, which hands a doubles side an indefinite Tailwind for the price of one click
         a turn. 12,889 corpus uses, the heaviest side condition in the format. */
      if(a.kind==='tail'){
        if((it.side==='A'?field.twA:field.twB)>0){mvFail(m);continue;}
        if(it.side==='A')field.twA=4;else field.twB=4;if(TR)TR.sstart(m,'Tailwind');continue;}
      /* TRICK ROOM. Every other piece of it was already here — field.tr inverts the speed sort in the
       * acts.sort above, ticks down at end of turn, and flipSpeedOdds already prices it — and nothing
       * could ever set it, so a Trick Room click was a no-op turn. 1.18% of real clicks
       * (engine/medicham_coverage.js) and one of the largest strategic swings in the format.
       *
       * IT TOGGLES. Clicking it while it is up ENDS it rather than refreshing it, which is the real
       * rule and matters here specifically: the counter to Trick Room is a second Trick Room, so a
       * version that refreshed would make the room permanent once either side started it and would
       * misprice every Trick Room mirror. Five turns, of which the mover's own is one — the end-of-turn
       * decrement leaves four behind, matching how twA/twB are set to 4 on the line above. */
      if(a.kind==='trickroom'){const _was=field.tr>0;field.tr=_was?0:5;
        if(TR){if(_was)TR.fend('Trick Room');else TR.fstart('Trick Room',m);}continue;}
      /* WIRE 133 -- WONDER ROOM AND MAGIC ROOM, on Trick Room's own rules because they are the same
       * `pseudoWeather` family in the dex: five turns, and a second click ENDS it rather than
       * refreshing it. Written beside Trick Room deliberately -- three rooms with one lifetime rule in
       * one place beats three copies that drift.
       *
       * MAGIC ROOM'S SUPPRESSION IS APPLIED THE MOMENT IT GOES UP, not at the next residual: the
       * clock and the item state have to move together or a Leftovers ticks once inside a room that
       * is already up. `itemRoomSync` is the single writer, and it restores on the way down. */
      /* WIRE 133 -- POLLEN PUFF AT AN ALLY. Half the TARGET's max HP, out of the tag rather than out
       * of a literal here, and `allyNoDamage` is the other half the artifact now states -- so an
       * engine reading this cannot accidentally heal AND hit.
       *
       * HEAL BLOCK REFUSES IT ON THE USER, NOT THE TARGET, and that asymmetry is the authority's:
       * `onTryMove` checks `source.volatiles['healblock']` and fails the whole move (data/moves.ts
       * :13581). Every other heal in this file is gated on the body being healed, so this one says
       * why it is not. */
      if(a.kind==='allyheal'){
        const _t=a.target;
        if(healBlocked(m)){m._lastMove=a.mv;if(TR){TR.attrStill();TR.cant(m,'move: Heal Block',a.mv);}continue;}
        if(!_t||_t.fainted||_t.curHP<=0){m._lastMove=a.mv;mvFail(m);continue;}
        const _h0=_t.curHP;
        _t.curHP=Math.min(_t.st.hp,_t.curHP+Math.floor(_t.st.hp*a.frac));
        if(_t.curHP>_h0){MEDSEEN.dualPurposeHeal++;if(TR)TR.heal(_t);}
        else if(TR)TR.fail(_t,'heal');
        m._lastMove=a.mv;continue;
      }
      if(a.kind==='room'){
        const _rk=a.room==='magicRoom'?'magicRoom':'wonderRoom';
        const _was=(field[_rk]||0)>0;
        field[_rk]=_was?0:5;
        const _label=_rk==='magicRoom'?'Magic Room':'Wonder Room';
        if(TR){if(_was)TR.fend(_label);else TR.fstart(_label,m);}
        if(_rk==='magicRoom')itemRoomSync(field,[...actA,...actB]);
        m._lastMove=a.mv;continue;
      }
      /* WIRE 133 -- SAFEGUARD. The condition lands on the USER'S OWN side (`allySide`), lasts five
       * turns, and a second click while it is up FAILS rather than refreshing -- `Side#addSideCondition`
       * returns false when the condition exists and declares no `onSideRestart`, and safeguard declares
       * none, which is the same rule ROADMAP #81 WIRE 8 established for the screens. */
      if(a.kind==='sidebuff'){
        const _sf2=m._sf;
        if(_sf2&&_sf2.sc&&_sf2.sc[a.cond]>0){m._lastMove=a.mv;mvFail(m);continue;}
        const _sbp=TAGS.param('move',a.mv,'sideBuff')||{};
        if(_sf2){(_sf2.sc=_sf2.sc||{})[a.cond]=+_sbp.turns||5;
          /* THE LABEL IS THE AUTHORITY'S OWN AND IT IS NOT UNIFORM. Safeguard and Reflect announce a
           * BARE name; Light Screen, Aurora Veil and Stealth Rock announce `move: NAME`. `startsAs` is
           * read off the condition's own `-sidestart` call, so this emits what Showdown emits.
           * DECLARED RESIDUE: the screens and the hazards still go through `TR.sstart`, which prefixes
           * `move: ` unconditionally -- so Reflect and Spikes are announced with a prefix the
           * authority does not use. That is a pre-existing protocol difference, it is not this wire's
           * to change, and it is written down here rather than left to be rediscovered. */
          if(TR){if(_sbp.startsAs)TR.sstartLabel(m,_sbp.startsAs);else TR.sstart(m,a.cond);}}
        m._lastMove=a.mv;continue;
      }
      if(a.kind==='boostally'){
        const bt=TAGS.param('move',a.mv,'boostsTarget')||{};
        /* The ALLY is the default when the caller named nobody, and a lone active has no ally, in
           which case the click honestly does nothing.
           WIRE 106 -- AN EXPLICIT FOE TARGET IS HONOURED. Decorate aimed across the field gives the
           FOE +2/+2 (the official engine applies it; three matrix rows read medi boosting the ally
           instead), and a foe-aimed status boost passes the same gates every other status move at a
           foe passes: Protect unless the move ignores it, Good as Gold's refusal, the move-class
           immunities, and the Prankster/Dark rule. */
        const _tgt=a.target&&!a.target.fainted&&a.target.curHP>0?a.target:null;
        const _isFoe=_tgt&&m._sf&&_tgt._sf!==m._sf;
        const who=_isFoe?_tgt:(_tgt&&_tgt!==m?_tgt:(it.side==='A'?actA:actB).find(x=>x&&x!==m&&!x.fainted&&x.curHP>0));
        const _blocked=_isFoe&&((_tgt.protect&&!TAGS.has('move',a.mv,'ignoresProtect'))
          ||TAGS.has('ability',_tgt.ability,'refusesStatusMoves')
          ||moveClassBlocked(_tgt,a.mv,m)||powderBlocked(_tgt,a.mv)||pranksterBlocked(m,_tgt,a.mv));
        const BK={atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp'};
        if(who&&bt.boosts&&!_blocked)for(const k in bt.boosts){
          const kk=BK[k]; if(kk){const _b0=who.boosts[kk]||0;
            who.boosts[kk]=clamp((who.boosts[kk]||0)+bt.boosts[k],-6,6);
            if(TR)TR.bst(who,kk,who.boosts[kk]-_b0);}
        }
        m._lastMove=a.mv;continue;
      }
      /* WIRE 107 -- TRICK / SWITCHEROO swap the two items; CORROSIVE GAS deletes the target's. The
         same status-move gates as the boost branch above. What is NOT modelled and is stated: Sticky
         Hold (no tag describes it -- its handler REFUSES the loss, the exact over-match the
         speedOnItemLoss derivation was tightened against) and the can't-trick-a-mega-stone-onto-
         its-own-species rule; the coarse half of the latter IS read: an item carrying `megaStone`
         does not move, which is the artifact's own shape. */
      if(a.kind==='trickitem'){
        m._lastMove=a.mv;
        const _ti=TAGS.param('move',a.mv,'takesTargetItem')||{};
        const t=a.target&&!a.target.fainted&&a.target.curHP>0?a.target:null;
        if(t&&t!==m
           &&!(t.protect&&!TAGS.has('move',a.mv,'ignoresProtect'))
           &&!TAGS.has('ability',t.ability,'refusesStatusMoves')
           &&!moveClassBlocked(t,a.mv,m)&&!pranksterBlocked(m,t,a.mv)
           &&!TAGS.has('item',m.item,'megaStone')&&!TAGS.has('item',t.item,'megaStone')){
          if(_ti.swaps){const _mi=m.item;m.item=t.item;t.item=_mi;
            if(TR){TR.act(m,'move: '+a.mv);
                   if(t.item)TR.item(t,t.item,'[from] move: '+a.mv);
                   if(m.item)TR.item(m,m.item,'[from] move: '+a.mv);}}
          else if(_ti.removes){const _lost=t.item;t.item='';
            if(TR&&_lost)TR.enditem(t,_lost,'[from] move: '+a.mv,m);}
        }
        continue;
      }
      /* WIRE 108 -- the type writers. The written type is the MOVE'S OWN (true of all four members);
         `adds` appends it, `replaces` overwrites the whole list. Same status gates; Magic Powder is
         a powder move and powderBlocked already owns that refusal. */
      if(a.kind==='typechange'){
        m._lastMove=a.mv;
        const _ct=TAGS.param('move',a.mv,'changesTargetType')||{};
        const t=a.target&&!a.target.fainted&&a.target.curHP>0?a.target:null;
        const _ty=(MC.moves[a.mv]||{}).t;
        if(t&&_ty
           &&!(t.protect&&!TAGS.has('move',a.mv,'ignoresProtect'))
           &&!TAGS.has('ability',t.ability,'refusesStatusMoves')
           &&!moveClassBlocked(t,a.mv,m)&&!powderBlocked(t,a.mv)&&!pranksterBlocked(m,t,a.mv)){
          if(_ct.adds){ if(t.types.indexOf(_ty)<0){t.types=[...t.types,_ty];if(TR)TR.vstart(t,'typeadd',_ty);} }
          else if(_ct.replaces){ t.types=[_ty]; if(TR)TR.vstart(t,'typechange',_ty); }
        }
        continue;
      }
      /* WIRE 109 -- AFTER YOU / QUASH rewrite the rest of THIS turn's queue. A target that has
         already resolved makes the move fail, which is the real rule.
         WIRE 118 -- IT WRITES THE ACTION'S `order`, IT NO LONGER SPLICES THE ARRAY. A splice is
         undone by the next re-sort, so under dynamic speed the whole mechanic would have gone
         silently dead. `order` is the field Showdown's own After You and Quash write for exactly this
         reason (`action.order = 3` / `= 201` against 200 for a plain move), and it is the FIRST key
         compareTurnOrder reads, so it survives every later re-sort. */
      if(a.kind==='reorder'){
        m._lastMove=a.mv;
        const _ro=TAGS.param('move',a.mv,'reordersTurn')||{};
        const t=a.target&&!a.target.fainted&&a.target.curHP>0?a.target:null;
        if(t){
          const _isFoe=m._sf&&t._sf!==m._sf;
          const _ok=!_isFoe||(!(t.protect&&!TAGS.has('move',a.mv,'ignoresProtect'))
            &&!TAGS.has('ability',t.ability,'refusesStatusMoves')&&!pranksterBlocked(m,t,a.mv));
          if(_ok&&unresolved.has(t)){
            const _entry=acts.find(x=>x.mon===t);
            if(_entry){_entry._order=(_ro.sends==='next')?TURN_ORDER.next:TURN_ORDER.last;
              if(TR)TR.act(t,'move: '+a.mv);}
          } else mvFail(m);
        }
        continue;
      }
      /* WIRE 133 -- INSTRUCT. THE TARGET TAKES A SECOND ACTION IN ONE TURN.
       *
       * 178 uses, and it resolved to `kind:'pass'` -- a wasted turn -- while what it actually does is
       * hand an ally a second attack, which is frequently the largest damage action on the board. It
       * is the only mechanic in this pass that changes how many actions a turn contains.
       *
       * THE REPEAT IS QUEUED, NOT EXECUTED HERE. Showdown does
       * `this.queue.prioritizeAction(this.queue.resolveAction({choice:'move', pokemon:target,
       * moveid:target.lastMove.id, ...}))` -- it builds an ACTION and puts it at the front of what is
       * left. Reproduced the same way: a new entry is spliced in behind this one at `TURN_ORDER.next`,
       * the same lane After You uses, so it resolves before every remaining move and passes through
       * every gate above (Protect, the type immunities, the secondaries) exactly as a first swing
       * would. Executing the move inline here would bypass all of them.
       *
       * THE REFUSALS ARE THE ARTIFACT'S AND THEY ARE NOT OPTIONAL. `refuses` is the set of move ids
       * carrying the flags Instruct's own handler checks -- `failinstruct`, `charge`, `recharge` --
       * and the first member of it is INSTRUCT ITSELF: an unrefused Instruct queues another Instruct
       * and the turn never ends. `!target.lastMove` is the other refusal and it is the one the probe's
       * negative arm stands on -- on turn 1 a body that has not yet acted has no last move at all, so
       * an Instruct that outruns its ally FAILS. */
      if(a.kind==='instruct'){
        m._lastMove=a.mv;
        const _ip=TAGS.param('move',a.mv,'instructsTarget')||{};
        const t=a.target&&!a.target.fainted&&a.target.curHP>0?a.target:null;
        const _mid=t&&t._lastMove;
        const _refused=_mid&&(_ip.refuses||[]).indexOf(_mid)>=0;
        if(!t||!_mid||_refused||t._charging||t._recharge){mvFail(m);continue;}
        const _side=actA.indexOf(t)>=0?'A':'B';
        const _foes=_side==='A'?actB:actA;
        const _pick=targetForMove(t,_mid,live(_foes),field);
        const _na=playerAction(t,_mid,(_pick&&_pick.target)||live(_foes)[0]||null,field);
        if(!_na||_na.kind==='pass'){mvFail(m);continue;}
        /* `|-singleturn|TARGET|move: Instruct|[of] SOURCE` -- data/moves.ts:9665. The INSTRUCTED body
         * is the subject and the instructor is the attribution, which is the opposite way round from
         * most `[of]` lines. */
        if(TR)TR.st1(t,'move: Instruct',m);
        const _entry={mon:t,side:_side,a:_na,tgtSlot:_na.target?_foes.indexOf(_na.target):-1,
          _order:TURN_ORDER.next,_pri:actionPriority({mon:t,side:_side,a:_na},field),_qc:0,_instructed:true};
        acts.splice(actIdx+1,0,_entry);
        MEDSEEN.instructRepeat++;
        continue;
      }
      /* WIRE 110 (STAGED consumer) -- SKILL SWAP exchanges the two abilities. Reaches here only once
         the staged tag_dex regeneration emits `swapsAbilities`; probed today through TAGS.__setDB.
         The un-swappable ability class (Showdown's failskillswap flag) is not modelled and is
         stated. */
      if(a.kind==='abilityswap'){
        m._lastMove=a.mv;
        const t=a.target&&!a.target.fainted&&a.target.curHP>0?a.target:null;
        if(t&&t!==m){
          const _isFoe=m._sf&&t._sf!==m._sf;
          const _ok=!_isFoe||(!(t.protect&&!TAGS.has('move',a.mv,'ignoresProtect'))
            &&!TAGS.has('ability',t.ability,'refusesStatusMoves')
            &&!moveClassBlocked(t,a.mv,m)&&!pranksterBlocked(m,t,a.mv));
          if(_ok){const _ab=m.ability;m.ability=t.ability;t.ability=_ab;
            if(TR){TR.act(m,'move: '+a.mv);TR.ab(m,m.ability,'[from] move: '+a.mv);TR.ab(t,t.ability,'[from] move: '+a.mv);}}
        }
        continue;
      }
      if(a.kind==='fixeddmg'){
        const t=a.target;
        if(t&&!t.fainted&&!t.protect&&t.curHP>0){
          /* Half the target's CURRENT hp, floored, and never less than 1 -- the move does not fail on
             a target at 1 HP, it takes it to 0. Type immunity still applies and is asked of mcEff
             rather than assumed: Super Fang is Normal, so a Ghost takes nothing. */
          const mv2=MC.moves[a.mv];
          const eff=mcEff(mv2?mv2.t:'',t.types);
          if(eff>0){
            const dmg=Math.max(1,Math.floor(t.curHP/2));
            t.curHP=Math.max(0,t.curHP-dmg);
            if(TR)TR.dmg(t);
            if(t.curHP<=0){t.fainted=true;if(t._sf)t._sf.fainted++;if(TR)TR.faint(t);}
          } else if(TR)TR.imm(t);
        }
        m._lastMove=a.mv;continue;
      }
      if(a.kind==='perish'){
        /* ROADMAP #81 WIRE 12 -- THE CLOCK IS SET TO 4 AND TICKS TO 3 BEFORE THE TURN ENDS, AND THIS
         * LINE USED TO SET 3 AND TICK TO 2 -- so every affected body on both sides FAINTED A FULL
         * TURN EARLY, on 1,141 corpus uses. Observed against the authority in a real doubles game:
         *
         *     Showdown   perish3 / perish2 / perish1 / perish0 + faint at the end of turns 1..4
         *     medicham   perish2 / perish1 / 0 + faint at the end of turns 1..3
         *
         * `perishsong.condition.duration` is 4 and `Battle#residualEvent` decrements a duration at
         * the end of EVERY turn including the one the volatile was added on, so both halves have to
         * be right together: setting 4 and skipping the first tick agrees on turn 1 and drifts after.
         * The tick is the residual block's and is probed beside this.
         *
         * NO `||3`. That fallback was the wrong number AND a silent default -- an artifact with no
         * `turns` would have gone on producing today's bug forever and looked like a working line.
         * A missing param now REFUSES the click and says so. */
        const _pc=TAGS.param('move',a.mv,'perishClock');
        const tn=_pc&&_pc.turns!=null?+_pc.turns:null;
        if(!tn){MEDFAILS.perishTurnsMissing++;m._lastMove=a.mv;mvFail(m);continue;}
        /* BOTH SIDES, which is the whole shape of the move: the user's own team is on the same clock,
           so it is only a win condition if you can outlast it. Not re-applied to a mon that already
           carries one -- clicking it twice does not reset the timer.
           THE ANNOUNCED NUMBER IS THE ONE THE BOARD WILL READ AT THE END OF THIS TURN. Showdown emits
           a silent `perish3` here and then the residual's own `perish3` after the tick, so a `perish4`
           line would be one this engine invented; `tn-1` is what both of the authority's lines say. */
        for(const x of [...actA,...actB])if(x&&!x.fainted&&x.curHP>0&&x._perish==null){x._perish=tn;if(TR)TR.vstart(x,'perish'+(tn-1));}
        if(TR)TR.push(['-fieldactivate','move: Perish Song']);
        m._lastMove=a.mv;continue;
      }
      if(a.kind==='yawn'){
        const t=a.target;
        /* WIRE 114 -- THE DROWSE ASKS THE SAME QUESTION THE SLEEP DOES. Showdown's yawn condition
           refuses on `!target.runStatusImmunity('slp')`, so an Insomnia or Purifying Salt body never
           takes the counter at all -- it does not carry a drowse that then quietly fails. This branch
           tested only `!t.status`, which is one clause of canTakeStatus, so the counter landed on
           bodies that could never fall asleep. One function answers "can this body be slept" for both
           routes now, which is CLAUDE.md's facts-are-global rule one field over. */
        /* WIRE 122 -- GOOD AS GOLD REFUSES YAWN, and this branch was the ONE foe-aimed status route
           that never asked. `refusesStatusMoves` is checked in nine other places in this file --
           `affect`, `phaze`, the pivot switch, the status branch and five more -- and a tenth copy is
           exactly the shape CLAUDE.md's facts-are-global rule forbids; it is written here anyway
           rather than hoisted because each of those nine sits beside a DIFFERENT set of companion
           gates (bounceOff, moveClassBlocked, powderBlocked), and collapsing them is a consolidation
           this pass is not scoped to make. It is FILED in docs/ENGINE.md as such.
           MEASURED AT THE PINNED COMMIT, both arms on the same Gholdengo: Good as Gold -> `vol=[]`,
           a Honey Gather control -> `vol=[yawn]`. Found by the generated matrix as
           `yawn -> goodasgold` (840 x 2,461), where medicham2's own two arms were IDENTICAL. */
        if(t&&!t.fainted&&!t.protect&&t._yawn==null&&canTakeStatus(t,'slp')&&!pranksterBlocked(m,t,a.mv)
           &&!(TAGS.has('ability',t.ability,'refusesStatusMoves')&&t!==m))
          /* +1 because the end-of-turn tick below fires on the APPLICATION turn too. Without it a
             delay of 1 puts the target to sleep on the turn Yawn was clicked, which is a turn early
             and turns a telegraphed threat into an instant one. Same correction the sealsMoves wire
             already carries for Encore. */
          {t._yawn=(+(TAGS.param('move',a.mv,'delayedSleep')||{}).delay||1)+1;if(TR)TR.vstart(t,'move: Yawn');}
        m._lastMove=a.mv;continue;
      }
      /* HELPING HAND marks the PARTNER, not the user. +5 priority means the mark is in place before
         any ordinary attack resolves, so the boost lands on the partner's move this turn -- which is
         the entire move. It is cleared at the top of the next turn beside protect and the redirection
         mark, because it does not persist. */
      if(a.kind==='helpinghand'){
        const ally=(it.side==='A'?actA:actB).find(x=>x&&x!==m&&!x.fainted&&x.curHP>0);
        if(ally){ally._helpingHand=true;if(TR)TR.st1(ally,'Helping Hand');}
        else mvFail(m);
        m._lastMove=a.mv;continue;
      }
      /* Setting the weather REPLACES whatever was up -- that is the whole counter-play, and it is why
         a Politoed answers a snow team (see the Aurora Veil note below). Five turns; the rock items
         that extend it carry `extendsDuration` and are not consumed here, so a Damp Rock reads as
         five. Named as a gap rather than silently rounded. */
      /* WIRE 64 -- A WEATHER MOVE CLICKED INTO ITS OWN WEATHER FAILS. Found by
         tests/test-game-diff.js on its first clean run, which is the whole reason that instrument
         exists: it is a TURN COUNTER and no single-hit comparison can see one. Torkoal's Drought puts
         sun up on turn 1 (duration 5, ticking to 4); clicking Sunny Day on turn 2 then read
         `medi=4 sd=3`, because this line refreshed the clock and the real engine fails the move
         outright. Confirmed directly against the official engine before it was touched.
         REPLACING A DIFFERENT WEATHER STILL WORKS, and that half is the counter-play the comment
         below is about -- a Politoed answering a snow team. Only the SAME weather fails. */
      if(a.kind==='weather'){
        const w=weatherId((moveFx(a.mv)||{}).weather);
        if(w&&field.weather!==w){
          field.weather=w;
          /* WIRE 70 -- THE ROCKS, and the artifact has carried the number since the item tags existed:
             `extendsDuration {extends:["sunnyday"], toTurns:8, insteadOf:5}` on Heat, Damp, Smooth and
             Icy Rock. The SCREEN branch above has read that tag since Light Clay was wired; this branch
             wrote a literal 5, so all four rocks were inert on the one mechanic they exist for -- three
             extra turns of sun, which on a Charizard-Y team is most of the game.
             Same tag, same shape, one consumer short, found by the weather audit. The comment beside
             the weather line used to say the rocks "are not consumed here" and named it a gap. */
          field.weatherT=weatherTurns(w,m.item);
          if(TR)TR.wx(w);
        } else mvFail(m);
        m._lastMove=a.mv;continue;
      }
      /* WIRE 32 -- CLICKING A TERRAIN MOVE. The four weather moves had a branch here since WIRE 13 and
         the four terrain moves had none, so Psychic Terrain fell through playerAction to `kind: pass`:
         a spent turn that changed nothing, on 141 corpus uses.
         THROUGH terrainId, and that is the point rather than a formality -- the artifact's
         `setsTerrain` param carries `psychicterrain` while `terrainSetter` on the ability side carries
         `psychic`, so writing the param straight in would have stored a word only ONE of this file's
         three readers matches. Same five turns and the same replacement rule as the weather. */
      if(a.kind==='terrain'){
        const _tp=TAGS.param('move',a.mv,'setsTerrain');
        const _t=terrainId(_tp&&_tp.terrain);
        /* WIRE 64, the terrain half. Same rule and landed in the same pass rather than waiting for the
           game differential to find it a second time: Showdown fails a terrain move whose terrain is
           already up, so refreshing the clock here would be the same wrong number one field over. */
        if(_t&&terrainId(field.terrain)!==_t){field.terrain=_t;field.terrainT=5;if(TR)TR.terrainStart(_t,null,m);}
        else mvFail(m);
        m._lastMove=a.mv;continue;
      }
      /* The redirector marks ITSELF; the retarget happens at the attacker's targeting step below, so
       * the ordering falls out for free — priority +2 means the mark is almost always set before any
       * normal-priority attack looks for it, and a redirector that moves after an attacker correctly
       * fails to catch it. The volatile name is kept rather than a boolean so the attacker's side can
       * apply Rage Powder's powder immunity without asking which move set the mark. */
      if(a.kind==='redirect'){m._redirect=a.mv;m._lastMove=a.mv;if(TR)TR.st1(m,'move: '+a.mv);continue;}
      /* WIRE 140 -- ALLY SWITCH. THE MOVE DID NOT EXIST HERE AT ALL, and it is the sharpest possible
       * test of WIRE 139's rule: it moves two bodies between slots with NEITHER of them leaving the
       * field, so the weaker "has my target left" question answers no and a Pokemon-first engine
       * follows the wrong body. Measured on a staged board before this branch existed: at the end of
       * turn 1 the two engines disagreed on TEN fields at once — both slots' species, hp, maxhp and
       * Defence stage, plus two party rows — from a single unimplemented move. 202 corpus uses.
       *
       * THE RULE IS SHOWDOWN'S (data/moves.ts:302 + Battle#swapPosition:1585):
       *   - it swaps the user with the body in the OTHER active slot and nothing else moves;
       *   - it FAILS if that slot is empty or holds a fainted body, and the failure is a `-fail`
       *     rather than a wasted-but-silent turn;
       *   - CONSECUTIVE USE DECAYS exactly like Protect but on its own counter: the volatile starts
       *     at 3 and triples per successful re-use, so the second use in a row is 1/3, the third
       *     1/9. A first use always works. The counter is NOT the Protect counter and sharing one
       *     would make a Protect the turn before shrink an Ally Switch.
       * The counter and its two-turn life are on the body; `_aswDur` is ticked down with the other
       * per-turn durations at the foot of the turn, so a gap year resets it. */
      if(a.kind==='slotswap'){
        m._lastMove=a.mv;
        const own=it.side==='A'?actA:actB;
        const me=own.indexOf(m), other=me===0?1:0;
        const partner=me>=0?own[other]:null;
        if(m._aswDur>0){
          const c=m._aswCount||1;
          if(rng()*c>=1){ m._aswDur=0; m._aswCount=0; mvFail(m); MEDSEEN.allySwitchStalled++; continue; }
          if(m._aswCount<729)m._aswCount=(m._aswCount||3)*3;
          m._aswDur=2;
        } else { m._aswCount=3; m._aswDur=2; }
        if(me<0||!partner||partner.fainted||partner.curHP<=0){ mvFail(m); continue; }
        own[me]=partner; own[other]=m;
        MEDSEEN.allySwitchSwapped++;
        if(TR)TR.st1(m,'move: '+a.mv);
        continue;
      }
      /* VOLUNTARY SWITCH. The slot is found by identity rather than passed in, because the action
         was built before the sort and the arrays can have been rewritten by an earlier switch this
         same turn. A switch with an empty bench does nothing and still costs the turn. */
      if(a.kind==='switch'){
        /* WIRE 65, the other half. Parting Shot (7,184 uses) is a STATUS move: blocked by Protect, it
           fails and the user STAYS. medicham2 switched anyway, so the single largest unmodelled move
           in the corpus was an unblockable pivot. Found by the same pair run -- Showdown kept Pangoro
           on the field where medicham2 had already brought Incineroar in.
           Only a move-driven switch is gated: `a.mv` is absent on a voluntary switch, which nothing
           blocks. */
        /* WIRE 139 -- RESOLVED ONCE, AT THE TOP, and used by the block gate below AND by the stat
           drop further down. Two reads of "who is the target" inside one branch is how they come to
           disagree; this is the same argument as the shared reader itself. */
        const _pt=reaimToSlot(a.target,it,actA,actB,a.mv);
        if(a.mv&&_pt&&!_pt.fainted
           &&((_pt.protect&&!TAGS.has('move',a.mv,'ignoresProtect'))
              ||moveClassBlocked(_pt,a.mv,m)                                 // WIRE 66
              ||TAGS.has('ability',_pt.ability,'refusesStatusMoves'))){m._lastMove=a.mv;
          if(TR){if(_pt.protect)TR.act(_pt,'move: Protect');else TR.imm(_pt);}
          continue;}
        /* WIRE 67 -- PARTING SHOT ACTUALLY DROPS THE TARGET. This engine has modelled the switch and
           not the -1 Attack / -1 Special Attack since pivotStatus was wired, and said so in a comment
           that ended "NO artifact this engine reads carries the numbers". It does now: tag_dex reads
           the literal `this.boost({atk:-1, spa:-1})` out of the handler, so `statChangeInCode` carries
           a table for the five members that have one and stays empty for the five that INVERT, COPY,
           SWAP or randomise their stages. 7,184 corpus uses -- the largest single unmodelled effect
           left, and the half that decides where the move is played.
           Confirmed against the official engine by tests/test-game-diff.js, which read
           `medi atk 0 / sd atk -1` on three separate generated pairs before this landed. */
        /* WIRE 139 -- AND THE PIVOT'S OWN DROP RESOLVES AT THE SLOT TOO. Parting Shot is 7,184 uses
           and it is a PIVOT, so both bodies can be moving in the same turn: the user leaves by its own
           move and the target can have left first by a faster one. This block read `a.target`
           directly, which meant a Parting Shot into a body that pivoted out ahead of it dropped a
           Pokemon on the bench and left the replacement untouched — the shape Will read off the
           turn-1 list as "Basculegion pivots out with Flip Turn, Archaludon comes in, SHOWDOWN has
           Archaludon at -1/-1 and we have 0/0". `_pt` is resolved once at the top of this branch. */
        if(a.mv&&_pt&&!_pt.fainted){
          const _sc2=TAGS.param('move',a.mv,'statChangeInCode');
          if(_sc2&&_sc2.boosts&&_sc2.on==='target'&&_pt.boosts){
            const _sg=invSign(_pt);   // WIRE 100b
            let _ref2=null;                // WIRE 3 -- refuse per stat, announce once
            for(const k in _sc2.boosts){
              const _s=SD2ENG[k]; if(!_s||_pt.boosts[_s]==null) continue;
              const _d=_sc2.boosts[k]*_sg;
              if(_d<0){ const _r=statDropRefusal(_pt,_s,a.mv,false);
                        if(_r){ _ref2=_ref2||_r; continue; } }
              const _b0=_pt.boosts[_s];
              _pt.boosts[_s]=clamp(_pt.boosts[_s]+_d,-6,6);
              if(TR)TR.bst(_pt,_s,_pt.boosts[_s]-_b0);
              /* WIRE 138 -- ONCE PER STAT LOWERED. `retaliateWhenLowered` is the shared reader; the
                 attacker is named so an ALLY's drop does not trigger it. */
              if(_d<0&&_pt.boosts[_s]!==_b0)retaliateWhenLowered(_pt,m);
            }
            if(TR&&_ref2&&_ref2.announce)TR.failUnboost(_pt,_ref2.label,_ref2.ab);
          }
        }
        const own=it.side==='A'?actA:actB, foes=it.side==='A'?actB:actA;
        const bench=it.side==='A'?benchA:benchB, sf=it.side==='A'?sfA:sfB;
        /* WIRE 92 -- `preventsSwitch` (Shadow Tag on Gengar-Mega) holds a VOLUNTARY switch. Only the
           bare switch is gated: `a.mv` present means a pivot MOVE (Parting Shot, Chilly Reception),
           which trapping does not stop in the real game either. The exemptions that ARE derivable
           from the body are applied -- a Ghost type always leaves, and a holder of the same tag is
           not held (the Shadow Tag mirror rule, read as tag-against-tag rather than a name).
           `onlyTypes` (Magnet Pull wants Steel) and `onlyGrounded` (Arena Trap) come from the
           params, which the tag_dex enrichment landed and this code reads -- the comment that used
           to sit here said those were "not in the params yet" and that both carriers over-trap, and
           it described a world that ended when the staged batch ran. Counted in
           MEDSEEN.trapBlockedSwitch, because a refusal that cannot prove it fired is assumed broken.

           SHED SHELL IS NOT HONOURED ON THIS BRANCH and that is a stated gap, not an oversight: the
           item lets its holder out of ability trapping too, and this dispatch was scoped to leave the
           ability branch alone. Zero corpus exposure today (Shadow Tag is Gengar-Mega; Magnet Pull
           and Arena Trap have none), and the move branch below does honour it. */
        if(!a.mv&&!(m.types||[]).includes('Ghost')&&!TAGS.param('ability',m.ability,'preventsSwitch')){
          const _held=foes.some(x=>{
            if(!x||x.fainted||x.curHP<=0)return false;
            const _ps=TAGS.param('ability',x.ability,'preventsSwitch');
            if(!_ps)return false;
            if(_ps.onlyTypes&&!_ps.onlyTypes.some(ty=>(m.types||[]).includes(ty)))return false;
            if(_ps.onlyGrounded&&!isGrounded(m))return false;   // WIRE 117 -- the shared predicate
            return true;
          });
          if(_held){MEDSEEN.trapBlockedSwitch++;continue;}
        }
        /* WIRE 116 -- THE PARTIAL TRAP HOLDS THE SWITCH, and until now it did not, anywhere. `_trap`
           was set (WIRE 51), chipped, expired and even taught to die with its trapper (WIRE 105) --
           and it appeared in no switch decision at all, so Fire Spin, Wrap, Infestation, Whirlpool,
           Sand Tomb, Thunder Cage and Magma Storm dealt their per-turn chip and let the victim walk
           out. That is most of what those moves are for. The comment at the site that SETS the trap
           said "the switch-blocking half is NOT modelled" and it is now, so that line is gone too.

           THE RULE, TAKEN OFF THE OFFICIAL ENGINE RATHER THAN FROM MEMORY -- all four arms played at
           the pinned commit and printed: a bare switch out of an Infestation is REJECTED with
           "Can't switch: The active Pokémon is trapped"; a GHOST type leaves freely and KEEPS the
           volatile and the chip (98/130 -> 82/130 over the following turn), which is why the exempt
           test is here at the switch and not at the tick; a SHED SHELL holder leaves; and U-turn
           pivots out of it, which the `!a.mv` gate above already expresses.

           Shed Shell is a NAME because the item carries no tag at all -- `data/tags.json` has no
           `shedshell` entry, so there is nothing to read by shape. Stated, in the place it is read. */
        if(!a.mv&&m._trap&&!(m.types||[]).includes('Ghost')
           &&String(m.item||'').replace(/[^a-z0-9]/g,'')!=='shedshell'){
          MEDSEEN.trapBlockedSwitchByMove++;continue;
        }
        const idx=own.indexOf(m);
        /* `a.to` names the replacement when the caller chose one. A switch action without it keeps
           the old behaviour of taking whoever is first, so nothing that used this before changes. */
        if(idx>=0)switchOut(own,idx,bench,foes,sf,field,a.to);
        continue;
      }
      /* ---- ROADMAP #81 WIRE 12 -- CURSE, BOTH HALVES --------------------------------------------
       *
       * `typeSplitMove` is the only tag in the taxonomy whose EFFECT depends on the USER, and Curse
       * is its only member (membership printed from the format dex before it was wired: exactly one
       * move carries `nonGhostTarget`). Both branches, from data/moves.ts:
       *
       *   NOT Ghost   `onModifyMove` retargets to `move.nonGhostTarget` ('self'), `onTryHit` DELETES
       *               the volatile and the onHit and substitutes `move.self = {boosts:{spe:-1,
       *               atk:1, def:1}}`. No HP is paid and no foe is touched. Authority, staged:
       *               `|-unboost|Farigiraf|spe|1` `|-boost|Farigiraf|atk|1` `|-boost|Farigiraf|def|1`.
       *   IS Ghost    the volatile lands on the FOE and `onHit` runs `directDamage(source.maxhp/2)`
       *               on the user. Authority, staged: Gengar 135 -> 68, and Garchomp then loses
       *               `baseMaxhp/4` = 45 at every residual.
       *
       * WHAT THIS WAS BEFORE, AND WHY IT WAS WORSE THAN ABSENT: the engine had `perTurnHP` (the 1/4
       * chip) tagged and nothing that PAID for it, so if the chip had ever been wired Curse would have
       * been a free permanent quarter-per-turn -- strictly better than the real move, and a search
       * learns to spam a move that is better than it should be. The chip and its price land together
       * here for exactly that reason.
       *
       * THE SELF-DROP IS NOT REFUSED BY THE CLEAR BODY CLASS. Every one of those handlers opens
       * `if (source && target === source) return;` -- a body may always lower its own stats -- so this
       * deliberately does NOT call statDropRefusal, which the foe-inflicted paths do. Contrary DOES
       * invert it, through the shared `invSign`, which is the same reader every other self-boost uses.
       *
       * NOT REACHABLE, STATED RATHER THAN CLAIMED: a PROTEAN body clicking Curse should convert to
       * Ghost first and take the Ghost branch. This engine converts only inside the `kind==='attack'`
       * branch (WIRE 54's site), so no status move triggers Protean here at all. That is a real gap
       * and it is not this wire's -- it is filed. The type is read HERE, at resolution, so anything
       * that does change the body's type before the click (Soak, Trick-or-Treat) is honoured. */
      if(a.kind==='typesplit'){
        const _ts=TAGS.param('move',a.mv,'typeSplitMove');
        m._lastMove=a.mv;
        if(!_ts){mvFail(m);continue;}
        const _isType=(m.types||[]).some(t=>String(t).toLowerCase()===String(_ts.splitsOnType||'').toLowerCase());
        if(!_isType){
          /* The NON-typed branch. `elseTarget` is 'self', so nothing is aimed at a foe and no
             accuracy, Protect or immunity gate applies -- the authority deletes the volatile and the
             onHit entirely and leaves a pure self-boost. */
          const _bo=_ts.elseBoosts;
          if(!_bo){mvFail(m);continue;}          // no numbers derived -> visibly unwired, not guessed
          const _sg=invSign(m);
          for(const k in _bo){
            const _s=SD2ENG[k]; if(!_s||m.boosts[_s]==null)continue;
            const _b0=m.boosts[_s];
            m.boosts[_s]=clamp(m.boosts[_s]+_bo[k]*_sg,-6,6);
            if(TR)TR.bst(m,_s,m.boosts[_s]-_b0);
          }
          MEDSEEN.curseNonGhost++;
          continue;
        }
        /* The TYPED branch. The target is an ordinary foe, so the ordinary refusals apply -- and
           Curse carries `ignoresProtect`, which bounceOff/the shield gate below already read. */
        const t=bounceOff(m,a.target,a.mv);
        if(!t||t.fainted||t===m){mvFail(m);continue;}
        if(t.protect&&!TAGS.has('move',a.mv,'ignoresProtect')){if(TR)TR.act(t,'move: Protect');continue;}
        if(TAGS.has('ability',t.ability,'refusesStatusMoves')){if(TR)TR.imm(t,'[from] ability: '+t.ability);continue;}
        if(pranksterBlocked(m,t,a.mv)){if(TR)TR.imm(t);continue;}
        /* ALREADY CURSED -> `return false` in onTryHit, and NO HP is paid. */
        if(t._ptDmg){mvFail(m);continue;}
        /* The volatile lands BEFORE the cost, which is `moveHit`'s own order (volatileStatus then
           onHit) and is the same order WIRE 7 established for the Substitute. */
        const _pt=TAGS.param('move',a.mv,'perTurnHP');
        if(_pt&&_pt.effect==='damage'&&_pt.on==='target'&&_pt.per){
          t._ptDmg={per:+_pt.per,by:a.mv};
          if(TR)TR.vstart(t,'Curse','[of] '+(m.name||''));
        }
        if(_ts.hasTypeCostFraction&&m.st){
          /* `directDamage` -- it ignores the target's own doll and cannot be prevented, and
             `clampIntRange` TRUNCS, so a 135 HP Gengar pays 67 and not 68. */
          m.curHP-=Math.max(1,Math.trunc(m.st.hp*+_ts.hasTypeCostFraction));
          if(TR)TR.dmg(m);
          if(m.curHP<=0){m.curHP=0;m.fainted=true;m._sub=0;if(TR)TR.faint(m);}
        }
        MEDSEEN.curseGhost++;
        continue;
      }
      /* ---- ROADMAP #81 WIRE 12 -- BATON PASS AND SHED TAIL ------------------------------------
       *
       * Will's spec for Shed Tail, verbatim: "SHED TAIL NEEDS A SUB" and "AND HP LOSS". All three
       * effects fire here, IN THE AUTHORITY'S ORDER, because the order is what decides what a failure
       * costs:
       *
       *   1. can anybody come in?           `onTryHit` -> `canSwitch(source.side)`; NOT_FAIL, so a
       *                                     Shed Tail with an empty bench costs NOTHING;
       *   2. do I already have a doll?      NOT_FAIL, free;
       *   3. `source.hp <= Math.ceil(source.maxhp / 2)`  -- CEIL, and this engine floored it;
       *   4. the doll goes up               `moveHit` adds `moveData.volatileStatus` BEFORE calling
       *                                     `moveData.onHit`, so `|-start|Substitute` precedes the
       *                                     `|-damage|`, which is the order WIRE 7 established;
       *   5. the HP is paid                 `directDamage(Math.ceil(maxhp / 2))`, which is a DIRECT
       *                                     damage: it ignores the doll that was just built;
       *   6. the body leaves, carrying what its `selfSwitch` string says it carries.
       *
       * BATON PASS PAYS NOTHING and passes the BOOSTS, which is the whole move. Neither move is named
       * in this block: everything above is read off `costsUserHP`, `substitute` and `passesState`, so
       * a third member of the family arrives without another branch.
       *
       * `mvFail` on every refusal, because Showdown emits `|-fail|` for all three and Stomping Tantrum
       * reads the result next turn. */
      if(a.kind==='passstate'){
        const own=it.side==='A'?actA:actB, foes=it.side==='A'?actB:actA;
        const bench=it.side==='A'?benchA:benchB, sf=it.side==='A'?sfA:sfB;
        const _ps=TAGS.param('move',a.mv,'passesState');
        m._lastMove=a.mv;
        if(!_live(bench).length){MEDFAILS.passesStateNoBench++;mvFail(m);continue;}
        const _cu=TAGS.param('move',a.mv,'costsUserHP');
        if(_cu&&_cu.costsFraction&&m.st){
          /* A SECOND DOLL FAILS AND COSTS NOTHING -- the same guard the generic cost block makes. */
          if(m._sub>0&&TAGS.has('move',a.mv,'substitute')){mvFail(m);continue;}
          /* THE THRESHOLD ROUNDS THE WAY THE COST DOES. `rounds` is derived from the handler
             (`directDamage(Math.ceil(...))` vs a bare division), so Shed Tail's CEIL and Substitute's
             TRUNC are the artifact's answer rather than one shared floor. Measured against the
             authority on a 137 HP Heliolisk: the cost is 69 there and this engine charged 68. */
          const _rnd=(_cu.rounds==='ceil')?Math.ceil:Math.floor;
          const _thr=_rnd(m.st.hp*(+_cu.failsBelow||+_cu.costsFraction));
          if(m.curHP<=_thr){mvFail(m);continue;}
          grantSubstitute(m,a.mv);
          m.curHP-=_rnd(m.st.hp*+_cu.costsFraction);
          if(TR)TR.dmg(m);
          if(m.curHP<=0){m.curHP=0;m.fainted=true;m._sub=0;if(TR)TR.faint(m);continue;}
        }
        const idx=own.indexOf(m);
        if(idx<0){mvFail(m);continue;}
        if(switchOut(own,idx,bench,foes,sf,field,a.to||a.pivotTo,_ps||{passesBoosts:false,passesVolatiles:[]}))
          MEDSEEN.passesStateSwitch++;
        continue;
      }
      /* SCREENS live on the SIDE, and `_sf` is the only per-side object a mon already carries — it is
       * handed to every member of the team by reference in battleInit, bench included, so a switch-in
       * walks under a screen that was up before it arrived. Storing this on the mon instead would
       * have quietly dropped the screen the moment anything switched.
       *
       * AURORA VEIL NEEDS SNOW. The tag records `needsWeather:true` — a BOOLEAN. It says THAT the
       * move needs weather, not WHICH, and the first version of this compared the weather string
       * against `true`, so the click failed in every sky including snow. The artifact cannot express
       * the requirement today, so the weather is named here and this comment is why; auroraveil is
       * the only halvesDamage move carrying the tag.
       *
       * This blocks SETTING it, which is the real rule and is why a Politoed switching in answers a
       * snow team — Drizzle replaces the snow and the Veil can no longer go up. A Veil ALREADY up is
       * not removed when the weather changes; it rides out its turns. That is why the gate is here at
       * the click and not in the end-of-turn tick. A failed click still costs the turn. */
      if(a.kind==='screen'){
        if(TAGS.has('move',a.mv,'failsWithoutWeather')&&(field.wSup||field.weather!=='snow')){m._lastMove=a.mv;mvFail(m);continue;}
        const sf=m._sf;
        /* ROADMAP #81 WIRE 8 -- A SCREEN ALREADY UP IS NOT RE-SET, AND THE MOVE FAILS.
         * `Side.addSideCondition` (sim/side.ts:420) returns false when the condition exists and the
         * condition declares no `onSideRestart`; none of the three screens does, so the move fails
         * and Showdown writes `|-fail|`. This engine wrote `|-sidestart|` and REFRESHED the clock,
         * which is a state bug that outlives the turn: a Reflect re-clicked on turn 4 halved
         * physical damage until turn 9 where Showdown's had already expired. */
        if(sf&&sf.sc&&sf.sc[a.mv]>0){m._lastMove=a.mv;mvFail(m);continue;}
        /* LIGHT CLAY, entirely from the item's own tag: it names WHICH screens it extends, the new
           duration and the one it replaces, so nothing about 8-vs-5 is written here and Damp/Heat/
           Icy/Smooth Rock stay untouched because they do not list these moves. */
        let turns=SCREEN_TURNS;
        const _ext=TAGS.param('item',m.item,'extendsDuration');
        if(_ext&&_ext.toTurns&&(_ext.extends||[]).some(nm=>String(nm).toLowerCase().replace(/[^a-z0-9]/g,'')===a.mv))
          turns=+_ext.toTurns;
        if(sf){
          (sf.sc=sf.sc||{})[a.mv]=turns;
          /* The screen is a SIDE condition named by the MOVE, so Reflect, Light Screen and Aurora Veil
           * each announce themselves — and now each expires under its own name too. */
          if(TR)TR.sstart(m,a.mv);
        }
        m._lastMove=a.mv;continue;
      }
      /* HEAL. The fraction is the move's own (Roost/Recover 1/2, Life Dew 1/4), and 'allies' spreads
       * it across the user's side while 'self' does not — Life Dew healing only its user would make
       * the most-clicked doubles restore look like a worse Recover. Capped at max HP, and a fainted
       * ally is not resurrected. */
      if(a.kind==='heal'){
        const _hp=healParam(a.mv);
        if(_hp){
          /* Max HP is `st.hp` — a mon carries curHP plus its stat block, and there is no maxHP field.
           * Written as maxHP first, which produced NaN on every heal rather than a wrong number, so
           * the test caught it; a silently wrong divisor would not have shown up at all.
           * The Heal Block gate is per BODY, not per click: Life Dew still restores the partner when
           * only the user is blocked. */
          /* ROADMAP #102 -- THE SIZE, PER BODY, AT THE MOMENT THE MOVE GOES OFF.
           *
           * Synthesis, Moonlight and Morning Sun (1,024 uses with Strength Sap) resolved to
           * `{kind:'pass'}` -- a wasted turn healing 0.000 HP in every sky including a clear one, and
           * in SAND the click was strictly worse than doing nothing because the residual still chipped
           * it. Measured before a line changed: from half HP, `healed 0` in clear/sun/rain and `-9` in
           * sand, against Recover's 77 on the same body.
           *
           * `md4096`, NOT a fraction. The handler is `this.heal(this.modify(pokemon.maxhp, factor))`
           * with factor literally 0.5 / 0.667 / 0.25, and `Battle#modify` is the 4096ths round-half-up
           * this engine already owns one implementation of. `maxhp * 0.667` is not `maxhp * 2/3` and
           * neither is the right answer -- the authority's own float is, run through its own rounding.
           *
           * THE SKY IS THE HEALER'S, through effWeatherOf, so Cloud Nine suppression and Mega Sol's
           * private sun both reach it exactly as they reach the damage formula. A weather this family
           * does not list (none of them lists `snow` differently from hail -- the artifact already
           * folded that) falls to `baseHealFraction`, which is the handler's own `let factor = 0.5`
           * default and not a silent fallback. */
          const _size=x=>{
            if(_hp.weather){
              const _w=effWeatherOf(field,x,null);
              const _bw=_hp.weather.byWeather&&_hp.weather.byWeather[_w];
              const _f=(_bw&&_bw.healFraction!=null)?+_bw.healFraction:+_hp.weather.baseHealFraction;
              return md4096(x.st.hp,_f);
            }
            return Math.floor(x.st.hp*_hp.fr[0]/_hp.fr[1]);
          };
          const amt=x=>{if(x&&x.st&&!healBlocked(x)){const _h0=x.curHP;
            x.curHP=Math.min(x.st.hp,x.curHP+_size(x));
            if(TR){if(x.curHP>_h0)TR.heal(x);else TR.fail(x,'heal');}}};
          if(_hp.allies){for(const x of (it.side==='A'?actA:actB))if(x&&!x.fainted&&x.curHP>0)amt(x);}
          else amt(m);
        }
        continue;
      }
      /* A status move inflicts the status THAT MOVE inflicts, at THAT MOVE's accuracy. This line used
       * to read `applyStatus(t, ['brn','par','slp'][rng()*3|0])` - a uniformly random pick, so Thunder
       * Wave burned a third of the time. The status and the accuracy now come from the rulebook. */
      if(a.kind==='status'){
        let t=bounceOff(m,a.target,a.mv);
        /* WIRE 137 -- A MOVE TARGETS A SLOT, AND THIS BRANCH WAS STILL TARGETING A BODY.
         *
         * The attack branch has resolved its aim to "whoever is in that slot NOW" since voluntary
         * switching existed; the status branch never did, so a Thunder Wave or a Leech Seed aimed at a
         * body that pivoted out in the same turn still resolved against it ON THE BENCH. The receipt
         * is in the protocol stream: `|-miss|p1b: Milotic|??: palafin-hero`, an identifier `ident()`
         * could not place, which is `MEDFAILS.traceBodyOffField` and which tests/test-protocol-trace.js
         * PART 6 says must read 0.
         *
         * `tgtSlot` was captured before the sort, while the board was still the pre-switch one, for
         * exactly this. An empty slot is a failed move rather than a re-aim -- there is nothing there.
         *
         * WIRE 139 -- AND IT NOW ASKS THE SHARED READER. The block that stood here re-aimed only when
         * the body had left the FIELD, so a body that merely changed SLOT (Ally Switch) was still
         * followed by object; `reaimToSlot` is the authority's rule and is the same one the attack and
         * effect branches use. `statusReaimedToSlot` is subsumed by `MEDSEEN.reaimedToSlot`. */
        t=reaimToSlot(t,it,actA,actB,a.mv);
        if(!t||t.fainted){mvFail(m);continue;}
        if(t.protect){if(TR)TR.act(t,'move: Protect');continue;}
        if(TAGS.has('ability',t.ability,'refusesStatusMoves')&&t!==m){if(TR)TR.imm(t,'[from] ability: '+t.ability);continue;}   // Good as Gold
        if(moveClassBlocked(t,a.mv,m)){if(TR)TR.imm(t);continue;}                 // WIRE 66
        const fx=moveFx(a.mv);
        const st=(fx&&fx.status)||null;
        /* WIRE 8 -- perTurnHP, the drain half. Leech Seed carries no major status, so this branch
         * discarded the click as "no effect" -- 8th-most-clicked status move, a no-op. The tag says
         * everything the wire needs: effect drain, 1/8 of the TARGET's max HP, healed to the user,
         * blocked by Grass -- the immunity comes from the move's own onTryImmunity, not a name here.
         * Curse/Salt Cure (effect 'damage') and the self-heals stay unconsumed until the engine can
         * host them honestly; a tag consumed HALF-right is how the 20-mechanic batch went wrong. */
        if(!st){
          const _pt=TAGS.param('move',a.mv,'perTurnHP');
          if(_pt&&_pt.effect==='drain'&&_pt.on==='target'&&_pt.per&&!t._seededBy
             &&!(_pt.immuneType&&t.types.includes(_pt.immuneType))
             &&!pranksterBlocked(m,t,a.mv)&&!subBlocks(m,t,a.mv)){
            const acc=hitChance(m,t,a.mv,field,{targetAlreadyMoved:!unresolved.has(t)});   // WIRE 124/129 -- one accuracy authority, not a second copy
            if(rng()*100<=acc){t._seededBy={by:m,per:_pt.per};if(TR)TR.vstart(t,'move: Leech Seed');}
            else if(TR)TR.miss(m,t);
          }
          /* WIRE 20's sealsMoves consumer USED TO BE HERE AND WAS UNREACHABLE. Encore, Disable and
           * Taunt all carry a volatile and no major status, so playerAction classifies them as
           * `affect` and this branch never saw one. Moved to where they actually resolve — search
           * WIRE 26 in the `kind==='affect'` block above. Left as a note rather than deleted
           * silently, because "the wire exists" was true of this line for a whole session. */
          m._lastMove=a.mv;
          continue;                                             // no major status to apply
        }
        m._lastMove=a.mv;
        if(subBlocks(m,t,a.mv)){if(TR)TR.act(t,'move: Substitute','[block]');continue;}   // WIRE 130 -- the doll takes the status move
        if(powderBlocked(t,a.mv)){if(TR)TR.imm(t);continue;}     // Grass / Overcoat / Safety Goggles
        if(pranksterBlocked(m,t,a.mv)){if(TR)TR.imm(t);continue;} // Prankster does not touch Dark types
        const acc=hitChance(m,t,a.mv,field,{targetAlreadyMoved:!unresolved.has(t)});   // WIRE 124/129 -- one accuracy authority, not a second copy
        if(rng()*100>acc){if(TR)TR.miss(m,t);continue;}          // status moves miss (T-Wave 90, W-o-W 85)
        /* applyStatus emits the `|-status|` itself; a REFUSED status (an immunity, an existing
         * status) returns false and emits `|-fail|`, which is what Showdown does. */
        /* WIRE 133 -- THE SOURCE TRAVELS WITH THE STATUS, and it has to: Safeguard refuses what the
         * OTHER SIDE writes and lets a self-inflicted status through, so a call that cannot say who
         * wrote it cannot be gated. This is the direct status-move path -- the one Safeguard exists
         * to answer. `applyStatus` emits its own refusal line, so the `-fail` below is only for the
         * immunity case. */
        if(!applyStatus(t,st,m)){m._mvRes=false;if(TR&&!sideBuffRefuses(t,m,'blocksStatus'))TR.fail(t);}
        continue;
      }
      /* ROADMAP #68 -- THE SHIELD'S PROTOCOL EVENT IS EMITTED HERE, WHERE THE ACTION RESOLVES, AND
       * NOT IN THE PRE-PASS THAT DECIDED IT. WIRE 119 raises the shield before any move resolves,
       * which is the correct MECHANIC and the wrong place for the EVENT: Showdown emits
       * `|move|X|Protect|X` + `|-singleturn|X|Protect` in speed order like any other move, and
       * emitting all four Protects at the top of the turn would put an ordering difference on every
       * game that contains one -- swamping exactly the signal this trace exists to carry.
       * A shield that lost its consecutive-use roll reads `m.protect === false` and Showdown answers
       * that with `|-fail|` and a `[still]` attribute on the move line (data/moves.ts:9929 and the
       * `attrLastMove('[still]')` beside it). */
      /* ROADMAP #84 -- HOISTED OUT OF THE `if(TR)`. A shield that lost its consecutive-use roll is a
       * move that FAILED, and that is a fact about the STATE -- Stomping Tantrum reads it next turn --
       * so it cannot be recorded only on runs that happen to have a trace attached. The announcement
       * still fires only when there is somewhere to announce to. */
      if(a.kind==='protect'||a.kind==='wideguard'){
        if(a.kind==='wideguard'?((it.side==='A'&&field.wgA)||(it.side==='B'&&field.wgB)):m.protect){
          if(TR)TR.st1(m,a.kind==='wideguard'?'Wide Guard':'Protect');
        } else { if(TR)TR.attrStill(); mvFail(m); }
      }
      if(a.kind!=='attack')continue;
      /* THE CHARGE TURN. Ten moves cost a turn before they land and this engine played all of them
       * in one, so Electro Shot was a free 130 BP nuke in any weather -- Will watched it click one
       * out of rain. The comment two hundred lines up said so and called it "stated, not fixed".
       *
       * Handled HERE, at execution, rather than inside playerAction or chooseAction, because both of
       * those build actions: a rule placed in one would be missing from the other, which is exactly
       * how the coverage bug that started this week happened.
       *
       * Three states in order. Already charging this move -> it fires now and the user comes back
       * down. Skippable -> it fires immediately and no turn is spent (Electro Shot in rain, Solar
       * Beam in sun, or a Power Herb, which is consumed). Otherwise -> spend this turn charging,
       * take the charge-turn stat boost if the move grants one, and go untargetable if this is one
       * of the five that leave the field. Every branch reads the artifact; nothing is named here.
       *
       * ROADMAP #81 WIRE 8 -- THE WIND-UP HAPPENS EVEN WHEN THE TURN IS NOT SPENT, and this engine
       * had the whole of it inside the "we are charging" branch. Read off the authority's own
       * handler, which every one of the ten carries in the same shape (data/moves.ts:17227 solarbeam,
       * :4640 electroshot -- and checked on all ten, `-prepare` sits above `ChargeMove` in each):
       *
       *     this.add('-prepare', attacker, move.name);      <-- ALWAYS, first
       *     this.boost({spa: 1}, attacker, ...);            <-- electroshot / meteorbeam, second
       *     if (weatherSkips) { attrLastMove('[still]'); return; }      <-- only then
       *     if (!this.runEvent('ChargeMove', ...)) return;              <-- and only then the Herb
       *
       * So the fix is three separate defects with one cause. (1) ORDER: the `|-boost|` was written
       * above the `|-prepare|`. (2) ANNOUNCEMENT: a skipped charge announced nothing at all, where
       * Showdown announces the wind-up and fires in the same turn. (3) STATE, and it is the one that
       * costs damage: ELECTRO SHOT IN RAIN FIRED WITH NO +1 SPECIAL ATTACK. Staged against the
       * official engine, Archaludon into a Snorlax under Drizzle -- Showdown 97, medicham2 65. */
      if(TAGS.has('move',a.move.id,'chargeTurn')){
        if(m._charging===a.move.id){
          m._charging=null; m._invuln=false;                    // release turn: fall through and hit
        } else {
          /* `|-prepare|ATTACKER|MOVE` -- sim/SIM-PROTOCOL.md:594, and it is unconditional. */
          if(TR)TR.prep(m,a.move.id);
          /* The charge turn is not always empty: Electro Shot and Meteor Beam raise Special
           * Attack as they wind up, which is most of why either is worth a turn. The boost comes
           * from the chargeTurn param, derived from the move's own onTryMove handler, so a new
           * one arrives with a regenerated artifact and no edit here. It is taken WHETHER OR NOT
           * the charge turn is spent, because the handler boosts above the weather test. */
          const _cp=TAGS.param('move',a.move.id,'chargeTurn'), _b=_cp&&_cp.boosts;
          if(_b)for(const _k of Object.keys(_b)){
            const _kk={spa:'sa',spd:'sd',atk:'at',def:'df',spe:'sp'}[_k]||_k;
            if(m.boosts&&_kk in m.boosts){const _b0=m.boosts[_kk];
              m.boosts[_kk]=Math.max(-6,Math.min(6,m.boosts[_kk]+_b[_k]));
              if(TR)TR.bst(m,_kk,m.boosts[_kk]-_b0);}
          }
          const _sk=TAGS.param('move',a.move.id,'chargeSkippedByWeather');
          const _herb=m.item==='powerherb';
          if(!(_sk&&_sk.skipsIn&&!field.wSup&&field.weather===_sk.skipsIn)&&!_herb){
            m._charging=a.move.id;
            m._invuln=TAGS.has('move',a.move.id,'semiInvulnerable');
            m._lastMove=a.move.id;
            continue;                                           // the turn is spent
          }
          /* Power Herb is consumed at the `ChargeMove` event, which is BELOW the boost and the
             announcement -- so the `|-enditem|` follows both. UNREACHABLE IN CHAMPIONS: the item is
             `isNonstandard: 'Past'`, checked against the format rather than remembered, so no probe
             is written for it and the branch is kept correct rather than deleted. */
          if(_herb){if(TR)TR.enditem(m,m.item);m.item='';}
        }
      }
      const mv=a.move.mv;
      /* the lock engages on the first attack a choiceLock holder commits (WIRE 18) */
      if(!m._lock&&TAGS.has('item',m.item,'choiceLock')){m._lock=a.move.id;m._lockT=Infinity;}m._lastMove=a.move.id;
      if(a.move.id==='fakeout'&&m._turnsOut>0){{if(TR)TR.attrStill();mvFail(m);}continue;}   // Fake Out only works the turn you enter
      /* WIRE 44 -- GIGATON HAMMER (197 uses) cannot be clicked twice in a row. `_noRepeat` is armed
         when the move lands and disarmed by the end-of-turn tick, so the block covers exactly the
         following turn -- and it binds a CALLER-SUPPLIED action as well as a chosen one, the WIRE 24
         rule, because a rollout driven from outside never asks chooseAction. */
      if(m._noRepeat===a.move.id){{if(TR)TR.attrStill();mvFail(m);}continue;}
      /* WIRE 45 -- THROAT CHOP (2,845 uses), from the target's side. The most-clicked mechanic left
         unwired: the move landed its damage and the two turns of silence it exists for did nothing.
         The DURATION comes from the artifact now (`blocksSoundMoves.turns`), not from a 2 typed here
         -- the same correction sealsMoves needed when Disable was given one turn instead of five.
         Blocked here AND filtered out of chooseAction, for the WIRE 24 reason above. */
      if(m._noSound>0&&TAGS.has('move',a.move.id,'sound')){if(TR)TR.cant(m,'move: Throat Chop');continue;}
      /* WIRE 46 -- DAMP. It stops a self-destructing move HAPPENING -- no damage and, critically, no
         faint -- and it reaches across the whole field rather than one side, which is what the tag's
         own `blocksSelfDestruct` records. Gated on `faints: 'always'`, which is exactly Explosion,
         Self-Destruct and Misty Explosion; Final Gambit and Memento carry `ifHit` and are NOT
         blocked by Damp in the real game either, so the split falls out of the artifact. */
      {
        const _uf0=TAGS.param('move',a.move.id,'userFaints');
        if(_uf0&&_uf0.faints==='always'
           &&[...actA,...actB].some(x=>x&&!x.fainted&&x.curHP>0&&TAGS.param('ability',x.ability,'blocksExplosion'))){
          /* `cant|HOLDER|ability: Damp|MOVE|[of] USER` -- data/abilities.ts:805, and like the
           * priority refusers the POKEMON field is the HOLDER rather than the user. */
          if(TR){const _d=[...actA,...actB].find(x=>x&&!x.fainted&&x.curHP>0&&TAGS.param('ability',x.ability,'blocksExplosion'));
                 TR.cant(_d,'ability: '+_d.ability,a.move.id,m);}
          continue;}
      }
      /* SUCKER PUNCH FAILS UNLESS THE TARGET IS ATTACKING THIS TURN.
       *
       * MEDICHAM applied no condition, so it dealt full damage into a target setting Tailwind and
       * into a target doing nothing -- the search saw a 70 BP priority move with NO DRAWBACK and
       * reached for it constantly. Will watched it lose a game clicking Sucker Punch into a Fake
       * Out, which is +3 against its +1: they flinch first and it never resolves.
       *
       * `acts` already holds every action committed this turn, so what the target is doing is known
       * without any new state. From the failsIfTargetNotAttacking tag, derived from the move calling
       * queue.willMove(target) -- which separates it from Quick Guard and Wide Guard, whose willAct()
       * does not care about the target at all. */
      /* WIRE 82, the consuming half. The shield went up at the top of the turn; this is where the
       * move finds out what happened while it waited. `failsIfHit` is Focus Punch, `failsUnlessHit`
       * is Shell Trap -- opposite signs of the same reading, both out of the tag's `mode`, so
       * neither move is named. Beak Blast has no failure condition and falls through to attack. */
      /* WIRE 88 -- STEEL ROLLER FAILS WITH NO TERRAIN UP, AND CLEARS THE TERRAIN WHEN IT LANDS.
       * Neither half existed: the engine played it as an unconditional 130 BP Steel move, so three
       * interaction-matrix rows had medicham2 attacking on a turn the reference engine had already
       * failed the move. `failsWithoutTerrain` is a new tag rather than a param on `terrainScaled`,
       * because that tag describes a power multiplier and can carry neither the failure nor the
       * removal. The clear is applied after the damage, below. */
      {
        const _ft=TAGS.param('move',a.move.id,'failsWithoutTerrain');
        if(_ft&&_ft.needsTerrain&&!field.terrain){m._lastMove=a.move.id;{if(TR)TR.attrStill();mvFail(m);}continue;}
      }
      if(m._preTurn&&m._preTurn.id===a.move.id){
        const _md=m._preTurn.p.mode,_wasHit=m._preTurn.hit;
        /* THE SHIELD COMES DOWN WHEN THE MOVE ITSELF RESOLVES (Showdown removes the volatile in Beak
         * Blast's onAfterMove), and leaving it up for the rest of the turn was a real second bug the
         * matrix caught: AVALANCHE is -4 priority against Beak Blast's -3, so it lands AFTER the
         * blast has already fired and must NOT be burned. Cleared before the failure check acts on
         * the reading, so the reading is still the one taken while the shield was up. */
        m._preTurn=null;
        if(_md==='failsIfHit'&&_wasHit){if(TR)TR.cant(m,a.move.id,a.move.id);continue;}
        if(_md==='failsUnlessHit'&&!_wasHit){if(TR)TR.cant(m,a.move.id,a.move.id);continue;}
      }
      if(TAGS.has('move',a.move.id,'failsIfTargetNotAttacking')){
        const _tgt=a.target;
        const _their=_tgt?acts.find(x=>x.mon===_tgt):null;
        const _attacking=!!(_their&&_their.a&&_their.a.kind==='attack');
        if(!_attacking){{if(TR)TR.attrStill();mvFail(m);}continue;}
      }
      /* BLOCKED PRIORITY FAILS OUTRIGHT. The sort above puts a priority move at the front of the
       * turn and, until now, let it connect regardless of Armor Tail, Queenly Majesty, Dazzling or
       * Psychic Terrain -- so every rollout and every self-play game had Sucker Punch beating a
       * Farigiraf. Checked against the side actually being aimed at. */
      /* WIRE 117 -- and against the BODY actually being aimed at, when there is one. `a.target` is
       * only handed over if it is still standing in that foe slot; a spread move, or an aim at
       * something that has already left, falls back to the whole-side read. */
      {
        const _foes=it.side==='A'?actB:actA;
        const _aim=(a.target&&_foes.indexOf(a.target)>=0&&!a.move.spread)?a.target:null;
        if(movePriority(a.move.id,field)>priorityRefusedAbove(_foes,field,_aim)){
          if(TR){const _h=_foes.find(x=>x&&!x.fainted&&x.curHP>0&&TAGS.param('ability',x.ability,'blocksMove'));
                 if(_h)TR.cant(_h,'ability: '+_h.ability,a.move.id,m);}
          continue;}
      }
      const foes=it.side==='A'?actB:actA;
      /* Resolve the aim to whoever is in that slot NOW. WIRE 139 -- through the shared reader, which
         is this site's own rule generalised: it was the ONLY branch that had it, and the version here
         re-aimed only when the body had left `foes`, so a body that changed SLOT on the same side
         (Ally Switch) was followed by object. It also gains the `tracksTarget` exception, which this
         site never had. */
      let aim=reaimToSlot(a.target,it,actA,actB,a.move&&a.move.id);
      let targets=a.move.spread?live(foes):[aim].filter(t=>t&&!t.fainted&&t.curHP>0);
      /* REDIRECTION APPLIES HERE, and only to SINGLE-TARGET moves aimed at the other side. Spread
       * moves already hit everything so there is nothing to draw, and the redirector must be a live
       * FOE of this attacker — a Follow Me on my own side does not pull my partner's attack.
       *
       * Rage Powder is a powder move, so a Grass type, Overcoat, or Safety Goggles ignores the draw
       * and hits what it aimed at; powderBlocked() already knows that and already lists ragepowder,
       * so the immunity is asked of the same helper Sleep Powder uses rather than restated. Follow Me
       * is not a powder and draws regardless. Getting this half-right — drawing everything, always —
       * would silently make every Amoonguss immune matchup wrong in the same direction. */
      if(!a.move.spread&&targets.length){
        const drawer=live(foes).find(f=>f&&f._redirect);
        if(drawer&&drawer!==targets[0]&&!powderBlocked(m,drawer._redirect)){
          /* Showdown REWRITES the target field of the move line it already emitted
           * (`retargetLastMove`, sim/battle.ts:3140) rather than adding an event, so the trace does
           * the same -- an extra line here would misalign every redirected turn in the differ.
           *
           * ROADMAP #81 WIRE 7 -- AND THE COMMENT ABOVE WAS RIGHT WHILE THE LINE UNDER IT WAS NOT.
           * It said "an extra line here would misalign every redirected turn" and then emitted one:
           * `TR.act(drawer, 'move: followme')`. Read `followme`'s and `ragepowder`'s conditions
           * (data/moves.ts): the ONLY thing either announces is `|-singleturn|X|move: Follow Me` on
           * the turn the move is USED -- which this engine already emits at the redirect action -- and
           * `onFoeRedirectTarget` returns the new target with no `add()` in it at all. Confirmed in
           * the authority: `|move|p1a: Garchomp|Thunderbolt|p2b: Maushold` and nothing else.
           *
           * THE ROADMAP'S READING OF THIS ONE DOES NOT SURVIVE THE SOURCE, and that is the honest
           * result. It filed the row `SD |-immune|p2b <> MC |-activate|p2b|followme` as "redirection
           * beating a type immunity". Redirection is NOT gated on immunity in Showdown -- Follow Me
           * redirects unconditionally and Rage Powder only asks `runStatusImmunity('powder')`, which
           * this engine already asks. The draw is right; the announcement was the defect. */
          targets=[drawer];
          if(TR)TR.retarget(drawer);}
        /* WIRE 25 -- redirectsType. Lightning Rod (1,901) and Storm Drain draw a move of their TYPE
         * to themselves, and the engine only ever looked for the Follow Me / Rage Powder volatile.
         * So an Electric move aimed past a Lightning Rod sailed straight into its partner.
         *
         * THE DRAW IS THE WHOLE MECHANIC HERE; THE ABSORB ALREADY WORKED. `lightningrod` carries
         * BOTH tags -- typeImmunity{type:Electric, gain:{spa:+1}} and redirectsType{type:Electric} --
         * and the immunity half has been live since WIRE 11. That is why the probe for this asserts
         * that the AIMED target stops taking the hit and the holder's Special Attack RISES, rather
         * than that the holder takes damage: it takes none, and the boost is the receipt.
         *
         * AFTER the volatile draw and only if that did not fire, because Follow Me and Rage Powder
         * outrank an ability redirect in the real order. Checked against the move's EFFECTIVE type
         * so an -ate-converted or weather-converted move is drawn by the rod it has actually become,
         * which is the same helper the immunity below uses -- one implementation of "what type is
         * this move really", not two. */
        if(targets.length&&!(drawer&&targets[0]===drawer)){
          const _t=effMoveType(mv,a.move.id,field,m);      // WIRE 126 -- the attacker, so an -ate move is drawn as what it BECAME
          const _rod=live(foes).find(f=>{
            if(!f||f===targets[0])return false;
            const _rt=TAGS.param('ability',f.ability,'redirectsType');
            return !!(_rt&&_rt.type===_t);
          });
          /* ROADMAP #81 WIRE 7 -- AND THE ABILITY REDIRECT ANNOUNCES THE OTHER WAY ROUND. Unlike
           * Follow Me, Lightning Rod and Storm Drain DO write a line when they pull, and it is an
           * `|-activate|` naming the ability, not an `|-ability|`:
           *     this.add('-activate', this.effectState.target, 'ability: Lightning Rod');
           * (data/abilities.ts onAnyRedirectTarget). `TR.ab` emitted `|-ability|`, which is the shape
           * Intimidate uses and a different event. Two redirect families, two announcements, and this
           * engine had them exactly swapped -- silence where a line belongs and the wrong line where
           * silence does. */
          if(_rod){targets=[_rod];if(TR){TR.act(_rod,'ability: '+_rod.ability);TR.retarget(_rod);}}
        }
      }
      /* WIRE 47 -- CRASH ON MISS. High Jump Kick, Axe Kick and Supercell Slam (209 uses) missed
         correctly and cost the user nothing, so a 90%-accurate 130 BP move had no downside at all --
         the same "priority move with no drawback" shape that made the search reach for Sucker Punch.
         The fraction is the tag's (`crashOnMiss.fraction`, half of max HP), not a number typed here.

         WIRE 129 -- MOVED DOWN HERE, BELOW TARGET RESOLUTION AND REDIRECTION, and the move is the
         whole point: accuracy now depends on the DEFENDER (its evasion stage, its Bright Powder, its
         Sand Veil, its No Guard) and above this line there is no defender yet. Nothing between the
         old site and this one consumes rng, so the random stream is unchanged and the interaction
         matrix stays byte-identical -- checked, not assumed.

         ONE ROLL PER MOVE, NOT PER TARGET, AND THAT IS A DECLARED DIVERGENCE. Showdown rolls
         accuracy separately against each target of a spread move. Rolling per target here would
         change how much rng every existing seeded run consumes, which is a far larger change than
         this wire is buying; so a SPREAD move rolls once, against no defender, and gets the
         attacker's modifiers only. Single-target moves -- where every evasion item and ability in
         this format actually lives -- get the real defender. */
      /* ROADMAP #81 WIRE 1 -- THE ACCURACY ROLL MOVED BELOW THE SHIELD, and the header above still
         describes where it USED to sit. Showdown's hit steps are ordered
         (sim/battle-actions.ts:553-576): 0 invulnerability, 1 TryHit -- which is where Protect,
         Wide Guard and the absorbing abilities live -- 2 type immunity, 3 move-specific immunity,
         and only then 4 ACCURACY. A shield therefore preempts the to-hit roll entirely: the move is
         BLOCKED, it does not MISS, and no die is thrown. This engine rolled first, so a 90%-accurate
         move into a Protect printed `|-miss|` where the authority prints
         `|-activate|X|move: Protect` -- five games of the 2026-08-07 differential.
         The block itself is `_protectGate` below; the roll follows it. */
      if(!targets.length)targets=live(foes).slice(0,1);
      /* ROADMAP #81 WIRE 1 -- WAS THERE ANYTHING TO AIM AT AT ALL. Showdown separates two failures
         that look alike from the outside: a move with NO legal target returns before the hit steps
         run (`add('-fail'); return false` at sim/battle-actions.ts:511) and never reaches MoveFail,
         while a move whose targets were all shielded or immune reaches it and pays the crash. Read
         BEFORE the Wide Guard line below, because Wide Guard emptying the list is the second case. */
      const _hadTargets=targets.length>0;
      /* ROADMAP #84 -- NOTHING LEGAL TO AIM AT IS A FAILURE THAT COUNTS. `useMoveInner` writes
       * `add('-fail', pokemon)` and `return false` (battle-actions.ts:509-511) without ever touching
       * `moveThisTurnResult`, so `useMove`'s own line then sets it to that false. */
      if(!_hadTargets)m._mvRes=false;
      /* ROADMAP #84 -- and the two outcomes of the hit steps, which are NOT both `false`.
       * `_explicitFail` is Showdown's `atLeastOneFailure`: a hit step that returned literal `false`
       * against some target. Type immunity, a move-class immunity and semi-invulnerability all return
       * false and therefore COUNT; an absorbing ability's onTryHit returns null and does NOT, which
       * is why this is a flag rather than `!_reached`. */
      let _explicitFail=false;
      /* WIRE 54 / ROADMAP #81 WIRE 7 -- PROTEAN CONVERTS *BEFORE* THE HIT, AND THAT IS THE WHOLE
         ABILITY. The user BECOMES the type of the move it is about to use, so the move gets the new
         STAB; `oncePerSwitchIn` is the Gen-9 rule and is the tag's own field, and `_proteanUsed` is
         cleared by switchOut beside the other one-shot flags.

         WIRE 54 PLACED IT AFTER THE MOVE RESOLVED and called that "the wrong order by a hair" because
         re-pricing `d` looked expensive. It is not a hair and `d` is not priced here: the hit site
         recomputes `dmgRange(m,tg,...)` per target, so moving the conversion above it costs nothing
         and buys the STAB. MEASURED BEFORE THE MOVE, both arms, Meowscarada into an unfaintable
         Ceruledge with Earthquake (Ground, a type it does not have): no ability 123, Protean 123 --
         the ability's offensive half was worth EXACTLY ZERO.

         AND `onPrepareHit` IS ABOVE EVERY HIT STEP, NOT JUST THE DAMAGE. sim/battle-actions.ts:591
         fires it in `trySpreadMoveHit` BEFORE the eight-step list -- before invulnerability, before
         the TryHit event that Protect answers, before type immunity and before the accuracy roll. So
         a Protean body converts even into a Protect and even on a miss, which the differential caught
         as `|-start|p2b|typechange|fighting|[from]protean <> |-activate|p1a|protect`: this engine
         emitted nothing at all there, because a fully-shielded move `continue`s above the old site.

         GATED ON `_hadTargets` because Showdown returns from `useMoveInner` before PrepareHit when
         there is nothing legal to aim at. */
      /* WIRE 141 -- FLING, AND IT IS THE SAME QUESTION KNOCK OFF ASKS, FROM THE OTHER SIDE.
       *
       * Knock Off takes the TARGET's item; Fling spends the USER's own. Both hang off "can this item
       * leave this body right now", and `itemRefusesTake` is the one reader both of them ask.
       *
       * THE AUTHORITY'S ORDER IS UNUSUAL AND IS REPRODUCED RATHER THAN GUESSED (`data/moves.ts`
       * fling.onPrepareHit):
       *     1. `if (source.ignoringItem(true)) return false;`
       *     2. `if (!this.singleEvent('TakeItem', item, ...)) return false;`   -- the refusal, FIRST
       *     3. `if (!item.fling) return false;`
       *     4. `move.basePower = item.fling.basePower;`                        -- the power, LAST
       * So the power is item-dependent AND the move FAILS OUTRIGHT for an item that cannot be thrown.
       * A fix that spent the item but kept a fixed base power is wrong in a way the board shows, which
       * is why the two halves land together.
       *
       * IT SITS AT `onPrepareHit`, WHICH IS ABOVE EVERY HIT STEP -- above Protect, above type
       * immunity, above the accuracy roll -- so a Fling that gets shielded has still spent the item.
       * That is the authority's behaviour (the `fling` volatile it adds here consumes the item
       * regardless of what the hit does) and it is the reason this block is at this line rather than
       * beside the damage.
       *
       * STEP 3 HAS NO MEMBER IN THIS FORMAT and that is measured, not assumed: all 148 legal items
       * carry a `fling` entry. It is still written, because a format change is exactly the event that
       * would make an unwritten branch a silent zero.
       *
       * MAGIC ROOM IS STEP 1 AND IS ANSWERED FOR FREE. This engine implements the room as a SWAP of
       * the item slot (see itemRoomSync), so a body inside one is holding nothing as far as this
       * block is concerned and the throw fails -- which is what `ignoringItem` produces upstream. */
      m._flingFx=null; m._flingBP=null;
      {
        const _fo=TAGS.param('move',a.move.id,'flingsOwnItem');
        if(_fo&&_fo.consumes){
          const _fp=TAGS.param('item',m.item,'flingable');
          const _refused=!m.item||itemRefusesTake(m)||!_fp||!(+_fp.basePower>0);
          if(_refused){
            MEDSEEN.flingRefused++;
            m._lastMove=a.move.id;
            if(TR)TR.attrStill();
            mvFail(m);
            continue;
          }
          /* THE POWER IS RESOLVED AND STAMPED BEFORE THE ITEM GOES, which is the authority's order
           * inverted into this engine's shape: Showdown writes `move.basePower` off a live item and
           * consumes it afterwards, and this engine has no per-use move object to write onto. The
           * stamp is what `flingBasePower` prefers, so the hit step prices the throw off the item
           * that WAS held rather than off an empty hand. */
          m._flingBP=+_fp.basePower;
          m._flingFx={status:_fp.status||null,volatile:_fp.volatileStatus||null};
          {const _it=m.item;m.item='';
           if(TR)TR.enditem(m,_it,'[from] move: '+a.move.id);}
          MEDSEEN.flingThrown++;
        }
      }
      if(_hadTargets){
        const _tb=TAGS.param('ability',m.ability,'typeBecomesMoveType');
        if(_tb&&!m.fainted&&!(_tb.oncePerSwitchIn&&m._proteanUsed)){
          const _nt=effMoveType(mv,a.move.id,field,m);   // WIRE 126 -- Protean becomes the CONVERTED type
          if(_nt&&!(m.types.length===1&&m.types[0]===_nt)){m.types=[_nt];m._proteanUsed=true;
            if(TR)TR.vstart(m,'typechange',_nt+'|[from] ability: '+m.ability);}
        }
      }
      /* spreadAll hits the PARTNER too -- Earthquake beside your own Archaludon costs it the same
       * 0.75x packet the enemies eat. Membership from the artifact; the ally is appended AFTER the
       * Wide Guard check below because Wide Guard protects a SIDE, and the attacker's own side
       * never raised it against its own quake. */
      const _allyHit=a.move.spread&&HITS_ALLY.has(a.move.id)
        ?(it.side==='A'?actA:actB).find(x=>x&&x!==m&&!x.fainted&&x.curHP>0):null;
      /* ROADMAP #81 WIRE 11 -- THE SPREAD MODIFIER IS DECIDED BY TARGETS *ENTERED*, NOT TARGETS HIT.
       *
       *     if (targets.length > 1 && !move.smartTarget) move.spreadHit = true;
       *
       * is the FIRST line of `trySpreadMoveHit` (sim/battle-actions.ts:551) -- above the whole step
       * list, so nothing any step does to the array can take the modifier back off. Two consequences,
       * and this engine had them the wrong way round on the one that matters:
       *
       *   - A PARTNER PROTECTS. It is still alive and still in the array, so length is 2 and the
       *     0.75 applies to the one body that actually gets hit. Observed live: Dazzling Gleam into a
       *     Protecting Pelipper beside an Archaludon read 130/165 in the authority against 118/165
       *     here -- 35 against 47, a ratio of 0.745. This engine read `targets.length>1` at the
       *     DAMAGE step, by which point the shield had already removed the Pelipper.
       *   - A PARTNER IS ALREADY FAINTED. `Side#allies()` filters `!!pokemon.hp` (sim/side.ts:388)
       *     before `getMoveTargets` builds the array, so it never enters, length is 1, and the
       *     survivor takes FULL damage. THIS HALF WAS ALREADY RIGHT here for the same reason --
       *     `live(foes)` filters the same bodies -- and it is probed rather than assumed, because
       *     the fix below is one line away from breaking it.
       *
       * READ HERE, which is the position that corresponds to Showdown's: after target resolution and
       * redirection, after the ally is known, and ABOVE the Wide Guard block and the Protect gate --
       * both of which live in Showdown's step 1 and therefore run after this line. `smartTarget`
       * (Dragon Darts) has no representation in this engine, so no exclusion for it is written; the
       * one move that carries it does not exist in this format's damage path. */
      const _spreadHit=!!a.move.spread&&(targets.length+(_allyHit?1:0))>1;
      /* ROADMAP #81 WIRE 9 -- WIDE GUARD NAMES THE BODY IT SHIELDED, ONE LINE PER BODY.
       *
       * `this.add('-activate', target, 'move: Wide Guard')` (data/moves.ts, wideguard's condition)
       * fires inside the per-target TryHit event, so `target` is the shielded Pokemon and there is one
       * line for each. This engine emptied `targets` first and then wrote a single line with an EMPTY
       * body field -- `|-activate||move: Wide Guard` -- so the differ read `|-activate|p1a|wideguard
       * <> |-activate|wideguard`.
       *
       * IT WAS UNREACHABLE UNTIL THIS WIRE AND IS THEREFORE THIS WIRE'S TO FIX. A spread click from a
       * driver reading Showdown's request carried no target, so it never became an `attack` action and
       * never reached this branch at all; the WIRE 9 ladder rung opened a whole new divergence class
       * (`-activate: a different body`, 18 games) the moment the family started resolving. */
      if(a.move.spread&&((it.side==='A'&&field.wgB)||(it.side==='B'&&field.wgA))){
        if(TR)for(const _wg of targets)TR.act(_wg,'move: Wide Guard');
        targets=[];}
      /* ROADMAP #81 WIRE 9 -- THE PARTNER IS HIT FIRST, NOT LAST, and that is Showdown's own order
       * rather than a preference. `Pokemon.getMoveTargets` (sim/pokemon.ts:809) builds an
       * `allAdjacent` list as `push(...adjacentAllies())` and only THEN falls through to
       * `push(...adjacentFoes())`, so an Earthquake resolves against your own partner before either
       * opponent. Read off a staged battle in the authority rather than off the switch statement
       * alone: `|move|p1a: Garchomp|Earthquake|p2b: Tyranitar|[spread] p1b,p2a,p2b`.
       *
       * The APPEND stays below the Wide Guard check for the reason the comment above gives -- a Wide
       * Guard is the FOE side's condition and does not shield my partner from my own quake -- so this
       * is a prepend at the same site and not a move to a different one.
       *
       * OPENED BY THIS WIRE. `spreadAll` clicks (earthquake 7,913 uses and five others) arrived here
       * only once a targetless spread click became a real attack action; the WIRE 9 rung grew
       * `|-immune|pXX <> |-supereffective|pXX` from 0 to 38 and `|-immune|pXX <> |-damage|pXX` from 3
       * to 30 the moment they did. */
      if(_allyHit)targets=[_allyHit].concat(targets);
      /* SCREENS BREAK. Brick Break, Psychic Fangs and Raging Bull carry `clearsScreens`, so the set
         comes from the artifact rather than three names here. It fires on USE, before damage, which
         is the real rule -- the screen is gone for this very hit, not the next one. */
      if(TAGS.has('move',a.move.id,'clearsScreens')){
        const fsf=(it.side==='A'?actB:actA).map(x=>x&&x._sf).find(Boolean);
        if(fsf){
          /* One `|-sideend|` per screen that was actually up, UNDER ITS OWN NAME and in the order
           * Brick Break's own handler walks them (data/moves.ts:1833) -- see screenIds(). Until
           * ROADMAP #81 WIRE 8 this engine kept two counters keyed by damage category and had to
           * announce `Reflect` for the physical one and `Light Screen` for the special one, so a
           * broken Aurora Veil read as both. */
          const _sd=it.side==='A'?'p2':'p1';
          for(const _id of screenIds(fsf)){delete fsf.sc[_id]; if(TR)TR.sendSide(_sd,_id);}}
      }
      /* WIRE 48 -- IGNORES PROTECT, computed once for the move rather than per target. Feint (375
         uses) and Phantom Force (399) went through Protect in the real game and were stopped here,
         and Roar, After You, Decorate and ten other status moves were stopped by it too. Read once
         because it is a property of the MOVE, and used at BOTH the block and the Piercing Drill
         quarter below -- a move that ignores Protect deals FULL damage, not a quarter of it. */
      const _thruProtect=TAGS.has('move',a.move.id,'ignoresProtect');
      /* ROADMAP #81 WIRE 1 -- THE CRASH IS AN onMoveFail, NOT AN onMiss, and that is not a rename.
       *
       * `crashOnMiss` was consumed at exactly one site: the accuracy roll. Showdown fires it from
       * `singleEvent('MoveFail', ...)` (sim/battle-actions.ts:526), which runs on ANY falsy move
       * result -- a miss, a Protect, a type immunity, an absorbing ability, a Wide Guard. Measured in
       * the authority, both arms pinned:
       *     High Jump Kick -> a Protecting Garchomp  |-activate|p2a|move: Protect
       *                                              |-damage|p1a: Hitmonlee|63/125|[from] highjumpkick
       *     High Jump Kick -> Gengar (Ghost)         |-immune|p2a
       *                                              |-damage|p1a: Hitmonlee|0 fnt|[from] highjumpkick
       * This engine charged nothing in either case, so High Jump Kick (146 sets), Supercell Slam (88)
       * and Axe Kick were free to throw into a shield -- the same "priority move with no drawback"
       * shape WIRE 47 was written to remove, left open on the half of the rule nobody had measured.
       *
       * THE `[from]` FIELD IS THE MOVE'S OWN ID. Showdown passes `dex.conditions.get('High Jump
       * Kick')`, which is not a real condition, so the protocol prints its id -- `[from] highjumpkick`,
       * read off the log above and not off SIM-PROTOCOL.md. This engine printed `[from] Recoil`, which
       * is a different field and would part the streams on the one line the crash emits. */
      const _crashOnFail=()=>{
        const _cm=TAGS.param('move',a.move.id,'crashOnMiss');
        if(!(_cm&&_cm.fraction&&m.st))return;
        m.curHP-=Math.floor(m.st.hp*+_cm.fraction);
        if(TR)TR.dmg(m,'[from] '+a.move.id);
        if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);}
      };
      /* ROADMAP #81 WIRE 1 -- STEP 1: THE SHIELD, HOISTED OUT OF THE DAMAGE LOOP AND ABOVE THE ROLL.
       *
       * A PROTECT BLOCK AND A TYPE IMMUNITY ARE DIFFERENT STATES and this engine could not tell them
       * apart, because its per-target gates ran type-immunity FIRST. Supercell Slam is Electric and
       * makes contact: clicked into a Ground type behind a Spiky Shield the authority emits
       *     |-activate|p2a: Garchomp|move: Protect
       *     |-damage|p1a: Bellibolt|97/184|[from] Spiky Shield|[of] p2a: Garchomp
       *     |-damage|p1a: Bellibolt|5/184|[from] supercellslam
       * -- the shield answers first, so the contact toll is paid AND the crash lands. medicham2
       * printed a bare `|-immune|` and charged neither. Protect carries `onTryHitPriority: 3`, above
       * every absorbing ability's default 0, which is why it is checked before `absorbedBy` too.
       *
       * The blocked bodies are REMOVED from `targets`, so an emptied list is what the fail path
       * reads -- there is no second "was it blocked" flag to keep in step with this one. */
      if(targets.length){
        const _through=[];
        for(const tg of targets){
          if(!tg||tg.fainted){_through.push(tg);continue;}
          if(!(tg.protect&&!_thruProtect&&!(m.ability==='piercingdrill'&&mv.c==='P'))){_through.push(tg);continue;}
          /* WIRE 61 -- THE SHIELD BITES BACK, 1,867 corpus clicks. Spiky Shield, Baneful Bunker and
           * King's Shield blocked correctly and punished nothing, so all three were simply Protect --
           * and the reason to click one over Protect is the entire punish.
           * WHAT it costs is the artifact's now, and it had to be: the param was `{onContact:true}`
           * for all three, and the three do COMPLETELY different things -- 1/8 of the toucher's HP,
           * poison, and -1 Attack. A consumer that guessed would have been wrong on two of the three.
           * WHICH shield went up is read off the mon, because `protect` is a boolean and every
           * Protect-family move sets it. Contact is asked of the same helper Rough Skin uses. */
          if(TR)TR.act(tg,'move: Protect');
          const _pc=TAGS.param('move',tg._protectMove,'punishesContact');
          if(_pc&&_pc.onContact&&mvMakesContact(a.move.id)){
            if(_pc.fraction){m.curHP-=Math.floor(m.st.hp/(+_pc.fraction));
              if(TR)TR.dmg(m,'[from] move: '+tg._protectMove,tg);
              if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);}}
            if(_pc.inflicts&&!m.fainted)applyStatus(m,CODE_OF_STATUS[_pc.inflicts]||_pc.inflicts);
            if(_pc.boosts&&m.boosts&&!m.fainted)for(const k in _pc.boosts){
              const _s=SD2ENG[k];if(_s&&m.boosts[_s]!=null){const _b0=m.boosts[_s];
                m.boosts[_s]=clamp(m.boosts[_s]+_pc.boosts[k],-6,6);
                if(TR)TR.bst(m,_s,m.boosts[_s]-_b0);}
            }
          }
        }
        targets=_through;
      }
      /* EVERY TARGET SHIELDED -> the move FAILED, so no accuracy die is thrown and the crash is paid.
         `_hadTargets` keeps the no-legal-target case out of this, which Showdown returns on earlier. */
      /* ROADMAP #84 -- AND A FULLY-SHIELDED MOVE IS THE COUNTER-INTUITIVE `null`. Protect's onTryHit
         returns `this.NOT_FAIL` -- the empty string (sim/battle.ts:272) -- which is falsy but is NOT
         `false`, so `atLeastOneFailure` stays false and battle-actions.ts:616 writes null. A Stomping
         Tantrum thrown into a Protect therefore does NOT double next turn, while one that MISSED
         does. Read off the source rather than reasoned about, because every intuition here is wrong. */
      if(_hadTargets&&!targets.length){m._mvRes=null;_crashOnFail();continue;}
      /* ROADMAP #81 WIRE 10 -- THE ACCURACY ROLL IS STEP 4, AND IT USED TO SIT HERE, AT STEP 0.
       *
       * Showdown's `moveSteps` (sim/battle-actions.ts:555-577) runs invulnerability, TryHit, type
       * immunity and move-specific immunity BEFORE the die, and a target dropped by one of those never
       * reaches the roll -- so an immune body is announced `|-immune|` and never `|-miss|`, whatever
       * the roll would have been. This engine rolled first, so a losing roll turned every immunity in
       * the move into a miss. The whole block below now lives in `_stepAccuracy`, in the step list,
       * with its own comments carried down with it. */
      let dealt=0,connected=false;
      /* ROADMAP #81 WIRE 1 -- how many targets got past EVERY gate. Showdown's `moveResult` is
         `!!targets.length` after the whole step list (sim/battle-actions.ts:614), so a move whose
         only target was immune, absorbed or semi-invulnerable is a FAILED move and pays the crash
         exactly as a blocked one does. Counted rather than inferred from `connected`, which is set
         after the substitute check and would call a move that hit a Substitute a failure. */
      let _reached=0;
      /* WIRE 87 -- THE DRAIN HEAL HAPPENS DURING THE MOVE AND THE CONTACT TOLL AFTER IT, and this
       * engine had the order the other way round. It only shows on a FULL-HP attacker, which is why
       * it needed the generated matrix to find: medicham2 paid Rough Skin's 1/8, then healed and
       * clamped back to full, so `hurt` read FALSE where Showdown reads TRUE. Four carriers at once
       * -- Draining Kiss (865), Bitter Blade (380), Leech Life (136), Horn Leech (11).
       * The heal is still applied below, where the accumulated `dealt` is known; what is captured
       * here is the HP the CLAMP must be measured against. */
      const _hpPreReact=m.curHP;
      /* ================= ROADMAP #81 WIRE 10 -- THE HIT IS A STEP LIST OVER THE TARGET ARRAY =======
       *
       * THIS IS A SHAPE, NOT A MECHANIC. Showdown never resolves a target; it resolves a STEP, and
       * each step walks every target before the next one begins. `trySpreadMoveHit`
       * (sim/battle-actions.ts:550) holds eight of them -- invulnerability, TryHit, type immunity,
       * move-specific immunity, accuracy, break-protect, steal-boosts, then the hit loop -- and
       * `spreadMoveHit` (:1023) numbers six more inside the last: substitute, getSpreadDamage,
       * spreadDamage, runMoveEffects, selfDrops/secondaries, forceSwitch. Every one is
       * `for (const i of targets.keys())`.
       *
       * THIS ENGINE RAN ONE LOOP OVER THE TARGETS AND THE WHOLE MOVE INSIDE IT. Every mechanic in it
       * was individually right and the ORDER was wrong for the whole family, which is why nine wires
       * moved the median first-divergence LINE and never moved the median divergence TURN off 1: a
       * per-target loop parts from a per-step one on turn 1 of almost any doubles game containing a
       * spread move, however many mechanics agree.
       *
       * THE SAME PATH SERVES ONE TARGET AND FIVE, which is the other half of the point -- Showdown
       * has no single-target path either, only an array of length 1. `_STEPS` below is the moveSteps
       * array and the driver under it is the two nested loops, in Showdown's order. Reverse the two
       * `for`s and you have the engine as it stood before this wire; that is exactly what
       * `tests/probe_red_demo.js` reverts, and at one target the two orders are identical by
       * construction, which is why a single-target hit cannot change here.
       *
       * WHAT IS DELIBERATELY NOT MOVED, so the rung stays attributable: the contact punish
       * (`DamagingHit`) still runs inside the apply step where it has always run, and Showdown runs it
       * after the secondaries; the resist berry is still spent in the apply step and Showdown spends it
       * inside getDamage. Both are ordering divergences WITHIN a step, they are filed in docs/ENGINE.md,
       * and folding them in here would make it impossible to say which change moved the ladder. */
      const _rows=[]; for(const tg of targets){ if(!tg||tg.fainted)continue; _rows.push({tg}); }
      /* STEP 2 -- TYPE IMMUNITY (`hitStepTypeImmunity`, battle-actions.ts:654). */
      const _stepTypeImm=(R)=>{const tg=R.tg;
        /* AN IMMUNE TARGET TAKES NOTHING AT ALL -- not the damage, and not the SECONDARY either.
         *
         * dmgRange already returned eff 0 for a Normal move into a Ghost, so the damage was right.
         * Everything AFTER the damage ran anyway, so Fake Out into Gholdengo dealt 0 and STILL
         * FLINCHED IT -- a free flinch with no downside, on the most-clicked move in the format
         * (12,130 uses). The search reached for it exactly as you would expect.
         *
         * Checked per TARGET rather than once for the move, because a spread move can be immune on
         * one side of the field and land on the other. */
        {
          /* effMoveType, not mv.t: the -ate abilities rewrite a Normal move to Flying or Fairy, and
           * a converted move DOES hit a Ghost. Using the raw type would trade one wrong immunity for
           * another. It is the same helper the typeImmunity check below already uses.
           *
           * WIRE 128 -- and typeEffAgainst, not a bare mcEff: this gate was the SECOND implementation
           * of "how effective is this", and it did not know about Scrappy or about Freeze-Dry's
           * override. dmgRange priced a Scrappy Body Slam into Gengar at 88 and this line refused it
           * as an immunity, so every rollout and every self-play game had Scrappy dealing zero. */
          if (typeEffAgainst(m, tg, mv, effMoveType(mv, a.move.id, field, m)) === 0){_explicitFail=true;if(TR)TR.imm(tg);R.out=true;return;}
        }
      };
      /* STEP 3 -- MOVE-SPECIFIC IMMUNITY (`hitStepTryImmunity`, battle-actions.ts:666). */
      const _stepTryImm=(R)=>{const tg=R.tg;
        /* WIRE 76 -- AND immuneToMoveClass IS AN IMMUNITY TOO, so it short-circuits stage 5 exactly
         * as the type chart above does. `moveClassBlocked` had two consumers -- dmgRange (WIRE 22,
         * the damage half) and the status/phaze paths (WIRE 66) -- and neither is this loop, so a
         * DAMAGING move with an effect landed the effect on a body that took zero from it. Psychic
         * Noise into Soundproof dealt 0 and still applied two turns of HEAL BLOCK; Throat Chop into
         * Soundproof would have left the silence; a bullet move's secondary would land on
         * Bulletproof. Found by the generated matrix on `psychicnoise -> soundproof`, reading
         * `.vol medi=["healblock"] sd=[]`.
         * docs/TAGS.md: "an immune target takes nothing -- not the damage, and not the secondary".
         * That rule was already written down and had one implementation per stage-3 mechanism instead
         * of one per stage. */
        if(moveClassBlocked(tg,a.move.id,m)){_explicitFail=true;if(TR)TR.imm(tg,'[from] ability: '+tg.ability);R.out=true;return;}   // WIRE 128 -- Mold Breaker suppresses Bulletproof too
      };
      /* STEP 0 -- SEMI-INVULNERABILITY (`hitStepInvulnerabilityEvent`, battle-actions.ts:621). FIRST
       * in Showdown's list and fourth here, which is why the step list is data and the blocks below
       * are written in whatever order the file already had them. */
      const _stepInvuln=(R)=>{const tg=R.tg;
        /* OFF THE FIELD. A Pokemon in the charge turn of Fly, Dig, Dive, Bounce or Phantom Force
         * cannot be hit at all. Without this the charge is pure cost and those five become strictly
         * worse than reality -- the same one-directional error as the unmodelled charge, reversed. */
        if(tg._invuln){_explicitFail=true;if(TR)TR.miss(m,tg);R.out=true;return;}
      };
      /* STEP 1 -- THE TryHit EVENT (`hitStepTryHitEvent`, battle-actions.ts:643): the absorbing
       * abilities. Protect also answers here and is handled above, hoisted out by WIRE 1. */
      const _stepTryHit=(R)=>{const tg=R.tg;
        /* THE PROTECT BLOCK USED TO SIT HERE and moved above the accuracy roll (ROADMAP #81 WIRE 1).
           A shielded body never reaches this loop now; what still arrives shielded is the Piercing
           Drill contact case and a move that ignores Protect, and both are meant to. */
        /* WIRE 11 -- the absorb GAIN. dmgRange already prices the hit at zero; HERE the absorber
         * collects what its handler grants -- Volt Absorb heals 1/4, Storm Drain banks +1 SpA,
         * Well-Baked Body +2 Def -- all from the artifact's gain param. The old 12-name table knew
         * none of this: an absorbed hit was merely zero, never a gift. Flash Fire's volatile has no
         * state to land on -- carried, unconsumed, stated. The whole hit ends here: no secondaries,
         * no punishment, no berry, exactly as onTryHit returning null ends it in the real engine. */
        /* WIRE 126 -- Volt Absorb eats a GALVANIZED Body Slam (the effective type, not mv.t).
         * WIRE 128 -- and it does NOT eat a Mold Breaker's, which this line read raw off `tg` while
         * dmgRange had honoured the suppression since WIRE 37. Measured before the fix: a Mold
         * Breaker Tinkaton's Earthquake into a Levitate body was priced 60 and dealt 0. */
        const _ab=absorbedBy(m,tg,effMoveType(mv,a.move.id,field,m));
        if(_ab){
          if(TR)TR.imm(tg,'[from] ability: '+tg.ability);
          if(_ab.gain&&!tg.fainted){
            const _h=_ab.gain.heal&&String(_ab.gain.heal).match(/1\/(\d+)/);
            if(_h){const _p0=tg.curHP;tg.curHP=Math.min(tg.st.hp,tg.curHP+Math.floor(tg.st.hp/(+_h[1])));
              if(TR&&tg.curHP>_p0)TR.heal(tg,'[from] ability: '+tg.ability);}
            if(_ab.gain.boosts&&tg.boosts)for(const k in _ab.gain.boosts){
              const _s=SD2ENG[k];if(_s&&tg.boosts[_s]!=null){const _b0=tg.boosts[_s];
                tg.boosts[_s]=clamp(tg.boosts[_s]+_ab.gain.boosts[k],-6,6);
                if(TR)TR.bst(tg,_s,tg.boosts[_s]-_b0,'[from] ability: '+tg.ability);}
            }
          }
          R.out=true;return;
        }
      };
      /* STEP 4 -- ACCURACY (`hitStepAccuracy`, battle-actions.ts:690), MOVED DOWN HERE BY WIRE 10 from
       * above the gates, which is where this engine had it.
       *
       * WIRE 47 / WIRE 129 -- CRASH ON MISS. High Jump Kick, Axe Kick and Supercell Slam (209 uses)
       * missed correctly and cost the user nothing, so a 90%-accurate 130 BP move had no downside at
       * all. The fraction is the tag's, not a number typed here. The crash is now paid by the
       * `!_reached` test after the step list rather than at the miss itself, which is the same
       * condition Showdown's `moveResult` uses and covers the all-immune case with one rule.
       *
       * BELOW TARGET RESOLUTION AND REDIRECTION (WIRE 129), because accuracy depends on the DEFENDER
       * -- its evasion stage, its Bright Powder, its Sand Veil, its No Guard -- and above that line
       * there is no defender yet. BELOW THE SHIELD (ROADMAP #81), because Showdown's step 4 runs
       * after its step 1 and a blocked move never reaches the roll at all.
       *
       * ONE ROLL PER MOVE, NOT PER TARGET, AND THAT IS A DECLARED DIVERGENCE THIS WIRE DOES NOT WIDEN.
       * Showdown rolls accuracy separately against each target of a spread move. Rolling per target
       * here would change how much rng every existing seeded run consumes, which is a far larger
       * change than this wire is buying; so a SPREAD move rolls once, against no defender, and gets
       * the attacker's modifiers only. Single-target moves -- where every evasion item and ability in
       * this format actually lives -- get the real defender. The roll is taken on the FIRST surviving
       * target and cached, so the rng is consumed exactly once however many bodies are left. */
      let _mvMissed=null;
      const _stepAccuracy=(R)=>{const tg=R.tg;
        if(_mvMissed===null){
          const _acc1=_rows.filter(x=>!x.out);
          const _accDef=(!a.move.spread&&_acc1.length===1)?_acc1[0].tg:null;
          if(a.move.spread)MEDSEEN.accSpreadNoDefender++;
          const _mvAcc=hitChance(m,_accDef,a.move.id,field,
                                 {targetAlreadyMoved:!!(_accDef&&!unresolved.has(_accDef))});
          _mvMissed=(_mvAcc<100&&rng()*100>_mvAcc);
        }
        if(!_mvMissed)return;
        /* ROADMAP #81 WIRE 9 -- ONE `|-miss|` PER TARGET, AND EACH ONE NAMES THE BODY IT MISSED.
         * `hitStepAccuracy` writes `this.battle.add('-miss', pokemon, target)` inside the per-target
         * loop (sim/battle-actions.ts:738), so a spread move that misses two bodies writes two lines.
         * This engine wrote ONE line with an EMPTY target field. Now that the announcement IS a step,
         * the per-target line falls out of the loop rather than being reconstructed inside it.
         *
         * ROADMAP #84 -- A MISS COUNTS. `hitStepAccuracy` returns literal `false` for the target it
         * missed, so `atLeastOneFailure` is true, the null branch is skipped and `useMove` writes
         * false. This is the case Stomping Tantrum is actually played for; `_explicitFail` is that
         * flag and the `_mvRes` line after the step list reads it. */
        if(TR)TR.miss(m,tg);
        _explicitFail=true;R.out=true;
      };
      /* STEP 7a -- getSpreadDamage (battle-actions.ts:1072/1148): the roll, the crit and the
       * effectiveness announcement, for EVERY target, before a single point of HP moves. */
      /* ROADMAP #103 -- ONE COUNT PER MOVE USE, DRAWN ONCE, LAZILY.
       *
       * The authority draws `targetHits` in `hitStepMoveHitLoop` -- ONCE, before the loop over
       * targets, and AFTER every accuracy step. Both halves matter. Once, because a spread multi-hit
       * that drew per target would hit one body five times and the other twice off the same click;
       * after the accuracy steps, because drawing earlier would consume a different position in the
       * rng stream than the authority does. `null` until the first target is actually priced, so a
       * move that misses everything draws nothing at all. */
      let _hitsThisUse=null;
      const _stepDamage=(R)=>{const tg=R.tg;
        _reached++;   // ROADMAP #81 WIRE 1 -- past every gate: this target is a HIT, so the move did not fail
        if(_hitsThisUse===null)_hitsThisUse=rollHitsOf(a.move.id,rng);
        /* ROADMAP #81 WIRE 11 -- THE WHOLE PRICE OF ONE HIT, IN ONE CLOSURE, TAKEN TWICE.
         *
         * It has to be a closure because a CRIT changes the price and this engine only found out
         * whether the crit landed after it had already priced the hit.
         *
         * ROADMAP #92 -- THE TWO HIT-SITE MULTIPLIERS ARE NO LONGER APPLIED HERE. The comment that
         * stood here said Friend Guard and Helping Hand "are not in dmgRange and never can be --
         * dmgRange is handed two bodies and knows nothing about an ally or a boosted click". The
         * first half is true and the conclusion did not follow: what dmgRange cannot DERIVE it can be
         * TOLD, and it has to be, because both belong inside chains only dmgRange spends. Helping
         * Hand is `onBasePower` (so `Math.floor(rolled * 1.5)` here was one whole stage late, wrong
         * on 5 of 5 audited rows) and Friend Guard is `onAnyModifyDamage` (right stage, but a SECOND
         * spend beside the chain -- 21.4% of base-damage values). They now ride the seventh argument.
         *
         * THE PARTNER IS FOUND ON THE TARGET'S OWN SIDE, not on the attacker's foes -- a spread move
         * that clips the attacker's own ally (Earthquake) puts `tg` on the attacking side, and
         * looking it up from `it.side` would then read the wrong pair. */
        const _hitCtx=(()=>{
          const c={};
          const _tside=actA.indexOf(tg)>=0?actA:actB;
          const _pal=_tside.find(x=>x&&x!==tg&&!x.fainted&&x.curHP>0);
          const _fg=_pal&&TAGS.param('ability',_pal.ability,'reducesAllyDamage');
          if(_fg&&_fg.mult)c.allyDamageMult=+_fg.mult;
          /* Only a DAMAGING click takes the boost -- a Helping Hand on a status move does nothing and
           * must stay nothing. dmgRange's own `hasPower` guard is that test, so nothing is needed
           * here beyond passing the flag. */
          if(m._helpingHand)c.helpingHand=true;
          /* ROADMAP #103 -- the ROLLED hit count, so dmgRange prices the hits this turn actually
           * landed instead of the 3.1 it prices a hypothetical one with. Only ever set above 1 for a
           * move the artifact calls multi-hit; every other caller of dmgRange leaves it absent and
           * keeps the expectation, which is the right object for a price. */
          if(_hitsThisUse>1)c.hits=_hitsThisUse;
          return c;
        })();
        const _price=(isCrit)=>dmgRange(m,tg,mv,field,_spreadHit,isCrit,_hitCtx);
        let d=_price(false);
        /* THE ROLL IS AN INDEX, NOT A NUMBER, and that is what makes the crit re-price free of rng.
         * One `rng()` is drawn exactly where it was drawn before; if the crit lands, the SAME index is
         * read off the crit range instead. So a crit that ignores nothing produces a byte-identical
         * result to the old arithmetic (the two ranges are equal), and only a crit that actually
         * ignores a stage or a screen moves. Clamped, because the two ranges need not be the same
         * length once A or D has changed. */
        const _roll=Math.floor(rng()*(d.max-d.min+1));
        let dmg=d.min+_roll;
        /* WIRE 35 -- THE CRIT ROLL READS A RATE. It was a flat `rng()<1/24` for every move and every
         * defender: Night Slash and Psycho Cut got no more crits than Tackle, a Scope Lens did
         * nothing, and Shell Armor took them like anything else. The rng is consumed
         * UNCONDITIONALLY so a Shell Armor arm and a plain arm draw the same stream -- a guarded call
         * would shift every later roll in the turn and make the two arms incomparable for reasons
         * that have nothing to do with crits.
         * A rate of exactly 1 is skipped because dmgRange has ALREADY applied that 1.5 to the range;
         * multiplying again here would price Flower Trick at 2.25x. */
        {const _cc=critChance(a.move.id,m,suppressedAbility(m,tg)),_cr=rng();   // WIRE 128 -- one owner
         if(_cc>0&&_cc<1&&_cr<_cc){
           /* ROADMAP #81 WIRE 11 -- AND THE ROLLED CRIT IS RE-PRICED, not merely multiplied. A crit
            * ignores the attacker's negative offensive stages, the defender's positive defensive
            * stages and screens, and none of those is expressible as a multiplier on a number that
            * has already been computed with them applied. `_price(true)` is the same call dmgRange's
            * certain-crit path makes, one flag over; the index is carried across.
            *
            * ROADMAP #92 -- AND THE x1.5 ITSELF IS GONE FROM HERE, WHICH IS THE LAST HALF OF THE WIRE.
            * The authority multiplies by 1.5 at `battle-actions.ts:1748`, BEFORE the randomizer, STAB,
            * the type chart, burn and the ModifyDamage chain. This line multiplied AFTER all six. It
            * looked fine because every check in this repo pins the top roll, where the randomizer is
            * the identity; measured across the interior it disagreed on 46.5% of rows at the bottom
            * roll and 61.8% with a Life Orb. `_price(true)` now returns a range that already carries
            * the crit at the right place, and Sniper -- `onModifyDamage`, never part of a plain
            * multiply -- rides dmgRange's final chain with it. */
           const _dc=_price(true);
           dmg=_dc.min+Math.min(_roll,Math.max(0,_dc.max-_dc.min));
         }
         /* ROADMAP #68 -- THE EFFECTIVENESS AND THE CRIT, IN SHOWDOWN'S OWN ORDER: effectiveness,
          * then crit, then damage (data/mods/champions/scripts.ts:270-284, and confirmed line for
          * line against a real Champions battle.log). The third argument on the two effectiveness
          * events is THIS FORMAT'S -- the base engine emits two fields and champions emits three.
          *
          * `_cc === 1` IS THE CASE THE ACCEPTANCE TEST TURNS ON. Flower Trick, Storm Throw and Frost
          * Breath always crit; dmgRange has already folded the x1.5 into the range, so the branch
          * above deliberately skips them -- and a trace that only emitted `|-crit|` from that branch
          * would print no crit at all on exactly the three moves the crit rules are tested with. */
         /* ROADMAP #101 -- AND THE CRIT IS RECORDED ON THE HIT, not only announced. `_stepEffects`
          * runs after this and Anger Point's whole condition is "did that one crit", which nothing
          * downstream could see: the flag lived for the length of this block and then went out of
          * scope. Same expression the trace emits, so the reaction and the `|-crit|` line cannot
          * disagree about whether it happened. */
         R.crit=(_cc>=1)||(_cc>0&&_cc<1&&_cr<_cc);
         if(TR){TR.eff(tg,d.eff);if(_cc>=1||(_cc>0&&_cc<1&&_cr<_cc))TR.crit(tg);}}
        /* WIRE 4 -- `modifyDamage` spends this one through `modify` too (battle-actions.ts:1821),
         * and x0.25 is NOT a value where a truncation and a round-half-up agree. */
        if(tg.protect&&!_thruProtect)dmg=md4096(dmg,0.25);   // Piercing Drill: contact hits through Protect for 25%
        R.d=d;R.dmg=dmg;
      };
      /* STEP 7b -- spreadDamage (battle-actions.ts:1079): the HP actually moves, for every target,
       * and only now. `d` and `dmg` are carried on the row rather than recomputed, because the price
       * was fixed at the previous step -- which is the whole of this wire. */
      const _stepApply=(R)=>{const tg=R.tg;let d=R.d,dmg=R.dmg;
        /* ROADMAP #81 WIRE 11 -- assigned after the HP moves, read by the `onFaintOnly` gate inside
         * `_damagingHit`. A `let` rather than a `const` at the assignment because the revert in
         * `tests/probe_red_demo.js` sets it to the OLD reading (`dmg >= tg.curHP`, taken before the
         * Focus Sash) at the old call site, and a probe that could not express the old engine would
         * not be a demonstration of anything. */
        let _koThisHit=false;
        dealt+=Math.min(dmg,tg.curHP);
        /* WIRE 42 -- THE SUBSTITUTE EATS THE HIT, and the whole hit ends here.
           WHAT THAT SKIPS IS STATED RATHER THAN DISCOVERED: no item is knocked off, no resist berry
           is spent, no contact punish is paid and no secondary lands. Three of those four are the
           real rule; the CONTACT PUNISH is not -- Rough Skin does toll an attacker that broke a
           substitute -- and it is left out because the punish block sits below this line and moving
           it would reorder five other mechanics for one. Sound moves and Infiltrator also go through
           a real substitute and are not tracked at the hit site. Both are divergences in the same
           direction (a substitute here is slightly better than the game's) and both are small. */
        connected=true;
        /* WIRE 130 -- a SOUND move and an Infiltrator go straight through, which was named as a
           divergence here and is now the rule: subBlocks owns it for the damage path and for every
           status path, so one substitute cannot mean two things inside one turn. */
        if(subBlocks(m,tg,a.move.id)){const _s0=tg._sub;tg._sub=Math.max(0,tg._sub-dmg);
          if(TR){TR.act(tg,'move: Substitute','[damage]');if(_s0>0&&tg._sub<=0)TR.vend(tg,'Substitute');}
          R.out=true;return;}
        /* THE BERRY IS CONSUMED HERE AND ONLY HERE. dmgRange applied the halve as a pure read --
         * it is called dozens of times per turn on hypothetical moves and must never mutate -- so
         * the one-shot is spent at the point a real hit lands, exactly like the Sitrus line below. */
        /* KNOCK OFF ACTUALLY KNOCKS THE ITEM OFF. It did not, on a move clicked 3,013 times in the
         * corpus -- every Life Orb, Focus Sash and Berry in a rollout was immortal, so the search
         * priced Knock Off as a weak Dark attack and nothing else.
         *
         * From the `removesItem` tag, derived from the move's own handler calling takeItem, with
         * `steals` set for the ones that also call setItem. That is Knock Off, Covet, Thief, Trick,
         * Switcheroo, Bug Bite, Pluck and Corrosive Gas from one rule and no names.
         *
         * ROADMAP #81 WIRE 7 -- THE STRIP MOVED BELOW THE DAMAGE (ROADMAP #80's open half). It ran
         * HERE, before `tg.curHP -= dmg`; Showdown strips from `onAfterHit`, which is exactly what its
         * name says -- after. `_takeItem` below is that call site, and this comment is left at the old
         * one because the ORDER is the whole wire. */
        const _rbHit=TAGS.param('item',tg.item,'resistBerry');
        if(_rbHit&&_rbHit.onType===mv.t&&(!_rbHit.requiresSuperEffective||d.eff>1)){
          /* ROADMAP #81 WIRE 7 -- A RESIST BERRY WRITES TWO LINES, NOT ONE. Every member of the family
           * has the same body: `if (target.eatItem()) { this.add('-enditem', target, this.effect,
           * '[weaken]'); return this.chainModify(0.5); }` -- so `eatItem()` writes the `[eat]` and the
           * handler writes a second `[weaken]` beside it. Confirmed in the authority's own log through
           * data/game-differential.json's knock_off_roadmap_80 block, which records both. One rule for
           * the tag, no names. */
          if(TR){TR.enditem(tg,tg.item,'[eat]');TR.enditem(tg,tg.item,'[weaken]');}
          tg.item='';}
        /* WIRE 12 -- survivesFromFull. Focus Sash is the most-held item in the format (8,078
         * sheets) and Sturdy its ability twin, and neither existed here: every lethal hit into a
         * full-HP sash body was a kill that is not a kill. The gates come from the handler via the
         * tag -- full HP only, a MOVE only (burn chip still kills), survive at exactly 1 -- and the
         * sash is SPENT in the act while Sturdy is not, which the artifact's consumesItem states.
         * This engine rolls multi-hit as one packet, so a sash here also eats Bullet Seed -- the
         * one divergence from the real rule, stated rather than hidden. */
        /* WIRE 11 REVERT ANCHOR -- THE OLD CALL SITE, and it is a comment on purpose. This engine ran
         * `_damagingHit()` HERE, above Disguise, above the Focus Sash and above `tg.curHP -= dmg`.
         * `tests/probe_red_demo.js` restores the old build by replacing this one line with
         * `_koThisHit=dmg>=tg.curHP;_damagingHit();` and blanking the call below the damage. */
        /* WIRE 23 -- DISGUISE, and it is a SUBSTITUTION not a nullification. Mimikyu's first hit is
         * refused and the busted disguise then costs it exactly maxhp/8 (Gen 8+). Every Mimikyu row
         * in the differential was this, across four seeds -- tauros ironhead, chesnaught woodhammer,
         * rhyperior smackdown -- and forcing Mimikyu's ability to Levitate reproduced MEDICHAM's
         * number exactly, so the damage math was always right and only the free hit was missing.
         *
         * "0 damage, full stop" WOULD BE THE WRONG FIX and the differential would have blessed it.
         *
         * ROADMAP #89 -- THE REASON THIS PARAGRAPH USED TO GIVE WAS FICTION, AND THAT IS WORSE THAN A
         * WRONG ANSWER BECAUSE THE NEXT READER RE-DERIVES FROM IT. It said Showdown reports 0 "only
         * because this harness never calls battle.update()". `battle.update()` DOES NOT EXIST --
         * verified by enumerating the prototype; the nearest real methods are `sendUpdates`,
         * `faintMessages` and `commitChoices`. The model was right for a reason nobody had checked.
         *
         * THE REAL REASON, out of the ability's own source (data/abilities.ts:960): `onDamage` returns
         * 0 for the hit and sets `effectState.busted`, and the SELF-INFLICTED EIGHTH IS DEALT IN
         * `onUpdate` -- `this.damage(pokemon.baseMaxhp / 8, ...)` -- on the same pass that performs the
         * forme change. So it is not that the eighth never lands; it lands LATER, at the next update,
         * as a separate damage event. A direct `dmgRange` comparison sees the 0 and not the eighth,
         * which is exactly what the differential's surviving `chesnaught woodhammer -> mimikyu` row
         * is. Substituting the eighth here reproduces the BOARD (both engines end at 114/130) while
         * announcing it as one event rather than two, and that is the declared approximation.
         *
         * GATED ON A DAMAGING HIT ONLY, and placed before the Focus Sash block so a busted disguise
         * cannot also spend a Sash on the same hit. The flag lives on the mon and is cleared on
         * switch-out beside _charging, because a Mimikyu that leaves and returns does NOT get a
         * second disguise -- the forme change persists for the battle.
         *
         * WIRE 136 -- IT IS DERIVED NOW, AND IT RENAMES THE BODY. The paragraph that stood here said
         * this wire was keyed on the ability NAME because `disguise.tags` was `["preventsCrit",
         * "formeChange"]` and both hold three other abilities each. True then; `formeOnHit` exists
         * now, derived from the narrow shape (an `onUpdate` that forme-changes plus an `onDamage` that
         * sets `busted`), and its membership is exactly Disguise and Ice Face.
         *
         * AND THE SPECIES CHANGE WAS SIMPLY MISSING. The HP was right -- both engines land on 114/130,
         * which is why this was once declared a non-bug -- and Showdown's ACTIVE SLOT and PARTY both
         * read `mimikyubusted` on every turn after the hit while ours read `mimikyu`. The census probe
         * checks HP and passes; the board does not. Mimikyu and Mimikyu-Busted have IDENTICAL base
         * stats and types (the tag carries `sameStats` and says so), so the change is a rename and
         * nothing else -- which is fortunate, because `data/engine-data.js` has NO mimikyu-busted row
         * and that file belongs downstream of this division. A member with `sameStats:false` (Ice
         * Face, 0 uses) would need the row and is COUNTED rather than renamed wrongly. */
        {
          /* THE GUARD CANNOT READ `dmg` ANY MORE, AND THAT IS THE WHOLE CARE IN THIS CHANGE.
           * `dmg` comes from `dmgRange` (`_price()` above), and `dmgRange` now correctly returns 0
           * against an intact Disguise — so the old `dmg>0` test would be FALSE exactly when the
           * disguise is there to bust, and the forme would never break. The question this guard is
           * actually asking is "would this move have connected damagingly", which is the MOVE and the
           * TYPE CHART, not the post-absorb number: a damaging move (`bp>0`) that is not immune
           * (`d.eff>0`). `eff` survives the absorb because `dmgRange` returns it unchanged. */
          const _abs=formeOnHitAbsorbs(tg);
          if(_abs&&mv&&(mv.bp>0)&&d&&d.eff>0){
            const _fh=_abs.fh;
            tg._disguiseBusted=true;
            dmg=_abs.chip;
            if(TR)TR.act(tg,'ability: '+tg.ability);
            const _key=pasteKey(_fh.becomes);
            if(monRow(_key))formeSwap(tg,_fh.becomes,'formeOnHit');
            else if(_fh.sameStats&&_fh.sameTypes){
              /* THE RENAME WITHOUT A ROW, and it is allowed ONLY because the artifact states the two
               * formes are identical in every respect this engine models. It is still counted, because
               * a rename this engine cannot verify against a row is a claim, and a claim that carries
               * traffic should be readable. */
              tg.name=_key||String(_fh.becomes).toLowerCase().replace(/[^a-z0-9]/g,'-');
              MEDSEEN.formeRenamedNoRow++;
              if(TR)TR.detailschange(tg);
            } else {
              MEDFAILS.formeOnHitNoRow++;
              if(!MEDFAILS.formeOnHitNoRowFirst)MEDFAILS.formeOnHitNoRowFirst=tg.ability+' -> '+_fh.becomes;
            }
          }
        }
        if(dmg>=tg.curHP&&tg.curHP===tg.st.hp){
          const _sv=TAGS.param('item',tg.item,'survivesFromFull')||TAGS.param('ability',tg.ability,'survivesFromFull');
          if(_sv&&(!_sv.onlyFromFullHP||tg.curHP===tg.st.hp)){
            dmg=tg.curHP-(_sv.leavesHP||1);
            /* Showdown emits the `|-enditem|` BEFORE the `|-damage|` that the Sash survived -- read
             * off a real battle.log, where `-enditem Focus Sash` precedes `-damage 1/135`. */
            if(_sv.consumesItem){if(TR)TR.enditem(tg,tg.item);tg.item='';}
            else if(TR)TR.act(tg,'ability: '+tg.ability);
          }
        }
        /* WIRE 17 -- thaw on hit: a damaging Fire-type move thaws a frozen target (the game's own
         * rule since Gen VI), and the artifact's thawsTarget carries the non-Fire exceptions the
         * flag exists for -- Scald, Matcha Gotcha. Cleared BEFORE the damage lands so the thawed
         * target acts normally next turn. */
        if(tg.status==='frz'&&(effMoveType(mv,a.move.id,field,m)==='Fire'||TAGS.has('move',a.move.id,'thawsTarget'))){tg.status='';if(TR)TR.cure(tg,'frz');}
        tg.curHP-=dmg;
        /* WIRE 135 -- WHO HIT ME THIS TURN, recorded on the one line every move's damage passes
         * through. `_hitBy` is a SET OF BODIES rather than a flag because Avalanche asks whether THE
         * TARGET damaged it -- a boolean would double off the partner's Earthquake, which is a
         * different move and a wrong number. `_hurtThisTurn` is the weaker fact Assurance wants and is
         * kept beside it rather than derived, because "hurt by anything" and "hurt by you" are two
         * questions and collapsing them is how one tag came to describe four mechanics. */
        if(dmg>0){(tg._hitBy=tg._hitBy||new Set()).add(m);tg._hurtThisTurn=true;
          /* HOW MUCH, AND OF WHAT CATEGORY — the state the retaliation family needs and the reason
           * `dmgRange`'s own WIRE 21 comment could say Counter and Metal Burst were "one branch away"
           * without building the branch. `_hitBy` records WHO; this records HOW MUCH.
           *
           * THE LAST QUALIFYING HIT, NOT THE SUM. Showdown's counter condition OVERWRITES
           * `effectState.damage` on every physical hit, and `getLastDamagedBy` is singular by name —
           * so two Rock Slides into the same body leave Counter reading the SECOND one, not both. A
           * sum would be a different and wrong move.
           *
           * Kept per category because Counter takes only physical and Mirror Coat only special, while
           * Metal Burst and Comeuppance take whatever landed last. `any` is not derivable from the
           * other two — it has to know which arrived later. */
          const _cat=(a.move&&a.move.mv&&a.move.mv.c==='P')?'phys':'spec';
          tg._took=tg._took||{phys:0,spec:0,any:0};
          tg._took[_cat]=dmg; tg._took.any=dmg;}
        if(TR)TR.dmg(tg);
        /* ROADMAP #81 WIRE 11 -- DID THIS PACKET ACTUALLY KILL IT. Read here, once, off the HP that
         * has already moved -- not off `dmg`, which is the number before the Focus Sash and the
         * Disguise above got at it. `tg.fainted` is not set until the bottom of this step (WIRE 10
         * keeps the announcement for its own step), so this local is the only honest reading
         * available between the two. */
        _koThisHit=tg.curHP<=0;
        _damagingHit();   /* ROADMAP #81 WIRE 11 -- the reactors, AFTER the damage */
        /* ROADMAP #81 WIRE 11 -- THE CONTACT PUNISH IS PAID *AFTER* THE DAMAGE, AND THE WHOLE BLOCK
         * BELOW USED TO SIT ABOVE THIS LINE.
         *
         * Showdown numbers the two: `spreadDamage` is step 2 of `spreadMoveHit`
         * (battle-actions.ts:1079, where the HP actually moves) and `runEvent('DamagingHit')` is four
         * numbered steps later (:1117), after runMoveEffects, the self drops and the secondaries.
         * Observed live: Tyranitar Knock Offs a Garchomp and the authority writes
         * `|-damage|Garchomp|78/183` and THEN Rough Skin's recoil onto Tyranitar; this engine wrote
         * the recoil first, with no speed tie anywhere near it (106 against 161). WIRE 10 filed this
         * and did not fix it because it changes the SINGLE-TARGET order, which is the one thing that
         * rung's control held constant.
         *
         * IT IS NOT COSMETIC, AND THE STATE HALF IS THE `onFaintOnly` GATE. Aftermath's own condition
         * is `if (!target.hp && ...)` -- the HP AFTER the packet landed. Read before the damage, the
         * gate had to compare the RAW `dmg` against `tg.curHP`, which is the number BEFORE a Focus
         * Sash or a busted Disguise has cut it down. So an Aftermath body holding a Focus Sash
         * survived at 1 and detonated anyway, costing the attacker a quarter of its maximum HP for a
         * kill that did not happen. `_koThisHit` below is the post-damage reading, and it is the whole
         * of that fix.
         *
         * THE OTHER DIRECTION IS A STREAM CLAIM ONLY, and it is said rather than counted as a win: a
         * DEAD attacker takes no further toll (`Battle#spreadDamage` returns 0 and emits nothing when
         * `!target.hp`, sim/battle.ts:2140) and this engine had no `!m.fainted` guard, so a second
         * reactor could write a second `-damage` onto a body already at 0. curHP is clamped either
         * way, so nothing moves on STATE; the guard is added because the LINE does.
         *
         * WHAT DID *NOT* MOVE, checked rather than assumed: the punish is still paid whether or not
         * the TARGET survived. `runEvent` skips a handler whose holder is `fainted` (sim/battle.ts:512)
         * and `Pokemon#faint` explicitly does not set that flag -- "actually setting of this.fainted
         * comes later when the faint queue is resolved" -- so a Rough Skin holder that just dropped to
         * 0 still tolls its killer. */
        /* A HOISTED FUNCTION DECLARATION, DELIBERATELY, AND THE REASON IS TESTABILITY. The whole
         * reactor block is one unit that Showdown runs at ONE numbered step; making it a named
         * function means its POSITION is a single call line rather than 150 lines of context, so
         * `tests/probe_red_demo.js` can revert this wire by moving the call and nothing else. A
         * `const` arrow would not survive that, because the revert calls it above its own
         * declaration; a function declaration is hoisted to the top of `_stepApply` and does. */
        function _damagingHit(){
        /* WIRE 5 -- punishesAttacker, all of it. Rough Skin (3,762 sheets) and its family were
         * ABSENT: the engine had no concept that touching something can cost you. Unlike
         * buffsHolderOnHit this does NOT compound -- it is a flat toll, so the right play is to
         * keep attacking without contact rather than to stop. Paid whether or not the target
         * survived the hit, which is why it sits outside the survivor branch below.
         *
         * THE TRIGGER COMES FROM THE TAG, not from an assumption. The first cut of this wire
         * assumed contact-per-hit for every member, so Aftermath (whose handler fires only when
         * the HOLDER DIES to contact) chipped attackers 25% on every touch. requiresForme members
         * are skipped whole: this engine carries no forme state, and a base-forme Cramorant that
         * never Surfed punishing anyone would be a new wrong number, not a wired mechanic. */
        /* WIRE 84 -- A MULTI-HIT MOVE SETS OFF A REACTOR ONCE PER HIT, AND THIS ENGINE SET IT OFF
         * ONCE. Showdown runs every `onDamagingHit` per hit, so Bullet Seed into Weak Armor is
         * def -3 / spe +6 and this engine gave -1 / +2; into Toxic Debris it lays TWO layers (the
         * tag's own cap) and this engine laid one. Eight of the interaction matrix's divergences
         * were exactly this, across four carriers and two reactors, and none was reachable from a
         * single-mechanic probe: `test-engine-diff.js` calls moveHit ONCE and therefore cannot see
         * a multi-hit at all, which is stated at WIRE 20.
         *
         * THE DAMAGE IS STILL ONE PACKET -- that is WIRE 20's declared divergence and it is not
         * changed here. What is corrected is the COUNT of reaction events, which is a different
         * quantity and was silently 1.
         *
         * ROUNDED, because a stat stage is an integer and expectedHitsOf returns the mean of the
         * 2-5 distribution (3.1 -> 3, which is what a seeded Showdown rolls). Beat Up is not a
         * `multiHit` move at all -- it hits once per eligible party member -- so its count comes
         * from the same `perAlly` param the base power does, and no move is named. */
        const _react=(()=>{
          /* ROADMAP #103 -- THE SAME COUNT THE DAMAGE USED, not a second opinion about it.
           * The paragraph above said "3.1 -> 3, which is what a seeded Showdown rolls" and that was
           * simply not true: Showdown's `|-hitcount|` reads 5 at the top pin corner and 2 at the
           * bottom, never 3. Rounding an expectation here while the damage step draws a count is
           * exactly the two-implementations-of-one-fact failure CLAUDE.md names -- Bullet Seed would
           * deal five hits of damage and set off Weak Armor three times, and both would look right.
           * `_hitsThisUse` is null only when nothing was priced (every target refused the move), in
           * which case there was no hit to react to and the expectation is as good an answer as any. */
          if(_hitsThisUse!==null&&TAGS.param('move',a.move.id,'multiHit'))return Math.max(1,_hitsThisUse);
          const _n=expectedHitsOf(a.move.id);
          if(_n>1)return Math.max(1,Math.round(_n));
          const _vpH=TAGS.param('move',a.move.id,'variablePower');
          if(_vpH&&_vpH.perAlly){
            const _pt=(m._sf&&m._sf.team)||[m];
            let _c=0;for(const _al of _pt)if(_al&&!_al.fainted&&_al.curHP>0&&!(_al.status&&_al.status!=='none'))_c++;
            return Math.max(1,_c);
          }
          return 1;
        })();
        R.react=_react;   // WIRE 10 -- the effects step reads the same count, one step later
        for(let _hit=0;_hit<_react;_hit++){
        /* WIRE 82, the reacting half -- a hit LANDING ON a body that is holding a pre-turn shield.
         *
         * Placed beside punishesAttacker because it is the same dispatch question ("who reacts to
         * being hit?") and NOT inside it, because a preTurnShield holder carries no punishesAttacker
         * params at all -- anything nested there could never have reached it, which is the mistake
         * WIRE 80 records one block down.
         *
         * The trigger comes from the tag: `contact` for Beak Blast's shield, `damaging` for Focus
         * Punch's concentration, `physical` for Shell Trap's. `foesOnly` is honoured, so an ally's
         * spread move does not spring Shell Trap -- read out of the handler's own !isAlly gate.
         *
         * `hit` is recorded whether or not the holder survives, and the burn is applied whether or
         * not it survives, because both happen DURING the hit. */
        if(tg._preTurn&&tg._preTurn.id&&!(tg._preTurn.p.foesOnly&&tg._sf===m._sf)){
          const _ps=tg._preTurn.p;
          const _tr=_ps.trigger==='contact'?mvMakesContact(a.move.id)
                   :_ps.trigger==='physical'?mv.c==='P'
                   :/* damaging */ mv.c==='P'||mv.c==='S';
          if(_tr){
            tg._preTurn.hit=true;
            if(_ps.mode==='punishAttacker'&&_ps.status&&!m.fainted)
              applyStatus(m,CODE_OF_STATUS[_ps.status]||_ps.status);
          }
        }
        const _pun=TAGS.param('ability',tg.ability,'punishesAttacker');
        if(_pun&&!_pun.requiresForme){
          const _trig=_pun.trigger==='contact'?mvMakesContact(a.move.id)
                     :_pun.trigger==='physical'?mv.c==='P'
                     :_pun.trigger==='special'?mv.c==='S'
                     :true;
          /* ROADMAP #81 WIRE 11 -- `_koThisHit`, NOT `dmg>=tg.curHP`. Aftermath asks `!target.hp`,
           * which is the HP after the Sash and the Disguise have had their turn at the packet. */
          if(_trig&&(!_pun.onFaintOnly||_koThisHit)){
            /* ROADMAP #81 WIRE 11 -- and a DEAD attacker takes no toll: `Battle#spreadDamage` returns
             * 0 for a target with no HP and writes no line at all. */
            if(_pun.fraction&&!m.fainted){
              m.curHP-=Math.floor(m.st.hp/(+_pun.fraction));
              if(TR)TR.dmg(m,'[from] ability: '+tg.ability,tg);
              if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);}
            }
            if(_pun.boosts&&m.boosts&&!m.fainted)for(const k in _pun.boosts){
              const _st=SD2ENG[k];if(_st&&m.boosts[_st]!=null){const _b0=m.boosts[_st];
                m.boosts[_st]=clamp(m.boosts[_st]+_pun.boosts[k],-6,6);
                if(TR)TR.bst(m,_st,m.boosts[_st]-_b0,'[from] ability: '+tg.ability);}
            }
            /* ONE roll against the cumulative, because the artifact's list entries are exclusive
             * branches of one random(100) -- rolling each independently would understate Effect
             * Spore's paralysis and poison. applyStatus enforces the immunities and one-at-a-time. */
            if(_pun.inflicts&&!m.fainted){
              const _r=rng();let _cum=0;
              for(const _inf of _pun.inflicts){_cum+=_inf.chance;
                if(_r<_cum){applyStatus(m,CODE_OF_STATUS[_inf.status]||_inf.status);break;}}
            }
            /* `tg` is the HOLDER of the punish ability and `m` is the attacker who set it off, so
             * the rock that extends this sky is the holder's. The first cut of this line read
             * `m.item` and would have given Sand Spit eight turns whenever the mon that HIT it
             * happened to carry a Smooth Rock. */
            if(_pun.setsWeather&&!field.weather){
              const _w=weatherId(_pun.setsWeather);
              if(_w){field.weather=_w;field.weatherT=weatherTurns(_w,tg.item);
                if(TR)TR.wx(_w,'[from] ability: '+tg.ability,tg);}
            }
            /* WIRE 68 -- TOXIC DEBRIS, and the comment that used to sit here said this tag had
             * "nowhere to land". It does now: WIRE 41 gave each side an `hz` bag on its `_sf`, so a
             * hazard laid by an ability goes exactly where a hazard laid by a move goes. Glimmora
             * scatters Toxic Spikes on the ATTACKER's side when hit physically, capped at the tag's
             * own maxLayers. Found by tests/test-game-diff.js's generated pair matrix reading
             * `.A.hazards.toxicspikes medi=null sd=1` on two separate pairs.
             * inflictsVolatile is still unconsumed HERE and is not a gap: Cursed Body now lands
             * through its own `disablesAttacker` tag at WIRE 52, and Cute Charm's attract and Perish
             * Body's clock have no state in this engine. */
            if(_pun.hazard&&m._sf){
              const _hz=(m._sf.hz=m._sf.hz||{});
              const _cap=+_pun.maxLayers||1;
              const _b0=_hz[_pun.hazard]||0;
              _hz[_pun.hazard]=Math.min(_cap,_b0+1);
              if(TR&&_hz[_pun.hazard]>_b0)TR.sstartSide(m._sf.side==='A'?'p1':'p2',_pun.hazard);
            }
          }
        }
        /* WIRE 80 -- MUMMY AND WANDERING SPIRIT REWRITE THE ATTACKER'S ABILITY.
         *
         * Filed as unfixable by the previous pass on two grounds, and BOTH have been retired rather
         * than argued away. (1) "neither has a param for the rewrite" -- true of `contactPunish`,
         * false of the dex: both handlers state the whole rule in one call and `tag_dex` now derives
         * `rewritesAbilityOnContact` from them, matching exactly three abilities. (2) "0 corpus sheets
         * between them" -- that no longer holds: the artifact's own usage counts read mummy 41 and
         * wanderingspirit 58.
         *
         * IT IS WORTH MORE THAN THE 99 SHEETS SUGGESTS, because the ability is an INPUT to every later
         * number: a Blastoise that walks into a Cofagrigus keeps being priced as a Torrent body for
         * the rest of the rollout, and a Wandering Spirit swap hands the holder whatever the attacker
         * had. That is the Knock Off lesson in CLAUDE.md -- an untracked identity change keeps
         * applying a modifier that is gone -- one field over.
         *
         * OUTSIDE the punishesAttacker block on purpose: Mummy carries `contactPunish` and NO
         * `punishesAttacker` params at all, so anything nested in there could never have reached it.
         * Placed after the punish so a Rough Skin toll is unaffected, and gated on the same
         * mvMakesContact() the punish uses, which is the handler's own gate.
         *
         * NOT MODELLED, STATED: Showdown skips the rewrite when the attacker's ability carries the
         * `cantsuppress` flag (Multitype, RKS System, Comatose, Zen Mode). No artifact this engine
         * reads carries that flag, none of those abilities exists in this format, and the alternative
         * was typing the list here. `becomes` comes out of the tag, so no ability name is written. */
        {
          const _rw=TAGS.param('ability',tg.ability,'rewritesAbilityOnContact');
          if(_rw&&_rw.trigger==='contact'&&mvMakesContact(a.move.id)&&!m.fainted&&m.ability!==tg.ability){
            if(_rw.mode==='infect'&&_rw.becomes){m.ability=String(_rw.becomes);
              if(TR){TR.act(tg,'ability: '+tg.ability);TR.ab(m,m.ability,'[from] ability: '+tg.ability);}}
            else if(_rw.mode==='swap'){const _t=m.ability;m.ability=tg.ability;tg.ability=_t;
              if(TR){TR.act(tg,'ability: '+_t);TR.ab(m,m.ability);TR.ab(tg,tg.ability);}}
          }
        }
        }   /* end WIRE 84 per-hit reaction loop */
        }   /* end _damagingHit */
        /* ROADMAP #81 WIRE 7 -- KNOCK OFF STRIPS THE ITEM *AFTER* THE DAMAGE. ROADMAP #80 filed this
         * and only half of it was closed: #80's DAMAGE claim was retracted (both engines price the
         * x1.5 and the Colbur halve correctly, because playerAction computes the range at click time),
         * and what was left open is the ORDER and the DISPOSITION. Measured in the authority:
         *     |-damage|p2a: Gengar|0 fnt
         *     |-enditem|p2a: Gengar|Life Orb|[from] move: Knock Off|[of] p1a: Incineroar
         *     |faint|p2a: Gengar
         * -- damage, then the strip, then the faint. This engine stripped BEFORE `tg.curHP -= dmg`.
         *
         * THREE THINGS FALL OUT OF THE MOVE, AND ONLY ONE OF THEM IS THE ORDER:
         *
         *  1. A SELF-EATEN BERRY IS EATEN BY ITSELF, NOT KNOCKED OFF. Colbur's halve fires INSIDE the
         *     damage calculation (`onSourceModifyDamage` -> `eatItem()`), so by the time `onAfterHit`
         *     runs there is nothing left to take: Showdown records `[eat]`, this engine recorded
         *     `[from] move: Knock Off`. Harvest, Recycle, Belch, Cud Chew and Unburden all read that
         *     difference. The resist-berry block now sits ABOVE this one and gets first refusal.
         *  2. A BODY REDUCED TO 0 STILL LOSES ITS ITEM. `Pokemon#takeItem` has no hp test at all --
         *     checked in sim/pokemon.ts and confirmed in the log above -- so no faint gate is added
         *     here, and the strip sits before the faint announcement rather than after it.
         *  3. A MEGA STONE CANNOT BE TAKEN FROM THE BODY IT BELONGS TO. See itemRefusesTake: the
         *     format has exactly 75 items with an `onTakeItem` and every one is a mega stone. This
         *     engine knocked a Gengarite off a Gengar, which is a STATE bug and not a stream one --
         *     the body could no longer mega for the rest of the battle. */
        {
          const _ri=TAGS.param('move',a.move.id,'removesItem');
          if(_ri&&tg.item&&!itemRefusesTake(tg)){
            const _taken=tg.item; tg.item='';
            if(TR)TR.enditem(tg,_taken,'[from] move: '+a.move.id,m);
            if(_ri.steals&&!m.item){m.item=_taken;if(TR)TR.item(m,_taken,'[from] move: '+a.move.id);}
          }
        }
        /* ROADMAP #81 WIRE 10 -- THE FAINT IS RECORDED HERE AND ANNOUNCED IN ITS OWN STEP.
         * `Battle#spreadDamage` only queues the faint; the `|faint|` line and everything hanging off
         * it come out of `faintMessages`, which `hitStepMoveHitLoop` calls after the ENTIRE hit loop
         * (battle-actions.ts:972). So a spread move that kills its first target still writes the
         * second target's `-damage` before the first one's `|faint|`. The STATE moves now, exactly as
         * it always did; only the announcement waits. */
        if(tg.curHP<=0){tg.curHP=0;tg.fainted=true;R.fainted=true;}
        else R.hit=true;
      };
      /* STEP 7c -- runMoveEffects / selfDrops / secondaries (battle-actions.ts:1086-1101): everything
       * a connecting hit leaves behind, for every target, AFTER every target's damage. */
      const _stepEffects=(R)=>{const tg=R.tg;const _react=R.react;
        if(!R.hit)return;
        {
          /* WIRE 4 of N -- buffsHolderOnHit and punishesAttacker, ONE dispatch through the `contact`
           * linkage key. Both were entirely absent from this engine.
           *
           * THIS IS WILL'S BELLIBOLT TURN. Discharge into Archaludon was resisted AND handed it a
           * free Stamina boost, and the bot could not see either half: it had no notion that hitting
           * something can make it STRONGER. buffsHolderOnHit compounds -- every hit makes the next
           * worse -- while punishesAttacker is a flat toll you can pay. Opposite decisions, which is
           * exactly why Will had them split into two tags.
           *
           * The order matters: the buff lands on a target that survived (checked above), and the
           * attacker toll is paid whether or not the target survived, so it sits outside this else.
           * Contact is read from the move's own flag via the linkage key rather than a name list. */
          /* ROADMAP #101 -- AND THE CONDITION IS NOW READ. The block below applied `_buff.boosts` on
           * EVERY connecting hit, because the tag carried WHAT the holder gains and never WHEN. That
           * is a family that fails OPEN, which is the opposite of the pinch family WIRE 112 landed:
           * nothing was missing, a WRONG ANSWER was being produced on every hit. Measured before a
           * line changed, on one Knock Off into a 20x-HP Garchomp --
           *     angerpoint  atk +6 on a NON-crit, and IDENTICAL on a crit  (an unwired knob)
           *     justified   atk +1 off CLOSE COMBAT, a Fighting move
           *     weakarmor   def -1 / spe +2 off DARK PULSE, a special move
           *     stamina     def +1                                        (correct, and the control)
           * Stamina is 2,773 of the family's 2,972 uses and carries `when: null`, which is exactly
           * why nothing ever noticed the other eleven.
           *
           * `condHolds` is the same one reader ROADMAP #112 built; NULL means "this engine cannot
           * evaluate that shape" and REFUSES the buff, counted. A guessed condition on a family that
           * compounds is the boolean-in-a-fraction's-clothing defect with interest. */
          const _buff=TAGS.param('ability',tg.ability,'buffsHolderOnHit');
          /* `R.crit` IS PASSED RAW, NOT COERCED. `!!R.crit` would turn "the damage step never ran, so
           * nobody knows" into a confident `false` and Anger Point would silently never fire again --
           * the same silent default one shape over. condHolds refuses a non-boolean and counts it. */
          const _bHit=_buff?{crit:R.crit,moveType:effMoveType(mv,a.move.id,field,m),
                             category:mv.c==='P'?'Physical':mv.c==='S'?'Special':'Status',
                             moveId:a.move.id}:null;
          const _bw=_buff?condHolds(_buff.when,tg,_bHit):false;
          if(_buff&&_bw===null){MEDFAILS.buffOnHitUnknownCond++;
            if(!MEDFAILS.buffOnHitUnknownCondFirst)
              MEDFAILS.buffOnHitUnknownCondFirst=String(tg.ability)+'/'+JSON.stringify(_buff.when);}
          /* THE VOLATILE HALF, WHICH THE OLD GUARD DROPPED ENTIRELY. `_buff.boosts && tg.boosts` also
           * refused every member whose payload is `gainsVolatile` -- electromorphosis (98 uses),
           * windpower, perishbody. This engine has no consumer for `charge` and no ability-sourced
           * duration for `perishsong`, so they are still not granted; the difference is that the debt
           * is now COUNTED at the moment the condition holds instead of being invisible. */
          if(_buff&&_bw===true&&_buff.gainsVolatile&&!_buff.boosts){
            MEDFAILS.buffOnHitVolatileUnwired++;
            if(!MEDFAILS.buffOnHitVolatileUnwiredFirst)
              MEDFAILS.buffOnHitVolatileUnwiredFirst=String(tg.ability)+'/'+String(_buff.gainsVolatile);}
          if(_buff&&_bw===true&&_buff.boosts&&tg.boosts){
            /* The tag names the stats and the sizes, read from the handler's own this.boost({...}).
             * Showdown spells them atk/def/spa/spd/spe; this engine uses at/df/sa/sd/sp. That map is
             * a naming convention, not a mechanic, so it lives here rather than in the artifact.
             * WIRE 84: once PER HIT, the same count the punish block uses -- Weak Armor off a
             * Bullet Seed is -3/+6, not -1/+2. `compounds` is what the tag calls this and it is
             * true for every member that reaches here. */
            for(let _bh=0;_bh<_react;_bh++)for(const k in _buff.boosts){
              const st=SD2ENG[k]; if(!st||tg.boosts[st]==null)continue;
              const _b0=tg.boosts[st];
              tg.boosts[st]=clamp(tg.boosts[st]+_buff.boosts[k],-6,6);
              if(TR)TR.bst(tg,st,tg.boosts[st]-_b0,'[from] ability: '+tg.ability);
            }
          }
          /* SECONDARY EFFECTS, from the shared rulebook. Rolled once per connecting hit, after
           * damage, and only on a target still standing. Previously ONLY Fake Out could flinch and
           * no attacking move could ever inflict a status, so Rock Slide, Iron Head, Scald, Nuzzle
           * and 207 others were inert. Shield Dust and Sheer Force suppress secondaries entirely. */
          const tgAb=(tg.ability||'').replace(/[^a-z0-9]/g,'');
          const mAb=(m.ability||'').replace(/[^a-z0-9]/g,'');
          const fx=moveFx(a.move.id);
          /* WIRE 97 -- Sheer Force's suppression half reads its own tag (`removesOwnSecondaries`);
           * the x1.3 it pays for lives in dmgRange under the same tag. Shield Dust stays a name:
           * it carries `untagged` and no derivation describes it yet -- declared, not hidden.
           *
           * WIRE 115 -- THE TWO SUPPRESSIONS ARE NOT THE SAME SUPPRESSION and merging them into one
           * boolean was wrong in a way no single-mechanic probe could see. Sheer Force sets
           * `move.secondaries = null` -- EVERY secondary goes, including the ones that boost the
           * USER. Shield Dust's handler is `secondaries.filter(effect => !!effect.self)` -- it KEEPS
           * the self ones. So a Trailblaze into a Shield Dust body still leaves the attacker at
           * Speed +1, and this engine was zeroing it. Verified in the official engine, both arms:
           * Shield Dust spe+1, Compound Eyes control spe+1. `suppressed` is kept for the two effects
           * bolted on from outside the move (King's Rock, the procedural status set), where both
           * abilities really do stop the same thing. */
          const dustBlocked = tgAb==='shielddust';
          const sheerForce  = !!TAGS.param('ability',mAb,'removesOwnSecondaries');
          const suppressed  = dustBlocked || sheerForce;
          /* WIRE 89 -- THE SECONDARY CHANCE IS A FACT ABOUT THIS FORMAT, AND THE RULEBOOK THIS BLOCK
           * READS IS NOT A FORMAT. `CHOMP/data/move-effects.json` is generated from
           * `play.pokemonshowdown.com/data/moves.json` -- the GENERIC gen-9 move data -- and its own
           * header calls itself *"Authoritative — this is the server data the format runs on."* It is
           * not: `Dex.forFormat('gen9championsvgc2026regmb')` applies Champions' own modifications on
           * top, and `data/tags.json` is derived through that door. CLAUDE.md already says this in
           * the one place it was learned -- *"the ban is a MECHANISM, not a list, so read it from the
           * FORMAT rather than from memory"* -- and this is the same rule one field over.
           *
           * MEASURED BEFORE IT WAS WIRED, by tests/test-rulebook-collision.js, which compares the two
           * rulebooks fact by fact: 149 of 151 comparable facts AGREE and exactly TWO disagree, both
           * of them a Champions change the generic file cannot know about --
           *     IRON HEAD    flinch 20% in this format, 30% generic   7,095 corpus uses
           *     TOXIC THREAD Speed -2 in this format, -1 generic          6 uses
           * So this is not a wholesale switch of rulebooks (that is an architecture decision and it
           * is not ENGINE's): it is the CHANCE, one field, taken from the artifact that read the
           * format, and every disagreement is COUNTED so a third one cannot arrive silently. */
          if(fx&&fx.secondary&&!sheerForce){
            const _si=TAGS.param('move',a.move.id,'statusInflict');
            const _fmtChance=(s)=>{
              if(!_si||!Array.isArray(_si.effects))return null;
              const _k=s.status?['status',s.status]:s.volatile?['volatile',s.volatile]:null;
              if(!_k)return null;
              const _e=_si.effects.find(e=>e&&e[_k[0]]===_k[1]&&(e.to==null||e.to==='target'));
              return _e&&_e.chance!=null?+_e.chance:null;
            };
            for(const s of fx.secondary){
              /* WIRE 115 -- SHIELD DUST, at the one site where it is correct, and shaped like the
                 handler rather than like a name: the filter KEEPS the entries marked `self` and drops
                 the rest, so a status, a target drop or a flinch goes and the user's own boost stays.
                 Counted, because a refusal that cannot prove it fired is assumed broken. */
              if(dustBlocked&&!s.selfBoosts){MEDSEEN.dustBlockedSecondary++;continue;}
              const _generic=(s.chance==null?100:s.chance);
              const _fmt=_fmtChance(s);
              if(_fmt!=null&&_fmt!==_generic){
                MEDFAILS.rulebookChanceDrift++;
                if(!MEDFAILS.rulebookChanceDriftFirst)
                  MEDFAILS.rulebookChanceDriftFirst=a.move.id+':'+(s.status||s.volatile)+' format '+_fmt+' vs generic '+_generic;
              }
              if(rng()*100>=(_fmt!=null?_fmt:_generic)) continue;
              /* WIRE 133 -- the ATTACKER is passed so a side buff on the target's side can refuse
                 it. Showdown's Safeguard suppresses the `-activate` line for a SECONDARY (`!effect
                 .secondaries`), which is why the refusal here is silent and the direct status path's
                 is not. */
              if(s.status){ applyStatus(tg,s.status,m); }
              /* WIRE 16 -- secondary STAT DROPS, the third kind of secondary and the one that was
               * silently missing: Icy Wind and Electroweb (100% spe-1, the format's speed control),
               * Snarl (spa-1), Breaking Swipe (atk-1), Crunch's 20% def-1. The rulebook carried
               * targetBoosts all along; this block only ever read status and flinch. Clear Body /
               * White Smoke / Full Metal Body refuse drops, from their own shared gate. */
              /* WIRE 3 -- THROUGH THE ONE GATE. This was a hardcoded clearbody/whitesmoke/
               * fullmetalbody triple, so Hyper Cutter took Breaking Swipe's -1 Attack and Big Pecks
               * took Crunch's -1 Defense, both of which Showdown's onTryBoost deletes. `true` is the
               * SECONDARY flag: the block still happens, the `-fail` line does not. */
              else if(s.targetBoosts&&tg.boosts){
                for(const k in s.targetBoosts){
                  const _st=SD2ENG[k];
                  if(_st&&tg.boosts[_st]!=null&&s.targetBoosts[k]<0){
                    if(refuseStatDrop(tg,_st,a.move.id,true)) continue;
                    const _b0=tg.boosts[_st];
                    tg.boosts[_st]=clamp(tg.boosts[_st]+s.targetBoosts[k],-6,6);
                    if(TR)TR.bst(tg,_st,tg.boosts[_st]-_b0);
              /* WIRE 138 -- ONCE PER STAT LOWERED. `retaliateWhenLowered` is the shared reader; the
                 attacker is named so an ALLY's drop does not trigger it. */
                    if(tg.boosts[_st]!==_b0)retaliateWhenLowered(tg,m);}
                }
              }
              /* WIRE 81 -- THE SECONDARY THAT BOOSTS THE *USER*, and this block read every other kind.
                 `s.status`, `s.targetBoosts` and the flinch were all handled and `s.selfBoosts` was
                 not, so Trailblaze, Aqua Step, Flame Charge, Rapid Spin, Torch Song, Aura Wheel and
                 Psyshield Bash -- all 100% self-boosts, the entire reason those moves are clicked --
                 landed their damage and left the user's stages alone. 12 moves, 1,199 corpus uses,
                 membership printed before the wire.
                 Found by the generated interaction matrix at full depth, on 23 cases at once, all
                 reading `.A.active[0].boosts.spe medi=0 sd=1` against the official engine.
                 SUPPRESSED WITH THE OTHER SECONDARIES, because that is what it is: Sheer Force turns
                 these off in the real game too, and it sits inside the same `!suppressed` gate.
                 CONTRARY IS APPLIED, matching the target-side reader two branches up. */
              else if(s.selfBoosts&&m.boosts&&!m.fainted){
                const _sg=invSign(m);          // WIRE 100b
                for(const k in s.selfBoosts){
                  const _st=SD2ENG[k];
                  if(_st&&m.boosts[_st]!=null){const _b0=m.boosts[_st];
                    m.boosts[_st]=clamp(m.boosts[_st]+s.selfBoosts[k]*_sg,-6,6);
                    if(TR)TR.bst(m,_st,m.boosts[_st]-_b0);}
                }
              }
              /* ROADMAP #92 -- THE SECONDARY CONFUSION, which reached NO branch at all before this:
               * Water Pulse (20%, 84 uses), Hurricane (30%, 3,779 uses), Dynamic Punch (100%, 19) and
               * Axe Kick all fell through `status`, `targetBoosts`, `selfBoosts` and `flinch` and out
               * of the loop. THE SAME FUNCTION the direct status path uses, so a refusal cannot be
               * honoured on one road and not the other. */
              else if(s.volatile==='confusion'){ applyConfusion(tg,m,field,true); }
              else if(s.volatile==='flinch'){
                /* Flinch needs BOTH conditions: the target must not have moved yet this turn, and
                 * Inner Focus blocks it outright. WIRE 118: "not yet moved" is the target still
                 * being in `unresolved`, which is the same question the frozen index used to answer
                 * and the only one that still means anything once the queue re-sorts. */
                /* Counted on all three branches so a zero is DIAGNOSTIC rather than merely absent:
                 * "never fired" and "always blocked by Inner Focus" and "the target had already
                 * moved" are three different states and only the first is a defect. */
                if(!unresolved.has(tg)) MEDSEEN.flinchTooLate++;
                else if(tgAb==='innerfocus') MEDSEEN.flinchBlockedByInnerFocus++;
                else { tg._flinch=true; MEDSEEN.flinch++; }
              }
            }
          }
          /* WIRE 133 -- BURNING JEALOUSY AND ALLURING VOICE (`punishesBoostedTarget`, 219 uses).
           *
           * THE CONDITION IS THE MECHANIC and it is the half a naive fix drops: the effect lands ONLY
           * if the target had a stat RISE this turn. An engine that burned unconditionally would be
           * strictly worse than one that never burned -- a 70 BP Fire move with a free guaranteed burn
           * is not a move that exists. `statsRoseThisTurn` answers it from the turn-opening snapshot,
           * so a rise through ANY path counts, including one nobody wired a flag into.
           *
           * WHAT it lands is the artifact's now (`{effect:'status', status:'brn'}` against
           * `{effect:'volatile', volatile:'confusion'}`), because the two members do different things
           * and a consumer reading the bare condition would have had to guess.
           *
           * ALLURING VOICE'S HALF IS DECLARED AND NOT MODELLED: this engine holds no confusion
           * volatile at all (see the `tangledfeet` row in the damage table, which is switched off for
           * the same reason). It is COUNTED rather than silently skipped, so "the confusion arm never
           * fires" reads as the known gap it is instead of as a working feature.
           *
           * Inside the same `!suppressed` gate as every other secondary: Shield Dust and Sheer Force
           * treat this exactly as they treat the rest, because upstream it IS a secondary. */
          {const _pb=TAGS.param('move',a.move.id,'punishesBoostedTarget');
           if(_pb&&_pb.onlyIfTargetBoostedThisTurn&&!suppressed&&!tg.fainted&&statsRoseThisTurn(tg)){
             if(_pb.effect==='status'&&_pb.status){
               if(applyStatus(tg,_pb.status,m))MEDSEEN.punishBurned++;
             /* ROADMAP #92 -- ALLURING VOICE'S HALF IS NO LONGER DECLARED-AND-UNMODELLED. The comment
              * above still describes the state this engine was in until confusion existed; the arm is
              * wired now and `MEDFAILS.punishEffectUnmodelled` stays as the receipt for a THIRD member
              * arriving with an effect neither branch knows. */
             } else if(_pb.effect==='volatile'&&_pb.volatile==='confusion'){
               if(applyConfusion(tg,m,field,true))MEDSEEN.punishConfused++;
             } else {
               MEDFAILS.punishEffectUnmodelled++;
               if(!MEDFAILS.punishEffectUnmodelledFirst)
                 MEDFAILS.punishEffectUnmodelledFirst=a.move.id+' -> '+(_pb.volatile||_pb.effect||'?');
             }
           }}
          /* WIRE 103 -- KING'S ROCK (`addsFlinch`): a 10% flinch bolted onto a damaging move that
           * has no flinch of its own -- Showdown's handler adds the secondary only when none of the
           * move's own secondaries is a flinch, and that gate is reproduced from the rulebook rather
           * than assumed. Inside the same suppression the real game applies: Shield Dust blocks it
           * on the target and Sheer Force deletes it on the user (the item is why a Sheer Force
           * holder never runs the Rock). Same actedAt/Inner Focus bookkeeping as every other flinch,
           * so a zero in MEDSEEN.flinch stays diagnostic. */
          {const _kr=TAGS.param('item',m.item,'addsFlinch');
           if(_kr&&_kr.pFlinch&&!suppressed&&!tg.fainted
              &&!(fx&&fx.secondary&&fx.secondary.some(s=>s&&s.volatile==='flinch'))
              &&rng()<+_kr.pFlinch){
             if(!unresolved.has(tg)) MEDSEEN.flinchTooLate++;
             else if(tgAb==='innerfocus') MEDSEEN.flinchBlockedByInnerFocus++;
             else { tg._flinch=true; MEDSEEN.flinch++; }
           }}
          /* WIRE 141 -- FLING'S SECONDARY IS NOT IN THE RULEBOOK, BECAUSE IT COMES OUT OF THE ITEM.
           * `data/moves.ts` pushes `{status: item.fling.status}` or
           * `{volatileStatus: item.fling.volatileStatus}` onto `move.secondaries` at prepareHit, with
           * NO chance field -- so it always applies. A Light Ball paralyses, a Flame Orb burns, a
           * Toxic Orb badly poisons, a King's Rock flinches. This engine's secondary loop reads a
           * static rulebook keyed by move id and structurally cannot carry an effect chosen at click
           * time, so the resolved effect rides on the attacker from the prepareHit block above.
           * It sits beside King's Rock because it is the same kind of thing -- a secondary bolted on
           * from outside the move -- and inside the same `suppressed` gate for the same reason. */
          {const _ff=m._flingFx;
           if(_ff&&!suppressed&&!tg.fainted){
             if(_ff.status)applyStatus(tg,_ff.status,m);
             else if(_ff.volatile==='flinch'){
               if(!unresolved.has(tg))MEDSEEN.flinchTooLate++;
               else if(tgAb==='innerfocus')MEDSEEN.flinchBlockedByInnerFocus++;
               else { tg._flinch=true; MEDSEEN.flinch++; }
             } else if(_ff.volatile){
               MEDFAILS.flingEffectUnmodelled++;
               if(!MEDFAILS.flingEffectUnmodelledFirst)MEDFAILS.flingEffectUnmodelledFirst=_ff.volatile;
             }
           }}
          /* WIRE 63 -- THE PROCEDURAL SECONDARIES. Dire Claw (2,300 uses) and Tri Attack roll ONE
           * status out of a set, chosen inside the handler, so the dex's `secondaries` entry carries a
           * chance and NO status at all -- the loop above read it, found nothing to apply, and moved
           * on. The tag carries the overall chance and the set; the pick is uniform over the set,
           * which is what `each` (0.1 of 0.3, 0.067 of 0.2) says. applyStatus enforces the immunities,
           * so a Tri Attack cannot freeze an Ice type. Suppressed by Shield Dust / Sheer Force with
           * the other secondaries, because that is what these are. */
          {const _ps=TAGS.param('move',a.move.id,'proceduralStatus');
           if(_ps&&_ps.p&&Array.isArray(_ps.oneOf)&&_ps.oneOf.length&&!suppressed&&rng()<+_ps.p){
             const _i=Math.min(_ps.oneOf.length-1,Math.floor(rng()*_ps.oneOf.length));
             applyStatus(tg,CODE_OF_STATUS[_ps.oneOf[_i]]||_ps.oneOf[_i],m);
           }}
          // Fake Out still flinches: it is a guaranteed flinch, and it always moves first (+3 priority)
          if(a.move.id==='fakeout'){
            if(!unresolved.has(tg)) MEDSEEN.flinchTooLate++;
            else if(tgAb==='innerfocus') MEDSEEN.flinchBlockedByInnerFocus++;
            else { tg._flinch=true; MEDSEEN.flinch++; } }
          /* WIRE 50 -- POISON TOUCH / TOXIC CHAIN, 985 sheets and nothing at all. Lesson 3 bites
           * hardest here and the tag says why: `needsContact` is true, so a SPECIAL attacker carrying
           * Poison Touch contributes to the sheet count and can never trigger. The chance is the
           * tag's 0.3, and applyStatus enforces the Steel/Poison immunities so a Poison Touch
           * Corviknight punch poisons nothing. */
          /* WIRE 115 -- AND SHIELD DUST STOPS THIS ONE, which is the half of the scope fix that
             would have been LOST if the blanket check in canTakeStatus were simply deleted. Poison
             Touch is not a secondary and is blocked anyway; Showdown's handler says so in its own
             comment ("Despite not being a secondary, Shield Dust / Covert Cloak block Poison Touch's
             effect") and a 40-seed sweep of the pinned engine reads 12/40 poisoned into Compound Eyes
             and 0/40 into Shield Dust. Named here, beside the effect, rather than inside a gate that
             also refuses Will-O-Wisp. */
          {const _pt=TAGS.param('ability',m.ability,'poisonsOnMyContact');
           if(_pt&&!dustBlocked&&(!_pt.needsContact||mvMakesContact(a.move.id))&&rng()<(+_pt.p||0.3))applyStatus(tg,'psn',m);}
          /* WIRE 30 -- blocksHealing. Psychic Noise is a DAMAGING move whose whole point is the two
           * turns of Heal Block it leaves behind, and the engine landed the 75 base power and none of
           * the effect. It is the counter to the entire healing family, so it lands in the same pass
           * as the family: wiring the healers first would make every one of them strictly better than
           * it is, for as long as the gap lasted.
           *
           * ON A CONNECTING HIT AND ON A LIVE TARGET, per target -- a spread move blocks each body it
           * actually reached. Turns come from the tag (+1 for the end-of-turn tick that fires on this
           * turn too), not from a 2 typed here. */
          {const _bh=TAGS.param('move',a.move.id,'blocksHealing');
           if(_bh&&_bh.turns&&tg&&!tg.fainted){const _h0=tg._healBlock;tg._healBlock=+_bh.turns+1;
             if(TR&&!(_h0>0))TR.vstart(tg,'move: Heal Block');}}
          /* WIRE 45 -- THROAT CHOP LEAVES THE SILENCE BEHIND. 2,845 corpus clicks and the largest
           * single unwired mechanic left: the move landed 80 base power and the two turns it exists
           * for did nothing at all. The duration comes from `blocksSoundMoves.turns`, which the
           * derivation now reads off the condition, and carries the same +1 as Heal Block and Encore
           * because the end-of-turn tick fires on the application turn too. */
          {const _bs=TAGS.param('move',a.move.id,'blocksSoundMoves');
           if(_bs&&_bs.turns&&!tg.fainted){const _n0=tg._noSound;tg._noSound=+_bs.turns+1;
             if(TR&&!(_n0>0))TR.vstart(tg,'move: Throat Chop');}}
          /* WIRE 51 -- THE PARTIAL TRAP. Infestation (761 uses) landed its 8 damage and then chipped
           * NOTHING -- the whole move is the four-to-five turns after it. The fraction is the tag's
           * `chipPerTurn`; the duration is the tag's `turns` string ("4-5"), and the LOW end is taken
           * rather than the mean, because over-running a trap invents turns of chip that the real
           * move may not get. The switch-blocking half IS modelled as of WIRE 116 -- see the gate in
           * the switch branch above; this comment used to say it was not. */
          {const _pt2=TAGS.param('move',a.move.id,'partialTrap');
           if(_pt2&&_pt2.chipPerTurn&&_pt2.duration&&!tg.fainted&&!tg._trap){
             /* WIRE 105 -- the trap KNOWS ITS TRAPPER. Showdown's partiallytrapped removes itself
              * the moment its source leaves the field (onUpdate checks source.isActive), and this
              * engine kept chipping forever: the interaction matrix's `infestation -> beakblast` row
              * had Beak Blast KO the trapper in BOTH engines and only medicham2 still showed
              * `vol:["partiallytrapped"]` afterwards. `by` is the body, compared by identity at the
              * tick. */
             /* THE COUNTER STARTS AT SHOWDOWN'S DURATION, NOT AT THE FELT TURN COUNT. This read
              * `_pt2.turns` ('4-5' -> 4), which is how many turns of chip the trapped side
              * EXPERIENCES -- already one tick short of the authority's counter, which starts at 5
              * and is decremented in the residual OF THIS TURN. So every trap read one low from the
              * moment it landed: all seven trapping moves showed `showdown 4 / ours 3` then `3 / 2`.
              * The volatile-duration defect a third time, in the one counter that lives in `_trap`
              * rather than `_vol` and so was outside both previous fixes' reach. */
             tg._trap={frac:+_pt2.chipPerTurn,turns:+_pt2.duration,by:m};
             if(TR)TR.actOf(tg,'move: '+a.move.id,m);
           }}
          /* WIRE 52 -- CURSED BODY, 1,342 sheets. It seals the move that just hit it, which is
           * Disable arriving from the defending side, and the engine already has everywhere it needs
           * to land: `_sealed` plus `_vol.disable` are what WIRE 26 built for Disable itself, and
           * chooseAction and the WIRE 24 forced-action guard both already honour them. The CHANCE is
           * the artifact's now (0.3, read out of the handler's `randomChance(3, 10)`); the boolean it
           * used to carry would have made every Gengar a permanent Disable machine.
           * The duration is Disable's own from the sealsMoves tag, so one number serves both routes. */
          {const _cb=TAGS.param('ability',tg.ability,'disablesAttacker');
           if(_cb&&_cb.chance&&!m.fainted&&!(m._vol&&m._vol.disable>0)&&rng()<+_cb.chance){
             /* ROADMAP #111 -- THROUGH THE SHARED DURATION MODEL, and `alreadyMoved` is FALSE here on
              * purpose. The body Cursed Body seals is the one that is MOVING RIGHT NOW, and Showdown
              * spells that out as the second half of disable's own clause --
              *   `if (this.queue.willMove(pokemon) || (pokemon === this.activePokemon && ...))`
              * -- so a body mid-move counts as not-yet-spent exactly like one still queued. What
              * stood here was `turns + 1`, a hand-compensation for the tick that gave Cursed Body 6
              * where Showdown gives 4. */
             const _dt=TAGS.param('move','disable','sealsMoves');
             (m._vol=m._vol||{}).disable=volDurationOnApply('disable',false,_dt)||1;
             MEDSEEN.volDurationApplied++;
             m._sealed=a.move.id;
             if(TR){TR.act(tg,'ability: '+tg.ability);TR.vstart(m,'Disable',a.move.id);}
           }}
        }
        /* Spicy Spray's burn was an independent hardcode here, gated on PHYSICAL -- the handler
         * has no such gate; it burns on ANY damaging hit. Now served by the punishesAttacker wire
         * above, from the artifact, with the gate the handler actually states (none). */
      };
      /* STEP 8 -- faintMessages (battle.ts:2585), which `hitStepMoveHitLoop` calls once the loop is
       * done. The `|faint|` line and the AfterFaint event both live here, which is why a KO scored on
       * the first body of a spread move cannot be holding a Beast Boost when the second body is
       * priced -- `AfterFaint` is run at battle.ts:2598, two steps after getSpreadDamage. */
      const _stepFaint=(R)=>{const tg=R.tg;
        if(!R.fainted)return;
        if(TR)TR.faint(tg);
        /* WIRE 104 -- `boostsOnKO` (Eelevate on Eelektross-Mega; Beast Boost's carriers are not in
         * the format's usage but the read is by shape). +1 to the attacker's HIGHEST raw stat on a
         * kill it scored, from the tag's own {stat:'highest', stages:1}. Sheet usage reads 0
         * because sheets list the pre-mega ability -- Lesson 3, same as Mega Sol. */
        {const _bk=TAGS.param('ability',m.ability,'boostsOnKO');
         if(_bk&&_bk.stages&&!m.fainted&&m.boosts){
           let _key=SD2ENG[_bk.stat]||null;
           if(_bk.stat==='highest'||!_key){
             _key='at';for(const _k2 of ['df','sa','sd','sp'])if(m.st[_k2]>m.st[_key])_key=_k2;
           }
           const _b0=m.boosts[_key];m.boosts[_key]=clamp(m.boosts[_key]+(+_bk.stages||1),-6,6);
           if(TR)TR.bst(m,_key,m.boosts[_key]-_b0,'[from] ability: '+m.ability);
         }}
      };
      /* ---- THE STEP LIST, IN SHOWDOWN'S ORDER, AND THE DRIVER UNDER IT ----------------------------
       *
       * `moveSteps` is DATA in the authority and it is data here, which is the only reason the blocks
       * above could stay where the file already had them: this array is the order, not the file. The
       * two nested loops are the whole of ROADMAP #81 WIRE 10 -- step outside, target inside. Swap
       * them and the engine resolves a target at a time, which is what it did until this wire and
       * what `tests/probe_red_demo.js` reverts to in order to show the probes red.
       *
       * AT ONE TARGET THE TWO ORDERS ARE THE SAME PERMUTATION. That is not a hope, it is arithmetic,
       * and it is why a single-target hit is untouched by this restructure while a spread hit is
       * re-shaped completely. */
      const _STEPS=[_stepInvuln,_stepTryHit,_stepTypeImm,_stepTryImm,_stepAccuracy,
                    _stepDamage,_stepApply,_stepEffects,_stepFaint];
      for(const _step of _STEPS)for(const R of _rows){if(R.out)continue;_step(R);}
      /* ROADMAP #81 WIRE 1 -- NOTHING GOT THROUGH, so the move FAILED and the crash is paid. This is
         the immunity half of the same rule the shield half above pays: measured in the authority, a
         High Jump Kick into a Ghost prints `|-immune|` and then takes the user to `0 fnt`. No
         `continue` is needed -- `dealt` and `connected` are both still zero, so every self-effect
         below is already refusing on its own gate. */
      if(_hadTargets&&!_reached)_crashOnFail();
      /* ROADMAP #84 -- THE MOVE'S OWN RESULT, and Showdown's rule is not "did I deal damage".
       * `moveResult = !!targets.length` after the whole hit-step list (battle-actions.ts:614), so a
       * move that reached ANY body is true even if it dealt zero to it; a move that reached none is
       * false when something explicitly refused it and NULL when nothing did (an absorbing ability's
       * onTryHit returns null, Protect returns NOT_FAIL). `_reached` is this engine's own count of
       * bodies past every gate and has existed since ROADMAP #81 WIRE 1 for the crash. */
      if(_hadTargets)m._mvRes=_reached?true:(_explicitFail?false:null);
      /* THE PIVOT HALF, AFTER THE DAMAGE. U-turn, Volt Switch and Flip Turn carry base power, so
         they arrived here as ordinary attacks and the user simply stayed -- the chip was modelled
         and the momentum, which is the reason the move is played, was not. The tag says which moves
         leave; `pivotDamaging` is the damaging set.
         AFTER, not before: the attack resolves from the ORIGINAL body, so its damage, its ability
         and its item are the outgoing mon's. Switching first would fire the move off the replacement.
         A user that fainted to recoil or to a contact punish does not leave, and an empty bench
         makes it a plain attack. */
      /* WIRE 121 -- AND ONLY IF THE MOVE ACTUALLY CONNECTED. Showdown fires `selfSwitch` inside
         `useMoveInner` only when `moveHit` did not fail, so a Volt Switch into a LIGHTNING ROD, VOLT
         ABSORB or MOTOR DRIVE body leaves its user exactly where it stood. medicham2 pivoted anyway,
         which turns the three abilities built to punish an Electric click into a free escape.
         MEASURED AT THE PINNED COMMIT, all three arms printed: into Lightning Rod and into Volt
         Absorb `p1 slot0 after = pikachu`; into a Marvel Scale control `p1 slot0 after = garchomp`.
         `dealt > 0` is the same gate WIRE 46 puts on `userFaints`, and it is an APPROXIMATION stated
         rather than discovered: it also refuses the pivot on a hit that legitimately deals zero, of
         which this format's `pivotDamaging` set (U-turn, Volt Switch, Flip Turn, Chilly Reception's
         damaging cousins) has no member -- all are 100% accurate with base power. Found by the
         generated matrix as `voltswitch -> lightningrod` / `-> voltabsorb` / `-> motordrive`, the
         largest remaining pair-volume disagreement (1,459 x 2,108). */
      // recoil, from the move table's dex-generated fraction (was a 12-name hand table)
      /* WIRE 53 -- ROCK HEAD, 784 sheets. The recoil line above has been correct since the move table
         carried `rc`, and the ability that DELETES it had no representation at all -- so a Rock Head
         Brave Bird cost its user a third of its HP in every rollout. The multiplier is the tag's own
         `recoil: 0` rather than a boolean, so an ability that merely halved recoil would arrive with
         no edit here. */
      const _nr=TAGS.param('ability',m.ability,'noRecoil');
      const _rcF=recoilOf(a.move.mv)*((_nr&&_nr.recoil!=null)?+_nr.recoil:1);
      /* ROADMAP #81 WIRE 4 -- RECOIL IS `Math.round`, CLAMPED TO AT LEAST 1, AND IT IS A RATIO AND
       * NOT A FLOAT. `applyRecoilDamage` (sim/battle-actions.ts:1384):
       *
       *     clampIntRange(Math.round(damageDealt * move.recoil[0] / move.recoil[1]), 1)
       *
       * This engine floored, and it floored a PRE-DIVIDED float -- `recoilOf` returns `rc[0]/rc[1]`,
       * so a 1/3 recoil arrives as 0.3333333333333333 and `dealt * that` is short of `dealt/3` by an
       * ulp on every multiple of 3. Two ways to be one point low on the same line, and recoil was
       * three of the four largest `-damage field 3` causes in the whole-game differential.
       * `recoilOf` keeps its float shape because the SCORER at line 2627 wants a fraction; the
       * numerator and denominator are read again here so the division happens in the order Showdown
       * does it. Rock Head's `recoil: 0` still zeroes the whole thing before the clamp. */
      const _rc=a.move.mv&&a.move.mv.rc;
      const _rcMul=(_nr&&_nr.recoil!=null)?+_nr.recoil:1;
      const _rcDmg=(_rc&&_rcMul)?Math.max(1,Math.round(dealt*_rc[0]*_rcMul/_rc[1])):0;
      if(_rcF&&dealt>0){m.curHP-=_rcDmg;
        if(TR)TR.dmg(m,'[from] Recoil');
        if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);}}
      /* WIRE 19 -- DRAIN, the exact mirror of the recoil line above and absent entirely. 8,553 corpus
       * clicks: Matcha Gotcha 4,957, Giga Drain 1,255, Drain Punch 916, Draining Kiss 814. The damage
       * landed and the heal was simply never applied -- `dealt 51 to the foe; user 85 -> 85 hp` -- so
       * the single largest recovery route in the format was worth nothing to any rollout, and a
       * searcher choosing between Drain Punch and a bigger attack was choosing on damage alone.
       *
       * `dealt` is the SUM ACROSS TARGETS and is already capped at each target's remaining HP by the
       * damage loop, which is the rule: you drain what you actually took off, so draining a body with
       * 3 HP left heals for 3, not for the roll. That cap is why this reuses `dealt` rather than the
       * damage range -- the same reason recoil does.
       *
       * THE FRACTION COMES FROM THE ARTIFACT, and it did not exist there this morning. The tag said
       * `readFrom: "m.drain"` -- a pointer into Showdown's dex, which this engine does not have, since
       * MC.moves carries `rc` for recoil and nothing for drain. So a consumer could learn THAT a move
       * drains and never how much. engine/tag_dex.js now emits the value. Reading `unusual:false` and
       * assuming 0.5 would have been a silent default AND would have left Draining Kiss, which is 3/4,
       * quietly wrong in the one case the flag exists to mark. */
      /* WIRE 88, the other half: a landed Steel Roller REMOVES the terrain. `clears` is the tag's,
         read from the handler's own clearTerrain(). */
      {
        const _ft2=TAGS.param('move',a.move.id,'failsWithoutTerrain');
        if(_ft2&&_ft2.clears&&connected){const _t0=field.terrain;field.terrain='';field.terrainT=0;
          if(TR&&_t0)TR.terrainEnd(_t0);}
      }
      {
        const _dr=TAGS.param('move',a.move.id,'drain');
        /* Heal Block takes the HEAL and leaves the DAMAGE, which is the rule and is also the only
         * version worth modelling: a Drain Punch under Heal Block is still a Drain Punch. */
        if(_dr&&_dr.fraction&&dealt>0&&!m.fainted&&m.st&&!healBlocked(m)){
          /* WIRE 87 -- CLAMPED AGAINST THE HP THE USER HAD BEFORE ANY REACTION, not against the HP
           * it has now. Showdown drains inside the move and pays the contact toll afterwards, so a
           * full-HP Draining Kiss into Rough Skin gains NOTHING from the drain and still pays the
           * eighth. Adding the heal to the post-toll HP healed the toll straight back. */
          /* ROADMAP #81 WIRE 4 -- THE DRAIN IS ROUNDED, NOT FLOORED. `sim/battle.ts:2168` is
           * `Math.round(targetDamage * effect.drain[0] / effect.drain[1])` from gen 5 on (gen <= 4
           * is the floor, and that branch is not this format). Same root as recoil, opposite sign:
           * flooring cost the user half a point of health on average on 8,553 corpus clicks. */
          /* BIG ROOT, 53 uses — a roster DID-NOT-FIRE row and it had no tag at all until now.
           * `onTryHeal` multiplies a heal by 5324/4096 (x1.2998) but ONLY when the effect that
           * produced it is on its own list — drain, Leech Seed, Ingrain, Aqua Ring, Strength Sap. The
           * SOURCE LIST IS PART OF THE FACT and is carried in the tag: this does not boost Recover, a
           * berry or Leftovers, and an item that boosted all healing would be a different item.
           * Applied INSIDE the rounding, because Showdown modifies the heal before it rounds. */
          const _br=TAGS.param('item',m.item,'healMultBySource');
          const _brM=(_br&&_br.mult&&Array.isArray(_br.from)&&_br.from.includes('drain'))?+_br.mult:1;
          const _gain=Math.min(m.st.hp,_hpPreReact+Math.round(dealt*_dr.fraction*_brM))-_hpPreReact;
          if(_gain>0){m.curHP=Math.min(m.st.hp,m.curHP+_gain);if(TR)TR.heal(m,'[from] drain');}
        }
      }
      /* SHELL BELL, 44 uses — a roster DID-NOT-FIRE row, and it sits here for the same reason recoil
       * does: both are a fraction of the damage the move ACTUALLY dealt.
       *     onAfterMoveSecondarySelf: if (move.totalDamage && !forceSwitchFlag) heal(totalDamage / 8)
       * `dealt` is already the sum across targets, capped at each target's remaining HP — which is
       * exactly Showdown's `totalDamage`, so a spread move heals off the sum and a hit into a body
       * with 3 HP left heals off 3 rather than off the roll. The drain comment above establishes that
       * property and this reuses it rather than re-deriving it.
       *
       * HEAL BLOCK STOPS IT, like the drain. A KO'd user heals nothing. */
      {
        const _sb=TAGS.param('item',m.item,'healFromDamageDealt');
        if(_sb&&_sb.div&&dealt>0&&!m.fainted&&m.st&&m.curHP>0&&!healBlocked(m)){
          /* THE ROUNDING IS THE AUTHORITY'S, AND `Math.round` WAS WRONG BY ONE EVERY TURN. Measured:
           * the roster read FIRED-AND-BOARDS-DIFFER with ours consistently HIGH.
           * `sim/battle.js` heal(): `if (damage && damage <= 1) damage = 1; damage = this.trunc(damage);`
           * So the min-1 clamp applies to a value at or below 1, and everything else TRUNCATES. At
           * dealt=12 that is 1.5 -> 1, where a round gives 2. Order matters: clamp first, then trunc. */
          let _h=dealt/+_sb.div; if(_h&&_h<=1)_h=1; _h=Math.floor(_h);
          const _b4=m.curHP; m.curHP=Math.min(m.st.hp,m.curHP+_h);
          if(TR&&m.curHP>_b4)TR.heal(m,'[from] item: '+m.item);
        }
      }
      /* WIRE 65 -- A MOVE THAT REACHED NOTHING PAYS NOTHING. Found by tests/test-game-diff.js's
         GENERATED pair matrix on its first run, six pairs at once: Close Combat into a Protect read
         `medi def -1 / spd -1` against Showdown's `0 / 0`. The self-drop applied unconditionally, so
         a blocked Close Combat, a Draco Meteor into a Fairy and an Overheat into a Flash Fire all
         cost the user its stats for nothing -- and the searcher saw that cost on every one of them.
         `connected` is set only where a body actually took the hit, which is after Protect, after the
         type immunity, after the absorb ability and after the invulnerability check. */
      // self stat changes from mv.self (dex-generated); Contrary flips drops into boosts
      const sdrop=connected?a.move.mv.self:null;
      if(sdrop){const sgn=invSign(m);   // WIRE 100b
        for(const k in sdrop){const _st=SD2ENG[k];if(_st&&m.boosts[_st]!=null){const _b0=m.boosts[_st];
          m.boosts[_st]=clamp(m.boosts[_st]+sdrop[k]*sgn,-6,6);
          if(TR)TR.bst(m,_st,m.boosts[_st]-_b0);}}}
      /* WIRE 97 -- a Sheer Force-boosted move pays NO Life Orb recoil (the real interaction, and the
         reason the pairing is played). Boosted means: the ability removes secondaries AND this move
         had one to remove -- the same two reads the damage half makes. */
      /* ROADMAP #81 WIRE 12 -- AND IT IS ONLY PAID BY A MOVE THAT REACHED A BODY. `_reached > 0` is
         the gate WIRE 10 removed without meaning to, and removing it is the whole of that rung's
         board regression.
         WIRE 10 rewrote the hit loop into Showdown's `for (step) for (target)` shape, which put the
         ACCURACY roll inside the step walk (correctly -- `hitStepAccuracy` really is step 5, below
         TryHit and the immunities). What went with it was the `continue` the old whole-move roll had:
             if(_mvAcc<100&&rng()*100>_mvAcc){ ...; m._mvRes=false; _crashOnFail(); continue; }
         That `continue` skipped everything below the loop. Now the walk simply marks every row `out`
         and control falls straight through -- and the drain, the self-drop and the pivot all have
         their own `dealt`/`connected` gates, while THIS LINE never had one. So from WIRE 10 onward a
         Life Orb holder paid a tenth of its HP for a move that MISSED.
         MEASURED, three engines against the authority at the differential's own pin, with the same
         Pelipper and the same item and only the move's accuracy varied:
             Scald      (100 acc, HITS)     showdown 13   W9 13   W10 13
             Hydro Pump ( 80 acc, MISSES)   showdown  0   W9  0   W10 13   <-- the regression
         and the other four ways to reach no body were already right in all three (type immunity,
         Protect, an absorbing ability all leave `a.move.d.max` at 0 or `continue` above this site; a
         DISGUISE body IS a hit and pays, 13 in the authority and 13 here).
         NOT SPREAD-SPECIFIC, which is why WIRE 10's own "36/36 single-target clicks are byte-
         identical" control could not see it: every one of those 36 clicks LANDED, so none of them
         exercised the branch the change deleted. It is every missed move by a Life Orb holder, and
         Life Orb is 12,155 corpus sheets.
         `_reached` rather than `connected`: `connected` is set inside the substitute-aware damage
         path, and Showdown's rule is `AfterMoveSecondarySelf` running inside `spreadMoveHit`, which
         is "at least one body was hit" -- exactly what `_reached` counts. */
      if(m.item==='lifeorb'&&a.move.d.max>0&&_reached>0){
        const _ros2=TAGS.param('ability',m.ability,'removesOwnSecondaries');
        const _sfB=_ros2&&(()=>{const f=moveFx(a.move.id);return !!(f&&f.secondary&&f.secondary.length);})();
        if(!_sfB){m.curHP-=Math.floor(m.st.hp*0.1);
          if(TR)TR.dmg(m,'[from] item: Life Orb');
          if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);}}
      }
      /* WIRE 137 -- THE PIVOT MOVED TO THE BOTTOM OF THE MOVE, AND IT WAS EMITTING FOR A BODY THAT
         HAD ALREADY LEFT THE FIELD.

         It used to sit immediately below the damage, ABOVE the recoil, the drain and the Life Orb
         toll -- so a U-turn or Flip Turn user paid all three from the BENCH. `ident()` resolves a
         body by its position in `actA`/`actB`, so every one of those lines was emitted as
         `|-damage|??: NAME|...`, which is `MEDFAILS.traceBodyOffField` and which
         tests/test-protocol-trace.js PART 6 says must read 0. Measured before this moved: 25 `??`
         lines in 120 self-driven games, EVERY ONE of them a Life Orb toll, a recoil or the faint that
         followed one, and every one on a body that had pivoted out. The counter was reported as
         `talonflame` first earlier today and as `palafin-hero` here -- the species is whoever happened
         to hold a Life Orb and a pivot move, not a property of either.

         AND IT IS THE AUTHORITY'S ORDER, not merely a fix for the identifier. `useMoveInner`
         (sim/battle-actions.ts) queues `selfSwitch` AFTER `trySpreadMoveHit` has run -- recoil, drain
         and `AfterMoveSecondarySelf` (which is where Life Orb lives) are all inside that call -- and
         it guards the switch with `else if (pokemon.hp)`. So a Life Orb holder on a sliver of HP that
         clicks U-turn DIES TO THE ORB AND DOES NOT PIVOT. This engine let it pivot and then killed it
         on the bench, which is a different board and not just a different line.

         `dealt` and `_reached` are read exactly as before; nothing about the pivot's own conditions
         has changed. The `!m.fainted && m.curHP > 0` gate is the `pokemon.hp` guard and now sits below
         the three things that can kill the user, which is the whole point of the move. */
      if(!m.fainted&&m.curHP>0&&dealt>0&&TAGS.has('move',a.move.id,'pivotDamaging')){
        const own=it.side==='A'?actA:actB, foes=it.side==='A'?actB:actA;
        const bench=it.side==='A'?benchA:benchB, sf=it.side==='A'?sfA:sfB;
        const idx=own.indexOf(m);
        /* A PIVOT IS ALSO A CHOICE. U-turn is not 'leave' -- it is 'leave and bring THIS in', and
           the whole reason the move is played is the body that arrives. `a.pivotTo` carries it when
           the caller picked one; without it the first healthy bench mon comes in as before. */
        if(idx>=0)switchOut(own,idx,bench,foes,sf,field,a.pivotTo);
      }
      /* WIRE 40 -- DRAGON TAIL AND CIRCLE THROW, the DAMAGING half of forcesSwitch. They carry base
         power, so they arrived here as ordinary attacks and the drag -- which is the entire reason a
         phazing move is played -- simply did not happen. AFTER the damage, like the pivot above, and
         through the same one switch path. A target that fainted to the hit is not dragged. */
      {
        const _fs=TAGS.param('move',a.move.id,'forcesSwitch');
        if(_fs&&_fs.forceSwitch){
          const _own=it.side==='A'?actA:actB, _foes=it.side==='A'?actB:actA;
          const _fb=it.side==='A'?benchB:benchA, _fsf=it.side==='A'?sfB:sfA;
          for(const tg of targets){
            if(!tg||tg.fainted||tg.curHP<=0)continue;
            const _i=_foes.indexOf(tg); if(_i<0)continue;
            /* WIRE 102 -- the drag target is a DIE here too, same as the phaze branch. */
            const _lb=_live(_fb);
            if(TR)TR.drag=true;
            switchOut(_foes,_i,_fb,_own,_fsf,field,_lb.length?_lb[Math.floor(rng()*_lb.length)]:null);
            if(TR)TR.drag=false;
          }
        }
      }
      /* WIRE 46 -- EXPLOSION FAINTS ITS USER, and it did not: the user walked away on full HP, so a
         move whose entire cost is your own Pokemon was priced as a free spread nuke. `faints:'always'`
         is Explosion, Self-Destruct and Misty Explosion; `faints:'ifHit'` is Final Gambit, Memento and
         Healing Wish, which only pay if the move connected. The split is the artifact's.
         Placed AFTER recoil, drain and Life Orb so the whole turn resolves off a living body first --
         a Final Gambit that drains would otherwise heal a corpse. */
      {
        const _uf=TAGS.param('move',a.move.id,'userFaints');
        if(_uf&&_uf.faints&&(_uf.faints==='always'||dealt>0)&&!m.fainted){m.curHP=0;m.fainted=true;
          if(TR){TR.dmg(m);TR.faint(m);}}
      }
      /* WIRE 43 -- ARM THE RECHARGE. Set only when the move actually resolved (a blocked or missed
         Hyper Beam still recharges in the real game, but this line sits after every `continue` that
         means "the move did not happen at all", which is the conservative half). */
      if(!m.fainted&&TAGS.has('move',a.move.id,'recharge')){m._recharge=true;if(TR)TR.recharge(m);}
      /* WIRE 44 -- ARM THE LOCKOUT. `lockoutTurns + 1` for the end-of-turn tick that fires on this
         turn too, the same convention Encore, Heal Block and Yawn already use. */
      {
        const _c2=TAGS.param('move',a.move.id,'cantUseTwice');
        if(_c2&&!m.fainted){m._noRepeat=a.move.id;m._noRepeatT=(+_c2.lockoutTurns||1)+1;}
      }
      /* WIRE 54's PROTEAN BLOCK USED TO SIT HERE, below every branch of the resolved move, and
         ROADMAP #81 WIRE 7 moved it up to the PrepareHit position -- see the block just under
         `_hadTargets`. The old comment called the placement "the wrong order by a hair"; it was worth
         the whole of the ability's offensive half. */
    }
    _updateAll();   // ROADMAP #81 WIRE 7 -- after the LAST action, the half the loop-top call cannot reach
    /* Flinch expires at the END of the turn it was applied. It used to be cleared only when the
     * flinched Pokemon tried to act, so a flinch landed by a SLOWER attacker (impossible to use this
     * turn) sat on the flag and stole the target's NEXT turn instead. Fake Out's +3 priority hid this
     * because it almost always moved first; adding Rock Slide's flinch would have made it common. */
    [...actA,...actB].forEach(m=>{if(m)m._flinch=false;});
    /* WIRE 74 -- THE FIELD CLOCKS TICK BEFORE THE RESIDUAL, NOT AFTER IT.
     *
     * They used to tick below the loop, so the sandstorm chipped on the turn it RAN OUT: a five-turn
     * Sandstorm dealt five ticks of 1/16 where the official engine deals four. The counters were never
     * wrong -- `weatherTurns` matched Showdown at every turn of every scripted game -- which is
     * precisely why nothing had caught it. What was wrong was the ORDER: Showdown clears the weather
     * at the top of its residual and the body it just stopped chipping is the receipt.
     *
     * FOUND BY THE ONE PAIR THE MATRIX HAD LEFT. After WIRE 72 and 73 the 156 multi-turn field cases
     * were down to a single divergence, `sandstorm + grassyterrain`, reading `.hurt medi=true
     * sd=false`. It is visible there and nowhere else because Grassy Terrain heals exactly the 1/16
     * the sand takes: the two cancel while both are up, so the ONLY HP left on the table at the end is
     * the extra tick, and one turn of 6% is invisible against any single mechanic. Two mechanics that
     * cancel is a sharper instrument than either alone, and no probe of one mechanic can build it.
     *
     * Moving the tick UP cannot change any counter a caller reads: every clock is still decremented
     * exactly once per turn and is read after the whole turn. It changes only what the residual loop
     * below sees, which is the thing that was wrong.
     *
     * WEATHER AND TERRAIN ARE NOT SYMMETRIC, AND THAT IS THE REFERENCE ENGINE'S OWN ASYMMETRY rather
     * than a fudge to make a test pass. Sandstorm's damage is a FIELD residual and Showdown decrements
     * the weather clock at that same residual slot, ends it, and skips the damage -- so the sand does
     * NOT chip on its last turn. Grassy Terrain's heal is a PER-POKEMON residual at order 5 while the
     * terrain's own expiry is a field residual much later, so the terrain DOES heal on its last turn.
     * Both halves were measured against the official engine before this line was written, and getting
     * one of them right hid the other: hoisting both clocks fixed `sandstorm + grassyterrain` and
     * immediately broke `grassyterrain + sandstorm`, which is the same pair with the moves swapped.
     * So the weather clock ticks ABOVE the loop and the terrain clock BELOW it. */
    /* ROADMAP #68 -- `|-weather|W|[upkeep]` is emitted for a sky that SURVIVES the tick; a sky that
     * expired emits `|-weather|none`. Both read off a real battle.log. `|upkeep|` itself is the LAST
     * line of the residual, emitted below, immediately before the faint replacements. */
    const _wx0=field.weather;
    if(field.weatherT>0&&--field.weatherT<=0)field.weather=null;
    if(TR){if(field.weather&&!field.wSup)TR.wx(field.weather,null,null,true);else if(_wx0&&!field.weather)TR.wxNone();}
    if(field.twA>0){if(--field.twA<=0&&TR)TR.sendSide('p1','Tailwind');}
    if(field.twB>0){if(--field.twB<=0&&TR)TR.sendSide('p2','Tailwind');}
    if(field.tr>0){if(--field.tr<=0&&TR)TR.fend('Trick Room');}
    /* WIRE 133 -- THE OTHER TWO ROOMS TICK BESIDE TRICK ROOM, for the reason the screens tick beside
     * the field timers: three clocks with one lifetime rule in one place cannot drift apart.
     * MAGIC ROOM GIVES THE ITEMS BACK ON THE TURN IT ENDS, and that restore is the half that would
     * rot silently -- a room that expires while the suppression stays applied is a body that never
     * holds an item again, and nothing in the state would say why. */
    if(field.wonderRoom>0){if(--field.wonderRoom<=0&&TR)TR.fend('Wonder Room');}
    if(field.magicRoom>0){
      if(--field.magicRoom<=0){if(TR)TR.fend('Magic Room');itemRoomSync(field,[...actA,...actB]);}
    }
    /* WIRE 133 -- AND THE SIDE BUFFS. `turns` is the condition's own duration out of the artifact, so
     * nothing here says "five"; the tick is the same shape the screens use one block down, and the
     * two are separate only because `screenIds` filters on the screen category. */
    for(const sf of [sfA,sfB]){if(sf&&sf.sc){
      for(const _id of Object.keys(sf.sc)){
        if(!(sf.sc[_id]>0))continue;
        const _sb=TAGS.param('move',_id,'sideBuff'); if(!_sb)continue;
        if(--sf.sc[_id]<=0){delete sf.sc[_id];
          if(TR)TR.sendSide(sf.side==='A'?'p1':'p2',_sb.startsAs||_id);}
      }}}
    /* Screens tick on the SIDE object, beside the field timers above so the two cannot drift. Each
     * named condition carries its own clock since ROADMAP #81 WIRE 8, so an expiring Aurora Veil
     * announces an Aurora Veil and a Reflect that outlives a Light Screen keeps halving.
     * DECLARED, not fixed: Showdown's side residual sub-orders are reflect 1, lightscreen 2,
     * tailwind 5, auroraveil 10, so a Tailwind expiring on the same turn as an Aurora Veil is
     * announced in the wrong order here -- the Tailwind clock is a FIELD counter ticked above and
     * splitting the two sides' residuals apart is a restructure, not a wire. */
    for(const sf of [sfA,sfB]){if(sf&&sf.sc){
      for(const _id of screenIds(sf)){
        if(--sf.sc[_id]<=0){delete sf.sc[_id]; if(TR)TR.sendSide(sf.side==='A'?'p1':'p2',_id);}
      }}}
    for(const m of [...actA,...actB]){if(!m||m.fainted||m.curHP<=0)continue;
      /* WIRE 55 -- THE STATUS BERRIES, FIRST IN THE RESIDUAL ORDER on purpose: Lum and its family
       * cure the MOMENT the status lands, so a body that was just burned must not also take the burn
       * chip this turn. WHICH status is the artifact's now -- the param used to be a bare
       * `{cures:true}` shared by six berries, five of which cure exactly ONE status, so a consumer
       * reading the boolean would have made a Cheri Berry cure a Will-O-Wisp. Lum alone carries the
       * explicit string 'any'. */
      berryCureUpdate(m);   // ROADMAP #81 WIRE 7 -- one implementation, shared with the after-action update
      /* WIRE 56 -- WHITE HERB. The block that stood here is now `restoreStatsUpdate()`, called from
       * three more places (ROADMAP #81 WIRE 11); this residual call is WIRE 56's own and is unchanged
       * in effect. */
      restoreStatsUpdate(m);
      /* WIRE 57 -- SPEED BOOST, 727 sheets. It raises Speed EVERY turn with no action spent, and it
       * compounds -- which is exactly the shape a rollout is blind to, because nothing recomputes a
       * speed order for a boost nobody clicked. WHICH stat comes from the artifact now: the param was
       * a bare `{perTurn:true}` shared with Moody (450 sheets, a RANDOM stat) and Opportunist (3, it
       * COPIES the foe), and a consumer reading the boolean would have given all three a Speed boost.
       * The derivation emits `boosts` only for a literal handler object, so the other two carry the
       * tag, get nothing, and are visibly unwired rather than silently wrong.
       * WIRE 138 -- SHOWDOWN'S `activeTurns` GATE, WHICH WAS LEFT OUT WITH A REASON AND THE REASON
       * WAS ANSWERABLE. The comment that stood here said the gate "is not expressible": `_turnsOut`
       * is incremented AFTER this block, so a lead on turn 1 and a body that pivoted in this turn
       * both read 0, and gating on it would have suppressed every turn-1 boost. That was correct
       * about `_turnsOut` and wrong about the engine — WIRE 135 had since added `_newlySwitched`,
       * set in `bringIn` and cleared at the ONE point that opens a turn, which answers exactly the
       * question `activeTurns` answers and distinguishes the two bodies `_turnsOut` cannot.
       *
       * Showdown: `onResidual(pokemon) { if (pokemon.activeTurns) this.boost({spe: 1}); }`
       * (data/abilities.ts:4447). `activeTurns` is set to 0 by EVERY switch-in (battle-actions.ts:137,
       * leads included) and incremented in `nextTurn` (battle.ts:1762), which runs after the leads —
       * so a lead reads 1 during turn 1 and boosts, and a body that walked in during turn T reads 0
       * at that turn's residual and boosts for the first time at the end of turn T+1. `!m._newlySwitched`
       * is that rule with the same two answers, taken from the same two moments.
       *
       * MEASURED ON THE BOARD, not argued: `tests/staged_board.js --only speedboost-entry-gate` had
       * Sharpedo at +1/+2/+3 against Showdown's 0/+1/+2 across three turns while the Espathra beside
       * it — same ability, same side, on the field from the leads — agreed on every board. It is the
       * largest single cause behind `active[].boosts.spe`, 99 games of the 1,530-game residue.
       * The suppression is COUNTED rather than silent, because a gate that stopped matching would
       * otherwise look exactly like an ability nobody brought. */
      {const _be=TAGS.param('ability',m.ability,'boostsEachTurn');
       if(_be&&_be.boosts&&m.boosts&&m._newlySwitched)MEDSEEN.perTurnBoostGatedOnEntry++;
       if(_be&&_be.boosts&&m.boosts&&!m._newlySwitched)for(const k in _be.boosts){
         const _s=SD2ENG[k];if(_s&&m.boosts[_s]!=null){const _b0=m.boosts[_s];
           m.boosts[_s]=clamp(m.boosts[_s]+_be.boosts[k],-6,6);
           if(TR)TR.bst(m,_s,m.boosts[_s]-_b0,'[from] ability: '+m.ability);}
       }}
      /* WIRE 133 -- MOODY, 605 uses and 249 sheets: the LARGEST tag in the census that had never had
       * a probe, let alone a consumer. It sits here beside Speed Boost because it is the same
       * residual slot and the same shape -- and the comment above records that the two used to share
       * a bare `{perTurn:true}` param, which is exactly why Moody has its own tag now.
       *
       * THE RULE IS SHOWDOWN'S, LINE FOR LINE (data/abilities.ts:2694), and every clause matters:
       *   - accuracy and evasion are EXCLUDED from both draws (the Gen 8+ change; the old ability
       *     could hand out +2 evasion, which is a different and much worse ability);
       *   - the +2 is drawn from stats that are not already at +6, the -1 from stats not at -6;
       *   - THE SECOND DRAW EXCLUDES THE FIRST, so the same stat is never raised and lowered;
       *   - both lists are built BEFORE either boost is applied, so a stat that the +2 pushes to the
       *     cap is still eligible for the -1 exactly as it is upstream.
       * Written directly rather than through applyStatDrop, matching the Speed Boost block above --
       * the alternative would route a raise through the drop path and the two would disagree about
       * Contrary the first time a Contrary body carried a per-turn boost. */
      {const _rb=TAGS.param('ability',m.ability,'randomBoostEachTurn');
       if(_rb&&_rb.randomStat&&m.boosts){
         const _ST=['at','df','sa','sd','sp'];
         const _pool=(f)=>_ST.filter(f);
         const _pick=(l)=>l.length?l[Math.min(l.length-1,Math.floor(rng()*l.length))]:null;
         const _up=+_rb.up||2,_dn=+_rb.down||1;
         const _plus=_pick(_pool(k=>m.boosts[k]<6));
         const _minus=_pick(_pool(k=>m.boosts[k]>-6&&k!==_plus));
         const _apply=(k,d)=>{if(!k)return;const _b0=m.boosts[k];m.boosts[k]=clamp(m.boosts[k]+d,-6,6);
           if(TR)TR.bst(m,k,m.boosts[k]-_b0,'[from] ability: '+m.ability);};
         _apply(_plus,_up); _apply(_minus,-_dn);
         if(_plus||_minus)MEDSEEN.moodyRolled++;
       }}
      /* WIRE 141 -- HUNGER SWITCH. THE FORME THAT FLIPS ON A CLOCK, WITH NO TRIGGER AT ALL.
       *
       * Morpeko alternates with Morpeko-Hangry at the END OF EVERY TURN, for the whole battle. This
       * engine had no consumer and `data/tags.json` read `["untagged"]` for the ability, so a Morpeko
       * that walked in on turn 1 stayed `morpeko` while the authority's slot AND party row read
       * `morpekohangry` from the end of that same turn. Ten games of the 1,530-game residue at
       * release 3dd96ca88574, and it was the LARGEST single `species` cause at turn 1.
       *
       * IT SITS HERE, ONE BLOCK BELOW SPEED BOOST AND MOODY, BECAUSE THAT IS THE AUTHORITY'S ORDER:
       * `onResidualOrder` is 28 for both of those and 29 for this. Read out of the dex rather than
       * chosen -- and the adjacency is why this block is written next to them rather than anywhere
       * else in the residual.
       *
       * IT IS A RENAME, AND ONLY BECAUSE THE ARTIFACT SAYS SO. `data/engine-data.js` has a `morpeko`
       * row and NO `morpeko-hangry` row, which is exactly the Mimikyu-Busted situation WIRE 136 met:
       * the tag carries `sameStats` and `sameTypes`, both TRUE here (58/95/58/70/58/97 and
       * Electric/Dark on each side), so nothing this engine models changes and the flip is a name. A
       * member with either flag false would need a real row and is REFUSED and counted rather than
       * renamed wrongly, which is the same call Ice Face gets.
       *
       * BOTH DIRECTIONS, FROM THE ARTIFACT'S OWN PAIR. `alternates` is `[Morpeko, Morpeko-Hangry]`
       * and the flip is "whichever of the two I am not" -- so a fix that transformed once would be
       * wrong from turn 2 onward, and the staged scenario reads three consecutive boundaries for
       * exactly that reason.
       *
       * THE SECOND GUARD IS UNREADABLE HERE AND IS SAID RATHER THAN SKIPPED. The handler also stops
       * flipping for a TERASTALLIZED body (`stopsWhenTerastallized` is in the tag). This engine models
       * no Terastallization at all, so there is no field to test; that is a declared gap, not a
       * check that was forgotten. */
      {const _fc=TAGS.param('ability',m.ability,'formeCycleResidual');
       if(_fc&&Array.isArray(_fc.alternates)&&_fc.alternates.length===2){
         const _keys=_fc.alternates.map(x=>pasteKey(x)||String(x).toLowerCase().replace(/[^a-z0-9]/g,'-'));
         const _at=_keys.indexOf(m.name);
         /* NOT ONE OF THE PAIR: a body carrying the ability through a Skill Swap or a Trace, which the
          * handler's own `baseSpecies !== 'Morpeko'` guard refuses. Silent by design -- there is
          * nothing to flip and nothing went wrong. */
         if(_at>=0){
           const _to=_keys[1-_at], _toName=_fc.alternates[1-_at];
           /* THE RENAME IS TRIED FIRST, AND THAT ORDER IS THE CARE IN THIS BLOCK RATHER THAN AN
            * OVERSIGHT. `formeSwap` REBUILDS the body from the mon table, which replaces whatever stat
            * line this body is carrying with the dataset's own -- correct for Palafin (two different
            * formes, two different stat lines) and CORRUPTING here, because a Morpeko flips every turn
            * and one row exists while the other does not. A body handed a flat level-50 line by a
            * harness would be silently re-spread on the flip back and every damage roll after it would
            * be wrong. When the artifact states the two formes are identical in everything modelled,
            * the flip IS a rename and rebuilding is the wrong operation even where a row exists. */
           if(_fc.sameStats&&_fc.sameTypes){
             m.name=_to;
             MEDSEEN.formeRenamedNoRow++;
             MEDSEEN.formeCycled++;
             if(TR)TR.detailschange(m);
           } else if(monRow(_to)){
             formeSwap(m,_toName,'formeCycleResidual');
             MEDSEEN.formeCycled++;
           } else {
             MEDFAILS.formeCycleNoRow++;
             if(!MEDFAILS.formeCycleNoRowFirst)MEDFAILS.formeCycleNoRowFirst=m.ability+' -> '+_toName;
           }
         }
       }}
      /* WIRE 31 -- THE SANDSTORM RESIDUAL, WHICH THIS ENGINE DID NOT HAVE AT ALL.
       *
       * FOUND BY CONVERTING A HOLLOW CENSUS PROBE. `weatherChipImmune` read LIVE because the string
       * `magmaarmor` appears in this file -- once, in the FREEZE-immunity table at :1097, which has
       * nothing to do with weather. So the census carried an immunity as working while the damage it
       * is immune to did not exist: burn, poison, Toxic and Leech Seed all ticked here and sand did
       * not. Sand Stream is 1,705 sheets and the store holds 6,167 sandstorm events.
       *
       * FIRST IN THE RESIDUAL ORDER, which is the real one: weather, then the passive heals, then the
       * seed, then the status chips. It only shows at the margin of a faint, and the margin of a faint
       * is exactly what a rollout is counting.
       *
       * SAND ONLY. Snowscape replaced Hail in this generation and deals NO residual damage, so this
       * is gated on 'sand' rather than on "there is a weather" -- an engine that chipped in snow would
       * be a new wrong number rather than a wired mechanic, and the probe asserts snow costs nothing.
       *
       * THE 1/16 AND THE THREE TYPES ARE STATED HERE, WITH THE REASON. No artifact this engine reads
       * carries either: `weatherSetter` names the weather and stops. They are constants of the format
       * in the same class as DOUBLES_SCREEN, so they are written down rather than faked out of a tag.
       * The ABILITY side is NOT written down -- it comes from `weatherChipImmune.weathers`, which the
       * derivation now reads out of each handler, so Overcoat refusing both and Sand Veil refusing
       * only sand falls out of the artifact.
       *
       * MAGIC GUARD IS DELIBERATELY NOT EXEMPTED, AND IT IS COUNTED RATHER THAN SILENT. It blocks all
       * indirect damage through `onDamage`, not `onImmunity`, so it carries `untagged` in
       * data/tags.json (79 uses) and this tag cannot see it. Exempting it HERE by name would do two
       * bad things at once: type a membership list the artifact is supposed to derive, and leave the
       * ability HALF-right -- burn, poison, Toxic and Leech Seed above already chip a Magic Guard body
       * and would keep doing so. One policy, and the gap is counted in fails.magicGuardChip. */
      if(field.weather==='sand'&&!field.wSup&&!m.types.some(t=>t==='Rock'||t==='Ground'||t==='Steel')){
        const _wc=TAGS.param('ability',m.ability,'weatherChipImmune');
        const _im=!!(_wc&&Array.isArray(_wc.weathers)&&_wc.weathers.includes('sand'));
        if(!_im){
          if(String(m.ability||'').replace(/[^a-z0-9]/g,'')==='magicguard')MEDFAILS.magicGuardChip++;
          m.curHP-=Math.floor(m.st.hp/16);
          if(TR)TR.dmg(m,'[from] Sandstorm');
        }
      }
      /* WIRE 73 -- GRASSY TERRAIN HEALS. WIRE 72 made the terrain exist; this is the half that made
       * the terrain WORTH setting, and the two had to land together or the engine would have gained a
       * field it models wrongly instead of one it does not model at all.
       *
       * The matrix found it as the residue of WIRE 72: `sandstorm + grassyterrain` in either order was
       * the ONLY pair left parting, reading `.hurt medi=true sd=false` on two bodies. Grassy Terrain
       * heals 1/16 a turn and sandstorm chips 1/16 a turn, so the reference engine's net is exactly
       * zero and medicham2 was chipping. Two mechanics that cancel is the sharpest possible test of
       * either, and no single-mechanic probe can produce it.
       *
       * THE FRACTION COMES OUT OF THE TERRAIN MOVE'S OWN TAG, not from a number typed here: the tag on
       * `grassyterrain` is `perTurnHP {effect:'heal', per:16, on:'user'}`, and WIRE 72's guard is what
       * left it readable. The terrain is matched by `terrainId`, so either vocabulary works.
       *
       * GROUNDED-NESS: WIRE 117 CLOSED THIS. The old code applied the TYPE half only and counted its
       * own known-wrong ability half in `fails.terrainHealUngrounded` -- a probe never failed on it,
       * so the counter kept it declared, which is exactly how a gap survives a fix that was already
       * available. It now asks the shared `isGrounded`, the same predicate the hazards, the switch
       * branch and Psychic Terrain's priority bar ask, and the failure counter is replaced by
       * MEDSEEN.terrainHealSkippedAirborne so the event is still countable. */
      {const _th=terrainPerTurnHP()[terrainId(field.terrain)];
       if(_th&&_th.effect==='heal'&&_th.per&&!healBlocked(m)){
         if(isGrounded(m)){const _h0=m.curHP;m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp/_th.per));
           if(TR&&m.curHP>_h0)TR.heal(m,'[from] Grassy Terrain');}
         else MEDSEEN.terrainHealSkippedAirborne++;
       }}
      if(m.status==='brn'){m.curHP-=Math.floor(m.st.hp/16);if(TR)TR.dmg(m,'[from] brn');}
      if(m.status==='psn'){m.curHP-=Math.floor(m.st.hp/8);if(TR)TR.dmg(m,'[from] psn');}   // regular poison: a flat 1/8
      if(m.status==='tox'){m.toxTurns=(m.toxTurns||0)+1;                        // Toxic: n/16, escalating
        m.curHP-=Math.floor(m.st.hp*Math.min(15,m.toxTurns)/16);if(TR)TR.dmg(m,'[from] psn');}
      /* WIRE 29 -- passiveHeal, from the item's own tag instead of a Leftovers name check. The tag
       * carries the fraction (0.0625 = 1/16) and the name check carried the same number typed out, so
       * this is a no-op today and the point is next month: a second passive-heal item joins by
       * EXISTING rather than by someone remembering to add a name here. docs/TAGS.md invariant 3. */
      {const _ph=TAGS.param('item',m.item,'passiveHeal');
       if(_ph&&_ph.heal&&!healBlocked(m)){const _h0=m.curHP;
         m.curHP=Math.min(m.st.hp,m.curHP+Math.floor(m.st.hp*_ph.heal));
         if(TR&&m.curHP>_h0)TR.heal(m,'[from] item: '+m.item);}}
      /* WIRE 14 -- healsAtThreshold, from the artifact instead of a Sitrus name check. The tag
       * carries the threshold AND the restore as the handler states them ('1/2' -> '1/4'), so a
       * future pinch berry joins by existing rather than by someone remembering.
       * *(This said "Oran restores a FLAT 10 HP ... its param is honestly null and it stays unwired
       * (0 uses)". True when written, and CLOSED 2026-08-10: `restoresFlat` is derived beside
       * `restores`, so a flat heal arms the berry too. A documented gap is still a gap — the roster
       * read Oran DID-NOT-FIRE regardless of how honestly the comment described it.)* */
      /* Under Heal Block the berry is not eaten AT ALL — it is still there afterwards — so the gate
       * wraps the whole block rather than only the HP line. */
      /* WIRE 58 -- UNNERVE, 1,949 sheets. It stops the OTHER SIDE eating a berry at all -- the berry
       * is not consumed and is still there afterwards, which is why the gate wraps the whole block
       * rather than only the HP line, exactly as Heal Block's does. The side is found by identity
       * because this residual loop walks both sides in one pass. */
      berryPinchUpdate(m,(actA.indexOf(m)>=0?actB:actA));   // ROADMAP #81 WIRE 7 -- one implementation
      /* WIRE 8 -- the drain lands here, with the residuals. The amount divides the VICTIM's max HP
       * (seeding a tank returns more than seeding a pixie -- that is the tag's per, not a constant)
       * and the same number is handed to the seeder, capped at full. If the seeder is down the chip
       * continues and the heal is simply lost -- close to the real slot rule without slot state. */
      /* WIRE 51 -- THE TRAP CHIPS. Beside Leech Seed because it is the same kind of clock, and after
       * the status chips for the same residual-order reason. */
      if(m._trap&&m.curHP>0){
        /* WIRE 105 -- the trap DIES WITH ITS TRAPPER. A source that fainted or left the field ends
         * the trap before this tick chips, which is Showdown's own onUpdate rule. A trap whose
         * source is unknown (set by a caller outside the battle loop) keeps the old behaviour. */
        const _by=m._trap.by;
        if(_by&&(_by.fainted||_by.curHP<=0||(actA.indexOf(_by)<0&&actB.indexOf(_by)<0))){m._trap=null;}
        else{
          m.curHP-=Math.floor(m.st.hp*m._trap.frac);
          if(TR)TR.dmg(m,'[from] partiallytrapped');
          if(--m._trap.turns<=0){m._trap=null;if(TR)TR.vend(m,'partiallytrapped');}
          if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);}
        }
      }
      if(m._seededBy&&m.curHP>0){
        /* Heal what was TAKEN, not the formula amount: the killing tick drains only the HP the
         * victim still had, and handing the seeder more than that would mint HP from nothing. */
        const _d=Math.min(Math.floor(m.st.hp/m._seededBy.per),m.curHP);
        m.curHP-=_d;
        if(TR)TR.dmg(m,'[from] Leech Seed');
        const _s=m._seededBy.by;
        /* The seed keeps CHIPPING under Heal Block and only the seeder's return is stopped, which is
         * the same split as the drain: the damage is not healing. */
        if(_s&&!_s.fainted&&_s.curHP>0&&!healBlocked(_s)){const _h0=_s.curHP;
          _s.curHP=Math.min(_s.st.hp,_s.curHP+_d);
          if(TR&&_s.curHP>_h0)TR.heal(_s,'[from] Leech Seed',m);}
      }
      /* ROADMAP #81 WIRE 12 -- THE CURSE CHIP, and it is the half that PAYS the price the branch
         above charges. `perTurnHP {effect:'damage', on:'target'}` has been in the artifact all along
         with nothing reading it; the volatile is set only by the typed branch of `typeSplitMove`, so
         the chip and the half-HP cost cannot come apart.
         `this.damage(pokemon.baseMaxhp / 4)` truncs, so a 183 HP Garchomp loses 45 and not 46 --
         confirmed in a staged authority game (167 -> 122).
         SALT CURE CARRIES THE SAME TAG AND IS NOT SET ANYWHERE, which is stated rather than left to
         be discovered: it is a DAMAGING move, so its volatile would have to be applied on the attack
         path, and that is a different site. It stays visibly unwired. */
      if(m._ptDmg&&m.curHP>0){
        m.curHP-=Math.max(1,Math.trunc(m.st.hp/m._ptDmg.per));
        if(TR)TR.dmg(m,'[from] Curse');
        MEDSEEN.perTurnDamageChip++;
      }
      if(m.curHP<=0){m.curHP=0;m.fainted=true;if(TR)TR.faint(m);}}
    /* The TERRAIN clock ticks here, below the residual, and the weather clock above it — see WIRE 74
       for the measurement that says the two are not symmetric in the official engine. */
    if(field.terrainT>0){const _t0=field.terrain;if(--field.terrainT<=0){field.terrain='';if(TR)TR.terrainEnd(_t0);}}
    /* PERISH and YAWN tick here, with the field timers, so every clock in this engine advances in one
       place. Perish faints at zero -- that is the move. Yawn sleeps at zero, and only if the target is
       still statusless, because anything that landed in between takes precedence. */
    for(const x of [...actA,...actB]){
      if(!x||x.fainted)continue;
      /* ROADMAP #81 WIRE 12 -- the tick is unchanged and the number it ticks FROM is not (see the
         `kind==='perish'` branch). The KO at zero is the whole move and nothing in this repo had ever
         asserted that it happens, so it is counted separately from the tick: `perishTicked` at zero
         means no clock ever ran, `perishKO` at zero with `perishTicked` non-zero means the clock ran
         and nothing ever died at the end of it. Both are in tests/test-wiring.js. */
      if(x._perish!=null){x._perish--;MEDSEEN.perishTicked++;if(TR)TR.vstart(x,'perish'+x._perish);
        if(x._perish<=0){x.fainted=true;x.curHP=0;MEDSEEN.perishKO++;if(TR){TR.dmg(x);TR.faint(x);}}}
      if(x._yawn!=null){x._yawn--;if(x._yawn<=0){x._yawn=null;if(TR)TR.vend(x,'move: Yawn');if(!x.status)applyStatus(x,'slp');}}
      /* Heal Block ticks with the other clocks. It is applied as `turns + 1` because this tick fires
       * on the application turn too — the same convention as Encore's lock two blocks down. */
      if(x._healBlock>0)x._healBlock--;
      /* WIRE 45 / WIRE 44 -- the Throat Chop silence and the Gigaton Hammer lockout tick here with
         every other clock in this engine, for the reason the Disable comment gives: a duration that
         only counts down on turns the engine happens to be CHOOSING lasts forever in a rollout driven
         from outside. */
      if(x._noSound>0)x._noSound--;
      if(x._noRepeatT>0&&--x._noRepeatT<=0)x._noRepeat=null;
    }
    /* WIRE 82 -- the shield lasts exactly the turn it was raised (Showdown's volatile has
     * duration 1). Cleared for BOTH sides here rather than in the attack branch, because a holder
     * that was flinched, paralysed or KO'd never reached its own action. */
    [...actA,...actB].forEach(m=>{if(m)m._preTurn=null;});
    /* ROADMAP #84 -- THIS TURN'S MOVE RESULT BECOMES LAST TURN'S, FOR EVERY BODY STILL ON THE FIELD.
     *
     * Showdown does exactly this in `nextTurn` (sim/battle.ts:1671): `moveLastTurnResult =
     * moveThisTurnResult; moveThisTurnResult = undefined`, over `getAllActive()`. Placed at the end
     * of THIS turn rather than the start of the next one because battleTurn is the only turn
     * boundary this engine has, and a caller can stop between two of them -- rolling forward at the
     * start would leave the value unrolled for anything that read it in between.
     *
     * BEFORE refill(), so a body that walks in to replace a faint arrives with both fields undefined
     * (bringIn clears them, exactly as Showdown's clearVolatile does) rather than inheriting the
     * corpse's last turn. */
    [...actA,...actB].forEach(m=>{if(m){m._mvResLast=m._mvRes;m._mvRes=undefined;}});
    [...actA,...actB].forEach(m=>{if(m&&!m.fainted)m._turnsOut++;if(m&&m._lockT!==Infinity&&m._lockT>0&&--m._lockT<=0)m._lock=null;
      /* WIRE 140 -- the Ally Switch volatile has `duration: 2`, so a turn where it is NOT clicked
       * lets it lapse and the next click starts fresh at 1/1. Ticked here with the other durations
       * rather than at the branch, for the reason the Disable comment below gives: a clock that only
       * moves when the engine happens to be choosing is a clock that never runs out in a rollout. */
      if(m&&m._aswDur>0&&--m._aswDur<=0)m._aswCount=0;
      /* ROADMAP #111 -- ONE TICK FOR THE WHOLE DURATION FAMILY, and it replaces three separate lines
       * that each ticked one member (Disable here, Taunt through the forbid table beside it, Encore
       * two thousand lines up inside `_chooseAction`). Three sites is how the same defect came back
       * three times after Perish Song was fixed once.
       *
       * It ticks HERE and not in chooseAction so a turn where the CALLER supplied the action still
       * spends one -- a duration that only counts down when the engine happens to be the one choosing
       * is a duration that lasts forever in a rollout driven from outside (the WIRE 24 rule).
       *
       * The set is `durationVolatiles()`, read out of the artifact, so a fourth sealer arriving in a
       * later regulation is ticked without an edit here. A FAINTED holder is skipped, which is
       * `residualEvent`'s own first line (`if (handler.effectHolder.fainted) continue`). */
      if(m&&m._vol&&!m.fainted)for(const _dv of durationVolatiles().keys()){
        if(!(m._vol[_dv]>0))continue;
        MEDSEEN.volDurationTicked++;
        if(--m._vol[_dv]<=0){MEDSEEN.volDurationExpired++;endDurationVolatile(m,_dv);}
      }});
    /* THE DEATH COUNTERS update at turn end, before replacements enter: the live side count for
     * Last Respects (a mid-turn kill is seen one action late — an approximation, stated), and the
     * entrant's frozen snapshot for Supreme Overlord. Derived from the actual fainted flags every
     * turn — no hand-maintained tally to drift. */
    sfA.fainted=fallenCount(sfA,actA,benchA);
    sfB.fainted=fallenCount(sfB,actB,benchB);
    /* ONE SWITCH-IN PATH. Will's point: voluntary switching is not new machinery, it is the body
       refill() already had -- take the mon off the bench, reset its turn counter, stamp the fallen
       count, apply entry effects and Intimidate. Extracted to bringIn() at module scope so a faint
       replacement and a U-turn bring a Pokemon in through exactly the same code; two copies is how
       the voluntary path would quietly skip Intimidate. */
    /* THE POST-KO REPLACEMENT IS A DECISION TOO, and it was a coin flip: whoever happened to be first
       on the bench walked into whatever just got a kill. In doubles that is frequently the whole game.
       S.replaceWith lets a caller name the replacement per side; absent, the old behaviour stands. */
    const refill=(act,bench,foes,sf,side)=>{
      for(let i=0;i<act.length;i++){
        if(!act[i]||!act[i].fainted)continue;
        const want=S.replaceWith&&S.replaceWith[side];
        const nx=bringIn(act,i,bench,foes,sf,field,want);
        /* Consumed once. A standing preference would silently apply to every later faint in the game,
           which is a different and much stronger claim than the caller made. */
        if(nx&&want&&nx===want&&S.replaceWith)S.replaceWith[side]=null;
      }
    };
    /* `|upkeep|` CLOSES the residual and the faint replacements follow it -- Showdown's own order,
     * where the switch request resolves between `|upkeep|` and the next `|turn|`. */
    if(TR)TR.upkeep();
    refill(actA,benchA,actB,sfA,'A');refill(actB,benchB,actA,sfB,'B');
  }
  S.turn++;
  traceRelease(_trPrev);
  return S;
}
/* winner readout, shared by the sealed rollout and the Tower's end screen:
 * 1 = side A, 0 = side B, 0.5 = dead-even HP tie at the 20-turn horizon */
function battleResult(S){
  const aA=_live(S.actA).length+_live(S.benchA).length,bA=_live(S.actB).length+_live(S.benchB).length;
  if(aA!==bA)return aA>bA?1:0;
  const hp=(a,b)=>[...a,...b].reduce((s,m)=>s+(m?Math.max(0,m.curHP)/m.st.hp:0),0);
  const ha=hp(S.actA,S.benchA),hb=hp(S.actB,S.benchB);return ha>hb?1:(ha<hb?0:0.5);
}
function battle(teamA,teamB,ov,rng){ rng=rng||Math.random;
  const S=battleInit(teamA,teamB);
  while(!battleOver(S))battleTurn(S,rng);
  return battleResult(S);
}
/* Build ONE turn action from a player's click, in exactly the shape chooseAction emits — the page
 * must never hand-roll these, or the Tower and the rollout would resolve moves differently.
 * Unmodelled status clicks return kind 'pass' (a no-op turn): honest, and the Tower says so in
 * the log rather than pretending the engine played a move it cannot represent. */
function playerAction(me,moveId,target,field){
  const id=String(moveId||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  /* ROADMAP #81 WIRE 6 -- EVERY ACTION CARRIES THE MOVE THAT MADE IT. These four used to return a
   * BARE kind, and `actionMoveId` patched three of them back from a hand-written map (KIND_MOVE) that
   * did not have a Trick Room row -- so the one action kind nobody had listed announced nothing. The
   * id belongs on the action, at the one place that knows it, and the map stays only as the backstop
   * for a bare action a CALLER built. */
  if(PROTECTMOVES.has(id))return {kind:'protect',mv:id};   // mv, so WIRE 61 knows which shield blocked
  if(id==='wideguard')return {kind:'wideguard',mv:id};
  if(id==='tailwind')return {kind:'tail',mv:id};
  if(id==='trickroom')return {kind:'trickroom',mv:id};
  const mv=MC.moves[id];
  /* ROADMAP #81 WIRE 9 -- A SPREAD MOVE NAMES NO TARGET, AND THAT USED TO MAKE IT A NO-OP TURN.
   *
   * This branch was gated on `target` being non-null, because `dmgRange(me, target, ...)` needs a
   * defender to price the click. A move whose Showdown target type is `allAdjacentFoes` or
   * `allAdjacent` carries NO target field on the request at all -- there is nothing to aim, so any
   * driver that asks the authority what is legal correctly hands this engine a null. The click then
   * fell through the entire status chain below and came out as `{kind:'affect'}` (Heat Wave, Rock
   * Slide, Snarl -- anything with a secondary, emitting a bare `|-fail|`) or `{kind:'pass'}`
   * (Earthquake, Dazzling Gleam, Make It Rain -- emitting nothing).
   *
   * 33 legal moves and 56,524 corpus uses -- 20% of every damaging click in this format -- dealing
   * ZERO. It reached the release ladder as its largest surviving cause (`|-miss|ATT|TGT <> |-fail|ATT`,
   * 114 games) and was read there as an announcement defect; it is a state defect, and the `-fail`
   * was only the visible residue of it.
   *
   * THE TURN LOOP NEVER NEEDED THE TARGET. It resolves `targets = a.move.spread ? live(foes) : [aim]`,
   * so the aim is discarded for exactly this family. What is priced here is `d` and `acc`, which are
   * VALUATION fields -- so the body picked is the one the move hits hardest, matching what
   * targetForMove() already does for the Choice lock, and the hit site recomputes dmgRange per target
   * regardless.
   *
   * A SINGLE-TARGET MOVE WITH NO TARGET IS STILL REFUSED, and loudly. Showdown rejects that choice
   * (`Can't move: You can't choose a target for Shadow Ball`), so aiming it here would invent a
   * decision nobody made -- the same reason `randomNormal` (Outrage, 68 uses) and `scripted`
   * (Mirror Coat, 26) are counted rather than aimed: Showdown picks those with a die this engine
   * would have to guess the shape of. */
  if(mv&&hasPower(mv)&&!target&&SPREAD.has(id)){
    const _fo=liveFoesOf(me);
    if(_fo.length){
      let _t=null,_bs=-1;
      for(const _f of _fo){const _d=dmgRange(me,_f,mv,field,true);
        const _s=(_d.min>=_f.curHP?1e6:0)+_d.max; if(_s>_bs){_bs=_s;_t=_f;}}
      if(_t){MEDSEEN.spreadClickWithoutNamedTarget++;target=_t;}
    }
  }
  /* WIRE 133 -- POLLEN PUFF IS TWO MOVES AND THE TARGET DECIDES WHICH, so the branch is taken HERE,
   * above the attack branch, because the move carries 90 base power and would otherwise be classified
   * as an attack whichever body it was aimed at. tag_dex's own comment on `dualPurpose` says it: "a
   * tag belongs to a (move, target) pair, not to a move".
   *
   * 126 corpus uses, and until now an ally-aimed Pollen Puff DEALT 90 BASE POWER OF BUG DAMAGE TO ITS
   * OWN PARTNER -- strictly worse than clicking nothing, which is the one-directional error WIRE 30
   * was landed to avoid.
   *
   * THE ALLY TEST IS THE SHARED SIDE OBJECT. `_sf` is handed to every member of a team by reference in
   * battleInit, so two bodies on one side are the same object and nothing has to know about slots.
   * A caller that has not been through battleInit has no `_sf`, and then this branch declines rather
   * than guessing -- the click falls through to the attack path exactly as it did before. */
  {
    const _dp=TAGS.param('move',id,'dualPurpose');
    if(_dp&&_dp.allyHealFrac&&target&&target!==me&&me._sf&&target._sf===me._sf)
      return {kind:'allyheal',mv:id,target,frac:+_dp.allyHealFrac,noDamage:!!_dp.allyNoDamage};
  }
  if(mv&&hasPower(mv)&&target){
    const spread=SPREAD.has(id);
    /* WIRE 131 — `acc` is the chance THIS click lands on THIS target, not the move's printed number.
     * Both bodies are in hand here and the old line used neither. */
    return {kind:'attack',move:{id,mv,spread,d:dmgRange(me,target,mv,field,spread),acc:hitProb(me,target,id,field)},target};
  }
  /* ROADMAP #81 WIRE 9 -- AND A DAMAGING CLICK THAT COULD NOT BE AIMED IS COUNTED, NEVER SWALLOWED.
   * Falling through to the status chain below is what made the defect above invisible for as long as
   * it existed: the click resolved to a legal-looking action kind and did nothing. A zero here is a
   * claim about the callers, not a pass. */
  if(mv&&hasPower(mv)&&!target){
    MEDFAILS.damagingClickWithoutTarget++;
    if(!MEDFAILS.damagingClickWithoutTargetFirst)MEDFAILS.damagingClickWithoutTargetFirst=id
      +(liveFoesOf(me).length?' (foes in hand; not a spread move)':' (no board reachable from this body)');
  }
  const fx=moveFx(id);
  /* HEAL, from the rulebook's own `heal` fraction rather than a list of move names — so Roost,
   * Recover, Life Dew, Soft-Boiled and every other restore arrive together and a new one needs no
   * code. `target` decides who gets it: 'self' is the user, 'allies' is the whole side (Life Dew).
   * Checked before the status branch because nothing here carries a major status. */
  /* CLASSIFIED BY THE TAG, and only when the tag carries a NUMBER. A `heal: true` member (Rest,
   * Synthesis, Wish, Strength Sap) must NOT be captured here: Rest's real click is the sleep and
   * Strength Sap's is the Attack drop, and classifying them as a heal this engine cannot size would
   * turn a partly-modelled move into a fully no-op turn. They fall through to the branches that do
   * model their other half, and healParam counts them in MEDFAILS.healProcedural. */
  /* ROADMAP #102 -- AND THE ONE MEMBER THAT MUST NOT BE CLAIMED HERE. `fromTargetStat` is Strength
   * Sap, whose OTHER half (the target's Attack drop) is already modelled by the `affect` branch far
   * below. Letting it become a `heal` would trade one missing half for the other -- and the Attack
   * drop is the half that decides where the move is played (WIRE 79). Its heal is landed inside that
   * branch instead, where the target is in hand. The test is on the recipe, not on the move id. */
  {const _h0=healParam(id); if(_h0&&!_h0.fromTargetStat)return {kind:'heal',mv:id};}
  /* REDIRECTION, FROM THE `redirects` TAG. Will was right that these were already tagged and the
   * first version of this line was not: it named ragepowder and followme by their volatile, having
   * looked for the tag under ABRA_TAGS.move — the artifact spells it `moves`, so the search came back
   * empty and "there is no tag" got written into a comment. Asking the tag instead means any other
   * redirect move in the set arrives without another edit here, which is the whole point of the tags.
   *
   * 1.78% of real clicks, and the most positional mechanic in doubles: it is how a Fake Out or a
   * Sucker Punch ends up eaten by the wrong body. */
  /* WIRE 140 -- ALLY SWITCH, 202 uses, and it resolved to `{kind:'pass'}` -- a wasted turn -- while
   * the real move swaps two bodies between slots. Tag first (`swapsSlots`, derived by tag_dex.js from
   * a handler that calls `swapPosition`; membership over the whole move table is exactly one move,
   * printed before this line was written), name second as the pre-regeneration bridge. */
  if(TAGS.has('move',id,'swapsSlots')||String(id).replace(/[^a-z0-9]/g,'')==='allyswitch')
    return {kind:'slotswap',mv:id};
  if(TAGS.has('move',id,'redirects'))return {kind:'redirect',mv:id};
  /* SCREENS, from the `halvesDamage` tag, which carries both the multiplier and WHICH category it
   * applies to — Light Screen Special, Reflect Physical, Aurora Veil both. One branch, three moves,
   * and a fourth arrives free. 1.69% of real clicks. */
  if(TAGS.has('move',id,'halvesDamage'))return {kind:'screen',mv:id};
  /* PARTING SHOT and other STATUS pivots: no damage, the user leaves. 2.12% of real clicks and the
     single largest unmodelled move in the corpus.
     WHAT IS NOT DONE, said here rather than discovered: Parting Shot also drops the target's Attack
     and Special Attack by one. That is `statChangeInCode` -- procedural in the handler -- and NO
     artifact this engine reads carries the numbers (the lowersTarget param says "via onHit", and
     MOVE_EFFECTS has no boosts for it). So the switch is modelled and the drop is not. That is a
     known half, and it is the half that decides where the move is played. */
  if(TAGS.has('move',id,'pivotStatus'))return {kind:'switch',mv:id,target};
  /* ROADMAP #81 WIRE 12 -- BATON PASS AND SHED TAIL, WHICH NEVER SWITCHED AND HAD NO BRANCH AT ALL.
   *
   * `passesState` has existed in the artifact since the pivot family was split three ways and read
   * `used: false, uses: 0` the whole time: nothing anywhere in this engine consumed it. Measured
   * before a line changed -- `playerAction` classified Baton Pass as `pass` (a NO-OP TURN, 148 corpus
   * uses spent doing nothing) and Shed Tail as `affect`, which paid half its user's HP, built the
   * doll and LEFT THE USER STANDING THERE. That is strictly worse than clicking nothing.
   *
   * THE DIAGNOSIS THAT REACHED ME WAS WRONG AND THE ARTIFACT IS WHAT CORRECTED IT. It said the
   * tagger tested `selfSwitch === true` and so missed the two string-valued moves. It does not:
   * `pivotStatus`'s derivation reads `m.selfSwitch &&` -- truthiness -- and then DELIBERATELY excludes
   * these two, because they belong to `passesState`. Measured: both carry `passesState` in
   * data/tags.json today with `passes: true`. The tagger was right; there was simply no consumer.
   *
   * IT MUST SIT ABOVE THE `costsUserHP` BRANCH BELOW, which would otherwise claim Shed Tail as a
   * plain Substitute, and above the fallthrough that made Baton Pass a pass. */
  if(TAGS.has('move',id,'passesState'))return {kind:'passstate',mv:id,target};
  /* WEATHER, from the rulebook's own `weather` field. SD2WEATHER already maps Showdown's names onto
     this engine's ('RainDance' -> 'rain'), and it is reused rather than restated so a weather setter
     and the ability that sets the same weather cannot disagree. Rain and sun are the two largest
     archetypes in the format, and until now clicking Rain Dance was a no-op turn. */
  /* HELPING HAND. The rulebook names the volatile and the +5 priority, and movePriority reads the
     priority, so the only thing written here is the multiplier -- x1.5, which no artifact this engine
     reads carries. Same call as DOUBLES_SCREEN above: state the constant and say why it is stated. */
  if(fx&&fx.volatile==='helpinghand')return {kind:'helpinghand',mv:id};
  /* BOOSTS ON AN ALLY. All six boostsTarget moves carry an explicit table -- Coaching {atk:1,def:1},
     Decorate {atk:2,spa:2}, Howl, Aromatic Mist, Flatter, Swagger -- so the stages come from the
     artifact and nothing is guessed. Contrast lowersTarget, which says readFrom:"m.boosts" and is
     therefore NOT implementable from anything this engine can read. */
  /* WIRE 106 -- the TARGET travels with the click. Decorate can legally be aimed at a FOE (+2/+2 to
     it -- Showdown applies it), and dropping the caller's target here re-aimed every such click at
     the ally: three interaction-matrix rows read `.A.active[1].boosts.atk medi=2 sd=0` at once. */
  if(TAGS.has('move',id,'boostsTarget'))return {kind:'boostally',mv:id,target};
  /* LEECH SEED and the rest of the perTurnHP family. The RESOLUTION for this already existed -- the
     status branch reads the tag, checks the Grass immunity from the move's own onTryImmunity and sets
     _seededBy -- and playerAction simply never produced an action that could reach it, so the click
     was a no-op turn. Routing it through the status path is the whole fix. */
  /* WIRE 72 -- GRASSY TERRAIN WAS CLAIMED BY THIS BRANCH AND NEVER SET A TERRAIN. Found by the
     generated interaction matrix, on 24 of its 156 multi-turn field cases at once: every pair
     involving `grassyterrain` read `.field.terrain medi="" sd="grassy"`.
     A move that sets a FIELD is a field action. Grassy Terrain's per-turn heal is a property of the
     TERRAIN it puts down, not of the click -- but it carries `perTurnHP` for that heal, this branch
     is above the terrain branch, and it therefore resolved to `kind:'status'`, the Leech-Seed shape.
     So the one terrain move in the format that also heals was the one terrain move the engine could
     not set, and the other three worked, which is exactly why nothing noticed.
     Guarded here rather than by REORDERING the branches: hoisting the field block above this one also
     hoists it above `pivotStatus`, and Chilly Reception would stop pivoting -- trading a whole bug for
     a whole bug. STATED, NOT FIXED: the terrain's own 1/16 heal is still not modelled; this makes the
     terrain exist, and `perTurnHP` on a terrain has no per-turn consumer to land in. */
  /* ROADMAP #81 WIRE 12 -- CURSE IS TWO MOVES, AND THE BRANCH IS DECIDED AT RESOLUTION, NOT HERE.
   *
   * Will: "CURSE HAS TWO USES, MOSTLY BY NON GHOST TYPES TO BOOST ATTACK AND DEFENSE AND LOWER SPEED.
   * GHOST TYPES USES IT TO CUT SOME OF THEIR HP AND THEN THE TARGET TAKES RESIDUAL DAMAGE EACH TURN."
   * This line only says WHICH BRANCH LIST to use; `typeSplitMove` carries both halves and the turn
   * loop reads the user's type when the move actually goes off. That split matters: the branch is on
   * `source.hasType('Ghost')` AT THE MOMENT OF USE, so anything that changed the body's type earlier
   * in the same turn (Soak, Trick-or-Treat, Reflect Type) has to be seen, and a classification made
   * when the action was CHOSEN would read a stale type.
   *
   * It sits ABOVE the `perTurnHP` line below, which used to claim Curse and send it to the status
   * path -- where, carrying no major status, it fell into the `!st` arm, matched nothing, and
   * returned. Measured before a line changed: Farigiraf clicked Curse and ended the turn at
   * `at0 df0 sp0`, having lost no HP, with the foe having lost none either. The move did NOTHING. */
  if(TAGS.param('move',id,'typeSplitMove'))return {kind:'typesplit',mv:id,target};
  if(TAGS.has('move',id,'perTurnHP')&&!TAGS.has('move',id,'setsTerrain'))return {kind:'status',mv:id,target};
  /* PERISH SONG: a three-turn clock on everything on the field, INCLUDING THE USER'S OWN SIDE. It is
     a win condition rather than a chip move, and the rollout could not represent it at all. */
  if(TAGS.has('move',id,'perishClock'))return {kind:'perish',mv:id};
  /* FIXED DAMAGE, but only the forms the tag actually specifies. `halfTargetCurrentHP` is Super Fang
     and Nature's Madness and is fully derivable. The others -- ohko, counterDamageTaken,
     myRemainingHP, callback -- name a SOURCE this engine cannot evaluate, and are deliberately left
     as no-ops rather than approximated: a Counter that guesses is worse than a Counter that is
     visibly missing. */
  {
    const _fd=TAGS.param('move',id,'fixedDamage');
    if(_fd&&_fd.source==='halfTargetCurrentHP')return {kind:'fixeddmg',mv:id,target};
  }
  /* WIRE 107 -- TRICK AND SWITCHEROO (`takesTargetItem` with swaps, 353 clicks) and CORROSIVE GAS
     (removes without stealing). Status moves only -- the damaging members (Knock Off, Thief, Covet,
     Bug Bite) carry base power and are already served by `removesItem` in the attack branch, so
     nothing double-fires. Stuff Cheeks (consumes its OWN berry) carries neither flag and falls
     through untouched. */
  {
    const _ti=TAGS.param('move',id,'takesTargetItem');
    if(_ti&&(_ti.swaps||_ti.removes))return {kind:'trickitem',mv:id,target};
  }
  /* WIRE 108 -- TRICK-OR-TREAT, FOREST'S CURSE, SOAK, MAGIC POWDER (`changesTargetType`). The tag
     says whether the type is ADDED or REPLACES, and WHICH type is the move's own type -- true of all
     four members (Ghost move adds Ghost, Water move writes Water), so no type is named here and no
     tag_dex change was needed. */
  {
    const _ct=TAGS.param('move',id,'changesTargetType');
    if(_ct&&(_ct.adds||_ct.replaces))return {kind:'typechange',mv:id,target};
  }
  /* WIRE 109 -- AFTER YOU and QUASH (`reordersTurn`). INSTRUCT carries the identical {sends:'next'}
     and does something completely different -- it makes the target REPEAT its move -- and the
     census's "nothing in the artifact tells the two apart" was wrong: Instruct also carries
     `instructsTarget` ({extraAction:true}), a declared fact, and excluding on it is a shape read,
     not a name. Instruct itself stays an honest pass. */
  {
    const _ro=TAGS.param('move',id,'reordersTurn');
    if(_ro&&_ro.sends&&!TAGS.has('move',id,'instructsTarget'))return {kind:'reorder',mv:id,target};
  }
  /* WIRE 133 -- INSTRUCT, 178 uses, and it is the ONLY mechanic in this batch that changes the ACTION
   * COUNT of a turn: an ally that has already swung swings again, immediately. The comment above says
   * "Instruct itself stays an honest pass" -- it does not any more. */
  {
    const _in=TAGS.param('move',id,'instructsTarget');
    if(_in&&_in.extraAction)return {kind:'instruct',mv:id,target};
  }
  /* WIRE 110 (STAGED) -- SKILL SWAP (`swapsAbilities`). The derivation is written in tag_dex and the
     regeneration is staged; until data/tags.json carries the tag this branch matches nothing, which
     is the honest pre-regeneration state (the probe injects the staged tag through TAGS.__setDB). */
  {
    const _sw3=TAGS.param('move',id,'swapsAbilities');
    if(_sw3&&_sw3.swaps)return {kind:'abilityswap',mv:id,target};
  }
  /* WIRE 39 -- HAZE (552 uses) and Clear Smog. `clearsBoosts` resolved to `kind: pass`, so the one
     move in the format that answers a Belly Drum or a Dragon Dance was a wasted turn in every
     rollout. Clear Smog carries base power and is caught by the attack branch above, so only the
     pure-status members arrive here. */
  if(TAGS.has('move',id,'clearsBoosts'))return {kind:'haze',mv:id};
  /* WIRE 40 -- ROAR and WHIRLWIND, the damage-less half of forcesSwitch. Dragon Tail and Circle
     Throw carry base power and drag from the attack path; these two carry none and fell through to
     `pass`. 422 corpus uses between them. */
  if(TAGS.has('move',id,'forcesSwitch'))return {kind:'phaze',mv:id,target};
  /* WIRE 41 -- the hazard moves. They set a SIDE condition and this engine already has the only
     per-side object it needs (`_sf`, which every member of a team shares by reference), so a
     switch-in walks onto rocks that were laid before it arrived. */
  if(TAGS.param('move',id,'hazard'))return {kind:'hazard',mv:id};
  /* WIRE 42 -- SUBSTITUTE (548 uses) and the rest of costsUserHP. Checked LAST among the
     self-targeting kinds on purpose: Clangorous Soul and Shed Tail also pay HP and also do something
     else this engine already models (a setup and a pivot), and capturing them here would trade a
     half-modelled move for a fully wrong one. Their cost is applied at execution instead, where it
     applies to whatever kind they resolved to. */
  /* YAWN sleeps the target after a delay the tag states. */
  if(TAGS.has('move',id,'delayedSleep'))return {kind:'yawn',mv:id,target};
  if(fx&&fx.weather&&weatherId(fx.weather))
    return {kind:'weather',mv:id};
  /* THE TERRAIN MOVES, from the `setsTerrain` tag — the same shape as the weather line above and
     added beside it for that reason. Gated on terrainId returning something, so a member whose param
     neither vocabulary recognises resolves to a readable no-op rather than to a field value the rest
     of this file cannot match. WIRE 32 does the assignment. */
  {
    const _tp=TAGS.param('move',id,'setsTerrain');
    if(_tp&&_tp.terrain&&terrainId(_tp.terrain)) return {kind:'terrain',mv:id};
  }
  /* WIRE 133 -- THE TWO ROOMS. Wonder Room (`swapsDefences`, 11 uses) and Magic Room
   * (`suppressesItems`, 4) are `pseudoWeather` in the dex and both resolved to `kind:'pass'` -- a
   * wasted turn -- while the effects they describe change EVERY stored damage number and EVERY item
   * in the format respectively. Trick Room is the third member of that family and already has its own
   * branch, so this one is deliberately narrow: it claims a move only when one of the two room tags
   * is present, and nothing about Trick Room moves.
   *
   * ONE ACTION KIND FOR BOTH, because the mechanic they share is the FIELD CLOCK -- five turns, and
   * clicking it again while it is up TURNS IT OFF (`pseudoWeather` removal, the same rule Trick Room
   * follows here). What each one DOES while it is up is read at the site that cares. */
  {
    const _wr=TAGS.param('move',id,'swapsDefences'), _mr=TAGS.param('move',id,'suppressesItems');
    if((_wr&&_wr.swaps)||(_mr&&_mr.suppress))return {kind:'room',mv:id,
      room:(_wr&&_wr.swaps)?'wonderRoom':'magicRoom'};
  }
  /* WIRE 133 -- SAFEGUARD (`sideBuff`). The tag names the SIDE CONDITION it lays and the engine
   * already owns the only per-side object it needs (`_sf`, shared by reference across the whole team),
   * which is what makes a body switching in walk under a Safeguard that was set before it arrived --
   * the same argument the hazards and the screens make. */
  {
    const _sb=TAGS.param('move',id,'sideBuff');
    if(_sb&&_sb.sideCondition)return {kind:'sidebuff',mv:id,cond:_sb.sideCondition};
  }
  if(fx&&fx.status)return {kind:'status',mv:id,target};
  if(fx&&fx.targetBoostsAlways&&fx.target==='self')return {kind:'setup',mv:id};
  /* ONE READER FOR EVERY TARGET-SIDE EFFECT, from the artifact rather than a branch per move.
   *
   * `statChange` and `statusInflict` are derived uniformly in tag_dex from what the dex already
   * states, and cover 107 and 118 moves. Before them Charm, Fake Tears, Encore, Taunt and every
   * other target-side status move fell through to kind 'pass' -- a turn spent doing nothing, which
   * the search then had to be told to stop choosing. The self-boost path above is untouched: it
   * works, and re-applying those here would double every Swords Dance. */
  {
    const _sc=TAGS.param('move',id,'statChange'), _si=TAGS.param('move',id,'statusInflict');
    if((_sc&&_sc.target)||(_si&&_si.effects&&_si.effects.length))
      return {kind:'affect',mv:id,target,sc:_sc||null,si:_si||null};
  }
  /* WIRE 67, the SELF half. Belly Drum, Tidy Up and Stuff Cheeks raise their OWN stages from inside a
     handler, so no `boosts` field exists for the setup branch above to read and all three resolved to
     a wasted turn. Only members whose handler carries a LITERAL table arrive here; the five that
     invert, copy, swap or randomise their stages carry the tag with no numbers and still resolve to a
     pass, which is honest -- see the derivation's own comment for why a guessed table is worse. */
  {
    const _sc3=TAGS.param('move',id,'statChangeInCode');
    if(_sc3&&_sc3.boosts&&_sc3.on==='user')return {kind:'statcode',mv:id};
    /* WIRE 79 -- THE TARGET HALF OF statChangeInCode HAD NO CLASSIFIER AT ALL. WIRE 67 added the
       READER for it and put it inside the `switch` branch, because Parting Shot was the case it was
       written for -- so the tag worked for the one move that reaches that branch and for nothing else.
       STRENGTH SAP (637 uses) resolved to `kind:'pass'`: a wasted turn.
       Found by the generated matrix as `strengthsap -> suckerpunch`, reading
       `.boosts.atk medi=0 sd=-1`, with medicham2's own two arms identical -- an unwired knob rather
       than a wrong number.
       MEMBERSHIP PRINTED BEFORE WIRING, as this file's rule requires. Exactly THREE moves carry a
       target-side table: Parting Shot (claimed earlier by `pivotStatus`, so it cannot double-apply),
       Strength Sap, and Defog, whose only stage is `evasion` -- a stat this engine has no slot for, so
       SD2ENG returns nothing and the affect branch skips it rather than inventing one.
       WHAT IS STILL NOT MODELLED, stated: Strength Sap's HEAL scales off the TARGET's Attack and no
       artifact this engine reads carries it. The Attack drop is the half that decides where the move
       is played; the heal stays absent. It leaves fails.healProcedural now that the move resolves
       here, and that is a real loss of a receipt -- recorded in docs/ENGINE.md rather than left to be
       rediscovered as a counter that quietly went down. */
    if(_sc3&&_sc3.boosts&&_sc3.on==='target')
      return {kind:'affect',mv:id,target,sc:{target:[{boosts:_sc3.boosts,chance:100}]},si:null};
  }
  if(TAGS.has('move',id,'sealsMoves'))return {kind:'status',mv:id,target};   // Encore rides the status path
  /* WIRE 42 -- SUBSTITUTE. Last, so anything with a modelled effect has already claimed the click.
     Today that leaves exactly Substitute: a quarter of max HP for a body that then eats damage.
     Modelled as BOTH halves in the same pass on purpose -- charging the cost without granting the
     substitute would make the most-clicked defensive setup move in the format strictly worse than
     doing nothing, which is a one-directional error and the exact shape WIRE 30 was landed to avoid. */
  if(TAGS.param('move',id,'costsUserHP'))return {kind:'sub',mv:id};
  /* ROADMAP #81 WIRE 6 -- AN UNMODELLED CLICK IS STILL A CLICK, AND IT CARRIES ITS MOVE.
   *
   * `pass` means "this engine models no effect for that move", and it used to also mean "this engine
   * forgets which move it was" -- which is a different and larger claim. Showdown emits
   * `|move|USER|MOVE|TARGET` for every one of these 46 moves before it resolves anything, so a bare
   * `{kind:'pass'}` made the engine deny that a turn had been spent at all: the differential's stream
   * lost the move line AND every line after it slid one event out of step, so the run reported the
   * mismatch against whatever the NEXT actor did instead of naming the unmodelled move.
   *
   * A BARE `{kind:'pass'}` STILL MEANS NO ACTION and every caller that builds one by hand (the idle
   * ally in ~200 probes, game_differential's empty slot) keeps that meaning -- it has no `mv`, so it
   * announces nothing. The two are now distinguishable, which they were not.
   *
   * WHAT ELSE THE ID REACHES, CHECKED RATHER THAN ASSUMED, because `mv` is read by four gates above
   * the kind dispatch and this is a behaviour change in all of them:
   *   - actionPriority (l.2938) now brackets these correctly. Quick Guard is +3 and Ally Switch +2 and
   *     both were resolving at 0. That is a FIX, and it is the only one of the four that moves a turn.
   *   - the Taunt gate refuses them -- correct, they are all statusCategory but one, and the refusal
   *     emits `|cant|` where the engine used to emit nothing at all.
   *   - the Throat Chop gate silences Heal Bell (0 corpus uses), which is correct.
   *   - the costsUserHP charge: NO move that lands here carries that tag (checked over the whole of
   *     MC.moves against data/tags.json, 2026-08-07). If one ever does it would pay HP for an effect
   *     the engine does not grant, which is WIRE 130's exact shape -- so it is named here. */
  return {kind:'pass',mv:id};
}
function winProb2(nA,nB,N,ov){
  const A0=nA.slice(0,4).filter(n=>monRow(n)),B0=nB.slice(0,4).filter(n=>monRow(n));
  if(!A0.length||!B0.length)return null;
  let w=0;for(let i=0;i<N;i++){w+=battle(A0.map(n=>buildMon(n,ov)),B0.map(n=>buildMon(n,ov)),ov);}return w/N;
}
/* ALAKAZAM'S FUTURE SIGHT — the user-facing prediction read. Will asked for this by name
 * (2026-07-26): a shipped feature that predicts. It predicts three things, none of them invented:
 *
 *   clicks    what each opposing species is likely to CLICK, straight from the behaviour-clone
 *             priors (data/move-priors.json) — the same distribution chooseAction samples, so the
 *             forecast and the bot cannot disagree. When a species has no priors the fallback is
 *             uniform over its set and SAYS SO: ADR-001 attempt 3 fell back silently and reported a
 *             32-point finding that measured nothing.
 *   threats   for every my-mon x their-mon pair, the best move they have into it and the damage as
 *             a share of max HP, from the same dmgRange the rollouts use — tags, weather and all.
 *   pWin      winProb2 over N rollouts of the full doubles engine.
 *
 * A PURE READ: builds its own mons, mutates nothing, safe to call from a UI on every change. */
function futureSight(myNames,foeNames,opts){
  opts=opts||{};
  const field={terrain:opts.terrain||'',weather:opts.weather||'',twA:0,twB:0};
  const ov=opts.items||{};
  const mine=(myNames||[]).map(n=>buildMon(n,ov)).filter(Boolean);
  const foes=(foeNames||[]).map(n=>buildMon(n,ov)).filter(Boolean);
  if(!mine.length||!foes.length)return null;
  const foesOut=foes.map(f=>{
    const pr=MC.priors&&MC.priors[f.name];
    let clicks,fromPriors=true;
    if(pr&&pr.length){
      const tot=pr.reduce((s,q)=>s+q[1],0)||1;
      clicks=pr.map(q=>({move:q[0],p:q[1]/tot,kind:q[2]||'attack'}));
    }else{
      fromPriors=false;
      clicks=(f.moves||[]).map(id=>({move:id,p:1/(f.moves.length||1),kind:'unknown'}));
    }
    const threats=mine.map(m=>{
      const b=bestMoveVs(f,m,field);
      if(!b)return {into:m.name,move:null,minPct:0,maxPct:0,ko:'no'};
      return {into:m.name,move:b.id,
        minPct:Math.round(100*b.d.min/m.st.hp),
        maxPct:Math.round(100*b.d.max/m.st.hp),
        ko:b.d.min>=m.curHP?'guaranteed':(b.d.max>=m.curHP?'possible':'no')};
    });
    return {name:f.name,clicks,fromPriors,threats};
  });
  const pWin=winProb2(myNames,foeNames,opts.rollouts||200,ov);
  /* MY CLICKS, PRICED (Will: "for every implementation i sorta want a 'what is the cost/risk' of
   * clicking this move"). For each of my mons, every damaging click gets: damage into each foe,
   * the punisher price of touching that foe (punishExposure), and worst-case retention against
   * their BENCH (clickFragility) with the threat named. All the same reads the scorer makes. */
  const bench=(opts.foeBench||[]).map(n=>buildMon(n,ov)).filter(Boolean);
  const mineOut=mine.map(m=>({name:m.name,clicks:(m.moves||[]).map(id=>{
    const mv=MC.moves[id];
    if(!mv||!mv.bp)return {move:id,kind:'status'};
    const into=foes.map(f=>{
      const d=dmgRange(m,f,mv,field,false);
      const x=punishExposure(m,f,id,{field,foes});
      return {vs:f.name,minPct:Math.round(100*d.min/f.st.hp),maxPct:Math.round(100*d.max/f.st.hp),
              cost:x?x.total:0};
    });
    const frag=bench.length?clickFragility(m,id,foes[0],bench,field):null;
    return {move:id,into,fragility:frag&&frag.fragile?frag:null};
  })}));
  return {foes:foesOut,mine:mineOut,pWin,
    priorsCoverage:foesOut.filter(f=>f.fromPriors).length+'/'+foesOut.length};
}
root.winProb2=winProb2; root.dmgRange=dmgRange; root.buildMon=buildMon; root.MEDI_SPREAD=SPREAD;
root.futureSight=futureSight;
/* the tag lookup, exported so exposure.js prices risk off the SAME adapter the wires read —
 * a second adapter over window.ABRA_TAGS would be a place for the two to disagree */
root.ABRA_TAG_LOOKUP=TAGS; root.canTakeStatus=canTakeStatus; root.effSpeed=effSpeed;
/* ROADMAP #81 WIRE 12 -- the aura roster read, exported for the same reason `effSpeed` is: it is a
   pure FACT about a set of bodies, and a differential that wants to price one hit needs to be able to
   build the field the battle loop would have built without spending a turn to get it. */
root.auraStateOf=auraStateOf;
/* WIRE 118 -- ON THE ROOT AS WELL AS IN module.exports, because board.js reaches this engine through
   the GLOBAL object in a browser (damageEngine() returns `window`) and through require() in node. A
   module-only export would have left the Battle Tower page falling back on a hand-rolled order --
   which is the duplicate this wire deletes, reappearing in the one environment nothing tests. */
root.compareTurnOrder=compareTurnOrder; root.turnOrderKey=turnOrderKey; root.sortTurnOrder=sortTurnOrder;
/* ROADMAP #68 -- the trace's two readers. On the root as well as in module.exports for the same
   reason compareTurnOrder is: the browser reaches this engine through the global object. */
root.traceCounts=traceCounts; root.traceCanon=traceCanon; root.TRACE_EVENTS=TRACE_EVENTS;
root.punishExposure=punishExposure; root.clickFragility=clickFragility;
root.battleInit=battleInit; root.battleTurn=battleTurn; root.battleOver=battleOver; root.battleResult=battleResult; root.playerAction=playerAction;
root.parsePaste=parsePaste; root.buildMonFromSet=buildMonFromSet; root.weatherId=weatherId; root.terrainId=terrainId;
root.megaTargetFor=megaTargetFor; root.canMegaNow=canMegaNow; root.megaEvolveNow=megaEvolveNow;
root.natureShift=natureShift; root.natureStat=natureStat; root.natureL50=natureL50;
// exported for tests: the rulebook-reading helpers must be assertable on their own, so a wrong
// priority or a missed immunity fails a unit test rather than showing up as a drifted win rate.
if(typeof module!=='undefined'&&module.exports) module.exports={winProb2,dmgRange,buildMon,battle,futureSight,
  punishExposure,clickFragility,statusCostOf,physicalShare,speedFlipShare,EXPOSURE_HORIZON,bestMoveVs,battleInit,battleTurn,battleOver,battleResult,playerAction,parsePaste,buildMonFromSet,
  moveFx,movePriority,priorityRefusedAbove,isGrounded,moveAccuracy,canTakeStatus,effSpeed,applyEntryEffects,applyStatus,applyIntimidate,powderBlocked,pranksterBlocked,setPurePriors,
  /* ROADMAP #81 WIRE 12 -- the aura roster read; see the root export above. */
  auraStateOf,
  /* WIRE 129 -- exported for the ACCURACY-MODIFIER CONFORMANCE block in tests/test-engine-diff.js,
   * which re-derives the whole table out of the live format dex. A table nobody checks is the literal
   * it replaced; this is the only thing that makes it different in kind. */
  hitChance,hitProb,printedAccuracy,accStageMul,ACCMOD,
  /* WIRE 130 -- exported for the SUBSTITUTE-BYPASS CONFORMANCE block in tests/test-engine-diff.js. */
  SUBPASS,
  /* 2026-08-09 -- `MEDI_SPREAD`, WHICH THIS FILE HAS BEEN "EXPORTING" TO NOBODY SINCE IT WAS WRITTEN.
   *
   * Line 9972 assigns `root.MEDI_SPREAD=SPREAD` and that is the ONLY place it was ever published, so
   * `require('medicham2-browser.js').MEDI_SPREAD` has always been undefined -- `'MEDI_SPREAD' in M`
   * is false across all 65 exports. `engine/game_differential.js:2735` reads
   * `M.MEDI_SPREAD ? M.MEDI_SPREAD.has(id) : false`, so that ternary has taken the FALSE branch on
   * every run this repository has ever done and every spread move's staged damage span was priced as
   * a single-target hit -- no doubles 0.75 -- while Showdown's side of the same comparison came from
   * a real battle that applies it. ~1.33x high on Heat Wave, Rock Slide, Earthquake, Icy Wind,
   * Dazzling Gleam, Snarl, Discharge and Make It Rain.
   *
   * The `root` assignment stays: board.js reaches this engine through the global object in a browser,
   * which is the same argument `compareTurnOrder` and `traceCanon` already make ten lines down. This
   * adds the module half, changes NOTHING the engine does -- `SPREAD`'s contents are untouched -- and
   * changes what the INSTRUMENT reports through `mediSpan`. Landed AFTER ROADMAP #112's paired
   * before/after had both arms in hand, deliberately, so a pinch-family delta and a spread-pricing
   * delta could not arrive in one measurement. */
  MEDI_SPREAD:SPREAD,
  /* WIRE 118 -- THE ORDERING RULE, exported because board.js had a second copy of it. It is one
     function, it is pure, and it consumes no RNG, so a feature vector can ask it the same question a
     turn asks. `turnOrderKey`/`sortTurnOrder` come with it so a caller cannot have to rebuild the
     key by hand and get the Trick Room inversion subtly wrong -- which is how there came to be two. */
  compareTurnOrder,turnOrderKey,sortTurnOrder,actionPriority,TURN_ORDER,
  /* ROADMAP #68 -- the protocol trace. `traceCounts` PARSES the stream rather than counting beside
     it; `traceCanon` is the one normaliser the comparison driver applies to BOTH engines' lines;
     `TRACE_EVENTS` is what this engine claims it can emit, and engine/derive_protocol_events.js
     checks that claim against Showdown's own add() call sites. */
  traceCounts,traceCanon,TRACE_EVENTS,
  /* ROADMAP #31 -- mega evolution as a mid-turn choice. Exported because a driver that must issue the
     SAME choice to two engines has to be able to ASK this one whether the choice is legal, rather
     than reimplementing "is this a stone and is the side's mega spent" and drifting from it --
     CLAUDE.md's FACTS ARE GLOBAL rule. megaEvolveNow is exported for the probes, which have to be
     able to demonstrate the phase in isolation from the turn that normally calls it. */
  megaTargetFor,canMegaNow,megaEvolveNow,
  /* THE NATURE, exported as a FACT for the same reason md4096 is. A Showdown open team sheet reveals
     it (and never the spread), so engine/game_differential.js now carries the real one through to
     both engines -- and it must apply the SAME chart and the SAME fixed-point multiply this file
     does, or the two sides compute different Pokemon and the differential reports it as a rule bug.
     `natureL50` is the flat level-50 line under a named nature; `natureShift` is the chart itself,
     checked against the format dex by tests/test-nature-differential.js. */
  natureShift,natureStat,natureL50,NATURE_SHIFT,
  /* Exported so a caller can ask THIS engine what counts as a protect rather than keeping a second
   * list that drifts from it: the live bot tracks consecutive uses to seed tookProtectTurns. */
  PROTECTMOVES,
  /* Exported for the SAME reason as PROTECTMOVES: the boundary that hands this engine a field has to
   * be able to ask THIS engine what its weather words are, rather than keeping a second map that
   * drifts. rollout_leaf.applyField is the caller that needed it and could not reach it. */
  weatherId,terrainId,
  /* Same argument one step further on: the MEGA route lives in rollout_leaf and was the third of
   * four setters writing a literal 5. It calls this rather than growing its own rock read. */
  weatherTurns,
  /* ROADMAP #81 WIRE 4 -- SHOWDOWN'S FIXED-POINT ARITHMETIC. Exported because it is a FACT and not a
   * feature: every engine in this repo that multiplies a damage, a stat or a base power owes the
   * same +2047-on-4096ths rounding, and a second private copy of it is precisely the "two files that
   * both decide Choice Scarf is x1.5" defect CLAUDE.md names. board.js still has its own float
   * arithmetic and is not this division's file to change -- filed, with the exposure measured. */
  md4096,ch4096,mdChain,CH_ONE,CH_EXACT,
  /* The swallowed-failure counters. Zero is a CLAIM, not a pass — read it, do not assume it. */
  fails:MEDFAILS,
  /* Capabilities that FIRED. A zero here is the finding — see MEDSEEN's own comment. */
  seen:MEDSEEN};
})(typeof window!=='undefined'?window:globalThis);
