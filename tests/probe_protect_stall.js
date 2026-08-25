/* probe_protect_stall.js — WHICH PROTECT GOES UP, ON A BOARD WHERE A MEGA RE-SORTS THE QUEUE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_protect_stall.js
 *
 * `active[].stall` is the largest board-leaf family in the pinned pool (6 games / 7 leaves). The
 * counter is only ever set by a SUCCESSFUL shield, so a disagreement about the counter is a
 * disagreement about WHICH Protect succeeded — i.e. about who held the LAST action of the turn:
 *
 *     protect.onPrepareHit(pokemon) {
 *       return !!this.queue.willAct() && this.runEvent('StallMove', pokemon);   data/moves.ts:997
 *     }
 *     willAct() { for (const action of this.list)                              battle-queue.ts:310
 *                   if (['move','switch','instaswitch','shift'].includes(action.choice)) return action;
 *                 return null; }
 *
 * and `sim/battle.ts:2915` re-sorts the WHOLE remaining queue after every action in gen >= 8, so a
 * mega evolution (order 104, ahead of every move at 200) can change who is last before any shield
 * has run.
 *
 * EVERY ARM IS FOUR BODIES ALL CLICKING PROTECT. Exactly one of the four must fail — the one that
 * moves last — so `stall` reads 3 on three bodies and 0 on one, and the probe's whole question is
 * WHICH one. Nothing is typed: the arms are built by picking legal species at chosen BASE SPEEDS so
 * the resulting battle Speeds land where the arm wants them, and the speeds actually reached are
 * printed off both engines rather than predicted.
 *
 * IT ASSERTS NOTHING AND EXITS 0. It is a measurement. The census probe is what asserts.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE FIXTURE, DERIVED ----------------------------------------------------------------------
 * A body at a chosen BASE Speed that is legal here, learns Protect, is not itself a mega forme, and
 * has no mega of its own to be dragged into. Deterministic: first by name at that base speed. */
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LEARNS = (s, mv) => { const l = dex.species.getLearnsetData(s.id); return !!(l && l.learnset && l.learnset[mv]); };
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || '') && LEARNS(s, 'protect'))
  .sort((a, b) => a.name.localeCompare(b.name));
const used = new Set();
function atSpe(base, extraMove) {
  const s = POOL.find(x => x.baseStats.spe === base && !used.has(x.name)
    && (!extraMove || LEARNS(x, extraMove)));
  if (!s) throw new Error('NO LEGAL PROTECT CARRIER AT BASE SPEED ' + base
    + (extraMove ? ' that also learns ' + extraMove : '') + ' — a claim about the fixture.');
  used.add(s.name);
  return s;
}
/* THE MEGA CARRIER IS DERIVED FROM THE ITEM TABLE, never named: the biggest Speed JUMP among legal
 * stones whose base forme learns Protect, so the re-sort it forces is as loud as the format allows. */
function megaCarrier() {
  let best = null;
  for (const it of dex.items.all()) {
    if (!LEGAL(it) || !it.megaStone) continue;
    const ms = it.megaStone;
    const pairs = typeof ms === 'string'
      ? [[dex.species.get(dex.species.get(ms).baseSpecies), dex.species.get(ms)]]
      : Object.keys(ms).map(k => [dex.species.get(k), dex.species.get(ms[k])]);
    for (const [b, m] of pairs) {
      if (!b || !b.exists || !m || !m.exists) continue;
      if (!LEGAL(b) || !LEARNS(b, 'protect')) continue;
      const d = m.baseStats.spe - b.baseStats.spe;
      if (!best || d > best.d) best = { base: b, mega: m, item: it, d };
    }
  }
  return best;
}
const MEGA = megaCarrier();
if (!MEGA) { console.log('  NO LEGAL MEGA CARRIER THAT LEARNS PROTECT — a claim about the fixture.'); process.exit(0); }
used.add(MEGA.base.name);

/* The battle Speed a body reaches at level 50 with 31 IVs, a neutral nature and the differential's
 * own SP ladder for its team slot. Written out only to CHOOSE the arms; every printed speed below is
 * read off the two engines, never off this expression. */
const LADDER = [32, 22, 11, 0];
const speAt = (base, slot) => Math.floor((2 * base + 31) * 50 / 100) + 5 + LADDER[slot];

console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
console.log('  mega carrier: ' + MEGA.base.name + ' @ ' + MEGA.item.name + ' -> ' + MEGA.mega.name
  + '   base Speed ' + MEGA.base.baseStats.spe + ' -> ' + MEGA.mega.baseStats.spe + ' (+' + MEGA.d + ')');
console.log('  in slot 1 that is battle Speed ' + speAt(MEGA.base.baseStats.spe, 1)
  + ' -> ' + speAt(MEGA.mega.baseStats.spe, 1));

