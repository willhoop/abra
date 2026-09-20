#!/usr/bin/env node
/* tests/probe_typechange_shield_before_bounce.js — SOAK INTO A SHIELDED BOUNCER RETYPES NOBODY.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=... node tests/probe_typechange_shield_before_bounce.js
 *   SHOWDOWN_PATH=... MEDI_BOUNCE_BEFORE_SHIELD=1 node tests/probe_typechange_shield_before_bounce.js   (must exit 1)
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * Both handlers live in the SAME `TryHit` event and `Battle#runEvent` sorts what it gathered by
 * `compareLeftToRightOrder` (sim/battle.ts:421-426), PRIORITY FIRST, descending:
 *
 *     protect.condition.onTryHitPriority : 3     data/moves.ts
 *       onTryHit -> `this.add('-activate', target, 'move: Protect'); return this.NOT_FAIL;`
 *     magicbounce.onTryHitPriority       : 1     data/abilities.ts
 *       onTryHit -> `this.actions.useMove(newMove, target, {target: source}); return null;`
 *
 * 3 > 1, so the shield answers first and its `NOT_FAIL` ends the event. A bouncer standing behind
 * its own Protect BLOCKS the retyping move and never reflects it. Neither key is overridden in
 * `data/mods/champions/` — this file greps both and prints the answer on every run.
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * `tests/probe_shield_before_bounce.js` closed this fact at `statusMoveTargets` on 2026-09-20. The
 * `typechange` dispatch kind — Soak, Magic Powder, Trick-or-Treat, Forest's Curse — is a DIFFERENT
 * road and still called `bounceOff` bare:
 *
 *     const _tc0 = BOUNCE_UNDONE_BY_REAIM ? a.target : bounceOff(m, a.target, a.mv, true);
 *     ...
 *     if (t && shieldRefuses(t, a.mv)) { ...announce...; continue; }
 *
 * The shield was asked of `t`, which is the body the bounce had ALREADY re-aimed the move at — the
 * clicker, who is not shielded — so the click walked straight past the shield and rewrote the
 * clicker's types. One fact, several implementations, one of them missing: the shape CLAUDE.md's
 * FACTS-ARE-GLOBAL rule names, arriving for the second time in one week.
 *
 * The fix puts the refusal inside `bounceOff` itself, so every one of its call sites — `typechange`,
 * `status`, `pivot`, `curse`, `sharehp`, `trapmove` and the two `*AtTryHit` roads — asks it once.
 *
 * ================= WHAT IT COST, MEASURED ========================================================
 *
 * Row 3 of the NINE board partings in the held-out 12,000-game draw on release `51b80f9fcf08`
 * (`data/verification/game-differential.g12000.json`), and it parts at TURN 1:
 *
 *     omit-weather  …bo3-2659164097 vs …bo3-2659163326   turn 1
 *       showdown  |-activate|p1a: Hatterene|move: Protect
 *       medicham  |move|p1a: Hatterene|soak|p2a: Bellibolt|[from] ability: Magic Bounce
 *                 |-start|p2a: Bellibolt|typechange|Water
 *       -> p2.party.bellibolt.types  `water` here, `electric` there
 *
 * ================= THE ARMS ======================================================================
 *
 *   BARE       no shield. The retype must come BACK and land on the CLICKER, in BOTH engines.
 *              Identical results across a varied knob mean the knob is unwired, so this arm has to
 *              move or the SHIELDED arm proves nothing.
 *   SHIELDED   the same board with the bouncer's self-hold replaced by its shield. NOBODY's types
 *              may move and the two streams must not part.
 *   KNOB       a reload under MEDI_BOUNCE_BEFORE_SHIELD=1. The SHIELDED arm must go back to
 *              retyping the clicker. A knob that changes nothing is reported RED.
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
  REL_ID = ER.cut('tests/probe_typechange_shield_before_bounce.js — freeze the tree under test').id;
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
const SHIELDS = Object.keys(TAGS.moves || {})
  .filter(k => { const p = (TAGS.moves[k].params || {}).shieldsUser; return p && p.blocksStatus === true; })
  .filter(k => { const m = dex.moves.get(k); return m.exists && !m.isNonstandard; });
/* THE CLICK: a move whose own handler REWRITES THE TARGET'S TYPES (`changesTargetType`, derived by
 * tag_dex from the move's onHit), reflectable, and carrying `flags.protect` so the shield can see
 * it. `reflecttype` carries no `reflectable` flag and is correctly absent from this set. */
