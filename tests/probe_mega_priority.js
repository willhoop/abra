/* probe_mega_priority.js — ROADMAP #311, STAGED.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mega_priority.js --release <id>
 *
 * WHICH ENGINE BYTES GET TESTED, AND WHY THIS FILE DOES NOT WRITE TO THE RELEASE STORE.
 * `engine/game_differential.js` reads a FROZEN release, never the live tree, and CUTS one at require
 * time when `--release` is absent — which repoints `data/engine-release.json` under whatever else is
 * measuring. That is unacceptable for a probe that has to run every time the engine is touched, and
 * naming an existing release is useless to a FIX pass, because the fix is not in it.
 *   default          cut and open in a THROWAWAY store under the OS temp dir. The live tree is what
 *                    gets frozen, so this measures the engine as it stands right now, and
 *                    `data/releases/` and `data/engine-release.json` are not touched. The override
 *                    announces itself on stderr — `engine_release.js` makes sure of that.
 *   --release <id>   the real store, opened by name and written to by nothing. Use this to ask what
 *                    an OLD engine did. `c26511b6d812` is the pre-#311 engine.
 * Either way the header below prints which one ran, because a probe that cannot say what it measured
 * is the silent-default shape this repository is built around avoiding.
 *
 * #311 is a LEAD: after #290 the four surviving `--order-probe` pairs every one named a mega forme,
 * and the row asks three questions it says have NOT been staged —
 *   1. does Showdown RE-SORT the action queue when a body mega-evolves mid-turn?
 *   2. when does the new forme's Speed take effect — this turn, or next?
 *   3. does medicham2 do the same thing?
 * This file answers all three on constructed boards. Nobody types the answer: Showdown plays the same
 * script and its own `|move|` order IS the expectation, exactly as tests/probe_turn_order.js argues.
 *
 * THE KNOB IS THE MEGA ITSELF. Every scenario runs TWICE on the SAME board with the SAME clicks and
 * one bit changed — `mega: true` present or absent. Four orders are printed per scenario, and the
 * finding is the SHAPE of the 2x2: an engine whose two arms are identical while the authority's two
 * differ has an UNWIRED knob, which is the failure this repository names by its casualties. A single
 * mega-only arm would show a disagreement and could not say what caused it.
 *
 * WHY THESE SPECIES, DERIVED AND NOT CHOSEN. Of the 76 legal base->mega pairs in
 * `Dex.forFormat('gen9championsvgc2026regmb')`, exactly THREE change an ability that touches the
 * priority bracket — derived by walking `D.abilities.all()` for `onModifyPriority` /
 * `onFractionalPriority` (Gale Wings, Mycelium Might, Prankster, Quick Draw, Stall, Triage) and
 * intersecting with each pair's ability sets:
 *     Banettite    Banette      -> Banette-Mega      GAINS   Prankster   (spe 65 -> 75)
 *     Meowsticite  Meowstic     -> Meowstic-M-Mega   LOSES   Prankster   (spe 104 -> 124)
 *     Sablenite    Sableye      -> Sableye-Mega      LOSES   Prankster   (spe 50 -> 20)
 * ARM 1 stages the gain, ARM 2 the loss. ARM 3 is the PURE-SPEED control on a mega that changes no
 * priority ability at all (Aerodactyl, Rock Head -> Tough Claws), which is what actually answers
 * questions 1 and 2 without any ability in the way.
 *
 * THE CLICK IS Charm ON EVERY BODY — one bracket by construction, so only the bracket can move it.
 * `Dex.forFormat(...).moves.get('charm')` reads `isNonstandard: null`, `category: Status`,
 * `priority: 0`, `accuracy: 100`, `target: normal`, `boosts: {atk:-2}`: legal here, no RNG, and it
 * cannot touch a Speed. Leer/Growl/Tail Whip are all `isNonstandard: 'Past'` — BANNED — and the first
 * draft used one.
 *
 * NOTHING TARGETS A MEGA BODY. Sableye-Mega is Magic Bounce and would reflect an incoming Charm,
 * adding `|move|` lines that have nothing to do with turn order; every click is `t: 0` and Sableye
 * sits in slot 1.
 *
 * SPEEDS ARE DERIVED, NOT TYPED. `spreadFor` gives active slot 0 +32 Speed and slot 1 +22 off
 * SPE_LADDER, the scenarios declare no nature so `natureFor` returns Serious, and Champions'
 * non-level-clause branch is `stat = stat + evs + 20` (data/mods/champions/scripts.ts:24) — so an
 * active body's Speed is base+52 in slot 0 and base+42 in slot 1. The probe prints both engines'
 * speed readings anyway (`speedCensus`), so this paragraph being wrong shows up as a printed
 * disagreement rather than as a green.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — the official simulator is absent. This is not a pass.'); process.exit(2); }

/* THE DRIVER STOPS AT THE FIRST DIVERGENT LINE UNLESS IT IS TOLD NOT TO (`engine/game_differential.js`
 * line 3216: the turn loop runs while `END_STATE ? true : ... !firstDiv`), and this probe's whole
 * diagnosis is turn 2 — the turn AFTER the disagreement. Without this the two arms that actually
 * disagree play ONE turn and report a fixture failure, which is what the first draft did. Set here
 * rather than left to the command line so the file cannot be invoked in the state that lies. */
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

