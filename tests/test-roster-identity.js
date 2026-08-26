#!/usr/bin/env node
/* tests/test-roster-identity.js — CAN A BODY BE LOST BECAUSE SOMETHING RENAMED IT MID-GAME?
 *
 *   SHOWDOWN_PATH=... node tests/test-roster-identity.js
 *
 * WHAT THIS MATCHES, AND WHAT WALKS PAST IT — say it here so nobody mistakes it for coverage
 * -------------------------------------------------------------------------------------------
 * IT MATCHES: the decision `engine/game_differential.js` makes when Showdown asks for a replacement
 * and the answer has to be "the body medicham2 put in that slot". It EXECUTES that decision — it
 * does not read the source and it does not pattern-match a spelling. Every arm renames a real
 * medicham2 body the way a real ability renames it and then asks the real exported
 * `mirrorForcedSwitch` for an index.
 *
 * IT DOES NOT MATCH, and these WILL walk past it:
 *   - a second engine, or a second file, asking the same question its own way. This file asks about
 *     ONE decision. `tests/test-mc-key.js` and `tests/test-mc-seal.js` own the MC.mons table; nothing
 *     owns "which roster entry is this" across the repo, and that is a real gap, stated.
 *   - a rename produced by a mechanism `data/tags.json` does not carry a tag for. The membership
 *     below is DERIVED from the artifact and printed on every run for exactly that reason; a new
 *     renaming ability arrives with its tag and is covered, a renaming mechanism with no tag is not.
 *   - a body renamed by a MOVE (Transform is a move as well as an ability). No move in this format's
 *     tag table carries a rename param today; the derivation prints the move sweep's membership so a
 *     future one shows up as a new arm rather than as silence.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `mirrorForcedSwitch` keyed the medicham2 side on `id(body.name)` — DISPLAY STATE. Every one of the
 * seven abilities printed below rewrites that string mid-game, so the lookup missed, the mirror
 * reported `cannot`, and the whole game stopped: three of `tests/staged_board.js`'s twenty-five
 * scenarios (imposter, hungerswitch, roar) ended SHORT rather than diverging, which reads as three
 * broken mechanics and was one broken doorway.
 *
 * This is the FIFTH instance of one class — a species identity read through a mutable or
 * differently-spelled string. `engine/mc_key.js`'s header lists the other four. Every previous fix
 * was A LIST OF WRONG FORMS and two of the four walked past a list that was already written, so this
 * file does not test a spelling: it renames the body and asks whether the ANSWER still comes back.
 *
 * THE CONTROLS, because an arm that cannot fail proves nothing:
 *   fixture   the same body NOT renamed must resolve to the same index — otherwise the roster index
 *             this arm asserts is wrong and the rename arm would be green for the wrong reason.
 *   absent    a body the roster genuinely does not carry must STILL report `cannot`. A resolver that
 *             answers every question is the over-match this project keeps paying for.
 *   fainted   the renamed body's roster entry, made fainted, must STILL report `cannot`. Separates
 *             "found it" from "picked the first thing that was free".
 */
'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..');
const G = require(path.join(ROOT, 'engine', 'game_differential.js'));
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const TAGS = require(path.join(ROOT, 'data', 'tags.json'));
const { Dex, Teams, Battle } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const mon = (species, moves) => ({ species, item: '', ability: '', moves: moves || ['Protect'] });

let bad = 0;
const fail = (arm, why) => { bad++; console.log('  RED   ' + arm.padEnd(34) + why); };
const pass = (arm, why) => console.log('  green ' + arm.padEnd(34) + why);

/* ---- 1. THE MEMBERSHIP, DERIVED AND PRINTED BEFORE IT IS USED --------------------------------
 * A derived tag that over-matches is this repository's standing hazard (`refusesStatusMoves` caught
 * Telepathy; `speedOnItemLoss` caught Sticky Hold). So the set is printed with the tag that put each
 * member in it and the carrier the arm will actually build, every run, before anything is asserted. */
