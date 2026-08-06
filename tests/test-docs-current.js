/* test-docs-current.js — enforce the documentation rules nothing was enforcing.
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
 * WHY IT WAS REWRITTEN, 2026-08-05
 * --------------------------------
 * The version rule guarded a HAND-TYPED LIST OF FIVE FILENAMES. docs/ holds 85 markdown files, so
 * eighty of them were unwatched BY CONSTRUCTION — and the five that were watched passed the
 * version-header check while carrying wrong numbers underneath it. Both halves are the same defect:
 * the check knew the NAME of a document and nothing about its CONTENT. Measured the night it was
 * replaced, all three live:
 *
 *   - docs/ABRA-deck-plain-english.md:186 stated a 63% exploitability figure that
 *     docs/ABRA-whitepaper.md:524 RETRACTS. Both files were on the watched list. Both passed.
 *   - "899 of 899" interaction-matrix agreement stood in four documents, three of which cite
 *     data/interaction-matrix.json by name for it. That file reads live 1012, agree 1011, part 1.
 *   - the damage tolerance was "31 scenarios" in the white paper, SUMMARY, MODELS and four more,
 *     against data/damage-validation.json's 36.
 *
 * So the surface is DERIVED now (engine/docs_scan.js), on the same principle as engine/provenance.js
 * deriving the artifact graph from source instead of carrying a list of it. Three rules, all of them
 * Will's wording of 2026-08-05:
 *
 *   1. any docs/*.md carrying a version header must match the CHANGELOG top version;
 *   2. any docs/*.md WITHOUT one must be declared in data/docs-currency-baseline.json,
 *      and THAT LIST MAY ONLY SHRINK — the repo's R5 ratchet applied to documents;
 *   3. a number in a living document must be generated, or cite an artifact, or be deleted.
 *      Rule 3 REPORTS. It deletes nothing and it fixes nothing.
 *
 * AND THE ARCHIVE IS NOT A LAUNDRY. The previous version skipped docs/archive/ outright (line 89),
 * so `git mv docs/X.md docs/archive/` removed a document from every content rule silently. An
 * archived file is exempt only if it declares itself SUPERSEDED and names the file that replaced it;
 * everything else in the archive is scanned exactly as if it were still live.
 *
 *   node tests/test-docs-current.js
 *   node tests/test-docs-current.js --update    rebuild the baseline (REMOVALS ONLY — see ratchet())
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('../engine/docs_scan.js');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

const BASELINE = D('data', 'docs-currency-baseline.json');
const UPDATE = process.argv.includes('--update');

/* ---- 1. RETRACTED NUMBERS MUST NOT REAPPEAR AS FACT ------------------------------------------
 * The registry is the point. A number that was withdrawn goes in here with what replaced it, and
 * the build fails if it shows up anywhere without its retraction alongside. Add to this list every
 * time a figure is withdrawn — that is the whole mechanism.
 *
 * This list is hand-maintained and stays that way ON PURPOSE: it records a figure withdrawn by a
 * DECISION, which no scan can infer. Rule 3b below derives a SECOND registry from the documents
 * themselves, for the case this one cannot cover — a figure whose retraction was written down in one
 * document and never propagated to the others. The two are complementary, not redundant. */
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

  /* ---- added 2026-08-06. WILL: "THE 10 POINT LOSS WAS BASED ON A BOGUS ENGINE YOU KEEP QUOTING
   * THINGS THAT ARE UNRELIABLE." He is right, and the failure is not that the numbers are stale —
   * it is that NOTHING STOPPED THEM BEING QUOTED. Task #57 established the rule this same day and I
   * then quoted six rollout-derived figures at him within the hour, because a task is a note and
   * this list is a mechanism.
   *
   * WHAT MAKES THEM SUSPECT. Every figure below came out of a medicham2 PLAYOUT, and on 2026-08-06
   * five WIREs landed in that engine: the weather resolved BACKWARDS from turn one so every damage
   * roll after it carried the wrong multiplier (123); 78 moves could not miss (124); Last Respects
   * reverted to 50 BP the turn after an ally died (125); a type-converted move was priced 136-162
   * and dealt 0 (126); and every Scrappy Normal-or-Fighting click into a Ghost dealt zero in every
   * rollout this engine has ever run (128).
   *
   * AND THEY CANNOT SAY WHICH ENGINE THEY MEASURED. Eight of the ten rollout-derived artifacts carry
   * NO engine_release stamp at all — rollout-r1, rollout-r3, winrate-backtest, ladder,
   * leaf-comparison, exploitability among them. So they are not merely from a broken era; they are
   * UNATTRIBUTABLE, and no amount of care in prose can fix an artifact that does not record what it
   * read. Making the stamp mandatory is #33; retracting the figures is this.
   *
   * THIS IS NOT A CLAIM THAT EACH IS WRONG. A paired comparison can survive a symmetric engine
   * error — WIRE 123 hit both arms of R4 equally — while an absolute rate cannot. Establishing which
   * is #57. Until that runs, each figure may be discussed WITH its retraction beside it and may not
   * be stated as fact, which is exactly what `allowIfNear` encodes. */

  { bad: /\b10-point (?:switching )?loss\b|switching (?:cost|lost|loses) (?:it )?10 points/i,
    what: "the 10-point loss from voluntary switching (mew.js:135)",
    why: 'measured through medicham2 playouts on an engine that predates WIRES 123-128, and the ' +
         'artifact carries no engine_release stamp so it cannot say which build it ran on. It is ' +
         'ALSO confounded by design: bringIn() selects live(bench)[0], the first healthy body, and ' +
         'its own comment calls that "a real limitation, not a detail" — so the experiment measured ' +
         'switching to an ARBITRARY Pokemon, which the engine itself distinguishes from a switch: ' +
         '"a search that cannot say WHO it is bringing in is not evaluating a switch, it is ' +
         'evaluating LEAVE". Will, 2026-08-06, gives the case it cannot represent: out-sped, lethal ' +
         'hit incoming, a resist on the bench. See #63.',
    allowIfNear: /retract|unattributable|no engine_release|bogus|predates|WIRE|#63|#57|confound|live\(bench\)/i },

  { bad: /\b51\.0%\b/, what: "the in-game leaf naming the winner on 51.0% of decisive calls",
    why: 'a rollout figure from data/winrate-backtest.json, which carries NO engine_release stamp ' +
         'and predates WIRES 123-128. Its own interval [48.3, 53.7] already contains 50, so the ' +
         'qualitative reading — indistinguishable from a coin — survives; the POINT ESTIMATE does ' +
         'not. See #57.',
    allowIfNear: /retract|unattributable|no engine_release|predates|WIRE|#57|CI|interval|\[48\.3/i },

  { bad: /\b31\.6%\b/, what: 'R6\'s 31.6% of move decisions deferred',
    why: 'a rollout figure measured before WIRES 123-128 and with no engine_release stamp. The ' +
         'QUALITATIVE finding — that defer fires for two different reasons and only one is fixable ' +
         'with compute — does not depend on the number, and #62 is the experiment that replaces it.',
    allowIfNear: /retract|unattributable|no engine_release|predates|WIRE|#57|#62/i },

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

/** The documents rule 1 applies to: every live document, plus every archived one that has NOT
 *  declared itself superseded. Moving a file into docs/archive/ used to remove it from this scan. */
function scannedDocs() {
  const arch = S.archiveState().filter(a => !(a.superseded && a.replacementExists)).map(a => a.doc);
  return [...S.liveDocs(), ...arch];
}

function scanDocs() {
  console.log('== 1. retracted numbers must not be stated as fact ==');
  /* CHANGELOG.md is EXEMPT, and deliberately so. It is the historical record: a retracted figure
   * must remain in the entry that published it and in the entry that withdrew it, or the retraction
   * itself becomes unreadable. The rule applies to documents that assert CURRENT fact.
   * docs/archive/ is NO LONGER exempt by location — see scannedDocs(). */
  const files = scannedDocs();
  for (const r of RETRACTED) {
    const hits = [];
    for (const rel of files) {
      /* Check a WINDOW, not the line. A properly-written retraction usually quotes the old figure on
       * one line and marks it withdrawn on another — matching line-by-line flagged exactly that and
       * would have punished the correct behaviour. */
      const lines = S.readDoc(rel).split('\n');
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
  console.log(`         (scanned ${files.length} documents, archive included)`);
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
  const FILE = D('data', 'slowking-playstyle-eval.json');
  if (!fs.existsSync(FILE)) { ok(false, 'data/slowking-playstyle-eval.json exists to check claims against'); return; }
  const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
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
  for (const rel of scannedDocs()) {
    const lines = S.readDoc(rel).split('\n');
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
  ok(hits.length === 0,
    'no document asserts a non-transitive metagame while the artifact records the cycle unsupported' +
    (hits.length ? ` — ${hits.length} place(s):\n         ` + hits.join('\n         ') : ''));
  if (hits.length) {
    console.log('         The shipped artifact rates its own best cycle UNSUPPORTED: it is the strongest of');
    console.log('         336 candidate triples and its legs rest on as few as 5 games. Either qualify the');
    console.log('         sentence, or regenerate the artifact and let it license the claim.');
  }
}

/* ---- THE RATCHET ------------------------------------------------------------------------------
 *
 * Every list below is a BASELINE OF WHAT EXISTS, and it may only shrink. This is the shape
 * docs/ARTIFACT-ACCESS-RULES.md already prescribes ("baseline what exists; fail only on what is
 * new") and the shape data/provenance-stamp.json already uses for the mtime count.
 *
 * A NEW entry FAILS. It is either a real regression or a deliberate exemption somebody must type
 * into the baseline by hand, with a reason, in a diff a reviewer can see.
 *
 * A RETIRED entry TIGHTENS THE BASELINE ON THE SPOT. Removing an entry can only make the check
 * stricter, so it needs no approval and — more importantly — it means fixing a document never
 * produces a red test. A ratchet that punishes the person doing the right thing is a ratchet that
 * gets switched off, which is the exact history CLAUDE.md records for this file. */
function ratchet(name, current, baseline, describe) {
  const cur = new Set(current), base = new Set(baseline);
  const added = [...cur].filter(x => !base.has(x));
  const retired = [...base].filter(x => !cur.has(x));
  ok(added.length === 0 || UPDATE,
    `${name}: no new entries (baseline ${base.size}, now ${cur.size})` +
    (added.length ? `\n         NEW:\n         ` + added.slice(0, 12).map(describe || (x => x)).join('\n         ') +
      (added.length > 12 ? `\n         ... and ${added.length - 12} more` : '') : ''));
  if (retired.length) console.log(`         ratchet tightened: ${retired.length} entr${retired.length === 1 ? 'y' : 'ies'} retired`);
  /* --update is the BOOTSTRAP and nothing else: it is how the first baseline is written, and how a
   * human deliberately adopts a state after reading it. Without it the list can only lose members. */
  return { added, retired, next: (added.length && !UPDATE) ? [...base] : [...cur] };
}

/* ---- 2. THE VERSION RULE, DERIVED --------------------------------------------------------------
 * CLAUDE.md: "Any change to a model, a result, or the site updates ALL of the following in the SAME
 * pass ... plus a CHANGELOG entry and a version bump." The old check knew five filenames. This one
 * asks every markdown file whether it carries a version header, which is the document declaring
 * itself current — a property of the file, not of a list. */
function versionRule(base, next) {
  console.log('\n== 2. every version-headed doc tracks the CHANGELOG ==');
  const top = S.changelogTop();
  ok(!!top, `CHANGELOG has a top version (${top || 'none found'})`);
  if (!top) return;

  const living = S.livingDocs();
  const pins = base.version_pins || {};
  const stale = [], movedPins = [], nowCurrent = [];
  const nextPins = {};
  for (const rel of living) {
    const v = S.versionHeader(S.readDoc(rel)).version;
    if (v === top) { if (pins[rel]) nowCurrent.push(rel); continue; }
    if (!pins[rel]) {
      stale.push(`${rel} @ ${v}`);
      if (UPDATE) nextPins[rel] = { version: v, reason: 'ADOPTED AT BASELINE — give this a real reason or bring the document current' };
      continue;
    }
    /* A PIN IS A VERSION, NOT A LICENCE. If a pinned document's header MOVES and still does not
     * equal the CHANGELOG top, somebody edited it in a pass that skipped the changelog — which is
     * the original 3.3.0-vs-2.6.0 failure wearing a different number. */
    if (pins[rel].version !== v) { movedPins.push(`${rel}: pinned at ${pins[rel].version}, now ${v}, top is ${top}`); continue; }
    nextPins[rel] = pins[rel];
  }
  ok(stale.length === 0 || UPDATE,
    `every version-headed document is at ${top} or is a declared pin (${living.length} versioned, ${Object.keys(pins).length} pinned)` +
    (stale.length ? ` — undeclared and stale:\n         ` + stale.join('\n         ') : ''));
  ok(movedPins.length === 0,
    'no pinned document moved to a version that is neither its pin nor the CHANGELOG top' +
    (movedPins.length ? `:\n         ` + movedPins.join('\n         ') : ''));
  if (stale.length) {
    console.log('         CLAUDE.md requires these to move in the SAME pass as the code.');
    console.log('         Bumping the header alone is NOT the fix — the content has to be brought current,');
    console.log('         or the version becomes another asserted number.');
  }
  for (const rel of nowCurrent) console.log(`         pin retired (now at ${top}): ${rel}`);
  /* Pins for documents that are current, gone, or no longer version-headed drop out automatically. */
  next.version_pins = nextPins;

  console.log('\n== 2b. every document WITHOUT a version header is declared, and that list may only shrink ==');
  const unversioned = S.liveDocs().filter(d => !S.versionHeader(S.readDoc(d)));
  const r = ratchet('undeclared unversioned documents', unversioned, base.unversioned_exempt || [],
    x => `${x}  (no version header, not in data/docs-currency-baseline.json)`);
  next.unversioned_exempt = r.next.sort();
  if (r.added.length) {
    console.log('         Give the document a version header matching the CHANGELOG, or add it to');
    console.log('         `unversioned_exempt` in data/docs-currency-baseline.json with a reason.');
  }
}

/* ---- 3. THE ARCHIVE IS NOT A LAUNDRY -----------------------------------------------------------
 * The previous version of this file skipped docs/archive/, so archiving a document silently
 * exempted it from every content rule. Files are being archived this week, which makes that a live
 * route and not a hypothetical one. */
function archiveRule(base, next) {
  console.log('\n== 3. an archived document declares what superseded it, or it is still scanned ==');
  const state = S.archiveState();
  const grandfathered = new Set(base.archive_grandfathered || []);
  const undeclared = state.filter(a => !a.superseded).map(a => a.doc);
  const broken = state.filter(a => a.superseded && !a.replacementExists)
    .map(a => `${a.doc} -> ${a.replacement} (does not exist)`);

  const r = ratchet('archived documents with no SUPERSEDED header', undeclared, [...grandfathered],
    x => `${x}  — add:  > **SUPERSEDED** by \`docs/NEW-FILE.md\``);
  next.archive_grandfathered = r.next.sort();
  ok(broken.length === 0,
    'every SUPERSEDED header names a file that exists' + (broken.length ? `:\n         ` + broken.join('\n         ') : ''));
  console.log(`         ${state.length} archived documents; ${state.length - undeclared.length} declare a replacement;`);
  console.log(`         ${undeclared.length} are grandfathered and are STILL SCANNED by rules 1, 1b and 3b.`);
  if (r.added.length) {
    console.log('         A document moved into docs/archive/ leaves the currency rules ONLY by declaring');
    console.log('         what replaced it. Without that header it is scanned exactly as if it were live.');
  }
}

/* ---- 3c. THE ARCHIVE INDEX IS GENERATED, AND IT IS CURRENT -------------------------------------
 *
 * docs/archive/INDEX.md is the table of contents over the provenance record — what each archived
 * document claimed, when, what replaced it, and which of its figures are retracted. A HAND-TYPED
 * INDEX ROTS EXACTLY LIKE THE DOCUMENTS IT POINTS AT: that is the whole lesson of docs/HANDOFF-*.md,
 * each typed at the end of a session and stale within a day.
 *
 * This SHELLS OUT to the generator rather than re-deriving the index here, the same way status.js
 * shells out to provenance.js and provenance.js derives the artifact graph from source. A second
 * implementation of a thing that already exists is how buildMon("Scizor") came to return null. */
function archiveIndexRule() {
  console.log('\n== 3c. docs/archive/INDEX.md is generated and current ==');
  const gen = D('build', 'build_archive_index.js');
  if (!fs.existsSync(gen)) { ok(false, 'build/build_archive_index.js exists'); return; }
  let out = '', code = 0, errIndexGen = null;
  try {
    out = require('child_process').execFileSync(process.execPath, [gen, '--check'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  /* STASHED FOR A LATER ASSERTION, which is why the failure is kept in a named variable rather than
   * only folded into `code`. A non-zero exit IS the finding — the generator reports a stale index on
   * stdout and this asserts on it below. But a generator that DIES (a syntax error, a missing
   * require) exits non-zero with nothing on stdout, and that used to print an empty failure: red,
   * with no reason. Keeping the error means the reason is always available. */
  } catch (e) {
    errIndexGen = e;
    code = e.status || 1;
    out = String(e.stdout || '') + String(e.stderr || '');
  }
  ok(code === 0, 'the archive index matches the headers in docs/archive/ — run: node build/build_archive_index.js');
  if (code !== 0 && !out.trim() && errIndexGen) {
    console.log('         the generator produced no output at all: ' + String(errIndexGen.message || errIndexGen).split('\n')[0]);
  }
  for (const L of out.trim().split('\n')) if (L.trim()) console.log('         ' + L.trim());
}

/* ---- 3b. A NUMBER IN A LIVING DOCUMENT IS GENERATED, CITES AN ARTIFACT, OR IS DELETED -----------
 *
 * Three measurements, in decreasing confidence. NONE of them edits a document; rule 3 reports.
 *
 *   (a) DERIVED RETRACTION. If one document writes that a figure is retracted, that IS a registry —
 *       no second hand-typed list needed. The deck's 63% was retracted IN WRITING by the white paper
 *       on the same day and neither file's version header could see it.
 *   (b) CITED-ARTIFACT MISMATCH. A block that names `data/x.json` and states a figure x.json does
 *       not contain. This is the strongest form of untraceable: the document told you where to
 *       check, and the file says something else.
 *   (c) THE CENSUS. Figures matching no number in any data/*.json artifact at all. A figure can be
 *       legitimately derived (a ratio, a difference), so this is a pressure gauge and not a verdict.
 */
function figureRules(base, next) {
  const living = S.livingDocs();
  const known = base.known || {};

  console.log('\n== 3b(a). a figure another document retracts is not restated as fact ==');
  const reg = S.retractionRegistry(scannedDocs());
  const viol = S.retractionViolations(scannedDocs(), reg);
  console.log(`         derived registry: ${[...reg.values()].filter(e => e.strength === 'strong').length} figures ` +
    `retracted in writing (${[...reg.values()].filter(e => e.strength === 'strong').map(e => e.value + (e.pct ? '%' : '')).join(', ')})`);
  const vkey = h => `${h.doc}|${h.figure}|${h.retracted}`;
  const vseen = new Map(viol.map(h => [vkey(h), h]));
  const rv = ratchet('retracted figures restated as fact', [...vseen.keys()], known.retraction_violations || [],
    k => { const h = vseen.get(k); return `${h.doc}:${h.line}  states ${h.figure} — retracted by ${h.by.join(', ')}\n           ${h.text}`; });
  for (const h of viol) console.log(`         [known] ${h.doc}:${h.line}  ${h.figure}  (retracted by ${h.by[0]})`);

  console.log('\n== 3b(b). a figure attributed to an artifact is IN that artifact ==');
  const mism = S.citationMismatches(living);
  const mkey = h => `${h.doc}|${h.figure}|${h.cites.join(',')}`;
  const mseen = new Map(mism.map(h => [mkey(h), h]));
  const rm = ratchet('figures a cited artifact does not contain', [...mseen.keys()], known.citation_mismatches || [],
    k => { const h = mseen.get(k); return `${h.doc}:${h.line}  ${h.figure}  not in ${h.cites.join(', ')}\n           ${h.text}`; });
  const byDoc = {};
  for (const h of mism) byDoc[h.doc] = (byDoc[h.doc] || 0) + 1;
  for (const [d, n] of Object.entries(byDoc).sort((a, b) => b[1] - a[1])) console.log(`         ${String(n).padStart(4)}  ${d}`);

  console.log('\n== 3b(c). census: figures with no artifact behind them anywhere ==');
  const census = S.untraceableCensus(living);
  const baseCensus = known.untraceable_by_doc || {};
  const worse = [];
  for (const [d, n] of Object.entries(census.per)) {
    const was = baseCensus[d];
    if (was === undefined) worse.push(`${d}: ${n} untraceable figures (document was not in the baseline)`);
    else if (n > was) worse.push(`${d}: ${n} untraceable figures, was ${was}`);
  }
  ok(worse.length === 0 || UPDATE,
    `no living document gained untraceable figures (${census.total} across ${Object.keys(census.per).length} documents)` +
    (worse.length ? `:\n         ` + worse.join('\n         ') : ''));
  for (const [d, n] of Object.entries(census.per).sort((a, b) => b[1] - a[1])) {
    const was = baseCensus[d];
    console.log(`         ${String(n).padStart(4)}  ${d}${was !== undefined && n < was ? `   (was ${was})` : ''}`);
  }
  /* NAME THE FIGURES IN THE DOCUMENTS THAT GREW. Printing only "33, was 31" left the two to be found
   * by hand, and this file's own history says what happens to a check that costs more to act on than
   * to ignore: it gets reported as a known failure. Only the offending documents are expanded. */
  for (const line of worse) {
    const d = line.split(':')[0];
    for (const w of (census.where && census.where[d] ? census.where[d] : []).slice(0, 12))
      console.log(`           ${d}  ${String(w.value).padStart(9)}   ${w.text}`);
  }
  console.log('         Report only. A figure here is generated, cites an artifact, or is deleted —');
  console.log('         this check says which ones are none of the three. It removes nothing.');

  const nextCensus = {};
  for (const [d, n] of Object.entries(census.per)) {
    const was = baseCensus[d];
    nextCensus[d] = (was === undefined || UPDATE) ? n : Math.min(n, was);
  }
  next.known = {
    retraction_violations: rv.next.sort(),
    citation_mismatches: rm.next.sort(),
    untraceable_by_doc: Object.fromEntries(Object.entries(nextCensus).sort()),
  };
}

/* ---- run -------------------------------------------------------------------------------------- */
const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const next = {
  generated: new Date().toISOString(),
  by: 'tests/test-docs-current.js',
  rule: 'A RATCHET. Every list here is a baseline of what existed when it was written, and it may ' +
        'only shrink. A new entry fails the build; a retired entry is dropped automatically, because ' +
        'removing one can only make the check stricter. Adding an entry is a hand edit with a reason.',
  changelog_top_at_baseline: S.changelogTop(),
};

scanDocs();
nonTransitivityIsSupported();
versionRule(base, next);
archiveRule(base, next);
archiveIndexRule();
figureRules(base, next);

/* The baseline tightens on every green run and never loosens itself. If anything failed, the file is
 * left exactly as it was: a run that found a regression must not record the regression as normal. */
if (F === 0 || UPDATE) {
  /* base first so hand-written keys — the note_* explanations, any reason a person added — survive a
   * rewrite; next second so every DERIVED key is replaced by what was just measured. A generated file
   * that eats the prose explaining it is how a baseline turns back into an unexplained list. */
  const merged = { ...base, ...next };
  const before = fs.existsSync(BASELINE) ? fs.readFileSync(BASELINE, 'utf8') : '';
  const after = JSON.stringify(merged, null, 2) + '\n';
  const strip = s => s.replace(/"generated":\s*"[^"]*",?\n/, '');
  if (strip(before) !== strip(after)) {
    fs.writeFileSync(BASELINE, after);
    console.log(`\n(baseline tightened: ${path.relative(ROOT, BASELINE)})`);
  }
}

console.log(`\nDOC CURRENCY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
