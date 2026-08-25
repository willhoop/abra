/* probe_trap_timing.js — WHEN IS A SWITCH REFUSED FOR BEING TRAPPED: AT CHOICE TIME, OR AT EXECUTION?
 *
 *   node tests/probe_trap_timing.js --release <id>
 *
 * ================= WHY THIS EXISTS ===============================================================
 *
 * Two of the board-material games left in the whole-game differential on release `2ecd3bdc274b` are
 * "a chosen switch the authority performs and medicham2 does not":
 *
 *   pair-redirect-priority t11   |switch|p1a|krookodile   <> |detailschange|p1b|charizardmegay
 *   omit-protect           t8    |switch|p2a|crabominable <> |cant|p1b|recharge
 *
 * ENGINE handed them over with the harness as the named suspect: `game_differential.js` sends
 * `switch N` against a `side.pokemon` array Showdown REORDERS, so an index captured before a switch
 * would not name the same body afterwards. That premise is REFUTED (see the harness's own
 * `SWITCH_ADDRESSING` counter, which reads the index back off the authority's array on every switch
 * it sends). Both games have the same real mechanism, and it is this one:
 *
 *   SHOWDOWN decides "is this body trapped" ONCE, when it builds the request — `Side.chooseSwitch`
 *   (sim/side.ts) refuses at CHOICE time and nothing re-asks afterwards. A trapper that arrives
 *   LATER in the same turn does not retro-cancel a switch that was already chosen.
 *
 *   medicham2 decides it inside the switch's own execution branch (`engine/medicham2-browser.js`,
 *   WIRE 92 — `if(_held){MEDSEEN.trapBlockedSwitch++;continue;}`), which runs AFTER the faster
 *   switch on the other side has already put the trapper on the field.
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
 * FIVE ARMS. A fixture that is immune for two reasons proves nothing, so every control moves exactly
 * one thing away from arm A:
 *
 *   A  TEST      the trapper ARRIVES this turn, one switch ahead of the victim's    -> PARTS
 *   B  CONTROL   identical, entrant is a plain Gengar (Cursed Body, no trap)        -> AGREES
 *   C  CONTROL   identical to A, the victim holds a Shed Shell (`escapesTrap`)      -> AGREES
 *   D  CONTROL   identical to A, the victim is a GHOST (the engine's own exemption) -> AGREES
 *   E  POSITIVE  the trapper is ALREADY on the field when the request is built      -> THE AUTHORITY
 *                                                                                      REFUSES THE
 *                                                                                      CHOICE
 *
 * E is the arm that names the mechanism rather than the symptom: same trapper, same victim, same
 * switch — moved one phase earlier and Showdown itself says no. A fix that simply deletes the trap
 * from the switch branch would turn A green and leave E's refusal unexplained.
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
const trapAbilities = Object.keys(TAGS.abilities || {})
  .filter(a => (TAGS.abilities[a].tags || []).includes('preventsSwitch'))
  .map(a => DEX.abilities.get(a).name);
const trappers = DEX.species.all().filter(legal)
  .filter(s => Object.values(s.abilities).some(ab => trapAbilities.includes(ab)));
if (!trappers.length) {
  console.log('COULD-NOT-STAGE — no legal `preventsSwitch` carrier in this regulation. That is a');
  console.log('claim about the FORMAT, and it is stated rather than passed over.');
  process.exit(0);
}
const TRAPPER = trappers[0];
const TRAP_ABILITY = Object.values(TRAPPER.abilities).find(ab => trapAbilities.includes(ab));

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

function run(name, o) {
  const s = sides(o);
  const script = [{ p1: [{ sw: 'milotic' }, { m: 'protect' }],
                    p2: [{ m: 'protect' }, o.trapperLeads ? { m: 'protect' } : { sw: o.entrant }] }];
  const a = buildPair(s.p1), b = buildPair(s.p2);
  if (!a || !b) return { name, staged: false };
  const before = M.seen.trapBlockedSwitch, beforeShed = M.seen.shedShellEscapedTrap;
  const r = playGame(a, b, 'directed', 'trap-timing/' + name, { script });
  return { name, staged: true, err: r.err || null, turns: r.turns,
           diverged: !!r.div, at: r.div ? r.div.index : null,
           sd: r.div ? r.div.sdRaw : null, me: r.div ? r.div.meRaw : null,
           trapBlocked: M.seen.trapBlockedSwitch - before,
           shedEscaped: M.seen.shedShellEscapedTrap - beforeShed };
}

const ARMS = [
  ['A TEST     trapper ARRIVES this turn', { victim: VICTIM, entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY }, 'PARTS'],
  ['B CONTROL  entrant carries no trap',   { victim: VICTIM, entrant: NONTRAPPER, entrantAbility: 'Cursed Body' }, 'AGREES'],
  ['C CONTROL  victim holds a Shed Shell', { victim: VICTIM, item: 'Shed Shell', entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY }, 'AGREES'],
  ['D CONTROL  victim is a Ghost',         { victim: GHOST, entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY }, 'AGREES'],
  ['E POSITIVE trapper ALREADY on field',  { victim: VICTIM, entrant: TRAPPER.id, entrantAbility: TRAP_ABILITY, trapperLeads: true }, 'AUTHORITY REFUSES'],
];

console.log('');
console.log('probe_trap_timing — release ' + arg('--release', '?'));
console.log('  trapper   ' + TRAPPER.name + ' / ' + TRAP_ABILITY + '   (derived: the only legal `preventsSwitch` carrier)');
console.log('  victim    ' + VICTIM + ' spe ' + spe(VICTIM) + '   leaves AFTER ' + OUTGOING + ' spe ' + spe(OUTGOING));
console.log('');
const out = [];
for (const [label, o, expect] of ARMS) {
  const r = run(label.slice(0, 1), o);
  out.push({ label, expect, r });
  const verdict = !r.staged ? 'COULD-NOT-STAGE'
    : r.err ? 'THREW: ' + String(r.err).slice(0, 120)
    : r.diverged ? 'PARTS at reduced index ' + r.at : 'AGREES';
  console.log('  ' + label.padEnd(40) + ' expect ' + expect.padEnd(18) + ' -> ' + verdict);
  console.log('      trapBlockedSwitch +' + r.trapBlocked + '   shedShellEscapedTrap +' + r.shedEscaped);
  if (r.diverged) {
    console.log('        SD  ' + r.sd);
    console.log('        US  ' + r.me);
  }
}
console.log('');
const A = out[0].r, B = out[1].r, C = out[2].r, D = out[3].r, E = out[4].r;
const ok = A.staged && A.diverged && A.trapBlocked === 1
        && B.staged && !B.diverged && B.trapBlocked === 0
        && C.staged && !C.diverged && C.shedEscaped === 1
        && D.staged && !D.diverged && D.trapBlocked === 0
        && E.staged && !!E.err;
console.log(ok
  ? '  VERDICT: the defect is REPRODUCED and ISOLATED. Only the arm where the trapper ARRIVES parts;\n'
  + '           the same board with no trap, with a Shed Shell, or with a Ghost victim agrees; and\n'
  + '           with the trapper already in place the AUTHORITY ITSELF refuses the choice.\n'
  + '           => medicham2 evaluates `preventsSwitch` at EXECUTION time; Showdown at CHOICE time.'
  : '  VERDICT: NOT the expected pattern. Read the arms above before concluding anything.');
console.log('');
