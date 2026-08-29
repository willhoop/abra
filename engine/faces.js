/* WHAT THE ADVERSARY MUST BE DOING — the `faces` table, ROADMAP #98.
 *
 * Data only. No side effects, nothing executed on require. It lives apart from
 * `engine/all_mechanics_fire.js` because that file RUNS when required, and a table has to be readable
 * without starting an instrument — the first probe that imported it began playing games.
 *
 * ON WHETHER ONE FIXED TARGET IS ENOUGH. Will: *"DO WE WANT JUST A FIXED TARGET LIKE FERALIGATR OR
 * MORE VARIED? WILL IT PROC EVERYTHING?"* **It will not, and that is the whole reason this file
 * exists.** A single Feraligatr cannot proc everything for three separate reasons, and each one is a
 * different kind of blindness:
 *
 *   1. ITS MOVES. Flower Trick is Meowscarada's alone; Storm Throw, Frost Breath, Spore, Fake Out and
 *      Earthquake are not one body's set. A tag whose trigger is a move nobody on the field can click
 *      is untestable no matter how many turns you play.
 *   2. ITS TYPE. Feraligatr is pure Water — chosen deliberately, because it has NO immunity and so
 *      blocks nothing by accident. That is the right DEFAULT and the wrong universal: a Ground
 *      immunity needs a Ground move thrown, a powder refusal needs a Grass target to refuse it.
 *   3. ITS ABILITY. It carries Torrent. Anything that COPIES or REWRITES an ability — Trace, Receiver,
 *      Mummy, Wandering Spirit — would be measured against Torrent every single time, so the test
 *      would pass while only ever exercising one value.
 *
 * So the target VARIES, keyed on the tag under test, and Feraligatr remains the default for everything
 * with no stated need. Varying it blindly would be worse than fixing it: a random adversary makes a
 * green mean something different every run, which is how the roster's control arm came to measure the
 * control instead of the subject (ROADMAP #100).
 *
 * KEYED ON THE TAG, NOT THE ABILITY NAME, so an ability added tomorrow inherits its adversary for
 * free — the same reason 217 catalogue shapes cover 920 entities. `recv` names moves the RECEIVER must
 * be able to click; `clickOf` falls back when a body cannot learn one, so an entry that does not fit a
 * carrier degrades to the old behaviour rather than throwing.
 *
 * WHAT IS DELIBERATELY ABSENT. `critRatioUp` has no entry: a crit RATE cannot be settled on one board
 * and belongs to `engine/million_targets.js`. `preventsCrit` DOES have one, because three legal moves
 * always crit and need no die — Will: *"WHAT HAPPENS IF FLOWER TRICK HITS A BATTLE ARMOR MON?"*
 * Showdown sets the guaranteed crit, skips the roll, then cancels it via `runEvent('CriticalHit')`, so
 * it lands for normal damage with no `-crit`. That one fixture settles Battle Armor, Shell Armor,
 * Disguise, Ice Face, the three always-crit moves AND Mold Breaker, which is itself in the inert list.
 */
'use strict';

