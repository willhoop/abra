/* probe_priority_modified.js — EVERY PRIORITY GATE IN THIS ENGINE COMPARED THE PRINTED MOVE
 * PRIORITY. THE AUTHORITY COMPARES THE ABILITY-MODIFIED ONE.
 *
 *   SHOWDOWN_PATH=... node tests/probe_priority_modified.js
 *   SHOWDOWN_PATH=... node tests/probe_priority_modified.js --only galewings-at-refuser
 *   SHOWDOWN_PATH=... node tests/probe_priority_modified.js --release <id>
 *
 * ================= THE AUTHORITY, READ WHOLE ====================================================
 *
 * `Battle#getActionSpeed` (sim/battle.ts:2639-2645). Champions overrides `abilities`, `moves`,
 * `items`, `conditions`, `learnsets`, `rulesets`, `formats-data` and `scripts`, and NONE of them
 * touches this function or any of the five gates below — grepped, not recalled.
 *
 *     let priority = this.dex.moves.get(move.id).priority;
 *     priority = this.singleEvent('ModifyPriority', move, null, action.pokemon, target, null, priority);
 *     priority = this.runEvent('ModifyPriority', action.pokemon, target, move, priority);
 *     action.priority = priority + action.fractionalPriority;
 *     if (this.gen > 5) action.move.priority = priority;          <-- the last line is the whole defect
 *
 * The MODIFIED number is written onto the move, and the FRACTIONAL term is not. That is exactly why
 * every gate compares against 0.1 and not 0: a Prankster or Gale Wings boost counts, and Quick Claw
 * and Custap Berry — which are fractional — must not.
 *
 * ================= WHAT WAS WRONG HERE ==========================================================
 *
 * TWO IMPLEMENTATIONS OF ONE FACT, which is CLAUDE.md's "FACTS ARE GLOBAL" broken. `actionPriority`
 * read the modification off the `priorityMod` tag. The GATES read `movePriority`, the printed
 * constant, plus an ad-hoc `a.kind==='attack' ? 0 : (isPrankster(m)?1:0)` — keyed on the ACTION KIND
 * rather than on the move's category, and blind to Gale Wings on both roads. So a full-HP
 * Talonflame's Brave Bird is +1 upstream and 0 here: **the authority refuses it and we let it land**,
 * which is a body surviving on one engine and dying on the other.
 *
 * ================= MEMBERSHIP, DERIVED, PRINTED BEFORE THE RUN ===================================
 *
 * `onModifyPriority` over the 316 legal abilities selects exactly THREE — galewings (1 legal
 * carrier), prankster (7), triage (**ZERO legal carriers: it cannot occur, is not implemented and is
 * not approximated**). `onFractionalPriority` (Quick Draw, Stall, Mycelium Might) is deliberately
 * excluded: the authority adds it to `action.priority` and never to `action.move.priority`.
 *
 * The five gates, from a grep of every reader of `move.priority`:
 *
 *     armortail        data/abilities.ts:223    move.priority > 0.1        Farigiraf
 *     queenlymajesty   data/abilities.ts:3714   the same handler           Tsareena
 *     dazzling         data/abilities.ts:862    ZERO legal carriers — not staged
 *     quickguard       data/moves.ts:14509      move.priority <= 0.1 -> return
 *     upperhand        data/moves.ts:20193      the TARGET's queued move, not the user's
 *     psychicterrain   data/moves.ts:14119      effect.priority <= 0.1 -> return
 *
 * ================= THE SIBLING CARD — `move.target === 'all'` — WAS RECORDED BACKWARDS ===========
 *
 * `docs/_reports/2026-08-29-armor-tail-ally.md` filed it as *"the authority refuses an `all` move
 * outright above priority 0.1, excepting only perishsong, flowershield and rototiller"*. The handler
 * says the opposite, and the clause order is the rule:
 *
 *     if (move.target === 'foeSide' || (move.target === 'all' && !targetAllExceptions.includes(move.id)))
 *         return;                                   <-- EXEMPT, no refusal, whatever the priority
 *
 * So `all` and `foeSide` are EXEMPT, and only the three named moves fall through to be refused. Of
 * those three, flowershield and rototiller are `isNonstandard: 'Past'` and perishsong has NO legal
 * Prankster carrier — derived below — so **the refusing branch of the `all` clause cannot occur in
 * this regulation and is not wired.** What CAN occur is over-firing the other way, and arm
 * `prankster-sunnyday` is the control for it.
 *
 * ================= THE KNOB =====================================================================
 *
 * `MEDI_PRIORITY_GATE_STATIC=1` puts every gate back on the constant it used to read, PER SITE
 * (`gatePriority`'s `legacyShift`), and stamps `MEDFAILS.priorityGateStaticRestored` at load —
 * asserted ABSENT clean and PRESENT under the knob, because a knob read by a module the driver never
 * loaded reads identically on both arms and stages nothing.
 *
 * ================= NO EXPECTATION IS TYPED ======================================================
 *
 * Every arm plays the identical script on both engines under the differential's own `middle` pin.
 * Showdown's stream IS the answer; this file asserts only that the two agree on seven counted facts,
 * that the knob puts the red arms back apart, and that the controls do NOT move under the knob.
 *
 * ================= THE CONTROLS AN OVER-FIRING FIX BREAKS ========================================
 *
 * A gate that starts reading a bigger number refuses things it used to allow, and some of those
 * refusals are wrong. Six arms exist for that, each clearing exactly one: the SAME Talonflame with
 * Gale Wings traded for its own Flame Body, so the modified and static values coincide; the same
 * Talonflame below full HP, where the condition turns the shift off; a Prankster status move at a
 * foe, which was ALWAYS refused and must not move; a Prankster `target:'all'` move, which the
 * authority exempts by class; a Gale Wings `allySide` move, which the near side must not refuse; and
 * Upper Hand against a Prankster STATUS move at +1, which must still FAIL on the category clause.
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

/* THE GAME MUST NOT STOP AT THE FIRST DIVERGENT LINE — turn 2 is the diagnosis on two arms. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_priority_modified.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_PRIORITY_GATE_STATIC';

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

/* ---- THE BOARDS --------------------------------------------------------------------------------
 * SPEEDS ARE THE DRIVER'S: active slot 0 is base+52 and slot 1 is base+42 (`spreadFor` +32/+22, no
 * nature, Champions' `stat + evs + 20`). Talonflame 178, Meowstic 156, Lucario 142, Tsareena 124,
 * Klefki 117, Farigiraf 112 (slot 0) / 102 (slot 1), Clefable 102. No two bodies on the field share a
 * speed on any arm, so nothing here is a tie and "it moved second" is never a die. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

/* THE REFUSER, and the FORMAT'S OTHER LIVE REFUSER, so the fix cannot be name-bound to Armor Tail.
 * The Sap Sipper row is the SAME BODY with the ability traded for one of its own — one cell differs,
 * not the species, the speed or the moves. Psychic is Farigiraf's own click and exists so the red
 * arms do not have to hide behind a Protect: on the authority the Brave Bird is refused outright,
 * here it lands, and the difference is HP on a body rather than a line of narration. */
