#!/usr/bin/env node
/* tests/probe_regmc_terrain_seeds.js — THE TERRAIN SEEDS AND THE GRASSY TERRAIN HEAL, UNDER REG M-C.
 * 2026-09-21 (abra/regmc 0.16.0). Will: "Terrain setters and seeds are the most important features."
 *
 *   node tests/probe_regmc_terrain_seeds.js --regulation regmc                          # green, exit 0
 *   MEDI_SEED_UNCONSUMED=1        node tests/probe_regmc_terrain_seeds.js --regulation regmc   # RED, exit 1
 *   MEDI_SEED_NO_TERRAIN_CHANGE=1 node tests/probe_regmc_terrain_seeds.js --regulation regmc   # RED, exit 1
 *   MEDI_TERRAIN_HEAL_SEMIINV=1   node tests/probe_regmc_terrain_seeds.js --regulation regmc   # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * SHOWDOWN_PATH must be UNSET: the regulation brings its own checkout (engine/showdown_path.js), and the
 * authority for Reg M-C is pokemon-showdown-mc. The release is the NEWEST Reg M-C release; the probe
 * refuses (exit 2) when that release's engine bytes are not the live file, so a stale snapshot cannot
 * pass or fail on somebody else's bytes. Cut one first: `node engine/engine_release.js cut "<why>" --regulation regmc`.
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/items.ts grassyseed :2595-2617 (and electric :1799, misty :4200, psychic :4903 -- same shape)
 *       onSwitchInPriority: -1,
 *       onStart(pokemon)         { if (!pokemon.ignoringItem() && this.field.isTerrain('grassyterrain')) pokemon.useItem(); }
 *       onTerrainChange(pokemon) { if (this.field.isTerrain('grassyterrain')) pokemon.useItem(); }
 *       boosts: { def: 1 },
 *   sim/field.ts:130-157 `setTerrain` ... `this.battle.eachEvent('TerrainChange', sourceEffect)` -- every
 *       active body, speed order, the INSTANT the terrain starts.
 *   data/moves.ts grassyterrain.condition :7711-7718
 *       onResidualOrder: 5, onResidualSubOrder: 2,
 *       onResidual(pokemon) { if (pokemon.isGrounded() && !pokemon.isSemiInvulnerable()) this.heal(pokemon.baseMaxhp / 16, ...) }
 *   `data/mods/champions/*.ts` names none of the four seeds and not grassyterrain.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   STANDING      a Grassy Terrain is up (the move, turn 1) and a Grassy Seed holder switches IN on turn 2.
 *                 The seed's own onStart spends it on entry.
 *   STANDING-CTL  the same, holding the WRONG seed (Psychic). Nothing is spent. Catches "spend any seed".
 *   CHANGE        both holders are ON THE FIELD when the move sets the terrain; the FASTER one is on p2, so
 *                 eachEvent's speed order and the slot order disagree. Turn 2: each holder Knock Offs the
 *                 other -- the item is gone, so no `-enditem` and no x1.5 (the bookkeeping).
 *   WAVE          the lead wave: Grassy Surge + a Grassy Seed holder against Psychic Surge + a Psychic Seed
 *                 holder. Each seed is spent inside its terrain's setter, BEFORE the other setter overwrites
 *                 the terrain -- the timing the entry pass alone gets wrong.
 *   SEMIINV       a Grassy Terrain is up; a grounded body is hit and then goes semi-invulnerable (Phantom
 *                 Force's charge turn). The authority does NOT heal it at the end of the turn.
 *   SEMIINV-CTL   the same body clicks an ordinary move instead: it IS healed. Catches "never heal".
 *
 * PASS = in every arm, the driver's own first-protocol-divergence is NONE and every board boundary compares
 * identical. Each knob re-breaks one mechanic, so under any knob at least one arm parts and this exits 1.
 * Fixture checks on the AUTHORITY (the thing each arm is meant to exercise actually happened there) are
 * asserted too, so a cast that exercises nothing cannot pass.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const NL = '\n';
if (!process.argv.includes('--regulation')) { process.argv.push('--regulation', 'regmc'); }
require(path.join(ROOT, 'engine', 'showdown_path.js'));
const REGN = require(path.join(ROOT, 'engine', 'regulation.js'));
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const MEDI_SRC_PATH = argOf('--medi', null);
const KNOBS = ['MEDI_SEED_UNCONSUMED', 'MEDI_SEED_NO_TERRAIN_CHANGE', 'MEDI_TERRAIN_HEAL_SEMIINV'].filter(k => process.env[k] === '1');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};
console.log(NL + 'tests/probe_regmc_terrain_seeds.js — terrain seeds and the Grassy Terrain heal, regulation ' + REGN.ID);
console.log('  knobs armed: ' + (KNOBS.length ? KNOBS.join(', ') + '   (the defect is RESTORED; this must exit 1)' : 'none'));
if (REGN.ID !== 'regmc') { console.log('  NOT RUN — this probe is a Reg M-C probe and ' + REGN.ID + ' is selected.'); process.exit(2); }

/* abra/regmc 0.18.0 -- a Reg M-C run needs a census pin to load the driver; see tests/regmc_probe_kit.js */
require(path.join(ROOT, 'tests', 'regmc_probe_kit.js')).scriptedCensusPin('probe_regmc_terrain_seeds');
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const G = SB.harness(MEDI_SRC_PATH ? fs.readFileSync(MEDI_SRC_PATH, 'utf8') : undefined);
{
  const strip = s => String(s).replace(/\r/g, '');
  const relBytes = strip(G.REL.read('engine/medicham2-browser.js'));
  const live = strip(fs.readFileSync(path.join(ROOT, 'engine', 'medicham2-browser.js'), 'utf8'));
  console.log('  release ' + G.REL.id + (MEDI_SRC_PATH ? '   engine bytes: ' + MEDI_SRC_PATH : ''));
  if (!MEDI_SRC_PATH && relBytes !== live) {
    console.log('  NOT RUN — the newest Reg M-C release does not hold the live engine. Cut one:\n'
      + '    node engine/engine_release.js cut "<why>" --regulation regmc');
    process.exit(2);
  }
}
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.log('  NOT STAGED — the bottom arm is not in ARM_BY_ID.'); process.exit(1); }
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });

/* ==================================================================================================
 * 1. THE CAST, DERIVED
 * ============================================================================================== */
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const D = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega && !s.battleOnly);
const learnset = s => ((D.species.getLearnsetData(s.id) || {}).learnset) || {};
const learns = (s, mv) => !!learnset(s)[mv];
const abil = s => Object.values(s.abilities || {}).map(a => D.abilities.get(a).id);
/* abilities that would write lines, move a stat, touch an item, set a field or refuse a hit — printed,
 * and every arm's authority fixture check is what catches an omission */
const LOUD = new Set(['intimidate', 'pressure', 'unnerve', 'frisk', 'moldbreaker', 'teravolt', 'turboblaze', 'klutz',
  'pickpocket', 'magician', 'stickyhold', 'unburden', 'symbiosis', 'harvest', 'cudchew', 'ripen', 'gluttony',
  'contrary', 'simple', 'defiant', 'competitive', 'justified', 'stamina', 'weakarmor', 'berserk', 'angerpoint',
  'rattled', 'steadfast', 'mummy', 'lingeringaroma', 'wanderingspirit', 'cursedbody', 'illusion', 'disguise',
  'trace', 'imposter', 'grassysurge', 'psychicsurge', 'electricsurge', 'mistysurge', 'seedsower', 'drought',
  'drizzle', 'sandstream', 'snowwarning', 'mimicry', 'protean', 'libero', 'roughskin', 'ironbarbs', 'flamebody',
  'static', 'poisonpoint', 'effectspore', 'cutecharm', 'gooey', 'tanglinghair', 'aftermath', 'innardsout',
  'perishbody', 'wonderguard', 'sturdy', 'multiscale', 'regenerator', 'emergencyexit', 'wimpout', 'moxie',
  'beastboost', 'soulheart', 'airlock', 'cloudnine', 'neutralizinggas', 'download', 'intrepidsword',
  'dauntlessshield', 'anticipation', 'forewarn', 'costar', 'commander', 'zerotohero', 'hospitality',
  'supersweetsyrup', 'toxicdebris', 'sandspit', 'windpower', 'windrider', 'electromorphosis', 'dancer',
  'flowerveil', 'sweetveil', 'pastelveil', 'healer', 'friendguard', 'telepathy', 'goodasgold', 'magicbounce',
  'prankster', 'galewings', 'triage', 'quickdraw', 'stall', 'mycelium', 'myceliummight', 'naturalcure',
  'shedskin', 'hydration', 'poisonheal', 'guts', 'marvelscale', 'quickfeet', 'grasspelt', 'surgesurfer',
  'levitate', 'sapsipper', 'lightningrod', 'stormdrain', 'voltabsorb', 'waterabsorb', 'flashfire', 'motordrive',
  'dryskin', 'wellbakedbody', 'eartheater', 'purifyingsalt', 'thermalexchange', 'longreach', 'noguard',
  'superluck', 'sniper', 'serenegrace', 'sheerforce', 'shielddust', 'infiltrator', 'screencleaner', 'owntempo',
  'oblivious', 'synchronize', 'innerfocus', 'insomnia', 'vitalspirit', 'comatose', 'leafguard', 'chlorophyll',
  'solarpower', 'swiftswim', 'sandrush', 'slushrush', 'speedboost', 'moody', 'slowstart', 'truant', 'zenmode',
  'stancechange', 'schooling', 'powerconstruct', 'battlebond', 'gulpmissile', 'iceface', 'hungerswitch',
  'protosynthesis', 'quarkdrive', 'orichalcumpulse', 'hadronengine', 'magicguard', 'overcoat', 'bulletproof',
  'soundproof', 'damp', 'liquidooze', 'colorchange', 'receiver', 'powerofalchemy', 'opportunist', 'terashell',
  'terashift', 'teraformzero', 'sharpness', 'toughclaws', 'ironfist', 'reckless', 'rockhead', 'technician']);
