/* probe_recharge_priority.js — `mustrecharge` IS THE HIGHEST `onBeforeMovePriority` IN THE FORMAT
 *
 *   SHOWDOWN_PATH=... node tests/probe_recharge_priority.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= THE RULE, DERIVED FROM THE FORMAT ============================================
 *
 * `runEvent` sorts its handlers by priority, HIGHEST FIRST. Every `onBeforeMovePriority` a legal
 * entity in this regulation declares, read out of the loaded checkout rather than typed here (the
 * file prints them below and REFUSES TO RUN if recharge is not the top of that list):
 *
 *     mustrecharge  data/conditions.ts:367   11
 *     slp           data/conditions.ts:66    10      <- Champions overrides the BODY, not the priority
 *     frz           data/conditions.ts:96    10
 *     flinch        data/conditions.ts:201    8
 *     confusion     data/conditions.ts:179    3
 *     attract       data/moves.ts:742         2
 *     par           data/conditions.ts:38     1
 *
 * So a body that must recharge AND is asleep spends the RECHARGE and its sleep counter is not
 * touched. This engine asked recharge LAST — below paralysis, outside the whole `onBeforeMove`
 * block — so it spent the sleep tick instead and carried the recharge into the following turn.
 *
 * ================= THIS IS A BOARD CLAIM, NOT A NARRATION ONE ==================================
 *
 * The two engines write different `|cant|` reasons, which is narration; underneath that they hold
 * DIFFERENT SLEEP COUNTERS from the moment it happens, which is `party.<x>.status_counter` — a board
 * leaf — and the sleeper then wakes a turn apart. The probe asserts the BOARD at every boundary and
 * prints the counters, and the narration clause is secondary.
 *
 * ================= THE THREE ARMS =============================================================
 *
 *   both          — Yawn lands on turn 1 and the body Gigas on turn 2, so on turn 3 it is asleep AND
 *                   recharging.                                                        UNDER TEST.
 *   recharge-only — the identical board with the Yawn replaced by an idle click.  KNOWN-GOOD CONTROL.
 *   sleep-only    — the identical board with the recharge move replaced by an idle click, so the
 *                   body is asleep and nothing else.                             KNOWN-GOOD CONTROL.
 *
 * The two controls are the pair that says the fix cannot be "stop ticking sleep" or "always refuse
 * with recharge": each isolates one of the two conditions on the same board.
 *
 * ================= NOTHING HERE DEPENDS ON A DIE ==============================================
 *
 *   - YAWN has `accuracy: true` — it cannot miss. Read off the format below.
 *   - the recharge move is clicked by a NO GUARD body, so the 90 printed accuracy cannot take the
 *     arm away. `mustrecharge` is `self: {volatileStatus}` and is only applied when the move REACHES
 *     something, so a missed click would silently produce an arm with no recharge in it at all —
 *     which is exactly how the sibling Poltergeist probe lost its control on a corner arm.
 *   - the run stops at turn 3. Champions' `slp.onStart` draws its duration with `sample([2,3,3])`,
 *     which is the `any` stream and `game_differential.js` DECLARES that stream unshared — so the two
 *     engines may legitimately disagree about the WAKE turn. Neither value wakes a body on its first
 *     BeforeMove, so turn 3 is safe and turn 4 is not asserted.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * BOTH, and the pool is expected to move by very little or not at all: a body has to be asleep,
 * frozen, flinched, confused, attracted or paralysed AND owe a recharge on the same turn, which is
 * two uncommon states at once. The LAB is the scoreboard here. Said before the run.
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
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);

/* ---- THE PRIORITY TABLE, READ OUT OF THE LOADED CHECKOUT ---------------------------------------
 * The whole claim is an ORDER, so the order is derived here and the file exits 2 rather than pass if
 * the format stops agreeing with it. `dex.conditions.get(...)` returns the Champions-merged row, so
 * an override that moved a priority would be seen. */
