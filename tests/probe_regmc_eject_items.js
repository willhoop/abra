#!/usr/bin/env node
/* tests/probe_regmc_eject_items.js — RED CARD AND EJECT BUTTON, UNDER REG M-C. 2026-09-21 (abra/regmc 0.21.0).
 *
 *   node tests/probe_regmc_eject_items.js --regulation regmc                                   # green, exit 0
 *   MEDI_RED_CARD_INERT=1      node tests/probe_regmc_eject_items.js --regulation regmc        # RED, exit 1
 *   MEDI_EJECT_BUTTON_INERT=1  node tests/probe_regmc_eject_items.js --regulation regmc        # RED, exit 1
 *   MEDI_EJECT_BUTTON_MAINLINE=1 node tests/probe_regmc_eject_items.js --regulation regmc      # RED, exit 1
 *   ... --medi <path>   compile THOSE engine bytes under the release (the pre-fix engine, for the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/items.ts redcard :5146-5164 (the Champions mod does not name it)
 *       onAfterMoveSecondary(target, source, move) {
 *         if (source && source !== target && source.hp && target.hp && move && move.category !== 'Status') {
 *           if (!source.isActive || !this.canSwitch(source.side) || source.forceSwitchFlag || target.forceSwitchFlag) return;
 *           if (target.useItem(source)) { if (this.runEvent('DragOut', source, target, move)) source.forceSwitchFlag = true; }
 *         } }
 *   data/mods/champions/items.ts ejectbutton :266-280 -- mainline (data/items.ts :1680-1700) MINUS `source.switchFlag =
 *   false`: Showdown `aa6d5f0856`, 2026-09-13, "Champions: Allow self-switches even if Eject Button is triggered".
 *       onAfterMoveSecondaryPriority: 2  (inherited)
 *       onAfterMoveSecondary(target, source, move) {
 *         if (source && source !== target && target.hp && move && move.category !== 'Status' && !move.flags['futuremove']) {
 *           if (!this.canSwitch(target.side) || target.forceSwitchFlag || target.beingCalledBack || target.isSkyDropped()) return;
 *           if (target.volatiles['commanding'] || target.volatiles['commanded']) return;
 *           for (const pokemon of this.getAllActive()) if (pokemon.switchFlag === true) return;
 *           target.switchFlag = true;
 *           if (!target.useItem()) target.switchFlag = false;
 *         } }
 *   sim/battle-actions.ts:1311 -- a pivot writes `source.switchFlag = move.id` (a STRING, so `=== true` is false and the
 *   button is not blocked by it). sim/battle.ts:2820-2828 drags every `forceSwitchFlag` body at the end of the action,
 *   THEN :2874-2907 asks for the flagged switches; a switch action sorts by the outgoing body's speed, and a string
 *   flag names its move as the switch's `[from]` (sim/battle-queue.ts:250-254) while `true` writes a bare `|switch|`.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   RC         a plain hit into a Red Card holder: the card is spent and the ATTACKER is dragged.
 *   RC-UTURN   U-turn into a Red Card holder: dragged, and the pivot never happens.
 *   EB         a plain hit into an Eject Button holder: the button is spent and the HOLDER switches out.
 *   EB-UTURN   U-turn into an Eject Button holder: under Champions BOTH switch, the faster leaver first.
 *   SPREAD     one spread hit into a Red Card holder AND an Eject Button holder: the button (priority 2) first, the
 *              card after; the attacker is dragged, then the button's holder switches.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_eject_items',
  ['MEDI_RED_CARD_INERT', 'MEDI_EJECT_BUTTON_INERT', 'MEDI_EJECT_BUTTON_MAINLINE']);
const { D, ok, SPEC, learns, quiet, hitFor, bulk, mon, pickDistinct, show, P } = K;

/* 1. THE CAST, DERIVED */
const HOLD = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const FILL = HOLD;
const PIV = SPEC.filter(s => quiet(s) && learns(s, 'protect') && learns(s, 'uturn'));
/* a spread damaging move with nothing on it: every adjacent foe, no secondary, no self effect, 100% */
const spreadOf = s => D.moves.all().filter(m => K.legal(m) && learns(s, m.id) && m.category !== 'Status' && m.target === 'allAdjacentFoes'
  && !m.secondary && !m.secondaries && !m.self && !m.recoil && !m.drain && !m.priority && K.sure(m) && !m.onModifyMove
  && !m.basePowerCallback && !m.onBasePower && !m.flags.charge && m.basePower >= 20).sort((a, b) => a.basePower - b.basePower)[0] || null;
