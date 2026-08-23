/* test-effective-identity.js — a transformed Pokemon has ONE identity, and it is not the sheet's.
 *
 * WHY THIS EXISTS (Will, 2026-08-02: "BRO IM TIRED OF THIS MEGA ABILITY GAP. RESEARCH WHAT THE
 * INDUSTRY STANDARD FIX IS AND IMPLEMENT IT UNIVERSALLY ... AND IMPLEMENT THIS FIX FOR ALL THINGS
 * NOT JUST MEGA ABILITY GAP")
 *
 * THE SHAPE, because it is the fourth table and the fourth session
 * ---------------------------------------------------------------
 * A team sheet lists what a Pokemon is BEFORE it transforms. Mega Gengar's sheet says Cursed Body;
 * the thing on the field has Shadow Tag. Mega Blaziken's says Blaze; the thing on the field has
 * Speed Boost, which is the whole reason it Protects. Every consumer that read `mon.ability` got the
 * sheet's answer and had no way to know it was stale — the exact `lookup(x) -> plausible wrong value`
 * that engine/lookup.js was written about, one field over.
 *
 * It had already appeared as: MC.mons keyed by hyphen (101 of 308 keys unreachable), the team-sheet
 * index collapsing mirrors, eight species with no damage row, and now the ability. Each was fixed
 * for the field that had just bitten someone, which is why it kept coming back — mega evolution
 * changes the species AND the ability AND the types AND the base stats AND the weight, and a fix
 * for one leaves the other four stale.
 *
 * WHAT THE INDUSTRY CALLS THIS, AND WHAT IT PRESCRIBES
 * ---------------------------------------------------
 * Two named refactorings and one structural test, and they stack:
 *
 *   SELF ENCAPSULATE FIELD (Fowler) — stop reading the raw field, INCLUDING from inside the module
 *     that owns it, and route every read through an accessor that is free to compute. That is what
 *     makes a derived value possible at all; a public raw field can never become derived.
 *     https://refactoring.guru/self-encapsulate-field
 *
 *   PRIMITIVE OBSESSION -> REPLACE DATA VALUE WITH OBJECT — `ability` is a bare string carrying a
 *     domain concept that has rules, and nothing stops you handing the pre-mega one where the
 *     effective one was meant. The same smell docs/ARTIFACT-ACCESS-RULES.md 2.1 already records for
 *     species names.  https://refactoring.guru/encapsulate-field
 *
 *   ARCHITECTURE FITNESS FUNCTION — assert the SHAPE of the system, not one behaviour. A
 *     behavioural test proves today's callers are right; it cannot catch the NEXT caller writing
 *     the same three lines, which is how this recurred four times. This file is that check.
 *
 * WHY ONE RESOLVER FOR ALL FIVE FIELDS, rather than five accessors
 * ---------------------------------------------------------------
 * board.js `effective(mon, dex)` returns species, ability, types, baseStats and weight together, so
 * a caller cannot obtain the mega's ability beside the base forme's types. That mixed state is what
 * made these bugs so hard to see: every individual field looked defensible.
 *
 * THE GATE IS A RUNTIME TRIPWIRE, NOT A COUNT — MEASURE, 2026-08-23
 * -----------------------------------------------------------------
 * (Will: "you do what you think is best just make it a permanent solution".)
 *
 * From 2026-08-02 to 2026-08-23 the fitness function above was implemented as a per-file COUNT of the regex
 * /\.(ability|baseStats|weighthg|weightkg)\b/ against a stored baseline. THAT COUNT IS RETIRED. It
 * is retired rather than restamped, and `data/effective-identity-baseline.json` still carries the
 * last numbers it ever asserted, under `last_count_baseline`, with the reason.
 *
 * WHY. Seven agents reported it red at six different totals (869, 1048, 1471, 1561, 1596, 1597), TWO
 * OF THEM BELOW THE BASELINE OF THE DAY — the ratchet was per-file and the headline was a total, so
 * the headline actively recommended a restamp. One wholesale restamp on 2026-08-11 adopted 964 reads
 * unreviewed and it was red again inside a week. It made people reword COMMENTS to hold a number
 * still, twice on the record. And when all 130 of its last red matches were walked on 2026-08-23:
 * 44 prose, 12 writes, 122 reads of `baseStats` (a field no live body in this repository has), ~27
 * live-body reads that all deliberately want and receive the effective value — and ZERO stale-identity
 * reads. 62% of the growth was the calendar. It was measuring the size of the repository.
 *
 * AND IT WAS GREEN ON A REAL ONE. `engine/position_features.js` sits exactly at its per-file baseline
 * of 5 and contains a genuine raw read of a live stone-holder, found by the tripwire on its first run.
 * No count could ever have found it, because the count only ever asked whether the number went up.
 *
 * WHAT REPLACED IT — section 3. Every mon a Board switches in gets a recording accessor on the four
 * transforming fields; every active on the test board holds a mega stone whose forme ability differs
 * from every ability its base forme can have, so a raw read is a defect BY CONSTRUCTION; the board is
 * driven through the live decision path; and exactly one call site — board.js `effective()` — is
 * allowed to see the raw field. SELF ENCAPSULATE FIELD stated as an executable assertion.
 *
 * It fires on the property ACCESS, so destructuring, a destructured parameter, `{...mon}`,
 * `Object.assign({}, mon)` and `mon[k]` with a computed key are all caught — the last three were
 * conceded as undetectable by any text scan. `ABRA_EI_PLANT=all` plants all six shapes and the gate
 * names every one. ITS LIMIT IS EXECUTION COVERAGE, it is stated in section 3's own header, and the
 * drive list is printed on every run so a reader can check whether their consumer is in it.
 *
 *   node tests/test-effective-identity.js
 *   ABRA_EI_PLANT=all node tests/test-effective-identity.js   RED on six planted shapes
 *   node tests/test-effective-identity.js --split             the retired inventory, per file
 *   node tests/test-effective-identity.js --update            REFUSED; the count baseline is retired
 *
 * WHAT SURVIVES FROM THE OLD RATCHET, AND WHY. The scan still runs and still prints a per-file
 * PROSE / WRITE / READ inventory, and the 32 walked-file notes are kept — each is somebody's line-by-line
 * account of one file and that is the expensive part. NEITHER ASSERTS ANYTHING NOW. One narrow static
 * assertion remains, `baseSpecies(...).baseStats` at zero, because it is the single text shape a
 * whole-repository walk named as dangerous and it covers files the tripwire never executes. It is a
 * supplement and section 4 says so; it refuses one spelling of one shape and nothing more.
 *
 * A NOTE FOR THE NEXT READER: this file's own source now contains the field name many times over, in
 * this comment and in section 3's declarations. Under the old ratchet that inflated the number it
 * declared, and the `tests/test-tag-signature.js` note below was written WITHOUT the field name for
 * exactly that reason. It no longer matters, and that is the clearest single sign that the counter
 * was measuring its own prose.
 */
'use strict';
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
/* A CHECK THAT CRASHES IS A CHECK THAT GETS SKIPPED.
 *
 * This file sweeps the real Showdown dex for a mega case, so it needs SHOWDOWN_PATH. Without it the
 * loader threw a twenty-line stack trace out of engine/champions_sim.js before a single assertion
 * printed. This ratchet then sat red for two days with nobody running it (docs/PRIORITIES.md #40),
 * and the stack trace is a large part of why.
 *
 * Exit 2, not 1: a runner can tell NOT RUN from FAILED, and neither one can be mistaken for a pass. */
if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — set SHOWDOWN_PATH to a built pokemon-showdown checkout, then re-run:');
  console.error('  SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/test-effective-identity.js');
  process.exit(2);
}
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const BASELINE = D('data', 'effective-identity-baseline.json');
const UPDATE = process.argv.includes('--update');

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

const CS = require('../engine/champions_sim.js');
const B = require('../engine/board.js');
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

console.log('EFFECTIVE IDENTITY — a transformed Pokemon is not its sheet\n');

/* ---- 1. THE ACCESSOR EXISTS AND RESOLVES EVERY FIELD TOGETHER -------------------------------- */

ok(typeof B.effective === 'function', 'board.js exports effective(mon, dex)');
for (const f of ['effAbility', 'effTypes', 'effStats', 'effWeight', 'effSpecies']) {
  ok(typeof B[f] === 'function', `board.js exports ${f}()`);
}

/* A mega found by SWEEPING the dex, so this test names no species either. The first stone whose
 * forme differs from its base in ability AND types is the sharpest single case. */
function findMegaCase() {
  for (const it of dex.items.all()) {
    if (!it.megaStone) continue;
    for (const sp of dex.species.all()) {
      if (!sp.exists || sp.isMega) continue;
      const forme = B.megaFormeOf(B.norm(sp.name), B.norm(it.name), dex);
      if (!forme) continue;
      const m = dex.species.get(forme);
      if (!m || !m.exists) continue;
      const abils = Object.values(m.abilities || {}).map(a => B.norm(a));
      const baseAb = Object.values(sp.abilities || {}).map(a => B.norm(a));
      if (abils.length === 1 && !baseAb.includes(abils[0])) {
        return { base: B.norm(sp.name), stone: B.norm(it.name), forme, want: abils[0], sp, m };
      }
    }
  }
  return null;
}
const C = findMegaCase();
ok(!!C, `found a mega case by sweeping the dex${C ? ` (${C.base} + ${C.stone} -> ${C.forme})` : ''}`);

if (C) {
  const mon = { species: C.base, ability: 'sheetability', item: C.stone, nature: 'Adamant' };
  const e = B.effective(mon, dex);

  ok(e.species === C.forme, `effective() resolves the SPECIES (${e.species})`);
  ok(e.ability === C.want, `effective() resolves the ABILITY (sheet said 'sheetability', got '${e.ability}')`);
  ok(B.effAbility(mon, dex) === C.want, 'effAbility() agrees with effective()');

  /* THE POINT OF ONE RESOLVER: the fields must move TOGETHER. A caller must never be able to hold
   * the mega's ability beside the base forme's types. */
  const sameTypes = JSON.stringify(e.types) === JSON.stringify((C.m.types || []).slice());
  ok(sameTypes, `and the TYPES come from the same forme (${(e.types || []).join('/')})`);
  ok(JSON.stringify(e.baseStats) === JSON.stringify(Object.assign({}, C.m.baseStats || {})),
    'and the BASE STATS come from the same forme');

  /* The negative case matters as much: no stone, nothing may move. */
  const plain = { species: C.base, ability: 'sheetability', item: '', nature: 'Adamant' };
  const p2 = B.effective(plain, dex);
  ok(p2.ability === 'sheetability' && p2.species === C.base,
    'a Pokemon with no stone keeps its sheet ability and species — the accessor is not guessing');
}

