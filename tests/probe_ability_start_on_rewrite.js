/* probe_ability_start_on_rewrite.js — AN ABILITY THAT ARRIVES MID-BATTLE RUNS ITS OWN `Start`
 *
 *   SHOWDOWN_PATH=... node tests/probe_ability_start_on_rewrite.js
 *   ... --arm middle          (the default; any id in game_differential's ARMS)
 *
 * ================= THE RULE, READ OFF THE FORMAT ================================================
 *
 *   Skill Swap  — `Battle#skillSwap`, sim/battle.ts:1311-1341. After the `-activate` line and the
 *                 two `End` events it writes both abilities and then:
 *                     this.singleEvent('Start', sourceAbility, target.abilityState, target);
 *                     this.singleEvent('Start', targetAbility, source.abilityState, source);
 *                 TARGET FIRST, then SOURCE — the authority's own order, and it matters when both
 *                 arriving abilities have something to say.
 *
 *   Worry Seed / Entrainment / Simple Beam — `Pokemon#setAbility`, sim/pokemon.ts:1946-1949:
 *                     if (ability.id && this.battle.gen > 3 && ...) {
 *                       this.battle.singleEvent('Start', ability, this.abilityState, this, source);
 *                     }
 *
 * So a Sand Stream that arrives by Skill Swap SETS THE SANDSTORM, and an Intimidate that arrives
 * that way DROPS THE FOES' ATTACK — at that instant, not at the next switch.
 *
 * ================= WHAT THIS ENGINE DID ========================================================
 *
 * `abRewrite()` (medicham2-browser.js) ends the OUTGOING ability — it carries the Flash Fire
 * volatile clause added 2026-08-29, which is `singleEvent('End', oldAbility, ...)` — and then simply
 * assigns `m.ability`. Nothing anywhere ran the INCOMING ability's Start, so every entry handler in
 * the format was dead on a mid-battle rewrite: no weather, no terrain, no Intimidate, no Screen
 * Cleaner, no Frisk.
 *
 * MEASURED, not inferred. On release `583f3f5ff815` these are TWO of the 48 board-material
 * first-divergence rows, and both are a Skill Swap:
 *
 *   event missing from medicham2 :: |-unboost|p1b|atk|1 <> |upkeep
 *     |-activate|p1b: Wyrdeer|Skill Swap|flashfire|intimidate|[of] p2a: Ceruledge
 *     showdown then writes |-unboost|p1b: Wyrdeer|atk|1 — Ceruledge's new Intimidate, on the body
 *     that handed it over. Ours wrote nothing.
 *
 *   event missing from medicham2 :: |-weather|sandstorm|[from]sandstream <> |move|p1b|knockoff
 *     |-activate|p2a: Medicham|Skill Swap|sandstream|purepower|[of] p1b: Tyranitar
 *     showdown then writes |-weather|Sandstorm|[from] ability: Sand Stream|[of] p2a: Medicham.
 *     Ours went straight on to the next move, and the whole game then ran without a sandstorm —
 *     `-weather ... [upkeep]` and the residual chip on every subsequent turn.
 *
 * ================= THE FIVE ARMS ===============================================================
 *
 *   swap-into-intimidate  Wyrdeer/Intimidate Skill Swaps p2a. p2a gains Intimidate and its Start
 *                         drops BOTH of p1's actives.                              UNDER TEST.
 *   swap-into-weather     TWO TURNS. Turn 1 Wyrdeer puts RAIN up; turn 2 Wyrdeer/Sap Sipper Skill
 *                         Swaps p2b Tyranitar/Sand Stream, so WYRDEER gains Sand Stream and its
 *                         Start replaces the sky — the OTHER end of the swap, which a fix aimed at
 *                         the target alone would miss. The rain is not decoration: Tyranitar is
 *                         standing on the field, so the sandstorm its own entry set is ALREADY UP
 *                         and re-setting it writes no line at all. The first draft of this arm had
 *                         no rain in it and was VACUOUS — both engines agreed, on nothing, and the
 *                         probe would have gone green through the defect.          UNDER TEST.
 *   entrain               Pangoro/Mold Breaker Entrainments p2a — the ONE-ENDED rewrite, through
 *                         `setAbility` rather than `skillSwap`.                     UNDER TEST, and
 *                         see the ceiling printed below: every Entrainment-reachable onStart in this
 *                         format announces with `|-ability|`, which the differ drops, so this arm is
 *                         a MUST-NOT-BREAK rather than a demonstration.
 *   swap-inert            Wyrdeer/Sap Sipper Skill Swaps p2a Medicham/Pure Power. Neither ability
 *                         has an entry handler, so NOTHING may appear.       KNOWN-GOOD CONTROL.
 *   no-swap               The identical board with the swap click replaced by Agility. KNOWN-GOOD
 *                         CONTROL — the clause a blanket "re-run the entry pass" breaks.
 *
 * `swap-inert` is the knob-cleared control: the SAME body, the SAME click, the SAME target, one
 * ability changed. If it moves with the fix, the fix is firing an entry pass rather than an
 * ability's own Start.
 *
 * Skill Swap and Entrainment are both `accuracy: true`, asserted below off the format, so no arm
 * here can be taken away by a corner arm's die.
 *
 * ================= WHICH SCOREBOARD =============================================================
 *
 * BOARD-MATERIAL. `boosts.atk` and the field's weather are both compared leaves. Said before the run.
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

const SWAPPER = 'Wyrdeer', SWAP = 'Skill Swap', IDLE_SELF = 'Agility', RAIN = 'Rain Dance';
const AB_DROP = 'Intimidate', AB_INERT_USER = 'Sap Sipper';
const WRITER = 'Pangoro', WRITE = 'Entrainment', AB_WRITER = 'Mold Breaker', IDLE_WRITER = 'Bulk Up';
const T_INERT = 'Medicham', AB_T_INERT = 'Pure Power', IDLE_T_INERT = 'Bulk Up';
const T_SKY = 'Tyranitar', AB_SKY = 'Sand Stream', IDLE_T_SKY = 'Iron Defense';
const IDLE_P1 = ['Milotic', 'Recover'];
const BENCH_P1 = [['Corviknight', 'Iron Defense'], ['Pinsir', 'Swords Dance']];
const BENCH_P2 = [['Talonflame', 'Roost'], ['Sinistcha', 'Calm Mind']];

/* READ IN A SANDBOX, NEVER INTO THIS PROCESS'S GLOBALS — `data/move-effects.js` writes to
 * `window.MOVE_EFFECTS` when a window exists and medicham2 reads back off `globalThis`, so an
 * invented window makes the first arm throw `MOVE_EFFECTS not loaded` (probe_imprison_seal.js:93). */
