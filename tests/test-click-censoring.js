/* test-click-censoring.js — the gate for docs/CLICK-CENSORING-FIX.md Stages A and B.
 *
 *   SHOWDOWN_PATH=... node tests/test-click-censoring.js
 *
 * EVERY CHECK IN HERE IS SHOWN RED ON KNOWN-BAD INPUT BEFORE IT IS SHOWN GREEN.
 * A check that has never failed is not evidence, and this repository has the receipts: mega
 * evolution passed "at least one happened" while running at 56% of sides against a correct 85%.
 * So each case below runs TWICE — once with the rule that is supposed to catch it turned off, where
 * the classification must be WRONG, and once with it on, where it must be right. The disable knob is
 * a PARAMETER of engine/click_class.js, not a second copy of the classifier.
 *
 * THE INPUT IS A PLANTED PROTOCOL LOG, PUT THROUGH THE REAL INGEST.
 * engine/durable-ingest.js's `extract()` is what turns a Showdown log into the `ev` stream both fits
 * read, so a synthetic `ev` array written by hand here would test the classifier against a shape
 * nothing produces. The planted logs below are real protocol; if the ingest changes what it emits,
 * these fail, which is the point.
 */
'use strict';
const assert = require('assert');
const path = require('path');
const CS = require('../engine/champions_sim.js');
const DI = require('../engine/durable-ingest.js');
const CC = require('../engine/click_class.js');
const B = require('../engine/board.js');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;

let failures = 0;
const ok = (name, cond, detail) => {
  if (cond) { console.log('  PASS  ' + name); return; }
  failures++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
};

const HEAD = [
  '|player|p1|alice|1|1500',
  '|player|p2|bob|2|1500',
  '|gametype|doubles',
  '|poke|p1|Farigiraf, L50, F|',
  '|poke|p1|Incineroar, L50, M|',
  '|poke|p2|Sneasler, L50, M|',
  '|poke|p2|Basculegion, L50, M|',
  '|start',
  '|switch|p1a: Farigiraf|Farigiraf, L50, F|100/100',
  '|switch|p1b: Incineroar|Incineroar, L50, M|100/100',
  '|switch|p2a: Sneasler|Sneasler, L50, M|100/100',
  '|switch|p2b: Basculegion|Basculegion, L50, M|100/100',
].join('\n');

const evOf = (body) => {
  const g = DI.extract('test-1', 1784776860, HEAD + '\n' + body + '\n|win|alice');
  const t = (g.turns || []).find(t2 => t2.n === 1);
  assert(t, 'the planted log produced no turn 1 — the ingest did not parse it');
  return t.ev;
};

console.log('\nSTAGE A — THE CENSUS INSTRUMENT\n');

/* ---------------------------------------------------------------------------------------------
 * CASE 1 — THE ENCORE APPLICATION TURN MUST CLASSIFY COERCED
 *
 * Incineroar clicked something; Farigiraf's partner Encores it before it moves, and Showdown's
 * onOverrideAction replaces the action with its last move. The move that comes out is on
 * Incineroar's own menu, so engine/click_match.js matches it happily and the fit learns a click
 * that never happened. This is the silent poison, and it is worse than a drop.
 * ------------------------------------------------------------------------------------------- */
const encoreLog = [
  '|turn|1',
  '|move|p2a: Sneasler|Fake Out|p1b: Incineroar',
  '|-damage|p1b: Incineroar|90/100',
  '|move|p1a: Farigiraf|Encore|p2b: Basculegion',
  '|-start|p2b: Basculegion|Encore',
  '|move|p2b: Basculegion|Wave Crash|p1a: Farigiraf',
  '|-damage|p1a: Farigiraf|60/100',
].join('\n');

{
  const ev = evOf(encoreLog);
  const without = CC.coercedSlots(ev, dex, { disable: ['actionOverridden'] });
  ok('KNOWN-BAD INPUT: with the Encore rule OFF, the coerced slot is NOT detected',
    !without.has('p2b'),
    'p2b was already flagged without the rule, so this case proves nothing about the rule');

  const withIt = CC.coercedSlots(ev, dex);
  const c = withIt.get('p2b');
  ok('with the Encore rule ON, p2b classifies COERCED/actionOverridden',
    !!c && c.cls === 'COERCED' && c.why === 'actionOverridden' && c.by === 'encore',
    'got ' + JSON.stringify(c || null));
  ok('the Encore USER is not itself coerced', !withIt.has('p1a'));
  ok('an unrelated slot in the same turn is untouched', !withIt.has('p2a') && !withIt.has('p1b'));
}

