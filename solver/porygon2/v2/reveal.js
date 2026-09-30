/* solver/porygon2/v2/reveal.js — PORYGON2 v2's position extractor: one raw Showdown replay log -> the PUBLIC state at the
 * start of every turn, with a per-field REVEAL state, plus the game's labels. Store-only: no simulator is read.
 *
 *   const R = require('./solver/porygon2/v2/reveal.js');
 *   const g = R.extract(rawLog, { mode: 'bo1' | 'bo3' })      -> { positions:[{ n, x }], game, counts }
 *   R.labels(g)                                               -> per-position labels (outcome and auxiliary targets)
 *   R.firstPerson(x, 'p1' | 'p2')                             -> the same position as { me, opp } for one chair
 *
 * WHAT A POSITION IS. `x` is the state a SPECTATOR sees at the `|turn|n` line: both previews (six species a side), which
 * members have taken the field, every seen member's displayed HP %, status, stat stages, volatiles, forme, mega, the
 * field and both sides' conditions. That is the same information a replay gives us about BOTH players, so the first-
 * person view of either player is the same record with the chairs named `me` and `opp` (firstPerson). What the player
 * knew about their OWN set and never revealed is not in a replay, so it is UNKNOWN here too; PORYGON2 v2 is a value over
 * the PUBLIC state, and at play time it is fed the public state, never the private one (design §3).
 *
 * THE REVEAL STATE, per member (never filled from a prior; Will, 2026-09-29):
 *   moves       up to 4 names, each one seen used by THIS member (its own `|move|` line, a locked continuation, a Round
 *               partner's call, a Sleep Talk call of its own move, a `|cant|` that names the move, a Forewarn reveal);
 *               the rest of the 4 are UNK. bo3: the four sheet moves, known from turn 0 — and the same in a bo1 room
 *               whose log shows both `|showteam|` sheets before the battle (then they were public to both players).
 *   item        { orig, now }. orig = the item it brought, known once a line names it while it is still the original
 *               (an item effect, an `-enditem`, a Frisk, a mega stone at `-mega`); now = what it holds NOW, NONE after
 *               an `-enditem`, a name after `-item`. A Trick / Thief / Pickpocket changes `now` without revealing orig.
 *   ability     { base, now }. base = its own ability, known once a line attributes it to THIS member (checked against
 *               the member's species in the Reg M-C dex; an attribution the species cannot hold is refused and
 *               counted), or DEDUCED when the species has exactly one ability in the regulation (`ability_src: 'dex'`
 *               — a deduction from the format, not a prior). now = the current ability (a mega forme's single ability
 *               from the dex at `detailschange`; Trace, Entrainment, Role Play, Worry Seed, Simple Beam).
 *   brought     true once it has taken the field; UNK before (never false: a member never seen is not known unbrought).
 *   nature      bo3: the sheet's; bo1: UNK. Spreads (Stat Points) are UNK in both: no replay shows them.
 *
 * UNK is the string '<UNK>' (UNK below). NONE is null. They are different: an item knocked off is NONE; an item never
 * seen is UNK.
 *
 * NEVER A LEAK. The state is built by ONE forward pass and a position is a deep copy taken AT the `|turn|n` line, before
 * any later line is read. solver/tests/test-porygon2-v2-extract.js re-runs the extractor on the log CUT at each `|turn|n`
 * line and asserts the position is byte-identical, so nothing after turn n can be in it.
 *
 * LABELS ARE NOT INPUTS. `labels()` reads the finished game (the result, the final board, the next faint) and returns
 * them beside the positions, never inside `x`.
 *
 * DELIBERATE BREAKS (env PORY2V2_BREAK), each must turn the extract test RED:
 *   leak   every member's end-of-game reveals are seeded before turn 1 (a two-pass extractor that looks ahead);
 *   late   the snapshot is taken at the END of turn n (the next `|turn|` line), so turn n's own events are inside it.
 */
'use strict';
const X = require('../../human/dex.js');
const { toID } = X;

const UNK = '<UNK>';
const POS = ['a', 'b'];
const SIDES = ['p1', 'p2'];
const BREAK = (typeof process !== 'undefined' && process.env && process.env.PORY2V2_BREAK) || '';

class ParseError extends Error {
  constructor(code, detail) { super(code + (detail ? ': ' + detail : '')); this.code = code; this.detail = detail; }
}

