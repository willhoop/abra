/* champions_sim.js — run real Champions battles through Showdown's OFFICIAL simulator.
 *
 * WHY THIS EXISTS (see docs/ADR-001-use-the-champions-mod.md, then
 * docs/ADR-002-showdown-is-the-authority.md, which supersedes its migration half)
 * ----------------------------------------------------------
 * ADR-002, 2026-08-05: this file stays the AUTHORITY and `medicham2-browser.js` stays the RUNTIME.
 * ADR-001 planned to demote the hand-written engine to a lookup table; that never happened and is
 * now formally withdrawn, for two measured reasons. Its premise — "fixing this engine by hand was
 * never going to converge" — was falsified: the engine now agrees with this one on 149/150 damage
 * rows and 899/899 interaction pairs, once instruments existed to point at. And the 117x slowdown
 * this file carries cannot sit beneath MILTANK, a search player that did not exist when ADR-001 was
 * written and that plays positions out thousands of times per turn. Nothing here is demoted: every
 * disagreement is still MEDICHAM's bug by construction, and the honest claim is agreement on the
 * 1,514 pairs that ran, not on the 8,506 that exist.
 * ----------------------------------------------------------
 * `medicham2-browser.js` is a rules engine written by hand. In one session it was found to apply a
 * uniformly random status, to flinch only on Fake Out, to ignore every type immunity, to treat all
 * fourteen negative-priority moves as priority 0, and to apply Intimidate with the wrong SIGN against
 * Defiant. Correcting those changed P(win) by 4.35 points on average across 120 real matchups and
 * flipped the favourite in 9.2% of them.
 *
 * Showdown's `champions` mod implements this exact format - `gen9championsvgc2026regmb` is the format
 * id on every replay in our store. Running the real simulator removes an entire class of defect
 * rather than fixing them one at a time.
 *
 * SPEED, MEASURED. 29 battles/sec/core versus 3,401 for the hand-written engine: 117x slower. That is
 * fine for offline batch work (the 927-game backtest is ~7 minutes on 8 cores) and impossible for a
 * live browser click. So this module is for OFFLINE precomputation only. Nothing here should ever be
 * on a request path.
 *
 * REQUIRES a built checkout of pokemon-showdown master. Point SHOWDOWN_PATH at it.
 *
 * THIS SENTENCE USED TO READ "because the champions mod is NOT in the published npm package (0.11.10
 * does not contain it)", AND THAT IS NO LONGER TRUE. Measured 2026-09-08 and corrected here the same
 * day: `data/verification/npm-oracle-2026-09-08/npm-oracle-legality.json` compares published
 * `pokemon-showdown@0.11.11` against this checkout and reports `LEGAL_SETS_IDENTICAL: true` — 347
 * species, 500 moves, 148 items, 316 abilities, an identical resolved rule table, all three Champions
 * formats defined identically, 14,192 learnset cells with 0 diffs. The package DOES carry the mod.
 * The checkout is still what this project measures against, because it is pinned BY COMMIT and a
 * dist-tag is not a pin — not because the package cannot play this format. A stale claim in a header
 * reads exactly as authoritative as a measured one, which is why it is corrected rather than deleted.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node engine/champions_sim.js
 */
'use strict';
require('./showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
/* fs WAS USED AND NEVER IMPORTED. The read of data/regulations.json below therefore threw on every
 * call, and the hardcoded format literal in the catch is the only path that has ever run. It happens
 * to be correct today; it becomes wrong the moment Reg M-B rotates, which is precisely what this
 * file's header says it exists to prevent. Whole-repo review, 2026-07-31. */
const fs = require('fs');
const path = require('path');

/* THE FORMAT ID LIVES IN ONE PLACE (S12) AND THIS IS NOT IT.
 *
 * It was a literal here, and copied into a dozen other files besides — analyze.js, chomp_ev.js,
 * ingest_ots.js, the site, the dataset generator. When Reg M-B rotates, every one of those keeps
 * describing a metagame that no longer exists, and nothing notices because a stale format id
 * produces plausible output rather than an error.
 *
 * data/regulations.json is the single source: it names the active regulation, its Showdown format,
 * its Bo3 format and its start date, and engine/durable-ingest.js and engine/fetch_smogon_stats.js
 * already read it. This now does too, and everything downstream imports FORMAT from here rather than
 * restating it. The literal survives only as the fallback for a corrupt config, which is the one case
 * where guessing beats crashing a collection job. */
/* AND THE FALLBACK IS LOUD, 2026-09-08. It was a bare `catch (e) { }` returning the literal, which is
 * a silent default wearing the shape of a working feature — the one failure mode this project keeps
 * paying for. It has never fired (regulations.json parses), and if it ever does the run says so on
 * stderr and `FORMAT_FALLBACK` records why, so `verify()` can report it rather than a reader having to
 * guess. Guessing still beats crashing a collection job; guessing SILENTLY does not. */
let FORMAT_FALLBACK = null;
const FORMAT = (() => {
  let why = null;
  try {
    const r = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'regulations.json'), 'utf8'));
    const a = r.regulations[r.active] || {};
    if (a.showdownFormat) return a.showdownFormat;
    why = 'data/regulations.json names active="' + r.active + '" and that entry has no showdownFormat';
  } catch (e) { why = 'could not read data/regulations.json: ' + ((e && e.message) || e); }
  FORMAT_FALLBACK = why;
  console.error('champions_sim: FALLING BACK to a hardcoded format id — ' + why);
  return 'gen9championsvgc2026regmb';
})();
// Pinned, not floating: the mod lives only on master, so there is no version number to depend on.
const PINNED_COMMIT = '20ad99ffc9a5a4a4e8fb56ab04ad8e4255b3f2b4';
const PINNED_DATE = '2026-07-22';

/* THE DEFAULT USED TO BE `/tmp/ps`, WHICH CANNOT EXIST ON THE MACHINE THIS PROJECT RUNS ON.
 *
 * Six tests need the simulator and every one of them SKIPS politely when it is absent — including
 * `tests/test-wiring.js`, the guard CLAUDE.md names as the answer to the 2026-07-28 failures, whose
 * whole job is to prove a capability RAN. It had been printing "needs the Showdown simulator;
 * SHOWDOWN_PATH is not set" and `run-all` had been reporting a clean exit around it. A checkout at
 * the pinned commit was sitting one directory up the entire time.
 *
 * That is this project's own lesson turned on its own toolchain: a skip is not a pass, and a guard
 * that opts itself out is not a guard. So the sibling checkout — where `git clone` beside this repo
 * puts it, and where it actually is — is now found without anyone exporting anything. The env var
 * still wins, for a checkout kept elsewhere.
 *
 * Existence is checked here rather than trusted, because returning a path that is not there converts
 * a clean "not set" skip into a confusing load error. */
