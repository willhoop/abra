/* test-precharge-order.js — THE PRE-TURN CHARGE ANNOUNCEMENT SITS AT ORDER 107, NOT AT THE TOP OF
 * THE TURN. It goes AFTER every switch and AFTER every mega evolution, and before every move.
 *
 *   SHOWDOWN_PATH=... node tests/test-precharge-order.js
 *
 * ================= WHERE THIS CAME FROM ==========================================================
 *
 * `ordering` is the second-largest whole-game divergence class in `data/game-differential.json` —
 * 29 of the 133 diverging games at release `6a05dd9ad60d`. It is 28 distinct causes, so it does NOT
 * collapse into one bug; rolled up by `node engine/divergence_report.js --class ordering --all` and
 * then grouped by SHAPE, its single largest family is:
 *
 *      5 games   switch        <> -singleturn|…|focuspunch
 *      2 games   detailschange <> -singleturn|…|focuspunch
 *      ------
 *      7 games   ONE cause: WHERE IN THE TURN the pre-turn charge announcement is written.
 *
 * Every one of the seven reads the same way round — the authority writes the switch (or the mega's
 * `detailschange`) FIRST and this engine writes the `-singleturn` first:
 *
 *      showdown  |switch|p1a: Ceruledge|Ceruledge, L50|150/150
 *      medicham  |-singleturn|p1b: Gengar|move: Focus Punch
 *
 * It is the largest family in the class AND the most coherent one — one mechanic, one line, so one
 * fix accounts for all seven and a bad result can be attributed. The runner-up (six games naming a
 * Sitrus Berry) is at least three separate timing questions and two of them are pin-suspect.
 *
 * ================= THE AUTHORITY, READ RATHER THAN RECALLED =====================================
 *
 * Focus Punch and Beak Blast do not announce themselves from a pre-pass. They are queued as their own
 * ACTION, and the action queue is ordered by an explicit table (`sim/battle-queue.ts:174-197`):
 *
 *      instaswitch: 3,   beforeTurn: 4,   beforeTurnMove: 5,   revivalblessing: 6,
 *      runSwitch: 101,   switch: 103,     megaEvo: 104,        megaEvoX/Y: 104,
 *      runDynamax: 105,  terastallize: 106,
 *      priorityChargeMove: 107,
 *      shift: 200,       // default is 200 (for moves)
 *      residual: 300,
 *
 * `priorityChargeMove` is the action that runs `move.priorityChargeCallback` (`sim/battle.ts:2736-2742`),
 * which for Focus Punch is `pokemon.addVolatile('focuspunch')` (`data/moves.ts:6013-6015`), whose
 * `condition.onStart` writes `this.add('-singleturn', pokemon, 'move: Focus Punch')` (`:6024-6026`).
 * The action is inserted by `resolveAction` for any move carrying a `priorityChargeCallback`
 * (`sim/battle-queue.ts:242-248`).
 *
 * So the announcement is **107**: strictly BELOW `switch` (103) and `megaEvo` (104), strictly ABOVE
 * every move (200). `/data/mods/champions/` overrides NEITHER — `data/mods/champions/moves.ts` has no
 * `focuspunch` key at all, its `beakblast` is `{ inherit: true, basePower: 120, pp: 5 }` (:47-51), and
 * `data/mods/champions/scripts.ts` contains no `queue`, no `resolveAction` and no order table.
 * Checked both ways, as CLAUDE.md requires.
 *
 * THIS ENGINE PUT IT AT ZERO. `medicham2-browser.js` announced it from the WIRE 82 pre-pass that runs
 * above the action loop, and the header said so in as many words: *"the line is written at the TOP of
 * the turn, above every `|move|`, which is exactly where this pre-pass runs."* The first half of that
 * is right and the second half is not — a pre-pass is above the switches too, and 107 is not 0.
 *
 * ================= THE FIVE ARMS, AND WHY EACH ONE IS HERE ======================================
 *
 *   A  SWITCH        A slot switches while another clicks Focus Punch. The authority writes
 *                    `|switch|` FIRST. This is the 5-game half of the family, verbatim.
 *   B  MEGA          A body mega-evolves and clicks Focus Punch. The authority writes
 *                    `|detailschange|` FIRST. This is the 2-game half.
 *   C  NEITHER       No switch, no mega. The line still precedes every `|move|`. GREEN BEFORE AND
 *                    AFTER — it is the guard against over-correcting, i.e. against pushing the phase
 *                    down past the first move, which would trade seven games for a worse bug.
 *   D  NEGATIVE      Nobody clicks a charging move. NEITHER engine may write the line, and the
 *                    Protect that IS clicked writes `|-singleturn|…|Protect` — a bare label with no
 *                    `move: ` prefix — so this arm also proves the reader is not matching everything.
 *   E  BEAK BLAST    The other member of the `preTurnShield` tag, staged behind a switch. The tag has
 *                    exactly two members (`data/tags.json`: moves:focuspunch, moves:beakblast) and
 *                    Toucannon is the ONLY legal body in this regulation that learns Beak Blast —
 *                    derived from `Dex.forFormat('gen9championsvgc2026regmb')`, filtered. Without this
 *                    arm the fix could be Focus-Punch-shaped rather than class-shaped and pass.
 *
 * NOTHING IS TYPED. Both engines play the same script under the differential's own pin and the two
 * protocol streams are compared. The expected ORDER is read out of SHOWDOWN's stream — this file
 * asserts that the authority's own relation holds there FIRST (so a fixture that stopped staging the
 * mechanic goes red instead of passing), and only then that ours matches it.
 *
 * ================= THE COUNTERS, AND THE NOUN EACH ONE COUNTS ===================================
 *
 * `MEDSEEN.preTurnShieldAnnounced` counts LINES WRITTEN. It was non-zero throughout the period this
 * defect existed, because the line was always written — in the wrong place. A count cannot see a
 * position, and this file says so rather than leaning on it.
 *
 * So three were added that CAN see the position, and each names the noun it counts:
 *   `preTurnChargeSwitchesAhead` — switch ACTIONS ALREADY RESOLVED when the charge phase fired.
 *   `preTurnChargeMegasAhead`    — MEGA EVOLUTIONS ALREADY DONE when the charge phase fired.
 *   `preTurnChargePhaseRan`      — TURNS in which somebody actually committed a charging move.
 * The first two were 0 in every arm on the broken engine by construction, because the phase ran
 * before anything else did — and the third is why that zero is readable: a phase that never fires
 * reports `switchesAhead = 0` too, which is the same number a correct zero gives. Every arm asserts
 * all three for EXACT equality (never `>= 1`), zeros included, which is what stops a counter that
 * simply always rises from passing. `MEDFAILS.preTurnChargeSkippedOffField` — the authority's own
 * `isActive`/`fainted` gate — is asserted at 0 in every arm as well.
 *
 * ================= HOW IT WAS SHOWN RED =========================================================
 *
 * TWICE, IN OPPOSITE DIRECTIONS, and the second one is the reason arm C exists.
 *
 *   1. AGAINST THE ENGINE AS IT WAS. 9 failures — arms A, B and E part on the very first line of the
 *      turn (`ME |-singleturn|…` where `SD |switch|…`), `preTurnChargeSwitchesAhead` reads 0 against
 *      an expected 1, and arms C and D are FULLY GREEN. That is the defect and nothing else.
 *   2. AGAINST AN OVER-CORRECTION. Deferring the phase one action further (`actIdx > 0` on the
 *      trigger) reds arms B and C — the line lands BELOW the first move — while A and E stay green,
 *      because their switch happens to be action 0. Restored byte-identical afterwards
 *      (sha256 a5778e20323f0e00 before and after).
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

/* THE ENGINE UNDER TEST IS THE LIVE TREE, frozen into a THROWAWAY store under the OS temp dir by
 * `tests/_live_release.js`. Requiring `game_differential.js` with no `--release` CUTS one into the
 * real store and REPOINTS `data/engine-release.json` (game_differential.js:196) — correct for a
 * measurement run, wrong for a test that runs on every engine edit. Must come BEFORE the driver. */
