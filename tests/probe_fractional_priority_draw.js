/* probe_fractional_priority_draw.js — DOES THIS ENGINE ROLL QUICK CLAW WHEN THE AUTHORITY NEVER RUNS
 * THE EVENT AT ALL?
 *
 *   SHOWDOWN_PATH=... node tests/probe_fractional_priority_draw.js
 *   MEDI_FRACPRI_UNGATED_DRAW=1 ...            the red arm, run for you by default
 *
 * ================= WHY THIS EXISTS, AND WHAT FOUND IT ============================================
 *
 * It was found while chasing a Trace divergence. `tests/probe_trace_list.js` proved the two engines
 * build the SAME `possibleTargets` — 139 of 139 draws, members and order — so a Trace that copies the
 * wrong foe is an ADDRESS problem. Instrumenting one whole-game divergence (`omit-spread`, the two
 * mirrored Gardevoirs reading `regenerator` against the authority's `levitate`) showed medicham2
 * taking THREE `any` draws on turn 2 where the authority took two, and the extra one came from here:
 *
 *     20260813|2|any|-|-|0   <- battleTurn, the fractionalPriority loop, on a SWITCH action
 *     20260813|2|any|-|-|1   <- traceCopy
 *     20260813|2|any|-|-|2   <- traceCopy
 *
 * Both Trace draws were therefore one `nth` late, the first one read 0.047 instead of 0.508, and it
 * indexed the other foe. The second Gardevoir then copied the first's wrong answer, which is why both
 * bodies read the same wrong ability and why it looked like a Trace bug on both sides at once.
 *
 * ================= WHAT THE AUTHORITY ACTUALLY DOES, READ IN FULL ================================
 *
 * `sim/battle-queue.ts:249`, inside `resolveAction`, in the branch for a MOVE action and nowhere else:
 *
 *     action.fractionalPriority = this.battle.runEvent('FractionalPriority', action.pokemon, null,
 *                                                      action.move, 0);
 *     } else if (['switch', 'instaswitch'].includes(action.choice)) { ... }
 *
 * — so on a SWITCH the event is never run and no handler is reached. And `data/items.ts`, `quickclaw`
 * (Champions carries no override; `data/mods/champions/items.ts` was grepped):
 *
 *     onFractionalPriority(priority, pokemon, target, move) {
 *       if (move.category === 'Status' && pokemon.hasAbility('myceliummight')) return;
 *       if (priority <= 0 && this.randomChance(1, 5)) { ... return 0.1; }
 *     }
 *
 * `&&` short-circuits, so a move with priority ABOVE 0 does not reach `randomChance` either. Two
 * conditions, both of which this engine already computed as `_fpOk` — and it computed them AFTER
 * taking the die, which was declared in the source ("changing WHEN a die is drawn shifts the RNG
 * stream of every seeded run in the repo that has a claw holder in it, and that is a separate change
 * with a separate probe") and left standing. This is that probe.
 *
 * NOT COVERED, AND SAID RATHER THAN ASSUMED: the `myceliummight` early return. It is a THIRD condition
 * on the same die and this file does not stage it; `MEDFAILS.fracPriMyceliumDrawUnmodelled` counts
 * every action that reaches it, so the population is visible instead of being a silent default.
 *
 * ================= WHAT IS MEASURED ============================================================
 *
 * Not the order the claw produces — the DRAW. `engine/game_differential.js` exports `midAddresses()`,
 * which is both engines' own address logs for the middle arm, so the two `seed|turn|any|-|-|nth`
 * multisets can be compared directly rather than inferred from an outcome. Three scripted arms on one
 * board, all three derived from the format:
 *
 *   SWITCH        the claw holder switches. The authority runs no event -> it must take no `any` draw
 *                 here, and neither may this engine.
 *   HIGH PRIORITY the claw holder clicks a move with priority > 0. The handler runs and returns before
 *                 `randomChance` -> again no draw on either side.
 *   NORMAL        the claw holder clicks a priority-0 damaging move. BOTH engines must draw exactly
 *                 one. THIS IS THE OVER-FIRE CONTROL and it is the clause a too-wide gate fails.
 *
 * A control that cannot fail proves nothing, so the NORMAL arm is not decoration: gating the draw on
 * anything stricter than the authority's two conditions turns it red.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const NL = String.fromCharCode(10);
const KNOB_ON = process.env.MEDI_FRACPRI_UNGATED_DRAW === '1';

const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const M = G.REL.require('engine/medicham2-browser.js');
const { Dex } = CS.sim();
const DEX = Dex.forFormat(CS.FORMAT);
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* THE ENGINE'S OWN TAG LOOKUP, not a second reader of `data/tags.json`. medicham2 publishes it on the
 * global object rather than in `module.exports` (see its `root.ABRA_TAG_LOOKUP` export note), which is
 * why this reads it there — the alternative is a second copy of "which items carry this tag", and two
 * readers of one fact is the drift CLAUDE.md forbids. */
