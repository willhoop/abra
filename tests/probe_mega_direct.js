/* tests/probe_mega_direct.js — CAN A MEGA FORME BE PUT ON THE BOARD AS ITSELF?
 *
 * ROADMAP #138 JOB 1, step one. Fourteen abilities in this format are reachable ONLY on a mega forme,
 * and `tests/roster.js` stages none of them: the harness stages an ability by WRITING it onto a body,
 * and a mega-tier ability arrives with a forme change that overwrites whatever was written.
 *
 * The proposed way out is to skip the forme change and stand the mega forme on the field as itself.
 * THAT IS A CLAIM ABOUT SHOWDOWN, so it is asked of Showdown rather than reasoned about:
 *
 *   1. what the format's own TeamValidator does with such a set
 *   2. whether the battle stream actually keeps the forme on the field
 *   3. whether an ability written onto that body survives to the board
 *
 * Nothing here is a pass or a fail. It PRINTS what the authority did.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mega_direct.js --release <id>
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — no simulator'); process.exit(2); }

const ARG = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open(ARG('--release') || null);
if (!process.argv.includes('--release')) process.argv.push('--release', REL.id);
if (!process.argv.includes('--state')) process.argv.push('--state');

const SB = require(D('tests', 'staged_board.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const { TeamValidator } = require(process.env.SHOWDOWN_PATH + '/dist/sim/team-validator');
const TV = new TeamValidator(CS.FORMAT);
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

console.log('PROBE — a mega forme, staged as itself');
console.log('  release ' + REL.id);

/* the fourteen: an ability whose ONLY legal carrier in this format is a mega forme */
const MEGA_OF = {};
for (const it of dex.items.all()) {
  if (!it.exists || it.isNonstandard || !it.megaStone) continue;
  for (const b of Object.keys(it.megaStone)) MEGA_OF[idOf(it.megaStone[b])] = { item: it.id, base: idOf(b) };
}
const CARRIERS = {};
for (const s of dex.species.all()) {
  if (!s.exists || s.isNonstandard) continue;
  for (const n of Object.values(s.abilities || {})) (CARRIERS[idOf(n)] = CARRIERS[idOf(n)] || []).push(s);
}
const MEGA_ONLY = [];
for (const a of dex.abilities.all()) {
  if (!a.exists || a.isNonstandard) continue;
  const list = CARRIERS[a.id] || [];
  if (!list.length) continue;
  if (list.every(s => s.battleOnly && MEGA_OF[s.id])) MEGA_ONLY.push({ ab: a, forme: list[0] });
}
console.log('  ' + MEGA_ONLY.length + ' ability(s) whose only legal carrier is a mega forme: '
  + MEGA_ONLY.map(x => x.ab.name).join(', '));

/* ---- 1. THE VALIDATOR ---------------------------------------------------------------------------- */
const FILLER = ['Snorlax', 'Corviknight', 'Milotic', 'Clefable', 'Garchomp'];
function fullSet(species, item, ability, moves) {
  return { name: species, species, item: item || '', ability: ability || '', moves,
           gender: 'N', level: 50, nature: 'Serious',
           evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } };
}
function legalMove(sp) {
  const ls = dex.species.getLearnsetData(sp.id);
  const from = (ls && ls.learnset) ? Object.keys(ls.learnset) : [];
  const src = from.length ? from : Object.keys((dex.species.getLearnsetData(idOf(sp.changesFrom || sp.baseSpecies)) || {}).learnset || {});
  for (const m of src) { const d = dex.moves.get(m); if (d && d.exists && !d.isNonstandard) return d.name; }
  return 'Protect';
}
function validate(sets) {
  const team = sets.concat(FILLER.slice(0, Math.max(0, 6 - sets.length))
    .map(n => fullSet(n, '', dex.species.get(n).abilities[0], [legalMove(dex.species.get(n))])));
  const probs = TV.validateTeam(team) || [];
  /* the SP/nature complaint is this harness's flat spread and not the question being asked */
  return probs.filter(p => !/Stat Points/.test(p));
}