const RENAME_TAGS = ['formeOnHit', 'formeChange', 'formeFollowsWeather', 'formeCycleResidual',
                     'transformsOnEntry', 'formeOnMoveCategory', 'switchInForme'];

function renameShaped(table) {
  const out = [];
  for (const [k, v] of Object.entries(table || {})) {
    const hit = (v.tags || []).filter(t => RENAME_TAGS.includes(t));
    if (hit.length) out.push({ key: k, tags: hit, params: v.params || {} });
  }
  return out;
}

/* THE FORME THE TAG ITSELF NAMES, not a string this file invents. Any param value that reads as a
 * forme of the carrier (`Morpeko-Hangry` under `Morpeko`) is the honest rename to apply; where the
 * tag names none — Imposter copies "facing body", Illusion copies whatever is on the bench — the arm
 * says so and renames to the species it would really become, which is a member of the OTHER side. */
function formesIn(params) {
  const out = [];
  const walk = v => {
    if (typeof v === 'string') { if (/-/.test(v) && dex.species.get(v).exists) out.push(v); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') { Object.values(v).forEach(walk); }
  };
  walk(params);
  return [...new Set(out)];
}

const abil = renameShaped(TAGS.abilities);
const mvRen = renameShaped(TAGS.moves);

console.log('ROSTER IDENTITY — can a renamed body still be asked for by name?');
console.log('  release ' + (G.REL && G.REL.id ? G.REL.id : '(live tree)'));
console.log('\n  THE MEMBERSHIP, derived from data/tags.json (printed before it is used):');
const ARMS = [];
for (const a of abil) {
  const carriers = dex.species.all().filter(s => s.exists && !s.isNonstandard && s.tier !== 'Illegal'
    && Object.values(s.abilities || {}).some(x => id(x) === a.key));
  const base = carriers.find(s => !s.forme) || carriers[0];
  const formes = formesIn(a.params);
  const to = formes.find(f => id(dex.species.get(f).baseSpecies) === id(base && base.name))
          || formes[0] || null;
  console.log('    ' + a.key.padEnd(15) + '[' + a.tags.join(',') + ']  carrier '
    + (base ? base.name : '(none legal)') + '  renames to ' + (to || '(the tag names no forme — the '
      + 'body it copies is on the other side, so the arm uses a foreign species)'));
  if (!base) continue;
  ARMS.push({ ability: a.key, carrier: base.name,
              to: to || 'Clefable',                       /* imposter/illusion: a body from elsewhere */
              declared: !!to });
}
console.log('    moves carrying a rename-shaped tag: ' + (mvRen.length ? mvRen.map(x => x.key).join(', ')
  : 'NONE — so no move arm is staged; a future one appears here rather than silently missing'));

/* ---- 2. THE ARMS ------------------------------------------------------------------------------
 * One real Showdown battle per arm, so the roster this asks about is the authority's own object
 * graph and not a mock of it. A mock would be a second implementation of the thing under test — the
 * failure mode `engine/mc_key.js` records four times over. */
function stage(carrier) {
  const A = [mon('Garchomp', ['Swords Dance', 'Protect']), mon('Clefable', ['Calm Mind', 'Protect']),
             mon('Milotic'), mon('Snorlax')];
  const B = [mon('Talonflame', ['U-turn', 'Protect']), mon('Corviknight', ['Iron Defense', 'Protect']),
             mon(carrier), mon('Toxapex')];
  const pairA = G.buildPair(A), pairB = G.buildPair(B);
  if (!pairA || !pairB) return null;
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(pairA.map(x => x.sd)) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(pairB.map(x => x.sd)) });
  const bodies = G.freshBodies(pairB);
  return { battle, roster: battle.p2.pokemon, bodies, pairB };
}

