/* probe_corner_mechanisms.js — THE SPEED-TIE CORNER DEFECTS, ONE STAGED MECHANISM EACH, BOTH ENGINES.
 *
 *   SHOWDOWN_PATH=... node tests/probe_corner_mechanisms.js [--release <id>] [--only <mech>] [--no-knobs]
 *
 * With no `--release` the LIVE tree is frozen into a scratch store (tests/_live_release.js), so this can
 * gate an edit without writing to data/releases. `--release 5973a4e3c768` is the pre-fix engine and is how
 * this file was shown RED before any fix landed.
 *
 * ================= WHAT IT IS =====================================================================
 *
 * The corner arms of the whole-game differential (release 5973a4e3c768, 961 games each) left 8 top and
 * 11 bottom board-material games. `engine/replay_one.js` replayed every one of them and each split was
 * read on the line. This file stages each mechanism ALONE, with a control on the SAME bodies that
 * must NOT part, and plays both engines under the corner pin the pool game was played under. Showdown
 * is the expectation. Nothing here types a damage number, a stat or a status.
 *
 * Each mechanism carries:
 *   - its RED arms, which must agree with the authority on the clean engine and PART under its knob;
 *   - its CONTROLS, which must agree in both positions of the knob (the over-fire guard);
 *   - a FIXTURE check read off the AUTHORITY's own log, so an arm that never staged its mechanism
 *     (the body did not faint, the flinch did not fire, the mega did not happen) FAILS by name instead
 *     of agreeing about nothing;
 *   - a COUNTER the fix increments, asserted non-zero on the red arms and zero on the controls, so the
 *     green is shown to have come through the new code rather than around it.
 *
 * The parent runs every arm clean, then spawns ONE CHILD PER MECHANISM with only that mechanism's knob
 * set and `--only <mech>`; a knob that parted a control, or failed to part a red, fails the parent.
 *
 * ================= THE MECHANISMS (pool game → section) ============================================
 *
 *   encore-rewrite     T …2661290217, B …2635374300  Champions' `encore.condition.onStart` calls
 *                      `queue.changeAction` on a queued MOVE action whatever it is — a pivot, a Struggle
 *                      (data/mods/champions/moves.ts:286-322); medicham2 kept both
 *   entry-dead         B …2662004374  an entrant Stealth Rock already fainted still ran its ability
 *                      (sim/battle.ts:511-513 skips a fainted holder; :565 faintMessages between handlers)
 *   acquired-start     B …2661305652  Wandering Spirit's swap onto a KO'd holder never ran the acquired
 *                      Intimidate (`skillSwap` refuses only on `fainted`, which is not set until
 *                      faintMessages)
 *   min-one            T …2663746491  `modifyDamage` returns 1 for a 0 (Champions scripts.ts:309)
 *   feint-detect       B …2659466378  Detect's shield volatile is `protect`; medicham2 compared the move id
 *   thaw-flinch        B …2634612764  a defrost move thaws in `frz.onModifyMove`, BELOW the flinch refusal
 *   pivot-no-target    B …2655672115  Parting Shot with no target writes [notarget] + -fail and never switches
 *   steal-full-hand    T …2657567717  Thief/Covet return when the thief holds an item (data/moves.ts:19305)
 *   cost-cap           T …2654931424  Belly Drum fails at +6 Attack (data/moves.ts:1225-1227)
 *   rewire-switch      T …2656451791  Champions' `clearVolatile` ends in `setSpecies(baseSpecies)`, so a
 *                      Speed Swap is undone when the body leaves (ROADMAP #571)
 *   half-hp-floor      B …2662677462  Super Fang is `clampIntRange(hp/2, 1)`; the generic damage road floored to 0
 *   knockoff-chain     T …2655635795  Knock Off's x1.5 is a `chainModify` in the SAME base-power chain as
 *                      Helping Hand; medicham2 floored it alone first
 *   volley-user-faint  B …2659828909  the hit loop breaks when the USER has no HP (scripts.ts: `if
 *                      (!pokemon.hp && targets.length === 1) { hit++; break; }`); a Rough Skin KO did not stop it
 *
 * ================= WHAT IT CANNOT SEE =============================================================
 *
 * Anything a staged four-body board cannot reach: a Mental Herb holder under Encore, a Magic Room thief,
 * a Parental Bond packet under Unseen Fist, a volley into two targets, Guard Split and Power Split (the
 * same undo rides on the same field and is not staged), a transformed body that was also rewired.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const NL = '\n';
require(path.join(ROOT, 'engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('CORNER MECHANISMS');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  process.exit(2);
}
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
/* BEFORE THE DRIVER, NEVER AFTER — game_differential.js CUTS a release at require time when --release is
 * absent, and a bare run would write that cut into the real store. */
/* LIVE is carried to every knob child: a scratch-store release id means nothing to a child that did not
 * preload the same redirect, and it would open the REAL store and die on a missing id. */
const LIVE = !process.argv.includes('--release') || process.argv.includes('--live-store');
if (LIVE) require(path.join(ROOT, 'tests', '_live_release.js'));
if (!process.argv.includes('--release')) {
  const ER = require(path.join(ROOT, 'engine', 'engine_release.js'));
  process.argv.push('--release', ER.cut('tests/probe_corner_mechanisms.js — freeze the tree under test').id);
}
const RELEASE = argOf('--release', null);
const ONLY = argOf('--only', null);
const CHILD = process.argv.includes('--knob-child');
const NO_KNOBS = process.argv.includes('--no-knobs');
const DUMP = argOf('--dump', null);   // `<mech>/<arm>` — print both streams for one arm

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const D = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail && !cond) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

