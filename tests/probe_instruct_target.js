/* probe_instruct_target.js — THE INSTRUCTED REPEAT RE-PICKS ITS TARGET INSTEAD OF REUSING THE SLOT
 * THE MOVE WAS AIMED AT. ROADMAP #534. Written 2026-08-29.
 *
 *   SHOWDOWN_PATH=... node tests/probe_instruct_target.js
 *   SHOWDOWN_PATH=... node tests/probe_instruct_target.js --only aim-slot0-damaging
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * CHAMPIONS REWRITES NONE OF THIS, and it is checked on every run rather than remembered. The mod
 * overrides 259 moves and Instruct is not among them (`data/mods/champions/moves.ts`); its
 * `scripts.ts` overrides `init`, `statModify`, `calculatePP`, five `pokemon` members and five
 * `actions` members — `getActionSpeed`, `formeChange`, `clearVolatile`, `canTerastallize`,
 * `canMegaEvo`, `modifyDamage`, `spreadMoveHit`, `hitStepMoveHitLoop` — and NOT `runMove`, NOT
 * `getTarget`, NOT `getRandomTarget`, NOT `resolveAction`, NOT `moveUsed`. All five are printed off
 * the mod's own source below, so this cannot go stale the way a hand-maintained list does.
 *
 * INSTRUCT BUILDS THE SECOND ACTION AT A SLOT, NOT AT A BODY (`data/moves.ts:9666-9671`):
 *
 *     this.queue.prioritizeAction(this.queue.resolveAction({
 *       choice: 'move', pokemon: target, moveid: target.lastMove.id,
 *       targetLoc: target.lastMoveTargetLoc,
 *     }));
 *
 * `lastMoveTargetLoc` is written by `Pokemon#moveUsed(move, targetLoc)` (`sim/pokemon.ts:919`), whose
 * ONE caller is `runMove` (`sim/battle-actions.ts:291`) and whose `targetLoc` argument is
 * `action.targetLoc` — the SIGNED relative slot the click named, positive for a foe and negative for
 * an ally (`Pokemon#getLocOf`, `sim/pokemon.ts:784`). It is recorded at the same instant as
 * `lastMove` and it is the raw choice: `OverrideAction` (Encore) and the `randomNormal` re-roll both
 * change which BODY is hit and neither writes back to `action.targetLoc`.
 *
 * ================= AND WHAT HAPPENS WHEN THE STORED POSITION IS VACATED =========================
 *
 * A stored `targetLoc` is a POSITION, so the authority has to say what it means when the position no
 * longer holds the body that was aimed at. It says so in `Battle#getTarget` (`sim/battle.ts:2434`),
 * which runs at RUN time — `runMove`'s first line — not when the action was built:
 *
 *     if (move.target !== 'randomNormal' && this.validTargetLoc(targetLoc, pokemon, move.target)) {
 *       const target = pokemon.getAtLoc(targetLoc);
 *       if (target?.fainted) {
 *         if (this.gameType === 'freeforall') return target;
 *         if (target.isAlly(pokemon)) { ... return target; }
 *       }
 *       if (target && !target.fainted) return target;      // <- the slot's CURRENT occupant
 *     }
 *     return this.getRandomTarget(pokemon, move);
 *
 * Three separate rules, and this file stages the first two:
 *   1. the slot's occupant is live  -> IT IS HIT, even if it is not the body that was aimed at;
 *   2. the occupant is a fainted FOE -> falls through to `getRandomTarget`, i.e. re-picked;
 *   3. a fainted ALLY is returned as-is and the move fails on it (the ally axis is OWED here — see
 *      the foot of this file — because the driver's script format cannot express an ally aim).
 *
 * `engine/medicham2-browser.js`'s `reaimToSlot` already implements exactly 1 and 2, off exactly this
 * source read, for the THIRTEEN callers that resolve a slot at execution. The fix wires the Instruct
 * branch into that one function rather than adding a second copy of the rule (CLAUDE.md: one fact,
 * one implementation).
 *
 * ================= WHAT THIS ENGINE DID ========================================================
 *
 * The `instruct` branch threw the aim away and picked again:
 *
 *     const _pick = targetForMove(t, _mid, live(_foes), field);
 *     const _na   = playerAction(t, _mid, (_pick && _pick.target) || live(_foes)[0] || null, field);
 *
 * TWO ROADS, AND THEY ARE WRONG IN DIFFERENT WAYS. `targetForMove` ranks foes by DAMAGE and hands
 * back the one the move hits hardest — a deterministic best-play choice the authority never makes.
 * And it opens `if (!mv || !hasPower(mv)) return null`, so for a single-target STATUS move it returns
 * nothing at all and the fallback `live(_foes)[0]` puts the repeat on FOE SLOT 0 every time. Both
 * roads are staged below, because a fix that only reused the aim for damaging moves would leave every
 * SINGLE-TARGET STATUS MOVE in the format pinned to slot 0 (the count is derived and printed on
 * every run; it is 73 today).
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line: both engines play the same script under the differential's own
 * pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE EXPECTATION.
 * `MEDI_INSTRUCT_NO_AIM_REUSE=1` is the revert knob — it skips the reuse and restores exactly the
 * pre-change re-pick — so a RED arm is one that agrees clean and PARTS under the knob, and a CONTROL
 * is one that agrees under BOTH. The knob is proved to have reached the module the driver played, by
 * a load-time stamp in `MEDFAILS`, before any verdict is read.
 *
 * WHICH SLOT THE OLD ROAD PREFERRED IS NEVER ASSERTED FROM A TYPED GUESS. The red arms are red
 * because the KNOB moves them, and the two `agree-` controls are controls because it does not. That
 * is the same instrument deciding both, so a damage heuristic that shifts under a later change
 * re-classifies the arm loudly instead of silently making it vacuous.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* The release shim, for the reason `tests/probe_instruct_shield.js` gives: a bare run must freeze the
 * LIVE tree into a throwaway store under the OS temp directory and must NOT write `data/releases/` or
 * `data/engine-release.json`. It must be required BEFORE `engine_release.js` is. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_instruct_target.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_INSTRUCT_NO_AIM_REUSE';

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

/* ---- THE BOARD --------------------------------------------------------------------------------
 * ONE TURN unless an arm says otherwise, and the geometry is fixed so that "slot 0" and "slot 1"
 * mean one thing throughout:
 *
 *     p1a  THE INSTRUCTED BODY          p2a  Oranguru      <- FOE SLOT 0, and the instructor
 *     p1b  an inert partner             p2b  the other foe <- FOE SLOT 1
 *
 * Oranguru is the ONLY legal Instruct user in this regulation (derived and printed below) and it
 * must be a FOE of the body it instructs, because the driver's script format resolves a `normal`
 * move to `foes[t]` on both sides — so foe slot 0 is always the instructor. Every arm therefore aims
 * at slot 0 or slot 1 of the SAME two-body side, which is what makes the two directions comparable.
 *
 * Inner Focus on Oranguru rather than Telepathy or Symbiosis, so nothing on the instructing side can
 * absorb, redirect or re-target anything. Keen Eye on Meowstic for the same reason: NOT Infiltrator,
 * which walks through a shield and would decide the shield arm by itself, and NOT Prankster, which
 * would move a status click into a different priority bracket. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const WALL_A = [['milotic', '', 'Marvel Scale', ['Protect']], ['snorlax', '', 'Thick Fat', ['Protect']]];
const WALL_B = [['toxapex', '', 'Regenerator', ['Protect']], ['corviknight', '', 'Pressure', ['Protect']]];
const ORA = ['oranguru', '', 'Inner Focus', ['Instruct', 'Protect']];
const PARTNER = ['clefable', '', 'Unaware', ['Protect']];
const INS = { m: 'instruct', t: 0 };
/* THE FILLER CLICK, AND IT IS AIMED ON PURPOSE. Foe slot 1 must be UNSHIELDED in most arms — the
 * whole point is that the mis-aimed repeat lands on it — so it cannot simply click Protect. It is
 * therefore aimed at p1b, which IS behind a Protect, so it does no damage, applies no boost and
 * cannot decide any arm. THE FIRST DRAFT HAD IT AIMED AT p1a AND THE MAX-DAMAGE CORNER KILLED THE
 * INSTRUCTED BODY: Instruct then retargeted to the shielded partner and three arms measured ROADMAP
 * #532 instead of this one. Caught by `instructRefusedByShield` reading 1 on an arm that declared 0,
 * which is why those counters are asserted per arm rather than summed. */
