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
require('../engine/showdown_path.js'); /* resolves SHOWDOWN_PATH from the sibling checkout — see that file */
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
const CM = require(D('engine', 'click_match.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const norm = B.norm, base = B.baseSpecies;
B.damageEngine();

/* ---- THE WORKLOAD -----------------------------------------------------------------------------
 * Real corpus games scored exactly as the fitter scores them, because a rate measured on a synthetic
 * board would not be the rate that matters. Fixed count so the number is comparable run to run. */
const GAMES = 120;

/* THE WORKLOAD DECIDES WHAT THE BUDGET CAN SEE, and this one could not see the live bot.
 *
 * `board.dmgMon.unknownSpecies` sat at a measured 0.00% and a ceiling of 0.00% — correct for this
 * workload and wrong about the world. 120 REPLAYED corpus games never contain an in-battle forme
 * change in a scored position, so the counter never fired. In SELF-PLAY it does: Aegislash-Blade and
 * Palafin-Hero have no MC.mons row (their stats differ from the base forme, so the cosmetic fallback
 * correctly refuses), and every damage-derived feature reads zero for them. Found 2026-08-02 only
 * because engine/lookup.js made the miss throw instead of returning null.
 *
 * R7, for the third time in two days: a guard only guards what it exercises. A ceiling measured on a
 * workload that cannot trigger the degradation is a ceiling that certifies nothing. So the sweep now
 * also scores POSITIONS FROM THE SELF-PLAY STORE, where the live bot's own formes appear. */
const SELFPLAY_GAMES = 60;

function measure() {
  for (const k in B.dmgFailures) B.dmgFailures[k] = 0;
  const { games } = FP.loadCorpus();
  let candidates = 0, sheetMons = 0, unresolvable = 0;

  for (const g of games.slice(0, GAMES)) {
    /* Side-keyed and forme-folded — see engine/click_match.js. A species-only key collapsed both
     * players' sets in a mirror, and 58.63% of corpus games have one. */
    const bd = new B.Board(); const SI = CM.sheetIndex(g, dex);
    for (const side of ['p1', 'p2']) {
      for (const m of (g.sheets && g.sheets[side]) || []) {
        if (!m || !m.species) continue;
        sheetMons++;
        if (!B.mcKeyFor(m.species)) unresolvable++;
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
        const sh = SI.get(side, u.species); if (!sh) continue;
        const cs = B.candidates(sh.moves, u, bd, side, dex);
        for (const c of cs) { candidates++; B.featuresFor(c, u, bd, side, dex, 0.25); }
      }
    }
  }

  /* ---- AND THE SAME SWEEP OVER SELF-PLAY, where the live bot's own formes appear ---------------
   * Replayed human games and self-play games exercise DIFFERENT species: a corpus game carries the
   * sheet's base forme, a self-play game carries whatever the bot flipped into mid-battle. Scoring
   * only the first left `unknownSpecies` permanently at zero while it was firing in every real game
   * the bot played. Absent store: skipped LOUDLY, because a silently skipped half of the workload is
   * the same defect one level up. */
  const SP = D('data', 'games.selfplay.jsonl');
  if (!fs.existsSync(SP)) {
    console.error(`  NOTE: ${path.relative(ROOT, SP)} absent — the self-play half of this workload did not run.`);
  } else {
    let n = 0, spBad = 0;
    for (const line of fs.readFileSync(SP, 'utf8').split('\n')) {
      if (!line.trim() || n >= SELFPLAY_GAMES) break;
      /* A store this guard cannot parse is a store it is not measuring, so the skip is COUNTED and
       * said out loud. Silently skipping lines would shrink the denominator and flatter every rate
       * in the table — a guard quietly measuring less than it claims. */
      let g; try { g = JSON.parse(line); } catch (e) { spBad++; continue; }
      n++;
      const bd = new B.Board();
      for (const side of ['p1', 'p2']) {
        bd.setParty(side, ((g.brought || {})[side] || []));
        const lead = (g.lead || {})[side] || [];
        if (lead[0]) bd.switchIn(side, 'a', lead[0]);
        if (lead[1]) bd.switchIn(side, 'b', lead[1]);
      }
      /* Walk the turns so IN-BATTLE FORME CHANGES actually land on the board — the whole point. A
       * self-play game scored only at its lead is the corpus workload again under another name. */
      for (const t of (g.turns || [])) {
        for (const e of (t.ev || [])) {
          if (e.t === 's' && e.s) bd.switchIn(e.s.slice(0, 2), e.s.slice(2), e.mon);
          else if ((e.t === 'mega' || e.t === 'forme') && e.s) {
            const m = bd.slot(e.s.slice(0, 2), e.s.slice(2)); if (m && e.mon) m.species = B.norm(e.mon);
          }
        }
        for (const side of ['p1', 'p2']) {
          for (const L of ['a', 'b']) {
            const u = bd.slot(side, L); if (!u || u.fainted) continue;
            /* THE FALLBACK MOVE MUST EXIST IN THIS FORMAT (2026-08-09, ROADMAP #116). This was
             * `['tackle']`, and Tackle is `isNonstandard: 'Past'` — so a slot with no recorded
             * moveset was scored on a move no game here can contain. `CS.INERT_MOVE` is legal. */
            const moves = (u.moves && u.moves.length) ? u.moves : [CS.INERT_MOVE.toLowerCase()];
            for (const c of B.candidates(moves, u, bd, side, dex)) {
              candidates++; B.featuresFor(c, u, bd, side, dex, 0.25);
            }
          }
        }
        bd.endTurn();
      }
    }
    if (spBad) console.error(`  NOTE: ${spBad} unparseable line(s) in the self-play store were skipped by this sweep.`);
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

  /* ---- "DROPPED" MEANT TWO DIFFERENT THINGS AND NOW SAYS WHICH ------------------------------
   *
   * `fit_policy.decisionsDropped` and `fit_joint.turnsDropped` were both `seen - kept`. After
   * docs/CLICK-CENSORING-FIX.md Stage B that total silently absorbed a THIRD thing: actions removed
   * because the protocol showed they were never clicks (Encore's application turn, a `|drag|`
   * stored as a switch). Those used to be inside `kept`, carrying a WRONG LABEL.
   *
   * So the totals would have gone UP while the artifact got strictly better, and a budget that can
   * only tighten would have gone red for an improvement. That is why the spec rules the 5.49%
   * question SUPERSEDED rather than answering it with a bigger or a smaller number: the unit
   * changed. Three counters now, each with its granularity stated:
   *
   *   *.unreadable   the click existed and could not be recovered. A LOSS. Successor to the old
   *                  total, and directly comparable to it because it is the same quantity minus a
   *                  term that used to be misfiled as kept.
   *   *.coerced      the recorded action was not a click and was removed. A CORRECTION, not a loss.
   *                  Its own ceiling, because it is a rate that should track the metagame's use of
   *                  Encore and phazing and nothing else.
   *   *.dropped      retained as the TOTAL so nothing vanishes from the ledger, and explicitly
   *                  marked superseded in data/degradation-budgets.json.
   */
  const pw = read('policy-weights.json');
  if (pw && pw.matching && pw.matching.seen) {
    const m = pw.matching;
    const coerced = m.coerced || 0;
    out['fit_policy.unmatchedClicks'] = { from: 'artifact', artifact: 'policy-weights.json', unit: 'human actions seen by fit_policy', hits: m.unmatched, of: m.seen,
      what: 'human clicks the move fit could not match to a candidate, so the decision was dropped from training' };
    out['fit_policy.decisionsUnreadable'] = { from: 'artifact', artifact: 'policy-weights.json', unit: 'human actions seen by fit_policy', hits: m.seen - m.kept - coerced, of: m.seen,
      what: 'decisions discarded because the CLICK could not be read (unmatched, ambiguous, trivial, no sheet, no user). '
          + 'Excludes coerced actions, which are not clicks at all. Successor to decisionsDropped.' };
    out['fit_policy.coercedActions'] = { from: 'artifact', artifact: 'policy-weights.json', unit: 'human actions seen by fit_policy', hits: coerced, of: m.seen,
      what: 'recorded actions the protocol shows were NOT clicks — Encore overrode the choice, or a phazing move '
          + 'dragged the mon in — removed from the labeled set rather than fitted with a wrong label' };
  } else if (pw) {
    out['fit_policy.unmatchedClicks'] = { pending: true,
      what: 'policy-weights.json predates the `matching` block — it will populate on the next fit' };
  }

  const jw = read('policy-weights-joint.json');
  if (jw && jw.matching && jw.matching.turnsSeen) {
    const m = jw.matching;
    const coerced = m.coerced || 0;
    out['fit_joint.turnsUnreadable'] = { from: 'artifact', artifact: 'policy-weights-joint.json', unit: 'joint turns (both slots acting) seen by fit_joint', hits: m.turnsSeen - m.kept - coerced, of: m.turnsSeen,
      what: 'joint turns the pair fit could not use because a CLICK could not be read — the defect that had it '
          + 'fitting 74 weights on 30% of the data. Successor to turnsDropped; excludes coerced turns.' };
    out['fit_joint.coercedTurns'] = { from: 'artifact', artifact: 'policy-weights-joint.json', unit: 'joint turns (both slots acting) seen by fit_joint', hits: coerced, of: m.turnsSeen,
      what: 'joint turns voided because at least one of the two recorded actions was not a click' };
  }

  const ce = read('chomp-ev.json');
  if (ce && ce.n_human_games) {
    out['chomp_ev.unbuildableGames'] = { from: 'artifact', artifact: 'chomp-ev.json', unit: 'human games in the CHOMP evaluation set', hits: ce.n_skipped_unbuildable || 0, of: ce.n_human_games,
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
    /* THE GRANULARITY IS PART OF THE CEILING. Every row used to say "over 120 corpus games", which
     * was true of the three board.js counters and FALSE of every fitter rate — those come out of an
     * artifact written over the whole corpus. A ceiling whose denominator is misdescribed cannot be
     * re-derived by anyone, which is the thing this pass exists to fix. */
    budgets[k] = {
      max_rate: Math.min(measured, old),          // may only tighten
      measured_at: m.from === 'artifact'
        ? `${m.hits}/${m.of} read from data/${m.artifact} (written over the whole fit corpus)`
        : `${m.hits}/${m.of} over ${GAMES} corpus games + ${SELFPLAY_GAMES} self-play games`,
      granularity: m.from === 'artifact' ? m.unit : 'candidate scorings / sheet entries',
      what: m.what,
      target: (prev.budgets && prev.budgets[k] && prev.budgets[k].target) || null,
    };
  }
  /* A RETIRED BUDGET IS RECORDED, NOT DELETED. `--ratchet` rebuilds `budgets` from what the run can
   * measure, so a counter that stops being emitted would simply vanish and its history with it —
   * which is how "we used to hold this to 5.49%" becomes folklore. Anything the previous file held
   * that this run cannot measure is carried into `superseded` with its old ceiling intact. */
  const superseded = Object.assign({}, prev.superseded || {});
  for (const [k, v] of Object.entries(prev.budgets || {})) {
    if (budgets[k]) continue;
    superseded[k] = Object.assign({}, v, {
      retired_because: v.retired_because ||
        'the unit changed under it — see tests/test-degradation-budgets.js artifactRates() and '
        + 'docs/CLICK-CENSORING-FIX.md §4. Kept as history; it is no longer checked.',
    });
  }
  fs.writeFileSync(FILE, JSON.stringify({
    note: 'Ceilings on how often each degradation path may fire. Measured, never chosen. A budget may only be TIGHTENED — loosening one is a decision that must be argued for here, not edited quietly. See tests/test-degradation-budgets.js.',
    workload: `first ${GAMES} clean open-sheet corpus games, scored as fit_policy scores them`,
    budgets,
    superseded,
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
