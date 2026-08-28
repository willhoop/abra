/* probe_trace_target.js — WHICH FOE DOES TRACE COPY WHEN A QUEUE TIE HAS ALREADY MOVED THE DIE?
 *
 *   SHOWDOWN_PATH=... node tests/probe_trace_target.js
 *   SHOWDOWN_PATH=... node tests/probe_trace_target.js --red      (the child arm, run for you by default)
 *
 * ================= WHY THIS IS NOT tests/probe_trace_choice.js ====================================
 *
 * That file already proves Trace's choice is a DIE and that this engine reads it: under the two
 * scalar corners the authority answers `roughskin` on one and `pressure` on the other and medicham2
 * follows. It is green, including on the `middle` arm — and it was green while the whole-game
 * differential carried a turn-0, board-material divergence on exactly this mechanic
 * (`data/game-differential.json`, `state.first_board_divergences`, config `pair-redirect-priority`:
 * `p1.party.gardevoir.ability   medicham torrent   showdown cursedbody`, `protocol_diverged_at_turn:
 * null`).
 *
 * IT WAS GREEN BECAUSE ITS FIXTURE NEVER STAGED THE COLLISION, and that is a fixture verdict rather
 * than evidence. The two engines only part when SOMETHING ELSE HAS ALREADY DRAWN at the same address
 * earlier in the same turn, and nothing in that file's four boards does.
 *
 * ================= WHAT THE AUTHORITY ACTUALLY DOES ==============================================
 *
 * `data/mods/champions/abilities.ts` is 100 lines and contains no `trace` entry, so Champions
 * inherits mainline — grepped case-insensitively over the whole file, not assumed. Mainline
 * `data/abilities.ts:5110`, read in full:
 *
 *     onUpdate(pokemon) {
 *       const possibleTargets = pokemon.adjacentFoes()
 *         .filter(t => !t.getAbility().flags['notrace'] && t.ability !== 'noability');
 *       if (!possibleTargets.length) return;
 *       const target = this.sample(possibleTargets);        <-- IT DRAWS.
 *
 * `Battle#sample` (`sim/battle.ts:355`) is `this.prng.sample(items)`, and `PRNG#sample`
 * (`sim/prng.ts:132`) is `items[this.random(items.length)]`, and `PRNG#random` (`:91`) calls
 * `this.rng.next()` UNCONDITIONALLY — so the draw is taken even when there is one candidate. The pick
 * is a uniform index into the ELIGIBLE list, not into the slots.
 *
 * ================= SO IT IS AN ADDRESS PROBLEM, AND THIS FILE MEASURES THE ADDRESS ================
 *
 * The middle arm keys both engines' dice on `seed|turn|category|move|target|nth`. At the lead-in the
 * turn is 0 and there is no active move, so every non-move draw of the whole lead-in lands in ONE
 * bucket, `20260813|0|any|-|-`, separated only by `nth`. `game_differential.js`'s own header calls
 * that "the sharpest remaining risk in this design".
 *
 * `BattleQueue#insertChoice` (`sim/battle-queue.ts:395`) resolves a tie in queue position with
 * `this.battle.random(firstIndex, lastIndex + 1)` — the RANGE form, which the three scalar arms pin
 * to `m` and which the middle arm was letting draw. When the four lead-in `runSwitch` actions contain
 * a tie, that draw takes `nth = 0` and Trace's takes `nth = 1`; medicham2 models no such queue and
 * takes `nth = 0` for Trace. **Two engines, one event, two addresses.**
 *
 * ================= THE KNOB, AND WHY IT IS THE ALLY ==============================================
 *
 * Nothing here types which boards tie. The probe sweeps the p1b ALLY over species derived from the
 * format, plays each board, and reads the authority's range-form draw count off
 * `G.midRangeCounters()` — the fix's own receipt. A board whose count moved is a TIE board; one whose
 * count did not is a NO-TIE board. Both must exist or the file reports NOT-STAGED and fails, because
 * an arm with no control proves nothing.
 *
 * The verdict is then read out of BOTH streams with no typed expectation:
 *
 *   TIE boards      the authority's Trace target MUST differ from the no-tie boards' (that is the
 *                   authority's own die moving — if it does not move, this file never reached it),
 *                   and under `MEDI_MID_RANGE_DRAWS=1` medicham2 MUST part from it.
 *   NO-TIE boards   the over-fire control. They must agree under BOTH arms; a "fix" that moved them
 *                   would be changing an address that was already shared.
 *
 * ================= WHAT IT STRUCTURALLY CANNOT SEE ==============================================
 *
 * Whether either engine plays the game right — it compares one ability name per board. Whether the
 * value the shared address yields is the value the REAL game would yield: the middle arm's die is a
 * hash and there is no ground truth for which foe, only the claim that both engines read the same
 * one. And every OTHER range-form caller: `Battle.durationCallback` and a condition's `onStart` were
 * both measured drawing here too (1 each in 60 games) and are neutralised by the same change without
 * a staged board of their own — named, not covered.
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
const RED_CHILD = process.argv.includes('--red');
const KNOB_ON = process.env.MEDI_MID_RANGE_DRAWS === '1';

const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';

/* ---- EVERY NAME BELOW IS DERIVED FROM THE FORMAT, IN A FIXED ORDER, AND PRINTED --------------- */
const SPECIES = DEX.species.all().filter(legal).sort((a, b) => a.name.localeCompare(b.name));
const abilityOf = s => Object.values(s.abilities || {});
const isTraceable = abId => {
  const a = DEX.abilities.get(abId);
  return !!(a && a.exists && !(a.flags && a.flags['notrace']));
};
/* the carrier: a legal, non-mega species whose ability list contains Trace */
const TRACER = SPECIES.find(s => !/-Mega/.test(s.name) && abilityOf(s).some(a => norm(a) === 'trace'));
if (!TRACER) { console.log('NOT-STAGED — no legal non-mega Trace carrier in the format.'); process.exit(1); }

