/* probe_pivot_after_battle_end.js — A PIVOT THAT TAKES THE LAST BODY DOWN DOES NOT PIVOT. THE
 * BATTLE IS OVER BEFORE THE SWITCH REQUEST IS EVER MADE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_pivot_after_battle_end.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `c273d4301fd1`
 * (`data/game-differential.json`, 961 games, census `census-pin-9446a684709d`, pool
 * `data/team-pool-frozen`), TWO board-material games, one with the `any`-bucket verdict SHARED
 * COINS and one instrument-suspect, both the same click:
 *
 *   showdown stopped emitting while medicham2 continued :: |switch|p2a|pelipper,l50|H/H
 *   showdown stopped emitting while medicham2 continued :: |switch|p1a|archaludon,l50|H/H
 *
 *     showdown   |move|p2a: Swampert|Flip Turn|p1a: Pelipper
 *                |-resisted|p1a: Pelipper
 *                |-damage|p1a: Pelipper|0 fnt
 *                |faint|p1a: Pelipper
 *                (nothing further)
 *     medicham2  ...the same four lines, and then
 *                |switch|p2a: Pelipper|pelipper, L50|71/135|[from] flipturn
 *
 * THE RULE, READ OFF THE AUTHORITY. `selfSwitch` does not switch anybody. It sets a FLAG
 * (`source.switchFlag = move.id`, sim/battle-actions.ts:1311) and `Battle#runAction` turns that flag
 * into a switch request LATER — and there are two statements in between:
 *
 *     this.faintMessages();                                                  sim/battle.ts:2832
 *     if (this.ended) return true;                                                        :2833
 *     ...
 *     const switches = this.sides.map(side => side.active.some(p => p && !!p.switchFlag));  :2874
 *     for (const playerSwitch of switches) if (playerSwitch) { this.makeRequest('switch'); …  :2906
 *
 * That `faintMessages()` takes its default `checkWin = true` — unlike the one inside the hit loop,
 * which is called as `faintMessages(false, false, !pokemon.hp)` (scripts.ts:547) — so a move that
 * empties the other side wins the battle HERE, and `:2833` returns above the switch block. The flag
 * stays set on a body that never leaves.
 *
 * WHY THIS ENGINE MISSED IT. medicham2's own win test is `if (sideWiped(S)) break _TURN` at the TOP
 * OF THE NEXT ACTION — its `_stepAfterFaint` header says exactly that — so between the wiping KO and
 * the next action it keeps paying things the authority has already stopped paying. This is the same
 * window `probe_selfboost_empty_foe_side.js` closes one clause down, and it is a DIFFERENT clause:
 * that one is `boost()`'s own `foePokemonLeft` refusal at sim/battle.ts:2028, this one is the battle
 * having ended. Both had to be wired, and each is measured alone.
 *
 * THE FIXTURE. The defending side is one TARGET that never moves plus three self-removing bodies,
 * and the attacker swings once, on the turn the bench is empty. The two arms differ in ONE thing —
 * whether the fourth defender removes itself:
 *
 *   WIPE       a third Memento carrier   -> the swing meets the target alone and empties the side
 *   NOT-WIPED  an ordinary body that holds -> the same KO, one body still standing
 *
 * THE PIVOT MOVES ARE SINGLE-TARGET, so unlike the selfBoost probe both arms swing at exactly one
 * body and there is no spread modifier anywhere: the two boards differ ONLY in whether the side
 * emptied.
 *
 * THE ARMS:
 *   WIPE      the authority emits NO `|switch|` for the attacker's slot. This engine must not either.
 *   NOT-WIPED the SILENT CONTROL: the same click, the same KO, one body left — and the pivot MUST
 *             happen, in both engines and under both knob settings.
 *   CONTROL   the WIPE arm under `MEDI_PIVOT_AFTER_BATTLE_END=1`. It must PART from the authority;
 *             an identical result across a varied knob means the knob is unwired.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_PIVOT_AFTER_BATTLE_END === '1';
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

/* ---- THE MOVE IS THE TAG'S, NEVER A NAME. `pivotDamaging` is the family that deals damage and then
 * leaves; it must be always-hit and single-target so the fixture carries no die and no spread. */
