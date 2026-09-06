/* probe_struggle_announce.js — STRUGGLE ANNOUNCES ITSELF ABOVE ITS OWN `|move|` LINE
 *
 *   SHOWDOWN_PATH=... node tests/probe_struggle_announce.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= THE RULE, READ OFF THE FORMAT ================================================
 *
 *     data/moves.ts:18218-18221, and `/data/mods/champions/moves.ts` carries NO `struggle` key:
 *       onModifyMove(move, pokemon, target) {
 *         move.type = '???';
 *         this.add('-activate', pokemon, 'move: Struggle');
 *       }
 *
 * `singleEvent('ModifyMove', ...)` is `sim/battle-actions.ts:431` and `addMove('move', ...)` is
 * `:457` — the SAME method, twenty-six lines apart — so the authority's stream reads
 *
 *     |-activate|p1a: X|move: Struggle
 *     |move|p1a: X|Struggle|p2a: Y
 *
 * and this engine wrote only the second line. **17 of the 151 protocol first-divergences on release
 * `db248fe67a5e` are this one missing line** — the single largest cause bucket in the artifact.
 *
 * ================= WHAT IS TESTED, AND WHAT IS DELIBERATELY NOT =================================
 *
 * THE CLAIM IS AN ORDERED PAIR OF LINES, not a line count: the `-activate` must sit IMMEDIATELY
 * ABOVE the `|move|` line it belongs to. A file that only asserted "an -activate appears somewhere
 * this turn" would pass on an engine that emitted it after the damage.
 *
 * THE BOARD IS **NOT** COMPARED ON THE STRUGGLE TURN AND THE REASON IS THE INSTRUMENT, NOT A HEDGE.
 * Struggle is `target: "randomNormal"` and `getMoveRequestData` hands back a locked entry with NO
 * `target` field, so `Battle#getTarget` falls through to `getRandomTarget` -> `Side#randomFoe` ->
 * `this.sample(actives)` (sim/battle.ts:2484, sim/side.ts:367-371). That draw is the `any` bucket,
 * which `engine/game_differential.js`'s `midGameVoid` DECLARES UNSHARED — its identity is computed
 * over `{acc, crit, sec, dmg, stall}` only. Two engines may therefore legitimately aim the same
 * Struggle at different foes. Boards ARE compared on every turn before the bar empties, which is
 * where a wrong fix would show up, and the two engines' chosen targets are PRINTED so a reader can
 * see whether they happened to agree.
 *
 * ================= THE ARMS ====================================================================
 *
 *   drained  — the clicker holds ONE 5-PP move, spends every point, and the request replaces the
 *              whole menu with Struggle.                                       UNDER TEST.
 *   full     — the identical board, the identical script, but the clicker's bar is NOT empty on the
 *              last turn, so it plays the ordinary move.               KNOWN-GOOD CONTROL: neither
 *              engine may write an `-activate` here, on the fixed engine OR under the knob.
 *
 * The control is what stops a blanket "print an -activate above every move line" from passing.
 *
 * ================= THE FIXTURE IS ASSERTED, NEVER ASSUMED =======================================
 *
 *   - the AUTHORITY's own request must have offered Struggle and nothing else on the test turn;
 *   - the AUTHORITY must actually have written `|move|...|Struggle|`;
 *   - the control must NOT have; and
 *   - `moveNotOnRequest` must be 0, or the script resolved to `pass` and the arm measures nothing.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * PROTOCOL. Struggle writes no board leaf that this line changes. Expect the pinned pool's protocol
 * first-divergence count to fall by up to 17 and BOARD-MATERIAL to sit still. Said before the run.
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

const ARM_ID = (() => { const i = process.argv.indexOf('--arm');
                        return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'middle'; })();
const ARM = (G.ARM_BY_ID && G.ARM_BY_ID.get) ? G.ARM_BY_ID.get(ARM_ID) : null;

const mon = (species, ability, moves, item) => ({ species, item: item || '', ability, moves });

/* ---- THE MOVE THAT EMPTIES, DERIVED RATHER THAN TYPED ------------------------------------------
 * The arm needs a bar that can be spent inside a scripted game. The base PP is read off the FORMAT
 * and the turn count is computed from it, so a Champions change to either is picked up here rather
 * than silently making the arm stage nothing. */
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);
const DRAIN = 'closecombat';
const DRAIN_PP = DEX.moves.get(DRAIN).pp;
if (!DEX.moves.get(DRAIN).exists || DEX.moves.get(DRAIN).isNonstandard) {
  console.log('NOT RUN — ' + DRAIN + ' is not legal in ' + CS.FORMAT); process.exit(2);
}
/* Showdown gives a set with no declared PP-ups the full 8/5 boost (`Pokemon#constructor`), so the
 * bar is `pp * 8 / 5` rounded down. Computed, not assumed: the arm asserts the emptying turn off the
 * AUTHORITY's own request below, and this only decides how long the script has to be. */
