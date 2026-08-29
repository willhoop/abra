/* probe_shield_refusal_line.js — A SHIELD'S REFUSAL IS `|-activate|<TARGET>|move: Protect` AND NOTHING
 * ELSE, AND SEVEN ACTION KINDS ANSWERED IT WITH `|-fail|<THE MOVER>` OR WITH SILENCE. 2026-08-27.
 *
 *   SHOWDOWN_PATH=... node tests/probe_shield_refusal_line.js
 *   SHOWDOWN_PATH=... node tests/probe_shield_refusal_line.js --only speedswap
 *   SHOWDOWN_PATH=... node tests/probe_shield_refusal_line.js --release <id>
 *
 * ================= IT IS NOT THE SUBSTITUTE'S STATEMENT. IT IS ITS INVERSE ======================
 *
 * The substitute batch earlier today (`tests/probe_substitute_status_step.js`) landed the sentence
 * *"the doll answers `|-fail|` on the MOVER, never `-activate` on the target"*. A shield answers the
 * OTHER WAY ROUND, and the two are decided by two different lines of the authority:
 *
 *   THE DOLL   `substitute.onTryPrimaryHit` -> `getDamage` is `undefined` for a Status move
 *              -> `this.add('-fail', source); this.attrLastMove('[still]')`   (data/moves.ts)
 *   THE SHIELD `protect.condition.onTryHit` (data/moves.ts:13987-14000):
 *                  if (this.checkMoveBypassesProtect(move, source, target)) return;
 *                  ... else { this.add('-activate', target, 'move: Protect'); }
 *                  return this.NOT_FAIL;
 *
 * `NOT_FAIL` is `''`, and `hitStepTryHitEvent` (sim/battle-actions.ts:643-652) writes its `-fail`
 * ONLY on a strict `false`:
 *
 *      const hitResults = this.battle.runEvent('TryHit', targets, pokemon, move);
 *      if (!hitResults.includes(true) && hitResults.includes(false)) {
 *          this.battle.add('-fail', pokemon); this.battle.attrLastMove('[still]');
 *      }
 *      for (const i of targets.keys()) {
 *          if (hitResults[i] !== this.battle.NOT_FAIL) hitResults[i] = hitResults[i] || false;
 *      }
 *
 * `''` is not `false`, and the second loop is what KEEPS it from becoming one. So the whole
 * announcement of a shielded move is the one `-activate` on the target: `trySpreadMoveHit` then
 * filters the target out, breaks the step loop with `targets.length === 0`, and returns `false` with
 * `atLeastOneFailure` still false — which is also why the authority's `moveThisTurnResult` ends
 * **null** rather than false (see §OWED in the report; that half is measured and NOT changed here).
 *
 * Champions overrides `protect` (data/mods/champions/moves.ts:755) with `{inherit: true, pp: 5}` —
 * the PP and nothing else — and overrides no part of `sim/battle-actions.ts`, so this is the rule in
 * this format. Read, not recalled.
 *
 * ================= WHAT THIS ENGINE DID, AND WHY IT WAS TWO CLASSES IN THE DIFFERENTIAL ==========
 *
 * `data/game-differential.json`, release `ccb365985023`, carried two rows with one root:
 *
 *   unrelated event mismatch         :: |-activate|p2b|protect <> |-fail|p1b   (Speed Swap)
 *   extra event emitted by medicham2 :: |-activate|p2a|protect <> |-fail|p1a   (Entrainment)
 *
 * The `<>` is `showdown <> medicham` (`classify()`, engine/game_differential.js:4553) — so THE
 * AUTHORITY prints the `-activate` and WE print the `-fail`. The two classes are one root seen from
 * two sides: `classify` files a divergence as *extra* when our head line turns up again shortly on
 * the authority's stream, and in the Entrainment game a SECOND move was refused by the same shield
 * one line later, so our missing `-activate` reappeared and the lookahead matched it. In the Speed
 * Swap game nothing followed, so the same defect fell through to `unrelated`.
 *
 * ================= THE SITES, AND THE THREE ANSWERS THEY GAVE FOR ONE FACT ======================
 *
 * `shieldRefuses()` is one function and thirteen callers read it. Ten announced the `-activate`.
 * SEVEN did not, and they disagreed with each other about what to do instead:
 *
 *     statrewire   Speed Swap / Power Split / Guard Split      `mvFail(m)`  ->  |-fail|<mover>
 *     abilitywrite Entrainment / Worry Seed / Simple Beam      `mvFail(m)`  ->  |-fail|<mover>
 *     abilitycopy  (Role Play — no `protect` flag, unreachable) `mvFail(m)`
 *     reorder      Quash                                       `mvFail(m)`  ->  |-fail|<mover>
 *     abilityswap  Skill Swap                                  silence
 *     typechange   Soak / Trick-or-Treat / Magic Powder / …    silence
 *     pploss       Spite                                       silence
 *
 * ROADMAP #241 SAW THIS AND FILED IT IN WRITING: its header says the hoist covers "the two refusals
 * that answer at Showdown's onTryHit step, and leaves Protect, the move-class immunities and the
 * powder rule where they are." This is the Protect half of that deferral.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line. Both engines play the identical script under the differential's
 * own pin and the two protocol streams are compared; the pass is that they do not part. SHOWDOWN IS
 * THE EXPECTATION. `MEDI_SHIELD_REFUSAL_UNANNOUNCED=1` restores the OLD answer at each of the seven
 * sites — the `mvFail` where there was a `mvFail` and the silence where there was silence, because a
 * revert that "tidied" them into one shape would not be one — and it stamps
 * `MEDFAILS.shieldRefusalUnannouncedRestored` at MODULE LOAD, which every arm asserts present on the
 * knob load and absent on the clean one.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* BEFORE THE DRIVER, NEVER AFTER — `game_differential.js` CUTS a release at its own require time when
 * `--release` is absent, and a bare `node <file>` would write that cut into the real store. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_shield_refusal_line.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_SHIELD_REFUSAL_UNANNOUNCED';

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

/* ---- SCENARIO SUGAR ----------------------------------------------------------------------------
 * ONE TURN. Protect is priority +4, so the shield is standing before any move under test resolves
 * whatever the speeds are — no speed assumption is made anywhere in this file. Every filler slot
 * also clicks Protect, which is safe here because `willAct()` is true for all three of them: the
 * move under test is still queued behind them at priority 0. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const CM = { m: 'calmmind' };

/* THE SHIELD HOLDER, and every arm shares it so nothing but the CLICK differs between them.
 * Alakazam, Inner Focus, no item. Psychic single type: not Dark (Prankster), not Water (Soak would
 * refuse for a second reason), not Ghost, and Inner Focus carries none of `cantsuppress`,
 * `noentrain` or `failskillswap` — so no arm below has a refusal reason except the shield, and the
 * file derives and prints that count for every arm rather than asserting it in prose. */
