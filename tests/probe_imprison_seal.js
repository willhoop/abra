#!/usr/bin/env node
/* tests/probe_imprison_seal.js — IMPRISON SET A VOLATILE AND SEALED NOTHING
 * ==================================================================================================
 * DOES A FOE'S IMPRISON REFUSE A MOVE THE IMPRISON USER ALSO KNOWS?
 *
 * THE AUTHORITY, `data/moves.ts:9492-9524`, read in full. Champions carries NO `imprison` row — §0
 * greps `data/mods/champions/moves.ts` on every run rather than trusting this sentence:
 *
 *     volatileStatus: 'imprison',
 *     condition: {
 *       noCopy: true,
 *       onStart(target) { this.add('-start', target, 'move: Imprison'); },
 *       onFoeDisableMove(pokemon) {                       <- THE MENU HALF (not wired; see below)
 *         for (const moveSlot of this.effectState.source.moveSlots) {
 *           if (moveSlot.id === 'struggle') continue;
 *           pokemon.disableMove(moveSlot.id, true);
 *         }
 *         pokemon.maybeDisabled = true;
 *       },
 *       onFoeBeforeMovePriority: 4,
 *       onFoeBeforeMove(attacker, defender, move) {       <- THE EXECUTION HALF (this probe)
 *         if (move.id !== 'struggle' && this.effectState.source.hasMove(move.id) && !move.isZOrMaxPowered) {
 *           this.add('cant', attacker, 'move: Imprison', move);
 *           return false;
 *         }
 *       },
 *     },
 *
 * THREE FACTS THIS ENGINE DID NOT HAVE. `data/abra-tags.js` carries the whole rule already —
 * `sealsMoves {turns:null, scope:'both foes', fromUsersOwnMoves:true}` — and NOTHING in
 * medicham2-browser.js read `fromUsersOwnMoves`. The volatile landed (both engines' `vol.imprison`
 * leaf agrees on the staged boards below and in the whole-game differential), and then:
 *   - a foe could still click a move the Imprison user knows;
 *   - it dealt its damage;
 *   - and it spent its PP, which the authority does not (`deductPP` is BELOW the BeforeMove event,
 *     `sim/battle-actions.ts:280-284`).
 *
 * LIVE TODAY, NAMED, ON THE PINNED POOL: game `…-2662961896 vs …-2663516978` of
 * `data/verification/fix-batch-7.json`, board-material row 13 —
 *     showdown  |cant|p1b: Floette|move: Imprison|Dazzling Gleam
 *     medicham  |move|p1b: Floette|dazzlinggleam|p2a: Overqwil
 * and the boards then part on eight leaves including a body that faints on one engine and not the
 * other.
 *
 * THE MEMBERSHIP IS DERIVED AND PRINTED (§0), never a name: `sealsMoves.fromUsersOwnMoves === true`
 * matches EXACTLY ONE move in this format, and the volatile it writes comes from that same move's
 * `statusInflict`, so a second member arriving in a later regulation is picked up with no edit here.
 *
 * WHAT THIS PROBE DOES NOT COVER, said out loud rather than discovered:
 *   - THE MENU HALF (`onFoeDisableMove`). `moveDisabledBy(me, id)` takes ONE BODY and Imprison is a
 *     fact about the FOES, so wiring it is a signature change across five callers. It is also
 *     invisible to the whole-game differential, which supplies every click from Showdown's own
 *     request — so the menu half can neither be measured here nor cost a board there. OWED.
 *   - STRUGGLE'S EXEMPTION. `move.id !== 'struggle'` cannot be staged: the script language has no
 *     word for Struggle and the request only offers it once every slot is empty. The engine carries
 *     the clause and this file asserts it by CODE READING only, which is stated, not hidden.
 *
 * RED-FIRST KNOB: `MEDI_IMPRISON_SEALS_NOTHING=1` restores the pre-fix engine. Under it arm 1 goes
 * RED and arms 2, 3 and 4 stay green.
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

const KNOB = process.env.MEDI_IMPRISON_SEALS_NOTHING === '1';
console.log('\ntests/probe_imprison_seal.js — Imprison set a volatile and sealed nothing');
console.log('  MEDI_IMPRISON_SEALS_NOTHING=' + (KNOB ? '1  (PRE-FIX ENGINE)' : '0'));

/* ---- 0. THE AUTHORITY AND THE MEMBERSHIP, BOTH DERIVED ----------------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard;

console.log('\n0. WHERE THE RULE COMES FROM, AND WHO IT COVERS');
const CHM = fs.readFileSync(process.env.SHOWDOWN_PATH + '/data/mods/champions/moves.ts', 'utf8');
ok(!/\bimprison\s*:/.test(CHM),
   'Champions does not override the `imprison` move, so `data/moves.ts` IS the authority',
   /\bimprison\s*:/.test(CHM) ? 'the mod DOES carry an imprison row — read it, not mainline' : null);

/* THE TAG SHAPE, over the WHOLE move table, printed before anything is believed about it. A rule
 * matched on a name cannot pick up a second member; a rule matched on a shape that over-matches is
 * this project's standing hazard, and the only defence that has worked is showing the membership. */
