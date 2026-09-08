#!/usr/bin/env node
/* tests/probe_syrupbomb_source_faint.js — A PER-TURN-BOOST VOLATILE DIES WHEN ITS SOURCE FAINTS,
 * NOT ONLY WHEN ITS SOURCE VACATES A SLOT
 *   node tests/probe_syrupbomb_source_faint.js        node tests/probe_syrupbomb_source_faint.js --red
 * ==================================================================================================
 *
 * THE RULE, READ RATHER THAN RECALLED. `syrupbomb.condition` (data/moves.ts:18764-18781; the
 * Champions mod overrides the MOVE's accuracy only — data/mods/champions/moves.ts:1010-1013 is
 * `{ inherit: true, accuracy: 90 }` and carries no condition) removes itself on the authority's
 * `Update` event:
 *
 *     onUpdate(pokemon) {
 *       if (this.effectState.source && !this.effectState.source.isActive) {
 *         pokemon.removeVolatile('syrupbomb');
 *       }
 *     },
 *
 * AND `isActive` GOES FALSE AT THE FAINT, NOT AT THE REPLACEMENT. There are exactly three sites that
 * clear it in the whole simulator —
 *
 *     grep -rn "isActive = false" sim/   ->   sim/battle-actions.ts:120   (switchIn, the outgoing body)
 *                                             sim/battle.ts:2563          (faintMessages)
 *                                             sim/pokemon.ts:473          (the constructor)
 *
 * — and `sim/battle.ts:2563` sits inside `faintMessages`'s drain loop, four statements after
 * `this.add('faint', pokemon)` and long before any replacement is asked for. A body that has fainted
 * and is still standing in its slot is therefore NOT active.
 *
 * WHAT THIS ENGINE DID. `_updateEvent`'s per-turn-boost sweep tested SLOT MEMBERSHIP alone —
 * `if(!_src||actA.indexOf(_src)>=0||actB.indexOf(_src)>=0)continue;` — under a comment asserting in as
 * many words that *"a body that has FAINTED but not yet been replaced is still active in the
 * authority and is still in these arrays here, so a KO'd source does not end the volatile early in
 * either engine."* That sentence is false at `sim/battle.ts:2563`. So a Syrup Bomb whose Hydrapple
 * was killed went on taking a Speed stage every residual from a corpse.
 *
 * THE ENGINE ALREADY HELD THE RIGHT PREDICATE IN THE OTHER PLACE IT NEEDED ONE. The partial-trap
 * sweep asks `_by.fainted||_by.curHP<=0||(actA.indexOf(_by)<0&&actB.indexOf(_by)<0)`. Two
 * implementations of ONE fact — "has the source left the field" — is the shape CLAUDE.md's
 * FACTS-ARE-GLOBAL rule names, and they disagreed. Both sites now call `sourceOffField`.
 *
 * MEASURED ON THE PINNED POOL, release `a9b05e61146a`, arm `middle`, `--turns 50`,
 * `pair-protect-bust  gen9championsvgc2026regmbbo3-2655745450 vs …2655794301`, FIRST BOARD
 * DIVERGENCE AT TURN 22 — the single board-material game left in the whole 958:
 *
 *     showdown  |faint|p2b: Hydrapple      then  |-end|p1a: Ceruledge|Syrup Bomb|[silent]
 *     medicham  |faint|p2b: hydrapple      then  (medicham2 emitted nothing further)
 *     board leaf   active[].vol.syrupbomb   medicham holds it, showdown does not
 *
 * IT WAS INVISIBLE AT THE PUBLISHED TURN CAP OF 20. Every board boundary of that game agreed through
 * turn 20 and the pair parted at turn 22.
 *
 * THE ARMS, AND WHAT EACH ONE REFUSES.
 *
 *   RED-1   Syrup Bomb lands, then the SOURCE IS KILLED while the target still carries it
 *           -> the volatile must END, so the target takes ONE Speed drop and no more. The defect.
 *   CTRL-A  Syrup Bomb lands, then the SOURCE PIVOTS OUT (a switch, not a faint)
 *           -> also ends. THIS IS THE ARM THAT SAYS THE KNOB IS NARROW: the slot-membership road
 *           already worked, and a fix that broke it would show here.
 *   CTRL-B  Syrup Bomb lands and the SOURCE STAYS ALIVE ON THE FIELD
 *           -> the volatile keeps ticking. Without it, ending the volatile unconditionally would pass
 *           RED-1 under --red and be caught by nothing.
 *
 * EVERY ARM ASSERTS THE FIXTURE REACHED THE RULE BEFORE IT ASSERTS ANYTHING ELSE: the volatile must
 * have been APPLIED (the authority must write `|-start|…|Syrup Bomb`), the arm's own event must have
 * happened in the AUTHORITY's stream (a `|faint|` on the source for RED-1, a `|switch|` for CTRL-A,
 * neither for CTRL-B), the target must be alive at the end, and every scripted click must have been
 * on Showdown's request.
 *
 * THE OUTCOME AND NOT THE CLASSIFICATION: what is compared is HOW MANY SPEED STAGES THE TARGET LOST,
 * read off both streams, plus the board leaf the differential itself reads. Not the presence of an
 * `|-end|` line, which is narration and which both engines could get right while holding different
 * Speed stages.
 *
 * RED FIRST: `MEDI_VOLSRC_SLOT_ONLY=1` restores the slot-membership-only predicate exactly as it
 * stood before this file existed. Under `--red` RED-1 must PART and the two controls must NOT.
 * ================================================================================================ */
