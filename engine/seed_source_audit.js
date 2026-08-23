/* seed_source_audit.js — EVERY DERIVED TABLE ON THE SEEDING PATH, AUDITED AGAINST THE REGULATION.
 *
 * ROADMAP #282 and the open remainder of #244. Two questions, one instrument, because they are one
 * failure: a value the board hands the search is DERIVED from a walk, and the walk is wider or
 * narrower than the game.
 *
 *   #282  `magnemite.volatileDuration` walked `dex.moves.all()` skipping only `!m.exists` — the walk
 *         CLAUDE.md names — so a volatile's duration could be read off a move this regulation does
 *         not contain. Fixed 2026-08-14; this records what the filter actually did, key by key,
 *         so "one number changed and thirty-four became unreachable" is an artifact rather than a
 *         sentence in a ledger.
 *
 *   #244  `board.movePower` calls a move's `basePowerCallback` against a hand-built stub. The stub
 *         satisfies the weight and speed callbacks and silently returns the PRINTED value for
 *         anything reading side or battle state — so Last Respects is scored at its floor in every
 *         FEATURE, however many of the side are in the ground. This counts the class rather than the
 *         one move, because a fix aimed at one member of a class leaves the rest.
 *
 * IT OPENS A `Dex` AND PLAYS NO GAME. No `battleInit`, no rollout, no store — so it is not
 * downstream of MEDICHAM and is not quarantined. What it reads is the FORMAT and this repository's
 * own derived tables, which is the pair the audit is about.
 *
 *   node engine/seed_source_audit.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

require(D('engine', 'showdown_path.js'));
require(D('data', 'engine-data.js'));
const CS = require(D('engine', 'champions_sim.js'));
const B = require(D('engine', 'board.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));   // the ONE species -> MC.mons resolver
const MAG = require(D('engine', 'magnemite.js'));
/* `data/tags.json` is DELIBERATELY not read here. Every number in this artifact is a statement about
 * the FORMAT and about this repository's own derived tables; pulling in the corpus would make the
 * file look store-dependent to provenance and would tie an audit of a legality filter to a re-ingest
 * it has nothing to do with. */

const dex = CS.sim().Dex.forFormat(CS.FORMAT);
/* CLAUDE.md's filter, all three clauses. A move carrying only `tier: 'Illegal'` would slip a
 * two-clause version, and the whole point of this file is that the filter is the subject. */
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

/* ---------------------------------------------------------------------------------------------
 * #282 — THE VOLATILE DURATION TABLE, BEFORE AND AFTER.
 *
 * The BEFORE table is rebuilt here by the expression that used to live in `magnemite.js`, so the
 * comparison is against the real prior behaviour rather than against a remembered one. The AFTER
 * table is asked of the shipped function itself — never of a copy — because a copy that drifts is
 * how a passing audit stops meaning anything.
 * ------------------------------------------------------------------------------------------ */
function auditDurations() {
  const before = {};
  for (const m of dex.moves.all()) {
    if (!m || !m.exists) continue;                       // the OLD guard, verbatim
    const v = B.norm(m.volatileStatus || '');
    const d = m.condition && m.condition.duration;
    if (v && d) before[v] = d;
    const byName = B.norm(m.name);
    if (d && !before[byName]) before[byName] = d;
  }
  MAG.volatileDuration('taunt');                          // force the lazy build
  const C = MAG.VOL_DUR_COUNTERS;

  const changed = [], unreachable = [];
  for (const k of Object.keys(before).sort()) {
    const now = MAG.volatileDuration(k);
    if (now === before[k]) continue;
    /* 3 is the function's own fallback, so "fell to 3" means the key has no legal carrier at all and
     * nothing in this regulation can ever look it up. That is a DIFFERENT event from a value being
     * corrected, and collapsing the two would bury the one number this row is about in thirty-four. */
    (now === 3 ? unreachable : changed).push({ key: k, before: before[k], after: now });
  }
  return {
    movesExist: dex.moves.all().filter(m => m && m.exists).length,
    movesLegal: dex.moves.all().filter(legal).length,
    counters: JSON.parse(JSON.stringify(C)),
    keysBefore: Object.keys(before).length,
    keysAfter: C.keys,
    correctedValues: changed,
    keysWithNoLegalCarrier: unreachable.length,
    keysWithNoLegalCarrierList: unreachable.map(r => r.key),
  };
}