/* THE THROWAWAY RELEASE STORE, which is `tests/_live_release.js` and NOT four lines copied to here.
 * That file is the one implementation of "point a release-reading instrument at the live tree without
 * writing to the shared store"; requiring it BEFORE the driver is what makes it bind, because Node's
 * module cache is what makes the driver's `engine_release.js` the same object it wrapped. */
const NAMED_RELEASE = (() => { const i = process.argv.indexOf('--release');
                               return i >= 0 ? process.argv[i + 1] : null; })();
if (!NAMED_RELEASE) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
console.log('\n  ENGINE UNDER TEST: ' + (NAMED_RELEASE
  ? 'frozen release ' + NAMED_RELEASE + ' from the real store'
  : 'THE LIVE TREE, frozen into a throwaway store (data/releases is untouched)')
  + '\n  release id ' + G.REL.id);
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...names) => names.map(n => ({ species: n, item: '', ability: '', moves: ['Protect'] }));
const CH = ['Charm', 'Protect'];

/* TWO turns, four Charms each, every click at the foes' slot 0. `mega` is the knob and is spliced
 * into turn 1 only.
 *
 * TURN 2 IS THE DIAGNOSIS, NOT DECORATION. A turn-1 disagreement alone has TWO candidate causes and
 * they need opposite fixes: the bracket was frozen before the forme change, or the mega's ability
 * never landed on this engine at all. Turn 2 separates them — the bracket is resolved fresh at the
 * top of every turn, so a mega whose ability DID land must order correctly on turn 2 under BOTH
 * engines. Turn 2 agreeing while turn 1 differs is the frozen bracket; turn 2 differing too is a
 * missing ability, which is a different defect with a different owner. */
const TURN = (megaSide, megaSlot) => {
  const t = () => ({ p1: [{ m: 'charm', t: 0 }, { m: 'charm', t: 0 }],
                     p2: [{ m: 'charm', t: 0 }, { m: 'charm', t: 0 }] });
  const t1 = t(), t2 = t();
  if (megaSide) t1[megaSide][megaSlot].mega = true;
  return [t1, t2];
};

