/* test-imposter-transform-line.js — THE AUTHORITY ANNOUNCES A TRANSFORM AND THIS ENGINE SAID NOTHING.
 *
 *   SHOWDOWN_PATH=... node tests/test-imposter-transform-line.js
 *
 * ================= WHERE THIS CAME FROM ==========================================================
 *
 * `event missing from medicham2` is the largest whole-game divergence class — 55 of the 147 diverging
 * games in `data/game-differential.json` at release `b240433ae8af`. Rolled up by
 * `engine/divergence_report.js --class "event missing from medicham2" --all` and then grouped by the
 * SHOWDOWN-side event (the line we are missing), it is a long tail with two heads of ten:
 *
 *     10 games  10 causes  -transform ... [from] imposter      <- this file
 *     10 games  10 causes  switch|<body>                        (a switch-in ORDER question)
 *      7 games   6 causes  -fail                                (ROADMAP #241 part 3, already open)
 *      5 games   5 causes  -end|<body>|fallen<N>|[silent]
 *      5 games   2 causes  -weather|<w>|[upkeep]
 *
 * The `-transform` head is the most COHERENT of them: all ten causes are the same line from the same
 * mechanic, so one fix accounts for all ten and a bad result can be attributed. Ditto is brought in
 * 699 of the 83,125 stored games (0.84%) — a real but small share, and smaller than Kingambit's
 * `fallen` line at 31.4%. That row is a `[silent]` announcement with no board consequence behind it;
 * this one sits on a mechanic that rewrites an entire body.
 *
 * ================= WHAT WAS WRONG, AND IT WAS NOT AN OVERSIGHT ===================================
 *
 * `medicham2-browser.js` DECLARED it, in the `transformsOnEntry` header:
 *
 *     "NO `|-transform|` LINE IS EMITTED. The protocol side is a separate instrument with its own
 *      claimed-event list … The engine emitted nothing here before this wire and still does, so
 *      nothing regresses."
 *
 * True when written — NEITHER caller emitted one. ROADMAP #210 then gave the MOVE Transform its line
 * and put the emission at that call site, so `transformOnto` — the shared primitive both callers
 * reach — copied a body without announcing it, and the ENTRY caller (Imposter) kept the silence. That
 * is CLAUDE.md's FACTS-ARE-GLOBAL rule broken in its quietest form: a fact living at one call site of
 * two. The authority does not do it that way — `Pokemon#transformInto` emits the line ITSELF
 * (sim/pokemon.ts:1350/1352), so both of ITS callers get it for free.
 *
 * ================= THE THREE ARMS, AND WHY THREE ================================================
 *
 *   A  POSITIVE   Ditto with Imposter arrives. The authority writes ONE line, tagged. So must we.
 *   B  NEGATIVE   The SAME Ditto with Limber arrives. NEITHER engine may write one. An arm that only
 *                 ever stages the positive is passed by an engine that emits `-transform` on every
 *                 switch-in, which is a worse bug than the one being fixed.
 *   C  THE MOVE   The same Ditto with Limber CLICKS Transform. Its line is BARE, and that difference
 *                 is the authority's own: `transformInto(pokemon, effect)` writes
 *                 `'[from] ' + effect.fullname` when an effect caused the copy (:1350) and nothing
 *                 when the move did (:1352). Imposter passes an effect (data/abilities.ts:2113); the
 *                 move passes none. Arm C is ALSO the regression guard for moving the emission into
 *                 the primitive: if the move path lost its line, this arm goes red.
 *
 * NOTHING IS TYPED. Both engines play the same script under the differential's own pin and the two
 * protocol streams are compared. What each arm asserts is that they do not part — the expected
 * `-transform` lines come out of SHOWDOWN, never out of this file.
 *
 * ================= THE COUNTER IS ASSERTED EXACTLY ==============================================
 *
 * `MEDSEEN.transformLineEmitted` counts LINES WRITTEN, not copies made. That distinction is the whole
 * point: `transformedOnEntry` and `transformedByMove` both read non-zero throughout the period the
 * entry line was missing, because the copy was happening perfectly and only the announcement was
 * absent. A counter on the copy is blind to this defect by construction.
 *
 * And it is compared for EQUALITY against the authority's own line count, never `>= 1`. (2026-08-21,
 * paid for in the bracket work the same evening: a counter that reads `>= 1` stays green on a
 * completely broken engine, and one of them went UP when the fix it was guarding was deleted.)
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
 * real store and REPOINTS `data/engine-release.json` — which is correct for a measurement run and
 * wrong for a test that runs on every engine edit, because it moves the release another division may
 * be measuring against. Must come BEFORE the driver is loaded; the cut happens at ITS require time. */
