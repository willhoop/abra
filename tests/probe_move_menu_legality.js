#!/usr/bin/env node
/* tests/probe_move_menu_legality.js — IS MEDICHAM'S MOVE MENU THE SET THE AUTHORITY WILL ACCEPT?
 * ==================================================================================================
 *
 *   SHOWDOWN_PATH=<checkout> node tests/probe_move_menu_legality.js [--regulation regmc] [--part fakeout|imprison|healblock|all]
 *
 * Three menu defects found by the solver API's legal-actions probe
 * (`tests/probe_medicham_api_differential.js --part legal`, 26 of 5,552 slots on the Reg M-C pool).
 * Each part stages one of them in BOTH engines and compares, at every turn boundary, the moves the
 * authority will ACCEPT for every active body with `selectableMoves` — the function `chooseAction`
 * and `medicham_api.legalActions` both read.
 *
 * ================= WHAT "LEGAL" MEANS IN THE AUTHORITY, READ RATHER THAN RECALLED ================
 *
 * `Side#chooseMove` validates a click against `pokemon.getMoves()` with NO `restrictData`
 * (sim/side.ts:627, the check at :730-745). `getMoves` turns a HIDDEN disable into a real one when
 * `restrictData` is absent (`if (disabled === 'hidden') disabled = !restrictData;`, sim/pokemon.ts:
 * 1025-1027). So the legal set is `getMoves()` minus its disabled rows, whatever the REQUEST shows.
 * The request is built with `restrictData = isLastActive()` (sim/pokemon.ts:1093-1095), so a hidden
 * disable is SHOWN on a body with a live ally to its right and NOT shown on the last active body —
 * which is a question about what a player can SEE, not about what the authority will take. The
 * imprison part demonstrates that on a copy of the authority's own battle rather than asserting it.
 *
 * ================= THE THREE PARTS ===============================================================
 *
 * FAKEOUT — `data/mods/champions/moves.ts` fakeout: `onDisableMove(pokemon) { if
 *   (pokemon.activeMoveActions) pokemon.disableMove('fakeout'); }`. `activeMoveActions` is incremented
 *   on the first line of `runMove`. Parting Shot is a MOVE; this engine builds it as `{kind:'switch',
 *   mv:'partingshot'}` and counted a move action only for `kind` not in {switch, pass}, so a Parting
 *   Shot that did not switch its user out (blocked here by a Protect) left the count at 0 and Fake
 *   Out on the menu. The same test missed every `{kind:'pass', mv}` move; the membership of both
 *   shapes is PRINTED from `playerAction` on every run.
 *     arm PIVOT   the user's first action is Parting Shot into a Protect. THE CLAIM.
 *     arm PASSMV  the user's first action is a move `playerAction` builds as `{kind:'pass', mv}`,
 *                 if the user learns one. Same clause, second shape.
 *     arm CONTROL the user's first action is Protect: both engines must already agree (vacuity).
 *     knob        MEDI_PIVOT_MOVE_NOT_COUNTED=1 must make PIVOT disagree again.
 *
 * IMPRISON — `data/moves.ts` imprison.condition: `onFoeDisableMove(pokemon) { for (const moveSlot of
 *   this.effectState.source.moveSlots) { if (moveSlot.id === 'struggle') continue;
 *   pokemon.disableMove(moveSlot.id, true); } pokemon.maybeDisabled = true; }`. A HIDDEN disable on
 *   every active foe, both slots. `onFoe*` handlers are gathered from `target.foes()` (sim/battle.ts:
 *   1060), i.e. the living active bodies of the other side.
 *     arm SEALED  the imprisoner clicks Imprison on turn 1; both foes carry Protect, which it knows.
 *     arm CONTROL the imprisoner clicks Protect instead: Protect stays on both foes' menus.
 *     knob        MEDI_IMPRISON_MENU_OPEN=1 must make SEALED disagree again.
 *   The imprisoner's own ALLY also carries Protect and must keep it — the over-fire control is every
 *   slot being compared, not only the victims'.
 *
 * HEALBLOCK — `data/moves.ts` healblock.condition: `onDisableMove(pokemon) { for (const moveSlot of
 *   pokemon.moveSlots) { if (this.dex.moves.get(moveSlot.id).flags['heal']) pokemon.disableMove(
 *   moveSlot.id); } }` — a VISIBLE disable. The volatile arrives through Psychic Noise (Heal Block the
 *   move is Past in this format); the blocker is derived from the `blocksHealing` tag.
 *     arm BLOCKED the blocker lands the volatile on turn 1; the victim carries a heal-flagged move.
 *     arm CONTROL the blocker clicks a self-boost instead: the heal move stays on the menu.
 *     knob        MEDI_HEALBLOCK_MENU_OPEN=1 must make BLOCKED disagree again.
 *
 * None of these moves a board in the whole-game differential by construction: that instrument
 * supplies every click from the authority's own request, so MEDICHAM's menu is never consulted there.
 * The menu matters to anything that asks MEDICHAM what it may click — the chooser and the solver API.
 * The Fake Out fix is the exception that may move a board: it changes a COUNT on the body, which the
 * execution-time Fake Out refusal also reads.
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
const KNOBS = { fakeout: 'MEDI_PIVOT_MOVE_NOT_COUNTED', imprison: 'MEDI_IMPRISON_MENU_OPEN', healblock: 'MEDI_HEALBLOCK_MENU_OPEN' };
const OUTSIDE = Object.values(KNOBS).filter(k => process.env[k] === '1');
if (OUTSIDE.length) console.log(NL + '  ' + OUTSIDE.join(', ') + '=1 WAS SET FROM OUTSIDE: the matching part must FAIL and this run must exit 1.');

require(D('tests', '_live_release.js'));
const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARGV('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_move_menu_legality.js — freeze the tree under test').id;
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
console.log(NL + '  format ' + CS.FORMAT + '   checkout ' + process.env.SHOWDOWN_PATH + '   release ' + REL_ID);

/* ---- THE HARNESS, RELOADABLE UNDER ONE KNOB ------------------------------------------------------ */
let _cur = null, _G = null, _M = null;
function harness(knob) {
  const key = knob || '-';
  if (_G && _cur === key) return { G: _G, M: _M };
  for (const k of Object.values(KNOBS)) if (!OUTSIDE.includes(k)) delete process.env[k];
  if (knob) process.env[knob] = '1';
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _M = require(MEDI_PATH);
  _cur = key;
  return { G: _G, M: _M };
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
const LEGALM = m => m.exists && !m.isNonstandard;
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .filter(s => !G0.CLOSET_SPECIES.has(norm(s.id)))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const learns = (s, id) => !!LS(s)[id];
const IDLE_OF = (s) => Object.keys(LS(s)).map(k => dex.moves.get(k))
  .filter(m => LEGALM(m) && m.category === 'Status' && m.target === 'self'
    && !m.stallingMove && !m.selfSwitch && !m.flags.charge && !m.volatileStatus && !m.selfdestruct
    && !m.status && !m.forceSwitch && !m.onHit && !(m.flags && m.flags.heal)
    && m.boosts && Object.values(m.boosts).every(v => v > 0)
    && !('evasion' in m.boosts) && !('accuracy' in m.boosts))
  .sort((a, b) => a.pp - b.pp || a.id.localeCompare(b.id))[0] || null;
const PROTECT = dex.moves.get('protect');
const CAN_IDLE_PROTECT = s => IDLE_OF(s) && learns(s, 'protect');
const mon = (species, moves) => ({ species, item: '', ability: '', moves });
const HP_BOOST = 8;

/* ---- ONE GAME, AND THE MENUS AT EVERY BOUNDARY ----------------------------------------------------
 * Legal in the authority = `getMoves()` rows that are not disabled (the call Side#chooseMove makes).
 * An empty `getMoves()` is Struggle. Legal in MEDICHAM = `mustStruggle ? [struggle] : selectableMoves`. */
function authorityLegal(p) {
  const rows = p.getMoves();
  if (!rows.length) return ['struggle'];
  return rows.filter(r => !r.disabled).map(r => r.id);
}
function play(knob, TEAM_P1, TEAM_P2, script, tag, onBoard) {
  const { G, M } = harness(knob);
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }), b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  G.resetScriptCounters();
  const boards = [];
  let fainted = false;
  const r = G.playGame(a, b, 'directed', 'menulegality/' + tag, {
    arm: G.ARM_BY_ID.get('middle'),
    script,
    onBoundary: (snap, turnIdx, S, battle) => {
      const rows = [];
      for (const [sd, act] of [['p1', S.actA], ['p2', S.actB]]) {
        const sdAct = (battle && battle[sd] && battle[sd].active) || [];
        for (let i = 0; i < sdAct.length; i++) {
          const p = sdAct[i], m = act && act[i];
          if (!p || p.fainted || !m || m.fainted || m.curHP <= 0) continue;
          const sdl = authorityLegal(p).map(norm).sort();
          const me = (M.mustStruggle(m) ? ['struggle'] : M.selectableMoves(m)).map(norm).sort();
          const req = battle[sd].activeRequest && battle[sd].activeRequest.active && battle[sd].activeRequest.active[i];
          rows.push({ sd, i, body: p.species.name, sd_legal: sdl, me_legal: me,
                      agree: sdl.join(',') === me.join(','),
                      shown: req && req.moves ? req.moves.map(x => norm(x.id) + (x.disabled ? '[dis]' : '')).join(',') : null,
                      maybeDisabled: !!(req && req.maybeDisabled) });
        }
        for (const p of ((battle && battle[sd] && battle[sd].pokemon) || [])) if (p.fainted) fainted = true;
      }
      boards.push({ turn: turnIdx, rows });
      if (onBoard) onBoard(turnIdx, S, battle, M);
    },
  });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  return { staged: true, boards, fainted, div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null,
           fails: Object.assign({}, M.MEDFAILS), seen: Object.assign({}, M.MEDSEEN) };
}
const disagreements = R => R.boards.flatMap(b => b.rows.filter(x => !x.agree).map(x => Object.assign({ turn: b.turn }, x)));
function show(R, focus) {
  for (const b of R.boards) for (const x of b.rows) {
    if (focus && !focus(x)) continue;
    console.log('        t' + b.turn + ' ' + x.sd + '[' + x.i + '] ' + x.body.padEnd(14) + (x.agree ? ' agree   ' : ' DIFFER  ')
      + 'authority ' + x.sd_legal.join(',') + '  |  medicham ' + x.me_legal.join(','));
  }
  if (R.div) console.log('        streams part: sd ' + R.div.sd + '  /  me ' + R.div.me);
}
function staged(R, label) {
  if (!R.staged) { console.log('      CANNOT STAGE ' + label + ' — ' + R.why); cannot++; return false; }
  if (!R.boards.length) { console.log('      CANNOT STAGE ' + label + ' — no boundary was observed'); cannot++; return false; }
  return true;
}