function parseIdent(s) {
  const m = /^(p[12])([ab]?):\s?(.*)$/.exec(String(s || '').trim());
  return m ? { side: m[1], pos: m[2] || null, nick: m[3] } : null;
}
function parseHP(s) {
  s = String(s || '').trim();
  if (!s) return null;
  const [hpPart, st] = s.split(' ');
  if (hpPart === '0' || st === 'fnt') return { hp: 0, fnt: true, status: null };
  const m = /^(\d+)\/(\d+)/.exec(hpPart);
  if (!m) return null;
  return { hp: Math.round(100 * +m[1] / +m[2]), fnt: false, status: st || null };
}
const detailsSpecies = d => String(d || '').split(',')[0].trim();
const stripEffect = s => String(s || '').replace(/^(move|ability|item):\s*/, '').trim();
const tagOf = (parts, tag) => { const f = parts.find(p => p.startsWith(tag)); return f ? f.slice(tag.length).trim() : null; };

/* dex reads, cached; every fact about a species / move / item is read from the Reg M-C format (solver/human/dex.js) */
const _sp = new Map();
function spInfo(name) {
  const k = String(name || '');
  if (_sp.has(k)) return _sp.get(k);
  const s = X.species(k);
  const r = s && s.exists
    ? { exists: true, name: s.name, base: s.baseSpecies, num: s.num, abilities: [...new Set(Object.values(s.abilities || {}))] }
    : { exists: false, name: k, base: k, num: null, abilities: [] };
  _sp.set(k, r);
  return r;
}
const moveName = m => { const x = X.move(m); return x && x.exists ? x.name : m; };
const itemName = m => { const x = X.item(m); return x && x.exists ? x.name : m; };
const abilName = m => { const x = X.ability(m); return x && x.exists ? x.name : m; };

/* bo3 sheet: name|species|item|ability|moves|nature|evs|gender|ivs|shiny|level|misc */
function parseShowteam(packed) {
  return packed.split(']').filter(Boolean).map(e => {
    const f = e.split('|');
    const sp = spInfo(f[1] || f[0]);
    return { species: sp.name, item: f[2] ? itemName(f[2]) : null, ability: f[3] ? abilName(f[3]) : null,
      moves: (f[4] || '').split(',').filter(Boolean).map(moveName), nature: f[5] || null };
  });
}

function newMon(i, species) {
  const sp = spInfo(species);
  const oneAbility = sp.abilities.length === 1 ? sp.abilities[0] : null;
  return {
    i, species: sp.name, base: sp.base, num: sp.num, nick: null,
    brought: UNK, form: null, hp: 100, status: null, fnt: false, boosts: {}, vol: {}, mega: false, pos: null,
    moves: [], item: { orig: UNK, now: UNK, changed: false },
    ability: { base: oneAbility || UNK, now: oneAbility || UNK, changed: false, src: oneAbility ? 'dex' : null },
    nature: UNK,
  };
}

