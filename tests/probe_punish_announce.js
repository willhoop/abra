/* probe_punish_announce.js — AN ABILITY THAT PUNISHES ITS ATTACKER ANNOUNCES ITSELF, AND THE
 * ANNOUNCEMENT IS GATED ON THE PUNISHMENT ACTUALLY HAPPENING.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_punish_announce.js
 *   ... --arm bottom-tie-first        (the default; the corner that pins randomChance TRUE)
 *
 * ================= THE RULE, AND THE MEMBERSHIP, DERIVED BEFORE ANYTHING WAS WIRED ===============
 *
 * Five legal-in-mainline abilities open their `onDamagingHit` with a literal `this.add`, and the
 * scan that found them was run over the WHOLE ability table rather than over a guess:
 *
 *     cottondown    -ability|TARGET|Cotton Down          NO LEGAL CARRIER in this regulation
 *     perishbody    -ability|TARGET|Perish Body          NO LEGAL CARRIER
 *     tanglinghair  -ability|TARGET|Tangling Hair        NO LEGAL CARRIER
 *     gooey         -ability|TARGET|Gooey                Goodra                data/abilities.ts:2178
 *     toxicdebris   -activate|TARGET|ability: Toxic Debris   Glimmora          data/abilities.ts:5096
 *
 * Restricted to the twelve `punishesAttacker` rows `data/tags.json` actually carries for this format,
 * exactly TWO announce and ten are silent — printed before the param was added, because a new derived
 * field that over-matches is this project's most-repeated failure. Neither ability is overridden in
 * `/data/mods/champions/`, checked rather than assumed.
 *
 * ================= AND THE GATE IS THE WHOLE POINT ON TOXIC DEBRIS ==============================
 *
 *     onDamagingHit(damage, target, source, move) {
 *       const side = source.isAlly(target) ? source.side.foe : source.side;
 *       const toxicSpikes = side.sideConditions['toxicspikes'];
 *       if (move.category === 'Physical' && (!toxicSpikes || toxicSpikes.layers < 2)) {
 *         this.add('-activate', target, 'ability: Toxic Debris');
 *         side.addSideCondition('toxicspikes', target);
 *       }
 *     }
 *
 * The cap is tested ABOVE the announcement. So a third physical hit with two layers already down
 * writes NOTHING — not the `-activate`, not the `-sidestart`. An engine that announced on every
 * physical hit would look correct for two turns and part on the third, which is why the third turn is
 * an arm here and not a footnote.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 *     showdown   |-activate|p1a: Glimmora|ability: Toxic Debris
 *                |-sidestart|p2: …|move: Toxic Spikes
 *     medicham   |-sidestart|p2: …|move: toxicspikes
 *
 * The layer was laid, on the right side, capped correctly. Only the line was missing — which is why
 * the board comparison read NO-DIVERGENCE and only the protocol stream could see it.
 *
 * ================= WHAT THIS PROBE ASSERTS, AND WHAT IT REFUSES TO TYPE =========================
 *
 * NOTHING about what the line should say is typed. Both engines play the identical three scripted
 * turns under the identical pinned dice and each turn's protocol is compared as a SEQUENCE.
 *
 * THE KNOB IS THE SUBJECT'S ABILITY AND IT IS CLEARED EXPLICITLY — the same body under one of its own
 * other legal abilities (Glimmora/Corrosion, Goodra/Hydration), so cast, clicks, dice and damage are
 * identical and only the ability varies. The probe FAILS if the AUTHORITY's own hazard count or speed
 * stage does not move across that knob: identical output across a varied knob means the fixture is
 * unwired, not that the knob does not matter.
 *
 * THE BOARD IS EXPECTED TO BE IDENTICAL ON EVERY ARM, BEFORE AND AFTER. This is a narration fix.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * Toxic Debris is on 1,840 of 13,116 open-sheet teams, so the LAB must move and the pinned pool may.
 * Gooey rides the same derived param and is here as the SECOND MEMBER, not as a second fix: a gate
 * written from one member only would not catch the other, which is the bar this file is held to.
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
 * AQUA TAIL is the hit for both subjects: it is PHYSICAL (Toxic Debris' trigger) and it is CONTACT
 * (Gooey's), so ONE click serves both members and the two arms differ only in who is standing there.
 * ACID ARMOR is the shared idle — the one self-move both subjects can legally learn, no target, no
 * roll. x6 HP on both sides, `engine/all_mechanics_fire.js`'s multiplier: nothing may faint, because
 * a faint forces a switch and the replacement becomes the thing under test. */
