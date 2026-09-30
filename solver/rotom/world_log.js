/* solver/rotom/world_log.js — the CLOCKS, VOLATILES AND ABILITIES a live battle shows in its public protocol, read off the
 * log so ROTOM's world (solver/rotom/world.js) can lay them on the MEDICHAM board. 2026-09-30,
 * docs/_reports/2026-09-30-rotom-world-fixes.md.
 *
 * WHY. The ladder loss post-mortem (docs/_reports/2026-09-30-ladder-loss-postmortem.md) found two losses to state the
 * world did not carry: a Perish count (sdkvndfv g1 t4: the search valued 0.844 with both our actives at perish 1; both
 * fainted) and a Skill-Swapped Shadow Tag (pandywulu g1 t8: the server refused our switch as trapped). Both were a
 * CLASS: world.js laid HP, status, boosts, items, megas, the field timers and the Protect streak, and no other volatile,
 * no status counter and no mid-battle ability. This file reads the whole class in one walk.
 *
 *   const L = require('./world_log.js').walk(lines, sheets)
 *     lines   the room's public protocol so far (ROTOM's B.lines)
 *     sheets  { p1: [rows], p2: [rows] } with the sheet's nickname in `nick` (parse_game.parseShowteam)
 *   -> { U, bodies: Map('p1:<row>' -> body clocks), field: { weather, terrain, pseudo: Map, sides: {p1: Map, p2: Map} } }
 *
 * THE RESIDUAL IS THE CLOCK. Every timed effect in Showdown ticks in the end-of-turn residual, and every residual ends in
 * `|upkeep|`. So a clock's age is the number of `|upkeep|` lines since it started (`U - start`), never the difference of
 * turn numbers: a weather set by a LEAD (before turn 1) or by a replacement AFTER the residual has had no tick by the next
 * turn, and the turn arithmetic world.js used before this called it one tick old (measured on the ladder logs: a lead
 * Sand Stream / Psychic Surge lasts to the residual of turn 5, so 5 left at turn 1, where the old `left()` said 4).
 *
 * DURATIONS ARE THE DEX'S, NEVER TYPED: `condition.duration`, or the condition's own `durationCallback` asked with the
 * SETTER's current item (Light Clay, Heat Rock, Damp Rock, Smooth Rock, Icy Rock, Terrain Extender all derive this way),
 * plus the one-turn start adjustments the conditions' `onStart` makes (Taunt and Encore gain a turn on a target that has
 * already acted this turn; Disable loses one on a target that has not) — the adjustment is detected in the condition's
 * own source text, so a condition that loses it stops getting it.
 *
 * WHAT A BODY CARRIES (per sheet row, while it stands; everything but the status counters leaves with it — Showdown's
 * `clearVolatile`, and Baton Pass carries what its `noCopy` lets it, as the engine's `capturePassedState` does):
 *   perish     the engine's `_perish`: the count the log last showed after a residual, or that +1 for the use-time
 *              `[silent]` mark (the engine sets `_perish = 4` when it prints `perish3`, and ticks it in the residual).
 *   vols       Map(id -> {start, adj, arg, layers}): every `-start` volatile; a duration volatile's remaining turns are
 *              dur - (U - start) + adj.
 *   sub, seed, confusion {attempts}, trapPartial {start, mv, byKey}, trapHard {byKey, mv}, yawn {start}
 *   slp {ticks, rest}  sleep ticks spent (one per `|cant|X|slp`), and whether Rest set it; survives a switch.
 *   tox {since}        the residual count at the last entry or poisoning; the stage is U - since.
 *   ability            the observed current ability, or null (= the sheet's); `suppressed` for Gastro Acid.
 *   item               the current item as the log shows it (sheet, then -item / -enditem).
 *   lastMove, movedSinceEntry, lastMoveSinceEntry   for the Encore move and a Choice lock.
 *
 * DELIBERATE BREAKS (env ROTOM_WORLD_BREAK): `noclocks` -> no body clocks and no field (the pre-fix world, which carried
 * none of it); `noability` -> no ability changes. solver/tests/test-rotom-world-clocks.js must go red under each.
 */
'use strict';
const X = require('../human/dex.js');
const toID = X.toID;
const BREAK = (typeof process !== 'undefined' && process.env && process.env.ROTOM_WORLD_BREAK) || '';
const strip = s => String(s || '').replace(/^(move|ability|item):\s*/, '').trim();