const TAGS = globalThis.ABRA_TAG_LOOKUP;
if (!TAGS || typeof TAGS.withTag !== 'function') {
  console.log('NOT RUN — the engine published no tag lookup, so nothing below is derived.');
  process.exit(2);
}

/* ---- EVERYTHING BELOW IS DERIVED FROM THE FORMAT AND THE TAG ARTIFACT, AND PRINTED -------------- */
const CLAWS = TAGS.withTag('item', 'fractionalPriority')
  .map(i => DEX.items.get(i)).filter(legal);
if (!CLAWS.length) { console.log('NOT-STAGED — no legal item carries a `fractionalPriority` tag.'); process.exit(1); }
const CLAW = CLAWS[0];
const MOVES = DEX.moves.all().filter(legal).sort((a, b) => a.id.localeCompare(b.id));
/* ACCURACY IS NOT PART OF THE QUESTION and must not be part of the filter either — `accuracy === true`
 * (never misses) admits five moves in this format and none of them is a priority attack, which is how
 * this file first reported NOT-STAGED. A printed 100 draws in the `acc` category, not `any`, so it
 * cannot pollute the count this probe reads; what it must not do is MISS, which at 100 under the
 * middle arm it cannot (`randomChance(100,100)` is `u < 1`). */
const acc100 = m => m.accuracy === true || m.accuracy >= 100;
const ATK = MOVES.find(m => m.priority === 0 && m.basePower > 0 && m.target === 'normal' && acc100(m));
const HIPRI = MOVES.find(m => m.priority > 0 && m.basePower > 0 && m.target === 'normal' && acc100(m));
if (!ATK || !HIPRI) { console.log('NOT-STAGED — could not derive a priority-0 and a priority->0 attack.'); process.exit(1); }
const SPECIES = DEX.species.all().filter(legal).filter(s => !/-Mega/.test(s.name))
  .sort((a, b) => a.name.localeCompare(b.name));

console.log('DERIVED (nothing below is typed):');
console.log('  fractionalPriority item   ' + CLAW.name + '   [' + CLAWS.length + ' legal carrier(s)]');
console.log('  priority-0 attack         ' + ATK.name + '   (priority ' + ATK.priority + ')');
console.log('  priority->0 attack        ' + HIPRI.name + '  (priority ' + HIPRI.priority + ')');

const mon = (species, item, moves) => ({ species, item: item || '', ability: '', moves });
/* buildPair keeps FOUR distinct bodies, so both sides are padded out of the format. Slot 2 is the
 * body the claw holder switches to and its species id is what the script names. */
function side(head) {
  const used = new Set(head.map(m => norm(m.species)));
  const out = head.slice();
  for (const s of SPECIES) {
    if (out.length >= 4) break;
    if (used.has(norm(s.name))) continue;
    used.add(norm(s.name)); out.push(mon(s.name, '', [ATK.name]));
  }
  return out;
}
const HOLDER = SPECIES[0], ALLY = SPECIES[1];
const A_SHEET = side([mon(HOLDER.name, CLAW.name, [ATK.name, HIPRI.name]), mon(ALLY.name, '', [ATK.name])]);
const BENCH = A_SHEET[2];
const B_SHEET = side([]);
const pa = G.buildPair(A_SHEET), pb = G.buildPair(B_SHEET);
if (!pa || !pb) { console.log('NOT-STAGED — the fixture would not build.'); process.exit(1); }
console.log('  claw holder               ' + HOLDER.name + ' @ ' + CLAW.name
  + '   switches to ' + BENCH.species);

