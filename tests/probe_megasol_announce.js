#!/usr/bin/env node
/* tests/probe_megasol_announce.js — MEGA SOL SAYS SO, AND ONLY THE FIVE MOVES THAT ASK IT TO
 *   node tests/probe_megasol_announce.js        node tests/probe_megasol_announce.js --red
 * ==================================================================================================
 *
 * THE AUTHORITY, sim/pokemon.ts:2195-2202 — `effectiveWeather` takes a SECOND ARGUMENT and the whole
 * announcement hangs off it:
 *
 *     effectiveWeather(sourceEffect?: Effect, message?: string | boolean) {
 *       if (!sourceEffect && this.battle.effect) sourceEffect = this.battle.effect;
 *       if (this.battle.activePokemon?.hasAbility('megasol') && sourceEffect &&
 *           (sourceEffect.id === 'megasol' || sourceEffect.effectType === 'Move' ||
 *            sourceEffect.effectType === 'Weather') && sourceEffect.id !== 'electroshot') {
 *         if (weather !== 'sunnyday' && message) this.battle.add('-activate', this, 'ability: Mega Sol');
 *         return 'sunnyday' as ID;
 *       }
 *
 * This engine has the RETURN — Mega Sol's private sun reaches the damage path (WIRE 99), the type
 * path (WIRE 126), the charge path (ROADMAP #186), Leaf Guard and the sky's freeze refusal. It has
 * never had the LINE, because the line is gated on `message` and only FIVE callers pass it.
 *
 * THE MEMBERSHIP IS DERIVED AND THE PROBE CHECKS THE DERIVATION AGAINST THE SOURCE. The engine reads
 * `data/tags.json` and cannot see a handler body, so it matches on the tag shape
 * `weatherScaled.byWeather.sun` carrying either `chargeSkip` or a `healFraction`. That is a SHAPE,
 * and a shape can over-match — so this file ALSO walks the live dex for handlers containing
 * `effectiveWeather(<something>, true)` and FAILS if the two memberships differ by one entry either
 * way. Measured on the tree of 2026-09-07: both are exactly
 * `moonlight, morningsun, solarbeam, solarblade, synthesis`, 5 of 5, with nothing on either side.
 * Growth and Weather Ball read the weather WITHOUT a message and must stay out; CTRL-C is Weather
 * Ball, standing in the arm rather than in a sentence.
 *
 * THREE POOL GAMES on release `2cfe3ebc4098`, all a Meganium-Mega Solar Beam:
 *   event missing from medicham2 :: |-activate|p2b|megasol <> |-damage|p1a|0fnt
 *   event missing from medicham2 :: |-activate|p2b|megasol <> |-resisted|p1a|2
 *   event missing from medicham2 :: |-activate|p2b|megasol <> |-activate|p1a|protect
 *
 * THE FIVE ARMS, AND THE THREE KNOBS THEY TURN.
 *
 *   RED-1  Solar Beam, NO weather        — the authority writes the line under `-prepare`. Pool game.
 *   RED-2  Synthesis, NO weather         — the same line one CALLER over, so the fix cannot be a
 *          Solar Beam special case. The authority writes it above the `-heal`.
 *   CTRL-A THE SKY. Solar Beam under a REAL SUN — `weather !== 'sunnyday'` is false, so the authority
 *          writes NOTHING. Same body, same ability, same move; only the field moved.
 *   CTRL-B THE ABILITY. A NON-MEGA Meganium's Solar Beam with no weather — no private sun, no line,
 *          and the move CHARGES instead of firing. Without this arm "always announce" would pass.
 *   CTRL-C THE MOVE. Weather Ball from the SAME Meganium-Mega — it reads the weather through
 *          `effectiveWeather()` with NO message, so no line. And the arm is not vacuous: the private
 *          sun still makes it FIRE, which is asserted by firing it into a Ghost body that a NORMAL
 *          Weather Ball cannot touch at all.
 *
 * RED FIRST: `MEDI_MEGASOL_SILENT=1` restores the single expression this fix turns on.
 * Any run carrying it also carries a non-zero `MEDFAILS.megaSolSilentRestored`.
 * ================================================================================================ */
'use strict';
const RED = process.argv.includes('--red');
if (RED) process.env.MEDI_MEGASOL_SILENT = '1';
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
const LS = dex.data.Learnsets;
const TAGS = require(D('data', 'tags.json'));
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

