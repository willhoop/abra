/* test-degradation-budgets.js — this project already measures its own degradation. Nothing fails
 * when it gets bad. That is the universal defect, and this is the universal guard.
 *
 *   node tests/test-degradation-budgets.js            check against data/degradation-budgets.json
 *   node tests/test-degradation-budgets.js --measure  print today's rates without judging them
 *   node tests/test-degradation-budgets.js --ratchet  tighten every budget to today's rate
 *
 * WHY THIS EXISTS, AND WHY IT IS THE GENERAL CASE
 * ----------------------------------------------
 * Will: "but what about other bugs besides just a hyphen bro — i want a universal fix."
 *
 * He is right that a hyphen detector fixes hyphens. Look instead at what every expensive bug in this
 * project has had in common, and it is not a hyphen:
 *
 *   mega, four times      the bot mega-evolved 0% of the time      -- a rate nobody thresholded
 *   the spread matcher    57,486 of 82,483 joint turns discarded   -- PRINTED, in the fit's own output
 *   the forme lookup      dmgFailures.unknownSpecies at 27.6%      -- COUNTED, since the day it broke
 *   MEDICHAM's backtest   every forme silently filtered from it    -- a shrinking sample, unreported
 *
 * In every case the engine ALREADY KNEW. `dmgFailures.unknownSpecies` incremented correctly on every
 * single miss for weeks. `fit_joint.js` printed its unmatched count in the run that produced the
 * broken weights. The counters were right; the number scrolled past; nothing failed.
 *
 * So the general rule is not about names or keys:
 *
 *     EVERY DEGRADATION PATH ALREADY COUNTS ITSELF. EVERY COUNT MUST HAVE A DECLARED CEILING,
 *     AND EXCEEDING IT MUST FAIL A TEST.
 *
 * A counter without a budget is a number. A counter with a budget is a guard. That is the whole
 * difference, and it generalises to any future degradation -- a new fallback, a new "unknown", a new
 * silent skip -- without anyone predicting what the next bug will be.
 *
 * WHY THE BUDGETS ARE MEASURED, NOT CHOSEN. Each ceiling starts at what the code actually does today
 * (`--ratchet`) so the test can be adopted without a cleanup first; the same reason
 * tests/test-no-silent-failure.js was baselined at 233 cases rather than demanding they be fixed.
 * A budget may only ever be TIGHTENED. Loosening one is a decision that has to be argued for in the
 * file, not a quiet edit.
 *
 * HONEST SCOPE, because "universal" oversells it: this catches SILENT DEGRADATION -- the class where
 * a fallback returns something plausible and the caller cannot tell. It does not catch a feature that
 * is confidently wrong, which is what tests/test-feature-semantics.js is for, nor a claim that was
 * typed rather than derived, which is what the S13 rule and code review are for. Those three together
 * cover the recorded failures of this project; nothing covers all bugs.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('DEGRADATION BUDGETS — a counter without a ceiling is just a number\n');

if (!process.env.SHOWDOWN_PATH) {
  console.log('  FAIL SHOWDOWN_PATH is not set, so no workload can be run');
  console.log('\nDEGRADATION BUDGET TESTS: 0 passed, 1 failed');
  process.exit(1);
}

const B = require(D('engine', 'board.js'));
const CS = require(D('engine', 'champions_sim.js'));
const FP = require(D('engine', 'fit_policy.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;
B.damageEngine();

/* ---- THE WORKLOAD -----------------------------------------------------------------------------
 * Real corpus games scored exactly as the fitter scores them, because a rate measured on a synthetic
 * board would not be the rate that matters. Fixed count so the number is comparable run to run. */
const GAMES = 120;

