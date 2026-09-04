/* position_features.js — what a POSITION is worth describing by, as opposed to a move.
 *
 *   const P = require('./position_features.js');
 *   P.positionFeatures(board, 'p1', dex)   ->  Float64Array, one entry per P.POSITION_FEATURES
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT board.js
 * -------------------------------------------
 * board.js describes a CANDIDATE ACTION: what happens if I click this. That is the right shape for a
 * policy and the wrong shape for everything else, because a value function, a search leaf and a
 * team-preview score are all questions about a POSITION with no action attached.
 *
 * WHAT THE OLD VALUE NET WAS MISSING, MEASURED
 * --------------------------------------------
 * PORYGON2's seventeen features are, by its own comment, "MATERIAL and FIELD": alive counts, HP
 * totals, weather, screens, hazards, plus three crude proxies (matchup_edge, speed_edge,
 * type_threat). Evaluated on held-out human games it scores 63.6% where SIGN OF THE MATERIAL
 * DIFFERENCE alone scores 60.2% -- about three points for seventeen features, because most of what
 * it measures is a fancier way of counting Pokemon.
 *
 * And more data does not fix it: data/porygon2-curve.json measures 62.81% at 9,171 positions against
 * 62.62% at 73,368. Eight times the corpus, nothing. A flat learning curve is a statement about the
 * REPRESENTATION, not the sample -- so the answer is different features, which is what this is.
 *
 * The thing it never had is the one this project spent months building: a damage engine checked
 * move-for-move against the standard calculator, reading DECLARED items, abilities and natures off
 * open team sheets. PORYGON2 has never called it. It guesses at "matchup_edge" from the type chart
 * while an exact answer sits one require away.
 *
 * THE DAMAGE ENGINE IS JAVASCRIPT AND PORYGON IS PYTHON, which is why this is a node module that
 * emits a dataset rather than a Python function. A second damage implementation on the Python side
 * is the single thing this repository has bled for most (two engines disagreeing by 30% on mega
 * Charizard-Y's Special Attack), and a value function trained against a second, wronger calculator
 * would be confidently wrong in a way nothing downstream could see.
 *
 * SYMMETRIC BY CONSTRUCTION. Every feature is expressed from `side`'s point of view and every
 * difference is (mine - theirs), so evaluating the same position from the other side negates the
 * differences and leaves the shared terms alone. A value function that is not symmetric can learn
 * "p1 tends to win", which is a fact about the harness and not about Pokemon.
 */
'use strict';
const path = require('path');
const B = require('./board.js');
const M = require('./medicham2-browser.js');
const TAGS = require('./tags.js');
const { mcKey } = require('./mc_key.js');   // the ONE species -> MC.mons resolver

