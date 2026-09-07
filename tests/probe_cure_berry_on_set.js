#!/usr/bin/env node
/* tests/probe_cure_berry_on_set.js — A LUM BERRY EATS INSIDE `setStatus`, NOT AT THE NEXT `Update`
 *   node tests/probe_cure_berry_on_set.js        node tests/probe_cure_berry_on_set.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY. `Pokemon#setStatus` closes on `runEvent('AfterSetStatus', ...)`, and LUM BERRY is an
 * `AfterSetStatus` item — data/items.ts:3541-3544:
 *
 *     onAfterSetStatusPriority: -1,
 *     onAfterSetStatus(status, pokemon) { pokemon.eatItem(); },
 *     onUpdate(pokemon) { if (pokemon.status || pokemon.volatiles['confusion']) pokemon.eatItem(); },
 *
 * `data/mods/champions/items.ts` overrides no berry (grep for `onAfterSetStatus` there returns
 * nothing), so that is this format's Lum Berry and not mainline's.
 *
 * EVERY OTHER CURE BERRY CARRIES `onUpdate` ALONE — Cheri, Pecha, Rawst, Aspear, Chesto — and the
 * authority raises `Update` at the END of an action (sim/battle.ts:2858) and after each hit of the
 * hit loop (sim/battle-actions.ts:967). Both of those are AFTER `spreadMoveHit` has run
 * `runEvent('DamagingHit', ...)` (sim/battle-actions.ts:1121). So the two schedules are DIFFERENT
 * moments and the difference is one whole status: a same-action reaction that wants to set a second
 * status finds a Lum holder ALREADY CURED in the authority, and still statused in an engine that
 * waits for the Update.
 *
 * POISON TOUCH IS THAT REACTION. Measured in the pinned pool before anything moved, release
 * `aa7b80f9a038`, `omit-intimidate ...bo3-2663804350` turn 3 — a board-material game:
 *
 *     showdown   |-status|p2a: Goodra|par   |-enditem|p2a: Goodra|lumberry|[eat]
 *                |-curestatus|p2a: Goodra|par|[msg]
 *                |-status|p2a: Goodra|psn|[from] ability: Poison Touch|[of] p1a: Sneasler
 *                |-damage|p2a: Goodra|57/165 psn|[from] psn
 *     medicham   |-status|p2a: Goodra|par   |upkeep
 *
 * parting `p2.party.goodra.status  medi "" / sd "psn"` and `.hp  medi 77 / sd 57`.
 *
 * THE THREE ARMS, AND THE SECOND AND THIRD ARE WHAT MAKE THE FIRST MEAN ANYTHING:
 *
 *   LUM        the fixture above. The boards must PART under `--red` and agree clean.
 *   NO ITEM    identical in every other respect. The secondary's poison lands, Poison Touch finds a
 *              poisoned body and is refused BY BOTH ENGINES, and the boards agree on both arms. A
 *              fix that made Poison Touch ignore an existing status would part here.
 *   PECHA      cures `psn` and `tox`, `onUpdate` ONLY. The authority ALSO refuses the Poison Touch
 *              poison here, because the berry has not been eaten yet when `DamagingHit` runs — so
 *              this arm is the knob cleared EXPLICITLY: it is a cure berry, it does cure, and it must
 *              still hold. If this parted, the fix would be "berries cure early" rather than
 *              "`onAfterSetStatus` berries cure early", which is a different and wrong rule.
 *
 * THE FIXTURE IS SWEPT, NOT CHOSEN. Poison Jab's secondary is 30% and Poison Touch is 30%, so most
 * contexts show nothing at all — and a context where the AUTHORITY never poisons is indistinguishable
 * from a dead wire. This file sweeps derived targets x lead-in turns until the AUTHORITY emits both
 * the secondary's `-status` and a `[from] ability: Poison Touch` line, prints how many contexts it
 * tried, and REFUSES TO RUN if it finds none.
 *
 * RED FIRST: `MEDI_NO_CURE_ON_SET=1` restores the engine as it stood before this file existed.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE — it is read once at medicham2's module load, and
 * `game_differential.js` loads medicham2 at ITS require time. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_NO_CURE_ON_SET = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* `--state` IS PUSHED BEFORE THE REQUIRE. `playGame` only fills `r.stateDiv` when the run asked for
 * the state comparison; a file that reads it without asking prints "identical" for a board it never
 * compared, which is exactly how two probes shipped asking nothing. */
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED — a bare require is a second module object whose
 * counters nothing writes, and a zero there reads exactly like a wire that never ran. */
