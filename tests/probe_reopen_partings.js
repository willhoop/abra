/* probe_reopen_partings.js — THE EIGHT PARTINGS THE STAGING PLANNER FOUND ON 2026-09-11, ONE STAGED
 * MECHANISM EACH, BOTH ENGINES, EACH WITH ITS OWN KNOB. ROADMAP #593-#600.
 *
 *   SHOWDOWN_PATH=... node tests/probe_reopen_partings.js [--release <id>] [--only <mech>] [--no-knobs]
 *                                                          [--dump <mech>/<arm>] [--batch board|narration]
 *
 * With no `--release` the LIVE tree is frozen into a scratch store (tests/_live_release.js), so this can
 * gate an edit without writing to data/releases. `--release aefcb93baf14` is the pre-fix engine; this
 * file was run RED on the live tree before any of the eight fixes landed.
 *
 * ================= WHAT IT IS =====================================================================
 *
 * The planner (engine/stage_planner.js, wired into engine/all_mechanics_fire.js) staged fixtures the old
 * ladder never reached and the gate closed on what they showed. This file stages each mechanism ALONE,
 * with a control on the SAME bodies that must NOT part, and plays both engines under the corner pin the
 * planner used. Showdown is the expectation. Nothing here types a damage number, a stat, a line or a
 * status — every expectation is the authority's own stream or board.
 *
 * TWO KINDS OF MECHANISM, because the eight are two kinds of defect:
 *   board      #593-#596. The boards part. `parted` is any board leaf differing at any boundary, OR the
 *              mechanism's own announcement lines differing (so a fix that lands the board and forgets
 *              the line is still red).
 *   narration  #597-#600. The boards already agree; the protocol does not. `parted` is the multiset of
 *              the mechanism's lines, normalised the way engine/game_differential.js normalises them —
 *              case and spaces folded, `[silent]`/`[still]` dropped as rendering hints, `[of]` dropped
 *              under the differ's own `source-tag` rule — differing between the two streams.
 *
 * Each mechanism carries RED arms (agree clean, PART under the knob), CONTROLS (agree in both knob
 * positions — the over-fire guard), a FIXTURE read off the AUTHORITY's own stream (so an arm that never
 * staged its mechanism fails by name), and a COUNTER the fix increments (non-zero on a red arm, zero on
 * a control unless the control is declared to go through the same road).
 *
 * The parent runs every arm clean, then spawns ONE CHILD PER MECHANISM with only that knob set.
 *
 * ================= WHAT IT CANNOT SEE =============================================================
 *
 * Oblivious against Attract and Captivate (no body in the format that learns Attract was found for the
 * staged pair, derived with `champions_sim.canLearn`); an ability ACQUIRED onto a Taunted body, which is
 * Oblivious's `onUpdate` half; Magic Bounce on a move other than Spite; a crit-stage volatile COPIED by
 * Psych Up or Transform (the copy re-derives the Dragon half on the copier — not staged); a mega under
 * Magic Room; Flower Veil and Aroma Veil's CONDITIONAL `-block` lines (derived and routed, not staged).
 */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const NL = '\n';
require(path.join(ROOT, 'engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('REOPEN PARTINGS');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. This is not a pass.');
  console.log('ABRA-EXIT 2 CANNOT-ANSWER');
  process.exit(2);
}
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
/* BEFORE THE DRIVER, NEVER AFTER — game_differential.js CUTS a release at require time when --release is
 * absent, and a bare run would write that cut into the real store. */
const LIVE = !process.argv.includes('--release') || process.argv.includes('--live-store');
if (LIVE) require(path.join(ROOT, 'tests', '_live_release.js'));
if (!process.argv.includes('--release')) {
  const ER = require(path.join(ROOT, 'engine', 'engine_release.js'));
  process.argv.push('--release', ER.cut('tests/probe_reopen_partings.js — freeze the tree under test').id);
}
const RELEASE = argOf('--release', null);
const ONLY = argOf('--only', null);
const BATCH = argOf('--batch', null);
const CHILD = process.argv.includes('--knob-child');
const NO_KNOBS = process.argv.includes('--no-knobs');
const DUMP = argOf('--dump', null);

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
const S = (species, ability, item, moves, hpx, gender) => ({ species, ability, item: item || '', moves, hpx: hpx || 1, gender: gender || '' });
const c = (m, t) => (t == null ? { m } : { m, t });
const CORV = S('Corviknight', 'Pressure', '', ['Protect', 'Bulk Up'], 6);
const MIL = S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 6);
/* FIXTURES READ THE AUTHORITY'S RAW LOG, NOT `sdStream`. `sdStream` keeps only the events medicham2 CLAIMS
 * (engine/game_differential.js), so an event this engine does not emit yet — `-block` — is invisible to a
 * fixture that reads it, and the first run of this file reported Sweet Veil's own block as never staged. */