/* READ IN A SANDBOX, NOT INTO THIS PROCESS'S GLOBALS. `data/abra-tags.js` assigns `window.ABRA_TAGS`,
 * and the first draft of this file created a bare `global.window` to catch it. That is not inert:
 * `data/move-effects.js` writes to `window.MOVE_EFFECTS` WHEN A WINDOW EXISTS and to `globalThis`
 * otherwise, while medicham2's `moveFxTable()` reads back off `globalThis` — so inventing a window
 * made the engine throw `MOVE_EFFECTS not loaded` mid-game and the arm reported THREW, which reads
 * exactly like a broken engine and was a broken probe. */
const vm = require('vm');
const TAGS_SANDBOX = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data', 'abra-tags.js'), 'utf8'), TAGS_SANDBOX,
                { filename: 'data/abra-tags.js' });
const TAGS_DB = TAGS_SANDBOX.window.ABRA_TAGS;
const SEALERS = [];
for (const [id, row] of Object.entries(TAGS_DB.moves)) {
  const p = row.params && row.params.sealsMoves;
  if (p && p.fromUsersOwnMoves === true) SEALERS.push({ id, p, si: row.params.statusInflict });
}
console.log('     every move in this format whose `sealsMoves` seals THE USER\'S OWN MOVES:');
for (const s of SEALERS) console.log('       ' + s.id + '   ' + JSON.stringify(s.p));
console.log('     and the ones that seal something else, which this rule must NOT match:');
for (const [id, row] of Object.entries(TAGS_DB.moves)) {
  const p = row.params && row.params.sealsMoves;
  if (p && p.fromUsersOwnMoves !== true) console.log('       ' + id + '   ' + JSON.stringify(p));
}
ok(SEALERS.length === 1 && SEALERS[0].id === 'imprison',
   'the shape matches EXACTLY ONE move and it is Imprison',
   'matched: ' + SEALERS.map(s => s.id).join(', '));
const VOL = SEALERS.length && SEALERS[0].si && Array.isArray(SEALERS[0].si.effects)
  ? SEALERS[0].si.effects.filter(e => e.to === 'user').map(e => e.volatile) : [];
ok(VOL.length === 1 && VOL[0] === 'imprison',
   'and the volatile it writes on ITS OWN USER is named by the same artifact row',
   'statusInflict -> ' + JSON.stringify(VOL));

/* THE FIXTURE'S TWO MOVES, CHECKED AGAINST THE LEARNSETS RATHER THAN ASSUMED. Arm 1 needs a move
 * BOTH bodies carry; arm 2 needs one the imprisoner does NOT carry, or the control is vacuous. */
