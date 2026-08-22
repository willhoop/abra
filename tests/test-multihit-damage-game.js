/* test-multihit-damage-game.js — THE PER-ARRIVAL DAMAGE INDEX, IN A WHOLE GAME, AND PROVED NOT TO
 * OVER-FIRE BY TRACE DELTA RATHER THAN BY TALLY.
 *
 *   SHOWDOWN_PATH=... node tests/test-multihit-damage-game.js
 *   SHOWDOWN_PATH=... node tests/test-multihit-damage-game.js --release <id>
 *
 * `tests/test-multihit-roll.js` is the arithmetic: staged hits, sixteen pinned indices, arrival for
 * arrival. This file asks the other half of the question — does the change move anything in a REAL
 * GAME that it was not supposed to move.
 *
 * ================= WHY A TALLY WOULD NOT DO ======================================================
 *
 * "The differential diverged less" is not an attribution. A fix that removes four divergences and
 * adds three reads as an improvement of one, and the three are somebody's evening. So this file runs
 * the IDENTICAL fixture twice in two processes — once with `MEDI_MULTIHIT_ONE_INDEX=1`, which puts
 * the shared-index split back at runtime — and compares GAME BY GAME:
 *
 *   - every CONTROL case must be BYTE-IDENTICAL between the two runs. Same turn count, same raw line
 *     count, same divergence (or same absence of one), same first parted line. A control that moved
 *     at all is the fix reaching something it has no business reaching.
 *   - every MULTI case on a CORNER arm must ALSO be byte-identical, and that is an arithmetic claim
 *     rather than a hope: `rollsUnit[i] * n === rolls[i]`, so at damageIndex 0 and damageIndex 15 the
 *     per-arrival draw and the greedy split give the same arrivals AND the same total. If a corner
 *     moves, the wire changed something other than the interior.
 *   - every MULTI case on the MIDDLE arm — the only arm whose damage index is interior — must have
 *     PARTED before and must AGREE now. That is the direction of the delta, stated per case.
 *
 * ================= THE TRAPS, PAID FOR BY EARLIER PASSES =========================================
 *
 * `PRIMARY_ARM` is the MIDDLE arm, so a caller that names no arm is on real seeded dice. This file
 * names every arm explicitly and never relies on the default.
 *
 * `game_differential.js` CUTS A RELEASE INTO THE REAL STORE at require time when `--release` is
 * absent, repointing `data/engine-release.json` under whatever else is measuring. `_live_release.js`
 * is required FIRST — before the driver — and it redirects `cut`/`open` to a throwaway store, so the
 * bytes graded are the WORKING TREE's. The restore-arm child inherits it through NODE_OPTIONS,
 * because a child that cut its own release into `data/releases/` would be the same hazard wearing a
 * subprocess.
 *
 * THE TWO RUNS MUST BE THE SAME GAMES. `driverReset()` is called before every case: the driver is
 * coverage-seeking and therefore stateful (`CLICKS`, `COV_HITS` carry across games ON PURPOSE), so
 * the second run of one team pair deliberately clicks something else. `MEGA_PREFER_B` is NOT cleared
 * by `driverReset` — it is module-level and alternates — so the fixture is built from bodies that
 * carry no mega stone at all, which makes the parity unreachable rather than merely matched.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
const NL = String.fromCharCode(10);
const EMIT = process.argv.includes('--emit');

if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);

const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const T = (p1, p2) => ({ p1, p2 });
const PROT = { m: 'protect' };

/* ---- THE DEFENDING SIDE MUST ACT, AND IT MAY NOT SHIELD --------------------------------------
 *
 * TWO WRONG ANSWERS WERE TRIED FIRST AND BOTH ARE RECORDED, because each looked like it worked.
 *
 *   (1) `null` in a slot. The header of `scripted` calls a null slot "do nothing this turn", and it
 *       is `pass` on medicham2 — but Showdown REFUSES it in a doubles battle with a live body:
 *       *"Can't pass: Your Snorlax must make a move (or switch)"*. Every game threw.
 *   (2) both defenders clicking PROTECT. This runs, and it is the shape every other differential
 *       fixture in this repo uses — but Protect's consecutive-use check is `randomChance(1, counter)`
 *       on the `stall` stream, and the ARM PINS THAT STREAM. At `bottom-tie-first` every chance
 *       succeeds, so the shield holds on all three turns and NO DAMAGE IS EVER DEALT at that corner.
 *       The "byte-identical at both corners" claim would then have been true and empty.
 *       Measured: `perArrivalDamageIndex` read 8 across twenty-one games.
 *
 * So the defenders click a PURE SELF-BOOST, derived from their own learnset: category Status, target
 * self, a `boosts` block with no negative entry. That has no dice, moves no HP, touches no field and
 * cannot fail inside three clicks, and it leaves the volley landing at every arm. */
