#!/usr/bin/env node
/* tests/probe_shield_before_bounce.js — A SHIELDED BOUNCER BLOCKS. IT DOES NOT REFLECT.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_shield_before_bounce.js
 *   SHOWDOWN_PATH=... MEDI_BOUNCE_BEFORE_SHIELD=1 node tests/probe_shield_before_bounce.js   (must exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * Both handlers live in the SAME event — `hitStepTryHitEvent`'s `TryHit` — and `Battle#runEvent`
 * sorts the handlers it gathered by `compareLeftToRightOrder` (sim/battle.ts:421-426), PRIORITY
 * FIRST, descending. Read off the two records:
 *
 *     protect.condition.onTryHitPriority : 3     data/moves.ts:13986
 *       onTryHit -> `this.add('-activate', target, 'move: Protect'); return this.NOT_FAIL;`
 *     magicbounce.onTryHitPriority       : 1     data/abilities.ts:2428
 *       onTryHit -> `this.actions.useMove(newMove, target, {target: source}); return null;`
 *
 * 3 > 1, so the shield answers FIRST and its `NOT_FAIL` ends the event. **A bouncer standing behind
 * its own Protect blocks the move and never reflects it.** Neither key is overridden in
 * `data/mods/champions/{moves,abilities}.ts` — this file greps both and says so on every run rather
 * than asserting it in prose.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `engine/medicham2-browser.js` already knows this rule and applies it at ONE of the two bounce
 * sites. `bounceAtTryHit` (the five dispatch kinds added 2026-09-19) opens with
 * `if(shieldRefuses(t,mv))return {src:m,t,bounced:false};` and its header spells out the priority
 * reading above. `statusMoveTargets` — where Screech, Soak, Taunt, Parting Shot and every other
 * generic reflectable status click resolves — called `bounceOff` with NO shield check at all, and the
 * shield was asked afterwards at STEP 1 of the gauntlet, by which point the target had already been
 * rewritten to the bounce destination. So the shield was asked of the WRONG BODY, or of nobody.
 *
 * That is the private-copy shape CLAUDE.md's FACTS-ARE-GLOBAL rule names: one fact — *does the
 * shield answer before the bounce* — with two implementations, one of which was missing.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * FOUR of the fifteen board partings in the held-out 12,000-game draw on release `834713ccb303`
 * (`data/verification/game-differential.g12000.json`, rows 1, 3, 6 and 9), every one of them
 * `|-activate|…|protect` on the authority against a `|move|…` here:
 *
 *     row 6  (JOINED the list this pass)  |-activate|p1a: Hatterene|move: Protect
 *            against                      |move|p1a: Hatterene|screech|p2a: Sinistcha|[from] ability: Magic Bounce
 *            -> Sinistcha at 47/146 and def -2 here, 96/146 and def 0 there
 *     row 1  Parting Shot — the reflected pivot took the BOUNCER off the field, so `p1.active[0]`
 *            is a different species in the two engines from that turn onward
 *     row 3  Soak    — Bellibolt is Water here and Electric there
 *     row 9  Taunt   — `p1.active[1].vol.taunt` 3 here, 0 there
 *
 * ================= THE ARMS ======================================================================
 *
 *   SHIELDED   the bouncer raises its shield; the clicker aims a reflectable stat drop at it.
 *              NOBODY's stage may move, and the two streams must not part.
 *   BARE       the SAME board with the shield click replaced by a self-move. The drop must come
 *              BACK and land on the CLICKER — that is what says the bounce still works and that the
 *              shield is the one varied thing. **Identical results across a varied knob mean the
 *              knob is unwired**, so this arm has to move or the SHIELDED arm proves nothing.
 *   KNOB       a reload under MEDI_BOUNCE_BEFORE_SHIELD=1. In the SHIELDED arm the drop must reach
 *              the clicker and the streams must part. A knob that changes nothing is reported RED.
 *
 * ONE REASON PER CELL. The landing is read as a BOOST STAGE on two named bodies, never as damage:
 * neither body is hit, neither faints, the move carries no status and no volatile, and both
 * receiving bodies are checked against the type chart and against every tag that could refuse or
 * reverse a drop. A stage that did not move because the move was IMMUNE would otherwise read
 * exactly like a stage that did not move because the shield held.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const KNOB = 'MEDI_BOUNCE_BEFORE_SHIELD';
const KNOB_SET = process.env[KNOB] === '1';
if (KNOB_SET) {
  console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE THIS PROCESS.');
  console.log('  The engine is running with the defect restored, so the SHIELDED arm is expected to');
  console.log('  FAIL and this run MUST exit 1. The internal knob arm is skipped.');
}

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
const ARG = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_shield_before_bounce.js — freeze the tree under test').id;
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
  /* Protect's condition block, and Magic Bounce's, each read for their own onTryHitPriority. */
  const pi = mvs.indexOf(NL + TAB + 'protect: {');
  const pblock = pi < 0 ? '' : mvs.slice(pi, mvs.indexOf(NL + TAB + '},', pi));
  const pPri = (pblock.match(/onTryHitPriority:\s*(-?\d+)/) || [])[1];
  const bi = abs.indexOf(NL + TAB + 'magicbounce: {');
  const bblock = bi < 0 ? '' : abs.slice(bi, abs.indexOf(NL + TAB + '},', bi));
  const bPri = (bblock.match(/onTryHitPriority:\s*(-?\d+)/) || [])[1];
  console.log('    protect.condition.onTryHitPriority : ' + pPri);
  console.log('    magicbounce.onTryHitPriority       : ' + bPri);
  console.log('    protect overridden by Champions?   : ' + /[\n\t]protect: \{/.test(modM));
  console.log('    magicbounce overridden?            : ' + /[\n\t]magicbounce: \{/.test(modA));
  if (!(Number(pPri) > Number(bPri))) {
    console.log('    THE AUTHORITY DOES NOT ORDER THE SHIELD ABOVE THE BOUNCE — this probe asserts');
    console.log('    something the format does not say, and is WRONG rather than the engine.');
    bad++;
  } else {
    console.log('    ' + pPri + ' > ' + bPri + '  -> the shield answers first and its NOT_FAIL ends the event.');
  }
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

const BOUNCE_AB = Object.keys(TAGS.abilities || {})
  .filter(k => (TAGS.abilities[k].tags || []).includes('reflectsStatusMoves'));
/* THE SHIELD IS DERIVED FROM ITS OWN HANDLER, not from a name: `shieldsUser.blocksStatus` is parsed
 * by tag_dex out of each shield condition's argument list, and only a shield that blocks a STATUS
 * move can refuse the click this probe makes. */
const SHIELDS = Object.keys(TAGS.moves || {})
  .filter(k => { const p = (TAGS.moves[k].params || {}).shieldsUser; return p && p.blocksStatus === true; })
  .filter(k => { const m = dex.moves.get(k); return m.exists && !m.isNonstandard; });
/* THE CLICK: reflectable (what magicbounce tests), single-target, carrying `flags.protect` (what
 * `checkMoveBypassesProtect` tests), and readable as a negative boost stage. */
const DROPS = Object.keys(TAGS.moves || {}).map(k => dex.moves.get(k))
  .filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
    && m.flags.reflectable && m.flags.protect && m.target === 'normal'
    && !m.status && !m.volatileStatus
    && m.boosts && Object.values(m.boosts).some(v => v < 0));
console.log('    abilities tagged reflectsStatusMoves        : ' + (BOUNCE_AB.join(', ') || 'NONE'));
console.log('    shields whose handler blocks a STATUS move  : ' + (SHIELDS.join(', ') || 'NONE'));
console.log('    reflectable+protect single-target drops     : ' + (DROPS.map(m => m.id).join(' ') || 'NONE'));
if (!BOUNCE_AB.length || !SHIELDS.length || !DROPS.length) {
  console.log('    A POPULATION IS EMPTY — a claim about the artifact, not about the engine.'); process.exit(2);
}

const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const REFUSE = new Set(['refusesDrops', 'reversesBoosts', 'reflectsDrops', 'protectsAllyFromStatus',
  'refusesStatusMoves', 'allyRefusesStatus', 'reflectsStatusMoves', 'statusImmune', 'onSwitchInDrop']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => REFUSE.has(t)));
