#!/usr/bin/env node
/* tests/probe_shedtail_refusal_line.js — NARRATION, THE SHED TAIL REFUSAL FAMILY
 * ==================================================================================================
 * SHED TAIL'S OWN `onTryHit` WRITES THREE DIFFERENT `-fail` LINES AND THIS ENGINE WROTE ONE.
 *
 * THE AUTHORITY, read this run (data/moves.ts:16166-16179; Champions does not override `shedtail`,
 * which §0 re-checks rather than assuming):
 *
 *     onTryHit(source) {
 *       if (!this.canSwitch(source.side) || source.volatiles['commanded']) {
 *         this.add('-fail', source);                                  <- TWO fields.  BARE.
 *         return this.NOT_FAIL; }
 *       if (source.volatiles['substitute']) {
 *         this.add('-fail', source, 'move: Shed Tail');               <- THREE fields. NO flag.
 *         return this.NOT_FAIL; }
 *       if (source.hp <= Math.ceil(source.maxhp / 2)) {
 *         this.add('-fail', source, 'move: Shed Tail', '[weak]');     <- FOUR fields.
 *         return this.NOT_FAIL; }
 *     }
 *
 * THE MECHANISM, versus what the divergence card claimed. The pool card reads
 * `-fail field 3 :: |-fail|p1a|shedtail|[weak] <> |-fail|p1a`, which names the LOCATION and not the
 * cause. `mvFailNamed` and `costsUserHP.announcesFailBelow` have both existed since NARRATION BATCH S
 * and the tag already carries `{ label: 'Shed Tail', flag: '[weak]' }` — derived, not typed. What was
 * wrong is that Shed Tail never reaches the generic `costsUserHP` block that consumes them: that block
 * excludes `a.kind==='passstate'` on purpose, because THE ORDER OF THE THREE CHECKS IS PART OF THE
 * MOVE (a Shed Tail with an empty bench must cost nothing), and the `passstate` branch that owns the
 * order wrote a bare `mvFail` on all three roads. So this is not a missing field: it is one branch of
 * a two-branch family that was never handed the label the other branch had.
 *
 * ================= THE ARMS, AND WHY ONE OF THEM MUST STAY BARE ================================
 *
 *   SHED-WEAK      RED before the fix. Orthworm is burned down to at-or-below `ceil(maxhp/2)` and
 *                  clicks Shed Tail with a live bench and no doll, so the THIRD branch fires and the
 *                  authority writes the name AND `[weak]`. This is the pool card's own shape
 *                  (`pair-speedctrl …2654408616` t2, Orthworm 54/145).
 *   SHED-REPEAT    RED before the fix. A doll is already standing and the body is above the
 *                  threshold, so the SECOND branch fires: the same move name and NO flag. A fix that
 *                  appended `[weak]` to every Shed Tail refusal breaks here and only here.
 *   SHED-NOBENCH   CONTROL, GREEN BEFORE AND AFTER. The side holds two bodies and both are active, so
 *                  `canSwitch` is false and the FIRST branch fires — which writes the BARE two-field
 *                  line. A fix that labelled every Shed Tail refusal breaks here and only here.
 *
 * Every arm also asserts the BOARDS are identical at every boundary, so a fix that changed what
 * happened as well as what was said cannot pass.
 *
 * ================= WHAT THIS PROBE READS RATHER THAN DERIVES ===================================
 *
 * Nothing about WHICH label or WHICH flag. §0 reads `shedtail`'s own handler out of the authority on
 * every run and asserts the engine's tag agrees with it field by field; the day the handler changes,
 * this probe goes red instead of pinning a line the game no longer writes. The three staged HP/doll
 * predicates are likewise read off the authority's own expressions rather than restated.
 *
 * RED-FIRST KNOB: `MEDI_BARE_FAIL_LABELS=1` puts the bare lines back — it is the same knob NARRATION
 * BATCH S installed on `mvFailNamed`, and it covers this branch for free because the fix routes
 * through that one function (CLAUDE.md: one implementation, everybody calls it). Under it SHED-WEAK
 * and SHED-REPEAT go RED and SHED-NOBENCH stays green.
 *
 *   SHOWDOWN_PATH=... node tests/probe_shedtail_refusal_line.js
 *   MEDI_BARE_FAIL_LABELS=1 SHOWDOWN_PATH=... node tests/probe_shedtail_refusal_line.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '8');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_BARE_FAIL_LABELS === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_shedtail_refusal_line.js — Shed Tail writes THREE different `-fail` lines');
console.log('  MEDI_BARE_FAIL_LABELS=' + (KNOB ? '1  (PRE-FIX ENGINE: every refusal goes out bare)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY — read this run. The CR is stripped because this checkout is CRLF and a carriage
 *    return is a JavaScript line terminator, so a multi-line anchor would match nothing.
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const MOVES = read('/data/moves.ts');
const CH_MOVES = read('/data/mods/champions/moves.ts');
const block = (src, id) => {
  const m = new RegExp('\\n\\t' + id + ': \\{\\n([\\s\\S]*?)\\n\\t\\},\\n').exec(src);
  return m ? m[1] : null;
};

console.log(NL + '0. THE AUTHORITY');
const ST = block(MOVES, 'shedtail');
ok(!/\n\tshedtail: \{/.test(CH_MOVES), 'Champions does not override `shedtail`, so mainline IS its authority');
ok(!!ST, '`shedtail` was found in data/moves.ts');

/* The three refusals, in the order the handler asks them — the ORDER is a claim this probe makes and
 * the engine's `passstate` branch honours, so it is asserted rather than assumed. */
