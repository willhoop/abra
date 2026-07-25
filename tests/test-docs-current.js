/* test-docs-current.js — enforce the two documentation rules nothing was enforcing.
 *
 * WHY THIS EXISTS
 * ---------------
 * docs/ARCHITECTURE.md section 4 has an "Enforced by" column, and every standard with a real check
 * behind it held up: S7 caught the store-shape break, S9 caught engine drift, S10 found Naughty and
 * Lax. Every standard enforced only by a sentence in CLAUDE.md drifted instead.
 *
 * On 2026-07-25 that cost two things. Fifteen commits moved the CHANGELOG to 3.3.0 while the white
 * paper stayed at 2.6.0 and the technical docs at 2.4.0, with nothing complaining. And the role-pair
 * median cell of n=7,971 — retracted in 2.7.0 — was still stated as fact in FIVE documents months
 * later, which is the failure ARCHITECTURE.md itself names: "a number retracted in the changelog but
 * left standing in the white paper, the deck and the site."
 *
 * ARCHITECTURE.md also states the countermeasure: "make a retraction fail a build rather than rely
 * on someone remembering." This is that build failure.
 *
 *   node tests/test-docs-current.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

/* ---- 1. RETRACTED NUMBERS MUST NOT REAPPEAR AS FACT ------------------------------------------
 * The registry is the point. A number that was withdrawn goes in here with what replaced it, and
 * the build fails if it shows up anywhere without its retraction alongside. Add to this list every
 * time a figure is withdrawn — that is the whole mechanism. */
const RETRACTED = [
  { bad: /\b7,?971\b/, what: 'role-pair median cell n=7,971',
    why: 'retracted in 2.7.0 as an over-tagging artifact; measured value is 20 across 1,051 cells',
    allowIfNear: /retract|artifact|superseded|inflated|over-tagg|→ 20|-> 20/i },
  { bad: /\b0\.6875\b/, what: "WAR's held-out log-loss of 0.6875",
    why: 'withdrawn in 3.2.0 — that figure came from the unfiltered store; on clean games WAR scores 0.7048, worse than a coin',
    allowIfNear: /withdraw|unfiltered|superseded|retract/i },
  { bad: /higher-rated player (?:wins|won) (?:just )?55\.0%|\b55\.0% of the time\b/, what: 'the 55.0% skill ceiling',
    why: 'measured with bots included; 52.4% with behavioural bots removed, CI includes 50',
    allowIfNear: /bot|superseded|retract|contaminat/i },
];

function scanDocs() {
  console.log('== 1. retracted numbers must not be stated as fact ==');
  /* CHANGELOG.md is EXEMPT, and deliberately so. It is the historical record: a retracted figure
   * must remain in the entry that published it and in the entry that withdrew it, or the retraction
   * itself becomes unreadable. The rule applies to documents that assert CURRENT fact.
   * docs/archive/ is exempt for the same reason. */
  const EXEMPT = new Set(['CHANGELOG.md']);
  const files = [];
  for (const dir of ['docs', '.']) {
    for (const f of fs.readdirSync(D(dir))) {
      if (!f.endsWith('.md')) continue;
      if (EXEMPT.has(f)) continue;
      if (dir === 'docs' && f === 'archive') continue;
      files.push(path.join(dir, f));
    }
  }
  for (const r of RETRACTED) {
    const hits = [];
    for (const rel of files) {
      const p = D(rel);
      if (!fs.statSync(p).isFile()) continue;
      /* Check a WINDOW, not the line. A properly-written retraction usually quotes the old figure on
       * one line and marks it withdrawn on another — matching line-by-line flagged exactly that and
       * would have punished the correct behaviour. */
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!r.bad.test(lines[i])) continue;
        const ctx = lines.slice(Math.max(0, i - 4), i + 3).join(' ');
        if (r.allowIfNear && r.allowIfNear.test(ctx)) continue;   // stated WITH its retraction: fine
        hits.push(`${rel}: ${lines[i].trim().slice(0, 90)}`);
      }
    }
    ok(hits.length === 0,
      `${r.what} is not restated as fact${hits.length ? ` — ${hits.length} place(s):\n         ` + hits.slice(0, 4).join('\n         ') : ''}`);
    if (hits.length) console.log(`         (${r.why})`);
  }
}

/* ---- 2. THE LIVING DOCS MUST TRACK THE CHANGELOG ---------------------------------------------
 * CLAUDE.md: "Any change to a model, a result, or the site updates ALL of the following in the SAME
 * pass ... plus a CHANGELOG entry and a version bump." Nothing checked it, so it did not happen. */
const LIVING = [
  'docs/ABRA-whitepaper.md',
  'docs/ABRA-deck-plain-english.md',
  'docs/ABRA-technical-docs.md',
  'docs/SUMMARY.md',
  'docs/MODELS.md',
];
const verOf = (txt) => {
  const m = txt.match(/(?:Version|v)\s*(\d+\.\d+\.\d+)/i);
  return m ? m[1] : null;
};

function versions() {
  console.log('\n== 2. living docs track the CHANGELOG version ==');
  const ch = fs.readFileSync(D('CHANGELOG.md'), 'utf8');
  const top = (ch.match(/##\s*\[(\d+\.\d+\.\d+)\]/) || [])[1];
  ok(!!top, `CHANGELOG has a top version (${top || 'none found'})`);
  if (!top) return;
  const stale = [];
  for (const rel of LIVING) {
    const v = verOf(fs.readFileSync(D(rel), 'utf8'));
    if (v !== top) stale.push(`${rel} @ ${v || 'none'}`);
  }
  ok(stale.length === 0,
    `all living docs are at ${top}${stale.length ? ` — stale: ${stale.join(', ')}` : ''}`);
  if (stale.length) {
    console.log('         CLAUDE.md requires these to move in the SAME pass as the code.');
    console.log('         Bumping the header alone is NOT the fix — the content has to be brought current,');
    console.log('         or the version becomes another asserted number.');
  }
}

scanDocs();
versions();
console.log(`\nDOC CURRENCY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
