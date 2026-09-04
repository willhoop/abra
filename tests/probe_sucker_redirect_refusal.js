#!/usr/bin/env node
/* tests/probe_sucker_redirect_refusal.js — M5, SUCKER PUNCH INTO A FOLLOW ME / RAGE POWDER USER
 * ==================================================================================================
 * WHICH BODY DOES THE `failsIfTargetNotAttacking` REFUSAL ASK ABOUT — THE ONE THE PLAYER NAMED, OR
 * THE ONE THE MOVE ACTUALLY ARRIVES AT?
 *
 * THE AUTHORITY, RE-OPENED AND CITED, IN THE ORDER IT RUNS. Champions overrides eight files under
 * `/data/mods/champions/`; §0 below greps that directory on every run rather than trusting this
 * paragraph. `scripts.ts` there overrides `formeChange`, `clearVolatile`, `getActionSpeed`,
 * `statModify`, `calculatePP`, `canTerastallize`, `canMegaEvo`, `modifyDamage`, `spreadMoveHit` and
 * `hitStepMoveHitLoop` — and NOT `useMoveInner`, so `sim/battle-actions.ts` is the authority here.
 *
 *   sim/battle-actions.ts:466   const { targets, pressureTargets } = pokemon.getMoveTargets(move, target);
 *   sim/battle-actions.ts:468   target = targets[targets.length - 1];   // "in case of redirection"
 *   sim/pokemon.ts:829-835        if (this.battle.activePerHalf > 1 && !move.tracksTarget) {
 *                                   ... target = this.battle.priorityEvent('RedirectTarget', ...) }
 *   sim/battle-actions.ts:590   singleEvent('Try', move, null, pokemon, targets[0], move)
 *   data/moves.ts:18399         onTry(source, target) { const action = this.queue.willMove(target);
 *                                 const move = action?.choice === 'move' ? action.move : null;
 *                                 if (!move || (move.category === 'Status' && ...)) return false; }
 *
 * SO THE REDIRECT HAPPENS FIRST AND `onTry` IS ASKED OF `targets[0]`. A Follow Me / Rage Powder user
 * moved at priority +2, so by the time Sucker Punch's +1 resolves it is off the queue, `willMove`
 * returns nothing, and the authority prints `-fail`.
 *
 * `medicham2-browser.js` evaluated the refusal against `a.target` — the ORIGINAL aim — and redirected
 * 137 lines later. When the named foe was attacking and its partner was holding a Follow Me, the
 * refusal passed and the redirected hit landed. Four whole-game board divergences (games 14, 46, 69,
 * 70 of the board-material 77): game 70 leaves `p1.party.maushold.hp` 58 for us against 149 untouched
 * for the authority.
 *
 * THIS IS NOT ROADMAP #403 AND MUST NOT UNDO IT. #403 (closed 2026-08-23) is the QUEUE clause —
 * `queueWillMove` asking whether the target still has an outstanding action instead of walking the
 * whole turn. That fix is real, it is still in the file, and arm 4 below is a control over it: with
 * NO redirector on the field, a Sucker Punch into a target that has already moved must still fail.
 *
 * THE FOUR ARMS. Verdicts come from `engine/board_state.js` against the authority's own board;
 * nothing in this file declares an expected HP.
 *
 *   1. followme-draws-the-sucker-punch     the defect. Named foe IS attacking, its partner holds a
 *                                          Follow Me. Authority `-fail`; this engine damaged the
 *                                          redirector.
 *   2. redirect-lands-an-ordinary-attack   CONTROL OVER THE DRAW. Identical board and identical
 *                                          clicks with Night Slash in place of Sucker Punch. Both
 *                                          engines must redirect it and both must damage the
 *                                          redirector — so a red arm 1 accuses the REFUSAL and not
 *                                          the redirection machinery.
 *   3. sucker-punch-lands-with-no-redirector  CONTROL OVER THE FIX. Same board, the partner clicks
 *                                          Protect instead of Follow Me. Sucker Punch must LAND on
 *                                          both engines. A fix that failed the move whenever any
 *                                          partner existed would pass 1 and fail here.
 *   4. sucker-punch-still-fails-into-a-mover  CONTROL OVER #403. No redirector at all; the named foe
 *                                          has already moved. Both engines must refuse. A fix that
 *                                          moved the whole block below the draw and lost the queue
 *                                          clause on the way would pass 1 and fail here.
 *
 * RED-FIRST KNOB: `MEDI_SUCKER_AIMS_PRE_REDIRECT=1` restores the pre-fix reader — the refusal is
 * asked of the aim the action carried rather than the body the move arrives at. Under it arm 1 goes
 * RED and arms 2, 3 and 4 stay green. Any run carrying it also carries a non-zero
 * `MEDFAILS.suckerAimsPreRedirectRestored`.
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const KNOB = process.env.MEDI_SUCKER_AIMS_PRE_REDIRECT === '1';
console.log('\ntests/probe_sucker_redirect_refusal.js — M5 Sucker Punch does not fail into a redirector');
console.log('  MEDI_SUCKER_AIMS_PRE_REDIRECT=' + (KNOB ? '1  (PRE-FIX ENGINE)' : '0'));

/* ---- 0. THE MEMBERSHIP AND THE AUTHORITY, BOTH DERIVED ON EVERY RUN ---------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;

console.log('\n0. WHAT THIS REGULATION ACTUALLY CONTAINS');
/* The refusal class, derived from the handler text rather than from a list typed here. */
const REFUSERS = D.moves.all().filter(m => legal(m) && typeof m.onTry === 'function'
  && /willMove/.test(String(m.onTry)));
