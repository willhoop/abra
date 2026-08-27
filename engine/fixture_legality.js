/* fixture_legality.js — every SET declared by a fixture in this repo, put to Showdown's own
 * TeamValidator.
 *
 *   node engine/fixture_legality.js            the whole population, with the authority's verdicts
 *   node engine/fixture_legality.js --json     the same as an artifact
 *
 * The gate that ratchets this is tests/test-fixture-legality.js.
 *
 * WHY THIS EXISTS
 * ---------------
 * CLAUDE.md's cardinal rule is that no Pokemon, item, ability or move outside the regulation may be
 * NAMED — "every example, every illustration and every derived result", because an illegal entity is
 * indistinguishable from a claim about the game we actually play. It was being broken inside the
 * tests, where it is worse than in prose: a fixture built on a set that cannot exist is measuring a
 * game we do not play, and every number it produces inherits that. It is the same class as the
 * blank-spread rig that tested turn order in the one configuration where turn order cannot be got
 * wrong — a PASS that proves nothing.
 *
 * BOTH KNOWN INSTANCES WERE FOUND IN PASSING RATHER THAN BY A CHECK, which is the whole argument for
 * this file. `engine/feature_fixture.js` gave Venusaur a ROCKY HELMET, banned in this format since
 * 2026-08-04, and it was noticed by an agent doing something else. Seven illegal learnset pairs were
 * ratcheted in data/fixture-learnset-baseline.json after an agent sent to repair ONE faint happened
 * to run the validator on a fixture.
 *
 * THE VERDICT IS THE AUTHORITY'S, AND IT IS ASKED ABOUT THE WHOLE SET
 * -------------------------------------------------------------------
 * Will, 2026-08-13: *"i thought we were using showdowns team validator as the ultimate legality
 * test."* The first plan for this sweep was to check the species with `isNonstandard`, then the
 * ability against the species' list, then the item, then each move with `checkCanLearn`. That is a
 * RE-IMPLEMENTATION of the validator — four hand-written rules standing in for a table that Showdown
 * maintains — and it is the FACTS ARE GLOBAL rule broken in the file written to enforce a rule.
 *
 * A piecemeal check only ever finds the rules somebody thought to write. `validateTeam` enforces the
 * whole format: the 66-point SP budget, the 32-per-stat cap, the level, the item clause, every ban
 * the Champions mod adds and every one it will add next. On the day this was written it caught a
 * spread putting 34 points into one stat — *"Weavile has more than 32 Stat Points in Special
 * Defense"* — in code whose author was not checking spreads at all.
 *
 * So this file contains NO legality rule of its own. It calls `champions_sim.checkLegal`, which is
 * one shared `TeamValidator` instance, validating the subject inside five filler slots that are
 * themselves proved clean, and it prints the validator's exact sentences rather than a summary of
 * them. `checkLegal` also already draws the distinction that matters here: EXISTENCE ("does not exist
 * in Gen 9") is always wrong, PAIRING ("can't learn", "can't have") is something an isolation probe
 * does on purpose and may declare.
 *
 * WHAT A "FIXTURE SOURCE" IS, DERIVED RATHER THAN LISTED
 * ------------------------------------------------------
 * A hand-listed set of files is the thing this repository has been wrong about most often — the ban
 * list of four, the fourteen handoffs, the `need` lists. So the sweep walks every .js in the tree and
 * finds set declarations by shape. Four rules, every one of them put in after it caught the scanner
 * being wrong on a real file:
 *
 *   1. A LITERAL IS AN ENTITY ONLY IF IT NAMES ITSELF. `dex.species.get('p2')` answers Porygon2, and
 *      'p2' in this tree is a SIDE. A literal counts only when it normalises to that entity's own id,
 *      which is derived from the format and needs no exclusion list.
 *   2. MOVES COME FROM ARRAY LITERALS ONLY. tests/test-mechanics.js calls `hit('vaporeon','icebeam')`
 *      where the move is clicked BY SOMEBODY ELSE at that body. Attributing a loose move literal to
 *      the nearest species produced three false accusations before this rule existed.
 *   3. HELPERS ARE TAKEN AT TOP LEVEL ONLY. test-mechanics.js is 22,000 lines and redeclares `run`,
 *      `hit` and `at` inside dozens of probe callbacks. A file-global name set made every one of them
 *      a candidate set-builder and paired an ability stamped on the ATTACKER with the DEFENDER's name.
 *      Scope is not recoverable from a regex, so the sweep takes the one scope a regex can see.
 *   4. A SET IS DECLARED TWO WAYS: an object literal keyed species+moves, or a body built by MUTATION
 *      (`b.moves = ...; b.ability = ...; b.item = ...`), which is what tests/test-protocol-trace.js
 *      does. Only the first has a `species` key to match on, and requiring one hid 64 real sets.
 *
 * WHAT IT CANNOT SEE, SAID RATHER THAN IMPLIED. A fixture that builds its bodies from the format
 * (tests/roster.js walks the regulation; engine/all_mechanics_fire.js reads the tag dex) declares no
 * literal and is not in this population — correctly, since it cannot type a name that does not exist.
 * A fixture that builds a body through `buildMon(key)` and assigns the click LATER — which is most of
 * tests/test-mechanics.js — has no set to validate at the point the body is made, and this sweep says
 * so instead of guessing. Those are counted and printed as NOT STATICALLY PAIRED.
 *
 * POSITION IS NOT A RULE. THE ROW MATCHER ASKS THE FORMAT WHAT EACH LITERAL IS — ARMED 2026-08-27
 * -----------------------------------------------------------------------------------------------
 * Until 2026-08-27 this file matched a positional row with a REGEX that demanded species first and
 * the moves array second: `['species', ['move', ...], 'ability', 'item']`. That is a LIST OF
 * KNOWN-GOOD SHAPES, and a gate built as a list of shapes catches those shapes and not the class.
 * It was added on 2026-08-14 after one ordering hid five illegal sets including a banned item; a
 * SECOND ordering was then measured on 2026-08-26 and it was larger than the first —
 * `['species', 'item', 'ability', ['move', ...]]`, moves LAST, written by `stage(rows)` in thirteen
 * files, hiding **413 rows / 157 distinct sets, 124 of them invisible, 21 of those REJECTED**. Adding
 * a fourth regex would have bought the third ordering and lost the fourth.
 *
 * So the row matcher no longer reads POSITION at all. A bracketed group is split into the literals at
 * its OWN level and the literals inside a NESTED array, and every one of them is handed to `roleOf`,
 * which asks the format — `dex.species.get(s).id === nrm(s)` and the same for abilities, items and
 * moves. A group declares a SET when exactly one own-level literal names a SPECIES and the group
 * carries at least one further component (an item, an ability, or a nested array). Any ordering of
 * those four elements matches, including orderings nobody has written yet.
 *
 * MEASURED WHEN IT WAS ARMED, so the change is attributable: the two candidate readings of the nested
 * array — every literal in it is a move (rule 2 as matcher (A) applies it) versus only the literals
 * that self-name a move — produce IDENTICAL populations, verdicts and strays (448 groups, 177 distinct
 * sets, 139 novel, 21 rejected, 16 verdicts, **0** strays). The first is used, because rule 2 must have
 * one implementation and because a mistyped move name inside the array must still reach the validator
 * rather than being quietly dropped.
 *
 * MATCHED:  (A) a top-level helper CALL whose arguments carry a self-naming species literal, moves
 *               taken from array literals only;
 *           (B) an object literal keyed `species:` and `moves:`;
 *           (C) a bracketed ROW in ANY order — one own-level species plus at least one of item,
 *               ability, nested moves array. Roles are asked of the format, never of the slot index;
 *           (D) a body built by MUTATION (`b.moves = ...; b.ability = ...; b.item = ...`).
 *
 * WHAT STILL WALKS PAST IT, SAID RATHER THAN IMPLIED. Dated evidence, 2026-08-27 — re-run the
 * measurement rather than quoting these figures.
 *   1. A BARE SPECIES LIST, with no item, ability or moves anywhere in the group. It is not skipped
 *      out of caution; it was measured and it CANNOT be told apart from a codename list, because THIS
 *      REPOSITORY NAMES ITS OWN MODELS, CLI FLAGS AND PLAYSTYLE ROLES AFTER POKEMON. Dropping the
 *      component requirement matches 907 groups instead of 448 and accuses `['miltank', 'miltank2',
 *      'no-raw', ...]` in `engine/mew_farm.js` (a `BOOL_FLAGS` list) and `inputs: ['magnemite']` in
 *      `build/build_status.js` of naming species that do not exist in Gen 9. Both accusations are
 *      false and neither is distinguishable from a real one by shape.
 *      **THE REAL ONES IT ALSO FINDS ARE FILED RATHER THAN GATED**: `tests/bench-medicham.js:44`
 *      pins a six-body ROSTER containing `amoonguss`, and `tests/test-choice-lock.js:56` benches
 *      `['rillaboom', 'amoonguss']` — all three of those literals are `isNonstandard: 'Past'`.
 *      ROADMAP #266.
 *   2. A ROW WITH TWO SPECIES AND NO ARRAY — `engine/validate_damage.js`'s golden master,
 *      `[att, ability, item, nature, stat, move, def, nature, {spread}, weather, defAb?, defItem?]`.
 *      With two species in one group nothing can be attributed to either, and the ITEM is the half
 *      that matters: this is the file where Choice Band, Choice Specs and an Amoonguss were found by
 *      a HUMAN on 2026-08-25 rather than by this gate. Audited by hand 2026-08-26: 36 rows, 0
 *      problems. Clean today, still unseen.
 *   3. A MEGA FORME DECLARED AS A SET. `champions_sim.checkLegal` cannot validate one — measured
 *      2026-08-27, **0 of the 76 legal mega formes pass**: 70 return *"…transforms in-battle with
 *      <stone>, please fix its item"*, which is the AUTHORITY being right (a mega is declared as its
 *      base plus the stone, never as the forme), and 6 return *"You are limited to one of each Pokémon
 *      by Species Clause"*, which is `fillerSets` padding a Charizard-Mega-Y with a Charizard because
 *      it skips the subject by `id` and not by `baseSpecies`. No fixture in this population declares
 *      one today, so no guard is written for a case that does not occur — but the moment one does,
 *      every verdict it produces will be the instrument. Filed, not coded.
 *   4. A LITERAL THAT MERELY NORMALISES TO AN ENTITY ID. Rule 1 says a literal counts only when it
 *      "names itself", and `nrm()` strips punctuation from BOTH sides — so `'medicham='`, a fragment
 *      of a FAIL message, names itself. That is a FALSE POSITIVE rather than a blind spot, and until
 *      2026-08-26 it manufactured three phantom sets and five phantom stray literals. The proximate
 *      cause (a helper window that ran past the end of the helper) is fixed below; the looseness in
 *      rule 1 is not, and it will produce the same shape again the moment a real set-builder is called
 *      with a debug string.
 *
 * TYPED OR DERIVED — TWO KINDS OF ILLEGAL NAME, AND ONLY ONE OF THEM IS FIXED BY EDITING THE VALUE
 * ------------------------------------------------------------------------------------------------
 * Will, 2026-08-27: *"some of the games in the store sneak in forbidden pokemon cause they played a
 * game using custom rules and its still tagged reg mb"*. In a file the two look identical, and the
 * repair is opposite:
 *
 *   TYPED    a human wrote the name into source. Replacing it repairs it for good.
 *   DERIVED  the name arrived at run time from the store or from an artifact built on the store.
 *            **Editing the value fixes nothing** — the next regeneration puts it back. It needs a
 *            filter at the point of DERIVATION, and a filter applied after the name is already in the
 *            artifact is in the wrong place.
 *
 * THIS SWEEP'S ENTIRE POPULATION IS TYPED, AND THAT IS TRUE BY CONSTRUCTION RATHER THAN BY LUCK.
 * Every matcher here keys on a STRING LITERAL in the source; a derived value has no literal, so it
 * cannot enter this population at all. So `findings` and `pairs` are stamped `origin: 'TYPED'` and the
 * repair line says "replace it". The DERIVED half is the construction sites this sweep already counts
 * and declines to guess about — `notStaticallyPaired`, whose reasons literally read "the body is
 * DERIVED" — and `derivedScan()` below, which asks the separate question those sites inherit: does a
 * data/ artifact carry a species this regulation does not contain?
 *
 * MEASURED 2026-08-27, so the DERIVED half is not hypothetical: 76 of 88,179 stored games (0.09%)
 * name at least one species outside this regulation, 71 distinct, and `data/quality-filter.json`
 * carries no legality rule — so every one of them is CLEAN by the project's own definition and reaches
 * data/meta-usage.json (11 distinct), data/bring-priors.json (69) and data/sheet-usage.json (19).
 *
 * AND THE DERIVED PREDICATE IS ABOUT CARRIERS, NOT ABOUT `isNonstandard`. Artifacts collapse to BASE
 * forms. Floette-Mega and Floette-Eternal are LEGAL and their base, Floette, is `Past`/`Illegal`, so a
 * naive check accuses `floette` and a naive filter would delete the largest usage row in the table.
 * A name is outside the regulation only when NO legal forme collapses onto it. `derivedScan()` asks it
 * that way and Floette is its live negative control.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CS = require('./champions_sim.js');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'docs', 'dist', 'coverage']);

/* ROADMAP #258 — A DIRECTORY THIS SCAN COULD NOT OPEN IS NOT A DIRECTORY WITH NOTHING IN IT.
 * `return out` on a read failure makes a legality scan pass by looking at less, which is the exact
 * shape of the defect the scan exists to catch. The walk still continues (one unreadable directory
 * must not kill the run), and the skipped directories are recorded so the caller can refuse. */
