/* probe_two_gates.js — TWO GATES THE AUTHORITY HAS AND THIS ENGINE DOES NOT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_two_gates.js
 *   ... --only smackdown | --only belch
 *
 * DIAGNOSTIC, WRITTEN BEFORE THE FIX AND EXPECTED RED. It asserts and exits non-zero. Nothing here
 * is applied to the engine; this file is the failing measurement the fix has to turn green.
 *
 * =========================== A — SMACK DOWN'S onStart REFUSES A GROUNDED BODY =====================
 *
 * `data/mods/champions/moves.ts` carries NO `smackdown` key (only learnsets do), so mainline's is
 * what this format runs — checked with a grep of the whole mod directory, not assumed.
 *
 *     data/moves.ts:16958-16989   smackdown.condition.onStart(pokemon) {
 *       let applies = false;
 *       if (pokemon.hasType('Flying') || pokemon.hasAbility(['levitate','eelevate'])) applies = true;
 *       if (pokemon.hasItem('ironball') || pokemon.volatiles['ingrain'] ||
 *           this.field.getPseudoWeather('gravity')) applies = false;
 *       if (pokemon.removeVolatile('fly') || pokemon.removeVolatile('bounce')) {
 *         applies = true; this.queue.cancelMove(pokemon); pokemon.removeVolatile('twoturnmove'); }
 *       if (pokemon.volatiles['magnetrise']) { applies = true; delete pokemon.volatiles['magnetrise']; }
 *       if (pokemon.volatiles['telekinesis']) { applies = true; delete pokemon.volatiles['telekinesis']; }
 *       if (!applies) return false;
 *       this.add('-start', pokemon, 'Smack Down'); }
 *
 * "AIRBORNE" HERE IS **NOT** `isGrounded()`, AND WRITING THE GATE THAT WAY WOULD BE A NEW DEFECT.
 * The clauses are ORDERED and the last three can put `applies` back to true after a negator has
 * cleared it. The counterexample is staged below as its own cell: a body holding an IRON BALL with
 * MAGNET RISE up is `isGrounded() === true`, and the authority applies Smack Down anyway (and eats
 * the Magnet Rise). Measured, not argued.
 *
 * TELEKINESIS IS UNREACHABLE IN THIS REGULATION (`isNonstandard: 'Past'`) and so is AIR BALLOON, and
 * Smack Down's onStart never asks about Air Balloon in the first place. Both are stated rather than
 * silently dropped.
 *
 * THE LEAD FINDING, WHICH IS ABOUT THE INSTRUMENT AND NOT THE ENGINE. `volatile:smackdown` is NOT in
 * `board_state.js`'s compared-key set AND NOT in its `NOT_COMPARED` declaration list, so it is an
 * UNLISTED omission — the exact case that file's own header says reads as agreement. Any
 * ANNOUNCEMENT-ONLY verdict on a Smack Down row is therefore unearned in both directions. This probe
 * does not need that leaf: it lands the divergence on `magnetrise`, which IS compared.
 *
 * =========================== B — BELCH IS NOT GATED ON HAVING EATEN A BERRY =======================
 *
 * CHAMPIONS OVERRIDES BELCH AND THE OVERRIDE IS THE WHOLE POINT (data/mods/champions/moves.ts:52-58):
 *
 *     belch: { inherit: true, onDisableMove: undefined, // no inherit
 *              shortDesc: "Fails unless the user has eaten a Berry." }
 *
 * So mainline's `onDisableMove(pokemon) { if (!pokemon.ateBerry) pokemon.disableMove('belch'); }` is
 * DELETED and only `onTry(source) { return source.ateBerry; }` (data/moves.ts:1209-1211) survives.
 * The click is OFFERED — `|request|` carries `"disabled":false` with `ateBerry === false` — and the
 * move then FAILS at use time:
 *
 *     |move|p1a: Salazzle|Belch||[still]
 *     |-fail|p1a: Salazzle
 *
 * THE BRIEF SAID "THE AUTHORITY REFUSES THE CLICK OUTRIGHT" AND THAT IS THE MAINLINE RULE, NOT THIS
 * ONE. It matters: a fix in the move-selection filter would make our menu disagree with Showdown's
 * and would emit no lines at all where the authority emits two. The menu arm below asserts that both
 * engines keep offering it, so a fix cannot pass by greying the button out.
 *
 * THE ROSTER ROW WAS GREEN FOR TWO REASONS AT ONCE. `tests/roster.js`'s fixture feeds the body a
 * berry before the click, so the authority's gate is OPEN and ours is ABSENT and the boards agree —
 * and planting `_ateBerry = false` moves nothing, because `_ateBerry` is written in `consumeBerry`
 * and read in exactly one other place in the whole simulator (Harvest). Every cell below is printed
 * with the number of reasons it qualifies for and a cell with more than one is refused.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('TWO GATES');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const BS = require(D('engine', 'board_state.js'));
const { Battle, Teams, Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const { mcKey } = require(D('engine', 'mc_key.js'));

const ONLY = (() => { const i = process.argv.indexOf('--only');
                      return i > 0 ? String(process.argv[i + 1] || '') : ''; })();

let red = 0, fixtureFail = 0;
const FAIL = (m) => { red++; console.log('    RED   ' + m); };
const OK = (m) => console.log('    green ' + m);
const STAGE = (m) => { fixtureFail++; console.log('    FIXTURE ' + m); };

/* ---- shared staging ---------------------------------------------------------------------------
 * Four DISTINCT species per side (Species Clause) and the three passengers click Protect, which is
 * legal here and, unlike Transform, still exists on the body on turn two — the first draft used
 * Ditto and every turn-2 choice was rejected with "your Ditto doesn't have a move matching
 * transform", which is a COULD-NOT-STAGE masquerading as a result. */
