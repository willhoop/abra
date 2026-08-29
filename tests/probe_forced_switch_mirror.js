/* probe_forced_switch_mirror.js — A SLOT THAT TAKES TWO BODIES IN ONE TURN, AND THE MIRROR ANSWERED
 * THE FIRST REQUEST WITH THE SECOND ONE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_forced_switch_mirror.js
 *
 * ================= THE QUESTION =================================================================
 *
 * medicham2 plays a whole turn in one atomic `battleTurn` call. Showdown STOPS DEAD the instant a
 * pivot resolves and asks who comes in. `engine/game_differential.js` mirrors medicham2's placement
 * into that request, and it used to read medicham2's CURRENT occupant of the slot — an END-OF-TURN
 * answer to a MID-TURN question. On any turn where one slot takes two bodies the two disagree.
 *
 * THE SHAPE, REPRODUCED FROM A PINNED GAME BEFORE IT WAS STAGED HERE
 * (`pair-speedctrl` / `2654713271 vs 2654811481`, turn 7, both streams agreeing to the pause):
 *
 *     |move|p2a: Incineroar|partingshot|p1a: Kingambit          <- SHOWDOWN PAUSES HERE
 *     |switch|p2a: Gengar|gengar, L50|135/135|[from] partingshot   medicham2's answer to the request
 *     |move|p1a: Kingambit|ironhead|p2a: Gengar
 *     |faint|p2a: Gengar
 *     |switch|p2a: Incineroar|incineroar, L50|131/170           <- the PIVOTER comes back as the
 *                                                                  corpse's replacement, and that is
 *                                                                  what the mirror read
 *
 * so the harness asked Showdown to switch in a body Showdown had standing. Showdown refused and the
 * game was stopped with *"the boards had already parted"* — on boards that agreed line for line. In
 * the 961-game empirical arm of 2026-08-29 that ended 42 games (4.4%), which is the denominator every
 * other card in `docs/_reports/2026-08-29-empirical-divergence-cards.md` was measured against.
 *
 * ================= THE FIXTURE IS CONSTRUCTED, NOT FOUND ========================================
 *
 * One turn, and every member is derived from the format rather than named:
 *
 *   the PIVOT      the move tagged `pivotStatus` whose user does not have to connect to leave, on the
 *                  legal learner with the highest base Speed that also holds a priority-raising
 *                  ability — so the pivot resolves BEFORE the killer without depending on a spread.
 *   the KILLER     the move tagged BOTH `userFaints` and `fixedDamage` whose damage is the user's own
 *                  remaining HP. It is the only deterministic OHKO in this format: no accuracy roll,
 *                  no damage roll, no type chart beyond one immunity. The pin's minimum damage roll
 *                  cannot save the victim and a lucky one cannot spare it.
 *   the VICTIM     the frailest legal body that is not immune to the killer's type, placed at the
 *                  FRONT of the bench so the pivot brings it in.
 *
 * THE FIXTURE MUST PROVE IT STAGED, and it is checked against the AUTHORITY'S OWN LOG rather than
 * ours: Showdown must write two `|switch|` lines for p1 slot a inside the pivot turn. If it writes
 * one, the victim did not die, and every "agreement" below would be agreement about nothing.
 *
 * ================= THE KNOB =====================================================================
 *
 * `MEDI_MIRROR_END_OF_TURN=1` restores the end-of-turn read. It is re-run in a CHILD and must move
 * the outcome — an identical result across a varied knob means the knob is unwired, not that it does
 * not matter. Under it this probe reports the defect's own sentence:
 * *"slot 1 holds <pivoter>, which showdown already has ACTIVE on the field"*.
 *
 * ================= WHICH SCOREBOARD THIS SHOULD MOVE ============================================
 *
 * BOTH, and that is unusual. The lab stages it here. The POOL is where it was found and where it is
 * worth something: it is an instrument stop, so fixing it lengthens 42 real games and raises the
 * arm's completion rate. Predicted before the run and reported in
 * `docs/_reports/2026-08-29-forced-switch-mirror.md`.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_MIRROR_END_OF_TURN === '1';

require(D('tests', '_live_release.js'));
process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const TAGS = require(D('data', 'tags.json'));

let bad = 0;
const ok = (cond, name, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};
const stop = (why) => { console.log('\n  ' + why); process.exit(2); };

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const mtag = (t) => Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes(t)).map(([k]) => k);

console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* THE PIVOT. `pivotStatus` is the half that leaves without needing to connect. */
const PIVOTS = mtag('pivotStatus');
console.log('  moves tagged pivotStatus           : ' + PIVOTS.join(' '));

/* THE KILLER. Tagged `userFaints` AND `fixedDamage`, and its damageCallback must read the USER'S
 * OWN HP — that is what makes it a deterministic OHKO rather than a big number. Read off the dex. */
