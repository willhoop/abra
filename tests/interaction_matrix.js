/* THE GENERATED INTERACTION MATRIX — the cross product, enumerated rather than sampled.
 *
 *   node tests/interaction_matrix.js            print the matrix and every drop, run nothing
 *   node tests/interaction_matrix.js --full     no depth cap
 *
 * It is a GENERATOR ONLY. It authors no expected outcome and it runs no engine. The runner is
 * `tests/test-game-diff.js --matrix`, which plays every case in medicham2 AND in the official pinned
 * Showdown engine and lets the official engine supply the truth.
 *
 * Will, 2026-08-04: *"Basically all the tags on moves and stuff should trigger all the flags on
 * abilities and types and etc and have it flow from there"* and *"the interactions should be pretty
 * formulaic now that we have all the tags and such."* He is right that it is formulaic. This file is
 * the formula.
 *
 * FOUR THINGS A GENERATED CASE MUST KNOW, and each of them was got wrong by the sampled version this
 * replaces (tests/test-game-diff.js --pairs, 82 pairs):
 *
 * 1. WHICH SIDE THE REACTOR STANDS ON. `linkage.contact.abilities` holds Rough Skin AND Tough Claws.
 *    Rough Skin reacts to being hit by a contact move; Tough Claws boosts the holder's OWN contact
 *    moves. The sampled version staged every reactor on the DEFENDER, so every attacker-side ability
 *    in the index was a case in which the mechanic could not fire at all -- and it read as agreement.
 *    `sideOf()` derives the side from the reactor's own tags and REFUSES to guess: a reactor whose
 *    tags do not decide it is dropped as `side-unknown` and named.
 *
 * 2. WHICH RESOLUTION LAYER IT TESTS. docs/TAGS.md 92: Legality -> Targeting -> Immunity -> Damage ->
 *    Secondary, and *"the stage a mechanic resolves at determines what failure looks like"*. A case
 *    that does not know its layer cannot tell "correctly blocked" from "silently absent". The layer
 *    also decides WHICH INSTRUMENT can judge it: the state comparator cannot see a DAMAGE layer case
 *    at all, because an HP amount is a die (trap 2 in the runner). Those are emitted with
 *    `evaluator: 'damage'` and judged by a RATIO instead -- see the runner.
 *
 * 3. WHETHER THE PAIR CAN ACTUALLY MEET. A Volt Absorb case staged on a Garchomp tests nothing: the
 *    body is Ground and takes zero from Electric with no ability at all. That exact mistake has been
 *    made twice by hand in this project (tests/test-tag-wire.js, and the redirection false alarm).
 *    It is now a GENERATED CONSTRAINT: `holderFor()` refuses a holder the type chart already makes
 *    immune, and the drop is counted.
 *
 * 4. WHAT WAS DROPPED. Every case the generator refuses to emit is counted under a named reason and
 *    printed. A silent cap reads as "covered everything", which is this project's signature failure.
 */
'use strict';
require('../engine/showdown_path.js');
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const tags = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE FIVE LAYERS, AND WHICH TAG RESOLVES AT WHICH ------------------------------------------
 *
 * From docs/TAGS.md's table, not invented here. The map is BY TAG, so an ability added next
 * regulation that carries `typeImmunity` is classified without an edit -- and a tag that is NOT in
 * this map is reported as `layer-unclassified` and DROPPED rather than defaulted into a layer, because
 * a silent default here would put a case in front of an evaluator that cannot judge it. */
const LAYER_OF_TAG = {
  /* 1 — LEGALITY: may this be chosen at all? Failure looks like: removed from the menu. */
  blocksMove: 'legality', blocksStatusMoves: 'legality', refusesStatusMoves: 'legality',
  forbidsStatusMoves: 'legality', sealsMoves: 'legality', blocksSoundMoves: 'legality',
  blocksExplosion: 'legality', failsIfTargetNotAttacking: 'legality', needsTargetToAttack: 'legality',
  cantUseTwice: 'legality', priorityMod: 'legality', fractionalPriority: 'legality',
  /* 2 — TARGETING: who does it actually hit? Failure looks like: retargeted, or not retargeted. */
  redirects: 'targeting', redirectsType: 'targeting', reflectsStatusMoves: 'targeting',
  /* 3 — IMMUNITY: does it connect? Failure looks like: zero damage. */
  typeImmunity: 'immunity', immuneToMoveClass: 'immunity', statusImmune: 'immunity',
  /* 4 — DAMAGE: how much? Failure looks like: a different number. The state comparator is BLIND to
   * this entire layer by construction, which is why it gets its own evaluator. */
  halvesTypeDamage: 'damage', damageReduce: 'damage', resistBerry: 'damage', damageBoost: 'damage',
  damageMultType: 'damage', boostsMoveClass: 'damage', auraBoost: 'damage',
  convertsMoveType: 'damage', hitsTwice: 'damage', halvesDamage: 'damage', reducesAllyDamage: 'damage',
  preventsCrit: 'damage', survivesFromFull: 'damage', damageBoostFlag: 'damage',
  /* 5 — SECONDARY: what else happens? Failure looks like: the effect is suppressed. */
  contactPunish: 'secondary', punishesAttacker: 'secondary', punishesContact: 'secondary',
  poisonsOnMyContact: 'secondary', buffsHolderOnHit: 'secondary', disablesAttacker: 'secondary',
  formeChange: 'secondary', weatherChipImmune: 'secondary', statusInflict: 'secondary',
  inflictsPoison: 'secondary', inflictsBurn: 'secondary', flinches: 'secondary',
  writesAccuracy: 'secondary', accuracyMod: 'secondary', perTurnHP: 'secondary',
};
/* Tags that say nothing about the interaction and must not decide a layer or a side on their own.
 * `statusCategory`, `priority`, `neverMisses` are properties of every status move ever written. */