console.log('\n1. WHAT THE FORMAT\'S OWN TeamValidator SAYS ABOUT EACH SET SHAPE');
for (const { ab, forme } of MEGA_ONLY) {
  const stone = dex.items.get(MEGA_OF[forme.id].item);
  const src = dex.species.get(idOf(forme.changesFrom || forme.baseSpecies));
  const mv = legalMove(forme);
  const shapes = [
    ['mega forme, no item      ', fullSet(forme.name, '', ab.name, [mv])],
    ['mega forme + its stone   ', fullSet(forme.name, stone.name, ab.name, [mv])],
    ['SOURCE forme + its stone ', fullSet(src.name, stone.name, Object.values(src.abilities)[0], [mv])],
  ];
  console.log('  ' + ab.name + '  (' + forme.name + ', source ' + src.name + ', ' + stone.name + ')');
  for (const [label, set] of shapes) {
    const copy = JSON.parse(JSON.stringify(set));
    const probs = validate([copy]);
    console.log('     ' + label + (probs.length ? 'REFUSED: ' + probs.join(' | ')
      : 'ACCEPTED, and the validator REWROTE species to "' + copy.species + '"'
        + (idOf(copy.species) === idOf(set.species) ? '' : '  <-- NOT THE BODY WE ASKED FOR')));
  }
}

/* ---- 2 & 3. THE BATTLE ---------------------------------------------------------------------------
 * Put the mega forme on the field through the differential harness and read SHOWDOWN'S OWN BOARD at
 * the first boundary: which species is in the slot, and which ability it is carrying. */
console.log('\n2. WHAT THE BATTLE STREAM DOES WITH THE SAME SET (Showdown\'s own board, boundary 0)');
const G = SB.harness(null);
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = n => FILLER.slice(0, n).map(s => mon(idOf(s), '', '', ['protect']));

let played = 0, kept = 0, reverted = 0, threw = 0;
for (const { ab, forme } of MEGA_ONLY) {
  const mv = idOf(legalMove(forme));
  const A = [mon('kangaskhan', '', 'Scrappy', ['protect'])].concat(FILL(3));
  const B = [mon(idOf(forme.name), '', ab.name, [mv])].concat(FILL(3));
  let a, b;
  try { a = G.buildPair(A); b = G.buildPair(B); } catch (e) {
    console.log('  ' + ab.name.padEnd(16) + 'THREW IN BUILD: ' + e.message); threw++; continue; }
  if (!a || !b) { console.log('  ' + ab.name.padEnd(16) + 'NOT BUILDABLE (buildPair returned null)'); threw++; continue; }
  let snap0 = null;
  const r = G.playGame(a, b, 'directed', 'probe:' + ab.id, {
    script: [{ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: mv, t: 0 }, { m: 'protect' }] }],
    onBoundary: (snap) => { if (!snap0) snap0 = snap; } });
  played++;
  if (r.err || !snap0) { console.log('  ' + ab.name.padEnd(16) + 'GAME THREW: ' + (r.err || 'no boundary')); threw++; continue; }
  const sdAct = (((snap0.sd || {}).sides || {}).p2 || {}).active || [];
  const meAct = (((snap0.medi || {}).sides || {}).p2 || {}).active || [];
  const sdSp = sdAct[0] ? sdAct[0].species : '(none)';
  const sdAb = sdAct[0] ? sdAct[0].ability : '(none)';
  const meSp = meAct[0] ? meAct[0].species : '(none)';
  const meAb = meAct[0] ? meAct[0].ability : '(none)';
  const heldForme = idOf(sdSp) === idOf(forme.name);
  if (heldForme) kept++; else reverted++;
  console.log('  ' + ab.name.padEnd(16) + 'showdown slot = ' + String(sdSp).padEnd(20)
    + 'ability = ' + String(sdAb).padEnd(16) + (heldForme ? 'FORME KEPT' : 'FORME NOT KEPT')
    + '   | ours = ' + meSp + ' / ' + meAb);
}
console.log('\n  played ' + played + ' | forme kept on the field ' + kept + ' | not kept ' + reverted
  + ' | could not play ' + threw);
if (!played) console.log('  ZERO GAMES PLAYED — this probe proves nothing. Treat as broken, not as a pass.');
