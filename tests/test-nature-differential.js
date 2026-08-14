/* test-nature-differential.js — DOES THE SHEET'S NATURE REACH BOTH ENGINES, AND DO THEY STILL AGREE?
 *
 *   SHOWDOWN_PATH=... node tests/test-nature-differential.js
 *
 * Will, 2026-08-08: "lets add the sp spreads and rerun", then — correctly — "we wont have evs from
 * team sheets" and "just nature".
 *
 * WHAT IS AVAILABLE AND WHAT IS NOT. A Showdown OPEN TEAM SHEET reveals species, item, ability,
 * moves, NATURE, gender and level. It does NOT reveal the spread: every stored sheet reads
 * `"evs": null`, on 173,784 of 173,784 bodies in the frozen store. That is not an ingest gap, it is
 * what the game shows, so THE SPREADS REMAIN ABSENT AND ALWAYS WILL BE. This narrows ROADMAP #68's
 * declared gap; it does not close it.
 *
 * WHY THE NATURE IS WORTH ITS OWN GATE. `buildPair` hardcoded `nature: 'Serious'` while the stored
 * sheet said `Modest`, so every body in the whole-game differential was flat — and with every body
 * flat AND Serious, 91.4% of legal species share a base Speed with some other species. THE RIG WAS
 * MANUFACTURING SPEED TIES and almost never testing a real speed differential (ROADMAP #86): the
 * instrument was testing turn order in the one configuration where turn order is hardest to get
 * wrong. PART 5 measures that rather than asserting it.
 *
 * THE RULE THE FIX HAD TO SURVIVE — engine/game_differential.js's buildPair header. The stat blocks
 * are not ALIGNED, they AGREE: medicham derives its line from the row's own base stats and Showdown
 * derives its line from the set, and `alignStats` exists only to ASSERT that the two match, with
 * `ALIGN_MOVED` required to read 0. Copying one engine's answer onto the other papers over exactly
 * the disagreement this instrument exists to find, and it could not survive a mega — `formeChange`
 * calls `setSpecies`, which RECOMPUTES `storedStats` from the SET mid-turn, with no seam to re-align
 * in. So: NEITHER ENGINE IS TOLD THE OTHER'S ANSWER. Both are told the NATURE and both compute.
 *
 * SO WHAT IS RED HERE IS NEVER "the two engines disagree about a game". This file goes red when the
 * NATURE does not reach one of the two sides, when the two arithmetics part, or when the mega path
 * loses the nature.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);
const note = (m) => console.log('        ' + m);

const G = require(D('engine', 'game_differential.js'));
const M = G.REL.require('engine/medicham2-browser.js');
const CS = require(D('engine', 'champions_sim.js'));
const { Dex, Teams, Battle } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const N = require(D('engine', 'names.js'));
const id = N.id;
/* THE SPECIES KEY COMES FROM THE PROJECT'S OWN RESOLVER, and the ROWS ARE ENUMERATED FROM THE DEX.
 * The first draft of this file indexed `MC.mons` with a computed key and built its own index over its
 * keys, which is exactly what tests/test-mc-key.js ratchets against — four callers wrote their own and
 * two were silently broken for 8.17% of the metagame. Sweeping the FORMAT and resolving each name is
 * also the better question: the arithmetic below is a claim about the format's species, not about the
 * subset our table happens to carry. */
const { mcKey } = require(D('engine', 'mc_key.js'));
const MAY = { mayMiss: 'the format defines species data/engine-data.js has no row for; they are '
                     + 'counted and skipped, never silently substituted' };
/* Every species in the format that has base stats, paired with its MC.mons key where one exists. */
const FORMAT_SPECIES = dex.species.all()
  .filter(s => s && s.exists && !s.isNonstandard && s.baseStats)
  .map(s => ({ name: s.name, bs: s.baseStats, key: mcKey(s.name, MAY) }));
const WITH_ROW = FORMAT_SPECIES.filter(s => s.key);

/* ================= THE ORACLE ====================================================================
 * NOT a third implementation of the stat formula — it is SHOWDOWN'S OWN `statModify`, asked directly,
 * about a set THIS FILE builds. That distinction is the whole point: if `buildPair` handed BOTH sides
 * `Serious`, the two engines would agree perfectly and a test that only compared them to each other
 * would be green on a rig that had thrown the nature away. The oracle knows what the sheet said. */