const SCEN = [
  /* ARM 1 — THE MEGA GAINS PRANKSTER. Banette-Mega (75 base, slot 1 -> 117) is the SLOWEST body on
   * the field by construction, so if it moves first it moved first on the BRACKET and it cannot be
   * speed. Whimsicott 168, Dragapult 184, Garchomp 154 are all above it before and after. */
  { name: 'ARM 1 — the mega GAINS Prankster (Banette -> Banette-Mega), and the mega body is the slowest on the field',
    A: stage([['whimsicott', '', 'Chlorophyll', CH],
              ['banette', 'Banettite', 'Insomnia', CH]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['garchomp', '', 'Rough Skin', CH],
              ['dragapult', '', 'Infiltrator', CH]]).concat(BENCH('snorlax', 'toxapex')),
    megaSide: 'p1', megaSlot: 1 },

  /* ARM 2 — THE MEGA LOSES PRANKSTER. Sableye declares Prankster, so at the top of the turn its Charm
   * is +1 on BOTH engines; the mega overwrites the ability with Magic Bounce before any move runs.
   * Sableye-Mega (20 base, slot 1 -> 62) is again the slowest body on the field, so "moved first" can
   * only be the bracket. This is the reported #311 pair `medicham Sableye-Mega` verbatim. */
  { name: 'ARM 2 — the mega LOSES Prankster (Sableye -> Sableye-Mega), which the sort read at the top of the turn',
    A: stage([['whimsicott', '', 'Chlorophyll', CH],
              ['sableye', 'Sablenite', 'Prankster', CH]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['garchomp', '', 'Rough Skin', CH],
              ['dragapult', '', 'Infiltrator', CH]]).concat(BENCH('snorlax', 'toxapex')),
    megaSide: 'p1', megaSlot: 1 },

  /* ARM 3 — THE PURE-SPEED CONTROL, AND THE ONE THAT ANSWERS QUESTIONS 1 AND 2. Aerodactyl changes no
   * priority ability (Rock Head -> Tough Claws) and gains 20 base Speed. In slot 0 it reads 182 before
   * and 202 after, and Dragapult sits BETWEEN them at 194. So the click order alone says whether the
   * new forme's Speed decided THIS turn's order. */
  { name: 'ARM 3 — PURE SPEED, no priority ability either side (Aerodactyl 182 -> 202, straddling Dragapult 194)',
    A: stage([['aerodactyl', 'Aerodactylite', 'Rock Head', CH],
              ['corviknight', '', 'Pressure', CH]]).concat(BENCH('milotic', 'clefable')),
    B: stage([['dragapult', '', 'Infiltrator', CH],
              ['garchomp', '', 'Rough Skin', CH]]).concat(BENCH('snorlax', 'toxapex')),
    megaSide: 'p1', megaSlot: 0 },
];

/* THE ORDER, SPLIT BY TURN, because the whole diagnosis is turn 1 against turn 2. Split on the
 * `|turn|` marker rather than on a slice count: a slice would silently mis-attribute the moment
 * anything adds or drops a line, which is exactly the kind of quiet mis-read this repo pays for. */
const ACT = /^\|(move|switch)\|/;
const byTurn = (arr) => {
  const out = [[]];
  for (const raw of arr.map(String)) {
    if (/^\|turn\|/.test(raw)) { out.push([]); continue; }
    if (ACT.test(raw)) out[out.length - 1].push(raw.split('|')[2].replace(/\s+/g, ' ').trim());
  }
  /* the leading block is the leads' `|switch|` burst, before `|turn|1` */
  return out.slice(1);
};

function run(sc, withMega) {
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  if (!a || !b) return { err: 'NOT-STAGED — buildPair refused a sheet' };
  const script = TURN(withMega ? sc.megaSide : null, sc.megaSlot);
  const before = G.scriptCounters().megaRefused;
  const r = G.playGame(a, b, 'directed',
    'probe_mega_priority :: ' + sc.name + ' :: ' + (withMega ? 'MEGA' : 'PLAIN'),
    { script, speedCensus: true });
  if (r.err) return { err: 'THREW — ' + r.err };
  return { sd: byTurn(G.sdStream(G.lastSdLog())), me: byTurn(r.mediTrace),
           megaSd: r.megaSd, megaMedi: r.megaMedi,
           refused: G.scriptCounters().megaRefused - before,
           speedRows: r.speedRows || [], speedDesync: r.speedDesync || 0, turns: r.turns };
}

