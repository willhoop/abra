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
 * THE RATCHET (R5). 145 raw reads exist across the repo and most are legitimate — a SHEET entry's
 * `.ability` genuinely is the pre-mega one, and reading it is right. A test demanding all 145 be
 * cleaned before it can be switched on is a test that gets switched off. So the baseline records
 * what exists and this fails only on what is NEW, and the list may only shrink.
 *
 *   node tests/test-effective-identity.js
 *   node tests/test-effective-identity.js --update    (only after FIXING some)
 *   node tests/test-effective-identity.js --split     (the risk split, per file, changes no verdict)
 *   node tests/test-effective-identity.js --propose   (PRINTS a candidate baseline; writes nothing)
 *
 * THE COUNT IS NOT THE RISK, AND SAYING SO IS THE POINT OF THE SPLIT — MEASURE, 2026-08-23
 * ---------------------------------------------------------------------------------------
 * This ratchet has been reported RED, by name, in docs/ENGINE.md at least seven times by seven
 * different agents, at 869, 1048, 1471, 1561, 1596 and 1597 raw reads. It was restamped WHOLESALE on
 * 2026-08-11 (ROADMAP #183, 964 reads adopted unreviewed on Will's *"restamp i guess"*) and it was
 * red again within days. A ratchet a restamp cannot hold for a week is not measuring the thing it
 * says it measures.
 *
 * Measured on 2026-08-23 over all 1,597 matches: **189 are PROSE** (comments and string literals),
 * **533 are WRITES** (`x.ability = ...`), and 875 are reads. So 45.2% of what this file counts as a
 * "raw read of a transforming field" is not a read at all — and the over-broad regex has already
 * DISTORTED ITS OWN SUBJECT twice, on the record:
 *
 *   - the `tests/test-tag-signature.js` declaration below is written WITHOUT NAMING THE FIELD, and
 *     says so: *"the scanner is a grep over source text, so quoting the line here would itself count
 *     as a raw read and the declaration would inflate the number it declares"*;
 *   - docs/ENGINE.md records an agent REWORDING TWO COMMENTS to hold this counter still.
 *
 * A gate that makes people edit prose to satisfy it is measuring the prose.
 *
 * SO EVERY MATCH IS NOW CLASSIFIED — PROSE / WRITE / READ — AND THE SPLIT IS PRINTED BESIDE EVERY
 * GROWING FILE. **The ratchet arithmetic is deliberately UNCHANGED**: it still compares the raw
 * TOTAL against the stored baseline, so this classification cannot make a red run green. Narrowing
 * the counter would lower every file's number against a baseline recorded under the old counter,
 * which is a restamp wearing a lexer, and ROADMAP #183 is what that costs.
 *
 * WHAT THIS CLASSIFIER DOES NOT CATCH, STATED AS A NUMBER RATHER THAN A HEDGE
 * --------------------------------------------------------------------------
 * It is a lexer over source text, so it sees `x.ability` and (since 2026-08-23) `x['ability']`. It is
 * BLIND to every other way of reaching the field, and a NEW wrong shape will most likely arrive as
 * one of these:
 *
 *   `const { ability } = mon`            destructuring        — 0 sites today
 *   `({ ability }) => ...`               destructured param   — 0 sites today
 *   `Object.assign({}, sheet)`           a copy, then treated as live — NOT DETECTABLE HERE AT ALL
 *   `x[k]` where k is a variable         computed key         — NOT DETECTABLE HERE AT ALL
 *
 * The first two are counted every run and printed if they ever become non-zero, which is coverage.
 * The last two are not coverage and must not be read as any. **A structural scan cannot prove the
 * absence of a stale-identity read; it can only refuse the shapes it knows.** The behavioural pins in
 * sections 1, 2 and 2b are what actually assert the engine is right, and they are the load-bearing
 * half of this file.
 *
 * A NOTE ON THE BRACKET FORM, because the naive version of it was wrong. Matching `['ability']` with
 * a plain regex fires on `tests/roster.js:8725`, which is a STRING IN AN ARRAY LITERAL and not a
 * property access. It is detected through the lexer with a required receiver token instead, and it
 * fires 0 times today.
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

/* ---- 3. THE RATCHET — no NEW raw read of a transforming field -------------------------------- */

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

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    note: 'GENERATED. Raw reads of a field that mega evolution changes. New entries are a FAILURE; '
      + 'this list may only shrink. Route the read through board.js effective()/effAbility(). '
      + 'See tests/test-effective-identity.js.',
    generated: new Date().toISOString().slice(0, 10),
    count: total, allowed: now,
  }, null, 1));
  console.log(`\n  baselined ${total} raw reads across ${Object.keys(now).length} files -> ` +
    path.relative(ROOT, BASELINE));
  process.exit(0);
}