/* ---- 2. THE DERIVATION REPRODUCES THE HAND-WRITTEN MAP ---------------------------------------
 * engine/medicham2-browser.js carries MEGA_ABIL, ~63 species typed out by hand. If the derivation
 * is right the map is redundant; if it disagrees anywhere, one of them is wrong and we need to know
 * WHICH before anything is deleted. Read as DATA rather than imported, because that file is a
 * browser file with no require. */
{
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  const m = src.match(/const MEGA_ABIL=\{([\s\S]*?)\};/);
  const hand = {};
  if (m) for (const kv of m[1].split(/[,\n]/)) {
    const t = kv.match(/([a-z0-9]+)\s*:\s*'([a-z0-9]+)'/);
    if (t) hand[t[1]] = t[2];
  }
  ok(Object.keys(hand).length > 20, `read the hand-written MEGA_ABIL map (${Object.keys(hand).length} entries)`);

  const stoneFor = {};
  for (const it of dex.items.all()) {
    if (!it.megaStone) continue;
    for (const base of Object.keys(hand)) {
      if (B.megaFormeOf(base, B.norm(it.name), dex)) stoneFor[base] = B.norm(it.name);
    }
  }
  const differ = [];
  let checked = 0;
  for (const [base, ab] of Object.entries(hand)) {
    const stone = stoneFor[base];
    if (!stone) continue;                    // not in this format; nothing to check against
    checked++;
    const got = B.effAbility({ species: base, ability: 'sheetability', item: stone }, dex);
    if (got !== ab) differ.push(`${base}: hand=${ab} derived=${got}`);
  }
  ok(differ.length === 0,
    `the derivation reproduces all ${checked} checkable hand-written entries` +
    (differ.length ? ` — ${differ.length} differ:\n         ` + differ.slice(0, 8).join('\n         ') : ''));
}

