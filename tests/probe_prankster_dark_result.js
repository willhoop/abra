/* probe_prankster_dark_result.js — A PRANKSTER STATUS MOVE A DARK FOE REFUSES MUST END WITH THE MOVE
 * RESULT `false`, IN BOTH ENGINES, FOR EVERY STATUS MOVE A LEGAL PRANKSTER CARRIER CAN AIM AT A FOE.
 *
 *   ABRA_REGULATION=regmc node tests/probe_prankster_dark_result.js
 *
 * THE AUTHORITY, read whole in the pokemon-showdown-mc checkout (no Champions override of any of it —
 * `data/mods/champions/*.ts` names neither `prankster` nor any `hitStep*`):
 *   data/abilities.ts   prankster.onModifyPriority: `move.category === 'Status'` -> pranksterBoosted, +1
 *   sim/battle-actions.ts hitStepTryImmunity: `move.pranksterBoosted && pokemon.hasAbility('prankster')
 *                       && !targets[i].isAlly(pokemon) && !dex.getImmunity('prankster', target)`
 *                       -> `-immune` bare, `hitResults[i] = false`
 *   sim/battle-actions.ts trySpreadMoveHit: `atLeastOneFailure` is set by that false; the move result is
 *                       `!!targets.length`, and only `!moveResult && !atLeastOneFailure` writes `null`.
 *                       So an all-refused target list reads FALSE, and a spread move with any other
 *                       target left standing reads TRUE.
 *   sim/battle-actions.ts useMove keeps that as `moveThisTurnResult`; nextTurn rolls it into
 *                       `moveLastTurnResult`, which Stomping Tantrum and Temper Flare double on
 *                       (`=== false`) and the Metronome item reads.
 *
 * WHY A PROBE AND NOT ONLY A CENSUS ROW: `engine/board_state.js` does not compare the move result, so
 * the lattices, the roster and every existing Prankster probe (which read the EFFECT and the LINE, both
 * already right) were blind to it. This file reads the field itself through `engine/move_result_state.js`
 * at the boundary after the click, AND reads the OUTCOME on the one reachable consumer — a Prankster
 * Grimmsnarl's Stomping Tantrum the turn after a Dark foe refused its Taunt — through the boards.
 *
 * ARMS (every body, ability and move derived from the format; none typed):
 *   sweep:<move>         the Prankster carrier's status move at a DARK foe      sd must print -immune, last=false
 *   ctl-nondark:<move>   the same click at the NON-Dark foe                      no -immune (control: the type)
 *   ctl-noprank:<move>   the same click at the Dark foe with no Prankster        no -immune (control: the ability)
 *   outcome              Taunt refused by a Dark foe, then Stomping Tantrum      boards agree on the target's HP
 *   outcome-ctl          the same with no Prankster (Taunt lands, no doubling)   boards agree
 * Every arm must AGREE with the authority on the move result and on the board. An arm whose authority
 * did not do what the arm stages is UNREADABLE, never green.
 *
 * Knob: MEDI_PRANKSTER_RESULT_TRUE=1 restores the pre-fix `true` so this file can be shown red.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const MRS = require(D('engine', 'move_result_state.js'));
const N = require(D('engine', 'names.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const legal = x => x && x.exists && !x.isNonstandard;
const sp = n => dex.species.get(n);
const nonMega = n => legal(sp(n)) && !sp(n).isMega && !sp(n).battleOnly;
if (dex.getImmunity('prankster', ['Dark'])) { console.log('PREMISE — the dex says Dark is NOT immune to Prankster'); process.exit(1); }
const darkImmune = types => !dex.getImmunity('prankster', types);

const RISKY = /TryHit|TryBoost|ChangeBoost|Immunity|SetStatus|Bounce|TryMove|DragOut|AfterBoost|ModifyPriority|onStart|onSwitchIn|Redirect|onAnyModify|onFoe|onAlly|onSource|Weather|Terrain|Damaging|onDamage|onHit|Residual|onUpdate|TakeItem/;
const inert = a => { const ab = dex.abilities.get(a); return legal(ab) && !Object.keys(ab).some(k => /^on/.test(k) && RISKY.test(k)); };
const inertAbility = n => Object.values(sp(n).abilities).find(inert);

const ROSTER = [...new Set(CS.moveCarriers('Protect'))].filter(nonMega);
const PRANK = CS.abilityCarriers('Prankster').filter(nonMega);
const statusMoves = dex.moves.all().filter(legal).filter(m => m.category === 'Status');
const FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe', 'allAdjacentFoes', 'randomNormal', 'allAdjacent']);
const IDLE = m => m.target === 'self' && m.boosts && !m.onHit && !m.stallingMove && !m.heal && !m.volatileStatus
  && !m.self && !m.selfSwitch && !m.sideCondition && !m.condition && !m.onTryHit && !m.onTry;
const idleOf = n => { const m = statusMoves.find(x => IDLE(x) && CS.canLearn(n, x.name)); return m && m.name; };
const noPrank = n => Object.values(sp(n).abilities).find(a => a !== 'Prankster' && inert(a))
  || Object.values(sp(n).abilities).find(a => a !== 'Prankster');

/* the two foes: a Dark body and a non-Dark body, neither Grass (powder), both with an inert ability and
 * an idle self-boost so a foe's own click touches nothing the arm reads */
