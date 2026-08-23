/* probe_regenerator_line.js — CHAMPIONS ANNOUNCES REGENERATOR'S HEAL. MAINLINE DOES NOT, AND THIS
 * ENGINE'S OWN COMMENT CITED MAINLINE.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_regenerator_line.js
 *   ... --arm bottom-tie-first        (the default)
 *
 * ================= THE FINDING, AND IT IS A CITATION ERROR RATHER THAN A MISSING MECHANIC ========
 *
 * `engine/medicham2-browser.js` has carried this since ROADMAP #223:
 *
 *     "AND IT HEALS SILENTLY. THE AUTHORITY EMITS NO LINE FOR THIS. … Regenerator calls
 *      `pokemon.heal(...)` — `Pokemon#heal`, sim/pokemon.ts:1646 … It adds nothing to the log.
 *      `Battle#heal` is the one that emits `-heal`, and the ability does not call it."
 *
 * Every sentence of that is TRUE OF MAINLINE and false of the game we play:
 *
 *     data/abilities.ts:1160            onSwitchOut(pokemon) { pokemon.heal(pokemon.baseMaxhp / 3); }
 *     data/mods/champions/abilities.ts:77-84
 *                                       regenerator: { inherit: true,
 *                                         onSwitchOut(pokemon) {
 *                                           if (pokemon.heal(pokemon.baseMaxhp / 3)) {
 *                                             this.add('-heal', pokemon, pokemon.getHealth,
 *                                                      '[from] ability: Regenerator', '[silent]');
 *                                           } } }
 *
 * Champions is one of EIGHT files the mod overrides, and CLAUDE.md's standing rule is that reading
 * `/data/abilities.ts` is reading a different game. #223 read the mainline handler, reasoned
 * correctly from it, and suppressed a line the format writes — so the emission was removed ON PURPOSE
 * with a paragraph of justification, which is the most expensive shape a wrong fact can have here.
 *
 * ================= WHAT IS AND IS NOT BROKEN, MEASURED RATHER THAN ASSUMED ======================
 *
 * The HP is RIGHT and has been since WIRE 27 — `data/all-mechanics-fire.json` reports the Regenerator
 * row as `ANNOUNCEMENT-ONLY` on the board, which is the board comparison saying our HP matches the
 * authority's over the whole game. So this probe asserts the HP as a CONTROL (it must not move) and
 * the line as the defect. ROADMAP #397 files Regenerator among six switch-in/on-hit effects that "do
 * not fire at all"; for THIS member the effect fires and only the announcement is absent, and this
 * file says so rather than repeating the group's wording.
 *
 * ================= THE GUARD IS PART OF THE MECHANIC ============================================
 *
 * `if (pokemon.heal(...))` — `Pokemon#heal` returns the DELTA and a body already at full HP gets 0,
 * so a healthy body switching out writes NOTHING. That is the second arm here: the same Audino, the
 * same switch, undamaged. An engine that announced on every switch-out would pass the damaged arm.
 *
 * THE KNOB IS THE ABILITY AND IT IS CLEARED EXPLICITLY — the control arm is the same Audino under
 * HEALER, one of its own three legal abilities.
 *
 * NOTHING about what the line should say is typed. Both engines play identical scripted turns under
 * identical pinned dice and the turn's protocol is compared as a SEQUENCE.
 *
 * ================= WHICH SCOREBOARD ============================================================
 *
 * Regenerator is on 1,596 of 13,116 open-sheet teams — the highest-reach member of #397 — so the LAB
 * must move and the pinned pool may. The BOARD must be identical on every arm before and after: the
 * HP was already right and an arm whose HP moves is a regression, not a success.
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
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE CAST ---------------------------------------------------------------------------------
 * AUDINO carries Regenerator and Healer, so one body serves the arm and the control.
 * FERALIGATR supplies the damage on the DAMAGED arms; on the HEALTHY arms it aims at the PARTNER
 * instead, so the click, the dice and the turn count are identical and the only thing that varies is
 * whether the switching body has room to heal.
 * x6 HP on both sides — nothing may faint, because a faint forces a switch of its own. */
