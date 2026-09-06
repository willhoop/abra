/* probe_pickpocket_event_position.js — PICKPOCKET IS `onAfterMoveSecondary`, WHICH THE AUTHORITY
 * RAISES *BELOW* THE RECOIL AND *BELOW* THE SECOND UPDATE PASS. THIS ENGINE RAISED IT INSIDE THE HIT
 * LOOP, SO IT STOLE A BERRY THE ATTACKER HAD ALREADY EATEN.
 *
 *   SHOWDOWN_PATH=... node tests/probe_pickpocket_event_position.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `9af3f4fcad16`
 * (`data/verification/longtail-E-secondupdate.json`, 961 games, census `census-pin-9446a684709d`,
 * pool `data/team-pool-frozen`), one board-material game, and the `any`-dice join says its coins were
 * SHARED — so the simulator owns it:
 *
 *     extra event emitted by medicham2 :: |-damage|p2a|H/H|[from]recoil <> |-enditem|p2a|sitrusberry
 *
 *     showdown   |-damage|p2a: Incineroar|58/170|[from] Recoil
 *                |-enditem|p2a: Incineroar|Sitrus Berry|[eat]
 *                |-heal|p2a: Incineroar|100/170|[from] item: Sitrus Berry
 *     medicham2  |-enditem|p2a: Incineroar|sitrusberry|[silent][from] ability: pickpocket|[of] ...
 *                |-item|p1b: Weavile|sitrusberry|[from] ability: pickpocket
 *                |-enditem|p1b: Weavile|sitrusberry|[eat]
 *                |-heal|p1b: Weavile|37/145|[from] item: sitrusberry
 *                |-damage|p2a: Incineroar|58/170|[from] Recoil
 *
 * Incineroar's Flare Blitz burned through a Weavile's Focus Sash; the RECOIL then took Incineroar
 * under half. The authority settles the pinch berry at `eachEvent('Update')` and only THEN raises
 * `AfterMoveSecondary`, so the empty-handed Weavile finds nothing to steal. This engine paid
 * Pickpocket inside the per-hit reaction block — twelve steps and one recoil too early — and handed
 * the thief a berry that no longer existed.
 *
 * THE RULE, READ OFF THE SOURCE (Champions overrides NEITHER of these — `grep pickpocket
 * data/mods/champions/abilities.ts` is empty, and the mod's `hitStepMoveHitLoop` copy keeps both
 * lines verbatim at data/mods/champions/scripts.ts:575 and :577):
 *
 *     if (move.totalDamage) this.applyRecoilDamage(...);                 battle-actions.ts:982
 *     if (!damage.some(val => !!val || val === 0)) return damage;                        :1001
 *     this.battle.eachEvent('Update');                                                   :1003
 *     this.afterMoveSecondaryEvent(targetsCopy.filter(val => !!val), pokemon, move);      :1005
 *
 *     afterMoveSecondaryEvent(targets, pokemon, move) {
 *       this.battle.singleEvent('AfterMoveSecondary', move, null, targets[0], pokemon, move);
 *       this.battle.runEvent('AfterMoveSecondary', targets, pokemon, move);
 *     }
 *
 *     pickpocket.onAfterMoveSecondary(target, source, move)              data/abilities.ts:3230
 *       ... if (target.item || ...) return;
 *       const yourItem = source.takeItem(target);      <- reads the SOURCE'S HAND, at :1005
 *
 * THE FIXTURE IS CONSTRUCTED AND EVERY NUMBER IN IT IS DERIVED THIS RUN. It does NOT reproduce the
 * Focus Sash of the real game, because the sash is scenery: what the case needs is (a) a thief with
 * an empty hand, (b) an attacker holding a pinch berry, and (c) a RECOIL that crosses the attacker's
 * pinch line. (c) is the only hard part and it is solved with a FIXED-DAMAGE chip — a `damage:
 * 'level'` move deals exactly the user's level, so the attacker's HP going into its swing is an exact
 * number rather than a roll.
 *
 * THE THREE ARMS:
 *   REAL      the recoil crosses the pinch line. The authority eats the berry and the thief gets
 *             NOTHING; both engines must land on the same HP and the same two hands.
 *   CONTROL   the same board under `MEDI_PICKPOCKET_IN_HIT_LOOP=1`. The thief must end up HOLDING the
 *             berry — an identical result across a varied knob would mean the knob is unwired.
 *   SILENT    the same board with the chip removed, so the recoil does NOT cross the line. The berry
 *             is still in the attacker's hand at `AfterMoveSecondary` and PICKPOCKET MUST STILL FIRE
 *             in both engines and under both knob settings. That is what says this moved the event
 *             and did not delete the ability.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_PICKPOCKET_IN_HIT_LOOP === '1';
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

/* ---- THE THIEF IS THE TAG'S, NOT A NAME. `stealsItem {takesFrom:'attacker'}` is the half of the tag
 * that reads the ATTACKER's hand; the other half is Magician, and it is a different event. */
