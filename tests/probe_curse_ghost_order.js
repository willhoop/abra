#!/usr/bin/env node
/* tests/probe_curse_ghost_order.js — A GHOST'S CURSE: WHICH LINE COMES FIRST, AND WHO THE `[of]` NAMES. 2026-09-24
 * (ENGINE, abra/regmc narration group J).
 *
 *   node tests/probe_curse_ghost_order.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_curse_ghost_order.js
 *   MEDI_CURSE_ORDER_FIXED=1   restores the volatile-first order in BOTH regulations (must exit 1 under Reg M-C)
 *   MEDI_CURSE_OF_SPECIES=1    restores the `[of] <species name>` field (must exit 1 in both)
 *
 * ================= THE AUTHORITY, READ WHOLE-BLOCK IN BOTH CHECKOUTS ==============================================
 *
 *   Reg M-B  pokemon-showdown/data/moves.ts:3266-3310 (curse), no Champions override. `volatileStatus: 'curse'` is
 *            applied by `runMoveEffects` ABOVE the move's own `onHit` (`directDamage(source.maxhp / 2)`), so the
 *            `-start` line precedes the user's `-damage`.
 *   Reg M-C  pokemon-showdown-mc/data/mods/champions/moves.ts:165-194 overrides it: `volatileStatus: undefined`, and
 *            `onHit` runs `this.directDamage(source.maxhp / 2, source, source)` and THEN `target.addVolatile('curse')`.
 *            So the user's `-damage` precedes the `-start`.
 *   Both     `condition.onStart(pokemon, source) { this.add('-start', pokemon, 'Curse', `[of] ${source}`); }` —
 *            `${source}` is `Pokemon#toString()`, the side-and-slot identifier, not a species id.
 *
 * ================= THE ARMS (both engines play the same script; SHOWDOWN IS THE ANSWER) ==========================
 *
 *   GHOST  a Ghost user clicks Curse at the foe in slot a.
 *   AGAIN  the same click on two turns; the second finds the volatile up and fails, paying no HP (the control: it
 *          must read the same before and after the fix, and it exercises the 1/4 residual on both engines).
 *   PLAIN  a non-Ghost user clicks Curse: the self-boost half, which must be untouched.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_curse_ghost_order', ['MEDI_CURSE_ORDER_FIXED', 'MEDI_CURSE_OF_SPECIES'], { anyRegulation: true });
const { ok, SPEC, learns, quiet, bulk, mon, pickDistinct, P, idle } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const isGhost = s => (s.types || []).includes('Ghost');
const Q = s => quiet(s) && learns(s, 'protect') && idle(s);
const USER = s => quiet(s) && learns(s, 'protect') && learns(s, 'curse');
const GHOST = SPEC.filter(s => isGhost(s) && USER(s)).sort((a, b) => bulk(b) - bulk(a));
const PLAIN = SPEC.filter(s => !isGhost(s) && USER(s)).sort((a, b) => bulk(b) - bulk(a));
const FILL = SPEC.filter(s => Q(s) && !isGhost(s)).sort((a, b) => bulk(b) - bulk(a));
console.log('     Ghost users: ' + GHOST.slice(0, 6).map(s => s.id).join(', ') + '   non-Ghost users: ' + PLAIN.slice(0, 6).map(s => s.id).join(', '));
if (!GHOST.length || !PLAIN.length) { console.log('  NOT RUN — no quiet Curse learner of one kind'); process.exit(2); }

const KEEP = /^\|(move|-start|-damage|-fail|-boost|-unboost|faint)\|/;
const SEEN = () => { const S = (K.M && K.M.MEDSEEN) || {}; return { curseGhost: S.curseGhost | 0, curseCostFirst: S.curseCostFirst | 0 }; };
function arm(tag, users, turns) {
  for (const u of users) {
    const used = new Set([u.baseSpecies, u.id]);
    const f = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 5);
    if (f.length < 5) continue;
    const A = [mon(u, '', ['Curse', 'Protect']), mon(f[0], '', ['Protect']), mon(f[1], '', ['Protect']), mon(f[4], '', ['Protect'])];
    const B = [mon(f[2], '', ['Protect', idle(f[2]).name]), mon(f[3], '', ['Protect', idle(f[3]).name]), mon(f[1], '', ['Protect']), mon(f[4], '', ['Protect'])];
    const t = { p1: [{ m: 'curse', t: 0 }, P.protect], p2: [{ m: idle(f[2]).id }, { m: idle(f[3]).id }] };
    const R = K.play(tag, A, B, Array.from({ length: turns }, () => t), KEEP, SEEN);
    if (!R.staged) { console.log('   (skip ' + tag + ' ' + u.id + ': ' + R.why + ')'); continue; }
    R.cast = u.id + ' Curse into ' + f[2].id + ' x' + turns;
    return R;
  }
  return null;
}
const GH = arm('GHOST', GHOST, 1), AG = arm('AGAIN', GHOST, 2), PL = arm('PLAIN', PLAIN, 1);
if (!GH || !AG || !PL) { console.log('  NOT RUN — an arm did not stage'); process.exit(2); }
K.printArms([['GHOST', GH], ['AGAIN', AG], ['PLAIN', PL]]);

console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
const CURSE_START = /^\|-start\|p2a:[^|]*\|curse\|/;
const iStart = GH.sdK.findIndex(l => CURSE_START.test(l));
const iCost = GH.sdK.findIndex(l => /^\|-damage\|p1a:/.test(l));
ok(iStart >= 0 && iCost >= 0, 'GHOST — the authority hangs the Curse on the foe and bills the user',
  'start at ' + iStart + ', cost at ' + iCost);
console.log('           authority order under ' + K.REGN.ID + ': ' + (iCost < iStart ? 'COST, then the -start' : 'the -start, then COST'));
ok(iStart >= 0 && /\[of\]p1a:/.test(GH.sdK[iStart]), 'GHOST — the authority\'s `[of]` names the user by its identifier', GH.sdK[iStart]);
ok(AG.sdK.some(l => /^\|-fail\|p1a:/.test(l)) && AG.sdK.filter(l => /^\|-damage\|p1a:/.test(l)).length === 1,
  'AGAIN — the second Curse fails and the user pays once');
ok(PL.sdK.some(l => /^\|-boost\|p1a:/.test(l)) && !PL.sdK.some(l => /^\|-start\|[^|]*\|curse/.test(l)),
  'PLAIN — a non-Ghost boosts itself and curses nobody');

K.compareArms([['GHOST', GH], ['AGAIN', AG], ['PLAIN', PL]], /^\|(-start|-damage|-fail|-boost|-unboost)\|/, '-start / -damage / -fail / -boost');

/* the receipt: the cost-first road ran exactly where this checkout's Curse declares no volatile (read off the dex
 * here, the same fact tag_dex reads), and never elsewhere */
const costFirst = !K.D.moves.get('curse').volatileStatus && !process.env.MEDI_CURSE_ORDER_FIXED;
ok(GH.counters.curseGhost >= 1 && (GH.counters.curseCostFirst >= 1) === costFirst,
  'GHOST — the engine took the Ghost branch, and the cost-first road ' + (costFirst ? 'ran' : 'stayed shut'), JSON.stringify(GH.counters));
K.finish();
