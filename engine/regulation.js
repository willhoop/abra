/* regulation.js — WHICH REGULATION THIS RUN IS ABOUT. One answer, chosen at RUN TIME.
 *
 * THE HOLE THIS CLOSES. `champions_sim.FORMAT` was a load-time constant read out of
 * `data/regulations.json` and nothing else could say otherwise. It is read 490 times across 357
 * files under engine/ tests/ build/ web/, and there was no flag and no environment override
 * anywhere. So the only way to point ABRA at a second regulation was to EDIT the shared config —
 * which is what the first Reg M-C smoke run had to do (`docs/_reports/2026-09-20-regmc-first-run.md`
 * §1a, §7: flipped `active` in a worktree and restored it in the same session).
 *
 * A run that rewrites shared config is a run that can corrupt another one beside it. Two agents,
 * two regulations, one `active` key: the later write wins and NEITHER measurement knows. That is the
 * signature failure of this repository — a capability absent with everything reporting success —
 * arriving through the config file rather than the code.
 *
 * WHY THE 490 READINGS ARE NOT 490 PIECES OF WORK. They are one constant with 490 readers. Point the
 * constant at a resolver and every reader follows with no edit, including a reader written tomorrow.
 * The same argument `showdown_path.js` makes about twenty copies of `if (!process.env.SHOWDOWN_PATH)`,
 * and the same argument `champions_sim.dexFor` makes about its 228 through-seam call sites: the seam
 * is the fix, a sweep is not.
 *
 * ---------------------------------------------------------------------------------------------
 * HOW A CALLER SELECTS ONE. Precedence, highest first. An explicit choice ALWAYS wins, because this
 * must never silently override what a person typed:
 *
 *   1.  --regulation <id>   /  --regulation=<id>     on the command line of ANY script
 *   2.  ABRA_REGULATION=<id>                         in the environment (and inherited by children)
 *   3.  data/regulations.json `active`               THE DEFAULT — unchanged behaviour
 *
 * `<id>` may be a regulation KEY (`regmb`), or a full Showdown format id
 * (`gen9championsvgc2026regmb`), which is mapped back to its key. Nothing is spelled out by
 * concatenation: every format id served here was READ out of `data/regulations.json`, and every id
 * in that file that this module added was read out of a Showdown checkout's own `Dex.formats.all()`.
 *
 * WITH NOTHING SPECIFIED THIS MODULE IS A NO-OP. It resolves the same id the inlined
 * `JSON.parse(readFileSync(regulations.json))` blocks resolved, it prints nothing, and it does not
 * touch the environment. That is the bar for a refactor and it is asserted by
 * `tests/test-regulation-runtime.js`.
 *
 * ---------------------------------------------------------------------------------------------
 * THE CHOICE IS PRINTED BY ANY RUN THAT MAKES ONE.
 *
 * A silent default is how a measurement ends up describing a format nobody asked about — this file's
 * whole reason for existing. So every deviation from the default announces itself on stderr, once,
 * at load: an explicit selection, a regulation-directed checkout, or a fallback. `describe()` hands
 * the same line to any artifact that wants to stamp what it was about.
 *
 * The DEFAULT is deliberately silent, and that is not an exception to the rule. Printing on every
 * one of several hundred existing callers would change the bytes of every run's output for no
 * information — and a line printed on every run is a line nobody reads, which is the `PRE-CHANGE`
 * caption lesson. What must be loud is the DEVIATION.
 *
 * ---------------------------------------------------------------------------------------------
 * AN EXPLICIT SELECTION THAT CANNOT BE RESOLVED REFUSES. THE DEFAULT ONE FALLS BACK, LOUDLY.
 *
 * `champions_sim.js` has always carried a hardcoded literal for the case where the config cannot be
 * read, on the stated ground that "guessing beats crashing a collection job". That stays, for the
 * DEFAULT path only. It does not extend to a regulation somebody NAMED: answering a request for
 * `regmc` with M-B's format id is precisely the wrong-regulation figure this file exists to prevent,
 * and it would arrive wearing a successful exit code.
 *
 * ---------------------------------------------------------------------------------------------
 * SELECTING A REGULATION SELECTS A CHECKOUT.
 *
 * `Dex.forFormat(id)` does not throw on an id Showdown has never heard of — it returns mainline Gen
 * 9 (see `champions_sim.dexFor`). Reg M-B's authority checkout does not carry Reg M-C, so a run that
 * selected M-C's format id against M-B's bytes would be refused by `dexFor` — loudly, which is
 * already safe. But refusing is not serving: the regulation has to bring its checkout with it.
 *
 * This module does NOT validate a checkout path. It publishes CANDIDATES and `showdown_path.js`
 * validates them with the one `looksLikeShowdown` this project has — one fact, one implementation.
 * An explicit `SHOWDOWN_PATH` still wins over all of it, unchanged.
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* No require of anything in this repository, deliberately. `showdown_path.js` requires THIS, and a
 * cycle between the two would resolve to a half-initialised module in whichever order node happened
 * to reach them first. The dependency is one-way: regulation -> (nothing). */

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'data', 'regulations.json');

/* The literal below is the fallback for a corrupt or missing config on the DEFAULT path only, and it
 * is the same literal `champions_sim.js` has always carried. It is never used to answer an explicit
 * `--regulation`. */
const CONFIG_FALLBACK_FORMAT = 'gen9championsvgc2026regmb';
const CONFIG_FALLBACK_ID = 'regmb';

const toID = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- the config ------------------------------------------------------------------------------ */

let CONFIG_ERROR = null;
const RAW = (() => {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); }
  catch (e) { CONFIG_ERROR = 'could not read data/regulations.json: ' + ((e && e.message) || e); return null; }
})();