require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
/* THE COUNTER MUST COME OUT OF THE INSTANCE THE DRIVER IS RUNNING. The driver loads medicham2
 * through the release loader — a snapshot DIRECTORY — so a plain `require` here would hand back a
 * second module with its own `MEDSEEN`, reading 0 beside a line that exists. It cannot pass falsely;
 * it goes red. (Paid for on 2026-08-21 in test-imposter-transform-line.js.) */
const M = G.REL.require('engine/medicham2-browser.js');

let fails = 0, checks = 0;
const ok = (cond, label, extra) => {
  checks++;
  if (cond) { console.log('  ok    ' + label + (extra ? '   (' + extra + ')' : '')); return true; }
  fails++; console.log('  FAIL  ' + label + (extra ? '   (' + extra + ')' : '')); return false;
};

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));

/* THE FOE SIDE IS FIXED ACROSS EVERY ARM so the only thing that varies is what p1 does. Both foes
 * click CHARM at p1's slot 0 — a STATUS move, so it cannot set `lostFocus` and cannot turn the punch
 * into a `|cant|` (data/moves.ts:6027-6031, `if (move.category !== 'Status')`). Snorlax and Clefable
 * are the two legal bodies used here that learn it; derived, not chosen from memory. */
const FOES = stage([
  ['snorlax', '', 'Thick Fat', ['Charm', 'Protect']],
  ['clefable', '', 'Unaware', ['Charm', 'Protect']],
  ['milotic', '', 'Marvel Scale', ['Protect']],
  ['toxapex', '', 'Regenerator', ['Protect']],
]);
const CHARM_AT_P1A = [{ m: 'charm', t: 0 }, { m: 'charm', t: 0 }];

