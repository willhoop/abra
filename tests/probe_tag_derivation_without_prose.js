/* A TAG WAS DERIVED FROM PROSE, AND THE PROSE MOVED.
 *
 *   SHOWDOWN_PATH=... node tests/probe_tag_derivation_without_prose.js
 *   ABRA_TAGDEX_SCREENS_FROM_PROSE=1 SHOWDOWN_PATH=... node tests/probe_tag_derivation_without_prose.js
 *                                                                        (the red demonstration)
 *
 * ================= WHAT HAPPENED ================================================================
 *
 * The first Reg M-C run (docs/_reports/2026-09-20-regmc-first-run.md §5) played a game in which a
 * screen halved a SPECIAL attack it does not halve:
 *
 *     |move|p2b: Grimmsnarl|Reflect  ->  |-sidestart|p2: |Reflect  ->  |move|p1a: Primarina|Moonblast
 *     |-damage|p2a: Toxapex|30/125   (showdown)        |-damage|p2a: Toxapex|43/125   (medicham)
 *
 * THE GAME DID NOT CHANGE. OUR DERIVATION DID. `engine/tag_dex.js` read `move.shortDesc` at two
 * sites, and the M-C checkout ships with every Champions description removed (upstream `02bb2ae
 * Remove redundant Champions descriptions`). Measured on both checkouts:
 *
 *     reflect      M-B shortDesc "For 5 turns, physical damage to allies is halved."   M-C ""
 *     lightscreen  M-B shortDesc "For 5 turns, special damage to allies is halved."    M-C ""
 *     brickbreak   M-B shortDesc "Destroys screens, unless the target is immune."      M-C ""
 *
 * `/physical/i.test('')` is false and so is `/special/i.test('')`, so BOTH screens fell through to
 * the `'both'` DEFAULT; `clearsScreens` required `/reflect|screen|veil/i` on the same empty string,
 * so Brick Break, Psychic Fangs and Raging Bull silently lost their tag. A silent default that
 * changes a board — the exact shape CLAUDE.md says this project keeps paying for.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * The rule is in the condition's own gate, not in the sentence about it. `dist/data/moves.js`,
 * inherited unchanged by `data/mods/champions/moves.ts` (which sets only `isNonstandard`):
 *
 *   reflect.condition.onAnyModifyDamage(damage, source, target, move) {
 *     if (target !== source && this.effectState.target.hasAlly(target)
 *         && this.getCategory(move) === "Physical") { ... return this.chainModify(0.5); } }
 *
 *   lightscreen.condition.onAnyModifyDamage  — identical, with `=== "Special"`.
 *
 *   auroraveil.condition.onAnyModifyDamage   — names BOTH, inside a bail-out that defers to whichever
 *                                              of the two is already up, so it restricts to NEITHER.
 *
 *   brickbreak.onTryHit(pokemon) { pokemon.side.removeSideCondition("reflect");
 *                                 pokemon.side.removeSideCondition("lightscreen");
 *                                 pokemon.side.removeSideCondition("auroraveil"); }
 *
 * ================= WHAT THIS PROBE ASSERTS ======================================================
 *
 * That the derivation gives THE SAME ANSWER WITH THE DESCRIPTION PRESENT AND ABSENT. That is the
 * claim, so that is the test: every legal move is put through `engine/screen_tags.js` twice, once as
 * itself and once behind a Proxy that returns `''` for `shortDesc` and `desc`. A structural
 * derivation cannot tell the two apart; a prose one reports something different, which is how the
 * knob shows this red. It needs no second checkout and no M-C dex to do it.
 *
 * CLEARED CONTROL: clause 3 refuses a derivation that answers `both` for everything. Identical output
 * across a varied input is an unwired knob, not agreement — if the category gate stopped matching,
 * clauses 1 and 2 would both still pass while every screen halved everything. */
'use strict';
const path = require('path');
const R = p => require(path.join(__dirname, '..', p));
const CS = R('engine/champions_sim.js');
const SC = R('engine/screen_tags.js');

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

const PROSE = process.env[SC.PROSE_KNOB] === '1';
const dex = CS.dexFor(CS.FORMAT);
console.log('\nTAG DERIVATION WITHOUT THE PROSE — ' + CS.FORMAT + ' @ ' + CS.actualCommit()
  + (PROSE ? '\n  ' + SC.PROSE_KNOB + '=1 — THE PRE-FIX READS ARE RESTORED (red demonstration)' : ''));

/* The description-free arm. Nothing else about the move is touched.
 *
 * A Proxy CANNOT do this and the first version tried: a `DataMove` is frozen, so `shortDesc` is a
 * read-only non-configurable data property and the `get` trap throws a TypeError rather than
 * returning `''`. So it is a shallow copy over the same prototype, with the two description fields
 * overwritten and every handler, `condition` and `sideCondition` carried across by reference. Proved
 * below rather than assumed. */
