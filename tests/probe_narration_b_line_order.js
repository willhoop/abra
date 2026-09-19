/* probe_narration_b_line_order.js — EIGHT LINE-ORDER MECHANISMS, EACH STAGED BESIDE ITS CONTROL. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_narration_b_line_order.js
 *   SHOWDOWN_PATH=... node tests/probe_narration_b_line_order.js --only lifedew
 *   SHOWDOWN_PATH=... node tests/probe_narration_b_line_order.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * On release a1c7dcd5696b the narration gate read 0 / 11 / 24, and fourteen of those games were bucketed
 * as "protocol lines in a different order". That is a COMPARATOR field, not a cause. Re-bucketed by
 * mechanism (docs/_reports/2026-09-19-narration-b.md), eight of them were deterministic engine defects
 * with one pinned-pool game or two each. Each is staged here twice:
 *
 *   RED      the shape the pool game had. With the fix in, the two engines agree on every protocol line
 *            and on every board; under the mechanism's MEDI_* knob the protocol parts.
 *   CONTROL  the same board with the one ingredient removed. The engines agree with the fix in AND under
 *            the knob -- so the knob is shown to reach only the mechanism, not the fixture.
 *
 * THE AUTHORITY IS THE ANSWER. No arm types an expected line: it compares the two streams whole
 * (`playGame`'s first protocol divergence, `r.div`) and the boards at every turn boundary (`r.stateDiv`),
 * and separately asserts the AUTHORITY staged the shape (the ingredient appears in its stream in the
 * order the red arm needs), so an arm that stopped staging cannot read green.
 *
 * EVERY SPECIES IS DERIVED FROM THE FORMAT, filtered to the regulation, and printed. Nothing is typed.
 *
 * ================= THE MECHANISMS, THE KNOBS, AND THE POOL GAMES THEY CAME FROM ===================
 *   lifedew     Life Dew: every partner's TryHit refusal before any heal.   MEDI_ALLIES_HEAL_INTERLEAVED
 *               omit-weather ...bo3-2634231341 t3, pair-redirect-priority ...bo3-2635082691 t10 (g1950)
 *   megahh      the megaEvo action (104) above a +6 Prankster Helping Hand.  MEDI_MEGA_GATE_ON_PRIORITY
 *               pair-redirect-priority ...bo3-2660691219 t7 (g1350)
 *   corpse      a Speed-Swapped corpse queues its replacement on its own Speed. MEDI_CORPSE_SPEED_KEEPS_REWIRE
 *               pair-speedctrl ...bo3-2663429418 t4 (g1950)
 *   perish      a broken shield deletes `stall`, so the perish drain waits for `|upkeep|`. MEDI_BREAK_KEEPS_STALL_FRESH
 *               pair-protect-bust ...bo3-2634665687 t6 (g1950)
 *   lock        a shielded last locked turn fatigues at AfterMove.            MEDI_LOCK_END_NEEDS_HIT
 *               omit-weather ...bo3-2659688578 t11 (g1950)
 *   herb        Champions' queued White Herb lands between a pivot's `|switch|` and its SwitchIn. MEDI_PIVOT_HERB_AFTER_ENTRY
 *               pair-protect-bust ...bo3-2654135529 t8 (g1950)
 *   darts       a split Dragon Darts at a semi-invulnerable body writes no `-miss`. MEDI_SMART_INVULN_MISS_LINE
 *               pair-protect-bust ...bo3-2662428145 t4 (g1950)
 *   berserk     Berserk is paid at AfterMoveSecondary, below the attacker's recoil. MEDI_HP_THRESHOLD_BOOST_ABOVE_RECOIL
 *               omit-intimidate ...bo3-2656439218 t3 (g1950)
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_narration_b_line_order.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const ALL_KNOBS = ['MEDI_ALLIES_HEAL_INTERLEAVED', 'MEDI_MEGA_GATE_ON_PRIORITY', 'MEDI_CORPSE_SPEED_KEEPS_REWIRE',
  'MEDI_BREAK_KEEPS_STALL_FRESH', 'MEDI_LOCK_END_NEEDS_HIT', 'MEDI_PIVOT_HERB_AFTER_ENTRY', 'MEDI_SMART_INVULN_MISS_LINE',
  'MEDI_HP_THRESHOLD_BOOST_ABOVE_RECOIL'];

let _cur = null, _G = null;
function harness(knob) {
  const key = knob || '(clean)';
  if (_G && _cur === key) return _G;
  for (const k of ALL_KNOBS) delete process.env[k];
  if (knob) process.env[knob] = '1';
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE FORMAT, AND THE FIXTURE DERIVED FROM IT ------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (s, mv) => {
  const e = LS[s.id] || (s.baseSpecies && s.baseSpecies !== s.name ? LS[dex.species.get(s.baseSpecies).id] : null);
  return !!(e && e.learnset && e.learnset[dex.moves.get(mv).id]);
};
/* An ability that cannot touch order, a TryHit, a switch-in, a boost or a status: read off its handlers. */
const QUIET = ['onStart', 'onSwitchIn', 'onModifyPriority', 'onFractionalPriority', 'onUpdate', 'onTryHit',
  'onAllyTryHitSide', 'onModifySpe', 'onResidual', 'onDamagingHit', 'onSetStatus', 'onAfterSetStatus', 'onTryBoost',
  'onSwitchOut', 'onBeforeMove', 'onAnyTryPrimaryHit', 'onFoeTryMove', 'onDamage', 'onAfterMoveSecondary',
  'onSourceModifyDamage', 'onModifyMove', 'onAnyInvulnerability', 'onFaint', 'onAnyFaint', 'onEnd', 'onImmunity',
  'onAfterBoost', 'onAllyBoost', 'onFoeAfterBoost', 'onChangeBoost', 'onTryAddVolatile', 'onDragOut', 'onTrapPokemon',
  'onFoeTrapPokemon', 'onModifyType', 'onEmergencyExit', 'onAfterUseItem', 'onAllyAfterUseItem', 'onTakeItem'];
