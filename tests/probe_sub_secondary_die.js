#!/usr/bin/env node
/* tests/probe_sub_secondary_die.js — A ROW THE SUBSTITUTE ATE STILL ROLLS ITS SECONDARY.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_sub_secondary_die.js
 *   SHOWDOWN_PATH=... MEDI_SUB_SKIPS_SECONDARY_DIE=1 node tests/probe_sub_secondary_die.js   (must exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * `spreadMoveHit` marks a row the doll absorbed with `null`, and everything else with `false`:
 *
 *     for (const i of targets.keys()) {
 *       if (damage[i] === this.battle.HIT_SUBSTITUTE) { damage[i] = true; targets[i] = null; }
 *       ...
 *       if (!damage[i]) targets[i] = false;
 *     }                                                       sim/battle-actions.ts:1059-1069
 *
 * and the two steps that follow treat those two marks DIFFERENTLY:
 *
 *     getSpreadDamage: for (const [i, target] of targets.entries()) { if (!target) continue;
 *                        this.battle.activeTarget = target; ... }          :1152-1154
 *     secondaries:     for (const target of targets) { if (target === false) continue;
 *                        ... const secondaryRoll = this.battle.random(100); ... }   :1338-1345
 *
 * `getSpreadDamage` skips a null, so a doll row never becomes `activeTarget`. `secondaries` skips
 * only `false`, so a doll row IS rolled for — and `moveHit(null, ...)` then lands nothing. Champions
 * overrides neither `getSpreadDamage` nor `secondaries`, and does not override `substitute`.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `engine/medicham2-browser.js` dropped the doll row with `R.out` at step 0 and the step driver
 * skipped it for the rest of the move, so:
 *
 *   - the row took NO `sec` draw, which moved every LATER row's repeat index down by one at the
 *     shared address; and
 *   - `_stepDamage` wrote `_secAddrSlot` for the doll row anyway, so with the doll in the last slot
 *     the whole secondary block was addressed at the DOLL's body instead of the last live one.
 *
 * Two halves of one fact, and this probe reads the ADDRESS STRINGS rather than an outcome: a flinch
 * that happens to agree at the wrong index would look exactly like a fixed engine.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * Row 6 of the NINE board partings in the held-out 12,000-game draw on release `51b80f9fcf08`
 * (`data/verification/game-differential.g12000.json`):
 *
 *     pair-redirect-priority  …bo3-2655714014 vs …bo3-2655713530   turn 4
 *       two Rock Slides into an Orthworm standing beside a Krookodile behind a Substitute.
 *       showdown  |move|p1a: Orthworm|Shed Tail|p1a: Orthworm
 *       medicham  |cant|p1a: Orthworm|flinch
 *       -> p1.pp[0].shedtail 2 there, 1 here — and that is the ONLY leaf in the whole game that parts
 *
 * ================= THE ARMS ======================================================================
 *
 *   BARE   no Substitute. The two engines' `sec` address lists must already agree, and must be
 *          non-empty — otherwise the instrument sees nothing and the DOLL arm proves nothing.
 *   DOLL   the same board with the Substitute standing. The lists must still agree, and must be the
 *          SAME LENGTH as the bare arm's: the authority rolls once per row either way.
 *   KNOB   a reload under MEDI_SUB_SKIPS_SECONDARY_DIE=1. The DOLL arm's lists must PART. A knob
 *          that changes nothing is reported RED.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const KNOB = 'MEDI_SUB_SKIPS_SECONDARY_DIE';
const KNOB_SET = process.env[KNOB] === '1';
if (KNOB_SET) {
  console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so the DOLL arm is expected to');
  console.log('  FAIL and this run MUST exit 1. The internal knob arm is skipped.');
}

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
const ARG = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_sub_secondary_die.js — freeze the tree under test').id;
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
  const ba = fs.readFileSync(path.join(SP, 'sim', 'battle-actions.ts'), 'utf8');
  const sc = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'scripts.ts'), 'utf8');
  const mm = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const nulls = /targets\[i\] = null;/.test(ba);
  const gsd = /getSpreadDamage\([\s\S]{0,400}?if \(!target\) continue;/.test(ba);
  const sec = /secondaries\(targets[\s\S]{0,400}?if \(target === false\) continue;/.test(ba);
  console.log('    spreadMoveHit writes `targets[i] = null` for HIT_SUBSTITUTE : ' + nulls);
  console.log('    getSpreadDamage skips a falsy target (`if (!target)`)        : ' + gsd);
  console.log('    secondaries skips ONLY `target === false`                    : ' + sec);
  console.log('    champions overrides getSpreadDamage / secondaries            : '
    + (/getSpreadDamage\s*\(/.test(sc) || /\bsecondaries\s*\(targets/.test(sc)));
  console.log('    champions overrides substitute                               : ' + /[\n\t]substitute: \{/.test(mm));
  if (!(nulls && gsd && sec)) {
    console.log('    THE AUTHORITY DOES NOT SEPARATE THE TWO MARKS — this probe asserts something the');
    console.log('    simulator does not say, and is WRONG rather than the engine.'); bad++;
  } else console.log('    -> a doll row is skipped by the damage and walked by the dice.');
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
/* nothing that could delete a secondary, refuse the hit, change the type or move the field */
const QUIET = new Set(['refusesSecondaries', 'removesOwnSecondaries', 'absorbsMoveType', 'statusImmune',
  'refusesStatusMoves', 'setsWeather', 'onSwitchInWeather', 'onSwitchInDrop', 'redirects',
  'speedMultiplier', 'changesOwnType', 'tracesAbility', 'copiesAbilityOnEntry', 'refusesDrops',
  'refusesFlinch', 'ignoresAbilities']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => QUIET.has(t)));

