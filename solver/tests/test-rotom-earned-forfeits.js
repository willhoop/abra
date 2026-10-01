/* solver/tests/test-rotom-earned-forfeits.js — EARNED FORFEITS (Will, 2026-10-01: "lets count forfeits where we are up in
 * pokemon counts as real wins"; abra/regmc 1.70.0). An opponent forfeit or timeout is a REAL win when, at the quit line,
 * turn >= 1 and our Pokemon left (|teamsize| minus our |faint| lines) outnumber theirs. Level, behind, at preview or turn 0
 * is unearned. A won series is clean / earned / unearned; the ladder record is given three ways. Constructed protocol only:
 * no server, no battle, no real run directory is read or written.
 *
 *   node solver/tests/test-rotom-earned-forfeits.js                 exit 0 GREEN, 1 RED
 *   node solver/tests/test-rotom-earned-forfeits.js --break <name>  a deliberate break of the CODE (loaded with the edit
 *                                                                   applied, the file on disk untouched); must go RED.
 *                                                                   Names: ahead, preview, faint, series, walkaway, record
 *
 *   GAME     an EARNED forfeit (4 left vs 2, turn 3); an UNEARNED forfeit (level 3-3); one behind (2-3, us on p2); a PREVIEW
 *            forfeit (no |teamsize|, turn 0); a turn-0 forfeit after |teamsize| (leads out, no turn played); an earned
 *            timeout; a normal game has earned null; a game with no |teamsize| at turn 2 is no_count, unearned.
 *   SERIES   2-1 decided by an earned g3 forfeit = earned; g1 earned + g3 unearned = unearned; the walkaway = unearned; a
 *            lost series = null; 2-0 normal = clean; a series forfeit landing mid-game is classed from the live game's lines.
 *   RECORD   ladderRecord's three ways: earned_counted keeps clean + earned wins, any_forfeit_excluded keeps clean only,
 *            all keeps everything; a won quit row with no earned fields is never guessed earned.
 *   RUN      a constructed run directory (series book, game logs, rows written before win_class existed): report.js
 *            ladderReport classes every row from the logs and writes nothing into the directory.
 *   BREAKS   every break above, run as a child, goes RED.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const Module = require('module');

const ROOT = path.join(__dirname, '..', '..');
const bi = process.argv.indexOf('--break');
const BREAK = bi >= 0 ? process.argv[bi + 1] : null;
let fails = 0, checks = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };

function load(rel, edits) {
  const f = path.join(ROOT, rel);
  if (!edits || !edits.length) return require(f);
  let src = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of edits) { if (!src.includes(a)) throw new Error('break anchor not found in ' + rel + ': ' + a); src = src.split(a).join(b); }
  const m = new Module(f, module); m.filename = f; m.paths = Module._nodeModulePaths(path.dirname(f)); m._compile(src, f);
  require.cache[f] = m;   // so report.js / backfill_ends.js require the broken endings.js too
  return m.exports;
}
const EJS = 'solver/rotom/endings.js';
const BREAKS = {
  ahead: [EJS, [['return Object.assign(f, { earned: d > 0,', 'return Object.assign(f, { earned: d >= 0,']]],
  preview: [EJS, [["if (!at || at.turn < 1) return Object.assign(f, { earned: false, earned_why: 'preview' });", "if (!at) return Object.assign(f, { earned: false, earned_why: 'preview' });"]]],
  faint: [EJS, [['else if ((m = /^\\|faint\\|(p[12])[a-z]?:/.exec(l))) fainted[m[1]]++;', '']]],
  series: [EJS, [["return Q.every(g => g.earned === true) ? 'earned' : 'unearned';", "return Q.some(g => g.earned === true) ? 'earned' : 'unearned';"]]],
  /* both guards: the explicit walkaway line and the "a quit no game carries" fallback that would also catch it */
  walkaway: [EJS, [["if (end_reason === 'walkaway_opp') return 'unearned';", ''], ["if (!Q.length) return OPP_QUIT.has(end_reason) ? 'unearned' : 'clean';", "if (!Q.length) return 'clean';"]]],
  record: [EJS, [['earned_counted: one(rs.filter(r => !unearned(r))),', 'earned_counted: one(rs),']]],
};
if (BREAK && !BREAKS[BREAK]) { console.error('unknown --break ' + BREAK + '; one of ' + Object.keys(BREAKS).join(', ')); process.exit(2); }
const E = load(EJS, BREAK ? BREAKS[BREAK][1] : null);
const REP = require(path.join(ROOT, 'solver/rotom/report.js'));

