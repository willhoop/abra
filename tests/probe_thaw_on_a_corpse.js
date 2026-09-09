#!/usr/bin/env node
/* tests/probe_thaw_on_a_corpse.js — NARRATION BATCH R, CLUSTER 2
 * ==================================================================================================
 * A BODY THAT DIES TO THE HIT IS NOT THAWED BY IT, AND NOTHING IS ANNOUNCED.
 *
 * THE AUTHORITY, ONE LINE, RE-READ THIS RUN (§0 asserts it rather than quoting it):
 *
 *     cureStatus(silent = false) {
 *       if (!this.hp || !this.status) return false;                     sim/pokemon.ts:1680-1681
 *       this.battle.add('-curestatus', this, this.status, silent ? '[silent]' : '[msg]');
 *
 * BOTH thaw routes go through it, and both are handlers on the `frz` CONDITION:
 *     `onAfterMoveSecondary(target, source, move) { if (move.thawsTarget) target.cureStatus(); }`
 *     `onDamagingHit(damage, target, source, move) { if (move.type === 'Fire' && ...) target.cureStatus(); }`
 *                                                                       data/conditions.ts:112-121
 * Champions overrides `frz`'s `onStart` and `onBeforeMove` and NOTHING else, so mainline is the
 * authority for the two thaw handlers — asserted in §0.
 *
 * So a frozen body killed by a Fire move or by a `thawsTarget` move is at 0 HP by the time the
 * handler runs, `cureStatus` refuses, and the log carries no cure line at all.
 *
 * WHAT THIS ENGINE DID. `_thawCure` re-read the STATUS ("a body that fainted to this hit carries
 * 'fnt'" — its own comment) and never the HP, and this engine does not write 'fnt' into `status`. So
 * every frozen body killed by its own thawing hit announced a cure the authority does not write:
 *
 *     showdown   |faint|p2a: Scizor
 *     medicham2  |-curestatus|p2a: Scizor|frz|[msg]        <-- invented
 *                |faint|p2a: Scizor
 *
 * THREE NARRATION-ONLY CAUSES on release `0c5a4da9c512`, one per route-and-slot:
 *     `|-weather|snowscape|[upkeep] <> |-curestatus|p1a|frz|[msg]`   (Scorching Sands KO)
 *     `|-start|p2b|perish3        <> |-curestatus|p2a|frz|[msg]`     (Matcha Gotcha KO)
 *     `|faint|p1b                 <> |-curestatus|p1b|frz|[msg]`     (Flare Blitz KO)
 *
 * THE ARMS
 *   KO-FIRE     the `onDamagingHit` route. A frozen body killed by a Fire move.
 *   KO-THAWS    the `onAfterMoveSecondary` route. A frozen body killed by a `thawsTarget` move.
 *               Two routes because this engine pays them in two DIFFERENT deferred slots
 *               (`_thawDh` and `_thawAms`) and a guard on one is not a guard on the other.
 *   SURVIVES    THE KNOB-CLEARED CONTROL, and the arm that stops "never thaw" from passing. Same
 *               Fire hit into a body that LIVES: both engines must write exactly ONE cure line, and
 *               the cure must actually land — the body is unfrozen on the board afterwards.
 *
 * Every arm ALSO asserts the boards are identical, so a fix that skipped the state change as well as
 * the line would be caught.
 *
 * THE FIXTURE IS SEARCHED, NOT NAMED. The freeze is a 10% secondary, so the arm is
 * `bottom-tie-first` (every secondary fires, MIN damage) and the choreography has to hold: the
 * FREEZER must be slower than the victim so the freeze lands after the victim has already acted, and
 * the KILLER must be faster than the victim so the kill lands before the victim's next action — a
 * frozen body that gets to move thaws itself in `onBeforeMove` and the arm proves nothing. Candidate
 * (killer, victim) pairs are enumerated in a derived order and the first one the AUTHORITY stages
 * correctly is taken; every earlier one is refused BY NAME.
 *
 * RED-FIRST KNOB: `MEDI_THAW_CURES_A_CORPSE=1` takes the HP guard back out — the engine exactly as
 * it stood before batch R. Under it KO-FIRE and KO-THAWS go RED and SURVIVES stays green, and any
 * run carrying it also carries `MEDFAILS.thawOnCorpseRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_thaw_on_a_corpse.js
 *   MEDI_THAW_CURES_A_CORPSE=1 SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_thaw_on_a_corpse.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_THAW_CURES_A_CORPSE === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_thaw_on_a_corpse.js — a body killed by its own thawing hit is not cured');
console.log('  MEDI_THAW_CURES_A_CORPSE=' + (KNOB ? '1  (PRE-FIX ENGINE: the corpse is cured and says so)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read, never recalled. The CR is stripped because this checkout is CRLF and a
 *    carriage return is a JavaScript line terminator; without it every multi-line anchor matches
 *    nothing and reports "not found" against a file that says exactly what it should.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const SIM_POKEMON = read('/sim/pokemon.ts');
const COND = read('/data/conditions.ts');
const CH_COND = read('/data/mods/champions/conditions.ts');

console.log(NL + '0. THE AUTHORITY');
const CS = /\n\tcureStatus\(silent = false\) \{\n([\s\S]*?)\n\t\}/.exec(SIM_POKEMON);
ok(!!CS && /if \(!this\.hp \|\| !this\.status\) return false;/.test(CS[1]),
   '`Pokemon#cureStatus` refuses a body at 0 HP BEFORE it writes the `-curestatus` line',
   CS ? CS[1].split('\n').slice(0, 3).join('\n') : 'cureStatus block not found — re-read the file');
const FRZ = /\n\tfrz: \{\n([\s\S]*?)\n\t\},\n/.exec(COND);
ok(!!FRZ && /onAfterMoveSecondary\(target, source, move\) \{\s*\n\s*if \(move\.thawsTarget\) \{?\s*\n?\s*target\.cureStatus\(\);/.test(FRZ[1]),
   'the `thawsTarget` thaw is `frz.onAfterMoveSecondary` and it calls `cureStatus()`',
   FRZ ? (FRZ[1].match(/onAfterMoveSecondary[\s\S]{0,140}/) || ['not found'])[0] : 'frz block not found');
ok(!!FRZ && /onDamagingHit\(damage, target, source, move\)[\s\S]{0,200}?target\.cureStatus\(\);/.test(FRZ[1]),
   'the FIRE thaw is `frz.onDamagingHit` and it calls the same `cureStatus()`',
   FRZ ? (FRZ[1].match(/onDamagingHit[\s\S]{0,180}/) || ['not found'])[0] : 'frz block not found');
/* WHICH HANDLERS CHAMPIONS OVERRIDES. Reading mainline when the mod has a row is reading a different
 * game; this counts the mod's own `frz` block rather than assuming. */
