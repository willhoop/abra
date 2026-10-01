/* probe_forme_spread_hp.js — A FORME CHANGE RECOMPUTES THE STAT LINE FROM THE SET, HP SP INCLUDED, ON BOTH ROADS.
 *
 *   ABRA_REGULATION=regmc node tests/probe_forme_spread_hp.js
 *   MEDI_MEGA_SPREAD_HP_BLIND=1  ...   restores road 1's defect   (must exit 1)
 *   MEDI_FORME_SWAP_STAT_DELTA=1 ...   restores road 2's defect   (must exit 1)
 *
 * ================= WHERE THIS CAME FROM ==========================================================
 *
 * Filed by SOLVER (abra/regmc 1.49.0, docs/_reports/2026-09-30-arena-real-spreads.md): of the role-v1
 * table's 3,293 mega-stone sets, 3,185 invest HP and 114 land one point off the authority after mega
 * evolution, 23 of them on Speed.
 *
 * ROAD 1 — `megaEvolveNow`. Since 2026-08-27 it recomputes the mega's line from `(megaBs, _sp, _nature)`
 * exactly as the authority's `setSpecies` -> `spreadModify` does, but ONLY when `l50(baseBs, _sp,
 * _nature)` reproduces the body's current line, HP included. `l50` has no HP term while Champions'
 * `statModify` returns `stat + evs + 75` for HP (data/mods/champions/scripts.ts, the else-branch), so a
 * body that invests HP can never pass the check and always takes the additive delta — which truncates
 * the nature multiply three times where the authority truncates it once.
 *
 * ROAD 2 — `formeSwap`, the mid-battle road (Zero to Hero, Stance Change). It has ALWAYS carried the
 * delta, spread or no spread, so the same three-truncation error sits on it under any non-neutral
 * nature with any investment, HP or not. The legal members whose base stats move are derived below.
 *
 * ================= THE AUTHORITY =================================================================
 *
 *   setSpecies()   const stats = this.battle.spreadModify(this.species.baseStats, this.set);   sim/pokemon.ts
 *                  ... this.storedStats[statName] = stats[statName];
 *   formeChange()  if (isPermanent) { ... this.updateMaxHp(); }                                 (both checkouts)
 *   updateMaxHp()  const newBaseMaxHp = this.battle.statModify(this.species.baseStats, this.set, 'hp');
 *
 * So the five battle stats are ONE truncation of the new forme's sum, and the max HP is recomputed from
 * the new species with the same HP evs on a PERMANENT change (a mega, Zero to Hero) and left alone on a
 * temporary one (Stance Change). The oracle below is the authority's own `statModify`, and ONE real
 * Showdown battle is played as a witness that the oracle is what a mega actually lands on.
 *
 * ================= THE ARMS ======================================================================
 *
 *   MEGA-HP    every stageable stone x a nature that bites x two HP-invested spreads   (the filed defect)
 *   MEGA-0HP   the SAME spreads with the HP points moved off HP                      (control: HP is the knob)
 *   SWAP       every legal formeSwap member whose stats move x biting natures x spreads with and without HP
 *
 * Every arm drives the REAL engine through `battleInit` + `battleTurn`. IT ASSERTS AND EXITS NON-ZERO.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
require(D('tests', '_live_release.js'));

const G = require(D('engine', 'game_differential.js'));
const M = G.REL.require('engine/medicham2-browser.js');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex, Battle } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const { mcKey } = require(D('engine', 'mc_key.js'));
const MAY = { mayMiss: 'the format defines species the engine table has no row for; counted and skipped' };

const KNOBS = ['MEDI_MEGA_SPREAD_HP_BLIND', 'MEDI_FORME_SWAP_STAT_DELTA'].filter(k => process.env[k] === '1');
console.log('\ntests/probe_forme_spread_hp.js — format ' + CS.FORMAT);
console.log('  knobs armed: ' + (KNOBS.length ? KNOBS.join(', ') + '   (a defect is RESTORED; this must exit 1)' : 'none'));

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const ORACLE = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
const SKEYS = ['hp', 'at', 'df', 'sa', 'sd', 'sp'];
const SD = { hp: 'hp', at: 'atk', df: 'def', sa: 'spa', sd: 'spd', sp: 'spe' };
const oracle = (bs, set) => { const o = {}; for (const k of SKEYS) o[k] = ORACLE.statModify(bs, set, SD[k]); return o; };
const lineStr = l => SKEYS.map(k => k + ' ' + l[k]).join(' / ');
const lineEq = (a, b) => SKEYS.every(k => a[k] === b[k]);

/* ---- THE CAST, DERIVED AND PRINTED --------------------------------------------------------------- */
const STONES = [];
for (const it of dex.items.all()) {
  if (!legal(it) || !it.megaStone) continue;
  const base = Object.keys(it.megaStone)[0], megaName = base && it.megaStone[base];
  const b = dex.species.get(base), m = dex.species.get(megaName);
  if (!legal(b) || !m || !m.exists) continue;
  if (!mcKey(b.name, MAY) || !mcKey(m.name, MAY)) continue;
  STONES.push({ stone: it.name, base: b, to: m });
}
STONES.sort((a, b) => a.base.name.localeCompare(b.base.name));

