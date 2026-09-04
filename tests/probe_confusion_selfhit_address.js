#!/usr/bin/env node
/* tests/probe_confusion_selfhit_address.js — M6 / ROADMAP #334, THE CONFUSION SELF-HIT'S DIE ADDRESS
 * ==================================================================================================
 * DO THE TWO ENGINES DRAW THE SELF-HIT DAMAGE DIE FOR THE SAME EVENT?
 *
 * The diagnosis card said "different INDEX, not a different multiplier" and told me to suspect the
 * die ADDRESS before the arithmetic. It is BOTH, and the two halves have different owners — which is
 * the whole reason this probe has a second arm rather than a second assertion.
 *
 * ---- THE AUTHORITY, READ WHOLE ------------------------------------------------------------------
 *
 * `data/conditions.ts` confusion.onBeforeMove (there is NO `confusion` row in
 * `/data/mods/champions/conditions.ts` — §0 greps for it on every run):
 *
 *     pokemon.volatiles['confusion'].time--;
 *     if (!pokemon.volatiles['confusion'].time) { pokemon.removeVolatile('confusion'); return; }
 *     this.add('-activate', pokemon, 'confusion');
 *     if (!this.randomChance(33, 100)) return;          <-- DRAW 1
 *     this.activeTarget = pokemon;                      <-- THE AUTHORITY REPOINTS THE ACTIVE TARGET
 *     const damage = this.actions.getConfusionDamage(pokemon, 40);   <-- DRAW 2
 *
 * `getConfusionDamage` (sim/battle-actions.ts:1850-1862) ends `damage = this.battle.randomizer(damage)`,
 * and `randomizer` is one `this.random(16)`. The middle arm addresses every draw off
 * `battle.activeMove` and `battle.activeTarget`, so the authority's two draws sit at TWO DIFFERENT
 * ADDRESSES the moment the confused body had clicked at a foe. This engine stamped `MID_TGT` once at
 * the top of the action and used it for both.
 *
 * ---- WHAT WAS MEASURED, BEFORE ANY BYTE MOVED ---------------------------------------------------
 *
 * Arm 1's board, Snorlax confused and clicking Body Slam at the Milotic in p10:
 *
 *     sd   20260813|6|any|bodyslam|p10|0     the 1/3 roll, at the CLICK'S target
 *     sd   20260813|6|any|bodyslam|p20|0     the damage roll, at the CONFUSED BODY
 *     me   20260813|6|any|bodyslam|p10|0     agreed
 *     me   20260813|6|any|bodyslam|p10|1     UNSHARED — a different address is a different die
 *
 * ---- WHY THE 2026-08-22 REVIEW COULD NOT SEE IT, AND WHY ARM 2 EXISTS ---------------------------
 *
 * That pass staged Confuse Ray into a Snorlax that then clicked AMNESIA. Amnesia is `target: 'self'`,
 * so the click's target and the confused body are the SAME SLOT and the two addresses coincide. Its
 * dump therefore showed agreement on exactly the field that is wrong. Arm 2 is that board, kept as
 * the CONTROL: it shared every address before this change and must go on sharing them, so a red arm 1
 * accuses the repoint and not the confusion die in general.
 *
 * ---- ~~THE RESIDUAL IS THE INSTRUMENT'S AND IT IS NOT ASSERTED HERE~~ ---------------------------
 * ---- 2026-09-04: THE INSTRUMENT HALF LANDED, SO §3 IS AN ASSERTION NOW -------------------------
 *
 * With the addresses matched, the two engines drew the SAME `u` and still computed different damage,
 * because they read that `u` in opposite directions:
 *
 *     authority   `pinRandom(16)` returns `Math.floor(u*16)` unless `MIDW.cat === 'dmg'`, and
 *                 `getConfusionDamage` calls `battle.randomizer` DIRECTLY, so no `getDamage` wrapper
 *                 ever fired and the category was `any`. Index up  ->  damage DOWN.
 *     this engine `damageRollIndex(u) = 15 - floor(u*16)`, the one owner of the sixteen-index
 *                 convention. Index down  ->  damage UP.
 *
 * ~~ENGINE CANNOT CLOSE THAT~~ — and that reading was right about the SITE and wrong about the
 * conclusion. The two pinned corner arms answer `random(16)` with `spec.damageIndex` WHATEVER the
 * category says, so flipping THIS engine's direction would have parted them; what the fix does
 * instead is teach the INSTRUMENT that `getConfusionDamage` owns a damage roll:
 *
 *     game_differential.js  around('getConfusionDamage', 'dmg', 0, 'confusionDmgEnters')
 *     medicham2-browser.js  the self-hit roll draws `_R.dmg` instead of the generic `rng`
 *
 * THE CORNERS ARE UNTOUCHED BY BOTH HALVES, and that is checked rather than hoped: `rngStreams(f)`
 * for a plain function aliases every stream to `f`, so `_R.dmg === _R.any` under a corner arm, and a
 * corner's `random(16)` never consulted the category in the first place. §4 asserts it directly.
 *
 * IT MOVES `PIN_DIGEST` — a new pin claim joins the list and the authority's draw changes category.
 * A whole-game run after this is measured with a changed INSTRUMENT as well as a changed engine.
 *
 * RED-FIRST, TWO KNOBS, ONE FOR EACH HALF:
 *   `MEDI_CONFUSION_DMG_ADDR_LEGACY=1` puts the damage draw back at the click's target. Arm 1 goes
 *      RED on the unshared address, arm 2 stays green, and `MEDFAILS.confusionDmgAddrLegacyRestored`
 *      reads 1.
 *   `MEDI_CONFUSION_DMG_CAT_LEGACY=1` is read by BOTH files under that one name and puts back the
 *      `any` category on the authority AND the generic stream here — restoring the anti-correlated
 *      read rather than a third behaviour. §3 then asserts the boards PART on both arms, which is
 *      what makes the green above load-bearing instead of decorative.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '12');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const KNOB = process.env.MEDI_CONFUSION_DMG_ADDR_LEGACY === '1';
/* THE SECOND KNOB — the INSTRUMENT half. Read here and by `engine/game_differential.js` under the
 * same name, so the two go back together and the restore is the original red, not a third state. */