const UNWALKED = [];
function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) {
    const msg = String((e && e.message) || e).split(String.fromCharCode(10))[0];
    UNWALKED.push({ dir, error: msg });
    console.error('  UNWALKED — ' + dir + ' could not be listed (' + msg + '); this scan covers LESS '
                + 'than it appears to');
    return out;
  }
  for (const e of ents) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* ---- source handling ------------------------------------------------------------------------- */
/* Comments are blanked before anything is matched, or a species named in prose — and this repo's
 * comments name a great many — becomes a fixture. Newlines are preserved so line numbers survive. */
function stripComments(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2); const to = e < 0 ? src.length : e + 2;
      out += src.slice(i, to).replace(/[^\n]/g, ' '); i = to; continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i); const to = e < 0 ? src.length : e;
      out += src.slice(i, to).replace(/[^\n]/g, ' '); i = to; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

function balanced(src, i, open, close) {
  let d = 0;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; k++;
      while (k < src.length && src[k] !== q) { if (src[k] === '\\') k++; k++; }
      continue;
    }
    if (c === open) d++;
    else if (c === close) { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  return null;
}
const lineOf = (src, i) => src.slice(0, i).split('\n').length;

/* SPLIT A BRACKETED GROUP BY DEPTH, WHICH IS THE ONE STRUCTURAL FACT THAT IS NOT A POSITION.
 * `own` are the string literals at the group's own level; `nested` are the ones inside an array
 * WITHIN it, which is rule 2's "moves come from array literals only" applied to a row instead of to
 * a call. A nested object or a nested call contributes NEITHER — `{spread}` in a damage row holds
 * stat keys, and a callback holds whatever it holds. Depth is read, order never is. */