let bad = 0;
for (const sc of SCEN) {
  console.log('\n================================================================');
  console.log(sc.name);
  const M = run(sc, true), P = run(sc, false);
  if (M.err || P.err) { console.log('  ' + (M.err || P.err)); bad++; continue; }

  /* THE CAPABILITY MUST PROVE IT RAN. A mega arm in which nothing evolved, or a plain arm in which
   * something did, is a fixture failure and NOT a finding. */
  if (M.refused) { console.log('  FIXTURE FAILED — Showdown refused the mega ask (' + M.refused + ')'); bad++; continue; }
  if (!(M.megaSd === 1 && M.megaMedi === 1)) {
    console.log('  FIXTURE FAILED — the MEGA arm did not mega on both engines: showdown ' + M.megaSd
      + ' medicham ' + M.megaMedi); bad++; continue;
  }
  if (M.turns < 2 || P.turns < 2) { console.log('  FIXTURE FAILED — both turns did not play (' + M.turns + '/' + P.turns + ')'); bad++; continue; }
  if (P.megaSd || P.megaMedi) {
    console.log('  FIXTURE FAILED — the PLAIN arm mega evolved anyway: showdown ' + P.megaSd
      + ' medicham ' + P.megaMedi); bad++; continue;
  }
  /* AND THE TWO ENGINES MUST AGREE ABOUT THE NUMBERS THEY SORTED ON, or a bracket finding is really
   * a Speed finding wearing its clothes. */
  if (M.speedRows.length || M.speedDesync) {
    console.log('  SPEED DISAGREES — this is not a bracket result: '
      + JSON.stringify(M.speedRows.slice(0, 4))); bad++; continue;
  }

  const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  const row = (t, v) => console.log('   ' + t.padEnd(22) + '  T1  ' + v[0].join(' -> ')
    + '\n   ' + ''.padEnd(22) + '  T2  ' + v[1].join(' -> '));
  console.log('  the SAME board, the SAME four Charms every turn, one bit changed on turn 1:');
  row('showdown  MEGA', M.sd);
  row('showdown  PLAIN', P.sd);
  row('medicham  MEGA', M.me);
  row('medicham  PLAIN', P.me);

  const sdMoved = !eq(M.sd[0], P.sd[0]);
  const meMoved = !eq(M.me[0], P.me[0]);
  const agreeMega = eq(M.sd[0], M.me[0]), agreePlain = eq(P.sd[0], P.me[0]);
  const agreeMegaT2 = eq(M.sd[1], M.me[1]);
  console.log('  turn 1, the mega MOVED the order:  showdown ' + (sdMoved ? 'YES' : 'no ')
    + '   medicham ' + (meMoved ? 'YES' : 'no '));
  console.log('  engines agree:  T1 MEGA ' + (agreeMega ? 'yes' : 'NO ') + '   T1 PLAIN '
    + (agreePlain ? 'yes' : 'NO ') + '   T2 MEGA ' + (agreeMegaT2 ? 'yes' : 'NO'));
  if (!agreePlain) { console.log('  >> THE CONTROL ITSELF DISAGREES — this scenario proves nothing about mega timing.'); bad++; }
  else if (sdMoved && !meMoved && agreeMegaT2) {
    console.log('  >> DEFECT, AND THE CAUSE IS THE FROZEN BRACKET: turn 1 differs, turn 2 agrees, so the mega\'s\n'
      + '     ability DID land on this engine — what did not happen is the mid-turn re-derivation.'); bad++;
  } else if (sdMoved && !meMoved) {
    console.log('  >> DEFECT, AND IT IS NOT (only) TIMING: turn 2 disagrees too, so the mega\'s ability itself\n'
      + '     never took effect on this engine. Different defect, different fix.'); bad++;
  } else if (!agreeMega || !agreeMegaT2) { console.log('  >> DEFECT: the two engines order the mega turn differently.'); bad++; }
  else if (!sdMoved) console.log('  >> NOT-EXERCISED: the mega did not move the authority\'s order, so this arm asks nothing.');
  else console.log('  >> AGREES: both engines re-derived the order around the mega, identically, on both turns.');
}
console.log('\n' + (bad ? bad + ' arm(s) failed' : 'all arms clear'));
process.exit(bad ? 1 : 0);