const KILL_ALL = mtag('userFaints').filter(k => mtag('fixedDamage').includes(k));
console.log('  userFaints AND fixedDamage         :');
for (const k of KILL_ALL) {
  const m = dex.moves.get(k);
  const src = m.damageCallback ? String(m.damageCallback) : '';
  console.log('      ' + k.padEnd(14) + ' target=' + m.target + '  damage=own hp: '
    + (/pokemon\.hp/.test(src) ? 'yes' : 'no ') + '  type=' + m.type);
}
const KILL = KILL_ALL.find(k => {
  const m = dex.moves.get(k);
  return m.target === 'normal' && /pokemon\.hp/.test(String(m.damageCallback || ''));
});
if (!KILL) stop('NO SELF-KO MOVE DEALS THE USER\'S OWN HP TO ONE FOE — a claim about the format.');
const KILL_TYPE = dex.moves.get(KILL).type;
const KILL_USERS = POOL.filter(s => LEARNS(s, KILL) && LEARNS(s, 'protect'))
  .sort((a, b) => b.baseStats.hp - a.baseStats.hp);
if (!KILL_USERS.length) stop('NOBODY LEGAL LEARNS ' + KILL + ' AND PROTECT — a claim about the format.');
const KILLER = KILL_USERS[0];

/* THE PIVOT USER. Fastest legal learner whose slot-0 ability RAISES the priority of a status move —
 * derived from the tag, so the pivot is guaranteed to resolve before the killer without a spread. */