const FILL = { m: 'dragonclaw', t: 1 };

/* Two four-move sets on one body, because a set may hold four moves and this file needs five. */
const MEO_DMG = ['meowstic', '', 'Keen Eye', ['Psychic', 'Dark Pulse', 'Protect', 'Calm Mind']];
const MEO_STA = ['meowstic', '', 'Keen Eye', ['Charm', 'Psychic', 'Protect', 'Calm Mind']];
const CHAN_KO = ['chandelure', '', 'Flash Fire', ['Shadow Ball', 'Protect']];
const ALA_SPR = ['alakazam', '', 'Inner Focus', ['Dazzling Gleam', 'Calm Mind']];
const REU_SLOW = ['reuniclus', '', 'Overcoat', ['Calm Mind', 'Protect']];

const SIDE_A = lead => [lead, PARTNER].concat(WALL_A);
const B_PLAIN = [ORA, ['garchomp', '', 'Rough Skin', ['Protect', 'Dragon Claw']]].concat(WALL_B);
const B_SHIELD = [ORA, ['garchomp', '', 'Rough Skin', ['Protect']]].concat(WALL_B);
/* Banette is the body that DIES, and it is chosen for that: Ghost, base 64 HP / 63 SpD, so a STAB
 * Ghost Shadow Ball off Chandelure's 145 SpA at the max-damage corner takes it off the board in one.
 * Insomnia is slot 0 and is inert here. Base 65 Speed keeps it between Chandelure (80) and Oranguru
 * (60), so it has moved and the aim is genuinely recorded before it faints. */
