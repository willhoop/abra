/* solver/results/2026-10-01-speed-mega-switch/analyze.js — how often the ladder bot establishes SPEED CONTROL, MEGA
 * evolves and SWITCHES, beside its own opponents and the open-sheet humans (abra/regmc 1.55.0;
 * docs/_reports/2026-10-01-speed-mega-switch.md).
 *
 *   cmd.exe /c tools\lownode.cmd solver\results\2026-10-01-speed-mega-switch\analyze.js
 *        [--rotom <dir>]   ROTOM's run directories (default: the MAIN checkout's solver/out/rotom, read only)
 *        [--raw <dir>]     the tracked raw-log shards of the Reg M-C bo3 stream (default data/raw/games.gen9championsvgc2026regmcbo3)
 *        [--store <gz>]    the parsed bo3 store, for engine/quality.js reasons() (default data/games.gen9championsvgc2026regmcbo3.jsonl.gz)
 *        [--store-bo1 <gz>] the bo1 store, read only for the behavioural-bot account set (as solver/meta/extract.js does)
 *        [--out <file>]    default measured.json beside this file
 *
 * READ ONLY. Every count goes through ONE reader, solver/arena/tactics.js fromLog(), for all three groups: the bot (its
 * own saved room logs), its opponents (the other side of the same logs) and the humans (the raw replay logs). Nothing
 * here plays a game or loads MEDICHAM.
 *
 * HUMANS. A raw game is used when its id is in the bo3 store, engine/quality.js reasons() is empty for its store row
 * (behavioural bots computed over both stores, as solver/meta/extract.js does), both sides published a sheet, and no
 * player is one of our own accounts. Each SIDE is banded by that player's own rating at game start (the `|player|`
 * line): 1400+ (the top group), 1200-1399, under 1200.
 *
 * LIKE WITH LIKE (indirect standardisation). For each bot body-turn the human rate of the same act in the same stratum
 * is summed into an EXPECTED count:
 *   speed control   stratum = (species, speed-control move, the order at turn start: mattered | close | wasted, turn 1 | 2-3 | 4+)
 *   switch-out      stratum = (species, turn 1 | 2-3 | 4+, HP >= 50% | < 50%)
 *   mega            stratum = the mega species (per capable side)
 * The reference is the 1400+ band; a stratum with fewer than MIN_REF human opportunities falls back to 1200+, then to
 * every band, then to a coarser key (the order or the HP bucket dropped). The fallback used is counted.
 *
 * THE TABLE CHECK (the bot's own decisions). For each searched move decision the rows are decoded through our sheet's
 * move order (the request's order); the decode is checked against the move the log shows the slot used, and the
 * agreement is printed. Then, where the bot did NOT do a thing a human in its stratum often does, was the option in the
 * table (a JUDGEMENT question: what mix and value it got) or absent (a COVERAGE question: MAG/DODUO's narrowing)?
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* lownode set it */ }
require('../../arena/env.js');
const TAC = require('../../arena/tactics.js');
const X = require('../../human/dex.js');
const { parseShowteam } = require('../../human/parse_game.js');
const ROOT = path.join(__dirname, '..', '..', '..');
const Q = require(path.join(ROOT, 'engine', 'quality.js'));
const toID = X.toID;

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const MAIN = 'C:\\Users\\willj\\Projects\\Pokemon\\ABRA';
const ROTOM = flag('rotom', path.join(MAIN, 'solver', 'out', 'rotom'));
const RAW = flag('raw', path.join(ROOT, 'data', 'raw', 'games.gen9championsvgc2026regmcbo3'));
const STORE = flag('store', path.join(ROOT, 'data', 'games.gen9championsvgc2026regmcbo3.jsonl.gz'));
const STORE_BO1 = flag('store-bo1', path.join(ROOT, 'data', 'games.gen9championsvgc2026regmc.jsonl.gz'));
const OURS_ONLY = argv.includes('--ours-only');
const OUT = OURS_ONLY ? path.join(ROOT, 'solver', 'out', 'speed-mega-switch', 'ours-only.json') : flag('out', path.join(__dirname, 'measured.json'));
const OWN = new Set(['medicham32', 'willhoop', 'mag', 'mag2', 'miltank', 'miltank2']);
const MIN_REF = 20;
const t0 = Date.now();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const receipt = f => { const b = fs.readFileSync(f); return { path: f, bytes: b.length, sha256: sha(b) }; };
const readJsonl = f => { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; } };
const tb = t => (t <= 1 ? 't1' : t <= 3 ? 't2-3' : 't4+');
const hb = h => (h == null ? 'hp?' : h >= 0.5 ? 'hp50+' : 'hp<50');
const band = r => (r == null ? 'unrated' : r >= 1400 ? '1400+' : r >= 1200 ? '1200-1399' : '<1200');
const baseOf = sp => { const S = X.D.species.get(sp); return S && S.exists ? (S.baseSpecies || S.name) : sp; };
function wilson(k, n, z = 1.959964) { if (!n) return null; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [+((c - h) / d).toFixed(3), +((c + h) / d).toFixed(3)]; }
const rate = (k, n) => ({ k, n, rate: n ? +(k / n).toFixed(4) : null, ci95: wilson(k, n) });

