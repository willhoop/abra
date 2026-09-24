/* probe_medicham_api_differential.js -- engine/medicham_api.js inside the whole-game differential (HEAVY, on demand).
 * T4 (--part step): step() leaves the differential byte-identical. T3 (--part legal): legalActions == the authority.
 *
 *   node tests/probe_medicham_api_differential.js --regulation regmc --release <id> [--part step|legal|all] \
 *        [--baseline-release <id>] [--games 45] [--team-store <dir>] [--census <pin>] [--no-red]
 *
 * A PROBE, NOT A SUITE CHECK: every arm is a full differential run (20-50 s each at --games 45), so it is run by hand,
 * through tools\lownode.cmd, with its flags recorded. The fast half of the API's acceptance (clone round trip, step
 * purity, interleaving) is tests/test-medicham-api.js, which the suite runs.
 *
 * THE ARMS, each a full run of engine/game_differential.js on ONE release, ONE census pin, ONE team store and ONE
 * `--games` (all printed), in the empirical/middle/end-state configuration the gate reads:
 *   plain       the instrument as committed.
 *   base        (with --baseline-release) the same run on a release cut from the commit BEFORE this change: the engine
 *               edits that came with the API (the opt-in battle scope, the exports) must not move a single game.
 *   inplace     every turn routed through API.stepInPlace (tests/medicham_api_diffhook.js, a PRELOAD -- the instrument's
 *               own bytes are not edited, so its `driver_code` stamp is unchanged).
 *   clone       the SHADOW STEP: every real turn is also played on API.clone(S) by API.stepInPlace -- the body of
 *               API.step -- on a replay of the real turn's dice, and must reach the same digest and protocol.
 *   legal       state mode (the loop stops at the first parted board, so every probed turn stands on agreeing boards);
 *               at every move request API.legalActions(S, side) is compared with the authority's own legal set.
 * STEP PASSES when every arm's per-game sample fingerprint (MEDI_SAMPLE_DUMP: config, seed, turns, lines, board parting,
 * sha of medicham's whole stream) is byte-identical to `plain`, every artifact is identical outside the stamp fields in
 * STAMPS (and, for the base arm only, the two fields that NAME the release: BASE_ONLY), and every shadow turn agrees.
 * LEGAL PASSES with zero disagreeing slots over a non-zero number of compared slots. A disagreement is printed by CAUSE,
 * read off the authority's own `disabledSource`: the API reads the engine's menu (`selectableMoves`), so a disagreement
 * is the ENGINE's menu differing from the game's, and each cause is open ENGINE work.
 *
 * RED, unless --no-red: MEDI_API_CLONE_DROP=_vol (the clone loses one body field) must fail the shadow step, and
 * MEDI_API_MEGA_ALWAYS=1 must make the legal probe disagree. A part that cannot go red on its break is blind: exit 3.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);
const REG = flag('--regulation', process.env.ABRA_REGULATION || null);
const RELEASE = flag('--release', null);
const BASE = flag('--baseline-release', null);
const GAMES = flag('--games', '45');
const CENSUS = flag('--census', null);
let STORE = flag('--team-store', null);
const NO_RED = has('--no-red');
const PART = flag('--part', 'all');
const DO_STEP = PART === 'all' || PART === 'step', DO_LEGAL = PART === 'all' || PART === 'legal';

function cannot(why) { console.log('ABRA-EXIT 2 CANNOT-ANSWER'); console.log('CANNOT ANSWER: ' + why); process.exit(2); }
if (!RELEASE) cannot('--release <id> is required: the differential measures a frozen release, never the live tree');
if (!STORE) {
  try { const RS = require('../engine/regulation_stores.js'); const p = RS.pool(); if (p) STORE = path.join(ROOT, p.dir); }
  catch (e) { cannot('no team store: ' + e.message.split('\n')[0] + ' (pass --team-store)'); }
}
if (!STORE) cannot('the selected regulation has no frozen pool; pass --team-store');

const SCR = path.join(ROOT, 'data', '_scratch-api-t4');   // gitignored (data/_scratch-*); the differential writes under data/ only
fs.mkdirSync(SCR, { recursive: true });
/* the hook's own reports go OUTSIDE data/: under a selected regulation, engine/regulation.js refuses a rewrite of an
 * unsuffixed file there, and the hook writes at process exit */
