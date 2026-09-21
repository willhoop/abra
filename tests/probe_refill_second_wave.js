#!/usr/bin/env node
/* tests/probe_refill_second_wave.js — A FAINT REPLACEMENT THAT DIES ON ARRIVAL IS ITSELF REPLACED
 *   node tests/probe_refill_second_wave.js        node tests/probe_refill_second_wave.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY RAISES A NEW SWITCH REQUEST FOR EVERY WAVE OF CORPSES. `Battle#runAction`, read in
 * order (sim/battle.ts):
 *
 *     this.faintMessages();                                    :2832
 *     if (this.ended) return true;                             :2833
 *     if (!this.queue.peek() || ...) { this.checkFainted(); }   :2837-2840
 *     ...
 *     for (const playerSwitch of switches) {
 *       if (playerSwitch) { this.makeRequest('switch'); return true; }   :2905-2910
 *
 * and `checkFainted()` (:2521-2530) sets `switchFlag = true` on EVERY fainted active. The replacement
 * switch is itself an action, so when the body that just walked in dies to Stealth Rock, that line
 * runs again and the authority asks for the NEXT replacement — all of it before `|turn|` is printed.
 *
 * THIS ENGINE SNAPSHOTTED THE CORPSES ONCE. `_refills` was built from the fainted actives before the
 * first wave walked in and never rebuilt, so a replacement that died on arrival stayed in the slot as
 * a corpse until the next turn opened.
 *
 * MEASURED BEFORE ANYTHING MOVED, on the live team pool, `...bo3-2671680205 vs ...bo3-2676177609` /
 * omit-protect, turn 13 — the two streams identical for thirteen turns and then:
 *
 *     both       |switch|p2b: Dragonite|Dragonite-Mega, L50|2/166
 *     both       |-damage|p2b: Dragonite|0 fnt|[from] Stealth Rock
 *     both       |faint|p2b: Dragonite
 *     showdown   (asks again — Oranguru is alive on the bench)
 *     medicham   (asks nothing; the corpse is still standing at |turn|14)
 *
 * IT SURFACED AS AN INSTRUMENT FAILURE AND IT WAS NOT ONE. tests/test-forced-switch-mirror.js part 8
 * went red: the mirror answered `pass` for a slot medicham2 had not filled, Showdown refused it with
 * *"Can't pass: You need to switch in a Pokemon to replace Dragonite"*, and the two engines' ALIVE
 * SETS AGREED — which is the driver's own test for "the boards have parted". They had not parted. The
 * engine owed a replacement.
 *
 * THE FIXTURE IS DERIVED AND IT HAS TO BE PRE-DAMAGED. Stealth Rock takes at most half a maximum HP,
 * so no fresh body dies on arrival to it: the entrant has to walk into the rocks TWICE. Volcarona is
 * the only legal body 4x weak to Rock and not Flying — 160 -> 80 on the first entry and 80 -> 0 on the
 * second, exactly. The file derives that list and refuses to run if it ever holds anything else.
 *
 * TWO CONTROLS, AND THEY ARE WHAT SEPARATE THIS FROM "THE KNOB BREAKS EVERY REPLACEMENT":
 *   - the SAME rocks and the SAME faint, with the entrant arriving FRESH. It takes the 80 chip and
 *     lives, nothing is owed to a second wave, and both arms must be identical.
 *   - the same faint with NO hazard at all. The silent arm: an engine that started refilling twice
 *     where the authority refills once parts here.
 *
 * RED FIRST: `MEDI_REFILL_ONE_WAVE=1` restores the engine as it stood before this file existed.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE — it is read once at medicham2's module load, and
 * `game_differential.js` loads medicham2 at ITS require time. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_REFILL_ONE_WAVE = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* `--state` IS PUSHED BEFORE THE REQUIRE, AND WITHOUT IT EVERY BOARD CLAIM HERE IS VACUOUS —
 * `playGame` only fills `r.stateDiv` when the run asked for the state comparison. */
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
/* IT MUST BE THE INSTANCE THE DRIVER PLAYED — a bare require is a second module object whose counters
 * nothing writes, and a zero there reads exactly like a wire that never ran. */
