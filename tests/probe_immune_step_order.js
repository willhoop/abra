#!/usr/bin/env node
/* tests/probe_immune_step_order.js — TWO IMMUNITY FAMILIES ANSWER AT THE WRONG HIT STEP
 *   node tests/probe_immune_step_order.js      node tests/probe_immune_step_order.js --red
 * ==================================================================================================
 *
 * `trySpreadMoveHit` is STEP-MAJOR: every step runs over EVERY target before the next step starts
 * (sim/battle-actions.ts:550-610). So WHICH STEP a refusal answers at decides the ORDER the `-immune`
 * lines come out in when a spread move hits more than one body, and the slot order does not.
 *
 *     step 0  hitStepInvulnerabilityEvent
 *     step 1  hitStepTryHitEvent          runEvent('TryHit')  -> the ONTRYHIT abilities
 *     step 2  hitStepTypeImmunity         targets[i].runImmunity(move, ...)
 *     step 3  hitStepTryImmunity          powder / onTryImmunity
 *
 * TWO FAMILIES SIT AT THE WRONG STEP IN THIS ENGINE, IN OPPOSITE DIRECTIONS:
 *
 *   LEVITATE / EELEVATE — ONE STEP EARLY. The authority does NOT give Levitate an `onTryHit`
 *     handler at all; `data/abilities.ts:2301` is a comment reading *"airborneness implemented in
 *     sim/pokemon.js:Pokemon#isGrounded"*, and the announcement is written inside `runImmunity`,
 *     which is STEP 2:
 *         const notImmune = type === 'Ground' ? this.isGrounded(negateImmunity) : ...
 *         if (notImmune === null) {
 *           if (this.hasAbility('levitate'))  this.battle.add('-immune', this, '[from] ability: Levitate');
 *           else if (this.hasAbility('eelevate')) ... Eelevate
 *           else this.battle.add('-immune', this);
 *         } else this.battle.add('-immune', this);
 *                                                            sim/pokemon.ts:2242-2284
 *     This engine answered it from `absorbedBy` inside `_stepTryHit` — STEP 1 — so on an Earthquake
 *     the Levitate body's line jumped ahead of every bare type immunity on the field.
 *
 *     `isGrounded` returns NULL only where the ABILITY is what lifted the body: Gravity, Ingrain,
 *     Smack Down and Iron Ball return TRUE above it and the FLYING clause returns FALSE above it
 *     (sim/pokemon.ts:2153-2165). A Flying-typed Levitate carrier — Rotom-Fan is one, and it is legal
 *     in this format — is therefore announced BARE, which is why the attribution is asked of
 *     `isGrounded`'s own clause order rather than of the ability name.
 *
 *   SOUNDPROOF / BULLETPROOF / OVERCOAT — TWO STEPS LATE. All three are plain `onTryHit` handlers
 *     (data/abilities.ts:4426, :470, :3098) and answer at STEP 1. This engine asked
 *     `moveClassBlocked` from `_stepTryImm` — STEP 3 — so a Soundproof body's line fell BEHIND a
 *     bare type immunity that the authority prints after it.
 *
 * MEASURED ON THE PINNED POOL, release `f30bf025ae28`: FIVE narration-only games, every one of them
 * in the `ordering` class, four Levitate and one Soundproof. The Soundproof card is
 * `pair-protect-bust …` — Clanging Scales into a Kommo-o (Soundproof) at p2a and a Mawile (Fairy,
 * bare) at p2b:
 *     showdown  |-immune|p2a: Kommo-o|[from] ability: Soundproof   |-immune|p2b: Mawile
 *     medicham  |-immune|p2b: Mawile                               |-immune|p2a: Kommo-o|…Soundproof
 *
 * THE SIX ARMS, AND WHY NO TWO OF THEM CAN BE SATISFIED BY THE SAME WRONG RULE.
 *
 *   RED-LEV    Earthquake, ally Charizard (bare) at p1b and a Levitate Hydreigon at p2a. The
 *              ABILITY line must come SECOND. A rule that hoists ability refusals to the front
 *              fails here.
 *   RED-SND    Clanging Scales into Mawile at p2a (bare) and a Soundproof Kommo-o at p2b. The
 *              ABILITY line must come FIRST, AGAINST the slot order. A rule that emits immunities in
 *              target order fails here — and it is the arm that refuses "just walk the targets".
 *   CTRL-ORDER The same Earthquake with TWO BARE immunities (Charizard p1b, Staraptor p2a). Both
 *              engines must read slot order in BOTH arms. Without it, RED-LEV's inversion could be
 *              "this engine walks its targets backwards" and nothing here would know.
 *   CTRL-DARK  Psychic into the SAME Hydreigon: a DARK immunity, announced BARE, because
 *              `runImmunity`'s ternary only reaches `isGrounded` when the move type is Ground.
 *   RED-FLY    Earthquake into a Rotom-Fan: Electric/FLYING **and** Levitate, announced BARE,
 *              because the Flying clause answers above the ability clause. The only legal body in
 *              this format that separates "has Levitate" from "was lifted BY Levitate" — and a THIRD
 *              red, found by writing the arm rather than aimed at: the pre-batch engine attributed
 *              it too. No card in the pinned pool reaches it; Rotom-Fan is not in the frozen store.
 *   CTRL-LAND  The same Earthquake into three grounded bodies: no `-immune` line at all and three
 *              `-damage` lines in target order. A fixture that stopped hitting anything would
 *              otherwise satisfy every immunity assertion above by emitting nothing.
 *
 * THE LAST TWO WERE ADDED AFTER THE FIRST CUT WAS MEASURED. It closed the five ordering games and
 * OPENED two — a Psycho Cut and a Psychic into a Hydreigon, both announced `[from] ability: Levitate`
 * where the authority is bare. The argument was right and the reader was too wide; these two arms are
 * the clauses the RED arm cannot reach.
 *
 * RED FIRST: `MEDI_IMMUNE_STEP_LEGACY=1` restores BOTH old placements at once — Levitate back to
 * step 1 and the move-class refusals back to step 3 — so the restore reproduces the same two reds
 * rather than a third behaviour, and any run carrying it also carries a non-zero
 * `MEDFAILS.immuneStepLegacyRestored`.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_IMMUNE_STEP_LEGACY = '1';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));
process.argv.push('--state', '--end-state');
const G = require(D('engine', 'game_differential.js'));
const ER = require(D('engine', 'engine_release.js'));
const REL = ER.open();
const M = REL.require('engine/medicham2-browser.js');
const SEEN = M.MEDSEEN, FAILS = M.MEDFAILS;
const NL = String.fromCharCode(10);
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) throw new Error('the middle arm is gone from game_differential.js');

let fails = 0;
const claim = (ok, what, detail) => {
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + what + (detail ? NL + '          ' + detail : ''));
  if (!ok) fails++;
};

/* ---- THE FIXTURE, DERIVED ------------------------------------------------------------------------ */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
/* ROADMAP #565 — THE LEGALITY GATE ASKS THE VALIDATOR, NOT THE RAW ROWS. The prevo walk this line
 * replaced accepted any entry on the species or on a prevo whatever its SOURCE tag, so a move a prevo
 * learned by a gen-7 TM (`7M`, `7V`) read as legal here while `TeamValidator` refused it — which is how
 * illegal fixtures passed their own gates (tests/test-fixture-legality.js, batch 2).
 * `champions_sim.canLearn` IS `checkCanLearn`, cached per pair. */
