/* probe_default_target_side.js — A MOVE USED WITHOUT A CHOSEN TARGET RESOLVES ITS TARGET FROM ITS
 * OWN TARGET CLASS, AND EVERY DEFAULT-TARGET DRAW IN THIS ENGINE WENT STRAIGHT TO THE FOES.
 *
 *   SHOWDOWN_PATH=... node tests/probe_default_target_side.js
 *   SHOWDOWN_PATH=... node tests/probe_default_target_side.js --only encore-helpinghand
 *   SHOWDOWN_PATH=... node tests/probe_default_target_side.js --release <id>
 *
 * ================= THE SYMPTOM, AND IT IS NOT WHERE THE DEFECT IS ===============================
 *
 * `docs/_reports/2026-08-29-encore-order.md` filed this as *"Armor Tail refuses a priority move aimed
 * at the mover's own ALLY"*, unmasked in game 2653843264 turn 4:
 *
 *     showdown   |-singleturn|p2b: Whimsicott|Helping Hand|[of] p2a: Maushold
 *     medicham2  |cant|p1b: Farigiraf|ability: armortail|helpinghand|[of] p2a: Maushold
 *
 * THE REFUSAL IS NOT WRONG. `medicham2`'s priority gate fires only when the action's target is in the
 * mover's FOE array, which in a double is exactly the authority's `source.isAlly(armorTailHolder)`.
 * Handed the right target it gives the right answer, and a plain click proves it — arm
 * `no-encore-helpinghand` below is green on the shipping engine and always was.
 *
 * WHAT IS WRONG IS THE TARGET. The Helping Hand in that game arrived through Encore's execution-time
 * override, and that site draws its target from `live(foes)` whatever the encored move's target class
 * says. So a `adjacentAlly` move was handed a Farigiraf, and the gate — reading a field that had been
 * filled with a lie — refused it correctly on false evidence.
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `Battle#getRandomTarget` (sim/battle.ts:2487). Champions overrides `scripts`, `abilities`, `moves`,
 * `items`, `conditions`, `learnsets`, `rulesets` and `formats-data` and NONE of them touches this
 * function — grepped, not recalled. The clause ORDER is the whole point: the near-side classes are
 * answered BEFORE it ever looks at a foe.
 *
 *     move = this.dex.moves.get(move);
 *     if (['self','all','allySide','allyTeam','adjacentAllyOrSelf'].includes(move.target)) return pokemon;
 *     else if (move.target === 'adjacentAlly') {
 *       if (this.gameType === 'singles') return null;
 *       const adjacentAllies = pokemon.adjacentAllies();
 *       return adjacentAllies.length ? this.sample(adjacentAllies) : null;
 *     }
 *     ... return pokemon.side.randomFoe() || pokemon.side.foe.active[0];
 *
 * And the three sites in `medicham2-browser.js` that stand where it stands — Encore at SELECTION,
 * Encore at EXECUTION (WIRE 143) and the called-move branch (Copycat / Metronome / Sleep Talk /
 * Mirror Move, ROADMAP #308) — all began at the last line. Two of the three name `getRandomTarget` in
 * their own comments.
 *
 * ================= WHY ARMOR TAIL IS THE ONE THAT SHOWS ==========================================
 *
 * Derived over the 500 legal moves, not recalled. NINETY-THREE carry a near-side target class, so all
 * ninety-three were drawn wrong; only a handful can be SEEN, because `playerAction` throws the aim away
 * for most of them (Protect, Tailwind, Rain Dance and Wide Guard all return a kind that carries no
 * target at all). Exactly FOUR legal moves are `adjacentAlly` AND chooseable, so the wrong body
 * actually travels on the action: helpinghand (7,842 uses, +5), coaching (1,510), dragoncheer (34),
 * aromaticmist (3). Helping Hand is the only one of the four with priority of its own, which is why the
 * priority refusers are the instrument that noticed.
 *
 * THE REFUSERS, DERIVED: `blocksMove {what:'priority'}` over the format's 316 legal abilities selects
 * armortail (Farigiraf, 1 carrier), queenlymajesty (Tsareena, 1) and dazzling (ZERO legal carriers —
 * it cannot occur and is not staged). Both live carriers are staged below, and the fix names neither.
 *
 * ================= THE KNOB =====================================================================
 *
 * `MEDI_DEFAULT_TARGET_FOE_ONLY=1` restores the far-side-only draw in a child load and stamps
 * `MEDFAILS.defaultTargetFoeOnlyRestored`, asserted ABSENT on the clean load and PRESENT under the
 * knob — a knob read by a module the driver never loaded reads identically on both and stages nothing.
 *
 * ================= NO EXPECTATION IS TYPED ======================================================
 *
 * Every arm plays the identical script on both engines under the differential's own `middle` pin.
 * Showdown's stream IS the answer; this file asserts only that the two agree on four counted facts,
 * that the knob puts the red arms back apart, and that the controls do NOT move under the knob.
 *
 * ================= THE CONTROLS AN OVER-FIRING FIX BREAKS ========================================
 *
 * A draw that reached the near side too widely would aim ordinary attacks at the user's own partner —
 * far worse than the gap. SIX arms exist for that, each clearing exactly one thing: a plain
 * (non-Encored) Helping Hand, which was NEVER broken; the FOE axis of Armor Tail clicked directly,
 * which is card C6's own measurement and must not move; the same foe axis arriving through the
 * Encore override; an Encore into a priority-0 attack; the called-move door on its far-side road;
 * and a `self` move with priority, where the near-side branch fires and the board may not move.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time when
 * `--release` is absent, and a bare `node <file>` would write that cut into the real store. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

/* THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE — turn 2 is the whole diagnosis. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_default_target_side.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_DEFAULT_TARGET_FOE_ONLY';

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

/* ---- THE BOARD ---------------------------------------------------------------------------------
 * SPEEDS ARE THE DRIVER'S: active slot 0 is base+52 and slot 1 is base+42 (`spreadFor` +32/+22, no
 * nature, Champions' `stat + evs + 20`). Whimsicott 158, Lucario 142, Tsareena 124, Farigiraf 112,
 * Clefable 102 — no two bodies on the field share a speed on any arm, so nothing here is a tie and
 * "it moved second" is never a die. Both victims are slower than the encorer, so the Encore always
 * lands while the victim's own action is still queued. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

/* THE ENCORER. Prankster puts its Encore at +1, ahead of every priority-0 click on the board. */
const WHIM = ['whimsicott', '', 'Prankster', ['Encore', 'Charm', 'Protect']];
/* THE REFUSER, and the SAME BODY with the ability traded for one of its own — Farigiraf's slot-H Sap
 * Sipper — so the control differs in one cell and not in species, speed or moves. */
