#!/usr/bin/env node
/* tests/probe_noguard_invuln.js — DOES NO GUARD SEE A SEMI-INVULNERABLE BODY?
 *   node tests/probe_noguard_invuln.js          the clean arm
 *   node tests/probe_noguard_invuln.js --red    under MEDI_NOGUARD_INVULN_BLIND=1
 * ==================================================================================================
 *
 * THE GAME THAT PRODUCED THIS, AND THE DIRECTION, READ OFF `classify()` RATHER THAN GUESSED.
 * `engine/game_differential.js:4190` returns `cause: cls + ' :: ' + ga + ' <> ' + gb`, where `ga` is
 * SHOWDOWN's head and `gb` is MEDICHAM2's. `data/game-differential.json` at release f3383ff4aa29:
 *
 *     unrelated event mismatch :: |-immune|p1a <> |-miss|p2b|p1a
 *     showdown : |-immune|p1a: Golurk
 *     medicham2: |-miss|p2b: Raichu|p1a: Golurk
 *
 * So THE AUTHORITY DECLARES AN IMMUNITY AND THIS ENGINE DECLARES A MISS. The two teams are in the
 * pinned pool: p1's Golurk holds a Golurkite and carries Phantom Force; p2's Raichu holds a
 * Raichunite Y. **Raichu-Mega-Y's ability is No Guard.** The turn is a Zap Cannon into a Golurk that
 * is mid-Phantom-Force, and it is reproduced verbatim in this file's scratch sibling.
 *
 * ================= WHERE THE IMMUNITY CHECK SITS, WHICH IS THE WHOLE QUESTION ====================
 *
 * `sim/battle-actions.ts:553-577` — mainline `sim/`, which the Champions mod does NOT override
 * (grepped `data/mods/champions/scripts.ts` for `hitStep`, `trySpreadMoveHit` and `moveSteps`: no
 * match; the mod overrides `hitStepMoveHitLoop` at :428 and nothing above it):
 *
 *     556  this.hitStepInvulnerabilityEvent    // 0. semi-invulnerability
 *     559  this.hitStepTryHitEvent             // 1. Protect, Magic Bounce, Volt Absorb
 *     562  this.hitStepTypeImmunity            // 2. the type chart
 *     565  this.hitStepTryImmunity             // 3. powder, Prankster-into-Dark, onTryImmunity
 *     568  this.hitStepAccuracy                // 4. THE DIE
 *
 * and the two gen swaps below it are `gen <= 6` and `gen === 4`, so gen 9 keeps this order.
 * **IMMUNITY IS TWO STEPS ABOVE ACCURACY.** A body the type chart refuses never reaches the roll, so
 * the authority says `-immune` whatever the die would have done.
 *
 * MEDICHAM2 ALREADY HAS THAT ORDER AND IT IS NOT THE DEFECT. `_STEPS` (medicham2-browser.js:29207)
 * is `[_stepInvuln, _stepTryHit, _stepTypeImm, _stepTryImm, _stepAccuracy, ...]`, and a staged
 * Zap Cannon into a STANDING Golurk prints `|-immune|` in both engines today. What differs is ONE
 * STEP EARLIER.
 *
 * ================= THE ACTUAL DEFECT: HALF AN ABILITY WAS WIRED =================================
 *
 * `data/abilities.ts` (mainline; `data/mods/champions/abilities.ts` has no `noguard` row) gives
 * No Guard TWO handlers off one clause:
 *
 *     onAnyInvulnerabilityPriority: 1,
 *     onAnyInvulnerability(target, source, move) {
 *       if (move && (source === this.effectState.target || target === this.effectState.target)) return 0;
 *     },
 *     onAnyAccuracy(accuracy, target, source, move) { ... return true; },
 *
 * and `trySpreadMoveHit` keeps a target whose step result is `0`:
 *
 *     605  targets = targets.filter((val, i) => hitResults[i] || hitResults[i] === 0);
 *
 * so a No Guard move goes THROUGH the vanish, reaches step 2, and is refused by the type chart —
 * `-immune`. medicham2 wired only the `onAnyAccuracy` half (`_neverMissAb`, :7657, called by
 * `hitChance` at :8212) and left `_invulnDecide` (:25769) consulting nothing but Lock-On and the
 * charging move's own `pierces` list. So the row was dropped at step 0 with a `-miss`, and the
 * immunity two steps below was never asked.
 *
 * THE ENGINE'S OWN COMMENT AT :3949 ALREADY NAMED THIS SHAPE, about Lock-On:
 *     "One predicate, called by the accuracy path and by the semi-invulnerability step, because the
 *      authority's condition answers both questions off the same two clauses. Two copies of that
 *      pair is how one of the two halves ends up wired and the other does not."
 * That is exactly what happened to No Guard, so the fix calls `_neverMissAb` — the SAME predicate
 * `hitChance` calls — rather than adding a second reading of the tag.
 *
 * ================= THE FIXTURE, AND THE HAZARD IT HAD TO AVOID ==================================
 *
 * **A BODY IMMUNE FOR TWO REASONS PROVES NOTHING**, and this is an immunity fixture, so the count is
 * DERIVED and printed per arm and the file REFUSES a target with more than one reason. Dragapult is
 * Dragon/Ghost: Ghost refuses Fighting, Dragon does not, its ability (Infiltrator) carries no
 * absorb/immunity tag and it holds no item. ONE reason. Golurk in the real game is the same shape —
 * Ground refuses Electric, Ghost does not.
 *
 * Dragapult is 142 Speed and Machamp is 55, so Dragapult vanishes and Machamp swings at it INSIDE
 * the same turn — no release turn, and the run is capped at one turn so nothing downstream of the
 * measured line can move.
 *
 * FIVE ARMS, AND THE THREE CONTROLS ARE WHAT MAKE THE TWO LIVE ONES MEAN ANYTHING. A fix that simply
 * stopped refusing semi-invulnerable bodies would pass both live arms and FAIL control C.
 *
 *   A  live      vanished + Fighting  No Guard    -> IMMUNE   (this is the reported game)
 *   B  live      vanished + Ice       No Guard    -> HIT      (the bypass itself, no immunity in play)
 *   F  live      vanished + Scary Face No Guard   -> LANDS    (the non-attack path, a THIRD call site)
 *   C  control   vanished + Fighting  Steadfast   -> MISS     (the knob cleared: no No Guard)
 *   D  control   STANDING + Fighting  No Guard    -> IMMUNE   (already true today; must stay true)
 *
 * `--red` sets MEDI_NOGUARD_INVULN_BLIND=1, which is the engine exactly as it stood before this
 * file: A, B and F must PART from the authority and C and D must NOT.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE. It is read ONCE at medicham2's module load and
 * `game_differential.js` loads the engine at ITS require time — set below that line and `--red`
 * comes back green on every arm, which is the signature of an unwired knob and has been this
 * repository's bug at least twice. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_NOGUARD_INVULN_BLIND = '1';
/* ONE TURN. Everything measured happens on turn 1 and a second turn is the Phantom Force RELEASE,
 * which the authority refuses a target for — spliced in before the driver parses argv. */
