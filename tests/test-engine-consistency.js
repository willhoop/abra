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
  b.party.p1 = [mine];
  b.party.p2 = [theirs];
  /* SHEETS FIRST, THEN switchIn — the production order, and the whole point. switchIn is what copies
   * the declared nature, item, ability and moves onto an active Pokemon. A test that assigns
   * b.sides.p2.active directly bypasses it and then reports the engine as broken for not seeing data
   * the test never delivered, which is exactly what the first version of this file did. */
  if (sheetMine) b.setSheet('p1', mine, sheetMine);
  if (sheetTheirs) b.setSheet('p2', theirs, sheetTheirs);
  b.switchIn('p2', 'a', theirs);
  if (typeof foeHp === 'number') b.sides.p2.active.a.hp = foeHp;
  return b;
}
/* The same position with my Pokemon on the field too: board.js's switch features want it on the
 * BENCH (deciding what to bring in), position_features wants it ACTIVE (valuing what is there). */
function mkActive(mine, theirs, sheetMine, sheetTheirs, foeHp) {
  const b = mkBoard(mine, theirs, sheetMine, sheetTheirs, foeHp);
  b.switchIn('p1', 'a', mine);
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
  /* THE PAIR IS VERIFIED AGAINST board.js, NOT ASSUMED FROM THE TABLE. Selecting on MC.mons stat
   * lines and then asserting what board.js computes was a category error: board.js scores EXPECTED
   * speed across unknown spreads, a different quantity from the stored line. It agreed only while
   * those lines were inherited; rebuilding them from real open sheets (2026-07-31) broke the
   * coincidence and this read "1 -> 1" — the bare case already counted as faster, so the scarf had
   * nothing to flip and the check could not see the bug it exists for.
   *
   * The candidate is now probed first: keep looking until board.js itself agrees the bare case is
   * the SLOW one. `theirs`/`mine` are reused by the ability check below, so this fixes both. */
  const SHEET = { nature: 'serious', item: '', ability: '', moves: [] };
  let mine = null, theirs = null;
  outer:
  for (const a of names) {
    for (const t of names) {
      if (!(spe(t) > spe(a) && spe(t) < spe(a) * 1.5)) continue;
      const probe = mkBoard(a, t, SHEET, SHEET);
      if (switchFeat(probe, a)[B.FEATURE_INDEX.switchFaster] !== 0) continue;
      mine = a; theirs = t; break outer;
    }
  }
  if (!mine) { ok(false, 'board.js: found a pair whose SCARF decides the speed tie', 'no pair in the table reads as slower-when-bare'); }

  const bare = mkBoard(mine, theirs, { nature: 'serious', item: '', ability: '', moves: [] }, { nature: 'serious', item: '', ability: '', moves: [] });
  const scarf = mkBoard(mine, theirs, { nature: 'serious', item: 'choicescarf', ability: '', moves: [] }, { nature: 'serious', item: '', ability: '', moves: [] });
  const iFast = B.FEATURE_INDEX.switchFaster;
  const bBare = switchFeat(bare, mine)[iFast], bScarf = switchFeat(scarf, mine)[iFast];
  ok(bBare === 0 && bScarf === 1, 'board.js: a declared Choice Scarf flips switchFaster',
    `${bBare} -> ${bScarf}   (${mine} ${spe(mine)} vs ${theirs} ${spe(theirs)})`);

  /* THIS ASSERTED NOTHING UNTIL 2026-07-31. It computed `pBare`, never used it, and then called
   * `ok(true, ...)` — an assertion that cannot fail, describing a claim it did not test. A systems
   * audit found it as the only literal tautology in the suite, which matters because this file's own
   * header says "NUMBER CHANGING proves everything" and this was the one check proving nothing.
   *
   * The claim was TRUE — position_features.js:261 does call M.effSpeed — so nothing was broken. What
   * was missing is a guard that would notice if it STOPPED being true, and line 243 of that file
   * records exactly that regression once already: it "compared raw st.sp while its own comment
   * claimed to use effective speed. It did not." */
  const pi = P.POSITION_INDEX.speedEdge;
  /* mkACTIVE, not mkBoard, and the distinction is the one the comment above mkActive makes: mkBoard
   * leaves my side on the BENCH, which is what board.js's switch features want and the exact wrong
   * shape for position_features. Written with mkBoard first, this read 0.000 -> 0.000 and looked
   * like a live bug; the board simply had no active matchup to have an edge in. Recorded because it
   * is the second time in one day a malformed probe impersonated an engine failure. */
  const pfSheet = (item) => P.positionFeatures(
    mkActive(mine, theirs, { nature: 'serious', item, ability: '', moves: [] },
      { nature: 'serious', item: '', ability: '', moves: [] }), 'p1', dex)[pi];
  const pBare = pfSheet(''), pScarf = pfSheet('choicescarf');
  ok(pBare !== pScarf,
    'position_features: a declared Choice Scarf changes speedEdge (same sheet path as board.js)',
    `${(+pBare).toFixed(3)} -> ${(+pScarf).toFixed(3)}`);

  /* THE MULTIPLIER ITSELF, which is the fact both are supposed to share. */
  const m1 = M.buildMon(mine); m1.item = '';
  const m2 = M.buildMon(mine); m2.item = 'choicescarf';
  const r = M.effSpeed(m2, NEUTRAL, 'A') / Math.max(1, M.effSpeed(m1, NEUTRAL, 'A'));
  ok(Math.abs(r - 1.5) < 0.01, 'medicham2 effSpeed applies Choice Scarf as exactly x1.5', `x${r.toFixed(3)}`);

  /* THE OTHER TWO MULTIPLIERS, which nothing checked until the 2026-07-31 systems audit.
   *
   * CLAUDE.md names three facts that must be one definition: "Scarf x1.5, paralysis x0.5, Tailwind
   * x2". board.js DERIVES all three by calling the dex's own onModifySpe handlers and types no
   * number; medicham2-browser.js HARDCODES all three, because it runs in the browser where the dex
   * is not available. That duplication is not removable, so it needs a check — and the check covered
   * only Scarf, leaving two thirds of the stated rule unguarded.
   *
   * These assert the CONSTANT medicham2 uses, which is the half that can drift silently. board.js's
   * half is guarded by the switchFaster check above: it cannot type a wrong number because it types
   * no number. tag_dex.js:1209 already records Champions diverging from the default full-paralysis
   * rate, so this format demonstrably does move. */
  const parMon = M.buildMon(mine); parMon.status = 'par';
  const wellMon = M.buildMon(mine); wellMon.status = '';
  const rPar = M.effSpeed(parMon, NEUTRAL, 'A') / Math.max(1, M.effSpeed(wellMon, NEUTRAL, 'A'));
  ok(Math.abs(rPar - 0.5) < 0.01, 'medicham2 effSpeed applies paralysis as exactly x0.5', `x${rPar.toFixed(3)}`);

  const twOn = M.buildMon(mine), twOff = M.buildMon(mine);
  const rTw = M.effSpeed(twOn, { twA: 4, twB: 0, tr: 0 }, 'A') /
              Math.max(1, M.effSpeed(twOff, NEUTRAL, 'A'));
  ok(Math.abs(rTw - 2.0) < 0.01, 'medicham2 effSpeed applies Tailwind as exactly x2', `x${rTw.toFixed(3)}`);
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
  /* THIS CHECK SEARCHES FOR ITS OWN CASE rather than borrowing the scarf check's species. It used
   * `mine`/`theirs` from section 1, so it was hostage to a pair chosen for an unrelated reason — and
   * when rebuilding the sets from real sheets moved that pair (to a Venusaur whose typing already
   * blunts the tested move), every ability read as changing nothing and the check reported the
   * WIRING as broken when only the fixture had moved.
   *
   * What it must prove is that a DECLARED ability reaches board.js's switch-in vector at all. That is
   * a property of the engine, so any species demonstrating it is sufficient — and failing only when
   * NO species can demonstrate it is the honest bar. */
  let changed = null;
  search:
  for (const [ab, type] of pairs) {
    const mv = byType(type)[0];
    if (!mv) continue;
    const foeSheet = { nature: 'serious', item: '', ability: '', moves: [mv] };
    for (const cand of names.slice(0, 40)) {
      if (cand === theirs) continue;
      const base = mkBoard(cand, theirs, { nature: 'serious', item: '', ability: '', moves: [] }, foeSheet);
      const withAb = mkBoard(cand, theirs, { nature: 'serious', item: '', ability: ab, moves: [] }, foeSheet);
      const x0 = switchFeat(base, cand), x1 = switchFeat(withAb, cand);
      if (x0.some((v, i) => v !== x1[i])) { changed = `${ab} vs ${mv} on ${cand}`; break search; }
    }
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
  /* THE SWITCH-IN MUST BE FRAIL ENOUGH FOR THE DIFFERENCE TO CROSS A THRESHOLD. switchSurvives1 is
   * binary (worst < 1), so a 120 BP move and a 40 BP move read identically against something that
   * survives both — the vector is coarse by design and a test has to respect that. Using the
   * frailest species in the table so the strong move actually removes it and the weak one does not. */
  const frail = names.slice().sort((a, c) => {
    const st = n => MC.mons[n].st; return st(a).hp * (st(a).df + st(a).sd) - st(c).hp * (st(c).df + st(c).sd);
  })[0];
  /* SEARCH FOR A PAIR THAT CROSSES THE THRESHOLD rather than assuming one does. Measured: Double
   * Edge (120 BP off a 91 Atk) and Acid Spray (40 BP off a 167 SpA) BOTH land between half and all
   * of Pikachu, so both read survives1=1 survives2=0 -- the check was failing on the feature's
   * coarseness, not on any wiring. A binary feature must be tested where it is sharp. */
  const vecFor = (mv) => switchFeat(mkBoard(frail, mine,
    { nature: 'serious', item: '', ability: '', moves: ['protect'] },
    { nature: 'serious', item: '', ability: '', moves: [mv] }), frail);
  let pair = '';
  outer3:
  for (const a of strong.slice(0, 30)) {
    const va = vecFor(a);
    for (const b2 of weak.slice(0, 30)) {
      const vb = vecFor(b2);
      if (va.some((v, i) => v !== vb[i])) { pair = a + ' vs ' + b2; break outer3; }
    }
  }
  ok(!!pair, 'board.js: the FOE declared moveset changes what a switch-in is walking into',
    pair || 'IDENTICAL across every pair tried - the sheet moves are not reaching switchFeatures');
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

  /* board.js's priority lives on the MOVE path. A switch candidate carries no move and therefore no
   * priority at all, so asking switchFeatures about it was the wrong question and would have failed
   * forever however correct the engine was. */
  const bd = ab => mkActive(mine, theirs,
    { nature: 'serious', item: '', ability: '', moves: [prio[0]] },
    { nature: 'serious', item: '', ability: ab, moves: ['protect'] }, 0.5);
  const iPri = B.FEATURE_INDEX.priority;
  const val = (board) => {
    const foe = board.slot('p2', 'a'), user = board.slot('p1', 'a');
    const cand = { raw: null, move: dex.moves.get(prio[0]), targetMon: foe, spread: null, allies: [], foes: [foe] };
    return B.featuresFor(cand, user, board, 'p1', dex, 0.05)[iPri];
  };
  const v0 = val(bd('')), v1 = val(bd(blockers[0]));
  ok(v0 > 0 && v1 === 0, 'board.js: a refused priority move scores no priority',
    `${v0.toFixed(2)} -> ${v1.toFixed(2)}`);
}

console.log(`\n${fails ? `ENGINE CONSISTENCY: ${fails} FAILED — a fact is not reaching every engine that needs it`
                        : 'ENGINE CONSISTENCY: all checks passed'}`);
process.exit(fails ? 1 : 0);
