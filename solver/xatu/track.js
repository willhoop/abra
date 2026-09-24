/* solver/xatu/track.js — an incremental PUBLIC-state tracker over the battle protocol, emitting the
 * observations XATU conditions on:
 *
 *   reveal  — a sheet mon took the field (lead, switch, replacement, drag). The ONLY hard evidence the
 *             bring belief uses.
 *   order   — at the moment mover A acted, mover B (who acted later in the same turn, from a turn-start
 *             choice) was still queued. With the Gen 8+ dynamic re-sort (sim/battle.ts: updateSpeed +
 *             queue.sort after every action) that means, at that instant, A's (priority, speed) >= B's.
 *   damage  — one direct hit: attacker, defender, move, crit, spread, the defender's display before and
 *             after, and whether the reading is only a LOWER bound (Focus Sash / Sturdy / Endure / faint).
 *
 * Each order and damage observation carries a snapshot of the four actives, the field and the side
 * conditions at that instant, which sd.js replays into a real sim Battle. Anything the snapshot cannot
 * carry faithfully makes the observation SKIPPED with a named reason, never silently approximated —
 * a wrong constraint would rule the truth out, which is the one failure XATU may not have.
 *
 * Feed it protocol lines one at a time (live) or a whole replay log (offline). Sheets come from the
 * |showteam| lines (open team sheets) or are passed in.
 */
'use strict';
const X = require('../human/dex.js');
const { parseShowteam } = require('../human/parse_game.js');
const { D, toID } = X;

const SLOT = { a: 0, b: 1 };
const OTHER = { p1: 'p2', p2: 'p1' };

/* Volatiles the sim reproduces from their mere presence and that can move speed or damage. */
const SIM_VOLATILES = new Set(['helpinghand', 'charge', 'flashfire', 'glaiverush', 'roost', 'magnetrise',
  'smackdown', 'tarshot', 'minimize', 'unburden', 'protosynthesis', 'quarkdrive']);
/* Volatiles that cannot touch a speed or a damage calculation (read against their conditions). */
const INERT_VOLATILES = new Set(['protect', 'wideguard', 'quickguard', 'followme', 'ragepowder', 'spotlight',
  'endure', 'destinybond', 'confusion', 'taunt', 'encore', 'disable', 'torment', 'leechseed', 'perish', 'yawn',
  'imprison', 'healblock', 'attract', 'throatchop', 'saltcure', 'focusenergy', 'laserfocus', 'dragoncheer',
  'noretreat', 'octolock', 'partiallytrapped', 'infestation', 'firespin', 'whirlpool', 'sandtomb', 'bind',
  'wrap', 'magmastorm', 'snaptrap', 'thundercage', 'mustrecharge', 'stockpile', 'aquaring', 'ingrain',
  'curse', 'nightmare', 'uproar', 'trapped', 'maxguard', 'craftyshield', 'matblock', 'fallen', 'silktrap',
  'banefulbunker', 'spikyshield', 'kingsshield', 'obstruct', 'burningbulwark', 'syrupbomb', 'lockon',
  'powder', 'electrify', 'snatch', 'grudge', 'embargo', 'foresight', 'miracleeye', 'charge_turn']);
const SIDE_SIM = new Set(['tailwind', 'reflect', 'lightscreen', 'auroraveil']);
const PSEUDO_BLOCK = new Set(['wonderroom']);   // swaps def/spd: our per-stat variable mapping would be wrong

/* Moves whose base power callback depends only on state the snapshot carries (derived list reviewed
 * against each callback's source; see the report). Everything else with a callback is skipped. */
const BP_OK = new Set(['acrobatics', 'grassknot', 'lowkick', 'heatcrash', 'heavyslam', 'hex', 'infernalparade',
  'lastrespects', 'powertrip', 'storedpower', 'risingvoltage']);
const BP_FULLHP_ATK = new Set(['eruption', 'waterspout']);   // exact only at a 100% display
const BP_FULLHP_DEF = new Set(['hardpress']);
const ONBP_BLOCK = new Set(['lashout', 'ficklebeam']);      // history / hidden-coin base power

