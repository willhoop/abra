/* probe_volatile_start_field.js — A VOLATILE'S `-start` LINE CAN CARRY A VALUE THE CONDITION READS
 * AT RUN TIME, AND DISABLE IS THE ONE THAT ALWAYS DOES.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_volatile_start_field.js
 *   ... --arm bottom-tie-first        (the default)
 *
 * ================= THE RULE, AND WHY IT IS TWO MEMBERS AND NOT FIFTY-SEVEN ======================
 *
 * `applyMoveVolatile` announces a volatile from `data/tags.json`'s `volatileAnnounce`, and that table
 * is DELIBERATELY NARROW: it claims a condition only when the whole `onStart` is one unconditional
 * `this.add(...)`, or when there is no `onStart` at all. Everything else keeps the generic
 * `|-start|BODY|move: <volatile>`, which is right for 23 of them — Taunt included, and Taunt is the
 * reason the narrowness exists rather than an accident of it.
 *
 * That table has no way to express a line whose FIELD 4 is computed. Scanned over the 57 volatiles a
 * legal move can apply in this regulation, exactly TWO conditions write one:
 *
 *     disable   this.add('-start', pokemon, 'Disable', pokemon.lastMove.name …)   BOTH branches
 *     charge    this.add('-start', pokemon, 'Charge',  this.activeMove.name …)    ONE branch of two
 *
 * and the difference decides which is claimable. Disable writes the sealed move's name whatever
 * applied it, so the field is unconditional and can be tabled. Charge writes it ONLY when an ability
 * banked the charge; the CHARGE MOVE's own branch is bare, so a table entry would put a move name on
 * a line the authority leaves empty. The ability branch of Charge is already emitted by its own site
 * in `medicham2-browser.js` (the `buffsHolderOnHit` block) and is NOT touched here.
 *
 * So the derivation rule is "EVERY `-start` this condition writes carries the SAME runtime argument",
 * which admits Disable and refuses Charge by construction rather than by a name list. Both members
 * are printed on every `tag_dex` run.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 *     showdown   |-start|p2a: Feraligatr|Disable|Aqua Tail
 *     medicham   |-start|p2a: Feraligatr|move: disable
 *
 * The seal itself was right — the right move, on the right body, for the right number of turns. Only
 * the line was wrong, in TWO fields: the label carried a `move: ` namespace the condition does not
 * use, and the sealed move was missing entirely.
 *
 * ================= THE CONTROL IS A DIFFERENT VOLATILE, NOT A DIFFERENT TARGET ==================
 *
 * The knob is WHICH STATUS MOVE IS CLICKED, and the control arm clicks TAUNT — a volatile whose
 * `onStart` is guarded and therefore keeps the generic line. That is the strongest control available
 * here, because the failure mode of this fix is putting a runtime field on `-start` lines that must
 * not have one: an engine that did that passes the Disable arm and fails the Taunt arm.
 *
 * NOTHING about what either line should say is typed. Both engines play the identical scripted turns
 * under identical pinned dice and the turn's protocol is compared as a SEQUENCE.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * Disable is 1,799 clicks in 64,846 stored games, so the LAB must move and the pinned pool may. The
 * board is expected to be IDENTICAL on every arm before and after: this is a narration fix, and an
 * arm whose board moves is a red flag rather than a success.
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

const mon = (species, ability, moves) => ({ species, item: '', ability, moves });

/* ---- THE CAST ---------------------------------------------------------------------------------
 * ALAKAZAM clicks the status move; it learns both Disable and Taunt legally, so one body serves both
 * arms and the cast is identical across the knob.
 * FERALIGATR is the target and it MUST have moved before the click: `disable.onTryHit` returns false
 * on `!target.lastMove`, so turn 1 exists to give it a `lastMove` and turn 2 is the arm.
 * x6 HP on both sides — nothing may faint, because a faint forces a switch and the replacement
 * becomes the thing under test. */
const CLICKER = 'alakazam', TARGET = 'feraligatr';
const ARMS = [{ key: 'disable', move: 'Disable', why: 'the condition names the SEALED MOVE in field 4' },
              { key: 'taunt', move: 'Taunt', why: 'CONTROL — a guarded onStart keeps the generic line' }];