const KNOB2 = process.env.MEDI_CONFUSION_DMG_CAT_LEGACY === '1';
console.log('\ntests/probe_confusion_selfhit_address.js — M6 / #334 the confusion self-hit die address');
console.log('  MEDI_CONFUSION_DMG_ADDR_LEGACY=' + (KNOB ? '1  (PRE-FIX ENGINE)' : '0')
  + '   MEDI_CONFUSION_DMG_CAT_LEGACY=' + (KNOB2 ? '1  (PRE-FIX INSTRUMENT)' : '0'));

/* ---- 0. THE AUTHORITY AND THE MEMBERSHIP, DERIVED ON EVERY RUN --------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;
const MODDIR = process.env.SHOWDOWN_PATH + '/data/mods/champions/';
const SIMDIR = process.env.SHOWDOWN_PATH + '/';

console.log('\n0. WHAT THIS REGULATION ACTUALLY CONTAINS, AND WHERE THE HANDLER LIVES');
const MODCOND = fs.readFileSync(MODDIR + 'conditions.ts', 'utf8');
ok(!/^\tconfusion:/m.test(MODCOND),
   'Champions carries no `confusion` condition row — data/conditions.ts is the authority for this handler',
   /^\tconfusion:/m.test(MODCOND) ? 'the mod DOES override it — read that block instead' : null);
const MODSCRIPTS = fs.readFileSync(MODDIR + 'scripts.ts', 'utf8');
/* NARROW ON PURPOSE, AND THE WIDE VERSION WAS WRONG FIRST. A grep for `randomizer\s*\(` matches
 * Champions' OWN `modifyDamage` at data/mods/champions/scripts.ts:226 — `baseDamage =
 * this.battle.randomizer(baseDamage)` — which is the ordinary damage roll inside `getDamage`, is
 * wrapped as `dmg` by the middle arm, and has nothing to do with this handler. What matters is that
 * the mod defines neither `getConfusionDamage` nor `randomizer` itself. */
const MOD_DEFINES = n => new RegExp('(^|\\n)\\s*' + n + '\\s*\\(').test(MODSCRIPTS);
ok(!MOD_DEFINES('getConfusionDamage') && !MOD_DEFINES('randomizer'),
   'Champions defines neither getConfusionDamage nor randomizer — sim/battle-actions.ts is the authority',
   MOD_DEFINES('getConfusionDamage') ? 'it defines getConfusionDamage'
     : MOD_DEFINES('randomizer') ? 'it defines randomizer' : null);
