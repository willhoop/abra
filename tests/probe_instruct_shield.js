/* probe_instruct_shield.js — INSTRUCT NEVER ASKED THE SHIELD, AND A SHIELD REFUSES IT. 2026-08-27,
 * extended and turned green 2026-08-29 (ROADMAP #532).
 *
 *   SHOWDOWN_PATH=... node tests/probe_instruct_shield.js
 *   SHOWDOWN_PATH=... node tests/probe_instruct_shield.js --release <id> --only instruct-foe-protect
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * CHAMPIONS DOES NOT REWRITE INSTRUCT, and that was checked rather than assumed, because tonight's
 * Encore batch turned on the opposite answer. `data/mods/champions/moves.ts` overrides 259 moves and
 * Instruct is not one of them; the ONLY mention of it anywhere under `data/mods/champions/` is
 * `learnsets.ts:12384`, `instruct: ["9M"]`. The handler is mainline's (`data/moves.ts:9644-9677`) and
 * is printed off the live format on every run below.
 *
 * Instruct carries `flags: { protect: 1, bypasssub: 1, allyanim: 1, failinstruct: 1 }` and
 * `category: "Status"`. So `checkMoveBypassesProtect` (`sim/battle.ts:1300-1302`) answers
 *
 *     if ((move.category !== 'Status' || blockStatus) && move.flags['protect'] &&
 *         this.runEvent('HitProtect', attacker, defender, move)) return false;
 *
 * with `blockStatus` at its default `true`, so `protect.condition.onTryHit` (`data/moves.ts:13987`)
 * does NOT return early: it writes `this.add('-activate', target, 'move: Protect')` and returns
 * `this.NOT_FAIL`. Instruct's `onHit` — which is where the second action is queued — is never
 * reached, because `hitStepTryHitEvent` filters the target out at step 2 of eight.
 *
 * THE SHIELD IS A SEPARATE QUESTION FROM INSTRUCT'S OWN REFUSAL LIST, AND IT IS ASKED FIRST. The
 * list lives inside `onHit` and is never consulted on a shielded target:
 *
 *     if (!target.lastMove || target.volatiles['dynamax']) return false;
 *     if (lastMove.flags['failinstruct'] || lastMove.isZ || lastMove.isMax ||
 *         lastMove.flags['charge'] || lastMove.flags['recharge'] ||
 *         target.volatiles['beakblast'] || target.volatiles['focuspunch'] ||
 *         target.volatiles['shelltrap'] || (moveSlot && moveSlot.pp <= 0)) return false;
 *
 * AND THE SHIELD ALSO OUTRANKS GOOD AS GOLD. Both answer in the same `TryHit` event;
 * `protect.condition` declares `onTryHitPriority: 3` and the ability declares no priority, so the
 * shield's handler runs first and its `NOT_FAIL` (`''`, falsy) breaks the event before the ability is
 * reached. `instruct-foe-goodasgold-protect` is that arm, and it is RED rather than argued.
 *
 * STAGED, NOT ARGUED. Oranguru is the ONLY legal Instruct user in this regulation (derived below).
 * The authority, `gen9championsvgc2026regmb`, seed [1,2,3,4]:
 *
 *     |move|p2a: Oranguru|Instruct|p1a: Alakazam
 *     |-activate|p1a: Alakazam|move: Protect            <- a FOE'S shield
 *
 *     |move|p2a: Oranguru|Instruct|p2b: Garchomp
 *     |-activate|p2b: Garchomp|move: Protect            <- an ALLY'S shield, identically
 *
 * against the unshielded control, which is what the line looks like when it works:
 *
 *     |move|p2a: Oranguru|Instruct|p2b: Garchomp
 *     |-singleturn|p2b: Garchomp|move: Instruct|[of] p2a: Oranguru
 *     |move|p2b: Garchomp|Rock Slide|...               <- the SECOND action
 *
 * THERE IS NO ALLY EXCEPTION. `checkMoveBypassesProtect` never looks at sides, and the ally arm above
 * is the measurement of that rather than a reading of the source. It is the commoner board by far and
 * IT CANNOT BE STAGED HERE — the driver's script format resolves a `normal` move to `foes[t]` on both
 * sides (`engine/game_differential.js:4281` and `:5521`), so an ally-aimed `normal` move is
 * inexpressible. Every arm below therefore aims Instruct at a FOE, which the authority treats
 * identically, and the ally half is OWED.
 *
 * ================= HOW MANY MOVES MAKE ANOTHER BODY ACT — DERIVED, ONE ==========================
 *
 * Printed on every run. Of every LEGAL move in this format whose handler touches the action queue,
 * exactly ONE builds a NEW action for another body — `queue.resolveAction({ choice: 'move',
 * pokemon: target, ... })` — and that is Instruct. After You, Quash and Round only REORDER an action
 * that already exists, and After You carries no `protect` flag at all, so a shield cannot reach it.
 * The population is derived here rather than named, so a later addition is picked up without an edit.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * The `instruct` branch checked Good as Gold, Instruct's own `refuses` list, `_charging` and
 * `_recharge`, and called `shieldRefuses` NOWHERE — the fourteenth caller of a function thirteen
 * sites already read. It was not a misplaced announcement like the seven sites closed under ROADMAP
 * #508; it was a MISSING CALLER, and what came out of it was an EXTRA ACTION:
 * `acts.splice(actIdx+1, 0, _entry)` put a second click into a turn the authority never gave one to.
 * `MEDSEEN.instructRepeat` counts it and `MEDSEEN.instructRefusedByShield` counts the refusal, so
 * "the streams parted" and "a second action happened" stay two separate observations.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line: both engines play the same script under the differential's own
 * pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE EXPECTATION.
 * `MEDI_INSTRUCT_NO_SHIELD=1` is the revert knob — it skips the new ask and restores exactly the
 * pre-change behaviour — so a RED arm is one that agrees clean and PARTS under the knob, and a
 * CONTROL is one that agrees under BOTH. The knob is proved to have reached the module the driver
 * played, by a load-time stamp in `MEDFAILS`, before any verdict is read.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* ---- THE RELEASE, AND WHY THE OLD REFUSAL IS REPLACED RATHER THAN RELAXED. 2026-08-29 -----------
 *
 * This file used to exit 2 unless it was handed `--release <id>`, and the reason it gave was DATED:
 * "the tree it would freeze is being edited by another agent". That was true on 2026-08-27 and it is
 * not a property of the check. What it cost is that this probe had NO RUNNER — a `VERIFIED BY` marker
 * would have to name a literal release id, which strands the moment the id ages out (LESSONS §12), so
 * the three red arms below could only ever be DEBT in the register instead of evidence.
 *
 * The hazard the refusal was about is real and is answered by the mechanism its SIBLING already uses
 * — `tests/probe_shield_refusal_line.js`, the other half of this same shield family. Preloading
 * `tests/_live_release.js` redirects `cut`/`open` to a throwaway store under the OS temp directory, so
 * a bare run freezes the LIVE tree and `data/releases/` and `data/engine-release.json` are never
 * written. It must be required BEFORE `engine_release.js` is, and it announces itself on stderr, so a
 * run that used it cannot be mistaken for one that did not. `--release <id>` still wins when given,
 * which is what a published measurement must use — a scratch id is not reproducible. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_instruct_shield.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_INSTRUCT_NO_SHIELD';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- SCENARIO SUGAR ---------------------------------------------------------------------------
 * ONE TURN unless an arm says otherwise. Every shield here is priority +4 and every filler slot
 * clicks Protect, so `willAct()` is true for all of them and the shields are standing before Instruct
 * resolves at priority 0. Instruct is then the LAST action of the turn, which is load-bearing for the
 * Endure control below: the repeat it produces meets `willAct() === false` and is refused with no
 * stall die drawn on either side, so that arm is decided by the game and not by a roll. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const CM = { m: 'calmmind' };
const WALL_A = [['milotic', '', 'Marvel Scale', ['Protect']], ['snorlax', '', 'Thick Fat', ['Protect']]];
const WALL_B = [['toxapex', '', 'Regenerator', ['Protect']], ['corviknight', '', 'Pressure', ['Protect']]];
/* THE MOVER IS THE SAME IN EVERY ARM. Oranguru is the only legal Instruct user in this regulation
 * (derived and printed below), and Inner Focus rather than Telepathy or Symbiosis so nothing on the
 * mover's side can absorb, redirect or re-target anything. */
