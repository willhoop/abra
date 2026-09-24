#!/usr/bin/env node
/* tests/probe_disabled_choice_struggle.js — A MOVE CLICK ON A BODY WHOSE WHOLE MENU IS DISABLED IS STRUGGLE.
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=<checkout> node tests/probe_disabled_choice_struggle.js [--regulation regmc] [--part imprison|sources|gravity|all]
 *
 * ================= THE AUTHORITY'S RULE, READ WHOLE (sim/side.ts chooseMove, sim/pokemon.ts getMoves) ==
 *
 * `Side#chooseMove` does three things in this order, and the two checkouts carry the same code for all three:
 *
 *   1. PARSE against the REQUEST. `request = pokemon.getMoveRequestData()`; a named move must be one of
 *      `request.moves`, or the choice is refused ("doesn't have a move matching"). `getMoveRequestData`
 *      builds the request with `getMoves(lockedMove, isLastActive)` and, when that comes back empty,
 *      replaces the whole list with `[{ move: 'Struggle', id: 'struggle' }]` (sim/pokemon.ts:1098-1107).
 *   2. A HARD LOCK WINS FIRST. `getLockedMove() || getSemiLockedMove()` (a charge, a rampage, a
 *      recharge) pushes the locked move and returns.
 *   3. THEN `const moves = pokemon.getMoves()` — NO restrictData — and `else if (!moves.length)` pushes
 *      `moveid: 'struggle'` whatever was named and RETURNS, before the mega block is ever reached.
 *      `getMoves` (sim/pokemon.ts:964-1042) counts a slot as disabled when `moveSlot.disabled` is set
 *      (every `onDisableMove` source) OR `moveSlot.pp <= 0`, and turns `'hidden'` into `!restrictData`.
 *
 * So every source that empties `getMoves()` ends in the same place: the only move this body can make is
 * Struggle. The sources differ only in WHICH door a named real move takes to get there —
 *   - a VISIBLE disable (Disable, Taunt, Torment, Encore, Heal Block, Gigaton Hammer's repeat lock, 0 PP,
 *     a Choice lock): the request already reads `[Struggle]`, so a named real move is REFUSED at step 1
 *     and the one click the authority accepts is Struggle.
 *   - IMPRISON, the only HIDDEN disable in either checkout (`disableMove(id, true)`, data/moves.ts
 *     imprison): on the LAST ACTIVE body the request is built with restrictData and shows the moves
 *     ENABLED, so the named click passes step 1 and is REWRITTEN to Struggle at step 3.
 * Either way the authority never plays the named move and never writes a `|cant|` for it.
 *
 * MEDICHAM IS HANDED CLICKS BY CALLERS — the solver API's `step`, rollouts, the differential. This probe
 * hands it the real move on such a body and asks which move it EXECUTED.
 *
 * ================= THE PARTS ======================================================================
 *
 * IMPRISON (board-level, both engines play the whole staged game). The last-active victim carries only
 *   moves the imprisoner knows; the script clicks Protect for it on turn 2. The authority rewrites it.
 *     arm CLAIM    the imprisoner clicks Imprison on turn 1. Streams must agree; MEDICHAM must Struggle.
 *     arm CONTROL  the imprisoner clicks Protect instead. The victim's Protect must be PLAYED in both.
 *     knob         MEDI_DISABLED_CLICK_PLAYED=1 must make CLAIM part again.
 *
 * SOURCES (choice-level). One scenario per disable source, staged in both engines by a directed game up to
 *   the boundary where the victim's `getMoves()` is empty. At that boundary, on COPIES of both battles:
 *     authority  a named click of the real move, and the index click `move 1`: what does it accept, and
 *                what move does the accepted choice carry?
 *     medicham   `medicham_api.stepInPlace` on a clone, the victim handed the real move: which move is on
 *                its `move` trace line, and did it write `cant`?
 *   The CONTROL is the same scenario at boundary 0, before any source has landed: the handed move must be
 *   EXECUTED AS ITSELF (the rewrite must not over-fire), and the authority must accept it.
 *   The knob arm repeats every CLAIM under MEDI_DISABLED_CLICK_PLAYED=1 and prints what comes back.
 *
 * GRAVITY (2026-09-24, also run inside `sources`). A field source: every gravity-flagged slot on every active body. The
 *   Struggle scenario is one of the sources above; `--part gravity` adds the two-slot MENU arm (knob
 *   MEDI_GRAVITY_MENU_OPEN) and the SAME-TURN arm, where a flagged move chosen before a faster Gravity landed must be
 *   refused identically in both engines (knob MEDI_GRAVITY_CHOSEN_PLAYED).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const NL = String.fromCharCode(10);
const ARGV = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const PART = ARGV('--part') || 'all';
const KNOB = 'MEDI_DISABLED_CLICK_PLAYED';
const OUTSIDE = process.env[KNOB] === '1';
const OUTSIDE_T = process.env.MEDI_TORMENT_MENU_OPEN === '1';
const GRAVITY_KNOB = 'MEDI_GRAVITY_MENU_OPEN';
const OUTSIDE_G = process.env[GRAVITY_KNOB] === '1';
const GRAVITY_EXEC_KNOB = 'MEDI_GRAVITY_CHOSEN_PLAYED';
const OUTSIDE_GX = process.env[GRAVITY_EXEC_KNOB] === '1';
if (OUTSIDE) console.log(NL + '  ' + KNOB + '=1 WAS SET FROM OUTSIDE: the claims must FAIL and this run must exit 1.');

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARGV('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_disabled_choice_struggle.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const API_PATH = D('engine', 'medicham_api.js');
if (!process.argv.includes('--state')) process.argv.push('--state');

const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const T = require(D('engine', 'tags.js'));
const { State } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'state.js'));
console.log(NL + '  format ' + CS.FORMAT + '   checkout ' + process.env.SHOWDOWN_PATH + '   release ' + REL_ID);

/* ---- THE RULE, READ OFF THE CHECKOUT RATHER THAN RECALLED ------------------------------------------- */
{
  const side = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'sim', 'side.ts'), 'utf8').split(String.fromCharCode(13)).join('');
  const i = side.indexOf('\n\tchooseMove(');
  const blk = i < 0 ? '' : side.slice(i, side.indexOf('\n\t}\n', i));
  const rule = /const moves = pokemon\.getMoves\(\);[\s\S]*else if \(!moves\.length\) \{[\s\S]{0,400}moveid: 'struggle',[\s\S]{0,40}return true;/.test(blk);
  const lockFirst = blk.indexOf('getLockedMove()') > 0 && blk.indexOf('getLockedMove()') < blk.indexOf('else if (!moves.length)');
  const megaAfter = blk.indexOf("const mega = (event === 'mega')") > blk.indexOf('else if (!moves.length)');
  console.log('    chooseMove: empty getMoves() -> struggle, returns : ' + rule);
  console.log('    chooseMove: a hard lock is taken before it        : ' + lockFirst);
  console.log('    chooseMove: the mega block is below it (dropped)  : ' + megaAfter);
  if (!rule || !lockFirst) { console.log('    THE CHECKOUT DOES NOT SAY THIS — the probe is wrong, not the engine.'); process.exit(1); }
  const mv = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'moves.ts'), 'utf8');
  const hidden = (mv.match(/disableMove\([^)]*, true\)/g) || []).length;
  console.log('    hidden disables in data/moves.ts                  : ' + hidden + ' (imprison)');
}

