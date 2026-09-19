/* probe_narration_d.js — THREE NARRATION MECHANISMS, EACH STAGED BESIDE ITS CONTROL. 2026-09-19.
 *
 *   SHOWDOWN_PATH=... node tests/probe_narration_d.js
 *   SHOWDOWN_PATH=... node tests/probe_narration_d.js --only pshot
 *   SHOWDOWN_PATH=... node tests/probe_narration_d.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * On release 1a6550ea5ec6 board-material read 0 / 0 / 0 on the three lattices and the only failing gate
 * clause was NARRATION. Three of the remaining undeclared games are one mechanism each
 * (docs/_reports/2026-09-19-narration-d.md):
 *
 *   pshot / table   a stat table with one stat refused by TryBoost and another landing: the authority writes
 *                   the refusal ABOVE the `-unboost` (sim/battle.ts:2031 runs TryBoost before the per-stat
 *                   loop). MEDI_DROP_REFUSAL_AFTER_TABLE.  pair-speedctrl ...bo3-2662455751 idx 145 t9 (g1950)
 *   mortalspin /    the spin family and Defog write `-sideend|…|[from] move: <Move>|[of] <user>`; Tidy Up
 *   defog /         writes it bare; the spin family's own Leech Seed `-end` is attributed the same way.
 *   spinseed        MEDI_SWEEP_UNATTRIBUTED.  omit-intimidate ...bo3-2659871951 idx 79 (g1950)
 *   magician        Magician's theft is ONE `-item` line; the `-enditem [silent]` + `-item` pair is
 *                   Pickpocket's. MEDI_MAGICIAN_ENDITEM_LINE.  omit-intimidate ...bo3-2662767282 idx 119 t8 (g1950)
 *   magicianDead    a Magician thief at 0 HP inside its own move takes nothing (`setItem` refuses on `!this.hp`) --
 *                   a BOARD fact, found reading Magician. MEDI_MAGICIAN_DEAD_THIEF_TAKES. No pool game.
 *
 * Each arm is staged twice:
 *   RED      the shape the pool game had. With the fix in, the two engines agree on every protocol line and
 *            on every board; under the mechanism's knob the protocol parts.
 *   CONTROL  the same board with the one ingredient removed (or the sibling the knob must NOT reach). The
 *            engines agree with the fix in AND under the knob.
 *
 * THE AUTHORITY IS THE ANSWER. No arm types an expected line: it compares the two streams whole
 * (`playGame`'s first protocol divergence) and the boards at every turn boundary, and separately asserts the
 * AUTHORITY staged the shape, so an arm that stopped staging cannot read green.
 *
 * EVERY SPECIES IS DERIVED FROM THE FORMAT, filtered to the regulation, and printed. So is the CLASS each
 * mechanism belongs to (§ CLASS below), so a new carrier appearing upstream is printed rather than missed.
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
  REL_ID = ER.cut('tests/probe_narration_d.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const ALL_KNOBS = ['MEDI_DROP_REFUSAL_AFTER_TABLE', 'MEDI_SWEEP_UNATTRIBUTED', 'MEDI_MAGICIAN_ENDITEM_LINE',
  'MEDI_MAGICIAN_DEAD_THIEF_TAKES'];

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
/* An ability that cannot touch order, a TryHit, a switch-in, a boost, an item or a status: read off its handlers. */
const QUIET = ['onStart', 'onSwitchIn', 'onModifyPriority', 'onFractionalPriority', 'onUpdate', 'onTryHit',
  'onAllyTryHitSide', 'onModifySpe', 'onResidual', 'onDamagingHit', 'onSetStatus', 'onAfterSetStatus', 'onTryBoost',
  'onSwitchOut', 'onBeforeMove', 'onAnyTryPrimaryHit', 'onFoeTryMove', 'onDamage', 'onAfterMoveSecondary',
  'onAfterMoveSecondarySelf', 'onSourceModifyDamage', 'onModifyMove', 'onAnyInvulnerability', 'onFaint', 'onAnyFaint',
  'onEnd', 'onImmunity', 'onAfterBoost', 'onAllyBoost', 'onFoeAfterBoost', 'onChangeBoost', 'onTryAddVolatile',
  'onDragOut', 'onTrapPokemon', 'onFoeTrapPokemon', 'onModifyType', 'onEmergencyExit', 'onAfterUseItem',
  'onAllyAfterUseItem', 'onTakeItem', 'onAllyTryBoost'];
