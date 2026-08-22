/* probe_drag_exposure.js — HOW OFTEN IS THE BENCH ALREADY IN A DIFFERENT ORDER WHEN A DRAG LANDS?
 *
 *   SHOWDOWN_PATH=... node tests/probe_drag_exposure.js --release 6a05dd9ad60d \
 *        --team-store data/team-pool-frozen --games 40
 *
 * `tests/probe_drag_body.js` isolates the mechanism on a two-turn fixture: the two engines maintain
 * the party differently across a switch (authority SWAPS, sim/battle-actions.ts:125-132; medicham2
 * REMOVES AND APPENDS, medicham2-browser.js:12488 + :13077), and the drag die indexes into it.
 *
 * That says the defect EXISTS. It does not say how much of the real class it accounts for, and this
 * repo's standing rule is that a mechanism demonstrated on a fixture is not a population claim.
 *
 * SO THIS PLAYS REAL SWARM GAMES and measures two things per boundary, per side:
 *
 *   MEMBERS  do the two engines' eligible lists hold the same bodies? (a real board divergence)
 *   ORDER    given the same members, are they in the same ORDER? (invisible to every other
 *            instrument — `board_state.js:600 partyMap` keys the party BY SPECIES, so the state
 *            comparator is order-blind on the bench by construction and correctly so)
 *
 * and then, for the boundaries where the order is desynced, the AGREEMENT FRACTION: what share of
 * indices map to the same body. A uniform die over a desynced list agrees exactly that often.
 *
 * IT WRITES NOTHING. No artifact is touched; `--release` is mandatory for the reason
 * game_differential.js:196 records.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

if (!process.argv.includes('--state')) process.argv.push('--state');
if (!process.argv.includes('--release')) {
  console.log('REFUSING TO RUN — pass --release <id> (requiring the driver without it CUTS a release).');
  process.exit(2);
}
const flag = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const N = +flag('--games', 40);

const G = require(D('engine', 'game_differential.js'));
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const sdEligible = side => {
  const out = [];
  for (let i = side.active.length; i < side.pokemon.length; i++) {
    const p = side.pokemon[i];
    if (!p.fainted) out.push(id(p.species.id));
  }
  return out;
};
const medEligible = bench => bench.filter(m => m && !m.fainted && m.curHP > 0).map(m => id(m.name));

const stat = {
  boundaries: 0, sameMembers: 0, sameOrder: 0, diffMembers: 0, diffOrder: 0,
  byTurn: {}, agreeNum: 0, agreeDen: 0,
};
const drags = { games: 0, sd: 0, me: 0, agreeBody: 0, diffBody: 0, orderWasDesynced: 0, orderWasClean: 0 };

/* EVERY CONFIGURATION, NOT JUST `baseline`. The swarm splits its picked teams across configs, so
 * `pairsFor('baseline')` returned FOUR pairs out of 71 teams on the first run of this probe and the
 * sample was too small to say anything. Named here rather than left as a constant. */
const CONFIGS = [...new Set((G.SW.out || []).map(c => c.config))];
const pairs = [];
for (const c of CONFIGS) for (const p of G.pairsFor(c)) pairs.push(Object.assign({ config: c }, p));
console.log('\nHOW OFTEN IS THE BENCH ORDER ALREADY DESYNCED — real swarm games\n');
console.log('  mode ' + G.MODE);
console.log('  release ' + (G.REL && G.REL.id));
console.log('  pairs available ' + pairs.length + ', playing ' + Math.min(N, pairs.length) + '\n');