let base = null;
try {
  base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
} catch (e) {
  /* A baseline that EXISTS but will not parse is a different fault from one never written, and
   * treating both as "first run" would silently disarm the ratchet -- which is the exact failure
   * this repository keeps finding. Every path out of this catch says something. */
  if (e.code !== 'ENOENT') {
    console.log(`  FAIL the baseline exists but could not be read: ${e.message}`);
    process.exit(1);
  }
  console.log('  note: no baseline on disk yet — this is a first run, not a pass');
}
if (!base) {
  console.log('\n  NO BASELINE. Run:  node tests/test-effective-identity.js --update');
  process.exit(1);
}
const allowed = base.allowed || {};
const grew = [];
for (const [f, n] of Object.entries(now)) {
  if (DECLARED[f]) continue;                     // declared below, with its reason, and printed
  const was = allowed[f] || 0;
  if (n > was) grew.push(`${f}: ${was} -> ${n}`);
}
const shrank = Object.entries(allowed).filter(([f, n]) => (now[f] || 0) < n && !DECLARED[f]).length;

/* THE HEADLINE NUMBER IS NOT WHAT FAILS, AND READING IT AS THOUGH IT WERE IS HOW THIS GOT RESTAMPED.
 * docs/ENGINE.md records this gate red at "1048 total, baseline 234" and again at "869 total" — both
 * BELOW the baseline of the day. The ratchet is PER FILE; the total is context, not the verdict. */
ok(grew.length === 0,
  `no NEW raw read of a transforming field (${grew.length} file(s) over their per-file baseline; ` +
  `${total} matched in total against a baseline total of ${base.count} — the TOTAL is not what fails)` +
  (grew.length ? `\n         ` + grew.map(g => {
    const f = g.split(':')[0];
    return process.env.ABRA_EI_LEGACY_REPORT ? g : `${g}   [${split(f)}]`;
  }).join('\n         ') : ''));
if (grew.length && !process.env.ABRA_EI_LEGACY_REPORT) {
  const gk = grew.map(g => KIND[g.split(':')[0]]).filter(Boolean);
  const t = k => gk.reduce((a, x) => a + x[k], 0);
  console.log(`         Across those files: ${t('prose')} prose, ${t('write')} write, ${t('read')} read.`);
  console.log('         PROSE and WRITE cannot return a stale identity — only READ can. Set');
  console.log('         ABRA_EI_LEGACY_REPORT=1 for the bare pre-2026-08-23 message.');
}
if (grew.length) {
  console.log('         A sheet entry\'s .ability IS the pre-mega one and reading it is correct.');
  console.log('         A LIVE Pokemon\'s is not. Route it through board.js effAbility(mon, dex).');
  console.log('         If it is correct BY CONSTRUCTION, declare it in DECLARED with the reason —');
  console.log('         do not re-baseline, which would launder every other new read beside it.');
}
console.log(`\n  CLASSIFIED — ${SUM.total} matches: ${SUM.prose} prose, ${SUM.write} write, ${SUM.read} read.`);
if (SUM.blind) {
  console.log(`  ${SUM.blind} DESTRUCTURED read(s) of a transforming field exist and the superset regex`);
  console.log('  DOES NOT COUNT THEM. That is not a failure here; it means this ratchet now covers');
  console.log('  less of the repository than it did. See the header.');
}
if (process.argv.includes('--split')) {
  console.log('\n  PER FILE — total (prose/write/read), * = over its per-file baseline, D = declared:');
  for (const f of Object.keys(now).sort()) {
    const k = KIND[f], was = allowed[f] || 0;
    const mark = DECLARED[f] ? 'D' : (k.total > was ? '*' : ' ');
    console.log(`   ${mark} ${String(k.total).padStart(4)} (${k.prose}/${k.write}/${k.read})  ${f}   baseline ${was}`);
  }
}
if (process.argv.includes('--propose')) {
  /* PRINTS. WRITES NOTHING. ROADMAP #183 is what happens when this step is automated: 964 reads
   * adopted in one move and nobody able to say afterwards what went in. A human pastes this, or it
   * does not happen. */
  console.log('\n  PROPOSED BASELINE — printed for review, NOT written. Nothing on disk changed.');
  console.log(JSON.stringify({
    note: base.note, generated: new Date().toISOString().slice(0, 10), count: total, allowed: now,
  }, null, 1));
}
if (shrank) console.log(`\n  ${shrank} file(s) now read fewer raw fields. Re-run with --update to lock the gain in.`);

/* PRINTED EVERY RUN. A declaration nobody sees is an exemption, and this file exists because an
 * exemption nobody saw cost four sessions. A declared file whose count is UNEXPECTEDLY large is
 * still visible here even though it cannot fail the run. */
const declaredNow = Object.keys(DECLARED).filter(f => now[f]);
console.log(`\n  DECLARED EXCEPTIONS — ${declaredNow.length} file(s), `
  + `${declaredNow.reduce((a, f) => a + now[f], 0)} of the ${total} raw reads:`);
for (const f of declaredNow) console.log(`    ${f}  (${now[f]})\n        ${DECLARED[f]}`);
const stale = Object.keys(DECLARED).filter(f => !now[f]);
/* A declaration for a file that no longer reads anything is dead prose. Say so; do not fail on it. */
if (stale.length) console.log(`\n  note: ${stale.length} declaration(s) no longer needed — `
  + `${stale.join(', ')} has no raw reads left. Delete the entry.`);

console.log(`\nEFFECTIVE IDENTITY TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
