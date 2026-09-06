/* probe_status_clock_dice.js — THE SLEEP AND FREEZE CLOCKS, REPLAYED OFF THE PINNED POOL AND PRINTED
 * SIDE BY SIDE WITH THE DICE ADDRESSES THAT DECIDE THEM. 2026-09-06.
 *
 *   SHOWDOWN_PATH=... node tests/probe_status_clock_dice.js
 *
 * ================= WHY THIS FILE EXISTS =========================================================
 *
 * `docs/ENGINE.md` carries sleep and freeze as two REFUTED diagnoses. The self-drop dice-address fix
 * of 2026-09-06 was expected to close them and did not: a staged Sleep Powder shares its address on
 * both engines and both bodies slept the same three turns, and Champions' thaw sits below
 * `setActiveMove`, so no self-drop draw can precede it. Both are therefore real, separate, undiagnosed
 * defects — and neither has ever been looked at ON THE GAMES THAT ACCUSE IT.
 *
 * `data/game-differential.json` on release `57679ef9a4a3` names five of them across 961 games:
 *
 *   FREEZE, 5 games — `|-damage|p1b|H/Hfrz` (authority) <> `|-curestatus|p1b|frz|[msg]` (this engine)
 *     and the mirror. THIS ENGINE THAWED AND THE AUTHORITY DID NOT, or the reverse.
 *   SLEEP, 4 games — two of `|-curestatus|p1a|slp|[msg]` <> `|cant|p1a|slp` (a WAKE TURN), and two of
 *     `|-status|p1b|slp|[from]sleeppowder` <> `|-miss|p2b|p1b` (a 75-accuracy move HITTING in one
 *     engine and MISSING in the other, which is not a sleep defect at all).
 *
 * ================= THE AUTHORITY, CITED AND NOT REMEMBERED ======================================
 *
 * CHAMPIONS OVERRIDES BOTH. `data/mods/champions/conditions.ts` carries exactly three keys — `par`,
 * `slp`, `frz` — and reading `data/conditions.ts` for either of these is reading MAINLINE.
 *
 *   slp  data/mods/champions/conditions.ts:11-29, `inherit: true` with `onStart` REPLACED:
 *          this.effectState.startTime = this.sample([2, 3, 3]);      // mainline: this.random(2, 5)
 *          this.effectState.time = this.effectState.startTime;
 *        `onBeforeMove` is NOT overridden, so mainline's runs (data/conditions.ts:66-80):
 *          if (hasAbility('earlybird')) time--;  time--;
 *          if (time <= 0) { cureStatus(); return; }
 *          add('cant', pokemon, 'slp'); if (move.sleepUsable) return; return false;
 *        `Battle#sample(items)` is `items[this.random(items.length)]`, so the START is ONE `random(3)`
 *        and there is NO draw at the wake site. A startTime of 2 costs one missed turn, 3 costs two.
 *
 *   frz  data/mods/champions/conditions.ts:31-55, `inherit: true` with BOTH handlers replaced:
 *          onStart:      this.effectState.startTime = 3; this.effectState.time = 3;
 *          onBeforeMove: if (move.flags['defrost'] && !(burnup && !hasType('Fire'))) return;
 *                        pokemon.statusState.time--;
 *                        if (pokemon.statusState.time <= 0 || this.randomChance(1, 4)) { cure; return; }
 *                        this.add('cant', pokemon, 'frz'); return false;
 *        The `||` SHORT-CIRCUITS: on the third attempt `time` reaches 0 and NO die is drawn at all.
 *
 * ================= WHAT THIS FILE DOES ==========================================================
 *
 *   1  FIXTURE  the accusing games are found in the PINNED pool and both pairs build.
 *   2  PRINT    every boundary of every game: each engine's clock for the body that carries the
 *               status — `slpTurns`/`slpTime`/`frzTurns` against `statusState.time`/`startTime`.
 *   3  PRINT    the middle arm's `any`-category ADDRESSES either side of the divergence, both engines,
 *               so an address mismatch and an arithmetic mismatch are told apart rather than guessed.
 *   4  ASSERT   the clocks agree at every boundary at which both engines still hold the status.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));

if (!process.env.SHOWDOWN_PATH) {
  console.log('THE SLEEP AND FREEZE CLOCKS');
  console.log('  NOT RUN — SHOWDOWN_PATH is unset, so the authority cannot be consulted. Not a pass.');
  process.exit(2);
}

const PIN_GAMES = 1200;
process.argv.push('--steering', 'empirical', '--arm', 'middle', '--state', '--end-state',
                  '--games', String(PIN_GAMES), '--turns', '20',
                  '--team-store', 'data/team-pool-frozen');

const G = require(D('engine', 'game_differential.js'));
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const CHILD = process.env.MEDI_SLEEP_START_ANY_ADDR === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n== THE SLEEP AND FREEZE CLOCKS, ON THE GAMES THAT ACCUSE THEM =='
  + (CHILD ? '   [MEDI_SLEEP_START_ANY_ADDR=1]' : '') + '\n');

/* ---- THE AUTHORITY, RE-DERIVED. A mod override that stopped existing must be loud. ------------- */
{
  const slp = dex.conditions.get('slp'), frz = dex.conditions.get('frz');
  const src = (c, k) => (typeof c[k] === 'function') ? String(c[k]) : '';
  const slpSample = /sample\(\s*\[([^\]]*)\]/.exec(src(slp, 'onStart'));
  const frzStart = /startTime\s*=\s*(\d+)/.exec(src(frz, 'onStart'));
  const frzChance = /randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(src(frz, 'onBeforeMove'));
  console.log('  slp.onStart start times, READ OFF THE FORMAT: [' + (slpSample ? slpSample[1].replace(/\s+/g, '') : 'NOT FOUND') + ']');
  console.log('  frz.onStart startTime=' + (frzStart ? frzStart[1] : 'NOT FOUND')
    + '   frz.onBeforeMove thaw chance=' + (frzChance ? frzChance[1] + '/' + frzChance[2] : 'NOT FOUND'));
  ok(!!slpSample && slpSample[1].replace(/\s+/g, '') === '2,3,3',
     'Champions\' slp start-time table is [2,3,3]',
     'read [' + (slpSample ? slpSample[1] : '-') + '] — mainline is random(2,5) = {2,3,4} and reading '
     + 'it here would be reading the wrong file');
  ok(!!frzStart && frzStart[1] === '3' && !!frzChance && frzChance[1] === '1' && frzChance[2] === '4',
     'Champions\' frz clock is a hard 3 with a 1/4 thaw per attempt',
     'startTime=' + (frzStart ? frzStart[1] : '-') + ' chance='
     + (frzChance ? frzChance[1] + '/' + frzChance[2] : '-'));
}

