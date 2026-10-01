#!/usr/bin/env node
/**
 * The search's blind spots that no planned fix covers, the measured half (2026-10-01).
 * docs/_reports/2026-10-01-search-blind-spots.md.
 *
 * READ-ONLY over ROTOM's saved ladder games (solver/out/rotom/<run>/games/medicham32/*.{log,decisions.jsonl}). Plays
 * nothing and loads no engine: the Reg M-C dex (solver/human/dex.js) for move categories and the protect family only.
 *
 *   1. OPPONENT COVERAGE. For every move decision with a recorded payoff table, the opponent's ACTUAL joint action is read
 *      from that turn of the log (each slot's first own |move| or a |switch| before any move; a slot that never acted —
 *      fainted first, flinched, slept — is unknown and matches anything). It is compared with the searched columns at
 *      three strengths: MOVES (move ids or "switch", slot by slot — the post-mortem's measure), TARGETS (plus the target
 *      of a single-target move) and PER SLOT (each slot's action appears in some column, whatever the partner did).
 *      A miss is classed by the slot action no column held: switch / protect / status / attack, or target / combination.
 *      Our own chosen action against the rows is the control (it must be 100%: the choice is sampled from the rows).
 *   2. SUCKER PUNCH. Every decision whose chosen row clicks Sucker Punch (our move index mapped through our sheet's move
 *      order, checked against what the log shows we used). For each: the target slot's ACTUAL action and whether the
 *      Sucker Punch failed; the table's columns classed by what the target slot does in each; the equilibrium column mix
 *      re-solved from the recorded matrix (the search's own implied opponent), and the mass it puts on the target
 *      attacking; the chosen row's cell against the actual column when the table held it, beside the best other row.
 *   3. WORLD FIELDS. For each field docs/_reports/2026-09-30-rotom-world-fixes.md names as not carried, how often its
 *      protocol signature occurs, and at how many of our move decisions it was live. Plus the identity check: how many
 *      log idents do not name a sheet row by nickname (a forme or a nickname), which world_log.js could not key.
 *
 *   node solver/results/2026-10-01-search-blind-spots/blind_spots.js [--root <solver/out/rotom>] [--out <file>]
 */
'use strict';
const fs = require('fs'), path = require('path');
const X = require('../../human/dex.js');
const { parseShowteam } = require('../../human/parse_game.js');
const FAM = require('../../arena/protect_stats.js').family();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = arg('--root', path.join(__dirname, '..', '..', 'out', 'rotom'));
const OUT = arg('--out', path.join(__dirname, 'measured.json'));
const ME = 'medicham32';
const toID = X.toID;
const mv = id => { const m = X.D.moves.get(toID(id)); return m && m.exists ? m : null; };
const SINGLE = new Set(['normal', 'any', 'adjacentFoe', 'adjacentAlly', 'adjacentAllyOrSelf']);
const actClass = a => !a ? 'unknown' : a.kind === 'switch' ? 'switch' : FAM.has(a.move) ? 'protect'
  : (mv(a.move) && mv(a.move).category === 'Status') ? 'status' : 'attack';

