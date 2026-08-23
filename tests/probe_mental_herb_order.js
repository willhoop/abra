/* probe_mental_herb_order.js — THE ITEM IS SPENT BEFORE THE VOLATILE IT FREES, NOT AFTER.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_mental_herb_order.js
 *   ... --arm bottom-tie-first        (the default)
 *
 * ================= THE RULE, DERIVED FROM THE AUTHORITY =========================================
 *
 *     data/items.ts:3906-3917 (mentalherb.onUpdate), NOT overridden by Champions:
 *
 *       for (const firstCondition of conditions) {
 *         if (pokemon.volatiles[firstCondition]) {
 *           if (!pokemon.useItem()) return;            <-- writes |-enditem|
 *           for (const secondCondition of conditions) {
 *             pokemon.removeVolatile(secondCondition); <-- the CONDITION's onEnd writes |-end|
 *           }
 *           return;
 *         }
 *       }
 *
 * `Pokemon#useItem` announces the spend, and `removeVolatile` runs the condition's own `onEnd`, which
 * is what writes the `-end`. So the ORDER on the wire is `-enditem` and then `-end`, and it is that
 * way round for the same reason a Knock Off's `-enditem` follows its `-damage`: the announcement
 * belongs to whichever call actually made it, not to the order somebody found tidy.
 *
 * This engine wrote them the other way round — `TR.vend(...)` then `TR.enditem(...)`, one after the
 * other in `mentalHerbCures`. The BOARD is identical either way (the volatile is gone and the item is
 * gone), which is why only the protocol stream could see it: `data/all-mechanics-fire.json` reported
 * `item:mentalherb` as `ordering :: |-enditem|p1a|mentalherb <> |-end|p1a|encore`.
 *
 * ================= THE CLASS, AND WHY THIS PROBE STAGES TWO VOLATILES ===========================
 *
 * The herb's own list is six volatiles — attract, taunt, encore, torment, disable, healblock — and
 * the engine reads that set out of `curesVolatile.cures` rather than naming any of them. So a probe
 * that staged Encore alone would be a probe about Encore. Two members are staged (ENCORE and TAUNT),
 * whose `-end` lines are written by two DIFFERENT conditions with two different labels (`Encore` bare
 * and `move: Taunt`), so an ordering fix that happened to work for one shape is not enough.
 *
 * NOT CLAIMED HERE, AND STATED SO IT IS NOT MISTAKEN FOR FIXED: the authority's loop removes ALL SIX
 * conditions when it fires and this engine removes the one that just landed. On a legal board the two
 * agree — the herb is consumed by the first volatile to arrive, so a second cannot already be there —
 * but that is an argument, not a measurement, and no arm below tests it.
 *
 * ================= THE CONTROL ==================================================================
 *
 * The knob is THE ITEM, cleared explicitly: the same Corviknight, the same Encore, the same dice,
 * holding nothing. The authority then writes neither line and the volatile STAYS — asserted out of
 * its own state, so "no lines" cannot be confused with "the click did nothing".
 *
 * NOTHING about what either line should say is typed. Both engines play the identical scripted turns
 * under identical pinned dice and the turn's protocol is compared as a SEQUENCE.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * Mental Herb is on 967 of 13,116 open-sheet teams, so the LAB must move and the pinned pool may.
 * The BOARD must be identical on every arm before and after — this is an ordering fix.
 *
 * IT WRITES NOTHING. No artifact is touched.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

if (!process.argv.includes('--state')) process.argv.push('--state');

const CS = require(D('engine', 'champions_sim.js'));
const G = require(D('engine', 'game_differential.js'));

const ARM_ID = (() => {
  const i = process.argv.indexOf('--arm');
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'bottom-tie-first';
})();
const ARM = (G.ARM_BY_ID && G.ARM_BY_ID.get) ? G.ARM_BY_ID.get(ARM_ID) : null;

const mon = (species, ability, moves, item) => ({ species, item: item || '', ability, moves });

/* ---- THE CAST ---------------------------------------------------------------------------------
 * ALAKAZAM clicks the lock; it learns both Encore and Taunt legally, so one body serves both members.
 * CORVIKNIGHT holds the herb and MUST have moved before an Encore can repeat anything, so turn 1
 * exists to give it a `lastMove` and turn 2 is the arm. */
const CLICKER = 'alakazam', HOLDER = 'corviknight', ITEM = 'mentalherb';
const MEMBERS = [{ key: 'encore', move: 'Encore', vol: 'encore' },
                 { key: 'taunt', move: 'Taunt', vol: 'taunt' }];