const POSITION_FEATURES = [
  /* ---- MATERIAL. Kept because it genuinely carries most of the signal, and kept SEPARATE so the
   * contribution of everything else can be read against it rather than tangled with it. */
  'aliveDiff',        // my living Pokemon minus theirs, over the bring size
  'hpActiveDiff',     // health of what is on the field, mine minus theirs
  'hpTotalDiff',      // health of everything still alive, mine minus theirs
  /* ---- THE DAMAGE RACE — the half PORYGON2 never had -----------------------------------------
   * Not "who is bigger" but "who runs out first". Computed with the real engine against the sheet's
   * declared sets, so a Choice Specs boost or an Assault Vest is priced rather than guessed at. */
  'iKillNext',        // fraction of their actives I remove this turn if I hit them
  'theyKillNext',     // fraction of MY actives they remove this turn — the mirror, and not symmetric
  'raceEdge',         // their turns-to-clear minus mine, so positive means I win the race
  /* ---- ORDER. Effective speed, not base speed: Choice Scarf, paralysis, Tailwind, Trick Room and
   * the weather Speed abilities all apply. Being faster is worth nothing on its own, which is why it
   * appears here alongside the kill terms rather than as a lone stat comparison. */
  'speedEdge',        // fraction of the active matchups where I move first
  'killFirstEdge',    // I outspeed AND remove it, minus the same done to me
  /* ---- FIELD. Cheap, already tracked, and genuinely decides games in this format. */
  'weatherMine',      // the weather is one my side set
  'terrainMine',      // likewise the terrain
  'trickRoom',        // Trick Room is up (it inverts the whole speed half above)
  'tailwindDiff',     // my Tailwind minus theirs
  'screenDiff',       // my screens minus theirs
  /* ---- WHAT IS LEFT IN THE BACK. Answer depletion: a position is won when nothing they have left
   * beats what I have left, which is not visible in material at all. */
  'benchAnswersDiff', // how many of their bench answer my actives, minus the reverse
  /* ---- PINNED. Will: "if a mon just protected, then it is pinned and either has to take an attack
   * or switch something in that will. if no mon in the back can resist a rockslide then thats a real
   * problem."
   *
   * A side is PINNED when it has spent its escape and has nowhere to go: the active just stalled, so
   * stalling again is unreliable; the incoming hit removes it; and nothing left in the back survives
   * that hit either. Every option loses something, which is a property of the POSITION and appears
   * nowhere in material — both sides can have four Pokemon and one of them be lost.
   *
   * This is the shape material cannot see and the reason a value function built on alive-counts
   * scores 63% against 60% for counting. */
  'pinnedDiff',       // they are pinned, minus the same done to me
  'turn',             // how deep the game is, scaled — a 2-point lead on turn 3 is not one on turn 20
];
const POSITION_INDEX = Object.fromEntries(POSITION_FEATURES.map((f, i) => [f, i]));

const other = s => (s === 'p1' ? 'p2' : 'p1');

/* Build a damage-engine mon for a species on `side`, using whatever the sheet declared. Returns null
 * for anything outside the format's table rather than substituting a guess. */