const learns = (sp, mv) => CS.canLearn(sp, mv);
/* THE FILLER CLICK IS DERIVED, NEVER NAMED. Every body that must be HIT by the spread move is barred
 * from Protect — a shielded body answers at step 1 and prints no `-immune` at all, which would make
 * this file assert the absence of the very line it is about. What it clicks instead has to be inert
 * with respect to the immunity: a SELF-targeting stat boost moves no type, no ability and no
 * groundedness. The list is walked in order and the first learnable member is taken, so a body that
 * loses one still stages. A body that learns NONE fails the fixture out loud rather than silently
 * falling back on Protect. */
/* EVERY MEMBER IS CHECKED AGAINST THE FORMAT BEFORE IT IS USED, and one was removed from this list
 * for cause: the first draft opened with a move carrying `isNonstandard: 'Past'`, which `fillerFor`
 * correctly skipped — and CLAUDE.md's rule is that an entity outside the regulation is not named at
 * all, not that it is named and then filtered. */
const FILLER_PREF = ['swordsdance', 'nastyplot', 'bulkup', 'irondefense', 'honeclaws', 'agility'];
const fillerFor = sp => {
  for (const m of FILLER_PREF) {
    const mm = dex.moves.get(m);
    if (legal(mm) && mm.target === 'self' && mm.category === 'Status' && learns(sp, m)) return m;
  }
  return null;
};

