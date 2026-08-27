#!/usr/bin/env node
/* tests/test-middle-identity.js — ROADMAP #262
 * ==================================================================================================
 * DO THE TWO ENGINES NAME THE SAME EVENT?
 *
 * The middle arm of `engine/game_differential.js` used to hand both engines the same SEQUENCE per
 * category. That design was refuted twice by its own measurements (its header keeps both): the draw
 * COUNTS differ by construction because medicham2 short-circuits determined rolls, and — worse —
 * with the counts matching, 29 of 40 surviving games diverged on a damage NUMBER while
 * `test-engine-diff --n 6000` reports zero damage disagreements. Our driver PRICES candidate moves
 * before it clicks one, and every speculative call moved the shared cursor. Two sequences hold the
 * same count at different OFFSETS.
 *
 * So the die became an ADDRESS:
 *
 *     value = FNV1a(seed | turn | category | move id | target slot | nth)  ->  [0,1)
 *
 * A speculative evaluation and a real one are then different QUESTIONS. Nothing is consumed.
 *
 * AND THAT MOVES THE WHOLE RISK ONTO ONE CLAIM: **the two engines must compute the SAME STRING for
 * the same event.** If they do not, the arm is not merely weaker than the sequence version — it is
 * worse than having no middle arm at all, because it looks synchronised and is not. Nothing in the
 * repository could have told us: the address is computed independently on each side, on purpose (the
 * engine must not require its own instrument), and two independent implementations that disagree both
 * keep running.
 *
 * SO THIS FILE DIFFS THE TWO LOGS OVER REAL GAMES AND QUOTES THE RATE. It does not assert that the
 * arm is correct; it MEASURES how much of it is, per category, and fails when the measured share
 * falls below what has been demonstrated. A shape that cannot match — a per-move accuracy roll
 * against the authority's per-target one — is printed by name rather than folded into an average.
 *
 * WHAT IT CANNOT SEE. Two engines can agree on an address and still mean different events: `nth` is a
 * repeat counter and a counter is a sequence wearing a smaller scope. If one side takes two draws at
 * an address and the other takes one, entry 0 lines up and everything after it is luck. The address
 * makes that collision small and countable; it does not abolish it. The `nth>0` population is printed
 * every run so its size is never assumed.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const SDP = process.env.SHOWDOWN_PATH;
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* `--games` IS READ TWICE AND THAT IS DELIBERATE — SO IT IS SET BEFORE THE DIFFERENTIAL LOADS.
 * `game_differential.js` parses this same argv AT REQUIRE TIME and sizes its STEERING POOL from it:
 * with no flag the pool is 10 teams per configuration, which yields 126 games and ~460 draws, and at
 * that size `crit` reads 94.9% against a 95 floor purely because the sample is thin. Asking for 900
 * widens the pool to ~200 teams and the same unchanged engine reads 98.5%. Defaulting the flag INTO
 * argv rather than only into a local is the whole point: a default that the downstream module cannot
 * see is a different default, and it made this file red on its own engine. ~19 seconds. */
function argFlag(name) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; }
if (!argFlag('--games')) process.argv.push('--games', '900');
const GAMES = +argFlag('--games');

/* THE DIFFERENTIAL IS LOADED FIRST AND ITS ENGINE IS THE ONE MEASURED. `game_differential.js` plays a
 * FROZEN RELEASE, never the live tree (CLAUDE.md: a measurement is a photograph). Requiring
 * `engine/medicham2-browser.js` directly here would load a SECOND module instance whose module-level
 * event fields nothing writes — and the log would come back full of `move=NONE tgt=-`, which reads
 * exactly like a broken engine. It cost twenty minutes the first time. Open the same release and take
 * the same instance. */
const GD = require(path.join(ROOT, 'engine', 'game_differential.js'));
const ER = require(path.join(ROOT, 'engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');

const BA = require(SDP + '/dist/sim/battle-actions');
const BattleActions = BA.BattleActions || BA.default || BA;
const BM = require(SDP + '/dist/sim/battle');
const Battle = BM.Battle || BM.default || BM;

const SEED = M.MID_EVENT_SEED;

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!ok) fails++;
};

/* ================================================================================================
 * 1. THE ADDRESS ARITHMETIC
 * ============================================================================================== */