const TAGS_DB = (() => {
  const vm = require('vm'), fs = require('fs');
  const box = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(D('data', 'abra-tags.js'), 'utf8'), box, { filename: 'data/abra-tags.js' });
  return box.window.ABRA_TAGS;
})();

console.log('\n  === THE CAST, CHECKED AGAINST THE FORMAT ===');
{
  let bad = 0;
  const claims = [[SWAPPER, SWAP], [SWAPPER, IDLE_SELF], [WRITER, WRITE], [WRITER, IDLE_WRITER],
                  [T_INERT, IDLE_T_INERT], [T_SKY, IDLE_T_SKY], [SWAPPER, RAIN], IDLE_P1, ...BENCH_P1, ...BENCH_P2];
  for (const [sp, mv] of claims) {
    const good = CS.canLearn(sp, mv);
    console.log(`  learnset: ${sp} / ${mv} -> ${good ? 'LEGAL' : 'NOT LEGAL'}`);
    if (!good) bad++;
  }
  const abOf = sp => Object.values(DEX.species.get(sp).abilities).map(x => DEX.abilities.get(x).name);
  for (const [sp, ab] of [[SWAPPER, AB_DROP], [SWAPPER, AB_INERT_USER], [WRITER, AB_WRITER],
                          [T_INERT, AB_T_INERT], [T_SKY, AB_SKY]]) {
    const ok = abOf(sp).includes(ab);
    console.log(`  ability:  ${sp} / ${ab} -> ${ok ? 'ON ITS OWN ROW' : 'NOT AN ABILITY OF THIS BODY'}   (${abOf(sp).join(', ')})`);
    if (!ok) bad++;
  }
  for (const sp of [SWAPPER, WRITER, T_INERT, T_SKY, IDLE_P1[0],
                    ...BENCH_P1.map(x => x[0]), ...BENCH_P2.map(x => x[0])]) {
    const k = mcKey(sp, { mayMiss: 'a probe cast must resolve; a miss is a FAILED fixture, never a substitution' });
    if (!k) { console.log('  NO ENGINE ROW for ' + sp); bad++; }
  }
  for (const id of [SWAP, WRITE, RAIN]) {
    const m = DEX.moves.get(id);
    console.log('  ' + id + '  accuracy ' + m.accuracy + '  target ' + m.target);
    if (m.accuracy !== true && m.accuracy < 100) { console.log('    can miss — this arm would be a coin flip.'); bad++; }
  }
  /* THE TWO ABILITIES UNDER TEST MUST CARRY AN ENTRY HANDLER IN THE DERIVED ARTIFACT, and the two
   * controls must NOT. Read off the tags rather than asserted, so a derivation that stops carrying
   * one is caught here instead of turning both arms silently vacuous. */
  const ENTRY_TAGS = ['onSwitchInDrop', 'weatherSetter', 'terrainSetter', 'clearsScreensOnEntry',
                      'announcesOnEntry', 'healsAllyOnEntry'];
  const entryOf = ab => { const r = TAGS_DB.abilities[DEX.abilities.get(ab).id];
                          return r ? ENTRY_TAGS.filter(t => r.params && r.params[t]) : ['NO ROW']; };
  for (const [ab, want] of [[AB_DROP, true], [AB_SKY, true], [AB_INERT_USER, false], [AB_T_INERT, false]]) {
    const e = entryOf(ab);
    console.log('  entry handlers on ' + ab + ': ' + (e.length ? e.join(',') : '(none)')
      + '   ' + (!!e.length === want ? 'as required' : 'WRONG FOR THIS ARM'));
    if (!!e.length !== want) bad++;
  }
  /* THE `entrain` ARM'S CEILING, PRINTED RATHER THAN ASSUMED. Every ability an Entrainment can hand
   * over in this format is listed with whatever entry handler it carries; if none of them writes a
   * line the differ keeps, the arm is a regression guard and this file says so out loud. */
  {
    const reach = new Set();
    for (const sp of CS.moveCarriers(WRITE)) for (const a of Object.values(DEX.species.get(sp).abilities)) reach.add(a);
    const withEntry = [...reach].filter(a => entryOf(a).length && entryOf(a)[0] !== 'NO ROW');
    console.log('  every ability an ' + WRITE + ' can hand over that carries an entry handler ('
      + withEntry.length + ' of ' + reach.size + '): ' + withEntry.join(', '));
  }
  if (bad) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}

