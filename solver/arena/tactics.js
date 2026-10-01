/* solver/arena/tactics.js — THE TACTICS COUNTERS of one game, per side: SPEED CONTROL, MEGA and SWITCHES.
 *
 * WHY (Will, 2026-10-01): "its okay if it doesnt line up with humans, maybe its best to not switch and not worry about
 * speed but i just want to have that info tracked." So these are STANDING COUNTERS, on every ROTOM game record, printed
 * by `node solver/rotom/report.js ladder <dir>`, and on every arena match row (solver/mew/play.js). They count; they do
 * not judge. A human rate beside them is context, not a target (docs/_reports/2026-10-01-speed-mega-switch.md).
 *
 * ONE DEFINITION, TWO READERS.
 *   fromLog(text, { me })   a Showdown battle log (a ROTOM room log, a saved replay, a raw human log): the ladder, the
 *                           opponents and the human comparison all go through this one function.
 *   game(API)               the arena's MEDICHAM state, read before and after each step: { before(S, jA, jB), after(S),
 *                           out() -> { A, B } }. An arena game writes no protocol, so the same questions are asked of
 *                           the engine's state, and where the two readers cannot ask the same thing it is said below.
 *
 * THE SPEED-CONTROL SET IS DERIVED FROM THE FORMAT (derive(); Dex.forFormat(Reg M-C), legal entities only), never
 * listed. A MOVE is speed control when its data says so:
 *   trickroom    `pseudoWeather: 'trickroom'`
 *   tailwind     `sideCondition: 'tailwind'`
 *   self_boost   a certain Speed rise to the user: `boosts.spe > 0` on a self/ally target, `self.boosts.spe > 0`, a
 *                100% `secondary.self.boosts.spe > 0`, or an `onHit` that boosts spe
 *   foe_drop     a certain Speed drop to a foe: `boosts.spe < 0` on a foe target, or a 100% secondary `boosts.spe < 0`
 *   paralysis    `status: 'par'`, or a 100% secondary `status: 'par'`
 *   speed_swap   an `onHit` that swaps `storedStats.spe`
 *   weather / terrain   a weather- or terrain-setting move, counted ONLY for a side whose six include an ability whose
 *                `onModifySpe` reads that weather (or terrain) — Swift Swim's rain, Chlorophyll's sun, and so on. The
 *                weather and the factor are read out of the ability's own handler.
 * A chance below 100% (Body Slam's paralysis, Ancient Power's boost) is not a choice of speed control and is left out.
 * ABILITIES that change Speed (any `onModifySpe`, or a handler that boosts `spe`) are listed by derive() and folded into
 * the speed ESTIMATE; they are not "uses" (nobody clicks them). Priority abilities (Prankster, Gale Wings, …:
 * `onModifyPriority` / `onFractionalPriority`) are listed and not counted.
 *
 * PER SIDE PER GAME (blank()):
 *   speed.avail_turns   decision turns on which an active, live body carried a speed-control move (the sheet's moves)
 *   speed.used          speed-control moves the side executed (a `|move|` line, not `[from]` another effect; a click
 *                       that never executed — a flinch, a faint first — is invisible to a log and is not counted)
 *   speed.first_turn    the turn of the first use;  speed.by_class  uses per class
 *   speed.mattered      at the moment of use, some foe acted before some live ally of the user (under the field's
 *                       current order: Trick Room reverses it) beyond any spread: foe's Speed at 0 SP > ally's at 32 SP
 *   speed.wasted        every ally already acted before every foe beyond any spread
 *   speed.close         neither: the order depended on the hidden spreads
 *   speed.redundant     Tailwind while the side's Tailwind was already up (it fails)
 *   speed.answers       a use while the FOE's Trick Room or Tailwind was up (a reversal, or Tailwind into it)
 *   speed.foe_tr_turns / foe_tw_turns   decision turns the side faced the foe's Trick Room / Tailwind
 *   mega.brought_capable   a body that took the field holds its own mega stone (Dex: items.get(item).megaStone[species])
 *   mega.capable_turn      the first decision turn a live active body held its stone before the side megaed
 *                          (solver/arena/mega_rate.js's definition)
 *   mega.megaed / mega.turn / mega.slot ('a' | 'b')
 *   switch.voluntary    a switch chosen at the start of a turn (before any move resolved), into a slot whose body had
 *                       not fainted
 *   switch.forced       a replacement into a slot whose body fainted
 *   switch.pivot        a mid-turn switch after the slot's own self-switch move (`selfSwitch`: U-turn, Parting Shot …)
 *   switch.other        any other mid-turn switch (Eject Button / Pack, …);  switch.dragged  a `|drag|`
 *   switch.double       turns on which BOTH slots switched voluntarily
 *   switch.into_*       what met each voluntary switch-in that turn: `ko` (it fainted that turn), `resist_or_immune`
 *                       (every foe hit on it was resisted or immune), `se` (a super-effective hit), `neutral`, `unhit`
 *   switch.preserved_scored   a body switched out voluntarily that later took the field again and KO'd a foe
 *                       (a faint of a foe body inside that body's own move). Log only: the arena reader has no KO
 *                       attribution and leaves it null.
 *
 * WHERE THE TWO READERS DIFFER, SAID OUT LOUD:
 *   - the log knows only Speed RANGES (spreads are hidden; 0..32 SP); the arena knows the exact `effSpeed`, so its
 *     close class is only a tie;
 *   - the log sees what HIT a switch-in; the arena reads the foe's chosen moves at that slot (a spread move counts at
 *     both) and prices each with MEDICHAM's own damage (`dmgRange(...).max === 0` = immune) and the Dex type chart.
 *
 * DELIBERATE BREAK (env TACTICS_BREAK=blind): every counter is left at zero — derive() returns empty sets and both
 * readers skip their switch and mega bookkeeping. solver/tests/test-tactics.js must go red.
 */
