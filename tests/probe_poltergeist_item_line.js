/* probe_poltergeist_item_line.js — A MOVE THAT READS THE TARGET'S ITEM ANNOUNCES WHAT IT FOUND,
 * BEFORE IT DOES ANYTHING WITH IT.  (ROADMAP #359)
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_poltergeist_item_line.js
 *   ... --arm bottom-tie-first        (the default)
 *
 * ================= THE RULE, DERIVED FROM THE FORMAT =============================================
 *
 *     data/moves.ts:13607-13612, and `/data/mods/champions/moves.ts` does NOT override poltergeist:
 *
 *       onTry(source, target)          { return !!target.item; }
 *       onTryHit(target, source, move) { this.add('-activate', target, 'move: Poltergeist',
 *                                                 this.dex.items.get(target.item).name); }
 *
 * TWO CLAUSES, ONE ALREADY LANDED. The refusal (`onTry` against an item-less target) has been wired
 * since WIRE 47's neighbour block, off `readsTargetItem {failsIfNone: true}`. The ANNOUNCEMENT was
 * never emitted at all, and ROADMAP #359 files exactly that half.
 *
 * MEMBERSHIP PRINTED OVER THE WHOLE MOVE TABLE BEFORE THE PARAM WAS DERIVED: of the moves this
 * regulation admits, exactly ONE announces an item name out of a handler, and it is Poltergeist.
 * (`readsTargetItem` has two carriers — Knock Off is the other, and it announces nothing at try
 * time — so a rule written off the tag alone would have put a line on 3,834 Knock Offs.)
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 *     showdown   |-activate|p2a: Feraligatr|move: Poltergeist|Sitrus Berry
 *                |-supereffective|p2a: Feraligatr|1  |-damage|…
 *     medicham   |-supereffective|p2a: Feraligatr|1  |-damage|…
 *
 * The damage and the refusal were right. The line was absent, and because it is the FIRST thing the
 * move writes it truncates the comparison of every game it appears in.
 *
 * ================= THE NEGATIVE IS THE OTHER CLAUSE OF THE SAME HANDLER ==========================
 *
 * `onTryHit` runs only if `onTry` returned true, so an ITEM-LESS target gets a `-fail` and NO
 * `-activate`. That is the control arm: the same Banette clicking the same move at the same
 * Feraligatr, differing only in whether it is holding anything. An engine that announced
 * unconditionally would pass the item arm and fail here, and an engine that announced the wrong item
 * would pass a bare "a line exists" check — which is why the arm compares the FIELDS.
 *
 * NOTHING about what the line should say is typed. Both engines play the identical scripted turn
 * under identical pinned dice and the turn's protocol is compared as a SEQUENCE.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * Poltergeist is 1,383 clicks in 64,846 stored games, so the LAB must move and the pinned pool may.
 * The BOARD must be identical on every arm before and after — this is an emission fix.
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
 * BANETTE clicks it. Aegislash was rejected deliberately: Stance Change puts a `-formechange` in the
 * middle of the very turn under test, and a probe whose subject changes shape mid-arm is measuring
 * two things. Banette's mega needs a stone and the sheet carries none, and a SCRIPTED game never
 * auto-megas (game_differential.js skips the auto-mega block wholesale on a script).
 * SITRUS BERRY is the item, at x6 HP so the 110 BP hit cannot take the holder under half and set the
 * berry off — an `-enditem` in the middle of the arm would be a second mechanic. */