/* ---- the dex facts, derived ---- */
function cond(id) {
  id = toID(id);
  const c = X.D.conditions.get(id);
  if (c && c.exists && (c.duration || c.durationCallback || c.onStart || c.onResidual)) return c;
  const mv = X.D.moves.get(id);
  if (mv && mv.exists && mv.condition) return mv.condition;
  return (c && c.exists) ? c : null;
}
/* the base duration of a condition, asked the way Showdown asks it: durationCallback(target|source, source, effect)
 * with the setter's item; `this.random(a, b)` answers its low end (only partial trapping draws, and the engine reads
 * that one from its own tag instead). null = no duration (a presence volatile). */
function durationOf(id, setterItem, effectName) {
  const c = cond(id);
  if (!c) return null;
  if (typeof c.durationCallback === 'function') {
    const who = { hasItem: i => toID(setterItem) && (Array.isArray(i) ? i.map(toID) : [toID(i)]).includes(toID(setterItem)), hasAbility: () => false };
    const fake = { add() {}, hint() {}, random: (a) => a, effectState: {}, dex: X.D };
    try { const d = c.durationCallback.call(fake, who, who, effectName ? { name: effectName, id: toID(effectName) } : null); if (+d > 0) return +d; } catch (e) { /* fall to duration */ }
  }
  return c.duration > 0 ? c.duration : null;
}
/* Taunt / Encore: `duration++` on a target that will not move again this turn; Disable: `duration--` on one that
 * will. Read off the condition's own onStart. -> { ifActed, ifNotActed } */
function startAdj(id) {
  const c = cond(id); const src = c && c.onStart ? String(c.onStart) : '';
  if (/duration!?\+\+/.test(src) && /willMove/.test(src)) return { ifActed: 1, ifNotActed: 0 };
  if (/duration!?--/.test(src) && /willMove/.test(src)) return { ifActed: 0, ifNotActed: -1 };
  return { ifActed: 0, ifNotActed: 0 };
}
/* the side conditions that are entry hazards (a foe-side condition with a switch-in effect), read from the dex */
let HZ = null;
function hazards() {
  if (HZ) return HZ;
  HZ = new Set();
  for (const m of X.D.moves.all()) if (X.legal(m) && m.sideCondition && m.target === 'foeSide' && m.condition && (m.condition.onSwitchIn || m.condition.onEntryHazard)) HZ.add(m.id);
  return HZ;
}
/* every volatile a legal move can start (its own, its secondaries' or its user's volatileStatus, or a secondary whose
 * onHit adds one by name), read from the dex: the only `-start` ids laid as a volatile */