/* ==================================================================================================
 * THE BODIES. Every row is asked of the validator (`canLearn`) and of the format before anything plays.
 * ============================================================================================== */
const S = (species, ability, item, moves, hpx) => ({ species, ability, item: item || '', moves, hpx: hpx || 1 });
const MIL = S('Milotic', 'Marvel Scale', '', ['Recover', 'Protect']);
const PEX = S('Toxapex', 'Regenerator', '', ['Protect', 'Recover']);
const CORV = S('Corviknight', 'Pressure', '', ['Bulk Up', 'Iron Defense']);
const CLEF = S('Clefable', 'Magic Guard', '', ['Calm Mind', 'Protect']);
const SYLV = S('Sylveon', 'Pixilate', '', ['Calm Mind', 'Protect']);
const CHOMP = S('Garchomp', 'Rough Skin', '', ['Swords Dance', 'Protect']);
const c = (m, t) => (t == null ? { m } : { m, t });

const MECHS = [
  { id: 'encore-rewrite', knob: 'MEDI_ENCORE_REWRITE_KEEPS_GUARDS', arm: 'top-tie-first',
    counter: 'encoreRewroteGuardedAction',
    arms: (() => {
      const A_PS = [S('Incineroar', 'Blaze', '', ['Swords Dance', 'Parting Shot', 'Bulk Up']), CORV, MIL, PEX];
      const B_PS = [S('Raichu', 'Lightning Rod', '', ['Encore', 'Nasty Plot', 'Protect']), CHOMP, CLEF, SYLV];
      const ps = enc => [
        { p1: [c('swordsdance'), c('bulkup')], p2: [c('nastyplot'), c('swordsdance')] },
        { p1: [c('partingshot', 1), c('irondefense')], p2: [enc ? c('encore', 0) : c('nastyplot'), c('swordsdance')] }];
      const A_ST = [S('Clefable', 'Unaware', '', ['Moonblast']), CORV, MIL, PEX];
      const B_ST = [S('Sableye', 'Prankster', '', ['Disable', 'Encore', 'Calm Mind']), S('Raichu', 'Lightning Rod', '', ['Protect', 'Nasty Plot']), CHOMP, SYLV];
      const st = enc => [
        { p1: [c('moonblast', 1), c('bulkup')], p2: [c('calmmind'), c('protect')] },
        { p1: [c('moonblast', 1), c('irondefense')], p2: [c('disable', 0), c('nastyplot')] },
        { p1: [c('struggle'), c('bulkup')], p2: [enc ? c('encore', 0) : c('calmmind'), c('nastyplot')] }];
      const sdCount = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'PIVOT', kind: 'red', A: A_PS, B: B_PS, script: ps(true),
          fixture: x => [[sdCount(x, /^\|move\|p1a: Incineroar\|Swords Dance/) === 2,
            'the authority rewrote the queued Parting Shot into the encored Swords Dance (2 Swords Dance lines)']] },
        { id: 'PIVOT-CONTROL', kind: 'ctl', A: A_PS, B: B_PS, script: ps(false),
          fixture: x => [[sdCount(x, /^\|switch\|p1a: .*\|\[from\] Parting Shot/) === 1 || sdCount(x, /^\|switch\|p1a: /) >= 2,
            'with no Encore the authority pivots Incineroar out']] },
        { id: 'STRUGGLE', kind: 'red', A: A_ST, B: B_ST, script: st(true),
          fixture: x => [[sdCount(x, /^\|cant\|p1a: Clefable\|Disable/) === 2,
            'the authority rewrote the forced Struggle into the Disabled Moonblast (`cant|Disable` on turns 2 AND 3)']] },
        { id: 'STRUGGLE-CONTROL', kind: 'ctl', A: A_ST, B: B_ST, script: st(false),
          fixture: x => [[sdCount(x, /^\|move\|p1a: Clefable\|Struggle/) === 1,
            'with no Encore the authority Struggles']] },
      ];
    })() },

  { id: 'entry-dead', knob: 'MEDI_ENTRY_DEAD_STILL_STARTS', arm: 'bottom-tie-first',
    counter: 'entryHandlersSkippedDead',
    arms: (() => {
      const whim = S('Whimsicott', 'Prankster', '', ['Endeavor', 'Sunny Day', 'Charm'], 0.05);
      const B = [S('Garchomp', 'Rough Skin', '', ['Stealth Rock', 'Swords Dance']), whim, CLEF, SYLV];
      const A_INT = [S('Incineroar', 'Intimidate', '', ['Bulk Up', 'Swords Dance']), MIL, CORV, PEX];
      /* Tailwind and not Roost: the first build clicked Roost, which healed Pelipper from 7 to 75 before
       * the bench trip, so it survived the rock and the arm staged nothing (read off the dump). */
      const A_SET = [S('Pelipper', 'Drizzle', '', ['Tailwind', 'Protect']), MIL, CORV, PEX];
      const script = (lead, first, endeavor) => [
        { p1: [c(first), c('recover')], p2: [c('stealthrock'), endeavor ? c('endeavor', 0) : c('charm', 1)] },
        { p1: [{ sw: 'corviknight' }, c('protect')], p2: [c('swordsdance'), c('sunnyday')] },
        { p1: [{ sw: lead }, c('recover')], p2: [c('swordsdance'), c('charm', 1)] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'INTIMIDATE', kind: 'red', A: A_INT, B, script: script('incineroar', 'bulkup', true),
          fixture: x => [[n(x, /^\|faint\|p1a: Incineroar/) === 1, 'the authority\'s Incineroar fainted to Stealth Rock on re-entry'],
                         [n(x, /^\|-ability\|p1a: Incineroar\|Intimidate/) === 1, 'the authority ran Intimidate for the lead ONLY']] },
        { id: 'SETTER', kind: 'red', A: A_SET, B, script: script('pelipper', 'tailwind', true),
          fixture: x => [[n(x, /^\|faint\|p1a: Pelipper/) === 1, 'the authority\'s Pelipper fainted to Stealth Rock on re-entry'],
                         [n(x, /^\|-weather\|RainDance\|\[from\] ability: Drizzle/) === 1, 'the authority set rain for the lead ONLY — the dead entrant\'s Drizzle did not run']] },
        { id: 'INTIMIDATE-CONTROL', kind: 'ctl', A: A_INT, B, script: script('incineroar', 'bulkup', false),
          fixture: x => [[n(x, /^\|faint\|p1a: Incineroar/) === 0 && n(x, /^\|-ability\|p1a: Incineroar\|Intimidate/) === 2,
            'at full HP the authority\'s Incineroar survives re-entry and Intimidates twice']] },
      ];
    })() },

  { id: 'acquired-start', knob: 'MEDI_ACQUIRED_START_NEEDS_HP', arm: 'top-tie-first',
    counter: 'acquiredStartAtZeroHP',
    arms: (() => {
      const rune = hpx => S('Runerigus', 'Wandering Spirit', '', ['Iron Defense', 'Protect'], hpx);
      const B = ab => [S('Scrafty', ab, '', ['Knock Off', 'Bulk Up']), S('Kangaskhan', 'Scrappy', '', ['Protect', 'Low Kick']), CLEF, SYLV];
      const script = [{ p1: [c('irondefense'), c('recover')], p2: [c('knockoff', 0), c('protect')] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        /* Kangaskhan carries Scrappy, which refuses Intimidate in this generation, so the drop is read on the
         * ATTACKER — Scrafty, now holding Wandering Spirit — and Kangaskhan is the body that must NOT move. */
        { id: 'KO-HOLDER', kind: 'red', A: [rune(0.1), MIL, CORV, PEX], B: B('Intimidate'), script, counterMin: 1,
          fixture: x => [[n(x, /^\|faint\|p1a: Runerigus/) === 1, 'the authority\'s Runerigus fainted to the Knock Off'],
                         [n(x, /^\|-unboost\|p2a: Scrafty\|atk\|1/) === 1, 'the authority ran the ACQUIRED Intimidate from the 0-HP holder']] },
        { id: 'FULL-HP-CONTROL', kind: 'ctl', A: [rune(1), MIL, CORV, PEX], B: B('Intimidate'), script,
          fixture: x => [[n(x, /^\|faint\|p1a: Runerigus/) === 0 && n(x, /^\|-unboost\|p2a: Scrafty\|atk\|1/) === 1,
            'a surviving holder takes Intimidate and drops the attacker']] },
        { id: 'NO-INTIMIDATE-CONTROL', kind: 'ctl', A: [rune(0.1), MIL, CORV, PEX], B: B('Shed Skin'), script, counterAny: true,
          fixture: x => [[n(x, /^\|faint\|p1a: Runerigus/) === 1 && n(x, /^\|-unboost\|p2/) === 0,
            'an acquired Shed Skin does nothing on the way down']] },
      ];
    })() },

  { id: 'min-one', knob: 'MEDI_DAMAGE_NO_MIN_ONE', arm: 'top-tie-first',
    counter: 'damageFlooredToOne',
    arms: (() => {
      const A = [S('Whimsicott', 'Prankster', '', ['Charm', 'Tailwind']), CORV, MIL, PEX];
      const B = [S('Kangaskhan', 'Scrappy', 'Kangaskhanite', ['Low Kick', 'Protect']), CHOMP, CLEF, SYLV];
      const script = charm => [1, 2, 3].map(t => ({ p1: [charm ? c('charm', 0) : c('tailwind'), c(t === 2 ? 'irondefense' : 'bulkup')],
        p2: [Object.assign(c('lowkick', 0), t === 1 ? { mega: true } : {}), c('swordsdance')] }));
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'CHARMED', kind: 'red', A, B, script: script(true),
          fixture: x => [[n(x, /^\|detailschange\|p2a: Kangaskhan\|Kangaskhan-Mega/) === 1, 'the authority mega evolved Kangaskhan'],
                         [n(x, /^\|-hitcount\|p1a: Whimsicott\|2/) >= 2, 'Parental Bond landed both packets on at least two turns']] },
        { id: 'UNCHARMED-CONTROL', kind: 'ctl', A, B, script: script(false),
          fixture: x => [[n(x, /^\|-hitcount\|p1a: Whimsicott\|2/) >= 1, 'Parental Bond landed both packets']] },
      ];
    })() },

  { id: 'feint-detect', knob: 'MEDI_FEINT_READS_MOVE_ID', arm: 'top-tie-first',
    counter: 'breakProtectByShieldVolatile',
    arms: (() => {
      const A = [S('Weavile', 'Pressure', '', ['Feint', 'Swords Dance']), S('Garchomp', 'Rough Skin', '', ['Dragon Claw', 'Swords Dance']), MIL, PEX];
      const B = [S('Lucario', 'Inner Focus', '', ['Detect', 'Protect', 'Swords Dance']), CORV, CLEF, SYLV];
      const script = sh => [{ p1: [c('feint', 0), c('dragonclaw', 0)], p2: [c(sh), c('bulkup')] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      const fx = x => [[n(x, /^\|-activate\|p2a: Lucario\|move: Feint/) === 1, 'the authority\'s Feint broke the shield'],
                       [n(x, /^\|-damage\|p2a: Lucario/) >= 2, 'and the partner\'s Dragon Claw LANDED behind it']];
      return [
        { id: 'DETECT', kind: 'red', A, B, script: script('detect'), fixture: fx },
        { id: 'PROTECT-CONTROL', kind: 'ctl', A, B, script: script('protect'), fixture: fx },
      ];
    })() },

  { id: 'thaw-flinch', knob: 'MEDI_THAW_ABOVE_FLINCH', arm: 'bottom-tie-first',
    counter: 'thawDeferredRefused', ctlCounter: 'thawDeferredToUse',
    arms: (() => {
      const A = [S('Milotic', 'Marvel Scale', '', ['Scald', 'Recover']), CORV, PEX, S('Clefable', 'Magic Guard', '', ['Calm Mind', 'Protect'])];
      const B = [S('Glaceon', 'Ice Body', '', ['Ice Beam', 'Calm Mind']), S('Gengar', 'Cursed Body', '', ['Dark Pulse', 'Shadow Ball']), SYLV, CHOMP];
      const script = flinch => [
        { p1: [c('recover'), c('bulkup')], p2: [c('icebeam', 0), c('shadowball', 1)] },
        { p1: [c('scald', 0), c('irondefense')], p2: [c('calmmind'), flinch ? c('darkpulse', 0) : c('shadowball', 0)] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'FLINCHED', kind: 'red', A, B, script: script(true),
          fixture: x => [[n(x, /^\|-status\|p1a: Milotic\|frz/) === 1, 'the authority froze Milotic on turn 1'],
                         [n(x, /^\|cant\|p1a: Milotic\|flinch/) === 1, 'the authority flinched it on turn 2'],
                         [n(x, /^\|-curestatus\|p1a: Milotic\|frz/) === 0, 'and it is STILL frozen — no thaw was written']] },
        { id: 'UNFLINCHED-CONTROL', kind: 'ctl', A, B, script: script(false),
          fixture: x => [[n(x, /^\|-status\|p1a: Milotic\|frz/) === 1 && n(x, /^\|-curestatus\|p1a: Milotic\|frz\|\[from\] move: Scald/) === 1,
            'unflinched, the authority thaws Milotic off its own Scald']] },
      ];
    })() },

  { id: 'pivot-no-target', knob: 'MEDI_PIVOT_NO_TARGET_SWITCHES', arm: 'bottom-tie-first',
    counter: 'pivotNoTargetFailed',
    arms: (() => {
      const A = [S('Charizard', 'Blaze', '', ['Heat Wave', 'Protect']), S('Incineroar', 'Blaze', '', ['Parting Shot', 'Bulk Up']), MIL, CORV];
      const tiny = [S('Clefable', 'Magic Guard', '', ['Calm Mind', 'Protect'], 0.05), S('Sylveon', 'Pixilate', '', ['Calm Mind', 'Protect'], 0.05), PEX, CHOMP];
      const bulky = [PEX, S('Clefable', 'Magic Guard', '', ['Calm Mind', 'Protect']), SYLV, CHOMP];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'BOTH-FOES-DOWN', kind: 'red', A, B: tiny,
          script: [{ p1: [c('heatwave'), c('partingshot', 0)], p2: [c('calmmind'), c('calmmind')] }],
          fixture: x => [[n(x, /^\|faint\|p2[ab]: /) === 2, 'the authority\'s Heat Wave knocked out both foes'],
                         [n(x, /^\|move\|p1b: Incineroar\|Parting Shot\|.*\[notarget\]/) === 1 && n(x, /^\|-fail\|p1b: Incineroar/) === 1,
                          'the authority wrote `[notarget]` and `-fail`'],
                         [afterStart(x).filter(l => /^\|switch\|p1b: /.test(l)).length === 0, 'and Incineroar did NOT leave']] },
        { id: 'FOES-STANDING-CONTROL', kind: 'ctl', A, B: bulky,
          script: [{ p1: [c('heatwave'), c('partingshot', 0)], p2: [c('recover'), c('calmmind')] }],
          fixture: x => [[afterStart(x).filter(l => /^\|switch\|p1b: /.test(l)).length === 1, 'with a foe standing the authority pivots']] },
      ];
    })() },

  { id: 'steal-full-hand', knob: 'MEDI_STEAL_IGNORES_FULL_HAND', arm: 'top-tie-first',
    counter: 'stealRefusedFullHand',
    arms: (() => {
      const thief = item => [S('Sneasler', 'Pressure', item, ['Thief', 'Swords Dance']), CORV, MIL, PEX];
      const B = [S('Corviknight', 'Pressure', 'Leftovers', ['Bulk Up', 'Iron Defense']), CLEF, SYLV, CHOMP];
      const script = [{ p1: [c('thief', 0), c('bulkup')], p2: [c('bulkup'), c('calmmind')] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'HOLDING', kind: 'red', A: thief('Focus Sash'), B, script,
          fixture: x => [[n(x, /^\|-item\|p1a: Sneasler\|Leftovers/) === 0 && n(x, /^\|-enditem\|p2a: Corviknight\|Leftovers/) === 0,
            'a thief holding an item takes NOTHING in the authority']] },
        { id: 'EMPTY-HAND-CONTROL', kind: 'ctl', A: thief(''), B, script,
          fixture: x => [[n(x, /^\|-item\|p1a: Sneasler\|Leftovers\|\[from\] move: Thief/) === 1, 'an empty-handed thief takes the Leftovers']] },
      ];
    })() },

  { id: 'cost-cap', knob: 'MEDI_COST_BOOST_NO_CAP_FAIL', arm: 'top-tie-first',
    counter: 'costBoostFailedAtCap',
    arms: (() => {
      const A = [S('Azumarill', 'Huge Power', '', ['Belly Drum', 'Helping Hand', 'Protect']), CORV, MIL, PEX];
      const B = [S('Whimsicott', 'Prankster', '', ['Charm', 'Tailwind']), CLEF, SYLV, CHOMP];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'AT-PLUS-SIX', kind: 'red', A, B,
          script: [{ p1: [c('bellydrum'), c('bulkup')], p2: [c('tailwind'), c('calmmind')] },
                   { p1: [c('bellydrum'), c('irondefense')], p2: [c('tailwind'), c('calmmind')] }],
          fixture: x => [[n(x, /^\|-fail\|p1a: Azumarill/) === 1, 'the authority failed the second Belly Drum']] },
        { id: 'AT-PLUS-FOUR-CONTROL', kind: 'ctl', A, B,
          script: [{ p1: [c('bellydrum'), c('bulkup')], p2: [c('tailwind'), c('calmmind')] },
                   { p1: [c('helpinghand'), c('irondefense')], p2: [c('charm', 0), c('calmmind')] },
                   { p1: [c('bellydrum'), c('bulkup')], p2: [c('tailwind'), c('calmmind')] }],
          fixture: x => [[n(x, /^\|-setboost\|p1a: Azumarill\|atk\|6/) === 2, 'at +4 the authority lets Belly Drum succeed again']] },
      ];
    })() },

  { id: 'rewire-switch', knob: 'MEDI_STAT_REWIRE_SURVIVES_SWITCH', arm: 'top-tie-first',
    counter: 'statRewireUndoneOnSwitch', order: true,
    arms: (() => {
      const A = [S('Sylveon', 'Pixilate', '', ['Calm Mind', 'Protect']), CORV, MIL, PEX];
      const B = [S('Alakazam', 'Inner Focus', '', ['Speed Swap', 'Calm Mind']), CHOMP, CLEF, S('Toxapex', 'Regenerator', '', ['Protect', 'Recover'])];
      const script = sw => [
        { p1: [c('calmmind'), c('bulkup')], p2: [c('speedswap', 0), c('swordsdance')] },
        { p1: [sw ? { sw: 'milotic' } : c('calmmind'), c('irondefense')], p2: [c('calmmind'), c('swordsdance')] },
        { p1: [sw ? { sw: 'sylveon' } : c('calmmind'), c('bulkup')], p2: [c('calmmind'), c('swordsdance')] },
        { p1: [c('calmmind'), c('irondefense')], p2: [c('calmmind'), c('swordsdance')] }];
      const firstOf = (x, t) => { const blk = x.sdTurns[t] || []; return blk.findIndex(a => /garchomp/.test(a)) < blk.findIndex(a => /sylveon/.test(a)); };
      return [
        { id: 'SWITCHED', kind: 'red', A, B, script: script(true),
          fixture: x => [[firstOf(x, 3), 'after a bench trip the authority\'s Sylveon is SLOW again (Garchomp moves first on turn 4)']] },
        { id: 'STAYED-CONTROL', kind: 'ctl', A, B, script: script(false),
          fixture: x => [[!firstOf(x, 3), 'a Sylveon that never left keeps the swapped Speed (moves before Garchomp on turn 4)']] },
      ];
    })() },

  { id: 'half-hp-floor', knob: 'MEDI_HALF_HP_NO_FLOOR', arm: 'bottom-tie-first',
    counter: 'halfHpFlooredToOne',
    arms: (() => {
      const A = [S('Scrafty', 'Shed Skin', '', ['Super Fang', 'Bulk Up']), S('Garchomp', 'Rough Skin', '', ['Dragon Claw', 'Swords Dance']), MIL, PEX];
      const B = [S('Alakazam', 'Inner Focus', 'Focus Sash', ['Calm Mind', 'Speed Swap'], 0.1), CORV, CLEF, SYLV];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'ONE-HP', kind: 'red', A, B, script: [{ p1: [c('superfang', 0), c('dragonclaw', 0)], p2: [c('calmmind'), c('bulkup')] }],
          fixture: x => [[n(x, /^\|-enditem\|p2a: Alakazam\|Focus Sash/) === 1, 'the Sash left Alakazam on 1 HP'],
                         [n(x, /^\|faint\|p2a: Alakazam/) === 1, 'and the authority\'s Super Fang took the last point']] },
        { id: 'FULL-HP-CONTROL', kind: 'ctl', A, B, script: [{ p1: [c('superfang', 0), c('swordsdance')], p2: [c('calmmind'), c('bulkup')] }],
          fixture: x => [[n(x, /^\|faint\|p2a: Alakazam/) === 0, 'from full HP Super Fang halves and nothing faints']] },
      ];
    })() },

  { id: 'knockoff-chain', knob: 'MEDI_KNOCKOFF_FLOORED_ALONE', arm: 'top-tie-first',
    counter: 'itemMultInBpChain', counterCtlAny: true,
    arms: (() => {
      /* Scrafty Swords Dances first: one point of base power only survives the `/50` floor for certain
       * when Attack/Defence is above ~2.3, and at +0 against this target it rounded away (measured). */
      const A = [S('Scrafty', 'Shed Skin', '', ['Knock Off', 'Swords Dance']), S('Farigiraf', 'Armor Tail', '', ['Helping Hand', 'Calm Mind']), MIL, PEX];
      /* THE POOL CARD'S KOMMO-O CANNOT CARRY THIS ON THIS STAT LINE: base power 145 against 146 is a 0.7%
       * gap and a resisted hit rounds it away (measured: identical boards on the pre-fix engine). The
       * target is a SUPER-EFFECTIVE, low-Defence body with its pool tripled, so the hit is large enough
       * for one point of base power to survive every later floor and nothing faints. */
      /* x10 and not x3: at +2 a super-effective STAB Knock Off KNOCKED OUT the x3 body in both engines,
       * and a fainted body's HP cannot show a one-point gap (measured: identical boards on the pre-fix
       * engine, which reads 145 where the authority reads 146). */
      const B = item => [S('Alakazam', 'Inner Focus', item, ['Calm Mind', 'Speed Swap'], 10), CORV, CLEF, SYLV];
      const script = hh => [{ p1: [c('swordsdance'), c('calmmind')], p2: [c('calmmind'), c('bulkup')] },
                            { p1: [c('knockoff', 0), hh ? c('helpinghand') : c('calmmind')], p2: [c('calmmind'), c('irondefense')] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'HELPED', kind: 'red', A, B: B('Sitrus Berry'), script: script(true),
          fixture: x => [[n(x, /^\|-singleturn\|p1a: Scrafty\|Helping Hand/) === 1, 'Helping Hand landed on Scrafty'],
                         [n(x, /^\|-enditem\|p2a: Alakazam\|Sitrus Berry\|\[from\] move: Knock Off/) === 1, 'and the Knock Off found an item to take']] },
        { id: 'UNHELPED-CONTROL', kind: 'ctl', A, B: B('Sitrus Berry'), script: script(false), fixture: () => [] },
        { id: 'ITEMLESS-CONTROL', kind: 'ctl', A, B: B(''), script: script(true), fixture: () => [] },
      ];
    })() },

  { id: 'volley-user-faint', knob: 'MEDI_VOLLEY_IGNORES_USER_FAINT', arm: 'bottom-tie-first',
    counter: 'volleyStoppedUserFainted',
    arms: (() => {
      const A = [S('Talonflame', 'Flame Body', '', ['Dual Wingbeat', 'Swords Dance']), S('Whimsicott', 'Prankster', '', ['Endeavor', 'Tailwind'], 0.05), MIL, PEX];
      const B = [S('Garchomp', 'Rough Skin', '', ['Swords Dance', 'Protect'], 3), CORV, CLEF, SYLV];
      const script = end => [
        { p1: [c('swordsdance'), end ? { m: 'endeavor', ally: true } : c('tailwind')], p2: [c('swordsdance'), c('bulkup')] },
        { p1: [c('dualwingbeat', 0), c('tailwind')], p2: [c('swordsdance'), c('irondefense')] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'ROUGH-SKIN-KO', kind: 'red', A, B, script: script(true),
          fixture: x => [[n(x, /^\|faint\|p1a: Talonflame/) === 1, 'the authority\'s Talonflame fainted to Rough Skin'],
                         [n(x, /^\|-hitcount\|p2a: Garchomp\|1/) === 1, 'and its volley STOPPED at one hit']] },
        { id: 'FULL-HP-CONTROL', kind: 'ctl', A, B, script: script(false),
          fixture: x => [[n(x, /^\|-hitcount\|p2a: Garchomp\|2/) === 1, 'at full HP the volley lands both hits']] },
      ];
    })() },

  /* ---- BATCH 2 + 3 (2026-09-11). Batch 2's three clock cards are DECLARED, not staged here — the
   * authority spends exactly ONE more residual handler after a battle-ending perish expiry (traced);
   * see docs/_reports/2026-09-11-corner-mechanisms.md. */
  { id: 'stockpile-no-foe', knob: 'MEDI_LAYER_REFUND_IGNORES_NO_FOE', arm: 'bottom-tie-first',
    counter: 'layerRefundRefusedNoFoe',
    arms: (() => {
      const A = [S('Camerupt', 'Solid Rock', '', ['Stockpile', 'Spit Up']), S('Charizard', 'Blaze', '', ['Heat Wave', 'Flamethrower', 'Protect']), MIL, CORV];
      const tiny = sp => S(sp.species, sp.ability, sp.item, sp.moves, 0.05);
      const B = [tiny(CLEF), tiny(SYLV), tiny(PEX), tiny(CHOMP)];
      const script = last => [
        { p1: [c('stockpile'), c('heatwave')], p2: [c('calmmind'), c('calmmind')] },
        { p1: [c('spitup', 1), last ? c('flamethrower', 0) : c('protect')], p2: [c('recover'), c('swordsdance')] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'LAST-FOE', kind: 'red', A, B, script: script(true),
          fixture: x => [[n(x, /^\|faint\|p2[ab]: /) === 4, 'the authority\'s p2 was wiped, the last body to Spit Up'],
                         [n(x, /^\|-end\|p1a: Camerupt\|Stockpile/) === 1, 'the stack ended'],
                         [n(x, /^\|-unboost\|p1a: Camerupt/) === 0, 'and the refund was REFUSED — no foe left to boost against']] },
        { id: 'FOE-STANDING-CONTROL', kind: 'ctl', A, B, script: script(false),
          fixture: x => [[n(x, /^\|-unboost\|p1a: Camerupt\|def\|1/) === 1, 'with a foe standing the authority refunds the Defence it granted']] },
      ];
    })() },

  { id: 'reflect-type', knob: 'MEDI_REFLECT_TYPE_UNMODELLED', arm: 'top-tie-first',
    counter: 'typeCopiedToUser',
    arms: (() => {
      const A = [S('Gengar', 'Cursed Body', '', ['Reflect Type', 'Nasty Plot']), CORV, MIL, PEX];
      const B = [S('Sneasler', 'Pressure', '', ['Close Combat', 'Swords Dance']), CHOMP, CLEF, SYLV];
      const script = copy => [
        { p1: [copy ? c('reflecttype', 0) : c('nastyplot'), c('bulkup')], p2: [c('swordsdance'), c('swordsdance')] },
        { p1: [c('nastyplot'), c('irondefense')], p2: [c('closecombat', 0), c('protect')] }];
      const n = (x, re) => x.sd.filter(l => re.test(l)).length;
      return [
        { id: 'COPIED', kind: 'red', A, B, script: script(true),
          fixture: x => [[n(x, /^\|-start\|p1a: Gengar\|typechange\|\[from\] move: Reflect Type\|\[of\] p2a: Sneasler/) === 1, 'the authority copied Sneasler\'s typing onto Gengar'],
                         [n(x, /^\|-damage\|p1a: Gengar/) >= 1, 'and the next Close Combat CONNECTED on the no-longer-Ghost body']] },
        { id: 'UNCOPIED-CONTROL', kind: 'ctl', A, B, script: script(false),
          fixture: x => [[n(x, /^\|-immune\|p1a: Gengar/) === 1, 'without the copy Gengar is still a Ghost and Close Combat is immune']] },
      ];
    })() },
];

