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

  /* ---- added 2026-07-25, after an adversarial review found the project had not applied its own
   * retraction mechanism to its own Critical finding on the day it made it. Every entry below was
   * live in five or more documents while the evidence said otherwise. */

  { bad: /\b0\.567\b/, what: "PORY's headline log-loss of 0.567 vs a coin's 0.693",
    why: 'the comparison is to a COIN, which is not the bar. Against alive_diff+hp_diff -- two ' +
         'material features -- PORY scores identically to four decimals. Its fitted weights reduce ' +
         'algebraically to sigmoid(1.256*alive_diff + 1.544*hp_diff): my_alive and foe_alive carry ' +
         'exactly equal-and-opposite coefficients, and turn is exactly zero. Publish the gain over ' +
         'MATERIAL, never the gain over a coin.',
    allowIfNear: /retract|withdraw|superseded|material|two.feature|coin is not the bar|arithmetic|shipped fit|does not rescue/i },

  { bad: /PORY[^.\n]{0,40}\b(?:the win|a value net that works|validated)\b/i,
    what: 'PORY framed as "the win" / a validated value net',
    why: 'PORY is a two-parameter material model. It ties the two-feature baseline and adds nothing ' +
         'over counting Pokemon. The `turn` feature is STRUCTURALLY unfittable: pory.py emits each ' +
         'state twice with sides swapped and the label flipped, so any feature invariant under that ' +
         'swap has a cancelling gradient and is pinned to zero forever.',
    allowIfNear: /retract|withdraw|superseded|counting|two.(?:parameter|feature)|arithmetic|does not beat|shown to tie/i },

  { bad: /\b(?:8,757|5,199|2,020|7,716)\b/, what: 'a hardcoded dataset size',
    why: 'dataset sizes are generated into data/live.js by engine/refresh-site-data.py from the ' +
         'same filter the models use. Six different hardcoded sizes were live across six rooms at ' +
         'once, and a prior fix replaced one literal with a newer literal that went stale the same ' +
         'day. Reference the generated value; never type a count. (S13)',
    allowIfNear: /generated|hardcod|stale|retract|superseded|derive|S13|both wrong|wrong\.|claims|fix the site|defensible/i },

  { bad: /\bnot 3 clean games\b|\b1,?061 clean games\b/, what: 'the 1,061-clean-game figure',
    why: 'superseded as the store grows; the current funnel is written to data/live.js on every ' +
         'refresh. Quote the generated number or none at all.',
    allowIfNear: /generated|superseded|retract|live\.js/i },
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

/* ---- 1b. A CLAIM MUST NOT OUTLIVE THE ARTIFACT IT RESTS ON -------------------------------------
 *
 * The RETRACTED registry above is hand-maintained: someone has to notice a figure died and type it
 * in. That works for a figure withdrawn by a DECISION, and it is exactly what failed for a figure
 * withdrawn by the DATA MOVING — nobody retracts anything, the artifact simply regenerates and the
 * sentence in the document quietly stops being true.
 *
 * "Our meta is rock-paper-scissors" is the case in hand. docs/CONFORMANCE-REVIEW-2026-07-26.md
 * removed it from MODELS.md in July, for the good reason that it had been measured over a corpus
 * that is 87% bots. It survived, unqualified, in docs/LITERATURE-v2.md.
 *
 * So this DERIVES the claim's licence from the shipped artifact instead of from a list:
 *
 *   data/slowking-playstyle-eval.json  ->  top_nontransitive_cycle.supported
 *
 * The artifact already decides this and states its own rule — every leg must clear 50% on >= 50
 * games — and records that the reported cycle is the strongest of 336 candidate triples, so an
 * unsupported one "is what noise looks like, not weak evidence of structure". When the metagame
 * moves and a real cycle appears, `supported` flips and this goes quiet on its own. Nothing here
 * needs editing for that to happen, which is the difference between a guard and a number. */