const INERT_TAGS = new Set(['statusCategory', 'neverMisses', 'priority', 'stalling', 'contact',
  'sound', 'punch', 'bullet', 'powder', 'wind', 'slicing', 'bite', 'heal', 'statChange', 'boostsUser',
  'setsTerrain', 'setsWeather', 'dualPurpose', 'untagged',
  /* `moveClass` says WHICH FLAGS A MOVE CARRIES. On a reactor it is a description of the reactor's own
   * move, not of anything it does to the incoming one -- Beak Blast carries it and its actual
   * mechanic is the burn. Left in the layer map it classified Beak Blast as a DAMAGE case and sent it
   * to the wrong evaluator. */
  'moveClass']);

/* ---- WHICH SIDE THE REACTOR STANDS ON ----------------------------------------------------------
 *
 * DEFENDER means: the mechanic fires because the holder was AIMED AT. ATTACKER means: the mechanic
 * fires because the holder CLICKED the carrier. Both are legitimate members of `linkage.contact`, and
 * conflating them is what made the sampled matrix stage Tough Claws, Long Reach, Unseen Fist, Iron
 * Fist, Sharpness, Strong Jaw, Punk Rock and Poison Touch on the body that could not use them. */
const SIDE_OF_TAG = {
  typeImmunity: 'def', immuneToMoveClass: 'def', halvesTypeDamage: 'def', damageReduce: 'def',
  resistBerry: 'def', contactPunish: 'def', punishesAttacker: 'def', punishesContact: 'def',
  buffsHolderOnHit: 'def', disablesAttacker: 'def', blocksMove: 'def', blocksStatusMoves: 'def',
  refusesStatusMoves: 'def', redirectsType: 'def', redirects: 'def', reflectsStatusMoves: 'def',
  statusImmune: 'def', preventsCrit: 'def', formeChange: 'def', survivesFromFull: 'def',
  reducesAllyDamage: 'def', halvesDamage: 'def', blocksSoundMoves: 'def', sealsMoves: 'def',
  weatherChipImmune: 'def',
  damageBoost: 'atk', boostsMoveClass: 'atk', convertsMoveType: 'atk', poisonsOnMyContact: 'atk',
  hitsTwice: 'atk', writesAccuracy: 'atk', accuracyMod: 'atk', auraBoost: 'atk', priorityMod: 'atk',
  fractionalPriority: 'atk', damageMultType: 'atk', blocksExplosion: 'def',
};

/* A reactor's tags, its layer and its side, all from the artifact. Returns nulls the caller must
 * handle -- never a default. */
function classify(kind, id) {
  const bag = kind === 'ability' ? tags.abilities : kind === 'item' ? tags.items : tags.moves;
  const rec = bag[id] || {};
  const own = (rec.tags || []).filter(t => !INERT_TAGS.has(t));
  const layers = [...new Set(own.map(t => LAYER_OF_TAG[t]).filter(Boolean))];
  const sides = [...new Set(own.map(t => SIDE_OF_TAG[t]).filter(Boolean))];
  /* THE EARLIEST LAYER WINS, because resolution is ordered and an earlier stage short-circuits a
   * later one -- docs/TAGS.md: "an immune target takes nothing, not the damage and not the
   * secondary". Lightning Rod is targeting AND immunity AND secondary; the case is a TARGETING case. */
  const order = ['legality', 'targeting', 'immunity', 'damage', 'secondary'];
  const layer = order.find(l => layers.includes(l)) || null;
  const side = sides.length === 1 ? sides[0] : (sides.includes('def') ? 'def' : null);
  return { tags: own, layer, side, params: rec.params || {} };
}

/* ---- BODIES, CACHED ---------------------------------------------------------------------------- */
const SPECIES = dex.species.all().filter(s => s.exists && !s.isNonstandard && !s.forme
  && !!M.buildMon(norm(s.id), {}));                      /* must exist in BOTH engines' tables */
const learnsetCache = new Map();
function learns(sp, moveId) {
  let ls = learnsetCache.get(sp.id);
  if (ls === undefined) { const d = dex.species.getLearnsetData(sp.id); ls = (d && d.learnset) || {}; learnsetCache.set(sp.id, ls); }
  return !!ls[moveId];
}
const typesOf = sp => sp.types;
/* The type chart's own answer, so the constraint is derived rather than a list of weaknesses. */
function effectiveness(moveType, defTypes) {
  if (!moveType) return 1;
  let mult = 1;
  for (const t of defTypes) {
    const im = dex.getImmunity(moveType, t);
    if (!im) return 0;
    const e = dex.getEffectiveness(moveType, t);
    mult *= Math.pow(2, e);
  }
  return mult;
}

