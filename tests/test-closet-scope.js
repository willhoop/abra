/* IS THE CLOSET ONE DECISION, OR THREE INSTRUMENTS EACH REMEMBERING IT DIFFERENTLY?
 *
 *   node tests/test-closet-scope.js
 *
 * ROADMAP #291. Will shelved seven entities BY NAME — copycat, battlebond, stall, pickup, metronome,
 * anticipation, forewarn — each with his own quote and date, and `tests/roster.js` states the whole
 * contract in its header: *"A row in here is still staged, still played against the authority, and
 * still printed on every run with its reason and its date. The only thing it stops doing is holding
 * the MEDICHAM gate shut."* Separately he shelved ILLUSION (ROADMAP #160): *"we banned zoroark
 * remember for 5. its too confusing for our simple engine."*
 *
 * THREE INSTRUMENTS READ A SHELF AND THEY DID NOT AGREE.
 *
 *   tests/roster.js            declares DEFERRED and honours it
 *   engine/quarantine.js       prints it and its three deliberate-roster clauses honour it
 *   engine/game_differential.js declares the ILLUSION shelf and drops whole teams carrying a carrier
 *   engine/all_mechanics_fire.js honoured NEITHER
 *
 * Measured 2026-08-17, before this file existed: `abilities:forewarn` and `items:metronome` sat
 * inside the mechanics clause's failing count of 53 — and metronome was the ONLY item in it, so the
 * item clause read 1 where the honest answer is 0. `bittermalice` (Zoroark-Hisui) and `nightdaze`
 * (Zoroark) sat in the moves count, the only two rows in the whole population whose carrier holds
 * Illusion, and BOTH diverge with `switch: a different body` — which is Illusion announcing the body
 * under another name and not a defect in either move.
 *
 * WHY IT IS A TEST AND NOT A FIX. A shelf that is applied in one place and remembered in another is
 * the ban-list-of-four failure this repo has a standing rule about. The point of this file is that
 * the three readers can never drift apart again without something going red.
 *
 * IT ASSERTS A CONTROL, NOT JUST A SUBTRACTION. A rule that shelved EVERYTHING would make the gate
 * green and satisfy every arithmetic claim below, so the third check is that diverging rows survive
 * the shelf — the count must fall, and it must not fall to zero for a reason nobody chose.
 *
 * SHOWN RED ON A DELIBERATE BREAK: revert `shelvedRow` in engine/all_mechanics_fire.js to
 * `() => null` and re-run the mechanics pass, and checks 3, 4 and 5 fail by name.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

let bad = 0;
const ok = (cond, name, detail) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + name + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n  THE CLOSET — one decision, read by every instrument that has to honour it\n');

/* ---- 1. THE NAMED SHELF IS DECLARED EXACTLY ONCE ------------------------------------------------ */
const DEFERRED = require(D('tests', 'roster.js')).DEFERRED;
const names = Object.keys(DEFERRED || {});
ok(names.length > 0, 'tests/roster.js exports DEFERRED — the ONE declaration',
   names.length + ' shelved by name: ' + names.join(', '));
ok(names.every(k => DEFERRED[k] && DEFERRED[k].by && DEFERRED[k].on && DEFERRED[k].why),
   'every named row carries who shelved it, when, and why',
   'a shelf entry without an owner and a date is an instrument judgement wearing the owner’s coat');

/* ---- 2. THE ILLUSION SHELF IS DERIVED FROM THE ABILITY, NOT FROM A NAME LIST --------------------- */
let GD = null, illusion = null;
try { GD = require(D('engine', 'game_differential.js')); } catch (e) { /* needs SHOWDOWN_PATH */ }
if (!GD) {
  console.log('  SKIP  the Illusion half needs the Showdown checkout (SHOWDOWN_PATH). NOT a pass.');
  bad++;
} else {
  illusion = GD.CLOSET_SPECIES;
  ok(illusion instanceof Set && illusion.size > 0,
     'game_differential.js exports CLOSET_SPECIES, derived from ability `' + GD.CLOSET_ABILITY + '`',
     illusion ? [...illusion].sort().join(', ') : '(absent)');
}