/* ================================================================================================
 * FAKEOUT
 * ================================================================================================ */
function partFakeout() {
  console.log(NL + '  === FAKEOUT: a Parting Shot that stays in is still a move action ===');
  const K = KNOBS.fakeout;
  const modM = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const i = modM.indexOf('\tfakeout: {');
  const blk = i < 0 ? '' : modM.slice(i, modM.indexOf('\n\t},', i));
  const menuRule = /onDisableMove\(pokemon\)\s*\{\s*if \(pokemon\.activeMoveActions\)/.test(blk);
  console.log('    champions fakeout.onDisableMove reads activeMoveActions : ' + menuRule);
  if (!menuRule) { console.log('    THE FORMAT DOES NOT SAY THIS — the probe is wrong, not the engine.'); bad++; return; }

  /* THE MEMBERSHIP OF THE TWO SHAPES THE OLD TEST MISSED, PRINTED FROM playerAction ITSELF. */
  const { M } = harness(null);
  const probeBody = M.buildMon(POOL[0].id, {});
  const foeBody = M.buildMon(POOL[1].id, {});
  const shapes = { switch: [], pass: [] };
  const unbuilt = [];
  for (const mv of dex.moves.all()) {
    if (!LEGALM(mv)) continue;
    let a = null;
    /* A move playerAction cannot build with an empty field is not in either shape; it is COUNTED and printed. */
    try { a = M.playerAction(Object.assign({}, probeBody, { moves: [mv.id] }), mv.id, foeBody, {}); }
    catch (e) { unbuilt.push(mv.id + ' (' + String(e && e.message || e).slice(0, 40) + ')'); continue; }
    if (a && (a.kind === 'switch' || a.kind === 'pass') && a.mv) shapes[a.kind].push(mv.id);
  }
  console.log('    moves playerAction builds as {kind:"switch", mv} : ' + (shapes.switch.join(', ') || 'NONE'));
  console.log('    moves playerAction builds as {kind:"pass", mv}   : ' + (shapes.pass.join(', ') || 'NONE'));
  console.log('    moves playerAction could not build here          : ' + unbuilt.length + (unbuilt.length ? ' — ' + unbuilt.slice(0, 5).join(', ') : ''));

  const USERS = POOL.filter(s => learns(s, 'fakeout') && learns(s, 'partingshot') && learns(s, 'protect'));
  if (!USERS.length) { console.log('    NO LEGAL CARRIER of Fake Out + Parting Shot + Protect in this format.'); cannot++; return; }
  const U = USERS[0];
  /* Transform is excluded: it rewrites the user's move slots, so the menu after it is a different question. */
  const PASSMV = shapes.pass.find(id => id !== 'transform' && learns(U, id)) || null;
  const PASS_T = PASSMV && ['normal', 'adjacentFoe', 'any'].includes(dex.moves.get(PASSMV).target) ? 0 : undefined;
  const FILL = POOL.filter(s => s.name !== U.name && CAN_IDLE_PROTECT(s)).slice(0, 7);
  if (FILL.length < 7) { console.log('    NOT ENOUGH FILLER.'); cannot++; return; }
  const idle = s => IDLE_OF(s).name;
  const P1 = () => [mon(U.name, ['Fake Out', 'Parting Shot', 'Protect'].concat(PASSMV ? [dex.moves.get(PASSMV).name] : [])),
                    mon(FILL[0].name, [idle(FILL[0]), 'Protect']), mon(FILL[1].name, [idle(FILL[1]), 'Protect']),
                    mon(FILL[2].name, [idle(FILL[2]), 'Protect'])];
  const P2 = () => [mon(FILL[3].name, [idle(FILL[3]), 'Protect']), mon(FILL[4].name, [idle(FILL[4]), 'Protect']),
                    mon(FILL[5].name, [idle(FILL[5]), 'Protect']), mon(FILL[6].name, [idle(FILL[6]), 'Protect'])];
  console.log('    the user : ' + U.name + '   a {pass, mv} move it learns: ' + (PASSMV || 'none'));
  const foeProtect = { m: 'protect' };
  const scr = first => [
    { p1: [first, { m: norm(idle(FILL[0])) }], p2: [foeProtect, { m: norm(idle(FILL[4])) }] },
    { p1: [{ m: 'protect' }, { m: norm(idle(FILL[0])) }], p2: [{ m: norm(idle(FILL[3])) }, { m: norm(idle(FILL[4])) }] },
  ];
  const userRows = R => R.boards.map(b => ({ turn: b.turn, row: b.rows.find(x => x.sd === 'p1' && x.i === 0) })).filter(x => x.row);
  const arm = (label, first, knob) => {
    const R = play(knob, P1(), P2(), scr(first), 'fakeout/' + label + (knob ? '/knob' : ''));
    console.log('    --- ' + label + (knob ? ' under ' + knob + '=1' : '') + ' ---');
    if (!staged(R, label)) return null;
    show(R, x => x.sd === 'p1' && x.i === 0);
    return R;
  };
  const afterFirst = R => { const u = userRows(R).find(x => x.turn >= 1); return u ? u.row : null; };

  const C = arm('CONTROL (first action Protect)', { m: 'protect' }, null);
  if (C) {
    const u = afterFirst(C);
    ok(!!u && !u.sd_legal.includes('fakeout'), 'the authority disables Fake Out after the user has taken a move action', u && u.sd_legal.join(','));
    ok(!!u && u.agree, 'and MEDICHAM agrees on the control arm, so the instrument can see agreement');
  }
  const P = arm('PIVOT (first action Parting Shot into a Protect)', { m: 'partingshot', t: 0 }, null);
  let pivotAgree = null;
  if (P) {
    const u = afterFirst(P);
    ok(!!u && u.body === U.name, 'the user is still in after the Parting Shot (it was blocked, so it did not switch)', u && u.body);
    ok(!!u && !u.sd_legal.includes('fakeout'), 'the authority disables Fake Out after a Parting Shot that stayed in', u && u.sd_legal.join(','));
    pivotAgree = !!u && u.agree;
    ok(pivotAgree, 'MEDICHAM agrees: Fake Out is off its menu too', u && ('medicham ' + u.me_legal.join(',')));
    ok(!P.div, 'the streams agree for the whole staged game', P.div && JSON.stringify(P.div));
    { const d = disagreements(P); ok(!d.length, 'every slot agrees at every boundary of the staged game, not only the one asserted above', d.map(x => 't' + x.turn + ' ' + x.sd + '[' + x.i + '] authority ' + x.sd_legal.join(',') + ' | medicham ' + x.me_legal.join(',')).join(NL)); }
  }
  if (PASSMV) {
    const Q = arm('PASSMV (first action ' + PASSMV + ')', PASS_T == null ? { m: PASSMV } : { m: PASSMV, t: PASS_T }, null);
    if (Q) { const u = afterFirst(Q); ok(!!u && u.agree, 'MEDICHAM agrees after a {kind:"pass", mv} move', u && ('authority ' + u.sd_legal.join(',') + ' | medicham ' + u.me_legal.join(','))); }
  } else console.log('    PASSMV not staged: ' + U.name + ' learns no move of that shape (the membership above is still printed)');
  if (!OUTSIDE.includes(K) && P) {
    const Rk = arm('PIVOT', { m: 'partingshot', t: 0 }, K);
    if (Rk) {
      const u = afterFirst(Rk);
      ok(!!u && !u.agree, 'THE KNOB BRINGS THE DEFECT BACK — MEDICHAM offers Fake Out again, so the arm above is live', u && u.me_legal.join(','));
      ok(Rk.fails.pivotMoveNotCountedRestored === 1, 'and the knob stamps MEDFAILS.pivotMoveNotCountedRestored', String(Rk.fails.pivotMoveNotCountedRestored));
    }
    harness(null);
  }
}

/* ================================================================================================
 * IMPRISON
 * ================================================================================================ */
function partImprison() {
  console.log(NL + '  === IMPRISON: the foes\' menus lose every move the imprisoner knows ===');
  const K = KNOBS.imprison;
  const mv = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'moves.ts'), 'utf8');
  const modM = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const i = mv.indexOf('\n\timprison: {');
  const blk = i < 0 ? '' : mv.slice(i, mv.indexOf('\n\t},\n', i));
  const menuRule = /onFoeDisableMove\(pokemon\)[\s\S]{0,200}pokemon\.disableMove\(moveSlot\.id, true\)/.test(blk);
  console.log('    imprison.onFoeDisableMove disables HIDDEN : ' + menuRule);
  console.log('    imprison overridden by Champions          : ' + /\n\timprison: \{/.test(modM));
  if (!menuRule) { console.log('    THE FORMAT DOES NOT SAY THIS — the probe is wrong, not the engine.'); bad++; return; }
  const SEAL = dex.moves.all().filter(m => LEGALM(m) && (T.param('move', m.id, 'sealsMoves') || {}).fromUsersOwnMoves === true);
  console.log('    moves whose sealsMoves.fromUsersOwnMoves is true : ' + (SEAL.map(m => m.id).join(', ') || 'NONE'));
  if (!SEAL.length) { console.log('    POPULATION EMPTY.'); cannot++; return; }
  const IMP = SEAL[0];
  const IMPS = POOL.filter(s => learns(s, IMP.id) && CAN_IDLE_PROTECT(s));
  if (!IMPS.length) { console.log('    NO LEGAL CARRIER.'); cannot++; return; }
  const U = IMPS[0];
  const idle = s => IDLE_OF(s).name;
  /* THE VICTIMS' OWN MOVE IS NOT ONE THE IMPRISONER KNOWS, so the only sealed slot is Protect. The
   * first draft did not ask, drew a victim sharing the imprisoner's self-boost, and staged a body
   * sealed on EVERY slot — the Struggle door, which is the STRUGGLE arm below, on purpose. */
  const FILL = POOL.filter(s => s.name !== U.name && CAN_IDLE_PROTECT(s) && norm(idle(s)) !== norm(idle(U))).slice(0, 7);
  if (FILL.length < 7) { console.log('    NOT ENOUGH FILLER.'); cannot++; return; }
  const SHARER = POOL.find(s => s.name !== U.name && !FILL.includes(s) && learns(s, norm(idle(U))) && learns(s, 'protect')) || null;
  const P1 = (allSealed) => [mon(FILL[0].name, [idle(FILL[0]), 'Protect']),
                             allSealed ? mon(SHARER.name, [idle(U), 'Protect']) : mon(FILL[1].name, [idle(FILL[1]), 'Protect']),
                             mon(FILL[2].name, [idle(FILL[2]), 'Protect']), mon(FILL[3].name, [idle(FILL[3]), 'Protect'])];
  const P2 = () => [mon(U.name, [IMP.name, 'Protect', idle(U)])].concat(FILL.slice(4, 7).map(s => mon(s.name, [idle(s), 'Protect'])));
  console.log('    the imprisoner : ' + U.name + ' (p2 slot 0) carries ' + IMP.id + ', protect, ' + norm(idle(U)));
  console.log('    the victims    : ' + FILL[0].name + ' and ' + FILL[1].name + ', each with its own self-boost and Protect');
  console.log('    STRUGGLE arm   : ' + (SHARER ? SHARER.name + ' in slot 1 carries ONLY moves the imprisoner knows (' + norm(idle(U)) + ', protect)' : 'no legal carrier'));
  const scr = (first, allSealed) => [
    { p1: [{ m: norm(idle(FILL[0])) }, { m: norm(idle(allSealed ? U : FILL[1])) }], p2: [first, { m: norm(idle(FILL[4])) }] },
    { p1: [{ m: norm(idle(FILL[0])) }, { m: allSealed ? 'protect' : norm(idle(FILL[1])) }], p2: [{ m: norm(idle(U)) }, { m: norm(idle(FILL[4])) }] },
  ];
  let demo = null;
  const onBoard = (turnIdx, S, battle) => {
    if (turnIdx !== 1 || demo) return;
    /* THE LAST-ACTIVE CASE, DEMONSTRATED ON A COPY OF THE AUTHORITY'S OWN BATTLE: slot 1 has no live
     * ally to its right, so its REQUEST shows Protect enabled — and the authority still refuses it. */
    try {
      const { State } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim', 'state.js'));
      const b2 = State.deserializeBattle(State.serializeBattle(battle));
      b2.p1.clearChoice();
      const first = b2.p1.chooseMove(norm(idle(FILL[0])));
      const second = b2.p1.chooseMove('protect');
      const acts = b2.p1.choice.actions.map(a => a.moveid);
      demo = { first, second, error: b2.p1.choice.error || '', actions: acts };
    } catch (e) { demo = { threw: String(e && e.message || e) }; }
  };
  const arm = (label, first, knob, hook, allSealed) => {
    const R = play(knob, P1(allSealed), P2(), scr(first, allSealed), 'imprison/' + label + (knob ? '/knob' : ''), hook);
    console.log('    --- ' + label + (knob ? ' under ' + knob + '=1' : '') + ' ---');
    if (!staged(R, label)) return null;
    show(R);
    return R;
  };
  const at1 = R => (R.boards.find(b => b.turn === 1) || { rows: [] }).rows;
  const C = arm('CONTROL (imprisoner clicks Protect)', { m: 'protect' }, null);
  if (C) {
    const rows = at1(C).filter(x => x.sd === 'p1');
    ok(rows.length === 2 && rows.every(x => x.sd_legal.includes('protect')), 'with no Imprison up, the authority offers Protect to both foes', rows.map(x => x.sd_legal.join(',')).join(' / '));
    ok(at1(C).every(x => x.agree), 'and MEDICHAM agrees on every slot');
  }
  const Sd = arm('SEALED (imprisoner clicks ' + IMP.id + ')', { m: IMP.id }, null, onBoard);
  if (Sd) {
    const rows = at1(Sd);
    const foes = rows.filter(x => x.sd === 'p1');
    ok(foes.length === 2 && foes.every(x => !x.sd_legal.includes('protect')), 'the authority refuses Protect to BOTH foes, slot 0 and the last-active slot 1', foes.map(x => x.sd_legal.join(',')).join(' / '));
    const f0 = foes.find(x => x.i === 0), f1 = foes.find(x => x.i === 1);
    console.log('        the REQUEST, which is what a player sees: slot0 ' + (f0 && f0.shown) + ' maybeDisabled=' + (f0 && f0.maybeDisabled)
      + '   slot1 ' + (f1 && f1.shown) + ' maybeDisabled=' + (f1 && f1.maybeDisabled));
    ok(!!f0 && /protect\[dis\]/.test(f0.shown || ''), 'slot 0 (a live ally to its right) is SHOWN Protect disabled');
    ok(!!f1 && /(^|,)protect(,|$)/.test(f1.shown || '') && f1.maybeDisabled, 'slot 1 (the last active) is NOT shown it, and carries maybeDisabled instead');
    ok(!!demo && !demo.threw && demo.first === true && demo.second === false && /disabled/i.test(demo.error) && demo.actions.length === 1,
       'and the authority REJECTS the last active body\'s Protect when it is chosen — the legal set is the same for both slots',
       JSON.stringify(demo));
    ok(foes.every(x => x.agree), 'MEDICHAM agrees: Protect is off both foes\' menus', foes.map(x => 'medicham ' + x.me_legal.join(',')).join(' / '));
    const ally = rows.find(x => x.sd === 'p2' && x.i === 1);
    ok(!!ally && ally.sd_legal.includes('protect') && ally.agree, 'the imprisoner\'s own ally keeps Protect in both engines (onFoe* is foes only)', ally && ally.me_legal.join(','));
    ok(!Sd.div, 'the streams agree for the whole staged game', Sd.div && JSON.stringify(Sd.div));
    { const d = disagreements(Sd); ok(!d.length, 'every slot agrees at every boundary of the staged game, not only the one asserted above', d.map(x => 't' + x.turn + ' ' + x.sd + '[' + x.i + '] authority ' + x.sd_legal.join(',') + ' | medicham ' + x.me_legal.join(',')).join(NL)); }
    /* STRUGGLE: every slot of the last-active victim is one the imprisoner knows. `getMoves()` comes
     * back empty, so the authority's only legal click is Struggle (sim/pokemon.ts:1041, side.ts:699)
     * — and MEDICHAM's `mustStruggle` is the same question asked of the same menu. */
    if (SHARER) {
      const St = arm('STRUGGLE (slot 1 carries only sealed moves)', { m: IMP.id }, null, null, true);
      if (St) {
        const v = at1(St).find(x => x.sd === 'p1' && x.i === 1);
        ok(!!v && v.sd_legal.join(',') === 'struggle', 'the authority leaves the all-sealed body only Struggle', v && v.sd_legal.join(','));
        ok(!!v && v.agree, 'MEDICHAM agrees: mustStruggle is true for it', v && ('medicham ' + v.me_legal.join(',')));
        /* THE STREAMS ARE PRINTED, NOT ASSERTED, on this arm. The harness hands MEDICHAM the scripted
         * click itself; the authority's Side#chooseMove silently rewrites a click on an emptied menu
         * into Struggle (side.ts:699-709) and nothing on MEDICHAM's side performs that rewrite for a
         * caller-supplied click. That is the execution path, not the menu, and is reported as such. */
        console.log('        streams on the STRUGGLE arm: ' + (St.div ? 'PART — sd ' + St.div.sd + ' / me ' + St.div.me : 'agree'));
      }
    }
    if (!OUTSIDE.includes(K)) {
      const Rk = arm('SEALED', { m: IMP.id }, K);
      if (Rk) {
        const fk = at1(Rk).filter(x => x.sd === 'p1');
        ok(fk.some(x => !x.agree), 'THE KNOB BRINGS THE DEFECT BACK — MEDICHAM offers Protect again, so the arm above is live', fk.map(x => x.me_legal.join(',')).join(' / '));
        ok(Rk.fails.imprisonMenuOpenRestored === 1, 'and the knob stamps MEDFAILS.imprisonMenuOpenRestored', String(Rk.fails.imprisonMenuOpenRestored));
      }
      harness(null);
    }
  }
}

