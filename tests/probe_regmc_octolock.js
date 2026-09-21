#!/usr/bin/env node
/* tests/probe_regmc_octolock.js — A LOCK THAT DRAINS DEFENCES EVERY TURN (OCTOLOCK), UNDER REG M-C. 2026-09-22 (abra/regmc 0.27.0).
 *
 *   node tests/probe_regmc_octolock.js --regulation regmc                                     # green, exit 0
 *   MEDI_PERTURN_BOOST_CLOCK_ALWAYS=1 node tests/probe_regmc_octolock.js --regulation regmc   # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/moves.ts octolock :12960-12994; the Champions mod (data/mods/champions/moves.ts :703-706) only sets
 *   `isNonstandard: null`:
 *       onTryImmunity(target) { return this.dex.getImmunity('trapped', target); },
 *       volatileStatus: 'octolock',
 *       condition: { onStart(pokemon, source) { this.add('-start', pokemon, 'move: Octolock', `[of] ${source}`); },
 *         onResidualOrder: 14,
 *         onResidual(pokemon) { const source = this.effectState.source;
 *           if (source && (!source.isActive || source.hp <= 0 || !source.activeTurns)) {
 *             delete pokemon.volatiles['octolock']; this.add('-end', pokemon, 'Octolock', '[partiallytrapped]', '[silent]'); return; }
 *           this.boost({ def: -1, spd: -1 }, pokemon, source, this.dex.getActiveMove('octolock')); },
 *         onTrapPokemon(pokemon) { if (this.effectState.source?.isActive) pokemon.tryTrap(); } },
 *   The move is found by its TAG (`perTurnBoost` whose volatile is the move's own `statusInflict` volatile), never by name.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   LOCK     turn 1: the user locks the foe; turns 1-2 end with the foe's Defence and Sp. Def dropping; the volatile
 *            stands at both boundaries (a compared board leaf).
 *   RELEASE  as LOCK, then on turn 3 the user switches out: the lock ends at that turn's residual, silently, and
 *            nothing drops.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_octolock', ['MEDI_PERTURN_BOOST_CLOCK_ALWAYS']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, show, P } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const LOCKS = Object.keys(TAGS.moves).filter(m => { const p = TAGS.moves[m].params || {};
  return p.perTurnBoost && p.statusInflict && (p.statusInflict.effects || []).some(e => e.volatile === p.perTurnBoost.volatile && e.to === 'target')
    && K.legal(D.moves.get(m)) && D.moves.get(m).condition && D.moves.get(m).condition.onTrapPokemon; });
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
console.log('     trapping per-turn-drop moves: ' + (LOCKS.join(', ') || '(none)'));
if (!LOCKS.length) { console.log('  NOT STAGED — no legal member'); process.exit(1); }
const MV = D.moves.get(LOCKS[0]);
const boostQuiet = s => { const a = quiet(s); if (!a) return null; const A = D.abilities.get(a);
  return (A.onTryBoost || A.onChangeBoost || A.onAfterBoost || A.onAfterEachBoost || A.onFoeAfterBoost) ? null : a; };
const USERS = SPEC.filter(s => learns(s, MV.id) && learns(s, 'protect'));
console.log('     ' + MV.id + ' learners: ' + show(USERS));
const FILL = SPEC.filter(s => boostQuiet(s) && learns(s, 'protect') && D.getImmunity('trapped', s) && !s.types.includes('Ghost')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-start|-end|-unboost|-damage|switch|faint)\|/;
const counters = () => ({ tick: K.M.MEDSEEN.perTurnBoostUnclockedTick || 0, end: K.M.MEDSEEN.perTurnBoostResidualSourceEnd || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const ALLP = { p1: [P.protect, P.protect], p2: [P.protect, P.protect] };

let LK = null, RL = null;
for (const u of USERS) {
  const uAb = boostQuiet(u) || abil(u)[0];
  const used = new Set([u.baseSpecies, u.id]);
  /* the target (fills[2]) is the bulkiest filler with a repeatable click */
  /* a click the target can repeat on every turn without touching HP, Defence or Sp. Def (a second Focus Energy fails, so
   * the kit's idle list is not enough): a self boost of a stat the lock does not touch */
  const again = s => ['swordsdance', 'nastyplot', 'agility'].map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id)) || null;
  const tgt = FILL.find(s => !used.has(s.baseSpecies) && again(s));
  if (!tgt) { console.log('   (skip ' + u.id + ': no target with an idle click)'); continue; }
  used.add(tgt.baseSpecies);
  const rest = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
  if (rest.length < 4) { console.log('   (skip ' + u.id + ': not enough fillers)'); continue; }
  const fills = [rest[0], rest[1], tgt, rest[2], rest[3]];
  const A = [mon(u, '', [MV.name, 'Protect'], uAb), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[4], '', ['Protect'])];
  const B = [mon(fills[2], '', ['Protect'], boostQuiet(fills[2])), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[1], '', ['Protect'])];
  /* the target must not protect on turn 1 (it has to be locked), and it carries no damaging move, so nothing but the
   * lock moves a number: it clicks the repeatable self boost (never a Protect and never a hit). */
  const idle = again(fills[2]);
  if (!idle) continue;
  B[0] = mon(fills[2], '', [idle.name, 'Protect'], boostQuiet(fills[2]));
  const t1 = { p1: [{ m: MV.id, t: 0 }, P.protect], p2: [{ m: idle.id }, P.protect] };
  const lk = play('lock', A, B, [t1, ALLP, { p1: [{ m: 'protect' }, P.protect], p2: [{ m: idle.id }, P.protect] }]);
  if (!lk.staged) { console.log('   (skip ' + u.id + ': ' + lk.why + ')'); continue; }
  if (!lk.sdK.some(l => /^\|-start\|p2a:/.test(l))) { console.log('   (skip ' + u.id + ': the lock did not land on the authority)'); continue; }
  const rl = play('release', A, B, [t1, ALLP, { p1: [{ sw: fills[4].id }, P.protect], p2: [{ m: idle.id }, P.protect] }]);
  if (!rl.staged) { console.log('   (skip ' + u.id + ' release: ' + rl.why + ')'); continue; }
  lk.cast = u.id + ' --' + MV.id + '--> ' + fills[2].id; rl.cast = lk.cast + ', then ' + u.id + ' switches out';
  LK = lk; RL = rl; break;
}
const RUNS = [['LOCK', LK], ['RELEASE', RL]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const drops = R => R.sdK.filter(l => /^\|-unboost\|p2a:/.test(l)).length;
ok(drops(LK) === 6, 'LOCK — Defence and Sp. Def drop at each of the three residuals (6 unboost lines)', drops(LK));
ok(drops(RL) === 4 && RL.sdK.some(l => /^\|switch\|p1a:/.test(l)), 'RELEASE — two residuals drop, then the user leaves and the third does not (4 unboost lines)', drops(RL));

/* The `-start` line is compared WITHOUT its `[of]` field: the authority writes `[of] <source>` and this engine does not,
 * and the whole-game differential's own reducer folds that field (its first-divergence check above reads none). That is
 * a narration difference, recorded, not this mechanic. */
const noOf = l => l.replace(/\|\[of\][^|]*/g, '');
for (const [tag, R] of RUNS) ok(JSON.stringify(R.sdK.filter(l => /^\|-start\|/.test(l)).map(noOf)) === JSON.stringify(R.meK.filter(l => /^\|-start\|/.test(l)).map(noOf)),
  tag + ' — the lock is announced on the same body, the same turn (the `[of]` field aside)');
K.compareArms(RUNS, /^\|(-end|-unboost|switch)\|/, '-end / -unboost / switch');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(LK.counters.tick === 3 && LK.counters.end === 0 && RL.counters.tick === 2 && RL.counters.end === 1,
    'the engine\'s receipts: three unclocked ticks in LOCK; two ticks and one source-gone end in RELEASE', JSON.stringify([LK.counters, RL.counters]));
}
K.finish();
