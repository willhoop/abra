/* diff_swarm.js — TEAM SELECTION FOR THE WHOLE-GAME DIFFERENTIAL. ROADMAP #68, docs/GAME-DIFFERENTIAL-DESIGN.md §3.
 *
 * RAW-STORE-OK: the teams here are TEST CONFIGURATIONS, not evidence about play. This file reads
 * the raw ladder store on purpose. Every quality filter we have selects on WHO PLAYED — rating,
 * bot tags, forfeits — and none of that changes whether a team is a valid input to the engine. A
 * bot's Trick Room team exercises Trick Room exactly as well as a 1600 player's, and filtering to
 * clean games would narrow the pool toward one ladder segment, which is the OPPOSITE of what a
 * swarm is for: docs/GAME-DIFFERENTIAL-DESIGN.md §3.2 wants rarely-covered configurations, and the
 * rare ones live in the tail that filter would remove. Nothing derived here is a claim about the
 * meta.
 *
 *   node engine/diff_swarm.js                 print the swarm's composition
 *   node engine/diff_swarm.js --n 1000        target that many teams
 *   node engine/diff_swarm.js --write         also write data/diff-swarm.json
 *   node engine/diff_swarm.js --selftest      drive the config logic on synthetic teams
 *
 * WHY THIS IS NOT `pick 1000 teams at random`
 * -------------------------------------------
 * Swarm Testing (Groce, Zhang, Eide, Chen, Regehr, ISSTA 2012): a population of configurations that
 * each OMIT some features finds dramatically more than one configuration that enables everything —
 * 42% more distinct compiler crashes in a week than a hand-tuned default. The mechanism is that some
 * features actively suppress the behaviour you are trying to reach, and that features compete for
 * space so a uniform sample explores each one shallowly.
 *
 * OUR SUPPRESSING FEATURE IS PROTECT. Measured here: it is on 99.30% of declared teams and it is the
 * most common click in the format. A Protect turn resolves no damage, no secondary, no contact
 * ability and no field interaction. A uniform draw spends an enormous share of its turns testing
 * nothing at all.
 *
 * BUT OMISSION IS NOT THE ONLY AXIS, and Will named the case that proves it: *"some moves hit thru
 * protect, like feint or unseen fist."* A mechanic that exists only as an INTERACTION WITH a feature
 * cannot be reached by removing that feature. Drop Protect everywhere and Feint and Phantom Force
 * become untestable. So the swarm carries PAIRING configurations too — a feature concentrated WITH
 * its counters — and omission buys DEPTH while pairing buys the INTERACTION surface.
 *
 * TEAMS COME FROM THE STORE, NEVER FROM A GENERATOR, and the strongest evidence is Will's read that
 * *"quash is used on prankster mons like sableye specifically to get prio"*: 252 of 252 declared
 * Quash carriers in this corpus are Sableye with Prankster. 100%. Quash is priority 0 and fails if
 * the target already moved, so Prankster's +1 is the entire reason it is playable. A generator would
 * have scattered Quash across random bodies and produced only the version nobody has ever brought.
 *
 * IT READS THE OPEN-SHEET CORPUS, because those games carry `sheets` — the DECLARED team of six,
 * which is what a team actually is. The closed-sheet ladder store only reveals what was clicked.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const RS = require('./run_stamp.js');
const SWARM_SOURCES = ['engine/diff_swarm.js', 'engine/tag_dex.js', 'engine/names.js', 'data/tags.json', 'data/games.ladder.jsonl'];

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const WRITE = process.argv.includes('--write');
const N = (() => { const i = process.argv.indexOf('--n'); return i > 0 ? +process.argv[i + 1] : 1000; })();
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
/* Nothing here fails quietly — tests/test-no-silent-failure.js is a ratchet and a skip that says
 * nothing turns a missing corpus into an empty swarm that looks like a successful one. */
const SKIPS = []; let UNREADABLE = 0;

