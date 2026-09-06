/* probe_no_legal_target_fail.js — A MOVE WITH NOTHING LEFT TO AIM AT ANNOUNCES ITS OWN FAILURE
 *
 *   SHOWDOWN_PATH=... node tests/probe_no_legal_target_fail.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= THE RULE, READ OFF THE FORMAT ================================================
 *
 *     sim/battle-actions.ts:508-513, inside `useMoveInner`, on the NON-field branch:
 *       if (!targets.length) {
 *         this.battle.attrLastMove('[notarget]');
 *         this.battle.add(this.battle.gen >= 5 ? '-fail' : '-notarget', pokemon);
 *         return false;
 *       }
 *
 * A body whose every legal target died EARLIER IN THE SAME TURN therefore writes a bare
 * `|-fail|<mover>`. Faints are collected as the turn resolves and replacements are only asked for at
 * the end of it, so this is not an edge case at all: any doubles turn in which a spread move takes
 * both foes and a slower ally still has a click queued produces one.
 *
 * ================= WHAT THIS ENGINE DID ========================================================
 *
 * ROADMAP #84 already derived the rule and wired HALF of it. `medicham2-browser.js` computes
 * `_hadTargets` and, when it is false, sets `m._mvRes = false` — the Stomping Tantrum half — and
 * emits NOTHING. Its own comment quotes the authority's `add('-fail', pokemon)` in the line above.
 * **32 of the 130 protocol first-divergence rows on release `25dc68013c82` are a bare `|-fail|` this
 * engine never wrote** — the largest single bucket in the artifact, though not all 32 are this cause.
 *
 * ================= THE THREE ARMS, NONE OF THEM ON A DIE ========================================
 *
 *   no-targets  — a fast ally's spread move takes BOTH foes, and the slower prober's single-target
 *                 click has nothing left.                                            UNDER TEST.
 *   one-target  — the identical board; the ally takes ONE foe with a single-target move and the
 *                 prober aims at the survivor.                                 KNOWN-GOOD CONTROL.
 *   both-alive  — the identical board; the ally shields instead of attacking.  KNOWN-GOOD CONTROL.
 *
 * Both controls are the arms that a blanket "always print `-fail` when the aimed body is gone" would
 * break. Every move here is 100 accuracy (asserted below off the format), so no arm can be taken away
 * by a corner arm's roll — which is exactly how the sibling Poltergeist probe lost its control.
 *
 * THE ORDER IS ASSERTED OFF THE AUTHORITY'S OWN `|move|` SEQUENCE, never off this file's speed
 * arithmetic, and so is the fact that both foes were down before the prober clicked.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * PROTOCOL. A `-fail` line writes no board leaf, and `_mvRes` — the one piece of state involved — is
 * already set correctly by the existing half of ROADMAP #84. Expect BOARD-MATERIAL to sit still.
 * Said before the run.
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

const mon = (species, ability, moves) => ({ species, item: '', ability, moves });
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);

const SWEEPER = 'Typhlosion', SPREAD = 'Eruption', SINGLE = 'Flamethrower', SHIELD = 'Protect';
const PROBER = 'Snorlax', CLICK = 'Body Slam';
const F1 = 'Scizor', F2 = 'Abomasnow', IDLE_F1 = 'Iron Defense', IDLE_F2 = 'Curse';
const BENCH_P1 = [['Milotic', 'Recover'], ['Pinsir', 'Swords Dance']];
const BENCH_P2 = [['Corviknight', 'Iron Defense'], ['Torterra', 'Curse']];

console.log('\n  === THE CAST, CHECKED AGAINST THE FORMAT ===');
{
  let bad = 0;
  const claims = [[SWEEPER, SPREAD], [SWEEPER, SINGLE], [SWEEPER, SHIELD], [PROBER, CLICK],
                  [F1, IDLE_F1], [F2, IDLE_F2], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const good = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${good ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!good) bad++;
  }
  for (const sp of [SWEEPER, PROBER, F1, F2, ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    const k = mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' });
    if (!k) { console.log('  NO ENGINE ROW for ' + sp); bad++; }
  }
  /* EVERY CLICK MUST BE UNMISSABLE, or a corner arm can take an arm away without saying so. */
  for (const id of [SPREAD, SINGLE, CLICK]) {
    const m = DEX.moves.get(id);
    console.log('  ' + id + '  accuracy ' + m.accuracy + '  target ' + m.target);
    if (m.accuracy !== true && m.accuracy < 100) { console.log('    can miss — this arm would be a coin flip.'); bad++; }
  }
  /* THE CLICK MUST BE ON THE BRANCH THE RULE LIVES ON: `all`/`foeSide`/`allySide`/`allyTeam` go to
   * `tryMoveHit` and never reach the `-fail`. */
  if (['all', 'foeSide', 'allySide', 'allyTeam'].includes(DEX.moves.get(CLICK).target)) {
    console.log('  the prober\'s click is on the FIELD branch, which the rule does not cover.'); bad++;
  }
  console.log('  base speed: ' + SWEEPER + ' ' + DEX.species.get(SWEEPER).baseStats.spe
    + '  vs  ' + PROBER + ' ' + DEX.species.get(PROBER).baseStats.spe + ' (the ORDER is asserted off the authority)');
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

