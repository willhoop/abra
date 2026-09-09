#!/usr/bin/env node
/* tests/probe_forme_revert_silent.js — NARRATION BATCH R, CLUSTER 1
 * ==================================================================================================
 * WHEN A NON-PERMANENT FORME COMES OFF, DOES THE AUTHORITY SAY ANYTHING? IT DOES NOT.
 *
 * THE AUTHORITY, READ THIS RUN (§0 below re-reads and asserts both lines rather than quoting them):
 *
 *   data/mods/champions/scripts.ts   `clearVolatile()` closes with `this.setSpecies(this.baseSpecies)`
 *                                    and `setSpecies` (sim/pokemon.ts) writes NO protocol line at all.
 *   sim/battle.ts (faintMessages)    the ONLY `detailschange` a faint can produce is guarded by
 *                                    `if (pokemon.formeRegression)`, and it carries `[silent]`.
 *   data/mods/champions/scripts.ts   `formeChange` sets `formeRegression` only in the `!source`
 *                                    (Tera) branch — Champions DELETED the Item/mega branch's copy
 *                                    ("Don't revert Mega Evolutions after fainting"). Stance Change
 *                                    calls `formeChange(targetForme)` with no `isPermanent` at all,
 *                                    so it takes neither branch and NOTHING is announced.
 *
 * So a Stance Change body that flips to Aegislash-Blade and then leaves the field — by dying or by
 * pivoting — goes back to Aegislash SILENTLY. medicham2 performed the revert through `formeSwap`,
 * whose whole job is to announce a forme change, and therefore wrote a line the authority never
 * writes:
 *
 *     showdown   |faint|p1a: Aegislash
 *     medicham2  |detailschange|p1a: Aegislash|aegislash, L50      <-- invented
 *                |faint|p1a: Aegislash
 *
 * THREE NARRATION-ONLY CAUSES in `data/game-differential.json` on release `0c5a4da9c512`
 * (`|faint|pXY <> |detailschange|pXY|aegislash,l50` at p1a, p2a and p1b), plus the switch-out road,
 * which this file measures too and which the pool did not happen to surface.
 *
 * WHAT IS ASSERTED, AND WHY EACH ARM EXISTS
 *
 *   REAL-FAINT   the flip lands, the body is KILLED. Showdown writes zero `detailschange`; so must
 *                medicham2. The BOARD must stay identical, which is what stops "delete the revert"
 *                from passing this file — the corpse's species and stats are compared leaves.
 *   REAL-PIVOT   the same flip, the body SWITCHES OUT instead. The other door onto `clearVolatile`.
 *   CONTROL-FLIP the `-formechange` that PUTS the body into Blade forme must still be written by
 *                BOTH engines. Without it a simulator that had no Stance Change at all would score
 *                a clean sweep here, because it would never revert and never announce.
 *   CONTROL-MEGA a mega evolution on the same board. `detailschange` is exactly the line a mega DOES
 *                write, in both engines. This is what separates "the revert is silent" from
 *                "detailschange was switched off".
 *
 * RED-FIRST KNOB: `MEDI_FORME_REVERT_ANNOUNCES=1` puts the announcement back — i.e. the engine
 * exactly as it stood before this fix. Under it REAL-FAINT and REAL-PIVOT go RED and both CONTROL
 * arms stay green, and any run carrying it also carries `MEDFAILS.formeRevertAnnounceRestored = 1`.
 *
 *   SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_forme_revert_silent.js
 *   MEDI_FORME_REVERT_ANNOUNCES=1 SHOWDOWN_PATH=... node -r ./tests/_live_release.js tests/probe_forme_revert_silent.js
 * ================================================================================================ */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const NL = '\n';
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2);
}
const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));
const KNOB = process.env.MEDI_FORME_REVERT_ANNOUNCES === '1';

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what);
  if (detail) console.log('           ' + String(detail).split('\n').join('\n           '));
  if (!cond) bad++;
};