const usersCache = new Map();
function usersOf(moveId) {
  if (!usersCache.has(moveId)) usersCache.set(moveId, SPECIES.filter(s => learns(s, moveId)));
  return usersCache.get(moveId);
}
const abilityCache = new Map();
function speciesWithAbility(abilityId) {
  if (!abilityCache.has(abilityId))
    abilityCache.set(abilityId, SPECIES.filter(s => Object.values(s.abilities).some(a => norm(a) === abilityId)));
  return abilityCache.get(abilityId);
}

/* ---- THE DROP LEDGER --------------------------------------------------------------------------- */
function ledger() {
  const c = {};
  return { add(reason, what) { (c[reason] = c[reason] || { n: 0, eg: [] }).n++;
             if (c[reason].eg.length < 4) c[reason].eg.push(what); return null; },
           counts: c };
}

/* ---- FILLERS ----------------------------------------------------------------------------------- */
/* A body standing in a case must ACT without changing the thing under test. Helping Hand is ideal --
 * it aims at the ally, deals nothing, and its volatile is in neither engine's compared set. */
const FILLERS = ['Helping Hand', 'Bulk Up', 'Calm Mind', 'Iron Defense', 'Agility', 'Protect'];
function fillerFor(sp) { for (const f of FILLERS) if (learns(sp, norm(f))) return f; return 'Protect'; }
/* The CONTROL ability. Honey Gather has no battle handler at all in gen 9, in either engine -- which
 * is the whole requirement. Naming a real inert ability rather than '' keeps both engines on the same
 * code path, so the control arm is not also a different-shaped call. */
const CONTROL_ABILITY = 'Honey Gather';

/* ---- CO-OCCURRENCE: CAN THIS PAIR ACTUALLY MEET? -----------------------------------------------
 *
 * Returns a holder that can SHOW the effect, or null with the reason logged. */
function holderFor(cls, reactorId, kind, moveId, log, label) {
  const mv = dex.moves.get(moveId);
  const pool = kind === 'ability' ? speciesWithAbility(reactorId) : SPECIES;
  if (!pool.length) return log.add('no-holder: no species in MC.mons has the ability', label);
  const wantSE = kind === 'item' && cls.params.resistBerry && cls.params.resistBerry.requiresSuperEffective;
  const berryType = cls.params.resistBerry && cls.params.resistBerry.onType;
  const cands = pool.filter(sp => {
    const eff = effectiveness(mv.type, typesOf(sp));
    /* THE GARCHOMP RULE. A body the type chart already makes immune cannot show a typeImmunity, a
     * halving, a resist berry or a contact punish -- nothing lands on it in EITHER arm. */
    if (mv.category !== 'Status' && eff === 0) return false;
    if (wantSE && (norm(mv.type) !== norm(berryType) || eff <= 1)) return false;
    return true;
  });
  if (!cands.length) return log.add(wantSE
    ? 'not-super-effective: the resist berry only fires on a super-effective hit of its own type'
    : 'holder-immune-by-chart: every candidate body already takes zero from this move type', label);
  return bulkiest(cands);
}
/* THE BULKIEST CANDIDATE, AND IT IS NOT COSMETIC. The damage evaluator divides one arm by the other,
 * and a control arm that already dealt 100% of the target's HP has its "damage" clamped at max HP --
 * a halving then reads as 1.0 and the engine is scored correct on a number nobody measured. Taking the
 * first candidate species left 32 of 120 type-axis cases saturated and therefore unjudgeable. Bulk is
 * the one staging knob that buys signal without changing the mechanic under test. */
const bulkiest = pool => pool.slice().sort((a, b) =>
  (b.baseStats.hp + b.baseStats.def + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd))[0] || null;

/* ---- DETERMINISM, ENFORCED AT GENERATION ------------------------------------------------------- */
function moveIsDeterministic(mv) {
  if (!mv.exists) return 'move does not exist';
  if (mv.accuracy !== true && mv.accuracy < 100) return 'accuracy ' + mv.accuracy;
  if ((mv.secondaries || []).some(s => s.chance != null && s.chance < 100)) return 'chance secondary';
  if (mv.multiaccuracy) return 'per-hit accuracy';
  return null;
}
const NEEDS_FOE = new Set(['normal', 'any', 'adjacentFoe']);
/* A reactor whose OWN effect is a die. Static paralyses 30% of the time; comparing it is comparing
 * luck. Read out of the param, never off a list of names. */
function reactorIsChancy(cls) {
  for (const t of ['punishesAttacker', 'poisonsOnMyContact', 'disablesAttacker', 'contactPunish', 'buffsHolderOnHit']) {
    const p = cls.params[t];
    if (!p) continue;
    if (p.chance != null || p.p != null) return true;
    if (Array.isArray(p.inflicts) && p.inflicts.length) return true;
    /* THE CHANCE IS ONE LEVEL DOWN ON THE ONE THAT MATTERS. Cute Charm's param is
     * `inflictsVolatile: {volatile:'attract', chance:0.3}` -- a flat top-level read misses it, the
     * pair is generated, the pinned dice make the 30% never fire, and the case reads INERT for a
     * reason that has nothing to do with the engine. */
    if (p.inflictsVolatile && p.inflictsVolatile.chance != null && p.inflictsVolatile.chance < 1) return true;
  }
  return false;
}
/* A reactor that moves ACCURACY cannot be judged by a damage RATIO: with the dice pinned
 * deterministically, Hustle's 0.8 accuracy multiplier turns every physical move into a guaranteed
 * MISS, so the ratio reads 0.000 and looks like a damage bug. Two mechanics on one ability, and the
 * one that is not under test wins. Named rather than folded into the tolerance. */
