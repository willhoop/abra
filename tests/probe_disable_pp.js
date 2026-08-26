/* probe_disable_pp.js — DISABLE AGAINST A LAST MOVE THAT HAS NO PP LEFT.
 *
 *   SHOWDOWN_PATH=... node tests/probe_disable_pp.js
 *
 * THE CARD. `data/game-differential.json` first_board_divergences, config `pair-protect-bust`,
 * `…-2660202801 vs …-2660335898`, turn 9: `p1.active[0].vol.disable` medicham **3** / showdown **0**,
 * and the same game is one of the eleven whose PROTOCOL parted —
 *
 *     SD   |-fail|p2b: Gengar
 *     US   |-start|p1a: Gardevoir|Disable|protect
 *
 * Gardevoir had clicked Protect on turns 1-8. Protect's `maxpp` in this format is **8** (read off
 * `data/tags.json`'s `pp` tag, never typed), so its slot was at zero when Gengar clicked Disable.
 *
 * THE AUTHORITY, `data/moves.ts` — TWO GUARDS, AND THIS ENGINE HAD NEITHER:
 *
 *     disable.onTryHit(target) {                                     data/moves.ts:3659
 *       if (!target.lastMove || target.lastMove.isZOrMaxPowered ||
 *           target.lastMove.isMax || target.lastMove.id === 'struggle') return false;
 *     }
 *     disable.condition.onStart(pokemon, source, effect) {           data/moves.ts:3667
 *       ...
 *       if (!pokemon.lastMove) { return false; }
 *       for (const moveSlot of pokemon.moveSlots) {
 *         if (moveSlot.id === pokemon.lastMove.id) {
 *           if (!moveSlot.pp) { this.debug('Move out of PP'); return false; }
 *         }
 *       }
 *
 * `!target.lastMove` is live here already (`volNeedsLastMove`, WIRE 69 / ROADMAP #111). The **empty
 * slot** and the **Struggle** clauses are not. Encore's equivalent (`encoreOnStartRefusal`) already
 * reads `ppLeft` for exactly this reason — the rule existed in this file, for the other sealer only.
 *
 * IT ASSERTS NOTHING AND EXITS 0. It is a measurement, run BEFORE the fix and again after. The
 * census probe in tests/test-mechanics.js is what asserts.
 *
 * THE PLANT IS APPLIED TO BOTH ENGINES AT THE SAME BOUNDARY, and it is the only thing that varies
 * between the two arms — same species, same script, same dice. An arm that changed the move as well
 * as the PP could not say which one moved the result.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

process.argv.push('--state');
/* The staged board is built by hand; the team pool is loaded anyway at require time, so it is pinned
 * to the frozen store purely so this probe reads a cache instead of rebuilding one for 41 seconds. */