console.log('     moves whose onTry asks queue.willMove: '
  + REFUSERS.map(m => m.id + '(prio ' + m.priority + ')').join(', '));
ok(REFUSERS.some(m => m.id === 'suckerpunch'),
   'suckerpunch is in this regulation and its onTry reads queue.willMove',
   REFUSERS.length ? null : 'nothing matched — the class is empty and every arm below is vacuous');

/* The redirectors, and that they outrank Sucker Punch — which is WHY the drawn body has always
 * already moved. Read off the dex, not asserted from memory. */
const DRAW = ['followme', 'ragepowder'].map(id => D.moves.get(id));
for (const m of DRAW) console.log('     ' + m.id + '  legal=' + legal(m) + '  priority=' + m.priority);
const SP = D.moves.get('suckerpunch');
ok(DRAW.every(m => legal(m) && m.priority > SP.priority),
   'both redirectors are legal here and both move BEFORE Sucker Punch',
   'suckerpunch priority ' + SP.priority + '; ' + DRAW.map(m => m.id + ' ' + m.priority).join(', '));

/* Champions does not override useMoveInner, so sim/battle-actions.ts is the citation above. */
const MODDIR = process.env.SHOWDOWN_PATH + '/data/mods/champions/';
const MODSCRIPTS = fs.readFileSync(MODDIR + 'scripts.ts', 'utf8');
ok(!/useMoveInner|getMoveTargets/.test(MODSCRIPTS),
   'Champions overrides neither useMoveInner nor getMoveTargets — sim/ IS the authority for the order',
   /useMoveInner|getMoveTargets/.test(MODSCRIPTS) ? 'the mod DOES override one of them — read it' : null);
const MODMOVES = fs.readFileSync(MODDIR + 'moves.ts', 'utf8');
ok(!/^\ssuckerpunch:/m.test(MODMOVES) && !/\bsuckerpunch\b/.test(MODMOVES),
   'Champions does not override suckerpunch — data/moves.ts:18399 is the handler',
   /suckerpunch/.test(MODMOVES) ? 'the mod carries a suckerpunch row' : null);

/* The bodies. Every move clicked below is checked against the format's own learnset data. */
(async () => {
  const NEED = { kingambit: ['suckerpunch', 'nightslash', 'protect'],
                 maushold:  ['followme', 'protect'],
                 meowscarada: ['nightslash', 'protect', 'knockoff'],
                 clefable:  ['protect'] };
  for (const sp of Object.keys(NEED)) {
    const ld = await D.species.getLearnsetData(sp);
    const l = (ld && ld.learnset) || {};
    const missing = NEED[sp].filter(m => !l[m]);
    ok(legal(D.species.get(sp)) && missing.length === 0,
       sp + ' is legal here and learns ' + NEED[sp].join(', '),
       missing.length ? 'MISSING from its learnset: ' + missing.join(', ') : null);
  }
  main();
})();

/* ==================================================================================================
 * THE FOUR BOARDS
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* One board shape for all four arms — the same six bodies on each side — so the only thing that
 * varies between them is the CLICKS. A probe whose arms differ in their teams cannot attribute a
 * difference to the mechanic. */
const SIDE_A = () => [mon('meowscarada', '', 'Overgrow', ['Night Slash', 'Knock Off', 'Protect']),
                      mon('maushold', '', 'Friend Guard', ['Follow Me', 'Protect'])]
                     .concat(FILL('milotic', 'toxapex'));
const SIDE_B = () => [mon('kingambit', '', 'Defiant', ['Sucker Punch', 'Night Slash', 'Protect']),
                      mon('clefable', '', 'Unaware', ['Protect'])]
                     .concat(FILL('garchomp', 'corviknight'));