/* THE HOLD: a self-aimed stat boost that cannot re-order the turn or change who is hit. */
const SELF_HOLD = (s) => Object.keys(LS(s)).find(k => {
  const m = dex.moves.get(k);
  if (!m.exists || m.isNonstandard || m.category !== 'Status' || m.target !== 'self') return false;
  if (!m.boosts || m.priority !== 0) return false;
  if (m.boosts.spe || m.boosts.evasion || m.boosts.accuracy) return false;
  return !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.slotCondition && !m.selfdestruct
    && !m.volatileStatus && !m.sideCondition && !m.pseudoWeather && !m.weather && !m.terrain;
}) || null;

/* THE CLICK: a damaging SPREAD move carrying a secondary, at 100 accuracy so no row can be lost to a
 * miss, and not one the doll ignores (`bypasssub`). */
const SPREADS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category !== 'Status'
  && (m.target === 'allAdjacentFoes' || m.target === 'allAdjacent')
  && (m.accuracy === true || m.accuracy >= 100)
  && !m.flags.bypasssub && m.secondaries && m.secondaries.length);
console.log('    100-accuracy spread moves with a secondary : ' + (SPREADS.map(m => m.id).join(' ') || 'NONE'));
const SUBBERS = POOL.filter(s => LEARNS(s, 'substitute') && SELF_HOLD(s) && okAbility(s));
console.log('    legal Substitute users with a quiet hold   : ' + SUBBERS.length);
if (!SPREADS.length || !SUBBERS.length) {
  console.log('    A POPULATION IS EMPTY — a claim about the format, not about the engine.'); process.exit(2);
}

const takesIt = (m, s) => dex.getImmunity(m.type, s);
let MV = null, SUB = null, PARTNER = null, USER = null;
for (const m of SPREADS) {
  const sb = SUBBERS.find(s => takesIt(m, s));
  if (!sb) continue;
  const pt = POOL.find(s => s.name !== sb.name && takesIt(m, s) && SELF_HOLD(s) && okAbility(s));
  const us = POOL.find(s => LEARNS(s, m.id) && SELF_HOLD(s) && okAbility(s)
    && ![sb.name, pt && pt.name].includes(s.name));
  if (pt && us) { MV = m; SUB = sb; PARTNER = pt; USER = us; break; }
}
if (!MV) { console.log('    COULD NOT STAGE — no spread move with a subber, a partner and a user.'); process.exit(2); }

const FILL = POOL.filter(s => ![SUB.name, PARTNER.name, USER.name].includes(s.name) && SELF_HOLD(s)).slice(0, 5);
if (FILL.length < 5) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log(NL + '    the DOLL    p1a : ' + SUB.name + ' [' + okAbility(SUB) + '] stands behind a Substitute');
console.log('    the PARTNER p1b : ' + PARTNER.name + ' [' + okAbility(PARTNER) + ']');
console.log('    the CLICK   p2a : ' + USER.name + ' [' + okAbility(USER) + '] uses ' + MV.id
  + ' (' + MV.target + ', ' + MV.secondaries.length + ' secondary row(s))');
console.log('    AUTHORITY   : one `sec` draw per ROW, doll or not, at the last LIVE body\'s address');
console.log('    DEFECT      : the doll row took no draw AND owned the address' + NL);

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, moves, ability) => ({ species, item: '', ability: ability || '', moves });
const sides = () => ([
  [mon(SUB.name, ['Substitute', SELF_HOLD(SUB)], okAbility(SUB)),
   mon(PARTNER.name, [SELF_HOLD(PARTNER)], okAbility(PARTNER)),
   mon(FILL[0].name, [SELF_HOLD(FILL[0])]), mon(FILL[1].name, [SELF_HOLD(FILL[1])])],
  [mon(USER.name, [MV.name, SELF_HOLD(USER)], okAbility(USER)),
   mon(FILL[2].name, [SELF_HOLD(FILL[2])]), mon(FILL[3].name, [SELF_HOLD(FILL[3])]),
   mon(FILL[4].name, [SELF_HOLD(FILL[4])])],
]);
const script = (raiseDoll) => ([
  { p1: [{ m: raiseDoll ? 'substitute' : norm(SELF_HOLD(SUB)) }, { m: norm(SELF_HOLD(PARTNER)) }],
    p2: [{ m: norm(SELF_HOLD(USER)) }, { m: norm(SELF_HOLD(FILL[2])) }] },
  { p1: [{ m: norm(SELF_HOLD(SUB)) }, { m: norm(SELF_HOLD(PARTNER)) }],
    p2: [{ m: norm(MV.id) }, { m: norm(SELF_HOLD(FILL[2])) }] },
]);