'use strict';
/* THE KNOB IS SET BEFORE ANY REQUIRE — medicham2 reads it once at module load, and
 * `game_differential.js` loads medicham2 at ITS require time. */
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_VOLSRC_SLOT_ONLY = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
/* `--state` BEFORE THE REQUIRE, or `playGame` never fills `r.stateDiv` and every board claim below is
 * vacuous. Batch I lost two probes to exactly this. */
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
const NL = String.fromCharCode(10);
/* `bottom-tie-first` — every sub-100 move HITS. Syrup Bomb is 90% accurate in this format (DERIVED
 * below), so under real dice one arm in ten would miss and the probe would be a coin flip wearing a
 * green name. The volatile itself is a `chance: 100` secondary and needs no die. */
const ARM = G.ARM_BY_ID.get('bottom-tie-first');
if (!ARM) throw new Error('the bottom-tie-first arm is gone from game_differential.js');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- THE FIXTURE, DERIVED. Nothing here is typed from memory. ------------------------------------ */
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

/* THE SOURCE. Hydrapple is the ONLY legal carrier of Syrup Bomb in this regulation — derived below,
 * not chosen — which is also why the pool game is a Hydrapple. Regenerator rather than Supersweet
 * Syrup: the ability slot must not fire an entry effect that writes lines into the arm it is not
 * being tested in. Nasty Plot is the inert self-targeted click RED-1 gives it on the turn it dies,
 * so that a Protect cannot block the kill and a second Syrup Bomb cannot refresh the volatile. */
const HYDRA = ['hydrapple', '', 'Regenerator', ['Syrup Bomb', 'Protect', 'Nasty Plot']];
/* THE TARGET, whose Speed stage is the reading. It must survive Syrup Bomb for the whole arm and its
 * ABILITY must not touch a stat drop: Blaze, not Intimidate — and asserted below to be neither a
 * drop-blocker (Clear Body's family) nor a drop-reactor (Defiant / Competitive). Fire resists Grass.
 * Bulk Up is the inert self click for the turn it must NOT be protected on. */
const TARGET = ['incineroar', '', 'Blaze', ['Protect', 'Bulk Up']];
/* THE KILLER. Ice is 4x on Grass/Dragon (derived below) and Primarina outspeeds Hydrapple, so the
 * source dies before it acts. Torrent is inert here. */
const KILLER = ['primarina', '', 'Torrent', ['Protect', 'Ice Beam']];
/* THE SOURCE'S PARTNER, and the body it pivots to in CTRL-A. */
const PARTNER = ['clefable', '', 'Unaware', ['Protect']];
const PIVOT = 'milotic';