function measure() {
  for (const k in B.dmgFailures) B.dmgFailures[k] = 0;
  const { games } = FP.loadCorpus();
  let candidates = 0, sheetMons = 0, unresolvable = 0;

  for (const g of games.slice(0, GAMES)) {
    const bd = new B.Board(); const sheet = {};
    for (const side of ['p1', 'p2']) {
      for (const m of (g.sheets && g.sheets[side]) || []) {
        if (!m || !m.species) continue;
        sheetMons++;
        if (!B.mcKeyFor(m.species)) unresolvable++;
        sheet[base(m.species)] = { side, moves: (m.moves || []).map(norm) };
        bd.setSheet(side, m.species, { nature: m.nature || '', item: m.item || '' });
      }
      bd.setParty(side, ((g.brought || {})[side] || []));
      const lead = (g.lead || {})[side] || [];
      if (lead[0]) bd.switchIn(side, 'a', lead[0]);
      if (lead[1]) bd.switchIn(side, 'b', lead[1]);
    }
    for (const side of ['p1', 'p2']) {
      for (const L of ['a', 'b']) {
        const u = bd.slot(side, L); if (!u) continue;
        const sh = sheet[base(u.species)]; if (!sh) continue;
        const cs = B.candidates(sh.moves, u, bd, side, dex);
        for (const c of cs) { candidates++; B.featuresFor(c, u, bd, side, dex, 0.25); }
      }
    }
  }

  return {
    'board.dmgMon.unknownSpecies': { hits: B.dmgFailures.unknownSpecies, of: candidates,
      what: 'candidate scorings where the damage engine could not identify a Pokemon, so every damage-derived feature silently read zero' },
    'board.dmgMon.engineUnavailable': { hits: B.dmgFailures.unavailable, of: candidates,
      what: 'candidate scorings with no damage engine at all' },
    'sheet.speciesUnresolvable': { hits: unresolvable, of: sheetMons,
      what: 'Pokemon on real open team sheets that mcKey cannot resolve to a damage-engine entry' },
  };
}

const now = Object.assign(measure(), artifactRates());
const rate = m => (m.of ? m.hits / m.of : 0);
const pct = x => (100 * x).toFixed(2) + '%';

if (process.argv.includes('--measure')) {
  for (const [k, m] of Object.entries(now)) {
    if (m.pending) { console.log(`  ${k.padEnd(36)}   (not recorded yet — ${m.what})`); continue; }
    console.log(`  ${k.padEnd(36)} ${String(m.hits).padStart(6)} / ${String(m.of).padStart(6)}  ${pct(rate(m))}`);
  }
  process.exit(0);
}

/* ---- DROP RATES THE FITTERS RECORDED ABOUT THEMSELVES ------------------------------------------
 *
 * The workload above measures board.js live. The FITTERS cannot be re-run in a test -- they take
 * half an hour each -- so their rates are read from the artifact each one writes. That is not a
 * compromise: the fit is the only thing that can honestly report what the fit saw, and a number
 * recorded beside the weights it produced cannot drift away from them.
 *
 * This is the check that was missing. fit_joint.js discarded 57,486 of 82,483 joint turns for weeks
 * and PRINTED that number in every run; nothing compared it to anything, so nobody read it. */