const FARI = ['farigiraf', '', 'Armor Tail', ['Protect', 'Psychic']];
const FARI_S = ['farigiraf', '', 'Sap Sipper', ['Protect', 'Psychic']];
const TSAR = ['tsareena', '', 'Queenly Majesty', ['Protect', 'Play Rough']];
/* Magic Guard is inert on every board here — nothing on them is indirect damage. */
const CLEF = ['clefable', '', 'Magic Guard', ['Protect', 'Moonblast']];
/* THE ONE LEGAL GALE WINGS CARRIER IN THE REGULATION, and the SAME BODY carrying its own slot-0
 * Flame Body. Flame Body is inert against every click staged here (nothing makes contact with
 * Talonflame). */
const TALON = ['talonflame', '', 'Gale Wings', ['Brave Bird', 'Tailwind', 'Protect', 'Feather Dance', 'Roost']];
const TALON_F = ['talonflame', '', 'Flame Body', ['Brave Bird', 'Tailwind', 'Protect', 'Feather Dance', 'Roost']];
/* A PRANKSTER CARRIER. Klefki does NOT learn Charm — checked, not assumed — so the foe-aimed status
 * control is Thunder Wave. */
const KLEF = ['klefki', '', 'Prankster', ['Thunder Wave', 'Sunny Day', 'Spikes', 'Protect']];
/* THE GUARD AND THE COUNTER-PRIORITY MOVE ON ONE BODY: Lucario is the only fixture that needs to be
 * both, and it learns both. Inner Focus touches nothing here except the Upper Hand flinch, which
 * lands on Talonflame and not on Lucario. */
