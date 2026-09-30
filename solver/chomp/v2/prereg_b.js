/* solver/chomp/v2/prereg_b.js — gate (b)'s PRE-REGISTRATION, written only after gate (a) has PASSED and before any game.
 *
 *   node solver/chomp/v2/prereg_b.js
 *   -> solver/chomp/v2/preregistration-gate-b.json   (tracked; refuses to overwrite, refuses if gate (a) did not pass)
 *
 * Gate (b) is an SPRT of CHOMP v2 against CHOMP v1 at equal settings: the same in-battle agent (gen5 MILTANK, 1,000 ms),
 * the same release, the same frozen team pool, honest information, the same harness v1's own gate (b) used
 * (solver/machamp/sprt.js). Only the preview arm differs. This file plays nothing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const OUT = path.join(__dirname, 'preregistration-gate-b.json');
if (fs.existsSync(OUT)) { console.error('prereg_b: ' + OUT + ' exists; a pre-registration is written once'); process.exit(2); }
const MET = path.join(__dirname, 'model', 'chomp2.metrics.json');
const met = JSON.parse(fs.readFileSync(MET, 'utf8'));
if (met.gate_a_verdict !== 'PASS' || met.break || met.dev) { console.error('prereg_b: gate (a) is ' + met.gate_a_verdict + '; gate (b) is not pre-registered'); process.exit(3); }
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const REL = 'eaa5becc54eb', STORE = 'data/team-pool-frozen-regmc';
const X = 'solver/chomp/v2/specs/gen5-chomp2.json', Y = 'solver/chomp/v1/specs/gen5-chomp1.json';
const P = {
  what: 'CHOMP v2 gate (b) pre-registration (solver/chomp/v2/prereg_b.js). Written after gate (a) passed and before any gate (b) game.',
  written: new Date().toISOString(),
  gate_a: { verdict: met.gate_a_verdict, pooled: met.gate_a['T1+T2'], selected: met.selected, metrics_sha256: sha(MET) },
  question: 'does CHOMP v2 (the selected scorer) pick better brings and leads than CHOMP v1, everything else equal?',
  x: { spec: X, sha256: sha(path.join(__dirname, '..', '..', '..', X)), preview: 'chomp2', model: 'solver/chomp/v2/model/chomp2.json', model_sha256: sha(path.join(__dirname, 'model', 'chomp2.json')) },
  y: { spec: Y, sha256: sha(path.join(__dirname, '..', '..', '..', Y)), preview: 'chomp1', model: 'solver/chomp/v1/model/chomp1.json', model_sha256: sha(path.join(__dirname, '..', 'v1', 'model', 'chomp1.json')) },
  equal_settings: 'both sides gen5 MILTANK at 1,000 ms (the same mag/doduo/pory2 files, k1 4, k2 4, depth 0, reserveSwitch 1); the preview arm is the ONLY difference; both CHOMPs sample their mix with the per-game, per-side coin of solver/chomp/arms.js',
  harness: 'solver/machamp/sprt.js',
  release: REL, team_store: STORE, info: 'honest',
  sprt: { elo0: 0, elo1: 20, alpha: 0.05, beta: 0.05, max_games: 2000, seed: 89, workers: 3, read: 'once, at a bound or at the budget' },
  pass: 'SPRT accepts H1',
  on_h0_or_budget: 'v2 is not promoted; the arm and the model stay on main unused (as v1 was before its gate (b))',
  caveat: met.selected.features === 'set+field'
    ? 'the arena fields every body at the engine table stat line (solver/arena/teams.js), so a set-spread scorer models bodies the arena does not play; gate (b) then tests v2 under that mismatch and can only understate a spread gain'
    : 'the selected scorer reads the table stat line, which is what the arena fields, so there is no spread mismatch in gate (b)',
  command: 'tools\\lownode.cmd solver\\machamp\\sprt.js --release ' + REL + ' --x ' + X + ' --y ' + Y + ' --elo0 0 --elo1 20 --alpha 0.05 --beta 0.05 --max-games 2000 --seed 89 --workers 3 --info honest --team-store ' + STORE + ' --out solver/out/chomp/v2/sprt/chomp2-vs-chomp1.json',
};
fs.writeFileSync(OUT, JSON.stringify(P, null, 1) + '\n');
console.log('wrote', OUT);
