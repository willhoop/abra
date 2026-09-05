/* probe_protect_amplification.js — DOES THE EMPIRICAL DRIVER CLICK PROTECT AT THE RATE IT CLAIMS?
 *
 * ROADMAP: docs/_reports/2026-09-05-cap-or-stall.md §6 owed item 1, and
 *          docs/_reports/2026-09-05-protect-amplification.md.
 *
 * ================= WHAT THIS ASKS ================================================================
 *
 * `empirical-click/v1` is a BEHAVIOUR CLONE: its whole claim is that the click distribution is the
 * one in `data/move-priors.json`. That claim is checkable without a second measurement, because the
 * table says what its own protect-family share is — 13.565%, acts-weighted over 435,700 recorded
 * human acts. On 2026-09-05 the arm realised **32.8%** of its clicks as a protect-family move and
 * protected again after protecting **68.6%** of the time, against 10.5% for real humans in
 * `data/team-pool-frozen/games.bo3.jsonl` (8,388 games, 190,954 clicks). The arm was not sampling
 * the table it declared.
 *
 * The cause was not the weights: on decisions where the body had its full four moves the arm already
 * realised 15.3% protect. It was the `prefer` axis of `game_differential.js`'s `DRIVER_AXES` being a
 * HARD narrowing at every decision, in the two configurations of nine whose preferred set contains
 * the protect family — so 22.2% of decisions reached the sampler with ONE candidate. See
 * engine/empirical_driver.js's `preferPool` for the full account.
 *
 * ================= THE THREE BARS, AND WHY NONE OF THEM IS A TUNED NUMBER ==========================
 *
 *   (a) `prefer_narrowed` must read 0 — the mechanism itself, read out of the run's own counters.
 *   (b) the realised protect share must be under TWICE the driver's own input share. That is not a
 *       chosen threshold: "the driver realises more than double its own input rate" IS the defect,
 *       quoted from the measurement that found it. The input share is read from the table at run
 *       time, never typed, so the bar moves when the table does.
 *   (c) P(protect | this slot protected last turn) must be under twice the realised share. A move
 *       that fails when repeated is NEGATIVELY autocorrelated in real play — humans read 0.71x their
 *       own marginal. The defect read 2.09x. A driver drawing without memory reads about 1.0x plus
 *       whatever per-body heterogeneity it has.
 *
 * NO BAR IS SET TO A HUMAN RATE. This probe deliberately does not require the driver to hit 14.76%:
 * the arm's contract is with its input table, and tuning to the human number would hide a table that
 * has drifted away from human play. The human figures are PRINTED beside the result as context.
 *
 * ================= SHOW IT RED ====================================================================
 *
 *   MEDI_PREFER_HARD=1 node tests/probe_protect_amplification.js --release <id>
 *
 * restores the pre-2026-09-05 hard narrowing and this probe fails on (a), (b) and (c) together.
 *
 * ================= HOW IT MEASURES ================================================================
 *
 * It plays a small pinned swarm through `engine/game_differential.js` and reduces MEDICHAM2'S OWN
 * EMITTED STREAM (`MEDI_TRACE_DUMP`), which is the same reduction docs/_reports/2026-09-05-cap-or-
 * stall.md §2a used and the same shape the human ruler is measured in — a click that reached the
 * board, not a decision the driver took. The protect family is derived from `data/tags.json`'s
 * `shieldsUser` tag; no move name is typed anywhere in this file.
 *
 * ABRA-HEAP: 4096
 * Run: node tests/probe_protect_amplification.js [--release <id>] [--games 60]
 * Exit 0 green, 1 red, 2 could not run (which is NOT a pass).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const D = (...p) => path.join(__dirname, '..', ...p);

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const REL = flag('--release', null);
const GAMES = flag('--games', '60');
const CENSUS = flag('--census', 'data/verification/census-pin-9446a684709d.json');
const POOL = flag('--team-store', 'data/team-pool-frozen');

/* ---- THE FAMILY AND THE INPUT RATE, BOTH DERIVED -------------------------------------------------
 * `shieldsUser` is the tag `engine/tag_dex.js` derives for a one-turn guard. The table's own `kind`
 * field agrees with it on every member this format can reach; they are cross-checked here rather
 * than one being trusted, because two spellings of one set is this repository's recurring failure. */