/* ================================================================ the strata ================================================ */
function strata() { return { sc: new Map(), sw: new Map(), mega: new Map() }; }
const bump = (m, k, hit) => { let c = m.get(k); if (!c) m.set(k, c = { n: 0, k: 0 }); c.n++; if (hit) c.k++; };
function addDetail(S, detail, side) {
  for (const r of detail) {
    if (r.side !== side) continue;
    const sp = baseOf(r.sp);
    for (const mv of r.sc) {
      const hit = r.used === mv;
      bump(S.sc, [sp, mv, r.rel, tb(r.turn)].join('|'), hit);
      bump(S.sc, [sp, mv, '*', tb(r.turn)].join('|'), hit);
      bump(S.sc, [sp, mv, '*', '*'].join('|'), hit);
    }
    bump(S.sw, [sp, tb(r.turn), hb(r.hp)].join('|'), r.sw_out);
    bump(S.sw, [sp, tb(r.turn), '*'].join('|'), r.sw_out);
    bump(S.sw, [sp, '*', '*'].join('|'), r.sw_out);
  }
}
function addMega(S, t, detail, side) {
  if (t.mega.capable_turn == null) return;
  const r = detail.find(x => x.side === side && x.mega_ready && x.turn === t.mega.capable_turn);
  const sp = r ? baseOf(r.sp) : '?';
  bump(S.mega, sp, !!t.mega.megaed);
}
/* the reference rate of a stratum key, with its fallback chain over bands and keys */
function refRate(REF, kind, keys) {
  for (const key of keys) for (const b of ['1400+', '1200+', 'all']) {
    const c = REF[b][kind].get(key);
    if (c && c.n >= MIN_REF) return { p: c.k / c.n, band: b, key, n: c.n };
  }
  return null;
}

/* ================================================================ 1. our games ============================================== */
function ourGames() {
  const runs = fs.readdirSync(ROTOM).filter(d => fs.existsSync(path.join(ROTOM, d)) && fs.statSync(path.join(ROTOM, d)).isDirectory()
    && fs.readdirSync(path.join(ROTOM, d)).some(f => /^ladder-series-.*\.jsonl$/.test(f))).sort();
  const games = [], perRun = {};
  for (const run of runs) {
    const dir = path.join(ROTOM, run);
    const gdir = path.join(dir, 'games');
    const clients = fs.existsSync(gdir) ? fs.readdirSync(gdir) : [];
    perRun[run] = { logs: 0, finished: 0, unfinished: 0 };
    for (const client of clients) {
      const urls = {};
      for (const e of readJsonl(path.join(dir, 'events-' + client + '.jsonl'))) if ((e.type === 'game_record' || e.type === 'replay_saved') && e.url) urls[e.room] = e.url;
      const decRun = readJsonl(path.join(dir, 'decisions-' + client + '.jsonl'));
      const armOf = {};
      for (const d of decRun) if (d.room && !armOf[d.room]) armOf[d.room] = { arm: d.arm, policy: d.policy };
      for (const f of fs.readdirSync(path.join(gdir, client)).filter(f => f.endsWith('.log')).sort()) {
        perRun[run].logs++;
        const room = f.slice(0, -4);
        const text = fs.readFileSync(path.join(gdir, client, f), 'utf8');
        if (!/\n\|(win|tie)(\||\n|$)/.test(text)) { perRun[run].unfinished++; continue; }
        perRun[run].finished++;
        const me = new RegExp('\\|player\\|p1\\|' + client + '\\|', 'i').test(text) ? 'p1' : 'p2';
        const r = TAC.fromLog(text, { me, detail: true });
        const decs = readJsonl(path.join(gdir, client, room + '.decisions.jsonl'));
        const a = armOf[room] || (decs[0] ? { arm: decs[0].arm, policy: decs[0].policy } : { arm: null, policy: null });
        const opp = me === 'p1' ? 'p2' : 'p1';
        const forfeit = /\|-message\|.* forfeited\./.test(text);
        games.push({ run, room, url: urls[room] || null, client, me, opp, arm: a.arm, policy: a.policy, won: r.winner === me, tie: r.tie,
          forfeit, turns: r.turns, ratings: r.ratings, names: r.names, mine: r.mine, theirs: r.opp, detail: r.detail, decs, text });
      }
    }
  }
  return { runs, perRun, games };
}

