/* quality.js - the shared definition of a usable game (JavaScript side).
 *
 * There is ONE definition, in data/quality-filter.json. This module and engine/quality.py are thin
 * readers of that file; neither hard-codes a threshold. tests/test-quality.js asserts that both
 * readers select the IDENTICAL set of game ids, which is the only thing that stops the two drifting.
 *
 *   const Q = require('./quality.js');
 *   const games = Q.loadGames();            // clean only
 *   const all   = Q.loadGames({clean:false});
 *   console.log(Q.funnel());
 */
'use strict';
const fs = require('fs');
const path = require('path');

const STORE = path.join(__dirname, '..', 'data', 'games.ladder.jsonl');
const CONFIG = path.join(__dirname, '..', 'data', 'quality-filter.json');
const VALIDATION = path.join(__dirname, '..', 'data', 'store-validation.json');

/* Memoised. `reasons()` is called once per game, and re-reading + re-parsing the config file on each
 * call turned a 1-second filter into a multi-minute one. Cached after the first read. */
let _cfg = null;
function config() { if (!_cfg) _cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); return _cfg; }

/* THE STORE IS TRACKED COMPRESSED, AND READ EITHER WAY.
 *
 * data/games.ladder.jsonl reached 84.6 MB against GitHub's HARD per-file limit of 100 MB. At the
 * hourly collector's ~100 games/hour that was 3,788 games -- about 38 hours -- from the point where
 * every push fails, including the ingest Action's own. gzip takes the three stores from 137.6 MB to
 * 15.4 MB (12%, 11%, 9%), which is the same measure build/archive-regulation.js already applies to
 * raw logs for exactly this reason.
 *
 * So git tracks `<store>.jsonl.gz` and .gitignore excludes the plain `.jsonl`. The plain file is
 * still what the collector appends to and still what exists on a working machine, so nothing about
 * local workflow changes; it is simply no longer the thing git carries.
 *
 * PLAIN WINS WHEN BOTH EXIST, and that ordering is deliberate. The plain file is the live one the
 * collector is writing; the .gz is a snapshot taken at commit time by build/compress-stores.js.
 * Preferring the .gz would silently serve stale games to every model on the one machine that is
 * actually collecting them. On a fresh clone only the .gz exists and it is read directly. */
function storePath(p) {
  const want = p || STORE;
  if (fs.existsSync(want)) return want;
  if (fs.existsSync(want + '.gz')) return want + '.gz';
  return want;                     // let the read throw with the name the caller asked for
}
function readStoreText(p) {
  const f = storePath(p);
  if (f.endsWith('.gz')) return require('zlib').gunzipSync(fs.readFileSync(f)).toString('utf8');
  return fs.readFileSync(f, 'utf8');
}

/* MEASURED 2026-07-31: a single mew.js worker called loadGames() FIVE TIMES, re-reading and
 * re-parsing the same file each time — 46,075 game objects parsed to produce data that was already
 * in memory. In a CPU profile of a joint run, `readStore` was 60.9% of all sampled time while
 * Showdown's actual battle engine was 4.1%. The simulator is not the slow part; loading our own
 * data is.
 *
 * It matters most for TRAINING rather than for one long run. A 200,000-game head-to-head pays this
 * once per worker and amortises it over 40,000 games; `train_policy.js` respawns fresh workers
 * EVERY ITERATION, so a 12-iteration run at 5 procs pays it 60 times over.
 *
 * INVALIDATED ON THE FILE'S IDENTITY, not on its name. The store is APPEND-ONLY and a collection
 * run can extend it while a long process holds it open, so caching on path alone would serve a
 * silently short corpus — the exact class of quiet wrongness this repository keeps paying for.
 * mtime AND size together catch an append; either alone can miss one.
 *
 * ABRA_NO_STORE_CACHE=1 disables it, so a suspected caching bug can be ruled in or out in one run
 * rather than by reasoning. */
const _storeCache = new Map();          // resolved path -> { key, games }
let _storeGen = 0;                      // bumped on every real parse; keys the derived caches below

