/* probe_bench_leaves.js — WHAT DOES A BENCHED BODY HOLD IN EACH ENGINE, BEFORE ANY LEAF IS WIRED.
 *
 *   SHOWDOWN_PATH=... node tests/probe_bench_leaves.js [--games 40]
 *
 * `engine/board_state.js`'s `partyMap` holds `{hp, maxhp, fainted}` and NOTHING ELSE. So a benched
 * body's item, status, ability, typing and boosts are compared by nothing in this repository, and a
 * divergence in one of them reads as agreement — which is the exact failure this project keeps being
 * caught by, and it is worse here because the answer it gives is the comfortable one. Three of the
 * five candidate pairs in `tests/test-end-state.js` PART 3 had a planted item laundered through this
 * gap.
 *
 * BEFORE WIDENING THE BOARD, PRINT WHAT THE WIDENING WOULD MATCH (CLAUDE.md, ENGINE's standing rule:
 * "a new derived tag will over-match — print what it matched before wiring it"). A bench leaf whose
 * two engines hold genuinely different shapes would part every board carrying it, at once, on the
 * READER's representation rather than on a rule — the manufactured divergence `partyMap`'s own
 * comment records paying for once already (index-keying, 123 of 179 games).
 *
 * SO THIS PLAYS REAL GAMES OFF THE FROZEN POOL and, at every turn boundary, walks the bodies that are
 * NOT on the field in both engines, keyed by species, and tallies per-leaf agreement. Three outcomes:
 *
 *   AGREES EVERYWHERE   safe to wire — a future disagreement is a finding
 *   DISAGREES           printed with witnesses. Either a real defect or two representations of one
 *                       fact; it must be understood before it is wired, never wired to find out
 *   NEVER OBSERVED      no benched body ever carried it. A claim about the FIXTURE, not the engines
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

/* the same pinned pool the end-state measurement runs on, so the population is the one the number
 * being defended was measured over */
if (!process.argv.includes('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');
process.argv.push('--end-state');   // play to the cap: a bench is only populated after somebody pivots
const G = require(D('engine', 'game_differential.js'));
const N = require(D('engine', 'names.js'));

const argGames = (() => { const i = process.argv.indexOf('--games');
  return i >= 0 ? +process.argv[i + 1] : 40; })();

const id = x => N.id(String(x || ''));
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);

/* ---- THE CANDIDATE LEAVES, read RAW out of each engine's own bodies ----------------------------
 * Nothing here is translated except by the project's own `id`, because the point is to SEE the two
 * shapes rather than to collapse them. A collapse invented here would hide exactly the disagreement
 * this probe exists to find. */
function mediBench(S) {
  const out = [];
  for (const [side, sf, act] of [['p1', S.sfA, S.actA || []], ['p2', S.sfB, S.actB || []]]) {
    for (const m of ((sf && sf.team) || [])) {
      if (act.indexOf(m) >= 0) continue;                       // standing, not benched
      const v = m._vol || {};
      out.push({ side, species: id(m.name), fainted: !!m.fainted, row: {
        item: id(m.item || ''),
        status: String(m.status || ''),
        status_counter: m.status === 'tox' ? num(m.toxTurns)
                      : (m.status === 'slp' ? num(m.slpTurns)
                      : (m.status === 'frz' ? num(m.frzTurns) : 0)),
        ability: id(m.ability || ''),
        types: (m.types || []).map(t => id(t)).sort().join('/'),
        boosts: JSON.stringify(m.boosts || {}),
        volatiles: Object.keys(v).filter(k => v[k]).sort().join(','),
        sub: num(m._sub), seeded: m._seededBy ? 1 : 0,
      } });
    }
  }
  return out;
}
function sdBench(battle) {
  const out = [];
  for (const [side, sd] of [['p1', battle.p1], ['p2', battle.p2]]) {
    for (const p of (sd.pokemon || [])) {
      if ((sd.active || []).indexOf(p) >= 0) continue;
      const v = p.volatiles || {};
      out.push({ side, species: id(p.species && p.species.id), fainted: !!p.fainted, row: {
        item: id(p.item || ''),
        status: String(p.status || ''),
        status_counter: p.status === 'tox' ? num(p.statusState && p.statusState.stage)
                      : (p.status === 'slp' || p.status === 'frz'
                         ? num(p.statusState && p.statusState.startTime) - num(p.statusState && p.statusState.time)
                         : 0),
        ability: id((p.ability && p.ability.id) || p.ability || ''),
        types: (typeof p.getTypes === 'function' ? p.getTypes() : (p.types || [])).map(t => id(t)).sort().join('/'),
        boosts: JSON.stringify(p.boosts || {}),
        volatiles: Object.keys(v).sort().join(','),
        sub: v.substitute ? num(v.substitute.hp) : 0, seeded: v.leechseed ? 1 : 0,
      } });
    }
  }
  return out;
}

