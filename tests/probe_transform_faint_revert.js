/* probe_transform_faint_revert.js — A CORPSE IS ITSELF AGAIN, NOT WHOEVER IT WAS COPYING.
 *
 *   SHOWDOWN_PATH=... node tests/probe_transform_faint_revert.js
 *
 * WHERE THIS CAME FROM. The 2026-08-27 pinned differential (release `d03fb31456e2`, 961 games) has
 * FOUR games whose board parts, and one of them carries no protocol divergence at all — the hardest
 * shape to diagnose, because the usual entry point is gone:
 *
 *     seed ...2654316929 vs ...2654486674   turn 6   protocol_diverged_at_turn null
 *       p1.party.ditto.species   medicham "metagross"        showdown "ditto"
 *       p1.party.ditto.types     medicham "psychic/steel"    showdown "normal"
 *
 * Replayed line by line (`engine/replay_one.js`), the Ditto led into a Metagross, copied it with
 * Imposter, fought as a Metagross for five turns and then **FAINTED**. It never switched out.
 *
 * THE ENGINE ALREADY HAD THE REVERT AND IT WAS ON THE WRONG DOOR. `imposterRevert()` has existed
 * since ROADMAP #95/#139 and is called from the switch-OUT path only. The authority does not put it
 * there:
 *
 *     sim/battle.ts:2560     faintMessages() -> pokemon.clearVolatile(false)   on the corpse
 *     sim/pokemon.ts:1566    clearVolatile() ends with this.setSpecies(this.baseSpecies)
 *
 * — one call, two doors. A body that LEAVES and a body that DIES both go back to being themselves.
 * `engine/board_state.js`'s own header already knew this was a live seam: it holds `boosts`, `pp`,
 * `ability`, `vol`, `status_counter` and `stall` on a corpse because both engines keep house
 * differently there, and it deliberately does NOT hold `species`, `maxhp` and `types` — *"a body
 * arriving as a different Pokemon is the one thing on a corpse a later board can still be wrong
 * about"*.
 *
 * THE FIXTURE IS CONSTRUCTED, NOT FOUND, AND NOTHING IN IT IS TYPED.
 *   - the COPIER is the legal carrier of the ability tagged `transformsOnEntry`, off data/tags.json;
 *   - the diagonal placement comes from that tag's own `diagonal` param, not from memory;
 *   - the KILLER is a move tagged `userFaints` that deals no damage — so the copier dies on its own
 *     click, with no damage roll and no arm dependence anywhere in the kill;
 *   - the DONOR is a legal species that learns both the killer and Protect, so the copied moveset can
 *     hold a turn and can then end itself.
 *
 * WHAT IT ASSERTS. Read out of `board_state.js`'s OWN party rows, in both engines, at the last turn
 * boundary: the copier's row must carry its BASE species and its BASE typing, in both engines, and
 * the two engines must agree. It also asserts the ARM HAPPENED — the copier really wore another
 * name at an earlier boundary and really is dead at the last one — because a fixture where nothing
 * transformed or nothing died is green while testing nothing, which is six-for-six the way this
 * division's probes have failed.
 *
 * THE CONTROL IS A CHILD ON `MEDI_TRANSFORM_SURVIVES_FAINT=1`, the knob that restores the old
 * behaviour. The parent FAILS if the child does not MEASURE a difference: an identical result across
 * a varied knob means the knob is unwired, not that it does not matter.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_TRANSFORM_SURVIVES_FAINT === '1';

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

/* ---- THE FIXTURE, DERIVED THIS RUN --------------------------------------------------------------- */
const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));

console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
const TRANSFORMERS = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('transformsOnEntry')).map(([k]) => k);
console.log('  abilities tagged transformsOnEntry : ' + (TRANSFORMERS.join(', ') || '(none)'));
if (!TRANSFORMERS.length) { console.log('  NOTHING CARRIES THE TAG — a claim about the artifact, not the engine.'); process.exit(2); }

const COPIER = POOL.find(s => Object.values(s.abilities).some(a => TRANSFORMERS.includes(norm(a))));
if (!COPIER) { console.log('  NO LEGAL CARRIER — a claim about the fixture.'); process.exit(2); }
const COPIER_ABILITY = Object.values(COPIER.abilities).find(a => TRANSFORMERS.includes(norm(a)));
const XPARAM = TAGS.abilities[norm(COPIER_ABILITY)].params.transformsOnEntry;
console.log('  copier                             : ' + COPIER.name + '  ability ' + COPIER_ABILITY
  + '   diagonal=' + XPARAM.diagonal);

