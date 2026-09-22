#!/usr/bin/env node
/* tests/probe_regmc_species_key.js — A SPECIES WHOSE BASE NAME CARRIES PUNCTUATION, UNDER REG M-C. 2026-09-22 (abra/regmc 0.33.0).
 *
 *   node tests/probe_regmc_species_key.js --regulation regmc                                        # green, exit 0
 *   MEDI_CANON_KEEPS_TYPO_APOSTROPHE=1 node tests/probe_regmc_species_key.js --regulation regmc     # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof of the table clause)
 *
 * ================= THE TWO DEFECTS ===============================================================
 *
 *   THE TABLE KEY. The engine reads a key's segment before its first hyphen as the BASE species (medicham2-browser.js,
 *   `statMult.onlySpecies`: `String(body.name).split('-')[0]`, because the authority asks `baseSpecies.baseSpecies`).
 *   build/build_engine_data_regmc.js collapsed every non-alphanumeric run of the DISPLAY name to a hyphen, so a base
 *   name with punctuation of its own was keyed as if it had a forme: `sirfetch-d`, `farfetch-d`, `mr-rime`, `mr-mime`,
 *   `kommo-o`. The Reg M-B table keys the same shape unbroken (`mrrime`, `kommoo`).
 *
 *   THE APOSTROPHE. The M-C checkout spells `Sirfetch’d` / `Farfetch’d` with U+2019 (data/pokedex.ts), and the engine's
 *   one normaliser (`traceCanon`) folded only the ASCII `'`, so the first `|switch|` of every game that brought one
 *   parted on the spelling, and the game's real first cause was hidden behind it.
 *
 * ================= THE CLAUSES ===================================================================
 *
 *   TABLE   every row of the selected regulation's table resolves to its dex species, and its key's segment before
 *           the first hyphen is that species' BASE id.
 *   SWITCH  every legal species whose base name carries punctuation walks in on both engines, and each `|switch|` line
 *           reduces (the engine's own `traceCanon`, the comparator the differential uses) to the same string.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_species_key', ['MEDI_CANON_KEEPS_TYPO_APOSTROPHE']);
const { D, ok, SPEC, learns, abil, quiet, mon, pickDistinct, bulk, P } = K;

const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = K.legal;

console.log('\n1. THE TABLE (' + K.REGN.fileFor('data/engine-data.js') + ', as the release loaded it; its keys through engine/mc_key.js)');
const { mcKey } = require('../engine/mc_key.js');
const KEYS = mcKey.keys() || [];
const bad = [], unresolved = [];
for (const k of KEYS) {
  const s = D.species.get(k);
  if (!s || !s.exists) { unresolved.push(k); continue; }
  if (k.split('-')[0] !== toID(s.baseSpecies || s.name)) bad.push(k + ' (base ' + JSON.stringify(s.baseSpecies) + ', id ' + toID(s.baseSpecies) + ')');
}
ok(KEYS.length > 0, 'the table is loaded (' + KEYS.length + ' rows)');
ok(unresolved.length === 0, 'every table key resolves to a species of the format', unresolved.join(', ') || null);
ok(bad.length === 0, 'every table key\'s segment before its first hyphen is its species\' BASE id', bad.join('; ') || null);

console.log('\n2. THE CAST, DERIVED THIS RUN');
/* every legal, non-mega species whose BASE name carries a character outside [A-Za-z0-9] */
const PUNCT = D.species.all().filter(s => legal(s) && !s.isMega && !s.battleOnly && /[^A-Za-z0-9]/.test(s.baseSpecies || s.name)
  && s.name === (s.baseSpecies || s.name));
console.log('     base names with punctuation: ' + PUNCT.map(s => s.id + ' ' + JSON.stringify(s.name)).join(', '));
ok(PUNCT.some(s => /’/.test(s.name)), 'the cast holds a U+2019 name (the shape the defect was on)', PUNCT.map(s => s.name).join(', '));
const guard = s => (learns(s, 'protect') ? 'Protect' : null);
const cast = PUNCT.filter(guard);
const skipped = PUNCT.filter(s => !guard(s));
if (skipped.length) console.log('     not staged (no Protect to stand behind): ' + skipped.map(s => s.id).join(', '));
const ab = s => quiet(s) || abil(s)[0];
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));

/* the punctuated bodies lead in pairs, everyone stands behind Protect for one turn */
const KEEP = /^\|(switch|drag)\|/;
const RUNS = [];
for (let i = 0; i < cast.length; i += 2) {
  const lead = cast.slice(i, i + 2);
  const used = new Set(lead.flatMap(s => [s.baseSpecies, s.id]));
  const fills = pickDistinct(FILL, used, 6);
  if (fills.length < 6) { RUNS.push(['LEAD ' + lead.map(s => s.id).join('+'), { staged: false, why: 'no filler' }]); continue; }
  const A = [...lead.map(s => mon(s, '', ['Protect'], ab(s))), ...fills.slice(0, 4 - lead.length).map(s => mon(s, '', ['Protect']))];
  const B = fills.slice(2, 6).map(s => mon(s, '', ['Protect']));
  const side = n => Array.from({ length: n }, () => P.protect);
  const R = K.play('lead-' + i, A, B, [{ p1: side(2), p2: side(2) }], KEEP, () => ({}));
  if (R.staged) R.cast = lead.map(s => s.id + ' ' + JSON.stringify(s.name)).join(' + ') + ' lead';
  RUNS.push(['LEAD ' + lead.map(s => s.id).join('+'), R]);
}
K.printArms(RUNS);

console.log('\n3. EACH ENTRY LINE, THROUGH THE ENGINE\'S OWN COMPARATOR (traceCanon)');
const TC = K.M.traceCanon;
ok(typeof TC === 'function', 'the release exports traceCanon');
for (const [tag, R] of RUNS) {
  const sd = R.sd.filter(l => KEEP.test(l)).map(l => TC(l)), me = R.me.filter(l => KEEP.test(l)).map(l => TC(l));
  const same = sd.length === me.length && sd.every((l, j) => l === me[j]);
  ok(same && sd.length >= 4, tag + ' — every |switch| line reduces to the same string on both engines',
    'showdown  ' + sd.join('  ') + '\nmedicham2 ' + me.join('  '));
  ok(!R.div, tag + ' — no protocol divergence', R.div ? JSON.stringify(R.div) : null);
  ok(R.boardDiffs === 0, tag + ' — the BOARDS stay identical at every boundary', R.boardDiffs ? R.boardDetail : null);
}
K.finish();