const ORACLE = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
const SET0 = { level: 50, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
               ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 } };
const oracleLine = (bs, nature) => {
  const set = Object.assign({ nature }, SET0);
  return { hp: ORACLE.statModify(bs, set, 'hp'), at: ORACLE.statModify(bs, set, 'atk'),
           df: ORACLE.statModify(bs, set, 'def'), sa: ORACLE.statModify(bs, set, 'spa'),
           sd: ORACLE.statModify(bs, set, 'spd'), sp: ORACLE.statModify(bs, set, 'spe') };
};
const SKEYS = ['hp', 'at', 'df', 'sa', 'sd', 'sp'];
const lineStr = l => SKEYS.map(k => k + ' ' + l[k]).join(' / ');
const lineEq = (a, b) => SKEYS.every(k => a[k] === b[k]);

/* ================= PART 1 — THE CHART IS THE AUTHORITY'S, ALL 25, PRINTED ========================
 * A derived table that over- or under-matches is invisible until somebody looks at what it matched,
 * so the membership is printed before anything is asserted about it. medicham2's chart is a LITERAL
 * (PASTE_NAT) and the authority's is the dex; they must be the same function. */
console.log('\nPART 1 — the nature chart, medicham2 vs the format dex, all 25');
{
  const all = dex.natures.all();
  note(all.length + ' natures in the format dex');
  let bad = 0, neutral = 0;
  const rows = [];
  for (const nat of all) {
    const want = { plus: nat.plus || null, minus: nat.minus || null };
    if (!want.plus) neutral++;
    let got;
    try { got = M.natureShift(nat.name); }
    catch (e) { got = { ERR: String((e && e.message) || e) }; }
    const SD2ENG = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp' };
    const okp = (got && got.plus || null) === (want.plus ? SD2ENG[want.plus] : null);
    const okm = (got && got.minus || null) === (want.minus ? SD2ENG[want.minus] : null);
    if (!okp || !okm) { bad++; rows.push([nat.name, JSON.stringify(want), JSON.stringify(got)]); }
  }
  note('neutral natures (no shift at all): ' + neutral);
  for (const r of rows) console.log('        MISMATCH  ' + r[0].padEnd(10) + ' authority ' + r[1] + '  engine ' + r[2]);
  if (bad) fail(bad + ' of ' + all.length + ' natures disagree with the format dex');
  else pass('all ' + all.length + ' natures agree with the format dex, ' + neutral + ' of them neutral');
}

/* ================= PART 2 — THE ARITHMETIC IS THE AUTHORITY'S, ACROSS EVERY NATURE ===============
 * The one that would have been silently wrong from memory: Showdown truncates the nature multiply in
 * FIXED POINT (`tr(tr(stat * 110, 16) / 100)`), and a half-point difference on ONE stat shows up as a
 * speed-order divergence in hundreds of games and looks exactly like an engine bug. Swept over every
 * species in the table x every nature, so it is a measurement and not a spot check. */
console.log('\nPART 2 — medicham2\'s stat line vs the authority, every species x every nature');
{
  const nats = dex.natures.all().map(n => n.name);
  let checked = 0, bad = 0; const first = [];
  for (const s of FORMAT_SPECIES) {
    for (const nat of nats) {
      let got;
      try { got = M.natureL50(s.bs, nat); } catch (e) { got = { ERR: String((e && e.message) || e) }; }
      const want = oracleLine(s.bs, nat);
      checked++;
      if (!lineEq(got, want)) { bad++; if (first.length < 5) first.push([s.name, nat, lineStr(want), lineStr(got)]); }
    }
  }
  for (const f of first) { note('  ' + f[0] + ' ' + f[1]); note('    authority ' + f[2]); note('    engine    ' + f[3]); }
  if (bad) fail(bad + ' of ' + checked + ' (species x nature) stat lines differ from the authority');
  else pass(checked + ' (species x nature) stat lines are IDENTICAL to the authority '
            + '(' + FORMAT_SPECIES.length + ' species x ' + nats.length + ' natures)');
}