const quiet = s => abil(s).find(a => !LOUD.has(a)) || null;
const grounded = s => !(s.types || []).includes('Flying') && !abil(s).includes('levitate');
const byId = id => D.species.get(id);
const show = xs => xs.slice(0, 6).map(s => s.id + '(' + s.baseStats.spe + ')').join(', ') + (xs.length > 6 ? ', …' : '');

const GS = SPEC.filter(s => abil(s).includes('grassysurge') && learns(s, 'protect'));
const PS = SPEC.filter(s => abil(s).includes('psychicsurge') && learns(s, 'protect'));
const GT = SPEC.filter(s => learns(s, 'grassyterrain') && learns(s, 'protect') && quiet(s));
/* seed holders: quiet, Protect and Knock Off, not weak to Dark (they are Knocked Off in CHANGE) */
const HOLD = SPEC.filter(s => quiet(s) && learns(s, 'protect') && learns(s, 'knockoff') && D.getEffectiveness('Dark', s) <= 0)
  .sort((a, b) => (b.baseStats.hp + b.baseStats.def) - (a.baseStats.hp + a.baseStats.def));
const PF = SPEC.filter(s => quiet(s) && grounded(s) && learns(s, 'phantomforce') && learns(s, 'protect'))
  .sort((a, b) => a.baseStats.spe - b.baseStats.spe);
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && grounded(s))
  .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd));
/* the weak neutral hit for SEMIINV: a legal damaging single-target move, 100% or never-miss, no secondary, no
 * self effect, no priority, no charge -- lowest power first -- that the target is neither immune to nor weak to */