const FACES = {
  typeImmunity:        { recv: ['Earthquake', 'High Horsepower', 'Bulldoze'],
                         why: 'Levitate and Eelevate are invisible until a GROUND move is thrown at them' },
  refusesSecondaries:  { recv: ['Iron Head', 'Air Slash', 'Rock Slide'],
                         why: 'Shield Dust only suppresses a secondary that was going to happen' },
  refusesStatusMoves:  { recv: ['Thunder Wave', 'Will-O-Wisp', 'Toxic'],
                         why: 'Good as Gold refuses STATUS moves; an attack tells you nothing' },
  blocksMove:          { recv: ['Thunder Wave', 'Will-O-Wisp', 'Toxic'],
                         why: 'same adversary as refusesStatusMoves — the block needs a move to block' },
  statusImmune:        { recv: ['Thunder Wave', 'Will-O-Wisp', 'Toxic', 'Spore'],
                         why: 'Immunity, Limber, Insomnia and Vital Spirit each refuse ONE status, so the '
                            + 'adversary carries several and the arm that matters is the one it can inflict' },
  refusesVolatile:     { recv: ['Spore', 'Hypnosis', 'Confuse Ray'],
                         why: 'Insomnia and Vital Spirit refuse a volatile, not damage' },
  preventsStatDrop:    { recv: ['Charm', 'Growl', 'String Shot'],
                         why: 'Illuminate refuses a stat DROP; nothing drops a stat in the bare gauntlet' },
  ignoresStatStages:   { recv: ['Swords Dance', 'Nasty Plot', 'Agility'],
                         why: 'Unaware only shows once the attacker has BOOSTED — otherwise there is no '
                            + 'stage to ignore and the two boards agree' },
  boostsOnFlinch:      { recv: ['Iron Head', 'Air Slash', 'Fake Out'],
                         why: 'Steadfast needs an actual flinch; the pin makes the chance fail, so Fake Out '
                            + 'is the one that flinches deterministically' },
  rewritesAbilityOnContact: { recv: ['Aqua Tail', 'Waterfall', 'Facade'],
                         why: 'Mummy and Wandering Spirit rewrite on CONTACT — a special attack never '
                            + 'triggers them, and the bare gauntlet throws Hydro Pump' },
  piercesProtect:      { recvProtects: true,
                         why: 'Piercing Drill and Unseen Fist are only observable against a PROTECT, which '
                            + 'the gauntlet deliberately never clicks' },
  preventsCrit:        { recv: ['Flower Trick', 'Storm Throw', 'Frost Breath'],
                         why: 'the three legal always-crit moves — no die needed, so Battle Armor, Shell '
                            + 'Armor, Disguise and Ice Face are settled on ONE board' },
  critDamageUp:        { recv: ['Flower Trick', 'Storm Throw', 'Frost Breath'],
                         why: 'Sniper multiplies a crit that LANDED; the guaranteed-crit moves supply one '
                            + 'without touching the die' },
  ignoresDefenderAbility: { recv: ['Flower Trick', 'Storm Throw', 'Frost Breath'],
                         why: 'Mold Breaker is proven by a breakable ability CEASING to apply — Battle '
                            + 'Armor against an always-crit move is the cleanest such pair' },
  weatherSuppression:  { setsWeather: 'Sunny Day',
                         why: 'Cloud Nine suppresses weather; with no weather up it suppresses nothing' },
  privateWeather:      { setsWeather: 'Rain Dance',
                         why: 'Mega Sol holds its own weather AGAINST another — it needs one to hold out' },
  ignoresScreensAndSubs: { recv: ['Reflect', 'Light Screen', 'Substitute'],
                         why: 'Infiltrator ignores a screen that has to be up first' },
  deductsExtraPP:      { countsPP: true,
                         why: 'Pressure is entirely a PP effect and the board comparison did not read PP '
                            + 'until 2026-08-10' },
  switchOutTrigger:    { statusFirst: 'Thunder Wave',
                         why: 'Natural Cure cures ON SWITCH-OUT — the gauntlet switches out with nothing '
                            + 'to cure, so the two boards agree' },
  typeBecomesMoveType: { actor: ['Ember', 'Water Gun', 'Vine Whip'],
                         why: 'Protean changes the USER to the move type — the actor must click something '
                            + 'off its own type for anything to move' },
  boostsFromFallen:    { alliesFaint: true,
                         why: 'Supreme Overlord counts FALLEN allies, and the gauntlet is built so nothing '
                            + 'ever faints' },
  buffsHolderOnHit:    { koTheHolder: true,
                         why: 'Innards Out fires on the holder BEING KNOCKED OUT — Will\'s own fixture' },
  boostsOnKO:          { koTheFoe: true,
                         why: 'a KO trigger needs a KO, and the gauntlet forbids fainting' },
  accuracyMod:         { recv: ['Hydro Pump', 'Focus Blast', 'Thunder'],
                         why: 'Compound Eyes and Tangled Feet only move a SUB-100 accuracy; every move in '
                            + 'the bare gauntlet is 100' },
  writesAccuracy:      { recv: ['Hydro Pump', 'Focus Blast', 'Thunder'],
                         why: 'No Guard makes a sub-100 move certain — against a 100-accuracy move it is '
                            + 'indistinguishable from nothing' },
  speedCond:           { statusFirst: 'Thunder Wave',
                         why: 'Quick Feet keys on the holder BEING statused; Surge Surfer on terrain' },
  damageBoost:         { movesLast: true,
                         why: 'Analytic multiplies only when the holder moves LAST, and the gauntlet has it '
                            + 'moving first every turn' },
  /* ---- THE ADVERSARIES FOR THE TAGS ROADMAP #156 CREATED ----------------------------------------
   * Twenty-five abilities were inert AND carried no tag but `untagged`, so no adversary could be
   * derived for any of them: a table keyed on a tag cannot key on nothing. These entries exist
   * because those tags now exist, and each one names the adversary the gauntlet was missing. */
  refusesIndirectDamage: { setsWeather: 'Sandstorm', statusFirst: 'Toxic',
                         why: 'Magic Guard (114 fields) refuses HP loss from anything that is not a MOVE '
                            + '— and the gauntlet inflicts NO indirect damage at all, so there is nothing '
                            + 'to refuse. Sand and a poison are two different sources of it, and an engine '
                            + 'wired for one is not wired for the other' },
  healsFromOwnStatus:  { statusFirst: 'Toxic',
                         why: 'Poison Heal turns ONE named status into a heal. On an unpoisoned body it is '
                            + 'byte-identical to having no ability' },
  curesStatusResidual: { statusFirst: 'Thunder Wave', setsWeather: 'Rain Dance',
                         why: 'Healer, Shed Skin and Hydration all cure a status that has to exist first; '
                            + 'Hydration additionally needs the SKY, and a fixture that stages only the '
                            + 'status silently tests two of the three' },
  reflectsStatusToSource: { recv: ['Will-O-Wisp', 'Thunder Wave', 'Toxic'],
                         why: 'Synchronize (135 fields) hands the status BACK to whoever threw it, so the '
                            + 'adversary has to throw one. The bare gauntlet throws attacks' },
  removesOwnMoveFlag:  { recvAbility: 'Rough Skin',
                         why: 'Long Reach deletes `contact` from its own moves, and `contact` is only '
                            + 'observable through a REACTOR — the same rule the move stage applies to the '
                            + 'flag itself. Against a body that punishes nothing, deleting the flag deletes '
                            + 'nothing' },
  copiesFoeAbility:    { recvAbility: 'Intimidate',
                         why: 'Trace (274 fields, the largest untagged row in the artifact) copies the '
                            + 'FOE\'S ability — and the gauntlet\'s receiver carries Torrent, which is inert '
                            + 'by construction in this fixture. Tracing an inert ability is indistinguishable '
                            + 'from not tracing at all' },
  multihitAlwaysMax:   { actor: ['Bullet Seed', 'Icicle Spear', 'Rock Blast'],
                         why: 'Skill Link collapses a 2-5 distribution to 5. The subject must CLICK a '
                            + 'multi-hit move; on a single-hit attack there is no distribution to collapse' },
  /* ---- FOUR ABILITIES WHOSE ONLY TAG IS A PROPERTY, AND A PROPERTY IS NOT A TRIGGER -------------
   * `breakable` says Mold Breaker can switch it off. It says NOTHING about what has to happen for the
   * ability to do anything, which is exactly the `pp` / `statusCategory` mistake the MOVE_FACES header
   * refuses to make. So the adversary is derived from what each one actually reads. */
  breakable:           { recv: ['Grass Knot', 'Low Kick', 'Ice Beam', 'Heat Wave'], allyIsTargeted: true,
                         why: 'the residue of `breakable`-only rows, and the union is deliberate because '
                            + 'four different mechanics share the tag: Heavy Metal and Light Metal move '
                            + 'the holder\'s WEIGHT (only a weight-based move reads it), Magma Armor '
                            + 'refuses FREEZE (only an Ice move can try), and Telepathy dodges the '
                            + 'ALLY\'S spread move (only an ally-reaching attack can be dodged). A body '
                            + 'carrying one of them faces all four rather than the fixture guessing '
                            + 'which — a wrong guess reads as inert, which is the failure this whole '
                            + 'table exists to remove' },
  boostsAtHPThreshold: { koTheHolder: false, movesLast: false,
                         why: 'Berserk pays on CROSSING half, so the bar must travel across the line in one '
                            + 'hit — which needs the REAL hp pool, not the safe x6 one the gauntlet uses to '
                            + 'stop anything fainting. This is the one entry whose adversary is the POOL' },
};
/* The adversary is chosen by TAG, and an ability carrying several gets the union — a body that both
 * resists a status and rewrites on contact must face both, or one arm silently covers for the other. */