const MEDI = G.REL.require('engine/medicham2-browser.js',
                           { want: ['MEDSEEN', 'MEDFAILS'] });

/* ---- THE ACCUSING GAMES, OFF `first_divergences` IN THE PUBLISHED ARTIFACT --------------------- */
const WANT = [
  { kind: 'frz', cfg: 'baseline', turn: 7, who: 'mawile',
    tag: 'gen9championsvgc2026regmbbo3-2655996768 vs gen9championsvgc2026regmbbo3-2656208114',
    says: 'authority |-damage|p1b: Mawile|75/125 frz  <>  this engine |-curestatus|p1b: Mawile|frz|[msg]' },
  { kind: 'slp', cfg: 'pair-protect-bust', turn: 6, who: 'golurk',
    tag: 'gen9championsvgc2026regmbbo3-2660356793 vs gen9championsvgc2026regmbbo3-2660492912',
    says: 'authority |-curestatus|p1a: Golurk|slp|[msg]  <>  this engine |cant|p1a: Golurk|slp' },
  { kind: 'slp', cfg: 'omit-spread', turn: 15, who: 'archaludon',
    tag: 'gen9championsvgc2026regmbbo3-2661122292 vs gen9championsvgc2026regmbbo3-2661233657',
    says: 'authority |-status|p1b: Archaludon|slp|[from] move: Sleep Powder  <>  this engine '
        + '|-miss|p2b: Vivillon|p1b: Archaludon   (an ACCURACY divergence, not a sleep one)' },
  /* THE ATTRIBUTION ARM. This game is not a sleep card at all — its board parted on a Pelipper
   * fainting where the authority's survived on a Focus Sash — and it CLOSED in the same run as the
   * two fixes of 2026-09-06 without either of them touching a Focus Sash rule. The only mechanism
   * available is `nth` DISPLACEMENT: the sleep timer moved out of the `any` bucket and into `sec`, so
   * every later draw at the same two addresses in that game shifted index. That is a real effect and
   * it is NOT a fix, so it gets an arm that says which knob owns it rather than a sentence claiming
   * five games were repaired. It has no status to compare; the assertion is that the game runs clean. */
  { kind: 'attr', cfg: 'pair-redirect-priority', turn: 4, who: 'pelipper',
    tag: 'gen9championsvgc2026regmbbo3-2659024897 vs gen9championsvgc2026regmbbo3-2659057254',
    says: 'board parted at t4 on the published run before this batch — p1.party.pelipper.hp '
        + 'medicham 0 / showdown 59, fainted true / false. No sleep and no stall leaf in it.' },
];

