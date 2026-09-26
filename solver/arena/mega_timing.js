/* solver/arena/mega_timing.js — WHEN a side mega evolves, and the board reasons for waiting. Humans and bots alike.
 *
 * WHY. Will, 2026-09-25: delaying the mega can be correct — a pre-mega ability can (re)set weather or terrain that
 * the mega forme's ability would not, and a mon can bank a boost before it megas. mega_rate.js measures WHETHER a
 * side megas; this measures WHEN, and holds each bot's delayed share to the human range.
 *
 * ONE SHAPE FOR BOTH POPULATIONS — a per-side TIMELINE from the side's first capable turn to its mega (at most 12
 * entries), one entry per turn start:
 *     { t, field: { weather, terrain, trickroom }, mons: [ per active slot { id, species, ability, stone, boosts } | null ],
 *       act: [ per slot { kind, move, mega } | null ] }
 *   weather is normalised to 'sun' | 'rain' | 'sand' | 'snow' (or another id), terrain to 'grassy' | 'electric' | ...;
 *   `stone` is the mega forme the held stone makes (truthy) or null; `id` identifies a body across turns.
 *   Bots: mega_rate.js game(API, tallies, { trace: true }).detail().  Humans: humanSides() below, from
 *   solver/out/human/games.jsonl with the SAME capability definition as mega_rate.js (a stone holder of its own
 *   species active at a turn start before the side megaed).
 *
 * DELAY = mega turn − first capable turn. Delayed = delay > 0.
 *
 * REASONS (multi-label, delayed megas only; every one is read off the board, none is inferred from intent):
 *   other_holder_first     the mon that megaed was NOT active at the first capable turn: another stone holder made the
 *                          side capable first (one mega per battle, so the side chose which).
 *   switched_out_and_back  the mon that megaed was active at the first capable turn, left the field, and came back.
 *   field_by_pre_mega_ability  the mon's PRE-mega ability sets a weather/terrain (derived from the Dex: the ability's
 *                          handler calls setWeather/setTerrain), its mega forme's ability does not set that same one,
 *                          and that weather/terrain is up at the start of the mega turn.
 *     + field_regained     ... and it was NOT up at the first capable turn (it came back while the mega was held).
 *   mega_resets_field      the mega forme's ability sets a weather/terrain and it is DOWN at the start of the mega turn:
 *                          mega evolution re-fires the new ability's Start (Showdown sim/pokemon.ts), so the mega brings
 *                          it back. + field_lost_while_held: it was up at the first capable turn (overwritten or expired).
 *                          + mega_overrides_other_field: a DIFFERENT weather/terrain is up at the mega turn, which the mega
 *                          replaces (the weather war won by moving last).
 *   boost_banked           the mon's summed positive stat stages at the mega turn are higher than when it first
 *                          appears in the timeline.
 *   trick_room_changed     Trick Room was up at the first capable turn and not at the mega turn, or the reverse.
 *   none_readable          none of the above.
 * And, descriptively, what the megaing mon DID on the turns it could have megaed and did not: protect, fake_out,
 * setup (a status move that raises the user's own stats), field_move (weather/terrain/room/side condition),
 * status_other, attack, switch, other. Move classes are read from Dex.forFormat, never typed.
 *
 * THE CHECK (pre-registered 2026-09-25, before any bot's delayed share was read in this module):
 *   band = human delayed share ± DELAY_MARGIN (0.15, absolute, the same margin as the mega RATE floor).
 *   A bot FAILS when its Wilson 95% interval on delayed/megas lies wholly outside the band (upper < low, or lower >
 *   high). Fewer than MIN_MEGAS (50) megas = CANNOT ANSWER, never a pass. solver/tests/test-mega-timing.js.
 */
'use strict';
const fs = require('fs');
const MR = require('./mega_rate.js');

const DELAY_MARGIN = 0.15;
const MIN_MEGAS = 50;
/* measured 2026-09-25: solver/out/mega/timing-human.json sides.delayed_share, 10,223 of 45,952 human megas were made after
 * the side's first capable turn, Wilson [0.2187, 0.2263] (docs/_reports/2026-09-26-champion-vs-doduo-and-mega-timing.md §2) */