const movesAccuracy = cls => !!(cls.params.writesAccuracy || cls.params.accuracyMod);

/* ================================================================================================
 * AXIS 1 — FLAG.  a move that CARRIES a flag  x  everything that REACTS to that flag.
 * ============================================================================================= */
function axisFlag(depth, log) {
  const cases = [];
  for (const [key, v] of Object.entries(tags.linkage)) {
    if (key === 'moveType') continue;                       /* its own axis, below */
    const carriers = (v.carrierMoves || []);
    if (!carriers.length) { if ((v.abilities || []).length) log.add('no-carrier: the linkage key has reactors but no carrier moves', key); continue; }
    const reactors = [
      ...(v.abilities || []).map(x => ({ ...x, kind: 'ability' })),
      ...(v.items || []).map(x => ({ ...x, kind: 'item' })),
      ...(v.reactorMoves || []).map(x => ({ ...x, kind: 'move' })),
    ];
    for (const r of reactors) {
      const cls = classify(r.kind, r.id);
      const label = key + ' x ' + r.kind + ':' + r.id;
      if (!cls.layer) { log.add('layer-unclassified: no tag on the reactor maps to a resolution stage', label + ' [' + cls.tags.join(',') + ']'); continue; }
      if (cls.side !== 'def' && r.kind !== 'move') {
        if (!cls.side) { log.add('side-unknown: the reactor tags do not say which side it stands on', label + ' [' + cls.tags.join(',') + ']'); continue; }
        /* An ATTACKER-side reactor is still a real interaction -- it is generated with the roles
         * swapped rather than dropped. */
      }
      if (reactorIsChancy(cls)) { log.add('reactor-is-a-die: its own effect fires on a percentage', label); continue; }
      if (cls.layer === 'damage' && movesAccuracy(cls)) { log.add('reactor-also-moves-accuracy: a damage RATIO would be measuring a miss, not a multiplier', label); continue; }
      /* REACTOR-LEVEL FEASIBILITY IS ASKED ONCE, NOT ONCE PER CARRIER. Iron Barbs, Tangling Hair,
       * Lingering Aroma and Perish Body have ZERO species in this format at all -- Champions marks
       * their carriers `isNonstandard: 'Past'` -- so the pair genuinely cannot occur. Asked inside the
       * carrier loop it logged 146 drops for one absent ability and made the ledger unreadable. */
      if (r.kind === 'ability' && !speciesWithAbility(r.id).length) {
        log.add('reactor-not-in-format: no species in this format has the ability at all', label); continue;
      }
      if (r.kind === 'move' && !usersOf(r.id).length) {
        log.add('reactor-not-in-format: no species in this format learns the reactor move', label); continue;
      }
      if (cls.side === 'atk' && !carriers.some(c => (r.kind === 'ability' ? speciesWithAbility(r.id) : SPECIES).some(sp => learns(sp, c.id)))) {
        log.add('reactor-cannot-carry: no body both has the attacker-side reactor and learns ANY carrier of this flag', label); continue;
      }
      let made = 0;
      for (const c of carriers) {
        if (made >= depth) { log.add('depth-cap: carriers beyond --depth for this (key,reactor)', label); break; }
        const mv = dex.moves.get(c.id);
        const nd = moveIsDeterministic(mv);
        if (nd) { log.add('carrier-is-a-die: ' + nd, key + ' ' + c.id); continue; }
        if (!NEEDS_FOE.has(mv.target)) { log.add('carrier-does-not-aim-at-a-foe: target=' + mv.target, key + ' ' + c.id); continue; }
        const users = usersOf(c.id);
        if (!users.length) { log.add('no-user: no species in MC.mons learns the carrier move', key + ' ' + c.id); continue; }
        if (cls.layer === 'damage' && !ratioCanMeasure(c.id)) { log.add('carrier-unmeasurable-by-ratio: a residual or a multi-hit lands in the same HP delta as the multiplier', key + ' ' + c.id); continue; }
        if (r.kind === 'move') {
          /* A REACTOR MOVE IS CLICKED, NOT HELD, so its control cannot be "remove the ability" --
           * the control varies the CARRIER instead: the same body clicks a move of the same category
           * that does NOT carry the flag. Spiky Shield punishes Wave Crash and not Surf. */
          const holder = usersOf(r.id).find(sp => effectiveness(mv.type, typesOf(sp)) !== 0
            || mv.category === 'Status');
          if (!holder) { log.add('no-holder: no species in MC.mons learns the reactor move on a body this carrier can reach', label); continue; }
          const user = users[0];
          const ctl = controlCarrier(key, mv, user, log, label);
          if (!ctl) continue;
          cases.push(mkCase({ axis: 'flag', key, layer: cls.layer, evaluator: evaluatorFor(cls.layer),
            carrier: { kind: 'move', id: c.id, name: mv.name, uses: c.uses || 0, user: user.name },
            control: { kind: 'carrier', id: norm(ctl.name), name: ctl.name },
            reactor: { kind: 'move', id: r.id, name: dex.moves.get(r.id).name, holder: holder.name, side: 'def' } }));
          made++; continue;
        }
        const side = cls.side === 'atk' ? 'atk' : 'def';
        let user = users[0], holder;
        if (side === 'atk') {
          /* THE HOLDER OF AN ATTACKER-SIDE ABILITY MUST BE THE ONE CLICKING. Tough Claws on the
           * defender is a case in which nothing can happen. */
          const pool = r.kind === 'ability' ? speciesWithAbility(r.id) : SPECIES;
          user = pool.find(sp => learns(sp, c.id));
          if (!user) { log.add('no-user: no body both has the attacker-side reactor and learns the carrier', label + ' ' + c.id); continue; }
          holder = SPECIES.find(sp => effectiveness(mv.type, typesOf(sp)) > 0 && sp.id !== user.id);
          if (!holder) { log.add('no-holder: no legal target for the carrier', label + ' ' + c.id); continue; }
        } else {
          holder = holderFor(cls, r.id, r.kind, c.id, log, label + ' ' + c.id);
          if (!holder) continue;
        }
        cases.push(mkCase({ axis: 'flag', key, layer: cls.layer, evaluator: evaluatorFor(cls.layer),
          carrier: { kind: 'move', id: c.id, name: mv.name, uses: c.uses || 0, user: user.name },
          control: { kind: r.kind === 'item' ? 'item' : 'ability', id: r.kind === 'item' ? '' : norm(CONTROL_ABILITY), name: r.kind === 'item' ? '(no item)' : CONTROL_ABILITY },
          reactor: { kind: r.kind, id: r.id, name: r.name, holder: holder.name, side } }));
        made++;
      }
    }
  }
  return cases;
}