if (!process.argv.includes('--turns')) process.argv.splice(2, 0, '--turns', '1');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const NL = String.fromCharCode(10);

const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

/* ---- THE FIXTURE ------------------------------------------------------------------------------- */
const CHAMP_NG = ['machamp', '', 'No Guard', ['Close Combat', 'Ice Punch', 'Scary Face', 'Protect']];
const CHAMP_CT = ['machamp', '', 'Steadfast', ['Close Combat', 'Ice Punch', 'Scary Face', 'Protect']];
/* Infiltrator, not Clear Body: Clear Body REFUSES the Scary Face drop and arm F would read as a
 * blocked status move rather than as a landed one. A control has to be chosen, not defaulted into. */
const DPULT = ['dragapult', '', 'Infiltrator', ['Phantom Force', 'Dragon Dance', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
const CORV = ['corviknight', '', 'Pressure', ['Iron Defense', 'Protect']];

const PROT = { m: 'protect' };
const PF = { m: 'phantomforce', t: 0 };   // p1a vanishes, aimed at p2a
const DD = { m: 'dragondance' };          // p1a stays on the field

const CASES = [
  { id: 'A', live: true, want: 'immune', vanish: true,
    name: 'LIVE  vanished Ghost, Fighting move, No Guard',
    what: 'The reported game. No Guard carries the move through step 0, the type chart refuses it at '
        + 'step 2, and the authority prints `-immune`. medicham2 printed `-miss` from step 0.',
    A: [DPULT, CLEF], B: [CHAMP_NG, CORV],
    script: [{ p1: [PF, PROT], p2: [{ m: 'closecombat', t: 0 }, PROT] }] },

  { id: 'B', live: true, want: 'hit', vanish: true,
    name: 'LIVE  vanished Ghost, Ice move, No Guard',
    what: 'The bypass with NO immunity anywhere in it — Ice is 2x on Dragon/Ghost. This is the arm '
        + 'that says the fix is "No Guard sees through the vanish" and not "an immune body reports '
        + 'immunity sooner". Under --red the move misses instead of landing.',
    A: [DPULT, CLEF], B: [CHAMP_NG, CORV],
    script: [{ p1: [PF, PROT], p2: [{ m: 'icepunch', t: 0 }, PROT] }] },

  { id: 'F', live: true, want: 'unboost', vanish: true,
    name: 'LIVE  vanished Ghost, a NON-ATTACK move, No Guard',
    what: 'The third call site. medicham2 refuses a semi-invulnerable body for non-attack kinds in a '
        + 'separate branch (:21165), so a fix applied only to the attack step list would leave this '
        + 'arm red. Scary Face is a Status move, so `hitStepTypeImmunity` sets `ignoreImmunity` and '
        + 'the Ghost typing does not enter into it (sim/pokemon.ts:2246).',
    A: [DPULT, CLEF], B: [CHAMP_NG, CORV],
    script: [{ p1: [PF, PROT], p2: [{ m: 'scaryface', t: 0 }, PROT] }] },

  { id: 'C', live: false, want: 'miss', vanish: true,
    name: 'CONTROL  vanished Ghost, Fighting move, NO No Guard',
    what: 'The knob cleared EXPLICITLY — the same body, the same move, the same vanish, with '
        + 'Steadfast instead of No Guard. A `-miss` is CORRECT here and must survive the fix. A '
        + 'change that simply stopped dropping semi-invulnerable rows passes A, B and F and fails '
        + 'this one, which is the only reason those three mean anything.',
    A: [DPULT, CLEF], B: [CHAMP_CT, CORV],
    script: [{ p1: [PF, PROT], p2: [{ m: 'closecombat', t: 0 }, PROT] }] },

  { id: 'D', live: false, want: 'immune', vanish: false,
    name: 'CONTROL  STANDING Ghost, Fighting move, No Guard',
    what: 'The ordinary immunity road, which already agrees today. It pins that the fix did not '
        + 'change what a type immunity looks like when no vanish is involved — and it is the arm '
        + 'that would catch a fix that started announcing `-immune` from step 0.',
    A: [DPULT, CLEF], B: [CHAMP_NG, CORV],
    script: [{ p1: [DD, PROT], p2: [{ m: 'closecombat', t: 0 }, PROT] }] },
];

/* ---- LEGALITY AND THE IMMUNITY-REASON COUNT, BOTH DERIVED --------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
  }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* HOW MANY REASONS IS THE TARGET IMMUNE FOR? Counted, printed, and refused above one. The type half
 * walks the target's types ONE AT A TIME so a second refusing type is visible rather than collapsed
 * into the same boolean; the ability half asks the tag artifact for any absorb/refusal row. */
const TAGS = require(D('data', 'tags.json'));
function immunityReasons(speciesId, abilityName, itemId, moveId) {
  const sp = dex.species.get(speciesId);
  const mv = dex.moves.get(moveId);
  const out = [];
  for (const t of sp.types) if (dex.getImmunity(mv.type, [t]) === false) out.push('type:' + t);
  const abRow = TAGS.abilities && TAGS.abilities[dex.abilities.get(abilityName || '').id];
  const REFUSE = ['absorbsType', 'immuneToMoveClass', 'immuneToType', 'refusesStatusMoves', 'levitates'];
  if (abRow && abRow.tags) for (const t of abRow.tags) if (REFUSE.includes(t)) out.push('ability:' + t);
  const itRow = itemId && TAGS.items && TAGS.items[String(itemId).toLowerCase().replace(/[^a-z0-9]/g, '')];
  if (itRow && itRow.tags) for (const t of itRow.tags) if (REFUSE.includes(t)) out.push('item:' + t);
  return out;
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));

let fails = 0, ran = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* THE OUTCOME, NOT THE CLASSIFICATION. Each engine's turn-1 lines are reduced to ONE of four words
 * by looking at what happened TO p1a, so "showdown says immune / we say miss" is a difference in the
 * answer rather than in the wording. `?` is its own value: an arm that produced none of the four is
 * a staging failure and must never compare equal to another staging failure. */
function outcome(lines) {
  const L = lines.map(String).filter(x => /^\|/.test(x));
  const hit = s => L.some(x => x.indexOf(s) >= 0);
  const of = [];
  if (hit('|-immune|p1a')) of.push('immune');
  if (/^\|-miss\|/.test(L.find(x => /^\|-miss\|/.test(x)) || '')) of.push('miss');
  if (L.some(x => /^\|-damage\|p1a/.test(x))) of.push('hit');
  if (L.some(x => /^\|-unboost\|p1a/.test(x))) of.push('unboost');
  return of.length ? of.sort().join('+') : '?';
}
/* Turn 1 only, and the `|turn|2` cut is what makes that true rather than assumed. */
function turn1(lines) {
  const out = []; let on = false;
  for (const raw of lines) {
    const l = String(raw);
    if (/^\|turn\|1\b/.test(l)) { on = true; continue; }
    if (/^\|turn\|2\b/.test(l)) break;
    if (on) out.push(l);
  }
  return out;
}

console.log((RED ? 'RED ARM — MEDI_NOGUARD_INVULN_BLIND=1 (the engine as it stood before the fix)'
                 : 'CLEAN ARM')
  + NL + 'what actually happened to p1a on turn 1, both engines' + NL);

const seenBefore = { through: M.MEDSEEN.noGuardThroughInvuln || 0 };
for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'incineroar')));
  const b = G.buildPair(stage(c.B).concat(BENCH('snorlax', 'toxapex')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_noguard_invuln :: ' + c.id, { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.id + '  ' + c.name + '   ' + r.err); fails++; continue; }
  ran++;
  const sdL = turn1(G.lastSdLog() || []), meL = turn1(r.mediTrace || []);
  const sdO = outcome(sdL), meO = outcome(meL);
  const mvId = c.script[0].p2[0].m;
  const reasons = immunityReasons(c.A[0][0], c.A[0][2], c.A[0][1], mvId);
  const prepared = l => l.some(x => /^\|-prepare\|p1a/i.test(String(x)));

  console.log(NL + c.id + '  ' + c.name);
  console.log('    ' + c.what);
  console.log('    immunity reasons for p1a against ' + dex.moves.get(mvId).name + ': '
            + (reasons.length ? reasons.join(', ') : '(none)'));
  console.log('    showdown  ' + sdO + '   ' + sdL.filter(x => /-immune|-miss|-damage\|p1a|-unboost\|p1a|-prepare/.test(x)).join('  '));
  console.log('    medicham  ' + meO + '   ' + meL.filter(x => /-immune|-miss|-damage\|p1a|-unboost\|p1a|-prepare/.test(x)).join('  '));

  /* THE FIXTURE'S OWN PREMISE, ASSERTED RATHER THAN ASSUMED — all three of these have been wrong
     before the engine was, in this repository, more than once. */
  claim(reasons.length <= 1, c.id + ' — p1a is immune for AT MOST ONE reason',
    'reasons: ' + JSON.stringify(reasons) + '   (two reasons and the arm proves nothing about either)');
  claim(prepared(sdL) === c.vanish && prepared(meL) === c.vanish,
    c.id + ' — the vanish is ' + (c.vanish ? 'ON' : 'OFF') + ' in BOTH engines',
    'showdown -prepare: ' + prepared(sdL) + '   medicham -prepare: ' + prepared(meL));
  claim(sdO === c.want, c.id + ' — THE AUTHORITY does what this arm was written for',
    'expected ' + c.want + ', showdown gave ' + sdO
      + (sdO === c.want ? '' : '   — the fixture premise is wrong, not the engine'));

  /* UNDER --red THE LIVE ARMS MUST PART AND THE CONTROLS MUST NOT. Read the other way round so a
     knob that silently did nothing cannot pass this file. */
  const agree = sdO === meO;
  const want = RED ? !c.live : true;
  claim(agree === want,
    c.id + ' — the two engines reach the same OUTCOME'
      + (RED ? (c.live ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    'showdown ' + sdO + '  vs  medicham ' + meO);
}

/* ---- THE ENGINE'S OWN RECEIPT ------------------------------------------------------------------
 * A capability that cannot prove it ran is assumed broken. `noGuardThroughInvuln` counts the bodies
 * this wire actually carried through step 0 — exactly THREE on the clean arm (A, B and F; C has no
 * No Guard and D has no vanish), and exactly ZERO under the knob. Asserted at equality, never at
 * `>= 1`, which is the shape that has left three counters in this repo blind by construction. */
const through = (M.MEDSEEN.noGuardThroughInvuln || 0) - seenBefore.through;
if (RED) {
  claim((M.MEDFAILS.noGuardInvulnBlindRestored || 0) === 1,
    'the revert knob was actually READ by the engine',
    'MEDFAILS.noGuardInvulnBlindRestored = ' + (M.MEDFAILS.noGuardInvulnBlindRestored || 0)
      + '  (a 0 here means the arms above parted for some other reason)');
  claim(through === 0, 'nothing was carried through the vanish under the revert',
    'MEDSEEN.noGuardThroughInvuln = ' + through);
} else {
  claim((M.MEDFAILS.noGuardInvulnBlindRestored || 0) === 0,
    'no revert knob is in play on the clean arm',
    'MEDFAILS.noGuardInvulnBlindRestored = ' + (M.MEDFAILS.noGuardInvulnBlindRestored || 0));
  claim(through === 3,
    'the wire carried exactly 3 bodies through the vanish — arms A, B and F, one each',
    'MEDSEEN.noGuardThroughInvuln = ' + through
      + '  (a 4 means control C or D went through it too; a 2 means one of the three call sites is '
      + 'still blind — the non-attack branch is the one that hides)');
}

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed over ' + ran + ' staged turns'
                        : 'GREEN — every claim held over ' + ran + ' staged turns'));
process.exit(fails ? 1 : 0);