/* ---- 3..5. DOES THE MECHANICS RUNNER HONOUR BOTH? ------------------------------------------------ */
const AMF = D('data', 'all-mechanics-fire.json');
let art = null;
try { art = JSON.parse(fs.readFileSync(AMF, 'utf8')); } catch (e) { /* absent */ }
if (!art) {
  console.log('  FAIL  data/all-mechanics-fire.json is absent — a claim that cannot be computed FAILS.');
  console.log('        SHOWDOWN_PATH=... node engine/all_mechanics_fire.js --kind all --write');
  bad++;
} else {
  const KINDS = ['moves', 'abilities', 'items'];
  const rowsOf = (k) => (art.rows && art.rows[k]) || [];
  const sid = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  /* 3. every row the owner shelved BY NAME carries the shelf */
  const missedName = [];
  for (const k of KINDS) for (const r of rowsOf(k)) {
    if (DEFERRED[r.id] && !r.deferred) missedName.push(k + ':' + r.id);
  }
  ok(missedName.length === 0,
     'every NAMED shelf row in the artifact is marked `deferred`',
     missedName.length ? 'unmarked: ' + missedName.join(', ')
                       : KINDS.map(k => k + ' ' + rowsOf(k).filter(r => DEFERRED[r.id]).length).join(', ')
                         + ' named rows present and marked');

  /* 4. every row whose CARRIER holds Illusion carries the shelf */
  if (illusion) {
    const carriers = [];
    const missedIll = [];
    for (const k of KINDS) for (const r of rowsOf(k)) {
      if (!illusion.has(sid(r.carrier))) continue;
      carriers.push(k + ':' + r.id + ' (' + r.carrier + ')');
      if (!r.deferred) missedIll.push(k + ':' + r.id);
    }
    ok(missedIll.length === 0,
       'every row staged on an ILLUSION carrier is marked `deferred` — the differential’s own shelf',
       missedIll.length ? 'unmarked: ' + missedIll.join(', ')
                        : (carriers.length ? carriers.join(', ') : 'no Illusion carrier is staged'));
  }

  /* 5. THE ARITHMETIC, and it is where a silent shelf would show */
  for (const k of KINDS) {
    const s = (art.summary || {})[k];
    if (!s) continue;
    const rows = rowsOf(k);
    const divAll = rows.filter(r => r.diverged).length;
    const divShelved = rows.filter(r => r.diverged && r.deferred).length;
    ok(s.diverged === divAll - divShelved
       && s.diverged_including_shelved === divAll
       && s.shelved_by_owner === rows.filter(r => r.deferred).length
       && s.shelved_by_owner_diverging === divShelved,
       'summary.' + k + ' subtracts the shelf and PUBLISHES both numbers',
       'gate ' + s.diverged + ', including shelved ' + s.diverged_including_shelved
       + ', shelf covers ' + s.shelved_by_owner + ' row(s) of which '
       + s.shelved_by_owner_diverging + ' diverge  (rows say ' + divAll + ' diverged, '
       + divShelved + ' of them shelved)');
  }

  /* THE CONTROL. A shelf that swallowed everything would satisfy all of the above. */
  const totalRows = KINDS.reduce((n, k) => n + rowsOf(k).length, 0);
  const totalShelved = KINDS.reduce((n, k) => n + rowsOf(k).filter(r => r.deferred).length, 0);
  ok(totalShelved > 0 && totalShelved < totalRows * 0.05,
     'CONTROL — the shelf is small and specific, not a blanket',
     totalShelved + ' of ' + totalRows + ' rows shelved ('
     + (100 * totalShelved / Math.max(1, totalRows)).toFixed(2) + '%)');
  const gateN = KINDS.reduce((n, k) => n + (+(((art.summary || {})[k] || {}).diverged) || 0), 0);
  const allN = KINDS.reduce((n, k) => n + (+(((art.summary || {})[k] || {}).diverged_including_shelved) || 0), 0);
  console.log('\n  MECHANICS CLAUSE: ' + gateN + ' disagree with the authority  ('
            + allN + ' including the ' + (allN - gateN) + ' the owner shelved)');
}

