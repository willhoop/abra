/* test-quality.js — the JS and Python quality filters must select the SAME games.
 *
 * Two readers of one config is still two implementations, and the architecture review's finding was
 * that duplication which cannot be removed must at least be OBSERVABLE. This is that check: it runs
 * both readers over the real store and asserts the selected id sets are identical. If someone edits
 * a threshold into one reader instead of the config, this fails.
 */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const Q = require(path.join(__dirname, '..', 'engine', 'quality.js'));

let P = 0, F = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); c ? P++ : F++; };

console.log('== the config is the only place a threshold lives ==');
const cfg = Q.config();
ok(cfg.rules.min_turns.value === 3, `min_turns comes from the config (${cfg.rules.min_turns.value})`);
ok(Object.keys(cfg.rules).length === 5, `four rules defined (${Object.keys(cfg.rules).join(', ')})`);
ok(!!cfg.rules.exclude_bot_games.known_limitation, 'the bot rule records that detection is name-only');
ok(!!cfg.rules.require_full_bring.known_limitation, 'the bring rule records that it conditions on game length');
ok(!!cfg.rules.exclude_behavioural_bots.known_limitation, 'the behavioural rule records that it raises a floor, not a proof');

console.log('== behavioural bot detection ==');
/* The five accounts below were NOT caught by the name filter and appeared in 52.2% of the games it
 * passed. The decisive signal is team invariance - hundreds of games, one team, never varied. */
const allGames = Q.loadGames({ clean: false });
const bots = Q.behaviouralBots(allGames);
for (const n of ['Carchdraw84172', 'Natsitimer52906', 'Ironbough29517', 'Duskglade57204', 'Scoobsicle40912'])
  ok(bots.has(n), `${n} is detected as a behavioural bot`);

/* S6 - assert the invariant, not the incidental. This used to pin `bots.size === 5`, which broke on
 * 2026-07-25 when the store grew and a sixth account (HospitalityCheck, 55 games, 1 team) crossed
 * the threshold. That is the rule working, not a regression, and a bare count cannot tell the two
 * apart. What must hold is the RULE: every detected account has at least min_games and exactly one
 * distinct team. A false positive breaks that; a genuine new bot does not. */
{
  const R = cfg.rules.exclude_behavioural_bots;
  const seen = new Map();
  for (const g of allGames) for (const s of ['p1', 'p2']) {
    const n = (g[s] || {}).name; if (!n) continue;
    const six = ((g.six || {})[s] || []).slice().sort().join('|'); if (!six) continue;
    if (!seen.has(n)) seen.set(n, { games: 0, teams: new Set() });
    const r = seen.get(n); r.games++; r.teams.add(six);
  }
  const bad = [...bots].filter(n => {
    const r = seen.get(n);
    return !r || r.games < R.min_games || r.teams.size > R.max_distinct_teams;
  });
  ok(bad.length === 0,
    `every detected account satisfies the rule (>=${R.min_games} games, <=${R.max_distinct_teams} team)` +
    (bad.length ? ` - violations: ${bad.join(', ')}` : ` [${bots.size} detected]`));
  ok(bots.size >= 5, `at least the five originally documented accounts are caught (${bots.size})`);
}
// no account that varies its team should ever be caught, at any volume
const varied = new Map();
for (const g of allGames) for (const s of ['p1','p2']) {
  const n=(g[s]||{}).name; if(!n) continue;
  const six=((g.six||{})[s]||[]).slice().sort().join('|'); if(!six) continue;
  if(!varied.has(n)) varied.set(n,new Set()); varied.get(n).add(six);
}
const wrongly=[...bots].filter(n=>(varied.get(n)||new Set()).size>1);
ok(wrongly.length===0, `no account with more than one team is flagged${wrongly.length?': '+wrongly.join(', '):''}`);

console.log('== both readers select the same games ==');
/* Compare a HASH of the sorted id list rather than shipping the whole list between processes.
 * Identical hashes mean identical selections, and it keeps the test fast enough to stay in CI. */
const crypto = require('crypto');
const digest = ids => crypto.createHash('sha256').update(ids.join(',')).digest('hex').slice(0, 16);
const jsGames = Q.loadGames();
const jsIds = jsGames.map(g => g.id).sort();
/* Find a REAL Python. `python3` alone is a Linux assumption: on Windows the python.org installer
 * ships python.exe (not python3.exe), and `python3` resolves to the Microsoft Store alias stub,
 * which prints "Python was not found" and exits 9009.
 *
 * Resolution now lives in engine/python.js (S12) rather than being duplicated here and in server.js.
 * The old local probe tried only python3/python/py and therefore SKIPPED on this project's own
 * development machine, where those names all resolve to the stub while a working Python 3.12.10 sits
 * in %LOCALAPPDATA%\Programs\Python. A parity test that silently skips is worse than one that fails:
 * it reports success while checking nothing. */