/* TWO MAPS, AND THEY MEAN DIFFERENT THINGS. `regulations` is the set of regulations whose STORE this
 * project owns — `engine/next_regulation.js` walks exactly that map to decide what is already known
 * and what is a candidate for collection, so an entry added there stops the hourly collector seeing
 * a format as new. `runtime` is the set a RUN may be pointed at. They overlap and neither contains
 * the other: M-B is in both; M-C is runnable today and its store is not owned yet.
 *
 * Merging them was the first design and it is wrong in a way that would have been invisible: adding
 * `regmc` to `regulations` reclassifies it from `candidate` to `known` and the collector quietly
 * stops collecting the regulation this whole exercise is for. */
const REGULATIONS = (RAW && RAW.regulations) || {};
const RUNTIME = (RAW && RAW.runtime) || {};

/* A runtime entry INHERITS the format ids of a regulation of the same key rather than restating
 * them. Two files that both decide a format id will disagree eventually, and the disagreement will
 * be invisible because both keep working. */
function entryFor(id) {
  const base = REGULATIONS[id] || null;
  const rt = RUNTIME[id] || null;
  if (!base && !rt) return null;
  return {
    id,
    label: (rt && rt.label) || (base && base.label) || null,
    showdownFormat: (base && base.showdownFormat) || (rt && rt.showdownFormat) || null,
    bo3Format: (base && base.bo3Format) || (rt && rt.bo3Format) || null,
    checkout: (rt && rt.checkout) || null,
    pinnedCommit: (rt && rt.pinnedCommit) || null,
    pinnedDate: (rt && rt.pinnedDate) || null,
    /* The damage table this regulation's bodies are built from. null = `data/engine-data.js`. A
     * `runtime` key only — `regulations` is the STORE map and says nothing about the engine. */
    engineData: (rt && rt.engineData) || null,
    /* 2026-09-21 (ENGINE) -- the tag file and the protocol-events file follow the regulation by the
     * same sibling rule as the table. null = the Reg M-B file. */
    tags: (rt && rt.tags) || null,
    protocolEvents: (rt && rt.protocolEvents) || null,
    /* 2026-09-21 (MEASURE, abra/regmc 0.19.0) -- the behaviour table the empirical driver clicks out of,
     * P(move | species). null = the Reg M-B file. */
    movePriors: (rt && rt.movePriors) || null,
    /* 2026-09-22 (ENGINE, abra/regmc 0.24.0) -- the move-effects rulebook (secondaries, certain boosts, accuracy).
     * null = the Reg M-B file. */
    moveEffects: (rt && rt.moveEffects) || null,
    in_regulations: !!base,
    in_runtime: !!rt,
  };
}

function knownIds() {
  const s = new Set();
  for (const k of Object.keys(REGULATIONS)) s.add(k);
  for (const k of Object.keys(RUNTIME)) if (k[0] !== '_') s.add(k);
  return [...s];
}

/* An id a caller typed may be a key OR a format id. Resolve both without ever spelling one out. */
function keyFor(requested) {
  const want = toID(requested);
  if (!want) return null;
  for (const k of knownIds()) if (toID(k) === want) return k;
  for (const k of knownIds()) {
    const e = entryFor(k);
    if (!e) continue;
    if (e.showdownFormat && toID(e.showdownFormat) === want) return k;
    if (e.bo3Format && toID(e.bo3Format) === want) return k;
  }
  return null;
}

/* ---- the selection --------------------------------------------------------------------------- */

/* Read off THIS process's argv, so every one of the several hundred scripts in this repository
 * honours the flag without an edit — including one written tomorrow. The alternative was a flag
 * added to each entry point, which is the 490-readings mistake in a new costume.
 *
 * argv is scanned rather than parsed: the scripts here use a dozen different ad-hoc parsers and
 * several refuse unknown flags, so this must not depend on any of them. */
function fromArgv(argv) {
  const a = argv || [];
  for (let i = 0; i < a.length; i++) {
    const t = String(a[i]);
    if (t === '--regulation' || t === '--reg') {
      const v = a[i + 1];
      if (v == null || String(v).startsWith('--')) {
        throw new Error('regulation: ' + t + ' was given with no value. Say which regulation, e.g. '
          + t + ' regmb. Known: ' + knownIds().join(', '));
      }
      return { value: String(v), how: t };
    }
    let m = /^--regulation=(.*)$/.exec(t) || /^--reg=(.*)$/.exec(t);
    if (m) {
      if (!m[1]) throw new Error('regulation: ' + t + ' has an empty value. Known: ' + knownIds().join(', '));
      return { value: m[1], how: t.split('=')[0] };
    }
  }
  return null;
}