/* ================================================================ 2. humans ================================================= */
function readStoreRows(f) {
  const out = new Map();
  if (!fs.existsSync(f)) return out;
  const txt = zlib.gunzipSync(fs.readFileSync(f)).toString('utf8');
  for (const line of txt.split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch (e) { continue; }
    if (!o.id || out.has(o.id)) continue;
    out.set(o.id, { id: o.id, date: o.date, p1: o.p1, p2: o.p2, six: o.six, forfeit: o.forfeit, brought: o.brought, openSheet: o.openSheet,
      turns: (o.turns || []).map(t => ({ ev: (t.ev || []).filter(e => e.t === 'm' || e.t === 's').slice(0, 1) })) });
  }
  return out;
}
function humans(REF) {
  const bo3 = readStoreRows(STORE), bo1 = readStoreRows(STORE_BO1);
  const qcfg = Q.config();
  const bots = Q.behaviouralBots([...bo3.values(), ...bo1.values()], qcfg);
  const funnel = { store_rows: bo3.size, raw_rows: 0, raw_distinct: 0, not_in_store: 0, quality_excluded: 0, quality_reasons: {}, own_account: 0, no_sheets: 0, unfinished: 0, used: 0, parse_errors: 0 };
  const sides = { '1400+': [], '1200-1399': [], '<1200': [], unrated: [] };
  const seen = new Set();
  const shards = fs.readdirSync(RAW).filter(f => f.endsWith('.jsonl.gz')).sort();
  const shardReceipts = [];
  console.log(`humans: store ${bo3.size} rows, bo1 ${bo1.size}, ${bots.size} behavioural-bot accounts, ${shards.length} raw shards  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const [si, sh] of shards.entries()) {
    if (si % 25 === 0) console.log(`  shard ${si}/${shards.length}  used ${funnel.used}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const buf = fs.readFileSync(path.join(RAW, sh));
    shardReceipts.push({ file: sh, bytes: buf.length, sha256: sha(buf) });
    for (const line of zlib.gunzipSync(buf).toString('utf8').split('\n')) {
      if (!line) continue;
      let row; try { row = JSON.parse(line); } catch (e) { continue; }
      funnel.raw_rows++;
      if (!row.id || seen.has(row.id)) continue;
      seen.add(row.id); funnel.raw_distinct++;
      const q = bo3.get(row.id);
      if (!q) { funnel.not_in_store++; continue; }
      const rs = Q.reasons(q, qcfg, bots);
      if (rs.length) { funnel.quality_excluded++; for (const x of rs) funnel.quality_reasons[x] = (funnel.quality_reasons[x] || 0) + 1; continue; }
      const log = String(row.log || '');
      const pn = [...log.matchAll(/^\|player\|p[12]\|([^|]*)/gm)].map(m => toID(m[1]));
      if (pn.some(n => OWN.has(n))) { funnel.own_account++; continue; }
      if ((log.match(/^\|showteam\|p[12]\|/gm) || []).length < 2) { funnel.no_sheets++; continue; }
      if (!/\n\|(win|tie)(\||\n|$)/.test(log)) { funnel.unfinished++; continue; }
      let r; try { r = TAC.fromLog(log, { detail: true }); } catch (e) { funnel.parse_errors++; continue; }
      funnel.used++;
      const leanOf = t => ({ speed: Object.assign({}, t.speed, { uses: undefined }), mega: t.mega, switch: Object.assign({}, t.switch, { events: undefined }), turns: t.turns });
      const leans = { p1: leanOf(r.p1), p2: leanOf(r.p2) };
      for (const s of ['p1', 'p2']) {
        const b = band(r.ratings[s]);
        const t = r[s];
        const f = s === 'p1' ? 'p2' : 'p1';
        sides[b].push({ id: row.id, side: s, rating: r.ratings[s], won: r.winner === s, t: leans[s], foe: leans[f], foe_band: band(r.ratings[f]) });
        for (const key of [b, b === '1400+' || b === '1200-1399' ? '1200+' : null, 'all']) {
          if (!key) continue;
          addDetail(REF[key], r.detail, s);
          addMega(REF[key], t, r.detail, s);
        }
      }
    }
  }
  return { funnel, sides, shards: shardReceipts.length, shard_first: shards[0], shard_last: shards[shards.length - 1], shard_digest: sha(JSON.stringify(shardReceipts)) };
}

/* ================================================================ 3. standardised O/E ======================================= */
function observedExpected(REF, games, which) {
  const o = { sc: { obs: 0, exp: 0, n: 0, unmatched: 0, by_band: {} }, sw: { obs: 0, exp: 0, n: 0, unmatched: 0, by_band: {} }, mega: { obs: 0, exp: 0, n: 0, unmatched: 0, by_band: {} } };
  const fb = (blk, r) => { blk.by_band[r.band + (r.key.includes('*') ? ' (coarser key)' : '')] = (blk.by_band[r.band + (r.key.includes('*') ? ' (coarser key)' : '')] || 0) + 1; };
  for (const g of games) {
    const side = which === 'mine' ? g.me : g.opp;
    for (const r of g.detail) {
      if (r.side !== side) continue;
      const sp = baseOf(r.sp);
      for (const mv of r.sc) {
        const ref = refRate(REF, 'sc', [[sp, mv, r.rel, tb(r.turn)].join('|'), [sp, mv, '*', tb(r.turn)].join('|'), [sp, mv, '*', '*'].join('|')]);
        o.sc.n++;
        if (!ref) { o.sc.unmatched++; continue; }
        o.sc.exp += ref.p; if (r.used === mv) o.sc.obs++; fb(o.sc, ref);
      }
      const ref = refRate(REF, 'sw', [[sp, tb(r.turn), hb(r.hp)].join('|'), [sp, tb(r.turn), '*'].join('|'), [sp, '*', '*'].join('|')]);
      o.sw.n++;
      if (!ref) o.sw.unmatched++; else { o.sw.exp += ref.p; if (r.sw_out) o.sw.obs++; fb(o.sw, ref); }
    }
    const t = which === 'mine' ? g.mine : g.theirs;
    if (t.mega.capable_turn != null) {
      const r = g.detail.find(x => x.side === side && x.mega_ready && x.turn === t.mega.capable_turn);
      const sp = r ? baseOf(r.sp) : '?';
      const ref = refRate(REF, 'mega', [sp]);
      o.mega.n++;
      if (!ref) o.mega.unmatched++; else { o.mega.exp += ref.p; if (t.mega.megaed) o.mega.obs++; fb(o.mega, ref); }
    }
  }
  /* the ratio's 95% interval treats the observed count as Poisson (Wilson-Hilferty), the expected count as fixed */
  const pci = O => { const z = 1.959964; const lo = O === 0 ? 0 : O * Math.pow(1 - 1 / (9 * O) - z / (3 * Math.sqrt(O)), 3); const U = O + 1; const hi = U * Math.pow(1 - 1 / (9 * U) + z / (3 * Math.sqrt(U)), 3); return [lo, hi]; };
  for (const k of ['sc', 'sw', 'mega']) {
    const E = o[k].exp;
    o[k].exp = +E.toFixed(1); o[k].ratio = E ? +(o[k].obs / E).toFixed(3) : null;
    o[k].ratio_ci95 = E ? pci(o[k].obs).map(x => +(x / E).toFixed(3)) : null;
  }
  return o;
}