const FARI = ['farigiraf', '', 'Armor Tail', ['Protect']];
const FARI_OFF = ['farigiraf', '', 'Sap Sipper', ['Protect']];
/* THE FORMAT'S OTHER LIVE PRIORITY REFUSER, staged so the fix cannot be name-bound to Armor Tail. */
const TSAR = ['tsareena', '', 'Queenly Majesty', ['Protect']];
/* THE VICTIM'S PARTNER, AND THE SECOND VICTIM. Lucario is the only legal body that learns BOTH
 * Coaching and Copycat, which is what lets one fixture reach the Encore door and the called-move door
 * without changing the board between them. Inner Focus touches nothing here. */
const LUCA = ['lucario', '', 'Inner Focus', ['Coaching', 'Copycat', 'Protect', 'Aura Sphere', 'Bullet Punch', 'Swords Dance']];
/* THE VICTIM. Magic Guard is inert on this board — nothing here is indirect damage. */
const CLEF = ['clefable', '', 'Magic Guard', ['Helping Hand', 'Charm', 'Protect', 'Copycat', 'Follow Me', 'Moonblast']];

const PR = { m: 'protect' };
const CH0 = { m: 'charm', t: 0 };
const HH = { m: 'helpinghand' };
const CO = { m: 'coaching' };
const CC = { m: 'copycat' };
const FM = { m: 'followme' };
const BP0 = { m: 'bulletpunch', t: 0 };
const AS0 = { m: 'aurasphere', t: 0 };
/* THE PARTNER'S FILLER ON EVERY HELPING HAND ARM, AND IT IS LOAD-BEARING RATHER THAN INERT.
 * `helpinghand.onTryHit` is `if (!target.newlySwitched && !this.queue.willMove(target)) return false;`
 * — the ally must still be QUEUED. Protect is +4 and would take the partner out of the queue before
 * the victim's +5 ever resolves, so every one of these arms would stage a FAILED Helping Hand and
 * measure nothing. Swords Dance is priority 0 and the partner stays in the queue. THIS WAS FOUND BY
 * A RED RUN, not by reading: the first fixture used Protect and the authority's own mark count showed
 * the move failing. (medicham2 does NOT implement that clause — it marked where the authority failed.
 * FILED, not fixed here, and deliberately routed out of these arms so that someone else's defect is
 * not sitting inside this one's evidence.) */