console.log('\n1. THE ADDRESS ITSELF — a pure function of what is being rolled for');
claim(M.midEventValue('a|b|c|0') === M.midEventValue('a|b|c|0'),
  'the same address gives the same value — the claim every other one rests on');
claim(M.midEventValue('20260813|1|acc|icebeam|p20|0') !== M.midEventValue('20260813|2|acc|icebeam|p20|0'),
  'a different TURN is a different address');
claim(M.midEventValue('20260813|1|acc|icebeam|p20|0') !== M.midEventValue('20260813|1|acc|icebeam|p21|0'),
  'a different TARGET SLOT is a different address');
claim(M.midEventValue('20260813|1|acc|icebeam|p20|0') !== M.midEventValue('20260813|1|acc|icebeam|p20|1'),
  'a different REPEAT INDEX is a different address');
{
  let bad = 0;
  for (let i = 0; i < 5000; i++) { const v = M.midEventValue('x' + i); if (!(v >= 0 && v < 1)) bad++; }
  claim(bad === 0, 'every value lands inside [0,1)  [5,000 addresses]', bad + ' outside');
}
{ /* uniform enough to PRICE a move. A constant passes every claim above and fails this one. */
  let hit = 0; for (let i = 0; i < 5000; i++) if (M.midEventValue('acc|' + i) < 0.9) hit++;
  claim(Math.abs(hit / 5000 - 0.9) < 0.03,
    'uniform enough to price a 90-accuracy move  [5,000 addresses, +/- 3 points]',
    'hit rate ' + (hit / 5000).toFixed(4));
}
{ /* THE INDEPENDENT RE-IMPLEMENTATION. The engine and the differential each own twelve lines of
   * FNV-1a on purpose (the engine may not require its own instrument), so a third copy here is the
   * only thing that can catch one of them drifting. Constants read off the two files, not recalled. */
  const fnv = (s) => { let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    return (h >>> 0) / 4294967296; };
  let bad = 0;
  for (let i = 0; i < 2000; i++) { const s = '20260813|3|dmg|earthpower|p10|' + i;
    if (fnv(s) !== M.midEventValue(s)) bad++; }
  claim(bad === 0, 'FNV-1a, re-implemented here from the two constants rather than called',
    bad + ' of 2000 disagree');
}

/* ================================================================================================
 * 1b. THE FOUR WRITE SITES, STAGED — because the game diff cannot see one of them
 * ==============================================================================================
 * The whole-game diff below is dominated by the hit-step list (accuracy, damage, the crit, the
 * secondary), and every one of those is addressed from the ANNOUNCEMENT site. The write at the TOP of
 * the action — the one that matters for everything the authority draws ABOVE its BeforeMove gates —
 * shows up in the diff as a category of TWENTY-ODD events across nine hundred games, which is far too
 * thin to hold a rate against. So it is staged directly, deterministically, at the two events that
 * actually take a draw up there: the consecutive-Protect counter and the full-paralysis check.
 *
 * Both were shown RED by deleting that one write: the stall address becomes `…|any|-|-|0` and the
 * paralysis address becomes the same, because the announcement site is ~150 lines further down and
 * neither draw ever reaches it. */
const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) throw new Error('no MC row for ' + sp);
                       b.item = ''; b.ability = 'none'; return b; };