const ORA = ['oranguru', '', 'Inner Focus', ['Instruct', 'Protect']];
const B_SIDE = [ORA, ['garchomp', '', 'Rough Skin', ['Protect']]].concat(WALL_B);
const INS = { m: 'instruct', t: 0 };
const AT = p1aClick => [{ p1: [p1aClick, PROT], p2: [INS, PROT] }];
const PARTNER = ['clefable', '', 'Unaware', ['Protect']];
const SIDE_A = lead => [lead, PARTNER].concat(WALL_A);

const CASES = [
  /* ---- THE RED ARMS: a shield is up, `blocksStatus` is true, and the authority refuses --------- */
  { id: 'instruct-foe-protect', kind: 'red',
    A: SIDE_A(['alakazam', '', 'Inner Focus', ['Protect', 'Calm Mind']]),
    script: AT(PROT), last: 'protect', repClean: 0, repKnob: 1, refClean: 1,
    what: 'THE MOVE, THE SHIELD EVERYBODY CLICKS (149,746 sheet slots). Alakazam Inner Focus: not '
        + 'Gholdengo (that is its own arm below), and its last move is Protect, which carries no '
        + '`failinstruct` — so Instruct has exactly one reason to be refused and it is the shield.' },

  { id: 'instruct-foe-spikyshield', kind: 'red',
    A: SIDE_A(['chesnaught', '', 'Bulletproof', ['Spiky Shield', 'Iron Defense']]),
    script: AT({ m: 'spikyshield' }), last: 'spikyshield', repClean: 0, repKnob: 1, refClean: 1,
    what: 'THE SAME RULE THROUGH A SECOND MEMBER OF THE SHIELD FAMILY, so the arm above cannot be '
        + 'read as being about the move `protect`. `shieldsUser.blocksStatus` is true for Spiky '
        + 'Shield (printed below, off the artifact) and Spiky Shield carries no `failinstruct`.' },

  { id: 'instruct-foe-banefulbunker', kind: 'red',
    A: SIDE_A(['toxapex', '', 'Regenerator', ['Baneful Bunker', 'Recover']]),
    script: AT({ m: 'banefulbunker' }), last: 'banefulbunker', repClean: 0, repKnob: 1, refClean: 1,
    what: 'A THIRD MEMBER, and the one whose own effect (poison on contact) cannot fire against a '
        + 'Status move — so if this arm parts it is the refusal and not the bunker\'s payload.' },

  { id: 'instruct-foe-detect', kind: 'red',
    A: SIDE_A(['espeon', '', 'Synchronize', ['Detect', 'Calm Mind']]),
    script: AT({ m: 'detect' }), last: 'detect', repClean: 0, repKnob: 1, refClean: 1,
    what: 'THE FOURTH AND LAST MEMBER WITH `blocksStatus === true` (5,554 sheet slots), so all four '
        + 'refusing members of the family are staged and the rule cannot be a property of any one of '
        + 'them. Synchronize rather than Magic Bounce deliberately — a bouncing target would send '
        + 'Instruct back at the mover and this arm would be measuring the wrong mechanic.' },

  { id: 'instruct-foe-goodasgold-protect', kind: 'red',
    A: SIDE_A(['gholdengo', '', 'Good as Gold', ['Protect', 'Nasty Plot']]),
    script: AT(PROT), last: 'protect', repClean: 0, repKnob: 0, refClean: 1,
    expectReasons: ['ability:refusesStatusMoves'],
    what: 'THE ORDER, AND IT IS THE ARM THAT DECIDES WHERE THE NEW CALL GOES. Both refusals answer '
        + 'in the same `TryHit` event; `protect.condition` declares `onTryHitPriority: 3` and Good as '
        + 'Gold declares none, so the SHIELD answers first and its `NOT_FAIL` breaks the event — the '
        + 'authority writes `|-activate|move: Protect` and never `|-immune|ability: Good as Gold`. '
        + 'This is the ONE arm that qualifies for two refusals on purpose, because which one is '
        + 'announced IS the question. Under the knob it parts WITHOUT an extra action (repeat 0), '
        + 'which is why `repKnob` is declared per arm rather than assumed to be 1 on every red.' },

  /* ---- THE CONTROLS ---------------------------------------------------------------------------
   * Seven, and every one of them is a way the new caller could over-fire. A fix that starts refusing
   * has to be shown NOT to refuse where the authority does not. */
  { id: 'instruct-foe-kingsshield', kind: 'control',
    A: SIDE_A(['aegislash', '', 'Stance Change', ["King's Shield", 'Iron Defense']]),
    script: AT({ m: 'kingsshield' }), last: 'kingsshield', repClean: 0, repKnob: 0, refClean: 0,
    expectReasons: ['instruct:lastMoveRefused'],
    what: 'THE OVER-FIRE CONTROL, AND IT IS A SHIELD THAT IS UP. King\'s Shield is the ONE member of '
        + 'the family with `shieldsUser.blocksStatus === false` (derived, printed below), so '
        + '`checkMoveBypassesProtect` returns TRUE for a Status move and `protect.condition.onTryHit` '
        + 'returns early — the shield does not refuse Instruct at all. Instruct then fails for its '
        + 'OWN reason, because King\'s Shield is the one shield carrying `failinstruct`, and the '
        + 'authority writes `|-fail|<the MOVER>`. A fix that announced `|-activate|move: Protect` '
        + 'whenever `t.protect` was true would pass all five red arms and BREAK THIS ONE — which is '
        + 'the derived reason the patch reads `shieldRefuses` rather than `t.protect`.' },

  { id: 'instruct-foe-noshield', kind: 'control',
    A: SIDE_A(['alakazam', '', 'Inner Focus', ['Protect', 'Calm Mind']]),
    script: AT(CM), last: 'calmmind', repClean: 1, repKnob: 1, refClean: 0,
    what: 'THE SHIELD CLEARED EXPLICITLY — the identical board and the identical Instruct with Calm '
        + 'Mind clicked instead of Protect. Alakazam outspeeds Oranguru, so it really has a last '
        + 'move and the second Calm Mind really resolves in both engines. THIS IS THE ARM THAT MAKES '
        + 'THE OTHERS MEAN ANYTHING: without it, "Instruct ignores the shield" and "Instruct is dead '
        + 'in this engine" produce the same red arms. It asserts the repeat at EXACTLY 1, so a patch '
        + 'that fixed the shield by refusing every Instruct fails here.' },

  { id: 'instruct-foe-goodasgold-noshield', kind: 'control',
    A: SIDE_A(['gholdengo', '', 'Good as Gold', ['Protect', 'Nasty Plot']]),
    script: AT({ m: 'nastyplot' }), last: 'nastyplot', repClean: 0, repKnob: 0, refClean: 0,
    expectReasons: ['ability:refusesStatusMoves'],
    what: 'THE SAME BODY AS THE ORDER ARM WITH THE SHIELD TAKEN AWAY, so the pair separates the two '
        + 'refusals on ONE fixture. Good as Gold still answers (ROADMAP #161, `-immune`), the new '
        + 'call must not touch it, and `instructRefusedByShield` must read 0 — an engine that started '
        + 'attributing the ability refusal to the shield would still agree with the authority on the '
        + 'protocol line and would be caught only by the counter.' },

  { id: 'instruct-foe-shield-expired', kind: 'control',
    A: SIDE_A(['alakazam', '', 'Inner Focus', ['Protect', 'Calm Mind']]),
    script: [{ p1: [PROT, PROT], p2: [PROT, PROT] }, { p1: [CM, PROT], p2: [INS, PROT] }],
    last: 'calmmind', repClean: 1, repKnob: 1, refClean: 0,
    what: 'THE STALE-SHIELD CONTROL, AND IT IS THE ONE THIS FIX COULD PLAUSIBLY HAVE BROKEN. Turn 1 '
        + 'the target really does raise Protect; turn 2 it clicks Calm Mind and is Instructed. If '
        + '`mon.protect` survived the turn boundary the new call would refuse a repeat the authority '
        + 'grants, and this arm would part while every red arm stayed green. Two turns, so it is also '
        + 'the only arm here that exercises the branch on a board that is not turn 1.' },

  { id: 'instruct-foe-endure', kind: 'control',
    A: SIDE_A(['alakazam', '', 'Inner Focus', ['Endure', 'Calm Mind']]),
    script: AT({ m: 'endure' }), last: 'endure', repClean: 1, repKnob: 1, refClean: 0,
    what: 'A STALLING MOVE THAT IS NOT A SHIELD. Endure is `stallingMove: true` and shares protect\'s '
        + '`onPrepareHit` byte for byte, and it blocks NOTHING — it carries no `onTryHit`, and #178 '
        + 'took it out of `shieldsUser` for that reason. A fix keyed on membership of the stalling '
        + 'family instead of on `shieldsUser` would refuse here and the authority does not. Endure '
        + 'carries no `failinstruct` either, so the repeat is GRANTED and is a second Endure — which '
        + 'meets `willAct() === false`, because Instruct at priority 0 is the last action of the '
        + 'turn, so it is refused with no stall die drawn on either side.' },

  { id: 'instruct-foe-nolastmove', kind: 'control',
    A: SIDE_A(['reuniclus', '', 'Overcoat', ['Calm Mind', 'Protect']]),
    script: AT(CM), last: null, repClean: 0, repKnob: 0, refClean: 0,
    expectReasons: ['instruct:noLastMove'],
    what: 'THE OTHER REFUSAL IN `onHit`, WITH NO SHIELD ANYWHERE. Reuniclus is base 30 and Oranguru '
        + 'is base 60, so at the instant Instruct resolves the target has not moved this turn and has '
        + 'no last move at all — `if (!target.lastMove) return false`, and the authority writes '
        + '`|-fail|<the MOVER>`. The new call must leave that path exactly as it was. Overcoat rather '
        + 'than Magic Guard or Regenerator: all three are inert on this board and Overcoat is slot 0.' },

  { id: 'instruct-foe-damaging-repeat', kind: 'control',
    A: SIDE_A(['alakazam', '', 'Inner Focus', ['Dazzling Gleam', 'Calm Mind']]),
    script: AT({ m: 'dazzlinggleam' }), last: 'dazzlinggleam', repClean: 1, repKnob: 1, refClean: 0,
    what: 'THE REPEAT THAT ACTUALLY COSTS HP. Every other granted repeat here is a boost or a '
        + 'refusal, so an engine that granted the second action and then dropped it on the floor '
        + 'would look identical. Dazzling Gleam is accuracy 100, so the `top-tie-first` arm\'s "every '
        + 'SUB-100 move misses" cannot decide it, and the damage index is pinned — the volley lands '
        + 'twice in both engines and the boards have to match after each. It is also a SPREAD move '
        + '(`allAdjacentFoes`), which is deliberate: it carries no aim for the repeat to re-pick, so '
        + 'this arm is about the damage and cannot be decided by the aim of the repeat.' },
  /* ---- WAS DECLARED KNOWN-OPEN, AND IS NOW A COUNTED CONTROL ------------------------------------
   * ROADMAP #534 was FOUND by this arm on 2026-08-29 and fixed in the batch immediately after. The
   * arm is PROMOTED rather than deleted, and rather than left excluded: an exclusion that outlives
   * the defect it names is the fourteen stale handoffs in a new costume, and the board is now the
   * sharpest control this file has for the OTHER fix — a repeat that goes back at the slot it was
   * aimed at, on a board where the WRONG slot is behind a Protect, so a regression in either
   * direction reds here. `tests/probe_instruct_target.js` is where the aim itself is proved. */
  { id: 'instruct-foe-singletarget-repeat', kind: 'control',
    A: SIDE_A(['alakazam', '', 'Inner Focus', ['Psychic', 'Calm Mind']]),
    script: AT({ m: 'psychic', t: 0 }), last: 'psychic', repClean: 1, repKnob: 1, refClean: 0,
    what: 'THE SINGLE-TARGET REPEAT, AND IT IS THE BOARD ROADMAP #534 WAS FILED ON. Alakazam aims '
        + 'Psychic at foe slot 0 (Oranguru) and is Instructed; the authority builds the second '
        + 'action with `targetLoc: target.lastMoveTargetLoc` (`data/moves.ts:9670`) and hits '
        + 'Oranguru twice. Until #534 landed this engine re-ran `targetForMove`, sent the repeat '
        + 'into the Garchomp in slot 1 and ate its Protect — board-material — and it parted '
        + 'IDENTICALLY under `MEDI_INSTRUCT_NO_SHIELD=1`, which is what said it was a second '
        + 'defect rather than this file. It now agrees on both loads and is COUNTED.' },
];

