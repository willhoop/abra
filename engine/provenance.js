/* provenance.js — is every published artifact built on data we still believe?
 *
 *   node engine/provenance.js          report
 *   node engine/provenance.js --strict exit non-zero if anything is unsafe (for CI)
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-07-26 SLOWKING's equilibrium and its named rock-paper-scissors cycle were quoted as the
 * justification for an entire architecture. The file was dated 24 July, reported 7,314 games over 8
 * archetypes, and had been computed on the UNFILTERED store — 87% bots, forfeits and stubs. GURU was
 * quality-filtered on 25 July, one day later, which invalidated it. Nothing on the file said so.
 * Re-run on clean data the cycle disappears entirely.
 *
 * That is not a SLOWKING problem. It is a class of problem: a JSON file on disk looks exactly as
 * authoritative whether it was generated this morning or before the filter that made it wrong, and
 * a reader has no way to tell. Every model in this project consumes another model's output, so one
 * stale artifact silently poisons everything downstream of it.
 *
 * WHAT IT CHECKS, AND WHY EACH ONE CATCHES SOMETHING REAL
 * ------------------------------------------------------
 *   1. STALE AGAINST THE FILTER. An artifact older than data/quality-filter.json was computed under
 *      different rules about what counts as a usable game. That is exactly what happened here.
 *   2. STALE AGAINST ITS INPUT. An artifact older than the file it was derived from is describing a
 *      corpus that has since moved.
 *   3. MORE GAMES THAN EXIST CLEAN. An artifact claiming more games than the clean store holds
 *      cannot have been filtered. This is the tell that caught SLOWKING: 7,314 against a clean store
 *      that has never exceeded ~2,000.
 *   4. NO CORPUS RECORDED AT ALL. A file that does not say what it was built from cannot be checked
 *      by anyone, ever. That is the condition that let this go unnoticed.
 *
 * It reads only what the artifacts declare about themselves. It cannot detect an artifact that
 * records a corpus it did not actually use — that would need re-running the generator, which is the
 * generator's own job.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const STRICT = process.argv.includes('--strict');

/* Each artifact, the generator that writes it, and what it is derived FROM. Kept here rather than
 * guessed, because "what does this depend on" is a fact about the pipeline that no file states. */
const ARTIFACTS = [
  { file: 'guru-matchups.json',     by: 'engine/guru.py',              from: ['games.ladder.jsonl'] },
  { file: 'slowking-eval.json',     by: 'engine/slowking_preview.py',  from: ['guru-matchups.json'] },
  { file: 'slowking-playstyle-eval.json', by: 'engine/slowking_preview.py', from: ['playstyle-matchups.json'] },
  { file: 'playstyle-matchups.json', by: 'engine/playstyle.js',        from: ['games.ladder.jsonl'] },
  { file: 'pory-eval.json',         by: 'engine/pory.py',              from: ['games.ladder.jsonl'] },
  { file: 'pory-nn.json',           by: 'engine/pory_nn.py',           from: ['games.ladder.jsonl'], optInFilter: true },
  { file: 'chomp-ev.json',          by: 'engine/chomp_ev.js',          from: ['games.ladder.jsonl'] },
  /* Fitted on the OPEN-SHEET corpus, not the ladder store, so its game count must be compared
   * against that. The first version of this checker compared everything to the ladder's clean count
   * and flagged this as unsafe — a false alarm, and a checker that cries wolf is one people learn to
   * scroll past, which is the failure this file exists to prevent. */
  { file: 'policy-weights.json',    by: 'engine/fit_policy.js',        from: ['games.ots.jsonl', 'games.bo3.jsonl', 'move-priors.json'], corpus: 'opensheet' },
  { file: 'move-priors.json',       by: 'engine/policy.js',            from: ['games.ladder.jsonl'] },
  { file: 'bring-priors.json',      by: 'engine/bring_priors.js',      from: ['games.ladder.jsonl'] },
  { file: 'ability-blocks.json',    by: 'build/build_ability_blocks.js', from: ['games.ladder.jsonl'] },
  { file: 'smogon-priors.json',     by: 'engine/smogon_priors.js',     from: [] },
  { file: 'exploitability.json',    by: 'engine/exploit.js',           from: ['policy-weights.json'] },
  { file: 'ladder.json',            by: 'engine/ladder.js',            from: ['policy-weights.json'] },
  { file: 'mag.js',                 by: 'build/build_mag_data.js',     from: ['policy-weights.json', 'ability-blocks.json', 'smogon-priors.json'] },
];

const mtime = f => { try { return fs.statSync(D('data', f)).mtimeMs; } catch (e) { return null; } };
const FILTER_MT = (() => { for (const f of ['quality-filter.json']) { const m = mtime(f); if (m) return m; } return null; })();