/* The medicham2 body for `carrier`, moved into active slot 0 exactly as a pivot would leave it. */
function slotZero(st, carrier) {
  const b = st.bodies.find(x => x && id(x._switchKey || x.name) === id(carrier));
  return b;
}

console.log('\n  THE ARMS — the body is renamed, then the real mirror is asked for an index:');
for (const arm of ARMS) {
  const st = stage(arm.carrier);
  if (!st) { fail(arm.ability, 'the fixture would not build — buildPair returned null'); continue; }
  const body = slotZero(st, arm.carrier);
  const other = st.bodies.find(x => x && x !== body && id(x._switchKey || x.name) === 'corviknight');
  if (!body || !other) { fail(arm.ability, 'the fixture has no ' + arm.carrier + ' body to rename'); continue; }
  /* THE EXPECTATION COMES FROM THE FIXTURE, NOT FROM THE RESOLVER. `stage()` puts the carrier third
   * in the team it packs and `side.pokemon` is that order, so `switch 3` is a fact about the
   * fixture. Computing it with the thing under test is how a probe passes for the wrong reason. */
  const want = 2;
  if (id(st.roster[want].set.species) !== id(arm.carrier)) {
    fail(arm.ability, 'the fixture put ' + st.roster[want].set.species + ' third, not ' + arm.carrier); continue;
  }

  /* CONTROL `fixture` — unrenamed, the same call must name the same index. */
  const ctl = G.mirrorForcedSwitch([true, false], [body, other], st.roster);
  if (ctl.picks[0] !== 'switch ' + (want + 1)) {
    fail(arm.ability + '/fixture', 'unrenamed body resolved to "' + ctl.picks[0] + '", wanted switch '
      + (want + 1) + ' — the arm below would be meaningless'); continue;
  }

  /* THE ARM — rename the way the ability renames, then ask again. */
  /* THE SPELLING medicham2 ITSELF WRITES — `pasteKey`'s hyphenated lower-case form, which is what
   * `formeSwap` and the Hunger Switch rename actually leave on the body. Renaming to some other
   * spelling would be this file inventing the defect instead of reproducing it. */
  const before = body.name;
  body.name = String(arm.to).toLowerCase();
  const r = G.mirrorForcedSwitch([true, false], [body, other], st.roster);
  const gotWanted = r.picks[0] === 'switch ' + (want + 1) && r.cannot == null && r.lookupMiss === 0;
  if (!gotWanted) {
    fail(arm.ability, 'renamed ' + before + ' -> ' + body.name + ' and the mirror answered "'
      + r.picks[0] + '"' + (r.cannot ? ' (' + r.cannot + ')' : '') + ' — wanted switch ' + (want + 1));
  } else {
    pass(arm.ability, 'renamed ' + before + ' -> ' + body.name + ', still resolves to switch ' + (want + 1));
  }

  /* CONTROL `fainted` — the renamed body's roster entry is dead, so the mirror must NOT find one.
   * Separates "resolved the identity" from "picked whatever was free". */
  st.roster[want].fainted = true;
  const f = G.mirrorForcedSwitch([true, false], [body, other], st.roster);
  if (f.cannot == null) fail(arm.ability + '/fainted', 'the roster entry was fainted and the mirror '
    + 'still answered "' + f.picks[0] + '" — it is not resolving the identity, it is picking a body');
  st.roster[want].fainted = false;
}