const THIEF_ABS = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.params && v.params.stealsItem && v.params.stealsItem.takesFrom === 'attacker'))
  .map(([k, v]) => ({ id: k, p: v.params.stealsItem, uses: v.uses || 0 }));
console.log('  abilities tagged stealsItem{takesFrom:attacker}: '
  + (THIEF_ABS.map(a => a.id + ' ' + JSON.stringify(a.p)).join('   |   ') || 'NONE'));
if (!THIEF_ABS.length) { console.log('  NO SUCH ABILITY IN THE ARTIFACT — a claim about the tags.'); process.exit(2); }

/* ---- THE PINCH ITEM, off its own tag. */
const PINCH = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('healsAtThreshold'))
  .map(([k, v]) => ({ id: k, p: v.params.healsAtThreshold, uses: v.uses || 0 }))
  .filter(x => dex.items.get(x.id).exists && !dex.items.get(x.id).isNonstandard)
  .sort((a, b) => b.uses - a.uses);
if (!PINCH.length) { console.log('  NO PINCH-HEAL ITEM — a claim about the artifact.'); process.exit(2); }
const BERRY = PINCH[0], BERRY_ITEM = dex.items.get(BERRY.id);
console.log('  the pinch item                                : ' + BERRY.id + ' ' + JSON.stringify(BERRY.p));

/* ---- THE FIXED-DAMAGE CHIP. `damage: 'level'` is an exact number, so the attacker's HP going into
 * its swing is not a roll. Derived off the move data, never named. */
const LEVEL_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.damage === 'level'
  && (m.accuracy === true || m.accuracy === 100) && (m.target === 'normal' || m.target === 'any'));
console.log('  fixed-damage (`damage: level`) moves legal here: '
  + LEVEL_MOVES.map(m => m.id + ' (' + m.type + ')').join(', '));
if (!LEVEL_MOVES.length) { console.log('  NONE — a claim about the format.'); process.exit(2); }
const CHIP_HP = 50;   /* the level every body in this regulation is built at; see CLAUDE.md */

/* ---- THE RECOIL MOVE, 100 accuracy so the arm's accuracy die cannot make this a flake. */
const RECOILS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.recoil && m.basePower > 0
  && (m.accuracy === true || m.accuracy === 100) && (m.target === 'normal' || m.target === 'any'));

/* THE BUILT STAT LINE IS READ OUT OF THE BUILDER. Keys are the engine's own (`l50`): hp/at/df/sa/sd. */
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

const minDamage = (bp, atk, def, stab, eff) => {
  let d = Math.floor(Math.floor(Math.floor(2 * 50 / 5 + 2) * bp * atk / def) / 50) + 2;
  d = Math.floor(Math.floor(d * stab) * eff);
  return Math.floor(d * 85 / 100);
};
const recoilOf = (mv, dealt) => Math.max(1, Math.round(dealt * mv.recoil[0] / mv.recoil[1]));
const healOf = (H) => Math.trunc(H / 4);

/* ---- THE SEARCH. The thief must SURVIVE the swing (a dead thief still steals in the authority, but
 * a live one keeps the board readable), and the recoil off the damage actually dealt must take the
 * attacker from ABOVE the pinch line to AT OR BELOW it after ONE fixed chip. */
const THIEVES = POOL.filter(s => Object.values(s.abilities).some(a => THIEF_ABS.some(t => t.id === norm(a))));
console.log('  legal carriers of the thief ability           : ' + THIEVES.map(s => s.name).join(', '));
if (!THIEVES.length) { console.log('  NONE — a claim about the format, not about the engine.'); process.exit(2); }