const refusals = ST ? (ST.match(/this\.add\('-fail'[^\n]*\);/g) || []) : [];
ok(refusals.length === 3, 'the handler writes exactly THREE `-fail` lines', refusals.join('\n'));
ok(refusals[0] === "this.add('-fail', source);",
   'FIRST (no bench / commanded) is BARE — two fields', refusals[0]);
ok(refusals[1] === "this.add('-fail', source, 'move: Shed Tail');",
   'SECOND (a doll is already up) NAMES the move and carries NO flag', refusals[1]);
ok(refusals[2] === "this.add('-fail', source, 'move: Shed Tail', '[weak]');",
   'THIRD (below the HP threshold) names the move AND carries `[weak]`', refusals[2]);
const guards = ST ? (ST.match(/if \([^\n]*\) \{/g) || []) : [];
ok(guards.some(g => /!this\.canSwitch\(source\.side\)/.test(g)),
   'the bench check is FIRST, which is why an empty-bench Shed Tail costs nothing', guards[0]);
ok(/source\.hp <= Math\.ceil\(source\.maxhp \/ 2\)/.test(ST || ''),
   'the threshold is `hp <= ceil(maxhp / 2)` — CEIL, and it is the same expression as the cost');
ok(/this\.directDamage\(Math\.ceil\(target\.maxhp \/ 2\)\)/.test(ST || ''),
   'the cost is `directDamage(ceil(maxhp / 2))`, so the tag\'s `rounds: ceil` is the handler\'s');

/* WHICH LABEL AND WHICH FLAG ARE NOT TYPED IN THE ENGINE — the tag is compared to the handler here. */
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const shedTag = ((((TAGS.moves || {}).shedtail || {}).params || {}).costsUserHP) || null;
const ann = shedTag && shedTag.announcesFailBelow;
ok(!!ann && ann.label === 'Shed Tail' && ann.flag === '[weak]',
   '`costsUserHP.announcesFailBelow` agrees with the handler, field for field',
   'tag: ' + JSON.stringify(ann) + '   handler: ' + refusals[2]);
ok(!!shedTag && shedTag.rounds === 'ceil' && +shedTag.failsBelow === 0.5,
   'the tag\'s threshold matches the handler\'s expression', JSON.stringify(shedTag));
const passTag = (((TAGS.moves || {}).shedtail || {}).tags) || [];
ok(passTag.indexOf('passesState') >= 0 && passTag.indexOf('substitute') >= 0,
   'Shed Tail carries BOTH `passesState` and `substitute`, which is why it is routed away from the '
   + 'generic `costsUserHP` block and into the branch that owns the check order');

/* ==================================================================================================
 * 1. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const ARM = G.ARM_BY_ID.get('top-tie-first');
if (!ARM) { console.log('  NOT STAGED — the top arm is not in ARM_BY_ID.'); process.exit(1); }
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const IDLE = { m: 'nastyplot' };          /* every filler body is a legal Nasty Plot carrier */
const ORTH_IDLE = { m: 'irondefense' };   /* Orthworm's own inert self-click */
const ZARD_IDLE = { m: 'dragondance' };   /* the attacker's inert self-click; it attacks specially */

function play(tag, A, B, script, opts) {
  const a = G.buildPair(A, (opts && opts.optA) || undefined);
  const b = G.buildPair(B, (opts && opts.optB) || undefined);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_shedtail_refusal_line :: ' + tag, {
    script, arm: ARM,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).slice(0, 4) });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW/REJECTED: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  if (r.turns !== script.length) return { staged: false, why: 'only ' + r.turns + ' of ' + script.length + ' turns played' };
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  const norm = (s) => s.filter(l => /^\|-fail\|/.test(l))
                       .map(l => l.replace(/\s+/g, ' ').toLowerCase().replace(/[:,]/g, ''));
  return { staged: true, boards, sd, me, sdFails: norm(sd), meFails: norm(me),
           boardDiffs: boards.reduce((n, x) => n + x.diffs.length, 0),
           firstDiffs: boards.map(x => x.diffs).find(d => d.length) || [],
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

/* THE CAST. Orthworm is one of only four legal Shed Tail carriers in this regulation and the only one
 * of them that is not a glass frame, which is why the pool card is an Orthworm too. Charizard attacks
 * SPECIALLY into a 145-base-Defence / 55-base-SpDefence body so the burn-down is short and its own
 * idle click is a physical setup move that changes nothing about the damage it deals. */
const ATK = [mon('charizard', '', 'Blaze', ['Flamethrower', 'Dragon Dance']),
             mon('sableye', '', 'Prankster', ['Nasty Plot']),
             mon('garchomp', '', 'Rough Skin', ['Swords Dance']),
             mon('gholdengo', '', 'Good as Gold', ['Nasty Plot'])];
const ORTH = [mon('orthworm', '', 'Earth Eater', ['Shed Tail', 'Substitute', 'Iron Defense']),
              mon('raichu', '', 'Static', ['Nasty Plot']),
              mon('incineroar', '', 'Intimidate', ['Nasty Plot']),
              mon('sinistcha', '', 'Hospitality', ['Nasty Plot'])];
const BURN = { m: 'flamethrower', t: 0 };

/* ---- SHED-REPEAT. Turn 1 puts the doll up (a quarter of max HP, so the body is at 3/4 and safely
 * ABOVE `ceil(maxhp/2)`); turn 2 clicks Shed Tail into it. The second branch, and only the second. */
const REPEAT = play('SHED-REPEAT', ATK, ORTH, [
  { p1: [ZARD_IDLE, IDLE], p2: [{ m: 'substitute' }, IDLE] },
  { p1: [ZARD_IDLE, IDLE], p2: [{ m: 'shedtail' }, IDLE] },
]);

/* ---- SHED-WEAK. THE BODY PAYS ITS OWN WAY DOWN, and that is deliberate: a Flamethrower into this
 * cast is a one-hit KO (measured — Orthworm 145/145 -> `0 fnt`), and picking an attack that lands in
 * a window is exactly the kind of staging that reads as a fix when it is really a miss. Substitute's
 * cost is `floor(maxhp/4)`, so three dolls walk 145 -> 109 -> 73 -> 37 with no damage estimate
 * anywhere; the doll is broken between each one, because a Substitute clicked into a standing doll
 * refuses and costs nothing. At the end there is NO doll and the body is well under `ceil(maxhp/2)`,
 * so the second branch cannot be what answers and only the third can. */
const WEAK = play('SHED-WEAK', ATK, ORTH, [
  { p1: [ZARD_IDLE, IDLE], p2: [{ m: 'substitute' }, IDLE] },
  { p1: [BURN, IDLE], p2: [ORTH_IDLE, IDLE] },
  { p1: [ZARD_IDLE, IDLE], p2: [{ m: 'substitute' }, IDLE] },
  { p1: [BURN, IDLE], p2: [ORTH_IDLE, IDLE] },
  { p1: [ZARD_IDLE, IDLE], p2: [{ m: 'substitute' }, IDLE] },
  { p1: [BURN, IDLE], p2: [ORTH_IDLE, IDLE] },
  { p1: [ZARD_IDLE, IDLE], p2: [{ m: 'shedtail' }, IDLE] },
]);

/* ---- SHED-NOBENCH, THE CONTROL. `max: 2` keeps exactly two bodies on the side and both are active,
 * so `canSwitch(source.side)` is false and the FIRST branch fires — at FULL HP and with no doll, so
 * neither of the other two clauses can be what answered. The line must stay two fields. */
const NOBENCH = play('SHED-NOBENCH', ATK, ORTH, [
  { p1: [ZARD_IDLE, IDLE], p2: [{ m: 'shedtail' }, IDLE] },
], { optB: { max: 2 } });

/* ==================================================================================================
 * 2. THE JUDGEMENT — the whole `-fail` list in order, never a count
 * ============================================================================================== */
console.log(NL + '1. THE ARMS');
const arms = [['SHED-REPEAT', REPEAT], ['SHED-WEAK', WEAK], ['SHED-NOBENCH', NOBENCH]];
for (const [tag, R] of arms) {
  if (!R.staged) { ok(false, tag + ' — NOT STAGED', R.why); continue; }
  console.log(NL + '  ' + tag);
  console.log('     showdown -fail lines : ' + (R.sdFails.join('   ') || '(none)'));
  console.log('     medicham -fail lines : ' + (R.meFails.join('   ') || '(none)'));
  ok(R.boardDiffs === 0, tag + ' — every board boundary identical',
     R.boardDiffs ? JSON.stringify(R.firstDiffs) : null);
  ok(R.sdFails.length > 0, tag + ' — the authority actually wrote a `-fail` (an arm with none proves nothing)');
  ok(JSON.stringify(R.sdFails) === JSON.stringify(R.meFails),
     tag + ' — the two engines write the SAME `-fail` lines, in order',
     R.div ? 'first protocol split:\n  showdown ' + R.div.sd + '\n  medicham ' + R.div.me : null);
}

/* THE SHAPES, ASSERTED BY NAME, so an arm that agreed by writing nothing cannot pass. */
console.log(NL + '2. THE SHAPES THE ARMS EXIST FOR');
const has = (list, re) => list.some(l => re.test(l));
if (REPEAT.staged) {
  ok(has(REPEAT.sdFails, /^\|-fail\|p2a orthworm\|move shed tail$/),
     'SHED-REPEAT — the authority named the move and carried NO flag', REPEAT.sdFails.join(' | '));
  ok(!has(REPEAT.sdFails, /\[weak\]/),
     'SHED-REPEAT — and it is NOT the `[weak]` branch (this is what separates it from SHED-WEAK)');
}
if (WEAK.staged) {
  ok(has(WEAK.sdFails, /^\|-fail\|p2a orthworm\|move shed tail\|\[weak\]$/),
     'SHED-WEAK — the authority named the move AND carried `[weak]`', WEAK.sdFails.join(' | '));
}
if (NOBENCH.staged) {
  ok(has(NOBENCH.sdFails, /^\|-fail\|p2a orthworm$/),
     'SHED-NOBENCH — the authority wrote the BARE line (the control that must not move)',
     NOBENCH.sdFails.join(' | '));
}

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed.' : 'green — every arm agrees.'));
process.exit(bad ? 1 : 0);