const M = REL.require('engine/medicham2-browser.js');
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0, ran = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- 1. THE FIXTURE'S FACTS, ASKED OF THE FORMAT ------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learnset = sp => {
  const out = new Set();
  let s = dex.species.get(sp);
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset) for (const k of Object.keys(e.learnset)) out.add(k);
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return out;
};

let bad = 0;
/* THE ATTACKER IS DERIVED. Every legal carrier of the ability, and every legal contact move it learns
 * that can set a status of its own — the file stages one of them and prints the rest, so a fixture
 * standing on a coincidence says so. */
const PT_CARRIERS = dex.species.all().filter(s => legal(s)
  && Object.values(s.abilities || {}).some(a => dex.abilities.get(a).id === 'poisontouch'));
console.log('  every legal POISON TOUCH carrier, DERIVED: '
  + PT_CARRIERS.map(s => s.name).join(', '));
if (!PT_CARRIERS.some(s => s.id === 'sneasler')) {
  console.log('FIXTURE WRONG — the staged attacker no longer carries Poison Touch'); bad++; }
{
  const pj = dex.moves.get('poisonjab');
  const secs = [].concat(pj.secondaries || (pj.secondary ? [pj.secondary] : []));
  if (!legal(pj) || !pj.flags.contact || pj.accuracy !== 100
      || !secs.some(x => x && x.status === 'psn')) {
    console.log('FIXTURE WRONG — Poison Jab is not the 100-accuracy contact move with a psn secondary '
      + 'this file thinks it is: acc=' + pj.accuracy + ' contact=' + !!pj.flags.contact
      + ' secondaries=' + JSON.stringify(secs)); bad++; }
  else console.log('  the staged move, READ: Poison Jab acc ' + pj.accuracy + ', contact, secondary '
    + JSON.stringify(secs));
  if (!learnset('sneasler').has('poisonjab')) {
    console.log('FIXTURE WRONG — the attacker does not learn it'); bad++; }
}
/* THE TWO BERRIES, AND THE ONE FIELD THAT SEPARATES THEM. The whole claim of this file is that ONE of
 * these has an `onAfterSetStatus` handler and the other does not, so it is read off the format rather
 * than asserted. */
{
  const lum = dex.items.get('lumberry'), pecha = dex.items.get('pechaberry');
  if (!legal(lum) || !lum.onAfterSetStatus) {
    console.log('FIXTURE WRONG — Lum Berry has no onAfterSetStatus in this format'); bad++; }
  else console.log('  lumberry.onAfterSetStatus, READ: '
    + String(lum.onAfterSetStatus).replace(/\s+/g, ' ')
    + '   priority ' + (lum.onAfterSetStatusPriority === undefined ? '(none)' : lum.onAfterSetStatusPriority));
  if (!legal(pecha) || pecha.onAfterSetStatus) {
    console.log('FIXTURE WRONG — Pecha Berry is not the onUpdate-only control this file needs'); bad++; }
  else console.log('  pechaberry.onAfterSetStatus, READ: (none) — onUpdate only: '
    + String(pecha.onUpdate).replace(/\s+/g, ' '));
  /* AND THE TAG THE ENGINE ACTUALLY READS, printed rather than trusted — an over-matching derived
   * param is this project's most repeated defect. */
  const TAGS = require(D('data', 'tags.json'));
  const members = Object.keys(TAGS.items).filter(k => TAGS.items[k].params
    && TAGS.items[k].params.curesStatus);
  console.log('  curesStatus MEMBERSHIP with the new field, DERIVED: ' + members.map(k =>
    k + '(onSet=' + TAGS.items[k].params.curesStatus.onSet + ')').join(' '));
  const onSet = members.filter(k => TAGS.items[k].params.curesStatus.onSet);
  if (onSet.length !== 1 || onSet[0] !== 'lumberry') {
    console.log('FIXTURE WRONG — `curesStatus.onSet` matched ' + JSON.stringify(onSet)
      + ' and the authority gives the handler to lumberry alone'); bad++; }
}
if (bad) { console.log(NL + 'NOT RUN — ' + bad + ' fixture fault(s). This is not a pass.'); process.exit(2); }

