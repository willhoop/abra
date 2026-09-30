/* solver/tests/test-rotom-top-rotation.js — the TOP-META ladder rotation (solver/rotom/teams/ladder-rotation-top.json,
 * built by solver/rotom/build_top_rotation.js) is what it claims: top-rated, meta, legal, complete. No game is played.
 *
 *   node solver/tests/test-rotom-top-rotation.js                  exit 0 GREEN, 1 RED
 *   node solver/tests/test-rotom-top-rotation.js --break floor    deliberate break: a copy of T1 re-rated 1200 is added
 *   node solver/tests/test-rotom-top-rotation.js --break illegal  deliberate break: T1's first item swapped for one the
 *                                                                 format marks nonstandard (read from the dex, not typed)
 *   node solver/tests/test-rotom-top-rotation.js --break offmeta  deliberate break: T1 carries a species at 0.5% of top teams
 *   Each break must go RED.
 *
 *   CHECK     build_top_rotation.checkRotation passes on the file: 3-5 teams; each passes Showdown's TeamValidator for the
 *             bo3 format; every set complete (item, ability, nature, four moves) and every entity legal in the format;
 *             every team's rating >= the recorded floor, and its from_game side in the store has that player at that
 *             rating; family evidence meets the META bar (>= 2 players, >= 8 games, S - E >= the top baseline, every
 *             species >= 3% of top teams); one team per archetype.
 *   CONTROL   the same check REFUSES each of the three breaks on a copy (so a green CHECK is a check that can see).
 *   ARM       solver/rotom/arms/gen5-chomp-top.json names this rotation, and its arm A equals gen5-chomp.json's arm A.
 *   REBUILD   when the store's sha256 equals the one recorded, a rebuild gives the same teams (same games, same packed
 *             sets; the spreads replayed from the file). When the store has moved (the hourly ingest), it says so and
 *             counts it NOT CHECKED — never a pass.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
require('../arena/env.js');
const X = require('../human/dex.js');
const B = require('../rotom/build_top_rotation.js');

const argv = process.argv.slice(2);
const BREAK = argv.includes('--break') ? argv[argv.indexOf('--break') + 1] : null;
let fails = 0, checks = 0, notChecked = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };

const ROTF = path.join(ROOT, 'solver', 'rotom', 'teams', 'ladder-rotation-top.json');
const ROT = JSON.parse(fs.readFileSync(ROTF, 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
const { Teams } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));

/* the three breaks, each a pure function of a rotation copy */
const nonstandardItem = X.D.items.all().find(i => i.exists && i.isNonstandard && !i.megaStone && !i.zMove);
const BREAKS = {
  floor: r => { const t = clone(r.teams[0]); t.id = 'TX'; t.rating = 1200; t.archetype.id = 'break:floor'; r.teams = r.teams.slice(0, 4).concat([t]); return r; },
  illegal: r => { const s = Teams.unpack(r.teams[0].packed); s[0].item = nonstandardItem.name; r.teams[0].packed = Teams.pack(s); return r; },
  offmeta: r => { const k = Object.keys(r.teams[0].family.species_share_at_floor)[0]; r.teams[0].family.species_share_at_floor[k] = 0.5; return r; },
};
if (BREAK && !BREAKS[BREAK]) { console.error('unknown --break ' + BREAK + ' (floor | illegal | offmeta)'); process.exit(2); }
const SUBJECT = BREAK ? BREAKS[BREAK](clone(ROT)) : ROT;

/* ---------------- CHECK ---------------- */
const games = new Map(B.readStore(B.STORE_DEFAULT).map(g => [g.id, g]));
const bad = B.checkRotation(SUBJECT, games);
ok('CHECK', bad.length === 0, 'checkRotation: ' + bad.join(' | '));
ok('CHECK', ROT.rule && ROT.rule.floor >= 1300 && ROT.rule.FLOOR_PCT === B.RULE.FLOOR_PCT, 'the recorded floor ' + (ROT.rule && ROT.rule.floor) + ' at q' + (ROT.rule && ROT.rule.FLOOR_PCT) + ' (the builder\'s rule is q' + B.RULE.FLOOR_PCT + ')');

/* ---------------- CONTROL ---------------- */
ok('CONTROL', !!nonstandardItem, 'the dex yields a nonstandard item to break with: ' + (nonstandardItem && nonstandardItem.name));
for (const [k, f] of Object.entries(BREAKS)) {
  const b = B.checkRotation(f(clone(ROT)), games);
  const want = { floor: /below the floor/, illegal: /(TeamValidator|not legal)/, offmeta: /off-meta species/ }[k];
  ok('CONTROL', b.some(x => want.test(x)), 'the check refuses the ' + k + ' break: ' + JSON.stringify(b).slice(0, 300));
}

/* ---------------- ARM ---------------- */
{
  const top = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'arms', 'gen5-chomp-top.json'), 'utf8'));
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'arms', 'gen5-chomp.json'), 'utf8'));
  ok('ARM', top.rotation === 'solver/rotom/teams/ladder-rotation-top.json', 'gen5-chomp-top names the top rotation: ' + top.rotation);
  ok('ARM', JSON.stringify(top.arms) === JSON.stringify(base.arms), 'arm A is gen5-chomp\'s arm A, unchanged');
  ok('ARM', !base.rotation, 'gen5-chomp.json is untouched (no rotation key; it still plays the default rotation)');
}

/* ---------------- REBUILD ---------------- */
{
  const shaNow = crypto.createHash('sha256').update(fs.readFileSync(B.STORE_DEFAULT)).digest('hex');
  if (shaNow !== ROT.source.store.sha256) { notChecked++; console.log('  NOT CHECKED [REBUILD] the store moved since the build (' + ROT.source.store.sha256.slice(0, 12) + ' -> ' + shaNow.slice(0, 12) + '); a rebuild would read other games'); }
  else {
    /* the spreads are replayed from the file (SP.recorded): this clause re-checks the TEAM CHOICE; re-deriving the
     * spreads is solver/tests/test-rotom-spreads.js's REPRODUCE clause, which pins its own store */
    const re = B.build({ deriver: require('../rotom/spreads.js').recorded(ROT) });
    ok('REBUILD', JSON.stringify(re.teams.map(t => [t.from_game, t.packed, t.bring])) === JSON.stringify(ROT.teams.map(t => [t.from_game, t.packed, t.bring])) && re.rule.floor === ROT.rule.floor,
       'a rebuild on the same store gives the same floor and teams');
  }
}

console.log((fails ? 'RED' : 'GREEN') + ' ' + (checks - fails) + '/' + checks + (notChecked ? '  (' + notChecked + ' NOT CHECKED, named above)' : '') + (BREAK ? '  (deliberate break: ' + BREAK + ')' : ''));
process.exit(fails ? 1 : 0);