const PALS = ['Venusaur', 'Charizard', 'Blastoise', 'Beedrill', 'Pidgeot', 'Arbok'];
const PALM = 'Protect';
const HPX = 40;                       /* nothing may faint and nothing may reach a berry threshold */

const sdSet = (n, mv, item) => ({
  name: n, species: n, item: item || '', ability: dex.species.get(n).abilities[0], moves: mv,
  nature: 'Serious', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50,
});
function sdBattle(teamA, teamB) {
  const b = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(teamA) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(teamB) });
  b.choose('p1', 'team 1234'); b.choose('p2', 'team 1234');
  return b;
}
const mediMon = (species, mv, item) => {
  const x = MEDI.buildMon(mcKey(species, { mayMiss: 'a probe cast must resolve; a miss is a FAILED '
    + 'fixture, never a substitution' }), {});
  if (!x) throw new Error('buildMon failed for ' + species);
  x.moves = mv.map(m => dex.moves.get(m).id);
  x.item = item || '';
  return x;
};
const STREAMS = { any: () => 0.5, acc: () => 0, crit: () => 0.999, sec: () => 0.999,
                  dmg: () => 0.5, stall: () => 0.999, tie: () => 0, split: true, seed: null };
const mediActs = (S, own, foes, want) => { const map = new Map();
  own.forEach((mon, i) => { if (!mon) return;
    const w = want[i];
    if (!w) { map.set(mon, { kind: 'pass' }); return; }
    map.set(mon, MEDI.playerAction(mon, w.m, w.t != null ? foes[w.t] : (foes[0] || null), S.field)); });
  return map; };
const payload = (line) => String(line).split('|')[3] || '';
/* 2026-08-27 -- THE `-start` LINE THIS CELL IS ABOUT, NOT THE FIRST ONE OF THE TURN.
 *
 * §4 used `find(/^\|-start\|p2a/)` and therefore compared whatever the TARGET's own idle click
 * happened to write. Rotom-Heat cannot learn Iron Defense, so `firstLegalMove` handed it CHARGE, and
 * the `levitate` cell reported `authority "Charge" / ours "move: charge"` — a real divergence in a
 * DIFFERENT mechanic, filed against Smack Down. `charge` is deliberately refused by the
 * `volatileAnnounce` deriver (only one of its two branches carries the argument), so that gap is
 * pre-existing and belongs to the narration batch; it is not what this section measures.
 *
 * A fixture that answers about the wrong move is the same failure as one that qualifies for two
 * reasons: it is an instrument reporting confidently about something it did not stage. */
const startOf = (lines, vol, label) => {
  const want = [label, 'move: ' + vol, vol].filter(Boolean).map(x => String(x).toLowerCase());
  for (const l of lines) {
    if (!/^\|-start\|p2a/.test(String(l))) continue;
    const p = payload(l);
    if (want.includes(String(p).toLowerCase())) return p;
  }
  return null;
};