const HUMAN_DELAYED_SHARE = 0.2225;

const WEATHER = { sunnyday: 'sun', raindance: 'rain', sandstorm: 'sand', snowscape: 'snow', snow: 'snow', hail: 'snow',
                  desolateland: 'desolateland', primordialsea: 'primordialsea', deltastream: 'deltastream' };
const toID = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const normWeather = w => { if (!w) return null; const k = toID(typeof w === 'object' ? w.name : w); return WEATHER[k] || k || null; };
const normTerrain = t => { if (!t) return null; const k = toID(typeof t === 'object' ? t.name : t).replace(/terrain$/, ''); return k || null; };

let _dex = null;
function dex() {
  if (_dex) return _dex;
  const X = require('../human/dex.js');
  const D = X.D;
  const setsCache = new Map(), moveCache = new Map();
  /* what an ability SETS, read from its handler source in the regulation's Dex (the Champions mod merged in) */
  const sets = ab => {
    const k = toID(ab); if (!k) return null;
    if (setsCache.has(k)) return setsCache.get(k);
    const a = D.abilities.get(k);
    let r = null;
    if (a && a.exists) {
      const src = ['onStart', 'onSwitchIn', 'onAnySwitchIn'].map(h => (a[h] ? String(a[h]) : '')).join('\n');
      const w = /setWeather\(\s*['"]([a-z]+)['"]/i.exec(src), t = /setTerrain\(\s*['"]([a-z]+)['"]/i.exec(src);
      if (w || t) r = { weather: w ? normWeather(w[1]) : null, terrain: t ? normTerrain(t[1]) : null };
    }
    setsCache.set(k, r);
    return r;
  };
  const megaAbility = forme => { const s = forme ? D.species.get(toID(forme)) : null; return s && s.exists ? toID(s.abilities && s.abilities[0]) : null; };
  const moveClass = mv => {
    const k = toID(mv); if (!k) return 'other';
    if (moveCache.has(k)) return moveCache.get(k);
    const m = D.moves.get(k);
    let c = 'other';
    if (m && m.exists) {
      if (m.stallingMove) c = 'protect';
      else if (m.id === 'fakeout') c = 'fake_out';
      else if (m.category === 'Status' && ((m.boosts && (m.target === 'self' || m.target === 'adjacentAllyOrSelf' || m.target === 'allies')) || (m.self && m.self.boosts))) c = 'setup';
      else if (m.category === 'Status' && (m.weather || m.terrain || m.pseudoWeather || m.sideCondition)) c = 'field_move';
      else if (m.category === 'Status') c = 'status_other';
      else c = 'attack';
    }
    moveCache.set(k, c);
    return c;
  };
  return (_dex = { D, X, sets, megaAbility, moveClass });
}

const posSum = b => Object.values(b || {}).reduce((s, v) => s + (v > 0 ? v : 0), 0);

/* one side's timeline -> { delay, reasons[], held_actions[] } ; `side` = { capable_turn, mega_turn, mega_id, trace } */
function classify(side) {
  const out = { delay: side.capable_turn != null && side.mega_turn != null ? side.mega_turn - side.capable_turn : null, reasons: [], held_actions: [], mega_forme: null, pre_ability: null, field_set: null };
  if (out.delay == null || !side.trace || !side.trace.length) return out;
  const DX = dex();
  const tr = side.trace, id = side.mega_id;
  const at = e => (e.mons || []).findIndex(m => m && m.id === id);
  const first = tr[0];
  const megaE = tr.find(e => e.t === side.mega_turn) || null;
  const mIdx = megaE ? at(megaE) : -1;
  const mon = mIdx >= 0 ? megaE.mons[mIdx] : null;
  if (mon) { out.mega_forme = typeof mon.stone === 'string' ? mon.stone : null; out.pre_ability = toID(mon.ability); }
  if (out.delay <= 0) return out;
  if (at(first) < 0) out.reasons.push('other_holder_first');
  else {
    let gone = false;
    for (const e of tr) { if (e.t >= side.mega_turn) break; if (at(e) < 0) gone = true; }
    if (gone) out.reasons.push('switched_out_and_back');
  }
  if (mon && megaE) {
    const set = DX.sets(mon.ability);
    const megaSet = out.mega_forme ? DX.sets(DX.megaAbility(out.mega_forme)) : null;
    out.field_set = set;
    if (set) {
      const up = e => (set.weather && normWeather(e.field.weather) === set.weather) || (set.terrain && normTerrain(e.field.terrain) === set.terrain);
      const megaKeeps = megaSet && ((set.weather && megaSet.weather === set.weather) || (set.terrain && megaSet.terrain === set.terrain));
      if (!megaKeeps && up(megaE)) { out.reasons.push('field_by_pre_mega_ability'); if (!up(first)) out.reasons.push('field_regained'); }
    }
    /* the mega RE-FIRES its forme's ability: formeChange(…, isPermanent) -> setAbility(…, isFromFormeChange) -> the
     * ability's 'Start' (pokemon-showdown-mc sim/pokemon.ts formeChange ~L1487, setAbility ~L1943, commit f10d679).
     * So a mega whose ability sets weather/terrain F, made while F is DOWN, brings F back. */
    out.mega_field_set = megaSet;
    if (megaSet) {
      const upM = e => (megaSet.weather && normWeather(e.field.weather) === megaSet.weather) || (megaSet.terrain && normTerrain(e.field.terrain) === megaSet.terrain);
      if (!upM(megaE)) {
        out.reasons.push('mega_resets_field');
        if (upM(first)) out.reasons.push('field_lost_while_held');
        if ((megaSet.weather && megaE.field.weather) || (megaSet.terrain && megaE.field.terrain)) out.reasons.push('mega_overrides_other_field');
      }
    }
    const firstSeen = tr.find(e => at(e) >= 0);
    if (firstSeen && posSum(mon.boosts) > posSum(firstSeen.mons[at(firstSeen)].boosts)) out.reasons.push('boost_banked');
    if (!!first.field.trickroom !== !!megaE.field.trickroom) out.reasons.push('trick_room_changed');
  }
  if (!out.reasons.length) out.reasons.push('none_readable');
  for (const e of tr) {
    if (e.t >= side.mega_turn) break;
    const i = at(e); if (i < 0) continue;
    const a = e.act && e.act[i];
    out.held_actions.push(!a ? 'other' : a.kind === 'switch' ? 'switch' : a.kind === 'move' ? DX.moveClass(a.move) : 'other');
  }
  return out;
}

/* fold classified sides into one summary */
function summarize(sides) {
  const S = { capable: 0, megas: 0, delay0: 0, delayed: 0, delay: {}, reasons: {}, first_held_action: {}, held_actions: {}, reason_combos: {} };
  for (const sd of sides) {
    if (sd.capable_turn == null) continue;
    S.capable++;
    if (sd.mega_turn == null) continue;
    S.megas++;
    const c = classify(sd);
    S.delay[c.delay] = (S.delay[c.delay] || 0) + 1;
    if (c.delay === 0) { S.delay0++; continue; }
    S.delayed++;
    for (const r of c.reasons) S.reasons[r] = (S.reasons[r] || 0) + 1;
    const combo = c.reasons.slice().sort().join('+'); S.reason_combos[combo] = (S.reason_combos[combo] || 0) + 1;
    if (c.held_actions.length) S.first_held_action[c.held_actions[0]] = (S.first_held_action[c.held_actions[0]] || 0) + 1;
    for (const a of c.held_actions) S.held_actions[a] = (S.held_actions[a] || 0) + 1;
  }
  S.delay0_share = S.megas ? +(S.delay0 / S.megas).toFixed(4) : null;
  S.delayed_share = S.megas ? +(S.delayed / S.megas).toFixed(4) : null;
  S.delayed_ci95 = MR.wilson(S.delayed, S.megas);
  const n = Object.values(S.delay).reduce((a, b) => a + b, 0);
  S.delay_mean = n ? +(Object.entries(S.delay).reduce((s, [k, v]) => s + k * v, 0) / n).toFixed(3) : null;
  S.reason_share = Object.fromEntries(Object.entries(S.reasons).map(([k, v]) => [k, +(v / Math.max(1, S.delayed)).toFixed(4)]));
  return S;
}

/* ---- humans: the dataset's turns -> per-side timelines ----------------------------------------------------------- */
const HUMAN_BOOST = { atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp', accuracy: 'acc', evasion: 'eva' };
function humanSide(g, turns, P) {
  const megaOf = MR._megaOfRow();
  const sheet = (g.sheets && g.sheets[P]) || [];
  let capableTurn = null, megaTurn = null, megaId = null;
  const trace = [];
  for (const t of turns || []) {
    const sd = t.state && t.state.sides && t.state.sides[P];
    if (!sd) continue;
    if (megaTurn == null && !sd.mega_used && capableTurn == null) {
      for (const i of sd.active || []) if (i != null && megaOf(sheet[i]) && !(sd.mons[i] && sd.mons[i].fnt)) { capableTurn = t.n; break; }
    }
    const acts = (t.actions && t.actions[P]) || {};
    if (capableTurn != null && megaTurn == null && trace.length < 12) {
      const st = t.state;
      const pseudo = st.pseudo || {};
      trace.push({ t: t.n, field: { weather: normWeather(st.weather), terrain: normTerrain(st.terrain), trickroom: !!pseudo['Trick Room'] },
        mons: (sd.active || []).map(i => { if (i == null) return null; const m = sd.mons[i] || {}; if (m.fnt) return null;
          const b = {}; for (const [k, v] of Object.entries(m.boosts || {})) b[HUMAN_BOOST[k] || k] = v;
          return { id: String(i), species: m.species || (sheet[i] && sheet[i].species), ability: sheet[i] && sheet[i].ability, stone: megaOf(sheet[i]), boosts: b }; }),
        act: ['a', 'b'].map(k => (acts[k] ? { kind: acts[k].kind, move: acts[k].move || null, mega: !!acts[k].mega } : null)) });
    }
    if (megaTurn == null) for (const k of ['a', 'b']) if (acts[k] && acts[k].mega) { megaTurn = t.n; megaId = String(acts[k].mon); }
  }
  return { capable_turn: capableTurn, mega_turn: megaTurn, mega_id: megaId, trace };
}
/* the whole dataset, streamed; opts.limit caps games. Returns { sides: summary, by_rating, by_end, games } and, with
 * opts.keep, the classified per-side records (for the report's examples). */
function humanTiming(file, opts) {
  opts = opts || {};
  const all = [], byBand = {}, byEnd = {};
  let games = 0;
  const fd = fs.openSync(file, 'r'); const chunk = Buffer.alloc(1 << 22);
  const dec = new (require('string_decoder').StringDecoder)('utf8');
  let buf = '', k;
  const each = line => {
    const { game: g, turns } = JSON.parse(line);
    games++;
    for (const P of ['p1', 'p2']) {
      const s = humanSide(g, turns, P);
      if (s.capable_turn == null) continue;
      all.push(s);
      const r = (g.players && g.players[P] && g.players[P].rating) || 0;
      const band = r >= 1300 ? '1300+' : r >= 1200 ? '1200-1299' : r >= 1100 ? '1100-1199' : '<1100';
      (byBand[band] || (byBand[band] = [])).push(s);
      (byEnd[g.end || '?'] || (byEnd[g.end || '?'] = [])).push(s);
    }
  };
  try {
    while ((k = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      buf += dec.write(chunk.subarray(0, k));
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, nl); buf = buf.slice(nl + 1); if (line) each(line); if (opts.limit && games >= opts.limit) break; }
      if (opts.limit && games >= opts.limit) break;
    }
    if (buf.trim() && !(opts.limit && games >= opts.limit)) each(buf);
  } finally { fs.closeSync(fd); }
  const lite = xs => { const s = summarize(xs); return { capable: s.capable, megas: s.megas, delayed: s.delayed, delayed_share: s.delayed_share, delayed_ci95: s.delayed_ci95, delay_mean: s.delay_mean }; };
  return { games, sides: summarize(all), by_rating: Object.fromEntries(Object.entries(byBand).map(([b, xs]) => [b, lite(xs)])),
           by_end: Object.fromEntries(Object.entries(byEnd).map(([b, xs]) => [b, lite(xs)])), records: opts.keep ? all : undefined };
}

/* ---- the check ---------------------------------------------------------------------------------------------------- */
function band(human) { return [+Math.max(0, human - DELAY_MARGIN).toFixed(4), +Math.min(1, human + DELAY_MARGIN).toFixed(4)]; }
/* -> { verdict: 'PASS' | 'FAIL' | 'CANNOT', why } for one bot summary against the human delayed share */
function check(botSummary, human) {
  human = human == null ? HUMAN_DELAYED_SHARE : human;   // BEFORE band(): band(undefined) is [NaN, NaN], every comparison false, every bot PASS (the test's RED run caught it)
  const [lo, hi] = band(human);
  if (!botSummary || botSummary.megas < MIN_MEGAS) return { verdict: 'CANNOT', why: 'only ' + (botSummary ? botSummary.megas : 0) + ' megas (need ' + MIN_MEGAS + ')', band: [lo, hi] };
  const ci = botSummary.delayed_ci95;
  if (ci[1] < lo) return { verdict: 'FAIL', why: 'delays too rarely: ' + botSummary.delayed + '/' + botSummary.megas + ' CI ' + JSON.stringify(ci) + ' below the human band ' + JSON.stringify([lo, hi]), band: [lo, hi] };
  if (ci[0] > hi) return { verdict: 'FAIL', why: 'delays too often: ' + botSummary.delayed + '/' + botSummary.megas + ' CI ' + JSON.stringify(ci) + ' above the human band ' + JSON.stringify([lo, hi]), band: [lo, hi] };
  return { verdict: 'PASS', why: botSummary.delayed + '/' + botSummary.megas + ' delayed, CI ' + JSON.stringify(ci) + ' meets the human band ' + JSON.stringify([lo, hi]), band: [lo, hi] };
}

/* ---- DELIBERATE BREAKS (solver/arena/arena.js ARENA_BREAK=meganow | megalate) ------------------------------------ */
/* meganow: whenever a slot could mega and the bot's joint does not, play the mega twin of that joint (never delays). */
function megaNow(bot, API) {
  const M = API.M;
  return Object.assign({}, bot, { name: bot.name + '+meganow', async choose(S, side, ctx) {
    const c = await bot.choose(S, side, ctx);
    const sf = side === 'A' ? S.sfA : S.sfB, acts = side === 'A' ? S.actA : S.actB;
    if (!c || !c.joint || sf.megaUsed || c.joint.some(o => o && o.mega)) return c;
    const i = acts.findIndex(m => m && !m.fainted && m.curHP > 0 && M.canMegaNow(S, m));
    if (i < 0) return c;
    const la = API.legalActions(S, side);
    const want = c.joint.map((o, k) => (o ? (k === i && o.kind === 'move' ? o.choice + ' mega' : o.choice) : null));
    /* the exact mega twin; else keep the partner's choice and take any mega action for the slot; else any mega joint */
    const j = la.joint.find(jj => jj[i] && jj[i].mega && jj.every((o, k) => (o ? o.choice : null) === want[k]))
      || la.joint.find(jj => jj[i] && jj[i].mega && jj.every((o, k) => k === i || (o ? o.choice : null) === (c.joint[k] ? c.joint[k].choice : null)))
      || la.joint.find(jj => jj.some(o => o && o.mega));
    return j ? Object.assign({}, c, { joint: j }) : c;
  } });
}
/* megalate: on the side's first capable turn of each game, every mega request is stripped (always delays). */
function megaLate(bot, API) {
  const M = API.M;
  const firstCap = new WeakMap();
  return Object.assign({}, bot, { name: bot.name + '+megalate', async choose(S, side, ctx) {
    const c = await bot.choose(S, side, ctx);
    const sf = side === 'A' ? S.sfA : S.sfB, acts = side === 'A' ? S.actA : S.actB;
    const key = ctx || S;
    const rec = firstCap.get(key) || {}; firstCap.set(key, rec);
    if (!sf.megaUsed && rec[side] == null && acts.some(m => m && !m.fainted && m.curHP > 0 && M.megaTargetFor(m))) rec[side] = S.turn;
    if (rec[side] === S.turn && c && c.joint && c.joint.some(o => o && o.mega)) {
      const la = API.legalActions(S, side);
      const want = c.joint.map(o => (o ? String(o.choice).replace(/ mega$/, '') : null));
      const j = la.joint.find(jj => jj.every((o, k) => (o ? o.choice : null) === want[k]));
      if (j) return Object.assign({}, c, { joint: j });
    }
    return c;
  } });
}

/* per mega forme: megas and delayed share (the forme names come from the data, which is Reg M-C by construction) */
function byForme(sides, minN) {
  const o = {};
  for (const sd of sides) { if (sd.mega_turn == null) continue; const c = classify(sd); const f = c.mega_forme || '?';
    const r = o[f] || (o[f] = { megas: 0, delayed: 0, reasons: {} }); r.megas++; if (c.delay > 0) { r.delayed++; for (const x of c.reasons) r.reasons[x] = (r.reasons[x] || 0) + 1; } }
  return Object.fromEntries(Object.entries(o).filter(([, r]) => r.megas >= (minN || 1)).sort((a, b) => b[1].megas - a[1].megas)
    .map(([f, r]) => [f, Object.assign(r, { delayed_share: +(r.delayed / r.megas).toFixed(4), ci95: MR.wilson(r.delayed, r.megas) })]));
}

/* match shard lines (solver/mew/play.js --mode match) -> per-bot side lists */
function matchSides(files) {
  const by = {};
  for (const f of files) for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!l) continue; let p; try { p = JSON.parse(l); } catch (e) { continue; }
    if (!p.mega || p.err) continue;
    (by.x || (by.x = [])).push(p.mega.x); (by.y || (by.y = [])).push(p.mega.y);
  }
  return by;
}