const P1 = arm => arm === 'entrain'
  ? [mon(WRITER, AB_WRITER, [WRITE, IDLE_WRITER]), mon(IDLE_P1[0], '', [IDLE_P1[1]]),
     ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))]
  : [mon(SWAPPER, arm === 'swap-into-intimidate' || arm === 'no-swap' ? AB_DROP : AB_INERT_USER, [SWAP, IDLE_SELF, RAIN]),
     mon(IDLE_P1[0], '', [IDLE_P1[1]]), ...BENCH_P1.map(([s, m]) => mon(s, '', [m]))];
const P2 = () => [mon(T_INERT, AB_T_INERT, [IDLE_T_INERT]), mon(T_SKY, AB_SKY, [IDLE_T_SKY]),
                  ...BENCH_P2.map(([s, m]) => mon(s, '', [m]))];

/* p1a clicks: the swap at p2b on the weather arm, at p2a otherwise. */
const click = arm => arm === 'no-swap' ? { m: IDLE_SELF }
                   : arm === 'entrain' ? { m: WRITE, t: 0 }
                   : { m: SWAP, t: arm === 'swap-into-weather' ? 1 : 0 };
const ACT_TURN = arm => ({ p1: [click(arm), { m: IDLE_P1[1] }],
                           p2: [{ m: IDLE_T_INERT }, { m: IDLE_T_SKY }] });