/* The control carrier for a reactor-MOVE case: same category, same user, WITHOUT the flag. */
function controlCarrier(flagKey, mv, user, log, label) {
  const flagged = new Set((tags.linkage[flagKey].carrierMoves || []).map(x => x.id));
  const cand = Object.keys(tags.moves).filter(id => {
    if (flagged.has(id)) return false;
    const m = dex.moves.get(id);
    if (!m.exists || m.category !== mv.category) return false;
    if (moveIsDeterministic(m)) return false;
    if (!NEEDS_FOE.has(m.target)) return false;
    return learns(user, id);
  });
  if (!cand.length) return log.add('no-control-carrier: the user has no flagless move of the same category', label);
  return dex.moves.get(cand[0]);
}

const evaluatorFor = layer => (layer === 'damage' ? 'damage' : 'state');

/* A CARRIER THE DAMAGE RATIO CANNOT MEASURE, and each of the three was found by the ratio reporting a
 * confident wrong number rather than by reasoning:
 *
 *   perTurnHP / partialTrap — the ratio is read off END-OF-TURN HP, and Salt Cure and Infestation add
 *     a RESIDUAL that no resist berry touches. `saltcure -> chartiberry` read 0.891 against a true
 *     0.5 because five sixteenths of the loss was the salt, not the hit.
 *   multiHit — the berry is a ONE-SHOT and is eaten on hit 1, so Twin Beam's true ratio is (0.5+1)/2
 *     = 0.75 and medicham2's dmgRange, which prices one hit by design, says 0.5. That is a REAL
 *     unmodelled interaction (resistBerry x multiHit) and it is recorded as one in docs/ENGINE.md
 *     rather than scored here, because this evaluator would report it against every one-shot item and
 *     every multi-hit move as if they were separate bugs.
 *
 * Excluded from the DAMAGE evaluator only. A multi-hit carrier is still generated on every other
 * layer, where the hit count is not what is being read. */
const UNMEASURABLE_BY_RATIO = ['perTurnHP', 'partialTrap', 'multiHit'];
const ratioCanMeasure = moveId => !((tags.moves[moveId] || {}).tags || []).some(t => UNMEASURABLE_BY_RATIO.includes(t));

let _id = 0;
function mkCase(o) { return { id: ++_id, ...o }; }

/* ================================================================================================
 * AXIS 2 — TYPE.  a move OF a type  x  everything that reacts to that type.
 *
 * `linkage.moveType.carrierMoves` is EMPTY and always was: the carrier of a move type is not a listed
 * move, it is every move of that type. So the sampled matrix generated ZERO cases here -- and this is
 * the axis that holds Volt Absorb, Flash Fire, Sap Sipper, Levitate, Earth Eater, Storm Drain, Thick
 * Fat, Heatproof, Dry Skin, Water Absorb and all eighteen resist berries. The type is read out of the
 * reactor's OWN param (`typeImmunity.type`, `halvesTypeDamage.types`, `resistBerry.onType`), which is
 * why this is a loop and not a table.
 * ============================================================================================= */
