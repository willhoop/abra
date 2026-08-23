/* probe_ability_volatile_line.js — WHEN AN **ABILITY** APPLIES A VOLATILE, THE AUTHORITY'S START
 * LINE SAYS SO, AND THE ABILITY WRITES NO LINE OF ITS OWN.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_ability_volatile_line.js
 *   ... --arm bottom-tie-first        (the default; the corner that pins randomChance TRUE)
 *
 * ================= THE RULE, DERIVED FROM THE AUTHORITY AND NOT FROM THE CASE ====================
 *
 * `Pokemon#addVolatile(status, source, sourceEffect)` runs the CONDITION's own `onStart`, and where
 * that handler branches on the SOURCE EFFECT it writes a different line. Four of the 57 volatiles a
 * legal move can apply in this regulation carry such a branch, and the membership was PRINTED over
 * the format's whole move table before anything here was wired:
 *
 *     attract     `if (effect.name === 'Cute Charm')  add('-start', pokemon, 'Attract',
 *                  '[from] ability: Cute Charm', '[of] ' + source)`
 *     charge      `if (effect && ['Electromorphosis','Wind Power'].includes(effect.name))
 *                  add('-start', pokemon, 'Charge', this.activeMove.name, '[from] ability: '+…)`
 *     confusion   `else if (sourceEffect?.effectType === 'Ability')
 *                  add('-start', target, 'confusion', '[from] ability: '+…, `[of] ${source}`)`
 *     disable     `if (effect.effectType === 'Ability')  add('-start', pokemon, 'Disable',
 *                  pokemon.lastMove.name, '[from] ability: ' + effect.name, `[of] ${source}`)`
 *                 — data/moves.ts:3686-3690, mainline; `/data/mods/champions/` overrides neither
 *                 `disable` nor `cursedbody`, checked rather than assumed.
 *
 * ONE RULE, FOUR SITES: the start line is the CONDITION's, it names the AFFECTED body, and the
 * ability that caused it appears only as `[from]`/`[of]` ON THAT LINE. Nowhere does the ability emit
 * an `-activate` of its own — `data/abilities.ts:774` (Cursed Body) is nine lines and contains no
 * `this.add` at all.
 *
 * ================= WHAT THIS ENGINE DID, AND WHY IT IS TWO DEFECTS ===============================
 *
 *     showdown   |-start|p2a: Feraligatr|Disable|Aqua Tail|[from] ability: Cursed Body|[of] p1a: Banette
 *     medicham   |-activate|p1a: Banette|ability: cursedbody
 *                |-start|p2a: Feraligatr|Disable|aquatail
 *
 * (1) an `-activate` on the CARRIER that the authority never writes, and
 * (2) a `-start` on the AFFECTED body missing the two attribution fields.
 *
 * They are one fix because they are one sentence in the authority, and they are separated here
 * because an engine that fixed only (1) would still part on the same turn.
 *
 * ================= WHAT THIS PROBE ASSERTS, AND WHAT IT REFUSES TO TYPE =========================
 *
 * NOTHING about what the line should say is typed. Both engines play the identical two scripted
 * turns under the identical pinned dice and the turn's protocol is compared as a SEQUENCE. Showdown
 * is the expectation, exactly as tests/staged_board.js argues.
 *
 * THE KNOB IS THE CARRIER'S ABILITY AND IT IS CLEARED EXPLICITLY. The control arm is the SAME
 * Banette carrying INSOMNIA — one of its own two other legal abilities — so the cast, the clicks,
 * the dice and the damage are identical and the ONLY thing that varies is the ability. The probe
 * FAILS if the authority's own stream does not move across that knob, because identical output
 * across a varied knob means the fixture is unwired, not that the knob does not matter.
 *
 * THE BOARD IS EXPECTED TO BE IDENTICAL ON EVERY ARM, BEFORE AND AFTER. This is a narration fix. A
 * board that moves here is a red flag and is asserted as its own clause rather than assumed.
 *
 * ================= THE ARM PIN IS LOAD-BEARING ==================================================
 *
 * Cursed Body is `randomChance(3, 10)`. `bottom-tie-first` pins every `randomChance` TRUE in BOTH
 * engines (engine/game_differential.js — `PIN_CHANCE`), so the seal is deterministic. Under any
 * other arm this fixture measures nothing and the probe says so rather than passing quietly.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * Cursed Body is on 2,177 of 13,116 open-sheet teams, so the LAB must move and the pinned pool may.
 * The class as a whole (Cute Charm's attract, Electromorphosis' charge) is NOT claimed fixed by this
 * probe: it stages ONE of the four members. The other three are named above so that a later pass
 * adds an arm rather than a second implementation.
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
 * BANETTE is the subject. It is the only Cursed Body body in this regulation whose OTHER abilities
 * are inert on this board — Insomnia and Frisk. Gengar is deliberately NOT used: this file's own
 * simulator carries a note that Showdown's Gengar mega-evolves on a CHOICE mid-turn, which would put
 * a `detailschange` in the middle of the turn under test.
 * FERALIGATR clicks the hit. Aqua Tail is a plain damaging move with no secondary, so the only thing
 * the turn can produce beyond the damage is the seal.
 * The two partners spam CALM MIND, a self-boost with no roll and no target, so the partner slots add
 * a line each and no variance. Protect was rejected: consecutive Protect is a die, and a probe whose
 * filler slots roll is a probe that can go red for a reason that is not the mechanic. */