/* ================= PART 3 — THE DECLARED NATURE REACHES BOTH SIDES ===============================
 * The outcome, not the classification. Every body of a built pair is checked against the ORACLE'S
 * line for the nature ITS SHEET DECLARED — so handing both sides `Serious` fails here even though the
 * two engines would agree with each other perfectly. */
console.log('\nPART 3 — the sheet\'s nature reaches the medicham body AND the Showdown set');
/* EVERY SPECIES HERE IS ONE data/engine-data.js ACTUALLY CARRIES (318 rows, not the whole dex) — a
 * body it has no row for is UNBUILDABLE and leaves the pair silently, which is how the first draft of
 * this probe reported "the sheet could not be built" and told me nothing about natures. */
const SHEET = [
  { species: 'Primarina',  item: 'Life Orb',   ability: 'Liquid Voice', nature: 'Modest',
    moves: ['Hyper Voice', 'Moonblast', 'Haze', 'Protect'] },
  { species: 'Dragonite',  item: 'Leftovers',  ability: 'Multiscale',   nature: 'Adamant',
    moves: ['Extreme Speed', 'Ice Spinner', 'Protect', 'Tailwind'] },
  /* DARKEST LARIAT, NOT KNOCK OFF -- 2026-08-14. Incineroar cannot learn Knock Off in this
   * regulation, so this "realistic sheet" was one the game would refuse. Darkest Lariat is its legal
   * Dark physical click and keeps the sheet a plausible Reg M-B set, which is all this probe wants of
   * it: nothing here clicks a move, the sheet exists so the NATURE on it can be checked through. */
  { species: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', nature: 'Relaxed',
    moves: ['Fake Out', 'Darkest Lariat', 'Protect', 'Parting Shot'] },
  { species: 'Garchomp',   item: 'Choice Scarf', ability: 'Rough Skin', nature: 'Jolly',
    moves: ['Earthquake', 'Rock Slide', 'Dragon Claw', 'Protect'] },
];
{
  const pair = G.buildPair(SHEET);
  if (!pair) { fail('the four-body probe sheet could not be built at all'); }
  else {
    let bad = 0;
    for (let i = 0; i < pair.length; i++) {
      const want = SHEET[i].nature;
      if (pair[i].sd.nature !== want) {
        bad++; fail('the SHOWDOWN set for ' + SHEET[i].species + ' says nature "' + pair[i].sd.nature
                    + '", the sheet said "' + want + '"');
      }
      const oracle = oracleLine(pair[i].spec.bs, want);
      const got = G.flatL50(pair[i].spec.bs, pair[i].spec.nature);
      if (!lineEq(got, oracle)) {
        bad++; fail('the MEDICHAM line for ' + SHEET[i].species + ' (' + want + ') is ' + lineStr(got)
                    + ', the authority says ' + lineStr(oracle));
      }
    }
    if (!bad) pass('all four bodies carry their declared nature on BOTH sides, and the medicham line '
                   + 'matches the authority exactly');

    /* THE CONTROL, EXPLICITLY. A knob that changes nothing looks exactly like a knob that is not
     * wired, so the natured build must be DIFFERENT from the flat one — and it is checked per body,
     * because one body differing would carry three that did not. */
    let same = 0;
    for (let i = 0; i < pair.length; i++)
      if (lineEq(G.flatL50(pair[i].spec.bs, SHEET[i].nature), G.flatL50(pair[i].spec.bs, 'Serious'))) same++;
    if (same) fail(same + ' of ' + pair.length + ' bodies have the SAME line natured as flat — '
                   + 'a knob that moves nothing is an unwired knob, not a knob that does not matter');
    else pass('every one of the four differs from its Serious build — the knob is wired');
  }
}

/* ================= PART 4 — THE MEGA CASE, WHICH IS WHAT BROKE THE OLD DESIGN ====================
 * `formeChange` calls `setSpecies`, which RECOMPUTES `storedStats` from the SET — so the moment a
 * body evolves, Showdown goes back to the set's own numbers mid-turn and there is no seam for a
 * harness to re-align in (`battle.choose` runs the whole turn). A copied stat block cannot survive
 * that. A DERIVED one can, and this is the proof: mega mid-turn on both sides, then compare.
 *
 * AND `updateMaxHp` MUST EMIT NO PHANTOM `-heal`. Showdown keeps the DAMAGE TAKEN constant across a
 * max-HP change; if the two engines disagreed about the new maximum, the difference would surface as
 * a heal line nobody asked for. */
