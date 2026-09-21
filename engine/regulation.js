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
      checkout: null, pinnedCommit: null, pinnedDate: null, engineData: null, in_regulations: false, in_runtime: false },
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
const DEFAULT_ENGINE_DATA = 'data/engine-data.js';
const ENGINE_DATA = (() => {
  const t = SEL.entry.engineData;
  if (!t) return DEFAULT_ENGINE_DATA;
  /* The table is a sibling of engine-data.js in `data/`, so the same rule finds it in a release. */
  if (!/^data\/[A-Za-z0-9._-]+\.js$/.test(String(t))) {
    throw new Error('regulation: REFUSING — ' + ID + ' names engineData "' + t + '" in data/regulations.json.\n'
      + '  It must be a data/<file>.js path: the table is resolved as a SIBLING of data/engine-data.js,\n'
      + '  which is what lets the same rule find it inside a frozen release.');
  }
  return t;
})();
const TABLE_BASENAME = path.basename(DEFAULT_ENGINE_DATA);
const isDefaultTable = abs => path.basename(String(abs)) === TABLE_BASENAME
  && path.basename(path.dirname(String(abs))) === 'data';
/* A capability that cannot prove it ran is assumed broken: every redirect is counted. */
const TABLE = { table: ENGINE_DATA, default: ENGINE_DATA === DEFAULT_ENGINE_DATA, installed: false, redirects: 0 };

/** The file a request for the table should load under the selected regulation. Identity when the
 *  regulation uses the default table, or when `abs` is not a `data/engine-data.js`. */
function tableFor(abs) {
  if (TABLE.default || !isDefaultTable(abs)) return abs;
  const alt = path.join(path.dirname(String(abs)), path.basename(ENGINE_DATA));
  if (!fs.existsSync(alt)) {
    const inRelease = /[\\/]releases[\\/][0-9a-f]{12}[\\/]data$/.test(path.dirname(String(abs)));
    throw new Error('regulation: REFUSING to load the damage table — this run selected ' + ID + ', whose table is '
      + ENGINE_DATA + ',\n  and ' + alt + ' does not exist.\n'
      + (inRelease
        ? '  That path is inside a frozen release, so the release was cut WITHOUT this regulation\'s table.\n'
          + '  Cut one with ' + ID + ' selected (node engine/engine_release.js cut "<why>" --regulation ' + ID + ').\n'
        : '  Build it with its builder (build/build_engine_data_regmc.js for regmc).\n')
      + '  Loading ' + DEFAULT_ENGINE_DATA + ' instead would build ' + ID + '\'s bodies from another regulation\'s table.');
  }
  TABLE.redirects++;
  return alt;
}

const HOOK = Symbol.for('abra.regulation.engineDataResolver');
function installTableResolver() {
  if (TABLE.default) return false;
  const Module = require('module');
  const early = Object.keys(Module._cache || {}).filter(isDefaultTable);
  if (early.length) {
    throw new Error('regulation: REFUSING — this run selected ' + ID + ' (table ' + ENGINE_DATA + '), and Reg M-B\'s\n'
      + '  table was ALREADY LOADED before the regulation resolver was:\n    ' + early.join('\n    ') + '\n'
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
  return true;
}
installTableResolver();

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
  if (!TABLE.default) bits.push('| table ' + ENGINE_DATA);
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
  /* Exported for the test, so the selection rule can be exercised against a varied knob rather than
   * against whatever this process happened to be started with. An identical result across a varied
   * knob means the knob is unwired. */
  select, keyFor, knownIds, entryFor, fromArgv,
};
