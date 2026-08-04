/* test-rollout-gates.js — the four rungs must be comparable on a common count.
 *
 * WHY THIS EXISTS
 * ---------------
 * R1 published `positions`, R2 `boards`, R3 `decisions` and R4 `decisive_pairs`: four names for the
 * same slot across four artifacts that are meant to be read as a series. Comparing two rungs meant
 * opening two generators first to find out which key held the sample size, and the R4 handoff
 * demonstrated the cost by quoting "5,248 games" — the LINE count of a store that writes two lines
 * per game, which was twice the game count and eight times the number of decisive pairs the SPRT
 * was actually computed on.
 *
 * `n_measured` is the number and `n_unit` says what one of them IS. Deliberately NOT `n`:
 * data/rollout-r3.json has published `n` as the ROLLOUT BUDGET since 2026-08-03, and one key
 * meaning a sample size in one rung and a budget in the next is worse than no common key at all.
 * That decision is recorded in docs/MEASURE.md and this test is what keeps it from being re-litigated
 * by accident.
 *
 * WHAT IT ASSERTS, AND WHY IN THIS ORDER
 * --------------------------------------
 *   1. EVERY GENERATOR WRITES BOTH. Source-level, so it is complete the moment the edit is made and
 *      cannot be left half-done.
 *   2. EVERY ARTIFACT CARRIES BOTH, OR ITS GENERATOR ALREADY DOES. The second clause is the only
 *      tolerated state, and it is tolerated for exactly one reason: an artifact is fixed by re-running
 *      it, and data/rollout-cost.json cannot be re-derived from anything committed — it is a set of
 *      TIMINGS, a fact about a machine under a load, and docs/MEASURE.md records that R2 is re-run or
 *      it is nothing. So this test cannot demand a value that only a fresh run can produce.
 *
 *      What it CAN forbid is the state that actually goes wrong: an artifact missing the key whose
 *      generator is missing it too, which is nobody having done the work. "Fixed in source, awaiting
 *      a run" is a queue item. "Missing in both" is a defect, and it fails here.
 *
 * The gate list is DERIVED from the filenames engine/rollout_r*.js write, not typed. A fifth rung
 * joins this test by existing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); c ? P++ : F++; };

console.log('ROLLOUT GATES — one count, one unit, across all four rungs\n');

/* ---- derive the rungs ------------------------------------------------------------------------ */
const gens = fs.readdirSync(D('engine'))
  .filter(f => /^rollout_r\d.*\.js$/.test(f))
  .sort();
ok(gens.length >= 4, `found ${gens.length} rollout gate generators: ${gens.join(', ')}`);

const rungs = [];
for (const g of gens) {
  const src = fs.readFileSync(D('engine', g), 'utf8');
  /* Which artifact does it write? Every candidate filename it names, kept if it exists on disk.
   * engine/rollout_r4.js assigns the path to a constant first, so a write-adjacent match is not
   * enough; naming plus existing is. */
  const named = [...new Set([...src.matchAll(/['"]((?:data\/)?rollout-[a-z0-9-]+\.json)['"]/g)].map(m => m[1].replace(/^data\//, '')))];
  const writes = named.filter(f => fs.existsSync(D('data', f)) && /writeFileSync/.test(src));
  /* rollout_r1.js dumps rows rather than an artifact; it has no gate verdict and is not a rung. */
  if (!writes.length) continue;
  for (const w of writes) if (!rungs.some(r => r.artifact === w)) rungs.push({ gen: 'engine/' + g, artifact: w, src });
}
console.log(`  rungs: ${rungs.map(r => r.artifact).join(', ')}\n`);

/* ---- 1. every generator writes both keys ------------------------------------------------------ */
const isComment = ln => /^\s*(\/\/|\*|\/\*)/.test(ln);
for (const r of rungs) {
  const code = r.src.split('\n').filter(ln => !isComment(ln)).join('\n');
  const hasM = /\bn_measured\s*:/.test(code);
  const hasU = /\bn_unit\s*:/.test(code);
  ok(hasM && hasU, `${r.gen} writes n_measured and n_unit` +
    (hasM && hasU ? '' : ` (n_measured ${hasM ? 'yes' : 'NO'}, n_unit ${hasU ? 'yes' : 'NO'})`));
  /* The name that was ruled out, kept ruled out. A bare top-level `n` is the budget in R3. */
  ok(!/^\s*n\s*:/m.test(code) || r.artifact === 'rollout-r3.json',
    `${r.gen} does not publish a bare top-level \`n\` as a sample size`);
}

/* ---- 2. every artifact carries both, or its generator already does ---------------------------- */
const awaiting = [];
for (const r of rungs) {
  let j; try { j = JSON.parse(fs.readFileSync(D('data', r.artifact), 'utf8')); } catch (e) { j = null; }
  const has = j && typeof j.n_measured === 'number' && typeof j.n_unit === 'string';
  if (has) {
    ok(true, `data/${r.artifact}: n_measured=${j.n_measured} — ${j.n_unit}`);
    /* A unit that does not say what one row IS is the same hole with a value in it. */
    ok(j.n_unit.trim().length >= 6, `data/${r.artifact}: n_unit says what one of them is`);
  } else {
    const code = r.src.split('\n').filter(ln => !isComment(ln)).join('\n');
    const genHasIt = /\bn_measured\s*:/.test(code) && /\bn_unit\s*:/.test(code);
    ok(genHasIt,
      `data/${r.artifact} has no n_measured/n_unit, and ${genHasIt
        ? 'its generator does — awaiting a re-run, which is the only tolerated state'
        : 'NEITHER DOES ITS GENERATOR. Nobody has done this one.'}`);
    if (genHasIt) awaiting.push(r);
  }
}

if (awaiting.length) {
  console.log('\n  AWAITING A RE-RUN — the generator is fixed, the committed artifact predates it:');
  for (const r of awaiting) console.log(`    data/${r.artifact}   re-run: node ${r.gen}`);
}

console.log(`\n${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
