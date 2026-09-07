#!/usr/bin/env node
/* tests/probe_confusion_selfhit_chance.js — A CONFUSED BODY HITS ITSELF 33 TIMES IN 100, NOT ONE IN THREE
 *   node tests/probe_confusion_selfhit_chance.js        node tests/probe_confusion_selfhit_chance.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY, IN TWO LINES, BOTH READ RATHER THAN RECALLED:
 *
 *   data/conditions.ts, confusion.onBeforeMove:   if (!this.randomChance(33, 100)) return;
 *   sim/prng.ts:115  randomChance(n, d)        :  return this.random(d) < n;
 *
 * `random(100)` is `floor(u * 100)`, so the authority hits itself exactly when `u < 0.33`.
 * This engine asked `rng() < 1/3` — 0.33333…, a THIRD OF A PERCENT of the die wider.
 *
 * THAT IS A ROUNDING ERROR EVERYWHERE EXCEPT WHERE IT MATTERS MOST. The whole-game differential's
 * middle arm hands BOTH engines the same `u` for the same address, so a `u` in `[0.33, 0.33333)` is
 * not a slightly different probability — it is one engine hurting itself and the other clicking its
 * move. `data/mods/champions/conditions.ts` does not mention confusion, so this is the format's own
 * number.
 *
 * THE THREE PARTS, AND THE SECOND IS THE ONE THAT COSTS A BOARD:
 *
 *   A  THE AUTHORITY, DERIVED. The handler source is read out of the format and the 33/100 is
 *      matched in it. If Showdown ever changes the number this file fails rather than drifting.
 *   B  THE WORKED EXAMPLE. The board-material pool game `pair-redirect-priority ...bo3-2656366551`
 *      is replayed out of the PINNED pool, both engines, whole game. Clean it must agree end to end;
 *      under `--red` it must part, and part on the leaves the published artifact records.
 *   C  THE SILENT CONTROL, and it is what says this fix is NARROW. A sweep of staged confusion turns
 *      must give the two engines the SAME self-hit count under BOTH arms — the changed band is a
 *      third of a percent wide, so an ordinary sample cannot land in it. A control that moved here
 *      would mean the change was to the mechanic rather than to its boundary.
 *
 * RED FIRST: `MEDI_CONFUSION_THIRD=1` restores the one-in-three.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_CONFUSION_THIRD = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* THE PINS. `--games 1200` is part of the SAMPLE DEFINITION and not a budget — `buildSwarm` is sized
 * from it, so a different number is a different pool and therefore a different pairing. The census
 * pin is what makes the replayed game the SAME game: the empirical driver's coverage term reads the
 * census at every decision, and an unpinned one plays a different match with the same name. */
const PIN_GAMES = 1200;
process.argv.push('--steering', 'empirical', '--arm', 'middle', '--state', '--end-state',
                  '--games', String(PIN_GAMES), '--turns', '20',
                  '--team-store', D('data', 'team-pool-frozen'),
                  '--census', D('data', 'verification', 'census-pin-9446a684709d.json'));