const PIVOTS = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('pivotDamaging'))
  .map(([k, v]) => ({ m: dex.moves.get(k), uses: v.uses || 0 }))
  .filter(x => x.m.exists && !x.m.isNonstandard);
console.log('  moves tagged `pivotDamaging` in this format:');
for (const x of PIVOTS) console.log('      ' + x.m.id.padEnd(12) + ' bp ' + String(x.m.basePower).padEnd(4)
  + x.m.type + '/' + x.m.category + '  acc ' + x.m.accuracy + '  target ' + x.m.target
  + '  (' + x.uses + ' sheets)');
const PV = PIVOTS.filter(x => (x.m.accuracy === true || x.m.accuracy === 100) && x.m.target === 'normal')
  .sort((a, b) => b.uses - a.uses);
if (!PV.length) { console.log('  NO 100-ACCURACY SINGLE-TARGET PIVOT — a claim about the format.'); process.exit(2); }

/* ---- THE BUILT STAT LINE IS THE BUILDER'S. A body that will not build is COUNTED and NAMED. */
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
        if (typeof st[k] !== 'number') throw new Error('built stat line has no numeric `' + k + '`');
      }
      row = { hp: st.hp, at: st.at, df: st.df, sa: st.sa, sd: st.sd };
    } else BUILD_FAILED.push(s.name + ': buildPair returned null');
  } catch (e) { BUILD_FAILED.push(s.name + ': ' + String((e && e.message) || e)); }
  built.set(s.name, row);
  return row;
};

/* Showdown's own damage line, minimum roll, level 50, no boosts and no weather. It ORDERS the
 * candidate list and nothing rests on it — every candidate is PLAYED before it is used. That split
 * is not decoration: `probe_selfboost_empty_foe_side.js` modelled 292 into a 145-HP body and the
 * swing dealt 138. */
const minDamage = (bp, atk, def, stab, eff) => {
  let d = Math.floor(Math.floor(Math.floor(2 * 50 / 5 + 2) * bp * atk / def) / 50) + 2;
  d = Math.floor(Math.floor(d * stab) * eff);
  return Math.floor(d * 85 / 100);
};

const rows = [];
for (const { m: mv } of PV) {
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
      const dmin = minDamage(mv.basePower, mv.category === 'Physical' ? ba.at : ba.sa,
        mv.category === 'Physical' ? bt.df : bt.sd, stab, eff);
      rows.push({ mv, A, T, ba, bt, eff, dmin, margin: dmin - bt.hp });
    }
  }
}
console.log('  bodies asked of the builder        : ' + built.size + ', of which ' + BUILD_FAILED.length
  + ' would not build' + (BUILD_FAILED.length ? '   e.g. ' + BUILD_FAILED.slice(0, 3).join(' | ') : ''));
if (BUILD_FAILED.length && BUILD_FAILED.length === built.size) {
  console.log('  RED — NOTHING BUILT AT ALL. That is the BUILDER, not the format.'); process.exit(1);
}
if (!rows.length) { console.log('  NO PIVOT/TARGET PAIR AT ALL — a claim about the format.'); process.exit(2); }
rows.sort((a, b) => b.margin - a.margin || a.mv.id.localeCompare(b.mv.id)
  || a.A.name.localeCompare(b.A.name) || a.T.name.localeCompare(b.T.name));

const REFUSE_T = new Set(['onSwitchInDrop', 'statDropOnEntry', 'damageReduce', 'survivesFromFull',
  'absorbsMoveType', 'immuneToMoveClass', 'punishesContact', 'reflectsStatus', 'noRecoil',
  'formeAbsorbsHit', 'halvesTypeDamage', 'boostsOwnStatOnHit']);
/* THE ATTACKER'S LIST IS ITS OWN. What could answer this question from the wrong end is anything
 * that decides whether the body LEAVES the field — an entry/exit heal, an escape refusal — or that
 * changes the size of the hit the fixture rests on. */