if (!process.argv.includes('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE FIXTURE, DERIVED ---------------------------------------------------------------------- */
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LEARNS = (s, mv) => { const l = dex.species.getLearnsetData(s.id); return !!(l && l.learnset && l.learnset[mv]); };
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
/* THE SEALED MOVE. `agility` is a self-aimed stat move: it cannot faint anybody, it needs no target,
 * and it touches none of the `stall` machinery a Protect would have dragged in. */
const SEALED = 'agility';
/* THE DISABLER MUST OUTRUN THE TARGET, AND THAT IS THE WHOLE STAGING.
 *
 * `disable.condition.onStart` reads `pokemon.lastMove` at the instant the Disable RESOLVES. Showdown
 * refuses a `pass` for a live active — *"Can't pass: Your Abomasnow must make a move"* — so the target
 * has to click SOMETHING on turn 2, and whatever it clicks overwrites `lastMove`. Putting the Disable
 * strictly first is the only way the sealed move is still turn 1's. This is the same order the card's
 * own game had: Gengar (Disable) moved before Gardevoir on turn 9.
 *
 * Both bodies sit in team slot 0, so the differential's SP ladder adds the same +32 to each and BASE
 * Speed decides it. Solved here and then re-read off both engines below rather than trusted. */
const DIS_POOL = POOL.filter(x => LEARNS(x, 'disable')).sort((a, b) => b.baseStats.spe - a.baseStats.spe);
if (!DIS_POOL.length) throw new Error('NO LEGAL DISABLE CARRIER — a claim about the FIXTURE, not the engine.');
const DISABLER = DIS_POOL[0];
/* AND THE TARGET'S TURN-2 CLICK MUST BE PRIORITY 0, WHICH SPEED ALONE DOES NOT BUY.
 *
 * Cut three had the target Protect and be outrun by 142 base Speed to 29 — and the Protect still went
 * first, because Protect is priority +4 and the bracket is sorted before Speed is looked at. So the
 * second move is DERIVED: a Status move the body learns, aimed at `self`, at priority 0, so it cannot
 * shield, cannot redirect and cannot outrun the Disable. */
const SECOND_OK = (sp, mvid) => {
  const dm = dex.moves.get(mvid);
  return dm && dm.exists && !dm.isNonstandard && dm.category === 'Status'
      && dm.target === 'self' && dm.priority === 0 && dm.id !== SEALED
      /* AND IT MUST LEAVE THE BODY ON THE FIELD. `batonpass` sorted first and switched the target
       * out, so the turn-2 boundary read a bench body and both arms showed no volatile at all —
       * cut four of this fixture. A charge move would have the same effect for a different reason. */
      && !dm.selfSwitch && !dm.selfdestruct && !dm.status && !(dm.flags && dm.flags.charge);
};
let TARGET = null, SECOND = null;
for (const sp of POOL.filter(x => LEARNS(x, SEALED) && x.name !== DISABLER.name
                                  && x.baseStats.spe < DISABLER.baseStats.spe)
                     .sort((a, b) => a.baseStats.spe - b.baseStats.spe)) {
  const ls = dex.species.getLearnsetData(sp.id);
  const mv = Object.keys((ls && ls.learnset) || {}).sort().find(m => SECOND_OK(sp, m));
  if (mv) { TARGET = sp; SECOND = mv; break; }
}
if (!TARGET) throw new Error('NO LEGAL ' + SEALED + ' CARRIER SLOWER THAN ' + DISABLER.name
  + ' THAT ALSO LEARNS A PRIORITY-0 SELF STATUS MOVE — a claim about the FIXTURE.');
/* `buildPair` REFUSES A SHEET SHORTER THAN `PAIR_BODIES` (4) and returns null, so the two bench
 * bodies are not decoration — a three-body sheet builds nothing and the arm reports no boundary at
 * all, which is what the first cut of this probe did. */
const FILLS = POOL.filter(x => LEARNS(x, 'protect') && ![DISABLER.name, TARGET.name].includes(x.name)).slice(0, 6);
if (FILLS.length < 6) throw new Error('NOT ENOUGH LEGAL PROTECT CARRIERS FOR THE BENCH — a claim about the FIXTURE.');

console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
console.log('  disabler  ' + DISABLER.name + ' (learns Disable, base Speed ' + DISABLER.baseStats.spe + ')');
console.log('  target    ' + TARGET.name + ' (learns ' + SEALED + ' — what gets sealed — base Speed '
  + TARGET.baseStats.spe + ', slower, so the Disable resolves first)');
console.log('  its turn-2 click  ' + SECOND + ' (Status, self, priority 0 — derived, never named)');
console.log('  bench     ' + FILLS.map(x => x.name).join(', '));
/* READ, NOT TYPED, AND NOT WRAPPED IN A CATCH. Champions compresses PP -- Protect is `maxpp` 8 here
 * against mainline's 16, which is the whole reason the card's Gardevoir ran out at all -- so the
 * number has to come off the artifact. A `try/catch` returning '?' here would turn a missing tag row
 * into a printable character and the probe would go on staging against nothing. */
console.log('  ' + SEALED + ' maxpp in this format: '
  + require(D('data', 'tags.json')).moves[SEALED].params.pp.max
  + '   (read off data/tags.json, never typed)');

const mon = (species, moves) => ({ species, item: '', ability: '', moves });
const P1 = [mon(DISABLER.name, ['Disable', 'Protect'])].concat(FILLS.slice(0, 3).map(x => mon(x.name, ['Protect'])));
const P2 = [mon(TARGET.name, [SEALED, SECOND])].concat(FILLS.slice(3, 6).map(x => mon(x.name, ['Protect'])));

/* turn 1 — the target uses the move, so it HAS a lastMove.  turn 2 — the disabler clicks Disable.
 *
 * THE TARGET'S TURN-2 CLICK COST THREE CORRECTIONS AND EVERY ONE OF THEM WAS THE FIXTURE, NOT THE
 * ENGINE. Cut one had it Protect while FASTER — both engines answered `|-activate|…|move: Protect`,
 * the shield refused the Disable in each, so the CONTROL never applied the seal and the probe said
 * "the FIXTURE failed" rather than accusing anybody. Cut two made it `pass`, which Showdown REJECTS
 * for a live active. Cut three had it Protect while SLOWER, and the Protect still went first because
 * priority +4 is sorted before Speed is read. So it acts, at priority 0, and it acts second. */
const SCRIPT = [
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: SEALED }, { m: 'protect' }] },
  { p1: [{ m: 'disable', t: 0 }, { m: 'protect' }], p2: [{ m: SECOND }, { m: 'protect' }] },
];