const TAGS = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
const FAMILY = new Set(Object.entries(TAGS.moves)
  .filter(([, v]) => (v.tags || []).includes('shieldsUser')).map(([k]) => k));
const EMP = require('../engine/empirical_driver.js');
const PRIORS = EMP.loadPriors(fs.readFileSync(D('data', 'move-priors.json'), 'utf8'),
                              'data/move-priors.json');
const INPUT_PCT = PRIORS.input_family_share_pct;
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

if (!FAMILY.size) { console.error('RED — data/tags.json derived an EMPTY shieldsUser set; the probe '
  + 'would measure nothing and report green.'); process.exit(2); }
{
  const tableFamily = new Set(PRIORS.family);
  const missing = [...tableFamily].filter(m => !FAMILY.has(m));
  if (missing.length) {
    console.error('RED — data/move-priors.json calls these `kind: protect` and data/tags.json does not '
      + 'tag them shieldsUser: ' + missing.join(', ') + '. The two definitions of the family have '
      + 'drifted, and every number below would depend on which one was read.');
    process.exit(2);
  }
}

console.log('PROTECT AMPLIFICATION — is empirical-click/v1 sampling the table it declares?');
console.log('  family (data/tags.json shieldsUser):   ' + [...FAMILY].sort().join(', '));
console.log('  the driver\'s OWN input share:          ' + INPUT_PCT + '%  '
  + '(data/move-priors.json, acts-weighted over ' + PRIORS.acts + ' recorded acts)');
console.log('  context, not a bar — real humans:      14.76% of 190,954 clicks, repeat rate 10.50%');
console.log('      (data/team-pool-frozen/games.bo3.jsonl, 8,388 games, bots and forfeits dropped)');
console.log('  MEDI_PREFER_HARD=' + (process.env.MEDI_PREFER_HARD || '(unset)')
  + (EMP.PREFER_HARD ? '   <-- the pre-fix hard narrowing is ON; this run should be RED' : ''));

/* ---- PLAY -------------------------------------------------------------------------------------- */
const trace = path.join(os.tmpdir(), 'abra-protect-probe-' + process.pid + '.json');
const args = ['engine/game_differential.js', '--arm', 'middle', '--census', CENSUS,
              '--games', GAMES, '--team-store', POOL, '--steering', 'empirical'];
if (REL) args.push('--release', REL);
console.log('\n  node ' + args.join(' ') + '\n');
const t0 = Date.now();
/* THROUGH `tools/lownode.cmd`, per CLAUDE.md: this plays real games and pins every core. Node >= 20
 * refuses to spawn a .cmd directly (the 2024 batch-injection advisory), so it goes through cmd.exe
 * with no `shell: true` — which would reintroduce the quoting hazard that refusal exists to prevent. */
const LOW = D('tools', 'lownode.cmd');
const useLow = process.platform === 'win32' && fs.existsSync(LOW);
const r = useLow
  ? spawnSync('cmd.exe', ['/c', LOW].concat(args), {
      cwd: D('.'), encoding: 'utf8', maxBuffer: 1 << 28,
      env: Object.assign({}, process.env, { MEDI_TRACE_DUMP: trace }) })
  : spawnSync(process.execPath, args, {
      cwd: D('.'), encoding: 'utf8', maxBuffer: 1 << 28,
      env: Object.assign({}, process.env, { MEDI_TRACE_DUMP: trace }) });
const out = (r.stdout || '') + (r.stderr || '');
/* THE EXIT CODE IS NOT THE EVIDENCE. A run that plays every game and then dies writing a dump exits
 * non-zero with a complete measurement behind it, and a run that dies at second zero exits non-zero
 * too. What separates them is whether the artifact is there and how big it is. */
if (!fs.existsSync(trace)) {
  console.error('\nCOULD NOT RUN — no trace was written to ' + trace + ' (exit ' + r.status + ').');
  console.error(out.split('\n').slice(-25).join('\n'));
  process.exit(2);
}
const T = JSON.parse(fs.readFileSync(trace, 'utf8'));
const games = (T.arms || []).flatMap(a => a.games || []);
if (!games.length) { console.error('\nCOULD NOT RUN — the trace carries no games.'); process.exit(2); }

/* ---- REDUCE ------------------------------------------------------------------------------------
 * One `|move|` line is one click that reached the board. `[from]` lines are a move CALLED by another
 * effect and are not a decision; they are excluded so the denominator is the same one the human ruler
 * and `move-priors.json` are measured in. */