/* ---------------- GAME ---------------- */
const ME = 'medicham32', OPP = 'Some Human';
const head = (meSide) => ['|init|battle', '|player|' + (meSide === 'p2' ? 'p1|' + OPP : 'p1|' + ME) + '|1|1000', '|player|' + (meSide === 'p2' ? 'p2|' + ME : 'p2|' + OPP) + '|2|1100',
  '|gametype|doubles', '|rated|', '|clearpoke', '|poke|p1|A, L50|', '|poke|p2|B, L50|', '|teampreview|4'];
const picked = ['|', '|t:|1', '|teamsize|p1|4', '|teamsize|p2|4', '|start', '|switch|p1a: A|A, L50|100/100', '|switch|p2a: B|B, L50|100/100'];
const turns = (from, to) => { const a = []; for (let t = from; t <= to; t++) a.push('|', '|move|p1a: A|Tackle|p2a: B', '|upkeep', '|turn|' + t); return a; };
const quit = who => ['|-message|' + who + ' forfeited.', '|', '|win|' + (who === OPP ? ME : OPP)];
const G = {
  earned:   head('p1').concat(picked, ['|turn|1'], turns(2, 3), ['|faint|p2a: B', '|faint|p2b: C'], quit(OPP)),                      // 4 vs 2, turn 3
  level:    head('p1').concat(picked, ['|turn|1'], turns(2, 5), ['|faint|p2a: B', '|faint|p1a: A'], quit(OPP)),                       // 3 vs 3
  behind:   head('p2').concat(picked, ['|turn|1'], turns(2, 9), ['|faint|p2a: X', '|faint|p2a: Y', '|faint|p1b: Z'], quit(OPP)),       // us p2: 2 vs 3
  preview:  head('p1').concat(quit(OPP)),                                                                                            // no teamsize, turn 0
  turn0:    head('p1').concat(picked, quit(OPP)),                                                                                    // leads out, no turn
  timeout:  head('p1').concat(picked, ['|turn|1'], turns(2, 6), ['|faint|p2a: B', '|-message|' + OPP + ' lost due to inactivity.', '|', '|win|' + ME]),
  normal:   head('p1').concat(picked, ['|turn|1'], turns(2, 7), ['|faint|p2a: B', '|faint|p2b: C', '|faint|p2a: D', '|faint|p2b: E', '|win|' + ME]),
  nocount:  head('p1').concat(['|start', '|turn|1'], turns(2, 2), ['|faint|p2a: B'], quit(OPP)),
};
const want = {   // [end_reason, earned, earned_why, left_me, left_opp, quit_turn]
  earned: ['forfeit_opp', true, 'ahead', 4, 2, 3], level: ['forfeit_opp', false, 'level', 3, 3, 5], behind: ['forfeit_opp', false, 'behind', 2, 3, 9],
  preview: ['forfeit_opp', false, 'preview', null, null, 0], turn0: ['forfeit_opp', false, 'preview', 4, 4, 0], timeout: ['timeout_opp', true, 'ahead', 4, 3, 6],
  normal: ['normal', null, null, null, null, null], nocount: ['forfeit_opp', false, 'no_count', null, null, 2],
};
for (const [k, w] of Object.entries(want)) {
  const g = E.gameEnd(G[k].join('\r\n'), ME);
  const got = [g.end_reason, g.earned, g.earned_why, g.left_me, g.left_opp, g.quit_turn];
  ok('GAME', JSON.stringify(got) === JSON.stringify(w), k + ': want ' + JSON.stringify(w) + ' got ' + JSON.stringify(got));
}

