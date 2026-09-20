#!/usr/bin/env node
/* tests/probe_heldout_board_partings.js — THREE OF THE NINE BOARD PARTINGS IN THE WIDER HELD-OUT DRAW.
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_heldout_board_partings.js
 *   ... MEDI_PRIMARY_VOLATILE_DIE_ALWAYS=1   (arm A red)  a 100% primary volatile still throws a die
 *   ... MEDI_ACC_ABILITY_UNBREAKABLE=1       (arm B red)  Sand Veil evades a Mold Breaker attacker
 *   ... MEDI_BOUNCE_BEFORE_SHIELD=1          (arm C red)  a shielded bouncer reflects a pivot anyway
 * ==================================================================================================
 *
 * 2026-09-20. The gate reads OPEN on its three lattices and the WIDER held-out draw — empirical /
 * middle / release `51b80f9fcf08` / census pin `8514757f99d5` / `data/team-pool-frozen` /
 * `--games 12000` / `--dump-games 12000`, 7,182 games — still parts nine boards. Three of them are
 * staged here. Each was replayed line by line with `engine/replay_one.js` under those same pins
 * before a byte moved, and each engine comment carries the seed and the turn.
 *
 *   A  `pair-speedctrl ...bo3-2655141321`, t5. A Toxapex's INFESTATION into a FLAME BODY Volcarona.
 *      The authority burned the Toxapex and this engine did not, and the dice say why: the address
 *      log read `any|infestation|p20|0` on the authority against `|0` AND `|1` here. The extra draw
 *      is the chance roll on Infestation's PRIMARY volatile, which the authority does not throw —
 *      `if (moveData.volatileStatus) { hitResult = target.addVolatile(...) }`,
 *      sim/battle-actions.ts:1236-1237, no chance and no `random`. Flame Body's own
 *      `randomChance(3, 10)` therefore read one `nth` late.
 *   B  `omit-intimidate ...bo3-2655224585`, t5. A MOLD BREAKER Tinkaton's Knock Off into a SAND VEIL
 *      Garchomp standing in its own Sandstorm. Both engines drew `acc|knockoff` at the same address;
 *      the authority HIT and this engine printed `|-miss|` (`p1.party.garchomp.hp medi 116 / sd 84`).
 *      `hitChance`'s ModifyAccuracy walk read the defender's RAW ability, and Sand Veil is
 *      `flags: {breakable: 1}` (data/abilities.ts:4008) — sim/battle.ts:835-840 drops a breakable
 *      ability's handler from EVERY event, ModifyAccuracy included.
 *   C  `baseline ...bo3-2659324893`, t8. Incineroar's PARTING SHOT at a Protecting MAGIC BOUNCE
 *      Hatterene. Protect's condition is `onTryHitPriority: 3` (data/moves.ts:13986) against Magic
 *      Bounce's `1` (data/abilities.ts:2428) and Protect returns `NOT_FAIL`, so the authority wrote
 *      `|-activate|p1a: Hatterene|move: Protect`. This engine reflected the move and then PIVOTED THE
 *      BOUNCER OUT. The shield check existed and lived at two of the nine call sites; the
 *      `pivotStatus` road — the one reflectable pivot in this format — was not one of them.
 *
 * WHAT IS ASSERTED. Arms A and B are read two ways: the middle arm's EVENT ADDRESSES must be the same
 * multiset on both engines (a die one engine throws and the other does not shifts `nth` for every
 * later die at that address), and the BOARD must agree at every turn boundary. Arm C is a board
 * assertion plus a positive control on the same fixture, because its defect writes no extra die.
 *
 * EVERY ARM CARRIES ITS CONTROL and the control is read, not assumed: A's control is the same click
 * into a body with no reaction ability at all, B's is the same attacker under its NON-breaker
 * ability, C's is the same Parting Shot at the same bouncer standing OPEN. An arm whose control
 * shows nothing is an arm that staged nothing, which is six-for-six how this division's probes have
 * failed.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '12');
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};
const K = { A: process.env.MEDI_PRIMARY_VOLATILE_DIE_ALWAYS === '1',
            B: process.env.MEDI_ACC_ABILITY_UNBREAKABLE === '1',
            C: process.env.MEDI_BOUNCE_BEFORE_SHIELD === '1' };
console.log('\ntests/probe_heldout_board_partings.js — three of the nine held-out board partings'
  + (K.A || K.B || K.C ? '   [KNOB ARMED: ' + Object.keys(K).filter(k => K[k]).join(',') + ']' : ''));

/* ---- THE FIXTURE IS LEGAL, AND THAT IS DERIVED THIS RUN ------------------------------------------ */
const { Dex } = require(path.join(ROOT, 'engine', 'champions_sim.js')).sim();
const D = Dex.forFormat(require(path.join(ROOT, 'engine', 'champions_sim.js')).FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const ls = s => (D.species.getLearnsetData(D.species.get(s).id) || {}).learnset || {};
{
  const need = [['toxapex', ['infestation', 'protect']], ['volcarona', ['quiverdance', 'protect']],
                ['tinkaton', ['stoneedge', 'protect']], ['garchomp', ['swordsdance', 'protect']],
                ['tyranitar', ['protect']], ['hatterene', ['protect']],
                ['incineroar', ['partingshot', 'protect']], ['corviknight', ['protect']],
                ['milotic', ['protect']], ['snorlax', ['protect']], ['appletun', ['protect']]];
  const bad0 = need.filter(([s, ms]) => !legal(D.species.get(s)) || ms.some(m => !ls(s)[m] || !legal(D.moves.get(m))));
  ok(!bad0.length, 'every fixture body is legal in this format and learns its clicks',
     bad0.length ? bad0.map(x => x[0]).join(', ') : need.length + ' bodies checked');
  const abil = (s, a) => Object.values(D.species.get(s).abilities).includes(a);
  ok(abil('volcarona', 'Flame Body') && abil('tinkaton', 'Mold Breaker') && abil('tinkaton', 'Own Tempo')
     && abil('garchomp', 'Sand Veil') && abil('tyranitar', 'Sand Stream') && abil('hatterene', 'Magic Bounce'),
     'Volcarona may carry Flame Body, Tinkaton Mold Breaker OR Own Tempo, Garchomp Sand Veil, '
     + 'Tyranitar Sand Stream, Hatterene Magic Bounce');
  /* THE THREE FACTS THE ARMS REST ON, READ OFF THE FORMAT RATHER THAN TYPED BESIDE A NAME. */
  ok(D.moves.get('infestation').volatileStatus === 'partiallytrapped'
     && D.moves.get('infestation').flags.contact === 1,
     'Infestation carries a PRIMARY volatile and makes contact — so Flame Body is reachable and the '
     + 'volatile is the `moveData.volatileStatus` road, not a secondary');
  ok(D.abilities.get('sandveil').flags.breakable === 1 && D.moves.get('stoneedge').accuracy < 100,
     'Sand Veil is `breakable` and Stone Edge has a printed accuracy under 100 (there is no roll at 100)',
     'sandveil.flags=' + JSON.stringify(D.abilities.get('sandveil').flags)
     + '  stoneedge.accuracy=' + D.moves.get('stoneedge').accuracy);
  ok(D.moves.get('partingshot').flags.reflectable === 1 && D.moves.get('partingshot').flags.protect === 1
     && D.moves.get('partingshot').selfSwitch === true,
     'Parting Shot is reflectable, respects Protect, and pivots — the one move where the two rules meet',
     JSON.stringify(D.moves.get('partingshot').flags) + ' selfSwitch=' + D.moves.get('partingshot').selfSwitch);
}

const G = SB.harness();
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...n) => n.map(x => mon(x, '', '', ['Protect']));
const rep = (n, step) => Array.from({ length: n }, () => step);