const CHFRZ = /\n\tfrz: \{\n([\s\S]*?)\n\t\},\n/.exec(CH_COND);
const chHandlers = CHFRZ ? (CHFRZ[1].match(/^\t\ton[A-Za-z]+/gm) || []).map(s => s.trim()) : null;
ok(!!CHFRZ && chHandlers.length > 0
   && !chHandlers.includes('onAfterMoveSecondary') && !chHandlers.includes('onDamagingHit'),
   'Champions overrides `frz` but NOT either thaw handler, so mainline IS their authority',
   'champions frz handlers: ' + (chHandlers ? chHandlers.join(', ') : 'block not found'));

/* ==================================================================================================
 * 1. THE CAST — derived from the format
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const SPEC = D.species.all().filter(s => legal(s) && !s.isMega);
const learnsetOf = sp => ((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {};
const learns = (sp, mv) => !!learnsetOf(sp)[mv];
const mult = (t, types) => { let m = 1;
  for (const ty of types) { if (D.getImmunity(t, ty) === false) return 0; m *= Math.pow(2, D.getEffectiveness(t, ty)); }
  return m; };

/* The freeze itself — a single-target attack carrying a `frz` secondary. */
const FRZ_MOVES = D.moves.all().filter(m => legal(m) && m.category !== 'Status' && m.target === 'normal'
  && (m.secondaries || []).some(s => s.status === 'frz')).sort((a, b) => b.basePower - a.basePower);
console.log(NL + '1. THE CAST, DERIVED THIS RUN');
console.log('     single-target attacks with a `frz` secondary : '
  + (FRZ_MOVES.map(m => m.name).join(', ') || '(none)'));
if (!FRZ_MOVES.length) { console.log('  NOT STAGED — nothing in this format can freeze on contact.'); process.exit(1); }
const FRZ_MOVE = FRZ_MOVES[0];
/* THE FIRE ROUTE and THE thawsTarget ROUTE, both single-target so the arm stays a duel. */
const FIRE_MOVES = D.moves.all().filter(m => legal(m) && m.type === 'Fire' && m.category !== 'Status'
  && m.target === 'normal' && m.basePower >= 90 && !m.flags.charge && !m.flags.recharge && !m.self)
  .sort((a, b) => b.basePower - a.basePower);
