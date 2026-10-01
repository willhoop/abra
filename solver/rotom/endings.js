/* solver/rotom/endings.js — HOW a game and a series ended, read from the protocol lines, and the ladder record with and
 * without the wins the opponent handed us. Pure functions; rotom.js calls them live, report.js and the backfill call them
 * on the logs a run left behind. Spec: docs/_reports/2026-09-26-click-outcomes.md §6; account:
 * docs/_reports/2026-09-26-rotom-end-reasons.md.
 *
 * THE LINES (pokemon-showdown-mc, read 2026-09-26):
 *   server/room-battle.ts forfeitPlayer        `|-message|<name> forfeited.`                (the default message)
 *                                              `|-message|<name> forfeited by changing their name.` / `… lost by having an
 *                                              inappropriate name.` (a rename: also a forfeit)
 *   server/room-battle.ts checkTimeout         `|-message|<name> lost due to inactivity.`   (the battle timer ran out)
 *                                              `|-message|All players are inactive.` then a tie (every side ran out)
 *   server/room-battle-bestof.ts forfeitPlayer `||<name> forfeited.` / `||<name> lost the series due to inactivity.` in the
 *                                              SERIES room, and the same message forwarded into a live game as `|-message|`
 *
 * GAME end_reason:   normal · forfeit_opp · forfeit_me · timeout_opp · timeout_me · inactivity (every side timed out: a
 *                    tie) · tie · unknown (no |win| or |tie| in the lines). `timeout_*` is the battle timer, the ONE server
 *                    mechanism the spec called inactivity_*; ROTOM's own late decisions are a separate counter
 *                    (during_series.timeouts).
 * SERIES end_reason: the deciding game's reason, or walkaway_opp / walkaway_me — the series ended with the winner short of
 *                    the games it needs and the last game finished normally (or no game was ever played): somebody left
 *                    BETWEEN games (gen5ab k8), which no game log can show.
 * SELF_QUIT (forfeit_me, timeout_me, inactivity, walkaway_me) must be ZERO: rotom.js counts one as an error and the ladder
 * HALTS on it (ladder.js onSelfQuit).
 *
 * EARNED FORFEITS (Will, 2026-10-01: "lets count forfeits where we are up in pokemon counts as real wins"; abra/regmc 1.70.0;
 * account docs/_reports/2026-10-01-earned-forfeits.md). Per GAME, an opponent quit (forfeit_opp or timeout_opp — the battle
 * timer is the same hand-over as the button) is EARNED when, at the quit line, turn >= 1 and our Pokemon still able to battle
 * outnumber theirs: left = |teamsize| (the brought four, bench included, sent after preview) minus that side's |faint| lines
 * so far. Level or behind is UNEARNED. A quit at team preview or turn 0 is UNEARNED (no lead exists). A game without a
 * |teamsize| for both sides cannot be counted and is UNEARNED (`earned_why: 'no_count'`), never guessed.
 * Per SERIES (only a series we WON is classed): `clean` (no opponent quit in any game), `earned` (every opponent-quit game
 * earned), `unearned` (any opponent-quit game unearned, or the series ended walkaway_opp — a walkaway happens between games,
 * at the next game's preview, so there is no board to be ahead on). A series that ends by forfeit in game 3 is decided by
 * game 3's own count; games 1 and 2 must also pass if either was an opponent quit. A lost series is never reclassified.
 */
'use strict';

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const GAME_REASONS = ['normal', 'forfeit_opp', 'forfeit_me', 'timeout_opp', 'timeout_me', 'inactivity', 'tie', 'unknown'];
const SERIES_REASONS = GAME_REASONS.concat(['walkaway_opp', 'walkaway_me']);
const SELF_QUIT = new Set(['forfeit_me', 'timeout_me', 'inactivity', 'walkaway_me']);
const OPP_QUIT = new Set(['forfeit_opp', 'timeout_opp', 'walkaway_opp']);

/* one protocol line -> { kind: 'forfeit'|'timeout'|'allinactive', by } or null. Accepts a game `|-message|` line and a
 * series-room `||` line; `lost the series due to inactivity` is the series' disconnect timer, a timeout. */
