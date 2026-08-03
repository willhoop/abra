/* build_board_browser.js — the data engine/board.js needs, as a browser global.
 *
 * WHY (docs/ROADMAP.md item 6, and the last failing test in the suite)
 * -------------------------------------------------------------------
 * app/index.html carries its own feature scorer because board.js could not load in a browser. That
 * scorer assigns 21 of 56 features and disagrees with the engine on 8 of them across 9 fixture
 * cases, so a reader of the site sees numbers the bot did not compute.
 *
 * board.js was made dual-mode on 2026-08-01: every data read prefers globalThis.__ABRA_BOARD_DATA
 * and falls back to fs, so node is untouched. This emits that global.
 *
 * ONLY WHAT IS ACTUALLY READ. data/smogon-priors.json is 1.29 MB and the page is already 273 KB, so
 * shipping it whole would more than double the page for data board.js never touches. Grepped from
 * board.js rather than guessed — it reads exactly three things from that file:
 *
 *     v.spreads      spreadLines(),  board.js:938   — rows carrying an `sp` array
 *     v.abilities    abilityTables(), board.js:1755 — [ability, pct/100]
 *     v.items        abilityTables(), board.js:1760 — ONLY to find the Focus Sash share
 *
 * The Focus Sash reduction matters: the whole `items` list per species is carried only so one entry
 * can be found, so the build keeps that single number and drops the rest.
 *
 * IF board.js STARTS READING SOMETHING ELSE, this bundle silently starves it — the reads fall back
 * to null and the features degrade quietly, which is the failure mode this project keeps paying for.
 * tests/test-board-browser.js asserts the two agree feature-for-feature, so a new read fails there
 * rather than shipping a quieter page.
 *
 *   node build/build_board_browser.js        -> data/board-data.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function readJSON(name) {
  try { return JSON.parse(fs.readFileSync(D('data', name), 'utf8')); }
  catch (e) {
    /* Loud: a missing input here produces a bundle that starves board.js in the browser while node
     * keeps working, which is the hardest kind of divergence to notice. */
    console.error(`build_board_browser: cannot read data/${name} — ${e.message}`);
    process.exit(1);
  }
}

/* ---- smogon-priors, reduced to the three fields board.js reads --------------------------------- */
const SASH = 'focussash';
const priors = readJSON('smogon-priors.json');
const species = {};
let spreadRows = 0, abilRows = 0, sashRows = 0;
for (const [k, v] of Object.entries(priors.species || {})) {
  if (!v) continue;
  const row = {};
  const spreads = (v.spreads || []).filter(s => s && Array.isArray(s.sp));
  if (spreads.length) { row.spreads = spreads; spreadRows += spreads.length; }
  if (Array.isArray(v.abilities) && v.abilities.length) {
    row.abilities = v.abilities.map(a => ({ ability: a.ability, pct: a.pct }));
    abilRows += row.abilities.length;
  }
  /* Only the Focus Sash entry survives, because that is the only item board.js looks for. Kept in
   * the same SHAPE the file uses, so board.js needs no special case for the bundled form. */
  const sash = (v.items || []).find(it => it && norm(it.item) === SASH);
  if (sash) { row.items = [{ item: sash.item, pct: sash.pct }]; sashRows++; }
  if (Object.keys(row).length) species[k] = row;
}

const bundle = {
  'smogon-priors.json': { species },
  'move-priors.json': readJSON('move-priors.json'),
  'ability-blocks.json': readJSON('ability-blocks.json'),
};

/* ---- THE DEX, INCLUDING ITS HANDLERS ----------------------------------------------------------
 *
 * This is what the first version of this file did not ship, and the reason was believed to be
 * fundamental: board.js does not merely read dex FIELDS, it CALLS dex HANDLERS — onModifyType,
 * onModifyPriority, onModifySpe, onStart, onChangeBoost, onTryBoost, onAfterEachBoost,
 * onAnyModifyDamage, basePowerCallback. Functions do not survive JSON, so 8 of the 36 features the
 * page is missing looked unshippable — and a bundle that quietly omitted them would make those
 * features read zero in a browser while working in node, the hardest divergence there is to notice.
 *
 * MEASURED 2026-08-02, AND THE BELIEF WAS WRONG. Every one of those handlers is invoked by board.js
 * with a `this` context BOARD.JS ITSELF BUILDS — `m.onModifyType.call({ field, dex }, ...)`,
 * `A.onModifyPriority.call(ctx, ...)`. They close over nothing from the dex's module scope. So
 * Function.prototype.toString() round-trips them: all 225 handlers in this format rehydrate cleanly,
 * and onModifyType agrees with node on 13 of the 13 moves that define it.
 *
 * They ship as SOURCE and are rebuilt on first use. Only handlers board.js actually calls are
 * carried; a handler nothing invokes is dead weight in a page that is already 273 KB. */