/* species, item, ability, extra moves beyond the derived filler */
const ROWS = {
  chomp:  ['garchomp',   '', 'Rough Skin', ['Earthquake']],
  zard:   ['charizard',  '', 'Blaze',      []],
  hydra:  ['hydreigon',  '', 'Levitate',   []],
  incin:  ['incineroar', '', 'Blaze',      []],
  star:   ['staraptor',  '', 'Reckless',   []],   /* Intimidate would drop Attack and add protocol */
  fan:    ['rotomfan',   '', 'Levitate',   []],   /* Electric/FLYING and Levitate — both clauses at once */
  delph:  ['delphox',    '', 'Blaze',      ['Psychic']],
  kommoA: ['kommoo',     '', 'Bulletproof', ['Clanging Scales']],   /* the ATTACKER: not Soundproof */
  kommoD: ['kommoo',     '', 'Soundproof', []],                     /* the REFUSER */
  mawile: ['mawile',     '', 'Sheer Force', []],  /* Intimidate would drop Attack and add protocol */
  pex:    ['toxapex',    '', 'Merciless',  []],
};

/* ---- THE FOUR ARMS ------------------------------------------------------------------------------- */
/* `want` is written as (slot, attribution) pairs in the order the AUTHORITY prints them. Both engines
 * are asserted against it, so a fix that made the two agree on a third order fails. */