function select(opts) {
  const o = opts || {};
  const argv = o.argv || process.argv.slice(2);
  const env = ('env' in o) ? o.env : process.env.ABRA_REGULATION;

  const flag = fromArgv(argv);
  const requested = flag ? flag.value : (env ? String(env) : null);
  const how = flag ? (flag.how + ' flag') : (env ? 'ABRA_REGULATION env' : null);

  if (requested) {
    const k = keyFor(requested);
    /* REFUSE. Do not guess about a regulation somebody named. */
    if (!k) {
      throw new Error(
        'regulation: REFUSING to run — ' + how + ' asked for "' + requested + '" and\n'
        + '  data/regulations.json does not describe it.\n'
        + (CONFIG_ERROR ? '  The config could not be read: ' + CONFIG_ERROR + '\n' : '')
        + '  Known: ' + (knownIds().join(', ') || '(none)') + '\n'
        + '  Add it under `runtime` in data/regulations.json with its showdownFormat, bo3Format,\n'
        + '  checkout and pinned commit — all four READ out of the Showdown checkout that carries\n'
        + '  it, never typed. See docs/REGULATION-ROTATION.md step 8.');
    }
    const e = entryFor(k);
    if (!e.showdownFormat) {
      throw new Error('regulation: REFUSING to run — ' + how + ' asked for "' + requested
        + '" and its entry in data/regulations.json carries no showdownFormat.');
    }
    return { id: k, entry: e, source: how, explicit: true, fallback: null };
  }

  /* THE DEFAULT PATH. Behaviour here is unchanged from the inlined reads it replaces, including the
   * loud fallback champions_sim.js already had. */
  const activeKey = RAW && RAW.active;
  const e = activeKey ? entryFor(activeKey) : null;
  if (e && e.showdownFormat) {
    return { id: activeKey, entry: e, source: 'data/regulations.json active', explicit: false, fallback: null };
  }
  const why = CONFIG_ERROR
    || (activeKey ? 'data/regulations.json names active="' + activeKey + '" and that entry has no showdownFormat'
      : 'data/regulations.json names no active regulation');
  return {
    id: CONFIG_FALLBACK_ID,
    entry: { id: CONFIG_FALLBACK_ID, label: null, showdownFormat: CONFIG_FALLBACK_FORMAT, bo3Format: null,
      checkout: null, pinnedCommit: null, pinnedDate: null, engineData: null, tags: null, protocolEvents: null,
      in_regulations: false, in_runtime: false },
    source: 'HARDCODED FALLBACK',
    explicit: false,
    fallback: why,
  };
}

const SEL = select();

/* ---- the checkout ---------------------------------------------------------------------------- */

/* A directory NAME in the config, not a path: the same name resolves differently in the main
 * checkout and in a git worktree, and a machine-specific absolute path in a tracked config is a
 * config that is wrong on every other machine. An absolute value is honoured as given, for a
 * checkout kept somewhere else.
 *
 * These are CANDIDATES. Nothing here checks that any of them exists — `showdown_path.js` owns
 * `looksLikeShowdown` and owns it alone. */
function checkoutCandidates() {
  const c = SEL.entry.checkout;
  if (!c) return [];
  if (path.isAbsolute(c)) return [c];
  return [
    /* Beside the repository, where `git clone` beside this repo puts it, and where it is. */
    path.join(ROOT, '..', c),
    /* And beside the MAIN checkout when this is a git worktree: <repo>/.claude/worktrees/<x> is
     * three levels down, so `..` alone lands in `.claude/worktrees` and finds nothing. This is the
     * same hole that makes an un-exported SHOWDOWN_PATH fail inside a worktree today. */
    path.join(ROOT, '..', '..', '..', '..', c),
    path.join(ROOT, c),
  ];
}

/* ---- what everybody reads -------------------------------------------------------------------- */

const ID = SEL.id;
const FORMAT = SEL.entry.showdownFormat;
const BO3_FORMAT = SEL.entry.bo3Format;
const LABEL = SEL.entry.label;
const PINNED_COMMIT = SEL.entry.pinnedCommit;
const PINNED_DATE = SEL.entry.pinnedDate;

/* Propagate an EXPLICIT selection to children. A script that spawns a worker gets the regulation
 * without that script knowing this module exists — the identical reason `showdown_path.js` writes
 * SHOWDOWN_PATH. Only on the explicit path: writing it on the default would turn "nobody chose" into
 * "the environment chose", which is a different fact. */
if (SEL.explicit && !process.env.ABRA_REGULATION) process.env.ABRA_REGULATION = ID;

/* ---- THE DAMAGE TABLE FOLLOWS THE REGULATION — 2026-09-21 (MEASURE) ---------------------------
 *
 * ~130 call sites load the table BY PATH — a plain require of the data file, `REL.require` and
 * `REL.path` of it out of a release, board.js's lazy require. They load
 * it for its side effect (`globalThis.MC`, `mcEff`), and every consumer reads the global. So the
 * same argument as `CS.FORMAT`'s 490 readings applies one layer down: the readers were never the
 * work, the PATH was. Resolve the path once and every reader follows with no edit, including one
 * written tomorrow.
 *
 * THE MECHANISM IS NODE'S OWN RESOLVER. When the selected regulation names a table of its own
 * (`runtime.<id>.engineData` in data/regulations.json), `Module._resolveFilename` is wrapped so that
 * a request that resolves to `<dir>/data/engine-data.js` returns `<dir>/<that table>` instead — the
 * SIBLING in the same `data/` directory. That one rule serves the live tree and a frozen release
 * alike: out of `data/releases/<id>/` it finds the table the release froze, or finds nothing.
 *
 * FINDING NOTHING REFUSES. A regulation that names a table and cannot load it throws, by name. The
 * alternative — carrying on with `data/engine-data.js` — builds one regulation's teams from another
 * regulation's table, which is the exact failure this exists to prevent, and it would exit 0.
 *
 * WITH REG M-B SELECTED (or nothing selected) NOTHING IS INSTALLED. No wrapper, no redirect, no
 * lookup: the default path is the code that ran before this block existed, byte for byte, which is
 * what makes "Reg M-B unmoved" true by construction before any run confirms it.
 *
 * ORDER, AND WHAT HAPPENS WHEN IT IS WRONG. The wrapper can only redirect a require that happens
 * AFTER this module loads. A caller that loads Reg M-B's table first and this module later would run
 * the wrong table silently, so this module REFUSES at load if it finds Reg M-B's table already in the
 * require cache under a regulation that names another. `engine/mc_key.js` — the one door every
 * table-loading file must also load (tests/test-mc-key.js clause 4), and the first thing a body build
 * touches — requires this module for exactly that reason: whatever the load order, a process that
 * builds a body under the wrong table is refused before it builds one. */
