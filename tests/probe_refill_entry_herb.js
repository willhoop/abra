/* probe_refill_entry_herb.js — THE HERB ANSWERS THE REPLACEMENT'S INTIMIDATE, NOT NEXT TURN'S.
 *
 *   SHOWDOWN_PATH=... node tests/probe_refill_entry_herb.js
 *
 * WHERE THIS CAME FROM. The 2026-08-27 pinned differential (release `d03fb31456e2`, 961 games) has
 * FOUR games whose board parts. One of them is this:
 *
 *     seed ...2654016071 vs ...2654363031   turn 4   protocol_diverged_at_turn 5
 *       p2.party.sneasler.item        medicham "whiteherb"   showdown ""
 *       p2.party.sneasler.boosts.atk  medicham -1            showdown 0
 *
 * Replayed line by line (`engine/replay_one.js`), a Glimmora died at the residual, both sides sent
 * replacements, one of them was a Staraptor, and its Intimidate dropped a Sneasler holding a White
 * Herb. The authority spends the herb before it closes the turn; this engine wrote `|turn|5` first
 * and spent it afterwards:
 *
 *     SD    |-unboost|p2a: Sneasler|atk|1  ->  |-enditem|p2a: Sneasler|White Herb  ->  |turn|5
 *     US    |-unboost|p2a: Sneasler|atk|1  ->  |turn|5  ->  |-enditem|p2a: Sneasler|whiteherb
 *
 * THE ENGINE ALREADY HAD THE PASS AND IT WAS ON THREE DOORS OUT OF FOUR. `data/items.ts` gives the
 * herb `onAnySwitchIn` (priority -2), `onAnyAfterMega`, `onAnyAfterMove` and `onResidual`, and
 * ROADMAP #81 WIRE 11 wired all four — `restoreStatsAll` at the LEAD pass, at the mega, inside
 * `_updateAll` (which is the top of every action and once after the last), and `restoreStatsUpdate`
 * at the residual. What none of those reaches is `refill()`: the post-faint replacement is issued
 * BELOW the residual and BELOW the last action, so an entry ability that fires there had no herb pass
 * after it at all.
 *
 * WHY IT MATTERS BEYOND THE ANNOUNCEMENT — the herb's own header says it: `unburden.onAfterUseItem`
 * doubles Speed the moment the item is spent, so a herb coming off is a SPEED TIER CHANGE. A
 * replacement's Intimidate makes the body it just weakened move first, and until this fix that only
 * happened a turn late. Sneasler's own usage item IS a White Herb.
 *
 * THE FIXTURE IS CONSTRUCTED, NOT FOUND, AND NOTHING IN IT IS TYPED.
 *   - the HERB is the item tagged `restoresStats` (one member, printed);
 *   - the DROPPER is a legal carrier of an ability tagged `onSwitchInDrop` whose `boosts` are
 *     NEGATIVE — the thing the herb answers;
 *   - the KILLER is a zero-damage `userFaints` move with target `normal`, so a body dies at a known
 *     moment with no damage roll anywhere in it;
 *   - BOTH bench bodies on the dying side carry the dropper's ability, because the harness's
 *     forced-switch mirror chooses the replacement and this probe must not depend on which.
 *
 * WHAT IT ASSERTS, out of `board_state.js`'s own rows in both engines at the boundary that closes the
 * replacement's turn: the herb holder has SPENT the item and is back at zero stages, in both engines.
 * It also asserts the arm HAPPENED — a dropper really did arrive in an active slot on that turn, and
 * the authority really did take the herb — because a fixture where nobody died, or where the entrant
 * carried no drop, is green while testing nothing.
 *
 * THE CONTROL IS A CHILD ON `MEDI_REFILL_NO_HERB=1`. The parent FAILS if the knob does not move the
 * outcome: an identical result across a varied knob means the knob is unwired.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_REFILL_NO_HERB === '1';

/* THE PRELOAD IS SELF-APPLIED, SO THIS FILE IS `node tests/<it>.js` AND NOTHING ELSE.
 * `engine/game_differential.js` CUTS A RELEASE INTO THE REAL STORE at require time when `--release`
 * is absent, so a probe against freshly-written bytes has to redirect the store first. Doing that with
 * `-r ./tests/_live_release.js` works and makes the command unrunnable by `engine/register_reality.js`
 * — which only executes a plain `node <repo script>.js [--flags]` — so a row VERIFIED BY this file
 * reads as INSTRUMENT UNRUNNABLE and verifies nothing. Requiring it HERE, before the driver, is the
 * same mechanism: Node's module cache means the instrument's own `require('./engine_release.js')`
 * returns the object this has already wrapped. `-r` still works and does not double-wrap, because the
 * resolved path is the same cache entry. */