const HOOK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'abra-api-t4-'));
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function run(name, release, extraEnv, extraArgs) {
  const sample = path.join(SCR, name + '-sample.json'), out = path.join(SCR, name + '-gd.json');
  for (const f of [sample, out]) { if (fs.existsSync(f)) fs.unlinkSync(f); }
  const args = [];
  if (extraEnv && (extraEnv.MEDI_API_HOOK || extraEnv.MEDI_API_LEGAL_PROBE)) args.push('-r', path.join(__dirname, 'medicham_api_diffhook.js'));
  args.push(path.join(ROOT, 'engine', 'game_differential.js'));
  if (REG) args.push('--regulation', REG);
  args.push('--steering', 'empirical', '--arm', 'middle');
  if (!(extraArgs || []).includes('--state')) args.push('--end-state');
  if (CENSUS) args.push('--census', CENSUS);
  args.push('--team-store', STORE, '--release', release, '--games', String(GAMES), '--write', '--out', rel(out));
  args.push(...(extraArgs || []));
  const env = Object.assign({}, process.env, { MEDI_SAMPLE_DUMP: rel(sample) }, extraEnv || {});
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 30 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status !== 0) {
    console.log('  ' + name + ': the differential exited ' + r.status + ' after ' + secs + 's');
    console.log((r.stderr || '').split('\n').slice(-12).join('\n'));
    return { name, failed: true };
  }
  console.log('  ' + name + ': ran in ' + secs + 's');
  return { name, sample: JSON.parse(fs.readFileSync(sample, 'utf8')), gd: JSON.parse(fs.readFileSync(out, 'utf8')) };
}

/* Fields that name WHICH run this was rather than WHAT it measured. Anything else that differs is a finding. */
const STAMPS = new Set(['generated', 'elapsed_s', 'engine_release', 'engine_release_cut', 'engine_release_cuts',
  'source_digests', 'showdown_commit']);
/* Two more that NAME the engine and so differ exactly when the release does -- allowed for the base arm and no other:
 * `steering.driver_inputs[].read_from` ("release <id>") and `steering.alignment_inputs[].medicham2_played` (the digest
 * of the engine file that played). */
const BASE_ONLY = /^steering\.(driver_inputs\.\d+\.read_from|alignment_inputs\.\d+\.medicham2_played)$/;
function diffPaths(a, b, p, out) {
  if (out.length > 30) return out;
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { out.push(p); return out; }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(p); return out; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!p && STAMPS.has(k)) continue;
    /* the wall clock inside nested blocks (e.g. elapsed timings) */
    if (/(^|_)(elapsed|secs|seconds|ms|at|generated|time|started|finished)$/i.test(k) && typeof a[k] !== 'object') continue;
    diffPaths(a[k], b[k], p ? p + '.' + k : k, out);
  }
  return out;
}
function sameSample(x, y) {
  const a = JSON.stringify(x.sample.arms), b = JSON.stringify(y.sample.arms);
  if (a === b) return { same: true, games: x.sample.arms.reduce((n, r) => n + r.games.length, 0) };
  const out = [];
  x.sample.arms.forEach((arm, i) => arm.games.forEach((g, j) => {
    const h = y.sample.arms[i] && y.sample.arms[i].games[j];
    if (JSON.stringify(g) !== JSON.stringify(h)) out.push(g.seed + ' ' + (g.trace + ' vs ' + (h && h.trace)));
  }));
  return { same: false, differing: out };
}

