#!/usr/bin/env node
/* tests/probe_ability_boost_announce.js — AN ABILITY ANNOUNCES ITSELF ABOVE THE FIRST STAT LINE IT CAUSES
 *   node tests/probe_ability_boost_announce.js        node tests/probe_ability_boost_announce.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY (sim/battle.ts:2017-2085, `Battle#boost`. `data/mods/champions/scripts.ts` overrides
 * no `boost` — its only `boost` hits are the accuracy/evasion stage table and a `ModifyBoost` read):
 *
 *     let boosted = isSecondary;                                                            // :2034
 *     for (boostName in boost) {
 *       let boostBy = target.boostBy(currentBoost);        // the APPLIED delta, after the ±6 clamp
 *       if (boostBy) {
 *         switch (effect?.id) {
 *         case 'bellydrum': case 'angerpoint':  this.add('-setboost', ...); break;          // :2047
 *         default:
 *           ...
 *           } else {
 *             if (effect.effectType === 'Ability' && !boosted) {
 *               this.add('-ability', target, effect.name, 'boost');                         // :2066
 *               boosted = true;
 *             }
 *             this.add(msg, target, boostName, boostBy);                                    // :2069
 *           }
 *         }
 *       } else if (effect?.effectType === 'Ability') {
 *         if (isSecondary || isSelf) this.add(msg, target, boostName, boostBy);              // :2075
 *       }
 *     }
 *
 * FOUR CLAUSES: the announce is ABOVE the stat line; ONCE per `boost()` call, not per stat; it sits
 * INSIDE `if (boostBy)` so a capped stat announces NOTHING; and `boosted` starts at `isSecondary`.
 *
 * THIS ENGINE FAILED TWO OF THEM AND THE WHOLE-GAME DIFFERENTIAL COULD NOT SEE IT until 6.72.0 retired
 * its `ability-announcement` equivalence. Measured then on release 18773c22878f, --games 1200,
 * team-pool-frozen, middle, cap 50: 198 of 961 games where the authority announces and this engine
 * writes no line (stamina 112, speedboost 48, cloudnine 16, lightningrod 10, moody 8, weakarmor 2,
 * sapsipper 2) and 4 where this engine announces Defiant on a capped stat and the authority refuses.
 * docs/_reports/2026-09-19-ability-line-blindness.md §3a and §3c.
 *
 * THE FIX IS ONE FUNCTION — `abilityBoostRun` in engine/medicham2-browser.js — and EVERY
 * ability-sourced stat change in that file is routed through it. MEMBERSHIP IS NOT A LIST: each site
 * finds its ability through `data/tags.json`, and the class below is DERIVED from that artifact and
 * PRINTED on every run, so an ability added to any of those tags is announced with no code edit.
 *
 * THE ARMS — each is one staged game, both engines, the same pinned dice. What is compared is the
 * interleaved sequence of `|-ability|BODY|NAME|boost` and `|-boost|`/`|-unboost|` lines, so the ORDER
 * is asserted and not just the presence.
 *
 *   STAMINA       Archaludon (Stamina) takes a Thunderbolt.               announce, then -boost def 1
 *   SPEEDBOOST    Sharpedo (Speed Boost) stands for two turns.            announce, then -boost spe 1
 *   MOODY         Glalie (Moody) stands for two turns.                    ONE announce for the PAIR
 *   LIGHTNINGROD  Raichu (Lightning Rod) absorbs a Thunderbolt.           announce, then -boost spa 1
 *   SAPSIPPER     Azumarill (Sap Sipper) absorbs an Energy Ball.          announce, then -boost atk 1
 *   WEAKARMOR     Skarmory (Weak Armor) takes a Body Slam.                ONE announce, two lines
 *   DEFIANT-LIVE  Kingambit (Defiant) at +0 Atk eats an Icy Wind.         announce, then -boost atk 2
 *   DEFIANT-CAP   Kingambit at +6 Atk eats an Icy Wind.                   NO announce, `-boost atk 0`
 *   CTRL-*        the SAME bodies on a non-member ability. No member line in EITHER engine, so a
 *                 green arm is a statement about the ANNOUNCEMENT and not about the fixture.
 *
 * NARRATION ONLY, ASSERTED RATHER THAN CLAIMED: every arm also asserts `stateDiv === null` and
 * `boundariesAgreed === boundaries` — no board leaf parts on any arm, clean or red.
 *
 * RED FIRST: `--red` arms MEDI_ABILITY_BOOST_SILENT=1, which takes the whole shared road quiet —
 * silent on every member arm, and Defiant announcing unconditionally on DEFIANT-CAP. Both directions
 * must then FAIL and the controls must HOLD.
 *
 * THE KNOB IS NOT A BYTE-FOR-BYTE PRE-FIX ENGINE. For the six families that had no line at all it is
 * the old engine verbatim, and for Defiant it restores the unconditional line; for Berserk, Moxie /
 * Eelevate and Gooey it goes FURTHER, because those three already announced correctly and are
 * silenced with the rest. Measured on the pinned pool at --games 300: the knob costs 20 games where
 * the old engine cost 18, and the two extra are one Moxie and one Eelevate.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_ABILITY_BOOST_SILENT = '1';
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
const _ri = process.argv.indexOf('--release');
const REL = ER.open(_ri >= 0 ? process.argv[_ri + 1] : undefined);
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

/* ---- THE CLASS, DERIVED FROM data/tags.json AND PRINTED BEFORE ANYTHING READS IT -----------------
 * Every ability carrying a tag whose params describe a stat change that ability applies to a body,
 * walked to any depth (`typeImmunity.gain.boosts` is two levels down) and matched on SHAPE: a `boosts`
 * table, Moody's `randomStat`, or a `stat` + `stages` pair. A derived membership nobody looks at is
 * the over-match this project has paid for three times. */