console.log('\nPART 4 — the nature survives a mega evolution, in BOTH engines, mid-turn');
{
  /* DERIVED, NOT TYPED: a stone whose base forme this format's table actually carries. `megaStone` on
   * a dex item is a MAP from base name to mega name, not a string — reading it as a string returned
   * undefined for all 75 and the first draft of this probe staged NOTHING while printing a tidy
   * "no mega stone could be staged". */
  const STONES = N.byTag('items', 'megaStone');
  let picked = null;
  for (const st of STONES) {
    const it = dex.items.get(st);
    if (!it || !it.exists || it.isNonstandard || !it.megaStone) continue;
    const base = Object.keys(it.megaStone)[0];
    const megaName = base && it.megaStone[base];
    if (!base || !megaName) continue;
    const k = mcKey(base, MAY), megaK = mcKey(megaName, MAY);
    const row = dex.species.get(base), megaRow = dex.species.get(megaName);
    if (!k || !megaK || !row || !row.exists || !megaRow || !megaRow.exists) continue;
    /* THE PROBE MUST SEE THE NATURE MOVE, ON THE STAT THE FORME CHANGE ALSO MOVES. A case whose
     * natured and flat mega lines agree would be green on a rig that had dropped the nature entirely.
     * The delta trap below is exactly this: `megaL50 + (st - baseL50)` with UNNATURED anchors lands
     * short by (mul-1) x (mega - base), so the case must have a non-zero base->mega Speed delta. */
    const nat = 'Jolly';
    const b = oracleLine(row.baseStats, nat), g = oracleLine(megaRow.baseStats, nat);
    const bF = oracleLine(row.baseStats, 'Serious'), gF = oracleLine(megaRow.baseStats, 'Serious');
    if (g.sp === gF.sp) continue;                        // nature is neutral in Speed here
    if (g.sp - b.sp === gF.sp - bF.sp) continue;         // the delta trap would not bite — no evidence
    /* `megaL50 + (st - baseL50)` with UNNATURED anchors, spelled out, so the number in the report is
     * the wrong answer this case would have produced rather than an assertion that one exists. */
    picked = { stone: it.name, base: row, mega: megaRow, key: k, megaKey: megaK, nature: nat,
               trap: 'Speed — unnatured anchors give ' + (gF.sp + (b.sp - bF.sp)) + ', the authority says ' + g.sp };
    break;
  }
  if (!picked) { fail('no mega stone in this format could be staged — the probe tested nothing'); }
  else {
    note('staging ' + picked.base.name + ' @ ' + picked.stone + ', ' + picked.nature
         + ' (base ' + picked.key + ' -> ' + picked.megaKey + ')');
    note('the trap this case bites: ' + picked.trap);
    /* THE DELTA TRAP, NAMED. medicham2's mega swap is `megaL50 + (st - baseL50)`. If the two anchors
     * are computed WITHOUT the nature while `st` carries one, the delta is (nature-1) x the BASE line
     * and the mega lands short — a divergence of one or two points on exactly the stat the nature
     * moved. This is the arithmetic that fails silently, so it is checked before the battle runs. */
    const bs = picked.base.baseStats, ms = picked.mega.baseStats;
    const wantMega = oracleLine(ms, picked.nature);
    const sheet = SHEET.slice(1).concat([{ species: picked.base.name, item: picked.stone,
      ability: Object.values(picked.base.abilities || {})[0] || '', nature: picked.nature,
      moves: ['Protect'] }]);
    /* the stone-holder FIRST, so it leads and can be told to evolve on turn 1 */
    sheet.unshift(sheet.pop());
    const pair = G.buildPair(sheet);
    const foe = G.buildPair(SHEET);
    if (!pair || !foe) { fail('the mega probe pair could not be built'); }
    else {
      const A = G.freshBodies(pair), B = G.freshBodies(foe);
      const trace = [];
      const S = M.battleInit(A, B, { trace, autoMega: false });
      const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
      battle.setPlayer('p1', { name: 'A', team: Teams.pack(pair.map(x => x.sd)) });
      battle.setPlayer('p2', { name: 'B', team: Teams.pack(foe.map(x => x.sd)) });
      if (battle.requestState === 'teampreview') { battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234'); }

      /* BEFORE: the two engines must already agree, or the mega proves nothing. */
      const sdOf = (p) => ({ hp: p.maxhp, at: p.storedStats.atk, df: p.storedStats.def,
                             sa: p.storedStats.spa, sd: p.storedStats.spd, sp: p.storedStats.spe });
      const p0 = battle.p1.active[0], m0 = S.actA[0];
      const before = sdOf(p0);
      if (!lineEq(before, m0.st)) fail('BEFORE the mega the two engines already disagree: showdown '
        + lineStr(before) + ' vs medicham ' + lineStr(m0.st));
      else if (!lineEq(before, oracleLine(bs, picked.nature)))
        fail('BEFORE the mega both engines agree on a line the AUTHORITY does not: '
             + lineStr(before) + ' vs ' + lineStr(oracleLine(bs, picked.nature)));
      else pass('before the mega: both engines and the authority agree — ' + lineStr(before));

      const logMark = battle.log.length;
      /* ONE CHOICE, TWO SPELLINGS — exactly as the driver issues it. */
      const mk = (own, foes, acts) => { const map = new Map();
        own.forEach((mon, i) => { if (!mon) return;
          const a = acts[i]; if (!a) { map.set(mon, { kind: 'pass' }); return; }
          const pa = M.playerAction(mon, a.move, null, S.field);
          if (a.mega && pa) pa.mega = true; map.set(mon, pa); });
        return map; };
      M.battleTurn(S, () => 0, mk(S.actA, S.actB, [{ move: 'protect', mega: true }, { move: 'protect' }]),
                               mk(S.actB, S.actA, [{ move: 'protect' }, { move: 'protect' }]));
      /* EVERY SLOT CLICKS PROTECT, and the slot index is looked up rather than typed: a targeted move
       * in a doubles slot is rejected outright ("Extreme Speed needs a target"), which the first draft
       * of this probe hit and reported as "SHOWDOWN never megad". The choice must also match what the
       * medicham side was just told, or the two engines played different turns. */
      const slotOf = (p, wanted) => (p.sd.moves.findIndex(mv => id(mv) === wanted) + 1) || 1;
      const c1 = 'move ' + slotOf(pair[0], 'protect') + ' mega, move ' + slotOf(pair[1], 'protect');
      const c2 = 'move ' + slotOf(foe[0], 'protect') + ', move ' + slotOf(foe[1], 'protect');
      if (!battle.choose('p1', c1)) fail('showdown rejected "' + c1 + '": ' + (battle.p1.choice.error || '?'));
      if (!battle.choose('p2', c2)) fail('showdown rejected "' + c2 + '": ' + (battle.p2.choice.error || '?'));

      const megaSd = battle.log.slice(logMark).filter(l => /^\|-mega\|/.test(String(l)));
      const megaMe = trace.filter(l => /^\|-mega\|/.test(String(l)));
      if (!megaSd.length) fail('SHOWDOWN never megad — the probe tested nothing');
      if (!megaMe.length) fail('MEDICHAM never megad — the probe tested nothing');
      if (megaSd.length && megaMe.length) {
        pass('both engines megad on turn 1');
        const after = sdOf(battle.p1.active[0]), mAfter = S.actA[0].st;
        if (!lineEq(after, mAfter))
          fail('AFTER the forme change the two engines disagree: showdown ' + lineStr(after)
               + ' vs medicham ' + lineStr(mAfter)
               + '   <-- the mega path lost the nature on one side');
        else if (!lineEq(after, wantMega))
          fail('AFTER the forme change both engines agree on a line the AUTHORITY does not: '
               + lineStr(after) + ' vs ' + lineStr(wantMega));
        else pass('after the forme change: both engines and the authority agree — ' + lineStr(after));

        /* SCOPED TO THE BODY THAT EVOLVED. Leftovers and a Sitrus on the other three emit perfectly
         * legitimate `-heal` lines at the residual, and a whole-log filter would call one of those a
         * phantom — a probe failing toward the exciting answer. */
        const who = '|-heal|p1a:';
        const heals = battle.log.slice(logMark).filter(l => String(l).startsWith(who));
        if (heals.length) fail('updateMaxHp emitted ' + heals.length + ' phantom -heal line(s) on the '
          + 'body that evolved: ' + heals.join(' '));
        else pass('no phantom -heal on the evolving body across its max-HP change ('
          + battle.log.slice(logMark).filter(l => /^\|-heal\|/.test(String(l))).length
          + ' legitimate -heal lines elsewhere on the board)');
      }
    }
  }
}

/* ================= PART 5 — WHAT THE NATURES ACTUALLY BUY (ROADMAP #86) ==========================
 * NOT an assertion — a MEASUREMENT, printed. The claim being tested is that a flat Serious build
 * MANUFACTURES speed ties, so the instrument almost never exercises a real speed differential. It is
 * counted over the real pool rather than argued. */
console.log('\nPART 5 — how many speed ties the flat build manufactures, measured');
{
  const sp = FORMAT_SPECIES;
  const flat = new Map();
  for (const x of sp) { const v = M.natureL50(x.bs, 'Serious').sp; flat.set(v, (flat.get(v) || 0) + 1); }
  const shares = sp.filter(x => flat.get(M.natureL50(x.bs, 'Serious').sp) > 1).length;
  note('flat/Serious: ' + shares + ' of ' + sp.length + ' species in the format ('
       + (100 * shares / sp.length).toFixed(1) + '%) share a Speed with at least one other species');
  /* Under real natures a species has THREE reachable Speeds (+10%, flat, -10%), so the question is
   * how often two randomly drawn bodies COLLIDE. Enumerated over the three-way product. */
  const three = x => [M.natureL50(x.bs, 'Jolly').sp, M.natureL50(x.bs, 'Serious').sp,
                      M.natureL50(x.bs, 'Relaxed').sp];
  const buckets = new Map();
  for (const x of sp) for (const v of three(x)) buckets.set(v, (buckets.get(v) || 0) + 1);
  let tiePairsFlat = 0, tiePairsNat = 0, allFlat = 0, allNat = 0;
  for (const [, c] of flat) { tiePairsFlat += c * (c - 1) / 2; }
  allFlat = sp.length * (sp.length - 1) / 2;
  for (const [, c] of buckets) { tiePairsNat += c * (c - 1) / 2; }
  allNat = (sp.length * 3) * (sp.length * 3 - 1) / 2;
  note('P(two random bodies tie on Speed): flat ' + (100 * tiePairsFlat / allFlat).toFixed(2)
       + '%   with the three natured lines ' + (100 * tiePairsNat / allNat).toFixed(2) + '%');
  note('this is a measurement, not a gate — the differential\'s own speed_ties block is the receipt');
}

/* ================= PART 6 — A MISSING NATURE IS COUNTED, NEVER SILENT ============================
 * An older row, or a set inferred from a closed-sheet replay, carries no nature. Falling back to
 * Serious is right; falling back SILENTLY would leave the instrument half-natured with nobody able to
 * say which half. */
console.log('\nPART 6 — a sheet with no nature falls back to Serious AND is counted');
{
  const before = G.natureCounters();
  const noNat = SHEET.map(p => Object.assign({}, p, { nature: undefined }));
  const pair = G.buildPair(noNat);
  const after = G.natureCounters();
  if (!pair) fail('a sheet with no nature could not be built at all');
  else {
    const declared = after.declared - before.declared, fell = after.fallback - before.fallback;
    if (fell !== pair.length)
      fail('4 natureless bodies were built and the fallback counter moved by ' + fell
           + ' — a silent default looks exactly like a working feature');
    else pass('all ' + fell + ' natureless bodies fell back to Serious and were COUNTED');
    if (declared) fail(declared + ' of them were counted as DECLARED, which they were not');
    if (pair.some(x => x.sd.nature !== 'Serious'))
      fail('the fallback did not produce Serious: ' + pair.map(x => x.sd.nature).join(', '));
  }
  /* AND THE COUNTER MUST BE ABLE TO STAY STILL. A counter that ticks on every body would satisfy the
   * check above and mean nothing. */
  const b2 = G.natureCounters();
  G.buildPair(SHEET);
  const a2 = G.natureCounters();
  if (a2.fallback !== b2.fallback)
    fail('the fallback counter moved by ' + (a2.fallback - b2.fallback) + ' on a fully-declared sheet');
  else if (a2.declared - b2.declared !== 4)
    fail('the declared counter moved by ' + (a2.declared - b2.declared) + ' on a 4-body declared sheet');
  else pass('and it stays still on a fully-declared sheet (declared +4, fallback +0)');
}

/* ================= PART 7 — THE CONTROL, CLEARED EXPLICITLY ======================================
 * A change that is "obviously a no-op when the flag is off" is the shape this project keeps paying
 * for. `l50` grew a third argument and `megaEvolveNow` grew two, so EVERY body ever built by this
 * engine went through edited arithmetic — including every rollout, every board feature and every
 * probe in the census. The claim is that a body with no nature is byte-identical to before, and it is
 * MEASURED against the frozen release `6b5447db1738` rather than argued from the source.
 *
 * BOTH HALVES, because they fail differently: the BUILD (l50 under no nature) and the MEGA SWAP (the
 * two anchors under no nature). The second is the one the plant above showed can move. */
console.log('\nPART 7 — the control: with no nature, is the engine byte-identical to release 6b5447db1738?');
{
  const ER = require(D('engine', 'engine_release.js'));
  let OLD = null;
  try { OLD = ER.open('6b5447db1738').require('engine/medicham2-browser.js'); }
  catch (e) { fail('the baseline release could not be opened — the control was NOT cleared: '
                   + String((e && e.message) || e)); }
  if (OLD) {
    let built = 0, moved = 0; const firstMoved = [];
    for (const { key: k } of WITH_ROW) {
      const a = OLD.buildMon(k, {}), b = M.buildMon(k, {});
      if (!a || !b) continue;
      built++;
      if (!lineEq(a.st, b.st)) { moved++; if (firstMoved.length < 5) firstMoved.push([k, lineStr(a.st), lineStr(b.st)]); }
    }
    for (const f of firstMoved) { note('  ' + f[0]); note('    was ' + f[1]); note('    now ' + f[2]); }
    if (moved) fail(moved + ' of ' + built + ' bodies build to a DIFFERENT stat line than the baseline '
                    + 'release — the nature work was not a no-op for un-natured bodies');
    else pass('all ' + built + ' un-natured buildMon stat lines are identical to release 6b5447db1738');

    /* THE MEGA SWAP, un-natured, through the real phase rather than the arithmetic. */
    let megad = 0, megaMoved = 0;
    const STONES2 = N.byTag('items', 'megaStone');
    for (const st of STONES2) {
      const it = dex.items.get(st);
      if (!it || !it.exists || !it.megaStone) continue;
      const base = mcKey(Object.keys(it.megaStone)[0] || '', MAY);
      if (!base) continue;
      const one = (E) => {
        const m = E.buildMon(base, {}); if (!m) return null;
        m.item = id(it.name);
        const foe = E.buildMon(base, {}); if (!foe) return null;
        const S = E.battleInit([m, E.buildMon(base, {})], [foe, E.buildMon(base, {})], { autoMega: false });
        if (!E.megaEvolveNow(S, m, false)) return null;
        return m.st;
      };
      const a = one(OLD), b = one(M);
      if (!a || !b) continue;
      megad++;
      if (!lineEq(a, b)) { megaMoved++; if (megaMoved <= 3) note('  ' + base + ' mega: was ' + lineStr(a) + ' now ' + lineStr(b)); }
    }
    if (!megad) fail('no un-natured mega swap could be staged — the second half of the control is EMPTY');
    else if (megaMoved) fail(megaMoved + ' of ' + megad + ' un-natured mega swaps moved against the baseline release');
    else pass('all ' + megad + ' un-natured mega swaps land on the same line as release 6b5447db1738');
  }
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL GREEN') + '\n');
process.exit(failures ? 1 : 0);
