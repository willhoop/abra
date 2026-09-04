#!/usr/bin/env node
/* tests/probe_nonpermanent_forme_revert.js — M3, THE NON-PERMANENT FORME ON THE WAY OFF THE FIELD
 * ==================================================================================================
 * DOES A FORME THAT WAS CHANGED WITHOUT `isPermanent` GO BACK TO ITS BASE WHEN THE BODY LEAVES?
 *
 * THE AUTHORITY, TWO LINES, BOTH RE-OPENED 2026-09-04:
 *
 *   sim/pokemon.ts:1564   `clearVolatile()` ends with `this.setSpecies(this.baseSpecies);`
 *                         and `setSpecies` is `this.species = species; this.setType(species.types, true);`
 *                         (:1396-1398) — so the SPECIES and the TYPES both go back in one call.
 *   sim/pokemon.ts:1433   `formeChange(speciesId, source, isPermanent?, ...)` writes
 *                         `this.baseSpecies = rawSpecies` ONLY inside `if (isPermanent)` (:1447).
 *
 * So `isPermanent` is exactly the flag that decides whether a forme survives leaving the field, and
 * it is READ OFF THE HANDLERS rather than remembered — §0 below parses every `formeChange(` call in
 * `data/abilities.ts`, keeps the ones whose ability has a legal carrier in this regulation, and prints
 * which are permanent and which are not. Measured today:
 *
 *   NOT permanent (must revert)   hungerswitch :1891  `formeChange(targetForme)` — no flag at all
 *                                 stancechange :4521  `formeChange(targetForme)` — no flag at all
 *                                 forecast     :1486  `formeChange(forme, this.effect, false, ...)`
 *   PERMANENT (must NOT revert)   zerotohero   :5621  `formeChange('Palafin-Hero', this.effect, true)`
 *
 * `data/mods/champions/abilities.ts` carries no row for any of the four (grepped whole file), so
 * Champions inherits mainline here — which is why mainline is the citation.
 *
 * WHAT IS STAGED. Four boards, each one body flipping its forme and then LEAVING THE FIELD, with the
 * verdict read off `engine/board_state.js` at every turn boundary against the authority's own board.
 * Nothing here declares an expected species: Showdown is the expectation.
 *
 *   1. morpeko-pivots     Hunger Switch flips at the residual; the body then switches out.
 *   2. aegislash-pivots   Stance Change flips on a damaging click; the body then switches out.
 *   3. castform-pivots    Forecast follows the rain; the body then switches out.
 *   4. palafin-pivots     THE CONTROL. Zero to Hero is `isPermanent: true`, so the benched body must
 *                         STAY Palafin-Hero. A revert that over-matched would fail here, and this is
 *                         the arm that separates "reverts the right things" from "reverts everything".
 *
 * RED-FIRST KNOB: `MEDI_NO_TEMP_FORME_REVERT=1` takes the switch-out revert back out for every
 * non-permanent carrier. Under it 1-3 go RED and 4 stays green.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const KNOB = process.env.MEDI_NO_TEMP_FORME_REVERT === '1';
const FKNOB = process.env.MEDI_FORECAST_NO_SWITCHOUT_REVERT === '1';
console.log('\ntests/probe_nonpermanent_forme_revert.js — M3 non-permanent forme revert');
console.log('  MEDI_NO_TEMP_FORME_REVERT=' + (KNOB ? '1  (PRE-FIX ENGINE: Hunger Switch + Stance Change)' : '0')
  + '   MEDI_FORECAST_NO_SWITCHOUT_REVERT=' + (FKNOB ? '1  (Forecast)' : '0'));

/* ==================================================================================================
 * 0. WHICH ABILITIES CHANGE A FORME, AND WHICH OF THEM PASS `isPermanent` — PARSED, NOT TYPED
 * ================================================================================================== */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;
const LEGAL_AB = new Set();
for (const s of D.species.all()) {
  if (!legal(s)) continue;
  for (const k of Object.keys(s.abilities || {})) LEGAL_AB.add(D.abilities.get(s.abilities[k]).id);
}
const ABS = fs.readFileSync(process.env.SHOWDOWN_PATH + '/data/abilities.ts', 'utf8').split('\n');
/* WALK THE FILE AND KEEP THE ABILITY HEADING WE ARE INSIDE. A regex over the whole text cannot say
 * WHICH ability a call belongs to, and that attribution is the entire point of this section. */