const CASES = [
  { id: 'RED-LEV',
    name: 'RED-LEV    Earthquake — a BARE ally immunity, then a LEVITATE foe',
    what: 'allAdjacent resolves [ally, foeA, foeB] = [p1b, p2a, p2b]. Charizard is Flying, so '
        + 'isGrounded returns FALSE at the type clause and the line is BARE; Hydreigon is airborne by '
        + 'the ABILITY, so isGrounded returns NULL and the line names Levitate. Both are written by '
        + 'runImmunity at STEP 2, in target order, so the BARE one comes first. This engine answered '
        + 'Levitate from absorbedBy at STEP 1 and printed it first.',
    A: ['chomp', 'zard'], B: ['hydra', 'incin'],
    click: { mv: 'earthquake', slot: 0, side: 'p1' },
    immune: [['p1b', ''], ['p2a', 'levitate']],
    damage: ['p2b'] },

  { id: 'RED-SND',
    name: 'RED-SND    Clanging Scales — a SOUNDPROOF foe at p2b, AHEAD of a bare foe at p2a',
    what: 'allAdjacentFoes resolves [p2a, p2b]. Mawile is Fairy and refuses Dragon on the chart — '
        + 'STEP 2, bare. Kommo-o refuses a sound move from onTryHit — STEP 1 — so the authority '
        + 'prints the SOUNDPROOF line FIRST even though it stands in the LATER slot. This engine '
        + 'asked moveClassBlocked at STEP 3 and printed it last.',
    A: ['kommoA', 'zard'], B: ['mawile', 'kommoD'],
    click: { mv: 'clangingscales', slot: 0, side: 'p1' },
    immune: [['p2b', 'soundproof'], ['p2a', '']],
    damage: [] },

  { id: 'CTRL-ORDER',
    name: 'CTRL-ORDER Earthquake — TWO bare immunities, so target order is the whole answer',
    what: 'The same click with the Levitate body replaced by a second Flying body. Both lines are '
        + 'written by the same STEP 2 loop, so both engines must read [p1b, p2a] — in BOTH arms. '
        + 'This is what makes RED-LEV a statement about the STEP rather than about the walk.',
    A: ['chomp', 'zard'], B: ['star', 'incin'],
    click: { mv: 'earthquake', slot: 0, side: 'p1' },
    immune: [['p1b', ''], ['p2a', '']],
    damage: ['p2b'] },

  /* THESE TWO ARMS ARE THE COST OF THE FIRST CUT, AND THEY ARE HERE BECAUSE THE FIRST CUT WAS WRONG
   * IN THE MEASUREMENT AND NOT IN THE ARGUMENT. Attributing every airborne body's `-immune` to
   * Levitate closed five games and opened two — `-immune field 3 :: |-immune|p1a <> |-immune|p1a|
   * [from]levitate`, a Psycho Cut and a Psychic into a Hydreigon. Both guard a clause of
   * `runImmunity` that the RED arm cannot reach. */
  { id: 'CTRL-DARK',
    name: 'CTRL-DARK  a NON-GROUND immunity on a Levitate body — the line is BARE',
    what: 'Psychic into a Hydreigon is a DARK immunity off getImmunity, and runImmunity\'s ternary '
        + 'only reaches isGrounded when the move type is Ground (sim/pokemon.ts:2270). So Levitate '
        + 'says nothing here. The first cut of this fix announced it anyway and traded two games for '
        + 'two others on the run that measured it.',
    A: ['delph', 'zard'], B: ['hydra', 'incin'],
    click: { mv: 'psychic', slot: 0, side: 'p1' },
    immune: [['p2a', '']],
    damage: [] },

  { id: 'RED-FLY',
    name: 'RED-FLY    a FLYING-typed Levitate carrier — BARE, because Flying answers first',
    what: 'Rotom-Fan is Electric/FLYING and carries Levitate. isGrounded tests Flying ABOVE the '
        + 'ability (sim/pokemon.ts:2160-2161) and returns FALSE rather than NULL, so the authority '
        + 'writes the bare line. A reader that branched on the ability NAME instead of on isGrounded\'s '
        + 'clause order would attribute this one, and this is the only legal body in the format that '
        + 'can tell the two readings apart. IT IS A THIRD RED, NOT A CONTROL: it was written as one '
        + 'and the --red arm printed `[from] ability: Levitate` too, so the engine was wrong here '
        + 'BEFORE this batch as well. Nothing in the pinned pool lands on it — Rotom-Fan is not in '
        + 'the frozen team store — so it is a defect this probe found rather than one it was aimed at.',
    A: ['chomp', 'incin'], B: ['fan', 'pex'],
    click: { mv: 'earthquake', slot: 0, side: 'p1' },
    immune: [['p2a', '']],
    damage: ['p1b', 'p2b'] },

  { id: 'CTRL-LAND',
    name: 'CTRL-LAND  Earthquake into three grounded bodies — NO immunity, three damage lines',
    what: 'Nobody is immune, so the arms above cannot be passing by emitting nothing. The three '
        + '-damage lines must come out in the same [p1b, p2a, p2b] target order on both engines.',
    A: ['chomp', 'kommoD'], B: ['incin', 'pex'],
    click: { mv: 'earthquake', slot: 0, side: 'p1' },
    immune: [],
    damage: ['p1b', 'p2a', 'p2b'] },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON --------------------------------------------------- */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
const FILLER = {};
for (const [key, row] of Object.entries(ROWS)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  const f = fillerFor(row[0]);
  if (!f) { bad(sp.name + ' learns no self-targeting stat boost from ' + JSON.stringify(FILLER_PREF)
    + ', so it has no inert click and cannot be staged without Protect'); continue; }
  FILLER[key] = dex.moves.get(f).name;
  for (const mv of row[3].concat([f])) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { bad(mv + ' is not in this format'); continue; }
    if (!learns(row[0], mv)) bad(sp.name + ' does not learn ' + m.name);
  }
}
{
  const eq = dex.moves.get('earthquake'), cs = dex.moves.get('clangingscales');
  const py = dex.moves.get('psychic');
  if (py.target !== 'normal') bad('Psychic now targets ' + py.target + ', so CTRL-DARK would hit more than one body');
  if (py.type !== 'Psychic') bad('Psychic is no longer Psychic-typed');
  if (dex.getImmunity('Psychic', dex.species.get('hydreigon').types))
    bad('Hydreigon is no longer immune to Psychic, so CTRL-DARK asks nothing');
  if (dex.getImmunity('Ground', dex.species.get('rotomfan').types))
    bad('Rotom-Fan is no longer immune to Ground');
  if (dex.species.get('rotomfan').types.indexOf('Flying') < 0)
    bad('Rotom-Fan has lost its Flying type, so CTRL-FLYING no longer separates the two clauses');
  if (eq.target !== 'allAdjacent') bad('Earthquake now targets ' + eq.target + ', not allAdjacent — the ally is no longer hit');
  if (eq.type !== 'Ground') bad('Earthquake is no longer Ground');
  if (cs.target !== 'allAdjacentFoes') bad('Clanging Scales now targets ' + cs.target);
  if (!cs.flags.sound) bad('Clanging Scales is no longer a sound move, so Soundproof would not answer');
  /* THE IMMUNITIES THEMSELVES, ASKED OF THE FORMAT. */
  if (dex.getImmunity('Ground', dex.species.get('charizard').types))
    bad('Charizard is no longer immune to Ground');
  if (dex.getImmunity('Ground', dex.species.get('staraptor').types))
    bad('Staraptor is no longer immune to Ground');
  if (dex.getImmunity('Dragon', dex.species.get('mawile').types))
    bad('Mawile is no longer immune to Dragon');
  for (const s of ['incineroar', 'toxapex', 'kommoo', 'hydreigon'])
    if (!dex.getImmunity('Ground', dex.species.get(s).types) && s !== 'hydreigon')
      bad(s + ' has become Ground-immune on the chart, which would change which line it prints');
  /* LEVITATE IS STILL HANDLER-LESS UPSTREAM. If a future dex gave it an onTryHit, the whole premise
   * of this file — that it answers at step 2 — would be false, and this says so instead of the arms
   * quietly measuring something else. */
  const lev = dex.abilities.get('levitate');
  if (lev.onTryHit) bad('Levitate has grown an onTryHit handler; it no longer answers at step 2');
  if (!dex.abilities.get('soundproof').onTryHit) bad('Soundproof has lost its onTryHit handler');
  if (!Object.values(dex.species.get('hydreigon').abilities)
    .map(a => dex.abilities.get(a).id).includes('levitate')) bad('Hydreigon no longer has Levitate');
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = keys => keys.map(k => {
  const r = ROWS[k];
  return { species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3].concat([FILLER[k]]) };
});
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));