/* A self-targeting hold that is NOT a shield — the BARE arm's replacement click, so the only thing
 * that differs between the two arms is whether a shield is standing. */
const SELF_HOLD = (s) => {
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (SHIELDS.includes(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.volatileStatus;
  }) || null;
};
const takesIt = (m, s) => dex.getImmunity(m.type, s);

/* THE BOUNCER: a legal carrier of a reflectsStatusMoves ability that learns a status-blocking shield
 * and a non-shield self hold. The ability is written on explicitly so the builder cannot pick the
 * other one. */
let BC = null, BC_AB = null, SHIELD = null;
for (const s of POOL) {
  const ab = Object.values(s.abilities).find(a => BOUNCE_AB.includes(norm(a)));
  if (!ab) continue;
  const sh = SHIELDS.find(k => LEARNS(s, k));
  if (!sh || !SELF_HOLD(s)) continue;
  BC = s; BC_AB = ab; SHIELD = sh; break;
}
if (!BC) { console.log('    NO LEGAL BOUNCER THAT LEARNS A SHIELD — a claim about the format.'); process.exit(2); }

let MV = null, CK = null, DROPPED = null;
for (const m of DROPS) {
  if (!takesIt(m, BC)) continue;                       // the bouncer must be able to TAKE the click
  const ck = POOL.find(s => LEARNS(s, m.id) && okAbility(s) && s.name !== BC.name
    && takesIt(m, s) && SELF_HOLD(s));                  // and the clicker must be able to take it BACK
  if (ck) { MV = m; CK = ck; DROPPED = Object.keys(m.boosts).find(k => m.boosts[k] < 0); break; }
}
if (!MV) { console.log('    COULD NOT STAGE — no drop with a legal clicker.'); process.exit(2); }