/* Line kinds allowed between a move line and the defender's first damage line. Each is either modelled
 * by the tracker (so the lazy snapshot already contains it) or cannot move this hit's damage. */
const PRE_HIT_OK = new Set(['-crit', '-supereffective', '-resisted', '-immune', '-miss', '-damage', '-fail',
  '-activate', '-anim', '-prepare', '-boost', '-unboost', '-hitcount', '-enditem', '-heal', 'faint',
  '-formechange', 'detailschange', '-status', '-singleturn', '-ability', '-block', '-hint', '-weather',
  '-fieldstart', '-fieldend', '-sidestart', '-sideend', '-clearnegativeboost', '-message', '-notarget']);   // NOT -zbroken: Unseen Fist through Protect is a 1/4 hit the snapshot cannot carry

function parseIdent(s) {
  const m = /^(p[12])([ab]?):\s?(.*)$/.exec(String(s || '').trim());
  return m ? { side: m[1], pos: m[2] || null, nick: m[3] } : null;
}
function parseDisp(s) {
  s = String(s || '').trim();
  if (!s) return null;
  const [h, st] = s.split(' ');
  if (h === '0' || st === 'fnt') return { pct: 0, color: '', fnt: true, status: null };
  const m = /^(\d+)\/(\d+)([a-z]?)$/.exec(h);
  if (!m) return null;
  return { pct: +m[1], color: m[3] || '', fnt: false, status: st || null };
}
const stripEff = s => String(s || '').replace(/^(move|ability|item):\s*/, '').trim();
const numOf = sp => { const x = D.species.get(sp); return x.exists ? x.num : null; };

function volName(raw) {
  let id = toID(stripEff(raw));
  let val = true;
  let m;
  if ((m = /^perish(\d)$/.exec(id))) { id = 'perish'; val = +m[1]; }
  else if ((m = /^fallen(\d)$/.exec(id))) { id = 'fallen'; val = +m[1]; }
  else if ((m = /^stockpile(\d)$/.exec(id))) { id = 'stockpile'; val = +m[1]; }
  else if ((m = /^(protosynthesis|quarkdrive)(atk|def|spa|spd|spe)$/.exec(id))) { id = m[1]; val = m[2]; }
  return { id, val };
}

class Tracker {
  constructor(opts = {}) {
    this.sheets = opts.sheets || { p1: null, p2: null };
    this.sides = {};
    for (const s of ['p1', 'p2']) this.sides[s] = { active: [null, null], conditions: new Set(), totalFainted: 0, mons: [], mega_used: false };
    this.field = { weather: '', terrain: '', pseudo: new Set() };
    this.turn = 0;
    this.phase = 'pre';
    this.out = { reveals: [], order: [], damage: [], skipped: {}, order_anomalies: [] };
    this.turnActs = [];
    this.turnStartActive = null;
    this.turnFlags = new Set();
    this.turnForced = new Set();
    this.procs = new Set();
    this.block = null;
    this.ended = false;
    if (this.sheets.p1 && this.sheets.p2) this._initMons();
  }

  skip(reason, n = 1) { this.out.skipped[reason] = (this.out.skipped[reason] || 0) + n; }

  _initMons() {
    for (const s of ['p1', 'p2']) {
      this.sides[s].mons = this.sheets[s].map((m, i) => ({
        idx: i, species: m.species, num: numOf(m.species), ability: m.ability, item: m.item, nature: m.nature,
        gender: m.gender, status: null, boosts: {}, vol: {}, hp: { pct: 100, color: '', fnt: false }, seen: false,
      }));
    }
  }

  monAt(side, slot) { const i = this.sides[side].active[slot]; return i == null ? null : this.sides[side].mons[i]; }
  resolve(identStr) {
    const id = parseIdent(identStr);
    if (!id) return null;
    if (id.pos) { const m = this.monAt(id.side, SLOT[id.pos]); return m ? { side: id.side, slot: SLOT[id.pos], m } : null; }
    // positionless ident: match by name against species
    const mons = this.sides[id.side].mons;
    const m = mons.find(x => x.species === id.nick || D.species.get(x.species).baseSpecies === id.nick);
    return m ? { side: id.side, slot: this.sides[id.side].active.indexOf(m.idx), m } : null;
  }