/* ---------------------------------------------------------------------------------------------
 * #244 REMAINDER — THE basePowerCallback CLASS.
 *
 * `movePower` swallows a throwing callback and returns the printed value, which is the right failure
 * mode and an invisible one. Two things are counted and they are not the same thing:
 *
 *   FELL THROUGH   the computed answer equals the printed one. Often CORRECT — Water Spout at full
 *                  HP really is 150 — so this is an upper bound and is labelled as one.
 *   UNMODELLED     the callback's source text reads a field the stub does not build. This is the
 *                  real class, and it is read off the callback rather than guessed.
 * ------------------------------------------------------------------------------------------ */
/* *** THE CLASS IS ASKED OF THE CALLBACKS. IT USED TO BE SPELLED, AND IT WAS WRONG BOTH WAYS —
 * ROADMAP #287. ***
 *
 * What stood here was `STUB_HAS_NO`, a literal array of fifteen field names tested with
 * `src.includes(k)` against each callback's SOURCE TEXT. That is the ban-list-of-four shape CLAUDE.md
 * opens with, and it failed in both directions on the day it was measured:
 *
 *   FALSE POSITIVE  Water Shuriken was in the class for the `battle` inside `hasAbility("battlebond")`.
 *                   The callback answers correctly and has never fallen back.
 *   MISSED          Triple Axel (`move.hit`), Rage Fist (`pokemon.timesAttacked`) and Avalanche
 *                   (`pokemon.attackedBy`) — none of those field names was in the list, so a callback
 *                   that genuinely cannot produce a number was recorded as fine.
 *
 * So `readUnmodelledState: 6` was neither an upper nor a lower bound on anything.
 *
 * THE REPLACEMENT ASKS THE CALLBACK TO PRODUCE A NUMBER AND RECORDS THE ONES THAT CANNOT.
 * `board.unmodelledBasePower` is the ONE implementation of that question — the gate for this row
 * calls the same function — and it is self-correcting: a move added to the format, a callback
 * rewritten upstream, or a field the stub learns to build all move this list with no edit here.
 * Nothing in this file reads a callback's spelling any more.
 *
 * IT IS A UNION OVER BOARDS, AND THAT IS A DECISION RATHER THAN A DETAIL. `unmodelledBasePower` takes
 * the CALLER'S board, so a callback can answer on one position and fall through on another — Beat Up
 * reads `allies` and answers on any board with a body on it. The class being named is "cannot produce
 * a number", so the honest derivation is the union over the bare board this audit already staged plus
 * every one of `engine/feature_fixture.js`'s canonical staged boards. Naming ONE board would make the
 * artifact's headline a property of that board rather than of the callbacks.
 *
 * THE BOARDS ARE RECORDED, not just the verdict, so a reader can tell a short union from a long one.
 * `engine/gate_seed_source_audit.js` derives its own union over the same canonical fixture rather than
 * importing this one: the FACT (which callbacks cannot answer) has a single implementation in
 * board.js, and an auditor that sampled through the code it audits could only ever agree with it. */