const LUCA = ['lucario', '', 'Inner Focus', ['Quick Guard', 'Upper Hand', 'Aura Sphere', 'Protect']];
/* THE FOURTH GATE HAS NO ABILITY CARRIER IN THIS FORMAT — psychicsurge has ZERO legal carriers — so
 * the terrain is put up by the MOVE, and Meowstic is the only Prankster carrier that learns it. */
const MEOW = ['meowstic', '', 'Prankster', ['Psychic Terrain', 'Protect']];

const PR = { m: 'protect' };
const BB0 = { m: 'bravebird', t: 0 }, BB1 = { m: 'bravebird', t: 1 };
const PSY0 = { m: 'psychic', t: 0 }, PSY1 = { m: 'psychic', t: 1 };
const MB1 = { m: 'moonblast', t: 1 };
const PLAY1 = { m: 'playrough', t: 1 };
const FD0 = { m: 'featherdance', t: 0 };
const TW = { m: 'tailwind' };
const QG = { m: 'quickguard' };
const UH0 = { m: 'upperhand', t: 0 }, UH1 = { m: 'upperhand', t: 1 };
const PT = { m: 'psychicterrain' };
const TWAVE0 = { m: 'thunderwave', t: 0 };
const SUN = { m: 'sunnyday' };

const REFSIDE = ref => stage([ref || FARI, CLEF]).concat(BENCH('snorlax', 'garchomp'));
const ATKSIDE = atk => stage([atk || TALON, KLEF]).concat(BENCH('toxapex', 'incineroar'));
const GUARDSIDE = () => stage([LUCA, CLEF]).concat(BENCH('snorlax', 'garchomp'));
const TERRSIDE = () => stage([MEOW, FARI_S]).concat(BENCH('snorlax', 'garchomp'));