function monFor(board, side, species, hpFrac, opts) {
  if (!species) return null;
  const key = species;
  /* THE TABLE'S KEYS CARRY HYPHENS — 'steelix-mega', 'slowbro-galar' — and B.norm strips them, so
   * norm('steelix-mega') is 'steelixmega', which is not a key. Every FORME therefore failed to build
   * and fell through to its base form: a Mega Steelix was priced as a Steelix. Found because a pin
   * check reported no refuge behind a Pokemon that plainly survives the hit. */
  /* THE `B.norm(name)` RUNG IS GONE, 2026-08-23, and its absence is the fix rather than a tidy-up.
   * It existed because buildMon matched an EXACT table key, so a hyphenated forme had to be tried a
   * second way -- and B.norm STRIPS the hyphen, so the second attempt was the 2026-08-01 bug spelled
   * out: it could only ever succeed for a name that had no punctuation to begin with. buildMon now
   * resolves through the table's own flattened index (engine/medicham2-browser.js monKey), so the
   * first rung answers every spelling and the second could only ever have found the same row or
   * nothing. The BASE-SPECIES rung stays: it is a different question -- "price this as its base if
   * the forme is not in the table" -- and it is a real fallback, not a spelling retry. */
  const build = (name) => {
    try { return M.buildMon(name) || M.buildMon(B.baseSpecies(name)); }
    catch (e) { return null; }
  };
  const e = (board.sheet && board.sheet[side] && board.sheet[side][B.baseSpecies(species)]) || {};
  const declaredItem = (typeof board.sheetItem === 'function' ? board.sheetItem(side, species) : e.item) || '';

  /* ---- MEGA EVOLUTION, AND WHEN IT HAS ACTUALLY HAPPENED -------------------------------------
   * Will: "when a mon switches in, its normal, but then can mega evolve. so the switch in and
   * retaliate needs to calc the switch in is base stats and retaliate is mega stats."
   *
   * Exactly right, and the code was wrong in a larger way underneath it. medicham2's megaForme()
   * reads window.MEGA_FORMES, which does not exist in node — it returns null on every server-side
   * call, so buildMon NEVER applies a mega and a Mega Blaziken was priced as a Blaziken in every
   * calculation this project makes. board.js's megaFormeOf reads the dex's megaStone instead and is
   * now exported, so the stone finally reaches the stats.
   *
   * And then Will's sequencing on top: switching in costs the turn, so the Pokemon ARRIVES in base
   * form and eats that turn's hit with base bulk. It megas on a later turn and attacks with mega
   * stats. So the same Pokemon must be built twice and each read must take the right one —
   * `opts.mega` asks for the attacking form.
   */
  let name = key;
  if (opts && opts.mega && declaredItem) {
    let mega = null;
    try { mega = B.megaFormeOf(species, declaredItem, dexFor()); } catch (e2) { mega = null; }
    if (mega) {
      const hyphen = B.baseSpecies(species) + '-mega';
      /* MEMBERSHIP, ASKED OF THE ONE RESOLVER. `MC.mons[hyphen]` is the exact line the seal now
       * throws on, and rightly: `mega` here comes from B.megaFormeOf and is a DEX id, which is flat,
       * while the table keys formes with a hyphen -- so the second branch was asking the raw table a
       * question in the wrong spelling and could only ever answer no. mcKey.has resolves first. */
      if (mcKey.has(hyphen)) name = hyphen;
      else if (mcKey.has(mega)) name = mcKey(mega);
    }
  }
  const m = build(name);
  if (!m) return null;

  /* dmgMon's rule: a sheet always declares a nature, so nature is what tells the engine a sheet was
   * read at all. Same convention here so the two agree about when the sheet is in play. */
  if (e.nature) {
    m.item = B.norm(declaredItem);
    if (e.ability) m.ability = B.norm(e.ability);
    /* THE DECLARED MOVES. buildMon fills `moves` from the dataset's representative set, so without
     * this every Pokemon is evaluated on an average four rather than the four it brought. */
    const mv = (e.moves || []).map(B.norm).filter(id => MC.moves[id]);
    if (mv.length) m.moves = mv;
  }
  if (typeof hpFrac === 'number' && m.st && m.st.hp) m.curHP = Math.max(0, Math.round(m.st.hp * hpFrac));
  return m;
}

/* The dex, resolved lazily and once — positionFeatures is handed one by its caller, but monFor is
 * also reached from the bench walks where it is not in scope. */
let _dex = null;
function dexFor() {
  if (!_dex) { const CS = require('./champions_sim.js'); _dex = CS.sim().Dex.forFormat(CS.FORMAT); }
  return _dex;
}

const FIELD = { weather: '', terrain: '', twA: 0, twB: 0 };
/* Best mean damage as a fraction of the defender's CURRENT health, so a chipped target is correctly
 * easier to remove. Returns the MOVE as well as the number, because who moves first depends on which
 * move you are throwing -- see the order note below. dmgRange takes a move OBJECT and dereferences
 * field.weather, both of which have bitten callers here before. */