require(D('tests', '_live_release.js'));

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));

console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
const HERBS = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('restoresStats'))
  .map(([k, v]) => ({ id: k, uses: v.uses }));
console.log('  items tagged restoresStats         : '
  + (HERBS.map(h => h.id + ' (' + h.uses + ' sheets)').join(', ') || '(none)'));
if (!HERBS.length) { console.log('  NOTHING CARRIES THE TAG — a claim about the artifact.'); process.exit(2); }
const HERB = dex.items.get(HERBS[0].id);
if (!HERB.exists || HERB.isNonstandard) { console.log('  THE HERB IS NOT LEGAL HERE — a claim about the format.'); process.exit(2); }

/* THE DROPPER: an entry ability whose drop is NEGATIVE. `onSwitchInDrop` also carries a
 * once-per-battle member, which would fire on the LEAD and then never again — printed so the choice
 * is visible rather than assumed. */
const DROPPERS = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('onSwitchInDrop'))
  .map(([k, v]) => ({ id: k, p: v.params.onSwitchInDrop }));
console.log('  abilities tagged onSwitchInDrop     :');
for (const d of DROPPERS) console.log('      ' + d.id.padEnd(18) + JSON.stringify(d.p.boosts)
  + (d.p.oncePerBattle ? '   oncePerBattle=' + d.p.oncePerBattle + '  (NOT USABLE — it fires on the lead and never again)' : ''));
const DROP = DROPPERS.find(d => !d.p.oncePerBattle
  && Object.values(d.p.boosts || {}).some(v => v < 0));
if (!DROP) { console.log('  NO REPEATABLE NEGATIVE ENTRY DROP — a claim about the artifact.'); process.exit(2); }
const DROP_STAT = Object.keys(DROP.p.boosts).find(k => DROP.p.boosts[k] < 0);
const DROPPER_NAME = dex.abilities.get(DROP.id).name;
const CARRIERS = POOL.filter(s => Object.values(s.abilities).some(a => norm(a) === DROP.id)
  && LEARNS(s, 'protect'));
if (CARRIERS.length < 2) { console.log('  FEWER THAN TWO LEGAL CARRIERS — a claim about the fixture.'); process.exit(2); }
console.log('  dropper                            : ' + DROPPER_NAME + '  ' + JSON.stringify(DROP.p.boosts)
  + '   legal carriers that learn Protect: ' + CARRIERS.length);

/* THE KILLER — identical derivation to tests/probe_transform_faint_revert.js, and for the same
 * reason: a body has to die at a known moment with no damage roll in the way. */
const KILL = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('userFaints'))
  .map(([k]) => k)
  .filter(k => { const m = dex.moves.get(k); return m.exists && !m.isNonstandard && m.basePower === 0
    && m.target === 'normal' && !(TAGS.moves[k].tags || []).includes('fixedDamage'); })[0];
if (!KILL) { console.log('  NO ZERO-DAMAGE SELF-KO MOVE — a claim about the fixture.'); process.exit(2); }

/* THE SELF-TARGETING HOLD MOVE the victim of the killer clicks, so it neither shields (which would
 * refuse the killer) nor passes (which Showdown refuses outright). */
/* `stallingMove` IS THE FILTER THAT MATTERS AND LEAVING IT OUT COST A WHOLE RUN. Protect's own
 * target is `self`, so a bare "self-targeting status move" walk hands the victim a SHIELD — and a
 * victim shielding itself against the thing under test is fixture error #4 of the six recorded on
 * 2026-08-27. Read off the move rather than by name, so Baneful Bunker and Spiky Shield go with it.
 * `selfSwitch` goes with it for the same class of reason: Baton Pass is a self-targeting status move
 * that takes the body OFF THE FIELD, which ends the fixture a turn early (`Can't pass: Your Aggron
 * must make a move`). Both filters are properties the move declares, not names. */