function play(A, B, script, tag) {
  G.midResetAddresses();
  const a = G.buildPair(A), b = G.buildPair(B);
  const parts = [];
  const r = (!a || !b) ? { err: 'buildPair returned null', turns: 0 }
    : G.playGame(a, b, 'directed', 'heldout9-' + tag,
        { script, onBoundary: (snap, t) => { if ((snap.diffs || []).length) parts.push({ t, d: snap.diffs.slice(0, 4) });
                                             snap.identical = true; snap.diffs = []; } });
  const ad = G.midAddresses();
  return { r, parts, sd: ad.sd.slice(), me: ad.me.slice() };
}
function boards(label, res, governed) {
  console.log('\n  [' + label + ']' + (governed ? '   [expected RED under its knob]' : ''));
  console.log('     played ' + res.r.turns + ' turns' + (res.r.err ? '  ERR ' + res.r.err : ''));
  for (const p of res.parts) {
    console.log('       PART t' + p.t + ' ' + p.d.map(d => d.path + ' me ' + JSON.stringify(d.medicham)
      + ' sd ' + JSON.stringify(d.showdown)).join('; '));
  }
  ok(!res.r.err, label + ': the arm played its whole script', res.r.err || null);
  ok(res.r.turns > 0, label + ': the arm played at least one turn', 'turns ' + res.r.turns);
  ok(res.parts.length === 0, label + ': the boards agree at every turn boundary',
     res.parts.length ? 'parted at t' + res.parts[0].t : null);
}
function dice(label, res, pick, expectShared) {
  const sd = res.sd.filter(pick), me = res.me.filter(pick);
  const sdS = new Set(sd), meS = new Set(me);
  const unshared = me.filter(x => !sdS.has(x)).concat(sd.filter(x => !meS.has(x)).map(x => 'sd ' + x));
  const shared = sd.filter(x => meS.has(x)).length;
  console.log('     dice in scope: authority ' + sd.length + ', medicham2 ' + me.length + ', shared ' + shared);
  for (const x of unshared) console.log('       unshared ' + x);
  if (expectShared) ok(shared > 0, label + ': the die WAS thrown on both engines — the arm is not vacuous',
                       'shared ' + shared);
  ok(unshared.length === 0, label + ': every die in scope was thrown by BOTH engines at the SAME address',
     unshared.length ? unshared.length + ' unshared' : null);
}
const isCat = (cat, mv) => x => { const p = String(x).split('|'); return p[2] === cat && (mv == null || p[3] === mv); };

