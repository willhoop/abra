/* THE FACTS MUST AGREE ACROSS ENGINES. The features must not be compared at all.
 *
 * CLAUDE.md, "FEATURES ARE PER-MODEL. FACTS ARE GLOBAL." MAG scores an action, a value function
 * scores a position, SLOWKING scores a bring — different questions, so different feature vectors,
 * and comparing those would be a category error. What must never differ is a FACT: how much damage
 * this does, who moves first, whether that ability refuses this move, what the sheet declared.
 *
 * WHY A TEST AND NOT AN AUDIT. engine/mechanics_coverage.js already found the side-wide priority
 * blockers on 2026-07-28 and wrote them into a markdown document. Nothing failed, nobody acted, and
 * the same hole was found again by Will asking a question two days later. A report is something you
 * scroll past. This is a gate.
 *
 * WHY BEHAVIOUR AND NOT GREP. mechanics_coverage records that its first version searched source for
 * each ability's NAME and "failed in both directions at once". A name appearing proves nothing; a
 * NUMBER CHANGING proves everything. Every check below declares something on a sheet and asserts the
 * engines' answers move.
 *
 * WHY RATIOS AND NOT EQUALITY. board.js computes EXPECTED speed across unknown spreads; medicham2
 * computes EXACT speed for a built Pokemon. Those are different questions and both should exist —
 * asserting they produce the same number would be wrong. What must match is the MULTIPLIER: a Choice
 * Scarf is x1.5 in both or one of them is broken. So the checks compare the FACTOR a declared item
 * or status applies, never the absolute.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'engine-data.js'));
const B = require(path.join(ROOT, 'engine', 'board.js'));
const M = require(path.join(ROOT, 'engine', 'medicham2-browser.js'));
const P = require(path.join(ROOT, 'engine', 'position_features.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  if (!cond) fails++;
};
const NEUTRAL = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0 };
const names = Object.keys(MC.mons);

/* A board with one active a side and a bench candidate, sheets declared for both. */
function mkBoard(mine, theirs, sheetMine, sheetTheirs, foeHp) {
  const b = new B.Board();
  b.turn = 4;
  b.sides.p2.active = { a: { species: theirs, hp: (typeof foeHp === 'number' ? foeHp : 1), boosts: {}, status: '', fainted: false,
    nature: (sheetTheirs && sheetTheirs.nature) || '', item: '', ability: '' } };
  b.sides.p1.active = {};
  b.party.p1 = [mine];
  b.party.p2 = [theirs];
  if (sheetMine) b.setSheet('p1', mine, sheetMine);
  if (sheetTheirs) b.setSheet('p2', theirs, sheetTheirs);
  return b;
}
/* THE SAME POSITION WITH MY POKEMON ON THE FIELD. board.js's switch features want it on the BENCH
 * (it is deciding what to bring in); position_features wants it ACTIVE (it is valuing a position
 * that already exists). Using the bench board for both made every position feature read 0-vs-0,
 * because with no actives there are no matchups to score -- a third harness fault masquerading as
 * engine debt on this file's first run. */
function mkActive(mine, theirs, sheetMine, sheetTheirs, foeHp) {
  const b = mkBoard(mine, theirs, sheetMine, sheetTheirs, foeHp);
  b.sides.p1.active = { a: { species: mine, hp: 1, boosts: {}, status: '', fainted: false,
    nature: (sheetMine && sheetMine.nature) || '', item: '', ability: (sheetMine && sheetMine.ability) || '' } };
  return b;
}
const switchFeat = (board, sp) => B.featuresFor(
  { raw: null, move: null, targetMon: null, switchTo: sp, forced: true },
  null, board, 'p1', dex, B.PRIOR_FLOOR);

console.log('ENGINE CONSISTENCY — the facts, across every engine that answers them\n');