const SUBJECT = 'audino', ARM_ABILITY = 'Regenerator', CONTROL_ABILITY = 'Healer';
const ATTACKER = 'feraligatr', HIT = 'Aqua Tail';
const IDLE = 'Calm Mind', PIVOT_TO = 'toxapex';
const HP_BOOST = 6;
const BENCH_P1 = [[PIVOT_TO, 'Iron Defense'], ['milotic', 'Recover']];
const BENCH_P2 = [['corviknight', 'Iron Defense'], ['pinsir', 'Swords Dance']];

{ /* every carriage claim is TeamValidator's and is printed, per the standing rule */
  let bad = 0;
  const claims = [[SUBJECT, IDLE], [ATTACKER, HIT], ['clefable', IDLE], ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const ok = CS.canLearn(sp, mv);
    console.log(`  learnset (TeamValidator): ${sp} / ${mv} -> ${ok ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!ok) bad++;
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const p1Team = ability => [mon(SUBJECT, ability, [IDLE]),
                           mon('clefable', 'Magic Guard', [IDLE]),
                           ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const TEAM_P2 = [mon(ATTACKER, 'Torrent', [HIT]), mon('alakazam', 'Synchronize', [IDLE]),
                 ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

/* `aimAt` is the knob for the DAMAGED / HEALTHY pair: slot 0 is Audino, slot 1 is its partner. */
const script = aimAt => [
  { p1: [{ m: IDLE }, { m: IDLE }], p2: [{ m: HIT, t: aimAt }, { m: IDLE }] },
  { p1: [{ sw: PIVOT_TO }, { m: IDLE }], p2: [{ m: HIT, t: 1 }, { m: IDLE }] },
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

/* THE SUBJECT'S HP, wherever it is standing — the whole point is that it is on the BENCH by the time
 * the heal lands, which is a leaf a protocol stream can never see. Read out of each engine's own
 * party, at the same instant, and never inferred from a line. */
const sdHp = battle => {
  const p = (battle && battle.p1 && battle.p1.pokemon || []).find(x => x && idOf(x.species.id) === SUBJECT);
  return p ? p.hp : null;
};
const meHp = S => {
  const a0 = S && S.actA && S.actA[0];
  const team = (a0 && a0._sf && a0._sf.team) || [];
  const m = team.find(x => x && idOf(x.name) === SUBJECT);
  return m ? m.curHP : null;
};

function run(ability, aimAt, tag) {
  const a = G.buildPair(p1Team(ability), { hpBoost: HP_BOOST }),
        b = G.buildPair(TEAM_P2, { hpBoost: HP_BOOST });
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'regenerator-line', tag, {
    script: script(aimAt), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical, sdHp: sdHp(battle), meHp: meHp(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  const out = { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
                switchesRefused: (G.scriptCounters && G.scriptCounters().switchNotFound) || 0 };
  for (const t of [1, 2]) { out['sd' + t] = stream(sd, t); out['me' + t] = stream(me, t); }
  return out;
}

console.log('\nREGENERATOR ANNOUNCES ITS HEAL IN CHAMPIONS — the line, and the full-HP guard that silences it\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  restore knob MEDI_REGEN_SILENT=' + (process.env.MEDI_REGEN_SILENT || '(off)'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = [
  { key: 'regen:damaged', ability: ARM_ABILITY, aim: 0, label: 'REGENERATOR, damaged before the pivot' },
  { key: 'regen:healthy', ability: ARM_ABILITY, aim: 1, label: 'REGENERATOR, UNDAMAGED (the guard arm)' },
  { key: 'control:damaged', ability: CONTROL_ABILITY, aim: 0, label: 'HEALER (control), damaged before the pivot' },
];
const R = {};
for (const a of ARMS) R[a.key] = run(a.ability, a.aim, a.key);

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
  for (const t of [1, 2]) {
    console.log(`  turn ${t}  showdown  ` + (x['sd' + t].join('  ') || '(none)'));
    console.log(`  turn ${t}  medicham  ` + (x['me' + t].join('  ') || '(none)'));
  }
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
  console.log('  audino hp   showdown [' + x.seen.map(y => y.sdHp).join(', ')
    + ']   medicham [' + x.seen.map(y => y.meHp).join(', ') + ']');
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the NARRATION');
console.log('='.repeat(98));

const at = (k, t) => (R[k].seen || []).find(y => y.turn === t) || {};

/* -- 1. THE FIXTURE, read off the AUTHORITY's own HP and never off a line. ----------------------- */
{
  const t1 = at('regen:damaged', 1), t2 = at('regen:damaged', 2);
  ok(t1.sdHp != null && t2.sdHp != null && t2.sdHp > t1.sdHp,
     'the AUTHORITY HEALED the body on the way out — the fixture reaches the mechanic at all',
     'sd hp t1 ' + t1.sdHp + ' -> t2 ' + t2.sdHp);
  const h1 = at('regen:healthy', 1), h2 = at('regen:healthy', 2);
  ok(h1.sdHp != null && h1.sdHp === h2.sdHp,
     'and it healed NOTHING on the undamaged arm — the `if (pokemon.heal(...))` guard is exercised, '
     + 'so a silent turn is a real negative rather than an unreached branch',
     'sd hp t1 ' + h1.sdHp + ' -> t2 ' + h2.sdHp);
  const c1 = at('control:damaged', 1), c2 = at('control:damaged', 2);
  ok(c1.sdHp != null && c1.sdHp === c2.sdHp,
     'and NOTHING on the control ability — IDENTICAL HP ACROSS THE KNOB WOULD MEAN THE FIXTURE IS '
     + 'UNWIRED, not that the ability does not matter',
     'sd hp t1 ' + c1.sdHp + ' -> t2 ' + c2.sdHp);
}
for (const a of ARMS) {
  const x = R[a.key];
  ok(x.verdict === 'RAN' && x.turns >= 2, 'both scripted turns were played — ' + a.key, 'turns ' + x.turns);
  ok((x.sd2 || []).some(l => /^\|switch\|/.test(l)),
     'the scripted PIVOT actually happened in the authority — ' + a.key
     + ' (a refused switch resolves to `pass` and the arm would measure a plain turn)');
}

/* -- 2. THE HP IS A CONTROL AND MUST NOT MOVE. --------------------------------------------------- */
for (const a of ARMS) {
  const x = R[a.key];
  const bad = (x.seen || []).filter(y => y.sdHp !== y.meHp);
  ok(bad.length === 0, 'the HP agrees between the engines at every boundary — ' + a.key
     + ' (this was already right; an arm where it moves is a regression, not a fix)',
     bad.map(y => 't' + y.turn + ' sd=' + y.sdHp + ' me=' + y.meHp).join(' ; '));
  const badB = (x.seen || []).filter(y => !y.identical);
  ok(badB.length === 0, 'BOARD identical at every boundary — ' + a.key,
     badB.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 3. THE NARRATION, compared as a SEQUENCE with no typed expectation. ------------------------- */
for (const a of ARMS) for (const t of [1, 2]) {
  const x = R[a.key], p = x['sd' + t].join('  '), q = x['me' + t].join('  ');
  ok(p === q, `NARRATION identical — ${a.key}, turn ${t}`,
     p === q ? '' : 'authority [' + p + ']\n          ours      [' + q + ']');
}

/* -- 4. THE DEFECT, NAMED, spelled without naming Regenerator: "the two engines write the same
 * `-heal` lines on the pivot turn". The two negative arms carry the same clause, which is what stops
 * an engine that announces on every switch-out from reading as a pass. */
const heals = lines => (lines || []).filter(l => /^\|-heal\|/.test(l)).sort().join('  ');
for (const a of ARMS) {
  const p = heals(R[a.key].sd2), q = heals(R[a.key].me2);
  ok(p === q, `the \`-heal\` lines of the pivot turn match — ${a.key}`,
     p === q ? '' : 'authority [' + (p || '(none)') + ']\n          ours      [' + (q || '(none)') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