const CALLS = [];
let cur = null;
for (let i = 0; i < ABS.length; i++) {
  const h = /^\t([a-z0-9]+): \{/.exec(ABS[i]);
  if (h) cur = h[1];
  const c = /\.formeChange\(([^;]*)\)/.exec(ABS[i]);
  if (c && cur) {
    const args = c[1].split(',').map(s => s.trim());
    /* argument 3 is `isPermanent`; absent or `false` means the forme does NOT survive the field. */
    CALLS.push({ ability: cur, line: i + 1, permanent: args.length >= 3 && args[2] === 'true',
                 raw: ABS[i].trim() });
  }
}
const MINE = CALLS.filter(c => LEGAL_AB.has(c.ability));
console.log('\n0. EVERY `formeChange` IN `data/abilities.ts` WHOSE ABILITY HAS A LEGAL CARRIER HERE');
for (const c of MINE) console.log('     ' + (c.permanent ? 'PERMANENT    ' : 'not permanent')
  + '  ' + c.ability + '  data/abilities.ts:' + c.line);
const nonPerm = new Set(MINE.filter(c => !c.permanent).map(c => c.ability));
const perm = new Set(MINE.filter(c => c.permanent).map(c => c.ability));
ok(nonPerm.has('hungerswitch') && nonPerm.has('stancechange') && nonPerm.has('forecast'),
   'the three carriers this file stages are all parsed as NOT permanent',
   'non-permanent set: ' + [...nonPerm].join(', '));
ok(perm.has('zerotohero'),
   'the CONTROL carrier is parsed as PERMANENT — otherwise scenario 4 proves nothing',
   'permanent set: ' + [...perm].join(', '));
/* AND CHAMPIONS DOES NOT OVERRIDE ANY OF THEM. Reading mainline when the mod has a row is reading a
 * different game; this asserts that it does not, rather than assuming it. */
/* NARROWED TO THE FOUR THIS FILE STAGES, AND THE FIRST VERSION OF THIS CHECK OVER-MATCHED. Asked of
 * every parsed carrier it fires on `disguise`, which Champions DOES override — a true fact about a
 * different ability, reported as a failure of this one. That is the shape the derived-tag rule warns
 * about: print what it matched before wiring it. The override list is printed either way. */
const CH = fs.readFileSync(process.env.SHOWDOWN_PATH + '/data/mods/champions/abilities.ts', 'utf8');
const isOver = a => new RegExp('^\\t' + a + ':', 'm').test(CH);
const STAGED = ['hungerswitch', 'stancechange', 'forecast', 'zerotohero'];
console.log('     Champions overrides, across every parsed carrier: '
  + ([...nonPerm, ...perm].filter(isOver).join(', ') || '(none)'));
const overridden = STAGED.filter(isOver);
ok(overridden.length === 0,
   'Champions overrides NONE of the four abilities this file stages, so mainline IS their authority',
   overridden.length ? 'OVERRIDDEN: ' + overridden.join(', ') + ' — re-read the mod, not mainline' : null);

/* ==================================================================================================
 * THE FOUR BOARDS
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));
/* The p1 side is inert in every scenario: four bodies that only ever Protect, so nothing on that side
 * can move a leaf and every difference the boards report belongs to the p2 body under test. */
const INERT = [mon('clefable', '', 'Unaware', ['Protect']), mon('milotic', '', 'Marvel Scale', ['Protect'])]
  .concat(FILL('toxapex', 'corviknight'));

const SCEN = [
  { id: 'morpeko-flips-then-pivots',
    kind: 'ability', shape: 'forme revert on switch-out',
    census: 'ability/formeCycleResidual — Hunger Switch, data/abilities.ts:1891',
    what: 'Morpeko flips to Morpeko-Hangry at the turn-1 residual (onResidualOrder 29) and then '
        + 'SWITCHES OUT on turn 2. `clearVolatile` closes with `setSpecies(baseSpecies)` and Hunger '
        + 'Switch passed no `isPermanent`, so the authority benches a body named Morpeko.',
    negative: 'turn 1 is the negative and it is on the same board — the flip itself must land, or a '
            + 'body that never changed forme would "revert" for free and this scenario would pass on '
            + 'an engine with no Hunger Switch at all.',
    A: INERT,
    B: [mon('morpeko', '', 'Hunger Switch', ['Protect', 'Substitute']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ sw: 'garchomp' }, { m: 'protect' }] },
    ] },

  { id: 'aegislash-blade-then-pivots',
    kind: 'ability', shape: 'forme revert on switch-out',
    census: 'ability/formeOnMoveCategory — Stance Change, data/abilities.ts:4521',
    what: 'Aegislash clicks Sacred Sword on turn 1, which Stance Change turns into Aegislash-Blade, '
        + 'and SWITCHES OUT on turn 2. Stance Change passes no `isPermanent`, so the authority '
        + 'benches a body named Aegislash — and Blade and Shield have DIFFERENT base stats, so this '
        + 'is a stat difference on the bench and not only a name.',
    negative: 'turn 1 is the negative — the blade forme must be reached, or the revert is trivial.',
    A: INERT,
    B: [mon('aegislash', '', 'Stance Change', ['Sacred Sword', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'sacredsword', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ sw: 'garchomp' }, { m: 'protect' }] },
    ] },

  { id: 'castform-rainy-then-pivots',
    kind: 'ability', shape: 'forme revert on switch-out',
    census: 'ability/formeFollowsWeather — Forecast, data/abilities.ts:1486',
    what: 'Castform sets Rain Dance on turn 1 and Forecast turns it into Castform-Rainy (a WATER '
        + 'type), then it SWITCHES OUT on turn 2. Forecast passes `isPermanent: false` explicitly, '
        + 'so the authority benches a Normal-type Castform. The `.types` leaf is the half that makes '
        + 'this board-material beyond a name.',
    negative: 'turn 1 — the rainy forme and its Water typing must be reached first.',
    A: INERT,
    B: [mon('castform', '', 'Forecast', ['Rain Dance', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'raindance' }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ sw: 'garchomp' }, { m: 'protect' }] },
    ] },

  { id: 'aegislash-blade-then-dies',
    kind: 'ability', shape: 'forme revert on FAINT — the other door onto clearVolatile',
    census: 'ability/formeOnMoveCategory — Stance Change through faintMessages()',
    what: 'Aegislash clicks Sacred Sword into the Blade forme on turn 1 and is KILLED on turn 2. '
        + '`faintMessages()` calls `pokemon.clearVolatile(false)` (sim/battle.ts:2560), which is the '
        + 'SAME closing `setSpecies(baseSpecies)` — so the corpse on the bench is Aegislash. A faint '
        + 'does not go through this engine\'s `switchOut`, which is why the type half of this same '
        + 'authority line needed its own call site (`typesRestoredOnFaint`) and the forme half needs '
        + 'one too.',
    negative: 'the Blade forme has 50 base Defence against the Shield\'s 140, so the turn-2 kill is '
            + 'only reachable BECAUSE the flip landed — an engine with no Stance Change would survive '
            + 'and the board would part on HP instead, which is a different red and is readable.',
    A: [mon('garchomp', '', 'Rough Skin', ['Earthquake', 'Protect']),
        mon('clefable', '', 'Unaware', ['Protect'])].concat(FILL('toxapex', 'corviknight')),
    B: [mon('aegislash', '', 'Stance Change', ['Sacred Sword', 'Protect']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('milotic', 'weavile')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'sacredsword', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'earthquake' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
      { p1: [{ m: 'earthquake' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ] },

  { id: 'palafin-hero-survives-the-bench',
    kind: 'ability', shape: 'PERMANENT forme must NOT revert',
    census: 'ability/formeOnSwitchOut — Zero to Hero, data/abilities.ts:5621',
    what: 'THE CONTROL. Palafin switches out on turn 1; Zero to Hero calls `formeChange` with '
        + '`isPermanent: true`, which rewrites `baseSpecies`, so `clearVolatile` has nothing to '
        + 'revert TO and the benched body stays Palafin-Hero on BOTH engines.',
    negative: 'this scenario IS the negative for the other three. A revert that matched on "the '
            + 'forme is not the species name" rather than on how the change was made would undo Zero '
            + 'to Hero in the same function that performed it, and this board is where that shows.',
    A: INERT,
    B: [mon('palafin', '', 'Zero to Hero', ['Protect', 'Iron Head']),
        mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('garchomp', 'weavile')),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ sw: 'garchomp' }, { m: 'protect' }] },
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ] },
];