const MAX_PP = Math.floor(DRAIN_PP * 8 / 5);
const TEST_TURN = MAX_PP + 1;          // 1-based: the first turn on which the bar is empty

const CLICKER = 'Lucario';
const ALLY_P1 = 'Alakazam', IDLE_P1 = 'Calm Mind';
const F1 = 'Toxapex', F2 = 'Corviknight', IDLE_P2 = 'Iron Defense';
const BENCH_P1 = [['Milotic', 'Recover'], ['Pinsir', 'Swords Dance']];
const BENCH_P2 = [['Torterra', 'Curse'], ['Goodra', 'Acid Armor']];
/* Nothing may faint. Close Combat lands TEST_TURN-1 times into an 8x body and Struggle's quarter-HP
 * recoil is taken by an 8x clicker. Both are asserted at the end, not hoped for. */
const HP_BOOST = 8;

console.log('\n  === THE CAST, CHECKED AGAINST THE AUTHORITY\'S OWN LEARNSETS ===');
{
  let bad = 0;
  const claims = [[CLICKER, DRAIN], [ALLY_P1, IDLE_P1], [F1, IDLE_P2], [F2, IDLE_P2],
                  ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  for (const sp of [CLICKER, ALLY_P1, F1, F2, ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    const k = mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' });
    if (!k) { console.log('  NO ENGINE ROW for ' + sp); bad++; }
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

/* The clicker carries ONE move in the `drained` arm and TWO in the control, so the control's menu
 * still has a live slot on the test turn. Everything else about the two boards is identical. */
const teamP1 = full => [mon(CLICKER, 'Steadfast', full ? [DRAIN, IDLE_P1] : [DRAIN]),
                        mon(ALLY_P1, 'Synchronize', [IDLE_P1]),
                        ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const TEAM_P2 = [mon(F1, 'Regenerator', [IDLE_P2]), mon(F2, 'Pressure', [IDLE_P2]),
                 ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

/* p1 slot0 spends its bar into p2 slot0; everybody else idles. On the test turn the drained arm is
 * offered Struggle and clicks it; the control still has IDLE_P1 and clicks that. */
const script = full => {
  const out = [];
  for (let t = 1; t <= TEST_TURN; t++) {
    const last = t === TEST_TURN;
    const click = last ? (full ? { m: IDLE_P1 } : { m: 'struggle' }) : { m: DRAIN, t: 0 };
    out.push({ p1: [click, { m: IDLE_P1 }], p2: [{ m: IDLE_P2 }, { m: IDLE_P2 }] });
  }
  return out;
};

/* ---- THE PROTOCOL REDUCER — the equivalences game_differential.js itself applies --------------- */
const norm = l => String(l)
  .replace(/(p[12][ab]?): ?[^|]*/g, '$1')
  .replace(/\|\d+\/\d+(\/\d+)?( [a-z]+)?/g, '|H/H')
  .toLowerCase()
  .split('|').map((f, i) => {
    let x = f.trim();
    if (i >= 2) x = x.replace(/^(\[from\]\s*)?(move|ability|item):\s*/, '$1');
    return x.replace(/[^a-z0-9\[\]/-]/g, '');
  })
  /* THE TWO DECLARED EQUIVALENCES THIS FILE WOULD OTHERWISE BREAK, taken from
   * `game_differential.js`'s own NORMALISATIONS table (`source-tag` :2156, `display-flags` :2171):
   * `[of] pXy` names a body whose effect is already carried by `[from]`, and `[silent]`/`[still]`/
   * `[miss]`/`[spread]`/`[anim]` are rendering hints whose state is a separate kept event. A probe
   * that is STRICTER than the measurement it defends reports defects the measurement cannot see —
   * this file was written without them and accused its own CONTROL of two Yawn attribution gaps that
   * the differ folds away. */
  .filter(x => !/^\[of\]/.test(x) && !/^\[(silent|still|miss|spread|anim)\]/.test(x)).join('|');
/* `-ability` IS DROPPED WHOLE, and that is the differ's own rule rather than a convenience.
 * `game_differential.js`'s NORMALISATIONS table (:2139, `ability-announcement`) maps every
 * `|-ability|` line to null, on the argument that it is a COSMETIC announcement whose every
 * consequence is a separate line that IS kept. A probe that held on to it would report a
 * missing announcement as a divergence the measurement it defends cannot see — which this file
 * did, on a Pressure switch-in that has nothing to do with the mechanic under test. */
const SKIP_EVENT = new Set(['', 'split', 't:', '-ability']);
/* `|split|SIDE` IS FOLLOWED BY TWO VERSIONS OF ONE EVENT and dropping the wrong one reads as an extra
 * line. `game_differential.js:2078-2085` keeps the OMNISCIENT line (`log[i+1]`, exact HP — the one
 * medicham2 emits) and discards the spectator line after it; this does the same rather than
 * de-duplicating, because a global dedup would also swallow a genuine second `-damage` on the same
 * body. medicham2's trace carries no `|split|` at all, so the loop is a no-op on our side. */
const turnSlice = (lines, n) => {
  const s = (lines || []).map(String);
  const i = s.findIndex(l => l === '|turn|' + n);
  if (i < 0) return [];
  let j = s.findIndex((l, k) => k > i && l.startsWith('|turn|'));
  if (j < 0) j = s.length;
  const raw = s.slice(i + 1, j), out = [];
  for (let k = 0; k < raw.length; k++) {
    if (raw[k] === '|split|p1' || raw[k] === '|split|p2') { if (raw[k + 1] != null) out.push(raw[k + 1]); k += 2; continue; }
    out.push(raw[k]);
  }
  return out.filter(l => !SKIP_EVENT.has(l.split('|')[1] || ''));
};
const stream = (lines, n) => turnSlice(lines, n).map(norm);

/* THE CLAIM, SPELLED AS AN ORDERED PAIR. Returns the line printed IMMEDIATELY ABOVE the first
 * `|move|` line whose third field is `struggle`, or null if there is no such move line. */
const aboveStruggle = lines => {
  const s = lines.map(norm);
  const i = s.findIndex(l => /^\|move\|/.test(l) && l.split('|')[3] === 'struggle');
  if (i < 0) return { moveLine: null, above: null };
  return { moveLine: s[i], above: i > 0 ? s[i - 1] : '(nothing — it is the first line of the turn)' };
};
const movedStruggle = lines => lines.map(norm).some(l => /^\|move\|/.test(l) && l.split('|')[3] === 'struggle');
const activates = lines => lines.map(norm).filter(l => /^\|-activate\|/.test(l)).sort().join('  ');
/* Which body the authority / this engine aimed the Struggle at — printed, never asserted. */
const struggleTarget = lines => {
  const l = lines.map(norm).find(x => /^\|move\|/.test(x) && x.split('|')[3] === 'struggle');
  return l ? (l.split('|')[4] || '(none)') : null;
};

function run(full, tag) {
  const a = G.buildPair(teamP1(full), { hpBoost: HP_BOOST }), b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [], menus = [];
  const r = G.playGame(a, b, 'struggle-announce', tag, {
    script: script(full), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      const req = battle && battle.p1 && battle.p1.activeRequest;
      const act = req && req.active && req.active[0];
      menus.push({ turn: turnIdx, offered: act && act.moves ? act.moves.map(m => m.id).join(',') : '(none)' });
      const me = S && S.actA && S.actA[0], sd = battle && battle.p1 && battle.p1.active && battle.p1.active[0];
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  meHp: me ? me.curHP : null, sdHp: sd ? sd.hp : null,
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen, menus,
           sc: G.scriptCounters ? G.scriptCounters() : null,
           sdT: turnSlice(sd, TEST_TURN), meT: turnSlice(me, TEST_TURN),
           sdAll: sd, meAll: me };
}

console.log('\nSTRUGGLE ANNOUNCES ITSELF — `|-activate|USER|move: Struggle` sits above its own `|move|` line\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  knob MEDI_NO_OWNTYPE_ANNOUNCE=' + (process.env.MEDI_NO_OWNTYPE_ANNOUNCE || '0'));
console.log('  ' + DRAIN + ' base pp ' + DRAIN_PP + ' -> bar ' + MAX_PP + ', so the test turn is ' + TEST_TURN);
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const R = { drained: run(false, 'drained'), full: run(true, 'full') };

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const k of ['drained', 'full']) {
  const x = R[k];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + (k === 'drained' ? 'DRAINED — the bar is empty on turn ' + TEST_TURN + '  (UNDER TEST)'
                                      : 'FULL — a live slot remains on turn ' + TEST_TURN + '  (KNOWN-GOOD CONTROL)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  console.log('  p1a menu by turn  ' + x.menus.map(m => 't' + m.turn + ':' + m.offered).join('  '));
  console.log('  turn ' + TEST_TURN + '  showdown  ' + (stream(x.sdAll, TEST_TURN).join('  ') || '(none)'));
  console.log('  turn ' + TEST_TURN + '  medicham  ' + (stream(x.meAll, TEST_TURN).join('  ') || '(none)'));
  console.log('  struggle aimed at  sd ' + JSON.stringify(struggleTarget(x.sdT)) + '  me ' + JSON.stringify(struggleTarget(x.meT)));
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the ORDERED PAIR, then the CONTROL');
console.log('='.repeat(98));

/* -- 1. THE FIXTURE ----------------------------------------------------------------------------- */
for (const k of ['drained', 'full']) {
  const x = R[k];
  ok(x.verdict === 'RAN' && x.turns >= TEST_TURN, 'the whole script was played — ' + k,
     'turns ' + x.turns + (x.why ? ' — ' + x.why : ''));
  ok(x.sc && x.sc.moveNotOnRequest === 0,
     'every scripted click was on the AUTHORITY\'s request — ' + k
     + ' (one that is not resolves to `pass`, and the arm measures nothing)',
     x.sc ? JSON.stringify(x.sc) : 'no counters');
}
{
  const m = (R.drained.menus || []).find(y => y.turn === TEST_TURN - 1);
  ok(!!m && m.offered === 'struggle',
     'the AUTHORITY\'s own request replaced the whole menu with Struggle on the test turn — this is '
     + 'the arm, and it is read off the request rather than off this file\'s PP arithmetic',
     m ? 'offered [' + m.offered + ']' : 'no request recorded');
}
ok(movedStruggle(R.drained.sdT), 'the AUTHORITY actually played Struggle on turn ' + TEST_TURN,
   stream(R.drained.sdAll, TEST_TURN).filter(l => /^\|move\|/.test(l)).join('  '));
ok(movedStruggle(R.drained.meT), 'and so did this engine',
   stream(R.drained.meAll, TEST_TURN).filter(l => /^\|move\|/.test(l)).join('  '));
ok(!movedStruggle(R.full.sdT) && !movedStruggle(R.full.meT),
   'the CONTROL played something else — a control that also Struggled would prove nothing',
   'sd ' + stream(R.full.sdAll, TEST_TURN).filter(l => /^\|move\|/.test(l)).join('  ')
   + '   me ' + stream(R.full.meAll, TEST_TURN).filter(l => /^\|move\|/.test(l)).join('  '));

/* -- 2. THE BOARD, ON EVERY TURN BEFORE THE BAR EMPTIES ----------------------------------------- */
for (const k of ['drained', 'full']) {
  const bad = (R[k].seen || []).filter(y => y.turn < TEST_TURN && !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary before the test turn — ' + k,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}
/* NOTHING FAINTED — otherwise the arms part for a reason that is not the mechanic. */
for (const k of ['drained', 'full']) {
  const dead = (R[k].seen || []).filter(y => y.sdHp === 0 || y.meHp === 0);
  ok(dead.length === 0, 'the clicker survived the whole script — ' + k,
     (R[k].seen || []).map(y => 't' + y.turn + ' sd' + y.sdHp + '/me' + y.meHp).join(' '));
}

/* -- 3. THE ORDERED PAIR — the claim itself ----------------------------------------------------- */
{
  const sd = aboveStruggle(R.drained.sdT), me = aboveStruggle(R.drained.meT);
  console.log('  authority above the move line: ' + JSON.stringify(sd.above));
  console.log('  ours      above the move line: ' + JSON.stringify(me.above));
  ok(/^\|-activate\|/.test(String(sd.above)),
     'the AUTHORITY writes an `-activate` IMMEDIATELY ABOVE its own Struggle line — if this fails the '
     + 'rule this probe defends is not the rule', String(sd.above));
  ok(sd.above === me.above,
     'and this engine writes the SAME line in the SAME position',
     'authority [' + sd.above + ']\n          ours      [' + me.above + ']');
}

/* -- 4. THE CONTROL MAY NOT MOVE. A blanket "announce above every move line" fails here. --------- */
for (const k of ['drained', 'full']) {
  const p = activates(R[k].sdT), q = activates(R[k].meT);
  ok(p === q, 'the `-activate` lines on the test turn match — ' + k,
     'authority [' + (p || '(none)') + ']\n          ours      [' + (q || '(none)') + ']');
}
ok(activates(R.full.meT) === '', 'the CONTROL turn carries NO `-activate` from this engine at all — '
   + 'this is the clause a family-wide over-fire breaks', '[' + activates(R.full.meT) + ']');

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