function partition(body) {
  const own = [], nested = [];
  let k = 1; const end = body.length - 1;
  while (k < end) {
    const c = body[k];
    if (c === '[') { const a = balanced(body, k, '[', ']'); if (a) { for (const s of (a.match(STR) || [])) nested.push(s.slice(1, -1)); k += a.length; continue; } }
    if (c === '{') { const a = balanced(body, k, '{', '}'); if (a) { k += a.length; continue; } }
    if (c === '(') { const a = balanced(body, k, '(', ')'); if (a) { k += a.length; continue; } }
    if (c === '`') { const a = balanced(body, k, '`', '`'); if (a) { k += a.length; continue; } }
    if (c === '"' || c === "'") {
      const q = c; let j = k + 1;
      while (j < end && body[j] !== q) { if (body[j] === '\\') j++; j++; }
      own.push(body.slice(k + 1, j)); k = j + 1; continue;
    }
    k++;
  }
  return { own, nested };
}

/* THE WINDOW A HELPER IS JUDGED ON IS ITS OWN DECLARATION, NOT THE 500 CHARACTERS AFTER IT.
 *
 * ROADMAP #266, 2026-08-26. It was a flat `src.slice(at, at + 500)`, so the window ran off the end of
 * the declaration and into whatever came next. Both files that pair
 *
 *     const ok    = (cond, label, extra) => { ... };
 *     const stage = rows => rows.map(r => ({ species: r[0], ..., moves: r[3] }));
 *
 * therefore had `ok` registered as a SET-BUILDER on `stage`'s evidence — and every `ok(...)`
 * assertion in the file was then scanned as a set declaration. That is how `'medicham='`, a fragment
 * of a FAIL message, was read as the species Medicham and three prose fragments beside it were
 * reported as string literals naming nothing in this format. Five of the check's failures were the
 * check.
 *
 * The window now stops at the next top-level declaration (column 0 only — rule 3's argument, that a
 * regex can see exactly one scope, is unchanged). A helper's own evidence cannot lie past that point,
 * because that point is where the helper ends. It only ever SHRINKS the window, so nothing that was
 * genuinely matching can start matching more; measured repo-wide it removes 3 declarations and 0
 * distinct sets, verdicts and pairs unmoved. */