/* ---- LEGALITY, DERIVED ------------------------------------------------------------------------- */
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
for (const c of CASES) for (const row of c.A.concat(B_SIDE)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) {
    console.log('ILLEGAL FIXTURE  ' + row[1] + ' is not in this format'); illegal++;
  }
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

/* ---- THE POPULATION, DERIVED ON EVERY RUN ------------------------------------------------------ */
const TAGS = require(REL.path('data/tags.json'));
const users = dex.species.all().filter(legal)
  .filter(s => { const e = LS[s.id]; return e && e.learnset && e.learnset.instruct; }).map(s => s.name);
console.log('LEGAL INSTRUCT USERS IN ' + CS.FORMAT + ': ' + (users.join(', ') || '(NONE)'));
if (!users.length) { console.log('NOT RUN — nothing in this format learns Instruct.'); process.exit(2); }
const IM = dex.moves.get('instruct');
console.log('instruct.flags = ' + JSON.stringify(IM.flags) + '   category = ' + IM.category
  + '   -> a shield can refuse it? ' + !!IM.flags['protect']
  + '   corpus uses (SHEET SLOTS, not clicks) = ' + ((TAGS.moves.instruct || {}).uses || 0));
if (!IM.flags['protect']) {
  console.log('NOT RUN — Instruct does not carry the protect flag in this format, so this file '
    + 'proves nothing.'); process.exit(2);
}

