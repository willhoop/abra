/* probe_recoil_after_clamp.js — RECOIL IS A SHARE OF WHAT WAS DEALT, NOT OF WHAT WAS ROLLED.
 *
 *   SHOWDOWN_PATH=... node tests/probe_recoil_after_clamp.js
 *
 * WHERE THIS CAME FROM. The 2026-08-27 pinned differential (release `d03fb31456e2`, 961 games) has
 * FOUR games whose board parts. One of them is this, and it is one HP:
 *
 *     seed ...2653843264 vs ...2653816206   turn 8
 *       |-damage|p2a: Incineroar|20/170 par|[from] Recoil      (showdown)
 *       |-damage|p2a: Incineroar|19/170 par|[from] Recoil      (medicham2)
 *
 * Replayed line by line (`engine/replay_one.js`): a Flare Blitz into a full-HP Whimsicott holding a
 * Focus Sash. The sash cut the damage to 134 and the authority charged 33% of 134 (= 44). This engine
 * charged 33% of 135 (= 45) — the number BEFORE the clamp. The same Incineroar's Flare Blitz into an
 * unsashed Farigiraf on the previous turn agreed exactly, which is why this survived every
 * single-hit damage check: `tests/test-engine-diff.js` reads 0 of 6000 at all sixteen corners and
 * asks about the HIT, never about what the hit COSTS.
 *
 * THE ARITHMETIC WAS ALREADY RIGHT AND THE INPUT WAS WRONG. ROADMAP #81 WIRE 4 fixed the FORMULA on
 * this exact line — `Math.round`, clamped to at least 1, as a RATIO and not a pre-divided float,
 * because `recoilOf` was short by an ulp. What it did not touch is where `dealt` is READ:
 *
 *     medicham2   dealt += Math.min(dmg, tg.curHP)        <- captured ~270 lines ABOVE the clamps
 *     authority   move.totalDamage += damage[i]           <- battle-actions.ts:965, and `damage[i]`
 *                                                            is what `spreadDamage` RETURNED, i.e.
 *                                                            after every `onDamage` handler
 *
 * Three handlers rewrite `dmg` between those two points — Disguise's absorb, Endure and the sash
 * family — and two of them are clamps that mean "this body survives on `leavesHP`". So every recoil,
 * every drain and every `_dealtEach` row was one point high on a hit that something survived.
 *
 * THE FIXTURE IS CONSTRUCTED AND SEARCHED, NOT FOUND. A one-point difference in `dealt` only moves
 * the recoil when `Math.round` crosses, so the probe SEARCHES the format for a triple where it does:
 * a 100-accuracy recoil move (so the arm's accuracy die cannot make this a flake), a target whose
 * BUILT max HP puts `round(H * r)` and `round((H-1) * r)` on opposite sides, and an attacker that
 * survives the toll. The chosen row is printed with both arithmetic answers before the game is played.
 *
 * THE CLAMP MAKES IT ROLL-INDEPENDENT, WHICH IS THE OTHER REASON THIS SHAPE WAS CHOSEN. Whatever the
 * damage roll or the crit does, a lethal hit into a full-HP sash deals exactly `H - leavesHP`. So the
 * expected recoil is a CONSTANT under any arm, and the probe asserts an exact number rather than a
 * band.
 *
 * THE CONTROL IS A CHILD ON `MEDI_DEALT_BEFORE_CLAMP=1`, which restores the old reading. The parent
 * FAILS if the knob does not move the attacker's HP.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_DEALT_BEFORE_CLAMP === '1';

/* THE PRELOAD IS SELF-APPLIED, SO THIS FILE IS `node tests/<it>.js` AND NOTHING ELSE.
 * `engine/game_differential.js` CUTS A RELEASE INTO THE REAL STORE at require time when `--release`
 * is absent, so a probe against freshly-written bytes has to redirect the store first. Doing that with
 * `-r ./tests/_live_release.js` works and makes the command unrunnable by `engine/register_reality.js`
 * — which only executes a plain `node <repo script>.js [--flags]` — so a row VERIFIED BY this file
 * reads as INSTRUMENT UNRUNNABLE and verifies nothing. Requiring it HERE, before the driver, is the
 * same mechanism: Node's module cache means the instrument's own `require('./engine_release.js')`
 * returns the object this has already wrapped. `-r` still works and does not double-wrap, because the
 * resolved path is the same cache entry. */
require(D('tests', '_live_release.js'));

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));

console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* ---- THE SURVIVOR ITEM. It must be DETERMINISTIC: a `chance` member (Focus Band) would put a die
 * between the fixture and its own claim, and the pins do not share that die. */
