/* probe_shell_side_arm.js — DOES SHELL SIDE ARM CHOOSE ITS CATEGORY?
 *
 *   SHOWDOWN_PATH=... node tests/probe_shell_side_arm.js
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * Champions does NOT override the move. `data/mods/champions/moves.ts` has no `shellsidearm` key —
 * the only hit in the whole mod directory is `learnsets.ts:1361` (under `slowbrogalar`, whose block
 * opens at `learnsets.ts:1294`). So the handler is mainline `data/moves.ts:16209-16247`:
 *
 *     onModifyMove(move, pokemon, target) {                      data/moves.ts:16224
 *       if (!target) return;
 *       const atk = pokemon.getStat('atk', false, true);
 *       const spa = pokemon.getStat('spa', false, true);
 *       const def = target.getStat('def', false, true);
 *       const spd = target.getStat('spd', false, true);
 *       const physical = Math.floor(Math.floor(Math.floor(Math.floor(2 * pokemon.level / 5 + 2) * 90 * atk) / def) / 50);
 *       const special  = Math.floor(Math.floor(Math.floor(Math.floor(2 * pokemon.level / 5 + 2) * 90 * spa) / spd) / 50);
 *       if (physical > special || (physical === special && this.randomChance(1, 2))) {
 *         move.category = 'Physical';
 *         move.flags.contact = 1;
 *       }
 *     }
 *
 * `getStat(stat, unboosted=false, unmodified=true)` (sim/pokemon.ts:596) — BOOSTS APPLY, MODIFY
 * EVENTS DO NOT. So a Swords Dance changes the choice and a burn does not.
 *
 * The `||` SHORT-CIRCUITS: the coin is drawn ONLY on an exact tie of the two floor chains.
 *
 * ================= THE FOUR CANDIDATE RULES, AND WHY ONE ARM PROVES NOTHING ======================
 *
 *   R1  the authority        floor(floor(1980*atk/def)/50)  vs  floor(floor(1980*spa/spd)/50)
 *   R2  attacker only        atk vs spa
 *   R3  defender only        def vs spd
 *   R4  exact ratio          atk/def vs spa/spd, no floors
 *
 * A single arm cannot separate these. The arm SET is chosen so that every wrong rule differs from
 * R1 on at least one arm, and the probe ASSERTS that separation before it reports anything. Each
 * arm prints how many of the four rules produce its authority verdict — its REASON COUNT.
 *
 * THE TIE ARM IS THE ACUTE ONE. `atk == spa && def == spd` is a tie for FOUR reasons and proves
 * nothing; this probe refuses that cell and searches for a TIE BY FLOOR COLLAPSE — atk != spa,
 * def != spd, and the two chains land on the same integer anyway. Exactly one reason.
 *
 * NOTHING IS TYPED. The species is DERIVED (the format's only legal learner), the stat cells are
 * SEARCHED at run time, and every verdict is read off a battle or off the engine's own number.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('SHELL SIDE ARM');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const MC = globalThis.MC;

const MOVE = 'shellsidearm';
const LEVEL = 50;

/* ---- THE LEARNER, DERIVED. Filtered, per CLAUDE.md: `.all()` is the National Dex. ---------------- */
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
function learners() {
  const out = [];
  for (const s of dex.species.all()) {
    if (!legal(s)) continue;
    let id = s.id; const seen = new Set();
    while (id && !seen.has(id)) {
      seen.add(id);
      const l = dex.species.getLearnsetData(id);
      if (l && l.learnset && l.learnset[MOVE]) { out.push(s); break; }
      const sp = dex.species.get(id);
      id = sp.battleOnly ? dex.species.get([].concat(sp.battleOnly)[0]).id
         : sp.changesFrom ? dex.species.get(sp.changesFrom).id
         : sp.prevo ? dex.species.get(sp.prevo).id : null;
    }
  }
  return out;
}