const NEXT_TOP_DECL = /^(?:const|let|var|function|class|async|export|module\b)/gm;
function declBody(src, at) {
  NEXT_TOP_DECL.lastIndex = at + 1;
  const n = NEXT_TOP_DECL.exec(src);
  return src.slice(at, Math.min(at + 500, n ? n.index : src.length));
}
const STR = /(['"])((?:[^'"\\]|\\.)*)\1/g;
const strings = s => (s.match(STR) || []).map(x => x.slice(1, -1));

/* ---- what IS this literal? asked of the format ------------------------------------------------ */
const nrm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function makeRoleOf(dex) {
  const isA = (row, s) => row && row.exists && row.id === nrm(s);
  return function roleOf(s) {
    if (s === '') return 'blank';
    if (isA(dex.species.get(s), s)) return 'species';
    if (isA(dex.abilities.get(s), s)) return 'ability';
    if (isA(dex.items.get(s), s)) return 'item';
    if (isA(dex.moves.get(s), s)) return 'move';
    return 'unknown';
  };
}

/* ---- the scan ---------------------------------------------------------------------------------- */
function scan(dex) {
  const roleOf = makeRoleOf(dex);
  const files = walk(ROOT, []);
  const sets = [], unpaired = [];
  /* A FIXTURE FILE THAT WOULD NOT READ USED TO BE SKIPPED IN SILENCE, AND SILENCE HERE READS AS
     CLEAN — the scan says nothing illegal is declared in a file it never opened. Named. */
  const unread = [];

  for (const f of files) {
    let raw;
    try { raw = fs.readFileSync(f, 'utf8'); }
    catch (e) {
      unread.push(path.relative(ROOT, f).split(path.sep).join('/')
        + ' (' + String((e && e.message) || e).split('\n')[0] + ')');
      continue;
    }
    const src = stripComments(raw);
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (rel === 'engine/fixture_legality.js') continue;   /* the scanner's own prose and regexes */

    /* (A) top-level helpers that declare a set. Two passes so FILL/BENCH, which only call mon/st,
     *     are picked up after the helper they wrap. */
    const helpers = new Set();
    for (let pass = 0; pass < 3; pass++) {
      const re = /^const\s+([A-Za-z_$][\w$]*)\s*=\s*/gm; let m;
      while ((m = re.exec(src))) {
        const name = m[1];
        if (helpers.has(name)) continue;
        const body = declBody(src, m.index);
        if (!/=>|function/.test(body.slice(0, 80))) continue;
        const byLiteral = /\bspecies\s*[:,}]/.test(body) && /\bmoves\s*[:,}]/.test(body);
        const byMutation = /\.moves\s*=/.test(body) && /\.ability\s*=/.test(body) && /\.item\s*=/.test(body);
        const wrapsOne = [...helpers].some(h => new RegExp('\\b' + h.replace(/\$/g, '\\$') + '\\s*\\(').test(body));
        if (byLiteral || byMutation || wrapsOne) helpers.add(name);
      }
    }

    for (const h of helpers) {
      const re = new RegExp('\\b' + h.replace(/\$/g, '\\$') + '\\s*\\(', 'g'); let m;
      while ((m = re.exec(src))) {
        if (/=\s*$/.test(src.slice(Math.max(0, m.index - 3), m.index))) continue;  /* the definition */
        const call = balanced(src, m.index + m[0].length - 1, '(', ')');
        if (!call) continue;
        const args = call.slice(1, -1);
        if (/\bconst\b|=>/.test(args)) continue;
        /* which string literals sit inside an array — those, and only those, are MOVES */
        const inArr = new Set();
        { let k = 0; while (k < args.length) {
            if (args[k] === '[') { const a = balanced(args, k, '[', ']'); if (a) { for (const s of (a.match(STR) || [])) inArr.add(s); k += a.length; continue; } }
            k++; } }
        const scal = [], mv = [];
        STR.lastIndex = 0; let t;
        while ((t = STR.exec(args))) (inArr.has(t[0]) ? mv : scal).push(t[2]);
        const line = lineOf(src, m.index);
        if (!scal.length && !mv.length) {
          unpaired.push({ file: rel, line, how: h + '()', why: 'no string literal — the body is DERIVED' });
          continue;
        }
        const roles = scal.map(s => ({ s, r: roleOf(s) }));
        const species = roles.filter(x => x.r === 'species').map(x => x.s);
        if (!species.length) {
          unpaired.push({ file: rel, line, how: h + '()', why: 'no species literal in the call' });
          continue;
        }
        const item = (roles.find(x => x.r === 'item') || {}).s || '';
        const ability = (roles.find(x => x.r === 'ability') || {}).s || '';
        const unknown = roles.filter(x => x.r === 'unknown').map(x => x.s);
        /* more than one species in one call is a FILL/BENCH list: the item and ability, if any,
         * cannot be attributed to one of them, so they are not. */
        for (const sp of species) {
          sets.push({ file: rel, line, how: h + '()', species: sp,
                      item: species.length > 1 ? '' : item,
                      ability: species.length > 1 ? '' : ability,
                      moves: mv.slice(), unknown });
        }
      }
    }

    /* (C) A BRACKETED ROW IN ANY ORDER. THE SLOT INDEX IS NEVER CONSULTED.
     *
     * This replaced a regex on 2026-08-27. The regex demanded species-first / moves-array-second and
     * therefore caught ONE ordering; a second ordering was measured hiding 124 sets and 21 illegal
     * ones, which is the argument in the header: a gate written as a list of known-good shapes
     * catches those shapes, not the class.
     *
     * EVERY array literal in the file is a candidate group. It declares a SET when
     *   - exactly ONE of its own-level literals names a SPECIES (rule 1 — it must name itself), and
     *   - the group carries at least one FURTHER component: an item, an ability, or a nested array.
     * The component requirement is not caution, it is the measured line between a fixture row and a
     * list of this project's own model names — see blind spot 1 in the header, where dropping it
     * doubles the population and accuses a `BOOL_FLAGS` array of naming a species.
     *
     * `exactly one` species, because a group naming two bodies cannot attribute an item or an ability
     * to either — the same reason matcher (A) blanks them on a FILL/BENCH call. A nested array of
     * rows has no own-level literal at all and is therefore not a group; its ROWS are. */
    {
      let k = 0;
      while (k < src.length) {
        if (src[k] !== '[') { k++; continue; }
        const body = balanced(src, k, '[', ']');
        if (!body) { k++; continue; }
        const { own, nested } = partition(body);
        const roles = own.map(s => ({ s, r: roleOf(s) }));
        const species = roles.filter(x => x.r === 'species').map(x => x.s);
        if (species.length === 1) {
          const item = (roles.find(x => x.r === 'item') || {}).s || '';
          const ability = (roles.find(x => x.r === 'ability') || {}).s || '';
          if (item || ability || nested.length) {
            sets.push({ file: rel, line: lineOf(src, k), how: 'row', species: species[0],
                        item, ability, moves: nested.slice(),
                        unknown: roles.filter(x => x.r === 'unknown').map(x => x.s) });
          }
        }
        k++;                              /* still descend — a row may itself hold a row */
      }
    }

    /* (B) bare object literals holding species: and moves: */
    const re3 = /\bspecies\s*:/g; let m3;
    while ((m3 = re3.exec(src))) {
      let i = m3.index, d = 0;
      for (; i >= 0; i--) { if (src[i] === '}') d++; else if (src[i] === '{') { if (d === 0) break; d--; } }
      if (i < 0) continue;
      const blk = balanced(src, i, '{', '}');
      if (!blk || !/\bmoves\s*:/.test(blk) || blk.length > 1500) continue;
      const line = lineOf(src, m3.index);
      const sp = /\bspecies\s*:\s*(['"])([^'"]*)\1/.exec(blk);
      if (!sp) { unpaired.push({ file: rel, line, how: 'object', why: 'species is not a literal — DERIVED' }); continue; }
      if (roleOf(sp[2]) !== 'species') { unpaired.push({ file: rel, line, how: 'object', why: `species literal "${sp[2]}" does not name a species in this format` }); continue; }
      const it = /\bitem\s*:\s*(['"])([^'"]*)\1/.exec(blk);
      const ab = /\bability\s*:\s*(['"])([^'"]*)\1/.exec(blk);
      const mb = /\bmoves\s*:\s*\[/.exec(blk);
      let mvs = [];
      if (mb) { const a = balanced(blk, mb.index + mb[0].length - 1, '[', ']'); if (a) mvs = strings(a); }
      sets.push({ file: rel, line, how: 'object', species: sp[2],
                  item: it ? it[2] : '', ability: ab ? ab[2] : '', moves: mvs, unknown: [] });
    }
  }
  return { files: files.length, sets, unpaired, unread };
}

/* ---- the sweep --------------------------------------------------------------------------------- */
/* A finding is keyed by the AUTHORITY'S OWN SENTENCE, lowercased. That is deliberate and matches the
 * key already chosen for data/fixture-learnset-baseline.json: the same illegal declaration moved to a
 * new scenario is the SAME defect, and a ratchet keyed on file and line would let somebody relocate
 * `Snorlax can't learn Swords Dance` (11 sites today) and call it new. What must be new is a NEW
 * SENTENCE from the validator. */
const keyOf = p => String(p).toLowerCase().replace(/\s+/g, ' ').trim();

function sweep() {
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  const { files, sets, unpaired, unread } = scan(dex);
  if (unread && unread.length) {
    console.error('  fixture_legality: ' + unread.length + ' FIXTURE FILE(S) COULD NOT BE READ and were '
      + 'NOT scanned, so nothing below says they are legal: ' + unread.join('; '));
  }

  /* one verdict per distinct set; every site that declares it is carried */
  const seen = new Map();
  for (const s of sets) {
    const k = [nrm(s.species), nrm(s.item), nrm(s.ability), s.moves.map(nrm).sort().join('+')].join('|');
    if (!seen.has(k)) seen.set(k, { ...s, sites: [] });
    seen.get(k).sites.push(s.file + ':' + s.line);
  }
  const distinct = [...seen.values()];

  const findings = new Map();
  let rejected = 0;
  for (const s of distinct) {
    const v = CS.checkLegal({ species: s.species, item: s.item, ability: s.ability, moves: s.moves });
    if (v.unavailable) throw new Error('fixture_legality: ' + v.problems.join('; '));
    if (v.legal) continue;
    rejected++;
    for (const p of v.problems) {
      const k = keyOf(p);
      if (!findings.has(k)) findings.set(k, { key: k, problem: p, kind: (v.banned || []).includes(p) ? 'EXISTENCE' : 'PAIRING', sets: [], sites: new Set() });
      const f = findings.get(k);
      f.sets.push(`${s.species} @ ${s.item || '(no item)'} / ${s.ability || '(species default)'} / [${s.moves.join(', ')}]`);
      for (const site of s.sites) f.sites.add(site);
    }
  }
  /* ORIGIN IS STAMPED, NOT INFERRED BY THE READER. Every matcher above keys on a string literal in
   * the source, so anything that reaches this point was written by a human and is repaired by editing
   * it. Saying so on the row is the whole point: a report that does not distinguish the two sends
   * somebody to edit a value that a regeneration will put straight back. */
  for (const f of findings.values()) { f.origin = 'TYPED'; f.repair = 'a string literal in source — replace it'; }
  const out = [...findings.values()].map(f => ({ ...f, sites: [...f.sites].sort() }))
    .sort((a, b) => (a.kind === b.kind ? a.key.localeCompare(b.key) : (a.kind === 'EXISTENCE' ? -1 : 1)));

  /* ---- THE PAIR PASS, BECAUSE THE VALIDATOR STOPS AT THE FIRST PROBLEM PER SET ------------------
   *
   * MEASURED 2026-08-14, and it had been under-reading since this file was written. `validateTeam`
   * returns ONE complaint per Pokemon: a Snorlax declared with Swords Dance, Iron Defense, U-turn and
   * Roar — FOUR moves it cannot learn — produces the single sentence "Snorlax can't learn Swords
   * Dance." Keying the ratchet on the sentence is still right (see `keyOf`), but COUNTING sentences
   * understates the defect, and worse: repairing the first illegal move in a set makes the second one
   * appear as a NEW verdict, which reads as a regression caused by the repair.
   *
   * So every declared move is also asked of `champions_sim.canLearn`, which is the validator's own
   * `checkCanLearn` — not a hand-walked learnset. The verdict sentences are unchanged and remain the
   * ratchet; `pairs` is the honest population count beside them. On the day it was added the sweep
   * reported 32 verdicts and 34 pairs.
   *
   * AND EVERY PAIR CARRIES ITS CLASS, which is what decides the SEVERITY and the repair:
   *   UNREACHABLE  nothing in this regulation can carry the entity. A fixture asserting it is testing
   *                a game nobody plays, and — the expensive part — a probe that fails on it reads as
   *                an ENGINE DEFECT when the engine is correct not to model it. Four phantom defects
   *                were filed from this shape in one session on 2026-08-14.
   *   PAIRING      the entity exists and has carriers; THIS body is not one of them. Re-aimable onto
   *                a legal carrier, which is what the repairs in ROADMAP #266 do. */
  const pairs = [];
  {
    const seenPair = new Map();
    for (const s of distinct) {
      const sp = dex.species.get(s.species);
      if (!sp.exists) continue;
      const push = (kind, entity, problem, carriers) => {
        const k = keyOf(problem);
        if (!seenPair.has(k)) {
          seenPair.set(k, { key: k, problem, kind, entity, carriers,
                            cls: carriers === 0 ? 'UNREACHABLE' : 'PAIRING', sites: new Set() });
          pairs.push(seenPair.get(k));
        }
        for (const site of s.sites) seenPair.get(k).sites.add(site);
      };
      for (const m of s.moves) {
        const mv = dex.moves.get(m);
        if (!mv.exists) continue;                       /* a stray literal — reported separately */
        if (CS.canLearn(sp.name, mv.name)) continue;
        push('move', mv.name, `${sp.name} can't learn ${mv.name}.`, CS.moveCarriers(mv.name).length);
      }
      if (s.ability) {
        const ab = dex.abilities.get(s.ability);
        const owns = Object.values(sp.abilities || {}).some(a => nrm(a) === nrm(s.ability));
        if (ab.exists && !owns) {
          push('ability', ab.name, `${sp.name} can't have ${ab.name}.`, CS.abilityCarriers(ab.name).length);
        }
      }
    }
    for (const p of pairs) { p.sites = [...p.sites].sort(); p.origin = 'TYPED'; }
    pairs.sort((a, b) => (a.cls === b.cls ? a.key.localeCompare(b.key) : (a.cls === 'UNREACHABLE' ? -1 : 1)));
  }

  const byFile = {};
  for (const s of sets) byFile[s.file] = (byFile[s.file] || 0) + 1;

  /* A LITERAL THAT NAMES NOTHING, WHICH THE VALIDATOR CANNOT REPORT AND WHICH IS ITS OWN DEFECT.
   * tests/test-protocol-trace.js:131 gives Politoed the item `'dampro'`. There is no such item, so
   * `checkLegal` is handed no item at all and answers about a Politoed holding nothing — the set is
   * legal and the fixture is still wrong, silently, in exactly the shape CLAUDE.md calls "a capability
   * was absent and everything reported success". Reported separately because it is a different fault
   * from an illegal set: nobody is accused of an illegal pairing, the string simply means nothing. */
  const strays = new Map();
  for (const s of sets) {
    for (const u of (s.unknown || [])) {
      const k = nrm(u);
      if (!strays.has(k)) strays.set(k, { literal: u, sites: new Set() });
      strays.get(k).sites.add(s.file + ':' + s.line);
    }
  }
  const unknownLiterals = [...strays.values()].map(x => ({ literal: x.literal, sites: [...x.sites].sort() }));

  return {
    unknownLiterals,
    format: CS.FORMAT,
    filesScanned: files,
    declarations: sets.length,
    distinctSets: distinct.length,
    rejectedSets: rejected,
    origin: 'TYPED',
    originWhy: 'every matcher in this sweep keys on a STRING LITERAL in source, so a DERIVED value '
      + 'cannot enter this population. Findings here are repaired by editing the literal. For the '
      + 'DERIVED half see notStaticallyPaired and derivedScan().',
    findings: out,
    pairs,
    unreachable: pairs.filter(p => p.cls === 'UNREACHABLE'),
    byFile,
    notStaticallyPaired: unpaired.length,
    notStaticallyPairedDerived: unpaired.filter(u => /DERIVED/.test(u.why || '')).length,
  };
}

/* ---- THE DERIVED HALF -------------------------------------------------------------------------
 *
 * A separate question from the sweep above, asked of the artifacts rather than of the source: does a
 * generated file carry a species this regulation does not contain? If it does, no edit to that file
 * is a repair — the generator will write it back — so this reports the ARTIFACT and leaves the value
 * alone, which is the opposite instruction from the one the TYPED findings carry.
 *
 * THE PREDICATE IS CARRIER-AWARE AND HAS A LIVE NEGATIVE CONTROL. Artifacts collapse formes to base
 * names, and a legal forme can have an illegal base: Floette-Eternal and Floette-Mega are legal, and
 * `floette` is `Past`/`Illegal`. Asking `isNonstandard` alone accuses it. So a name is outside the
 * regulation only when NO legal forme in the format collapses onto it, and `floette` must NOT appear
 * in this report — if it ever does, the predicate has regressed, not the artifact.
 *
 * NOT called by sweep() and not read by the gate. It walks data/ and costs seconds; the gate is a
 * ratchet on the TYPED population and adding an unratcheted second population to it would be a new
 * failure surface with no baseline. Printed for a human, on request. */
function derivedScan(opts) {
  const o = opts || {};
  const dex = CS.sim().Dex.forFormat(CS.FORMAT);
  /* THE FIRST VERSION OF THIS PREDICATE ACCUSED FOUR LEGAL BODIES AND WAS CAUGHT BY ITS OWN CONTROL
   * PASS, 2026-08-27. It asked whether the name was in a set built by walking `dex.species.all()`.
   * COSMETIC FORMES ARE NOT IN THAT WALK — they hang off the base as `cosmeticFormes` — so
   * `florgeswhite`, `florgesblue`, `alcremiesaltedcream` and `furfroudandy`, every one of them
   * `isNonstandard: null`, `tier: 'UU'`, were reported as outside the regulation in seven artifacts.
   * Asking the ROW ITSELF answers all four, because `dex.species.get` resolves a cosmetic forme to a
   * row that carries its own legality. Same class as CLAUDE.md's `.all()` warning, in the other
   * direction: the filtered walk is right for enumerating and wrong for deciding one name. */
  const legalBase = new Set();
  for (const S of dex.species.all()) {                   /* .all() is the NATIONAL dex — filtered */
    if (!S.exists || S.isNonstandard || S.tier === 'Illegal') continue;
    legalBase.add(nrm(S.baseSpecies || S.name));
  }
  const outside = (s) => {
    const S = dex.species.get(s);
    if (!S || !S.exists || S.id !== nrm(s)) return false;   /* rule 1: it must name itself */
    if (!S.isNonstandard && S.tier !== 'Illegal') return false;          /* legal in its own right */
    return !legalBase.has(S.id);   /* …or a legal forme collapses onto this base name (Floette) */
  };
  const dir = path.join(ROOT, 'data');
  const cap = o.maxBytes || 60e6;
  const rows = [], skipped = [];
  let files = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(dir, f);
    let st, j;
    try { st = fs.statSync(p); } catch (e) { skipped.push(f + ' (unstattable)'); continue; }
    if (st.size > cap) { skipped.push(f + ' (' + (st.size / 1e6).toFixed(0) + ' MB, over the cap — NOT scanned)'); continue; }
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { skipped.push(f + ' (unparseable)'); continue; }
    files++;
    const hits = new Map();
    const walk = (v) => {
      if (v === null || v === undefined) return;
      if (typeof v === 'string') { if (outside(v)) hits.set(nrm(v), (hits.get(nrm(v)) || 0) + 1); return; }
      if (Array.isArray(v)) { for (const x of v) walk(x); return; }
      if (typeof v === 'object') {
        for (const k of Object.keys(v)) { if (outside(k)) hits.set(nrm(k), (hits.get(nrm(k)) || 0) + 1); walk(v[k]); }
      }
    };
    walk(j);
    if (hits.size) {
      rows.push({ artifact: 'data/' + f, mtime: st.mtime.toISOString().slice(0, 16),
                  distinct: hits.size,
                  species: [...hits.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]) });
    }
  }
  rows.sort((a, b) => b.distinct - a.distinct);
  return {
    origin: 'DERIVED',
    repair: 'do NOT edit the artifact — the generator writes the name back. The filter belongs where '
      + 'the game is admitted, not where the name lands.',
    filesScanned: files, skipped, artifacts: rows,
    controls: [
      { name: 'floette', why: 'Floette-Eternal and Floette-Mega are legal and their base is '
        + 'Past/Illegal. If "floette" appears above, the predicate has regressed to a bare '
        + 'isNonstandard check and would delete the largest usage row in the table.' },
      { name: 'florgeswhite', why: 'a COSMETIC forme — legal (tier UU), and absent from '
        + 'dex.species.all(). If it appears above, the predicate is asking a filtered walk instead '
        + 'of asking the row, which is how four legal bodies were accused across seven artifacts.' },
    ],
  };
}

module.exports = { sweep, scan, keyOf, derivedScan };

/* ---- CLI --------------------------------------------------------------------------------------- */
if (require.main === module) {
  if (process.argv.includes('--derived')) {
    const d = derivedScan();
    if (process.argv.includes('--json')) { console.log(JSON.stringify(d, null, 2)); process.exit(0); }
    console.log('DERIVED ILLEGAL SPECIES — names this regulation does not contain, sitting in a GENERATED artifact\n');
    console.log('  ' + d.filesScanned + ' data/*.json parsed');
    for (const s of d.skipped) console.log('  SKIPPED — ' + s);
    console.log('\n  ' + d.repair + '\n');
    for (const a of d.artifacts) {
      console.log('  ' + String(a.distinct).padStart(3) + '  ' + a.artifact.padEnd(38) + ' (' + a.mtime + ')');
      console.log('       ' + a.species.slice(0, 14).join(', ') + (a.species.length > 14 ? ', …' : ''));
    }
    for (const c of d.controls) console.log('\n  negative control: "' + c.name + '" must NOT appear above. ' + c.why);
    process.exit(0);
  }
  const r = sweep();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log(`FIXTURE LEGALITY — every declared set through TeamValidator (${r.format})\n`);
  console.log(`  ${r.filesScanned} .js files scanned`);
  console.log(`  ${r.declarations} set declarations, ${r.distinctSets} distinct sets`);
  console.log(`  ${r.rejectedSets} distinct sets REJECTED, producing ${r.findings.length} distinct verdicts`);
  console.log(`  ${r.pairs.length} distinct illegal DECLARATIONS behind those verdicts `
    + `(${r.unreachable.length} of them UNREACHABLE — no legal carrier anywhere in the regulation)`);
  console.log(`  ${r.notStaticallyPaired} construction sites carry no literal set and are NOT in this population `
    + `(${r.notStaticallyPairedDerived} of them build the body from a DERIVED value)`);
  console.log(`\n  ORIGIN: every verdict below is ${r.origin}. ${r.originWhy}`);
  console.log('  For the DERIVED half: node engine/fixture_legality.js --derived\n');
  console.log('DECLARATIONS BY FILE');
  for (const k of Object.keys(r.byFile).sort((a, b) => r.byFile[b] - r.byFile[a])) {
    console.log(`  ${String(r.byFile[k]).padStart(4)}  ${k}`);
  }
  if (r.unknownLiterals.length) {
    console.log('\nSTRING LITERALS INSIDE A SET DECLARATION THAT NAME NOTHING IN THIS FORMAT');
    for (const u of r.unknownLiterals) console.log(`  "${u.literal}"   ${u.sites.join(', ')}`);
  }
  if (r.unreachable.length) {
    console.log('\nUNREACHABLE — NOTHING IN THIS REGULATION CAN CARRY THESE, so a probe that asserts');
    console.log('them is measuring a game nobody plays and its failure is NOT an engine defect:');
    for (const p of r.unreachable) console.log(`  [${p.kind}] ${p.problem}   ${p.sites.join(', ')}`);
  }
  console.log('\nTHE AUTHORITY\'S VERDICTS');
  for (const f of r.findings) {
    console.log(`\n  [${f.kind}] ${f.problem}`);
    for (const s of [...new Set(f.sets)]) console.log(`      set:  ${s}`);
    console.log(`      sites: ${f.sites.join(', ')}`);
  }
}
