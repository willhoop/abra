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

/* EVERY ROOM, NOT JUST THE FRONT DOOR.
 *
 * This checked `index.html` alone, and was therefore blind to the failure that actually happened:
 * on 2026-08-04 `web/stadium.html` and `web/status.html` were built, tested, committed and pushed —
 * and never copied to `app/`, which is what GitHub Pages serves. The guard was green the whole time,
 * because the one file it compared was in sync. Will found it by opening the live URL and getting a
 * 404, which is the only way it could have been found.
 *
 * A missing FILE is invisible to a check that compares two named files. So the set is derived from
 * `web/` rather than listed, and a page added tomorrow is covered without editing this. The sidecar
 * `.js` bundles a page loads relatively are included for the same reason — `status.html` is useless
 * without `status-data.js` beside it, and shipping the page alone would render an empty board with
 * no error a visitor sees.
 *
 * This is the three-places rule from the umbrella CLAUDE.md, caught one place short: local and
 * GitHub had it, the live site did not, and "pushed" was reported as done. */
const SIDECARS = ['status-data.js'];
const rooms = fs.readdirSync(D('web')).filter(f => /\.html$/.test(f)).sort();
ok(rooms.length > 0, `found ${rooms.length} rooms under web/ to check`);

for (const f of [...rooms, ...SIDECARS]) {
  const wp = D('web', f), ap = D('app', f);
  if (!fs.existsSync(ap)) {
    ok(false, `app/${f} is MISSING — web/ has it and the live site does not. Fix: cp web/${f} app/${f}`);
    continue;
  }
  const w = fs.readFileSync(wp, 'utf8'), a = fs.readFileSync(ap, 'utf8');
  ok(w === a, `web/${f} and app/${f} are identical (${w.length} vs ${a.length} bytes)`);
}

const web = fs.readFileSync(D('web', 'index.html'), 'utf8');

/* Any four-digit count written into the markup is a hardcode that will go stale. The store grows
 * hourly; a number typed into HTML cannot. */
const STALE = [/5,199/, /7,716/, /7,547/, /14,355/, /2,020 clean/];
for (const re of STALE) {
  const hit = re.test(web);
  ok(!hit, `site does not carry the stale figure ${re.source}`);
}
console.log(`\nSITE SYNC TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