let cleanCount = null, openCleanCount = null;
try { cleanCount = require('./quality.js').loadGames().length; } catch (e) {}
try {
  const Q = require('./quality.js'), cfg = Q.config();
  let n = 0;
  for (const f of ['games.ots.jsonl', 'games.bo3.jsonl']) {
    const p2 = D('data', f);
    if (!fs.existsSync(p2)) continue;
    for (const l of fs.readFileSync(p2, 'utf8').split('\n')) {
      if (!l.trim()) continue; let g; try { g = JSON.parse(l); } catch (e) { continue; }
      if (g.openSheet && g.sheets && !Q.reasons(g, cfg, null).length) n++;
    }
  }
  openCleanCount = n;
} catch (e) {}

/* Pull a declared game count out of whatever shape the artifact used. */
function declaredGames(j) {
  if (!j || typeof j !== 'object') return null;
  for (const k of ['n_games', 'games', 'gamesUsed', 'nGames']) {
    if (typeof j[k] === 'number') return j[k];
  }
  if (j.corpus && typeof j.corpus.games === 'number') return j.corpus.games;
  return null;
}

const rows = [];
for (const a of ARTIFACTS) {
  const p = D('data', a.file);
  if (!fs.existsSync(p)) { rows.push({ ...a, status: 'missing', notes: ['not generated'] }); continue; }
  const mt = fs.statSync(p).mtimeMs;
  let j = null;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { /* mag.js is JS, not JSON */ }

  const notes = [];
  let bad = false, warn = false;

  if (FILTER_MT && mt < FILTER_MT) {
    notes.push('OLDER THAN THE QUALITY FILTER — computed under different rules about what counts');
    bad = true;
  }
  for (const dep of a.from) {
    const dm = mtime(dep);
    if (dm && mt < dm) { notes.push(`older than its input ${dep}`); warn = true; }
  }
  const n = declaredGames(j);
  const ceiling = a.corpus === 'opensheet' ? openCleanCount : cleanCount;
  const ceilingName = a.corpus === 'opensheet' ? 'clean open-sheet' : 'clean ladder';
  if (n != null && ceiling != null && n > ceiling * 1.2) {
    notes.push(`declares ${n.toLocaleString()} games but only ${ceiling.toLocaleString()} are ${ceilingName} — cannot have been filtered`);
    bad = true;
  }
  /* A generator whose filter is OPT-IN must say it was switched on. pory_nn.py takes --clean and
   * defaults to off, so an artifact from it that records no such flag was almost certainly trained
   * on the raw archive — which is how data/pory-nn.json came to declare 61,274 games. */
  if (a.optInFilter && j && !j.clean && !j.filtered && !j.quality_filtered) {
    notes.push('its generator only filters when asked (--clean) and this file does not record that it was');
    bad = true;
  }
  if (j && n == null && a.from.some(f => f.endsWith('.jsonl'))) {
    notes.push('records no game count — nobody can check what it was built from');
    warn = true;
  }
  rows.push({ ...a, status: bad ? 'UNSAFE' : (warn ? 'stale?' : 'ok'), games: n, notes });
}

console.log('PROVENANCE — what every published artifact was actually built on\n');
if (cleanCount != null) console.log(`  clean games available right now: ${cleanCount.toLocaleString()}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log('  ' + pad('artifact', 32) + pad('status', 9) + 'notes');
console.log('  ' + '-'.repeat(96));
for (const r of rows.sort((a, b) => (a.status === 'UNSAFE' ? -1 : b.status === 'UNSAFE' ? 1 : 0))) {
  console.log('  ' + pad(r.file, 32) + pad(r.status, 9) + (r.notes[0] || ''));
  for (const extra of r.notes.slice(1)) console.log('  ' + pad('', 41) + extra);
}

const unsafe = rows.filter(r => r.status === 'UNSAFE');
const stale = rows.filter(r => r.status === 'stale?');
console.log('');
console.log(`  ${unsafe.length} UNSAFE, ${stale.length} possibly stale, ${rows.filter(r => r.status === 'ok').length} ok, ` +
            `${rows.filter(r => r.status === 'missing').length} missing`);
if (unsafe.length) {
  console.log('\n  DO NOT QUOTE THE UNSAFE ONES. Regenerate them before any result that depends on them');
  console.log('  is reported, and before wiring them into anything downstream.');
}
console.log('\n  This checks what artifacts DECLARE about themselves. It cannot catch one that records a');
console.log('  corpus it did not use — only re-running the generator can.');

if (STRICT && unsafe.length) process.exit(1);