/* ==================================================================================================
 * 0. LEGALITY — every body, ability, item and move asked of the format and the validator
 * ============================================================================================== */
const RUN = MECHS.filter(m => !ONLY || m.id === ONLY);
if (!RUN.length) { console.log('NOT RUN — no mechanism named ' + ONLY); process.exit(2); }
console.log(NL + 'tests/probe_corner_mechanisms.js — ' + RUN.length + ' mechanism(s), release ' + RELEASE
  + (CHILD ? '   [KNOB CHILD: ' + RUN.map(m => m.knob + '=' + (process.env[m.knob] || '0')).join(' ') + ']' : ''));
let illegal = 0;
const seen = new Set();
for (const m of RUN) for (const a of m.arms) for (const r of a.A.concat(a.B)) {
  const k = JSON.stringify(r); if (seen.has(k)) continue; seen.add(k);
  const sp = D.species.get(r.species);
  if (!legal(sp)) { console.log('  ILLEGAL  ' + r.species); illegal++; continue; }
  if (r.item && !legal(D.items.get(r.item))) { console.log('  ILLEGAL  item ' + r.item); illegal++; }
  if (!Object.values(sp.abilities).map(x => D.abilities.get(x).id).includes(D.abilities.get(r.ability).id)) {
    console.log('  ILLEGAL  ' + sp.name + ' does not have ' + r.ability); illegal++; }
  for (const mv of r.moves) if (!legal(D.moves.get(mv)) || !CS.canLearn(sp.name, mv)) { console.log('  ILLEGAL  ' + sp.name + ' / ' + mv); illegal++; }
}
if (illegal) { console.log('NOT RUN — ' + illegal + ' illegal fixture row(s). This is not a pass.'); process.exit(2); }
console.log('  every fixture row is legal in the format and learnable by its body (' + seen.size + ' rows)');