const G = require(D('engine', 'game_differential.js'));
const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
const P2 = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] };
const ARM = G.ARM_BY_ID.get('middle');

/* `buildPair` refuses anything that is not FOUR DISTINCT bodies — measured, not assumed: a 3-mon
 * team and a team repeating a species both return null. So every side here is padded out of the
 * format with species that are not already on the board, and the padding is derived like the rest. */
function padTeam(actives) {
  const used = new Set(actives.map(m => norm(m.species)));
  const out = actives.slice();
  for (const s of SPECIES) {
    if (out.length >= 4) break;
    if (/-Mega/.test(s.name) || used.has(norm(s.name))) continue;
    used.add(norm(s.name)); out.push(mon(s.name, '', ['Protect']));
  }
  return out;
}
const buildSide = actives => G.buildPair(padTeam(actives));

/* the two FOES: legal carriers of two DIFFERENT traceable abilities, so the copied name identifies
 * WHICH BODY was chosen and not merely that something was copied. Both must build together. */
const FOE_CANDS = [];
for (const s of SPECIES) {
  if (/-Mega/.test(s.name)) continue;
  const ab = abilityOf(s).find(a => isTraceable(norm(a)));
  if (!ab) continue;
  FOE_CANDS.push({ sp: s.name, ab, id: norm(ab) });
}
let FOE_A = null, FOE_B = null;
outer:
for (let i = 0; i < FOE_CANDS.length && i < 120; i++) {
  for (let j = i + 1; j < FOE_CANDS.length && j < 120; j++) {
    if (FOE_CANDS[i].id === FOE_CANDS[j].id) continue;
    const a = FOE_CANDS[i], b = FOE_CANDS[j];
    if (!buildSide([mon(a.sp, a.ab, ['Protect']), mon(b.sp, b.ab, ['Protect'])])) continue;
    FOE_A = a; FOE_B = b; break outer;
  }
}
if (!FOE_A || !FOE_B) { console.log('NOT-STAGED — could not derive two distinct traceable foes.'); process.exit(1); }

console.log('DERIVED FROM THE FORMAT (nothing below is typed):');
console.log('  Trace carrier      ' + TRACER.name + '   abilities ' + JSON.stringify(TRACER.abilities));
console.log('  foe slot 0         ' + FOE_A.sp + ' / ' + FOE_A.ab + '   (traceable: no `notrace` flag)');
console.log('  foe slot 1         ' + FOE_B.sp + ' / ' + FOE_B.ab + '   (traceable: no `notrace` flag)');
console.log('  ELIGIBLE FOES = 2. A cell with fewer than two is REFUSED — with one candidate there is'
  + ' no choice to get wrong and a green result would prove nothing.');

/* ---- READING THE ANSWER OUT OF BOTH STREAMS, FOLDED TO AN ID ---------------------------------- */
const sdTraceOf = lines => lines.map(String)
  .filter(l => l.startsWith('|-ability|') && /\[from\] ability: Trace/i.test(l))
  .map(l => norm(l.split('|')[3]));
