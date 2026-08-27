/* probe_unburden_herb_paths.js — ONE HERB, TWO DOORS, AND A SPEED TIER THAT MUST MOVE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_unburden_herb_paths.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= THE TWO QUESTIONS, WHICH ARE NOT THE SAME QUESTION ============================
 *
 * White Herb declares FOUR trigger points (`data/items.ts:7688-7701`): `onAnySwitchIn` at priority
 * -2, `onAnyAfterMega`, `onAnyAfterMove`, and `onResidual` at order 29. A fixture that only clicks a
 * self-lowering move exercises exactly one of them. Both blocks below stage the herb clearing a drop
 * and Unburden reading the empty hand; they differ in WHICH DOOR the herb comes through.
 *
 *   BLOCK A — THE AFTER-MOVE DOOR.  Close Combat's `self.boosts` is `{def:-1, spd:-1}` on the USER.
 *             `onAnyAfterMove` fires when the move resolves, NOT at the residual, so the empty hand
 *             is live for the rest of that same turn and certainly for the next one.
 *   BLOCK B — THE SWITCH-IN DOOR.   Intimidate declares NO `onSwitchInPriority` and therefore sorts
 *             on Speed; the herb declares `onAnySwitchInPriority: -2` and is deliberately after every
 *             entry ability. So the drop lands, the herb answers it, and Unburden is live on TURN ONE
 *             with no move spent. This door had NO road into it until the 2026-08-27 `refill()` pass.
 *
 * ================= THE HERB CLEARS EVERY NEGATIVE STAGE FOR ONE CONSUMPTION ======================
 *
 * `onStart` walks `pokemon.boosts` and collects EVERY negative entry into `effectState.boosts` before
 * calling `useItem()` once; `onUse` then `setBoost`s all of them together. So Close Combat's TWO
 * drops come back for ONE herb. A naive engine clears one stat, spends the herb, and passes an arm
 * that only reads Defence — which is why BOTH stats are asserted, on the same single consumption.
 *
 * ================= THE OBSERVABLE IS A TURN ORDER, NOT A SPEED NUMBER ===========================
 *
 * Speed is not a board leaf, so "did Unburden proc" cannot be read off `board_state.js`. It is read
 * off WHO MOVED FIRST, in the AUTHORITY's own `|move|` order, between two bodies whose Speeds this
 * file DERIVES to straddle the doubling: the herb holder is slower than the comparator un-doubled and
 * faster than it doubled. The window is checked at run time and the fixture refuses to run outside it.
 *
 * ================= EVERY KNOB IS CLEARED EXPLICITLY =============================================
 *
 * Three arms per block, and each pair differs in exactly one thing:
 *   herb+unburden   the arm.                      clears, spends, and MOVES FIRST.
 *   herb+other      the same herb, no Unburden.    clears and spends, and does NOT move first.
 *   nothing+unburden  the same Unburden, no herb.  does not clear, does not spend, does not move first.
 * An identical result across a varied knob means the knob is unwired, not that it does not matter.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * White Herb is 101 of the 13,214 pinned-pool games and Unburden 2,930, so this is NOT the obscure
 * tail — but this pass STAGES ONLY and lands no fix, so the pinned pool must not move at all. The
 * census gains the probe. Predicted before the run, not explained after it.
 *
 * IT WRITES NOTHING. No artifact is touched. It asserts and exits non-zero on a failure.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
require(D('tests', '_live_release.js'));

if (!process.argv.includes('--state')) process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
require(D('data', 'engine-data.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));

const ARM_ID = (() => { const i = process.argv.indexOf('--arm');
                        return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'middle'; })();
const ARM = (G.ARM_BY_ID && G.ARM_BY_ID.get) ? G.ARM_BY_ID.get(ARM_ID) : null;

const mon = (species, ability, moves, item) => ({ species, item: item || '', ability, moves });
const HP_BOOST = 8;

/* ---- THE HERB IS THE ARTIFACT'S, NOT A NAME ---------------------------------------------------- */
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
const HERBS = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('restoresStats')).map(([k, v]) => ({ id: k, uses: v.uses }));
console.log('  items tagged restoresStats  : ' + JSON.stringify(HERBS));
if (HERBS.length !== 1) { console.log('NOT RUN — the tag no longer names exactly one item; the fixture would be ambiguous.'); process.exit(2); }
const HERB = HERBS[0].id;