function bestHit(att, def, field, refusedAbove, whatIsLeft) {
  const none = { frac: 0, id: null, killId: null, killPrio: -9 };
  if (!att || !def || !def.st || !def.st.hp) return none;
  const bar = typeof refusedAbove === 'number' ? refusedAbove : Infinity;
  const left = Math.max(1, def.curHP != null ? def.curHP : def.st.hp);
  let best = 0, bestId = null, killId = null, killPrio = -9, killRisk = Infinity;
  for (const id of (att.moves || [])) {
    const mv = MC.moves[id];
    if (!mv || !mv.bp) continue;
    let r = null;
    try { r = M.dmgRange(att, def, mv, field || FIELD, false); } catch (e) { continue; }
    if (!r || typeof r.min !== 'number') continue;
    const mean = (r.min + r.max) / 2;
    if (mean > best) { best = mean; bestId = id; }
    /* THE KILLING MOVE IS NOT THE BIGGEST MOVE, and conflating them got the order wrong. Among the
     * moves that remove the target, the one that matters is the one that resolves EARLIEST -- a slow
     * Pokemon with Sucker Punch removes something before a faster Pokemon acts, and choosing its
     * highest-damage move instead would have thrown that away. Damage only breaks ties inside a
     * bracket, because past the kill threshold extra damage buys nothing. */
    if (mean >= left) {
      const prio = M.movePriority(id, field || FIELD);
      /* Refused outright by Armor Tail / Queenly Majesty / Dazzling / Psychic Terrain — not slower,
       * FAILED — so it is not a way to remove anything. */
      if (prio > bar) continue;
      /* AMONG MOVES THAT KILL, TAKE THE SAFEST — not the biggest (Will: "if both moves ko then
       * choose the lowest risk one"). Past the kill threshold extra damage buys literally nothing,
       * so ranking killers by damage ranks them by a quantity that has stopped mattering. What still
       * separates them is how often the kill FAILS TO HAPPEN:
       *
       *   accuracy      a 70% move that kills is a 70% kill; a 100% one is a kill.
       *   the punisher  Rough Skin, Iron Barbs and the contact burn/paralysis abilities charge for
       *                 touching the body. punishExposure prices exactly that, and already inverts
       *                 for Guts, which WANTS the proc.
       *
       * Both come from the engine rather than being restated here. Priority still outranks safety:
       * a kill that resolves first prevents the reply entirely. */
      let risk = 1 - (M.moveAccuracy(id, field || FIELD) / 100);
      try {
        const ex = M.punishExposure(att, def, id, {});
        if (ex && typeof ex.cost === 'number') risk += Math.max(0, ex.cost);
      } catch (e) { /* nothing to price */ }
      /* AND WHAT IT LEAVES YOU HOLDING (Will: "if both moves ko but one is resisted by a mon in the
       * back and one isnt, it might be better to choose the one that is effective against both").
       *
       * The kill is settled either way, so the tiebreak is about the NEXT Pokemon. A move their back
       * resists wins this turn and threatens nothing afterwards; one that hits both wins this turn
       * and keeps the pressure. Priced as the share of their remaining Pokemon that resist this
       * move's type, so it is a small continuous nudge rather than a rule. Type effectiveness comes
       * from the engine's own chart. */
      if (whatIsLeft && whatIsLeft.length) {
        let resisted = 0;
        for (const b2 of whatIsLeft) {
          try { if (M.dmgRange(att, b2, mv, field || FIELD, false).eff < 1) resisted++; } catch (e) {}
        }
        risk += 0.5 * (resisted / whatIsLeft.length);
      }
      if (prio > killPrio || (prio === killPrio && risk < killRisk)) {
        killPrio = prio; killId = id; killRisk = risk;
      }
    }
  }
  return { frac: best / left, id: bestId, killId, killPrio };
}

/* PRIORITY BLOCKING COMES FROM THE ENGINE, not from a copy here.
 *
 * This file briefly carried its own derivation of the blocksMove tag, which made three
 * implementations of the same rule in one repository (clickFragility had one, the battle loop had
 * none, this had a third). medicham2 now owns it next to movePriority and effSpeed, where the rest
 * of the move-order rules already live, and everything calls that. */
function priorityRefusedAbove(board, side, field) {
  const defenders = board.field()
    .filter(f => f.side === side && f.mon && !f.mon.fainted)
    .map(f => {
      const e = (board.sheet && board.sheet[side] && board.sheet[side][B.baseSpecies(f.mon.species)]) || {};
      return { ability: B.norm(f.mon.ability || e.ability || ''), fainted: false };
    });
  return M.priorityRefusedAbove(defenders, field);
}