const rows = [];
for (const mv of RECOILS) {
  const attackers = POOL.filter(s => LEARNS(s, mv.id));
  for (const T of THIEVES) {
    if (!dex.getImmunity(mv.type, T)) continue;
    const eff = Math.pow(2, dex.getEffectiveness(mv.type, T));
    const bt = buildOne(T); if (!bt) continue;
    const TH_AB = Object.values(T.abilities).find(a => THIEF_ABS.some(t => t.id === norm(a)));
    for (const A of attackers) {
      const ba = buildOne(A); if (!ba) continue;
      const stab = A.types.includes(mv.type) ? 1.5 : 1;
      const dmg = minDamage(mv.basePower, mv.category === 'Physical' ? ba.at : ba.sa,
        mv.category === 'Physical' ? bt.df : bt.sd, stab, eff);
      if (dmg >= bt.hp) continue;                       // the thief must LIVE, so the board stays readable
      if (bt.hp - dmg <= bt.hp / 2) continue;           // ...and stay ABOVE its own pinch line
      const rc = recoilOf(mv, dmg);
      const before = ba.hp - CHIP_HP;                   // one fixed chip
      if (!(before > ba.hp / 2)) continue;              // it must START above the line
      if (!(before - rc <= ba.hp / 2)) continue;        // and the RECOIL must be what crosses it
      if (!(before - rc > 0)) continue;                 // without killing it
      rows.push({ mv, A, T, TH_AB, ba, bt, dmg, rc, before, eff, slack: (ba.hp / 2) - (before - rc) });
    }
  }
}
console.log('  bodies asked of the builder                   : ' + built.size + ', of which '
  + BUILD_FAILED.length + ' would not build');
if (BUILD_FAILED.length && BUILD_FAILED.length === built.size) {
  console.log('  RED — NOTHING BUILT AT ALL. That is the BUILDER, not the format.'); process.exit(1);
}
if (!rows.length) {
  console.log('  NO TRIPLE IN THIS FORMAT PUTS A RECOIL ACROSS THE PINCH LINE INTO A LIVE THIEF — a '
    + 'claim about the fixture, not about the engine. Nothing was staged.');
  process.exit(2);
}
/* The widest margin on both sides, so a crit or a high roll cannot move the case out of its window. */
rows.sort((a, b) => b.slack - a.slack || a.mv.id.localeCompare(b.mv.id) || a.A.name.localeCompare(b.A.name));
const F = rows[0];
const A_AB = Object.values(F.A.abilities)[0];

const CHIPPER = POOL.find(s => s.name !== F.A.name && s.name !== F.T.name
  && !G.CLOSET_SPECIES.has(norm(s.id))
  && LEVEL_MOVES.some(m => LEARNS(s, m.id) && dex.getImmunity(m.type, F.A)));
if (!CHIPPER) { console.log('  NO LEGAL BODY CARRIES A FIXED-DAMAGE MOVE THE ATTACKER IS NOT IMMUNE TO.'); process.exit(2); }
const CHIP = LEVEL_MOVES.find(m => LEARNS(CHIPPER, m.id) && dex.getImmunity(m.type, F.A));

const SELF_HOLD = (s) => {
  const bad2 = new Set(['rest', 'sleeptalk', 'substitute', 'endure', 'wish', 'charge', 'doubleteam']);
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (bad2.has(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge;
  }) || null;
};
const HOLDS = {};
for (const s of [F.A, F.T, CHIPPER]) { HOLDS[s.name] = SELF_HOLD(s); }
if (Object.values(HOLDS).some(x => !x)) { console.log('  NO SAFE SELF-MOVE FOR ONE OF THE THREE — a claim about the fixture.'); process.exit(2); }

const FILL = POOL.filter(s => ![F.A.name, F.T.name, CHIPPER.name].includes(s.name)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s)).slice(0, 5);
if (FILL.length < 5) { console.log('  NOT ENOUGH FILLER — a claim about the fixture.'); process.exit(2); }

const HEAL = healOf(F.ba.hp);
const AFTER_RECOIL = F.before - F.rc;
const AFTER_BERRY = Math.min(F.ba.hp, AFTER_RECOIL + HEAL);

console.log('\n  chosen  : ' + F.A.name + ' [' + A_AB + '] holding ' + BERRY_ITEM.name + ' clicks '
  + F.mv.id + ' ' + JSON.stringify(F.mv.recoil) + ' into ' + F.T.name + ' [' + F.TH_AB + '], EMPTY-HANDED');
console.log('            chip  : ' + CHIPPER.name + ' clicks ' + CHIP.id + ' (damage: level) for exactly '
  + CHIP_HP + ', so the attacker swings from ' + F.before + '/' + F.ba.hp
  + ' — above its own pinch line of ' + (F.ba.hp / 2));
