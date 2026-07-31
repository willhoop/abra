/* CHOICE LOCK — the choice SET, not the choice score.
 *
 * Will, 2026-07-31: "LIKE CHOICE MONS ONLY GET SWITCH OR ATTACK AFTER SELECTION THATS EASY" and
 * "YOU ARENT CHOICE LOCKED ON TURN 1 OBVIOUSLY".
 *
 * A Pokemon holding a Choice item may only repeat the move it last used. Live play was never wrong
 * about this — magnemite.js takes its candidates from the request, which marks the rest `disabled`.
 * FITTING was: fit_policy.js hands candidates() all four sheet moves with no legality filter, so a
 * choice-locked human looked like they had ~9 options when they had 4, and the conditional logit
 * divided by a denominator containing actions that were never available. 6.52% of items here.
 *
 * Four things are asserted, and the third is the one that makes this cheap rather than fiddly:
 *
 *   1. LOCKED. A Choice item plus a last move leaves only that move (plus switches).
 *   2. TURN ONE IS FREE, with no turn counter anywhere. `switchIn` starts every arrival with
 *      `lastMove: ''`, so "has not moved since arriving" is already tracked and the rule falls out.
 *   3. THE ITEM MUST BE A CHOICE ITEM. A Life Orb with a last move locks nothing — this is what
 *      separates a real implementation from one that fires on any item.
 *   4. SWITCHES SURVIVE THE LOCK. Being stuck on a bad move is a reason TO leave, so narrowing the
 *      move list must not narrow the switch list.
 *
 * The items are read from the dex's `isChoice` flag rather than named in board.js; this test names
 * them because a test is allowed to state the case it is about.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const B = require(path.join(ROOT, 'engine', 'board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};

console.log('CHOICE LOCK — the choice SET\n');

/* A board with one of mine out and one foe, plus two on my bench so switches exist. */
function mk(item, lastMove, bench) {
  const b = new B.Board();
  b.turn = 4;
  const me = { species: 'garchomp', hp: 1, boosts: {}, status: '', fainted: false,
    nature: 'Jolly', item, ability: '', moves: [], lastMove, turnsActive: 3 };
  b.sides.p1.active = { a: me };
  b.sides.p2.active = { a: { species: 'incineroar', hp: 1, boosts: {}, status: '', fainted: false,
    nature: '', item: '', ability: '', moves: [] } };
  b.party.p1 = ['garchomp', ...(bench || ['rillaboom', 'amoonguss'])];
  b.party.p2 = ['incineroar'];
  return { board: b, user: me };
}

/* Four real moves with different targeting shapes, so the count is not an artefact of one kind. */
const MOVES = ['earthquake', 'dragonclaw', 'protect', 'stealthrock'];
const cands = (item, lastMove) => {
  const { board, user } = mk(item, lastMove);
  return B.candidates(MOVES, user, board, 'p1', dex);
};
const moveIds = cs => [...new Set(cs.filter(c => c.move).map(c => c.move.id))].sort();
const switches = cs => cs.filter(c => c.switchTo).length;

/* ---- 1. LOCKED ------------------------------------------------------------------------------ */
console.log('1. a Choice item plus a last move narrows the move list to that move');
for (const item of ['choiceband', 'choicespecs', 'choicescarf']) {
  const got = moveIds(cands(item, 'dragonclaw'));
  ok(got.length === 1 && got[0] === 'dragonclaw',
    `${item}: only the locked move survives`, JSON.stringify(got));
}
/* Protect is gone with the rest — a locked Pokemon cannot click it. */
ok(!moveIds(cands('choiceband', 'dragonclaw')).includes('protect'),
  'Protect is removed too, not kept as a special case');

/* ---- 2. TURN ONE IS FREE -------------------------------------------------------------------- */
console.log('\n2. not locked on the turn it arrives — and no turn counter is consulted');
const fresh = moveIds(cands('choiceband', ''));
ok(fresh.length === MOVES.length,
  'a Choice item with NO last move leaves every move available', `${fresh.length} of ${MOVES.length}`);
/* The rule is carried by lastMove alone. A mon that switched out and back has an empty lastMove
 * again, which is the same case and needs no extra state. */
ok(moveIds(cands('choiceband', '')).includes('protect'),
  'including Protect, on the turn it comes in');

/* ---- 3. IT MUST BE A CHOICE ITEM ------------------------------------------------------------- */
console.log('\n3. the lock is the ITEM, not merely having moved');
for (const item of ['lifeorb', 'leftovers', 'focussash', '']) {
  const got = moveIds(cands(item, 'dragonclaw'));
  ok(got.length === MOVES.length,
    `${item || '(no item)'}: a last move alone locks nothing`, `${got.length} of ${MOVES.length}`);
}
/* And the flag is the dex's, not a list here. If a future regulation adds a Choice item this test
 * keeps meaning the same thing without an edit. */
const flagged = [...dex.items.all()].filter(i => i.isChoice).map(i => i.id).sort();
ok(flagged.length >= 3, 'the dex is the source of which items are Choice items', flagged.join(', '));

/* ---- 4. SWITCHES SURVIVE --------------------------------------------------------------------- */
console.log('\n4. being locked does not remove the option to leave');
const lockedC = cands('choiceband', 'dragonclaw');
const freeC = cands('choiceband', '');
ok(switches(lockedC) > 0, 'a locked Pokemon still has switch candidates', `${switches(lockedC)}`);
ok(switches(lockedC) === switches(freeC),
  'and exactly as many as an unlocked one — the lock narrows moves only',
  `${switches(lockedC)} vs ${switches(freeC)}`);

/* ---- 5. THE SIZE OF THE EFFECT, measured rather than asserted -------------------------------- */
console.log('\n5. how much the choice SET shrinks');
console.log(`     unlocked: ${freeC.length} candidates   locked: ${lockedC.length} candidates`);
ok(lockedC.length < freeC.length, 'the denominator genuinely shrinks',
  `${freeC.length} -> ${lockedC.length}`);

console.log(`\n${fails ? fails + ' FAILED' : 'all passed'}`);
process.exit(fails ? 1 : 0);