/* ---- THE FOUR RULES ----------------------------------------------------------------------------- */
const CONST = Math.floor(2 * LEVEL / 5 + 2) * 90;          /* 1980 at L50 — derived, not typed */
const chain = (a, d) => Math.floor(Math.floor(CONST * a / d) / 50);
const cmp = (x, y) => x > y ? 'P' : x < y ? 'S' : 'TIE';
function rules(c) {
  return {
    R1: cmp(chain(c.atk, c.def), chain(c.spa, c.spd)),
    R2: cmp(c.atk, c.spa),
    R3: cmp(c.spd, c.def),                                  /* smaller defence -> that side wins */
    R4: cmp(c.atk / c.def, c.spa / c.spd),
    p: chain(c.atk, c.def), s: chain(c.spa, c.spd),
  };
}
const RULE_IDS = ['R1', 'R2', 'R3', 'R4'];

/* ---- THE ARMS, SEARCHED ------------------------------------------------------------------------- */
const LO = 100, HI = 240;
function find(pred) {
  for (let atk = LO; atk <= HI; atk++) for (let spa = LO; spa <= HI; spa++)
    for (let def = LO; def <= HI; def++) for (let spd = LO; spd <= HI; spd++) {
      const c = { atk, spa, def, spd }; const r = rules(c);
      if (pred(c, r)) return { ...c, ...r };
    }
  return null;
}
const ARMS = [];
/* PHYSICAL BECAUSE OF THE DEFENDER. atk < spa, so R2 says Special; the target's Def is low enough
 * that the authority still says Physical. Separates R1 from R2. */
ARMS.push({ id: 'physical-by-defence',
  cell: find((c, r) => r.R1 === 'P' && r.R2 === 'S' && r.p >= r.s + 12) });
/* SPECIAL BECAUSE OF THE DEFENDER. The mirror. Separates R1 from R2 the other way, so neither arm
 * can be passed by an implementation that simply always answers one category. */
ARMS.push({ id: 'special-by-defence',
  cell: find((c, r) => r.R1 === 'S' && r.R2 === 'P' && r.s >= r.p + 12) });
/* THE DEFENDER ALONE IS NOT THE RULE EITHER. R3 and R1 disagree. */
ARMS.push({ id: 'against-the-defence-alone',
  cell: find((c, r) => r.R1 !== 'TIE' && r.R3 !== 'TIE' && r.R1 !== r.R3
                    && Math.abs(r.p - r.s) >= 12) });
/* THE TIE, BY FLOOR COLLAPSE AND NOTHING ELSE. */
ARMS.push({ id: 'tie-by-floor',
  cell: find((c, r) => r.R1 === 'TIE' && r.R2 !== 'TIE' && r.R3 !== 'TIE' && r.R4 !== 'TIE'
                    && c.atk !== c.spa && c.def !== c.spd) });
/* THE CONTROL THAT PROVES NOTHING, STAGED ON PURPOSE SO ITS REASON COUNT IS PRINTED BESIDE THE
 * OTHERS. Equal stats all round: a tie for four reasons. */
/* THE TIE, MADE OBSERVABLE. Same cell; the attacker is BURNED. The burn is invisible to the choice
 * (`unmodified=true`) and halves the Physical branch only, so the coin now moves a damage number. */
ARMS.push({ id: 'tie-by-floor+burn', burn: true, cell: ARMS[ARMS.length - 1].cell });
ARMS.push({ id: 'tie-trivial-CONTROL', cell: (() => {
  /* BUILT FROM THE TIE ARM'S OWN CELL so no stat number is typed: take its Attack for both
   * offences and its Defence for both defences. */
  const t = ARMS[ARMS.length - 2].cell;
  const c = { atk: t.atk, spa: t.atk, def: t.def, spd: t.def }; return { ...c, ...rules(c) }; })() });

/* ---- STAGING ------------------------------------------------------------------------------------ */
const PAL = 'Ditto';
const inert = (name) => CS.firstLegalMove(name) || CS.INERT_MOVE;
const flatHP = (b) => Math.floor((2 * b + 31) * LEVEL / 100) + LEVEL + 10;
function mkSet(name, move) {
  const sp = dex.species.get(name);
  return { name, species: name, item: '', ability: sp.abilities[0], moves: [move],
           nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: LEVEL };
}

/* THE AUTHORITY. `useMove` is the entry point that reaches `useMoveInner`, which is the ONLY place
 * `ModifyMove` fires — `hitStepMoveHitLoop` skips it entirely and would report no choice at all. */