function quitLine(line) {
  const s = String(line || '');
  let m = /^\|(?:-message)?\|(.+?) (forfeited(?: by changing their name)?|lost by having an inappropriate name|lost due to inactivity|lost the series due to inactivity)\.\s*$/.exec(s);
  if (m) return { kind: /inactivity/.test(m[2]) ? 'timeout' : 'forfeit', by: m[1], raw: s };
  if (/^\|-message\|All players are inactive\.\s*$/.test(s)) return { kind: 'allinactive', by: null, raw: s };
  return null;
}
const side = (by, me) => (toID(by) === toID(me) ? 'me' : 'opp');

/* a game's protocol lines (array or one string) and our name -> the per-game end fields */
function gameEnd(lines, me) {
  const L = Array.isArray(lines) ? lines : String(lines || '').split('\n');
  let turn = 0, quit = null, win = null, tie = false, atQuit = null;
  const C = boardCounter(me);
  for (const raw of L) {
    const l = String(raw).replace(/\r$/, '');
    C.line(l);
    if (l.startsWith('|turn|')) { const n = +l.slice(6); if (Number.isFinite(n)) turn = n; continue; }
    if (l.startsWith('|win|')) { win = { name: l.slice(5), raw: l }; continue; }
    if (l === '|tie' || l.startsWith('|tie|')) { tie = true; continue; }
    const q = quitLine(l); if (q && !win && !tie) { quit = q; atQuit = C.snap(turn); }   // the quit that decided THIS game, never one after its end
  }
  let end_reason, end_by = null, end_raw = null;
  if (quit && quit.kind === 'allinactive') { end_reason = 'inactivity'; end_raw = quit.raw; }
  else if (quit && (win || tie)) { end_reason = quit.kind + '_' + side(quit.by, me); end_by = quit.by; end_raw = quit.raw; }
  else if (win) { end_reason = 'normal'; end_raw = win.raw; }
  else if (tie) { end_reason = 'tie'; end_raw = '|tie'; }
  else { end_reason = 'unknown'; }
  const out = { end_reason, end_by, end_turn: turn, at_preview: turn === 0, end_raw,
           winner_name: win ? win.name : null, mine: win ? toID(win.name) === toID(me) : null, tie: !win && (tie || end_reason === 'inactivity') };
  return Object.assign(out, earnedFields(end_reason, atQuit));
}

/* THE BOARD COUNT at any line: which side is ours (|player|), how many each side brought (the LAST |teamsize|, sent once the
 * preview picks are in) and how many have fainted (|faint|<side><slot>: …). left = brought - fainted. */
function boardCounter(me) {
  const brought = {}, fainted = { p1: 0, p2: 0 };
  let mine = null;
  return {
    line(l) {
      let m;
      if ((m = /^\|player\|(p[12])\|([^|]+)/.exec(l))) { if (toID(m[2]) === toID(me)) mine = m[1]; }
      else if ((m = /^\|teamsize\|(p[12])\|(\d+)/.exec(l))) brought[m[1]] = +m[2];
      else if ((m = /^\|faint\|(p[12])[a-z]?:/.exec(l))) fainted[m[1]]++;
    },
    snap(turn) {
      const opp = mine === 'p1' ? 'p2' : mine === 'p2' ? 'p1' : null;
      const has = !!mine && brought[mine] != null && brought[opp] != null;
      return { turn, side: mine, brought_me: has ? brought[mine] : null, brought_opp: has ? brought[opp] : null,
               left_me: has ? brought[mine] - fainted[mine] : null, left_opp: has ? brought[opp] - fainted[opp] : null };
    },
  };
}

/* a game's end_reason and the board count at its quit line -> { earned, earned_why, quit_turn, left_me, left_opp }.
 * earned is null for a game that was not an opponent quit. */
function earnedFields(end_reason, at) {
  const f = { quit_turn: at ? at.turn : null, left_me: at ? at.left_me : null, left_opp: at ? at.left_opp : null };
  if (!OPP_QUIT.has(end_reason) || end_reason === 'walkaway_opp') return Object.assign(f, { earned: null, earned_why: null });
  if (!at || at.turn < 1) return Object.assign(f, { earned: false, earned_why: 'preview' });
  if (at.left_me == null || at.left_opp == null) return Object.assign(f, { earned: false, earned_why: 'no_count' });
  const d = at.left_me - at.left_opp;
  return Object.assign(f, { earned: d > 0, earned_why: d > 0 ? 'ahead' : d === 0 ? 'level' : 'behind' });
}

/* THE SERIES CLASS of a series WE WON: 'clean' | 'earned' | 'unearned'; null for a series we did not win. `games` are the
 * series' games with end_reason and earned (games_end); `end_reason` the series' own. A won opponent-quit game whose earned
 * is missing (a record written before the field, not re-derived) is 'unearned' — never guessed earned. */