/* boost objects are keyed differently in the two engines and the STRINGS above will never match; the
 * comparable quantity is the seven stages, which is what board_state's `boost-key-names` mapping
 * already says. Compared here through the same seven names so the probe is not measuring spelling. */
const MEDI_B = ['at', 'df', 'sa', 'sd', 'sp', 'acc', 'eva'];
const SD_B = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
const boostVec = (obj, keys) => keys.map(k => num((obj || {})[k])).join(',');

const LEAVES = ['item', 'status', 'status_counter', 'ability', 'types', 'boosts', 'volatiles', 'sub', 'seeded'];
const tally = {};
for (const L of LEAVES) tally[L] = { compared: 0, differ: 0, nonempty: 0, witnesses: [],
                                     differ_fainted: 0, differ_alive: 0, compared_alive: 0 };
let bodiesCompared = 0, boundaries = 0, unmatched = 0, games = 0, threw = 0;

const PAIRS = G.pairsFor('baseline');
console.log('  pairs available: ' + PAIRS.length + ', playing ' + Math.min(PAIRS.length, argGames));
if (!PAIRS.length) { console.log('NO PAIRS — nothing measured. This is not a pass.'); process.exit(2); }

for (const pr of PAIRS.slice(0, argGames)) {
  const r = G.playGame(pr.a, pr.b, 'baseline', 'benchprobe/' + pr.tag.slice(0, 24), {
    onBoundary: (snap, turnIdx, S, battle) => {
      boundaries++;
      const A = mediBench(S), B = sdBench(battle);
      const bySpecies = new Map();
      for (const x of B) bySpecies.set(x.side + '|' + x.species, x);
      for (const a of A) {
        const b = bySpecies.get(a.side + '|' + a.species);
        if (!b) { unmatched++; continue; }
        bodiesCompared++;
        for (const L of LEAVES) {
          let av = a.row[L], bv = b.row[L];
          if (L === 'boosts') { av = boostVec(JSON.parse(a.row.boosts), MEDI_B); bv = boostVec(JSON.parse(b.row.boosts), SD_B); }
          const t = tally[L];
          t.compared++;
          if (!a.fainted && !b.fainted) t.compared_alive++;
          const empty = v => v === '' || v === 0 || v === '0,0,0,0,0,0,0';
          if (!empty(av) || !empty(bv)) t.nonempty++;
          if (String(av) !== String(bv)) {
            t.differ++;
            /* FAINTED OR STILL ALIVE ON THE BENCH IS THE WHOLE QUESTION for boosts and volatiles: the
             * authority calls clearVolatile() on a faint as well as on a switch, so a difference that
             * lives only on dead bodies is a different finding from one on a body that can come back. */
            if (a.fainted || b.fainted) t.differ_fainted++; else t.differ_alive++;
            if (t.witnesses.length < 6)
              t.witnesses.push(a.side + ' ' + a.species + (a.fainted || b.fainted ? ' [FAINTED medi=' + a.fainted + ' sd=' + b.fainted + ']' : ' [alive on the bench]')
                + '  medi=' + JSON.stringify(av) + '  sd=' + JSON.stringify(bv));
          }
        }
      }
    } });
  games++;
  if (r.err) threw++;
}

console.log('\n  A BENCHED BODY, READ OUT OF BOTH ENGINES — ' + games + ' games, ' + boundaries
  + ' turn boundaries, ' + bodiesCompared + ' benched bodies compared'
  + (threw ? ', ' + threw + ' game(s) threw' : ''));
console.log('  (' + unmatched + ' benched bodies had no counterpart of that species in the other engine)\n');
console.log('  ' + 'leaf'.padEnd(16) + 'compared'.padStart(9) + 'non-empty'.padStart(11) + 'DIFFER'.padStart(8) + '   verdict');
for (const L of LEAVES) {
  const t = tally[L];
  const verdict = t.compared === 0 ? 'NEVER OBSERVED — a claim about the fixture'
                : t.differ === 0 ? (t.nonempty ? 'AGREES EVERYWHERE (and was non-empty ' + t.nonempty + 'x)'
                                               : 'AGREES, BUT ALWAYS EMPTY — proves nothing')
                : 'DISAGREES — understand it before wiring it';
  console.log('  ' + L.padEnd(16) + String(t.compared).padStart(9) + String(t.nonempty).padStart(11)
    + String(t.differ).padStart(8) + '   ' + verdict
    + (t.differ ? '   [' + t.differ_alive + ' on a LIVING benched body, ' + t.differ_fainted + ' on a fainted one; '
                + t.compared_alive + ' living bodies compared]' : ''));
  for (const w of t.witnesses) console.log('      ' + w);
}
console.log('\n  ONLY A LEAF THAT AGREES AND WAS SEEN NON-EMPTY IS WORTH WIRING. A leaf that is always');
console.log('  empty on both sides is wired for free and catches nothing until something writes it.\n');
