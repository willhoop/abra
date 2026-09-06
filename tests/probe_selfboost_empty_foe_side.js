/* probe_selfboost_empty_foe_side.js — `Battle#boost` REFUSES OUTRIGHT WHEN THE BOOSTED BODY'S FOE
 * SIDE HAS NO POKEMON LEFT, AND THIS ENGINE PAID THE `selfBoost` ANYWAY.
 *
 *   SHOWDOWN_PATH=... node tests/probe_selfboost_empty_foe_side.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `14b62cd5aeec`
 * (`data/game-differential.json`, 961 games, census `census-pin-9446a684709d`, pool
 * `data/team-pool-frozen`), THREE board-material games, one of them with the `any`-bucket verdict
 * SHARED COINS:
 *
 *   extra event emitted by medicham2 :: |-damage|p2b|H/H|[from]lifeorb <> |-unboost|p2b|def|1
 *   extra event emitted by medicham2 :: |-damage|p1b|H/H|[from]lifeorb <> |-unboost|p1b|def|1
 *   showdown stopped emitting while medicham2 continued :: |-unboost|p2b|def|1
 *
 * All three are the same click. A Kommo-o's Clanging Scales takes the LAST body on the other side
 * down, and this engine then writes `|-unboost|<the Kommo-o>|def|1` that the authority never writes:
 *
 *     showdown   |-damage|p1b: Dragalge|0 fnt
 *                |faint|p1b: Dragalge
 *                (nothing further)
 *     medicham2  |-damage|p1b: Dragalge|0 fnt
 *                |faint|p1b: Dragalge
 *                |-unboost|p2b: Kommo-o|def|1
 *
 * THE RULE, READ OFF THE AUTHORITY AND NOT REMEMBERED. `Battle#boost` opens with three refusals and
 * the third is the one nothing here implemented:
 *
 *     if (!target?.hp) return 0;                                              sim/battle.ts:2026
 *     if (!target.isActive) return false;                                                  :2027
 *     if (this.gen > 5 && !target.side.foePokemonLeft()) return false;                     :2028
 *
 * `Side#foePokemonLeft()` (sim/side.ts) is the foe's `pokemonLeft`, and `pokemonLeft` is decremented
 * inside `faintMessages` (`if (pokemon.side.pokemonLeft) pokemon.side.pokemonLeft--;`,
 * sim/battle.ts:2550) INDEPENDENTLY of its `checkWin` argument. So the ordering that makes this
 * reachable is exact:
 *
 *     hitStepMoveHitLoop  this.battle.faintMessages(false, false, !pokemon.hp)   scripts.ts:547
 *                           -> the KO'd body is counted off; pokemonLeft hits 0
 *     useMoveInner        if (move.selfBoost && moveResult)
 *                           this.moveHit(pokemon, pokemon, move, move.selfBoost, false, true)
 *                                                                       sim/battle-actions.ts:520
 *                           -> boost() refuses at :2028 and writes NOTHING
 *     useMoveInner        singleEvent/runEvent('AfterMoveSecondarySelf')  battle-actions.ts:537
 *                           -> Life Orb still pays, which is why the authority's stream has the
 *                              `-damage ... [from] item: Life Orb` and no `-unboost` above it
 *
 * THE ASYMMETRY IS THE WHOLE POINT AND IT IS WHY THIS GUARD GOES AT EXACTLY ONE SITE. Close Combat's
 * `self.boosts` is paid by `selfDrops` INSIDE the hit loop (`scripts.ts:385`), which is ABOVE
 * `faintMessages` — `pokemonLeft` has not been decremented yet there, so the authority pays that one
 * and must keep paying it. Only the after-loop `selfBoost` payment sits below the decrement.
 *
 * THE FIXTURE. The defect needs a side WIPE, so it cannot be expressed in a one-turn scenario. The
 * defending side is TWO bodies that stand still plus two self-removing ones, and the attacker swings
 * once, on the turn the bench is empty. The two arms differ in ONE thing:
 *
 *   WIPE       the second standing body also dies to the swing            -> foe side empty
 *   NOT-WIPED  the second standing body is IMMUNE to the move's type      -> one body left
 *
 * Both arms therefore have TWO targets on the field, so both pay the same spread modifier and the
 * only variable is whether the side emptied.
 *
 * THE MODEL PROPOSES, THE RUN VERIFIES, AND THAT SPLIT IS NOT DECORATION — the first draft of this
 * probe modelled the minimum-roll damage at 292 into a 145-HP target and the swing dealt 138,
 * because `buildOne` builds a body with a filler moveset and the SP budget the real fixture spends
 * is not the same one. So the candidate list is walked and each candidate is PLAYED; the first one
 * whose NOT-WIPED arm actually kills the target while leaving the survivor standing is the fixture,
 * and the number tried is printed.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_SELFBOOST_IGNORES_EMPTY_FOE_SIDE === '1';
require(D('tests', '_live_release.js'));

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];

let bad = 0;
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* ---- THE MOVE. Read out of the format: it must carry `selfBoost` — the AFTER-LOOP payment, the one
 * that sits below `faintMessages` — the table must be a DROP, and it must be single-swing and
 * always-hit so the fixture carries no die. */