function facesFor(tags) {
  const out = { recv: [], why: [] };
  for (const t of (tags || [])) {
    const f = FACES[t];
    if (!f) continue;
    for (const m of (f.recv || [])) if (!out.recv.includes(m)) out.recv.push(m);
    for (const k of ['recvProtects', 'setsWeather', 'countsPP', 'statusFirst', 'actor',
                     'alliesFaint', 'koTheHolder', 'koTheFoe', 'movesLast'])
      if (f[k] !== undefined && out[k] === undefined) out[k] = f[k];
    out.why.push(t + ': ' + f.why);
  }
  return out.recv.length || out.why.length ? out : null;
}


/* ---- AND THE SAME FOR MOVES. 54 of them are inert for the identical reason. -----------------------
 *
 * The move stage hands the subject a click and lets the receiver attack back. That reaches any move
 * whose whole effect is damage, and misses every move whose effect is ABOUT the adversary. Will named
 * two of these himself before the measurement existed: *"IE WIDE GUARD NEEDS A SPREAD MOVE AGAINST
 * IT, ITS POINTLESS TO TEST IF IT DOESNT FACE THAT"*, and *"HAVE CONTACT HIT ROUGH SKIN TO CHECK"*.
 *
 * `pp`, `statusCategory`, `neverMisses` and `moveClass` are the four biggest tag buckets among the
 * inert moves and NONE of them appears below, deliberately: they are PROPERTIES, not triggers.
 * Nothing follows from "this is a status move" about what must happen for it to be observable. A
 * property is tested through its REACTOR, which is what the `contact`, `sound` and `powder` entries
 * below actually are.
 */
const MOVE_FACES = {
  semiInvulnerable: { recvAttacks: ['Earthquake', 'Gust', 'Surf'], onTheChargeTurn: true,
    why: 'Dig, Dive, Fly, Bounce and Phantom Force are only observable if something SWINGS at them '
       + 'while they are gone. Will: Earthquake does DOUBLE to a digging target — and the PIERCE list '
       + 'and the DOUBLE list are not the same set, so five moves reach a flying target for normal '
       + 'damage. An engine implementing "pierces implies doubles" is wrong on all five' },
  oneTurnGuard:     { recvAttacks: ['Rock Slide', 'Heat Wave', 'Aqua Jet'],
    why: 'Wide Guard needs a SPREAD move and Quick Guard needs a PRIORITY one. They share a tag and '
       + 'need different adversaries, which is exactly why one arm cannot cover both' },
  redirects:        { allyIsTargeted: true,
    why: 'Follow Me and Rage Powder are only visible when a SINGLE-TARGET move aimed at the ALLY '
       + 'arrives somewhere else. A spread move is never redirected — my own Rage Powder finding was '
       + 'retracted for exactly that reason' },
  reordersTurn:     { partnerHasAMove: true,
    why: 'After You, Instruct and Quash act on somebody ELSE\'s turn. Will: a fast Lopunny clicks '
       + 'After You so a slow Torkoal moves first. With no partner move to reorder there is nothing '
       + 'to observe' },
  changesTargetType:{ followUp: ['Thunderbolt', 'Earthquake', 'Vine Whip'],
    why: 'Soak, Forest\'s Curse and Trick-or-Treat change a TYPE, and a type is only observable '
       + 'through effectiveness. The follow-up must be a move whose damage MOVES when the type does — '
       + 'otherwise the board is identical and the row reads inert' },
  chargeTurn:       { turns: 2,
    why: 'a two-turn move needs its SECOND turn; one staged turn only ever watches it charge' },
  needsTargetToAttack: { recvAttacks: ['Aqua Tail', 'Facade'],
    why: 'Mirror Coat and Upper Hand FAIL unless the target is attacking. The bare board gives them '
       + 'nothing to answer, so they fail for the fixture\'s reason rather than the engine\'s' },
  contact:          { recvAbility: 'Rough Skin',
    why: 'Will: HAVE CONTACT HIT ROUGH SKIN TO CHECK. A property flag is tested through its reactor, '
       + 'never by asserting the flag is set on the move' },
  sound:            { recvAbility: 'Soundproof',
    why: 'the reactor for sound — same rule as contact' },
  powder:           { recvType: 'Grass',
    why: 'a Grass body REFUSES powder and the refusal is the test. Will\'s Stun Spore case is sharper '
       + 'still: it is powder AND paralysis, so Grass refuses it before resolution and Electric '
       + 'refuses it at application. An engine missing exactly one of the two gates still passes' },
  flinches:         { movesFirst: true,
    why: 'a flinch only lands if the flincher moves FIRST; moving second makes it a silent no-op' },
  sealsMoves:       { recvRepeatsAMove: true,
    why: 'Torment and Gravity seal an OPTION — the adversary has to want the sealed move for the seal '
       + 'to change any board' },
  ignoresProtect:   { recvProtects: true,
    why: 'the same fixture as piercesProtect on the ability side' },
};
/* Same union rule as the ability side: a move carrying several tags must face all of them, or one arm
 * silently covers for another and the row passes for the wrong reason. */
