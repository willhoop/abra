/* probe_trap_timing.js — WHEN IS A SWITCH REFUSED FOR BEING TRAPPED: AT CHOICE TIME, OR AT EXECUTION?
 *
 *   node tests/probe_trap_timing.js --release <id>
 *
 * ================= WHY THIS EXISTS ===============================================================
 *
 * Two of the board-material games left in the whole-game differential on release `2ecd3bdc274b` were
 * "a chosen switch the authority performs and medicham2 does not":
 *
 *   pair-redirect-priority t11   |switch|p1a|krookodile   <> |detailschange|p1b|charizardmegay
 *   omit-protect           t8    |switch|p2a|crabominable <> |cant|p1b|recharge
 *
 * ENGINE handed them over with the harness as the named suspect: `game_differential.js` sends
 * `switch N` against a `side.pokemon` array Showdown REORDERS, so an index captured before a switch
 * would not name the same body afterwards. That premise was REFUTED by MEASURE at 63,258 sends with
 * 43,125 against an already-permuted party and 0 misaddressed
 * (docs/_reports/2026-08-25-switch-index-instrument.md). Both games have the same real mechanism:
 *
 *   SHOWDOWN decides "is this body trapped" ONCE, when it builds the request — `Pokemon#runTrapped`
 *   during `makeRequest`, read by `Side#chooseSwitch` (sim/side.ts), which refuses at CHOICE time.
 *   Nothing re-asks afterwards: once a switch is in the queue, `Battle#runAction`'s `case 'switch'`
 *   performs it. A trapper that arrives LATER in the same turn does not retro-cancel a switch that
 *   was already chosen.
 *
 *   medicham2 decided it inside the switch's own execution branch, which runs AFTER the faster switch
 *   on the other side has already put the trapper on the field.
 *
 * In both corpus games a Gengar-Mega (Shadow Tag — the FORMAT'S ONLY `preventsSwitch` carrier,
 * derived, not recalled) switched in earlier in the same turn than the body that was leaving.
 *
 * ================= WHAT THIS IS ==================================================================
 *
 * A PROBE, not a gate. It is not in tests/run-all.js. It stages the shape as data — the corpus games
 * cannot be summoned on demand, and a COULD-NOT-STAGE verdict is a claim about the fixture and never
 * about the mechanic.
 *
 * IT ASSERTS THE FIXED STATE AND PROVES IT CAN GO RED. `MEDI_TRAP_AT_EXECUTION=1` restores the
 * pre-fix read; the probe re-runs ITSELF as a child under that knob and FAILS if the child passes.
 * Nothing here is judged by whether an arm "looks" right — every arm is two protocol streams, and the
 * knob is what proves the arms are wired to the thing being changed.
 *
 * EIGHT ARMS. A fixture that is immune for two reasons proves nothing, so every control moves exactly
 * one thing away from the arm it controls.
 *
 *   A  TEST      the trapper ARRIVES this turn, one switch ahead of the victim's  -> AGREES (was: PARTS)
 *   B  CONTROL   identical, entrant is a plain Gengar (Cursed Body, no trap)      -> AGREES
 *   C  CONTROL   identical to A, the victim holds a Shed Shell (`escapesTrap`)    -> AGREES
 *   D  CONTROL   identical to A, the victim is a GHOST (the engine's own exemption)-> AGREES
 *   E  POSITIVE  the trapper is ALREADY on the field when the request is built    -> THE AUTHORITY
 *                                                                                    REFUSES, and this
 *                                                                                    engine refuses too
 *   F  POSITIVE  as E, but the victim holds a Shed Shell                          -> AUTHORITY ACCEPTS,
 *                                                                                    both switch
 *   G  POSITIVE  as E, but the victim is a Ghost                                  -> AUTHORITY ACCEPTS,
 *                                                                                    both switch
 *   H  SECOND    the MOVE trap (Mean Look), lapsing mid-turn instead of arriving  -> the SAME phase
 *      BRANCH    — its source leaves on a faster switch than the victim's            gap, other sign
 *
 * WHY E, F AND G ARE ALL NEEDED. E names the mechanism rather than the symptom: same trapper, same
 * victim, same switch — moved one phase earlier and Showdown itself says no, so a fix that simply
 * deleted the trap from the switch branch would leave E unexplained. But E on its own would also be
 * satisfied by an engine that refuses EVERY switch, and after this fix arms C and D no longer hold the
 * exemptions down: with the trapper arriving mid-turn, nobody is trapped at choice time and the Shed
 * Shell and the Ghost typing are never consulted. F and G move the same two exemptions to the phase
 * where they ARE consulted, and the authority accepts both.
 *
 * WHY H IS HERE. `preventsSwitch`, `_trapHard` (Block / Mean Look), Fairy Lock and the partial trap
 * (`_trap`) were four separate refusals computed at the same wrong moment. The ability branch is the
 * one a trapper can ARRIVE on; the other three are branches a trap can LAPSE on — `_trapHard` dies
 * when its source leaves the field, and a source leaving is itself a bare switch that can resolve
 * first. H stages that opposite sign and reads the engine's own choice-vs-execution counter. Fairy
 * Lock and the partial trap are NOT staged here and are answered by the same counters over the pinned
 * pool instead, which is a measurement rather than an argument.
 */
