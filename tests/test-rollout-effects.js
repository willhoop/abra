/* test-rollout-effects.js — pins the rollout engine's move-effect rules.
 *
 * These defects were live in medicham2-browser.js until 2026-07-24, and none of them crashed:
 *   1. STATUS MOVES APPLIED A RANDOM STATUS. `applyStatus(t, ['brn','par','slp'][rng()*3|0])` meant
 *      Thunder Wave burned a third of the time and Will-O-Wisp could paralyse.
 *   2. ONLY FAKE OUT COULD FLINCH. Rock Slide's 30%, Iron Head's 30% and 31 other flinch chances
 *      did nothing.
 *   3. NO TYPE IMMUNITIES. A random status ignores them, so Fire types were burned and Electric
 *      types paralysed.
 *   4. PRIORITY WAS A HAND-TYPED TABLE of 18 moves. Everything absent resolved at 0, including all
 *      14 negative-priority moves - Trick Room is -7 and was going at normal speed.
 *   5. FLINCH LEAKED ACROSS TURNS. It was cleared only when the flinched Pokemon tried to act, so a
 *      flinch applied by a slower attacker stole the target's NEXT turn.
 *
 * Expected values are derived from the game's own rules and from Showdown's published move data,
 * not captured from this engine's output.
 *
 *   node tests/test-rollout-effects.js
 */
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'data', 'engine-data.js'));      // sets globalThis.MC
const E = require(path.join(__dirname, '..', 'engine', 'medicham2-browser.js'));

let P = 0, F = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); c ? P++ : F++; };

console.log('== 1. a status move inflicts ITS status, not a random one ==');
/* Hand-derived from the moves themselves: Thunder Wave paralyses, Will-O-Wisp burns, Spore sleeps,
 * Toxic badly poisons. Under the old random pick each of these was 1-in-3 for the wrong status. */
const PRIMARY = { thunderwave:'par', willowisp:'brn', spore:'slp', hypnosis:'slp', toxic:'tox',
                  glare:'par', stunspore:'par', sleeppowder:'slp', poisonpowder:'psn', sing:'slp',
                  darkvoid:'slp', lovelykiss:'slp', grasswhistle:'slp', poisongas:'psn', toxicthread:'psn' };
let sOk = 0, sBad = [];
for (const [mv, st] of Object.entries(PRIMARY)) {
  const got = (E.moveFx(mv) || {}).status;
  got === st ? sOk++ : sBad.push(`${mv} -> ${got} (want ${st})`);
}
ok(sBad.length === 0, `all ${sOk} status moves carry their real status${sBad.length ? ': ' + sBad.join(', ') : ''}`);
ok(!(E.moveFx('rockslide') || {}).status, 'an attacking move carries no PRIMARY status (Rock Slide)');

console.log('== 2. accuracy comes from the move, so status moves can miss ==');
// Thunder Wave 90, Will-O-Wisp 85, Hypnosis 60, Spore 100 - the real values, not a flat 100.
const ACCU = { thunderwave:90, willowisp:85, hypnosis:60, spore:100, sleeppowder:75, darkvoid:50 };
let aBad = [];
for (const [mv, acc] of Object.entries(ACCU)) {
  const got = (E.moveFx(mv) || {}).accuracy;
  if (got !== acc) aBad.push(`${mv} ${got}!=${acc}`);
}
ok(aBad.length === 0, `status-move accuracy is the real value${aBad.length ? ': ' + aBad.join(', ') : ''}`);

console.log('== 3. flinch chances exist for more than Fake Out ==');
const FLINCH = { rockslide:30, ironhead:30, airslash:30, darkpulse:20, icefang:10, zenheadbutt:20,
                 headbutt:30, bite:30, astonish:30, waterfall:20 };
let fBad = [];
for (const [mv, ch] of Object.entries(FLINCH)) {
  const secs = (E.moveFx(mv) || {}).secondary || [];
  const fl = secs.find(s => s.volatile === 'flinch');
  if (!fl || fl.chance !== ch) fBad.push(`${mv} ${fl ? fl.chance : 'none'}!=${ch}`);
}
ok(fBad.length === 0, `${Object.keys(FLINCH).length} moves carry their real flinch chance${fBad.length ? ': ' + fBad.join(', ') : ''}`);

console.log('== 4. priority spans the full bracket range, not a hand-typed subset ==');
/* Showdown's own values. The old table had 18 positive entries and NOTHING negative, so every one
 * of these negatives resolved at 0 - Trick Room most damagingly, since it must always go last. */
const PRIO = { helpinghand:5, protect:4, detect:4, kingsshield:4, fakeout:3, quickguard:3, wideguard:3,
               followme:2, ragepowder:2, extremespeed:2, aquajet:1, bulletpunch:1, suckerpunch:1,
               thunderwave:0, rockslide:0, earthquake:0,
               vitalthrow:-1, focuspunch:-3, beakblast:-3, avalanche:-4, revenge:-4, counter:-5,
               mirrorcoat:-5, roar:-6, whirlwind:-6, dragontail:-6, circlethrow:-6, teleport:-6,
               trickroom:-7 };