const M = REL.require('engine/medicham2-browser.js');
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0, ran = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- 1. THE FIXTURE'S FACTS, ASKED OF THE FORMAT -------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => CS.canLearn(sp, mv);
let bad = 0;
{
  const fourX = dex.species.all().filter(s => legal(s) && !s.types.includes('Flying')
    && dex.getEffectiveness('Rock', s.types) === 2).map(s => s.name);
  console.log('  every legal body 4x weak to Rock and grounded, DERIVED: ' + (fourX.join(', ') || '(none)'));
  if (!fourX.includes('Volcarona')) { console.log('FIXTURE WRONG — the staged entrant is not in that list'); bad++; }
  const sr = dex.moves.get('stealthrock');
  if (!legal(sr) || sr.sideCondition !== 'stealthrock') {
    console.log('FIXTURE WRONG — Stealth Rock is not the hazard this file thinks it is'); bad++; }
  if (!learns('glimmora', 'stealthrock')) { console.log('FIXTURE WRONG — the setter does not learn it'); bad++; }
  if (!learns('kingambit', 'ironhead')) { console.log('FIXTURE WRONG — the executioner does not learn Iron Head'); bad++; }
  /* THE KILL IS A TYPE FACT AND IS READ RATHER THAN TRUSTED: Iron Head must be super effective on the
   * body that has to die, or the replacement never happens and every claim below is vacuous. */
  const wh = dex.species.get('whimsicott');
  if (!legal(wh) || dex.getEffectiveness('Steel', wh.types) !== 1) {
    console.log('FIXTURE WRONG — Iron Head is not super effective on the staged victim'); bad++; }
}
if (bad) { console.log(NL + 'NOT RUN — ' + bad + ' fixture fault(s). This is not a pass.'); process.exit(2); }

/* ---- 2. THE ARMS --------------------------------------------------------------------------------- */
const mk = (sp, it, ab, mv) => ({ species: sp, item: it, ability: ab, moves: mv });
const P = { m: 'protect' }, SR = { m: 'stealthrock' }, TW = { m: 'tailwind' };
const IRON = { m: 'ironhead', t: 0 };

const P1 = [mk('glimmora', '', 'Toxic Debris', ['Stealth Rock', 'Protect']),
            mk('kingambit', '', 'Defiant', ['Iron Head', 'Protect']),
            mk('incineroar', '', 'Intimidate', ['Protect']),
            mk('clefable', '', 'Unaware', ['Protect'])];
/* THE PARTY ORDER IS THE REPLACEMENT ORDER AND IS NOT LEFT TO CHANCE. `bringIn` takes the first LIVE
 * bench body, so Volcarona has to sit ahead of the wave-2 body on the bench at the moment the victim
 * dies. Each arm asserts WHICH body walked in rather than assuming it. */
const P2 = [mk('whimsicott', '', 'Prankster', ['Tailwind', 'Protect']),
            mk('toxapex', '', 'Regenerator', ['Protect']),
            mk('volcarona', '', 'Flame Body', ['Protect']),
            mk('milotic', '', 'Marvel Scale', ['Protect'])];

/* THE PIVOT IS WHAT MAKES THE ENTRANT LETHAL TO ITSELF: it walks into the rocks once at full HP,
 * walks back out, and the faint on turn 4 sends it in AGAIN at exactly half.
 *
 * THE ROCKS GO DOWN ON A TURN OF THEIR OWN AND THAT IS NOT PADDING. A switch is order 103 and resolves
 * before any move, so a `stealthrock` and a `{sw:}` written on the SAME turn put the entrant on the
 * field BEFORE the hazard exists — measured, with `--dump`: Volcarona arrived at 160/160 and the
 * `|-sidestart|` came after it. The pivot has to be a turn later than the setter. */
const PIVOT = [{ p1: [SR, P],    p2: [P, P] },
               { p1: [P, P],     p2: [{ sw: 'volcarona' }, P] },
               { p1: [P, P],     p2: [{ sw: 'whimsicott' }, P] },
               { p1: [P, IRON],  p2: [TW, P] },
               { p1: [P, P],     p2: [P, P] }];
/* THE SAME GAME WITHOUT THE PIVOT: the rocks are down, the same body dies, and the same entrant walks
 * in FRESH — 160 -> 80, alive. One wave, and both arms must agree. */
const FRESH = [{ p1: [SR, P],    p2: [P, P] },
               { p1: [P, P],     p2: [P, P] },
               { p1: [P, P],     p2: [P, P] },
               { p1: [P, IRON],  p2: [TW, P] },
               { p1: [P, P],     p2: [P, P] }];