const DARK = ROSTER.filter(n => darkImmune(sp(n).types) && !Object.values(sp(n).abilities).includes('Prankster')
  && inertAbility(n) && !sp(n).types.includes('Grass') && idleOf(n))[0];
const PLAIN = ROSTER.filter(n => !darkImmune(sp(n).types) && inertAbility(n) && !sp(n).types.includes('Grass')
  && !sp(n).types.includes('Ghost') && !PRANK.includes(n) && idleOf(n))[0];
const DARK2 = ROSTER.filter(n => n !== DARK && darkImmune(sp(n).types) && !Object.values(sp(n).abilities).includes('Prankster')
  && inertAbility(n) && !sp(n).types.includes('Grass') && idleOf(n))[0];
const PARTNER = ROSTER.filter(n => n !== DARK && n !== DARK2 && n !== PLAIN && !PRANK.includes(n) && inertAbility(n) && idleOf(n))[0];
if (!DARK || !PLAIN || !PARTNER) { console.log('FIXTURE — dark/plain/partner missing', DARK, PLAIN, PARTNER); process.exit(1); }

const mon = (species, ability, moves, item) => {
  const bad = moves.filter(m => !CS.canLearn(species, m));
  if (bad.length) { console.log('  FIXTURE ILLEGAL — ' + species + ' cannot learn ' + bad.join(', ')); process.exit(1); }
  return { species, item: item || '', ability, moves };
};
const USED = [DARK, DARK2, PLAIN, PARTNER].filter(Boolean);
const fill = ex => ROSTER.filter(n => !ex.includes(n) && inertAbility(n) && !PRANK.includes(n)).slice(0, 2)
  .map(n => ({ species: n, item: '', ability: inertAbility(n), moves: ['Protect'] }));

console.log('\n  FIXTURES (derived from ' + CS.FORMAT + ')');
console.log('    Dark foe      ' + DARK + ' (' + sp(DARK).types.join('/') + ', ' + inertAbility(DARK) + ', idle ' + idleOf(DARK) + ')   second Dark (all-Dark spread arm): ' + DARK2);
console.log('    plain foe     ' + PLAIN + ' (' + sp(PLAIN).types.join('/') + ', ' + inertAbility(PLAIN) + ', idle ' + idleOf(PLAIN) + ')');
console.log('    partner       ' + PARTNER + ' (' + inertAbility(PARTNER) + ', idle ' + idleOf(PARTNER) + ')');

/* ---- the sweep: every foe-aimed status move any legal (non-mega) Prankster carrier learns ---------- */
const byMove = new Map();
for (const u of PRANK) for (const mv of statusMoves.filter(m => FOE_TARGETS.has(m.target) && CS.canLearn(u, m.name)))
  if (!byMove.has(mv.id)) byMove.set(mv.id, u);
console.log('    sweep         ' + byMove.size + ' distinct foe-aimed status moves over ' + PRANK.join(', '));