/* WHO ACTUALLY MOVES FIRST — priority bracket, THEN speed. Will: "effective speed needs to consider
 * prio too", and he was right about the code as well as the principle: the first version of this
 * compared raw `st.sp` while its own comment claimed to use effective speed. It did not.
 *
 * Priority is not a tiebreak on speed, it OUTRANKS it entirely: Sucker Punch from something slow
 * resolves before anything in the +0 bracket no matter how fast that is, and this format is full of
 * Fake Out. So the comparison is lexicographic on (priority, speed).
 *
 * TRICK ROOM INVERTS THE SPEED HALF ONLY. It reverses the order WITHIN a bracket and does nothing to
 * the brackets themselves — a +1 move still goes before a +0 move under Trick Room. Applying the
 * inversion to priority would be a rule this game does not have.
 *
 * effSpeed carries Choice Scarf, Tailwind, paralysis, the weather Speed abilities and stat stages;
 * movePriority carries the terrain-conditional cases like Grassy Glide. Both come from the engine
 * rather than being restated here, so there is one definition of the queue in this project. */
/* DEGRADATION COUNTERS. Zero is the expected value of every field here; a non-zero one means some
 * consumer silently got a worse answer than this module promises. Read it, do not just trust it.
 *
 * `movesFirstCalls` IS NOT A DEGRADATION — it is what makes the zero above mean anything. Until
 * 2026-09-04 NOTHING IN THE TREE READ `speedFallbacks` (three appearances: this line and the two
 * increments), and the comment below said "Exported as STATS so a caller or a test can assert it
 * stayed at zero" — a check the code could not perform, which is the same shape as
 * `MEDFAILS.ripenBerryBoostUnmodelled`. Wiring the obvious `speedFallbacks === 0` assertion would
 * have been WORSE than nothing: it is green whether the guarded path ran or not, which is a test
 * asking nothing. `tests/test-engine-consistency.js` asserts the PAIR — the path ran AND it never
 * degraded — and neither half is meaningful alone. */
const STATS = { speedFallbacks: 0, lastSpeedError: null, movesFirstCalls: 0 };

function movesFirst(att, attMoveId, attSideTag, def, defMoveId, defSideTag, field, trickRoom) {
  STATS.movesFirstCalls++;
  const pa = attMoveId ? M.movePriority(attMoveId, field) : 0;
  const pd = defMoveId ? M.movePriority(defMoveId, field) : 0;
  if (pa !== pd) return pa > pd;
  /* THE FALLBACK IS NOW COUNTED, because it reverts to the exact bug the comment above records as
   * fixed. If effSpeed throws, these catches quietly substitute RAW `st.sp` — no Choice Scarf, no
   * Tailwind, no paralysis, no weather Speed ability. That is "compared raw st.sp while its own
   * comment claimed to use effective speed", reintroduced silently on any exception.
   *
   * And it CAN throw. Measured 2026-07-31: effSpeed raises on a missing `field`, on a null mon, and
   * on a mon built without `boosts` — all reachable from a caller that assembles a Pokemon by hand
   * rather than through M.buildMon.
   *
   * This project's idiom everywhere else is to COUNT a degradation rather than absorb it
   * (`stats.jointFellBack` in magnemite.js; the worker capability accounting in mew_farm.js). A
   * fallback indistinguishable from success is how the original bug survived. Exported as STATS so a
   * caller or a test can assert it stayed at zero. */
  let sa = 0, sd = 0;
  try { sa = M.effSpeed(att, field, attSideTag); }
  catch (e) { STATS.speedFallbacks++; STATS.lastSpeedError = e.message; sa = (att && att.st && att.st.sp) || 0; }
  try { sd = M.effSpeed(def, field, defSideTag); }
  catch (e) { STATS.speedFallbacks++; STATS.lastSpeedError = e.message; sd = (def && def.st && def.st.sp) || 0; }
  return trickRoom ? sa < sd : sa > sd;
}

