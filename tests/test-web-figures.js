/* WEB'S OWN NUMBER, AND THE FLOOR UNDER IT.
 *
 *   node tests/test-web-figures.js
 *   node tests/test-web-figures.js --list     every untraced figure, with its line
 *
 * `.claude/agents/web.md` gives this division exactly one rule — *you may not author a number* —
 * and `docs/DIVISIONS.md` gives it exactly one number: "every rendered figure traces to an
 * artifact". Nothing computed it. Every other division is judged on a figure that a script prints;
 * WEB's was a sentence. CLAUDE.md has the general form of this already: *a standard that is not
 * checked is a preference*, and *a check nobody acts on is not a check*.
 *
 * WHAT IS MEASURED, AND WHERE THE DEFINITIONS LIVE
 * ------------------------------------------------
 * `web/figure-audit.js` — read its header, which is the specification. It is the ONE implementation
 * of what counts as a figure and what counts as traced; this test and `web/build-status.js` both
 * call it, so the terminal, the board and the guard cannot give three answers to one question.
 * In short: a figure is a hardcoded number in visible page text that clears a scale filter; it is
 * traced when its source line names the artifact it came from.
 *
 * WHY A FLOOR AND NOT A TARGET
 * ----------------------------
 * `tests/test-web-status.js` explains the principle and it applies here: an assertion should be a
 * RELATION, not a pinned value, or the project's own numbers become un-improvable without editing a
 * test. So this pins a FLOOR that the current state clears, and fails when the site slips below it.
 * Raising the floor after wiring figures up is the intended edit; lowering it is the thing this
 * exists to make someone justify out loud.
 *
 * THE FIRST MEASUREMENT WAS BELOW HALF, AND THAT WAS THE FINDING. Publishing a flattering first
 * number would have made the metric worthless. It opened at 27.4% (17 of 62) with `web/stadium.html`
 * at a flat 0 of 24 — twelve cabinets carrying real results in prose with no artifact named beside
 * them. That was fixed on 2026-08-04 by citing each cabinet's artifact and, where the cabinet had
 * drifted from it, by quoting the artifact instead: MEDICHAM's "~44%, below chance" and SLOWKING's
 * 0.84/0.16 mixture appear in no file on disk any more and are struck out rather than deleted.
 * The floor moved 25.0 -> 80.0 in the same pass. RAISING it is the intended edit.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { audit } = require(path.join(ROOT, 'web', 'figure-audit.js'));

/* ================================================================================================
 * THE FLOOR. Measured 2026-08-04 at 92.0% overall (92 of 100), from 84.3% (70 of 83) earlier the
 * same day and 27.4% (17 of 62) the day it was introduced. The last two untraced pages were closed
 * in that pass: web/models.html cites data/quality-filter.json beside its bot share and now READS
 * the mechanics census out of web/status-data.js rather than carrying it, and web/tower.html cites
 * data/damage-validation.json and reads its species count off data/engine-data.js instead of
 * carrying a typed 289. Two of those became interpolations, so the denominator FELL — a figure that
 * stops being hardcoded leaves this metric entirely, which is the intended direction.
 * Set a little under the measurement, so that ordinary copy-editing does not turn the guard red and
 * a real regression does.
 * RAISE THIS whenever the real number rises. Never lower it without saying why in the same commit.
 * ============================================================================================== */
const FLOOR_PCT = 88.0;
/* THE PER-PAGE FLOOR, AND WHY IT IS LOWER. web/index.html is the front door, the largest page and
 * the worst-traced at 80.5%; every other page with figures is at 100%. A per-page floor exists so a
 * new room cannot ship with nothing cited while the site-wide number rides on the good pages, so it
 * is pinned just under the genuine worst page rather than at the site average. */