const n = (x, re) => x.raw.filter(l => re.test(l)).length;

const MECHS = [
  /* #593 — Oblivious's `onTryHit` names three move ids and answers `-immune … [from] ability: Oblivious`
   * (data/abilities.ts, oblivious; Champions overrides it nowhere). */
  { id: 'oblivious-taunt', row: 593, batch: 'board', knob: 'MEDI_OBLIVIOUS_MOVEID_BLIND', stamp: 'obliviousMoveIdBlindRestored', arm: 'bottom-tie-first',
    counter: 'tryHitRefusedByMoveId', lines: /^\|-(immune|start|fail)\|/,
    arms: (() => {
      const B = [S('Gyarados', 'Intimidate', '', ['Taunt', 'Protect'], 6), MIL];
      const script = [{ p1: [c('sleeptalk'), c('protect')], p2: [c('taunt', 0), c('protect')] }];
      return [
        { id: 'TAUNT', kind: 'red', A: [S('Mamoswine', 'Oblivious', '', ['Sleep Talk', 'Protect'], 6), CORV], B, script,
          fixture: x => [[n(x, /^\|-immune\|p1a: Mamoswine\|\[from\] ability: Oblivious/) === 1, 'the authority refused the Taunt with `-immune … [from] ability: Oblivious`']] },
        { id: 'TAUNT-CONTROL', kind: 'ctl', A: [S('Mamoswine', 'Thick Fat', '', ['Sleep Talk', 'Protect'], 6), CORV], B, script,
          fixture: x => [[n(x, /^\|-start\|p1a: Mamoswine\|move: Taunt/) === 1, 'with no Oblivious the Taunt lands in the authority']] },
      ];
    })() },

  /* #594 — Magic Bounce's `onTryHit` re-uses a `reflectable` move at its source; Spite carries the flag. */
  { id: 'bounce-spite', row: 594, batch: 'board', knob: 'MEDI_SPITE_IGNORES_BOUNCE', stamp: 'spiteIgnoresBounceRestored', arm: 'bottom-tie-first',
    counter: 'spiteBounced', lines: /^\|(move|-activate)\|/,
    arms: (() => {
      const B = [S('Feraligatr', 'Sheer Force', '', ['Spite', 'Protect'], 6), MIL];
      const script = [{ p1: [c('sleeptalk'), c('protect')], p2: [c('spite', 0), c('protect')] }];
      return [
        { id: 'SPITE', kind: 'red', A: [S('Espeon', 'Magic Bounce', '', ['Sleep Talk', 'Protect'], 6), CORV], B, script,
          fixture: x => [[n(x, /^\|move\|p1a: Espeon\|Spite\|.*\[from\] ability: Magic Bounce/) === 1, 'the authority bounced the Spite back at Feraligatr']] },
        { id: 'SPITE-CONTROL', kind: 'ctl', A: [S('Espeon', 'Synchronize', '', ['Sleep Talk', 'Protect'], 6), CORV], B, script,
          fixture: x => [[n(x, /^\|-activate\|p1a: Espeon\|move: Spite/) === 1, 'with no Magic Bounce the Spite lands on Espeon in the authority']] },
      ];
    })() },

  /* #595 — every ModifyCritRatio handler ADDS to one ratio (sim/battle-actions.ts: `runEvent('ModifyCritRatio',
   * …, move.critRatio || 0)`, clamped to 4, `critMult = [0, 24, 8, 2, 1]`). Focus Energy's condition adds 2,
   * Dragon Cheer's adds 2 on a body that was Dragon when it started and 1 otherwise. Under the TOP corner
   * only a CERTAIN crit (ratio 4) shows, so the reds reach 4 and the controls stop at 3 or below. */
  { id: 'crit-stage', row: 595, batch: 'board', knob: 'MEDI_CRIT_VOLATILE_STAGE_UNREAD', stamp: 'critVolatileStageUnreadRestored', arm: 'top-tie-first',
    counter: 'critStageFromVolatile', lines: /^\|-crit\|/,
    arms: (() => {
      const B = [S('Feraligatr', 'Torrent', '', ['Sleep Talk', 'Protect'], 6), S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 6)];
      const fe = (first) => [{ p1: [c(first), c('protect')], p2: [c('protect'), c('protect')] },
                             { p1: [c('xscissor', 0), c('bulkup')], p2: [c('sleeptalk'), c('recover')] }];
      const cheer = (mv) => [{ p1: [c('sleeptalk'), c('dragoncheer')], p2: [c('protect'), c('protect')] },
                             { p1: [c(mv, 0), c('protect')], p2: [c('sleeptalk'), c('recover')] }];
      const ABS = (ab, item) => S('Absol', ab, item, ['Focus Energy', 'X-Scissor', 'Sleep Talk'], 1);
      const P = S('Corviknight', 'Pressure', '', ['Protect', 'Bulk Up'], 6);
      const NITE = S('Dragonite', 'Inner Focus', '', ['Dragon Cheer', 'Protect'], 6);
      const crit = (x) => n(x, /^\|-crit\|p2a: Feraligatr/);
      return [
        { id: 'SUPERLUCK-FE', kind: 'red', A: [ABS('Super Luck', ''), P], B, script: fe('focusenergy'),
          fixture: x => [[crit(x) === 1, 'Super Luck + Focus Energy crit in the authority at the top corner']] },
        { id: 'SCOPELENS-FE', kind: 'red', A: [ABS('Justified', 'Scope Lens'), P], B, script: fe('focusenergy'),
          fixture: x => [[crit(x) === 1, 'Scope Lens + Focus Energy crit in the authority at the top corner']] },
        { id: 'CHEER-DRAGON', kind: 'red', A: [S('Garchomp', 'Rough Skin', 'Scope Lens', ['Dragon Claw', 'Sleep Talk', 'Protect'], 1), NITE], B, script: cheer('dragonclaw'),
          fixture: x => [[crit(x) === 1, 'a Dragon-type Scope Lens holder under Dragon Cheer crits in the authority']] },
        { id: 'FE-ALONE', kind: 'ctl', counterAny: true, A: [ABS('Justified', ''), P], B, script: fe('focusenergy'),
          fixture: x => [[crit(x) === 0, 'Focus Energy alone does NOT crit at the top corner in the authority (ratio 3)']] },
        { id: 'LUCK-ALONE', kind: 'ctl', A: [ABS('Super Luck', ''), P], B, script: fe('sleeptalk'),
          fixture: x => [[crit(x) === 0, 'Super Luck alone does NOT crit at the top corner in the authority (ratio 2)']] },
        { id: 'CHEER-NONDRAGON', kind: 'ctl', counterAny: true, A: [S('Absol', 'Justified', 'Scope Lens', ['X-Scissor', 'Sleep Talk', 'Protect'], 1), NITE], B, script: cheer('xscissor'),
          fixture: x => [[crit(x) === 0, 'a NON-Dragon Scope Lens holder under Dragon Cheer does NOT crit (ratio 3) in the authority']] },
      ];
    })() },

  /* #596 — Champions' `canMegaEvo` reads `pokemon.getItem()` (data/mods/champions/scripts.ts:183), which is
   * the raw slot (sim/pokemon.ts `getItem`), not `ignoringItem()`. Klutz hides the item from every item
   * EVENT; it does not hide it from the mega check. */
  { id: 'klutz-mega', row: 596, batch: 'board', knob: 'MEDI_MEGA_REFUSED_UNDER_SUPPRESSION', stamp: 'megaRefusedUnderSuppressionRestored', arm: 'bottom-tie-first',
    counter: 'megaThroughSuppressedItem', lines: /^\|-mega\|/,
    arms: (() => {
      const B = [S('Feraligatr', 'Torrent', '', ['Waterfall', 'Protect'], 1), S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 1)];
      const P = S('Corviknight', 'Pressure', '', ['Protect', 'Bulk Up'], 1);
      const mega = (mv, ask) => [{ p1: [ask ? { m: mv, mega: true, t: 0 } : c(mv, 0), c('protect')], p2: [c('waterfall', 0), c('protect')] }];
      return [
        { id: 'AUDINO-KLUTZ', kind: 'red', A: [S('Audino', 'Klutz', 'Audinite', ['Mega Kick', 'Protect']), P], B, script: mega('megakick', true),
          fixture: x => [[n(x, /^\|-mega\|p1a: Audino/) === 1, 'the authority mega-evolved the Klutz Audino']] },
        { id: 'GOLURK-KLUTZ', kind: 'red', A: [S('Golurk', 'Klutz', 'Golurkite', ['High Horsepower', 'Protect']), P], B, script: mega('highhorsepower', true),
          fixture: x => [[n(x, /^\|-mega\|p1a: Golurk/) === 1, 'the authority mega-evolved the Klutz Golurk']] },
        { id: 'AUDINO-HEALER', kind: 'ctl', A: [S('Audino', 'Regenerator', 'Audinite', ['Mega Kick', 'Protect']), P], B, script: mega('megakick', true),
          fixture: x => [[n(x, /^\|-mega\|p1a: Audino/) === 1, 'with no Klutz the authority mega-evolves too']] },
        { id: 'KLUTZ-NO-ASK', kind: 'ctl', A: [S('Audino', 'Klutz', 'Audinite', ['Mega Kick', 'Protect']), P], B, script: mega('megakick', false),
          fixture: x => [[n(x, /^\|-mega\|/) === 0, 'with no mega asked, nothing evolves in the authority']] },
      ];
    })() },

  /* #597 — the attract condition's `onStart` writes `[from] ability: Cute Charm` when its effect is the
   * ability (data/conditions.ts, attract). Both genders are declared through buildPair's opt-in seam. */
  { id: 'cutecharm-line', row: 597, batch: 'narration', knob: 'MEDI_CUTECHARM_UNATTRIBUTED', stamp: 'cuteCharmUnattributedRestored', arm: 'bottom-tie-first',
    counter: 'attractFromAbilityAnnounced', lines: /^\|-start\|.*\|attract/i,
    arms: (() => {
      const B = [S('Feraligatr', 'Torrent', '', ['Brutal Swing', 'Protect'], 6, 'F'), S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 6, 'F')];
      const script = [{ p1: [c('sleeptalk'), c('protect')], p2: [c('brutalswing', 0), c('protect')] }];
      const P = S('Corviknight', 'Pressure', '', ['Protect', 'Bulk Up'], 6, 'M');
      return [
        { id: 'CUTECHARM', kind: 'red', A: [S('Clefable', 'Cute Charm', '', ['Sleep Talk', 'Protect'], 6, 'M'), P], B, script,
          fixture: x => [[n(x, /^\|-start\|p2a: Feraligatr\|Attract\|\[from\] ability: Cute Charm/) === 1, 'the authority infatuated Feraligatr through Cute Charm']] },
        { id: 'MAGICGUARD', kind: 'ctl', A: [S('Clefable', 'Magic Guard', '', ['Sleep Talk', 'Protect'], 6, 'M'), P], B, script,
          fixture: x => [[n(x, /Attract/) === 0, 'with no Cute Charm nothing is infatuated in the authority']] },
      ];
    })() },

  /* #598 — Own Tempo's `onHit` writes `-immune … confusion … [from] ability: Own Tempo` when the MOVE's own
   * `volatileStatus` is confusion (data/abilities.ts, owntempo). */
  { id: 'owntempo-line', row: 598, batch: 'narration', knob: 'MEDI_OWNTEMPO_SILENT', stamp: 'ownTempoSilentRestored', arm: 'bottom-tie-first',
    counter: 'confusionRefusalAnnounced', lines: /^\|-(immune|start)\|/,
    arms: (() => {
      const B = [S('Gyarados', 'Moxie', '', ['Swagger', 'Protect'], 6), S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 6)];
      const script = [{ p1: [c('sleeptalk'), c('protect')], p2: [c('swagger', 0), c('protect')] }];
      const P = S('Corviknight', 'Pressure', '', ['Protect', 'Bulk Up'], 6);
      return [
        { id: 'OWNTEMPO', kind: 'red', A: [S('Avalugg', 'Own Tempo', '', ['Sleep Talk', 'Protect'], 6), P], B, script,
          fixture: x => [[n(x, /^\|-immune\|p1a: Avalugg\|confusion\|\[from\] ability: Own Tempo/) === 1, 'the authority announced the refusal']] },
        { id: 'STURDY', kind: 'ctl', A: [S('Avalugg', 'Sturdy', '', ['Sleep Talk', 'Protect'], 6), P], B, script,
          fixture: x => [[n(x, /^\|-start\|p1a: Avalugg\|confusion/) === 1, 'with no Own Tempo the confusion lands in the authority']] },
      ];
    })() },

  /* #599 — Sweet Veil's `onAllySetStatus` writes `-block|<target>|ability: Sweet Veil|[of] <holder>` and
   * returns null, so no `-fail` follows (data/abilities.ts, sweetveil). */
  { id: 'sweetveil-line', row: 599, batch: 'narration', knob: 'MEDI_VEIL_BLOCK_UNANNOUNCED', stamp: 'veilBlockUnannouncedRestored', arm: 'bottom-tie-first',
    counter: 'veilBlockAnnounced', lines: /^\|-(block|fail|status)\|/,
    arms: (() => {
      const B = [S('Altaria', 'Natural Cure', '', ['Sing', 'Protect'], 6), S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 6)];
      const partner = S('Absol', 'Pressure', '', ['Sleep Talk', 'Protect'], 6);
      const atPartner = [{ p1: [c('protect'), c('sleeptalk')], p2: [c('sing', 1), c('protect')] }];
      const atSelf = [{ p1: [c('sleeptalk'), c('protect')], p2: [c('sing', 0), c('protect')] }];
      return [
        { id: 'PARTNER', kind: 'red', A: [S('Alcremie', 'Sweet Veil', '', ['Protect', 'Sleep Talk'], 6), partner], B, script: atPartner,
          fixture: x => [[n(x, /^\|-block\|p1b: Absol\|ability: Sweet Veil/) === 1, 'the authority blocked the Sing aimed at the partner']] },
        { id: 'SELF', kind: 'red', A: [S('Alcremie', 'Sweet Veil', '', ['Protect', 'Sleep Talk'], 6), partner], B, script: atSelf,
          fixture: x => [[n(x, /^\|-block\|p1a: Alcremie\|ability: Sweet Veil/) === 1, 'the authority blocked the Sing aimed at the holder itself']] },
        { id: 'AROMAVEIL', kind: 'ctl', A: [S('Alcremie', 'Aroma Veil', '', ['Protect', 'Sleep Talk'], 6), partner], B, script: atPartner,
          fixture: x => [[n(x, /^\|-status\|p1b: Absol\|slp/) === 1, 'with no Sweet Veil the partner falls asleep in the authority']] },
        /* FLOWER VEIL'S BOOST HALF (added 2026-09-11 after the batch-2 pool run parted on it): the lead's
         * Intimidate is refused for the GRASS ally, and the veil writes `-block … [of] <holder>`. The control
         * is the same pair against a lead with no Intimidate. */
        { id: 'FLOWERVEIL-INTIM', kind: 'red', A: [S('Florges', 'Flower Veil', '', ['Protect', 'Moonblast'], 6), S('Sinistcha', 'Hospitality', '', ['Protect', 'Matcha Gotcha'], 6)],
          B: [S('Gyarados', 'Intimidate', '', ['Protect', 'Waterfall'], 6), S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 6)],
          script: [{ p1: [c('protect'), c('protect')], p2: [c('protect'), c('protect')] }],
          fixture: x => [[n(x, /^\|-block\|p1b: Sinistcha\|ability: Flower Veil/) === 1, 'the authority blocked Intimidate for the Grass ally and said so']] },
        { id: 'FLOWERVEIL-NO-INTIM', kind: 'ctl', A: [S('Florges', 'Flower Veil', '', ['Protect', 'Moonblast'], 6), S('Sinistcha', 'Hospitality', '', ['Protect', 'Matcha Gotcha'], 6)],
          B: [S('Gyarados', 'Moxie', '', ['Protect', 'Waterfall'], 6), S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 6)],
          script: [{ p1: [c('protect'), c('protect')], p2: [c('protect'), c('protect')] }],
          fixture: x => [[n(x, /^\|-block\|/) === 0, 'with no Intimidate there is nothing to block']] },
      ];
    })() },

  /* #600 — Covet's `onAfterHit` writes ONLY `-item|<thief>|…|[from] move: Covet|[of] <victim>`; Thief's
   * writes a `[silent]` `-enditem` first (data/moves.ts covet / thief). */
  { id: 'covet-line', row: 600, batch: 'narration', knob: 'MEDI_COVET_ENDITEM_EXTRA', stamp: 'covetEnditemExtraRestored', arm: 'bottom-tie-first',
    counter: 'stealLossLineSilent', lines: /^\|-(item|enditem)\|/,
    arms: (() => {
      const B = [S('Feraligatr', 'Torrent', 'Muscle Band', ['Sleep Talk', 'Protect'], 6), S('Milotic', 'Marvel Scale', '', ['Protect', 'Recover'], 6)];
      const P = S('Corviknight', 'Pressure', '', ['Protect', 'Bulk Up'], 6);
      const script = (mv) => [{ p1: [c(mv, 0), c('protect')], p2: [c('sleeptalk'), c('protect')] }];
      return [
        { id: 'COVET', kind: 'red', A: [S('Snorlax', 'Thick Fat', '', ['Covet', 'Protect'], 6), P], B, script: script('covet'),
          fixture: x => [[n(x, /^\|-item\|p1a: Snorlax\|Muscle Band\|\[from\] move: Covet/) === 1, 'the authority moved the Muscle Band to Snorlax']] },
        { id: 'THIEF', kind: 'ctl', A: [S('Absol', 'Pressure', '', ['Thief', 'Protect'], 6), P], B, script: script('thief'),
          fixture: x => [[n(x, /^\|-enditem\|p2a: Feraligatr\|Muscle Band\|\[silent\]\|\[from\] move: Thief/) === 1, 'Thief writes its own (silent) loss line in the authority']] },
      ];
    })() },
];