console.log('            hit   : modelled minimum-roll damage ~' + F.dmg + ' into a ' + F.bt.hp
  + ' HP thief (x' + F.eff + '), which LIVES and stays above ITS pinch line');
console.log('            recoil: ~max(1, round(' + F.dmg + ' * ' + F.mv.recoil[0] + '/' + F.mv.recoil[1]
  + ')) = ~' + F.rc + '   ->  the attacker lands ~' + F.slack + ' under its line of ' + (F.ba.hp / 2));
/* THE MODELLED DAMAGE PROPOSES THE FIXTURE AND IS NOT ASSERTED ON. It was one point out on the first
 * run (60 modelled, 59 played) — a reimplementation of the authority's rounding is a second copy of a
 * fact, which is exactly what CLAUDE.md forbids. So the verdict below asserts a RELATION between the
 * arms — the authority's HP is the control arm's plus the berry — which needs no model at all. */
console.log('            (the two ~ figures PROPOSE the fixture and are asserted on NOWHERE: the'
  + ' verdict compares the arms to each other and to the authority)');
console.log('            so the AUTHORITY eats the berry at :1003 and the thief finds an EMPTY HAND at :1005');
console.log('            -> attacker healed by ' + HEAL + ' with no item, thief with NO item');
console.log('            the DEFECT instead pays the theft inside the hit loop, above the recoil:');
console.log('            -> attacker on the bare recoil with no item, THIEF HOLDING ' + BERRY.id);

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const sides = (withChip) => {
  const A = [
    mon(F.A.name, [F.mv.name, HOLDS[F.A.name]], BERRY_ITEM.name, A_AB),
    mon(FILL[0].name, [SELF_HOLD(FILL[0])]),
    mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
    mon(FILL[2].name, [SELF_HOLD(FILL[2])]),
  ];
  const B = [
    mon(F.T.name, [HOLDS[F.T.name]], '', F.TH_AB),
    mon(CHIPPER.name, [CHIP.name, HOLDS[CHIPPER.name]]),
    mon(FILL[3].name, [SELF_HOLD(FILL[3])]),
    mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
  ];
  return [A, B, withChip];
};

const HOLD_A = norm(HOLDS[F.A.name]), HOLD_T = norm(HOLDS[F.T.name]), HOLD_C = norm(HOLDS[CHIPPER.name]);
const script = (withChip) => ([
  { p1: [{ m: HOLD_A }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: HOLD_T }, withChip ? { m: norm(CHIP.id), t: 0 } : { m: HOLD_C }] },
  { p1: [{ m: norm(F.mv.id), t: 0 }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: HOLD_T }, { m: HOLD_C }] },
  { p1: [{ m: HOLD_A }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: HOLD_T }, { m: HOLD_C }] },
]);