const PRIO = {};
for (const id of ['mustrecharge', 'slp', 'frz', 'flinch', 'confusion', 'par']) {
  const c = DEX.conditions.get(id);
  PRIO[id] = c && c.onBeforeMovePriority;
}
PRIO.attract = (DEX.moves.get('attract').condition || {}).onBeforeMovePriority;
console.log('\n  === onBeforeMovePriority, READ OFF THE LOADED FORMAT (higher runs first) ===');
console.log('  ' + Object.entries(PRIO).map(([k, v]) => k + ' ' + v).join('   '));
{
  const others = Object.entries(PRIO).filter(([k]) => k !== 'mustrecharge').map(([, v]) => v);
  if (!(PRIO.mustrecharge > Math.max(...others))) {
    console.log('NOT RUN — recharge is no longer the highest priority in this format; the claim this '
      + 'file defends would be wrong.'); process.exit(2);
  }
}

const CLICKER = 'Machamp', NOGUARD = 'No Guard';
const BIG = 'Giga Impact', IDLE_P1 = 'Bulk Up';
const ALLY_P1 = 'Weavile', IDLE_ALLY1 = 'Swords Dance';
const TANK = 'Toxapex', IDLE_P2 = 'Iron Defense';
const SLEEPER = 'Snorlax', SLEEP = 'Yawn', IDLE_SLEEPER = 'Curse';
const BENCH_P1 = [['Milotic', 'Recover'], ['Pinsir', 'Swords Dance']];
const BENCH_P2 = [['Corviknight', 'Iron Defense'], ['Torterra', 'Curse']];
/* Nothing may faint — a KO would end the sequence and the arms would part because somebody died. */
const HP_BOOST = 8;