const THAW_MOVES = D.moves.all().filter(m => legal(m) && m.thawsTarget && m.category !== 'Status'
  && m.target === 'normal').sort((a, b) => b.basePower - a.basePower);
console.log('     Fire single-target attacks (>=90 BP)         : ' + FIRE_MOVES.map(m => m.name).join(', '));
console.log('     `thawsTarget` single-target attacks          : ' + THAW_MOVES.map(m => m.name + '/' + m.type).join(', '));
if (!FIRE_MOVES.length || !THAW_MOVES.length) { console.log('  NOT STAGED — a route has no move.'); process.exit(1); }

/* THE FREEZER IS THE SLOWEST LEGAL CARRIER of the freezing move, so its click lands after the victim
 * has already taken its action for the turn. */
const FREEZERS = SPEC.filter(s => learns(s.name, FRZ_MOVE.id)).sort((a, b) => a.baseStats.spe - b.baseStats.spe);
if (!FREEZERS.length) { console.log('  NOT STAGED — no legal carrier of ' + FRZ_MOVE.name + '.'); process.exit(1); }
const FREEZER = FREEZERS[0];
console.log('     the FREEZER (slowest carrier of ' + FRZ_MOVE.name + ')  : '
  + FREEZER.name + '  spe ' + FREEZER.baseStats.spe);

/* A KILLER is fast and hits hard; a VICTIM is frail, weak to the killing type and NOT weak to the
 * freezing move's type, so it survives the freeze and dies to the kill. */
const killers = (mv) => SPEC.filter(s => learns(s.name, mv.id) && s.baseStats.spe >= 95
    && Math.max(s.baseStats.atk, s.baseStats.spa) >= 100)
  .sort((a, b) => Math.max(b.baseStats.atk, b.baseStats.spa) - Math.max(a.baseStats.atk, a.baseStats.spa));
const victims = (mv) => SPEC.filter(s => mult(mv.type, s.types) >= 4 && mult(FRZ_MOVE.type, s.types) <= 1
    && s.baseStats.spe > FREEZER.baseStats.spe && s.baseStats.spe <= 90)
  .sort((a, b) => (a.baseStats.hp + a.baseStats.def + a.baseStats.spd) - (b.baseStats.hp + b.baseStats.def + b.baseStats.spd));
/* The victim's IDLE CLICK must not touch its own Speed (an Agility would put it ahead of the killer
 * and it would thaw itself), must not be a shield (nothing would land) and must not be priority.
 * It is aimed at the KILLER's slot, never at the freezer, because a dead freezer never freezes. */
const idleOf = sp => Object.keys(learnsetOf(sp)).map(id => D.moves.get(id))
  .filter(m => legal(m) && m.category !== 'Status' && m.target === 'normal' && !m.priority
    && m.basePower > 0 && m.basePower <= 60 && (m.accuracy === true || m.accuracy >= 100))
  .sort((a, b) => a.basePower - b.basePower)[0];

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) { console.log('  NOT STAGED — the bottom arm is not in ARM_BY_ID.'); process.exit(1); }
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const bench = (...n) => n.map(s => mon(s, '', '', ['Protect']));
const isCure = l => /^\|-curestatus\|/.test(String(l)) && /\|frz\|/.test(String(l));
const isFaintOf = (l, name) => new RegExp('^\\|faint\\|p2a: ' + name).test(String(l));

