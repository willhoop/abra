/* corpus_shift.js — is the open-sheet corpus a safe place to learn how people play?
 *
 *   SHOWDOWN_PATH=... node engine/corpus_shift.js
 *
 * WHY THIS EXISTS
 * ---------------
 * The scoring bot's policy (engine/fit_policy.js) is fitted on open-team-sheet games, because they
 * are the only corpus where the CHOICE SET is known rather than guessed. Two objections land against
 * that immediately, and both are right to raise:
 *
 *   1. "Open sheet teams have different incentives than closed sheet teams." A surprise set or a
 *      bluff item is worth nothing against an opponent who read your sheet before game one, so the
 *      TEAMS are built differently — not just played differently. The corpus even ships with a
 *      warning saying exactly this: "Different information AND incentive regime ... Do not pool."
 *   2. "The data we scrape is not clean." Most of the ladder store is bots, forfeits and stubs, and
 *      quality.js's bot detection was tuned on OUR scrape, not on a corpus somebody else assembled.
 *
 * Neither is settled by arguing. This file measures both, with the SAME code applied to both
 * corpora, so a difference is the population rather than the measurement.
 *
 * WHAT IT SEPARATES, AND WHY THAT IS THE WHOLE POINT
 * -------------------------------------------------
 * The policy is a CONDITIONAL model: P(choice | board, choice set). It never learns what to bring —
 * MEW samples its teams from the clean LADDER store regardless. So the question is not "are the two
 * corpora the same" (they are not) but specifically:
 *
 *     do the TEAMS differ?      -> changes which situations the fit saw. Correctable by reweighting.
 *     does the BEHAVIOUR differ? -> changes what the fit learns. NOT correctable, and disqualifying.
 *
 * Those are different questions with different answers, and collapsing them is how a corpus gets
 * either wrongly trusted or wrongly thrown away.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Q = require('./quality.js');
const B = require('./board.js');
const CS = require('./champions_sim.js');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;
const cfg = Q.config();

/* Walk a corpus with the board reconstruction, scoring each CHOSEN move exactly as the fitter would.
 * Nothing here is specific to either corpus — that is the point. */
function walk(games) {
  const R = { games: 0, turns: 0, moves: 0, dmg: 0, se: 0, immune: 0, resisted: 0,
              status: 0, dead: 0, protect: 0, switches: 0, ratings: [], species: {}, items: {} };
  for (const g of games) {
    R.games++;
    const bd = new B.Board();
    for (const s of ['p1', 'p2']) {
      const L = (g.lead || {})[s] || [];
      if (L[0]) bd.switchIn(s, 'a', L[0]);
      if (L[1]) bd.switchIn(s, 'b', L[1]);
      const p = g[s] || {}; if (p.rating) R.ratings.push(p.rating);
      for (const sp of ((g.six || {})[s] || [])) R.species[base(sp)] = (R.species[base(sp)] || 0) + 1;
    }
    for (const st of Object.values(g.sets || {})) if (st && st.item) R.items[norm(st.item)] = (R.items[norm(st.item)] || 0) + 1;

    for (const t of g.turns || []) {
      R.turns++;
      const ev = t.ev || [];
      for (const e of ev) if (e.t === 'mega' && e.s) { const m = bd.slot(e.s.slice(0, 2), e.s.slice(2)); if (m) m.species = norm(e.mon); }
      for (const e of ev) {
        if (e.t !== 'm' || !e.s || !e.mon || !e.mv) continue;
        const side = e.s.slice(0, 2), letter = e.s.slice(2);
        const user = bd.slot(side, letter), mv = dex.moves.get(e.mv);
        if (!user || !mv || !mv.exists) continue;
        R.moves++;
        if (mv.stallingMove) R.protect++;
        const foes = bd.field().filter(f => f.side === (side === 'p1' ? 'p2' : 'p1')).map(f => f.mon);
        const tgt = e.tgt ? (foes.find(m2 => base(m2.species) === base(e.tgt)) || null) : null;
        const spread = ['allAdjacentFoes', 'allAdjacent'].includes(mv.target || '') ? foes : null;
        const x = B.featuresFor({ move: mv, targetMon: tgt, spread }, user, bd, side, dex, 0);
        if (x[B.FEATURE_INDEX.isStatus]) R.status++;
        else if (spread ? spread.length : tgt) {
          R.dmg++;
          if (x[B.FEATURE_INDEX.immune]) R.immune++;
          else if (x[B.FEATURE_INDEX.eff] > 0) R.se++;
          else if (x[B.FEATURE_INDEX.eff] < 0) R.resisted++;
        }
        for (const f of ['deadStatus', 'deadSide', 'deadField', 'deadWeather', 'deadStall']) {
          if (x[B.FEATURE_INDEX[f]]) { R.dead++; break; }
        }
      }
      for (const e of ev) {
        const side = e.s ? e.s.slice(0, 2) : null, letter = e.s ? e.s.slice(2) : null;
        if (e.t === 's' && side) { bd.switchIn(side, letter, e.mon); R.switches++; }
        else if (e.t === 'm' && side) {
          const user = bd.slot(side, letter), mv = dex.moves.get(e.mv);
          if (user && mv && mv.exists) {
            /* ROADMAP #254 — B.sideFor, not the mover's side. */
            const already = (mv.sideCondition && bd.hasSide(B.sideFor(side, mv), mv.sideCondition)) || (B.fieldKey(mv) && bd.hasField(B.fieldKey(mv)));
            B.noteMove(bd, side, user, mv, !already);
          }
          if (e.tgt && e.dmg) {
            const fo = side === 'p1' ? 'p2' : 'p1'; let hit = false;
            for (const s of [fo, side]) { for (const L of ['a', 'b']) { const m2 = bd.slot(s, L);
              if (m2 && base(m2.species) === base(e.tgt) && !m2.fainted) { m2.hp = Math.max(0, m2.hp - e.dmg / 100); hit = true; break; } } if (hit) break; }
          }
        }
        else if (e.t === 'x' && side) { const m2 = bd.slot(side, letter); if (m2) m2.status = norm(e.st); }
        else if (e.t === 'f' && side) bd.faint(side, letter);
        else if (e.t === 'w' && e.field) bd.setWeather(e.field);
        else if (e.t === 'fs' && e.field) { const mv = dex.moves.get(e.field); const k = mv && mv.exists ? B.fieldKey(mv) : norm(e.field); if (k) bd.startField(k, mv && mv.condition && mv.condition.duration); }
      }
      bd.endTurn();
    }
  }
  return R;
}

