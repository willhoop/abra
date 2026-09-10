/* probe_residual_trio_lower_order_handler.js — A TIED PAIR'S RESIDUAL ORDER, WHEN ONE OF THEM ALSO
 * CARRIES A LOWER-ORDER HANDLER (the `brn <> brn` row of the residual trio, 2026-09-10).
 *
 *   SHOWDOWN_PATH=... node tests/probe_residual_trio_lower_order_handler.js --release <id>
 *
 * ================= THE GAME THIS COMES FROM ==========================================================
 * game-differential release 7d66b526659e, config omit-protect, pair 2660452545 vs 2660715942, turn 7:
 * two Sinistcha (built Speed 90 and 90, both burned, both holding Leftovers) take their burn damage
 * in opposite orders. The authority: Leftovers p1b, Leftovers p2b, brn Gholdengo, brn p2b, brn p1b.
 * This engine: ... brn Gholdengo, brn p1b, brn p2b. Six batches called it unexplained.
 *
 * ================= THE DERIVATION ====================================================================
 * Under the differential's pin nothing is drawn on either side (game_differential.js:1859
 * `o.tie = () => 0`, and `shuffle` is the identity), so a tied pair's order is whatever each engine's
 * SELECTION SORT leaves behind. The authority sorts one flat list of HANDLERS (sim/battle.ts:507,
 * `speedSort` :429-458); this engine's `residualOrder` sorts BODIES, group by group. Placing the
 * order-5 Leftovers group in the authority's list SWAPS a body's order-10 brn handler out of its slot
 * and past its partner's — `[list[sorted+i], list[index]] = [list[index], list[sorted+i]]` — so the
 * brn tie comes out p2 first even though both Leftovers came out p1 first. The body walk has no such
 * swap: the pair keep input order in every group. The engine's own header above `residualOrder` says
 * so in as many words ("a tied pair's final order depends on the swaps made while the OTHER handlers
 * were placed ... this engine ... does not know which handlers a body actually has").
 *
 * ================= THE KNOB, AND WHY THE AUTHORITY'S ANSWER MOVES WITH IT =============================
 * Two same-species bodies at p1a and p2a (same slot index, so `buildPair` gives them the same spread
 * and the same Speed), both burned on turn 1 by each other's Will-O-Wisp. The knob is WHICH of them
 * holds Leftovers:
 *   none          authority list [p1a brn, p2a brn]                           -> brn p1a first
 *   p1a           [p1a brn, p1a lefto, p2a brn]  swap 0<->1                    -> brn p1a first
 *   p2a           [p1a brn, p2a brn, p2a lefto]  swap 0<->2                    -> brn p2a FIRST
 *   both          [p1a brn, p1a lefto, p2a brn, p2a lefto] swaps 0<->1, 1<->3  -> brn p2a FIRST
 * This engine answers p1a in all four. The file REFUSES TO PASS if the authority gives one answer on
 * all four cells (an unwired knob), if either burn fails to land, if the pair's cached Speeds differ,
 * or if the authority's residual list holds anything but the intended entries (a partner ability with
 * an onResidual would change the swap history and make the cell prove nothing).
 *
 * Every species is DERIVED from the format; nothing is named. The partners are the slowest legal
 * species that learns a self-targeting stat move with no lingering volatile, so they add nothing to
 * either engine's residual list and, being slower than the pair, do not move the body sort either.
 *
 * Exit 1 = a cell disagrees (the hypothesis stands and names its cell). Exit 0 = every cell agrees,
 * which on current bytes would REFUTE the derivation. Exit 2 = not run / fixture could not stage. */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
if (!arg('--release', null)) {
  console.error('REFUSED — pass --release <id>. Requiring engine/game_differential.js without it CUTS A RELEASE into data/releases as a side effect of loading the module.');
  process.exit(2);
}
if (!process.argv.includes('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');

/* ---- the authority hook: the Residual handler list as sorted, and every active body's cached speed -- */
const SD = require(process.env.SHOWDOWN_PATH + '/dist/sim');
let CAP = false; const SDRES = [];
const _fieldEvent = SD.Battle.prototype.fieldEvent;
SD.Battle.prototype.fieldEvent = function (eventid, targets) {
  if (eventid !== 'Residual' || !CAP) return _fieldEvent.call(this, eventid, targets);
  const orig = this.speedSort, self = this;
  this.speedSort = function (list, cmp) {
    const r = orig.call(self, list, cmp);
    SDRES.push({ turn: self.turn,
      handlers: list.map(h => ({ id: (h.effect && h.effect.id) || '?', ord: h.order || 4294967296, sub: h.subOrder | 0, spe: h.speed || 0,
        who: (h.effectHolder && h.effectHolder.getStat) ? h.effectHolder.side.id + String.fromCharCode(97 + h.effectHolder.position) : (h.effectHolder && h.effectHolder.id) || '?' })),
      bodies: self.getAllActive().map(p => ({ slot: p.side.id + String.fromCharCode(97 + p.position), species: p.species.id, speed: p.speed, status: p.status, item: p.item, ability: p.ability, boostSpe: p.boosts.spe })) });
    self.speedSort = orig;
    return r;
  };
  const out = _fieldEvent.call(this, eventid, targets);
  this.speedSort = orig;
  return out;
};

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const ARM = G.ARM_BY_ID.get('bottom-tie-first');   // the corner where an 85-accuracy status move LANDS
if (!ARM) { console.log('NOT RUN — arm bottom-tie-first is not registered.'); process.exit(2); }

/* ---- derive the fixture ---- */
const learns = (s, mv) => { try { const ls = dex.species.getLearnsetData(s.id); return !!(ls && ls.learnset && ls.learnset[mv]); } catch (e) { console.error('learnset lookup failed for ' + s.id + ': ' + e.message + ' (raw-learnset walk, ROADMAP #565)'); return false; } };
const SELF_BOOSTS = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self' && m.boosts
  && !m.boosts.spe && !m.volatileStatus && !m.self && !m.weather && !m.terrain && !m.sideCondition && !m.pseudoWeather && !m.heal).map(m => m.id);