function selfBoostMove(species) {
  const s0 = dex.species.get(species);
  const out = [];
  for (let cur = s0; cur && cur.exists; cur = cur.prevo ? dex.species.get(cur.prevo) : null) {
    let ls = null;
    try { ls = dex.species.getLearnsetData(cur.id); } catch (e) { /* none */ }
    for (const k of Object.keys((ls && ls.learnset) || {})) {
      const m = dex.moves.get(k);
      if (!m.exists || m.isNonstandard) continue;
      if (m.category !== 'Status' || m.target !== 'self') continue;
      if (!m.boosts || Object.values(m.boosts).some(v => v < 0)) continue;
      /* +2 x3 lands exactly on the +6 cap and +1 x3 does not reach it, so neither can produce a
       * `-fail` inside this fixture. A move that boosts by more than 2 would, and is excluded. */
      if (Object.values(m.boosts).some(v => v > 2)) continue;
      out.push(m.name);
    }
  }
  return out.sort()[0] || null;
}

/* THE CAST. Every attacker carries its multi-hit move and Protect and NOTHING ELSE, so the driver's
 * scripted click is the only damaging thing on the board; every defender is a bulky legal body that
 * survives three volleys, because a faint mid-fixture ends the comparison early and a short game is
 * not a pass. No body carries an item, so no Focus Sash, no Life Orb and no berry can move HP
 * between two arrivals — the arrivals are the only thing under test. */
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
const CORV = ['corviknight', '', 'Pressure', ['Protect']];
const SNOR = ['snorlax', '', 'Thick Fat', ['Protect']];
const TOXA = ['toxapex', '', 'Regenerator', ['Protect']];
const BENCH = () => [['milotic', '', 'Marvel Scale', ['Protect']], ['incineroar', '', 'Intimidate', ['Protect']]];
/* The defenders' derived filler is written onto their rows, so the set is legal AND the script can
 * click it. Done once here rather than at each use so the two processes cannot disagree about it. */
const withFiller = row => { const mv = selfBoostMove(row[0]);
  return [row[0], row[1], row[2], mv && !row[3].includes(mv) ? row[3].concat([mv]) : row[3]]; };
const fillerOf = row => selfBoostMove(row[0]);

const three = (mv, B) => {
  const b0 = fillerOf(B[0]), b1 = fillerOf(B[1]);
  const turn = T([{ m: mv, t: 0 }, PROT], [{ m: dex.moves.get(b0).id }, { m: dex.moves.get(b1).id }]);
  return [turn, turn, turn];
};

const ARM_IDS = ['middle', 'top-tie-first', 'bottom-tie-first'];
const CORNERS = ['top-tie-first', 'bottom-tie-first'];

const DEF_A = [withFiller(SNOR), withFiller(CORV)];
const DEF_B = [withFiller(SNOR), withFiller(TOXA)];