/* HOW MANY LEGAL MOVES MAKE ANOTHER BODY ACT? Derived from the handlers themselves — the mainline
 * source overlaid by the Champions mod, so a move Champions REPLACES is read in its Champions shape.
 * A move that builds a NEW action for another body is `resolveAction({ choice: 'move', pokemon: ... })`;
 * everything else in the family only moves an action that already exists. If this ever prints more
 * than one name, the fix below has a sibling site and this file will say so. */
{
  const fs = require('fs'), SP = process.env.SHOWDOWN_PATH;
  const blocks = txt => {
    const out = {}; let cur = null, buf = [];
    for (const L of txt.split(/\r?\n/)) {
      const z = /^\t([a-z0-9]+): \{/.exec(L);
      if (z) { if (cur) out[cur] = buf.join(NL); cur = z[1]; buf = [L]; } else if (cur) buf.push(L);
    }
    if (cur) out[cur] = buf.join(NL);
    return out;
  };
  const MB = blocks(fs.readFileSync(path.join(SP, 'data', 'moves.ts'), 'utf8'));
  const CB = blocks(fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8'));
  const extra = [], reorder = [];
  for (const id of new Set(Object.keys(MB).concat(Object.keys(CB)))) {
    const mv = dex.moves.get(id);
    if (!legal(mv)) continue;
    const body = CB[id] || MB[id] || '';
    const row = mv.name + (mv.flags['protect'] ? ' [a shield can refuse it]' : ' [no protect flag]')
      + (CB[id] ? ' [CHAMPIONS OVERRIDES THIS MOVE]' : '');
    if (/resolveAction/.test(body)) extra.push(row);
    else if (/prioritizeAction|willMove\(|queue\.(insertChoice|changeAction|cancelMove)/.test(body)) reorder.push(row);
  }
  console.log(NL + 'LEGAL MOVES THAT GIVE ANOTHER BODY AN EXTRA ACTION (resolveAction): '
    + extra.length + '  -> ' + extra.join(' ; '));
  console.log('LEGAL MOVES THAT ONLY REORDER AN EXISTING ACTION: ' + reorder.length
    + '  -> ' + reorder.join(' ; '));
  console.log('DOES CHAMPIONS REWRITE INSTRUCT? ' + (CB['instruct'] ? 'YES' : 'NO')
    + '   (champions overrides ' + Object.keys(CB).length + ' moves)');
  if (extra.length !== 1 || !/^Instruct/.test(extra[0])) {
    console.log('NOT RUN — the extra-action population is no longer Instruct alone. This file covers '
      + 'one site and the derivation says there are ' + extra.length + '.');
    process.exit(2);
  }
}

console.log(NL + 'THE SHIELD FAMILY, off `shieldsUser` in this release\'s data/tags.json:');
for (const m of dex.moves.all().filter(legal).filter(m => m.stallingMove)) {
  const p = (TAGS.moves[m.id] || {}).params && TAGS.moves[m.id].params.shieldsUser;
  console.log('  ' + m.id.padEnd(15) + (p ? 'blocksStatus=' + p.blocksStatus : 'NO shieldsUser param — not a shield here')
    + '   failinstruct=' + !!m.flags['failinstruct'] + '   uses=' + ((TAGS.moves[m.id] || {}).uses || 0));
}

/* HOW MANY REASONS IS INSTRUCT REFUSED FOR, NOT COUNTING THE SHIELD? A fixture that qualifies twice
 * proves nothing about either — EXCEPT on `instruct-foe-goodasgold-protect`, where which refusal is
 * announced is the whole question and the second reason is DECLARED. Derived from the artifact's own
 * `instructsTarget` params and from the abilities tag table, never from a list of names. */
const IP = ((TAGS.moves.instruct || {}).params || {}).instructsTarget || {};
function refusalReasons(c) {
  const [, , tAb] = c.A[0];
  const tA = dex.abilities.get(tAb);
  const out = [];
  const abRow = TAGS.abilities && TAGS.abilities[tA.id];
  if (abRow && (abRow.tags || []).includes('refusesStatusMoves')) out.push('ability:refusesStatusMoves');
  /* `last` is the target's last move at the instant Instruct resolves, declared per arm — for every
   * shield arm that is the shield click itself, because every shield here is priority +4. */
  if (!c.last) { out.push('instruct:noLastMove'); return out; }
  if ((IP.refuses || []).includes(c.last)) out.push('instruct:lastMoveRefused');
  const lm = dex.moves.get(c.last);
  if (lm.flags['charge'] || lm.flags['recharge']) out.push('instruct:chargeOrRecharge');
  return out;
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('top-tie-first');
  if (!arm) { console.log('NOT RUN — the driver has no arm named top-tie-first'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  const beforeF = Object.assign({}, globalThis.MEDFAILS || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(B_SIDE));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_instruct_shield :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {}, afterF = globalThis.MEDFAILS || {};
  const delta = {}, deltaF = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  for (const k of Object.keys(afterF)) if (typeof afterF[k] === 'number') deltaF[k] = afterF[k] - (beforeF[k] || 0);
  return { r, delta, deltaF, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).instructNoShieldRestored || 0 };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  const short = clean.r.turns < c.script.length || brk.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const reasons = refusalReasons(c);
  const wantR = (c.expectReasons || []).slice().sort().join(',');
  const gotR = reasons.slice().sort().join(',');
  const R = { c, clean, brk, short, refused, reasons, reasonsOk: wantR === gotR,
    rep: clean.delta.instructRepeat || 0, repK: brk.delta.instructRepeat || 0,
    ref: clean.delta.instructRefusedByShield || 0, refK: brk.delta.instructRefusedByShield || 0,
    unknown: (clean.deltaF.shieldBlocksStatusUnknown || 0) };
  results.push(R);

  if (short || refused) { bad++; R.fail = 'FIXTURE'; continue; }
  const fails = [];
  /* A KNOWN-OPEN ARM IS STILL FULLY ASSERTED ON THE THING THIS BATCH LANDED — its shield counters
   * must be exact and the knob must still bind — and only its PROTOCOL verdict is uncounted, because
   * the line it parts on belongs to ROADMAP #534. It is declared, printed, and excluded from `bad`
   * by name; it is not a red being carried. */
  const KNOWN = c.kind === 'known-open';
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED, or every verdict below is about one
   * engine loaded twice. */
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  if (wantR !== gotR) fails.push('an undeclared refusal reason — this arm proves nothing about either');
  /* THE BRANCH COUNTERS AT EXACT EQUALITY, both loads. `refClean` is what makes "the engines agree"
   * unreadable as "nothing happened", and the knob run must show the refusal at ZERO everywhere —
   * that is the revert being a revert. */
  if (R.rep !== c.repClean) fails.push('instructRepeat clean is ' + R.rep + ', declared ' + c.repClean);
  if (R.repK !== c.repKnob) fails.push('instructRepeat knob is ' + R.repK + ', declared ' + c.repKnob);
  if (R.ref !== c.refClean) fails.push('instructRefusedByShield clean is ' + R.ref + ', declared ' + c.refClean);
  if (R.refK !== 0) fails.push('instructRefusedByShield under the knob is ' + R.refK + ', must be 0');
  /* A SHIELD WHOSE `blocksStatus` COULD NOT BE READ IS TREATED AS BLOCKING, i.e. as a silent default.
   * Asserted at exact zero so this file cannot pass through one. */
  if (R.unknown !== 0) fails.push('shieldBlocksStatusUnknown fired ' + R.unknown + ' time(s) — a '
    + 'shield param could not be read and the answer was defaulted');
  /* AND THE PROTOCOL STREAMS. Clean: every arm agrees with the authority. Knob: a red arm must part
   * (or it proves nothing) and a control must not (or the change is not confined). */
  if (!KNOWN && clean.r.div) fails.push('the engines part on the CLEAN load');
  if (c.kind === 'red' && !brk.r.div) fails.push('the knob did not move the outcome — this arm proves nothing');
  if (c.kind === 'control' && brk.r.div) fails.push('OVER-FIRE — a control moved under the knob');
  /* THE KNOWN-OPEN ARM MUST PART THE SAME WAY ON BOTH LOADS. If the knob ever moved it, the parting
   * would be THIS batch's and the exclusion would be laundering a red. Asserted, not assumed. */
  if (KNOWN) {
    const same = !!clean.r.div && !!brk.r.div && clean.r.div.index === brk.r.div.index
      && clean.r.div.sdRaw === brk.r.div.sdRaw && clean.r.div.meRaw === brk.r.div.meRaw;
    if (!same) fails.push('the KNOWN-OPEN arm does not part identically clean and under the knob, so '
      + 'its parting is NOT independent of this batch and may not be excluded');
  }
  if (fails.length) bad += 1;
  R.fails = fails;
  R.known = KNOWN;
}

for (const R of results) {
  const { c, clean, brk, short, refused, reasons, rep, repK, ref, refK } = R;
  const verdict = short ? 'SHORT        ' : refused ? 'CLICK REFUSED'
    : (R.fails && R.fails.length) ? 'FAIL         '
    : c.kind === 'known-open' ? 'KNOWN-OPEN   '
    : c.kind === 'red' ? 'RED PROVEN   ' : 'CONTROL HELD ';
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    refusal reasons for the target against Instruct, NOT counting the shield: '
    + (reasons.length ? reasons.join(', ') : '(none)')
    + '   [declared: ' + ((c.expectReasons || []).join(', ') || 'none') + ']');
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    counters       instructRepeat ' + rep + '/' + c.repClean + ' clean, '
    + repK + '/' + c.repKnob + ' knob   |   instructRefusedByShield ' + ref + '/' + c.refClean
    + ' clean, ' + refK + '/0 knob   |   shieldBlocksStatusUnknown ' + R.unknown);
  console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored);
  const d = brk.r.div || clean.r.div;
  if (d) {
    console.log('    ' + (clean.r.div ? 'CLEAN' : 'KNOB') + ' parted:');
    console.log('      showdown  ' + d.sdRaw);
    console.log('      medicham  ' + d.meRaw);
    console.log('      showdown next  ' + JSON.stringify(d.sdAfterRaw.slice(0, 4)));
    console.log('      medicham next  ' + JSON.stringify(d.meAfterRaw.slice(0, 4)));
  }
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
  for (const f of (R.fails || [])) console.log('    >> FAIL: ' + f);
}

const nKnown = results.filter(r => r.known).length;
console.log(NL + ran + ' arms staged, ' + bad + ' failing, ' + nKnown
  + ' KNOWN-OPEN (declared, not counted)   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT — '
  + 'the other arms did not run, and the claims below are only true of a full run.'
  : 'PASS — a shield refuses Instruct and the engine says so, all four '
  + '`blocksStatus` members and the Good-as-Gold ordering board included; the knob puts every red arm '
  + 'back apart and moves no control; King\'s Shield still fails on Instruct\'s own `failinstruct`, a '
  + 'shield that has expired still grants the repeat, and Endure — a stalling move that is not a '
  + 'shield — is not refused');
process.exit(bad ? 1 : 0);