/* ROAD 2's members: a legal species whose battle-only forme is legal and moves a base stat, and which
 * the engine table carries. Printed, because every derived set in this project over-matched once. */
const SWAPS = [];
for (const s of dex.species.all()) {
  if (!legal(s)) continue;
  for (const n of (s.otherFormes || [])) {
    const f = dex.species.get(n);
    if (!legal(f) || f.battleOnly !== s.name || /Mega/.test(f.forme || '')) continue;
    const moved = ['atk', 'def', 'spa', 'spd', 'spe'].filter(k => f.baseStats[k] !== s.baseStats[k]);
    if (!moved.length) continue;
    if (!mcKey(s.name, MAY) || !mcKey(f.name, MAY)) continue;
    SWAPS.push({ base: s, to: f, moved });
  }
}
console.log('\nWHAT IS STAGED');
note(STONES.length + ' mega stone(s) the engine table carries');
note('road 2 members (legal battle-only forme, a stat moves): '
  + (SWAPS.map(x => x.base.name + ' -> ' + x.to.name + ' [' + x.moved.join(',') + ']').join('; ') || 'NONE'));

const FILLERS = dex.species.all()
  .filter(s => legal(s) && s.baseStats && !/mega/i.test(s.forme || '') && !s.battleOnly && mcKey(s.name, MAY)
               && !SWAPS.some(x => x.base.name === s.name))
  .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3);
if (FILLERS.length < 3) fail('fewer than three filler bodies could be derived');
note('filler bodies (nothing asserted): ' + FILLERS.map(s => s.name).join(', '));

/* THE NATURES THAT BITE, derived: every non-neutral nature whose PLUS or MINUS stat moves between the forme
 * pair. All of them, not one, because whether a delta lands off depends on the fraction and nothing else. */
const NATS = dex.natures.all().filter(n => n.plus && n.minus);
const biting = (from, to) => NATS.filter(n => from.baseStats[n.plus] !== to.baseStats[n.plus]
                                         || from.baseStats[n.minus] !== to.baseStats[n.minus]).map(n => n.name);

/* THE SPREADS, typed as SHAPES not as a meta claim. Whether a delta lands off depends ONLY on the fraction the
 * nature multiply throws away, i.e. on the investment's last digit, so the plus stat is swept over SEVERAL
 * values rather than parked at 32. THE FIRST CUT OF THIS FILE PARKED IT AT 0, 2 AND 32 AND THE SWAP ARM CAME
 * BACK CLEAN BY ARITHMETIC: Palafin's Defence delta is off exactly when (2 + S) mod 10 >= 5, and those three
 * values never get there. The minus stat takes a varied share too. HP takes what is left, capped at 32; each
 * HP shape has a 0-HP twin with the same plus and minus investment. Every shape is legal (<= 66, <= 32 each). */
function spreads(nature, hp, plusValues) {
  const n = dex.natures.get(nature);
  const plus = n.plus, minus = n.minus;
  const E = o => Object.assign({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, o);
  return plusValues.map(S => {
    const m = Math.min(32, (S * 7 + 3) % 33, 66 - S);
    return E({ hp: hp ? Math.min(32, 66 - S - m) : 0, [plus]: S, [minus]: m });
  });
}
const MEGA_S = [32, 7];
const SWAP_S = Array.from({ length: 33 }, (_, i) => i);
const toSp = e => ({ hp: e.hp, at: e.atk, df: e.def, sa: e.spa, sd: e.spd, sp: e.spe });

/* ---- ONE BODY, STAGED ----------------------------------------------------------------------------
 * buildPair/freshBodies make a playable body; its line, spread and nature are then set to the declared set
 * through the engine's OWN level-50 line (`spreadL50`, plus the HP SP the authority adds), and asserted equal
 * to the authority BEFORE the forme changes, or an "after" mismatch says nothing about the change. */
const CLICK = 'Protect';
function stageSide(subject, slot, ability, item, moves) {
  const sheet = [];
  for (let i = 0; i < 4; i++) {
    if (i === slot) sheet.push({ species: subject.name, item, ability, nature: 'Serious', moves });
    else { const f = FILLERS[(i + (i > slot ? -1 : 0)) % FILLERS.length];
      sheet.push({ species: f.name, item: '', ability: Object.values(f.abilities || {})[0] || '', nature: 'Serious', moves: [CLICK] }); }
  }
  const pair = G.buildPair(sheet), foe = G.buildPair(sheet.map(x => Object.assign({}, x)));
  if (!pair || !foe) return null;
  return { A: G.freshBodies(pair), B: G.freshBodies(foe) };
}
function dress(body, bs, evs, nature) {
  const sp = toSp(evs);
  body._nature = nature; body._sp = sp;
  const st = M.spreadL50(bs, sp, nature); st.hp += sp.hp;
  body.st = st; body.curHP = st.hp;
  return { species: '', nature, level: 50, evs, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } };
}

