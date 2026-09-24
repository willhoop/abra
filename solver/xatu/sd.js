/* solver/xatu/sd.js — XATU's ONLY contact with Showdown.
 *
 * Every stat, every speed, every priority and every damage roll XATU uses is computed by the Reg M-C
 * checkout's own simulator code (statModify, getActionSpeed, the ModifyPriority / FractionalPriority
 * events, actions.getDamage). Nothing is re-implemented and no Pokemon value is typed. The checkout is
 * found by solver/human/dex.js (SHOWDOWN_PATH, else data/regulations.json's regmc checkout).
 *
 * The adapter builds a real sim Battle with the four active Pokemon of an observation on the field,
 * overwrites its public state from a tracker snapshot, and then varies only storedStats / maxhp to ask
 * "what would this candidate spread have produced". The four actives are all present so that ally and
 * field effects (Friend Guard, Ruin abilities, auras, Tailwind, screens) run through the sim's events.
 */
'use strict';
const path = require('path');
const X = require('../human/dex.js');
const { Battle, Teams } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));
const { TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim', 'team-validator'));

const D = X.D;
const toID = X.toID;
const FORMAT = X.FORMAT;
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/* The SP rules, read from the format rather than typed: the total from the validator's ruleTable
 * (evLimit), the per-stat cap from the validator source's own check (32 — asserted in the tests against
 * a validation run, since the cap is a literal in team-validator.ts and not a ruleTable field). */
const VALIDATOR = TeamValidator.get(FORMAT);
const SP_TOTAL = VALIDATOR.ruleTable.evLimit;
const SP_CAP = 32;

/* One scratch battle for pure stat arithmetic (statModify needs `this` = a battle of this format). */
let _scratch = null;
function scratch() {
  if (_scratch) return _scratch;
  _scratch = new Battle({ formatid: FORMAT, seed: [1, 2, 3, 4] });
  return _scratch;
}

/* stat value for one stat at one SP value — the checkout's statModify, level from the sheet (50). */
const _statCache = new Map();
function statValue(species, nature, stat, sp, level = 50) {
  const key = species + '|' + nature + '|' + stat + '|' + sp + '|' + level;
  let v = _statCache.get(key);
  if (v !== undefined) return v;
  const sp_ = D.species.get(species);
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  evs[stat] = sp;
  v = scratch().statModify(sp_.baseStats, { evs, level, nature }, stat);
  _statCache.set(key, v);
  return v;
}

/* ---------- a sheet -> a sim set ---------- */
function toSet(m) {
  return {
    name: '', species: m.species, item: m.item || '', ability: m.ability || '', moves: m.moves.slice(),
    nature: m.nature || 'Serious', gender: m.gender && m.gender !== 'N' ? m.gender : '',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, level: m.level || 50,
  };
}

/* ---------- the per-game context ---------- */
class Ctx {
  constructor(sheets) {
    this.sheets = sheets;           // { p1: [six sheet mons], p2: [...] }
    this.cache = new Map();
  }

  /* A battle whose field holds exactly these actives. actives = { p1:[ia|null, ib|null], p2:[...] }.
   * An empty slot is filled by another sheet mon that is then marked fainted. */
  battleFor(actives) {
    const key = actives.p1.join(',') + '/' + actives.p2.join(',');
    let b = this.cache.get(key);
    if (b) return b;
    b = new Battle({ formatid: FORMAT, seed: [7, 7, 7, 7] });
    const order = {}, filled = {};
    for (const s of ['p1', 'p2']) {
      const act = actives[s].slice();
      const used = new Set(act.filter(x => x != null));
      filled[s] = [false, false];
      for (let k = 0; k < 2; k++) {
        if (act[k] == null) {
          const f = [0, 1, 2, 3, 4, 5].find(i => !used.has(i));
          act[k] = f; used.add(f); filled[s][k] = true;
        }
      }
      const rest = [0, 1, 2, 3, 4, 5].filter(i => !used.has(i)).slice(0, 2);
      order[s] = act.concat(rest);
      b.setPlayer(s, { name: s, team: Teams.pack(this.sheets[s].map(toSet)) });
    }
    b.choose('p1', 'team ' + order.p1.map(i => i + 1).join(''));
    b.choose('p2', 'team ' + order.p2.map(i => i + 1).join(''));
    b.__filled = filled;
    b.__baseLog = b.log.length;
    // neutralise every source of randomness the probes might touch
    b.randomChance = () => false;
    this.cache.set(key, b);
    return b;
  }

  poke(b, side, slot) { return b[side].active[slot]; }
}

/* ---------- applying a tracker snapshot to a battle ---------- */
const eff = (b, id, extra) => (b.initEffectState ? b.initEffectState({ id, ...(extra || {}) }) : { id, ...(extra || {}) });

function applySnapshot(b, snap, domainsMid) {
  for (const s of ['p1', 'p2']) {
    const side = b[s];
    const ss = snap.sides[s];
    side.totalFainted = ss.totalFainted || 0;
    for (let k = 0; k < 2; k++) {
      const p = side.active[k];
      const m = ss.active[k];
      if (!m) {
        // an empty slot: a stand-in with no ability and no item, fainted, so nothing it carries can act
        p.hp = 0; p.fainted = true; p.status = ''; p.volatiles = {};
        p.ability = 'noability'; p.baseAbility = 'noability'; p.abilityState = eff(b, 'noability', { target: p });
        p.item = ''; p.itemState = eff(b, '', { target: p });
        continue;
      }
      p.fainted = false;
      if (p.species.name !== m.species) {
        const target = D.species.get(m.species);
        if (target.exists) p.formeChange(target.name, null, true);
      }
      p.ability = toID(m.ability || '');
      p.baseAbility = p.ability;
      p.abilityState = eff(b, p.ability, { target: p });
      p.item = m.item ? toID(m.item) : '';
      p.itemState = eff(b, p.item, { target: p });
      p.status = m.status || '';
      p.statusState = eff(b, p.status, { target: p });
      p.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0, ...(m.boosts || {}) };
      p.volatiles = {};
      // volatiles go through the sim's own addVolatile so their onStart state is set (Helping Hand's
      // multiplier lives in onStart); a stat the log already named overrides the recomputed one
      for (const [v, val] of Object.entries(m.vol || {})) {
        const ok = p.addVolatile(v, p);
        if (!ok || !p.volatiles[v]) p.volatiles[v] = eff(b, v, { target: p });
        if ((v === 'protosynthesis' || v === 'quarkdrive') && typeof val === 'string') p.volatiles[v].bestStat = val;
      }
      if (p.ability === 'supremeoverlord') p.abilityState.fallen = m.fallen || 0;
      // Unnerve's berry block reads abilityState.unnerved, which only its onStart sets (data/abilities.ts)
      // — a fresh state let a foe eat a resist berry it cannot (found on held-out games)
      if (/^(unnerve|asone)/.test(p.ability)) p.abilityState.unnerved = true;
      p.gender = m.gender || p.gender;
      const mid = domainsMid && domainsMid[s] && domainsMid[s][m.idx];
      if (mid) setStats(b, p, m, mid);
    }
  }
  // the field LAST: a forme change above runs the new forme's start handlers (a mega's Snow Warning
  // set snow in the stand-in battle — found by self-play), and the snapshot must overwrite them
  const f = b.field;
  f.weather = snap.field.weather || '';
  f.weatherState = eff(b, f.weather);
  f.terrain = snap.field.terrain || '';
  f.terrainState = eff(b, f.terrain);
  f.pseudoWeather = {};
  for (const pw of snap.field.pseudo) f.pseudoWeather[pw] = eff(b, pw, { duration: 5 });
  for (const s of ['p1', 'p2']) {
    b[s].sideConditions = {};
    for (const c of snap.sides[s].conditions) b[s].sideConditions[c] = eff(b, c, { duration: 5, layers: 1 });
  }
  b.log.length = b.__baseLog;
}