'use strict';
require('../engine/showdown_path.js');
if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — set SHOWDOWN_PATH to a built pokemon-showdown checkout. This is not a pass.');
  process.exit(2);
}
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
/* --release MUST be present before game_differential is required: without it that module CUTS A
 * RELEASE into the real store at require time. Same refusal replay_one.js makes, for the same reason. */
if (!arg('--release', null)) {
  console.error('REFUSED — pass --release <id>. Requiring engine/game_differential.js without it CUTS');
  console.error('A RELEASE into data/releases as a side effect of loading the module.');
  process.exit(2);
}

const KNOB = process.env.MEDI_TRAP_AT_EXECUTION === '1';
const IS_CHILD = process.env.PROBE_TRAP_TIMING_CHILD === '1';

const GD = require('../engine/game_differential.js');
const { buildPair, playGame, REL } = GD;
const M = REL.require('engine/medicham2-browser.js');

const mon = (species, item, ability, moves) => ({ species, item, ability, moves });
const PROTECT = ['Protect', 'Agility'];

/* THE TRAPPER IS DERIVED, NOT NAMED. `preventsSwitch` has exactly one legal carrier in this
 * regulation; if a later regulation adds one this picks it up without an edit, and if it ever
 * removes Gengar-Mega the probe says COULD-NOT-STAGE instead of quietly testing nothing. */
const TAGS = require('../data/tags.json');
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const idOf = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const trapAbilities = Object.keys(TAGS.abilities || {})
  .filter(a => (TAGS.abilities[a].tags || []).includes('preventsSwitch'))
  .map(a => DEX.abilities.get(a).name);
const trapAbilityIds = new Set(trapAbilities.map(idOf));
const trappers = DEX.species.all().filter(legal)
  .filter(s => Object.values(s.abilities).some(ab => trapAbilities.includes(ab)));
if (!trappers.length) {
  console.log('COULD-NOT-STAGE — no legal `preventsSwitch` carrier in this regulation. That is a');
  console.log('claim about the FORMAT, and it is stated rather than passed over.');
  process.exit(0);
}
const TRAPPER = trappers[0];
const TRAP_ABILITY = Object.values(TRAPPER.abilities).find(ab => trapAbilities.includes(ab));

/* THE MOVE TRAP'S CARRIER IS DERIVED THE SAME WAY, and through the format's own TeamValidator rather
 * than a hand-walked learnset — an evolved forme's list lives partly on its prevo and a walk that
 * misses either invents a zero (champions_sim.js's header records 7 carriers against the validator's
 * 26 on one move). It must ALSO carry no `preventsSwitch` ability, or arm H would be measuring both
 * branches at once. */
const CS = require('../engine/champions_sim.js');
const HARD_TRAP_MOVES = Object.keys(TAGS.moves || {}).filter(m => {
  const p = TAGS.moves[m].params && TAGS.moves[m].params.trapsTarget;
  return p && p.volatile === 'trapped' && !p.viaSecondary;
});
let TRAPMOVER = null;
for (const mv of HARD_TRAP_MOVES) for (const n of CS.moveCarriers(mv)) {
  const sp = DEX.species.get(n);
  if (!sp || !sp.exists) continue;
  if (Object.values(sp.abilities || {}).some(a => trapAbilityIds.has(idOf(a)))) continue;
  if (!TRAPMOVER || sp.baseStats.spe > TRAPMOVER.spe)
    TRAPMOVER = { id: sp.id, name: sp.name, spe: sp.baseStats.spe, mv,
                  ability: Object.values(sp.abilities)[0] };
}

