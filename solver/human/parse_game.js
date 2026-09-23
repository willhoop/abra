/* solver/human/parse_game.js — one raw Showdown replay log -> one clean game record of human
 * decisions: both team sheets, brings, leads, ratings, result, series position, and for every
 * turn the PUBLIC state before the turn plus each side's JOINT action (both slots), the mid-turn
 * switch choices (U-turn, Parting Shot, Eject Button ...) and the end-of-turn faint replacements.
 *
 * Built from the RAW log, never from the parsed store (engine/durable-ingest.js extract() is used
 * by the builder only as an independent cross-check of leads and brings).
 *
 * WHAT A LOG CANNOT TELL YOU, AND HOW IT IS MARKED (never guessed):
 *   - A slot that could not act (flinch, sleep, paralysis, fainted first) chose a move nobody saw:
 *     kind 'hidden' with the reason.  A `|cant|` line that names the move gives the move without a target.
 *   - The log prints the target a move HIT, not the one the player CHOSE. They differ under a
 *     redirect (Follow Me / Rage Powder / Spotlight, Lightning Rod / Storm Drain) and when the chosen
 *     target fainted earlier in the turn (retarget). Those are marked target_certain:false.
 *   - A locked continuation (Outrage-style `[from]lockedmove`, a charge move's second turn, a
 *     recharge turn) is not a choice: kind 'locked'.
 *
 * Any internal contradiction throws a ParseError with a stable code; the builder counts codes.
 */
'use strict';
const X = require('./dex.js');
const { toID } = X;

class ParseError extends Error {
  constructor(code, detail) { super(code + (detail ? ': ' + detail : '')); this.code = code; this.detail = detail; }
}

const POS = ['a', 'b'];
const OTHER = { p1: 'p2', p2: 'p1' };

function parseIdent(s) {
  const m = /^(p[12])([ab]?):\s?(.*)$/.exec(String(s || '').trim());
  return m ? { side: m[1], pos: m[2] || null, nick: m[3] } : null;
}
function parseHP(s) {
  s = String(s || '').trim();
  if (!s) return null;
  const [hpPart, st] = s.split(' ');
  if (hpPart === '0' || st === 'fnt') return { hp: 0, max: 100, status: null, fnt: true };
  const m = /^(\d+)\/(\d+)/.exec(hpPart);
  if (!m) return null;
  return { hp: +m[1], max: +m[2], status: st || null, fnt: false };
}
const detailsSpecies = d => String(d || '').split(',')[0].trim();
const stripEffect = s => String(s || '').replace(/^(move|ability|item):\s*/, '').trim();
const flagsOf = parts => parts.filter(p => p.startsWith('['));
const fromOf = parts => { const f = parts.find(p => p.startsWith('[from]')); return f ? f.slice(6).trim() : null; };

/* showteam: name|species|item|ability|moves|nature|evs|gender|ivs|shiny|level|misc  (packed team) */
function parseShowteam(packed) {
  return packed.split(']').filter(Boolean).map((e, i) => {
    const f = e.split('|');
    const nick = f[0];
    const spName = f[1] || f[0];
    const sp = X.species(spName);
    const it = f[2] ? X.item(f[2]) : null;
    const ab = f[3] ? X.ability(f[3]) : null;
    return {
      i, nick,
      species: sp.exists ? sp.name : spName,
      species_id: sp.exists ? sp.id : toID(spName),
      item: it ? (it.exists ? it.name : f[2]) : null,
      ability: ab ? (ab.exists ? ab.name : f[3]) : null,
      moves: (f[4] || '').split(',').filter(Boolean).map(m => { const mv = X.move(m); return mv.exists ? mv.name : m; }),
      nature: f[5] || null,
      gender: f[7] || null,
      level: f[10] ? +f[10] : null,
    };
  });
}

