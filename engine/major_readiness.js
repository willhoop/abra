#!/usr/bin/env node
/* major_readiness.js — WOULD 6.0.0 BE HONEST TODAY, AND WHAT WOULD IT HAVE TO SAY?
 *
 *   node engine/major_readiness.js
 *
 * ============================ WHY THIS EXISTS, AND IT IS NOT CONVENIENCE ========================
 *
 * On the night of 2026-09-08/09 the scope of the 6.0.0 document pass was assembled BY HAND out of
 * five separate commands, three times, and TWO OF THE THREE were wrong in a way that would have
 * changed what somebody planned:
 *
 *   - `33 untraceable figures` was 33 only because a bibliography counted as unsourced claims. Ten
 *     were `arXiv:` and `DOI:` identifiers. Fixed at the lexer; the real number was 23.
 *   - `~13 figures in the living set` counted ONE of the three ways a figure needs attention at a
 *     major, and it was the smallest of the three. With the stale citations and the untraceable set
 *     it is roughly 85-90.
 *
 * Neither was carelessness, and calling it carelessness is how it repeats. Each count was CORRECT
 * about its own question. What did not exist was anything putting the three questions SIDE BY SIDE,
 * so the one being quoted was whichever had been run last. That is the shape of the fourteen stale
 * handoffs: state assembled by a person instead of printed.
 *
 * IT DERIVES, AND IT REUSES RATHER THAN RE-IMPLEMENTS. Every number comes from engine/docs_scan.js
 * and engine/quarantine.js through their exports. Nothing is counted twice in two places — CLAUDE.md:
 * two files that both decide a fact will disagree eventually, and the disagreement will be invisible
 * because both keep working.
 *
 * IT DECIDES NOTHING. It prints what a major would have to say, and whether the gate is open. Whether
 * to release, and whether a red clause is waived, is the owner's — never this file's and never the
 * coordinator's.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const DS = require(path.join(__dirname, 'docs_scan.js'));
const QU = require(path.join(__dirname, 'quarantine.js'));

/* The living set as CLAUDE.md names it for a major fold-in. The division ledgers owe currency but get
 * no PDF and no fold-in; RUNNING-NOTES and ROADMAP are declared residuals whose rows are FOLDED
 * rather than rewritten. Counting their figures as major workload overstates it, which is exactly the
 * mistake this file was written after. */
const LIVING_SET = ['docs/ABRA-whitepaper.md', 'docs/ABRA-deck-plain-english.md',
  'docs/ABRA-technical-docs.md', 'docs/SUMMARY.md', 'docs/MODELS.md'];

/* A GENERATOR THIS CANNOT READ IS A HOLE IN THE DERIVATION, AND IT IS NAMED RATHER THAN GUESSED.
 * The blocked-ness of such a row is UNKNOWN, not false, and treating unknown as false is how a paused
 * vector gets restamped. So it counts as BLOCKED — the safe side — AND the file is recorded, because
 * a fail-safe that says nothing is indistinguishable from a fail-safe that never fired. The same
 * reasoning `engine/format_id_scan.js` gives for its unreadable directories. */
const UNREADABLE = [];
function generatorSource(rel) {
  try { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }
  catch (e) {
    UNREADABLE.push(rel + ': ' + e.message.split('\n')[0]);
    return 'policy-weights.json /* unreadable — counted as blocked, and reported */';
  }
}

/* The MAG reservation, in one place. Will sequenced the refit AFTER 6.0.0 and data/policy-weights.json
 * must not be touched, so a generator that writes it, reads it, or is MILTANK cannot run at this
 * major. Broader than "is a MAG figure", and deliberately so: the conservative side is free, because
 * such an artifact stays withheld either way. */
function reachesPausedWeights(generatorRel) {
  if (!generatorRel) return false;
  const src = generatorSource(generatorRel);
  return /writeFileSync\([^)]*(policy-weights|policy_weights)/.test(src)
    || /policy-weights\.json/.test(src)
    || /miltank/i.test(generatorRel);
}