/* THE WEATHER ARM SPENDS A TURN PUTTING RAIN UP FIRST. See the arm table: Tyranitar's own entry has
 * already set the sandstorm, so a Sand Stream arriving by swap re-sets a sky that is already there
 * and the authority writes NOTHING. The rain is what makes the re-set observable, and without it
 * this arm agreed on nothing at all. */
const RAIN_TURN = { p1: [{ m: RAIN }, { m: IDLE_P1[1] }],
                    p2: [{ m: IDLE_T_INERT }, { m: IDLE_T_SKY }] };
const TURNS_OF = arm => (arm === 'swap-into-weather' ? 2 : 1);
const script = arm => (arm === 'swap-into-weather' ? [RAIN_TURN, ACT_TURN(arm)] : [ACT_TURN(arm)]);

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
/* `-ability` IS DROPPED WHOLE, which is `game_differential.js`'s own `ability-announcement` rule
 * (:2139). It is also why the `entrain` arm cannot demonstrate anything positive here. */
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
/* THE ARM'S ACTING TURN, not always turn 1 — the weather arm spends its first turn on the rain. */
let ACT_TURN_N = 1;
const stream = lines => turnSlice(lines, ACT_TURN_N).map(norm);
const pick = (lines, re) => stream(lines).filter(l => re.test(l));

/* THE BOARD ITSELF, off both engines rather than inferred from the lines. */
const sdAtk = b => (b && b.p1 && b.p1.active || []).map(p => p ? p.boosts.atk : null).join(',');
const meAtk = S => ((S && S.actA) || []).map(m => m && m.boosts ? m.boosts.at : null).join(',');
/* THE TWO ENGINES SPELL THE SKY DIFFERENTLY — showdown `sandstorm`, medicham2 `sand` — and that is a
 * naming convention, not a divergence: `board_state.js` maps them and calls those boards identical.
 * A raw string comparison here would report a defect the measurement this file defends cannot see,
 * which is the mistake four separate probes made in batch C. Normalised to a common short form. */
const WX = w => String(w || '').toLowerCase().replace(/storm$|scape$|dance$|day$/, '')
                 .replace(/^sunny$/, 'sun');
const sdWx = b => WX(b && b.field && b.field.weather);
const meWx = S => WX(S && S.field && S.field.weather);

function run(arm) {
  const a = G.buildPair(P1(arm), {}), b = G.buildPair(P2(), {});
  if (!a || !b) return { verdict: 'NOT-STAGED', why: 'buildPair returned null' };
  if (G.midResetAddresses) G.midResetAddresses();
  if (G.resetScriptCounters) G.resetScriptCounters();
  const seen = [];
  const r = G.playGame(a, b, 'ability-start-on-rewrite', arm, {
    script: script(arm), arm: ARM,
    onBoundary: (snap, turnIdx, S, battle) => {
      seen.push({ turn: turnIdx, identical: !!snap.identical,
                  sdAtk: sdAtk(battle), meAtk: meAtk(S), sdWx: sdWx(battle), meWx: meWx(S),
                  diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 8).map(d => JSON.stringify(d)) });
      snap.identical = true; snap.diffs = [];
    },
  });
  const sd = G.lastSdLog ? G.lastSdLog() : [];
  const me = (r && r.mediTrace) || [];
  return { verdict: r.err ? 'THREW' : 'RAN', why: r.err, turns: r.turns, seen,
           sc: G.scriptCounters ? G.scriptCounters() : null, sdAll: sd, meAll: me };
}