let pOk = 0, pBad = [];
for (const [mv, pr] of Object.entries(PRIO)) {
  const got = E.movePriority(mv, {});
  got === pr ? pOk++ : pBad.push(`${mv} ${got}!=${pr}`);
}
ok(pBad.length === 0, `all ${pOk} priorities correct, +5 down to -7${pBad.length ? ': ' + pBad.join(', ') : ''}`);
ok(E.movePriority('trickroom', {}) === -7, 'Trick Room is -7 and therefore resolves last');
ok(E.movePriority('nosuchmove', {}) === 0, 'an unknown move defaults to bracket 0');
// Grassy Glide is +1 ONLY in Grassy Terrain - a conditional, which is why Showdown stores no static value
ok(E.movePriority('grassyglide', { terrain: 'grassy' }) === 1, 'Grassy Glide is +1 in Grassy Terrain');
ok(E.movePriority('grassyglide', {}) === 0, 'Grassy Glide is 0 without Grassy Terrain');

console.log('== 5. status immunities are enforced ==');
const mon = (types, ability) => ({ types, ability: ability || '', status: '', fainted: false, curHP: 100 });
ok(E.canTakeStatus(mon(['Fire']), 'brn') === false,      'a Fire type cannot be burned');
ok(E.canTakeStatus(mon(['Electric']), 'par') === false,  'an Electric type cannot be paralysed');
ok(E.canTakeStatus(mon(['Ice']), 'frz') === false,       'an Ice type cannot be frozen');
ok(E.canTakeStatus(mon(['Poison']), 'psn') === false,    'a Poison type cannot be poisoned');
ok(E.canTakeStatus(mon(['Steel']), 'tox') === false,     'a Steel type cannot be badly poisoned');
ok(E.canTakeStatus(mon(['Fire']), 'par') === true,       'but a Fire type CAN be paralysed');
ok(E.canTakeStatus(mon(['Water'], 'waterveil'), 'brn') === false, 'Water Veil blocks burn');
ok(E.canTakeStatus(mon(['Normal'], 'limber'), 'par') === false,   'Limber blocks paralysis');
ok(E.canTakeStatus(mon(['Normal'], 'insomnia'), 'slp') === false, 'Insomnia blocks sleep');
ok(E.canTakeStatus(mon(['Bug'], 'shielddust'), 'brn') === false,  'Shield Dust blocks secondary status');
const already = mon(['Normal']); already.status = 'par';
ok(E.canTakeStatus(already, 'brn') === false, 'a Pokemon already statused cannot take a second');

console.log('== 6. end to end: no illegal status appears in real battles ==');
/* The strongest check available, because it exercises the whole turn loop. Under the old random
 * pick this failed constantly: immunities were never consulted at all. */
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const pool = Object.keys(MC.mons);
const typeOf = n => (MC.mons[n] || {}).t || [];
const fires = pool.filter(n => typeOf(n).includes('Fire')).slice(0, 4);
const elecs = pool.filter(n => typeOf(n).includes('Electric')).slice(0, 4);
ok(fires.length > 0 && elecs.length > 0, `found test subjects: ${fires.length} Fire, ${elecs.length} Electric`);

let illegal = 0, checked = 0;
if (fires.length && elecs.length) {
  const others = pool.filter(n => !typeOf(n).includes('Fire') && !typeOf(n).includes('Electric')).slice(0, 40);
  for (let trial = 0; trial < 60; trial++) {
    const A = [fires[trial % fires.length], elecs[trial % elecs.length],
               others[trial % others.length], others[(trial + 7) % others.length]];
    const B = [others[(trial + 1) % others.length], others[(trial + 11) % others.length],
               others[(trial + 21) % others.length], others[(trial + 31) % others.length]];
    const teamA = A.map(n => E.buildMon(n)).filter(Boolean);
    const teamB = B.map(n => E.buildMon(n)).filter(Boolean);
    if (teamA.length < 4 || teamB.length < 4) continue;
    E.battle(teamA, teamB, null);
    for (const m of teamA) {
      checked++;
      if (m.status === 'brn' && (m.types || []).includes('Fire')) illegal++;
      if (m.status === 'par' && (m.types || []).includes('Electric')) illegal++;
      if (m.status === 'frz' && (m.types || []).includes('Ice')) illegal++;
    }
  }
}
ok(illegal === 0, `no immune Pokemon ended a battle with an illegal status (${illegal} bad across ${checked} survivors)`);

console.log('== 7. flinch cannot leak past the turn it was applied ==');
/* Every Pokemon must leave a battle with _flinch cleared. It used to be cleared only when the
 * flinched Pokemon tried to act, so a flinch from a slower attacker persisted into the next turn. */
let leaked = 0, seen = 0;
for (let trial = 0; trial < 40; trial++) {
  const A = pool.slice(trial * 2, trial * 2 + 4);
  const B = pool.slice(trial * 2 + 40, trial * 2 + 44);
  const teamA = A.map(n => E.buildMon(n)).filter(Boolean);
  const teamB = B.map(n => E.buildMon(n)).filter(Boolean);
  if (teamA.length < 4 || teamB.length < 4) continue;
  E.battle(teamA, teamB, null);
  for (const m of [...teamA, ...teamB]) { seen++; if (m._flinch) leaked++; }
}
ok(leaked === 0, `no Pokemon left a battle still flinching (${leaked} leaked of ${seen})`);

console.log(`\nROLLOUT EFFECT TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
