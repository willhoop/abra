/* solver/chomp/options.js — the 90 team-preview options of one open sheet, and nothing else.
 *
 *   const O = require('./solver/chomp/options.js');
 *   O.OPTIONS            [90] of { leads:[a,b], back:[c,d], order:[a,b,c,d] }   sheet indices 0..5, a<b, c<d
 *   O.indexOf(order)     the option index of any 4-long order (leads first; lead order and back order ignored), or -1
 *   O.leadPairs          [15] lead pairs; O.leadPairOf[i] = which lead pair option i leads with
 *   O.label(opt, sheet)  'A + B / C + D' from the sheet's species (display only)
 *
 * WHY 90. Six on the sheet, four brought, two of the four lead: C(6,4) x C(4,2) = 15 x 6 = 90. The order of the
 * two leads and the order of the two back members are NOT separate options: the two lead slots are both
 * adjacent to both foes in doubles, and the back line's order is the in-battle policy's switch decision. The
 * Reg M-C preview request asks for four positions (`team 3142`, solver/rotom/request.js), so an option becomes a
 * choice by writing `order` in request positions.
 *
 * The ORDER of OPTIONS is fixed (lexicographic over the four, then over the lead pair inside it) because every
 * table, mix and cache in solver/chomp/ is indexed by it. solver/tests/test-chomp.js pins 90 distinct options.
 */
'use strict';

const combos = (a, k) => { const out = []; const rec = (s, pre) => { if (pre.length === k) { out.push(pre); return; } for (let i = s; i < a.length; i++) rec(i + 1, pre.concat([a[i]])); }; rec(0, []); return out; };

const OPTIONS = [];
for (const four of combos([0, 1, 2, 3, 4, 5], 4)) {
  for (const leads of combos(four, 2)) {
    const back = four.filter(x => !leads.includes(x));
    OPTIONS.push({ leads, back, order: leads.concat(back) });
  }
}
const key = (leads, back) => leads.slice().sort().join('') + '/' + back.slice().sort().join('');
const INDEX = new Map(OPTIONS.map((o, i) => [key(o.leads, o.back), i]));
function indexOf(order) {
  if (!order || order.length !== 4 || new Set(order).size !== 4) return -1;
  const i = INDEX.get(key(order.slice(0, 2), order.slice(2)));
  return i == null ? -1 : i;
}
const leadPairs = combos([0, 1, 2, 3, 4, 5], 2);
const LP = new Map(leadPairs.map((p, i) => [p.join(''), i]));
const leadPairOf = OPTIONS.map(o => LP.get(o.leads.join('')));
const fourOf = OPTIONS.map(o => o.order.slice().sort().join(''));

function label(opt, sheet) {
  const n = i => (sheet && sheet[i] && sheet[i].species) || '#' + i;
  return opt.leads.map(n).join(' + ') + ' / ' + opt.back.map(n).join(' + ');
}

module.exports = { OPTIONS, N: OPTIONS.length, indexOf, leadPairs, leadPairOf, fourOf, label, combos };