/* ---------- the log ---------- */
function baseOf(sp) { const s = X.D.species.get(toID(sp)); return s && s.exists ? s.baseSpecies : sp; }
function parseLog(txt) {
  const L = txt.replace(/\r/g, '').split('\n');
  const sheets = {}; let me = null, winner = null, forfeit = false;
  for (const l of L) {
    const p = l.split('|');
    if (p[1] === 'showteam') sheets[p[2]] = parseShowteam(p.slice(3).join('|'));
    if (p[1] === 'player' && p[3] === ME) me = p[2];
    if (p[1] === 'win') winner = p[2];
    if (p[1] === '-message' && /forfeited/.test(l)) forfeit = true;
  }
  /* identity: exact nickname, else the species / base species the switch line prints (a forme, a nickname) */
  const alias = { p1: {}, p2: {} }; const idStats = { idents: 0, byNick: 0, byAlias: 0, unmatched: 0, names: {} };
  const rowOf = (side, nick, details) => {
    const sh = sheets[side] || [];
    let i = sh.findIndex(r => r.nick === nick);
    if (i >= 0) return i;
    if (alias[side][nick] != null) return alias[side][nick];
    if (details) {
      const sp = String(details).split(',')[0].trim();
      const c = sh.map((r, k) => k).filter(k => sh[k].species === sp || baseOf(sh[k].species) === baseOf(sp));
      if (c.length === 1) { alias[side][nick] = c[0]; return c[0]; }
    }
    return -1;
  };
  const turns = {}; let turn = 0, post = false, sawMove = false;
  const pos = { p1a: null, p1b: null, p2a: null, p2b: null };
  const startPos = {};
  for (let li = 0; li < L.length; li++) {
    const l = L[li], p = l.split('|');
    const id = /^(p[12])([ab]):\s?(.*)$/.exec(p[2] || '');
    if (p[1] === 'turn') { turn = +p[2]; turns[turn] = { p1: {}, p2: {}, mega: { p1: {}, p2: {} }, start: Object.assign({}, pos), lines: [] }; post = false; sawMove = false; continue; }
    if (!turns[turn]) turns[turn] = { p1: {}, p2: {}, mega: { p1: {}, p2: {} }, start: Object.assign({}, pos), lines: [] };
    const T = turns[turn]; T.lines.push(li);
    if (p[1] === 'upkeep') post = true;
    if ((p[1] === 'switch' || p[1] === 'drag') && id) {
      idStats.idents++;
      const sh = sheets[id[1]] || [];
      const exact = sh.findIndex(r => r.nick === id[3]);
      const r = rowOf(id[1], id[3], p[3]);
      if (exact >= 0) idStats.byNick++; else if (r >= 0) { idStats.byAlias++; idStats.names[id[3] + ' -> ' + sh[r].species] = (idStats.names[id[3] + ' -> ' + sh[r].species] || 0) + 1; } else idStats.unmatched++;
      if (turn > 0 && !post && !sawMove && p[1] === 'switch' && !(id[2] in T[id[1]])) T[id[1]][id[2]] = { kind: 'switch', to: r };
      pos[id[1] + id[2]] = r;
    }
    if (p[1] === 'detailschange' && id && /-Mega/.test(p[3] || '') && !post) T.mega[id[1]][id[2]] = true;
    if (p[1] === 'move' && id && !post) {
      sawMove = true;
      const from = p.find(x => x.startsWith('[from]'));
      if (from && !/lockedmove/.test(from)) continue;
      if (id[2] in T[id[1]]) continue;
      const m = mv(p[3]);
      const tg = /^(p[12])([ab]):/.exec(p[4] || '');
      let target = null;
      if (tg && m && SINGLE.has(m.target)) target = tg[1] === id[1] ? -(tg[2] === 'a' ? 1 : 2) : (tg[2] === 'a' ? 1 : 2);
      const nx = L[li + 1] || '';
      T[id[1]][id[2]] = { kind: 'move', move: m ? m.id : toID(p[3]), target, line: li,
        failed: /^\|-fail\|/.test(nx) || /\[notarget\]|\[miss\]/.test(l) || /^\|-notarget/.test(nx) };
    }
    if (p[1] === 'cant' && id && !post && !(id[2] in T[id[1]])) T[id[1]][id[2]] = { kind: 'cant', why: p[3] };
  }
  return { L, sheets, me, won: winner === ME, forfeit, turns, idStats };
}

/* ---------- labels ---------- */
/* engine label (columns): "kowtowcleave 1, switch 2", "protect, protect", "move 3 1 mega" never (engine labels use ids) */
function parseEngLabel(s) {
  return String(s).split(',').map(x => x.trim()).map(x => {
    if (!x || x === '-' || x === 'pass') return null;
    const t = x.split(/\s+/);
    if (t[0] === 'switch') return { kind: 'switch', to: +t[1] };
    return { kind: 'move', move: t[0], target: t[1] != null && /^-?\d+$/.test(t[1]) ? +t[1] : null, mega: t.includes('mega') };
  });
}
/* request label (rows, our choice): "move 1 1, switch 3", "move 3 1 mega" -> move index (1-based) and target */
function parseReqLabel(s) {
  return String(s).split(',').map(x => x.trim()).map(x => {
    const t = x.split(/\s+/);
    if (t[0] === 'switch') return { kind: 'switch', to: +t[1] };
    if (t[0] === 'move') return { kind: 'move', idx: +t[1], target: t[2] != null && /^-?\d+$/.test(t[2]) ? +t[2] : null, mega: t.includes('mega') };
    return null;
  });
}