/* ================================================================================================
 * HEALBLOCK
 * ================================================================================================ */
function partHealblock() {
  console.log(NL + '  === HEAL BLOCK: a heal-flagged move leaves the menu while the volatile stands ===');
  const K = KNOBS.healblock;
  const mv = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'moves.ts'), 'utf8');
  const modM = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const i = mv.indexOf('\n\thealblock: {');
  const blk = i < 0 ? '' : mv.slice(i, mv.indexOf('\n\t},\n', i));
  const menuRule = /onDisableMove\(pokemon\)[\s\S]{0,200}flags\['heal'\][\s\S]{0,80}pokemon\.disableMove\(moveSlot\.id\)/.test(blk);
  console.log('    healblock.onDisableMove disables heal-flagged slots (visible) : ' + menuRule);
  console.log('    healblock / psychicnoise overridden by Champions             : ' + /\n\thealblock: \{/.test(modM) + ' / ' + /\n\tpsychicnoise: \{/.test(modM));
  if (!menuRule) { console.log('    THE FORMAT DOES NOT SAY THIS — the probe is wrong, not the engine.'); bad++; return; }
  const BLOCKERS = dex.moves.all().filter(m => LEGALM(m) && T.param('move', m.id, 'blocksHealing'));
  console.log('    moves tagged blocksHealing : ' + (BLOCKERS.map(m => m.id).join(', ') || 'NONE'));
  if (!BLOCKERS.length) { console.log('    POPULATION EMPTY.'); cannot++; return; }
  const NOISE = BLOCKERS[0];
  const HEALHIT = m => LEGALM(m) && m.category !== 'Status' && m.flags && m.flags.heal && m.target === 'normal'
    && !m.multihit && !m.flags.charge && !m.recoil && !m.selfSwitch;
  const HEAL_OF = s => Object.keys(LS(s)).map(k => dex.moves.get(k)).filter(HEALHIT).sort((a, b) => a.id.localeCompare(b.id))[0] || null;
  const NOISERS = POOL.filter(s => learns(s, NOISE.id) && CAN_IDLE_PROTECT(s)).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
  const CLICKERS = POOL.filter(s => HEAL_OF(s) && CAN_IDLE_PROTECT(s)).sort((a, b) => a.baseStats.spe - b.baseStats.spe);
  if (!NOISERS.length || !CLICKERS.length) { console.log('    NO LEGAL CARRIER.'); cannot++; return; }
  const NO = NOISERS[0], CK = CLICKERS.find(s => s.name !== NO.name);
  const HEAL = HEAL_OF(CK);
  const FILL = POOL.filter(s => ![NO.name, CK.name].includes(s.name) && CAN_IDLE_PROTECT(s)).slice(0, 6);
  if (FILL.length < 6) { console.log('    NOT ENOUGH FILLER.'); cannot++; return; }
  const idle = s => IDLE_OF(s).name;
  console.log('    the blocker : ' + NO.name + ' clicks ' + NOISE.id + '    the victim : ' + CK.name + ' carries ' + HEAL.id);
  const P1 = () => [mon(CK.name, [HEAL.name, idle(CK), 'Protect'])].concat(FILL.slice(0, 3).map(s => mon(s.name, [idle(s), 'Protect'])));
  const P2 = () => [mon(NO.name, [NOISE.name, idle(NO), 'Protect'])].concat(FILL.slice(3, 6).map(s => mon(s.name, [idle(s), 'Protect'])));
  const scr = first => [
    { p1: [{ m: norm(idle(CK)) }, { m: norm(idle(FILL[0])) }], p2: [first, { m: norm(idle(FILL[3])) }] },
    { p1: [{ m: 'protect' }, { m: norm(idle(FILL[0])) }], p2: [{ m: norm(idle(NO)) }, { m: norm(idle(FILL[3])) }] },
  ];
  const arm = (label, first, knob) => {
    const R = play(knob, P1(), P2(), scr(first), 'healblock/' + label + (knob ? '/knob' : ''));
    console.log('    --- ' + label + (knob ? ' under ' + knob + '=1' : '') + ' ---');
    if (!staged(R, label)) return null;
    show(R, x => x.sd === 'p1' && x.i === 0);
    return R;
  };
  const vic = R => { const b = R.boards.find(x => x.turn === 1); return b && b.rows.find(x => x.sd === 'p1' && x.i === 0); };
  const C = arm('CONTROL (blocker clicks a self-boost)', { m: norm(idle(NO)) }, null);
  if (C) {
    const u = vic(C);
    ok(!!u && u.sd_legal.includes(norm(HEAL.id)) && u.agree, 'with no Heal Block up, both engines offer ' + HEAL.id, u && (u.sd_legal.join(',') + ' | ' + u.me_legal.join(',')));
  }
  const B = arm('BLOCKED (' + NOISE.id + ' lands on turn 1)', { m: NOISE.id, t: 0 }, null);
  if (B) {
    const u = vic(B);
    ok(!!u && !u.sd_legal.includes(norm(HEAL.id)), 'the authority disables ' + HEAL.id + ' under Heal Block', u && u.sd_legal.join(','));
    ok(!!u && u.agree, 'MEDICHAM agrees: ' + HEAL.id + ' is off its menu too', u && ('medicham ' + u.me_legal.join(',')));
    ok(!B.fainted, 'no body fainted, so the fixture is clean');
    ok(!B.div, 'the streams agree for the whole staged game', B.div && JSON.stringify(B.div));
    { const d = disagreements(B); ok(!d.length, 'every slot agrees at every boundary of the staged game, not only the one asserted above', d.map(x => 't' + x.turn + ' ' + x.sd + '[' + x.i + '] authority ' + x.sd_legal.join(',') + ' | medicham ' + x.me_legal.join(',')).join(NL)); }
    if (!OUTSIDE.includes(K)) {
      const Rk = arm('BLOCKED', { m: NOISE.id, t: 0 }, K);
      if (Rk) {
        const uk = vic(Rk);
        ok(!!uk && !uk.agree, 'THE KNOB BRINGS THE DEFECT BACK — MEDICHAM offers ' + HEAL.id + ' again, so the arm above is live', uk && uk.me_legal.join(','));
        ok(Rk.fails.healBlockMenuOpenRestored === 1, 'and the knob stamps MEDFAILS.healBlockMenuOpenRestored', String(Rk.fails.healBlockMenuOpenRestored));
      }
      harness(null);
    }
  }
}

if (PART === 'all' || PART === 'fakeout') partFakeout();
if (PART === 'all' || PART === 'imprison') partImprison();
if (PART === 'all' || PART === 'healblock') partHealblock();

console.log(NL + (bad ? '  RED — ' + bad + ' failing assertion(s)' : cannot ? '  CANNOT ANSWER — ' + cannot + ' part(s) could not be staged' : '  GREEN — MEDICHAM\'s menu is the authority\'s legal set on every staged board') + NL);
process.exit(bad ? 1 : cannot ? 2 : 0);