const SB = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.selfBoost && m.selfBoost.boosts);
console.log('  moves carrying `selfBoost` in this format:');
for (const m of SB) console.log('      ' + m.id.padEnd(15) + ' bp ' + String(m.basePower).padEnd(4)
  + m.type + '/' + m.category + '  acc ' + m.accuracy + '  multihit ' + JSON.stringify(m.multihit || null)
  + '  target ' + m.target + '  ' + JSON.stringify(m.selfBoost.boosts));
const SB_OK = SB.filter(m => (m.accuracy === true || m.accuracy === 100) && !m.multihit
  && m.basePower > 0 && Object.values(m.selfBoost.boosts).some(v => v < 0));
if (!SB_OK.length) { console.log('  NO 100-ACCURACY SINGLE-SWING selfBoost DROP — a claim about the format.'); process.exit(2); }

/* ---- THE BUILT STAT LINE IS THE BUILDER'S, never modelled. A body that will not build is COUNTED
 * and NAMED, so the denominator cannot shrink in silence. */
const FILLER0 = POOL.filter(s => LEARNS(s, 'protect')).slice(0, 3);
const built = new Map(); const BUILD_FAILED = [];
const buildOne = (s) => {
  if (built.has(s.name)) return built.get(s.name);
  let row = null;
  try {
    const p = G.buildPair([{ species: s.name, item: '', ability: '', moves: ['Protect'] },
      ...FILLER0.filter(f => f.name !== s.name).slice(0, 3)
        .map(f => ({ species: f.name, item: '', ability: '', moves: ['Protect'] }))]);
    if (p) {
      const st = p[0].medi.st;
      for (const k of ['hp', 'at', 'df', 'sa', 'sd']) {
        if (typeof st[k] !== 'number') throw new Error('built stat line has no numeric `' + k + '` — keys are ' + Object.keys(st).join(','));
      }
      row = { hp: st.hp, at: st.at, df: st.df, sa: st.sa, sd: st.sd };
    } else BUILD_FAILED.push(s.name + ': buildPair returned null');
  } catch (e) { BUILD_FAILED.push(s.name + ': ' + String((e && e.message) || e)); }
  built.set(s.name, row);
  return row;
};

/* Showdown's own damage line, minimum roll (85/100), level 50, no boosts and no weather, with the
 * doubles SPREAD modifier applied because both arms hit two bodies (`spreadModifier` defaults to
 * 0.75 outside free-for-all, sim/battle-actions.ts). It ORDERS the candidate list. Nothing rests on
 * it — every candidate is played before it is used. */
const minSpreadDamage = (bp, atk, def, stab, eff) => {
  let d = Math.floor(Math.floor(Math.floor(2 * 50 / 5 + 2) * bp * atk / def) / 50) + 2;
  d = Math.floor(d * 0.75);
  d = Math.floor(Math.floor(d * stab) * eff);
  return Math.floor(d * 85 / 100);
};

