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
const STUB_HAS_NO = ['totalFainted', 'sideConditions', 'activeTurns', 'lastDamage', 'moveThisTurn',
                     'abilityState', 'faintQueue', 'queue', 'activeMove', 'newlySwitched',
                     'statsRaisedThisTurn', 'hurtThisTurn', 'stockpile', 'allies', 'battle'];
function auditBasePower() {
  const bd = new B.Board();
  const pool = Object.keys(globalThis.MC.mons).slice(0, 4);
  bd.setParty('p1', pool.slice(0, 2)); bd.setParty('p2', pool.slice(2, 4));
  bd.switchIn('p1', 'a', pool[0]); bd.switchIn('p2', 'a', pool[2]);
  const u = bd.slot('p1', 'a'), t = bd.slot('p2', 'a');

  const rows = [];
  for (const m of dex.moves.all()) {
    if (!legal(m) || typeof m.basePowerCallback !== 'function') continue;
    const src = String(m.basePowerCallback);
    const reads = STUB_HAS_NO.filter(k => src.includes(k));
    const got = B.movePower(m, bd, dex, u, t);
    rows.push({ id: m.id, name: m.name, printed: m.basePower || 0, computed: got,
                fellThrough: got === (m.basePower || 0), unmodelledReads: reads });
  }
  return {
    legalCallbackMoves: rows.length,
    fellThroughOnACleanBoard: rows.filter(r => r.fellThrough).length,
    readUnmodelledState: rows.filter(r => r.unmodelledReads.length).length,
    readUnmodelledStateList: rows.filter(r => r.unmodelledReads.length)
      .map(r => ({ id: r.id, reads: r.unmodelledReads })),
    rows,
  };
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
   * failure this repository has documented more times than any other. */
  openAndNotFixed: {
    row: 244,
    what: 'board.movePower builds no side.totalFainted, so Last Respects is scored at its printed floor in every FEATURE MAG ranks with, whatever the position says',
    whyNotFixed: 'it moves fitted feature values. engine/feature_fixture.js\'s 58 per-feature column hashes MOVE when movePower\'s callback path is disabled — measured, not argued — so a fix here owes data/policy-weights.json a refit, and the refit is gated behind MEDICHAM by Will\'s own instruction',
  },
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
  + ` ${P.readUnmodelledState} read state board.movePower's stub does not build`);
for (const r of P.readUnmodelledStateList) console.log(`        ${r.id.padEnd(18)} ${r.reads.join(' ')}`);
console.log(`        (${P.fellThroughOnACleanBoard} returned the printed value on a clean board — an`
  + ' UPPER bound: some of those are correct)');
console.log(`\n  OPEN — ${out.openAndNotFixed.what}`);
console.log(`  NOT FIXED — ${out.openAndNotFixed.whyNotFixed}`);
console.log(`\n  wrote ${path.relative(D('.'), dest)}\n`);