/* AND THE SILENT ARM: the identical kill with nothing on the field to chip anybody. */
const NOHAZ = [{ p1: [P, P],     p2: [P, P] },
               { p1: [P, P],     p2: [P, P] },
               { p1: [P, P],     p2: [P, P] },
               { p1: [P, IRON],  p2: [TW, P] },
               { p1: [P, P],     p2: [P, P] }];

const CASES = [
  { name: 'RED  the replacement walks onto its own rocks at half HP and dies there', part: true,
    what: 'Volcarona pivots through the rocks on turn 2 (160 -> 80) and back out on turn 3. Kingambit '
        + 'kills the Whimsicott on turn 4, Volcarona is the first live bench body, it walks in and '
        + 'Stealth Rock takes the last 80. The authority then asks AGAIN and Milotic comes in; this '
        + 'engine left the corpse standing.',
    p1: P1, p2: P2, script: PIVOT, wave2: 'milotic', wantWave: 1 },

  { name: 'CONTROL  the same rocks, the same faint, a FRESH entrant', part: false,
    what: 'Everything identical except the pivot. Volcarona arrives at 160, takes the same 80 chip and '
        + 'lives, so nothing is owed to a second wave. A knob that broke every replacement parts here.',
    p1: P1, p2: P2, script: FRESH, wave2: null, wantWave: 0 },

  { name: 'CONTROL  the same faint with NO hazard at all', part: false,
    what: 'The silent arm. The entrant arrives at full HP and nothing chips it, so an engine that '
        + 'started refilling twice where the authority refills once parts here.',
    p1: P1, p2: P2, script: NOHAZ, wave2: null, wantWave: 0 },
];

/* ---- 3. THE RUN ---------------------------------------------------------------------------------- */
console.log(NL + (RED ? 'RED ARM — MEDI_REFILL_ONE_WAVE=1 (the engine as it stood before the fix)'
                      : 'CLEAN ARM') + NL);