/* The victim must be SLOWER than the body the trapper replaces, so the trapper's switch resolves
 * first — that ordering IS the fixture. Both are read off the dex rather than assumed. */
const OUTGOING = 'whimsicott';                 // spe 116, the body that leaves to bring the trapper in
const VICTIM   = 'snorlax';                    // spe 30, Normal — not Ghost, so no exemption applies
const GHOST    = 'spiritomb';                  // spe 35, Ghost — the engine's own exemption
const spe = n => DEX.species.get(n).baseStats.spe;
if (!(spe(OUTGOING) > spe(VICTIM) && spe(OUTGOING) > spe(GHOST))) {
  console.log('COULD-NOT-STAGE — the switch order this fixture depends on does not hold: '
    + OUTGOING + ' ' + spe(OUTGOING) + ' vs ' + VICTIM + ' ' + spe(VICTIM) + ' / ' + GHOST + ' ' + spe(GHOST));
  process.exit(0);
}

const NONTRAPPER = 'gengar';                   // Cursed Body — same body, no trap

function sides(o) {
  const p1 = [ mon(o.victim, o.item || '', o.victimAbility || '', PROTECT),
               mon('clefable', '', 'Magic Guard', PROTECT),
               mon('milotic', '', 'Marvel Scale', PROTECT),
               mon('garchomp', '', 'Rough Skin', PROTECT) ];
  const p2 = o.trapperLeads
    ? [ mon('corviknight', '', 'Pressure', PROTECT),
        mon(o.entrant, '', o.entrantAbility, PROTECT),
        mon(OUTGOING, '', 'Chlorophyll', PROTECT),
        mon('toxapex', '', 'Regenerator', PROTECT) ]
    : [ mon('corviknight', '', 'Pressure', PROTECT),
        mon(OUTGOING, '', 'Chlorophyll', PROTECT),
        mon(o.entrant, '', o.entrantAbility, PROTECT),
        mon('toxapex', '', 'Regenerator', PROTECT) ];
  return { p1, p2 };
}

/* ONE MEASURED TURN. p1a asks to leave; p2b asks to bring the entrant in. Everything else Protects,
 * so nothing in this fixture rolls a die and no damage is dealt: the only thing that can move the
 * verdict is whether the two engines perform the same two switches. */

const COUNTERS = ['trapBlockedSwitch', 'shedShellEscapedTrap', 'moveTrapBlockedSwitch',
                  'fairyLockBlockedSwitch', 'trapBlockedSwitchByMove',
                  'trapChoiceTimeDiffered', 'trapChoiceTimeDifferedAbility',
                  'trapChoiceTimeDifferedMove'];

function play(name, p1, p2, script) {
  const a = buildPair(p1), b = buildPair(p2);
  if (!a || !b) return { name, staged: false, d: {} };
  const before = {}; for (const k of COUNTERS) before[k] = M.seen[k];
  const beforeUnstamped = M.fails.trapVerdictUnstamped;
  const r = playGame(a, b, 'directed', 'trap-timing/' + name, { script });
  const d = {}; for (const k of COUNTERS) d[k] = M.seen[k] - before[k];
  return { name, staged: true, err: r.err || null, turns: r.turns,
           diverged: !!r.div, at: r.div ? r.div.index : null,
           sd: r.div ? r.div.sdRaw : null, me: r.div ? r.div.meRaw : null,
           unstamped: M.fails.trapVerdictUnstamped - beforeUnstamped, d };
}

function run(name, o) {
  const s = sides(o);
  const script = [{ p1: [{ sw: 'milotic' }, { m: 'protect' }],
                    p2: [{ m: 'protect' }, o.trapperLeads ? { m: 'protect' } : { sw: o.entrant }] }];
  return play(name, s.p1, s.p2, script);
}

/* ---- ARM H: THE MOVE TRAP, LAPSING RATHER THAN ARRIVING -----------------------------------------
 * Turn 1 the mover lands its hard trap on the victim. Turn 2 BOTH bodies ask to switch: the mover is
 * far faster, so its bare switch resolves first and `_trapHard` dies with its source — before the
 * victim's own switch is executed. The AUTHORITY refuses the victim's choice, because at request time
 * the mover had not left yet.
 *
 * ITS VERDICT IS A COUNTER, NOT A DIVERGENCE, and that is forced by the fixture: a refused choice
 * ends the Showdown game, so there are no two boards to compare. `trapChoiceTimeDifferedMove` is the
 * engine reporting, in its own words, that its choice-time and execution-time answers disagreed on
 * this turn — which is exactly the defect. A zero means the lapse never happened and the arm says
 * COULD-NOT-STAGE rather than passing. */