/* ---- A. THE CERTAIN PRIMARY VOLATILE'S DIE ------------------------------------------------------- */
{
  const P1 = () => [mon('toxapex', '', 'Regenerator', ['Infestation', 'Protect'])].concat(FILL('milotic', 'corviknight', 'snorlax'));
  const P2 = ab => [mon('volcarona', '', ab, ['Quiver Dance', 'Protect'])].concat(FILL('appletun', 'snorlax', 'milotic'));
  /* THE FOE CLICKS A SELF-BOOST RATHER THAN PROTECT: a shielded body is never touched, so a script
   * that Protects every turn stages the click and not the HIT. The first cut of this arm did exactly
   * that and reached the reaction die twice in six turns. */
  const S = rep(6, { p1: [{ m: 'infestation', t: 0 }, { m: 'protect' }], p2: [{ m: 'quiverdance' }, { m: 'protect' }] });
  /* THE ARM. Flame Body's `randomChance(3, 10)` is an `any` draw on the SAME `any|infestation|<slot>`
   * address the certain volatile was spending, so the two collide exactly. */
  const armA = play(P1(), P2('Flame Body'), S, 'certain-volatile');
  boards('A certain primary volatile — Infestation into a Flame Body body', armA, K.A);
  dice('A', armA, isCat('any', 'infestation'), true);
  /* THE CONTROL: the identical click at the identical body under its OTHER ability, which reacts to
   * nothing. The authority throws NO `any` die here at all, so any draw this engine takes is the
   * defect standing alone with nothing to hide behind. */
  const ctlA = play(P1(), P2('Swarm'), S, 'certain-volatile-control');
  boards('A control — the same click into a body with no reaction ability', ctlA, K.A);
  dice('A control', ctlA, isCat('any', 'infestation'), false);
}

