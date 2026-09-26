/* solver/tests/test-rotom-endings.js — HOW a game and a series ended (solver/rotom/endings.js), the ladder's halt on our own
 * forfeit / timeout / walkaway (solver/rotom/ladder.js onSelfQuit), and the RATED-ONLY record (endings.js ladderRecord,
 * report.js gamesReport). Constructed protocol sequences; no server, no battle. The real client is exercised by
 * solver/tests/test-rotom-endings-live.js.
 *
 *   node solver/tests/test-rotom-endings.js                 exit 0 GREEN, 1 RED
 *   node solver/tests/test-rotom-endings.js --break <name>  one deliberate break of the CODE (the module is loaded with
 *                                                           the edit applied); the run must go RED. Names: quit, walkaway,
 *                                                           rated, halt, gamesrated, allnormal
 *
 *   GAME      one sequence per end_reason: normal, forfeit_opp (mid-game, aa1 k3 g2 shape), forfeit_opp AT PREVIEW
 *             (gen5ab k13 g1 shape), forfeit_me, timeout_opp at preview (gen5ab k9 g2 shape), timeout_me, inactivity
 *             (every side timed out: a tie), tie, unknown, a rename forfeit, the series' inactivity forwarded into a game;
 *             end_turn, at_preview, end_by and end_raw; a quit line AFTER the |win| is not this game's end.
 *   SERIES    2-0 normal; 2-1 normal; a forfeit decider; a series forfeited in game 1 (1-0); THE WALKAWAY (gen5ab k8: we lost
 *             g1 normally and won the series with no g2); our own walkaway; gen5ab k33 (g1 forfeited, g2 normal: the
 *             series is normal and any_forfeit_opp is true); a series forfeit landing mid-game.
 *   RECORD    ladderRecord refuses to run without { rated: true }; an UNRATED win (gen5ab k30: rated false, S 1) is not in
 *             the record, the mean S or the residual; with and without quit wins; self quits counted.
 *   HALT      the real ladder controller: a game-level forfeit_me halts (ladder_halt, a self_quit error, the search
 *             cancelled, exit 4 once idle); a row whose series ended walkaway_me halts; an opponent walkaway and an
 *             opponent forfeit do NOT halt; one quit seen at the game and again at the series counts once; the row carries
 *             end_reason, end_game, games_won/lost and games_end.
 *   GAMES     report.js gamesReport: an unrated series is excluded from the record (the k30 bug) and listed; a series
 *             ended short by an opponent forfeit is a W, and "without quit wins" drops it; end_reason is derived from the
 *             battle log when the record has none.
 *   BREAKS    every break above, run as a child, goes RED (so none of these clauses is asking nothing).
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

/* load a solver module with a deliberate edit applied to its SOURCE (never the file on disk) */
function load(rel, edits) {
  const f = path.join(ROOT, rel);
  if (!edits || !edits.length) return require(f);
  let src = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of edits) { if (!src.includes(a)) throw new Error('break anchor not found in ' + rel + ': ' + a); src = src.split(a).join(b); }
  const m = new Module(f, module); m.filename = f; m.paths = Module._nodeModulePaths(path.dirname(f)); m._compile(src, f);
  return m.exports;
}
const BREAKS = {
  quit: ['solver/rotom/endings.js', [['const q = quitLine(l); if (q && !win && !tie) quit = q;', '']]],
  allnormal: ['solver/rotom/endings.js', [["else if (quit && (win || tie)) { end_reason = quit.kind + '_' + side(quit.by, me);", "else if (quit && (win || tie)) { end_reason = 'normal';"]]],
  walkaway: ['solver/rotom/endings.js', [['} else if (winnerWins >= need || lastQuit) {', '} else if (last) {']]],
  rated: ['solver/rotom/endings.js', [["if (!opts || opts.rated !== true) throw", 'if (false) throw'], ['r && r.rated === true && !r.dry_run', 'r && !r.dry_run']]],
  halt: ['solver/rotom/ladder.js', [["S.halted = 'SELF QUIT: '", "S.halted_not = 'SELF QUIT: '"]]],
  gamesrated: ['solver/rotom/report.js', [["s.result !== 'unfinished' && s.rated)", "s.result !== 'unfinished')"], ['if (!ratedKeys.has(key(r))) continue;', ''], ['!r.result.tie && ratedKeys.has(key(r)))', '!r.result.tie)']]],
};
if (BREAK && !BREAKS[BREAK]) { console.error('unknown --break ' + BREAK + '; one of ' + Object.keys(BREAKS).join(', ')); process.exit(2); }
const edits = rel => (BREAK && BREAKS[BREAK][0] === rel ? BREAKS[BREAK][1] : null);
const E = load('solver/rotom/endings.js', edits('solver/rotom/endings.js'));
const L = load('solver/rotom/ladder.js', edits('solver/rotom/ladder.js'));
const REP = load('solver/rotom/report.js', edits('solver/rotom/report.js'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rotom-endings-'));

/* ---------------- GAME ---------------- */
const ME = 'medicham32', OPP = 'Some Human';
const head = ['|init|battle', '|title|' + ME + ' vs. ' + OPP, '|player|p1|' + ME + '|1|1000', '|player|p2|' + OPP + '|2|1100', '|gametype|doubles', '|rated|', '|teampreview|4'];
const turns = n => { const a = []; for (let t = 1; t <= n; t++) a.push('|', '|t:|1', '|move|p1a: X|Tackle|p2a: Y', '|upkeep', '|turn|' + t); return a; };
const G = {
  normal:        head.concat(['|start'], turns(9), ['|faint|p2a: Y', '|', '|win|' + ME]),
  forfeit_mid:   head.concat(['|start'], turns(2), ['|', '|upkeep', '|-message|' + OPP + ' forfeited.', '|', '|win|' + ME]),
  forfeit_prev:  head.concat(['|-message|' + OPP + ' forfeited.', '|', '|win|' + ME]),
  forfeit_me:    head.concat(['|start'], turns(5), ['|-message|' + ME + ' forfeited.', '|', '|win|' + OPP]),
  timeout_prev:  head.concat(['|inactive|Battle timer is ON: inactive players will automatically lose when time\'s up.', '|-message|' + OPP + ' lost due to inactivity.', '|', '|win|' + ME]),
  timeout_me:    head.concat(['|start'], turns(4), ['|inactive|' + ME + ' has 0 seconds left.', '|-message|' + ME + ' lost due to inactivity.', '|', '|win|' + OPP]),
  inactivity:    head.concat(['|start'], turns(3), ['|-message|All players are inactive.', '|tie']),
  tie:           head.concat(['|start'], turns(20), ['|tie']),
  unknown:       head.concat(['|start'], turns(3)),
  rename:        head.concat(['|start'], turns(1), ['|-message|' + OPP + ' forfeited by changing their name.', '|', '|win|' + ME]),
  series_inact:  head.concat(['|start'], turns(6), ['|-message|' + OPP + ' lost the series due to inactivity.', '|', '|win|' + ME]),
  late_quit:     head.concat(['|start'], turns(7), ['|win|' + ME, '|-message|' + ME + ' forfeited.']),
};
const want = {
  normal: ['normal', 9, false, null], forfeit_mid: ['forfeit_opp', 2, false, OPP], forfeit_prev: ['forfeit_opp', 0, true, OPP], forfeit_me: ['forfeit_me', 5, false, ME],
  timeout_prev: ['timeout_opp', 0, true, OPP], timeout_me: ['timeout_me', 4, false, ME], inactivity: ['inactivity', 3, false, null], tie: ['tie', 20, false, null],
  unknown: ['unknown', 3, false, null], rename: ['forfeit_opp', 1, false, OPP], series_inact: ['timeout_opp', 6, false, OPP], late_quit: ['normal', 7, false, null],
};
for (const [k, [reason, turn, prev, by]] of Object.entries(want)) {
  const g = E.gameEnd(G[k], ME);
  ok('GAME', g.end_reason === reason && g.end_turn === turn && g.at_preview === prev && g.end_by === by,
     k + ' -> ' + reason + ' t' + turn + (prev ? ' at preview' : '') + (by ? ' by ' + by : '') + ': ' + JSON.stringify({ r: g.end_reason, t: g.end_turn, p: g.at_preview, by: g.end_by }));
}
{ const g = E.gameEnd(G.forfeit_mid.join('\r\n'), ME); ok('GAME', g.end_reason === 'forfeit_opp' && g.end_raw === '|-message|' + OPP + ' forfeited.' && g.mine === true, 'one CRLF string in, end_raw is the verbatim deciding line, mine is read from |win|: ' + JSON.stringify(g)); }
ok('GAME', E.GAME_REASONS.every(r => Object.values(want).some(w => w[0] === r)), 'every game end_reason has a constructed sequence: ' + E.GAME_REASONS.join(','));
ok('GAME', ['forfeit_me', 'timeout_me', 'inactivity', 'walkaway_me'].every(r => E.SELF_QUIT.has(r)) && !E.SELF_QUIT.has('forfeit_opp'), 'SELF_QUIT is exactly our own quits');

/* ---------------- SERIES ---------------- */
const g = (gnum, mine, end_reason, end_turn) => ({ gnum, mine, end_reason, end_turn: end_turn == null ? 9 : end_turn, at_preview: end_turn === 0 });
const W = { winner: ME, mine: true }, Lz = { winner: OPP, mine: false };
const cases = [
  ['2-0 normal', [g(1, true, 'normal'), g(2, true, 'normal')], W, { end_reason: 'normal', end_game: 2, games_won: 2, games_lost: 0, walkaway: null, any_forfeit_opp: false }],
  ['2-1 normal loss', [g(1, true, 'normal'), g(2, false, 'normal'), g(3, false, 'normal', 11)], Lz, { end_reason: 'normal', end_game: 3, end_turn: 11, games_won: 1, games_lost: 2 }],
  ['forfeit decider (aa1 k3)', [g(1, true, 'normal', 10), g(2, true, 'forfeit_opp', 2)], W, { end_reason: 'forfeit_opp', end_game: 2, end_turn: 2, at_preview: false, any_forfeit_opp: true }],
  ['series forfeited in g1 (gen5ab k4)', [g(1, true, 'forfeit_opp', 4)], W, { end_reason: 'forfeit_opp', end_game: 1, end_turn: 4, games_won: 1, walkaway: null }],
  ['preview timeout decider (gen5ab k9)', [g(1, false, 'normal', 6), g(2, true, 'timeout_opp', 0)], W, { end_reason: 'timeout_opp', end_game: 2, end_turn: 0, at_preview: true }],
  ['WALKAWAY (gen5ab k8)', [g(1, false, 'normal', 6)], W, { end_reason: 'walkaway_opp', walkaway: 'opp', end_game: 2, end_turn: 0, at_preview: true, games_won: 0, games_lost: 1, any_forfeit_opp: true }],
  ['our own walkaway', [g(1, true, 'normal', 8)], Lz, { end_reason: 'walkaway_me', walkaway: 'me', end_game: 2, at_preview: true }],
  ['gen5ab k33', [g(1, true, 'forfeit_opp', 6), g(2, true, 'normal', 9)], W, { end_reason: 'normal', end_game: 2, any_forfeit_opp: true, walkaway: null }],
  ['walkaway before any game', [], W, { end_reason: 'walkaway_opp', end_game: 1, at_preview: true }],
];
for (const [name, games, res, exp] of cases) {
  const s = E.seriesEnd(games, res, ME);
  const bad = Object.entries(exp).filter(([k, v]) => s[k] !== v);
  ok('SERIES', !bad.length, name + ': ' + (bad.length ? 'wrong ' + JSON.stringify(bad.map(([k, v]) => [k, 'want ' + v, 'got ' + s[k]])) : s.end_reason));
}
{ const s = E.seriesEnd([g(1, true, 'normal', 8)], W, ME, { quitLines: ['||' + OPP + ' forfeited.'] });
  ok('SERIES', s.end_reason === 'walkaway_opp' && s.end_by === OPP && s.end_raw === '||' + OPP + ' forfeited.', 'a series-room forfeit line names who walked: ' + JSON.stringify({ r: s.end_reason, by: s.end_by })); }
{ const s = E.seriesEnd([g(1, true, 'normal', 8)], W, ME, { quitLines: ['||' + OPP + ' forfeited.'], liveGnum: 2, liveTurn: 3 });
  ok('SERIES', s.end_reason === 'forfeit_opp' && s.end_game === 2 && s.end_turn === 3 && !s.walkaway, 'a series forfeit while game 2 is live is a mid-game forfeit, not a walkaway: ' + JSON.stringify({ r: s.end_reason, g: s.end_game, t: s.end_turn })); }

/* ---------------- RECORD ---------------- */
const row = (k, arm, S, rated, end_reason, residual) => ({ k, arm, S, rated, end_reason, residual: residual == null ? S - 0.5 : residual, rating_me: rated ? { before: 1000, after: 1000 + (S ? 20 : -20) } : null });
const rows = [row(1, 'A', 1, true, 'normal'), row(2, 'A', 1, true, 'forfeit_opp'), row(3, 'A', 0, true, 'normal'), row(4, 'B', 1, true, 'walkaway_opp'), row(5, 'B', 0, true, 'normal'),
              row(30, 'A', 1, false, 'timeout_opp', null)];
{ let threw = false; try { E.ladderRecord(rows); } catch (e) { threw = /rated: true/.test(e.message); }
  ok('RECORD', threw, 'ladderRecord without { rated: true } THROWS (rated is a required filter)'); }
{ let threw = false; try { E.ladderRecord(rows, { rated: false }); } catch (e) { threw = true; }
  ok('RECORD', threw, 'ladderRecord({ rated: false }) THROWS too'); }
let R = null; try { R = E.ladderRecord(rows, { rated: true }); } catch (e) { ok('RECORD', false, 'ladderRecord threw: ' + e.message); }
if (R) {
  ok('RECORD', R.all.series === 5 && R.all.record === '3-2' && R.all.mean_S === 0.6, 'the unrated k30 win is NOT in the record or the mean S: ' + JSON.stringify({ n: R.all.series, rec: R.all.record, S: R.all.mean_S }));
  ok('RECORD', R.unrated_excluded.length === 1 && R.unrated_excluded[0].k === 30, 'k30 is listed as unrated, excluded: ' + JSON.stringify(R.unrated_excluded));
  ok('RECORD', R.without_quit_wins.record === '1-2' && R.quit_wins === 2 && R.quit_wins_by.forfeit_opp === 1 && R.quit_wins_by.walkaway_opp === 1, 'without quit wins 1-2 (2 quit wins dropped): ' + JSON.stringify({ wo: R.without_quit_wins.record, q: R.quit_wins_by }));
  ok('RECORD', R.by_arm.A.all.record === '2-1' && R.by_arm.A.without_quit_wins.record === '1-1' && R.by_arm.B.all.record === '1-1', 'per arm: ' + JSON.stringify(Object.fromEntries(Object.entries(R.by_arm).map(([a, b]) => [a, b.all.record + '/' + b.without_quit_wins.record]))));
  ok('RECORD', R.self_quits === 0 && E.ladderRecord(rows.concat([row(6, 'A', 0, true, 'forfeit_me')]), { rated: true }).self_quits === 1, 'a rated forfeit_me row counts as a self quit');
  ok('RECORD', Math.abs(R.all.residual.mean - 0.1) < 1e-9 && R.all.residual.n === 5, 'the residual mean is over the 5 rated rows: ' + JSON.stringify(R.all.residual));
}

/* ---------------- HALT (the real ladder controller) ---------------- */
function mkController(dir, extra) {
  const sent = [], events = [], exits = [];
  let t = 1e9, logged = false, sets = 0, open = 0;
  const rotation = { file: 'x', sha256: 'y', teams: [1, 2, 3].map(i => ({ id: 'L' + i, packed: 'PACK' + i, archetype: { label: 'arch' + i }, from_game: 'g' + i, rating: 1500 })) };
  const C = L.create(Object.assign({
    name: ME, format: 'gen9championsvgc2026regmcbo3', formatPrefix: 'gen9championsvgc2026regmc', server: 'ws://localhost:1/', outDir: dir,
    statePath: path.join(dir, 'ladder-state.json'), arms: { file: 'arms.json', sha256: 'z', arms: { A: { policy: 'miltank' }, B: { policy: 'prior' } } }, rotation,
    seed: 'endings-seed', sets: 10, stopFiles: [path.join(dir, 'STOP')], maxErrors: 5, guardUsers: ['willhoop'], guardMode: 'online', release: { engine_release: 'eaa5becc54eb' },
    send: s => sent.push(s), say: () => {}, event: (ty, o) => events.push({ ty, o }), loggedIn: () => logged, setsDone: () => sets, openSeries: () => open,
    counters: () => ({ fallbacks: {}, invalid: 0, timeouts: 0, decisions: 0, crashes: 0 }), bookGet: () => null, bookSet: () => {}, exit: (code, why) => exits.push({ code, why }), now: () => t,
  }, extra || {}));
  return { C, sent, events, exits, set: (o) => { if ('logged' in o) logged = o.logged; if ('sets' in o) sets = o.sets; if ('open' in o) open = o.open; if ('t' in o) t = o.t; }, get t() { return t; } };
}
const clear = H => { H.set({ t: H.t + L.GUARD_TTL_MS + 1 }); H.C.tick('go'); H.C.onQuery('userdetails', JSON.stringify({ userid: 'willhoop', rooms: false })); };
const ratings = (H, bo) => { H.C.onPlayer(bo, 'p1', ME); H.C.onPlayer(bo, 'p2', OPP); H.C.onRaw(bo, "|raw|" + ME + "'s rating: 1000 &rarr; <strong>1020</strong>"); H.C.onRaw(bo, "|raw|" + OPP + "'s rating: 1100 &rarr; <strong>1080</strong>"); };
const rowsOf = H => { try { return fs.readFileSync(H.C.seriesFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
{ /* an opponent forfeit and an opponent walkaway: rows carry the end, no halt */
  const dir = fs.mkdtempSync(path.join(TMP, 'h1-'));
  const ends = {
    'game-bestof3-x-1': E.seriesEnd([g(1, true, 'normal', 10), g(2, true, 'forfeit_opp', 2)], W, ME),
    'game-bestof3-x-2': E.seriesEnd([g(1, false, 'normal', 6)], W, ME),
  };
  const H = mkController(dir, { seriesEnd: bo => Object.assign({ games_end: [] }, ends[bo]) });
  H.set({ logged: true }); H.C.tick('login'); clear(H);
  for (const [i, bo] of Object.keys(ends).entries()) {
    H.set({ open: 1 }); H.C.onSeriesStart(bo); ratings(H, bo); H.set({ open: 0, sets: i + 1 }); H.C.onSeriesEnd(bo, W);
    clear(H);
  }
  const R2 = rowsOf(H);
  ok('HALT', R2.length === 2 && R2[0].end_reason === 'forfeit_opp' && R2[0].end_game === 2 && R2[0].end_turn === 2 && R2[0].games_won === 2 && Array.isArray(R2[0].games_end),
     'the row carries end_reason, end_game, end_turn, games_won and games_end: ' + JSON.stringify(R2.map(r => ({ k: r.k, e: r.end_reason, g: r.end_game, t: r.end_turn }))));
  ok('HALT', R2[1] && R2[1].end_reason === 'walkaway_opp' && R2[1].walkaway === 'opp' && R2[1].at_preview === true, 'the walkaway row: ' + JSON.stringify(R2[1] && { e: R2[1].end_reason, w: R2[1].walkaway }));
  ok('HALT', !H.C.state().halted && !H.events.some(e => e.ty === 'ladder_halt') && !H.C.state().self_quits, 'an opponent forfeit and an opponent walkaway do NOT halt');
  ok('HALT', H.sent.filter(s => /^\|\/search /.test(s)).length === 3, 'the ladder searched on after both: ' + H.sent.filter(s => /\/search/.test(s)).length + ' searches');
}
{ /* OUR game-level forfeit mid-series: halt at once; the same quit seen again at the series counts once */
  const dir = fs.mkdtempSync(path.join(TMP, 'h2-'));
  const bo = 'game-bestof3-x-9';
  const H = mkController(dir, { seriesEnd: () => E.seriesEnd([g(1, false, 'forfeit_me', 5)], Lz, ME) });
  H.set({ logged: true }); H.C.tick('login'); clear(H);
  H.C.onUpdateSearch({ searching: ['gen9championsvgc2026regmcbo3'], games: null });
  H.set({ open: 1 }); H.C.onSeriesStart(bo);
  H.C.onSelfQuit(bo, { level: 'game', room: 'battle-x-9', bestof: bo, end_reason: 'forfeit_me', end_raw: '|-message|' + ME + ' forfeited.' });
  const S0 = H.C.state();
  ok('HALT', !!S0.halted && /SELF QUIT: forfeit_me/.test(S0.halted), 'our forfeit HALTS the ladder: ' + S0.halted);
  ok('HALT', H.events.some(e => e.ty === 'ladder_halt') && H.events.some(e => e.ty === 'ladder_error' && e.o.kind === 'self_quit'), 'a ladder_halt and a self_quit ladder error are logged');
  ok('HALT', H.exits.length === 0, 'the open series is played out, not abandoned (no exit while it is open)');
  ratings(H, bo); H.set({ open: 0, sets: 1 }); H.C.onSeriesEnd(bo, Lz);
  H.set({ t: H.t + 1000 }); H.C.tick('after');
  ok('HALT', H.exits.length === 1 && H.exits[0].code === 4, 'once idle the halted ladder exits 4 (FINAL for the supervisor): ' + JSON.stringify(H.exits));
  ok('HALT', H.C.state().self_quits === 1, 'the same quit, seen at the game and again on the row, is counted ONCE: ' + H.C.state().self_quits);
  ok('HALT', rowsOf(H)[0] && rowsOf(H)[0].end_reason === 'forfeit_me', 'the row says forfeit_me');
}
{ /* OUR walkaway, known only when the series row is written */
  const dir = fs.mkdtempSync(path.join(TMP, 'h3-'));
  const bo = 'game-bestof3-x-10';
  const H = mkController(dir, { seriesEnd: () => E.seriesEnd([g(1, true, 'normal', 8)], Lz, ME) });
  H.set({ logged: true }); H.C.tick('login'); clear(H);
  H.set({ open: 1 }); H.C.onSeriesStart(bo); ratings(H, bo); H.set({ open: 0, sets: 1 }); H.C.onSeriesEnd(bo, Lz);
  ok('HALT', /SELF QUIT: walkaway_me/.test(H.C.state().halted || ''), 'a row that ended walkaway_me HALTS: ' + H.C.state().halted);
  H.set({ t: H.t + L.GUARD_TTL_MS + 1 }); H.C.tick('after');
  ok('HALT', H.exits.length === 1 && H.exits[0].code === 4 && H.sent.filter(s => /^\|\/search /.test(s)).length === 1, 'and no new search goes out: ' + JSON.stringify({ exits: H.exits, searches: H.sent.filter(s => /\/search/.test(s)).length }));
}

/* ---------------- GAMES (report.js gamesReport) ---------------- */
{
  const logF = path.join(TMP, 'k22g2.log');
  fs.writeFileSync(logF, G.forfeit_mid.join('\n') + '\n');
  const gr = (series, game, mine, rated, extra) => JSON.stringify(Object.assign({ client: ME, series, game, room: 'battle-' + series + '-' + game, our_team: 'T1', opponent: 'o-' + series,
    result: { mine, tie: false, turns: 9 }, rating_after: rated ? { p1: { before: 1000, after: 1010 }, p2: { before: 1000, after: 990 } } : null, replay: { status: 'saved', url: 'u' } }, extra || {}));
  const f = path.join(TMP, 'games.jsonl');
  fs.writeFileSync(f, [
    gr('s1', 1, true, false), gr('s1', 2, true, true, { end_reason: 'normal' }),                       // 2-0, rated, normal
    gr('s2', 1, false, false, { end_reason: 'normal' }), gr('s2', 2, false, true, { end_reason: 'normal' }),   // 0-2, rated
    gr('s3', 1, true, true, { battle_log: logF }),                                                      // 1-0, rated, ended by the opponent's forfeit (derived from the log)
    gr('k30', 1, true, false, { end_reason: 'timeout_opp' }),                                          // 1-0 UNRATED (gen5ab k30)
  ].join('\n') + '\n');
  const Rg = REP.gamesReport(f);
  ok('GAMES', Rg.series.decided === 3 && Rg.series.won === 2, 'the unrated k30 win is not in the series record (3 rated series, 2 won): ' + JSON.stringify({ d: Rg.series.decided, w: Rg.series.won }));
  ok('GAMES', Rg.series_unrated.length === 1 && Rg.series_unrated[0].series === 'k30', 'k30 is listed as unrated: ' + JSON.stringify(Rg.series_unrated));
  ok('GAMES', Rg.games.n === 5 && Rg.games.won === 3, 'games are counted over rated series only (5 games, 3 won): ' + JSON.stringify({ n: Rg.games.n, w: Rg.games.won }));
  ok('GAMES', Rg.teams.T1 && Rg.teams.T1.games === 5 && Rg.teams.T1.series === 3, 'per-team counts exclude the unrated series: ' + JSON.stringify(Rg.teams.T1));
  const s3 = Rg.record_by_series.find(s => s.series === 's3');
  ok('GAMES', s3 && s3.result === 'W' && s3.end_reason === 'forfeit_opp', 'a 1-0 series ended by the opponent forfeit (read from its battle log) is a W: ' + JSON.stringify(s3 && { r: s3.result, e: s3.end_reason }));
  ok('GAMES', Rg.series.quit_wins === 1 && Rg.series.without_quit_wins.won === 1 && Rg.series.without_quit_wins.n === 2, 'without quit wins: 1 of 2: ' + JSON.stringify(Rg.series.without_quit_wins));
  ok('GAMES', Rg.end_reasons.forfeit_opp === 1 && Rg.end_reasons.timeout_opp === 1 && Rg.self_quits.length === 0, 'end reasons counted, no self quits: ' + JSON.stringify(Rg.end_reasons));
}

/* ---------------- BREAKS: each deliberate break of the code goes RED ---------------- */
if (!BREAK) {
  for (const b of Object.keys(BREAKS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--break', b], { encoding: 'utf8', timeout: 120000 });
    const red = r.status === 1 && /RED/.test(r.stdout);
    ok('BREAKS', red, '--break ' + b + ' -> ' + (red ? 'RED (' + (r.stdout.match(/FAIL/g) || []).length + ' FAIL)' : 'NOT RED: exit ' + r.status + ' ' + (r.stdout + r.stderr).slice(-300)));
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log((fails ? 'RED' : 'GREEN') + ' test-rotom-endings' + (BREAK ? ' --break ' + BREAK : '') + ': ' + (checks - fails) + '/' + checks);
process.exit(fails ? 1 : 0);
