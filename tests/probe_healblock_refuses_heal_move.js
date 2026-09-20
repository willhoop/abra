#!/usr/bin/env node
/* tests/probe_healblock_refuses_heal_move.js — HEAL BLOCK REFUSES THE WHOLE CLICK, NOT JUST THE HEAL.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_healblock_refuses_heal_move.js
 *   SHOWDOWN_PATH=... MEDI_HEALBLOCK_ALLOWS_HEAL_MOVES=1 node tests/probe_healblock_refuses_heal_move.js  (exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 *     healblock.condition                                            data/moves.ts:8310-8316
 *       onBeforeMovePriority: 6,
 *       onBeforeMove(pokemon, target, move) {
 *         if (move.flags['heal'] && !move.isZ && !move.isMax) {
 *           this.add('cant', pokemon, 'move: Heal Block', move);
 *           return false;
 *         }
 *       },
 *
 * The predicate is a FLAG on the move, not a category and not "does this heal the user". Drain
 * Punch carries it, so the CLICK is refused outright — no damage, no PP, no lastMove. Neither
 * `healblock` nor `psychicnoise` is overridden in `data/mods/champions/` (grepped every run below).
 *
 * The move Heal Block is `isNonstandard: "Past"` in this format; the VOLATILE arrives through
 * Psychic Noise's 100% secondary (`data/moves.ts:14091-14094`, `volatileStatus: 'healblock'`),
 * which is why the fixture lands it that way rather than by clicking the move.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `engine/medicham2-browser.js` modelled Heal Block as a HEALING suppressor only: `healBlocked(m)`
 * gates roughly a dozen heal sites, and two move branches (`allyheal`, `healdesc`) refuse their own
 * click. Nothing refused a DAMAGING move that carries the heal flag, so Drain Punch landed its
 * damage, spent its PP and merely healed nothing.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * Row 10 of the fifteen board partings in the held-out 12,000-game draw on release `834713ccb303`
 * (`data/verification/game-differential.g12000.json`, seed
 * `gen9championsvgc2026regmbbo3-2661429975`, `pair-protect-bust`, turn 3):
 *
 *     showdown   |cant|p2a: Annihilape|move: Heal Block|Drain Punch
 *     medicham2  |move|p2a: Annihilape|drainpunch|p1a: Slowbro   |-damage|p1a: Slowbro|137/170
 *
 * and the board leaves are `p1.party.slowbro.hp us=137 showdown=170` and
 * `p2.pp[0].drainpunch us=1 showdown=0` — the PP the refused click never spends.
 *
 * ================= THE MEMBERSHIP IS ASSERTED, NOT ASSUMED ======================================
 *
 * The engine has no `heal` FLAG in its artifact, and `data/tags.json` cannot be regenerated from a
 * worktree (the store monolith `fit_policy.loadCorpus` opens is untracked, so every `uses` count
 * would go to zero). So the engine asks four tag SHAPES it already carries — drain, healsSelf,
 * healsAlly, healDescriptor — and this probe proves on every run that their union is EXACTLY the
 * format's `flags.heal` set. A move that ever carries the flag without one of those tags turns this
 * probe RED by name instead of silently falling through the gate.
 *
 * ================= THE ARMS =====================================================================
 *
 *   BARE     the same board with the noise user clicking a self-boost instead. The heal move must
 *            RESOLVE and deal damage in both engines. This is the control that clears the knob
 *            explicitly: without it, "no damage after Heal Block" is satisfied by a fixture in which
 *            the move never does anything.
 *   BLOCKED  the noise user, which is FASTER by base stat and prints so, lands the volatile in the
 *            same turn — the only way the click can reach `onBeforeMove` at all, since the
 *            authority's `onDisableMove` takes a heal move off the NEXT turn's request entirely.
 *            Both engines must write `cant … move: Heal Block` and deal no damage.
 *   KNOB     a reload under MEDI_HEALBLOCK_ALLOWS_HEAL_MOVES=1: the BLOCKED arm must part again.
 *            **Identical results across a varied knob mean the knob is unwired.**
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const KNOB = 'MEDI_HEALBLOCK_ALLOWS_HEAL_MOVES';
const KNOB_SET = process.env[KNOB] === '1';
if (KNOB_SET) {
  console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE. The BLOCKED arm is expected to FAIL and');
  console.log('  this run MUST exit 1. The internal knob arm is skipped.');
}

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
const ARGV = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let REL_ID = ARGV('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_healblock_refuses_heal_move.js — freeze the tree under test').id;
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
const T = require(D('engine', 'tags.js'));

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
  const mv = fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8');
  const modM = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const TAB = String.fromCharCode(9);
  const i = mv.indexOf(NL + TAB + 'healblock: {');
  const block = i < 0 ? '' : mv.slice(i, mv.indexOf(NL + TAB + '},' + NL, i));
  const onBefore = /onBeforeMove\(pokemon, target, move\) \{[\s\S]{0,80}move\.flags\['heal'\]/.test(block);
  const cant = /this\.add\('cant', pokemon, 'move: Heal Block', move\)/.test(block);
  console.log('    healblock.onBeforeMove keys on move.flags["heal"] : ' + onBefore);
  console.log('    and writes |cant|…|move: Heal Block|MOVE          : ' + cant);
  console.log('    healblock overridden by Champions                 : ' + /[\n\t]healblock: \{/.test(modM));
  console.log('    psychicnoise overridden by Champions              : ' + /[\n\t]psychicnoise: \{/.test(modM));
  if (!onBefore || !cant) {
    console.log('    THE AUTHORITY DOES NOT REFUSE A HEAL-FLAGGED CLICK — this probe asserts something');
    console.log('    the format does not say, and is WRONG rather than the engine.'); bad++;
  }
}

/* ---- THE POPULATIONS, PRINTED BEFORE ANYTHING IS WIRED TO THEM -------------------------------- */
console.log(NL + '  === THE MEMBERSHIP THE ENGINE ASKS FOR, CHECKED AGAINST THE FLAG ===');
const HEAL_TAGS = ['drain', 'healsSelf', 'healsAlly', 'healDescriptor'];
const LEGALM = m => m.exists && !m.isNonstandard && m.tier !== 'Illegal';
{
  let flagged = 0, tagged = 0; const miss = [];
  for (const m of dex.moves.all()) {
    if (!LEGALM(m)) continue;
    const rec = T.tagsFor('move', m.id);
    const byTag = !!(rec && HEAL_TAGS.some(t => rec.tags.includes(t)));
    const byFlag = !!(m.flags && m.flags.heal);
    if (byFlag) flagged++; if (byTag) tagged++;
    if (byTag !== byFlag) miss.push(m.id + ' tag=' + byTag + ' flag=' + byFlag);
  }
  console.log('    legal moves carrying flags.heal            : ' + flagged);
  console.log('    legal moves carrying one of [' + HEAL_TAGS.join(', ') + '] : ' + tagged);
  console.log('    disagreements                              : ' + (miss.length ? miss.join(' ; ') : 'NONE'));
  if (miss.length) {
    console.log('    THE TAG UNION IS NO LONGER THE FLAG. The engine would refuse the wrong set.'); bad++;
  }
  if (!flagged) { console.log('    POPULATION EMPTY — a claim about the format.'); process.exit(2); }
}