function play(tag, killer, killMove, victim, idle) {
  const A = [mon(FREEZER.name, '', '', [FRZ_MOVE.name, 'Protect']),
             mon(killer.name, '', '', [killMove.name, 'Protect'])].concat(bench('garchomp', 'weavile'));
  const B = [mon(victim.name, '', '', [idle.name]),
             mon('clefable', '', 'Unaware', ['Protect'])].concat(bench('toxapex', 'corviknight'));
  const script = [
    { p1: [{ m: FRZ_MOVE.id, t: 0 }, { m: 'protect' }], p2: [{ m: idle.id, t: 1 }, { m: 'protect' }] },
    { p1: [{ m: 'protect' }, { m: killMove.id, t: 0 }], p2: [{ m: idle.id, t: 1 }, { m: 'protect' }] },
  ];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_thaw_on_a_corpse :: ' + tag, { script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).length });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  return { staged: true, boards, sd, me,
           sdFroze: sd.some(l => /^\|-status\|p2a: /.test(l) && /\|frz/.test(l)),
           meFroze: me.some(l => /^\|-status\|p2a: /.test(l) && /\|frz/.test(l)),
           sdFaint: sd.some(l => isFaintOf(l, victim.name.split('-')[0])),
           meFaint: me.some(l => isFaintOf(l, victim.name.split('-')[0])),
           sdCure: sd.filter(isCure), meCure: me.filter(isCure),
           boardDiffs: boards.reduce((n, x) => n + x.diffs, 0),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* THE SEARCH. A fixture is accepted only when the AUTHORITY does what the arm needs: the victim is
 * frozen, it faints, and Showdown writes NO cure line. Every rejected candidate is named. */
function findKO(mvList, label) {
  const tried = [];
  for (const mv of mvList) {
    for (const k of killers(mv).slice(0, 4)) {
      for (const v of victims(mv).slice(0, 5)) {
        if (k.name === v.name) continue;
        const idle = idleOf(v.name);
        if (!idle) { tried.push(v.name + ' (no idle click)'); continue; }
        const R = play(label + ':' + k.name + '/' + mv.name + ' -> ' + v.name, k, mv, v, idle);
        if (!R.staged) { tried.push(k.name + '/' + mv.name + ' -> ' + v.name + ' (' + R.why + ')'); continue; }
        if (!R.sdFroze) { tried.push(k.name + '/' + mv.name + ' -> ' + v.name + ' (the authority never froze it)'); continue; }
        if (!R.sdFaint) { tried.push(k.name + '/' + mv.name + ' -> ' + v.name + ' (the authority did not KO it)'); continue; }
        if (R.sdCure.length) { tried.push(k.name + '/' + mv.name + ' -> ' + v.name + ' (the authority DID cure — it thawed before dying)'); continue; }
        return { R, k, mv, v, idle, tried };
      }
    }
  }
  return { R: null, tried };
}
function findSurvivor(mvList, label) {
  const tried = [];
  for (const mv of mvList) {
    for (const k of killers(mv).slice(0, 4)) {
      /* A body that RESISTS the killing move and is bulky: it is frozen, hit, and lives. */
      for (const v of SPEC.filter(s => mult(mv.type, s.types) <= 0.5 && mult(FRZ_MOVE.type, s.types) <= 1
            && s.baseStats.spe > FREEZER.baseStats.spe && s.baseStats.spe <= 90)
            .sort((a, b) => (b.baseStats.hp + b.baseStats.def + b.baseStats.spd) - (a.baseStats.hp + a.baseStats.def + a.baseStats.spd))
            .slice(0, 5)) {
        if (k.name === v.name) continue;
        const idle = idleOf(v.name);
        if (!idle) { tried.push(v.name + ' (no idle click)'); continue; }
        const R = play(label + ':' + k.name + '/' + mv.name + ' -> ' + v.name, k, mv, v, idle);
        if (!R.staged) { tried.push(v.name + ' (' + R.why + ')'); continue; }
        if (!R.sdFroze) { tried.push(v.name + ' (the authority never froze it)'); continue; }
        if (R.sdFaint) { tried.push(v.name + ' (it DIED — that is the other arm)'); continue; }
        if (R.sdCure.length !== 1) { tried.push(v.name + ' (the authority wrote ' + R.sdCure.length + ' cure lines, not 1)'); continue; }
        return { R, k, mv, v, idle, tried };
      }
    }
  }
  return { R: null, tried };
}

const FIRE = findKO(FIRE_MOVES, 'ko-fire');
const THAWS = findKO(THAW_MOVES, 'ko-thaws');
const LIVE = findSurvivor(FIRE_MOVES, 'survives');

console.log(NL + '2. THE ARMS');
for (const [tag, F] of [['KO-FIRE', FIRE], ['KO-THAWS', THAWS], ['SURVIVES', LIVE]]) {
  if (!F.R) {
    console.log('  NOT STAGED (' + tag + ') — every candidate was refused:');
    for (const t of F.tried) console.log('      refused: ' + t);
    process.exit(1);
  }
  console.log('  === ' + tag + '  ' + F.k.name + ' clicks ' + F.mv.name + ' into ' + F.v.name
    + ' (frozen by ' + FREEZER.name + '\u2019s ' + FRZ_MOVE.name + '; it idles on ' + F.idle.name + ') ===');
  if (F.tried.length) for (const t of F.tried) console.log('      refused first: ' + t);
  console.log('    showdown  froze ' + F.R.sdFroze + '  fainted ' + F.R.sdFaint
    + '  cure lines x' + F.R.sdCure.length + '   ' + JSON.stringify(F.R.sdCure));
  console.log('    medicham2 froze ' + F.R.meFroze + '  fainted ' + F.R.meFaint
    + '  cure lines x' + F.R.meCure.length + '   ' + JSON.stringify(F.R.meCure));
  console.log('    boards: ' + F.R.boardDiffs + ' diff(s) across ' + F.R.boards.length + ' boundaries');
  console.log('    first protocol divergence: ' + (F.R.div ? JSON.stringify(F.R.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');
/* THE ARM IS NOT VACUOUS: the freeze landed and the body died. Without this, an engine that simply
 * never freezes would sweep every "no cure line" assertion below. */
for (const [tag, F] of [['KO-FIRE', FIRE], ['KO-THAWS', THAWS]]) {
  ok(F.R.sdFroze && F.R.meFroze && F.R.sdFaint && F.R.meFaint,
     tag + ' — BOTH engines froze the body and BOTH killed it, so the arm asks a real question',
     'showdown froze/fainted ' + F.R.sdFroze + '/' + F.R.sdFaint
     + '   medicham2 ' + F.R.meFroze + '/' + F.R.meFaint);
  ok(F.R.sdCure.length === 0, tag + ' — the AUTHORITY writes NO cure line for the corpse',
     JSON.stringify(F.R.sdCure));
  ok(KNOB ? F.R.meCure.length === 1 : F.R.meCure.length === 0,
     tag + ' — medicham2 writes ' + (KNOB ? 'ONE (the knob is armed)' : 'none either'),
     JSON.stringify(F.R.meCure));
  ok(F.R.boardDiffs === 0, tag + ' — the BOARDS stay identical', F.R.boardDiffs + ' diff(s)');
}
ok(LIVE.R.sdFroze && LIVE.R.meFroze && !LIVE.R.sdFaint && !LIVE.R.meFaint,
   'SURVIVES — the body was frozen and LIVED through the hit in both engines',
   'showdown froze/fainted ' + LIVE.R.sdFroze + '/' + LIVE.R.sdFaint
   + '   medicham2 ' + LIVE.R.meFroze + '/' + LIVE.R.meFaint);
ok(LIVE.R.sdCure.length === 1 && LIVE.R.meCure.length === 1,
   'SURVIVES — BOTH engines write exactly ONE cure line, under either setting of the knob. This is '
   + 'what separates the HP guard from "never thaw".',
   'showdown ' + JSON.stringify(LIVE.R.sdCure) + '  medicham2 ' + JSON.stringify(LIVE.R.meCure));
ok(LIVE.R.boardDiffs === 0, 'SURVIVES — the BOARDS stay identical, so the thaw really landed',
   LIVE.R.boardDiffs + ' diff(s)');

/* ==================================================================================================
 * 4. THE ENGINE'S OWN RECEIPTS
 * ============================================================================================== */
console.log(NL + '4. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M && M.MEDSEEN, F2 = M && M.MEDFAILS;
console.log('     thawBelowSecondary ' + (S ? S.thawBelowSecondary : '?')
  + '   thawRefusedOnFaint ' + (S ? S.thawRefusedOnFaint : '?')
  + '   thawOnCorpseRestored ' + (F2 ? F2.thawOnCorpseRestored : '?'));
ok(!!S && S.thawBelowSecondary >= 1,
   'the thaw itself RAN somewhere in this run — a capability that cannot prove it ran is assumed broken',
   'thawBelowSecondary = ' + (S ? S.thawBelowSecondary : '?'));
ok(!!S && (KNOB ? S.thawRefusedOnFaint === 0 : S.thawRefusedOnFaint >= 2),
   KNOB ? 'the HP guard did NOT refuse anything (the knob is armed)'
        : 'the HP guard refused BOTH routes — one refusal per KO arm at least',
   'thawRefusedOnFaint = ' + (S ? S.thawRefusedOnFaint : '?'));
ok(!!F2 && (KNOB ? F2.thawOnCorpseRestored === 1 : !F2.thawOnCorpseRestored),
   'the knob marks its own run — a pre-fix engine cannot be mistaken for a fixed one',
   'thawOnCorpseRestored = ' + (F2 ? F2.thawOnCorpseRestored : '?'));

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
