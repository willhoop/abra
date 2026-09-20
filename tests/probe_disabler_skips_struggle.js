#!/usr/bin/env node
/* tests/probe_disabler_skips_struggle.js — THE ON-HIT DISABLER DOES NOT ROLL FOR STRUGGLE.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_disabler_skips_struggle.js
 *   SHOWDOWN_PATH=... MEDI_DISABLER_SEALS_STRUGGLE=1 node tests/probe_disabler_skips_struggle.js  (exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *     cursedbody.onDamagingHit(damage, target, source, move) {      data/abilities.ts:774-787
 *       if (source.volatiles['disable']) return;
 *       if (!move.isMax && !move.flags['futuremove'] && move.id !== 'struggle') {
 *         if (this.randomChance(3, 10)) source.addVolatile('disable', this.effectState.target);
 *
 * `move.id !== 'struggle'` is a GUARD ON THE EVENT, not on the die: a Struggle never reaches the
 * roll at all. `data/mods/champions/abilities.ts` carries NO `cursedbody` key — grepped on every run
 * below, not remembered — so mainline governs.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `engine/medicham2-browser.js`'s late `DamagingHit` reactor (`_lateReactorsOf`) reproduced the
 * FIRST guard — `!m.fainted && !(m._vol && m._vol.disable > 0)` — and not the second. So a body that
 * Struggled into a Cursed Body carrier was rolled for, and 30% of the time it lost its whole menu to
 * a Disable the real game never applies. `isStruggleAction` already exists in that file as the ONE
 * reader of "is this action Struggle" (ROADMAP #459) and was not consulted here.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * Row 14 of the fifteen board partings in the held-out 12,000-game draw on release `834713ccb303`
 * (`data/verification/game-differential.g12000.json`, seed
 * `gen9championsvgc2026regmbbo3-2656401580`, turn 13):
 *
 *     showdown   |-damage|p2b: Basculegion|48/195|[from] recoil
 *     medicham2  |-start|p2b: Basculegion|Disable|struggle|[from] ability: cursedbody|[of] p1b: Froslass
 *                |-damage|p2b: Basculegion|48/195|[from] recoil
 *
 * and the board leaf is `p2.active[1].vol.disable  us=3  showdown=0`.
 *
 * ================= THE ARMS AND WHY THE ARM IS `bottom-tie-first` ================================
 *
 * The roll is 30%, so an arm that leaves it to a die could pass by LOSING the roll — green for the
 * wrong reason, which is this repository's most expensive failure shape. `bottom-tie-first` is the
 * arm on which *"every secondary fires"* (engine/game_differential.js, the arm's own `what`), so the
 * disable is DETERMINISTIC and the die cannot hide anything.
 *
 *   ARMED    the clicker still holds its damaging move and aims it at the carrier. The Disable must
 *            land, in BOTH engines. This is the control that clears the knob explicitly: without it
 *            "no Disable after Struggle" is satisfied by a fixture in which no Disable ever lands.
 *   DRAINED  the identical board with the damaging move removed, so the clicker's bar empties and it
 *            Struggles into the same carrier. NEITHER engine may write a Disable, and the streams
 *            must not part.
 *   KNOB     a reload under MEDI_DISABLER_SEALS_STRUGGLE=1: the DRAINED arm must produce the Disable
 *            here and part. **Identical results across a varied knob mean the knob is unwired.**
 *
 * ONE REASON PER CELL. The PP bar is spent by a SELF-TARGETING STATUS move, which raises no
 * `DamagingHit` at all — so the carrier's roll is never reached before the test turn and the
 * authority's FIRST guard (`source.volatiles['disable']`) cannot be the reason the DRAINED arm is
 * quiet. Both foes carry the ability, because Struggle picks its target at random among adjacent
 * foes and a fixture that depended on which one it picked would be a coin flip wearing an assertion.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const KNOB = 'MEDI_DISABLER_SEALS_STRUGGLE';
const KNOB_SET = process.env[KNOB] === '1';
if (KNOB_SET) {
  console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE. The DRAINED arm is expected to FAIL and');
  console.log('  this run MUST exit 1. The internal knob arm is skipped.');
}

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
const ARGV = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let REL_ID = ARGV('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_disabler_skips_struggle.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

if (!process.argv.includes('--state')) process.argv.push('--state');
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
  const abs = fs.readFileSync(path.join(SP, 'data', 'abilities.ts'), 'utf8');
  const modA = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
  const TAB = String.fromCharCode(9);
  const i = abs.indexOf(NL + TAB + 'cursedbody: {');
  const block = i < 0 ? '' : abs.slice(i, abs.indexOf(NL + TAB + '},', i));
  const guarded = /move\.id\s*!==\s*['"]struggle['"]/.test(block);
  console.log('    cursedbody guards on move.id !== "struggle" : ' + guarded);
  console.log('    overridden by Champions                     : ' + /[\n\t]cursedbody: \{/.test(modA));
  if (!guarded) {
    console.log('    THE AUTHORITY DOES NOT EXEMPT STRUGGLE — this probe asserts something the format');
    console.log('    does not say, and is WRONG rather than the engine.'); bad++;
  }
}

/* ---- THE POPULATIONS, PRINTED BEFORE ANYTHING IS WIRED TO THEM -------------------------------- */
console.log(NL + '  === THE FIXTURE, DERIVED THIS RUN ===');
const DISABLERS = Object.keys(TAGS.abilities || {})
  .filter(k => (TAGS.abilities[k].tags || []).includes('disablesAttacker'));