/* THE KILLER: a `userFaints` move that deals NO damage, so the kill cannot depend on a damage roll,
 * an arm, a resist berry or an item. Printed in full before one is chosen — a derived membership
 * that over-matches is this division's other standing failure. */
const KILLERS = Object.entries(TAGS.moves || {})
  .filter(([, v]) => (v.tags || []).includes('userFaints'))
  .map(([k, v]) => ({ id: k, faints: v.params.userFaints.faints, bp: dex.moves.get(k).basePower,
                      legal: dex.moves.get(k).exists && !dex.moves.get(k).isNonstandard }));
console.log('  moves tagged userFaints            :');
for (const k of KILLERS) console.log('      ' + k.id.padEnd(16) + ' faints=' + String(k.faints).padEnd(7)
  + ' bp=' + String(k.bp).padEnd(4) + (k.legal ? '' : '  NOT LEGAL HERE'));
/* THREE FILTERS, EACH ANSWERING A WAY THE FIRST DRAFT PICKED A MOVE THAT STAGES SOMETHING ELSE:
 *   bp === 0 and NOT `fixedDamage`  — Final Gambit reads bp 0 and deals the user's whole HP bar, so
 *                                     it can KO the victim and turn this into a damage question;
 *   target === 'normal'             — it must HIT something, so `faints: 'ifHit'` actually fires.
 *                                     Healing Wish targets `self` and answers a different question. */
const KILL = KILLERS.filter(k => k.legal && k.bp === 0
    && !(TAGS.moves[k.id].tags || []).includes('fixedDamage')
    && dex.moves.get(k.id).target === 'normal')
  .map(k => ({ ...k, donors: POOL.filter(s => LEARNS(s, k.id) && LEARNS(s, 'protect')) }))
  .filter(k => k.donors.length)[0];
if (!KILL) { console.log('  NO ZERO-DAMAGE SELF-KO MOVE WITH A LEGAL DONOR — a claim about the fixture.'); process.exit(2); }
/* THE DONOR MUST NOT ITSELF CARRY THE TRANSFORM ABILITY, or the copy is a copy of a copier. */
const DONOR = KILL.donors.find(s => s.name !== COPIER.name
  && Object.values(s.abilities).every(a => !TRANSFORMERS.includes(norm(a))));
if (!DONOR) { console.log('  NO USABLE DONOR — a claim about the fixture.'); process.exit(2); }
console.log('  killer                             : ' + KILL.id + '  (bp 0, faints=' + KILL.faints + ')');
console.log('  donor (what the copier becomes)    : ' + DONOR.name
  + '   base types ' + DONOR.types.join('/') + '   vs copier base types ' + COPIER.types.join('/'));
if (norm(DONOR.types.join('/')) === norm(COPIER.types.join('/'))) {
  console.log('  RED — DONOR AND COPIER SHARE A TYPING, so the `types` leaf cannot show a revert.');
  process.exit(1);
}

/* THE VICTIM must not be able to refuse the killer, so it may NOT click Protect on the killing turn —
 * a victim shielding itself against the thing under test is fixture error #4 of the six recorded on
 * 2026-08-27. But it may not `pass` either: Showdown REFUSES a pass from a body that can act, and the
 * first draft of this file died on exactly that (`Can't pass: Your Abomasnow must make a move`). So it
 * needs a SELF-TARGETING status move — something it can spend a turn on that shields nothing and
 * damages nobody. Derived, not named. */
const SELF_MOVES = dex.moves.all().filter(m => m.exists && !m.isNonstandard && m.category === 'Status'
  && m.target === 'self' && !m.flags.charge && !(TAGS.moves[m.id] && (TAGS.moves[m.id].tags || []).includes('userFaints')))
  .map(m => m.id);
const FILLER = POOL.filter(s => LEARNS(s, 'protect') && s.name !== COPIER.name && s.name !== DONOR.name
  && Object.values(s.abilities).every(a => !TRANSFORMERS.includes(norm(a))))
  .map(s => ({ s, self: SELF_MOVES.find(mv => LEARNS(s, mv)) }))
  .filter(x => x.self).map(x => x.s).slice(0, 3);