const quiet = a => { const x = dex.abilities.get(a); return x.exists && QUIET.every(h => !x[h]); };
const quietAb = s => Object.values(s.abilities).find(quiet);
const SPECIES = dex.species.all().filter(s => legal(s) && !/-Mega/.test(s.name) && !s.battleOnly && quietAb(s))
  .sort((a, b) => a.name.localeCompare(b.name));
const hasAb = (s, a) => Object.values(s.abilities).includes(dex.abilities.get(a).name);
const ALL_LEGAL = dex.species.all().filter(s => legal(s) && !/-Mega/.test(s.name) && !s.battleOnly)
  .sort((a, b) => a.name.localeCompare(b.name));
/* A harmless status click for a body: lowers a foe stat or does nothing a residual reads. */
const NOOPS = ['charm', 'faketears', 'babydolleyes', 'playnice', 'scaryface', 'confide', 'tickle', 'featherdance', 'sweetscent'];
const noop = s => NOOPS.find(m => legal(dex.moves.get(m)) && learns(s, m));
const spe = s => s.baseStats.spe;
const bulk = s => s.baseStats.hp * (s.baseStats.def + s.baseStats.spd);
const row = (s, moves, ab, item) => ({ species: s.name, item: item || '', ability: ab || quietAb(s), moves });
/* A role no quiet-ability species can fill takes the first of a short list of abilities that cannot reach
 * this probe's mechanism (checked against the species, not assumed), and says which it took. */
const abOf = (s, prefer) => quietAb(s) || (prefer || []).map(a => dex.abilities.get(a).name).find(n => Object.values(s.abilities).includes(n));
const used = new Set();
const take = (xs, why) => {
  const s = xs.find(x => !used.has(x.id) && !used.has(x.baseSpecies));
  if (!s) throw new Error('NOT-STAGEABLE — the format supplies no ' + why);
  used.add(s.id); used.add(s.baseSpecies); return s;
};
const fresh = () => used.clear();
const immune = (s, type) => !dex.getImmunity(type, s.types) || dex.getEffectiveness(type, s.types) < -1;
const say = (k, v) => console.log('    ' + String(k).padEnd(22) + ' ' + v);

const P = { m: 'protect' };
const mv = (m, t) => (t == null ? { m } : { m, t });

/* ---- THE ARMS ------------------------------------------------------------------------------------ */
const ARMS = [];
function arm(id, knob, build) { ARMS.push({ id, knob, build }); }

