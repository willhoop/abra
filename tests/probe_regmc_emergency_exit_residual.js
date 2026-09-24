#!/usr/bin/env node
/* tests/probe_regmc_emergency_exit_residual.js — EMERGENCY EXIT ANSWERS A RESIDUAL THAT TAKES ITS HOLDER TO HALF, UNDER
 * REG M-C. 2026-09-24 (ENGINE, narration to zero, cause C).
 *
 *   node tests/probe_regmc_emergency_exit_residual.js --regulation regmc                                   # green, exit 0
 *   MEDI_EMERGENCY_EXIT_NO_RESIDUAL=1 node tests/probe_regmc_emergency_exit_residual.js --regulation regmc  # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout pokemon-showdown-mc f10d679; read whole) ==========
 *
 *   sim/battle.ts `case 'residual'` (:2811-2818) records `residualPokemon = getAllActive().map(p => [p, hp])` before
 *   `fieldEvent('Residual')`. `runAction`'s tail (:2860-2867), below `|upkeep|` and the faint drain:
 *       if (this.gen >= 5 && action.choice !== 'start') {
 *         this.eachEvent('Update');
 *         for (const [pokemon, originalHP] of residualPokemon) {
 *           if (pokemon.hp && pokemon.getUndynamaxedHP() <= maxhp / 2 && originalHP > maxhp / 2)
 *             this.runEvent('EmergencyExit', pokemon);
 *   and the Champions handler (data/mods/champions/abilities.ts :22-29): `canSwitch`, not dragged, not already switching
 *   -> `switchFlag = true`, `|-activate|HOLDER|ability: Emergency Exit`. The switch request follows (:2905-2911); the
 *   answer is an `instaswitch` (sim/side.ts :1011), a bare `|switch|` line, before the next `|turn|`.
 *   Field case: Reg M-C lattice 1900, omit-spread `…2679451964 vs …2679546173` t2 -- a burn chip takes Golisopod from
 *   78/150 to 69/150; the authority writes `-activate` and asks for a switch; this engine wrote nothing, so the harness
 *   could not express its placement ("slot 1 holds golisopod, which showdown already has ACTIVE"). The door was
 *   COUNTED (`MEDFAILS.emergencyExitOtherDoorUnmodelled`) and not modelled: an engine defect, not an instrument limit.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   RESIDUAL  p2a seeds the Emergency Exit holder on turn 1; every body then idles. Leech Seed's chip is the only damage,
 *             so the holder crosses half at a residual and nowhere else.
 *   CONTROL   the same turns with the holder's slot taken by a body without the ability: seeded to the same fraction,
 *             nobody leaves. The only difference is the ability.
 * The ability is found by its TAG (`switchesOutAtHalf`), never by name.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_emergency_exit_residual', ['MEDI_EMERGENCY_EXIT_NO_RESIDUAL']);
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, mon } = K;
const ROOT = path.join(__dirname, '..');

const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const EE = Object.keys(TAGS.abilities).filter(a => (TAGS.abilities[a].tags || []).includes('switchesOutAtHalf') && K.legal(D.abilities.get(a)));
const SEED = D.moves.get('leechseed');
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     switchesOutAtHalf: ' + EE.join(', ') + '   residual chip: ' + SEED.id + ' (legal ' + K.legal(SEED) + ')');
if (!EE.length || !K.legal(SEED)) { ok(false, 'a legal switchesOutAtHalf ability and a legal Leech Seed exist'); K.finish(); }
const KEEP = /^\|(switch|-activate|-damage|upkeep|faint)\|?/;
const OWN = /^\|(switch|-activate)\|/;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, () => ({ eeResidual: K.M.MEDSEEN.emergencyExitResidual || 0 }));
const seedable = s => !s.types.includes('Grass');
const IDLE = ['growl', 'tailwhip', 'leer', 'harden', 'defensecurl', 'withdraw', 'splash', 'celebrate', 'swordsdance', 'bulkup'];

let RS = null, CT = null;
outer: for (const h of SPEC.filter(s => abil(s).some(a => EE.includes(a)) && seedable(s))) {
  const ea = abil(h).find(a => EE.includes(a));
  for (const iid of IDLE.filter(x => learns(h, x) && K.legal(D.moves.get(x)))) {
    const used = new Set([h.baseSpecies]);
    const p1 = SPEC.filter(s => quiet(s) && learns(s, iid) && seedable(s) && !used.has(s.baseSpecies)).slice(0, 4);
    if (p1.length < 4) continue;
    p1.forEach(s => used.add(s.baseSpecies));
    const seeder = SPEC.find(s => !used.has(s.baseSpecies) && quiet(s) && learns(s, SEED.id) && K.idle(s));
    if (!seeder) continue; used.add(seeder.baseSpecies);
    const p2 = SPEC.filter(s => quiet(s) && K.idle(s) && !used.has(s.baseSpecies)).slice(0, 3);
    if (p2.length < 3) continue;
    const I = D.moves.get(iid).name, sI = K.idle(seeder);
    const B = [mon(seeder, '', ['Leech Seed', sI.name]), mon(p2[0], '', [K.idle(p2[0]).name]), mon(p2[1], '', [K.idle(p2[1]).name]), mon(p2[2], '', [K.idle(p2[2]).name])];
    const turns = n => { const s = [{ p1: [{ m: iid }, { m: iid }], p2: [{ m: SEED.id, t: 0 }, { m: K.idle(p2[0]).id }] }];
      for (let k = 1; k < n; k++) s.push({ p1: [{ m: iid }, { m: iid }], p2: [{ m: sI.id }, { m: K.idle(p2[0]).id }] }); return s; };
    const A1 = [mon(h, '', [I], ea), mon(p1[0], '', [I]), mon(p1[1], '', [I]), mon(p1[2], '', [I])];
    const r = play('residual', A1, B, turns(8));
    if (!r.staged) { console.log('   (skip ' + h.id + '/' + iid + ': ' + r.why + ')'); continue; }
    if (!r.sdK.some(l => /^\|-activate\|p1a:.*emergencyexit/.test(l))) { console.log('   (skip ' + h.id + ': the authority never exited)'); continue; }
    const A2 = [mon(p1[3], '', [I]), mon(p1[0], '', [I]), mon(p1[1], '', [I]), mon(p1[2], '', [I])];
    /* the control plays exactly the turns up to the exit, so the seed has not yet fainted it */
    const nEx = r.sdK.slice(0, r.sdK.findIndex(l => /^\|-activate\|p1a:.*emergencyexit/.test(l))).filter(l => /^\|upkeep/.test(l)).length;
    const c = play('control', A2, B, turns(nEx));
    if (!c.staged) { console.log('   (skip control ' + p1[3].id + ': ' + c.why + ')'); continue; }
    r.cast = h.id + ' [' + ea + '] seeded by ' + seeder.id + '; bench ' + p1.slice(1, 3).map(s => s.id).join(', ') + '; all click ' + iid;
    c.cast = p1[3].id + ' [' + quiet(p1[3]) + '] seeded in the same slot';
    RS = r; CT = c; break outer;
  }
}
const RUNS = [['RESIDUAL', RS], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const at = (R, re) => R.sdK.findIndex(l => re.test(l));
const iAct = at(RS, /^\|-activate\|p1a:.*emergencyexit/), iUp = RS.sdK.slice(0, iAct).map(l => /^\|upkeep/.test(l)).lastIndexOf(true);
ok(iAct > 0 && iUp >= 0 && iUp === iAct - 1, 'RESIDUAL — the authority writes -activate Emergency Exit directly below |upkeep|', RS.sdK.slice(Math.max(0, iAct - 2), iAct + 2).join('  '));
ok(/^\|switch\|p1a:/.test(RS.sdK[iAct + 1] || ''), 'RESIDUAL — and the holder\'s slot is refilled by a |switch| straight after (the harness shows it only once the engine places a body: red before the fix is the engine, not the authority)', RS.sdK[iAct + 1]);
ok(!CT.sdK.some(l => /emergencyexit/.test(l)) && !CT.sdK.slice(2).some(l => /^\|switch\|p1a:/.test(l)), 'CONTROL — no ability, no exit, nobody leaves');

K.compareArms(RUNS, OWN, '|switch| / -activate');
console.log('\n5. THE COUNTER');
ok(K.KNOBS.length ? true : RS.counters.eeResidual > 0 && CT.counters.eeResidual === 0, 'MEDSEEN.emergencyExitResidual rose in RESIDUAL and not in CONTROL',
  'residual ' + RS.counters.eeResidual + '  control ' + CT.counters.eeResidual);
K.finish();