const quiet = a => { const x = dex.abilities.get(a); return x.exists && QUIET.every(h => !x[h]); };
const quietAb = s => Object.values(s.abilities).find(quiet);
const ALL_LEGAL = dex.species.all().filter(s => legal(s) && !/-Mega/.test(s.name) && !s.battleOnly)
  .sort((a, b) => a.name.localeCompare(b.name));
const SPECIES = ALL_LEGAL.filter(s => quietAb(s));
const hasAb = (s, a) => Object.values(s.abilities).includes(dex.abilities.get(a).name);
const NOOPS = ['charm', 'faketears', 'babydolleyes', 'playnice', 'scaryface', 'confide', 'featherdance', 'sweetscent'];
const noop = s => NOOPS.find(m => legal(dex.moves.get(m)) && learns(s, m));
const row = (s, moves, ab, item) => ({ species: s.name, item: item || '', ability: ab || quietAb(s), moves });
const abOf = (s, prefer) => quietAb(s) || (prefer || []).map(a => dex.abilities.get(a).name).find(n => Object.values(s.abilities).includes(n));
const used = new Set();
const take = (xs, why) => {
  const s = xs.find(x => !used.has(x.id) && !used.has(x.baseSpecies));
  if (!s) throw new Error('NOT-STAGEABLE — the format supplies no ' + why);
  used.add(s.id); used.add(s.baseSpecies); return s;
};
const fresh = () => used.clear();
const say = (k, v) => console.log('    ' + String(k).padEnd(24) + ' ' + v);
const P = { m: 'protect' };
const mv = (m, t) => (t == null ? { m } : { m, t });
const nm = s => dex.moves.get(noop(s)).name;
const no = (s, t) => mv(noop(s), dex.moves.get(noop(s)).target === 'normal' ? t : null);

