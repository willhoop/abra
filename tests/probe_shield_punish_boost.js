/* probe_shield_punish_boost.js — KING'S SHIELD LOWERS ATTACK THROUGH THE ONE STAT-DROP PATH
 *
 *   SHOWDOWN_PATH=... node tests/probe_shield_punish_boost.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= THE RULE, READ OFF THE FORMAT ================================================
 *
 *     data/moves.ts:9946-9948, inside `kingsshield.condition.onTryHit`
 *     (Champions inherits it whole — data/mods/champions/moves.ts:555-559 changes only `pp` and
 *     `isNonstandard`):
 *
 *       if (this.checkMoveMakesContact(move, source, target)) {
 *         this.boost({ atk: -1 }, source, target, this.dex.getActiveMove("King's Shield"));
 *       }
 *
 * `Battle#boost(boost, target, source, effect)` — so the body whose Attack moves is the ATTACKER
 * and the SOURCE of the drop is the shielder. That call is not a raw write to `boosts.atk`; it is
 * the same primitive Intimidate and Sticky Web go through, and three separate facts hang off it:
 *
 *   Contrary       `onChangeBoost` inverts the sign, so the punish becomes **+1 Attack**
 *                  (sim/battle.ts:2020 `runEvent('ChangeBoost', ...)`).
 *   Defiant        `onAfterEachBoost` fires per stat lowered by a NON-ALLY, +2 Attack
 *                  (sim/battle.ts:2073, inside the per-stat loop).
 *   Clear Body     `onTryBoost` refuses it and writes `|-fail|<attacker>|unboost|[from] ability: …`
 *
 * ================= WHAT THIS ENGINE DID ========================================================
 *
 * `medicham2-browser.js`'s `punishesContact` consumer wrote the vector STRAIGHT INTO `m.boosts`:
 *
 *     if(_pc.boosts&&m.boosts&&!m.fainted)for(const k in _pc.boosts){
 *       const _s=SD2ENG[k];if(_s&&m.boosts[_s]!=null){const _b0=m.boosts[_s];
 *         m.boosts[_s]=clamp(m.boosts[_s]+_pc.boosts[k],-6,6);
 *         if(TR)TR.bst(m,_s,m.boosts[_s]-_b0);}}
 *
 * — no `invSign`, no `refuseStatDrop`, no `retaliateWhenLowered`. Every OTHER stat-drop site in this
 * file carries the WIRE 100b marker; this one never did. It is the FACTS-ARE-GLOBAL rule broken:
 * "what happens when a foe lowers my Attack" is a fact about the game, not a property of the branch
 * that happened to apply it.
 *
 * MEASURED, not inferred — `data/game-differential.json` on release `a985300cb8ed` carries TWO
 * BOARD-MATERIAL first-divergence rows that are exactly this, both a Staraptor-Mega (Contrary,
 * derived) Brave Bird into an Aegislash King's Shield:
 *
 *     unrelated event mismatch :: |-boost|p2a|atk|1 <> |-unboost|p2a|atk|1
 *     unrelated event mismatch :: |-boost|p2b|atk|1 <> |-unboost|p2b|atk|1
 *
 * ================= THE FIVE ARMS ===============================================================
 *
 *   contrary   Malamar/Contrary   Facade into King's Shield        UNDER TEST — the sign inverts
 *   defiant    Kingambit/Defiant  Facade into King's Shield        UNDER TEST — the drop retaliates
 *   clearbody  Metagross/ClearBdy Facade into King's Shield        UNDER TEST — the drop is refused
 *   plain      Malamar/SuctionCup Facade into King's Shield        CONTROL — the SAME BODY, ability
 *                                                                  varied; it must still read -1
 *   protect    Malamar/Contrary   Facade into plain Protect        CONTROL — no punish exists, so
 *                                                                  nothing may appear
 *
 * `plain` is the knob-cleared control the Choice-Scarf lesson demands: same species, same move, same
 * shield, ONE ability changed. If `contrary` and `plain` come back identical the inversion is
 * unwired, whatever either says on its own.
 *
 * Facade is 100 accuracy and the shield refuses at step 1, above the accuracy roll at step 4, so no
 * arm here can be taken away by a corner arm's die.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * BOARD-MATERIAL. `boosts.atk` is a compared leaf. Said before the run.
 *
 * IT WRITES NOTHING. No artifact is touched. It asserts and exits non-zero on a failure.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }
require(D('tests', '_live_release.js'));

if (!process.argv.includes('--state')) process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
require(D('data', 'engine-data.js'));
const { mcKey } = require(D('engine', 'mc_key.js'));

const ARM_ID = (() => { const i = process.argv.indexOf('--arm');
                        return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'middle'; })();
const ARM = (G.ARM_BY_ID && G.ARM_BY_ID.get) ? G.ARM_BY_ID.get(ARM_ID) : null;

const mon = (species, ability, moves) => ({ species, item: '', ability, moves });
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);

const SHIELDER = 'Aegislash', KS = "King's Shield", PROT = 'Protect';
const CLICK = 'Facade';
const INVERTER = 'Malamar', AB_INV = 'Contrary', AB_PLAIN = 'Suction Cups';
const RETAL = 'Kingambit', AB_RETAL = 'Defiant';
const REFUSER = 'Metagross', AB_REFUSE = 'Clear Body';
const IDLE_P1 = ['Milotic', 'Recover'], IDLE_P2 = ['Torterra', 'Curse'];
const BENCH_P1 = [['Corviknight', 'Iron Defense'], ['Pinsir', 'Swords Dance']];
const BENCH_P2 = [['Talonflame', 'Roost'], ['Sinistcha', 'Calm Mind']];

console.log('\n  === THE CAST, CHECKED AGAINST THE FORMAT ===');
{
  let bad = 0;
  const claims = [[SHIELDER, KS], [SHIELDER, PROT], [INVERTER, CLICK], [RETAL, CLICK],
                  [REFUSER, CLICK], IDLE_P1, IDLE_P2, ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const good = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${good ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!good) bad++;
  }
  /* THE ABILITY IS THE VARIABLE, so every one of them is checked onto the species' own row rather
   * than typed beside a name. A probe that assigns an ability the body cannot have is testing a
   * Pokemon that does not exist. */
  const abOf = sp => Object.values(DEX.species.get(sp).abilities).map(x => DEX.abilities.get(x).name);
  for (const [sp, ab] of [[INVERTER, AB_INV], [INVERTER, AB_PLAIN], [RETAL, AB_RETAL], [REFUSER, AB_REFUSE]]) {
    const ok = abOf(sp).includes(ab);
    console.log(`  ability:  ${sp} / ${ab} -> ${ok ? 'ON ITS OWN ROW' : 'NOT AN ABILITY OF THIS BODY'}   (${abOf(sp).join(', ')})`);
    if (!ok) bad++;
  }
  for (const sp of [SHIELDER, INVERTER, RETAL, REFUSER, IDLE_P1[0], IDLE_P2[0],
                    ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    const k = mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' });
    if (!k) { console.log('  NO ENGINE ROW for ' + sp); bad++; }
  }
  /* THE CLICK MUST MAKE CONTACT AND MUST NOT MISS, both read off the move rather than recalled. */
  {
    const m = DEX.moves.get(CLICK);
    console.log('  ' + CLICK + '  accuracy ' + m.accuracy + '  contact ' + !!m.flags.contact
      + '  protect-flag ' + !!m.flags.protect + '  target ' + m.target);
    if (!m.flags.contact) { console.log('    NOT a contact move — the punish clause never fires.'); bad++; }
    if (m.accuracy !== true && m.accuracy < 100) { console.log('    can miss.'); bad++; }
  }
  /* AND THE SHIELD MUST BE THE ONE THAT PUNISHES WITH A BOOST. Read off the derived artifact, so a
   * second member arriving upstream is caught here rather than silently untested. */
  /* READ IN A SANDBOX, NEVER INTO THIS PROCESS'S GLOBALS. `data/abra-tags.js` assigns
   * `window.ABRA_TAGS`, and the first draft of this file made a bare `global.window` to catch it.
   * That is not inert: `data/move-effects.js` writes to `window.MOVE_EFFECTS` when a window exists
   * and to `globalThis` otherwise, while medicham2's `moveFxTable()` reads back off `globalThis` —
   * so the invented window made the FIRST arm throw `MOVE_EFFECTS not loaded`, which reads exactly
   * like a broken engine and was a broken probe. Same trap, same file, second time (see
   * tests/probe_imprison_seal.js:93). */
  {
    /* NO try/catch. A failure to read the artifact is a failure of the FIXTURE and must stop the
     * file, not fall through to a `T === null` that reports the membership as empty — an empty
     * membership reads exactly like "the artifact stopped deriving this tag", which is the finding
     * this block exists to make, so swallowing the reason would let the probe report its own
     * breakage as an engine finding. */
    const vm = require('vm'), fs = require('fs');
    const box = vm.createContext({ window: {} });
    vm.runInContext(fs.readFileSync(D('data', 'abra-tags.js'), 'utf8'), box, { filename: 'data/abra-tags.js' });
    const T = box.window.ABRA_TAGS;
    const p = T && T.moves && T.moves[DEX.moves.get(KS).id] && T.moves[DEX.moves.get(KS).id].params;
    const pc = p && p.punishesContact;
    console.log('  ' + KS + '  punishesContact ' + JSON.stringify(pc));
    if (!pc || !pc.boosts) { console.log('    the artifact does not give this shield a BOOST punish.'); bad++; }
    const members = T ? Object.keys(T.moves).filter(k => T.moves[k].params
      && T.moves[k].params.punishesContact && T.moves[k].params.punishesContact.boosts) : [];
    console.log('  every punishesContact member carrying `boosts`: ' + JSON.stringify(members));
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const attacker = arm => arm === 'defiant' ? mon(RETAL, AB_RETAL, [CLICK])
                      : arm === 'clearbody' ? mon(REFUSER, AB_REFUSE, [CLICK])
                      : arm === 'plain' ? mon(INVERTER, AB_PLAIN, [CLICK])
                      : mon(INVERTER, AB_INV, [CLICK]);
const TEAM_P1 = () => [mon(SHIELDER, 'Stance Change', [KS, PROT]),
                       mon(IDLE_P1[0], '', [IDLE_P1[1]]),
                       ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const TEAM_P2 = arm => [attacker(arm), mon(IDLE_P2[0], '', [IDLE_P2[1]]),
                        ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

/* The attacker is p2a and aims at p1a, the shielder. */
const script = arm => [{ p1: [{ m: arm === 'protect' ? PROT : KS }, { m: IDLE_P1[1] }],
                         p2: [{ m: CLICK, t: 0 }, { m: IDLE_P2[1] }] }];

/* ---- THE PROTOCOL REDUCER — the equivalences game_differential.js itself applies --------------- */
const norm = l => String(l)
  .replace(/(p[12][ab]?): ?[^|]*/g, '$1')
  .replace(/\|\d+\/\d+(\/\d+)?( [a-z]+)?/g, '|H/H')
  .toLowerCase()
  .split('|').map((f, i) => {
    let x = f.trim();
    if (i >= 2) x = x.replace(/^(\[from\]\s*)?(move|ability|item):\s*/, '$1');
    return x.replace(/[^a-z0-9\[\]/-]/g, '');
  })
  .filter(x => !/^\[of\]/.test(x) && !/^\[(silent|still|miss|spread|anim)\]/.test(x))
  .slice(0, (String(l).split('|')[1] === 'move') ? 4 : undefined).join('|');
/* `-ability` IS DROPPED WHOLE — `game_differential.js`'s `ability-announcement` (:2139) maps every
 * one to null. Defiant's `|-ability|p2a|Defiant|boost` is therefore invisible to the measurement
 * this file defends, and the probe must not be stricter than it. The `-boost atk 2` it precedes IS
 * kept, and that is the line that carries the mechanic. */
const SKIP_EVENT = new Set(['', 'split', 't:', '-ability']);
const turnSlice = (lines, n) => {
  const s = (lines || []).map(String);
  const i = s.findIndex(l => l === '|turn|' + n);
  if (i < 0) return [];
  let j = s.findIndex((l, k) => k > i && l.startsWith('|turn|'));
  if (j < 0) j = s.length;
  const raw = s.slice(i + 1, j), out = [];
  for (let k = 0; k < raw.length; k++) {
    if (raw[k] === '|split|p1' || raw[k] === '|split|p2') { if (raw[k + 1] != null) out.push(raw[k + 1]); k += 2; continue; }
    out.push(raw[k]);
  }
  return out.filter(l => !SKIP_EVENT.has(l.split('|')[1] || ''));
};
const stream = lines => turnSlice(lines, 1).map(norm);
/* SCOPED TO THE ATTACKER'S SLOT. The idle partner clicks Curse in every arm, so an unscoped filter
 * would carry three of its lines into every comparison and the `protect` control would "fail" on a
 * mechanic it does not touch. p2a is the body whose Attack the shield moves. */
const boostLines = lines => stream(lines).filter(l => /^\|-(un)?boost\|p2a\|/.test(l));
const failLines = lines => stream(lines).filter(l => /^\|-fail\|/.test(l));

/* THE BOARD LEAF ITSELF, read off both engines rather than inferred from the lines. */
const sdAtk = battle => { const p = battle && battle.p2 && battle.p2.active && battle.p2.active[0];
                          return p ? p.boosts.atk : null; };
const meAtk = S => { const m = S && S.actB && S.actB[0]; return m && m.boosts ? m.boosts.at : null; };

function run(arm) {
  const a = G.buildPair(TEAM_P1(), {}), b = G.buildPair(TEAM_P2(arm), {});
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'shield-punish-boost', arm, {
    script: script(arm), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sdAtk: sdAtk(battle), meAtk: meAtk(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sc: G.scriptCounters ? G.scriptCounters() : null, sdAll: sd, meAll: me };
}

console.log("\nKING'S SHIELD LOWERS ATTACK THROUGH `Battle#boost` — data/moves.ts:9946-9948\n");
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  knob MEDI_SHIELD_PUNISH_RAW_BOOST=' + (process.env.MEDI_SHIELD_PUNISH_RAW_BOOST || '0'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = ['contrary', 'defiant', 'clearbody', 'plain', 'protect'];
const UNDER = new Set(['contrary', 'defiant', 'clearbody']);
const R = {}; for (const a of ARMS) R[a] = run(a);

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const a of ARMS) {
  const x = R[a];
  console.log('\n' + '='.repeat(98));
  console.log('  ' + a.toUpperCase() + (UNDER.has(a) ? '  (UNDER TEST)' : '  (KNOWN-GOOD CONTROL)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  console.log('  showdown  ' + (stream(x.sdAll).join('  ') || '(none)'));
  console.log('  medicham  ' + (stream(x.meAll).join('  ') || '(none)'));
  console.log('  attacker boosts.atk   sd ' + JSON.stringify(x.seen.map(y => y.sdAtk))
            + '   me ' + JSON.stringify(x.seen.map(y => y.meAtk)));
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD LEAF, then the LINE');
console.log('='.repeat(98));

/* -- 1. THE FIXTURE ----------------------------------------------------------------------------- */
for (const a of ARMS) {
  const x = R[a];
  ok(x.verdict === 'RAN' && x.turns >= 1, 'the scripted turn was played — ' + a, 'turns ' + x.turns);
  ok(x.sc && x.sc.moveNotOnRequest === 0,
     "every scripted click was on the AUTHORITY's request — " + a, x.sc ? JSON.stringify(x.sc) : 'no counters');
  /* THE SHIELD MUST HAVE ANSWERED, off the authority's own line rather than off this file's
   * priority arithmetic. Without it every clause below is vacuously true. */
  ok(stream(x.sdAll).some(l => /^\|-activate\|p1a\|protect/.test(l)),
     'the AUTHORITY says the shield refused the click — ' + a, stream(x.sdAll).join('  '));
}

/* -- 2. THE KNOB-CLEARED CONTROL — an unwired inversion gives IDENTICAL output. ----------------- */
{
  const c = R.contrary.seen.map(y => y.sdAtk).join(','), p = R.plain.seen.map(y => y.sdAtk).join(',');
  ok(c !== p, 'the AUTHORITY moves when the ABILITY moves — same body, same click, same shield, and '
     + 'ONLY Contrary changed. Identical here would mean the fixture never exercises the mechanic',
     'contrary ' + c + '   plain ' + p);
}

/* -- 3. THE BOARD LEAF, engine against authority. ----------------------------------------------- */
for (const a of ARMS) {
  const x = R[a];
  const s = x.seen.map(y => y.sdAtk).join(','), m = x.seen.map(y => y.meAtk).join(',');
  ok(s === m, "the attacker's boosts.atk agrees with the authority — " + a,
     'authority ' + s + '   ours ' + m);
}

/* -- 4. THE BOARD COMPARATOR'S OWN VERDICT at every boundary. ----------------------------------- */
for (const a of ARMS) {
  const bad = (R[a].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 5. THE LINES. --------------------------------------------------------------------------- */
for (const a of ARMS) {
  const p = boostLines(R[a].sdAll), q = boostLines(R[a].meAll);
  ok(JSON.stringify(p) === JSON.stringify(q), 'the boost/unboost lines match — ' + a,
     'authority ' + JSON.stringify(p) + '\n          ours      ' + JSON.stringify(q));
}
for (const a of ARMS) {
  const p = failLines(R[a].sdAll), q = failLines(R[a].meAll);
  ok(JSON.stringify(p) === JSON.stringify(q), 'the `-fail` lines match — ' + a,
     'authority ' + JSON.stringify(p) + '\n          ours      ' + JSON.stringify(q));
}
ok(boostLines(R.protect.sdAll).length === 0 && boostLines(R.protect.meAll).length === 0,
   'a PLAIN Protect punishes nothing on either side — the clause a blanket "a shield lowers Attack" breaks',
   'authority ' + JSON.stringify(boostLines(R.protect.sdAll))
   + '  ours ' + JSON.stringify(boostLines(R.protect.meAll)));

/* -- 6. THE WHOLE TURN, line for line. ---------------------------------------------------------- */
for (const a of ARMS) {
  const sd = stream(R[a].sdAll), me = stream(R[a].meAll);
  ok(sd.join('  ') === me.join('  '), a.toUpperCase() + ' narration identical, line for line',
     'authority [' + sd.join('  ') + ']\n          ours      [' + me.join('  ') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