const SASHES = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('survivesFromFull'))
  .map(([k, v]) => ({ id: k, p: v.params.survivesFromFull, uses: v.uses }));
console.log('  items tagged survivesFromFull      :');
for (const s of SASHES) console.log('      ' + s.id.padEnd(12) + ' leavesHP=' + s.p.leavesHP
  + ' fromFull=' + s.p.onlyFromFullHP + ' chance=' + s.p.chance + ' consumes=' + s.p.consumesItem
  + '  (' + s.uses + ' sheets)' + (s.p.chance != null ? '   NOT USABLE — a die this probe does not share' : ''));
const SASH = SASHES.find(s => s.p.chance == null && s.p.consumesItem
  && dex.items.get(s.id).exists && !dex.items.get(s.id).isNonstandard);
if (!SASH) { console.log('  NO DETERMINISTIC SURVIVOR ITEM — a claim about the artifact.'); process.exit(2); }
const LEAVES = +SASH.p.leavesHP || 1;
const SASH_ITEM = dex.items.get(SASH.id);

/* ---- THE HOLD MOVE the target spends its turn on. It must not shield (Protect refuses the attack
 * outright) and must not leave the field. Both read off the move, never named. */
const SELF_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.flags.charge && !m.stallingMove && !m.selfSwitch
  && !(TAGS.moves[m.id] && (TAGS.moves[m.id].tags || []).includes('userFaints'))).map(m => m.id);

/* ---- THE SEARCH ---------------------------------------------------------------------------------
 * Everything below is derived. The only typed constants are the two the AUTHORITY types on its own
 * line (`Math.round`, and a floor of 1 — battle-actions.ts:1384). */
const RECOILS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.recoil && m.basePower > 0);
console.log('  recoil moves legal here            : '
  + RECOILS.map(m => m.id + ' ' + JSON.stringify(m.recoil) + ' acc=' + m.accuracy).join(', '));
const CERTAIN = RECOILS.filter(m => m.accuracy === true || m.accuracy === 100);
if (!CERTAIN.length) { console.log('  NO 100-ACCURACY RECOIL MOVE — a claim about the format.'); process.exit(2); }

/* THE BUILT MAX HP IS THE ONE THAT MATTERS, and it is not the base stat: `buildPair` applies the
 * format's SP spread. Read out of the builder itself for every candidate rather than modelled. */
const FILLER0 = POOL.filter(s => LEARNS(s, 'protect')).slice(0, 3);
if (FILLER0.length < 3) { console.log('  NOT ENOUGH LEGAL FILLER — a claim about the fixture.'); process.exit(2); }
const builtHP = new Map();
/* A BODY THAT WILL NOT BUILD IS COUNTED AND NAMED, NEVER SWALLOWED. This walk touches every legal
 * species, and some of them legitimately have no `MC.mons` row (`mcKey` THROWS by contract rather than
 * guessing). A bare `catch { hp = null }` would make "this species cannot be built" and "the builder
 * broke" read alike, and if it ever became ALL of them the search below would report
 * NO TRIPLE IN THIS FORMAT while the truth was that nothing built at all. */
const BUILD_FAILED = [];
const buildOne = (s) => {
  if (builtHP.has(s.name)) return builtHP.get(s.name);
  let hp = null;
  try {
    const p = G.buildPair([{ species: s.name, item: '', ability: '', moves: ['Protect'] },
      ...FILLER0.filter(f => f.name !== s.name).slice(0, 3)
        .map(f => ({ species: f.name, item: '', ability: '', moves: ['Protect'] }))]);
    if (p) hp = p[0].medi.st.hp;
    else BUILD_FAILED.push(s.name + ': buildPair returned null');
  } catch (e) { BUILD_FAILED.push(s.name + ': ' + String((e && e.message) || e)); }
  builtHP.set(s.name, hp);
  return hp;
};