console.log('\n  === THE CAST, CHECKED AGAINST THE FORMAT ===');
{
  let bad = 0;
  const claims = [[CLICKER, BIG], [CLICKER, IDLE_P1], [ALLY_P1, IDLE_ALLY1], [TANK, IDLE_P2],
                  [SLEEPER, SLEEP], [SLEEPER, IDLE_SLEEPER], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const good = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${good ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!good) bad++;
  }
  for (const sp of [CLICKER, ALLY_P1, TANK, SLEEPER, ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    const k = mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' });
    if (!k) { console.log('  NO ENGINE ROW for ' + sp); bad++; }
  }
  const abs = Object.values(DEX.species.get(CLICKER).abilities || {});
  const hasNG = abs.some(x => DEX.toID(x) === DEX.toID(NOGUARD));
  console.log('  ' + CLICKER + ' abilities ' + JSON.stringify(abs) + ' -> carries ' + NOGUARD + ': ' + hasNG);
  if (!hasNG) bad++;
  const bm = DEX.moves.get(BIG);
  console.log('  ' + BIG + ' recharge flag ' + !!bm.flags.recharge + ', printed accuracy ' + bm.accuracy
    + ' (No Guard is what makes that irrelevant)');
  if (!bm.flags.recharge) { console.log('  the recharge move does not carry the flag.'); bad++; }
  const yw = DEX.moves.get(SLEEP);
  console.log('  ' + SLEEP + ' accuracy ' + yw.accuracy + ' (true = cannot miss), duration '
    + ((yw.condition || {}).duration));
  if (yw.accuracy !== true) { console.log('  the sleep road can miss; this arm would be a coin flip.'); bad++; }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const TEAM_P1 = [mon(CLICKER, NOGUARD, [BIG, IDLE_P1]),
                 mon(ALLY_P1, 'Pressure', [IDLE_ALLY1]),
                 ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const TEAM_P2 = [mon(TANK, 'Regenerator', [IDLE_P2]),
                 mon(SLEEPER, 'Thick Fat', [SLEEP, IDLE_SLEEPER]),
                 ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

/* turn 1  the Yawn lands (or does not).
 * turn 2  the recharge move is used (or is not), and the Yawn expires into sleep at the residual.
 * turn 3  BOTH conditions are live on the clicker, and the authority spends the RECHARGE.
 * The turn-3 click is `recharge` on the arms that owe one, because that is the only entry the
 * authority's own request carries for a locked body — a click that is not on the request resolves to
 * `pass` and the arm would measure nothing. `moveNotOnRequest` is asserted at 0. */
const script = arm => {
  const yawn = arm !== 'recharge-only';
  const rech = arm !== 'sleep-only';
  return [
    { p1: [{ m: IDLE_P1 }, { m: IDLE_ALLY1 }],
      p2: [{ m: IDLE_P2 }, yawn ? { m: SLEEP, t: 0 } : { m: IDLE_SLEEPER }] },
    { p1: [rech ? { m: BIG, t: 0 } : { m: IDLE_P1 }, { m: IDLE_ALLY1 }],
      p2: [{ m: IDLE_P2 }, { m: IDLE_SLEEPER }] },
    { p1: [rech ? { m: 'recharge' } : { m: IDLE_P1 }, { m: IDLE_ALLY1 }],
      p2: [{ m: IDLE_P2 }, { m: IDLE_SLEEPER }] },
  ];
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
  .filter(x => !/^\[of\]/.test(x) && !/^\[(silent|still|miss|spread|anim)\]/.test(x))
  .slice(0, (String(l).split('|')[1] === 'move') ? 4 : undefined).join('|');
/* `-ability` IS DROPPED WHOLE, and that is the differ's own rule rather than a convenience.
 * `game_differential.js`'s NORMALISATIONS table (:2139, `ability-announcement`) maps every
 * `|-ability|` line to null, on the argument that it is a COSMETIC announcement whose every
 * consequence is a separate line that IS kept. A probe that held on to it would report a
 * missing announcement as a divergence the measurement it defends cannot see — which this file
 * did, on a Pressure switch-in that has nothing to do with the mechanic under test. */
const SKIP_EVENT = new Set(['', 'split', 't:', '-ability']);
/* `|split|SIDE` carries the omniscient line then the spectator line; game_differential.js:2078 keeps
 * the first. medicham2 emits no `|split|` at all, so this is a no-op on our side. */
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
const cantOf = (lines, n) => stream(lines, n).filter(l => /^\|cant\|p1a\|/.test(l)).join('  ') || '(none)';

const TURNS = 3;

function run(arm) {
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }), b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'recharge-priority', arm, {
    script: script(arm), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      const me = S && S.actA && S.actA[0];
      const sd = battle && battle.p1 && battle.p1.active && battle.p1.active[0];
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sdStatus: sd ? String(sd.status || '') : null,
                  meStatus: me ? String(me.status || '') : null,
                  sdSlp: sd && sd.statusState ? sd.statusState.time : null,
                  meSlp: me ? (me.slpTurns || 0) : null,
                  sdRech: sd ? !!(sd.volatiles && sd.volatiles.mustrecharge) : null,
                  meRech: me ? !!me._recharge : null,
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sc: G.scriptCounters ? G.scriptCounters() : null, sdAll: sd, meAll: me };
}

console.log('\nRECHARGE OUTRANKS EVERY OTHER BeforeMove REFUSAL — a sleeping body that owes one spends the RECHARGE\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  knob MEDI_RECHARGE_BELOW_STATUS=' + (process.env.MEDI_RECHARGE_BELOW_STATUS || '0'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = ['both', 'recharge-only', 'sleep-only'];
const R = {}; for (const a of ARMS) R[a] = run(a);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const a of ARMS) {
  const x = R[a];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + a.toUpperCase() + (a === 'both' ? '  (UNDER TEST)' : '  (KNOWN-GOOD CONTROL)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  for (let n = 1; n <= TURNS; n++) {
    console.log('  t' + n + ' showdown  ' + (stream(x.sdAll, n).join('  ') || '(none)'));
    console.log('  t' + n + ' medicham  ' + (stream(x.meAll, n).join('  ') || '(none)'));
  }
  console.log('  clicker  status sd [' + x.seen.map(y => y.sdStatus || '-').join(', ') + ']  me ['
    + x.seen.map(y => y.meStatus || '-').join(', ') + ']');
  console.log('  clicker  recharge owed sd [' + x.seen.map(y => y.sdRech).join(', ') + ']  me ['
    + x.seen.map(y => y.meRech).join(', ') + ']');
  console.log('  clicker  sleep clock sd(time left) [' + x.seen.map(y => y.sdSlp).join(', ')
    + ']  me(turns spent) [' + x.seen.map(y => y.meSlp).join(', ') + ']');
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const at = (a, t) => (R[a].seen || []).find(y => y.turn === t) || {};

/* -- 1. THE FIXTURE ----------------------------------------------------------------------------- */
for (const a of ARMS) {
  const x = R[a];
  ok(x.verdict === 'RAN' && x.turns >= TURNS, 'the whole script was played — ' + a, 'turns ' + x.turns);
  ok(x.sc && x.sc.moveNotOnRequest === 0,
     'every scripted click was on the AUTHORITY\'s request — ' + a
     + ' (one that is not resolves to `pass`, and the arm measures nothing)',
     x.sc ? JSON.stringify(x.sc) : 'no counters');
}
/* THE TWO CONDITIONS, EACH READ OFF THE AUTHORITY'S OWN BODY AT THE START OF TURN 3. */
ok(at('both', 2).sdStatus === 'slp' && at('both', 2).sdRech === true,
   'ON THE AUTHORITY, at the turn-3 boundary the clicker is ASLEEP and OWES A RECHARGE — this is the '
   + 'whole arm and it is read off its own body, never off this file\'s timing arithmetic',
   'status ' + JSON.stringify(at('both', 2).sdStatus) + '  recharge ' + at('both', 2).sdRech);
ok(at('recharge-only', 2).sdStatus !== 'slp' && at('recharge-only', 2).sdRech === true,
   'the RECHARGE-ONLY control owes a recharge and is NOT asleep',
   'status ' + JSON.stringify(at('recharge-only', 2).sdStatus) + '  recharge ' + at('recharge-only', 2).sdRech);
ok(at('sleep-only', 2).sdStatus === 'slp' && at('sleep-only', 2).sdRech === false,
   'the SLEEP-ONLY control is asleep and owes nothing',
   'status ' + JSON.stringify(at('sleep-only', 2).sdStatus) + '  recharge ' + at('sleep-only', 2).sdRech);
ok(/recharge/.test(cantOf(R.both.sdAll, 3)),
   'and the AUTHORITY spends the RECHARGE on turn 3, not the sleep — if this fails, the rule this '
   + 'file defends is not the rule', 'turn 3 |cant| ' + cantOf(R.both.sdAll, 3));

/* -- 2. THE BOARD — Will's bar, and this defect is board-material. ------------------------------ */
for (const a of ARMS) {
  const bad = (R[a].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}
/* THE UNDERLYING STATE, SPELLED OUT, so a board comparison that stopped looking cannot hide it. */
ok(at('both', 3).meRech === false,
   'this engine SPENT the recharge on turn 3 — it may not still be owed at the turn-3 boundary',
   'me recharge ' + at('both', 3).meRech + '  sd recharge ' + at('both', 3).sdRech);
ok(at('both', 3).meSlp === 0,
   'and it did NOT tick the sleep counter — the authority does not, because recharge outranks it',
   'me sleep turns spent ' + at('both', 3).meSlp + ' (must be 0)  sd time left ' + at('both', 3).sdSlp);
ok(at('sleep-only', 3).meSlp === 1,
   'the SLEEP-ONLY control DID tick — identical counters across the two arms would mean the knob is '
   + 'unwired rather than that the fix works',
   'sleep-only me ' + at('sleep-only', 3).meSlp + '  vs  both me ' + at('both', 3).meSlp);

/* -- 3. THE NARRATION, turn by turn. ------------------------------------------------------------ */
for (const a of ARMS) for (let n = 1; n <= TURNS; n++) {
  const sd = stream(R[a].sdAll, n), me = stream(R[a].meAll, n);
  ok(sd.join('  ') === me.join('  '), 'NARRATION identical on turn ' + n + ' — ' + a,
     'authority [' + sd.join('  ') + ']\n          ours      [' + me.join('  ') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
