#!/usr/bin/env node
/* tests/probe_contact_ability_transfer.js — M8 / ROADMAP #541, WIRE 80
 * ==================================================================================================
 * WHEN A CONTACT HIT MOVES AN ABILITY, DOES THE RIGHT BODY GET ANNOUNCED AND DOES THE ACQUIRED
 * ABILITY START?
 *
 * THE CARRIERS ARE DERIVED, NOT RECALLED, AND THE DIAGNOSIS REPORT HAS THEM WRONG. #541 measured
 * Wandering Spirit 5, Mummy 2 and the MOVE Skill Swap ZERO; `Skill Swap` in those cards is the effect
 * NAME `Battle#skillSwap` prints for an ABILITY-driven swap. §0 walks the format and prints every
 * legal carrier of every `rewritesAbilityOnContact` ability, so a probe that staged the move would be
 * visibly staging something else.
 *
 * THE AUTHORITY, BOTH HANDLERS, RE-OPENED. `/data/mods/champions/abilities.ts` mentions neither
 * `mummy` nor `wanderingspirit` — §0 greps it on every run — so `data/abilities.ts` is the rule.
 *
 *   wanderingspirit.onDamagingHit(damage, target, source, move) {
 *     if (this.checkMoveMakesContact(move, source, target)) this.skillSwap(source, target); }
 *
 *   Battle#skillSwap(source, target)                                     sim/battle.ts:1311
 *     if (source.fainted || target.fainted) return false;
 *     ...
 *     this.add('-activate', source, 'Skill Swap', targetAbility.name, sourceAbility.name, `[of] ${target}`);
 *                          ^^^^^^ THE ATTACKER, not the holder
 *     source.ability = targetAbility.id;   target.ability = sourceAbility.id;
 *     this.singleEvent('Start', sourceAbility, target.abilityState, target);
 *     this.singleEvent('Start', targetAbility, source.abilityState, source);
 *                          ^^^^^^^^^^^^^^^^^^ BOTH acquired abilities START, holder first
 *
 *   mummy.onDamagingHit(...) { ... source.setAbility('mummy', target); }
 *   Pokemon#setAbility -> case 'mummy':                                   sim/pokemon.ts
 *     this.battle.add('-activate', source, sourceEffect.fullname, this, '[ability] ' + oldAbility.name);
 *                                  ^^^^^^ the HOLDER; `this` (field 4) is the ATTACKER
 *     ... this.battle.singleEvent('Start', ability, this.abilityState, this, source);
 *
 * THIS ENGINE, WIRE 80, BEFORE THIS PASS:
 *
 *   swap:    const _t=m.ability; m.ability=tg.ability; tg.ability=_t;
 *            TR.act(tg,'ability: '+_t); TR.ab(m,m.ability); TR.ab(tg,tg.ability);
 *   infect:  m.ability=String(_rw.becomes);
 *            TR.act(tg,'ability: '+tg.ability); TR.ab(m,m.ability,'[from] ability: '+tg.ability);
 *
 * **THE TWO WRITES PICK THE RIGHT BODIES. The ANNOUNCEMENT picks `tg`, the holder, where `skillSwap`
 * picks `m`, the attacker — and no `Start` is raised for either acquired ability at all.** A fix aimed
 * at the write moves nothing, which is why this probe asserts the STREAM and the acquired ability's
 * EFFECT, and not the two ability leaves alone.
 *
 * The board half of that is real: on the Scrafty card the authority hands Runerigus an Intimidate and
 * immediately drops BOTH of the attacker's side's Attack stages; we announced and applied nothing.
 * Arm 1 stages exactly that.
 *
 * `TR.abswap` — the correct one-line emitter — HAS EXISTED IN THIS FILE SINCE THE MOVE BRANCH WAS
 * WIRED AND WIRE 80 NEVER CALLED IT. That is the capability-present-but-uncalled shape this project
 * is named for, so this probe asserts the protocol (`r.div`) as well as the board.
 *
 * THE FOUR ARMS. `r.div` is the DIFFERENTIAL'S OWN first protocol divergence and `runOne`'s verdict is
 * `board_state.js` against the authority's board; nothing here declares an expected value.
 *
 * THE HOLDER MUST NOT CLICK PROTECT, AND THE FIRST FORM OF THIS PROBE DID. A shielded Crunch never
 * reaches `onDamagingHit` on EITHER engine, so all four arms read IDENTICAL over a mechanic that had
 * not run — the vacuous-green shape. The holder clicks Shadow Claw at the far foe instead, and §3
 * asserts both modes actually fired.
 *
 *   1. wanderingspirit-swaps-with-an-intimidate-attacker   the defect, both halves at once: the
 *      announcement body, and an acquired Intimidate that has to fire on the holder.
 *   2. mummy-infects-the-attacker                          the other mode. The body is already right;
 *      what is missing is fields 4 and 5 and the `Start`.
 *   3. no-contact-no-transfer (CONTROL)                    the same boards, a STATUS click. Nothing
 *      transfers, nothing announces, no Attack moves. A fix that fired on every move passes 1 and 2
 *      and fails here.
 *   4. the-swapped-ability-goes-when-the-body-leaves       the swap, then the attacker is ROARED out.
 *      `clearVolatile()` restores `baseAbility` on the authority, so the benched body must read its
 *      OWN ability again on both engines. This arm exists because the fix routes the swap through
 *      `abRewrite` — the same door the MOVE Skill Swap already uses — instead of a bare assignment,
 *      and a bare assignment never reverted.
 *
 * RED-FIRST KNOB: `MEDI_CONTACT_ABILITY_LEGACY=1` restores WIRE 80 exactly as it stood — the holder's
 * announcement, no `Start`, and the bare assignment. Under it arms 1 and 4 go red on the BOARD and
 * arms 1, 2 and 4 go red on the PROTOCOL; arm 3 stays green on both. The Mummy arm's board does NOT
 * move, because that write was already on the right body and `mummy` has no `onStart` — its whole
 * defect is the announcement, and the probe says so rather than claiming a board it cannot produce.
 * Any run carrying the knob also carries a non-zero `MEDFAILS.contactAbilityLegacyRestored`.
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

const KNOB = process.env.MEDI_CONTACT_ABILITY_LEGACY === '1';
console.log('\ntests/probe_contact_ability_transfer.js — M8 / #541 the contact ability transfer');
console.log('  MEDI_CONTACT_ABILITY_LEGACY=' + (KNOB ? '1  (PRE-FIX ENGINE)' : '0'));

/* ---- 0. THE MEMBERSHIP AND THE AUTHORITY, DERIVED ON EVERY RUN --------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legalSp = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const legal = x => x.exists && !x.isNonstandard;
const MODDIR = process.env.SHOWDOWN_PATH + '/data/mods/champions/';

console.log('\n0. WHO ACTUALLY CARRIES A CONTACT ABILITY REWRITE IN THIS REGULATION');
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tags.json'), 'utf8'));
const rows = (TAGS.ability || TAGS.abilities || {});
const MEMBERS = Object.keys(rows).filter(k => {
  const r = rows[k];
  const t = r && (r.params || r);
  return t && t.rewritesAbilityOnContact;
});
for (const ab of MEMBERS) {
  const carriers = D.species.all().filter(s => legalSp(s)
    && Object.values(s.abilities).map(a => D.abilities.get(a).id).includes(ab));
  console.log('     ' + ab + '  mode=' + (rows[ab].params || rows[ab]).rewritesAbilityOnContact.mode
    + '  legal carriers: ' + (carriers.map(s => s.name).join(', ') || '(NONE — dead in this format)'));
}
ok(MEMBERS.includes('wanderingspirit') && MEMBERS.includes('mummy'),
   'the tag\'s membership includes both modes this probe stages',
   'matched: ' + MEMBERS.join(', '));

const MODAB = fs.readFileSync(MODDIR + 'abilities.ts', 'utf8');
ok(!/wanderingspirit|mummy/.test(MODAB),
   'Champions overrides neither handler — data/abilities.ts and sim/battle.ts are the rule',
   /wanderingspirit|mummy/.test(MODAB) ? 'the mod DOES carry one of them — read that block' : null);
ok(!!D.moves.get('crunch').flags.contact,
   'Crunch makes contact — the gate this whole mechanic hangs on',
   'flags: ' + JSON.stringify(D.moves.get('crunch').flags));
ok(D.moves.get('swordsdance').category === 'Status' && !D.moves.get('swordsdance').flags.contact,
   'Swords Dance makes no contact — the control click really is outside the gate', null);
/* And that the ATTACKER's ability is one whose Start does something visible, or arm 1 proves nothing. */
ok(Object.values(D.species.get('scrafty').abilities).map(a => D.abilities.get(a).id).includes('intimidate'),
   'Scrafty legally carries Intimidate, whose onStart is the observable this arm reads',
   JSON.stringify(D.species.get('scrafty').abilities));