const rows = [];
for (const mv of SB_OK) {
  const attackers = POOL.filter(s => LEARNS(s, mv.id) && !G.CLOSET_SPECIES.has(norm(s.id)));
  for (const T of POOL) {
    if (G.CLOSET_SPECIES.has(norm(T.id))) continue;
    if (!dex.getImmunity(mv.type, T)) continue;
    const eff = Math.pow(2, dex.getEffectiveness(mv.type, T));
    const bt = buildOne(T); if (!bt) continue;
    for (const A of attackers) {
      if (A.name === T.name) continue;
      const ba = buildOne(A); if (!ba) continue;
      const stab = A.types.includes(mv.type) ? 1.5 : 1;
      const dmin = minSpreadDamage(mv.basePower, mv.category === 'Physical' ? ba.at : ba.sa,
        mv.category === 'Physical' ? bt.df : bt.sd, stab, eff);
      if (!(dmin >= bt.hp)) continue;                   // lethal from full even at the spread rate
      rows.push({ mv, A, T, ba, bt, eff, dmin, margin: dmin - bt.hp });
    }
  }
}
console.log('  bodies asked of the builder        : ' + built.size + ', of which ' + BUILD_FAILED.length
  + ' would not build' + (BUILD_FAILED.length ? '   e.g. ' + BUILD_FAILED.slice(0, 3).join(' | ') : ''));
if (BUILD_FAILED.length && BUILD_FAILED.length === built.size) {
  console.log('  RED — NOTHING BUILT AT ALL. That is the BUILDER, not the format.'); process.exit(1);
}
if (!rows.length) { console.log('  NO LETHAL-FROM-FULL selfBoost SWING EXISTS — a claim about the fixture.'); process.exit(2); }
rows.sort((a, b) => b.margin - a.margin || a.mv.id.localeCompare(b.mv.id)
  || a.A.name.localeCompare(b.A.name) || a.T.name.localeCompare(b.T.name));

/* ---- THE PIECES EACH CANDIDATE NEEDS. Refused BY TAG and printed, never by name. */
const REFUSE_T = new Set(['onSwitchInDrop', 'statDropOnEntry', 'damageReduce', 'survivesFromFull',
  'absorbsMoveType', 'immuneToMoveClass', 'punishesContact', 'reflectsStatus', 'noRecoil',
  'formeAbsorbsHit', 'halvesTypeDamage', 'boostsOwnStatOnHit']);
/* NOT `REFUSE_T` PLUS EXTRAS. That is the DEFENDER'S list — `immuneToMoveClass` on the attacker says
 * nothing about its own stat drop, and inheriting it refused all three of Kommo-o's abilities and
 * un-staged this probe on its first run. This is exactly the handlers that touch either the drop
 * itself or the size of the hit the fixture depends on. */
const REFUSE_A = new Set(['invertsBoosts', 'preventsStatDrop', 'amplifiesBoosts', 'boostsWhenLowered',
  'boostsOnKO', 'damageBoost', 'writesAccuracy', 'accuracyMod']);
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const pickAbility = (sp, refuse) => Object.values(sp.abilities)
  .find(ab => !abilityTags(ab).some(t => refuse.has(t))) || null;

/* THE HOLD MOVE: a self-target Status move that neither shields nor leaves nor sleeps. Protect and
 * Substitute would REFUSE the Memento and un-stage the run; Rest would sleep the body. */
const SELF_HOLD = (s) => {
  const bad2 = new Set(['rest', 'sleeptalk', 'substitute', 'endure', 'protect', 'wish', 'charge', 'doubleteam']);
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (bad2.has(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge;
  }) || null;
};

const MEMENTO_POOL = POOL.filter(s => LEARNS(s, 'memento') && !G.CLOSET_SPECIES.has(norm(s.id)));
if (MEMENTO_POOL.length < 2) { console.log('  FEWER THAN TWO MEMENTO CARRIERS — a claim about the format.'); process.exit(2); }