const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
let waveTotal = 0;
for (const c of CASES) {
  const a = G.buildPair(c.p1), b = G.buildPair(c.p2);
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const w0 = SEEN.refillSecondWave || 0;
  const r = G.playGame(a, b, 'directed', 'probe_refill_second_wave :: ' + c.name,
                       { script: c.script, arm: ARM });
  ran++;
  const mt = r.mediTrace || [];
  const sd = G.lastSdLog();
  const moved = (SEEN.refillSecondWave || 0) - w0;
  waveTotal += moved;
  /* SHOWDOWN PRINTS EVERY SWITCH TWICE — the private line and, right behind it, the public copy the
   * `|split|` marker introduces. Counting both reads "2" for one entry, which is a fault in the RULER
   * and would be reported as a fault in the engine.
   *
   * THE PAIR IS TOLD APART BY THE `|split|` MARKER, NOT BY THE HP TEXT, and that is not fussiness: the
   * percentage copy is `|50/100y` on a body below half, and a `/100` pattern written without the
   * suffix counted it as a THIRD entry — one claim red on a stream that was correct line for line.
   * The structure is `|split|pN`, then the private line, then the public one, so the private copy is
   * exactly the line whose PREDECESSOR is the marker. medicham2 emits no `|split|` at all and every
   * one of its `|switch|` lines is counted. */
  const isSwitch = (who) => l => new RegExp('^\\|switch\\|p2a: ' + who, 'i').test(String(l));
  const countSd = (who) => sd.filter((l, i) => isSwitch(who)(l)
                                      && /^\|split\|/.test(String(sd[i - 1] || ''))).length;
  const countMe = (who) => mt.filter(isSwitch(who)).length;
  const volcIn = countMe('Volcarona'), volcInSd = countSd('Volcarona');
  const w2 = c.wave2 ? countMe(c.wave2) : 0;
  const w2sd = c.wave2 ? countSd(c.wave2) : 0;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    board: ' + (r.stateDiv
    ? 'PARTED at t' + r.stateDiv.turn + '  ' + JSON.stringify(r.stateDiv.diffs.map(d =>
        d.path + ' medi ' + JSON.stringify(d.medicham) + ' sd ' + JSON.stringify(d.showdown)))
    : 'identical at every boundary'));
  if (r.err) console.log('    err:   ' + r.err);
  /* `--dump` prints the authority's own stream for the staged game. It is how the fixture was aimed
   * and it is kept because the next person to change a body will need it again. */
  if (process.argv.includes('--dump')) for (const l of sd) console.log('      SD ' + l);
  console.log('    entries into p2a — Volcarona: medicham ' + volcIn + ' / showdown ' + volcInSd
    + (c.wave2 ? ';  ' + c.wave2 + ': medicham ' + w2 + ' / showdown ' + w2sd : ''));

  /* THE ARM MUST HAVE STAGED WHAT IT CLAIMS. The authority's own stream is the witness, because it is
   * the one side of this comparison that is never the thing under test. */
  claim(volcInSd === (c.script === PIVOT ? 2 : 1),
    c.name + ' — the AUTHORITY walked the entrant into that slot the staged number of times',
    'showdown ' + volcInSd + ', wanted ' + (c.script === PIVOT ? 2 : 1));

  /* EVERY CLAIM BELOW IS THE CORRECT BEHAVIOUR, STATED ONCE AND NOT INVERTED UNDER `--red`. The knob
   * arm is supposed to come back RED — that is the whole point of it, and a probe that flipped its own
   * assertions would be green under both arms and could never be shown to bite. */
  if (c.part) {
    /* THE CLAIM, STATED ON A `|switch|` LINE RATHER THAN ON A VERDICT. A verdict can be reached for a
     * second reason; a switch line is the replacement or it is not. */
    claim(w2 === 1, c.name + ' — this engine makes the SECOND replacement',
      'medicham ' + w2 + ' `|switch|p2a: ' + c.wave2 + '` line(s)');
    claim(!r.stateDiv && !r.err, c.name + ' — the boards agree and the game ran to the end',
      (r.stateDiv ? 'parted at t' + r.stateDiv.turn : 'identical at every boundary')
      + (r.err ? '; err ' + r.err : ''));
    /* AND THE AUTHORITY'S OWN HALF, ASKED ONLY OF A GAME THAT FINISHED. Under the revert the harness
     * STOPS at the refusal, so Showdown never gets to print its second `|switch|` either — claiming it
     * there would be claiming that a game which was cut short carried on, which is a statement about
     * the stopping rule wearing the clothes of a statement about the authority. It is PRINTED rather
     * than silently skipped, because a claim that quietly stops being asked is the shape this
     * repository keeps paying for. */
    if (!r.err) claim(w2sd === 1, c.name + ' — and so does the authority',
      'showdown ' + w2sd + ' `|switch|p2a: ' + c.wave2 + '` line(s)');
    else console.log('  ----  ' + c.name + ' — the authority\'s own second replacement is NOT asked on '
      + 'this run: the game was stopped at "' + r.err + '", so neither stream reached it.');
  } else {
    claim(!r.stateDiv && !r.err,
      c.name + ' — the boards agree   [control: must hold under the revert too]',
      (r.stateDiv ? 'parted at t' + r.stateDiv.turn : 'identical at every boundary')
      + (r.err ? '; err ' + r.err : ''));
  }
  claim(moved === c.wantWave,
    c.name + ' — the engine\'s own wave counter',
    'MEDSEEN.refillSecondWave moved by ' + moved + ', wanted ' + c.wantWave);
}

/* ---- 4. THE ENGINE'S OWN RECEIPTS ----------------------------------------------------------------
 * Also unconditional. On the `--red` arm `refillOneWave` reads 1 and this claim goes red, which is
 * the receipt that the knob was READ rather than merely spelled — the failure names the field. */
claim((FAILS.refillOneWave || 0) === 0,
  'no revert knob is in play',
  'MEDFAILS.refillOneWave = ' + (FAILS.refillOneWave || 0)
    + (RED ? '   <-- 1 is expected on the --red arm; this claim going red IS the knob\'s receipt' : ''));
claim(waveTotal === 1,
  'the loop ran exactly ONCE across the three arms, and it was the RED arm',
  'MEDSEEN.refillSecondWave moved by ' + waveTotal
    + '  (0 means the loop is present and dead; 2 or more means it fired on an arm where the '
    + 'authority asks only once)');
claim((FAILS.refillWaveCapHit || 0) === 0,
  'and the backstop was never reached — the loop stopped because the board said so',
  'MEDFAILS.refillWaveCapHit = ' + (FAILS.refillWaveCapHit || 0));

console.log(NL + (fails ? 'RED — ' + fails + ' claim(s) failed over ' + ran + ' staged games'
                        : 'GREEN — every claim held over ' + ran + ' staged games'));
process.exit(fails ? 1 : 0);