'use strict';
require('./env.js');   // Reg M-C and its checkout, before the dex loads (a worktree's dex.js cannot find it alone)
const X = require('../human/dex.js');
const { toID } = X;
const BREAK = process.env.TACTICS_BREAK || '';

/* ------------------------------------------------------------------ derived sets ------------------------------------ */
const srcOf = f => (typeof f === 'function' ? f.toString() : '');
const quotedIds = s => [...String(s).matchAll(/["']([a-z0-9]+)["']/g)].map(m => m[1]);
function factorOf(s) {
  let m = /chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/.exec(s); if (m) return +m[1] / +m[2];
  m = /chainModify\(\s*([0-9.]+)\s*\)/.exec(s); if (m) return +m[1];
  m = /\*\s*([0-9]+)\s*\/\s*100/.exec(s); if (m) return +m[1] / 100;
  return null;
}
const SELFISH = new Set(['self', 'adjacentAllyOrSelf', 'allySide', 'allies']);
const BOOSTS_SPE_UP = /boost\(\s*\{[^}]*\bspe:\s*[1-9]/;

let _DER = null;
function derive() {
  if (_DER) return _DER;
  const D = X.D;
  const moves = {}, weatherMoves = {}, terrainMoves = {}, selfSwitch = new Set();
  const legalMoves = D.moves.all().filter(X.legal);
  const weatherIds = new Set(legalMoves.filter(m => m.weather).map(m => toID(m.weather)));
  for (const m of legalMoves) {
    if (m.selfSwitch) selfSwitch.add(m.id);
    if (m.weather) weatherMoves[m.id] = toID(m.weather);
    if (m.terrain) terrainMoves[m.id] = toID(m.terrain);
    const secs = m.secondaries || (m.secondary ? [m.secondary] : []);
    const sure = s => s.chance == null || s.chance >= 100;
    const onHit = srcOf(m.onHit);
    let c = null;
    if (m.pseudoWeather === 'trickroom') c = 'trickroom';
    else if (m.sideCondition === 'tailwind') c = 'tailwind';
    else if ((m.boosts && m.boosts.spe > 0 && SELFISH.has(m.target)) || (m.self && m.self.boosts && m.self.boosts.spe > 0)
      || secs.some(s => sure(s) && s.self && s.self.boosts && s.self.boosts.spe > 0) || BOOSTS_SPE_UP.test(onHit)) c = 'self_boost';
    else if ((m.boosts && m.boosts.spe < 0 && !SELFISH.has(m.target)) || secs.some(s => sure(s) && s.boosts && s.boosts.spe < 0)) c = 'foe_drop';
    else if (m.status === 'par' || secs.some(s => sure(s) && s.status === 'par')) c = 'paralysis';
    else if (/storedStats\.spe/.test(onHit)) c = 'speed_swap';
    if (c) moves[m.id] = c;
  }
  /* abilities: Speed modifiers (folded into the estimate), Speed boosters, priority changers (listed only) */
  const speedAbilities = {}, priorityAbilities = [];
  for (const a of D.abilities.all()) {
    if (!X.legal(a)) continue;
    const mod = srcOf(a.onModifySpe) + srcOf(a.condition && a.condition.onModifySpe);
    if (mod) {
      const ws = quotedIds(mod).filter(id => weatherIds.has(id));
      const terr = (/isTerrain\(\s*["']([a-z]+)["']/.exec(mod) || [])[1] || null;
      const kind = ws.length ? 'weather' : terr ? 'terrain' : /pokemon\.status\b/.test(mod) ? 'status' : /pokemon\.item\b/.test(mod) ? 'item_lost' : 'other';
      speedAbilities[a.id] = { kind, weathers: ws, terrain: terr, factor: factorOf(mod) };
      continue;
    }
    const all = Object.keys(a).filter(k => /^on/.test(k)).map(k => srcOf(a[k])).join('\n');
    if (BOOSTS_SPE_UP.test(all) || /boost\(\s*\{[^}]*\bspe:\s*[1-9]/.test(all)) speedAbilities[a.id] = { kind: 'boost', weathers: [], terrain: null, factor: null };
    if (a.onModifyPriority || a.onFractionalPriority) priorityAbilities.push(a.id);
  }
  const itemSpeed = {};
  for (const it of D.items.all()) if (X.legal(it) && it.onModifySpe) { const f = factorOf(srcOf(it.onModifySpe)); if (f) itemSpeed[it.id] = f; }
  const parF = factorOf(srcOf(D.conditions.get('par').onModifySpe));
  const twCond = D.conditions.get('tailwind');
  const twF = factorOf(srcOf((twCond && twCond.onModifySpe) || (D.moves.get('tailwind').condition || {}).onModifySpe));
  _DER = BREAK === 'blind'
    ? { moves: {}, weatherMoves: {}, terrainMoves: {}, selfSwitch: new Set(), speedAbilities: {}, priorityAbilities: [], itemSpeed: {}, parF, twF, broken: true }
    : { moves, weatherMoves, terrainMoves, selfSwitch, speedAbilities, priorityAbilities, itemSpeed, parF, twF };
  return _DER;
}

/* the class of a move id FOR A SIDE: a weather/terrain move is speed control only for a side holding the matching ability */
function classFor(id, sideSpeedConds) {
  const d = derive();
  if (d.moves[id]) return d.moves[id];
  if (d.weatherMoves[id] && sideSpeedConds.has('w:' + d.weatherMoves[id])) return 'weather';
  if (d.terrainMoves[id] && sideSpeedConds.has('t:' + d.terrainMoves[id])) return 'terrain';
  return null;
}
function speedCondsOf(abilityIds) {
  const d = derive(), s = new Set();
  for (const a of abilityIds) { const A = d.speedAbilities[toID(a)]; if (!A) continue; for (const w of A.weathers) s.add('w:' + w); if (A.terrain) s.add('t:' + A.terrain); }
  return s;
}

/* ------------------------------------------------------------------ the tally --------------------------------------- */
function blank() {
  return {
    turns: 0,
    speed: { avail_turns: 0, used: 0, first_turn: null, by_class: {}, by_move: {}, mattered: 0, wasted: 0, close: 0, redundant: 0, answers: 0, foe_tr_turns: 0, foe_tw_turns: 0, uses: [] },
    mega: { brought_capable: 0, capable_turn: null, megaed: 0, turn: null, slot: null, species: null },
    switch: { voluntary: 0, forced: 0, pivot: 0, other: 0, dragged: 0, double: 0, into_ko: 0, into_resist_or_immune: 0, into_se: 0, into_neutral: 0, into_unhit: 0, preserved_scored: 0, events: [] },
  };
}
const USES_MAX = 12, EVENTS_MAX = 16;
function recordUse(T, u) {
  const s = T.speed;
  s.used++; if (s.first_turn == null) s.first_turn = u.turn;
  s.by_class[u.cls] = (s.by_class[u.cls] || 0) + 1;
  s.by_move[u.move] = (s.by_move[u.move] || 0) + 1;
  if (u.eval === 'redundant') s.redundant++; else s[u.eval]++;
  if (u.answer) s.answers++;
  if (s.uses.length < USES_MAX) s.uses.push(u);
}
/* order judgement, one rule for both readers. ours / foes: [{ lo, hi }] Speed ranges; tr: Trick Room up */
function judge(ours, foes, tr) {
  if (!ours.length || !foes.length) return 'close';
  let oppFirst = false, allUs = true;
  for (const o of ours) for (const t of foes) {
    const theyFirst = tr ? t.hi < o.lo : t.lo > o.hi;
    const weFirst = tr ? o.hi < t.lo : o.lo > t.hi;
    if (theyFirst) oppFirst = true;
    if (!weFirst) allUs = false;
  }
  return oppFirst ? 'mattered' : allUs ? 'wasted' : 'close';
}

/* ------------------------------------------------------------------ reader 1: a battle log -------------------------- */
let _SD = null;
const sd = () => (_SD || (_SD = require('../xatu/sd.js')));
const stageMul = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
function megaFormeOf(row) {
  if (!row || !row.item) return null;
  const it = X.D.items.get(row.item), sp = X.D.species.get(row.species);
  if (!it || !it.exists || !it.megaStone || !sp || !sp.exists) return null;
  const f = it.megaStone[sp.name] || it.megaStone[sp.baseSpecies];
  return f && X.legal(X.D.species.get(f)) ? f : null;
}

function fromLog(text, opts) {
  opts = opts || {};
  const d = derive();
  const lines = String(text || '').split('\n');
  const T = { p1: blank(), p2: blank() };
  const names = { p1: null, p2: null }, ratings = { p1: null, p2: null };
  const sheets = { p1: null, p2: null };
  const bodies = {};        // side|nick -> body
  const slot = {};          // 'p1a' -> body
  const field = { tr: 0, trBy: null, tw: { p1: false, p2: false }, weather: null, terrain: null };
  let turn = 0, acted = false, winner = null, tie = false, inUpkeep = false;
  let curMove = null;       // { side, slotKey, body, id, hits: { slotKey: { eff, dmg } } }
  let parseShowteam = null;
  const megaed = { p1: false, p2: false };
  const pendingIn = [];     // voluntary switch-ins awaiting their turn's outcome
  const volThisTurn = { p1: 0, p2: 0 };
  /* opts.detail: one row per decision turn per live active body (the analysis's like-with-like strata) */
  const DET = opts.detail ? [] : null;
  let rowsNow = {};
  const hpOf = s => { const m = /^(\d+)\/(\d+)/.exec(String(s || '')); return m ? +m[1] / +m[2] : /^0( |$)/.test(String(s || '')) ? 0 : null; };
  const foeOf = s => (s === 'p1' ? 'p2' : 'p1');
  const ident = s => { const m = /^(p[12])([ab]?):\s?(.*)$/.exec(String(s || '').trim()); return m ? { side: m[1], pos: m[2] || null, nick: m[3], key: m[1] + m[2] } : null; };
  const rowFor = (side, nick, species) => {
    const sh = sheets[side]; if (!sh) return null;
    const sid = toID(species), base = toID((X.D.species.get(species) || {}).baseSpecies || species);
    return sh.find(r => r.species_id === sid) || sh.find(r => toID((X.D.species.get(r.species) || {}).baseSpecies || r.species) === base) || sh.find(r => toID(r.nick) === toID(nick)) || null;
  };
  const bodyOf = (side, nick, species) => {
    const k = side + '|' + nick;
    if (!bodies[k]) {
      const row = rowFor(side, nick, species);
      bodies[k] = { side, nick, species: species || (row && row.species), row, item: row ? toID(row.item) : null, itemLost: false,
                    ability: row ? toID(row.ability) : null, nature: row ? row.nature : null, spe: 0, status: null, fainted: false,
                    savedAt: null, scored: false, seen: false };
    }
    return bodies[k];
  };
  const speedRange = b => {
    if (!b || !b.species) return null;
    let lo, hi;
    try { lo = sd().statValue(b.species, b.nature || 'Serious', 'spe', 0); hi = sd().statValue(b.species, b.nature || 'Serious', 'spe', 32); } catch (e) { return null; }
    let f = stageMul(b.spe || 0);
    if (b.item && !b.itemLost && d.itemSpeed[b.item]) f *= d.itemSpeed[b.item];
    const A = d.speedAbilities[b.ability];
    if (b.status === 'par' && b.ability !== 'quickfeet' && d.parF) f *= d.parF;
    if (A) {
      if (A.kind === 'weather' && field.weather && A.weathers.includes(field.weather) && A.factor) f *= A.factor;
      if (A.kind === 'terrain' && field.terrain === A.terrain && A.factor) f *= A.factor;
      if (A.kind === 'status' && b.status && A.factor) f *= A.factor;
      if (A.kind === 'item_lost' && b.itemLost && A.factor) f *= A.factor;
    }
    if (field.tw[b.side] && d.twF) f *= d.twF;
    return { lo: lo * f, hi: hi * f };
  };
  const live = side => ['a', 'b'].map(p => slot[side + p]).filter(b => b && !b.fainted);
  const condsOf = side => speedCondsOf((sheets[side] || []).map(r => r.ability));
  let conds = { p1: new Set(), p2: new Set() };
  const flushMove = () => {
    if (!curMove) return;
    for (const p of pendingIn) {
      if (p.side === curMove.side) continue;
      const h = curMove.hits[p.key];
      if (!h || p.body !== slot[p.key]) continue;
      if (h.eff === 'imm') p.imm++;
      else if (h.eff === 'res') p.res++;
      else if (h.eff === 'se') p.se++;
      else if (h.dmg) p.neu++;
    }
    curMove = null;
  };
  const closeTurn = () => {
    flushMove();
    if (BREAK !== 'blind') for (const p of pendingIn) {
      const S = T[p.side].switch;
      const k = p.ko ? 'into_ko' : p.se ? 'into_se' : (p.imm || p.res) && !p.neu ? 'into_resist_or_immune' : p.neu ? 'into_neutral' : 'into_unhit';
      S[k]++;
      if (S.events.length < EVENTS_MAX) S.events.push({ turn: p.turn, kind: 'voluntary', slot: p.key.slice(2), in: p.body.species, out: p.out, outcome: k.slice(5) });
    }
    pendingIn.length = 0;
    for (const s of ['p1', 'p2']) { if (volThisTurn[s] >= 2 && BREAK !== 'blind') T[s].switch.double++; volThisTurn[s] = 0; }
  };
  const openTurn = n => {
    closeTurn();
    turn = n; acted = false; inUpkeep = false;
    for (const s of ['p1', 'p2']) {
      const t = T[s]; t.turns++;
      const L = live(s);
      if (L.some(b => b.row && (b.row.moves || []).some(mv => classFor(toID(mv), conds[s])))) t.speed.avail_turns++;
      const f = foeOf(s);
      if (field.tr > 0 && field.trBy === f) t.speed.foe_tr_turns++;
      if (field.tw[f]) t.speed.foe_tw_turns++;
      if (BREAK !== 'blind' && !megaed[s] && t.mega.capable_turn == null && L.some(b => !b.itemLost && megaFormeOf(b.row))) t.mega.capable_turn = n;
    }
    if (DET) {
      rowsNow = {};
      for (const s of ['p1', 'p2']) {
        const rel = judge(live(s).map(speedRange).filter(Boolean), live(foeOf(s)).map(speedRange).filter(Boolean), field.tr > 0);
        for (const p of ['a', 'b']) {
          const b = slot[s + p]; if (!b || b.fainted) continue;
          const sc = ((b.row && b.row.moves) || []).map(toID).filter(mv => classFor(mv, conds[s]));
          const r = { side: s, turn: n, slot: p, sp: b.species, sc, hp: b.hp == null ? null : +b.hp.toFixed(3), rel, tr: field.tr > 0, foe_tr: field.tr > 0 && field.trBy === foeOf(s), foe_tw: !!field.tw[foeOf(s)], own_tw: !!field.tw[s],
                      mega_ready: !megaed[s] && !b.itemLost && !!megaFormeOf(b.row), used: null, move: null, mega: false, sw_out: false, sw_in: null, _b: b };
          DET.push(r); rowsNow[s + p] = r;
        }
      }
    }
  };

  for (const raw of lines) {
    if (!raw.startsWith('|')) continue;
    const parts = raw.slice(1).split('|');
    const tag = parts[0];
    switch (tag) {
      case 'player': if (/^p[12]$/.test(parts[1]) && parts[2]) { names[parts[1]] = parts[2]; if (parts[4] && /^\d+$/.test(parts[4])) ratings[parts[1]] = +parts[4]; } break;
      case 'showteam': {
        if (!parseShowteam) parseShowteam = require('../human/parse_game.js').parseShowteam;
        try { sheets[parts[1]] = parseShowteam(parts.slice(2).join('|')); } catch (e) { sheets[parts[1]] = null; }
        conds = { p1: condsOf('p1'), p2: condsOf('p2') };
        break;
      }
      case 'turn': openTurn(+parts[1]); break;
      case 'upkeep': flushMove(); inUpkeep = true; break;
      case 'switch': case 'drag': {
        const id = ident(parts[1]); if (!id || !id.pos) break;
        const species = String(parts[2] || '').split(',')[0].trim();
        const b = bodyOf(id.side, id.nick, species);
        b.species = species;
        const hpS = String(parts[3] || '').split(' ');
        b.status = hpS[1] && hpS[1] !== 'fnt' ? hpS[1] : null;
        b.spe = 0; b.seen = true; { const h = hpOf(parts[3]); if (h != null) b.hp = h; }
        if (BREAK !== 'blind' && megaFormeOf(b.row) && !b.itemLost) T[id.side].mega.brought_capable = 1;
        const prev = slot[id.key];
        const t = T[id.side].switch;
        if (turn >= 1 && BREAK !== 'blind') {
          if (tag === 'drag') t.dragged++;
          else if (prev && prev.fainted) t.forced++;
          else if (!acted && !inUpkeep) {
            t.voluntary++; volThisTurn[id.side]++;
            if (DET && rowsNow[id.key] && rowsNow[id.key]._b === prev) { rowsNow[id.key].sw_out = true; rowsNow[id.key].sw_in = species; }
            if (prev) prev.savedAt = turn;
            pendingIn.push({ side: id.side, key: id.key, body: b, out: prev ? prev.species : null, turn, imm: 0, res: 0, se: 0, neu: 0, ko: false });
          } else if (prev && prev.lastMoveTurn === turn && d.selfSwitch.has(prev.lastMove)) t.pivot++;
          else t.other++;
        }
        slot[id.key] = b;
        break;
      }
      case 'replace': { const id = ident(parts[1]); if (id && id.pos) { const species = String(parts[2] || '').split(',')[0].trim(); slot[id.key] = bodyOf(id.side, id.nick, species); } break; }
      case 'swap': { const id = ident(parts[1]); if (id && id.pos) { const o = id.side + (id.pos === 'a' ? 'b' : 'a'); const x = slot[id.key]; slot[id.key] = slot[o]; slot[o] = x; } break; }
      case 'detailschange': { const id = ident(parts[1]); if (id && slot[id.key]) { const sp = String(parts[2] || '').split(',')[0].trim(); slot[id.key].species = sp; const S = X.D.species.get(sp); if (S && S.exists && /Mega/.test(S.forme || '')) slot[id.key].ability = toID(S.abilities && S.abilities[0]); } break; }
      case '-mega': {
        const id = ident(parts[1]); if (!id || BREAK === 'blind') break;
        megaed[id.side] = true;
        const M = T[id.side].mega;
        if (!M.megaed) { M.megaed = 1; M.turn = turn; M.slot = id.pos; M.species = slot[id.key] ? slot[id.key].species : id.nick; }
        if (DET && rowsNow[id.key]) rowsNow[id.key].mega = true;
        break;
      }
      case 'move': {
        flushMove();
        const id = ident(parts[1]); if (!id || !id.pos) break;
        const from = parts.slice(3).some(p => p.startsWith('[from]'));
        const mvId = toID(parts[2]);
        const user = slot[id.key];
        acted = true;
        if (user) { user.lastMove = mvId; user.lastMoveTurn = turn; }
        if (DET && !from && rowsNow[id.key] && rowsNow[id.key]._b === user && !rowsNow[id.key].move) { rowsNow[id.key].move = mvId; if (classFor(mvId, conds[id.side])) rowsNow[id.key].used = mvId; }
        const hits = {};
        const tgt = ident(parts[3]);
        const spread = parts.find(p => p.startsWith('[spread]'));
        if (spread) for (const k of spread.slice(8).trim().split(',')) hits[k.trim()] = { eff: null, dmg: false };
        else if (tgt && tgt.pos) hits[tgt.key] = { eff: null, dmg: false };
        curMove = { side: id.side, key: id.key, body: user, id: mvId, hits };
        if (from || turn < 1) break;
        const cls = classFor(mvId, conds[id.side]);
        if (!cls) break;
        const f = foeOf(id.side);
        const ours = live(id.side).map(speedRange).filter(Boolean), foes = live(f).map(speedRange).filter(Boolean);
        let ev = judge(ours, foes, field.tr > 0);
        if (cls === 'tailwind' && field.tw[id.side]) ev = 'redundant';
        const answer = (field.tr > 0 && field.trBy === f) || !!field.tw[f];
        recordUse(T[id.side], { turn, move: mvId, cls, eval: ev, answer, tr_up: field.tr > 0, user: user ? user.species : id.nick });
        break;
      }
      case 'cant': acted = true; break;
      case '-immune': case '-resisted': case '-supereffective': {
        const id = ident(parts[1]);
        if (curMove && id && curMove.hits[id.key]) curMove.hits[id.key].eff = tag === '-immune' ? 'imm' : tag === '-resisted' ? 'res' : 'se';
        else if (curMove && id && tag === '-immune' && id.side !== curMove.side) curMove.hits[id.key] = { eff: 'imm', dmg: false };
        break;
      }
      case '-damage': {
        const id = ident(parts[1]);
        if (curMove && id && curMove.hits[id.key] && !parts.slice(3).some(p => p.startsWith('[from]'))) curMove.hits[id.key].dmg = true;
        if (id && slot[id.key]) { const hp = String(parts[2] || '').split(' '); if (hp[1] && hp[1] !== 'fnt') slot[id.key].status = hp[1]; const h = hpOf(parts[2]); if (h != null) slot[id.key].hp = h; }
        break;
      }
      case '-heal': case '-sethp': { const id = ident(parts[1]); if (id && slot[id.key]) { const h = hpOf(parts[2]); if (h != null) slot[id.key].hp = h; } break; }
      case 'faint': {
        const id = ident(parts[1]); if (!id || !id.pos) break;
        const b = slot[id.key]; if (b) b.fainted = true;
        for (const p of pendingIn) if (p.key === id.key && p.body === b) p.ko = true;
        /* a KO inside a foe body's own move: credit it (preserved_scored) */
        if (curMove && !inUpkeep && curMove.side !== id.side && curMove.body && curMove.body.savedAt != null && !curMove.body.scored && BREAK !== 'blind') {
          curMove.body.scored = true; T[curMove.side].switch.preserved_scored++;
        }
        break;
      }
      case '-boost': case '-unboost': {
        const id = ident(parts[1]);
        if (id && slot[id.key] && parts[2] === 'spe') slot[id.key].spe = Math.max(-6, Math.min(6, (slot[id.key].spe || 0) + (tag === '-boost' ? 1 : -1) * (+parts[3] || 0)));
        break;
      }
      case '-setboost': { const id = ident(parts[1]); if (id && slot[id.key] && parts[2] === 'spe') slot[id.key].spe = +parts[3] || 0; break; }
      case '-clearboost': case '-clearallboost': {
        if (tag === '-clearallboost') { for (const k of Object.keys(slot)) if (slot[k]) slot[k].spe = 0; }
        else { const id = ident(parts[1]); if (id && slot[id.key]) slot[id.key].spe = 0; }
        break;
      }
      case '-clearnegativeboost': { const id = ident(parts[1]); if (id && slot[id.key] && slot[id.key].spe < 0) slot[id.key].spe = 0; break; }
      case '-status': { const id = ident(parts[1]); if (id && slot[id.key]) slot[id.key].status = parts[2]; break; }
      case '-curestatus': { const id = ident(parts[1]); if (id && slot[id.key]) slot[id.key].status = null; break; }
      case '-enditem': { const id = ident(parts[1]); if (id && slot[id.key]) slot[id.key].itemLost = true; break; }
      case '-item': { const id = ident(parts[1]); if (id && slot[id.key]) { slot[id.key].item = toID(parts[2]); slot[id.key].itemLost = false; } break; }
      case '-fieldstart': {
        const eff = toID(String(parts[1] || '').replace(/^move:\s*/, ''));
        if (eff === 'trickroom') { field.tr = 5; const of = parts.find(p => p.startsWith('[of]')); const who = of ? ident(of.slice(4)) : null; field.trBy = who ? who.side : (curMove ? curMove.side : null); }
        else if (/terrain$/.test(eff)) field.terrain = eff;
        break;
      }
      case '-fieldend': {
        const eff = toID(String(parts[1] || '').replace(/^move:\s*/, ''));
        if (eff === 'trickroom') { field.tr = 0; field.trBy = null; } else if (/terrain$/.test(eff)) field.terrain = null;
        break;
      }
      case '-sidestart': case '-sideend': {
        const side = String(parts[1] || '').slice(0, 2);
        if (/^p[12]$/.test(side) && toID(String(parts[2] || '').replace(/^move:\s*/, '')) === 'tailwind') field.tw[side] = tag === '-sidestart';
        break;
      }
      case '-weather': { const w = toID(parts[1]); field.weather = !w || w === 'none' ? null : w; break; }
      case 'win': { closeTurn(); const w = toID(parts[1]); winner = toID(names.p1) === w ? 'p1' : toID(names.p2) === w ? 'p2' : null; break; }
      case 'tie': closeTurn(); tie = true; break;
      default: break;
    }
  }
  closeTurn();
  const me = opts.me || null;
  if (DET) for (const r of DET) delete r._b;
  return { p1: T.p1, p2: T.p2, names, ratings, winner, tie, turns: turn, me, mine: me ? T[me] : null, opp: me ? T[foeOf(me)] : null, detail: DET };
}

/* ------------------------------------------------------------------ reader 2: the arena's engine state -------------- */
function game(API) {
  const M = API.M;
  const d = derive();
  const T = { A: blank(), B: blank() };
  const live = m => !!(m && !m.fainted && m.curHP > 0);
  const actOf = (S, sd) => (sd === 'A' ? S.actA : S.actB);
  const sfOf = (S, sd) => (sd === 'A' ? S.sfA : S.sfB);
  const twOf = (S, sd) => ((sd === 'A' ? S.field.twA : S.field.twB) | 0) > 0;
  const foe = sd => (sd === 'A' ? 'B' : 'A');
  const conds = {};
  let pend = null;
  let trBy = null;
  const spd = (S, m, sd) => { let v = null; try { v = M.effSpeed(m, S.field, sd); } catch (e) { v = null; } return v == null ? null : { lo: v, hi: v }; };
  return {
    before(S, jA, jB) {
      const turn = S.turn + 1;
      pend = { turn, bodies: {}, sw: [], mega: {}, megaUsed: {}, moves: {} };
      for (const [sd, j] of [['A', jA], ['B', jB]]) {
        const t = T[sd]; t.turns++;
        if (!conds[sd]) conds[sd] = speedCondsOf(((sfOf(S, sd) || {}).team || []).map(b => b && b.ability).filter(Boolean));
        const own = actOf(S, sd), L = own.filter(live);
        if (L.some(m => (m.moves || []).some(id => classFor(id, conds[sd])))) t.speed.avail_turns++;
        if ((S.field.tr | 0) > 0 && trBy === foe(sd)) t.speed.foe_tr_turns++;
        if (twOf(S, foe(sd))) t.speed.foe_tw_turns++;
        const sf = sfOf(S, sd);
        pend.megaUsed[sd] = !!(sf && sf.megaUsed);
        if (BREAK !== 'blind') {
          if (!pend.megaUsed[sd] && t.mega.capable_turn == null && L.some(m => M.megaTargetFor(m))) t.mega.capable_turn = turn;
          if (L.some(m => M.megaTargetFor(m))) t.mega.brought_capable = 1;
        }
        pend.bodies[sd] = own.slice();
        pend.moves[sd] = [];
        let vol = 0;
        (j || []).forEach((o, k) => {
          if (!o || !live(own[k])) return;
          if (o.kind === 'move' && !o.forced) {
            pend.moves[sd].push({ k, move: o.move, target: o.target, body: own[k] });
            if (o.mega) pend.mega[sd] = k;
            const cls = classFor(o.move, conds[sd]);
            if (cls) {
              const ours = L.map(m => spd(S, m, sd)).filter(Boolean), foes = actOf(S, foe(sd)).filter(live).map(m => spd(S, m, foe(sd))).filter(Boolean);
              let ev = judge(ours, foes, (S.field.tr | 0) > 0);
              if (cls === 'tailwind' && twOf(S, sd)) ev = 'redundant';
              const answer = ((S.field.tr | 0) > 0 && trBy === foe(sd)) || twOf(S, foe(sd));
              recordUse(t, { turn, move: o.move, cls, eval: ev, answer, tr_up: (S.field.tr | 0) > 0, user: own[k].name });
              if (cls === 'trickroom') pend.trSetter = sd;
            }
          }
          if (o.kind === 'switch' && !o.forced && BREAK !== 'blind') {
            vol++;
            const team = (sf && sf.team) || [];
            pend.sw.push({ sd, k, to: team[o.to] || null, out: own[k] });
          }
        });
        if (BREAK !== 'blind') { t.switch.voluntary += vol; if (vol >= 2) t.switch.double++; }
      }
      pend.trBefore = S.field.tr | 0;
    },
    after(S) {
      if (!pend) return;
      const MC = globalThis.MC;
      if ((S.field.tr | 0) <= 0) trBy = null;
      else if (pend.trSetter && !(pend.trBefore > 0)) trBy = pend.trSetter;
      if (BREAK === 'blind') { pend = null; return; }
      for (const sd of ['A', 'B']) {
        const t = T[sd], sf = sfOf(S, sd);
        if (!pend.megaUsed[sd] && sf && sf.megaUsed && !t.mega.megaed) {
          const k = pend.mega[sd] != null ? pend.mega[sd] : null;
          t.mega.megaed = 1; t.mega.turn = pend.turn; t.mega.slot = k == null ? null : 'ab'[k];
          const b = k == null ? null : actOf(S, sd)[k]; t.mega.species = b ? b.name : null;
        }
        const now = actOf(S, sd), before = pend.bodies[sd] || [];
        const swK = new Set(pend.sw.filter(w => w.sd === sd).map(w => w.k));
        for (let k = 0; k < now.length; k++) {
          const b0 = before[k], b1 = now[k];
          if (swK.has(k)) {
            const w = pend.sw.find(x => x.sd === sd && x.k === k);
            const body = w.to || b1;
            let out = 'unhit';
            if (!live(body)) out = 'ko';
            else {
              let imm = 0, res = 0, se = 0, neu = 0;
              for (const mv of pend.moves[foe(sd)]) {
                const D = X.D.moves.get(mv.move);
                if (!D || !D.exists || D.category === 'Status') continue;
                const spread = mv.target == null && /all/.test(D.target);
                const at = spread || (mv.target != null && mv.target > 0 && mv.target - 1 === k);
                if (!at) continue;
                let r = null; try { r = MC && MC.moves && MC.moves[mv.move] ? M.dmgRange(mv.body, body, MC.moves[mv.move], S.field, false) : null; } catch (e) { r = null; }
                if (r && !(r.max > 0)) { imm++; continue; }
                const types = body.types || [];
                const eff = X.D.getEffectiveness ? types.reduce((s, ty) => s + X.D.getEffectiveness(D.type, ty), 0) : 0;
                if (eff < 0) res++; else if (eff > 0) se++; else neu++;
              }
              out = se ? 'se' : (imm || res) && !neu ? 'resist_or_immune' : neu ? 'neutral' : 'unhit';
            }
            t.switch['into_' + out]++;
            if (t.switch.events.length < EVENTS_MAX) t.switch.events.push({ turn: pend.turn, kind: 'voluntary', slot: 'ab'[k], in: body ? body.name : null, out: w.out ? w.out.name : null, outcome: out });
            if (b1 && b1 !== body && !live(body)) t.switch.forced++;
            continue;
          }
          if (b1 && b0 && b1 !== b0) {
            if (!live(b0)) t.switch.forced++;
            else {
              const mv = pend.moves[sd].find(m => m.k === k);
              if (mv && d.selfSwitch.has(mv.move)) t.switch.pivot++; else t.switch.other++;
            }
          }
        }
      }
      pend = null;
    },
    out() { for (const sd of ['A', 'B']) T[sd].switch.preserved_scored = null; return T; },
  };
}

/* ------------------------------------------------------------------ summing ----------------------------------------- */
/* the compact per-game record ROTOM and the arena keep (the use and event lists are capped) */
function compact(t) { return t ? JSON.parse(JSON.stringify(t)) : null; }
/* sum many per-game tallies into rates. games: [{ t, won }] */
function summarize(list) {
  const n = list.length;
  const S = { games: n, won: list.filter(x => x.won === true).length,
    speed: { games_available: 0, games_used: 0, used: 0, avail_turns: 0, mattered: 0, wasted: 0, close: 0, redundant: 0, answers: 0, by_class: {}, by_move: {}, first_turns: [], games_foe_tr: 0, games_foe_tw: 0 },
    mega: { brought_capable: 0, capable: 0, megaed: 0, megaed_when_capable: 0, never_when_capable: 0, turns: [], delay: [], slot: { a: 0, b: 0 } },
    switch: { voluntary: 0, forced: 0, pivot: 0, other: 0, dragged: 0, double: 0, into_ko: 0, into_resist_or_immune: 0, into_se: 0, into_neutral: 0, into_unhit: 0, preserved_scored: 0, preserved_known: 0, turns: 0 } };
  for (const { t } of list) {
    if (!t) continue;
    const s = t.speed, m = t.mega, w = t.switch;
    if (s.avail_turns > 0) S.speed.games_available++;
    if (s.used > 0) S.speed.games_used++;
    for (const k of ['used', 'avail_turns', 'mattered', 'wasted', 'close', 'redundant', 'answers']) S.speed[k] += s[k] || 0;
    for (const [k, v] of Object.entries(s.by_class || {})) S.speed.by_class[k] = (S.speed.by_class[k] || 0) + v;
    for (const [k, v] of Object.entries(s.by_move || {})) S.speed.by_move[k] = (S.speed.by_move[k] || 0) + v;
    if (s.first_turn != null) S.speed.first_turns.push(s.first_turn);
    if (s.foe_tr_turns > 0) S.speed.games_foe_tr++;
    if (s.foe_tw_turns > 0) S.speed.games_foe_tw++;
    if (m.brought_capable) S.mega.brought_capable++;
    if (m.capable_turn != null) { S.mega.capable++; if (m.megaed) S.mega.megaed_when_capable++; else S.mega.never_when_capable++; }
    if (m.megaed) { S.mega.megaed++; S.mega.turns.push(m.turn); if (m.slot) S.mega.slot[m.slot]++; if (m.capable_turn != null) S.mega.delay.push(m.turn - m.capable_turn); }
    for (const k of ['voluntary', 'forced', 'pivot', 'other', 'dragged', 'double', 'into_ko', 'into_resist_or_immune', 'into_se', 'into_neutral', 'into_unhit']) S.switch[k] += w[k] || 0;
    if (w.preserved_scored != null) { S.switch.preserved_scored += w.preserved_scored; S.switch.preserved_known++; }
    S.switch.turns += t.turns || 0;
  }
  const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  const r = (k, n) => (n ? +(k / n).toFixed(4) : null);
  S.rates = {
    speed_games_available: r(S.speed.games_available, n), speed_used_per_game: r(S.speed.used, n), speed_used_per_available_turn: r(S.speed.used, S.speed.avail_turns),
    speed_games_used_when_available: r(S.speed.games_used, S.speed.games_available), speed_first_turn_p50: med(S.speed.first_turns),
    speed_mattered_share: r(S.speed.mattered, S.speed.used), speed_wasted_share: r(S.speed.wasted, S.speed.used), speed_answer_share: r(S.speed.answers, S.speed.used),
    mega_rate_when_capable: r(S.mega.megaed_when_capable, S.mega.capable), mega_turn_p50: med(S.mega.turns), mega_delay_p50: med(S.mega.delay),
    mega_slot_a_share: r(S.mega.slot.a, S.mega.slot.a + S.mega.slot.b), mega_never_when_capable: S.mega.never_when_capable,
    switch_voluntary_per_game: r(S.switch.voluntary, n), switch_voluntary_per_turn: r(S.switch.voluntary, S.switch.turns), switch_forced_per_game: r(S.switch.forced, n),
    switch_pivot_per_game: r(S.switch.pivot, n), switch_double_per_game: r(S.switch.double, n),
    switch_into_ko_share: r(S.switch.into_ko, S.switch.voluntary), switch_into_resist_or_immune_share: r(S.switch.into_resist_or_immune, S.switch.voluntary),
    switch_preserved_scored_share: r(S.switch.preserved_scored, S.switch.voluntary),
  };
  return S;
}
/* one printed line per block, for report.js and the arena */
function lines(S, label) {
  const R = S.rates, p = x => (x == null ? '-' : (100 * x).toFixed(0) + '%'), f = x => (x == null ? '-' : x);
  return [
    `${label} tactics over ${S.games} games:`,
    `  speed control  available in ${S.speed.games_available}/${S.games} games, used ${S.speed.used} (${f(R.speed_used_per_game)}/game, ${f(R.speed_used_per_available_turn)}/available turn, in ${p(R.speed_games_used_when_available)} of games it was available), first use turn p50 ${f(R.speed_first_turn_p50)}; mattered ${S.speed.mattered}, wasted ${S.speed.wasted}, close ${S.speed.close}, redundant ${S.speed.redundant}; answers to the foe's ${S.speed.answers}; faced foe Trick Room in ${S.speed.games_foe_tr} games, Tailwind in ${S.speed.games_foe_tw}  ${JSON.stringify(S.speed.by_move)}`,
    `  mega           capable ${S.mega.capable}/${S.games} games (a stone brought in ${S.mega.brought_capable}), megaed ${S.mega.megaed_when_capable} (${p(R.mega_rate_when_capable)}), never ${S.mega.never_when_capable}; turn p50 ${f(R.mega_turn_p50)}, delay p50 ${f(R.mega_delay_p50)}, slot a/b ${S.mega.slot.a}/${S.mega.slot.b}`,
    `  switches       voluntary ${S.switch.voluntary} (${f(R.switch_voluntary_per_game)}/game, ${f(R.switch_voluntary_per_turn)}/turn), forced ${S.switch.forced}, pivots ${S.switch.pivot}, other ${S.switch.other}, double ${S.switch.double}; into: KO ${S.switch.into_ko}, resist/immune ${S.switch.into_resist_or_immune}, SE ${S.switch.into_se}, neutral ${S.switch.into_neutral}, unhit ${S.switch.into_unhit}; switched out and later scored a KO ${S.switch.preserved_known ? S.switch.preserved_scored : 'n/a'}`,
  ];
}

module.exports = { derive, classFor, speedCondsOf, blank, judge, fromLog, game, summarize, lines, compact, BREAK };