/* ---- THE CHIP, AND WHY THE FIXTURE NEEDS ONE. -------------------------------------------------
 * The NOT-WIPED arm has TWO bodies on the field, so its swing pays the doubles spread modifier and
 * the WIPE arm's does not. Measured rather than argued: without a chip the same Clanging Scales
 * left Flapple on 7/145, Tyrantrum on 17, Dragapult on 47 — every one of the top eight candidates
 * survived the spread hit, so the two arms were not comparable at all.
 *
 * A FIXED-DAMAGE MOVE, not a second attack, because `damage: 'level'` deals exactly the level with
 * no roll, no crit and no type multiplier on the AMOUNT (`sim/battle-actions.ts` returns
 * `move.damage === 'level' ? pokemon.level : move.damage`). So the HP going into the swing is an
 * exact number in both arms and in both engines, which is the same reason
 * `probe_pickpocket_event_position.js` uses one. */
const CHIPS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.damage === 'level'
  && (m.accuracy === true || m.accuracy === 100) && m.target === 'normal');
console.log('  fixed `level`-damage moves legal here: '
  + (CHIPS.map(m => m.id + ' (' + m.type + ')').join(', ') || 'NONE'));
if (!CHIPS.length) { console.log('  NO FIXED-DAMAGE CHIP — a claim about the format.'); process.exit(2); }
const CHIP_LEVEL = 50;   /* the differential builds every body at L50 — `natureL50` */

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });

/* Build everything a candidate needs, or say which piece is missing. */
const stage = (Cd) => {
  const T_AB = pickAbility(Cd.T, REFUSE_T);
  if (!T_AB) return { why: 'every ability on the target ' + Cd.T.name + ' touches the hit' };
  const A_AB = pickAbility(Cd.A, REFUSE_A);
  if (!A_AB) return { why: 'every ability on the attacker ' + Cd.A.name + ' touches the boost' };
  const T_HOLD = SELF_HOLD(Cd.T), A_HOLD = SELF_HOLD(Cd.A);
  if (!T_HOLD || !A_HOLD) return { why: 'no safe self-move for ' + Cd.T.name + ' / ' + Cd.A.name };
  /* THE FOURTH BODY ON THE DEFENDING SIDE IS WHAT THE TWO ARMS SWAP. In the WIPE arm it is a THIRD
   * self-remover, so the swing meets the target alone and empties the side; in the NOT-WIPED arm it
   * is a body IMMUNE BY TYPE — `dex.getImmunity(type, species) === false` is the type chart's own
   * answer, so no roll and no crit can kill it and the side survives the same KO.
   *
   * THE CONFOUND IS STATED RATHER THAN HIDDEN: the WIPE arm's swing therefore meets ONE body and
   * the NOT-WIPED arm's meets two, so the two pay different spread modifiers. That cannot explain
   * the finding — a spread modifier scales DAMAGE and cannot suppress a `-unboost` — and the
   * AUTHORITY is the control on it: showdown itself pays the drop on one board and not on the
   * other, and this probe requires medicham2 to match it on BOTH. In doubles a side cannot have one
   * body on the field and a body on the bench at the same time, so no fixture removes it. */
  const IMMUNE = POOL.filter(s => !dex.getImmunity(Cd.mv.type, s) && s.name !== Cd.A.name
    && s.name !== Cd.T.name && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
  if (!IMMUNE.length) return { why: 'no body immune to ' + Cd.mv.type };
  const SURV = IMMUNE[0];
  const MEM = MEMENTO_POOL.filter(s => ![Cd.A.name, Cd.T.name, SURV.name].includes(s.name)).slice(0, 3);
  if (MEM.length < 3) return { why: 'not enough Memento carriers left after the fixture' };
  /* THE CHIP MUST LAND ON THE TARGET AND MUST NOT KILL IT BEFORE THE SWING. Both halves are read
   * off the format: the type chart says whether the target is immune, and the chip is exactly the
   * level, so `CHIP_LEVEL < built max HP` is the whole of the second half. */
  if (!(CHIP_LEVEL < Cd.bt.hp)) return { why: Cd.T.name + ' would die to the chip alone' };
  const chipPairs = [];
  for (const m of CHIPS) {
    if (!dex.getImmunity(m.type, Cd.T)) continue;
    for (const s of POOL) {
      if ([Cd.A.name, Cd.T.name, SURV.name].includes(s.name)) continue;
      if (MEM.some(x => x.name === s.name) || G.CLOSET_SPECIES.has(norm(s.id))) continue;
      if (!LEARNS(s, m.id) || !SELF_HOLD(s)) continue;
      chipPairs.push({ m, s });
    }
  }
  if (!chipPairs.length) return { why: 'no partner carries a chip ' + Cd.T.name + ' is not immune to' };
  const CHIP = chipPairs[0];
  const PART = [CHIP.s, ...POOL.filter(s => ![Cd.A.name, Cd.T.name, SURV.name, CHIP.s.name].includes(s.name)
    && !MEM.some(m => m.name === s.name) && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 2)];
  if (PART.length < 3) return { why: 'not enough filler' };
  return { C: Cd, T_AB, A_AB, T_HOLD, A_HOLD, SURV, MEM, CHIP,
           P: PART, P_HOLD: PART.map(s => SELF_HOLD(s)) };
};

/* ---- ONE GAME. `wipe` decides ONLY which body stands beside the target. ------------------------ */
const runArm = (S, wipe, tag) => {
  const Cd = S.C;
  const fourth = wipe ? S.MEM[2] : S.SURV;
  const sideA = [
    mon(Cd.A.name, [Cd.mv.name, S.A_HOLD], '', S.A_AB),
    mon(S.P[0].name, [S.P_HOLD[0], S.CHIP.m.name]),
    mon(S.P[1].name, [S.P_HOLD[1]]), mon(S.P[2].name, [S.P_HOLD[2]]),
  ];
  const sideB = [
    mon(Cd.T.name, [S.T_HOLD], '', S.T_AB),
    ...S.MEM.slice(0, 2).map(s => mon(s.name, ['Memento'])),
    wipe ? mon(fourth.name, ['Memento'])
         : mon(fourth.name, [SELF_HOLD(fourth)], '', pickAbility(fourth, REFUSE_T) || ''),
  ];
  const t3b = wipe ? { m: 'memento', t: 1 } : { m: norm(SELF_HOLD(fourth)) };
  const t4b = wipe ? null : { m: norm(SELF_HOLD(fourth)) };
  const SCRIPT = [
    { p1: [{ m: norm(S.A_HOLD) }, { m: norm(S.P_HOLD[0]) }], p2: [{ m: norm(S.T_HOLD) }, { m: 'memento', t: 1 }] },
    { p1: [{ m: norm(S.A_HOLD) }, { m: norm(S.P_HOLD[0]) }], p2: [{ m: norm(S.T_HOLD) }, { m: 'memento', t: 1 }] },
    { p1: [{ m: norm(S.A_HOLD) }, { m: norm(S.CHIP.m.id), t: 0 }], p2: [{ m: norm(S.T_HOLD) }, t3b] },
    { p1: [{ m: norm(Cd.mv.id), t: 0 }, { m: norm(S.P_HOLD[0]) }],
      p2: t4b ? [{ m: norm(S.T_HOLD) }, t4b] : [{ m: norm(S.T_HOLD) }] },
  ];
  const a = G.buildPair(sideA), b = G.buildPair(sideB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const r = G.playGame(a, b, 'directed', 'selfboostemptyfoe/' + tag,
    { arm: G.ARM_BY_ID.get('middle'), script: SCRIPT });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sdLog = G.lastSdLog();
  const p2 = ((r.finalRoster && r.finalRoster.showdown && r.finalRoster.showdown.p2) || {}).mons || [];
  const tgt = p2.find(x => norm(x.key || x.name) === norm(Cd.T.name));
  const DROP_STAT = Object.keys(Cd.mv.selfBoost.boosts).find(k => Cd.mv.selfBoost.boosts[k] < 0);
  const count = (lines) => lines.filter(l => {
    const p = String(l).split('|');
    return p[1] === '-unboost' && norm(String(p[2] || '').split(':')[1] || '') === norm(Cd.A.name)
      && p[3] === DROP_STAT;
  }).length;
  return { staged: true, r, DROP_STAT,
           foeLeft: p2.filter(x => !x.fainted).length, targetFainted: !!(tgt && tgt.fainted),
           roster: p2.map(x => (x.key || x.name) + (x.fainted ? ':fnt' : ':' + x.hp)),
           sdDrops: count(sdLog), meDrops: count(r.mediTrace || []),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, endReason: r.endReason };
};

/* ---- THE SEARCH IS A RUN, NOT A MODEL. Walk the ordered candidates and PLAY the harder arm; the
 * first one that actually kills the target while the survivor stands is the fixture. */
const TRIES = 8;
let S = null, LIVE = null, tried = 0;
const seen = new Set();
console.log('  candidates ranked by modelled margin, then PLAYED (the model only orders them):');
for (const Cd of rows) {
  if (tried >= TRIES) break;
  /* KEYED ON THE WHOLE TRIPLE, NOT ON THE ATTACKER. Keying on `move/attacker` stopped the walk dead
   * after ONE try, because this format has exactly one legal carrier of the only usable selfBoost
   * move — and a search that gives up after one candidate reports NOT STAGED as if it were a fact
   * about the format. */
  const label = Cd.mv.id + '/' + Cd.A.name + '/' + Cd.T.name;
  const key = label;
  if (seen.has(key)) continue;
  const st = stage(Cd);
  if (st.why) { console.log('      skip  ' + label.padEnd(46) + st.why); continue; }
  tried++; seen.add(key);
  const live = runArm(st, false, 'probe-notwiped');
  if (!live.staged) { console.log('      skip  ' + label.padEnd(46) + 'NOT STAGED: ' + live.why); continue; }
  const ok = live.targetFainted && live.foeLeft === 1;
  console.log('      ' + (ok ? 'TAKE' : 'no  ') + '  ' + label.padEnd(46)
    + 'not-wiped arm: target ' + (live.targetFainted ? 'died' : 'SURVIVED') + ', ' + live.foeLeft
    + ' standing   ' + JSON.stringify(live.roster));
  if (ok) { S = st; LIVE = live; break; }
}
if (!S) {
  console.log('  NO CANDIDATE STAGED IN ' + tried + ' TRIES — a claim about the fixture, not about the '
    + 'engine. Nothing was measured.'); process.exit(2);
}
const C = S.C, DROP_STAT = LIVE.DROP_STAT;
console.log('\n  chosen  : ' + C.A.name + ' [' + S.A_AB + '] clicks ' + C.mv.id + '  '
  + JSON.stringify(C.mv.selfBoost.boosts) + '  into ' + C.T.name + ' [' + S.T_AB + ']');
console.log('            the fourth defender: a THIRD Memento (' + S.MEM[2].name + ') in the WIPE arm  |  '
  + S.SURV.name + ' in the NOT-WIPED arm (' + S.SURV.types.join('/') + ', immune to ' + C.mv.type + ')');
console.log('            the chip                 : ' + S.P[0].name + ' clicks ' + S.CHIP.m.id
  + ' (' + S.CHIP.m.type + ', fixed ' + CHIP_LEVEL + ') at the target on turn 3, in BOTH arms — without it '
  + 'the spread modifier leaves the target alive and the arms are not comparable');
console.log('            the self-removers        : ' + S.MEM.map(s => s.name).join(', ')
  + '   (Memento is aimed at ' + S.P[0].name + ', the attacker\'s partner, never at the attacker)');
console.log('            THE AUTHORITY refuses the ' + DROP_STAT + ' drop at sim/battle.ts:2028 once '
  + 'the other side is empty, and pays it whenever it is not.');

console.log('\n  === THE WIPE ARM — the swing empties the other side ===');
const WIPE = runArm(S, true, CHILD ? 'control' : 'wipe');
if (!WIPE.staged) { console.log('  NOT STAGED — ' + WIPE.why); process.exit(1); }
console.log('  end reason               : ' + WIPE.endReason);
console.log('  defending side, showdown : ' + WIPE.foeLeft + ' standing   ' + JSON.stringify(WIPE.roster));
console.log('  `-unboost ' + DROP_STAT + '` on ' + C.A.name + ' : showdown ' + WIPE.sdDrops
  + '     medicham2 ' + WIPE.meDrops);
console.log('  first protocol divergence: ' + (WIPE.div ? JSON.stringify(WIPE.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — the same click, one body left standing ===');
const LIVE2 = CHILD ? runArm(S, false, 'silent-control') : LIVE;
if (!LIVE2.staged) { console.log('  NOT STAGED — ' + LIVE2.why); process.exit(1); }
console.log('  defending side, showdown : ' + LIVE2.foeLeft + ' standing   ' + JSON.stringify(LIVE2.roster));
console.log('  the target itself        : ' + (LIVE2.targetFainted ? 'FAINTED — the same KO happened' : 'STILL STANDING'));
console.log('  `-unboost ' + DROP_STAT + '` on ' + C.A.name + ' : showdown ' + LIVE2.sdDrops
  + '     medicham2 ' + LIVE2.meDrops);

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_SELFBOOST_IGNORES_EMPTY_FOE_SIDE=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    wipeMe: WIPE.meDrops, wipeSd: WIPE.sdDrops, div: !!WIPE.div, divLine: WIPE.div && WIPE.div.me,
    liveMe: LIVE2.meDrops, liveSd: LIVE2.sdDrops, liveLeft: LIVE2.foeLeft,
  }));
  console.log('\ngreen — the control arm ran');
  process.exit(0);
}

console.log('\n  === THE VERDICT ===');
const need = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + JSON.stringify(got)
    + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
  return ok;
};
/* THE FIXTURE FIRST. Without the wipe there is no refusal to observe and every assertion under it
 * would be measuring nothing. */