/* ---- 2. THE TARGET AND THE FILLERS, DERIVED ------------------------------------------------------ */
const mk = (sp, it, ab, mv) => ({ species: sp, item: it, ability: ab, moves: mv });
const handlerFree = ab => {
  const a = dex.abilities.get(ab);
  /* A TARGET WHOSE OWN ABILITY REACTS TO A STATUS, TO A CONTACT HIT, OR TO AN `Update` WOULD BE
   * ANSWERING THE QUESTION THIS FILE IS ASKING. Filtered by handler SHAPE, not by name, so a new
   * ability in a later regulation is excluded without an edit. */
  return !(a.onSetStatus || a.onAfterSetStatus || a.onDamagingHit || a.onUpdate || a.onImmunity
        || a.onTryAddVolatile || a.onFoeTryEatItem || a.onResidual || a.onModifyMove);
};
/* A SELF-AIMED, NON-STALLING STATUS MOVE, so the target's own click cannot block the hit or change
 * anybody's HP. Protect and its family are excluded by their own `stallingMove` flag. */
const inertClick = sp => {
  for (const id of learnset(sp)) {
    const m = dex.moves.get(id);
    if (!legal(m) || m.category !== 'Status' || m.target !== 'self') continue;
    if (m.stallingMove || m.flags.charge || m.selfSwitch || m.status || m.weather || m.terrain) continue;
    return m.id;
  }
  return null;
};
const CANDIDATES = [];
for (const s of dex.species.all()) {
  if (!legal(s)) continue;
  if (s.types.includes('Poison') || s.types.includes('Steel')) continue;   // must be poisonable
  if (dex.getEffectiveness('Poison', s.types) > 0) continue;               // must survive the jab
  if (s.baseStats.hp + s.baseStats.def < 200) continue;
  const ab = Object.values(s.abilities || {}).find(handlerFree);
  if (!ab) continue;
  const click = inertClick(s.id);
  if (!click) continue;
  CANDIDATES.push({ species: s.name, ability: ab, click });
}
console.log('  ' + CANDIDATES.length + ' derived target(s) that are poisonable, not weak to Poison, '
  + 'bulky, carry a handler-free ability and have an inert self-aimed click');
if (!CANDIDATES.length) { console.log(NL + 'NOT RUN — no staged target could be derived.'); process.exit(2); }

/* THE SECOND FOE IS A POISON-IMMUNE WALL: the lead-in turns aim at it, and Poison Jab cannot touch a
 * Steel type, so nothing about it can enter the assertion. */
const WALL = dex.species.all().filter(s => legal(s) && s.types.includes('Steel')
  && learnset(s.id).has('protect')).sort((a, b) =>
  (b.baseStats.hp + b.baseStats.def) - (a.baseStats.hp + a.baseStats.def))[0];
if (!WALL) { console.log(NL + 'NOT RUN — no Steel wall could be derived.'); process.exit(2); }
console.log('  the second foe, DERIVED: ' + WALL.name + ' (Poison is 0x into it, so the lead-in turns '
  + 'cannot status it and Poison Touch cannot either)');

/* `buildPair` refuses a side that cannot fill all four slots (`picked.length < cap` -> null), so the
 * bench is filled rather than left short. The two benched bodies never act — they exist to make the
 * side buildable, and they are DERIVED (the first legal Steel bodies that learn Protect, so nothing
 * about them can be poisoned, statused or reacted to by the staged turn). */
const BENCH = dex.species.all().filter(s => legal(s) && s.types.includes('Steel')
  && !s.name.includes('-') && learnset(s.id).has('protect')
  && Object.values(s.abilities || {}).some(handlerFree))
  .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 2);
if (BENCH.length < 2) { console.log(NL + 'NOT RUN — no benched fillers could be derived.'); process.exit(2); }
console.log('  the two benched fillers, DERIVED: ' + BENCH.map(s => s.name).join(', ')
  + ' (they never act; they exist because buildPair refuses a side of fewer than four)');