const TAGS = require(D('data', 'tags.json'));
const MEMBERS = (() => {
  const out = {};
  const walk = (o, pre, ab, tag) => {
    if (!o || typeof o !== 'object') return;
    if (o.boosts && typeof o.boosts === 'object') (out[ab] = out[ab] || []).push(tag + '.' + pre + 'boosts');
    if (o.randomStat) (out[ab] = out[ab] || []).push(tag + '.' + pre + 'randomStat');
    if (o.stat && o.stages != null) (out[ab] = out[ab] || []).push(tag + '.' + pre + 'stat');
    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object' && k !== 'boosts')
      walk(o[k], pre + k + '.', ab, tag);
  };
  for (const ab of Object.keys(TAGS.abilities)) {
    const p = (TAGS.abilities[ab] || {}).params || {};
    for (const tag of Object.keys(p)) walk(p[tag], '', ab, tag);
  }
  return out;
})();
console.log('THE DERIVED CLASS — an ability whose tags carry a stat change it applies (data/tags.json):');
for (const ab of Object.keys(MEMBERS).sort()) console.log('    ' + ab.padEnd(18) + MEMBERS[ab].join(', '));
console.log('    ' + Object.keys(MEMBERS).length + ' abilities' + NL);
/* THE `-setboost` FAMILY IS OUTSIDE THE CLASS BY THE AUTHORITY'S OWN SWITCH (:2047 breaks before the
 * announce branch). It is named here so the exclusion is visible rather than silent. */
const SETBOOST_ONLY = Object.keys(MEMBERS).filter(ab => {
  const p = (TAGS.abilities[ab] || {}).params || {};
  return Object.values(p).some(v => v && v.boosts && Object.values(v.boosts).some(n => Math.abs(+n) >= 12));
});
console.log('    excluded (`-setboost` family, sim/battle.ts:2047 breaks before the announce): '
  + (SETBOOST_ONLY.join(', ') || 'none') + NL);
for (const need of ['stamina', 'speedboost', 'moody', 'lightningrod', 'sapsipper', 'weakarmor', 'defiant'])
  if (!MEMBERS[need]) {
    console.log('NOT RUN — ' + need + ' no longer carries a stat-change tag, so this probe would be '
      + 'asking nothing. This is not a pass.'); process.exit(2);
  }

