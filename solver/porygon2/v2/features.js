/* solver/porygon2/v2/features.js — PORYGON2 v2's input: the PUBLIC state with per-field UNK, on a frozen release.
 *
 *   const F = require('./solver/porygon2/v2/features.js').create(API);
 *   const P = F.fromReveal(x)              a reveal.js position (training data, bo1 or bo3)
 *   const P = F.fromEngine(S, sheets)      a MEDICHAM battle with both OPEN sheets (play, bo3)
 *   const X = F.encode(P, ratings)         the numbers the net reads; ratings = { p1, p2 } (null = unrated)
 *
 * ONE ENCODE, TWO PRODUCERS, as v1. Both producers end in v1's own H (solver/porygon2/v1/features.js) so the per-token
 * MEDICHAM facts (TFACT_NAMES: the damage race, speed order, priority KO) are v1's, unchanged, recomputed on the public
 * state (DESIGN §2.2). What v2 changes:
 *
 *   - THE SHEET IS WHAT IS KNOWN. A body is built from the member's KNOWN moves only, its known item (or none) and its known
 *     ability, or `No Ability` when the ability is unknown (it exists in the Reg M-C dex). buildBody below FILLS NOTHING:
 *     solver/arena/teams.js buildBody fills an unknown ability with the species' first listed one, a prior by construction,
 *     and refuses a member with no moves (so it would have no speed and could not be hit either). A member with no known
 *     move is still a defender and still has a speed; it only has no outgoing hit.
 *   - UNK IS NOT NONE. Every field that can be unknown has its own UNK id (`<UNK>`) distinct from NONE (`<NONE>`: an item
 *     knocked off or consumed), and each token carries its unknown counts as numbers (EXTRA_NAMES).
 *   - NO HISTORY. A reveal position is a snapshot: it carries no action history, so the shield streak, turns in, PP spent,
 *     the choice lock and the engine-only volatiles (trapped, charging, recharge) are NOT inputs. The engine producer
 *     blanks exactly the same fields, so training and play see the same thing (CLAUDE.md: fitting environment and playing
 *     environment must match). v1's fromDataset, called with a one-turn history, yields exactly this blanking.
 *
 * DELIBERATE BREAKS (env PORY2V2_FEAT_BREAK):
 *   fill    an unknown ability is filled with the species' first legal ability and an unknown move list with nothing
 *           marked unknown — the prior-fill the design forbids; the v2 feature test must go red.
 *   history the engine producer keeps v1's history fields (shield streak, turns in, PP), so play differs from training.
 */
'use strict';
const X = require('../../human/dex.js');
const toID = X.toID;
const V1 = require('../v1/features.js');

const UNK = '<UNK>';
const SIDES = ['p1', 'p2'];
const ID_NAMES = ['species', 'form', 'item_orig', 'item_now', 'ability_base', 'ability_now', 'move1', 'move2', 'move3', 'move4'];
const ID_KINDS = ['species', 'species', 'item', 'item', 'ability', 'ability', 'move', 'move', 'move', 'move'];
const SPECIAL = ['<pad>', '<oov>', '<UNK>', '<NONE>'];         // the first four ids of every vocabulary, in this order
const EXTRA_NAMES = ['brought_unk', 'unk_moves', 'unk_item_orig', 'unk_item_now', 'unk_ability_base', 'unk_ability_now',
  'ability_dex_deduced', 'item_now_none', 'moves_known'];
const TOK_NUM_NAMES = [...V1.TOK_NUM_NAMES, ...EXTRA_NAMES];
const FEATURE_VERSION = 'porygon2-v2.0';
const BREAK = (typeof process !== 'undefined' && process.env && process.env.PORY2V2_FEAT_BREAK) || '';
/* rating bins, Maia-2 style: UNRATED, (-inf,1000], (1000,1100], ..., (1900,2000], (2000,+inf) */
const RATING_EDGES = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000];
function ratingBin(r) {
  if (r == null || !isFinite(r)) return 0;
  let b = 1; for (const e of RATING_EDGES) if (r > e) b++;
  return b;                                           // 1 .. RATING_EDGES.length + 1
}
const RATING_BINS = RATING_EDGES.length + 2;

