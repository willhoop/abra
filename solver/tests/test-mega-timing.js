/* solver/tests/test-mega-timing.js — every solver bot megas with human-like TIMING: its share of megas made AFTER the
 * side's first capable turn sits inside the human range, not far outside it.
 *
 *   node solver/tests/test-mega-timing.js [--no-red] [--fast]      exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *   env MEGA_TEST_RELEASE=<id>   the frozen release to play (default eaa5becc54eb, the Reg M-C gate release)
 *
 * WHY (Will, 2026-09-25): delaying a mega can be correct — the mega re-fires its forme's ability, so holding it can win
 * back a weather; a mon can bank a boost first. test-mega-rate.js says WHETHER a bot megas; this says WHEN.
 *
 *   HUMAN     HUMAN_DELAYED_SHARE is a measurement, not a typed number: the first 3,000 human games give a delayed share
 *             within 0.03 of it (the full-dataset figure is solver/out/mega/timing-human.json).
 *   CLASSIFY  the reason classifier on constructed timelines: a mega whose forme's ability sets a weather, held while
 *             that weather was up and made after it was lost, is `field_lost_while_held` + `mega_resets_field`; the same
 *             mega made at once is not delayed; a boost gained before the mega is `boost_banked`; a mon that left and
 *             came back is `switched_out_and_back`. The mega forme is FOUND in the regulation's Dex (legal, a mega, its
 *             ability sets a weather), never typed.
 *   TIMING    arena games on the frozen release, paired seating: for each held bot, the Wilson 95% interval of
 *             delayed/megas is not wholly outside human ± DELAY_MARGIN (solver/arena/mega_timing.js check()).
 *             Fewer than MIN_MEGAS megas = CANNOT ANSWER.
 *
 * RED, unless --no-red: ARENA_BREAK=meganow (mega the first turn it is offered) and ARENA_BREAK=megalate (never on the
 * first capable turn) must each fail TIMING. The red runs play only the fast pair (doduo vs mag).
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const REL = process.env.MEGA_TEST_RELEASE || 'eaa5becc54eb';
const ROOT = path.join(__dirname, '..', '..');
process.env.SOLVER_RELEASE = REL;
const NO_RED = process.argv.includes('--no-red');
const FAST = process.argv.includes('--fast');

let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = msg => { console.log('CANNOT ANSWER: ' + msg); process.exit(2); };

if (!fs.existsSync(path.join(ROOT, 'data', 'releases', REL, 'release.json'))) cannot('release ' + REL + ' is not on disk (data/releases/' + REL + ')');
require('../arena/env.js');
const MT = require('../arena/mega_timing.js');
const AR = require('../arena/arena.js');
const T = require('../arena/teams.js');
if (!fs.existsSync(T.DEFAULT_FILE)) cannot('no human dataset at ' + T.DEFAULT_FILE);

(async () => {
/* ---------------- HUMAN ---------------- */
if (!FAST) {
  const h = MT.humanTiming(T.DEFAULT_FILE, { limit: 3000 }).sides;
  ok('HUMAN', h.megas > 2000, 'only ' + h.megas + ' megas in 3,000 human games');
  ok('HUMAN', Math.abs(h.delayed_share - MT.HUMAN_DELAYED_SHARE) < 0.03, 'first 3,000 games delayed share ' + h.delayed_share + ' vs HUMAN_DELAYED_SHARE ' + MT.HUMAN_DELAYED_SHARE);
  console.log('  HUMAN first 3000 games: ' + h.delayed + '/' + h.megas + ' megas delayed = ' + h.delayed_share + '  (HUMAN_DELAYED_SHARE ' + MT.HUMAN_DELAYED_SHARE + ', band ' + JSON.stringify(MT.band(MT.HUMAN_DELAYED_SHARE)) + ')');
}

