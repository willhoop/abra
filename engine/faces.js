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


module.exports = { FACES, facesFor };