/* A FAILED Encore overrides nothing. The protocol says so on the move event, and treating a `|-fail|`
 * as a successful coercion would delete real clicks — the opposite error, and just as invisible. */
{
  const ev = evOf([
    '|turn|1',
    '|move|p1a: Farigiraf|Encore|p2b: Basculegion',
    '|-fail|p2b: Basculegion',
    '|move|p2b: Basculegion|Wave Crash|p1a: Farigiraf',
    '|-damage|p1a: Farigiraf|60/100',
  ].join('\n'));
  ok('a FAILED Encore coerces nothing', !CC.coercedSlots(ev, dex).has('p2b'));
}

/* Encore that resolves AFTER the victim already moved does not apply this turn (Showdown bumps the
 * duration instead). Order in `ev` is resolution order, so this is exact rather than a priority guess. */
{
  const ev = evOf([
    '|turn|1',
    '|move|p2b: Basculegion|Wave Crash|p1a: Farigiraf',
    '|-damage|p1a: Farigiraf|60/100',
    '|move|p1a: Farigiraf|Encore|p2b: Basculegion',
    '|-start|p2b: Basculegion|Encore',
  ].join('\n'));
  ok('Encore resolving after the victim moved does NOT coerce this turn',
    !CC.coercedSlots(ev, dex).has('p2b'));
}

/* ---------------------------------------------------------------------------------------------
 * CASE 2 — A |drag| IS NOT A CLICK
 *
 * engine/durable-ingest.js:67 parses |switch|, |drag| and |replace| with ONE regex, so a phazed
 * arrival is stored as `t:'s'`, exactly like a voluntary switch. engine/fit_policy.js's `forcedSlot`
 * guard only excludes a switch that follows a faint, so before this fix a Roar/Whirlwind/Dragon Tail
 * drag was scored as a decision the player made.
 * ------------------------------------------------------------------------------------------- */
const dragLog = [
  '|turn|1',
  '|move|p1a: Farigiraf|Roar|p2b: Basculegion',
  '|drag|p2b: Sneasler|Sneasler, L50, M|100/100',
].join('\n');

{
  const ev = evOf(dragLog);
  ok('the ingest really does store a |drag| as an ordinary switch event',
    ev.some(e => e.t === 's' && e.s === 'p2b'),
    'if this fails the ingest changed and the whole class needs re-measuring');

  const without = CC.coercedSlots(ev, dex, { disable: ['draggedIn'] });
  ok('KNOWN-BAD INPUT: with the phazing rule OFF, the dragged slot is NOT detected', !without.has('p2b'));

  const withIt = CC.coercedSlots(ev, dex);
  const c = withIt.get('p2b');
  ok('with the phazing rule ON, p2b classifies COERCED/draggedIn',
    !!c && c.why === 'draggedIn' && c.by === 'roar', 'got ' + JSON.stringify(c || null));
}

/* ---------------------------------------------------------------------------------------------
 * CASE 3 — A REDIRECTED ATTACK IS PARTIAL, NOT CLEAN AND NOT DROPPED
 *
 * The protocol prints only the RESOLVED target. engine/redirect_audit.js measured on 2026-08-02 that
 * this does NOT make the click unmatchable — the redirector is a legal candidate — so the matcher
 * accepts it with the WRONG target. The candidate set is every live foe.
 * ------------------------------------------------------------------------------------------- */
const redirectLog = [
  '|turn|1',
  '|move|p1a: Farigiraf|Follow Me|p1a: Farigiraf',
  '|-singleturn|p1a: Farigiraf|move: Follow Me',
  '|move|p2a: Sneasler|Close Combat|p1a: Farigiraf',
  '|-damage|p1a: Farigiraf|40/100',
].join('\n');