const CASES = [
  /* ---- MULTI: the volleys the wire is about --------------------------------------------------- */
  { kind: 'MULTI', name: 'twinbeam    Farigiraf, 40 BP x2 special — the constant-base proof case',
    A: [['farigiraf', '', 'Armor Tail', ['Twin Beam', 'Protect']], CLEF], B: DEF_A,
    script: three('twinbeam', DEF_A) },
  { kind: 'MULTI', name: 'dualwingbeat Corviknight, 40 BP x2 physical',
    A: [['corviknight', '', 'Pressure', ['Dual Wingbeat', 'Protect']], CLEF], B: DEF_B,
    script: three('dualwingbeat', DEF_B) },
  { kind: 'MULTI', name: 'doublehit   Dragapult, 35 BP x2 physical',
    A: [['dragapult', '', 'Clear Body', ['Double Hit', 'Protect']], CLEF], B: DEF_B,
    script: three('doublehit', DEF_B) },
  /* BEAT UP CARRIES THE PER-HIT-POWER PATH ON THE INTERIOR ARM, AND TRIPLE AXEL CANNOT.
   *
   * `hitPlanOf().perHitPower` is the branch where each arrival has its OWN base and therefore its own
   * band. Two legal moves reach it: Triple Axel (20/40/60) and Beat Up (one packet per eligible
   * party member, `baseAtk/10 + 5` each). Triple Axel is 90 accuracy AND carries `multiaccuracy`, so
   * on the middle arm — the only arm with live accuracy dice — the two engines part on the HIT COUNT
   * before any damage line is reached:
   *
   *     parted at reduced line 23 :: me |upkeep :: sd |-hitcount|p2a: Snorlax|1
   *
   * That is a per-hit ACCURACY defect (`sim/battle-actions.ts:910-937` re-rolls accuracy for every
   * hit after the first; this engine folds `multiAccuracy` into the expected hit COUNT instead), it
   * is NOT this wire, and a case that parts one line earlier for another reason tests nothing about
   * damage. So Triple Axel runs at the two CORNERS, where accuracy is pinned and the hit count cannot
   * differ, and Beat Up — 100 accuracy, no `multiaccuracy` — carries the interior. Recorded rather
   * than dropped, because the interior Triple Axel row is a real open defect and this is where it was
   * measured. */
  { kind: 'MULTI', name: 'beatup      Weavile, one packet per ally — the per-hit-power path in dmgRange',
    A: [['weavile', '', 'Pressure', ['Beat Up', 'Protect']], CLEF], B: DEF_B,
    script: three('beatup', DEF_B) },
  { kind: 'MULTI', arms: CORNERS,
    name: 'tripleaxel  Weavile, 20/40/60 x3 — corners only, see the multiaccuracy note',
    A: [['weavile', '', 'Pressure', ['Triple Axel', 'Protect']], CLEF], B: DEF_B,
    script: three('tripleaxel', DEF_B) },

  /* ---- CONTROL: nothing here may move by a single byte ----------------------------------------- */
  { kind: 'CONTROL', name: 'psychic     a SINGLE-hit special move — the same attacker, one arrival',
    A: [['farigiraf', '', 'Armor Tail', ['Psychic', 'Protect']], CLEF], B: DEF_A,
    script: three('psychic', DEF_A) },
  /* AERIAL ACE AND NOT BRAVE BIRD, and the reason is a fixture defect that was measured rather than
   * guessed at. Brave Bird at the `top-tie-first` corner is MAXIMUM damage on every turn: it killed
   * Snorlax on turn 3, the driver had to send a replacement, and the scripted click for the new body
   * was not on Showdown's request — *"amnesia (offered: protect)"* — so both engines silently passed
   * and the turn tested nothing. `scriptCounters().moveNotOnRequest` is what caught it. A KO inside a
   * three-turn fixture is a staging defect, so the fixture stops producing one. */
  { kind: 'CONTROL', name: 'aerialace   a SINGLE-hit physical move — one arrival, no recoil, never misses',
    A: [['corviknight', '', 'Pressure', ['Aerial Ace', 'Protect']], CLEF], B: DEF_B,
    script: three('aerialace', DEF_B) },
  { kind: 'CONTROL', name: 'shield      the attacker shields instead — no damage at all, the floor of the fixture',
    A: [['farigiraf', '', 'Armor Tail', ['Twin Beam', 'Protect']], CLEF], B: DEF_A,
    script: (() => { const s = three('twinbeam', DEF_A);
      return s.map(t => T([PROT, PROT], t.p2)); })() },
];