/* ---- 2b. THE ONE FILE THAT CANNOT ROUTE THROUGH board.js, PINNED ------------------------------
 *
 * engine/medicham2-browser.js is the largest raw reader in the repo and cannot call effAbility():
 * it is a browser file with no require, and board.js is downstream of it besides. Its declaration
 * below rests on a CONSTRUCTION claim — that this engine materialises the EFFECTIVE ability into
 * `.ability` at build time and keeps the pre-mega one in `.baseAbility` — and a declaration resting
 * on an unchecked claim is a bump with better prose. So the claim is asserted here, against the
 * hand-written MEGA_ABIL entries section 2 just proved are correct.
 *
 * It was NOT true when this was written. 85 MC.mons rows store `ab` in display case ("Technician"),
 * buildMon copied it through, and every ability comparison in that engine is a lowercase literal —
 * so a body built from its MEGA ROW carried the right ability and none of it fired. Fixed 2026-08-04
 * and probed behaviourally by tests/test-mechanics.js `megaRowAbilityCase` / `megaSheetAbility`;
 * this asserts the structural half. */
{
  require(D('data', 'engine-data.js'));
  const MED = require(D('engine', 'medicham2-browser.js'));
  const src = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
  const m = src.match(/const MEGA_ABIL=\{([\s\S]*?)\};/);
  const hand = {};
  if (m) for (const kv of m[1].split(/[,\n]/)) {
    const t = kv.match(/([a-z0-9]+)\s*:\s*'([a-z0-9]+)'/);
    if (t) hand[t[1]] = t[2];
  }
  /* THE Z STONES ARE EXCLUDED, AND THIS PROBE WAS WRONG BEFORE THE ENGINE WAS BECAUSE OF THEM.
   *
   * Champions ships a SECOND mega per stone — garchompiteZ -> garchompmegaZ, Rough Skin instead of
   * Sand Force; lucarioniteZ -> Inner Focus; absoliteZ -> Justified. The first version of this loop
   * kept whichever stone it saw LAST, which was the Z one, and it duly reported three engine bugs
   * that were its own sloppiness. Tenth time on this list (docs/ENGINE.md).
   *
   * They are excluded rather than fixed because the engine cannot represent them at all: MC.mons has
   * ZERO `-mega-z` rows and the ladder store has zero `itez` occurrences, so a Z stone falls through
   * megaAbility() to the base ability, which is the correct answer for a forme change that never
   * happens. If Z megas ever appear in the data this exclusion becomes a bug and should be deleted. */
  const stoneFor = {};
  for (const it of dex.items.all()) {
    if (!it.megaStone) continue;
    const st = B.norm(it.name);
    if (/z$/.test(st)) continue;
    for (const b of Object.keys(hand)) if (B.megaFormeOf(b, st, dex)) stoneFor[b] = st;
  }
  /* ---- REWRITTEN 2026-08-07 FOR ROADMAP #31, AND THE CLAIM GOT STRONGER RATHER THAN WEAKER ------
   *
   * This used to assert that `buildMon(base, {base: stone}).ability` is the MEGA's ability — i.e.
   * that medicham2 materialises the effective ability AT BUILD TIME. That was true and it was true
   * for the wrong reason: the engine handed a base-forme body the mega's ABILITY while leaving it the
   * base's STATS, which is a Pokemon neither engine models and is why the whole-game differential had
   * to strip 460 stone sets. Mega evolution is now a CHOICE resolved inside the turn.
   *
   * SO THE CONTRACT THE DECLARED EXCEPTION RESTS ON IS RESTATED, NOT DROPPED: medicham2's `.ability`
   * is THE ABILITY THE BODY HAS AT THAT MOMENT — the base forme's before it evolves, the mega forme's
   * after. That is what a raw `.ability` read inside that engine needs to be safe, and it is a
   * stronger claim than the old one because it is pinned at BOTH moments instead of one.
   *
   * A LOOKUP AT THE WRONG MOMENT IS NOW THE FAILURE, and both halves are asserted, so an engine that
   * megaed at build time fails the first and an engine that never megas fails the second.
   *
   * THIS BLOCK WAS RESTORED BY HAND ON 2026-08-07 AFTER A `git checkout --` DISCARDED IT. It was
   * uncommitted at the time, a second agent reverted the file to clear an unrelated syntax error, and
   * a working-tree overwrite has no reflog — the old contract came back and went RED against a
   * correct engine, asserting the chimera again. That is the failure mode the restored version exists
   * to prevent, arriving through the file that prevents it. Nothing below is approximate; it is the
   * same text, re-applied. */
  const wrongBefore = [], wrongAfter = [], unnormalised = [];
  /* A SPECIES THAT WOULD NOT BUILD IS NOT A SPECIES THAT PASSED. `built` is asserted to be > 20
   * precisely so this loop cannot quietly shrink to nothing and report success, and these throws are
   * collected rather than discarded so a shrunken denominator has a reason attached. */
  const unbuildable = [];
  let built = 0;
  const bare = (sp) => { const b = MED.buildMon(sp, {}); b.item = ''; b.ability = 'none'; return b; };
  for (const [base, ab] of Object.entries(hand)) {
    const stone = stoneFor[base];
    if (!stone) continue;
    let body = null;
    try { body = MED.buildMon(base, { [base]: stone }); }
    catch (e) { unbuildable.push(base + ': ' + String((e && e.message) || e).slice(0, 40)); body = null; }
    if (!body) continue;                       // no MC row for this species; nothing to claim
    built++;
    if (body.ability !== String(body.ability).toLowerCase().replace(/[^a-z0-9]/g, '')) { unnormalised.push(base); continue; }
    /* BEFORE: the BASE forme's own ability, which is what Showdown has on the field until the choice
     * is made. `baseAbility` is the row's, so the two must agree here and only here. */
    if (body.ability !== body.baseAbility) wrongBefore.push(`${base}: .ability=${body.ability} baseAbility=${body.baseAbility}`);
    /* AFTER: a real turn in which the body is told to mega. The hand-written MEGA_ABIL entry is what
     * section 2 above just proved correct against board.js's derivation, so it is the right thing to
     * compare to — and this is the assertion the old one has become. */
    let after = null;
    try {
      const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
      const S = MED.battleInit([body, ally], [f1, f2], { seeded: true, autoMega: false });
      const act = MED.playerAction(body, (body.moves || []).find(x => MC.moves[x]) || 'protect', f1, S.field);
      if (act) act.mega = true;
      MED.battleTurn(S, () => 0.5, new Map([[body, act], [ally, { kind: 'pass' }]]),
        new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
      after = body.ability;
    } catch (e) { unbuildable.push('evolve ' + base + ': ' + String((e && e.message) || e).slice(0, 40)); }
    if (after !== ab) wrongAfter.push(`${base}: after the mega .ability=${after} want ${ab}`);
  }
  ok(built > 20 && wrongBefore.length === 0 && unnormalised.length === 0,
    `BEFORE the choice, .ability is the BASE forme's on all ${built} buildable stone-holders`
    + (wrongBefore.length ? ` — ${wrongBefore.length} wrong: ${wrongBefore.slice(0, 4).join('; ')}` : '')
    + (unnormalised.length ? ` — ${unnormalised.length} not normalised: ${unnormalised.slice(0, 4).join(', ')}` : '')
    + (unbuildable.length ? ` — ${unbuildable.length} THREW while building: ${unbuildable.slice(0, 3).join('; ')}` : ''));
  ok(built > 20 && wrongAfter.length === 0,
    `AFTER a real turn in which it megas, .ability is the MEGA's on all ${built}`
    + (wrongAfter.length ? ` — ${wrongAfter.length} wrong: ${wrongAfter.slice(0, 4).join('; ')}` : ''));

  /* AND THE MEGA-KEYED DOOR, which is the one that was broken: buildMon called with the mega's own
   * row rather than a base that evolved. Both doors must agree or half the callers are wrong — and
   * since ROADMAP #31 the first door only reaches the mega ability by actually EVOLVING, so this now
   * compares an evolved body against a body built straight from the mega row. */
  const both = Object.keys(hand).map(b => [b, stoneFor[b]]).filter(([, s]) => s)
    .map(([b, s]) => {
      let viaStone = null, viaRow = null;
      try {
        viaStone = MED.buildMon(b, { [b]: s });
        if (viaStone) {
          const ally = bare('clefable'), f1 = bare('garchomp'), f2 = bare('milotic');
          const S = MED.battleInit([viaStone, ally], [f1, f2], { seeded: true, autoMega: false });
          const act = MED.playerAction(viaStone, (viaStone.moves || []).find(x => MC.moves[x]) || 'protect', f1, S.field);
          if (act) act.mega = true;
          MED.battleTurn(S, () => 0.5, new Map([[viaStone, act], [ally, { kind: 'pass' }]]),
            new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
        }
      } catch (e) { unbuildable.push('viaStone ' + b + ': ' + String((e && e.message) || e).slice(0, 40)); viaStone = null; }
      try { viaRow = MED.buildMon(b + '-mega', {}) || MED.buildMon(b + '-mega-y', {}); }
      catch (e) { unbuildable.push('viaRow ' + b + ': ' + String((e && e.message) || e).slice(0, 40)); viaRow = null; }
      return { b, viaStone, viaRow };
    }).filter(x => x.viaStone && x.viaRow);
  const disagree = both.filter(x => x.viaStone.ability !== x.viaRow.ability)
    .map(x => `${x.b}: evolved=${x.viaStone.ability} row=${x.viaRow.ability}`);
  ok(both.length > 10 && disagree.length === 0,
    `an EVOLVED body and the mega row agree on the ability for all ${both.length} checkable megas`
    + (disagree.length ? ` — ${disagree.length} differ: ${disagree.slice(0, 4).join('; ')}` : '')
    + (unbuildable.length ? ` — ${unbuildable.length} build attempt(s) THREW` : ''));
}

/* ---- 3. THE TRIPWIRE — WHO ACTUALLY READS A LIVE STONE-HOLDER'S ABILITY ----------------------
 *
 * REPLACED THE COUNTER WITH A CHECK (Will, 2026-08-23: "you do what you think is best just make it
 * a permanent solution"). Everything under section 4 below used to be the gate; it is now an
 * inventory that fails nothing, and this is the gate.
 *
 * WHY A COUNTER COULD NOT BE MADE PERMANENT. The old assertion was "no file's count of a regex may
 * rise". Seven agents reported it red at six different totals (869, 1048, 1471, 1561, 1596, 1597),
 * two of them BELOW the baseline of the day; a wholesale restamp on 2026-08-11 adopted 964 reads
 * unreviewed and it was red again inside a week; and it twice made people reword COMMENTS to hold a
 * number still. When MEASURE walked the 130 matches that were red on 2026-08-23, ZERO were
 * stale-identity reads: 44 prose, 12 writes, 122 reads of `baseStats` — a field no live body in this
 * repository has — and ~27 live-body reads that all deliberately want and receive the effective
 * value. 62% of the growth was the calendar: 24 of the 30 files did not exist when the baseline was
 * taken. A number that moves with the SIZE of the repository is not measuring risk.
 *
 * WHAT THE RISK ACTUALLY IS, stated so an instrument can be built against it: a consumer holds a
 * LIVE Pokemon standing on the field with a mega stone, reads the DECLARED ability, and acts on it —
 * when the thing on the field has the mega's ability instead. Mega Gengar's sheet says Cursed Body;
 * the thing on the field has Shadow Tag.
 *
 * SO THE FIELD IS BOOBY-TRAPPED AND THE ENGINE IS RUN. Every mon a Board switches in gets a
 * recording accessor on `ability`, `baseStats`, `weighthg` and `weightkg`. Every active on both
 * sides holds a mega stone whose forme ability differs from every ability its base forme can have,
 * so on THIS board the declared value is wrong for every single mon and any raw read is a defect by
 * construction. The board is then driven through the live decision path and every read is recorded
 * with its stack. Exactly one call site is allowed to see the raw field: board.js `effective()`, the
 * accessor. That is Fowler's SELF ENCAPSULATE FIELD stated as an executable assertion rather than as
 * a count, and it is the refactoring this file's own header has cited since 2026-08-02.
 *
 * WHAT THIS CATCHES THAT NO TEXT SCAN CAN. The accessor fires on the property access itself, so the
 * spelling is irrelevant:
 *
 *   mon.ability                    the shape the old regex saw
 *   const { ability } = mon        destructuring        — the old scan counted these separately
 *   ({ ability }) => ...           destructured param   — same
 *   Object.assign({}, mon)         a copy, then read    — NAMED AS UNDETECTABLE BY ANY TEXT SCAN
 *   { ...mon }                     spread               — same
 *   mon[k], k computed at runtime  computed key         — NAMED AS UNDETECTABLE BY ANY TEXT SCAN
 *
 * The last three are the shapes the old header conceded it could never see, and an unanticipated
 * spelling is how this class of gate actually fails here: 2026-08-22's sibling case was a bare
 * `globalThis.` prefix walking past a ratchet in eight files. `ABRA_EI_PLANT` plants all six shapes
 * on demand and this gate names every one of them.
 *
 * IT ALSO CATCHES A CONSUMER NOBODY ANTICIPATED, because it enumerates no shapes and no call sites:
 * the poison is installed on the Board class, so any code reached from the drive list below is
 * covered the day it is written, with no edit here.
 *
 * WHAT IT PROVABLY CANNOT DO, AND THIS IS THE HONEST LIMIT OF THE WHOLE FILE
 * -------------------------------------------------------------------------
 * ITS COVERAGE IS EXECUTION COVERAGE. A consumer this file never drives is not checked, and no
 * amount of prose changes that. The drive list is PRINTED on every run for exactly that reason —
 * read it, and judge whether your consumer is in it. Driven today:
 *
 *   board.js              candidates() + featuresFor()   every candidate for all four actives
 *   board.js              foeActionDistribution()
 *   position_features.js  positionFeatures()             both sides
 *   rollout_leaf.js       rolloutWinProb()               the leaf, on a small n
 *
 * That is the MAG feature path and the leaf, which is where a stale identity would reach a decision.
 * It is NOT: magnemite.js's live loop, the fitters, the differential harnesses, or anything that
 * builds its own bodies instead of a Board. A raw read inside medicham2-browser.js is a DIFFERENT
 * and legitimate case — that engine materialises the effective ability into `.ability` — and section
 * 2b pins it behaviourally rather than counting it.
 *
 * IT POISONS BOARD SLOT MONS ONLY. A sheet entry's `.ability` genuinely IS the pre-mega one and
 * reading it is correct; that was always this ratchet's stated legitimate case, and it is now
 * excluded BY CONSTRUCTION instead of by 32 hand-written per-file declarations.
 *
 * AND IT IS BLIND TO A VALUE COPIED BEFORE THE BOARD EXISTED. If a consumer snapshots the sheet into
 * its own object and then treats that object as live, the read happens on something this file never
 * poisoned and nothing here detects it. That is the old scan's `Object.assign` hole MOVED rather
 * than closed, and it is stated so that a green run is not read as a proof.
 */
const vm = require('vm');

const TRIP_FIELDS = ['ability', 'baseStats', 'weighthg', 'weightkg'];
const TRIP = [];
let TRIP_ARMED = false;
const POISONED = new WeakSet();

/* The accessor keeps the value in a closure and hands back exactly what was there, so nothing
 * downstream behaves differently because it is being watched. `enumerable` mirrors whether the
 * property existed, so JSON.stringify of a board mon still produces the same JSON — a live body has
 * no `baseStats`, and inventing one would change what the engine sees. */
function poison(mon) {
  if (!mon || typeof mon !== 'object' || POISONED.has(mon)) return;
  POISONED.add(mon);
  for (const f of TRIP_FIELDS) {
    const d = Object.getOwnPropertyDescriptor(mon, f);
    if (d && !d.configurable) continue;
    const own = !!d;
    let v = own ? mon[f] : undefined;
    Object.defineProperty(mon, f, {
      configurable: true, enumerable: own,
      get() { if (TRIP_ARMED) TRIP.push({ field: f, stack: new Error().stack }); return v; },
      set(x) { v = x; },
    });
  }
}

/* INSTALLED ON THE CLASS, NOT ON FOUR OBJECTS. Poisoning only the mons this file happens to hold
 * would miss every body a consumer switches in for itself mid-drive, which is precisely the code a
 * regression would live in. */
const _origSwitchIn = B.Board.prototype.switchIn;
B.Board.prototype.switchIn = function (...a) {
  const r = _origSwitchIn.apply(this, a);
  for (const s of ['p1', 'p2']) for (const L of ['a', 'b']) { try { poison(this.slot(s, L)); } catch (e) { /* nothing there */ } }
  return r;
};

const SELF = __filename.replace(/\\/g, '/').toLowerCase();
const SRC_CACHE = new Map();
function srcLine(file, n) {
  if (!SRC_CACHE.has(file)) {
    let a = null; try { a = fs.readFileSync(file, 'utf8').split('\n'); } catch (e) { a = null; }
    SRC_CACHE.set(file, a);
  }
  const a = SRC_CACHE.get(file);
  return a && a[n - 1] != null ? a[n - 1].trim() : '<source unavailable>';
}
/* The first frame that is neither the accessor above nor this file. Node's own frames are skipped,
 * so a read arriving through JSON.stringify is attributed to the caller that asked for it. */
function siteOf(stack) {
  for (const ln of String(stack).split('\n').slice(1)) {
    const m = ln.match(/\(?([^()]+?):(\d+):(\d+)\)?\s*$/);
    if (!m) continue;
    /* `at ` survives the capture on a frame with no function name — V8 prints those as
     * `    at C:\...\file.js:249:38` with no parentheses to bound the path. Stripping it is not
     * cosmetic: the un-stripped path made path.isAbsolute() false, so the site was reported by its
     * raw Windows path and never matched a declaration. */
    const file = m[1].trim().replace(/^at\s+/, '');
    if (/^node:/.test(file) || file === 'native') continue;
    if (file.replace(/\\/g, '/').toLowerCase() === SELF) continue;
    const fn = (ln.match(/at\s+(?:async\s+|new\s+)?([^\s(]+)\s*\(/) || [])[1] || '';
    let rel = file;
    if (path.isAbsolute(file)) {
      const r = path.relative(ROOT, file).replace(/\\/g, '/');
      if (r && !r.startsWith('..')) rel = r;
    }
    return { file, rel, line: +m[2], fn, text: srcLine(file, +m[2]) };
  }
  return null;
}

/* THE ONE ALLOWED READER, AND THE ONE DECLARED GAP.
 *
 * This is not the old DECLARED list in a new costume. That one held 32 FILES; this holds CALL SITES,
 * and a site only reaches it after the tripwire has PROVED the read happens on a live stone-holder
 * whose sheet is wrong. Two rules, and the second is the one the old mechanism did not have:
 *
 *   1. A declaration states a reason about CONSTRUCTION, as before.
 *   2. A declaration whose safety rests on a FACT ABOUT THE FORMAT carries a guard() that RE-DERIVES
 *      that fact every run and fails the gate BY NAME when it stops being true. A declaration that
 *      cannot rot is worth more than one that is merely well argued. */
const RUNTIME_ALLOWED = [
  {
    file: 'engine/board.js', fn: 'effective',
    why: 'THE ACCESSOR ITSELF. effective() is the one function in this project permitted to read the '
      + 'raw field: it reads the declaration and then decides, from the species and the stone, whether '
      + 'that declaration is still true. Routing it through itself is a cycle. Every other read in the '
      + 'repository is supposed to arrive here.',
  },
  {
    file: 'engine/position_features.js',
    text: "return { ability: B.norm(f.mon.ability || e.ability || \'\'), fainted: false };",
    why: 'FOUND BY THIS TRIPWIRE ON ITS FIRST RUN, 2026-08-23. It is a genuine raw read of a live '
      + 'stone-holder that the old count ratchet was GREEN on and had been since 2026-08-02 — the file '
      + 'sits exactly at its per-file baseline of 5, so no count could ever have found it. It builds '
      + 'the defender list for priorityRefusedAbove(). board.js has the SAME function one file over '
      + 'and that copy DOES resolve (`effAbility(f.mon, dex)`, board.js:3520), so this is one fact with '
      + 'two implementations — the failure CLAUDE.md names as FEATURES ARE PER-MODEL, FACTS ARE GLOBAL. '
      + 'DECLARED rather than fixed because MEASURE does not own engine/position_features.js; the fix '
      + 'is proposed as a roadmap row. EXPOSURE IS ZERO TODAY AND THE GUARD RE-DERIVES IT: the value '
      + 'is consumed only by the priority bar, and no legal mega gains or loses a blocksMove ability.',
    guard: () => {
      /* Nothing named. The bar is read off data/tags.json through the same door the engine uses, and
       * the megas are swept out of the format. If a future mega gains one of these the gate goes red
       * on this entry BY NAME rather than on a total. */
      const bar = new Set();
      try {
        const TAGSMOD = require(D('engine', 'tags.js'));
        for (const id of TAGSMOD.withTag('ability', 'blocksMove')) bar.add(id);
      } catch (e) { return { ok: false, note: 'the guard could not read the blocksMove tag: ' + e.message }; }
      if (!bar.size) return { ok: false, note: 'the blocksMove tag set is EMPTY — the guard is asking nothing' };
      const hit = [];
      for (const it of dex.items.all()) {
        if (!it.megaStone) continue;
        for (const sp of dex.species.all()) {
          if (!sp.exists || sp.isMega || sp.isNonstandard) continue;
          const forme = B.megaFormeOf(B.norm(sp.name), B.norm(it.name), dex);
          if (!forme) continue;
          const m = dex.species.get(forme);
          if (!m || !m.exists) continue;
          const mab = Object.values(m.abilities || {}).map(a => B.norm(a));
          const bab = Object.values(sp.abilities || {}).map(a => B.norm(a));
          if (mab.some(a => bar.has(a) && !bab.includes(a)) || bab.some(a => bar.has(a) && !mab.includes(a))) {
            hit.push(`${sp.name}+${it.name}`);
          }
        }
      }
      return {
        ok: hit.length === 0,
        note: hit.length
          ? `${hit.length} mega(s) now CHANGE a priority-blocking ability (${hit.slice(0, 4).join(', ')}) — `
            + 'the declared gap is LIVE and this read must resolve through effAbility()'
          : `0 of the format's megas change a blocksMove ability (bar: ${[...bar].sort().join(', ')})`,
      };
    },
  },
];

function allowedFor(site) {
  return RUNTIME_ALLOWED.find(a => a.file === site.rel
    && ((a.fn && site.fn === a.fn) || (a.text && site.text === a.text)));
}

/* ---- THE BOARD: EVERY ACTIVE IS A STONE-HOLDER WHOSE SHEET IS WRONG --------------------------
 * Swept out of the dex and the damage table. No species, stone or ability is named here, for the
 * same reason section 1 sweeps for its mega case: a fixture that names things stops exercising the
 * format the day the format changes. */
function stoneCases(dex) {
  B.damageEngine();
  /* THROUGH mcKey.row(), NOT MC.mons[...]. The table is a guarded proxy: indexing it with a spelling
   * it does not carry THROWS by design (engine/lookup.js), and "this species has no damage row" is a
   * legitimate answer to a sweep, so the miss is declared rather than caught. */
  const { mcKey } = require(D('engine', 'mc_key.js'));
  const rowFor = n => mcKey.row(n, { mayMiss: 'sweeping the whole dex for a buildable stone-holder; most species have no row' });
  const out = [];
  const seen = new Set();
  for (const it of dex.items.all()) {
    if (!it.megaStone) continue;
    const stone = B.norm(it.name);
    if (/z$/.test(stone)) continue;              /* the Z megas, excluded for the reason section 2b gives */
    for (const sp of dex.species.all()) {
      if (!sp.exists || sp.isMega || sp.isNonstandard) continue;
      const base = B.norm(sp.name);
      if (seen.has(base)) continue;
      const row = rowFor(base);
      if (!row || !Array.isArray(row.mv) || !row.mv.length) continue;   /* no damage row -> the board cannot build it */
      const forme = B.megaFormeOf(base, stone, dex);
      if (!forme) continue;
      const m = dex.species.get(forme);
      if (!m || !m.exists) continue;
      const mab = Object.values(m.abilities || {}).map(a => B.norm(a)).filter(Boolean);
      const bab = Object.values(sp.abilities || {}).map(a => B.norm(a)).filter(Boolean);
      if (mab.length !== 1 || bab.includes(mab[0])) continue;           /* the sheet must be WRONG, or nothing is proved */
      seen.add(base);
      out.push({
        base, name: sp.name, stone: it.name, want: mab[0], sheetAb: bab[0] || 'none',
        moves: row.mv.slice(0, 4), nature: row.nature || 'Adamant',
      });
    }
  }
  return out;
}

const DRIVEN = [];
{
  const cases = stoneCases(dex);
  ok(cases.length >= 8,
    `swept ${cases.length} stone-holders whose SHEET ABILITY IS WRONG and which the damage table can build`);

  const PF = require(D('engine', 'position_features.js'));
  const RL = require(D('engine', 'rollout_leaf.js'));
  const board = new B.Board();
  const pick = { p1: cases.slice(0, 2), p2: cases.slice(2, 4) };
  const bench = { p1: cases.slice(4, 6), p2: cases.slice(6, 8) };
  for (const side of ['p1', 'p2']) {
    for (const c of pick[side].concat(bench[side])) {
      board.setSheet(side, c.name, { nature: c.nature, item: c.stone, ability: c.sheetAb, moves: c.moves });
    }
    board.setParty(side, pick[side].concat(bench[side]).map(c => c.name));
    board.switchIn(side, 'a', pick[side][0].name);
    board.switchIn(side, 'b', pick[side][1].name);
  }

  /* THE INSTRUMENT MUST BE SHOWN TO BE MEASURING SOMETHING. If the sheet and the effective ability
   * ever agreed on this board, every read below would be safe and the gate would pass by asking
   * nothing — the exact failure docs/LESSONS.md records as a green test that asks nothing. */
  const wrongOnBoard = [];
  for (const side of ['p1', 'p2']) for (const L of ['a', 'b']) {
    const m = board.slot(side, L);
    if (!m) continue;
    if (B.effAbility(m, dex) !== m.ability) wrongOnBoard.push(`${m.species}: sheet=${m.ability} effective=${B.effAbility(m, dex)}`);
  }
  ok(wrongOnBoard.length === 4,
    `all 4 actives are mid-transformation — the DECLARED ability is wrong for every one of them (${wrongOnBoard.length}/4)`);

  const drive = (label, fn) => {
    DRIVEN.push(label);
    try { fn(); } catch (e) { DRIVEN[DRIVEN.length - 1] = label + ' [THREW: ' + String((e && e.message) || e).slice(0, 60) + ']'; }
  };

  TRIP_ARMED = true;
  for (const side of ['p1', 'p2']) for (const L of ['a', 'b']) {
    const user = board.slot(side, L);
    if (!user) continue;
    drive(`board.js candidates()+featuresFor()      ${side}${L}`, () => {
      const cands = B.candidates(user.moves, user, board, side, dex);
      cands.forEach((c, i) => B.featuresFor(c, user, board, side, dex, (i + 1) / (cands.length + 1)));
    });
    drive(`board.js foeActionDistribution()         ${side}${L}`, () => {
      B.foeActionDistribution(board, side === 'p1' ? 'p2' : 'p1', user, dex);
    });
  }
  for (const side of ['p1', 'p2']) {
    drive(`position_features.js positionFeatures()  ${side}`, () => PF.positionFeatures(board, side, dex));
    drive(`rollout_leaf.js rolloutWinProb(n=2)      ${side}`, () => RL.rolloutWinProb(board, side, { n: 2, dex }));
  }

  /* ---- THE PLANTED DEFECT, ON DEMAND ---------------------------------------------------------
   * ABRA_EI_PLANT=dot|destructure|param|spread|assign|computed|all
   *
   * Compiled through `vm` rather than written to a file on disk, so these shapes exist ONLY while
   * the knob is set and no scanner in this repository can ever count them as debt. Each one reads
   * the booby-trapped field off a live stone-holder, so each one is a real defect; the gate must
   * name every one, and the three marked NO TEXT SCAN are shapes the old header conceded it could
   * never see. */
  const PLANTS = {
    dot: 'return mon.ability;',
    destructure: 'const { ability } = mon; return ability;',
    param: 'return (({ ability }) => ability)(mon);',
    spread: 'const copy = { ...mon }; return copy.ability;',                  /* NO TEXT SCAN */
    assign: 'const copy = Object.assign({}, mon); return copy.ability;',      /* NO TEXT SCAN */
    computed: 'const k = ["abi", "lity"].join(""); return mon[k];',           /* NO TEXT SCAN */
  };
  const want = String(process.env.ABRA_EI_PLANT || '').trim();
  if (want) {
    const which = want === 'all' ? Object.keys(PLANTS) : want.split(',').map(s => s.trim()).filter(s => PLANTS[s]);
    if (!which.length) console.log(`  note: ABRA_EI_PLANT='${want}' matches no plant. Known: ${Object.keys(PLANTS).join(', ')}, all`);
    for (const k of which) {
      const f = vm.compileFunction(PLANTS[k], ['mon'], { filename: D('engine', `_planted_stale_read_${k}.js`) });
      drive(`PLANTED DEFECT (${k})`, () => f(board.slot('p1', 'a')));
    }
  }
  TRIP_ARMED = false;
}

/* ---- THE VERDICT ---------------------------------------------------------------------------- */
const SITES = new Map();
let unattributed = 0;
for (const t of TRIP) {
  const s = siteOf(t.stack);
  if (!s) { unattributed++; continue; }
  const key = `${s.rel}:${s.line}`;
  const e = SITES.get(key) || { site: s, n: 0, fields: new Set() };
  e.n++; e.fields.add(t.field);
  SITES.set(key, e);
}
const offenders = [...SITES.values()].filter(e => !allowedFor(e.site));

/* A CAPABILITY THAT CANNOT PROVE IT RAN IS ASSUMED BROKEN. A tripwire that recorded nothing would
 * report "no unauthorised reads" while measuring an empty set — the single most likely way this
 * instrument rots is somebody changing a signature, every drive throwing, and the gate going green
 * on zero observations. */
ok(TRIP.length > 0 && SITES.size > 0,
  `the tripwire FIRED — ${TRIP.length} read(s) of a booby-trapped field across ${SITES.size} call site(s)`);

ok(offenders.length === 0,
  `every read of a live stone-holder's identity goes through board.js effective() (${offenders.length} site(s) do not)`
  + (offenders.length ? '\n         ' + offenders.map(e =>
    `${e.site.rel}:${e.site.line}  x${e.n} [${[...e.fields].join(',')}]\n           ${e.site.text}`).join('\n         ') : ''));
if (offenders.length) {
  console.log('         A LIVE Pokemon holding a mega stone does NOT have the ability its sheet declares.');
  console.log('         Route the read through board.js effAbility(mon, dex) / effective(mon, dex).');
  console.log('         If it is correct BY CONSTRUCTION, add it to RUNTIME_ALLOWED with the reason — and if');
  console.log('         the reason is a fact about the format, add the guard() that re-derives that fact.');
}

/* Every guard, re-derived now. A declaration resting on a fact must fail when the fact moves. */
const guardFails = [];
for (const a of RUNTIME_ALLOWED) {
  if (typeof a.guard !== 'function') continue;
  let r; try { r = a.guard(); } catch (e) { r = { ok: false, note: 'the guard THREW: ' + e.message }; }
  if (!r || !r.ok) guardFails.push(`${a.file}: ${(r && r.note) || 'the guard returned false'}`);
}
ok(guardFails.length === 0,
  `every declared exception's guard still holds (${RUNTIME_ALLOWED.filter(a => a.guard).length} re-derived this run)`
  + (guardFails.length ? '\n         ' + guardFails.join('\n         ') : ''));

console.log('\n  DRIVEN — this gate\'s coverage is EXECUTION coverage, so this list IS the claim:');
for (const d of DRIVEN) console.log(`    ${d}`);
console.log('  Anything not on that list is NOT checked here. See the header.');
console.log(`\n  READ SITES — ${SITES.size} site(s), ${TRIP.length} read(s)${unattributed ? `, ${unattributed} unattributable` : ''}:`);
for (const e of [...SITES.values()].sort((a, b) => b.n - a.n)) {
  console.log(`    ${allowedFor(e.site) ? 'ALLOWED ' : 'OFFENDER'} ${String(e.n).padStart(4)}  ${e.site.rel}:${e.site.line}  [${[...e.fields].join(',')}]`);
}
console.log('\n  RUNTIME DECLARED EXCEPTIONS — printed every run, because an exemption nobody sees is a mute button:');
for (const a of RUNTIME_ALLOWED) {
  console.log(`    ${a.file}${a.fn ? ` ${a.fn}()` : ''}\n        ${a.why}`);
  if (a.guard) {
    let r; try { r = a.guard(); } catch (e) { r = { ok: false, note: e.message }; }
    console.log(`        GUARD (re-derived this run): ${r && r.ok ? 'HOLDS' : 'FAILED'} — ${(r && r.note) || ''}`);
  }
}
if (!process.env.ABRA_EI_PLANT) {
  console.log('\n  To see this gate RED on a deliberate break, without editing anything:');
  console.log('    ABRA_EI_PLANT=all node tests/test-effective-identity.js');
}

/* ---- 4. THE OLD COUNT RATCHET, RETIRED — now an inventory ------------------------------------ */

const SKIP_DIR = /node_modules|[\\/]graveyard[\\/]|[\\/]archive[\\/]/;
/* Deliberately over-broad, then baselined. A clever regex that decides which reads are "fine" is
 * how the next one gets through — the same reasoning docs/ARTIFACT-ACCESS-RULES.md 5 gives for the
 * mc_key sweep. */
const RAW = /\.(ability|baseStats|weighthg|weightkg)\b/g;

/* ---- THE CLASSIFIER (MEASURE, 2026-08-23) ----------------------------------------------------
 *
 * `RAW` stays exactly as it is — the superset. This labels what it found so a reader can act on the
 * number instead of restamping it. See the header for what it cannot see.
 *
 * `zones()` walks the source once and marks every character as code, comment or string. It is a
 * lexer rather than a line test on purpose: `docs/ENGINE.md` records the field name appearing inside
 * BREAK PATCHES — quoted engine source handed to `String.replace` — and all thirteen of
 * `tests/staged_board.js`'s matches are that shape. A line-based "does this start with a star" test
 * calls every one of them code. */
function zones(src) {
  const z = new Uint8Array(src.length);   // 0 code, 1 comment, 2 string
  const BT = String.fromCharCode(96);
  let i = 0; const n = src.length;
  const fill = (a, b, v) => { for (let k = a; k < b; k++) z[k] = v; };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { let j = i; while (j < n && src[j] !== '\n') j++; fill(i, j, 1); i = j; continue; }
    if (c === '/' && d === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; fill(i, j, 1); i = j; continue; }
    if (c === '"' || c === "'" || c === BT) {
      const q = c; let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === q) break;
        if (q !== BT && src[j] === '\n') break;      // an unterminated quote is prose, not a string
        j++;
      }
      fill(i, Math.min(j + 1, n), 2); i = Math.min(j + 1, n); continue;
    }
    i++;
  }
  return z;
}

/* PROSE — not executed, so it cannot return a stale identity.
 * WRITE — `x.ability = v`. A write cannot hand back the sheet's value; eight of the DECLARED entries
 *         below exist for no other reason than that the regex cannot tell a write from a read, and
 *         the `engine/tag_dex.js` and `tests/test-speed-tie.js` entries say so in as many words.
 * READ  — everything else. This is the only class the ratchet's stated risk can live in. */
function scan(src) {
  const z = zones(src);
  const out = { total: 0, prose: 0, write: 0, read: 0, blind: 0 };
  RAW.lastIndex = 0; let m;
  while ((m = RAW.exec(src))) {
    out.total++;
    const end = m.index + m[0].length;
    if (z[m.index]) { out.prose++; continue; }
    /* An assignment, and NOT `==`, `===` or `=>`. `+=`/`||=`/`??=` read before they write, so they
     * are deliberately left in the READ class rather than flattered into WRITE. */
    if (/^\s*=(?!=|>)/.test(src.slice(end, end + 8))) out.write++; else out.read++;
  }
  /* THE SHAPES THE SUPERSET CANNOT SEE, counted so the header's "0 sites today" is re-derived on
   * every run instead of being a sentence somebody typed once. A non-zero here is NOT a failure —
   * it is a signal that the superset regex has stopped covering the repository's idioms and this
   * whole ratchet is reading a shrinking fraction of the truth. */
  for (const re of [/(?:const|let|var)\s*\{[^}\n]*\b(?:ability|baseStats|weighthg|weightkg)\b[^}\n]*\}\s*=/g,
                    /\(\s*\{[^}\n]*\b(?:ability|baseStats|weighthg|weightkg)\b[^}\n]*\}\s*\)\s*=>/g]) {
    re.lastIndex = 0; let b;
    while ((b = re.exec(src))) if (!z[b.index]) out.blind++;
  }
  /* The bracket form, through the lexer. A naive /\['ability'\]/ fires on tests/roster.js:8725,
   * which is a string inside an ARRAY LITERAL — so a receiver token is required. */
  const BR = /\[\s*(['"])(ability|baseStats|weighthg|weightkg)\1\s*\]/g;
  BR.lastIndex = 0; let b2;
  while ((b2 = BR.exec(src))) {
    if (z[b2.index]) continue;
    const before = src.slice(Math.max(0, b2.index - 60), b2.index);
    if (!/[\w$)\]]\s*$/.test(before)) continue;      // no receiver -> it is an array literal
    out.total++; out.read++;
  }
  return out;
}