const PAGE_FLOOR_PCT = 75.0;
/* Withdrawn figures are struck out on the page and out of the denominator. If that count DROPS, a
 * retracted claim was quietly deleted or quietly un-struck, which is the failure the strike exists
 * to prevent. Measured 2026-08-04: 26 — 19 from the twin-test paragraph in web/index.html, plus 7
 * from web/stadium.html, where MEDICHAM's superseded win-rate reading and SLOWKING's superseded
 * equilibrium were struck out rather than deleted when the cabinets were reconciled to their
 * artifacts. Deleting them would have hidden that the page ever made those claims.
 * RAISED 26 -> 28 later the same day, and the two extra were always on the page: KADABRA's strike
 * carried `class="wd"` inside a double-quoted JS string, which was a SyntaxError that killed the
 * whole Stadium script (see tests/test-web-parses.js) and also truncated the strike as far as this
 * scanner was concerned, so two withdrawn figures were being counted as ordinary text. Fixing the
 * quoting revealed them. */
const MIN_WITHDRAWN = 28;

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

const r = audit();

console.log('WEB FIGURE PROVENANCE — ' + r.metric + '\n');
for (const p of r.pages) {
  const share = p.pct === null ? '     —' : String(p.pct + '%').padStart(6);
  console.log('  ' + p.file.padEnd(22) + share + '   traced ' + String(p.traced).padStart(3) + ' / ' + String(p.denom).padStart(3)
    + (p.withdrawn ? '   (+' + p.withdrawn + ' withdrawn)' : ''));
}
console.log('\n  OVERALL ' + r.pct + '%  —  ' + r.traced + ' of ' + r.denom + ' figures cite an artifact, '
  + r.withdrawn + ' withdrawn, ' + r.placeholders + ' live placeholders\n');

/* 1. The metric ran at all. A scanner that silently finds nothing reports 100% or null, and both
 *    look like success — CLAUDE.md's "a capability was absent and everything reported success". */
ok(r.denom > 0, `the scanner found figures to judge (${r.denom}); a zero denominator is a broken scanner, not a clean site`);
ok(r.pages.length >= 8, `every room was scanned (${r.pages.length} pages under web/)`);

/* 2. The floor. */
ok(r.pct >= FLOOR_PCT,
  `${r.pct}% of figures cite an artifact — floor is ${FLOOR_PCT}%` +
  (r.pct >= FLOOR_PCT ? '' : '. Wire the new figure to its artifact, or withdraw it. Run: node web/figure-audit.js --list'));

/* 3. A withdrawn claim stays withdrawn, and stays explained. */
ok(r.withdrawn >= MIN_WITHDRAWN,
  `${r.withdrawn} figures are struck out as withdrawn — expected at least ${MIN_WITHDRAWN}` +
  (r.withdrawn >= MIN_WITHDRAWN ? '' : '. A retracted claim was deleted or un-struck; deleting it hides that it was ever made'));
ok(r.bad_strikes.length === 0,
  r.bad_strikes.length === 0
    ? 'every <s class="wd"> says when and why it was withdrawn'
    : `${r.bad_strikes.length} withdrawn-strike(s) carry no title — a strike with no reason is not a declaration: `
      + r.bad_strikes.map(b => b.file + ':' + b.n).join(', '));

/* 4. NO PAGE MAY GET WORSE THAN THE WORST ONE THAT EXISTS. A site-wide percentage can be held up by
 *    one good page while a new room ships with nothing cited, so the per-page floor is checked too.
 *    Pages with no hardcoded figures are exempt by construction — they have nothing to trace.
 *
 *    THIS ASSERTED `p.pct >= 0` UNTIL 2026-08-04, which is true of every percentage there has ever
 *    been. The comment above it described a floor and the code below it could not fail, so the site
 *    ran with a per-page guard that was a sentence. That is the same defect the whole file exists to
 *    catch, one level up: a check nobody can fail is not a check. */
for (const p of r.pages) {
  if (p.denom === 0) continue;
  ok(p.pct >= PAGE_FLOOR_PCT,
    `${p.file}: ${p.traced}/${p.denom} traced (${p.pct}%) — per-page floor is ${PAGE_FLOOR_PCT}%`);
}

if (process.argv.includes('--list')) {
  console.log('\nUNTRACED — each needs a citation on its line, or a withdrawal:');
  for (const p of r.pages) {
    if (!p.open.length) continue;
    console.log('\n  ' + p.file);
    for (const o of p.open) console.log('    :' + String(o.n).padEnd(5) + o.tok.padEnd(10) + o.ctx);
  }
}

console.log(`\nWEB FIGURE TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