function create(API, opts) {
  opts = opts || {};
  const M = API.M;
  const D = X.D;
  const COUNTERS = { reveal: 0, engine: 0, encoded: 0, bodies_no_moves: 0, bodies_no_ability: 0, body_failed: 0 };

  /* the body builder that fills nothing (see the header) */
  function buildBody(Mm, p) {
    if (!p || !p.species) return null;
    let b;
    try { b = Mm.buildMon(p.species, {}); } catch (e) { b = null; }
    if (!b) { COUNTERS.body_failed++; return null; }
    const moves = [];
    for (const mv of p.moves || []) { const m = D.moves.get(toID(mv)); if (m && m.exists && !moves.includes(m.id)) moves.push(m.id); }
    if (!moves.length) COUNTERS.bodies_no_moves++;
    b.moves = moves;
    const it = toID(p.item);
    b.item = it && D.items.get(it).exists ? it : '';
    const sp = D.species.get(toID(p.species));
    const legal = sp && sp.exists ? Object.values(sp.abilities || {}).map(toID) : [];
    const ab = toID(p.ability);
    if (BREAK === 'fill') b.ability = legal.includes(ab) ? ab : (legal[0] || b.ability);
    else if (legal.includes(ab)) b.ability = ab;
    else { b.ability = 'noability'; COUNTERS.bodies_no_ability++; }
    return b;
  }
  const F1 = V1.create(API, { buildBody });

  const known = v => v != null && v !== UNK;

  /* reveal.js position -> the v1 H (through v1's own fromDataset with a one-turn history: every history field blank),
   * the known-only sheet rows, and the per-token reveal record */
  function fromReveal(x) {
    COUNTERS.reveal++;
    const sheets = {}, rev = {};
    const state = { weather: x.field.weather, terrain: x.field.terrain, pseudo: x.field.pseudo, sides: {} };
    for (const s of SIDES) {
      const side = x.sides[s];
      sheets[s] = side.mons.map(m => {
        const mv = m.moves.filter(known);
        return { species: m.species,
          item: known(m.item.orig) ? m.item.orig : '',
          ability: BREAK === 'fill' ? (known(m.ability.base) ? m.ability.base : '') : (known(m.ability.base) ? m.ability.base : 'No Ability'),
          moves: mv };
      });
      rev[s] = side.mons.map(m => ({ species: m.species, form: m.brought === true ? (m.form || m.species) : UNK,
        item_orig: m.item.orig, item_now: m.item.now, ability_base: m.ability.base, ability_now: m.ability.now,
        moves: BREAK === 'fill' ? m.moves.filter(known) : m.moves.slice(0, 4), brought_unk: m.brought !== true, dex: m.ability_src === 'dex' }));
      state.sides[s] = { conditions: side.conditions, mega_used: side.mega_used, active: side.active,
        mons: side.mons.map(m => m.brought !== true ? { seen: false } : {
          seen: true, fnt: !!m.fnt, hp: m.fnt ? 0 : m.hp, status: m.status || '', boosts: m.boosts, vol: m.vol,
          item: known(m.item.now) ? (m.item.now || '') : '', ability: known(m.ability.now) ? m.ability.now : '',
          species: m.form || m.species }) };
    }
    const H = F1.fromDataset({ sheets }, [{ n: x.n, state }], 0);
    return { H, sheets, rev };
  }

  /* a MEDICHAM battle with both open sheets (bo3 play): the sheet is fully known; the engine's history fields are blanked */
  function fromEngine(S, fullSheets) {
    COUNTERS.engine++;
    const H = F1.fromEngine(S, fullSheets);
    if (BREAK !== 'history') for (const s of SIDES) for (const m of H.sides[s].mons) {
      if (!m.seen) continue;
      m.protectN = 0; m.turnsOut = 0; m.pp = [1, 1, 1, 1];
      for (const k of ['trapped', 'charging', 'recharge', 'locked']) delete m.vol[k];
    }
    const sheets = {}, rev = {};
    for (const s of SIDES) {
      sheets[s] = fullSheets[s].map(r => ({ species: r.species, item: r.item || '', ability: r.ability || 'No Ability', moves: (r.moves || []).slice(0, 4) }));
      rev[s] = fullSheets[s].map((r, i) => {
        const m = H.sides[s].mons[i];
        const mv = (r.moves || []).slice(0, 4);
        return { species: r.species, form: m.seen ? (m.species || r.species) : UNK, item_orig: r.item || null,
          item_now: m.seen ? (m.item ? itemName(m.item) : null) : (r.item || null), ability_base: r.ability || UNK,
          ability_now: m.seen ? (m.ability ? abilityName(m.ability) : (r.ability || UNK)) : (r.ability || UNK),
          /* a sheet with fewer than four moves pads with UNK, exactly as reveal.js pads a bo3 sheet */
          moves: mv.concat(Array(Math.max(0, 4 - mv.length)).fill(UNK)), brought_unk: !m.seen, dex: false };
      });
    }
    return { H, sheets, rev };
  }
  const itemName = id => { const it = D.items.get(toID(id)); return it && it.exists ? it.name : id; };
  const abilityName = id => { const a = D.abilities.get(toID(id)); return a && a.exists ? a.name : id; };

  /* ids as STRINGS; the dataset writer and the net map them through their own vocabularies */
  function idOf(v) { return v === UNK ? '<UNK>' : v == null || v === '' ? '<NONE>' : toID(v); }

  function encode(P, ratings) {
    COUNTERS.encoded++;
    const X1 = F1.encode(P.H, P.sheets);
    const out = { tok: {}, ids: {}, side: X1.side, field: X1.field, facts: X1.facts, base: X1.base,
      rating: [ratings && ratings.p1 != null ? +ratings.p1 : null, ratings && ratings.p2 != null ? +ratings.p2 : null] };
    for (const s of SIDES) {
      out.tok[s] = X1.tok[s].map((t, i) => {
        const r = P.rev[s][i];
        const unkMoves = r.moves.filter(v => v === UNK).length;
        const nMoves = r.moves.filter(v => v != null && v !== UNK).length;
        return t.concat([r.brought_unk ? 1 : 0, unkMoves / 4, r.item_orig === UNK ? 1 : 0, r.item_now === UNK ? 1 : 0,
          r.ability_base === UNK ? 1 : 0, r.ability_now === UNK ? 1 : 0, r.dex ? 1 : 0, r.item_now === null ? 1 : 0, nMoves / 4]);
      });
      out.ids[s] = P.rev[s].map(r => [idOf(r.species), idOf(r.form), idOf(r.item_orig), idOf(r.item_now), idOf(r.ability_base),
        idOf(r.ability_now), ...[0, 1, 2, 3].map(j => r.moves[j] === undefined ? '<NONE>' : idOf(r.moves[j]))]);
    }
    return out;
  }

  return { fromReveal, fromEngine, encode, buildBody, COUNTERS, v1: F1, BROKEN: BREAK || null };
}

module.exports = { create, TOK_NUM_NAMES, EXTRA_NAMES, ID_NAMES, ID_KINDS, SPECIAL, SIDE_NUM_NAMES: V1.SIDE_NUM_NAMES,
  FIELD_NUM_NAMES: V1.FIELD_NUM_NAMES, FACT_NAMES: V1.FACT_NAMES, FEATURE_VERSION, RATING_EDGES, RATING_BINS, ratingBin, UNK, BREAK };