/* The two lines the whole probe rests on, cited by grep rather than by memory. */
const COND = fs.readFileSync(SIMDIR + 'data/conditions.ts', 'utf8');
const CBLOCK = /\n\tconfusion:\s*\{([\s\S]*?)\n\t\},/.exec(COND);
ok(!!CBLOCK && /this\.activeTarget\s*=\s*pokemon\s*;/.test(CBLOCK[1]),
   'the authority REPOINTS `battle.activeTarget` at the confused body inside onBeforeMove',
   CBLOCK ? null : 'the confusion block did not parse — the citation below is unverified');
ok(!!CBLOCK && /randomChance\(33,\s*100\)/.test(CBLOCK[1]),
   'and the 1/3 roll sits ABOVE that repoint, so the two draws are addressed differently',
   CBLOCK && /randomChance\(33,\s*100\)/.test(CBLOCK[1]) ? null : 'the chance line did not match');
const BA = fs.readFileSync(SIMDIR + 'sim/battle-actions.ts', 'utf8');
ok(/getConfusionDamage[\s\S]{0,900}?this\.battle\.randomizer\(damage\)/.test(BA),
   'getConfusionDamage ends in `this.battle.randomizer(damage)` — one random(16), taken directly',
   null);

/* THE MEMBERSHIP THAT BACKS THE 35142 SIDE-SELECTION DECLARATION. `sweepField`'s `foeSf` argument is
 * read only under hazardsFrom target/both or screensFrom 'target'; the site in the DAMAGING branch
 * hands it the mover's far side. That is correct there only for as long as every carrier that
 * consumes it is a STATUS move and therefore resolves at one of the two sibling sites. Derived, so a
 * new damaging carrier turns this red by name instead of silently inheriting the assumption. */
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const CONSUMERS = Object.entries(TAGS.moves)
  .map(([id, v]) => [id, v.params && v.params.removesHazards])
  .filter(([, p]) => p && (p.hazardsFrom === 'target' || p.hazardsFrom === 'both'
                           || (p.alsoRemoves && p.alsoRemoves.length)));
console.log('     removesHazards carriers that CONSUME sweepField(foeSf): '
  + CONSUMERS.map(([id, p]) => id + ' (' + D.moves.get(id).category + ', hazardsFrom '
      + p.hazardsFrom + ')').join(', '));
ok(CONSUMERS.length > 0 && CONSUMERS.every(([id]) => D.moves.get(id).category === 'Status'),
   'every move that consumes that argument is a STATUS move, so the damaging branch\'s copy is unread',
   CONSUMERS.filter(([id]) => D.moves.get(id).category !== 'Status').map(([id]) => id).join(', ')
     || (CONSUMERS.length ? null : 'nothing matched — the declaration for that site is now unbacked'));

/* ==================================================================================================
 * THE TWO BOARDS — one team pair, so the only thing that varies is the confused body's click
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* Milotic is base 81 Speed against Snorlax's 30, so the Confuse Ray lands BEFORE Snorlax acts and the
 * volatile is on it for its own click that same turn — which is the only turn it can be, because
 * `CONFUSION_TURNS_MIN` is 2 and the next onBeforeMove takes it to zero and removes it. */
const SIDE_A = () => [mon('milotic', '', 'Marvel Scale', ['Confuse Ray', 'Protect']),
                      mon('garchomp', '', 'Rough Skin', ['Protect'])]
                     .concat(FILL('toxapex', 'corviknight'));
const SIDE_B = () => [mon('snorlax', '', 'Thick Fat', ['Body Slam', 'Amnesia', 'Protect']),
                      mon('weavile', '', 'Pressure', ['Protect'])]
                     .concat(FILL('incineroar', 'gholdengo'));

/* The padding turns exist ONLY to move the `turn` field of the address, which is what decides whether
 * the 1/3 roll passes at all — the die is a hash of the address, so "does this confusion connect" is a
 * property of the turn number and not something a seed can be nudged into. Both counts were found by
 * sweeping pad 0..7 and are pinned here so the arms are reproducible. */
const pad = n => { const s = []; for (let i = 0; i < n; i++)
  s.push({ p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] }); return s; };