function runH() {
  if (!TRAPMOVER) return { name: 'H', staged: false, d: {} };
  const p1 = [ mon(VICTIM, '', '', PROTECT),
               mon('clefable', '', 'Magic Guard', PROTECT),
               mon('milotic', '', 'Marvel Scale', PROTECT),
               mon('garchomp', '', 'Rough Skin', PROTECT) ];
  const p2 = [ mon('corviknight', '', 'Pressure', PROTECT),
               mon(TRAPMOVER.id, '', TRAPMOVER.ability, ['Protect', TRAPMOVER.mv]),
               mon('toxapex', '', 'Regenerator', PROTECT),
               mon('milotic', '', 'Marvel Scale', PROTECT) ];
  const script = [
    { p1: [{ m: 'agility' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: TRAPMOVER.mv, t: 0 }] },
    { p1: [{ sw: 'milotic' }, { m: 'protect' }], p2: [{ m: 'protect' }, { sw: 'toxapex' }] },
  ];
  return play('H', p1, p2, script);
}

const ARMS = [
  ['A TEST     trapper ARRIVES this turn', { victim: VICTIM, entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY }, 'AGREES'],
  ['B CONTROL  entrant carries no trap',   { victim: VICTIM, entrant: NONTRAPPER, entrantAbility: 'Cursed Body' }, 'AGREES'],
  ['C CONTROL  victim holds a Shed Shell', { victim: VICTIM, item: 'Shed Shell', entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY }, 'AGREES'],
  ['D CONTROL  victim is a Ghost',         { victim: GHOST, entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY }, 'AGREES'],
  ['E POSITIVE trapper ALREADY on field',  { victim: VICTIM, entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY, trapperLeads: true }, 'AUTHORITY REFUSES'],
  ['F POSITIVE as E + a Shed Shell',       { victim: VICTIM, item: 'Shed Shell', entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY, trapperLeads: true }, 'AGREES'],
  ['G POSITIVE as E + a Ghost victim',     { victim: GHOST, entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY, trapperLeads: true }, 'AGREES'],
];

console.log('');
console.log('probe_trap_timing — release ' + arg('--release', '?')
  + (KNOB ? '   [MEDI_TRAP_AT_EXECUTION=1 — THE DEFECT RESTORED, THIS RUN MUST GO RED]' : ''));
console.log('  trapper    ' + TRAPPER.name + ' / ' + TRAP_ABILITY + '   (derived: the only legal `preventsSwitch` carrier)');
console.log('  victim     ' + VICTIM + ' spe ' + spe(VICTIM) + '   leaves AFTER ' + OUTGOING + ' spe ' + spe(OUTGOING));
console.log('  move trap  ' + (TRAPMOVER ? TRAPMOVER.name + ' spe ' + TRAPMOVER.spe + ' / ' + TRAPMOVER.mv
                                         + '   (derived: fastest legal carrier of ' + HARD_TRAP_MOVES.join('/')
                                         + ' that is not itself an ability trapper)'
                                         : 'COULD-NOT-STAGE — no legal carrier'));
console.log('');
const out = [];
function show(label, expect, r) {
  const verdict = !r.staged ? 'COULD-NOT-STAGE'
    : r.err ? 'THREW: ' + String(r.err).slice(0, 110)
    : r.diverged ? '*** PARTS *** at reduced index ' + r.at : 'AGREES';
  console.log('  ' + label.padEnd(40) + ' expect ' + expect.padEnd(18) + ' -> ' + verdict);
  console.log('      ' + COUNTERS.filter(k => r.d[k]).map(k => k + ' +' + r.d[k]).join('   ')
    + (COUNTERS.every(k => !r.d[k]) ? 'no trap counter moved' : '')
    + (r.unstamped ? '   *** trapVerdictUnstamped +' + r.unstamped + ' ***' : ''));
  if (r.diverged) { console.log('        SD  ' + r.sd); console.log('        US  ' + r.me); }
}
for (const [label, o, expect] of ARMS) {
  const r = run(label.slice(0, 1), o);
  out.push({ label, expect, r });
  show(label, expect, r);
}
const H = runH();
show('H SECOND   the MOVE trap, lapsing mid-turn', 'CHOICE<>EXEC', H);
console.log('');