const SPR = SPEC.filter(s => quiet(s) && learns(s, 'protect') && spreadOf(s));
console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
console.log('     holders: ' + show(HOLD) + '\n     U-turn users: ' + show(PIV) + '\n     spread users: ' + show(SPR));
for (const [t, xs] of [['HOLD', HOLD], ['PIV', PIV], ['SPR', SPR]]) if (!xs.length) { console.log('  NOT STAGED — no legal ' + t); process.exit(1); }
for (const it of ['redcard', 'ejectbutton']) if (!K.legal(D.items.get(it))) { console.log('  NOT STAGED — ' + it + ' is not legal'); process.exit(1); }

const counters = () => ({ rc: K.M.MEDSEEN.redCardDragged || 0, eb: K.M.MEDSEEN.ejectButtonSwitched || 0,
  both: K.M.MEDSEEN.ejectButtonKeptPivot || 0 });
const KEEP = /^\|(-enditem|switch|drag|-damage|faint)\|/;
const OWN = KEEP;
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);
const lines = (R, re) => R.sdK.filter(l => re.test(l));
/* the lines AFTER the lead wave (from the first damage on), so a lead's own `|switch|` is never counted as a switch-out */
const after = (R, re) => { const i = R.sdK.findIndex(l => /^\|-damage\|/.test(l)); return (i < 0 ? [] : R.sdK.slice(i)).filter(l => re.test(l)); };

/* 2. THE ARMS */
const used = new Set();
/* two holders and a p2b both of them can land a plain hit on (their own click, into its Protect) */
let h1 = null, h2 = null, tgtB = null;
_pick: for (const a of HOLD.slice(0, 30)) for (const b of HOLD.slice(0, 30)) {
  if (a.baseSpecies === b.baseSpecies) continue;
  const t = FILL.find(f => ![a.baseSpecies, b.baseSpecies].includes(f.baseSpecies) && hitFor(a, f) && hitFor(b, f));
  if (t) { h1 = a; h2 = b; tgtB = t; break _pick; }
}
if (!h1) { console.log('  NOT STAGED — no two holders with a common p2b to hit'); process.exit(1); }
for (const s of [h1, h2, tgtB]) { used.add(s.baseSpecies); used.add(s.id); }
const piv = PIV.find(s => !used.has(s.baseSpecies) && D.getImmunity('Bug', h1) && D.getImmunity('Bug', h2));
if (!piv) { console.log('  NOT STAGED — no U-turn user'); process.exit(1); }
used.add(piv.baseSpecies); used.add(piv.id);
const spr = SPR.find(s => !used.has(s.baseSpecies) && D.getImmunity(spreadOf(s).type, h1) && D.getImmunity(spreadOf(s).type, h2));
if (!spr) { console.log('  NOT STAGED — no spread user'); process.exit(1); }
used.add(spr.baseSpecies); used.add(spr.id);
const fills0 = pickDistinct(FILL, used, 5);
const fills = [fills0[0], fills0[1], fills0[2], tgtB, fills0[3], fills0[4]];
const hitP = hitFor(piv, h1) || hitFor(piv, h2);
if (!hitP) { console.log('  NOT STAGED — the U-turn user has no plain hit into the holder'); process.exit(1); }
console.log('     holders ' + h1.id + ', ' + h2.id + '   pivot ' + piv.id + ' (plain ' + hitP.id + ')   spread ' + spr.id + ' (' + spreadOf(spr).id + ')');

/* One turn. p1a holds the item under test; p1b is a filler; p2a attacks p1a; p2b Protects. The holder must NOT
 * protect, so it clicks a plain hit at the Protecting p2b. */