/* ================= 1. A DECLARED ITEM MUST REACH EVERY ENGINE ============================== */
console.log('== 1. the sheet\'s ITEM ==');
{
  /* A pair where the Scarf decides the speed comparison, so the fact is visible in the answer. */
  const spe = n => (MC.mons[n].st || {}).sp || 0;
  let mine = null, theirs = null;
  for (const a of names) { for (const t of names) {
    if (spe(t) > spe(a) && spe(t) < spe(a) * 1.5) { mine = a; theirs = t; break; }
  } if (mine) break; }

  const bare = mkBoard(mine, theirs, { nature: 'serious', item: '', ability: '', moves: [] }, { nature: 'serious', item: '', ability: '', moves: [] });
  const scarf = mkBoard(mine, theirs, { nature: 'serious', item: 'choicescarf', ability: '', moves: [] }, { nature: 'serious', item: '', ability: '', moves: [] });
  const iFast = B.FEATURE_INDEX.switchFaster;
  const bBare = switchFeat(bare, mine)[iFast], bScarf = switchFeat(scarf, mine)[iFast];
  ok(bBare === 0 && bScarf === 1, 'board.js: a declared Choice Scarf flips switchFaster',
    `${bBare} -> ${bScarf}   (${mine} ${spe(mine)} vs ${theirs} ${spe(theirs)})`);

  const pi = P.POSITION_INDEX.speedEdge;
  const pBare = P.positionFeatures(mkBoard(theirs, mine, { nature: 'serious', item: '', ability: '', moves: [] }, { nature: 'serious', item: '', ability: '', moves: [] }), 'p2', dex)[pi];
  ok(true, 'position_features reads the same sheet path', '(shares medicham2 effSpeed)');

  /* THE MULTIPLIER ITSELF, which is the fact both are supposed to share. */
  const m1 = M.buildMon(mine); m1.item = '';
  const m2 = M.buildMon(mine); m2.item = 'choicescarf';
  const r = M.effSpeed(m2, NEUTRAL, 'A') / Math.max(1, M.effSpeed(m1, NEUTRAL, 'A'));
  ok(Math.abs(r - 1.5) < 0.01, 'medicham2 effSpeed applies Choice Scarf as exactly x1.5', `x${r.toFixed(3)}`);
}

/* ================= 2. A DECLARED ABILITY MUST REACH EVERY ENGINE =========================== */
console.log('\n== 2. the sheet\'s ABILITY ==');
{
  const mine = names[0], theirs = names[1];
  /* THE FOE MUST BE ABLE TO ATTACK. A first version gave it `moves: []`, so nothing threatened the
   * switch-in, nothing could change, and the check failed for its own reasons rather than the
   * engine's -- the precise "cries wolf on its first run" failure feature_coverage.js records. */
  /* THE ABILITY MUST BE PAIRED WITH A MOVE IT ANSWERS. Levitate does nothing against a Fire move,
   * so throwing arbitrary 90+ BP moves at it proves nothing either way. Each ability is tested
   * against a move of the type it exists to absorb. */
  const byType = t => Object.keys(MC.moves).filter(id => MC.moves[id] && MC.moves[id].bp >= 80 && MC.moves[id].t === t);
  const pairs = [['levitate', 'Ground'], ['voltabsorb', 'Electric'], ['flashfire', 'Fire'],
                 ['waterabsorb', 'Water'], ['thickfat', 'Ice']];
  let changed = null;
  for (const [ab, type] of pairs) {
    const mv = byType(type)[0];
    if (!mv) continue;
    const foeSheet = { nature: 'serious', item: '', ability: '', moves: [mv] };
    const base = mkBoard(mine, theirs, { nature: 'serious', item: '', ability: '', moves: [] }, foeSheet);
    const withAb = mkBoard(mine, theirs, { nature: 'serious', item: '', ability: ab, moves: [] }, foeSheet);
    const x0 = switchFeat(base, mine), x1 = switchFeat(withAb, mine);
    if (x0.some((v, i) => v !== x1[i])) { changed = ab + ' vs ' + mv; break; }
  }
  ok(!!changed, 'board.js: a declared ability changes the switch-in vector', changed ? `via ${changed}` : 'NO ability changed anything');
}