/* ---- THE HARNESS, RELOADABLE UNDER THE KNOB ------------------------------------------------------ */
let _cur = null, _G = null, _M = null, _A = null;
const TORMENT_KNOB = 'MEDI_TORMENT_MENU_OPEN';
function harness(knob) {
  const name = knob === true ? KNOB : (knob || null);
  const key = name || '-';
  if (_G && _cur === key) return { G: _G, M: _M, A: _A };
  if (!OUTSIDE) delete process.env[KNOB];
  if (process.env[TORMENT_KNOB] === '1' && !OUTSIDE_T) delete process.env[TORMENT_KNOB];
  if (process.env[GRAVITY_KNOB] === '1' && !OUTSIDE_G) delete process.env[GRAVITY_KNOB];
  if (process.env[GRAVITY_EXEC_KNOB] === '1' && !OUTSIDE_GX) delete process.env[GRAVITY_EXEC_KNOB];
  if (name) process.env[name] = '1';
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  delete require.cache[require.resolve(API_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _M = require(MEDI_PATH);
  _A = require(API_PATH).bind(_M);
  _cur = key;
  return { G: _G, M: _M, A: _A };
}

let bad = 0, cannot = 0;
const ok = (c, what, detail) => {
  console.log('      ' + (c ? 'ok  ' : 'RED ') + ' ' + what);
  if (detail) console.log('            ' + String(detail).split(NL).join(NL + '            '));
  if (!c) bad++;
};

/* ---- THE FIXTURE VOCABULARY, DERIVED FROM THE FORMAT --------------------------------------------- */
const { G: G0 } = harness(null);
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LEGALM = m => m && m.exists && !m.isNonstandard;
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .filter(s => !G0.CLOSET_SPECIES.has(norm(s.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const learns = (s, id) => !!LS(s)[id] && LEGALM(dex.moves.get(id));
const SELFBOOSTS = s => Object.keys(LS(s)).map(k => dex.moves.get(k))
  .filter(m => LEGALM(m) && m.category === 'Status' && m.target === 'self'
    && !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.volatileStatus && !m.selfdestruct
    && !m.status && !m.forceSwitch && !m.onHit && !(m.flags && m.flags.heal)
    && m.boosts && Object.values(m.boosts).every(v => v > 0)
    && !('evasion' in m.boosts) && !('accuracy' in m.boosts));
/* Fillers idle on the HIGHEST-PP self-boost, so a long script cannot run a filler dry; the PP scenario's
 * victim uses the LOWEST, so it runs dry first. */
const IDLE_HI = s => SELFBOOSTS(s).sort((a, b) => b.pp - a.pp || a.id.localeCompare(b.id))[0] || null;
const IDLE_LO = s => SELFBOOSTS(s).sort((a, b) => a.pp - b.pp || a.id.localeCompare(b.id))[0] || null;
const CAN_IDLE = s => !!IDLE_HI(s);
const mon = (species, moves, item) => ({ species, item: item || '', ability: '', moves });
const HP_BOOST = 8;
const idleName = s => IDLE_HI(s).name;
const moveName = id => dex.moves.get(id).name;
const firstLegal = (...ids) => ids.find(id => LEGALM(dex.moves.get(id))) || null;
/* GRAVITY'S FIXTURE, derived. The sealed set is every LEGAL move carrying the Showdown flag `gravity` (the flag the
 * condition's own onDisableMove reads); two-turn members (flags.charge) are left out of the victim's pick, because a
 * charge is a hard lock that Gravity cancels by a different road. A self-targeted member is preferred (no damage roll,
 * no crash), then the setter is the FASTEST legal Gravity user, so the same-turn arm has Gravity land first, and the
 * victim the SLOWEST carrier. "Any legal user can set it": the setter is picked from every learner, not a named one. */
const GRAVITY_FLAGGED = () => dex.moves.all().filter(m => LEGALM(m) && m.flags && m.flags.gravity).map(m => m.id).sort();
const T0 = m => ({ id: m.id, t: ['normal', 'any', 'adjacentFoe'].includes(m.target) ? 0 : null });
const GRAVITY_FIXTURE = () => {
  if (!LEGALM(dex.moves.get('gravity'))) return null;
  const setters = POOL.filter(s => learns(s, 'gravity') && CAN_IDLE(s) && cleanVictim(s))
    .sort((a, b) => b.baseStats.spe - a.baseStats.spe || a.name.localeCompare(b.name));
  const cands = GRAVITY_FLAGGED().map(id => dex.moves.get(id)).filter(m => !m.flags.charge)
    .sort((a, b) => (a.target === 'self' ? 0 : 1) - (b.target === 'self' ? 0 : 1) || a.id.localeCompare(b.id));
  for (const Z of setters) for (const gm of cands) {
    if (gm.target !== 'self' && !dex.getImmunity(gm.type, Z)) continue;
    const V = POOL.filter(s => s !== Z && learns(s, gm.id) && CAN_IDLE(s) && cleanVictim(s) && s.baseStats.spe < Z.baseStats.spe)
      .sort((a, b) => a.baseStats.spe - b.baseStats.spe || a.name.localeCompare(b.name))[0];
    if (V) return { Z, V, gm };
  }
  return null;
};

/* ---- ONE DIRECTED GAME ------------------------------------------------------------------------------ */
function play(knob, P1, P2, script, tag, onBoard) {
  const { G, M } = harness(knob);
  const a = G.buildPair(P1, { hpBoost: HP_BOOST }), b = G.buildPair(P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  G.resetScriptCounters();
  let boundaries = 0;
  const r = G.playGame(a, b, 'directed', 'disabledchoice/' + tag, {
    arm: G.ARM_BY_ID.get('middle'), script,
    onBoundary: (snap, turnIdx, S, battle) => { boundaries++; if (onBoard) onBoard(turnIdx, S, battle, M); },
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  return { staged: true, boundaries, div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null,
           stateDiv: r.stateDiv || null, fails: Object.assign({}, M.MEDFAILS) };
}

/* ---- THE CHOICE-LEVEL CHECK, ON COPIES OF BOTH BATTLES --------------------------------------------- *
 * The victim is p1's slot `vi`. `handed` is `{ id, t }`: the move, and the foe slot a targeted move names. */
function choiceCheck(S, battle, M, A, vi, handed) {
  const out = {};
  const p = battle.p1.active[vi];
  out.body = p.species.name;
  out.sdMoves = p.getMoves().filter(r => !r.disabled).map(r => r.id);
  out.sdEmpty = p.getMoves().length === 0;
  const req = battle.p1.activeRequest && battle.p1.activeRequest.active && battle.p1.activeRequest.active[vi];
  out.shown = req && req.moves ? req.moves.map(x => x.id + (x.disabled ? '[dis]' : '')).join(',') : '?';
  /* the named click, then the index click, each on a fresh copy; the partner (if any) is asked first by
   * its own first enabled move so the victim's slot is the one being judged */
  const tryChoice = (spec) => {
    const b2 = State.deserializeBattle(State.serializeBattle(battle));
    const sd = b2.p1;
    sd.clearChoice();
    const acts = [];
    for (let i = 0; i < sd.active.length; i++) {
      const q = sd.active[i];
      if (!q || q.fainted) { sd.choosePass(); continue; }
      if (i !== vi) {
        const r0 = q.getMoves().find(r => !r.disabled);
        const ok0 = r0 ? sd.chooseMove(r0.id) : sd.chooseMove(1);
        if (!ok0) return { accepted: false, error: 'partner: ' + sd.choice.error };
        continue;
      }
      const tt = dex.moves.get(spec.id || 'struggle').target;
      const needsLoc = ['normal', 'any', 'adjacentFoe'].includes(tt);
      const res = spec.index ? sd.chooseMove(spec.index) : sd.chooseMove(spec.id, needsLoc ? (spec.t || 0) + 1 : 0);
      if (!res) return { accepted: false, error: sd.choice.error };
    }
    const mine = sd.choice.actions.find(a => a.pokemon === sd.active[vi]);
    return { accepted: true, moveid: mine ? mine.moveid : null };
  };
  out.named = tryChoice({ id: handed.id, t: handed.t });
  out.index1 = tryChoice({ index: 1 });
  /* MEDICHAM: a clone, the victim handed the real move, everyone else passes. */
  const tr = [];
  const Tb = A.adopt(A.clone(S, { trace: tr }));
  const me = Tb.actA[vi];
  out.meStruggle = !!M.mustStruggle(me);
  out.meMenu = M.mustStruggle(me) ? ['struggle'] : M.selectableMoves(me);
  const tgt = handed.t == null ? null : Tb.actB[handed.t];
  const jA = new Map(), jB = new Map();
  Tb.actA.forEach(m => { if (m) jA.set(m, { kind: 'pass' }); });
  Tb.actB.forEach(m => { if (m) jB.set(m, { kind: 'pass' }); });
  const pa = M.playerAction(me, handed.id, tgt, Tb.field);
  jA.set(me, pa);
  const saveMax = Tb.maxTurns; Tb.maxTurns = Infinity;
  try { A.stepInPlace(Tb, jA, jB, A.makeRng(7)); } catch (e) { out.meThrew = String(e && e.message || e); }
  Tb.maxTurns = saveMax;
  const who = String(me._ident || me.name);
  /* the trace is Showdown's own line grammar, `|move|p1a: Aegislash|protect|...` */
  const lines = tr.map(e => Array.isArray(e) ? [''].concat(e) : String(e).split('|'));
  const mine = lines.filter(e => String(e[2] || '').indexOf(who) >= 0 && /^p1/.test(String(e[2] || '')));
  const mv = mine.find(e => e[1] === 'move');
  const ct = mine.find(e => e[1] === 'cant');
  out.meMove = mv ? norm(mv[3]) : null;
  out.meCant = ct ? ct.slice(3, 5).filter(Boolean).join(' ') : null;
  return out;
}
const fmt = o => 'authority getMoves ' + (o.sdEmpty ? 'EMPTY' : o.sdMoves.join(',')) + ' (request shows ' + o.shown + ')'
  + NL + 'authority, named ' + (o.named.accepted ? 'ACCEPTED as ' + o.named.moveid : 'REFUSED: ' + o.named.error)
  + '   |   index 1 ' + (o.index1.accepted ? 'ACCEPTED as ' + o.index1.moveid : 'REFUSED: ' + o.index1.error)
  + NL + 'medicham menu ' + o.meMenu.join(',') + '   executed ' + (o.meMove || 'NOTHING') + (o.meCant ? '   cant ' + o.meCant : '')
  + (o.meThrew ? '   THREW ' + o.meThrew : '');
/* THE MENU, both engines: the authority's accepted set (`getMoves()` less its disabled rows, Struggle when empty)
 * against MEDICHAM's (`mustStruggle ? [struggle] : selectableMoves`). */
const menuAgree = o => (o.sdEmpty ? ['struggle'] : o.sdMoves).slice().sort().join(',') === o.meMenu.map(norm).sort().join(',');
/* THE AUTHORITY'S ONE ANSWER for this body: the move every choice it will accept carries. */
const authorityOnly = o => {
  const got = new Set();
  if (o.named.accepted) got.add(o.named.moveid);
  if (o.index1.accepted) got.add(o.index1.moveid);
  return [...got].join(',');
};

/* ================================================================================================
 * IMPRISON — board-level
 * ================================================================================================ */
function partImprison() {
  console.log(NL + '  === IMPRISON: the last-active, all-sealed body is handed Protect; the authority rewrites it ===');
  const SEAL = dex.moves.all().filter(m => LEGALM(m) && (T.param('move', m.id, 'sealsMoves') || {}).fromUsersOwnMoves === true);
  if (!SEAL.length) { console.log('    POPULATION EMPTY.'); cannot++; return; }
  const IMP = SEAL[0];
  const U = POOL.find(s => learns(s, IMP.id) && CAN_IDLE(s) && learns(s, 'protect'));
  if (!U) { console.log('    NO LEGAL CARRIER.'); cannot++; return; }
  const FILL = POOL.filter(s => s.name !== U.name && CAN_IDLE(s) && learns(s, 'protect') && norm(idleName(s)) !== norm(idleName(U))).slice(0, 6);
  const SHARER = POOL.find(s => s.name !== U.name && !FILL.includes(s) && learns(s, norm(idleName(U))) && learns(s, 'protect'));
  if (FILL.length < 6 || !SHARER) { console.log('    NOT ENOUGH FILLER.'); cannot++; return; }
  const P1 = () => [mon(FILL[0].name, [idleName(FILL[0]), 'Protect']), mon(SHARER.name, [idleName(U), 'Protect']),
                    mon(FILL[1].name, [idleName(FILL[1]), 'Protect']), mon(FILL[2].name, [idleName(FILL[2]), 'Protect'])];
  const P2 = () => [mon(U.name, [IMP.name, 'Protect', idleName(U)])].concat(FILL.slice(3, 6).map(s => mon(s.name, [idleName(s), 'Protect'])));
  console.log('    imprisoner ' + U.name + ' (' + IMP.id + ', protect, ' + norm(idleName(U)) + ')   victim ' + SHARER.name
    + ' in the last-active slot, carrying ' + norm(idleName(U)) + ', protect');
  const scr = first => [
    { p1: [{ m: norm(idleName(FILL[0])) }, { m: norm(idleName(U)) }], p2: [first, { m: norm(idleName(FILL[3])) }] },
    { p1: [{ m: norm(idleName(FILL[0])) }, { m: 'protect' }], p2: [{ m: norm(idleName(U)) }, { m: norm(idleName(FILL[3])) }] },
  ];
  const arm = (label, first, knob) => {
    let chk = null;
    const R = play(knob, P1(), P2(), scr(first), 'imprison/' + label + (knob ? '/knob' : ''), (t, S, battle, M) => {
      if (t === 1) chk = choiceCheck(S, battle, M, harness(knob).A, 1, { id: 'protect' });
    });
    console.log('    --- ' + label + (knob ? ' under ' + KNOB + '=1' : '') + ' ---');
    if (!R.staged) { console.log('      CANNOT STAGE — ' + R.why); cannot++; return null; }
    if (chk) console.log('        ' + fmt(chk).split(NL).join(NL + '        '));
    console.log('        streams: ' + (R.div ? 'PART — sd ' + R.div.sd + '  /  me ' + R.div.me : 'agree for the whole staged game'));
    return { R, chk };
  };
  const C = arm('CONTROL (imprisoner clicks Protect)', { m: 'protect' }, null);
  if (C && C.chk) {
    ok(!C.chk.sdEmpty && C.chk.named.accepted && C.chk.named.moveid === 'protect', 'with no Imprison up, the authority takes the victim\'s Protect as Protect');
    ok(C.chk.meMove === 'protect' && !C.chk.meCant, 'and MEDICHAM plays Protect — the rewrite does not over-fire', C.chk.meMove);
    ok(!C.R.div, 'the streams agree on the control arm, so the instrument can see agreement');
  }
  const X = arm('CLAIM (imprisoner clicks ' + IMP.id + ')', { m: IMP.id }, null);
  if (X && X.chk) {
    ok(X.chk.sdEmpty, 'the authority\'s getMoves() is EMPTY for the victim (the fixture is staged)');
    ok(/protect(,|$)/.test(X.chk.shown) && !/protect\[dis\]/.test(X.chk.shown), 'its REQUEST still shows Protect enabled — the hidden door', X.chk.shown);
    ok(X.chk.named.accepted && X.chk.named.moveid === 'struggle', 'the authority ACCEPTS the named Protect and rewrites it to Struggle', JSON.stringify(X.chk.named));
    ok(X.chk.meStruggle, 'MEDICHAM\'s menu agrees: mustStruggle');
    ok(X.chk.meMove === 'struggle' && !X.chk.meCant, 'MEDICHAM, handed Protect, EXECUTES Struggle and writes no cant', 'executed ' + X.chk.meMove + (X.chk.meCant ? ', cant ' + X.chk.meCant : ''));
    ok(!X.R.div, 'the streams agree for the whole staged game', X.R.div && JSON.stringify(X.R.div));
    if (!OUTSIDE) {
      const K = arm('CLAIM', { m: IMP.id }, KNOB);
      if (K) {
        ok(!!K.R.div, 'THE KNOB BRINGS THE DEFECT BACK — the streams part again, so the claim arm is live', K.R.div ? K.R.div.me : 'agree');
        ok(K.R.fails.disabledClickPlayedRestored === 1, 'and the knob stamps MEDFAILS.disabledClickPlayedRestored', String(K.R.fails.disabledClickPlayedRestored));
      }
      harness(null);
    }
  }
}

/* ================================================================================================
 * SOURCES — choice-level, one scenario per disable source
 * ================================================================================================ */
const EXCLUDE_ABILITY = new Set(['oblivious', 'aromaveil', 'magicbounce', 'goodasgold', 'soundproof', 'pressure']);
const cleanVictim = s => !Object.values(s.abilities || {}).some(a => EXCLUDE_ABILITY.has(norm(a)));
function scenarios() {
  const out = [];
  const idle = IDLE_HI;
  const fillers = (ex, n) => POOL.filter(s => !ex.includes(s.name) && CAN_IDLE(s) && cleanVictim(s)).slice(0, n);
  const team = (V, vMoves, Z, zMoves, H, hMoves, F, vItem) => ({
    P1: () => [mon(V.name, vMoves, vItem), mon(F[0].name, [idleName(F[0])]), mon(F[1].name, [idleName(F[1])]), mon(F[2].name, [idleName(F[2])])],
    P2: () => [mon(Z.name, zMoves), mon(H.name, hMoves), mon(F[3].name, [idleName(F[3])]), mon(F[4].name, [idleName(F[4])])],
  });
  const I = s => ({ m: norm(idleName(s)) });
  /* the victim V is p1 slot 0, the sealer Z p2 slot 0, the helper H p2 slot 1, the partner F[0] p1 slot 1 */
  const add = (name, why, pick) => {
    const r = pick();
    if (!r) { out.push({ name, why, missing: true }); return; }
    out.push(Object.assign({ name, why }, r));
  };
  add('taunt', 'data/moves.ts taunt.condition.onDisableMove: every Status slot', () => {
    if (!LEGALM(dex.moves.get('taunt'))) return null;
    const Z = POOL.find(s => learns(s, 'taunt') && CAN_IDLE(s));
    const V = POOL.find(s => s !== Z && CAN_IDLE(s) && learns(s, 'protect') && cleanVictim(s));
    if (!Z || !V) return null;
    const H = POOL.find(s => ![Z, V].includes(s) && CAN_IDLE(s)); const F = fillers([Z.name, V.name, H.name], 5);
    return Object.assign(team(V, [idleName(V), 'Protect'], Z, ['Taunt', idleName(Z)], H, [idleName(H)], F), {
      V, Z, handed: { id: 'protect' }, at: 1,
      script: [{ p1: [I(V), I(F[0])], p2: [{ m: 'taunt', t: 0 }, I(H)] }] });
  });
  add('disable', 'data/moves.ts disable.condition.onDisableMove: the last move used', () => {
    if (!LEGALM(dex.moves.get('disable'))) return null;
    const Z = POOL.find(s => learns(s, 'disable') && CAN_IDLE(s));
    const V = POOL.find(s => s !== Z && CAN_IDLE(s) && cleanVictim(s));
    if (!Z || !V) return null;
    const H = POOL.find(s => ![Z, V].includes(s) && CAN_IDLE(s)); const F = fillers([Z.name, V.name, H.name], 5);
    return Object.assign(team(V, [idleName(V)], Z, ['Disable', idleName(Z)], H, [idleName(H)], F), {
      V, Z, handed: { id: norm(idleName(V)) }, at: 2,
      script: [{ p1: [I(V), I(F[0])], p2: [I(Z), I(H)] },
               { p1: [I(V), I(F[0])], p2: [{ m: 'disable', t: 0 }, I(H)] }] });
  });
  add('torment', 'data/moves.ts torment.condition.onDisableMove: the last move used', () => {
    if (!LEGALM(dex.moves.get('torment'))) return null;
    const Z = POOL.find(s => learns(s, 'torment') && CAN_IDLE(s));
    const V = POOL.find(s => s !== Z && CAN_IDLE(s) && cleanVictim(s));
    if (!Z || !V) return null;
    const H = POOL.find(s => ![Z, V].includes(s) && CAN_IDLE(s)); const F = fillers([Z.name, V.name, H.name], 5);
    return Object.assign(team(V, [idleName(V)], Z, ['Torment', idleName(Z)], H, [idleName(H)], F), {
      V, Z, handed: { id: norm(idleName(V)) }, at: 1,
      script: [{ p1: [I(V), I(F[0])], p2: [{ m: 'torment', t: 0 }, I(H)] }] });
  });
  add('encore+disable', 'Encore disables every other slot; Disable takes the encored one', () => {
    if (!LEGALM(dex.moves.get('encore')) || !LEGALM(dex.moves.get('disable'))) return null;
    const Z = POOL.find(s => learns(s, 'encore') && CAN_IDLE(s));
    const H = POOL.find(s => s !== Z && learns(s, 'disable') && CAN_IDLE(s));
    const V = POOL.find(s => ![Z, H].includes(s) && CAN_IDLE(s) && learns(s, 'protect') && cleanVictim(s));
    if (!Z || !H || !V) return null;
    const F = fillers([Z.name, V.name, H.name], 5);
    return Object.assign(team(V, [idleName(V), 'Protect'], Z, ['Encore', idleName(Z)], H, ['Disable', idleName(H)], F), {
      V, Z, handed: { id: 'protect' }, at: 2,
      script: [{ p1: [I(V), I(F[0])], p2: [I(Z), I(H)] },
               { p1: [I(V), I(F[0])], p2: [{ m: 'encore', t: 0 }, { m: 'disable', t: 0 }] }] });
  });
  add('choicelock+taunt', 'data/conditions.ts choicelock.onDisableMove + Taunt on the locked status move', () => {
    if (!LEGALM(dex.moves.get('taunt')) || !LEGALM(dex.items.get('choicescarf'))) return null;
    const Z = POOL.find(s => learns(s, 'taunt') && CAN_IDLE(s));
    const V = POOL.find(s => s !== Z && CAN_IDLE(s) && learns(s, 'protect') && cleanVictim(s));
    if (!Z || !V) return null;
    const H = POOL.find(s => ![Z, V].includes(s) && CAN_IDLE(s)); const F = fillers([Z.name, V.name, H.name], 5);
    return Object.assign(team(V, [idleName(V), 'Protect'], Z, ['Taunt', idleName(Z)], H, [idleName(H)], F, 'Choice Scarf'), {
      V, Z, handed: { id: 'protect' }, at: 2,
      script: [{ p1: [I(V), I(F[0])], p2: [I(Z), I(H)] },
               { p1: [I(V), I(F[0])], p2: [{ m: 'taunt', t: 0 }, I(H)] }] });
  });
  add('healblock', 'data/moves.ts healblock.condition.onDisableMove: every heal-flagged slot', () => {
    const NOISE = dex.moves.all().find(m => LEGALM(m) && T.param('move', m.id, 'blocksHealing'));
    if (!NOISE) return null;
    const HEALSELF = s => Object.keys(LS(s)).map(k => dex.moves.get(k))
      .filter(m => LEGALM(m) && m.category === 'Status' && m.target === 'self' && m.flags && m.flags.heal)
      .sort((a, b) => a.id.localeCompare(b.id))[0] || null;
    const Z = POOL.filter(s => learns(s, NOISE.id) && CAN_IDLE(s)).sort((a, b) => b.baseStats.spe - a.baseStats.spe)[0];
    const V = POOL.find(s => s !== Z && HEALSELF(s) && cleanVictim(s) && dex.getImmunity(NOISE.type, s));
    if (!Z || !V) return null;
    const H = POOL.find(s => ![Z, V].includes(s) && CAN_IDLE(s)); const F = fillers([Z.name, V.name, H.name], 5);
    const hs = HEALSELF(V);
    return Object.assign(team(V, [hs.name], Z, [NOISE.name, idleName(Z)], H, [idleName(H)], F), {
      V, Z, handed: { id: hs.id }, at: 1,
      script: [{ p1: [{ m: hs.id }, I(F[0])], p2: [{ m: NOISE.id, t: 0 }, I(H)] }] });
  });
  add('cantusetwice', 'data/moves.ts <move>.onDisableMove: the last move is this one (sim/battle.ts cantusetwice)', () => {
    const REP = dex.moves.all().filter(m => LEGALM(m) && T.param('move', m.id, 'cantUseTwice') && m.target === 'normal')[0];
    if (!REP) return null;
    const V = POOL.find(s => learns(s, REP.id) && cleanVictim(s));
    const Z = POOL.find(s => s !== V && CAN_IDLE(s) && dex.getImmunity(REP.type, s) && dex.getEffectiveness(REP.type, s) <= 0);
    if (!Z || !V) return null;
    const H = POOL.find(s => ![Z, V].includes(s) && CAN_IDLE(s)); const F = fillers([Z.name, V.name, H.name], 5);
    return Object.assign(team(V, [REP.name], Z, [idleName(Z)], H, [idleName(H)], F), {
      V, Z, handed: { id: REP.id, t: 0 }, at: 1,
      script: [{ p1: [{ m: REP.id, t: 0 }, I(F[0])], p2: [I(Z), I(H)] }] });
  });
  add('gravity', 'data/moves.ts gravity.condition.onDisableMove: every gravity-flagged slot, for every active body', () => {
    const G = GRAVITY_FIXTURE();
    if (!G) return null;
    const { Z, V, gm } = G;
    const H = POOL.find(s => ![Z, V].includes(s) && CAN_IDLE(s) && cleanVictim(s)); const F = fillers([Z.name, V.name, H.name], 5);
    const tt = T0(gm);
    return Object.assign(team(V, [gm.name], Z, [dex.moves.get('gravity').name, idleName(Z)], H, [idleName(H)], F), {
      V, Z, handed: tt, at: 1,
      script: [{ p1: [{ m: gm.id, t: tt.t }, I(F[0])], p2: [{ m: 'gravity' }, I(H)] }] });
  });
  add('pp', 'sim/pokemon.ts getMoves: `else if (moveSlot.pp <= 0) disabled = true`', () => {
    const V = POOL.filter(s => IDLE_LO(s) && cleanVictim(s)).sort((a, b) => IDLE_LO(a).pp - IDLE_LO(b).pp || a.name.localeCompare(b.name))[0];
    if (!V) return null;
    const lo = IDLE_LO(V);
    const Z = POOL.find(s => s !== V && CAN_IDLE(s) && cleanVictim(s));
    const H = POOL.find(s => ![Z, V].includes(s) && CAN_IDLE(s) && cleanVictim(s));
    const F = fillers([Z.name, V.name, H.name], 5);
    return Object.assign(team(V, [lo.name], Z, [idleName(Z)], H, [idleName(H)], F), {
      V, Z, handed: { id: lo.id }, at: null, lo, F, H,
      scriptFor: n => Array.from({ length: n }, () => ({ p1: [{ m: lo.id }, I(F[0])], p2: [I(Z), I(H)] })) });
  });
  return out;
}

function partSources() {
  console.log(NL + '  === SOURCES: a named click of a disabled move on a body whose getMoves() is empty ===');
  const SC = scenarios();
  const claims = [];
  for (const sc of SC) {
    console.log(NL + '    --- ' + sc.name + ' — ' + sc.why + ' ---');
    if (sc.missing) { console.log('      NOT IN THIS FORMAT OR NO LEGAL CARRIER — not staged'); continue; }
    /* PP: the length of the script is the authority's own maxpp, read off its battle at boundary 0. */
    if (sc.scriptFor) {
      let maxpp = null;
      const R0 = play(null, sc.P1(), sc.P2(), [], sc.name + '/maxpp', (t, S, battle) => {
        if (t === 0) { const sl = battle.p1.active[0].moveSlots.find(x => x.id === sc.lo.id); maxpp = sl && sl.maxpp; }
      });
      if (!R0.staged || !maxpp) { console.log('      CANNOT STAGE — maxpp unread: ' + (R0.why || '')); cannot++; continue; }
      console.log('      ' + sc.lo.id + ' maxpp on the authority: ' + maxpp);
      sc.script = sc.scriptFor(maxpp); sc.at = maxpp;
    }
    console.log('      victim ' + sc.V.name + '   sealer ' + sc.Z.name + '   handed ' + sc.handed.id + '   boundary ' + sc.at);
    const run = (label, script, at, knob) => {
      let chk = null;
      const R = play(knob, sc.P1(), sc.P2(), script, sc.name + '/' + label + (knob ? '/knob' : ''), (t, S, battle, M) => {
        if (t === at) chk = choiceCheck(S, battle, M, harness(knob).A, 0, sc.handed);
      });
      console.log('      [' + label + (knob ? ' under ' + KNOB + '=1' : '') + ']');
      if (!R.staged) { console.log('        CANNOT STAGE — ' + R.why); cannot++; return null; }
      if (!chk) { console.log('        CANNOT STAGE — boundary ' + at + ' was never reached'); cannot++; return null; }
      console.log('        ' + fmt(chk).split(NL).join(NL + '        '));
      return chk;
    };
    const C = run('CONTROL, boundary 0', [], 0, null);
    if (C) {
      ok(!C.sdEmpty && C.named.accepted && C.named.moveid === sc.handed.id, 'control: the authority takes ' + sc.handed.id + ' as itself');
      ok(C.meMove === sc.handed.id && !C.meCant, 'control: MEDICHAM plays ' + sc.handed.id + ' as itself — the rewrite does not over-fire', C.meMove + (C.meCant ? ' cant ' + C.meCant : ''));
      ok(menuAgree(C), 'control: the two menus agree');
    }
    const X = run('CLAIM, boundary ' + sc.at, sc.script, sc.at, null);
    if (X) {
      if (!X.sdEmpty) { console.log('        CANNOT STAGE — the authority\'s getMoves() is not empty here; the fixture did not seal the body'); cannot++; continue; }
      ok(authorityOnly(X) === 'struggle', 'the authority accepts only Struggle from this body (' + (X.named.accepted ? 'named click REWRITTEN' : 'named click REFUSED') + ')', authorityOnly(X));
      ok(X.meStruggle && menuAgree(X), 'MEDICHAM\'s menu agrees: mustStruggle');
      ok(X.meMove === 'struggle' && !X.meCant, 'MEDICHAM, handed ' + sc.handed.id + ', EXECUTES Struggle and writes no cant',
         'executed ' + X.meMove + (X.meCant ? ', cant ' + X.meCant : ''));
      claims.push({ sc, script: sc.script, at: sc.at, before: X });
    }
  }
  /* TORMENT'S MENU HALF ON ITS OWN, with a second slot left open: the victim carries its self-boost and Protect,
   * uses the self-boost, and is Tormented. The authority's menu is Protect alone; the body is NOT reduced to Struggle,
   * so this arm is about the menu and not the rewrite. Knob MEDI_TORMENT_MENU_OPEN=1 must put the self-boost back. */
  {
    const t = SC.find(x => x.name === 'torment' && !x.missing);
    if (t) {
      console.log(NL + '    --- torment, two slots: the last move leaves the menu, the other stays ---');
      const P1 = () => { const a = t.P1(); a[0] = mon(t.V.name, [idleName(t.V), 'Protect']); return a; };
      const arm = (knob) => {
        let chk = null;
        const R = play(knob, P1(), t.P2(), t.script, 'torment2' + (knob ? '/knob' : ''), (k, S, battle, M) => {
          if (k === 1) chk = choiceCheck(S, battle, M, harness(knob).A, 0, { id: 'protect' });
        });
        console.log('      [' + (knob ? 'under ' + knob + '=1' : 'fixed engine') + ']');
        if (!R.staged || !chk) { console.log('        CANNOT STAGE — ' + (R.why || 'boundary 1 not reached')); cannot++; return null; }
        console.log('        ' + fmt(chk).split(NL).join(NL + '        '));
        return { chk, R };
      };
      const A1 = arm(null);
      if (A1) {
        ok(!A1.chk.sdEmpty && A1.chk.sdMoves.join(',') === 'protect', 'the authority leaves Protect alone on the menu', A1.chk.sdMoves.join(','));
        ok(menuAgree(A1.chk), 'MEDICHAM\'s menu agrees', A1.chk.meMenu.join(','));
        ok(A1.chk.meMove === 'protect', 'and a handed Protect is played as Protect (not rewritten — the menu is not empty)', A1.chk.meMove);
      }
      if (!OUTSIDE_T) {
        const K1 = arm(TORMENT_KNOB);
        if (K1) {
          ok(!menuAgree(K1.chk), 'THE TORMENT KNOB BRINGS THE MENU DEFECT BACK — MEDICHAM offers the self-boost again', K1.chk.meMenu.join(','));
          ok(K1.R.fails.tormentMenuOpenRestored === 1, 'and it stamps MEDFAILS.tormentMenuOpenRestored', String(K1.R.fails.tormentMenuOpenRestored));
        }
        harness(null);
      }
    }
  }
  partGravityMenu(SC);
  if (!OUTSIDE && claims.length) {
    console.log(NL + '    --- the knob arm: every CLAIM again under ' + KNOB + '=1 ---');
    let back = 0;
    for (const c of claims) {
      let chk = null;
      const R = play(true, c.sc.P1(), c.sc.P2(), c.script, c.sc.name + '/knob', (t, S, battle, M) => {
        if (t === c.at) chk = choiceCheck(S, battle, M, harness(true).A, 0, c.sc.handed);
      });
      const got = chk ? (chk.meMove || 'NOTHING') + (chk.meCant ? ' cant ' + chk.meCant : '') : 'not staged';
      const restored = !!chk && !(chk.meMove === 'struggle' && !chk.meCant);
      if (restored) back++;
      console.log('      ' + c.sc.name.padEnd(18) + ' under the knob: ' + got + (restored ? '   (defect back)' : '   (already Struggle by another road)')
        + (R.fails && R.fails.disabledClickPlayedRestored === 1 ? '' : '   [knob NOT stamped]'));
    }
    ok(back > 0, 'THE KNOB BRINGS THE DEFECT BACK on ' + back + ' of ' + claims.length + ' sources, so the claim arms are live');
    harness(null);
  }
}

/* ================================================================================================
 * GRAVITY'S MENU HALF, with a second slot left open, and its execution half on the same turn
 * ================================================================================================
 * The rule is read off the checkout's resolved format, not recalled: `gravity.condition.onDisableMove` disables every
 * slot whose move carries `flags.gravity`; `onBeforeMove` (priority 6) and `onModifyMove` write
 * `|cant|<body>|move: Gravity|<move>` for one that was already chosen. The run refuses if either handler is absent.
 *   MENU   the victim carries its self-boost and a gravity-flagged move; turn 1 it idles and the setter sets Gravity.
 *          At boundary 1 the authority's menu is the self-boost alone; MEDICHAM's must agree, and a handed self-boost is
 *          played as itself (the menu is not empty, so nothing is rewritten).
 *   SAME TURN  the victim CLICKS the flagged move on turn 1 while the (faster) setter lands Gravity first: the streams must
 *          agree, which is the execution half the menu half does not cover.
 *   KNOB   MEDI_GRAVITY_MENU_OPEN=1 must bring the menu defect back and stamp MEDFAILS.gravityMenuOpenRestored. */
function partGravityMenu(SC) {
  const g = (SC || scenarios()).find(x => x.name === 'gravity' && !x.missing);
  console.log(NL + '    --- gravity, two slots: a gravity-flagged move leaves the menu, the other stays ---');
  const gv = dex.moves.get('gravity');
  const hasDis = !!(gv.condition && typeof gv.condition.onDisableMove === 'function' && /flags\[['"]gravity['"]\]/.test(String(gv.condition.onDisableMove)));
  const hasBefore = !!(gv.condition && typeof gv.condition.onBeforeMove === 'function' && /['"]cant['"]/.test(String(gv.condition.onBeforeMove)));
  console.log('      gravity.condition.onDisableMove reads flags.gravity : ' + hasDis + '   onBeforeMove writes cant : ' + hasBefore);
  console.log('      legal gravity-flagged moves: ' + GRAVITY_FLAGGED().join(', '));
  if (!hasDis) { console.log('      THE CHECKOUT HAS NO GRAVITY MENU HALF — the probe is wrong, not the engine.'); bad++; return; }
  if (!g) { console.log('      NO LEGAL FIXTURE'); cannot++; return; }
  const gm = g.handed.id;
  const P1 = () => { const a = g.P1(); a[0] = mon(g.V.name, [idleName(g.V), dex.moves.get(gm).name]); return a; };
  const I = s => ({ m: norm(idleName(s)) });
  const idleV = norm(idleName(g.V));
  const scMenu = [{ p1: [I(g.V), g.script[0].p1[1]], p2: [{ m: 'gravity' }, g.script[0].p2[1]] }];
  const arm = (knob) => {
    let chk = null;
    const R = play(knob, P1(), g.P2(), scMenu, 'gravity2' + (knob ? '/knob' : ''), (k, S, battle, M) => {
      if (k === 1) chk = choiceCheck(S, battle, M, harness(knob).A, 0, { id: idleV });
    });
    console.log('      [' + (knob ? 'under ' + knob + '=1' : 'this engine') + ']');
    if (!R.staged || !chk) { console.log('        CANNOT STAGE — ' + (R.why || 'boundary 1 not reached')); cannot++; return null; }
    console.log('        ' + fmt(chk).split(NL).join(NL + '        '));
    return { chk, R };
  };
  const A1 = arm(null);
  if (A1) {
    ok(!A1.chk.sdEmpty && A1.chk.sdMoves.join(',') === idleV, 'the authority leaves ' + idleV + ' alone on the menu (' + gm + ' is disabled)', A1.chk.sdMoves.join(','));
    ok(menuAgree(A1.chk), 'MEDICHAM\'s menu agrees', A1.chk.meMenu.join(','));
    ok(A1.chk.meMove === idleV && !A1.chk.meCant, 'and a handed ' + idleV + ' is played as itself (the menu is not empty)', A1.chk.meMove);
  }
  if (!OUTSIDE_G) {
    const K1 = arm(GRAVITY_KNOB);
    if (K1) {
      ok(!menuAgree(K1.chk), 'THE GRAVITY KNOB BRINGS THE MENU DEFECT BACK — MEDICHAM offers ' + gm + ' again', K1.chk.meMenu.join(','));
      ok(K1.R.fails.gravityMenuOpenRestored === 1, 'and it stamps MEDFAILS.gravityMenuOpenRestored', String(K1.R.fails.gravityMenuOpenRestored));
    }
    harness(null);
  }
  /* SAME TURN: the execution half. The setter is the fastest legal Gravity user and the victim the slowest carrier. */
  console.log(NL + '    --- gravity, same turn: a flagged move chosen before Gravity landed ---');
  const scSame = [{ p1: [{ m: gm, t: g.handed.t }, scMenu[0].p1[1]], p2: scMenu[0].p2 }];
  const R2 = play(null, P1(), g.P2(), scSame, 'gravity-sameturn', null);
  if (!R2.staged) { console.log('      CANNOT STAGE — ' + R2.why); cannot++; }
  else {
    console.log('      setter ' + g.Z.name + ' (base spe ' + g.Z.baseStats.spe + ')   victim ' + g.V.name + ' (base spe ' + g.V.baseStats.spe + ') clicks ' + gm);
    console.log('      streams: ' + (R2.div ? 'PART — sd ' + R2.div.sd + '  /  me ' + R2.div.me : 'agree for the whole staged game'));
    ok(!R2.div, 'the streams agree: the already-chosen ' + gm + ' is refused the same way in both engines', R2.div && JSON.stringify(R2.div));
  }
  if (R2.staged && !OUTSIDE_GX) {
    const K2 = play(GRAVITY_EXEC_KNOB, P1(), g.P2(), scSame, 'gravity-sameturn/knob', null);
    console.log('      [under ' + GRAVITY_EXEC_KNOB + '=1] streams: ' + (!K2.staged ? 'CANNOT STAGE ' + K2.why : K2.div ? 'PART — sd ' + K2.div.sd + '  /  me ' + K2.div.me : 'agree'));
    if (K2.staged) {
      ok(!!K2.div, 'THE EXECUTION KNOB BRINGS THE DEFECT BACK — the streams part again, so the same-turn arm is live', K2.div ? K2.div.me : 'agree');
      ok(K2.fails.gravityChosenPlayedRestored === 1, 'and it stamps MEDFAILS.gravityChosenPlayedRestored', String(K2.fails.gravityChosenPlayedRestored));
    } else cannot++;
    harness(null);
  }
}

if (PART === 'all' || PART === 'imprison') partImprison();
if (PART === 'gravity') partGravityMenu(null);
if (PART === 'all' || PART === 'sources') partSources();

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s)' : cannot ? '  CANNOT ANSWER — ' + cannot + ' arm(s) could not be staged' : '  GREEN — a handed click on an emptied menu is Struggle in both engines') + NL);
process.exit(bad ? 1 : cannot ? 2 : 0);