const meTraceOf = lines => lines.map(x => Array.isArray(x) ? '|' + x.join('|') : String(x))
  .filter(l => /ability:\s*trace/i.test(l))
  .map(l => norm(l.split('|').filter(Boolean)[2]));

const B_ACTIVES = [mon(FOE_A.sp, FOE_A.ab, ['Protect']), mon(FOE_B.sp, FOE_B.ab, ['Protect'])];

/* ---- THE SWEEP. The ALLY is the knob that decides whether the queue ties, and WHICH allies tie is
 * MEASURED off the authority's own range-draw counter, never guessed. ---------------------------- */
const rows = [];
let staged = 0, unbuildable = 0;
const threw = [], notPlayed = [], noCopy = [];
for (const s of SPECIES) {
  if (rows.length >= 24 || staged >= 24) break;
  if (/-Mega/.test(s.name)) continue;
  if (norm(s.name) === norm(TRACER.name)) continue;
  const pa = buildSide([mon(TRACER.name, 'Trace', ['Protect']), mon(s.name, '', ['Protect'])]);
  const pb = buildSide(B_ACTIVES);
  if (!pa || !pb) { unbuildable++; continue; }
  const before = G.midRangeCounters();
  let r;
  /* A BOARD THAT THREW IS COUNTED AND NAMED, never skipped quietly — a sweep that silently loses
   * half its cells reports the same "all clauses green" as one that ran them. */
  try { r = G.playGame(pa, pb, 'directed', 'probe_trace_target/' + norm(s.name), { script: [P2], arm: ARM }); }
  catch (e) { threw.push(s.name + ': ' + String((e && e.message) || e).split(NL)[0]); continue; }
  if (r.err || r.turns < 1) { notPlayed.push(s.name + ': ' + (r.err || ('turns ' + r.turns))); continue; }
  const after = G.midRangeCounters();
  const rangeDraws = (after.pinned - before.pinned) + (after.live - before.live);
  const sd = sdTraceOf(G.sdStream(G.lastSdLog()));
  const me = meTraceOf(r.mediTrace || []);
  /* no copy happened on one side or the other — nothing to compare, but SAY SO */
  if (!sd.length || !me.length) { noCopy.push(s.name + ' [sd ' + sd.length + ' / me ' + me.length + ']'); continue; }
  staged++;
  rows.push({ ally: s.name, tie: rangeDraws > 0, rangeDraws, sd: sd.join(','), me: me.join(',') });
}

const M = G.REL.require('engine/medicham2-browser.js');
console.log(NL + 'ELIGIBILITY, OUT OF THE ENGINE THAT DID THE COPYING: traceCopied='
  + M.MEDSEEN.traceCopied + '  traceAmbiguousChoice=' + M.MEDSEEN.traceAmbiguousChoice
  + '  traceChoiceDie=' + M.MEDSEEN.traceChoiceDie + '  traceChoiceNoDie=' + M.MEDSEEN.traceChoiceNoDie);
if (M.MEDSEEN.traceAmbiguousChoice < staged) {
  console.log('  REFUSED — at least one board offered fewer than two eligible foes, so it tests'
    + ' nothing about the choice. ' + M.MEDSEEN.traceAmbiguousChoice + ' of ' + staged + ' ambiguous.');
  process.exit(1);
}
if (M.MEDSEEN.traceChoiceNoDie > 0) {
  console.log('  REFUSED — ' + M.MEDSEEN.traceChoiceNoDie + ' board(s) had NO die in scope, so this'
    + ' engine took a fixed index and the comparison is not about the address.');
  process.exit(1);
}

const TIE = rows.filter(r => r.tie), NOTIE = rows.filter(r => !r.tie);
console.log(NL + 'THE SWEEP — ' + staged + ' staged boards, ' + unbuildable + ' unbuildable'
  + '   (knob MEDI_MID_RANGE_DRAWS=' + (KNOB_ON ? '1' : 'unset') + ')');
/* EVERY CELL THAT LEFT THE SWEEP IS NAMED. A board dropped in silence looks exactly like one that
 * agreed, and the whole file would still print "all clauses green". */
