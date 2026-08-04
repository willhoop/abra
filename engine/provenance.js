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
    /* THE STRONGEST FORM: ONE LINE both names the file and writes it.
     *   json.dump(dex_out, open(D("data","pokemon-roles.json"),"w"), indent=1)
     * `writesNear`'s 200-character window is loose enough that a script which merely READS a file a
     * few lines above its own unrelated write is credited with generating it. That is how
     * data/pokemon-roles.json, data/roles-eval.json, data/role-matchups.json and data/roles.js were
     * all attributed to engine/build_roles_js.py — which reads them to make a browser bundle —
     * instead of engine/roles.py, which computes them from the game store. The consequence was not
     * cosmetic: build_roles_js.py touches no games, so all four artifacts were classed as not
     * store-derived and skipped every corpus check. Attributing an artifact to the wrong generator
     * means checking the wrong generator. */
    /* A STRICTER WRITE TEST THAN `WRITE`, because at line scope `open(` alone is ambiguous —
     * `json.load(open(D("data","pokemon-roles.json"), encoding="utf-8"))` is a READ and matches it.
     * Using the loose form here left engine/roles.py (which writes the file) and
     * engine/build_roles_js.py (which reads it) tied at the top rank, and the tie was broken by
     * directory order. An `open` is only a write when a mode string says so. */
    const LINE_WRITE = /writeFileSync|createWriteStream|json\.dump|to_json|open\s*\(.*['"][wa]b?\+?['"]/;
    /* A COMMENT IS NOT CODE. This test found its first victim immediately: the comment above quotes
     * engine/roles.py's write line verbatim, which credited THIS FILE with generating
     * data/pokemon-roles.json — a provenance checker naming itself as the source of an artifact,
     * which is the same class of false attribution the block above exists to fix. A write statement
     * never lives on a line that opens with a comment marker. */
    const isComment = ln => /^\s*(\/\/|\/\*|\*|#)/.test(ln);
    const writesOnItsOwnLine = (src) =>
      src.split('\n').some(ln => !isComment(ln) && ln.includes(file) && LINE_WRITE.test(ln));
    /* ONE LEVEL OF VARIABLE INDIRECTION, which is the dominant Python idiom in engine/:
     *   OUT = os.path.join(ROOT, "data", "guru-matchups.json")
     *   ...
     *   json.dump(res, open(OUT, "w"), indent=2)
     * The filename literal never appears next to a write, so data/guru-matchups.json had NO detected
     * writer and was absent from this audit entirely — the source file at the centre of the
     * guru.js / guru-matchups.json divergence was the one file the provenance checker could not see.
     * Resolved by finding the identifier the name was assigned to and asking whether THAT is
     * written. */
    const writesVia = (src) => {
      for (const m of src.matchAll(new RegExp(`^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=[^\\n]*${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gm'))) {
        const ident = m[1];
        const use = new RegExp(`(writeFileSync|json\\.dump|to_json|open)\\s*\\([^)\\n]*\\b${ident}\\b`);
        if (use.test(src)) return true;
      }
      return false;
    };
    /* Rank the candidates by how directly they write it and take the best, rather than whichever
     * the directory scan happened to reach first. */
    const cands = gens.filter(g => named(g.src, file));
    const rank = g => (writesOnItsOwnLine(g.src) ? 3 : 0) || (writesVia(g.src) ? 2 : 0) || (writesNear(g.src) ? 1 : 0);
    const writers = cands.map(g => ({ g, r: rank(g) })).filter(x => x.r > 0).sort((x, y) => y.r - x.r).map(x => x.g);
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
    /* THE CODE THAT COMPUTED THE NUMBERS IS AN INPUT TOO, and until now nothing tracked it.
     *
     * This file derived dependencies from DATA files only, so an artifact full of damage numbers had
     * no recorded dependency on the DAMAGE ENGINE that produced them. On 2026-08-03 the engine gained
     * Body Press reading Defence, the -ate abilities, Ice Scales and ignored stat stages -- every
     * published damage-derived figure went stale in one commit, and this checker reported "ok" for
     * all of them.
     *
     * That is precisely the class this file exists to catch, stated in its own header: "a JSON file
     * on disk looks exactly as authoritative whether it was generated this morning or before the
     * filter that made it wrong". A code change is no different from a filter change.
     *
     * Derived the same way as the rest: a generator that REQUIRES the damage engine or the feature
     * builder depends on them. Nothing is hand-listed, so a new consumer is picked up for free.
     * `player_digest.js` already hashes the damage table for the BOT -- this is the same idea applied
     * to artifacts, by mtime, which is all the rest of this file uses. */
    const ENGINE_INPUTS = ['medicham2-browser.js', 'board.js', 'engine-data.js', 'abra-tags.js'];
    for (const eng of ENGINE_INPUTS) {
      const base = eng.replace(/\.js$/, '');
      /* A plain substring test, not a built regex. The first version assembled the pattern from a
       * string and the escaping did not survive, so `require\(` reached RegExp as an unescaped group
       * and the whole file threw on load -- a checker that cannot run reports nothing, which is
       * worse than the gap it was closing. Two forms cover every caller: a require of the module, or
       * the destructured `= require(...)` some generators use. */
      /* ONE LEVEL OF require, exactly as the corpus derivation below already does -- and for the
       * same reason it had to. NO generator requires the damage engine directly: they require
       * board.js, and board.js reaches medicham2-browser through damageEngine(). Checking only the
       * generator's own source found nothing and reported every damage-derived artifact "ok" on the
       * night the damage engine changed. A dependency you reach through one hop is still a
       * dependency. */
      const reach = writers[0].src + (writers[0].src.indexOf('board.js') >= 0
        ? fs.readFileSync(D('engine', 'board.js'), 'utf8') : '');
      if (reach.indexOf(base) < 0) continue;
      if (reach.indexOf('require') < 0) continue;
      for (const dir of ['engine', 'data']) {
        const full = D(dir, eng);
        if (fs.existsSync(full)) { from.push(dir + '/' + eng); break; }
      }
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
    /* NOT INTO engine/quality.js, and this is a NAMED exception with a reason rather than a list.
     * quality.js is the store DISPATCHER: it names every store in the project by construction, in
     * its own comments and in the error message that tells a caller how to choose one. Following
     * into it therefore classifies every generator that uses the canonical reader — which is all of
     * the good ones — as open-sheet. data/winrate-backtest.json's 6,886 LADDER games were being
     * judged against the 8,173-game open-sheet ceiling for exactly that reason. A module whose
     * mention of a store carries no information about its caller must not be read as if it did. */
    const withDeps = writers[0].src + localReqs.filter(r => !/^quality(\.js)?$/.test(r)).map(r => {
      try { return fs.readFileSync(D('engine', r + '.js'), 'utf8'); } catch (e) { return ''; }
    }).join('\n');
    const corpus = /games\.(ots|bo3)\.jsonl/.test(withDeps) ? 'opensheet' : 'ladder';
    /* IS THIS COUNTED OFF THE GAME STORE AT ALL?
     *
     * Needed for the corpus-drift check below, and it could not be answered by `from` alone. `from`
     * only contains games.*.jsonl when the generator NAMES the store next to a read verb — and the
     * generators that do the right thing do not name it. They call loadGames() / load_games(), which
     * resolve the path inside engine/quality.js and engine/store.py.
     *
     * So the canonical reader was the one thing that hid an artifact from the store dependency, and
     * every artifact built the recommended way looked storeless. data/meta-usage.json sat at `ok`
     * while declaring 5,269 clean games against 6,943 available — a quarter of the corpus missing —
     * because nothing connected it to the store it was counted from. Detected by the LOADER CALL,
     * which is what a generator actually does, following the same one-require hop the corpus
     * detection above already follows. */
    const storeDerived = /\bloadGames\b|\bload_games\b/.test(withDeps)
      /* IMPORTING THE READER COUNTS, not only calling its headline function. engine/derive_sets.js
       * does `const Q = require('./quality.js')` and then uses Q.reasons()/Q.readStore(), so the
       * string `loadGames` never appears in it. A generator that pulls in the store reader is
       * counting off the store whichever of its functions it happens to call. */
      || /require\(\s*['"]\.\/(quality|store)(\.js)?['"]/.test(writers[0].src)
      || /\b(from|import)\s+(store|quality)\b/.test(writers[0].src)
      || from.some(f => /^games\..*\.jsonl$/.test(f));
    out.push({ file, by, from, corpus, storeDerived });
  }
  return out;
}
const ARTIFACTS = deriveGraph();

/* --graph prints the DERIVED graph itself: who writes what, from what, and whether the checker
 * believes the count is a store count. Added because the graph is the part of this file that can be
 * silently wrong — an artifact whose store dependency goes undetected is reported `ok` forever, and
 * the only way to find that out was to add a console.log and delete it again. A checker whose
 * internal state cannot be inspected is one you end up reasoning about instead of reading. */
if (process.argv.includes('--graph')) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log('DERIVED ARTIFACT GRAPH — nothing here is typed; it is read out of the generators\n');
  console.log('  ' + pad('artifact', 32) + pad('generated by', 34) + pad('corpus', 11) + 'store?  inputs');
  console.log('  ' + '-'.repeat(112));
  for (const a of ARTIFACTS.slice().sort((x, y) => x.file.localeCompare(y.file))) {
    console.log('  ' + pad(a.file, 32) + pad(a.by, 34) + pad(a.corpus, 11) +
                pad(a.storeDerived ? 'yes' : 'no', 8) + (a.from.join(', ') || '(none detected)'));
  }
  console.log(`\n  ${ARTIFACTS.length} artifacts, ${ARTIFACTS.filter(a => a.storeDerived).length} counted off the game store`);
  process.exit(0);
}

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

/* Pull a declared game count out of whatever shape the artifact used.
 *
 * AN EXPLICIT CORPUS CLAIM WINS OVER A BARE COUNT, and that ordering is the fix for the artifact at
 * the centre of PRIORITIES #16. data/meta-usage.json records its 5,269 under
 * `provenance.funnel.clean` and `provenance.usable` — the two most explicit statements of "this is
 * the population" anywhere in the repository — and had NO key this function looked at, so the file
 * that started the whole "two definitions of clean" question was the one artifact the checker could
 * not see a count for at all. A generator that describes its corpus most carefully should not
 * thereby become invisible. */
function declaredGamesFrom(j) {
  if (!j || typeof j !== 'object') return { n: null, key: null };
  const p = j.provenance && typeof j.provenance === 'object' ? j.provenance : {};
  if (p.funnel && typeof p.funnel.clean === 'number') return { n: p.funnel.clean, key: 'provenance.funnel.clean' };
  if (typeof p.usable === 'number') return { n: p.usable, key: 'provenance.usable' };
  if (j.funnel && typeof j.funnel.clean === 'number') return { n: j.funnel.clean, key: 'funnel.clean' };
  if (j.corpus && typeof j.corpus.clean_games === 'number') return { n: j.corpus.clean_games, key: 'corpus.clean_games' };
  for (const k of ['n_games', 'games', 'gamesUsed', 'nGames']) {
    if (typeof j[k] === 'number') return { n: j[k], key: k };
  }
  if (j.corpus && typeof j.corpus.games === 'number') return { n: j.corpus.games, key: 'corpus.games' };
  return { n: null, key: null };
}
const declaredGames = j => declaredGamesFrom(j).n;
/* WHICH KEYS ARE A STATEMENT ABOUT A POPULATION. `games` is deliberately NOT one of them.
 * engine/rollout_r2.js published `games` as the GAMES environment CAP for a run of 200 — a knob
 * being read as a measurement, which docs/MEASURE.md records and that generator has since fixed.
 * Until every writer of a bare `games` says whether it means a corpus or a sample, a drift figure
 * computed on it is a guess. The fix belongs in the generator (publish `n_games`, or `n_measured`
 * with `n_unit`), not in a special case here. */
const CORPUS_KEYS = new Set(['provenance.funnel.clean', 'provenance.usable', 'funnel.clean',
  'corpus.clean_games', 'n_games', 'gamesUsed', 'nGames']);

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
  const { n, key: nKey } = declaredGamesFrom(j);
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
  /* CORPUS DRIFT — the other side of check 3, and the one that was missing.
   *
   * Check 3 catches an artifact declaring MORE games than exist clean, which is the tell for an
   * unfiltered corpus. Nothing caught the opposite: an artifact declaring far FEWER, which is the
   * tell for a corpus that has moved on since it was built.
   *
   * WHAT IT WAS BUILT TO SETTLE (PRIORITIES #16). data/live.js and data/winrate-backtest.json said
   * 6,943 clean games; data/meta-usage.json, data/roles-eval.json and data/guru-matchups.json said
   * ~5,269, and the front door rendered the larger figure beside results computed on the smaller.
   * There is exactly ONE definition of a clean game (data/quality-filter.json, read by
   * engine/quality.js and engine/quality.py, whose selections tests/test-quality.js pins to be
   * identical). The 1,674-game gap is entirely RECOMPUTATION DATE: the 5,269 family was written on
   * 2026-07-31 when the store held 29,117 collected, and the store held 38,587 by 2026-08-04. So
   * this is not a naming problem and the two counts must NOT be given different names. It is
   * staleness, and mtime could not see it, because the append-only store's mtime moves every hour
   * and would mark every store-derived artifact stale within the hour of being rebuilt — a gate that
   * cries wolf, which this file's own comments repeatedly refuse to become.
   *
   * MEASURED, not typed: the clean corpus grew 5,269 -> 6,943 over 3.4 days, about 7% a day. A 10%
   * threshold is therefore "roughly a day and a half behind", which is late enough that a rebuild
   * that has just happened stays quiet and early enough that a figure being quoted in a document is
   * still worth re-deriving. It is a judgement, and it is written down rather than remembered. */
  /* A DELIBERATE SAMPLE IS NOT A STALE CORPUS, and the first version of this check could not tell
   * them apart: it reported data/rollout-r3.json as 99.3% behind for running on the 60 games its
   * gate asks for. A gate artifact reports a RUN; the census artifacts this check is for report a
   * POPULATION. Both escape hatches are declarations in the artifact itself — `gate`, which every
   * R1-R4 file carries, and `games_requested`, which engine/rollout_r2.js added when it stopped
   * publishing an environment cap as a measurement. Same convention as `not_store_derived` and
   * `raw_store_ok`: visible to a consumer, not buried in this checker. */
  const isSample = j && (typeof j.gate === 'string' || typeof j.games_requested === 'number' || j.sampled);
  /* A STRICT SUBSET IS NOT A STALE CORPUS EITHER, and this was the drift check's own measured false
   * positive. data/pory-eval.json reports 33-35% behind and CANNOT get below about 21% however often
   * it is regenerated: its population is not "clean ladder games", it is "clean ladder games whose
   * raw log is present and names a winner" — 5,456 reachable, not 7,123. Every artifact reading
   * games.ladder.raw-logs.jsonl has this. `gate`, `games_requested` and `sampled` do not cover it,
   * because this is neither a gate nor a deliberate sample: the generator wanted every game it could
   * have and got every game it could have.
   *
   * The hatch is the same convention as the other three — a declaration IN THE ARTIFACT, so a
   * consumer sees it, and derived by the generator that knows its own predicate rather than
   * special-cased here. A generator that narrows the population publishes the ceiling it can reach;
   * until it does, its drift is measured against the wrong denominator and reads high. */
  const reach = (() => {
    const p = j && j.provenance && typeof j.provenance === 'object' ? j.provenance : {};
    for (const v of [j && j.population_ceiling, p.population_ceiling,
                     j && j.corpus && j.corpus.population_ceiling]) {
      if (typeof v === 'number' && v > 0) return { n: v, declared: true };
    }
    return { n: ceiling, declared: false };
  })();
  const DRIFT_WARN_PCT = 10;
  if (a.storeDerived && !isSample && CORPUS_KEYS.has(nKey) && n != null && reach.n != null && n < reach.n) {
    const missingPct = 100 * (reach.n - n) / reach.n;
    if (missingPct >= DRIFT_WARN_PCT) {
      notes.push(`CORPUS DRIFT — declares ${n.toLocaleString()} games; ${reach.n.toLocaleString()} are `
        + `${ceilingName} now, so ${missingPct.toFixed(1)}% of the corpus it describes is not in it. `
        + `Re-run ${a.by}.`
        + (reach.declared ? ` (measured against this artifact's own declared population ceiling.)` : ''));
      warn = true;
      /* IS THAT PERCENTAGE A REASON TO DISBELIEVE THE NUMBER? THE PERCENTAGE CANNOT SAY.
       *
       * A percentage of an unbounded, append-only corpus is not a statement about a measurement. The
       * collector runs hourly and clean games grew 5,269 -> 7,123 in four days, so a 10% threshold is
       * an AGE threshold wearing a fraction's clothes: every artifact is "stale" about a day and a
       * half after it is built, by construction, however often it is rebuilt. data/pory-nn.json was
       * regenerated on 2026-08-04 and reported 15.7% drift on the same day. An artifact computed on
       * 6,008 games is not WRONG because 1,115 more arrived, and a check that goes red on its own
       * schedule is the check that gets filed as "known" — which CLAUDE.md names as how the
       * docs-currency guard rotted. Invisibility was never the failure; normalisation was.
       *
       * So the percentage is printed as the trigger and the ABSOLUTE POWER is printed beside it, in
       * the units of the thing being measured, because that is the question a reader actually has:
       * can the games this artifact does not have change what it says?
       *
       *   ci_gain    how much narrower the 95% interval would be, in percentage POINTS. Precision
       *              goes as 1/sqrt(n), so 1.96 * 0.5 * (1/sqrt(n) - 1/sqrt(reach)) for a proportion.
       *   max_shift  how far the pooled point estimate could move if every missing game came in.
       *              The pooled mean shifts by (m/reach) * (x_new - x_old) and se(x_new) = sd/sqrt(m),
       *              so a 2sd bound is 2 * 0.5 * sqrt(m) / reach. Worst case, not expected case.
       *
       * BOTH SHRINK AS THE CORPUS GROWS AT A FIXED PERCENTAGE, which is the property the percentage
       * does not have: max_shift = sqrt(f)/sqrt(n), so the same 15.7% drift that can move an accuracy
       * 0.47 points at n=7,123 can move it 0.33 at n=14,000 and 0.24 at n=28,000. That is the
       * treadmill ending on its own instead of being switched off.
       *
       * WHAT TO COMPARE IT AGAINST is this project's own measured noise floor, never a fresh
       * judgement: split-half spreads published in docs/MEASURE.md run 0.2 to 4.3 points (R4's three
       * cuts 0.2 / 1.3 / 3.9; R1's 0.43 to 2.01). A movement bound BELOW 0.43 points is smaller than
       * the smallest floor this project has ever measured, and an effect smaller than the noise floor
       * is not an effect (LESSONS 9).
       *
       * WHAT THIS DELIBERATELY DOES NOT DO: change the trigger. The threshold stays at 10% because
       * lowering the bar is not this file's call to make alone and because max_shift alone still
       * cannot see the one thing that decided every entry in docs/MEASURE.md §5c's hand triage — the
       * DISTANCE from an artifact's headline estimate to its decision boundary. data/roles-eval.json
       * publishes 0.6935 against a coin's 0.6931; a 0.0004 margin is flippable by any new data at
       * all, while data/war.json's null is not flippable by a 0.4-point movement. That margin is not
       * computable from n, and the artifact is the only thing that knows it — so the next rung is a
       * declared `decision_margin`, in the same style as `population_ceiling` above, and until a
       * generator publishes one the honest report is the magnitude plus the floor to read it against.
       */
      const m = reach.n - n;
      const ciGain = 1.96 * 0.5 * (1 / Math.sqrt(n) - 1 / Math.sqrt(reach.n)) * 100;
      const maxShift = 2 * 0.5 * Math.sqrt(m) / reach.n * 100;
      const FLOOR_PTS = 0.43;   // the SMALLEST split-half spread docs/MEASURE.md has published
      notes.push(`POWER — the ${m.toLocaleString()} missing games buy ${ciGain.toFixed(2)} points of `
        + `95% CI width and can move a proportion by at most ${maxShift.toFixed(2)} points (2sd). `
        + (maxShift < FLOOR_PTS
            ? `That is BELOW the smallest split-half noise floor this project has measured (${FLOOR_PTS} pts), `
              + `so the percentage above is age, not error.`
            : `The smallest measured split-half floor is ${FLOOR_PTS} pts, so this could matter to a `
              + `verdict sitting within ${maxShift.toFixed(2)} points of its boundary.`));
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
