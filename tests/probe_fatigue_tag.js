/* probe_fatigue_tag.js — WHEN A LOCK-IN RUN ENDS, THE CONFUSION IT INFLICTS ON ITS OWN USER IS
 * TAGGED `[fatigue]`, AND A CONFUSION FROM ANY OTHER SOURCE IS NOT.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_fatigue_tag.js
 *   ... --arm bottom-tie-first        (the default; pins every range `random` to its bottom)
 *
 * ================= THE RULE, READ OFF THE AUTHORITY, WHOLE BLOCK ================================
 *
 * `data/conditions.ts` confusion.onStart (lines 161-173, read in full — the branch it belongs to
 * ends at 173 and a partial read of this block is how the freeze timer was got wrong before):
 *
 *     onStart(target, source, sourceEffect) {
 *       if (sourceEffect?.id === 'lockedmove') {
 *         this.add('-start', target, 'confusion', '[fatigue]');
 *       } else if (sourceEffect?.effectType === 'Ability') { ... '[from] ability: ' ... }
 *       else { this.add('-start', target, 'confusion'); }
 *
 * `/data/mods/champions/conditions.ts` is FIFTY-SEVEN LINES and overrides `par`, `slp` and `frz`
 * ONLY — it does not touch `confusion` or `lockedmove`, so mainline is what this format plays.
 * Checked rather than assumed, on the file rather than on memory.
 *
 * WHERE THE `lockedmove` SOURCE EFFECT COMES FROM, since `lockedmove.onEnd` passes NO arguments:
 * `onEnd(target) { if (this.effectState.trueDuration > 1) return; target.addVolatile('confusion'); }`
 * and `Pokemon#addVolatile` (sim/pokemon.ts:1983-1985) fills the gap from the running event —
 * `if (this.battle.event) { if (!source) source = this.battle.event.source; if (!sourceEffect)
 * sourceEffect = this.battle.effect; }`. Inside the lock's own `End` singleEvent `battle.effect` IS
 * the `lockedmove` condition, so the first branch is taken. `source` stays null and then defaults to
 * the target itself, which is ALSO why Safeguard cannot refuse this confusion — its
 * `onTryAddVolatile` ends `&& target !== source`.
 *
 * ================= WHAT THIS PROBE ASSERTS ======================================================
 *
 * Nothing about what the line should say is typed. Both engines play the identical scripted turns
 * under the identical pinned dice, and the turn's protocol is compared as a SEQUENCE against the
 * authority. The `-start ... confusion` line is ALSO pulled out by itself and printed with its
 * INDEX inside the turn, because two different defects can produce the same red here — a missing
 * FIELD, and a line written at the wrong POSITION — and the patch is different for each.
 *
 * THE KNOB IS THE CLICKED MOVE AND IT IS CLEARED EXPLICITLY. The control arm is the SAME body with
 * the SAME ability clicking a plain Dragon-type attack, which locks nothing and fatigues nobody, so
 * NEITHER engine may write a confusion line at all. Identical output across a varied knob would mean
 * the fixture is unwired, not that the tag does not matter — so the authority's own stream is
 * asserted to MOVE across the knob before anything else here is read.
 *
 * THE BOARD MUST BE IDENTICAL ON BOTH ARMS. This is a narration difference; a board that parts here
 * is a different and larger finding and is asserted as its own clause rather than assumed away.
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
 * The subject is a Dragon that carries BOTH a lock-in move and a plain Dragon attack, so the arm and
 * the control differ in the CLICK and in nothing else — same body, same ability, same type chart,
 * same target. It has no mega forme (derived, not recalled), so no `detailschange` can land in the
 * middle of the turn under test, and its ability is inert on this board: it is neither Own Tempo
 * (which would refuse the confusion) nor a contact ability (which would add lines of its own).
 * The foes spam a self-boost with no target and no roll, so the filler slots add one line each and
 * no variance. */
const SUBJECT = 'goodra', SUBJ_ABILITY = 'Sap Sipper';
const LOCK = 'Outrage', PLAIN = 'Dragon Claw';
const FOE = 'feraligatr', FOE_ABILITY = 'Torrent', FILLER_IDLE = 'Calm Mind';
/* The foe's own filler differs from the partner's ONLY because TeamValidator refuses it Calm Mind;
 * both are self-targeting stat moves with no roll, no target and no board consequence here. */