if (FILLER.length < 3) { console.log('  NOT ENOUGH LEGAL FILLER — a claim about the fixture.'); process.exit(2); }
const VICTIM_SELF = SELF_MOVES.find(mv => LEARNS(FILLER[0], mv));
console.log('  victim + its hold move             : ' + FILLER[0].name + '  clicks ' + VICTIM_SELF
  + ' on the killing turn (NOT Protect — it must not refuse the killer, and it may not pass)');

const mon = (species, moves, ability) => ({ species, item: '', ability: ability || '', moves });
/* THE COPIER LEADS IN SLOT **a** AND THE DONOR STANDS IN THE FOE'S SLOT **b**, because the tag says
 * the copy is DIAGONAL. Getting this backwards is how probe_party_key_collision first went green on
 * a body it had not copied. */
const SIDE_A = [
  mon(COPIER.name, ['Protect'], COPIER_ABILITY),
  mon(FILLER[0].name, ['Protect']),
  mon(FILLER[1].name, ['Protect']),
  mon(FILLER[2].name, ['Protect']),
];
const SIDE_B = [
  mon(FILLER[0].name, ['Protect', VICTIM_SELF]),
  mon(DONOR.name, [KILL.id, 'Protect']),
  mon(FILLER[1].name, ['Protect']),
  mon(FILLER[2].name, ['Protect']),
];
console.log('  P1 (copier side) : ' + SIDE_A.map(m => m.species).join(', '));
console.log('  P2 (donor side)  : ' + SIDE_B.map(m => m.species).join(', ') + '   (donor in slot b — diagonal)');

const a = G.buildPair(SIDE_A), b = G.buildPair(SIDE_B);
if (!a || !b) { console.log('  COULD NOT BUILD THE PAIR — a claim about the fixture.'); process.exit(2); }

/* ---- THE ARM ------------------------------------------------------------------------------------
 * turn 1  everyone holds. The copier arrives, copies the donor, and now holds the killer + Protect.
 * turn 2  the copier CLICKS THE KILLER at the foe's slot a — which is NOT shielding, deliberately.
 * turn 3  everyone holds again, so there is a boundary AFTER the death to read. */
const SCRIPT = [
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
  { p1: [{ m: KILL.id, t: 0 }, { m: 'protect' }], p2: [{ m: VICTIM_SELF }, { m: 'protect' }] },
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: VICTIM_SELF }, { m: 'protect' }] },
];
G.resetScriptCounters();
const seen = [];
const r = G.playGame(a, b, 'directed', 'xformfaint/' + (CHILD ? 'survives' : 'reverts'), {
  arm: G.ARM_BY_ID.get('middle'),
  script: SCRIPT,
  onBoundary: (snap) => {
    const me = snap.medi.sides.p1.party, sd = snap.sd.sides.p1.party;
    seen.push({ medi: me[norm(COPIER.name)] || null, sd: sd[norm(COPIER.name)] || null,
                mediKeys: Object.keys(me), sdKeys: Object.keys(sd) });
  },
});
if (r.err) { console.log('  THE GAME THREW: ' + r.err); process.exit(1); }
const SC = G.scriptCounters();
if (SC.moveNotOnRequest) {
  console.log('  RED — ' + SC.moveNotOnRequest + ' scripted click(s) were NOT on Showdown\'s request and '
    + 'became a pass: ' + SC.firstMissing + '. The arm did not run.');
  process.exit(1);
}
if (!seen.length) { console.log('  NO TURN BOUNDARY WAS EVER TAKEN — the probe measured nothing.'); process.exit(1); }

let bad = 0;
console.log('\n  === THE COPIER\'S PARTY ROW, AT EVERY BOUNDARY, OUT OF board_state.js ITSELF ===');
seen.forEach((s, i) => {
  const f = x => x ? (x.species + '  ' + x.types + '  hp ' + x.hp + '/' + x.maxhp + (x.fainted ? '  FAINTED' : '')) : '(NO ROW)';
  console.log('   boundary ' + i + '   medicham2 ' + f(s.medi).padEnd(46) + ' showdown ' + f(s.sd));
});