const PROT = { m: 'protect' };
const SYRUP = { m: 'syrupbomb', t: 0 };      // p1a -> p2a
const NASTY = { m: 'nastyplot' };
const BULK = { m: 'bulkup' };
const ICE = { m: 'icebeam', t: 0 };          // p2b -> p1a, the source
const OUT = { sw: PIVOT };
const T = (p1, p2) => ({ p1, p2 });

/* p2a spends every turn on BULK UP — a self-targeted boost that moves atk/def and never spe — so it
 * is hit by the Syrup Bomb on turn 1 and can never be the thing that ends an arm early. */
const CASES = [
  { name: 'RED-1   Syrup Bomb lands, then the SOURCE IS KILLED   [the volatile must END]',
    part: true, drops: 1, srcFaints: true, srcSwitches: false,   // and a faint REPLACEMENT follows
    what: 'faintMessages sets isActive=false at sim/battle.ts:2563, so the authority\'s next Update '
        + 'removes the volatile. This engine tested slot membership and a corpse is still in its slot.',
    script: [T([SYRUP, PROT], [BULK, PROT]),
             T([NASTY, PROT], [BULK, ICE]),
             T([PROT, PROT], [BULK, PROT]),
             T([PROT, PROT], [BULK, PROT])] },

  { name: 'CTRL-A  Syrup Bomb lands, then the SOURCE PIVOTS OUT   [the volatile must END]',
    part: false, drops: 1, srcFaints: false, srcSwitches: true,
    what: 'The same ending through the road that ALREADY worked (switchIn clears isActive at '
        + 'sim/battle-actions.ts:120). THIS IS THE ARM THAT SAYS THE KNOB IS NARROW.',
    script: [T([SYRUP, PROT], [BULK, PROT]),
             T([OUT, PROT], [BULK, PROT]),
             T([PROT, PROT], [BULK, PROT]),
             T([PROT, PROT], [BULK, PROT])] },

  { name: 'CTRL-B  Syrup Bomb lands and the SOURCE STAYS   [the volatile must KEEP TICKING]',
    part: false, drops: null, srcFaints: false, srcSwitches: false,
    what: 'Carried because ending the volatile unconditionally would pass RED-1 under --red and be '
        + 'caught by nothing else here. `drops: null` means "whatever the authority does, we do".',
    script: [T([SYRUP, PROT], [BULK, PROT]),
             T([NASTY, PROT], [BULK, PROT]),
             T([NASTY, PROT], [BULK, PROT]),
             T([NASTY, PROT], [BULK, PROT])] },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON, ASKED OF THE FORMAT ------------------------------ */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const row of [HYDRA, TARGET, KILLER, PARTNER]) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) bad(row[1] + ' is not a legal item in this format');
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { bad(mv + ' is not in this format'); continue; }
    if (!learns(row[0], mv)) bad(sp.name + ' does not learn ' + m.name);
  }
}
{
  const sb = dex.moves.get('syrupbomb');
  if (!legal(sb)) bad('Syrup Bomb is not in this format');
  if (!sb.condition || typeof sb.condition.onUpdate !== 'function')
    bad('syrupbomb.condition no longer carries the onUpdate that ends it — this probe has no rule to test');
  if (!(sb.condition && sb.condition.duration >= 3))
    bad('syrupbomb duration is ' + (sb.condition && sb.condition.duration) + ', too short for a 4-turn arm');
  if (!(sb.secondary && sb.secondary.chance === 100 && sb.secondary.volatileStatus === 'syrupbomb'))
    bad('Syrup Bomb no longer applies its volatile as a 100% secondary — the arms would be coin flips');
  /* THE ONLY LEGAL CARRIER, DERIVED. If a later regulation adds one, this line says so out loud
   * rather than letting the probe quietly describe a different metagame. */
  const carriers = dex.species.all().filter(s => legal(s) && learns(s.id, 'syrupbomb')).map(s => s.name);
  if (!carriers.includes('Hydrapple')) bad('Hydrapple no longer learns Syrup Bomb');
  console.log('  DERIVED  legal Syrup Bomb carriers in this regulation: ' + carriers.join(', '));
  /* THE MEMBERSHIP THE ENGINE READS IS THE TAG, NOT THE NAME. */
  const TAGS = require(D('data', 'tags.json'));
  const pb = TAGS.moves.syrupbomb && TAGS.moves.syrupbomb.params
          && TAGS.moves.syrupbomb.params.perTurnBoost;
  if (!pb || pb.volatile !== 'syrupbomb') bad('the derived tag perTurnBoost is gone from Syrup Bomb — the engine sweep reads it');
  if (pb && !(pb.boosts && +pb.boosts.spe === -1)) bad('perTurnBoost.boosts is ' + JSON.stringify(pb && pb.boosts) + ', not a -1 Speed stage');
  /* THE KILL IS 4x AND THE KILLER IS FASTER, both derived. */
  const eff = dex.getEffectiveness('Ice', dex.species.get('hydrapple').types);
  if (eff < 2) bad('Ice is only ' + eff + ' steps effective on Hydrapple; the one-shot is not guaranteed');
  if (dex.species.get('primarina').baseStats.spe <= dex.species.get('hydrapple').baseStats.spe)
    bad('the killer no longer outspeeds the source, so the source may act before it dies');
  /* THE TARGET NEITHER BLOCKS NOR REACTS TO A STAT DROP. Either would make the reading something
   * other than the volatile's residual. */
  const ab = dex.abilities.get(TARGET[2]);
  if (ab.id === 'clearbody' || ab.id === 'whitesmoke' || ab.id === 'fullmetalbody')
    bad('the target\'s ability blocks stat drops outright');
  if (ab.id === 'defiant' || ab.id === 'competitive' || ab.id === 'contrary')
    bad('the target\'s ability reacts to a stat drop, so the Speed reading is not the volatile\'s');
  if (dex.getEffectiveness('Grass', dex.species.get('incineroar').types) > 0)
    bad('Grass is no longer resisted by the target, which may not survive the hit');
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
/* HOW MANY SPEED STAGES THE TARGET LOST. Both streams are matched with one regex: the authority
 * writes `|-unboost|p2a: Incineroar|spe|1` and medicham2's reduced trace writes `|-unboost|p2a:incineroar|spe|1`.
 * The AMOUNT is summed rather than the LINES counted, so two stages announced on one line and two
 * announced on two cannot read the same. */
const speDrops = (lines, who) => {
  let n = 0;
  const re = new RegExp('^\\|-unboost\\|' + who + '[^|]*\\|spe\\|(\\d+)');
  for (const l of lines) { const m = re.exec(String(l)); if (m) n += +m[1]; }
  return n;
};
const count = (lines, re) => lines.filter(l => re.test(String(l))).length;

console.log((RED ? NL + 'RED ARM — MEDI_VOLSRC_SLOT_ONLY=1 (the engine as it stood before this file)'
                 : NL + 'CLEAN ARM') + NL);

const b0 = { left: SEEN.perTurnVolatileSourceLeft | 0,
             inSlot: SEEN.perTurnVolatileSourceFaintedInSlot | 0 };

for (const c of CASES) {
  const a = G.buildPair(stage([HYDRA, PARTNER]).concat(BENCH(PIVOT, 'toxapex')));
  const b = G.buildPair(stage([TARGET, KILLER]).concat(BENCH('milotic', 'clefable')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const l0 = SEEN.perTurnVolatileSourceLeft | 0, s0 = SEEN.perTurnVolatileSourceFaintedInSlot | 0;
  const r = G.playGame(a, b, 'directed', 'probe_syrupbomb_source_faint :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const sdSpe = speDrops(sdL, 'p2a'), meSpe = speDrops(meL, 'p2a');
  const left = (SEEN.perTurnVolatileSourceLeft | 0) - l0;
  const inSlot = (SEEN.perTurnVolatileSourceFaintedInSlot | 0) - s0;

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  Speed stages lost by the TARGET (p2a): ' + sdSpe);
  console.log('    medicham  Speed stages lost by the TARGET (p2a): ' + meSpe);
  console.log('    MEDSEEN.perTurnVolatileSourceLeft +' + left
    + '   .perTurnVolatileSourceFaintedInSlot +' + inSlot + '   turns ' + r.turns
    + '   stop: ' + r.endReason);

  /* ---- THE FIXTURE REACHED THE RULE, BEFORE ANY EQUALITY IS ASSERTED --------------------------- */
  /* 1. THE VOLATILE WAS ACTUALLY APPLIED. Without this every arm is a comparison of two zeros. */
  claim(count(sdL, /^\|-start\|p2a[^|]*\|(move: )?Syrup Bomb/i) === 1,
    c.name + ' — the authority APPLIED the volatile to the target exactly once',
    '`|-start|…Syrup Bomb` lines on p2a: ' + count(sdL, /^\|-start\|p2a[^|]*\|(move: )?Syrup Bomb/i));
  /* 2. THIS ARM'S OWN EVENT HAPPENED, IN THE AUTHORITY'S STREAM. A RED arm whose source never died
   *    is a control wearing a red name, which is how six self-tests in this repo went quiet. */
  /*    A FAINT REPLACEMENT IS ALSO A `|switch|`, AND THE FIRST VERSION OF THIS BLOCK DID NOT KNOW
   *    THAT — it read `|switch|p1a…milotic: 2` in RED-1 and called the arm mislabelled. The harness
   *    sends the bench in after the kill, so the two arms are told apart by the FAINT and never by
   *    the switch: RED-1 has one, CTRL-A must have none, and CTRL-B must have neither event. */
  const srcFainted = count(sdL, /^\|faint\|p1a/) > 0;
  const srcSwitched = count(sdL, new RegExp('^\\|switch\\|p1a[^|]*' + PIVOT, 'i')) > 0;
  const meFainted = count(meL, /^\|faint\|p1a/) > 0;
  claim(srcFainted === c.srcFaints && meFainted === c.srcFaints,
    c.name + ' — the SOURCE ' + (c.srcFaints ? 'fainted' : 'did NOT faint') + ' in BOTH engines',
    '|faint|p1a lines: showdown ' + count(sdL, /^\|faint\|p1a/) + ', medicham ' + count(meL, /^\|faint\|p1a/));
  if (c.srcSwitches) {
    claim(srcSwitched && !srcFainted,
      c.name + ' — the SOURCE pivoted out ALIVE (a switch, and no faint anywhere in the arm)',
      '|switch|p1a -> ' + PIVOT + ': ' + count(sdL, new RegExp('^\\|switch\\|p1a[^|]*' + PIVOT, 'i'))
        + ', |faint|p1a: ' + count(sdL, /^\|faint\|p1a/));
  } else if (!c.srcFaints) {
    claim(!srcSwitched,
      c.name + ' — the SOURCE never left the field at all',
      '|switch|p1a -> ' + PIVOT + ': ' + count(sdL, new RegExp('^\\|switch\\|p1a[^|]*' + PIVOT, 'i')));
  }
  /* 3. THE ARM ACTUALLY REACHED THE ONE BOARD THE TWO PREDICATES DISAGREE ABOUT — a fainted source
   *    still standing in its slot. Without this, RED-1 passing under the fix would be consistent with
   *    the sweep never having met the disagreement at all, and the counter would have no reader.
   *    It must be ZERO in the two controls: a pivot and a live source are the agreeing boards.
   *
   *    IT IS NOT AN EQUALITY, AND THE FIRST VERSION OF THIS CLAIM ASSERTED `=== 1` AND WENT RED UNDER
   *    THE KNOB FOR THE RIGHT REASON. The counter records the BOARD, not the removal: clean, the
   *    volatile goes on the first Update that sees the corpse and the board is met once; under
   *    `MEDI_VOLSRC_SLOT_ONLY=1` the volatile SURVIVES, so the same disagreeing board is met again on
   *    every Update until the replacement walks in — measured at 5 here. Both are correct readings of
   *    "how often did the two predicates disagree", so the claim is `> 0` against `=== 0`. */
  claim(c.srcFaints ? inSlot > 0 : inSlot === 0,
    c.name + ' — the sweep met a FAINTED source still in its slot '
      + (c.srcFaints ? 'at least once' : 'NEVER') + ' (the only board the two predicates disagree about)',
    'MEDSEEN.perTurnVolatileSourceFaintedInSlot +' + inSlot);
  /* 4. THE TARGET IS STILL ALIVE, so "no more Speed drops" means the volatile ended and not that
   *    the body carrying it is gone. */
  claim(count(sdL, /^\|faint\|p2a/) === 0 && count(meL, /^\|faint\|p2a/) === 0,
    c.name + ' — the TARGET never fainted',
    'faint lines on p2a: showdown ' + count(sdL, /^\|faint\|p2a/) + ', medicham ' + count(meL, /^\|faint\|p2a/));
  /* 5. THE AUTHORITY DID WHAT THE ARM'S NAME SAYS. Stated as an absolute for the two arms where the
   *    rule pins it; CTRL-B only claims "more than one", because how many residuals a 4-duration
   *    volatile survives is the clock's business and not this probe's. */
  if (c.drops != null) {
    claim(sdSpe === c.drops,
      c.name + ' — the AUTHORITY dropped the target\'s Speed exactly ' + c.drops + ' stage(s)',
      'showdown Speed stages lost: ' + sdSpe);
  } else {
    claim(sdSpe > 1, c.name + ' — the AUTHORITY kept ticking (more than one Speed stage lost)',
      'showdown Speed stages lost: ' + sdSpe);
  }

  /* ---- THE OUTCOME ----------------------------------------------------------------------------- */
  const same = sdSpe === meSpe;
  claim(same === (RED ? !c.part : true),
    c.name + ' — the two engines take the same number of Speed stages off the target'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    same ? 'identical (' + sdSpe + ')' : 'showdown ' + sdSpe + '  vs  medicham ' + meSpe);

  /* ---- AND THE BOARD LEAF THE DIFFERENTIAL ACTUALLY READS -------------------------------------- */
  const boardSame = !r.stateDiv;
  claim(boardSame === (RED ? !c.part : true),
    c.name + ' — the BOARD at the turn boundary'
      + (RED ? (c.part ? '   [--red: must PART]' : '   [--red: control, must HOLD]') : ''),
    boardSame ? 'identical at every boundary'
              : 'parts at t' + r.stateDiv.turn + ': ' + JSON.stringify(r.stateDiv.diffs.slice(0, 3)));
}

/* ---- THE ENGINE'S OWN RECEIPTS ------------------------------------------------------------------- */
console.log(NL + '  MEDSEEN.perTurnVolatileSourceLeft +'
  + ((SEEN.perTurnVolatileSourceLeft | 0) - b0.left));
console.log('  MEDFAILS.volSrcSlotOnlyRestored ' + (FAILS.volSrcSlotOnlyRestored | 0));

/* THE WIRE RAN AT ALL. A zero here across three arms — two of which END the volatile — means the
 * sweep never fired and every claim above is about an engine that never reached the rule. */
claim((SEEN.perTurnVolatileSourceLeft | 0) - b0.left > 0,
  'the source-left sweep fired at least once — a zero means the wire was never reached',
  'MEDSEEN.perTurnVolatileSourceLeft +' + ((SEEN.perTurnVolatileSourceLeft | 0) - b0.left));

if (RED) {
  claim((FAILS.volSrcSlotOnlyRestored | 0) === 1,
    'the RED arm actually ran with the knob — a restore that did not fire is a green arm in a red name',
    'MEDFAILS.volSrcSlotOnlyRestored = ' + (FAILS.volSrcSlotOnlyRestored | 0));
} else {
  claim((FAILS.volSrcSlotOnlyRestored | 0) === 0,
    'the CLEAN arm did NOT carry the restore knob',
    'MEDFAILS.volSrcSlotOnlyRestored = ' + (FAILS.volSrcSlotOnlyRestored | 0));
}
/* A SCRIPTED CLICK THAT WAS NOT ON SHOWDOWN'S REQUEST FALLS BACK TO `pass`, AND THAT IS SILENT.
 * ROADMAP #174: twelve green rows once proved nothing this way. */
{
  const sc = G.scriptCounters();
  claim((sc.moveNotOnRequest | 0) === 0, 'every scripted click was on the authority\'s request',
    'moveNotOnRequest = ' + sc.moveNotOnRequest + (sc.firstMissing ? '  (' + sc.firstMissing + ')' : ''));
}

console.log(NL + (fails ? 'RED   ' + fails + ' failing claim(s).' : 'GREEN  every claim held.'));
process.exit(fails ? 1 : 0);