const ALL = dex.species.all().filter(s => legal(s) && !s.isMega && !/^Mega/.test(s.forme || '') && !s.battleOnly);
const PAIR_CANDIDATES = ALL.filter(s => learns(s, 'willowisp') && !s.types.includes('Fire')).sort((a, b) => (a.id < b.id ? -1 : 1));
const boostMoveOf = s => SELF_BOOSTS.find(mv => learns(s, mv)) || null;
const PARTNERS = ALL.filter(s => boostMoveOf(s)).sort((a, b) => a.baseStats.spe - b.baseStats.spe || (a.id < b.id ? -1 : 1));
if (!PAIR_CANDIDATES.length || !PARTNERS.length) { console.log('NOT RUN — the dex walk produced no fixture (pair ' + PAIR_CANDIDATES.length + ', partners ' + PARTNERS.length + ').'); process.exit(2); }

const mon = (species, item, moves) => ({ species, item: item || '', ability: '', moves });
/* THE AUTHORITY'S RAW LOG CARRIES EVERY DAMAGE LINE TWICE — `|split|pN`, then the private copy, then the
 * public one (sim/battle.ts `addSplit`). Keep the public copy only, or each body reads as two entries. */
const unsplit = lines => { const out = []; for (let i = 0; i < lines.length; i++) { if (/^\|split\|/.test(String(lines[i]))) { i++; continue; } out.push(lines[i]); } return out; };
const seqOf = (lines, re) => unsplit(lines).filter(l => re.test(String(l))).map(l => (/^\|-damage\|(p\d[ab])/.exec(String(l)) || [])[1]);
const BRN = /^\|-damage\|p\d[ab]:[^|]*\|[^|]*\|\[from\] brn\s*$/i;
/* THE TURN-1 RESIDUAL ONLY: from `|turn|1` to the first `|upkeep` after it, on both sides. Slicing to
 * `|turn|2` let turn 2's residual leak into the authority column on the first run of this file. */
const turn1 = lines => { const a = lines.findIndex(l => /^\|turn\|1\s*$/.test(String(l))); const b = lines.findIndex((l, i) => i > a && /^\|upkeep\s*$/.test(String(l))); return lines.slice(a < 0 ? 0 : a, b < 0 ? undefined : b + 1); };

function cell(id, lefto, pairSp, partner) {
  const bm = boostMoveOf(partner);
  const A = [mon(pairSp.name, lefto.p1 ? 'Leftovers' : '', ['Will-O-Wisp']), mon(partner.name, '', [bm]), mon(partner.name, '', [bm]), mon(partner.name, '', [bm])];
  const B = [mon(pairSp.name, lefto.p2 ? 'Leftovers' : '', ['Will-O-Wisp']), mon(partner.name, '', [bm]), mon(partner.name, '', [bm]), mon(partner.name, '', [bm])];
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { id, err: 'buildPair returned null' };
  const STEP = { p1: [{ m: 'willowisp', t: 0 }, { m: bm }], p2: [{ m: 'willowisp', t: 0 }, { m: bm }] };
  SDRES.length = 0; CAP = true;
  const r = G.playGame(a, b, 'directed', 'restrio-lower:' + id, { script: [STEP, STEP], arm: ARM });
  CAP = false;
  const sdT1 = turn1(G.lastSdLog() || []), meT1 = turn1(r.mediTrace || []);
  const res = SDRES.find(x => x.turn === 1) || null;
  const burned = sdT1.filter(l => /^\|-status\|p\d[ab]:[^|]*\|brn/.test(String(l))).length;
  return { id, lefto, err: r.err, burned, sd: seqOf(sdT1, BRN), me: seqOf(meT1, BRN), res };
}