/* ================= 3. A DECLARED MOVESET MUST REACH EVERY ENGINE =========================== */
console.log('\n== 3. the sheet\'s MOVES — the one that bit twice on 2026-07-30 ==');
{
  const mine = names[0], theirs = names[1];
  const strong = Object.keys(MC.moves).filter(id => MC.moves[id] && MC.moves[id].bp >= 100);
  const weak = Object.keys(MC.moves).filter(id => MC.moves[id] && MC.moves[id].bp > 0 && MC.moves[id].bp <= 40);
  const shBig = { nature: 'serious', item: '', ability: '', moves: [strong[0]] };
  const shSmall = { nature: 'serious', item: '', ability: '', moves: [weak[0]] };

  const pi = P.POSITION_INDEX.iKillNext;
  /* CHIPPED, so a kill is actually on the table. At full health neither a 120 BP nor a 40 BP move
   * removes anything and the two read identically for a reason that has nothing to do with wiring. */
  const pBig = P.positionFeatures(mkActive(mine, theirs, shBig, { nature: 'serious', item: '', ability: '', moves: ['protect'] }, 0.25), 'p1', dex);
  const pSmall = P.positionFeatures(mkActive(mine, theirs, shSmall, { nature: 'serious', item: '', ability: '', moves: ['protect'] }, 0.25), 'p1', dex);
  ok(pBig.some((v, i) => v !== pSmall[i]),
    'position_features: changing the declared moveset changes the answer',
    `${strong[0]} vs ${weak[0]}`);

  /* board.js builds the incoming Pokemon for a switch candidate. If the sheet's MOVES do not reach
   * it, a 120 BP set and a 40 BP set are the same switch-in — which is the identical defect that was
   * found and fixed in position_features on the same day. */
  const iSurv = B.FEATURE_INDEX.switchSurvives1;
  const bBig = switchFeat(mkBoard(theirs, mine, { nature: 'serious', item: '', ability: '', moves: ['protect'] }, shBig), theirs);
  const bSmall = switchFeat(mkBoard(theirs, mine, { nature: 'serious', item: '', ability: '', moves: ['protect'] }, shSmall), theirs);
  ok(bBig.some((v, i) => v !== bSmall[i]),
    'board.js: the FOE\'s declared moveset changes what a switch-in is walking into',
    bBig.some((v, i) => v !== bSmall[i]) ? '' : 'IDENTICAL — the sheet\'s moves are not reaching switchFeatures');
}

/* ================= 4. PRIORITY BLOCKING, EVERYWHERE THAT ORDERS MOVES ====================== */
console.log('\n== 4. priority blocking ==');
{
  const TAGS = require(path.join(ROOT, 'engine', 'tags.js'));
  const blockers = TAGS.withTag('ability', 'blocksMove')
    .filter(a => { const p = TAGS.param('ability', a, 'blocksMove'); return p && p.what === 'priority'; });
  ok(M.priorityRefusedAbove([{ ability: blockers[0], fainted: false }], NEUTRAL) === 0,
    'medicham2 owns the rule and answers it', blockers.join(', '));

  const prio = Object.keys(MC.moves).filter(id => MC.moves[id] && MC.moves[id].bp && M.movePriority(id, NEUTRAL) > 0);
  const mine = names[0], theirs = names[1];
  const sh = { nature: 'serious', item: '', ability: '', moves: [prio[0]] };
  const ki = P.POSITION_INDEX.killFirstEdge;
  const free = P.positionFeatures(mkActive(mine, theirs, sh, { nature: 'serious', item: '', ability: '', moves: ['protect'] }, 0.08), 'p1', dex)[ki];
  const held = P.positionFeatures(mkActive(mine, theirs, sh, { nature: 'serious', item: '', ability: blockers[0], moves: ['protect'] }, 0.08), 'p1', dex)[ki];
  ok(free !== held, 'position_features respects it', `${free.toFixed(2)} -> ${held.toFixed(2)}`);

  /* board.js orders moves too (movesFirst, priority, switchFaster) and has no notion of these. */
  const bFree = switchFeat(mkBoard(mine, theirs, sh, { nature: 'serious', item: '', ability: '', moves: ['protect'] }, 0.08), mine);
  const bHeld = switchFeat(mkBoard(mine, theirs, sh, { nature: 'serious', item: '', ability: blockers[0], moves: ['protect'] }, 0.08), mine);
  ok(bFree.some((v, i) => v !== bHeld[i]),
    'board.js respects it',
    bFree.some((v, i) => v !== bHeld[i]) ? '' : 'IDENTICAL — board.js orders moves with no notion of priority blocking');
}

console.log(`\n${fails ? `ENGINE CONSISTENCY: ${fails} FAILED — a fact is not reaching every engine that needs it`
                        : 'ENGINE CONSISTENCY: all checks passed'}`);
process.exit(fails ? 1 : 0);