const unreadable = [];
function artifactRates() {
  const out = {};
  /* An artifact that will not parse is not "no degradation here" — it is a rate this guard cannot
   * see, which is the exact blind spot the file exists to close. Reported, and counted so a later
   * assertion can fail on it rather than the absence reading as a pass. */
  const read = (f) => {
    try { return JSON.parse(fs.readFileSync(D('data', f), 'utf8')); }
    catch (e) {
      unreadable.push(`${f} (${e.message.slice(0, 50)})`);
      console.error(`  (could not read data/${f}: ${e.message})`);
      return null;
    }
  };

  const pw = read('policy-weights.json');
  if (pw && pw.matching && pw.matching.seen) {
    const m = pw.matching;
    out['fit_policy.unmatchedClicks'] = { hits: m.unmatched, of: m.seen,
      what: 'human clicks the move fit could not match to a candidate, so the decision was dropped from training' };
    out['fit_policy.decisionsDropped'] = { hits: m.seen - m.kept, of: m.seen,
      what: 'decisions discarded for any reason before fitting' };
  } else if (pw) {
    out['fit_policy.unmatchedClicks'] = { pending: true,
      what: 'policy-weights.json predates the `matching` block — it will populate on the next fit' };
  }

  const jw = read('policy-weights-joint.json');
  if (jw && jw.matching && jw.matching.turnsSeen) {
    const m = jw.matching;
    out['fit_joint.turnsDropped'] = { hits: m.turnsSeen - m.kept, of: m.turnsSeen,
      what: 'joint turns the pair fit could not use — the defect that had it fitting 74 weights on 30% of the data' };
  }

  const ce = read('chomp-ev.json');
  if (ce && ce.n_human_games) {
    out['chomp_ev.unbuildableGames'] = { hits: ce.n_skipped_unbuildable || 0, of: ce.n_human_games,
      what: 'human games CHOMP could not build a board for, so they left the evaluation set' };
  }
  return out;
}

const FILE = D('data', 'degradation-budgets.json');
if (process.argv.includes('--ratchet')) {
  const prev = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { budgets: {} };
  const budgets = {};
  for (const [k, m] of Object.entries(now)) {
    if (m.pending) continue;
    const measured = Math.ceil(rate(m) * 10000) / 10000;
    const old = prev.budgets && prev.budgets[k] ? prev.budgets[k].max_rate : Infinity;
    budgets[k] = {
      max_rate: Math.min(measured, old),          // may only tighten
      measured_at: `${m.hits}/${m.of} over ${GAMES} corpus games`,
      what: m.what,
      target: (prev.budgets && prev.budgets[k] && prev.budgets[k].target) || null,
    };
  }
  fs.writeFileSync(FILE, JSON.stringify({
    note: 'Ceilings on how often each degradation path may fire. Measured, never chosen. A budget may only be TIGHTENED — loosening one is a decision that must be argued for here, not edited quietly. See tests/test-degradation-budgets.js.',
    workload: `first ${GAMES} clean open-sheet corpus games, scored as fit_policy scores them`,
    budgets,
  }, null, 2) + '\n');
  console.log('  ratcheted:');
  for (const [k, v] of Object.entries(budgets)) console.log(`    ${k.padEnd(36)} <= ${pct(v.max_rate)}`);
  process.exit(0);
}

if (!fs.existsSync(FILE)) {
  console.log('  FAIL no data/degradation-budgets.json — create it with --ratchet');
  console.log('\nDEGRADATION BUDGET TESTS: 0 passed, 1 failed');
  process.exit(1);
}
const budgets = JSON.parse(fs.readFileSync(FILE, 'utf8')).budgets || {};

/* A counter with no budget is the state this whole file exists to end, so an unbudgeted counter is
 * itself a failure rather than something to skip quietly. */
ok(unreadable.length === 0,
  `every artifact this guard reads parsed (${unreadable.join(', ') || 'all readable'})`);

const unbudgeted = Object.keys(now).filter(k => !budgets[k] && !now[k].pending);
ok(unbudgeted.length === 0, `every degradation counter has a declared ceiling (${unbudgeted.join(', ') || 'all declared'})`);

for (const [k, m] of Object.entries(now)) {
  if (m.pending) { console.log(`  ----  ${k}: not recorded yet — ${m.what}`); continue; }
  const b = budgets[k];
  if (!b) continue;
  const r = rate(m);
  ok(r <= b.max_rate + 1e-9,
    `${k}  ${pct(r)} (${m.hits}/${m.of})  <=  ceiling ${pct(b.max_rate)}`);
  if (b.target != null && r > b.target) {
    console.log(`       note: still above its stated TARGET of ${pct(b.target)} — ${b.what}`);
  }
}

console.log(`\nDEGRADATION BUDGET TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