/* ==================================================================================================
 * 0. LEGALITY
 * ============================================================================================== */
const RUN = MECHS.filter(m => (!ONLY || m.id === ONLY) && (!BATCH || m.batch === BATCH));
if (!RUN.length) { console.log('NOT RUN — no mechanism matches'); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); }
console.log(NL + 'tests/probe_reopen_partings.js — ' + RUN.length + ' mechanism(s), release ' + RELEASE
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
  if (r.gender && sp.gender && sp.gender !== r.gender) { console.log('  ILLEGAL  ' + sp.name + ' cannot be ' + r.gender); illegal++; }
  for (const mv of r.moves) if (!legal(D.moves.get(mv)) || !CS.canLearn(sp.name, mv)) { console.log('  ILLEGAL  ' + sp.name + ' / ' + mv); illegal++; }
}
if (illegal) { console.log('NOT RUN — ' + illegal + ' illegal fixture row(s). This is not a pass.'); console.log('ABRA-EXIT 2 CANNOT-ANSWER'); process.exit(2); }
console.log('  every fixture row is legal in the format and learnable by its body (' + seen.size + ' rows)');

/* ==================================================================================================
 * 1. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
/* The differ's own folding (engine/game_differential.js: `[silent]`/`[still]` are rendering hints, `[of]` is
 * the declared `source-tag` equivalence), plus case and whitespace, so a display name and an id agree. */