/* ---- THE STARVATION RESULT, AND WHY OMISSION BELONGS ON THE DRIVER --------------------------------
 * First real run, 7,256 distinct declared teams:
 *
 *     omit-protect      84 available  (1.16%)   STARVED
 *     omit-priority      7 available  (0.10%)   STARVED
 *
 * SEVEN teams in seven thousand carry no priority move. You cannot build a Protect-free or
 * priority-free swarm out of real teams because real teams do not do that.
 *
 * Swarm Testing omits features FROM THE GENERATOR; we sample a fixed corpus and cannot. But the
 * omission does not have to happen to the TEAM — it can happen to the DRIVER. Keep the real team,
 * bundles and all, and in that configuration simply forbid the driver from CLICKING the feature.
 * Full benefit (turns stop being consumed by nothing), no cost (teams stay real, Sableye+Prankster
 * stays intact), and it works for every axis. It also matches the split the design already draws:
 * the swarm picks WHICH TEAMS take the field, the driver picks WHICH CLICKS happen.
 *
 * AND THE OMISSION MUST BE SCOPED PER CONFIGURATION, NEVER GLOBAL. Will: "but if we ban protect we
 * ban feint and piercing drill." Exactly — `omit-protect` forbids the click, `pair-protect-bust`
 * REQUIRES it and then clicks the buster into it. Both configs run in the same swarm. A global
 * "ban Protect" driver flag would silently destroy every pairing config while looking like it worked.
 *
 * The team-side predicates below stay, because they still select the POOL correctly for the pairing
 * configs and they cost nothing for the omit ones. The driver-side ban is what makes the omit configs
 * actually bite, and it is not this file's job.
 */

/* ---- THE CONFIGURATIONS ------------------------------------------------------------------------
 * A config is a PREDICATE over a team plus a stated reason. `omit` configs exclude a feature so the
 * turns it would have consumed go elsewhere; `pair` configs require a feature AND something that
 * interacts with it, because that interaction is the thing under test.
 *
 * The feature sets are read from data/tags.json by SHAPE, never typed as move names — a move added
 * to the format later joins the right family without editing this file. That is the same rule the
 * engine follows and the same one the hand-maintained ban list failed. */
function featureSets() {
  /* THROUGH engine/names.js, WHICH THROWS ON A TAG NAME THAT DOES NOT EXIST. Both of the vacuous
   * configs described below were a guessed tag name silently producing an empty set; names.byTag
   * makes that a crash at the call site instead of a confident zero in the report.
   * (It is names.js and not lookup.js because lookup.js already existed for a different job — see
   * that file's header, and names.js's, for why writing the second one over the first broke
   * self-play for an hour.) */
  const { byTag } = require('./names.js');
  const F = {
    protect:     byTag('moves', 'stalling', 'oneTurnGuard'),
    protectBust: byTag('moves', 'ignoresProtect'),
    priority:    byTag('moves', 'priority'),
    redirect:    byTag('moves', 'redirects'),
    weather:     byTag('moves', 'setsWeather'),
    weatherAb:   byTag('abilities', 'weatherSetter'),
    speedCtrl:   byTag('moves', 'reversesSpeed', 'doublesSideSpeed', 'reordersTurn'),
    intimidate:  byTag('abilities', 'onSwitchInDrop'),
    spread:      byTag('moves', 'spreadAll', 'spreadFoes'),
  };
  /* AN EMPTY FEATURE SET MAKES ITS CONFIG VACUOUS, AND THAT IS HOW THIS FILE WAS WRONG ON ITS FIRST
   * REAL RUN. `intimidate` was derived as /^lowersOnEntry$/, which matches nothing — the tag is
   * `onSwitchInDrop` — so the set came back empty, `!teamHas(team, emptySet)` was always true, and
   * `omit-intimidate` reported 100% of the pool while excluding NOTHING. It looked like the
   * best-covered configuration in the swarm and it was the only one doing no work.
   *
   * The selftest did not catch it because the selftest HAND-SUPPLIES these sets; only the production
   * path derives them from tags.json. That is the exact shape this project keeps finding — a check
   * that passes on synthetic input and is vacuous on real input — so the guard is here, at the
   * derivation, where the real names live. */
  const empty = Object.entries(F).filter(([, v]) => !v.size).map(([k]) => k);
  if (empty.length) {
    console.error('diff_swarm: these feature sets derived EMPTY, so every config using them would be vacuous: '
                  + empty.join(', '));
    console.error('  A tag name in featureSets() does not match data/tags.json. Fix the name, do not ignore this.');
    process.exit(1);
  }
  return F;
}