/* ---- 2026-09-21 (ENGINE) -- AND SO DO THE TAG FILE AND THE PROTOCOL-EVENTS FILE --------------------
 *
 * The first Reg M-C smoke parted 53 of 73 games on terrain set on entry by two abilities that are
 * simply ABSENT from Reg M-B's data/tags.json: tags are derived from the format, and nothing had
 * derived them for M-C. The tag file is the table's twin -- the engine loads it BY PATH
 * (engine/tags.js requires data/tags.json relative to its own __dirname, live and out of a release),
 * so the same sibling rule serves it with no reader edited. The protocol-events file is the
 * differential's alignment rule and is DERIVED off a Showdown checkout, so it is per regulation too.
 *
 * THE MAP. `runtime.<id>.<key>` in data/regulations.json names the regulation's own file; absent means
 * the Reg M-B file, and a regulation that names none of them installs nothing. Each must be a
 * `data/<file>` SIBLING of the default with the same extension, so one rule finds it in a release.
 *
 * WRITES ARE GUARDED AS WELL AS READS. A generator run under M-C that forgot to ask this module where
 * to write would overwrite Reg M-B's file and exit 0 -- tag_dex.js and derive_protocol_events.js both
 * default to the M-B path. So while such a regulation is selected a write, rename or copy ONTO the
 * live tree's Reg M-B file is REFUSED by name. Only the live tree's `data/` is guarded: a release cut
 * copies M-B's file into `data/releases/<id>/data/`, which is a different directory and correct. */
const REG_FILE_KEYS = [
  /* [entry key, the Reg M-B file it replaces] */
  ['engineData', 'data/engine-data.js'],
  ['tags', 'data/tags.json'],
  ['protocolEvents', 'data/protocol-events.json'],
  /* 2026-09-21 (MEASURE, abra/regmc 0.19.0) -- THE BEHAVIOUR TABLE. `data/move-priors.json` is P(move |
   * species) over recorded human clicks, and it is what the empirical arm of the differential CLICKS
   * (game_differential.js reads it out of the release). It is an engine SOURCE, so it belongs in this
   * map rather than the artifact list below: an M-C release freezes M-C's copy beside M-B's
   * (engine_release.js REGULATION_SOURCES), and a Reg M-C run steered off Reg M-B clicks would be a
   * Reg M-C measurement of Reg M-B behaviour that exited 0. */
  ['movePriors', 'data/move-priors.json'],
  /* 2026-09-22 (ENGINE, abra/regmc 0.24.0) -- THE MOVE-EFFECTS RULEBOOK. `data/move-effects.js` carries every legal move's
   * secondaries, certain boosts and accuracy (medicham2-browser.js `moveFxTable`, a lazy require relative to its own
   * __dirname, so this resolver serves it with no reader edited). It is generated from ONE format
   * (build/build_browser_data.js), and under Reg M-C the 15 legal moves Reg M-B lacks had NO ROW: no secondary, no
   * certain boost, accuracy falling back to 100 (docs/_reports/2026-09-22-regmc-engine.md section 1). A SOURCE: an M-C
   * release freezes the regulation's copy (engine_release.js REGULATION_SOURCES). */
  ['moveEffects', 'data/move-effects.js'],
];
const FILES = {};   /* default rel -> this regulation's rel, only where they differ */
for (const [key, def] of REG_FILE_KEYS) {
  const t = SEL.entry[key];
  if (!t || t === def) continue;
  const ext = path.extname(def);
  const shape = /^data\/[A-Za-z0-9._-]+$/.test(String(t)) && path.extname(String(t)) === ext;
  if (!shape) {
    throw new Error('regulation: REFUSING — ' + ID + ' names ' + key + ' "' + t + '" in data/regulations.json.\n'
      + '  It must be a data/<file>' + ext + ' path: it is resolved as a SIBLING of ' + def + ',\n'
      + '  which is what lets the same rule find it inside a frozen release.');
  }
  FILES[def] = String(t);
}
/** The repo-relative file this regulation reads in place of `rel`. Identity for anything unmapped. */
const fileFor = rel => FILES[String(rel).replace(/\\/g, '/')] || rel;
const DEFAULT_ENGINE_DATA = 'data/engine-data.js';
const ENGINE_DATA = fileFor(DEFAULT_ENGINE_DATA);
const TAGS_FILE = fileFor('data/tags.json');
const PROTOCOL_EVENTS_FILE = fileFor('data/protocol-events.json');
const MOVE_PRIORS_FILE = fileFor('data/move-priors.json');
const MOVE_EFFECTS_FILE = fileFor('data/move-effects.js');
/* basename of a Reg M-B file -> basename of this regulation's */
const BASE_MAP = {};
for (const def of Object.keys(FILES)) BASE_MAP[path.basename(def)] = path.basename(FILES[def]);
const mappedDefault = abs => Object.prototype.hasOwnProperty.call(BASE_MAP, path.basename(String(abs)))
  && path.basename(path.dirname(String(abs))) === 'data';
/* A capability that cannot prove it ran is assumed broken: every redirect is counted, per file. */
const TABLE = { table: ENGINE_DATA, default: !Object.keys(FILES).length, installed: false, redirects: 0,
  files: Object.assign({}, FILES), byFile: {}, writesRefused: 0 };

/** The file a request should load under the selected regulation. Identity when the regulation maps
 *  nothing, or when `abs` is not one of the mapped `data/<file>`s. Named for its first use, the table. */
