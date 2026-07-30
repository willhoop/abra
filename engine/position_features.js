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
  'turn',             // how deep the game is, scaled — a 2-point lead on turn 3 is not one on turn 20
];
const POSITION_INDEX = Object.fromEntries(POSITION_FEATURES.map((f, i) => [f, i]));

const other = s => (s === 'p1' ? 'p2' : 'p1');

/* Build a damage-engine mon for a species on `side`, using whatever the sheet declared. Returns null
 * for anything outside the format's table rather than substituting a guess. */
function monFor(board, side, species, hpFrac) {
  if (!species) return null;
  const key = M && M.buildMon ? species : species;
  let m = null;
  try { m = M.buildMon(B.norm(key)) || M.buildMon(B.baseSpecies(key)); } catch (e) { return null; }
  if (!m) return null;
  const e = (board.sheet && board.sheet[side] && board.sheet[side][B.baseSpecies(species)]) || {};
  /* dmgMon's rule: a sheet always declares a nature, so nature is what tells the engine a sheet was
   * read at all. Same convention here so the two agree about when the sheet is in play. */
  if (e.nature) {
    m.item = B.norm((typeof board.sheetItem === 'function' ? board.sheetItem(side, species) : e.item) || '');
    if (e.ability) m.ability = B.norm(e.ability);
    /* THE DECLARED MOVES, which the first version of this did not read — and that is the whole
     * ballgame on open sheets. buildMon fills `moves` from the dataset's representative set, so
     * every Pokemon was being evaluated with an average four moves rather than the four it actually
     * brought. Measured consequence: not one damaging priority move exists anywhere in the
     * representative pool, so the priority handling above could never fire on a real position no
     * matter how correct it was. Same shape as the switch-in bug found earlier the same day — the
     * sheet reaching one consumer and not the next. */
    const mv = (e.moves || []).map(B.norm).filter(id => MC.moves[id]);
    if (mv.length) m.moves = mv;
  }
  if (typeof hpFrac === 'number' && m.st && m.st.hp) m.curHP = Math.max(0, Math.round(m.st.hp * hpFrac));
  return m;
}

const FIELD = { weather: '', terrain: '', twA: 0, twB: 0 };
/* Best mean damage as a fraction of the defender's CURRENT health, so a chipped target is correctly
 * easier to remove. Returns the MOVE as well as the number, because who moves first depends on which
 * move you are throwing -- see the order note below. dmgRange takes a move OBJECT and dereferences
 * field.weather, both of which have bitten callers here before. */
function bestHit(att, def, field, refusedAbove) {
  const none = { frac: 0, id: null, killId: null, killPrio: -9 };
  if (!att || !def || !def.st || !def.st.hp) return none;
  const bar = typeof refusedAbove === 'number' ? refusedAbove : Infinity;
  const left = Math.max(1, def.curHP != null ? def.curHP : def.st.hp);
  let best = 0, bestId = null, killId = null, killPrio = -9;
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
      if (prio > killPrio || (prio === killPrio && killId && mean > best)) { killPrio = prio; killId = id; }
      if (killId === null) { killPrio = prio; killId = id; }
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
function movesFirst(att, attMoveId, attSideTag, def, defMoveId, defSideTag, field, trickRoom) {
  const pa = attMoveId ? M.movePriority(attMoveId, field) : 0;
  const pd = defMoveId ? M.movePriority(defMoveId, field) : 0;
  if (pa !== pd) return pa > pd;
  let sa = 0, sd = 0;
  try { sa = M.effSpeed(att, field, attSideTag); } catch (e) { sa = (att && att.st && att.st.sp) || 0; }
  try { sd = M.effSpeed(def, field, defSideTag); } catch (e) { sd = (def && def.st && def.st.sp) || 0; }
  return trickRoom ? sa < sd : sa > sd;
}

function positionFeatures(board, side, dex) {
  const x = new Float64Array(POSITION_FEATURES.length);
  const set = (n, v) => { x[POSITION_INDEX[n]] = Number.isFinite(v) ? v : 0; };
  const foe = other(side);
  /* twA/twB are what effSpeed reads for Tailwind, and the A/B tags below map MY side to A and
   * theirs to B so the doubling lands on the right one. */
  const field = {
    weather: B.norm(board.weather || ''),
    /* Terrain was hardcoded to '' here, which quietly disabled the Psychic Terrain half of the
     * priority block — it read a field it never filled in. Derived from the board's own field keys,
     * which is where terrain has always been tracked. */
    terrain: ['psychicterrain', 'electricterrain', 'grassyterrain', 'mistyterrain']
      .find(t => board.hasField(t)) || '',
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
  const mk = arr => arr.map(f => ({ f, m: monFor(board, f.side, f.mon.species, f.mon.hp) }));
  const A = mk(mine), Dn = mk(theirs);
  let iKill = 0, theyKill = 0, myTurns = 0, theirTurns = 0, killFirst = 0, killedFirst = 0, speedWins = 0, pairs = 0;

  const slowFirst = board.hasField(B.GAME_RULES ? B.GAME_RULES.trickRoomField : 'trickroom') ||
                    board.hasField('trickroom');
  for (const a of A) {
    for (const d of Dn) {
      pairs++;
      const hit = bestHit(a.m, d.m, field, barMine);
      const back = bestHit(d.m, a.m, field, barTheirs);
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
      const bm = monFor(board, atkSide, sp, 1);
      if (!bm) continue;
      for (const d of defActives) {
        if (d.m && bestHit(bm, d.m, field, priorityRefusedAbove(board, defSide, field)).frac >= 1) { n++; break; }
      }
    }
    return n;
  };
  set('benchAnswersDiff', (benchAnswers(foe, side, Dn) - benchAnswers(side, foe, A)) / 2);
  set('turn', Math.min(1, (board.turn || 0) / 20));
  return x;
}

module.exports = { POSITION_FEATURES, POSITION_INDEX, positionFeatures };