/* p1's BENCH is identical in every arm and both bench bodies are inert on entry — Ceruledge's Flash
 * Fire and Milotic's Marvel Scale announce nothing when they arrive, so arm A's switch contributes
 * exactly ONE line to the stream and the position question stays readable. */
const BENCH = stage([
  ['ceruledge', '', 'Flash Fire', ['Protect']],
  ['milotic', '', 'Marvel Scale', ['Protect']],
]);
const p1With = (lead, second) => stage([lead, second]).concat(BENCH);

const GENGAR = ['gengar', '', 'Cursed Body', ['Focus Punch', 'Protect']];
const CRAB = ['crabominable', 'Crabominite', 'Iron Fist', ['Focus Punch', 'Protect']];
const TOUCANNON = ['toucannon', '', 'Keen Eye', ['Beak Blast', 'Protect']];
const WHIMSI = ['whimsicott', '', 'Chlorophyll', ['Charm', 'Protect']];

const ARMS = [
  { id: 'A', name: 'SWITCH — the authority writes |switch| BEFORE the charge line',
    label: 'Focus Punch', expect: 1, switchesAhead: 1, megasAhead: 0, phaseRan: 1,
    anchor: { re: /^\|switch\|/, what: '|switch|' },
    A: p1With(GENGAR, WHIMSI),
    script: [{ p1: [{ m: 'focuspunch', t: 0 }, { sw: 'ceruledge' }], p2: CHARM_AT_P1A }] },

  { id: 'B', name: 'MEGA — the authority writes |detailschange| BEFORE the charge line',
    label: 'Focus Punch', expect: 1, switchesAhead: 0, megasAhead: 1, phaseRan: 1,
    anchor: { re: /^\|detailschange\|/, what: '|detailschange|' },
    A: p1With(CRAB, WHIMSI),
    script: [{ p1: [{ m: 'focuspunch', t: 0, mega: true }, { m: 'charm', t: 0 }], p2: CHARM_AT_P1A }] },

  { id: 'C', name: 'NEITHER — no switch, no mega, and the line still precedes every |move|',
    label: 'Focus Punch', expect: 1, switchesAhead: 0, megasAhead: 0, phaseRan: 1,
    anchor: null,
    A: p1With(GENGAR, WHIMSI),
    script: [{ p1: [{ m: 'focuspunch', t: 0 }, { m: 'charm', t: 0 }], p2: CHARM_AT_P1A }] },

  { id: 'D', name: 'NEGATIVE — nobody charges, and the Protect that IS clicked is not mistaken for one',
    label: 'Focus Punch', expect: 0, switchesAhead: 0, megasAhead: 0, phaseRan: 0,
    anchor: null,
    A: p1With(GENGAR, WHIMSI),
    script: [{ p1: [{ m: 'protect' }, { m: 'charm', t: 0 }], p2: CHARM_AT_P1A }] },

  { id: 'E', name: 'BEAK BLAST — the tag\'s other member, behind a switch, so the fix is class-shaped',
    label: 'Beak Blast', expect: 1, switchesAhead: 1, megasAhead: 0, phaseRan: 1,
    anchor: { re: /^\|switch\|/, what: '|switch|' },
    A: p1With(TOUCANNON, WHIMSI),
    script: [{ p1: [{ m: 'beakblast', t: 0 }, { sw: 'ceruledge' }], p2: CHARM_AT_P1A }] },
];