const HOLDER_IDLE = 'Iron Defense', IDLE = 'Calm Mind';
const HP_BOOST = 6;
const BENCH_P1 = [['toxapex', 'Iron Defense'], ['milotic', 'Recover']];
const BENCH_P2 = [['pinsir', 'Swords Dance'], ['banette', 'Swords Dance']];

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [[HOLDER, HOLDER_IDLE], [CLICKER, IDLE], ['clefable', IDLE],
                  ...MEMBERS.map(m => [CLICKER, m.move]), ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const p1Team = item => [mon(HOLDER, 'Pressure', [HOLDER_IDLE], item),
                        mon('clefable', 'Magic Guard', [IDLE]),
                        ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const p2Team = click => [mon(CLICKER, 'Synchronize', [IDLE, click]),
                         mon('milotic', '', [IDLE === 'Calm Mind' ? 'Recover' : IDLE]),
                         ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

const script = click => [
  { p1: [{ m: HOLDER_IDLE }, { m: IDLE }], p2: [{ m: IDLE }, { m: 'Recover' }] },
  { p1: [{ m: HOLDER_IDLE }, { m: IDLE }], p2: [{ m: click, t: 0 }, { m: 'Recover' }] },
];

/* Showdown's log carries the SECRET and SHARED form of one event (the `|split|` pair), a `|split|`
 * marker line and a bare timestamp line, none of which medicham2 emits. Those three shapes are
 * dropped; EVERY OTHER FIELD IS COMPARED. A BODY OR A SIDE IS COMPARED BY ITS SLOT, never by name. */
const norm = l => String(l)
  .replace(/(p[12][ab]?): ?[^|]*/g, '$1')
  .replace(/\|\d+\/\d+(\/\d+)?( [a-z]+)?/g, '|H/H')
  .toLowerCase()
  .split('|').map((f, i) => {
    let x = f.trim();
    /* THE EFFECT NAMESPACE GOES AND THE NAME STAYS, which is exactly `game_differential.js`'s own
     * `effect-namespace` equivalence: Showdown writes an effect sometimes bare and sometimes
     * namespaced (`|-end|p2a: X|Encore` against `move: encore`), and the ten volatile end lines this
     * format carries differ from this engine's generic label in the NAMESPACE and in nothing else --
     * measured over all 57 before this rule was written. A probe stricter than the instrument it
     * feeds would report ten defects that are not defects. */
    if (i >= 2) x = x.replace(/^(\[from\]\s*)?(move|ability|item):\s*/, '$1');
    return x.replace(/[^a-z0-9\[\]/-]/g, '');
  })
  /* AND A `|move|` LINE IS TRUNCATED AT FOUR FIELDS, which is `game_differential.js`'s
   * `move-target-field` equivalence and its argument verbatim: a `|move|` line means "this body used
   * this move", the nominal target field is written differently by the two engines, and WHO WAS
   * ACTUALLY HIT lives in the `-damage` / `-status` / `-unboost` lines that follow and are kept. A
   * failed self-heal is the case in front of us — the authority writes `|move|p2b: X|Recover||[still]`
   * and this engine writes `|move|p2b: X|recover|p2b: X` — and it is a real difference that the
   * instrument this probe feeds does not count, so a probe that failed on it would be reporting a
   * defect nothing else in the repository agrees is one. It is NAMED in the pass report instead. */
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
  for (const l of turnSlice(lines, n)) {
    const k = norm(l);
    if (seen.has(k)) continue;
    seen.add(k); out.push(k);
  }
  return out;
};

/* THE CONSEQUENCE, read out of each engine's own state at the same instant. */
const sdState = (battle, vol) => {
  const p = battle && battle.p1 && battle.p1.active && battle.p1.active[0];
  return p ? { item: String(p.item || ''), vol: !!(p.volatiles && p.volatiles[vol]) } : null;
};
const meState = (S, vol) => {
  const m = S && S.actA && S.actA[0];
  return m ? { item: String(m.item || ''), vol: !!(m._vol && m._vol[vol] > 0) } : null;
};

function run(item, click, vol, tag) {
  const a = G.buildPair(p1Team(item), { hpBoost: HP_BOOST }),
        b = G.buildPair(p2Team(click), { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'mental-herb-order', tag, {
    script: script(click), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sd: sdState(battle, vol), me: meState(S, vol),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sd2: stream(sd, 2), me2: stream(me, 2) };
}

console.log('\nMENTAL HERB — the item is spent BEFORE the volatile it frees\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  restore knob MEDI_HERB_END_FIRST=' + (process.env.MEDI_HERB_END_FIRST || '(off)'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = [];
for (const m of MEMBERS) {
  ARMS.push({ key: m.key + ':herb', item: ITEM, move: m.move, vol: m.vol,
              label: HOLDER.toUpperCase() + ' + MENTAL HERB, hit by ' + m.move.toUpperCase() });
  ARMS.push({ key: m.key + ':bare', item: '', move: m.move, vol: m.vol,
              label: HOLDER.toUpperCase() + ' holding NOTHING, hit by ' + m.move.toUpperCase() + '  (CONTROL)' });
}
const R = {};
for (const a of ARMS) R[a.key] = run(a.item, a.move, a.vol, a.key);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const a of ARMS) {
  const x = R[a.key];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + a.label);
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  console.log('  turn 2  showdown  ' + (x.sd2.join('  ') || '(none)'));
  console.log('  turn 2  medicham  ' + (x.me2.join('  ') || '(none)'));
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
  console.log('  holder state  showdown ' + JSON.stringify(x.seen.map(y => y.sd))
    + '\n                medicham ' + JSON.stringify(x.seen.map(y => y.me)));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const last = k => { const s = R[k].seen || []; return s[s.length - 1] || {}; };

/* -- 1. THE FIXTURE, read off the AUTHORITY's own state and never off a line. -------------------- */
for (const m of MEMBERS) {
  const h = last(m.key + ':herb').sd || {}, b = last(m.key + ':bare').sd || {};
  ok(h.item === '' && h.vol === false,
     `the AUTHORITY spent the herb and freed the ${m.vol} — ${m.key}`, JSON.stringify(h));
  ok(b.item === '' && b.vol === true,
     `and with NO item the ${m.vol} STAYS — IDENTICAL STATE ACROSS THE KNOB WOULD MEAN THE FIXTURE `
     + `IS UNWIRED, and "no lines" would be indistinguishable from "the click did nothing"`,
     JSON.stringify(b));
}
for (const a of ARMS) {
  const x = R[a.key];
  ok(x.verdict === 'RAN' && x.turns >= 2, 'both scripted turns were played — ' + a.key, 'turns ' + x.turns);
  const bad = (x.seen || []).filter(y => JSON.stringify(y.sd) !== JSON.stringify(y.me));
  ok(bad.length === 0, 'the CONSEQUENCE agrees between the engines at every boundary — ' + a.key,
     bad.map(y => 't' + y.turn + ' sd=' + JSON.stringify(y.sd) + ' me=' + JSON.stringify(y.me)).join(' ; '));
}

/* -- 2. THE BOARD. It is identical either way round, which is the whole reason this needed a
 * protocol probe rather than a board one. ------------------------------------------------------- */
for (const a of ARMS) {
  const bad = (R[a.key].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a.key,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 3. THE NARRATION, compared as a SEQUENCE with no typed expectation. ------------------------- */
for (const a of ARMS) {
  const x = R[a.key], p = x.sd2.join('  '), q = x.me2.join('  ');
  ok(p === q, `NARRATION identical — ${a.key}`,
     p === q ? '' : 'authority [' + p + ']\n          ours      [' + q + ']');
}

/* -- 4. THE DEFECT, NAMED, and spelled without naming Mental Herb or either volatile: "the ORDER of
 * the `-enditem` and the `-end` is the same in both engines". Any item that frees a volatile trips
 * this, and the control arms carry the same clause so an engine that emitted neither cannot pass by
 * having nothing to order. */
const order = lines => (lines || []).map((l, i) => [l.split('|')[1], i])
  .filter(([e]) => e === '-enditem' || e === '-end').map(([e]) => e).join(' -> ');
for (const a of ARMS) {
  const p = order(R[a.key].sd2), q = order(R[a.key].me2);
  ok(p === q, `the \`-enditem\` / \`-end\` ORDER matches — ${a.key}`,
     p === q ? '' : 'authority [' + (p || '(neither)') + ']  ours [' + (q || '(neither)') + ']');
}
for (const m of MEMBERS) {
  ok(order(R[m.key + ':herb'].sd2) === '-enditem -> -end',
     `the AUTHORITY really does spend the item FIRST — ${m.key} (asserted on the authority so the `
     + `clause above cannot pass by both engines being wrong the same way)`,
     order(R[m.key + ':herb'].sd2));
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