const run = (withChip, tag) => {
  const [SA, SB] = sides(withChip);
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'pickpocketevent/' + tag, {
    arm: G.ARM_BY_ID.get('middle'), script: script(withChip),
    onBoundary: (snap) => seen.push({
      meA: snap.medi.sides.p1.party[norm(F.A.name)] || null,
      sdA: snap.sd.sides.p1.party[norm(F.A.name)] || null,
      meT: snap.medi.sides.p2.party[norm(F.T.name)] || null,
      sdT: snap.sd.sides.p2.party[norm(F.T.name)] || null,
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (seen.length < 2) return { staged: false, why: 'fewer than two boundaries — the swinging turn never closed' };
  const M = seen[Math.min(seen.length - 1, 2)];
  return { staged: true, r, M, boundaries: seen.length,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
};

const show = (M) => {
  const f = x => x ? (String(x.hp) + '/' + x.maxhp + '  item=' + JSON.stringify(x.item)) : '(NO ROW)';
  console.log('    attacker  me ' + f(M.meA).padEnd(34) + ' sd ' + f(M.sdA));
  console.log('    thief     me ' + f(M.meT).padEnd(34) + ' sd ' + f(M.sdT));
};

console.log('\n  === THE REAL ARM — the recoil crosses the pinch line ===');
const REAL = run(true, CHILD ? 'control' : 'real');
if (!REAL.staged) { console.log('  NOT STAGED — ' + REAL.why); process.exit(1); }
show(REAL.M);
console.log('    first protocol divergence: ' + (REAL.div ? JSON.stringify(REAL.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — no chip, so the recoil does NOT cross and the theft MUST happen ===');
const SIL = run(false, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log('  NOT STAGED — ' + SIL.why); process.exit(1); }
show(SIL.M);
console.log('    first protocol divergence: ' + (SIL.div ? JSON.stringify(SIL.div) : 'none — the streams agree'));

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_PICKPOCKET_IN_HIT_LOOP=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    meAhp: REAL.M.meA && REAL.M.meA.hp, meTitem: REAL.M.meT && REAL.M.meT.item,
    sdAhp: REAL.M.sdA && REAL.M.sdA.hp, sdTitem: REAL.M.sdT && REAL.M.sdT.item,
    div: !!REAL.div, divLine: REAL.div && REAL.div.sd,
    silentMeTitem: SIL.M.meT && SIL.M.meT.item, silentSdTitem: SIL.M.sdT && SIL.M.sdT.item,
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
/* THE FIXTURE FIRST, then the AUTHORITY as a control on the arithmetic, then the engine. */
need('the thief survived the swing (the fixture — a dead thief makes the board unreadable)',
  !!(REAL.M.sdT && REAL.M.sdT.hp > 0), true);
need('showdown: the attacker ATE the berry inside the move', REAL.M.sdA && REAL.M.sdA.item, '');
need('showdown: the attacker is BELOW its full HP, so a recoil really was paid',
  !!(REAL.M.sdA && REAL.M.sdA.hp < REAL.M.sdA.maxhp), true);
need('showdown: the thief stole NOTHING, because the hand was already empty at :1005',
  REAL.M.sdT && REAL.M.sdT.item, '');
need('medicham2: the attacker lands on the same HP as the authority',
  REAL.M.meA && REAL.M.meA.hp, REAL.M.sdA && REAL.M.sdA.hp);
need('medicham2: the thief holds nothing either', REAL.M.meT && REAL.M.meT.item, '');
need('the streams do not part at all', REAL.div, null);
/* AND THE ABILITY MUST STILL WORK. Moving an event is only correct if the thing on it still fires. */
need('SILENT CONTROL: with no chip the authority DOES let the thief take the berry',
  SIL.M.sdT && SIL.M.sdT.item, BERRY.id);
need('SILENT CONTROL: and so does medicham2', SIL.M.meT && SIL.M.meT.item, BERRY.id);
need('SILENT CONTROL: the streams do not part there either', SIL.div, null);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_PICKPOCKET_IN_HIT_LOOP=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_PICKPOCKET_IN_HIT_LOOP: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.meTitem !== (REAL.M.meT && REAL.M.meT.item);
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES what the thief holds: default '
      + JSON.stringify(REAL.M.meT && REAL.M.meT.item) + '  vs control ' + JSON.stringify(ctl.meTitem));
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (ctl.meTitem !== BERRY.id) {
      console.log('  RED    the control arm did not put the berry in the thief\'s hand, so it is not the old behaviour.'); bad++;
    }
    /* THE ARITHMETIC CONTROL, AND IT NEEDS NO DAMAGE MODEL: the control arm is the attacker on the
     * BARE RECOIL and the real arm is the authority with the berry settled, so the difference between
     * them must be exactly the berry's heal. If that does not hold, the two arms are not two readings
     * of one board and nothing above is comparable. */
    const sdHp = REAL.M.sdA && REAL.M.sdA.hp;
    if (ctl.meAhp + HEAL !== sdHp) {
      console.log('  RED    the two arms are not one board: control (bare recoil) ' + ctl.meAhp + ' + heal '
        + HEAL + ' = ' + (ctl.meAhp + HEAL) + ', but the authority reads ' + sdHp); bad++;
    } else console.log('  green  control (bare recoil) ' + ctl.meAhp + ' + the berry\'s ' + HEAL
      + ' = ' + sdHp + ', the authority exactly');
    if (!(ctl.meAhp <= F.ba.hp / 2)) {
      console.log('  RED    the recoil did NOT cross the pinch line in the control arm (' + ctl.meAhp
        + ' vs a line of ' + (F.ba.hp / 2) + '), so the fixture never staged the case.'); bad++;
    }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on the authority\'s line: ' + ctl.divLine);
    if (ctl.silentMeTitem !== (SIL.M.meT && SIL.M.meT.item)) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob (' + JSON.stringify(SIL.M.meT && SIL.M.meT.item)
        + ' -> ' + JSON.stringify(ctl.silentMeTitem) + '). The knob reaches further than the event position.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (' + JSON.stringify(ctl.silentMeTitem) + ')');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