const ARMS = [
  { id: 'foe-aimed-confused-click',
    governed: true,
    what: 'Snorlax is confused by Milotic\'s Confuse Ray and clicks BODY SLAM at the Milotic in p10 '
        + 'on the same turn. The authority addresses the 1/3 roll at p10 and the damage roll at p20, '
        + 'because it repoints `activeTarget` at the confused body between them. Under the restore '
        + 'knob this engine puts both at p10 and the damage draw is an address the authority never '
        + 'asked about — two independent dice for one event.',
    script: pad(5).concat([{ p1: [{ m: 'confuseray', t: 0 }, { m: 'protect' }],
                            p2: [{ m: 'bodyslam', t: 0 }, { m: 'protect' }] }]) },

  { id: 'self-aimed-confused-click',
    governed: false,
    what: 'THE CONTROL, and the exact board the 2026-08-22 review staged. Snorlax clicks AMNESIA, '
        + 'which is `target: \'self\'`, so the click\'s target and the confused body are the same '
        + 'slot and the two addresses coincide whichever way this engine stamps them. It shared '
        + 'every address before the change and must go on sharing them — a red here would mean the '
        + 'repoint broke the ordinary road rather than fixing the foe-aimed one.',
    script: pad(7).concat([{ p1: [{ m: 'confuseray', t: 0 }, { m: 'protect' }],
                            p2: [{ m: 'amnesia' }, { m: 'protect' }] }]) },
];

/* ==================================================================================================
 * 1. THE ADDRESSES, READ OFF THE DRIVER'S OWN LOGS
 * ==================================================================================================
 * Nothing here recomputes an address. `midAddresses()` hands out THIS RUN'S two logs — `sd` is the
 * differential's record of every draw the authority took, `me` is the engine's own `midEventLog()` —
 * so the probe cannot agree with itself about a rule it also implements.
 * ================================================================================================== */
const G = SB.harness();
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS', 'rngStreams'] });
console.log('\n1. THE `any` ADDRESSES EACH ENGINE DREW, AND WHETHER THEY ARE THE SAME EVENTS');
const RESULT = {};
for (const arm of ARMS) {
  G.midResetAddresses();
  const hit0 = M.MEDSEEN.confusionSelfHit, mv0 = M.MEDSEEN.confusionDmgAddrMovedToSelf;
  const a = G.buildPair(SIDE_A()), b = G.buildPair(SIDE_B());
  const boards = [];
  const r = (!a || !b) ? { err: 'buildPair returned null', turns: 0 }
    : G.playGame(a, b, 'directed', 'm6-' + arm.id, { script: arm.script,
        onBoundary: (snap, t) => { boards.push({ t, diffs: (snap.diffs || []).slice() });
                                   snap.identical = true; snap.diffs = []; } });
  const ad = G.midAddresses();
  /* `dmg` JOINED THE FILTER ON 2026-09-04 AND THAT IS THE WHOLE POINT OF THE SECOND HALF. The
   * self-hit roll used to land in `any` on both sides; it is now `dmg` on both sides. A filter left
   * at `any` alone would have gone on passing while comparing NOTHING about the draw this probe is
   * named for — the vacuously-green failure this file's §2 anti-vacuity check exists to stop. Both
   * categories are read so the probe is the same test under either knob. */
  const pick = xs => xs.filter(x => /\|any\||\|dmg\|/.test(x));
  const sd = pick(ad.sd), me = pick(ad.me);
  const sdSet = new Set(sd);
  const unshared = me.filter(x => !sdSet.has(x));
  const sdOnly = sd.filter(x => !new Set(me).has(x));
  RESULT[arm.id] = { sd, me, unshared, sdOnly, boards, err: r.err, turns: r.turns,
                     hits: M.MEDSEEN.confusionSelfHit - hit0,
                     moved: M.MEDSEEN.confusionDmgAddrMovedToSelf - mv0 };

  console.log('\n  [' + arm.id + ']' + (arm.governed && KNOB ? '   [expected RED: the knob is armed]' : ''));
  console.log('    ' + arm.what.replace(/(.{92}\s)/g, '$1\n    '));
  ok(!r.err && r.turns === arm.script.length,
     'the arm played its whole script',
     r.err ? r.err : (r.turns !== arm.script.length ? 'played ' + r.turns + ' of ' + arm.script.length : null));
  /* THE ANTI-VACUITY CHECK, AND IT IS THE FIRST ONE FOR A REASON. Two engines agreeing about a
   * mechanic that never fired is what last batch's M8 fixture did. */
  ok(RESULT[arm.id].hits > 0,
     'the confusion self-hit ACTUALLY FIRED on this board — the arm is not vacuous',
     'confusionSelfHit delta = ' + RESULT[arm.id].hits
     + ' (a zero means the 1/3 roll never passed and every reading below is about nothing)');
  console.log('    authority `any`+`dmg` draws: ' + sd.length + '   engine `any`+`dmg` draws: ' + me.length);
  for (const x of sd) console.log('      sd  ' + (new Set(me).has(x) ? '   ' : '<< ') + x);
  for (const x of me) console.log('      me  ' + (sdSet.has(x) ? '   ' : '>> ') + x);
  ok(unshared.length === 0,
     'every `any`/`dmg` die this engine drew is one the authority also drew, at the same address',
     unshared.length ? 'UNSHARED (this engine only):\n' + unshared.join('\n') : null);
  ok(sdOnly.length === 0,
     'and every `any`/`dmg` die the authority drew is one this engine drew — the match is both ways',
     sdOnly.length ? 'UNSHARED (the authority only):\n' + sdOnly.join('\n') : null);
}