const norm = l => String(l).split('|').filter(f => !/^\[(silent|still)\]$/.test(f) && !/^\[of\]/.test(f))
  .join('|').toLowerCase().replace(/[\s_'’.]/g, '').replace(/([^|])-/g, '$1').replace(/\|+$/, '');
const bag = (arr, re) => arr.filter(l => re.test(l)).map(norm).sort();
const afterStart = arr => { const i = arr.findIndex(l => /^\|turn\|/.test(l)); return i < 0 ? [] : arr.slice(i); };
/* FOUR BODIES A SIDE, because `buildPair` returns null below its cap (engine/game_differential.js,
 * `if (picked.length < cap) { TEAMS_UNBUILDABLE++; return null; }`). The first run of this file staged two
 * a side and every arm read NOT STAGED — the instrument, not the engine. The two fillers sit on the bench
 * for the whole script, carry no item, and are the corner probe's already-validated bodies; a species the
 * side already fields is skipped (Species Clause). */
const FILL = [S('Toxapex', 'Regenerator', '', ['Protect', 'Recover']), S('Sylveon', 'Pixilate', '', ['Calm Mind', 'Protect']),
              S('Clefable', 'Magic Guard', '', ['Calm Mind', 'Protect']), S('Garchomp', 'Rough Skin', '', ['Swords Dance', 'Protect'])];
const pad = side => { const out = side.slice(); for (const f of FILL) { if (out.length >= 4) break;
  if (!out.some(r => r.species === f.species)) out.push(f); } return out; };
function play(mech, arm) {
  const rows = r => ({ species: r.species, item: r.item, ability: r.ability, moves: r.moves, gender: r.gender || undefined });
  const A = pad(arm.A), B = pad(arm.B);
  const gOpts = A.concat(B).some(r => r.gender) ? { declaredGender: true } : undefined;
  const a = G.buildPair(A.map(rows), gOpts);
  const b = G.buildPair(B.map(rows), gOpts);
  if (!a || !b || a.length !== A.length || b.length !== B.length) return { staged: false, why: 'buildPair dropped a body' };
  A.forEach((r, i) => { a[i].spec.hpx = r.hpx; });
  B.forEach((r, i) => { b[i].spec.hpx = r.hpx; });
  /* the ability buildPair actually installed — it falls back to the species' slot 0 on a name it cannot
   * match, and a fixture that silently lost its ability would agree about nothing */
  const lost = A.concat(B).map((r, i) => [r, (i < A.length ? a[i] : b[i - A.length])])
    .filter(([r, x]) => x.medi.ability !== D.abilities.get(r.ability).id).map(([r, x]) => r.species + ' ' + r.ability + '->' + x.medi.ability);
  if (lost.length) return { staged: false, why: 'buildPair replaced an ability: ' + lost.join(', ') };
  const ARM = G.ARM_BY_ID.get(mech.arm);
  if (!ARM) return { staged: false, why: 'no arm ' + mech.arm };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const k = mech.counter;
  const c0 = (M.MEDSEEN[k] || 0);
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_reopen_partings :: ' + mech.id + '/' + arm.id, { script: arm.script, arm: ARM,
    onBoundary: (s, ti) => { boards.push({ turn: ti, compared: s.leaves_compared, diffs: (s.diffs || []).map(d => d.path + ' ' + d.medicham + '/' + d.showdown) });
      s.identical = true; s.diffs = []; } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (SC.megaRefused) return { staged: false, why: SC.megaRefused + ' scripted mega ask(s) refused by the driver' };
  if (r.turns !== arm.script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + arm.script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const log = G.lastSdLog().map(String), raw = [];
  for (let i = 0; i < log.length; i++) { if (log[i] === '|split|p1' || log[i] === '|split|p2') { raw.push(log[i + 1]); i += 2; continue; } raw.push(log[i]); }
  /* THE WHOLE STREAM, NOT FROM `|turn|1`. The first form bagged lines after the first turn header, and an
   * ENTRY ability's narration sits before it: Flower Veil's `-block` against the lead's Intimidate was
   * invisible to the comparison, so its knob arm could not part (measured 2026-09-11, the dump showed the
   * authority's line and ours absent). No mechanism's line pattern matches a team-preview or switch line. */
  void afterStart;
  const sdBag = bag(sd, mech.lines), meBag = bag(me, mech.lines);
  return { staged: true, sd, raw, me, sdBag, meBag, linesSame: JSON.stringify(sdBag) === JSON.stringify(meBag),
    cnt: (M.MEDSEEN[k] || 0) - c0,
    boardDiffs: boards.reduce((q, x) => q + x.diffs.length, 0),
    boardDetail: boards.filter(x => x.diffs.length).map(x => 't' + x.turn + ': ' + x.diffs.slice(0, 4).join(', ')).join(' | ') };
}

for (const mech of RUN) {
  const knobOn = process.env[mech.knob] === '1';
  console.log(NL + '=== ' + mech.id + ' (#' + mech.row + ', ' + mech.batch + ', ' + mech.arm + ', knob ' + mech.knob + '=' + (knobOn ? '1' : '0') + ', counter ' + mech.counter + ')');
  for (const arm of mech.arms) {
    const x = play(mech, arm);
    if (!x.staged) { ok(false, mech.id + '/' + arm.id + ' — NOT STAGED: ' + x.why); continue; }
    const parted = x.boardDiffs > 0 || !x.linesSame;
    console.log('    ' + arm.id.padEnd(16) + ' boards ' + (x.boardDiffs ? x.boardDiffs + ' diff(s)  ' + x.boardDetail : 'identical')
      + '   lines ' + (x.linesSame ? 'same' : 'DIFFER') + '   ' + mech.counter + ' +' + x.cnt);
    if (!x.linesSame) { console.log('      showdown ' + JSON.stringify(x.sdBag)); console.log('      medicham ' + JSON.stringify(x.meBag)); }
    if (DUMP === mech.id + '/' + arm.id) {
      console.log('      ---- SHOWDOWN ----'); for (const l of x.sd) console.log('      ' + l);
      console.log('      ---- MEDICHAM2 ----'); for (const l of x.me) console.log('      ' + l);
    }
    for (const [cond, what] of arm.fixture(x)) ok(cond, mech.id + '/' + arm.id + ' — FIXTURE: ' + what);
    const mustMatch = arm.kind === 'ctl' || !knobOn;
    ok(mustMatch ? !parted : parted, mech.id + '/' + arm.id + ' — ' + (mustMatch ? 'medicham2 agrees with the authority (board and lines)'
      : 'PARTS under the knob (the knob restores exactly this defect)'), x.boardDetail || (x.linesSame ? '' : 'lines differ'));
    if (!knobOn) {
      if (arm.kind === 'red') ok(x.cnt >= 1, mech.id + '/' + arm.id + ' — the fix ran (' + mech.counter + ' +' + x.cnt + ')');
      else if (!arm.counterAny) ok(x.cnt === 0, mech.id + '/' + arm.id + ' — the fix stayed silent on the control (' + mech.counter + ' +' + x.cnt + ')');
    }
  }
}

/* ==================================================================================================
 * 2. ONE KNOB CHILD PER MECHANISM — and the knob must be STAMPED, or it reached no module at all
 * ============================================================================================== */
if (CHILD) {
  const want = RUN.map(m => m.stamp);
  ok(want.every(f => M.MEDFAILS[f]), 'the knob child loaded an engine that stamped its receipt (' + want.map(f => f + '=' + (M.MEDFAILS[f] || 0)).join(', ') + ')');
}
if (!CHILD && !NO_KNOBS) {
  console.log(NL + '2. THE KNOB CHILDREN — each mechanism alone, under its own knob');
  for (const mech of RUN) {
    const env = Object.assign({}, process.env); env[mech.knob] = '1';
    const args = [__filename, '--release', RELEASE, '--only', mech.id, '--knob-child'].concat(LIVE ? ['--live-store'] : []);
    const ch = spawnSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
    const out = String(ch.stdout || '') + String(ch.stderr || '');
    for (const l of out.split('\n').filter(q => /^\s+RED\s/.test(q))) console.log('    child ' + mech.id + l);
    ok(ch.status === 0, mech.id + ' — under ' + mech.knob + '=1 every red arm PARTS and every control HOLDS',
       'child exit ' + ch.status + (ch.error ? ' (' + ch.error.message + ')' : ''));
  }
}
console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
console.log(bad ? 'ABRA-EXIT 1 VERDICT-RED' : 'ABRA-EXIT 0 VERDICT-GREEN');
process.exit(bad ? 1 : 0);