/* ==================================================================================================
 * THE FOUR BOARDS
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* Incineroar is given BLAZE, not its Intimidate, on purpose: a second Intimidate on the board would
 * make an Attack stage unattributable to the one this probe is about. */
const A_SPIRIT = () => [mon('runerigus', '', 'Wandering Spirit', ['Protect', 'Shadow Claw']),
                        mon('incineroar', '', 'Blaze', ['Protect', 'Roar'])]
                       .concat(FILL('milotic', 'toxapex'));
const A_MUMMY  = () => [mon('cofagrigus', '', 'Mummy', ['Protect', 'Shadow Claw']),
                        mon('incineroar', '', 'Blaze', ['Protect', 'Roar'])]
                       .concat(FILL('milotic', 'toxapex'));
const B_SCRAFTY = () => [mon('scrafty', '', 'Intimidate', ['Crunch', 'Swords Dance', 'Protect']),
                         mon('snorlax', '', 'Thick Fat', ['Protect'])]
                        .concat(FILL('garchomp', 'corviknight'));

const SCEN = [
  { id: 'wanderingspirit-swaps-with-an-intimidate-attacker',
    kind: 'ability', shape: 'the announcement body, and the acquired ability\'s Start',
    census: 'ability/rewritesAbilityOnContact {mode:swap} — sim/battle.ts:1311 skillSwap',
    what: 'Scrafty (Intimidate) Crunches a Runerigus (Wandering Spirit). `skillSwap(source, target)` '
        + 'announces on the ATTACKER with both ability names and `[of] the holder`, writes each '
        + 'ability onto the other body, and then STARTS both — so Runerigus acquires Intimidate and '
        + 'immediately drops both of Scrafty\'s side\'s Attack. This engine announced on the holder '
        + 'and started nothing.',
    negative: 'arm 3 is the same board with a Status click: no contact, so nothing may move and no '
            + 'Attack stage may change.',
    A: A_SPIRIT(), B: B_SCRAFTY(),
    script: [
      { p1: [{ m: 'shadowclaw', t: 1 }, { m: 'protect' }], p2: [{ m: 'crunch', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'shadowclaw', t: 1 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] },
    ] },

  { id: 'mummy-infects-the-attacker',
    kind: 'ability', shape: 'the announcement\'s missing fields 4 and 5',
    census: 'ability/rewritesAbilityOnContact {mode:infect} — sim/pokemon.ts setAbility, case mummy',
    what: 'Scrafty Crunches a Cofagrigus (Mummy) and becomes a Mummy body. The authority writes '
        + '`-activate <holder>|ability: Mummy|<attacker>|[ability] <the attacker\'s old ability>` — '
        + 'the right body and four fields. This engine wrote two fields and then an `-ability` line '
        + 'the authority does not emit for this case at all (setAbility takes the `mummy` branch, '
        + 'never `default`).',
    negative: 'arm 3, the Status click on the same pair of boards.',
    A: A_MUMMY(), B: B_SCRAFTY(),
    script: [
      { p1: [{ m: 'shadowclaw', t: 1 }, { m: 'protect' }], p2: [{ m: 'crunch', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'shadowclaw', t: 1 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] },
    ] },

  { id: 'no-contact-no-transfer',
    kind: 'ability', shape: 'THE CONTROL — the gate is contact and nothing else',
    census: 'ability/rewritesAbilityOnContact — the negative case',
    what: 'THE CONTROL. The identical Wandering Spirit board, and Scrafty clicks Swords Dance both '
        + 'turns. `checkMoveMakesContact` is false, so no ability moves, nothing is announced and no '
        + 'Attack stage changes on either side. An engine that transferred on any damaging event, or '
        + 'that ran an acquired Start unconditionally, passes arms 1 and 2 and fails here.',
    negative: 'arms 1 and 2 ARE this arm with one click changed from Swords Dance to Crunch.',
    A: A_SPIRIT(), B: B_SCRAFTY(),
    script: [
      { p1: [{ m: 'shadowclaw', t: 1 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] },
      { p1: [{ m: 'shadowclaw', t: 1 }, { m: 'protect' }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] },
    ] },

  { id: 'the-swapped-ability-goes-when-the-body-leaves',
    kind: 'ability', shape: 'the rewrite is undone by leaving the field',
    census: 'ability/rewritesAbilityOnContact {mode:swap} — the switch-out road',
    what: 'The same swap, and then Incineroar ROARS the Scrafty out. `clearVolatile()` restores '
        + '`this.ability = this.baseAbility` on the authority, so the benched Scrafty must read its '
        + 'OWN Intimidate again — and the Runerigus that never left keeps what it was given. WIRE 80 '
        + 'wrote the swap with a bare assignment, which nothing undoes; the fix routes it through '
        + '`abRewrite`, the same door the MOVE Skill Swap has always used.',
    negative: 'arm 1 is the same swap with nobody leaving, where the swapped ability must STAY.',
    A: A_SPIRIT(), B: B_SCRAFTY(),
    script: [
      { p1: [{ m: 'shadowclaw', t: 1 }, { m: 'protect' }], p2: [{ m: 'crunch', t: 0 }, { m: 'protect' }] },
      { p1: [{ m: 'shadowclaw', t: 1 }, { m: 'roar', t: 0 }], p2: [{ m: 'swordsdance' }, { m: 'protect' }] },
    ] },
];

console.log('\n1. THE FOUR BOARDS, PLAYED AGAINST THE AUTHORITY');
/* WHICH ARM THE KNOB IS EXPECTED TO REDDEN, SPLIT BY WHAT IT REDDENS. The Mummy arm's defect is
 * PROTOCOL ONLY -- the write was already on the right body and `mummy` has no `onStart` -- so its
 * BOARD stays green under the knob, and labelling it "expected RED" there would be a false
 * expectation dressed as a control. The two swap arms move both. */
const GOV_BOARD = new Set(['wanderingspirit-swaps-with-an-intimidate-attacker',
                           'the-swapped-ability-goes-when-the-body-leaves']);
const GOV_PROTO = new Set(['wanderingspirit-swaps-with-an-intimidate-attacker',
                           'mummy-infects-the-attacker',
                           'the-swapped-ability-goes-when-the-body-leaves']);
for (const sc of SCEN) {
  const r = SB.runOne(sc);
  const detail = r.verdict === 'IDENTICAL' ? null
    : (r.why ? r.why : r.boards.map(b => (b.unexplained || [])
        .map(d => 'turn ' + b.turn + '  ' + d.path + '   ours ' + JSON.stringify(d.us)
                  + ' / authority ' + JSON.stringify(d.sd)).join('\n')).filter(Boolean).join('\n'));
  const gov = GOV_BOARD.has(sc.id) ? KNOB : false;
  ok(r.verdict === 'IDENTICAL', sc.id + '  -> ' + r.verdict
     + (gov ? '   [expected RED: the knob is armed]' : ''), detail);
  console.log('          leaves compared ' + (r.compared == null ? '(not staged)' : r.compared));
  ok(r.script ? r.script.moveNotOnRequest === 0 : false,
     '  every scripted click was actually on the request',
     r.script ? (r.script.moveNotOnRequest ? 'first missing: ' + r.script.firstMissing : null)
              : 'the driver reported no script counters at all');
}

/* ==================================================================================================
 * 2. THE PROTOCOL, WHICH IS WHERE THE ANNOUNCEMENT LIVES
 * ==================================================================================================
 * The board cannot see which body an `-activate` names. `playGame` returns the DIFFERENTIAL'S OWN
 * first protocol divergence (`div`) from its own aligner, so this asserts the announcement against
 * the authority without this file holding a copy of the expected line. The engine's own stream is
 * printed beside it so a red arm says WHAT it wrote rather than only that it was wrong. */
console.log('\n2. THE ANNOUNCEMENT, AGAINST THE AUTHORITY\'S OWN STREAM');
const G = SB.harness();
for (const sc of SCEN) {
  const a = G.buildPair(sc.A), b = G.buildPair(sc.B);
  const r = G.playGame(a, b, 'directed', 'm8-' + sc.id, { script: sc.script,
    onBoundary: (snap) => { snap.identical = true; snap.diffs = []; } });
  const mine = (r.mediTrace || []).filter(l => /-activate|-ability|-unboost/.test(l));
  const gov = GOV_PROTO.has(sc.id) ? KNOB : false;
  console.log('    [' + sc.id + ']');
  for (const l of mine) console.log('      me  ' + l);
  ok(!r.err, '  the arm played without throwing', r.err || null);
  ok(r.div == null, '  the protocol never parted' + (gov ? '   [expected RED: the knob is armed]' : ''),
     r.div ? JSON.stringify(r.div).slice(0, 700) : null);
}

/* ==================================================================================================
 * 3. THE ENGINE'S OWN RECEIPTS
 * ================================================================================================== */
console.log('\n3. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M.MEDSEEN, F = M.MEDFAILS;
if (S && F) {
  console.log('     contactAbilitySwapped ' + S.contactAbilitySwapped
    + '   contactAbilityInfected ' + S.contactAbilityInfected
    + '   acquiredAbilityStartRan ' + S.acquiredAbilityStartRan);
  console.log('     acquiredAbilityStartNoSide ' + F.acquiredAbilityStartNoSide
    + '   contactAbilityLegacyRestored ' + F.contactAbilityLegacyRestored);
  ok(KNOB ? F.contactAbilityLegacyRestored === 1 : F.contactAbilityLegacyRestored === 0,
     'the restore knob reports its own state',
     'contactAbilityLegacyRestored=' + F.contactAbilityLegacyRestored);
  ok(KNOB || (S.contactAbilitySwapped > 0 && S.contactAbilityInfected > 0),
     'both modes actually fired — the staging reached the mechanic on both roads',
     'swapped=' + S.contactAbilitySwapped + ' infected=' + S.contactAbilityInfected
     + (KNOB ? '  (the legacy branch keeps no receipts, which is why this is not asked under the knob)' : ''));
  ok(KNOB || S.acquiredAbilityStartRan > 0,
     'an acquired ability\'s Start was actually run — it ran ZERO times before this pass',
     'acquiredAbilityStartRan=' + S.acquiredAbilityStartRan);
  ok(F.acquiredAbilityStartNoSide === 0,
     'no acquired Start was skipped for want of a side — the loud half of the new door',
     'acquiredAbilityStartNoSide=' + F.acquiredAbilityStartNoSide);
} else {
  ok(false, 'MEDSEEN / MEDFAILS are readable off the frozen engine', 'the release does not export them');
}

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
