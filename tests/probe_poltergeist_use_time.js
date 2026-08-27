/* probe_poltergeist_use_time.js — DOES THE ITEM CHECK READ THE SLOT AT USE TIME, OR AT BUILD TIME?
 *
 *   SHOWDOWN_PATH=... node tests/probe_poltergeist_use_time.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= WHAT THIS ADDS THAT tests/probe_poltergeist_item_line.js DOES NOT ==============
 *
 * That file stages TWO boards — a target holding an item and a target holding nothing — and both are
 * decided BEFORE the turn starts. Neither can tell the difference between an engine that asks
 * "does this body hold something?" at the moment the move resolves and one that answered the same
 * question when the team was built. This one moves the item DURING the turn, ahead of the click.
 *
 * ================= THE RULE, READ OFF THE FORMAT ================================================
 *
 *     data/moves.ts:13607-13612, and `/data/mods/champions/moves.ts` does NOT override poltergeist:
 *       onTry(source, target)          { return !!target.item; }
 *       onTryHit(target, source, move) { this.add('-activate', target, 'move: Poltergeist',
 *                                                 this.dex.items.get(target.item).name); }
 *
 * `onTry` runs inside `useMove`, i.e. when the ACTION comes out of the queue — not when the queue is
 * built. So an item removed earlier in the SAME turn refuses the move, and an engine that snapshotted
 * the field at the top of the turn would announce a Sitrus Berry that is already on the floor.
 *
 * ================= THE THREE ARMS, AND WHY THE FIRST TWO ARE HERE ================================
 *
 *   held      — nobody touches the item. The move connects and names it.   KNOWN-GOOD CONTROL.
 *   empty     — the target starts with nothing. The move fails.            KNOWN-GOOD CONTROL.
 *   stripped  — the target STARTS holding the item and a faster ally of the clicker knocks it off
 *               earlier in the same turn. THE ARM UNDER TEST.
 *
 * The two controls are not decoration. A probe whose only arm is the new one cannot distinguish
 * "the engine got the timing right" from "the engine cannot do Poltergeist at all", and seventeen
 * instrument failures in two days here were green arms that had staged nothing.
 *
 * ================= WHAT MAKES THE ARM REAL, ASSERTED RATHER THAN ASSUMED ========================
 *
 *   - the remover must MOVE FIRST. Read out of the AUTHORITY's own `|move|` order, never off the
 *     speed numbers this file computed — an engine and a probe agreeing about speed proves nothing.
 *   - the item must be GONE by the time the click resolves. Read out of the authority's own body.
 *   - the click must reach the authority AS Poltergeist. A move that is not on the request resolves
 *     to `pass` (`scriptMoveNotOnRequest`), which is green and empty.
 *   - the DAMAGE must differ across the knob. Poltergeist deals its 110 BP on `held` and nothing on
 *     `stripped`; identical damage across a varied knob means the knob is unwired.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * A LAB fixture. Poltergeist is 447 of the 13,214 pinned-pool games and Knock Off is in most of them,
 * but the co-occurrence in ONE turn is rare — expect the census to move and the pinned pool to sit
 * still. Nothing here is a fix; this pass only stages.
 *
 * IT WRITES NOTHING. No artifact is touched. It asserts and exits non-zero on a failure.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

/* Self-applied preload — see probe_refill_entry_herb.js's header. `game_differential.js` cuts a
 * release into the real store at require time when `--release` is absent, and requiring this first
 * redirects it, while keeping the command a plain `node tests/<it>.js` that register_reality can run. */
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

/* ---- THE CAST -------------------------------------------------------------------------------- */
/* CLICKER sits at slot 0 and REMOVER at slot 1 of the same side, because `spreadFor` hands slot 0
 * 32 Speed points and slot 1 only 22 — so the remover has to out-base-speed the clicker by more than
 * ten points. Banette (base 65) and Weavile (base 125) clear that by a mile, and the ORDER IS STILL
 * ASSERTED off the authority's log rather than trusted to this paragraph. */
const CLICKER = 'Banette', CLICK = 'Poltergeist';
const REMOVER = 'Weavile', STRIP = 'Knock Off';
const TARGET = 'Feraligatr', TARGET_MOVE = 'Aqua Tail';
const ITEM = 'sitrusberry';
/* x6 HP so neither the 110 BP hit nor the boosted Knock Off can take the holder under half and set
 * the Sitrus Berry off — an `-enditem [eat]` in the middle of the arm would be a second mechanic. */