/* ---- THE FIXTURE, CHECKED BY THE VALIDATOR'S OWN RULE -------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const PROT = { m: 'protect' };
const FILL_A = ['milotic', '', 'Marvel Scale', ['Protect']];
const FILL_B = ['toxapex', '', 'Merciless', ['Protect']];
const FILL_C = ['sinistcha', '', 'Heatproof', ['Protect']];
const ATK = mvs => ['gardevoir', '', 'Synchronize', mvs];

/* ONE attacker click at foe slot a. THE CARRIER MUST NOT PROTECT, or the arm is vacuous: Protect is
 * priority +4 and goes up before the attacker moves, so the first draft of this probe staged six games
 * in which nothing ever hit anything and every stream was empty. The carrier therefore clicks a weak
 * single-target move of its own at the attacker's PARTNER (Milotic, p1b) — one it actually learns, and
 * with no secondary and no raised crit ratio, so the arm carries no die of its own. */
const HIT = (mv, back) => ({ p1: [{ m: mv, t: 0 }, PROT], p2: [{ m: back, t: 1 }, PROT] });
const PASS = { p1: [PROT, PROT], p2: [PROT, PROT] };
/* The Defiant ladder: three Swords Dances to +6, then the Icy Wind. Kingambit's turn-4 click is Taunt
 * rather than a fourth Swords Dance, because a Swords Dance at the cap writes a bare `-fail` and this
 * probe is not about that line. */
const SD = { m: 'swordsdance' };
const DEF_CAP = [{ p1: [PROT, PROT], p2: [SD, PROT] },
                 { p1: [PROT, PROT], p2: [SD, PROT] },
                 { p1: [PROT, PROT], p2: [SD, PROT] },
                 { p1: [{ m: 'icywind' }, PROT], p2: [{ m: 'taunt', t: 0 }, PROT] }];
const DEF_LIVE = [{ p1: [{ m: 'icywind' }, PROT], p2: [{ m: 'taunt', t: 0 }, PROT] }];