const SELF_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.flags.charge && !m.stallingMove && !m.selfSwitch
  && !(TAGS.moves[m.id] && (TAGS.moves[m.id].tags || []).includes('userFaints'))).map(m => m.id);

const noDrop = s => Object.values(s.abilities).every(a => norm(a) !== DROP.id);
/* THE DYING BODY. It must learn the killer, hold Protect, and NOT carry the drop itself. */
const DYING = POOL.find(s => LEARNS(s, KILL) && LEARNS(s, 'protect') && noDrop(s));
/* THE HERB HOLDER — the body the replacement's drop lands on. It only has to shield. */
const HOLDER = POOL.map(s => ({ s })).filter(x => LEARNS(x.s, 'protect') && noDrop(x.s)
  && x.s.name !== (DYING && DYING.name))[0];
/* THE KILLER'S VICTIM — it must NOT shield (fixture error #4) and it may NOT pass (Showdown refuses a
 * pass from a body that can act), so it needs a self-targeting status move to spend the turn on. */
const VICTIM = POOL.map(s => ({ s, self: SELF_MOVES.find(mv => LEARNS(s, mv)) }))
  .filter(x => x.self && LEARNS(x.s, 'protect') && noDrop(x.s)
    && x.s.name !== (DYING && DYING.name) && x.s.name !== (HOLDER && HOLDER.s.name))[0];
if (!DYING || !HOLDER || !VICTIM) { console.log('  COULD NOT DERIVE THE THREE BODIES — a claim about the fixture.'); process.exit(2); }
const VICTIM_MOVE = VICTIM.self;
const FILLER = POOL.filter(s => LEARNS(s, 'protect') && noDrop(s)
  && s.name !== DYING.name && s.name !== HOLDER.s.name && s.name !== VICTIM.s.name
  && !CARRIERS.slice(0, 2).some(c => c.name === s.name)).slice(0, 3);
if (FILLER.length < 3) { console.log('  NOT ENOUGH LEGAL FILLER — a claim about the fixture.'); process.exit(2); }

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
/* P1 DIES AND REPLACES. Its LEADS carry no drop, so the herb cannot be spent on the lead pass —
 * which already works and would make this probe green on the wrong door. BOTH bench bodies carry the
 * drop, because the harness picks the replacement and this must not depend on which. */
const SIDE_A = [
  mon(DYING.name, [KILL, 'Protect']),
  mon(FILLER[0].name, ['Protect']),
  mon(CARRIERS[0].name, ['Protect'], '', dex.abilities.get(DROP.id).name),
  mon(CARRIERS[1].name, ['Protect'], '', dex.abilities.get(DROP.id).name),
];
/* P2 HOLDS THE HERB IN SLOT a and never leaves. IT MAY SHIELD FREELY: the drop under test arrives
 * with a SWITCH-IN, not with a move, so Protect does not refuse it — and shielding is what keeps the
 * holder's own stages still. The first draft had the holder clicking a self-boost move, which raised
 * the very stat the drop then lowered, so the stage never went negative and the herb had nothing to
 * answer. The KILLER's victim is slot b, and only that body must avoid Protect. */
const SIDE_B = [
  mon(HOLDER.s.name, ['Protect'], HERB.name),
  mon(VICTIM.s.name, ['Protect', VICTIM_MOVE]),
  mon(FILLER[2].name, ['Protect']),
  mon(FILLER[0].name === CARRIERS[0].name ? CARRIERS[1].name : FILLER[0].name, ['Protect']),
];
console.log('  killer / dying body                : ' + KILL + ' clicked by ' + DYING.name
  + '  aimed at P2 SLOT b (' + VICTIM.s.name + '), which clicks ' + VICTIM_MOVE + ' and never Protect');
console.log('  herb holder                        : ' + HOLDER.s.name + ' holding ' + HERB.name
  + ' in slot a, shielding every turn (a switch-in drop goes through Protect)');
console.log('  P1 (dies, then replaces)           : ' + SIDE_A.map(m => m.species + (m.ability ? '[' + m.ability + ']' : '')).join(', '));
console.log('  P2 (holds the herb in slot a)      : ' + SIDE_B.map(m => m.species).join(', '));
if (SIDE_B.some((m, i) => SIDE_B.findIndex(x => x.species === m.species) !== i)
  || SIDE_A.some((m, i) => SIDE_A.findIndex(x => x.species === m.species) !== i)) {
  console.log('  RED — a side carries the same species twice; Species Clause makes the team illegal.');
  process.exit(1);
}