const SD = { m: 'swordsdance' };
const ENC0 = { m: 'encore', t: 0 };          // at the foes' slot 0 — Lucario
const ENC1 = { m: 'encore', t: 1 };          // at the foes' slot 1 — Clefable

const SIDE_REF = (ref) => stage([ref || FARI, WHIM]).concat(BENCH('snorlax', 'garchomp'));
const SIDE_VIC = () => stage([LUCA, CLEF]).concat(BENCH('toxapex', 'incineroar'));

/* THE SCRIPTS. Turn 1 is what the victim must have used for the Encore to force it back; turn 2 is
 * the turn under the microscope. The refuser clicks Protect on both turns on every arm — its second
 * Protect draws its own stall die, and the two engines were verified to agree on that line on every
 * arm of the red run before anything here was read as evidence. */
const ENC_SCRIPT = (partner, t1click, enc) => [
  { p1: [PR, CH0], p2: [partner, t1click] },
  { p1: [PR, enc], p2: [partner, CH0] },
];

const CASES = [
  /* ---- THE DEFECT ------------------------------------------------------------------------------- */
  { id: 'encore-helpinghand', kind: 'red', near: 1,
    A: SIDE_REF(), B: SIDE_VIC(), script: ENC_SCRIPT(SD, HH, ENC1),
    what: 'THE CARDED SHAPE, game 2653843264 turn 4. Clefable clicks Helping Hand at its partner on '
        + 'turn 1, is Encored back into it on turn 2 while its own action is still queued, and the '
        + 'execution-time override then draws a target out of the FOES for a move whose class is '
        + '`adjacentAlly`. The authority marks the partner; this engine hands the aim to the Farigiraf '
        + 'and its Armor Tail refuses a +5 move it was never aimed at.' },

  { id: 'encore-helpinghand-mirror', kind: 'red', near: 1,
    A: SIDE_VIC(), B: SIDE_REF(),
    script: [{ p1: [SD, HH], p2: [PR, CH0] }, { p1: [SD, CH0], p2: [PR, ENC1] }],
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE. The empirical arm carries this on p1 and on '
        + 'p2; a fix that reached one side only would pass the arm above and fail here.' },

  { id: 'encore-helpinghand-queenly', kind: 'red', near: 1,
    A: SIDE_REF(TSAR), B: SIDE_VIC(), script: ENC_SCRIPT(SD, HH, ENC1),
    what: 'THE OTHER LIVE PRIORITY REFUSER IN THE REGULATION. Queenly Majesty\'s handler is byte-for-'
        + 'byte Armor Tail\'s but for the name on the `cant` line, and Tsareena is its only legal '
        + 'carrier. Nothing in the fix names either ability; this arm is what makes that a measurement '
        + 'rather than a claim.' },

  { id: 'encore-helpinghand-noguard', kind: 'red', near: 1,
    A: SIDE_REF(FARI_OFF), B: SIDE_VIC(), script: ENC_SCRIPT(SD, HH, ENC1),
    what: 'THE REFUSAL REMOVED, SO ONLY THE TARGET IS LEFT. Same board, same clicks, Farigiraf\'s own '
        + 'Sap Sipper in place of Armor Tail. Nothing is refused on either engine — and the `|move|` '
        + 'line still names a body on the WRONG SIDE of the field. This arm is the whole diagnosis: '
        + 'the refusal was reading a target field that had been filled with a lie.' },

  { id: 'encore-coaching', kind: 'red', near: 1,
    A: SIDE_REF(), B: SIDE_VIC(),
    script: [{ p1: [PR, CH0], p2: [CO, CH0] }, { p1: [PR, ENC0], p2: [SD, CH0] }],
    what: 'THE SAME DRAW WITH NO PRIORITY ANYWHERE NEAR IT. Coaching is `adjacentAlly` at priority 0, '
        + 'so no refuser is involved and the boost simply lands on the wrong SIDE OF THE FIELD — this '
        + 'engine hands +1/+1 to a foe. It is board-material and it separates "the target is wrong" '
        + 'from "the refusal fires". Lucario\'s turn-2 click is Swords Dance and not Protect for the '
        + 'reason the first red run printed: a +4 click leaves the queue BEFORE the +1 Encore lands, so '
        + '`willMove` is null, the authority bumps the duration instead of relocating, and the arm stages '
        + 'nothing at all while reading green.' },

  { id: 'copycat-coaching', kind: 'red', near: 1,
    A: SIDE_REF(), B: SIDE_VIC(),
    script: [{ p1: [PR, CH0], p2: [PR, CH0] }, { p1: [PR, CH0], p2: [CO, CC] }],
    what: 'THE SECOND DRAW SITE, WHICH IS NOT ENCORE AT ALL. Lucario coaches its partner and Clefable '
        + '— slowest on the field — copies it. The authority calls `useMove(id, pokemon)` with no '
        + 'target and `getRandomTarget` answers `adjacentAlly`; ROADMAP #308\'s branch draws from the '
        + 'living foes. One shared reader closes both doors or this arm stays red. (Helping Hand '
        + 'cannot be used here: it carries the `failcopycat` flag, which was READ off the format and '
        + 'then confirmed by a staged arm that agreed while testing nothing.)' },

  /* ---- THE CONTROLS. Each clears one thing and must hold on BOTH loads --------------------------- */
  { id: 'no-encore-helpinghand', kind: 'control', near: 0,
    A: SIDE_REF(), B: SIDE_VIC(),
    script: [{ p1: [PR, CH0], p2: [SD, HH] }, { p1: [PR, CH0], p2: [SD, HH] }],
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board and an ordinary CLICKED Helping Hand, '
        + 'twice, with Charm in the Encore\'s place. The player names the ally, the priority gate sees '
        + 'a body that is not in its foe array, and nothing is refused. This arm is why the report '
        + 'says the refusal was never the defect: it is green on the shipping engine, green after the '
        + 'fix, and green under the knob.' },

  { id: 'foe-axis-bulletpunch', kind: 'control', near: 0,
    A: SIDE_REF(), B: SIDE_VIC(),
    script: [{ p1: [PR, CH0], p2: [BP0, CH0] }, { p1: [PR, CH0], p2: [BP0, CH0] }],
    what: 'CARD C6\'S OWN MEASUREMENT, UNTOUCHED. A +1 Bullet Punch clicked straight into the Armor '
        + 'Tail side must be refused on both engines and must read the same under the knob. This is '
        + 'the board a widened refusal or a widened draw breaks.' },

  { id: 'encore-bulletpunch', kind: 'control', near: 0,
    A: SIDE_REF(), B: SIDE_VIC(),
    script: [{ p1: [PR, CH0], p2: [BP0, CH0] }, { p1: [PR, ENC0], p2: [PR, CH0] }],
    what: 'THE FOE AXIS THROUGH THE SAME OVERRIDE. Encored into Bullet Punch — target class `normal`, '
        + 'so `getRandomTarget` falls through to the foes exactly as this engine already did. The '
        + 'refusal must still fire, on both engines, on both loads.' },

  { id: 'encore-aurasphere', kind: 'control', near: 0,
    A: SIDE_REF(), B: SIDE_VIC(),
    script: [{ p1: [PR, CH0], p2: [AS0, CH0] }, { p1: [PR, ENC0], p2: [PR, CH0] }],
    what: 'THE FOE DRAW AT PRIORITY 0. Nothing is refused and nothing about the draw may change; this '
        + 'arm fails if the shared reader consumes a different die on the far-side road, which would '
        + 'move every Encored attack in the pool.' },

  { id: 'copycat-aurasphere', kind: 'control', near: 0,
    A: SIDE_REF(), B: SIDE_VIC(),
    script: [{ p1: [PR, CH0], p2: [PR, CH0] }, { p1: [PR, CH0], p2: [AS0, CC] }],
    what: 'THE FAR-SIDE ROAD OF THE CALLED-MOVE DOOR. Same fixture, same turn, a `normal` move copied '
        + 'instead of an `adjacentAlly` one. ROADMAP #308\'s addressed draw must be untouched.' },

  { id: 'encore-followme', kind: 'control', near: 1,
    A: SIDE_REF(), B: SIDE_VIC(),
    script: [{ p1: [PR, CH0], p2: [SD, FM] }, { p1: [PR, ENC1], p2: [SD, CH0] }],
    what: 'A `self` MOVE WITH PRIORITY, WHERE THE NEAR-SIDE BRANCH FIRES AND NOTHING MAY MOVE. The '
        + 'authority returns the USER; `playerAction` throws the aim away for a redirector either '
        + 'way, so the counter says the branch ran and the board says it changed nothing. Follow Me '
        + 'rather than Protect deliberately: two consecutive Protects draw the stall die, which is '
        + 'card F2\'s open family and would have put someone else\'s red inside this arm.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED -------------------------------------------------------------- */
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
const seenRow = new Set();
for (const c of CASES) for (const row of c.A.concat(c.B)) {
  const key = row.species + '|' + row.item + '|' + row.ability + '|' + row.moves.join(',');
  if (seenRow.has(key)) continue;
  seenRow.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.item && !legal(dex.items.get(row.item))) {
    console.log('ILLEGAL FIXTURE  ' + row.item + ' is not in this format'); illegal++;
  }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE MEMBERSHIP, PRINTED BEFORE ANYTHING IS WIRED TO IT (docs/LESSONS §4) -------------------- */
const TAGS = require(D('data', 'tags.json'));
const NEAR = new Set(['self', 'all', 'allySide', 'allyTeam', 'adjacentAllyOrSelf', 'adjacentAlly']);
const classOf = id => ((TAGS.moves[id] || {}).params || {}).targetClass;
const nearMoves = Object.keys(TAGS.moves || {}).filter(k => {
  const tc = classOf(k); return tc && NEAR.has(tc.target);
});
const byClass = {};
for (const k of nearMoves) { const t = classOf(k).target; (byClass[t] = byClass[t] || []).push(k); }
console.log(NL + '  DERIVED — legal moves whose target class is answered BEFORE `getRandomTarget` looks '
  + 'at a foe: ' + nearMoves.length + ' of ' + Object.keys(TAGS.moves).length);
for (const t of Object.keys(byClass).sort()) console.log('    ' + t.padEnd(20) + byClass[t].length);
const carriesAim = nearMoves.filter(k => (classOf(k).chooseable) && classOf(k).target === 'adjacentAlly');
console.log('    of those, the ones whose aim actually TRAVELS on the action (`adjacentAlly` and '
  + 'chooseable): ' + carriesAim.map(k => k + '(' + ((TAGS.moves[k] || {}).uses || 0) + ')').join(', '));
const refusers = Object.keys(TAGS.abilities || {}).filter(k => {
  const p = ((TAGS.abilities[k] || {}).params || {}).blocksMove; return p && p.what === 'priority';
});
const carriersOf = ab => dex.species.all().filter(legal)
  .filter(s => Object.values(s.abilities).map(a => dex.abilities.get(a).id).includes(ab)).map(s => s.name);
console.log('  DERIVED — abilities carrying `blocksMove {what:"priority"}`, with their LEGAL carriers:');
for (const ab of refusers) console.log('    ' + ab.padEnd(18) + (carriersOf(ab).join(', ') || 'NONE — cannot occur'));

/* THE AUTHORITY'S OWN CLAUSE, READ AT RUN TIME rather than quoted. If Champions ever overrides
 * `getRandomTarget`, or the ability stops refusing on priority, this file must not report a pass. */
const AT_SRC = String((dex.abilities.get('armortail') || {}).onFoeTryMove || '');
const AT_OK = /isAlly/.test(AT_SRC) && /priority/.test(AT_SRC);
console.log('  Armor Tail\'s own handler, read at run time: tests the TARGET\'s side (`isAlly`) '
  + AT_OK + '   [' + (AT_SRC ? 'onFoeTryMove present' : 'MISSING') + ']');
if (!AT_OK) {
  console.log(NL + 'NOT RUN — the format no longer carries the handler this file is about. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
const CANT_ABIL = /^\|cant\|([^|]*)\|ability: ([^|]*)\|/i;
const ST1_MARK = /^\|-singleturn\|([^|]*)\|([^|]*)/i;
const BOOST_LINE = /^\|-boost\|([^|]*)\|([^|]*)\|([^|]*)/i;
const MOVE_LINE = /^\|move\|([^|]*)\|([^|]*)\|([^|]*)/i;
const sideOf = s => { const m = /^(p[12])/.exec(String(s || '').trim()); return m ? m[1] : 'none'; };

/* FOUR COUNTED FACTS, taken the same way off both streams and compared TO EACH OTHER — never to a
 * number typed here. `cant` is normalised to `holder-side/ability`; `mark` to the SIDE a single-turn
 * volatile landed on with its label; `boost` to the side, stat and stage; `aim` to the SIDE of the
 * body the `|move|` line names. THE SIDE IS THE WHOLE QUESTION in this defect, so the facts are
 * deliberately coarse: they cannot fail on a spelling difference between the two narrators, and they
 * cannot pass while a body on the wrong half of the field takes the effect. */
function facts(lines) {
  const cant = [], marks = [], boosts = [], aims = [];
  for (const raw of (lines || []).map(String)) {
    let m = CANT_ABIL.exec(raw);
    if (m) { cant.push(sideOf(m[1]) + '/' + m[2].toLowerCase().replace(/[^a-z0-9]/g, '')); continue; }
    m = ST1_MARK.exec(raw);
    if (m) { marks.push(sideOf(m[1]) + '/' + m[2].toLowerCase().replace(/^move:/, '').replace(/[^a-z0-9]/g, '')); continue; }
    m = BOOST_LINE.exec(raw);
    if (m) { boosts.push(sideOf(m[1]) + '/' + m[2] + m[3]); continue; }
    m = MOVE_LINE.exec(raw);
    if (m) { aims.push(m[2].toLowerCase().replace(/[^a-z0-9]/g, '') + '->' + sideOf(m[3])); }
  }
  return { cant, marks, boosts, aims };
}
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const agree = (x, y) => same(x.cant, y.cant) && same(x.marks, y.marks)
                     && same(x.boosts, y.boosts) && same(x.aims, y.aims);
const show = f => 'cant[' + f.cant.join(' ') + ']  mark[' + f.marks.join(' ') + ']  boost['
  + f.boosts.join(' ') + ']  aim[' + f.aims.join(' ') + ']';

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_default_target_side :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta,
    sd: facts(G.sdStream(G.lastSdLog())),
    me: facts(r.mediTrace),
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).defaultTargetFoeOnlyRestored || 0,
    unknown: (globalThis.MEDFAILS || {}).defaultTargetClassUnknown || 0 };
}

let bad = 0, ran = 0;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']');
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  console.log('    showdown  ' + show(clean.sd));
  console.log('    medicham  ' + show(clean.me));
  console.log('    medicham  ' + show(brk.me) + '   [knob]');
  console.log('    near-side draws counted   clean ' + (clean.delta.defaultTargetNearSide || 0)
    + '   knob ' + ((brk.delta || {}).defaultTargetNearSide || 0)
    + '   (expected clean ' + c.near + ')');
  console.log('    MEDFAILS stamp            clean ' + clean.restored + '   knob ' + brk.restored
    + '   |   unreadable target class ' + clean.unknown
    + '   |   script clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : ''));

  /* A CLICK THE REQUEST DID NOT OFFER becomes a `pass` on both engines and the arm agrees while
   * testing nothing. Asserted at EXACT zero. */
  if (clean.sc.moveNotOnRequest) { console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  /* SHORT IS NOT A PASS. */
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the script did not play out (' + clean.r.turns + '/' + brk.r.turns
      + ' of ' + c.script.length + ').'); bad++; continue;
  }
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED. */
  if (!(clean.restored === 0 && brk.restored > 0)) {
    console.log('    >> KNOB DID NOT BIND — the load-time stamp is not absent-clean/present-on-knob.');
    bad++; continue;
  }
  /* A TARGET CLASS THIS ENGINE CANNOT READ IS A SILENT DEFAULT WEARING THE FIX'S CLOTHES. */
  if (clean.unknown) { console.log('    >> A DRAW RAN WITH NO TARGET CLASS — the fallback fired, so this arm is not evidence.'); bad++; }
  /* THE BRANCH RAN AS THE ARM CLAIMS. A control at 0 and a red arm at 1, so "it agreed" cannot be
   * read off a branch that never executed. */
  if ((clean.delta.defaultTargetNearSide || 0) !== c.near) {
    console.log('    >> THE BRANCH DID NOT RUN AS CLAIMED.'); bad++;
  }

  if (!agree(clean.sd, clean.me)) { console.log('    >> DEFECT — the two engines disagree.'); bad++; }
  else console.log('    >> the two engines agree, line for line, on all four facts.');

  if (c.kind === 'red') {
    if (agree(clean.sd, brk.me)) { console.log('    >> THE KNOB DID NOT MOVE ANYTHING — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this arm a red one.');
  } else {
    if (!agree(clean.sd, brk.me)) { console.log('    >> OVER-FIRE — the control moved under the knob, so the change is not confined.'); bad++; }
  }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