/* set a pokemon's stored stats from an SP vector (for its current species + nature), and its HP from
 * the displayed percentage band: hpMode 'lo' | 'hi' picks the band's low or high end. */
function setStats(b, p, m, sp, hpMode = 'lo') {
  const sp_ = p.species.name;
  const nat = m.nature;
  for (const st of ['atk', 'def', 'spa', 'spd', 'spe']) p.storedStats[st] = statValue(sp_, nat, st, sp[st]);
  // max HP is fixed when the mon is built and never recomputed on a forme change (sim/pokemon.ts
  // setSpecies: `if (!this.maxhp)`), so it comes from the SHEET species, not a mega forme
  const maxhp = statValue(m.sheetSpecies || sp_, nat, 'hp', sp.hp);
  p.maxhp = maxhp; p.baseMaxhp = maxhp;
  const band = hpBand(m.hp, maxhp);
  p.hp = band ? (hpMode === 'hi' ? band[1] : band[0]) : maxhp;
}

/* Champions display: floor(100*hp/maxhp) || 1, plus a colour suffix at 20 and 50 (sim/pokemon.ts
 * getHealth, the `champions` branch). Returns the [lo, hi] exact-HP band a display is consistent with. */
function hpBand(disp, maxhp) {
  if (!disp) return null;
  if (disp.fnt) return [0, 0];
  const p = disp.pct;
  let lo, hi;
  if (p === 1) { lo = 1; hi = Math.ceil(2 * maxhp / 100) - 1; }
  else { lo = Math.ceil(p * maxhp / 100); hi = Math.ceil((p + 1) * maxhp / 100) - 1; }
  if (p >= 100) { lo = maxhp; hi = maxhp; }
  hi = Math.min(hi, maxhp);
  if (disp.color && (p === 20 || p === 50)) {
    // 20: 'y' if hp*5 > maxhp else 'r'.  50: 'g' if hp*2 > maxhp else 'y'.
    const div = p === 20 ? 5 : 2;
    const above = (p === 20 ? disp.color === 'y' : disp.color === 'g');
    const cut = Math.floor(maxhp / div); // hp*div > maxhp  <=>  hp > floor(maxhp/div)
    if (above) lo = Math.max(lo, cut + 1); else hi = Math.min(hi, cut);
  }
  if (lo > hi) return null;          // this maxhp cannot display this reading
  return [lo, hi];
}