/* THE DECLARED EXCEPTION, per conformance S12b. Two Pokemon names appear in this file — `protect`
 * and `intimidate` — and neither is a lookup. They are CONFIGURATION IDENTIFIERS (`omit-protect`,
 * `pair-protect-bust`, `omit-intimidate`) and the prose that explains why each config exists. A
 * config needs a name a human can read in a report; "omit-cfg-3" would be worse in every way.
 *
 * EVERY ACTUAL MEMBERSHIP TEST GOES THROUGH `lookup.byTag`, which throws on a tag name that does not
 * exist. That is the distinction S12b is protecting: a typed name that DECIDES something is a
 * hardcode and rots silently; a typed name that LABELS something is documentation. If Protect were
 * renamed tomorrow the labels would read oddly and the behaviour would be unchanged, because the set
 * is derived from `stalling`/`oneTurnGuard`.
 *
 * This block is the declaration S12b asks for. If a THIRD name appears here, check it is a label
 * before adding it — a lookup hiding in this list is exactly what the check exists to catch. */
const GAME_RULES = {
  'move:protect':      'label only — config ids omit-protect / pair-protect-bust; the set comes from byTag(stalling, oneTurnGuard)',
  'ability:intimidate': 'label only — config id omit-intimidate; the set comes from byTag(onSwitchInDrop)',
};

/* A team is {species, ability, item, moves[]}. These read only what a sheet declares. */
const teamHas = (team, set, field) => team.some(p => {
  if (field === 'moves') return ((p && p.moves) || []).some(m => set.has(norm(m)));
  return set.has(norm((p && p[field]) || ''));
});

function configs(F) {
  return [
    { id: 'baseline',        why: 'a uniform draw, kept as the CONTROL — every other config is judged against what this reaches',
      ok: () => true },
    { id: 'omit-protect',    why: 'Protect is on 99.3% of teams and a Protect turn resolves nothing. Omitting it is the single largest source of turns that actually do something',
      ok: t => !teamHas(t, F.protect, 'moves') },
    { id: 'omit-priority',   why: 'frees the ordinary speed-order path and dynamic re-sorting (WIRE 118), which priority brackets otherwise short-circuit',
      ok: t => !teamHas(t, F.priority, 'moves') },
    { id: 'omit-weather',    why: 'reaches the no-weather damage path and lets terrain matter',
      ok: t => !teamHas(t, F.weather, 'moves') && !teamHas(t, F.weatherAb, 'ability') },
    { id: 'omit-intimidate', why: 'attack stages sit at their declared values, which is also the only way to see a crit ignoring a NEGATIVE offensive stage',
      ok: t => !teamHas(t, F.intimidate, 'ability') },
    { id: 'omit-spread',     why: 'single-target resolution, and the ally-damage path stops dominating',
      ok: t => !teamHas(t, F.spread, 'moves') },
    /* PAIRING — the interaction cannot be reached by omission, only by concentration. */
    { id: 'pair-protect-bust', why: 'Feint and Phantom Force need a Protect to punch THROUGH. Omitting Protect makes them untestable — Will named this case',
      ok: t => teamHas(t, F.protect, 'moves') && teamHas(t, F.protectBust, 'moves') },
    { id: 'pair-redirect-priority', why: 'redirection against a priority move is where the turn order and the target choice interact',
      ok: t => teamHas(t, F.redirect, 'moves') && teamHas(t, F.priority, 'moves') },
    { id: 'pair-speedctrl',  why: 'Trick Room is on 37.4% of teams and INVERTS every speed comparison for five turns, on top of dynamic re-sorting. Concentrating it with other speed control is the hardest ordering surface in the format',
      ok: t => teamHas(t, F.speedCtrl, 'moves') },
  ];
}