const FILL = POOL.filter(s => ![BC.name, CK.name].includes(s.name) && SELF_HOLD(s)).slice(0, 6);
if (FILL.length < 6) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log(NL + '    the BOUNCER  : ' + BC.name + ' [' + BC_AB + '] raises ' + SHIELD);
console.log('    the CLICKER  : ' + CK.name + ' [' + okAbility(CK) + '] aims ' + MV.id
  + ' (' + DROPPED + ' ' + MV.boosts[DROPPED] + ') at it');
console.log('    AUTHORITY    : the shield answers first — NOBODY takes the drop');
console.log('    DEFECT       : `statusMoveTargets` bounced first — the CLICKER takes it' + NL);

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, moves, ability) => ({ species, item: '', ability: ability || '', moves });
const sides = () => ([
  [mon(BC.name, [dex.moves.get(SHIELD).name, MV.name, SELF_HOLD(BC)], BC_AB),
   mon(FILL[0].name, [SELF_HOLD(FILL[0])]), mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
   mon(FILL[2].name, [SELF_HOLD(FILL[2])])],
  [mon(CK.name, [MV.name, SELF_HOLD(CK)], okAbility(CK)),
   mon(FILL[3].name, [SELF_HOLD(FILL[3])]), mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
   mon(FILL[5].name, [SELF_HOLD(FILL[5])])],
]);
/* ONE TURN. Every shield in this format is priority +4 and the drop is priority 0, so the shield is
 * standing before the click resolves whatever the two Speeds are — no arm depends on a speed. */
const script = (raiseShield) => ([
  { p1: [raiseShield ? { m: norm(SHIELD) } : { m: norm(SELF_HOLD(BC)) }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(MV.id), t: 0 }, { m: norm(SELF_HOLD(FILL[3])) }] },
]);

