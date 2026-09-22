#!/usr/bin/env node
/* tests/probe_regmc_milk_drink_target.js — AN `adjacentAllyOrSelf` HEAL (MILK DRINK UNDER REG M-C) HEALS THE ONE BODY
 * IT IS AIMED AT, NOT THE WHOLE SIDE. 2026-09-22 (abra/regmc 0.54.0).
 *
 *   node tests/probe_regmc_milk_drink_target.js --regulation regmc                           # green, exit 0
 *   MEDI_AIMED_HEAL_SPREADS=1 node tests/probe_regmc_milk_drink_target.js --regulation regmc  # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/mods/champions/moves.ts milkdrink :646-649   `inherit: true, target: "adjacentAllyOrSelf"` (the mainline row
 *       is `target: "self"`, `heal: [1, 2]`). Reg M-B's mod marks the move `isNonstandard: "Past"`: an M-C-only row.
 *   sim/battle-actions.ts runMoveEffects :1201-1209   `if (moveData.heal && !target.fainted) { ... const amount =
 *       target.baseMaxhp * moveData.heal[0] / moveData.heal[1]; ...` -- the heal is spent on each TARGET, and an
 *       `adjacentAllyOrSelf` move has exactly one target, the chosen body. Life Dew (`target: "allies"`) has two.
 *
 *   The pinned 1950 card (`pair-redirect-priority …bo3-2684290289` t3): `|move|p2b: Gogoat|Milk Drink|p2b: Gogoat`
 *   then `|-heal|p2b: Gogoat|198/198` alone; this engine also wrote `|-heal|p2a: Toxapex|125/125`.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   DRINK   turn 1 both of our bodies are hit; turn 2 the drinker's Milk Drink (the scripted encoder aims an
 *           `adjacentAllyOrSelf` click at the user): the user is healed, the damaged partner is not.
 *   DEW     the same with the Life Dew holder in the drinker's place (`target: "allies"`): BOTH are healed (the control
 *           that the side-wide road still spreads).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_milk_drink_target', ['MEDI_AIMED_HEAL_SPREADS']);
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, show, P } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const AIMED = D.moves.all().filter(m => K.legal(m) && Array.isArray(m.heal) && m.target === 'adjacentAllyOrSelf');
const SIDE = D.moves.all().filter(m => K.legal(m) && Array.isArray(m.heal) && m.target === 'allies');
console.log('     legal pair-sized heals aimed adjacentAllyOrSelf: ' + AIMED.map(m => m.id).join(', '));
console.log('     legal pair-sized heals aimed allies: ' + SIDE.map(m => m.id).join(', '));
ok(AIMED.length > 0 && SIDE.length > 0, 'both classes have a legal member');
const DR = AIMED[0], DW = SIDE[0];
/* a click that touches no HP and can be repeated: the kit's idle list, then a self stat boost (the heal users learn none
 * of the kit's list) */
const SELFUP = ['irondefense', 'amnesia', 'calmmind', 'bulkup', 'swordsdance', 'nastyplot', 'growth', 'workup', 'agility', 'cottonguard', 'acidarmor'];
const idle = s => K.idle(s) || SELFUP.map(x => D.moves.get(x)).find(m => K.legal(m) && learns(s, m.id)) || null;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
/* the heal's user may carry an ability the kit calls loud when it has no quiet one (Gogoat: Sap Sipper, Grass Pelt);
 * the foe's moves are then kept off the type that ability answers (Grass for Sap Sipper) */
const USERS = mv => SPEC.filter(s => learns(s, mv.id) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
const DRINKERS = USERS(DR);
const DEWERS = USERS(DW);
console.log('     ' + DR.id + ' users: ' + show(DRINKERS) + '   ' + DW.id + ' users: ' + show(DEWERS));
const KEEP = /^\|(-heal|-damage|-fail)\|/;
const OWN = /^\|(-heal|-fail)\|/;
const counters = () => ({ one: K.M.MEDSEEN.aimedHealOneBody || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

function stage(tag, user, mv) {
  for (const pt of FILL.filter(s => s.baseSpecies !== user.baseSpecies).slice(0, 10))
    for (const foe of FILL.filter(s => ![user.baseSpecies, pt.baseSpecies].includes(s.baseSpecies)).slice(0, 20)) {
      const ab = quiet(user) || K.abil(user)[0];
      const safe = m => !(ab === 'sapsipper' && m.type === 'Grass');
      const h1 = K.hitFor(foe, user, safe), h2 = K.hitFor(foe, pt, safe);
      if (!h1 || !h2) continue;
      const used = new Set([user.baseSpecies, user.id, pt.baseSpecies, pt.id, foe.baseSpecies, foe.id]);
      const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 3);
      if (fills.length < 3) continue;
      const ui = idle(user), pi = idle(pt);
      const A = [mon(user, '', [mv.name, 'Protect', ui.name], ab), mon(pt, '', ['Protect', pi.name]), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      const B = [mon(foe, '', [h1.name, h2.name, 'Protect'].filter((x, i, a) => a.indexOf(x) === i)), mon(fills[2], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
      /* turn 1: the foe hits our user, its partner idles; turn 2: the foe hits the partner; turn 3: the heal, the
       * partner protects, the foe protects -- so both our bodies are below full when the heal goes off */
      const script = [
        { p1: [{ m: ui.id }, { m: pi.id }], p2: [{ m: h1.id, t: 0 }, P.protect] },
        { p1: [P.protect, { m: pi.id }], p2: [{ m: h2.id, t: 1 }, P.protect] },
        { p1: [{ m: mv.id }, P.protect], p2: [P.protect, P.protect] },
      ];
      const r = play(tag, A, B, script);
      if (!r.staged) { console.log('   (skip ' + [user.id, pt.id, foe.id].join('/') + ': ' + r.why + ')'); continue; }
      r.cast = user.id + ' (' + ab + ') ' + mv.id + ' t3, partner ' + pt.id + '; foe ' + foe.id + ' (' + h1.id + ', ' + h2.id + ')';
      return r;
    }
  return null;
}
const DRINK = DRINKERS.length ? stage('drink', DRINKERS[0], DR) : null;
const DEW = DEWERS.length ? stage('dew', DEWERS[0], DW) : null;
const RUNS = [['DRINK', DRINK], ['DEW', DEW]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const heals = (R, slot) => R.sdK.filter(l => new RegExp('^\\|-heal\\|p1' + slot + '[^|]*\\|').test(l)).length;
ok(heals(DRINK, 'a') === 1 && heals(DRINK, 'b') === 0, 'DRINK — the user is healed and its damaged partner is not');
ok(heals(DEW, 'a') === 1 && heals(DEW, 'b') === 1, 'DEW — the side-wide heal restores both bodies');

K.compareArms(RUNS, OWN, '-heal / -fail');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(DRINK.counters.one === 1 && DEW.counters.one === 0, 'the engine\'s receipt: one aimed single-body heal in DRINK, none in DEW',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