/* =================================================================================================
 * A — SMACK DOWN
 * ============================================================================================== */
function smackdown() {
  console.log('\n== A — SMACK DOWN STARTS ITS VOLATILE ON A GROUNDED BODY ==\n');

  /* §0 THE INSTRUMENT, ASKED FIRST. Four of tonight's accusations were the ruler, so the ruler is
   *    read before the engine is accused of anything. */
  const seen = BS.SD_VOLATILE_KEYS.includes('smackdown');
  const declared = (BS.NOT_COMPARED || []).some(r => /smack ?down/i.test(JSON.stringify(r)));
  console.log('  CAN THE COMPARATOR SEE THIS LEAF AT ALL?');
  console.log('    board_state.js compares `volatile:smackdown` : ' + seen);
  console.log('    board_state.js DECLARES it uncompared          : ' + declared);
  console.log('    => an ANNOUNCEMENT-ONLY verdict on a Smack Down row is ' +
              (seen ? 'earned' : 'UNEARNED — the leaf is an unlisted omission'));
  console.log('    this probe therefore lands its board claim on `magnetrise`, compared: ' +
              BS.SD_VOLATILE_KEYS.includes('magnetrise'));

  /* §1 THE CELLS. Each is printed with the number of LIFT reasons it carries and a cell carrying
   *    more than one is refused — a fixture that qualifies twice proves nothing. */
  const CLICKER = 'Tyranitar';
  const CELLS = [
    { id: 'plain-grounded',   target: 'Snorlax',     item: '',         vol: null },
    { id: 'flying',           target: 'Corviknight', item: '',         vol: null },
    { id: 'levitate',         target: 'Rotom-Heat',  item: '',         vol: null },
    { id: 'flying+ironball',  target: 'Corviknight', item: 'ironball', vol: null },
    { id: 'levit+ironball',   target: 'Rotom-Heat',  item: 'ironball', vol: null },
    { id: 'flying+gravity',   target: 'Corviknight', item: '',         vol: 'gravity' },
    { id: 'magnetrise',       target: 'Forretress',  item: '',         vol: 'magnetrise' },
    { id: 'ironball+magrise', target: 'Forretress',  item: 'ironball', vol: 'magnetrise' },
  ];
  const liftReasons = (spName, vol) => {
    const s = dex.species.get(spName);
    const out = [];
    if (s.types.includes('Flying')) out.push('Flying-type');
    if (['levitate', 'eelevate'].includes(dex.abilities.get(s.abilities[0]).id)) out.push('Levitate');
    if (vol === 'magnetrise' || vol === 'fly' || vol === 'bounce') out.push(vol);
    return out;
  };
  const IDLE = 'Iron Defense';
  if (!CS.canLearn(CLICKER, 'Smack Down')) { STAGE(CLICKER + ' cannot learn Smack Down'); return; }

  console.log('\n  cell                lift reasons        authority        ours');
  const applied = { sd: new Set(), us: new Set() };
  const startPayload = { sd: new Map(), us: new Map() };
  for (const c of CELLS) {
    const lift = liftReasons(c.target, c.vol);
    if (lift.length > 1) { STAGE(c.id + ' qualifies for ' + lift.length + ' reasons: ' + lift.join('+')); continue; }
    const tIdle = CS.canLearn(c.target, IDLE) ? IDLE : CS.firstLegalMove(c.target);
    if (!tIdle) { STAGE('no idle move for ' + c.target); continue; }

    /* authority */
    let sdVol, sdStart;
    {
      const A = [sdSet(CLICKER, ['Smack Down', IDLE]), sdSet(PALS[0], [PALM]), sdSet(PALS[1], [PALM]), sdSet(PALS[2], [PALM])];
      const B = [sdSet(c.target, [tIdle], c.item), sdSet(PALS[3], [PALM]), sdSet(PALS[4], [PALM]), sdSet(PALS[5], [PALM])];
      const b = sdBattle(A, B);
      const tgt = b.p2.active[0];
      tgt.maxhp *= HPX; tgt.hp = tgt.maxhp;
      if (c.vol === 'gravity') b.field.addPseudoWeather('gravity', b.p1.active[0]);
      else if (c.vol) tgt.addVolatile(c.vol, tgt);
      const mark = b.log.length;
      const o1 = b.choose('p1', 'move smackdown 1, move protect');
      const o2 = b.choose('p2', 'move ' + dex.moves.get(tIdle).id + ', move protect');
      if (!o1 || !o2) { STAGE(c.id + ' authority rejected the choice: ' + b.p1.choice.error + b.p2.choice.error); continue; }
      sdVol = 'smackdown' in tgt.volatiles;
      sdStart = startOf(b.log.slice(mark), 'smackdown', 'Smack Down');
      if (sdVol) applied.sd.add(c.id);
      if (sdStart) startPayload.sd.set(c.id, sdStart);
    }
    /* ours */
    let usVol, usStart;
    {
      const A = [mediMon(CLICKER, ['Smack Down', IDLE]), mediMon(PALS[0], [PALM]), mediMon(PALS[1], [PALM]), mediMon(PALS[2], [PALM])];
      const B = [mediMon(c.target, [tIdle], c.item), mediMon(PALS[3], [PALM]), mediMon(PALS[4], [PALM]), mediMon(PALS[5], [PALM])];
      B[0].st.hp *= HPX; B[0].curHP = B[0].st.hp;
      const trace = [];
      const S = MEDI.battleInit(A, B, { trace });
      const tgt = S.actB[0];
      if (c.vol === 'gravity') S.field.gravity = 5;
      else if (c.vol) (tgt._vol = tgt._vol || {})[c.vol] = 5;
      MEDI.battleTurn(S, STREAMS,
        mediActs(S, S.actA, S.actB, [{ m: 'smackdown', t: 0 }, { m: 'protect' }]),
        mediActs(S, S.actB, S.actA, [{ m: dex.moves.get(tIdle).id }, { m: 'protect' }]));
      usVol = !!(tgt._vol && tgt._vol.smackdown);
      usStart = startOf(trace.map(String), 'smackdown', 'Smack Down');
      if (usVol) applied.us.add(c.id);
      if (usStart) startPayload.us.set(c.id, usStart);
    }
    console.log('  ' + c.id.padEnd(18) + (lift.join('+') || '(none)').padEnd(20) +
                (sdVol ? 'APPLIES' : 'refuses').padEnd(17) + (usVol ? 'APPLIES' : 'refuses'));
  }

  /* §2 THE CONTROL, CLEARED EXPLICITLY. If nothing applies on either side the probe is measuring a
   *    harness that cannot do Smack Down, not a missing gate. */
  const control = ['flying', 'levitate'].every(id => applied.sd.has(id) && applied.us.has(id));
  if (!control) { STAGE('CONTROL: the two airborne cells did not apply on BOTH engines — the staging is broken'); }
  else OK('CONTROL: `flying` and `levitate` apply on both engines, so the knob is live');

  /* §3 THE GATE. */
  const extra = [...applied.us].filter(x => !applied.sd.has(x));
  const missing = [...applied.sd].filter(x => !applied.us.has(x));
  if (extra.length) FAIL('we start the volatile where the authority refuses it: ' + extra.join(', '));
  else OK('no cell starts the volatile where the authority refuses it');
  if (missing.length) FAIL('the authority starts it and we do not: ' + missing.join(', '));

  /* §4 THE LINE. `this.add('-start', pokemon, 'Smack Down')` — a BARE label. We fall through to the
   *    `move: <vol>` default because `volatileAnnounce` cannot read a guarded multi-statement
   *    onStart, so smackdown is not in that tag's 49 members. */
  for (const id of applied.sd) {
    const a = startPayload.sd.get(id), o = startPayload.us.get(id);
    if (a && o && a !== o) { FAIL('`-start` payload on ' + id + ': authority "' + a + '" / ours "' + o + '"'); break; }
  }

  /* §5 BOARD-MATERIAL, ON A LEAF THE COMPARATOR ALREADY READS. Smack Down into a plainly grounded
   *    Klefki, then Klefki clicks Magnet Rise. Magnet Rise's own onTry refuses while `smackdown` is
   *    up (data/moves.ts magnetrise: `if (target.volatiles['smackdown'] || target.volatiles['ingrain'])
   *    return false;`), so our phantom volatile costs the target its Magnet Rise. */
  console.log('\n  §5 the compared leaf — Smack Down into a grounded Klefki, then Magnet Rise');
  const T2 = 'Klefki';
  if (!CS.canLearn(T2, 'Magnet Rise')) { STAGE(T2 + ' cannot learn Magnet Rise'); }
  else if (liftReasons(T2, null).length) { STAGE(T2 + ' is not a plainly grounded body'); }
  else {
    let sdMag, usMag;
    {
      const A = [sdSet(CLICKER, ['Smack Down', IDLE]), sdSet(PALS[0], [PALM]), sdSet(PALS[1], [PALM]), sdSet(PALS[2], [PALM])];
      const B = [sdSet(T2, ['Magnet Rise', IDLE]), sdSet(PALS[3], [PALM]), sdSet(PALS[4], [PALM]), sdSet(PALS[5], [PALM])];
      const b = sdBattle(A, B);
      const tgt = b.p2.active[0]; tgt.maxhp *= HPX; tgt.hp = tgt.maxhp;
      b.choose('p1', 'move smackdown 1, move protect');
      b.choose('p2', 'move ' + dex.moves.get(IDLE).id + ', move protect');
      b.choose('p1', 'move ' + dex.moves.get(IDLE).id + ', move protect');
      b.choose('p2', 'move magnetrise, move protect');
      sdMag = 'magnetrise' in tgt.volatiles;
    }
    {
      const A = [mediMon(CLICKER, ['Smack Down', IDLE]), mediMon(PALS[0], [PALM]), mediMon(PALS[1], [PALM]), mediMon(PALS[2], [PALM])];
      const B = [mediMon(T2, ['Magnet Rise', IDLE]), mediMon(PALS[3], [PALM]), mediMon(PALS[4], [PALM]), mediMon(PALS[5], [PALM])];
      B[0].st.hp *= HPX; B[0].curHP = B[0].st.hp;
      const S = MEDI.battleInit(A, B, { trace: [] });
      const tgt = S.actB[0];
      MEDI.battleTurn(S, STREAMS,
        mediActs(S, S.actA, S.actB, [{ m: 'smackdown', t: 0 }, { m: 'protect' }]),
        mediActs(S, S.actB, S.actA, [{ m: dex.moves.get(IDLE).id }, { m: 'protect' }]));
      MEDI.battleTurn(S, STREAMS,
        mediActs(S, S.actA, S.actB, [{ m: dex.moves.get(IDLE).id }, { m: 'protect' }]),
        mediActs(S, S.actB, S.actA, [{ m: 'magnetrise' }, { m: 'protect' }]));
      usMag = !!(tgt._vol && tgt._vol.magnetrise);
    }
    console.log('     board leaf `magnetrise` — authority ' + sdMag + ' / ours ' + usMag);
    if (sdMag !== usMag) FAIL('BOARD-MATERIAL: `magnetrise` parts on a leaf board_state.js compares');
    else OK('`magnetrise` agrees');
  }

  /* §6 THE CONSUME. When it legitimately applies to a Magnet-Risen body the authority DELETES
   *    magnetrise; the cell above already prints it, so it is asserted directly here. */
  console.log('\n  §6 the consume — Smack Down onto a body that is up on Magnet Rise');
  {
    const T3 = 'Forretress';
    let sdAfter, usAfter;
    {
      const A = [sdSet(CLICKER, ['Smack Down', IDLE]), sdSet(PALS[0], [PALM]), sdSet(PALS[1], [PALM]), sdSet(PALS[2], [PALM])];
      const B = [sdSet(T3, [IDLE]), sdSet(PALS[3], [PALM]), sdSet(PALS[4], [PALM]), sdSet(PALS[5], [PALM])];
      const b = sdBattle(A, B);
      const tgt = b.p2.active[0]; tgt.maxhp *= HPX; tgt.hp = tgt.maxhp;
      tgt.addVolatile('magnetrise', tgt);
      b.choose('p1', 'move smackdown 1, move protect');
      b.choose('p2', 'move ' + dex.moves.get(IDLE).id + ', move protect');
      sdAfter = 'magnetrise' in tgt.volatiles;
    }
    {
      const A = [mediMon(CLICKER, ['Smack Down', IDLE]), mediMon(PALS[0], [PALM]), mediMon(PALS[1], [PALM]), mediMon(PALS[2], [PALM])];
      const B = [mediMon(T3, [IDLE]), mediMon(PALS[3], [PALM]), mediMon(PALS[4], [PALM]), mediMon(PALS[5], [PALM])];
      B[0].st.hp *= HPX; B[0].curHP = B[0].st.hp;
      const S = MEDI.battleInit(A, B, { trace: [] });
      const tgt = S.actB[0];
      (tgt._vol = tgt._vol || {}).magnetrise = 5;
      MEDI.battleTurn(S, STREAMS,
        mediActs(S, S.actA, S.actB, [{ m: 'smackdown', t: 0 }, { m: 'protect' }]),
        mediActs(S, S.actB, S.actA, [{ m: dex.moves.get(IDLE).id }, { m: 'protect' }]));
      usAfter = !!(tgt._vol && tgt._vol.magnetrise);
    }
    console.log('     `magnetrise` still up after Smack Down — authority ' + sdAfter + ' / ours ' + usAfter);
    if (sdAfter !== usAfter) FAIL('BOARD-MATERIAL: Smack Down does not CONSUME magnetrise here');
    else OK('the consume agrees');
  }

  /* §7 THE CANCEL. A body mid-Bounce loses the queued move entirely on the authority. Azumarill is
   *    Water/Fairy with Thick Fat, so `bounce` is its ONLY lift reason. */
  console.log('\n  §7 the cancel — Smack Down onto a body committed to Bounce');
  {
    const T4 = 'Azumarill';
    if (!CS.canLearn(T4, 'Bounce') || liftReasons(T4, null).length) STAGE(T4 + ' is not a one-reason Bounce carrier');
    else {
      let sdRan, usRan;
      {
        const A = [sdSet(CLICKER, ['Smack Down', IDLE]), sdSet(PALS[0], [PALM]), sdSet(PALS[1], [PALM]), sdSet(PALS[2], [PALM])];
        const B = [sdSet(T4, ['Bounce']), sdSet(PALS[3], [PALM]), sdSet(PALS[4], [PALM]), sdSet(PALS[5], [PALM])];
        const b = sdBattle(A, B);
        const tgt = b.p2.active[0], atk = b.p1.active[0];
        tgt.maxhp *= HPX; tgt.hp = tgt.maxhp; atk.maxhp *= HPX; atk.hp = atk.maxhp;
        b.choose('p2', 'move bounce 1, move protect');
        b.choose('p1', 'move ' + dex.moves.get(IDLE).id + ', move protect');
        const mark = b.log.length;
        b.choose('p2', 'move bounce 1, move protect');
        b.choose('p1', 'move smackdown 1, move protect');
        sdRan = b.log.slice(mark).some(l => /^\|move\|p2a:.*\|Bounce/.test(l));
      }
      {
        const A = [mediMon(CLICKER, ['Smack Down', IDLE]), mediMon(PALS[0], [PALM]), mediMon(PALS[1], [PALM]), mediMon(PALS[2], [PALM])];
        const B = [mediMon(T4, ['Bounce']), mediMon(PALS[3], [PALM]), mediMon(PALS[4], [PALM]), mediMon(PALS[5], [PALM])];
        B[0].st.hp *= HPX; B[0].curHP = B[0].st.hp; A[0].st.hp *= HPX; A[0].curHP = A[0].st.hp;
        const trace = [];
        const S = MEDI.battleInit(A, B, { trace });
        MEDI.battleTurn(S, STREAMS,
          mediActs(S, S.actA, S.actB, [{ m: dex.moves.get(IDLE).id }, { m: 'protect' }]),
          mediActs(S, S.actB, S.actA, [{ m: 'bounce', t: 0 }, { m: 'protect' }]));
        const mark = trace.length;
        MEDI.battleTurn(S, STREAMS,
          mediActs(S, S.actA, S.actB, [{ m: 'smackdown', t: 0 }, { m: 'protect' }]),
          mediActs(S, S.actB, S.actA, [{ m: 'bounce', t: 0 }, { m: 'protect' }]));
        usRan = trace.slice(mark).some(l => /^\|move\|p2a:.*\|bounce/.test(String(l)));
      }
      console.log('     the committed Bounce still executes — authority ' + sdRan + ' / ours ' + usRan);
      if (sdRan !== usRan) FAIL('BOARD-MATERIAL: Smack Down does not CANCEL the committed move here');
      else OK('the cancel agrees');
    }
  }
}