/* THE SPECTATOR HALF OF EVERY `|split|` IS DROPPED, and reading it was the first fault this file
 * had: Showdown's raw log carries `|split|pN`, the omniscient line, then the same line with the HP
 * as a percentage, so every `-damage` came back DOUBLED and the LANDED clause read
 * `["p2b","p2b"]` against `["p2b"]`. `game_differential.js`'s own `sdStream` (:2340) does exactly
 * this three-line skip; it is module-local, so the same six lines are here rather than a fifth
 * private reading of the log. `-immune` is not split and was never affected — which is precisely
 * why a fault in a SECOND assertion is worth naming: it fires on the clause that proves the fixture
 * is not vacuous, and a vacuous fixture is this repository's signature failure. */
const unsplit = log => {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i] === '|split|p1' || log[i] === '|split|p2') { out.push(log[i + 1]); i += 2; continue; }
    out.push(log[i]);
  }
  return out;
};
/* THE TWO READERS. A slot code plus the `[from]` name, lowercased, is exactly what the differential
 * compares after normalisation — the species name and the namespace are dropped there too. */
const IMM = lines => lines.map(l => /^\|-immune\|(p[12][ab])[^|]*(?:\|(.*))?$/.exec(String(l)))
  .filter(Boolean)
  .map(m => [m[1], String(m[2] || '').toLowerCase().replace(/\[from\]\s*/, '').replace(/^ability:\s*/, '').trim()]);
const DMG = lines => lines.map(l => /^\|-damage\|(p[12][ab])[^|]*\|/.exec(String(l)))
  .filter(Boolean).map(m => m[1]);
const show = pairs => JSON.stringify(pairs.map(p => p[0] + (p[1] ? '|' + p[1] : '')));

console.log((RED ? 'RED ARM — MEDI_IMMUNE_STEP_LEGACY=1 (Levitate back at step 1, move-class refusals back at step 3)'
                 : 'CLEAN ARM') + NL);