/* ---------- the column's minimax mix (the opponent's side of the recorded zero-sum table) ---------- */
function colMix(A, iters = 20000) {
  const m = A.length, n = A[0].length;
  const rx = new Array(m).fill(0), ry = new Array(n).fill(0), sx = new Array(m).fill(0), sy = new Array(n).fill(0);
  for (let t = 1; t <= iters; t++) {
    const px = rx.map(v => Math.max(v, 0)), py = ry.map(v => Math.max(v, 0));
    const zx = px.reduce((a, b) => a + b, 0), zy = py.reduce((a, b) => a + b, 0);
    const x = zx > 0 ? px.map(v => v / zx) : new Array(m).fill(1 / m), y = zy > 0 ? py.map(v => v / zy) : new Array(n).fill(1 / n);
    const u = A.map(r => r.reduce((s, v, j) => s + v * y[j], 0)), ev = u.reduce((s, v, i) => s + v * x[i], 0);
    const w = A[0].map((_, j) => A.reduce((s, r, i) => s + r[j] * x[i], 0));
    for (let i = 0; i < m; i++) { rx[i] = Math.max(0, rx[i] + u[i] - ev); sx[i] += t * x[i]; }
    for (let j = 0; j < n; j++) { ry[j] = Math.max(0, ry[j] + ev - w[j]); sy[j] += t * y[j]; }
  }
  const Z = sy.reduce((a, b) => a + b, 0);
  return sy.map(v => v / Z);
}

/* ---------- the walk ---------- */
const res = { generated_by: 'solver/results/2026-10-01-search-blind-spots/blind_spots.js', root: 'solver/out/rotom (main checkout)', runs: {} };
/* THE SAMPLE IS FIXED, NOT 'whatever is on disk': the finished ladder runs as of 2026-10-01 04:39Z. A run that is still
 * being written (chomptop-2026-10-01T04-18-07-546Z was live then) is never read — a torn read is a plausible wrong answer. */
const RUNS_FIXED = ['aa1-2026-09-25T21-00-29-440Z', 'aa2-2026-09-25T23-54-09-059Z', 'chomp1-2026-09-29T23-13-11-521Z', 'gen5ab-2026-09-26T04-06-53-848Z',
  'run-2026-09-25T02-57-27-132Z', 'run-2026-09-25T03-17-19-472Z', 'run-2026-09-25T20-59-15-353Z', 'run-2026-09-25T23-20-18-156Z', 'run-2026-09-26T04-03-20-316Z'];
const runs = RUNS_FIXED.filter(r => fs.existsSync(path.join(ROOT, r, 'games', ME)));
const COV = { decisions: 0, unknown_opp: 0, moves: 0, targets: 0, per_slot: 0, by_turn: {}, miss_moves: {}, miss_targets: {}, slot_miss_class: {}, mega_disagree: 0,
              our_choice_in_rows: 0, our_choice_n: 0, our_map_checked: 0, our_map_agree: 0, by_result: { won: [0, 0], lost: [0, 0] },
              slot_rows_n: 0, slot_rows_one_move: 0, slot_cols_n: 0, slot_cols_one_move: 0 };
const SP = [];
const FIELDS = {};
const ID = { idents: 0, byNick: 0, byAlias: 0, unmatched: 0, games_with_alias: 0, games: 0, names: {} };
const bump = (o, k, by = 1) => { o[k] = (o[k] || 0) + by; };
const opponentOf = s => s === 'p1' ? 'p2' : 'p1';

