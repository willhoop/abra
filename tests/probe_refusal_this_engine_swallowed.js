#!/usr/bin/env node
/* tests/probe_refusal_this_engine_swallowed.js — NARRATION BATCH S, CLUSTER 3
 * ==================================================================================================
 * A REFUSAL THIS ENGINE ALREADY MAKES, AND MAKES IN SILENCE.
 *
 * `runMoveEffects` ends a status move that achieved nothing with the generic two-field line:
 *
 *     if (didAnything === false) { this.add('-fail', pokemon); this.attrLastMove('[still]'); }
 *                                                              sim/battle-actions.ts:1303-1309
 *
 * Two doors reach it, and this engine walked through both of them without saying anything — the
 * refusal was a SILENT CONJUNCT in a guard rather than a branch with a consequence:
 *
 *   YAWN into a body that already carries a major status. `yawn.onTryHit(target) { if (target.status
 *     || !target.runStatusImmunity('slp')) return false; }` (data/moves.ts:21135). The engine's yawn
 *     branch tested `canTakeStatus(t,'slp')` as an `else if` and simply fell off the end.
 *   LEECH SEED into a body that is already seeded. `volatileStatus: 'leechseed'`, and
 *     `Pokemon#addVolatile` returns a bare **false** for a volatile already present with no
 *     `onRestart` (sim/pokemon.ts:1994-1997). The engine had `!t._seededBy` as a conjunct at the TOP
 *     of its perTurnHP block, so the whole block — the accuracy roll included — was skipped.
 *
 * FOUR NARRATION-ONLY CAUSES on release `ccdda3181a45`:
 *     event missing from medicham2 :: |-fail|p2b <> |upkeep                (Yawn, asleep target)
 *     event missing from medicham2 :: |-fail|p1b <> |upkeep                (Yawn, asleep target)
 *     event missing from medicham2 :: |-fail|p2b <> |move|p1a|weatherball  (Leech Seed, seeded)
 *     event missing from medicham2 :: |-fail|p1a <> |move|p1b|rockslide    (Leech Seed, seeded)
 *
 * ================= THE DIE MOVES, AND THAT IS THE PART THAT NEEDED CARE ==========================
 *
 * Leech Seed is 90% accurate and `hitStepAccuracy` runs ABOVE `runMoveEffects`, so the authority
 * ROLLS on a repeat click and this engine rolled NOTHING. The fix therefore adds a draw. Under the
 * differential's middle arm the die is an ADDRESS — `FNV1a(seed|turn|category|move|slot|nth)` — so a
 * draw added at the address the authority already spends is an ALIGNMENT and not a shift; the
 * SEED-REPEAT arms below assert the whole `-fail`/`-miss`/`-start` list in ORDER over six clicks,
 * across two arms, which is what would catch a roll landing in the wrong place.
 * Yawn's printed accuracy is `true`, so its road draws nothing on either engine.
 *
 * THE ARMS
 *   YAWN-AT-PAR / YAWN-AT-SLP   RED. A statused target; the authority writes `|-fail|<mover>`.
 *   YAWN-CLEAN                  CONTROL. No status: the drowse lands and NOTHING fails.
 *   YAWN-DROWSING               CONTROL, green before and after. ROADMAP #241 already wired the
 *                               already-drowsing refusal; it must keep writing exactly one line.
 *   YAWN-SAFEGUARD              THE OVER-MATCH NEGATIVE, and it is NOT a full-agreement arm — see
 *                               the block below it. It asserts only that THIS ENGINE writes no
 *                               `-fail` on the mover, which is what a fix keyed on `canTakeStatus`
 *                               instead of on `target.status` would break.
 *   SEED-REPEAT (middle/bottom) RED. An already-seeded target; the authority rolls, then fails.
 *   SEED-GRASS                  CONTROL. A Grass target is refused two steps higher, at
 *                               `onTryImmunity`, with `-immune` and NO accuracy roll at all.
 *
 * Every arm asserts the boards are identical at every boundary.
 *
 * RED-FIRST KNOB: `MEDI_SWALLOW_REFUSALS=1` puts both silences back — the engine exactly as it stood
 * before batch S, accuracy roll included. Any run carrying it also carries
 * `MEDFAILS.swallowedRefusalsRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node tests/probe_refusal_this_engine_swallowed.js
 *   MEDI_SWALLOW_REFUSALS=1 SHOWDOWN_PATH=... node tests/probe_refusal_this_engine_swallowed.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '8');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_SWALLOW_REFUSALS === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_refusal_this_engine_swallowed.js — a refusal made in silence');
console.log('  MEDI_SWALLOW_REFUSALS=' + (KNOB ? '1  (PRE-FIX ENGINE: both refusals say nothing)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run, CR stripped (CRLF checkout, and a CR is a JS line terminator).
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const MOVES = read('/data/moves.ts');
const CH_MOVES = read('/data/mods/champions/moves.ts');
const POKE = read('/sim/pokemon.ts');
const ACTIONS = read('/sim/battle-actions.ts');
const block = (src, id) => {
  const m = new RegExp('\\n\\t' + id + ': \\{\\n([\\s\\S]*?)\\n\\t\\},\\n').exec(src);
  return m ? m[1] : null;
};

console.log(NL + '0. THE AUTHORITY');
const YAWN = block(MOVES, 'yawn');
/* The sources are indented with tabs and wrapped; every anchor below is matched against a FLATTENED
 * copy so an assertion cannot go red on somebody's line wrapping. */