/* ==== THE MEMBERSHIP, PRINTED BEFORE IT IS TRUSTED, AND CHECKED AGAINST THE SOURCE ================
 * A derived tag that over-matches is this repository's standing failure (`refusesStatusMoves` caught
 * Telepathy and Wonder Guard; `speedOnItemLoss` caught Sticky Hold). So both memberships are computed
 * and both are PRINTED, and a difference of one entry either way is a FAILURE rather than a note. */
const SHAPE = Object.entries(TAGS.moves || {}).filter(([, row]) => {
  const p = row.params && row.params.weatherScaled;
  const s = p && p.byWeather && p.byWeather.sun;
  return !!(s && (s.chargeSkip || s.healFraction != null));
}).map(([id]) => id).sort();
const HANDLERS = ['onTryMove', 'onHit', 'onModifyMove', 'onModifyType', 'onBasePower',
                  'basePowerCallback', 'onPrepareHit'];
const SOURCE = dex.moves.all().filter(legal).filter(m => HANDLERS.some(h => {
  const s = String(m[h] || '');
  return /effectiveWeather\s*\([^)]*,[^)]*true[^)]*\)/.test(s);
})).map(m => m.id).sort();
console.log('THE MEMBERSHIP, BOTH WAYS, BEFORE ANYTHING IS WIRED:');
console.log('  tag shape  (weatherScaled.byWeather.sun with chargeSkip or healFraction): ' + SHAPE.join(', '));
console.log('  the source (a handler passing `message` to effectiveWeather):             ' + SOURCE.join(', '));
console.log('  shape-only: ' + (SHAPE.filter(x => !SOURCE.includes(x)).join(', ') || '(none)')
  + '   source-only: ' + (SOURCE.filter(x => !SHAPE.includes(x)).join(', ') || '(none)') + NL);

const MEGA = ['meganium', 'Meganiumite', 'Overgrow', ['Solar Beam', 'Synthesis', 'Weather Ball', 'Sunny Day', 'Protect']];
const BASE = ['meganium', '', 'Overgrow', ['Solar Beam', 'Synthesis', 'Weather Ball', 'Sunny Day', 'Protect']];
const CLEF = ['clefable', '', 'Unaware', ['Protect']];
/* THE GHOST IS CTRL-C'S WHOLE POINT. Weather Ball is NORMAL with no weather and FIRE under the
 * private sun, and Normal cannot touch a Ghost at all — so "did the private sun still work while
 * saying nothing" is answered by whether the move lands, not by a second `-activate` line. */
const GHOST = ['gengar', '', 'Cursed Body', ['Protect', 'Shadow Ball']];
const PLAIN = ['snorlax', '', 'Thick Fat', ['Protect', 'Body Slam']];

const PROT = { m: 'protect' };
const CLICK = (m, mega) => ({ m, t: 0, mega: !!mega });
const SELF = (m, mega) => ({ m, t: 0, mega: !!mega });
const IDLE = m => ({ m, t: 1 });

const CASES = [
  { name: 'RED-1   SOLAR BEAM, no weather   [the authority writes |-activate| ability: Mega Sol]',
    part: true, sd: 1, me: 1, mega: true,
    A: [MEGA, CLEF], B: [PLAIN, CLEF],
    what: 'The pool game. `onTryMove` writes `-prepare`, then asks the weather WITH a message, then '
        + 'fires this turn instead of charging.',
    script: [{ p1: [CLICK('solarbeam', true), PROT], p2: [IDLE('bodyslam'), PROT] }] },

  /* TWO CLICKS, TWO LINES. The wounding turn spends a Synthesis of its own and the authority
   * announces on BOTH — measured, and asserted as 2 rather than 1, because an arm that expected one
   * line while the authority wrote two would have been the probe being wrong, not the engine. */
  { name: 'RED-2   SYNTHESIS, no weather   [the same line one CALLER over, on both clicks]',
    part: true, sd: 2, me: 2, mega: true,
    A: [MEGA, CLEF], B: [PLAIN, CLEF],
    what: 'A heal, not a charge. Carried because a fix wired into the charge branch alone would pass '
        + 'RED-1 and leave three of the five callers silent.',
    wound: true,
    script: [{ p1: [SELF('synthesis', true), PROT], p2: [{ m: 'bodyslam', t: 0 }, PROT] },
             { p1: [SELF('synthesis', false), PROT], p2: [IDLE('bodyslam'), PROT] }] },

  { name: 'CTRL-A  THE SKY — Solar Beam under a REAL SUN   [the authority writes NOTHING]',
    part: false, sd: 0, me: 0, mega: true,
    A: [MEGA, CLEF], B: [PLAIN, CLEF],
    what: '`weather !== "sunnyday"` is the announcement\'s own guard. Same body, same ability, same '
        + 'move — only the field moved, and the line must disappear with it.',
    sun: true,
    script: [{ p1: [SELF('sunnyday', true), PROT], p2: [IDLE('bodyslam'), PROT] },
             { p1: [CLICK('solarbeam', false), PROT], p2: [IDLE('bodyslam'), PROT] }] },

  { name: 'CTRL-B  THE ABILITY — a NON-MEGA Meganium\'s Solar Beam   [no line, and it CHARGES]',
    part: false, sd: 0, me: 0, mega: false, charges: true,
    A: [BASE, CLEF], B: [PLAIN, CLEF],
    what: 'No mega, no Mega Sol, no private sun. Without this arm an unconditional announcement '
        + 'would pass RED-1 and RED-2.',
    script: [{ p1: [CLICK('solarbeam', false), PROT], p2: [IDLE('bodyslam'), PROT] }] },

  { name: 'CTRL-C  THE MOVE — Weather Ball from the SAME Meganium-Mega   [no line, and it is FIRE]',
    part: false, sd: 0, me: 0, mega: true, fire: true,
    A: [MEGA, CLEF], B: [GHOST, CLEF],
    what: 'Weather Ball asks `effectiveWeather()` with NO message, so the authority stays silent — '
        + 'and the private sun is still WORKING, which the arm proves by landing a FIRE Weather Ball '
        + 'on a Ghost that a NORMAL one cannot touch.',
    script: [{ p1: [CLICK('weatherball', true), PROT], p2: [IDLE('shadowball'), PROT] }] },
];

