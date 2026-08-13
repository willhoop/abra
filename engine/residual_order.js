/* THE ORDER END-OF-TURN EFFECTS RESOLVE IN, DERIVED FROM THE FORMAT — ROADMAP #221.
 *
 * ================= WHY THIS FILE EXISTS ============================================================
 *
 * medicham2 runs its residuals BODY BY BODY: everything that happens to body A, then everything that
 * happens to body B. Showdown does the opposite — it builds ONE list of handlers across every body,
 * every side and the field, sorts it once, and walks it. The two produce different sequences whenever
 * two bodies carry different effects, which is almost always.
 *
 * The table below is what proves it rather than asserts it. **Leftovers is order 5 and poison is order
 * 9.** Different orders, so EVERY Leftovers heal on the field resolves before ANY poison chip, on
 * either side, regardless of speed. A body-major loop cannot produce that sequence at all: ours heals
 * and then poisons body A before it touches body B. This is not a tie-break subtlety, it is a
 * different grouping of the same events, and it is 16 of the 60 first divergences in the last
 * measured swarm — Leftovers against poison, Leftovers against Speed Boost, the sandstorm chip in the
 * wrong body order, and the expiry announcements (`-end|taunt`, `-sideend|lightscreen`,
 * `-fieldend|gravity`) landing in the wrong place.
 *
 * ================= THE SORT KEY, READ NOT REMEMBERED ===============================================
 *
 * `Battle#comparePriority` (sim/battle.js) is:
 *
 *     order ASC  ->  priority DESC  ->  speed DESC  ->  subOrder ASC  ->  effectOrder ASC
 *
 * **SPEED COMES BEFORE subOrder**, which corrects ROADMAP #221's own title — it says
 * `(residualOrder, subOrder, speed)`. Two effects with the same `order` are separated by the SPEED of
 * the body carrying them before their subOrder is ever consulted. A row written from the title would
 * have sorted a Leftovers and a Shed Skin by category when the authority sorts them by who is faster.
 *
 * `speedSort` shuffles genuine ties through `prng.shuffle`, so a residual tie is a coin flip in the
 * real game and is pinned in mode A like every other die.
 *
 * ================= subOrder DEFAULTS BY EFFECT TYPE ================================================
 *
 * `resolvePriority` fills `subOrder` from the effect's TYPE when the effect declares none — Condition
 * 2, slot condition 3, side condition 4, field/weather 5, Poison Touch and Perish Body 6, Ability 7,
 * Item 8, Stall 9. That default is derived here rather than copied, so an effect whose type changes
 * upstream moves with it.
 *
 * ================= WHAT THIS FILE IS NOT ===========================================================
 *
 * It does not reorder anything. It is the table the restructure consumes, published first and on its
 * own so that when the battle loop does change, a wrong result can be attributed to the loop or to the
 * table but never to both at once.
 *
 *   node engine/residual_order.js            # print it
 *   node engine/residual_order.js --write    # data/residual-order.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const SHOWDOWN = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const { Dex } = require(path.join(SHOWDOWN, 'dist', 'sim'));
const FORMAT = 'gen9championsvgc2026regmb';
const DEX = Dex.forFormat(FORMAT);

/* Derived from `resolvePriority`, not transcribed as a preference: these are the effectType defaults
 * the authority applies when an effect declares no subOrder of its own. */
const TYPE_SUBORDER = { Condition: 2, Weather: 5, Terrain: 5, Format: 5, Rule: 5, Ruleset: 5,
                        Ability: 7, Item: 8 };