function movesFacesFor(tags) {
  const out = { why: [] };
  for (const t of (tags || [])) {
    const f = MOVE_FACES[t];
    if (!f) continue;
    for (const k of Object.keys(f)) if (k !== 'why' && out[k] === undefined) out[k] = f[k];
    out.why.push(t + ': ' + f.why);
  }
  return out.why.length ? out : null;
}

/* ---- AND THE OTHER 25. `thenWhat` — WHAT MUST HAPPEN AFTERWARDS. ROADMAP #158. ------------------
 *
 * THE STAGING VOCABULARY IS TWO THINGS AND THE TABLES ABOVE ARE ONLY ONE OF THEM.
 *
 *     faces      what the subject must be UP AGAINST     — an ADVERSARY
 *     thenWhat   what must happen AFTERWARDS to read the state the subject just set — a CONSEQUENCE
 *
 * None of the 25 rows below is failing for want of an adversary. **They set a STATE, and the board is
 * identical because nothing downstream ever reads it.** Haze resets stat stages, so something must
 * have BOOSTED first and the boosts must be read after. Magnet Rise grants a Ground immunity, so a
 * Ground move has to come AFTER. Safeguard blocks status, so a status move has to follow. Poltergeist
 * needs the target to be HOLDING something. Helping Hand needs the ally to attack afterwards. Lock-On
 * needs a sub-100 move next.
 *
 * FORCING THESE INTO `MOVE_FACES` WOULD HAVE PRODUCED ENTRIES THAT LOOK LIKE ADVERSARIES AND ARE NOT,
 * which is the kind of thing that passes review and then quietly means nothing. An adversary is a
 * body and a click on the SAME turn; a consequence is a turn that has not happened yet. A harness
 * given the two as one concept cannot know whether to add a body or add a turn.
 *
 * KEYED ON THE TAG, exactly as `FACES` is, so a move added tomorrow inherits its consequence for
 * free. FIVE OF THE KEYS BELOW DID NOT EXIST WHEN THIS TABLE WAS DESIGNED and that is the whole
 * reason ROADMAP #157 came first: Guard Split, Power Split, Speed Swap, Lock-On and Magnetic Flux
 * carried `[pp, neverMisses, statusCategory]` — three PROPERTIES and nothing about their mechanic —
 * so there was literally nothing to key on. **A scenario cannot be derived from nothing.**
 *
 * WHAT EACH FIELD MEANS TO A HARNESS:
 *   before        turns to play BEFORE the click, described by what they must achieve
 *   after         turns to play AFTER the click — the ones that read the state
 *   readsOff      whose board the consequence lands on, because a harness comparing the SUBJECT'S
 *                 slot cannot see a consequence that lands on the target or the ally
 *   needs         a fixture precondition that is not a turn at all (an item in a hand, an ability on
 *                 the partner). Distinguished from `before` on purpose: one is a click, the other is
 *                 how the body was BUILT, and they are staged at different times.
 */