/* CLI:  node solver/arena/mega_timing.js --human <games.jsonl> [--limit N] --out <json>
 *       node solver/arena/mega_timing.js --match <shard.jsonl>[,<shard.jsonl>...] --out <json> */
if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  require('./env.js');
  const out = flag('--out');
  let res;
  if (flag('--human')) {
    const r = humanTiming(flag('--human'), { limit: +flag('--limit', 0) || 0, keep: true });
    const h = r.sides;
    res = { what: 'human mega timing (solver/arena/mega_timing.js)', file: flag('--human'), games: r.games, sides: h, by_rating: r.by_rating, by_end: r.by_end,
            by_forme: byForme(r.records, 100), band: band(h.delayed_share), margin: DELAY_MARGIN, min_megas: MIN_MEGAS };
  } else if (flag('--match')) {
    const by = matchSides(flag('--match').split(','));
    res = { what: 'bot mega timing from match shards (solver/arena/mega_timing.js)', files: flag('--match').split(','),
            x: summarize(by.x || []), y: summarize(by.y || []), x_by_forme: byForme(by.x || [], 20), y_by_forme: byForme(by.y || [], 20) };
  } else { console.error('usage: --human <file> | --match <files> --out <json>'); process.exit(2); }
  if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
  const S = res.sides || res.x;
  console.log(JSON.stringify({ megas: S.megas, delayed: S.delayed, delayed_share: S.delayed_share, ci: S.delayed_ci95, reasons: S.reasons }, null, 0));
}

module.exports = { classify, byForme, matchSides, HUMAN_DELAYED_SHARE, summarize, humanSide, humanTiming, check, band, megaNow, megaLate, normWeather, normTerrain, dex,
                   DELAY_MARGIN, MIN_MEGAS };