const RETYPES = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].params || {}).changesTargetType)
  .map(k => dex.moves.get(k))
  .filter(m => m.exists && !m.isNonstandard && m.flags.reflectable && m.flags.protect && m.target === 'normal');
console.log('    abilities tagged reflectsStatusMoves        : ' + (BOUNCE_AB.join(', ') || 'NONE'));
console.log('    shields whose handler blocks a STATUS move  : ' + (SHIELDS.join(', ') || 'NONE'));
console.log('    reflectable+protect retyping moves          : ' + (RETYPES.map(m => m.id).join(' ') || 'NONE'));
if (!BOUNCE_AB.length || !SHIELDS.length || !RETYPES.length) {
  console.log('    A POPULATION IS EMPTY — a claim about the artifact, not about the engine.'); process.exit(2);
}

const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
const REFUSE = new Set(['refusesStatusMoves', 'reflectsStatusMoves', 'statusImmune', 'onSwitchInDrop',
  'protectsAllyFromStatus', 'allyRefusesStatus']);
const okAbility = (s) => Object.values(s.abilities).find(ab => !abilityTags(ab).some(t => REFUSE.has(t)));
const SELF_HOLD = (s) => {
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (SHIELDS.includes(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.volatileStatus;
  }) || null;
};

/* THE BOUNCER: a legal carrier of reflectsStatusMoves that learns a status-blocking shield AND a
 * non-shield self hold, so the two arms differ in exactly one click. */
let BC = null, BC_AB = null, SHIELD = null;
for (const s of POOL) {
  const ab = Object.values(s.abilities).find(a => BOUNCE_AB.includes(norm(a)));
  if (!ab) continue;
  const sh = SHIELDS.find(k => LEARNS(s, k));
  if (!sh || !SELF_HOLD(s)) continue;
  BC = s; BC_AB = ab; SHIELD = sh; break;
}
if (!BC) { console.log('    NO LEGAL BOUNCER THAT LEARNS A SHIELD — a claim about the format.'); process.exit(2); }

/* THE CLICKER must not ALREADY be the type the move writes, or the landing is unreadable. */
let MV = null, CK = null, WROTE = null;
for (const m of RETYPES) {
  const want = norm((TAGS.moves[m.id].params.changesTargetType || {}).type || m.type);
  const ck = POOL.find(s => LEARNS(s, m.id) && okAbility(s) && s.name !== BC.name && SELF_HOLD(s)
    && !s.types.map(norm).includes(want)
    && !BC.types.map(norm).includes(want));
  if (ck) { MV = m; CK = ck; WROTE = want; break; }
}
if (!MV) { console.log('    COULD NOT STAGE — no retyping move with a legal clicker.'); process.exit(2); }

const FILL = POOL.filter(s => ![BC.name, CK.name].includes(s.name) && SELF_HOLD(s)).slice(0, 6);
if (FILL.length < 6) { console.log('    NOT ENOUGH FILLER.'); process.exit(2); }

console.log(NL + '    the BOUNCER  : ' + BC.name + ' [' + BC_AB + '] raises ' + SHIELD);
console.log('    the CLICKER  : ' + CK.name + ' [' + okAbility(CK) + '] aims ' + MV.id + ' at it');
console.log('    the WRITE    : ' + MV.id + ' sets its target to ' + WROTE);
console.log('    AUTHORITY    : the shield answers first — NOBODY is retyped');
console.log('    DEFECT       : the `typechange` branch bounced first — the CLICKER is retyped' + NL);

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const mon = (species, moves, ability) => ({ species, item: '', ability: ability || '', moves });
const sides = () => ([
  [mon(BC.name, [dex.moves.get(SHIELD).name, SELF_HOLD(BC)], BC_AB),
   mon(FILL[0].name, [SELF_HOLD(FILL[0])]), mon(FILL[1].name, [SELF_HOLD(FILL[1])]),
   mon(FILL[2].name, [SELF_HOLD(FILL[2])])],
  [mon(CK.name, [MV.name, SELF_HOLD(CK)], okAbility(CK)),
   mon(FILL[3].name, [SELF_HOLD(FILL[3])]), mon(FILL[4].name, [SELF_HOLD(FILL[4])]),
   mon(FILL[5].name, [SELF_HOLD(FILL[5])])],
]);
/* ONE TURN. Every shield in this format is priority +4 and the click is priority 0, so the shield is
 * standing before the click resolves whatever the two Speeds are — no arm depends on a speed. */