const ARMS = [];
const foes = () => [mon(DARK, inertAbility(DARK), [idleOf(DARK), 'Protect'].concat(DARK_HIT ? [DARK_HIT.name] : [])), mon(PLAIN, inertAbility(PLAIN), [idleOf(PLAIN), 'Protect'])];
const foeIdle = { p2: [{ m: N.id(idleOf(DARK)) }, { m: N.id(idleOf(PLAIN)) }] };
for (const [mid, u] of byMove) {
  const mv = dex.moves.get(mid);
  const idleU = idleOf(u) || null;
  const uMoves = [mv.name].concat(idleU && idleU !== mv.name ? [idleU] : []);
  const partner = mon(PARTNER, inertAbility(PARTNER), [idleOf(PARTNER)]);
  /* turn 1: everybody idles, so Encore / Disable / Spite / Torment have a last move to read.
   * turn 2: the click. The result is read at boundary 2, where `last` holds turn 2's value. */
  const t0 = { p1: [idleU ? { m: N.id(idleU) } : null, { m: N.id(idleOf(PARTNER)) }], ...foeIdle };
  const pa = (ab) => [mon(u, ab, uMoves), partner];
  const t1 = (t) => ({ p1: [{ m: mid, t }, { m: N.id(idleOf(PARTNER)) }], ...foeIdle });
  /* A SPREAD MOVE with a non-Dark foe beside the Dark one keeps a target, so the authority reads `true`
   * (`!!targets.length`); the all-Dark arm below is where a spread move ends `false`. */
  const spread = mv.target === 'allAdjacentFoes' || mv.target === 'allAdjacent';
  ARMS.push({ id: 'sweep:' + mid, user: u, A: pa('Prankster'), script: [t0, t1(0)], expectImmune: true, readSlot: 'p1a',
              sweepExpect: spread ? 'true' : 'false' });
  ARMS.push({ id: 'ctl-nondark:' + mid, user: u, A: pa('Prankster'), script: [t0, t1(1)], expectImmune: false, readSlot: 'p1a',
              spreadSkip: spread });
  ARMS.push({ id: 'ctl-noprank:' + mid, user: u, A: pa(noPrank(u)), script: [t0, t1(0)], expectImmune: false, readSlot: 'p1a' });
  if (spread && DARK2) {
    const B2 = [mon(DARK, inertAbility(DARK), [idleOf(DARK), 'Protect']), mon(DARK2, inertAbility(DARK2), [idleOf(DARK2), 'Protect'])];
    const idle2 = { p2: [{ m: N.id(idleOf(DARK)) }, { m: N.id(idleOf(DARK2)) }] };
    ARMS.push({ id: 'sweep-alldark:' + mid, user: u, A: pa('Prankster'), B: B2, readSlot: 'p1a', expectImmune: true, sweepExpect: 'false',
                script: [{ ...t0, ...idle2 }, { ...t1(0), ...idle2 }] });
  }
}
/* THE OUTCOME: the one consumer a Prankster carrier here can reach. Grimmsnarl learns Taunt and Stomping
 * Tantrum and has Prankster. Taunt at the Dark foe (refused) then Stomping Tantrum at the SAME Dark foe
 * (a Ground move; the plain foe may be Flying). On turn 2 the Dark foe clicks a damaging move, because in
 * the control arm the Taunt LANDS and a taunted body cannot click its idle boost; both arms run the same
 * script so the only knob is the ability. */
const OUT_USER = PRANK.find(n => CS.canLearn(n, 'Taunt') && CS.canLearn(n, 'Stomping Tantrum'));
const DARK_HIT = dex.moves.all().filter(legal).filter(m => m.category !== 'Status' && m.target === 'normal' && m.priority === 0
  && !m.flags.charge && !m.flags.recharge && !m.selfSwitch && !m.secondary && !m.secondaries && !m.drain && !m.recoil
  && !m.self && !m.onHit && !m.multihit && m.basePower > 0 && CS.canLearn(DARK, m.name)).sort((x, y) => x.basePower - y.basePower)[0];