const unfaintable = (m) => { m.st = Object.assign({}, m.st, { hp: m.st.hp * 8 }); m.curHP = m.st.hp; };
console.log('\n1b. THE PRE-GATE WRITE — staged, because the game diff cannot hold a rate on it');
{
  const SH = { kind: 'protect', mv: 'protect' };
  const me = bare('incineroar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  unfaintable(me); unfaintable(ally);
  const dice = M.midEventDice({ seed: SEED });
  /* Turn 1 arms the stall counter; turn 2 is the draw. `me` is not last in the queue either turn, so
   * the shield is never short-circuited by `willAct()`. */
  M.battleTurn(S, dice, new Map([[me, SH], [ally, SH]]), new Map([[f1, SH], [f2, SH]]));
  M.battleTurn(S, dice, new Map([[me, SH], [ally, SH]]), new Map([[f1, SH], [f2, SH]]));
  const log = M.midEventLog();
  const hit = log.filter(a => /\|any\|protect\|p[12][01]\|/.test(a));
  claim(hit.length > 0,
    'the consecutive-Protect draw is addressed to `protect` and a real slot, ABOVE the announcement site',
    hit.length ? hit.length + ' such addresses, e.g. ' + hit[0]
               : 'NONE — every stall draw came back as `|any|-|-|`, which is what the authority calls '
                 + '`|any|protect|pXY|`, and the two can never match');
}
{
  const me = bare('incineroar'), ally = bare('incineroar');
  const f1 = bare('garchomp'), f2 = bare('garchomp');
  const S = M.battleInit([me, ally], [f1, f2], { seeded: true });
  unfaintable(me); unfaintable(ally); unfaintable(f1); unfaintable(f2);
  me.status = 'par';
  const dice = M.midEventDice({ seed: SEED });
  M.battleTurn(S, dice,
    new Map([[me, M.playerAction(me, 'knockoff', f1, S.field)], [ally, { kind: 'pass' }]]),
    new Map([[f1, { kind: 'pass' }], [f2, { kind: 'pass' }]]));
  const log = M.midEventLog();
  const hit = log.filter(a => /\|any\|knockoff\|p2[01]\|/.test(a));
  claim(hit.length > 0,
    'the full-paralysis check is addressed to the move it is gating, not to `-`',
    hit.length ? hit.length + ' such addresses, e.g. ' + hit[0]
               : 'NONE — the paralysis draw is anonymous, so the authority (which sets its active move '
                 + 'on the first line of runMove) can never be talking about the same event');
}

/* ================================================================================================
 * 2. THE AUTHORITY'S HALF — and the reason it has to be hooked HERE
 * ==============================================================================================
 * `game_differential.js` computes its side inside the function it installs as `battle.prng.random`.
 * `Battle#random` is `return this.prng.random(m, n)`, so `this` at that override is the **PRNG**, not
 * the battle — `this.turn`, `this.activeMove` and `this.activeTarget` are all undefined and every
 * address it builds is `<seed>|undefined|<cat>|-|-|<nth>`. That is measured below rather than argued:
 * both address streams are computed on every draw, one from the object the override actually receives
 * and one from the battle, and the two match rates are printed side by side. */
let SD_CAT = 'any';
const around = (name, cat) => {
  const fn = BattleActions.prototype[name];
  if (typeof fn !== 'function') throw new Error('BattleActions#' + name + ' has moved — this hook is guessing');
  BattleActions.prototype[name] = function (...a) {
    const prev = SD_CAT; SD_CAT = cat;
    try { return fn.apply(this, a); } finally { SD_CAT = prev; }
  };
};
around('hitStepAccuracy', 'acc');
around('secondaries', 'sec');
around('getDamage', 'dmg');

const NTH_BATTLE = new Map(), NTH_PRNG = new Map();
let LOG_BATTLE = [], LOG_PRNG = [];
const addr = (map, log, cat, ctx) => {
  const mv = ctx && ctx.activeMove, tg = ctx && ctx.activeTarget;
  const base = [SEED, ctx ? ctx.turn : 0, cat,
                mv ? mv.id : '-', (tg && tg.side) ? (tg.side.id + tg.position) : '-'].join('|');
  const n = map.get(base) || 0; map.set(base, n + 1);
  log.push(base + '|' + n);
};
let inBattleHook = false, SD_DRAWS = 0, SD_BYPASS = 0;
const oR = Battle.prototype.random, oC = Battle.prototype.randomChance, oS = Battle.prototype.sample;
Battle.prototype.random = function (m, n) {
  addr(NTH_BATTLE, LOG_BATTLE, (SD_CAT === 'dmg' && n !== undefined) ? 'crit' : SD_CAT, this);
  inBattleHook = true; try { return oR.call(this, m, n); } finally { inBattleHook = false; }
};
Battle.prototype.randomChance = function (num, den) {
  addr(NTH_BATTLE, LOG_BATTLE, (SD_CAT === 'dmg') ? 'crit' : SD_CAT, this);
  inBattleHook = true; try { return oC.call(this, num, den); } finally { inBattleHook = false; }
};
/* `PRNG#sample` takes exactly one `random()` and does NOT go through `Battle#random`; leaving it out
 * silently dropped 19 of 67 authority draws on the first run of this file. */
Battle.prototype.sample = function (items) {
  addr(NTH_BATTLE, LOG_BATTLE, SD_CAT, this);
  inBattleHook = true; try { return oS.call(this, items); } finally { inBattleHook = false; }
};

const ARM = GD.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');
const armRandom = ARM.random, armChance = ARM.chance;
ARM.random = function (m, n) {
  SD_DRAWS++; if (!inBattleHook) SD_BYPASS++;
  addr(NTH_PRNG, LOG_PRNG, (SD_CAT === 'dmg' && n !== undefined) ? 'crit' : SD_CAT, this);
  return armRandom.call(this, m, n);
};
ARM.chance = function (num, den) {
  SD_DRAWS++; if (!inBattleHook) SD_BYPASS++;
  addr(NTH_PRNG, LOG_PRNG, (SD_CAT === 'dmg') ? 'crit' : SD_CAT, this);
  return armChance(num, den);
};
/* THE ENGINE'S HALF: its own event-addressed dice, in place of the arm's sequences. */
ARM.mediRng = () => M.midEventDice({ seed: SEED });

/* ================================================================================================
 * 3. THE GAMES
 * ============================================================================================== */
const CONFIGS = GD.SW.out.map(c => c.config);
/* MORE PAIRINGS THAN `pairsFor` OFFERS. It pairs the pool as (0,1), (2,3), … — 39 games across all
 * nine configurations, which is 260 draws and far too thin to quote a per-category rate off. The
 * offsets below re-pair the SAME pool, so no new team enters the sample and the extra games are the
 * same population seen against different opponents. */
function pairings(cfgId, offsets) {
  const cfg = GD.SW.out.find(c => c.config === cfgId);
  const pool = (cfg && cfg.picked_teams) || [];
  const out = [];
  for (const off of offsets) {
    for (let i = 0; i + off < pool.length; i += 2) {
      const a = GD.buildPair(pool[i].team), b = GD.buildPair(pool[i + off].team);
      if (!a || !b) continue;
      out.push({ a, b, tag: pool[i].id + ' vs ' + pool[i + off].id });
    }
  }
  return out;
}

const tot = { sdB: 0, me: 0, both: 0, sdP: 0, bothP: 0 };
const perCat = new Map();
const unmatchedMe = new Map(), unmatchedSd = new Map();
let repeats = 0, games = 0, threw = 0;
const NAMED = ['acc', 'sec', 'dmg', 'crit'];
/* THE DIFFERENTIAL'S OWN ADDRESSES, READ BACK OUT OF IT RATHER THAN RECOMPUTED HERE — `GD.midAddresses()`
 * returns the strings `game_differential.js` actually built on this game. See the claims in section 2. */
let gNamed = 0, gDegen = 0, gNoBattle = 0, namedMe = 0, namedBothG = 0;
/* ---- `any` IS TWO POPULATIONS AND POOLING THEM MEASURES NOTHING --------------------------------
 *
 * `any` is the residual bucket — everything drawn outside `hitStepAccuracy`, `secondaries` and
 * `getDamage`. Two completely different kinds of draw land in it and only one of them CAN match:
 *
 *   any*  a draw taken INSIDE an action, with a move named: the BeforeMove gates (paralysis, sleep,
 *         freeze, Attract) and the stall counter. Both engines know the move and the target, so a
 *         mismatch here is a real defect and this is the half that is floored.
 *   any-  a draw with NO move in scope. On the authority these are `Side#randomFoe` at queue
 *         resolution and `BattleQueue#insertChoice` after a switch — both taken BEFORE
 *         `setActiveMove`, neither of which this engine has. On our side it is `sortTurnOrder`'s
 *         speed-tie key, and under this arm the authority's tie resolver is `PRNG#shuffle`, which the
 *         pin replaces with a NO-OP that draws nothing at all.
 *
 * So `any-` is unmatchable ON BOTH SIDES BY CONSTRUCTION. Pooling it in dragged the `any` rate from
 * 77.8% to 11.2% between a 39-game and a 200-game sample WITHOUT ANY ENGINE CHANGE — the second
 * sample simply had more speed ties. A metric that moves like that measures the fixture. */
const catOf = (a) => { const p = a.split('|'); return p[2] === 'any' ? (p[3] === '-' ? 'any-' : 'any*') : p[2]; };
const shape = (a) => { const p = a.split('|'); return p[2].padEnd(5) + ' move=' + p[3] + ' tgt=' + p[4] + ' nth=' + p[5]; };

outer:
for (const cfg of CONFIGS) {
  for (const pr of pairings(cfg, [1, 3, 5, 7, 9, 11])) {
    NTH_BATTLE.clear(); NTH_PRNG.clear(); LOG_BATTLE = []; LOG_PRNG = [];
    GD.midResetAddresses();
    try { GD.playGame(pr.a, pr.b, cfg, 'identity', { arm: ARM }); }
    catch (e) { threw++; continue; }
    const me = new Set(M.midEventLog());
    const sdB = new Set(LOG_BATTLE), sdP = new Set(LOG_PRNG);
    /* THE REAL FILE'S OWN STRINGS. Its buffer is cleared per game above so this set is comparable
     * with `me`, which `midEventDice` clears on each call. */
    const A = GD.midAddresses(); const sdG = new Set(A.sd); gNoBattle += A.no_battle;
    for (const x of sdG) {
      const p = x.split('|');
      if (!NAMED.includes(p[2] === 'any' ? 'any' : p[2])) continue;
      gNamed++;
      /* THE DEGENERATE SHAPE: `<seed>|0|<cat>|-|-|<nth>` (or `undefined` for the turn). It is what the
       * address builder produces when the object in scope is the PRNG rather than the battle — turn,
       * activeMove and activeTarget all absent — and it is a global SEQUENCE wearing an address. */
      if (p[1] === '0' || p[1] === 'undefined' || p[3] === '-' || p[4] === '-') gDegen++;
    }
    for (const x of me) {
      const c = catOf(x);
      if (!perCat.has(c)) perCat.set(c, { sd: 0, me: 0, both: 0 });
      perCat.get(c).me++;
      if (+x.split('|')[5] > 0) repeats++;
      if (sdB.has(x)) { perCat.get(c).both++; tot.both++; }
      else unmatchedMe.set(shape(x), (unmatchedMe.get(shape(x)) || 0) + 1);
      if (sdP.has(x)) tot.bothP++;
      if (NAMED.includes(c)) { namedMe++; if (sdG.has(x)) namedBothG++; }
    }
    for (const x of sdB) {
      const c = catOf(x);
      if (!perCat.has(c)) perCat.set(c, { sd: 0, me: 0, both: 0 });
      perCat.get(c).sd++;
      if (!me.has(x)) unmatchedSd.set(shape(x), (unmatchedSd.get(shape(x)) || 0) + 1);
    }
    tot.sdB += sdB.size; tot.sdP += sdP.size; tot.me += me.size;
    if (++games >= GAMES) break outer;
  }
}

console.log('\n2. THE AUTHORITY\'S ADDRESS — computed two ways on every single draw');
console.log('     release ' + REL.id + ',  ' + games + ' games'
  + (threw ? ',  ' + threw + ' threw and were skipped' : ''));
console.log('     ' + SD_DRAWS + ' draws served by the arm,  ' + tot.sdB + ' addresses recorded,  '
  + SD_BYPASS + ' bypassed Battle#random/#randomChance/#sample');
claim(SD_BYPASS === 0,
  'every authority draw was seen where the BATTLE is in scope (a bypass is an unaddressable draw)',
  SD_BYPASS + ' bypassed');
const rateB = 100 * tot.both / Math.max(1, tot.me), rateP = 100 * tot.bothP / Math.max(1, tot.me);
const rateG = 100 * namedBothG / Math.max(1, namedMe);
console.log('     from the BATTLE (this file\'s hook)                   ' + rateB.toFixed(1) + '% of medicham2\'s events matched');
console.log('     from the object `battle.prng.random` receives         ' + rateP.toFixed(1) + '% — the PRE-FIX');
console.log('       shape, kept as a control. `Battle#random` is `this.prng.random(m,n)`, so `this` there is');
console.log('       the PRNG: turn, activeMove and activeTarget are all undefined and every address built');
console.log('       from it is `<seed>|undefined|<cat>|-|-|<nth>`.');
console.log('     from game_differential.js\'s OWN log, read back out    ' + rateG.toFixed(1)
  + '% over ' + namedMe + ' named events');
console.log('       ' + gDegen + ' of ' + gNamed + ' of its named-category addresses were degenerate,  '
  + gNoBattle + ' draws made with no battle in scope');

/* RETIRED AND REPLACED 2026-08-27 — THE SECOND TIME THIS CLAUSE HAS HAD TO BE REPLACED, AND FOR THE
 * OPPOSITE REASON TO THE FIRST.
 *
 * 2026-08-13: the original clause asserted that game_differential.js computes a DEGENERATE address and
 * would never have noticed the fix, because `rateP` measures a RE-IMPLEMENTATION of the wiring inside
 * this file rather than the file itself. Its replacement read the real file's SOURCE TEXT for
 * `MID_BATTLE = this.battle`, on the argument that a source check on the actual bytes beats a perfect
 * measurement of a copy.
 *
 * IT PINNED A SPELLING, AND THE SPELLING MOVED. Commit `ae6be2aa` put the wrapper's state into a
 * globalThis-shared holder so a second module load could not silently write into a dead copy —
 * `MID_BATTLE` became `MIDW.battle`, the capture line became `MIDW.battle = this.battle || null`, and
 * the identifier survives in that file only in COMMENTS. The clause went red on a file that does
 * exactly the thing it was checking for, and stayed red across two sessions because "the source
 * doesn't say X" reads like a real defect. A grep is a claim about a NAME; a name is the one thing in
 * this repository nothing keeps in step.
 *
 * SO IT NOW READS THE ADDRESSES THE FILE ACTUALLY BUILT. `GD.midAddresses()` hands back the strings
 * `midDraw` pushed on this game — the real bytes running, not a copy of them and not a grep for them —
 * and a capture that is not happening cannot fake a turn number or a move id. Shown RED by replacing
 * the capture with `MIDW.battle = null`: `1913 of 1913 degenerate` and the named identity 99.1% -> 0.0%. */
claim(gNamed > 0 && gDegen === 0,
  'game_differential.js CAPTURES the battle: the addresses IT built name a turn, a move and a target',
  gDegen + ' of ' + gNamed + ' named-category addresses came back as `<seed>|0|<cat>|-|-|<nth>` — the '
  + 'shape the builder produces when the object in scope is the PRNG and not the battle');
const GD_SRC = require('fs').readFileSync(require('path').join(__dirname, '..', 'engine', 'game_differential.js'), 'utf8');
claim(/midReset\(\);\s*midClearNth\(\)/.test(GD_SRC),
  'and CLEARS the repeat index per game',
  'turn is part of the address, so without this turn 1 of game 2 keeps counting from game 1 and every address after the first game is unreachable');
claim(rateP < 5, 'the in-file re-implementation of the OLD wiring is still degenerate (a control, not a defect)',
  'measured ' + rateP.toFixed(1) + '% -- this is the pre-fix shape kept as a control so the two can be told apart');

console.log('\n3. THE DIFF — of the events each engine asked about, how many did the other ask about?');
console.log('     medicham2 asked ' + tot.me + ',  the authority asked ' + tot.sdB + ',  shared ' + tot.both);
console.log('     of MEDICHAM2\'s events, the authority also asked:  ' + rateB.toFixed(1) + '%');
console.log('     of the AUTHORITY\'s events, medicham2 also asked:  '
  + (100 * tot.both / Math.max(1, tot.sdB)).toFixed(1) + '%');
console.log('     addresses drawn more than once (nth > 0): ' + repeats
  + ' of ' + tot.me + ' — the population where a count difference can still hide');
console.log('\n     cat        sd        me    shared    medicham2-matched');
let nMe = 0, nBoth = 0;
for (const [c, v] of [...perCat].sort((a, b) => b[1].sd - a[1].sd)) {
  console.log('     ' + c.padEnd(6) + String(v.sd).padStart(8) + String(v.me).padStart(10)
    + String(v.both).padStart(10) + ('' + (100 * v.both / Math.max(1, v.me)).toFixed(1) + '%').padStart(18));
  if (NAMED.includes(c)) { nMe += v.me; nBoth += v.both; }
}
const namedRate = 100 * nBoth / Math.max(1, nMe);
const anyCat = perCat.get('any*') || { me: 0, both: 0 };
const anyRate = 100 * anyCat.both / Math.max(1, anyCat.me);
const anyDash = perCat.get('any-') || { me: 0, sd: 0 };

/* ---- THE FLOORS ---------------------------------------------------------------------------------
 * Two, not one, and they are separate because they break separately.
 *
 * THE NAMED FOUR (acc / sec / dmg / crit) are the categories that decide an outcome, and every one of
 * them is drawn from inside the hit-step list where BOTH engines know the move and the target. They
 * are the claim the arm rests on.
 *
 * `any*` IS DELIBERATELY NOT FLOORED, AND REFUSING TO FLOOR IT IS THE HONEST ANSWER RATHER THAN A
 * SOFTENING. It is a grab-bag — the BeforeMove gates, the stall counter, a multi-hit count, a status
 * pick — and it is TINY: 27 medicham2 events across 900 games. Measured on two samples of the same
 * unchanged engine it read 95.2% (126 games, small steering pool, dominated by Protect) and 37.0%
 * (900 games, large pool, no Protect in it at all). A number that moves 58 points on the FIXTURE is
 * measuring the fixture. Its write site is staged deterministically in section 1b instead, which is
 * where a claim about it can actually be wrong. The shapes are printed below and the residual is
 * carried openly in docs/ENGINE.md rather than averaged into a headline.
 *
 * `any-` is excluded outright: neither engine makes the other's draw and under this arm the
 * authority's tie resolver is a no-op that draws nothing at all.
 *
 * THE FLOORS ARE PER CATEGORY AND THE POOLED ONE IS ONLY A BACKSTOP, because pooling hid a real
 * break: deleting the PER-TARGET write took `dmg` from 98.8% to 90.5% and `crit` from 98.5% to 90.2%
 * while the pooled figure only fell to 91.2% — over a floor of 90, i.e. GREEN on a broken engine.
 * Measured across four sample sizes (200/500/900/1400 games) on the shipped engine:
 *
 *     acc   98.4  99.6  99.7  99.7      floored at 95
 *     dmg   97.9  98.2  98.8  98.9      floored at 95   <- catches the per-target break at 90.5
 *     crit  97.2  97.8  98.5  98.6      floored at 95   <- catches it at 90.2
 *     sec   82.4  84.7  91.0  89.4      floored at 70, and it is LOOSE ON PURPOSE
 *
 * `sec` swings nine points on the sample because of the authority quirk named at the bottom of this
 * file — `secondaries()` does not update `activeTarget`, so every target's secondary on a spread move
 * is addressed to the LAST body — and how many spread moves a sample contains is a property of the
 * steering pool, not of the engine. A tight floor on a number that moves with the fixture is a flake
 * generator, and a flaky gate is one people learn to ignore. */
const FLOOR = { acc: 95, dmg: 95, crit: 95, sec: 70 }, FLOOR_POOLED = 90;
console.log('');
for (const c of NAMED) {
  const v = perCat.get(c) || { me: 0, both: 0 };
  const r = 100 * v.both / Math.max(1, v.me);
  claim(v.me > 0 && r >= FLOOR[c],
    '`' + c + '` agrees on at least ' + FLOOR[c] + '% of medicham2\'s events',
    'measured ' + r.toFixed(1) + '% over ' + v.me + ' events');
}
claim(namedRate >= FLOOR_POOLED,
  'BACKSTOP: the four pooled agree on at least ' + FLOOR_POOLED + '% (the per-category floors above do the work)',
  'measured ' + namedRate.toFixed(1) + '% over ' + nMe + ' events');
/* AND THE SAME BACKSTOP AGAINST THE DIFFERENTIAL'S OWN LOG. Every rate above is computed from this
 * file's `Battle.prototype` hook, which is a re-implementation of the wiring it is judging; this one is
 * computed from the strings `game_differential.js` built. The two should be the same number and the
 * only way they part is the arm going unsynchronised, which is the failure the whole file exists for. */
claim(rateG >= FLOOR_POOLED,
  'and the ADDRESSES THE DIFFERENTIAL ITSELF BUILT clear the same floor (not this file\'s copy of them)',
  'measured ' + rateG.toFixed(1) + '% over ' + namedMe + ' events, against '
  + namedRate.toFixed(1) + '% from this file\'s hook');
console.log('  --    `any*` (a move in scope) NOT FLOORED — ' + anyCat.both + ' of ' + anyCat.me
  + ' = ' + anyRate.toFixed(1) + '%. Too small and too fixture-dependent to hold a rate against');
console.log('        (95.2% on one 126-game sample, 37.0% on a 900-game one, same engine). Its write site is');
console.log('        staged in 1b instead. Residual carried in docs/ENGINE.md, not averaged away.');
console.log('  --    `any-` (no move in scope) EXCLUDED — ' + anyDash.me
  + ' ours (the speed-tie key) against ' + anyDash.sd + ' theirs (randomFoe at queue');
console.log('        resolution, insertChoice after a switch). Unmatchable on both sides by construction.');
claim(tot.me > 500, 'the sample is big enough to quote a rate off', tot.me + ' medicham2 events');

console.log('\n   THE SHAPES THAT DO NOT MATCH — printed, never averaged away:');
console.log('\n   -- medicham2 asked, the authority did not:');
for (const [k, v] of [...unmatchedMe].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log('   ' + String(v).padStart(5) + '  ' + k);
console.log('\n   -- the authority asked, medicham2 did not:');
for (const [k, v] of [...unmatchedSd].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log('   ' + String(v).padStart(5) + '  ' + k);
console.log('\n   NO STANDING SHAPE LEFT — BOTH ARE CLOSED:');
console.log('     * CLOSED 2026-08-18, ROADMAP #294: `acc` on the SECOND body of a spread move.');
console.log('       medicham2 rolled accuracy ONCE per move and declared it at its own roll site;');
console.log('       the authority loops `hitStepAccuracy(targets: Pokemon[], ...)` (battle-actions');
console.log('       .ts:690-692) and draws per target, so the first target matched and the rest');
console.log('       COULD NOT. It now draws per target too, against that target\'s own modifiers.');
console.log('       Paired on the same 900-game sample, the engine the only file that moved: the');
console.log('       authority-asked-and-medicham2-did-not list lost EVERY acc row (10 mortalspin');
console.log('       p11, 7 matchagotcha p11, 5 mortalspin p21, 2 heatwave p11 -> none); `acc`');
console.log('       identity 97.7% over 131 events -> 98.8% over 163; and of the AUTHORITY\'s');
console.log('       events, the share medicham2 also asks rose 59.7% -> 63.4%. Probe:');
console.log('       tests/test-mechanics.js move|spreadFoes, all four outcomes reachable.');
console.log('       AND IT MOVES SEEDED `rngStreams` RUNS — a spread move now consumes one acc');
console.log('       draw per target, so no self-play or rollout number may be read across it.');
console.log('     * CLOSED 2026-08-26, ROADMAP #262: `sec` on the SECOND body of a spread move.');
console.log('       `BattleActions#secondaries` (:1336-1351) does NOT set `activeTarget` in its own');
console.log('       loop, so the authority addresses every target\'s secondary to the LAST body that');
console.log('       reached `getSpreadDamage` (:1154) and separates them with `nth` — AND a secondary');
console.log('       that FIRES re-enters moveHit, whose own getSpreadDamage moves `activeTarget` onto');
console.log('       ITS target. medicham2 addressed each to its own body. This entry used to read');
console.log('       "copying the authority here would make the address stop naming the event, so it');
console.log('       is left", and that judgement was wrong on its own terms: the authority\'s address');
console.log('       ALREADY does not name the target, and the arm\'s one claim is that both engines');
console.log('       compute the SAME STRING for the same event. medicham2 now carries the authority\'s');
console.log('       activeTarget through the secondary step (`_secDraw`/`_secFired`). Measured either');
console.log('       side on a 900-game sample: `sec` identity 91.6% over 250 events -> 97.9% over 288,');
console.log('       and every `matchagotcha` row left BOTH unmatched lists. Probe:');
console.log('       tests/probe_spread_secondary_address.js, five staged arms, two of them');
console.log('       single-body controls that must NOT move, red under MEDI_SEC_ADDR_PER_TARGET=1.');
console.log('       IT MOVES NO SEEDED `rngStreams` RUN — unlike the `acc` entry above. `MID_TGT` is');
console.log('       read by `midEventDraw` alone, so no self-play game, rollout or census probe can');
console.log('       tell the two arms apart; the census read 716/716 either side.');

console.log('\n' + (fails ? 'RED — ' + fails + ' claim(s) failed' : 'GREEN — every claim held') + '\n');
process.exit(fails ? 1 : 0);