/* ==================================================================================================
 * 2. THE KNOB IS LOAD-BEARING, AND IT DOES NOT OVER-FIRE
 * ==================================================================================================
 * `confusionDmgAddrMovedToSelf` counts only the draws where the stamp actually CHANGED. Arm 1 must
 * move it and arm 2 must not — if arm 2 moved it, the counter would be measuring "a confusion self
 * hit happened" rather than "the address was wrong", and a green arm 1 would prove nothing.
 * ================================================================================================== */
console.log('\n2. THE COUNTERS');
const A1 = RESULT['foe-aimed-confused-click'], A2 = RESULT['self-aimed-confused-click'];
console.log('     confusionDmgAddrMovedToSelf: foe-aimed arm ' + A1.moved + '   self-aimed arm ' + A2.moved);
console.log('     confusionSelfHit (whole process) ' + M.MEDSEEN.confusionSelfHit
  + '   confusionSet ' + M.MEDSEEN.confusionSet
  + '   confusionMinDuration ' + M.MEDSEEN.confusionMinDuration);
ok(KNOB ? M.MEDFAILS.confusionDmgAddrLegacyRestored === 1
        : M.MEDFAILS.confusionDmgAddrLegacyRestored === 0,
   'the restore knob reports its own state',
   'confusionDmgAddrLegacyRestored=' + M.MEDFAILS.confusionDmgAddrLegacyRestored);
ok(KNOB || A1.moved > 0,
   'the repoint actually MOVED an address on the foe-aimed arm — it is load-bearing, not a redundant write',
   'moved=' + A1.moved + ' — a zero means the stamp never changes anything and this fix is inert');
ok(A2.moved === 0,
   'and it moved NOTHING on the self-aimed arm — the counter measures the address, not the self-hit',
   'moved=' + A2.moved + ' — a non-zero would mean the counter fires whenever confusion damage is '
   + 'dealt, and the discrimination above is fake');

/* ---- 2026-09-04, THE INSTRUMENT HALF'S OWN COUNTERS. BOTH SIDES, BECAUSE EITHER ALONE IS A THIRD
 * BEHAVIOUR: this engine has to be drawing on `dmg` AND the authority's `getConfusionDamage` has to
 * be wrapped as `dmg`. A green §3 with only one of them true would be luck. */
const WS = G.midWrapState ? G.midWrapState() : {};
console.log('     confusionDmgOnDmgStream ' + M.MEDSEEN.confusionDmgOnDmgStream
  + '   confusionDmgStreamMissing ' + M.MEDFAILS.confusionDmgStreamMissing
  + '   instrument getConfusionDamage entries ' + WS.confusionDmgEnters
  + '   instrument legacy ' + WS.confusionDmgCatLegacy);
ok(KNOB2 ? M.MEDFAILS.confusionDmgCatLegacyRestored === 1
         : M.MEDFAILS.confusionDmgCatLegacyRestored === 0,
   'the INSTRUMENT-half restore knob reports its own state',
   'confusionDmgCatLegacyRestored=' + M.MEDFAILS.confusionDmgCatLegacyRestored);
ok(M.MEDFAILS.confusionDmgStreamMissing === 0,
   'the self-hit roll never fell back to the generic die for want of a stream struct',
   M.MEDFAILS.confusionDmgStreamMissingFirst || null);
ok(KNOB2 ? M.MEDSEEN.confusionDmgOnDmgStream === 0 : M.MEDSEEN.confusionDmgOnDmgStream > 0,
   'this engine drew the self-hit roll on the `dmg` stream  [and NOT under the legacy knob]',
   'confusionDmgOnDmgStream=' + M.MEDSEEN.confusionDmgOnDmgStream);
