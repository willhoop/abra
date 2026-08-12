/* test-coverage-stop.js — THE GATE ON THE STOPPING RULE OF THE WHOLE-GAME DIFFERENTIAL.
 *
 *   SHOWDOWN_PATH=... node tests/test-coverage-stop.js
 *
 * WHY IT EXISTS. Will asked how the game count of the differential was chosen. The honest answer was
 * that it was picked arbitrarily — 45, then 90, then 1200, then 983 — while the rate runner next door
 * derives its trial count from statistical power. His instruction: *"run until each mechanic has been
 * exercised."*
 *
 * So the run is a batched loop that stops on COVERAGE: keep playing while new census rows are still
 * being credited, stop after K consecutive batches credit nothing new.
 *
 * WHAT IS RED HERE IS NEVER "COVERAGE IS INCOMPLETE". That is a finding and the run prints it BY NAME.
 * This file goes red when the STOPPING RULE is wrong, which it can be in exactly the ways that would
 * make a truncated sweep read as a complete one:
 *
 *   PART 1  the decision function — stall, budget, exhausted pool, and the case that must NOT stop.
 *   PART 2  A BUDGET STOP MUST BE LOUD. A run that ran out of games and reports "coverage reached" is
 *           the failure this whole sprint has been correcting; `stopped_on_budget` must be true and
 *           the printed line must say so.
 *   PART 3  the run really is batched and really does credit new rows across batches, end to end.
 *   PART 4  `clicked_but_always_missed` does not mean what its name says, and the honest list is
 *           published beside it. A move that missed under one pin and CONNECTED under the other is in
 *           that map, so reading it as "never exercised" over-counts the gap.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

const G = require(D('engine', 'game_differential.js'));

/* ================= PART 1 — THE DECISION, EVERY BRANCH ========================================== */
console.log('\nPART 1 — the stopping decision on fabricated batch histories');
{
  const S = G.coverageStop;
  if (typeof S !== 'function') fail('the driver exports no coverageStop — the rule does not exist');
  else {
    const cases = [
      ['rows still arriving: DO NOT STOP',
       { quietBatches: 0, stallK: 3, games: 400, maxGames: 4000, poolLeft: 900 }, false, null],
      ['one quiet batch of three: DO NOT STOP',
       { quietBatches: 1, stallK: 3, games: 400, maxGames: 4000, poolLeft: 900 }, false, null],
      ['K consecutive quiet batches: STOP, on coverage',
       { quietBatches: 3, stallK: 3, games: 400, maxGames: 4000, poolLeft: 900 }, true, 'coverage-stalled'],
      ['the game budget is spent: STOP, and it is NOT a coverage answer',
       { quietBatches: 0, stallK: 3, games: 4000, maxGames: 4000, poolLeft: 900 }, true, 'game-budget'],
      ['the team pool ran out: STOP, and it is NOT a coverage answer either',
       { quietBatches: 0, stallK: 3, games: 400, maxGames: 4000, poolLeft: 0 }, true, 'team-pool-exhausted'],
    ];
    for (const [what, arg, wantStop, wantReason] of cases) {
      const r = S(arg);
      if (!!r.stop !== wantStop) fail(what + ' — stop was ' + r.stop);
      else if (wantReason && r.reason !== wantReason) fail(what + ' — reason was "' + r.reason + '"');
      else pass(what + (r.reason ? '  -> ' + r.reason : ''));
    }
    /* THE ONE THAT MATTERS MOST. A budget stop and a pool stop are TRUNCATIONS; a stall is an answer.
     * Anything that reports the first two as the third turns an incomplete sweep into a claim. */
    const budget = S({ quietBatches: 0, stallK: 3, games: 4000, maxGames: 4000, poolLeft: 9 });
    const stall = S({ quietBatches: 5, stallK: 3, games: 40, maxGames: 4000, poolLeft: 9 });
    const dry = S({ quietBatches: 0, stallK: 3, games: 40, maxGames: 4000, poolLeft: 0 });
    if (!budget.on_budget) fail('a run that spent its game budget did not set on_budget');
    else pass('a budget stop is flagged on_budget');
    if (!dry.on_budget) fail('a run that exhausted the team pool did not set on_budget — a truncated '
      + 'sweep would read as a completed one');
    else pass('a pool-exhausted stop is flagged on_budget too');
    if (stall.on_budget) fail('a genuine coverage stall was flagged as a budget stop');
    else pass('a coverage stall is not flagged on_budget');
    /* THE BUDGET WINS OVER THE STALL WHEN BOTH ARE TRUE. Reporting "coverage-stalled" for a run that
     * also ran out of games would be the flattering half of an ambiguous answer. */
    const both = S({ quietBatches: 9, stallK: 3, games: 4000, maxGames: 4000, poolLeft: 0 });
    if (!both.on_budget) fail('a run that stalled AND ran out reported only the flattering half');
    else pass('when a stall and a truncation coincide the truncation is reported');
  }
}