/* =================================================================================================
 * B — BELCH
 * ============================================================================================== */
function belch() {
  console.log('\n== B — BELCH IS NOT GATED ON HAVING EATEN A BERRY ==\n');

  /* §0 THE FORMAT'S OWN RULE, DERIVED. If Champions ever restores onDisableMove this probe's whole
   *    argument changes, so it is read rather than quoted. */
  const mv = dex.moves.get('belch');
  const menuDisabled = typeof mv.onDisableMove === 'function';
  console.log('  Champions belch: onTry present ' + (typeof mv.onTry === 'function') +
              ' / onDisableMove a function ' + menuDisabled +
              '  => the gate is at ' + (menuDisabled ? 'SELECTION and USE' : 'USE ONLY'));
  if (menuDisabled) STAGE('this format DOES disable the menu entry — the premise below is wrong');

  const CLICKER = 'Salazzle', FOE = 'Snorlax', BERRY = 'sitrusberry', IDLE = 'Iron Defense';
  if (!CS.canLearn(CLICKER, 'Belch')) { STAGE(CLICKER + ' cannot learn Belch'); return; }

  /* §1 THE MENU. Both engines must keep OFFERING it, so a fix cannot pass by greying the button. */
  {
    const A = [sdSet(CLICKER, ['Belch', IDLE]), sdSet(PALS[0], [PALM]), sdSet(PALS[1], [PALM]), sdSet(PALS[2], [PALM])];
    const B = [sdSet(FOE, [IDLE]), sdSet(PALS[3], [PALM]), sdSet(PALS[4], [PALM]), sdSet(PALS[5], [PALM])];
    const b = sdBattle(A, B);
    const slot = ((b.p1.activeRequest || {}).active || [])[0];
    const row = slot && slot.moves.find(m => m.id === 'belch');
    console.log('  authority request slot with ateBerry=false: ' + JSON.stringify(row));
    if (!row || row.disabled) FAIL('the authority DID grey the menu entry out — re-read the mod');
    else OK('the authority still offers the click, so the fix belongs at USE time');
  }

  /* §2 THE OUTCOME, NOT THE CLASSIFICATION. Two arms over ONE knob — has this body ever eaten a
   *    berry — and the knob is turned by a REAL eat on both engines, never by a plant, because a
   *    planted flag is exactly what #514 says nothing reads. */
  function authorityDamage(eatFirst) {
    const A = [sdSet(CLICKER, ['Belch', IDLE], eatFirst ? BERRY : ''), sdSet(PALS[0], [PALM]), sdSet(PALS[1], [PALM]), sdSet(PALS[2], [PALM])];
    const B = [sdSet(FOE, [IDLE]), sdSet(PALS[3], [PALM]), sdSet(PALS[4], [PALM]), sdSet(PALS[5], [PALM])];
    const b = sdBattle(A, B);
    const src = b.p1.active[0], tgt = b.p2.active[0];
    tgt.maxhp *= HPX; tgt.hp = tgt.maxhp;
    /* turn 1 exists in BOTH arms so the two arms differ only in the berry */
    if (eatFirst) src.hp = 1;                       /* drops it under half -> the Sitrus is eaten */
    b.choose('p1', 'move ' + dex.moves.get(IDLE).id + ', move protect');
    b.choose('p2', 'move ' + dex.moves.get(IDLE).id + ', move protect');
    const ate = src.ateBerry;
    const before = tgt.hp, mark = b.log.length;
    b.choose('p1', 'move belch 1, move protect');
    b.choose('p2', 'move ' + dex.moves.get(IDLE).id + ', move protect');
    const failed = b.log.slice(mark).some(l => /^\|-fail\|p1a/.test(l));
    return { ate, dmg: before - tgt.hp, failed };
  }
  function ourDamage(eatFirst) {
    const A = [mediMon(CLICKER, ['Belch', IDLE], eatFirst ? BERRY : ''), mediMon(PALS[0], [PALM]), mediMon(PALS[1], [PALM]), mediMon(PALS[2], [PALM])];
    const B = [mediMon(FOE, [IDLE]), mediMon(PALS[3], [PALM]), mediMon(PALS[4], [PALM]), mediMon(PALS[5], [PALM])];
    B[0].st.hp *= HPX; B[0].curHP = B[0].st.hp;
    const trace = [];
    const S = MEDI.battleInit(A, B, { trace });
    const src = S.actA[0], tgt = S.actB[0];
    if (eatFirst) src.curHP = 1;
    MEDI.battleTurn(S, STREAMS,
      mediActs(S, S.actA, S.actB, [{ m: dex.moves.get(IDLE).id }, { m: 'protect' }]),
      mediActs(S, S.actB, S.actA, [{ m: dex.moves.get(IDLE).id }, { m: 'protect' }]));
    const ate = !!src._ateBerry;
    const before = tgt.curHP, mark = trace.length;
    MEDI.battleTurn(S, STREAMS,
      mediActs(S, S.actA, S.actB, [{ m: 'belch', t: 0 }, { m: 'protect' }]),
      mediActs(S, S.actB, S.actA, [{ m: dex.moves.get(IDLE).id }, { m: 'protect' }]));
    const failed = trace.slice(mark).some(l => /^\|-fail\|p1a/.test(String(l)));
    return { ate, dmg: before - tgt.curHP, failed };
  }

  const arms = [{ eat: false, id: 'never ate a berry' }, { eat: true, id: 'ate a Sitrus on turn 1' }];
  const got = [];
  console.log('\n  arm                     ateBerry(sd/us)   damage(sd/us)   -fail(sd/us)');
  for (const a of arms) {
    const s = authorityDamage(a.eat), o = ourDamage(a.eat);
    got.push({ a, s, o });
    console.log('  ' + a.id.padEnd(24) + (s.ate + '/' + o.ate).padEnd(18) +
                (s.dmg + '/' + o.dmg).padEnd(16) + (s.failed + '/' + o.failed));
  }
  const [no, yes] = got;
  /* THE KNOB MUST HAVE MOVED IN THE AUTHORITY, OR THIS IS A BROKEN FIXTURE AND NOT A DEFECT. */
  if (!(no.s.ate === false && yes.s.ate === true)) STAGE('the berry knob did not move on the authority');
  else if (!(no.s.dmg === 0 && yes.s.dmg > 0)) STAGE('the authority did not answer 0 then >0 — the fixture is wrong');
  else {
    OK('the authority answers 0 damage with no berry and ' + yes.s.dmg + ' after one');
    if (no.o.dmg !== 0) FAIL('BOARD-MATERIAL: with no berry ever eaten we deal ' + no.o.dmg +
                             ' where the authority deals 0');
    else OK('we deal 0 with no berry eaten');
    if (no.o.dmg === yes.o.dmg) FAIL('IDENTICAL DAMAGE ACROSS THE KNOB (' + no.o.dmg +
                                     ') — nothing in this engine reads the berry latch');
    if (yes.o.dmg === 0) FAIL('the CONTROL is dead: we deal 0 even after a real berry eat');
    if (no.s.failed && !no.o.failed) FAIL('the authority writes |-fail| on the mover and we write nothing');
  }

  /* §3 THE POPULATION, PRINTED BEFORE ANY TAG IS WIRED. The shape is
   *    `onTry(source) { return source.<field>; }` — a bare boolean read of a persistent user latch. */
  const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const shape = /^\s*onTry\s*\(\s*source\s*\)\s*\{\s*return\s+source\.([A-Za-z_$][\w$]*)\s*;?\s*\}\s*$/;
  const members = dex.moves.all().filter(legal)
    .map(m => ({ m, g: shape.exec(String(m.onTry || '').replace(/\r/g, '')) }))
    .filter(x => x.g);
  console.log('\n  §3 what a `onTry(source){ return source.<latch>; }` tag would match, over the ' +
              dex.moves.all().filter(legal).length + ' legal moves:');
  for (const x of members) console.log('     ' + x.m.id + ' -> source.' + x.g[1] +
    '  | menu-disabled too: ' + (typeof x.m.onDisableMove === 'function'));
  if (!members.length) STAGE('the derivation matched NOTHING — it would be a silent no-op tag');
}

console.log('TWO GATES — SMACK DOWN\'S AIRBORNE TEST AND BELCH\'S BERRY LATCH');
console.log('  authority  data/moves.ts:16958 (smackdown.condition.onStart), data/moves.ts:1209 (belch.onTry)');
console.log('  the mod    data/mods/champions/moves.ts:52 rewrites belch and carries NO smackdown key');
if (!ONLY || ONLY === 'smackdown') smackdown();
if (!ONLY || ONLY === 'belch') belch();

console.log('\n' + '='.repeat(70));
if (fixtureFail) console.log('FIXTURE FAILURES: ' + fixtureFail + ' — a COULD-NOT-STAGE is a claim about this file, not the engine.');
console.log(red ? 'RED — ' + red + ' assertion(s) failed.' : 'GREEN — every assertion held.');
process.exit(red || fixtureFail ? 1 : 0);