const THEN_WHAT = {
  clearsBoosts: { stage: { boostFirst: true }, before: ['the subject BOOSTS a stat'], after: [], readsOff: 'self',
    why: 'Haze (654 uses) resets stat stages. On a board where nothing has boosted it resets nothing '
       + 'and the two arms are byte-identical — the fixture measuring its own emptiness' },
  rewritesStoredStats: { stage: { attacksAfter: 'both' }, before: [], after: ['the subject ATTACKS', 'the target ATTACKS'],
    readsOff: 'both', why: 'Guard Split, Power Split and Speed Swap move `storedStats`, which is NOT '
       + 'a stat stage — a board comparator reading `boosts` sees nothing whatsoever. The change is '
       + 'only observable as a DAMAGE number or a move ORDER on a later turn, from BOTH bodies, '
       + 'because an average moves one up and the other down' },
  guaranteesNextMove: { stage: { subjectClicksAfter: ['Hydro Pump', 'Focus Blast', 'Thunder'] }, after: ['the subject clicks a SUB-100 accuracy move at the same target'],
    readsOff: 'target', why: 'Lock-On does nothing at all on the turn it is used. Its `neverMisses` '
       + 'tag is about LOCK-ON ITSELF, not about the move it makes certain, which is the opposite end '
       + 'of the mechanic' },
  boostsAlliesWithAbility: { stage: { allyAbility: true, attacksAfter: 'both' }, needs: ['the PARTNER carries one of the named abilities'],
    after: ['the partner is HIT'], readsOff: 'ally',
    why: 'Magnetic Flux FAILS OUTRIGHT with no eligible ally — the handler returns false — so a '
       + 'scenario staged without one measures the failure and reports it as inert' },
  rewritesTargetAbility: { stage: { attacksAfter: 'both' }, after: ['the target is made to USE the ability it now has'],
    readsOff: 'target', why: 'Entrainment, Simple Beam and Worry Seed replace an ability. Nothing on '
       + 'the board says which ability a body holds, so the change is only visible when the NEW '
       + 'ability does something the old one would not' },
  swapsAbilities: { stage: { attacksAfter: 'both' }, after: ['BOTH bodies are made to use the ability they now hold'], readsOff: 'both',
    why: 'Skill Swap is the two-ended version of the row above, and reading only one end passes on '
       + 'an engine that copied instead of exchanging' },
  swapsDefences: { stage: { attacksAfter: 'subject', bothCategories: true }, after: ['the subject clicks a PHYSICAL move', 'the subject clicks a SPECIAL move'],
    readsOff: 'target', why: 'Wonder Room exchanges Defence and Sp. Def. One category alone cannot '
       + 'tell the swap from a flat defensive drop — the two must move in OPPOSITE directions' },
  suppressesItems: { stage: { itemsOnBoth: 'Sitrus Berry', attacksAfter: 'both' }, needs: ['both bodies HOLD an item whose effect is observable'],
    after: ['the item would have fired'], readsOff: 'both',
    why: 'Magic Room switches items off. With empty hands it switches nothing off' },
  setsRoom: { stage: { switchAfter: true }, after: ['a SWITCH is attempted'], readsOff: 'both',
    why: 'Fairy Lock stops anybody leaving on the FOLLOWING turn, so the click turn shows nothing and '
       + 'the refusal is the whole mechanic' },
  sideBuff: { stage: { foeClicksAfter: ['Thunder Wave', 'Will-O-Wisp', 'Toxic'] }, after: ['a STATUS move is thrown at the protected side'], readsOff: 'self',
    why: 'Safeguard blocks status for five turns. With nothing thrown at it, it blocks nothing — and '
       + 'this key covers every side condition whose param says `blocksStatus`, not Safeguard by name' },
  readsTargetItem: { stage: { itemsOnBoth: 'Sitrus Berry' }, needs: ['the TARGET holds an item'], after: [], readsOff: 'target',
    why: 'Poltergeist FAILS against an empty-handed body, and the gauntlet\'s receiver holds nothing' },
  thawsTarget: { stage: { foeClicksAfter: ['Surf', 'Hydro Pump'] }, after: ['the subject\'s own TYPE is read, and a move of the lost type is thrown at it'],
    readsOff: 'self', why: 'Burn Up removes the user\'s FIRE type. The damage it deals is ordinary; '
       + 'the mechanic is what the user has become, which only a later effectiveness reads' },
  removesPP: { stage: { warmup: true, countsPP: true }, before: ['the target USES a move, so it has a last move to be spited'],
    after: ['the target\'s PP is read'], readsOff: 'target',
    why: 'Spite takes PP off the move the target LAST used. Against a body that has not moved it '
       + 'fails, and PP is not a leaf most board comparators read at all' },
  callsAnotherMove: { stage: { asleep: true }, before: ['the subject is put ASLEEP'], readsOff: 'self',
    why: 'Sleep Talk and Snore are the only two moves in the format that REQUIRE their user to be '
       + 'asleep. Will: "YOU GOTTA BE ASLEEP FOR SLEEP TALK AND SNORE"' },
  failsIfVolatile: { stage: { foeClicksAfter: ['Earthquake', 'High Horsepower', 'Bulldoze'] }, after: ['a GROUND move is thrown at the subject'], readsOff: 'self',
    why: 'Magnet Rise grants a Ground immunity and nothing else. Its own turn is empty' },

  /* ---- THE REFUSAL FAMILY, AND WHY IT NEEDED A VERB OF ITS OWN (MEASURE, 2026-08-29) -------------
   *
   * A SHIELD IS THE ONE CONSEQUENCE THAT CANNOT BE STAGED ON A LATER TURN. Every entry above adds
   * turns AFTER the state is set — the header two blocks down says so, and for a state that persists
   * that is right. These leaves all declare `duration: 1`, so by the next turn there is nothing left
   * to attack into. The consequence has to land on the CLICK TURN or it cannot land at all, which is
   * why `attackedOnTheSameTurn` is a new verb rather than another spelling of `attacksAfter`.
   *
   * THE ABILITY ARM CANNOT EXECUTE IT AND MUST SAY SO. `gauntletScript` builds its consequence turns
   * past the switch; there is no place in it for a same-turn adversary. It will count the verb in
   * `THEN_WHAT_SEEN.verbsUnknown`, which is the LOUD path that already exists for exactly this — a
   * verb a caller cannot run must never stage nothing and look like a consequence that did not help.
   * Measured: no ability or item in this format carries any of these four tags, so the counter stays
   * at zero and the entries are the MOVE arm's alone.
   *
   * WHY THESE FOUR KEYS AND NOT THE VOLATILE TABLE BELOW. Measured over the 500 legal moves before
   * being wired: `shieldsUser` matches 5 (Protect, Detect, Spiky Shield, King's Shield, Baneful
   * Bunker), `oneTurnGuard` 2 (Quick Guard, Wide Guard), `preTurnShield` 2 (Focus Punch, Beak Blast),
   * `survivesAnyHit` 1 (Endure) — ten rows, no over-match, nothing else touched. The volatile table
   * below cannot reach four of them at all: Quick Guard and Wide Guard write a SIDE condition and
   * Focus Punch and Beak Blast a pre-turn one, so none of the four carries a `statusInflict` param
   * for `thenWhatFor` to key on.
   *
   * WHAT THE VALUE MEANS is the SHAPE of the hit the leaf's own guard reads, never a move name:
   *   'physical'  any attack at all reaches an unconditional shield
   *   'contact'   the punishing shields read `checkMoveMakesContact`
   *   'priority'  Quick Guard's guard is `if (move.priority <= 0.1) return`
   *   'spread'    Wide Guard's is `move.target !== 'allAdjacent' && !== 'allAdjacentFoes'`
   *   'lethal'    Endure prints nothing until the damage would actually kill
   * The caller picks the move off the RECEIVER'S OWN built pool by those properties, so no species
   * and no move is named here. */
  shieldsUser: { stage: { attackedOnTheSameTurn: 'physical' }, after: ['a move is thrown INTO the shield, on the turn the shield goes up'],
    readsOff: 'self', why: 'Protect and its family emit `-singleturn` the moment they are clicked and '
       + '`-activate` only when something is refused. With nothing attacking, the announcement is the '
       + 'whole row — and `-singleturn` is a consequence, so the verdict reads RESOLVED for a shield '
       + 'that has never blocked anything' },
  punishesContact: { stage: { attackedOnTheSameTurn: 'contact' }, after: ['a CONTACT move is thrown into the shield'],
    readsOff: 'both', why: 'Spiky Shield, King\'s Shield and Baneful Bunker each do something EXTRA to '
       + 'a contact attacker — chip, a Defence drop, poison. A non-contact hit is refused identically '
       + 'by all three and by plain Protect, so it cannot tell the four apart' },
  oneTurnGuard: { stage: { attackedOnTheSameTurn: 'guardShape' }, after: ['a move of the SHAPE this guard reads is thrown at the protected side'],
    readsOff: 'both', why: 'Quick Guard refuses only `move.priority > 0.1` and Wide Guard only a '
       + 'spread target. An ordinary single-target attack passes straight through both, so a fixture '
       + 'that throws one has staged the guard\'s own null case and called it a pass' },
  preTurnShield: { stage: { attackedOnTheSameTurn: 'contact' }, after: ['the charging body is HIT before it acts'],
    readsOff: 'both', why: 'Focus Punch is CANCELLED by any damaging hit and Beak Blast BURNS a '
       + 'contact attacker. Both announce `-singleturn` from `priorityChargeCallback` at the top of '
       + 'the turn whatever happens next, and both then deal ordinary damage — so the row resolves '
       + 'twice over while the leaf\'s only function goes unexercised' },
  survivesAnyHit: { stage: { attackedOnTheSameTurn: 'lethal' }, after: ['a LETHAL hit is thrown at the enduring body'],
    readsOff: 'self', why: 'Endure clamps a killing blow to 1 HP and prints `-activate` only then. '
       + 'A survivable hit leaves the clamp unexercised and the leaf still announces itself' },

  /* ---- THE CONSEQUENCES FOR THE ABILITY TAGS ROADMAP #156 CREATED ------------------------------
   * The same split holds on the ability side. Some of the twenty-five needed an ADVERSARY and are in
   * `FACES` above; these needed a turn that had not happened yet. */
  suppressesOwnItem: { stage: { itemsOnBoth: 'Sitrus Berry', attacksAfter: 'both' }, needs: ['the HOLDER holds an item whose effect is observable'],
    after: ['the item would have fired'], readsOff: 'self',
    why: 'Klutz switches the holder\'s own item off. On an empty-handed body it switches nothing off, '
       + 'and every item consumer in this project reads the SLOT rather than asking whether it works' },
  stealsItem: { stage: { itemsOnBoth: 'Sitrus Berry', attacksAfter: 'both' }, needs: ['the OTHER body holds an item'],
    after: ['the item is read on BOTH bodies'], readsOff: 'both',
    why: 'Magician (265 fields) and Pickpocket (104) move an item between two hands. With one hand '
       + 'empty nothing moves — and reading only the thief\'s slot passes on an engine that DUPLICATES '
       + 'the item instead of taking it' },
  passesItemToAlly: { stage: { itemsOnBoth: 'Sitrus Berry', allyAttacksAfter: true }, needs: ['the HOLDER holds an item', 'the PARTNER holds a consumable item'],
    before: ['the partner CONSUMES its item'], after: ['both item slots are read'], readsOff: 'ally',
    why: 'Symbiosis fires on the ALLY spending something, which the gauntlet never makes happen' },
  inheritsAllyAbility: { stage: { alliesFaint: true, attacksAfter: 'subject' }, before: ['the PARTNER is knocked out'],
    after: ['the subject is made to use the ability it inherited'], readsOff: 'self',
    why: 'Receiver copies from a body that has to DIE first, and the gauntlet is built so nothing faints' },
  clearsScreensOnEntry: { stage: { screensFirst: ['Reflect', 'Light Screen'], attacksAfter: 'both', bothCategories: true }, before: ['a SCREEN is raised — on the subject\'s own side as well as the foe\'s'],
    after: ['a move of each category is thrown at BOTH sides'], readsOff: 'both',
    why: 'Screen Cleaner deletes screens on ENTRY, and it deletes its OWN side\'s too. A fixture that '
       + 'raises only the foe\'s screen cannot catch an engine that spares the friendly one' },
  fractionalPriority: { stage: { attacksAfter: 'both' }, after: ['both bodies act in a turn where the ORDER decides the board'],
    readsOff: 'both', why: 'Quick Draw and Stall nudge priority INSIDE a bracket. On a board where the '
       + 'same body wins the turn either way, the nudge changes no leaf at all' },
  nameImplementedBySim: { stage: { asleep: true, extraTurns: 2 }, before: ['the subject is put ASLEEP'],
    after: ['the sleep counter is read on each of the next two turns'], readsOff: 'self',
    why: 'Early Bird halves a sleep that has to exist first, and Corrosion needs a Steel or Poison '
       + 'target to poison. Both are irreducible in the artifact and neither is inert in the game' },
  announcesOnEntry: { stage: null, unobservable: true, readsOff: 'nothing',
    why: 'DECLARED UNOBSERVABLE, and that is the point of the entry rather than an omission. '
       + 'Anticipation, Forewarn and Frisk emit a message and move no state, so NO consequence can '
       + 'make them visible to a board comparator. The roster already defers them; this says WHY in '
       + 'the same vocabulary as everything else, so the deferral rests on a derived fact' },
};