const ALLP = { p1: [P.protect, P.protect], p2: [P.protect, P.protect] };
function single2(tag, item, moveId) {
  const back = hitFor(h1, fills[3]);
  if (!back) return { staged: false, why: h1.id + ' has no plain hit into ' + fills[3].id };
  const A = [mon(h1, item, ['Protect', back.name]), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect']), mon(fills[2], '', ['Protect'])];
  const B = [mon(piv, '', [hitP.name, 'U-turn', 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[5], '', ['Protect'])];
  /* turn 2 is all Protect: it exists so the switch the authority REQUESTS at the end of turn 1 is answered and written */
  return play(tag, A, B, [{ p1: [{ m: back.id, t: 1 }, P.protect], p2: [{ m: moveId, t: 0 }, P.protect] }, ALLP]);
}
function spread() {
  const sp = spreadOf(spr);
  const b1 = hitFor(h1, fills[3]), b2 = hitFor(h2, fills[3]);
  if (!b1 || !b2) return { staged: false, why: 'a holder has no plain hit into ' + fills[3].id };
  const A = [mon(h1, 'redcard', ['Protect', b1.name]), mon(h2, 'ejectbutton', ['Protect', b2.name]), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
  const B = [mon(spr, '', [sp.name, 'Protect']), mon(fills[3], '', ['Protect']), mon(fills[4], '', ['Protect']), mon(fills[5], '', ['Protect'])];
  const R = play('spread', A, B, [{ p1: [{ m: b1.id, t: 1 }, { m: b2.id, t: 1 }], p2: [{ m: sp.id }, P.protect] }, ALLP]);
  R.cast = h1.id + '(Red Card) + ' + h2.id + '(Eject Button) <- ' + spr.id + ' (' + sp.id + ')';
  return R;
}
const RC = single2('rc', 'redcard', hitP.id), RCU = single2('rc-uturn', 'redcard', 'uturn');
const EB = single2('eb', 'ejectbutton', hitP.id), EBU = single2('eb-uturn', 'ejectbutton', 'uturn');
const SP = spread();
const RUNS = [['RC', RC], ['RC-UTURN', RCU], ['EB', EB], ['EB-UTURN', EBU], ['SPREAD', SP]];
K.printArms(RUNS);

/* 3. THE AUTHORITY EXERCISED WHAT EACH ARM IS FOR */
console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const has = (R, re) => after(R, re).length;
ok(has(RC, /^\|-enditem\|p1a:.*\|redcard\|\[of\]p2a:/) === 1 && has(RC, /^\|drag\|p2a:/) === 1, 'RC — the card is spent and the attacker is dragged');
ok(has(RCU, /^\|drag\|p2a:/) === 1 && has(RCU, /^\|switch\|p2a:.*\[from\]/) === 0, 'RC-UTURN — the attacker is dragged and the pivot never happens');
ok(has(EB, /^\|-enditem\|p1a:.*\|ejectbutton/) === 1 && has(EB, /^\|switch\|p1a:/) === 1, 'EB — the button is spent and the holder switches out');
ok(has(EBU, /^\|-enditem\|p1a:.*\|ejectbutton/) === 1 && has(EBU, /^\|switch\|p1a:/) === 1 && has(EBU, /^\|switch\|p2a:.*\[from\]/) === 1,
   'EB-UTURN — Champions: the holder AND the pivot both switch');
ok(has(SP, /\|redcard\|/) === 1 && has(SP, /\|ejectbutton/) === 1 && has(SP, /^\|drag\|p2a:/) === 1 && has(SP, /^\|switch\|p1b:/) === 1,
   'SPREAD — the button and the card both fire: the attacker is dragged and the button\'s holder switches');

K.compareArms(RUNS, OWN, '-enditem / switch / drag / -damage / faint');

if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(RC.counters.rc === 1 && EB.counters.eb === 1 && EBU.counters.both === 1, 'the engine\'s own receipts: one drag, one eject, one kept pivot',
     JSON.stringify([RC.counters, EB.counters, EBU.counters]));
}
K.finish();