console.log('\nAN ABILITY THAT ARRIVES MID-BATTLE RUNS ITS OWN `Start` — battle.ts:1339-1340, pokemon.ts:1946-1949\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id) + '   arm ' + ARM_ID);
console.log('  knob MEDI_NO_ABILITY_START_ON_REWRITE=' + (process.env.MEDI_NO_ABILITY_START_ON_REWRITE || '0'));
if (!ARM) { console.log('NOT RUN — no arm named ' + ARM_ID); process.exit(2); }

const ARMS = ['swap-into-intimidate', 'swap-into-weather', 'entrain', 'swap-inert', 'no-swap'];
const UNDER = new Set(['swap-into-intimidate', 'swap-into-weather', 'entrain']);
const R = {};
for (const a of ARMS) { ACT_TURN_N = TURNS_OF(a); R[a] = run(a); R[a].actTurn = ACT_TURN_N; }
/* EVERY READER BELOW RE-POINTS THE SLICE AT THE ARM IT IS ABOUT TO READ. A single global turn index
 * with a two-turn arm in the set is exactly the silent-default shape: the weather arm would be read
 * on its RAIN turn and agree, on the wrong turn. */
const at = a => { ACT_TURN_N = R[a].actTurn; return R[a]; };

let fails = 0;
const ok = (cond, label, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${detail ? '\n          ' + detail : ''}`);
  if (!cond) fails++;
};

for (const a of ARMS) {
  const x = at(a);
  console.log('\n' + '='.repeat(98));
  console.log('  ' + a.toUpperCase() + (UNDER.has(a) ? '  (UNDER TEST)' : '  (KNOWN-GOOD CONTROL)'));
  console.log('='.repeat(98));
  if (x.verdict !== 'RAN') { console.log('  ' + x.verdict + (x.why ? ' — ' + x.why : '')); fails++; continue; }
  console.log('  showdown  ' + (stream(x.sdAll).join('  ') || '(none)'));
  console.log('  medicham  ' + (stream(x.meAll).join('  ') || '(none)'));
  console.log('  p1 boosts.atk  sd ' + JSON.stringify(x.seen.map(y => y.sdAtk)) + '   me ' + JSON.stringify(x.seen.map(y => y.meAtk)));
  console.log('  weather        sd ' + JSON.stringify(x.seen.map(y => y.sdWx)) + '   me ' + JSON.stringify(x.seen.map(y => y.meWx)));
  console.log('  boards: ' + x.seen.map(y => 't' + y.turn + (y.identical ? ' ok' : ' DIFF ' + y.diffs.join(' '))).join('   '));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICT — the FIXTURE first, then the BOARD, then the LINES');
console.log('='.repeat(98));

/* -- 1. THE FIXTURE ----------------------------------------------------------------------------- */
for (const a of ARMS) {
  const x = at(a);
  ok(x.verdict === 'RAN' && x.turns >= 1, 'the scripted turn was played — ' + a, 'turns ' + x.turns);
  ok(x.sc && x.sc.moveNotOnRequest === 0,
     "every scripted click was on the AUTHORITY's request — " + a, x.sc ? JSON.stringify(x.sc) : 'no counters');
}
/* THE REWRITE MUST HAVE HAPPENED, off the AUTHORITY's own line rather than off this file's model. */
for (const a of ['swap-into-intimidate', 'swap-into-weather', 'swap-inert']) {
  const x = at(a);
  ok(pick(x.sdAll, /^\|-activate\|p1a\|skillswap\|/).length === 1,
     'the AUTHORITY says the swap happened — ' + a, stream(x.sdAll).join('  '));
}
{
  const x = at('no-swap');
  ok(pick(x.sdAll, /skillswap/).length === 0,
     'and the no-swap control never swapped anything', stream(x.sdAll).join('  '));
}

/* -- 2. THE KNOB-CLEARED CONTROL — an unwired Start gives IDENTICAL output. --------------------- */
{
  const u = R['swap-into-intimidate'].seen.map(y => y.sdAtk).join('|');
  const c = R['swap-inert'].seen.map(y => y.sdAtk).join('|');
  ok(u !== c, 'the AUTHORITY moves when the ABILITY moves — same body, same click, same target, and '
     + 'ONLY the swapper\'s ability changed. Identical here would mean the fixture never exercises it',
     'intimidate ' + u + '   inert ' + c);
  /* THE WEATHER ARM'S OWN CONTROL IS ITS FIRST TURN: rain is up at the boundary before the swap and
   * sand at the boundary after it. Two DIFFERENT skies from one board, so the arm cannot be passing
   * on a sandstorm that was already there — which is exactly what the first draft did. */
  const wx = R['swap-into-weather'].seen.map(y => y.sdWx);
  ok(wx.length >= 2 && wx[wx.length - 2] !== wx[wx.length - 1],
     'the AUTHORITY CHANGES the sky at the swap — the boundary before it and the boundary after it '
     + 'hold different weathers, which is the clause that stops this arm agreeing on nothing',
     'weather by boundary ' + JSON.stringify(wx));
}

/* -- 3. THE BOARD, engine against authority. ---------------------------------------------------- */
for (const a of ARMS) {
  const x = R[a];
  const s = x.seen.map(y => y.sdAtk).join('|'), m = x.seen.map(y => y.meAtk).join('|');
  ok(s === m, "p1's boosts.atk agrees with the authority — " + a, 'authority ' + s + '   ours ' + m);
  const sw = x.seen.map(y => y.sdWx).join('|'), mw = x.seen.map(y => y.meWx).join('|');
  ok(sw === mw, 'the weather agrees with the authority — ' + a, 'authority ' + sw + '   ours ' + mw);
}

/* -- 4. THE BOARD COMPARATOR'S OWN VERDICT at every boundary. ----------------------------------- */
for (const a of ARMS) {
  const bad = (R[a].seen || []).filter(y => !y.identical);
  ok(bad.length === 0, 'BOARD identical at every boundary — ' + a,
     bad.map(y => 't' + y.turn + ' ' + y.diffs.join(' ')).join(' ; '));
}

/* -- 5. THE LINES, and the controls that stop the fix over-firing. ------------------------------ */
for (const a of ARMS) {
  const x = at(a);
  const p = pick(x.sdAll, /^\|-(un)?boost\|/), q = pick(x.meAll, /^\|-(un)?boost\|/);
  ok(JSON.stringify(p) === JSON.stringify(q), 'the boost/unboost lines match — ' + a,
     'authority ' + JSON.stringify(p) + '\n          ours      ' + JSON.stringify(q));
  const w = pick(x.sdAll, /^\|-weather\|/), v = pick(x.meAll, /^\|-weather\|/);
  ok(JSON.stringify(w) === JSON.stringify(v), 'the weather lines match — ' + a,
     'authority ' + JSON.stringify(w) + '\n          ours      ' + JSON.stringify(v));
}
/* SCOPED TO WHAT AN ENTRY HANDLER WOULD WRITE, not to every boost line on the board: the two idle
 * foes click Bulk Up and Iron Defense in every arm and the sandstorm ticks in every arm, so an
 * unscoped filter fails both controls on lines that have nothing to do with the mechanic. What an
 * arriving Intimidate or weather setter writes is an `-unboost` on p1's own bodies and a `-weather`
 * carrying a `[from]`; the residual `[upkeep]` tick carries no attribution. */
{
  const CONSEQ = /^\|-unboost\|p1|^\|-weather\|[a-z]+\|\[from\]/;
  const si = pick(at('swap-inert').meAll, CONSEQ);
  const ns = pick(at('no-swap').meAll, CONSEQ);
  const sj = pick(at('swap-inert').sdAll, CONSEQ);
  const nj = pick(at('no-swap').sdAll, CONSEQ);
  ok(si.length === 0 && ns.length === 0 && sj.length === 0 && nj.length === 0,
     'NEITHER control gains an entry-handler line, on EITHER side — this is the clause a blanket '
     + '"re-run the entry pass on any rewrite" breaks',
     'ours: swap-inert ' + JSON.stringify(si) + ' no-swap ' + JSON.stringify(ns)
     + '   authority: swap-inert ' + JSON.stringify(sj) + ' no-swap ' + JSON.stringify(nj));
}

/* -- 6. THE WHOLE TURN, line for line. ---------------------------------------------------------- */
for (const a of ARMS) {
  const x = at(a);
  const sd = stream(x.sdAll), me = stream(x.meAll);
  ok(sd.join('  ') === me.join('  '), a.toUpperCase() + ' narration identical, line for line',
     'authority [' + sd.join('  ') + ']\n          ours      [' + me.join('  ') + ']');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL CLAUSES HELD'));
process.exit(fails ? 1 : 0);