let clicks = 0, fam = 0, repDen = 0, repNum = 0, both = 0, bothTurns = 0;
let turns = 0, ended = 0, capped = 0;
for (const g of games) {
  if (g.ended_medi && g.ended_sd) ended++; else capped++;
  turns += g.turns || 0;
  const lastProt = new Map();
  let turnNo = 0, thisTurn = new Map();
  const flush = () => {
    for (const side of ['p1', 'p2']) {
      const slots = [...thisTurn.keys()].filter(s => s.startsWith(side));
      if (slots.length === 2) { bothTurns++; if (slots.every(s => thisTurn.get(s))) both++; }
    }
    lastProt.clear();
    for (const [k, v] of thisTurn) lastProt.set(k, v);
    thisTurn = new Map();
  };
  for (const line of (g.trace || [])) {
    if (line.startsWith('|turn|')) { if (turnNo) flush(); turnNo++; continue; }
    if (!line.startsWith('|move|')) continue;
    if (line.includes('[from]')) continue;
    const p = line.split('|');            // '', 'move', 'p1a: Name', 'Move Name', target, ...
    const slot = String(p[2] || '').split(':')[0].trim();
    const mv = norm(p[3]);
    if (!slot) continue;
    const isFam = FAMILY.has(mv);
    clicks++; if (isFam) fam++;
    if (lastProt.get(slot)) { repDen++; if (isFam) repNum++; }
    thisTurn.set(slot, isFam);
  }
  if (turnNo) flush();
}

/* ---- THE DRIVER'S OWN COUNTERS, OUT OF THE RUN'S PRINTED BLOCK ---------------------------------- */
const grab = re => { const m = out.match(re); return m ? m[1] : null; };
const narrowed = grab(/^ +(\d+) decisions narrowed by a pair-\* prefer axis/m);
const realisedLine = grab(/protect family: ([\d.]+)% of \d+ sampled clicks realised/m);

const pct = (a, b) => b ? +(100 * a / b).toFixed(2) : 0;
const realised = pct(fam, clicks);
const repeat = pct(repNum, repDen);
const bothPct = pct(both, bothTurns);

console.log('  ' + games.length + ' games, ' + turns + ' turns, ' + ended + ' ended naturally, '
  + capped + ' truncated   (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
console.log('\nMEASURED OFF MEDICHAM2\'S EMITTED STREAM (' + clicks + ' clicks)');
console.log('  protect-family share of clicks            ' + realised + '%'
  + '   (the driver\'s own input says ' + INPUT_PCT + '%)');
console.log('  P(protect | same slot protected last turn) ' + repeat + '%   over ' + repDen);
console.log('  both actives protect on the same turn      ' + bothPct + '%   over ' + bothTurns);
console.log('  the driver\'s own counter said              ' + (realisedLine || '?')
  + '% of sampled decisions   (a decision, not a click — switches and forced clicks differ)');

let red = 0;
const check = (okc, what, detail) => {
  if (okc) console.log('  ok   ' + what);
  else { red++; console.log('  FAIL ' + what + (detail ? '\n         ' + detail : '')); }
};
console.log('\nBARS');
check(narrowed !== null && +narrowed === 0,
  'the pair-* prefer axis narrowed no decision',
  'the run reports ' + narrowed + ' narrowed decisions — the coverage arm\'s staging device is '
  + 'overriding the behaviour clone');
check(realised < 2 * INPUT_PCT,
  'the realised protect share is under twice the driver\'s own input rate',
  realised + '% realised against a ' + INPUT_PCT + '% input — the arm is not sampling its table');
check(repeat < 2 * realised,
  'protecting does not make protecting again more than twice as likely',
  repeat + '% after a protect against a ' + realised + '% marginal — a memoryless draw cannot do '
  + 'that, so something outside the table is choosing');

if (EMP.PREFER_HARD && !red) {
  console.log('\nRED — MEDI_PREFER_HARD=1 restored the defect and every bar still passed. The probe '
    + 'cannot see the thing it was built to see.');
  process.exit(1);
}
try { fs.unlinkSync(trace); } catch (e) { console.log('  (left ' + trace + ' behind: ' + e.message + ')'); }
console.log(red ? '\nRED — ' + red + ' of 3 bars failed.' : '\nGREEN — all 3 bars passed.');
process.exit(red ? 1 : 0);
