#!/usr/bin/env node
/* tests/probe_charge_boost_contrary.js — THE CHARGE-TURN SELF-BOOST GOES THROUGH `Battle#boost`.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_charge_boost_contrary.js
 *   SHOWDOWN_PATH=... MEDI_CHARGE_BOOST_RAW=1 node tests/probe_charge_boost_contrary.js   (must exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * Electro Shot and Meteor Beam raise Special Attack as they wind up, and they do it with the ordinary
 * call:
 *
 *     onTryMove(attacker, defender, move) {
 *       if (attacker.removeVolatile(move.id)) return;
 *       this.add('-prepare', attacker, move.name);
 *       this.boost({spa: 1}, attacker, attacker, move);          data/moves.ts, electroshot / meteorbeam
 *       ...
 *     }
 *
 * `Battle#boost` raises `ChangeBoost` before it writes anything (sim/battle.ts), and that is the one
 * event Contrary and Simple hang off:
 *
 *     contrary: { onChangeBoost(boost) { for (const i in boost) boost[i]! *= -1; } }   data/abilities.ts
 *     simple:   { onChangeBoost(boost) { for (const i in boost) boost[i]! *= 2; } }
 *
 * Both are `flags: {breakable: 1}`, and neither ability nor either move is overridden in
 * `data/mods/champions/` — this file greps all four and prints the answer on every run.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `engine/medicham2-browser.js` applied the charge-turn boost by RAW ARITHMETIC on `m.boosts`:
 *
 *     m.boosts[_kk] = Math.max(-6, Math.min(6, m.boosts[_kk] + _b[_k]));
 *
 * — it never asked `invSign`, which is this engine's single reader of "at what multiplier does this
 * body take a stat change" (Contrary -1, Simple x2). Twelve other boost sites call it; this one did
 * not, which is the private-copy shape CLAUDE.md's FACTS-ARE-GLOBAL rule names.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * Row 5 of the NINE board partings in the held-out 12,000-game draw on release `51b80f9fcf08`
 * (`data/verification/game-differential.g12000.json`):
 *
 *     omit-intimidate  …bo3-2657170022 vs …bo3-2657402800   turn 9
 *       a Malamar Skill Swaps Contrary onto an Archaludon on turn 7; on turn 9 Archaludon winds up
 *       Electro Shot.
 *       showdown  |-unboost|p1b: Archaludon|spa|1   -> |-damage|p2a: Metagross|77/155
 *       medicham  |-boost|p1b: Archaludon|spa|1     -> |-damage|p2a: Metagross|1/155
 *       -> p1.party.archaludon.boosts.spa  2 here, 0 there, and the damage that follows is a
 *          four-stage swing on the body it is aimed at
 *
 * ================= THE ARMS ======================================================================
 *
 *   CONTROL   no Skill Swap. The winder keeps its own ability, and the charge boost must be +1 in
 *             BOTH engines — that is what says the fixture can see the boost at all and that the
 *             ability is the one varied thing.
 *   SWAPPED   the identical board with the inverter clicking Skill Swap on turn 1. The charge boost
 *             must be -1, and the two streams must not part.
 *   KNOB      a reload under MEDI_CHARGE_BOOST_RAW=1. The SWAPPED arm must go back to +1. A knob
 *             that changes nothing is reported RED.
 *
 * THE ABILITY IS ACQUIRED RATHER THAN NATIVE, because that is the game that parted and because no
 * legal carrier of an `invertsBoosts` ability learns either charge move — the probe derives both
 * populations and says so.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const KNOB = 'MEDI_CHARGE_BOOST_RAW';
const KNOB_SET = process.env[KNOB] === '1';
if (KNOB_SET) {
  console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so the SWAPPED arm is expected to');
  console.log('  FAIL and this run MUST exit 1. The internal knob arm is skipped.');
}

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
const ARG = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_charge_boost_contrary.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

process.argv.push('--state');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else if (!KNOB_SET) delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

let bad = 0;
console.log(NL + '  === THE AUTHORITY, GREPPED THIS RUN ===');
{
  const fs = require('fs');
  const SP = process.env.SHOWDOWN_PATH;
  const mvs = fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8');
  const abs = fs.readFileSync(path.join(SP, 'data', 'abilities.ts'), 'utf8');
  const modM = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const modA = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
  const TAB = String.fromCharCode(9);
  const block = (src, key) => { const i = src.indexOf(NL + TAB + key + ': {');
    return i < 0 ? '' : src.slice(i, src.indexOf(NL + TAB + '},', i)); };
  for (const mv of ['electroshot', 'meteorbeam']) {
    const b = block(mvs, mv);
    const call = (b.match(/this\.boost\(\{[^}]*\}[^)]*\)/) || [])[0];
    console.log('    ' + mv.padEnd(12) + ' onTryMove raises : ' + (call || 'NOT FOUND')
      + '   [champions override? ' + new RegExp('[\\n\\t]' + mv + ': \\{').test(modM) + ']');
    if (!call) { console.log('    COULD NOT READ THE CALL.'); bad++; }
  }
  for (const ab of ['contrary', 'simple']) {
    const b = block(abs, ab);
    const h = (b.match(/onChangeBoost\(boost[^}]*\}[^}]*\}/) || [])[0] || '';
    console.log('    ' + ab.padEnd(12) + ' onChangeBoost    : ' + (h.replace(/\s+/g, ' ') || 'NOT FOUND')
      + '   [champions override? ' + new RegExp('[\\n\\t]' + ab + ': \\{').test(modA) + ']');
  }
  console.log('    -> the charge boost is an ordinary `Battle#boost`, so ChangeBoost sees it.');
}

/* ---- THE POPULATIONS, PRINTED BEFORE ANYTHING IS WIRED TO THEM -------------------------------- */
console.log(NL + '  === THE FIXTURE, DERIVED THIS RUN ===');
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const G0 = harness(false);
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .filter(s => !G0.CLOSET_SPECIES.has(norm(s.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);

/* THE MOVE: anything whose derived `chargeTurn` carries a boost block. */
const CHARGERS = Object.keys(TAGS.moves || {})
  .filter(k => { const p = (TAGS.moves[k].params || {}).chargeTurn; return p && p.boosts; })
  .filter(k => { const m = dex.moves.get(k); return m.exists && !m.isNonstandard; });
/* THE ABILITY: anything tagged `invertsBoosts`. */
const INVERTERS = Object.keys(TAGS.abilities || {})
  .filter(k => (TAGS.abilities[k].params || {}).invertsBoosts);
/* THE HAND-OVER: a move tagged `swapsAbilities`. */
const SWAPPERS = Object.keys(TAGS.moves || {})
  .filter(k => ((TAGS.moves[k].params || {}).swapsAbilities || {}).swaps)
  .filter(k => { const m = dex.moves.get(k); return m.exists && !m.isNonstandard && m.target === 'normal'; });
console.log('    charge moves carrying a boost : ' + (CHARGERS.join(' ') || 'NONE'));
console.log('    abilities tagged invertsBoosts: ' + (INVERTERS.join(' ') || 'NONE'));
console.log('    moves tagged swapsAbilities   : ' + (SWAPPERS.join(' ') || 'NONE'));
if (!CHARGERS.length || !INVERTERS.length || !SWAPPERS.length) {
  console.log('    A POPULATION IS EMPTY — a claim about the artifact, not about the engine.'); process.exit(2);
}
const NATIVE = POOL.filter(s => CHARGERS.some(k => LEARNS(s, k))
  && Object.values(s.abilities).some(a => INVERTERS.includes(norm(a))));
console.log('    legal carriers that LEARN one : ' + (NATIVE.map(s => s.name).join(', ') || 'NONE — so the ability is acquired'));

/* A self-aimed stat-boost hold: inert, and it cannot re-order the turn or move a foe. */
const SELF_HOLD = (s) => Object.keys(LS(s)).find(k => {
  const m = dex.moves.get(k);
  if (!m.exists || m.isNonstandard || m.category !== 'Status' || m.target !== 'self') return false;
  if (!m.boosts || m.priority !== 0) return false;
  if (m.boosts.spe || m.boosts.evasion || m.boosts.accuracy) return false;
  return !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.slotCondition && !m.selfdestruct
    && !m.volatileStatus && !m.sideCondition && !m.pseudoWeather && !m.weather && !m.terrain;
}) || null;

/* THE WINDER: a legal user of a boosting charge move, whose own abilities are all quiet (nothing that
 * could set weather — `chargeSkippedByWeather` would skip the charge turn and the boost with it) and
 * nothing that refuses the swap. */
const QUIET = new Set(['setsWeather', 'onSwitchInWeather', 'invertsBoosts', 'amplifiesBoosts',
  'refusesDrops', 'refusesStatusMoves', 'statusImmune', 'onSwitchInDrop', 'copiesAbilityOnEntry',
  'tracesAbility', 'speedMultiplier']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => QUIET.has(t))
  && !(dex.abilities.get(ab).flags || {}).failskillswap);

let MV = null, WIND = null, STAT = null, STEP = null;
for (const k of CHARGERS) {
  const m = dex.moves.get(k);
  if (m.accuracy !== true && m.accuracy < 100) continue;   // the top-corner arm misses everything under 100
  const w = POOL.find(s => LEARNS(s, k) && okAbility(s) && SELF_HOLD(s));
  if (!w) continue;
  const b = (TAGS.moves[k].params.chargeTurn || {}).boosts || {};
  const st = Object.keys(b)[0];
  MV = m; WIND = w; STAT = st; STEP = b[st];
  break;
}
if (!MV) { console.log('    COULD NOT STAGE — no 100-accuracy boosting charge move with a quiet legal user.'); process.exit(2); }

/* THE INVERTER: a legal carrier of an `invertsBoosts` ability that learns a swapper. */
let INV = null, INV_AB = null, SWAP = null;
for (const s of POOL) {
  const ab = Object.values(s.abilities).find(a => INVERTERS.includes(norm(a)));
  if (!ab || s.name === WIND.name) continue;
  const sw = SWAPPERS.find(k => LEARNS(s, k));
  if (!sw || !SELF_HOLD(s)) continue;
  INV = s; INV_AB = ab; SWAP = sw; break;
}
if (!INV) { console.log('    COULD NOT STAGE — no legal inverter that learns a swapper.'); process.exit(2); }

const FILL = POOL.filter(s => ![WIND.name, INV.name].includes(s.name) && SELF_HOLD(s)).slice(0, 6);
if (FILL.length < 6) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log(NL + '    the WINDER   p1a : ' + WIND.name + ' [' + okAbility(WIND) + '] winds up ' + MV.id
  + ' (' + STAT + ' +' + STEP + ' on the charge turn)');
console.log('    the INVERTER p2a : ' + INV.name + ' [' + INV_AB + '] hands it over with ' + SWAP);
console.log('    AUTHORITY    : after the swap the charge turn writes ' + STAT + ' ' + (-STEP));
console.log('    DEFECT       : the charge boost was raw arithmetic — ' + STAT + ' +' + STEP + ' whatever the ability' + NL);

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, moves, ability) => ({ species, item: '', ability: ability || '', moves });
const NAME = id => dex.moves.get(id).name;
const sides = () => ([
  [mon(WIND.name, [MV.name, SELF_HOLD(WIND)], okAbility(WIND)),
   mon(FILL[0].name, [SELF_HOLD(FILL[0])]), mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
   mon(FILL[2].name, [SELF_HOLD(FILL[2])])],
  [mon(INV.name, [NAME(SWAP), SELF_HOLD(INV)], INV_AB),
   mon(FILL[3].name, [SELF_HOLD(FILL[3])]), mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
   mon(FILL[5].name, [SELF_HOLD(FILL[5])])],
]);
const script = (swap) => ([
  /* turn 1 — the ability changes hands (or does not) */
  { p1: [{ m: norm(SELF_HOLD(WIND)) }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [swap ? { m: norm(SWAP), t: 0 } : { m: norm(SELF_HOLD(INV)) }, { m: norm(SELF_HOLD(FILL[3])) }] },
  /* turn 2 — the winder winds up, and the charge turn writes the stage */
  { p1: [{ m: norm(MV.id), t: 0 }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(SELF_HOLD(INV)) }, { m: norm(SELF_HOLD(FILL[3])) }] },
]);