const HIT = 'Aqua Tail', IDLE = 'Calm Mind';
const HP_BOOST = 6;
const BENCH_P1 = [['toxapex', 'Iron Defense'], ['milotic', 'Recover']];
const BENCH_P2 = [['corviknight', 'Iron Defense'], ['pinsir', 'Swords Dance']];

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [[CLICKER, IDLE], [TARGET, HIT], ['clefable', IDLE],
                  ...ARMS.map(a => [CLICKER, a.move]), ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const p1Team = click => [mon(CLICKER, 'Synchronize', [IDLE, click]),
                         mon('clefable', 'Magic Guard', [IDLE]),
                         ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const TEAM_P2 = [mon(TARGET, 'Torrent', [HIT]), mon('alakazam', 'Synchronize', [IDLE]),
                 ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

const script = click => [
  { p1: [{ m: IDLE }, { m: IDLE }], p2: [{ m: HIT, t: 0 }, { m: IDLE }] },
  { p1: [{ m: click, t: 0 }, { m: IDLE }], p2: [{ m: HIT, t: 0 }, { m: IDLE }] },
];

/* Showdown's log carries the SECRET and SHARED form of one event (the `|split|` pair), a `|split|`
 * marker line and a bare timestamp line, none of which medicham2 emits. Those three shapes are
 * dropped; EVERY OTHER FIELD IS COMPARED, because the fields are the whole question here.
 *
 * A BODY OR A SIDE IS COMPARED BY ITS SLOT AND NEVER BY ITS DISPLAY NAME. */
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
const sdVol = battle => {
  const p = battle && battle.p2 && battle.p2.active && battle.p2.active[0];
  const v = p && p.volatiles;
  if (!v) return null;
  return { disable: v.disable ? String(v.disable.move || 'yes') : null, taunt: !!v.taunt };
};
const meVol = S => {
  const m = S && S.actB && S.actB[0];
  if (!m) return null;
  return { disable: (m._vol && m._vol.disable > 0) ? String(m._sealed || 'yes') : null,
           taunt: !!(m._vol && m._vol.taunt > 0) };
};

function run(click, tag) {
  const a = G.buildPair(p1Team(click), { hpBoost: HP_BOOST }),
        b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'volatile-start-field', tag, {
    script: script(click), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical, sd: sdVol(battle), me: meVol(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  const out = { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen };
  for (const t of [1, 2]) { out['sd' + t] = stream(sd, t); out['me' + t] = stream(me, t); }
  return out;
}

console.log('\nTHE `-start` FIELD A CONDITION FILLS AT RUN TIME\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  restore knob MEDI_VOL_START_ARG_BLIND=' + (process.env.MEDI_VOL_START_ARG_BLIND || '(off)'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const R = {};
for (const a of ARMS) R[a.key] = run(a.move, a.key);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const a of ARMS) {
  const x = R[a.key];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + CLICKER.toUpperCase() + ' CLICKS ' + a.move.toUpperCase() + '   [' + a.why + ']');
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  for (const t of [1, 2]) {
    console.log(`  turn ${t}  showdown  ` + (x['sd' + t].join('  ') || '(none)'));
    console.log(`  turn ${t}  medicham  ` + (x['me' + t].join('  ') || '(none)'));
  }
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
  console.log('  target volatiles  showdown ' + JSON.stringify(x.seen.map(y => y.sd))
    + '\n                    medicham ' + JSON.stringify(x.seen.map(y => y.me)));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const last = k => { const s = R[k].seen || []; return s[s.length - 1] || {}; };

/* -- 1. THE FIXTURE, read off the AUTHORITY's own state. ----------------------------------------- */
ok(!!(last('disable').sd || {}).disable,
   'the AUTHORITY sealed a move on the Disable arm — the fixture reaches the mechanic at all',
   JSON.stringify(last('disable').sd));
ok(!(last('taunt').sd || {}).disable && (last('taunt').sd || {}).taunt === true,
   'the AUTHORITY applied TAUNT and NO disable on the control arm — IDENTICAL STATE ACROSS THE KNOB '
   + 'WOULD MEAN THE FIXTURE IS UNWIRED', JSON.stringify(last('taunt').sd));
for (const a of ARMS) {
  const x = R[a.key];
  ok(x.verdict === 'RAN' && x.turns >= 2, 'both scripted turns were played — ' + a.key,
     'turns ' + x.turns);
  const bad = (x.seen || []).filter(y => JSON.stringify(y.sd) !== JSON.stringify(y.me));
  ok(bad.length === 0, 'the CONSEQUENCE agrees between the engines at every boundary — ' + a.key,
     bad.map(y => 't' + y.turn + ' sd=' + JSON.stringify(y.sd) + ' me=' + JSON.stringify(y.me)).join(' ; '));
}

/* -- 2. THE BOARD. ------------------------------------------------------------------------------ */
for (const a of ARMS) {
  const bad = (R[a.key].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a.key,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 3. THE NARRATION, compared as a SEQUENCE with no typed expectation. ------------------------- */
for (const a of ARMS) for (const t of [1, 2]) {
  const x = R[a.key], p = x['sd' + t].join('  '), q = x['me' + t].join('  ');
  ok(p === q, `NARRATION identical — ${a.key}, turn ${t}`,
     p === q ? '' : 'authority [' + p + ']\n          ours      [' + q + ']');
}

/* -- 4. THE DEFECT, NAMED, and spelled without naming Disable: "the two engines write the same
 * `-start` lines" is a predicate any volatile trips. The control arm carries the same clause, which
 * is what stops a fix that puts a runtime field on every start line from reading as a pass. */
const starts = lines => (lines || []).filter(l => /^\|-start\|/.test(l)).sort().join('  ');
for (const a of ARMS) {
  const p = starts(R[a.key].sd2), q = starts(R[a.key].me2);
  ok(p === q, `the \`-start\` lines of the arm turn match — ${a.key}`,
     p === q ? '' : 'authority [' + (p || '(none)') + ']\n          ours      [' + (q || '(none)') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