function main() {
  const L = [];
  const say = (s) => L.push(s === undefined ? '' : s);

  say('WOULD 6.0.0 BE HONEST TODAY — derived, nothing typed');
  say();

  /* ---- 1. the gate: the only thing that can authorise the basis change ------------------------- */
  let gate = null, gateErr = null;
  try { gate = QU.medichamIsCorrect(); } catch (e) { gateErr = e.message; }
  if (gateErr) {
    say('  GATE — could not be read: ' + gateErr);
  } else {
    const clauses = (gate && gate.clauses) || [];
    const failing = clauses.filter(c => !(c.pass === true || c.ok === true));
    say('  GATE  ' + (gate && (gate.correct || gate.ok) ? 'OPEN' : 'CLOSED')
      + '   ' + failing.length + ' of ' + clauses.length + ' clause(s) fail');
    for (const c of failing) say('        FAIL  ' + (c.name || c.clause || '(unnamed)'));
  }
  say();

  /* ---- 2. the three questions, SIDE BY SIDE, which is the whole point of this file ------------- */
  let hits = [], cm = [], un = { total: 0, per: {} };
  try { const qf = DS.quarantinedFigures(); hits = (qf && qf.hits) || []; } catch (e) { say('  (withheld-source scan failed: ' + e.message + ')'); }
  try { cm = DS.citationMismatches(DS.livingDocs()) || []; } catch (e) { say('  (citation scan failed: ' + e.message + ')'); }
  try { un = DS.untraceableCensus(DS.livingDocs()) || un; } catch (e) { say('  (untraceable scan failed: ' + e.message + ')'); }

  const inLiving = (d) => LIVING_SET.includes(d);
  const qL = hits.filter(h => inLiving(h.doc)).length;
  const cL = cm.filter(r => inLiving(r.doc)).length;
  const uL = Object.entries(un.per || {}).filter(([d]) => inLiving(d)).reduce((a, [, n]) => a + n, 0);

  say('  THE LIVING-DOCUMENT REWRITE — three different questions, which is why one count was never it');
  say('    ' + String(qL).padStart(4) + '  rest on a WITHHELD artifact  — cannot be fixed before the re-run');
  say('    ' + String(cL).padStart(4) + '  STALE CITATION               — the artifact moved out from under the sentence');
  say('    ' + String(uL).padStart(4) + '  UNTRACEABLE                  — no artifact behind it at all');
  say('    ' + String(qL + cL + uL).padStart(4) + '  figure-level edits across ' + LIVING_SET.length + ' documents (rows may overlap)');
  say();
  say('    whole corpus for contrast: ' + hits.length + ' withheld-source, ' + cm.length + ' stale-citation, '
    + un.total + ' untraceable —');
  say('    most of which sit in the ledgers and the declared residuals, folded in rather than rewritten.');
  say();

  /* ---- 3. what a re-run can and cannot bring back ---------------------------------------------- */
  say('  WHAT A RE-RUN CAN BRING BACK');
  try {
    /* `classify()` owns the withheld set and the generator per artifact; `withholder(gate, rows)`
     * wraps the same rows into a per-file lookup. Reading `rows` directly is the same source, not a
     * second one — the generator name is `r.by`, which is what quarantine.js prints as the re-run. */
    const c = QU.classify();
    const rows = (c && c.rows) ? [...c.rows.values()].filter(r => r.quarantined) : [];
    if (!rows.length) {
      say('    classify() reported no withheld artifacts — either the gate is open or the shape moved.');
      say('    Cross-check with: node engine/quarantine.js');
    } else {
      let lift = 0, stay = 0; const stayList = [];
      for (const a of rows) {
        const gen = String(a.by || '').replace(/^node\s+/, '').split(/\s+/)[0];
        if (reachesPausedWeights(gen)) { stay++; stayList.push('data/' + a.file + '  <- ' + (gen || '?')); }
        else lift++;
      }
      say('    ' + String(lift).padStart(4) + '  LIFT  — re-run and become quotable');
      say('    ' + String(stay).padStart(4) + '  STAY  — the generator reaches the paused MAG weights, or is MILTANK');
      /* NAMED, NOT JUST COUNTED. The release has to list these with a reason each, and a count alone
       * is what lets "the quarantine lifted" get said over the top of them. */
      for (const s of stayList) say('            ' + s);
      /* A COUNTER NOTHING READS IS NOT A COUNTER. */
      if (UNREADABLE.length) {
        say('    ' + UNREADABLE.length + ' generator(s) COULD NOT BE READ, so the split above is'
          + ' incomplete and they are counted as STAY (the safe side):');
        for (const u of UNREADABLE) say('            ' + u);
      }
    }
  } catch (e) {
    say('    could not derive the split here: ' + e.message);
    say('    fall back to: node engine/quarantine.js, then the filter in');
    say('    docs/_reports/2026-09-09-quarantine-rerun-plan.md');
  }
  say();

  /* ---- 4. the backlog, which BLOCKS rather than prompts ---------------------------------------- */
  try {
    const owed = DS.owedToNextMajor();
    if (owed && owed.missing) {
      say('  NOTES ROWS OWED — ' + owed.notes + ' is MISSING, which fails the gate on its own.');
      say();
    } else if (owed) {
      say('  NOTES ROWS OWED TO THE MAJOR   ' + owed.owed.length + ' of ' + owed.cap
        + (owed.over ? '   OVER CAP — the build FAILS until these fold in'
          : owed.warning ? '   approaching the cap' : ''));
      if (owed.documents_behind_last_major) {
        say('        AND a living document still trails the last major — the previous fold-in was skipped.');
      }
      say('        oldest owed row: ' + (owed.oldest_owed || 'none')
        + ' | documents last folded at ' + (owed.documented_at ? owed.documented_at.version : 'unknown')
        + ' | CHANGELOG top ' + owed.top);
      say();
    }
  } catch (e) { say('  (owed backlog could not be read: ' + e.message + ')'); say(); }

  /* ---- 5. the verdict, and it is about HONESTY rather than permission -------------------------- */
  const open = !gateErr && gate && (gate.correct || gate.ok);
  say('  VERDICT');
  if (!open) {
    say('    NOT READY. The gate is shut, so there is no basis change to release — 6.0.0 would be a');
    say('    major that moves nothing a reader depends on.');
    say('    A red clause is FIXED, or WAIVED BY WILL BY NAME. There is no third state, and this file');
    say('    does not provide one.');
  } else {
    say('    THE GATE IS OPEN, so a major is available — and it is a PARTIAL lift. It must say which');
    say('    figures came back and which did not, with a reason per artifact. Announcing "the');
    say('    quarantine lifted" while any artifact is still withheld is the PRE-CHANGE caption in a');
    say('    new costume, and this repository has paid for that twice.');
  }

  console.log(L.join('\n'));
}

module.exports = { LIVING_SET, reachesPausedWeights, main };
if (require.main === module) main();