const lev0 = SEEN.airborneImmuneAtTypeStep | 0, snd0 = SEEN.moveClassRefusedAtTryHit | 0;

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'toxapex')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  /* THE ATTACKER CLICKS THE SPREAD MOVE; EVERY OTHER BODY CLICKS ITS DERIVED SELF-BOOST. Nothing
   * Protects, because a shielded body prints no `-immune` line and this file is about that line. */
  const idle = (keys, i) => ({ m: FILLER[keys[i]].toLowerCase().replace(/[^a-z0-9]/g, ''), t: 0 });
  const script = [{
    p1: [c.click.slot === 0 ? { m: c.click.mv, t: 0 } : idle(c.A, 0),
         c.click.slot === 1 ? { m: c.click.mv, t: 0 } : idle(c.A, 1)],
    p2: [idle(c.B, 0), idle(c.B, 1)],
  }];
  const r = G.playGame(a, b, 'directed', 'probe_immune_step_order :: ' + c.id, { script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = unsplit(G.lastSdLog()), meL = r.mediTrace || [];
  const sdI = IMM(sdL), meI = IMM(meL), sdD = DMG(sdL), meD = DMG(meL);

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  -immune ' + show(sdI) + '   -damage ' + JSON.stringify(sdD));
  console.log('    medicham  -immune ' + show(meI) + '   -damage ' + JSON.stringify(meD));

  /* ---- THE FIXTURE REACHED THE RULE ------------------------------------------------------------- */
  claim(show(sdI) === show(c.immune),
    c.id + ' — THE AUTHORITY prints ' + show(c.immune),
    'showdown ' + show(sdI));
  /* THE DAMAGE SIDE IS ASSERTED ON THE AUTHORITY TOO, so an arm whose click stopped landing says so
   * rather than passing on an empty immunity list. */
  claim(JSON.stringify(sdD.filter(s => c.damage.includes(s))) === JSON.stringify(c.damage),
    c.id + ' — the click LANDED on the authority, on ' + JSON.stringify(c.damage),
    'showdown -damage ' + JSON.stringify(sdD));

  /* ---- THE OUTCOME ----------------------------------------------------------------------------- */
  /* WHAT THE RED ARM IS ALLOWED TO MOVE, WRITTEN OUT rather than "not equal": a restore that produced
   * a THIRD order would otherwise read as the defect reproduced. */
  const legacy = c.id === 'RED-LEV' ? [['p2a', 'levitate'], ['p1b', '']]
    : c.id === 'RED-SND' ? [['p2a', ''], ['p2b', 'soundproof']]
      /* THE THIRD RED. The old engine attributed a Flying-typed Levitate carrier's Ground immunity
       * to the ability, because `absorbedBy` matched on the tag and nothing asked which CLAUSE of
       * `isGrounded` had answered. */
      : c.id === 'RED-FLY' ? [['p2a', 'levitate']]
        : c.immune;
  const want = RED ? legacy : c.immune;
  claim(show(meI) === show(want),
    c.id + ' — this engine prints ' + show(want)
      + (RED ? (show(legacy) === show(c.immune) ? '   [--red: control, must HOLD]' : '   [--red: the defect restored]') : ''),
    'medicham ' + show(meI));
  claim(JSON.stringify(meD.filter(s => c.damage.includes(s))) === JSON.stringify(c.damage),
    c.id + ' — the click LANDED here too, on ' + JSON.stringify(c.damage),
    'medicham -damage ' + JSON.stringify(meD));
}

/* ---- THE COUNTERS SAY THE KNOB REACHED THE RULE --------------------------------------------------- */
const levN = (SEEN.airborneImmuneAtTypeStep | 0) - lev0;
const sndN = (SEEN.moveClassRefusedAtTryHit | 0) - snd0;
console.log(NL + '  counters this run:  airborneImmuneAtTypeStep +' + levN
  + '   moveClassRefusedAtTryHit +' + sndN);
if (RED) {
  claim((FAILS.immuneStepLegacyRestored | 0) > 0,
    'the RED arm STAMPED a failure counter — a switch that silently makes the engine wrong is the '
      + 'silent default this repository keeps paying for',
    'MEDFAILS.immuneStepLegacyRestored = ' + (FAILS.immuneStepLegacyRestored | 0));
  claim(levN === 0 && sndN === 0,
    'the RED arm took NEITHER new road — the knob reached both rules, not one of them',
    'airborneImmuneAtTypeStep +' + levN + ', moveClassRefusedAtTryHit +' + sndN);
} else {
  claim((FAILS.immuneStepLegacyRestored | 0) === 0,
    'the CLEAN arm carries NO restore stamp', String(FAILS.immuneStepLegacyRestored | 0));
  claim(levN > 0,
    'the Levitate refusal was answered at STEP 2 at least once — the fixture is not vacuous',
    'airborneImmuneAtTypeStep +' + levN);
  claim(sndN > 0,
    'the move-class refusal was answered at STEP 1 at least once — the fixture is not vacuous',
    'moveClassRefusedAtTryHit +' + sndN);
}

console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
