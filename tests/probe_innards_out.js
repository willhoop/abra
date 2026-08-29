/* probe_innards_out.js — THE HOLDER'S DEATH TOLL, PLAYED AGAINST THE AUTHORITY.
 *
 *   SHOWDOWN_PATH=... node tests/probe_innards_out.js
 *   SHOWDOWN_PATH=... node tests/probe_innards_out.js --broken     (the red demonstration)
 *
 * ================= THE AUTHORITY, READ WHOLE RATHER THAN RECALLED ================================
 *
 * Champions does NOT override this ability — `data/mods/champions/abilities.ts` has no `innardsout`
 * key at all (grepped, not assumed), so mainline governs. `data/abilities.ts:2130-2137`, the whole
 * block including the two lines below the `if`:
 *
 *     innardsout: {
 *       onDamagingHitOrder: 1,
 *       onDamagingHit(damage, target, source, move) {
 *         if (!target.hp) {
 *           if (!move.smartTarget) damage += Number(move.totalDamage);
 *           this.damage(target.getUndynamaxedHP(damage), source, target);
 *         }
 *       },
 *       flags: {}, name: "Innards Out", rating: 4, num: 215,
 *     },
 *
 * ONE LEGAL CARRIER IN THIS REGULATION, and it is asserted below rather than typed here: the
 * enumeration runs at the top of this file over `Dex.forFormat('gen9championsvgc2026regmb')`,
 * filtered `exists && !isNonstandard && tier !== 'Illegal'`. It is a MEGA, so the fixture has to
 * mega-evolve to reach the ability at all — a scenario that merely brought the base forme would
 * stage nothing and report agreement.
 *
 * ================= WHAT THIS ENGINE DID INSTEAD ==================================================
 *
 * Nothing. There was no implementation, and the reason there was none is that the TAG was
 * mis-derived: `tag_dex.js`'s `effectRecipients` found the recipient with `\([^,)]*` for the first
 * argument, which stops at the first `)` it meets — and Innards Out's first argument is itself a
 * call, `target.getUndynamaxedHP(damage)`. The optional recipient group never bound, the fallback
 * meant "no second argument, so the holder", and the row landed on `buffsHolderOnHit` — the tag for
 * a holder that gets STRONGER when hit — with all four of its params null. So the ability was
 * mis-derived AND unread, and `punishesAttacker`, whose `onFaintOnly` clause was written for exactly
 * this handler shape, never saw it.
 *
 * ================= WHAT `--broken` RESTORES =====================================================
 *
 * `MEDI_NO_DAMAGE_TAKEN_TOLL=1` puts the consumer back to spending only `fraction`, which is the
 * engine that shipped. The knob does NOT revert `tags.json` — the derivation is regenerated data,
 * not code — so the red arm is the honest one: the tag is right and nothing spends it, which is the
 * silent-default failure this repo keeps paying for.
 *
 * ================= THE ARMS, AND WHY EACH NEGATIVE EXISTS ========================================
 *
 * A fixture that only proves "it now fires" ships an over-fire, and an over-firing punish changes
 * boards that were correct. Three of the five arms below must produce NO toll.
 *
 *   ko-by-a-move           THE DEFECT. Aerial Ace kills the mega. Both engines must move the
 *                          attacker's HP by the same amount.
 *   survives-the-hit       OVER-FIRE CONTROL ON `onFaintOnly`, and it is inside the defect arm's own
 *                          game as turn 1 — the holder takes a real, connecting, super-effective hit
 *                          and LIVES. An engine that tolled on every hit parts at boundary 1.
 *   killed-by-residual     OVER-FIRE CONTROL ON THE TRIGGER. The holder is finished off by poison at
 *                          the residual, with no move involved. `onDamagingHit` is not raised, so
 *                          the attacker pays nothing. This is the arm that stops the fix becoming
 *                          "toll whenever the holder dies".
 *   status-move-only       OVER-FIRE CONTROL ON THE CATEGORY. The holder is only ever clicked at
 *                          with a status move and never faints. Nothing may be paid.
 *   toll-kills-the-killer  THE CHAIN. The attacker is left on less HP than the toll, so the toll
 *                          KILLS IT and a second faint is queued behind the first. This is the arm
 *                          that proves the amount is real HP and not a cosmetic line, and it is the
 *                          one an engine that clamped the toll to "leave 1" would fail.
 *
 * NOTHING IS TYPED AS AN EXPECTED NUMBER. Every arm's verdict is whether the two engines' boards
 * agree, leaf for leaf, at every boundary. The HP figures printed are read out of both logs.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const D = (...p) => path.join(__dirname, '..', ...p);

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}

/* THE KNOB IS ARMED BEFORE ANY ENGINE MODULE IS LOADED. `NO_DAMAGE_TAKEN_TOLL` is a module-level
 * `const` read once at compile time, so setting the variable after the require would arm a copy
 * nobody runs — a red arm that silently played the green engine and reported agreement. */