console.log('\n1. THE FOUR BOARDS, PLAYED AGAINST THE AUTHORITY');
const results = [];
for (const sc of SCEN) {
  const r = SB.runOne(sc);
  results.push(r);
  /* THE DIFF IS PRINTED AS `path  ours / authority`, off `board_state.locate`'s own fields (`us`,
   * `sd`), because the verdict word alone cannot say WHICH leaf parted and this file exists to name
   * the leaf. */
  const detail = r.verdict === 'IDENTICAL' ? null
    : (r.why ? r.why : r.boards.map(b => (b.unexplained || [])
        .map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us)
                  + ' / authority ' + JSON.stringify(d.sd)).join('\n'))
        .filter(Boolean).join('\n'));
  /* WHICH KNOB GOVERNS WHICH BOARD, STATED RATHER THAN LUMPED. Castform's revert lives in the
   * `formeFollowsWeather` block in `switchOut` and predates this pass, so it has its own restore
   * (`MEDI_FORECAST_NO_SWITCHOUT_REVERT=1`) and `MEDI_NO_TEMP_FORME_REVERT` does NOT reach it. Saying
   * "expected RED" over a board the armed knob cannot touch would be a false expectation printed in
   * green ink. */
  const gov = sc.id.indexOf('castform') === 0 ? FKNOB
            : sc.id.indexOf('palafin') === 0 ? false : KNOB;
  const wantGreen = !gov;
  ok(r.verdict === 'IDENTICAL', sc.id + '  -> ' + r.verdict
     + (wantGreen ? '' : '   [expected RED: the knob is armed]'),
     detail);
  /* A SCENARIO THAT COMPARED NOTHING IS NOT A PASS. `runOne` already refuses a zero-leaf boundary,
   * but a board that compared six leaves and a board that compared six hundred read the same from
   * the verdict alone. */
  console.log('          leaves compared ' + (r.compared == null ? '(not staged)' : r.compared));
}