function extract(rawLog, opts) {
  opts = opts || {};
  const mode = opts.mode || 'bo1';
  const L = String(rawLog || '').split('\n');
  const game = { players: { p1: null, p2: null }, teamsize: { p1: null, p2: null }, winner: null, tie: false, end: null,
    turns: 0, faints: [], final: null, custom_rules: null, format: null, preview_items: { p1: [], p2: [] }, sheets_public: false };
  const counts = { lines: 0, ability_refused: 0, ability_unattributed: 0, item_reveals: 0, ability_reveals: 0, move_reveals: 0,
    skill_swap: 0, moves_overflow: 0, dex_deduced_ability: 0 };
  const S = {}; for (const s of SIDES) S[s] = { mons: [], active: { a: null, b: null }, mega_used: false, conditions: {} };
  const F = { weather: null, terrain: null, pseudo: {} };
  const sheets = { p1: null, p2: null };
  const positions = [];
  let turnN = 0, started = false, pendingSnap = null;

  const monAt = (side, pos) => { const i = S[side].active[pos]; return i == null ? null : S[side].mons[i]; };
  function bySpecies(side, name) {
    const sp = spInfo(name);
    const c = S[side].mons.filter(m => m.species === sp.name || m.base === sp.base || (sp.num != null && m.num === sp.num));
    return c.length === 1 ? c[0] : null;
  }
  function resolve(ident, detailsHint) {
    const id = parseIdent(ident);
    if (!id) throw new ParseError('bad_ident', ident);
    const side = S[id.side];
    if (!side.mons.length) throw new ParseError('no_preview', id.side);
    if (id.pos) { const m = monAt(id.side, id.pos); if (m && m.nick === id.nick) return { id, m }; }
    let c = side.mons.filter(m => m.nick === id.nick);
    if (c.length === 1) return { id, m: c[0] };
    if (detailsHint) {
      const m = bySpecies(id.side, detailsSpecies(detailsHint));
      if (m && (m.nick == null || m.nick === id.nick)) { m.nick = id.nick; return { id, m }; }
    }
    const m = bySpecies(id.side, id.nick);            // an un-nicknamed member is printed by its species
    if (m && (m.nick == null || m.nick === id.nick)) { m.nick = id.nick; return { id, m }; }
    throw new ParseError('unmatched_mon', ident);
  }
  const resolveSoft = ident => { try { return resolve(ident).m; } catch (e) { return null; } };

  /* ------------------------------------------------------------------ reveals (the only writers of the reveal state) */
  function revealMove(m, name) {
    if (!m || m.vol.transform) return;
    const mv = X.move(name);
    if (!mv || !mv.exists || mv.id === 'struggle') return;
    if (m.moves.includes(mv.name)) return;
    if (m.sheetMoves) { if (!m.sheetMoves.includes(mv.name)) throw new ParseError('move_not_on_sheet', m.species + ' ' + mv.name); return; }
    if (m.moves.length >= 4) { counts.moves_overflow++; throw new ParseError('moves_overflow', m.species + ' ' + mv.name); }
    m.moves.push(mv.name); counts.move_reveals++;
  }
  function revealHeld(m, name) {               // a line shows m holding `name` right now
    if (!m) return;
    const it = itemName(name);
    if (!m.item.changed && m.item.orig === UNK) m.item.orig = it;
    if (m.item.now !== it) counts.item_reveals++;
    m.item.now = it;
  }
  function itemGone(m, name) {                 // m held `name` and no longer holds anything
    if (!m) return;
    if (!m.item.changed && m.item.orig === UNK) { m.item.orig = itemName(name); counts.item_reveals++; }
    m.item.now = null;
  }
  const canBase = (m, a) => spInfo(m.species).abilities.includes(a);
  const canNow = (m, a) => spInfo(m.form || m.species).abilities.includes(a);
  function abilityOK(m, a) { return !!m && (canBase(m, a) || canNow(m, a) || m.ability.changed || m.vol.transform); }
  function revealAbility(m, name) {
    if (!m) return false;
    const a = abilName(name);
    if (canBase(m, a) && !m.mega && !m.ability.changed) {
      if (m.ability.base === UNK) { m.ability.base = a; m.ability.src = 'log'; counts.ability_reveals++; }
      if (!m.vol.transform) m.ability.now = a;
      return true;
    }
    if (m.vol.transform) return true;              // a transformed body's ability is the copy's, not its own
    if (m.ability.changed) { m.ability.now = a; return true; }
    if (canNow(m, a)) { m.ability.now = a; return true; }
    counts.ability_refused++;
    return false;
  }
  /* `[from] ability: A` on a line naming X, maybe `[of] Y`: whichever of X, Y can hold A. Both can: -damage / -weather /
   * -fieldstart / -item / -clearboost name the holder in [of]; every other line names it first. Neither: refused. */
  function attributeAbility(cmd, X_, Y_, a) {
    const c = [X_, Y_].filter(Boolean).filter((m, k, arr) => arr.indexOf(m) === k).filter(m => abilityOK(m, a));
    if (!c.length) { counts.ability_unattributed++; return; }
    let m = c[0];
    if (c.length === 2) m = /^-(damage|weather|fieldstart|item|clearboost|status)$/.test(cmd) ? Y_ : X_;
    revealAbility(m, a);
  }

  function snapshot() {
    const out = { n: turnN,
      field: { weather: F.weather ? { ...F.weather } : null, terrain: F.terrain ? { ...F.terrain } : null, pseudo: { ...F.pseudo } },
      sides: {} };
    for (const s of SIDES) {
      const sd = S[s];
      out.sides[s] = {
        teamsize: game.teamsize[s], mega_used: sd.mega_used, conditions: JSON.parse(JSON.stringify(sd.conditions)),
        active: POS.map(p => { const i = sd.active[p]; return i != null && !sd.mons[i].fnt ? i : null; }),
        mons: sd.mons.map(m => ({
          i: m.i, species: m.species, brought: m.brought, form: m.brought === true ? (m.form || m.species) : null,
          hp: m.brought === true ? m.hp : UNK, status: m.brought === true ? m.status : UNK, fnt: m.fnt,
          boosts: { ...m.boosts }, vol: { ...m.vol }, mega: m.mega, pos: m.pos,
          moves: [...m.moves, ...Array(Math.max(0, 4 - m.moves.length)).fill(UNK)],
          item: { orig: m.item.orig, now: m.item.now }, ability: { base: m.ability.base, now: m.ability.now },
          ability_src: m.ability.src, nature: m.nature,
        })),
      };
    }
    return out;
  }
  function emit() { positions.push({ n: turnN, x: snapshot() }); }

  function applySheets() {
    for (const s of SIDES) {
      if (!sheets[s]) continue;
      if (!S[s].mons.length) S[s].mons = sheets[s].map((r, i) => newMon(i, r.species));
      for (const r of sheets[s]) {
        const m = bySpecies(s, r.species);
        if (!m) throw new ParseError('sheet_preview_mismatch', s + ' ' + r.species);
        m.sheetMoves = r.moves.slice();
        m.moves = r.moves.slice(0, 4);
        m.item = { orig: r.item || null, now: r.item || null, changed: false };
        m.ability = { base: r.ability || UNK, now: r.ability || UNK, changed: false, src: 'sheet' };
        m.nature = r.nature || UNK;
      }
    }
  }

  /* leak break: a look-ahead pre-pass seeds every end-of-game move and item reveal before turn 1 */
  let leakSeed = null;
  if (BREAK === 'leak' && !opts._noLeak) {
    const full = extract(rawLog, Object.assign({}, opts, { _noLeak: true }));
    leakSeed = full.final_state;
  }

  for (let li = 0; li < L.length; li++) {
    const line = L[li];
    if (!line.startsWith('|')) continue;
    counts.lines++;
    const parts = line.split('|');
    const cmd = parts[1];
    const rest = parts.slice(2);
    const fromTag = tagOf(rest, '[from]');
    const ofTag = tagOf(rest, '[of]');
    // generic effect attributions carried on any line
    const identM = () => (parts[2] && parseIdent(parts[2]) ? resolveSoft(parts[2]) : null);
    const ofM = () => (ofTag ? resolveSoft(ofTag) : null);

    switch (cmd) {
      case 'tier': game.format = parts[2]; break;
      case 'player': { const s = parts[2]; if ((s === 'p1' || s === 'p2') && parts[3] && !game.players[s]) game.players[s] = { name: parts[3], rating: parts[5] ? +parts[5] || null : null }; break; }
      case 'raw': case 'html': { const m = /<strong>\s*(\d+)\s+custom rules?:<\/strong>\s*<\/summary>\s*([^<]*)/i.exec(line); if (m) game.custom_rules = m[2].trim(); break; }
      case 'poke': {
        const s = parts[2]; if (!S[s]) break;
        S[s].mons.push(newMon(S[s].mons.length, detailsSpecies(parts[3])));
        game.preview_items[s].push(parts[4] ? 1 : 0);
        break;
      }
      case 'showteam': sheets[parts[2]] = parseShowteam(parts.slice(3).join('|')); break;
      case 'teamsize': game.teamsize[parts[2]] = +parts[3]; break;
      case 'start': {
        started = true;
        /* A sheet shown before the battle is PUBLIC from turn 1 in either stream: a few closed-sheet (bo1) rooms carry
         * `|showteam|` too, and their sets are then known to both players, so they are known here. */
        if (mode === 'bo3' && (!sheets.p1 || !sheets.p2)) throw new ParseError('no_open_sheet');
        if (sheets.p1 && sheets.p2) { applySheets(); game.sheets_public = true; }
        for (const s of SIDES) { if (S[s].mons.length !== 6) throw new ParseError('preview_not_six', s + ' ' + S[s].mons.length); for (const m of S[s].mons) if (m.ability.src === 'dex') counts.dex_deduced_ability++; }
        if (leakSeed) for (const s of SIDES) for (const m of S[s].mons) {
          const f = leakSeed[s][m.i]; m.moves = f.moves.filter(x => x !== UNK); m.item.orig = f.item.orig; m.ability.base = f.ability.base;
        }
        break;
      }
      case 'turn': {
        if (BREAK === 'late') { if (pendingSnap != null) { const keep = turnN; turnN = pendingSnap; emit(); turnN = keep; } }
        turnN = +parts[2];
        if (BREAK === 'late') pendingSnap = turnN; else emit();
        break;
      }
      case 'switch': case 'drag': {
        const { id, m } = resolve(parts[2], parts[3]);
        const side = id.side, pos = id.pos;
        const out = monAt(side, pos);
        if (out && out !== m) { out.boosts = {}; out.vol = {}; out.pos = null; if (!out.mega) out.form = null; if (out.ability.changed) { out.ability.changed = false; out.ability.now = out.ability.base; } }
        S[side].active[pos] = m.i; m.pos = pos; m.brought = true;
        if (!m.mega) m.form = detailsSpecies(parts[3]) || m.species;
        const h = parseHP(parts[4]); if (h) { m.hp = h.hp; m.fnt = h.fnt; m.status = h.status; }
        break;
      }
      case 'replace': throw new ParseError('illusion_replace', parts[2]);
      case 'swap': {
        const { id, m } = resolve(parts[2]); const to = POS[+parts[3]]; if (!to || m.pos === to) break;
        const other = S[id.side].active[to]; const fromPos = m.pos;
        S[id.side].active[to] = m.i; S[id.side].active[fromPos] = other; m.pos = to; if (other != null) S[id.side].mons[other].pos = fromPos;
        break;
      }
      case 'detailschange': case '-formechange': {
        const { m } = resolve(parts[2]);
        m.form = detailsSpecies(parts[3]);
        if (cmd === 'detailschange' && /-Mega/.test(m.form)) {
          const sp = spInfo(m.form);
          if (sp.abilities.length === 1) m.ability.now = sp.abilities[0];
          else m.ability.now = UNK;
        }
        break;
      }
      case '-mega': {
        const { id, m } = resolve(parts[2]);
        m.mega = true; S[id.side].mega_used = true;
        if (parts[4]) revealHeld(m, parts[4]);
        break;
      }
      case 'move': {
        const { m } = resolve(parts[2]);
        const own = !fromTag || fromTag === 'lockedmove' || fromTag === 'move: Round' || fromTag === 'move: Sleep Talk';
        if (own) revealMove(m, parts[3]);
        if (fromTag && /^ability:/.test(fromTag)) attributeAbility(cmd, m, null, stripEffect(fromTag));
        break;
      }
      case 'cant': {
        /* `|cant|X|REASON|MOVE` names X's chosen move. `|cant|TARGET|ability: A|MOVE|[of] USER`: the USER's move was
         * refused by the TARGET's ability (Armor Tail, Queenly Majesty ...), so the move is the USER's, the ability the
         * TARGET's (solver/human/parse_game.js reads it the same way). */
        const { m } = resolve(parts[2]);
        const mover = ofTag ? ofM() : m;
        if (parts[4] && !parts[4].startsWith('[')) revealMove(mover, parts[4]);
        const why = parts[3] || '';
        if (/^ability:/.test(why)) attributeAbility(cmd, m, null, stripEffect(why));
        break;
      }
      case 'faint': {
        const { id, m } = resolve(parts[2]);
        m.fnt = true; m.hp = 0; m.status = null;
        game.faints.push({ side: id.side, i: m.i, turn: turnN });
        break;
      }
      case '-damage': case '-heal': {
        const { m } = resolve(parts[2]);
        const h = parseHP(parts[3]); if (h) { m.hp = h.hp; m.fnt = h.fnt; if (!h.fnt) m.status = h.status; }
        break;
      }
      case '-sethp': {
        for (let k = 2; k + 1 < parts.length && !parts[k].startsWith('['); k += 2) {
          const { m } = resolve(parts[k]); const h = parseHP(parts[k + 1]); if (h) { m.hp = h.hp; m.fnt = h.fnt; }
        }
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
      case '-clearallboost': { for (const s of SIDES) for (const p of POS) { const mm = monAt(s, p); if (mm) mm.boosts = {}; } break; }
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
      case '-transform': { const a = resolve(parts[2]).m, b = resolve(parts[3]).m; a.vol.transform = b.form || b.species; a.boosts = { ...b.boosts }; break; }
      case '-start': {
        const { m } = resolve(parts[2]); const eff = stripEffect(parts[3]);
        const pm = /^perish(\d)$/.exec(eff);
        if (pm) m.vol.perish = +pm[1];
        else m.vol[eff] = parts[4] && !parts[4].startsWith('[') ? parts[4] : turnN;
        break;
      }
      case '-end': { const { m } = resolve(parts[2]); const eff = stripEffect(parts[3]); if (/^perish/.test(eff)) delete m.vol.perish; else delete m.vol[eff]; break; }
      case '-item': {
        const { m } = resolve(parts[2]);
        const f = fromTag || '';
        if (/^move: (Trick|Switcheroo|Thief|Covet|Bestow)$/.test(f) || /^ability: (Pickpocket|Magician)$/.test(f)) { m.item.changed = true; m.item.now = itemName(parts[3]); counts.item_reveals++; }
        else revealHeld(m, parts[3]);
        break;
      }
      case '-enditem': { const { m } = resolve(parts[2]); itemGone(m, parts[3]); break; }
      case '-ability': {
        const { m } = resolve(parts[2]);
        const a = abilName(parts[3]);
        const prev = parts[4] && !parts[4].startsWith('[') ? abilName(parts[4]) : null;
        const f = fromTag || '';
        if (f) {
          // X's ability was CHANGED to a (Trace, Entrainment, Role Play, Worry Seed, Simple Beam, Doodle...)
          if (prev && canBase(m, prev) && m.ability.base === UNK && !m.ability.changed && !m.mega) { m.ability.base = prev; counts.ability_reveals++; }
          if (f === 'ability: Trace' && m.ability.base === UNK && canBase(m, 'Trace')) { m.ability.base = 'Trace'; counts.ability_reveals++; }
          m.ability.changed = true; m.ability.now = a;
          if (/^(ability: Trace|move: (Entrainment|Role Play|Doodle))$/.test(f)) { const y = ofM(); if (y && y !== m) revealAbility(y, a); }
        } else revealAbility(m, a);
        break;
      }
      case '-activate': {
        const eff = parts[3] || '';
        const m = identM();
        if (/^item:/.test(eff)) revealHeld(m, stripEffect(eff));
        else if (/^ability:/.test(eff)) {
          const a = stripEffect(eff);
          attributeAbility(cmd, m, null, a);
          if (a === 'Forewarn' && parts[4] && ofTag) revealMove(ofM(), parts[4]);
        } else if (/Skill Swap/.test(eff)) {
          counts.skill_swap++;
          for (const mm of [m, ofM()]) if (mm) { mm.ability.changed = true; mm.ability.now = UNK; }
        }
        break;
      }
      case '-weather': {
        const w = parts[2];
        if (!w || w === 'none') F.weather = null; else if (!parts.includes('[upkeep]')) F.weather = { name: w, since: turnN };
        break;
      }
      case '-fieldstart': { const eff = stripEffect(parts[2]); if (/Terrain$/.test(eff)) F.terrain = { name: eff, since: turnN }; else F.pseudo[eff] = turnN; break; }
      case '-fieldend': { const eff = stripEffect(parts[2]); if (/Terrain$/.test(eff)) { if (F.terrain && F.terrain.name === eff) F.terrain = null; } else delete F.pseudo[eff]; break; }
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
        game.winner = game.players.p1 && toID(game.players.p1.name) === n ? 'p1' : game.players.p2 && toID(game.players.p2.name) === n ? 'p2' : null;
        if (!game.winner) throw new ParseError('winner_not_a_player', parts[2]);
        break;
      }
      case 'tie': game.tie = true; break;
      case '-message': {
        const msg = parts[2] || '';
        if (/ forfeited\.$/.test(msg)) game.end = 'forfeit'; else if (/lost due to inactivity\.$/.test(msg)) game.end = 'inactivity';
        break;
      }
      default: break;
    }
    /* item and ability effects named on any other line: `[from] item: I` / `[from] ability: A` */
    if (started && fromTag && cmd !== '-item' && cmd !== '-enditem' && cmd !== '-ability' && cmd !== 'move' && cmd !== 'cant') {
      if (/^item:/.test(fromTag)) {
        const holder = (cmd === '-damage' && ofTag) ? ofM() : identM();
        revealHeld(holder, stripEffect(fromTag));
      } else if (/^ability:/.test(fromTag)) {
        attributeAbility(cmd, identM(), ofM(), stripEffect(fromTag));
      }
    }
    if (started && cmd === '-item' && fromTag && /^ability:/.test(fromTag)) {
      const a = stripEffect(fromTag);
      if (a !== 'Pickpocket' && a !== 'Magician') attributeAbility(cmd, identM(), ofM(), a);
      else attributeAbility(cmd, identM(), null, a);
    }
    if (started && cmd === '-enditem' && fromTag && /^ability:/.test(fromTag)) attributeAbility(cmd, identM(), ofM(), stripEffect(fromTag));
  }
  if (BREAK === 'late' && pendingSnap != null) { const keep = turnN; turnN = pendingSnap; emit(); turnN = keep; }

  if (!game.end) game.end = game.winner || game.tie ? 'normal' : null;
  game.turns = turnN;
  game.final = {};
  for (const s of SIDES) game.final[s] = S[s].mons.map(m => ({ i: m.i, brought: m.brought, fnt: m.fnt, hp: m.brought === true ? m.hp : null }));
  const fin = snapshot();
  return { positions, game, counts, final_state: { p1: fin.sides.p1.mons, p2: fin.sides.p2.mons } };
}

