/* triggers.js — things that must happen on a CONDITION nobody is watching for.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two facts about this project were, until now, kept in someone's head:
 *
 *   1. "Re-run the CHOMP proof once we have enough clean games." The current result — winners are
 *      1.36 points more CHOMP-aligned, CI spanning 0.5 — is underpowered, not negative. It needs
 *      about 10,600 clean games to resolve, and we accrue ~443/day. That is a date in three weeks
 *      that nobody would remember.
 *
 *   2. "Notice when the regulation changes." Every prior, team pool and usage table in this project
 *      describes gen9championsvgc2026regmb. When the format rotates, they describe a metagame that
 *      no longer exists — and nothing would say so. The store would simply start filling with games
 *      from a different format while every model kept reporting confidently.
 *
 * Both are conditions on data we already have. S13: if it can be derived, derive it.
 *
 * THE THRESHOLD IS COMPUTED, NOT TYPED. The sample size needed is a function of the effect actually
 * observed, so it is read from the last run rather than hardcoded:
 *
 *     n = (z_{a/2} + z_b)^2 * p(1-p) / d^2      d = |observed - 0.5|
 *
 * If the effect turns out smaller than we thought, the target rises on its own and the trigger stops
 * claiming we are nearly there.
 *
 *   node build/triggers.js            # report, exit 0
 *   node build/triggers.js --fire     # also re-run what is due
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const Q = require(path.join(ROOT, 'engine', 'quality.js'));
const EV = path.join(ROOT, 'data', 'chomp-ev.json');

const Z_ALPHA = 1.959964;   /* two-sided 95% */
const Z_POWER = 0.841621;   /* 80% power */

function requiredN(p) {
  const d = Math.abs(p - 0.5);
  if (!(d > 0)) return Infinity;
  return Math.ceil(Math.pow(Z_ALPHA + Z_POWER, 2) * 0.25 / (d * d));
}

/* Is the CHOMP proof due a re-run? Due when the clean corpus has grown past what the last run needed
 * to resolve the effect that run measured. */
function chompTrigger(cleanN) {
  let ev = null;
  try { ev = JSON.parse(fs.readFileSync(EV, 'utf8')); } catch (e) { return { ok: false, why: 'no chomp-ev.json' }; }
  const beat = ev.headline_beat_test || {};
  const p = beat.p_winner_more_aligned ?? beat.p ?? beat.estimate;
  if (typeof p !== 'number') return { ok: false, why: 'no headline estimate in chomp-ev.json' };
  const need = requiredN(p);
  const lastN = ev.n_eval_games || 0;
  return {
    ok: true, p, need, lastN, cleanN,
    due: cleanN >= need && cleanN > lastN * 1.25,
    /* 1.25 so a trickle of new games does not re-run it every hour once the target is passed */
  };
}

/* Which formats are actually arriving.
 *
 * COMPARED AGAINST THE STORE'S OWN HISTORY, not against a format string in another file. The first
 * version compared the store's `format` field to the one chomp-ev.json records and fired immediately:
 * the store writes "champions-regmb", chomp-ev writes "gen9championsvgc2026regmb". Same format, two
 * naming conventions, and an alarm that cries wolf on day one is worse than no alarm.
 *
 * So the baseline is the modal format across the WHOLE store, and the signal is the recent window
 * diverging from it. That needs no two files to agree on spelling, and it detects the thing we
 * actually care about — new games arriving under a format the corpus was not built from. */
function formatTrigger() {
  const all = Q.readStore();
  if (!all.length) return null;
  const tally = (arr) => {
    const t = {};
    for (const g of arr) if (g.format) t[g.format] = (t[g.format] || 0) + 1;
    return t;
  };
  const hist = tally(all);
  const baseline = Object.entries(hist).sort((a, b) => b[1] - a[1])[0];
  const WINDOW = 2000;
  const recent = tally(all.slice(-WINDOW));
  const rn = Object.values(recent).reduce((a, b) => a + b, 0) || 1;
  /* A single stray record is not a rotation. Fire when a non-baseline format is a real share of the
   * recent window — 5% of 2,000 games is 100 games, which no misparse produces. */
  const intruders = Object.entries(recent)
    .filter(([f, n]) => f !== baseline[0] && n / rn >= 0.05)
    .sort((a, b) => b[1] - a[1]);
  return { baseline, recent, rn, intruders };
}

function main() {
  const fire = process.argv.includes('--fire');
  const cleanN = Q.loadGames().length;
  console.log('TRIGGERS');
  console.log('');

  const c = chompTrigger(cleanN);
  if (!c.ok) {
    console.log('  chomp proof : cannot evaluate — ' + c.why);
  } else {
    console.log(`  chomp proof : effect ${(100 * c.p).toFixed(2)}% vs a 50% coin -> needs ${c.need.toLocaleString()} clean games`);
    console.log(`                have ${c.cleanN.toLocaleString()} (last run used ${c.lastN.toLocaleString()})`);
    if (c.due) {
      console.log('                DUE — the corpus can now resolve this.');
      if (fire) {
        console.log('                re-running engine/chomp_ev.js ...');
        try {
          const out = execFileSync(process.execPath, [path.join(ROOT, 'engine', 'chomp_ev.js')],
            { cwd: ROOT, encoding: 'utf8' });
          const NL = String.fromCharCode(10);
          console.log(out.split(NL).slice(-6).join(NL));
        } catch (e) { console.log('                re-run failed: ' + e.message); }
      }
    } else {
      console.log(`                not yet — ${Math.max(0, c.need - c.cleanN).toLocaleString()} more clean games needed`);
      /* PROJECT THE DATE, because 'not yet' is useless without 'when'. The accrual rate is measured
       * from the clean games' own timestamps -- no rate is typed, and if the ladder slows the
       * projection slips on its own. Compare it against the regulation end date yourself: the
       * corpus stops being about this metagame the moment the format rotates, which is what the
       * format check below is for. */
      const ds = Q.loadGames().map(g => g.date && Date.parse(String(g.date).replace(' ', 'T') + ':00Z'))
        .filter(x => x && !isNaN(x)).sort((a, b) => a - b);
      const span = ds.length > 1 ? (ds[ds.length - 1] - ds[0]) / 86400000 : 0;
      const perDay = span > 0 ? ds.length / span : 0;
      if (perDay > 0) {
        const days = (c.need - c.cleanN) / perDay;
        const eta = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        console.log(`                accruing ${perDay.toFixed(0)} clean/day (over ${span.toFixed(1)} days) -> ~${eta}`);
      }
    }
  }

  const f = formatTrigger();
  if (f) {
    console.log('');
    console.log(`  format      : store baseline is ${f.baseline[0]} (${f.baseline[1].toLocaleString()} games)`);
    for (const [k, n] of Object.entries(f.recent).sort((x, y) => y[1] - x[1])) {
      console.log(`                last ${f.rn}: ${k}  ${n}  (${(100 * n / f.rn).toFixed(1)}%)`);
    }
    if (f.intruders.length) {
      console.log('');
      console.log('  ::warning::REGULATION CHANGE — ' +
        f.intruders.map(([k, n]) => `${k} is ${(100 * n / f.rn).toFixed(1)}% of recent games`).join(', '));
      console.log('  Every prior, team pool and usage table here was derived from ' + f.baseline[0] + '.');
      console.log('  Re-derive before trusting any model, and archive the old regulation first.');
    } else {
      console.log('                no rotation detected');
    }
  }
}

main();
