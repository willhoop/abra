/* probe_bounce_accuracy_address.js — A BOUNCED MOVE ROLLS ITS ACCURACY AGAINST THE BODY IT WAS SENT
 * BACK AT, AND THIS ENGINE ROLLED IT AGAINST THE BODY THAT BOUNCED IT. 2026-09-09, batch W.
 *
 *   SHOWDOWN_PATH=... node tests/probe_bounce_accuracy_address.js
 *   SHOWDOWN_PATH=... node tests/probe_bounce_accuracy_address.js --release <id> --only bounce-sleeppowder
 *
 * ================= THE CARD =====================================================================
 *
 * `data/game-differential.json`, release `f6ecf4222048`, 961 games on the pinned pool:
 *
 *     unrelated event mismatch :: |-miss|p1a|p2a <> |-status|p2a|slp|[from]sleeppowder
 *
 * and the game itself (`pair-protect-bust`, seed …bo3-2661562027, turn 4):
 *
 *     agreed    |move|p2a: Vivillon|sleeppowder|p1a: Hatterene
 *               |move|p1a: Hatterene|sleeppowder|p2a: Vivillon|[from] ability: Magic Bounce
 *     showdown  |-miss|p1a: Hatterene|p2a: Vivillon
 *     medicham2 |-status|p2a: Vivillon|slp|[from] move: sleeppowder
 *
 * It read NARRATION-ONLY because Vivillon died to a Dazzling Gleam later in the SAME turn on both
 * engines. It is not narration: a body is ASLEEP on one board and awake on the other.
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * CHAMPIONS DOES NOT REWRITE MAGIC BOUNCE. `data/mods/champions/abilities.ts` does not mention it
 * (grep -c magicbounce -> 0), so the handler is mainline's, `data/abilities.ts:2427-2438`, printed
 * off the live format on every run below:
 *
 *     onTryHitPriority: 1,
 *     onTryHit(target, source, move) {
 *       if (target === source || move.hasBounced || !move.flags['reflectable'] ||
 *           target.isSemiInvulnerable()) return;
 *       const newMove = this.dex.getActiveMove(move.id);
 *       newMove.hasBounced = true;
 *       newMove.pranksterBoosted = false;
 *       this.actions.useMove(newMove, target, { target: source });
 *       return null;
 *     },
 *
 * THREE FACTS FALL OUT OF THAT, AND THE THIRD IS THE DEFECT:
 *
 *   1. `onTryHit` IS STEP 2 OF EIGHT and `hitStepAccuracy` is step 5 (`sim/battle-actions.ts`, the
 *      `hitSteps` array). So the ORIGINAL click never takes an accuracy draw at all when it is
 *      bounced — the target is filtered out three steps above the die.
 *   2. `useMove(newMove, target, {target: source})` is a WHOLE MOVE, not a re-aim. It runs its own
 *      eight steps, so the BOUNCED copy takes the one accuracy draw of the pair, against `source`.
 *   3. `useMoveInner` writes `this.battle.activeTarget = target` for that new move, so the draw's
 *      ADDRESS names the body the move came back at.
 *
 * The differential's middle arm addresses every draw as
 * `FNV1a(seed | turn | category | activeMove.id | activeTarget.side.id + position | nth)`
 * (`engine/game_differential.js`, `midDraw`), so fact 3 is not a detail: it IS the value drawn.
 *
 * ================= WHAT THIS ENGINE DID =========================================================
 *
 * `bounceOff` re-aims the move and returns the user, and the status branch then rolls once —
 * correct in COUNT and wrong in ADDRESS, because `MID_TGT` was written once at the top of the action
 * from the target the CLICK named (`_midWriteActionAddr`) and nothing moved it when the move changed
 * hands. So this engine drew at `…|sleeppowder|p1a…` — the bouncer's slot — where the authority drew
 * at `…|sleeppowder|p2a…`. Two different questions, two different answers, and the same count of
 * draws on both sides, which is why no identity check ever noticed.
 *
 * IT IS AN ADDRESS FIX AND NOT A NEW DRAW. The count of draws is unchanged on both engines; only
 * which cell of the shared hash this one reads moves. That is what keeps it from voiding games.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the same script under the differential's own
 * `middle` pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE
 * EXPECTATION. `MEDI_BOUNCE_KEEPS_SOURCE=1` is the revert knob — the bounced move goes back to
 * being resolved as the CLICKER's and nothing else changes — so a RED arm is one that agrees clean and PARTS under the knob,
 * and a CONTROL is one that agrees under BOTH. The knob is proved to have reached the module the
 * driver played, by a load-time stamp in `MEDFAILS`, before any verdict is read.
 *
 * ================= AND THE RED ARM IS HELD TO A SECOND BAR =======================================
 *
 * "The engines agree" is also what an engine that made EVERY bounced move miss would produce, and
 * that engine would be worse than the one being fixed. So the red arm asserts that its agreed stream
 * contains AT LEAST ONE bounced Sleep Powder that LANDED and AT LEAST ONE that MISSED — the fixture
 * is six turns precisely so both outcomes are in it. Counted off the authority's own stream.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time
 * when `--release` is absent. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_bounce_accuracy_address.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_BOUNCE_KEEPS_SOURCE';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE FIXTURE ------------------------------------------------------------------------------
 * THE CARD'S OWN BODIES. Hatterene is the format's Magic Bounce carrier on that board and Vivillon
 * is the Sleep Powder user; both are taken from the diverging game rather than invented. SHIELD DUST
 * rather than Compound Eyes on Vivillon deliberately: Compound Eyes multiplies accuracy by 1.3 and
 * would take Sleep Powder to 97.5, which is a fixture that can barely miss — the arm would agree by
 * arithmetic instead of by the fix. Hatterene clicks CALM MIND rather than Protect, because Protect
 * refuses a reflectable move before Magic Bounce is ever asked and the arm would then be staging a
 * shield.
 *
 * SIX TURNS, because a bounced Sleep Powder puts the CLICKER to sleep for one or two turns and the
 * script has to outlast that to get a second bounce. It is also what puts both outcomes — a landed
 * bounce and a missed one — inside one arm. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const CM = { m: 'calmmind' };
const SIDE_A = ab => [['hatterene', '', ab, ['Calm Mind', 'Dazzling Gleam']],
                      ['slowbro', '', 'Regenerator', ['Protect']],
                      ['milotic', '', 'Marvel Scale', ['Protect']],
                      ['snorlax', '', 'Thick Fat', ['Protect']]];
const SIDE_B = [['vivillon', '', 'Shield Dust', ['Sleep Powder', 'Protect']],
                ['klefki', '', 'Prankster', ['Protect']],
                ['garchomp', '', 'Rough Skin', ['Protect']],
                ['toxapex', '', 'Regenerator', ['Protect']]];
const TURNS = 6;
const script = t => { const s = []; for (let i = 0; i < TURNS; i++) s.push({ p1: [CM, PROT], p2: [{ m: 'sleeppowder', t }, PROT] }); return s; };

const CASES = [
  { id: 'bounce-sleeppowder', kind: 'red',
    A: SIDE_A('Magic Bounce'), script: script(0),
    wantBothOutcomes: true,
    what: 'THE CARD, REBUILT. Vivillon clicks Sleep Powder at the Magic Bounce Hatterene; the '
        + 'bounced copy comes back at Vivillon and takes the ONE accuracy draw of the pair. The '
        + 'authority addresses that draw at Vivillon\'s slot and this engine addressed it at '
        + 'Hatterene\'s, so the two engines answered different questions with the same number of '
        + 'draws. Six turns, and the arm additionally requires the agreed stream to hold at least '
        + 'one LANDED bounce and at least one MISSED one.' },

  { id: 'bounce-cleared-healer', kind: 'control',
    A: SIDE_A('Healer'), script: script(0),
    what: 'THE KNOB CLEARED EXPLICITLY — the identical board, the identical Vivillon, the identical '
        + 'script, differing in ONE FIELD: Hatterene\'s ability is HEALER (slot 0) instead of MAGIC '
        + 'BOUNCE (slot H). Nothing bounces, the Sleep Powder resolves against Hatterene at '
        + 'Hatterene\'s own address, and `statusBouncedBackAtUser` goes 0 where the red arm reads '
        + 'non-zero. Without this arm "the bounce address moved" and "this fixture never bounced at '
        + 'all" are the same reading, and that mistake has been made in this repository more than '
        + 'once.' },

  { id: 'nobounce-at-the-partner', kind: 'control',
    A: SIDE_A('Magic Bounce'), script: script(1),
    what: 'THE OVER-FIRE CONTROL, AND IT IS THE ONE THIS FIX COULD PLAUSIBLY HAVE BROKEN. The Magic '
        + 'Bounce Hatterene is STILL ON THE FIELD in slot 0 and the identical Sleep Powder is aimed '
        + 'at the Slowbro in slot 1, which does not bounce. A change that re-addressed the die for '
        + 'every status move — rather than only for a move that changed hands — would move this '
        + 'arm\'s draws too and it would part. It must agree clean AND under the knob.' },
];

/* ---- LEGALITY, DERIVED. Nothing above is typed from memory. ------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
for (const c of CASES) for (const row of c.A.concat(SIDE_B)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) {
    console.log('ILLEGAL FIXTURE  ' + row[1] + ' is not in this format'); illegal++;
  }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
  }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE PREMISES, DERIVED ON EVERY RUN --------------------------------------------------------
 * If any of these stops being true the fixture stops staging the mechanic, and this file says so
 * rather than reporting a green arm about nothing. */
{
  const SP = dex.moves.get('sleeppowder');
  const ab = dex.abilities.get('magicbounce');
  const fs = require('fs');
  const champAb = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions',
    'abilities.ts'), 'utf8');
  const overridden = /\bmagicbounce\s*:/.test(champAb);
  console.log('DOES CHAMPIONS REWRITE MAGIC BOUNCE? ' + (overridden ? 'YES' : 'NO')
    + '   (so the handler read above is ' + (overridden ? 'THE WRONG ONE' : 'mainline’s, which is what applies') + ')');
  console.log('sleeppowder: accuracy=' + SP.accuracy + '  category=' + SP.category
    + '  flags=' + JSON.stringify(SP.flags) + '  -> reflectable? ' + !!SP.flags['reflectable']);
  console.log('magicbounce.onTryHitPriority = ' + ab.onTryHitPriority
    + '   (the bounce answers in TryHit, which is step 2 of eight; hitStepAccuracy is step 5)');
  const bad = [];
  if (overridden) bad.push('Champions overrides Magic Bounce, so the derivation above is stale');
  if (!SP.flags['reflectable']) bad.push('Sleep Powder is not reflectable in this format');
  if (SP.accuracy === true || SP.accuracy >= 100) bad.push('Sleep Powder cannot miss in this format, '
    + 'so the address of its accuracy draw is unobservable and this arm would prove nothing');
  if (bad.length) { console.log(NL + 'NOT RUN — ' + bad.join('; ') + '. This is not a pass.'); process.exit(2); }
  /* HOW MANY LEGAL ABILITIES BOUNCE, derived rather than named — if a second one arrives, the fix
   * below covers it by shape (`reflectsStatusMoves`) and this line is how anybody finds out. */
  const bouncers = dex.abilities.all().filter(legal)
    .filter(a => typeof a.onTryHit === 'function' && a.onTryHitPriority === 1
                 && /hasBounced/.test(String(a.onTryHit)));
  console.log('LEGAL ABILITIES THAT BOUNCE A REFLECTABLE MOVE: ' + bouncers.length + ' -> '
    + bouncers.map(a => a.name).join(', '));
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(SIDE_B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_bounce_accuracy_address :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
    restored: (globalThis.MEDFAILS || {}).bounceKeepsAddressRestored || 0 };
}