/* ---- THE PLANT --------------------------------------------------------------------------------- */
/* Applied to the LIVE state of BOTH engines at the boundary AFTER turn 1, so the Disable on turn 2
 * meets a body whose sealed slot is empty in each. Reported back, so an arm that planted nothing
 * cannot read as an arm that planted successfully — a silent plant is a silent default. */
function drain(S, battle, ids) {
  const rep = { medicham: [], showdown: [] };
  const m = S.actB[0];
  if (m) for (const k of ids) { (m._pp || (m._pp = {}))[k] = 0; rep.medicham.push(k); }
  const p = battle.p2.active[0];
  if (p) for (const sl of p.moveSlots) if (ids.includes(sl.id)) { sl.pp = 0; rep.showdown.push(sl.id); }
  return rep;
}
/* THE STRUGGLE ARM PLANTS `lastMove` RATHER THAN EMPTYING THE MENU, AND THAT IS DELIBERATE.
 *
 * Emptying every slot and scripting `{ m: 'struggle' }` was tried first and does not stage: Showdown
 * builds the turn's request before the boundary hook runs, so the request still offered the moves that
 * had PP when it was built, `scripted()` found no `struggle` on it and fell through to `pass` — which
 * Showdown then rejects for a live active. The arm reported no boundary at all.
 *
 * Planting the field the clause actually reads is both simpler and STRICTER. `disable.onTryHit` asks
 * `target.lastMove.id === 'struggle'` and nothing else; with `struggle` in that field and the body's
 * own slots untouched, the PP clause CANNOT be what refuses — there is no `struggle` slot for the
 * authority's loop to match, and `ppLeft` answers Struggle's own maximum on our side. So this arm
 * isolates one clause instead of confounding two, which a drained menu could not do. */
function plantLastMove(S, battle, mvid) {
  const rep = { medicham: null, showdown: null };
  const m = S.actB[0];
  if (m) { m._lastMove = mvid; rep.medicham = mvid; }
  const p = battle.p2.active[0];
  const dm = dex.moves.get(mvid);
  if (p && dm && dm.exists) { p.lastMove = dm; rep.showdown = dm.id; }
  return rep;
}

function playArm(tag, opt) {
  const a = G.buildPair(P1), b = G.buildPair(P2);
  if (!a || !b) return { tag, err: 'COULD NOT BUILD THE PAIR' };
  const rows = [];
  let planted = null;
  const r = G.playGame(a, b, 'directed', 'disablepp/' + tag, {
    script: (opt && opt.script) || SCRIPT, arm: G.ARM_BY_ID.get('middle'),
    onBoundary: (snap, turnIdx, S, battle) => {
      if (opt && opt.drain && turnIdx === opt.at) planted = drain(S, battle, opt.drain);
      if (opt && opt.lastMove && turnIdx === opt.at) planted = plantLastMove(S, battle, opt.lastMove);
      const m = S.actB[0], p = battle.p2.active[0];
      const sdv = p && p.volatiles && p.volatiles.disable;
      rows.push({
        t: turnIdx,
        meLast: m ? (m._lastMove || null) : null,
        sdLast: p && p.lastMove ? p.lastMove.id : null,
        mePP: m && m._pp ? m._pp[norm(SEALED)] : undefined,
        sdPP: p ? (p.moveSlots.find(s => s.id === norm(SEALED)) || {}).pp : undefined,
        meDis: m && m._vol ? (m._vol.disable | 0) : 0,
        meSealed: m ? (m._sealed || null) : null,
        sdDis: sdv ? (sdv.duration | 0) : 0,
        sdSealed: sdv ? (sdv.move || null) : null,
        sdLog: battle.log.slice(),
      });
    },
  });
  return { tag, rows, planted, err: r.err, mediTrace: r.mediTrace || [] };
}