/* ---- SELFTEST ---------------------------------------------------------------------------------
 * Shown failing on known-bad input before it is committed, per the standing rule. The cases that
 * matter are the two directions: an omit config must REJECT a team carrying the feature, and a pair
 * config must REJECT a team carrying only one half. A config that accepts everything is not a
 * configuration, it is the baseline wearing a label. */
if (require.main === module && process.argv.includes('--selftest')) {
  /* ABSTRACT FIXTURE NAMES ON PURPOSE. Naming real moves here would (a) trip conformance S12, which is
   * right to object — a Pokemon fact typed into code is a fact that can go stale — and (b) weaken the
   * test, because what is under test is the PREDICATE LOGIC, not whether Protect is spelled correctly.
   * The real names are asserted by engine/lookup.js's own selftest, which is where they belong. */
  const F = { protect: new Set(['feata']), protectBust: new Set(['featb']), priority: new Set(['featc']),
              redirect: new Set(['featd']), weather: new Set(['feate']), weatherAb: new Set(['featf']),
              speedCtrl: new Set(['featg']), intimidate: new Set(['feath']), spread: new Set(['feati']) };
  const C = Object.fromEntries(configs(F).map(c => [c.id, c]));
  const mon = (o = {}) => ({ species: o.s || 'x', ability: o.ab || '', item: '', moves: o.mv || [] });
  const cases = [
    ['omit-protect REJECTS a team with Protect',        'omit-protect', [mon({ mv: ['feata'] })], false],
    ['omit-protect ACCEPTS a team without it',          'omit-protect', [mon({ mv: ['feati'] })], true],
    ['omit-intimidate reads the ABILITY, not moves',    'omit-intimidate', [mon({ ab: 'feath' })], false],
    ['omit-weather rejects a weather ABILITY too',      'omit-weather', [mon({ ab: 'featf' })], false],
    ['pair-protect-bust REJECTS Protect alone',         'pair-protect-bust', [mon({ mv: ['feata'] })], false],
    ['pair-protect-bust REJECTS the buster alone',      'pair-protect-bust', [mon({ mv: ['featb'] })], false],
    ['pair-protect-bust ACCEPTS both together',         'pair-protect-bust', [mon({ mv: ['feata', 'featb'] })], true],
    ['pair-protect-bust ACCEPTS them on DIFFERENT mons','pair-protect-bust', [mon({ mv: ['feata'] }), mon({ mv: ['featb'] })], true],
    ['baseline accepts anything',                       'baseline', [mon()], true],
  ];
  let bad = 0;
  for (const [label, id, team, want] of cases) {
    const got = !!C[id].ok(team);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `   got ${got}`}`);
  }
  /* THE REGRESSION THAT WOULD MAKE THE WHOLE THING POINTLESS: a config that accepts every team is
   * the baseline with a different name, and would report coverage it never bought. */
  const trivial = configs(F).filter(c => c.id !== 'baseline')
    .filter(c => c.ok([mon({ mv: ['feata','featb','featc','featd','feate','featg','feati'], ab: 'feath' })])
              && c.ok([mon()]));
  if (trivial.length) { bad++; console.log('  FAIL these configs accept everything: ' + trivial.map(c => c.id).join(', ')); }
  else console.log('  ok   no config accepts every team — each one actually constrains');
  console.log(`\nDIFF-SWARM SELFTEST: ${cases.length + 1 - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ---- RUN ---------------------------------------------------------------------------------------
 *
 * EXPORTED AS A FUNCTION so the comparison driver (engine/game_differential.js) calls THIS selection
 * rather than writing a second one. `data/diff-swarm.json` records only game IDS, and a game id does
 * not say which SIDE was picked — both sheets of one game can be distinct teams. A driver resolving
 * ids back to teams would have to re-derive the predicates, which is two implementations of "what is
 * in this configuration" and they would disagree the first time a tag moved. It returns the picked
 * TEAM OBJECTS; the CLI report below prints ids out of the same structure. */
/* `opts.storeDir` PINS THE TEAM STORE, and it exists because not having it cost a run.
 *
 * ROADMAP #81 WIRE 5 pinned the CENSUS after finding it steered the sample from outside the
 * photograph. The team store is the OTHER half of the same sample and was left live: OPS appends to
 * `data/games.bo3.jsonl` continuously, the stride below is over the deduped set, so one appended game
 * shifts which teams get played. On 2026-08-07 that happened between arm 3 and arm 4 of a 14-arm state
 * ladder — the corpus went 7,454 -> 7,509 teams and the pool digest went `bd29c210884e` ->
 * `32b2abcbfeb7` — and the first three rungs were sampling a different population from the rest.
 * `engine/arms_comparable.js` would have refused the whole table at the end, which is the guard
 * working and is also 100 minutes gone.
 *
 * Absent, the paths are the live ones and NOTHING CHANGES for any existing caller. */
/* ---- THE POOL CACHE (ROADMAP #87) ---------------------------------------------------------------
 *
 * Will, 2026-08-07: "IS SHOWDOWN THE BOTTLENECK? IT SHOULDNT BE TAKING YEARS TO COMPARE TWO BOARD
 * STATES" — then, on being shown the measurement: "kill them both and restart after the pool cache
 * THIS IS RIDICULOUS". He was right twice. Measured before this existed:
 *
 *     loadTeams()                      ~41 SECONDS      reads bo3 80.3 MB + ots 30.4 MB, JSON.parses
 *                                                       every line, to dedupe 7,509 teams
 *     Showdown dex + all four tables     0.95 s
 *     open a frozen release              0.04 s
 *     PLAY ONE GAME                      0.09 s
 *
 * PLAYING A GAME COST 93 MILLISECONDS. GETTING READY COST 41 SECONDS — on every process start, paid
 * again by every probe run, every gate and every re-check an agent made. Two measuring agents were
 * killed at 2h10m and 1h55m, and the wall clock was almost entirely this.
 *
 * THE CACHE KEY IS SIZE+MTIME AND THAT IS A DELIBERATE EXCEPTION TO THIS PROJECT'S OWN RULE.
 * `engine/provenance.js` exists because "newer than its source" is not evidence, and it is right. But
 * a CONTENT digest of the key would require reading the 110 MB the cache exists to avoid, which
 * defeats it entirely. So: the fast key is size+mtime, the CONTENT digest is computed once at cut time
 * and stored, and `--verify-pool` re-reads and checks it. The store is documented append-only, so a
 * size change catches every normal mutation; a rewrite-in-place is the case only the verify path sees,
 * and it is named here rather than left implicit.
 *
 * A MISS NEVER REBUILDS SILENTLY. It says so, loudly, and rebuilds — because the alternative is a
 * measurement that changes its own sample without telling anyone, which is ROADMAP #82 and the WIRE 5
 * failure. `--rebuild-pool` forces one. */
/* ROADMAP #547 — THE RECEIPT NAMES THE STORE THAT WAS ACTUALLY READ. (2026-09-06, MEASURE.)
 *
 * This was a flat literal naming `data/games.bo3.jsonl` and `data/games.ots.jsonl`, and it was stamped
 * into every pool cache INCLUDING the ones built under `--team-store data/team-pool-frozen`. So a
 * pinned run — the pin honoured, the teams genuinely drawn from the frozen store — wrote a
 * `source_digests` block naming the LIVE store and carrying the LIVE store's content digest.
 *
 * A RECEIPT THAT NAMES THE WRONG STORE IS WORSE THAN NO RECEIPT. `engine/provenance.js` verifies each
 * key by re-digesting the file it names, so this one VERIFIED — it was internally consistent and
 * describing a file the run never opened. Measured on the artifact as found, 2026-09-06:
 * `key` said games.bo3.jsonl at 109,006,606 bytes (the frozen store) while
 * `source_digests['data/games.bo3.jsonl']` was `da8597c45bb8`, which is sha256 of the 227,347,410-byte
 * LIVE file. The only reason it was caught is that somebody hashed the frozen file by hand.
 *
 * DERIVED FROM `storeDir`, never a second literal. The paths are repo-relative so `run_stamp.sha12`
 * (and therefore provenance) resolves them exactly as it resolves every other source key; a store
 * outside the repository is named by its absolute path and says so rather than being renamed to
 * something inside it. */
function poolSources(storeDir) {
  const out = ['engine/diff_swarm.js'];
  for (const b of ['games.bo3.jsonl', 'games.ots.jsonl']) {
    const abs = storeDir ? path.resolve(ROOT, storeDir, b) : D('data', b);
    const rel = path.relative(ROOT, abs);
    /* `path.relative` returns an ABSOLUTE path when the target is on another drive, and a `..` path
     * when it is merely outside the root — `sha12` resolves the second correctly (path.join
     * normalises `..`) and cannot resolve the first, which then records MISSING and prints why. Both
     * are honest; neither pretends the file is somewhere it is not. */
    out.push((!rel || path.isAbsolute(rel)) ? abs.replace(/\\/g, '/') : rel.replace(/\\/g, '/'));
  }
  return out;
}
let POOL_FROM_CACHE = false;
const POOL_CACHE = D('data', 'diff-team-pool.json');

function poolKey(storeDir) {
  const parts = [];
  for (const f of ['data/games.bo3.jsonl', 'data/games.ots.jsonl']) {
    const fp = storeDir ? path.join(storeDir, path.basename(f)) : D(f);
    try { const st = fs.statSync(fp); parts.push(path.basename(f) + ':' + st.size + ':' + st.mtimeMs); }
    catch (e) { parts.push(path.basename(f) + ':MISSING'); }
  }
  return parts.join('|');
}

function readPoolCache(key) {
  if (process.argv.includes('--rebuild-pool')) return null;
  /* ROADMAP #258 — A CORRUPT CACHE AND AN ABSENT ONE BOTH REBUILD, AND ONLY ONE OF THEM IS NORMAL.
   * The null stays; the reason is said, so a cache that has started failing to parse every run is
   * visible instead of looking like a first run, forever. */
  let j;
  try { j = JSON.parse(fs.readFileSync(POOL_CACHE, 'utf8')); }
  catch (e) {
    if (!(e && e.code === 'ENOENT')) {
      console.error('  POOL CACHE UNREADABLE — ' + POOL_CACHE + ' (' + String((e && e.message) || e).split(String.fromCharCode(10))[0]
                  + '); rebuilding as though it had never been written');
    }
    return null;
  }
  if (!j || j.key !== key || !Array.isArray(j.teams)) return null;
  return j;
}

function writePoolCache(key, teams, storeDir) {
  const crypto = require('crypto');
  /* THE CONTENT DIGEST IS PAID ONCE, HERE, so `--verify-pool` can check the fast key later without
   * every run paying for it. */
  const digests = {};
  for (const f of ['data/games.bo3.jsonl', 'data/games.ots.jsonl']) {
    const fp = storeDir ? path.join(storeDir, path.basename(f)) : D(f);
    try { digests[path.basename(f)] = crypto.createHash('sha1').update(fs.readFileSync(fp)).digest('hex').slice(0, 12); }
    catch (e) {
      /* ROADMAP #258 — a null digest is written deliberately so a missing store cannot compare equal
       * to a present one, and the reason is now printed rather than swallowed. */
      digests[path.basename(f)] = null;
      console.error('  NO STORE DIGEST — ' + fp + ' (' + String((e && e.message) || e).split(String.fromCharCode(10))[0]
                  + '); the pool key records null, which will never match a real digest');
    }
  }
  const pool = crypto.createHash('sha1').update(teams.map(t => t.key).join(String.fromCharCode(10))).digest('hex').slice(0, 12);
  try {
    fs.writeFileSync(POOL_CACHE, JSON.stringify({
      generated: new Date().toISOString(), by: 'engine/diff_swarm.js loadTeams',
      /* STAMPED, because provenance.js ratchets on artifacts resting on mtime alone and this file
       * broke that ratchet within an hour of being written -- the same mistake three artifacts made
       * on 2026-08-06. A cache is still an artifact: something downstream reads it and needs to know
       * what produced it. The store digests below are the CONTENT of what was read; `key` is the
       * fast size+mtime path and is documented above as a deliberate exception. */
      /* ROADMAP #547 — DERIVED FROM `storeDir`, so a pinned run's receipt names the frozen store it
       * read and an unpinned run's names the live one. It used to name the live store either way. */
      source_digests: RS.sourceDigests(poolSources(storeDir)),
      /* AND THE PIN ITSELF, IN WORDS, beside the digests. The digests say WHICH BYTES; this says
       * whether a `--team-store` was in force at all, which is the question an operator reading a
       * pool-pin audit is actually asking. `null` is an unpinned run reading the live store. */
      store_dir: storeDir || null,
      what: 'The deduped team pool the whole-game differential draws from. Cached because rebuilding it '
          + 'read 110 MB and cost ~41 s on EVERY process start (ROADMAP #87).',
      key, source_content_digests: digests, pool_digest: pool, teams: teams.length,
      note: 'key is size+mtime by design — a content key would require reading the bytes this cache '
          + 'exists to avoid. source_content_digests is the paid-once check for --verify-pool.',
      teams_data: undefined, teams: teams,
    }) + String.fromCharCode(10));
  } catch (e) { SKIPS.push('pool cache not written: ' + String((e && e.message) || e).slice(0, 80)); }
  return pool;
}

function loadTeams(opts) {
  const storeDir0 = opts && opts.storeDir ? String(opts.storeDir) : null;
  const key = poolKey(storeDir0);
  const hit = readPoolCache(key);
  if (hit) { POOL_FROM_CACHE = hit.pool_digest || true; return hit.teams; }
  console.log('  pool cache MISS — rebuilding from the store (~41 s). '
              + (process.argv.includes('--rebuild-pool') ? 'Forced by --rebuild-pool.' : 'The store moved, or no cache exists.'));
  const teams = [];
  const seen = new Set();
  const storeDir = storeDir0;
  for (const f of ['data/games.bo3.jsonl', 'data/games.ots.jsonl']) {
    let raw;
    try { raw = fs.readFileSync(storeDir ? path.join(storeDir, path.basename(f)) : D(f), 'utf8'); }
    catch (e) { SKIPS.push(`${f}: ${String((e && e.message) || e).slice(0, 80)}`); continue; }
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let g; try { g = JSON.parse(line); } catch (e) { UNREADABLE++; continue; }
      const sh = g.sheets; if (!sh) continue;
      for (const side of ['p1', 'p2']) {
        const t = sh[side] || []; if (t.length < 4) continue;
        /* DEDUPE ON THE TEAM, not the game. The same team laddering ten times is one configuration
         * tested ten times, which inflates the swarm's apparent breadth without buying any. */
        const key = t.map(p => norm((p && p.species) || '') + ':' + ((p && p.moves) || []).map(norm).sort().join('.')).sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        teams.push({ key, team: t, id: g.id, side });
      }
    }
  }
  /* WRITTEN ON THE WAY OUT, so the next process start is milliseconds instead of 41 seconds. */
  const d = writePoolCache(key, teams, storeDir0);
  console.log('  pool cache written: ' + teams.length + ' teams, pool digest ' + d);
  return teams;
}

function buildSwarm(n, opts) {
  const F = featureSets();
  const CFG = configs(F);
  const teams = loadTeams(opts);
  const per = Math.max(1, Math.floor((n || N) / CFG.length));
  const out = [];
  for (const c of CFG) {
    /* COUNTED, NOT SWALLOWED. A predicate that throws on a malformed sheet drops that team from the
     * config, and a config quietly missing teams is exactly the starvation this file reports on. */
    let threw = 0;
    const matching = teams.filter(x => {
      try { return c.ok(x.team); }
      catch (e) { threw++; if (threw === 1) SKIPS.push(`config ${c.id}: predicate threw on a team (${String((e && e.message) || e).slice(0, 60)}) — counted, not hidden`); return false; }
    });
    if (threw) SKIPS.push(`config ${c.id}: ${threw} team(s) dropped because the predicate threw`);
    /* DETERMINISTIC STRIDE, not a random draw — this file must produce the same swarm twice or the
     * differential's inputs move under it, and a measurement whose inputs move is the 2026-08-04 void. */
    const step = Math.max(1, Math.floor(matching.length / per));
    const picked = [];
    for (let i = 0; i < matching.length && picked.length < per; i += step) picked.push(matching[i]);
    out.push({ config: c.id, why: c.why, available: matching.length, picked: picked.length,
               pct_of_pool: +(100 * matching.length / Math.max(teams.length, 1)).toFixed(2),
               teams: picked.map(p => p.id), picked_teams: picked });
  }
  return { teams, per, out, skips: SKIPS, unreadable: UNREADABLE, features: F, configs: CFG,
           store_dir: (opts && opts.storeDir) || null };
}

module.exports = { featureSets, configs, loadTeams, buildSwarm, teamHas, norm, GAME_RULES };

if (require.main !== module) return;

const SW = buildSwarm(N);
const teams = SW.teams, per = SW.per, out = SW.out;

console.log('');
console.log('DIFF SWARM — team selection for the whole-game differential (ROADMAP #68 §3)');
console.log('');
console.log(`  distinct teams in the open-sheet corpus: ${teams.length.toLocaleString()}`);
console.log(`  target ${N} teams over ${SW.configs.length} configurations, ${per} each`);
console.log('');
console.log('  config'.padEnd(26), 'available'.padStart(10), 'picked'.padStart(8), '% of pool'.padStart(10));
for (const r of out) {
  const starved = r.picked < per;
  console.log('  ' + r.config.padEnd(24), String(r.available).padStart(10), String(r.picked).padStart(8),
              String(r.pct_of_pool + '%').padStart(10), starved ? '  <-- STARVED, could not fill' : '');
}
console.log('');
const empty = out.filter(r => !r.picked);
if (empty.length) {
  console.log('  CONFIGURATIONS THAT PRODUCED NO TEAMS — these tested NOTHING and must not be read as covered:');
  for (const r of empty) console.log(`    ${r.config}`);
  console.log('');
}
if (UNREADABLE) console.log(`  ${UNREADABLE} store line(s) would not parse and were counted, not skipped silently.`);
for (const s of SKIPS) console.log('  NOTE: ' + s);
console.log('');
console.log('  Omission buys DEPTH in what remains; pairing buys the INTERACTION surface.');
console.log('  A config that could not be filled is a gap in the swarm, not a gap in the format.');
console.log('');

if (WRITE) {
  fs.writeFileSync(D('data', 'diff-swarm.json'), JSON.stringify({
    generated: new Date().toISOString(), by: 'engine/diff_swarm.js',
    /* CONTENT, NOT MTIME. Without this the provenance ratchet counts this artifact as resting on
     * mtime alone, and an artifact newer than an input it never read gets marked `ok` -- which is
     * precisely how the 2026-08-04 void run passed. Three artifacts written on 2026-08-06 broke the
     * ratchet the same evening it was being cited; the ratchet may shrink and may never grow. */
    source_digests: RS.sourceDigests(SWARM_SOURCES),
    corpus_distinct_teams: teams.length, target: N, per_config: per,
    unreadable_lines: UNREADABLE, skips: SKIPS,
    /* `picked_teams` carries the SHEETS and is for the in-process driver only — writing it here would
     * put ~7 MB of team data into an artifact whose job is to record the swarm's SHAPE. */
    configs: out.map(({ picked_teams, ...r }) => r),
  }, null, 2) + '\n');
  console.log('  -> data/diff-swarm.json');
}