let _statWarned = false;
function _storeKey(f) {
  try { const st = fs.statSync(f); return st.mtimeMs + ':' + st.size; }
  catch (e) {
    /* CANNOT VALIDATE MEANS CANNOT CACHE. Returning a constant like 'missing' would make two
     * different unvalidatable states share a key, so a stale corpus would be served as fresh the
     * moment a stat failed transiently -- a lock, or a partial write during an append to this
     * append-only store. A unique value can never match a stored key, so the read simply happens
     * again, which is the safe direction. Reported once so a persistent stat failure is visible
     * rather than showing up as unexplained slowness. */
    if (!_statWarned) { _statWarned = true; console.error(`quality: cannot stat ${f} (${e.message}); store caching disabled for it`); }
    return 'unvalidatable:' + process.hrtime.bigint().toString();
  }
}

/* Deduplicate by id, first occurrence wins - the same order-preserving rule as dedupe_store.py, so
 * an un-deduped file on disk cannot silently change a result. */
function readStore(p) {
  const f = storePath(p);
  const key = _storeKey(f);
  const hit = _storeCache.get(f);
  if (hit && hit.key === key && !process.env.ABRA_NO_STORE_CACHE) return hit.games.slice();

  const seen = new Set(), out = [];
  for (const line of readStoreText(p).split('\n')) {
    const s = line.trim();
    if (!s) continue;
    let g; try { g = JSON.parse(s); } catch (e) { continue; }
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  if (!process.env.ABRA_NO_STORE_CACHE) { _storeCache.set(f, { key, games: out }); _storeGen++; }
  /* A COPY OF THE LIST, never the cached array itself. Callers sort, splice and filter what they are
   * handed; one of them doing so to the cache would silently change every later reader's corpus.
   * The game OBJECTS are shared — a caller that mutates a game in place would still leak across
   * callers, which no current caller does, and which ABRA_NO_STORE_CACHE exists to test. */
  return out.slice();
}

/* Accounts that BEHAVE like bots regardless of their name. The decisive signal is team invariance:
 * an account playing hundreds of games without ever changing a slot is running a script. Computed
 * once over the whole store, because it is a property of an ACCOUNT and not of a game. */
/* Also memoised, for the same reason and with the same escape hatch: it is a pure function of the
 * store and the config, it rescans all 29,117 games per call, and loadGames calls it on every one of
 * those five invocations. Keyed on the store generation AND the game count, so a caller passing a
 * DIFFERENT corpus (loadGames({path: ...})) cannot be served another corpus's bot set — that
 * confusion already produced one published figure computed on the wrong store, recorded in
 * loadGames above. */
const _botsCache = new Map();
function behaviouralBots(games, cfg) {
  cfg = cfg || config();
  const _ck = _storeGen + ':' + (games ? games.length : -1);
  const _hit = _botsCache.get(_ck);
  if (_hit && !process.env.ABRA_NO_STORE_CACHE) return _hit;
  const _out = _behaviouralBotsUncached(games, cfg);
  if (!process.env.ABRA_NO_STORE_CACHE) _botsCache.set(_ck, _out);
  return _out;
}
function _behaviouralBotsUncached(games, cfg) {
  cfg = cfg || config();
  const r = cfg.rules.exclude_behavioural_bots;
  if (!r || !r.on) return new Set();
  const count = new Map(), teams = new Map();
  for (const g of games) {
    for (const s of ['p1', 'p2']) {
      const n = (g[s] || {}).name;
      if (!n) continue;
      count.set(n, (count.get(n) || 0) + 1);
      const six = ((g.six || {})[s] || []).slice().sort().join('|');
      if (six) { if (!teams.has(n)) teams.set(n, new Set()); teams.get(n).add(six); }
    }
  }
  const out = new Set();
  for (const [n, c] of count) {
    const t = teams.get(n);
    if (c >= r.min_games && t && t.size <= r.max_distinct_teams) out.add(n);
  }
  return out;
}

/* THE LEGALITY VERDICT — SPECIES AND ITEM, NEVER MOVES, AND THE OMISSION IS THE RULE.
 *
 * engine/validate_store.js runs every stored team through Showdown's own TeamValidator and MARKS the
 * result in data/store-validation.json. Its header has always said "quality.js decides what to do
 * with it"; until 2026-08-27 quality.js had never read the file. This is that decision.
 *
 * ONE TEST DECIDES WHETHER A REJECTION CLASS MAY BE KEYED ON: can a LEGAL team produce it?
 *
 *   SPECIES  — no. Illusion changes what a body APPEARS to be; it cannot put an out-of-format body
 *              into the replay. "Salamence does not exist in Gen 9." is a fact about the room the
 *              game was played in, and this format was not it.
 *   ITEM     — no, for the declared-item phrasing. The item is on the sheet and a disguise does not
 *              change it. NARROWED BY A PATTERN, because the class also holds Ogerpon's "needs to
 *              hold Wellspring Mask" — which fires when the replay showed a forme and never showed
 *              the item, i.e. on OUR storage convention rather than on anybody's team.
 *   MOVE     — YES, and constantly. A disguised Zoroark appears as another species carrying
 *              Zoroark's moves, so the validator says "X can't learn Y" — the SAME sentence a
 *              custom-rules game produces. 1,175 games in the store are move-only rejections and
 *              1,020 of them have an Illusion carrier on the same side.
 *
 * SO: DO NOT "COMPLETE" THIS RULE BY ADDING `move`. It is not an oversight and it is not a TODO.
 * Keying on move would delete the corpus engine/illusion.js exists to study, and it would do it
 * silently, because a smaller corpus looks exactly like a cleaner one.
 *
 * READ ONCE PER PROCESS, DELIBERATELY. The verdict is a snapshot and another process may rewrite it;
 * a filter that changed halfway through a run would produce a corpus no stamp describes. Freezing it
 * for the process lifetime is the same reason a measurement opens a frozen engine release. What the
 * freeze cannot fix is that games appended AFTER the verdict have not been judged at all — so the
 * stamp and the judged-game count are carried out to funnel() and printed rather than assumed. */
let _legal = null;
function illegalTeams() {
  if (_legal) return _legal;
  const r = (config().rules || {}).exclude_illegal_teams;
  const out = { on: !!(r && r.on), ids: new Set(), source: 'data/store-validation.json',
                generated: null, judged_games: 0, classes: (r && r.classes) || [],
                expected: 0, resolved: 0, unresolved: 0, forme_only_skipped: 0, missing: false };
  if (!out.on) { _legal = out; return out; }
  let v;
  try { v = JSON.parse(fs.readFileSync(VALIDATION, 'utf8')); }
  catch (e) {
    /* A MISSING VERDICT IS A RULE THAT DID NOT RUN, AND IT MUST NOT LOOK LIKE A CLEAN STORE.
     * Returning an empty set silently would be the project's signature failure — a capability absent
     * and everything reporting success. It is reported here and `missing` reaches funnel(), which
     * prints NOT APPLIED instead of a zero. */
    out.missing = true;
    console.error(`quality: exclude_illegal_teams is ON but ${out.source} would not read (${e.message}); `
      + `NO game is excluded for legality. Run: node engine/validate_store.js --write`);
    _legal = out; return out;
  }
  const split = v.split || {};
  out.generated = v.generated || null;
  out.judged_games = (v.judged || {}).games || 0;
  const keyed = new Set(out.classes);
  const itemRx = r.item_reason_pattern ? new RegExp(r.item_reason_pattern, 'i') : null;

  /* The species ids are published as a list. The item ids are NOT — the verdict carries only
   * `examples`, which is capped at 500 rows. That cap is why the arithmetic below exists rather than
   * a comment saying it is probably fine. */
  if (keyed.has('species')) for (const id of (split.species_flagged_ids || [])) out.ids.add(id);
  for (const e of (v.examples || [])) {
    const cls = e.classes || [];
    if (!cls.some(c => keyed.has(c))) continue;
    /* Item-ONLY rows must clear the declared-item pattern; a pure forme-requirement row is our
     * closed-sheet convention, not contamination. A row that also shows `species` is already in. */
    if (!cls.includes('species') && cls.includes('item') && itemRx
        && !(e.reasons || []).some(x => itemRx.test(x))) { out.forme_only_skipped++; continue; }
    out.ids.add(e.id);
  }

  /* WHAT THE ARITHMETIC IS FOR. `split.combos` partitions the flagged games exactly, so the number of
   * games carrying a keyed class is known independently of which ids were published. If the resolved
   * set is short, the rule is under-removing and the reason is the examples cap — a shortfall that
   * would otherwise be invisible, because a filter that removes too little still returns a plausible
   * corpus. The fix is for engine/validate_store.js to publish item_flagged_ids beside
   * species_flagged_ids; until then this says how far short it is. */
  for (const [combo, n] of Object.entries(split.combos || {}))
    if (combo.split('+').some(c => keyed.has(c))) out.expected += n;
  out.resolved = out.ids.size;
  out.unresolved = Math.max(0, out.expected - out.resolved - out.forme_only_skipped);
  if (out.unresolved) console.error(
    `quality: exclude_illegal_teams resolved ${out.resolved} of ${out.expected} flagged game ids `
    + `(${out.unresolved} unresolved — data/store-validation.json publishes species_flagged_ids but `
    + `not item_flagged_ids, and its examples list is capped at 500). The filter is UNDER-removing.`);
  _legal = out; return out;
}

/* Did anything actually happen? One move or one switch is enough. Deliberately NOT a turn count:
 * a game can carry turn objects with no action in them, and the question the forfeit rule asks is
 * whether the players produced evidence, not how far the clock got. */
function hadAction(g) {
  for (const t of (g.turns || [])) {
    for (const e of (t.ev || [])) if (e.t === 'm' || e.t === 's') return true;
  }
  return false;
}

// every reason this game is unusable; empty means clean
function reasons(g, cfg, bots) {
  cfg = cfg || config();
  const r = cfg.rules, bad = [];
  if (r.exclude_bot_games.on && ((g.p1 && g.p1.bot) || (g.p2 && g.p2.bot))) bad.push('bot');
  if (bots && ((g.p1 && bots.has(g.p1.name)) || (g.p2 && bots.has(g.p2.name)))) bad.push('behavioural_bot');
  /* A FORFEIT AFTER REAL PLAY IS A RESIGNATION, AND RESIGNATIONS ARE EVIDENCE.
   *
   * This rule used to drop every forfeit, on the stated rationale that "a forfeit records who quit,
   * not who was winning". That rationale was never tested, and it is false in this corpus. Of the
   * 1,528 open-sheet forfeits in which at least one action was taken, the player who quit was:
   *
   *     BEHIND on mons   1,326   86.8%
   *     even               189   12.4%
   *     AHEAD               13    0.9%
   *
   * -- a mean of 1.42 Pokemon down. People resign lost positions; they very rarely quit while
   * winning. Throwing those games away discarded the OUTCOME OF A DECIDED GAME, and it cost 72% of
   * the usable open-sheet corpus (2,114 -> 3,642) in the one regime MAG can actually be fitted on.
   *
   * WILL'S RULE, and it is sharper than a turn threshold: a forfeit BEFORE ANY ACTION does not
   * count, a forfeit after one does. It keys on whether a game happened rather than on an arbitrary
   * turn number. A player who disconnects at team preview produced no evidence about anything; a
   * player who led, traded damage and then conceded produced a result. Measured, only 4 of 1,532
   * forfeits fall on the discard side -- which is the point: the old rule was throwing away 1,528
   * decided games to exclude 4 undecided ones.
   *
   * THE RESIDUAL ERROR IS STATED: 13 games (0.9%) were forfeited by the player who was ahead on
   * material. Those are the genuine "I had to leave" cases and they are now counted as losses for
   * someone who was winning. That is a real 0.9% contamination, and it is smaller by two orders of
   * magnitude than the 72% of evidence the old rule destroyed to avoid it. */
  if (r.exclude_forfeits.on && g.forfeit && !hadAction(g)) bad.push('forfeit_no_action');
  if (r.min_turns.on && (g.turns || []).length < r.min_turns.value) bad.push('short');
  if (r.require_full_bring.on) {
    const br = g.brought || {};
    if ((br.p1 || []).length !== 4 || (br.p2 || []).length !== 4) bad.push('partial_bring');
  }
  /* See illegalTeams() above. Species- and item-level TeamValidator rejections only; move-level
   * rejections are the Illusion signature and are deliberately not keyed. */
  if (r.exclude_illegal_teams && r.exclude_illegal_teams.on && illegalTeams().ids.has(g.id))
    bad.push('illegal_team');
  return bad;
}

const isClean = (g, cfg, bots) => reasons(g, cfg, bots).length === 0;

function loadGames(opts) {
  /* A NON-OBJECT ARGUMENT IS A PROGRAMMING ERROR, NOT A CORPUS SELECTOR.
   *
   * `engine/stab_audit.js` called `loadGames('ots')`, meaning "the open-team-sheet store". A string has
   * no `.path`, so `readStore(undefined)` silently fell back to STORE — the closed-sheet LADDER store.
   * The audit then reported "2,245 clean open-sheet games" when data/games.ots.jsonl holds 4,167 games
   * that are 100% sheeted; what it had actually read was clean LADDER games, of which 116 (5.2%) happen
   * to carry a sheet. Its stated premise — "all four moves public, no revelation bias" — was false for
   * 95% of the sample, and the resulting figure looked entirely plausible.
   *
   * There is no honest default to pick here: guessing which store a caller meant is what produced the
   * defect. Throwing costs one stack trace and stops a wrong number reaching a document. */
  if (opts != null && (typeof opts !== 'object' || Array.isArray(opts))) {
    throw new TypeError(
      `loadGames() takes an options object, not ${JSON.stringify(opts)}. ` +
      `To choose a corpus, pass its path: loadGames({ path: 'data/games.ots.jsonl' }). ` +
      `A bare string silently read the default ladder store and produced a published figure ` +
      `computed on the wrong corpus.`);
  }
  const o = opts || {};
  const games = readStore(o.path);
  if (o.clean === false) return games;
  const cfg = config();
  const bots = behaviouralBots(games, cfg);
  return games.filter(g => isClean(g, cfg, bots));
}

/* THE FUNNEL IS DERIVED FROM reasons(), NOT RE-IMPLEMENTED BESIDE IT.
 *
 * It used to be a second copy of every rule, and the copies drifted the moment one rule changed:
 * when the forfeit rule became "forfeited before anyone acted" the filter honoured it and the funnel
 * did not, so loadGames() returned 2,860 clean open-sheet games while funnel() printed 2,114 on the
 * same store, in the same process. Two different answers to "how many usable games are there", both
 * from the file whose entire purpose is that the question has ONE answer.
 *
 * Each step now asks reasons() whether a game is excluded by the rules applied SO FAR, so a rule can
 * only be stated once. Adding a rule means adding its code here; forgetting to is visible as a step
 * that does not move rather than as a number that is quietly wrong. */
const FUNNEL_STEPS = [
  ['after_bot_filter', 'bot'],
  ['after_behavioural_bots', 'behavioural_bot'],
  ['after_forfeit_filter', 'forfeit_no_action'],
  ['after_min_turns', 'short'],
  ['after_full_bring', 'partial_bring'],
  /* LAST, ON PURPOSE. Every step is cumulative, so inserting a rule earlier would move the number
   * printed against every step below it and break comparison with every funnel recorded before
   * today. Appending leaves the five historical stages meaning exactly what they meant, and the
   * legality drop is read off the bottom of the funnel where it belongs. */
  ['after_legality', 'illegal_team'],
];
function funnel(p) {
  const games = readStore(p), cfg = config();
  const bots = behaviouralBots(games, cfg);
  const all = games.map(g => reasons(g, cfg, bots));
  const out = { collected: games.length };
  const applied = [];
  for (const [label, code] of FUNNEL_STEPS) {
    applied.push(code);
    out[label] = all.filter(rs => !rs.some(x => applied.includes(x))).length;
  }
  out.clean = all.filter(rs => rs.length === 0).length;
  /* A reason that no step accounts for would silently make `clean` smaller than the last step, which
   * reads as a rounding oddity rather than as a missing rule. Named, it reads as what it is. */
  const known = new Set(FUNNEL_STEPS.map(s => s[1]));
  const orphan = [...new Set([].concat(...all))].filter(x => !known.has(x));
  if (orphan.length) out.unaccounted_reasons = orphan;
  /* A FILTER THAT MAKES A NUMBER SMALLER HAS TO SAY WHAT IT REMOVED — count, rate and reason. A
   * corpus that quietly shrinks is indistinguishable from a corpus that got cleaner, and this
   * project has paid for that confusion more than once. Carried on the funnel object so every
   * caller gets it, not only the CLI. */
  const L = illegalTeams();
  out.legality = {
    on: L.on, source: L.source, verdict_generated: L.generated, verdict_judged_games: L.judged_games,
    classes: L.classes, ids_expected: L.expected, ids_resolved: L.resolved,
    ids_unresolved: L.unresolved, forme_only_skipped: L.forme_only_skipped,
    verdict_missing: L.missing,
    removed_from_clean: all.filter(rs => rs.length === 1 && rs[0] === 'illegal_team').length,
    flagged_anywhere: all.filter(rs => rs.includes('illegal_team')).length,
  };
  return out;
}

module.exports = { config, readStore, reasons, isClean, loadGames, funnel, behaviouralBots, illegalTeams, STORE, CONFIG, VALIDATION };

if (require.main === module) {
  const f = funnel(), t = f.collected;
  console.log('GAME QUALITY FUNNEL');
  const rows = [['collected', 'collected from Showdown'],
                ['after_bot_filter', 'after removing NAMED bot games'],
                ['after_behavioural_bots', 'after removing accounts that behave like bots'],
                ['after_forfeit_filter', 'after removing forfeits'],
                ['after_min_turns', 'after removing games under 3 turns'],
                ['after_full_bring', 'after requiring all four brought to be revealed'],
                ['after_legality', 'after removing teams Showdown rejects (species/item)']];
  let prev = t;
  for (const [k, label] of rows) {
    if (!(k in f)) continue;
    const n = f[k], drop = prev - n;
    console.log(`  ${label.padEnd(48)} ${String(n).padStart(6)}  (${(100 * n / t).toFixed(1)}% of collected)` + (drop ? `   -${drop}` : ''));
    prev = n;
  }
  console.log(`\n  USABLE: ${f.clean} of ${t} (${(100 * f.clean / t).toFixed(1)}%)`);

  /* COUNT, RATE AND REASON, or the rule does not get to shrink anything. */
  const L = f.legality || {};
  console.log('\nLEGALITY EXCLUSION');
  if (!L.on) console.log('  OFF — no game is excluded for legality.');
  else if (L.verdict_missing) console.log(`  NOT APPLIED — ${L.source} would not read. Run: node engine/validate_store.js --write`);
  else {
    console.log(`  verdict      ${L.source}  generated ${L.verdict_generated}  (${L.verdict_judged_games.toLocaleString()} games judged)`);
    console.log(`  keyed on     ${L.classes.join(' | ')}   — move-level rejections are NOT keyed (Illusion; see the rule's comment)`);
    console.log(`  ids          ${L.ids_resolved} resolved of ${L.ids_expected} flagged`
      + (L.forme_only_skipped ? `, ${L.forme_only_skipped} skipped as forme-requirement only` : '')
      + (L.ids_unresolved ? `, ${L.ids_unresolved} UNRESOLVED (under-removing)` : ''));
    console.log(`  removed      ${L.removed_from_clean} games that passed every other rule `
      + `(${(100 * L.removed_from_clean / Math.max(1, f.after_full_bring)).toFixed(3)}% of the previously-clean corpus)`);
    console.log(`  flagged      ${L.flagged_anywhere} of ${t.toLocaleString()} collected `
      + `(${(100 * L.flagged_anywhere / t).toFixed(3)}%) — the rest were already excluded by another rule`);
    if (L.verdict_judged_games && L.verdict_judged_games < t)
      console.log(`  UNJUDGED     ${(t - L.verdict_judged_games).toLocaleString()} games arrived after the verdict `
        + `was generated and have not been checked at all.`);
  }
}