/* ---- LEGALITY AND THE FACTS EVERY ARM RESTS ON --------------------------------------------------- */
let illegal = 0;
const bad = s => { console.log('ILLEGAL FIXTURE  ' + s); illegal++; };
for (const c of CASES) for (const row of c.A.concat(c.B)) {
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
  const mm = dex.species.get('meganiummega');
  if (!legal(mm)) bad('Meganium-Mega is not in this format');
  if (dex.abilities.get(Object.values(mm.abilities)[0]).id !== 'megasol')
    bad('Meganium-Mega\'s ability is ' + JSON.stringify(mm.abilities) + ', not Mega Sol');
  const pw = TAGS.abilities.megasol && TAGS.abilities.megasol.params.privateWeather;
  if (!(pw && Array.isArray(pw.actsAsWeather) && pw.actsAsWeather.includes('sun')))
    bad('Mega Sol no longer carries privateWeather sun: ' + JSON.stringify(pw));
  /* THE ANNOUNCEMENT'S DISPLAY NAME IS READ, NOT TYPED. */
  if ((TAGS.abilities.megasol || {}).name !== 'Mega Sol')
    bad('the tag calls the ability ' + JSON.stringify((TAGS.abilities.megasol || {}).name));
  /* CTRL-C's WHOLE ARGUMENT. */
  if (dex.getImmunity('Normal', dex.species.get(GHOST[0]).types))
    bad(GHOST[0] + ' is no longer immune to Normal, so CTRL-C proves nothing');
  if (!dex.getImmunity('Fire', dex.species.get(GHOST[0]).types))
    bad(GHOST[0] + ' is immune to Fire, so a working private sun still lands nothing');
  const wb = TAGS.moves.weatherball && TAGS.moves.weatherball.params.weatherScaled;
  if (!(wb && wb.byWeather && wb.byWeather.sun && wb.byWeather.sun.type))
    bad('Weather Ball no longer changes type in the sun: ' + JSON.stringify(wb));
  if (SHAPE.includes('weatherball')) bad('Weather Ball is INSIDE the announcing membership; CTRL-C is not a control');
}
/* THE DERIVATION ITSELF IS AN ASSERTION, not a printed note. */
claim(SHAPE.length === 5 && SOURCE.length === 5
      && SHAPE.join(',') === SOURCE.join(','),
  'the TAG-SHAPE membership and the SOURCE membership are the same set — a shape that over-matched '
    + 'would announce Mega Sol on a move the authority keeps silent, and nothing else would say so',
  'shape [' + SHAPE.join(', ') + ']   source [' + SOURCE.join(', ') + ']');
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE RUN ------------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(s => ({ species: s, item: '', ability: '', moves: ['Protect'] }));
const megasolLines = lines => lines.filter(l => /^\|-activate\|[^|]+\|ability: Mega Sol/i.test(String(l))).length;
const has = (lines, re) => lines.some(l => re.test(String(l)));

console.log((RED ? 'RED ARM — MEDI_MEGASOL_SILENT=1 (the announcement removed)' : 'CLEAN ARM') + NL);