/* THE TWO OUTCOMES, COUNTED OFF THE AGREED STREAM. `playGame` does not hand the authority's lines
 * back (it returns `mediTrace` and the first divergence), so this counts OUR lines — which is only
 * meaningful because the arm has already asserted `clean.r.div === null`, i.e. that the two streams
 * are the same stream. If that assertion ever fails, this bar is not read.
 * A landed bounce is a slp status on the CLICKER attributed to sleeppowder; a missed one is a
 * `-miss` whose subject is the BOUNCER and whose object is the clicker. */
const landed = lines => lines.filter(L => /^\|-status\|p2a[^|]*\|slp\|/.test(L)).length;
const missed = lines => lines.filter(L => /^\|-miss\|p1a[^|]*\|p2a/.test(L)).length;

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  /* THE CLEAN RUN ONLY. A RED arm's knob run is SUPPOSED to stop short — `playGame` ends the game at
   * the first parting — so requiring the knob run to play out would fail exactly the arms that work.
   * That mistake was made here first and is left recorded rather than silently corrected. */
  const short = clean.r.turns < c.script.length;
  const refused = clean.sc.moveNotOnRequest;
  const sd = clean.r.mediTrace || [];
  const R = { c, clean, brk, short, refused,
    bounced: clean.delta.statusBouncedBackAtUser || 0,
    bouncedK: brk.delta.statusBouncedBackAtUser || 0,
    reaimed: clean.delta.bounceAddressReaimed || 0,
    reaimedK: brk.delta.bounceAddressReaimed || 0,
    landed: landed(sd), missed: missed(sd) };
  results.push(R);

  if (short || refused) { bad++; R.fails = ['FIXTURE — the script did not play out']; continue; }
  const fails = [];
  /* THE KNOB MUST HAVE REACHED THE MODULE THE DRIVER PLAYED, or every verdict below is about one
   * engine loaded twice. */
  if (!(clean.restored === 0 && brk.restored === 1)) fails.push('the knob did not bind');
  /* THE BOUNCE ITSELF, BOTH LOADS. The knob moves an ADDRESS and must never move whether a bounce
   * happened, so these two are equal by construction and asserted rather than assumed. */
  /* THE KNOB IS AN ADDRESS REVERT AND NOT A BOUNCE REVERT, so the bounce must still happen under it.
   * A CONTROL plays all six turns on both loads and the two counts must be EQUAL; a RED arm's knob
   * run is cut short at the parting, so the bar there is that a bounce still happened at all. */
  if (c.kind === 'control' && R.bounced !== R.bouncedK) fails.push('statusBouncedBackAtUser moved '
    + 'under the knob (' + R.bounced + ' -> ' + R.bouncedK + ') — the knob is not an address-only revert');
  if (c.kind === 'red' && R.bouncedK < 1) fails.push('the knob run bounced nothing at all, so it '
    + 'reverted the bounce rather than the address and the arm attributes nothing');
  if (c.kind === 'red') {
    if (R.bounced < 2) fails.push('the fixture staged only ' + R.bounced + ' bounce(s); it needs at '
      + 'least two for the arm to be about the address rather than about one roll');
    if (R.reaimed !== R.bounced) fails.push('bounceAddressReaimed is ' + R.reaimed + ' against '
      + R.bounced + ' bounces — a bounce that did not move its address is the defect still standing');
  } else {
    if (R.bounced !== 0) fails.push('a CONTROL bounced ' + R.bounced + ' time(s); it is meant to '
      + 'stage no bounce at all');
    if (R.reaimed !== 0) fails.push('bounceAddressReaimed fired ' + R.reaimed + ' time(s) on a '
      + 'control — the re-aim is reaching moves that never changed hands');
  }
  if (R.reaimedK !== 0) fails.push('bounceAddressReaimed is ' + R.reaimedK + ' under the knob and '
    + 'must be 0 — the revert is not reverting');
  /* AND THE PROTOCOL STREAMS. */
  if (clean.r.div) fails.push('the engines part on the CLEAN load');
  if (c.kind === 'red' && !brk.r.div) fails.push('the knob did not move the outcome — this arm proves nothing');
  if (c.kind === 'control' && brk.r.div) fails.push('OVER-FIRE — a control moved under the knob');
  /* THE SECOND BAR: agreeing by making every bounce miss is not agreeing. */
  if (c.wantBothOutcomes) {
    if (R.landed < 1) fails.push('the authority\'s stream holds NO landed bounce, so "the engines '
      + 'agree" cannot be told from "every bounced move now misses"');
    if (R.missed < 1) fails.push('the authority\'s stream holds NO missed bounce, so the arm never '
      + 'exercised the outcome the card is about');
  }
  if (fails.length) bad += 1;
  R.fails = fails;
}