const SCEN = [
  { id: 'followme-draws-the-sucker-punch',
    kind: 'move', shape: 'the refusal is asked of the body the move ARRIVES at',
    census: 'move/failsIfTargetNotAttacking — data/moves.ts:18399 onTry, asked of targets[0]',
    what: 'Maushold clicks Follow Me (+2) and resolves first. Kingambit clicks Sucker Punch (+1) at '
        + 'Meowscarada, which IS committing Night Slash, so the aim passes the refusal. The draw '
        + 'then moves the move onto Maushold, which has already spent its action — the authority '
        + 'asks onTry of THAT body, finds no queued move, and prints -fail. This engine asked the '
        + 'question 137 lines earlier and landed the hit.',
    negative: 'arm 3 is this arm with the Follow Me replaced by a Protect: the same Sucker Punch into '
            + 'the same attacking Meowscarada must LAND, so a green here cannot be an engine that '
            + 'refuses Sucker Punch generally.',
    A: SIDE_A(), B: SIDE_B(),
    script: [
      { p1: [{ m: 'nightslash', t: 0 }, { m: 'followme' }],
        p2: [{ m: 'suckerpunch', t: 0 }, { m: 'protect' }] },
    ] },

  { id: 'redirect-lands-an-ordinary-attack',
    kind: 'move', shape: 'CONTROL OVER THE DRAW — the redirection itself must already agree',
    census: 'move/redirects — the draw, with no refusal attached',
    what: 'THE CONTROL FOR ARM 1. Identical bodies, identical Follow Me, and Kingambit clicks NIGHT '
        + 'SLASH instead of Sucker Punch — a move with no onTry at all. Both engines must draw it '
        + 'onto Maushold and both must damage it. If this arm is red the redirection machinery is '
        + 'what differs and arm 1 accuses the wrong thing.',
    negative: 'arm 1 IS this arm with one click changed. The pair is the discriminator: same draw, '
            + 'different move, and only the move that carries onTry may part.',
    A: SIDE_A(), B: SIDE_B(),
    script: [
      { p1: [{ m: 'nightslash', t: 0 }, { m: 'followme' }],
        p2: [{ m: 'nightslash', t: 0 }, { m: 'protect' }] },
    ] },

  { id: 'sucker-punch-lands-with-no-redirector',
    kind: 'move', shape: 'CONTROL OVER THE FIX — the move must still land when nothing draws it',
    census: 'move/failsIfTargetNotAttacking — the standing case',
    what: 'THE CONTROL FOR THE FIX. Maushold clicks Protect rather than Follow Me, so nothing draws. '
        + 'Sucker Punch reaches the Meowscarada it named, which is committing Night Slash, and must '
        + 'LAND on both engines. §2 below reads the authority\'s own HP on this board and asserts it '
        + 'actually fell, because "both engines agree" is also what two engines that both refuse '
        + 'every Sucker Punch look like.',
    negative: 'arm 1 is this arm with the partner\'s click changed from Protect to Follow Me.',
    A: SIDE_A(), B: SIDE_B(),
    script: [
      { p1: [{ m: 'nightslash', t: 0 }, { m: 'protect' }],
        p2: [{ m: 'suckerpunch', t: 0 }, { m: 'protect' }] },
    ] },

  { id: 'sucker-punch-still-fails-into-a-mover',
    kind: 'move', shape: 'CONTROL OVER ROADMAP #403 — the queue clause must survive this change',
    census: 'move/failsIfTargetNotAttacking — the already-moved clause, closed 2026-08-23',
    what: 'THE #403 CONTROL. No redirector: Maushold clicks Protect. Meowscarada clicks PROTECT too '
        + '— a Status move — so the target is not committing a damaging move and the authority '
        + 'refuses the Sucker Punch. Both engines must refuse. #403 closed this road on 2026-08-23 '
        + '(85/85 -> 0/85) and a change that relocated the refusal below the draw could silently '
        + 'undo it; this arm is what would say so.',
    negative: 'arm 3 is the positive twin: the same click into a target that IS attacking, which must '
            + 'land. The two together pin both directions of the queue clause.',
    A: SIDE_A(), B: SIDE_B(),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }],
        p2: [{ m: 'suckerpunch', t: 0 }, { m: 'protect' }] },
    ] },
];