const flat = s => String(s).replace(/\s+/g, ' ');
ok(!!YAWN && flat(YAWN).indexOf("onTryHit(target) { if (target.status || !target.runStatusImmunity('slp')) { return false; } }") >= 0,
   "yawn's `onTryHit` refuses on `target.status` — a bare `return false`, which is the GENERIC line",
   YAWN ? (YAWN.match(/onTryHit\(target\)[\s\S]{0,140}/) || ['not found'])[0] : 'yawn block not found');
ok(!/\n\tyawn: \{/.test(CH_MOVES) && !/\n\tleechseed: \{/.test(CH_MOVES),
   'Champions overrides neither `yawn` nor `leechseed`, so mainline IS their authority');
const LS = block(MOVES, 'leechseed');
ok(!!LS && /volatileStatus: 'leechseed',/.test(LS) && /accuracy: 90,/.test(LS)
   && flat(LS).indexOf("onTryImmunity(target) { return !target.hasType('Grass'); }") >= 0,
   'leechseed is a 90%-accurate `volatileStatus` whose Grass refusal is `onTryImmunity` — two steps '
   + 'ABOVE the accuracy roll, which is why the Grass arm draws no die',
   LS ? (LS.match(/accuracy: 90,[\s\S]{0,120}/) || ['not found'])[0] : 'leechseed block not found');
ok(flat(POKE).indexOf("if (this.volatiles[status.id]) { if (!status.onRestart) return false;") >= 0,
   '`Pokemon#addVolatile` returns a bare `false` for a volatile already present with no `onRestart`');
ok(flat(ACTIONS).indexOf("if (didAnything === false) { this.battle.add('-fail', source); this.battle.attrLastMove('[still]');") >= 0,
   "`runMoveEffects` turns that `false` into the generic `|-fail|<mover>`",
   (ACTIONS.match(/if \(didAnything === false\) \{[\s\S]{0,180}/) || ['not found'])[0]);
/* THE STEP ORDER, read off the authority's own list rather than recalled. */
const STEPS = flat((ACTIONS.match(/const moveSteps[\s\S]{0,1500}?hitStepMoveHitLoop/) || [''])[0]);

const iAcc = STEPS.indexOf('hitStepAccuracy'), iImm = STEPS.indexOf('hitStepTryImmunity');
ok(iImm >= 0 && iAcc >= 0 && iImm < iAcc,
   '`hitStepTryImmunity` sits ABOVE `hitStepAccuracy` in `moveSteps`, so the Grass refusal spends no die',
   STEPS.replace(/\s+/g, ' ').slice(0, 260));

/* ==================================================================================================
 * 1. THE CAST — derived from the format
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legalX = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => !!(((D.species.getLearnsetData(D.species.get(sp).id) || {}).learnset) || {})[mv];
const carriers = mv => D.species.all().filter(s => legalX(s) && learns(s.name, mv));
const YAWNER = carriers('yawn').filter(s => learns(s.name, 'thunderwave') && learns(s.name, 'hypnosis'))[0]
            || carriers('yawn').filter(s => learns(s.name, 'thunderwave'))[0];
const SEEDER = carriers('leechseed')[0];
const GRASS = D.species.all().filter(s => legalX(s) && s.types.indexOf('Grass') >= 0
                                       && s.types.indexOf('Steel') < 0)[0];
console.log(NL + '1. THE CAST');
ok(!!YAWNER && !!SEEDER && !!GRASS, 'a Yawn carrier that also learns Thunder Wave, a Leech Seed carrier and a Grass body all exist',
   'yawn+twave: ' + carriers('yawn').filter(s => learns(s.name, 'thunderwave')).map(s => s.name).slice(0, 6).join(', ')
   + NL + 'leechseed: ' + carriers('leechseed').map(s => s.name).slice(0, 6).join(', '));
if (!YAWNER || !SEEDER || !GRASS) { console.log(NL + 'RED — the cast could not be derived.'); process.exit(1); }
console.log('     Yawn user : ' + YAWNER.name + '   Leech Seed user: ' + SEEDER.name + '   Grass body: ' + GRASS.name);

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const IDLE = { m: 'nastyplot' };

function play(tag, armId, A, B, script) {
  const ARM = G.ARM_BY_ID.get(armId);
  if (!ARM) return { staged: false, why: 'arm ' + armId + ' is not in ARM_BY_ID' };
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_refusal_this_engine_swallowed :: ' + tag, {
    script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).slice(0, 4) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW/REJECTED: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  /* `[of] pXy` is dropped: the differ's own `source-tag` rule drops it, and the two engines tag it
   * inconsistently on `-start`. Everything that decides the outcome is kept. */
  const norm = s => s.filter(l => /^\|-(fail|miss|start|immune|activate)\|/.test(l))
                     .map(l => l.replace(/\|\[of\][^|]*/g, '').replace(/\s+/g, ' ').toLowerCase().replace(/[:,]/g, ''));
  return { staged: true, sd, me, sdLines: norm(sd), meLines: norm(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

const YA = [mon(YAWNER.name, '', '', ['Yawn', 'Thunder Wave', 'Protect']), mon('sableye', '', 'Prankster', ['Nasty Plot']),
            mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const FOE = [mon('milotic', '', 'Marvel Scale', ['Nasty Plot']), mon('raichu', '', 'Static', ['Nasty Plot']),
             mon('kingambit', '', 'Defiant', ['Nasty Plot']), mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const T1 = k => ({ p1: [k, IDLE], p2: [IDLE, IDLE] });
const YAWN_AT = { m: 'yawn', t: 0 };

const Y_CLEAN = play('YAWN-CLEAN', 'middle', YA, FOE, [T1(YAWN_AT)]);
const Y_PAR = play('YAWN-AT-PAR', 'middle', YA, FOE, [T1({ m: 'thunderwave', t: 0 }), T1(YAWN_AT)]);
/* The SLEEP arm reaches the same clause by a different status, and it is the pool's own: both cards
 * are a Yawn clicked at a body that is already asleep. The drowse is applied on turn 1 and matures
 * into `slp` on turn 2, so turn 3's click meets a SLEEPING body — no second move is needed. */
const Y_SLP = play('YAWN-AT-SLP', 'middle', YA, FOE, [T1(YAWN_AT), T1({ m: 'protect' }), T1(YAWN_AT)]);
const Y_DROWSE = play('YAWN-DROWSING', 'middle', YA, FOE, [T1(YAWN_AT), T1(YAWN_AT)]);

/* THE OVER-MATCH NEGATIVE. Safeguard is NOT `target.status` and NOT a sleep immunity: it is a SIDE
 * condition whose `onTryAddVolatile` names `yawn` and returns null with `-activate|move: Safeguard`
 * (data/moves.ts:15601-15607). So a fix keyed on this engine's wider `canTakeStatus` would write a
 * `-fail` the authority never writes. */
const YS = [mon(YAWNER.name, '', '', ['Yawn', 'Nasty Plot']), mon('sableye', '', 'Prankster', ['Nasty Plot']),
            mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const YSB = [mon('milotic', '', 'Marvel Scale', ['Safeguard', 'Nasty Plot']), mon('raichu', '', 'Static', ['Nasty Plot']),
             mon('kingambit', '', 'Defiant', ['Nasty Plot']), mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const Y_SAFE = play('YAWN-SAFEGUARD', 'middle', YS, YSB,
  [{ p1: [IDLE, IDLE], p2: [{ m: 'safeguard' }, IDLE] }, T1(YAWN_AT)]);

const LA = [mon(SEEDER.name, '', '', ['Leech Seed', 'Nasty Plot']), mon('sableye', '', 'Prankster', ['Nasty Plot']),
            mon('gengar', '', 'Cursed Body', ['Nasty Plot']), mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const LG = [mon(GRASS.name, '', '', ['Nasty Plot']), mon('raichu', '', 'Static', ['Nasty Plot']),
            mon('kingambit', '', 'Defiant', ['Nasty Plot']), mon('incineroar', '', 'Intimidate', ['Nasty Plot'])];
const SEED = { m: 'leechseed', t: 0 };
const SEED6 = [T1(SEED), T1(SEED), T1(SEED), T1(SEED), T1(SEED), T1(SEED)];
const S_MID = play('SEED-REPEAT-mid', 'middle', LA, FOE, SEED6);
const S_BOT = play('SEED-REPEAT-bot', 'bottom-tie-first', LA, FOE, SEED6);
const S_GRASS = play('SEED-GRASS', 'middle', LA, LG, [T1(SEED), T1(SEED)]);

/* ==================================================================================================
 * 3. THE JUDGEMENT — the whole list in order, never a count
 * ============================================================================================== */
console.log(NL + '2. THE ARMS');
const arms = [['YAWN-CLEAN', Y_CLEAN], ['YAWN-AT-PAR', Y_PAR], ['YAWN-AT-SLP', Y_SLP],
              ['YAWN-DROWSING', Y_DROWSE], ['SEED-REPEAT-mid', S_MID], ['SEED-REPEAT-bot', S_BOT],
              ['SEED-GRASS', S_GRASS]];
for (const [tag, R] of arms) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag);
  console.log('     showdown : ' + (R.sdLines.join('   ') || '(nothing)'));
  console.log('     medicham : ' + (R.meLines.join('   ') || '(nothing)'));
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(JSON.stringify(R.sdLines) === JSON.stringify(R.meLines),
     tag + ' — the two engines write the SAME lines, in order',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

console.log(NL + '3. THE SHAPES THE ARMS EXIST FOR');
const sdHas = (R, re) => R.staged && R.sdLines.some(l => re.test(l));
const meHas = (R, re) => R.staged && R.meLines.some(l => re.test(l));
const mover = new RegExp('^\\|-fail\\|p1a ' + YAWNER.name.split('-')[0].toLowerCase() + '$');
ok(sdHas(Y_PAR, mover), 'YAWN-AT-PAR — the authority failed the mover', Y_PAR.staged ? Y_PAR.sdLines.join(' | ') : Y_PAR.why);
ok(sdHas(Y_SLP, mover), 'YAWN-AT-SLP — the authority failed the mover (the pool cards\' own shape)',
   Y_SLP.staged ? Y_SLP.sdLines.join(' | ') : Y_SLP.why);
ok(Y_CLEAN.staged && !Y_CLEAN.sdLines.some(l => /^\|-fail\|/.test(l)) && sdHas(Y_CLEAN, /^\|-start\|p2a milotic\|move yawn$/),
   'YAWN-CLEAN — the drowse LANDS and nothing fails (the control that stops "always -fail")',
   Y_CLEAN.staged ? Y_CLEAN.sdLines.join(' | ') : Y_CLEAN.why);
const seedMover = new RegExp('^\\|-fail\\|p1a ' + SEEDER.name.split('-')[0].toLowerCase() + '$');
ok(sdHas(S_MID, seedMover) || sdHas(S_BOT, seedMover),
   'SEED-REPEAT — the authority failed the mover on at least one repeat click',
   (S_MID.staged ? S_MID.sdLines.join(' | ') : '') + NL + (S_BOT.staged ? S_BOT.sdLines.join(' | ') : ''));
ok(sdHas(S_MID, /^\|-miss\|/) || sdHas(S_BOT, /^\|-miss\|/),
   'SEED-REPEAT — at least one click MISSED, so the arms prove the 90% roll is at the authority\'s '
   + 'address rather than absent',
   (S_MID.staged ? S_MID.sdLines.join(' | ') : '') + NL + (S_BOT.staged ? S_BOT.sdLines.join(' | ') : ''));
ok(S_GRASS.staged && !S_GRASS.sdLines.some(l => /^\|-(fail|miss)\|/.test(l)) && sdHas(S_GRASS, /^\|-immune\|/),
   'SEED-GRASS — refused two steps higher: `-immune`, no `-fail` and no `-miss`',
   S_GRASS.staged ? S_GRASS.sdLines.join(' | ') : S_GRASS.why);

/* ---- THE OVER-MATCH NEGATIVE, AND THE DEFECT IT UNCOVERED --------------------------------------
 * This arm asserts ONE thing, and deliberately not stream agreement: THIS ENGINE must not write a
 * `-fail` on the mover. That is what a fix keyed on `canTakeStatus` — which is wider than
 * `target.status` — would break.
 *
 * IT IS NOT A FULL-AGREEMENT ARM BECAUSE THE TWO STREAMS DO NOT AGREE, FOR A REASON THAT IS NOT
 * THIS BATCH'S. Measured here on every run: the authority refuses the drowse outright
 * (`-activate|TARGET|move: Safeguard`, `data/moves.ts:15601-15607` — `onTryAddVolatile` names
 * `yawn` explicitly) and this engine LANDS it (`-start|TARGET|move: Yawn`). That is a BOARD defect,
 * it has no pinned-pool witness, and it also falsifies a comment standing in the yawn branch, which
 * says Safeguard is "an `onSetStatus`, so a Safeguarded body takes the drowse in the authority".
 * It is REPORTED here rather than fixed inside a narration pass — see the batch S report. */
console.log(NL + '4. THE OVER-MATCH NEGATIVE, AND WHAT IT FOUND');
if (!Y_SAFE.staged) ok(false, 'YAWN-SAFEGUARD — NOT STAGED', Y_SAFE.why);
else {
  console.log('     showdown : ' + (Y_SAFE.sdLines.join('   ') || '(nothing)'));
  console.log('     medicham : ' + (Y_SAFE.meLines.join('   ') || '(nothing)'));
  ok(!meHas(Y_SAFE, /^\|-fail\|/),
     'YAWN-SAFEGUARD — this engine writes NO `-fail` (a fix keyed on `canTakeStatus` would)',
     Y_SAFE.meLines.join(' | '));
  ok(sdHas(Y_SAFE, /^\|-activate\|p2a milotic\|move safeguard$/),
     'YAWN-SAFEGUARD — and the AUTHORITY refuses with `-activate move: Safeguard`, not with a `-fail`',
     Y_SAFE.sdLines.join(' | '));
  console.log('     REPORTED, NOT FIXED: this engine lands the drowse where the authority refuses it. '
    + 'A board defect with no pinned-pool witness; see docs/_reports/2026-09-09-narration-batch-S.md.');
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