const ZAM = ['alakazam', '', 'Inner Focus', ['Protect', 'Calm Mind']];
const WALL_A = [['clefable', '', 'Unaware', ['Protect']], ['milotic', '', 'Marvel Scale', ['Protect']],
  ['snorlax', '', 'Thick Fat', ['Protect']]];
const WALL_B = [['garchomp', '', 'Rough Skin', ['Protect']], ['toxapex', '', 'Regenerator', ['Protect']],
  ['corviknight', '', 'Pressure', ['Protect']]];

const mover = (sp, ab, mv) => [[sp, '', ab, [mv, 'Protect']]].concat(WALL_B);

/* p1a raises the shield (or clicks Calm Mind on the cleared control); p2a clicks the move at p1a. */
const AT = (p1a, mv) => [{ p1: [p1a, PROT], p2: [{ m: mv, t: 0 }, PROT] }];

const CASES = [
  /* ---- THE SEVEN SITES. Three answered `|-fail|<mover>`, four answered nothing. --------------- */
  { id: 'speedswap', kind: 'red', A: [ZAM].concat(WALL_A), B: mover('emolga', 'Static', 'Speed Swap'),
    script: AT(PROT, 'speedswap'), mv: 'speedswap',
    what: 'THE FIRST OF THE TWO POOL ROWS — `statrewire`. `_ok` folds the shield in and `if(!_ok)'
        + '{mvFail(m)}` names the MOVER. Emolga rather than Alakazam so the two bodies cannot be '
        + 'confused in the stream, and Static is inert against a body that never makes contact.' },

  { id: 'entrainment', kind: 'red', A: [ZAM].concat(WALL_A), B: mover('hawlucha', 'Limber', 'Entrainment'),
    script: AT(PROT, 'entrainment'), mv: 'entrainment',
    what: 'THE SECOND POOL ROW — `abilitywrite`, and the SAME pair of species the pool game used. '
        + 'Limber is entrainable and is not Inner Focus, so the move would land if the shield were '
        + 'not there; that is what makes the shield the only reason.' },

  { id: 'worryseed', kind: 'red', A: [ZAM].concat(WALL_A), B: mover('venusaur', 'Overgrow', 'Worry Seed'),
    script: AT(PROT, 'worryseed'), mv: 'worryseed',
    what: 'THE SAME BRANCH THROUGH ITS BUSIEST MEMBER (129 corpus uses against Entrainment\'s 99). '
        + 'Inner Focus is neither Truant nor Insomnia, so Worry Seed\'s own `onTryImmunity` — which '
        + 'answers `-immune` and is a DIFFERENT refusal — cannot fire and confuse the arm.' },

  { id: 'skillswap', kind: 'red', A: [ZAM].concat(WALL_A), B: mover('slowbro', 'Oblivious', 'Skill Swap'),
    script: AT(PROT, 'skillswap'), mv: 'skillswap',
    what: 'THE SILENT SHAPE — `abilityswap` wraps the whole rewrite in `if(_ok){...}` with no else, '
        + 'so a shielded Skill Swap printed NOTHING. Oblivious and Inner Focus are both swappable '
        + 'and different, so the swap would happen but for the shield.' },

  { id: 'soak', kind: 'red', A: [ZAM].concat(WALL_A), B: mover('pelipper', 'Keen Eye', 'Soak'),
    script: AT(PROT, 'soak'), mv: 'soak',
    what: 'A SECOND SILENT SITE — `typechange`, the busiest family here (Soak alone is 203 uses). '
        + 'Keen Eye rather than Drizzle so no weather line enters the stream. Alakazam is pure '
        + 'Psychic, so Soak\'s own exact-typing refusal cannot fire.' },

  { id: 'spite', kind: 'red', A: [ZAM].concat(WALL_A), B: mover('umbreon', 'Inner Focus', 'Spite'),
    script: AT(PROT, 'spite'), mv: 'spite',
    what: 'A THIRD SILENT SITE — `pploss`. The target clicked Protect, so it HAS a last move and '
        + 'Spite\'s `failsIfNothingDeducted` cannot fire: the shield is the only thing in the way.' },

  { id: 'quash', kind: 'red', A: [ZAM].concat(WALL_A), B: mover('oranguru', 'Inner Focus', 'Quash'),
    script: AT(PROT, 'quash'), mv: 'quash',
    what: 'THE `reorder` SITE, AND IT IS THE ONE FIXTURE THAT CANNOT BE MADE SINGLE-REASON — '
        + 'Protect is priority +4, so the shield holder has ALWAYS acted by the time Quash resolves '
        + 'and `unresolved.has(t)` is false too. In the AUTHORITY there is still exactly one reason: '
        + 'Quash\'s `willMove` test lives in its `onHit`, six steps below the shield. Declared here '
        + 'rather than hidden, and it is why this arm is reported with `secondReason` set.',
    secondReason: 'the shield holder has already acted (Protect is +4), which is `reorder`\'s own '
                + 'second refusal — unreachable above it in the authority, reachable below it here' },

  /* ---- THE STATE HALF, TURNED INTO A PROTOCOL QUESTION SO IT CAN BE MEASURED AT ALL ----------- */
  { id: 'tantrum-after-shield', kind: 'red',
    A: [['alakazam', '', 'Inner Focus', ['Protect', 'Calm Mind']],
        ['clefable', '', 'Unaware', ['Protect', 'Calm Mind']]].concat(WALL_A.slice(1)),
    B: [['venusaur', '', 'Overgrow', ['Worry Seed', 'Stomping Tantrum', 'Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect', 'Swords Dance']]].concat(WALL_B.slice(1)),
    script: [{ p1: [PROT, PROT], p2: [{ m: 'worryseed', t: 0 }, PROT] },
             { p1: [CM, CM], p2: [{ m: 'stompingtantrum', t: 0 }, { m: 'swordsdance' }] }],
    mv: 'worryseed', wantClean: { powerDoubledAfterFailure: 0 },
    what: 'THE SECOND HALF OF `mvFail`, WHICH IS NOT A LINE. `mvFail(mon)` is '
        + '`{mon._mvRes = false; TR.fail(mon)}` — it writes STATE as well, and `moveThisTurnResult` '
        + 'is what Stomping Tantrum\'s doubler reads on the FOLLOWING turn (data/moves.ts:18048). '
        + 'The authority ends a shielded move with that field at **null** (`trySpreadMoveHit`: '
        + '`if (!moveResult && !atLeastOneFailure) pokemon.moveThisTurnResult = null`), so it does '
        + 'NOT double; we were writing `false`, so it did. Turn 1 is the shielded Worry Seed and '
        + 'turn 2 is the same Venusaur\'s Stomping Tantrum into the same Alakazam with the shield '
        + 'down — a WRONG BASE POWER, visible as a `|-damage|` line, which is why this arm exists '
        + 'instead of a field read: `engine/board_state.js` compares no move-result field at all. '
        + 'THE KNOB CANNOT ISOLATE THIS HALF AND THAT IS THE FINDING, NOT A GAP: the line and the '
        + 'state come out of the SAME `mvFail` call, so restoring one restores the other and the '
        + 'reverted stream parts at turn 1 before turn 2 is reached. What the arm asserts on the '
        + 'clean load instead is `powerDoubledAfterFailure = 0` — the doubler\'s own counter, at the '
        + 'exact turn it would have fired.' },

  /* ---- THE CONTROLS. Each removes exactly one thing and must hold under the knob too. --------- */
  { id: 'tantrum-after-real-fail', kind: 'control',
    A: [['toxapex', '', 'Regenerator', ['Iron Defense', 'Protect']],
        ['clefable', '', 'Unaware', ['Protect', 'Calm Mind']]].concat(WALL_A.slice(1)),
    B: [['audino', '', 'Regenerator', ['Entrainment', 'Stomping Tantrum', 'Protect']],
        ['garchomp', '', 'Rough Skin', ['Protect', 'Swords Dance']],
        ['corviknight', '', 'Pressure', ['Protect']], ['gengar', '', 'Cursed Body', ['Protect']]],
    script: [{ p1: [{ m: 'irondefense' }, PROT], p2: [{ m: 'entrainment', t: 0 }, PROT] },
             { p1: [{ m: 'irondefense' }, CM], p2: [{ m: 'stompingtantrum', t: 0 }, { m: 'swordsdance' }] }],
    mv: 'entrainment', wantCleanAtLeast: { powerDoubledAfterFailure: 1 },
    expectReasons: ['rewrite:targetAlreadyHasIt'],
    what: 'THE DOUBLER MUST STILL FIRE WHEN THE MOVE REALLY DID FAIL, AND THIS IS WHAT MAKES THE '
        + 'ZERO NEXT DOOR A REAL ZERO RATHER THAN A DEAD COUNTER. No shield anywhere: Audino '
        + 'Entrainments a Toxapex that ALREADY holds Regenerator, which is Entrainment\'s own '
        + '`target.ability === source.ability` guard and a genuine `|-fail|<mover>` in both engines. '
        + 'Turn 2\'s Stomping Tantrum is therefore doubled — `powerDoubledAfterFailure` must read '
        + 'a NON-ZERO `powerDoubledAfterFailure` — and the two damage lines must still match. A fix '
        + 'that had stopped writing the failure at all would pass every red arm above and fail here. '
        + 'THE ASSERTION IS "AT LEAST ONE", NOT "EXACTLY ONE", AND THE DIFFERENCE IS MEASURED RATHER '
        + 'THAN GLOSSED: the counter sits inside the base-power function, which this engine evaluates '
        + 'more than once per arrival, so it reads 2 on one doubling. The arm next door asserts EXACT '
        + 'ZERO, which is the strong claim and the one that would catch a regression.' },

  { id: 'roleplay-noflag', kind: 'control', A: [ZAM].concat(WALL_A), B: mover('lucario', 'Steadfast', 'Role Play'),
    script: AT(PROT, 'roleplay'), mv: 'roleplay',
    what: 'THE OVER-FIRE CONTROL, AND IT IS THE SAME FAMILY. Role Play routes to `abilitycopy`, '
        + 'which carries the identical `mvFail`-on-shield code — but Role Play has NO `protect` flag '
        + '(printed below), so `checkMoveBypassesProtect` returns true, `protect.onTryHit` returns '
        + 'early and the move goes STRAIGHT THROUGH the shield. A fix that announced a shield '
        + 'whenever a status move was refused would pass all seven red arms and fail here.' },

  { id: 'speedswap-noshield', kind: 'control', A: [ZAM].concat(WALL_A), B: mover('emolga', 'Static', 'Speed Swap'),
    script: AT(CM, 'speedswap'), mv: 'speedswap',
    what: 'THE SHIELD CLEARED EXPLICITLY — the identical board and the identical Speed Swap with '
        + 'Calm Mind clicked instead of Protect. The swap really happens and both engines already '
        + 'narrate it. Without this arm, "the shield is announced wrongly" and "this branch is '
        + 'broken" are the same reading.' },

  { id: 'entrainment-noshield', kind: 'control', A: [ZAM].concat(WALL_A), B: mover('hawlucha', 'Limber', 'Entrainment'),
    script: AT(CM, 'entrainment'), mv: 'entrainment',
    what: 'THE OTHER HALF OF THAT PAIR, on the branch that answers with a state write rather than a '
        + 'stat: with no shield the ability really is overwritten, in both engines.' },

  { id: 'twave-shield', kind: 'control', A: [ZAM].concat(WALL_A), B: mover('slowbro', 'Oblivious', 'Thunder Wave'),
    script: AT(PROT, 'thunderwave'), mv: 'thunderwave',
    /* THE ONE ARM THAT ANNOUNCES ON BOTH LOADS, AND ITS PAIR IS THE ASSERTION RATHER THAN AN
     * EXEMPTION. The shield here genuinely refuses and the `status` branch genuinely announces it, so
     * `clean` MUST read 1 — a 0 would mean the already-correct site had gone quiet. And `knob` must
     * ALSO read 1, because the revert knob owns the seven sites this file repaired and not this one:
     * if the knob ever moved this counter it would mean the fix had reached a site it was never
     * supposed to touch, which is the over-fire this arm exists to catch. [0,0] — the old blanket
     * default — demanded the opposite of both. */
    announced: [1, 1],
    what: 'AN ALREADY-CORRECT SHIELD SITE, WHICH THE KNOB MUST NOT REACH. The `status` branch has '
        + 'announced `|-activate|move: Protect` since WIRE 130. It is also the arm that proves the '
        + 'shield beats the DIE: Thunder Wave is 90%% and this runs on the arm that misses every '
        + 'sub-100 move, yet neither engine rolls, because `hitStepTryHitEvent` is step 1 and '
        + '`hitStepAccuracy` is step 4.' },
];

