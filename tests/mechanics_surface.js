/* HOW MUCH OF WHAT PEOPLE ACTUALLY CLICK DOES THE ENGINE HANDLE AT ALL?
 *   node tests/mechanics_surface.js
 *
 * tests/test-mechanics.js probes mechanics ONE AT A TIME and says 42 of 54 are live. That number is
 * honest about what it measured and silent about what it did not: 54 of 172 tags, and I chose which
 * 54. Reporting "four rules left" off that is reporting a sample as a census -- Will: "BRO SURELY
 * THERE ARE MORE MOVES ABILITIES AND ITEMS THAT WE HAVENT WIRED IN YET".
 *
 * This asks the cheap version of the question over EVERYTHING, weighted by use: for each move,
 * ability and item that appears in the corpus, does the engine reference ANY of the tags it carries?
 *
 * WHAT THIS IS NOT. A referenced tag is not a correct implementation -- Encore was referenced and did
 * nothing, and Filter was implemented by a hardcoded name list that omitted Ice Scales. So this is an
 * UPPER BOUND on how much works, and the probe file is the only thing that establishes a lower one.
 * Read together they bracket the truth: the probes say what is verified, this says what is even
 * plausibly wired.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const raw = JSON.parse(fs.readFileSync(D('data', 'abra-tags.js'), 'utf8')
  .replace(/^[^{]*/, '').replace(/;\s*$/, ''));
/* The engine and the feature builder together: a mechanic MAG can see through a feature counts as
 * handled even when MEDICHAM cannot simulate it, because the question here is whether the project
 * does anything with it at all. */
const src = ['engine/medicham2-browser.js', 'engine/board.js']
  .map(f => fs.readFileSync(D(f), 'utf8')).join('\n');
const referenced = t => src.includes(`'${t}'`) || src.includes(`"${t}"`);

const SECTIONS = { moves: 'move', abilities: 'ability', items: 'item' };
const out = {};
for (const [sec, kind] of Object.entries(SECTIONS)) {
  let usedTotal = 0, handledTotal = 0, n = 0, handledN = 0;
  const worst = [];
  for (const [id, v] of Object.entries(raw[sec] || {})) {
    const uses = typeof v.uses === 'number' ? v.uses : 0;
    if (!uses) continue;                          // never appears in the corpus; not the question
    n++; usedTotal += uses;
    const tags = (v.tags || []).filter(t => t !== 'untagged');
    /* Handled means: it carries at least one tag something reads. An entry with NO tags at all is
     * counted as unhandled, because a mechanic nobody described is one nobody implemented. */
    const hit = tags.some(referenced);
    if (hit) { handledN++; handledTotal += uses; }
    else worst.push({ id, uses, tags: tags.join(',') || '(untagged)' });
  }
  worst.sort((a, b) => b.uses - a.uses);
  out[kind] = { n, handledN, usedTotal, handledTotal, worst: worst.slice(0, 12) };
}

console.log('ENGINE SURFACE -- share of real corpus use whose tags anything reads\n');
let gu = 0, gh = 0;
for (const [kind, r] of Object.entries(out)) {
  gu += r.usedTotal; gh += r.handledTotal;
  console.log(`  ${kind.toUpperCase().padEnd(9)} ${String(r.handledN).padStart(4)}/${String(r.n).padEnd(5)} entries   ` +
    `${(100 * r.handledTotal / r.usedTotal).toFixed(1)}% of use`);
}
console.log(`\n  OVERALL   ${(100 * gh / gu).toFixed(1)}% of all corpus use has some handling.`);
console.log('  UPPER BOUND: a referenced tag is not a working mechanic. Encore was referenced and');
console.log('  did nothing; Filter was a hardcoded list that omitted Ice Scales.\n');

for (const [kind, r] of Object.entries(out)) {
  if (!r.worst.length) continue;
  console.log(`BIGGEST UNHANDLED ${kind.toUpperCase()}S`);
  for (const w of r.worst) console.log(`  ${String(w.uses).padStart(7)}  ${w.id.padEnd(18)} ${w.tags}`);
  console.log('');
}

fs.writeFileSync(D('data', 'mechanics-surface.json'), JSON.stringify({
  generated: new Date().toISOString(), by: 'tests/mechanics_surface.js',
  method: 'a corpus-used entry counts as handled when ANY tag it carries appears as a quoted string '
        + 'in medicham2-browser.js or board.js',
  caveat: 'UPPER BOUND on what works. A referenced tag can still be unimplemented (Encore) or '
        + 'implemented by a hardcoded list that misses members (Filter/Ice Scales). '
        + 'tests/test-mechanics.js establishes the lower bound by probing behaviour.',
  overall_pct: 100 * gh / gu, by_kind: out,
}, null, 2) + '\n');
console.log('  wrote data/mechanics-surface.json');