const keep = l => /^\|move\||^\|-start\||^\|-fail\||^\|-activate\||^\|cant\|/.test(l);

function show(res) {
  console.log('\n  --- ARM ' + res.tag + ' ---');
  if (res.err) console.log('    [game ended: ' + res.err + ']');
  if (res.planted) {
    const me = res.planted.medicham, sd = res.planted.showdown;
    const ok = Array.isArray(me) ? (me.length && me.length === sd.length) : (me != null && sd != null);
    console.log('    plant: medicham ' + JSON.stringify(me) + ', showdown ' + JSON.stringify(sd)
      + (ok ? '' : '   <-- PLANT DID NOT LAND ON BOTH'));
  }
  if (!res.rows || !res.rows.length) { console.log('    NO BOUNDARY TAKEN'); return; }
  for (const r of res.rows) {
    console.log('    b' + r.t
      + '  lastMove me=' + JSON.stringify(r.meLast) + ' sd=' + JSON.stringify(r.sdLast)
      + '  pp me=' + JSON.stringify(r.mePP) + ' sd=' + JSON.stringify(r.sdPP)
      + '  vol.disable me=' + r.meDis + '/' + JSON.stringify(r.meSealed)
      + ' sd=' + r.sdDis + '/' + JSON.stringify(r.sdSealed)
      + (r.meDis > 0 !== r.sdDis > 0 ? '   <-- THE VOLATILE DISAGREES' : ''));
  }
  const last = res.rows[res.rows.length - 1];
  console.log('    showdown  : ' + last.sdLog.filter(keep).join('  '));
  console.log('    medicham2 : ' + res.mediTrace.filter(keep).join('  '));
}

console.log('\n  === THE ARMS ===');
console.log('  control  the sealed move still has PP           -> the authority APPLIES the seal');
console.log('  nopp     the sealed slot is planted empty        -> the authority REFUSES it and says `-fail`');

const control = playArm('control', null);
const nopp = playArm('nopp', { drain: [norm(SEALED)], at: 1 });
/* ARM 3 — STRUGGLE, the OTHER clause of `disable.onTryHit`, isolated from the PP one. */
const struggle = playArm('struggle', { lastMove: 'struggle', at: 1 });
show(control);
show(nopp);
show(struggle);

const lastOf = r => (r.rows && r.rows.length ? r.rows[r.rows.length - 1] : null);
const c = lastOf(control), n = lastOf(nopp);
console.log('\n  === THE READING ===');
if (!c || !n) { console.log('  ONE ARM PRODUCED NO BOUNDARY — nothing is claimed.'); process.exit(0); }
console.log('  control   authority ' + (c.sdDis > 0 ? 'APPLIED' : 'refused') + '  medicham2 ' + (c.meDis > 0 ? 'APPLIED' : 'refused'));
console.log('  nopp      authority ' + (n.sdDis > 0 ? 'APPLIED' : 'refused') + '  medicham2 ' + (n.meDis > 0 ? 'APPLIED' : 'refused'));
{ const g = lastOf(struggle);
  console.log('  struggle  ' + (g ? 'authority ' + (g.sdDis > 0 ? 'APPLIED' : 'refused')
                                  + '  medicham2 ' + (g.meDis > 0 ? 'APPLIED' : 'refused')
                                  + '   (lastMove me=' + JSON.stringify(g.meLast) + ' sd=' + JSON.stringify(g.sdLast) + ')'
                              : 'NO BOUNDARY — the arm did not stage, which is a claim about the FIXTURE')); }
if (c.sdDis > 0 && c.meDis > 0 && n.sdDis === 0 && n.meDis === 0)
  console.log('  THE TWO ENGINES AGREE ON BOTH ARMS. The empty-slot clause is live.');
else if (c.sdDis > 0 && n.sdDis === 0 && n.meDis > 0)
  console.log('  RED — the authority refuses a Disable on an empty slot and this engine applies it.');
else
  console.log('  NEITHER SHAPE — read the arms above before concluding anything. A control that did '
    + 'not apply the seal means the FIXTURE failed, not the engine.');