let VOLS = null;
function volatileIds() {
  if (VOLS) return VOLS;
  VOLS = new Set();
  for (const m of X.D.moves.all()) {
    if (!X.legal(m)) continue;
    const secs = [].concat(m.secondary || [], m.secondaries || []);
    for (const v of [m.volatileStatus, m.self && m.self.volatileStatus].concat(secs.map(s => s && s.volatileStatus), secs.map(s => s && s.self && s.self.volatileStatus))) if (v) VOLS.add(toID(v));
    for (const s of secs) { const r = /addVolatile\(\s*["'](\w+)["']/.exec(String((s && s.onHit) || '')); if (r) VOLS.add(toID(r[1])); }
    const r2 = /addVolatile\(\s*["'](\w+)["']/.exec(String(m.onHit || '') + String(m.onAfterHit || '')); if (r2) VOLS.add(toID(r2[1]));
  }
  /* laid on their own engine fields (sub, confusion, seed, yawn, the traps), or state the log does not start with `-start`
   * (the stall counter is stallStreaks'; the rampage lock and the recharge are named OWED in the report) */
  for (const x of ['substitute', 'confusion', 'leechseed', 'yawn', 'partiallytrapped', 'trapped', 'stall', 'lockedmove', 'mustrecharge', 'curse', 'uproar']) VOLS.delete(x);
  /* a one-turn volatile (Protect, Follow Me, Helping Hand, Endure, Flinch, Roost...) never outlives the turn it is set in */
  for (const x of [...VOLS]) { const c = cond(x); if (c && c.duration === 1) VOLS.delete(x); }
  return VOLS;
}
/* the moves whose volatile is a partial trap, read from the dex */
const isPartialTrap = id => { const m = X.D.moves.get(toID(id)); return !!(m && m.exists && (m.volatileStatus === 'partiallytrapped' || (m.secondary && m.secondary.volatileStatus === 'partiallytrapped'))); };
/* Rest's fixed sleep: `statusState.time = N` in its onHit */
let REST_TIME;
function restTime() {
  if (REST_TIME !== undefined) return REST_TIME;
  const m = /statusState\.time\s*=\s*(\d+)/.exec(String((X.D.moves.get('rest') || {}).onHit || ''));
  return (REST_TIME = m ? +m[1] : null);
}
/* the confusion draw: `this.random(min, max)` in its onStart, asked directly -> [min, maxInclusive] */
let CONF;
function confusionRange() {
  if (CONF) return CONF;
  const c = X.D.conditions.get('confusion'); let rec = null;
  try { c.onStart.call({ add() {}, random: (a, b) => { rec = [a, b]; return a; }, effectState: {} }, {}, {}, null); } catch (e) { /* */ }
  return (CONF = rec ? [rec[0], rec[1] - 1] : null);
}

const identKey = id => { const m = /^(p[12])([ab]?):\s?(.*)$/.exec(String(id || '').trim()); return m ? { side: m[1], pos: m[2] || null, nick: m[3] } : null; };

function walk(lines, sheets) {
  const out = { U: 0, bodies: new Map(), field: { weather: null, terrain: null, pseudo: new Map(), sides: { p1: new Map(), p2: new Map() } }, counters: { unmatched: 0 } };
  if (BREAK === 'noclocks') { out.broken = 'noclocks'; return out; }
  const rowOf = (side, nick) => ((sheets && sheets[side]) || []).findIndex(r => r && r.nick === nick);
  const posOcc = { p1a: null, p1b: null, p2a: null, p2b: null };
  const B = key => {
    if (!out.bodies.has(key)) {
      const [side, row] = key.split(':');
      const r = sheets && sheets[side] && sheets[side][+row];
      out.bodies.set(key, { perish: null, vols: new Map(), sub: false, seed: null, confusion: null, trapPartial: null, trapHard: null, yawn: null,
                            slp: null, tox: null, ability: null, suppressed: false, item: r ? (r.item || '') : '', active: false,
                            lastMove: null, movedSinceEntry: false, lastMoveSinceEntry: null, entryU: 0 });
    }
    return out.bodies.get(key);
  };
  const keyOf = ident => {
    const k = identKey(ident); if (!k) return null;
    let row = rowOf(k.side, k.nick);
    if (row < 0 && k.pos) { const occ = posOcc[k.side + k.pos]; if (occ) return occ; }
    if (row < 0) { out.counters.unmatched++; return null; }
    return k.side + ':' + row;
  };
  const clearVol = b => {
    b.perish = null; b.vols = new Map(); b.sub = false; b.seed = null; b.confusion = null; b.trapPartial = null; b.trapHard = null; b.yawn = null;
    b.ability = null; b.suppressed = false; b.lastMove = null; b.movedSinceEntry = false; b.lastMoveSinceEntry = null;
  };
  let acted = new Set(), lastMove = null, pendingPass = {};
  for (const raw of lines || []) {
    const l = String(raw);
    const p = l.split('|');
    const cmd = p[1];
    const silent = p.includes('[silent]');
    const from = (p.find(x => x.startsWith('[from]')) || '').replace(/^\[from\]\s*/, '');
    const ofId = (p.find(x => x.startsWith('[of]')) || '').replace(/^\[of\]\s*/, '');
    switch (cmd) {
      case 'turn': acted = new Set(); pendingPass = {}; break;
      case 'upkeep': out.U++; break;
      case 'switch': case 'drag': {
        const k = identKey(p[2]); if (!k || !k.pos) break;
        const pos = k.side + k.pos;
        const old = posOcc[pos];
        let carry = null;
        if (old && out.bodies.has(old)) {
          const ob = out.bodies.get(old);
          const pass = pendingPass[pos];
          if (pass === 'batonpass') carry = { perish: ob.perish, sub: ob.sub, seed: ob.seed, confusion: ob.confusion, trapPartial: ob.trapPartial, vols: new Map([...ob.vols].filter(([id]) => { const c = cond(id); return !(c && c.noCopy); })) };
          else if (pass === 'shedtail') carry = { sub: ob.sub };
          clearVol(ob); ob.active = false;
        }
        delete pendingPass[pos];
        const key = keyOf(p[2]); posOcc[pos] = key;
        if (!key) break;
        const b = B(key); clearVol(b); b.active = true; b.entryU = out.U;
        if (b.tox) b.tox.since = out.U;
        if (carry) Object.assign(b, carry);
        break;
      }
      case 'swap': {
        const k = identKey(p[2]); if (!k || !k.pos) break;
        const to = ['a', 'b'][+p[3]]; if (!to) break;
        const a = k.side + k.pos, bb = k.side + to; const t = posOcc[a]; posOcc[a] = posOcc[bb]; posOcc[bb] = t;
        break;
      }
      case 'faint': { const key = keyOf(p[2]); if (key) { const b = B(key); clearVol(b); b.active = false; b.slp = null; b.tox = null; } break; }
      case 'detailschange': {
        /* a mega forme's ability overwrites whatever the body held (formeChange -> setAbility(isFromFormeChange)) */
        if (/-Mega/.test(p[3] || '')) { const key = keyOf(p[2]); if (key) { const b = B(key); b.ability = null; b.megaAbility = true; } }
        break;
      }
      case 'move': {
        const key = keyOf(p[2]); if (!key) break;
        const b = B(key);
        const mv = X.D.moves.get(toID(p[3]));
        acted.add(key);
        lastMove = { key, ident: p[2], move: mv && mv.exists ? mv.id : toID(p[3]) };
        if (!from || /^lockedmove$/i.test(toID(from))) {
          b.lastMove = lastMove.move; b.movedSinceEntry = true; b.lastMoveSinceEntry = lastMove.move;
        }
        const k = identKey(p[2]);
        if (k && k.pos && (lastMove.move === 'batonpass' || lastMove.move === 'shedtail')) pendingPass[k.side + k.pos] = lastMove.move;
        break;
      }
      case 'cant': {
        const key = keyOf(p[2]); if (!key) break;
        acted.add(key);
        if (toID(p[3]) === 'slp') { const b = B(key); if (b.slp) b.slp.ticks++; else b.slp = { ticks: 1, rest: false, unseenStart: true }; }
        break;
      }
      case '-status': {
        const key = keyOf(p[2]); if (!key) break;
        const b = B(key); const st = toID(p[3]);
        if (st === 'slp') b.slp = { ticks: 0, rest: /Rest$/.test(from) };
        if (st === 'tox') b.tox = { since: out.U };
        break;
      }
      case '-curestatus': {
        const key = keyOf(p[2]); if (!key) break;
        const b = B(key); const st = toID(p[3]);
        if (st === 'slp') b.slp = null; if (st === 'tox') b.tox = null;
        break;
      }
      case '-start': {
        const key = keyOf(p[2]); if (!key) break;
        const b = B(key); const eff = strip(p[3]); const id = toID(eff);
        const pm = /^perish(\d)$/.exec(id);
        if (pm) { b.perish = +pm[1] + (silent ? 1 : 0); break; }
        const sm = /^stockpile(\d)$/.exec(id);
        if (sm) { b.vols.set('stockpile', { start: out.U, layers: +sm[1] }); break; }
        if (id === 'substitute') { b.sub = true; break; }
        if (id === 'confusion') { b.confusion = { attempts: 0, start: out.U }; break; }
        if (id === 'leechseed') {
          const s = lastMove && identKey(lastMove.ident);
          b.seed = { byKey: lastMove ? lastMove.key : null, side: s ? s.side : null, slot: s && s.pos ? (s.pos === 'a' ? 0 : 1) : null };
          break;
        }
        if (id === 'yawn') { b.yawn = { start: out.U }; break; }
        if (/^fallen\d$/.test(id) || id === 'typechange' || id === 'typeadd' || id === 'dynamax') break;   // not a clock here (see the report)
        const adj = startAdj(id);
        const e = { start: out.U, adj: acted.has(key) ? adj.ifActed : adj.ifNotActed };
        if (id === 'disable') e.arg = toID(p[4]);
        if (id === 'encore') e.arg = b.lastMove;
        if (id === 'healblock') e.effect = lastMove ? (X.D.moves.get(lastMove.move).name || null) : null;
        b.vols.set(id, e);
        break;
      }
      case '-end': {
        const key = keyOf(p[2]); if (!key) break;
        const b = B(key); const id = toID(strip(p[3]));
        if (/^perish/.test(id)) b.perish = null;
        else if (id === 'substitute') b.sub = false;
        else if (id === 'confusion') b.confusion = null;
        else if (id === 'leechseed') b.seed = null;
        else if (id === 'yawn') b.yawn = null;
        else if (p.includes('[partiallytrapped]') || isPartialTrap(id)) b.trapPartial = null;
        else if (/^stockpile/.test(id)) b.vols.delete('stockpile');
        else b.vols.delete(id);
        break;
      }
      case '-activate': {
        const key = keyOf(p[2]);
        const eff = strip(p[3]); const id = toID(eff);
        if (id === 'confusion' && key) { const b = B(key); if (b.confusion) b.confusion.attempts++; else b.confusion = { attempts: 1, start: out.U, unseenStart: true }; acted.add(key); break; }
        if (id === 'trapped' && key) { B(key).trapHard = { byKey: lastMove ? lastMove.key : null, mv: lastMove ? lastMove.move : null }; break; }
        if (isPartialTrap(id) && key) { const by = keyOf(ofId); B(key).trapPartial = { start: out.U, mv: id, byKey: by }; break; }
        if (id === 'skillswap' && BREAK !== 'noability') {
          /* -activate|SOURCE|Skill Swap|<target's ability>|<source's ability>|[of] TARGET (sim/battle.ts skillSwap); an
           * ally swap names neither ability and the two swap what they hold */
          const src = key, tgt = keyOf(ofId); if (!src || !tgt) break;
          const a = strip(p[4]), c = strip(p[5]);
          const bs = B(src), bt = B(tgt);
          if (a || c) { bs.ability = toID(a); bt.ability = toID(c); }
          else { const sa = curAbility(bs, src, sheets), ta = curAbility(bt, tgt, sheets); bs.ability = ta; bt.ability = sa; }
          break;
        }
        /* Mummy: -activate|HOLDER|ability: Mummy|CHANGED|[ability] Old — CHANGED now holds the holder's ability */
        if (/^ability:/.test(p[3] || '') && p[4] && identKey(p[4]) && BREAK !== 'noability') {
          const ch = keyOf(p[4]); if (ch) B(ch).ability = id;
        }
        break;
      }
      case '-ability': {
        /* a CHANGE carries [from] (setAbility: -ability|X|NEW|OLD|[from] EFFECT|[of] SRC); a bare -ability is an
         * announcement of what it already holds */
        if (!from || BREAK === 'noability') break;
        const key = keyOf(p[2]); if (!key) break;
        B(key).ability = toID(p[3]);
        break;
      }
      case '-endability': { const key = keyOf(p[2]); if (key && BREAK !== 'noability') B(key).suppressed = true; break; }
      case '-item': { const key = keyOf(p[2]); if (key) B(key).item = strip(p[3]); break; }
      case '-enditem': { const key = keyOf(p[2]); if (key) B(key).item = ''; break; }
      case '-weather': {
        const w = p[2];
        if (!w || w === 'none') { out.field.weather = null; break; }
        if (p.includes('[upkeep]')) break;
        const setter = ofId ? keyOf(ofId) : (lastMove ? lastMove.key : null);
        out.field.weather = { id: toID(w), name: w, start: out.U, setter };
        break;
      }
      case '-fieldstart': {
        const eff = strip(p[2]); const id = toID(eff);
        const setter = ofId ? keyOf(ofId) : (lastMove ? lastMove.key : null);
        if (/terrain$/.test(id)) out.field.terrain = { id, name: eff, start: out.U, setter };
        else out.field.pseudo.set(id, { id, name: eff, start: out.U, setter });
        break;
      }
      case '-fieldend': {
        const id = toID(strip(p[2]));
        if (/terrain$/.test(id)) { if (out.field.terrain && out.field.terrain.id === id) out.field.terrain = null; }
        else out.field.pseudo.delete(id);
        break;
      }
      case '-sidestart': {
        const s = /^(p[12])/.exec(p[2] || ''); if (!s) break;
        const id = toID(strip(p[3]));
        const m = out.field.sides[s[1]];
        const c = m.get(id);
        m.set(id, { id, start: c ? c.start : out.U, layers: (c ? c.layers : 0) + 1, setter: c ? c.setter : (lastMove ? lastMove.key : null) });
        break;
      }
      case '-sideend': { const s = /^(p[12])/.exec(p[2] || ''); if (s) out.field.sides[s[1]].delete(toID(strip(p[3]))); break; }
      case '-swapsideconditions': { const t = out.field.sides.p1; out.field.sides.p1 = out.field.sides.p2; out.field.sides.p2 = t; break; }
      default: break;
    }
  }
  return out;
}
function curAbility(b, key, sheets) {
  if (b.ability) return b.ability;
  const [side, row] = key.split(':'); const r = sheets && sheets[side] && sheets[side][+row];
  return r ? toID(r.ability) : null;
}

/* THE AUDIT: every per-body and field leaf engine/board_state.js reads off a MEDICHAM board (mediBody, readMedi's field
 * and side), and how ROTOM's world lays it. solver/tests/test-rotom-world-clocks.js AUDIT parses those leaves out of
 * board_state.js and fails on any leaf in neither table, so a leaf the engine adds is classified before it is trusted. */
const CARRIED = {
  species: 'sheet + mega from the log', hp: 'request (mine) / public % (theirs)', maxhp: 'request / build', fainted: 'log',
  status: 'request / log', status_counter: 'sleep ticks (|cant|X|slp) and toxic stage (residuals since entry or poisoning), 2026-09-30',
  item: 'request / log (-enditem, -item)', boosts: 'log', ability: 'request ability/baseAbility (mine); log changes over the sheet (Skill Swap both ways, [from] -ability, Mummy, Gastro Acid park, mega reset), 1.41.0',
  substitute: 'presence from the log; HP laid as a fresh doll (the remaining HP is hidden)', taunt: 'dex duration - residuals + onStart adj',
  encore: 'dex duration - residuals + adj; _encoreMove and the lock', disable: 'dex duration - residuals + adj; _sealed from the line',
  leechseed: '_seededBy {by, per, side, slot}', confusion: 'presence; count = posterior mean over the dex draw given attempts seen',
  perish: '_perish: last count after a residual, +1 for the use-time [silent] mark', trapped_by_move: '_trap: engine tag duration - residuals',
  trapped: '_trapHard from -activate|X|trapped', aquaring: '_vol', ingrain: '_vol', magnetrise: '_vol (duration)', focusenergy: '_vol',
  torment: '_vol', imprison: '_vol', saltcure: '_vol', syrupbomb: '_vol (duration)', glaiverush: '_vol', octolock: '_vol', charge: '_vol',
  attract: '_vol (presence; _attractedBy is not laid)', destinybond: '_vol', choicelock: 'choice item held + a move since entry',
  throatchop: '_noSound (duration)', lockon: '_vol', minimize: '_vol', noretreat: '_vol', dragoncheer: '_vol', gastroacid: 'with the ability',
  powertrick: '_vol', smackdown: '_vol', stockpile: '_vol layers', stall: 'stallStreaks (1.20.0)',
  weather: 'the log', weather_turns: 'residuals since set, setter item (1.43.0; turn arithmetic before, one short for a lead)', terrain: 'the log', terrain_turns: 'same',
  trickroom_turns: 'same', gravity_turns: 'same', magicroom_turns: 'same', wonderroom_turns: 'same', fairylock_turns: 'same', tailwind: 'same', screens: 'sf.sc, same', hazards: 'sf.hz layers (sf.sc until 1.42.0, which the engine never read for a hazard)',
};
const OWED = {
  types: 'type changes (Soak-like, typeadd/typechange) are not laid; the body keeps its sheet types',
  last_item: 'not laid', ate_berry: 'not laid (Belch / Cud Chew read it)', charging: 'a two-turn move in progress is not laid',
  uproar: 'not laid (engine _mtLock)', mustrecharge: 'not laid (engine _recharge)', flashfire: 'the Flash Fire boost is not laid',
  lockedmove: 'a rampage lock is not laid (engine _mtLock)', allyswitch: 'the Ally Switch ladder is not laid', metronome: 'the Metronome item ladder is not laid',
  unburden: 'the Unburden boost is not laid', party: 'bench rows carry no volatiles (correct: they leave with the body)',
  pp: 'one PP per move seen (the count beyond one is hidden)', slots: 'Wish / Healing Wish slot conditions are not laid',
};

module.exports = { CARRIED, OWED, walk, durationOf, startAdj, hazards, isPartialTrap, restTime, confusionRange, cond, curAbility, volatileIds };