function auditBasePower() {
  const bd = new B.Board();
  const pool = (mcKey.keys({ mayMiss: 'a smoke pool; an empty table is reported by the caller' }) || []).slice(0, 4);
  bd.setParty('p1', pool.slice(0, 2)); bd.setParty('p2', pool.slice(2, 4));
  bd.switchIn('p1', 'a', pool[0]); bd.switchIn('p2', 'a', pool[2]);
  const u = bd.slot('p1', 'a'), t = bd.slot('p2', 'a');

  /* THE UNION. The staged board above first, then every canonical fixture board. A fixture that will
   * not build is REPORTED and not swallowed: the union would silently narrow and this artifact would
   * publish a shorter class for having looked at less, which is the failure mode of the thing being
   * replaced. */
  const cannotAnswer = new Map();
  /* THE EMPTY BOARD IS A MEMBER OF THE UNION AND NOT AN OVERSIGHT. It is `unmodelledBasePower`'s own
   * documented default, and it is the position in which Beat Up has no allies to count — a callback
   * that answers with bodies on the field and refuses without them belongs in a class named "cannot
   * produce a number", because MAG ranks from whatever position it is handed. Dropping it would make
   * the class a property of the boards this file happens to stage. */
  const boards = [{ label: 'an empty board', board: null },
                  { label: 'the audit\'s own staged board', board: bd }];
  let fixtureError = null;
  try {
    const FIX = require(D('engine', 'feature_fixture.js'));
    const seen = new Set();
    for (const sl of FIX.build(dex)) {
      if (seen.has(sl.board)) continue;
      seen.add(sl.board);
      boards.push({ label: sl.label.split('/')[0], board: sl.board });
    }
  } catch (e) { fixtureError = String((e && e.message) || e).split('\n')[0]; }
  for (const b of boards) {
    for (const r of B.unmodelledBasePower(dex, b.board)) {
      if (!cannotAnswer.has(r.id)) cannotAnswer.set(r.id, { id: r.id, name: r.name, on: b.label });
    }
  }

  const rows = [];
  for (const m of dex.moves.all()) {
    if (!legal(m) || typeof m.basePowerCallback !== 'function') continue;
    const got = B.movePower(m, bd, dex, u, t);
    rows.push({ id: m.id, name: m.name, printed: m.basePower || 0, computed: got,
                fellThrough: got === (m.basePower || 0),
                cannotProduceANumber: cannotAnswer.has(m.id) });
  }
  const list = Array.from(cannotAnswer.values()).sort((a, b2) => a.id < b2.id ? -1 : 1);
  return {
    derivedBy: 'engine/board.js unmodelledBasePower(dex, board) — the callbacks are ASKED, never '
             + 'grepped. See ROADMAP #287 for what the fifteen-string list got wrong.',
    boardsInTheUnion: boards.length,
    boardUnionIncomplete: fixtureError,
    legalCallbackMoves: rows.length,
    fellThroughOnACleanBoard: rows.filter(r => r.fellThrough).length,
    readUnmodelledState: list.length,
    readUnmodelledStateList: list.map(r => ({ id: r.id, name: r.name, firstSeenOn: r.on })),
    rows,
  };
}

/* THE CAVEATS THIS ARTIFACT CARRIES, EACH CHECKED AGAINST THE REGISTER BEFORE IT IS PUBLISHED.
 *
 * `roadmapRowIsClosed` is IMPORTED from engine/quarantine.js and never copied: CLAUDE.md's rule is
 * that two files deciding one fact disagree eventually and the disagreement is invisible because both
 * keep working, and this repository has already paid for that detector twice.
 *
 * A row that cannot be found in docs/ROADMAP.md is NOT treated as open. It is WITHHELD and says why,
 * because "the register says this is still broken" and "I could not find the register" are the two
 * answers this file exists to keep apart. */
const CAVEATS = [{
  row: 244,
  what: 'board.movePower builds no side.totalFainted, so Last Respects is scored at its printed floor in every FEATURE MAG ranks with, whatever the position says',
  whyNotFixed: 'it moves fitted feature values. engine/feature_fixture.js\'s 58 per-feature column hashes MOVE when movePower\'s callback path is disabled — measured, not argued — so a fix here owes data/policy-weights.json a refit, and the refit is gated behind MEDICHAM by Will\'s own instruction',
}];
function openAndNotFixed() {
  const Q = require(D('engine', 'quarantine.js'));
  let lines = null;
  try { lines = fs.readFileSync(D('docs', 'ROADMAP.md'), 'utf8').split(/\r?\n/); }
  catch (e) {
    /* ROADMAP #258 — the null is what makes every caveat WITHHELD below, which is the right answer;
     * it is said out loud so an unreadable register cannot look like a register with nothing in it. */
    lines = null;
    console.error('  docs/ROADMAP.md COULD NOT BE READ — ' + String((e && e.message) || e).split(String.fromCharCode(10))[0]
                + '; every caveat in this artifact is WITHHELD rather than published unchecked');
  }
  const rows = [], dropped = [];
  for (const c of CAVEATS) {
    if (!lines) {
      dropped.push({ row: c.row, why: 'docs/ROADMAP.md could not be read, so this caveat is WITHHELD rather than published on an unchecked premise' });
      continue;
    }
    const l = lines.find(x => new RegExp('^\\|\\s*#' + c.row + '\\s*\\|').test(x));
    if (!l) {
      dropped.push({ row: c.row, why: 'no such row in docs/ROADMAP.md, so the premise of this caveat cannot be checked and it is WITHHELD' });
      continue;
    }
    if (Q.roadmapRowIsClosed(l)) {
      dropped.push({ row: c.row, why: 'the register reads this row CLOSED — the caveat outlived what it described and is dropped, not annotated' });
      continue;
    }
    rows.push(c);
  }
  return { checkedAgainst: 'docs/ROADMAP.md via quarantine.roadmapRowIsClosed', rows, dropped };
}