const REFUSE_A = new Set(['healsOnSwitchOut', 'trapsOnSwitch', 'damageBoost', 'writesAccuracy',
  'accuracyMod', 'speedOnItemLoss']);
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const pickAbility = (sp, refuse) => Object.values(sp.abilities)
  .find(ab => !abilityTags(ab).some(t => refuse.has(t))) || null;

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
if (MEMENTO_POOL.length < 3) { console.log('  FEWER THAN THREE MEMENTO CARRIERS — a claim about the format.'); process.exit(2); }

/* A fixed-damage chip, for the same reason `probe_pickpocket_event_position.js` uses one: it deals
 * exactly the level with no roll, no crit and no type multiplier on the AMOUNT, so the HP going into
 * the swing is an exact number in both arms and in both engines. */
const CHIPS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.damage === 'level'
  && (m.accuracy === true || m.accuracy === 100) && m.target === 'normal');
console.log('  fixed `level`-damage moves legal here: '
  + (CHIPS.map(m => m.id + ' (' + m.type + ')').join(', ') || 'NONE'));
if (!CHIPS.length) { console.log('  NO FIXED-DAMAGE CHIP — a claim about the format.'); process.exit(2); }
const CHIP_LEVEL = 50;
const SWING_TURN = 4;   /* the script's fourth step — the only turn the attacker swings */

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });

const stage = (Cd) => {
  const T_AB = pickAbility(Cd.T, REFUSE_T);
  if (!T_AB) return { why: 'every ability on the target ' + Cd.T.name + ' touches the hit' };
  const A_AB = pickAbility(Cd.A, REFUSE_A);
  if (!A_AB) return { why: 'every ability on the attacker ' + Cd.A.name + ' touches the exit' };
  const T_HOLD = SELF_HOLD(Cd.T), A_HOLD = SELF_HOLD(Cd.A);
  if (!T_HOLD || !A_HOLD) return { why: 'no safe self-move for ' + Cd.T.name + ' / ' + Cd.A.name };
  if (!(CHIP_LEVEL < Cd.bt.hp)) return { why: Cd.T.name + ' would die to the chip alone' };
  /* THE FOURTH DEFENDER IS WHAT THE TWO ARMS SWAP: a third self-remover, or an ordinary body that
   * stands there. It is never targeted, so it needs no type immunity and no bulk — only a legal
   * self-target move to click. */
  const MEM = MEMENTO_POOL.filter(s => ![Cd.A.name, Cd.T.name].includes(s.name)).slice(0, 3);
  if (MEM.length < 3) return { why: 'not enough Memento carriers left after the fixture' };
  const SPARE = POOL.find(s => ![Cd.A.name, Cd.T.name].includes(s.name)
    && !MEM.some(m => m.name === s.name) && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
  if (!SPARE) return { why: 'no ordinary fourth defender' };
  const chipPairs = [];
  for (const m of CHIPS) {
    if (!dex.getImmunity(m.type, Cd.T)) continue;
    for (const s of POOL) {
      if ([Cd.A.name, Cd.T.name, SPARE.name].includes(s.name)) continue;
      if (MEM.some(x => x.name === s.name) || G.CLOSET_SPECIES.has(norm(s.id))) continue;
      if (!LEARNS(s, m.id) || !SELF_HOLD(s)) continue;
      chipPairs.push({ m, s });
    }
  }
  if (!chipPairs.length) return { why: 'no partner carries a chip ' + Cd.T.name + ' is not immune to' };
  const CHIP = chipPairs[0];
  const PART = [CHIP.s, ...POOL.filter(s => ![Cd.A.name, Cd.T.name, SPARE.name, CHIP.s.name].includes(s.name)
    && !MEM.some(m => m.name === s.name) && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 2)];
  if (PART.length < 3) return { why: 'not enough filler' };
  return { C: Cd, T_AB, A_AB, T_HOLD, A_HOLD, MEM, SPARE, CHIP,
           P: PART, P_HOLD: PART.map(s => SELF_HOLD(s)) };
};

const runArm = (S, wipe, tag) => {
  const Cd = S.C;
  const fourth = wipe ? S.MEM[2] : S.SPARE;
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
  const r = G.playGame(a, b, 'directed', 'pivotafterend/' + tag,
    { arm: G.ARM_BY_ID.get('middle'), script: SCRIPT });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sdLog = G.lastSdLog();
  const fr = r.finalRoster || {};
  const p2 = ((fr.showdown && fr.showdown.p2) || {}).mons || [];
  const tgt = p2.find(x => norm(x.key || x.name) === norm(Cd.T.name));
  /* THE OUTCOME IS A `|switch|` LINE FOR THE ATTACKER'S OWN SLOT ON THE SWINGING TURN, read off both
   * streams — and the WINDOW is the whole of the correction. Counting `|switch|p1a:` over the entire
   * log read THREE in every arm: the script is four turns long and the driver keeps playing to the
   * turn cap afterwards, switching on its own policy, so the count was measuring the driver rather
   * than the pivot. Bounded to `|turn|<swing>` .. the next `|turn|`, which is exactly the action the
   * fixture is about. */
  const window = (lines) => {
    const a = lines.findIndex(l => String(l) === '|turn|' + SWING_TURN);
    if (a < 0) return [];
    const rest = lines.slice(a + 1);
    const b = rest.findIndex(l => /^\|turn\|/.test(String(l)));
    return b < 0 ? rest : rest.slice(0, b);
  };
  /* AND THE AUTHORITY'S RAW LOG CARRIES EVERY SPLIT LINE TWICE. `Battle#add('split', side, …)`
   * writes `|split|pN` and then the OMNISCIENT line followed by the SPECTATOR line, so an unfiltered
   * count read 2 pivots in every arm — the fixture looked un-stageable when nothing was wrong with
   * it. The line at `i+2` after a `|split|` is the second view of the line at `i+1`; only the first
   * is kept. medicham2's trace contains no `|split|` at all, so the same filter is a no-op there and
   * both streams are counted through one function. */
  const dedupeSplit = (lines) => {
    const drop = new Set();
    lines.forEach((l, i) => { if (/^\|split\|/.test(String(l))) drop.add(i + 2); });
    return lines.filter((l, i) => !drop.has(i) && !/^\|split\|/.test(String(l)));
  };
  const pivots = (lines) => dedupeSplit(window(lines)).filter(l => /^\|switch\|p1a:/.test(String(l))).length;
  return { staged: true, r,
           foeLeft: p2.filter(x => !x.fainted).length, targetFainted: !!(tgt && tgt.fainted),
           roster: p2.map(x => (x.key || x.name) + (x.fainted ? ':fnt' : ':' + x.hp)),
           /* minus the LEAD, which is a `|switch|` line too */
           sdPivots: pivots(sdLog), mePivots: pivots(r.mediTrace || []),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, endReason: r.endReason };
};

const TRIES = 8;
let S = null, LIVE = null, tried = 0;
const seen = new Set();
console.log('  candidates ranked by modelled margin, then PLAYED (the model only orders them):');
for (const Cd of rows) {
  if (tried >= TRIES) break;
  const label = Cd.mv.id + '/' + Cd.A.name + '/' + Cd.T.name;
  if (seen.has(label)) continue;
  const st = stage(Cd);
  if (st.why) { console.log('      skip  ' + label.padEnd(44) + st.why); continue; }
  tried++; seen.add(label);
  const live = runArm(st, false, 'probe-notwiped');
  if (!live.staged) { console.log('      skip  ' + label.padEnd(44) + 'NOT STAGED: ' + live.why); continue; }
  const ok = live.targetFainted && live.foeLeft === 1 && live.sdPivots === 1;
  console.log('      ' + (ok ? 'TAKE' : 'no  ') + '  ' + label.padEnd(44)
    + 'not-wiped arm: target ' + (live.targetFainted ? 'died' : 'SURVIVED') + ', ' + live.foeLeft
    + ' standing, showdown pivoted ' + live.sdPivots + 'x');
  if (ok) { S = st; LIVE = live; break; }
}
if (!S) {
  console.log('  NO CANDIDATE STAGED IN ' + tried + ' TRIES — a claim about the fixture, not about the '
    + 'engine. Nothing was measured.'); process.exit(2);
}
const C = S.C;
console.log('\n  chosen  : ' + C.A.name + ' [' + S.A_AB + '] clicks ' + C.mv.id + ' into '
  + C.T.name + ' [' + S.T_AB + ']');
console.log('            the fourth defender: a THIRD Memento (' + S.MEM[2].name + ') in the WIPE arm  |  '
  + S.SPARE.name + ', which simply stands there, in the NOT-WIPED arm');
console.log('            the chip                 : ' + S.P[0].name + ' clicks ' + S.CHIP.m.id
  + ' (' + S.CHIP.m.type + ', fixed ' + CHIP_LEVEL + ') at the target on turn 3, in BOTH arms');
console.log('            the self-removers        : ' + S.MEM.map(s => s.name).join(', ')
  + '   (Memento is aimed at ' + S.P[0].name + ', the attacker\'s partner, never at the attacker)');
console.log('            THE AUTHORITY wins the battle at sim/battle.ts:2832 and returns at :2833, '
  + 'above the switch request at :2874 — so the flag is set on a body that never leaves.');

console.log('\n  === THE WIPE ARM — the pivot empties the other side ===');
const WIPE = runArm(S, true, CHILD ? 'control' : 'wipe');
if (!WIPE.staged) { console.log('  NOT STAGED — ' + WIPE.why); process.exit(1); }
console.log('  end reason               : ' + WIPE.endReason);
console.log('  defending side, showdown : ' + WIPE.foeLeft + ' standing   ' + JSON.stringify(WIPE.roster));
console.log('  the attacker pivoted     : showdown ' + WIPE.sdPivots + 'x     medicham2 ' + WIPE.mePivots + 'x');
console.log('  first protocol divergence: ' + (WIPE.div ? JSON.stringify(WIPE.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — the same click and the same KO, one body left standing ===');
const LIVE2 = CHILD ? runArm(S, false, 'silent-control') : LIVE;
if (!LIVE2.staged) { console.log('  NOT STAGED — ' + LIVE2.why); process.exit(1); }
console.log('  defending side, showdown : ' + LIVE2.foeLeft + ' standing   ' + JSON.stringify(LIVE2.roster));
console.log('  the target itself        : ' + (LIVE2.targetFainted ? 'FAINTED — the same KO happened' : 'STILL STANDING'));
console.log('  the attacker pivoted     : showdown ' + LIVE2.sdPivots + 'x     medicham2 ' + LIVE2.mePivots + 'x');

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_PIVOT_AFTER_BATTLE_END=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    wipeMe: WIPE.mePivots, wipeSd: WIPE.sdPivots, div: !!WIPE.div, divLine: WIPE.div && WIPE.div.me,
    liveMe: LIVE2.mePivots, liveSd: LIVE2.sdPivots, liveLeft: LIVE2.foeLeft,
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
need('the defending side was WIPED by the pivot click (the fixture)', WIPE.foeLeft, 0);
need('the NOT-WIPED arm left exactly one body standing (the fixture)', LIVE2.foeLeft, 1);
need('...and it killed the same target, so the arms differ ONLY in the wipe', LIVE2.targetFainted, true);
need('showdown does NOT pivot when the click ended the battle (the authority)', WIPE.sdPivots, 0);
need('showdown DOES pivot when a body is left standing (the authority, the other way)', LIVE2.sdPivots, 1);
need('medicham2 does not pivot either', WIPE.mePivots, 0);
need('medicham2 still pivots when the battle is not over', LIVE2.mePivots, 1);
need('the wiping game does not part at all', WIPE.div, null);
need('the not-wiped game does not part at all', LIVE2.div, null);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_PIVOT_AFTER_BATTLE_END=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_PIVOT_AFTER_BATTLE_END: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.wipeMe !== WIPE.mePivots;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the wiping arm: default '
      + WIPE.mePivots + ' pivot(s)  vs control ' + ctl.wipeMe);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.wipeMe !== 1) { console.log('  RED    the control arm did not pivot exactly once, so it is not the old behaviour.'); bad++; }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on its own line: ' + ctl.divLine);
    if (ctl.liveMe !== LIVE2.mePivots || ctl.liveLeft !== LIVE2.foeLeft) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob (' + LIVE2.mePivots + '/' + LIVE2.foeLeft
        + ' -> ' + ctl.liveMe + '/' + ctl.liveLeft + '). The knob reaches further than the wiping click.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (' + ctl.liveMe + ' pivot, '
      + ctl.liveLeft + ' standing)');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