/* THE DIFFERENTIAL'S OWN READING OF A STREAM, and no more of it than this file needs. `traceCanon` is
 * the engine's symmetric canonicaliser; `|-ability|` is dropped on the differential's own
 * `ability-announcement` rule (a cosmetic announcement whose every consequence is a separate kept
 * line). Nothing else is dropped. */
const readable = arr => arr.map(String).map(l => M.traceCanon(l)).filter(l => !/^\|-ability\|/.test(l));

/* THE TRAILING `|turn|N`, TRUNCATED, AND SAYING SO. A scripted game stops when the script runs out,
 * and by then Showdown has written the NEXT `|turn|` header for a turn neither engine will play.
 * It cannot hide a dropped turn: `r.turns` is asserted against the script length separately. */
const toLastUpkeep = arr => {
  let k = -1;
  for (let i = 0; i < arr.length; i++) if (/^\|upkeep\b/.test(arr[i])) k = i;
  return k < 0 ? arr.slice() : arr.slice(0, k + 1);
};

/* THE TURN, NOT THE BATTLE. Every arm is one scripted turn, and the battle OPENS with four `|switch|`
 * lines that are the initial send-outs. Slicing from the last `|turn|` header is what stops arm A's
 * anchor from matching a send-out that has nothing to do with the question. */
const fromLastTurn = arr => {
  let k = -1;
  for (let i = 0; i < arr.length; i++) if (/^\|turn\|/.test(arr[i])) k = i;
  return k < 0 ? arr.slice() : arr.slice(k);
};

const idxOf = (arr, re) => { for (let i = 0; i < arr.length; i++) if (re.test(arr[i])) return i; return -1; };
const lastIdxOf = (arr, re) => { let k = -1; for (let i = 0; i < arr.length; i++) if (re.test(arr[i])) k = i; return k; };

/* THE MATCHER IS BUILT BY THE CANONICALISER, NOT TYPED — AND THE FIRST DRAFT OF THIS FILE TYPED IT
 * AND WAS WRONG BEFORE THE ENGINE WAS (the twenty-somethingth time, docs/LESSONS §4). `traceCanon`
 * lowercases and strips spaces, so the authority's `|-singleturn|p1a: Gengar|move: Focus Punch`
 * reads `|-singleturn|p1a:gengar|move:focuspunch` by the time this file sees it. A regex spelling
 * `move: Focus Punch` matches NOTHING, and every arm then reports `showdown=0` — which reads as a
 * fixture that never staged the mechanic and is really a reader that cannot see it.
 *
 * IT CANNOT FAIL SILENTLY EITHER WAY. The tail is derived by running a specimen line through the
 * same canonicaliser the streams go through, and the two checks below assert that a charge line and
 * a Protect line are DISTINGUISHABLE — arm D, the negative, rests entirely on that. */