console.log('    abilities tagged disablesAttacker : ' + (DISABLERS.join(', ') || 'NONE'));
if (!DISABLERS.length) { console.log('    POPULATION EMPTY — a claim about the artifact.'); process.exit(2); }

const G0 = harness(false);
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .filter(s => !G0.CLOSET_SPECIES.has(norm(s.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
/* A self-targeting status move raises no DamagingHit, so spending the bar cannot pre-arm the
 * authority's FIRST guard. Shortest bar first, so the script is as short as the format allows. */
/* A PURE SELF-BOOST, AND THE PREDICATE IS THE REASON RATHER THAN A NAME LIST.
 * `!m.status` is not enough: REST declares no `status` field at all and puts its user to sleep from
 * inside `onHit`, so the first staging spent the bar and then could not act on the test turn. What
 * this arm needs is a move that moves its own user's STAGES and touches nothing else — so the test
 * is `boosts`, every entry positive, and no accuracy or evasion entry (which would put the hit
 * question into an arm whose whole point is that the hit question is fixed). */
const IDLE_OF = (s) => {
  const ls = LS(s);
  return Object.keys(ls).map(k => dex.moves.get(k))
    .filter(m => m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.volatileStatus && !m.selfdestruct
      && !m.status && !m.forceSwitch && !m.onHit
      && m.boosts && Object.values(m.boosts).every(v => v > 0)
      && !('evasion' in m.boosts) && !('accuracy' in m.boosts))
    .sort((a, b) => a.pp - b.pp)[0] || null;
};
const HIT_OF = (s) => {
  const ls = LS(s);
  return Object.keys(ls).map(k => dex.moves.get(k))
    .filter(m => m.exists && !m.isNonstandard && m.category !== 'Status' && m.target === 'normal'
      && !m.multihit && !m.flags.charge && !m.flags.futuremove && !m.selfdestruct
      && !m.recoil && !m.selfSwitch)[0] || null;
};

const CARRIERS = POOL.filter(s => Object.values(s.abilities).some(a => DISABLERS.includes(norm(a))))
  .filter(s => IDLE_OF(s));
console.log('    legal carriers of it              : ' + (CARRIERS.map(s => s.name).join(', ') || 'NONE'));
/* TWO DISTINCT CARRIER SPECIES. Struggle picks at random among adjacent foes, so both foe slots must
 * carry the ability or the arm is a coin flip — and Species Clause forbids putting the same body in
 * both slots, which is what the first staging tried. */
if (CARRIERS.length < 2) { console.log('    FEWER THAN TWO LEGAL CARRIERS — a claim about the format.'); process.exit(2); }
const CAR = CARRIERS[0], CAR2 = CARRIERS[1];
const abOf = s => Object.values(s.abilities).find(a => DISABLERS.includes(norm(a)));
const CAR_AB = abOf(CAR), CAR2_AB = abOf(CAR2);

/* THE SHORTEST BAR WINS. The script is one turn per PP point, and the turn cap is 50, so a clicker
 * whose cheapest self-boost has 20 PP would need 33 turns and leaves no margin. Chosen by the bar
 * rather than by alphabetical luck. */
const CK = POOL.filter(s => ![CAR.name, CAR2.name].includes(s.name) && IDLE_OF(s) && HIT_OF(s))
  .sort((a, b) => IDLE_OF(a).pp - IDLE_OF(b).pp)[0];
if (!CK) { console.log('    NO LEGAL CLICKER.'); process.exit(2); }
const IDLE = IDLE_OF(CK), HIT = HIT_OF(CK);
const FILL = POOL.filter(s => ![CAR.name, CAR2.name, CK.name].includes(s.name) && IDLE_OF(s)).slice(0, 4);
if (FILL.length < 4) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log('    the CARRIERS: ' + CAR.name + ' [' + CAR_AB + '] and ' + CAR2.name + ' [' + CAR2_AB
  + '], BOTH slots, so Struggle\'s random pick cannot decide the arm');
console.log('    the CLICKER : ' + CK.name + '  spends ' + IDLE.id + ' (printed pp ' + IDLE.pp + ')');
console.log('    the ARMED arm keeps ' + HIT.id + ' and aims it at the carrier on the test turn');

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
const teamP1 = (armed) => [
  mon(CK.name, '', armed ? [HIT.name, IDLE.name] : [IDLE.name]),
  mon(FILL[0].name, '', [IDLE_OF(FILL[0]).name]),
  mon(FILL[1].name, '', [IDLE_OF(FILL[1]).name]),
  mon(FILL[2].name, '', [IDLE_OF(FILL[2]).name]),
];
const TEAM_P2 = [
  mon(CAR.name, CAR_AB, [IDLE_OF(CAR).name]),
  mon(CAR2.name, CAR2_AB, [IDLE_OF(CAR2).name]),
  mon(FILL[3].name, '', [IDLE_OF(FILL[3]).name]),
  mon(FILL[1].name, '', [IDLE_OF(FILL[1]).name]),
];
/* THE BAR IS READ OFF THE AUTHORITY'S OWN REQUEST, NOT COMPUTED FROM `move.pp`.
 * The obvious arithmetic — Showdown's full 8/5 PP-up boost for a set that declares none — is WRONG
 * for a body this harness builds, and assuming it put the clicker out of PP five turns before the
 * script expected it (`Can't move: Altaria's Cotton Guard is disabled`, which is how Showdown words
 * an empty bar as well as a real Disable). So a one-turn discovery game is played first and the
 * request's own `pp` field decides the length of every script below. */
const HP_BOOST = 8;
let BAR = null;
{
  const Gd = harness(false);
  const a = Gd.buildPair(teamP1(false), { hpBoost: HP_BOOST }), b = Gd.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) { console.log('    NOT STAGED — buildPair returned null on the discovery game.'); process.exit(2); }
  Gd.resetScriptCounters();
  Gd.playGame(a, b, 'directed', 'disablerskipsstruggle/discover', {
    arm: Gd.ARM_BY_ID.get('bottom-tie-first'),
    script: [{ p1: [{ m: norm(IDLE.id) }, { m: norm(IDLE_OF(FILL[0]).id) }],
               p2: [{ m: norm(IDLE_OF(CAR).id) }, { m: norm(IDLE_OF(CAR2).id) }] }],
    onBoundary: (snap, turnIdx, S, battle) => {
      if (BAR !== null) return;
      const act = battle && battle.p1 && battle.p1.activeRequest && battle.p1.activeRequest.active
        && battle.p1.activeRequest.active[0];
      const slot = act && act.moves && act.moves.find(m => norm(m.id) === norm(IDLE.id));
      if (slot && typeof slot.pp === 'number') BAR = slot.pp;
    },
  });
}
if (!BAR) { console.log('    COULD NOT READ THE BAR off the authority\'s request.'); process.exit(2); }
const TEST_TURN = BAR + 1;
console.log('    the bar the authority actually grants: ' + BAR + ', so the test turn is ' + TEST_TURN);

const script = (armed) => {
  const out = [];
  for (let t = 1; t <= TEST_TURN; t++) {
    const last = t === TEST_TURN;
    const click = last ? (armed ? { m: norm(HIT.id), t: 0 } : { m: 'struggle' }) : { m: norm(IDLE.id) };
    out.push({ p1: [click, { m: norm(IDLE_OF(FILL[0]).id) }],
               p2: [{ m: norm(IDLE_OF(CAR).id) }, { m: norm(IDLE_OF(CAR2).id) }] });
  }
  return out;
};
/* Nothing may faint: min-damage arm, one unboosted hit, and an 8x HP multiplier (HP_BOOST, above)
 * on both sides. Asserted below rather than hoped for. */
const disableLines = (lines) => (lines || []).map(l => String(l).toLowerCase())
  .filter(l => /^\|-start\|/.test(l) && /\|disable\|/.test(l));

function play(G, armed, tag) {
  const a = G.buildPair(teamP1(armed), { hpBoost: HP_BOOST }), b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  G.resetScriptCounters();
  let offered = null, fainted = false;
  const r = G.playGame(a, b, 'directed', 'disablerskipsstruggle/' + tag, {
    arm: G.ARM_BY_ID.get('bottom-tie-first'),
    script: script(armed),
    onBoundary: (snap, turnIdx, S, battle) => {
      const req = battle && battle.p1 && battle.p1.activeRequest;
      const act = req && req.active && req.active[0];
      if (turnIdx === TEST_TURN && act) offered = act.moves ? act.moves.map(m => m.id).join(',') : '(none)';
      for (const side of ['p1', 'p2'])
        for (const p of ((battle && battle[side] && battle[side].pokemon) || []))
          if (p.fainted) fainted = true;
    },
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  return { staged: true, offered, fainted,
           sd: disableLines(G.lastSdLog ? G.lastSdLog() : []),
           me: disableLines((r && r.mediTrace) || []),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, turns: r.turns };
}
const show = (R) => {
  console.log('      disable lines  sd ' + (R.sd.length ? R.sd.join(' ; ') : '(none)'));
  console.log('                     me ' + (R.me.length ? R.me.join(' ; ') : '(none)'));
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
  else console.log('      streams agree for the whole game');
};

/* ---- ARM 1: ARMED. The disabler must work at all, or nothing below means anything. ------------- */
console.log(NL + '  --- ARMED (' + HIT.id + ' into the carrier): the Disable must LAND in both engines ---');
{
  const R = play(harness(false), true, 'armed');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  show(R);
  if (R.fainted) { console.log('      RED — a body fainted; the fixture is not clean.'); bad++; }
  if (R.div) { console.log('      RED — the two engines part on the control board.'); bad++; }
  if (!R.sd.length) {
    console.log('      RED — the AUTHORITY wrote no Disable, so "no Disable after Struggle" below');
    console.log('      would be satisfied by a fixture in which no Disable can ever land.'); bad++;
  } else if (!R.me.length) { console.log('      RED — we did not disable at all; a different defect.'); bad++; }
  else console.log('      ok — both engines disable the attacker on an ordinary hit');
}

/* ---- ARM 2: DRAINED. The claim. ---------------------------------------------------------------- */
console.log(NL + '  --- DRAINED (Struggle into the carrier): NEITHER engine may Disable ---');
let drainedClean = null;
{
  const R = play(harness(false), false, 'drained');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  drainedClean = R;
  console.log('      menu offered on turn ' + TEST_TURN + ' : ' + R.offered);
  show(R);
  if (R.offered !== 'struggle') {
    console.log('      RED — the authority did not offer Struggle on the test turn, so this arm did');
    console.log('      not stage the mechanic at all.'); bad++;
  }
  if (R.fainted) { console.log('      RED — a body fainted; the fixture is not clean.'); bad++; }
  if (R.sd.length) { console.log('      RED — the AUTHORITY disabled a Struggle. This probe is wrong, not the engine.'); bad++; }
  else if (R.me.length) { console.log('      RED — we rolled the disabler for a Struggle and it landed.'); bad++; }
  if (R.div) { console.log('      RED — the streams part on the Struggle turn.'); bad++; }
  if (!R.div && !R.me.length && !R.sd.length && R.offered === 'struggle')
    console.log('      ok — no Disable on either side, and the streams agree');
}

/* ---- ARM 3: THE KNOB --------------------------------------------------------------------------- */
if (!KNOB_SET) {
  console.log(NL + '  --- KNOB ' + KNOB + '=1: the defect must come back ---');
  const R = play(harness(true), false, 'knob');
  harness(false);
  if (!R.staged) { console.log('      NOT STAGED under the knob — ' + R.why); bad++; }
  else {
    show(R);
    const moved = R.me.length !== drainedClean.me.length || !!R.div !== !!drainedClean.div;
    if (!moved) {
      console.log('      RED — THE KNOB CHANGED NOTHING, so it is unwired.'); bad++;
    } else console.log('      ok — the knob restores the Struggle roll, so the arm above is live');
  }
}

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — the disabler skips Struggle.') + NL);
process.exit(bad ? 1 : 0);