for (const run of runs) {
  const dir = path.join(ROOT, run, 'games', ME);
  const R = res.runs[run] = { games: 0, move_decisions: 0, tabled: 0 };
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.log'))) {
    const room = f.replace(/\.log$/, '');
    const g = parseLog(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!g.me) continue;
    R.games++; ID.games++;
    for (const k of ['idents', 'byNick', 'byAlias', 'unmatched']) ID[k] += g.idStats[k];
    if (g.idStats.byAlias) ID.games_with_alias++;
    for (const [k, v] of Object.entries(g.idStats.names)) bump(ID.names, k, v);
    const op = opponentOf(g.me);
    const df = path.join(dir, room + '.decisions.jsonl');
    const ds = fs.existsSync(df) ? fs.readFileSync(df, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
    /* the field signatures, counted per game and per our move decision while live */
    fieldCount(g, ds, run + '/' + room);
    for (const d of ds) {
      if (d.kind !== 'move') continue;
      R.move_decisions++;
      const t = d.info && d.info.table;
      if (!t || !t.cols || !t.rows || !t.A) continue;
      R.tabled++;
      const T = g.turns[d.turn]; if (!T) continue;
      /* control: our choice is one of the rows */
      COV.our_choice_n++; if (t.rows.includes(d.choice)) COV.our_choice_in_rows++;
      /* our move-index mapping, checked against what the log shows we used */
      const ours = parseReqLabel(d.choice);
      const ourMoves = ['a', 'b'].map((s, k) => {
        const o = ours[k]; const row = T.start[g.me + s];
        if (!o || o.kind !== 'move' || row == null || row < 0) return null;
        return toID((g.sheets[g.me][row].moves || [])[o.idx - 1] || '');
      });
      ['a', 'b'].forEach((s, k) => { const a = T[g.me][s]; if (ourMoves[k] && a && a.kind === 'move') { COV.our_map_checked++; if (a.move === ourMoves[k]) COV.our_map_agree++; } });
      /* the opponent's actual joint */
      const opp = ['a', 'b'].map(s => { const a = T[op][s]; return a && (a.kind === 'move' || a.kind === 'switch') ? a : null; });
      if (!opp[0] && !opp[1]) { COV.unknown_opp++; continue; }
      COV.decisions++;
      const cols = t.cols.map(parseEngLabel);
      const slotEq = (c, a, withTarget) => {
        if (!a) return true;                                  // unknown: matches anything
        if (!c) return false;
        if (a.kind !== c.kind) return false;
        if (a.kind === 'switch') return true;                 // the switch's identity is not compared (engine team index)
        if (toID(c.move) !== a.move) return false;
        if (withTarget && a.target != null && c.target != null && a.target !== c.target) return false;
        return true;
      };
      const hit = w => cols.some(c => slotEq(c[0], opp[0], w) && slotEq(c[1], opp[1], w));
      const mHit = hit(false), tHit = hit(true);
      const slotHit = [0, 1].map(k => !opp[k] || cols.some(c => slotEq(c[k], opp[k], true)));
      const slotHitM = [0, 1].map(k => !opp[k] || cols.some(c => slotEq(c[k], opp[k], false)));
      const ps = slotHit[0] && slotHit[1];
      if (mHit) COV.moves++; if (tHit) COV.targets++; if (ps) COV.per_slot++;
      const tb = d.turn >= 5 ? '5+' : String(d.turn);
      const B = COV.by_turn[tb] = COV.by_turn[tb] || { n: 0, moves: 0, targets: 0 };
      B.n++; if (mHit) B.moves++; if (tHit) B.targets++;
      const rk = g.won ? 'won' : 'lost'; COV.by_result[rk][1]++; if (tHit) COV.by_result[rk][0]++;
      /* why the miss (target-aware) */
      if (!tHit) {
        let why;
        if (mHit) why = 'target';
        else if (!(slotHitM[0] && slotHitM[1])) {
          const missed = [0, 1].filter(k => !slotHitM[k]).map(k => actClass(opp[k]));
          why = missed.length === 2 ? 'both:' + missed.sort().join('+') : missed[0];
          for (const k of [0, 1]) if (!slotHitM[k]) bump(COV.slot_miss_class, actClass(opp[k]));
        } else why = 'combination';
        bump(COV.miss_targets, why);
      }
      if (!mHit) {
        let why;
        if (!(slotHitM[0] && slotHitM[1])) { const missed = [0, 1].filter(k => !slotHitM[k]).map(k => actClass(opp[k])); why = missed.length === 2 ? 'both:' + missed.sort().join('+') : missed[0]; }
        else why = 'combination';
        bump(COV.miss_moves, why);
      }
      /* mega: the column carrying the actual moves says mega where the opponent did not, or the reverse */
      const megaNow = !!(T.mega[op].a || T.mega[op].b);
      const mc = cols.find(c => slotEq(c[0], opp[0], true) && slotEq(c[1], opp[1], true));
      if (mc && megaNow !== mc.some(x => x && x.mega)) COV.mega_disagree++;

      /* ---------- SUCKER PUNCH ---------- */
      const rows = t.rows.map(parseReqLabel);
      /* SLOT COLLAPSE: the distinct non-switch actions a slot has across the searched rows (ours) and columns (theirs).
       * One means the table never asked what else that body could do (the reserved switch aside). */
      const nonSw = (list, k, key) => new Set(list.map(r => r[k]).filter(o => o && o.kind === 'move').map(key)).size;
      for (const k of [0, 1]) {
        const rowKinds = nonSw(rows, k, o => o.idx + ' ' + o.target), colKinds = nonSw(cols, k, o => o.move + ' ' + o.target);
        const rowMoves = nonSw(rows, k, o => o.idx), colMoves = nonSw(cols, k, o => toID(o.move));
        if (rows.some(r => r[k] && r[k].kind === 'move')) { COV.slot_rows_n++; if (rowMoves === 1) COV.slot_rows_one_move++; }
        if (cols.some(c => c[k] && c[k].kind === 'move')) { COV.slot_cols_n++; if (colMoves === 1) COV.slot_cols_one_move++; }
        void rowKinds; void colKinds;
      }
      const isSP = (rw, k) => { const o = rw[k]; const row = T.start[g.me + 'ab'[k]]; return o && o.kind === 'move' && row != null && row >= 0 && toID((g.sheets[g.me][row].moves || [])[o.idx - 1]) === 'suckerpunch'; };
      for (const k of [0, 1]) {
        if (!isSP(ours, k)) continue;
        const tgt = ours[k].target;               // 1 = their a, 2 = their b
        const ts = tgt === 2 ? 'b' : 'a';
        const tk = ts === 'a' ? 0 : 1;
        const actual = T[op][ts] || null;
        const mine = T[g.me]['ab'[k]];
        const used = mine && mine.kind === 'move' && mine.move === 'suckerpunch';
        const y = colMix(t.A);
        const ccls = cols.map(c => actClass(c[tk]));
        const pAttack = ccls.reduce((s, c, j) => s + (c === 'attack' ? y[j] : 0), 0);
        const ri = t.rows.indexOf(d.choice);
        const actualCol = cols.findIndex(c => slotEq(c[0], opp[0], true) && slotEq(c[1], opp[1], true));
        let cell = null;
        if (actualCol >= 0 && ri >= 0) {
          const colv = t.A.map(r => r[actualCol]);
          const others = colv.filter((_, i) => !isSP(rows[i], k));
          cell = { chosen: colv[ri], best_other_row: others.length ? Math.max(...others) : null, sp_rows: rows.filter(r => isSP(r, k)).length };
        }
        /* the SP user's alternatives in the searched rows: every row's action for that slot */
        const alts = rows.map(r => r[k]).map(o => !o ? 'none' : o.kind === 'switch' ? 'switch' : isSP([o, o], 0) || isSP([o, o], 1) ? 'suckerpunch' : 'other');
        const slotAlts = rows.map(r => { const o = r[k]; if (!o) return 'none'; if (o.kind === 'switch') return 'switch'; const row = T.start[g.me + 'ab'[k]]; return toID((g.sheets[g.me][row].moves || [])[o.idx - 1]); });
        void alts;
        SP.push({ run, room, game: d.gnum, turn: d.turn, won: g.won, forfeit: g.forfeit, slot: 'ab'[k], target_slot: ts,
          executed: used, failed: used ? !!mine.failed : null,
          target_actual: actual ? (actual.kind === 'move' ? actual.move : actual.kind === 'switch' ? 'switch' : actual.kind + ':' + (actual.why || '')) : 'none',
          target_class: actual && (actual.kind === 'move' || actual.kind === 'switch') ? actClass(actual) : 'unknown',
          cols: t.cols, col_target_class: ccls, col_mix: y.map(v => +v.toFixed(3)), p_target_attacks_table: +pAttack.toFixed(3),
          table_has_non_attack_target_col: ccls.some(c => c !== 'attack'),
          actual_joint_in_table: actualCol >= 0, actual_target_action_in_table: !actual || cols.some(c => slotEq(c[tk], actual.kind === 'cant' ? null : actual, false)),
          row_mix: t.mix, value: t.value, cell, sp_slot_row_actions: slotAlts,
          sp_slot_rows_only_sp_or_switch: slotAlts.every(a => a === 'suckerpunch' || a === 'switch' || a === 'none') });
      }
    }
  }
}