const A = out[0].r, B = out[1].r, C = out[2].r, D = out[3].r, E = out[4].r, F = out[5].r, G = out[6].r;
const checks = [
  ['A  the arriving trapper no longer cancels a chosen switch', A.staged && !A.err && !A.diverged && A.d.trapBlockedSwitch === 0],
  ['A  and the engine SAYS its two phases disagreed on it',     A.staged && A.d.trapChoiceTimeDifferedAbility === 1],
  ['B  CONTROL no trap at all — agrees, nothing fires',         B.staged && !B.err && !B.diverged && B.d.trapBlockedSwitch === 0],
  ['C  CONTROL Shed Shell — agrees',                            C.staged && !C.err && !C.diverged && C.d.trapBlockedSwitch === 0],
  ['D  CONTROL Ghost victim — agrees',                          D.staged && !D.err && !D.diverged && D.d.trapBlockedSwitch === 0],
  ['E  the trap STILL FIRES when it was there at choice time',  E.staged && !!E.err && E.d.trapBlockedSwitch === 1],
  ['F  and a Shed Shell still gets out of it at choice time',   F.staged && !F.err && !F.diverged && F.d.shedShellEscapedTrap === 1 && F.d.trapBlockedSwitch === 0],
  ['G  and a Ghost still gets out of it at choice time',        G.staged && !G.err && !G.diverged && G.d.trapBlockedSwitch === 0],
  ['H  the MOVE trap shows the same phase gap, other sign',     H.staged && H.d.trapChoiceTimeDifferedMove === 1],
  ['-  no bare switch reached execution unstamped',             [A, B, C, D, E, F, G, H].every(r => !r.unstamped)],
];
let ok = true;
for (const [what, pass] of checks) { if (!pass) ok = false; console.log('  ' + (pass ? 'ok  ' : 'FAIL') + '  ' + what); }
console.log('');

/* ONE EXIT RULE FOR BOTH RUNS, AND THAT IS THE POINT. The probe asserts the FIXED state and nothing
 * else, so "green without the knob, red under it" is a property of the same checks rather than of two
 * different expectations — an inverted expectation under the knob would pass on an engine that had
 * simply stopped playing the fixture. */
process.exitCode = ok ? 0 : 1;
if (KNOB) {
  console.log(ok
    ? '  VERDICT: *** THE KNOB CHANGED NOTHING. *** MEDI_TRAP_AT_EXECUTION=1 restores the pre-fix read\n'
    + '           and every arm still passed, so these arms are not wired to the thing that changed.\n'
    + '           A probe that cannot go red is not evidence. THIS IS A FAILURE.'
    : '  VERDICT: RED under the knob, as it must be — the pre-fix read is restored and the arms above\n'
    + '           are wired to the phase the trap is evaluated at.');
} else {
  console.log(ok
    ? '  VERDICT: `preventsSwitch` is evaluated at CHOICE time, as the authority does. A trapper that\n'
    + '           arrives later in the same turn no longer cancels a switch already chosen (A), the\n'
    + '           trap still refuses when it WAS there at choice time (E), and both exemptions still\n'
    + '           release at that phase (F, G). The move trap shares the mechanism (H).'
    : '  VERDICT: NOT the expected pattern. Read the arms above before concluding anything.');
  /* THE RED CONTROL, RUN RATHER THAN DESCRIBED. Same file, same release, one env var. */
  if (!IS_CHILD) {
    const { spawnSync } = require('child_process');
    console.log('\n  --- re-running THIS FILE under MEDI_TRAP_AT_EXECUTION=1; it MUST exit non-zero ---');
    const c = spawnSync(process.execPath, [__filename].concat(process.argv.slice(2)),
      { env: Object.assign({}, process.env, { MEDI_TRAP_AT_EXECUTION: '1', PROBE_TRAP_TIMING_CHILD: '1' }),
        encoding: 'utf8' });
    const tail = String(c.stdout || '').split('\n').filter(l => /^  (ok|FAIL)|VERDICT|expect/.test(l));
    for (const l of tail) console.log('    ' + l.trim());
    const red = c.status !== 0;
    console.log('    child exit ' + c.status + ' — ' + (red ? 'RED, as required' : '*** GREEN: the knob is unwired ***'));
    if (!red) process.exitCode = 1;
  }
}
console.log('');