console.log(NL + 'tests/probe_forme_revert_silent.js — the non-permanent forme revert is SILENT');
console.log('  MEDI_FORME_REVERT_ANNOUNCES=' + (KNOB ? '1  (PRE-FIX ENGINE: the revert announces)' : '0'));

/* ==================================================================================================
 * 0. THE AUTHORITY, RE-READ — never recalled
 * ============================================================================================== */
const SP = process.env.SHOWDOWN_PATH;
/* THE CR IS STRIPPED AT THE READ, AND THAT IS NOT TIDINESS.
 * MEASURED ON THIS PROBE'S FIRST RUN: this checkout of the simulator is CRLF, a carriage return is
 * a JavaScript line terminator, and so BOTH `formeChange` blocks below came back null — the
 * assertion reported "not found" against a file that says exactly what it should. CLAUDE.md records
 * the identical failure costing `docs_scan.js` a whole day at "0 of 100 ... nothing owed". */
const read = f => fs.readFileSync(SP + f, 'utf8').replace(/\r/g, '');
const CH_SCRIPTS = read('/data/mods/champions/scripts.ts');
const SIM_BATTLE = read('/sim/battle.ts');
const SIM_POKEMON = read('/sim/pokemon.ts');
const ABS = read('/data/abilities.ts');

console.log(NL + '0. THE AUTHORITY');
ok(/clearVolatile\(includeSwitchFlags = true\)/.test(CH_SCRIPTS)
   && /this\.setSpecies\(this\.baseSpecies\);/.test(CH_SCRIPTS),
   'Champions overrides `clearVolatile` and it still closes with `setSpecies(this.baseSpecies)`',
   'data/mods/champions/scripts.ts — so the revert itself is Champions behaviour, not mainline');
/* `setSpecies` must write no protocol line, or "silent" would be the wrong claim. Read the whole
 * body rather than a first line, which is the mistake CLAUDE.md records about the freeze block. */