function learns(speciesId) {
  let cur = D.species.get(speciesId); const out = {}; const seen = new Set();
  while (cur && cur.exists && !seen.has(cur.id)) {
    seen.add(cur.id);
    const L = D.data.Learnsets[cur.id];
    if (L && L.learnset) for (const k in L.learnset) out[k] = 1;
    cur = cur.prevo ? D.species.get(cur.prevo) : null;
  }
  return out;
}
const LZ = learns('alakazam'), LS = learns('snorlax'), LD = learns('delphox');
ok(!!(LZ.imprison && LZ.shadowball && LS.shadowball && LD.shadowball),
   'the fixture is learnset-legal: Alakazam has Imprison AND Shadow Ball, Snorlax and Delphox have '
   + 'Shadow Ball',
   'alakazam imprison=' + !!LZ.imprison + ' shadowball=' + !!LZ.shadowball
   + '  snorlax shadowball=' + !!LS.shadowball + '  delphox shadowball=' + !!LD.shadowball);
ok(!LZ.icebeam && !!LS.icebeam,
   'and the CONTROL move is one Snorlax has and the imprisoner does NOT — otherwise arm 2 is vacuous',
   'alakazam icebeam=' + !!LZ.icebeam + '  snorlax icebeam=' + !!LS.icebeam);
ok(D.species.get('alakazam').baseStats.spe > D.species.get('snorlax').baseStats.spe,
   'the imprisoner outspeeds the victim, so the Imprison lands BEFORE the victim\'s click resolves — '
   + 'which is the only case a script can express, because the NEXT turn\'s request has the move '
   + 'disabled and Showdown refuses the choice outright',
   'alakazam ' + D.species.get('alakazam').baseStats.spe + ' vs snorlax '
   + D.species.get('snorlax').baseStats.spe);

/* ==================================================================================================
 * THE FOUR BOARDS
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* p1b is DELPHOX and not Gengar on purpose: Gengar's only gen-9 ability is Cursed Body, which writes
 * a Disable of its own and would put a second sealing mechanic on the same board. */
const A_SIDE = () => [mon('alakazam', '', 'Magic Guard', ['Imprison', 'Shadow Ball', 'Protect']),
                      mon('delphox', '', 'Blaze', ['Shadow Ball', 'Protect'])].concat(FILL('milotic', 'toxapex'));
const B_SIDE = () => [mon('snorlax', '', 'Thick Fat', ['Shadow Ball', 'Ice Beam', 'Protect']),
                      mon('kingambit', '', 'Defiant', ['Protect'])].concat(FILL('garchomp', 'corviknight'));