console.log(NL + '  === THE FIXTURE, DERIVED THIS RUN ===');
const G0 = harness(false);
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .filter(s => !G0.CLOSET_SPECIES.has(norm(s.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };

/* The blocker is derived from the tag, not named: the ONE move in this format whose `blocksHealing`
 * row says it puts the volatile up. */
const BLOCKERS = dex.moves.all().filter(m => LEGALM(m) && T.param('move', m.id, 'blocksHealing'));
console.log('    moves tagged blocksHealing        : ' + (BLOCKERS.map(m => m.id).join(', ') || 'NONE'));
if (!BLOCKERS.length) { console.log('    POPULATION EMPTY — a claim about the artifact.'); process.exit(2); }
const NOISE = BLOCKERS[0];

/* The refused click must be a DAMAGING move carrying the flag — the half this engine had no rule
 * for. A status heal would have been refused by the `healdesc` branch that already existed. */
const HEALHIT = m => LEGALM(m) && m.category !== 'Status' && m.flags && m.flags.heal
  && m.target === 'normal' && !m.multihit && !m.flags.charge && !m.recoil && !m.selfSwitch;
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
const HEAL_OF = (s) => Object.keys(LS(s)).map(k => dex.moves.get(k)).filter(HEALHIT)[0] || null;

/* THE NOISE USER MUST MOVE FIRST, AND THAT IS THE WHOLE FIXTURE. The authority's `onDisableMove`
 * takes every heal-flagged move off the request while the volatile stands, so the only turn on
 * which the click can reach `onBeforeMove` is the turn the volatile LANDS. Chosen by base Speed,
 * printed, and asserted at the request. */
const NOISERS = POOL.filter(s => LS(s)[NOISE.id] && IDLE_OF(s)).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
const CLICKERS = POOL.filter(s => HEAL_OF(s) && IDLE_OF(s)).sort((a, b) => a.baseStats.spe - b.baseStats.spe);
if (!NOISERS.length || !CLICKERS.length) { console.log('    NO LEGAL CARRIER.'); process.exit(2); }
const NO = NOISERS[0], CK = CLICKERS.find(s => s.name !== NO.name);
const HEAL = HEAL_OF(CK);
if (!(NO.baseStats.spe > CK.baseStats.spe)) { console.log('    NO SPEED ORDER AVAILABLE.'); process.exit(2); }
const FILL = POOL.filter(s => ![NO.name, CK.name].includes(s.name) && IDLE_OF(s)).slice(0, 6);
if (FILL.length < 6) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log('    the BLOCKER : ' + NO.name + ' (base spe ' + NO.baseStats.spe + ') clicks ' + NOISE.id);
console.log('    the CLICKER : ' + CK.name + ' (base spe ' + CK.baseStats.spe + ') clicks ' + HEAL.id
  + '  flags.heal=' + !!HEAL.flags.heal + ' category=' + HEAL.category);

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
const TEAM_P1 = [
  mon(CK.name, '', [HEAL.name, IDLE_OF(CK).name]),
  mon(FILL[0].name, '', [IDLE_OF(FILL[0]).name]),
  mon(FILL[1].name, '', [IDLE_OF(FILL[1]).name]),
  mon(FILL[2].name, '', [IDLE_OF(FILL[2]).name]),
];
const TEAM_P2 = [
  mon(NO.name, '', [NOISE.name, IDLE_OF(NO).name]),
  mon(FILL[3].name, '', [IDLE_OF(FILL[3]).name]),
  mon(FILL[4].name, '', [IDLE_OF(FILL[4]).name]),
  mon(FILL[5].name, '', [IDLE_OF(FILL[5]).name]),
];
const HP_BOOST = 8;
const ARM = 'middle';

const cantLines = (lines) => (lines || []).map(l => String(l).toLowerCase())
  .filter(l => /^\|cant\|/.test(l) && /heal ?block/.test(l));
const healHits = (lines) => (lines || []).map(l => String(l).toLowerCase())
  .filter(l => /^\|move\|/.test(l) && l.replace(/[^a-z0-9|:]/g, '').includes('|' + norm(HEAL.id) + '|'));

function play(G, blocked, tag) {
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }), b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  G.resetScriptCounters();
  let offered = null, fainted = false;
  const script = [{
    p1: [{ m: norm(HEAL.id), t: 0 }, { m: norm(IDLE_OF(FILL[0]).id) }],
    p2: [blocked ? { m: norm(NOISE.id), t: 0 } : { m: norm(IDLE_OF(NO).id) }, { m: norm(IDLE_OF(FILL[3]).id) }],
  }];
  const r = G.playGame(a, b, 'directed', 'healblockrefuses/' + tag, {
    arm: G.ARM_BY_ID.get(ARM),
    script,
    onBoundary: (snap, turnIdx, S, battle) => {
      const req = battle && battle.p1 && battle.p1.activeRequest;
      const act = req && req.active && req.active[0];
      if (turnIdx === 1 && act) offered = act.moves ? act.moves.map(m => m.id).join(',') : '(none)';
      for (const side of ['p1', 'p2'])
        for (const p of ((battle && battle[side] && battle[side].pokemon) || []))
          if (p.fainted) fainted = true;
    },
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { staged: true, offered, fainted,
           sdCant: cantLines(sd), meCant: cantLines(me),
           sdHit: healHits(sd), meHit: healHits(me),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null, turns: r.turns };
}
const show = (R) => {
  console.log('      cant lines     sd ' + (R.sdCant.length ? R.sdCant.join(' ; ') : '(none)'));
  console.log('                     me ' + (R.meCant.length ? R.meCant.join(' ; ') : '(none)'));
  console.log('      ' + HEAL.id + ' resolved  sd ' + R.sdHit.length + '   me ' + R.meHit.length);
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
  else console.log('      streams agree for the whole game');
};

/* ---- ARM 1: BARE. The click must work at all, or nothing below means anything. ----------------- */
console.log(NL + '  --- BARE (no Heal Block): ' + HEAL.id + ' must RESOLVE in both engines ---');
{
  const R = play(harness(false), false, 'bare');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  show(R);
  if (R.fainted) { console.log('      RED — a body fainted; the fixture is not clean.'); bad++; }
  if (R.div) { console.log('      RED — the two engines part on the control board.'); bad++; }
  if (!R.sdHit.length || !R.meHit.length) {
    console.log('      RED — the move does not resolve even with nothing blocking it, so "refused"');
    console.log('      below would be satisfied by a fixture in which it never lands.'); bad++;
  } else if (R.sdCant.length || R.meCant.length) {
    console.log('      RED — something already refused the click with no Heal Block up.'); bad++;
  } else console.log('      ok — the heal-flagged click resolves on both sides');
}

/* ---- ARM 2: BLOCKED. The claim. ---------------------------------------------------------------- */
console.log(NL + '  --- BLOCKED (' + NOISE.id + ' lands the volatile the same turn) ---');
let blockedClean = null;
{
  const R = play(harness(false), true, 'blocked');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  blockedClean = R;
  console.log('      menu offered on turn 1 : ' + R.offered);
  show(R);
  if (!(R.offered || '').split(',').map(norm).includes(norm(HEAL.id))) {
    console.log('      RED — the authority did not offer ' + HEAL.id + ' on the test turn, so the');
    console.log('      click never reached onBeforeMove and this arm staged nothing.'); bad++;
  }
  if (R.fainted) { console.log('      RED — a body fainted; the fixture is not clean.'); bad++; }
  if (!R.sdCant.length) {
    console.log('      RED — the AUTHORITY did not refuse the click. This probe is wrong, not the engine.'); bad++;
  } else if (!R.meCant.length) {
    console.log('      RED — we let a heal-flagged move through a Heal Block.'); bad++;
  }
  if (R.sdHit.length !== R.meHit.length) {
    console.log('      RED — the move resolved in one engine and not the other.'); bad++;
  }
  if (R.div) { console.log('      RED — the streams part on the blocked turn.'); bad++; }
  if (!R.div && R.sdCant.length && R.meCant.length)
    console.log('      ok — both engines refuse the click, and the streams agree');
}

/* ---- ARM 3: THE KNOB --------------------------------------------------------------------------- */
if (!KNOB_SET) {
  console.log(NL + '  --- KNOB ' + KNOB + '=1: the defect must come back ---');
  const R = play(harness(true), true, 'knob');
  harness(false);
  if (!R.staged) { console.log('      NOT STAGED under the knob — ' + R.why); bad++; }
  else {
    show(R);
    const moved = R.meCant.length !== blockedClean.meCant.length || !!R.div !== !!blockedClean.div
               || R.meHit.length !== blockedClean.meHit.length;
    if (!moved) { console.log('      RED — THE KNOB CHANGED NOTHING, so it is unwired.'); bad++; }
    else console.log('      ok — the knob restores the unrefused click, so the arm above is live');
  }
}

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — Heal Block refuses the heal-flagged click.') + NL);
process.exit(bad ? 1 : 0);