/* ---------- speed and priority ---------- */
/* priority (with fractional part) of a chosen move for a pokemon in battle b, via the sim's own
 * getActionSpeed + FractionalPriority. `proc` = the log showed a Quick Claw / Quick Draw / Custap proc. */
function actionPriority(b, p, moveName, targetLoc, proc) {
  const move = b.dex.getActiveMove(toID(moveName));
  const rc = b.randomChance;
  b.randomChance = () => !!proc;
  let frac;
  try { frac = b.runEvent('FractionalPriority', p, null, move, 0); } finally { b.randomChance = rc; }
  const action = { choice: 'move', pokemon: p, move, targetLoc: targetLoc || 0, fractionalPriority: frac, order: 200 };
  b.getActionSpeed(action);
  b.log.length = b.__baseLog;
  return action.priority;
}

/* the effective (queue) speed for each candidate raw Speed stat. */
function actionSpeeds(b, p, speStats) {
  const out = new Array(speStats.length);
  const keep = p.storedStats.spe;
  for (let i = 0; i < speStats.length; i++) { p.storedStats.spe = speStats[i]; out[i] = p.getActionSpeed(); }
  p.storedStats.spe = keep;
  return out;
}

/* ---------- damage ---------- */
/* The move exactly as useMoveInner hands it to the hit steps: the ModifyType / ModifyMove single events
 * (the move's own: Weather Ball, Terrain Pulse) and run events (the user's: Pixilate, Sheer Force...),
 * with the active move set so handlers that read battle.activeMove see it. */