/* Returns `[{type, tag}]`. THE TAG THAT NAMED THE TYPE IS THE TAG THE CASE IS ABOUT, and carrying it
 * back is what fixes the layer.
 *
 * `classify()` takes the EARLIEST layer across all the reactor's tags, which is right in general --
 * an earlier stage short-circuits a later one -- and wrong for a reactor that does two unrelated
 * things. Water Bubble carries `statusImmune` (IMMUNITY) and `halvesTypeDamage` (DAMAGE). Against a
 * Fire move the case is a DAMAGE case, but the earliest-layer rule sent it to the state evaluator,
 * which is blind to damage, and all fourteen Water Bubble cases came back INERT -- covered-looking and
 * testing nothing. The type param says which mechanic put this pair in the matrix; use it. */
function typesReactedTo(cls) {
  /* KEYED ON type+tag, NOT ON type. Lightning Rod reacts to Electric TWICE and in two different
   * layers -- `typeImmunity` (stage 3) and `redirectsType` (stage 2) -- and a map keyed on the type
   * alone kept whichever was added first and silently dropped the redirection case. That is the whole
   * TARGETING layer disappearing from the matrix because of a de-duplication key. */
  const out = new Map();
  const add = (t, tag) => { if (t && !out.has(t + '|' + tag)) out.set(t + '|' + tag, { type: t, tag }); };
  const p = cls.params;
  if (p.typeImmunity) add(p.typeImmunity.type, 'typeImmunity');
  if (p.redirectsType) add(p.redirectsType.type, 'redirectsType');
  if (p.halvesTypeDamage) {
    for (const t of (p.halvesTypeDamage.types || [])) add(t, 'halvesTypeDamage');
    for (const t of (p.halvesTypeDamage.basePowerTypes || [])) add(t, 'halvesTypeDamage');
  }
  if (p.resistBerry) add(p.resistBerry.onType, 'resistBerry');
  if (p.damageBoost) add(p.damageBoost.onType, 'damageBoost');
  if (p.damageMultType) add(p.damageMultType.type, 'damageMultType');
  /* THE -ATE ABILITIES REACT TO A TYPE THE PARAM NAMES IN PROSE. Pixilate, Refrigerate, Galvanize,
   * Aerilate and Dragonize all read `converts: "Normal moves"`, so the carrier is a NORMAL move. Read
   * out of the param rather than assumed, and a `converts` this cannot parse leaves the reactor with
   * no type and it is dropped LOUDLY as `no-type-param` -- which is where Justified, Wind Power,
   * Thermal Exchange and Water Compaction land, because the artifact genuinely does not record which
   * type they answer to. That is a tag_dex gap and it is reported as one. */
  if (p.convertsMoveType && p.convertsMoveType.converts) {
    const m = /^([A-Z][a-z]+)\s+moves$/.exec(String(p.convertsMoveType.converts));
    if (m) add(m[1], 'convertsMoveType');
  }
  return [...out.values()];
}
/* The most-clicked damaging moves of a type, from the corpus counts the artifact already carries, so
 * the choice of carrier is ranked rather than picked. */
const byTypeCache = new Map();
function movesOfType(type) {
  const k = norm(type);
  if (!byTypeCache.has(k)) {
    const rows = Object.keys(tags.moves).map(id => ({ id, uses: tags.moves[id].uses || 0, m: dex.moves.get(id) }))
      .filter(r => r.m.exists && norm(r.m.type) === k && r.m.category !== 'Status'
        && NEEDS_FOE.has(r.m.target) && !moveIsDeterministic(r.m));
    rows.sort((a, b) => b.uses - a.uses);
    byTypeCache.set(k, rows);
  }
  return byTypeCache.get(k);
}
function axisType(depth, log) {
  const cases = [];
  const v = tags.linkage.moveType || { abilities: [], items: [] };
  const reactors = [...(v.abilities || []).map(x => ({ ...x, kind: 'ability' })),
                    ...(v.items || []).map(x => ({ ...x, kind: 'item' }))];
  for (const r of reactors) {
    const cls = classify(r.kind, r.id);
    const label = 'moveType x ' + r.kind + ':' + r.id;
    if (!cls.layer) { log.add('layer-unclassified: no tag on the reactor maps to a resolution stage', label + ' [' + cls.tags.join(',') + ']'); continue; }
    const types = typesReactedTo(cls);
    if (!types.length) { log.add('no-type-param: the reactor is in the moveType index but no param names a type', label + ' [' + cls.tags.join(',') + ']'); continue; }
    if (!cls.side) { log.add('side-unknown: the reactor tags do not say which side it stands on', label + ' [' + cls.tags.join(',') + ']'); continue; }
    if (reactorIsChancy(cls)) { log.add('reactor-is-a-die: its own effect fires on a percentage', label); continue; }
    if (cls.layer === 'damage' && movesAccuracy(cls)) { log.add('reactor-also-moves-accuracy: a damage RATIO would be measuring a miss, not a multiplier', label); continue; }
    if (r.kind === 'ability' && !speciesWithAbility(r.id).length) { log.add('reactor-not-in-format: no species in this format has the ability at all', label); continue; }
    for (const { type: ty, tag: producing } of types) {
      /* THE LAYER OF THIS CASE IS THE LAYER OF THE TAG THAT NAMED THE TYPE, not the earliest layer
       * across everything the reactor happens to also do. */
      const layer = LAYER_OF_TAG[producing] || cls.layer;
      const side = SIDE_OF_TAG[producing] || cls.side;
      const pool = movesOfType(ty);
      if (!pool.length) { log.add('no-carrier: no deterministic foe-targeting damaging move of this type', label + ' ' + ty); continue; }
      let made = 0;
      for (const row of pool) {
        if (made >= depth) { log.add('depth-cap: carriers beyond --depth for this (reactor,type)', label + ' ' + ty); break; }
        const users = usersOf(row.id);
        if (!users.length) { log.add('no-user: no species in MC.mons learns the carrier move', 'moveType ' + row.id); continue; }
        if (layer === 'damage' && !ratioCanMeasure(row.id)) { log.add('carrier-unmeasurable-by-ratio: a residual or a multi-hit lands in the same HP delta as the multiplier', 'moveType ' + row.id); continue; }
        let user = users[0], holder;
        if (side === 'atk') {
          const p2 = r.kind === 'ability' ? speciesWithAbility(r.id) : SPECIES;
          user = p2.find(sp => learns(sp, row.id));
          if (!user) { log.add('no-user: no body both has the attacker-side reactor and learns a move of its type', label + ' ' + ty); continue; }
          holder = bulkiest(SPECIES.filter(sp => effectiveness(row.m.type, typesOf(sp)) > 0 && sp.id !== user.id));
          if (!holder) { log.add('no-holder: no legal target', label + ' ' + ty); continue; }
        } else {
          holder = holderFor(cls, r.id, r.kind, row.id, log, label + ' ' + ty);
          if (!holder) continue;
        }
        cases.push(mkCase({ axis: 'type', key: 'moveType:' + ty, layer, evaluator: evaluatorFor(layer), producingTag: producing,
          carrier: { kind: 'move', id: row.id, name: row.m.name, uses: row.uses, user: user.name },
          control: { kind: r.kind === 'item' ? 'item' : 'ability', id: r.kind === 'item' ? '' : norm(CONTROL_ABILITY), name: r.kind === 'item' ? '(no item)' : CONTROL_ABILITY },
          reactor: { kind: r.kind, id: r.id, name: r.name, holder: holder.name, side } }));
        made++;
      }
    }
  }
  return cases;
}