function tableFor(abs) {
  if (TABLE.default || !mappedDefault(abs)) return abs;
  const base = path.basename(String(abs));
  const alt = path.join(path.dirname(String(abs)), BASE_MAP[base]);
  if (!fs.existsSync(alt)) {
    const inRelease = /[\\/]releases[\\/][0-9a-f]{12}[\\/]data$/.test(path.dirname(String(abs)));
    const own = 'data/' + BASE_MAP[base];
    throw new Error('regulation: REFUSING to load ' + base + ' — this run selected ' + ID + ', whose file is '
      + own + ',\n  and ' + alt + ' does not exist.\n'
      + (inRelease
        ? '  That path is inside a frozen release, so the release was cut WITHOUT this regulation\'s file.\n'
          + '  Cut one with ' + ID + ' selected (node engine/engine_release.js cut "<why>" --regulation ' + ID + ').\n'
        : '  Build it with its builder (build/build_engine_data_regmc.js for the table; engine/tag_dex.js\n'
          + '  --regulation ' + ID + ' for the tags; engine/derive_protocol_events.js --out ' + PROTOCOL_EVENTS_FILE + ').\n')
      + '  Loading data/' + base + ' instead would run ' + ID + ' on another regulation\'s ' + base + '.');
  }
  TABLE.redirects++;
  TABLE.byFile[base] = (TABLE.byFile[base] || 0) + 1;
  return alt;
}

const HOOK = Symbol.for('abra.regulation.engineDataResolver');
function installTableResolver() {
  if (TABLE.default) return false;
  const Module = require('module');
  const early = Object.keys(Module._cache || {}).filter(mappedDefault);
  if (early.length) {
    throw new Error('regulation: REFUSING — this run selected ' + ID + ' (table ' + ENGINE_DATA + '), and Reg M-B\'s\n'
      + '  file(s) were ALREADY LOADED before the regulation resolver was:\n    ' + early.join('\n    ') + '\n'
      + '  globalThis.MC is therefore the wrong regulation\'s table. Load engine/regulation.js (or anything\n'
      + '  that requires it: champions_sim, showdown_path, engine_release, mc_key) BEFORE the table in\n'
      + '  the entry point that loads it.');
  }
  const prior = globalThis[HOOK];
  if (prior) {
    /* A frozen release carries its own copy of this file. One wrapper per process, and two copies
     * that disagree about the table cannot both be right. */
    if (prior.table !== ENGINE_DATA) {
      throw new Error('regulation: REFUSING — two copies of engine/regulation.js in one process disagree about\n'
        + '  the damage table: ' + prior.table + ' (installed first) vs ' + ENGINE_DATA + ' (this copy).');
    }
    return false;
  }
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    return tableFor(orig.call(this, request, parent, isMain, options));
  };
  globalThis[HOOK] = { table: ENGINE_DATA, id: ID, stats: TABLE };
  TABLE.installed = true;
  guardWrites();
  return true;
}

/* THE WRITE GUARD -- see the block above FILES. Installed once, with the resolver, only when this
 * regulation maps a file. It guards the LIVE tree's Reg M-B files and nothing else. */
function guardWrites() {
  const guarded = new Set(Object.keys(FILES).map(def => path.resolve(ROOT, def).toLowerCase()));
  /* A non-string destination (a file descriptor, a Buffer or URL path) is not one of the guarded names
   * as spelled here and passes through untouched; a string is resolved, which cannot throw. */
  const hit = dest => typeof dest === 'string' && guarded.has(path.resolve(dest).toLowerCase());
  const refuse = (how, dest) => {
    TABLE.writesRefused++;
    throw new Error('regulation: REFUSING to ' + how + ' ' + dest + ' — this run selected ' + ID
      + ', which has its own\n  ' + path.basename(dest) + ' (' + FILES['data/' + path.basename(dest)] + '). That file is Reg M-B\'s and a run about '
      + ID + ' may not overwrite it.\n  Write to the path engine/regulation.js fileFor() gives.');
  };
  const wrap = (name, destArg, how) => {
    const orig = fs[name];
    if (typeof orig !== 'function') return;
    fs[name] = function () { if (hit(arguments[destArg])) refuse(how, arguments[destArg]); return orig.apply(this, arguments); };
  };
  wrap('writeFileSync', 0, 'write');
  wrap('appendFileSync', 0, 'append to');
  wrap('renameSync', 1, 'rename onto');
  wrap('copyFileSync', 1, 'copy onto');
}
installTableResolver();