/* A VOLATILE IS A CONSEQUENCE KEY TOO, AND FOR SEVEN ROWS IT IS THE ONLY ONE THERE IS.
 *
 * Attract, Destiny Bond, Helping Hand, Gastro Acid, Power Trick, Power Shift and Magnet Rise all
 * carry `statusInflict` — a tag SO broad it covers a third of the move list — and their mechanic is
 * entirely in WHICH volatile they set. Keying the table on `statusInflict` would hand the same
 * consequence to every status move in the format; keying it on the move NAME is the hand list
 * docs/TAGS.md forbids. The volatile id is neither: it is a PARAM the artifact already derives
 * (`statusInflict.effects[].volatile`), so this table is still read out of the tag record and a move
 * that sets one of these volatiles tomorrow inherits its consequence.
 *
 * ---- AND IT HAS NEVER FIRED ONCE. MEASURED 2026-08-29, AND IT IS THE UNWIRED-KNOB LESSON ----------
 *
 * All seven of these volatiles are written by MOVES — Attract, Destiny Bond, Helping Hand, Gastro
 * Acid, Power Trick, Power Shift and Magnet Rise are the moves that share their names. `thenWhatFor`
 * is called at exactly ONE site in `engine/all_mechanics_fire.js`, inside the ABILITY ladder, and no
 * ability in this format carries a `statusInflict` param naming any of the seven. Cute Charm — the
 * one ability that infatuates — is tagged `punishesAttacker` with no `statusInflict` at all.
 *
 * So the reach of this table, measured against `data/tags.json`, is:
 *
 *     abilities  201 entries, thenWhatFor non-null on 18, reached BY A VOLATILE KEY on   0
 *     items      148 entries, thenWhatFor non-null on  1, reached BY A VOLATILE KEY on   0
 *     moves      500 entries, thenWhatFor non-null on 32, reached BY A VOLATILE KEY on   7
 *
 * The whole volatile half of `thenWhatFor` was dead: seven entries wired to the one arm where none of
 * their keys exist. It produced no error and no zero counter — `THEN_WHAT_SEEN.rows` counted 64 rows
 * and every one of them came from the tag-keyed table above. An unwired knob gives identical output.
 * The fix is at the CALLER (`setupFor` now calls `thenWhatFor` too), not here; this note records that
 * a table's reach is a thing to measure rather than to assume, and that 25 of those 32 move rows are
 * reached by the tag table, not by this one.
 */
