/* test-fixture-runtime-check.js — THE RUNTIME HALF OF THE FIXTURE LEGALITY CHECK PROVES IT RUNS.
 *
 *   SHOWDOWN_PATH=... node tests/test-fixture-runtime-check.js
 *
 * `engine/game_differential.js` `buildPair` puts every fixture body a file under tests/ builds to
 * `fixture_legality.checkSet` (the static sweep's own verdict function). A capability that cannot prove
 * it ran is assumed broken, so this file builds, through that door and from under tests/:
 *   - an ILLEGAL learnset pair, derived: the first legal non-mega species and the first legal move the
 *     validator says it cannot learn;
 *   - an ILLEGAL gender, derived: the first legal male-only species declared female;
 *   - a LEGAL control: the same species with a move it can learn, gender unspecified.
 * The two illegal ones must be reported with this file's own line; the control must not be.
 * Nothing is typed: every body and move comes from the format.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
delete process.env.GD_FIXTURE_CHECK;
process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let fails = 0;
const ok = (c, msg) => { console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + msg); if (!c) fails++; };
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const L = dex.species.all().filter(s => legal(s) && !s.isMega && !s.battleOnly && CS.canLearn(s.name, 'Protect'));
const A = L[0];
const cannot = dex.moves.all().filter(m => legal(m) && m.category !== 'Status').find(m => !CS.canLearn(A.name, m.name));
const male = L.find(s => s.gender === 'M');
if (!A || !cannot || !male) { console.log('FIXTURE — could not derive the plants'); process.exit(1); }
console.log('\nFIXTURE RUNTIME CHECK — plants: ' + A.name + ' with ' + cannot.name + '; ' + male.name + ' declared F; control ' + A.name + ' with Protect\n');

const before = G.seamCounters().fixtureSetsChecked;
G.buildPair([{ species: A.name, item: '', ability: '', moves: ['Protect'] }]);
G.buildPair([{ species: A.name, item: '', ability: '', moves: [cannot.name, 'Protect'] }]);
G.buildPair([{ species: male.name, item: '', ability: '', moves: ['Protect'], gender: 'F' }]);
const seen = G.fixtureIllegal();
ok(G.seamCounters().fixtureSetsChecked - before === 3, 'the hook checked all three sets built from under tests/ (' + (G.seamCounters().fixtureSetsChecked - before) + ')');
/* WHY THE THREE READS BELOW DO NOT GO THROUGH THE DOOR. They read `x.set.species` on the REPORTED
 * SET — the literal input this file built a few lines above — so they are matching their own plants
 * by the name chosen for them, not asking "which roster body is this". Routing them through the
 * resolver would be wrong twice over: the door resolves a LIVE body and these are inert set objects,
 * and a test of the reporting hook that used the resolver to find its own plants could pass while the
 * hook reported nothing at all. Each read carries its own marker because the audit looks three lines
 * up, and a declaration further away than that silently stops applying. */
/* IDENTITY-OK: matching this file's own plant by the name it chose — see the block above. */
const learn = seen.find(x => x.set.species === A.name && x.set.moves.includes(cannot.name));
ok(!!learn && /test-fixture-runtime-check\.js:\d+/.test(learn.site), 'the illegal learnset pair is reported, with the building line: ' + (learn ? learn.site + ' — ' + learn.problems.join(' | ') : '(not reported)'));
/* IDENTITY-OK: matching this file's own plant by the name it chose — see the block above. */
const gen = seen.find(x => x.set.species === male.name && x.set.gender === 'F');
ok(!!gen && gen.problems.some(p => /declared female/.test(p)), 'the impossible gender is reported: ' + (gen ? gen.problems.join(' | ') : '(not reported)'));
/* IDENTITY-OK: matching this file's own plant by the name it chose — see the block above. */
ok(!seen.some(x => x.set.species === A.name && !x.set.moves.includes(cannot.name)), 'the legal control is NOT reported');

console.log('\nFIXTURE RUNTIME CHECK: ' + (fails ? fails + ' FAILED' : 'ALL GREEN'));
process.exit(fails ? 1 : 0);