/* DECLARED EXCEPTIONS — a count with a REASON, which a baseline bump is not.
 *
 * WHY THIS EXISTS (2026-08-04). The ratchet went 234 -> 302 and every contributor was legitimate,
 * so the only two moves the file offered were "leave it red forever" or "--update", and --update
 * would have silently laundered engine/rollout_leaf.js's real violation along with them. That is a
 * check with no honest exit, and a check with no honest exit is the one that gets switched off.
 *
 * So a file whose raw reads are correct BY CONSTRUCTION says so here, with the reason, in the shape
 * this project already uses for a judged gap (CLAUDE.md, `RAW-STORE-OK`). Three rules keep it from
 * becoming a mute button:
 *
 *   1. A declaration needs a REASON, and the reason must be about CONSTRUCTION — "this object never
 *      holds a sheet" — not about "these particular lines looked fine when I read them".
 *   2. A declaration that can be PINNED is pinned. medicham2's is asserted in section 2b above, so
 *      the day its `.ability` stops being the effective one, the pin goes red before the count does.
 *   3. Every declared file is PRINTED on every run with its current count, so nothing hides in here.
 *
 * NOT declared, deliberately: engine/rollout_leaf.js, which was a real violation (docs/PRIORITIES.md
 * #40b — it read the PRE-mega ability to decide whether a mon is a weather setter, and a mega's
 * weather ability is precisely what differs from its base). It was fixed rather than declared. */