for (const R of results) {
  const { c, clean, brk } = R;
  const verdict = R.short ? 'SHORT        ' : R.refused ? 'CLICK REFUSED'
    : (R.fails && R.fails.length) ? 'FAIL         '
    : c.kind === 'red' ? 'RED PROVEN   ' : 'CONTROL HELD ';
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    streams        clean ' + (clean.r.div ? 'PART at reduced line ' + clean.r.div.index : 'AGREE')
    + '   |   knob ' + (brk.r.div ? 'PART at reduced line ' + brk.r.div.index : 'AGREE'));
  console.log('    counters       statusBouncedBackAtUser ' + R.bounced + ' clean / ' + R.bouncedK
    + ' knob   |   bounceAddressReaimed ' + R.reaimed + ' clean / ' + R.reaimedK + ' knob');
  console.log('    agreed stream  bounced Sleep Powders that LANDED ' + R.landed
    + ', that MISSED ' + R.missed);
  console.log('    MEDFAILS stamp clean ' + clean.restored + '   knob ' + brk.restored);
  const d = clean.r.div || brk.r.div;
  if (d) {
    console.log('    ' + (clean.r.div ? 'CLEAN' : 'KNOB') + ' parted:');
    console.log('      showdown  ' + d.sdRaw);
    console.log('      medicham  ' + d.meRaw);
  }
  for (const f of (R.fails || [])) console.log('    >> FAIL: ' + f);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : ONLY ? 'PASS for the arm(s) named by --only. THIS IS NOT THE FILE’S VERDICT.'
  : 'PASS — a bounced move takes its accuracy draw at the address of the body it was sent back at, '
  + 'the knob puts the red arm apart again and moves neither control, the bounce itself is unmoved '
  + 'by the knob, and the agreed stream carries a bounced Sleep Powder that landed AND one that '
  + 'missed');
process.exit(bad ? 1 : 0);
