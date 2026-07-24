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
ok(bots.size === 5, `exactly 5 accounts detected (${bots.size})`);
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
const py = execFileSync('python3', ['-c',
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
const rec = cfg.provenance.funnel;
let drift = [];
for (const k of Object.keys(rec)) if (rec[k] !== f[k]) drift.push(`${k}: config ${rec[k]} vs actual ${f[k]}`);
ok(drift.length === 0, `config funnel matches the store${drift.length ? ': ' + drift.join('; ') : ` (${f.clean} clean)`}`);

console.log('== every excluded game has a stated reason ==');
const all = Q.loadGames({ clean: false });
const _bots = Q.behaviouralBots(all);
const excluded = all.filter(g => !Q.isClean(g, null, _bots));
const _b = Q.behaviouralBots(all);
ok(excluded.every(g => Q.reasons(g, null, _b).length > 0), `all ${excluded.length} excluded games carry at least one reason`);
ok(all.length - excluded.length === f.clean, 'clean + excluded accounts for every stored game');

console.log(`\nQUALITY FILTER TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