const VOLATILE_THEN_WHAT = {
  attract:      { stage: { attacksAfter: 'both' }, after: ['the infatuated body tries to MOVE'], readsOff: 'target',
    why: 'infatuation costs a turn half the time and costs nothing on the turn it lands' },
  destinybond:  { stage: { koTheHolder: true }, after: ['the SUBJECT is knocked out'], readsOff: 'both',
    why: 'Destiny Bond does nothing unless its user dies, and the gauntlet is built so nothing faints' },
  helpinghand:  { stage: { allyAttacksAfter: true }, after: ['the ALLY attacks'], readsOff: 'ally',
    why: 'Helping Hand (5,014 uses — the most-clicked move in this whole table) multiplies a move '
       + 'that has not been clicked yet. On its own turn it is a no-op' },
  gastroacid:   { stage: { attacksAfter: 'both' }, after: ['the target is made to use the ability that is now suppressed'],
    readsOff: 'target', why: 'suppressing an ability is invisible until the ability would have fired' },
  powertrick:   { stage: { attacksAfter: 'subject' }, after: ['the subject clicks a PHYSICAL move'], readsOff: 'target',
    why: 'Power Trick exchanges the user\'s own Attack and Defence; only its damage output shows it' },
  powershift:   { stage: { attacksAfter: 'both' }, after: ['the subject clicks a move', 'the subject is HIT'], readsOff: 'both',
    why: 'Power Shift exchanges offence with defence in both directions, so one arm cannot see it' },
  magnetrise:   { stage: { foeClicksAfter: ['Earthquake', 'High Horsepower', 'Bulldoze'] }, after: ['a GROUND move is thrown at the subject'], readsOff: 'self',
    why: 'the same consequence as the `failsIfVolatile` key above, reached from the other end' },
};