const ARM = G.ARM_BY_ID.get('middle');
const anyOf = list => list.filter(c => c.split('|')[2] === 'any');

/* ---- THE THREE ARMS ---------------------------------------------------------------------------- */
const ARMS = [
  { id: 'SWITCH', expect: 0, p1a: { sw: norm(BENCH.species) },
    why: 'the authority runs no FractionalPriority event on a switch action at all' },
  { id: 'HIGHPRI', expect: 1, p1a: { m: HIPRI.name },
    why: 'a MOVE, so the event runs — the handler\'s `priority` is the RELAY VAR, not the move\'s' },
  { id: 'NORMAL', expect: 1, p1a: { m: ATK.name },
    why: 'THE OVER-FIRE CONTROL — both engines must draw here' },
  { id: 'NOCLAW', expect: 0, p1a: { m: ATK.name }, noClaw: true,
    why: 'THE ATTRIBUTION CONTROL — the same board with the item stripped must draw NOTHING' },
];

let bad = 0;
const rows = [];
for (const A of ARMS) {
  const script = [{ p1: [A.p1a, { m: ATK.name }], p2: [{ m: ATK.name }, { m: ATK.name }] }];
  G.midResetAddresses();
  const before = { die: M.MEDSEEN.fracPriItemDie || 0 };
  let r;
  const sheet = A.noClaw ? A_SHEET.map((m, i) => (i === 0 ? { ...m, item: '' } : m)) : A_SHEET;
  try { r = G.playGame(G.buildPair(sheet), G.buildPair(B_SHEET), 'directed', 'fracpri/' + A.id, { script, arm: ARM }); }
  catch (e) { console.log('  ' + A.id + ' THREW: ' + String((e && e.message) || e).split(NL)[0]); bad++; continue; }
  const ad = G.midAddresses();
  /* TURN 1 ONLY — the address carries the turn, so the scripted turn is separable from the lead-in
   * (`|0|`), which is where entry abilities draw and which this file says nothing about. */
  const sd = anyOf(ad.sd).filter(c => c.split('|')[1] === '1');
  const me = anyOf(ad.me).filter(c => c.split('|')[1] === '1');
  rows.push({ arm: A, sd, me, turns: r.turns, err: r.err || null,
              die: (M.MEDSEEN.fracPriItemDie || 0) - before.die });
}

console.log(NL + 'TURN-1 `any` DRAWS, BOTH ENGINES\' OWN ADDRESS LOGS'
  + '   (knob MEDI_FRACPRI_UNGATED_DRAW=' + (KNOB_ON ? '1' : 'unset') + ')');
for (const x of rows) {
  console.log('  ' + x.arm.id.padEnd(8) + ' authority ' + x.sd.length + '   medicham ' + x.me.length
    + '   [this engine took ' + x.die + ' claw die]   ' + x.arm.why);
  if (x.sd.length || x.me.length) {
    console.log('      showdown [' + x.sd.join(' ') + ']');
    console.log('      medicham [' + x.me.join(' ') + ']');
  }
  if (x.err) console.log('      game error: ' + x.err);
}

/* CLAUSE 1 — the two logs must MATCH on every arm. This is the whole claim. */
for (const x of rows) {
  if (x.sd.join(',') !== x.me.join(',')) {
    console.log('  FAIL — ' + x.arm.id + ': the two engines took different turn-1 `any` draws ('
      + x.sd.length + ' vs ' + x.me.length + '). ' + x.arm.why);
    bad++;
  }
}
/* CLAUSE 2 — and the count must be the one derived from the authority's source, so an arm that
 * agreed by both engines drawing NOTHING (a dead fixture) cannot pass as agreement. */