function sdRun(att, def, cell, coin, burn) {
  const teamA = [mkSet(att, dex.moves.get(MOVE).name), mkSet(PAL, inert(PAL)), mkSet(PAL, inert(PAL)), mkSet(PAL, inert(PAL))];
  const teamB = [mkSet(def, inert(def)), mkSet(PAL, inert(PAL)), mkSet(PAL, inert(PAL)), mkSet(PAL, inert(PAL))];
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }
  const src = battle.p1.active[0], tgt = battle.p2.active[0];
  src.storedStats.atk = cell.atk; src.storedStats.spa = cell.spa;
  tgt.storedStats.def = cell.def; tgt.storedStats.spd = cell.spd;
  src.maxhp = flatHP(dex.species.get(att).baseStats.hp); src.hp = src.maxhp;
  tgt.maxhp = flatHP(dex.species.get(def).baseStats.hp) * 40; tgt.hp = tgt.maxhp;
  for (const p of [...battle.p1.active, ...battle.p2.active]) if (p) p.clearBoosts();
  battle.field.clearWeather(); battle.field.clearTerrain();
  /* THE BURN IS THE TIE'S OBSERVABLE. `getStat(..., unmodified=true)` skips ModifyAtk, so the burn
   * does NOT move the choice — but it halves the damage of the Physical branch and not the Special
   * one. That is how a tie becomes board-material. Set directly: `setStatus` would run the same
   * ModifyAtk plumbing but also emit lines and could be refused by an ability. */
  if (burn) { src.status = 'brn'; src.statusState = { id: 'brn', target: src }; }

  /* EVERY `randomChance` IS RECORDED, not just the one we expect. A probe that filters on (1,2)
   * before printing cannot tell "the tie coin" from "some other coin that happens to be 1-in-2". */
  const chances = [];
  battle.randomChance = (num, den) => {
    chances.push(num + '/' + den);
    if (num === 1 && den === 2) return coin;                /* the tie coin, forced both ways */
    if (den === 24) return false;                           /* NO CRIT — an unpinned crit was x1.5 on
                                                             * every arm and made the two engines'
                                                             * numbers incomparable for a reason that
                                                             * has nothing to do with this mechanic. */
    return true;                                            /* accuracy hits; secondaries land */
  };
  battle.random = (n, m) => (m === undefined ? (n === undefined ? 0 : 0) : n);   /* max damage roll */

  const mark = battle.log.length;
  battle.actions.useMove(MOVE, src, { target: tgt });
  const lines = battle.log.slice(mark).map(String);
  let dmg = 0;
  for (const line of lines) {
    const f = line.split('|');
    if (f[1] !== '-damage' || !String(f[2]).startsWith('p2a')) continue;
    const parts = String(f[3]).split('/');
    if (parseInt(parts[1], 10) !== tgt.maxhp) continue;
    dmg = tgt.maxhp - parseInt(parts[0], 10);
  }
  const hint = lines.find(l => l.split('|')[1] === '-hint') || '';
  const cat = /Physical Shell Side Arm/.test(hint) ? 'P' : /Special Shell Side Arm/.test(hint) ? 'S' : '?';
  return { dmg, cat, chances, coins: chances.filter(c => c === '1/2').length, lines };
}

/* OURS -- AND IT PLAYS A REAL TURN, WHICH THE FIRST VERSION DID NOT. 2026-08-27.
 *
 * It called `MEDI.dmgRange(a, d, MC.moves[MOVE], ...)` directly with the SHARED move row, so it
 * measured the damage FORMULA and could never see a fix at the move-USE site. The authority's choice
 * happens in `singleEvent('ModifyMove')` inside `useMoveInner`; this engine's happens at the matching
 * commit site in the battle loop and hangs a PER-USE view on the action. A probe that never takes an
 * action cannot observe either. `tests/test-mechanics.js` states the same rule in as many words --
 * "a direct dmgRange tests the FORMULA. This tests the PATH" -- and every expensive bug this engine
 * has had lived in that gap.
 *
 * THE COIN IS FORCED ON BOTH SIDES, and the arms are compared HEADS-TO-HEADS. The old verdict
 * required one medicham answer to match BOTH authority arms, which on a tie is unsatisfiable by a
 * correct engine as well as by a broken one. `any` is the generic stream the tie coin is drawn off:
 * 0 wins `rng() < 1/2` and 0.999 loses it, matching the authority's forced `randomChance(1,2)`.
 *
 * `dmg: 0.999` IS THE MAXIMUM ROLL. `damageRollIndex(u) = 15 - floor(u*16)`, so 0.999 is index 0,
 * which is what the authority's pinned `battle.random` gives it. `crit: 0.999` loses `rng() < 1/24`,
 * matching the authority arm's `den === 24 -> false`. */