  /* the snapshot sd.applySnapshot consumes */
  snapshot(hpMap) {
    const sides = {};
    for (const s of ['p1', 'p2']) {
      const S = this.sides[s];
      sides[s] = {
        conditions: [...S.conditions].filter(c => SIDE_SIM.has(c)), totalFainted: S.totalFainted,
        active: S.active.map(i => {
          if (i == null) return null;
          const m = S.mons[i];
          // hpMap: HP readings to use instead of the current ones, keyed side+idx. A spread move's
          // hits are computed together, so a partner KO'd earlier IN THE SAME MOVE still counts (its
          // Fairy Aura boosted the hit on its ally — found on held-out games)
          const ov = hpMap && hpMap[s + i];
          if ((ov || m.hp).fnt) return null;
          const vol = {};
          for (const [k, v] of Object.entries(m.vol)) if (SIM_VOLATILES.has(k)) vol[k] = v;
          const hp = ov || m.hp;
          return { idx: i, species: m.species, sheetSpecies: this.sheets[s][i].species, ability: m.ability, item: m.item, nature: m.nature, gender: m.gender,
            status: m.status, boosts: { ...m.boosts }, vol, hp: { ...hp }, fallen: m.vol.fallen || 0 };
        }),
      };
    }
    return { turn: this.turn, field: { weather: this.field.weather, terrain: this.field.terrain, pseudo: [...this.field.pseudo] }, sides };
  }

  /* why a mon cannot be replayed into the sim right now (null = fine) */
  unreplayable(m) {
    if (!m) return 'empty';
    for (const k of Object.keys(m.vol)) {
      if (SIM_VOLATILES.has(k) || INERT_VOLATILES.has(k)) continue;
      return 'volatile:' + k;
    }
    return null;
  }
  fieldBlock() {
    for (const p of this.field.pseudo) if (PSEUDO_BLOCK.has(p)) return 'pseudo:' + p;
    return null;
  }

  feedLog(log) { for (const l of String(log).split('\n')) this.feed(l); this.finish(); return this.out; }

  finish() { this._closeBlock(); this._endTurn(); }