/* ---- 2026-09-21 (MEASURE) -- AND SO DOES EVERY ARTIFACT THE GATE READS OR ITS INSTRUMENTS WRITE -----
 *
 * THE HAZARD. The block above moved the three files the ENGINE reads. It did not move the files the
 * MEASUREMENT reads and writes: `data/game-differential.json` and its lattice siblings, the roster
 * stages, `data/all-mechanics-fire.json`, `data/engine-diff.json`, the census, the release pointer, the
 * baselines and stamps. Every instrument wrote one fixed path, so a Reg M-C run with `--write`
 * OVERWROTE Reg M-B's published 7.0.0 evidence and exited 0 -- and `engine/quarantine.js` read those
 * same fixed paths, so it could only ever answer for Reg M-B.
 *
 * THE OWNER OF THE UNSUFFIXED NAMES IS REG M-B, FOREVER, NOT "WHICHEVER IS ACTIVE". Those files were
 * written by Reg M-B and are its closed record. If ownership followed `active`, flipping the config to
 * Reg M-C would make every M-C reader read M-B's evidence as its own -- the exact failure this block
 * exists to prevent, arriving on the day of the flip. So the owner is the same literal the fallback
 * above carries, and every OTHER regulation gets a sibling: `-<id>` before the final extension
 * (`game-differential.g1350.json` -> `game-differential.g1350-regmc.json`), which is the name
 * engine/engine_release.js already gives its per-regulation pointer. A directory gets the suffix
 * appended (`data/team-pool-frozen` -> `data/team-pool-frozen-regmc`, which is where the pool is).
 *
 * THE SEAM IS fs, FOR THE SAME REASON THE TABLE'S SEAM IS require. The readers and writers are a dozen
 * instruments (several owned by ENGINE, one of them 19,000 lines) and every one builds the path as
 * `D('data', '<name>')`. Editing each is the 490-readings mistake; a reader written tomorrow would miss
 * it. So while a non-owner regulation is selected, a read or write of a LIVE-tree `data/<name>` whose
 * name is declared below is answered by its sibling. Nothing is installed for Reg M-B: its path is the
 * code that ran before this block existed, byte for byte.
 *
 * A MISSING SIBLING IS ENOENT, NEVER A FALL-THROUGH. Reading Reg M-B's file because Reg M-C has none
 * yet would hand the M-C gate M-B's clean numbers, which is a pass nobody measured. ENOENT is what
 * every reader already treats as "no artifact", so the gate reports CANNOT-ANSWER by construction.
 *
 * THE LIST IS DECLARED AND CHECKED, NOT TRUSTED. `tests/test-regulation-artifacts.js` walks the gate's
 * artifact closure out of engine/quarantine.js's own derivation (its reads, and everything they were
 * built from, through provenance.js's graph) and fails on any member that is neither declared here nor
 * declared regulation-shared there with a reason. A new clause reading a new file fails that test.
 *
 * AND WHAT THE LIST MISSES STILL CANNOT BE OVERWRITTEN. The redirect is for files a run should FIND;
 * the guard is for files it must never TOUCH. While a non-owner regulation is selected, a write,
 * append, truncate, unlink, rename or copy onto ANY EXISTING file under the live `data/` whose path
 * does not name that regulation is REFUSED -- deny by default, so an artifact nobody thought to
 * declare is protected anyway. A NEW file is allowed (it overwrites nothing); `data/releases/` is
 * exempt (content-addressed: a cut writes a new directory, and a re-cut of the same tree appends to
 * its own). The three engine files keep the refusal the block above gives them. */
const ARTIFACT_OWNER = CONFIG_FALLBACK_ID;
const ARTIFACT_TAG = ID === ARTIFACT_OWNER ? null : ID;

/* [pattern over the data/ basename, the writer, what it is]. Families by pattern, so a new lattice
 * sample or roster stage is covered by existing, not by an edit here. */
const PER_REGULATION_ARTIFACTS = Object.freeze([
  [/^game-differential(\.g\d+)?\.json$/, 'engine/game_differential.js', 'the whole-game differential, one file per team lattice'],
  [/^divergence-turns\.json$/, 'engine/game_differential.js --dump-out', 'the differential\'s turn dump'],
  [/^engine-diff\.json$/, 'tests/test-engine-diff.js', 'the damage differential'],
  [/^roster(\.[a-z]+)?(\.prev)?\.json$/, 'tests/roster.js', 'the deliberate roster, every stage and its previous copy'],
  [/^all-mechanics-fire(\.boardstate)?\.json$/, 'engine/all_mechanics_fire.js', 'every mechanic staged against the authority'],
  [/^mechanics-census\.json$/, 'tests/test-mechanics.js', 'the census that steers what plays'],
  [/^engine-release\.json$/, 'engine/engine_release.js', 'the release pointer (engine_release.js names its own per-regulation pointer the same way)'],
  [/^published-samples\.json$/, 'engine/publish_guard.js', 'the published-sample ratchet'],
  [/^whole-game-baseline\.json$/, 'engine/quarantine.js --stamp-whole-game', 'the whole-game bar'],
  [/^quarantine-stamp\.json$/, 'engine/quarantine.js --check', 'the citation ratchet'],
  [/^decision-impact\.json$/, '(no writer today)', 'the paired decision-impact run'],
  [/^register-reality\.json$/, 'engine/register_reality.js', 'the register rows run against the engine'],
  [/^click-counts\.json$/, 'engine/click_counts.js', 'human click counts (reach)'],
  [/^sheet-usage\.json$/, 'engine/sheet_usage.js', 'sheet usage (reach)'],
  [/^diff-team-pool\.json$/, 'engine/diff_swarm.js', 'the team-pool cache the differential draws from'],
  [/^diff-swarm\.json$/, 'engine/diff_swarm.js --write', 'the swarm report'],
  /* 2026-09-21 (MEASURE, abra/regmc 0.19.0) -- THE EMPIRICAL DRIVER'S LIVE INPUTS. Both are facts about
   * HUMAN play read off the regulation's own replays, both are read LIVE by the differential, and until
   * this line a Reg M-C run read Reg M-B's. Declared, so under Reg M-C an absent sibling is ENOENT and
   * the run refuses rather than steering off the other regulation. */
  [/^rollout-switch-census\.json$/, 'engine/rollout_switch_census.js', 'the voluntary-switch rate the empirical driver prices a switch with'],
  [/^joint-click-census\.json$/, 'engine/joint_click_census.js', 'the joint arm target draw and switch-by-context table'],
  [/^move-priors\.observed\.json$/, 'engine/policy.js', 'the behaviour table as derived, before a person promotes it into the engine'],
]);
const POOL_DIR = 'data/team-pool-frozen';
const isPerRegulation = base => PER_REGULATION_ARTIFACTS.some(([re]) => re.test(String(base)));
/** `-<id>` before the final extension; a name with no extension (a directory) gets it appended. */
function siblingName(base, id) {
  const b = String(base), ext = path.extname(b);
  return ext ? b.slice(0, -ext.length) + '-' + id + ext : b + '-' + id;
}
/** The repo-relative path this regulation reads and writes in place of `rel`: the engine files by
 *  `fileFor`, then the declared artifacts and the frozen pool by the sibling rule. Identity under the
 *  owner (Reg M-B) and for anything undeclared. */