function prepareMove(b, src, tgt, moveName, opts) {
  let move = b.dex.getActiveMove(toID(moveName));
  b.setActiveMove(move, src, tgt);
  b.singleEvent('ModifyType', move, null, src, tgt, move, move);
  b.singleEvent('ModifyMove', move, null, src, tgt, move, move);
  move = b.runEvent('ModifyType', src, tgt, move, move);
  move = b.runEvent('ModifyMove', src, tgt, move, move);
  move.willCrit = !!opts.crit;
  if (opts.spread) move.spreadHit = true;
  move.hit = opts.hit || 1;
  return move;
}

function saveMons(ps) { return ps.map(p => ({ p, item: p.item, itemState: p.itemState, vol: { ...p.volatiles }, ab: p.ability, abs: p.abilityState })); }
function restoreMons(saved) { for (const s of saved) { s.p.item = s.item; s.p.itemState = s.itemState; s.p.volatiles = { ...s.vol }; s.p.ability = s.ab; s.p.abilityState = s.abs; } }

/* [min, max] damage of one hit for the current stored stats, over the 16 rolls. The sim's randomizer is
 * monotone and everything after it is monotone, so the two extreme rolls bracket all sixteen.
 * Returns null if the sim says the move does no damage (immunity, 0 BP). */
function damageRange(b, src, tgt, moveName, opts) {
  const tr = b.trunc;
  const saved = saveMons([src, tgt]);
  const rnd = b.randomizer;
  const res = [];
  try {
    for (const roll of [85, 100]) {
      const move = prepareMove(b, src, tgt, moveName, opts);
      b.randomizer = bd => tr(tr(bd * roll) / 100);
      const d = b.actions.getDamage(src, tgt, move, true);
      restoreMons(saved);
      if (typeof d !== 'number') return null;
      res.push(d);
    }
  } finally {
    b.randomizer = rnd;
    b.clearActiveMove && b.clearActiveMove();
    b.log.length = b.__baseLog;
  }
  return res;
}

/* The full [offence value] x [defence value] table of [min,max] damage, computed by DECOMPOSITION:
 * getDamage depends on the offence SP only through the modified attack, on the defence SP only through
 * the modified defence, and returns modifyDamage(baseDamage). So: one probe call per offence value and
 * one per defence value (capturing the sim's own ModifyAtk/SpA/Def/SpD results and baseDamage), the
 * base-damage line of getDamage for each cell, and modifyDamage memoised per distinct baseDamage.
 * The decomposition is VERIFIED on every call: every probe's captured baseDamage must equal the line's
 * value, and `checks` random cells are recomputed by a direct getDamage. A mismatch returns
 * {fallback:true} and the caller enumerates directly. */