  feed(line) {
    if (this.ended || !line || line[0] !== '|') return;
    const parts = line.split('|');
    const kind = parts[1];
    if (this.block && kind !== 'move' && kind !== 'cant') this._blockLine(kind, parts);
    switch (kind) {
      case 'showteam': {
        this.sheets[parts[2]] = parseShowteam(parts.slice(3).join('|'));
        if (this.sheets.p1 && this.sheets.p2) this._initMons();
        break;
      }
      case 'start': this.phase = 'lead'; break;
      case 'turn': {
        this._closeBlock(); this._endTurn();
        this.turn = +parts[2]; this.phase = 'turn';
        this.turnStartActive = { p1: this.sides.p1.active.slice(), p2: this.sides.p2.active.slice() };
        break;
      }
      case 'upkeep': this._closeBlock(); this._endTurn(); this.phase = 'post'; break;
      case 'switch': case 'drag': {
        this._closeBlock();
        const id = parseIdent(parts[2]);
        const sp = String(parts[3] || '').split(',')[0].trim();
        const n = numOf(sp);
        const S = this.sides[id.side];
        const m = S.mons.find(x => x.num === n);
        if (!m) { this.skip('unknown_switch_species'); break; }
        const slot = SLOT[id.pos];
        const prev = S.active[slot];
        // Baton Pass hands the outgoing mon's stat stages and passable volatiles to the incoming one
        // (found on held-out games: a Calm Mind passed to an Ampharos read as a contradiction)
        const passed = parts.some(x => /\[from\] Baton Pass/.test(x)) && prev != null ? { boosts: { ...S.mons[prev].boosts }, vol: { ...S.mons[prev].vol } } : null;
        if (prev != null && prev !== m.idx) { const pm = S.mons[prev]; pm.boosts = {}; pm.vol = {}; }
        S.active[slot] = m.idx;
        m.boosts = passed ? passed.boosts : {}; m.vol = passed ? passed.vol : {};
        // an ability changed by a move (Worry Seed, Skill Swap, Mummy...) reverts on switching out: the
        // mon comes back with its sheet ability, or its mega's (found on held-out games)
        m.ability = m.baseAbility || this.sheets[id.side][m.idx].ability;
        const disp = parseDisp(parts[4]);
        if (disp) { m.hp = { pct: disp.pct, color: disp.color, fnt: disp.fnt }; if (disp.status !== null) m.status = disp.status; }
        m.species = sp && D.species.get(sp).exists ? D.species.get(sp).name : m.species;
        const how = this.phase === 'lead' ? 'lead' : kind === 'drag' ? 'drag' : this.phase === 'post' ? 'replace' : 'switch';
        this.out.reveals.push({ turn: this.turn, side: id.side, idx: m.idx, how, first: !m.seen });
        m.seen = true;
        break;
      }
      case 'replace': this.ended = true; this.skip('illusion_game'); break;
      case 'swap': {
        const r = this.resolve(parts[2]);
        if (r) { const S = this.sides[r.side]; const t = +parts[3]; const o = S.active[t]; S.active[t] = r.m.idx; S.active[r.slot] = o; }
        break;
      }
      case 'detailschange': case '-formechange': {
        const r = this.resolve(parts[2]);
        if (!r) break;
        const sp = D.species.get(String(parts[3]).split(',')[0].trim());
        if (sp.exists) {
          r.m.species = sp.name;
          if (kind === 'detailschange' && sp.isMega) { r.m.ability = sp.abilities['0']; r.m.baseAbility = r.m.ability; }
        }
        break;
      }
      case '-mega': { const id = parseIdent(parts[2]); if (id) this.sides[id.side].mega_used = true; break; }
      case 'move': this._move(parts); break;
      case 'cant': {
        this._closeBlock();
        const r = this.resolve(parts[2]);
        if (r) this._endSingleMove(r.m);
        if (r && this.phase === 'turn') this.turnActs.push({ kind: 'cant', side: r.side, slot: r.slot, idx: r.m.idx });
        break;
      }
      case 'faint': { const r = this.resolve(parts[2]); if (r) { r.m.hp = { pct: 0, color: '', fnt: true }; this.sides[r.side].totalFainted++; } break; }
      case '-damage': case '-heal': case '-sethp': {
        const r = this.resolve(parts[2]);
        const disp = parseDisp(parts[3]);
        if (r && disp) { r.m.hp = { pct: disp.pct, color: disp.color, fnt: disp.fnt }; if (disp.status) r.m.status = disp.status; }
        break;
      }
      case '-status': { const r = this.resolve(parts[2]); if (r) r.m.status = parts[3]; break; }
      case '-curestatus': { const r = this.resolve(parts[2]); if (r) r.m.status = null; break; }
      case '-cureteam': { const id = parseIdent(parts[2]); if (id) for (const m of this.sides[id.side].mons) m.status = null; break; }
      case '-boost': case '-unboost': {
        const r = this.resolve(parts[2]); if (!r) break;
        const st = parts[3], n = (+parts[4] || 0) * (kind === '-boost' ? 1 : -1);
        r.m.boosts[st] = Math.max(-6, Math.min(6, (r.m.boosts[st] || 0) + n));
        break;
      }
      case '-setboost': { const r = this.resolve(parts[2]); if (r) r.m.boosts[parts[3]] = +parts[4]; break; }
      case '-clearboost': { const r = this.resolve(parts[2]); if (r) r.m.boosts = {}; break; }
      case '-clearallboost': for (const s of ['p1', 'p2']) for (const m of this.sides[s].mons) m.boosts = {}; break;
      case '-clearnegativeboost': { const r = this.resolve(parts[2]); if (r) for (const k of Object.keys(r.m.boosts)) if (r.m.boosts[k] < 0) r.m.boosts[k] = 0; break; }
      case '-clearpositiveboost': { const r = this.resolve(parts[2]); if (r) for (const k of Object.keys(r.m.boosts)) if (r.m.boosts[k] > 0) r.m.boosts[k] = 0; break; }
      case '-invertboost': { const r = this.resolve(parts[2]); if (r) for (const k of Object.keys(r.m.boosts)) r.m.boosts[k] = -r.m.boosts[k]; break; }
      case '-copyboost': { const a = this.resolve(parts[2]), b = this.resolve(parts[3]); if (a && b) a.m.boosts = { ...b.m.boosts }; break; }
      case '-swapboost': {
        const a = this.resolve(parts[2]), b = this.resolve(parts[3]);
        if (a && b) { const sts = parts[4] ? parts[4].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']; for (const st of sts) { const t = a.m.boosts[st] || 0; a.m.boosts[st] = b.m.boosts[st] || 0; b.m.boosts[st] = t; } }
        break;
      }
      case '-transform': { const r = this.resolve(parts[2]); if (r) r.m.vol.transform = true; break; }
      case '-start': {
        const r = this.resolve(parts[2]); if (!r) break;
        const v = volName(parts[3]);
        r.m.vol[v.id] = v.val;
        // an Encore landing mid-turn rewrites the target's queued action (its move changes, its slot in
        // the queue does not): its later position is no evidence about its own choice's priority
        if (this.phase === 'turn' && v.id === 'encore') this.turnForced.add(r.side + r.m.idx);
        break;
      }
      case '-end': { const r = this.resolve(parts[2]); if (r) { const v = volName(parts[3]); delete r.m.vol[v.id]; } break; }
      case '-singleturn': {
        const r = this.resolve(parts[2]); if (r) r.m.vol[toID(stripEff(parts[3]))] = 'turn';
        break;
      }
      case '-singlemove': { const r = this.resolve(parts[2]); if (r) r.m.vol[toID(stripEff(parts[3]))] = 'move'; break; }
      case '-item': { const r = this.resolve(parts[2]); if (r) r.m.item = parts[3]; break; }
      case '-enditem': {
        const r = this.resolve(parts[2]); if (!r) break;
        const it = stripEff(parts[3]);
        const eaten = parts.includes('[eat]');
        if (toID(it) === 'custapberry') this.procs.add(r.side + r.m.idx);
        r.m.item = null;
        if (toID(r.m.ability) === 'unburden') r.m.vol.unburden = true;
        void eaten;
        break;
      }
      case '-activate': {
        const r = this.resolve(parts[2]);
        const what = String(parts[3] || '');
        if (r && (what === 'item: Quick Claw' || what === 'ability: Quick Draw')) this.procs.add(r.side + r.m.idx);
        const eff = toID(stripEff(what));
        if (['afteryou', 'quash', 'instruct'].includes(eff)) this.turnFlags.add('reorder:' + eff);
        // moves that rewrite STORED stats (not stages) until switch-out: the SP-to-stat map no longer
        // holds for either mon, so both become unreplayable (a volatile outside both sets blocks them)
        if (r && ['speedswap', 'powersplit', 'guardsplit'].includes(eff)) {
          r.m.vol['stored:' + eff] = true;
          const of = parts.find(p => p.startsWith('[of] ')); const t = of && this.resolve(of.slice(5));
          if (t) t.m.vol['stored:' + eff] = true;
        }
        if (r && ['mummy', 'lingeringaroma'].includes(eff) && parts[4]) { const t = this.resolve(parts[4]); if (t) t.m.ability = stripEff(what); }
        if (r && eff === 'wanderingspirit' && parts[4]) { const t = this.resolve(parts[4]); if (t) { const a = t.m.ability; t.m.ability = r.m.ability; r.m.ability = a; } }
        if (r && eff === 'skillswap') { const of = parts.find(p => p.startsWith('[of] ')); const t = of && this.resolve(of.slice(5)); if (t) { const a = t.m.ability; t.m.ability = r.m.ability; r.m.ability = a; } }
        break;
      }
      case '-ability': {
        const r = this.resolve(parts[2]); if (!r) break;
        r.m.ability = parts[3];
        break;
      }
      case '-endability': { const r = this.resolve(parts[2]); if (r) r.m.vol.gastroacid = true; break; }
      case '-weather': {
        if (parts.includes('[upkeep]')) break;
        this.field.weather = parts[2] === 'none' ? '' : toID(parts[2]);
        break;
      }
      case '-fieldstart': {
        const id = toID(stripEff(parts[2]));
        if (id.endsWith('terrain')) this.field.terrain = id; else this.field.pseudo.add(id);
        break;
      }
      case '-fieldend': {
        const id = toID(stripEff(parts[2]));
        if (id.endsWith('terrain')) { if (this.field.terrain === id) this.field.terrain = ''; } else this.field.pseudo.delete(id);
        break;
      }
      case '-sidestart': { const s = String(parts[2]).slice(0, 2); this.sides[s].conditions.add(toID(stripEff(parts[3]))); break; }
      case '-sideend': { const s = String(parts[2]).slice(0, 2); this.sides[s].conditions.delete(toID(stripEff(parts[3]))); break; }
      case '-swapsideconditions': { const t = this.sides.p1.conditions; this.sides.p1.conditions = this.sides.p2.conditions; this.sides.p2.conditions = t; break; }
      case 'win': case 'tie': this._closeBlock(); this._endTurn(); this.ended = true; break;
      default: break;
    }
  }

  /* ---- a move line: an action for ordering, and the start of a hit block ---- */
  _move(parts) {
    this._closeBlock();
    const r = this.resolve(parts[2]);
    if (!r) return;
    const flags = parts.slice(5);
    const from = flags.find(f => f.startsWith('[from]'));
    const moveName = parts[3];
    const mv = D.moves.get(moveName);
    this._endSingleMove(r.m);
    const isAction = !from || /lockedmove/i.test(from);
    let targetLoc = 0;
    const tid = parseIdent(parts[4]);
    if (tid && tid.pos) targetLoc = (tid.side === r.side ? -1 : 1) * (SLOT[tid.pos] + 1);
    if (this.phase === 'turn' && isAction) {
      this.turnActs.push({ kind: 'move', side: r.side, slot: r.slot, idx: r.m.idx, move: mv.exists ? mv.name : moveName,
        targetLoc, snap: this.snapshot(), unrep: this._actUnrep(r) });
    }
    if (['round', 'firepledge', 'waterpledge', 'grasspledge'].includes(mv.id)) this.turnFlags.add('reorder:' + mv.id);
    if (!isAction) { this.block = null; return; }
    if (!mv.exists || mv.category === 'Status') return;
    this.block = { side: r.side, slot: r.slot, idx: r.m.idx, move: mv, spread: flags.some(f => f.startsWith('[spread]')),
      targets: {}, seenKinds: [], hpBefore: this._hpAll() };
  }

  /* a -singlemove volatile (Glaive Rush's drawback) is removed in its holder's onBeforeMove, which runs
   * whether the holder then moves or is stopped (a flinch / paralysis / sleep 'cant' — found by
   * self-play: a Glaive Rush user that flinched kept the drawback in the tracker and doubled a hit) */
  _endSingleMove(m) { for (const [k, v] of Object.entries(m.vol)) if (v === 'move') delete m.vol[k]; }

  _actUnrep(r) {
    const u = this.unreplayable(r.m) || this.fieldBlock();
    return u;
  }

  _hpAll() {
    const o = {};
    for (const s of ['p1', 'p2']) for (const i of this.sides[s].active) if (i != null) o[s + i] = { ...this.sides[s].mons[i].hp };
    return o;
  }

  /* lines inside a hit block: attribute crit / damage to targets; the lazy snapshot is taken at the
   * first damage line of each target, with the target's HP put back to its pre-hit display */
  _blockLine(kind, parts) {
    const B = this.block;
    if (!B) return;
    if (['switch', 'drag', 'upkeep', 'turn', 'win', 'tie', '', 'cant'].includes(kind)) { this._closeBlock(); return; }
    const r = ['-crit', '-damage', '-enditem', '-activate', '-supereffective', '-resisted'].includes(kind) ? this.resolve(parts[2]) : null;
    const key = r ? r.side + r.m.idx : null;
    if (kind === '-crit' && r) { (B.targets[key] = B.targets[key] || { hits: 0 }).crit = true; return; }
    if (kind === '-damage' && r) {
      const isFrom = parts.some(p => p.startsWith('[from]'));
      if (isFrom) { B.seenKinds.push('-damage[from]'); return; }
      const T = (B.targets[key] = B.targets[key] || { hits: 0 });
      T.hits++;
      if (T.hits > 1) return;          // multi-hit: the first hit only
      const disp = parseDisp(parts[3]);
      T.obs = {
        turn: this.turn, atk: { side: B.side, idx: B.idx }, def: { side: r.side, idx: r.m.idx }, move: B.move.name,
        crit: !!T.crit, spread: B.spread, before: B.hpBefore[key], after: disp, lowerOnly: !!(disp && disp.fnt) || !!T.survived,
        pre: B.seenKinds.slice(), snap: null, unrep: null,
      };
      // the lazy snapshot: state now, every active's HP put back to its reading at the move line
      T.obs.snap = this.snapshot(B.hpBefore);
      // restore an item this hit consumed before its damage line — a resist berry ([weaken]) or a Focus
      // Sash — since the damage was computed while it was held (Knock Off's boost reads it)
      if (T.weakened) { for (const a of T.obs.snap.sides[r.side].active) if (a && a.idx === r.m.idx) a.item = T.weakened; }
      if (B.gem) { const ss = T.obs.snap.sides[B.side].active; for (const a of ss) if (a && a.idx === B.idx) a.item = B.gem; }
      const atkM = this.sides[B.side].mons[B.idx];
      T.obs.unrep = this.unreplayable(atkM) || this.unreplayable(r.m) || this.fieldBlock() || this._moveBlock(B, atkM, r.m) ||
        (B.gem ? 'gem' : null) || null;
      return;
    }
    if (kind === '-enditem' && r) {
      const it = stripEff(parts[3]);
      if (parts.includes('[weaken]')) { (B.targets[key] = B.targets[key] || { hits: 0 }).weakened = it; return; }
      if (/\[from\] gem/.test(parts.join('|')) || / Gem$/.test(it)) { B.gem = it; return; }
      // Focus Sash / Sturdy / Endure print BEFORE the damage line (they act in onDamage): the reading
      // that follows is a survival at 1 HP, i.e. only a LOWER bound on the roll
      // (a Sash removed by Knock Off / Trick carries [from] and is not a survival)
      if (toID(it) === 'focussash' && !parts.some(x => x.startsWith('[from]'))) { const T = (B.targets[key] = B.targets[key] || { hits: 0 }); if (T.obs) T.obs.lowerOnly = true; else { T.survived = true; T.weakened = it; } }
      return;
    }
    if (kind === '-activate' && r) {
      const what = toID(stripEff(parts[3]));
      if (what === 'sturdy' || what === 'endure') { const T = (B.targets[key] = B.targets[key] || { hits: 0 }); if (T.obs) T.obs.lowerOnly = true; else T.survived = true; }
      if (what === 'substitute') (B.targets[key] = B.targets[key] || { hits: 0 }).sub = true;
      if (!['protect', 'wideguard', 'quickguard', 'sturdy', 'endure', 'substitute', 'focussash'].includes(what)) B.seenKinds.push('-activate:' + what);
      return;
    }
    if (!PRE_HIT_OK.has(kind)) B.seenKinds.push(kind);
  }

  _moveBlock(B, atkM, defM) {
    const mv = B.move;
    if (mv.damageCallback || mv.damage || mv.ohko) return 'move:fixed_damage';
    if (ONBP_BLOCK.has(mv.id)) return 'move:history_bp';
    if (mv.basePowerCallback && !BP_OK.has(mv.id)) {
      if (BP_FULLHP_ATK.has(mv.id) && B.hpBefore[B.side + B.idx] && B.hpBefore[B.side + B.idx].pct === 100) return null;
      if (BP_FULLHP_DEF.has(mv.id)) {
        const k = Object.keys(B.targets).find(k2 => B.targets[k2].obs && !B.targets[k2].checked);
        void k;
      }
      return 'move:bp_callback';
    }
    if (atkM.vol.transform || defM.vol.transform) return 'transform';
    return null;
  }

  _closeBlock() {
    const B = this.block;
    if (!B) return;
    this.block = null;
    for (const T of Object.values(B.targets)) {
      if (!T.obs) continue;
      const o = T.obs;
      if (T.sub) { this.skip('substitute'); continue; }
      const bad = o.pre.filter(k => k !== '-damage[from]');
      if (bad.length) { this.skip('pre_hit:' + bad[0]); continue; }
      if (o.unrep) { this.skip(o.unrep); continue; }
      if (!o.before || !o.after) { this.skip('no_hp_reading'); continue; }
      if (BP_FULLHP_DEF.has(toID(o.move)) && o.before.pct !== 100) { this.skip('move:bp_callback'); continue; }
      delete o.pre; delete o.unrep;
      this.out.damage.push(o);
    }
  }

  /* ---- turn end: pairwise order constraints ---- */
  _endTurn() {
    const acts = this.turnActs;
    this.turnActs = [];
    const flags = this.turnFlags; this.turnFlags = new Set();
    const procs = this.procs; this.procs = new Set();
    const forced = this.turnForced; this.turnForced = new Set();
    // single-turn volatiles expire
    for (const s of ['p1', 'p2']) for (const m of this.sides[s].mons) for (const [k, v] of Object.entries(m.vol)) if (v === 'turn') delete m.vol[k];
    if (!acts.length || !this.turnStartActive) return;
    if ([...flags].some(f => f.startsWith('reorder:'))) { this.skip('order_turn:' + [...flags].find(f => f.startsWith('reorder:')).slice(8)); return; }
    const start = this.turnStartActive;
    const moves = acts.filter(a => a.kind === 'move' && start[a.side].includes(a.idx));
    const done = new Set();
    for (let i = 0; i < moves.length; i++) {
      const A = moves[i];
      if (done.has(A.side + A.idx)) continue;       // a second move line by the same mon (e.g. a called move) is not an action
      done.add(A.side + A.idx);
      const seenLater = new Set();
      for (let j = i + 1; j < moves.length; j++) {
        const B = moves[j];
        const k = B.side + B.idx;
        if (seenLater.has(k) || done.has(k) || k === A.side + A.idx) continue;
        seenLater.add(k);
        // B must have been on the field at A's snapshot
        const bOn = A.snap.sides[B.side].active.some(x => x && x.idx === B.idx);
        if (!bOn) { this.skip('order:b_not_on_field'); continue; }
        if (forced.has(k)) { this.skip('order:encored_mid_turn'); continue; }
        const unrep = A.unrep || B.unrep;
        if (unrep) { this.skip('order:' + unrep); continue; }
        this.out.order.push({
          turn: this.turn, snap: A.snap,
          first: { side: A.side, idx: A.idx, move: A.move, targetLoc: A.targetLoc, proc: procs.has(A.side + A.idx) },
          second: { side: B.side, idx: B.idx, move: B.move, targetLoc: B.targetLoc, proc: procs.has(B.side + B.idx) },
        });
      }
    }
  }
}

function trackLog(log, opts) { const t = new Tracker(opts); t.feedLog(log); return { sheets: t.sheets, ...t.out }; }

module.exports = { Tracker, trackLog, parseDisp, parseIdent, SIM_VOLATILES, INERT_VOLATILES, BP_OK };