const HP_BOOST = 6;
const IDLE_P1 = 'Swords Dance', IDLE_P2 = 'Calm Mind';
const ALLY_P2 = 'Alakazam';
const BENCH_P1 = [['Toxapex', 'Iron Defense'], ['Milotic', 'Recover']];
const BENCH_P2 = [['Corviknight', 'Iron Defense'], ['Pinsir', 'Swords Dance']];

console.log('\n  === THE CAST, CHECKED AGAINST THE AUTHORITY\'S OWN TeamValidator ===');
{
  let bad = 0;
  const claims = [[CLICKER, CLICK], [CLICKER, IDLE_P1], [REMOVER, STRIP], [REMOVER, IDLE_P1],
                  [TARGET, TARGET_MOVE], [ALLY_P2, IDLE_P2], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  /* NEVER TYPE A SPECIES KEY — mc_key throws by name on a spelling this engine has no row for. */
  for (const sp of [CLICKER, REMOVER, TARGET, ALLY_P2, ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    const k = mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' });
    if (!k) { console.log('  NO ENGINE ROW for ' + sp); bad++; }
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const TEAM_P1 = [mon(CLICKER, 'Insomnia', [CLICK, IDLE_P1]),
                 mon(REMOVER, 'Pressure', [STRIP, IDLE_P1]),
                 ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const teamP2 = item => [mon(TARGET, 'Torrent', [TARGET_MOVE], item),
                        mon(ALLY_P2, 'Synchronize', [IDLE_P2]),
                        ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

/* p1 slot0 clicks Poltergeist at p2 slot0; p1 slot1 either idles (control) or strips first. */
const script = strip => [{ p1: [{ m: CLICK, t: 0 }, strip ? { m: STRIP, t: 0 } : { m: IDLE_P1 }],
                           p2: [{ m: TARGET_MOVE, t: 1 }, { m: IDLE_P2 }] }];

/* ---- THE PROTOCOL REDUCER — the same equivalences game_differential.js itself applies ---------- */
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
/* The RAW authority slice, un-deduplicated and un-normalised, for the order receipt. */
const rawMoveOrder = lines => turnSlice(lines, 1).filter(l => l.startsWith('|move|'))
  .map(l => l.split('|')[3]).map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, ''));

const sdHp = b => { const p = b && b.p2 && b.p2.active && b.p2.active[0]; return p ? p.hp : null; };
const meHp = S => { const m = S && S.actB && S.actB[0]; return m ? m.curHP : null; };
const sdItem = b => { const p = b && b.p2 && b.p2.active && b.p2.active[0]; return p ? String(p.item || '') : null; };
const meItem = S => { const m = S && S.actB && S.actB[0]; return m ? String(m.item || '') : null; };

function run(item, strip, tag) {
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }), b = G.buildPair(teamP2(item), { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'poltergeist-use-time', tag, {
    script: script(strip), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sdHp: sdHp(battle), meHp: meHp(S), sdItem: sdItem(battle), meItem: meItem(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sc: G.scriptCounters ? G.scriptCounters() : null,
           order: rawMoveOrder(sd), sd1: stream(sd, 1), me1: stream(me, 1) };
}

console.log('\nPOLTERGEIST READS THE SLOT AT USE TIME — an item that left earlier this turn refuses it\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = [
  { key: 'held',     item: ITEM, strip: false, label: 'HELD — nobody touches the item  (KNOWN-GOOD CONTROL)' },
  { key: 'empty',    item: '',   strip: false, label: 'EMPTY — the target never held one (KNOWN-GOOD CONTROL)' },
  { key: 'stripped', item: ITEM, strip: true,  label: 'STRIPPED — the ' + STRIP + ' lands FIRST, same turn  (UNDER TEST)' },
];
const R = {};
for (const a of ARMS) R[a.key] = run(a.item, a.strip, a.key);

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
  console.log('  authority move order  ' + JSON.stringify(x.order));
  console.log('  turn 1  showdown  ' + (x.sd1.join('  ') || '(none)'));
  console.log('  turn 1  medicham  ' + (x.me1.join('  ') || '(none)'));
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
  console.log('  target hp  sd [' + x.seen.map(y => y.sdHp).join(', ') + ']  me [' + x.seen.map(y => y.meHp).join(', ')
    + ']   item sd ' + JSON.stringify(x.seen.map(y => y.sdItem)) + '  me ' + JSON.stringify(x.seen.map(y => y.meItem)));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const at = (k, t) => (R[k].seen || []).find(y => y.turn === t) || {};
const drop = k => { const a = at(k, 0), b = at(k, 1); return (a.sdHp != null && b.sdHp != null) ? a.sdHp - b.sdHp : null; };

/* -- 1. THE FIXTURE ----------------------------------------------------------------------------- */
for (const a of ARMS) {
  const x = R[a.key];
  ok(x.verdict === 'RAN' && x.turns >= 1, 'the scripted turn was played — ' + a.key, 'turns ' + x.turns);
  ok(x.sc && x.sc.moveNotOnRequest === 0,
     'every scripted click was on the AUTHORITY\'s request — ' + a.key
     + ' (a click that is not resolves to `pass`, and the arm measures nothing)',
     x.sc ? JSON.stringify(x.sc) : 'no counters');
  ok((x.order || []).includes('poltergeist'),
     'the click reached the AUTHORITY as Poltergeist — ' + a.key, JSON.stringify(x.order));
}
ok(at('held', 0).sdItem === ITEM && at('empty', 0).sdItem === '' && at('stripped', 0).sdItem === ITEM,
   'the ITEM knob reached the AUTHORITY\'s own body at turn 0',
   'held ' + JSON.stringify(at('held', 0).sdItem) + '  empty ' + JSON.stringify(at('empty', 0).sdItem)
   + '  stripped ' + JSON.stringify(at('stripped', 0).sdItem));

/* THE ARM'S OWN PRECONDITION, off the AUTHORITY and not off this file's speed arithmetic. */
{
  const o = R.stripped.order || [];
  const iK = o.indexOf('knockoff'), iP = o.indexOf('poltergeist');
  ok(iK >= 0 && iP >= 0 && iK < iP,
     'the AUTHORITY resolved the strip BEFORE the click, in the same turn — this is the whole arm',
     'order ' + JSON.stringify(o));
  ok(at('stripped', 1).sdItem === '',
     'and the AUTHORITY\'s own body is empty-handed by the end of that turn',
     'item ' + JSON.stringify(at('stripped', 1).sdItem));
}

/* THE KNOB MOVED THE OUTCOME. `held` takes 110 BP plus a Knock Off; `stripped` takes only the Knock
 * Off, because the click was refused. Identical damage across the knob would mean it is unwired. */
ok(drop('empty') === 0, 'EMPTY took no damage at all — `onTry` really refused', 'drop ' + drop('empty'));
ok(drop('held') > 0, 'HELD took the hit', 'drop ' + drop('held'));
ok(drop('stripped') > 0 && drop('stripped') < drop('held'),
   'STRIPPED took the strip and NOT the click — strictly less than HELD, strictly more than EMPTY. '
   + 'IDENTICAL DAMAGE ACROSS THIS KNOB WOULD MEAN THE ARM IS UNWIRED',
   'held ' + drop('held') + '  stripped ' + drop('stripped') + '  empty ' + drop('empty'));

/* -- 2. THE BOARD — Will's bar. ----------------------------------------------------------------- */
for (const a of ARMS) {
  const bad = (R[a.key].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a.key,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
  const hp = (R[a.key].seen || []).filter(y => y.sdHp !== y.meHp);
  ok(hp.length === 0, 'the two engines agree about the damage — ' + a.key,
     hp.map(y => 't' + y.turn + ' sd=' + y.sdHp + ' me=' + y.meHp).join(' ; '));
}

/* -- 3. THE NARRATION, as a SEQUENCE, with nothing typed about what it should say. ---------------- */
for (const a of ARMS) {
  const x = R[a.key], p = x.sd1.join('  '), q = x.me1.join('  ');
  ok(p === q, 'NARRATION identical — ' + a.key,
     p === q ? '' : 'authority [' + p + ']\n          ours      [' + q + ']');
}

/* -- 4. THE CLAUSE, SPELLED WITHOUT NAMING THE MOVE: an item the target no longer holds is never
 * announced. Both engines are asked the same question; neither is compared to a typed string. */
for (const a of ARMS) {
  const acts = ls => (ls || []).filter(l => /^\|-activate\|/.test(l)).sort().join('  ');
  const p = acts(R[a.key].sd1), q = acts(R[a.key].me1);
  ok(p === q, 'the `-activate` lines match — ' + a.key,
     p === q ? '' : 'authority [' + (p || '(none)') + ']\n          ours      [' + (q || '(none)') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