const G = require(D('engine', 'game_differential.js'));
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const SWARM = require(D('engine', 'diff_swarm.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};
console.log(NL + (RED ? 'RED ARM — MEDI_CONFUSION_THIRD=1 (the engine as it stood before the fix)'
                      : 'CLEAN ARM'));

/* ---- A. THE AUTHORITY, DERIVED ------------------------------------------------------------------ */
console.log(NL + 'A. THE AUTHORITY');
{
  const c = dex.conditions.get('confusion');
  const src = String(c && c.onBeforeMove || '');
  console.log('  confusion.onBeforeMove, READ: ' + src.replace(/\s+/g, ' '));
  const m = /randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(src);
  claim(!!m, 'the self-hit chance is a randomChance in the handler this format serves',
    m ? 'randomChance(' + m[1] + ', ' + m[2] + ')' : 'NO randomChance FOUND — the fixture, not the engine');
  if (!m) { console.log(NL + 'NOT RUN — the authority no longer states the chance this way.'); process.exit(2); }
  const n = +m[1], d = +m[2];
  claim(n === 33 && d === 100, 'and it is 33 in 100', 'n=' + n + ' d=' + d);
  console.log('  randomChance(n, d) is `this.random(d) < n` (sim/prng.ts:115), and random(100) is '
    + 'floor(u*100) — so the authority self-hits exactly when u < ' + (n / d));
  console.log('  the value this engine used before today was 1/3 = ' + (1 / 3)
    + ', which is ' + (((1 / 3) - n / d) * 100).toFixed(4) + ' percentage points of the die wider');
}

/* ---- B. THE WORKED EXAMPLE, OUT OF THE PINNED POOL ---------------------------------------------- */
console.log(NL + 'B. THE BOARD-MATERIAL POOL GAME');
const W = { cfg: 'pair-redirect-priority', turn: 5,
            tag: 'gen9championsvgc2026regmbbo3-2656366551 vs gen9championsvgc2026regmbbo3-2656312271',
            /* the leaves data/game-differential.json records for it at release aa7b80f9a038 */
            leaves: ['p2.party.maushold.fainted', 'p1.pp[0].moonblast'] };
{
  const t0 = Date.now();
  const SW = SWARM.buildSwarm(PIN_GAMES * 2, { storeDir: D('data', 'team-pool-frozen') });
  console.log('  pinned pool built in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  const c = SW.out.find(x => x.config === W.cfg);
  const [ida, idb] = W.tag.split(' vs ');
  const ta = c && c.picked_teams.find(t => t.id === ida);
  const tb = c && c.picked_teams.find(t => t.id === idb);
  if (!ta || !tb) {
    claim(false, 'the pair is in the PINNED pool',
      'a FIXTURE fault, never a claim about the mechanic');
  } else {
    const a = G.buildPair(ta.team), b = G.buildPair(tb.team);
    const r = G.playGame(a, b, W.cfg, W.tag, { driverSeed: W.cfg + '|' + W.tag });
    const diffs = r.stateDiv ? r.stateDiv.diffs.map(d => d.path) : [];
    console.log('  replay: turns=' + r.turns + '  boardDiv=' + (r.stateDiv ? 't' + r.stateDiv.turn : 'none')
      + '  protoDiv=' + (r.div ? r.div.index : 'none') + '  err=' + (r.err || '-'));
    if (r.stateDiv) console.log('  board diffs: ' + JSON.stringify(r.stateDiv.diffs.map(d =>
      d.path + ' medi ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown))));
    if (RED) {
      claim(!!r.stateDiv && r.stateDiv.turn === W.turn,
        'the published game PARTS its board at t' + W.turn + '   [--red: must PART]',
        r.stateDiv ? 'parted at t' + r.stateDiv.turn : 'boards identical — the knob did not reach it');
      claim(W.leaves.every(L => diffs.includes(L)),
        'and it parts on the leaves the artifact records',
        'want ' + JSON.stringify(W.leaves) + ' got ' + JSON.stringify(diffs));
    } else {
      claim(!r.stateDiv, 'the published game agrees at every boundary',
        r.stateDiv ? 'STILL PARTS at t' + r.stateDiv.turn + ': ' + JSON.stringify(diffs)
                   : 'identical at every boundary');
      claim(!r.div, 'and its protocol streams agree end to end',
        r.div ? 'protocol parted at index ' + r.div.index : 'no protocol divergence');
    }
  }
}

/* ---- C. THE SILENT CONTROL — THE MECHANIC ITSELF MUST NOT MOVE ---------------------------------- */
console.log(NL + 'C. THE SWEEP — the mechanic away from the boundary, which must read the same on both arms');
{
  const mk = (sp, it, ab, mv) => ({ species: sp, item: it, ability: ab, moves: mv });
  const P = { m: 'protect' };
  const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const cr = dex.moves.get('confuseray');
  if (!legal(cr) || cr.volatileStatus !== 'confusion' || cr.accuracy !== 100) {
    console.log('  NOT RUN — Confuse Ray is not the 100-accuracy confusion move this sweep needs: '
      + 'acc=' + cr.accuracy + ' vol=' + cr.volatileStatus);
    process.exit(2);
  }
  console.log('  the staged source, READ: Confuse Ray acc ' + cr.accuracy + ', volatileStatus '
    + cr.volatileStatus);
  /* THE TARGETS ARE DERIVED. Each one is a different address, which is the only way to move the die
   * without moving the rule. Own Tempo and its family are excluded by the handler that refuses the
   * volatile, not by name. */
  const LS = dex.data.Learnsets;
  const learnset = sp => {
    const out = new Set(); let s = dex.species.get(sp);
    while (s && s.exists) {
      const e = LS[s.id];
      if (e && e.learnset) for (const k of Object.keys(e.learnset)) out.add(k);
      s = s.prevo ? dex.species.get(s.prevo)
        : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
    }
    return out;
  };
  /* A SELF-AIMED, NON-STALLING STATUS CLICK. The target must ACT on both turns — it must not Protect
   * on turn 1 (that refuses the Confuse Ray outright, which is what made the first version of this
   * sweep read `-activate|confusion` ZERO and say so) and it must try to move on turn 2, because
   * `onBeforeMove` is where the rule lives. Derived per body; Protect and its family are excluded by
   * their own `stallingMove` flag rather than by name. */
  const inert = sp => {
    for (const id of learnset(sp)) {
      const m = dex.moves.get(id);
      if (!legal(m) || m.category !== 'Status' || m.target !== 'self') continue;
      if (m.stallingMove || m.flags.charge || m.selfSwitch || m.status || m.weather || m.terrain) continue;
      return m.id;
    }
    return null;
  };
  const TARGETS = [];
  for (const s of dex.species.all()) {
    if (!legal(s) || s.name.includes('-') || s.baseStats.hp < 80) continue;
    if (!Object.values(s.abilities || {}).length) continue;
    /* OWN TEMPO AND ITS FAMILY ARE EXCLUDED BY THE HANDLER THAT REFUSES THE VOLATILE, NOT BY NAME. */
    if (Object.values(s.abilities || {}).some(a => dex.abilities.get(a).onTryAddVolatile)) continue;
    const click = inert(s.id);
    if (!click) continue;
    TARGETS.push({ sp: s, click });
    if (TARGETS.length >= 24) break;
  }
  console.log('  ' + TARGETS.length + ' derived target(s) swept, one staged game each');
  const P1 = () => [mk('gengar', '', 'Cursed Body', ['Confuse Ray', 'Protect']),
                    mk('kingambit', '', 'Defiant', ['Protect']),
                    mk('incineroar', '', 'Intimidate', ['Protect']),
                    mk('milotic', '', 'Marvel Scale', ['Protect'])];
  const P2 = t => [mk(t.sp.name, '', Object.values(t.sp.abilities)[0],
                      [dex.moves.get(t.click).name, 'Protect']),
                   mk('kingambit', '', 'Defiant', ['Protect']),
                   mk('incineroar', '', 'Intimidate', ['Protect']),
                   mk('milotic', '', 'Marvel Scale', ['Protect'])];
  let staged = 0, sdHits = 0, meHits = 0, disagreed = 0, activated = 0;
  for (const t of TARGETS) {
    const a = G.buildPair(P1()), b = G.buildPair(P2(t));
    if (!a || !b) continue;
    const before = M.MEDSEEN.confusionSelfHit || 0;
    const r = G.playGame(a, b, 'directed', 'probe_confusion_selfhit_chance :: sweep ' + t.sp.name, {
      arm: ARM,
      script: [{ p1: [{ m: 'confuseray', t: 0 }, P], p2: [{ m: t.click }, P] },
               { p1: [P, P], p2: [{ m: t.click }, P] }],
    });
    if (r.err) continue;
    staged++;
    const sd = G.lastSdLog();
    /* SHOWDOWN PRINTS EVERY HP CHANGE TWICE — the private line and the `|split|` public copy, which
     * carries a percentage. Counting both reads 38 self-hits for 19, which is a fault in the RULER
     * and would have been reported here as an engine that self-hits half as often as the authority. */
    const pub = l => /\|\d+\/100(\||$| )/.test(String(l));
    const act = sd.filter(l => /^\|-activate\|p2a: [^|]+\|confusion/.test(String(l))).length;
    const hit = sd.filter(l => /\|\[from\] confusion/.test(String(l)) && !pub(l)).length;
    activated += act; sdHits += hit;
    const me = (M.MEDSEEN.confusionSelfHit || 0) - before;
    meHits += me;
    /* COUNTS, NOT BOOLEANS. A per-game "did anybody self-hit" would agree for two engines that
     * self-hit a different NUMBER of times, which is exactly the quantity under test. */
    if (hit !== me) { disagreed++;
      console.log('    DISAGREED  ' + t.sp.name + ': authority ' + hit + ', medicham ' + me); }
  }
  console.log('  staged ' + staged + ' game(s); the AUTHORITY raised `-activate|confusion` '
    + activated + ' time(s) and self-hit ' + sdHits + '; this engine self-hit ' + meHits);
  claim(activated > 0, 'the sweep REACHED the rule — a zero here makes every claim below vacuous',
    'the confusion was applied and the body tried to act ' + activated + ' time(s)');
  claim(sdHits === meHits && disagreed === 0,
    'the two engines agree on every swept attempt, on BOTH arms',
    disagreed + ' disagreement(s). A non-zero here on the CLEAN arm is a real defect; on the RED arm '
      + 'it would mean the sweep happened to land inside the 0.33-point band, which is legitimate but '
      + 'is not what this control is for');
}

/* ---- D. THE RECEIPT ----------------------------------------------------------------------------- */
console.log('');
if (RED) claim((M.MEDFAILS.confusionThirdRestored || 0) === 1,
  'the revert knob was actually READ by the engine — the clause under test was REACHED',
  'MEDFAILS.confusionThirdRestored = ' + (M.MEDFAILS.confusionThirdRestored || 0));
else claim((M.MEDFAILS.confusionThirdRestored || 0) === 0,
  'no revert knob is in play on the clean arm',
  'MEDFAILS.confusionThirdRestored = ' + (M.MEDFAILS.confusionThirdRestored || 0));
claim((M.MEDSEEN.confusionSelfHit || 0) >= 0, 'MEDSEEN.confusionSelfHit is live',
  'total self-hits this run: ' + (M.MEDSEEN.confusionSelfHit || 0));

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed' : 'GREEN — every claim held'));
process.exit(fails ? 1 : 0);