const HANDLERS = {
  species: [],
  /* onResidual carries `passTurnAccrues`: board.js asks whether the user's ability GAINS on a
   * passed turn (Speed Boost, Moody, Opportunist) by reading the handler's source. Without it the
   * browser scored that feature as always-zero while node did not, which is exactly the silent
   * divergence tests/test-board-browser.js exists to refuse. */
  abilities: ['onStart', 'onModifyPriority', 'onModifySpe', 'onChangeBoost', 'onTryBoost', 'onAfterEachBoost', 'onFoeTryMove', 'onResidual'],
  items: ['onModifySpe'],
  conditions: ['onModifySpe', 'onAnyModifyDamage', 'onAnyModifyDamagePhase1', 'onAnyModifyDamagePhase2'],
  natures: [],
  moves: ['onModifyType', 'onModifyMove', 'onTryMove', 'basePowerCallback'],
};
/* The plain fields, taken from what board.js indexes off each kind rather than from a guess. A new
 * read lands here as `undefined`, which tests/test-board-browser.js turns into a failing feature
 * comparison rather than a quieter page. */
const FIELDS = {
  species: ['name', 'id', 'exists', 'types', 'baseStats', 'baseSpecies', 'abilities', 'weighthg', 'isMega', 'requiredItem'],
  abilities: ['name', 'id', 'exists'],
  items: ['name', 'id', 'exists', 'isChoice', 'megaStone', 'megaEvolves'],
  /* `duration` carries `setupTurns` — how many turns a Tailwind, screen, terrain or weather lasts.
   * It is a plain data field on the CONDITION, not on the move, so the move fields below are not
   * enough on their own. */
  conditions: ['name', 'id', 'exists', 'duration'],
  natures: ['name', 'id', 'exists', 'plus', 'minus'],
  moves: ['name', 'id', 'exists', 'type', 'category', 'basePower', 'accuracy', 'priority', 'target',
          'flags', 'boosts', 'status', 'volatileStatus', 'sideCondition', 'slotCondition', 'weather', 'terrain',
          'pseudoWeather', 'self', 'selfSwitch', 'stallingMove', 'isNonstandard', 'multihit', 'drain', 'heal',
          'condition'],
};