function seriesWinClass(won, end_reason, games) {
  if (!won) return null;
  if (end_reason === 'walkaway_opp') return 'unearned';
  const Q = (games || []).filter(g => g && OPP_QUIT.has(g.end_reason));
  if (!Q.length) return OPP_QUIT.has(end_reason) ? 'unearned' : 'clean';   // a quit no game record carries has no count to read
  return Q.every(g => g.earned === true) ? 'earned' : 'unearned';
}

/* a series: its games (each { gnum, mine: true|false|null, end_reason, end_turn }, as gameEnd wrote them), the series
 * result ({ winner, mine } — winner null for a tie) and our name. opts.quitLines: the series room's `||… forfeited.` /
 * `lost the series due to inactivity` lines; opts.liveGnum: a game we joined whose end we have not recorded (a series
 * forfeit that landed mid-game). */
function seriesEnd(games, result, me, opts) {
  opts = opts || {};
  const G = (games || []).filter(g => g && g.gnum != null).slice().sort((a, b) => a.gnum - b.gnum);
  const won = G.filter(g => g.mine === true).length, lost = G.filter(g => g.mine === false).length;
  const ties = G.filter(g => g.mine == null && g.end_reason && g.end_reason !== 'unknown').length;
  const need = Math.floor((3 - ties) / 2) + 1;   // room-battle-bestof.ts winThreshold for a best-of-3
  const res = result || {};
  const mine = res.winner == null ? null : (res.mine != null ? !!res.mine : toID(res.winner) === toID(me));
  const last = G[G.length - 1] || null;
  const q = (opts.quitLines || []).map(quitLine).filter(Boolean).pop() || null;
  const out = { end_reason: 'unknown', end_game: last ? last.gnum : 0, end_turn: last ? last.end_turn || 0 : 0, at_preview: last ? !!last.at_preview : true,
                games_won: won, games_lost: lost, games_tied: ties, walkaway: null, end_by: null, end_raw: null,
                any_forfeit_opp: G.some(g => g.end_reason === 'forfeit_opp' || g.end_reason === 'timeout_opp') };
  if (mine == null) { out.end_reason = res.winner === null && Object.keys(res).length ? 'tie' : 'unknown'; return out; }
  const winnerWins = mine ? won : lost;
  const lastQuit = last && last.end_reason !== 'normal' && last.end_reason !== 'tie' && last.end_reason !== 'unknown';
  if (opts.liveGnum && (!last || opts.liveGnum > last.gnum) && q) {
    /* the series was forfeited while a game we joined was still being played: that game is the decider, mid-game */
    Object.assign(out, { end_reason: q.kind === 'allinactive' ? 'inactivity' : q.kind + '_' + side(q.by, me), end_game: opts.liveGnum,
                         end_turn: opts.liveTurn || 0, at_preview: !opts.liveTurn, end_by: q.by, end_raw: q.raw });
    /* the live game is the decider and has no end of its own: its board count is read from its lines as they stand */
    let at = null;
    if (opts.liveLines) { const C = boardCounter(me); for (const l of opts.liveLines) C.line(String(l).replace(/\r$/, '')); at = C.snap(opts.liveTurn || 0); }
    out.live_decider = Object.assign({ gnum: opts.liveGnum, end_reason: out.end_reason }, earnedFields(out.end_reason, at));
  } else if (winnerWins >= need || lastQuit) {
    /* the deciding game is the last one: its end is the series' end (a forfeit that ended the series early included) */
    Object.assign(out, { end_reason: last.end_reason, end_by: last.end_by || null, end_raw: last.end_raw || null });
  } else {
    /* the winner is short of the games it needs and the last game finished normally: the loser left between games */
    const who = mine ? 'opp' : 'me';
    Object.assign(out, { end_reason: 'walkaway_' + who, walkaway: who, end_game: last ? last.gnum + 1 : 1, end_turn: 0, at_preview: true,
                         end_by: q ? q.by : null, end_raw: q ? q.raw : null });
  }
  if (OPP_QUIT.has(out.end_reason)) out.any_forfeit_opp = true;
  const decided = G.concat(out.live_decider ? [out.live_decider] : []);
  out.win_class = seriesWinClass(mine === true, out.end_reason, decided);
  out.quit_games = decided.filter(g => OPP_QUIT.has(g.end_reason)).map(g => ({ gnum: g.gnum, end_reason: g.end_reason, earned: g.earned != null ? g.earned : null,
    earned_why: g.earned_why || null, quit_turn: g.quit_turn != null ? g.quit_turn : null, left_me: g.left_me != null ? g.left_me : null, left_opp: g.left_opp != null ? g.left_opp : null }));
  return out;
}

