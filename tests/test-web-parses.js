/* EVERY ROOM'S SCRIPT MUST ACTUALLY PARSE.
 *
 *   node tests/test-web-parses.js
 *
 * WHY THIS EXISTS, AND IT IS NOT HYPOTHETICAL
 * -------------------------------------------
 * On 2026-08-04 `web/stadium.html` had this on line 423, inside a DOUBLE-quoted JavaScript string:
 *
 *     honest:"... <s class="wd" title="Retracted 2026-08-04: ...">Quoted here until ...</s> ..."
 *
 * The inner `"` closed the string. The whole inline block was a SyntaxError, so ABRA STADIUM
 * rendered its header and nothing else: no cabinet rack, no stage, no controls, no honest panels.
 * It was committed and it sat there.
 *
 * NOTHING CAUGHT IT, AND THE REASON IS THE ONE CLAUDE.MD OPENS WITH. `tests/test-stadium-roster.js`
 * compares the cabinet list to `docs/MODELS.md` -- and it PASSED, every run, because it reads the
 * page as TEXT. `web/figure-audit.js` scored the page at 100% traced -- also from the text. Two
 * guards agreed the page was correct while the page did not run. A capability was absent and
 * everything reported success.
 *
 * So this asserts the one property both of those assume and neither checks: the code a visitor's
 * browser is handed is code. It is deliberately the cheapest possible test -- it parses, it does not
 * execute -- because a page that does not parse cannot be wrong about a number, it is simply blank,
 * and blank is the failure that looks most like success in a text diff.
 *
 * WHAT IT CANNOT CATCH: a runtime error. `MC.mons` being undefined, an element id that moved, a
 * `null` dereference on first paint -- all of those parse. This closes the syntax half only, which
 * is the half that was open.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

/* PROSE THAT MENTIONS `<script>` IS NOT A SCRIPT, and both places it happens on this site were
 * found by this file reporting a syntax error in an English sentence:
 *   - `models.html` has an HTML comment explaining why it loads bundles with `<script src>` rather
 *     than fetch();
 *   - `index.html` has a CSS comment inside <style> counting its "nine render-blocking <script src>
 *     tags".
 * A scanner that just looks for `<script` finds both, decides the surrounding prose is a program,
 * and fails. A guard whose first report is a false alarm is a guard that gets switched off, which is
 * the failure this file exists downstream of -- so comments and <style> bodies are blanked first,
 * newlines preserved so the reported line number still points at the real file. */
function inlineScripts(src) {
  const blank = m => m.replace(/[^\n]/g, ' ');
  const clean = src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, blank);
  const out = [];
  let i = 0;
  while (true) {
    const o = clean.indexOf('<script', i);
    if (o < 0) break;
    const gt = clean.indexOf('>', o);
    if (gt < 0) break;
    const tag = clean.slice(o, gt + 1);
    const c = clean.indexOf('</script>', gt);
    if (c < 0) break;
    /* `src=` means the body is elsewhere and belongs to whatever generates it. */
    if (!/\bsrc\s*=/.test(tag)) {
      out.push({ line: clean.slice(0, gt).split('\n').length, body: clean.slice(gt + 1, c) });
    }
    i = c + 9;
  }
  return out;
}

console.log('WEB PARSES — every inline <script> in every room is valid JavaScript\n');

const rooms = fs.readdirSync(path.join(ROOT, 'web')).filter(f => /\.html$/.test(f)).sort();
ok(rooms.length > 0, `found ${rooms.length} rooms under web/`);

let blocks = 0;
for (const f of rooms) {
  const src = fs.readFileSync(path.join(ROOT, 'web', f), 'utf8');
  const scripts = inlineScripts(src);
  /* The catch STASHES the failure for the assertion two lines down — that is the reporting path
   * itself, and the variable is named so the silent-catch ratchet can see it is one. */
  let failMsg = null;
  for (const s of scripts) {
    blocks++;
    try { new vm.Script(s.body, { filename: 'web/' + f }); }
    catch (e) { failMsg = 'web/' + f + ' near line ' + s.line + ': ' + String(e.message).split('\n')[0]; break; }
  }
  ok(failMsg === null, failMsg || `web/${f}: ${scripts.length} inline block(s) parse`);
}

/* AND THE SCANNER MUST HAVE FOUND SOMETHING. Every interactive room on this site carries an inline
 * block; a run that reports zero has stopped reading the pages, and would then report every room
 * clean forever. Same reason tests/test-web-figures.js asserts a non-zero denominator. */
ok(blocks >= 5, `${blocks} inline blocks were parsed — a zero here is a broken scanner, not a clean site`);

/* AND IT MUST STILL BITE. The bug that motivated this file is exactly "a double quote inside a
 * double-quoted string", so that is what the self-check feeds it. */
let errored = false;
try { new vm.Script('var a = {honest:"x <s class="wd">y</s>"};'); } catch (e) { errored = true; }
ok(errored, 'the parser rejects an unescaped double quote inside a double-quoted string — the exact 2026-08-04 stadium.html bug');

console.log(`\nWEB PARSE TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