/* ---- THE DRIVER --------------------------------------------------------------------------------- */
const FILLER = ['clefable', 'milotic'];
const bench = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));
const mon = (species, moves, item) => ({ species, item: item || '', ability: '', moves });

function playArm(tag, p1sheet, p2sheet, script, armId) {
  const a = G.buildPair(p1sheet), b = G.buildPair(p2sheet);
  if (!a || !b) return { tag, err: 'COULD NOT BUILD THE PAIR' };
  const rows = [];
  const r = G.playGame(a, b, 'directed', 'protectstall/' + tag, {
    script, arm: armId ? G.ARM_BY_ID.get(armId) : undefined,
    onBoundary: (snap, turnIdx, S, battle) => {
      const read = (mediSide, sdSide, label) => {
        const out = [];
        for (let i = 0; i < 2; i++) {
          const m = mediSide[i], p = sdSide.active[i];
          const st = p && p.volatiles && p.volatiles.stall;
          out.push({
            slot: label + (i === 0 ? 'a' : 'b'),
            name: m ? norm(m.name) : '?',
            sdName: p ? norm(p.species.id) : '?',
            meSpe: m && m.st ? m.st.sp : null,
            sdSpe: p ? p.getStat('spe') : null,
            meStall: m ? (m.tookProtectTurns | 0) : -1,
            meStallCtr: m ? (M_stallBoard(m.tookProtectTurns | 0)) : -1,
            sdStall: st ? st.counter : 0,
            meHP: m ? Math.max(0, m.curHP) : -1,
            sdHP: p ? Math.max(0, p.hp) : -1,
          });
        }
        return out;
      };
      rows.push({ t: turnIdx,
        p1: read(S.actA, battle.p1, 'p1'), p2: read(S.actB, battle.p2, 'p2'),
        sdLog: battle.log.slice() });
    },
  });
  return { tag, rows, err: r.err, mediTrace: r.mediTrace || [], megaSd: r.megaSd, megaMedi: r.megaMedi };
}
/* medicham2's OWN map from its count-up to Showdown's denominator — the function board_state.js
 * calls, never a second copy of the decay. */
const M = require(D('engine', 'medicham2-browser.js'));
const M_stallBoard = (n) => (M.stallBoardCounter ? M.stallBoardCounter(n) : -1);

const moveLines = (log) => log.filter(l => /^\|move\||^\|-singleturn\||^\|-fail\||^\|detailschange\||^\|switch\|/.test(l));
const mediMoveLines = (tr) => tr.filter(l => /^\|move\||^\|-singleturn\||^\|-fail\||^\|detailschange\||^\|switch\|/.test(l));

function show(res) {
  if (res.err) console.log('    [game ended: ' + res.err + ']');
  if (!res.rows || !res.rows.length) { console.log('    NO BOUNDARY TAKEN'); return; }
  for (const r of res.rows) {
    console.log('    --- boundary b' + r.t + ' ---');
    console.log('    slot  body            spe(me/sd)   stall me(n->ctr)  stall sd   hp me/sd');
    for (const x of [...r.p1, ...r.p2]) {
      console.log('    ' + x.slot.padEnd(5) + ' ' + (x.name + (x.name === x.sdName ? '' : '/' + x.sdName)).padEnd(15)
        + ' ' + String(x.meSpe).padEnd(4) + '/' + String(x.sdSpe).padEnd(6)
        + ' ' + String(x.meStall + '->' + x.meStallCtr).padEnd(16)
        + ' ' + String(x.sdStall).padEnd(10)
        + ' ' + x.meHP + '/' + x.sdHP
        + (x.meStallCtr !== x.sdStall ? '   <-- STALL DIFFERS' : ''));
    }
  }
  const last = res.rows[res.rows.length - 1];
  console.log('    showdown  : ' + moveLines(last.sdLog).join('  '));
  console.log('    medicham2 : ' + mediMoveLines(res.mediTrace).join('  '));
}

/* ---- THE ARMS ------------------------------------------------------------------------------------
 * All four actives click Protect. `mega` is asked of p2 slot 1 in the mega arms and of nobody in the
 * control arms; the control is the SAME BOARD with the stone removed, so the only thing that varies
 * is whether a queue re-sort happens mid-turn.
 *
 * ARM 1 — NO TIE. Speeds are picked so the mega body is LAST before it evolves and FIRST afterwards.
 *   With the stone: the slowest OTHER body must be refused.
 *   Without it:     the mega body itself must be refused.
 * ARM 2 — THE SAME BOARD WITH THE TWO SLOWEST BODIES TIED. Everything else is identical.
 */
const MB = MEGA.base.baseStats.spe, MM = MEGA.mega.baseStats.spe;
const PROT4 = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] };
const PROT4_MEGA = { p1: [{ m: 'protect' }, { m: 'protect' }],
                     p2: [{ m: 'protect' }, { m: 'protect', mega: true }] };