/* ---- LEGALITY, DERIVED. Nothing below is typed from memory. ------------------------------------- */
if (!EMIT) {
  const LS = dex.data.Learnsets;
  const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const learns = (sp, mv) => {
    let s = dex.species.get(sp);
    while (s && s.exists) {
      const e = LS[s.id];
      if (e && e.learnset && e.learnset[dex.moves.get(mv).id]) return true;
      s = s.prevo ? dex.species.get(s.prevo)
        : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
    }
    return false;
  };
  let illegal = 0;
  for (const c of CASES) for (const row of c.A.concat(c.B).concat(BENCH())) {
    const sp = dex.species.get(row[0]);
    if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
    if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id).includes(dex.abilities.get(row[2]).id)) {
      console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
    }
    /* THE FIXTURE MAY NOT CARRY A MEGA STONE — see the MEGA_PREFER_B note in the header. */
    if (row[1]) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' carries an item; this fixture is itemless by design'); illegal++; }
    for (const mv of row[3]) {
      const m = dex.moves.get(mv);
      if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
      if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
    }
  }
  /* AND THE KIND LABEL IS DERIVED, NOT TRUSTED: a MULTI case whose move deals ONE arrival would be a
   * control wearing the wrong hat, and it would pass every clause below.
   *
   * THE DERIVATION HAS TO ASK THE HANDLER AS WELL AS THE FIELD. Beat Up carries no `multihit` field
   * at all — its own `onModifyMove` writes `move.multihit = move.allies.length` — so a check that
   * read only the declarative field would call this repo's one 100-accuracy per-hit-power move a
   * single-hit control. Reading the handler's source for the assignment is the same move
   * `tests/test-tag-params-derived.js` makes for Guard Dog's `onDragOut`. */
  for (const c of CASES) {
    const mv = c.script[0].p1[0] && c.script[0].p1[0].m;
    if (!mv) continue;
    const md = dex.moves.get(mv);
    const mh = !!md.multihit || /\bmultihit\s*=/.test(String(md.onModifyMove || ''));
    if ((c.kind === 'MULTI') !== mh) { console.log('MISLABELLED FIXTURE  ' + c.name + ' kind=' + c.kind + ' multi-arrival=' + mh); illegal++; }
  }
  if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal or mislabelled fixture(s). This is not a pass.'); process.exit(2); }
}

/* ---- the run ------------------------------------------------------------------------------------ */
function runAll() {
  const out = [];
  G.resetScriptCounters();
  for (const armId of ARM_IDS) {
    const ARM = G.ARM_BY_ID.get(armId);
    if (!ARM) { out.push({ arm: armId, name: '(no such arm)', err: 'ARM MISSING' }); continue; }
    for (const c of CASES) {
      if (c.arms && !c.arms.includes(armId)) continue;
      /* THE DRIVER IS STATEFUL AND COVERAGE-SEEKING. Frozen to empty before every case so the two
       * processes play the same game and the arms do not steer each other. */
      G.driverReset();
      const A = stage(c.A).concat(stage(BENCH()));
      const B = stage(c.B).concat(stage(BENCH()));
      const a = G.buildPair(A), b = G.buildPair(B);
      if (!a || !b) { out.push({ arm: armId, kind: c.kind, name: c.name, err: 'NOT-STAGED' }); continue; }
      const r = G.playGame(a, b, 'directed', 'multihit :: ' + armId + ' :: ' + c.name, { script: c.script, arm: ARM });
      out.push({ arm: armId, kind: c.kind, name: c.name, err: r.err || null,
                 turns: r.turns, lines: r.lines, walked: r.comparedWalked,
                 div: r.div ? (r.div.index + ' :: me ' + r.div.meRaw + ' :: sd ' + r.div.sdRaw) : null });
    }
  }
  return out;
}

const HERE = runAll();

if (EMIT) { process.stdout.write('@@JSON@@' + JSON.stringify(HERE) + '@@END@@' + NL); process.exit(0); }