const SUBJECT = 'banette', ARM_ABILITY = 'Cursed Body', CONTROL_ABILITY = 'Insomnia';
const ATTACKER = 'feraligatr', HIT = 'Aqua Tail', HIT2 = 'Ice Fang';
const SUBJ_IDLE = 'Swords Dance', FILLER_IDLE = 'Calm Mind';
/* x6 HP ON BOTH SIDES, the same multiplier engine/all_mechanics_fire.js uses and for its reason:
 * NOTHING MAY FAINT. Under `bottom-tie-first` every damage roll is the top of the band and every
 * `randomChance` is TRUE, so the hit crits for maximum — the first cut of this fixture killed Banette
 * on turn 1 and the forced switch became the thing under test. `spec.hpx` is applied identically to
 * both engines by the driver, so no fraction and no rule moves. */
const HP_BOOST = 6;

/* `buildPair` keeps FOUR bodies and returns NULL below that, so each side carries two bench members
 * that never act. In doubles only slots 0 and 1 are ever active; the back two exist to satisfy the
 * builder and are given a legal self-move each so no body is unbuildable. */
const BENCH_P1 = [['toxapex', '', 'Iron Defense'], ['milotic', '', 'Recover']];
const BENCH_P2 = [['corviknight', '', 'Iron Defense'], ['pinsir', '', 'Swords Dance']];

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [[SUBJECT, SUBJ_IDLE], [ATTACKER, HIT], [ATTACKER, HIT2], ['clefable', FILLER_IDLE],
                  ['alakazam', FILLER_IDLE],
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

const p1Team = ability => [mon(SUBJECT, ability, [SUBJ_IDLE]),
                           mon('clefable', 'Magic Guard', [FILLER_IDLE]),
                           ...BENCH_P1.map(([s, a, m]) => mon(s, a, [m]))];
const TEAM_P2 = [mon(ATTACKER, 'Torrent', [HIT, HIT2]), mon('alakazam', 'Synchronize', [FILLER_IDLE]),
                 ...BENCH_P2.map(([s, a, m]) => mon(s, a, [m]))];

/* Turn 1 lands the hit. Turn 2 clicks a DIFFERENT damaging move, deliberately.
 *
 * THE SEALED MOVE IS NOT RE-CLICKED, AND THAT IS NOT A SOFTENING. Showdown refuses a disabled move
 * AT SELECTION (`Pokemon#getMoves` marks the slot and `Side#choose` rejects it), so a script that
 * re-clicked Aqua Tail would have its CHOICE rejected and the driver would throw — the harness
 * failing, not the engine. The seal's consequence is therefore read off STATE at the turn boundary
 * (the authority's own `volatiles.disable`), which is a stronger receipt than a `|cant|` line anyway.
 * Turn 2 also earns its place as the RE-TRIGGER control: `data/abilities.ts:775` opens
 * `if (source.volatiles['disable']) return;`, so a second damaging hit must seal NOTHING new. */
const SCRIPT = [
  { p1: [{ m: SUBJ_IDLE }, { m: FILLER_IDLE }], p2: [{ m: HIT, t: 0 }, { m: FILLER_IDLE }] },
  { p1: [{ m: SUBJ_IDLE }, { m: FILLER_IDLE }], p2: [{ m: HIT2, t: 0 }, { m: FILLER_IDLE }] },
];

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

/* THE CONSEQUENCE IS READ OUT OF EACH ENGINE'S OWN STATE, at the same instant, and never inferred
 * from a line. `volatiles.disable` is the authority's field; `_vol.disable` plus `_sealed` are this
 * engine's two (WIRE 26 — the counter and the identity of the sealed move are separate fields, so a
 * probe that read only one could pass on an engine that sealed nothing in particular). */
const sdSeal = battle => {
  const p = battle && battle.p2 && battle.p2.active && battle.p2.active[0];
  const v = p && p.volatiles && p.volatiles.disable;
  return v ? String((v.move || '')).toLowerCase().replace(/[^a-z0-9]/g, '') || 'yes' : null;
};
const meSeal = S => {
  const m = S && S.actB && S.actB[0];
  if (!m || !m._vol || !(m._vol.disable > 0)) return null;
  return String(m._sealed || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'yes';
};

function run(ability, tag) {
  const a = G.buildPair(p1Team(ability), { hpBoost: HP_BOOST }),
        b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'ability-volatile-line', tag, {
    script: SCRIPT, arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sdSeal: sdSeal(battle), meSeal: meSeal(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];   // a red turn 1 must not hide turn 2
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sd1: stream(sd, 1), me1: stream(me, 1), sd2: stream(sd, 2), me2: stream(me, 2) };
}

console.log('\nAN ABILITY-APPLIED VOLATILE — the start line, its attribution, and the -activate that must not exist\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  restore knob MEDI_ABILITY_VOL_LINE_BLIND=' + (process.env.MEDI_ABILITY_VOL_LINE_BLIND || '(off)'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const R = { arm: run(ARM_ABILITY, 'cursedbody'), control: run(CONTROL_ABILITY, 'control') };

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const k of ['arm', 'control']) {
  const x = R[k];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + (k === 'arm' ? SUBJECT.toUpperCase() + ' / ' + ARM_ABILITY.toUpperCase()
                                  : SUBJECT.toUpperCase() + ' / ' + CONTROL_ABILITY.toUpperCase() + '  (CONTROL)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  for (const t of [1, 2]) {
    console.log(`  turn ${t}  showdown  ` + (x['sd' + t].join('  ') || '(none)'));
    console.log(`  turn ${t}  medicham  ` + (x['me' + t].join('  ') || '(none)'));
  }
  const b = x.seen.map(s => 't' + s.turn + (s.identical ? ' ok' : ' DIFF ' + s.diffs.join(' ')));
  console.log('  boards: ' + (b.join('   ') || '(no boundary)'));
  console.log('  seal at each boundary   showdown [' + x.seen.map(s => s.sdSeal || '-').join(', ')
    + ']   medicham [' + x.seen.map(s => s.meSeal || '-').join(', ') + ']');
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

/* -- 1. THE FIXTURE. Nothing below means anything if the knob did not move the AUTHORITY. --------
 * Every clause here is read off the AUTHORITY's own state, never off ours, and never off a line. */
const lastSd = k => { const s = (R[k].seen || []); return s.length ? s[s.length - 1].sdSeal : undefined; };
const lastMe = k => { const s = (R[k].seen || []); return s.length ? s[s.length - 1].meSeal : undefined; };
ok(!!lastSd('arm'),
   'the AUTHORITY carries a `disable` volatile on the attacker with the ability on — the fixture '
   + 'reaches Cursed Body at all',
   'sd seal: ' + JSON.stringify(lastSd('arm')));
ok(lastSd('control') == null,
   'the AUTHORITY carries NONE on the control arm — IDENTICAL STATE ACROSS THE KNOB WOULD MEAN THE '
   + 'FIXTURE IS UNWIRED, not that the ability does not matter',
   'sd seal: ' + JSON.stringify(lastSd('control')));
ok(R.arm.verdict === 'RAN' && R.arm.turns >= 2 && R.arm.seen.length >= 2,
   'both scripted turns were played and both boundaries were taken — a short game has stopped testing',
   'turns played: ' + R.arm.turns + ', boundaries: ' + (R.arm.seen || []).length);
ok(lastSd('arm') === lastMe('arm'),
   'the SEALED MOVE agrees between the two engines — the consequence, read out of state at the same '
   + 'instant and not from a line',
   'authority ' + JSON.stringify(lastSd('arm')) + '  ours ' + JSON.stringify(lastMe('arm')));
ok(lastMe('control') == null,
   'and OURS seals nothing on the control arm either — an engine that sealed unconditionally would '
   + 'pass every narration clause on the ability arm alone',
   'ours ' + JSON.stringify(lastMe('control')));
/* THE RE-TRIGGER CONTROL. `data/abilities.ts:775` opens `if (source.volatiles['disable']) return;`,
 * so the SECOND damaging hit on turn 2 must not re-seal — the move named at boundary 2 must still be
 * turn 1's. Asserted on the authority AND on us, because an engine that re-sealed would look correct
 * on every other clause here. */
{
  /* BY TURN NUMBER, NOT BY INDEX. The driver takes a boundary BEFORE turn 1 as well (`t0`), so
   * `seen[0]` is the empty board and the first version of this clause compared it against turn 2 and
   * reported a re-seal that had not happened. */
  const s = R.arm.seen || [];
  const b1 = s.find(x => x.turn === 1) || {}, b2 = s.find(x => x.turn === 2) || {};
  ok(!!b1.sdSeal && b1.sdSeal === b2.sdSeal,
     'the AUTHORITY does NOT re-seal on the second damaging hit — the sealed move at boundary 2 is '
     + 'still the one from turn 1',
     'sd ' + JSON.stringify(b1.sdSeal) + ' -> ' + JSON.stringify(b2.sdSeal));
  ok(!!b1.meSeal && b1.meSeal === b2.meSeal,
     'and neither do we',
     'ours ' + JSON.stringify(b1.meSeal) + ' -> ' + JSON.stringify(b2.meSeal));
}

/* -- 2. THE BOARD. A narration fix that moves a board is a different change. --------------------- */
for (const k of ['arm', 'control']) {
  const bad = (R[k].seen || []).filter(s => !s.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + k,
     bad.length ? bad.map(s => 't' + s.turn + ' ' + s.diffs.join(' ')).join(' ; ') : '');
}

/* -- 3. THE NARRATION, compared as a SEQUENCE with no typed expectation. ------------------------- */
for (const k of ['arm', 'control']) for (const t of [1, 2]) {
  const a = R[k]['sd' + t].join('  '), b = R[k]['me' + t].join('  ');
  ok(a === b, `NARRATION identical — ${k}, turn ${t}`,
     a === b ? '' : 'authority [' + a + ']\n          ours      [' + b + ']');
}

/* -- 4. THE TWO DEFECTS, NAMED SEPARATELY, so a half fix cannot read as a pass. ------------------
 * Spelled WITHOUT naming Cursed Body: "the two engines write the same `-activate` lines" and "the
 * two engines write the same `-start` lines" are predicates any ability-applied volatile trips. */
const only = (lines, ev) => (lines || []).filter(l => l.startsWith('|' + ev + '|')).sort().join('  ');
for (const ev of ['-activate', '-start']) {
  const a = only(R.arm.sd1, ev), b = only(R.arm.me1, ev);
  ok(a === b, `the \`${ev}\` lines of turn 1 match — ability arm`,
     a === b ? '' : 'authority [' + (a || '(none)') + ']\n          ours      [' + (b || '(none)') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