const found = require('../engine/python.js').find();
if (!found) {
  console.error('SKIP: no working Python found (probed names and standard install roots).');
  console.error('The JS/Python parity check cannot run. Install Python or add it to PATH.');
  process.exit(2);   // distinct from a real failure, so CI can tell them apart
}
const [PYCMD, PYPRE] = [found.cmd, found.args];
const py = execFileSync(PYCMD, [...PYPRE, '-c',
  "import sys,hashlib; sys.path.insert(0,'engine'); import quality;" +
  "ids=sorted(g['id'] for g in quality.load_games());" +
  "print(len(ids)); print(hashlib.sha256(','.join(ids).encode()).hexdigest()[:16])"
], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim().split('\n');
const pyCount = +py[0], pyHash = py[1].trim();
ok(jsIds.length === pyCount, `same count: JS ${jsIds.length}, Python ${pyCount}`);
ok(digest(jsIds) === pyHash, `identical selection (sha ${digest(jsIds)} vs ${pyHash})`);

console.log('== the funnel is internally consistent ==');
const f = Q.funnel();
ok(f.collected >= f.after_bot_filter, 'removing bots cannot increase the count');
ok(f.after_bot_filter >= f.after_behavioural_bots, 'the behavioural rule cannot increase the count');
ok(f.after_behavioural_bots >= f.after_forfeit_filter, 'removing forfeits cannot increase the count');
ok(f.after_forfeit_filter >= f.after_min_turns, 'the turn floor cannot increase the count');
ok(f.after_min_turns >= f.after_full_bring, 'requiring a full bring cannot increase the count');
ok(f.clean === f.after_full_bring, 'the clean count equals the last stage');
ok(f.clean === jsGames.length, `loadGames returns exactly the clean set (${jsGames.length})`);

console.log('== the recorded provenance matches what the code actually produces ==');
/* A funnel written into the config and never re-checked is how a stale number reaches a website.
 * This is the check that makes the recorded figure trustworthy. */
/* This used to assert the recorded funnel EQUALLED the live one. That test cannot pass: the hourly
 * ingest grows the store continuously, so a pinned absolute count is stale within the hour. It
 * failed on 2026-07-25 purely because 401 legitimate new games had arrived (8,356 -> 8,757).
 *
 * S6 again — assert the invariant, not the incidental. What must actually hold is:
 *   1. the funnel is monotone: every stage removes games, none adds any;
 *   2. the recorded numbers are internally consistent in the same way;
 *   3. the clean SHARE has not moved much, which is what would change if the filter itself broke.
 * Growth is expected. A shifting selection rate is not. */
const rec = cfg.provenance.funnel;
const stages = ['collected', 'after_bot_filter', 'after_behavioural_bots', 'after_forfeit_filter', 'after_min_turns', 'after_full_bring'];

const mono = (o, label) => {
  const bad = [];
  for (let i = 1; i < stages.length; i++) {
    if (o[stages[i]] > o[stages[i - 1]]) bad.push(`${stages[i]} (${o[stages[i]]}) > ${stages[i - 1]} (${o[stages[i - 1]]})`);
  }
  ok(bad.length === 0, `${label} funnel is monotone${bad.length ? ': ' + bad.join('; ') : ''}`);
};
mono(f, 'live');
mono(rec, 'recorded');

const shareNow = f.clean / f.collected, shareRec = rec.after_full_bring / rec.collected;
const drift = Math.abs(shareNow - shareRec) * 100;
ok(drift <= 3,
  `clean share is stable: ${(100 * shareNow).toFixed(1)}% now vs ${(100 * shareRec).toFixed(1)}% recorded ` +
  `(drift ${drift.toFixed(1)} pts, tolerance 3). Store has grown ${rec.collected} -> ${f.collected}.`);

console.log('== every excluded game has a stated reason ==');
const all = Q.loadGames({ clean: false });
const _bots = Q.behaviouralBots(all);
const excluded = all.filter(g => !Q.isClean(g, null, _bots));
const _b = Q.behaviouralBots(all);
ok(excluded.every(g => Q.reasons(g, null, _b).length > 0), `all ${excluded.length} excluded games carry at least one reason`);
ok(all.length - excluded.length === f.clean, 'clean + excluded accounts for every stored game');

console.log(`\nQUALITY FILTER TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