/* THE BERRY PRECONDITION — `thenWhat` POINTED ONE TURN EARLIER, and it is the same concept.
 *
 * Cheek Pouch, Cud Chew and Gluttony do not need a consequence AFTER; they need an ANTECEDENT: a
 * berry that was actually EATEN. All three share ONE fixture — hold a Sitrus, take the HP past the
 * threshold, look — which is why they are one table rather than three entries, and why Will's
 * usage-times-fixture-cost rule put them on the BUILD side of the line while Pickup went to the
 * shelf: three mechanics off one staging.
 *
 * KEYED ON THE TAG, like everything else here. The tags are the ones `tag_dex.js` already derives for
 * the berry family, so a fourth berry ability inherits the fixture.
 */
const BERRY_FIXTURE = {
  needs: ['the subject HOLDS a berry whose effect is observable (a Sitrus, which heals a quarter)',
          'the HP pool is the REAL one — x1, not the safe x6 — or no fraction can be crossed'],
  before: ['the subject is taken BELOW the berry\'s own threshold'],
  after: ['the item slot and the HP are read on the turn AFTER the eat, because two of the three act '
        + 'later than the eat itself'],
  readsOff: 'self',
  why: 'all three are inert on a full-HP body holding nothing, and all three are reached by one '
     + 'staging. Cheek Pouch heals ON the eat, Cud Chew eats the SAME berry again a turn later, and '
     + 'Gluttony moves the threshold that decides WHETHER to eat — so the fixture has to cross the '
     + 'line AND run a turn past it, or one of the three is measured and the other two are not',
};
const BERRY_TAGS = ['healsOnBerryEaten', 'reEatsBerry', 'lowersBerryThreshold', 'doublesBerryEffect',
                    'restoresBerryAtResidual'];

/* Same union rule as both tables above: a move carrying several consequence keys must satisfy all of
 * them. `params` is the entity's own tag params, so the volatile keys resolve without any caller
 * knowing which volatile a move sets. Returns null when nothing applies — a move whose whole effect
 * is damage needs no consequence and must not be given a fabricated one. */
/* `stages` IS THE EXECUTABLE HALF AND IT IS A LIST RATHER THAN A MERGED OBJECT, deliberately. A
 * merge here would silently drop the second entry's value for a verb the first also names, and the
 * caller is the only thing that knows which of its own verbs it can actually run — so the merge, and
 * the LOUD counter for a verb it cannot execute, live at the caller. A `null` in the list is a
 * DECLARED unstageable key (`announcesOnEntry`), not a missing one, and is passed through as null so
 * the caller can count it apart from a gap. */
function thenWhatFor(tags, params) {
  const out = { before: [], after: [], needs: [], readsOff: [], why: [], stages: [] };
  const take = (key, t) => {
    if (!t) return;
    for (const k of ['before', 'after', 'needs'])
      for (const s of (t[k] || [])) if (!out[k].includes(s)) out[k].push(s);
    if (t.readsOff && !out.readsOff.includes(t.readsOff)) out.readsOff.push(t.readsOff);
    if ('stage' in t) out.stages.push(t.stage);
    out.why.push(key + ': ' + t.why);
  };
  for (const t of (tags || [])) take(t, THEN_WHAT[t]);
  /* A DECLARED UNOBSERVABLE ROW, HOISTED SO A CALLER CAN READ IT AS A FIELD RATHER THAN AS PROSE.
   * `announcesOnEntry` sets `stage: null` AND `unobservable: true` because Anticipation, Forewarn and
   * Frisk emit a MESSAGE and move no state — no number of turns can make one visible to a board
   * comparator. That is a DECLARED gap, and until 2026-08-19 it existed only inside a `why` sentence,
   * so the rows it covers sat in the caller's `did_not_fire_unexplained` bucket beside genuine engine
   * gaps. A sentence a machine cannot read is not an explanation. */
  for (const t of (tags || [])) if (THEN_WHAT[t] && THEN_WHAT[t].unobservable) out.unobservable = t;
  /* the volatile keys, resolved out of the entity's OWN params rather than from its name */
  const eff = ((params || {}).statusInflict || {}).effects || [];
  for (const e of eff) if (e.volatile) take('volatile:' + e.volatile, VOLATILE_THEN_WHAT[e.volatile]);
  /* the berry antecedent, which is one shared fixture across the whole berry-ability family */
  for (const t of (tags || [])) if (BERRY_TAGS.includes(t)) { take('berry:' + t, BERRY_FIXTURE); break; }
  return out.why.length ? out : null;
}

module.exports = { FACES, facesFor, MOVE_FACES, movesFacesFor,
                   THEN_WHAT, VOLATILE_THEN_WHAT, BERRY_FIXTURE, BERRY_TAGS, thenWhatFor };