const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SW = SWARM.buildSwarm(PIN_GAMES * 2, { storeDir: D('data', 'team-pool-frozen') });
console.log('  pool: ' + SW.out.reduce((a, c) => a + c.picked, 0) + ' teams picked from ' + SW.teams.length);

for (const W of WANT) {
  const c = SW.out.find(x => x.config === W.cfg);
  const [ida, idb] = W.tag.split(' vs ');
  const ta = c && c.picked_teams.find(t => t.id === ida);
  const tb = c && c.picked_teams.find(t => t.id === idb);
  if (!ta || !tb) {
    ok(false, W.cfg + ' ' + W.kind + ': the pair is in the PINNED pool',
       'a=' + !!ta + ' b=' + !!tb + ' — a FIXTURE fault, never a claim about the mechanic');
    continue;
  }
  const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
  if (!a || !b) { ok(false, W.cfg + ' ' + W.kind + ': both sides build', 'buildPair refused'); continue; }

  G.midResetAddresses();
  const rows = [];
  let ROSTER = null;
  const r = G.playGame(a, b, W.cfg, W.tag, {
    driverSeed: W.cfg + '|' + W.tag,
    onBoundary: (snap, turnIdx, S, battle) => {
      /* BY SPECIES, NEVER BY SLOT — the accused body switches, and a slot reader would report
       * whoever happens to be standing there. */
      /* AND BY PREFIX, because a mega renames the body: `mawile` becomes `mawile-mega` on one engine
       * and `mawilemega` on the other, and an exact match then reports MISSING at every boundary --
       * which reads exactly like a body that is not in the game and silently makes the assertion
       * below vacuous. The roster is PRINTED once per game so a real MISSING is still visible. */
      const hit = (n) => norm(n) === W.who || norm(n).indexOf(W.who) === 0;
      const me = [...S.actA, ...S.actB, ...S.benchA, ...S.benchB].find(m => m && hit(m.name));
      const sd = [...battle.sides[0].pokemon, ...battle.sides[1].pokemon]
        .find(p => p && hit(p.species && p.species.id));
      if (!ROSTER) ROSTER = {
        me: [...S.actA, ...S.actB, ...S.benchA, ...S.benchB].filter(Boolean).map(m => norm(m.name)),
        sd: [...battle.sides[0].pokemon, ...battle.sides[1].pokemon].filter(Boolean)
              .map(p => norm(p.species && p.species.id)) };
      const ss = sd && sd.statusState || {};
      rows.push({ t: turnIdx,
        meStatus: me ? (me.fainted ? 'fnt' : (me.status || '-')) : 'MISSING',
        sdStatus: sd ? (sd.fainted ? 'fnt' : (sd.status || '-')) : 'MISSING',
        meSlp: me ? (me.slpTurns | 0) : -1, meSlpTime: me ? (+me.slpTime || 0) : -1,
        meFrz: me ? (me.frzTurns | 0) : -1,
        sdTime: ss.time == null ? -1 : ss.time, sdStart: ss.startTime == null ? -1 : ss.startTime });
    },
  });

  console.log('\n  ---- ' + W.kind.toUpperCase() + '  ' + W.cfg + '  ' + W.tag);
  console.log('       artifact says at t' + W.turn + ': ' + W.says);
  console.log('       replay: turns=' + r.turns + ' protocol_div_turn=' + r.divTurn
    + ' board_div=' + (r.stateDiv ? r.stateDiv.turn : null)
    + ' void=' + !!r.void + ' err=' + (r.err || '-'));
  if (W.kind === 'attr') {
    ok(!r.div && !r.stateDiv, W.cfg + ' ATTRIBUTION: this game runs clean on both engines',
       (r.div || r.stateDiv)
         ? 'protocol at ' + (r.div ? r.div.index : '-') + ', board at '
           + (r.stateDiv ? r.stateDiv.turn : '-') + ' ' + JSON.stringify(r.stateDiv ? r.stateDiv.diffs : [])
         : 'no protocol and no board divergence — and the child run under the restore knob is what '
           + 'says WHICH knob owns it');
    continue;
  }
  const staged = rows.some(q => q.meStatus !== 'MISSING' && q.sdStatus !== 'MISSING');
  ok(staged, W.cfg + ' ' + W.kind + ': the accused body `' + W.who + '` is IN the replayed game',
     staged ? 'found on both engines'
            : 'NOT FOUND — a FIXTURE fault. rosters: medicham2 '
              + JSON.stringify(ROSTER ? ROSTER.me : []) + '  showdown '
              + JSON.stringify(ROSTER ? ROSTER.sd : []));
  console.log('       turn  me_status me_slpTurns/slpTime me_frzTurns | sd_status sd_time/startTime');
  for (const q of rows) {
    if (q.meStatus === '-' && q.sdStatus === '-') continue;
    console.log('       t' + String(q.t).padEnd(4) + q.meStatus.padEnd(10)
      + (q.meSlp + '/' + q.meSlpTime).padEnd(20) + String(q.meFrz).padEnd(12)
      + '| ' + q.sdStatus.padEnd(10) + q.sdTime + '/' + q.sdStart);
  }

  /* THE ADDRESSES. `any` is the bucket both the sleep-start draw and the freeze thaw fall in — the
   * authority calls them from `slp.onStart` / `frz.onBeforeMove`, neither of which is
   * `hitStepAccuracy`, `secondaries` or `getDamage`; this engine draws them off the generic stream,
   * which `MID_ADDR_CAT` also addresses as `any`. `acc` is printed too, because the third card above
   * is a 75-accuracy move and that is a DIFFERENT bucket. */
  const A = G.midAddresses();
  const near = (list, cat) => list.filter(x => String(x).split('|')[2] === cat);
  for (const cat of ['any', 'acc']) {
    const sd = near(A.sd, cat), me = near(A.me, cat);
    const sdSet = new Set(sd), meSet = new Set(me);
    const onlySd = [...sdSet].filter(x => !meSet.has(x));
    const onlyMe = [...meSet].filter(x => !sdSet.has(x));
    console.log('       ADDRESSES cat=' + cat + ', WHOLE GAME'
      + ':  sd=' + sd.length + ' me=' + me.length
      + '  shared=' + [...meSet].filter(x => sdSet.has(x)).length);
    if (onlySd.length) console.log('         ONLY THE AUTHORITY ASKED: ' + JSON.stringify(onlySd));
    if (onlyMe.length) console.log('         ONLY THIS ENGINE ASKED:   ' + JSON.stringify(onlyMe));
  }

  /* 4 — THE ASSERTION. Only boundaries at which BOTH engines still hold the status: once one has
   * cured, the clocks are not two answers to one question and comparing them measures the reader. */
  /* THE FIRST VERSION OF THIS ARM COMPARED ONLY ATTEMPTS SPENT AND WAS GREEN OVER THE DEFECT.
   * medicham2 counts UP from 0 and the authority counts DOWN from `startTime`, so `spent` is
   * `frzTurns` against `startTime - time` — and on the Golurk card BOTH engines had spent 0 while
   * one held a start time of 3 and the other of 2. The LENGTH is the leaf that decides the wake turn;
   * comparing only the progress through it asks nothing. Both are asserted now. */
  let mis = null;
  for (const q of rows) {
    if (q.meStatus !== W.kind || q.sdStatus !== W.kind) continue;
    const meSpent = W.kind === 'frz' ? q.meFrz : q.meSlp;
    const sdSpent = q.sdStart - q.sdTime;
    /* THE LENGTH. Freeze has no draw at all in Champions (`startTime = 3`, flat), so the comparable
     * length there is the constant; sleep's is the sampled one. */
    const meLen = W.kind === 'frz' ? 3 : q.meSlpTime;
    if ((meSpent !== sdSpent || meLen !== q.sdStart) && !mis) mis = { q, meSpent, sdSpent, meLen };
  }
  ok(!mis, W.cfg + ' ' + W.kind + ': the clock LENGTH and the attempts SPENT agree at every boundary '
     + 'both engines hold it',
     mis ? 'first disagreement at t' + mis.q.t + ': this engine length ' + mis.meLen + ' spent '
           + mis.meSpent + ', the authority length ' + mis.q.sdStart + ' spent ' + mis.sdSpent
           + ' (time ' + mis.q.sdTime + ')'
         : 'checked ' + rows.length + ' boundaries');
}