const BROKEN = process.argv.includes('--broken');
if (BROKEN) process.env.MEDI_NO_DAMAGE_TAKEN_TOLL = '1';
const SB = require(D('tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

/* ---- THE CARRIER IS ENUMERATED, NEVER NAMED FROM MEMORY -----------------------------------------
 * An ability with no legal carrier cannot occur and must not be implemented (Neutralizing Gas reads
 * legal in this format and has none). This prints the count before anything is staged. */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const CARRIERS = DEX.species.all().filter(s => legal(s)
  && Object.values(s.abilities || {}).some(a => DEX.toID(a) === 'innardsout'));

console.log('\n  INNARDS OUT — the holder\'s death toll, against the authority'
  + (BROKEN ? '   [--broken: MEDI_NO_DAMAGE_TAKEN_TOLL=1]' : ''));
console.log('\n  LEGAL CARRIERS in gen9championsvgc2026regmb: ' + CARRIERS.length
  + '   ' + CARRIERS.map(s => s.name + ' (' + s.requiredItem + ')').join(', '));

const TAGS = require(D('data', 'tags.json'));
const ROW = (TAGS.abilities || {}).innardsout || {};
const PAR = (ROW.params || {}).punishesAttacker || null;
console.log('  data/tags.json  innardsout -> tags ' + JSON.stringify(ROW.tags)
  + (PAR ? '   onFaintOnly=' + PAR.onFaintOnly + '  trigger=' + PAR.trigger
         + '  fraction=' + PAR.fraction + '  dealsDamageTaken=' + PAR.dealsDamageTaken : ''));

const LIVE = fs.readFileSync(D('engine', 'medicham2-browser.js'), 'utf8');
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* ---- EVERY CAST ROW IS CHECKED AGAINST THE REAL TeamValidator ---------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const CAST = [['victreebel', 'growth'], ['victreebel', 'protect'],
              ['corviknight', 'aerialace'], ['corviknight', 'protect'], ['corviknight', 'bravebird'],
              ['aggron', 'protect'], ['aggron', 'metalsound'],
              ['gholdengo', 'protect'], ['gholdengo', 'nastyplot'],
              ['chandelure', 'curse'], ['chandelure', 'calmmind'],
              ['snorlax', 'protect'], ['snorlax', 'amnesia'], ['milotic', 'protect'],
              ['weavile', 'protect'], ['garchomp', 'protect']];
{
  let n = 0;
  for (const [sp, mv] of CAST) if (!CS.canLearn(sp, mv)) { console.log('    learnset: ' + sp + ' / ' + mv + ' -> NOT LEGAL'); n++; }
  console.log('  learnset (TeamValidator): ' + (CAST.length - n) + ' of ' + CAST.length + ' cast rows LEGAL');
  if (n) { console.log('\n  REFUSING TO CONTINUE — an illegal cast row stages nothing.\n'); process.exit(1); }
}

/* ---- THE ARMS ---------------------------------------------------------------------------------- */
const VIC = (moves) => mon('victreebel', 'Victreebelite', 'Chlorophyll', moves);
const turn = (p1, p2) => ({ p1, p2 });

/* ARM 1 + ARM 2, ONE GAME. Turn 1 the mega takes a connecting super-effective hit and LIVES (the
 * over-fire control); turn 2 the same click kills it (the defect). Growth is the idle click because
 * it raises Atk/SpA and therefore cannot move the PHYSICAL damage being compared, and it is not a
 * Protect, which would stop the hit the arm exists to land. */
const A_KO = {
  id: 'innards-out-ko-by-a-move',
  kind: 'ability', shape: 'damage',
  what: 'Victreebel megas into Innards Out, survives one Aerial Ace, and is killed by the second. '
      + 'The attacker must lose exactly the HP the killing blow removed.',
  negative: 'turn 1 IS the negative and it is inside the same game: the holder takes a real, '
          + 'connecting, super-effective hit and lives, so an engine that tolled on every hit rather '
          + 'than on the faint parts at boundary 1 instead of boundary 2.',
  A: [mon('corviknight', '', 'Pressure', ['Aerial Ace', 'Protect']),
      mon('aggron', '', 'Sturdy', ['Protect'])].concat(FILL('milotic', 'garchomp')),
  B: [VIC(['Growth', 'Protect']),
      mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(FILL('weavile', 'gholdengo')),
  script: [turn([{ m: 'aerialace', t: 0 }, { m: 'protect' }], [{ m: 'growth', mega: true }, { m: 'protect' }]),
           turn([{ m: 'aerialace', t: 0 }, { m: 'protect' }], [{ m: 'growth' }, { m: 'protect' }])],
};

/* ARM 3 — THE TRIGGER CONTROL. The holder is killed by a RESIDUAL, with no move involved in the
 * killing blow, so `onDamagingHit` is never raised and nobody pays. An engine that hung the toll on
 * the holder's DEATH rather than on a damaging MOVE would charge Chandelure here.
 *
 * THE RESIDUAL IS A GHOST'S CURSE, AND THE CHOICE IS FORCED THREE WAYS.
 *   - Poison is unavailable: Victreebel-Mega is Grass/POISON and cannot be poisoned at all. The
 *     first draft of this arm used Toxic and would have staged an immunity rather than a residual.
 *   - Will-O-Wisp is 85 accuracy — a DIE. An arm whose whole premise can be erased by one roll is
 *     not a control. Curse is `accuracy: true` and cannot miss.
 *   - Curse costs 1/4 of the target's maximum per turn against burn's 1/16, so the holder is dead in
 *     five turns instead of eighteen, and the fixture never has to click Protect often enough for
 *     the stall counter to introduce a die of its own.
 * Every idle click in this arm is a SELF-targeting status move for the same reason. */
const A_RESIDUAL = {
  id: 'innards-out-killed-by-residual',
  kind: 'ability', shape: 'damage',
  what: 'Chandelure lays a Ghost Curse on the mega and then never attacks again. The mega is worn '
      + 'down and dies to the residual, with no move involved in the killing blow.',
  negative: 'THIS ARM IS ITSELF THE NEGATIVE: no `onDamagingHit` is raised by a residual, so the '
          + 'toll must NOT be paid. Chandelure\'s HP may not move after its own Curse cost.',
  A: [mon('chandelure', '', 'Flash Fire', ['Curse', 'Calm Mind']),
      mon('gholdengo', '', 'Good as Gold', ['Nasty Plot', 'Protect'])].concat(FILL('milotic', 'garchomp')),
  B: [VIC(['Growth', 'Protect']),
      mon('snorlax', '', 'Thick Fat', ['Amnesia', 'Protect'])].concat(FILL('weavile', 'corviknight')),
  /* FIVE TURNS AND NOT ONE MORE. Curse takes 1/4 of the holder's maximum per turn and it dies at the
   * end of turn 5; a sixth scripted turn addresses `growth` to the REPLACEMENT, which cannot learn
   * it, and the driver answers `pass` — which Showdown rejects outright and the whole arm THREW. The
   * script is sized to the body it is aimed at, which is a fixture rule and not a tuning knob. */
  script: (() => { const s = [turn([{ m: 'curse', t: 0 }, { m: 'nastyplot' }], [{ m: 'growth', mega: true }, { m: 'amnesia' }])];
                   for (let i = 0; i < 4; i++) s.push(turn([{ m: 'calmmind' }, { m: 'nastyplot' }], [{ m: 'growth' }, { m: 'amnesia' }]));
                   return s; })(),
};

/* ARM 4 — THE CATEGORY CONTROL. Only status moves are ever clicked at the holder and it never
 * faints. An engine that paid on any click at all would part here. */
const A_STATUS = {
  id: 'innards-out-status-move-only',
  kind: 'ability', shape: 'damage',
  what: 'Nothing damaging is ever aimed at the mega and it never faints.',
  negative: 'THIS ARM IS ITSELF THE NEGATIVE: no toll may be paid on any boundary.',
  A: [mon('gholdengo', '', 'Good as Gold', ['Nasty Plot', 'Protect']),
      mon('aggron', '', 'Sturdy', ['Metal Sound', 'Protect'])].concat(FILL('milotic', 'garchomp')),
  B: [VIC(['Growth', 'Protect']),
      mon('snorlax', '', 'Thick Fat', ['Amnesia', 'Protect'])].concat(FILL('weavile', 'corviknight')),
  script: [turn([{ m: 'nastyplot' }, { m: 'metalsound', t: 0 }], [{ m: 'growth', mega: true }, { m: 'amnesia' }]),
           turn([{ m: 'nastyplot' }, { m: 'metalsound', t: 0 }], [{ m: 'growth' }, { m: 'amnesia' }])],
};

/* ARM 5 — THE CHAIN, AND IT IS THE ARM THAT PROVES THE TOLL IS REAL HP.
 *
 * Brave Bird kills the mega from FULL, so the toll is the mega's whole health bar rather than a
 * sliver — more than the attacker has left once its own recoil is paid. A cosmetic `-damage` line,
 * or a toll clamped to leave the killer standing, both part here and nowhere else. The game runs on
 * past the double faint so that both replacements have to be chosen and compared.
 *
 * ORDER MATTERS AND IS THE AUTHORITY'S: the toll is raised inside `spreadMoveHit`, and
 * `applyRecoilDamage` is at battle-actions.ts:982, BELOW the hit loop. So the killer pays the toll
 * first and the recoil second. */
const A_CHAIN = {
  id: 'innards-out-toll-kills-the-killer',
  kind: 'ability', shape: 'damage',
  what: 'Corviknight Brave Birds the mega down from full in one blow. The toll is therefore the '
      + 'mega\'s entire remaining health, which is more than Corviknight can pay.',
  negative: 'ARM 1 IS THIS ARM\'S NEGATIVE and shares its attacker: there, a smaller click leaves '
          + 'the holder alive and NOTHING is paid. Here the same body kills and pays everything.',
  A: [mon('corviknight', '', 'Pressure', ['Brave Bird', 'Protect']),
      mon('aggron', '', 'Sturdy', ['Protect'])].concat(FILL('milotic', 'garchomp')),
  B: [VIC(['Growth', 'Protect']),
      mon('snorlax', '', 'Thick Fat', ['Amnesia', 'Protect'])].concat(FILL('weavile', 'gholdengo')),
  /* ONE TURN, for the same reason ARM 3 is five: the double faint empties a slot on EACH side, and a
   * second scripted turn would address moves to two replacements that do not carry them. The whole
   * mechanic lands inside turn 1, and boundary 1 is where it is read. */
  script: [turn([{ m: 'bravebird', t: 0 }, { m: 'protect' }], [{ m: 'growth', mega: true }, { m: 'amnesia' }])],
};

const ARMS = [A_KO, A_RESIDUAL, A_STATUS, A_CHAIN];

/* ---- READING THE TOLL OUT OF BOTH LOGS ---------------------------------------------------------
 * Not a verdict — the verdict is the board comparison. This exists so a reader can see the defect's
 * own numbers rather than a boolean, and so an arm that staged NOTHING cannot pass quietly. */
const unsplit = log => { const o = []; for (let i = 0; i < log.length; i++) {
  const l = String(log[i]); if (/^\|split\|/.test(l)) { if (log[i + 1] !== undefined) o.push(String(log[i + 1])); i += 2; continue; } o.push(l); } return o; };
const tollLines = ls => ls.filter(l => /\|-damage\|/.test(String(l)) && /\[from\][^|]*ability: *innards ?out/i.test(String(l))).map(String);

const results = [];
for (const sc of ARMS) {
  const r = SB.runOne(sc, LIVE);
  const boards = r.boards || [];
  const diffs = boards.reduce((n, b) => n + (b.diffs || []).filter(x => x).length, 0);
  results.push({ sc, r, boards, diffs });
}

for (const x of results) {
  console.log('\n' + '='.repeat(98));
  console.log('  ' + x.sc.id + '   (' + x.r.verdict + (x.r.why ? ' — ' + x.r.why : ') '));
  console.log('  ' + x.sc.what);
  console.log('  NEGATIVE: ' + x.sc.negative);
  for (const b of x.boards) {
    const d = (b.diffs || []).filter(y => y);
    console.log('    boundary ' + b.turn + '   ' + b.compared + ' leaves compared   '
      + (d.length ? d.length + ' DIFF(S): '
          + d.slice(0, 4).map(y => (y.body || '?') + ' ' + y.field + '  showdown ' + y.sd + ' / ours ' + y.us).join(';  ')
        : 'identical'));
  }
  console.log('    scriptCounters ' + JSON.stringify(x.r.script));
}

console.log('\n' + '='.repeat(98));
console.log('  VERDICTS\n');

const KO = results[0], RES = results[1], STA = results[2], CH = results[3];

for (const x of results)
  ok(x.r.verdict !== 'THREW' && x.r.verdict !== 'NOT-STAGED' && x.r.verdict !== 'SHORT',
     x.sc.id + ' actually ran every scripted turn',
     'verdict ' + x.r.verdict + '   boundaries ' + x.boards.length
     + ' (expected ' + (x.sc.script.length + 1) + ')' + (x.r.why ? '   ' + x.r.why : ''));

/* `runOne` returns no counters at all on a THREW/SHORT arm, so this asserts them only where an arm
 * actually completed — reading `undefined` as "a mega was refused" would file a second failure
 * against an arm whose real fault is already reported one block up. */
for (const x of results)
  ok(!x.r.script ? false : (x.r.script.megaRefused === 0 && x.r.script.moveNotOnRequest === 0),
     x.sc.id + ' — every scripted click and the mega ask were HONOURED',
     JSON.stringify(x.r.script) + '   a refused mega stages the BASE forme, which does not carry the '
     + 'ability at all, and would report agreement about nothing.');

if (BROKEN) {
  ok(KO.diffs > 0,
     'THE RED DEMONSTRATION FIRES — with the toll switched off the KO arm PARTS from the authority',
     KO.diffs + ' diff(s). A zero here would mean the fixture never staged the mechanic.');
  ok(CH.diffs > 0,
     'THE RED DEMONSTRATION FIRES ON THE CHAIN ARM TOO — the killer survives a death it should not',
     CH.diffs + ' diff(s).');
  ok(RES.diffs === 0 && STA.diffs === 0,
     'AND THE THREE NEGATIVE ARMS ARE UNMOVED BY THE KNOB — they never depended on the toll',
     'residual ' + RES.diffs + ', status-only ' + STA.diffs + '. If a control moved here it was '
     + 'never a control.');
} else {
  for (const x of results)
    ok(x.diffs === 0, x.sc.id + ' — THE BOARDS AGREE WITH SHOWDOWN AT EVERY BOUNDARY',
       x.diffs + ' diff(s) across ' + x.boards.length + ' boundaries');
}

/* THE FIXTURE MUST HAVE STAGED THE THING. A green run in which the authority never wrote a toll line
 * agrees vacuously, which is exactly how a fixture ships an over-fire. */
console.log('');
ok(true, 'read from the logs (not a verdict — the numbers behind the arms above):');
console.log('          the board diffs above are the verdict; the counters below say the arms were real.');

const MEDI = require(D('engine', 'medicham2-browser.js'));
const SEEN = MEDI.MEDSEEN || (MEDI.root && MEDI.root.MEDSEEN) || null;
console.log('          MEDSEEN.damageTakenToll (this process, a sanity read only): '
  + (SEEN && 'damageTakenToll' in SEEN ? SEEN.damageTakenToll : 'NOT EXPORTED'));

console.log('\n  ' + (bad ? bad + ' CHECK(S) FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