let bad = 0;
console.log('MULTI-HIT DAMAGE, WHOLE GAME — the per-arrival index and its over-fire proof');
console.log('  arms: ' + ARM_IDS.join(', ') + '   (middle is the ONLY arm whose damage index is interior)');
console.log('');
for (const r of HERE) {
  const tag = r.err ? 'THREW      ' : r.div ? 'STREAMS PART' : 'AGREES     ';
  if (r.err || r.div) bad++;
  /* SHORT IS NOT A PASS: a scripted game that stopped early without a divergence stopped testing. */
  if (!r.err && !r.div && r.turns < 3) { bad++; console.log('SHORT        ' + r.arm.padEnd(17) + r.name + '  (' + r.turns + '/3 turns)'); continue; }
  console.log(tag + ' ' + r.arm.padEnd(17) + r.name);
  if (r.div) console.log('               parted at reduced line ' + r.div);
  if (r.err) console.log('               ' + r.err);
}

const sc = G.scriptCounters();
console.log('');
if (sc.moveNotOnRequest !== 0) {
  bad++;
  console.log('FIXTURE BROKEN — ' + sc.moveNotOnRequest + ' scripted click(s) were not on Showdown\'s request and '
    + 'became a silent `pass` on BOTH engines, so those turns tested nothing. First: ' + sc.firstMissing);
} else {
  console.log('scripted clicks refused by the authority\'s request: 0 (every click above really ran)');
}

/* ---- THE COUNTER, AND THE NOUN IT COUNTS -------------------------------------------------------
 * `perArrivalDamageIndex` counts ARRIVALS that read their own sixteen-entry band at their own drawn
 * index — not draws, not volleys, not multi-hit clicks. It is asserted `> 0` here and at EXACT
 * equality in tests/test-multihit-roll.js, and the split of responsibility is deliberate: this file
 * cannot know how many arrivals a real game produced (a miss, a Protect or a faint removes one), so
 * an exact bar here would be a number nobody could derive. What it CAN assert is that the capability
 * ran at all in whole games — a zero would mean every AGREES line above is the old engine agreeing.
 *
 * IT MUST BE THE INSTANCE THE DRIVER PLAYED. `game_differential.js` binds the engine through
 * `REL.require`, which compiles the snapshot's copy as its own module with its own MEDSEEN; a plain
 * `require` here returns a second engine that never played a turn and reads 0. */
const SEEN = globalThis.MEDSEEN;
if (!SEEN) { console.log(NL + 'NOT RUN — globalThis.MEDSEEN is absent. This is not a pass.'); process.exit(2); }
const arrivals = SEEN.perArrivalDamageIndex || 0;
if (!arrivals) {
  bad++;
  console.log('COUNTER  perArrivalDamageIndex = 0 — no ARRIVAL was addressed on its own in any game above, '
    + 'so the wire never ran and every AGREES line is the old engine agreeing');
} else {
  console.log('counter  perArrivalDamageIndex = ' + arrivals + ' arrivals addressed on their own');
}
const FAILS = globalThis.MEDFAILS || {};
if (FAILS.packetBandMissing) {
  bad++;
  console.log('COUNTER  packetBandMissing = ' + FAILS.packetBandMissing + ' arrival(s) fell back to the greedy '
    + 'shared-index split, first on ' + (FAILS.packetBandMissingFirst || '?'));
}

/* ================= THE OVER-FIRE PROOF, BY TRACE DELTA ========================================== */
console.log(NL + 'OVER-FIRE PROOF — the identical fixture with MEDI_MULTIHIT_ONE_INDEX=1, compared case by case');
const { spawnSync } = require('child_process');
const childEnv = Object.assign({}, process.env, { MEDI_MULTIHIT_ONE_INDEX: '1' });
if (!process.argv.includes('--release')) {
  /* THE CHILD MUST NOT CUT A RELEASE EITHER. NODE_OPTIONS is how the preload reaches it. */
  childEnv.NODE_OPTIONS = ((process.env.NODE_OPTIONS || '') + ' -r ./tests/_live_release.js').trim();
}
const child = spawnSync(process.execPath, [__filename, '--emit'].concat(process.argv.slice(2).filter(x => x !== '--emit')),
  { encoding: 'utf8', cwd: D('.'), env: childEnv, maxBuffer: 64 * 1024 * 1024 });