/* Base speeds chosen so that, in the arm's own slots, everybody sits strictly between the mega
 * body's PRE and POST speeds. Solved against `speAt` and then re-read off the engines below. */
function pickBetween(slot, lo, hi, prefer) {
  const cands = POOL.filter(s => !used.has(s.name))
    .filter(s => speAt(s.baseStats.spe, slot) > lo && speAt(s.baseStats.spe, slot) < hi);
  if (!cands.length) throw new Error('NO CARRIER for slot ' + slot + ' between ' + lo + ' and ' + hi);
  let best = cands[0];
  if (prefer != null) { let bd = Infinity;
    for (const c of cands) { const d = Math.abs(speAt(c.baseStats.spe, slot) - prefer); if (d < bd) { bd = d; best = c; } } }
  used.add(best.name);
  return best;
}
const LO = speAt(MB, 1), HI = speAt(MM, 1);

/* ARM 1 — three distinct speeds between LO and HI. */
const A1 = pickBetween(0, LO, HI, HI - 10);                       // p1 slot 0, fastest
const B1 = pickBetween(1, LO, HI, speAt(A1.baseStats.spe, 0) - 10); // p1 slot 1, middle
const C1 = pickBetween(0, LO, HI, LO + 8);                        // p2 slot 0, slowest

/* ARM 2 — THE TIED PAIR IS SOLVED FOR, NOT INHERITED FROM ARM 1. p1 slot 1 and p2 slot 0 must land
 * on the SAME battle Speed, and both must sit strictly between the mega body's PRE and POST speeds
 * so that the mega still crosses the whole field. The pair is searched over the legal Protect
 * carriers rather than picked, and the tie is asserted before the arm runs. */
let A2 = null, B2 = null, C2 = null;
{
  const free = POOL.filter(s => !used.has(s.name) && s.name !== A1.name);
  outer:
  for (const c of free) {                       // p2 slot 0
    const sc = speAt(c.baseStats.spe, 0);
    if (!(sc > LO && sc < HI)) continue;
    for (const b of free) {                     // p1 slot 1
      if (b.name === c.name) continue;
      if (speAt(b.baseStats.spe, 1) !== sc) continue;
      /* p1 slot 0 must be strictly FASTER than the tied pair and still below the mega's post speed,
       * so the tie is genuinely for LAST place and the mega genuinely overtakes everybody. */
      const a = free.find(x => x.name !== b.name && x.name !== c.name
        && speAt(x.baseStats.spe, 0) > sc && speAt(x.baseStats.spe, 0) < HI);
      if (!a) continue;
      A2 = a; B2 = b; C2 = c; break outer;
    }
  }
  if (A2) {
    used.add(A2.name); used.add(B2.name); used.add(C2.name);
    const sb = speAt(B2.baseStats.spe, 1), sc = speAt(C2.baseStats.spe, 0);
    if (sb !== sc) throw new Error('ARM 2 IS NOT TIED: ' + sb + ' vs ' + sc);
  }
}

function sheetsFor(a, b, c, withStone) {
  const p1 = [mon(a.name, ['Protect']), mon(b.name, ['Protect'])].concat(bench(...FILLER));
  const p2 = [mon(c.name, ['Protect']),
              mon(MEGA.base.name, ['Protect'], withStone ? MEGA.item.name : '')].concat(bench(...FILLER));
  return [p1, p2];
}

function runArm(label, a, b, c, script, withStone, armId) {
  console.log('\n  ' + label);
  console.log('    p1a ' + a.name + ' (' + speAt(a.baseStats.spe, 0) + ')   p1b ' + b.name + ' (' + speAt(b.baseStats.spe, 1) + ')'
    + '   p2a ' + c.name + ' (' + speAt(c.baseStats.spe, 0) + ')   p2b ' + MEGA.base.name
    + ' (' + speAt(MB, 1) + (withStone ? ' -> ' + speAt(MM, 1) : ' — NO STONE') + ')');
  const [p1, p2] = sheetsFor(a, b, c, withStone);
  const res = playArm(label.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), p1, p2, script, armId);
  show(res);
  return res;
}

console.log('\n  === ARM 1 — NO SPEED TIE ===');
runArm('1A  mega, no tie', A1, B1, C1, [PROT4_MEGA], true);
runArm('1B  CONTROL: same board, no stone', A1, B1, C1, [PROT4], false);

if (!A2) { console.log('\n  ARM 2 COULD NOT BE STAGED — no legal carrier ties p1b with p2a.'); }
else {
  console.log('\n  === ARM 2 — THE TWO SLOWEST BODIES ARE TIED ===');
  runArm('2A  mega, tied tail', A2, B2, C2, [PROT4_MEGA], true);
  runArm('2B  CONTROL: same tied board, no stone', A2, B2, C2, [PROT4], false);
}

console.log('\n  Nothing above is asserted. STALL DIFFERS marks a leaf the two engines do not share.\n');