/* ---- B. A BREAKABLE EVASION ABILITY UNDER A MOLD BREAKER ----------------------------------------- */
{
  /* Tyranitar's Sand Stream puts the sky up on switch-in, which is what `sandveil`'s
   * `this.field.isWeather('sandstorm')` gate reads. */
  const P1 = ab => [mon('tinkaton', '', ab, ['Stone Edge', 'Protect']), mon('tyranitar', '', 'Sand Stream', ['Protect'])]
    .concat(FILL('corviknight', 'milotic'));
  const P2 = () => [mon('garchomp', '', 'Sand Veil', ['Swords Dance', 'Protect'])].concat(FILL('appletun', 'snorlax', 'milotic'));
  /* SAME REASON AS ARM A: the evaded body must actually be AIMED AT, so it boosts instead of shielding. */
  /* STONE EDGE, AND THE ACCURACY IS THE WHOLE CHOICE. Printed 80; Sand Veil's [3277,4096] chain makes
   * it trunc(80 * 3277 / 4096) = 64. The middle arm's `acc` draw for this address on turn 1 is 78.9,
   * which sits INSIDE that window — so the same die is a HIT for the breaker and a MISS for the raw
   * read, and the board parts on the first turn rather than eventually. Read, not hoped for: the
   * value is `midEventValue('<seed>|1|acc|stoneedge|p20|0')`. */
  const S = rep(4, { p1: [{ m: 'stoneedge', t: 0 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] });
  const armB = play(P1('Mold Breaker'), P2(), S, 'breaker-vs-sandveil');
  boards('B Mold Breaker into Sand Veil in sand', armB, K.B);
  dice('B', armB, isCat('acc', 'stoneedge'), true);
  /* THE CONTROL: the same body under Own Tempo, which breaks nothing. Sand Veil's modifier applies on
   * BOTH engines here, so this arm must be clean under the knob as well — it is what says the knob
   * governs the breaker and not the modifier. */
  const ctlB = play(P1('Own Tempo'), P2(), S, 'nonbreaker-vs-sandveil');
  boards('B control — the same attacker under Own Tempo', ctlB, false);
  dice('B control', ctlB, isCat('acc', 'stoneedge'), true);
}

/* ---- C. A SHIELDED BOUNCER DOES NOT REFLECT A PIVOT ---------------------------------------------- */
{
  const P1 = () => [mon('hatterene', '', 'Magic Bounce', ['Protect'])].concat(FILL('milotic', 'corviknight', 'snorlax'));
  const P2 = () => [mon('incineroar', '', 'Blaze', ['Parting Shot', 'Protect'])].concat(FILL('appletun', 'snorlax', 'milotic'));
  /* Turn 1 is the ARM: the bouncer shields and the pivot arrives. Turn 2 is the CONTROL on the same
   * board: the bouncer stands open and the same click must be reflected by both engines. */
  const S = [{ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'partingshot', t: 0 }, { m: 'protect' }] },
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }];
  const armC = play(P1(), P2(), S, 'shield-before-bounce-pivot');
  boards('C Parting Shot at a Protecting Magic Bounce body', armC, K.C);
  /* The control arm is a SEPARATE game so the pivot on turn 1 cannot change what turn 2 stages. */
  const Sc = [{ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
              { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'partingshot', t: 0 }, { m: 'protect' }] }];
  const ctlC = play(P1(), P2(), Sc, 'shield-before-bounce-open');
  boards('C control — the same Parting Shot at the same bouncer standing OPEN', ctlC, false);
  /* ---- AND THE POSITIVE WITNESS, BECAUSE `THE BOARDS AGREE` IS TRUE OF A TURN THAT DID NOTHING.
   * A reflection writes a SECOND `|move|` line, from the BOUNCER, naming the same move. It must be
   * there in the open arm and absent in the shielded one, on BOTH engines — an arm where the counts
   * match each other and are both zero is a fixture that never staged a bounce. */
  /* READ OFF medicham2's OWN TRACE ONLY. `lastSdLog()` holds the LAST game played, so asking it for
   * an earlier arm would answer about a different game — the authority's half of this arm is already
   * covered by the board comparison above. */
  const refl = r => (r.r.mediTrace || [])
    .filter(l => /^\|move\|p1a:[^|]*\|partingshot/i.test(String(l).replace(/ /g, ''))).length;
  const wOpen = refl(ctlC), wUp = refl(armC);
  console.log('     reflected |move| lines from the BOUNCER — open ' + wOpen + ', shielded ' + wUp);
  ok(wOpen > 0, 'C control: the bouncer really did reflect the pivot when it stood open',
     'medicham2 wrote ' + wOpen + ' bounced |move| line(s)');
  ok(wUp === 0, 'C: the SHIELDED bouncer reflected nothing',
     'medicham2 wrote ' + wUp + ' bounced |move| line(s)');
  ok(wOpen !== wUp, 'C: the shield CHANGED the answer — an identical pair means the gate is unread',
     'open ' + wOpen + ' vs shielded ' + wUp);
}

console.log('\n  ' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'GREEN — every arm agreed'));
process.exit(bad ? 1 : 0);