/* ---------------- SERIES ---------------- */
const ge = (gnum, k) => Object.assign({ gnum }, E.gameEnd(G[k], ME));
const W = { winner: ME, mine: true }, Lz = { winner: OPP, mine: false };
const lostNormal = gnum => Object.assign({ gnum }, E.gameEnd(head('p1').concat(picked, ['|turn|1'], turns(2, 8), ['|win|' + OPP]), ME));
const S = [
  ['2-1 decided by an EARNED forfeit in game 3', [ge(1, 'normal'), lostNormal(2), ge(3, 'earned')], W, 'earned', 'forfeit_opp'],
  ['2-1 decided by a forfeit in game 3 while LEVEL', [ge(1, 'normal'), lostNormal(2), ge(3, 'level')], W, 'unearned', 'forfeit_opp'],
  ['g1 earned, g3 unearned (preview)', [ge(1, 'earned'), lostNormal(2), ge(3, 'preview')], W, 'unearned', 'forfeit_opp'],
  ['g1 earned forfeit, g2 normal (the series ends normal)', [ge(1, 'earned'), ge(2, 'normal')], W, 'earned', 'normal'],
  ['g1 PREVIEW forfeit, g2 normal (any unearned game taints the win)', [ge(1, 'preview'), ge(2, 'normal')], W, 'unearned', 'normal'],
  ['2-0 normal', [ge(1, 'normal'), ge(2, 'normal')], W, 'clean', 'normal'],
  ['the walkaway (we lost g1, they left before g2)', [lostNormal(1)], W, 'unearned', 'walkaway_opp'],
  ['a LOST series with an earned forfeit win in it', [ge(1, 'earned'), lostNormal(2), lostNormal(3)], Lz, null, 'normal'],
];
for (const [name, games, res, cls, reason] of S) {
  const s = E.seriesEnd(games, res, ME);
  ok('SERIES', s.win_class === cls && s.end_reason === reason, name + ': want ' + cls + '/' + reason + ' got ' + s.win_class + '/' + s.end_reason);
}
{ const live = head('p1').concat(picked, ['|turn|1'], turns(2, 4), ['|faint|p2a: B']);
  const s = E.seriesEnd([ge(1, 'normal')], W, ME, { quitLines: ['||' + OPP + ' forfeited.'], liveGnum: 2, liveTurn: 4, liveLines: live });
  ok('SERIES', s.end_reason === 'forfeit_opp' && s.win_class === 'earned' && s.quit_games.length === 1 && s.quit_games[0].left_me === 4 && s.quit_games[0].left_opp === 3,
     'a series forfeit mid-game 2 (4 vs 3, turn 4) is classed from the live lines: ' + JSON.stringify({ r: s.end_reason, c: s.win_class, q: s.quit_games }));
  const s0 = E.seriesEnd([ge(1, 'normal')], W, ME, { quitLines: ['||' + OPP + ' forfeited.'], liveGnum: 2, liveTurn: 0, liveLines: head('p1') });
  ok('SERIES', s0.win_class === 'unearned', 'a series forfeit at game 2 preview is unearned: ' + s0.win_class); }

/* ---------------- RECORD ---------------- */
const row = (k, S, cls, end_reason) => ({ k, arm: 'A', S, rated: true, end_reason, win_class: cls, residual: S - 0.5, rating_me: { before: 1000, after: 1000 } });
const rows = [row(1, 1, 'clean', 'normal'), row(2, 1, 'earned', 'forfeit_opp'), row(3, 1, 'unearned', 'forfeit_opp'), row(4, 1, 'unearned', 'walkaway_opp'),
              row(5, 0, null, 'normal'), row(6, 1, 'earned', 'normal'),
              /* a row written before win_class, its games_end without earned fields: never guessed earned */
              Object.assign(row(7, 1, undefined, 'forfeit_opp'), { games_end: [{ gnum: 1, end_reason: 'forfeit_opp' }] })];