/* ==================================================================================================
 * 1. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const turnsOf = arr => { const out = [[]]; for (const raw of arr.map(String)) {
  if (/^\|turn\|/.test(raw)) { out.push([]); continue; }
  if (/^\|move\|/.test(raw)) out[out.length - 1].push(raw.split('|')[2].toLowerCase().trim()); }
  /* the authority writes the NEXT turn's `|turn|` header before the game stops; an empty trailing block
   * is that header and not a turn */
  const t = out.slice(1); while (t.length && !t[t.length - 1].length) t.pop(); return t; };
/* lines after the leads' switch-in burst — a fixture about a MID-GAME switch must not count the leads */
const afterStart = x => { const i = x.sd.findIndex(l => /^\|turn\|/.test(l)); return i < 0 ? [] : x.sd.slice(i); };
function play(mech, arm) {
  const a = G.buildPair(arm.A.map(r => ({ species: r.species, item: r.item, ability: r.ability, moves: r.moves })));
  const b = G.buildPair(arm.B.map(r => ({ species: r.species, item: r.item, ability: r.ability, moves: r.moves })));
  if (!a || !b || a.length !== arm.A.length || b.length !== arm.B.length) return { staged: false, why: 'buildPair dropped a body' };
  arm.A.forEach((r, i) => { if (r.hpx !== 1) a[i].spec.hpx = r.hpx; });
  arm.B.forEach((r, i) => { if (r.hpx !== 1) b[i].spec.hpx = r.hpx; });
  const ARM = G.ARM_BY_ID.get(mech.arm);
  if (!ARM) return { staged: false, why: 'no arm ' + mech.arm };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const k = mech.counter, k2 = mech.ctlCounter;
  const c0 = (M.MEDSEEN[k] || 0), c20 = k2 ? (M.MEDSEEN[k2] || 0) : 0;
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_corner_mechanisms :: ' + mech.id + '/' + arm.id, { script: arm.script, arm: ARM,
    onBoundary: (s, ti) => { boards.push({ turn: ti, compared: s.leaves_compared, diffs: (s.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      s.identical = true; s.diffs = []; } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== arm.script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + arm.script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const sdTurns = turnsOf(sd), meTurns = turnsOf(me);
  const orderSame = JSON.stringify(sdTurns) === JSON.stringify(meTurns);
  return { staged: true, sd, me, sdTurns, meTurns, orderSame,
    cnt: (M.MEDSEEN[k] || 0) - c0, cnt2: k2 ? (M.MEDSEEN[k2] || 0) - c20 : 0,
    boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
    boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.slice(0, 4).join(', ')).join(' | '),
    div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

for (const mech of RUN) {
  const knobOn = process.env[mech.knob] === '1';
  console.log(NL + '=== ' + mech.id + '   (' + mech.arm + ', knob ' + mech.knob + '=' + (knobOn ? '1' : '0') + ', counter ' + mech.counter + ')');
  for (const arm of mech.arms) {
    const x = play(mech, arm);
    if (!x.staged) { ok(false, mech.id + '/' + arm.id + ' — NOT STAGED: ' + x.why); continue; }
    const parted = x.boardDiffs > 0 || (mech.order && !x.orderSame);
    console.log('    ' + arm.id.padEnd(24) + ' boards ' + (x.boardDiffs ? x.boardDiffs + ' diff(s)  ' + x.boardDetail : 'identical')
      + (mech.order ? '   move order ' + (x.orderSame ? 'same' : 'DIFFERS  sd ' + JSON.stringify(x.sdTurns) + '  me ' + JSON.stringify(x.meTurns)) : '')
      + '   ' + mech.counter + ' +' + x.cnt + (mech.ctlCounter ? '  ' + mech.ctlCounter + ' +' + x.cnt2 : ''));
    if (x.div && parted) console.log('      first protocol divergence: ' + JSON.stringify(x.div));
    if (DUMP === mech.id + '/' + arm.id) {
      console.log('      ---- SHOWDOWN ----'); for (const l of x.sd) console.log('      ' + l);
      console.log('      ---- MEDICHAM2 ----'); for (const l of x.me) console.log('      ' + l);
    }
    for (const [cond, what] of arm.fixture(x)) ok(cond, mech.id + '/' + arm.id + ' — FIXTURE: ' + what);
    const mustMatch = arm.kind === 'ctl' || !knobOn;
    ok(mustMatch ? !parted : parted, mech.id + '/' + arm.id + ' — ' + (mustMatch ? 'medicham2 agrees with the authority at every boundary'
      : 'PARTS under the knob (the knob restores exactly this defect)'), x.boardDetail || (x.div ? JSON.stringify(x.div) : ''));
    if (!knobOn) {
      if (arm.kind === 'red') ok(x.cnt >= 1, mech.id + '/' + arm.id + ' — the fix ran (' + mech.counter + ' +' + x.cnt + ')');
      else if (!arm.counterAny && !mech.counterCtlAny) ok(x.cnt === 0, mech.id + '/' + arm.id + ' — the fix stayed silent on the control (' + mech.counter + ' +' + x.cnt + ')');
      if (arm.kind === 'ctl' && mech.ctlCounter) ok(x.cnt2 >= 1, mech.id + '/' + arm.id + ' — the control went through the new road (' + mech.ctlCounter + ' +' + x.cnt2 + ')');
    }
  }
}

/* ==================================================================================================
 * 2. ONE KNOB CHILD PER MECHANISM
 * ============================================================================================== */
if (!CHILD && !NO_KNOBS) {
  console.log(NL + '2. THE KNOB CHILDREN — each mechanism alone, under its own knob');
  for (const mech of RUN) {
    const env = Object.assign({}, process.env); env[mech.knob] = '1';
    const args = [__filename, '--release', RELEASE, '--only', mech.id, '--knob-child'].concat(LIVE ? ['--live-store'] : []);
    const ch = spawnSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
    const out = String(ch.stdout || '') + String(ch.stderr || '');
    const reds = out.split('\n').filter(l => /^\s+RED\s/.test(l));
    for (const l of reds) console.log('    child ' + mech.id + l);
    ok(ch.status === 0, mech.id + ' — under ' + mech.knob + '=1 every red arm PARTS and every control HOLDS',
       'child exit ' + ch.status + (ch.error ? ' (' + ch.error.message + ')' : ''));
  }
}
console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