function positionFeatures(board, side, dex) {
  const x = new Float64Array(POSITION_FEATURES.length);
  const set = (n, v) => { x[POSITION_INDEX[n]] = Number.isFinite(v) ? v : 0; };
  const foe = other(side);
  /* twA/twB are what effSpeed reads for Tailwind, and the A/B tags below map MY side to A and
   * theirs to B so the doubling lands on the right one. */
  const field = {
    /* THE SECOND BOUNDARY THAT SPOKE THE WRONG VOCABULARY. `board.weather` is Showdown's
     * `|-weather|` line normalised, so its values are MOVE names — `sunnyday`, `raindance`,
     * `sandstorm`, `snowscape`. Every formula this `field` is then handed to compares against the
     * engine's own words: dmgRange's Fire/Water multipliers and the snow-Ice / sand-Rock defence
     * boosts read `field.weather === 'sun'|'rain'|'snow'|'sand'` directly, and effSpeed's
     * Swift Swim / Chlorophyll / Sand Rush / Slush Rush doubling does the same. `B.norm` only
     * lower-cased it, so the string was TRUTHY AND MEANINGLESS — the identical defect
     * `rollout_leaf.applyField` carried at the leaf boundary.
     *
     * EXPOSURE, RE-MEASURED HERE RATHER THAN INHERITED. Over 339,483 corpus turn-boards
     * (ladder + bo3 + ots) 35.85% carry a weather; over the 3,202 MID-GAME boards this module is
     * actually asked about (the joint_rows walk, 400 open-sheet games) it is 49.94%, because weather
     * accumulates as a game goes on. Scoring both sides of every board, 1,962 of 6,404 positions
     * move — sun 73.6%, rain 66.7%, sand 49.5%, snow 29.5% — across 7 of the 16 columns, the largest
     * being raceEdge (29.7% of all positions, max |delta| 0.42). **0 of 3,206 clear-weather positions
     * moved**, which is the control that says this is the weather and not the walk.
     *
     * NO REFIT IS OWED. Nothing fits or renders these columns: the only callers of
     * `positionFeatures` in the repository are four tests. `board.js` — which every MAG weight does
     * come from — has a THIRD copy of this map and is a separate, gated question; see docs/MEASURE.md.
     *
     * NO SECOND MAP. `MEDI.weatherId` is medicham2's own `SD2WEATHER` exported — the same call
     * `rollout_leaf.js` makes — and it is idempotent, so a caller already speaking the engine's
     * vocabulary is unaffected and an unrecognised value resolves to no weather and is COUNTED in
     * `M.fails.weatherUnknown` instead of passing through as a truthy string nothing reads. */
    weather: M.weatherId(board.weather || ''),
    /* Terrain was hardcoded to '' here, which quietly disabled the Psychic Terrain half of the
     * priority block — it read a field it never filled in. Derived from the board's own field keys,
     * which is where terrain has always been tracked.
     *
     * The list is a list of BOARD KEYS to probe, not a translation table — `board.startField` stores
     * the dex's `move.terrain` (`electricterrain`, …) while the engine speaks `electric`. The
     * short/long translation is done by `MEDI.terrainId` and nowhere else, exactly as the weather
     * above and exactly as `rollout_leaf.terrainOnBoard` does. Walking the whole field namespace
     * instead would hand `trickroom` to `terrainId` and count a bogus `fails.terrainUnknown` on
     * nearly every board.
     *
     * This one is a NO-OP on today's values and is made anyway: every reader downstream
     * (`movePriority`, `priorityRefusedAbove`, the Hadron Engine and terrain-boost branches of
     * `dmgRange`) already calls `terrainId` itself, so the long key resolves correctly there. It is
     * translated HERE so the field object leaving this function is in one vocabulary rather than
     * two, which is the condition that let the weather half go unnoticed. VERIFIED rather than
     * asserted: of the 3,202 mid-game corpus boards walked above, 16 carry a terrain (0.50%) and 11
     * of those also have no weather; every one of the 22 positions scored on them is bit-identical
     * before and after. The 2 terrain positions that DID move are under rain and moved for the
     * weather. */
    terrain: M.terrainId(['psychicterrain', 'electricterrain', 'grassyterrain', 'mistyterrain']
      .find(t => board.hasField(t)) || ''),
    twA: board.hasSide(side, 'tailwind') ? 1 : 0,
    twB: board.hasSide(foe, 'tailwind') ? 1 : 0,
  };

  const mine = board.field().filter(f => f.side === side && f.mon && !f.mon.fainted);
  const theirs = board.field().filter(f => f.side === foe && f.mon && !f.mon.fainted);

  /* ---- material ------------------------------------------------------------------------------ */
  const aliveOf = (s) => {
    const party = (board.party && board.party[s]) || [];
    const dead = (board.graveyard && board.graveyard[s]) || new Set();
    return Math.max(0, party.length - dead.size);
  };
  const nMine = aliveOf(side), nTheirs = aliveOf(foe);
  set('aliveDiff', (nMine - nTheirs) / 4);
  const hpOf = arr => arr.reduce((a, f) => a + (typeof f.mon.hp === 'number' ? f.mon.hp : 1), 0);
  set('hpActiveDiff', (hpOf(mine) - hpOf(theirs)) / 2);
  set('hpTotalDiff', ((hpOf(mine) + Math.max(0, nMine - mine.length)) -
                      (hpOf(theirs) + Math.max(0, nTheirs - theirs.length))) / 4);

  /* ---- the race ------------------------------------------------------------------------------- */
  /* Each side's priority bar, computed once per position rather than per matchup. */
  const barMine = priorityRefusedAbove(board, foe, field);   // what THEY refuse, capping MY priority
  const barTheirs = priorityRefusedAbove(board, side, field);
  /* Actives are ESTABLISHED: they have had turns in which to mega, so they are read in their
   * attacking form. The base/mega split below applies to the BENCH, which has not arrived yet. */
  const mk = arr => arr.map(f => ({ f, m: monFor(board, f.side, f.mon.species, f.mon.hp, { mega: true }) }));
  const A = mk(mine), Dn = mk(theirs);
  let iKill = 0, theyKill = 0, myTurns = 0, theirTurns = 0, killFirst = 0, killedFirst = 0, speedWins = 0, pairs = 0;

  const slowFirst = board.hasField(B.GAME_RULES ? B.GAME_RULES.trickRoomField : 'trickroom') ||
                    board.hasField('trickroom');
  for (const a of A) {
    for (const d of Dn) {
      pairs++;
      /* Their remaining Pokemon, so a killing move can be judged on what it leaves you holding. */
      const theirBack = (board.bench(foe) || []).map(sp => monFor(board, foe, sp, 1)).filter(Boolean);
      const myBack = (board.bench(side) || []).map(sp => monFor(board, side, sp, 1)).filter(Boolean);
      const hit = bestHit(a.m, d.m, field, barMine, theirBack);
      const back = bestHit(d.m, a.m, field, barTheirs, myBack);
      if (hit.frac >= 1) iKill++;
      if (back.frac >= 1) theyKill++;
      myTurns += hit.frac > 0 ? Math.min(8, 1 / hit.frac) : 8;
      theirTurns += back.frac > 0 ? Math.min(8, 1 / back.frac) : 8;
      /* TWO DIFFERENT QUESTIONS, kept apart on purpose.
       *
       * speedEdge is "am I faster" in the ordinary sense -- effective speed with Choice Scarf,
       * Tailwind, paralysis, the weather abilities and Trick Room applied, in the +0 bracket. That is
       * a well-defined property of the two Pokemon.
       *
       * killFirstEdge is "do I remove it before it removes me", and THAT is where priority belongs:
       * it is decided on the move each side would actually throw to secure the kill, so a slow
       * Sucker Punch beats a fast neutral attack. Asking one number to mean both is what made the
       * first version compare a Pokemon's biggest move rather than its fastest lethal one. */
      if (movesFirst(a.m, null, 'A', d.m, null, 'B', field, slowFirst)) speedWins++;
      const killOrder = movesFirst(a.m, hit.killId, 'A', d.m, back.killId, 'B', field, slowFirst);
      if (hit.frac >= 1 && killOrder) killFirst++;
      if (back.frac >= 1 && !killOrder) killedFirst++;
    }
  }
  if (pairs) {
    set('iKillNext', iKill / pairs);
    set('theyKillNext', theyKill / pairs);
    set('raceEdge', Math.max(-1, Math.min(1, (theirTurns - myTurns) / (8 * pairs))));
    set('speedEdge', speedWins / pairs);
    set('killFirstEdge', (killFirst - killedFirst) / pairs);
  }

  /* ---- field --------------------------------------------------------------------------------- */
  set('trickRoom', slowFirst ? 1 : 0);
  set('weatherMine', board.weather ? (board.weatherOwner === side ? 1 : -1) : 0);
  set('terrainMine', 0);
  const sideHas = (s, k) => (board.hasSide(s, k) ? 1 : 0);
  set('tailwindDiff', sideHas(side, 'tailwind') - sideHas(foe, 'tailwind'));
  const screens = s => sideHas(s, 'reflect') + sideHas(s, 'lightscreen') + sideHas(s, 'auroraveil');
  set('screenDiff', (screens(side) - screens(foe)) / 3);

  /* ---- what is left in the back --------------------------------------------------------------- */
  const benchAnswers = (defSide, atkSide, defActives) => {
    let n = 0;
    for (const sp of (board.bench(atkSide) || [])) {
      /* Asking whether this can REMOVE something, which happens on a later turn — by then it has
       * mega evolved, so it is read in its attacking form. */
      const bm = monFor(board, atkSide, sp, 1, { mega: true });
      if (!bm) continue;
      for (const d of defActives) {
        if (d.m && bestHit(bm, d.m, field, priorityRefusedAbove(board, defSide, field)).frac >= 1) { n++; break; }
      }
    }
    return n;
  };
  set('benchAnswersDiff', (benchAnswers(foe, side, Dn) - benchAnswers(side, foe, A)) / 2);

  /* ---- PINNED, per side ------------------------------------------------------------------------
   * Three conditions, all of which must hold, because any one alone is ordinary:
   *   1. the active just STALLED — Protect and friends fail at a rising rate when repeated, so the
   *      escape has been spent. Read from the artifact's `stalling` family, not a named list.
   *   2. the hardest incoming hit REMOVES it — otherwise taking the hit is simply a turn.
   *   3. nothing in the back SURVIVES that hit — otherwise there is somewhere to go.
   * Together: every legal option loses a Pokemon. */
  const pinnedFor = (s, myActives, foeActives) => {
    let pinned = 0, n = 0;
    for (const a of myActives) {
      if (!a.m) continue;
      n++;
      const last = B.norm((a.f.mon && a.f.mon.lastMove) || '');
      let stalled = false;
      try { stalled = !!(last && TAGS.has('move', last, 'stalling')); } catch (e) {}
      if (!stalled) continue;
      let worst = 0;
      for (const d of foeActives) worst = Math.max(worst, bestHit(d.m, a.m, field, Infinity).frac);
      if (worst < 1) continue;                       // it survives the hit; not pinned
      /* Does anything in the back live through the same attack, at full health? */
      let refuge = false;
      for (const sp of (board.bench(s) || [])) {
        /* A refuge is a Pokemon that has to COME IN and survive the hit, and it arrives in BASE
         * form — switching costs the turn, so it cannot also mega that turn (Will). Reading it as
         * its mega here would invent bulk it does not have yet and hide a real pin. */
        const bm = monFor(board, s, sp, 1, { mega: false });
        if (!bm) continue;
        let w2 = 0;
        for (const d of foeActives) w2 = Math.max(w2, bestHit(d.m, bm, field, Infinity).frac);
        if (w2 < 1) { refuge = true; break; }
      }
      if (!refuge) pinned++;
    }
    return n ? pinned / n : 0;
  };
  set('pinnedDiff', pinnedFor(foe, Dn, A) - pinnedFor(side, A, Dn));
  set('turn', Math.min(1, (board.turn || 0) / 20));
  return x;
}

module.exports = { POSITION_FEATURES, POSITION_INDEX, positionFeatures, STATS };