/* ---- 6. THE FOURTH READER: THE ROSTER'S OWN ROWS ------------------------------------------------
 *
 * The header above named three readers and there are four. `tests/roster.js` DECLARES `DEFERRED` and
 * honours it by NAME — and it never honoured the ILLUSION shelf at all, because that shelf is decided
 * by the CARRIER and the roster had no carrier field to decide it with.
 *
 * WHAT THAT COST, MEASURED 2026-08-25 BEFORE THIS CHECK EXISTED: `abilities:illusion` was staged on
 * Zoroark and graded **FIRED-AND-BOARDS-MATCH** — a green vote, inside the ability stage's `130 of 202
 * tested`, for a mechanic `engine/medicham2-browser.js` does not implement at all (its only mention of
 * the word is the sentence *"this engine models no Illusion"*). It is not a divergence being hidden;
 * it is the opposite and worse — a PASS being manufactured for an unwritten mechanic, which is exactly
 * the "a green test can be asking nothing" failure this repo has a standing rule about.
 *
 * THE ROSTER AND THE MECHANICS RUNNER WERE THEREFORE SAYING OPPOSITE THINGS ABOUT ONE BODY: the runner
 * shelved every Zoroark row (`bittermalice`, `nightdaze`) and the roster passed one.
 *
 * IT IS ASSERTED ON THE ARTIFACT, NOT ON THE SOURCE, so it fails on what the instrument actually
 * PUBLISHED rather than on whether a line of code is present. */
{
  const STAGES = ['items', 'abilities', 'moves'];
  const sid = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rows = [];
  let missingArtifact = null;
  for (const s of STAGES) {
    const p = D('data', 'roster.' + s + '.json');
    let a = null;
    /* THE REASON IS CARRIED, NOT DISCARDED. Absent and MALFORMED are different failures with the
     * same remedy-looking symptom: a torn artifact half-written by a live roster run parses as a
     * SyntaxError, and reporting it as "absent" would send the next reader to re-run a stage that
     * already ran. `e.message` distinguishes them and reaches the failing assertion below. */
    try { a = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { missingArtifact = 'data/roster.' + s + '.json (' + e.message + ')'; break; }
    for (const r of (a.results || [])) rows.push({ ...r, stage: s });
  }
  if (missingArtifact) {
    ok(false, 'the roster artifacts are readable',
       missingArtifact + ' is absent — a claim that cannot be computed FAILS. '
       + 'SHOWDOWN_PATH=... node tests/roster.js --stage <s> --write');
  } else if (!illusion) {
    ok(false, 'the roster half needs CLOSET_SPECIES', 'the Showdown checkout was not readable above');
  } else {
    /* THE RECEIPT MUST BE COMPLETE WHEREVER A BODY WAS STAGED. A carrier-less row is a row the closet
     * is BLIND to, so it may only ever be a row that never staged a body — which is COULD-NOT-STAGE
     * and nothing else. Without this, adding a carrier field and forgetting to fill it in on one rule
     * would silently re-open the hole while every count above stayed green. */
    const blind = rows.filter(r => !r.carrier && r.verdict !== 'COULD-NOT-STAGE');
    ok(blind.length === 0,
       'every roster row that STAGED a body names its carrier — the closet has no blind spot',
       blind.length ? 'carrier-less and not COULD-NOT-STAGE: '
                        + blind.map(r => r.stage + ':' + r.id + ' [' + r.verdict + ']').join(', ')
                    : rows.filter(r => r.carrier).length + ' of ' + rows.length
                        + ' rows carry one; the other ' + rows.filter(r => !r.carrier).length
                        + ' are COULD-NOT-STAGE, so no body was staged to be blind about');

    const hit = rows.filter(r => illusion.has(sid(r.carrier)));
    const unshelved = hit.filter(r => r.verdict !== 'DEFERRED-BY-OWNER');
    ok(unshelved.length === 0,
       'every ROSTER row staged on an ILLUSION carrier is DEFERRED-BY-OWNER',
       unshelved.length
         ? 'counted, not shelved: ' + unshelved.map(r => r.stage + ':' + r.id + ' ('
             + r.carrier + ') = ' + r.verdict).join(', ')
         : hit.map(r => r.stage + ':' + r.id + ' (' + r.carrier + ')').join(', '));

    /* THE CONTROL, and it is the one that matters here: a shelf that matched NOTHING would satisfy
     * the check above forever while asking nothing at all. */
    ok(hit.length > 0,
       'CONTROL — the roster actually stages an Illusion carrier, so the check above is not vacuous',
       hit.length + ' of ' + rows.length + ' rows ('
       + (100 * hit.length / Math.max(1, rows.length)).toFixed(2) + '%) — if this reaches 0 the '
       + 'roster stopped staging Zoroark and the assertion above became unfalsifiable');
    ok(hit.length < rows.length * 0.05,
       'CONTROL — and it is specific, not a blanket',
       hit.length + ' of ' + rows.length + ' rows');
    ok(hit.every(r => r.deferred && r.deferred.by && r.deferred.on && r.deferred.why),
       'the shelved roster row carries who shelved it, when, and why — in the ARTIFACT',
       hit.map(r => r.stage + ':' + r.id + ' -> '
         + (r.deferred ? '[' + r.deferred.by + ' ' + r.deferred.on + '] '
             + String(r.deferred.why).slice(0, 90) : 'NO REASON PUBLISHED')).join('\n          '));
  }
}

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