arm('lifedew', 'MEDI_ALLIES_HEAL_INTERLEAVED', () => {
  fresh();
  const user = take(SPECIES.filter(s => learns(s, 'lifedew') && learns(s, 'protect') && noop(s)), 'Life Dew user');
  const gag = take(ALL_LEGAL.filter(s => hasAb(s, 'goodasgold') && learns(s, 'protect')), 'Good as Gold partner');
  const plain = take(SPECIES.filter(s => learns(s, 'protect') && noop(s)), 'plain partner');
  const f = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'foe'));
  say('Life Dew user', user.name); say('Good as Gold partner', gag.name); say('plain partner', plain.name);
  const foes = f.map(s => row(s, ['Protect']));
  const T = partner => [row(user, ['Life Dew', 'Protect']), partner, row(f[0], ['Protect']), row(f[1], ['Protect'])];
  const script = [{ p1: [mv('lifedew'), P], p2: [P, P] }];
  const shape = sd => { const i = sd.findIndex(l => /^\|move\|p1a: .*\|Life Dew/.test(l));
    const j = sd.findIndex((l, k) => k > i && /^\|-immune\|p1b/.test(l));
    const h = sd.findIndex((l, k) => k > i && /^\|-(heal|fail)\|p1a/.test(l));
    return i >= 0 && j > i && h > j; };
  return {
    red: { A: T(row(gag, ['Protect'], dex.abilities.get('goodasgold').name)), B: [row(f[2], ['Protect']), row(f[3], ['Protect'])].concat(foes.slice(0, 2)), script, shape,
           shapeWhy: 'the partner\'s `-immune` precedes the user\'s heal line' },
    control: { A: T(row(plain, ['Protect'])), B: [row(f[2], ['Protect']), row(f[3], ['Protect'])].concat(foes.slice(0, 2)), script,
               shape: sd => sd.some(l => /^\|move\|p1a: .*\|Life Dew/.test(l)) && !sd.some(l => /^\|-immune\|/.test(l)),
               shapeWhy: 'Life Dew resolves with no refusal' },
  };
});

arm('megahh', 'MEDI_MEGA_GATE_ON_PRIORITY', () => {
  fresh();
  /* `megaStone` is `{ <base>: <forme> }` on this checkout; read the pair off it rather than assume a shape. */
  const stones = dex.items.all().filter(i => legal(i) && i.megaStone && typeof i.megaStone === 'object');
  const megaPairs = [];
  for (const it of stones) {
    const [baseName, formeName] = Object.entries(it.megaStone)[0];
    const base = dex.species.get(baseName), forme = dex.species.get(formeName);
    if (legal(base) && forme.exists && !base.battleOnly && learns(base, 'protect')) megaPairs.push({ base, it });
  }
  megaPairs.sort((a, b) => a.base.name.localeCompare(b.base.name));
  const mp = megaPairs.find(p => !used.has(p.base.id));
  if (!mp) throw new Error('NOT-STAGEABLE — no legal mega');
  used.add(mp.base.id);
  const prank = take(ALL_LEGAL.filter(s => hasAb(s, 'prankster') && learns(s, 'helpinghand')), 'Prankster Helping Hand user');
  const plainHH = take(SPECIES.filter(s => learns(s, 'helpinghand')), 'plain Helping Hand user');
  const f = [0, 1, 2, 3, 4, 5].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'foe'));
  say('mega', mp.base.name + ' @ ' + mp.it.name); say('Prankster HH', prank.name); say('plain HH', plainHH.name);
  const B = f.slice(0, 4).map(s => row(s, ['Protect']));
  const megaRow = row(mp.base, ['Protect'], Object.values(mp.base.abilities)[0], mp.it.name);
  const script = [{ p1: [mv('helpinghand'), { m: 'protect', mega: true }], p2: [P, P] }];
  const shape = sd => { const i = sd.findIndex(l => /^\|detailschange\|p1b/.test(l));
    const j = sd.findIndex(l => /^\|move\|p1a: .*\|Helping Hand/.test(l)); return i >= 0 && j > i; };
  return {
    red: { A: [row(prank, ['Helping Hand'], dex.abilities.get('prankster').name), megaRow, row(f[4], ['Protect']), row(f[5], ['Protect'])],
           B, script, shape, shapeWhy: 'the mega evolves above the +6 Helping Hand' },
    control: { A: [row(plainHH, ['Helping Hand']), megaRow, row(f[4], ['Protect']), row(f[5], ['Protect'])],
               B, script, shape, shapeWhy: 'the mega evolves above the +5 Helping Hand' },
  };
});