need('the defending side was WIPED by the swing (the fixture)', WIPE.foeLeft, 0);
need('the NOT-WIPED arm left exactly one body standing (the fixture)', LIVE2.foeLeft, 1);
need('...and it killed the same target (the two arms share the KO)', LIVE2.targetFainted, true);
/* THE AUTHORITY SECOND, as a control on the derivation rather than a restatement of it. If showdown
 * paid the drop on the wiping turn then the rule above is simply wrong and nothing else matters. */
need('showdown does NOT announce the drop when the other side is empty (the authority)', WIPE.sdDrops, 0);
need('showdown DOES announce it when a body is left standing (the authority, the other way)', LIVE2.sdDrops, 1);
/* THEN THE ENGINE. */
need('medicham2 refuses it too', WIPE.meDrops, 0);
need('medicham2 still pays it when the side is not empty', LIVE2.meDrops, 1);
need('the wiping game does not part at all', WIPE.div, null);
need('the not-wiped game does not part at all', LIVE2.div, null);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_SELFBOOST_IGNORES_EMPTY_FOE_SIDE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_SELFBOOST_IGNORES_EMPTY_FOE_SIDE: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.wipeMe !== WIPE.meDrops;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the wiping arm: default '
      + WIPE.meDrops + ' drop(s)  vs control ' + ctl.wipeMe);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.wipeMe !== 1) { console.log('  RED    the control arm did not pay exactly one drop, so it is not the old behaviour.'); bad++; }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on its own line: ' + ctl.divLine);
    if (ctl.liveMe !== LIVE2.meDrops || ctl.liveLeft !== LIVE2.foeLeft) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob (' + LIVE2.meDrops + '/' + LIVE2.foeLeft
        + ' -> ' + ctl.liveMe + '/' + ctl.liveLeft + '). The knob reaches further than the empty-side refusal.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (' + ctl.liveMe + ' drop, '
      + ctl.liveLeft + ' standing)');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