const CASES = [
  /* ---- THE DEFECT ------------------------------------------------------------------------------- */
  { id: 'galewings-at-refuser', kind: 'red', A: REFSIDE(), B: ATKSIDE(),
    script: [{ p1: [PSY1, PR], p2: [BB0, PR] }],
    what: 'THE CARDED ROW. `|cant|p2b|armortail|bravebird <> |-damage|p2a|H/H`, the surviving '
        + 'BOARD-MATERIAL Armor Tail divergence, staged both aims. A full-HP Talonflame clicks Brave '
        + 'Bird straight into the Farigiraf: Gale Wings makes it +1, the authority refuses it, and '
        + 'this engine reads the printed 0 and lands 111 damage plus recoil.' },

  { id: 'galewings-at-partner', kind: 'red', A: REFSIDE(), B: ATKSIDE(),
    script: [{ p1: [PSY1, MB1], p2: [BB1, PR] }],
    what: 'THE SAME CLICK AIMED AT THE HOLDER\'S PARTNER. `source.isAlly(armorTailHolder)` is the '
        + 'authority\'s test and the Clefable is an ally, so the Farigiraf refuses a move aimed at '
        + 'the body beside it. This arm is why the fix must not be narrowed to "aimed at the holder".' },

  { id: 'galewings-queenly', kind: 'red', A: REFSIDE(TSAR), B: ATKSIDE(),
    script: [{ p1: [PLAY1, MB1], p2: [BB0, PR] }],
    what: 'THE OTHER LIVE REFUSER IN THE REGULATION. Queenly Majesty\'s handler is byte-for-byte '
        + 'Armor Tail\'s but for the name on the `cant` line, and Tsareena is its only legal carrier. '
        + 'Nothing in the fix names either ability; this arm is what makes that a measurement.' },

  { id: 'galewings-featherdance', kind: 'red', A: REFSIDE(), B: ATKSIDE(),
    script: [{ p1: [PSY1, PR], p2: [FD0, PR] }],
    what: 'GALE WINGS ON A FLYING **STATUS** MOVE. The old ad-hoc term was `isPrankster(m)?1:0` on '
        + 'the status road, so Gale Wings was missing there too. Feather Dance is +1 on the authority '
        + 'and refused; here it landed a -2 Attack drop on the refuser.' },

  { id: 'galewings-quickguard', kind: 'red', A: GUARDSIDE(), B: ATKSIDE(),
    script: [{ p1: [QG, PR], p2: [BB0, PR] }],
    what: 'THE SECOND GATE, WHICH IS A SIDE CONDITION AND NOT AN ABILITY. quickguard\'s own comment '
        + 'in data/moves.ts names this case out loud — *"it blocks 0 priority moves boosted by '
        + 'Prankster or Gale Wings"*. Here the Brave Bird walked through the guard for 111.' },

  { id: 'galewings-upperhand', kind: 'red', A: GUARDSIDE(), B: ATKSIDE(),
    script: [{ p1: [UH0, PR], p2: [BB0, PR] }],
    what: 'THE THIRD GATE, AND THE ONLY ONE THAT READS SOMEBODY ELSE\'S MOVE. Upper Hand fails '
        + 'unless its TARGET is committing a priority attack, so it is Talonflame\'s modified '
        + 'priority that decides it. This engine read 0 and `-fail`ed the move outright — the '
        + 'opposite sign from the three above, and the block\'s own comment CLAIMED it counted '
        + 'Gale Wings.' },

  { id: 'galewings-psychicterrain', kind: 'red', A: TERRSIDE(), B: ATKSIDE(),
    script: [{ p1: [PT, PR], p2: [PR, PR] }, { p1: [PR, PSY1], p2: [BB1, PR] }],
    what: 'THE FOURTH GATE. psychicsurge has ZERO legal carriers so the terrain comes off the move, '
        + 'and the target must be GROUNDED — Farigiraf is, Talonflame is not, which is why the aim '
        + 'is at slot 1. Same number, third reader: the authority blocks, this engine landed it.' },

  /* ---- THE CONTROLS. Each clears one thing and must hold on BOTH loads --------------------------- */
  { id: 'nogalewings-bravebird', kind: 'control', A: REFSIDE(), B: ATKSIDE(TALON_F),
    script: [{ p1: [PSY1, PR], p2: [BB0, PR] }],
    what: 'THE KNOB CLEARED EXPLICITLY — THE ABILITY ABSENT, SO THE MODIFIED AND STATIC VALUES '
        + 'COINCIDE. The identical board and the identical click, with Talonflame\'s own slot-0 Flame '
        + 'Body in Gale Wings\' place. Brave Bird is priority 0, Armor Tail must NOT refuse it, and '
        + 'the arm must read the same on both loads. This is the board a widened gate breaks.' },

  { id: 'galewings-damaged', kind: 'control', A: REFSIDE(), B: ATKSIDE(),
    script: [{ p1: [PSY0, PR], p2: [TW, PR] }, { p1: [PSY1, PR], p2: [BB0, PR] }],
    what: 'THE CONDITION, NOT THE ABILITY. Same Talonflame, same Gale Wings — but Farigiraf\'s '
        + 'Psychic takes it off full HP on turn 1, so `pokemon.hp === pokemon.maxhp` is false and the '
        + 'shift does not apply. The Brave Bird must LAND on both engines. A fix that read the tag '
        + 'and skipped its condition passes every red arm above and fails here.' },

  { id: 'prankster-thunderwave', kind: 'control', A: REFSIDE(), B: ATKSIDE(),
    script: [{ p1: [PR, PR], p2: [PR, TWAVE0] }],
    what: 'THE HALF THAT WAS ALREADY RIGHT. A Prankster status move aimed at a foe has always been '
        + 'refused by this engine — the ad-hoc term covered exactly this case — so it is green on the '
        + 'shipping bytes, green after the fix and green under the knob. It is the arm that proves '
        + 'the shared reader did not lose what the ad-hoc one had.' },

  { id: 'prankster-sunnyday', kind: 'control', A: REFSIDE(), B: ATKSIDE(),
    script: [{ p1: [PR, PR], p2: [PR, SUN] }],
    what: 'THE `move.target === \'all\'` CLASS, WHICH THE AUTHORITY EXEMPTS. Sunny Day is +1 under '
        + 'Prankster and Armor Tail returns before it ever looks at the priority. This engine is '
        + 'accidentally right — `{kind:\'weather\'}` carries no target, so the gate never fires — and '
        + 'this arm is what says so out loud instead of leaving it to be inferred.' },

  { id: 'galewings-tailwind', kind: 'control', A: REFSIDE(), B: ATKSIDE(),
    script: [{ p1: [PR, PR], p2: [TW, PR] }],
    what: 'A GALE WINGS MOVE AT +1 THAT IS AIMED AT THE NEAR SIDE. Tailwind is Flying, is Status, and '
        + 'is `allySide`, so the shift applies and the refusal does not. A gate that widened its '
        + 'number without keeping its "only a move aimed at the other side" scope refuses this and '
        + 'takes Tailwind out of the format.' },

  { id: 'upperhand-vs-status', kind: 'control', A: GUARDSIDE(), B: ATKSIDE(),
    script: [{ p1: [UH1, PR], p2: [PR, TWAVE0] }],
    what: 'UPPER HAND\'S **OTHER** CLAUSE. `move.category === \'Status\'` fails the move whatever its '
        + 'priority, so a Prankster Thunder Wave at +1 must NOT feed it. A fix that added the shift '
        + 'to the number and dropped the category test turns Upper Hand into a free 65 BP +3 click '
        + 'into every Prankster body in the format.' },

  { id: 'quickguard-priority0', kind: 'control', A: GUARDSIDE(), B: ATKSIDE(TALON_F),
    script: [{ p1: [QG, PR], p2: [BB0, PR] }],
    what: 'THE GUARD\'S OWN FLOOR. The same Quick Guard against the same Brave Bird from a Talonflame '
        + 'carrying Flame Body: priority 0, so the guard must let it through and the damage must be '
        + 'identical on both engines and on both loads.' },
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

/* ---- THE MEMBERSHIP, PRINTED BEFORE ANYTHING IS READ OFF IT (docs/LESSONS §4) -------------------- */
const carriersOf = ab => dex.species.all().filter(legal)
  .filter(s => Object.values(s.abilities).map(a => dex.abilities.get(a).id).includes(ab)).map(s => s.name);
const abs = dex.abilities.all().filter(legal);
const MODS = abs.filter(a => typeof a.onModifyPriority === 'function');
const FRAC = abs.filter(a => a.onFractionalPriority !== undefined);
console.log(NL + '  DERIVED — legal abilities that MODIFY a move\'s priority (`onModifyPriority`, the'
  + ' event whose result `getActionSpeed` writes to `action.move.priority`): ' + MODS.length
  + ' of ' + abs.length);
for (const a of MODS) console.log('    ' + a.id.padEnd(16) + (carriersOf(a.id).join(', ') || 'NONE — cannot occur, not staged'));
console.log('  DERIVED — legal abilities carrying `onFractionalPriority`, which the authority adds to '
  + '`action.priority` and NEVER to `action.move.priority`, so no gate may count them: ' + FRAC.length);
for (const a of FRAC) console.log('    ' + a.id.padEnd(16) + (carriersOf(a.id).join(', ') || 'NONE — cannot occur'));

/* THE GATES, READ AT RUN TIME rather than quoted. If Champions ever stops gating one of these on
 * priority, this file must not report a pass — it has stopped testing what it says it tests. */
const HANDLERS = [
  ['armortail', String((dex.abilities.get('armortail') || {}).onFoeTryMove || '')],
  ['queenlymajesty', String((dex.abilities.get('queenlymajesty') || {}).onFoeTryMove || '')],
  ['quickguard', String(((dex.moves.get('quickguard') || {}).condition || {}).onTryHit || '')],
  ['upperhand', String((dex.moves.get('upperhand') || {}).onTry || '')],
  ['psychicterrain', String(((dex.moves.get('psychicterrain') || {}).condition || {}).onTryHit || '')],
];
console.log('  THE GATES, read out of the format at run time — each must still compare a priority:');
let gateBad = 0;
for (const [id, src] of HANDLERS) {
  const ok = /priority/.test(src);
  console.log('    ' + id.padEnd(16) + (src ? (ok ? 'gates on priority' : 'PRESENT BUT NO LONGER GATES ON PRIORITY') : 'MISSING'));
  if (!ok) gateBad++;
}
/* AND THE `all` / `foeSide` EXEMPTION, WHOSE DIRECTION THE PRIOR CARD RECORDED BACKWARDS. Printed
 * rather than asserted, because the refusing branch is unreachable in this regulation and this file
 * wires nothing for it. */
const EXC = ['perishsong', 'flowershield', 'rototiller'];
const allMoves = dex.moves.all().filter(legal).filter(m => m.target === 'all');
const pkCarriers = carriersOf('prankster');
const excLive = EXC.filter(id => legal(dex.moves.get(id)));
const excReach = excLive.filter(id => pkCarriers.some(s => learns(s, id)));
console.log('  DERIVED — `move.target === \'all\'`: ' + allMoves.length + ' legal moves, ALL EXEMPT from '
  + 'the ability bar by the handler\'s first clause except ' + JSON.stringify(EXC) + '.');
console.log('    of those three, legal here: ' + (excLive.join(', ') || 'NONE')
  + ' — and reachable above priority 0.1 (a legal Prankster carrier that learns one): '
  + (excReach.join(', ') || 'NONE, so the refusing branch CANNOT OCCUR and is not wired'));
if (gateBad) {
  console.log(NL + 'NOT RUN — ' + gateBad + ' of the gates this file is about no longer gate on '
    + 'priority. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ------------------------------------------------------------------------------------ */
const sideOf = s => { const m = /^(p[12])/.exec(String(s || '').trim()); return m ? m[1] : 'none'; };
const norm = s => String(s || '').toLowerCase().replace(/^(move|ability|item):\s*/, '').replace(/[^a-z0-9]/g, '');
const RX = {
  cant: /^\|cant\|([^|]*)\|([^|]*)/i,
  dmg: /^\|(-damage|-heal)\|([^|]*)\|([^|/]*\/[^|]*)/i,
  act: /^\|-activate\|([^|]*)\|([^|]*)/i,
  boost: /^\|(-boost|-unboost)\|([^|]*)\|([^|]*)\|([^|]*)/i,
  fail: /^\|-fail\|([^|]*)/i,
  status: /^\|-status\|([^|]*)\|([^|]*)/i,
  move: /^\|move\|([^|]*)\|([^|]*)\|([^|]*)/i,
};
/* SEVEN COUNTED FACTS, taken the same way off both streams and compared TO EACH OTHER — never to a
 * number typed here. `dmg` carries the HP FRACTION, because this defect is board-material and a
 * probe that only compared narration could not say so. Everything is normalised past the two
 * narrators' spelling (`Armor Tail` / `armortail`, `Brave Bird` / `bravebird`) so an arm cannot fail
 * on a display difference, and nothing is normalised past a SIDE, which is what the gates decide. */
function facts(lines) {
  const f = { cant: [], dmg: [], act: [], boost: [], fail: [], status: [], aim: [] };
  for (const raw of (lines || []).map(String)) {
    let m = RX.cant.exec(raw);
    if (m) { f.cant.push(sideOf(m[1]) + '/' + norm(m[2])); continue; }
    m = RX.dmg.exec(raw);
    if (m) { f.dmg.push(sideOf(m[2]) + '/' + String(m[3]).trim()); continue; }
    m = RX.act.exec(raw);
    if (m) { f.act.push(sideOf(m[1]) + '/' + norm(m[2])); continue; }
    m = RX.boost.exec(raw);
    if (m) { f.boost.push(sideOf(m[2]) + '/' + (m[1] === '-boost' ? '+' : '-') + m[3] + m[4]); continue; }
    m = RX.status.exec(raw);
    if (m) { f.status.push(sideOf(m[1]) + '/' + norm(m[2])); continue; }
    m = RX.fail.exec(raw);
    if (m) { f.fail.push(sideOf(m[1])); continue; }
    m = RX.move.exec(raw);
    if (m) { f.aim.push(norm(m[2]) + '->' + sideOf(m[3])); }
  }
  return f;
}
const KEYS = ['cant', 'dmg', 'act', 'boost', 'fail', 'status', 'aim'];
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const agree = (x, y) => KEYS.every(k => same(x[k], y[k]));
const show = f => KEYS.filter(k => f[k].length).map(k => k + '[' + f[k].join(' ') + ']').join('  ') || '(nothing)';

function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const a = G.buildPair(c.A), b = G.buildPair(c.B);
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_priority_modified :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return {
    r, delta,
    sd: facts(G.sdStream(G.lastSdLog())),
    me: facts(r.mediTrace),
    sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).priorityGateStaticRestored || 0,
    unknown: (globalThis.MEDFAILS || {}).priorityShiftCategoryUnknown || 0,
    badCond: (globalThis.MEDFAILS || {}).priorityModUnknownCond || 0,
    silent: (globalThis.MEDFAILS || {}).priorityRefusedSilently || 0,
  };
}

let bad = 0, ran = 0, shiftSeen = 0;
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
  shiftSeen += (clean.delta.priorityGateAbilityShift || 0);

  console.log('    showdown  ' + show(clean.sd));
  console.log('    medicham  ' + show(clean.me));
  console.log('    medicham  ' + show(brk.me) + '   [knob]');
  console.log('    gate read a non-zero ability shift   clean ' + (clean.delta.priorityGateAbilityShift || 0)
    + '   knob ' + ((brk.delta || {}).priorityGateAbilityShift || 0));
  console.log('    MEDFAILS stamp   clean ' + clean.restored + '   knob ' + brk.restored
    + '   |   shift asked with no category ' + clean.unknown
    + '   |   unreadable priorityMod condition ' + clean.badCond
    + '   |   refusal that narrated nothing ' + clean.silent
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
  /* A SHIFT ANSWERED WITHOUT KNOWING THE MOVE'S CATEGORY, OR A CONDITION THIS ENGINE CANNOT READ,
   * IS A SILENT DEFAULT WEARING THE FIX'S CLOTHES. */
  if (clean.unknown || clean.badCond) {
    console.log('    >> A SHIFT WAS ANSWERED BLIND — the fallback fired, so this arm is not evidence.'); bad++;
  }
  /* A BOARD THAT MOVED WITH A SILENT STREAM. Asserted at EXACT zero on the clean load. */
  if (clean.silent) { console.log('    >> A PRIORITY REFUSAL NARRATED NOTHING — no ability held the bar and not the terrain either.'); bad++; }

  if (!agree(clean.sd, clean.me)) { console.log('    >> DEFECT — the two engines disagree.'); bad++; }
  else console.log('    >> the two engines agree, line for line, on all seven facts.');

  if (c.kind === 'red') {
    if (agree(clean.sd, brk.me)) { console.log('    >> THE KNOB DID NOT MOVE ANYTHING — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this arm a red one.');
  } else {
    if (!agree(clean.sd, brk.me)) { console.log('    >> OVER-FIRE — the control moved under the knob, so the change is not confined.'); bad++; }
  }
}

/* THE CAPABILITY MUST PROVE IT RAN. A file that never took a non-zero shift is a file measuring the
 * old behaviour and reporting agreement. */
if (!ONLY && !shiftSeen) {
  console.log(NL + '>> NO ARM EVER READ A NON-ZERO ABILITY SHIFT — the branch under test never executed.');
  bad++;
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