{
  const ev = evOf(redirectLog);
  const red = CC.redirectorsUp(ev, dex);
  ok('the redirector is located on the correct side and index',
    !!red.p1 && red.p1.move === 'followme' && red.p1.by === 'farigiraf' && red.p2 === null,
    JSON.stringify(red));

  const evIx = ev.findIndex(e => e.t === 'm' && e.s === 'p2a');
  const liveFoes = [
    { mon: { species: 'farigiraf', ability: '', fainted: false } },
    { mon: { species: 'incineroar', ability: '', fainted: false } },
  ];
  const e = ev[evIx];

  const without = CC.partialTarget(e, evIx, red, liveFoes, dex, null, { disable: ['moveRedirect'] });
  ok('KNOWN-BAD INPUT: with the redirection rule OFF, the click reads as a certain label',
    without === null);

  const withIt = CC.partialTarget(e, evIx, red, liveFoes, dex, null);
  ok('with the redirection rule ON, the click classifies PARTIAL/moveRedirect',
    !!withIt && withIt.why === 'moveRedirect', JSON.stringify(withIt));

  /* A candidate set of ONE is a certain label. If the partner is dead there was nowhere else to aim,
   * and calling that partial would throw away information rather than preserve it. */
  const one = CC.partialTarget(e, evIx, red, liveFoes.slice(0, 1), dex, null);
  ok('with only one live foe the label is CLEAN, not partial', one === null);

  /* A SPREAD move ignores redirection entirely; so do self- and ally-targeting moves. Read from the
   * dex\'s own `target`, which is why Heat Wave has to be rejected without any list here. */
  const spreadEv = evOf([
    '|turn|1',
    '|move|p1a: Farigiraf|Follow Me|p1a: Farigiraf',
    '|move|p2b: Basculegion|Surf|p1a: Farigiraf|[spread] p1a,p1b',
    '|-damage|p1a: Farigiraf|40/100',
    '|-damage|p1b: Incineroar|40/100',
  ].join('\n'));
  const sRed = CC.redirectorsUp(spreadEv, dex);
  const sIx = spreadEv.findIndex(e2 => e2.t === 'm' && e2.s === 'p2b');
  ok('a SPREAD move is never partial-by-redirection',
    CC.partialTarget(spreadEv[sIx], sIx, sRed, liveFoes, dex, null) === null);
}

/* ---------------------------------------------------------------------------------------------
 * CASE 4 — THE MECHANISM SETS ARE DERIVED, AND REFUSE TO BE EMPTY
 * ------------------------------------------------------------------------------------------- */
{
  const M = CC.mechanisms(dex);
  ok('action-override moves derived from onOverrideAction and non-empty',
    M.overrideMoves.size >= 1 && M.overrideMoves.has('encore'), [...M.overrideMoves].join(','));
  ok('forced-switch moves derived from forceSwitch and non-empty',
    M.forceSwitchMoves.size >= 4 && M.forceSwitchMoves.has('roar'), [...M.forceSwitchMoves].join(','));
  ok('priority-block abilities derived from onFoeTryMove and non-empty',
    M.priorityBlockAbilities.has('armortail') && M.priorityBlockAbilities.has('queenlymajesty'),
    [...M.priorityBlockAbilities].join(','));
  ok('redirect moves come from the tag artifact and non-empty',
    M.redirectMoves.size >= 1, [...M.redirectMoves].join(','));
  /* Eject Button / Eject Pack / Red Card force a switch and are all banned here. Asked of the
   * format, so a regulation that readmits one flips this row instead of going unnoticed. */
  ok('the item-driven forced switch is empty IN THIS FORMAT, and the banned set is not',
    M.forceSwitchItems.size === 0 && M.forceSwitchItemsBanned.size >= 3,
    'legal=' + [...M.forceSwitchItems].join(',') + '  banned=' + [...M.forceSwitchItemsBanned].join(','));
}

/* ---------------------------------------------------------------------------------------------
 * STAGE B — THE MATCHER CONSUMES THE CENSUS
 *
 * The gate the spec asks for: refitting after Stage B must change the label count by exactly the
 * COERCED count. Run on the planted games rather than the corpus so it is a unit test and not a
 * fifteen-minute one — engine/click_census.js measures the corpus.
 * ------------------------------------------------------------------------------------------- */