for (const c of CASES) {
  const a = G.buildPair(stage(c.A).concat(BENCH('milotic', 'toxapex')));
  const b = G.buildPair(stage(c.B).concat(BENCH('toxapex', 'milotic')));
  if (!a || !b) { console.log('NOT-STAGED  ' + c.name + '   (this is not a pass)'); fails++; continue; }
  const r = G.playGame(a, b, 'directed', 'probe_megasol_announce :: ' + c.name,
                       { script: c.script, arm: ARM });
  if (r.err) { console.log('THREW       ' + c.name + '   ' + r.err); fails++; continue; }
  const sdL = G.lastSdLog(), meL = r.mediTrace || [];
  const sdN = megasolLines(sdL), meN = megasolLines(meL);

  console.log(NL + c.name);
  console.log('    ' + c.what);
  console.log('    showdown  |-activate| ability: Mega Sol x' + sdN);
  console.log('    medicham  |-activate| ability: Mega Sol x' + meN);

  /* ---- THE FIXTURE REACHED THE RULE ------------------------------------------------------------- */
  claim(has(sdL, /^\|detailschange\|.*meganium-mega/i) === !!c.mega,
    c.name + ' — the Meganium ' + (c.mega ? 'DID' : 'did NOT') + ' mega evolve on the authority, '
      + 'which is what puts Mega Sol on the field at all',
    sdL.filter(l => /^\|detailschange\|/.test(String(l))).join(' | ') || '(no forme change)');
  if (c.sun) claim(has(sdL, /^\|-weather\|SunnyDay/i),
    c.name + ' — a REAL sun is up on the authority, so the announcement\'s own guard is the '
      + 'variable and not the absence of a click',
    sdL.filter(l => /^\|-weather\|/.test(String(l))).slice(0, 3).join(' | ') || '(no weather line)');
  if (c.charges) claim(has(sdL, /^\|-prepare\|/) && !has(sdL, /^\|-damage\|p2a/),
    c.name + ' — with no private sun the move CHARGED and dealt nothing this turn, which is the '
      + 'ability knob doing something visible',
    sdL.filter(l => /^\|(-prepare|-damage)\|/.test(String(l))).join(' | ') || '(nothing)');
  if (c.fire) {
    const sdHit = has(sdL, /^\|-damage\|p2a/), meHit = has(meL, /^\|-damage\|p2a/);
    claim(sdHit && meHit,
      c.name + ' — a FIRE Weather Ball landed on the Ghost on BOTH engines, so the private sun is '
        + 'working while saying nothing. A Normal Weather Ball would have read |-immune|',
      'showdown hit ' + sdHit + ', medicham hit ' + meHit + '   '
        + sdL.filter(l => /^\|-(damage\|p2a|immune)/.test(String(l))).slice(0, 2).join(' | '));
  }
  if (c.wound) claim(has(sdL, /^\|-heal\|p1a/),
    c.name + ' — the user actually HEALED, so the announcing caller ran at all',
    sdL.filter(l => /^\|-heal\|p1a/.test(String(l))).join(' | ') || '(no heal)');

  /* ---- THE OUTCOME ----------------------------------------------------------------------------- */
  claim(sdN === c.sd, c.name + ' — THE AUTHORITY writes ' + c.sd + ' Mega Sol line(s)', 'showdown ' + sdN);
  const want = RED && c.part ? 0 : c.me;
  claim(meN === want,
    c.name + ' — this engine writes ' + want + ' Mega Sol line(s)'
      + (RED ? (c.part ? '   [--red: the defect restored]' : '   [--red: control, must HOLD]') : ''),
    'medicham ' + meN);
}

/* ---- THE RESTORE FLAG IS LOUD -------------------------------------------------------------------- */
if (RED) {
  claim((FAILS.megaSolSilentRestored | 0) > 0,
    'the RED arm STAMPED a failure counter', 'MEDFAILS.megaSolSilentRestored = ' + (FAILS.megaSolSilentRestored | 0));
} else {
  claim((FAILS.megaSolSilentRestored | 0) === 0, 'the CLEAN arm carries NO restore stamp',
    String(FAILS.megaSolSilentRestored | 0));
  claim((SEEN.privateWeatherAnnounced | 0) > 0,
    'the announcement counter MOVED — a wire nobody can see fire is assumed broken',
    'MEDSEEN.privateWeatherAnnounced = ' + (SEEN.privateWeatherAnnounced | 0));
}

console.log(NL + (fails ? 'FAILED — ' + fails + ' claim(s)' : 'PASSED — every claim held'));
process.exit(fails ? 1 : 0);