/* ==================================================================================================
 * 2. THE ENGINE'S OWN RECEIPTS — a capability that cannot prove it ran is assumed broken
 * ================================================================================================== */
console.log('\n2. THE COUNTERS');
/* THE MODULE INSTANCE THE SCENARIOS ABOVE PLAYED WITH — `harness()` returns the differential that
 * bound the frozen engine, and `REL.require` goes through Node's cache on that same frozen path, so
 * this is the object whose counters those four games incremented. A fresh require of the live tree
 * would read zeros and look exactly like a dead wire. */
const M = SB.harness().REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M && M.MEDSEEN, F = M && M.MEDFAILS;
if (S) {
  console.log('     formeTempStamped ' + S.formeTempStamped
    + '   formeTempReverted ' + S.formeTempReverted
    + '   stanceChanged ' + S.stanceChanged
    + '   weatherFormeReverted ' + S.weatherFormeReverted
    + '   typesRestoredOnSwitchOut ' + S.typesRestoredOnSwitchOut);
  if (F) console.log('     tempFormeRevertSuppressed ' + F.tempFormeRevertSuppressed);
  ok(S.formeTempStamped > 0, 'at least one body stamped a temporary base forme',
     'formeTempStamped=' + S.formeTempStamped + ' — a zero means no flip was recorded as temporary '
     + 'and the revert below cannot be doing anything');
  ok(KNOB ? true : S.formeTempReverted > 0,
     'at least one body actually reverted on the way off the field',
     'formeTempReverted=' + S.formeTempReverted);
  ok(KNOB ? (F && F.tempFormeRevertSuppressed === 1) : (!F || F.tempFormeRevertSuppressed === 0),
     'the restore knob reports its own state',
     'tempFormeRevertSuppressed=' + (F && F.tempFormeRevertSuppressed));
} else {
  ok(false, 'MEDSEEN is readable off the harness', 'staged_board.harness() did not expose the engine');
}

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