/* ================================================================================================
 * AXIS 3 — FIELD.  the MULTI-TURN half, and it is generated the same way.
 *
 * Will: *"we def need interactions thats the whole point and multi turn things like tailwind and
 * trick room."* A single-turn cross product structurally cannot see "Trick Room was up and then a
 * Tailwind landed": no pair generates a fourth turn.
 *
 * It IS a cross product, though -- of the PERSISTENT FIELD EFFECTS against each other. Every one of
 * them is derived from a tag that means "this outlives the turn it was clicked on":
 *
 *     setsWeather   setsTerrain   reversesSpeed(Trick Room)   doublesSideSpeed(Tailwind)
 *     halvesDamage(Reflect / Light Screen / Aurora Veil)
 *
 * Each generated case is a NINE-TURN script: A lands on turn 1, B lands on turn 3, and the rest of the
 * game is idle so every counter runs to expiry with both effects on the field. The comparator already
 * reads all of them each turn (weather, weatherTurns, terrain, terrainTurns, trickroom, tailwind,
 * reflect, lightscreen), so what is being asserted is that the two engines hold the same counters at
 * every turn, with a second effect layered on top.
 *
 * WHAT IS DELIBERATELY NOT GENERATED HERE: Safeguard, Gravity, Wonder Room and Magic Room persist and
 * are in NEITHER engine's compared projection, so a case built on them would compare nothing and pass.
 * Counted as `field-not-in-projection` rather than left out. */
const FIELD_TAGS = ['setsWeather', 'setsTerrain', 'reversesSpeed', 'doublesSideSpeed', 'halvesDamage'];
function fieldCarriers(log) {
  const out = [];
  for (const id of Object.keys(tags.moves)) {
    const rec = tags.moves[id];
    const hit = (rec.tags || []).filter(t => FIELD_TAGS.includes(t));
    if (!hit.length) continue;
    const mv = dex.moves.get(id);
    if (!mv.exists || mv.category !== 'Status') continue;
    /* CHILLY RECEPTION SETS SNOW AND THEN PIVOTS THE USER OUT. A self-switching setter turns a field
     * script into a switch script: the two engines choose the replacement differently (medicham2
     * refills with live(bench)[0], Showdown asks), so every later turn would diverge about the
     * harness. Excluded and named. */
    if (mv.selfSwitch) { log.add('field-setter-self-switches: the case would be about the replacement, not the field', id); continue; }
    const users = usersOf(id);
    if (!users.length) { log.add('no-user: no species in MC.mons learns the field setter', 'field ' + id); continue; }
    out.push({ id, name: mv.name, tag: hit[0], uses: rec.uses || 0, user: users[0] });
  }
  /* The persistent effects that exist and that the projection cannot see. Named so the gap is a
   * decision. */
  for (const id of ['safeguard', 'gravity', 'wonderroom', 'magicroom'])
    if (tags.moves[id]) log.add('field-not-in-projection: persists, but neither engine projection carries it', id);
  out.sort((a, b) => b.uses - a.uses);
  return out;
}
function axisField(log) {
  const carriers = fieldCarriers(log);
  const cases = [];
  for (const a of carriers) for (const b of carriers) {
    if (a.id === b.id) continue;
    /* Both setters must be clickable by ONE side's two bodies, or the script needs a switch and the
     * case stops being about the field. Slot 0 clicks A on turn 1, slot 1 clicks B on turn 3. */
    const userB = usersOf(b.id).find(sp => sp.id !== a.user.id);
    if (!userB) { log.add('no-user: no second body learns the layered field setter', a.id + ' + ' + b.id); continue; }
    cases.push(mkCase({ axis: 'field', key: a.tag + '+' + b.tag, layer: 'legality', evaluator: 'field',
      carrier: { kind: 'move', id: a.id, name: a.name, uses: a.uses, user: a.user.name },
      reactor: { kind: 'move', id: b.id, name: b.name, holder: userB.name, side: 'atk' },
      control: null, turns: 9 }));
  }
  return cases;
}