const secOf = (L) => L.filter(x => String(x).split('|')[2] === 'sec').map(x => String(x).split('|').slice(3).join('|'));
function play(G, raiseDoll, tag) {
  const [SA, SB] = sides();
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  G.midResetAddresses();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'subsecdie/' + tag, {
    /* THE MIDDLE ARM, because a pinned corner spends no shared address and the whole claim here is
     * about WHICH address each engine spends. */
    arm: G.ARM_BY_ID.get('middle'),
    script: script(raiseDoll),
    onBoundary: (snap) => seen.push(snap),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const A = G.midAddresses();
  return { staged: true, sd: secOf(A.sd), me: secOf(A.me), turns: seen.length,
           stream: G.sdStream(G.lastSdLog()),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}
const show = (R) => {
  console.log('      sd sec : ' + (R.sd.join('  ') || '(none)'));
  console.log('      me sec : ' + (R.me.join('  ') || '(none)'));
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
};

/* ---- ARM 1: BARE. The instrument must see the draws at all. ----------------------------------- */
console.log('  --- BARE (no Substitute): the two address lists already agree ---');
let bareClean = null;
{
  const R = play(harness(false), false, 'bare');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  bareClean = R;
  show(R);
  if (!R.sd.length) {
    console.log('      RED — the AUTHORITY drew no secondary at all, so this fixture cannot see the');
    console.log('      thing it is about and the DOLL arm would pass for the wrong reason.'); bad++;
  } else if (R.sd.join(' ') !== R.me.join(' ')) {
    console.log('      RED — the two engines already disagree with no doll on the board.'); bad++;
  } else console.log('      ok — ' + R.sd.length + ' draw(s), identical on both sides');
}

/* ---- ARM 2: DOLL. The claim. ------------------------------------------------------------------- */
console.log(NL + '  --- DOLL (Substitute standing): the same draws, at the last LIVE body ---');
let dollClean = null;
{
  const R = play(harness(false), true, 'doll');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  dollClean = R;
  /* THE DOLL HAS TO HAVE BEEN THERE AND HAVE EATEN THE HIT, read off the AUTHORITY's own stream. */
  const ate = (R.stream || []).some(l => /^\|-activate\|p1a[^|]*\|move: Substitute/.test(l)
                                      || /^\|-end\|p1a[^|]*\|Substitute/.test(l));
  if (!ate) {
    console.log('      NOT STAGED — the authority\'s stream shows no Substitute absorbing the click,');
    console.log('      so there is no null row and nothing below is about it.'); process.exit(2);
  }
  show(R);
  if (R.sd.length !== bareClean.sd.length) {
    console.log('      RED — the AUTHORITY drew ' + R.sd.length + ' with the doll and ' + bareClean.sd.length
      + ' without it. This probe asserts something the simulator does not do.'); bad++;
  }
  if (R.sd.join(' ') !== R.me.join(' ')) {
    console.log('      RED — the address lists part: the doll row\'s die, its address, or both.'); bad++;
  } else if (R.div) {
    console.log('      RED — the streams part behind the doll.'); bad++;
  } else console.log('      ok — ' + R.me.length + ' draw(s), identical on both sides, doll row included');
}

/* ---- ARM 3: THE KNOB. A knob that changes nothing is unwired. ---------------------------------- */
if (!KNOB_SET) {
  console.log(NL + '  --- KNOB ' + KNOB + '=1: the defect must come back ---');
  const R = play(harness(true), true, 'knob');
  const C = play(harness(true), false, 'knob-bare');
  harness(false);
  if (!R.staged) { console.log('      NOT STAGED under the knob — ' + R.why); bad++; }
  else {
    show(R);
    if (R.me.join(' ') === dollClean.me.join(' ')) {
      console.log('      RED — THE KNOB CHANGED NOTHING. Identical results across a varied knob mean');
      console.log('      the knob is unwired, not that the doll row does not matter.'); bad++;
    } else if (R.sd.join(' ') === R.me.join(' ')) {
      console.log('      RED — the knob moved this engine and the lists still agree, which cannot be.'); bad++;
    } else console.log('      ok — the knob drops the doll row\'s die again, so the arm above is live');
    if (C.staged && C.me.join(' ') !== bareClean.me.join(' ')) {
      console.log('      RED — the knob also moved the BARE arm, so it is not scoped to the doll.'); bad++;
    } else console.log('      ok — the knob leaves the bare arm exactly where it was');
  }
}

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — a row the doll ate still rolls its secondary, at the live address.') + NL);
process.exit(bad ? 1 : 0);