/* ================================================================ 4. the table check ======================================== */
function decodeRow(row, actives) {
  /* row 'move 1 1 mega, switch 3' -> per token { slot, kind, move, mega }; actives: [{ sp, moves[] } | null] for slots a, b.
   * Two tokens map to slots a and b in order (an empty slot is a 'pass'); one token is the one live slot. */
  const toks = String(row).split(/,\s*/);
  const live = [0, 1].filter(i => actives[i]);
  return toks.map((tok, i) => {
    const t = tok.trim().split(/\s+/);
    const slot = toks.length >= 2 ? i : (live[0] != null ? live[0] : 0);
    const a = actives[slot];
    if (t[0] === 'move') { const mv = a && a.moves[+t[1] - 1] ? toID(a.moves[+t[1] - 1]) : null; return { slot, kind: 'move', move: mv, mega: t.includes('mega') }; }
    if (t[0] === 'switch') return { slot, kind: 'switch' };
    return { slot, kind: t[0] };
  });
}
function tableCheck(g, REF) {
  const out = { decisions: 0, decoded: 0, agree: 0, disagree: 0, cases: [] };
  const sheet = (() => { const m = new RegExp('^\\|showteam\\|' + g.me + '\\|(.*)$', 'm').exec(g.text); try { return m ? parseShowteam(m[1]) : []; } catch (e) { return []; } })();
  const rowOf = sp => sheet.find(r => toID(baseOf(r.species)) === toID(baseOf(sp))) || null;
  const conds = TAC.speedCondsOf(sheet.map(r => r.ability));
  for (const d of g.decs) {
    if (d.kind !== 'move' || !d.info || !d.info.table) continue;
    if (!Array.isArray(d.info.table.rows) || !Array.isArray(d.info.table.mix) || !Array.isArray(d.info.table.row_mean)) { out.no_rows = (out.no_rows || 0) + 1; continue; }
    const det = g.detail.filter(r => r.side === g.me && r.turn === d.turn);
    if (!det.length) continue;
    out.decisions++;
    const actives = ['a', 'b'].map(p => { const r = det.find(x => x.slot === p); if (!r) return null; const row = rowOf(r.sp); return row ? { sp: r.sp, moves: row.moves, r } : null; });
    const T = d.info.table;
    const rows = T.rows.map(x => decodeRow(x, actives));
    const chosen = decodeRow(d.choice, actives);
    /* the decode against what the log shows each slot used */
    for (const c of chosen) {
      const a = actives[c.slot];
      if (!a || c.kind !== 'move' || !a.r.move) continue;
      out.decoded++; if (c.move === a.r.move) out.agree++; else out.disagree++;
    }
    const isSC = j => j.some(x => x.kind === 'move' && x.move && TAC.classFor(x.move, conds));
    const isMega = j => j.some(x => x.mega);
    const isSw = j => j.some(x => x.kind === 'switch');
    const mixOn = pred => +rows.reduce((s, j, i) => s + (pred(j) ? (T.mix[i] || 0) : 0), 0).toFixed(3);
    const bestOf = pred => { let b = null; rows.forEach((j, i) => { if (pred(j) && (b == null || T.row_mean[i] > b)) b = T.row_mean[i]; }); return b; };
    const chosenMean = T.row_mean[T.pick] != null ? T.row_mean[T.pick] : null;
    const base = { room: g.room, url: g.url, turn: d.turn, won: g.won, value: d.info.value, chosen: d.choice, chosen_row_mean: chosenMean };
    /* speed control: available, the foe acts first (mattered), and not chosen */
    const scAvail = det.some(r => r.sc.length) && det.some(r => r.rel === 'mattered');
    if (scAvail && !isSC(chosen)) {
      const inT = rows.some(isSC);
      out.cases.push(Object.assign({ kind: 'speed_not_used_when_foe_faster', in_table: inT, mix_on_option: inT ? mixOn(isSC) : 0, best_option_row_mean: inT ? bestOf(isSC) : null,
        human_p: (() => { let p = 0; for (const r of det) for (const mv of r.sc) { const ref = refRate(REF, 'sc', [[baseOf(r.sp), mv, r.rel, tb(r.turn)].join('|'), [baseOf(r.sp), mv, '*', tb(r.turn)].join('|')]); if (ref) p = Math.max(p, ref.p); } return +p.toFixed(3); })(),
        movesets: det.filter(r => r.sc.length).map(r => r.sp + ':' + r.sc.join('/')) }, base));
    }
    /* mega: ready, not taken this turn */
    if (det.some(r => r.mega_ready) && !isMega(chosen)) {
      const inT = rows.some(isMega);
      out.cases.push(Object.assign({ kind: 'mega_not_taken', in_table: inT, mix_on_option: inT ? mixOn(isMega) : 0, best_option_row_mean: inT ? bestOf(isMega) : null }, base));
    }
    /* switch: the human stratum's switch-out rate for the bodies on the field, and whether a switch row existed */
    let hp = 0; for (const r of det) { const ref = refRate(REF, 'sw', [[baseOf(r.sp), tb(r.turn), hb(r.hp)].join('|'), [baseOf(r.sp), tb(r.turn), '*'].join('|')]); if (ref) hp = Math.max(hp, ref.p); }
    out.cases.push(Object.assign({ kind: 'switch_row', chose_switch: isSw(chosen), in_table: rows.some(isSw), mix_on_option: mixOn(isSw), best_option_row_mean: bestOf(isSw), human_p_max: +hp.toFixed(3) }, base));
  }
  return out;
}

