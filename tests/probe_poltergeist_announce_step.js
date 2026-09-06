/* probe_poltergeist_announce_step.js — WHERE IN THE HIT STEPS DOES THE ITEM ANNOUNCEMENT SIT?
 *
 *   SHOWDOWN_PATH=... node tests/probe_poltergeist_announce_step.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= WHAT THIS ADDS THAT THE OTHER TWO POLTERGEIST PROBES DO NOT ==================
 *
 * `probe_poltergeist_item_line.js` asks WHETHER the line is written and `probe_poltergeist_use_time.js`
 * asks WHEN the item slot is READ. Both stage boards on which the move CONNECTS, so neither can see
 * the ordering defect at all: on a connected hit the line is written either way.
 *
 * ================= THE RULE, READ OFF THE FORMAT ================================================
 *
 *     data/moves.ts:13607-13612, and `/data/mods/champions/moves.ts` does NOT override poltergeist:
 *       onTry(source, target)          { return !!target.item; }
 *       onTryHit(target, source, move) { this.add('-activate', target, 'move: Poltergeist',
 *                                                 this.dex.items.get(target.item).name); }
 *
 * `onTry` and `onTryHit` are TWO DIFFERENT MOMENTS and this engine ran both at the first one:
 *
 *   - `onTry` is `singleEvent('Try', ...)` inside `useMove` (battle-actions.ts:590) — before any hit
 *     step. Its `false` is the `|-fail|` + `[still]` this engine already emits, correctly.
 *   - a MOVE's own `onTryHit` is `singleEvent('TryHit', moveData, {}, target, pokemon, move)` at
 *     battle-actions.ts:1044, inside `spreadMoveHit` — which `hitStepMoveHitLoop` calls, and that is
 *     the LAST entry in `moveSteps` (:556-577). So the announcement is BELOW, in order:
 *         0 invulnerability   1 TryHit (Protect, an absorbing ability)   2 type immunity
 *         3 move-specific immunity   4 accuracy   5 break-protect   6 steal-boosts
 *
 * A refused Poltergeist therefore names NOTHING. This engine announced above all seven gates, so a
 * Protected, immune or missed click still read out the item — 7 of the 151 protocol first-divergences
 * on release `db248fe67a5e`, in exactly those three shapes:
 *
 *     |-miss|p2b|p1a                        <> |-activate|p1a|poltergeist|charizarditey
 *     |-immune|p2a                          <> |-activate|p2a|poltergeist|focussash
 *     |-activate|p2a|move: Protect          <> |-activate|p2a|poltergeist|leftovers
 *
 * ================= THE FOUR ARMS, ALL DETERMINISTIC ============================================
 *
 *   connected     — the click lands.                       KNOWN-GOOD CONTROL: the line MUST still be
 *                   written, by both engines, in the same place. This is the arm that a
 *                   "just stop announcing it" fix fails.
 *   protected     — the target Protects (+4, so the shield is up first).   step 1.   UNDER TEST.
 *   immune        — the target is a NORMAL body and Poltergeist is Ghost.  step 2.   UNDER TEST.
 *   invulnerable  — the target is underground when the click resolves.     step 0.   UNDER TEST.
 *
 * NO ARM DEPENDS ON A DIE, AND THAT COST A REWRITE. Poltergeist is 90 accurate and the accuracy
 * stream is SHARED, so the first version of this file had its control MISS ALL THREE of its clicks on
 * `top-tie-first` — a corner arm takes the extreme roll every time, and a control that misses is not
 * a control. The clicker now carries NO GUARD, checked against the species' own row rather than
 * typed, which removes the die from three of the four arms; the fourth deliberately takes the ability
 * AWAY from the same body, because No Guard also bypasses semi-invulnerability and would erase it.
 *
 * Every arm holds an item, asserted off the AUTHORITY's own body — an empty-handed target is refused
 * by `onTry` and the arm would be testing the `-fail` road instead of the announcement.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * PROTOCOL. The line changes no board leaf: the move is refused either way and deals the same damage
 * (none). Expect protocol to fall by up to 7 and BOARD-MATERIAL to sit still. Said before the run.
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

/* THE CLICKER CARRIES NO GUARD ON THREE ARMS AND ITS OTHER LEGAL ABILITY ON THE FOURTH. Both are
 * checked against the species' own row rather than assumed, so a Champions change says so here. */