const weakHit = (att, tgt) => D.moves.all().filter(m => legal(m) && learns(att, m.id) && m.category !== 'Status'
  && m.target === 'normal' && !m.secondary && !m.secondaries && !m.self && !m.recoil && !m.drain && !m.multihit
  && !m.flags.charge && !m.flags.recharge && !m.priority && !m.selfSwitch && !m.basePowerCallback && !m.damageCallback
  && !m.ohko && !m.selfdestruct && !m.volatileStatus && !m.onHit && !m.onAfterHit && !m.onTry && !m.onTryHit && !m.onBasePower
  && (m.accuracy === true || m.accuracy === 100) && m.basePower >= 20
  && D.getImmunity(m.type, tgt) && D.getEffectiveness(m.type, tgt) <= 0)
  .sort((a, b) => a.basePower - b.basePower)[0] || null;

console.log(NL + '1. THE CAST, DERIVED THIS RUN (' + CS.FORMAT + ')');
console.log('     Grassy Surge          : ' + show(GS));
console.log('     Psychic Surge         : ' + show(PS));
console.log('     Grassy Terrain (move) : ' + show(GT));
console.log('     seed holders          : ' + show(HOLD));
console.log('     Phantom Force, grounded: ' + show(PF));
for (const [t, xs] of [['GS', GS], ['PS', PS], ['GT', GT], ['HOLD', HOLD], ['PF', PF], ['FILL', FILL]])
  if (!xs.length) { console.log('  NOT STAGED — no legal ' + t); process.exit(1); }
for (const it of ['grassyseed', 'psychicseed']) if (!legal(D.items.get(it))) { console.log('  NOT STAGED — ' + it + ' is not legal in ' + CS.FORMAT); process.exit(1); }

const mon = (s, item, mv) => ({ species: s.id, item: item || '', ability: s.id && abil(s).includes('grassysurge') ? 'grassysurge'
  : abil(s).includes('psychicsurge') ? 'psychicsurge' : quiet(s), moves: mv });
const pickDistinct = (pool, used, n) => { const out = []; for (const s of pool) { if (used.has(s.baseSpecies) || used.has(s.id)) continue; out.push(s); used.add(s.baseSpecies); used.add(s.id); if (out.length === n) break; } return out; };

/* ==================================================================================================
 * 2. PLAYING AN ARM
 * ============================================================================================== */
const counters = () => ({ spent: M.MEDSEEN.seedSpent || 0, entry: M.MEDSEEN.seedSpentOnEntry || 0,
  change: M.MEDSEEN.seedSpentOnTerrainChange || 0, semi: M.MEDSEEN.terrainHealSkippedSemiInv || 0,
  gained: M.MEDFAILS.seedGainedUnderTerrain || 0, noSide: M.MEDFAILS.seedTerrainChangeNoSide || 0 });
const canon = l => String(l).toLowerCase().replace(/[\s']/g, '');
const KEEP = /^\|(-enditem|-boost|-unboost|-fieldstart|-heal|-prepare|switch|-item)\|/;
/* THE LINES THIS PROBE OWNS, compared exactly. `-fieldstart` is printed and not compared here: a terrain set by a
 * MOVE carries `[of] <user>` on this engine and not on the authority, a narration difference the driver already
 * declares (its first-protocol-divergence reads NONE over it) and not this mechanic. */
const OWN = /^\|(-enditem|-boost|-unboost|-heal|-item)\|/;

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b || a.length !== A.length || b.length !== B.length) return { staged: false, why: 'buildPair dropped a body' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const c0 = counters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_regmc_terrain_seeds :: ' + tag, { script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const c1 = counters();
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const d = {}; for (const k in c1) d[k] = c1[k] - c0[k];
  return { staged: true, tag, sd, me, sdK: sd.filter(l => KEEP.test(l)).map(canon), meK: me.filter(l => KEEP.test(l)).map(canon),
    boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
    boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.slice(0, 6).join(', ')).join(' | '),
    div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, counters: d };
}
const P = { protect: { m: 'protect' } };
const enditems = R => R.sdK.filter(l => /^\|-enditem\|/.test(l));
const healsOf = (R, who) => R.sdK.filter(l => l.startsWith('|-heal|') && l.includes(who));