function fieldCount(g, ds, run) {
  const moveTurns = new Set(ds.filter(d => d.kind === 'move').map(d => d.turn));
  const F = (k) => FIELDS[k] = FIELDS[k] || { events: 0, games: new Set(), live_decisions: 0 };
  const hitAt = (k, li) => { const e = F(k); e.events++; e.games.add(run); return li; };
  /* live windows, per field: from the event's line to the end of the state, counted at our move decisions after it */
  const liveFrom = {};   // key -> [turn set, turn ended]
  let turn = 0; const L = g.L;
  const turnOfLine = []; for (let i = 0; i < L.length; i++) { if (L[i].startsWith('|turn|')) turn = +L[i].split('|')[2]; turnOfLine[i] = turn; }
  const open = (k, who, li) => { (liveFrom[k] = liveFrom[k] || []).push({ who, from: turnOfLine[li] + 1, to: Infinity }); };
  const close = (k, who, li) => { for (const w of liveFrom[k] || []) if (w.to === Infinity && (who == null || w.who === who)) w.to = turnOfLine[li]; };
  const abOf = {}; for (const s of ['p1', 'p2']) for (const r of g.sheets[s] || []) abOf[s + ':' + r.nick] = toID(r.ability);
  const active = {};
  for (let li = 0; li < L.length; li++) {
    const l = L[li], p = l.split('|');
    const id = /^(p[12])([ab]):\s?(.*)$/.exec(p[2] || '');
    const who = id ? id[1] + id[2] : null;
    if ((p[1] === 'switch' || p[1] === 'drag' || p[1] === 'faint') && who) { for (const k of Object.keys(liveFrom)) if (k !== 'wish') close(k, who, li); active[who] = p[1] === 'faint' ? null : String(p[3] || '').split(',')[0]; }
    if (p[1] === '-start' && /\|typeadd\||\|typechange\|/.test(l)) { hitAt('types', li); open('types', who, li); }
    if (p[1] === '-enditem' && /\[eat\]/.test(l)) { hitAt('ate_berry', li); }
    if (p[1] === '-enditem') {
      hitAt('last_item', li);
      /* Unburden: the holder's sheet ability (by nickname or species) is Unburden */
      const s = id && (g.sheets[id[1]] || []).find(r => r.nick === id[3] || baseOf(r.species) === baseOf(id[3]));
      if (s && toID(s.ability) === 'unburden') { hitAt('unburden', li); open('unburden', who, li); }
    }
    if (p[1] === '-prepare') {
      /* a two-turn charge that is still charging at the next decision: the move does not resolve in the same turn */
      let fired = false; for (let j = li + 1; j < L.length && !L[j].startsWith('|turn|'); j++) if (/^\|-anim\||^\|move\|/.test(L[j]) && L[j].includes(p[3])) { fired = true; break; }
      hitAt('charging_any', li); if (!fired) { hitAt('charging', li); open('charging', who, li); }
    }
    if (p[1] === 'move' && /\[from\]lockedmove/.test(l)) hitAt('lockedmove', li);
    if (p[1] === '-start' && /Uproar/.test(l)) hitAt('uproar', li);
    if (p[1] === '-mustrecharge' || (p[1] === 'cant' && p[3] === 'recharge')) hitAt('mustrecharge', li);
    if (p[1] === '-start' && /ability: Flash Fire/.test(l)) { hitAt('flashfire', li); open('flashfire', who, li); }
    if (p[1] === 'move' && p[3] === 'Ally Switch') hitAt('allyswitch', li);
    if (p[1] === 'move' && (p[3] === 'Wish')) { hitAt('wish', li); (liveFrom.wish = liveFrom.wish || []).push({ who, from: turnOfLine[li] + 1, to: turnOfLine[li] + 1 }); }
    if (p[1] === 'move' && (p[3] === 'Healing Wish' || p[3] === 'Lunar Dance')) hitAt('healingwish', li);
    if (p[1] === '-start' && /\|Curse\|/.test(l)) hitAt('curse', li);
    if (p[1] === '-start' && /\|Attract/.test(l)) { hitAt('attract', li); open('attract', who, li); }
    if (p[1] === '-end' && /\|Attract/.test(l)) close('attract', who, li);
    if (p[1] === '-transform') hitAt('transform', li);
    if (p[1] === '-item' && /Metronome/.test(l)) hitAt('metronome', li);
  }
  for (const [k, ws] of Object.entries(liveFrom)) for (const w of ws) for (const t of moveTurns) if (t >= w.from && t <= w.to) F(k).live_decisions++;
}