/* ---- § CLASS — printed on every run, derived, never typed --------------------------------------- */
function printClass() {
  console.log(NL + '  CLASS (derived from the format on this run)');
  const tryBoost = dex.abilities.all().filter(a => a.exists && !a.isNonstandard && (a.onTryBoost || a.onAllyTryBoost));
  const carriers = a => ALL_LEGAL.filter(s => hasAb(s, a.id)).map(s => s.name);
  for (const a of tryBoost) {
    const src = String(a.onTryBoost || a.onAllyTryBoost);
    const key = (/boost\.(\w+)\s*&&\s*boost\.\w+\s*<\s*0/.exec(src) || [])[1] || 'all negative';
    const onlyI = /Intimidate/.test(src) ? ' (Intimidate only)' : '';
    const c = carriers(a);
    if (c.length) say('refuser ' + a.name, key + onlyI + ' — ' + c.join(', '));
  }
  const selfT = ['self', 'adjacentAllyOrSelf', 'allySide', 'allies'];
  const tables = dex.moves.all().filter(m => legal(m)).map(m => {
    const code = (String(m.onHit || '').match(/this\.boost\(\s*\{[^}]*\}/) || [])[0];
    const b = code ? code : (m.boosts && !selfT.includes(m.target) ? JSON.stringify(m.boosts) : null);
    return { m, b };
  }).filter(x => x.b && (x.b.match(/-\d/g) || []).length >= 1 && (x.b.match(/:/g) || []).length >= 2);
  say('multi-stat drop tables', tables.map(x => x.m.name).join(', '));
  const sweep = dex.moves.all().filter(m => legal(m)).filter(m => {
    const src = ['onHit', 'onAfterHit', 'onAfterSubDamage'].map(h => String(m[h] || '')).join(NL);
    return /removeSideCondition/.test(src) && /spikes|stealthrock/.test(src);
  });
  for (const m of sweep) {
    const src = ['onHit', 'onAfterHit', 'onAfterSubDamage'].map(h => String(m[h] || '')).join(NL);
    say('hazard sweeper ' + m.name, /["']-sideend["'][^;]*\[from\] move:/.test(src) ? 'attributes its -sideend' : 'bare -sideend');
  }
  say('Magician carriers', ALL_LEGAL.filter(s => hasAb(s, 'magician')).map(s => s.name).join(', '));
}

/* ---- THE ARMS ------------------------------------------------------------------------------------ */
const ARMS = [];
/* `board`: the knob is allowed (expected) to part a BOARD as well -- a fix that is not narration-only. */
function arm(id, knob, build, opts) { ARMS.push(Object.assign({ id, knob, build }, opts || {})); }

/* Parting Shot (the pivot road) into a partial refuser; control: into a full refuser, where nothing lands and so
 * nothing can be out of order -- the knob must not part it. */
arm('pshot', 'MEDI_DROP_REFUSAL_AFTER_TABLE', () => {
  fresh();
  const PS_AB = ['pickpocket', 'ironfist', 'hungerswitch'];
  /* `abOf` answers a quiet ability or one of PS_AB, never Mold Breaker (which would break Hyper Cutter). */
  const user = take(ALL_LEGAL.filter(s => learns(s, 'partingshot') && learns(s, 'protect') && abOf(s, PS_AB)), 'Parting Shot user');
  const hc = take(ALL_LEGAL.filter(s => hasAb(s, 'hypercutter') && noop(s)), 'Hyper Cutter body');
  const cb = take(ALL_LEGAL.filter(s => hasAb(s, 'clearbody') && noop(s)), 'Clear Body body');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'pivot partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  const p2b = take(SPECIES.filter(s => learns(s, 'protect')), 'target partner');
  say('Parting Shot', user.name + ' (' + abOf(user, PS_AB) + ')'); say('Hyper Cutter', hc.name); say('Clear Body', cb.name);
  const A = [row(user, ['Parting Shot', 'Protect'], abOf(user, PS_AB)), row(p1b, ['Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const B = tgt => [tgt, row(p2b, ['Protect']), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  const script = t => [{ p1: [mv('partingshot', 0), P], p2: [no(t, 1), P] }];
  const after = sd => sd.slice(sd.findIndex(l => /^\|move\|p1a: .*\|Parting Shot/.test(l)));
  return {
    red: { A, B: B(row(hc, [nm(hc), 'Protect'], dex.abilities.get('hypercutter').name)), script: script(hc),
           shape: sd => { const s = after(sd); const f = s.findIndex(l => /^\|-fail\|p2a: .*\|unboost\|Attack\|\[from\] ability: Hyper Cutter/.test(l));
             const u = s.findIndex(l => /^\|-unboost\|p2a: .*\|spa\|1/.test(l)); return f > 0 && u > f; },
           shapeWhy: 'Hyper Cutter refuses the Attack drop ABOVE the Special Attack `-unboost`' },
    control: { A, B: B(row(cb, [nm(cb), 'Protect'], dex.abilities.get('clearbody').name)), script: script(cb),
               shape: sd => { const s = after(sd); return s.some(l => /^\|-fail\|p2a: .*\|unboost\|\[from\] ability: Clear Body/.test(l)) && !s.some(l => /^\|-unboost\|p2a/.test(l)); },
               shapeWhy: 'Clear Body refuses the whole table; nothing lands' },
  };
});

/* The declared-table road (`boostTableOnto`): Tickle's {atk, def} into Hyper Cutter; control: into a quiet body. */
arm('table', 'MEDI_DROP_REFUSAL_AFTER_TABLE', () => {
  fresh();
  const user = take(SPECIES.filter(s => learns(s, 'tickle') && learns(s, 'protect')), 'Tickle user');
  const hc = take(ALL_LEGAL.filter(s => hasAb(s, 'hypercutter') && noop(s)), 'Hyper Cutter body');
  const plain = take(SPECIES.filter(s => noop(s)), 'plain body');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'Tickle partner');
  const p2b = take(SPECIES.filter(s => learns(s, 'protect')), 'target partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Tickle', user.name); say('Hyper Cutter', hc.name); say('plain', plain.name);
  const A = [row(user, ['Tickle', 'Protect']), row(p1b, ['Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const B = tgt => [tgt, row(p2b, ['Protect']), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  const script = t => [{ p1: [mv('tickle', 0), P], p2: [no(t, 1), P] }];
  const after = sd => sd.slice(sd.findIndex(l => /^\|move\|p1a: .*\|Tickle/.test(l)));
  return {
    red: { A, B: B(row(hc, [nm(hc), 'Protect'], dex.abilities.get('hypercutter').name)), script: script(hc),
           shape: sd => { const s = after(sd); const f = s.findIndex(l => /^\|-fail\|p2a: .*\|unboost\|Attack/.test(l));
             const u = s.findIndex(l => /^\|-unboost\|p2a: .*\|def\|1/.test(l)); return f > 0 && u > f; },
           shapeWhy: 'Hyper Cutter refuses the Attack drop ABOVE the Defense `-unboost`' },
    control: { A, B: B(row(plain, [nm(plain), 'Protect'])), script: script(plain),
               shape: sd => { const s = after(sd); return s.filter(l => /^\|-unboost\|p2a/.test(l)).length === 2 && !s.some(l => /^\|-fail/.test(l)); },
               shapeWhy: 'both stats land, nothing refused' },
  };
});

/* Mortal Spin with rocks on its own side; control: the same click with nothing to sweep. */
arm('mortalspin', 'MEDI_SWEEP_UNATTRIBUTED', () => {
  fresh();
  const spinner = take(ALL_LEGAL.filter(s => learns(s, 'mortalspin') && learns(s, 'protect')), 'Mortal Spin user');
  const spAb = Object.values(spinner.abilities).find(a => a !== 'Toxic Debris') || Object.values(spinner.abilities)[0];
  const rocker = take(SPECIES.filter(s => learns(s, 'stealthrock') && noop(s)), 'Stealth Rock setter');
  const mate = take(SPECIES.filter(s => noop(s)), 'setter partner');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'spinner partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Mortal Spin', spinner.name + ' (' + spAb + ')'); say('Stealth Rock', rocker.name);
  const A = [row(spinner, ['Mortal Spin', 'Protect'], spAb), row(p1b, ['Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const B = [row(rocker, ['Stealth Rock', nm(rocker)]), row(mate, [nm(mate)]), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  const t2 = { p1: [mv('mortalspin'), P], p2: [no(rocker, 0), no(mate, 0)] };
  return {
    red: { A, B, script: [{ p1: [P, P], p2: [mv('stealthrock'), no(mate, 0)] }, t2],
           shape: sd => sd.some(l => /^\|-sideend\|p1: .*\|Stealth Rock\|\[from\] move: Mortal Spin/.test(l)),
           shapeWhy: 'Mortal Spin sweeps its own side\'s rocks, attributed' },
    control: { A, B, script: [{ p1: [P, P], p2: [no(rocker, 0), no(mate, 0)] }, t2],
               shape: sd => sd.some(l => /^\|move\|p1a: .*\|Mortal Spin/.test(l)) && !sd.some(l => /^\|-sideend/.test(l)),
               shapeWhy: 'Mortal Spin with nothing to sweep' },
  };
});

/* The spin family's OTHER attributed line: `-end|<user>|Leech Seed|[from] move: <Move>|[of] <user>`. Staged: the
 * spinner is seeded, then spins. CONTROL: the same spin with no seed on it. */
arm('spinseed', 'MEDI_SWEEP_UNATTRIBUTED', () => {
  fresh();
  const spinner = take(ALL_LEGAL.filter(s => learns(s, 'mortalspin') && learns(s, 'protect')), 'Mortal Spin user');
  const spAb = Object.values(spinner.abilities).find(a => a !== 'Toxic Debris') || Object.values(spinner.abilities)[0];
  const IDLE = ['stealthrock', 'toxicspikes', 'spikes'].concat(NOOPS).find(m => legal(dex.moves.get(m)) && learns(spinner, m));
  const seeder = take(SPECIES.filter(s => learns(s, 'leechseed') && noop(s)), 'Leech Seed user');
  const mate = take(SPECIES.filter(s => noop(s)), 'seeder partner');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'spinner partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Mortal Spin', spinner.name + ' (' + spAb + ', idle ' + IDLE + ')'); say('Leech Seed', seeder.name);
  const A = [row(spinner, ['Mortal Spin', dex.moves.get(IDLE).name, 'Protect'], spAb), row(p1b, ['Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const B = [row(seeder, ['Leech Seed', nm(seeder)]), row(mate, [nm(mate)]), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  const idle = mv(IDLE, dex.moves.get(IDLE).target === 'normal' ? 0 : null);
  const t2 = { p1: [mv('mortalspin'), P], p2: [no(seeder, 1), no(mate, 1)] };
  return {
    red: { A, B, script: [{ p1: [idle, P], p2: [mv('leechseed', 0), no(mate, 1)] }, t2],
           shape: sd => sd.some(l => /^\|-end\|p1a: .*\|Leech Seed\|\[from\] move: Mortal Spin/.test(l)),
           shapeWhy: 'Mortal Spin pulls its own Leech Seed, attributed' },
    control: { A, B, script: [{ p1: [idle, P], p2: [no(seeder, 1), no(mate, 1)] }, t2],
               shape: sd => sd.some(l => /^\|move\|p1a: .*\|Mortal Spin/.test(l)) && !sd.some(l => /Leech Seed/.test(l)),
               shapeWhy: 'Mortal Spin with no seed on it' },
  };
});

/* Defog with rocks on its own side (attributed); control: the same Defog taking a SCREEN off the target's side,
 * whose line is the condition's own bare `onSideEnd` -- the knob must not reach it. (Tidy Up, the third sweeper,
 * writes its hazard lines bare too, but it cannot serve as a control: this engine emits its boosts ABOVE the
 * sweep and omits its `-activate`, which parts it on its own -- docs/_reports/2026-09-19-narration-d.md, OWED.) */
arm('defog', 'MEDI_SWEEP_UNATTRIBUTED', () => {
  fresh();
  const defogger = take(SPECIES.filter(s => learns(s, 'defog') && learns(s, 'protect')), 'Defog user');
  const rocker = take(SPECIES.filter(s => learns(s, 'stealthrock') && noop(s)), 'Stealth Rock setter');
  const screener = take(SPECIES.filter(s => learns(s, 'reflect') && noop(s)), 'Reflect setter');
  const mate = take(SPECIES.filter(s => noop(s)), 'setter partner');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'user partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  say('Defog', defogger.name); say('Stealth Rock', rocker.name); say('Reflect', screener.name);
  const A = [row(defogger, ['Defog', 'Protect']), row(p1b, ['Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const B = s1 => [s1, row(mate, [nm(mate)]), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  return {
    red: { A, B: B(row(rocker, ['Stealth Rock', nm(rocker)])),
           script: [{ p1: [P, P], p2: [mv('stealthrock'), no(mate, 0)] }, { p1: [mv('defog', 0), P], p2: [no(rocker, 0), no(mate, 0)] }],
           shape: sd => sd.some(l => /^\|-sideend\|p1: .*\|Stealth Rock\|\[from\] move: Defog/.test(l)),
           shapeWhy: 'Defog sweeps its own side\'s rocks, attributed' },
    control: { A, B: B(row(screener, ['Reflect', nm(screener)])),
               script: [{ p1: [P, P], p2: [mv('reflect'), no(mate, 0)] }, { p1: [mv('defog', 0), P], p2: [no(screener, 0), no(mate, 0)] }],
               shape: sd => sd.some(l => /^\|-sideend\|p2: .*\|Reflect$/.test(l)) && !sd.some(l => /\[from\] move: Defog/.test(l)),
               shapeWhy: 'Defog takes the target side\'s Reflect with a bare line' },
  };
});

/* Magician steals off the target; control: Pickpocket steals off the attacker (its own `-enditem` pair stays). */
arm('magician', 'MEDI_MAGICIAN_ENDITEM_LINE', () => {
  fresh();
  const DMG = s => ['dazzlinggleam', 'playrough', 'flashcannon', 'psychic', 'mysticalfire', 'thunderbolt', 'tackle']
    .find(m => legal(dex.moves.get(m)) && learns(s, m) && dex.moves.get(m).target === 'normal');
  const thief = take(ALL_LEGAL.filter(s => hasAb(s, 'magician') && DMG(s)), 'Magician user');
  const pick = take(ALL_LEGAL.filter(s => hasAb(s, 'pickpocket') && noop(s)), 'Pickpocket body');
  const CONTACT = s => ['tackle', 'quickattack', 'bodyslam', 'return', 'facade'].find(m => legal(dex.moves.get(m)) && learns(s, m));
  const holder = take(SPECIES.filter(s => noop(s) && CONTACT(s)), 'item holder');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'thief partner');
  const p2b = take(SPECIES.filter(s => learns(s, 'protect')), 'holder partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  const item = dex.items.get('leftovers').name;
  say('Magician', thief.name + ' (' + dex.moves.get(DMG(thief)).name + ')'); say('Pickpocket', pick.name);
  say('item holder', holder.name + ' @ ' + item + ' (contact: ' + CONTACT(holder) + ')');
  const B = [row(holder, [nm(holder), dex.moves.get(CONTACT(holder)).name], null, item), row(p2b, ['Protect']), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  return {
    red: { A: [row(thief, [dex.moves.get(DMG(thief)).name, 'Protect'], dex.abilities.get('magician').name), row(p1b, ['Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])],
           B, script: [{ p1: [mv(DMG(thief), 0), P], p2: [no(holder, 0), P] }],
           shape: sd => sd.some(l => /^\|-item\|p1a: .*\|Leftovers\|\[from\] ability: Magician/.test(l)) && !sd.some(l => /^\|-enditem\|p2a/.test(l)),
           shapeWhy: 'Magician takes the Leftovers with one `-item` line' },
    control: { A: [row(pick, [nm(pick), 'Protect'], dex.abilities.get('pickpocket').name), row(p1b, ['Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])],
               B, script: [{ p1: [no(pick, 1), P], p2: [mv(CONTACT(holder), 0), P] }],
               shape: sd => { const e = sd.findIndex(l => /^\|-enditem\|p2a: .*\|Leftovers\|\[silent\]\|\[from\] ability: Pickpocket/.test(l));
                 const i = sd.findIndex(l => /^\|-item\|p1a: .*\|Leftovers\|\[from\] ability: Pickpocket/.test(l)); return e > 0 && i > e; },
               shapeWhy: 'Pickpocket takes the Leftovers with its `-enditem` + `-item` pair' },
  };
});

/* Magician's thief at 0 HP inside its own move: the authority's `setItem` refuses (`!this.hp`) and the victim keeps
 * the item with no line. Staged by halving the thief with Super Fang until its own recoil finishes it. CONTROL: the
 * same board where the thief attacks at full HP and takes the item. */
arm('magicianDead', 'MEDI_MAGICIAN_DEAD_THIEF_TAKES', () => {
  fresh();
  const RECOIL = s => dex.moves.all().filter(x => legal(x) && x.recoil && x.target === 'normal' && learns(s, x.id))
    .sort((a, b) => b.basePower - a.basePower || a.id.localeCompare(b.id))[0];
  const SELF = s => ['calmmind', 'nastyplot', 'swordsdance', 'workup'].find(m => legal(dex.moves.get(m)) && learns(s, m));
  const thief = take(ALL_LEGAL.filter(s => hasAb(s, 'magician') && RECOIL(s) && SELF(s)), 'Magician user with a recoil move');
  const FANG_AB = ['keeneye', 'technician', 'levitate'];
  const fangers = ALL_LEGAL.filter(s => learns(s, 'superfang') && learns(s, 'protect') && abOf(s, FANG_AB));
  const f1 = take(fangers, 'Super Fang user'), f2 = take(fangers, 'Super Fang user');
  const p1b = take(SPECIES.filter(s => learns(s, 'protect')), 'thief partner');
  const bench = [0, 1, 2, 3].map(() => take(SPECIES.filter(s => learns(s, 'protect')), 'bench'));
  const rc = RECOIL(thief), sm = SELF(thief), item = dex.items.get('leftovers').name;
  say('Magician', thief.name + ' (' + rc.name + ', setup ' + sm + ')');
  say('Super Fang', f1.name + ' @ ' + item + ' (' + abOf(f1, FANG_AB) + '), ' + f2.name + ' (' + abOf(f2, FANG_AB) + ')');
  const A = [row(thief, [rc.name, dex.moves.get(sm).name, 'Protect'], dex.abilities.get('magician').name), row(p1b, ['Protect']), row(bench[0], ['Protect']), row(bench[1], ['Protect'])];
  const B = [row(f1, ['Super Fang', 'Protect'], abOf(f1, FANG_AB), item), row(f2, ['Super Fang', 'Protect'], abOf(f2, FANG_AB)), row(bench[2], ['Protect']), row(bench[3], ['Protect'])];
  const fang = { p1: [mv(sm), P], p2: [mv('superfang', 0), mv('superfang', 0)] };
  const blitz = { p1: [mv(rc.id, 0), P], p2: [mv('superfang', 1), P] };
  const t = (sd, n) => sd.slice(sd.lastIndexOf('|turn|' + n));
  return {
    red: { A, B, script: [fang, fang, fang, blitz],
           shape: sd => t(sd, 4).some(l => /^\|faint\|p1a/.test(l)) && t(sd, 4).some(l => /\[from\] Recoil/.test(l))
                        && !sd.some(l => /^\|-item\|p1a/.test(l)),
           shapeWhy: 'the thief dies to its own recoil and takes nothing' },
    control: { A, B, script: [{ p1: [mv(sm), P], p2: [P, P] }, blitz],
               shape: sd => sd.some(l => /^\|-item\|p1a: .*\|Leftovers\|\[from\] ability: Magician/.test(l)),
               shapeWhy: 'the thief at full HP takes the Leftovers' },
  };
}, { board: true });

/* ---- PLAYING ONE ARM --------------------------------------------------------------------------- */
function play(G, sc, name) {
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { notStaged: 'buildPair refused side ' + (!a ? 'A' : 'B') };
  const r = G.playGame(a, b, 'directed', 'probe_narration_d :: ' + name, { script: sc.script, arm });
  return { r, sd: G.sdStream(G.lastSdLog()).map(String), sc: G.scriptCounters(),
           fails: Object.assign({}, globalThis.MEDFAILS || {}) };
}
const divOf = r => r.div ? (r.div.agreedLines + '  SD ' + r.div.sdRaw + '  <>  US ' + r.div.meRaw) : 'none';

printClass();
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
    const leaked = Object.keys(clean.fails).filter(k => /Restored$/.test(k) && clean.fails[k]);
    console.log('    clean  first divergence ' + divOf(clean.r) + '   board ' + (clean.r.stateDiv ? 'PARTED t' + clean.r.stateDiv.turn : 'held ' + clean.r.boundariesAgreed + '/' + clean.r.boundaries));
    console.log('    knob   first divergence ' + divOf(brk.r) + '   board ' + (brk.r.stateDiv ? 'PARTED t' + brk.r.stateDiv.turn : 'held'));
    if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
      console.log('    >> FIXTURE FAILED — a scripted click was refused (' + JSON.stringify(clean.sc) + ')'); bad++; continue; }
    if (process.argv.includes('--show')) console.log(clean.sd.map(l => '      | ' + l).join(NL));
    if (!sc.shape(clean.sd)) { console.log('    >> FIXTURE FAILED — the authority did not stage the shape: ' + sc.shapeWhy); bad++; continue; }
    if (leaked.length) { console.log('    >> the CLEAN run carries a restore stamp (' + leaked.join(', ') + '); the harness leaked a knob.'); bad++; continue; }
    if (clean.r.div) { console.log('    >> RED — the protocol parts with the fix in.'); bad++; continue; }
    if (clean.r.stateDiv) { console.log('    >> RED — the boards part with the fix in.'); bad++; continue; }
    if (kind === 'red' && !brk.r.div) { console.log('    >> THE KNOB DOES NOT REACH THE MECHANISM — the old engine agrees too.'); bad++; continue; }
    if (kind === 'red' && brk.r.stateDiv && !A.board) { console.log('    >> THE KNOB PARTS A BOARD — this was meant to be narration only.'); bad++; continue; }
    if (kind === 'control' && brk.r.div) { console.log('    >> THE KNOB PARTS THE CONTROL — it reaches more than the mechanism.'); bad++; continue; }
    console.log('    OK');
  }
}
console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
console.log(bad ? 'FAIL — ' + bad + ' problem(s) over ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