function mediRun(att, def, cell, coin, burn) {
  const mk = (name) => {
    const x = MEDI.buildMon(dex.species.get(name).id, {});
    if (!x) throw new Error('buildMon failed for ' + name);
    x.item = '';
    x.ability = dex.abilities.get(dex.species.get(name).abilities[0]).id;
    return x;
  };
  const a = mk(att), ally = mk(PAL), d = mk(def), d2 = mk(PAL);
  a.moves = [MOVE];
  a.st = { ...a.st, at: cell.atk, sa: cell.spa };
  d.st = { ...d.st, df: cell.def, sd: cell.spd, hp: flatHP(dex.species.get(def).baseStats.hp) * 40 };
  d.curHP = d.st.hp;
  if (burn) a.status = 'brn';
  /* `seeded: true` skips entry effects, so the defending Ditto does not Imposter -- the same board the
   * old direct-call arm measured, which is why the two agreeing control arms stay comparable. */
  const S = MEDI.battleInit([a, ally], [d, d2], { seeded: true });
  const STREAMS = { any: () => (coin ? 0 : 0.999), acc: () => 0, crit: () => 0.999,
                    sec: () => 0.999, dmg: () => 0.999, stall: () => 0.999, tie: () => 0,
                    split: true, seed: null };
  const before = d.curHP;
  const b0 = Object.assign({}, MEDI.MEDSEEN);
  MEDI.battleTurn(S, STREAMS,
    new Map([[a, MEDI.playerAction(a, MOVE, d, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[d, { kind: 'pass' }], [d2, { kind: 'pass' }]]));
  const pick = (MEDI.MEDSEEN.categoryPicked || 0) - (b0.categoryPicked || 0);
  const left = (MEDI.MEDSEEN.categoryPickedLeftAlone || 0) - (b0.categoryPickedLeftAlone || 0);
  const coins = (MEDI.MEDSEEN.categoryPickTieDrawn || 0) - (b0.categoryPickTieDrawn || 0);
  const contact = (MEDI.MEDSEEN.contactFlagPerUse || 0) - (b0.contactFlagPerUse || 0);
  return { max: before - d.curHP, cat: pick ? 'P' : 'S', decided: pick + left, coins, contact };
}

/* ---- RUN ---------------------------------------------------------------------------------------- */
const L = learners();
console.log('SHELL SIDE ARM — DOES IT CHOOSE ITS CATEGORY?');
console.log('  legal learners (derived, filtered): ' + L.length + ' — ' + L.map(s => s.name).join(', '));
if (!L.length) { console.log('  NO LEGAL LEARNER — the fixture cannot be constructed. Not a pass.'); process.exit(2); }
const ATT = L[0].name;
const DEF = PAL;
console.log('  printed category: ' + dex.moves.get(MOVE).category
          + '   printed flags: ' + JSON.stringify(dex.moves.get(MOVE).flags));
console.log('  engine-data mv.c: ' + (MC.moves[MOVE] ? MC.moves[MOVE].c : 'MISSING'));
console.log('  attacker ' + ATT + '  target ' + DEF + '  (stat cells are OVERWRITTEN below)');
console.log('');

let missing = 0;
for (const a of ARMS) if (!a.cell) { console.log('  ARM ' + a.id + ': NO CELL FOUND in [' + LO + ',' + HI + ']^4 — the search failed, not the engine.'); missing++; }
if (missing) process.exit(2);

/* THE SEPARATION CHECK, ASSERTED BEFORE ANY VERDICT IS REPORTED. */
console.log('  RULE SEPARATION — does the arm set distinguish the authority from each wrong rule?');
const sep = {};
for (const r of RULE_IDS.slice(1)) sep[r] = ARMS.filter(a => a.cell[r] !== a.cell.R1).length;
for (const r of RULE_IDS.slice(1)) console.log('    ' + r + ' differs from R1 on ' + sep[r] + ' arm(s)');
const unseparated = RULE_IDS.slice(1).filter(r => sep[r] === 0);
if (unseparated.length) { console.log('  ARM SET DOES NOT SEPARATE ' + unseparated.join(',') + ' — refusing to report.'); process.exit(2); }
console.log('');

console.log('  ARM                        atk  spa  def  spd |  phys spec | R1  R2  R3  R4 | reasons');
for (const a of ARMS) {
  const c = a.cell;
  const reasons = RULE_IDS.filter(r => c[r] === c.R1).length;
  console.log('  ' + a.id.padEnd(26) + String(c.atk).padStart(4) + String(c.spa).padStart(5)
    + String(c.def).padStart(5) + String(c.spd).padStart(5) + ' |' + String(c.p).padStart(6) + String(c.s).padStart(5)
    + ' | ' + c.R1.padEnd(3) + ' ' + c.R2.padEnd(3) + ' ' + c.R3.padEnd(3) + ' ' + c.R4.padEnd(3)
    + '| ' + reasons + (reasons > 1 ? '  <- more than one reason; proves nothing on its own' : ''));
}
console.log('');

let fails = 0;
console.log('  ARM                        | authority           | medicham2   | verdict');
for (const a of ARMS) {
  const c = a.cell;
  /* EACH SIDE OF THE COIN IS ITS OWN COMPARISON. Forcing the authority both ways and asking ONE
   * medicham answer to match both was unsatisfiable on a tie for a correct engine as well as a
   * broken one — the `tie-trivial-CONTROL` row read DIVERGES for that reason and not for a defect. */
  const heads = sdRun(ATT, DEF, c, true, a.burn);
  const tails = sdRun(ATT, DEF, c, false, a.burn);
  const meH = mediRun(ATT, DEF, c, true, a.burn);
  const meT = mediRun(ATT, DEF, c, false, a.burn);
  const drew = heads.coins;
  const expectDraw = c.R1 === 'TIE' ? 1 : 0;
  const catH = heads.cat, catT = tails.cat;
  const line = 'cat ' + catH + '/' + catT + ' dmg ' + heads.dmg + '/' + tails.dmg + ' coins ' + drew;
  const agree = (catH === meH.cat) && (catT === meT.cat)
             && (heads.dmg === meH.max) && (tails.dmg === meT.max);
  if (!agree) fails++;
  console.log('  ' + a.id.padEnd(26) + '| ' + line.padEnd(20) + '| cat ' + meH.cat + '/' + meT.cat
    + ' dmg ' + String(meH.max) + '/' + String(meT.max) + ' coins ' + meH.coins
    + ' | ' + (agree ? 'agree' : 'DIVERGES'));
  /* THE DECISION MUST HAVE HAPPENED AT ALL. Without this, an engine whose wire never fires reports
   * the same 'S' as one that fired and chose Special. */
  if (meH.decided !== 1 || meT.decided !== 1) {
    console.log('      OUR SITE DID NOT DECIDE — decided ' + meH.decided + '/' + meT.decided
      + ', which means the category wire never ran on this arm');
    fails++;
  }
  if (drew !== expectDraw) {
    console.log('      COIN COUNT ' + drew + ', EXPECTED ' + expectDraw + ' — all randomChance calls: ' + heads.chances.join(' '));
    fails++;
  } else if (meH.coins !== drew || meT.coins !== drew) {
    console.log('      OUR COIN COUNT ' + meH.coins + '/' + meT.coins + ' AGAINST THE AUTHORITY (' + drew
      + ') — a die spent where the authority spends none desynchronises every later draw');
    fails++;
  } else {
    console.log('      coins drawn ' + drew + ' on both engines; all randomChance calls this use: '
      + (heads.chances.join(' ') || 'none')
      + (meH.contact || meT.contact ? '   [per-use contact flag set ' + (meH.contact + meT.contact) + 'x]' : ''));
  }
}
console.log('');
if (fails) { console.log('  RED — ' + fails + ' failure(s). medicham2 does not choose the category.'); process.exit(1); }
console.log('  GREEN.');