if (OUT_USER && DARK_HIT) {
  const script = [
    { p1: [{ m: 'taunt', t: 0 }, { m: N.id(idleOf(PARTNER)) }], ...foeIdle },
    { p1: [{ m: 'stompingtantrum', t: 0 }, { m: N.id(idleOf(PARTNER)) }], p2: [{ m: DARK_HIT.id, t: 1 }, { m: N.id(idleOf(PLAIN)) }] },
  ];
  console.log('    outcome       ' + OUT_USER + ': Taunt -> ' + DARK + ', then Stomping Tantrum -> ' + DARK + ' (' + DARK + ' clicks ' + DARK_HIT.name + ' on turn 2)');
  const pa = ab => [mon(OUT_USER, ab, ['Taunt', 'Stomping Tantrum']), mon(PARTNER, inertAbility(PARTNER), [idleOf(PARTNER)])];
  ARMS.push({ id: 'outcome', user: OUT_USER, A: pa('Prankster'), script, expectImmune: true, readSlot: 'p1a', outcome: true, readAt: 1 });
  ARMS.push({ id: 'outcome-ctl', user: OUT_USER, A: pa(noPrank(OUT_USER)), script, expectImmune: false, readSlot: 'p1a', outcome: true, readAt: 1 });
} else console.log('  (no legal Prankster carrier learns Taunt and Stomping Tantrum — outcome arm not staged)');

/* ---- THE SIBLINGS: the same field, the same step list, NO Prankster anywhere ----------------------
 * Found by this file's own control arms (a missed Poison Powder, a same-gender Attract): every per-target
 * refusal in `trySpreadMoveHit` ends the move `false` in the authority, and the shield's NOT_FAIL ends it
 * `null`. Each arm names the value the AUTHORITY must read (`expectSd`), so an arm whose authority did not
 * do what it stages is UNREADABLE rather than green. The user carries no Prankster in any of them. */
const GAG = CS.abilityCarriers('Good as Gold').filter(nonMega)[0];
const GRASS = ROSTER.filter(n => sp(n).types.includes('Grass') && n !== PARTNER && inertAbility(n) && idleOf(n))[0];
const GROUND = ROSTER.filter(n => sp(n).types.includes('Ground') && !sp(n).types.includes('Flying') && inertAbility(n) && idleOf(n))[0];
const sib = (id, user, mv, foe, foeAb, foeT2, expectSd) => {
  if (!user || !foe || !CS.canLearn(user, mv)) { console.log('  (sibling ' + id + ' not staged: ' + user + ' / ' + foe + ' / ' + mv + ')'); return; }
  const fIdle = idleOf(foe);
  const B = [mon(foe, foeAb || inertAbility(foe), [fIdle, 'Protect']), mon(PLAIN, inertAbility(PLAIN), [idleOf(PLAIN), 'Protect'])];
  const idleU = idleOf(user);
  const A = [mon(user, noPrank(user), [mv].concat(idleU && idleU !== mv ? [idleU] : [])), mon(PARTNER, inertAbility(PARTNER), [idleOf(PARTNER)])];
  const t0 = { p1: [idleU ? { m: N.id(idleU) } : null, { m: N.id(idleOf(PARTNER)) }], p2: [{ m: N.id(fIdle) }, { m: N.id(idleOf(PLAIN)) }] };
  const t1 = { p1: [{ m: N.id(mv), t: 0 }, { m: N.id(idleOf(PARTNER)) }], p2: [{ m: foeT2 || N.id(fIdle) }, { m: N.id(idleOf(PLAIN)) }] };
  ARMS.push({ id: 'sib-' + id, user, A, B, script: [t0, t1], expectSd, readSlot: 'p1a' });
};
const WHIM = PRANK.find(n => CS.canLearn(n, 'Encore') && CS.canLearn(n, 'Stun Spore') && CS.canLearn(n, 'Leech Seed'));
const TWAVE = PRANK.find(n => CS.canLearn(n, 'Thunder Wave') && !sp(n).types.includes('Ground') && !darkImmune(sp(n).types));
sib('goodasgold', WHIM, 'Encore', GAG, 'Good as Gold', null, 'false');
sib('protect-affect', WHIM, 'Encore', DARK, null, 'protect', 'null');
sib('powder', WHIM, 'Stun Spore', GRASS, null, null, 'false');
sib('protect-status', WHIM, 'Stun Spore', DARK, null, 'protect', 'null');
sib('tryimmunity', WHIM, 'Leech Seed', GRASS, null, null, 'false');
sib('typechart', TWAVE, 'Thunder Wave', GROUND, null, null, 'false');
/* ---- A CALLED MOVE: Sleep Talk hands the called move its caller's `pranksterBoosted` ----------------
 * sim/battle-actions.ts useMoveInner: `if (this.battle.activeMove) { move.priority = ...; if (!move.hasBounced)
 * move.pranksterBoosted = this.battle.activeMove.pranksterBoosted; }`, and hitStepTryImmunity's Prankster arm
 * asks `move.pranksterBoosted`, NOT the category. So a Prankster Sleep Talk that calls a DAMAGING move into a
 * Dark foe is refused. Staged: a Dark Yawn user puts the Prankster body to sleep; with only Sleep Talk and one
 * damaging move on the sheet the call is forced; both foes are Dark so the random target does not matter. The
 * control is the same body without Prankster. Read over BOTH foe slots, at the boundary after the call. */