const CASES = [
  { id: 'STAMINA', member: 'stamina',
    A: [ATK(['Thunderbolt', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['archaludon', '', 'Stamina', ['Protect', 'Smack Down']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [HIT('thunderbolt', 'smackdown')] },
  { id: 'CTRL-STAMINA', member: null,
    A: [ATK(['Thunderbolt', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['archaludon', '', 'Sturdy', ['Protect', 'Smack Down']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [HIT('thunderbolt', 'smackdown')] },
  { id: 'SPEEDBOOST', member: 'speedboost',
    A: [ATK(['Thunderbolt', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['sharpedo', '', 'Speed Boost', ['Protect']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [PASS, PASS], calls: 2 },
  { id: 'CTRL-SPEEDBOOST', member: null,
    A: [ATK(['Thunderbolt', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['sharpedo', '', 'Rough Skin', ['Protect']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [PASS, PASS] },
  { id: 'MOODY', member: 'moody',
    A: [ATK(['Thunderbolt', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['glalie', '', 'Moody', ['Protect']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [PASS, PASS], calls: 2 },
  { id: 'CTRL-MOODY', member: null,
    A: [ATK(['Thunderbolt', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['glalie', '', 'Inner Focus', ['Protect']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [PASS, PASS] },
  { id: 'LIGHTNINGROD', member: 'lightningrod',
    A: [ATK(['Thunderbolt', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['raichu', '', 'Lightning Rod', ['Protect', 'Quick Attack']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [HIT('thunderbolt', 'quickattack')] },
  { id: 'CTRL-LIGHTNINGROD', member: null,
    A: [ATK(['Thunderbolt', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['raichu', '', 'Static', ['Protect', 'Quick Attack']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [HIT('thunderbolt', 'quickattack')] },
  { id: 'SAPSIPPER', member: 'sapsipper',
    A: [ATK(['Energy Ball', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['azumarill', '', 'Sap Sipper', ['Protect', 'Aqua Jet']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [HIT('energyball', 'aquajet')] },
  { id: 'CTRL-SAPSIPPER', member: null,
    A: [ATK(['Energy Ball', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['azumarill', '', 'Thick Fat', ['Protect', 'Aqua Jet']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [HIT('energyball', 'aquajet')] },
  { id: 'WEAKARMOR', member: 'weakarmor',
    A: [ATK(['Body Slam', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['skarmory', '', 'Weak Armor', ['Protect', 'Payback']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [HIT('bodyslam', 'payback')] },
  { id: 'CTRL-WEAKARMOR', member: null,
    A: [ATK(['Body Slam', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['skarmory', '', 'Keen Eye', ['Protect', 'Payback']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: [HIT('bodyslam', 'payback')] },
  { id: 'DEFIANT-LIVE', member: 'defiant',
    A: [ATK(['Icy Wind', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['kingambit', '', 'Defiant', ['Swords Dance', 'Taunt', 'Protect']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: DEF_LIVE, redSame: true },
  { id: 'DEFIANT-CAP', member: 'defiant', capped: true,
    A: [ATK(['Icy Wind', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['kingambit', '', 'Defiant', ['Swords Dance', 'Taunt', 'Protect']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: DEF_CAP },
  { id: 'CTRL-DEFIANT', member: null,
    A: [ATK(['Icy Wind', 'Protect']), FILL_A], Abench: [FILL_B, FILL_C],
    B: [['kingambit', '', 'Supreme Overlord', ['Swords Dance', 'Taunt', 'Protect']], FILL_A], Bbench: [FILL_B, FILL_C],
    script: DEF_LIVE },
];

let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of [...c.A, ...c.Abench, ...c.B, ...c.Bbench]) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { bad(row[0] + ' is not in this format'); continue; }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) bad(sp.name + ' does not have ' + row[2]);
  if (row[1]) { const it = dex.items.get(row[1]); if (!legal(it)) bad(row[1] + ' is not in this format'); }
  for (const mv of row[3]) {
    if (!legal(dex.moves.get(mv))) { bad(mv + ' is not in this format'); continue; }
    if (!CS.canLearn(row[0], mv)) bad(sp.name + ' does not learn ' + mv);
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const unsplit = log => {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i] === '|split|p1' || log[i] === '|split|p2') { out.push(log[i + 1]); i += 2; continue; }
    out.push(log[i]);
  }
  return out;
};
/* The INTERLEAVED sequence, so the ORDER of the announce against the stat line is what is compared.
 * `[from]` and `[of]` are dropped from the stat line: the two engines tag attribution differently and
 * that is a SEPARATE divergence this probe is not about (it is named in the report's OWED section). */
const SEQ = lines => {
  const out = [];
  for (const l of lines) {
    const f = String(l).split('|');
    const who = /^(p[12][ab])/.exec(f[2] || '');
    if (!who) continue;
    if (f[1] === '-ability' && norm(f[4]) === 'boost') out.push('ABILITY:' + who[1] + ':' + norm(f[3]));
    else if (f[1] === '-boost' || f[1] === '-unboost')
      out.push(f[1].slice(1) + ':' + who[1] + ':' + norm(f[3]) + ':' + String(f[4]));
  }
  return out;
};

console.log((RED ? 'RED ARM — MEDI_ABILITY_BOOST_SILENT=1 (the engine as it stood: boosts, no announcements, '
                 + 'and Defiant announcing at the cap)' : 'CLEAN ARM') + NL);
const seen0 = SEEN.abilityBoostAnnounced | 0;

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(stage(c.Abench)));
  const b = G.buildPair(stage(c.B).concat(stage(c.Bbench)));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.id + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_ability_boost_announce :: ' + c.id,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.id + '   ' + r.err); fails++; continue; }
  const sdS = SEQ(unsplit(G.lastSdLog()));
  const meS = SEQ(r.mediTrace || []);
  const sdAnn = sdS.filter(x => /^ABILITY:/.test(x)), meAnn = meS.filter(x => /^ABILITY:/.test(x));
  console.log(NL + c.id);
  console.log('    showdown  ' + JSON.stringify(sdS));
  console.log('    medicham  ' + JSON.stringify(meS));

  /* THE AUTHORITY MUST SAY WHAT THE ARM CLAIMS, or the arm is asking nothing. This is the knob
   * cleared EXPLICITLY: a control whose authority stream also carries the line would prove nothing. */
  const wantAuth = c.member && !c.capped ? (c.calls || 1) : 0;
  claim(sdAnn.length === wantAuth,
    c.id + ' — THE AUTHORITY writes exactly ' + wantAuth + ' `|-ability|…|boost`'
      + (c.calls > 1 ? ' (one per `boost()` CALL — this arm makes ' + c.calls + ')' : ''),
    'showdown ' + JSON.stringify(sdAnn));
  if (c.capped) claim(sdS.some(x => /^boost:.*:atk:0$/.test(x)),
    c.id + ' — THE AUTHORITY writes the CAPPED zero line (so the fixture really is at +6)',
    'showdown ' + JSON.stringify(sdS.filter(x => /:atk:/.test(x))));
  /* EVERY announcement is IMMEDIATELY ABOVE a stat line — the authority's :2066 then :2069, with
   * nothing between. Asserted per announcement rather than on the first one, because an arm whose
   * stream carries an UNRELATED earlier stat line (Icy Wind's own `-unboost` on DEFIANT-LIVE) would
   * make a `first stat line` test say the opposite of the truth. */
  if (c.member && !c.capped) claim(sdAnn.length === wantAuth
      && sdS.every((x, i) => !/^ABILITY:/.test(x) || /^(un)?boost:/.test(sdS[i + 1] || '')),
    c.id + ' — THE AUTHORITY puts each announcement IMMEDIATELY ABOVE a stat line',
    'showdown ' + JSON.stringify(sdS));

  /* DEFIANT-LIVE IS A CONTROL IN THE RED ARM AND SAYING SO IS THE POINT. The pre-fix engine announced
   * Defiant UNCONDITIONALLY, which is the RIGHT line whenever the boost actually applies — the defect
   * was only ever the capped case, which DEFIANT-CAP carries. An arm that "must part" here would be
   * asserting a defect that never existed, and would go green on an engine that had lost the line
   * entirely. */
  if (RED && c.member && !c.redSame) {
    claim(JSON.stringify(meS) !== JSON.stringify(sdS),
      c.id + ' — [--red] this engine PARTS from the authority again (the defect restored)',
      'medicham ' + JSON.stringify(meS));
  } else {
    claim(JSON.stringify(meS) === JSON.stringify(sdS),
      c.id + ' — this engine writes the SAME interleaved announce/stat sequence'
        + (RED ? '   [--red: control, must HOLD]' : ''),
      'showdown ' + JSON.stringify(sdS) + NL + '          medicham ' + JSON.stringify(meS));
  }

  /* NARRATION ONLY — ASSERTED ON EVERY ARM, IN BOTH DIRECTIONS. A knob that moved a board would make
   * this a state fix wearing a narration label, which is the one thing the brief forbids claiming. */
  claim(r.stateDiv === null && r.boundaries === r.boundariesAgreed,
    c.id + ' — NO BOARD LEAF PARTS (narration only)'
      + (RED ? '   [--red: still no board moves, so the knob is a LINE knob]' : ''),
    'stateDiv=' + JSON.stringify(r.stateDiv) + '  boundaries ' + r.boundariesAgreed + '/' + r.boundaries);
}

const n = (SEEN.abilityBoostAnnounced | 0) - seen0;
console.log(NL + '  counters this run:  abilityBoostAnnounced +' + n
  + '   abilityBoostRunsSilent ' + (SEEN.abilityBoostRunsSilent | 0)
  + '   first ' + JSON.stringify(SEEN.abilityBoostAnnouncedFirst || ''));
if (RED) {
  claim((FAILS.abilityBoostAnnounceRestored | 0) > 0, 'the RED arm STAMPED its restore counter',
    'MEDFAILS.abilityBoostAnnounceRestored = ' + (FAILS.abilityBoostAnnounceRestored | 0));
  claim(n === 0, 'the RED arm announced NOTHING through the shared road — the knob reached the rule',
    'abilityBoostAnnounced +' + n);
} else {
  claim((FAILS.abilityBoostAnnounceRestored | 0) === 0, 'the CLEAN arm carries NO restore stamp',
    String(FAILS.abilityBoostAnnounceRestored | 0));
  claim(n >= 7, 'the seven member arms announced at least seven times — the fixture is not vacuous',
    'abilityBoostAnnounced +' + n);
}
console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