const B_FRAIL = [ORA, ['banette', '', 'Insomnia', ['Protect', 'Shadow Ball']]].concat(WALL_B);

/* p1a's click, p1b passes-by-Protect, p2a Instructs p1a, p2b does whatever the arm says. */
const T1 = (click, p2b) => [{ p1: [click, PROT], p2: [INS, p2b || PROT] }];

const CASES = [
  /* ================= RED — the aim is thrown away and the second swing lands elsewhere ========== */
  { id: 'aim-slot0-damaging', kind: 'red', A: SIDE_A(MEO_DMG), B: B_PLAIN,
    script: T1({ m: 'psychic', t: 0 }, FILL),
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE PLAIN CASE, WITH NO SHIELD ANYWHERE ON THE BOARD, so it cannot be read as a second '
        + 'helping of ROADMAP #532. Meowstic aims Psychic at FOE SLOT 0 (Oranguru, which resists it) '
        + 'and is Instructed. The authority repeats Psychic into slot 0; this engine ranks the foes '
        + 'by damage, prefers slot 1, and puts the second swing there. BOARD-MATERIAL: the HP comes '
        + 'off a different body.' },

  { id: 'aim-slot1-damaging', kind: 'red', A: SIDE_A(MEO_DMG), B: B_PLAIN,
    script: T1({ m: 'darkpulse', t: 1 }, FILL),
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE SAME DEFECT RUNNING THE OTHER WAY, AND IT IS WHY THIS ARM EXISTS. Dark Pulse is '
        + 'super-effective on the Psychic-type Oranguru in slot 0 and neutral on the Garchomp in slot '
        + '1, so the damage heuristic prefers SLOT 0 here where it preferred SLOT 1 above. Aiming at '
        + 'slot 1 therefore reds in the opposite direction. Without this arm a fix that hard-coded '
        + '"repeat at slot 0" would pass every other red in the file.' },

  { id: 'aim-slot0-into-shield', kind: 'red', A: SIDE_A(MEO_DMG), B: B_SHIELD,
    script: T1({ m: 'psychic', t: 0 }, PROT),
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE BOARD ROADMAP #534 WAS FILED ON, restaged on this file\'s own geometry. The aim is '
        + 'slot 0 and slot 1 is behind a Protect, so the re-pick does not merely hit the wrong body — '
        + 'it EATS A SHIELD THAT WAS NEVER IN ITS WAY, and the authority\'s damage on slot 0 never '
        + 'happens at all. It is the sharpest signature of the defect and the reason it is board-'
        + 'material rather than narration.' },

  { id: 'aim-slot1-status', kind: 'red', A: SIDE_A(MEO_STA), B: B_PLAIN,
    script: T1({ m: 'charm', t: 1 }, FILL),
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE SECOND ROAD, AND IT IS A DIFFERENT LINE OF CODE. `targetForMove` opens `if (!mv || '
        + '!hasPower(mv)) return null`, so for a single-target STATUS move it answers nothing and the '
        + 'repeat falls to the literal `live(_foes)[0]` — FOE SLOT 0, unconditionally, for EVERY '
        + 'single-target status move in the format (73, derived and printed above). Charm is 100 accuracy and drops Attack by two stages, '
        + 'so the authority leaves slot 1 at -4 and this engine leaves slot 1 at -2 and slot 0 at -2. '
        + 'A fix that only reused the aim on the damaging road would pass all three arms above and '
        + 'fail here.' },

  { id: 'aim-slot1-status-shielded', kind: 'red', A: SIDE_A(MEO_STA), B: B_SHIELD,
    script: T1({ m: 'charm', t: 1 }, PROT),
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE STATUS ROAD WITH A SHIELD ON THE SLOT THE AIM NAMES. The first Charm is refused by '
        + 'slot 1\'s Protect and the repeat must be refused by it too; this engine sends the repeat '
        + 'at slot 0 instead and lands a stat drop the authority never applies. It separates "the '
        + 'repeat went to the wrong body" from "the repeat did nothing", which the arm above cannot '
        + 'do on its own.' },

  /* ================= CONTROLS — every way the reuse could over-fire ============================= */
  { id: 'agree-slot1-damaging', kind: 'control', A: SIDE_A(MEO_DMG), B: B_PLAIN,
    script: T1({ m: 'psychic', t: 1 }, FILL),
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE CASE WHERE REUSING AND RE-PICKING GIVE THE SAME ANSWER, and without it the red arms '
        + 'prove only that SOMETHING moved. Psychic aimed at slot 1 is also the slot the damage '
        + 'heuristic prefers, so the knob must not move this board at all — while `instructAimReused` '
        + 'still reads 1, which is what says the new road was TAKEN here rather than skipped.' },

  { id: 'agree-slot0-damaging', kind: 'control', A: SIDE_A(MEO_DMG), B: B_PLAIN,
    script: T1({ m: 'darkpulse', t: 0 }, FILL),
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE SAME AGREEMENT ON THE OTHER SLOT, so the pair covers both directions. Dark Pulse '
        + 'aimed at slot 0 is the heuristic\'s own pick. Taken with `agree-slot1-damaging` this says '
        + 'the reuse road can produce EITHER slot, which is the positive half of the claim the two '
        + 'directional red arms make negatively.' },

  { id: 'agree-slot0-status', kind: 'control', A: SIDE_A(MEO_STA), B: B_PLAIN,
    script: T1({ m: 'charm', t: 0 }, FILL),
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE STATUS ROAD WHERE THE OLD FALLBACK WAS ALREADY RIGHT. `live(_foes)[0]` is foe slot 0, '
        + 'so a Charm aimed at slot 0 was repeated correctly by accident. The knob must not move it, '
        + 'which is what separates "the status fallback was wrong" from "the status fallback was '
        + 'always wrong".' },

  { id: 'aimed-slot-vacated', kind: 'control', A: SIDE_A(CHAN_KO), B: B_FRAIL,
    script: T1({ m: 'shadowball', t: 1 }, { m: 'shadowball', t: 1 }),
    reuse: 0, vacated: 1, noslot: 0, repick: 0, rep: 1,
    what: 'THE FALLBACK, AND IT IS THE CASE THE SPLICE SITE\'S OWN COMMENT (ROADMAP #223) WAS '
        + 'WRITTEN FOR. Chandelure\'s STAB Ghost Shadow Ball takes the Banette in slot 1 off the '
        + 'board, and only THEN does Oranguru Instruct — so the stored position is vacated between '
        + 'the aim and the repeat. `getTarget` finds a fainted FOE at the loc, matches neither of its '
        + 'two special cases and falls through to `getRandomTarget`, which on a doubles side with one '
        + 'body left is not a die at all. `instructAimSlotVacated` must read 1 and the streams must '
        + 'agree on BOTH loads: a fix that reused a slot whose occupant is gone would part here while '
        + 'every red arm stayed green. THE ONLY ROAD TO A VACATED SLOT IS A SAME-TURN FAINT — a '
        + 'switch resolves before every move, so a slot named by this turn\'s click was occupied when '
        + 'it was named. `instructAimRepicked` is 0 and NOT 1, which is a correction this arm '
        + 'forced: `reaimToSlot` performs the retarget the authority does, inside itself, so '
        + 'the old `targetForMove` road is never reached and the first draft declared it wrong. '
        + 'also caught the classifier — the engine reported `reused` on a board where the aimed '
        + 'body was visibly on the floor, because a live return says nothing about WHICH body it '
        + 'is.' },

  { id: 'spread-repeat', kind: 'control', A: SIDE_A(ALA_SPR), B: B_PLAIN,
    script: T1({ m: 'dazzlinggleam' }, FILL),
    reuse: 0, vacated: 0, noslot: 1, repick: 0, rep: 1,
    what: 'A REPEAT WHOSE RECORDED AIM MUST NOT BE SPENT, AND THE FIRST DRAFT HAD THE REASON WRONG. '
        + 'It declared `instructAimNoSlot` on the belief that a spread click records no slot, and the '
        + 'engine reported `instructAimReused 1` — because a spread click DOES carry a body (the '
        + 'driver hands it `foes[0]`) and the authority records a loc for it too (`resolveAction` '
        + 'fills an absent `targetLoc` from `getRandomTarget` for ANY move). What makes the loc inert '
        + 'is the CLASS: `getMoveTargets` answers `allAdjacentFoes` from the field and never looks at '
        + 'the returned body, so spending the slot here would move which body `playerAction` PRICES '
        + 'the action against and change nothing the authority does. `aimTravelsByLoc` is that gate. '
        + 'It is also the arm that proves the repeat still costs HP at all, so an engine that granted '
        + 'the second action and dropped it on the floor cannot pass this file.' },

  { id: 'self-aim-repeat', kind: 'control', A: SIDE_A(MEO_DMG), B: B_PLAIN,
    script: T1({ m: 'calmmind' }, FILL),
    reuse: 0, vacated: 0, noslot: 1, repick: 0, rep: 1,
    what: 'THE OTHER SLOTLESS CLASS, AND IT IS THE ONE A SLOT INDEX MUST NEVER BE INVENTED FOR. A '
        + 'self-aimed move is deliberately NOT recorded against a slot (`_a.target !== mon` at the '
        + 'collection site), because this side\'s slots can be exchanged mid-turn by Ally Switch and '
        + 'a self-aim resolved through a slot would land on the PARTNER. The repeat is a second Calm '
        + 'Mind on the user in both engines.' },

  { id: 'aim-stale-across-turns', kind: 'control', A: SIDE_A(MEO_DMG), B: B_PLAIN,
    script: [{ p1: [{ m: 'psychic', t: 1 }, PROT], p2: [PROT, PROT] },
             { p1: [{ m: 'darkpulse', t: 0 }, PROT], p2: [INS, PROT] }],
    reuse: 1, vacated: 0, noslot: 0, repick: 0, rep: 1,
    what: 'THE STALENESS CONTROL, AND IT IS THE ONE THIS FIX COULD PLAUSIBLY HAVE BROKEN. Turn 1 '
        + 'aims Psychic at slot 1; turn 2 aims Dark Pulse at slot 0 and is Instructed. The recorded '
        + 'aim is keyed to the move it was recorded for, so turn 2 must repeat at SLOT 0 — a '
        + 'recording that was written once and never refreshed, or one read without checking which '
        + 'move it belongs to, sends the repeat back at turn 1\'s slot and this arm parts while every '
        + 'red arm stays green. It is also the only arm here on a board that is not turn 1.' },

  { id: 'no-last-move', kind: 'control', A: SIDE_A(REU_SLOW), B: B_PLAIN,
    script: T1({ m: 'calmmind' }, FILL),
    reuse: 0, vacated: 0, noslot: 0, repick: 0, rep: 0,
    what: 'NO REPEAT AT ALL, SO NO AIM IS EVER ASKED FOR. Reuniclus is base 30 Speed and Oranguru is '
        + 'base 60, so at the instant Instruct resolves the target has not moved this turn — '
        + '`if (!target.lastMove) return false` — and the authority writes `|-fail|` on the mover. '
        + 'Every new counter must read 0, which is what says the new code is inside the branch that '
        + 'grants the repeat and not above it.' },

  { id: 'shield-refuses-instruct', kind: 'control', A: SIDE_A(MEO_DMG), B: B_PLAIN,
    script: T1(PROT, FILL),
    reuse: 0, vacated: 0, noslot: 0, repick: 0, rep: 0, refShield: 1,
    what: 'ROADMAP #532 STILL HOLDS, AND THIS KNOB MUST NOT REACH IT. The instructed body is behind '
        + 'its own Protect, so Instruct is refused at `hitStepTryHitEvent` and no second action is '
        + 'built. `instructRefusedByShield` reads 1, every aim counter reads 0, and the streams agree '
        + 'on both loads — the two fixes sit in the same branch, one above the other, and this is '
        + 'the arm that says the lower one did not move the upper one.' },
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
for (const c of CASES) for (const row of c.A.concat(c.B)) {
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

/* ---- THE AUTHORITY, DERIVED ON EVERY RUN -------------------------------------------------------
 * Two derivations, because this file rests on two separate claims about the mod. */
const TAGS = require(REL.path('data/tags.json'));
{
  const users = dex.species.all().filter(legal)
    .filter(s => { const e = LS[s.id]; return e && e.learnset && e.learnset.instruct; }).map(s => s.name);
  console.log('LEGAL INSTRUCT USERS IN ' + CS.FORMAT + ': ' + (users.join(', ') || '(NONE)'));
  if (!users.length) { console.log('NOT RUN — nothing in this format learns Instruct.'); process.exit(2); }
}
{
  const fs = require('fs'), SP = process.env.SHOWDOWN_PATH;
  const modMoves = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'moves.ts'), 'utf8');
  const modScripts = fs.readFileSync(path.join(SP, 'data', 'mods', 'champions', 'scripts.ts'), 'utf8');
  const overrides = (modMoves.match(/^\t[a-z0-9]+: \{/gm) || []).length;
  const rewritesInstruct = /^\tinstruct: \{/m.test(modMoves);
  console.log('DOES CHAMPIONS REWRITE INSTRUCT? ' + (rewritesInstruct ? 'YES' : 'NO')
    + '   (champions overrides ' + overrides + ' moves)');
  /* The five functions the aim actually travels through. If Champions ever overrides one of them, the
   * source reads at the head of this file stop being about the game we are playing and this file must
   * say so rather than quietly keep passing. */
  const CHAIN = ['runMove', 'getTarget', 'getRandomTarget', 'resolveAction', 'moveUsed'];
  const hit = CHAIN.filter(f => new RegExp('^\\t+' + f + '\\s*[(:]', 'm').test(modScripts));
  console.log('CHAMPIONS OVERRIDES OF THE TARGETING CHAIN (' + CHAIN.join(', ') + '): '
    + (hit.length ? hit.join(', ') : 'NONE — mainline applies'));
  if (rewritesInstruct || hit.length) {
    console.log('NOT RUN — Champions rewrites part of the chain this file reasons about. The source '
      + 'reads at the head of this file are mainline\'s and would be the wrong rulebook.');
    process.exit(2);
  }
  const IM = dex.moves.get('instruct');
  console.log('instruct.target = ' + IM.target + '   category = ' + IM.category
    + '   corpus uses (SHEET SLOTS, not clicks) = ' + ((TAGS.moves.instruct || {}).uses || 0));
}
/* WHICH MOVES TRAVEL BY LOC — THE MEMBERSHIP OF THE NEW GATE, PRINTED BEFORE IT IS TRUSTED
 * (docs/LESSONS §4: a new derived set over-matches, and printing what it caught is the only thing
 * that has ever caught that). Read off `targetClass.target` in this release's artifact, which is
 * Showdown's own `move.target` string, so the split moves with the regulation. */
{
  const BY_LOC = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);
  const byClass = new Map();
  for (const m of dex.moves.all().filter(legal)) {
    const row = TAGS.moves[m.id], tc = row && row.params && row.params.targetClass;
    const cls = (tc && tc.target) || '(NO targetClass ROW)';
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls).push(m.name);
  }
  let inSet = 0, out = 0;
  console.log(NL + 'DOES THE RECORDED LOC DECIDE ANYTHING FOR THIS MOVE? by target class:');
  for (const [cls, names] of [...byClass].sort((a, b) => b[1].length - a[1].length)) {
    const yes = BY_LOC.has(cls);
    if (yes) inSet += names.length; else out += names.length;
    console.log('  ' + (yes ? 'BY LOC  ' : 'inert   ') + cls.padEnd(20) + String(names.length).padStart(4)
      + '   e.g. ' + names.slice(0, 4).join(', '));
  }
  console.log('  -> ' + inSet + ' legal moves spend the recorded loc, ' + out + ' do not');
  if (byClass.has('(NO targetClass ROW)')) {
    console.log('NOT RUN — ' + byClass.get('(NO targetClass ROW)').length + ' legal move(s) have no '
      + '`targetClass` row, so the gate would answer them by a FALLBACK rather than by their class.');
    process.exit(2);
  }
}
/* HOW MANY LEGAL MOVES CANNOT BE AIMED BY `targetForMove` AT ALL? The status road below is not a
 * corner: it is every single-target status move in the format, and the count is derived rather than
 * asserted so it moves with the regulation. */
{
  const single = dex.moves.all().filter(legal)
    .filter(m => ['normal', 'any', 'adjacentFoe'].includes(m.target));
  const status = single.filter(m => m.category === 'Status');
  console.log('LEGAL SINGLE-TARGET MOVES: ' + single.length + ', of which STATUS (base power 0, so '
    + '`targetForMove` returns null and the old road fell to foe slot 0): ' + status.length
    + '   e.g. ' + status.slice(0, 6).map(m => m.name).join(', '));
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('top-tie-first');
  if (!arm) { console.log('NOT RUN — the driver has no arm named top-tie-first'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  const beforeF = Object.assign({}, globalThis.MEDFAILS || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_instruct_target :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {}, afterF = globalThis.MEDFAILS || {};
  const delta = {}, deltaF = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  for (const k of Object.keys(afterF)) if (typeof afterF[k] === 'number') deltaF[k] = afterF[k] - (beforeF[k] || 0);
  return { r, delta, deltaF, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).instructNoAimReuseRestored || 0 };
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
  const R = { c, clean, brk, short, refused,
    rep: clean.delta.instructRepeat || 0, repK: brk.delta.instructRepeat || 0,
    reuse: clean.delta.instructAimReused || 0, reuseK: brk.delta.instructAimReused || 0,
    vac: clean.delta.instructAimSlotVacated || 0,
    nos: clean.delta.instructAimNoSlot || 0,
    rep2: clean.delta.instructAimRepicked || 0,
    refSh: clean.delta.instructRefusedByShield || 0,
    unrec: (clean.deltaF.instructAimUnrecorded || 0) + (clean.deltaF.instructAimClassUnknown || 0) };
  results.push(R);

  if (short || refused) { bad++; R.fail = 'FIXTURE'; continue; }
  const fails = [];
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED, or every verdict below is about one
   * engine loaded twice. */
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  /* THE BRANCH COUNTERS AT EXACT PER-ARM EQUALITY. "The engines agree" can never be read off a
   * branch that never ran, and every arm declares which of the four roads it takes. */
  if (R.rep !== c.rep) fails.push('instructRepeat clean is ' + R.rep + ', declared ' + c.rep);
  if (R.repK !== c.rep) fails.push('instructRepeat knob is ' + R.repK + ', declared ' + c.rep
    + ' — the knob must revert the AIM, never whether the repeat happens');
  if (R.reuse !== c.reuse) fails.push('instructAimReused clean is ' + R.reuse + ', declared ' + c.reuse);
  if (R.vac !== c.vacated) fails.push('instructAimSlotVacated clean is ' + R.vac + ', declared ' + c.vacated);
  if (R.nos !== c.noslot) fails.push('instructAimNoSlot clean is ' + R.nos + ', declared ' + c.noslot);
  if (R.rep2 !== c.repick) fails.push('instructAimRepicked clean is ' + R.rep2 + ', declared ' + c.repick);
  if (R.refSh !== (c.refShield || 0)) fails.push('instructRefusedByShield clean is ' + R.refSh
    + ', declared ' + (c.refShield || 0));
  /* UNDER THE KNOB EVERY AIM COUNTER IS ZERO. That is the revert being a revert rather than a
   * different road that happens to agree. */
  if (R.reuseK !== 0) fails.push('instructAimReused under the knob is ' + R.reuseK + ', must be 0');
  /* A REPEAT WHOSE AIM WAS NEVER RECORDED IS A SILENT DEFAULT WEARING THE OLD BEHAVIOUR. Asserted at
   * exact zero on every arm, so this file cannot pass through one. */
  if (R.unrec !== 0) fails.push('instructAimUnrecorded / instructAimClassUnknown fired ' + R.unrec
    + ' time(s) — a repeat was built for a body whose last click recorded no aim, or for a move whose '
    + 'target class could not be read, and the answer was defaulted');
  /* AND THE PROTOCOL STREAMS. Clean: every arm agrees with the authority. Knob: a red arm must part
   * (or it proves nothing) and a control must not (or the change is not confined). */
  if (clean.r.div) fails.push('the engines part on the CLEAN load');
  if (c.kind === 'red' && !brk.r.div) fails.push('the knob did not move the outcome — this arm proves nothing');
  if (c.kind === 'control' && brk.r.div) fails.push('OVER-FIRE — a control moved under the knob');
  if (fails.length) bad += 1;
  R.fails = fails;
}

for (const R of results) {
  const { c, clean, brk, short, refused } = R;
  const verdict = short ? 'SHORT        ' : refused ? 'CLICK REFUSED'
    : (R.fails && R.fails.length) ? 'FAIL         '
    : c.kind === 'red' ? 'RED PROVEN   ' : 'CONTROL HELD ';
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    the aim road   reused ' + R.reuse + '/' + c.reuse + '   vacated ' + R.vac + '/' + c.vacated
    + '   no-slot ' + R.nos + '/' + c.noslot + '   re-picked ' + R.rep2 + '/' + c.repick
    + '   UNRECORDED ' + R.unrec + '/0');
  console.log('    counters       instructRepeat ' + R.rep + '/' + c.rep + ' clean, ' + R.repK + ' knob'
    + '   |   instructRefusedByShield ' + R.refSh + '/' + (c.refShield || 0)
    + '   |   instructAimReused under the knob ' + R.reuseK + '/0');
  console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored);
  const d = clean.r.div || brk.r.div;
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

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT — '
  + 'the other arms did not run, and the claims below are only true of a full run.'
  : 'PASS — the instructed repeat goes back at the slot the click named, on both the damaging road '
  + 'and the status road and in both directions; it stands aside for a move that named no slot, it '
  + 'falls back when the named slot has been vacated by a faint, it does not survive a turn boundary, '
  + 'and a shield still refuses Instruct above all of it');
process.exit(bad ? 1 : 0);