/* the yawner's ability only has to stay out of the way of a SLEEP: Synchronize passes brn/par/psn and never slp, but
 * it is excluded anyway so the arm cannot be read as a Synchronize question */
const yawnAb = n => inertAbility(n) || Object.values(sp(n).abilities).find(x => x !== 'Synchronize' && x !== 'Prankster');
const YAWNER = ROSTER.filter(n => darkImmune(sp(n).types) && CS.canLearn(n, 'Yawn') && yawnAb(n) && idleOf(n) && n !== DARK)[0];
const TALKER = PRANK.find(n => CS.canLearn(n, 'Sleep Talk') && DARK_HIT && CS.canLearn(n, 'Foul Play'));
if (YAWNER && TALKER) {
  const B = [mon(YAWNER, yawnAb(YAWNER), ['Yawn', idleOf(YAWNER)]), mon(DARK, inertAbility(DARK), [idleOf(DARK), 'Protect'])];
  const A = ab => [mon(TALKER, ab, ['Sleep Talk', 'Foul Play']), mon(PARTNER, inertAbility(PARTNER), [idleOf(PARTNER)])];
  const idleB = [{ m: N.id(idleOf(YAWNER)) }, { m: N.id(idleOf(DARK)) }];
  const script = [
    { p1: [{ m: 'sleeptalk' }, { m: N.id(idleOf(PARTNER)) }], p2: [{ m: 'yawn', t: 0 }, { m: N.id(idleOf(DARK)) }] },
    { p1: [{ m: 'sleeptalk' }, { m: N.id(idleOf(PARTNER)) }], p2: idleB },
    { p1: [{ m: 'sleeptalk' }, { m: N.id(idleOf(PARTNER)) }], p2: idleB },
  ];
  ARMS.push({ id: 'called-sleeptalk', user: TALKER, A: A('Prankster'), B, script, expectImmune: true, readSlot: 'p1a', readAt: 3,
              immSlots: ['p2a', 'p2b'], calledArm: true });
  ARMS.push({ id: 'called-sleeptalk-ctl', user: TALKER, A: A(noPrank(TALKER)), B, script, expectImmune: false, readSlot: 'p1a', readAt: 3,
              immSlots: ['p2a', 'p2b'], calledArm: true });
  console.log('    called move   ' + TALKER + ' Sleep Talk -> Foul Play after ' + YAWNER + '\'s Yawn; foes ' + YAWNER + ' + ' + DARK);
} else console.log('  (called-move arm not staged: yawner ' + YAWNER + ', talker ' + TALKER + ')');
console.log('    siblings      user ' + WHIM + ' / ' + TWAVE + ' (no Prankster); Good as Gold ' + GAG + ', Grass ' + GRASS + ', Ground ' + GROUND);