/* ---------------------------------------------------------------------------------------------------------- labels
 * Read AFTER the game, returned beside the positions (never inside x). All in the p1 frame; firstPerson flips them.
 *   z            1 p1 won, 0 p1 lost, 0.5 tie, null no result
 *   turns_left   the last turn number minus n
 *   final        per side: alive (brought and not fainted at the end; a brought member never seen counts alive), the
 *                HP fraction of the brought four still standing (an unseen brought member counts 100), and per member
 *                { alive, hp } (null for a member never seen) — the KataGo "ownership" analogue, one per token
 *   next_ko      the first faint after the snapshot: { side: 'p1' | 'p2' | 'both' (same turn), dt: turns until it } or
 *                null if nobody faints again (a forfeit, or the game ends on a timer)
 * A forfeited game's `final` is the board when the player quit; the flag `end` says so. */
function labels(g) {
  const G = g.game;
  const z = G.tie ? 0.5 : G.winner === 'p1' ? 1 : G.winner === 'p2' ? 0 : null;
  const final = {};
  for (const s of SIDES) {
    const ts = G.teamsize[s] || 4;
    const seen = G.final[s].filter(m => m.brought === true);
    const unseenBrought = Math.max(0, ts - seen.length);
    const alive = seen.filter(m => !m.fnt).length + unseenBrought;
    const hp = (seen.reduce((a, m) => a + (m.fnt ? 0 : m.hp), 0) + 100 * unseenBrought) / (100 * ts);
    final[s] = { alive, hp: Math.round(hp * 1e4) / 1e4, mons: G.final[s].map(m => m.brought === true ? { alive: m.fnt ? 0 : 1, hp: m.fnt ? 0 : m.hp } : null) };
  }
  const per = g.positions.map(p => {
    const after = G.faints.filter(f => f.turn >= p.n);
    let next = null;
    if (after.length) {
      const t = after[0].turn, sides = new Set(after.filter(f => f.turn === t).map(f => f.side));
      next = { side: sides.size === 2 ? 'both' : [...sides][0], dt: t - p.n };
    }
    return { n: p.n, turns_left: G.turns - p.n, next_ko: next };
  });
  return { z, end: G.end, turns: G.turns, final, per };
}

/* The first-person view: the chairs renamed. The information is unchanged (see the header). */
function firstPerson(x, side) {
  const opp = side === 'p1' ? 'p2' : 'p1';
  return { n: x.n, field: x.field, me: x.sides[side], opp: x.sides[opp] };
}

module.exports = { extract, labels, firstPerson, parseIdent, parseHP, ParseError, UNK };
