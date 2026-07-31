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

/* THE ARTIFACT GRAPH IS DERIVED, NOT TYPED.
 *
 * The first version of this file carried a hand-written list of every artifact, its generator and
 * its inputs — which is precisely the hand-maintained state S13 forbids, in the very tool built to
 * enforce it. A list like that is correct on the day it is written and rots the moment somebody adds
 * a model, and a provenance checker that silently stops covering half the pipeline is worse than
 * none at all.
 *
 * So the graph is read out of the source. A generator that WRITES data/x.json names it in a write
 * call; one that READS data/y.json names it too. Both are greppable facts about the code rather than
 * claims about it, so a new model joins the audit by existing.
 */
function deriveGraph() {
  const gens = [];
  for (const dir of ['engine', 'build']) {
    const d = D(dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!/\.(js|py)$/.test(f)) continue;
      let src; try { src = fs.readFileSync(path.join(d, f), 'utf8'); } catch (e) { continue; }
      gens.push({ id: dir + '/' + f, src });
    }
  }
  /* A write looks like writeFileSync(...'name.json'...) or open(...,'w') on a joined path; both end
   * up naming the file, so the filename plus a nearby write verb is the signal. */
  const WRITE = /(writeFileSync|to_json|open\s*\(|dump\s*\()/;
  /* Just look for the literal filename. A quoted-delimiter regex is not worth the escaping here —
   * the filenames are distinctive enough that a substring match is exact in practice. */
  const named = (src, file) => src.indexOf(file) >= 0;
  /* The filename within ~120 characters of something that opens a file for reading. */
  const READ = /(readFileSync|require\s*\(|open\s*\(|read_json|load_games|loadGames|json\.load)/;
  function readsNear(src, file) {
    let i = src.indexOf(file);
    while (i >= 0) {
      if (READ.test(src.slice(Math.max(0, i - 120), i + 40))) return true;
      i = src.indexOf(file, i + 1);
    }
    return false;
  }

  const dataFiles = fs.readdirSync(D('data'))
    .filter(f => /\.(json|js)$/.test(f) && !/^games\./.test(f) && f !== 'quality-filter.json');

  const out = [];
  for (const file of dataFiles) {
    /* A WRITER names the file NEXT TO a write call, not merely somewhere in a file that also
     * happens to write something else. Matching loosely credited data/policy-weights.json to
     * engine/brood.js, which reads it, and data/xatu-context.json to this very file, which only
     * mentions it in a report. Attributing an artifact to the wrong generator means fixing the
     * wrong generator. */
    const writesNear = (src) => {
      let i = src.indexOf(file);
      while (i >= 0) {
        if (WRITE.test(src.slice(Math.max(0, i - 200), i + 60))) return true;
        i = src.indexOf(file, i + 1);
      }
      return false;
    };
    const writers = gens.filter(g => named(g.src, file) && writesNear(g.src));
    if (!writers.length) continue;                    // nothing generates it; not an artifact
    const by = writers[0].id;
    /* Its inputs: every other data file its generator actually READS.
     *
     * A plain substring match was tried first and was far too loose — any filename mentioned in a
     * comment counted as a dependency, which gave xatu-context.json seventeen of them. The name must
     * now sit close to a read verb, so a file discussed in prose is not mistaken for a file opened. */
    const from = [];
    for (const dep of dataFiles.concat(fs.readdirSync(D('data')).filter(f => /^games\..*\.jsonl$/.test(f)))) {
      if (dep === file) continue;
      if (readsNear(writers[0].src, dep)) from.push(dep);
    }
    /* WHICH CORPUS ITS COUNT SHOULD BE JUDGED AGAINST, derived from what the generator reads.
     * data/policy-weights.json is fitted on the OPEN-SHEET games, so comparing its count to the
     * ladder's clean total called it unsafe for declaring 2,723 — a false alarm. That annotation was
     * hand-written in the first version of this file and lost when the graph became derived, which
     * is the exact regression deriving it was supposed to prevent. */
    /* FOLLOW ONE LEVEL OF require, because a generator may DELEGATE its corpus loading. fit_joint.js
     * names neither games.ots.jsonl nor games.bo3.jsonl anywhere -- it calls fit_policy.js, which
     * does. So the regex read fit_joint's own source, found nothing, defaulted to 'ladder', and
     * judged policy-weights-joint.json's 6,517 open-sheet games against the 5,129 clean LADDER
     * total: "cannot have been filtered". A false alarm on an artifact regenerated the same day.
     *
     * That is the identical failure this block's own comment already records for
     * policy-weights.json, recurring one require deeper. Deriving the graph fixed the hand-written
     * version; it did not make the derivation transitive. */
    const localReqs = [...writers[0].src.matchAll(/require\(\s*'\.\/([A-Za-z0-9_.-]+?)(?:\.js)?'/g)].map(m => m[1]);
    const withDeps = writers[0].src + localReqs.map(r => {
      try { return fs.readFileSync(D('engine', r + '.js'), 'utf8'); } catch (e) { return ''; }
    }).join('\n');
    const corpus = /games\.(ots|bo3)\.jsonl/.test(withDeps) ? 'opensheet' : 'ladder';
    out.push({ file, by, from, corpus });
  }
  return out;
}
const ARTIFACTS = deriveGraph();

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

/* Does ONE generator write both of these files? Derived by scanning the generator directories for a
 * line that both names the file and writes it. Returns the script path, or null.
 *
 * Deliberately line-scoped: a script that merely READS one and WRITES the other is a real
 * dependency and must keep failing. Only a script whose write-lines cover both files makes the two
 * co-generated, and ordering between co-generated files carries no information. */
const WRITE_RE = /writeFileSync|createWriteStream|json\.dump|open\s*\([^)]*['"][wa]/;
const coGenCache = new Map();
function coGenerated(fileA, fileB) {
  const key = fileA + '\u0000' + fileB;
  if (coGenCache.has(key)) return coGenCache.get(key);
  let hit = null;
  for (const dir of ['engine', 'build', 'tools', 'scripts']) {
    let entries = [];
    try { entries = fs.readdirSync(D(dir)); } catch (e) { continue; }
    for (const f of entries) {
      if (!/\.(js|py)$/.test(f)) continue;
      let src; try { src = fs.readFileSync(D(dir, f), 'utf8'); } catch (e) { continue; }
      if (!src.includes(fileA) || !src.includes(fileB)) continue;
      let a = false, b = false;
      for (const ln of src.split('\n')) {
        if (!WRITE_RE.test(ln)) continue;
        if (ln.includes(fileA)) a = true;
        if (ln.includes(fileB)) b = true;
      }
      if (a && b) { hit = `${dir}/${f}`; break; }
    }
    if (hit) break;
  }
  coGenCache.set(key, hit);
  return hit;
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

  /* THE FILTER ONLY GOVERNS ARTIFACTS DERIVED FROM THE GAME STORE, and treating every artifact as
   * store-derived was a false-positive class found on 2026-07-31, the day this check was finally
   * wired as a gate. It flagged `regulations.json` (a format definition), `mega-dex-official.json`
   * (Showdown dex data) and `smogon-priors.json` (Smogon's public usage stats) as "computed under
   * different rules about what counts" — none of which is computed from our games at all, so the
   * quality filter has no bearing on any of them.
   *
   * That matters more than the three names: a gate that cries wolf gets ignored, which is precisely
   * how the unwired-check problem this file exists to solve came about. An artifact declares
   * `not_store_derived` with a REASON, in the artifact itself, exactly as the RAW-STORE-OK
   * convention works for source files — visible to a consumer, not buried in this checker. */
  const notStore = j && (j.not_store_derived || (j.provenance && j.provenance.not_store_derived));
  if (notStore) {
    notes.push(`not store-derived: ${typeof notStore === 'string' ? notStore : 'declared'}`);
  } else if (FILTER_MT && mt < FILTER_MT) {
    notes.push('OLDER THAN THE QUALITY FILTER — computed under different rules about what counts');
    bad = true;
  }
  for (const dep of a.from) {
    const dm = mtime(dep);
    if (dm && mt < dm) {
      /* SIBLINGS ARE NOT INPUTS. A generator that writes two artifacts in sequence leaves the
       * first permanently "older than" the second, and no amount of regeneration can satisfy the
       * complaint, because re-running reproduces the ordering exactly.
       *
       * This is the same false-positive class as `not_store_derived`, and it matters for the same
       * reason: a gate that cries wolf is a gate that gets ignored, which is how the unwired-check
       * problem this file exists to solve arose in the first place.
       *
       * WHO WRITES WHAT IS DERIVED FROM THE SOURCE, not typed here. A list of sibling pairs would
       * be hand-maintained state that goes stale the first time a generator is split -- so this
       * scans the generators for the two filenames and asks whether one script writes both. */
      if (coGenerated(a.file, dep)) {
        notes.push(`co-generated with ${dep} by ${coGenerated(a.file, dep)} — ordering within one run is not staleness`);
      } else {
        notes.push(`older than its input ${dep}`); warn = true;
      }
    }
  }
  /* An artifact may READ the raw store if it says why, the same convention engine/selftest.js
   * enforces on source files. The declaration must be in the artifact itself so a consumer sees it,
   * not buried in a generator nobody opens. */
  const declared = j && (j.raw_store_ok || j.RAW_STORE_OK);
  const n = declaredGames(j);
  const ceiling = a.corpus === 'opensheet' ? openCleanCount : cleanCount;
  const ceilingName = a.corpus === 'opensheet' ? 'clean open-sheet' : 'clean ladder';
  if (n != null && ceiling != null && n > ceiling * 1.2) {
    if (declared) {
      notes.push(`reads the raw store, declared: ${String(declared).slice(0, 80)}`);
    } else {
      notes.push(`declares ${n.toLocaleString()} games but only ${ceiling.toLocaleString()} are ${ceilingName} — cannot have been filtered`);
      bad = true;
    }
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

/* ---- AND NO GENERATOR MAY MAKE THE FILTER OPT-IN ---------------------------------------------
 * The pory-nn failure was not that someone forgot a flag, it was that the DEFAULT was wrong: a
 * plain run trained on the raw archive and you had to remember `--clean` to get the right answer.
 * Four other models already have it the right way round (filter by default, ABRA_UNFILTERED=1 to opt
 * out). This makes the wrong shape a build failure rather than a thing to notice. */
const OPTIN = [];
for (const dir of ['engine', 'build']) {
  const d = D(dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!/\.(js|py)$/.test(f)) continue;
    let src; try { src = fs.readFileSync(path.join(d, f), 'utf8'); } catch (e) { continue; }
    if (!/add_argument\(\s*["']--clean["']|includes\(\s*['"]--clean['"]\s*\)/.test(src)) continue;
    /* A file may keep the raw archive as its default if it DECLARES why, the same RAW-STORE-OK
     * convention engine/selftest.js already enforces on every raw reader. build_ability_blocks.js
     * carries one: the quantity is mechanics rather than behaviour, and the rules were verified
     * identical on clean-only data before the exception was taken. */
    if (/RAW-STORE-OK/.test(src)) continue;
    OPTIN.push(dir + '/' + f);
  }
}
if (OPTIN.length) {
  console.log('\n  OPT-IN FILTERS — the lazy path is the wrong path in these files:');
  for (const f of OPTIN) console.log('    ' + f + '  (make clean the DEFAULT and take an --unfiltered escape hatch)');
} else {
  console.log('\n  No generator makes the quality filter opt-in. Clean is the default everywhere.');
}

if (STRICT && (unsafe.length || OPTIN.length)) process.exit(1);