const CLICKER = 'Golurk', CLICK = 'Poltergeist', IDLE_P1 = 'Protect';
const NOGUARD = 'No Guard', PLAIN_AB = 'Iron Fist';
const ALLY_P1 = 'Weavile', IDLE_ALLY1 = 'Swords Dance';
const CLICK_TYPE = DEX.moves.get(CLICK).type;
const TARGET_HIT = 'Feraligatr', TARGET_IMM = 'Snorlax';
const IDLE_P2 = 'Curse', SHIELD = 'Protect', DIVE = 'Dig';
const ALLY_P2 = 'Alakazam', IDLE_ALLY2 = 'Calm Mind';
const ITEM = 'sitrusberry';
/* x6 HP so no hit can take a holder under half and set the berry off — an `-enditem [eat]` inside the
 * arm would be a second mechanic. */
const HP_BOOST = 6;
const BENCH_P1 = [['Toxapex', 'Iron Defense'], ['Milotic', 'Recover']];
const BENCH_P2 = [['Corviknight', 'Iron Defense'], ['Pinsir', 'Swords Dance']];

console.log('\n  === THE CAST, CHECKED AGAINST THE FORMAT: LEARNSETS, ABILITIES, TYPE CHART, SPEED ===');
{
  let bad = 0;
  const claims = [[CLICKER, CLICK], [CLICKER, IDLE_P1], [ALLY_P1, IDLE_ALLY1],
                  [TARGET_HIT, IDLE_P2], [TARGET_HIT, SHIELD], [TARGET_HIT, DIVE],
                  [TARGET_IMM, IDLE_P2], [ALLY_P2, IDLE_ALLY2], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const good = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${good ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!good) bad++;
  }
  for (const sp of [CLICKER, ALLY_P1, TARGET_HIT, TARGET_IMM, ALLY_P2,
                    ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    const k = mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' });
    if (!k) { console.log('  NO ENGINE ROW for ' + sp); bad++; }
  }
  /* THE TWO ABILITIES MUST BOTH BE LEGAL ON THE SAME BODY — that is what makes the fourth arm a knob
   * on ONE cast rather than a second, incomparable board. */
  const abs = Object.values(DEX.species.get(CLICKER).abilities || {});
  console.log('  ' + CLICKER + ' abilities ' + JSON.stringify(abs));
  for (const want of [NOGUARD, PLAIN_AB]) {
    const has = abs.some(x => DEX.toID(x) === DEX.toID(want));
    console.log('    carries ' + want + ' -> ' + has);
    if (!has) bad++;
  }
  const immOk = !DEX.getImmunity(CLICK_TYPE, DEX.species.get(TARGET_IMM).types);
  const hitOk = DEX.getImmunity(CLICK_TYPE, DEX.species.get(TARGET_HIT).types);
  console.log('  type chart: ' + CLICK_TYPE + ' -> ' + TARGET_IMM + ' ('
    + DEX.species.get(TARGET_IMM).types.join('/') + ') immune ' + immOk);
  console.log('  type chart: ' + CLICK_TYPE + ' -> ' + TARGET_HIT + ' ('
    + DEX.species.get(TARGET_HIT).types.join('/') + ') can be hit ' + hitOk);
  if (!immOk || !hitOk) { console.log('  the immunity arm is not an immunity in this format.'); bad++; }
  /* THE INVULNERABLE ARM NEEDS THE TARGET TO MOVE FIRST. Base speeds are printed here and the ORDER
   * IS STILL ASSERTED off the authority's own `|move|` sequence below — an engine and a probe
   * agreeing about speed proves nothing. */
  console.log('  base speed: ' + CLICKER + ' ' + DEX.species.get(CLICKER).baseStats.spe
    + '  vs  ' + TARGET_HIT + ' ' + DEX.species.get(TARGET_HIT).baseStats.spe);
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const teamP1 = arm => [mon(CLICKER, arm === 'invulnerable' ? PLAIN_AB : NOGUARD, [CLICK, IDLE_P1]),
                       mon(ALLY_P1, 'Pressure', [IDLE_ALLY1]),
                       ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const teamP2 = arm => [arm === 'immune' ? mon(TARGET_IMM, 'Thick Fat', [IDLE_P2], ITEM)
                                        : mon(TARGET_HIT, 'Torrent', [IDLE_P2, SHIELD, DIVE], ITEM),
                       mon(ALLY_P2, 'Synchronize', [IDLE_ALLY2]),
                       ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

const targetClick = arm => arm === 'protected' ? SHIELD : (arm === 'invulnerable' ? DIVE : IDLE_P2);
const script = arm => [{ p1: [{ m: CLICK, t: 0 }, { m: IDLE_ALLY1 }],
                         p2: [arm === 'invulnerable' ? { m: DIVE, t: 0 } : { m: targetClick(arm) },
                              { m: IDLE_ALLY2 }] }];

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
  /* THE `|move|` LINE IS TRUNCATED TO FOUR FIELDS, exactly as game_differential.js's declared
   * `move-target-field` normalisation does and as tests/probe_poltergeist_use_time.js already did.
   * `attrLastMove('[miss]')` APPENDS to the line already in the log rather than emitting an event, so
   * a probe that kept the fifth field would report `|move|...|[miss]` as a divergence the measurement
   * this file defends cannot see. A probe stricter than its own measurement invents defects. */
  .slice(0, (String(l).split('|')[1] === 'move') ? 4 : undefined).join('|');
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
 * body and this probe compares narration line for line. medicham2's trace carries no `|split|` at
 * all, so the loop is a no-op on our side. */
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
const polterLines = lines => stream(lines).filter(l => /^\|-activate\|/.test(l) && /poltergeist/.test(l));
const moveOrder = lines => stream(lines).filter(l => /^\|move\|/.test(l)).map(l => l.split('|')[2] + ':' + l.split('|')[3]);

const sdHp = b => { const p = b && b.p2 && b.p2.active && b.p2.active[0]; return p ? p.hp : null; };
const meHp = S => { const m = S && S.actB && S.actB[0]; return m ? m.curHP : null; };
const sdItem = b => { const p = b && b.p2 && b.p2.active && b.p2.active[0]; return p ? String(p.item || '') : null; };

function run(arm) {
  const a = G.buildPair(teamP1(arm), { hpBoost: HP_BOOST }), b = G.buildPair(teamP2(arm), { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'poltergeist-announce-step', arm, {
    script: script(arm), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical, sdHp: sdHp(battle), meHp: meHp(S),
                  sdItem: sdItem(battle),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sc: G.scriptCounters ? G.scriptCounters() : null, sdAll: sd, meAll: me };
}

console.log('\nTHE ITEM ANNOUNCEMENT IS A MOVE\'S OWN `onTryHit` — it sits BELOW every hit-step gate\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  knob MEDI_ITEM_ANNOUNCE_AT_USE=' + (process.env.MEDI_ITEM_ANNOUNCE_AT_USE || '0'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = ['connected', 'protected', 'immune', 'invulnerable'];
const R = {}; for (const a of ARMS) R[a] = run(a);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const a of ARMS) {
  const x = R[a];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + a.toUpperCase() + (a === 'connected' ? '  (KNOWN-GOOD CONTROL)' : '  (UNDER TEST)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  console.log('  showdown  ' + (stream(x.sdAll).join('  ') || '(none)'));
  console.log('  medicham  ' + (stream(x.meAll).join('  ') || '(none)'));
  console.log('  target hp sd [' + x.seen.map(y => y.sdHp).join(', ') + ']  me [' + x.seen.map(y => y.meHp).join(', ')
    + ']   item ' + JSON.stringify(x.seen.map(y => y.sdItem)));
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the CONTROL, then the three REFUSALS');
console.log('='.repeat(98));

const drop = k => { const s = R[k].seen; return (s[0] && s[1]) ? s[0].sdHp - s[1].sdHp : null; };

/* -- 1. THE FIXTURE ----------------------------------------------------------------------------- */
for (const a of ARMS) {
  const x = R[a];
  ok(x.verdict === 'RAN' && x.turns >= 1, 'the scripted turn was played — ' + a, 'turns ' + x.turns);
  ok(x.sc && x.sc.moveNotOnRequest === 0,
     'every scripted click was on the AUTHORITY\'s request — ' + a, x.sc ? JSON.stringify(x.sc) : 'no counters');
  ok(stream(x.sdAll).some(l => /^\|move\|p1a\|poltergeist/.test(l)),
     'the click reached the AUTHORITY as Poltergeist — ' + a, moveOrder(x.sdAll).join('  '));
  ok((x.seen[0] || {}).sdItem === ITEM,
     'the target was HOLDING something when the turn started — ' + a
     + ' (an empty-handed target is refused by `onTry` and the arm would test the -fail road instead)',
     JSON.stringify((x.seen[0] || {}).sdItem));
}
/* THE CONTROL LANDED AND EVERY REFUSAL REFUSED — read off the AUTHORITY's own damage, never its lines. */
ok(drop('connected') > 0, 'the CONTROL actually landed — the announcement is owed here, and the No '
   + 'Guard ability is what makes that true on EVERY differential arm', 'hp drop ' + drop('connected'));
for (const a of ['protected', 'immune', 'invulnerable'])
  ok(drop(a) === 0, a.toUpperCase() + ' took nothing at all', 'hp drop ' + drop(a));
ok(stream(R.protected.sdAll).some(l => /^\|-activate\|p2a\|protect/.test(l)),
   'the AUTHORITY put a shield up before the click resolved', stream(R.protected.sdAll).join('  '));
ok(stream(R.immune.sdAll).some(l => /^\|-immune\|p2a/.test(l)),
   'the AUTHORITY refused the click as an immunity', stream(R.immune.sdAll).join('  '));
{
  const o = moveOrder(R.invulnerable.sdAll);
  const iD = o.findIndex(x => x.endsWith(':' + DIVE.toLowerCase()));
  const iP = o.findIndex(x => x.endsWith(':' + CLICK.toLowerCase()));
  ok(iD >= 0 && iP >= 0 && iD < iP,
     'the AUTHORITY resolved the dive BEFORE the click — this is the whole invulnerable arm, and it '
     + 'is read off its `|move|` order rather than off this file\'s speed arithmetic', o.join('  '));
  ok(stream(R.invulnerable.sdAll).some(l => /^\|-miss\|p1a/.test(l)),
     'and the AUTHORITY refused the click as a MISS', stream(R.invulnerable.sdAll).join('  '));
}

/* -- 2. THE BOARD — Will's bar. A line moving must move no leaf. -------------------------------- */
for (const a of ARMS) {
  const bad = (R[a].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 3. THE CONTROL — the line is still written, and in the same place. -------------------------- */
{
  const p = polterLines(R.connected.sdAll), q = polterLines(R.connected.meAll);
  ok(p.length === 1 && JSON.stringify(p) === JSON.stringify(q),
     'CONNECTED still names the item, and the SAME line — this is the clause a "stop announcing" fix breaks',
     'authority ' + JSON.stringify(p) + '  ours ' + JSON.stringify(q));
}

/* -- 4. THE THREE REFUSALS — nothing may be named — and every arm compared line for line. -------- */
for (const a of ['protected', 'immune', 'invulnerable']) {
  ok(polterLines(R[a].sdAll).length === 0,
     'the AUTHORITY names nothing on the ' + a + ' arm — if this fails, the rule is not the rule',
     JSON.stringify(polterLines(R[a].sdAll)));
  ok(polterLines(R[a].meAll).length === 0, 'and neither does this engine — ' + a,
     JSON.stringify(polterLines(R[a].meAll)));
}
for (const a of ARMS) {
  const sd = stream(R[a].sdAll), me = stream(R[a].meAll);
  ok(sd.join('  ') === me.join('  '), a.toUpperCase() + ' narration identical, line for line',
     'authority [' + sd.join('  ') + ']\n          ours      [' + me.join('  ') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