function nonTransitivityIsSupported() {
  console.log('\n== 1b. the non-transitivity claim tracks the SLOWKING artifact ==');
  const F = D('data', 'slowking-playstyle-eval.json');
  if (!fs.existsSync(F)) { ok(false, 'data/slowking-playstyle-eval.json exists to check claims against'); return; }
  const d = JSON.parse(fs.readFileSync(F, 'utf8'));
  const cyc = d.top_nontransitive_cycle || {};
  const ex = d.exploitability || {};
  const gapCI = ex.greedy_minus_nash_ci95 || [];
  console.log(`         artifact says: cycle supported=${cyc.supported}, ` +
    `greedy-minus-Nash ${ex.greedy_minus_nash} CI ${JSON.stringify(gapCI)}`);
  if (cyc.supported === true && gapCI.length === 2 && gapCI[0] > 0) {
    ok(true, 'the artifact supports a cycle — documents may state one');
    return;
  }

  /* Only unqualified ASSERTIONS count. A document is free to discuss the hypothesis, report the
   * measurement, or explain why it was withdrawn — the sentence this catches is the one telling a
   * reader the metagame IS cyclic with nothing beside it saying the evidence did not hold. */
  const ASSERTS = /\b(?:our|the|this)\s+meta(?:game)?\s+is\s+(?:a\s+)?(?:rock[- ]paper[- ]scissors|non-?transitive|cyclic)\b/i;
  const QUALIFIED = /suggestive|not a fact|hint|caveat|unsupported|retract|withdraw|superseded|noise|small sample|does not reproduce|close to transitive|cross(?:es)? 50|JOLTEON/i;

  /* A QUOTED CLAIM IS A CITATION, NOT AN ASSERTION, and the first version of this check could not
   * tell the difference — it flagged docs/CONFORMANCE-REVIEW-2026-07-26.md and
   * docs/SYSTEMS-AUDIT-2026-07-31.md, both of which reproduce the sentence precisely in order to
   * withdraw or audit it. Punishing the two documents that did the right thing is how a check gets
   * switched off.
   *
   * The discriminator is the quotation marks around the match itself, which is exactly the
   * distinction being drawn: prose asserts, a quotation reports what someone else asserted.
   *
   * A quotation WRAPS, so this cannot be decided one line at a time: SYSTEMS-AUDIT-2026-07-31.md
   * opens the quote on one line and closes it on the next, and a line-local test called the second
   * half an assertion. Counting quote marks from the start of the paragraph gets it right — an odd
   * count before the match means the match sits inside an open quotation. */
  const isQuoted = (lines, i, m) => {
    let start = i;
    while (start > 0 && lines[start - 1].trim() !== '') start--;
    const before = lines.slice(start, i).join('\n') + '\n' + lines[i].slice(0, m.index);
    const marks = (before.match(/["“”]/g) || []).length;
    return marks % 2 === 1;
  };
  const hits = [];
  for (const dir of ['docs', '.']) {
    for (const f of fs.readdirSync(D(dir))) {
      if (!f.endsWith('.md') || f === 'CHANGELOG.md') continue;
      const rel = path.join(dir, f), p = D(rel);
      if (!fs.statSync(p).isFile()) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = ASSERTS.exec(lines[i]);
        if (!m) continue;
        if (isQuoted(lines, i, m)) continue;
        /* A wider window than rule 1's. A retraction is often a paragraph away from the sentence it
         * retracts, and the two false positives above were both just outside a +5 reach. */
        const ctx = lines.slice(Math.max(0, i - 8), i + 9).join(' ');
        if (QUALIFIED.test(ctx)) continue;
        hits.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 88)}`);
      }
    }
  }
  ok(hits.length === 0,
    'no document asserts a non-transitive metagame while the artifact records the cycle unsupported' +
    (hits.length ? ` — ${hits.length} place(s):\n         ` + hits.join('\n         ') : ''));
  if (hits.length) {
    console.log('         The shipped artifact rates its own best cycle UNSUPPORTED: it is the strongest of');
    console.log('         336 candidate triples and its legs rest on as few as 5 games. Either qualify the');
    console.log('         sentence, or regenerate the artifact and let it license the claim.');
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
nonTransitivityIsSupported();
versions();
console.log(`\nDOC CURRENCY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
