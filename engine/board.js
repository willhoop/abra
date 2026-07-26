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
 * NOTHING HERE IS A RULE ABOUT POKEMON (S13).
 * Every "this move cannot work right now" test reads a DATA FIELD off the Showdown dex —
 * `move.status`, `move.sideCondition`, `move.pseudoWeather`, `move.weather`, `move.stallingMove` —
 * and compares it to tracked state. There is no list of moves anywhere in this file. A move added by
 * a future regulation is handled without an edit, and a move whose failure condition is expressed as
 * code rather than data (Fake Out is the notable one) is simply NOT covered here, deliberately,
 * rather than covered by a hand-written special case. See the FAKE OUT note on turnsActive below.
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
  'eff4',         // 4x
  'eff2',         // 2x
  'effHalf',      // 0.5x
  'effQuarter',   // 0.25x
  'allyHit',      // the move also hits my OWN partner and my partner is not immune to it
  /* P(the target's ABILITY nullifies this move). Flash Fire eating Fire and Armor Tail refusing
   * priority are FACTS about the game, not judgements about value, so encoding them costs nothing
   * in ceiling. They are read from data/ability-blocks.json, which is measured from recorded
   * battles rather than typed, and weighted by Smogon's per-species ability odds — so this never
   * peeks at hidden information, it only knows what the population knows. */
  'abilityBlock',
  'immune',       // the target is outright immune — the move does literally nothing
  'stab',         // the move's type is one of the user's types
  'bp',           // base power / 100; 0 for status moves
  'isStatus',     // the move deals no damage
  'tgtHurt',      // 1 - target's HP fraction; a finishing blow scores differently from an opener
  'deadStatus',   // move.status set, but the target already carries a status -> it fails
  'deadSide',     // move.sideCondition already up on the user's side -> it fails
  'deadField',    // move.pseudoWeather already active -> it fails
  'deadWeather',  // move.weather already the active weather -> it fails
  'deadStall',    // move.stallingMove and the user stalled last turn -> it usually fails
  /* ---- STATS. FACTS THE MODEL COULD NOT SEE AT ALL UNTIL NOW ------------------------------------
   * Speed is a fact. So are Attack, Defence and HP. They sit in the dex for every species and none
   * of them were features, which is why this model could not learn any of the things it was
   * repeatedly asked about: it cannot learn that burn is worth more against a physical attacker
   * when it cannot see Attack, and it cannot learn what Tailwind is for when it cannot see Speed.
   * The judgement is still fitted — only the ingredients are supplied. Each is scaled so a value
   * near 0 means "typical for this format" and the sign carries the meaning. */
  'fasterThanTarget',  // 1 if the user outspeeds the target at base — who moves first
  'tgtPhysical',       // the target's Attack share of its two offences: is it a physical attacker
  'defMismatch',       // my attacking side against the target's WEAKER defence: am I hitting the soft side
  'tgtBulk',           // the target's HP x relevant defence, scaled: how much work it takes to remove
  'priorLogP',    // log of the behaviour clone's P(move | species). What the CURRENT bot uses alone.
];
const FEATURE_INDEX = Object.fromEntries(FEATURES.map((f, i) => [f, i]));

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
let _blocks = null, _abil = null;
function abilityTables() {
  if (_blocks !== null) return { blocks: _blocks, abil: _abil };
  const fs2 = require('fs'), p2 = require('path');
  const rd = f => { try { return JSON.parse(fs2.readFileSync(p2.join(__dirname, '..', 'data', f), 'utf8')); } catch (e) { return null; } };
  const b = rd('ability-blocks.json');
  _blocks = (b && b.abilities) || {};
  const sp = rd('smogon-priors.json');
  _abil = {};
  for (const [k, v] of Object.entries((sp && sp.species) || {})) {
    if (v && v.abilities) _abil[norm(k)] = v.abilities.map(a => [norm(a.ability), (+a.pct || 0) / 100]);
  }
  return { blocks: _blocks, abil: _abil };
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
  const m = cand.move;
  const t = cand.targetMon;
  const x = new Array(FEATURES.length).fill(0);
  const set = (name, v) => { x[FEATURE_INDEX[name]] = v; };

  const damaging = m.category !== 'Status' && m.basePower > 0;
  set('isStatus', damaging ? 0 : 1);
  set('bp', damaging ? Math.min(2.5, (m.basePower || 0) / 100) : 0);

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
      set('fasterThanTarget', ub.spe > tb.spe ? 1 : 0);
      const off = tb.atk + tb.spa;
      if (off) set('tgtPhysical', (tb.atk - tb.spa) / off);
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

  /* ---- WOULD AN ABILITY SIMPLY EAT IT? ------------------------------------------------------- */
  {
    const list = cand.spread && cand.spread.length ? cand.spread : (t ? [t] : []);
    if (list.length) {
      let pSum = 0;
      for (const h of list) pSum += abilityBlockProb(m, h.species, mType, user.species);
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
      if (!aTypes.length || !dex.getImmunity(mType, aTypes)) continue;   // immune partner: it is free
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
  return out;
}

module.exports = { FEATURES, FEATURE_INDEX, PRIOR_FLOOR, Board, featuresFor, candidates, noteMove, fieldKey, moveType, abilityBlockProb, norm, baseSpecies, SELF_TARGETS };