arm('corpse', 'MEDI_CORPSE_SPEED_KEEPS_REWIRE', () => {
  fresh();
  const selfko = s => ['healingwish', 'memento'].find(m => legal(dex.moves.get(m)) && learns(s, m));
  /* Inner Focus refuses flinch and Intimidate; neither is on this board. */
  const SWAB = ['innerfocus'];
  const swapper = take(ALL_LEGAL.filter(s => learns(s, 'speedswap') && learns(s, 'protect') && abOf(s, SWAB)).sort((a, b) => spe(b) - spe(a)), 'fast Speed Swap user');
  const kos = SPECIES.filter(s => selfko(s) && spe(s) < spe(swapper)).sort((a, b) => spe(a) - spe(b));
  const slow = take(kos, 'slow self-KO body');
  const mid = take(kos.filter(s => spe(s) > spe(slow) + 10), 'medium self-KO body');
  /* The partner never shields: Memento is aimed at it, and a Protect would refuse the self-KO. */
  const p1b = take(SPECIES.filter(s => learns(s, 'protect') && noop(s)), 'swapper partner');
  const f = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Speed Swap user', swapper.name + ' (base ' + spe(swapper) + ')');
  say('slow corpse', slow.name + ' (base ' + spe(slow) + ', ' + selfko(slow) + ')');
  say('medium corpse', mid.name + ' (base ' + spe(mid) + ', ' + selfko(mid) + ')');
  say('Speed Swap ability', abOf(swapper, SWAB));
  const A = [row(swapper, ['Speed Swap', 'Protect'], abOf(swapper, SWAB)), row(p1b, [dex.moves.get(noop(p1b)).name]), row(f[0], ['Protect']), row(f[1], ['Protect'])];
  const B = [row(slow, [dex.moves.get(selfko(slow)).name]), row(mid, [dex.moves.get(selfko(mid)).name]), row(f[2], ['Protect']), row(f[3], ['Protect'])];
  const ko = s => mv(selfko(s), selfko(s) === 'memento' ? 1 : null);
  const pn = mv(noop(p1b), dex.moves.get(noop(p1b)).target === 'normal' ? 0 : null);
  const refill = sd => { const t = sd.findIndex(l => /^\|upkeep/.test(l));
    return sd.slice(t).filter(l => /^\|switch\|p2/.test(l)).map(l => l.split('|')[2].slice(0, 3)); };
  return {
    red: { A, B, script: [{ p1: [mv('speedswap', 0), pn], p2: [ko(slow), ko(mid)] }],
           shape: sd => sd.some(l => /Speed Swap/.test(l) && /^\|-activate/.test(l)) && refill(sd).join() === 'p2b,p2a',
           shapeWhy: 'the swap landed, and p2b refills before p2a (the corpse\'s own Speed)' },
    control: { A, B, script: [{ p1: [P, pn], p2: [ko(slow), ko(mid)] }],
               shape: sd => refill(sd).join() === 'p2b,p2a', shapeWhy: 'p2b refills before p2a' },
  };
});