function parseGame(row) {
  const log = String(row.log || '');
  const L = log.split('\n');

  const g = {
    id: row.id, uploadtime: row.uploadtime || null,
    date: row.uploadtime ? new Date(row.uploadtime * 1000).toISOString() : null,
    format: null, rated: false, rules: [], custom_rules: null,
    series: null, players: { p1: null, p2: null }, sheets: { p1: null, p2: null }, teamsize: { p1: null, p2: null },
    leads: { p1: [], p2: [] }, brought_seen: { p1: [], p2: [] }, bring_complete: null,
    winner: null, tie: false, end: null, turns_played: 0,
  };
  const turns = [];
  const counts = { aux_moves: 0, target_filled_from_anim: 0, midturn_switch_unattributed: 0 };

  // ---- state
  const S = {};
  for (const s of ['p1', 'p2']) S[s] = { mons: [], active: { a: null, b: null }, mega_used: false, conditions: {} };
  const F = { weather: null, terrain: null, pseudo: {} };
  let phase = 'preview';             // preview -> lead -> prelude -> main -> post
  let turnN = 0, cur = null, lastT = null;
  let startPosOf = null;             // side -> monIdx -> pos, for the mons active when the turn opened
  let decided = null;                // side -> pos -> action
  let megaAt = null;                 // side -> pos -> true
  let faintedThisTurn = null;        // side -> [pos...] in order
  let redirectors = null;            // side -> Set(monIdx) that used Follow Me/Rage Powder/Spotlight this turn
  let faintedMons = null, forcedOut = null;   // side -> Set(monIdx), this turn
  let instructed = null;             // side -> Set(monIdx) told to repeat a move by Instruct this turn
  let pendingEject = { p1: new Set(), p2: new Set() };

  /* The log names a mon by its nickname; with no nickname Showdown prints the BASE species
   * ("Indeedee" for a sheet entry named "Indeedee-F"), so both are accepted, exact nickname first. */
  const nickMatch = (m, nick) => m.alias === nick || m.nick === nick || m.species === nick || m.base === nick;
  const monAt = (side, pos) => { const i = S[side].active[pos]; return i == null ? null : S[side].mons[i]; };
  function resolve(ident, detailsHint) {
    const id = parseIdent(ident);
    if (!id) throw new ParseError('bad_ident', ident);
    const side = S[id.side];
    if (!side.mons.length) throw new ParseError('no_sheet', id.side);
    if (id.pos) {
      const m = monAt(id.side, id.pos);
      if (m && nickMatch(m, id.nick)) return { id, m };
    }
    let c = side.mons.filter(m => m.nick === id.nick);
    if (!c.length) c = side.mons.filter(m => nickMatch(m, id.nick));
    const sp = detailsHint ? X.species(detailsSpecies(detailsHint)) : null;
    if (c.length > 1 && sp) c = c.filter(m => m.species_id === sp.id || m.base === sp.baseSpecies);
    /* Open team sheets carry no nicknames, so a nicknamed mon is found by the SPECIES its switch
     * line prints (base species, so a mega or forme still matches) and the nickname is remembered. */
    if (!c.length && sp && sp.exists) {
      c = side.mons.filter(m => !m.alias && (m.species_id === sp.id || m.base === sp.baseSpecies));
      if (c.length === 1) c[0].alias = id.nick;
    }
    if (c.length !== 1) throw new ParseError('unmatched_mon', ident + ' (' + c.length + ' candidates)');
    return { id, m: c[0] };
  }

  function newMon(sheet) {
    return {
      i: sheet.i, nick: sheet.nick, species: sheet.species, species_id: sheet.species_id, sheet,
      base: (X.species(sheet.species).baseSpecies) || sheet.species,
      cur_species: sheet.species, hp: 100, max: 100, status: null, fnt: false, boosts: {}, vol: {},
      item: sheet.item, ability: sheet.ability, used: [], seen: false, mega: false, pos: null,
    };
  }
  function clearOnSwitchOut(m) { m.boosts = {}; m.vol = {}; m.pos = null; if (m.cur_species !== m.species && !m.mega) m.cur_species = m.species; }
  function applyHP(m, s) {
    const h = parseHP(s); if (!h) return;
    m.hp = h.hp; m.max = h.max; if (h.fnt) { m.fnt = true; m.hp = 0; }
    else { m.fnt = false; m.status = h.status || null; }   // hp > 0 un-faints (Revival Blessing)
  }

  function snapshot() {
    const out = { weather: F.weather ? { ...F.weather } : null, terrain: F.terrain ? { ...F.terrain } : null,
                  pseudo: { ...F.pseudo }, sides: {} };
    for (const s of ['p1', 'p2']) {
      const sd = S[s];
      out.sides[s] = {
        mega_used: sd.mega_used,
        conditions: JSON.parse(JSON.stringify(sd.conditions)),
        active: POS.map(p => { const i = sd.active[p]; return i != null && !sd.mons[i].fnt ? i : null; }),
        mons: sd.mons.map(m => !m.seen ? { i: m.i, seen: false } : {
          i: m.i, seen: true, species: m.cur_species, hp: m.hp, max: m.max, status: m.status, fnt: m.fnt,
          item: m.item, ability: m.ability, boosts: { ...m.boosts }, vol: { ...m.vol }, used: m.used.slice(),
          mega: m.mega, pos: m.pos,
        }),
      };
    }
    return out;
  }

  function openTurn(n) {
    turnN = n;
    cur = { n, t_open: lastT, t_resolve: null, state: snapshot(), actions: { p1: { a: null, b: null }, p2: { a: null, b: null } },
            midturn_switches: [], replacements: [], revivals: [], aux_moves: [] };
    startPosOf = { p1: {}, p2: {} }; decided = { p1: {}, p2: {} }; megaAt = { p1: {}, p2: {} };
    faintedThisTurn = { p1: [], p2: [] }; redirectors = { p1: new Set(), p2: new Set() }; instructed = { p1: new Set(), p2: new Set() };
    faintedMons = { p1: new Set(), p2: new Set() }; forcedOut = { p1: new Set(), p2: new Set() };
    for (const s of ['p1', 'p2']) for (const p of POS) { const i = S[s].active[p]; if (i != null && !S[s].mons[i].fnt) startPosOf[s][i] = p; }
    phase = 'prelude';
  }
  function closeTurn(terminal) {
    if (!cur) return;
    for (const s of ['p1', 'p2']) {
      for (const p of POS) {
        const i = cur.state.sides[s].active[POS.indexOf(p)];
        if (i == null) continue;
        let a = decided[s][p];
        if (!a) {
          const m = S[s].mons[i];
          const why = faintedMons[s].has(i) ? 'fainted_before_acting' : forcedOut[s].has(i) ? 'forced_out_before_acting'
                    : terminal ? 'game_ended' : 'not_seen';
          a = { kind: 'hidden', reason: why };
        }
        if (megaAt[s][p]) {
          if (a.kind === 'switch') throw new ParseError('mega_and_switch', s + p + ' turn ' + cur.n);
          a.mega = true;
        }
        a.mon = i;
        cur.actions[s][p] = a;
      }
    }
    if (terminal) cur.terminal = true;
    turns.push(cur); cur = null;
  }

  function decide(side, monIdx, action, where) {
    const p = startPosOf[side][monIdx];
    if (p == null) throw new ParseError('action_by_non_starter', side + ' mon ' + monIdx + ' ' + where + ' turn ' + turnN);
    if (decided[side][p]) throw new ParseError('second_decision', side + p + ' ' + where + ' turn ' + turnN);
    decided[side][p] = action;
    return p;
  }

  function targetFields(actorSide, actorMon, moveName, tIdent, flags) {
    const choosable = X.choosable(moveName);
    if (choosable === null) throw new ParseError('unknown_move', moveName);
    if (!choosable) return { target: null, target_loc: null, target_certain: true };
    const t = tIdent ? parseIdent(tIdent) : null;
    if (!t || !t.pos || flags.includes('[notarget]')) return { target: null, target_loc: null, target_certain: false };
    const loc = (t.side === actorSide ? -1 : 1) * (POS.indexOf(t.pos) + 1);
    let certain = true;
    if (t.side !== actorSide) {
      const tm = monAt(t.side, t.pos);
      if (tm && redirectors[t.side].has(tm.i)) certain = false;
      const ty = X.moveType(moveName), ab = tm ? toID(tm.ability) : '';
      if ((ty === 'Electric' && ab === 'lightningrod') || (ty === 'Water' && ab === 'stormdrain')) certain = false;
      if (faintedThisTurn[t.side].length) certain = false;
    }
    return { target: t.side + t.pos, target_loc: loc, target_certain: certain };
  }

  // ---- main loop
  for (let li = 0; li < L.length; li++) {
    const line = L[li];
    if (!line.startsWith('|')) continue;
    const parts = line.split('|');
    const cmd = parts[1];
    switch (cmd) {
      case 't:': lastT = +parts[2] || lastT; if (cur && cur.t_resolve == null) cur.t_resolve = lastT; break;
      case 'tier': g.format = parts[2]; break;
      case 'rated': g.rated = true; break;
      case 'rule': g.rules.push(parts[2]); break;
      case 'raw': case 'html': {
        const m = /<strong>\s*(\d+)\s+custom rules?:<\/strong>\s*<\/summary>\s*([^<]*)/i.exec(line);
        if (m) g.custom_rules = m[2].trim();
        break;
      }
      case 'uhtml': {
        const m = /Game (\d+)<\/strong> of <a href="\/game-bestof3-([^"]+)"/.exec(line);
        if (m && !g.series) g.series = { id: m[2], game: +m[1] };
        break;
      }
      case 'player': {
        const s = parts[2];
        if ((s === 'p1' || s === 'p2') && parts[3] && !g.players[s]) g.players[s] = { name: parts[3], rating: parts[5] ? +parts[5] || null : null };
        break;
      }
      case 'showteam': {
        const s = parts[2];
        const sheet = parseShowteam(parts.slice(3).join('|'));
        g.sheets[s] = sheet;
        S[s].mons = sheet.map(newMon);
        break;
      }
      case 'teamsize': g.teamsize[parts[2]] = +parts[3]; break;
      case 'start': phase = 'lead'; break;
      case 'turn': {
        const n = +parts[2];
        if (cur) closeTurn(false);
        openTurn(n);
        break;
      }
      case 'upkeep': if (cur) phase = 'post'; break;

      case 'switch': case 'drag': {
        const { id, m } = resolve(parts[2], parts[3]);
        const side = id.side, pos = id.pos;
        const from = fromOf(parts.slice(5));
        const out = monAt(side, pos);
        if (phase === 'preview') throw new ParseError('switch_before_start');
        // classify BEFORE mutating
        let kind;
        if (phase === 'lead') kind = 'lead';
        else if (cmd === 'drag') kind = 'drag';
        else if (from) kind = 'midturn';
        else if (cur && cur.revivals.some(r => r.side === side && r.mon === m.i) && phase !== 'post') kind = 'revived';
        else if (pendingEject[side].has(pos)) kind = 'eject';          // before 'post': Emergency Exit fires at end of turn
        else if (phase === 'post') kind = 'replacement';
        else if (phase === 'prelude' && out && startPosOf[side][out.i] === pos && !decided[side][pos]) kind = 'decision';
        else kind = 'midturn_unattributed';

        if (m.fnt) throw new ParseError('switch_in_fainted', parts[2]);
        if (m.pos && m.pos !== pos) throw new ParseError('switch_in_active', parts[2]);
        if (kind === 'decision') decide(side, out.i, { kind: 'switch', to: m.i, to_species: m.species }, 'switch');
        else if (kind === 'lead') g.leads[side].push(m.i);
        else if (kind === 'replacement') {
          if (!cur) throw new ParseError('replacement_outside_turn');
          if (out && !out.fnt && out.i !== m.i) throw new ParseError('replacement_over_live_mon', parts[2] + ' turn ' + turnN);
          cur.replacements.push({ side, pos, to: m.i, to_species: m.species });
        } else if (cur) {
          if (kind === 'eject') pendingEject[side].delete(pos);
          if (kind === 'midturn_unattributed') counts.midturn_switch_unattributed++;
          cur.midturn_switches.push({ side, pos, to: m.i, to_species: m.species, reason: kind === 'drag' ? 'drag' + (from ? ':' + from : '') : kind === 'eject' ? 'eject' : kind === 'revived' ? 'Revival Blessing' : (from || 'unattributed'), chooser: kind === 'drag' ? OTHER[side] : side });
        }
        if (cur && out && kind !== 'decision' && kind !== 'replacement') forcedOut[side].add(out.i);
        // mutate
        let passed = null;
        if (out) { if (from === 'Baton Pass') passed = { boosts: { ...out.boosts }, vol: { ...out.vol } }; else if (from === 'Shed Tail' && out.vol.Substitute) passed = { boosts: {}, vol: { Substitute: out.vol.Substitute } }; clearOnSwitchOut(out); }
        S[side].active[pos] = m.i; m.pos = pos; m.seen = true;
        m.cur_species = m.mega ? m.cur_species : detailsSpecies(parts[3]) || m.species;
        applyHP(m, parts[4]);
        if (passed) { m.boosts = passed.boosts; m.vol = passed.vol; }
        break;
      }
      case 'replace': throw new ParseError('illusion_replace', parts[2]);
      case 'swap': {
        // |swap|p1a: X|1  -> X moves to position index 1
        const { id, m } = resolve(parts[2]);
        const to = POS[+parts[3]];
        if (!to) break;
        const side = id.side, fromPos = m.pos;
        if (fromPos === to) break;
        const other = S[side].active[to];
        S[side].active[to] = m.i; S[side].active[fromPos] = other;
        m.pos = to; if (other != null) S[side].mons[other].pos = fromPos;
        break;
      }
      case 'detailschange': case '-formechange': {
        const { m } = resolve(parts[2]);
        m.cur_species = detailsSpecies(parts[3]);
        if (cmd === 'detailschange' && /-Mega/.test(m.cur_species)) {
          const sp = X.species(m.cur_species);
          if (sp.exists && sp.abilities && sp.abilities[0]) m.ability = sp.abilities[0];
        }
        break;
      }
      case '-mega': {
        const { id, m } = resolve(parts[2]);
        m.mega = true; S[id.side].mega_used = true;
        if (cur) {
          const p = startPosOf[id.side][m.i];
          if (p == null) throw new ParseError('mega_by_non_starter', parts[2]);
          megaAt[id.side][p] = true;
        }
        break;
      }
      case 'move': {
        const { id, m } = resolve(parts[2]);
        const side = id.side;
        const moveName = parts[3];
        const rest = parts.slice(5);
        const flags = flagsOf(rest);
        const from = fromOf(rest);
        const mv = X.move(moveName);
        if (!cur) throw new ParseError('move_outside_turn', line);
        if (phase === 'post') throw new ParseError('move_after_upkeep', line);
        phase = 'main';
        /* Round's partner is moved up the queue and printed [from] move: Round — it is still that
         * mon's own chosen move, so it is a decision, not an auxiliary call. */
        if (from === 'move: Round' && mv.id === 'round') { /* fall through as a decision */ }
        else if (from && from !== 'lockedmove') { counts.aux_moves++; cur.aux_moves.push({ side, mon: m.i, move: mv.exists ? mv.name : moveName, from }); break; }
        /* Instruct: the target's repeat carries no [from]; it is announced by -singleturn just before. */
        if (instructed[side].has(m.i)) { instructed[side].delete(m.i); counts.aux_moves++; cur.aux_moves.push({ side, mon: m.i, move: mv.exists ? mv.name : moveName, from: 'Instruct' }); break; }
        if (mv.exists && !m.used.includes(mv.name)) m.used.push(mv.name);
        const p0 = startPosOf[side][m.i];
        if (from === 'lockedmove') {
          if (p0 != null && !decided[side][p0]) decide(side, m.i, { kind: 'locked', reason: 'lockedmove', move: mv.exists ? mv.name : moveName }, 'lockedmove');
          break;
        }
        // on-sheet check (a transformed mon, Struggle excepted)
        if (mv.exists && mv.id !== 'struggle' && !m.vol.transform) {
          if (!m.sheet.moves.some(x => toID(x) === mv.id)) throw new ParseError('move_not_on_sheet', m.species + ' used ' + mv.name);
        }
        if (p0 == null) throw new ParseError('action_by_non_starter', side + ' ' + m.species + ' ' + moveName + ' turn ' + turnN);
        if (decided[side][p0]) throw new ParseError('second_decision', side + p0 + ' ' + moveName + ' turn ' + turnN);
        const tf = targetFields(side, m, moveName, parts[4], flags);
        decide(side, m.i, { kind: 'move', move: mv.exists ? mv.name : moveName, ...tf, executed: true,
                            ...(flags.includes('[still]') ? { still: true } : {}) }, 'move');
        break;
      }
      case '-anim': case '-prepare': {
        if (!cur || !parts[4]) break;
        const { id, m } = resolve(parts[2]);
        const p0 = startPosOf[id.side][m.i];
        const a = p0 != null ? decided[id.side][p0] : null;
        if (a && a.kind === 'move' && a.target_loc == null && toID(a.move) === toID(parts[3]) && X.choosable(a.move)) {
          Object.assign(a, targetFields(id.side, m, a.move, parts[4], []));
          counts.target_filled_from_anim++;
        }
        break;
      }
      case 'cant': {
        if (!cur) break;
        const ofTag = parts.slice(4).find(p => p.startsWith('[of]'));
        if (ofTag) {
          /* `|cant|TARGET|ability: Armor Tail|MOVE|[of] USER` — the USER's move was blocked by the
           * target's ability. It is not the target failing to act; it does tell us the user's target. */
          const u = resolve(ofTag.slice(4).trim()).m, uid = parseIdent(ofTag.slice(4).trim());
          const p0 = startPosOf[uid.side][u.i]; const a = p0 != null ? decided[uid.side][p0] : null;
          if (a && a.kind === 'move' && a.target_loc == null && toID(a.move) === toID(parts[4]) && X.choosable(a.move)) {
            Object.assign(a, targetFields(uid.side, u, a.move, parts[2], [])); counts.target_filled_from_anim++;
          }
          break;
        }
        const { id, m } = resolve(parts[2]);
        if (phase === 'prelude') phase = 'main';
        const p0 = startPosOf[id.side][m.i];
        if (p0 == null || decided[id.side][p0]) break;
        const reason = stripEffect(parts[3]);
        if (reason === 'recharge') decide(id.side, m.i, { kind: 'locked', reason: 'recharge' }, 'cant');
        else if (parts[4]) { const mv = X.move(parts[4]); decide(id.side, m.i, { kind: 'move', move: mv.exists ? mv.name : parts[4], target: null, target_loc: null, target_certain: false, executed: false, cant: reason }, 'cant'); }
        else decide(id.side, m.i, { kind: 'hidden', reason: 'cant:' + reason }, 'cant');
        break;
      }
      case '-singleturn': {
        const eff = stripEffect(parts[3]);
        if (cur && eff === 'Instruct') { const { id, m } = resolve(parts[2]); instructed[id.side].add(m.i); }
        if (cur && /^(Follow Me|Rage Powder|Spotlight)$/.test(eff)) {
          const { id, m } = resolve(parts[2]);
          if (eff === 'Spotlight') { /* Spotlight marks its TARGET */ redirectors[id.side].add(m.i); }
          else redirectors[id.side].add(m.i);
        }
        break;
      }
      case 'faint': {
        const { id, m } = resolve(parts[2]);
        m.fnt = true; m.hp = 0; m.status = null;
        if (cur) { faintedThisTurn[id.side].push(id.pos); faintedMons[id.side].add(m.i); }
        break;
      }
      case '-damage': case '-heal': {
        const { id, m } = resolve(parts[2]);
        const wasFnt = m.fnt; applyHP(m, parts[3]);
        if (cur && fromOf(parts.slice(4)) === 'confusion') {
          /* A confused mon that hits itself prints no |move| and no |cant|: its choice is unseen. */
          const p0 = startPosOf[id.side][m.i];
          if (p0 != null && !decided[id.side][p0]) decide(id.side, m.i, { kind: 'hidden', reason: 'confusion_self_hit' }, 'confusion');
        }
        if (wasFnt && !m.fnt && cur) cur.revivals.push({ side: id.side, mon: m.i, species: m.species, from: fromOf(parts.slice(4)) });
        break;
      }
      case '-sethp': {
        for (let k = 2; k + 1 < parts.length && !parts[k].startsWith('['); k += 2) { const { m } = resolve(parts[k]); applyHP(m, parts[k + 1]); }
        break;
      }
      case '-status': { const { m } = resolve(parts[2]); m.status = parts[3]; break; }
      case '-curestatus': { const { m } = resolve(parts[2]); m.status = null; break; }
      case '-cureteam': { const id = parseIdent(parts[2]); if (id) for (const mm of S[id.side].mons) mm.status = null; break; }
      case '-boost': case '-unboost': {
        const { m } = resolve(parts[2]); const n = (+parts[4] || 0) * (cmd === '-boost' ? 1 : -1);
        const v = Math.max(-6, Math.min(6, (m.boosts[parts[3]] || 0) + n)); if (v) m.boosts[parts[3]] = v; else delete m.boosts[parts[3]];
        break;
      }
      case '-setboost': { const { m } = resolve(parts[2]); const v = +parts[4]; if (v) m.boosts[parts[3]] = v; else delete m.boosts[parts[3]]; break; }
      case '-clearboost': { const { m } = resolve(parts[2]); m.boosts = {}; break; }
      case '-clearallboost': { for (const s of ['p1', 'p2']) for (const p of POS) { const mm = monAt(s, p); if (mm) mm.boosts = {}; } break; }
      case '-clearnegativeboost': { const { m } = resolve(parts[2]); for (const k of Object.keys(m.boosts)) if (m.boosts[k] < 0) delete m.boosts[k]; break; }
      case '-clearpositiveboost': { const { m } = resolve(parts[2]); for (const k of Object.keys(m.boosts)) if (m.boosts[k] > 0) delete m.boosts[k]; break; }
      case '-invertboost': { const { m } = resolve(parts[2]); for (const k of Object.keys(m.boosts)) m.boosts[k] = -m.boosts[k]; break; }
      case '-copyboost': { const a = resolve(parts[2]).m, b = resolve(parts[3]).m; a.boosts = { ...b.boosts }; break; }
      case '-swapboost': {
        const a = resolve(parts[2]).m, b = resolve(parts[3]).m;
        const stats = parts[4] && !parts[4].startsWith('[') ? parts[4].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
        for (const st of stats) { const x = a.boosts[st], y = b.boosts[st]; if (y) a.boosts[st] = y; else delete a.boosts[st]; if (x) b.boosts[st] = x; else delete b.boosts[st]; }
        break;
      }
      case '-transform': { const a = resolve(parts[2]).m, b = resolve(parts[3]).m; a.vol.transform = b.cur_species; a.boosts = { ...b.boosts }; break; }
      case '-start': {
        const { m } = resolve(parts[2]); let eff = stripEffect(parts[3]);
        const val = parts[4] && !parts[4].startsWith('[') ? parts[4] : true;
        const pm = /^perish(\d)$/.exec(eff); if (pm) { m.vol.perish = +pm[1]; break; }
        m.vol[eff] = val === true ? turnN : val;
        break;
      }
      case '-end': {
        const { m } = resolve(parts[2]); const eff = stripEffect(parts[3]);
        if (/^perish/.test(eff)) delete m.vol.perish; else delete m.vol[eff];
        break;
      }
      case '-item': { const { m } = resolve(parts[2]); m.item = parts[3]; break; }
      case '-enditem': {
        const { id, m } = resolve(parts[2]); const it = parts[3];
        m.item = null;
        if (/^(Eject Button|Eject Pack)$/.test(it) && cur && id.pos && !fromOf(parts.slice(4))) pendingEject[id.side].add(id.pos);
        break;
      }
      case '-activate': {
        const eff = stripEffect(parts[3]);
        if (cur && /^(Emergency Exit|Wimp Out)$/.test(eff)) { const id = parseIdent(parts[2]); if (id && id.pos) pendingEject[id.side].add(id.pos); }
        break;
      }
      case '-ability': {
        const { m } = resolve(parts[2]); if (parts[3]) m.ability = parts[3]; break;
      }
      case '-weather': {
        const w = parts[2];
        if (!w || w === 'none') F.weather = null;
        else if (!parts.includes('[upkeep]')) F.weather = { name: w, since: turnN };
        break;
      }
      case '-fieldstart': {
        const eff = stripEffect(parts[2]);
        if (/Terrain$/.test(eff)) F.terrain = { name: eff, since: turnN }; else F.pseudo[eff] = turnN;
        break;
      }
      case '-fieldend': {
        const eff = stripEffect(parts[2]);
        if (/Terrain$/.test(eff)) { if (F.terrain && F.terrain.name === eff) F.terrain = null; } else delete F.pseudo[eff];
        break;
      }
      case '-sidestart': {
        const id = parseIdent(parts[2]); const eff = stripEffect(parts[3]); if (!id) break;
        const c = S[id.side].conditions[eff];
        S[id.side].conditions[eff] = { since: c ? c.since : turnN, layers: (c ? c.layers : 0) + 1 };
        break;
      }
      case '-sideend': { const id = parseIdent(parts[2]); if (id) delete S[id.side].conditions[stripEffect(parts[3])]; break; }
      case '-swapsideconditions': { const t = S.p1.conditions; S.p1.conditions = S.p2.conditions; S.p2.conditions = t; break; }
      case 'win': {
        const n = toID(parts[2]);
        g.winner = g.players.p1 && toID(g.players.p1.name) === n ? 'p1' : g.players.p2 && toID(g.players.p2.name) === n ? 'p2' : null;
        if (!g.winner) throw new ParseError('winner_not_a_player', parts[2]);
        break;
      }
      case 'tie': g.tie = true; break;
      case '-message': {
        const msg = parts[2] || '';
        if (/ forfeited\.$/.test(msg)) g.end = 'forfeit';
        else if (/lost due to inactivity\.$/.test(msg)) g.end = 'inactivity';
        break;
      }
      default: break;
    }
  }
  if (cur) closeTurn(true);

  if (!g.sheets.p1 || !g.sheets.p2) throw new ParseError('no_open_sheet');
  if (!g.end) g.end = g.winner || g.tie ? 'normal' : null;
  for (const s of ['p1', 'p2']) g.brought_seen[s] = S[s].mons.filter(m => m.seen).map(m => m.i);
  g.bring_complete = { p1: g.brought_seen.p1.length === g.teamsize.p1, p2: g.brought_seen.p2.length === g.teamsize.p2 };
  g.turns_played = turns.length;
  return { game: g, turns, counts };
}

module.exports = { parseGame, parseShowteam, parseIdent, parseHP, ParseError };
