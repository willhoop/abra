/* solver/tests/test-meta-lib.js — pins the statistics, parsing and legality helpers used by
 * solver/meta/. Exits non-zero on any failure.   node solver/tests/test-meta-lib.js
 * No Pokemon value is typed: the legality cases derive their examples from the M-C dex. */
'use strict';
const L = require('../meta/lib.js');
const K = require('../meta/kmeans.js');
let fail = 0, pass = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL ' + msg); } };
const near = (a, b, t, msg) => ok(Math.abs(a - b) <= t, `${msg}: ${a} vs ${b}`);

// Wilson: textbook value for 10/100 at 95% is [0.0552, 0.1744]
const w = L.wilson(10, 100);
near(w[0], 0.0552, 5e-4, 'wilson lo'); near(w[1], 0.1744, 5e-4, 'wilson hi');
ok(L.wilson(0, 0)[0] === null, 'wilson n=0 is null');
near(L.wilson(0, 50)[0], 0, 1e-12, 'wilson k=0 lower'); near(L.wilson(50, 50)[1], 1, 1e-12, 'wilson k=n upper');

// BH: known example
const q = L.bh([0.01, 0.04, 0.03, 0.005]);
near(q[3], 0.02, 1e-9, 'bh smallest'); near(q[0], 0.02, 1e-9, 'bh second'); near(q[2], 0.04, 1e-9, 'bh third'); near(q[1], 0.04, 1e-9, 'bh largest');

// normal p-value
near(L.pTwo(1.959963984540054), 0.05, 1e-4, 'pTwo 1.96');
near(L.pTwo(0), 1, 1e-6, 'pTwo 0');

// ARI: identical and relabelled partitions are 1; independent labels near 0
ok(Math.abs(L.ari([0, 0, 1, 1, 2, 2], [5, 5, 3, 3, 9, 9]) - 1) < 1e-12, 'ari relabel = 1');
const R = L.rng(7); const a = [], b = [];
for (let i = 0; i < 20000; i++) { a.push(Math.floor(R() * 4)); b.push(Math.floor(R() * 4)); }
ok(Math.abs(L.ari(a, b)) < 0.01, 'ari independent ~ 0');

// cluster ratio: equal-size clusters with identical rates -> se 0; one giant cluster dominates SE
const cr = L.clusterRatio([[5, 10], [5, 10], [5, 10]]);
near(cr.p, 0.5, 1e-12, 'clusterRatio p'); near(cr.se, 0, 1e-12, 'clusterRatio se 0');
const cr2 = L.clusterRatio([[10, 10], [0, 10], [10, 10], [0, 10]]);
ok(cr2.se > Math.sqrt(0.25 / 40), 'clustered data has SE above the iid SE');
const cd = L.clusterDiff([[1, 2, 2, 2], [1, 2, 2, 2], [0, 2, 1, 2]]);
near(cd.diff, (5 / 6) - (2 / 6), 1e-12, 'clusterDiff diff');

// raw-log facts: the bestof header, the rated flag and the custom-rule infobox
const log = '|j|x\n|uhtml|bestof|<h2><strong>Game 2</strong> of <a href="/game-bestof3-gen9championsvgc2026regmcbo3-123">a best-of-3</a></h2>\n|rated|\n'
  + '|raw|<div class="infobox"><details class="readmore"><summary><strong>2 custom rules:</strong></summary> Best of = 3, !Obtainable</details></div>';
const f = L.rawFacts(log);
ok(f.gameNo === 2 && f.bestOf === 3 && f.series === 'gen9championsvgc2026regmcbo3-123', 'bestof parsed');
ok(f.rated === true, 'rated parsed');
ok(f.custom === 'Best of = 3, !Obtainable', 'custom infobox parsed: ' + f.custom);
const f1 = L.rawFacts('|raw|<strong>1 custom rule:</strong></summary> Force Open Team Sheets</details>');
ok(f1.custom === 'Force Open Team Sheets', 'singular custom rule parsed (the rules? lesson)');
ok(L.rawFacts('|j|x\n|player|p1|a').custom === null && L.rawFacts('|j|x').rated === false, 'plain log has no custom/rated');

// k-means recovers three planted, disjoint groups
const V = 30, X = [];
const R2 = L.rng(3);
for (let g = 0; g < 3; g++) for (let i = 0; i < 200; i++) {
  const pool = Array.from({ length: 10 }, (_, j) => g * 10 + j);
  const pick = new Set(); while (pick.size < 6) pick.add(pool[Math.floor(R2() * 10)]);
  X.push([...pick].sort((x, y) => x - y));
}
const truth = X.map((_, i) => Math.floor(i / 200));
const m = K.fit(X, V, 3, { restarts: 4, seed: 11 });
ok(L.ari(truth, m.labels) > 0.99, 'kmeans recovers planted clusters: ARI ' + L.ari(truth, m.labels));
ok(L.ari(truth, K.assign(X, m.C, V)) > 0.99, 'assign reproduces fit labels');

// legality: derived, never typed. A Past item and a legal item, both found by walking the dex.
try {
  const leg = require('../meta/legality.js').open();
  const D = leg.D;
  const past = D.items.all().find(x => x.exists && x.isNonstandard === 'Past');
  const legal = D.items.all().find(x => x.exists && !x.isNonstandard);
  ok(past && leg.check('item', past.id).ok === false, 'a Past item is illegal');
  ok(legal && leg.check('item', legal.id).ok === true, 'a standard item is legal');
  const pastSp = D.species.all().find(x => x.exists && x.isNonstandard === 'Past' && !x.battleOnly);
  ok(pastSp && leg.check('species', pastSp.id).ok === false, 'a Past species is illegal');
  ok(leg.check('move', 'zzznotamove').ok === false, 'a non-existent move is illegal');
  ok(leg.co.head === leg.co.pinned, 'M-C checkout HEAD equals the pin in data/regulations.json');
} catch (e) { fail++; console.log('FAIL legality could not open the M-C checkout: ' + e.message); }

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