arm('perish', 'MEDI_BREAK_KEEPS_STALL_FRESH', () => {
  fresh();
  const singer = take(SPECIES.filter(s => learns(s, 'perishsong') && learns(s, 'protect') && noop(s)), 'Perish Song user');
  const guard = take(SPECIES.filter(s => learns(s, 'protect') && noop(s)), 'shield body');
  const feinter = take(SPECIES.filter(s => learns(s, 'feint') && learns(s, 'protect') && noop(s)), 'Feint user');
  const other = take(SPECIES.filter(s => learns(s, 'protect') && noop(s)), 'fourth body');
  const f = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Perish Song', singer.name); say('shield', guard.name); say('Feint', feinter.name); say('fourth', other.name);
  const nm = s => dex.moves.get(noop(s)).name;
  const A = [row(singer, ['Perish Song', 'Protect', nm(singer)]), row(guard, ['Protect', nm(guard)]), row(f[0], ['Protect']), row(f[1], ['Protect'])];
  const B = [row(feinter, ['Feint', 'Protect', nm(feinter)]), row(other, ['Protect', nm(other)]), row(f[2], ['Protect']), row(f[3], ['Protect'])];
  const no = (s, t) => mv(noop(s), dex.moves.get(noop(s)).target === 'normal' ? t : null);
  const lead = [{ p1: [mv('perishsong'), P], p2: [P, P] },
                { p1: [no(singer, 0), no(guard, 0)], p2: [no(feinter, 0), no(other, 0)] },
                { p1: [no(singer, 1), no(guard, 1)], p2: [no(feinter, 1), no(other, 1)] }];
  const last = sd => { const t = sd.lastIndexOf('|turn|4'); const up = sd.findIndex((l, k) => k > t && l === '|upkeep');
    const fa = sd.findIndex((l, k) => k > t && /^\|faint\|/.test(l)); return { up, fa }; };
  return {
    red: { A, B, script: lead.concat([{ p1: [no(singer, 0), P], p2: [mv('feint', 1), no(other, 0)] }]),
           shape: sd => { const x = last(sd); return sd.some(l => /Feint/.test(l) && /\[broken\]|move: Feint/.test(l) && /^\|-activate/.test(l)) && x.up > 0 && x.fa > x.up; },
           shapeWhy: 'Feint breaks the shield and the perish faints land BELOW `|upkeep|`' },
    control: { A, B, script: lead.concat([{ p1: [no(singer, 0), P], p2: [no(feinter, 1), no(other, 0)] }]),
               shape: sd => { const x = last(sd); return x.fa > 0 && x.up > x.fa; },
               shapeWhy: 'the shield stands and the perish faints land ABOVE `|upkeep|`' },
  };
});