/* ---------------- CLASSIFY ---------------- */
{
  const DX = MT.dex(), D = DX.D;
  const forme = D.species.all().find(s => DX.X.legal(s) && s.isMega && DX.sets(s.abilities[0]) && DX.sets(s.abilities[0]).weather);
  if (!forme) cannot('no legal mega forme in the regulation whose ability sets a weather (the classifier cannot be staged)');
  const w = DX.sets(forme.abilities[0]).weather;
  const other = ['sun', 'rain', 'sand', 'snow'].find(x => x !== w);
  const mon = (boost) => ({ id: '0', species: forme.baseSpecies, ability: forme.abilities[0], stone: forme.name, boosts: boost || {} });
  const ally = { id: '1', species: 'x', ability: null, stone: null, boosts: {} };
  const E = (t, weather, m, act) => ({ t, field: { weather, terrain: null, trickroom: false }, mons: [m, ally], act: act || [{ kind: 'move', move: 'protect', mega: false }, null] });
  const lost = MT.classify({ capable_turn: 1, mega_turn: 3, mega_id: '0', trace: [E(1, w, mon()), E(2, other, mon()), E(3, other, mon(), [{ kind: 'move', move: 'protect', mega: true }, null])] });
  ok('CLASSIFY', lost.delay === 2 && lost.reasons.includes('mega_resets_field') && lost.reasons.includes('field_lost_while_held') && lost.reasons.includes('mega_overrides_other_field'),
     'weather lost while held: ' + JSON.stringify(lost.reasons));
  ok('CLASSIFY', lost.held_actions.length === 2 && lost.held_actions[0] === 'protect', 'held actions ' + JSON.stringify(lost.held_actions));
  const now = MT.classify({ capable_turn: 1, mega_turn: 1, mega_id: '0', trace: [E(1, null, mon())] });
  ok('CLASSIFY', now.delay === 0 && now.reasons.length === 0, 'an immediate mega carries no delay reason: ' + JSON.stringify(now));
  const boosted = MT.classify({ capable_turn: 1, mega_turn: 2, mega_id: '0', trace: [E(1, w, mon()), E(2, w, mon({ at: 2 }))] });
  ok('CLASSIFY', boosted.reasons.includes('boost_banked') && !boosted.reasons.includes('mega_resets_field'), 'boost banked, weather still up: ' + JSON.stringify(boosted.reasons));
  const back = MT.classify({ capable_turn: 1, mega_turn: 3, mega_id: '0', trace: [E(1, w, mon()), { t: 2, field: { weather: w, terrain: null, trickroom: false }, mons: [ally, null], act: [null, null] }, E(3, w, mon())] });
  ok('CLASSIFY', back.reasons.includes('switched_out_and_back'), 'left and came back: ' + JSON.stringify(back.reasons));
  const later = MT.classify({ capable_turn: 1, mega_turn: 2, mega_id: '0', trace: [{ t: 1, field: { weather: null, terrain: null, trickroom: false }, mons: [Object.assign({}, ally, { id: '2', stone: 'y' }), null], act: [null, null] }, E(2, null, mon())] });
  ok('CLASSIFY', later.reasons.includes('other_holder_first'), 'another holder first: ' + JSON.stringify(later.reasons));
  console.log('  CLASSIFY on ' + forme.name + ' (' + forme.abilities[0] + ' sets ' + w + '): lost-while-held ' + JSON.stringify(lost.reasons) + '; boosted ' + JSON.stringify(boosted.reasons));
}

/* ---------------- TIMING ---------------- */
const champSrc = path.join(ROOT, 'solver', 'machamp', 'league', 'gen5.json');
const champ = path.join(ROOT, 'solver', 'out', 'mega', 'test-timing-gen5-short.json');
fs.mkdirSync(path.dirname(champ), { recursive: true });
fs.writeFileSync(champ, JSON.stringify(Object.assign(JSON.parse(fs.readFileSync(champSrc, 'utf8')), { name: 'gen5-short', budgetMs: 150 })));
const matches = FAST ? [['doduo', 'mag']] : [['doduo', 'mag'], ['prior', champ]];
const label = n => (n === champ ? 'gen5 (champion, 150 ms)' : n);
const G = 76;   // 76 games -> 76 sides per bot; ~88% capable, ~95% of those mega -> ~60 megas, above MIN_MEGAS
for (const [x, y] of matches) {
  const r = await AR.run({ x, y, games: G, seed: 11, budget: 150, depth: 1, k1: 4, k2: 4, cap: 60, workers: 0 });
  ok('TIMING', r.result.errors === 0, x + ' vs ' + y + ': ' + r.result.errors + ' errored games');
  for (const [k, n] of [['x', x], ['y', y]]) {
    const m = r.mega.timing[k];
    const c = MT.check(m);
    console.log('  TIMING ' + label(n).padEnd(24) + ' ' + c.verdict + '  ' + c.why + '  reasons ' + JSON.stringify(m.reasons));
    if (c.verdict === 'CANNOT') cannot(label(n) + ': ' + c.why);
    ok('TIMING', c.verdict === 'PASS', label(n) + ': ' + c.why);
  }
}

console.log('test-mega-timing: ' + (checks - fails) + '/' + checks + ' checks  release ' + REL + '  human ' + MT.HUMAN_DELAYED_SHARE + ' ± ' + MT.DELAY_MARGIN + (AR.BROKEN ? '  [BREAK ' + AR.BROKEN + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));
if (!NO_RED && !AR.BROKEN) {
  let blind = false;
  for (const brk of ['meganow', 'megalate']) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red', '--fast'], { env: Object.assign({}, process.env, { ARENA_BREAK: brk }), encoding: 'utf8' });
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-mega-timing:')) || '';
    const seen = /failed clauses: .*\bTIMING\b/.test(line) && res.status === 1;
    console.log('  RED ARENA_BREAK=' + brk + ' -> TIMING: ' + (seen ? 'fails as required' : 'STAYED GREEN (blind)') + '   [' + line.trim() + ']');
    for (const l of (res.stdout || '').split('\n')) if (/^\s+TIMING /.test(l)) console.log('    ' + l.trim());
    if (!seen) blind = true;
  }
  if (blind) process.exit(3);
}
process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CANNOT ANSWER: ' + (e && e.stack || e)); process.exit(2); });