const SCEN = [
  { id: 'imprison-refuses-a-move-the-user-knows',
    kind: 'move', shape: 'the foe\'s click is refused mid-turn',
    census: 'move/sealsMoves — data/moves.ts:9515 `onFoeBeforeMove`',
    what: 'Alakazam (120 base Speed) clicks Imprison and Snorlax (30) clicks Shadow Ball at it in '
        + 'the same turn. Both chose while the move was still legal; the Imprison resolves first, so '
        + 'the authority answers `|cant|p2a: Snorlax|move: Imprison|Shadow Ball`, deals no damage and '
        + 'spends no PP. This engine landed the hit.',
    negative: 'arm 4 is this arm with the Imprison click replaced by Protect — the same Shadow Ball '
            + 'must LAND there, or arm 1 passes on an engine that has simply stopped resolving the move.',
    A: A_SIDE(), B: B_SIDE(),
    script: [
      { p1: [{ m: 'imprison' }, { m: 'protect' }], p2: [{ m: 'shadowball', t: 0 }, { m: 'protect' }] },
    ] },

  { id: 'imprison-does-not-touch-a-move-the-user-lacks',
    kind: 'move', shape: 'THE OVER-FIRE CONTROL — a move outside the user\'s slots is untouched',
    census: 'move/sealsMoves — the `hasMove(move.id)` clause',
    what: 'THE OVER-FIRE CONTROL. The same board, and Snorlax clicks ICE BEAM — which Alakazam does '
        + 'not carry. `this.effectState.source.hasMove(\'icebeam\')` is false, so the authority lets '
        + 'it through and this engine must too. A fix that sealed everything a foe clicked would pass '
        + 'arm 1 and fail here.',
    negative: 'this arm IS a negative for arm 1.',
    A: A_SIDE(), B: B_SIDE(),
    script: [
      { p1: [{ m: 'imprison' }, { m: 'protect' }], p2: [{ m: 'icebeam', t: 0 }, { m: 'protect' }] },
    ] },

  { id: 'imprison-does-not-seal-the-users-own-side',
    kind: 'move', shape: 'THE OVER-FIRE CONTROL — `onFoe*` is FOES ONLY',
    census: 'move/sealsMoves — the `scope: "both foes"` param',
    what: 'THE OVER-FIRE CONTROL. Alakazam Imprisons and its PARTNER Delphox clicks Shadow Ball in '
        + 'the same turn — the very move Alakazam carries. `onFoeBeforeMove` is raised for foes only, '
        + 'so the ally is untouched. A fix keyed on "somebody on the field is Imprisoning" rather '
        + 'than on the SIDE would pass arm 1 and fail here.',
    negative: 'this arm IS a negative for arm 1.',
    A: A_SIDE(), B: B_SIDE(),
    script: [
      { p1: [{ m: 'imprison' }, { m: 'shadowball', t: 0 }], p2: [{ m: 'protect' }, { m: 'protect' }] },
    ] },

  { id: 'no-imprison-and-the-same-click-lands',
    kind: 'move', shape: 'THE VACUITY GUARD — without the Imprison the move works',
    census: 'move/sealsMoves — the standing case',
    what: 'THE VACUITY GUARD. Alakazam clicks Protect instead of Imprison; Snorlax clicks the same '
        + 'Shadow Ball. Nothing seals anything, so the move lands on both engines. Without this arm, '
        + '"IDENTICAL" on arm 1 could mean an engine that refuses Shadow Ball unconditionally.',
    negative: 'this arm IS the negative for arm 1.',
    A: A_SIDE(), B: B_SIDE(),
    script: [
      { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'shadowball', t: 0 }, { m: 'protect' }] },
    ] },
];

/* The counters are module-global and the harness is cached across scenarios, so every assertion below
 * is on a DELTA taken around the one arm it belongs to. A total would let arm 1's refusal vouch for
 * arm 3's silence. */
function counters() {
  const G = SB.harness();
  const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
  return { seen: Object.assign({}, M.MEDSEEN), fails: Object.assign({}, M.MEDFAILS) };
}

console.log('\n1. THE FOUR BOARDS, PLAYED AGAINST THE AUTHORITY');
const LIVE = new Set(['imprison-refuses-a-move-the-user-knows']);
const deltas = {};
for (const sc of SCEN) {
  const c0 = counters();
  const r = SB.runOne(sc);
  const c1 = counters();
  deltas[sc.id] = {
    exec: (c1.seen.imprisonRefusedAtExecution || 0) - (c0.seen.imprisonRefusedAtExecution || 0),
    knob: c1.fails.imprisonSealsNothingRestored,
  };
  const detail = r.verdict === 'IDENTICAL' ? null
    : (r.why ? r.why : r.boards.map(b => (b.unexplained || [])
        .map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us)
                  + ' / authority ' + JSON.stringify(d.sd)).join('\n')).filter(Boolean).join('\n'));
  ok(r.verdict === 'IDENTICAL', sc.id + '  -> ' + r.verdict
     + (KNOB && LIVE.has(sc.id) ? '   [expected RED: the knob is armed]' : ''), detail);
  console.log('          leaves compared ' + (r.compared == null ? '(not staged)' : r.compared)
    + '   script off-request ' + (r.script ? r.script.moveNotOnRequest : '?')
    + '   imprisonRefusedAtExecution +' + deltas[sc.id].exec);
  /* A SCRIPTED CLICK THAT WAS NOT ON THE REQUEST BECOMES A `pass` AND BOTH ENGINES THEN AGREE ABOUT
   * NOTHING (ROADMAP #174). Asserted per arm rather than printed. */
  ok(!r.script || r.script.moveNotOnRequest === 0,
     sc.id + ': every scripted click was on Showdown\'s own request',
     r.script ? JSON.stringify(r.script) : null);
}