/* ---- THE CAST ---------------------------------------------------------------------------------
 * HOLDER  the Unburden carrier, at slot 1 of its side (spreadFor gives slot 1 twenty-two Speed points).
 * COMPARE the body whose Speed must sit strictly between the holder's and twice the holder's, at slot
 *         1 of the other side. THE WINDOW IS COMPUTED BELOW AND REFUSED IF IT DOES NOT HOLD.
 * DROPPER slot 0 of the other side, carrying an ability tagged `onSwitchInDrop` in one arm and a
 *         different LEGAL ability of the SAME SPECIES in the control — the board is otherwise identical.
 * FILLER  slot 0 of the holder's side; it exists because a pair is four bodies and two are active. */
const HOLDER = 'Sneasler', HOLD_ABIL = 'Unburden', HOLD_OTHER = 'Pressure';
const DROP_MOVE = 'Close Combat', HOLD_IDLE = 'Swords Dance';
const COMPARE = 'Meowscarada', COMPARE_ABIL = 'Overgrow', COMPARE_IDLE = 'Nasty Plot';
const DROPPER = 'Mawile', DROP_ABIL = 'Intimidate', DROP_OTHER = 'Hyper Cutter', DROPPER_IDLE = 'Swords Dance';
const FILLER = 'Clefable', FILLER_ABIL = 'Magic Guard', FILLER_IDLE = 'Amnesia';
const BENCH_P1 = [['Toxapex', 'Iron Defense'], ['Milotic', 'Recover']];
const BENCH_P2 = [['Corviknight', 'Iron Defense'], ['Pinsir', 'Swords Dance']];

/* THE ABILITY KNOB IS THE ARTIFACT'S SHAPE, PRINTED BEFORE IT IS TRUSTED. A control ability chosen by
 * name could quietly carry the very handler the arm is about. */
{
  const dropTag = ((TAGS.abilities || {})[String(DROP_ABIL).toLowerCase().replace(/[^a-z0-9]/g, '')] || {}).tags || [];
  const ctrlTag = ((TAGS.abilities || {})[String(DROP_OTHER).toLowerCase().replace(/[^a-z0-9]/g, '')] || {}).tags || [];
  console.log('  ' + DROP_ABIL + ' tags   : ' + JSON.stringify(dropTag));
  console.log('  ' + DROP_OTHER + ' tags  : ' + JSON.stringify(ctrlTag) + '   <- the CONTROL must not carry the entry drop');
  if (!dropTag.includes('onSwitchInDrop')) { console.log('NOT RUN — ' + DROP_ABIL + ' is not tagged as an entry drop.'); process.exit(2); }
  if (ctrlTag.includes('onSwitchInDrop')) { console.log('NOT RUN — the CONTROL ability drops too; the knob would be unwired.'); process.exit(2); }
}