/* ---- THE MATRIX -------------------------------------------------------------------------------- */
function generate(opts) {
  opts = opts || {};
  const depth = opts.depth == null ? 3 : opts.depth;
  const log = ledger();
  _id = 0;
  const flag = axisFlag(depth, log), type = axisType(depth, log), field = axisField(log);
  const cases = [...flag, ...type, ...field];
  return { cases, dropped: log.counts, depth,
    byAxis: { flag: flag.length, type: type.length, field: field.length },
    byLayer: cases.reduce((a, c) => (a[c.layer] = (a[c.layer] || 0) + 1, a), {}),
    byEvaluator: cases.reduce((a, c) => (a[c.evaluator] = (a[c.evaluator] || 0) + 1, a), {}) };
}

/* THE THEORETICAL SIZE, computed WITHOUT any filter, so the coverage claim below has a denominator
 * that is not the thing being measured. */
function theoreticalSize() {
  let flag = 0;
  for (const [key, v] of Object.entries(tags.linkage)) {
    if (key === 'moveType') continue;
    flag += (v.carrierMoves || []).length * ((v.abilities || []).length + (v.items || []).length + (v.reactorMoves || []).length);
  }
  let type = 0;
  const mt = tags.linkage.moveType || {};
  for (const r of [...(mt.abilities || []).map(x => ({ ...x, kind: 'ability' })), ...(mt.items || []).map(x => ({ ...x, kind: 'item' }))])
    for (const t of typesReactedTo(classify(r.kind, r.id))) type += movesOfType(t.type).length;
  const fc = fieldCarriers(ledger()).length;
  return { flag, type, field: fc * (fc - 1), total: flag + type + fc * (fc - 1) };
}

module.exports = { generate, theoreticalSize, classify, LAYER_OF_TAG, SIDE_OF_TAG, CONTROL_ABILITY, fillerFor, dex, norm };

/* ---- PRINT (generator only; the runner is tests/test-game-diff.js --matrix) --------------------- */
if (require.main === module) {
  const argv = process.argv.slice(2);
  const depth = argv.includes('--full') ? Infinity : +((argv.find(a => a.startsWith('--depth=')) || '--depth=3').slice(8));
  const g = generate({ depth });
  const th = theoreticalSize();
  console.log('THE GENERATED INTERACTION MATRIX — generator only, nothing is run here\n');
  console.log('  THEORETICAL CROSS PRODUCT (no filter at all):');
  console.log('    flag axis  (carrier move x reactor, over ' + (Object.keys(tags.linkage).length - 1) + ' linkage keys): ' + th.flag);
  console.log('    type axis  (move OF a type x reactor to that type):                 ' + th.type);
  console.log('    field axis (ordered pairs of persistent field effects):             ' + th.field);
  console.log('    TOTAL                                                               ' + th.total + '\n');
  console.log('  EMITTED at --depth=' + depth + ': ' + g.cases.length
    + '   by axis ' + JSON.stringify(g.byAxis) + '\n    by layer ' + JSON.stringify(g.byLayer)
    + '\n    by evaluator ' + JSON.stringify(g.byEvaluator) + '\n');
  console.log('  DROPPED, every reason named (a silent cap reads as "covered everything"):');
  for (const [r, c] of Object.entries(g.dropped).sort((a, b) => b[1].n - a[1].n))
    console.log('    ' + String(c.n).padStart(5) + '  ' + r + '\n             e.g. ' + c.eg.join(' | '));
  console.log('');
  const per = {};
  for (const c of g.cases) (per[c.axis + '/' + c.layer] = per[c.axis + '/' + c.layer] || []).push(c);
  for (const k of Object.keys(per).sort()) {
    console.log('  ' + k + '  (' + per[k].length + ')');
    for (const c of per[k].slice(0, 8)) console.log('      ' + String(c.carrier.uses).padStart(6) + '  '
      + c.carrier.id.padEnd(16) + '(' + c.carrier.user + ')  x  ' + c.reactor.kind + ':' + c.reactor.id.padEnd(16)
      + '(' + c.reactor.holder + ')  side=' + c.reactor.side);
    if (per[k].length > 8) console.log('      ... ' + (per[k].length - 8) + ' more');
  }
}
