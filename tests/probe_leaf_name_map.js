/* probe_leaf_name_map.js — WHAT DOES *OUR* ENGINE CALL EACH LEAF THE COMPARATOR CANNOT SEE?
 *
 * WHY THIS EXISTS (2026-08-28). `tests/probe_uncompared_leaves.js` reports 43 leaves that legal
 * mechanics write and `engine/board_state.js` reads in neither list. Its `_vol` column says our
 * engine holds THREE of them (`lockon`, `minimize`, `noretreat`) — and that column is a grep for the
 * literal `_vol.<name>`, which its own header says is "NOT EVIDENCE OF ABSENCE". Widening the
 * comparator needs the opposite question answered: for each of the 43, WHAT IS THE ADDRESS ON OUR
 * SIDE that the comparator would have to read?
 *
 * A WRITTEN TABLE WOULD BE WRONG WITHIN A DAY — the fourteen stale handoffs, the ban list of four.
 * So every column here is computed at run time from four sources, none of them typed here:
 *
 *   1. THE HOLE ITSELF is not re-derived. This probe SHELLS OUT to
 *      `tests/probe_uncompared_leaves.js --json` and consumes its rows, so the two can never
 *      disagree about what the hole is. A second copy of "which leaf does this mechanic write" is
 *      the two-copies-of-one-fact breach CLAUDE.md forbids, and that file already shares its
 *      derivation with the instrument it audits.
 *
 *   2. THE OWNER TABLES are PARSED OUT OF `engine/medicham2-browser.js` at run time. That engine
 *      already holds four maps keyed by the AUTHORITY'S OWN volatile spelling, written so its
 *      residual walk can find state it keeps under its own names:
 *          RESIDUAL_SHADOW_VOL      volatile id -> a predicate over the body
 *          RESIDUAL_FOLLOWER_VOL    volatile id -> "is it still there after this residual"
 *          RESIDUAL_CLOCK_READER    volatile id -> which clock spends it
 *          RESIDUAL_FOLLOWER_FIELD  pseudoweather id -> the field key
 *      None is exported, so they are read as SOURCE and the matched text is printed as the evidence.
 *      If the engine renames `_mtLock`, this probe's answer changes on the next run.
 *
 *   3. THE TAG ROUTE — AND IT OVER-MATCHED FIRST, WHICH IS WHY IT IS NARROW AND SAID OUT LOUD.
 *      `applyMoveVolatile(who, vol, ...)` is medicham2's generic write and it keys `_vol[vol]` by the
 *      name the ARTIFACT hands it. The first version of this rule asked only "does any tag param on
 *      any legal entity carry this string, and does the engine read that tag" — and it produced FIVE
 *      false mappings out of thirty-seven, every one of them toward the comfortable answer:
 *          quickguard/wideguard   matched `feint.breaksProtect.sideConditions[2]` — a READER of the
 *                                 guard, and they are not volatiles at all (`field.sgA`)
 *          futuremove/wish/       matched `healDescriptor.slotCondition` and were handed `_vol[...]`,
 *          healingwish            when the engine keeps all three on `sf.slot[i]`
 *          beakblast/focuspunch   matched `instruct.instructsTarget.refuses[]` — a REFUSAL LIST
 *          chillyreception        matched `volatileAnnounce` — an announcement table, not a write
 *          flashfire              matched `typeImmunity.gain.volatile`, and the engine's consumer of
 *                                 that exact field COUNTS IT AS UNMODELLED (`absorbGiftUnmodelled`)
 *      docs/ENGINE.md: a new derived predicate over-matches; print what it matched before wiring it.
 *      So the route now accepts only param paths that are WRITE shapes fed to `applyMoveVolatile` —
 *      `statusInflict.effects[N].volatile` (medicham2-browser.js:31072 and :23505),
 *      `layeredVolatile.volatile`, `critStageVolatile.volatile`, `volatileStartGate.volatile`,
 *      `guaranteesNextMove.volatile` — on a leaf that is a VOLATILE, on a tag the engine reads.
 *
 *   4. THE ANCHORED DECLARATION, for the addresses no derivation can reach. Choice lock lives in
 *      `_lock`, the Metronome ladder in `_metroN`, Fling's throw in `_flingBP`; nothing in the tag
 *      artifact names any of them, because the tag names the MECHANIC and the field is the engine's
 *      private shape. Those rows are DECLARED here — and every one carries anchor patterns that must
 *      still match the live engine source. A renamed field does not silently keep its old answer: the
 *      anchor stops matching and the row falls to CANNOT-DETERMINE with the pattern that failed. It
 *      is the weakest route in the file and it is labelled on every row that uses it.
 *
 * WHAT IT REFUSES TO DO. Where none of the four answers, the row is `CANNOT-DETERMINE` and says what
 * would settle it. A guess dressed as a mapping is worse than a blank — that is the whole reason
 * `NOT_COMPARED` exists in the file this probe serves.
 *
 * THE FOURTH VERDICT IS NOT A HEDGE. `NO-STATE` means the engine implements the mechanic and keeps
 * NO state under that name, because the authority's own condition carries none that survives its own
 * action (Chilly Reception's marker is `duration: 1` and exists to print a line). Collapsing that
 * into ABSENT would report a working mechanic as missing, which is the loudest thing this probe can
 * say and must be reserved for the real ones.
 *
 * BOUNDARY CHECK. The Showdown-exit plan asserts the honest widening target is 33 -> 58 because 18
 * of the 43 carry `duration: 1` and are ended in the residual, so they cannot stand at a turn
 * boundary. That rests on the comparator only ever reading at a boundary. This probe prints the
 * inverse test the plan did not ask for: the DECLARED LIFETIME of the 33 leaves the comparator
 * ALREADY reads. A duration-1 leaf among them would mean the comparator is already comparing
 * something vacuous and the boundary claim is wrong before anyone reads the driver.
 *
 * REACH. `--pool` streams `data/team-pool-frozen` and counts, per leaf, how many sheet entries carry
 * a writer and how many games have one on either side. THAT IS AN UPPER BOUND AND IS LABELLED ONE:
 * carrying Outrage is not clicking it, and the pool brings 4 of 6. It is here because the plan
 * orders the widening by decision impact and nothing had measured whether the order survives the
 * data.
 *
 *   node tests/probe_leaf_name_map.js              the map
 *   node tests/probe_leaf_name_map.js --pool       + reach over the frozen pool (streams 135 MB)
 *   node tests/probe_leaf_name_map.js --json       the same as an object
 */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const readline = require('readline');