for (const x of rows) {
  if (x.sd.length !== x.arm.expect) {
    console.log('  FAIL — ' + x.arm.id + ': the AUTHORITY took ' + x.sd.length + ' turn-1 `any` draw(s)'
      + ' and the source says ' + x.arm.expect + '. The fixture did not stage what it claims.');
    bad++;
  }
}
/* CLAUSE 3 — the engine's own receipt. A run where the claw die was never taken at all tested
 * nothing, whichever way the logs came out. */
const totalDie = rows.reduce((a, x) => a + x.die, 0);
console.log(NL + 'THE ENGINE\'S OWN RECEIPT — claw dice taken across the three arms: ' + totalDie);
if (totalDie === 0) {
  console.log('  FAIL — this engine never rolled the claw on any arm, so the NORMAL control is empty'
    + ' and the two zero-arms prove nothing.');
  bad++;
}

console.log('KNOB-VERDICT knob=' + (KNOB_ON ? 1 : 0)
  + ' ' + rows.map(x => x.arm.id + '=' + x.sd.length + '/' + x.me.length).join(' ')
  + ' die=' + totalDie);

/* ---- THE RED ARM, IN A CHILD (the knob is read at module load) ---------------------------------
 * NOT judged on its exit code: under the knob the child asserts the DEFECT IS PRESENT, so a working
 * knob makes it exit 1. The parent reads its numbers, and each of them can fail — a knob that reached
 * no code leaves SWITCH at 0/0. */
if (!KNOB_ON) {
  const { spawnSync } = require('child_process');
  console.log(NL + '--- THE RED ARM (MEDI_FRACPRI_UNGATED_DRAW=1, a child process) ---');
  /* THE CHILD INHERITS THE PARENT NODE FLAGS — 2026-08-28. Without this, a parent started with
   * `-r ./tests/_live_release.js` was redirected and its child was NOT: the child re-required
   * engine/game_differential.js with no --release, which CUTS A REAL RELEASE at require time and
   * REPOINTS data/engine-release.json under whatever else is measuring. Measured, not argued: a
   * redirected cut was shown NOT to touch data/engine-release.json, so every real cut seen during
   * a preloaded run came from here. process.execArgv is node OWN record of how this process was
   * started, so this reads the fact rather than re-deriving it. tests/probe_hazard_recap_fail.js
   * already did this by hand; this is the same fix at the four sites that did not. */
  const cp = spawnSync(process.execPath, [...process.execArgv, __filename], { env: { ...process.env, MEDI_FRACPRI_UNGATED_DRAW: '1' }, encoding: 'utf8' });
  const out = String(cp.stdout || '') + String(cp.stderr || '');
  const v = out.split(NL).find(l => l.startsWith('KNOB-VERDICT'));
  if (!v) { console.log('  FAIL — the red arm printed no verdict (exit ' + cp.status + '). It did not run.'); bad++; }
  else {
    console.log('  | ' + v);
    const V = {}; for (const kv of v.split(' ').slice(1)) { const [k, x] = kv.split('='); V[k] = x; }
    const parts = k => { const [s, m] = String(V[k] || '').split('/'); return s !== m; };
    if (!parts('SWITCH')) {
      console.log('  FAIL — the red arm restored the ungated draw and the SWITCH arm still agreed ('
        + V.SWITCH + '). The knob reached no code, or the gate is not what moves the draw.');
      bad++;
    }
    for (const k of ['NORMAL', 'HIGHPRI', 'NOCLAW']) {
      if (parts(k)) {
        console.log('  FAIL — the red arm moved the ' + k + ' control too (' + V[k] + '). The knob is'
          + ' over-firing: it must restore the draw only where the authority takes none.');
        bad++;
      }
    }
    if (!bad) console.log('  the red arm reproduced the defect: SWITCH ' + V.SWITCH
      + '; controls NORMAL ' + V.NORMAL + ', HIGHPRI ' + V.HIGHPRI + ', NOCLAW ' + V.NOCLAW + ' unmoved.');
  }
}

console.log(NL + (bad ? bad + ' FAILING CLAUSE(S)' : 'all clauses green'));
process.exit(bad ? 1 : 0);