const chargeTail = label => {
  const canon = M.traceCanon('|-singleturn|p1a: Specimen|move: ' + label);
  const tail = canon.slice(canon.indexOf('|', canon.indexOf('|', 1) + 1) + 1);
  return tail;
};
{
  const chg = M.traceCanon('|-singleturn|p1a: Gengar|move: Focus Punch');
  const pro = M.traceCanon('|-singleturn|p1a: Gengar|Protect');
  ok(chg !== pro, 'the reader distinguishes a charge line from Protect\'s', chg + '  vs  ' + pro);
  const tail = chargeTail('Focus Punch');
  ok(tail.length > 0 && chg.endsWith('|' + tail) && !pro.endsWith('|' + tail),
     'and the matcher tail is DERIVED through traceCanon, so it matches the one and not the other',
     'tail=' + tail);
}

const NL = String.fromCharCode(10);
for (const arm of ARMS) {
  console.log(NL + '  ARM ' + arm.id + ' — ' + arm.name);
  const CH = new RegExp('^\\|-singleturn\\|[^|]*\\|'
    + chargeTail(arm.label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');

  const a = G.buildPair(arm.A), b = G.buildPair(FOES);
  if (!ok(!!a && !!b, 'the fixture staged on both sides')) continue;

  G.resetScriptCounters();
  const c0 = { ann: M.MEDSEEN.preTurnShieldAnnounced || 0,
               sw: M.MEDSEEN.preTurnChargeSwitchesAhead || 0,
               mg: M.MEDSEEN.preTurnChargeMegasAhead || 0,
               ran: M.MEDSEEN.preTurnChargePhaseRan || 0,
               off: M.MEDFAILS.preTurnChargeSkippedOffField || 0 };
  const r = G.playGame(a, b, 'directed', 'test-precharge-order :: ' + arm.id, { script: arm.script });
  const ann = (M.MEDSEEN.preTurnShieldAnnounced || 0) - c0.ann;
  const swAhead = (M.MEDSEEN.preTurnChargeSwitchesAhead || 0) - c0.sw;
  const mgAhead = (M.MEDSEEN.preTurnChargeMegasAhead || 0) - c0.mg;
  const ranPhase = (M.MEDSEEN.preTurnChargePhaseRan || 0) - c0.ran;
  const offField = (M.MEDFAILS.preTurnChargeSkippedOffField || 0) - c0.off;

  if (!ok(!r.err, 'the game ran', r.err || '')) continue;
  /* A SCENARIO THAT DID NOT REACH THE END OF ITS SCRIPT TESTED LESS THAN IT CLAIMS. */
  ok(r.turns === arm.script.length, 'the whole script ran', r.turns + '/' + arm.script.length + ' turns');
  ok(G.scriptCounters().moveNotOnRequest === 0, 'every scripted click was on the request',
     'moveNotOnRequest=' + G.scriptCounters().moveNotOnRequest);
  if (arm.megasAhead) {
    /* THE MEGA MUST HAVE HAPPENED ON BOTH ENGINES. An arm whose mega was refused would agree about a
     * `detailschange` neither engine wrote, which is agreement about nothing. */
    ok(r.megaSd === 1 && r.megaMedi === 1, 'the mega fired on BOTH engines',
       'showdown=' + r.megaSd + ' medicham=' + r.megaMedi
       + ' refused=' + G.scriptCounters().megaRefused);
  }

  const sd = fromLastTurn(toLastUpkeep(readable(G.sdStream(G.lastSdLog()))));
  const me = fromLastTurn(toLastUpkeep(readable(r.mediTrace || [])));
  const sdC = sd.filter(l => CH.test(l)), meC = me.filter(l => CH.test(l));

  ok(sdC.length === arm.expect, 'the AUTHORITY wrote ' + arm.expect + ' `' + arm.label + '` charge line(s)',
     'showdown=' + sdC.length + (sdC.length ? '  ' + sdC.join(' ; ') : ''));
  ok(meC.length === sdC.length, 'and medicham2 wrote exactly as many',
     'medicham=' + meC.length + (meC.length ? '  ' + meC.join(' ; ') : ''));

  if (arm.expect) {
    const sdI = idxOf(sd, CH), meI = idxOf(me, CH);
    const sdMv = idxOf(sd, /^\|move\|/), meMv = idxOf(me, /^\|move\|/);

    /* ORDER 107 IS ABOVE 200: the charge line precedes every `|move|` of the turn. Asserted on the
     * AUTHORITY first — if this ever failed, the reading of the order table above is wrong and every
     * other claim in this file is worthless. */
    ok(sdMv >= 0 && sdI >= 0 && sdI < sdMv, 'AUTHORITY: the charge line is above every |move|',
       'singleturn@' + sdI + ' first move@' + sdMv);
    ok(meMv >= 0 && meI >= 0 && meI < meMv, 'and so is ours',
       'singleturn@' + meI + ' first move@' + meMv);

    if (arm.anchor) {
      /* ORDER 107 IS BELOW 103 AND 104: the charge line follows the switches and the megas. This is
       * the whole defect, and the authority's own relation is asserted before ours. */
      const sdA = lastIdxOf(sd, arm.anchor.re), meA = lastIdxOf(me, arm.anchor.re);
      ok(sdA >= 0, 'AUTHORITY: the arm staged a ' + arm.anchor.what + ' in this turn', 'anchor@' + sdA);
      ok(sdA >= 0 && sdI > sdA, 'AUTHORITY: the charge line comes AFTER ' + arm.anchor.what,
         'anchor@' + sdA + ' singleturn@' + sdI);
      ok(meA >= 0, 'ours staged one too', 'anchor@' + meA);
      ok(meA >= 0 && meI > meA, 'and OURS comes after it as well',
         'anchor@' + meA + ' singleturn@' + meI + (meI < meA ? '   <-- WE ANNOUNCE IT TOO EARLY' : ''));
    }
  }

  /* THE COUNTERS, EXACTLY, IN EVERY ARM INCLUDING THE ZEROS. */
  ok(ann === meC.length, 'MEDSEEN.preTurnShieldAnnounced counted every charge line we wrote',
     'counter=' + ann + ' lines=' + meC.length);
  ok(swAhead === arm.switchesAhead, 'preTurnChargeSwitchesAhead — switches already resolved when the '
     + 'charge phase fired', 'counter=' + swAhead + ' expected=' + arm.switchesAhead);
  ok(mgAhead === arm.megasAhead, 'preTurnChargeMegasAhead — megas already done when the charge phase '
     + 'fired', 'counter=' + mgAhead + ' expected=' + arm.megasAhead);
  /* THE CAPABILITY MUST PROVE IT RAN — and in the negative arm, that it did NOT. A phase that never
   * fires reads `switchesAhead = 0` too, which is the same number a correct zero gives. */
  ok(ranPhase === arm.phaseRan, 'preTurnChargePhaseRan — turns in which somebody committed a charging '
     + 'move', 'counter=' + ranPhase + ' expected=' + arm.phaseRan);
  /* THE AUTHORITY'S ACTIVE GATE, KEPT LOUD. Nothing in these arms can faint a body before order 107,
   * so a non-zero here is a door the reasoning in `_chargePhase`'s header did not cover. */
  ok(offField === 0, 'MEDFAILS.preTurnChargeSkippedOffField stayed at zero', 'counter=' + offField);

  /* THE WHOLE STREAM. The charge line's position is what this file is about; the two streams agreeing
   * END TO END is what the differential measures, and one misplaced line costs every line after it. */
  const n = Math.max(sd.length, me.length);
  let firstPart = -1;
  for (let i = 0; i < n; i++) if (sd[i] !== me[i]) { firstPart = i; break; }
  if (!ok(firstPart < 0, 'the two protocol streams do not part at all',
          sd.length + ' vs ' + me.length + ' lines')) {
    for (let i = Math.max(0, firstPart - 2); i < Math.min(n, firstPart + 5); i++) {
      console.log('          ' + String(i).padStart(3) + ' SD ' + (sd[i] || '(none)').padEnd(56)
        + ' ME ' + (me[i] || '(none)') + (sd[i] === me[i] ? '' : '   <-- DIFFERS'));
    }
  }
}

console.log(NL + '  ' + (checks - fails) + '/' + checks + ' checks passed');
if (fails) {
  console.log('  ' + fails + ' FAILED — the pre-turn charge announcement is not at order 107: it is '
    + 'either above the switches and the megas (the defect this file was written for) or below the '
    + 'first move (over-correction).');
  process.exit(1);
}
console.log('  PASS');