let fail = 0;
const ok = (c, msg) => { console.log((c ? '  ok    ' : '  FAIL  ') + msg); if (!c) fail++; };
console.log('probe_medicham_api_differential: part ' + PART + ', release ' + RELEASE + (BASE ? ' baseline ' + BASE : '') + ' --games ' + GAMES
  + ' census ' + (CENSUS || '(default)') + ' team store ' + STORE + ' regulation ' + (REG || '(default)'));

const plain = run('plain', RELEASE, {});
if (plain.failed) cannot('the plain arm did not run, so no arm can be compared');
const games = plain.sample.arms.reduce((n, r) => n + r.games.length, 0);
ok(games > 0, 'the plain arm played ' + games + ' games');

const compareArm = (arm, label, isBase) => {
  if (arm.failed) { ok(false, label + ': did not run'); return false; }
  const s = sameSample(plain, arm);
  const d = diffPaths(plain.gd, arm.gd, '', []).filter(x => !(isBase && BASE_ONLY.test(x)));
  ok(s.same, label + ': per-game sample fingerprint ' + (s.same ? 'byte-identical over ' + s.games + ' games'
    : 'DIFFERS in ' + s.differing.length + ' games, first ' + s.differing.slice(0, 3).join(' ; ')));
  ok(!d.length, label + ': artifact identical outside the run stamps' + (d.length ? ' -- DIFFERS at ' + d.slice(0, 8).join(', ') : ''));
  return s.same && !d.length;
};
if (DO_STEP && BASE) compareArm(run('base', BASE, {}), 'T4 base release ' + BASE + ' vs ' + RELEASE, true);
if (DO_STEP) compareArm(run('inplace', RELEASE, { MEDI_API_HOOK: 'inplace' }), 'T4 via API.stepInPlace');
const shadowFile = path.join(HOOK_DIR, 'shadow.json');
if (DO_STEP) {
compareArm(run('clone', RELEASE, { MEDI_API_HOOK: 'clone', MEDI_API_HOOK_OUT: shadowFile }), 'T4 shadow step (API.clone + stepInPlace) does not move the game');
{
  const H = fs.existsSync(shadowFile) ? JSON.parse(fs.readFileSync(shadowFile, 'utf8')) : null;
  ok(H && H.turns_clone > 0, 'T4 the shadow step ran on ' + (H ? H.turns_clone : 0) + ' turns (a zero is the finding)');
  ok(H && H.shadow_disagree === 0, 'T4 the copy, stepped on the real turn dice, equals the real turn: state digest, protocol and dice consumed'
    + (H && H.shadow_disagree ? ' -- ' + H.shadow_disagree + ' of ' + H.turns_clone + ' turns differ, first ' + JSON.stringify(H.shadow_disagreements[0]).slice(0, 900) : ''));
  if (H) console.log('        shadow: ' + H.turns_clone + ' turns, ' + H.shadow_agree + ' agree, ' + H.shadow_untraced + ' of them on untraced battles');
}
}