let played = 0;
for (const pr of pairs.slice(0, N)) {
  /* the LAST boundary before each drag, per side — read at the boundary and consumed by the drag */
  let lastOrderDesynced = { p1: false, p2: false };
  const r = G.playGame(pr.a, pr.b, pr.config, 'drag-exposure:' + pr.tag, {
    onBoundary: (snap, turnIdx, S, battle) => {
      for (const sd of ['p1', 'p2']) {
        const se = sdEligible(sd === 'p1' ? battle.p1 : battle.p2);
        const me = medEligible(sd === 'p1' ? S.benchA : S.benchB);
        stat.boundaries++;
        const sameM = [...se].sort().join() === [...me].sort().join();
        const sameO = se.length === me.length && se.every((v, i) => v === me[i]);
        if (sameM) stat.sameMembers++; else stat.diffMembers++;
        if (sameM && sameO) stat.sameOrder++;
        if (sameM && !sameO) {
          stat.diffOrder++;
          lastOrderDesynced[sd] = true;
          stat.agreeNum += se.filter((v, i) => v === me[i]).length;
          stat.agreeDen += se.length;
        } else if (sameM) { lastOrderDesynced[sd] = false; }
        const k = 't' + turnIdx;
        stat.byTurn[k] = stat.byTurn[k] || { n: 0, order: 0, members: 0 };
        stat.byTurn[k].n++;
        if (sameM && !sameO) stat.byTurn[k].order++;
        if (!sameM) stat.byTurn[k].members++;
      }
      snap.identical = true; snap.diffs = [];
    },
  });
  if (r.err) continue;
  played++;
  const sdLog = G.lastSdLog ? G.lastSdLog() : [];
  const meLog = (r && r.mediTrace) || [];
  const dragBodies = lines => {
    const out = [], seenB = new Set();
    for (const l of lines) {
      const m = /^\|drag\|([^|]*)\|([^|,]*)/.exec(String(l));
      if (!m || seenB.has(m[1] + '@' + out.length)) continue;
      out.push({ slot: m[1].split(':')[0].trim(), body: id(m[2]) });
    }
    /* the secret/shared `|split|` pair repeats the same arrival back to back */
    return out.filter((x, i) => !(i > 0 && out[i - 1].slot === x.slot && out[i - 1].body === x.body));
  };
  const sdD = dragBodies(sdLog), meD = dragBodies(meLog);
  if (sdD.length || meD.length) {
    drags.games++; drags.sd += sdD.length; drags.me += meD.length;
    const n = Math.min(sdD.length, meD.length);
    for (let i = 0; i < n; i++) {
      if (sdD[i].body === meD[i].body) drags.agreeBody++; else drags.diffBody++;
      const sd = sdD[i].slot.startsWith('p1') ? 'p1' : 'p2';
      if (lastOrderDesynced[sd]) drags.orderWasDesynced++; else drags.orderWasClean++;
    }
  }
}

const pc = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
console.log('  games played                 ' + played);
console.log('  boundaries measured          ' + stat.boundaries + '  (both sides, every turn)');
console.log('  same members, SAME order     ' + stat.sameOrder + '  ' + pc(stat.sameOrder, stat.boundaries));
console.log('  same members, DIFFERENT order' + stat.diffOrder + '  ' + pc(stat.diffOrder, stat.boundaries)
  + '   <- invisible to board_state.js, which keys the party by species');
console.log('  DIFFERENT members            ' + stat.diffMembers + '  ' + pc(stat.diffMembers, stat.boundaries)
  + '   (a real board divergence, not this defect)');
console.log('\n  on a DESYNCED board, the share of indices that still map to the same body: '
  + pc(stat.agreeNum, stat.agreeDen) + '   (' + stat.agreeNum + ' / ' + stat.agreeDen + ')');
console.log('  -> a uniform drag die over such a list agrees exactly that often.\n');
console.log('  by turn boundary:');
for (const k of Object.keys(stat.byTurn).sort((a, b) => +a.slice(1) - +b.slice(1))) {
  const v = stat.byTurn[k];
  console.log('    ' + k.padEnd(5) + ' n=' + String(v.n).padStart(4)
    + '  order desynced ' + String(v.order).padStart(4) + ' ' + pc(v.order, v.n).padStart(7)
    + '  members differ ' + String(v.members).padStart(4) + ' ' + pc(v.members, v.n).padStart(7));
}
console.log('\n  DRAGS OBSERVED');
console.log('    games with a drag            ' + drags.games);
console.log('    |drag| lines  showdown ' + drags.sd + '   medicham ' + drags.me);
console.log('    paired: same body ' + drags.agreeBody + '   DIFFERENT body ' + drags.diffBody
  + '   (' + pc(drags.diffBody, drags.agreeBody + drags.diffBody) + ' differ)');
console.log('    of those pairs, the side\'s bench order was already desynced at the last boundary: '
  + drags.orderWasDesynced + '   clean: ' + drags.orderWasClean);