/* THE LADDER RECORD. `rated` is REQUIRED and must be true: an unrated series (gen5ab k30: rated false, S 1) never enters a
 * record or a mean. Rows without end fields are counted as `end_unknown` and kept in `all`, never guessed into `normal`. */
function ladderRecord(rows, opts) {
  if (!opts || opts.rated !== true) throw new Error('ladderRecord: { rated: true } is required — an unrated series is never part of a record or a mean');
  const R = (rows || []).filter(r => r && r.rated === true && !r.dry_run === !opts.dryRun);
  const unrated = (rows || []).filter(r => r && r.rated !== true).map(r => ({ k: r.k, arm: r.arm, opponent: r.opponent, S: r.S, end_reason: r.end_reason || null }));
  const one = rs => {
    const w = rs.filter(r => r.S === 1).length, l = rs.filter(r => r.S === 0).length, t = rs.filter(r => r.S === 0.5).length;
    const res = rs.map(r => r.residual).filter(v => typeof v === 'number');
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };
    const S = rs.map(r => r.S).filter(v => typeof v === 'number');
    const after = rs.map(r => r.rating_me && r.rating_me.after).filter(v => typeof v === 'number');
    const r4 = x => x == null ? null : +x.toFixed(4);
    return { series: rs.length, won: w, lost: l, tied: t, record: w + '-' + l + (t ? '-' + t : ''), mean_S: r4(mean(S)),
             residual: { n: res.length, mean: r4(mean(res)), sd: r4(sd(res)) }, rating_after: { n: after.length, mean: after.length ? Math.round(mean(after)) : null, sd: after.length > 1 ? Math.round(sd(after)) : null } };
  };
  const quitWin = r => r.S === 1 && OPP_QUIT.has(r.end_reason);
  /* the class of a won series: the row's own win_class, else derived from its games_end (earned fields), else unearned if
   * any opponent quit touched it (never guessed earned); `win_class_missing` counts the won rows read that way */
  const cls = r => r.S !== 1 ? null : (r.win_class || seriesWinClass(true, r.end_reason, r.games_end || []));
  const anyQuit = r => r.S === 1 && cls(r) !== 'clean';
  const unearned = r => r.S === 1 && cls(r) === 'unearned';
  const block = rs => ({ all: one(rs),
                         earned_counted: one(rs.filter(r => !unearned(r))),
                         any_forfeit_excluded: one(rs.filter(r => !anyQuit(r))),
                         win_class: rs.filter(r => r.S === 1).reduce((m, r) => (m[cls(r)] = (m[cls(r)] || 0) + 1, m), {}),
                         win_class_missing: rs.filter(r => r.S === 1 && !r.win_class).length,
                         without_quit_wins: one(rs.filter(r => !quitWin(r))), quit_wins: rs.filter(quitWin).length,
                         quit_wins_by: rs.filter(quitWin).reduce((m, r) => (m[r.end_reason] = (m[r.end_reason] || 0) + 1, m), {}),
                         self_quits: rs.filter(r => SELF_QUIT.has(r.end_reason)).length, end_unknown: rs.filter(r => !r.end_reason).length });
  const by_arm = {};
  for (const a of [...new Set(R.map(r => r.arm))].sort()) by_arm[a] = block(R.filter(r => r.arm === a));
  return { filter: { rated: true, dry_run: !!opts.dryRun }, rule: 'rated === true only. HEADLINE "earned_counted" drops a won series classed unearned (an opponent forfeit/timeout game at preview or turn 0, or level or behind on Pokemon left, or a walkaway) and keeps clean and earned wins. "any_forfeit_excluded" drops every won series an opponent quit touched. "without_quit_wins" (legacy, before 1.70.0) drops a won series whose DECIDING end was an opponent quit. A dropped series is never scored as a loss.',
           ...block(R), by_arm, unrated_excluded: unrated };
}

module.exports = { quitLine, gameEnd, seriesEnd, ladderRecord, boardCounter, earnedFields, seriesWinClass, GAME_REASONS, SERIES_REASONS, SELF_QUIT, OPP_QUIT, toID };