const a = G.buildPair(SIDE_A), b = G.buildPair(SIDE_B);
if (!a || !b) { console.log('  COULD NOT BUILD THE PAIR — a claim about the fixture.'); process.exit(2); }

/* ---- THE ARM ------------------------------------------------------------------------------------
 * turn 1  everyone holds; nothing on P1's field carries the drop, so the herb is untouched.
 * turn 2  P1a clicks the killer at P2a and DIES. The replacement is issued below the residual, walks
 *         into the empty slot, and its entry drop lands on the herb holder. THAT is the moment.
 * turn 3  everyone holds, so there is a further boundary to read. */
const SCRIPT = [
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
  { p1: [{ m: KILL, t: 1 }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: VICTIM_MOVE }] },
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: VICTIM_MOVE }] },
];
G.resetScriptCounters();
const seen = [];
const r = G.playGame(a, b, 'directed', 'refillherb/' + (CHILD ? 'nopass' : 'pass'), {
  arm: G.ARM_BY_ID.get('middle'),
  script: SCRIPT,
  onBoundary: (snap) => {
    const me = snap.medi.sides.p2.party, sd = snap.sd.sides.p2.party;
    const k = norm(HOLDER.s.name);
    seen.push({ medi: me[k] || null, sd: sd[k] || null,
                mediActive: (snap.medi.sides.p1.active || []).map(x => x && x.species),
                sdActive: (snap.sd.sides.p1.active || []).map(x => x && x.species) });
  },
});
if (r.err) { console.log('  THE GAME THREW: ' + r.err); process.exit(1); }
const SC = G.scriptCounters();
if (SC.moveNotOnRequest) {
  console.log('  RED — ' + SC.moveNotOnRequest + ' scripted click(s) were NOT on the request and became a '
    + 'pass: ' + SC.firstMissing + '. The arm did not run.');
  process.exit(1);
}
if (seen.length < 2) { console.log('  FEWER THAN TWO BOUNDARIES — the replacement turn was never closed.'); process.exit(1); }

let bad = 0;
const CARRIER_KEYS = CARRIERS.slice(0, 2).map(c => norm(c.name));
console.log('\n  === THE HERB HOLDER\'S PARTY ROW AT EVERY BOUNDARY, OUT OF board_state.js ITSELF ===');
seen.forEach((s, i) => {
  const f = x => x ? ('item ' + JSON.stringify(x.item).padEnd(12) + ' ' + DROP_STAT + ' '
    + String((x.boosts || {})[DROP_STAT] == null ? '?' : x.boosts[DROP_STAT])) : '(NO ROW)';
  console.log('   boundary ' + i + '   medicham2 ' + f(s.medi).padEnd(30) + ' showdown ' + f(s.sd)
    + '     P1 field: ' + s.mediActive.join('/') + '  (sd ' + s.sdActive.join('/') + ')');
});

if (process.argv.includes('--dump')) {
  const sdRaw = G.sdStream(G.lastSdLog()), meRaw = r.mediTrace || [];
  console.log('\n  --- SHOWDOWN ---'); sdRaw.forEach((l, i) => console.log('   ' + String(i).padStart(3, '0') + ' ' + l));
  console.log('\n  --- MEDICHAM2 ---'); meRaw.forEach((l, i) => console.log('   ' + String(i).padStart(3, '0') + ' ' + l));
}

/* ---- THE ARM MUST HAVE HAPPENED ----------------------------------------------------------------
 * THE MEASURED BOUNDARY IS FOUND, NOT COUNTED. `onBoundary` fires once for the board BEFORE turn 1
 * as well as after each turn, so an index typed here is off by one — which is exactly how the first
 * draft read boundary 1 (a turn on which nobody had died yet) and reported the arm as absent. The
 * boundary that matters is the FIRST one at which a drop carrier is standing on P1's field. */
const MI = seen.findIndex(s => s.mediActive.some(x => CARRIER_KEYS.includes(x)));
const MEASURED = MI >= 0 ? seen[MI] : seen[seen.length - 1];
console.log('\n  the measured boundary is #' + (MI >= 0 ? MI : '(none — no carrier ever arrived)')
  + ' — the first at which a ' + DROPPER_NAME + ' carrier stands on P1\'s field');