const recoilOf = (m, dealt) => Math.max(1, Math.round(dealt * m.recoil[0] / m.recoil[1]));
const rows = [];
for (const mv of CERTAIN) {
  const attackers = POOL.filter(s => LEARNS(s, mv.id) && LEARNS(s, 'protect'));
  if (!attackers.length) continue;
  for (const t of POOL) {
    if (!dex.getImmunity(mv.type, t)) continue;
    const eff = dex.getEffectiveness(mv.type, t);
    if (eff < 1) continue;                      // it has to KILL from full, so make it super-effective
    if (!SELF_MOVES.some(m2 => LEARNS(t, m2))) continue;
    const H = buildOne(t);
    if (!H) continue;
    const wrong = recoilOf(mv, H), right = recoilOf(mv, H - LEAVES);
    if (wrong === right) continue;              // the off-by-one would be invisible here
    for (const A of attackers) {
      const AH = buildOne(A);
      if (!AH || AH <= wrong + 25) continue;    // the attacker must SURVIVE its own toll, both ways
      const ab = Object.values(A.abilities)[0];
      if (TAGS.abilities[norm(ab)] && (TAGS.abilities[norm(ab)].tags || []).includes('noRecoil')) continue;
      rows.push({ mv, A, t, H, AH, eff, wrong, right, ab });
    }
  }
}
rows.sort((a, b) => (b.eff - a.eff) || (a.H * a.t.baseStats.def - b.H * b.t.baseStats.def)
  || (b.A.baseStats.atk - a.A.baseStats.atk) || a.mv.id.localeCompare(b.mv.id)
  || a.A.name.localeCompare(b.A.name) || a.t.name.localeCompare(b.t.name));
console.log('  bodies asked of the builder         : ' + builtHP.size + ', of which '
  + BUILD_FAILED.length + ' would not build'
  + (BUILD_FAILED.length ? '  e.g. ' + BUILD_FAILED.slice(0, 3).join(' | ') : ''));
if (BUILD_FAILED.length && BUILD_FAILED.length === builtHP.size) {
  console.log('  RED — NOTHING BUILT AT ALL. That is the BUILDER, not the format, and the search '
    + 'below would have reported an empty result as a fact about Pokemon.');
  process.exit(1);
}
if (!rows.length) {
  console.log('  NO TRIPLE IN THIS FORMAT MAKES THE OFF-BY-ONE VISIBLE — a claim about the fixture, '
    + 'not about the engine. Nothing was staged.');
  process.exit(2);
}
const F = rows[0];
const HOLD = SELF_MOVES.find(m2 => LEARNS(F.t, m2));
const FILL = POOL.filter(s => LEARNS(s, 'protect') && s.name !== F.A.name && s.name !== F.t.name).slice(0, 6);
console.log('  candidate triples where the off-by-one is VISIBLE : ' + rows.length);
console.log('  chosen  : ' + F.A.name + ' [' + F.ab + '] clicks ' + F.mv.id + ' ' + JSON.stringify(F.mv.recoil)
  + ' into ' + F.t.name + ' holding ' + SASH_ITEM.name);
console.log('            target built max HP ' + F.H + ',  effectiveness stage +' + F.eff
  + ',  attacker built max HP ' + F.AH);
console.log('            the sash leaves it on ' + LEAVES + ', so the damage DEALT is exactly '
  + (F.H - LEAVES) + ' whatever the roll does');
console.log('            recoil off what was DEALT   = round(' + (F.H - LEAVES) + ' * '
  + F.mv.recoil[0] + '/' + F.mv.recoil[1] + ') = ' + F.right + '   <- the authority');
console.log('            recoil off what was ROLLED  = round(' + F.H + ' * '
  + F.mv.recoil[0] + '/' + F.mv.recoil[1] + ') = ' + F.wrong + '   <- the defect');
console.log('            so the attacker ends the turn on ' + (F.AH - F.right) + ' or on ' + (F.AH - F.wrong));

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const SIDE_A = [
  mon(F.A.name, [F.mv.name, 'Protect'], '', F.ab),
  mon(FILL[0].name, ['Protect']),
  mon(FILL[1].name, ['Protect']),
  mon(FILL[2].name, ['Protect']),
];
const SIDE_B = [
  mon(F.t.name, [HOLD, 'Protect'], SASH_ITEM.name),
  mon(FILL[3].name, ['Protect']),
  mon(FILL[4].name, ['Protect']),
  mon(FILL[5].name, ['Protect']),
];
console.log('  P1 (the attacker) : ' + SIDE_A.map(m => m.species).join(', '));
console.log('  P2 (the sashed)   : ' + SIDE_B.map(m => m.species).join(', '));

const a = G.buildPair(SIDE_A), b = G.buildPair(SIDE_B);
if (!a || !b) { console.log('  COULD NOT BUILD THE PAIR — a claim about the fixture.'); process.exit(2); }

/* ---- THE ARM ------------------------------------------------------------------------------------
 * ONE turn. The attacker swings, the sash saves the target on `leavesHP`, and the recoil is charged.
 * The target clicks a self-only move so it neither shields the hit away nor passes; both allies hold. */