function damageTable(b, src, tgt, moveName, opts, setOff, setDef, nO, nD, checks = 3) {
  const tr = b.trunc;
  const saved = saveMons([src, tgt]);
  const origRun = b.runEvent;
  const origMD = b.actions.modifyDamage;
  const rnd = b.randomizer;
  let cap = null;
  const phys = () => cap.cat === 'Physical';
  b.runEvent = function (name, target, source, effect, relayVar, ...rest) {
    const r = origRun.call(this, name, target, source, effect, relayVar, ...rest);
    if (cap) {
      if (name === 'BasePower') cap.bp = r;
      else if (name === 'ModifyAtk' || name === 'ModifySpA') cap.atk = r;
      else if (name === 'ModifyDef' || name === 'ModifySpD') cap.def = r;
    }
    return r;
  };
  b.actions.modifyDamage = function (bd, ...rest) { if (cap) { cap.bd = bd; cap.move = rest[2]; } return origMD.call(this, bd, ...rest); };
  const probe = () => {
    const move = prepareMove(b, src, tgt, moveName, opts);
    cap = { cat: b.getCategory(move) };
    b.randomizer = x => x;
    const d = b.actions.getDamage(src, tgt, move, true);
    const c = cap; cap = null;
    restoreMons(saved);
    return typeof d === 'number' ? c : null;
  };
  const line = (bp, a, d) => tr(tr(tr(tr(2 * src.level / 5 + 2) * Math.max(1, bp) * a) / d) / 50);
  try {
    setOff(0); setDef(0);
    const atk = new Array(nO), def = new Array(nD);
    let ref = null;
    for (let j = 0; j < nD; j++) {
      setDef(j);
      const c = probe();
      if (!c) return null;
      def[j] = c.def;
      if (line(c.bp, c.atk, c.def) !== c.bd) return { fallback: 'baseDamage_line' };
      ref = ref || c;
      if (c.atk !== ref.atk || c.bp !== ref.bp) return { fallback: 'offence_moved_with_defence' };
    }
    setDef(0);
    for (let i = 0; i < nO; i++) {
      setOff(i);
      const c = probe();
      if (!c) return null;
      atk[i] = c.atk;
      if (line(c.bp, c.atk, c.def) !== c.bd) return { fallback: 'baseDamage_line' };
      if (c.def !== def[0] || c.bp !== ref.bp) return { fallback: 'defence_moved_with_offence' };
    }
    // modifyDamage memo per baseDamage, both extreme rolls, on a prepared move with this target's hit data
    const memo = new Map();
    const prepared = {};
    for (const roll of [85, 100]) {
      const move = prepareMove(b, src, tgt, moveName, opts);
      cap = { cat: b.getCategory(move) };
      b.randomizer = x => x;
      b.actions.getDamage(src, tgt, move, true);      // establishes the move's hit data (crit) for tgt
      cap = null;
      restoreMons(saved);
      prepared[roll] = move;
    }
    const md = bd => {
      let v = memo.get(bd);
      if (v) return v;
      v = [];
      for (const roll of [85, 100]) {
        b.randomizer = x => tr(tr(x * roll) / 100);
        v.push(origMD.call(b.actions, bd, src, tgt, prepared[roll], true));
        restoreMons(saved);
      }
      memo.set(bd, v);
      return v;
    };
    const table = [];
    for (let i = 0; i < nO; i++) {
      const row = [];
      for (let j = 0; j < nD; j++) row.push(md(line(ref.bp, atk[i], def[j])));
      table.push(row);
    }
    b.randomizer = rnd;
    // verification: direct getDamage on random cells
    for (let k = 0; k < checks; k++) {
      const i = Math.floor((k + 0.5) * nO / checks), j = nD - 1 - Math.floor((k + 0.5) * nD / checks);
      setOff(i); setDef(j);
      const r = damageRangeRaw(b, src, tgt, moveName, opts, saved);
      if (!r || r[0] !== table[i][j][0] || r[1] !== table[i][j][1]) return { fallback: 'cell_check', cell: [i, j], direct: r, table: table[i][j] };
    }
    return { table, memo: memo.size };
  } finally {
    b.runEvent = origRun;
    b.actions.modifyDamage = origMD;
    b.randomizer = rnd;
    cap = null;
    restoreMons(saved);
    b.clearActiveMove && b.clearActiveMove();
    b.log.length = b.__baseLog;
  }
}
function damageRangeRaw(b, src, tgt, moveName, opts, saved) {
  const tr = b.trunc;
  const res = [];
  for (const roll of [85, 100]) {
    const move = prepareMove(b, src, tgt, moveName, opts);
    b.randomizer = bd => tr(tr(bd * roll) / 100);
    const d = b.actions.getDamage(src, tgt, move, true);
    restoreMons(saved);
    if (typeof d !== 'number') return null;
    res.push(d);
  }
  return res;
}

module.exports = {
  D, toID, FORMAT, STATS, SP_TOTAL, SP_CAP, VALIDATOR, Battle, Teams,
  statValue, hpBand, Ctx, applySnapshot, setStats, actionPriority, actionSpeeds, damageRange, damageTable, prepareMove, toSet,
};