/* ---- THE SPEED WINDOW, COMPUTED FROM THE ENGINE'S OWN LINE ------------------------------------- */
const SPE_LADDER = [32, 22, 11, 0];
function speedAt(name, index) {
  const sp = dex.species.get(name);
  const e = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: SPE_LADDER[index % 4] };
  const left = 66 - e.spe, bs = sp.baseStats;
  const main = Math.min(32, left);
  e[(bs.atk || 0) >= (bs.spa || 0) ? 'atk' : 'spa'] = main;
  let spill = left - main;
  for (const st of ['spd', 'def']) { const t = Math.min(32, spill); e[st] = t; spill -= t; }
  const s = M.spreadL50(bs, { at: e.atk, df: e.def, sa: e.spa, sd: e.spd, sp: e.spe }, 'Serious');
  return s.sp != null ? s.sp : s.spe;
}
const S_HOLD = speedAt(HOLDER, 1), S_CMP = speedAt(COMPARE, 1);
console.log('  ' + HOLDER + ' @slot1 Speed ' + S_HOLD + '   unburdened ' + (S_HOLD * 2));
console.log('  ' + COMPARE + ' @slot1 Speed ' + S_CMP + '   <- must sit STRICTLY inside the window');
if (!(S_CMP > S_HOLD && S_CMP < S_HOLD * 2)) {
  console.log('NOT RUN — the comparator does not straddle the doubling, so a turn order could not '
    + 'distinguish a live Unburden from a dead one. THIS IS A FAILED FIXTURE, NOT A PASS.');
  process.exit(2);
}

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [[HOLDER, DROP_MOVE], [HOLDER, HOLD_IDLE], [COMPARE, COMPARE_IDLE],
                  [DROPPER, DROPPER_IDLE], [FILLER, FILLER_IDLE], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  for (const [sp, ab] of [[HOLDER, HOLD_ABIL], [HOLDER, HOLD_OTHER], [DROPPER, DROP_ABIL],
                          [DROPPER, DROP_OTHER], [COMPARE, COMPARE_ABIL], [FILLER, FILLER_ABIL]]) {
    const legal = Object.values(dex.species.get(sp).abilities || {});
    const okA = legal.includes(ab);
    console.log(`  ability : ${sp} / ${ab} -> ${okA ? 'LEGAL' : 'NOT LEGAL (' + JSON.stringify(legal) + ')'}`);
    if (!okA) bad++;
  }
  for (const sp of [HOLDER, COMPARE, DROPPER, FILLER, ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    if (!mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' })) {
      console.log('  NO ENGINE ROW for ' + sp); bad++;
    }
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

/* ---- THE PROTOCOL REDUCER, the same equivalences game_differential.js itself applies ------------ */
const norm = l => String(l)
  .replace(/(p[12][ab]?): ?[^|]*/g, '$1')
  .replace(/\|\d+\/\d+(\/\d+)?( [a-z]+)?/g, '|H/H')
  .toLowerCase()
  .split('|').map((f, i) => {
    let x = f.trim();
    if (i >= 2) x = x.replace(/^(\[from\]\s*)?(move|ability|item):\s*/, '$1');
    return x.replace(/[^a-z0-9\[\]/-]/g, '');
  })
  .slice(0, (String(l).split('|')[1] === 'move') ? 4 : undefined).join('|');
const SKIP_EVENT = new Set(['', 'split', 't:']);
const turnSlice = (lines, n) => {
  const s = (lines || []).map(String);
  const i = s.findIndex(l => l === '|turn|' + n);
  if (i < 0) return [];
  let j = s.findIndex((l, k) => k > i && l.startsWith('|turn|'));
  if (j < 0) j = s.length;
  return s.slice(i + 1, j).filter(l => !SKIP_EVENT.has(l.split('|')[1] || ''));
};
const stream = (lines, n) => {
  const out = [], seen = new Set();
  for (const l of turnSlice(lines, n)) { const k = norm(l); if (seen.has(k)) continue; seen.add(k); out.push(k); }
  return out;
};
/* WHO MOVED, IN ORDER, BY SLOT — never by move name, because two bodies can click the same move. */
const slotOrder = (lines, n) => turnSlice(lines, n).filter(l => l.startsWith('|move|'))
  .map(l => String(l.split('|')[2] || '').split(':')[0].trim());

/* ---- THE BOARD READS, out of each engine's own state ------------------------------------------- */
const sdHold = b => (b && b.p1 && b.p1.active && b.p1.active[1]) || null;
const meHold = S => (S && S.actA && S.actA[1]) || null;
const readSd = p => p ? { item: String(p.item || ''), def: p.boosts.def | 0, spd: p.boosts.spd | 0, atk: p.boosts.atk | 0 } : null;
const readMe = m => m ? { item: String(m.item || ''), def: (m.boosts && m.boosts.df) | 0,
                          spd: (m.boosts && m.boosts.sd) | 0, atk: (m.boosts && m.boosts.at) | 0 } : null;

function run(cfg) {
  const p1 = [mon(FILLER, FILLER_ABIL, [FILLER_IDLE]),
              mon(HOLDER, cfg.holdAbility, [DROP_MOVE, HOLD_IDLE], cfg.holdItem),
              ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
  const p2 = [mon(DROPPER, cfg.dropAbility, [DROPPER_IDLE]),
              mon(COMPARE, COMPARE_ABIL, [COMPARE_IDLE]),
              ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];
  const a = G.buildPair(p1, { hpBoost: HP_BOOST }), b = G.buildPair(p2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'unburden-herb-paths', cfg.tag, {
    script: cfg.script, arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sd: readSd(sdHold(battle)), me: readMe(meHold(S)),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  const turns = [1, 2];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sc: G.scriptCounters ? G.scriptCounters() : null,
           order: turns.map(t => slotOrder(sd, t)),
           orderMe: turns.map(t => slotOrder(me, t)),
           sdS: turns.map(t => stream(sd, t)), meS: turns.map(t => stream(me, t)) };
}

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};
const HOLD_SLOT = 'p1b', CMP_SLOT = 'p2b';
const first = (o) => { const i = o.indexOf(HOLD_SLOT), j = o.indexOf(CMP_SLOT);
                       return (i < 0 || j < 0) ? null : (i < j ? 'holder' : 'comparator'); };
const at = (R, t) => (R.seen || []).find(y => y.turn === t) || {};

function report(R, label) {
  console.log('\n' + '-'.repeat(98));
  console.log('  ' + label);
  console.log('-'.repeat(98));
  if (R.verdict !== 'RAN') { console.log('  ' + R.verdict + (R.why ? ' — ' + R.why : '')); fails++; return; }
  for (let i = 0; i < R.order.length; i++) {
    console.log('  turn ' + (i + 1) + '  order sd ' + JSON.stringify(R.order[i]) + '  me ' + JSON.stringify(R.orderMe[i])
      + '   first of the pair: ' + first(R.order[i]));
    console.log('    sd ' + (R.sdS[i].join('  ') || '(none)'));
    console.log('    me ' + (R.meS[i].join('  ') || '(none)'));
  }
  console.log('  holder sd ' + JSON.stringify(R.seen.map(y => y.sd)));
  console.log('  holder me ' + JSON.stringify(R.seen.map(y => y.me)));
  console.log('  boards ' + R.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('  '));
}

function commonClauses(R, key) {
  ok(R.verdict === 'RAN' && R.turns >= 2, 'both scripted turns were played — ' + key, 'turns ' + R.turns);
  ok(R.sc && R.sc.moveNotOnRequest === 0,
     'every scripted click was on the AUTHORITY\'s request — ' + key, R.sc ? JSON.stringify(R.sc) : 'none');
  const bad = (R.seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + key,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
  for (let i = 0; i < R.sdS.length; i++) {
    const p = R.sdS[i].join('  '), q = R.meS[i].join('  ');
    ok(p === q, 'NARRATION identical, turn ' + (i + 1) + ' — ' + key,
       p === q ? '' : 'authority [' + p + ']\n          ours      [' + q + ']');
    ok(JSON.stringify(R.order[i]) === JSON.stringify(R.orderMe[i]),
       'TURN ORDER identical, turn ' + (i + 1) + ' — ' + key,
       'authority ' + JSON.stringify(R.order[i]) + '  ours ' + JSON.stringify(R.orderMe[i]));
  }
}

console.log('\nWHITE HERB THROUGH TWO DOORS, AND THE SPEED TIER IT HANDS TO UNBURDEN\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

/* ================================================================================================
 * BLOCK A — THE AFTER-MOVE DOOR.  Turn 1 the holder clicks the self-lowering move; turn 2 it idles.
 * ============================================================================================== */
const SCRIPT_A = [
  { p1: [{ m: FILLER_IDLE }, { m: DROP_MOVE, t: 0 }], p2: [{ m: DROPPER_IDLE }, { m: COMPARE_IDLE }] },
  { p1: [{ m: FILLER_IDLE }, { m: HOLD_IDLE }],       p2: [{ m: DROPPER_IDLE }, { m: COMPARE_IDLE }] },
];
const A = {
  arm:   run({ tag: 'A-herb-unburden', holdItem: HERB, holdAbility: HOLD_ABIL,  dropAbility: DROP_OTHER, script: SCRIPT_A }),
  noAb:  run({ tag: 'A-herb-other',    holdItem: HERB, holdAbility: HOLD_OTHER, dropAbility: DROP_OTHER, script: SCRIPT_A }),
  noIt:  run({ tag: 'A-none-unburden', holdItem: '',   holdAbility: HOLD_ABIL,  dropAbility: DROP_OTHER, script: SCRIPT_A }),
};
console.log('\n' + '='.repeat(98));
console.log('  BLOCK A — THE AFTER-MOVE DOOR   (' + DROP_MOVE + ' drops the USER\'s Def and SpD)');
console.log('='.repeat(98));
report(A.arm, 'A1  ' + HERB + ' + ' + HOLD_ABIL + '   (THE ARM)');
report(A.noAb, 'A2  ' + HERB + ' + ' + HOLD_OTHER + '  (CONTROL — the same herb, no Unburden)');
report(A.noIt, 'A3  no item + ' + HOLD_ABIL + '  (CONTROL — the same Unburden, no herb)');

console.log('\n  --- BLOCK A VERDICT ---');
for (const [k, R] of Object.entries(A)) commonClauses(R, 'A/' + k);

/* THE FIXTURE HAPPENED: the AUTHORITY really lowered two stats on the holder this turn. Read off the
 * no-herb control, which is the only arm where the drops survive to a boundary. */
ok(at(A.noIt, 1).sd && at(A.noIt, 1).sd.def === -1 && at(A.noIt, 1).sd.spd === -1,
   'the AUTHORITY really applied BOTH drops — without a herb they are still there at the boundary. '
   + 'An arm where nothing dropped is green and empty',
   JSON.stringify(at(A.noIt, 1).sd));
ok(at(A.noIt, 1).me && at(A.noIt, 1).me.def === -1 && at(A.noIt, 1).me.spd === -1,
   'and so did OURS — same arm, same two stats', JSON.stringify(at(A.noIt, 1).me));

/* BOTH STATS FOR ONE CONSUMPTION. A one-stat implementation passes a Defence-only check. */
for (const [k, R] of [['A1', A.arm], ['A2', A.noAb]]) {
  const s = at(R, 1).sd, m = at(R, 1).me;
  ok(s && s.def === 0 && s.spd === 0 && s.item === '',
     k + ': the AUTHORITY cleared BOTH stages and spent the herb ONCE', JSON.stringify(s));
  ok(m && m.def === 0 && m.spd === 0 && m.item === '',
     k + ': OURS cleared BOTH stages and spent the herb ONCE — a one-stat clear fails HERE and not on Def',
     JSON.stringify(m));
}
ok(at(A.noIt, 1).sd.item === '' && at(A.noIt, 1).me.item === '',
   'A3: the no-item control really held nothing', JSON.stringify([at(A.noIt, 1).sd.item, at(A.noIt, 1).me.item]));

/* THE SPEED TIER. Turn 1 the comparator is faster in every arm; turn 2 it is faster in every arm
 * EXCEPT the one where the herb came off a body carrying Unburden. */
ok(first(A.arm.order[0]) === 'comparator' && first(A.noAb.order[0]) === 'comparator'
   && first(A.noIt.order[0]) === 'comparator',
   'turn 1: the comparator moves first in ALL THREE arms — the window is real and the arms start equal',
   JSON.stringify([first(A.arm.order[0]), first(A.noAb.order[0]), first(A.noIt.order[0])]));
ok(first(A.arm.order[1]) === 'holder',
   'turn 2: the holder moves FIRST once the herb has left a body carrying ' + HOLD_ABIL,
   'order ' + JSON.stringify(A.arm.order[1]));
ok(first(A.noAb.order[1]) === 'comparator' && first(A.noIt.order[1]) === 'comparator',
   'turn 2: and NOT in either control. IDENTICAL ORDER ACROSS THESE KNOBS WOULD MEAN UNBURDEN IS UNWIRED',
   'no-ability ' + JSON.stringify(A.noAb.order[1]) + '  no-item ' + JSON.stringify(A.noIt.order[1]));

/* ================================================================================================
 * BLOCK B — THE SWITCH-IN DOOR.  Nobody clicks anything that lowers a stat. The drop is an ENTRY
 * ABILITY on the body opposite, and the herb has to answer it before turn 1 is ordered.
 * ============================================================================================== */
const SCRIPT_B = [
  { p1: [{ m: FILLER_IDLE }, { m: HOLD_IDLE }], p2: [{ m: DROPPER_IDLE }, { m: COMPARE_IDLE }] },
  { p1: [{ m: FILLER_IDLE }, { m: HOLD_IDLE }], p2: [{ m: DROPPER_IDLE }, { m: COMPARE_IDLE }] },
];
const B = {
  arm:  run({ tag: 'B-intim-herb-unburden', holdItem: HERB, holdAbility: HOLD_ABIL,  dropAbility: DROP_ABIL,  script: SCRIPT_B }),
  noAb: run({ tag: 'B-intim-herb-other',    holdItem: HERB, holdAbility: HOLD_OTHER, dropAbility: DROP_ABIL,  script: SCRIPT_B }),
  noIn: run({ tag: 'B-nointim-herb-unburden', holdItem: HERB, holdAbility: HOLD_ABIL, dropAbility: DROP_OTHER, script: SCRIPT_B }),
};
console.log('\n' + '='.repeat(98));
console.log('  BLOCK B — THE SWITCH-IN DOOR   (' + DROP_ABIL + ' on entry, herb at onAnySwitchInPriority -2)');
console.log('='.repeat(98));
report(B.arm, 'B1  ' + DROP_ABIL + ' + ' + HERB + ' + ' + HOLD_ABIL + '   (THE ARM)');
report(B.noAb, 'B2  ' + DROP_ABIL + ' + ' + HERB + ' + ' + HOLD_OTHER + '  (CONTROL — no Unburden)');
report(B.noIn, 'B3  ' + DROP_OTHER + ' + ' + HERB + ' + ' + HOLD_ABIL + '  (CONTROL — nothing drops, so nothing to clear)');

console.log('\n  --- BLOCK B VERDICT ---');
for (const [k, R] of Object.entries(B)) commonClauses(R, 'B/' + k);

/* THE CONTROL WILL'S BRIEF HANDS OVER FOR FREE: with no entry drop the herb must NOT activate and
 * must NOT be consumed. That is what makes the arm's `item: ''` mean something. */
ok(at(B.noIn, 0).sd && at(B.noIn, 0).sd.item === HERB && at(B.noIn, 0).sd.atk === 0,
   'B3: the AUTHORITY leaves the herb ON the body when nothing dropped', JSON.stringify(at(B.noIn, 0).sd));
ok(at(B.noIn, 0).me && at(B.noIn, 0).me.item === HERB && at(B.noIn, 0).me.atk === 0,
   'B3: and so do WE — an engine that spends the herb unconditionally fails HERE', JSON.stringify(at(B.noIn, 0).me));

for (const [k, R] of [['B1', B.arm], ['B2', B.noAb]]) {
  const s = at(R, 0).sd, m = at(R, 0).me;
  ok(s && s.atk === 0 && s.item === '',
     k + ': the AUTHORITY answered the ENTRY drop before turn 1 — stage back at 0, herb spent', JSON.stringify(s));
  ok(m && m.atk === 0 && m.item === '',
     k + ': and so did WE, at the SWITCH-IN door and not at the residual', JSON.stringify(m));
}

ok(first(B.arm.order[0]) === 'holder',
   'turn ONE: the holder moves first — Unburden is live with no move spent',
   'order ' + JSON.stringify(B.arm.order[0]));
ok(first(B.noAb.order[0]) === 'comparator' && first(B.noIn.order[0]) === 'comparator',
   'turn ONE: and NOT in either control. IDENTICAL ORDER ACROSS THESE KNOBS WOULD MEAN THE DOOR IS UNWIRED',
   'no-ability ' + JSON.stringify(B.noAb.order[0]) + '  no-intimidate ' + JSON.stringify(B.noIn.order[0]));

/* ================================================================================================
 * --red — THE KNOWN-BAD ENGINE, SO THE GREEN ABOVE MEANS SOMETHING.
 *
 * A probe written after a fix and never watched failing is an assertion about the code as it stands.
 * The known-bad input here is the real engine with `restoresStats` STRIPPED OUT of the in-memory
 * artifact through `TAGS.__setDB` — the mutation-tier operation docs/TAG-COVERAGE.md §2 specifies,
 * the same one tests/probe_red_demo.js uses. Nothing touches disk; `__setDB(null)` restores it.
 *
 * WITH THE TAG GONE the herb cannot fire through ANY door, so A1 must keep both drops and B1 must
 * keep the entry drop, the boards must part from the authority, and the turn order must stop
 * flipping. A --red run that stays green means this file cannot fail for the reason it claims.
 * ============================================================================================== */
if (process.argv.includes('--red')) {
  /* THE TAGS MODULE THE DRIVER IS ACTUALLY USING, WHICH IS THE SNAPSHOT'S AND NOT THE LIVE ONE.
   * `REL.require` loads out of the frozen tree, so `require('engine/tags.js')` from here is a
   * DIFFERENT module instance with its own memoised artifact — stripping that one changes nothing and
   * the --red arm stays green while reporting that it broke something. Measured: it did exactly that
   * on the first attempt, 0 of 4. The artifact is read out of the release too, for the same reason. */
  const TAGSMOD = G.REL.require('engine/tags.js', { need: ['__setDB'] });
  const db = JSON.parse(G.REL.read('data/tags.json'));
  const rec = db.items && db.items[HERB];
  if (!rec || !(rec.tags || []).includes('restoresStats')) {
    console.log('\n--red COULD NOT STAGE — the artifact no longer carries the tag to strip.');
    process.exit(2);
  }
  rec.tags = rec.tags.filter(t => t !== 'restoresStats');
  if (rec.params) delete rec.params.restoresStats;
  TAGSMOD.__setDB(db);
  console.log('\n' + '='.repeat(98));
  console.log('  --red — `restoresStats` STRIPPED FROM THE IN-MEMORY ARTIFACT. Every clause below MUST break.');
  console.log('='.repeat(98));
  const rA = run({ tag: 'RED-A', holdItem: HERB, holdAbility: HOLD_ABIL, dropAbility: DROP_OTHER, script: SCRIPT_A });
  const rB = run({ tag: 'RED-B', holdItem: HERB, holdAbility: HOLD_ABIL, dropAbility: DROP_ABIL, script: SCRIPT_B });
  TAGSMOD.__setDB(null);
  report(rA, 'RED A1  ' + HERB + ' + ' + HOLD_ABIL + '  with the tag gone');
  report(rB, 'RED B1  ' + DROP_ABIL + ' + ' + HERB + ' + ' + HOLD_ABIL + '  with the tag gone');
  let redSeen = 0;
  const red = (cond, label, detail) => {
    console.log(`  ${cond ? 'went RED' : 'STILL GREEN'}  ${label}${detail ? '\n          ' + detail : ''}`);
    if (cond) redSeen++; else fails++;
  };
  red((rA.seen || []).some(y => !y.identical), 'A1 board parts from the authority once the herb is dead',
      JSON.stringify((rA.seen || []).map(y => y.identical)));
  red(first(rA.orderMe[1]) !== 'holder', 'A1 turn 2 stops flipping in OUR engine — the AUTHORITY\'s '
      + 'herb is untouched, so ITS order must not change, and reading it here would be reading the '
      + 'control while calling it the arm (that is exactly what this clause did on its first draft)',
      JSON.stringify(rA.orderMe[1]));
  red((rB.seen || []).some(y => !y.identical), 'B1 board parts from the authority once the herb is dead',
      JSON.stringify((rB.seen || []).map(y => y.identical)));
  red(first(rB.orderMe[0]) !== 'holder', 'B1 turn 1 stops flipping in OUR engine', JSON.stringify(rB.orderMe[0]));
  console.log('  ' + redSeen + ' of 4 --red clauses broke as they must.');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