console.log('RESIDUAL TRIO — a tied pair with a LOWER-ORDER handler on one of them (the brn <> brn row)\n');
console.log('  release ' + G.REL.id + ', arm ' + ARM.id + ' (every move lands; no die is drawn for a tie on either side)');
console.log('  DERIVED FIXTURE — ' + ALL.length + ' legal species; ' + PAIR_CANDIDATES.length + ' non-Fire Will-O-Wisp learners; '
  + PARTNERS.length + ' self-boost partners (' + SELF_BOOSTS.length + ' qualifying moves)');
const CELLS = [['none', { p1: false, p2: false }], ['lefto-on-p1a', { p1: true, p2: false }], ['lefto-on-p2a', { p1: false, p2: true }], ['lefto-on-both', { p1: true, p2: true }]];
let pairSp = null, partner = null, staged = null;
outer:
for (const cand of PAIR_CANDIDATES.slice(0, 12)) {
  for (const pt of PARTNERS.slice(0, 4)) {
    const t = cell('stage', { p1: false, p2: false }, cand, pt);
    if (t.err || t.burned !== 2 || !t.res) continue;
    const pair = t.res.bodies.filter(bd => bd.slot === 'p1a' || bd.slot === 'p2a');
    const pts = t.res.bodies.filter(bd => bd.slot === 'p1b' || bd.slot === 'p2b');
    if (pair.length !== 2 || pair[0].speed !== pair[1].speed) continue;
    if (!pts.every(bd => bd.speed < pair[0].speed)) continue;
    if (t.res.handlers.some(h => !/^brn$/.test(h.id))) continue;   // anything else in the list and the cell is not clean
    pairSp = cand; partner = pt; staged = t; break outer;
  }
}
if (!pairSp) { console.log('\n  FIXTURE — no candidate staged two burns on a same-speed pair with a clean residual list. This is not a pass.'); process.exit(2); }
console.log('    pair     ' + pairSp.name + ' x2 at p1a/p2a, built Speed ' + staged.res.bodies.find(b => b.slot === 'p1a').speed + ' / ' + staged.res.bodies.find(b => b.slot === 'p2a').speed);
console.log('    partners ' + partner.name + ' x2 at p1b/p2b (' + boostMoveOf(partner) + '), built Speed ' + staged.res.bodies.find(b => b.slot === 'p1b').speed);
console.log('');
console.log('  cell            authority brn order   medicham brn order   list as the authority sorted it');
let bad = 0, fixtureBad = 0; const sdAnswers = new Set();
for (const [id, lefto] of CELLS) {
  const c = cell(id, lefto, pairSp, partner);
  if (c.err) { console.log('  ' + id.padEnd(15) + ' THREW ' + c.err); fixtureBad++; continue; }
  const listS = c.res ? c.res.handlers.map(h => h.who + ':' + h.id).join(' ') : '(no residual captured)';
  const extra = c.res ? c.res.handlers.filter(h => !/^(brn|leftovers)$/.test(h.id)) : [];
  const pair = c.res ? c.res.bodies.filter(bd => bd.slot === 'p1a' || bd.slot === 'p2a') : [];
  const clean = c.burned === 2 && c.res && !extra.length && pair.length === 2 && pair[0].speed === pair[1].speed;
  const agree = JSON.stringify(c.sd) === JSON.stringify(c.me);
  sdAnswers.add(c.sd.join(','));
  console.log('  ' + id.padEnd(15) + ' ' + c.sd.join(',').padEnd(21) + ' ' + c.me.join(',').padEnd(20) + ' ' + listS
    + (clean ? '' : '   <-- FIXTURE NOT CLEAN (burns ' + c.burned + ', extra ' + extra.map(h => h.id).join('/') + ', speeds ' + pair.map(p => p.speed).join('/') + ')')
    + (clean && !agree ? '   <-- RED: the engines disagree' : ''));
  if (!clean) fixtureBad++; else if (!agree) bad++;
}
console.log('');
if (fixtureBad) { console.log('  NOT A PASS — ' + fixtureBad + ' cell(s) did not stage cleanly.'); process.exit(2); }
if (sdAnswers.size < 2) { console.log('  NOT A PASS — the authority gave the same brn order on every cell, so the knob is unwired and the probe asked nothing.'); process.exit(2); }
if (bad) {
  console.log('  RED — ' + bad + ' of ' + CELLS.length + ' cells disagree. The authority\'s brn order follows the Leftovers placement swap in its HANDLER list; this engine\'s body walk keeps input order. Fix site: engine/medicham2-browser.js residualOrder (the body sort) / residualShadowNeeded (the shadow that would carry body handlers is built only for side and field clocks).');
  process.exit(1);
}
console.log('  GREEN — every cell agrees. On current bytes this REFUTES the lower-order-handler derivation.');
process.exit(0);