if (!MEASURED.medi || !MEASURED.sd) { console.log('\n  RED — the holder has no party row; nothing was compared.'); process.exit(1); }
const arrivedMe = MEASURED.mediActive.some(x => CARRIER_KEYS.includes(x));
const arrivedSd = MEASURED.sdActive.some(x => CARRIER_KEYS.includes(x));
if (!arrivedMe || !arrivedSd) {
  console.log('\n  RED — NO REPLACEMENT CARRYING ' + DROPPER_NAME + ' REACHED THE FIELD (medicham2 '
    + MEASURED.mediActive.join('/') + ', showdown ' + MEASURED.sdActive.join('/') + '). Nobody died, or '
    + 'the mirror sent a body that carries no drop, so the refill door was never opened.');
  bad++;
}
if (seen[0].sd.item !== norm(HERB.name)) {
  console.log('\n  RED — the authority had ALREADY spent the herb at boundary 0 ("' + seen[0].sd.item
    + '"). Something on P1\'s LEAD dropped a stat, so this measures the lead pass and not the refill.');
  bad++;
}
if (MEASURED.sd.item !== '') {
  console.log('\n  RED — THE AUTHORITY DID NOT SPEND THE HERB on the replacement turn ("'
    + MEASURED.sd.item + '"). There is no divergence to test.');
  bad++;
}
if (bad) console.log('\n RED — ' + bad + ' fixture assertion(s) failed; the verdict below is not trustworthy.');

/* ---- THE VERDICT -------------------------------------------------------------------------------- */
console.log('\n  === THE VERDICT — the herb holder at the boundary that CLOSES the replacement turn ===');
if (CHILD) {
  console.log('  CONTROL ARM (MEDI_REFILL_NO_HERB=1) — this arm asserts nothing about the pass.');
  console.log('    medicham2 : item ' + JSON.stringify(MEASURED.medi.item) + '  ' + DROP_STAT + ' ' + MEASURED.medi.boosts[DROP_STAT]);
  console.log('    showdown  : item ' + JSON.stringify(MEASURED.sd.item) + '  ' + DROP_STAT + ' ' + MEASURED.sd.boosts[DROP_STAT]);
  const parted = MEASURED.medi.item !== MEASURED.sd.item
    || MEASURED.medi.boosts[DROP_STAT] !== MEASURED.sd.boosts[DROP_STAT];
  console.log('    the two engines ' + (parted ? 'PART' : 'agree') + ' on this board under the knob.');
  console.log('__CONTROL__' + JSON.stringify({ item: MEASURED.medi.item, st: MEASURED.medi.boosts[DROP_STAT], parted }));
} else {
  const need = (what, got, want) => {
    const ok = got === want;
    console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + JSON.stringify(got)
      + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')'));
    return ok;
  };
  if (!need('medicham2 has SPENT the herb by the end of that turn', MEASURED.medi.item, '')) bad++;
  if (!need('medicham2 has put the stage back to zero', MEASURED.medi.boosts[DROP_STAT], 0)) bad++;
  if (!need('showdown agrees on the item (the authority — a control on the fixture)', MEASURED.sd.item, '')) bad++;
  if (!need('showdown agrees on the stage', MEASURED.sd.boosts[DROP_STAT], 0)) bad++;
}

if (!CHILD) {
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_REFILL_NO_HERB=1 (the control), in a child ---');
  /* THE PRELOAD IS PASSED DOWN — a child that does not inherit `-r ./tests/_live_release.js` refuses
   * at its own guard and reads as "the knob is not wired" when the knob was never asked. */
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_REFILL_NO_HERB: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + '). Its whole output is above.'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.item !== MEASURED.medi.item || ctl.st !== MEASURED.medi.boosts[DROP_STAT];
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the board: default '
      + JSON.stringify(MEASURED.medi.item + ' / ' + MEASURED.medi.boosts[DROP_STAT])
      + '  vs control ' + JSON.stringify(ctl.item + ' / ' + ctl.st));
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (!ctl.parted) { console.log('  RED    the control arm did NOT part from the authority, so it is not the old behaviour.'); bad++; }
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