const SUBJECTS = [
  { id: 'glimmora', arm: 'Toxic Debris', control: 'Corrosion', watch: 'hazard' },
  { id: 'goodra', arm: 'Gooey', control: 'Hydration', watch: 'speed' },
];
const ATTACKER = 'feraligatr', HIT = 'Aqua Tail';
const SUBJ_IDLE = 'Acid Armor', FILLER_IDLE = 'Calm Mind';
const HP_BOOST = 6;
const BENCH_P1 = [['toxapex', 'Iron Defense'], ['milotic', 'Recover']];
const BENCH_P2 = [['corviknight', 'Iron Defense'], ['pinsir', 'Swords Dance']];

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [[ATTACKER, HIT], ['clefable', FILLER_IDLE], ['alakazam', FILLER_IDLE],
                  ...SUBJECTS.map(s => [s.id, SUBJ_IDLE]),
                  ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const p1Team = (subject, ability) => [mon(subject, ability, [SUBJ_IDLE]),
                                      mon('clefable', 'Magic Guard', [FILLER_IDLE]),
                                      ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const TEAM_P2 = [mon(ATTACKER, 'Torrent', [HIT]), mon('alakazam', 'Synchronize', [FILLER_IDLE]),
                 ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

/* THREE identical turns. Toxic Spikes caps at two layers, so turn 3 is the arm on which the
 * AUTHORITY writes nothing at all — the negative every scenario here owes. */
const TURN = { p1: [{ m: SUBJ_IDLE }, { m: FILLER_IDLE }], p2: [{ m: HIT, t: 0 }, { m: FILLER_IDLE }] };
const SCRIPT = [TURN, TURN, TURN];

/* Showdown's log carries the SECRET and SHARED form of one event (the `|split|` pair), a `|split|`
 * marker line and a bare timestamp line, none of which medicham2 emits. Those three shapes are
 * dropped; EVERY OTHER FIELD IS COMPARED, because the fields are the whole question here.
 *
 * A BODY OR A SIDE IS COMPARED BY ITS SLOT AND NEVER BY ITS DISPLAY NAME. `|-sidestart|p2: Bot 2|…`
 * against `|-sidestart|p2: |…` is the two engines naming the same side, and a normaliser that kept
 * the name would report that as a divergence on every hazard in the file. */
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
/* `''` is the bare timestamp line and `split` is the secret/shared marker; neither exists on our side. */
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

/* THE CONSEQUENCE IS READ OUT OF EACH ENGINE'S OWN STATE, at the same instant, never from a line. */
const sdWatch = battle => ({
  layers: (() => { const c = battle && battle.p2 && battle.p2.sideConditions
                             && battle.p2.sideConditions['toxicspikes'];
                   return c ? (c.layers | 0) : 0; })(),
  spe: (() => { const p = battle && battle.p2 && battle.p2.active && battle.p2.active[0];
                return p && p.boosts ? (p.boosts.spe | 0) : null; })(),
});
const meWatch = S => ({
  layers: (() => { const m = S && S.actB && S.actB[0];
                   const sf = m && m._sf; const bag = sf && sf.hz;
                   return bag ? ((bag.toxicspikes | 0)) : 0; })(),
  spe: (() => { const m = S && S.actB && S.actB[0];
                return m && m.boosts ? (m.boosts.sp | 0) : null; })(),
});

function run(subject, ability, tag) {
  const a = G.buildPair(p1Team(subject, ability), { hpBoost: HP_BOOST }),
        b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'punish-announce', tag, {
    script: SCRIPT, arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical, sd: sdWatch(battle), me: meWatch(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];   // a red turn 1 must not hide turn 3
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  const out = { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen };
  for (const t of [1, 2, 3]) { out['sd' + t] = stream(sd, t); out['me' + t] = stream(me, t); }
  return out;
}

console.log('\nTHE PUNISH ANNOUNCEMENT — the line, and the cap that must silence it\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  restore knob MEDI_PUNISH_ANNOUNCE_BLIND=' + (process.env.MEDI_PUNISH_ANNOUNCE_BLIND || '(off)'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const R = {};
for (const s of SUBJECTS) {
  R[s.id + ':arm'] = run(s.id, s.arm, s.id + ':' + s.arm);
  R[s.id + ':control'] = run(s.id, s.control, s.id + ':control');
}

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const s of SUBJECTS) for (const k of ['arm', 'control']) {
  const key = s.id + ':' + k, x = R[key];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + s.id.toUpperCase() + ' / ' + (k === 'arm' ? s.arm.toUpperCase()
                                                              : s.control.toUpperCase() + '  (CONTROL)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  for (const t of [1, 2, 3]) {
    console.log(`  turn ${t}  showdown  ` + (x['sd' + t].join('  ') || '(none)'));
    console.log(`  turn ${t}  medicham  ` + (x['me' + t].join('  ') || '(none)'));
  }
  console.log('  boards: ' + (x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   ') || '(none)'));
  console.log('  toxicspikes layers  showdown [' + x.seen.map(y => y.sd.layers).join(', ')
    + ']   medicham [' + x.seen.map(y => y.me.layers).join(', ') + ']');
  console.log('  attacker spe stage  showdown [' + x.seen.map(y => y.sd.spe).join(', ')
    + ']   medicham [' + x.seen.map(y => y.me.spe).join(', ') + ']');
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const at = (key, turn) => (R[key].seen || []).find(y => y.turn === turn) || null;

/* -- 1. THE FIXTURE, read off the AUTHORITY's own state and never off ours. ---------------------- */
{
  const arm = at('glimmora:arm', 3), ctl = at('glimmora:control', 3);
  ok(!!arm && arm.sd.layers === 2, 'the AUTHORITY laid TWO layers of Toxic Spikes and stopped — the '
    + 'cap is REACHED inside this fixture, so turn 3 is a real negative and not an unexercised branch',
    'sd layers by boundary: ' + JSON.stringify((R['glimmora:arm'].seen || []).map(y => y.sd.layers)));
  ok(!!ctl && ctl.sd.layers === 0, 'the AUTHORITY laid NONE on the control arm — IDENTICAL STATE '
    + 'ACROSS THE KNOB WOULD MEAN THE FIXTURE IS UNWIRED, not that the ability does not matter',
    'sd layers: ' + (ctl ? ctl.sd.layers : '?'));
}
{
  const arm = at('goodra:arm', 3), ctl = at('goodra:control', 3);
  ok(!!arm && arm.sd.spe < 0, 'the AUTHORITY dropped the attacker\'s Speed on the Gooey arm — the '
    + 'second member is reached at all', 'sd spe: ' + (arm ? arm.sd.spe : '?'));
  ok(!!ctl && ctl.sd.spe === 0, 'the AUTHORITY dropped NOTHING on its control arm',
    'sd spe: ' + (ctl ? ctl.sd.spe : '?'));
}
for (const s of SUBJECTS) for (const k of ['arm', 'control']) {
  const x = R[s.id + ':' + k];
  ok(x.verdict === 'RAN' && x.turns >= 3 && (x.seen || []).length >= 4,
     'all three scripted turns were played — ' + s.id + '/' + k,
     'turns ' + x.turns + ', boundaries ' + (x.seen || []).length);
}
/* AND THE TWO ENGINES HOLD THE SAME CONSEQUENCE. A narration fix that moved the layer count or the
 * stat stage would be a different change, and this is where that shows up. */
for (const s of SUBJECTS) for (const k of ['arm', 'control']) {
  const key = s.id + ':' + k, x = R[key];
  const bad = (x.seen || []).filter(y => y.sd.layers !== y.me.layers || y.sd.spe !== y.me.spe);
  ok(bad.length === 0, 'the CONSEQUENCE agrees between the engines at every boundary — ' + key,
     bad.map(y => 't' + y.turn + ' layers sd=' + y.sd.layers + ' me=' + y.me.layers
                + ' spe sd=' + y.sd.spe + ' me=' + y.me.spe).join(' ; '));
}

/* -- 2. THE BOARD. --------------------------------------------------------------------------- */
for (const s of SUBJECTS) for (const k of ['arm', 'control']) {
  const key = s.id + ':' + k;
  const bad = (R[key].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + key,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 3. THE NARRATION, per turn, compared as a SEQUENCE with no typed expectation. --------------- */
for (const s of SUBJECTS) for (const k of ['arm', 'control']) for (const t of [1, 2, 3]) {
  const key = s.id + ':' + k, a = R[key]['sd' + t].join('  '), b = R[key]['me' + t].join('  ');
  ok(a === b, `NARRATION identical — ${key}, turn ${t}`,
     a === b ? '' : 'authority [' + a + ']\n          ours      [' + b + ']');
}

/* -- 4. THE DEFECT, NAMED. Spelled without naming either ability: "the two engines write the same
 * self-announcement lines". Any punisher added later that announces under any name trips this. */
const selfAnn = lines => (lines || [])
  .filter(l => /^\|-(ability|activate)\|/.test(l)).sort().join('  ');
for (const s of SUBJECTS) for (const t of [1, 2, 3]) {
  const key = s.id + ':arm', a = selfAnn(R[key]['sd' + t]), b = selfAnn(R[key]['me' + t]);
  ok(a === b, `the self-announcement lines match — ${key}, turn ${t}`,
     a === b ? '' : 'authority [' + (a || '(none)') + ']\n          ours      [' + (b || '(none)') + ']');
}
/* AND THE CAP CLAUSE, STATED ON ITS OWN, because an engine that announced unconditionally would pass
 * turns 1 and 2 and this is the only clause that would catch it. */
ok(selfAnn(R['glimmora:arm'].sd3) === '' && selfAnn(R['glimmora:arm'].me3) === '',
   'NEITHER engine announces on the turn the cap refuses the layer — the gate is above the line',
   'authority [' + (selfAnn(R['glimmora:arm'].sd3) || '(none)') + ']  ours ['
   + (selfAnn(R['glimmora:arm'].me3) || '(none)') + ']');

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