arm('lock', 'MEDI_LOCK_END_NEEDS_HIT', () => {
  fresh();
  const LOCKS = ['outrage', 'thrash', 'petaldance', 'ragingfury'].filter(m => legal(dex.moves.get(m)));
  const lk = s => LOCKS.find(m => learns(s, m));
  const rager = take(SPECIES.filter(s => lk(s) && learns(s, 'protect')).sort((a, b) => spe(b) - spe(a)), 'rampage user');
  const T = dex.moves.get(lk(rager)).type;
  const slowPartner = take(SPECIES.filter(s => noop(s) && spe(s) < spe(rager)).sort((a, b) => spe(a) - spe(b)), 'slow partner');
  const tanks = SPECIES.filter(s => learns(s, 'protect') && noop(s) && !immune(s, T)).sort((a, b) => bulk(b) - bulk(a));
  const f1 = take(tanks, 'bulky foe'), f2 = take(tanks, 'bulky foe');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('rampage', rager.name + ' (' + lk(rager) + ', ' + T + ')'); say('slow partner', slowPartner.name); say('foes', f1.name + ', ' + f2.name);
  const A = [row(rager, [dex.moves.get(lk(rager)).name, 'Protect']), row(slowPartner, [dex.moves.get(noop(slowPartner)).name]), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const nm = s => dex.moves.get(noop(s)).name;
  const B = [row(f1, ['Protect', nm(f1)]), row(f2, ['Protect', nm(f2)]), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  const no = (s, t) => mv(noop(s), dex.moves.get(noop(s)).target === 'normal' ? t : null);
  const t1 = { p1: [mv(lk(rager)), no(slowPartner, 0)], p2: [no(f1, 0), no(f2, 0)] };
  const fat = sd => { const t = sd.lastIndexOf('|turn|2'); const c = sd.findIndex((l, k) => k > t && /confusion\|\[fatigue\]/.test(l));
    const p = sd.findIndex((l, k) => k > t && /^\|move\|p1b/.test(l)); return { c, p }; };
  return {
    red: { A, B, script: [t1, { p1: [mv(lk(rager)), no(slowPartner, 0)], p2: [P, P] }],
           shape: sd => { const x = fat(sd); return x.c > 0 && x.p > x.c && sd.some((l, k) => k > sd.lastIndexOf('|turn|2') && /^\|-activate\|.*move: Protect/.test(l)); },
           shapeWhy: 'the shielded last locked turn fatigues above the partner\'s move' },
    control: { A, B, script: [t1, { p1: [mv(lk(rager)), no(slowPartner, 0)], p2: [no(f1, 0), no(f2, 0)] }],
               shape: sd => { const x = fat(sd); return x.c > 0 && x.p > x.c; }, shapeWhy: 'the resolved last locked turn fatigues at move time' },
  };
});

arm('herb', 'MEDI_PIVOT_HERB_AFTER_ENTRY', () => {
  fresh();
  const pivot = take(SPECIES.filter(s => learns(s, 'partingshot') && learns(s, 'protect')), 'Parting Shot user');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'pivot partner');
  const intim = ALL_LEGAL.filter(s => hasAb(s, 'intimidate') && learns(s, 'protect'));
  const i1 = take(intim, 'Intimidate entrant'), i2 = take(intim, 'Intimidate entrant');
  const holder = take(SPECIES.filter(s => learns(s, 'protect') && noop(s)), 'White Herb holder');
  const f = [0, 1, 2].map(() => take(SPECIES.filter(s => learns(s, 'protect') && noop(s)), 'foe'));
  say('Parting Shot', pivot.name); say('entrants', i1.name + ', ' + i2.name); say('herb holder', holder.name);
  const A = [row(pivot, ['Parting Shot', 'Protect']), row(p1b, ['Protect']),
             row(i1, ['Protect'], dex.abilities.get('intimidate').name), row(i2, ['Protect'], dex.abilities.get('intimidate').name)];
  const nm = s => dex.moves.get(noop(s)).name;
  const Bh = [row(holder, [nm(holder), 'Protect'], null, dex.items.get('whiteherb').name), row(f[0], [nm(f[0]), 'Protect']), row(f[1], ['Protect']), row(f[2], ['Protect'])];
  const Bp = [row(holder, [nm(holder), 'Protect']), row(f[0], [nm(f[0]), 'Protect']), row(f[1], ['Protect']), row(f[2], ['Protect'])];
  const no = (s, t) => mv(noop(s), dex.moves.get(noop(s)).target === 'normal' ? t : null);
  const script = [{ p1: [mv('partingshot', 0), P], p2: [no(holder, 1), no(f[0], 1)] }];
  const order = sd => { const s = sd.findIndex(l => /^\|switch\|p1a/.test(l) && /Parting Shot/.test(l));
    const e = sd.findIndex((l, k) => k > s && /^\|-enditem\|p2a: .*\|White Herb/.test(l));
    const a = sd.findIndex((l, k) => k > s && /^\|-ability\|p1a: .*\|Intimidate/.test(l)); return { s, e, a }; };
  return {
    red: { A, B: Bh, script, shape: sd => { const x = order(sd); return x.s > 0 && x.e > x.s && x.a > x.e; },
           shapeWhy: 'the herb is spent between the pivot\'s `|switch|` and the entrant\'s Intimidate' },
    control: { A, B: Bp, script, shape: sd => { const x = order(sd); return x.s > 0 && x.a > x.s && x.e < 0; },
               shapeWhy: 'no herb; the entrant\'s Intimidate follows its `|switch|`' },
  };
});

arm('darts', 'MEDI_SMART_INVULN_MISS_LINE', () => {
  fresh();
  /* Infiltrator passes screens and a Substitute; neither is on this board. */
  const DAB = ['infiltrator'];
  const darter = take(ALL_LEGAL.filter(s => learns(s, 'dragondarts') && learns(s, 'protect') && abOf(s, DAB)).sort((a, b) => spe(b) - spe(a)), 'Dragon Darts user');
  const CH = ['fly', 'bounce', 'dig', 'dive', 'phantomforce'].filter(m => legal(dex.moves.get(m)));
  const ch = s => CH.find(m => learns(s, m));
  const flyer = take(SPECIES.filter(s => ch(s) && noop(s) && spe(s) < spe(darter) && !immune(s, 'Dragon')).sort((a, b) => spe(a) - spe(b)), 'semi-invulnerable charger');
  const mate = take(SPECIES.filter(s => noop(s) && learns(s, 'protect') && !immune(s, 'Dragon')).sort((a, b) => bulk(b) - bulk(a)), 'charger partner');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'darter partner');
  const f = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Dragon Darts', darter.name + ' (base ' + spe(darter) + ')'); say('charger', flyer.name + ' (' + ch(flyer) + ', base ' + spe(flyer) + ')'); say('partner', mate.name);
  say('Dragon Darts ability', abOf(darter, DAB));
  const A = [row(darter, ['Dragon Darts', 'Protect'], abOf(darter, DAB)), row(p1b, ['Protect']), row(f[0], ['Protect']), row(f[1], ['Protect'])];
  const nm = s => dex.moves.get(noop(s)).name;
  const B = [row(flyer, [dex.moves.get(ch(flyer)).name, nm(flyer)]), row(mate, [nm(mate), 'Protect']), row(f[2], ['Protect']), row(f[3], ['Protect'])];
  const no = (s, t) => mv(noop(s), dex.moves.get(noop(s)).target === 'normal' ? t : null);
  const t2 = sd => sd.slice(sd.lastIndexOf('|turn|2'));
  return {
    red: { A, B, script: [{ p1: [P, P], p2: [mv(ch(flyer), 1), no(mate, 1)] }, { p1: [mv('dragondarts', 0), P], p2: [mv(ch(flyer), 1), no(mate, 1)] }],
           shape: sd => sd.some(l => /^\|-prepare\|p2a/.test(l)) && t2(sd).some(l => /Dragon Darts/.test(l)) && !t2(sd).some(l => /^\|-miss\|p1a/.test(l))
                        && t2(sd).filter(l => /^\|-damage\|p2b/.test(l) && !/\[from\]/.test(l)).length === 2,
           shapeWhy: 'the charger is invulnerable, no `-miss`, both darts land on its partner' },
    control: { A, B, script: [{ p1: [P, P], p2: [no(flyer, 1), no(mate, 1)] }, { p1: [mv('dragondarts', 0), P], p2: [no(flyer, 1), no(mate, 1)] }],
               shape: sd => t2(sd).some(l => /Dragon Darts/.test(l)) && !t2(sd).some(l => /^\|-miss\|/.test(l)),
               shapeWhy: 'no charge; the darts split' },
  };
});