/* `Soundproof` rather than Snow Warning on the second foe, and `Swarm` rather than Technician on the
 * first: a weather setter would put a second mechanic inside the arm. Both are the species' own. */
const TEAM_P1 = [mon(SWEEPER, 'Blaze', [SPREAD, SINGLE, SHIELD]),
                 mon(PROBER, 'Thick Fat', [CLICK]),
                 ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const TEAM_P2 = [mon(F1, 'Swarm', [IDLE_F1]), mon(F2, 'Soundproof', [IDLE_F2]),
                 ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

const allyClick = arm => arm === 'no-targets' ? { m: SPREAD }
                       : arm === 'one-target' ? { m: SINGLE, t: 0 } : { m: SHIELD };
/* The prober aims at the SURVIVOR on the one-target arm and at slot 0 otherwise. */
const proberClick = arm => ({ m: CLICK, t: arm === 'one-target' ? 1 : 0 });
const script = arm => [{ p1: [allyClick(arm), proberClick(arm)],
                         p2: [{ m: IDLE_F1 }, { m: IDLE_F2 }] }];

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
  /* The differ's own declared equivalences: `source-tag` (:2156) drops `[of]`, `display-flags`
   * (:2171) drops the rendering hints, `move-target-field` (:2179) truncates the `|move|` line to
   * four fields — which is where `[notarget]` lands. A probe stricter than the measurement it
   * defends reports defects the measurement cannot see. */
  .filter(x => !/^\[of\]/.test(x) && !/^\[(silent|still|miss|spread|anim)\]/.test(x))
  .slice(0, (String(l).split('|')[1] === 'move') ? 4 : undefined).join('|');
/* `-ability` IS DROPPED WHOLE, and that is the differ's own rule rather than a convenience.
 * `game_differential.js`'s NORMALISATIONS table (:2139, `ability-announcement`) maps every
 * `|-ability|` line to null, on the argument that it is a COSMETIC announcement whose every
 * consequence is a separate line that IS kept. A probe that held on to it would report a
 * missing announcement as a divergence the measurement it defends cannot see — which this file
 * did, on a Pressure switch-in that has nothing to do with the mechanic under test. */
const SKIP_EVENT = new Set(['', 'split', 't:', '-ability']);
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
const stream = lines => turnSlice(lines, 1).map(norm);
const failLines = lines => stream(lines).filter(l => /^\|-fail\|/.test(l));
const moveOrder = lines => stream(lines).filter(l => /^\|move\|/.test(l)).map(l => l.split('|')[2] + ':' + l.split('|')[3]);
const faintOrder = lines => stream(lines).filter(l => /^\|faint\|/.test(l)).map(l => l.split('|')[2]);

const foeDown = (battle, i) => { const p = battle && battle.p2 && battle.p2.active && battle.p2.active[i];
                                 return p ? !!p.fainted : null; };
const meFoeDown = (S, i) => { const m = S && S.actB && S.actB[i]; return m ? !!m.fainted : null; };

function run(arm) {
  const a = G.buildPair(TEAM_P1, {}), b = G.buildPair(TEAM_P2, {});
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'no-legal-target', arm, {
    script: script(arm), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sdDown: [foeDown(battle, 0), foeDown(battle, 1)],
                  meDown: [meFoeDown(S, 0), meFoeDown(S, 1)],
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sc: G.scriptCounters ? G.scriptCounters() : null, sdAll: sd, meAll: me };
}

console.log('\nA MOVE WITH NOTHING LEGAL TO AIM AT WRITES `|-fail|<mover>` — `useMoveInner`, :508-513\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  knob MEDI_NO_TARGET_SILENT=' + (process.env.MEDI_NO_TARGET_SILENT || '0'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = ['no-targets', 'one-target', 'both-alive'];
const R = {}; for (const a of ARMS) R[a] = run(a);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const a of ARMS) {
  const x = R[a];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + a.toUpperCase() + (a === 'no-targets' ? '  (UNDER TEST)' : '  (KNOWN-GOOD CONTROL)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  console.log('  showdown  ' + (stream(x.sdAll).join('  ') || '(none)'));
  console.log('  medicham  ' + (stream(x.meAll).join('  ') || '(none)'));
  console.log('  foes down sd ' + JSON.stringify(x.seen.map(y => y.sdDown)) + '  me ' + JSON.stringify(x.seen.map(y => y.meDown)));
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the LINE');
console.log('='.repeat(98));

/* -- 1. THE FIXTURE ----------------------------------------------------------------------------- */
for (const a of ARMS) {
  const x = R[a];
  ok(x.verdict === 'RAN' && x.turns >= 1, 'the scripted turn was played — ' + a, 'turns ' + x.turns);
  ok(x.sc && x.sc.moveNotOnRequest === 0,
     'every scripted click was on the AUTHORITY\'s request — ' + a, x.sc ? JSON.stringify(x.sc) : 'no counters');
  ok(moveOrder(x.sdAll).some(l => l.endsWith(':' + CLICK.toLowerCase().replace(/ /g, ''))),
     'the prober\'s click reached the AUTHORITY — ' + a, moveOrder(x.sdAll).join('  '));
}
/* THE ARM'S PRECONDITION, off the AUTHORITY: the ally moved FIRST and BOTH foes were down. */
{
  const o = moveOrder(R['no-targets'].sdAll);
  const iA = o.findIndex(x => x.endsWith(':' + SPREAD.toLowerCase()));
  const iP = o.findIndex(x => x.endsWith(':' + CLICK.toLowerCase().replace(/ /g, '')));
  ok(iA >= 0 && iP >= 0 && iA < iP,
     'the AUTHORITY resolved the spread move BEFORE the prober\'s click, in the SAME turn — this is '
     + 'the whole arm, and it is read off its `|move|` order rather than off this file\'s speed table',
     o.join('  '));
  ok(faintOrder(R['no-targets'].sdAll).length === 2,
     'and BOTH foes were down before the click — one survivor and the arm stages nothing',
     'faints ' + JSON.stringify(faintOrder(R['no-targets'].sdAll)));
  ok(faintOrder(R['one-target'].sdAll).length === 1,
     'the ONE-TARGET control took exactly one foe, so the prober had a body to aim at',
     'faints ' + JSON.stringify(faintOrder(R['one-target'].sdAll)));
}

/* -- 2. THE BOARD — a missing line may not be hiding a missing effect. -------------------------- */
for (const a of ARMS) {
  const bad = (R[a].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 3. THE LINE ITSELF, and the two controls that stop it over-firing. ------------------------- */
ok(failLines(R['no-targets'].sdAll).length === 1,
   'the AUTHORITY writes exactly one `-fail` on the arm — if this fails, the rule is not the rule',
   JSON.stringify(failLines(R['no-targets'].sdAll)));
for (const a of ARMS) {
  const p = failLines(R[a].sdAll), q = failLines(R[a].meAll);
  ok(JSON.stringify(p) === JSON.stringify(q), 'the `-fail` lines match — ' + a,
     'authority ' + JSON.stringify(p) + '\n          ours      ' + JSON.stringify(q));
}
ok(failLines(R['one-target'].meAll).length === 0 && failLines(R['both-alive'].meAll).length === 0,
   'NEITHER control writes one — this is the clause a blanket "the aimed body is gone, so fail" breaks',
   'one-target ' + JSON.stringify(failLines(R['one-target'].meAll))
   + '  both-alive ' + JSON.stringify(failLines(R['both-alive'].meAll)));

/* -- 4. THE WHOLE TURN, line for line. ---------------------------------------------------------- */
for (const a of ARMS) {
  const sd = stream(R[a].sdAll), me = stream(R[a].meAll);
  ok(sd.join('  ') === me.join('  '), a.toUpperCase() + ' narration identical, line for line',
     'authority [' + sd.join('  ') + ']\n          ours      [' + me.join('  ') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