if (threw.length) console.log('  THREW (' + threw.length + '): ' + threw.join(' | '));
if (notPlayed.length) console.log('  NOT PLAYED (' + notPlayed.length + '): ' + notPlayed.join(' | '));
if (noCopy.length) console.log('  NO TRACE COPY, nothing to compare (' + noCopy.length + '): ' + noCopy.join(' | '));
for (const r of rows) {
  const agree = r.sd === r.me;
  console.log('  ' + (r.tie ? 'TIE   ' : 'NO-TIE') + '  ' + r.ally.padEnd(20)
    + 'authority range-draws=' + r.rangeDraws + '   showdown [' + r.sd + ']   medicham [' + r.me + ']   '
    + (agree ? 'AGREE' : 'DIFFERS'));
}

let bad = 0;
if (!TIE.length || !NOTIE.length) {
  console.log(NL + 'NOT-STAGED — the sweep produced ' + TIE.length + ' TIE and ' + NOTIE.length
    + ' NO-TIE boards. Both are required: the NO-TIE boards are the over-fire control and without'
    + ' them a green TIE result cannot be distinguished from an instrument that changed nothing.');
  process.exit(1);
}

/* CLAUSE 1 — the counters. A run that met a tie must have neutralised a range draw on the clean arm
 * and must have DRAWN one on the knob arm. A counter that is present on both is not a knob. */
const RC = G.midRangeCounters();
console.log(NL + 'RANGE-FORM RECEIPT   pinned=' + RC.pinned + '  live=' + RC.live + '  knob=' + RC.knob);
if (KNOB_ON) {
  if (RC.live === 0) { console.log('  FAIL — the knob is set and NO range draw was taken. It reached no code.'); bad++; }
  if (RC.pinned !== 0) { console.log('  FAIL — the knob is set and a range draw was still pinned.'); bad++; }
} else {
  if (RC.pinned === 0) { console.log('  FAIL — no range draw was neutralised on a run that met ' + TIE.length + ' tie board(s).'); bad++; }
  if (RC.live !== 0) { console.log('  FAIL — a live range draw was taken with the knob unset.'); bad++; }
}

/* CLAUSE 2 — the AUTHORITY's own answer must move between TIE and NO-TIE boards when the range draw
 * is live. That is what proves this file reached the die at all. On the clean arm it must NOT move,
 * because the whole point of the fix is that the queue tie stops touching Trace's address. */
const sdTie = [...new Set(TIE.map(r => r.sd))].join('/');
const sdNo = [...new Set(NOTIE.map(r => r.sd))].join('/');
console.log('AUTHORITY   TIE boards -> [' + sdTie + ']    NO-TIE boards -> [' + sdNo + ']');
if (KNOB_ON) {
  if (sdTie === sdNo) {
    console.log('  FAIL — with the range draw LIVE the authority answered the same on tie and no-tie'
      + ' boards, so this fixture never reached the die and says nothing about medicham.');
    bad++;
  }
} else {
  if (sdTie !== sdNo) {
    console.log('  FAIL — with the range draw PINNED the authority still answers differently on tie'
      + ' boards, so the queue tie is still moving Trace\'s address.');
    bad++;
  }
}

/* CLAUSE 3 — the boards themselves. Clean: everything agrees. Knob: TIE boards part, NO-TIE boards
 * do not (the over-fire control). */
const tieDiff = TIE.filter(r => r.sd !== r.me).length;
const noDiff = NOTIE.filter(r => r.sd !== r.me).length;
console.log('BOARDS      TIE ' + (TIE.length - tieDiff) + '/' + TIE.length + ' agree;   NO-TIE '
  + (NOTIE.length - noDiff) + '/' + NOTIE.length + ' agree');
if (KNOB_ON) {
  if (tieDiff !== TIE.length) { console.log('  FAIL — the knob is set and ' + (TIE.length - tieDiff)
    + ' tie board(s) still AGREE. The red arm must go red on every one of them.'); bad++; }
  if (noDiff !== 0) { console.log('  FAIL — ' + noDiff + ' NO-TIE control board(s) parted under the'
    + ' knob. The knob is over-firing.'); bad++; }
} else {
  if (tieDiff !== 0) { console.log('  FAIL — ' + tieDiff + ' tie board(s) still part with the fix in.'); bad++; }
  if (noDiff !== 0) { console.log('  FAIL — ' + noDiff + ' NO-TIE control board(s) part with the fix in.'); bad++; }
}

/* THE MACHINE-READABLE VERDICT, so the parent judges the child on NUMBERS rather than on an exit
 * code that means "my own clauses held". Both arms print it; only the child's is read. */