const probeFile = path.join(HOOK_DIR, 'legal-probe.json');
if (DO_LEGAL) {
const legalPlain = run('legal-plain', RELEASE, {}, ['--state']);
const legal = run('legal', RELEASE, { MEDI_API_LEGAL_PROBE: probeFile }, ['--state']);
if (!legalPlain.failed && !legal.failed) {
  const s = sameSample(legalPlain, legal);
  ok(s.same, 'T3 the probe does not move the game: sample ' + (s.same ? 'byte-identical over ' + s.games + ' games' : 'DIFFERS in ' + s.differing.length));
  const P = JSON.parse(fs.readFileSync(probeFile, 'utf8'));
  console.log('        probe: ' + JSON.stringify({ turns: P.probe_turns, slots: P.slots, agree: P.slots_agree,
    disagree: P.slots_disagree, forced: P.forced_slots, mega_offered: P.mega_offered_slots, switch_slots: P.switch_slots,
    struggle: P.struggle_slots, hidden_trapped: P.hidden_trapped, hidden_disabled: P.hidden_disabled || 0, empty_target_options: P.empty_target_options,
    turn_mismatch: P.probe_turn_mismatch }));
  ok(P.slots > 0 && P.probe_turns > 0, 'T3 the probe compared ' + P.slots + ' slots on ' + P.probe_turns + ' turns (a zero is the finding)');
  ok(P.slots_disagree === 0, 'T3 legalActions == the authority on every compared slot'
    + (P.slots_disagree ? ' -- ' + P.slots_disagree + ' of ' + P.slots + ' disagree' : ''));
  if (P.slots_disagree) {
    /* BY CAUSE: the authority's own reason for each option it refused and the API offered, or the option it offered
     * and the API did not. The API reads the engine's menu, so every cause here is the ENGINE's menu. */
    const causes = {};
    const add = (k, body) => { causes[k] = causes[k] || { slots: 0, bodies: new Set() }; causes[k].slots++; causes[k].bodies.add(body); };
    for (const d of P.disagreements) {
      const slots = (d.sd_state && d.sd_state.slots) || [];
      const seen = new Set();
      for (const x of d.extra) {
        const mv = (x.match(/^move:([a-z0-9]+)/) || [])[1];
        if (mv && seen.has(mv)) continue;
        if (mv) seen.add(mv);
        const sl = mv ? slots.find(z => z.startsWith(mv + ':')) : null;
        const why = sl && sl.includes(':dis=') ? sl.split(':dis=')[1] : (x.startsWith('switch:') ? 'trapped' : '?');
        add('engine OFFERS ' + (mv || x) + ', the authority refuses it (' + why + ')', d.body);
      }
      for (const x of d.missing) add('engine LACKS ' + x, d.body);
    }
    for (const [k, v] of Object.entries(causes)) console.log('        cause: ' + k + ' -- ' + v.slots + ' slot(s), ' + [...v.bodies].join(', '));
    console.log('        (the first ' + P.disagreements.length + ' disagreeing slots, with both engines\' state for the body: ' + probeFile + ')');
  }
} else ok(false, 'T3 a probe arm did not run');
}

if (!NO_RED) {
  console.log('  RED ARMS -- each must FAIL, or the check above is blind:');
  let blind = 0;
  if (DO_STEP) {
  const rf = path.join(HOOK_DIR, 'shadow-red.json');
  const red1 = run('red-clone-drop', RELEASE, { MEDI_API_HOOK: 'clone', MEDI_API_HOOK_OUT: rf, MEDI_API_CLONE_DROP: '_vol' });
  const H1 = !red1.failed && fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : null;
  const r1 = !!H1 && H1.shadow_disagree === 0;
  console.log('    MEDI_API_CLONE_DROP=_vol  -> ' + (r1 ? 'STILL GREEN (blind)' : 'red, as it must be (' + (H1 ? H1.shadow_disagree + ' of ' + H1.turns_clone + ' shadow turns differ' : 'did not run') + ')'));
  if (r1) blind++;
  }
  if (DO_LEGAL) {
  const pf = path.join(HOOK_DIR, 'legal-probe-red.json');
  const red2 = run('red-mega', RELEASE, { MEDI_API_LEGAL_PROBE: pf, MEDI_API_MEGA_ALWAYS: '1' }, ['--state']);
  const P2 = red2.failed ? null : JSON.parse(fs.readFileSync(pf, 'utf8'));
  const r2 = P2 && P2.slots_disagree === 0;
  console.log('    MEDI_API_MEGA_ALWAYS=1    -> ' + (r2 ? 'STILL GREEN (blind)' : 'red, as it must be (' + (P2 ? P2.slots_disagree + ' slots disagree' : 'did not run') + ')'));
  if (r2) blind++;
  }
  if (blind) { console.log('ABRA-EXIT 3 VERDICT-RED'); console.log('BLIND: ' + blind + ' red arm(s) stayed green'); process.exit(3); }
}
if (fail) { console.log('ABRA-EXIT 1 VERDICT-RED'); console.log('FAIL: ' + fail); process.exit(1); }
console.log('ABRA-EXIT 0 VERDICT-GREEN');
console.log('PASS');