/* ---- LEGALITY, DERIVED ------------------------------------------------------------------------- */
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
for (const c of CASES) for (const row of c.A.concat(c.B)) {
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

/* ---- HOW MANY REASONS IS THE TARGET REFUSED FOR, NOT COUNTING THE SHIELD? -----------------------
 * A fixture blocked for two reasons proves nothing about either, and this whole file is about WHICH
 * refusal is announced. Three families are asked, all derived: a type or status immunity off the dex,
 * a refusing ability or item off `data/tags.json`, and — the family that matters for THESE moves —
 * THE MOVE'S OWN `onTryHit` GUARD, asked through the same tag params the engine routes on, because
 * every move in this file fails on its own terms under some ability pairing. Refused above ONE. */
const TAGS = require(D('data', 'tags.json'));
const REFUSE = ['absorbsType', 'immuneToMoveClass', 'immuneToType', 'refusesStatusMoves', 'levitates'];
const BANNED_ENTRAIN_SOURCE = ['flowergift', 'forecast', 'hungerswitch', 'illusion', 'imposter',
  'neutralizinggas', 'powerofalchemy', 'receiver', 'trace', 'zenmode'];
function refusalReasons(c) {
  const [tSp, , tAb] = c.A[0];
  const [mSp, , mAb] = c.B[0];
  const sp = dex.species.get(tSp);
  const mv = dex.moves.get(c.mv);
  const tA = dex.abilities.get(tAb), mA = dex.abilities.get(mAb);
  const out = [];
  for (const t of sp.types) if (dex.getImmunity(mv.type, [t]) === false) out.push('type:' + t);
  if (mv.status && !dex.getImmunity(mv.status, sp.types)) out.push('statusImmune:' + mv.status);
  const abRow = TAGS.abilities && TAGS.abilities[tA.id];
  if (abRow && abRow.tags) for (const t of abRow.tags) if (REFUSE.includes(t)) out.push('ability:' + t);
  if (mv.flags['reflectable'] && TAGS.abilities && TAGS.abilities[tA.id]
      && (TAGS.abilities[tA.id].tags || []).includes('bouncesStatusMoves')) out.push('ability:bounce');
  /* THE MOVE'S OWN GUARDS, off the routing params rather than off the move's name. */
  const ra = TAGS.moves[mv.id] && TAGS.moves[mv.id].params && TAGS.moves[mv.id].params.rewritesTargetAbility;
  if (ra) {
    const want = ra.becomes === "the user's own ability" ? mA.id : dex.abilities.get(ra.becomes).id;
    if (want === tA.id) out.push('rewrite:targetAlreadyHasIt');
    if ((ra.refusedAbilities || []).map(x => dex.abilities.get(x).id).includes(tA.id))
      out.push('rewrite:refusedAbility');
    if (tA.flags.cantsuppress || tA.flags.noentrain) out.push('rewrite:targetFlag');
    if (mA.flags.noentrain || BANNED_ENTRAIN_SOURCE.includes(mA.id)) out.push('rewrite:sourceFlag');
  }
  if (TAGS.moves[mv.id] && (TAGS.moves[mv.id].tags || []).includes('swapsAbilities')) {
    if (tA.flags.failskillswap || mA.flags.failskillswap) out.push('swap:failskillswap');
    if (tA.id === mA.id) out.push('swap:sameAbility');
  }
  const rp = TAGS.moves[mv.id] && TAGS.moves[mv.id].params && TAGS.moves[mv.id].params.copiesTargetAbility;
  if (rp) {
    if (tA.id === mA.id) out.push('copy:sameAbility');
    if (tA.flags.failroleplay) out.push('copy:targetFlag');
    if (mA.flags.cantsuppress) out.push('copy:userFlag');
  }
  const ct = TAGS.moves[mv.id] && TAGS.moves[mv.id].params && TAGS.moves[mv.id].params.changesTargetType;
  if (ct && ct.replaces && sp.types.join() === mv.type) out.push('typechange:alreadyExactly');
  if (ct && ct.adds && sp.types.includes(mv.type)) out.push('typechange:alreadyHas');
  return out;
}

/* ---- THE POPULATION AND THE CONTROL'S PREMISE, BOTH DERIVED ON EVERY RUN -----------------------
 * MEMBERSHIP IS RE-DERIVED FROM `playerAction`'S OWN ROUTING PREDICATES, not from a list of move
 * names and not from the routing TAG alone — `reordersTurn` is carried by Instruct as well as by
 * Quash and `changesTargetType` by Reflect Type as well as by Soak, and the engine excludes both
 * through a second param. A population read off the loose tag would credit this batch with two
 * mechanics it does not touch. `boostally` is printed too, precisely because it comes out EMPTY:
 * that is the derived reason its `shieldRefuses` call was left alone. */
const par = (id, t) => TAGS.moves[id] && TAGS.moves[id].params && TAGS.moves[id].params[t];
const tagged = (id, t) => TAGS.moves[id] && (TAGS.moves[id].tags || []).includes(t);
const ROUTED = {
  statrewire: m => { const p = par(m.id, 'rewritesStoredStats'); return !!(p && p.stats && p.stats.length); },
  abilitywrite: m => { const p = par(m.id, 'rewritesTargetAbility'); return !!(p && p.becomes); },
  abilityswap: m => { const p = par(m.id, 'swapsAbilities'); return !!(p && p.swaps); },
  abilitycopy: m => { const p = par(m.id, 'copiesTargetAbility'); return !!(p && p.copiesFrom === 'target'); },
  typechange: m => { const p = par(m.id, 'changesTargetType'); return !!(p && (p.adds || p.replaces)); },
  pploss: m => { const p = par(m.id, 'removesPP'); return !!(p && +p.amount > 0 && p.of === 'targetLastMove'); },
  reorder: m => { const p = par(m.id, 'reordersTurn'); return !!(p && p.sends && !tagged(m.id, 'instructsTarget')); },
  boostally: m => { const s = par(m.id, 'statusInflict'); return tagged(m.id, 'boostsTarget') && !(s && s.effects && s.effects.length); },
};
console.log('WHICH ROUTED MOVES A SHIELD CAN ACTUALLY REFUSE — `flags.protect`, read off the format:');
let reach = 0;
for (const [kind, pred] of Object.entries(ROUTED)) {
  const mem = dex.moves.all().filter(legal).filter(pred);
  const withFlag = mem.filter(m => m.flags['protect']);
  reach += withFlag.reduce((a, m) => a + ((TAGS.moves[m.id] || {}).uses || 0), 0);
  console.log('  ' + kind.padEnd(13) + (withFlag.length ? '' : '(NONE — this kind cannot be reached through a shield)  ')
    + withFlag.map(m => m.id + '(' + ((TAGS.moves[m.id] || {}).uses || 0) + ')').join(' ')
    + (withFlag.length < mem.length
      ? '   [no protect flag, so unreachable: ' + mem.filter(m => !m.flags['protect']).map(m => m.id).join(' ') + ']'
      : ''));
}
console.log('  ' + String(reach) + ' corpus uses sit behind these seven sites.' + NL);
if (!reach) {
  console.log('NOTHING ROUTED HERE CARRIES THE PROTECT FLAG — this file proves nothing.');
  process.exit(2);
}
const RP = dex.moves.get('roleplay');
console.log('THE OVER-FIRE CONTROL\'S PREMISE: roleplay.flags = ' + JSON.stringify(RP.flags)
  + ' -> protect flag? ' + !!RP.flags['protect'] + NL);

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  /* THE ARM IS THE SAME FOR EVERY CASE AND IT IS THE ONE THAT MISSES: no arm below depends on a die,
   * because a shield answers at step 1 and the die is at step 4 — and `twave-shield` is the arm that
   * PROVES that rather than assuming it. */
  const arm = G.ARM_BY_ID.get('top-tie-first');
  if (!arm) { console.log('NOT RUN — the driver has no arm named top-tie-first'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(c.B));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_shield_refusal_line :: ' + c.id,
    { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(),
           restored: (globalThis.MEDFAILS || {}).shieldRefusalUnannouncedRestored || 0 };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (clean.r.err) { console.log('THREW       ' + c.id + '   ' + clean.r.err); bad++; continue; }
  ran++;

  const short = clean.r.turns < c.script.length && !clean.r.div;
  const refused = clean.sc.moveNotOnRequest;
  const reasons = refusalReasons(c);

  const brk = play(harness(true), c);
  harness(false);

  /* HOW MANY TIMES THE NEW ROAD WAS TAKEN, per load. A red arm takes it exactly once clean and zero
   * times under the knob; a control takes it zero times on BOTH loads, which is what makes the
   * control a control rather than an arm that happened to agree.
   *
   * ---- 2026-08-29: THAT DEFAULT WAS A BLANKET RULE AND IT ACCUSED A CORRECT ENGINE ---------------
   *
   * `want = kind === 'red' ? 1 : 0` says every control announces ZERO times. That is true of the four
   * controls whose shield is absent or cleared, and FALSE of `twave-shield`, which is a control with a
   * shield that really does refuse and that the `status` branch has announced correctly since WIRE
   * 130. Its own `what` says exactly that. So it read `clean=1 knob=1` against a demanded `0, 0` and
   * this file reported `13 arms staged, 1 failing` — under a printed diagnosis, "the knob did not
   * reach the driver's module", that its OWN NEXT FIELD refuted: `MEDFAILS stamp clean=0 knob=1` is
   * the knob loading. The engine was right, the streams agreed on both loads, and the ruler was wrong.
   * That is the class this repo pays most for, and it was carried as a red shield for two days.
   *
   * SO THE PAIR IS DECLARED PER ARM AND THE DEFAULT ONLY FILLS IT IN. `announced: [clean, knob]`, and
   * the claim each arm makes is now the interesting one rather than a tally: the knob owns some
   * announce sites and not others, so a RED arm must go 1 -> 0 (the knob removed the announcement it
   * added) and `twave-shield` must go 1 -> 1 (the knob CANNOT reach a site it never touched). A
   * default of [1,0]/[0,0] leaves every other arm asserting exactly what it asserted before. */
  const nClean = clean.delta.shieldRefusalAnnounced;
  const nBrk = brk.delta && brk.delta.shieldRefusalAnnounced;
  const [want, wantBrk] = c.announced || (c.kind === 'red' ? [1, 0] : [0, 0]);
  const knobOk = clean.restored === 0 && brk.restored === 1 && nClean === want && nBrk === wantBrk;
  /* AN ARM MAY ALSO NAME A COUNTER THAT MUST READ A PARTICULAR VALUE ON THE CLEAN LOAD. The
   * move-result arm is the one that needs it: its second half is a BASE POWER, and the doubler keeps
   * its own tally, so the arm can assert the doubling did not happen at the exact turn it would. */
  const cnt = Object.entries(c.wantClean || {})
    .map(([k, v]) => ({ k, op: '=', want: v, got: clean.delta[k] === undefined ? 0 : clean.delta[k] }))
    .concat(Object.entries(c.wantCleanAtLeast || {})
      .map(([k, v]) => ({ k, op: '>=', want: v, got: clean.delta[k] === undefined ? 0 : clean.delta[k] })));
  const cntOk = cnt.every(x => x.op === '=' ? x.got === x.want : x.got >= x.want);
  /* AN ARM MAY ALSO DECLARE THE REFUSAL REASONS IT IS SUPPOSED TO HAVE. The default is NONE, which
   * is what makes a shield arm about the shield; the doubler control is deliberately built ON a
   * move's own guard, so it names it rather than being waived. */
  const wantR = (c.expectReasons || []).slice().sort().join(',');
  const gotR = reasons.slice().sort().join(',');

  results.push({ c, clean, brk, short, refused, reasons, nClean, nBrk, want, wantBrk, knobOk, cnt, cntOk,
                 reasonsOk: wantR === gotR });

  if (short || refused) { bad++; continue; }
  if (wantR !== gotR) bad++;                          // a cell with an undeclared reason proves nothing
  if (!knobOk) bad++;
  if (!cntOk) bad++;
  if (clean.r.div) bad++;                             // every arm must agree clean
  if (c.kind === 'red' && !brk.r.div) bad++;          // a red arm must PART under the knob
  if (c.kind === 'control' && brk.r.div) bad++;       // a control must NOT
}

for (const R of results) {
  const { c, clean, brk, short, refused, reasons, nClean, nBrk, want, wantBrk, knobOk, cnt, cntOk, reasonsOk } = R;
  const verdict = clean.r.div ? 'PARTS CLEAN ' : short ? 'SHORT       ' : refused ? 'CLICK REFUSED'
    : c.kind === 'red' ? (brk.r.div ? 'RED PROVEN  ' : 'KNOB SILENT ')
                       : (brk.r.div ? 'OVER-FIRES  ' : 'CONTROL HELD');
  console.log(NL + verdict + '  ' + c.id + '   ' + clean.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    refusal reasons for p1a against ' + dex.moves.get(c.mv).name + ', NOT counting the '
    + 'shield: ' + (reasons.length ? reasons.join(', ') : '(none)')
    + '   [declared: ' + ((c.expectReasons || []).join(', ') || 'none') + ']'
    + (reasonsOk ? '' : '   <-- FAIL, an undeclared reason proves nothing about either'));
  if (c.secondReason) console.log('    DECLARED SECOND REASON (engine-side only): ' + c.secondReason);
  if (clean.r.div) {
    console.log('    CLEAN PARTED at reduced line ' + clean.r.div.index);
    console.log('      showdown  ' + clean.r.div.sdRaw);
    console.log('      medicham  ' + clean.r.div.meRaw);
    console.log('      showdown next  ' + JSON.stringify(clean.r.div.sdAfterRaw.slice(0, 4)));
    console.log('      medicham next  ' + JSON.stringify(clean.r.div.meAfterRaw.slice(0, 4)));
  }
  if (brk.r && brk.r.div) {
    console.log('    UNDER THE KNOB the streams part at reduced line ' + brk.r.div.index);
    console.log('      showdown  ' + brk.r.div.sdRaw);
    console.log('      medicham  ' + brk.r.div.meRaw);
  } else if (brk.r) {
    console.log('    UNDER THE KNOB the streams still agree over all ' + brk.r.turns + ' turns');
  }
  /* THE DIAGNOSIS IS DERIVED FROM WHICH CLAUSE ACTUALLY FAILED. It used to be the fixed string "the
   * knob did not reach the driver's module", printed whenever `knobOk` was false — and on the arm
   * that was failing, the MEDFAILS stamp printed two fields to its left said the knob HAD reached it.
   * A wrong diagnosis costs more than none: it sends the next reader at the module loader instead of
   * at the expectation, which is where this sat for two days. */
  const why = [];
  if (clean.restored !== 0) why.push('the knob\'s stamp is set on the CLEAN load — the knob leaked');
  if (brk.restored !== 1) why.push('the knob\'s stamp is absent under the knob — it did not reach the driver\'s module');
  if (nClean !== want) why.push('clean announce is ' + nClean + ', declared ' + want);
  if (nBrk !== wantBrk) why.push('knob announce is ' + nBrk + ', declared ' + wantBrk);
  console.log('    knob      shieldRefusalAnnounced clean=' + nClean + ' knob=' + nBrk
    + ' | MEDFAILS stamp clean=' + clean.restored + ' knob=' + brk.restored
    + '   (this arm should take the announced road ' + want + ' time(s) clean, ' + wantBrk + ' on the knob'
    + (c.announced ? ' — DECLARED by the arm' : '') + ')'
    + (knobOk ? '' : '   <-- FAIL: ' + why.join('; ')));
  if (cnt.length) console.log('    counters  '
    + cnt.map(x => x.k + ' clean=' + x.got + ' (must be ' + x.op + ' ' + x.want + ')').join(' | ')
    + (cntOk ? '' : '   <-- FAIL'));
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + clean.sc.firstMissing);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing');
console.log(bad ? 'FAIL' : 'PASS — a shield answers `|-activate|<target>|move: Protect` and writes no '
  + '`-fail`, at all seven sites that used to answer with the mover\'s name or with nothing; the '
  + 'no-protect-flag move, the two cleared-shield arms and the already-correct `status` site all hold '
  + 'under the same revert knob');
process.exit(bad ? 1 : 0);