function main() {
console.log('\n1. THE FOUR BOARDS, PLAYED AGAINST THE AUTHORITY');
for (const sc of SCEN) {
  const r = SB.runOne(sc);
  const detail = r.verdict === 'IDENTICAL' ? null
    : (r.why ? r.why : r.boards.map(b => (b.unexplained || [])
        .map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us)
                  + ' / authority ' + JSON.stringify(d.sd)).join('\n')).filter(Boolean).join('\n'));
  const gov = sc.id === 'followme-draws-the-sucker-punch' ? KNOB : false;
  ok(r.verdict === 'IDENTICAL', sc.id + '  -> ' + r.verdict
     + (gov ? '   [expected RED: the knob is armed]' : ''), detail);
  console.log('          leaves compared ' + (r.compared == null ? '(not staged)' : r.compared));
  /* A click the request refused is answered `pass`, and a scenario whose click never happened
   * reports IDENTICAL because both engines passed. This is the driver's own counter. */
  ok(r.script ? r.script.moveNotOnRequest === 0 : false,
     '  every scripted click was actually on the request',
     r.script ? (r.script.moveNotOnRequest ? 'first missing: ' + r.script.firstMissing : null)
              : 'the driver reported no script counters at all');
}

/* ==================================================================================================
 * 2. THE ARMS ARE NOT VACUOUS — read off the AUTHORITY's own board, never recomputed here
 * ==================================================================================================
 * Two facts have to be true on the authority's side or every "IDENTICAL" above is two engines
 * agreeing about nothing:
 *   - on arm 1 the REDIRECTOR must be at FULL HP after the turn (the authority refused the move);
 *   - on arm 2 the same redirector must have LOST HP (the draw is real and does damage);
 *   - on arm 3 the NAMED FOE must have lost HP (Sucker Punch can land at all).
 * These read `snap.sd` — the authority's board — through the same reader the comparator uses. */
console.log('\n2. WHAT THE AUTHORITY\'S OWN BOARD SAYS ON EACH ARM');
const G = SB.harness();
const readHp = (scen, sideKey, slot) => {
  const a = G.buildPair(scen.A), b = G.buildPair(scen.B);
  let out = null;
  const r = G.playGame(a, b, 'directed', 'm5-' + scen.id, { script: scen.script,
    onBoundary: (snap) => {
      try { const s = snap.sd.sides[sideKey].active[slot];
            if (s) out = { hp: s.hp, maxhp: s.maxhp, species: s.species }; }
      catch (e) { console.log('          (could not read the authority leaf: ' + e.message + ')'); }
    } });
  return { err: r.err, out };
};
const a1 = readHp(SCEN[0], 'p1', 1);
ok(!a1.err && a1.out && a1.out.hp === a1.out.maxhp,
   'arm 1: the authority left the Follow Me body UNTOUCHED — it really did refuse the move',
   a1.err || JSON.stringify(a1.out));
const a2 = readHp(SCEN[1], 'p1', 1);
ok(!a2.err && a2.out && a2.out.hp < a2.out.maxhp,
   'arm 2: the authority DID draw the ordinary attack onto that same body and damaged it',
   a2.err || JSON.stringify(a2.out));
const a3 = readHp(SCEN[2], 'p1', 0);
ok(!a3.err && a3.out && a3.out.hp < a3.out.maxhp,
   'arm 3: the authority landed the Sucker Punch on the named foe — the move is not refused always',
   a3.err || JSON.stringify(a3.out));

/* ==================================================================================================
 * 3. THE ENGINE'S OWN RECEIPTS
 * ================================================================================================== */
console.log('\n3. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M.MEDSEEN, F = M.MEDFAILS;
if (S && F) {
  console.log('     suckerRefusedRedirectedTarget ' + S.suckerRefusedRedirectedTarget
    + ' (' + (S.suckerRefusedRedirectedTargetFirst || '-') + ')'
    + '   suckerRefusedAlreadyMovedTarget ' + S.suckerRefusedAlreadyMovedTarget);
  console.log('     suckerAimsPreRedirectRestored ' + F.suckerAimsPreRedirectRestored
    + '   suckerQueueBlindRestored ' + F.suckerQueueBlindRestored);
  ok(KNOB ? F.suckerAimsPreRedirectRestored === 1 : F.suckerAimsPreRedirectRestored === 0,
     'the restore knob reports its own state',
     'suckerAimsPreRedirectRestored=' + F.suckerAimsPreRedirectRestored);
  ok(KNOB || S.suckerRefusedRedirectedTarget > 0,
     'the refusal fired on a body that was NOT the named aim — the redirect road, not the queue road',
     'suckerRefusedRedirectedTarget=' + S.suckerRefusedRedirectedTarget
     + ' — a zero with a Follow Me staged means the check is still reading a.target');
} else {
  ok(false, 'MEDSEEN / MEDFAILS are readable off the frozen engine', 'the release does not export them');
}

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
}