const D = (...p) => path.join(__dirname, '..', ...p);
const JSONOUT = process.argv.includes('--json');
const POOL = process.argv.includes('--pool');

const BS = require(D('engine', 'board_state.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* ---- 1. THE HOLE, FROM THE PROBE THAT OWNS IT -------------------------------------------------- */
/* Spawned for the ROWS (a child process, so a throw in the dex walk is reported rather than taking
 * this file down mid-parse) and required for the RULES it owns — `selfRemovesWithinAction` and
 * `boundaryCallSites`. The require is free: that module runs nothing at load. */
const UPM = require(D('tests', 'probe_uncompared_leaves.js'));
let UP;
try {
  UP = JSON.parse(cp.execFileSync(process.execPath,
    [D('tests', 'probe_uncompared_leaves.js'), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
} catch (e) {
  console.error('NOT RUN — tests/probe_uncompared_leaves.js did not answer. This probe derives the '
    + 'hole from that one on purpose; re-deriving it here would be a second copy of the same fact.');
  console.error(String((e && e.message) || e));
  process.exit(2);
}
const HOLE = UP.rows.filter(r => !r.compared && !r.declared);
const COMPARED_ROWS = UP.rows.filter(r => r.compared);

/* ---- 2. THE OWNER TABLES, PARSED OUT OF THE ENGINE AT RUN TIME --------------------------------- */
const MEDI_PATH = D('engine', 'medicham2-browser.js');
const MEDI = fs.readFileSync(MEDI_PATH, 'utf8');
const MEDI_LINES = MEDI.split('\n');
const lineOf = (idx) => MEDI.slice(0, idx).split('\n').length;

/* Reads `const NAME = { ... };` / `const NAME={...}` by brace balance rather than by a regex over the
 * whole body — the bodies contain `}` inside arrow functions and a lazy regex stops at the first one,
 * which silently truncates the table to its first few members. */
function objectLiteral(name) {
  const at = MEDI.indexOf('const ' + name);
  if (at < 0) return null;
  const open = MEDI.indexOf('{', at);
  if (open < 0) return null;
  let d = 0, i = open;
  for (; i < MEDI.length; i++) {
    const c = MEDI[i];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) break; }
  }
  return { body: MEDI.slice(open + 1, i), line: lineOf(at) };
}
/* Splits an object literal's top level into `key: value` pairs — again by brace/paren depth, because
 * every value in these tables is an arrow function containing commas. */
function topLevelEntries(body) {
  const out = [];
  let d = 0, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '{' || c === '(' || c === '[') d++;
    else if (c === '}' || c === ')' || c === ']') d--;
    else if (c === ',' && d === 0) { out.push(body.slice(start, i)); start = i + 1; }
  }
  out.push(body.slice(start));
  const pairs = [];
  for (const raw of out) {
    const s = raw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!s) continue;
    const m = s.match(/^([A-Za-z_$][A-Za-z0-9_$]*|'[^']+'|"[^"]+")\s*:\s*([\s\S]+)$/);
    if (!m) continue;
    pairs.push([m[1].replace(/['"]/g, '').toLowerCase(), m[2].replace(/\s+/g, ' ').trim()]);
  }
  return pairs;
}
const OWNER_TABLES = ['RESIDUAL_SHADOW_VOL', 'RESIDUAL_FOLLOWER_VOL', 'RESIDUAL_CLOCK_READER',
                      'RESIDUAL_FOLLOWER_FIELD'];
const OWNER = new Map();          // leaf name -> [{table, expr, line}]
const OWNER_TABLE_SIZES = {};
for (const t of OWNER_TABLES) {
  const lit = objectLiteral(t);
  if (!lit) { OWNER_TABLE_SIZES[t] = null; continue; }
  const pairs = topLevelEntries(lit.body);
  OWNER_TABLE_SIZES[t] = pairs.length;
  for (const [k, v] of pairs) {
    if (!OWNER.has(k)) OWNER.set(k, []);
    OWNER.get(k).push({ table: t, expr: v, line: lit.line });
  }
}
/* A TABLE THAT PARSED TO NOTHING WOULD REPORT EVERY LEAF UNMAPPED — the most alarming possible answer
 * and a completely silent one. Asserted, not assumed, exactly as the probe this one consumes asserts
 * its own derivation. */
for (const t of OWNER_TABLES) if (!OWNER_TABLE_SIZES[t]) {
  console.error('NOT RUN — the owner table ' + t + ' parsed to '
    + (OWNER_TABLE_SIZES[t] === null ? 'NOT FOUND' : '0 entries') + ' out of ' + MEDI_PATH
    + '. Every address below would read as missing, which is a silent default, not a finding.');
  process.exit(2);
}

/* The volatiles `applyMoveVolatile` refuses to write generically because another site owns them —
 * read off its own `if(vol==='x')` branches rather than listed here. */
const OWNED_ELSEWHERE = new Map();
{
  const at = MEDI.indexOf('function applyMoveVolatile(');
  if (at >= 0) {
    const seg = MEDI.slice(at, MEDI.indexOf('\nfunction ', at + 10));
    for (const m of seg.matchAll(/vol\s*===\s*'([a-z0-9]+)'/g))
      OWNED_ELSEWHERE.set(m[1], lineOf(at + m.index));
  }
}

/* ---- 3. WHICH TAG PARAM NAMES THIS LEAF, OVER EVERY LEGAL ENTITY ------------------------------- */
const TAGS = require(D('data', 'tags.json'));
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGIDX = new Map();         // leaf name -> [{kind, id, tag, path}]
for (const bucket of ['moves', 'items', 'abilities']) {
  const kind = bucket.slice(0, -1).replace('abilitie', 'ability');
  for (const [id, rec] of Object.entries(TAGS[bucket] || {})) {
    for (const [tag, params] of Object.entries((rec && rec.params) || {})) {
      (function walk(o, p) {
        if (o == null) return;
        if (typeof o === 'string') {
          const v = norm(o);
          if (!TAGIDX.has(v)) TAGIDX.set(v, []);
          TAGIDX.get(v).push({ kind, id, tag, path: p, as: 'value' });
          return;
        }
        if (Array.isArray(o)) { o.forEach((x, i) => walk(x, p + '[' + i + ']')); return; }
        if (typeof o === 'object') for (const k of Object.keys(o)) {
          const kk = norm(k);
          if (!TAGIDX.has(kk)) TAGIDX.set(kk, []);
          TAGIDX.get(kk).push({ kind, id, tag, path: p + '.{' + k + '}', as: 'key' });
          walk(o[k], p + '.' + k);
        }
      })(params, tag);
    }
  }
}
/* Does the ENGINE read this tag at all? A tag that names the leaf and that nothing consumes is not an
 * address. Line numbers printed so the claim is checkable. */
const TAGREAD = new Map();
for (const m of MEDI.matchAll(/TAGS\.(?:param|has|withTag|tagsFor)\([^)]*?'([a-zA-Z][a-zA-Z0-9]*)'\s*\)/g)) {
  const t = m[1];
  if (!TAGREAD.has(t)) TAGREAD.set(t, lineOf(m.index));
}
/* `TAGS.param('move', id, 'x')` puts the tag last; `TAGS.withTag('move','x')` too. The regex above
 * takes the LAST quoted token before the close paren, which is the tag in both shapes. */

/* The tag param PATHS that are a WRITE into `_vol`, as opposed to a read, a refusal list or an
 * announcement table. See the header: the unrestricted version of this rule produced five false
 * mappings. Each shape is anchored to the call site that consumes it, and an anchor that stops
 * matching disables the route rather than silently keeping its answer. */
const WRITE_PATHS = [
  { re: /^statusInflict\.effects\[\d+\]\.volatile$/,
    anchor: /applyMoveVolatile\(\s*tg\s*,\s*_e\.volatile/, why: 'the primary volatile loop' },
  { re: /^layeredVolatile\.volatile$/,
    anchor: /function applyLayeredVolatile\(/, why: 'the layer family, v[vol]=at+1' },
  { re: /^critStageVolatile\.volatile$/,
    anchor: /function copyCritStageVolatiles\(/, why: 'the crit-stage family, keyed by volatile' },
  { re: /^volatileStartGate\.volatile$/,
    anchor: /_sg\.volatile\s*===\s*vol/, why: 'gated, then falls through to the generic write' },
  { re: /^guaranteesNextMove\.volatile$/,
    anchor: /function guaranteeVolatiles\(/, why: 'the next-move guarantee' },
];
const WRITE_PATHS_LIVE = WRITE_PATHS.filter(w => w.anchor.test(MEDI));
const WRITE_PATHS_DEAD = WRITE_PATHS.filter(w => !w.anchor.test(MEDI));

/* ---- 3b. THE ANCHORED DECLARATIONS ------------------------------------------------------------
 * The addresses no artifact can name, because the artifact names the MECHANIC and the field is this
 * engine's private shape. Every anchor must match the LIVE engine source; a row whose anchor fails
 * falls to CANNOT-DETERMINE naming the pattern, so a rename cannot leave a stale answer standing. */
const DECLARED = {
  'volatile:choicelock': { address: "m._lock with m._lockT === Infinity (reader: lockMenuMove)",
    anchors: [/_lockT\s*!==\s*Infinity/, /'choiceLock'/], exact: true,
    why: 'one field carries BOTH locks and `_lockT` tells them apart — Infinity is the Choice lock' },
  'volatile:metronome': { address: 'm._metroN (the ladder) + m._metroLast (which move)',
    anchors: [/_metroN/, /'damageMultOnRepeat'/], exact: true,
    why: 'the authority keeps the count in effectState on a volatile the item adds' },
  'volatile:unburden': { address: 'DERIVED, not stored: m._hadItem && !m.item (with _roomItem for a '
      + 'suppressed item), re-stamped at every bringIn',
    anchors: [/_hadItem/, /'speedOnItemLoss'/], exact: false,
    why: 'a body handed an item MID-STINT and then losing it gets the volatile in the authority and '
       + 'gets nothing here — the engine names that gap itself at the bringIn site' },
  'volatile:fling': { address: 'm._flingBP / m._flingFx / m._flingItem, stamped for the action',
    anchors: [/_flingBP/, /'flingsOwnItem'/], exact: false,
    why: 'the authority\'s `fling` volatile is a within-action marker whose own onUpdate spends the '
       + 'item; this engine stamps the power instead and never holds a volatile' },
  'volatile:counter': { address: 'm._took.byPhys (via scriptedAimOf), cleared at the top of a turn',
    anchors: [/_took/, /function scriptedAimOf\(/], exact: false,
    why: 'the authority puts the record on the COUNTER USER at beforeTurn; this engine puts it on '
       + 'whoever was hit, and derives the aim from it. Same answer, different body' },
  'volatile:mirrorcoat': { address: 'm._took.bySpec (via scriptedAimOf)',
    anchors: [/_took/, /function scriptedAimOf\(/], exact: false, why: 'as counter' },
  'volatile:focuspunch': { address: "m._preTurn = {id:'focuspunch', p, hit, hitSide}",
    anchors: [/_preTurn\s*=\s*\{/, /'preTurnShield'/], exact: true,
    why: 'the authority sets it from priorityChargeCallback; this engine from _chargePhase' },
  'volatile:beakblast': { address: "m._preTurn = {id:'beakblast', p, hit, hitSide}",
    anchors: [/_preTurn\s*=\s*\{/, /'preTurnShield'/], exact: true, why: 'as focuspunch' },
  'sideCondition:quickguard': { address: "field.sgA / field.sgB ['quickguard'] — a map of guard move "
      + 'id -> true, emptied at the top of every turn',
    anchors: [/field\.sgA\s*=\s*\{\}/, /'oneTurnGuard'/], exact: true,
    why: 'this engine keys the guard by the MOVE id, which is the same string the authority uses for '
       + 'the side condition' },
  'sideCondition:wideguard': { address: "field.sgA / field.sgB ['wideguard']",
    anchors: [/field\.sgA\s*=\s*\{\}/, /'oneTurnGuard'/], exact: true, why: 'as quickguard' },
  'slotCondition:wish': { address: "sf.slot[i] with .when === 'endOfNextTurn' (hp, by, turns)",
    anchors: [/endOfNextTurn/, /'healDescriptor'/], exact: true,
    why: 'one slot map, three members, told apart by `when` — residualShadowBuild makes the same read' },
  'slotCondition:healingwish': { address: "sf.slot[i] with .when === 'onEntry' (cures, full)",
    anchors: [/when===['"]onEntry['"]|when\s*===\s*['"]onEntry['"]/, /'healDescriptor'/], exact: true,
    why: 'collected in bringIn, and survives a body that needs nothing' },
  'slotCondition:futuremove': { address: "sf.slot[i] with .when === 'futureHit'",
    anchors: [/futureHit/, /'delayedHit'/], exact: true, why: 'the delayed hit' },
  /* THE TWO THAT ARE NOT ADDRESSES. Kept in the same table so they carry the same anchor discipline:
   * a claim that a mechanic is missing is the loudest thing this file can say and must be re-checked
   * on every run, not remembered. */
  'volatile:chillyreception': { verdict: 'NO-STATE',
    address: 'none — the pivot and the snow are implemented (pivotStatus, setsWeather); the '
      + 'authority\'s marker is a duration-1 condition that exists to print a line',
    anchors: [/'pivotStatus'/, /'setsWeather'/], exact: true,
    why: 'no statusInflict effect names it, so nothing reaches the generic write; the engine lists it '
       + 'in MEDFAILS.residualShadowUnread for exactly that reason' },
  'volatile:flashfire': { verdict: 'ABSENT',
    address: 'NONE. `absorbGift` counts it: `if(!_h && !_ab.gain.boosts && _ab.gain.volatile) '
      + 'MEDFAILS.absorbGiftUnmodelled++`. The absorb is priced at zero and the GIFT is dropped, so '
      + 'a Flash Fire body that eats a Fire move gets no volatile and no 1.5x on its own Fire moves.',
    anchors: [/absorbGiftUnmodelled\+\+/], exact: true,
    why: 'flashfire is the only ability in this format whose typeImmunity gain is a volatile' },
};

/* ---- 4. CLASSIFY ------------------------------------------------------------------------------- */
/* THE ROUTES, IN ORDER OF STRENGTH. Each row records WHICH one answered, so a weak answer cannot be
 * read as a strong one. */
const rows = HOLE.map(r => {
  const leaf = r.name;
  const out = { key: r.key, klass: r.klass, name: leaf, writers: r.writers,
                duration: r.life.duration, gone_at_the_boundary: r.life.gone_at_the_boundary,
                verdict: null, route: null, address: null, evidence: null, note: null };

  const own = OWNER.get(leaf);
  if (own) {
    out.verdict = 'MAPPED'; out.route = 'owner-table';
    out.address = own.map(o => o.expr).join(' ;; ');
    out.evidence = own.map(o => o.table + ' @ medicham2-browser.js:' + o.line).join(' ; ');
    return out;
  }

  /* Route 3 — the generic `_vol` write, and ONLY through a param path that is a write shape. A
   * VOLATILE leaf only: a side or slot condition never reaches applyMoveVolatile at all. */
  if (r.klass === 'volatile') {
    if (OWNED_ELSEWHERE.has(leaf)) {
      out.verdict = 'MAPPED'; out.route = 'owned-branch';
      out.address = "applyMoveVolatile refuses '" + leaf + "' to its own owner";
      out.evidence = 'medicham2-browser.js:' + OWNED_ELSEWHERE.get(leaf);
      return out;
    }
    const hits = [];
    for (const t of (TAGIDX.get(leaf) || [])) {
      if (t.as !== 'value' || !TAGREAD.has(t.tag)) continue;
      const w = WRITE_PATHS_LIVE.find(x => x.re.test(t.path));
      if (w) hits.push({ t, w });
    }
    if (hits.length) {
      out.verdict = 'MAPPED'; out.route = 'tag->generic _vol';
      out.address = "m._vol['" + leaf + "']";
      out.evidence = hits.slice(0, 3).map(h => h.t.kind + ':' + h.t.id + ' ' + h.t.path
        + '  [' + h.w.why + '; engine reads ' + h.t.tag + ' @ :' + TAGREAD.get(h.t.tag) + ']').join(' ; ');
      return out;
    }
  }

  /* Route 4 — the anchored declaration, re-checked against the live engine bytes on every run. */
  const dec = DECLARED[r.key];
  if (dec) {
    const dead = dec.anchors.filter(a => !a.test(MEDI));
    if (dead.length) {
      out.verdict = 'CANNOT-DETERMINE'; out.route = 'declared, ANCHOR NO LONGER MATCHES';
      out.note = 'the declared address ' + JSON.stringify(dec.address) + ' rested on '
        + dead.map(String).join(' and ') + ', which is no longer in medicham2-browser.js. '
        + 'RE-DERIVE IT — do not trust the address above.';
      return out;
    }
    out.verdict = dec.verdict || 'MAPPED';
    out.route = 'declared+anchored' + (dec.exact === false ? ' (INEXACT SHAPE)' : '');
    out.address = dec.address;
    out.evidence = dec.why + '  [anchors hold: ' + dec.anchors.map(String).join(' ') + ']';
    return out;
  }

  /* Nothing answered. Say which blank this is and what would settle it. */
  const anyTag = TAGIDX.get(leaf) || [];
  out.verdict = 'CANNOT-DETERMINE';
  out.route = anyTag.length ? 'tag names it, but on no write path' : 'no tag names it';
  out.note = (anyTag.length
    ? 'named only as ' + anyTag.slice(0, 2).map(t => t.kind + ':' + t.id + ' ' + t.path).join(' ; ') + ' — '
    : 'no legal entity\'s tag params carry this string — ')
    + 'settle by staging the writer and printing both engines\' raw state '
    + '(tests/probe_volatile_leaves.js), which is the only falsifier';
  return out;
});

/* ---- 5. THE BOUNDARY CHECK, RUN THE OTHER WAY -------------------------------------------------- */
const comparedDur1 = COMPARED_ROWS.filter(r => r.life.gone_at_the_boundary);
const holeDur1 = HOLE.filter(r => r.life.gone_at_the_boundary);
let holeStanding = HOLE.filter(r => !r.life.gone_at_the_boundary);

/* A DECLARED CLOCK IS NOT THE WHOLE LIFETIME, AND THE PARENT PROBE SAYS SO IN ITS OWN HEADER: "a
 * condition with no declared clock may still be removed inside the turn by its own move (Sparkling
 * Aria's is)". Two of the 24 are exactly that, and neither can be standing when the comparator reads.
 *
 * THE RULE LIVES IN THE PARENT PROBE AS OF 2026-08-29 AND IS CALLED FROM HERE. It was defined here and
 * nowhere else, so `derive()` — the function `engine/coverage.js` and `engine/status.js` read — did not
 * know about it and published a ceiling of 58 where this file printed 56. Two producers of one fact,
 * disagreeing, exactly as the closed-row detector did on 24 of 292 rows. The guard that rescues
 * `lockedmove` from over-matching moved with it and is documented at the definition. */
const SELF_REMOVED = [], SELF_REMOVE_GUARDED = [];
holeStanding = holeStanding.filter(r => {
  const w = UPM.selfRemovesWithinAction(dex, r.name);
  if (!w.length) return true;
  if (r.life.duration != null) { SELF_REMOVE_GUARDED.push({ key: r.key, where: w, duration: r.life.duration }); return true; }
  SELF_REMOVED.push({ key: r.key, where: w });
  return false;
});
const TARGET = COMPARED_ROWS.length + holeStanding.length;

/* WHERE THE BOARD IS ACTUALLY SAMPLED, read off the driver rather than asserted. Every board this
 * repository compares goes through `BS.snapshot`, and the only place that is called from is
 * `stateCheck` in `game_differential.js`. Its call sites are what decide the boundary claim — and,
 * same as the rule above, that derivation now lives in the parent probe so the coverage line and this
 * probe cannot part on it. */
const BCS = UPM.boundaryCallSites();
const SNAPSHOT_CALLS = BCS.snapshot_calls;
const STATECHECK_CALLS = BCS.statecheck_call_lines;
const OTHER_SNAPSHOT_CALLERS = BCS.other_snapshot_callers;

/* ---- 6. REACH OVER THE FROZEN POOL (optional) -------------------------------------------------- */
async function poolReach() {
  const store = D('data', 'team-pool-frozen');
  const files = ['games.bo3.jsonl', 'games.ots.jsonl'].map(f => path.join(store, f))
    .filter(p => fs.existsSync(p));
  if (!files.length) return null;
  const sheetCount = new Map();     // entity key -> sheet entries carrying it
  const gameHas = new Map();        // entity key -> games with it on either side
  let games = 0;
  /* A store line that will not parse is a game DROPPED FROM EVERY REACH COUNT below. Counted and
   * printed rather than skipped in silence: reach is what decides the widening ORDER, so a quiet
   * drop reorders the work without anybody seeing it. */
  let BADLINES = 0;
  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let g;
      try { g = JSON.parse(line); }
      catch (e) { BADLINES++; continue; }   /* a torn store line; counted and printed, never skipped in silence */
      games++;
      const here = new Set();
      for (const side of ['p1', 'p2']) for (const m of ((g.sheets && g.sheets[side]) || [])) {
        const add = (k) => { if (!k) return;
          sheetCount.set(k, (sheetCount.get(k) || 0) + 1); here.add(k); };
        add('item:' + norm(m.item));
        add('ability:' + norm(m.ability));
        for (const mv of (m.moves || [])) add('move:' + norm(mv));
      }
      for (const k of here) gameHas.set(k, (gameHas.get(k) || 0) + 1);
    }
  }
  if (BADLINES) console.error('pool reach: ' + BADLINES + ' unparseable store line(s) skipped -- every reach count below is short by those games, and reach is what decides the widening ORDER.');
  return { games, sheetCount, gameHas, badLines: BADLINES };
}

(async () => {
  let reach = null;
  if (POOL) reach = await poolReach();
  if (reach) for (const r of rows.concat(
      COMPARED_ROWS.map(x => ({ key: x.key, writers: x.writers, _compared: true })))) {
    r.pool_sheets = r.writers.reduce((n, w) => n + (reach.sheetCount.get(w) || 0), 0);
    r.pool_games = Math.max(0, ...r.writers.map(w => reach.gameHas.get(w) || 0));
  }

  const counts = { MAPPED: 0, ABSENT: 0, 'NO-STATE': 0, 'CANNOT-DETERMINE': 0 };
  for (const r of rows) counts[r.verdict] = (counts[r.verdict] || 0) + 1;

  if (JSONOUT) {
    console.log(JSON.stringify({
      generated: new Date().toISOString(),
      medicham2_bytes: MEDI.length,
      owner_table_sizes: OWNER_TABLE_SIZES,
      owned_elsewhere: [...OWNED_ELSEWHERE.keys()],
      write_paths_live: WRITE_PATHS_LIVE.map(w => String(w.re)),
      write_paths_dead: WRITE_PATHS_DEAD.map(w => String(w.re)),
      counts, rows,
      boundary: { snapshot_calls_in_driver: SNAPSHOT_CALLS,
                  statecheck_call_lines: STATECHECK_CALLS,
                  other_snapshot_callers: OTHER_SNAPSHOT_CALLERS,
                  compared_leaves: COMPARED_ROWS.length,
                  compared_duration1: comparedDur1.map(r => r.key),
                  hole_duration1: holeDur1.map(r => r.key),
                  hole_self_removed_within_action: SELF_REMOVED,
                  hole_self_remove_guarded_by_declared_clock: SELF_REMOVE_GUARDED,
                  hole_standing: holeStanding.map(r => r.key),
                  widening_target: TARGET },
      pool: reach ? { games: reach.games } : null,
    }, null, 1));
    return;
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('  MEDICHAM2 READ AT ' + MEDI.length + ' BYTES (the LIVE file; another agent may hold it '
    + 'modified — this is a read of what is on disk now, not of a release).');
  console.log('  OWNER TABLES PARSED  ' + OWNER_TABLES.map(t => t + ' ' + OWNER_TABLE_SIZES[t]).join('   '));
  console.log('  applyMoveVolatile REFUSES TO ITS OWN OWNER: ' + [...OWNED_ELSEWHERE.keys()].join(' '));
  console.log('  WRITE PATHS LIVE ' + WRITE_PATHS_LIVE.length + ' of ' + WRITE_PATHS.length
    + (WRITE_PATHS_DEAD.length ? '   DEAD ANCHOR: ' + WRITE_PATHS_DEAD.map(w => String(w.re)).join(' ') : ''));
  console.log('');
  console.log('  THE ' + HOLE.length + ' UNCOMPARED LEAVES, BY WHAT OUR ENGINE CALLS THEM');
  console.log('    ' + Object.keys(counts).map(k => k + ' ' + counts[k]).join('   '));
  console.log('');
  console.log('  ' + pad('LEAF', 30) + pad('dur', 5) + pad('VERDICT', 18) + pad('ROUTE', 26) + 'ADDRESS');
  for (const r of rows.slice().sort((a, b) => a.verdict.localeCompare(b.verdict) || a.key.localeCompare(b.key)))
    console.log('  ' + pad(r.key, 30) + pad(r.duration == null ? '-' : r.duration, 5)
      + pad(r.verdict, 18) + pad(r.route, 26) + String(r.address || r.note || '').slice(0, 90));
  console.log('');
  console.log('  EVIDENCE');
  for (const r of rows) console.log('    ' + pad(r.key, 30) + String(r.evidence || r.note || ''));
  console.log('');
  console.log('  ---- BOUNDARY CHECK ----------------------------------------------------------------');
  console.log('  BS.snapshot call sites inside game_differential.js: ' + SNAPSHOT_CALLS);
  console.log('  stateCheck() call sites (lines): ' + STATECHECK_CALLS.join(', '));
  console.log('  other files calling BS.snapshot directly: '
    + (OTHER_SNAPSHOT_CALLERS.length ? OTHER_SNAPSHOT_CALLERS.join(', ') : 'NONE'));
  console.log('  of the ' + COMPARED_ROWS.length + ' leaves ALREADY compared, ' + comparedDur1.length
    + ' carry a declared duration of 1' + (comparedDur1.length ? ': ' + comparedDur1.map(r => r.key).join(' ') : ''));
  console.log('  of the ' + HOLE.length + ' uncompared, ' + holeDur1.length + ' are duration 1, '
    + SELF_REMOVED.length + ' are removed inside their own action ('
    + SELF_REMOVED.map(x => x.key + ' <- ' + x.where.join('/')).join(', ') + '),');
  if (SELF_REMOVE_GUARDED.length) console.log('  (the declared-clock guard rescued '
    + SELF_REMOVE_GUARDED.map(x => x.key + ' dur ' + x.duration + ' <- ' + x.where.join('/')).join(', ')
    + ' — a CONDITIONAL removal at the end of a real clock, not a within-action end)');
  console.log('  leaving ' + holeStanding.length + ' that can stand at a boundary.');
  console.log('  SO THE WIDENING TARGET IS ' + COMPARED_ROWS.length + ' -> ' + TARGET
    + '   (the plan says ' + COMPARED_ROWS.length + ' -> 58)');
  if (reach) {
    console.log('');
    console.log('  ---- REACH IN data/team-pool-frozen (' + reach.games + ' games) ---------------------');
    console.log('  UPPER BOUND. A sheet carrying Outrage is not a game that clicked it, and the pool');
    console.log('  brings 4 of 6. Read this as "could this leaf ever appear", never as "it did".');
    const standing = new Set(holeStanding.map(r => r.key));
    console.log('  ' + pad('LEAF', 30) + pad('sheets', 9) + pad('games', 9) + pad('boundary', 10) + 'verdict');
    for (const r of rows.slice().sort((a, b) => (b.pool_sheets || 0) - (a.pool_sheets || 0)))
      console.log('  ' + pad(r.key, 30) + pad(r.pool_sheets, 9) + pad(r.pool_games, 9)
        + pad(standing.has(r.key) ? 'STANDS' : '-', 10) + r.verdict);
    console.log('');
    console.log('  THE ORDER THAT MATTERS: the ' + holeStanding.length + ' that can actually be read at a');
    console.log('  boundary, by pool reach. Everything above with `-` cannot be compared however common.');
    let n = 0;
    for (const r of rows.slice().sort((a, b) => (b.pool_games || 0) - (a.pool_games || 0)))
      if (standing.has(r.key))
        console.log('   ' + String(++n).padStart(3) + '. ' + pad(r.key, 28) + pad(r.pool_games, 8)
          + 'games   writers ' + r.writers.length + '   ' + r.verdict);
  }
})();