function showdownPath() {
  return require('./showdown_path.js').resolve() || '/tmp/ps';
}

/* AN UNAVAILABLE FORMAT ID SILENTLY RETURNS MAINLINE GEN 9, AND THAT IS REFUSED HERE. 2026-09-08.
 *
 * `Dex.forFormat(id)` DOES NOT THROW on an id Showdown has never heard of. It returns the BASE mod.
 * Measured on the pinned checkout, and printed by tests/probe_unknown_format_refusal.js:
 *
 *     gen9championsvgc2026regmb   exists=true    fmt.mod=champions  currentMod=champions  347 species
 *     <the next regulation>       exists=FALSE   fmt.mod=gen9       currentMod=base       911 species
 *                                                                   rockyhelmet LEGAL, silktrap LEGAL
 *
 * So the National Dex arrives wearing the format's NAME AND ID, every Champions override gone, every
 * banned item back — and every caller reports success. That is the failure this repo is built around,
 * armed for the moment `active` moves in data/regulations.json: FORMAT above is derived from that
 * file, and 228 call sites resolve it through `CS.sim().Dex.forFormat(...)`.
 *
 * THE REFUSAL IS STRUCTURAL, NOT A SCAN. `sim().Dex` is not Showdown's Dex — it is a proxy whose ONLY
 * difference is that `forFormat` goes through `dexFor` below. Every one of those 228 sites is covered
 * with no edit, and a site added tomorrow is covered the day it is written. A checker that had to be
 * called would be a checker somebody forgets; there is nothing here to remember.
 *
 * TWO CLAUSES, BOTH DERIVED, NEITHER NAMING A FORMAT:
 *   1. `Dex.formats.get(id).exists` — false for anything this checkout does not carry. This is the
 *      whole defect and it catches ANY unavailable id, not one special case.
 *   2. the resolved dex's `currentMod` must start with `champions`. This file IS the Champions
 *      simulator and every id that reaches it is a Champions format (verified 2026-09-08: all 228
 *      through-seam calls pass `CS.FORMAT` or a Champions literal), so a base-mod resolution is
 *      wrong here even in the case clause 1 misses. It is a PREFIX test rather than an equality one
 *      because the mod name is per-regulation and moves: measured on this checkout,
 *      gen9championsvgc2026regma carries mod `championsregma` while regmb carries `champions`, so
 *      `=== 'champions'` would refuse a real regulation the day M-B is frozen off the live mod.
 *
 * NOT ADDED: a require of `next_regulation.js` for its VGC_REG shape test. This file is in
 * engine_release.js's SOURCES, and a new require edge here retroactively strands every release cut
 * before it (CLAUDE.md, §12). The two clauses above need no shape. */
function dexFor(formatId) {
  /* THE RAW DEX, NOT `sim().Dex`. `sim().Dex` is the proxy whose `forFormat` IS this function, so
   * reading it here is unbounded recursion — the first cut did exactly that and blew the stack. */
  sim();
  const Dex = _rawDex;
  /* Showdown's own `forFormat` takes `Format | string`, so the id is taken off the object when one is
   * handed over rather than stringified into "[object Object]" — a refusal that reported the wrong id
   * would be worse than no refusal, because it would look like a real answer. */
  const id = (formatId && typeof formatId === 'object' && formatId.id) ? String(formatId.id)
    : (formatId == null ? '' : String(formatId));
  const fmt = Dex.formats.get(id);
  if (!fmt || !fmt.exists) {
    throw new Error(
      `champions_sim: REFUSING to resolve format "${id}" — this Showdown checkout does not carry it.\n` +
      `  Dex.forFormat() would NOT have thrown. It returns the BASE mod: mainline Gen 9, the whole\n` +
      `  National Dex, every Champions override gone and every banned item legal again.\n` +
      `  Checkout: ${showdownPath()}  (pinned ${PINNED_COMMIT.slice(0, 12)}, ${PINNED_DATE})\n` +
      `  Champions formats it DOES carry: ${Dex.formats.all().filter(f => /champions/i.test(f.id)).map(f => f.id).join(', ') || '(none)'}\n` +
      `  If a new regulation has shipped, update the checkout first — a regulation is collectable\n` +
      `  days before it is simulatable (see engine/next_regulation.js), and until the mod is present\n` +
      `  there is no honest way to simulate it.`);
  }
  const dex = Dex.forFormat(id);
  const mod = String(dex.currentMod || '');
  if (!/^champions/.test(mod)) {
    throw new Error(
      `champions_sim: format "${id}" exists but resolved to mod "${mod}", not a champions mod.\n` +
      `  This seam is the Champions simulator; a non-champions dex here is a silently different game.`);
  }
  return dex;
}

let _sim = null;
let _validator = null;
let _rawDex = null;
function sim() {
  if (_sim) return _sim;
  const base = showdownPath();
  try {
    const dist = path.join(base, 'dist', 'sim');
    _rawDex = require(path.join(dist, 'index')).Dex;
    _sim = {
      /* The proxy described above. Everything except `forFormat` forwards to the real Dex untouched;
       * methods are bound to it so Showdown's own `this` is never the proxy. `forFormat` is the one
       * door, and it is now shut on an id this checkout cannot serve. */
      Dex: new Proxy(_rawDex, {
        get(t, p) {
          if (p === 'forFormat') return dexFor;
          const v = t[p];
          return typeof v === 'function' ? v.bind(t) : v;
        },
      }),
      Teams: require(path.join(dist, 'index')).Teams,
      BattleStream: require(path.join(dist, 'battle-stream')).BattleStream,
      getPlayerStreams: require(path.join(dist, 'battle-stream')).getPlayerStreams,
      RandomPlayerAI: require(path.join(base, 'dist', 'sim', 'tools', 'random-player-ai')).RandomPlayerAI,
      /* The OFFICIAL legality check. Every rule about what a team may contain — item clause, species
       * clause, learnsets, ability legality, format bans — already exists here and is maintained
       * upstream. Reimplementing any of it by hand would drift the moment the format changes, and a
       * hand-rolled learnset walk written for this project already produced 40 false positives on
       * cosmetic formes (Sinistcha-Masterpiece does learn Matcha Gotcha). Ask the source of truth. */
      TeamValidator: require(path.join(dist, 'team-validator')).TeamValidator,
      /* The Battle class itself, for `forkBattle` below. Reached through the loader rather than off
       * an existing `battle.constructor`, so a fork does not require already holding a battle. */
      Battle: require(path.join(dist, 'battle')).Battle,
    };
  } catch (e) {
    throw new Error(
      `Could not load the Showdown simulator from ${base}.\n` +
      `The champions mod is NOT in the npm package - a built master checkout is required:\n` +
      `    git clone --depth 1 https://github.com/smogon/pokemon-showdown\n` +
      `    cd pokemon-showdown && npm install && node build\n` +
      `Then set SHOWDOWN_PATH. Original error: ${e.message}`);
  }
  return _sim;
}