/* ==================================================================================================
 * 3. THE ARMS
 * ============================================================================================== */
const used = new Set();
const setter = pickDistinct(GT, used, 1)[0];
const [h1, h2] = pickDistinct(HOLD, used, 2);
const fills = pickDistinct(FILL, used, 6);
if (!setter || !h1 || !h2 || fills.length < 6) { console.log('  NOT STAGED — not enough distinct legal bodies'); process.exit(1); }

/* STANDING and its control */
function standing(seed) {
  const A = [mon(setter, '', ['Grassy Terrain', 'Protect']), mon(fills[0], '', ['Protect']), mon(h1, seed, ['Protect', 'Knock Off']), mon(fills[1], '', ['Protect'])];
  const B = [mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[5], '', ['Protect'])];
  const script = [{ p1: [{ m: 'grassyterrain' }, P.protect], p2: [P.protect, P.protect] },
                  { p1: [P.protect, { sw: h1.id }], p2: [P.protect, P.protect] }];
  return play('standing:' + seed, A, B, script);
}
/* CHANGE: the faster holder on p2 so eachEvent's order and the slot order disagree */
function change() {
  const [slow, fast] = h1.baseStats.spe <= h2.baseStats.spe ? [h1, h2] : [h2, h1];
  const A = [mon(setter, '', ['Grassy Terrain', 'Protect']), mon(slow, 'grassyseed', ['Protect', 'Knock Off']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
  const B = [mon(fast, 'grassyseed', ['Protect', 'Knock Off']), mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect'])];
  const script = [{ p1: [{ m: 'grassyterrain' }, P.protect], p2: [P.protect, P.protect] },
                  { p1: [P.protect, { m: 'knockoff', t: 0 }], p2: [{ m: 'knockoff', t: 1 }, P.protect] }];
  const R = play('change', A, B, script); R.slow = slow; R.fast = fast; return R;
}
/* WAVE: the lead wave with both surges and one holder of each seed */
function wave() {
  const u2 = new Set([GS[0].id, PS[0].id]);
  const [w1, w2] = pickDistinct(HOLD, u2, 2);
  const fl = pickDistinct(FILL, u2, 4);
  const A = [mon(GS[0], '', ['Protect']), mon(w1, 'grassyseed', ['Protect']), mon(fl[0], '', ['Protect']), mon(fl[1], '', ['Protect'])];
  const B = [mon(PS[0], '', ['Protect']), mon(w2, 'psychicseed', ['Protect']), mon(fl[2], '', ['Protect']), mon(fl[3], '', ['Protect'])];
  const script = [{ p1: [P.protect, P.protect], p2: [P.protect, P.protect] }, { p1: [P.protect, P.protect], p2: [P.protect, P.protect] }];
  const R = play('wave', A, B, script); R.w = [w1, w2]; return R;
}
/* SEMIINV and its control: Grassy Surge lead; a slow grounded Phantom Force body is hit by a faster foe, then
 * charges (or, in the control, attacks). The fixture is fixed by trying candidates until the AUTHORITY shows
 * the body damaged at the end of turn 1 in the control -- a heal that cannot show is a fixture that tests nothing. */
function semi() {
  const tried = [];
  for (const pf of PF.slice(0, 8)) {
    const u3 = new Set([GS[0].id, pf.id, pf.baseSpecies]);
    const atkPool = SPEC.filter(s => quiet(s) && !u3.has(s.id) && !u3.has(s.baseSpecies) && s.baseStats.spe >= pf.baseStats.spe + 40
      && learns(s, 'protect') && weakHit(s, pf)).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
    const own = D.moves.all().find(m => legal(m) && learns(pf, m.id) && m.category !== 'Status' && m.target === 'normal'
      && !m.flags.charge && !m.flags.recharge && !m.selfSwitch && !m.priority && !m.self && !m.recoil && !m.drain
      && (m.accuracy === true || m.accuracy === 100) && m.id !== 'phantomforce');
    for (const at of atkPool.slice(0, 3)) {
      const hit = weakHit(at, pf);
      const fl = pickDistinct(FILL, new Set([...u3, at.id, at.baseSpecies]), 4);
      const mk = click => {
        const A = [mon(GS[0], '', ['Protect']), mon(pf, '', ['Phantom Force', own ? own.name : 'Protect', 'Protect']), mon(fl[0], '', ['Protect']), mon(fl[1], '', ['Protect'])];
        const B = [mon(at, '', [hit.name, 'Protect']), mon(fl[2], '', ['Protect']), mon(fl[3], '', ['Protect']), mon(fl[4] || fl[3], '', ['Protect'])];
        return { A, B, script: [{ p1: [P.protect, click], p2: [{ m: hit.id, t: 1 }, P.protect] }] };
      };
      if (!own) { tried.push(pf.id + ': no ordinary move for the control'); break; }
      const c = mk({ m: own.id, t: 1 }), s = mk({ m: 'phantomforce', t: 1 });
      const CTL = play('semiinv-ctl:' + pf.id + '<-' + at.id + '/' + hit.id, c.A, c.B, c.script);
      if (!CTL.staged) { tried.push(pf.id + '<-' + at.id + ' (' + CTL.why + ')'); continue; }
      const who = 'p1b:' + canon(pf.name);
      if (!healsOf(CTL, who).length) { tried.push(pf.id + '<-' + at.id + ' (the authority did not heal it in the control)'); continue; }
      const ARM2 = play('semiinv:' + pf.id + '<-' + at.id + '/' + hit.id, s.A, s.B, s.script);
      if (!ARM2.staged) { tried.push(pf.id + '<-' + at.id + ' (arm: ' + ARM2.why + ')'); continue; }
      if (!ARM2.sdK.some(l => l.startsWith('|-prepare|') && l.includes(who))) { tried.push(pf.id + '<-' + at.id + ' (no Phantom Force charge on the authority)'); continue; }
      return { CTL, ARM: ARM2, who, pf, at, hit, tried };
    }
  }
  return { staged: false, tried };
}

const RUNS = [];
const ST = standing('grassyseed'), STC = standing('psychicseed'), CH = change(), WV = wave(), SI = semi();
RUNS.push(['STANDING', ST], ['STANDING-CTL', STC], ['CHANGE', CH], ['WAVE', WV]);
if (SI.CTL) RUNS.push(['SEMIINV-CTL', SI.CTL], ['SEMIINV', SI.ARM]);

console.log(NL + '2. THE ARMS');
for (const [tag, R] of RUNS) {
  if (!R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + R.why); process.exit(1); }
  console.log('  === ' + tag + ' ===');
  console.log('    showdown : ' + R.sdK.filter(l => !/^\|switch\|/.test(l)).join('  '));
  console.log('    medicham2: ' + R.meK.filter(l => !/^\|switch\|/.test(l)).join('  '));
  console.log('    boards: ' + R.boardDiffs + ' diff(s)' + (R.boardDetail ? '   ' + R.boardDetail : ''));
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none'));
  console.log('    counters: ' + JSON.stringify(R.counters));
}
if (!SI.CTL) { console.log('  NOT STAGED (SEMIINV) —'); for (const t of SI.tried) console.log('      refused: ' + t); process.exit(1); }
for (const t of SI.tried) console.log('    SEMIINV refused first: ' + t);
console.log('    SEMIINV cast: ' + SI.pf.id + ' hit by ' + SI.at.id + ' (' + SI.hit.id + ')');

/* ==================================================================================================
 * 4. THE AUTHORITY EXERCISED WHAT EACH ARM IS FOR (fixture checks, knob-independent)
 * ============================================================================================== */
console.log(NL + '3. THE FIXTURES, ON THE AUTHORITY');
ok(enditems(ST).length === 1 && /grassyseed/.test(enditems(ST)[0]), 'STANDING — the authority spends exactly one Grassy Seed, on entry', JSON.stringify(enditems(ST)));
ok(enditems(STC).length === 0, 'STANDING-CTL — the authority spends nothing (wrong seed for the terrain)', JSON.stringify(enditems(STC)));
{
  const e = enditems(CH);
  ok(e.length === 2 && e[0].includes('p2a:') && e[1].includes('p1b:'),
     'CHANGE — the authority spends BOTH seeds as the terrain starts, the faster (p2a ' + CH.fast.id + ' ' + CH.fast.baseStats.spe
       + ') before the slower (p1b ' + CH.slow.id + ' ' + CH.slow.baseStats.spe + '), i.e. speed order and not slot order; and turn 2\'s Knock Offs remove nothing', JSON.stringify(e));
}
{
  const e = enditems(WV);
  ok(e.length === 2 && e.some(l => /grassyseed/.test(l)) && e.some(l => /psychicseed/.test(l)),
     'WAVE — the authority spends BOTH seeds in the lead wave, each inside its own terrain', JSON.stringify(e));
}
ok(healsOf(SI.CTL, SI.who).length >= 1, 'SEMIINV-CTL — the authority heals the damaged grounded body under Grassy Terrain', JSON.stringify(healsOf(SI.CTL, SI.who)));
ok(healsOf(SI.ARM, SI.who).length === 0, 'SEMIINV — the authority does NOT heal it while it is semi-invulnerable', JSON.stringify(healsOf(SI.ARM, SI.who)));

/* ==================================================================================================
 * 5. THIS ENGINE AGAINST THE AUTHORITY
 * ============================================================================================== */
console.log(NL + '4. MEDICHAM AGAINST THE AUTHORITY');
for (const [tag, R] of RUNS) {
  const sdO = R.sdK.filter(l => OWN.test(l)), meO = R.meK.filter(l => OWN.test(l));
  const same = sdO.length === meO.length && sdO.every((l, i) => l === meO[i]);
  ok(!R.div && same, tag + ' — no protocol divergence, and every enditem/boost/heal line agrees in order',
     R.div ? JSON.stringify(R.div) : (same ? null : 'showdown  ' + sdO.join(' ') + '\nmedicham2 ' + meO.join(' ')));
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
}

/* ==================================================================================================
 * 6. THE ENGINE'S OWN RECEIPTS (clean run only; a knob run is already red above)
 * ============================================================================================== */
if (!KNOBS.length && !MEDI_SRC_PATH) {
  console.log(NL + '5. THE COUNTERS');
  ok(ST.counters.entry === 1 && ST.counters.change === 0, 'STANDING spent one seed on the ENTRY road', JSON.stringify(ST.counters));
  ok(STC.counters.spent === 0, 'STANDING-CTL spent nothing', JSON.stringify(STC.counters));
  ok(CH.counters.change === 2 && CH.counters.entry === 0, 'CHANGE spent two seeds on the TERRAINCHANGE road', JSON.stringify(CH.counters));
  ok(WV.counters.change === 2 && WV.counters.entry === 0, 'WAVE spent both seeds on the TERRAINCHANGE road, inside the setters', JSON.stringify(WV.counters));
  ok(SI.ARM.counters.semi >= 1 && SI.CTL.counters.semi === 0, 'SEMIINV skipped the heal on the semi-invulnerable body; the control did not', 'arm ' + SI.ARM.counters.semi + ' / control ' + SI.CTL.counters.semi);
  ok(RUNS.every(([, R]) => R.counters.gained === 0 && R.counters.noSide === 0), 'no seed reached the unmodelled gain door, and no terrain start lacked its side back-reference');
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