/* ---- THE MEGA ARM, AND IT IS HERE BECAUSE IT WALKED PAST THE FIRST FIX -------------------------
 *
 * The first version of `rosterKey` keyed the authority on `Pokemon#baseSpecies`, on the reading that
 * `formeChange` only writes `this.species`. IT ALSO WRITES `baseSpecies` WHEN THE CHANGE IS
 * PERMANENT, and mega evolution is permanent — so every mega'd body became unaskable and the pinned
 * 961-game run went from 22 parted games to 227, with 70 unmirrorable switches. A rename arm derived
 * from the ABILITY tags could not have seen it: mega is not an ability and carries none of those
 * tags.
 *
 * THIS IS THE ANSWER TO "WOULD A SECOND INSTANCE, SPELLED DIFFERENTLY, WALK PAST WHAT I WROTE".
 * One did, inside the hour, and the only thing that caught it was a 961-game measurement. It fails
 * here in a second instead. The shape it stands for is A FORME CHANGE THE AUTHORITY CALLS
 * PERMANENT — mega today, anything the simulator marks `isPermanent` later. */
{
  const A = [mon('Garchomp', ['Swords Dance', 'Protect']), mon('Clefable', ['Calm Mind', 'Protect']),
             mon('Milotic'), mon('Snorlax')];
  const B = [{ species: 'Tyranitar', item: 'Tyranitarite', ability: 'Sand Stream', moves: ['Protect', 'Crunch'] },
             mon('Corviknight', ['Iron Defense', 'Protect']), mon('Toxapex'), mon('Weavile')];
  const pairA = G.buildPair(A), pairB = G.buildPair(B);
  const battle = new Battle({ formatid: CS.FORMAT, seed: [1, 2, 3, 4] });
  battle.setPlayer('p1', { name: 'A', team: Teams.pack(pairA.map(x => x.sd)) });
  battle.setPlayer('p2', { name: 'B', team: Teams.pack(pairB.map(x => x.sd)) });
  const ttar = battle.p2.pokemon[0];
  if (id(ttar.set.item) !== 'tyranitarite') {
    /* DECLARED, NEVER SILENTLY SKIPPED. `buildPair` strips mega stones under some configurations and
     * an arm that quietly does not run is the silent default this project has a rule about. */
    fail('mega', 'the harness stripped the stone (item "' + ttar.set.item + '"), so no mega can be '
      + 'forced — the arm cannot run and must not be reported as passing');
  } else {
    battle.choose('p1', 'team 1234'); battle.choose('p2', 'team 1234');
    battle.choose('p1', 'move 1, move 1'); battle.choose('p2', 'move 1 mega, move 1');
    if (id(ttar.species.id) !== 'tyranitarmega') {
      fail('mega', 'the fixture never mega evolved (species ' + ttar.species.id + ') — the arm would prove nothing');
    } else {
      const bodies = G.freshBodies(pairB);
      const body = bodies.find(x => x && id(x._switchKey) === 'tyranitar');
      const other = bodies.find(x => x && id(x._switchKey) === 'corviknight');
      const wasActive = ttar.isActive; ttar.isActive = false;   /* so it is a switch CANDIDATE */
      const r = G.mirrorForcedSwitch([true, false], [body, other], battle.p2.pokemon);
      ttar.isActive = wasActive;
      if (r.picks[0] !== 'switch 1' || r.cannot != null) {
        fail('mega', 'after mega (species ' + ttar.species.id + ', baseSpecies ' + ttar.baseSpecies.id
          + ', set.species ' + ttar.set.species + ') the mirror answered "' + r.picks[0] + '"'
          + (r.cannot ? ' (' + r.cannot + ')' : '') + ' — wanted switch 1');
      } else pass('mega', 'a PERMANENT forme change (species ' + ttar.species.id + ', baseSpecies '
        + ttar.baseSpecies.id + ') still resolves to switch 1');
    }
  }
}

/* CONTROL `absent` — a body the roster genuinely does not have must still be refused, once. */
{
  const st = stage('Ditto');
  const body = slotZero(st, 'Ditto');
  const other = st.bodies.find(x => x && x !== body && id(x._switchKey || x.name) === 'corviknight');
  body._switchKey = 'landorustherian'; body.name = 'landorustherian';
  const r = G.mirrorForcedSwitch([true, false], [body, other], st.roster);
  if (r.cannot == null || r.lookupMiss !== 1) {
    fail('absent', 'a species the roster does not carry answered "' + r.picks[0] + '" with lookupMiss '
      + r.lookupMiss + ' — the resolver answers questions it should refuse');
  } else pass('absent', 'a species the roster does not carry is still refused, and counted once');
}

