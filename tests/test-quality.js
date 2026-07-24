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
ok(Object.keys(cfg.rules).length === 4, `four rules defined (${Object.keys(cfg.rules).join(', ')})`);
ok(!!cfg.rules.exclude_bot_games.known_limitation, 'the bot rule records that detection is name-only');
ok(!!cfg.rules.require_full_bring.known_limitation, 'the bring rule records that it conditions on game length');

console.log('== both readers select the same games ==');
const jsGames = Q.loadGames();
const jsIds = jsGames.map(g => g.id).sort();
const py = execFileSync('python3', ['-c',
  "import sys,json; sys.path.insert(0,'engine'); import quality;" +
  "print(json.dumps(sorted(g['id'] for g in quality.load_games())))"
], { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const pyIds = JSON.parse(py);
ok(jsIds.length === pyIds.length, `same count: JS ${jsIds.length}, Python ${pyIds.length}`);
const same = jsIds.length === pyIds.length && jsIds.every((id, i) => id === pyIds[i]);
ok(same, 'the two readers select an identical set of game ids');

console.log('== the funnel is internally consistent ==');
const f = Q.funnel();
ok(f.collected >= f.after_bot_filter, 'removing bots cannot increase the count');
ok(f.after_bot_filter >= f.after_forfeit_filter, 'removing forfeits cannot increase the count');
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
const excluded = all.filter(g => !Q.isClean(g));
ok(excluded.every(g => Q.reasons(g).length > 0), `all ${excluded.length} excluded games carry at least one reason`);
ok(all.length - excluded.length === f.clean, 'clean + excluded accounts for every stored game');

console.log(`\nQUALITY FILTER TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