/* ================= PART 2 + 3 — END TO END, ON A DELIBERATELY TINY BUDGET ======================= */
console.log('\nPART 2/3 — a real batched run whose budget is too small, which must say so LOUDLY');
{
  const out = path.join(require('os').tmpdir(), 'abra-covstop-' + process.pid + '.json');
  const args = ['engine/game_differential.js', '--until-covered', '--batch', '3', '--stall', '2',
                '--max-games', '6', '--turns', '4', '--team-store', 'data/team-pool-frozen',
                '--arm', 'top-tie-first', '--write', '--out', out];
  const r = require('child_process').spawnSync(process.execPath, args,
    { cwd: D('.'), encoding: 'utf8', env: process.env, maxBuffer: 1 << 26 });
  const txt = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0) { fail('the run exited ' + r.status); note(txt.slice(-1500)); }
  let art = null;
  try { art = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { fail('no artifact: ' + e.message); }
  if (art) {
    const cs = art.coverage_stop;
    if (!cs) fail('the artifact carries no coverage_stop block — the rule left no receipt');
    else {
      note('stopped because: ' + cs.stopped_because + '   games ' + cs.games_played
           + '   batches ' + (cs.batches || []).length);
      if (!(cs.batches || []).length) fail('no per-batch history was recorded');
      else pass((cs.batches || []).length + ' batches recorded, each with what it newly credited');
      if (!cs.stopped_on_budget) fail('THE RUN STOPPED ON A BUDGET AND DID NOT SAY SO — this is exactly '
        + 'the truncated-sweep-reads-as-complete failure');
      else pass('the budget stop is flagged in the artifact');
      if (!/BUDGET|DID NOT STOP ON COVERAGE|NOT A COVERAGE ANSWER/i.test(txt))
        fail('the printed report did not shout about the budget stop');
      else pass('the printed report shouts about it');
      if (!Array.isArray(cs.rows_never_credited)) fail('the rows still not exercised are not listed BY NAME');
      else pass(cs.rows_never_credited.length + ' un-exercised rows listed by name');
    }
    /* PART 4 */
    console.log('\nPART 4 — the misses list means what it says');
    const cov = art.coverage || {};
    if (!Array.isArray(cov.clicked_and_missed_at_least_once))
      fail('`clicked_and_missed_at_least_once` is not published — the old field name over-claims');
    else if (!Array.isArray(cov.clicked_but_never_connected))
      fail('`clicked_but_never_connected` is not published, so nobody can tell which moves are really unexercised');
    else {
      const miss = new Set(cov.clicked_and_missed_at_least_once);
      const never = cov.clicked_but_never_connected;
      const bad = never.filter(m => !miss.has(m));
      if (bad.length) fail('never-connected contains moves that were never even clicked-and-missed: ' + bad.join(', '));
      else pass('never-connected is a subset of clicked-and-missed (' + never.length + ' of ' + miss.size + ')');
    }
  }
  try { fs.unlinkSync(out); } catch (e) { /* the artifact is scratch; leaving it is harmless */ }
}

console.log('\n' + (failures ? failures + ' FAILURE(S) — the stopping rule cannot be trusted to say '
                             + 'whether a sweep finished' : 'ALL GREEN — the run stops on coverage and '
                             + 'says so when it does not'));
process.exit(failures ? 1 : 0);