const CLICKER = 'banette', CLICK = 'Poltergeist', TARGET = 'feraligatr', ITEM = 'sitrusberry';
const IDLE = 'Calm Mind', SUBJ_IDLE = 'Swords Dance';
const HP_BOOST = 6;
const BENCH_P1 = [['toxapex', 'Iron Defense'], ['milotic', 'Recover']];
const BENCH_P2 = [['corviknight', 'Iron Defense'], ['pinsir', 'Swords Dance']];

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [[CLICKER, CLICK], [CLICKER, SUBJ_IDLE], [TARGET, 'Aqua Tail'],
                  ['clefable', IDLE], ['alakazam', IDLE], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const TEAM_P1 = [mon(CLICKER, 'Insomnia', [CLICK, SUBJ_IDLE]),
                 mon('clefable', 'Magic Guard', [IDLE]),
                 ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const p2Team = item => [mon(TARGET, 'Torrent', ['Aqua Tail'], item),
                        mon('alakazam', 'Synchronize', [IDLE]),
                        ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

const SCRIPT = [{ p1: [{ m: CLICK, t: 0 }, { m: IDLE }], p2: [{ m: 'Aqua Tail', t: 1 }, { m: IDLE }] }];

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

/* THE CONSEQUENCE — did the click CONNECT — read out of each engine's own state and not from a line.
 * The item arm must deal damage; the item-less arm must deal none, because the move failed. */
const sdHp = battle => { const p = battle && battle.p2 && battle.p2.active && battle.p2.active[0];
                         return p ? p.hp : null; };
const meHp = S => { const m = S && S.actB && S.actB[0]; return m ? m.curHP : null; };

function run(item, tag) {
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }),
        b = G.buildPair(p2Team(item), { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'poltergeist-item-line', tag, {
    script: SCRIPT, arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical, sdHp: sdHp(battle), meHp: meHp(S),
                  sdItem: (() => { const p = battle.p2.active[0]; return p ? String(p.item || '') : null; })(),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sd1: stream(sd, 1), me1: stream(me, 1) };
}

console.log('\nPOLTERGEIST NAMES THE ITEM IT FOUND — and says nothing when there is none\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  restore knob MEDI_ITEM_READ_SILENT=' + (process.env.MEDI_ITEM_READ_SILENT || '(off)'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = [{ key: 'held', item: ITEM, label: 'THE TARGET IS HOLDING A ' + ITEM.toUpperCase() },
              { key: 'empty', item: '', label: 'THE TARGET HOLDS NOTHING  (CONTROL — onTry refuses)' }];
const R = {};
for (const a of ARMS) R[a.key] = run(a.item, a.key);

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
  console.log('  turn 1  showdown  ' + (x.sd1.join('  ') || '(none)'));
  console.log('  turn 1  medicham  ' + (x.me1.join('  ') || '(none)'));
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
  console.log('  target hp   showdown [' + x.seen.map(y => y.sdHp).join(', ')
    + ']   medicham [' + x.seen.map(y => y.meHp).join(', ') + ']   sd item '
    + JSON.stringify(x.seen.map(y => y.sdItem)));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const at = (k, t) => (R[k].seen || []).find(y => y.turn === t) || {};
const drop = k => { const a = at(k, 0), b = at(k, 1); return (a.sdHp != null && b.sdHp != null) ? a.sdHp - b.sdHp : null; };

/* -- 1. THE FIXTURE, read off the AUTHORITY's own state and never off a line. -------------------- */
ok(at('held', 0).sdItem === ITEM && at('empty', 0).sdItem === '',
   'the ITEM knob reached the AUTHORITY\'s own body — held ' + JSON.stringify(at('held', 0).sdItem)
   + ', empty ' + JSON.stringify(at('empty', 0).sdItem));
ok(drop('held') > 0, 'the AUTHORITY\'s click CONNECTED on the held arm', 'hp drop ' + drop('held'));
ok(drop('empty') === 0,
   'and dealt NOTHING on the empty arm — `onTry` refused it, so the negative is a real refusal and '
   + 'not an unreached branch. IDENTICAL DAMAGE ACROSS THE KNOB WOULD MEAN THE FIXTURE IS UNWIRED',
   'hp drop ' + drop('empty'));
for (const a of ARMS) {
  const x = R[a.key];
  ok(x.verdict === 'RAN' && x.turns >= 1, 'the scripted turn was played — ' + a.key, 'turns ' + x.turns);
  ok((x.sd1 || []).some(l => /^\|move\|/.test(l) && /poltergeist/.test(l)),
     'the click actually reached the AUTHORITY as Poltergeist — ' + a.key
     + ' (a move not on the request resolves to `pass` and the arm would measure nothing)');
  const bad = (x.seen || []).filter(y => y.sdHp !== y.meHp);
  ok(bad.length === 0, 'the two engines agree about the damage — ' + a.key,
     bad.map(y => 't' + y.turn + ' sd=' + y.sdHp + ' me=' + y.meHp).join(' ; '));
}

/* -- 2. THE BOARD. ------------------------------------------------------------------------------ */
for (const a of ARMS) {
  const bad = (R[a.key].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a.key,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 3. THE NARRATION, compared as a SEQUENCE with no typed expectation. ------------------------- */
for (const a of ARMS) {
  const x = R[a.key], p = x.sd1.join('  '), q = x.me1.join('  ');
  ok(p === q, `NARRATION identical — ${a.key}`,
     p === q ? '' : 'authority [' + p + ']\n          ours      [' + q + ']');
}

/* -- 4. THE DEFECT, NAMED, and spelled without naming Poltergeist: "the two engines write the same
 * `-activate` lines". Both arms carry it, so an engine that announced unconditionally fails. */
const acts = lines => (lines || []).filter(l => /^\|-activate\|/.test(l)).sort().join('  ');
for (const a of ARMS) {
  const p = acts(R[a.key].sd1), q = acts(R[a.key].me1);
  ok(p === q, `the \`-activate\` lines match — ${a.key}`,
     p === q ? '' : 'authority [' + (p || '(none)') + ']\n          ours      [' + (q || '(none)') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
