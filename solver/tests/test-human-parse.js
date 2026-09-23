/* solver/tests/test-human-parse.js — does the human-dataset parser reconstruct the joint action the
 * log actually shows?
 *
 *   node solver/tests/test-human-parse.js        exit 0 = GREEN, 1 = RED
 *
 * Three layers, all on REAL Reg M-C bo3 replays read from the tracked raw shards (dated shards are
 * written once and never grow, so the fixtures cannot move under the test):
 *
 *   1. PINNED TURNS — joint actions read off the raw log by hand for seven games that each exercise a
 *      hard case: Parting Shot, Round, a charge move whose target only appears on -anim, flinch, a faint
 *      replacement, Revival Blessing, Armor Tail blocking a priority move, nicknames absent from
 *      the open sheet, two megas on one turn, Emergency Exit, Instruct.
 *   2. ROUND TRIP — for every turn of every parsed game in two whole shards, an INDEPENDENT naive
 *      scan of the log (not the parser's state machine) lists the moves, cants, turn-start switches
 *      and faint replacements per side; the parser's decisions must reproduce that multiset exactly.
 *   3. INVARIANTS — targets are legal locs, a switch goes to a benched live mon, one mega per side.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const X = require('../human/dex.js');
const { parseGame } = require('../human/parse_game.js');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'data', 'raw', 'games.' + X.FORMAT);
const toID = X.toID;
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL ' + msg); } };

const shardCache = new Map();
function shard(f) {
  if (!shardCache.has(f)) {
    const rows = zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    shardCache.set(f, rows);
  }
  return shardCache.get(f);
}
const game = (f, n) => { const id = X.FORMAT + '-' + n; const r = shard(f).find(x => x.id === id); if (!r) throw new Error('fixture missing: ' + id); return parseGame(r); };
const act = (P, turn, sp) => P.turns.find(t => t.n === turn).actions[sp.slice(0, 2)][sp[2]];
const T = (P, turn) => P.turns.find(t => t.n === turn);
const sp = (P, side, i) => P.game.sheets[side][i].species;

// ---------------------------------------------------------------- 1. pinned turns
console.log('1. pinned turns');
{
  const P = game('20260923T0640-00.jsonl.gz', 2686254482);
  let a = act(P, 1, 'p1a'); ok(a.kind === 'move' && a.move === 'Follow Me' && a.target_loc === null, 't1 p1a Follow Me');
  a = act(P, 1, 'p1b'); ok(a.move === 'Shift Gear', 't1 p1b Shift Gear');
  a = act(P, 1, 'p2a'); ok(a.move === 'Protect', 't1 p2a Protect');
  a = act(P, 1, 'p2b'); ok(a.move === 'Parting Shot' && a.target === 'p1a' && a.target_loc === 1 && a.target_certain === false, 't1 p2b Parting Shot hit p1a (loc 1), UNCERTAIN: p1a used Follow Me first');
  ok(T(P, 1).midturn_switches.length === 1 && T(P, 1).midturn_switches[0].reason === 'Parting Shot' && sp(P, 'p2', T(P, 1).midturn_switches[0].to) === 'Politoed', 't1 Parting Shot brings Politoed');
  a = act(P, 2, 'p2b'); ok(a.kind === 'switch' && a.to_species === 'Incineroar', 't2 p2b switches Politoed -> Incineroar');
  a = act(P, 2, 'p2a'); ok(a.move === 'Electro Shot' && a.target === 'p1a' && a.target_loc === 1, 't2 p2a Electro Shot target filled from -anim');
  a = act(P, 3, 'p1b'); ok(a.kind === 'hidden' && a.reason === 'cant:flinch', 't3 p1b flinched (hidden)');
  a = act(P, 3, 'p2b'); ok(a.move === 'Fake Out' && a.target_loc === 2, 't3 p2b Fake Out -> p1b (loc 2)');
  ok(T(P, 3).replacements.length === 1 && T(P, 3).replacements[0].pos === 'a' && T(P, 3).replacements[0].to_species === 'Incineroar', 't3 p1a faint replacement Incineroar');
  a = act(P, 4, 'p2b'); ok(a.kind === 'switch' && a.to_species === 'Vivillon-Modern', 't4 p2b switches to Vivillon-Modern');
  ok(P.game.series && P.game.series.game === 1 && P.game.series.id === X.FORMAT + '-2686254480', 'series id + game number');
  ok(P.game.players.p1.rating === 1000 && P.game.players.p2.rating === 1197, 'ratings from |player|');
  ok(T(P, 2).state.weather && T(P, 2).state.weather.name === 'RainDance', 'state before t2 has rain');
  ok(T(P, 2).state.sides.p1.mons.find(m => m.species === 'Indeedee-F').boosts.atk === -2 && T(P, 2).state.sides.p1.mons.find(m => m.species === 'Indeedee-F').boosts.spa === -1, 'state before t2: Indeedee -2 atk (Intimidate + Parting Shot), -1 spa');
}
{
  const P = game('20260909T1850-00.jsonl.gz', 2678208236);           // Revival Blessing
  let a = act(P, 6, 'p1b'); ok(a.move === 'Revival Blessing', 't6 p1b Revival Blessing');
  a = act(P, 6, 'p1a'); ok(a.kind === 'hidden' && a.reason === 'fainted_before_acting', 't6 p1a Kingambit fainted before acting');
  a = act(P, 6, 'p2b'); ok(a.move === 'Fake Out' && a.target_loc === 1, 't6 p2b Fake Out -> p1a');
  ok(T(P, 6).revivals.length === 1 && T(P, 6).replacements.length === 1 && T(P, 6).replacements[0].to_species === 'Kingambit', 't6 revive then replacement Kingambit');
}
{
  const P = game('20260909T1850-00.jsonl.gz', 2678147857);           // Armor Tail blocks Grassy Glide
  let a = act(P, 7, 'p1b'); ok(a.move === 'Grassy Glide' && a.target === 'p2a' && a.target_loc === 1, 't7 p1b Grassy Glide target from cant [of]');
  a = act(P, 7, 'p2a'); ok(a.move === 'Trick Room', 't7 p2a Trick Room (the Armor Tail cant is not its action)');
  a = act(P, 7, 'p1a'); ok(a.move === 'Close Combat' && a.target_loc === 2, 't7 p1a Close Combat -> p2b');
}
{
  const P = game('20260909T1850-00.jsonl.gz', 2678194975);           // nicknames not on the sheet, two megas
  let a = act(P, 1, 'p1a'); ok(a.move === 'Flash Cannon' && a.mega === true && a.target_loc === 2, 't1 p1a mega + Flash Cannon -> p2b');
  a = act(P, 1, 'p2a'); ok(a.move === 'Calm Mind' && a.mega === true, 't1 p2a (nicknamed Floette) mega + Calm Mind');
  a = act(P, 1, 'p2b'); ok(a.move === 'Trick Room', 't1 p2b (nicknamed Farigiraf) Trick Room');
  ok(T(P, 2).state.pseudo['Trick Room'] === 1 && T(P, 2).state.sides.p2.mega_used, 'state before t2: Trick Room since t1, p2 mega used');
}
{
  const P = game('20260909T1850-00.jsonl.gz', 2678032599);           // Emergency Exit mid-turn
  let a = act(P, 1, 'p1b'); ok(a.kind === 'hidden' && a.reason === 'forced_out_before_acting', 't1 p1b Golisopod forced out by Emergency Exit');
  ok(T(P, 1).midturn_switches.some(m => m.reason === 'eject' && m.to_species === 'Torkoal'), 't1 Emergency Exit brings Torkoal');
  a = act(P, 1, 'p2b'); ok(a.move === 'Water Spout' && a.mega === true && a.target_loc === null, 't1 p2b mega + Water Spout (spread: no target)');
  a = act(P, 2, 'p1b'); ok(a.kind === 'switch' && a.to_species === 'Golisopod', 't2 p1b switches Torkoal -> Golisopod');
}
{
  const P = game('20260914T1237-00.jsonl.gz', 2680956077);           // Instruct
  let a = act(P, 3, 'p1a'); ok(a.move === 'Instruct' && a.target_loc === -2, 't3 p1a Instruct -> ally p1b (loc -2)');
  a = act(P, 3, 'p1b'); ok(a.move === 'Earth Power' && a.target_loc === 1, 't3 p1b Earth Power -> p2a');
  ok(T(P, 3).aux_moves.some(x => x.from === 'Instruct' && x.move === 'Earth Power'), 't3 the instructed repeat is auxiliary, not a second decision');
  a = act(P, 3, 'p2a'); ok(a.kind === 'hidden' && a.reason === 'fainted_before_acting', 't3 p2a Milotic fainted before acting');
}

{
  const P = game('20260917T0501-00.jsonl.gz', 2682676502);           // Round: the partner's Round prints [from] move: Round
  let a = act(P, 1, 'p2b'); ok(a.kind === 'move' && a.move === 'Round' && a.target_loc === 1, 't1 p2b Round ([from] move: Round) is its own decision');
  a = act(P, 1, 'p2a'); ok(a.move === 'Round', 't1 p2a Round');
  ok(T(P, 1).aux_moves.length === 0, 't1 no auxiliary moves');
}

// ---------------------------------------------------------------- 2. round trip vs an independent scan
console.log('2. round trip');
function scan(log) {
  /* Deliberately naive and separate from the parser: no mon state, only line shapes. */
  const L = log.split('\n'), out = {};
  let n = null, pre = true, acted = false, instructed = new Set(), ejected = new Set();
  const push = (turn, side, lab) => { ((out[turn] = out[turn] || { p1: [], p2: [] })[side]).push(lab); };
  const base = d => toID(X.species(d.split(',')[0]).baseSpecies);
  for (const line of L) {
    const p = line.split('|');
    if (p[1] === 'turn') { n = +p[2]; pre = true; acted = false; instructed = new Set(); ejected = new Set(); continue; }
    if (n == null) continue;
    if (p[1] === 'upkeep') { pre = false; continue; }
    const side = (p[2] || '').slice(0, 2), who = (p[2] || '').split(':')[0];
    const from = p.slice(4).find(x => x.startsWith('[from]'));
    if (p[1] === '-singleturn' && /Instruct/.test(p[3])) instructed.add(who);
    if ((p[1] === '-enditem' && /^(Eject Button|Eject Pack)$/.test(p[3]) && !p.slice(4).some(x => x.startsWith('[from]'))) || (p[1] === '-activate' && /Emergency Exit|Wimp Out/.test(p[3]))) ejected.add(who);
    if (p[1] === 'move' && pre) {
      acted = true;
      const f = p.slice(5).find(x => x.startsWith('[from]'));
      if (f && !/lockedmove/.test(f) && !(/move: Round/.test(f) && toID(p[3]) === 'round')) continue;
      if (instructed.has(who)) { instructed.delete(who); continue; }
      push(n, side, 'move:' + toID(p[3]));
    } else if (p[1] === 'cant' && pre) {
      acted = true;
      if (p.slice(4).some(x => x.startsWith('[of]'))) continue;
      push(n, side, p[4] ? 'cant-move:' + toID(p[4]) : 'cant:' + p[3].replace(/^(move|ability|item): /, ''));
    } else if (p[1] === 'switch' && !p.slice(5).some(x => x.startsWith('[from]'))) {
      if (ejected.has(who)) { ejected.delete(who); continue; }
      if (pre && !acted) push(n, side, 'switch@' + who.slice(2) + '>' + base(p[3]));
      else if (!pre) push(n, side, 'repl@' + who.slice(2) + '>' + base(p[3]));
    }
  }
  return out;
}
function labels(P) {
  const out = {};
  const base = s => toID(X.species(s).baseSpecies);
  for (const t of P.turns) {
    const o = out[t.n] = { p1: [], p2: [] };
    for (const s of ['p1', 'p2']) for (const pos of ['a', 'b']) {
      const a = t.actions[s][pos]; if (!a) continue;
      if (a.kind === 'move') o[s].push((a.executed ? 'move:' : 'cant-move:') + toID(a.move));
      else if (a.kind === 'locked') o[s].push(a.reason === 'recharge' ? 'cant:recharge' : 'move:' + toID(a.move));
      else if (a.kind === 'switch') o[s].push('switch@' + pos + '>' + base(a.to_species));
      else if (a.kind === 'hidden' && a.reason.startsWith('cant:')) o[s].push(a.reason);
    }
    for (const r of t.replacements) o[r.side].push('repl@' + r.pos + '>' + base(r.to_species));
  }
  return out;
}
const eq = (a, b) => JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());
let rtGames = 0, rtTurns = 0, rtSkipped = 0, rtShown = 0;
for (const f of ['20260909T1850-00.jsonl.gz', '20260923T0553-00.jsonl.gz']) {
  for (const r of shard(f)) {
    let P; try { P = parseGame(r); } catch (e) { rtSkipped++; continue; }   // exclusions are the builder's business
    if (['p1', 'p2'].some(s => P.game.sheets[s].some(m => toID(m.ability) === 'illusion'))) { rtSkipped++; continue; }
    rtGames++;
    const want = scan(r.log), got = labels(P);
    for (const n of new Set([...Object.keys(want), ...Object.keys(got)])) {
      rtTurns++;
      for (const s of ['p1', 'p2']) {
        const w = (want[n] || { p1: [], p2: [] })[s], g = (got[n] || { p1: [], p2: [] })[s];
        const good = eq(w, g);
        if (!good && rtShown++ < 10) console.log('    ' + r.id + ' t' + n + ' ' + s + ' log=' + JSON.stringify(w) + ' parsed=' + JSON.stringify(g));
        ok(good, 'round trip ' + r.id + ' t' + n + ' ' + s);
      }
    }
    // ---- 3. invariants
    let megas = { p1: 0, p2: 0 };
    for (const t of P.turns) for (const s of ['p1', 'p2']) for (const pos of ['a', 'b']) {
      const a = t.actions[s][pos]; if (!a) continue;
      if (a.mega) megas[s]++;
      if (a.kind === 'move' && a.target_loc != null) ok([1, 2, -1, -2].includes(a.target_loc), 'target loc legal ' + r.id);
      if (a.kind === 'switch') {
        const m = t.state.sides[s].mons[a.to];
        ok(!t.state.sides[s].active.includes(a.to) && !(m.seen && m.fnt), 'switch to a benched live mon ' + r.id + ' t' + t.n);
      }
    }
    ok(megas.p1 <= 1 && megas.p2 <= 1, 'at most one mega per side ' + r.id);
  }
}
console.log('   ' + rtGames + ' games, ' + rtTurns + ' turns compared; ' + rtSkipped + ' skipped (parse-excluded or Illusion)');
ok(rtGames >= 100, 'round trip covered at least 100 games');

console.log((fails ? 'RED' : 'GREEN') + ' — ' + (checks - fails) + '/' + checks + ' checks');
process.exit(fails ? 1 : 0);