const first = seen[0], last = seen[seen.length - 1];
if (!first.medi || !first.sd || !last.medi || !last.sd) {
  console.log('\n  RED — the copier has no party row in one of the engines; nothing was compared.');
  process.exit(1);
}
/* ---- THE ARM MUST HAVE HAPPENED ---------------------------------------------------------------- */
const renamed = first.medi.species !== norm(COPIER.name) && first.sd.species !== norm(COPIER.name);
if (!renamed) {
  console.log('\n  RED — NOTHING TRANSFORMED (medicham2 "' + first.medi.species + '", showdown "'
    + first.sd.species + '" at boundary 0). The copy never happened, so a revert cannot be tested.');
  bad++;
}
if (renamed && first.medi.species !== norm(DONOR.name)) {
  console.log('\n  RED — the copier took "' + first.medi.species + '", not the donor "' + norm(DONOR.name)
    + '". The diagonal placement is wrong and the fixture is staging a different question.');
  bad++;
}
if (!last.medi.fainted || !last.sd.fainted) {
  console.log('\n  RED — THE COPIER DID NOT DIE (medicham2 fainted=' + last.medi.fainted + ', showdown fainted='
    + last.sd.fainted + '). The killer never resolved, so nothing tested the faint door.');
  bad++;
}
if (bad) { console.log('\n RED — ' + bad + ' fixture assertion(s) failed; the verdict below is not trustworthy.'); }

/* ---- THE VERDICT -------------------------------------------------------------------------------- */
const BASE_SP = norm(COPIER.name);
const BASE_TY = COPIER.types.map(t => norm(t)).sort().join('/');
console.log('\n  === THE VERDICT — the corpse\'s own row at the last boundary ===');
console.log('  the copier\'s BASE identity is  species "' + BASE_SP + '"  types "' + BASE_TY + '"');
const need = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + JSON.stringify(got) + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')'));
  return ok;
};
if (CHILD) {
  /* MEASURED, NOT ASSERTED. Asserting the old behaviour would pin the bug — the same reason
   * probe_party_key_collision's control arm only measures. */
  console.log('  CONTROL ARM (MEDI_TRANSFORM_SURVIVES_FAINT=1) — this arm asserts nothing about the revert.');
  console.log('    medicham2 corpse : species ' + JSON.stringify(last.medi.species) + '  types ' + JSON.stringify(last.medi.types));
  console.log('    showdown  corpse : species ' + JSON.stringify(last.sd.species) + '  types ' + JSON.stringify(last.sd.types));
  const parted = last.medi.species !== last.sd.species || last.medi.types !== last.sd.types;
  console.log('    the two engines ' + (parted ? 'PART' : 'agree') + ' on this corpse under the knob.');
  console.log('__CONTROL__' + JSON.stringify({ sp: last.medi.species, ty: last.medi.types, parted }));
} else {
  if (!need('showdown reverted the corpse\'s species (the authority — a control on the fixture)', last.sd.species, BASE_SP)) bad++;
  if (!need('showdown reverted the corpse\'s types', last.sd.types, BASE_TY)) bad++;
  if (!need('medicham2 reverted the corpse\'s species', last.medi.species, BASE_SP)) bad++;
  if (!need('medicham2 reverted the corpse\'s types', last.medi.types, BASE_TY)) bad++;
}

if (!CHILD) {
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_TRANSFORM_SURVIVES_FAINT=1 (the control), in a child ---');
  /* THE PRELOAD IS PASSED DOWN. A child that does not inherit `-r ./tests/_live_release.js` refuses at
   * its own guard and prints nothing the parent can parse, which reads as "the knob is not wired" when
   * the knob was never asked. That cost a whole diagnosis on 2026-08-27. */
  const pre = [];
  for (const f of (process.execArgv || [])) pre.push(f);
  const c = spawnSync(process.execPath, [...pre, __filename],
    { env: { ...process.env, MEDI_TRANSFORM_SURVIVES_FAINT: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) {
    console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + '). Its whole output is above.');
    bad++;
  } else {
    const ctl = JSON.parse(mark[1]);
    /* THE KNOB MUST MOVE THE OUTCOME. Identical results across a varied knob mean it is unwired. */
    const moved = ctl.sp !== last.medi.species || ctl.ty !== last.medi.types;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the corpse: default '
      + JSON.stringify(last.medi.species + ' / ' + last.medi.types) + '  vs control '
      + JSON.stringify(ctl.sp + ' / ' + ctl.ty));
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (!ctl.parted) {
      console.log('  RED    the control arm did NOT part from the authority, so it is not the old behaviour.');
      bad++;
    }
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