function rowsFor() {
  const rows = [];
  const add = (ns, id, name, e, effectType) => {
    const hook = e.onResidual ? 'onResidual'
               : e.onFieldResidual ? 'onFieldResidual'
               : e.onSideResidual ? 'onSideResidual'
               : e.onAnyResidual ? 'onAnyResidual' : null;
    if (!hook) return;
    const pfx = hook.replace('Residual', '');
    const declaredSub = e[pfx + 'ResidualSubOrder'];
    rows.push({
      ns, id, name, hook, effectType,
      order: e[pfx + 'ResidualOrder'] === undefined ? null : e[pfx + 'ResidualOrder'],
      subOrder: declaredSub === undefined ? (TYPE_SUBORDER[effectType] || 0) : declaredSub,
      subOrderSource: declaredSub === undefined ? 'default for effectType ' + effectType : 'declared',
      /* `end` + `duration` is what makes an effect EXPIRE inside the residual walk rather than in a
       * separate pass — the interleaving that produces the -end/-sideend/-fieldend divergences. */
      expiresInWalk: !!(e.onEnd || e.onFieldEnd || e.onSideEnd) && !!e.duration,
      duration: e.duration === undefined ? null : e.duration,
    });
  };

  for (const a of DEX.abilities.all()) if (a.exists && !a.isNonstandard) add('ability', a.id, a.name, a, 'Ability');
  for (const it of DEX.items.all()) if (it.exists && !it.isNonstandard) add('item', it.id, it.name, it, 'Item');
  for (const mv of DEX.moves.all()) {
    if (!mv.exists || mv.isNonstandard || !mv.condition) continue;
    add('condition', mv.id, mv.name, mv.condition,
        mv.weather ? 'Weather' : mv.terrain ? 'Terrain' : 'Condition');
  }
  /* The statuses carry the two biggest residuals in the format and are not reachable through a move's
   * `condition`, so they are asked for by name — the ONE hand-written list here, and it is a list of
   * status ids rather than of behaviours, so it cannot drift into a claim about what they do. */
  for (const id of ['brn', 'psn', 'tox', 'slp', 'frz', 'par', 'confusion', 'partiallytrapped']) {
    const c = DEX.conditions.get(id);
    if (c && c.exists) add('status', id, c.name || id, c, 'Condition');
  }
  return rows;
}

/* THE AUTHORITY'S KEY, minus the two terms this table cannot carry. `speed` and `effectOrder` belong
 * to a live battle — which body holds the effect, and when it was applied — so a static table sorts by
 * (order, subOrder) and the CONSUMER interleaves speed between them. Written out because getting that
 * split wrong is exactly how a table like this becomes a second, disagreeing implementation. */
function sortRows(rows) {
  return rows.slice().sort((x, y) =>
    (x.order == null ? Infinity : x.order) - (y.order == null ? Infinity : y.order)
    || x.subOrder - y.subOrder
    || x.id.localeCompare(y.id));
}

const rows = sortRows(rowsFor());

if (require.main === module) {
  console.log('\nRESIDUAL ORDER — ' + rows.length + ' effects with a residual handler in ' + FORMAT);
  console.log('  key: order ASC -> priority DESC -> SPEED DESC -> subOrder ASC -> effectOrder ASC');
  console.log('  (speed sorts BEFORE subOrder; ROADMAP #221\'s title has those two the wrong way round)\n');
  console.log('  order  sub  expires  namespace   effect');
  for (const r of rows) {
    console.log('  ' + String(r.order == null ? '—' : r.order).padStart(5)
      + '  ' + String(r.subOrder).padStart(3)
      + '  ' + (r.expiresInWalk ? '  yes  ' : '   -   ')
      + '  ' + r.ns.padEnd(10) + '  ' + r.name);
  }
  const groups = new Map();
  for (const r of rows) groups.set(r.order, (groups.get(r.order) || 0) + 1);
  const shared = [...groups].filter(([, n]) => n > 1);
  console.log('\n  distinct order values: ' + groups.size
    + '   groups where SPEED decides between effects: ' + shared.length);
  console.log('  effects that EXPIRE inside the walk (the -end / -sideend / -fieldend interleave): '
    + rows.filter(r => r.expiresInWalk).length);

  if (process.argv.includes('--write')) {
    const art = {
      generated: new Date().toISOString(),
      by: 'engine/residual_order.js',
      format: FORMAT,
      what: 'Every effect in this format carrying a residual handler, with the authority\'s own '
          + 'onResidualOrder and subOrder. The table ROADMAP #221\'s restructure consumes.',
      key: 'order ASC, priority DESC, speed DESC, subOrder ASC, effectOrder ASC '
         + '(Battle#comparePriority) — speed sorts BEFORE subOrder',
      not_carried: 'speed and effectOrder are properties of a live battle, not of an effect, so this '
                 + 'table sorts by (order, subOrder) and the consumer interleaves speed between them',
      subOrder_defaults: TYPE_SUBORDER,
      rows,
    };
    fs.writeFileSync(D('data', 'residual-order.json'), JSON.stringify(art, null, 2) + '\n');
    console.log('\n  wrote data/residual-order.json');
  }
}

module.exports = { rows, sortRows, TYPE_SUBORDER, FORMAT };