const bench = () => BENCH.map(s => mk(s.name, '', Object.values(s.abilities).find(handlerFree), ['Protect']));

const P = { m: 'protect' };
const JAB_A = { m: 'poisonjab', t: 0 };
const JAB_B = { m: 'poisonjab', t: 1 };
const p1team = [mk('sneasler', '', 'Poison Touch', ['Poison Jab', 'Protect']),
                mk('kingambit', '', 'Defiant', ['Protect'])].concat(bench());
const p2team = (c, item) => [mk(c.species, item, c.ability, [dex.moves.get(c.click).name, 'Protect']),
                             mk(WALL.name, '', Object.values(WALL.abilities)[0], ['Protect'])]
  .concat(bench());
const script = (c, lead) => {
  const rows = [];
  for (let i = 0; i < lead; i++) rows.push({ p1: [JAB_B, P], p2: [{ m: c.click }, P] });
  rows.push({ p1: [JAB_A, P], p2: [{ m: c.click }, P] });
  return rows;
};

/* ---- 3. THE SWEEP — THE AUTHORITY HAS TO BOTH CONNECT AND APPLY ---------------------------------- */
const ptLine = (sp) => new RegExp('^\\|-status\\|p2a: ' + sp + '\\|psn\\|\\[from\\] ability: Poison Touch', 'i');
const secLine = (sp) => new RegExp('^\\|-status\\|p2a: ' + sp + '\\|psn$', 'i');
let PICK = null, tried = 0;
for (const c of CANDIDATES) {
  for (let lead = 0; lead <= 2 && !PICK; lead++) {
    const a = G.buildPair(p1team), b = G.buildPair(p2team(c, 'lumberry'));
    if (!a || !b) continue;
    tried++;
    const r = G.playGame(a, b, 'directed', 'probe_cure_berry_on_set :: sweep ' + c.species + ' lead' + lead,
                         { script: script(c, lead), arm: ARM });
    if (r.err) continue;
    const sd = G.lastSdLog();
    const short = c.species.split('-')[0];
    if (sd.some(l => ptLine(short).test(String(l))) && sd.some(l => secLine(short).test(String(l)))) {
      PICK = { c, lead, short };
    }
  }
  if (PICK) break;
}
console.log(NL + '  SWEEP: ' + tried + ' context(s) played against the AUTHORITY looking for a turn on '
  + 'which it BOTH sets the secondary poison AND then poisons again from Poison Touch');
if (!PICK) {
  console.log(NL + 'NOT RUN — no swept context reached the mechanic in the authority. That is a claim '
    + 'about the fixture, not about the engine, and it is not a pass.');
  process.exit(2);
}
console.log('  SELECTED: ' + PICK.c.species + ' [' + PICK.c.ability + '] clicking ' + PICK.c.click
  + ', ' + PICK.lead + ' lead-in turn(s) aimed at ' + WALL.name);

/* ---- 4. THE ARMS -------------------------------------------------------------------------------- */
const ARMS = [
  { name: 'LUM        the holder is cured inside setStatus, so Poison Touch reaches a clean body',
    item: 'lumberry', part: true, wantPt: true, wantOnSet: 1 },
  { name: 'CONTROL    NO ITEM — Poison Touch is refused by BOTH engines and the boards must hold',
    item: '', part: false, wantPt: false, wantOnSet: 0 },
  { name: 'CONTROL    PECHA — a cure berry with onUpdate ALONE. It cures, it does NOT cure early, and '
        + 'the authority refuses the second poison too',
    item: 'pechaberry', part: false, wantPt: false, wantOnSet: 0 },
];