const raw = String(child.stdout || '');
const m = raw.match(/@@JSON@@([\s\S]*?)@@END@@/);
if (!m) {
  console.log('  FAIL the restore-arm child produced no result block (exit ' + child.status + ')');
  console.log(raw.split(NL).slice(-14).join(NL));
  console.log(String(child.stderr || '').split(NL).slice(-8).join(NL));
  process.exit(1);
}
const THEN = JSON.parse(m[1]);
if (THEN.length !== HERE.length) {
  console.log('  FAIL the two runs played a different number of games (' + HERE.length + ' vs ' + THEN.length + ')');
  process.exit(1);
}
const kOf = r => r.arm + ' :: ' + r.name;
const thenBy = new Map(THEN.map(r => [kOf(r), r]));
let moved = 0, fixed = 0, overfired = 0;
for (const now of HERE) {
  const was = thenBy.get(kOf(now));
  if (!was) { overfired++; console.log('  FAIL no restore-arm counterpart for ' + kOf(now)); continue; }
  const same = was.turns === now.turns && was.lines === now.lines && was.walked === now.walked
            && String(was.div) === String(now.div) && String(was.err) === String(now.err);
  const corner = now.arm !== 'middle';
  if (same) {
    /* A MULTI case on the MIDDLE arm that did not move is the wire failing to reach a real game. */
    if (now.kind === 'MULTI' && !corner) {
      overfired++;
      console.log('  FAIL  UNCHANGED where it had to change   ' + kOf(now)
        + '   (the middle arm is the interior; a shared index and a per-arrival index cannot agree there)');
    }
    continue;
  }
  moved++;
  if (now.kind === 'CONTROL') {
    overfired++;
    console.log('  FAIL  OVER-FIRE on a control            ' + kOf(now));
    console.log('        was  turns=' + was.turns + ' lines=' + was.lines + ' walked=' + was.walked + ' div=' + was.div);
    console.log('        now  turns=' + now.turns + ' lines=' + now.lines + ' walked=' + now.walked + ' div=' + now.div);
  } else if (corner) {
    overfired++;
    console.log('  FAIL  OVER-FIRE at a pinned CORNER      ' + kOf(now)
      + '   (rollsUnit[i]*n === rolls[i], so a corner cannot move)');
    console.log('        was  turns=' + was.turns + ' lines=' + was.lines + ' walked=' + was.walked + ' div=' + was.div);
    console.log('        now  turns=' + now.turns + ' lines=' + now.lines + ' walked=' + now.walked + ' div=' + now.div);
  } else if (was.div && !now.div) {
    fixed++;
    console.log('  ok    PARTED -> AGREES                  ' + kOf(now));
    console.log('        was  ' + was.div);
  } else {
    overfired++;
    console.log('  FAIL  MOVED THE WRONG WAY               ' + kOf(now));
    console.log('        was  turns=' + was.turns + ' lines=' + was.lines + ' div=' + was.div);
    console.log('        now  turns=' + now.turns + ' lines=' + now.lines + ' div=' + now.div);
  }
}
console.log('  ' + HERE.length + ' games compared: ' + (HERE.length - moved) + ' byte-identical, '
  + fixed + ' parted-before/agree-now, ' + overfired + ' moved where they must not');
if (overfired) bad++;
if (!fixed) { bad++; console.log('  FAIL  the restore arm changed NOTHING anywhere — MEDI_MULTIHIT_ONE_INDEX did not take effect'); }

console.log(NL + (bad ? 'FAIL' : 'PASS — the per-arrival index closes every staged multi-hit divergence on the interior arm '
  + 'and moves nothing at either corner and nothing on any control'));
process.exit(bad ? 1 : 0);