/* ---- REDIRECTION AND MAGIC BOUNCE -----------------------------------------------------------------
 * REDIRECTION decides the target BEFORE `trySpreadMoveHit` runs (Follow Me's onFoeRedirectTarget, +2, moves
 * first), so the Prankster clause is asked of the body the move ARRIVES at. Derived for this regulation: no legal
 * Dark body learns Follow Me or Rage Powder and no legal Lightning Rod / Storm Drain carrier is Dark, so a move
 * cannot be redirected INTO a Dark body; the reachable case is AWAY from one -- a Prankster Thunder Wave aimed at a
 * Dark foe lands on the Follow Me partner. `sdCheck` is that paralysis in the authority's log.
 * MAGIC BOUNCE answers at step 1 (`hitStepTryHitEvent`), two steps above the Prankster arm, and the bounced copy
 * carries `pranksterBoosted = false` (data/abilities.ts magicbounce). So a Dark Prankster user's Taunt into a
 * Magic Bounce body comes back and LANDS on the Dark user. `sdCheck` is that Taunt starting on the user. */
const FOLLOWER = ROSTER.filter(n => CS.canLearn(n, 'Follow Me') && !darkImmune(sp(n).types) && inertAbility(n))[0]
  || ROSTER.filter(n => CS.canLearn(n, 'Follow Me') && !darkImmune(sp(n).types))[0];
const followAb = n => inertAbility(n) || Object.values(sp(n).abilities).find(x => x !== 'Prankster');
if (FOLLOWER && TWAVE) {
  const B = [mon(DARK, inertAbility(DARK), [idleOf(DARK), 'Protect']), mon(FOLLOWER, followAb(FOLLOWER), ['Follow Me', 'Protect'])];
  const A = ab => [mon(TWAVE, ab, ['Thunder Wave'].concat(idleOf(TWAVE) ? [idleOf(TWAVE)] : [])), mon(PARTNER, inertAbility(PARTNER), [idleOf(PARTNER)])];
  const t0 = { p1: [idleOf(TWAVE) ? { m: N.id(idleOf(TWAVE)) } : null, { m: N.id(idleOf(PARTNER)) }], p2: [{ m: N.id(idleOf(DARK)) }, { m: 'protect' }] };
  const t1 = { p1: [{ m: 'thunderwave', t: 0 }, { m: N.id(idleOf(PARTNER)) }], p2: [{ m: N.id(idleOf(DARK)) }, { m: 'followme' }] };
  ARMS.push({ id: 'redirect-away', user: TWAVE, A: A('Prankster'), B, script: [t0, t1], readSlot: 'p1a',
              sdCheck: /^\|-status\|p2b: [^|]*\|par/, why0: 'the Follow Me partner is paralysed' });
  console.log('    redirection   ' + TWAVE + ' Thunder Wave at ' + DARK + ', ' + FOLLOWER + ' clicks Follow Me');
} else console.log('  (redirection arm not staged: follower ' + FOLLOWER + ', user ' + TWAVE + ')');
const BOUNCER = CS.abilityCarriers('Magic Bounce').filter(nonMega).find(n => idleOf(n));
const DARK_PK = PRANK.find(n => darkImmune(sp(n).types) && CS.canLearn(n, 'Taunt') && idleOf(n));
if (BOUNCER && DARK_PK) {
  const B = [mon(BOUNCER, 'Magic Bounce', [idleOf(BOUNCER), 'Protect']), mon(PLAIN, inertAbility(PLAIN), [idleOf(PLAIN), 'Protect'])];
  const A = [mon(DARK_PK, 'Prankster', ['Taunt', idleOf(DARK_PK)]), mon(PARTNER, inertAbility(PARTNER), [idleOf(PARTNER)])];
  const idleB = { p2: [{ m: N.id(idleOf(BOUNCER)) }, { m: N.id(idleOf(PLAIN)) }] };
  const t0 = { p1: [{ m: N.id(idleOf(DARK_PK)) }, { m: N.id(idleOf(PARTNER)) }], ...idleB };
  const t1 = { p1: [{ m: 'taunt', t: 0 }, { m: N.id(idleOf(PARTNER)) }], ...idleB };
  ARMS.push({ id: 'bounce-onto-dark-user', user: DARK_PK, A, B, script: [t0, t1], readSlot: 'p1a',
              sdCheck: /^\|-start\|p1a: [^|]*\|move: Taunt/, why0: 'the bounced Taunt starts on the Dark Prankster user' });
  /* the same on the MAJOR-STATUS road, which is a different branch here */
  if (CS.canLearn(DARK_PK, 'Thunder Wave')) {
    const A2 = [mon(DARK_PK, 'Prankster', ['Thunder Wave', idleOf(DARK_PK)]), mon(PARTNER, inertAbility(PARTNER), [idleOf(PARTNER)])];
    const t1b = { p1: [{ m: 'thunderwave', t: 0 }, { m: N.id(idleOf(PARTNER)) }], ...idleB };
    ARMS.push({ id: 'bounce-status-onto-dark-user', user: DARK_PK, A: A2, B, script: [t0, t1b], readSlot: 'p1a',
                sdCheck: /^\|-status\|p1a: [^|]*\|par/, why0: 'the bounced Thunder Wave paralyses the Dark Prankster user' });
  }
  console.log('    magic bounce  ' + DARK_PK + ' (Dark, Prankster) Taunt / Thunder Wave at ' + BOUNCER + ' (Magic Bounce)');
} else console.log('  (bounce arm not staged: bouncer ' + BOUNCER + ', user ' + DARK_PK + ')');