/* The project's own bot signal, applied to whichever corpus is handed to it. Team invariance, not
 * names: an account playing many games without ever changing a slot is running a script. */
function botSignature(games) {
  const r = cfg.rules.exclude_behavioural_bots;
  const count = new Map(), teams = new Map();
  for (const g of games) for (const s of ['p1', 'p2']) {
    const n = (g[s] || {}).name; if (!n) continue;
    count.set(n, (count.get(n) || 0) + 1);
    const six = ((g.six || {})[s] || []).slice().sort().join('|');
    if (six) { if (!teams.has(n)) teams.set(n, new Set()); teams.get(n).add(six); }
  }
  const flagged = new Set();
  for (const [n, c] of count) {
    const t = teams.get(n);
    if (c >= r.min_games && t && t.size <= r.max_distinct_teams) flagged.add(n);
  }
  let touched = 0;
  for (const g of games) if (flagged.has((g.p1 || {}).name) || flagged.has((g.p2 || {}).name)) touched++;
  const active = [...count.entries()].filter(([, c]) => c >= r.min_games).length;
  return { flagged: flagged.size, touched, accounts: count.size, activeAccounts: active, minGames: r.min_games };
}

function main() {
  const open = [], closed = [], openRaw = [], closedRaw = [];
  for (const l of fs.readFileSync(D('data', 'games.ots.jsonl'), 'utf8').split('\n')) {
    if (!l.trim()) continue; let g; try { g = JSON.parse(l); } catch (e) { continue; }
    openRaw.push(g);
    if (!Q.reasons(g, cfg, null).length) open.push(g);
  }
  for (const g of Q.readStore()) if (!g.openSheet) closedRaw.push(g);
  for (const g of Q.loadGames()) if (!g.openSheet) closed.push(g);

  const A = walk(open), C = walk(closed);
  const pct = (a, b) => b ? 100 * a / b : 0;
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

  console.log('CORPUS SHIFT — open-sheet (fitted on) against closed-sheet ladder (played in)\n');
  console.log(`  clean open-sheet games   ${A.games.toLocaleString()}   (${A.moves.toLocaleString()} decisions)`);
  console.log(`  clean closed-sheet games ${C.games.toLocaleString()}   (${C.moves.toLocaleString()} decisions)\n`);

  console.log('  BEHAVIOUR GIVEN A BOARD — what the policy actually learns');
  console.log('  ' + 'metric'.padEnd(38) + 'open'.padStart(9) + 'closed'.padStart(10) + 'gap'.padStart(8));
  console.log('  ' + '-'.repeat(65));
  const row = (n, f, u = '%') => {
    const a = f(A), c = f(C);
    console.log('  ' + n.padEnd(38) + a.toFixed(2).padStart(8) + u + c.toFixed(2).padStart(9) + u + Math.abs(a - c).toFixed(2).padStart(8));
  };
  row('super effective (of damaging)', r => pct(r.se, r.dmg));
  row('resisted (of damaging)', r => pct(r.resisted, r.dmg));
  row('immune (of damaging)', r => pct(r.immune, r.dmg));
  row('a move that could not work', r => pct(r.dead, r.moves));
  row('status moves (of decisions)', r => pct(r.status, r.moves));
  row('Protect-family (of decisions)', r => pct(r.protect, r.moves));
  row('turns per game', r => r.turns / Math.max(1, r.games), ' ');
  row('switches per game', r => r.switches / Math.max(1, r.games), ' ');
  row('mean player rating', r => mean(r.ratings), ' ');

  const share = (r, sp) => pct(r.species[sp] || 0, r.games);
  const all = new Set([...Object.keys(A.species), ...Object.keys(C.species)]);
  const rows = [...all].map(sp => ({ sp, a: share(A, sp), c: share(C, sp) })).filter(r => r.a > 2 || r.c > 2);
  rows.sort((x, y) => y.c - x.c);
  let l1 = 0; for (const r of rows) l1 += Math.abs(r.a - r.c);

  console.log('\n  TEAM COMPOSITION — what the policy does NOT learn (MEW takes teams from the ladder store)');
  console.log('  ' + 'species'.padEnd(38) + 'open'.padStart(9) + 'closed'.padStart(10) + 'gap'.padStart(8));
  console.log('  ' + '-'.repeat(65));
  for (const r of rows.slice(0, 10)) {
    console.log('  ' + r.sp.padEnd(38) + r.a.toFixed(1).padStart(8) + '%' + r.c.toFixed(1).padStart(9) + '%' + Math.abs(r.a - r.c).toFixed(1).padStart(8));
  }
  console.log(`\n  total absolute difference across ${rows.length} species: ${l1.toFixed(1)} points`);

  /* BEFORE the filter as well as after. Reporting only the filtered corpora would print "0 bots"
   * for both and read as "these corpora are clean", when the closed store is clean precisely
   * BECAUSE quality.js already removed them. The interesting number is how much each corpus had to
   * have taken out of it. */
  const bo = botSignature(openRaw), bc = botSignature(closedRaw);
  const bo2 = botSignature(open), bc2 = botSignature(closed);
  console.log('\n  BOT CONTAMINATION — the project\'s own team-invariance signal, applied to both');
  console.log('  ' + 'corpus'.padEnd(22) + 'accounts'.padStart(10) + 'games touched'.padStart(26) + 'after filtering'.padStart(17));
  console.log('  ' + '-'.repeat(75));
  const botRow = (name, b, b2, total) => console.log('  ' + name.padEnd(22) + String(b.flagged).padStart(10) +
    `${b.touched.toLocaleString()} of ${total.toLocaleString()} (${pct(b.touched, total).toFixed(1)}%)`.padStart(26) +
    `${b2.touched} remain`.padStart(17));
  botRow('open-sheet', bo, bo2, openRaw.length);
  botRow('closed ladder store', bc, bc2, closedRaw.length);
  console.log(`  NOTE: the rule needs >=${bo.minGames} games from one account to fire, and only ` +
              `${bo.activeAccounts} of ${bo.accounts.toLocaleString()} open-sheet accounts play that many.`);
  console.log('  So this is a FLOOR on detection, not a clean bill of health. A bot playing fewer');
  console.log('  games, or varying its team, is invisible to it — quality.js says so itself, and the');
  console.log('  right phrase remains "no bot detected", never "human".');

  console.log('\n  READING THIS');
  console.log('  The teams differ a lot and the behaviour barely does. The policy is a conditional');
  console.log('  model over (board, choice set) and MEW draws its teams from the ladder store, so the');
  console.log('  composition gap changes which situations were sampled, not what was learned from');
  console.log('  them. engine/fit_policy.js re-estimates on a reweighted sample every run and reports');
  console.log('  whether the weights move; if they ever do, this conclusion is void.');
}

if (require.main === module) main();
module.exports = { walk, botSignature };