delete rows[6].win_class;
const R = E.ladderRecord(rows, { rated: true });
ok('RECORD', R.all.record === '6-1', 'all 6-1: ' + R.all.record);
ok('RECORD', R.earned_counted.record === '3-1', 'earned counted 3-1 (clean k1, earned k2 and k6): ' + R.earned_counted.record);
ok('RECORD', R.any_forfeit_excluded.record === '1-1', 'all forfeits excluded 1-1 (clean k1 only): ' + R.any_forfeit_excluded.record);
ok('RECORD', R.win_class.unearned === 3 && R.win_class.earned === 2 && R.win_class.clean === 1 && R.win_class_missing === 1, 'classes ' + JSON.stringify(R.win_class) + ' missing ' + R.win_class_missing);
ok('RECORD', R.without_quit_wins.record === '2-1', 'legacy without_quit_wins unchanged (drops k2, k3, k4, k7 by the deciding end; keeps k6): ' + R.without_quit_wins.record);

/* ---------------- RUN (a constructed run directory, rows written before win_class) ---------------- */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-earned-'));
try {
  fs.mkdirSync(path.join(TMP, 'series', ME), { recursive: true }); fs.mkdirSync(path.join(TMP, 'games', ME), { recursive: true });
  const series = [['s1', [['r1a', 'earned']], 1], ['s2', [['r2a', 'preview']], 1], ['s3', [['r3a', 'normal'], ['r3b', 'level']], 1], ['s4', [['r4a', 'normal'], ['r4b', 'normal']], 1]];
  const lines = [];
  series.forEach(([id, games, S], i) => {
    for (const [room, k] of games) fs.writeFileSync(path.join(TMP, 'games', ME, room + '.log'), G[k].join('\n'));
    fs.writeFileSync(path.join(TMP, 'series', ME, id + '.json'), JSON.stringify({ id, games: games.map(([room], j) => ({ room, gnum: j + 1, me: 'p1', winner: 'p1' })), result: W }));
    lines.push(JSON.stringify({ client: ME, k: i + 1, series: id, arm: 'A', rated: true, S, E: 0.5, residual: S - 0.5, result: W, end_reason: E.gameEnd(G[games[games.length - 1][1]], ME).end_reason }));
  });
  fs.writeFileSync(path.join(TMP, 'ladder-series-' + ME + '.jsonl'), lines.join('\n') + '\n');
  const before = fs.readdirSync(TMP).sort().join(',');
  const r = REP.ladderReport(TMP);
  const cls = Object.fromEntries((require(path.join(ROOT, 'solver/rotom/backfill_ends.js')).classifyRun(TMP).clients[ME].rows).map(x => [x.series, x.win_class]));
  ok('RUN', cls.s1 === 'earned' && cls.s2 === 'unearned' && cls.s3 === 'unearned' && cls.s4 === 'clean', 'classed from the logs: ' + JSON.stringify(cls));
  ok('RUN', r.earned_counted.record === '2-0' && r.all.record === '4-0' && r.any_forfeit_excluded.record === '1-0', 'report three ways: ' + [r.earned_counted.record, r.all.record, r.any_forfeit_excluded.record].join(' / '));
  ok('RUN', fs.readdirSync(TMP).sort().join(',') === before, 'nothing written into the run directory');
} finally { fs.rmSync(TMP, { recursive: true, force: true }); }

/* ---------------- BREAKS ---------------- */
if (!BREAK) for (const b of Object.keys(BREAKS)) {
  const res = cp.spawnSync(process.execPath, [__filename, '--break', b], { encoding: 'utf8' });
  ok('BREAKS', res.status === 1, '--break ' + b + ' -> ' + (res.status === 1 ? 'RED' : 'NOT RED: exit ' + res.status + ' ' + String(res.stderr || res.stdout).slice(-200)));
}

console.log((fails ? 'RED' : 'GREEN') + ' test-rotom-earned-forfeits' + (BREAK ? ' --break ' + BREAK : '') + ': ' + (checks - fails) + '/' + checks);
process.exit(fails ? 1 : 0);