ok(KNOB2 ? !(WS.confusionDmgEnters > 0) : WS.confusionDmgEnters > 0,
   'and the instrument entered the WRAPPED `getConfusionDamage`, so the authority\'s draw is `dmg` too',
   'confusionDmgEnters=' + WS.confusionDmgEnters + ' — a zero on a clean run means the wrapper is not '
   + 'on this authority build and every reading here is about the un-inverted road');

/* ==================================================================================================
 * 3. THE BOARD — ASSERTED SINCE 2026-09-04, BECAUSE THE INSTRUMENT HALF LANDED
 * ==================================================================================================
 * This section used to PRINT and assert nothing, because the residual belonged to
 * `game_differential.js` and a probe born red for another file's defect is the "known failure" this
 * repository bans. The wrapper is in now, so the sentence flips: the boards must be IDENTICAL.
 *
 * AND THE NEGATIVE IS THE KNOB. Under `MEDI_CONFUSION_DMG_CAT_LEGACY=1` both halves go back and the
 * two engines read one shared `u` in opposite directions — index i against index 15-i, which can
 * never coincide — so the self-hit damage differs and BOTH arms must part. An assertion that only
 * ever ran in the green direction would pass just as well against an engine that never rolled at all.
 * ================================================================================================== */
console.log('\n3. THE SELF-HIT BOARD' + (KNOB2 ? '  [expected RED on both arms: the instrument knob is armed]' : ''));
for (const arm of ARMS) {
  const parted = RESULT[arm.id].boards.filter(x => x.diffs.length);
  for (const p of parted) {
    const hp = p.diffs.filter(d => /\.hp$/.test(d.path));
    console.log('     [' + arm.id + '] turn ' + p.t + '  '
      + (hp.length ? hp.map(d => d.path + '  medicham ' + d.medicham + ' vs showdown ' + d.showdown).join('   ')
                   : JSON.stringify(p.diffs.slice(0, 3))));
  }
  /* KNOB1 re-addresses the draw and hands the two engines INDEPENDENT dice, which may agree by luck.
   * That arm's red is the unshared address in §1 and the board is only printed for it. */
  if (KNOB) { if (!parted.length) console.log('     [' + arm.id + '] boards identical on every turn'); continue; }
  if (KNOB2) {
    ok(parted.length > 0,
       '[' + arm.id + '] the board PARTS under the legacy read — the anti-correlated die is real',
       parted.length ? null : 'boards identical: index i and index 15-i cannot coincide, so an '
         + 'identical board here means the self-hit never rolled and the arm is vacuous');
  } else {
    ok(parted.length === 0,
       '[' + arm.id + '] the self-hit board is IDENTICAL — same address, same u, same sixteen-index read',
       parted.length ? parted.map(p => 'turn ' + p.t + ' ' + p.diffs.map(d => d.path + ' '
         + d.medicham + ' vs ' + d.showdown).join(', ')).join('\n') : null);
  }
}

/* ==================================================================================================
 * 4. THE PINNED CORNERS ARE UNTOUCHED, AND THAT WAS THE STATED OBJECTION TO FIXING THIS AT ALL
 * ==================================================================================================
 * The previous pass declined to move this engine's direction because a corner arm answers
 * `random(16)` with its own `damageIndex` whatever the category says, so a flip here would have
 * parted `bottom-tie-first` on every confusion self-hit. The fix that landed instead moves the
 * STREAM, and the claim that this is inert under a corner is arithmetic worth checking rather than
 * repeating: `rngStreams(f)` for a plain function aliases every stream to `f`.
 * ================================================================================================== */
console.log('\n4. THE CORNER ARMS CANNOT TELL `dmg` FROM `any`, SO NEITHER HALF REACHES THEM');
{
  const R = M.rngStreams(() => 0.25);
  ok(R.dmg === R.any && R.dmg() === 0.25,
     'rngStreams(plain function) aliases `dmg` to `any` — a corner arm and every rollout draw the '
     + 'same die either way, so this engine\'s half is a no-op there',
     R.dmg === R.any ? null : 'the two streams are DIFFERENT functions under a plain rng — the corner '
       + 'arms and live play would now see a changed sequence, which this fix does not claim');
  const S = M.rngStreams({ seed: 7 });
  ok(S.dmg !== S.any,
     '...and a SPLIT struct does separate them, so the change is not vacuous where it is meant to act',
     S.dmg === S.any ? 'a seeded struct aliases them too — then the stream move addresses nothing' : null);
}

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