const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let handlerCount = 0, entryCount = 0;
function pack(kind, list) {
  const out = {};
  for (const e of list) {
    if (!e || !e.exists) continue;
    const row = {};
    for (const f of FIELDS[kind]) if (e[f] !== undefined) row[f] = e[f];
    for (const h of HANDLERS[kind]) {
      if (typeof e[h] !== 'function') continue;
      /* Showdown writes these as object-literal shorthand — `onModifyType(move, user) {…}` — which is
       * not a valid expression alone. Normalised to `function (…) {…}` HERE, so the page never has to
       * know how the dex spells its methods. */
      const src = e[h].toString();
      row['fn$' + h] = /^\s*(function|\()/.test(src) ? src : 'function ' + src.replace(/^\s*[\w$]+/, '');
      handlerCount++;
    }
    out[e.id || norm(e.name)] = row;
    entryCount++;
  }
  return out;
}

/* CONDITIONS ARE REACHED THROUGH MOVES, never enumerated: board.js only asks for the condition a
 * move's sideCondition/status/weather names, so enumerating the table would carry hundreds nothing
 * reads. */
const condIds = new Set(['brn', 'par', 'psn', 'tox', 'slp', 'frz']);
for (const m of dex.moves.all()) {
  for (const k of ['sideCondition', 'status', 'volatileStatus', 'weather']) if (m[k]) condIds.add(norm(m[k]));
}

/* THE REDUCTION IS ONLY SAFE WHERE IT CHANGES NOTHING, AND FOR MOVES IT DID NOT.
 *
 * The full dex bundles to 1.1 MB against a page already at 273 KB, so dropping anything
 * `isNonstandard` (Past, CAP, Unobtainable) looks free: it cannot appear in a Champions battle.
 *
 * MEASURED, AND IT IS NOT FREE FOR MOVES. board.js does not only look a move UP, it DERIVES sets by
 * sweeping the whole table — `derived()` walks dex.moves.all() to build the stalling, screen and
 * speed-side sets. Filtering the table changed what it derived: STALL fell from 11 moves to 6,
 * losing burningbulwark, matblock, maxguard, obstruct and silktrap, so `tgtMayProtect` scored every
 * Pokemon carrying one of them as a target that never blocks.
 *
 * tests/test-board-browser.js caught it, which is the entire reason to have written it. MOVES now
 * ship WHOLE. Species, abilities and items are only ever asked for BY NAME — nothing sweeps them —
 * so the filter is behaviour-preserving there, and the test is what establishes that rather than an
 * argument about what "cannot appear". */
const legal = e => e && e.exists && !e.isNonstandard;
/* THE TYPE CHART, because board.js calls dex.getImmunity / dex.getEffectiveness — methods on the DEX
 * ITSELF, not on an entry. Missing them cost 7 features their value in the browser (diesBeforeMoving,
 * switchSurvives1, speedSwing, screenValue, switchKOFast, switchDiesFirst, healValue) and
 * tests/test-board-browser.js named all seven, which is the whole point of having it. */
const typeChart = {};
for (const t of dex.types.all()) typeChart[t.name] = { damageTaken: t.damageTaken };

const dexBundle = {
  types: typeChart,
  species: pack('species', dex.species.all().filter(legal)),
  abilities: pack('abilities', dex.abilities.all().filter(legal)),
  items: pack('items', dex.items.all().filter(legal)),
  natures: pack('natures', dex.natures.all()),
  moves: pack('moves', dex.moves.all()),        // WHOLE — board.js sweeps this table to derive sets
  conditions: pack('conditions', [...condIds].map(id => dex.conditions.get(id)).filter(c => c && c.exists)),
};

const body = `/* GENERATED by build/build_board_browser.js — do not hand-edit.
 * The data engine/board.js reads, reduced to the fields it actually uses, so the browser can run
 * the SAME scorer the engine runs instead of a second implementation.
 * Generated ${new Date().toISOString().slice(0, 10)}. */
(function (root) {
  root.__ABRA_BOARD_DATA = ${JSON.stringify(bundle)};

  /* THE DEX, REBUILT. Handlers ship as source and are compiled on FIRST USE, not on load: most
   * pages touch a handful of moves, and compiling 225 functions to score one turn would be paid by
   * every visitor. A row is upgraded in place the first time it is asked for.
   *
   * The shape is the small part of Showdown's Dex that board.js uses — .get() and .all() per table,
   * with .get() taking the raw name a human would type and normalising it here, so no caller ever
   * holds a half-made key. Same rule as engine/mc_key.js, for the same reason. */
  var RAW = ${JSON.stringify(dexBundle)};
  var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var MISSING = { exists: false };

  function table(rows) {
    var built = Object.create(null);
    function hydrate(id) {
      if (built[id]) return built[id];
      var src = rows[id];
      if (!src) return null;
      var out = {};
      for (var k in src) {
        if (k.indexOf('fn$') === 0) {
          /* eval, deliberately and narrowly: the source is OUR OWN generated bundle, emitted from
           * the pinned simulator by build/build_board_browser.js — not user input and not fetched.
           * A failure here must be LOUD, because a silently missing handler is a feature that reads
           * zero in the browser and correctly in node. */
          try { out[k.slice(3)] = (0, eval)('(' + src[k] + ')'); }
          catch (e) {
            throw new Error('board-data.js: could not rebuild ' + id + '.' + k.slice(3) + ' — ' + e.message);
          }
        } else { out[k] = src[k]; }
      }
      built[id] = out;
      return out;
    }
    return {
      get: function (name) {
        if (name && typeof name === 'object') return name;      // already a dex entry
        return hydrate(norm(name)) || MISSING;
      },
      all: function () {
        var list = [];
        for (var id in rows) list.push(hydrate(id));
        return list;
      },
    };
  }

  /* getImmunity / getEffectiveness are Showdown's, reproduced from its own damageTaken encoding
   * (0 normal, 1 super effective, 2 resisted, 3 immune) rather than from a second type chart. Both
   * accept a type string or a move-like {type}, and one type or a list, exactly as the dex does —
   * board.js calls them both ways. */
  function srcType(s) { return (s && s.type) ? s.type : s; }
  function asList(t) { return Array.isArray(t) ? t : [t]; }
  function getImmunity(source, target) {
    var st = srcType(source), list = asList(target);
    for (var i = 0; i < list.length; i++) {
      var td = RAW.types[list[i]];
      if (td && td.damageTaken && td.damageTaken[st] === 3) return false;
    }
    return true;
  }
  function getEffectiveness(source, target) {
    var st = srcType(source), list = asList(target), total = 0;
    for (var i = 0; i < list.length; i++) {
      var td = RAW.types[list[i]];
      if (!td || !td.damageTaken) continue;
      var d = td.damageTaken[st];
      if (d === 1) total++; else if (d === 2) total--;
    }
    return total;
  }

  root.__ABRA_DEX = {
    species: table(RAW.species), abilities: table(RAW.abilities), items: table(RAW.items),
    natures: table(RAW.natures), moves: table(RAW.moves), conditions: table(RAW.conditions),
    types: { get: function (n) { return RAW.types[n] || { exists: false }; },
             all: function () { var o = []; for (var k in RAW.types) o.push(RAW.types[k]); return o; } },
    getImmunity: getImmunity, getEffectiveness: getEffectiveness,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;

fs.writeFileSync(D('data', 'board-data.js'), body);

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('BOARD BROWSER DATA\n');
console.log(`  species with priors   ${Object.keys(species).length}`);
console.log(`    spread rows kept    ${spreadRows}`);
console.log(`    ability rows kept   ${abilRows}`);
console.log(`    Focus Sash shares   ${sashRows}`);
console.log(`\n  dex entries carried   ${entryCount}   (${handlerCount} handlers, shipped as source)`);
for (const k of Object.keys(dexBundle)) {
  console.log(`    ${k.padEnd(12)} ${String(Object.keys(dexBundle[k]).length).padStart(5)}  ${kb(JSON.stringify(dexBundle[k]).length)}`);
}
console.log(`\n  smogon-priors.json    ${kb(fs.statSync(D('data', 'smogon-priors.json')).size)}  ->  reduced`);
console.log(`  bundle written        ${kb(Buffer.byteLength(body))}   data/board-data.js`);