const SCRIPT = [
  { p1: [{ m: norm(F.mv.id), t: 0 }, { m: 'protect' }], p2: [{ m: HOLD }, { m: 'protect' }] },
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: HOLD }, { m: 'protect' }] },
];
G.resetScriptCounters();
const seen = [];
const r = G.playGame(a, b, 'directed', 'recoilclamp/' + (CHILD ? 'preclamp' : 'postclamp'), {
  arm: G.ARM_BY_ID.get('middle'),
  script: SCRIPT,
  onBoundary: (snap) => {
    seen.push({ meAtt: snap.medi.sides.p1.party[norm(F.A.name)] || null,
                sdAtt: snap.sd.sides.p1.party[norm(F.A.name)] || null,
                meTgt: snap.medi.sides.p2.party[norm(F.t.name)] || null,
                sdTgt: snap.sd.sides.p2.party[norm(F.t.name)] || null });
  },
});
if (r.err) { console.log('  THE GAME THREW: ' + r.err); process.exit(1); }
const SC = G.scriptCounters();
if (SC.moveNotOnRequest) {
  console.log('  RED — ' + SC.moveNotOnRequest + ' scripted click(s) were NOT on the request and became '
    + 'a pass: ' + SC.firstMissing + '. The arm did not run.');
  process.exit(1);
}
if (seen.length < 2) { console.log('  FEWER THAN TWO BOUNDARIES — the swinging turn never closed.'); process.exit(1); }

let bad = 0;
console.log('\n  === THE TWO BODIES AT EVERY BOUNDARY, OUT OF board_state.js ITSELF ===');
seen.forEach((s, i) => {
  const f = x => x ? (String(x.hp) + '/' + x.maxhp + (x.item ? ' ' + x.item : ' -')) : '(NO ROW)';
  console.log('   boundary ' + i + '   attacker  me ' + f(s.meAtt).padEnd(20) + ' sd ' + f(s.sdAtt).padEnd(20)
    + '   target  me ' + f(s.meTgt).padEnd(22) + ' sd ' + f(s.sdTgt));
});
const M = seen[1];
if (!M.meAtt || !M.sdAtt || !M.meTgt || !M.sdTgt) { console.log('\n  RED — a body has no party row.'); process.exit(1); }

/* ---- THE ARM MUST HAVE HAPPENED ---------------------------------------------------------------- */
if (M.sdTgt.hp !== LEAVES || M.sdTgt.item !== '') {
  console.log('\n  RED — THE SASH NEVER FIRED IN THE AUTHORITY (target ' + M.sdTgt.hp + '/' + M.sdTgt.maxhp
    + ', item ' + JSON.stringify(M.sdTgt.item) + '). The hit was not lethal, so nothing was clamped and '
    + 'there is no divergence to test.');
  bad++;
}
if (M.sdAtt.hp === M.sdAtt.maxhp) {
  console.log('\n  RED — THE ATTACKER PAID NO RECOIL AT ALL. The move never landed.');
  bad++;
}
if (bad) console.log('\n RED — ' + bad + ' fixture assertion(s) failed; the verdict below is not trustworthy.');

/* ---- THE VERDICT -------------------------------------------------------------------------------- */
console.log('\n  === THE VERDICT — the attacker\'s own HP after its recoil ===');
const paidMe = M.meAtt.maxhp - M.meAtt.hp, paidSd = M.sdAtt.maxhp - M.sdAtt.hp;
console.log('  recoil actually charged:  medicham2 ' + paidMe + '    showdown ' + paidSd
  + '     (dealt-based ' + F.right + ', rolled-based ' + F.wrong + ')');
if (CHILD) {
  console.log('  CONTROL ARM (MEDI_DEALT_BEFORE_CLAMP=1) — this arm asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({ paid: paidMe, hp: M.meAtt.hp, parted: paidMe !== paidSd }));
} else {
  const need = (what, got, want) => {
    const ok = got === want;
    console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + got + (ok ? '' : '   (wanted ' + want + ')'));
    return ok;
  };
  /* THE AUTHORITY IS CHECKED FIRST AND IT IS A CONTROL ON THE ARITHMETIC, not a restatement of it: if
   * Showdown does not charge the dealt-based number then the derivation above is wrong and every
   * assertion under it is meaningless. */
  if (!need('showdown charges the DEALT-based recoil (the authority — a control on the arithmetic)', paidSd, F.right)) bad++;
  if (!need('medicham2 charges the same', paidMe, F.right)) bad++;
  if (!need('...and the two engines land on the same HP', M.meAtt.hp, M.sdAtt.hp)) bad++;
}

if (!CHILD) {
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_DEALT_BEFORE_CLAMP=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_DEALT_BEFORE_CLAMP: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + '). Its whole output is above.'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.paid !== paidMe;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the toll: default ' + paidMe
      + '  vs control ' + ctl.paid);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (!ctl.parted) { console.log('  RED    the control arm did NOT part from the authority, so it is not the old behaviour.'); bad++; }
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