/* ---- play -------------------------------------------------------------------------------------- */
const immuneOn = (log, who) => (log || []).map(String).filter(l => new RegExp('^\\|-immune\\|' + who + ':', 'i').test(l) && !/\[from\]/.test(l)).length;
let red = 0, unreadable = 0; const results = [];
console.log('\n  ' + 'arm'.padEnd(26) + 'user'.padEnd(12) + 'boards'.padEnd(8) + 'imm sd/me'.padEnd(11) + 'result sd/me'.padEnd(16) + 'verdict');
for (const a of ARMS) {
  if (a.spreadSkip) continue;   // a spread move always also reaches the Dark foe; its control is the no-Prankster arm
  const others = fill(a.A.map(x => x.species).concat(USED));
  const pa = G.buildPair(a.A.concat(others), { hpBoost: 4 });
  const pb = G.buildPair((a.B || foes()).concat(others), { hpBoost: 4 });
  if (!pa || !pb) { console.log('  ' + a.id.padEnd(26) + 'COULD NOT BUILD'); unreadable++; continue; }
  G.resetScriptCounters();
  let sdLog = [], res = null, lastBattle = null, sdRes = null;
  /* boundary t is taken AFTER script turn t-1, so the click on script turn 1 is read at boundary 2 */
  const readAt = a.readAt != null ? a.readAt : 2;
  const r = G.playGame(pa, pb, 'directed', 'prankdark/' + a.id, {
    script: a.script,
    onBoundary: (s, t, S, battle) => { lastBattle = battle; if (t === readAt) { res = MRS.at(battle, S); sdRes = MRS.readSd(battle); } } });
  const sc = G.scriptCounters();
  sdLog = lastBattle ? lastBattle.log : [];
  const slotsI = a.immSlots || ['p2a'];
  const immSd = slotsI.reduce((n, w) => n + immuneOn(sdLog, w), 0), immMe = slotsI.reduce((n, w) => n + immuneOn(r.mediTrace, w), 0);
  const row = res && (res.diffs.find(d => d.slot === a.readSlot));
  const sdLast = res ? (row ? row.sd : 'agree') : 'NO-BOUNDARY';
  const boardsAgree = !r.stateDiv && r.boundaries > 0 && r.boundariesAgreed === r.boundaries;
  /* the authority's own value, read whether or not the engines agree -- a sweep arm must read `false`
   * there (else the refusal was not what ended the move) and a sibling arm must read its expectSd */
  const sdVal = sdRes && sdRes[a.readSlot] ? sdRes[a.readSlot].last : 'NONE';
  const staged = sc.moveNotOnRequest === 0 && !!res
    && (a.sdCheck ? (sdLog || []).map(String).some(l => a.sdCheck.test(l))
      : a.expectSd ? sdVal === a.expectSd
        : (a.expectImmune ? immSd >= 1 && (a.outcome || sdVal === (a.sweepExpect || 'false')) : immSd === 0));
  const resultAgree = !!res && !res.diffs.some(d => d.slot === a.readSlot);
  const verdict = !staged ? 'UNREADABLE' : (resultAgree && boardsAgree && immMe === immSd) ? 'GREEN' : 'RED';
  if (verdict === 'RED') red++; if (verdict === 'UNREADABLE') unreadable++;
  const resTxt = row ? (row.sd + '/' + row.me) : (res ? 'agree ' + sdVal : 'none');
  if (verdict === 'UNREADABLE') a.why = 'authority read ' + sdVal + (a.expectSd ? ' (arm stages ' + a.expectSd + ')' : '') + ', -immune on p2a ' + immSd;
  console.log('  ' + a.id.padEnd(26) + a.user.padEnd(12) + (boardsAgree ? 'agree' : 'DIFFER').padEnd(8)
    + (immSd + '/' + immMe).padEnd(11) + resTxt.padEnd(16) + verdict
    + (verdict === 'UNREADABLE' ? '  [' + a.why + '; script-missing ' + sc.moveNotOnRequest + ' ' + sc.firstMissing + ']' : '')
    + (r.err ? '  [threw: ' + r.err + ']' : ''));
  if (process.env.PROBE_DUMP === a.id) {
    console.log('      --- authority log ---\n' + (sdLog || []).map(String).filter(l => /^\|(move|-|turn|cant)/.test(l)).map(l => '      ' + l).join('\n'));
    console.log('      --- medicham trace ---\n' + (r.mediTrace || []).map(String).filter(l => /^\|(move|-|turn|cant)/.test(l)).map(l => '      ' + l).join('\n'));
  }
  if (verdict === 'RED' && r.stateDiv) console.log('      first board divergence: ' + JSON.stringify(r.stateDiv).slice(0, 300));
  results.push({ id: a.id, user: a.user, boardsAgree, immune: { sd: immSd, me: immMe }, result: resTxt, verdict,
                 stateDiv: r.stateDiv ? JSON.stringify(r.stateDiv).slice(0, 400) : null });
}
const sweepRows = results.filter(x => /^sweep:/.test(x.id));
const sweepReadable = sweepRows.filter(x => x.verdict !== 'UNREADABLE').length;
console.log('\n  sweep arms readable ' + sweepReadable + ' of ' + sweepRows.length
  + (sweepRows.filter(x => x.verdict === 'UNREADABLE').length ? ' — unreadable: ' + sweepRows.filter(x => x.verdict === 'UNREADABLE').map(x => x.id).join(' ') : ''));