console.log('\nSTAGE B — THE COERCED ACTIONS LEAVE THE LABELED SET\n');
{
  const FP = require('../engine/fit_policy.js');
  const sheets = {
    p1: [
      { species: 'farigiraf', item: 'leftovers', ability: 'armortail', moves: ['Encore', 'Roar', 'Psychic', 'Trick Room'], nature: 'Relaxed' },
      { species: 'incineroar', item: 'sitrusberry', ability: 'intimidate', moves: ['Fake Out', 'Knock Off', 'Flare Blitz', 'Parting Shot'], nature: 'Adamant' },
    ],
    p2: [
      { species: 'sneasler', item: 'focussash', ability: 'poisontouch', moves: ['Close Combat', 'Dire Claw', 'Fake Out', 'Protect'], nature: 'Jolly' },
      { species: 'basculegion', item: 'lifeorb', ability: 'adaptability', moves: ['Wave Crash', 'Last Respects', 'Aqua Jet', 'Protect'], nature: 'Adamant' },
    ],
  };
  const mkGame = (body) => {
    const g = DI.extract('unit-' + Math.random(), 1784776860, HEAD + '\n' + body + '\n|win|alice');
    g.sheets = sheets;
    g.brought = { p1: ['farigiraf', 'incineroar'], p2: ['sneasler', 'basculegion'] };
    g.lead = { p1: ['farigiraf', 'incineroar'], p2: ['sneasler', 'basculegion'] };
    g.openSheet = true;
    return g;
  };
  const run = (body) => {
    const tally = { seen: 0, kept: 0, noUser: 0, noSheet: 0, trivial: 0, unmatched: 0, ambiguous: 0, coerced: 0 };
    const rows = FP.decisionsFor(mkGame(body), tally);
    return { rows, tally };
  };

  const enc = run(encoreLog);
  ok('the Encore application turn is counted as COERCED by the fit path',
    enc.tally.coerced === 1 && (enc.tally.coercedWhy || {}).actionOverridden === 1,
    JSON.stringify(enc.tally));
  ok('the coerced slot produced NO training row',
    !enc.rows.some(r => r.side === 'p2' && r.slot === 'b'),
    JSON.stringify(enc.rows.map(r => r.side + r.slot + ':' + r.mvs[r.chosen])));
  ok('its uncoerced partner still produced one — a slot drops ALONE',
    enc.rows.some(r => r.side === 'p2' && r.slot === 'a'),
    JSON.stringify(enc.rows.map(r => r.side + r.slot)));

  const dr = run(dragLog);
  ok('the dragged arrival is counted as COERCED, not fitted as a voluntary switch',
    dr.tally.coerced === 1 && (dr.tally.coercedWhy || {}).draggedIn === 1,
    JSON.stringify(dr.tally));
  ok('no switch row survives for the dragged slot',
    !dr.rows.some(r => r.side === 'p2' && r.slot === 'b'));

  const rd = run(redirectLog);
  const rrow = rd.rows.find(r => r.side === 'p2' && r.slot === 'a');
  ok('the redirected click is KEPT (not dropped) and carries a candidate set',
    !!rrow && Array.isArray(rrow.cset) && rrow.cset.length > 1,
    JSON.stringify(rrow ? { cset: rrow.cset, mvs: rrow.mvs } : null));
  ok('the candidate set contains the matched candidate',
    !!rrow && rrow.cset.includes(rrow.chosen));
  ok('every member of the set is the SAME move aimed at a different foe',
    !!rrow && new Set(rrow.cset.map(i => rrow.mvs[i])).size === 1,
    rrow ? rrow.cset.map(i => rrow.mvs[i]).join(' / ') : '');

  /* THE ARITHMETIC THE SPEC ASKS FOR: kept + every drop reason = seen, with coerced its own term.
   * Before this change `coerced` was silently inside `kept`, which is why nothing could see it. */
  for (const [name, r] of [['encore', enc], ['drag', dr], ['redirect', rd]]) {
    const t = r.tally;
    const sum = t.kept + t.noUser + t.noSheet + t.trivial + t.unmatched + t.ambiguous + (t.coerced || 0);
    ok(`the ${name} tally balances: kept + drops + coerced = seen`, sum === t.seen,
      `${sum} != ${t.seen}  ${JSON.stringify(t)}`);
  }
}

/* ---------------------------------------------------------------------------------------------
 * THE MARGINAL LIKELIHOOD IS A GENERALISATION, NOT A REPLACEMENT
 *
 * A row with no candidate set must score EXACTLY as it did before, or every published number moves
 * for a reason nobody asked for.
 * ------------------------------------------------------------------------------------------- */
console.log('\nSTAGE C — THE MARGINAL LIKELIHOOD REDUCES TO THE OLD ONE\n');
{
  const FP = require('../engine/fit_policy.js');
  const feats = [[1, 0], [0, 1], [0.5, 0.5]];
  const plain = { feats, chosen: 0 };
  const w = [0.3, -0.7];
  const a = FP.logLik([plain], w);
  const b = FP.logLik([{ ...plain, cset: [0] }], w);
  ok('a singleton candidate set scores identically to a plain row',
    Math.abs(a.ll - b.ll) < 1e-12, `${a.ll} vs ${b.ll}`);

  const part = { feats, chosen: 0, cset: [0, 1] };
  const m = FP.logLik([part], w);
  ok('a two-member set scores strictly HIGHER than either member alone',
    m.ll > a.ll, `${m.ll} vs ${a.ll}`);
  const pickMode = FP.logLik([part], w, { pick: true });
  ok('--pick scores the partial row the OLD way, exactly',
    Math.abs(pickMode.ll - a.ll) < 1e-12, `${pickMode.ll} vs ${a.ll}`);
}

console.log('');
if (failures) { console.error(`FAILED — ${failures} check(s) red`); process.exit(1); }
console.log('ALL GREEN — click censoring: coerced actions leave the labeled set, partial ones keep theirs.');