const out = {
  generated: new Date().toISOString(),
  by: 'engine/seed_source_audit.js',
  what: 'every derived table on the seeding path, audited against the regulation — ROADMAP #282 and the open remainder of #244',
  format: CS.FORMAT,
  notQuarantined: 'opens a Dex and plays no game — no battleInit, no rollout, no store — so it is not downstream of MEDICHAM',
  volatileDurationTable: auditDurations(),
  basePowerCallbackClass: auditBasePower(),
  /* SAID IN THE ARTIFACT AND NOT ONLY IN A LEDGER, because a caveat that lives in prose is the
   * failure this repository has documented more times than any other — AND THE OPEN/CLOSED STATE IS
   * NOW READ FROM THE REGISTER RATHER THAN TYPED HERE (ROADMAP #287). This block asserted that #244's
   * remainder was unfixed pending a refit; #244 read CLOSED to the register's own detector from the
   * moment #283 landed, so the artifact was asserting a closed row was open — a caveat that outlived
   * what it described, which is the fourteen-stale-handoffs shape wearing a JSON key. The CAVEAT TEXT
   * is authored; the STATE is derived, and a caveat whose row has closed is dropped and says so. */
  openAndNotFixed: openAndNotFixed(),
};

const dest = D('data', 'seed-source-audit.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2));

const V = out.volatileDurationTable, P = out.basePowerCallbackClass;
console.log('\nSEED SOURCE AUDIT\n');
console.log(`  #282  the format holds ${V.movesLegal} legal moves of ${V.movesExist} that exist;`
  + ` the walk now skips ${V.counters.illegalSkipped}`);
console.log(`        keys ${V.keysBefore} -> ${V.keysAfter}`);
for (const c of V.correctedValues) console.log(`        CORRECTED  ${c.key}: ${c.before} -> ${c.after}`);
console.log(`        ${V.keysWithNoLegalCarrier} key(s) had no legal carrier at all and are now unreachable`);
console.log(`        ${V.counters.fromCallback} duration(s) computed by the authority, `
  + `${V.counters.callbackThrew} refused (${Object.keys(V.counters.callbackThrewKeys).join(',') || 'none'}), `
  + `${V.counters.ambiguous} ambiguous`);
console.log(`\n  #244  ${P.legalCallbackMoves} legal moves carry a basePowerCallback;`
  + ` ${P.readUnmodelledState} CANNOT PRODUCE A NUMBER against board.movePower's stub`
  + ` (DERIVED by asking the callbacks, union over ${P.boardsInTheUnion} boards — ROADMAP #287)`);
if (P.boardUnionIncomplete) console.log(`        BOARD UNION INCOMPLETE — ${P.boardUnionIncomplete}`);
for (const r of P.readUnmodelledStateList) console.log(`        ${r.id.padEnd(18)} ${r.name} — the callback cannot produce a number (first seen on ${r.firstSeenOn})`);
console.log(`        (${P.fellThroughOnACleanBoard} returned the printed value on a clean board — an`
  + ' UPPER bound: some of those are correct)');
for (const c of out.openAndNotFixed.rows) {
  console.log(`\n  OPEN #${c.row} — ${c.what}`);
  console.log(`  NOT FIXED — ${c.whyNotFixed}`);
}
for (const d of out.openAndNotFixed.dropped) console.log(`\n  CAVEAT DROPPED #${d.row} — ${d.why}`);
if (!out.openAndNotFixed.rows.length && !out.openAndNotFixed.dropped.length) console.log('\n  no standing caveats');
console.log(`\n  wrote ${path.relative(D('.'), dest)}\n`);