console.log('KNOB-VERDICT knob=' + (KNOB_ON ? 1 : 0) + ' tie=' + TIE.length + ' tieDiff=' + tieDiff
  + ' notie=' + NOTIE.length + ' noDiff=' + noDiff + ' pinned=' + RC.pinned + ' live=' + RC.live
  + ' sdTie=' + sdTie + ' sdNo=' + sdNo);

/* ---- THE RED ARM RUNS IN A CHILD, because MID_RANGE_LIVE is read at module load ----------------
 *
 * IT IS NOT JUDGED ON ITS EXIT CODE. Under the knob the child's own clauses assert that the DEFECT
 * IS PRESENT, so a working knob makes the child exit 0 — reading that as "the red arm passed" is the
 * classic inverted control and this file got it wrong first. The parent reads the child's numbers.
 *
 * THE CONTROL CAN FAIL, which is the whole point: if the fix reached no code the child would report
 * `live=0`, and if the queue tie were not what moves Trace's address it would report `tieDiff=0` or
 * `noDiff>0`. Each of those fails a clause below by name. */
if (!KNOB_ON && !RED_CHILD) {
  const { spawnSync } = require('child_process');
  console.log(NL + '--- THE RED ARM (MEDI_MID_RANGE_DRAWS=1, a child process — the knob is read at'
    + ' module load, so it cannot be turned on in this one) ---');
  /* THE CHILD INHERITS THE PARENT NODE FLAGS — 2026-08-28. Without this, a parent started with
   * `-r ./tests/_live_release.js` was redirected and its child was NOT: the child re-required
   * engine/game_differential.js with no --release, which CUTS A REAL RELEASE at require time and
   * REPOINTS data/engine-release.json under whatever else is measuring. Measured, not argued: a
   * redirected cut was shown NOT to touch data/engine-release.json, so every real cut seen during
   * a preloaded run came from here. process.execArgv is node OWN record of how this process was
   * started, so this reads the fact rather than re-deriving it. tests/probe_hazard_recap_fail.js
   * already did this by hand; this is the same fix at the four sites that did not. */
  const cp = spawnSync(process.execPath, [...process.execArgv, __filename, '--red'],
    { env: { ...process.env, MEDI_MID_RANGE_DRAWS: '1' }, encoding: 'utf8' });
  const out = String(cp.stdout || '') + String(cp.stderr || '');
  console.log(out.split(NL).filter(l => /^(  TIE  |RANGE-FORM|AUTHORITY|BOARDS|KNOB-VERDICT|  FAIL)/.test(l))
    .map(l => '  | ' + l).join(NL));
  const vline = out.split(NL).find(l => l.startsWith('KNOB-VERDICT'));
  if (!vline) {
    console.log(NL + '  FAIL — the red arm printed no verdict line (exit ' + cp.status + '). It did not run.');
    bad++;
  } else {
    const V = {};
    for (const kv of vline.split(' ').slice(1)) { const [k, v] = kv.split('='); V[k] = v; }
    const num = k => Number(V[k]);
    if (num('live') === 0) { console.log('  FAIL — the red arm took NO live range draw: the knob reached no code.'); bad++; }
    if (num('pinned') !== 0) { console.log('  FAIL — the red arm still pinned a range draw.'); bad++; }
    if (num('tie') === 0) { console.log('  FAIL — the red arm staged no TIE board, so it tested nothing.'); bad++; }
    if (num('tie') !== num('tieDiff')) {
      console.log('  FAIL — the red arm restored the range draw and ' + (num('tie') - num('tieDiff'))
        + ' of ' + num('tie') + ' tie board(s) STILL AGREE. The queue tie is not what moves the address.');
      bad++;
    }
    if (num('noDiff') !== 0) { console.log('  FAIL — ' + num('noDiff') + ' NO-TIE control board(s) parted under the knob.'); bad++; }
    if (V.sdTie === V.sdNo) {
      console.log('  FAIL — under the knob the authority answered the same on tie and no-tie boards,'
        + ' so this fixture never reached its die.');
      bad++;
    }
    console.log(NL + '  the red arm reproduced the defect: ' + V.tieDiff + '/' + V.tie
      + ' tie board(s) part, ' + V.noDiff + '/' + V.notie + ' controls part, authority ' + V.sdNo
      + ' -> ' + V.sdTie + ' across the tie.');
  }
}

console.log(NL + (bad ? bad + ' FAILING CLAUSE(S)' : 'all clauses green'));
process.exit(bad ? 1 : 0);