const abPriority = (s) => {
  const p = TAGS.abilities && TAGS.abilities[String(s.abilities[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '')];
  const pr = p && p.params && p.params.priorityMod;
  return !!(pr && +pr.shift > 0 && pr.movesOfClass === 'status');
};
const PIVOT_ALL = POOL.filter(s => PIVOTS.some(mv => LEARNS(s, mv)) && LEARNS(s, 'protect'));
console.log('  legal pivotStatus users            : '
  + PIVOT_ALL.map(s => s.name + '(spe' + s.baseStats.spe + ',ab0=' + s.abilities[0]
    + (abPriority(s) ? ',PRIORITY' : '') + ')').join(', '));
const PIVOT_USER = PIVOT_ALL.filter(abPriority).sort((a, b) => b.baseStats.spe - a.baseStats.spe)[0];
if (!PIVOT_USER) stop('NO PIVOT USER CARRIES A PRIORITY-RAISING SLOT-0 ABILITY — a claim about the format.');
const PIVOT = PIVOTS.filter(mv => LEARNS(PIVOT_USER, mv))[0];

/* THE VICTIM. The frailest legal body the killer's type can touch at all. Its max HP must be under
 * the killer's, or the "deterministic OHKO" is not one — checked below against the real builds. */
const VICTIM = POOL.filter(s => LEARNS(s, 'protect')
    && dex.getEffectiveness(KILL_TYPE, s.types) > -6
    && !dex.getImmunity(KILL_TYPE, s.types) === false
    && s.name !== PIVOT_USER.name && s.name !== KILLER.name)
  .filter(s => dex.getImmunity(KILL_TYPE, s.types))
  .sort((a, b) => a.baseStats.hp - b.baseStats.hp)[0];
if (!VICTIM) stop('NO FRAIL BODY IS HITTABLE BY ' + KILL + ' — a claim about the format.');

const REST = POOL.filter(s => LEARNS(s, 'protect')
  && ![PIVOT_USER.name, KILLER.name, VICTIM.name].includes(s.name)).slice(0, 6);
if (REST.length < 5) stop('NOT ENOUGH LEGAL FILLER — a claim about the format.');

console.log('  pivot / killer / victim            : ' + PIVOT + ' on ' + PIVOT_USER.name
  + '  |  ' + KILL + ' on ' + KILLER.name + '  |  ' + VICTIM.name);

const mon = (species, moves) => ({ species, item: '', ability: '', moves });
/* SLOT 2 OF THE TEAM IS THE FRONT OF THE BENCH, which is what the pivot brings in. */
const SIDE_A = [mon(PIVOT_USER.name, [dex.moves.get(PIVOT).name, 'Protect']),
                mon(REST[0].name, ['Protect']),
                mon(VICTIM.name, ['Protect']),
                mon(REST[1].name, ['Protect'])];
const SIDE_B = [mon(KILLER.name, [dex.moves.get(KILL).name, 'Protect']),
                mon(REST[2].name, ['Protect']), mon(REST[3].name, ['Protect']), mon(REST[4].name, ['Protect'])];

const a = G.buildPair(SIDE_A), b = G.buildPair(SIDE_B);
if (!a || !b) stop('COULD NOT BUILD THE PAIR — a claim about the fixture.');
/* THE HP COMES OFF THE BUILT BODIES, through the driver's own builder — never a level-50 formula
 * typed here. `finalgambit` deals the user's CURRENT hp, so killer >= victim is the whole condition
 * and it is checked before the game rather than explained after it. */
const built = (pair, i) => { const f = G.freshBodies(pair)[i]; return (f && f.st) ? f.st.hp : null; };
const HP_K = built(b, 0), HP_V = built(a, 2);
console.log('  built HP: killer ' + HP_K + '   victim ' + HP_V
  + '   -> the OHKO is ' + (HP_K != null && HP_V != null && HP_K >= HP_V ? 'CERTAIN' : 'NOT CERTAIN'));
if (!(HP_K != null && HP_V != null && HP_K >= HP_V))
  stop('THE KILLER CANNOT ONE-SHOT THE VICTIM (' + HP_K + ' vs ' + HP_V
     + ') — a claim about the fixture, not about the engine.');

/* ONE TURN. The pivot goes first on priority; the killer then hits whatever is standing in p1a. */
const SCRIPT = [
  { p1: [{ m: PIVOT, t: 0 }, { m: 'protect' }], p2: [{ m: KILL, t: 0 }, { m: 'protect' }] },
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
];

G.resetScriptCounters(); G.resetChoiceCounters();
const r = G.playGame(a, b, 'directed', 'fsmirror', { arm: G.ARM_BY_ID.get('middle'), script: SCRIPT });
const SC = G.scriptCounters(), CC = G.choiceCounters();
const sd = G.sdStream(G.lastSdLog()), me = r.mediTrace || [];

console.log('\n  === THE TURN ===');
console.log('   SHOWDOWN'); sd.forEach(l => console.log('      ' + l));
console.log('   MEDICHAM2'); me.forEach(l => console.log('      ' + l));

console.log('\n  === THE CHECKS ===');
ok(SC.moveNotOnRequest === 0, 'every scripted click was on the authority\'s own request',
   SC.moveNotOnRequest + ' were not; first: ' + (SC.firstMissing || '(none)'));

/* ---- THE FIXTURE STAGED, JUDGED ON THE AUTHORITY'S LOG -------------------------------------------
 * Two `|switch|` lines naming p1a between the pivot and the turn's `|upkeep`. One means the victim
 * lived, and then nothing below is a test of the mirror at all. */
/* SCOPED TO THE PIVOT TURN, from `|turn|1` to `|turn|2`. The whole log also holds the LEAD's own
 * switch line, and counting that would make a fixture that never staged look like one that did. */
const turnWindow = (lines, n) => {
  const i = lines.findIndex(l => l === '|turn|' + n);
  if (i < 0) return [];
  const j = lines.findIndex((l, k) => k > i && l === '|turn|' + (n + 1));
  return lines.slice(i + 1, j < 0 ? lines.length : j);
};
const sdSwitchesP1a = turnWindow(sd, 1).filter(l => /^\|switch\|p1a:/.test(l));
ok(sdSwitchesP1a.length === 2,
   'the AUTHORITY put TWO bodies into p1 slot a in one turn — the fixture staged',
   sdSwitchesP1a.length + ' switch line(s): ' + (sdSwitchesP1a.join('   ') || '(none)'));
if (sdSwitchesP1a.length !== 2 && !CHILD) { console.log('\n  FAIL — the fixture did not stage'); process.exit(1); }

ok(CC.refused === 0, 'showdown refused EXACTLY 0 of this harness\'s choices',
   'refused=' + CC.refused + '  first: ' + (CC.first || '(none)'));
ok(CC.unmirrorable === 0, 'and EXACTLY 0 forced switches were unmirrorable',
   'unmirrorable=' + CC.unmirrorable + '  ' + (CC.unmirrorableFirst || ''));
ok(CC.switched >= 2, 'the mirror actually filled the two requests rather than passing them',
   CC.switched + ' slots filled, ' + CC.passed + ' passed');

/* ---- AND THE TWO STREAMS AGREE — the outcome, not the classification ---------------------------- */
ok(!r.div, 'the two engines agree line for line through the whole staged turn',
   r.div ? 'first divergence at index ' + r.div.index + ': SD ' + r.div.showdown
           + '   ME ' + r.div.medicham
         : 'no protocol divergence');
ok(!/boards parted/.test(String(r.endReason || '')),
   'and the game was not stopped by the mirror',
   'endReason: ' + r.endReason);

/* ---- THE KNOB MUST MOVE THE OUTCOME -------------------------------------------------------------- */
if (!CHILD) {
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [__filename],
      { env: Object.assign({}, process.env, { MEDI_MIRROR_END_OF_TURN: '1' }),
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { out = String((e.stdout || '') + (e.stderr || '')); code = e.status == null ? -1 : e.status; }
  const sawStop = /boards parted/.test(out);
  const sawActive = /already has ACTIVE on the field/.test(out);
  console.log('\n  === THE CONTROL: MEDI_MIRROR_END_OF_TURN=1 ===');
  console.log('      child exit ' + code + '   stopped on the mirror: ' + sawStop
    + '   named the ACTIVE refusal: ' + sawActive);
  ok(sawStop && sawActive,
     'the knob RESTORES the defect — an identical result across a varied knob means it is unwired',
     out.split('\n').filter(l => /unmirrorable=|endReason:/.test(l)).join('  |  ').slice(0, 300)
     || '(the child printed neither counter)');
}

console.log('\n  ' + (bad ? 'FAIL — ' + bad + ' check(s) red' : 'ALL CHECKS PASS'));
process.exit(bad ? 1 : 0);