const stageOf = (x) => (x && x.boosts ? (x.boosts[DROPPED] || 0) : null);
function play(G, raiseShield, tag) {
  const [SA, SB] = sides();
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'shieldbeforebounce/' + tag, {
    arm: G.ARM_BY_ID.get('top-tie-first'),
    script: script(raiseShield),
    onBoundary: (snap) => seen.push({
      meBc: stageOf(snap.medi.sides.p1.party[norm(BC.name)]), sdBc: stageOf(snap.sd.sides.p1.party[norm(BC.name)]),
      meCk: stageOf(snap.medi.sides.p2.party[norm(CK.name)]), sdCk: stageOf(snap.sd.sides.p2.party[norm(CK.name)]),
    }),
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (!seen.length) return { staged: false, why: 'no turn boundary was reached' };
  return { staged: true, M: seen[seen.length - 1],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}
const show = (R) => {
  console.log('      the BOUNCER (' + BC.name + ')  me ' + String(R.M.meBc).padEnd(6) + ' sd ' + R.M.sdBc);
  console.log('      the CLICKER (' + CK.name + ')  me ' + String(R.M.meCk).padEnd(6) + ' sd ' + R.M.sdCk);
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
  else console.log('      streams agree for the whole game');
};

/* ---- ARM 1: BARE. The bounce must work at all, or nothing below means anything. ---------------- */
console.log('  --- BARE (no shield): the drop must come BACK to the clicker ---');
{
  const R = play(harness(false), false, 'bare');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  show(R);
  const want = MV.boosts[DROPPED];
  if (R.div) { console.log('      RED — the two engines part on a board with no shield on it at all.'); bad++; }
  else if (R.M.sdCk !== want || R.M.meCk !== want) {
    console.log('      RED — the authority did not reflect the drop onto the clicker (' + R.M.sdCk
      + ' / ' + R.M.meCk + ', expected ' + want + '). THE FIXTURE CANNOT SEE A BOUNCE, so the');
    console.log('      SHIELDED arm below would pass for the wrong reason.'); bad++;
  } else if (R.M.sdBc !== 0 || R.M.meBc !== 0) {
    console.log('      RED — the bouncer took the drop as well; the fixture is not clean.'); bad++;
  } else console.log('      ok — both engines send it back at the clicker (' + want + ')');
}

/* ---- ARM 2: SHIELDED. The claim. --------------------------------------------------------------- */
console.log(NL + '  --- SHIELDED: the shield answers first, so NOBODY takes the drop ---');
let shieldedClean = null;
{
  const R = play(harness(false), true, 'shielded');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  shieldedClean = R;
  show(R);
  if (R.div) { console.log('      RED — the streams part behind the shield.'); bad++; }
  if (R.M.sdBc !== 0 || R.M.meBc !== 0) { console.log('      RED — the bouncer took the drop through its own shield.'); bad++; }
  if (R.M.sdCk !== 0) { console.log('      RED — the AUTHORITY reflected it. This probe is wrong, not the engine.'); bad++; }
  else if (R.M.meCk !== 0) { console.log('      RED — we reflected it past the shield: the clicker is at ' + R.M.meCk + '.'); bad++; }
  if (!R.div && R.M.meCk === 0 && R.M.sdCk === 0 && R.M.meBc === 0 && R.M.sdBc === 0)
    console.log('      ok — no stage moved on either side, and the streams agree');
}

/* ---- ARM 3: THE KNOB. A knob that changes nothing is unwired. ---------------------------------- */
if (!KNOB_SET) {
  console.log(NL + '  --- KNOB ' + KNOB + '=1: the defect must come back ---');
  const R = play(harness(true), true, 'knob');
  harness(false);
  if (!R.staged) { console.log('      NOT STAGED under the knob — ' + R.why); bad++; }
  else {
    show(R);
    const moved = R.M.meCk !== shieldedClean.M.meCk || !!R.div !== !!shieldedClean.div;
    if (!moved) {
      console.log('      RED — THE KNOB CHANGED NOTHING. Identical results across a varied knob mean');
      console.log('      the knob is unwired, not that the ordering does not matter.'); bad++;
    } else console.log('      ok — the knob restores the reflection past the shield, so the arm above is live');
  }
}

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — the shield answers before the bounce.') + NL);
process.exit(bad ? 1 : 0);