const stage = (x) => (x && x.boosts ? (x.boosts[STAT] || 0) : null);
function play(G, swap, tag) {
  const [SA, SB] = sides();
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'chargecontrary/' + tag, {
    arm: G.ARM_BY_ID.get('top-tie-first'),
    script: script(swap),
    onBoundary: (snap) => seen.push({
      me: stage(snap.medi.sides.p1.party[norm(WIND.name)]),
      sd: stage(snap.sd.sides.p1.party[norm(WIND.name)]),
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (seen.length < 3) return { staged: false, why: 'only ' + seen.length + ' boundary(ies) reached' };
  return { staged: true, M: seen[seen.length - 1], sd: G.sdStream(G.lastSdLog()),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}
const show = (R) => {
  console.log('      the WINDER\'s ' + STAT + ' stage   me ' + String(R.M.me).padEnd(4) + ' sd ' + R.M.sd);
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
  else console.log('      streams agree for the whole game');
};

/* ---- ARM 1: CONTROL. The boost must happen at all. --------------------------------------------- */
console.log('  --- CONTROL (no swap): the charge turn writes ' + STAT + ' +' + STEP + ' ---');
let controlClean = null;
{
  const R = play(harness(false), false, 'control');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  controlClean = R;
  show(R);
  if (R.div) { console.log('      RED — the two engines part on the control board.'); bad++; }
  else if (R.M.sd !== STEP) {
    console.log('      RED — the AUTHORITY did not write ' + STEP + ' (' + R.M.sd + '). THE FIXTURE CANNOT SEE');
    console.log('      THE CHARGE BOOST, so the SWAPPED arm would pass for the wrong reason.'); bad++;
  } else if (R.M.me !== STEP) { console.log('      RED — this engine did not write the charge boost at all.'); bad++; }
  else console.log('      ok — both engines write ' + STAT + ' +' + STEP);
}

/* ---- ARM 2: SWAPPED. The claim. ---------------------------------------------------------------- */
console.log(NL + '  --- SWAPPED (' + INV_AB + ' handed over): the charge turn writes ' + STAT + ' ' + (-STEP) + ' ---');
let swappedClean = null;
{
  const R = play(harness(false), true, 'swapped');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  swappedClean = R;
  /* THE SWAP HAS TO HAVE HAPPENED, and that is read off the AUTHORITY's own stream. */
  const handed = (R.sd || []).some(l => new RegExp('^\\|-activate\\|p2a[^|]*\\|(move: )?' + dex.moves.get(SWAP).name, 'i').test(l));
  if (!handed) {
    console.log('      NOT STAGED — the authority\'s stream carries no ' + SWAP + ' activation, so the');
    console.log('      ability never changed hands and nothing below is about the inverter.'); process.exit(2);
  }
  show(R);
  if (R.div) { console.log('      RED — the streams part after the swap.'); bad++; }
  if (R.M.sd !== -STEP) {
    console.log('      RED — the AUTHORITY wrote ' + R.M.sd + ', not ' + (-STEP) + '. This probe is wrong, not the engine.'); bad++;
  } else if (R.M.me !== -STEP) {
    console.log('      RED — we wrote ' + R.M.me + ': the charge boost did not go through the inverter.'); bad++;
  } else if (!R.div) console.log('      ok — both engines write ' + STAT + ' ' + (-STEP) + ', and the streams agree');
}

/* ---- ARM 3: THE KNOB. A knob that changes nothing is unwired. ---------------------------------- */
if (!KNOB_SET) {
  console.log(NL + '  --- KNOB ' + KNOB + '=1: the defect must come back ---');
  const R = play(harness(true), true, 'knob');
  const C = play(harness(true), false, 'knob-control');
  harness(false);
  if (!R.staged) { console.log('      NOT STAGED under the knob — ' + R.why); bad++; }
  else {
    show(R);
    if (R.M.me === swappedClean.M.me && !!R.div === !!swappedClean.div) {
      console.log('      RED — THE KNOB CHANGED NOTHING. Identical results across a varied knob mean');
      console.log('      the knob is unwired, not that the ability does not matter.'); bad++;
    } else console.log('      ok — the knob restores the raw arithmetic, so the arm above is live');
    if (C.staged && C.M.me !== controlClean.M.me) {
      console.log('      RED — the knob also moved the CONTROL arm, so it is not scoped to the inverter.'); bad++;
    } else console.log('      ok — the knob leaves the control arm exactly where it was');
  }
}

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — the charge-turn boost goes through the boost reader.') + NL);
process.exit(bad ? 1 : 0);