const DECLARED = {
  /* WIRE 133/136, 2026-08-07. The count went 8 -> 10 and both new reads are ON THE SAME LINE, in the
   * `formeOnHit` derivation: `JSON.stringify(base.baseStats) === JSON.stringify(sp.baseStats)`.
   *
   * CORRECT BY CONSTRUCTION, and the construction is the whole file. `tag_dex.js` HAS NO LIVE
   * POKEMON IN IT AT ALL — it walks `dex.species.all()` and `dex.abilities.all()` and emits
   * `data/tags.json`. There is no battle, no turn and no stone spent anywhere in it, so there is no
   * effective identity for `effAbility(mon, dex)` to compute; a DEX SPECIES's `baseStats` is the
   * species' own table entry and is exactly the thing being compared. The read asks whether Mimikyu
   * and Mimikyu-Busted have identical base stats, which decides whether a consumer may perform that
   * forme change as a RENAME or must rebuild the body — the opposite of a stale-identity bug.
   * The other eight reads are the same shape and predate this note.
   *
   * PINNED, not merely asserted: the value this line produces is written into the artifact as
   * `formeOnHit.sameStats`, and `tests/test-mechanics.js` probes the consumer that reads it. */
  'engine/tag_dex.js':
    'No live Pokemon exists anywhere in this file — it walks dex.species.all() and dex.abilities.all() '
    + 'and emits data/tags.json. A DEX SPECIES\'s .baseStats is the species table\'s own entry, not a '
    + 'body\'s, so there is no effective identity for effAbility() to compute and routing it through '
    + 'one would be a category error. The two reads added 2026-08-07 are a single comparison asking '
    + 'whether a base forme and its battle-only forme have identical base stats, which is what decides '
    + 'whether a consumer may perform that forme change as a rename or must rebuild the body.',
  /* WIRE 134, 2026-08-07. One read, and it is an ASSIGNMENT rather than a read at all: `m.ability =
   * 'none'`. The regex is DELIBERATELY over-broad (see its comment) and does not distinguish the two.
   * The line is this repository's standard probe fixture — blank the item and the ability so the
   * probe sets the one thing it varies and nothing can supply it silently — copied verbatim from
   * tests/test-mechanics.js's `bare()`. There is no read of an effective identity to get wrong. */
  'tests/test-speed-tie.js':
    'One match and it is an ASSIGNMENT, not a read: `m.ability = \'none\'` in the standard probe '
    + 'fixture that blanks the item and the ability so the probe sets the one thing it varies. The '
    + 'RAW regex is deliberately over-broad and cannot tell a write from a read. Nothing in this file '
    + 'ever reads an ability.',
  'engine/leaf_engine_contrast.js':
    'One read, in a helper literally named `sheet()`, and it is this test\'s own stated legitimate '
    + 'case. The line BUILDS A DECLARATION rather than reading a live body: `M.buildMon(k, {})` is '
    + 'called one statement earlier and its `.ability` is copied straight into a `{species, item, '
    + 'ability, moves}` row, which is the shape a team sheet has. There is no battle, no turn and no '
    + 'stone spent between the construction and the read — the two lines are adjacent. A sheet entry\'s '
    + '`.ability` IS the pre-mega one, which this file wants: it is assembling the pre-battle '
    + 'declaration the leaf contrast plays FROM. Routing it through effAbility() would write the '
    + 'POST-mega ability into a sheet, so a Charizard row would declare Drought and the arm would start '
    + 'from a board no player could have brought. AND THE CLAIM IS PINNED RATHER THAN ASSERTED: the '
    + 'first two checks in this same file already prove buildMon\'s `.ability` is the BASE forme\'s on '
    + 'all 62 buildable stone-holders before the choice, and the MEGA\'s on all 62 after a real turn in '
    + 'which it evolves — so the value being read here is exactly the one those checks pin, and if that '
    + 'ever stops being true this exception fails beside them rather than laundering the change. '
    + 'Appeared 2026-08-07 when MEASURE added the arm; the count moved 0 -> 1 and nothing else in the '
    + 'file changed.',
  'engine/mega_decision_census.js':
    'Four reads of the slot-0 ability off DEX SPECIES ROWS, a mega forme and its base, and THE '
    + 'QUESTION THE FILE ASKS IS THAT DECLARATION. It censuses what the dex says changes on evolving, '
    + 'written to establish whether "the ability changed" is a safe test. It is not: 21 of 98 megas '
    + 'keep their base slot-0 ability (Tyranitar, Medicham, Latias), so the correct invariant is that '
    + 'the post-evolution ability EQUALS the dex value for the mega forme. Routing these through an '
    + 'effective-ability resolver would be CIRCULAR BY CONSTRUCTION: that resolver computes the '
    + 'post-mega ability, which is the very quantity this census exists to establish, so the file '
    + 'would agree with itself and report every mega as correct whatever the dex holds. No body is '
    + 'built, no battle state loaded, no sheet read; it walks Dex.species.all() and counts JSONL '
    + 'events. PINNED rather than trusted, per rule 2 above: it throws if the forme table is empty or '
    + 'the weather map is empty, so a name lookup matching nothing cannot be published as a 0. '
    + 'Written 2026-08-06, and written WHILE AN ENGINE AGENT HELD THIS TREE, which is how it turned '
    + 'this gate red at all. That was a routing failure, not a code one. See CLAUDE.md on a measuring '
    + 'agent running beside a writing one.',
  'engine/validate_store.js':
    'Two reads, both of a STORED SET — `s.ability` and `s.item` off `g.sets[species]` — handed to '
    + 'Showdown\'s TeamValidator. A validator judges a DECLARATION, so the pre-mega ability is not '
    + 'merely acceptable here, it is the only thing the question accepts: `Charizard` with `Drought` '
    + 'is an invalid team, `Charizard` with `Blaze` plus a Charizardite Y is the legal one people '
    + 'actually submit. Resolving to the effective ability would make every mega user read as an '
    + 'illegal team. No body is built and no dex is loaded — the file reads JSONL, constructs plain '
    + 'objects and calls validateTeam. '
    + 'AND THE CASE WHERE THE FIELD IS *NOT* PRE-MEGA IS HANDLED RATHER THAN ASSUMED AWAY: a '
    + 'closed-sheet replay sometimes reveals the POST-mega ability and the extractor writes it onto '
    + 'the base row, which is why the validator returns "meowstic (Meowstic) can\'t have Intimidate" '
    + '9 times and "gardevoir (Gardevoir) can\'t have Pixilate" 7 times. Those are classified '
    + 'OBSERVED, not ILLEGAL, by the OBSERVED table in that file — the store holds what the battle '
    + 'showed, not what the player typed. Written 2026-08-06.',
  'tests/test-protocol-trace.js':
    'One read, and it is a WRITE\'s left-hand side in disguise: `if (ability) b.ability = ability` in '
    + 'the local `mon()` helper, which STAGES a body for a scenario. Nothing is resolved from it and '
    + 'nothing is consumed. It is correct BY CONSTRUCTION rather than by inspection: this file builds '
    + 'every body itself with `M.buildMon()` and then SETS the ability it wants to test, so there is '
    + 'no sheet entry and no pre-mega/post-mega question to get wrong — the value on the body is the '
    + 'value this file just put there. It loads no mega, stages no stone, and its one Showdown arm '
    + 'takes the ability from the same literal. AND THE ONE PLACE THE ABILITY MATTERS TO A RESULT — '
    + 'the Intimidate/Blaze control in PART 5 — is the ability being VARIED, which is the experiment, '
    + 'not a lookup. Written 2026-08-06 (ROADMAP #68).',
  'tests/regulation_usage.js':
    'Two reads, and both are of a STORED SHEET ENTRY — `s.ability` off `g.sheets[side][i]` and off '
    + '`g.sets[species]`, which are what the open team sheet declared at preview and what the '
    + 'extractor inferred from a closed-sheet replay. That is precisely the pre-mega ability, and it '
    + 'is this test\'s own stated legitimate case. It is correct BY CONSTRUCTION rather than by '
    + 'inspection: the file never builds, loads or touches a live Pokemon at all — it opens '
    + 'data/games.ladder.jsonl, counts strings, and returns maps of id -> integer. There is no body '
    + 'for effAbility() to resolve and no dex is loaded. AND THE PRE-MEGA ONE IS THE ANSWER THE '
    + 'QUESTION WANTS: it is computing how much USAGE each ability carries, and a Charizard that '
    + 'megas into Drought on turn one still had Blaze declared — docs/ENGINE.md records Blaze reading '
    + '4,585 uses for exactly that reason. Resolving to the effective ability here would move usage '
    + 'off the declared abilities and onto the mega ones, which is a different measurement from the '
    + 'one tests/test-medicham-coverage.js asks for. Written 2026-08-06.',
  'engine/dusk_size_gate.js':
    'One read, and it is this test\'s own stated legitimate case. The DUSK size gate counts how many '
    + 'DISTINCT 1v1 positions a tablebase would need, and the axis it counts along is the DECLARED '
    + 'SET — what the open team sheet said at preview. That is precisely the pre-mega ability, and it '
    + 'is the correct one here: two Charizard sheets differing only in stone are two different table '
    + 'entries whether or not either ever mega-evolves, because the table is keyed on what a player '
    + 'BROUGHT. Routing it through effAbility() would collapse a base forme and its mega onto one key '
    + 'and UNDERSTATE the position count — which is the direction that flatters DUSK, on the one '
    + 'measurement whose whole job was to say the table is too big. The file loads no engine module '
    + 'at all (it declares engine_release: none) and touches no live body anywhere.',
  'engine/feature_engine_contrast.js':
    'The two `.types` touches are on bodies THIS FILE just built, and the whole subject of the file is '
    + 'whether such a body carries a type list at all. Every ability and every type it puts ON those '
    + 'bodies already goes through board.js\'s own accessors — `B.effAbility(mon, dex)` and '
    + '`B.effTypes(mon, dex)` — so a mega\'s gained ability and changed typing are resolved before the '
    + 'read, which is what makes the partial arm a faithful copy of board.js:2570. The first read '
    + '(`if (d && !d.types)`) counts INCOMPLETE bodies inside a wrapper around priorityRefusedAbove, '
    + 'i.e. it is measuring the absence of the field rather than consuming its value; routing it '
    + 'through effTypes() would compute a type list for a body that has none and the counter would '
    + 'read zero on exactly the defect it exists to size. The second reads back the array the line '
    + 'above wrote, to label a differing row by its body. Walked 2026-08-05.',
  'tests/mutation_harness.js':
    'One match, and it is an ASSIGNMENT rather than a read: bare() writes `b.ability = \'none\'` onto '
    + 'a body M.buildMon has just returned, which is the construction case this test names as correct '
    + 'and which engine/medicham2-browser.js and tests/test-tag-wire.js are already declared for. The '
    + 'harness exists to STRIP a mechanic and re-run, so blanking the ability is the point of the '
    + 'function — there is no effective ability to resolve, because the whole intent is that the body '
    + 'carries none. Walked 2026-08-05; the file contains no other .ability or .species touch.',
  'engine/click_class.js':
    'Two reads, both of a FOE\'S ability, to detect Lightning Rod / Storm Drain redirection when '
    + 'classifying a human click. Declared rather than waved through, because the format DOES contain '
    + 'megas that gain a redirecting ability and would therefore need the effective one: Sceptile-Mega '
    + '(Lightning Rod) and all three Tatsugiri-Megas (Storm Drain) are legal here, checked against '
    + 'Dex.forFormat on 2026-08-05. Base Sceptile is Overgrow/Unburden, so a pre-mega read would miss '
    + 'a genuine redirection. EXPOSURE IS ZERO TODAY: neither Sceptilite nor Tatsugirite appears in '
    + 'data/games.ladder.jsonl at all, and Tatsugiri appears 3 times in any form. THE TRIGGER THAT '
    + 'MAKES THIS WRONG is one of those four megas appearing in the corpus, at which point the read '
    + 'must resolve the effective ability — this is a declared gap with a named cause, not a claim '
    + 'that the code is right in general.',
  'engine/medicham2-browser.js':
    'BUILDS its own bodies, and `.ability` on one of them is THE ABILITY THAT BODY HAS AT THAT '
    + 'MOMENT — the base forme\'s until it mega-evolves, the mega forme\'s afterwards — with the row\'s '
    + 'own ability kept in .baseAbility. It is a browser file with no require and board.js is '
    + 'downstream of it, so effAbility() is not reachable. Every match was walked on 2026-08-04 — '
    + '67 in code (the rest are this comment and the ones beside the fix, since the regex reads '
    + 'prose too): 66 of the 67 are live battle bodies this engine constructed, and the one '
    + 'exception (norm2(set.ability) in buildMonFromSet) reads a parsed SHEET, which is the case '
    + 'this test names as correct. PINNED by section 2b. '
    + 'RESTATED 2026-08-07 (ROADMAP #31): this used to say "materialises the EFFECTIVE ability at '
    + 'BUILD time", which was true of a body that was a chimera — base stats carrying the mega\'s '
    + 'ability, a Pokemon neither engine models. Mega evolution is a mid-turn CHOICE now, so the '
    + 'claim is pinned at BOTH moments instead of one and section 2b asserts each separately.',
  'engine/game_differential.js':
    'The whole-game differential harness (ROADMAP #68). It AUTHORS both engines\' team '
    + 'representations from one sheet, so 5 of its 8 matches are ASSIGNMENTS — writing the chosen '
    + 'ability onto the medicham body and into the Showdown set — and the value written is the '
    + 'sheet\'s DECLARED ability, which is correct by construction: a mega\'s ability must arrive by '
    + 'EVOLVING inside the turn, and the whole point of this instrument is that both engines start '
    + 'from the same declaration and evolve from it. Resolving to the effective ability here would '
    + 'hand Showdown an illegal set (Charizard with Drought) and would pre-mega the medicham body, '
    + 'which is the exact bug ROADMAP #31 removed. The 2 remaining reads are `id(m.ability)` in the '
    + 'COVERAGE bookkeeping, and §3.1 of docs/GAME-DIFFERENTIAL-DESIGN.md requires those to be '
    + 'OBSERVED off the live body rather than declared — a body that megaed into Trace and used it '
    + 'must not read as "Trace exercised: 0". The last is `sp.baseStats`, read off the DEX to build '
    + 'a stat line both engines compute identically. Declared 2026-08-07; this file has been over '
    + 'the ratchet SINCE THE MOMENT IT WAS WRITTEN on 2026-08-06, because '
    + 'data/effective-identity-baseline.json is dated 2026-08-02 and every read in a file newer than '
    + 'the baseline counts as new. That red was not caused by ROADMAP #31 and was not anybody\'s '
    + 'regression — it was waiting for someone to look, and it is recorded here so the next reader '
    + 'does not spend the time working that out again.',
  'tests/test-mega-timing.js':
    'Three matches, all in the ROADMAP #31 block that compares the engine\'s answer to the DEX\'s. '
    + 'Two are dex reads (`forme.abilities[0]`, `sp.abilities[0]`) — the AUTHORITY this file exists '
    + 'to check against, not a live body. The third is `me.ability` on a body this file built and '
    + 'then drove through a real turn, and it is the value UNDER TEST: routing it through '
    + 'effAbility() would compare board.js\'s answer to the dex instead of medicham2\'s, which is the '
    + 'same reasoning tests/test-interaction-matrix.js is declared under further down.',
  'tests/test-weather-duration.js':
    'Four weather setters — Torkoal, Pelipper, Tyranitar, Ninetales-Alola — built with a ROCK or '
    + 'Leftovers and never a mega stone, so the effective ability IS the base one and there is no '
    + 'pre/post-mega distinction for effAbility to resolve. Of the 5 matches, `m.ability = s.ability` '
    + 'is an ASSIGNMENT onto a body this file just built (the same case as test-mechanics.js), the '
    + '`ability:` entries are literals in the case table, and the read is of the value written one '
    + 'line above. Tyranitar is the one with a mega forme and it is the reason this is declared '
    + 'rather than waved through: it is safe only because the item is asserted to be the rock.',
  'tests/test-mechanics.js':
    'A census of behavioural probes. 45 of its 48 matches are ASSIGNMENTS — a probe setting the '
    + 'ability it is about to test on a body it just built. The 3 reads are the two mega-ability '
    + 'probes reading back the field under test.',
  'tests/test-tag-signature.js':
    'ONE MATCH, AND IT IS AN ASSIGNMENT — the blanking line in the same `bare()` fixture '
    + 'test-mechanics.js is declared for two entries up. (Written without the literal field name on '
    + 'purpose: the scanner is a grep over source text, so quoting the line here would itself count '
    + 'as a raw read and the declaration would inflate the number it declares.) This file never reads '
    + 'that field back: it '
    + 'resolves every move through playerAction on one fixed body and compares the resulting action '
    + 'KIND, and the whole reason the body is blanked is so no ability can supply anything silently. '
    + 'It also builds no mega and holds no stone, so there is no pre/post-mega value for effAbility '
    + 'to resolve. Declared 2026-08-11 with the file (ROADMAP #162/#127) rather than left to grow the '
    + 'undeclared count, which is what re-baselining would have laundered.',
  'tests/test-engine-diff.js':
    'CONTROL FIX 5 assigns the dex slot-0 ability onto BOTH engines so the input is held equal; '
    + 'every later read is of the value this file itself just wrote, and it is the effective one '
    + '(dex.species.get() is asked for the mega forme when the row is a mega).',
  'tests/test-damage-stages.js':
    'FOUR MATCHES, ALL ASSIGNMENTS, AND THE ASSIGNMENT IS THE POINT OF THE FILE (ROADMAP #92). Two '
    + 'write the scenario\'s chosen ability onto a medicham body buildMon has just returned '
    + '(`a.ability = ... : \'none\'`), and two write the same ability onto the Showdown side through '
    + '`setAb`. Nothing is read back. Both sides are set EXPLICITLY ON EVERY ROW, including the '
    + 'controls, and that is a correctness requirement rather than tidiness: the first version of '
    + 'this harness left the defender at its species default and so measured Araquanid\'s own Water '
    + 'Bubble against a blank and Heliolisk\'s own Dry Skin against a blank — the '
    + 'compare-a-Scarf-against-a-Scarf failure, caught before the file shipped. No stone is ever '
    + 'given to either side and no mega evolution can occur: every body is built bare, handed one '
    + 'ability, and hit once through `moveHit` / `dmgRange`. There is no pre-mega/post-mega '
    + 'distinction for effAbility() to resolve, and routing the WRITE through a resolver that '
    + 'COMPUTES an ability would defeat the whole instrument, which exists to hold every input equal '
    + 'across two engines and vary exactly one.',
  'tests/test-effective-identity.js':
    'This file. It reads .ability to check that .ability is right.',
  'tests/walk_tags.js':
    'ASSIGNS a fixture body its ability from the dex before running a tag through it.',
  'tests/probe_red_demo.js':
    'The red-demonstration harness for the 2026-08-05 Layer 0 probes: each wire is run against the '
    + 'shipped artifact and against the artifact with its tag stripped through TAGS.__setDB. All 21 '
    + 'matches were WALKED on 2026-08-05: 19 are ASSIGNMENTS — bare() blanking a fresh buildMon '
    + 'body, or a demo setting the ability it is about to strip the tag from — and the 2 reads (one '
    + 'line, the Skill Swap demo) read back the two fields the swap under test just exchanged, '
    + 'which is the field-under-test case test-mechanics.js already declares. No line reads a LIVE '
    + 'Pokemon expecting the post-mega value; every body is built bare, given one ability by the '
    + 'demo, and never holds a stone.',
  'tests/test-tag-wire.js':
    'The same construction claim as tests/test-mechanics.js, and it grows for the same reason — a '
    + 'wire probe sets the ability it is about to test. All 18 matches were WALKED on 2026-08-04 '
    + 'rather than sampled: 13 are ASSIGNMENTS onto a body M.buildMon has just returned, and the '
    + 'other 5 read a DATASET ability that the surrounding assertion is itself about (Pelipper '
    + 'carries Drizzle, Torkoal carries Drought, the surge sweep, Sturdy survived). None reads a '
    + 'LIVE Pokemon expecting the post-mega value, which is the case this ratchet exists for. It '
    + 'was declared when the Volt Absorb wire gained a CONTROL body — the wire had been staged on a '
    + 'Garchomp, which is Ground and immune to Electric anyway, so the mechanic could not show and '
    + 'the engine took the blame for a whole session. Refusing the control to hold a count at 17 '
    + 'would be trading a real check for a bookkeeping one.',
  'tests/test-game-diff.js':
    'The full-game differential. Its four matches are the two halves of the same claim: the '
    + 'PROJECTION reads `.ability` off a live body in each engine BECAUSE the ability is one of the '
    + 'things being compared -- that is the whole point of the file, and routing it through '
    + 'effAbility() would compare the board.js answer to itself rather than the two engine answers '
    + 'to each other. The other two are ASSIGNMENTS, writing a chosen reactor ability onto a set '
    + 'before either engine is built, which is the case this test names as correct. It found a real '
    + 'ability bug on its first run (Mummy and Wandering Spirit rewrite the ATTACKER ability on '
    + 'contact and medicham2 models neither), so the reads are load-bearing rather than incidental.',
  'tests/interaction_matrix.js':
    'THE GENERATOR, and every read is on a DEX SPECIES rather than on a live body: '
    + '`Object.values(sp.abilities)` asks which abilities a species can legally have, which is what '
    + 'decides whether a generated pair can occur at all. There is no battle and no Pokemon object in '
    + 'this file — it emits case descriptions and runs nothing — so there is no effective ability for '
    + 'effAbility() to compute. Routing a species\' ability LIST through a per-body resolver is a '
    + 'category error, not a missing call.',
  'tests/test-interaction-matrix.js':
    'THE RUNNER, and the same two halves tests/test-game-diff.js already declares one line up. The '
    + 'reads are ASSIGNMENTS — writing the reactor ability, or the inert control ability, onto a set '
    + 'before either engine is built — plus the projection\'s own `.ability`, which is one of the '
    + 'things under comparison. Routing that through effAbility() would compare the board.js answer '
    + 'to itself instead of the two engines to each other, and it is exactly how this file caught '
    + 'Mummy and Wandering Spirit: the attacker\'s ability field is their ONLY witness.',
  'tests/test-paste.js':
    'Reads .ability off a body buildMonFromSet just produced — the same construction claim as '
    + 'medicham2 above, and this file is now one of the things that PINS it: it asserts a paste of '
    + 'Gengar @ Gengarite carries Shadow Tag rather than the sheet\'s Cursed Body. That assertion '
    + 'was inverted on 2026-08-04; it used to assert the bug.',
  'engine/mag_bot.js':
    'Tests a SHEET entry for completeness (st.moves && st.item && st.ability). A sheet entry\'s '
    + '.ability IS the pre-mega one, which is this test\'s own stated legitimate case.',
  'engine/fit_policy.js':
    'Three matches, walked 2026-08-05. Two are WIRING COUNTERS in probeLive(): `user.ability` and '
    + '`f.ability` are TRUTHINESS tests at the point of use, counting whether the sheet channel '
    + 'ARRIVED on the live body — the value is never read into a rule. Routing them through '
    + 'effAbility() would be wrong BY CONSTRUCTION: it computes an ability from species+item even '
    + 'when nothing arrived, so the counter would read green on exactly the silent-default failure '
    + 'it exists to catch (the setSheet/switchIn key round trip, the venusaurmega shape). The third '
    + '(`info.ability`) reads the object SC.pick() built from a stored SHEET entry, which is the '
    + 'pre-mega one — this test\'s own stated legitimate case.',
  'engine/joint_rows.js':
    'One match: `m.ability` where m is a STORED SHEET mon out of the game record, tallied for '
    + 'presence beside setSheet — the same wiring-counter-plus-sheet-entry shape as '
    + 'engine/fit_policy.js one entry up, and the same legitimate case as engine/mag_bot.js.',
  'engine/sheet_channels.js':
    'One match: pick() reads `e.ability` off a STORED SHEET entry to build the setSheet payload, '
    + 'honouring the channel set. There is no live body anywhere in this file — it exists so the '
    + 'fit and the player read the SAME channel list — and a sheet entry\'s .ability IS the '
    + 'pre-mega one, this test\'s own stated legitimate case.',
  /* ROADMAP #244, 2026-08-13. One match, and the file is a STORE SCAN. */
  'engine/rollout_fallen_prevalence.js':
    'One match: `sh.ability` where `sh` is a STORED SHEET entry (or a `sets` row) out of the game '
    + 'record, tested for membership of the `boostsFromFallen` tag set. There is no live body '
    + 'anywhere in this file — it opens no engine, builds no mon and plays no turn, it counts how '
    + 'often a rollout would be seeded from a position with a dead ally — so there is nothing for '
    + 'effAbility(mon, dex) to be handed. A sheet entry\'s .ability IS the pre-mega one, which is '
    + 'this test\'s own stated legitimate case, and it is the RIGHT one here: Supreme Overlord is '
    + 'the DECLARED ability of the body that was brought, and a mega that overwrote it would remove '
    + 'the reader rather than add one.',
};

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (SKIP_DIR.test(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}
const files = [];
for (const d of ['engine', 'build', 'tests']) if (fs.existsSync(D(d))) walk(D(d), files);

const now = {};
const KIND = {};                 /* rel -> {total, prose, write, read, blind}. REPORTING ONLY. */
for (const p of files) {
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  const k = scan(fs.readFileSync(p, 'utf8'));
  if (k.total) { now[rel] = k.total; KIND[rel] = k; }
}
const total = Object.values(now).reduce((a, b) => a + b, 0);
const SUM = { total, prose: 0, write: 0, read: 0, blind: 0 };
for (const k of Object.values(KIND)) for (const f of ['prose', 'write', 'read', 'blind']) SUM[f] += k[f];
const split = f => { const k = KIND[f]; return k ? `${k.prose} prose, ${k.write} write, ${k.read} read` : ''; };

/* ---- THE COUNT RATCHET IS RETIRED. WHAT FOLLOWS IS AN INVENTORY, AND IT FAILS NOTHING ---------
 *
 * RETIRED 2026-08-23 BY MEASURE, on Will's "make it a permanent solution". It is retired, NOT
 * restamped — `data/effective-identity-baseline.json` still carries the last numbers it ever
 * asserted (generated 2026-08-11, count 1198, 80 files) under `last_count_baseline`, together with
 * the reason. A rewritten baseline would have hidden what was adopted; a retired one with a stated
 * reason cannot.
 *
 * WHY. Its assertion was "no file's count of /\.(ability|baseStats|weighthg|weightkg)\b/ may rise".
 * Measured: 45.2% of what it counted was not a read at all, 62% of its last red was files that did
 * not exist when the baseline was taken, and a walk of all 130 new matches found ZERO stale-identity
 * reads. Meanwhile it was GREEN on engine/position_features.js, which section 3 has now proved
 * contains a real one. It was measuring repository growth and missing the defect.
 *
 * WHAT IS KEPT AND WHY. The scan still runs and still prints, because a per-file inventory split
 * PROSE / WRITE / READ is genuinely useful when someone is auditing this class of bug by hand, and
 * it costs one pass over the tree. It asserts nothing. The 32 DECLARED entries are kept and printed
 * for the same reason: each is a walked account of one file, written by somebody who read it, and
 * deleting them would throw away the only record of that work. They are notes now, not exemptions.
 *
 * THE ONE THING STILL ASSERTED STATICALLY IS DELIBERATELY NARROW, and it is narrow because a broad
 * static number is what just got retired. `baseSpecies(...).baseStats` — reading the PRE-transformation
 * species' stat table — is the one text shape a walk of the whole repository named as dangerous and
 * measured at zero occurrences. It is asserted at zero so that a regression in a file section 3 never
 * executes still fails something. It is a supplement to the tripwire and it must not be mistaken for
 * a substitute: it refuses one spelling of one shape.
 */

if (UPDATE || process.argv.includes('--propose')) {
  console.log('\n  REFUSED. The count ratchet was RETIRED on 2026-08-23 and --update / --propose wrote or');
  console.log('  proposed its baseline. There is nothing left to restamp: the gate is now the runtime');
  console.log('  tripwire in section 3, whose allow-list is RUNTIME_ALLOWED in this file and requires a');
  console.log('  written reason (and a guard, where the reason is a fact about the format).');
  console.log('  data/effective-identity-baseline.json keeps the last asserted numbers as history.');
  process.exit(2);
}

let base = null;
try {
  base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
} catch (e) {
  /* Not fatal any more — nothing is gated on it. But say which fault it is, because "the inventory
   * printed no delta" and "the file is corrupt" must not look the same. */
  console.log(`\n  note: ${path.relative(ROOT, BASELINE)} could not be read (${e.code || e.message}); `
    + 'the inventory below has no historical delta to print.');
}
const legacy = (base && base.last_count_baseline) || base || {};
const allowed = legacy.allowed || {};

console.log(`\n  INVENTORY (asserts nothing) — ${SUM.total} matches of the old superset regex: `
  + `${SUM.prose} prose, ${SUM.write} write, ${SUM.read} read.`);
if (legacy.count != null) {
  const over = Object.entries(now).filter(([f, n]) => !DECLARED[f] && n > (allowed[f] || 0)).length;
  console.log(`  Against the retired baseline (${legacy.generated || 'undated'}, count ${legacy.count}, `
    + `${Object.keys(allowed).length} files): ${Object.keys(now).length} files today, ${over} above their old `
    + 'per-file number. THIS IS CONTEXT, NOT A VERDICT.');
}
if (SUM.blind) {
  console.log(`  ${SUM.blind} DESTRUCTURED read(s) exist that this superset regex does not count. Under the`);
  console.log('  old ratchet that was a hole; under section 3 it is not, because the tripwire fires on the');
  console.log('  property access rather than on the spelling.');
}
if (process.argv.includes('--split')) {
  console.log('\n  PER FILE — total (prose/write/read), * = above its retired per-file number, D = has a walked note:');
  for (const f of Object.keys(now).sort()) {
    const k = KIND[f], was = allowed[f] || 0;
    const mark = DECLARED[f] ? 'D' : (k.total > was ? '*' : ' ');
    console.log(`   ${mark} ${String(k.total).padStart(4)} (${k.prose}/${k.write}/${k.read})  ${f}   retired baseline ${was}`);
  }
}

/* THE NARROW STATIC ASSERTION. See the block comment above for why it is narrow on purpose. */
{
  const DANGEROUS = /\bbaseSpecies\s*(?:\([^()\n]*\))?\s*\.\s*baseStats\b/g;
  const hits = [];
  for (const p of files) {
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (rel === 'tests/test-effective-identity.js') continue;      /* this line, and the comment above it */
    const src = fs.readFileSync(p, 'utf8');
    const z = zones(src);
    DANGEROUS.lastIndex = 0; let m;
    while ((m = DANGEROUS.exec(src))) if (!z[m.index]) hits.push(`${rel}:${src.slice(0, m.index).split('\n').length}`);
  }
  ok(hits.length === 0,
    `nothing reads the PRE-transformation species' stat table (baseSpecies.baseStats: ${hits.length} site(s))`
    + (hits.length ? ' — ' + hits.slice(0, 6).join(', ') : ''));
}

/* PRINTED EVERY RUN, AS NOTES. Each of these is a file somebody walked line by line and wrote up.
 * They no longer exempt anything from anything — section 3 decides that — but the account is the
 * most expensive part and it is kept. */
const declaredNow = Object.keys(DECLARED).filter(f => now[f]);
console.log(`\n  WALKED-FILE NOTES (historical, exempt nothing) — ${declaredNow.length} file(s), `
  + `${declaredNow.reduce((a, f) => a + now[f], 0)} of the ${total} matches:`);
for (const f of declaredNow) console.log(`    ${f}  (${now[f]})\n        ${DECLARED[f]}`);
const stale = Object.keys(DECLARED).filter(f => !now[f]);
if (stale.length) console.log(`\n  note: ${stale.length} note(s) describe a file with no matches left — `
  + `${stale.join(', ')}. Delete the entry.`);

console.log(`\nEFFECTIVE IDENTITY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