/* A SWEEP THAT STAGES NOTHING IS NOT A PASS. Unreadable arms are named above; the outcome arm and at
 * least the filed pair (Encore, Thunder Wave) must be readable or the whole file is. */
const must = ['outcome', 'outcome-ctl', 'sweep:encore', 'sweep:thunderwave', 'sweep:taunt', 'sweep:cottonspore', 'sweep-alldark:cottonspore',
  'sib-goodasgold', 'sib-protect-affect', 'sib-powder', 'sib-protect-status', 'sib-tryimmunity', 'sib-typechart',
  'called-sleeptalk', 'called-sleeptalk-ctl', 'redirect-away', 'bounce-onto-dark-user', 'bounce-status-onto-dark-user'];
const missingMust = must.filter(id => !results.some(x => x.id === id && x.verdict !== 'UNREADABLE'));
if (missingMust.length) { console.log('  REQUIRED ARMS UNREADABLE: ' + missingMust.join(' ')); }

const out = D('data', 'verification', 'probe-prankster-dark-result' + (process.env.ABRA_REGULATION === 'regmc' ? '-regmc' : '') + '.json');
/* WRITE-POLICY: findings — a red run IS the measurement; nothing reads this back as a baseline. */
fs.writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), format: CS.FORMAT,
  knob: process.env.MEDI_PRANKSTER_RESULT_TRUE || null, fixtures: { DARK, PLAIN, PARTNER, OUT_USER },
  results, red, unreadable, missingRequired: missingMust,
  run_ok: red === 0 && missingMust.length === 0 }, null, 1) + '\n');
console.log('\n  RED ' + red + '   UNREADABLE ' + unreadable + '   (wrote ' + path.relative(D(), out) + ')\n');
process.exit(red || missingMust.length ? 1 : 0);