function megaCase(row, nature, evs) {
  const st = stageSide(row.base, 0, Object.values(row.base.abilities || {})[0] || '', row.stone, [CLICK]);
  if (!st) return 'buildPair returned null';
  const me = st.A[0];
  const set = dress(me, row.base.baseStats, evs, nature);
  const trace = [];
  const S = M.battleInit(st.A, st.B, { trace, autoMega: false });
  if (S.actA[0] !== me) return 'the subject is not the slot-0 lead';
  if (!lineEq(oracle(row.base.baseStats, set), me.st)) return 'BEFORE the mega the two already differ';
  const act = (m, mega) => { const pa = M.playerAction(m, 'protect', null, S.field); if (mega && pa) pa.mega = true; return pa; };
  M.battleTurn(S, () => 0, new Map([[S.actA[0], act(S.actA[0], true)], [S.actA[1], act(S.actA[1])]]),
                           new Map([[S.actB[0], act(S.actB[0])], [S.actB[1], act(S.actB[1])]]));
  if (!trace.some(l => /^\|-mega\|/.test(String(l)))) return 'medicham2 never megad';
  return { want: oracle(row.to.baseStats, set), got: Object.assign({}, me.st) };
}

/* ROAD 2. Zero to Hero fires as the body LEAVES (permanent: max HP recomputed); Stance Change fires on an
 * attacking click (temporary: max HP kept). Both are the authority's `setSpecies`, so the five battle stats
 * are the new forme's recompute either way. */
function swapCase(row, nature, evs) {
  const ab = Object.values(row.base.abilities || {})[0] || '';
  const isZero = /zero to hero/i.test(ab);
  const isStance = /stance change/i.test(ab);
  if (!isZero && !isStance) return 'no staging is written for ' + ab + ' — add one rather than skip it';
  const moves = isStance ? ['Iron Head', CLICK] : [CLICK];
  const st = stageSide(row.base, 0, ab, '', moves);
  if (!st) return 'buildPair returned null';
  const me = st.A[0];
  const set = dress(me, row.base.baseStats, evs, nature);
  const S = M.battleInit(st.A, st.B, { trace: [], autoMega: false });
  if (S.actA[0] !== me) return 'the subject is not the slot-0 lead';
  if (!lineEq(oracle(row.base.baseStats, set), me.st)) return 'BEFORE the change the two already differ';
  const prot = m => M.playerAction(m, 'protect', null, S.field);
  const mine = isZero ? { kind: 'switch', to: st.A[2] } : M.playerAction(me, 'ironhead', S.actB[0], S.field);
  M.battleTurn(S, () => 0, new Map([[me, mine], [S.actA[1], prot(S.actA[1])]]),
                           new Map([[S.actB[0], { kind: 'pass' }], [S.actB[1], { kind: 'pass' }]]));
  const toKey = mcKey(row.to.name, MAY);
  if (String(me.name) !== String(toKey)) return 'the forme never changed (body reads ' + me.name + ', wanted ' + toKey + ')';
  const want = oracle(row.to.baseStats, set);
  if (isStance) want.hp = oracle(row.base.baseStats, set).hp;
  return { want, got: Object.assign({}, me.st) };
}

function arm(label, cases) {
  const bad = [], reasons = new Map(); let checked = 0;
  for (const c of cases) {
    const r = c.run();
    if (typeof r === 'string') { reasons.set(r, (reasons.get(r) || 0) + 1); continue; }
    checked++;
    if (!lineEq(r.want, r.got)) bad.push({ who: c.who, off: SKEYS.filter(k => r.want[k] !== r.got[k])
      .map(k => k + ' authority ' + r.want[k] + ' engine ' + r.got[k]).join(', ') });
  }
  console.log('\n' + label);
  for (const [why, n] of reasons) note('could not stage x' + n + ': ' + why);
  note(checked + ' stat line(s) compared; ' + bad.length + ' differ from the authority');
  for (const b of bad.slice(0, 10)) note('  ' + b.who + '   ' + b.off);
  if (bad.length > 10) note('  ... and ' + (bad.length - 10) + ' more');
  return { checked, bad, unstaged: [...reasons.values()].reduce((a, b) => a + b, 0) };
}

