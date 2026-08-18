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

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