/* ================================================================ 5. does it cost games ===================================== */
function costTable(list, pred, label) {
  const yes = list.filter(x => pred(x)), no = list.filter(x => !pred(x));
  const Y = rate(yes.filter(x => x.won).length, yes.length), N = rate(no.filter(x => x.won).length, no.length);
  /* the difference in win rate, yes minus no, with a normal-approximation 95% interval. An ASSOCIATION, not an effect:
   * a losing position also produces desperate switches, and a strong opposing team also carries Trick Room. */
  let diff = null;
  if (Y.n && N.n) { const p = Y.k / Y.n, q = N.k / N.n, se = Math.sqrt(p * (1 - p) / Y.n + q * (1 - q) / N.n); diff = { d: +(p - q).toFixed(3), ci95: [+(p - q - 1.96 * se).toFixed(3), +(p - q + 1.96 * se).toFixed(3)] }; }
  return { label, yes: Y, no: N, diff };
}

/* ================================================================ main ====================================================== */
(function main() {
  const REF = { '1400+': strata(), '1200+': strata(), '1200-1399': strata(), '<1200': strata(), unrated: strata(), all: strata() };
  const OUR = ourGames();
  /* THE RUNS ARE PINNED (2026-10-01): the five runs the brief named. `chomptopfix-…` started at 07:18Z while this ran, on a
   * different build (the 1.52.0 world fixes), and is left out unless `--runs all`. The pin and what it dropped are recorded. */
  const PIN = flag('runs', 'aa1-,aa2-,gen5ab-,chomp1-,chomptop-2026-10-01T04-18-07-546Z');
  const pinned = PIN === 'all' ? null : PIN.split(',');
  const keepRun = run => !pinned || pinned.some(p => run.startsWith(p));
  const droppedRuns = OUR.runs.filter(r => !keepRun(r));
  OUR.games = OUR.games.filter(g => keepRun(g.run));
  OUR.runs = OUR.runs.filter(keepRun);
  console.log(`runs pinned: ${OUR.runs.join(', ')}; left out: ${droppedRuns.join(', ') || 'none'}; ${OUR.games.length} games`);
  console.log(`ours: ${OUR.games.length} finished games in ${OUR.runs.length} runs  ${JSON.stringify(OUR.perRun)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  /* THE HUMAN PASS IS CACHED (solver/out/speed-mega-switch/humans-<key>.json, untracked), keyed by the bytes it reads: the
   * store, every raw shard, engine/quality.js, data/quality-filter.json, tactics.js and this file. A changed input is a new key. */
  const keyParts = [receipt(STORE).sha256, fs.existsSync(STORE_BO1) ? receipt(STORE_BO1).sha256 : '-',
    sha(fs.readdirSync(RAW).filter(f => f.endsWith('.jsonl.gz')).sort().map(f => f + ':' + sha(fs.readFileSync(path.join(RAW, f)))).join('|')),
    sha(fs.readFileSync(path.join(ROOT, 'engine', 'quality.js'))), sha(fs.readFileSync(path.join(ROOT, 'data', 'quality-filter.json'))),
    sha(fs.readFileSync(path.join(__dirname, '..', '..', 'arena', 'tactics.js'))), sha(fs.readFileSync(__filename).toString().split('/* ================================================================ 3.')[0])];
  const CKEY = sha(keyParts.join('|')).slice(0, 16);
  const CFILE = path.join(ROOT, 'solver', 'out', 'speed-mega-switch', 'humans-' + CKEY + '.json');
  let H;
  if (OURS_ONLY) {   /* debugging the bot half: no human pass, no reference rates, and the result goes to solver/out, never to measured.json */
    H = { funnel: {}, sides: {}, shards: 0, cache: { hit: false, skipped: true } };
  } else if (fs.existsSync(CFILE) && !argv.includes('--no-cache')) {
    const C = JSON.parse(fs.readFileSync(CFILE, 'utf8'));
    for (const [b, S] of Object.entries(C.REF)) for (const k of ['sc', 'sw', 'mega']) REF[b][k] = new Map(S[k]);
    H = C.H; H.cache = { file: CFILE, key: CKEY, hit: true };
  } else {
    H = humans(REF);
    fs.mkdirSync(path.dirname(CFILE), { recursive: true });
    const ser = {}; for (const [b, S] of Object.entries(REF)) ser[b] = { sc: [...S.sc], sw: [...S.sw], mega: [...S.mega] };
    fs.writeFileSync(CFILE, JSON.stringify({ key: CKEY, parts: keyParts, REF: ser, H }));
    H.cache = { file: CFILE, key: CKEY, hit: false };
  }
  console.log(`humans: ${JSON.stringify(H.funnel)}  cache ${H.cache.hit ? 'hit' : 'written'} ${CKEY}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  const groups = {
    bot_search: OUR.games.filter(g => g.policy === 'miltank-gen5'),
    bot_prior: OUR.games.filter(g => g.policy === 'prior'),
    bot_unknown_arm: OUR.games.filter(g => g.policy !== 'miltank-gen5' && g.policy !== 'prior'),
  };
  const sumOf = (list, key) => TAC.summarize(list.map(g => ({ t: g[key], won: key === 'mine' ? g.won : !g.won && !g.tie })));
  const split = (list, key) => ({ all: sumOf(list, key), won: sumOf(list.filter(g => (key === 'mine' ? g.won : !g.won && !g.tie)), key), lost: sumOf(list.filter(g => (key === 'mine' ? !g.won && !g.tie : g.won)), key) });
  const H_split = list => ({ all: TAC.summarize(list), won: TAC.summarize(list.filter(x => x.won)), lost: TAC.summarize(list.filter(x => !x.won)) });
  const res = {
    generated: new Date().toISOString(), generator: 'solver/results/2026-10-01-speed-mega-switch/analyze.js',
    definitions: { speed_control_moves: TAC.derive().moves, weather_moves: TAC.derive().weatherMoves, terrain_moves: TAC.derive().terrainMoves,
      speed_abilities: TAC.derive().speedAbilities, priority_abilities: TAC.derive().priorityAbilities, item_speed: TAC.derive().itemSpeed, par_factor: TAC.derive().parF, tailwind_factor: TAC.derive().twF,
      self_switch_moves: [...TAC.derive().selfSwitch], format: X.FORMAT, showdown: X.SHOWDOWN_PATH, showdown_commit: X.checkoutCommit() },
    inputs: { rotom: ROTOM, runs: OUR.runs, runs_pin: PIN, runs_left_out: droppedRuns, per_run: OUR.perRun, store: receipt(STORE), store_bo1: fs.existsSync(STORE_BO1) ? receipt(STORE_BO1) : null,
      raw: { dir: RAW, shards: H.shards, first: H.shard_first, last: H.shard_last, digest: H.shard_digest }, quality_js_sha256: sha(fs.readFileSync(path.join(ROOT, 'engine', 'quality.js'))),
      tactics_js_sha256: sha(fs.readFileSync(path.join(__dirname, '..', '..', 'arena', 'tactics.js'))) },
    human_funnel: H.funnel,
    groups: {},
  };
  for (const [k, list] of Object.entries(groups)) {
    if (!list.length) continue;
    res.groups[k] = { games: list.length, by_run: list.reduce((m, g) => (m[g.run] = (m[g.run] || 0) + 1, m), {}), won: list.filter(g => g.won).length, forfeits: list.filter(g => g.forfeit).length,
      ours: split(list, 'mine'), opponents: split(list, 'theirs'),
      opp_rating_mean: +(list.map(g => g.ratings[g.opp]).filter(x => x != null).reduce((a, b, i, A) => a + b / A.length, 0)).toFixed(0),
      oe_ours: observedExpected(REF, list, 'mine'), oe_opponents: observedExpected(REF, list, 'theirs') };
  }
  res.humans = {};
  for (const [b, list] of Object.entries(H.sides)) if (list.length) res.humans[b] = Object.assign({ sides: list.length, rating_mean: +(list.reduce((a, x) => a + x.rating, 0) / list.length || 0).toFixed(0) }, H_split(list));

  /* the strata, summed over species and moves: the human per-opportunity rates by speed order x turn, and by turn x HP;
   * and the same opportunity rates for the bot and its opponents, from their own detail rows */
  const strataSummary = S => {
    const sc = {}, sw = {};
    for (const [k, c] of S.sc) { const [, , rel, t] = k.split('|'); if (rel === '*' || t === '*') continue; const kk = rel + '|' + t; (sc[kk] = sc[kk] || { n: 0, k: 0 }); sc[kk].n += c.n; sc[kk].k += c.k; }
    for (const [k, c] of S.sw) { const [, t, h] = k.split('|'); if (t === '*' || h === '*') continue; const kk = t + '|' + h; (sw[kk] = sw[kk] || { n: 0, k: 0 }); sw[kk].n += c.n; sw[kk].k += c.k; }
    const fin = o => Object.fromEntries(Object.entries(o).sort().map(([k, c]) => [k, rate(c.k, c.n)]));
    return { speed_use_per_opportunity: fin(sc), switch_out_per_body_turn: fin(sw) };
  };
  res.strata = {};
  for (const b of ['1400+', '1200-1399', '<1200']) if (REF[b].sc.size) res.strata['humans ' + b] = strataSummary(REF[b]);
  for (const [k, list] of Object.entries(groups)) for (const who of ['mine', 'theirs']) {
    if (!list.length) continue;
    const S = strata(); for (const g of list) addDetail(S, g.detail, who === 'mine' ? g.me : g.opp);
    res.strata[k + (who === 'mine' ? ' ours' : ' opponents')] = strataSummary(S);
  }

  /* the table check, bot_search only */
  const TC = { decisions: 0, decoded: 0, agree: 0, disagree: 0, no_rows: 0, cases: [] };
  for (const g of groups.bot_search) { const t = tableCheck(g, REF); for (const k of ['decisions', 'decoded', 'agree', 'disagree', 'no_rows']) TC[k] += t[k] || 0; TC.cases.push(...t.cases); }
  const agg = kind => {
    const C = TC.cases.filter(c => c.kind === kind);
    const inT = C.filter(c => c.in_table);
    return { n: C.length, in_table: inT.length, absent: C.length - inT.length, mix_on_option_mean: inT.length ? +(inT.reduce((s, c) => s + c.mix_on_option, 0) / inT.length).toFixed(3) : null,
      option_row_mean_minus_chosen: inT.length ? +(inT.reduce((s, c) => s + ((c.best_option_row_mean || 0) - (c.chosen_row_mean || 0)), 0) / inT.length).toFixed(3) : null,
      in_lost: C.filter(c => !c.won).length, in_table_lost: inT.filter(c => !c.won).length };
  };
  const SWR = TC.cases.filter(c => c.kind === 'switch_row');
  const hiSw = SWR.filter(c => c.human_p_max >= 0.25);
  res.table_check = { decisions: TC.decisions, decisions_without_rows: TC.no_rows, decode: { checked: TC.decoded, agree: TC.agree, disagree: TC.disagree },
    speed_not_used_when_foe_faster: agg('speed_not_used_when_foe_faster'),
    speed_not_used_human_often: (() => { const C = TC.cases.filter(c => c.kind === 'speed_not_used_when_foe_faster' && c.human_p >= 0.3); return { n: C.length, in_table: C.filter(c => c.in_table).length }; })(),
    mega_not_taken: agg('mega_not_taken'),
    switch: { decisions: SWR.length, chose_switch: SWR.filter(c => c.chose_switch).length, switch_row_in_table: SWR.filter(c => c.in_table).length,
      mix_on_switch_mean: SWR.length ? +(SWR.reduce((s, c) => s + c.mix_on_option, 0) / SWR.length).toFixed(3) : null,
      human_often_switch_turns: hiSw.length, human_often_switch_bot_switched: hiSw.filter(c => c.chose_switch).length, human_often_switch_row_in_table: hiSw.filter(c => c.in_table).length,
      human_often_switch_row_absent: hiSw.filter(c => !c.in_table).length },
    cases_sample: { speed: TC.cases.filter(c => c.kind === 'speed_not_used_when_foe_faster').slice(0, 40), mega: TC.cases.filter(c => c.kind === 'mega_not_taken').slice(0, 40),
      switch_human_often: hiSw.filter(c => !c.chose_switch).slice(0, 40) } };

  /* does it cost games: bot_search games, and the 1400+ humans for context */
  const B = groups.bot_search.map(g => ({ won: g.won, m: g.mine, o: g.theirs }));
  const HS = b => (H.sides[b] || []).map(x => ({ won: x.won, m: x.t, o: x.foe }));
  const cost = (L, withOpp) => [
    costTable(L, x => x.m.speed.used > 0, 'used speed control'),
    costTable(L, x => x.m.speed.mattered > 0, 'used speed control while the foe was faster'),
    withOpp ? costTable(L, x => x.o.speed.used > 0, 'the opponent used speed control') : null,
    withOpp ? costTable(L, x => x.o.speed.mattered > 0, 'the opponent used speed control while we were faster') : null,
    withOpp ? costTable(L, x => x.o.speed.by_class && (x.o.speed.by_class.trickroom || x.o.speed.by_class.tailwind), 'the opponent set Trick Room or Tailwind') : null,
    costTable(L, x => x.m.speed.foe_tr_turns > 0 || x.m.speed.foe_tw_turns > 0, 'faced the foe\'s Trick Room or Tailwind'),
    costTable(L.filter(x => x.m.mega.capable_turn != null), x => !!x.m.mega.megaed, 'capable sides: megaed'),
    costTable(L, x => x.m.switch.voluntary > 0, 'switched voluntarily at least once'),
    costTable(L, x => x.m.switch.into_ko > 0, 'a voluntary switch-in was KO\'d that turn'),
    costTable(L, x => x.m.switch.into_resist_or_immune > 0, 'a voluntary switch-in took only resisted/immune hits'),
  ].filter(Boolean);
  res.costs = { bot_search: cost(B, true), bot_prior: cost(groups.bot_prior.map(g => ({ won: g.won, m: g.mine, o: g.theirs })), true),
    humans_1400: cost(HS('1400+'), true), humans_1200_1399: cost(HS('1200-1399'), true), humans_under_1200: cost(HS('<1200'), true) };

  /* examples: bot_search */
  const ex = [];
  for (const g of groups.bot_search) {
    for (const u of g.mine.speed.uses) if (u.eval === 'wasted' || u.eval === 'redundant') ex.push({ kind: 'speed_' + u.eval, url: g.url, turn: u.turn, won: g.won, what: u.user + ' ' + u.move });
    for (const e of g.mine.switch.events) if (e.outcome === 'ko' || e.outcome === 'resist_or_immune') ex.push({ kind: 'switch_into_' + e.outcome, url: g.url, turn: e.turn, won: g.won, what: e.out + ' -> ' + e.in + ' (slot ' + e.slot + ')' });
    for (const u of g.theirs.speed.uses) if ((u.cls === 'trickroom' || u.cls === 'tailwind') && u.eval === 'mattered') ex.push({ kind: 'opp_' + u.cls + '_mattered', url: g.url, turn: u.turn, won: g.won, what: u.user + ' ' + u.move });
    if (g.mine.mega.capable_turn != null && !g.mine.mega.megaed) ex.push({ kind: 'mega_never', url: g.url, turn: g.mine.mega.capable_turn, won: g.won, what: 'capable from turn ' + g.mine.mega.capable_turn });
  }
  res.examples = ex;
  res.per_game = OUR.games.map(g => ({ run: g.run, room: g.room, url: g.url, policy: g.policy, won: g.won, forfeit: g.forfeit, turns: g.turns, rating_me: g.ratings[g.me], rating_opp: g.ratings[g.opp],
    mine: { speed: { avail_turns: g.mine.speed.avail_turns, used: g.mine.speed.used, first_turn: g.mine.speed.first_turn, by_class: g.mine.speed.by_class, mattered: g.mine.speed.mattered, wasted: g.mine.speed.wasted, close: g.mine.speed.close, answers: g.mine.speed.answers, foe_tr_turns: g.mine.speed.foe_tr_turns, foe_tw_turns: g.mine.speed.foe_tw_turns },
      mega: g.mine.mega, switch: Object.assign({}, g.mine.switch, { events: undefined }) },
    opp: { speed: { used: g.theirs.speed.used, by_class: g.theirs.speed.by_class, mattered: g.theirs.speed.mattered }, mega: g.theirs.mega, switch: { voluntary: g.theirs.switch.voluntary, forced: g.theirs.switch.forced } } }));
  res.loss_postmortem_speed_control = (() => {
    try {
      const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'results', '2026-09-30-ladder-loss-postmortem', 'classifications.json'), 'utf8'));
      return C.losses.filter(l => l.class === 'SPEED_CONTROL').map(l => {
        const num = u => ((/regmcbo3-(\d+)/.exec(String(u || '')) || [])[1]); const g = OUR.games.find(x => num(x.url || x.room) && num(x.url || x.room) === num(l.replay));
        const dec = g ? g.decs.filter(d => d.kind === 'move' && d.info && d.info.table && d.turn <= l.tp_turn) : [];
        const sheet = g ? (() => { const m = new RegExp('^\\|showteam\\|' + g.me + '\\|(.*)$', 'm').exec(g.text); try { return m ? parseShowteam(m[1]) : []; } catch (e) { return []; } })() : [];
        return { n: l.n, replay: l.replay, tp_turn: l.tp_turn, note: l.note, found: !!g,
          our_speed_control_on_sheet_brought: g ? [...new Set(g.detail.filter(r => r.side === g.me && r.sc.length).map(r => r.sp + ':' + r.sc.join('/')))] : null,
          our_uses: g ? g.mine.speed.uses : null, opp_uses: g ? g.theirs.speed.uses : null,
          table_cols_with_opp_sc: dec.map(d => ({ turn: d.turn, cols: d.info.table.cols.filter(c => /trickroom|tailwind/.test(c)) })).filter(x => x.cols.length) };
      });
    } catch (e) { return { error: e.message }; }
  })();
  res.seconds = Math.round((Date.now() - t0) / 1000);
  res.human_cache = H.cache;
  /* the raw per-side lists (mega turn, mega delay, first speed-control turn) become histograms: the artifact is tracked */
  const hist = a => a.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {});
  const leanOut = (k, v) => (Array.isArray(v) && ['turns', 'delay', 'first_turns'].includes(k) && v.every(x => typeof x === 'number') ? hist(v) : v);
  fs.writeFileSync(OUT, JSON.stringify(res, leanOut, 1));

  /* the compact table */
  const pct = x => (x == null ? '   -  ' : ((100 * x).toFixed(1) + '%').padStart(6));
  const num = x => (x == null ? '  -  ' : String(x).padStart(5));
  const rowsOut = [];
  const add = (label, S) => rowsOut.push({ label, S });
  if (res.groups.bot_search) { add('bot (search arm)', res.groups.bot_search.ours.all); add('  its opponents', res.groups.bot_search.opponents.all); }
  if (res.groups.bot_prior) { add('bot (prior arm)', res.groups.bot_prior.ours.all); add('  its opponents', res.groups.bot_prior.opponents.all); }
  for (const b of ['1400+', '1200-1399', '<1200']) if (res.humans[b]) add('humans ' + b, res.humans[b].all);
  console.log('\n' + 'group'.padEnd(20) + ' games  SC avail  SC/game  SC/avail-turn  SC 1st t  mattered wasted  mega|cap  mega t  vol sw/g  vol sw/turn  forced/g  intoKO  res/imm');
  for (const { label, S } of rowsOut) {
    const R = S.rates;
    console.log(label.padEnd(20) + num(S.games) + ' ' + pct(R.speed_games_available) + '   ' + num(R.speed_used_per_game) + '   ' + num(R.speed_used_per_available_turn) + '        ' + num(R.speed_first_turn_p50) + '   ' + pct(R.speed_mattered_share) + ' ' + pct(R.speed_wasted_share)
      + '  ' + pct(R.mega_rate_when_capable) + '  ' + num(R.mega_turn_p50) + '    ' + num(R.switch_voluntary_per_game) + '      ' + num(R.switch_voluntary_per_turn) + '    ' + num(R.switch_forced_per_game) + '  ' + pct(R.switch_into_ko_share) + '  ' + pct(R.switch_into_resist_or_immune_share));
  }
  for (const k of ['bot_search', 'bot_prior']) if (res.groups[k]) console.log(k + ' O/E vs humans (like with like): ' + JSON.stringify({ ours: res.groups[k].oe_ours, opponents: res.groups[k].oe_opponents }));
  console.log('table check: ' + JSON.stringify(res.table_check, (k, v) => (k === 'cases_sample' ? undefined : v)));
  console.log('costs: ' + JSON.stringify(res.costs));
  console.log(`wrote ${OUT}  ${res.seconds}s`);
})();