function artifactFor(rel) {
  const r = String(rel).replace(/\\/g, '/').replace(/^\.\//, '');
  const f = fileFor(r);
  if (f !== r || !ARTIFACT_TAG) return f;
  const m = /^data\/([^/]+)$/.exec(r);
  if (!m) return r;
  return (r === POOL_DIR || isPerRegulation(m[1])) ? 'data/' + siblingName(m[1], ARTIFACT_TAG) : r;
}

const LIVE_DATA = path.resolve(ROOT, 'data');
const ARTIFACTS = { owner: ARTIFACT_OWNER, tag: ARTIFACT_TAG, installed: false, redirects: 0, byFile: {},
  writesRefused: 0, refused: [] };
const ART_HOOK = Symbol.for('abra.regulation.artifactSeam');

function installArtifactSeam() {
  if (!ARTIFACT_TAG) return false;
  const prior = globalThis[ART_HOOK];
  if (prior) {
    /* One seam per process. A frozen release carries its own copy of this file; its ROOT is the
     * release directory, and a second seam would guard a directory nobody measures. */
    if (prior.tag !== ARTIFACT_TAG) {
      throw new Error('regulation: REFUSING -- two copies of engine/regulation.js in one process disagree about\n'
        + '  the regulation artifacts belong to: ' + prior.tag + ' (installed first) vs ' + ARTIFACT_TAG + '.');
    }
    return false;
  }
  const orig = {};
  const low = s => s.toLowerCase();
  const liveData = low(LIVE_DATA);
  /* a string path under the live data/ -> its sibling, when declared; otherwise null */
  const redirect = p => {
    if (typeof p !== 'string') return null;
    const abs = path.resolve(p);
    if (low(path.dirname(abs)) !== liveData) return null;
    const base = path.basename(abs);
    if (!isPerRegulation(base)) return null;
    ARTIFACTS.redirects++;
    ARTIFACTS.byFile[base] = (ARTIFACTS.byFile[base] || 0) + 1;
    return path.join(path.dirname(abs), siblingName(base, ARTIFACT_TAG));
  };
  const map = p => redirect(p) || p;
  /* the three engine files keep their own refusal (guardWrites, above) and its wording */
  const engineOwned = new Set(Object.keys(FILES).map(def => low(path.resolve(ROOT, def))));
  const guarded = p => {
    if (typeof p !== 'string') return false;
    const abs = path.resolve(p);
    const rel = path.relative(LIVE_DATA, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
    const r = low(rel).replace(/\\/g, '/');
    if (r.startsWith('releases/') || r.includes(low(ARTIFACT_TAG)) || engineOwned.has(low(abs))) return false;
    return orig.existsSync(abs);
  };
  const refuse = (how, p) => {
    ARTIFACTS.writesRefused++;
    ARTIFACTS.refused.push(how + ' ' + p);
    throw new Error('regulation: REFUSING to ' + how + ' ' + p + ' -- this run selected ' + ID
      + ', and that file already exists\n  under data/ without naming ' + ID + ', so it is '
      + ARTIFACT_OWNER + '\'s (or shared) and a run about ' + ID + ' may not change it.\n'
      + '  If it is a per-regulation artifact, declare it in PER_REGULATION_ARTIFACTS in engine/regulation.js\n'
      + '  and it will be written to its sibling ' + siblingName(path.basename(p), ARTIFACT_TAG) + ' instead.');
  };
  const WRITE_FLAGS = /[wa+]/;
  const wrap1 = (name, how) => {       /* path at argument 0; `how` set = a write */
    orig[name] = fs[name];
    if (typeof orig[name] !== 'function') return;
    fs[name] = function () {
      const a = Array.prototype.slice.call(arguments);
      a[0] = map(a[0]);
      const w = typeof how === 'function' ? how(a) : how;
      if (w && guarded(a[0])) refuse(w, a[0]);
      return orig[name].apply(this, a);
    };
  };
  const wrap2 = (name, how) => {       /* (src, dst): both mapped; dst is written, and a rename also removes src */
    orig[name] = fs[name];
    if (typeof orig[name] !== 'function') return;
    fs[name] = function () {
      const a = Array.prototype.slice.call(arguments);
      a[0] = map(a[0]); a[1] = map(a[1]);
      if (guarded(a[1])) refuse(how, a[1]);
      if (name === 'renameSync' && guarded(a[0])) refuse('rename away', a[0]);
      return orig[name].apply(this, a);
    };
  };
  orig.existsSync = fs.existsSync;
  for (const n of ['readFileSync', 'existsSync', 'statSync', 'lstatSync', 'accessSync', 'createReadStream', 'readFile']) wrap1(n, null);
  for (const [n, how] of [['writeFileSync', 'write'], ['appendFileSync', 'append to'], ['writeFile', 'write'],
    ['appendFile', 'append to'], ['createWriteStream', 'write'], ['truncateSync', 'truncate'],
    ['unlinkSync', 'delete'], ['rmSync', 'delete']]) wrap1(n, how);
  wrap1('openSync', a => (WRITE_FLAGS.test(String(a[1] == null ? 'r' : a[1])) ? 'open for writing' : null));
  wrap2('renameSync', 'rename onto');
  wrap2('copyFileSync', 'copy onto');
  if (fs.promises) {
    for (const [n, how] of [['readFile', null], ['writeFile', 'write'], ['appendFile', 'append to']]) {
      const o = fs.promises[n];
      if (typeof o !== 'function') continue;
      fs.promises[n] = function () {
        const a = Array.prototype.slice.call(arguments);
        a[0] = map(a[0]);
        if (how && guarded(a[0])) return Promise.reject(new Error('regulation: REFUSING to ' + how + ' ' + a[0]
          + ' -- it exists under data/ without naming ' + ID + '.'));
        return o.apply(this, a);
      };
    }
  }
  globalThis[ART_HOOK] = { tag: ARTIFACT_TAG, stats: ARTIFACTS };
  ARTIFACTS.installed = true;
  return true;
}
installArtifactSeam();

function describe() {
  const bits = [
    'ABRA REGULATION: ' + ID,
    FORMAT ? '(' + FORMAT + ')' : '(NO FORMAT ID)',
    'by ' + SEL.source,
  ];
  /* THE ANNOUNCEMENT MUST NAME THE CHECKOUT THAT ACTUALLY RUNS — 2026-09-21. An explicit
   * SHOWDOWN_PATH wins over the regulation's checkout, deliberately, and tests/run-all.js resolves
   * that path ONCE and propagates it into every child. So a child that selected Reg M-C was
   * announcing the M-C checkout while reading Reg M-B's: the simulator refused rather than running
   * the wrong format, so no figure was wrong, but a message that disagrees with what the code does
   * is the same shape as a green check that verifies nothing. It now says which one wins. */
  if (SEL.entry.checkout) {
    const env = process.env.SHOWDOWN_PATH;
    const norm = x => path.resolve(String(x)).toLowerCase();  /* resolve() normalises separators */
    const overridden = !!env && !checkoutCandidates().some(c => norm(c) === norm(env));
    bits.push('| checkout ' + SEL.entry.checkout + (overridden
      ? '  OVERRIDDEN by SHOWDOWN_PATH=' + env + ' -- THAT is the checkout this run reads'
      : ''));
  }
  if (!TABLE.default) bits.push('| files ' + Object.values(FILES).join(', '));
  if (ARTIFACT_TAG) bits.push('| artifacts data/<name>-' + ARTIFACT_TAG + '.<ext> (Reg M-B\'s unsuffixed files are never read or written)');
  if (SEL.fallback) bits.push('| FALLBACK: ' + SEL.fallback);
  return bits.join('  ');
}

let announced = false;
function announce(force) {
  if (announced && !force) return false;
  announced = true;
  console.error(describe());
  return true;
}

/* THE RULE AT THE TOP, ENFORCED HERE: any deviation from the default says so, once, at load. */
if (SEL.explicit || SEL.fallback) announce();

module.exports = {
  ID, FORMAT, BO3_FORMAT, LABEL, PINNED_COMMIT, PINNED_DATE,
  /* 'data/regulations.json active' | '--regulation flag' | 'ABRA_REGULATION env' | 'HARDCODED FALLBACK' */
  SOURCE: SEL.source,
  /* true when a caller NAMED a regulation. A figure produced with this true is about a regulation
   * somebody asked for; with it false it is about whatever the config said that day. */
  EXPLICIT: SEL.explicit,
  /* null when the config answered; a REASON string when the hardcoded literal was used instead. */
  FALLBACK: SEL.fallback,
  CONFIG_ERROR,
  entry: SEL.entry,
  checkoutCandidates,
  describe, announce,
  /* The damage table: ENGINE_DATA is the repo-relative path this regulation's bodies are built from.
   * table() reports whether the resolver is installed and how many requires it has redirected. */
  ENGINE_DATA, DEFAULT_ENGINE_DATA, tableFor, table: () => Object.assign({}, TABLE),
  /* 2026-09-21 (ENGINE): the tag file and the protocol-events file, by the same rule. fileFor(rel) is
   * the one answer to "which file does this regulation read in place of rel"; FILES is the whole map
   * (empty for Reg M-B). */
  TAGS_FILE, PROTOCOL_EVENTS_FILE, fileFor, FILES: Object.assign({}, FILES),
  /* 2026-09-21 (MEASURE): the behaviour table, by the same rule; and every Reg M-B file this map can
   * replace, whichever regulation is selected (FILES above is empty under Reg M-B). */
  MOVE_PRIORS_FILE, MOVE_EFFECTS_FILE, FILE_DEFAULTS: REG_FILE_KEYS.map(([, def]) => def),
  /* 2026-09-21 (MEASURE): the gate's artifacts by the sibling rule. artifactFor(rel) is the one answer to
   * "which file does this regulation's measurement read or write in place of rel"; identity under
   * ARTIFACT_OWNER. artifacts() reports whether the fs seam is installed and what it redirected/refused. */
  ARTIFACT_OWNER, ARTIFACT_TAG, PER_REGULATION_ARTIFACTS, POOL_DIR, artifactFor, siblingName, isPerRegulation,
  artifacts: () => Object.assign({}, ARTIFACTS, { byFile: Object.assign({}, ARTIFACTS.byFile), refused: ARTIFACTS.refused.slice() }),
  /* Exported for the test, so the selection rule can be exercised against a varied knob rather than
   * against whatever this process happened to be started with. An identical result across a varied
   * knob means the knob is unwired. */
  select, keyFor, knownIds, entryFor, fromArgv,
};