const r3 = v => +v.toFixed(3);
res.coverage = {
  decisions_with_table_and_observed_opponent: COV.decisions, decisions_opponent_unobserved: COV.unknown_opp,
  moves: { hit: COV.moves, rate: r3(COV.moves / COV.decisions) }, targets: { hit: COV.targets, rate: r3(COV.targets / COV.decisions) },
  per_slot: { hit: COV.per_slot, rate: r3(COV.per_slot / COV.decisions) },
  by_turn: Object.fromEntries(Object.entries(COV.by_turn).map(([k, b]) => [k, { n: b.n, moves: r3(b.moves / b.n), targets: r3(b.targets / b.n) }])),
  by_result_targets: Object.fromEntries(Object.entries(COV.by_result).map(([k, [h, n]]) => [k, { hit: h, n, rate: r3(h / n) }])),
  miss_targets_by_cause: COV.miss_targets, miss_moves_by_cause: COV.miss_moves, slots_missed_by_class: COV.slot_miss_class,
  mega_flag_disagrees_on_matched_column: COV.mega_disagree,
  slot_collapse: { our_rows: { slots: COV.slot_rows_n, one_move_only: COV.slot_rows_one_move, rate: r3(COV.slot_rows_one_move / COV.slot_rows_n) },
                   their_cols: { slots: COV.slot_cols_n, one_move_only: COV.slot_cols_one_move, rate: r3(COV.slot_cols_one_move / COV.slot_cols_n) } },
  control_our_choice_in_rows: { hit: COV.our_choice_in_rows, n: COV.our_choice_n },
  control_our_move_index_mapping: { agree: COV.our_map_agree, checked: COV.our_map_checked },
};
const spE = SP.filter(s => s.executed);
const grp = f => { const S = spE.filter(f); return { n: S.length, failed: S.filter(s => s.failed).length,
  mean_p_attack_table: S.length ? r3(S.reduce((a, s) => a + s.p_target_attacks_table, 0) / S.length) : null,
  actual_target_attacked: S.filter(s => s.target_class === 'attack').length,
  table_had_non_attack_col: S.filter(s => s.table_has_non_attack_target_col).length,
  actual_target_action_in_table: S.filter(s => s.actual_target_action_in_table).length,
  actual_joint_in_table: S.filter(s => s.actual_joint_in_table).length,
  rows_offered_sp_user_only_sp_or_switch: S.filter(s => s.sp_slot_rows_only_sp_or_switch).length }; };
