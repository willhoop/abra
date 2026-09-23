/* solver/tests/test-meta-artifacts.js — the meta artifacts agree with each other and with their input.
 *   node solver/tests/test-meta-artifacts.js      (after extract.js + analyze.js)
 * Checks that would each have caught a silent failure: the extract matches its digest, every side-game
 * is counted once, archetype shares partition the population, every kept entity is legal in M-C, and
 * no zero counter hides a capability that never ran (series linkage, mega detection, bring reveals). */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const L = require('../meta/lib.js');
let fail = 0, pass = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL ' + msg); } };
const J = f => JSON.parse(fs.readFileSync(path.join(L.OUT, f), 'utf8'));
const man = J('manifest.json'), U = J('usage.json'), A = J('archetypes.json'), BL = J('bringlead.json'), B3 = J('bo3.json'), S = J('sets.json');
const gzPath = path.join(L.OUT, 'games.clean.jsonl.gz');

ok(L.sha256File(gzPath) === man.output.sha256, 'extract digest matches manifest');
for (const f of [U, A, BL, B3, S]) ok(f.input && f.input.sha256 === man.output.sha256, 'analysis artifact was computed from this extract');
const G = zlib.gunzipSync(fs.readFileSync(gzPath)).toString().trim().split('\n').map(JSON.parse);
ok(G.length === man.kept.total, 'extract rows = manifest kept');
ok(new Set(G.map(g => g.id)).size === G.length, 'no duplicate game ids');
ok(U.totals.sides === 2 * G.length, 'every game contributes two side-games');
ok(G.every(g => g.sheets && g.sheets.length === 2 && g.sheets.every(s => s.length === 6)), 'every kept game has two six-slot sheets');

// exclusions + kept = store
const exTot = Object.values(man.exclusions.charged_first).reduce((a, v) => a + v.bo1 + v.bo3, 0);
ok(exTot + man.kept.total === man.games.distinct_ids, `exclusions (${exTot}) + kept (${man.kept.total}) = store ids (${man.games.distinct_ids})`);

// legality: nothing illegal survived
const illegal = new Set(['species', 'item', 'ability', 'move', 'nature'].flatMap(k => man.legality[k].illegal.map(x => k + ':' + x.id)));
let bad = 0;
for (const g of G) for (const sh of g.sheets) for (const m of sh) {
  if (illegal.has('species:' + m.s) || illegal.has('item:' + m.i) || illegal.has('ability:' + m.a) || illegal.has('nature:' + m.nt) || m.m.some(x => illegal.has('move:' + x))) bad++;
}
ok(bad === 0, 'no illegal entity on a kept sheet (' + bad + ')');

// species share sums to 6 per side (six distinct species per sheet)
const spSum = U.categories.species.rows.reduce((a, r) => a + r.k, 0);
ok(spSum === 6 * U.totals.sides, 'species counts sum to six per side-game');
const megaSum = U.categories.mega_used.rows.reduce((a, r) => a + r.k, 0);
ok(megaSum === U.totals.sides, 'mega_used (incl. none) partitions side-games');

// archetypes partition the population
const aSum = A.archetypes.reduce((a, r) => a + r.side_games, 0);
ok(aSum === U.totals.sides, 'archetype side-games partition the population');
ok(A.grid.length >= 5 && A.grid.every(g => g.ari_median != null), 'stability grid computed');

// capabilities that must prove they ran
ok(G.filter(g => g.mega[0] || g.mega[1]).length > 0, 'mega events detected');
ok(B3.series.linked > 0 && B3.transitions > 0, 'bo3 series linked from raw logs');
ok(BL.censoring.full_bring_sides > 0 && BL.species.length > 0, 'bring reveals counted');
ok(U.categories.species.tested_for_trend > 0, 'trend test ran');
ok(man.stores_moved_during_read.length === 0, 'no store moved during the read: ' + man.stores_moved_during_read.join(','));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