const blind = m => Object.assign(Object.create(Object.getPrototypeOf(m)), m, { shortDesc: '', desc: '' });

const legalMoves = dex.moves.all().filter(m => m && m.exists && !m.isNonstandard);

/* ---- 1. THE SCREEN SET IS DERIVED, AND IT IS NOT EMPTY ---------------------------------------- */
const screens = [...SC.screenSideConditions(dex)].sort();
ok(screens.length > 0,
  'the SCREEN side conditions are derived from structure (a side condition whose own `condition` '
  + 'carries a damage-modifying handler)',
  'derived: ' + (screens.join(', ') || '(NONE — the derivation is dead)'));

/* ---- 1b. THE BLINDING ARM IS PROVED, NOT ASSUMED ---------------------------------------------- */
const isScreenSetter = m => !!(m.sideCondition && screens.includes(String(m.sideCondition).toLowerCase().replace(/[^a-z0-9]/g, '')));
{
  const subject = legalMoves.find(m => isScreenSetter(m) && m.condition);
  const b = subject && blind(subject);
  const carried = !!(b && b.condition && Object.keys(b.condition).length === Object.keys(subject.condition).length);
  ok(!!subject && b.shortDesc === '' && b.desc === '' && carried,
    'the blinded arm blanks BOTH description fields and carries every handler across — otherwise '
    + 'clause 2 would be comparing a derivation against nothing at all',
    subject ? ('subject ' + subject.id + ': shortDesc ' + JSON.stringify(String(subject.shortDesc || '').slice(0, 30))
      + ' -> ' + JSON.stringify(b.shortDesc) + ', condition keys ' + Object.keys(subject.condition).length
      + ' -> ' + (b.condition ? Object.keys(b.condition).length : 0))
      : 'NO SCREEN SETTER IN THIS FORMAT — clause 2 can see nothing');
}

/* ---- 2. THE ASSERTION: PRESENT AND ABSENT MUST AGREE, ON EVERY LEGAL MOVE --------------------- */
const moved = [];
for (const m of legalMoves) {
  const b = blind(m);
  const cs1 = SC.clearsScreens(m, dex), cs2 = SC.clearsScreens(b, dex);
  const k1 = SC.screenCategory(m), k2 = SC.screenCategory(b);
  if (JSON.stringify(cs1) !== JSON.stringify(cs2))
    moved.push(m.id + '  clearsScreens ' + JSON.stringify(cs1) + ' -> ' + JSON.stringify(cs2));
  if (isScreenSetter(m) && k1 !== k2) moved.push(m.id + '  halvesDamage.category ' + k1 + ' -> ' + k2);
}
ok(moved.length === 0,
  'every one of the ' + legalMoves.length + ' legal moves derives the SAME clearsScreens and the SAME '
  + 'halvesDamage.category with its description present and with it blanked',
  moved.length ? moved.length + ' MOVED:\n          ' + moved.join('\n          ')
               : 'no move moved — the derivation does not read the description');

/* ---- 3. CLEARED CONTROL: the derivation must DISCRIMINATE ------------------------------------- */
const table = legalMoves.filter(isScreenSetter).map(m => ({ id: m.id, cat: SC.screenCategory(m) }));
const cats = new Set(table.map(r => r.cat));
ok(table.length >= 2 && cats.size >= 2,
  'CONTROL: the category derivation separates the screens rather than answering one value for all — '
  + 'identical output across a varied input is an unwired derivation, not agreement',
  table.map(r => r.id + ' -> ' + r.cat).join(', ') || '(no screen setter in this format)');

/* ---- 4. WHAT CARRIES clearsScreens, PRINTED ---------------------------------------------------- */
const clearers = legalMoves.filter(m => SC.clearsScreens(m, dex)).map(m => m.id);
console.log('\n  MEMBERSHIP  clearsScreens: ' + (clearers.join(', ') || '(none)'));
console.log('  MEMBERSHIP  halvesDamage:  ' + table.map(r => r.id + ' ' + r.cat).join(', '));
/* NAMED, NOT ABSORBED: Defog and Tidy Up reach `removeSideCondition` through a loop variable rather
 * than a literal, so neither matches — and neither matched the prose read either. See the comment in
 * engine/screen_tags.js; widening to the loop form is a MEMBERSHIP change and its own pass. */
const looped = legalMoves.filter(m => /removeSideCondition/.test(String(m.onTryHit || '') + String(m.onHit || ''))
  && !clearers.includes(m.id)).map(m => m.id);
console.log('  NOT MEMBERS, and were not before either (they reach removeSideCondition through a loop '
  + 'variable): ' + (looped.join(', ') || '(none)'));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