console.log(NL + (RED ? 'RED ARM — MEDI_NO_CURE_ON_SET=1 (the engine as it stood before the fix)'
                      : 'CLEAN ARM') + NL);
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
let onSetTotal = 0;
for (const A of ARMS) {
  const a = G.buildPair(p1team), b = G.buildPair(p2team(PICK.c, A.item));
  if (!a || !b) { console.log('NOT-STAGED  ' + A.name + '   (this is not a pass)'); fails++; continue; }
  const before = SEEN.berryCuredOnSet || 0;
  const r = G.playGame(a, b, 'directed', 'probe_cure_berry_on_set :: ' + A.name,
                       { script: script(PICK.c, PICK.lead), arm: ARM });
  if (r.err) { console.log('THREW       ' + A.name + '   ' + r.err); fails++; continue; }
  ran++;
  const moved = (SEEN.berryCuredOnSet || 0) - before;
  onSetTotal += moved;
  const sd = G.lastSdLog(), mt = r.mediTrace || [];

  console.log(NL + A.name);
  console.log('    board: ' + (r.stateDiv
    ? 'PARTED at t' + r.stateDiv.turn + '  ' + JSON.stringify(r.stateDiv.diffs.map(d =>
        d.path + ' medi ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown)))
    : 'identical at every boundary'));

  /* THE ARM MUST HAVE STAGED WHAT IT CLAIMS. A secondary that never fired leaves two engines
   * agreeing about nothing at all, and would read exactly like a fix that worked. */
  claim(sd.some(l => secLine(PICK.short).test(String(l))),
    A.name.slice(0, 10).trim() + ' — the AUTHORITY set the secondary poison on the staged turn',
    'this is the knob that moves the fixture: without it the rule under test is never reached');
  claim(sd.some(l => ptLine(PICK.short).test(String(l))) === A.wantPt,
    A.name.slice(0, 10).trim() + ' — the AUTHORITY ' + (A.wantPt ? 'DID' : 'did NOT')
      + ' poison again from Poison Touch',
    'showdown lines matching `[from] ability: Poison Touch`: '
      + sd.filter(l => ptLine(PICK.short).test(String(l))).length);
  /* AND THE ENGINE HAS TO AGREE ABOUT THAT SECOND POISON, not merely about the board. */
  const meFrom = new RegExp('^\\|-status\\|p2a: ' + PICK.short + '\\|psn\\|\\[from\\] ability: ', 'i');
  if (!RED) claim(mt.some(l => meFrom.test(String(l))) === A.wantPt,
    A.name.slice(0, 10).trim() + ' — and THIS engine ' + (A.wantPt ? 'DID' : 'did NOT') + ' too',
    'medicham lines: ' + mt.filter(l => meFrom.test(String(l))).length);

  const want = RED ? !A.part : true;
  claim((!r.stateDiv) === want,
    A.name.slice(0, 10).trim() + ' — the boards agree'
      + (RED ? (A.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    r.stateDiv ? 'parted at t' + r.stateDiv.turn : 'identical at every boundary');

  if (!RED) claim(moved === A.wantOnSet,
    A.name.slice(0, 10).trim() + ' — the new pass fired exactly ' + A.wantOnSet + ' time(s) on this arm',
    'MEDSEEN.berryCuredOnSet moved by ' + moved);
}

/* ---- 5. THE ENGINE'S OWN RECEIPTS --------------------------------------------------------------- */
if (RED) {
  claim((FAILS.cureOnSetSkipped || 0) === 1,
    'the revert knob was actually READ by the engine — the clause under test was REACHED',
    'MEDFAILS.cureOnSetSkipped = ' + (FAILS.cureOnSetSkipped || 0));
  claim((SEEN.berryCuredOnSet || 0) === 0,
    'and nothing was cured at set time under the revert',
    'MEDSEEN.berryCuredOnSet = ' + (SEEN.berryCuredOnSet || 0));
} else {
  claim((FAILS.cureOnSetSkipped || 0) === 0,
    'no revert knob is in play on the clean arm',
    'MEDFAILS.cureOnSetSkipped = ' + (FAILS.cureOnSetSkipped || 0));
  claim(onSetTotal === 1,
    'the new pass consumed exactly ONE berry across the three arms, and it was the LUM arm',
    'MEDSEEN.berryCuredOnSet moved by ' + onSetTotal
      + '  (0 means the pass is present and dead; 2 or more means it fired on an arm whose berry has '
      + 'no onAfterSetStatus handler at all)');
}

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed over ' + ran + ' staged games'
                        : 'GREEN — every claim held over ' + ran + ' staged games'));
process.exit(fails ? 1 : 0);