/* ==================================================================================================
 * 2. THE ENGINE'S OWN RECEIPT, PER ARM
 * ==================================================================================================
 * "The boards agreed" is what two engines that both ignore Imprison look like. The counter is what
 * says the new refusal is the reason arm 1 agrees — and that it fired on NO other arm. */
console.log('\n2. THE COUNTERS, AS A DELTA AROUND EACH ARM');
for (const sc of SCEN) console.log('     ' + sc.id.padEnd(46) + ' +' + deltas[sc.id].exec);
ok(KNOB ? deltas['imprison-refuses-a-move-the-user-knows'].exec === 0
        : deltas['imprison-refuses-a-move-the-user-knows'].exec === 1,
   'the refusal fired exactly once on the live arm' + (KNOB ? ' — and NOT AT ALL under the knob' : ''),
   'delta=' + deltas['imprison-refuses-a-move-the-user-knows'].exec);
for (const id of ['imprison-does-not-touch-a-move-the-user-lacks',
                  'imprison-does-not-seal-the-users-own-side',
                  'no-imprison-and-the-same-click-lands']) {
  ok(deltas[id].exec === 0, 'it fired ZERO times on ' + id, 'delta=' + deltas[id].exec);
}
ok(KNOB ? deltas['no-imprison-and-the-same-click-lands'].knob === 1
        : deltas['no-imprison-and-the-same-click-lands'].knob === undefined,
   'the restore knob reports its own state, so a probe run with a dead knob cannot read as a pass',
   'imprisonSealsNothingRestored=' + String(deltas['no-imprison-and-the-same-click-lands'].knob));

/* ==================================================================================================
 * 3. THE CLAUSE THAT CANNOT BE STAGED, ASSERTED BY READING THE ENGINE
 * ==================================================================================================
 * `move.id !== 'struggle'`. The script language has no word for Struggle and the request offers it
 * only once every slot is empty, so there is no board here. Asserting the SOURCE carries the clause
 * is weaker than a game and is stated as such — it is here so that deleting the exemption is not
 * silent. */
console.log('\n3. THE STRUGGLE EXEMPTION — SOURCE-READ ONLY, NOT A GAME');
const SRC = fs.readFileSync(path.join(ROOT, 'engine', 'medicham2-browser.js'), 'utf8');
/* The FUNCTION body, bounded at both ends. The first draft split on a marker and fell back to the
 * WHOLE FILE when the marker was missing, so it passed on any engine containing the word `struggle`
 * anywhere — a green check asking nothing, which is the trap this file exists to avoid. */
const FN = /function imprisonSealedBy\([\s\S]*?\n\}/.exec(SRC);
ok(!!FN, 'the engine carries `imprisonSealedBy` — a source read, so a rename fails here loudly rather '
       + 'than passing on the whole file',
   FN ? null : 'the function was not found; this check cannot answer and is therefore red');
ok(!!FN && /mvId\s*===\s*'struggle'/.test(FN[0]),
   'and its body carries the Struggle exemption, which the authority writes at data/moves.ts:9516',
   FN ? FN[0].split('\n').filter(l => /struggle/i.test(l)).join('\n') || '(no struggle line)' : null);

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