const FOE_IDLE = 'Swords Dance';

/* x6 HP ON BOTH SIDES, the multiplier engine/all_mechanics_fire.js uses, for its reason: NOTHING MAY
 * FAINT. Under `bottom-tie-first` every damage roll is the top of the band and every `randomChance`
 * is TRUE, so both Outrages crit for maximum, and a faint would turn the test into a forced switch. */
const HP_BOOST = 6;
const BENCH_P1 = [['toxapex', '', 'Iron Defense'], ['milotic', '', 'Recover']];
const BENCH_P2 = [['corviknight', '', 'Iron Defense'], ['pinsir', '', 'Swords Dance']];

{ /* every carriage claim is TeamValidator's and is PRINTED, per the standing rule */
  let bad = 0;
  const claims = [[SUBJECT, LOCK], [SUBJECT, PLAIN], ['clefable', FILLER_IDLE],
                  [FOE, FOE_IDLE], ['alakazam', FILLER_IDLE],
                  ...BENCH_P1.map(([s, , m]) => [s, m]), ...BENCH_P2.map(([s, , m]) => [s, m])];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  const AB = CS.abilitiesOf ? CS.abilitiesOf(SUBJECT) : null;
  if (AB) console.log(`  ${SUBJECT} legal abilities: ${JSON.stringify(AB)}`);
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

/* ---- HOW MANY REASONS THIS CELL QUALIFIES FOR, DERIVED AND PRINTED ----------------------------
 * A fixture that can produce the observable for two reasons proves nothing about either. The
 * observable here is a confusion on the subject, so every move and every ability in the cast is
 * asked -- from the FORMAT, not from a list typed here -- whether it can inflict one. The lock-in
 * move must be the ONLY answer; anything else and this file refuses to run rather than reporting a
 * `[fatigue]` tag it cannot attribute. */
{
  const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
  const DX = Dex.forFormat('gen9championsvgc2026regmb');
  const CAST_MOVES = [LOCK, PLAIN, FILLER_IDLE, FOE_IDLE, ...BENCH_P1.map(x => x[2]), ...BENCH_P2.map(x => x[2])];
  const CAST_ABIL = [SUBJ_ABILITY, 'Magic Guard', FOE_ABILITY, 'Synchronize'];
  const confusers = [];
  for (const nm of CAST_MOVES) {
    const mv = DX.moves.get(nm); if (!mv || !mv.exists) continue;
    const heads = [mv.volatileStatus, ...(mv.secondaries || []).map(x => x && x.volatileStatus),
                   mv.secondary && mv.secondary.volatileStatus, mv.self && mv.self.volatileStatus];
    if (heads.some(h => h === 'confusion')) confusers.push('move:' + mv.id + ' (direct)');
    /* the INDIRECT road, which is the one under test: a self-volatile whose own condition confuses */
    const vs = mv.self && mv.self.volatileStatus;
    const c = vs ? DX.conditions.get(vs) : null;
    if (c && /addVolatile\(['"]confusion/.test(String(c.onEnd || '') + String(c.onResidual || '')))
      confusers.push('move:' + mv.id + ' (via ' + vs + '.onEnd)');
  }
  for (const nm of CAST_ABIL) {
    const ab = DX.abilities.get(nm); if (!ab || !ab.exists) continue;
    const src = Object.keys(ab).filter(k => /^on/.test(k)).map(k => String(ab[k])).join(' ');
    if (/confusion/.test(src)) confusers.push('ability:' + ab.id);
  }
  console.log('  confusion sources in this cast, DERIVED from the format: ' + confusers.length
              + (confusers.length ? '  [' + confusers.join(', ') + ']' : ''));
  if (confusers.length !== 1) {
    console.log('NOT RUN — the cell qualifies for ' + confusers.length + ' reasons, not one. '
                + 'A `[fatigue]` tag read off a board with two confusion roads attributes nothing.');
    process.exit(2);
  }
}

const TEAM_P1 = [mon(SUBJECT, SUBJ_ABILITY, [LOCK, PLAIN]), mon('clefable', 'Magic Guard', [FILLER_IDLE]),
                 ...BENCH_P1.map(([s, a, m]) => mon(s, a, [m]))];
const TEAM_P2 = [mon(FOE, FOE_ABILITY, [FOE_IDLE]), mon('alakazam', 'Synchronize', [FILLER_IDLE]),
                 ...BENCH_P2.map(([s, a, m]) => mon(s, a, [m]))];

/* THREE TURNS, and the third is not decoration. Under the pinned arm `lockedmove.onStart` draws
 * `this.random(2, 4)` at the bottom, so the run is TWO forced turns and the fatigue lands at the end
 * of turn 2; turn 3 is played so that a confusion written LATE by either engine still falls inside
 * the compared window rather than off the end of the script. The lock-in move names no target
 * (`randomNormal`, DERIVED), so no `t` is written on it. */
const SCRIPT_ARM = [
  { p1: [{ m: LOCK }, { m: FILLER_IDLE }], p2: [{ m: FOE_IDLE }, { m: FILLER_IDLE }] },
  { p1: [{ m: LOCK }, { m: FILLER_IDLE }], p2: [{ m: FOE_IDLE }, { m: FILLER_IDLE }] },
  { p1: [{ m: PLAIN, t: 0 }, { m: FILLER_IDLE }], p2: [{ m: FOE_IDLE }, { m: FILLER_IDLE }] },
];
const SCRIPT_CTL = [
  { p1: [{ m: PLAIN, t: 0 }, { m: FILLER_IDLE }], p2: [{ m: FOE_IDLE }, { m: FILLER_IDLE }] },
  { p1: [{ m: PLAIN, t: 0 }, { m: FILLER_IDLE }], p2: [{ m: FOE_IDLE }, { m: FILLER_IDLE }] },
  { p1: [{ m: PLAIN, t: 0 }, { m: FILLER_IDLE }], p2: [{ m: FOE_IDLE }, { m: FILLER_IDLE }] },
];

/* The normaliser is `probe_ability_volatile_line.js`'s verbatim, and its arguments are that file's:
 * a body is compared by SLOT and never by display name, HP values are collapsed, the effect
 * NAMESPACE is dropped because the instrument this probe feeds treats it as equivalent, and a
 * `|move|` line is truncated at four fields for the same reason. */
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
  for (const l of turnSlice(lines, n)) {
    const k = norm(l);
    if (seen.has(k)) continue;      // the |split| twin
    seen.add(k); out.push(k);
  }
  return out;
};
/* THE ONE LINE AND WHERE IT SAT. A missing FIELD and a line at the wrong POSITION are two different
 * defects with two different patches, and a sequence comparison reports both as one red. */
const confLine = (st) => {
  const i = st.findIndex(l => /^\|?-start\|/.test(l) && /\|confusion(\||$)/.test(l));
  return i < 0 ? null : { i, line: st[i], of: st.length };
};

/* THE CONSEQUENCE, READ OUT OF EACH ENGINE'S OWN STATE at the same instant and never inferred from a
 * line: the authority's `volatiles.confusion` against this engine's `_vol.confusion`. An engine that
 * wrote the line and set no volatile would pass every narration clause here. */
const sdConf = battle => {
  const p = battle && battle.p1 && battle.p1.active && battle.p1.active[0];
  const v = p && p.volatiles && p.volatiles.confusion;
  return v ? (v.time == null ? 'yes' : v.time) : null;
};
const meConf = S => {
  const m = S && S.actA && S.actA[0];
  return (m && m._vol && m._vol.confusion > 0) ? m._vol.confusion : null;
};

function run(script, tag) {
  const a = G.buildPair(TEAM_P1, { hpBoost: HP_BOOST }), b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'fatigue-tag', tag, {
    script, arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sdConf: sdConf(battle), meConf: meConf(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  const out = { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen };
  for (const t of [1, 2, 3]) { out['sd' + t] = stream(sd, t); out['me' + t] = stream(me, t); }
  return out;
}

console.log('\nTHE `[fatigue]` TAG — a lock-in run confusing its own user, against a confusion from anywhere else\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const R = { arm: run(SCRIPT_ARM, 'lock'), control: run(SCRIPT_CTL, 'noLock') };

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const k of ['arm', 'control']) {
  const x = R[k];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + SUBJECT.toUpperCase() + ' clicks ' + (k === 'arm' ? LOCK.toUpperCase()
                                                                       : PLAIN.toUpperCase() + '  (CONTROL)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  for (const t of [1, 2, 3]) {
    console.log(`  turn ${t}  showdown  ` + (x['sd' + t].join('  ') || '(none)'));
    console.log(`  turn ${t}  medicham  ` + (x['me' + t].join('  ') || '(none)'));
  }
  console.log('  boards: ' + (x.seen.map(s => 't' + s.turn + (s.identical ? ' ok' : ' DIFF ' + s.diffs.join(' '))).join('   ') || '(none)'));
  console.log('  confusion volatile at each boundary   showdown [' + x.seen.map(s => s.sdConf == null ? '-' : s.sdConf).join(', ')
    + ']   medicham [' + x.seen.map(s => s.meConf == null ? '-' : s.meConf).join(', ') + ']');
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const lastSd = k => { const s = R[k].seen || []; return s.length ? s[s.length - 1].sdConf : undefined; };
const lastMe = k => { const s = R[k].seen || []; return s.length ? s[s.length - 1].meConf : undefined; };

/* -- 1. THE FIXTURE, read off the AUTHORITY's state and never off a line ------------------------- */
ok(R.arm.verdict === 'RAN' && R.control.verdict === 'RAN', 'both arms played',
   'arm ' + R.arm.verdict + (R.arm.why ? ' (' + R.arm.why + ')' : '')
   + ', control ' + R.control.verdict + (R.control.why ? ' (' + R.control.why + ')' : ''));
ok(lastSd('arm') != null,
   'the AUTHORITY confuses the lock-in user at the end of its run — the fixture reaches the fatigue at all',
   'sd confusion: ' + JSON.stringify(lastSd('arm')));
ok(lastSd('control') == null,
   'the AUTHORITY confuses NOBODY on the control arm — IDENTICAL STATE ACROSS THE KNOB WOULD MEAN THE '
   + 'FIXTURE IS UNWIRED, not that the click does not matter',
   'sd confusion: ' + JSON.stringify(lastSd('control')));
ok(lastMe('arm') != null && lastMe('control') == null,
   'and OURS matches that pattern in STATE — the volatile is set on the lock arm and on no other',
   'ours arm ' + JSON.stringify(lastMe('arm')) + ', control ' + JSON.stringify(lastMe('control')));

/* -- 2. THE BOARD. A narration fix that moves a board is a different change. --------------------- */
for (const k of ['arm', 'control']) {
  const bad = (R[k].seen || []).filter(s => !s.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + k,
     bad.length ? bad.map(s => 't' + s.turn + ' ' + s.diffs.join(' ')).join(' ; ') : '');
}

/* -- 3. THE NARRATION, as a SEQUENCE, with no typed expectation ---------------------------------- */
for (const k of ['arm', 'control']) for (const t of [1, 2, 3]) {
  const a = R[k]['sd' + t].join('  '), b = R[k]['me' + t].join('  ');
  ok(a === b, `NARRATION identical — ${k}, turn ${t}`,
     a === b ? '' : 'authority [' + a + ']\n          ours      [' + b + ']');
}

/* -- 4. THE ONE LINE, ISOLATED, SO THE FIELD AND THE POSITION ARE TWO SEPARATE VERDICTS ---------- */
for (const t of [2, 3]) {
  const s = confLine(R.arm['sd' + t]), m = confLine(R.arm['me' + t]);
  if (!s && !m) continue;
  console.log(`\n  turn ${t}  confusion start line`);
  console.log('    authority  ' + (s ? `[${s.i}/${s.of}]  ${s.line}` : '(none)'));
  console.log('    ours       ' + (m ? `[${m.i}/${m.of}]  ${m.line}` : '(none)'));
  ok(!!s === !!m, `both engines write a confusion start line on turn ${t}, or neither does`);
  if (s && m) {
    ok(s.line === m.line, `the confusion start line's FIELDS agree — turn ${t}`,
       s.line === m.line ? '' : 'authority [' + s.line + ']\n          ours      [' + m.line + ']');
    ok(s.i === m.i, `and it sits at the same POSITION in the turn — turn ${t}`,
       s.i === m.i ? '' : 'authority index ' + s.i + ' of ' + s.of + ', ours ' + m.i + ' of ' + m.of);
  }
}

console.log('\n  ' + (fails ? fails + ' FAILING' : 'ALL CLAUSES PASS'));
process.exit(fails ? 1 : 0);