arm('berserk', 'MEDI_HP_THRESHOLD_BOOST_ABOVE_RECOIL', () => {
  fresh();
  const bz = take(ALL_LEGAL.filter(s => hasAb(s, 'berserk') && noop(s)).sort((a, b) => bulk(b) - bulk(a)), 'Berserk holder');
  const clean = x => x.exists && legal(x) && x.basePower >= 60 && x.category !== 'Status' && !x.multihit && !x.priority
    && !x.secondary && !x.secondaries && !x.self && !x.selfBoost && !x.drain && !x.flags.charge && x.target === 'normal'
    && !x.ignoreImmunity && dex.getImmunity(x.type, bz.types) && dex.getEffectiveness(x.type, bz.types) >= 0;
  const recoilOf = s => dex.moves.all().filter(x => clean(Object.assign({}, x, { recoil: undefined })) && x.recoil && learns(s, x.id))
    .sort((a, b) => a.basePower - b.basePower || a.id.localeCompare(b.id))[0];
  const plainOf = (s, type) => dex.moves.all().filter(x => clean(x) && !x.recoil && x.type === type && learns(s, x.id))
    .sort((a, b) => b.basePower - a.basePower || a.id.localeCompare(b.id))[0];
  const hitter = take(SPECIES.filter(s => noop(s) && recoilOf(s) && plainOf(s, recoilOf(s).type)), 'recoil attacker');
  const rc = recoilOf(hitter), pl = plainOf(hitter, rc.type);
  const p1b = take(SPECIES.filter(s => noop(s)), 'Berserk partner'), p2b = take(SPECIES.filter(s => noop(s)), 'attacker partner');
  const f = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Berserk holder', bz.name); say('attacker', hitter.name + ' (' + rc.name + ' / control ' + pl.name + ')');
  const nm = s => dex.moves.get(noop(s)).name;
  const no = (s, t) => mv(noop(s), dex.moves.get(noop(s)).target === 'normal' ? t : null);
  const A = [row(bz, [nm(bz)], dex.abilities.get('berserk').name), row(p1b, [nm(p1b)]), row(f[0], ['Protect']), row(f[1], ['Protect'])];
  const B = [row(hitter, [rc.name, pl.name]), row(p2b, [nm(p2b)]), row(f[2], ['Protect']), row(f[3], ['Protect'])];
  const turns = id => [0, 1, 2, 3, 4].map(() => ({ p1: [no(bz, 0), no(p1b, 0)], p2: [mv(id, 0), no(p2b, 0)] }));
  /* the Berserk boost line of one move, and whether that move's recoil line is above it */
  const pairs = sd => { const out = [];
    for (let i = 0; i < sd.length; i++) { if (!/^\|move\|p2a/.test(sd[i])) continue;
      let r = -1, b = -1;
      for (let k = i + 1; k < sd.length && !/^\|(move|turn|upkeep)/.test(sd[k]); k++) {
        if (/^\|-damage\|p2a.*\[from\] Recoil/.test(sd[k])) r = k;
        if (/^\|-boost\|p1a: .*\|spa\|/.test(sd[k])) b = k; }
      if (b > 0) out.push({ r, b }); }
    return out; };
  return {
    red: { A, B, script: turns(rc.id), shape: sd => pairs(sd).some(x => x.r > 0 && x.b > x.r),
           shapeWhy: 'a recoil move takes the holder under half and the recoil line precedes the Berserk boost' },
    control: { A, B, script: turns(pl.id), shape: sd => pairs(sd).length > 0 && pairs(sd).every(x => x.r < 0),
               shapeWhy: 'the same crossing with no recoil; Berserk still fires' },
  };
});