require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
/* THE COUNTER MUST BE READ OUT OF THE ENGINE THE DRIVER IS ACTUALLY RUNNING, AND A PLAIN `require`
 * IS NOT IT. The driver loads medicham2 through the release loader — out of a snapshot DIRECTORY, a
 * copy — so `require(D('engine','medicham2-browser.js'))` here returns a SECOND module instance with
 * its own `MEDSEEN`. The first draft of this file did exactly that and read `counter=0 lines=1`: the
 * line was emitted, by the other copy, into a counter nobody was looking at.
 *
 * NO `need` LIST, on `test-bracket-regain.js`'s rule — adding one strands every release cut before
 * today for every caller of this file, for nothing.
 *
 * IT CANNOT FALSELY PASS. If this ever resolves to the wrong instance the counter reads 0 while the
 * stream holds a line, and the equality checks below go RED — which is how the mistake was caught. */
const M = G.REL.require('engine/medicham2-browser.js');

let fails = 0, checks = 0;
const ok = (cond, label, extra) => {
  checks++;
  if (cond) { console.log('  ok    ' + label + (extra ? '   (' + extra + ')' : '')); return true; }
  fails++; console.log('  FAIL  ' + label + (extra ? '   (' + extra + ')' : '')); return false;
};

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const P = { m: 'protect' };

/* THE FOE SIDE IS FIXED ACROSS ALL THREE ARMS so the only thing that varies is Ditto's ability and
 * what it clicks. Imposter copies the DIAGONAL — `foe.active[len - 1 - position]`
 * (data/abilities.ts:2111) — so a Ditto in p1a copies p2b, which is why arm C aims its Transform at
 * p2b as well: the two arms then differ in the `[from]` tag and in NOTHING else. */
const FOES = stage([
  ['garchomp', '', 'Rough Skin', ['Protect', 'Earthquake']],
  ['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']],
  ['milotic', '', 'Marvel Scale', ['Protect', 'Scald']],
  ['clefable', '', 'Unaware', ['Protect', 'Moonblast']],
]);

/* DITTO CARRIES ONLY TRANSFORM, which is its whole legal moveset. In arm A it never needs another —
 * by the time it is asked for a click it is holding Snorlax's slots, and clicking `protect` out of a
 * body that cannot learn it is the copy proving it landed. */
const mkA = ab => stage([
  ['ditto', '', ab, ['Transform']],
  ['incineroar', '', 'Blaze', ['Protect', 'Knock Off']],
  ['toxapex', '', 'Regenerator', ['Protect', 'Liquidation']],
  ['corviknight', '', 'Pressure', ['Protect', 'Brave Bird']],
]);