/* Confirm the mod is present and is the format our data actually came from. Called before any batch
 * job, because silently running a DIFFERENT format would produce numbers that look fine and are not. */
/* THE PIN WAS DECLARED AND NEVER CHECKED, which made it a comment rather than a pin.
 *
 * PINNED_COMMIT names the Showdown commit this project is validated against. Nothing compared it to
 * the checkout that actually loads, and worse, mew.js stamped `engine_commit: CS.PINNED_COMMIT` into
 * EVERY self-play record — the CONSTANT, not the running code. So a checkout at any other commit
 * would still have produced games labelled 20ad99ff, and the provenance field that exists to say
 * which engine generated a corpus would have been lying by construction, silently, forever.
 *
 * Read from git rather than from a file the checkout could also be wrong about. Returns null when
 * git or the checkout is unavailable, and null is reported as UNKNOWN rather than as a match —
 * an unverifiable pin must never read as a verified one. */
let _actualCommit;
function actualCommit() {
  if (_actualCommit !== undefined) return _actualCommit;
  _actualCommit = null;
  try {
    const out = require('child_process')
      .execFileSync('git', ['-C', showdownPath(), 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    _actualCommit = (out || '').trim() || null;
  } catch (e) { _actualCommit = null; }
  return _actualCommit;
}

function verify() {
  const { Dex } = sim();
  const fmt = Dex.formats.get(FORMAT);
  const ok = fmt && fmt.exists;
  return {
    ok: !!ok,
    format: FORMAT,
    name: ok ? fmt.name : null,
    mod: ok ? fmt.mod : null,
    pinned_commit: PINNED_COMMIT,
    pinned_date: PINNED_DATE,
    /* null when data/regulations.json answered; a REASON string when the hardcoded literal was used
     * instead. `ok:true` with a non-null reason here means the run is on a guessed format id. */
    format_fallback: FORMAT_FALLBACK,
    actual_commit: actualCommit(),
    /* true / false / null-for-unknown. A consumer that treats null as true is making the same
     * mistake this field was added to expose. */
    commit_matches: actualCommit() ? (actualCommit() === PINNED_COMMIT) : null,
    champions_formats: Dex.formats.all().filter(f => /champions/i.test(f.id)).length,
  };
}

/* Build a packed team string the simulator will accept.
 *
 * The store records what a replay REVEALED - often two or three moves and sometimes no item. The
 * simulator needs a complete legal set. We fill the gaps from the dex rather than inventing them,
 * and the caller is told which slots were filled so the uncertainty is visible rather than hidden. */
function packTeam(species, setsBySpecies) {
  const { Dex, Teams, TeamValidator } = sim();
  const dex = Dex.forFormat(FORMAT);
  const team = [];
  const filled = [];
  /* ITEM CLAUSE. VGC allows ONE of each item per team, and this sampler draws items per species
   * independently, so it duplicated them constantly. Showdown's own TeamValidator rejected 80.5% of
   * the pool (158/200 teams), 66 of them for a second Focus Sash. Real teams never look like that,
   * so four in five self-play games were being played with teams no human could legally bring. */
  const usedItems = new Set();
  for (const name of species) {
    const sp = dex.species.get(name);
    if (!sp || !sp.exists) { filled.push(`${name}: UNKNOWN SPECIES`); continue; }
    const known = (setsBySpecies && setsBySpecies[name]) || {};

    /* Fill unrevealed slots from the BEHAVIOUR-CLONE priors (engine/set_priors.js reading
     * data/move-priors.json), not from the raw learnset and not from globalThis.
     *
     * Two failures produced this code path, both of the same kind: only ~1.38 of 4 moves are
     * revealed per set, so WHATEVER FILLS THE OTHER 2.6 DOMINATES ANY RESULT.
     *   1. An early version filled alphabetically from the learnset and gave Charizard "Acrobatics,
     *      Aerial Ace, Air Cutter, Air Slash". The engine comparison built on it reported a
     *      32-point difference that was almost entirely filler (ADR-001, attempt 1).
     *   2. The version this replaces read `globalThis.MC`, which exists only when the browser bundle
     *      is loaded. Under Node it is undefined, the fallback list was empty, and every unrevealed
     *      slot fell through to the literal ['Tackle'] below. The first MEW self-play run produced
     *      games whose most common move was Tackle, by 4x over Protect. Nothing errored.
     *
     * set_priors samples proportional to measured P(move | species) rather than taking the top four,
     * because a modal set asserts a set we never observed, and because variety across games is
     * wanted (the reason Leela Chess Zero runs self-play at a raised policy temperature). Draws are
     * seeded, so a run reproduces. */
    const SP = require('./set_priors.js');
    /* The species' legal abilities, so the sampler can drop impossible draws and renormalise rather
     * than have them land on slot 0 by the correction below. */
    const f = SP.fillSet(name, known, (setsBySpecies && setsBySpecies.__seed) || 1,
      { legalAbilities: sp.abilities ? Object.values(sp.abilities) : null });
    let moves = [];
    for (const mv of f.moves) {
      if (moves.length >= 4) break;
      const m = dex.moves.get(mv);
      if (!m || !m.exists) continue;                       // prior may name a move illegal in-format
      if (moves.some(x => dex.moves.get(x).id === m.id)) continue;
      moves.push(m.name);
    }
    if (f.filled.length) filled.push(...f.filled);
    /* Last resort only. If this fires the species has no prior at all, which is a data gap worth
     * seeing rather than papering over — it used to be the SILENT common case. */
    if (!moves.length) { moves = ['Tackle']; filled.push(`${name}: NO PRIOR — fell back to Tackle`); }
    /* THE ABILITY MUST BE ONE THIS SPECIES CAN ACTUALLY HAVE.
     * ----------------------------------------------------------------------------------------
     * `f.ability` is sampled from observed ladder sets, and the observation is keyed by SPECIES
     * NAME across a whole replay. When a species is mis-attributed during ingest (or shares a name
     * with a forme that has different abilities), the prior can hand back an ability the species
     * cannot legally hold — and BattleStream does NOT run the team validator, so it is accepted in
     * silence and simply applied.
     *
     * Measured on the live pool: 8 of 1,800 packed sets (0.4%) carried an illegal ability, including
     * Meowstic with Intimidate, Snorlax with No Guard and Gardevoir with Good as Gold. Intimidate
     * alone shifts every physical damage roll against that side, so these are not cosmetic — they
     * quietly corrupt the battles they appear in.
     *
     * Illegal abilities are replaced with the species' primary ability and REPORTED in `filled`,
     * because a silent correction here would hide the ingest bug that produced it. */
    let ability = f.ability || (sp.abilities && sp.abilities['0']) || '';
    if (ability) {
      const legal = Object.values(sp.abilities || {});
      const key = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!legal.some(a => key(a) === key(ability))) {
        const fallback = (sp.abilities && sp.abilities['0']) || '';
        filled.push(`${name}: ILLEGAL ABILITY ${ability} (legal: ${legal.join('/')}) -> ${fallback}`);
        ability = fallback;
      }
    }
    /* Resample the item rather than blanking it on a clash: dropping to no-item would bias the whole
     * corpus toward itemless Pokemon, which is its own distortion. Reseeding fillSet redraws from the
     * species' measured item distribution, so the replacement is still something that species runs.
     * Only if several draws all collide do we fall back to no item, and that is reported. */
    let item = f.item || '';
    if (item && usedItems.has(item)) {
      const baseSeed = (setsBySpecies && setsBySpecies.__seed) || 1;
      /* THE RESAMPLE HAD TO DROP THE ITEM IT WAS RESAMPLING, OR IT COULD NEVER MOVE.
       *
       * `known` still carried the COLLIDING item, and fillSet honours what it is told is known -- so
       * all six reseeds returned that same item, `alt` stayed empty, and the fallback the comment
       * above calls rare ("only if several draws all collide") fired every single time. The retry
       * loop could not possibly succeed; it was six identical draws wearing different seeds.
       *
       * Will saw the result in the client on 2026-08-01 -- "grimmsnarl doesnt have an item???" -- on
       * a Grimmsnarl whose modal item is Light Clay, in a game where his own Gholdengo then Tricked
       * a Light Clay off MAG's Klefki. The itemless-corpus bias this block was written to PREVENT is
       * exactly what it was producing. */
      const knownNoItem = Object.assign({}, known); delete knownNoItem.item;
      let alt = '';
      for (let k = 1; k <= 6 && !alt; k++) {
        const g = SP.fillSet(name, knownNoItem, baseSeed + k * 7919);
        if (g.item && !usedItems.has(g.item)) alt = g.item;
      }
      filled.push(`${name}: ITEM CLAUSE ${item} already used -> ${alt || 'none'}`);
      item = alt;
    }
    if (item) usedItems.add(item);
    team.push({
      name: sp.name, species: sp.name,
      item,
      ability,
      moves,
      /* SPREAD AND NATURE, sampled from Smogon's official distribution rather than assumed.
       *
       * This used to be a flat 11/11/11/11/11/11 with nature Hardy, justified as "spread it evenly
       * when unknown rather than maximising, because maximising would systematically overstate every
       * unknown Pokemon". The caution was right and the result was still badly wrong. Real Garchomp
       * runs Jolly 2/32/0/0/0/32 on 42% of sets; since stat = base + SP + 20 that is Attack 182
       * against the flat 161, so the format's most-used attacker was understated by 13% in EVERY
       * damage figure this project has produced — including the golden master and every MEW battle.
       *
       * Flat spreads also erase the SHAPE of the format. 92% of real spreads touch the 32-per-stat
       * cap; a flat one invents a jack-of-all-trades that exists nowhere on the ladder.
       *
       * Falls back to the old flat spread only when there is no prior for the species, and that case
       * is reported in `filled` rather than passing silently. */
      nature: known.nature || (f.spread && f.spread.nature) || 'Hardy',
      evs: known.evs || (f.spread && f.spread.sp) || { hp: 11, atk: 11, def: 11, spa: 11, spd: 11, spe: 11 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      level: 50,
      gender: '',
    });
  }
  /* VALIDATE AGAINST SHOWDOWN, THEN REPAIR.
   * ------------------------------------------------------------------------------------------------
   * BattleStream does NOT run the team validator — it accepts whatever it is handed. So an illegal set
   * does not error, it just plays, and the game it produces looks exactly like a legitimate one. That
   * is the worst possible failure mode for a training corpus, and it is why this gate exists.
   *
   * Repair rather than reject: discarding an invalid team would silently bias the pool toward whatever
   * teams happen to sample cleanly. Illegal moves are dropped and refilled from the priors, and the
   * team is re-validated. Anything still unresolved after MAX_FIX passes is returned with `valid:false`
   * so the caller can refuse the battle instead of quietly recording a corrupt one.
   *
   * Costs 1.24ms per team, ~2.8% of a battle. Cheap enough to run on every game, and it has to be —
   * these faults come from sampling, so they differ on every draw of the same team. */
  const MAX_FIX = 3;
  let problems = [];
  try {
    /* Built once per process. Constructing a TeamValidator parses the format's rule table, which cost
     * 6.5ms of the 7.7ms per team when this was inside the call. */
    if (!_validator) _validator = new TeamValidator(FORMAT);
    const validator = _validator;
    for (let pass = 0; pass <= MAX_FIX; pass++) {
      problems = validator.validateTeam(Teams.unpack(Teams.pack(team))) || [];
      if (!problems.length) break;
      if (pass === MAX_FIX) break;
      let changed = false;
      for (const p of problems) {
        /* "Pelipper can't learn Struggle." / "Ditto's move Knock Off does not exist" */
        const m = p.match(/^(.+?)(?:'s)? (?:can't learn|does not have|has an invalid move) (.+?)\.?$/)
              || p.match(/^(.+?) move (.+?) does not exist/);
        if (!m) continue;
        const who = m[1].trim().replace(/^\S+\s+/, (s) => s);
        const badMove = m[2].trim();
        const slot = team.find(t => t.name === who || t.species === who || who.includes(t.name));
        if (!slot) continue;
        const before = slot.moves.length;
        slot.moves = slot.moves.filter(mv => mv.toLowerCase() !== badMove.toLowerCase());
        if (slot.moves.length !== before) {
          changed = true;
          filled.push(`${slot.name}: ILLEGAL MOVE ${badMove} removed by TeamValidator`);
        }
        if (!slot.moves.length) {
          /* An empty moveset is itself invalid. Take any legal move off the learnset so the slot is
           * playable; this is a last resort and is reported like every other filled slot. */
          const sp2 = dex.species.get(slot.species);
          let ls = null;
          try { ls = dex.species.getLearnsetData(sp2.id); } catch (e) { /* none */ }
          const first = ls && ls.learnset ? Object.keys(ls.learnset)[0] : null;
          slot.moves = [first ? dex.moves.get(first).name : 'Protect'];
          filled.push(`${slot.name}: moveset emptied by repair -> ${slot.moves[0]}`);
        }
      }
      if (!changed) break;
    }
  } catch (e) {
    problems = ['VALIDATOR UNAVAILABLE: ' + e.message];
  }

  return {
    packed: Teams.pack(team),
    filled,
    size: team.length,
    valid: problems.length === 0,
    problems,
  };
}

/* One battle to a winner. Both sides play randomly - this measures the MATCHUP, not the players.
 * That is the same assumption the hand-written engine makes, so the two are comparable. */
async function battle(packedA, packedB, seed) {
  const { BattleStream, getPlayerStreams, RandomPlayerAI } = sim();
  const stream = new BattleStream();
  const streams = getPlayerStreams(stream);
  const spec = { formatid: FORMAT };
  if (seed) spec.seed = seed;
  const p1 = new RandomPlayerAI(streams.p1);
  const p2 = new RandomPlayerAI(streams.p2);
  p1.start(); p2.start();
  void streams.omniscient.write(
    `>start ${JSON.stringify(spec)}\n` +
    `>player p1 ${JSON.stringify({ name: 'A', team: packedA })}\n` +
    `>player p2 ${JSON.stringify({ name: 'B', team: packedB })}`);
  let winner = null;
  for await (const chunk of streams.omniscient) {
    const m = /\|win\|(.*)/.exec(chunk);
    if (m) winner = m[1].trim();
  }
  return winner;
}

/* P(A wins) over N battles, with a Wilson interval - because a rollout estimate without an interval
 * invites reading noise as signal. At N=100 the interval is roughly +/- 10 points, which is worth
 * knowing before anyone quotes a number to one decimal place. */
async function winProb(speciesA, speciesB, N, setsBySpecies) {
  const A = packTeam(speciesA, setsBySpecies);
  const B = packTeam(speciesB, setsBySpecies);
  if (!A.size || !B.size) return null;
  let wins = 0, played = 0;
  for (let i = 0; i < N; i++) {
    const w = await battle(A.packed, B.packed);
    if (w === null) continue;      // a battle that never resolved is not evidence either way
    played++;
    if (w === 'A') wins++;
  }
  if (!played) return null;
  const p = wins / played, z = 1.96, d = 1 + z * z / played;
  const c = (p + z * z / (2 * played)) / d;
  const h = z * Math.sqrt(p * (1 - p) / played + z * z / (4 * played * played)) / d;
  return { p, wins, played, lo: Math.max(0, c - h), hi: Math.min(1, c + h),
           filled: A.filled.concat(B.filled) };
}

/* ---- FORKING A BATTLE, which the one-step search in docs/LOOKAHEAD-design.md is built on ---------
 *
 * `Battle.toJSON()/fromJSON()` round-trip correctly EXCEPT for one field, and that exception is why a
 * quarter to a third of forks in `lookahead_cost.js` threw `Infinite loop`. Upstream, in the pinned
 * checkout:
 *
 *     sim/state.ts:72    state.log = battle.log;          // serialize ALIASES, it does not copy
 *     sim/state.ts:153   (battle as any).log = state.log; // deserialize aliases straight back
 *
 * `log` is the only key treated this way. Every other array goes through `deserializeWithRefs`, which
 * allocates a fresh array per call, and `hints` / `prng` are explicitly copied. So the round-trip is
 * sound and the fork is usable — there is exactly one shared mutable object, and it is this one.
 *
 * TWO CONSEQUENCES, and the one that never threw is the worse one:
 *
 *   THE THROW.   Every fork restored from the same snapshot appends to ONE array, so log growth is
 *                cumulative across cells. `battle.ts:584` throws `Infinite loop` when
 *                `log.length - sentLogPos > 1000`, and nothing restores `sentLogPos` because a forked
 *                battle has no stream to send to. At ~26 lines per turn that is ~38 forks, after
 *                which EVERY remaining fork throws — the failures are a contiguous tail, which is why
 *                the observed rate (40/40, 27/40, 30/40, 24/40, 25/40) tracked lines-per-turn rather
 *                than anything about the board.
 *   THE SILENT ONE. `state.log = battle.log` means the snapshot aliases the LIVE battle's log too, so
 *                stepping a fork writes simulated events into the real game's log. That one never
 *                throws. A search that forks the battle it is still playing would corrupt the record
 *                of the game it is playing, and nothing would say so.
 *
 * Both are fixed by detaching the array at each boundary, which is what `fromJSON` already intends
 * everywhere else. The 1000-line guard is deliberately LEFT ARMED: with per-fork logs a single fork
 * accrues one turn of lines, so if it ever fires again that is a real runaway turn and should throw.
 *
 * Neither function edits the pinned checkout (ADR-001). */
function snapshot(battle) {
  const json = battle.toJSON();
  json.log = (json.log || []).slice();     // detach the snapshot from the live battle
  return json;
}

function forkBattle(json) {
  const Battle = sim().Battle;
  const b = Battle.fromJSON(json);
  b.log = (b.log || []).slice();           // detach this fork from the snapshot and from its siblings
  return b;
}

/* ---- IS THIS ONE BODY LEGAL? THE AUTHORITY'S ANSWER, FOR A PROBE RATHER THAN A CORPUS ----------
 *
 * `packTeam` above validates a whole SAMPLED team and REPAIRS it, because a training corpus must not
 * be biased by discarding the draws that happen to come out illegal. A probe wants the opposite: one
 * body, no repair, a yes or a no. Same validator, same format, same instance — a second one would be
 * the "two implementations of a fact" defect CLAUDE.md bans.
 *
 * WHY THIS EXISTS AT ALL (Will, 2026-08-09: "why dont we use showdowns teams validator that is
 * universal truth"). `new Battle()` RUNS NO VALIDATION. Every probe that assigns `p.ability = ab.id`
 * or sets `p.item` directly walks straight past every rule in the format, and Showdown will happily
 * simulate a banned item or an unlearnable move. Both engines then agree about something that cannot
 * occur in a real game — a PASS that proves nothing, which is this project's signature failure.
 *
 * It catches strictly more than the `isNonstandard` check first proposed for this job:
 *
 *     Flamethrower on Meganium   REJECTED  "Meganium can't learn Flamethrower."
 *     Rocky Helmet               REJECTED  "does not exist in Gen 9."
 *     Pure Power on Snorlax      REJECTED  "Snorlax can't have Pure Power."
 *     Skill Link on Toucannon    ACCEPTED
 *     Garchomp @ Choice Scarf    ACCEPTED
 *
 * Flamethrower is a perfectly LEGAL move — Meganium simply cannot learn it, and only a learnset walk
 * knows that. That exact set was staged by hand on 2026-08-08 and nothing stopped it.
 *
 * THE ONE WRINKLE, AND IT IS WHY THIS TAKES A COPY. Probes build FLAT, ZERO-SP bodies on purpose, so
 * both engines derive the same stat line independently. Champions requires the 66-point budget SPENT,
 * so the validator rejects a flat body outright — "Garchomp has exactly 0 Stat Points - did you forget
 * to invest it?" — and that verdict MASKS the legality answer the caller actually asked for. So the
 * spread below is stamped onto a COPY purely to satisfy the budget rule. Legality and stats are
 * separate questions; this function asks only the first, and the caller battles with its own flat body.
 */
const LEGAL_SPREAD = { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 };

/* THE PADDING. Champions rejects a team of one — "You must bring at least 6 Pokémon (your team has 1)"
 * — so the subject is validated inside a full team, and EVERY OTHER SLOT MUST BE CLEAN or its
 * complaints are indistinguishable from the subject's.
 *
 * NAMED BY HAND FIRST, AND IT WAS WRONG WITHIN A MINUTE: Sandshrew is not in this format, so every
 * filler team carried "Sandshrew does not exist in Gen 9." That is the failure this whole function
 * exists to stop, committed in the function itself. The pool is now READ FROM THE FORMAT — species the
 * dex does not mark isNonstandard — and then each candidate is VALIDATED before it is ever used as
 * padding. A filler that cannot pass on its own is dropped, not trusted.
 *
 * Six kept so five distinct ones remain after dropping whichever collides with the subject under
 * Species Clause. */
let _fillers = null;
function fillerSets(dex, skipId) {
  if (!_fillers) {
    const mkFiller = (sp) => {
      let mv = null;
      try {
        const ls = dex.species.getLearnsetData(sp.id);
        for (const k of Object.keys((ls && ls.learnset) || {})) {
          const m = dex.moves.get(k);
          if (m.exists && !m.isNonstandard) { mv = m.name; break; }
        }
      } catch (e) { /* no learnset */ }
      if (!mv) return null;
      return { name: sp.name, species: sp.name, item: '', ability: sp.abilities[0], moves: [mv],
               nature: 'Serious', level: 50, gender: '',
               evs: Object.assign({}, LEGAL_SPREAD),
               ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } };
    };
    const cand = [];
    for (const sp of dex.species.all()) {
      if (sp.isNonstandard || !sp.exists || sp.num <= 0) continue;
      if (sp.forme || sp.isMega || sp.battleOnly) continue;
      const f = mkFiller(sp);
      if (f) cand.push(f);
      if (cand.length >= 40) break;
    }
    /* PROVED, NOT ASSUMED. Each candidate is validated inside a team of six copies of itself is not
     * possible (Species Clause), so they are validated as one pool of six and any complaint drops the
     * named slot. Repeat until the padding is silent or the pool runs out. */
    const { Teams, TeamValidator } = sim();
    if (!_validator) _validator = new TeamValidator(FORMAT);
    let pool = cand.slice();
    for (let pass = 0; pass < 8 && pool.length >= 6; pass++) {
      const six = pool.slice(0, 6);
      const probs = _validator.validateTeam(Teams.unpack(Teams.pack(six))) || [];
      if (!probs.length) { _fillers = six; break; }
      const guilty = new Set();
      for (const p of probs) for (const f of six) if (p.includes(f.species)) guilty.add(f.species);
      if (!guilty.size) break;
      pool = pool.filter(f => !guilty.has(f.species));
    }
    if (!_fillers) throw new Error('champions_sim.checkLegal: could not assemble six legal filler '
      + 'Pokemon from ' + FORMAT + '. The padding must be clean or every verdict is contaminated.');
  }
  return _fillers.filter(f => dex.species.get(f.species).id !== skipId).slice(0, 5)
                 .map(f => Object.assign({}, f));
}

/* WHICH KIND OF ILLEGAL. Two different questions arrive as one list of strings, and collapsing them
 * was a mistake caught the same hour this was written:
 *
 *   EXISTENCE — "does not exist in Gen 9", "is an invalid item". The entity is BANNED or fictional.
 *               Staging it is always wrong; both engines would agree about something unreachable.
 *
 *   PAIRING   — "can't learn", "can't have". The entity is real and legal; this SPECIES cannot hold
 *               it. An isolation probe does this ON PURPOSE and must be allowed to: probe_pair stamps
 *               ONE named quiet ability on every body precisely so the control does not vary with the
 *               species, and Illuminate is illegal on Snorlax, Gengar and Meganium alike. Forcing a
 *               per-species legal control is the Fluffy/Sand Rush failure (ROADMAP #100), which
 *               produced four false findings across 2,049 uses.
 *
 * So existence is fatal and pairing is DECLARABLE. Anything unrecognised counts as existence, because
 * an unclassified problem must not default to the permissive side. */
const PAIRING_RE = /can't learn|can't have|does not have|is not compatible|incompatible/i;
function classify(problems) {
  const banned = [], pairing = [];
  for (const p of problems) (PAIRING_RE.test(p) ? pairing : banned).push(p);
  return { banned, pairing };
}

/* A MOVE THIS SPECIES CAN ACTUALLY CLICK, derived rather than named. Every probe in this repo padded
 * its inert slots with 'Tackle', and TACKLE DOES NOT EXIST IN THIS FORMAT — the validator said so the
 * first time it was pointed at one. Harmless there (those slots never move) and precisely the habit
 * that produced the Loaded Dice sentence and the Sandshrew padding on the same day: a name recalled
 * instead of read. Cached per species; returns null if the species has no usable learnset. */
const _firstLegal = new Map();
function firstLegalMove(species) {
  const { Dex } = sim();
  const dex = Dex.forFormat(FORMAT);
  const sp = dex.species.get(species);
  if (!sp.exists) return null;
  if (_firstLegal.has(sp.id)) return _firstLegal.get(sp.id);
  let out = null;
  /* An evolved forme's own learnset can be thin; walk down the prevo chain the way the validator does
   * so a species is not reported moveless because its list lives on its baby form. */
  for (let cur = sp; cur && !out; cur = cur.prevo ? dex.species.get(cur.prevo) : null) {
    let ls = null;
    try { ls = dex.species.getLearnsetData(cur.id); } catch (e) { /* none */ }
    for (const k of Object.keys((ls && ls.learnset) || {})) {
      const m = dex.moves.get(k);
      if (m.exists && !m.isNonstandard) { out = m.name; break; }
    }
  }
  _firstLegal.set(sp.id, out);
  return out;
}

/* A MOVE THAT DOES NOTHING, NAMED AND JUSTIFIED RATHER THAN DERIVED.
 *
 * Probes need a filler move for a slot that must not act — a partner that would otherwise swing, a
 * defender whose damage would contaminate the number. Every classic no-op is gone from this format:
 * **Splash, Celebrate and Hold Hands are all `isNonstandard: 'Past'`**, and `tests/test-priority-block.js`
 * was silencing three slots with `'splash'`, which is not merely banned but ABSENT from `MC.moves`
 * entirely. It worked by ACCIDENT — the engine had no row, so the move did nothing.
 *
 * Deriving a replacement was tried first and abandoned honestly: filtering the format for a status
 * move with no declarative effect fields still returns Belly Drum, Rest and Moonlight, because
 * Showdown implements those in handlers rather than fields. A filter I cannot trust is worse than a
 * choice I can defend.
 *
 * So RECYCLE, chosen for a reason: it is legal here, present in `MC.moves`, and **fails outright when
 * the user has consumed no item**, which is every probe body. It cannot damage, boost, heal, switch,
 * or touch the field. Asserted where it is used rather than assumed — `tests/test-priority-block.js`
 * checks that it has an `MC.moves` row and that its base power is 0 before it silences anything with
 * it, because a silencer that works by being UNKNOWN is indistinguishable from one that works.
 */
const INERT_MOVE = 'Recycle';

function checkLegal(o) {
  const { Dex, Teams, TeamValidator } = sim();
  const dex = Dex.forFormat(FORMAT);
  const sp = dex.species.get(o.species);
  if (!sp.exists) return { legal: false, problems: ['no such species in ' + FORMAT + ': ' + o.species] };
  /* An unknown NAME must be preserved verbatim, never silently dropped — `dex.items.get('nonsense')`
   * returns a non-existent row whose `.name` is empty, and an empty item is a LEGAL item. Passing the
   * raw string through means the validator answers about the thing the caller actually asked about. */
  const nameOf = (row, raw) => (row && row.exists && row.name) ? row.name : String(raw);
  const moves = (o.moves && o.moves.length ? o.moves : [firstLegalMove(sp.name) || 'Protect'])
                  .map(m => nameOf(dex.moves.get(m), m));
  const set = {
    name: sp.name, species: sp.name,
    item: o.item ? nameOf(dex.items.get(o.item), o.item) : '',
    ability: o.ability ? nameOf(dex.abilities.get(o.ability), o.ability) : sp.abilities[0],
    moves, nature: 'Serious', level: 50, gender: '',
    evs: Object.assign({}, LEGAL_SPREAD),
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  };
  try {
    if (!_validator) _validator = new TeamValidator(FORMAT);
    const team = [set, ...fillerSets(dex, sp.id)];
    const all = _validator.validateTeam(Teams.unpack(Teams.pack(team))) || [];
    /* ONLY THE SUBJECT'S COMPLAINTS. A filler naming itself in a problem string is the padding's
     * business; if that ever happens the padding is broken and `fillerProblems` says so out loud
     * rather than being folded into the subject's verdict. */
    const mine = [], theirs = [];
    const fillerNames = fillerSets(dex, sp.id).map(f => f.species);
    for (const p of all) (fillerNames.some(n => p.includes(n)) ? theirs : mine).push(p);
    const { banned, pairing } = classify(mine);
    const out = { legal: mine.length === 0, problems: mine, banned, pairing, set };
    if (theirs.length) out.fillerProblems = theirs;
    return out;
  } catch (e) {
    /* NOT SILENT, AND NOT A PASS. An unavailable validator is reported as such; a caller that treats
     * "could not check" as "legal" reintroduces the hole this closes. */
    return { legal: false, unavailable: true, problems: ['VALIDATOR UNAVAILABLE: ' + e.message] };
  }
}

/* ================================================================================================
 * WHO CAN CARRY THIS AT ALL — the derived answer to "does this mechanic exist in the regulation?"
 *
 * `checkLegal` answers a question about ONE set. It cannot answer the question that manufactured
 * four phantom engine defects in a single session on 2026-08-14: a probe built a body and stamped an
 * ability on it, a WIRE demo asserted an aura interaction, and two coverage strips targeted
 * abilities that had already been dropped for having no carrier. Every one of them read as AN ENGINE
 * DEFECT and every one of them was the exact opposite — **the engine is correct not to model a thing
 * this format cannot produce, and `tag_dex.js` is correct to omit it.** One was ranked first of
 * fourteen open engine defects and put in front of Will as the place to start work, which is the real
 * cost: not a wrong number, a wrong DECISION about what to work on.
 *
 * IT LIVES HERE BECAUSE FACTS ARE GLOBAL. `tests/probe_red_demo.js` grew its own `abilityUnreachable`
 * with its own lazy dex walk; a second copy of "is this legal here" is the two-implementations failure
 * this repository has paid for repeatedly, and it will diverge silently because both copies keep
 * working. This is the same module that already owns `checkLegal`, `firstLegalMove` and `LEGAL_SPREAD`.
 *
 * THE FILTER IS THE ONE CLAUDE.md MANDATES — `x.exists && !x.isNonstandard && x.tier !== 'Illegal'`
 * — because `Dex.forFormat(...).species.all()` is the WHOLE National Dex wearing this format's name.
 * MOVE carriage is asked of `TeamValidator#checkCanLearn`, the authority's own function, and never of
 * a hand-walked learnset: an evolved forme's list lives partly on its prevo and partly on its base
 * forme, and a walk that misses either invents a zero. Measured 2026-08-14 on Sleep Powder — a raw
 * learnset walk found 7 carriers where the validator finds 26.
 * ============================================================================================== */
let _roster = null, _abilityCarriers = null;
/* ROADMAP #258 — the learnset validator's REFUSALS, counted. `canLearn` answers a FACT about this
 * format and used to return `false` on an exception with nothing said, so a validator that started
 * throwing would look exactly like a format that had forgotten its learnsets. Exported so a caller
 * can assert it is zero. */
const learnCounters = { validatorThrew: 0, firstThrow: '' };
const _learn = new Map(), _moveCarriers = new Map();
const _id = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function legalRoster() {
  if (_roster) return _roster;
  const { Dex } = sim();
  const dex = Dex.forFormat(FORMAT);
  _roster = dex.species.all().filter(x => x.exists && !x.isNonstandard && x.tier !== 'Illegal');
  return _roster;
}

/* Every legal body that can have this ability, in ANY of its slots. A mega forme counts: it is a
 * body that appears on the field in this format. */
function abilityCarriers(ability) {
  if (!_abilityCarriers) {
    _abilityCarriers = new Map();
    for (const sp of legalRoster()) {
      for (const slot of Object.values(sp.abilities || {})) {
        const k = _id(slot);
        if (!_abilityCarriers.has(k)) _abilityCarriers.set(k, []);
        _abilityCarriers.get(k).push(sp.name);
      }
    }
  }
  return _abilityCarriers.get(_id(ability)) || [];
}

/* Can THIS body legally hold THIS move — the validator's own verdict, cached per pair. */
function canLearn(species, move) {
  const { Dex, TeamValidator } = sim();
  const dex = Dex.forFormat(FORMAT);
  const sp = dex.species.get(species), mv = dex.moves.get(move);
  if (!sp.exists || !mv.exists) return false;
  const k = sp.id + '|' + mv.id;
  if (_learn.has(k)) return _learn.get(k);
  if (!_validator) _validator = new TeamValidator(FORMAT);
  let ok = false;
  /* ROADMAP #258 — A VALIDATOR THAT THREW IS NOT A MOVE THAT CANNOT BE LEARNED. This returned `false`
   * on any exception, so a TeamValidator failure became a LEGALITY CLAIM about this format, published
   * with the same confidence as a real answer. `false` stays (refusing to teach a move we cannot
   * confirm is the safe direction) but it is now COUNTED and named, so a validator that starts
   * throwing shows up as a number instead of as a format that quietly forgot its learnsets. */
  try { ok = _validator.checkCanLearn(mv, sp, _validator.allSources(sp), {}) == null; }
  catch (e) {
    ok = false;
    learnCounters.validatorThrew++;
    if (!learnCounters.firstThrow) {
      learnCounters.firstThrow = sp.id + '/' + mv.id + ': ' + String((e && e.message) || e).split(String.fromCharCode(10))[0];
      console.error('  checkCanLearn THREW and the answer was recorded as CANNOT LEARN — ' + learnCounters.firstThrow);
    }
  }
  _learn.set(k, ok);
  return ok;
}

/* Every legal body that can learn this move. The whole-roster walk is cached per move because it is
 * ~700 validator calls. */
function moveCarriers(move) {
  const { Dex } = sim();
  const mv = Dex.forFormat(FORMAT).moves.get(move);
  if (!mv.exists || mv.isNonstandard) return [];
  if (_moveCarriers.has(mv.id)) return _moveCarriers.get(mv.id);
  const out = legalRoster().filter(sp => canLearn(sp.name, mv.name)).map(sp => sp.name);
  _moveCarriers.set(mv.id, out);
  return out;
}

/* `unreachable(kind, id)` WAS DELETED 2026-09-11 (docs/_reports/2026-09-11-scope-unified.md). It was a fifth
 * scope decider — tier filter, no validator, no conferral, no reader rule — wrong on all three rows the
 * unification found (it called Battle Bond reachable, Simple unreachable and Gluttony reachable), and it had
 * ZERO callers in engine/, tests/, build/, tools/ or web/, tracked or not. "Is this mechanic in the
 * regulation" is answered by the `verdict(kind, id)` of engine/legal_scope.js's `derive()`; it cannot
 * live here, because legal_scope loads this file. (Named in prose on purpose: engine/engine_release.js
 * reads a require-call literal anywhere in a frozen source, comments included, as a dependency.)
 * `abilityCarriers` / `moveCarriers` stay: they answer WHICH BODIES. */

module.exports = { FORMAT, FORMAT_FALLBACK, dexFor, PINNED_COMMIT, PINNED_DATE, actualCommit, verify, packTeam, battle, winProb, sim,
                   snapshot, forkBattle, checkLegal, firstLegalMove, LEGAL_SPREAD, INERT_MOVE,
                   legalRoster, abilityCarriers, moveCarriers, canLearn, learnCounters };

if (require.main === module) {
  const v = verify();
  console.log('CHAMPIONS SIMULATOR');
  console.log(`  format        ${v.format}  ${v.ok ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`  name          ${v.name}`);
  console.log(`  mod           ${v.mod}`);
  console.log(`  champions fmts ${v.champions_formats}`);
  console.log(`  pinned        ${v.pinned_commit.slice(0, 12)} (${v.pinned_date})`);
  if (!v.ok) process.exit(1);
}