/* ---- 3. THE WHOLE GAME — the doorway the driver actually walks through -------------------------
 * The unit arms above prove the resolver. This proves the driver uses it: a scenario whose game
 * stops early is reported SHORT, which is neither a divergence nor an agreement — it is the
 * instrument declining to answer.
 *
 * WHY `roar-drags-whoever-is-standing-there` IS PRINTED HERE AND NOT ASSERTED. `tests/run-all.js`
 * filed it with the other two as ONE defect, and MEASURING IT SAYS OTHERWISE: its refusal message is
 * BYTE-IDENTICAL before and after this fix — `slot 1 holds corviknight, which showdown HAS but
 * cannot switch in (fainted/active)`, never `does not have under that name`. Nothing was ever
 * renamed in it. It is a TEMPORAL defect in the same mirror and it belongs to its own batch:
 * medicham2 resolves a whole turn at once, Showdown PAUSES mid-turn at U-turn's switch request, and
 * the mirror hands it the end-of-turn occupant (Corviknight, put back by the Roar that runs later)
 * instead of the body medicham2 sent in at the request (Snorlax). `tests/staged_board.js` owns that
 * red and still reports it. Asserting it here would attach one defect's evidence to another's name. */
console.log('\n  THE WHOLE GAME — the staged scenarios that stopped early:');
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const OUT_OF_SCOPE = new Set(['roar-drags-whoever-is-standing-there']);
for (const wanted of ['imposter-copies-the-body-opposite', 'hungerswitch-flips-every-turn',
                      'roar-drags-whoever-is-standing-there']) {
  const sc = SB.SCENARIOS.find(s => s.id === wanted);
  if (!sc) { fail(wanted, 'no such scenario'); continue; }
  const pa = G.buildPair(sc.A), pb = G.buildPair(sc.B);
  const r = G.playGame(pa, pb, 'directed', 'probe:' + wanted, { script: sc.script,
    onBoundary: (snap) => { snap.identical = true; snap.diffs = []; } });
  const full = r.turns === sc.script.length;
  if (OUT_OF_SCOPE.has(wanted)) {
    console.log('  ---   ' + (wanted + ' [NOT THIS DEFECT]').padEnd(34) + (full
      ? 'played all ' + r.turns + ' turns'
      : 'played ' + r.turns + ' of ' + sc.script.length + ' — ' + r.endReason));
    if (/does not have under that name/.test(String(r.endReason))) {
      fail(wanted, 'it refuses on a NAME after all, so it IS this defect and must be asserted here');
    }
    continue;
  }
  if (!full) fail(wanted, 'played ' + r.turns + ' of ' + sc.script.length + ' scripted turns — ' + r.endReason);
  else pass(wanted, 'played all ' + r.turns + ' scripted turns');
}

/* ---- 4. NO READ FELL BACK ON DISPLAY STATE ----------------------------------------------------
 * The resolver's own loud half. A fallback means a stamp is missing somewhere, which is exactly how
 * this class stayed invisible five times; it must read 0 after everything above has run. */
{
  const fb = G.rosterKeyFallbacks();
  if (fb.sd_species || fb.medi_name || fb.neither) {
    fail('no-display-fallback', 'roster identities read from display state: showdown ' + fb.sd_species
      + ', medicham ' + fb.medi_name + ', neither-stamp ' + fb.neither + ' — first: ' + fb.first);
  } else pass('no-display-fallback', 'every roster identity came off a stamp, not off a name');
}

console.log('\n' + (bad ? 'RED — ' + bad + ' arm(s) failed' : 'green — every arm resolved'));
process.exit(bad ? 1 : 0);