const script = (raiseShield) => ([
  { p1: [raiseShield ? { m: norm(SHIELD) } : { m: norm(SELF_HOLD(BC)) }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(MV.id), t: 0 }, { m: norm(SELF_HOLD(FILL[3])) }] },
]);

const typesOf = (x) => (x && x.types != null ? String(x.types) : null);
function play(G, raiseShield, tag) {
  const [SA, SB] = sides();
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'directed', 'typechangeshield/' + tag, {
    arm: G.ARM_BY_ID.get('top-tie-first'),
    script: script(raiseShield),
    onBoundary: (snap) => seen.push({
      meBc: typesOf(snap.medi.sides.p1.party[norm(BC.name)]), sdBc: typesOf(snap.sd.sides.p1.party[norm(BC.name)]),
      meCk: typesOf(snap.medi.sides.p2.party[norm(CK.name)]), sdCk: typesOf(snap.sd.sides.p2.party[norm(CK.name)]),
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
  console.log('      the BOUNCER (' + BC.name + ')  me ' + String(R.M.meBc).padEnd(18) + ' sd ' + R.M.sdBc);
  console.log('      the CLICKER (' + CK.name + ')  me ' + String(R.M.meCk).padEnd(18) + ' sd ' + R.M.sdCk);
  if (R.div) { console.log('      STREAMS PART   sd ' + R.div.sd); console.log('                     me ' + R.div.me); }
  else console.log('      streams agree for the whole game');
};

const CK_BASE = CK.types.map(norm).sort().join('/');
const BC_BASE = BC.types.map(norm).sort().join('/');

/* ---- ARM 1: BARE. The bounce must work at all, or nothing below means anything. ---------------- */
console.log('  --- BARE (no shield): the retype must come BACK to the clicker ---');
{
  const R = play(harness(false), false, 'bare');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  show(R);
  if (R.div) { console.log('      RED — the two engines part on a board with no shield on it at all.'); bad++; }
  else if (R.M.sdCk !== WROTE || R.M.meCk !== WROTE) {
    console.log('      RED — the authority did not reflect the retype onto the clicker (' + R.M.sdCk
      + ' / ' + R.M.meCk + ', expected ' + WROTE + '). THE FIXTURE CANNOT SEE A BOUNCE, so the');
    console.log('      SHIELDED arm below would pass for the wrong reason.'); bad++;
  } else if (R.M.sdBc !== BC_BASE || R.M.meBc !== BC_BASE) {
    console.log('      RED — the bouncer was retyped as well; the fixture is not clean.'); bad++;
  } else console.log('      ok — both engines send it back and retype the clicker (' + WROTE + ')');
}

/* ---- ARM 2: SHIELDED. The claim. --------------------------------------------------------------- */
console.log(NL + '  --- SHIELDED: the shield answers first, so NOBODY is retyped ---');
let shieldedClean = null;
{
  const R = play(harness(false), true, 'shielded');
  if (!R.staged) { console.log('      NOT STAGED — ' + R.why); process.exit(2); }
  shieldedClean = R;
  show(R);
  if (R.div) { console.log('      RED — the streams part behind the shield.'); bad++; }
  if (R.M.sdBc !== BC_BASE || R.M.meBc !== BC_BASE) { console.log('      RED — the bouncer was retyped through its own shield.'); bad++; }
  if (R.M.sdCk !== CK_BASE) { console.log('      RED — the AUTHORITY reflected it. This probe is wrong, not the engine.'); bad++; }
  else if (R.M.meCk !== CK_BASE) { console.log('      RED — we reflected it past the shield: the clicker is ' + R.M.meCk + '.'); bad++; }
  if (!R.div && R.M.meCk === CK_BASE && R.M.sdCk === CK_BASE && R.M.meBc === BC_BASE && R.M.sdBc === BC_BASE)
    console.log('      ok — nobody was retyped on either side, and the streams agree');
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

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s).' : '  GREEN — the shield answers before the retyping bounce.') + NL);
process.exit(bad ? 1 : 0);