const megaCases = hp => STONES.flatMap(row => biting(row.base, row.to).flatMap(nat => spreads(nat, hp, MEGA_S)
  .map(evs => ({ who: row.base.name + ' @ ' + row.stone + ' ' + nat + ' ' + JSON.stringify(evs), run: () => megaCase(row, nat, evs) }))));
const swapCases = () => SWAPS.flatMap(row => biting(row.base, row.to).flatMap(nat => spreads(nat, true, SWAP_S).concat(spreads(nat, false, SWAP_S))
  .map(evs => ({ who: row.base.name + ' -> ' + row.to.name + ' ' + nat + ' ' + JSON.stringify(evs), run: () => swapCase(row, nat, evs) }))));

/* ---- THE WITNESS: one real Showdown battle, so the oracle is not merely the formula this file assumed --- */
(function witness() {
  const row = STONES.find(r => r.to.baseStats.atk !== r.base.baseStats.atk) || STONES[0];
  if (!row) { fail('no stone to witness with'); return; }
  const evs = { hp: 32, atk: 32, def: 0, spa: 0, spd: 0, spe: 2 };
  const mk = (sp, item, nat, e) => ({ name: sp.name, species: sp.name, item, ability: Object.values(sp.abilities)[0],
    moves: ['protect'], nature: nat, level: 50, evs: e, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } });
  const fill = FILLERS.map(f => mk(f, '', 'Serious', { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }));
  const team = [mk(row.base, row.stone, 'Adamant', evs)].concat(fill);
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'a', team }); b.setPlayer('p2', { name: 'b', team: team.map(x => Object.assign({}, x)) });
  if (b.requestState === 'teampreview') b.makeChoices('team 1234', 'team 1234');
  b.makeChoices('move protect mega, move protect', 'move protect, move protect');
  const p = b.sides[0].active[0];
  const real = { hp: p.maxhp, at: p.storedStats.atk, df: p.storedStats.def, sa: p.storedStats.spa, sd: p.storedStats.spd, sp: p.storedStats.spe };
  const want = oracle(row.to.baseStats, { nature: 'Adamant', level: 50, evs });
  console.log('\nWITNESS — a real Showdown battle, ' + row.base.name + ' @ ' + row.stone + ' Adamant ' + JSON.stringify(evs));
  note('species after the turn: ' + p.species.name + '   line ' + lineStr(real));
  if (p.species.name !== row.to.name) fail('the witness never mega evolved — the oracle is unwitnessed');
  else if (!lineEq(real, want)) fail('the real battle and the oracle disagree: ' + lineStr(want));
  else pass('the real battle lands on the oracle line, HP SP included');
})();

const A1 = arm('ARM MEGA-HP — HP-invested spreads (the filed defect)', megaCases(true));
const A0 = arm('ARM MEGA-0HP — the control: the same natures, no HP points', megaCases(false));
const A2 = arm('ARM SWAP — the mid-battle road (formeSwap), with and without HP', swapCases());

console.log('\nVERDICT');
if (!A0.checked) fail('the control staged nothing');
else if (A0.bad.length) fail('the CONTROL is dirty (' + A0.bad.length + ' of ' + A0.checked + '): the 0-HP road was already recomputing, so this instrument is measuring something else');
else pass('the control is clean: ' + A0.checked + ' no-HP mega lines match — the instrument can pass, and HP is the knob');
for (const [name, a] of [['MEGA-HP', A1], ['SWAP', A2]]) {
  if (!a.checked) fail(name + ' staged nothing');
  else if (a.unstaged) fail(name + ': ' + a.unstaged + ' case(s) could not be staged — an unstaged case counts against the probe');
  if (a.bad.length) fail(name + ': ' + a.bad.length + ' of ' + a.checked + ' forme-changed lines differ from the authority');
  else if (a.checked) pass(name + ': ' + a.checked + ' forme-changed lines all match the authority');
}
const C = M.MEDFAILS || {};
note('receipts: MEDFAILS.megaStatDeltaFallback ' + (C.megaStatDeltaFallback || 0) + ', megaStatSpreadStale ' + (C.megaStatSpreadStale || 0)
  + ', formeSwapStatDelta ' + (C.formeSwapStatDelta || 0) + ', formeSwapSpreadStale ' + (C.formeSwapSpreadStale || 0));
console.log('\n' + (failures ? 'RED — ' + failures + ' failure(s)' : 'GREEN'));
process.exit(failures ? 1 : 0);