const ARMS = [
  { id: 'A', name: 'POSITIVE — Ditto with Imposter arrives and the copy is announced',
    A: mkA('Imposter'), expect: 1, tagged: true,
    script: [{ p1: [P, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }] },

  { id: 'B', name: 'NEGATIVE — the same Ditto with Limber arrives and NOTHING is announced',
    A: mkA('Limber'), expect: 0, tagged: null,
    script: [{ p1: [{ sw: 'toxapex' }, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }] },

  { id: 'C', name: 'THE MOVE — Limber Ditto clicks Transform and the line is BARE',
    A: mkA('Limber'), expect: 1, tagged: false,
    script: [{ p1: [{ m: 'transform', t: 1 }, P], p2: [P, P] }, { p1: [P, P], p2: [P, P] }] },
];

/* THE DIFFERENTIAL'S OWN READING OF A STREAM, and no more of it than this file needs.
 *  - `M.traceCanon` is the engine's symmetric canonicaliser, the same first step `semantic()` takes.
 *  - `|-ability|` is dropped on the differential's `ability-announcement` rule: Showdown's is a
 *    COSMETIC announcement that an ability activated, and every consequence of it is a separate line
 *    that is kept. Nothing else is dropped here — in particular the `[from]` tag on a `-transform`
 *    survives, and the check immediately below proves it rather than assuming it. */
const readable = arr => arr.map(String).map(l => M.traceCanon(l)).filter(l => !/^\|-ability\|/.test(l));
const XF = /^\|-transform\|/;

/* THE TRAILING `|turn|N`, TRUNCATED, AND SAYING SO. A scripted game stops when the script runs out
 * (`endReason: 'the script ran out'`), and by then Showdown has already written the NEXT `|turn|`
 * header for a turn neither engine will play. Every arm here would otherwise report a one-line
 * disagreement that is the harness stopping, not the engine.
 *
 * IT CANNOT HIDE A DROPPED TURN, which is the only thing worth worrying about: `r.turns` is asserted
 * against the script length separately, so an engine that played fewer turns is already red before
 * this runs. */
const toLastUpkeep = arr => {
  let k = -1;
  for (let i = 0; i < arr.length; i++) if (/^\|upkeep\b/.test(arr[i])) k = i;
  return k < 0 ? arr.slice() : arr.slice(0, k + 1);
};

/* THE READER MUST BE ABLE TO TELL THE TWO AUTHORITY ARMS APART. If `traceCanon` collapsed the
 * `[from]` tag, arms A and C would be indistinguishable and both would pass against an engine that
 * always wrote the same line. Asserted before any game is played. */
{
  const tagged = M.traceCanon('|-transform|p1a: Ditto|p2b: Snorlax|[from] ability: Imposter');
  const bare = M.traceCanon('|-transform|p1a: Ditto|p2b: Snorlax');
  ok(tagged !== bare, 'the reader keeps the [from] tag — the two authority arms are distinguishable',
     tagged + '  vs  ' + bare);
  ok(tagged === M.traceCanon('|-transform|p1a: Ditto|p2b: Snorlax|[from] ability: imposter'),
     'and it collapses the case difference, so `ability: imposter` is `ability: Imposter`');
}

const NL = String.fromCharCode(10);
for (const arm of ARMS) {
  console.log(NL + '  ARM ' + arm.id + ' — ' + arm.name);
  const a = G.buildPair(arm.A), b = G.buildPair(FOES);
  if (!ok(!!a && !!b, 'the fixture staged on both sides')) continue;

  G.resetScriptCounters();
  const before = M.MEDSEEN.transformLineEmitted;
  const r = G.playGame(a, b, 'directed', 'test-imposter-transform-line :: ' + arm.id, { script: arm.script });
  const emitted = M.MEDSEEN.transformLineEmitted - before;

  if (!ok(!r.err, 'the game ran', r.err || '')) continue;
  /* A SCENARIO THAT DID NOT REACH THE END OF ITS SCRIPT TESTED LESS THAN IT CLAIMS. Arm A ran ONE
   * turn of two before the fix, because the missing line desynchronised the two engines — so this
   * clause is itself part of the red. */
  ok(r.turns === arm.script.length, 'the whole script ran', r.turns + '/' + arm.script.length + ' turns');
  ok(G.scriptCounters().moveNotOnRequest === 0, 'every scripted click was on the request',
     'moveNotOnRequest=' + G.scriptCounters().moveNotOnRequest);

  const sd = toLastUpkeep(readable(G.sdStream(G.lastSdLog())));
  const me = toLastUpkeep(readable(r.mediTrace || []));
  const sdX = sd.filter(l => XF.test(l)), meX = me.filter(l => XF.test(l));

  /* THE EXPECTED COUNT IS THE AUTHORITY'S, CHECKED AGAINST WHAT THIS ARM CLAIMS TO STAGE. An arm
   * whose fixture stopped reaching the mechanic would otherwise pass by agreeing about zero. */
  ok(sdX.length === arm.expect, 'the AUTHORITY wrote ' + arm.expect + ' `-transform` line(s)',
     'showdown=' + sdX.length + (sdX.length ? '  ' + sdX.join(' ; ') : ''));
  ok(meX.length === sdX.length, 'and medicham2 wrote exactly as many',
     'medicham=' + meX.length + (meX.length ? '  ' + meX.join(' ; ') : ''));
  ok(meX.length === sdX.length && meX.every((l, i) => l === sdX[i]),
     'line for line, body for body, tag for tag');

  if (arm.tagged !== null && sdX.length) {
    ok(/\[from\]/.test(sdX[0]) === arm.tagged,
       'the authority\'s line is ' + (arm.tagged ? 'TAGGED with its cause' : 'BARE'), sdX[0]);
    ok(meX.length > 0 && /\[from\]/.test(meX[0]) === arm.tagged,
       'and so is ours — the two arms of sim/pokemon.ts:1350/1352 are not conflated');
  }

  /* THE COUNTER, EXACTLY. Not `>= 1`, and not against the copy counters — see the header. */
  ok(emitted === meX.length, 'MEDSEEN.transformLineEmitted counted every line this engine wrote',
     'counter=' + emitted + ' lines=' + meX.length);
  ok(emitted === sdX.length, 'and it equals the AUTHORITY\'s count for this arm',
     'counter=' + emitted + ' showdown=' + sdX.length);

  /* THE WHOLE STREAM. The `-transform` subsequence agreeing is the claim this file is about; the two
   * streams agreeing END TO END is the thing the differential actually measures, and one missing line
   * costs every line after it. These arms are quiet by construction (Protect, one switch, one
   * Transform), so a disagreement anywhere here is real. */
  const n = Math.max(sd.length, me.length);
  let firstPart = -1;
  for (let i = 0; i < n; i++) if (sd[i] !== me[i]) { firstPart = i; break; }
  if (!ok(firstPart < 0, 'the two protocol streams do not part at all', sd.length + ' vs ' + me.length + ' lines')) {
    for (let i = Math.max(0, firstPart - 2); i < Math.min(n, firstPart + 4); i++) {
      console.log('          ' + String(i).padStart(3) + ' SD ' + (sd[i] || '(none)').padEnd(56)
        + ' ME ' + (me[i] || '(none)') + (sd[i] === me[i] ? '' : '   <-- DIFFERS'));
    }
  }
}

console.log(NL + '  ' + (checks - fails) + '/' + checks + ' checks passed');
if (fails) {
  console.log('  ' + fails + ' FAILED — the authority announces a transform this engine does not, or '
    + 'announces one it should not.');
  process.exit(1);
}
console.log('  PASS');