/* ---- PLAYING ONE ARM --------------------------------------------------------------------------- */
function play(G, sc, name) {
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { notStaged: 'buildPair refused side ' + (!a ? 'A' : 'B') };
  const r = G.playGame(a, b, 'directed', 'probe_narration_b_line_order :: ' + name, { script: sc.script, arm });
  return { r, sd: G.sdStream(G.lastSdLog()).map(String), sc: G.scriptCounters(),
           fails: Object.assign({}, globalThis.MEDFAILS || {}) };
}
const divOf = r => r.div ? (r.div.agreedLines + '  SD ' + r.div.sdRaw + '  <>  US ' + r.div.meRaw) : 'none';

let bad = 0, ran = 0;
for (const A of ARMS) {
  if (ONLY && A.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + A.id + '    knob ' + A.knob);
  let fx;
  try { fx = A.build(); } catch (e) { console.log('  ' + String(e.message || e)); bad++; continue; }
  for (const kind of ['red', 'control']) {
    const sc = fx[kind];
    const clean = play(harness(null), sc, A.id + ' ' + kind + ' clean');
    const brk = play(harness(A.knob), sc, A.id + ' ' + kind + ' knob');
    harness(null);
    ran++;
    console.log('  [' + kind + ']  ' + sc.shapeWhy);
    if (clean.notStaged || brk.notStaged) { console.log('    NOT-STAGED — ' + (clean.notStaged || brk.notStaged)); bad++; continue; }
    if (clean.r.err || brk.r.err) { console.log('    THREW — ' + (clean.r.err || brk.r.err)); bad++; continue; }
    const stampOk = !Object.keys(clean.fails).some(k => /Restored$/.test(k) && clean.fails[k] && ALL_KNOBS.length);
    console.log('    clean  first divergence ' + divOf(clean.r) + '   board ' + (clean.r.stateDiv ? 'PARTED t' + clean.r.stateDiv.turn : 'held ' + clean.r.boundariesAgreed + '/' + clean.r.boundaries));
    console.log('    knob   first divergence ' + divOf(brk.r) + '   board ' + (brk.r.stateDiv ? 'PARTED t' + brk.r.stateDiv.turn : 'held'));
    if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest || clean.sc.megaRefused) {
      console.log('    >> FIXTURE FAILED — a scripted click was refused (' + JSON.stringify(clean.sc) + ')'); bad++; continue; }
    if (process.argv.includes('--show')) console.log(clean.sd.map(l => '      | ' + l).join(NL));
    if (!sc.shape(clean.sd)) { console.log('    >> FIXTURE FAILED — the authority did not stage the shape: ' + sc.shapeWhy); bad++; continue; }
    if (!stampOk) { console.log('    >> the CLEAN run carries a restore stamp; the harness leaked a knob.'); bad++; continue; }
    if (clean.r.div) { console.log('    >> RED — the protocol parts with the fix in.'); bad++; continue; }
    if (clean.r.stateDiv) { console.log('    >> RED — the boards part with the fix in.'); bad++; continue; }
    if (kind === 'red' && !brk.r.div) { console.log('    >> THE KNOB DOES NOT REACH THE MECHANISM — the old engine agrees too.'); bad++; continue; }
    if (kind === 'control' && brk.r.div) { console.log('    >> THE KNOB PARTS THE CONTROL — it reaches more than the mechanism.'); bad++; continue; }
    console.log('    OK');
  }
}
console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
console.log(bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
