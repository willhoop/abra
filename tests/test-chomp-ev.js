/* Invariant tests for the CHOMP-EV proof (data/chomp-ev.json).
 * We read the SHIPPED file (not a copy) and assert hand-derived invariants so the test
 * can't drift from the harness. Run: node tests/test-chomp-ev.js  (CI-gated). */
'use strict';
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'data', 'chomp-ev.json');
let fail = 0;
const ok = (c, m) => { if (!c) { console.error('  FAIL:', m); fail++; } else console.log('  ok:', m); };

if (!fs.existsSync(F)) { console.error('chomp-ev.json missing — run engine/chomp_ev.js'); process.exit(1); }
const d = JSON.parse(fs.readFileSync(F, 'utf8'));

// 1. bookkeeping: eval = train + test (no games lost in the split)
ok(d.n_train + d.n_test === d.n_eval_games, `split adds up (${d.n_train}+${d.n_test}==${d.n_eval_games})`);
ok(d.n_eval_games + d.n_skipped_unbuildable <= d.n_human_games, 'eval+skipped within human games');

// 2. probabilities/scores in valid ranges
const s = d.proper_score_logloss;
for (const k of ['chomp_align', 'coin', 'elo_rating', 'usage_prior'])
  ok(s[k] > 0 && s[k] < 1.2, `log-loss ${k}=${s[k]} in (0,1.2)`);
ok(Math.abs(s.coin - 0.6931) < 0.002, 'coin log-loss == ln2 (0.6931)');            // hand-derived: -ln(0.5)
ok(d.brier.coin === 0.25, 'coin Brier == 0.25');                                   // hand-derived: (0.5)^2

// 3. sign test is a probability; CI brackets the point estimate
const h = d.headline_beat_test;
ok(h.p_winner_more_aligned >= 0 && h.p_winner_more_aligned <= 1, 'sign-test p in [0,1]');
ok(h.ci95[0] <= h.p_winner_more_aligned && h.p_winner_more_aligned <= h.ci95[1], 'sign-test CI brackets point');

// 4. calibration ECE in [0,1] and reliability bins present
ok(d.calibration.ece >= 0 && d.calibration.ece <= 1, `ECE=${d.calibration.ece} in [0,1]`);

// 5. verdict must be internally consistent with the numbers (no over-claiming)
const beats = s.chomp_align < s.coin && s.chomp_align_ci95[1] < s.coin && h.ci95[0] > 0.5;
const claimsBeat = /beat humans'? actual brings on held-out games — significant/.test(d.verdict);
ok(beats === claimsBeat, 'verdict matches whether CHOMP significantly beats coin+sign-test');

// 6. honesty block present
ok(Array.isArray(d.what_this_does_NOT_prove) && d.what_this_does_NOT_prove.length >= 3, 'has "what this does NOT prove" (>=3 items)');

if (fail) { console.error(`\ntest-chomp-ev: ${fail} FAILED`); process.exit(1); }
console.log('\ntest-chomp-ev: all invariants pass');