res.sucker_punch = {
  decisions_choosing_sp: SP.length, executed: spE.length,
  all: grp(() => true), failed: grp(s => s.failed), succeeded: grp(s => !s.failed),
  in_lost_games: grp(s => !s.won), in_won_games: grp(s => s.won),
  failed_by_target_action: spE.filter(s => s.failed).reduce((o, s) => (bump(o, s.target_class + ':' + s.target_actual), o), {}),
  succeeded_by_target_action: spE.filter(s => !s.failed).reduce((o, s) => (bump(o, s.target_class + ':' + s.target_actual), o), {}),
  failed_with_actual_column_in_table_cells: spE.filter(s => s.failed && s.cell).map(s => ({ room: s.room, turn: s.turn, target: s.target_actual, chosen: s.cell.chosen, best_other_row: s.cell.best_other_row, p_attack: s.p_target_attacks_table, value: s.value })),
  rows: SP,
};
res.world_fields = Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, { events: v.events, games: v.games.size, live_at_our_move_decisions: v.live_decisions }]));
res.identity = ID;
fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify({ coverage: res.coverage, sp: Object.assign({}, res.sucker_punch, { rows: undefined, failed_with_actual_column_in_table_cells: undefined }), world_fields: res.world_fields,
  identity: Object.assign({}, ID, { names: Object.entries(ID.names).sort((a, b) => b[1] - a[1]).slice(0, 12) }) }, null, 1));
console.log('wrote', OUT);