/* ================================================================================================
 * 5 — THE COUNTERS AND THE RED. Three clocks agreeing is not evidence that the STREAM was handed
 * down: a build that never reached the secondary path at all would pass every arm above.
 * ============================================================================================= */
{
  const S = MEDI.MEDSEEN, F = MEDI.MEDFAILS;
  console.log('\n  COUNTERS: sleepDurationDrawn=' + S.sleepDurationDrawn
    + '  sleepDurationDrawnUnderSecondary=' + S.sleepDurationDrawnUnderSecondary
    + '  sleepDurationDrawnLate=' + S.sleepDurationDrawnLate
    + '  sleepStartAnyAddrRestored=' + F.sleepStartAnyAddrRestored);
  ok(S.sleepDurationDrawn > 0, 'a sleep timer was drawn at all in these three games',
     'sleepDurationDrawn=' + S.sleepDurationDrawn + ' — a zero makes every clock arm above vacuous');
  ok(S.sleepDurationDrawnUnderSecondary > 0,
     'at least one timer was drawn under the CALLER\'S stream rather than the generic one',
     'sleepDurationDrawnUnderSecondary=' + S.sleepDurationDrawnUnderSecondary
     + ' — a zero means the stream stopped being passed and every secondary-sourced sleep is back '
     + 'on `any`, which is a different die at a different address');
  if (!CHILD) {
    ok(F.sleepStartAnyAddrRestored === 0, 'the restore knob is OFF in this process',
       'sleepStartAnyAddrRestored=' + F.sleepStartAnyAddrRestored);
  } else {
    ok(F.sleepStartAnyAddrRestored === 1, 'the restore knob is LIVE in the child',
       'sleepStartAnyAddrRestored=' + F.sleepStartAnyAddrRestored);
  }
}

if (!CHILD) {
  const { spawnSync } = require('child_process');
  console.log('\n  ---- RE-RUNNING UNDER MEDI_SLEEP_START_ANY_ADDR=1 (the child must FAIL)');
  const r = spawnSync(process.execPath, [__filename],
    { env: Object.assign({}, process.env, { MEDI_SLEEP_START_ANY_ADDR: '1' }), encoding: 'utf8' });
  const childFailed = r.status !== 0;
  const lines = String(r.stdout || '').split('\n').filter(l => /^\s*FAIL/.test(l));
  ok(childFailed, 'the restore knob makes this probe RED',
     childFailed ? 'child exit ' + r.status + ', ' + lines.length + ' FAIL line(s):\n          '
                   + lines.join('\n          ')
                 : 'THE CHILD PASSED — this probe cannot tell the two streams apart and asserts '
                   + 'nothing about which bucket the timer comes out of');
}

console.log('\n  ' + (bad ? bad + ' FAILURE(S)' : 'ALL ARMS PASS') + '\n');
process.exit(bad ? 1 : 0);
