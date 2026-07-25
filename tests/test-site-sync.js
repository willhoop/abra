/* test-site-sync.js — web/ and app/ must be byte-identical, and the site must not carry stale counts.
 *
 * WHY: the documented procedure is `cp web/index.html app/index.html`. Hand-synchronisation is S1's
 * exact failure mode, in the most user-visible place in the project — a single forgotten copy ships
 * a site that differs from the reviewed source with nothing failing.
 *
 * The second check is narrower and was earned: on 2026-07-25 the site hardcoded "5,199 real Champions
 * games" while data/live.js said 8,757 and the defensible figure was 1,124. The word "real" was doing
 * the most work in the sentence, because that population is unfiltered and three in four stored games
 * involve a bot.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

const web = fs.readFileSync(D('web', 'index.html'), 'utf8');
const app = fs.readFileSync(D('app', 'index.html'), 'utf8');
ok(web === app, `web/index.html and app/index.html are identical (${web.length} vs ${app.length} bytes)`);

/* Any four-digit count written into the markup is a hardcode that will go stale. The store grows
 * hourly; a number typed into HTML cannot. */
const STALE = [/5,199/, /7,716/, /7,547/, /14,355/, /2,020 clean/];
for (const re of STALE) {
  const hit = re.test(web);
  ok(!hit, `site does not carry the stale figure ${re.source}`);
}
console.log(`\nSITE SYNC TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