const SS = /\n\tsetSpecies\(([\s\S]*?)\n\t\}/.exec(SIM_POKEMON);
ok(!!SS && !/this\.battle\.add\(/.test(SS[1]),
   '`Pokemon#setSpecies` emits NO protocol line — the revert is silent at the source',
   SS ? SS[1].trim().split('\n').slice(0, 6).join('\n') : 'setSpecies block not found — re-read the file');
/* The one `detailschange` a faint can produce, and the flag that guards it. */
const FAINT_DC = /if \(pokemon\.formeRegression\) \{[\s\S]{0,220}?detailschange[^\n]*\n/.exec(SIM_BATTLE);
ok(!!FAINT_DC && /'\[silent\]'/.test(FAINT_DC[0]),
   'the only `detailschange` in `faintMessages` is guarded by `formeRegression` AND is `[silent]`',
   FAINT_DC ? FAINT_DC[0].trim() : 'not found');
/* And Champions took the mega branch's `formeRegression = true` out, so nothing in this format's
 * Stance Change road can set it. Counted, not assumed: mainline has two assignments inside
 * `formeChange`, Champions has one. */
const cnt = (s, re) => (s.match(re) || []).length;
const chFC = /formeChange\(speciesId, source, isPermanent[\s\S]*?\n\t\t\},\n/.exec(CH_SCRIPTS);
const mlFC = /formeChange\(\n?\s*speciesId[\s\S]*?\n\t\}\n/.exec(SIM_POKEMON);
ok(!!chFC && !!mlFC && cnt(chFC[0], /formeRegression = true/g) === 1
   && cnt(mlFC[0], /formeRegression = true/g) === 2,
   'Champions` `formeChange` sets `formeRegression` ONCE (Tera) where mainline sets it twice',
   'champions ' + (chFC ? cnt(chFC[0], /formeRegression = true/g) : '?')
   + '  mainline ' + (mlFC ? cnt(mlFC[0], /formeRegression = true/g) : '?'));
/* Stance Change passes no `isPermanent`, so it takes neither branch. Parsed from the handler. */
const SC_LINE = (() => {
  const L = ABS.split('\n'); let cur = null;
  for (let i = 0; i < L.length; i++) {
    const h = /^\t([a-z0-9]+): \{/.exec(L[i]); if (h) cur = h[1];
    if (cur === 'stancechange' && /\.formeChange\(/.test(L[i])) return { line: i + 1, raw: L[i].trim() };
  }
  return null;
})();
ok(!!SC_LINE && /formeChange\(targetForme\)/.test(SC_LINE.raw),
   'Stance Change calls `formeChange(targetForme)` with no `isPermanent` — a TEMPORARY forme',
   SC_LINE ? 'data/abilities.ts:' + SC_LINE.line + '  ' + SC_LINE.raw : 'not found');
const CH_AB = read('/data/mods/champions/abilities.ts');
ok(!/^\tstancechange:/m.test(CH_AB),
   'Champions does not override `stancechange`, so mainline IS its authority here');

/* ==================================================================================================
 * 1. THE CAST — derived from the format, not named
 * ============================================================================================== */
const { Dex } = require(SP + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const CARRIERS = D.species.all().filter(s => legal(s) && !s.isMega
  && Object.values(s.abilities || {}).some(a => D.abilities.get(a).id === 'stancechange'));
console.log(NL + '1. THE CAST, DERIVED THIS RUN');
console.log('     legal carriers of Stance Change : ' + (CARRIERS.map(s => s.name).join(', ') || '(none)'));
if (!CARRIERS.length) { console.log('  NOT STAGED — no legal Stance Change carrier.'); process.exit(1); }
const CARRIER = CARRIERS[0];
/* The flip needs a PHYSICAL or SPECIAL click (Stance Change refuses a status move that is not
 * King's Shield). Picked off the carrier's own learnset so nothing here is typed. */
const LS = D.species.getLearnsetData(CARRIER.id);
const ATTACKS = Object.keys((LS && LS.learnset) || {})
  .map(id => D.moves.get(id)).filter(m => legal(m) && m.category !== 'Status'
    && m.target === 'normal' && !m.flags.charge && !m.flags.recharge
    && (m.accuracy === true || m.accuracy >= 100))
  .sort((a, b) => a.id < b.id ? -1 : 1);
console.log('     its always-hitting single-target attacks : '
  + (ATTACKS.slice(0, 8).map(m => m.name).join(', ') || '(none)'));
if (!ATTACKS.length) { console.log('  NOT STAGED — the carrier knows no always-hitting attack.'); process.exit(1); }
const ATK = ATTACKS[0];
/* A mega for the CONTROL arm — any legal mega whose base is not the carrier, taken off the format. */
const MEGAS = D.species.all().filter(s => legal(s) && s.isMega && s.requiredItem
  && D.species.get(s.baseSpecies) && legal(D.species.get(s.baseSpecies)))
  .sort((a, b) => a.name < b.name ? -1 : 1);
console.log('     legal megas in this format               : ' + MEGAS.length);
if (!MEGAS.length) { console.log('  NOT STAGED — no legal mega.'); process.exit(1); }
const MEGA = MEGAS[0];
console.log('     the board                                : ' + CARRIER.name + ' clicks ' + ATK.name
  + ';  control mega ' + D.species.get(MEGA.baseSpecies).name + ' @ ' + D.items.get(MEGA.requiredItem).name);

/* ==================================================================================================
 * 2. THE ARMS
 * ============================================================================================== */
const G = SB.harness();
const mon = (s, i, a, mv) => ({ species: s, item: i || '', ability: a || '', moves: mv });
const bench = (...n) => n.map(s => mon(s, '', '', ['Protect']));
const dcOf = l => /^\|detailschange\|/.test(String(l));
const fcOf = l => /^\|-formechange\|/.test(String(l));

function play(tag, A, B, script) {
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { staged: false, why: 'buildPair returned nothing' };
  if (G.resetScriptCounters) G.resetScriptCounters();
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_forme_revert_silent :: ' + tag, {
    script,
    onBoundary: (snap, ti) => {
      boards.push({ turn: ti, compared: snap.leaves_compared, diffs: (snap.diffs || []).length });
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  const SC = G.scriptCounters();
  if (SC.moveNotOnRequest) {
    return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  }
  if (r.turns !== script.length) {
    return { staged: false, why: 'the script declares ' + script.length + ' turn(s) and ' + r.turns + ' were played' };
  }
  if (boards.some(x => !x.compared)) return { staged: false, why: 'a boundary compared ZERO leaves' };
  const sd = G.sdStream(G.lastSdLog()).map(String), me = (r.mediTrace || []).map(String);
  return { staged: true, boards, sd, me,
           sdDC: sd.filter(dcOf), meDC: me.filter(dcOf),
           sdFC: sd.filter(fcOf), meFC: me.filter(fcOf),
           boardDiffs: boards.reduce((n, x) => n + x.diffs, 0),
           minCompared: Math.min.apply(null, boards.map(x => x.compared)),
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null };
}

const CN = CARRIER.name;
const SIDE_CARRIER = [mon(CN, '', 'Stance Change', [ATK.name, 'Protect']),
                      mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(bench('milotic', 'weavile'));
const KILLER = [mon('garchomp', '', 'Rough Skin', ['Earthquake', 'Protect']),
                mon('clefable', '', 'Unaware', ['Protect'])].concat(bench('toxapex', 'corviknight'));
const INERT = [mon('clefable', '', 'Unaware', ['Protect']),
               mon('milotic', '', 'Marvel Scale', ['Protect'])].concat(bench('toxapex', 'corviknight'));

const FAINT = play('real-faint', KILLER, SIDE_CARRIER, [
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: ATK.id, t: 0 }, { m: 'protect' }] },
  { p1: [{ m: 'earthquake' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
  { p1: [{ m: 'earthquake' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
]);
const PIVOT = play('real-pivot', INERT, SIDE_CARRIER, [
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: ATK.id, t: 0 }, { m: 'protect' }] },
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ sw: 'milotic' }, { m: 'protect' }] },
]);
const MEGA_BASE = D.species.get(MEGA.baseSpecies).name;
const MEGA_SIDE = [mon(MEGA_BASE, D.items.get(MEGA.requiredItem).name, '', ['Protect']),
                   mon('snorlax', '', 'Thick Fat', ['Protect'])].concat(bench('milotic', 'weavile'));
const MEGAARM = play('control-mega', INERT, MEGA_SIDE, [
  { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect', mega: true }, { m: 'protect' }] },
]);

console.log(NL + '2. THE ARMS');
for (const [tag, R] of [['REAL-FAINT', FAINT], ['REAL-PIVOT', PIVOT], ['CONTROL-MEGA', MEGAARM]]) {
  if (!R.staged) { console.log('  NOT STAGED (' + tag + ') — ' + R.why); process.exit(1); }
  console.log('  === ' + tag + ' ===');
  console.log('    showdown  detailschange x' + R.sdDC.length + '   ' + JSON.stringify(R.sdDC));
  console.log('    medicham2 detailschange x' + R.meDC.length + '   ' + JSON.stringify(R.meDC));
  console.log('    showdown  -formechange x' + R.sdFC.length + '   medicham2 -formechange x' + R.meFC.length);
  console.log('    boards: ' + R.boardDiffs + ' diff(s) across ' + R.boards.length
    + ' boundaries, min ' + R.minCompared + ' leaves compared');
  console.log('    first protocol divergence: ' + (R.div ? JSON.stringify(R.div) : 'none — the streams agree'));
}

/* ==================================================================================================
 * 3. THE VERDICT
 * ============================================================================================== */
console.log(NL + '3. THE VERDICT');

/* CONTROL-FLIP first: if the flip never happened, nothing below means anything. */
ok(FAINT.sdFC.length === 1 && FAINT.meFC.length === 1,
   'CONTROL-FLIP — both engines write exactly one `-formechange` putting the body into Blade forme',
   'showdown ' + JSON.stringify(FAINT.sdFC) + '  medicham2 ' + JSON.stringify(FAINT.meFC));
ok(PIVOT.sdFC.length === 1 && PIVOT.meFC.length === 1,
   'CONTROL-FLIP (pivot board) — the same, so the pivot arm is not vacuous',
   'showdown ' + JSON.stringify(PIVOT.sdFC) + '  medicham2 ' + JSON.stringify(PIVOT.meFC));

ok(FAINT.sdDC.length === 0, 'REAL-FAINT — the AUTHORITY writes NO `detailschange` when the '
   + 'Blade forme comes off on a faint', JSON.stringify(FAINT.sdDC));
ok(PIVOT.sdDC.length === 0, 'REAL-PIVOT — the AUTHORITY writes NO `detailschange` when it comes off '
   + 'on a switch', JSON.stringify(PIVOT.sdDC));

const wantSilent = !KNOB;
ok(wantSilent ? FAINT.meDC.length === 0 : FAINT.meDC.length === 1,
   'REAL-FAINT — medicham2 writes ' + (wantSilent ? 'none either' : 'ONE (the knob is armed)'),
   JSON.stringify(FAINT.meDC));
ok(wantSilent ? PIVOT.meDC.length === 0 : PIVOT.meDC.length === 1,
   'REAL-PIVOT — medicham2 writes ' + (wantSilent ? 'none either' : 'ONE (the knob is armed)'),
   JSON.stringify(PIVOT.meDC));

/* THE REVERT MUST STILL HAPPEN. `formeTempReverted` counts the body going back; the boards are what
 * prove it landed, because Blade and Shield carry different base stats and a corpse or a benched
 * body under the wrong species parts `party.<name>.species`, `.stats` and `.types`. */
ok(FAINT.boardDiffs === 0, 'REAL-FAINT — the BOARDS stay identical, so the corpse still goes back to '
   + CARRIER.name + ' (deleting the revert cannot pass this file)', FAINT.boardDiffs + ' diff(s)');
ok(PIVOT.boardDiffs === 0, 'REAL-PIVOT — the BOARDS stay identical on the switch road too',
   PIVOT.boardDiffs + ' diff(s)');

/* THE CONTROL THAT SEPARATES "SILENT REVERT" FROM "detailschange SWITCHED OFF". */
ok(MEGAARM.sdDC.length === 1 && MEGAARM.meDC.length === 1,
   'CONTROL-MEGA — a mega evolution still writes exactly one `detailschange` in BOTH engines, '
   + 'under either setting of the knob',
   'showdown ' + JSON.stringify(MEGAARM.sdDC) + '  medicham2 ' + JSON.stringify(MEGAARM.meDC));

/* ==================================================================================================
 * 4. THE ENGINE'S OWN RECEIPTS
 * ============================================================================================== */
console.log(NL + '4. THE COUNTERS');
const M = G.REL.require('engine/medicham2-browser.js', { want: ['MEDSEEN', 'MEDFAILS'] });
const S = M && M.MEDSEEN, F = M && M.MEDFAILS;
console.log('     formeTempStamped ' + (S ? S.formeTempStamped : '?')
  + '   formeTempReverted ' + (S ? S.formeTempReverted : '?')
  + '   formeRevertSilent ' + (S ? S.formeRevertSilent : '?')
  + '   formeRevertAnnounceRestored ' + (F ? F.formeRevertAnnounceRestored : '?'));
ok(!!S && S.formeTempReverted >= 2,
   'the revert itself RAN on both roads — a capability that cannot prove it ran is assumed broken',
   'formeTempReverted = ' + (S ? S.formeTempReverted : '?'));
ok(!!S && (KNOB ? S.formeRevertSilent === 0 : S.formeRevertSilent >= 2),
   KNOB ? 'the silencer did NOT run (the knob is armed)' : 'the silencer ran on both roads',
   'formeRevertSilent = ' + (S ? S.formeRevertSilent : '?'));
ok(!!F && (KNOB ? F.formeRevertAnnounceRestored === 1 : !F.formeRevertAnnounceRestored),
   'the knob marks its own run — a pre-fix engine cannot be mistaken for a fixed one',
   'formeRevertAnnounceRestored = ' + (F ? F.formeRevertAnnounceRestored : '?'));

console.log(NL + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
