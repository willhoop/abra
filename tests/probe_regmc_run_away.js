#!/usr/bin/env node
/* tests/probe_regmc_run_away.js — RUN AWAY FREES ITS HOLDER FROM A TRAP, UNDER REG M-C. 2026-09-22 (ENGINE pass 8,
 * abra/regmc 0.66.0).
 *
 *   node tests/probe_regmc_run_away.js --regulation regmc                               # green, exit 0
 *   MEDI_RUN_AWAY_TRAPPED=1 node tests/probe_regmc_run_away.js --regulation regmc       # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/mods/champions/abilities.ts runaway :71-81 -- the Champions override of mainline's handler-less row:
 *       onTrapPokemonPriority: -10, onTrapPokemon(pokemon) { pokemon.trapped = false; },
 *       onMaybeTrapPokemonPriority: -10, onMaybeTrapPokemon(pokemon) { pokemon.maybeTrapped = false; },
 *   the same priority and line as Shed Shell's (data/items.ts shedshell). `Pokemon#runTrapped` runs the TrapPokemon event
 *   when the request is built, so every trap -- a move-laid `trapped` volatile (Block, Mean Look) and a partial trap
 *   (`partiallytrapped`'s own `onTrapPokemon` -> `tryTrap`) -- is cleared after it is set; `Side#chooseSwitch` then
 *   accepts the switch.
 *
 * ================= THE DEFECT ====================================================================
 *
 *   medicham2 read `escapesTrap` off the ITEM only; no ability carried it (the tag's own note said "NO ability does",
 *   true of Reg M-B). A trapped Run Away body stayed in its slot where the authority let it go. Found by the Reg M-C
 *   roster the first time it trapped one (`ability/escapes-a-trap`).
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   HARD      p2 lays a `trapped` move on the holder on turn 1; turn 2 the holder switches out. It leaves.
 *   PARTIAL   the same with a partial-trapping move. It leaves.
 *   CONTROL   the HARD script with the holder on another of its own abilities: the AUTHORITY REFUSES the switch.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_run_away', ['MEDI_RUN_AWAY_TRAPPED']);
const { D, ok, SPEC, learns, abil, quiet, sure, bulk, mon, pickDistinct, show, P } = K;

/* 1. THE CAST, DERIVED */
const HOLD = SPEC.filter(s => abil(s).includes('runaway') && !s.types.includes('Ghost') && learns(s, 'protect'));
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && !s.types.includes('Ghost')).sort((a, b) => bulk(b) - bulk(a));
const HARD = D.moves.all().filter(m => K.legal(m) && m.category === 'Status' && m.target === 'normal' && sure(m)
  && /addVolatile\(\s*["']trapped["']/.test(String(m.onHit || '')));
const PART = D.moves.all().filter(m => K.legal(m) && m.volatileStatus === 'partiallytrapped' && m.category !== 'Status'
  && m.target === 'normal' && sure(m));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     Run Away holders: ' + show(HOLD) + '\n     hard traps: ' + HARD.map(m => m.id).join(', ')
  + '\n     partial traps (100%): ' + PART.map(m => m.id).join(', '));
if (!HOLD.length || !HARD.length) { console.log('  NOT STAGED — no legal holder or no hard trap'); process.exit(1); }

const KEEP = /^\|(switch|-activate|-damage|move|cant|faint)\|/;
const OWN = /^\|(switch|faint)\|/;
const counters = () => ({ ra: K.M.MEDSEEN.runAwayAsked || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let cast = null;
for (const h of HOLD) {
  const other = abil(h).find(a => a !== 'runaway');
  const used = new Set([h.baseSpecies, h.id]);
  const trapper = FILL.find(s => !used.has(s.baseSpecies) && HARD.some(m => learns(s, m.id)));
  if (!trapper) continue;
  used.add(trapper.baseSpecies); used.add(trapper.id);
  const pt = PART.map(m => ({ m, u: FILL.find(s => !used.has(s.baseSpecies) && learns(s, m.id) && D.getImmunity(m.type, h)) })).find(x => x.u);
  const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies) && (!pt || s.baseSpecies !== pt.u.baseSpecies)), used, 4);
  if (fills.length < 4 || !(K.idle(h) || K.hitFor(h, trapper))) continue;
  cast = { h, other, trapper, hard: HARD.find(m => learns(trapper, m.id)), pt, fills };
  break;
}
if (!cast) { console.log('  NOT STAGED — no holder/trapper pair'); process.exit(1); }
const { h, other, trapper, hard, pt, fills } = cast;
/* the holder's own turn-1 click must not be Protect (the trap would bounce off it): an idle click, else its weakest hit */
const hIdle = K.idle(h) || K.hitFor(h, trapper);
console.log('     holder ' + h.id + ' (control ability ' + other + ')   trapper ' + trapper.id + ' (' + hard.id + ')'
  + (pt ? '   partial ' + pt.u.id + ' (' + pt.m.id + ')' : '   partial NONE'));

function arm(tag, ab, by, mv) {
  const A = [mon(h, '', [hIdle.name, 'Protect'], ab), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [mon(by, '', [mv.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  return play(tag, A, B, [{ p1: [K.idle(h) ? { m: hIdle.id } : { m: hIdle.id, t: 0 }, P.protect], p2: [{ m: mv.id, t: 0 }, P.protect] },
                          { p1: [{ sw: fills[1].id }, P.protect], p2: [P.protect, P.protect] }]);
}
const HD = arm('hard', 'runaway', trapper, hard);
const PT = pt ? arm('partial', 'runaway', pt.u, pt.m) : null;
const CT = arm('control', other, trapper, hard);
const RUNS = [['HARD', HD]].concat(PT ? [['PARTIAL', PT]] : []);
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const left = R => R.sdK.filter(l => new RegExp('^\\|switch\\|p1a:' + fills[1].id).test(l)).length;
ok(left(HD) === 1, 'HARD — trapped on turn 1, and on turn 2 the Run Away holder LEAVES', JSON.stringify(HD.sdK.slice(-4)));
if (PT) ok(left(PT) === 1, 'PARTIAL — partially trapped on turn 1, and on turn 2 it leaves', JSON.stringify(PT.sdK.slice(-4)));
ok(!CT.staged && /trapped/i.test(CT.why || ''), 'CONTROL — with ' + other + ' the authority REFUSES the switch (the trap is real)',
  CT.staged ? 'the switch was accepted' : CT.why);

K.compareArms(RUNS, OWN, 'switch / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(HD.counters.ra >= 1, 'HARD: the engine asked the ability escape', JSON.stringify(HD.counters));
}
K.finish();
