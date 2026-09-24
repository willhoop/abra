#!/usr/bin/env node
/* tests/probe_ate_abilities.js — THE -ATE ABILITIES, ALL SIXTEEN ROLLS AGAINST THE AUTHORITY. 2026-09-24.
 *
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_ate_abilities.js          Reg M-B
 *   ABRA_REGULATION=regmc        node tests/probe_ate_abilities.js          Reg M-C
 *   MEDI_ATE_EXCLUSION_BLIND=1   ...                                         restores the defect (must exit 1)
 *
 * ================= THE AUTHORITY (both checkouts; the Champions mod overrides none of these abilities) ==========
 *
 *   data/abilities.ts pixilate (and aerilate, refrigerate, galvanize, dragonize; normalize is the mirror):
 *     onModifyTypePriority: -1,
 *     onModifyType(move, pokemon) {
 *       const noModifyType = ['judgment', 'multiattack', 'naturalgift', 'revelationdance', 'technoblast',
 *                             'terrainpulse', 'weatherball'];
 *       if (move.type === 'Normal' && (!noModifyType.includes(move.id) || this.activeMove?.isMax) && ...) {
 *         move.type = 'Fairy'; move.typeChangerBoosted = this.effect;
 *     } },
 *     onBasePowerPriority: 23,
 *     onBasePower(...) { if (move.typeChangerBoosted === this.effect) return this.chainModify([4915, 4096]); }
 *
 *   So: x[4915,4096] in the BasePower chain, STAB and effectiveness read the NEW type, and the moves on the
 *   `noModifyType` list are NEVER converted and NEVER boosted -- in any weather. Weather Ball is the list's
 *   only member a legal -ate holder can learn in either regulation (derived below and printed).
 *
 * ================= THE ARMS (every row: all 16 rolls, subject ability against a QUIET control) ==================
 *
 *   CONVERTS  a Normal move the holder learns. The authority's knob must MOVE (the control is Illuminate, a
 *             quiet ability -- NOT a live one: the census's Refrigerate arm controlled on Ancient Power, a
 *             different move, and could not show anything). MEDICHAM must equal the authority on every roll.
 *   EXCLUDED  Weather Ball, no weather / sun / rain, into a neutral body and (no weather) into a Ghost.
 *             The authority's knob must be DEAD -- the ability does not touch the move -- and MEDICHAM must
 *             equal it on every roll. Before the fix MEDICHAM converted and boosted it.
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'engine', 'showdown_path.js'));
const PP = require('./probe_pair.js');
const CS = require(path.join(ROOT, 'engine', 'champions_sim.js'));
const dex = CS.dexFor(CS.FORMAT);
const MC = globalThis.MC;

let bad = 0, rows = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'green' : 'RED  ') + '  ' + what + (detail ? '\n           ' + detail : ''));
  if (!cond) bad++;
};
console.log('probe_ate_abilities — ' + CS.FORMAT + '   SHOWDOWN_PATH=' + process.env.SHOWDOWN_PATH
  + (process.env.MEDI_ATE_EXCLUSION_BLIND === '1' ? '   KNOB MEDI_ATE_EXCLUSION_BLIND=1 (red arm)' : ''));

/* ---- 1. THE FAMILY AND ITS HOLDERS, DERIVED ---------------------------------------------------------------- */
const legalSp = s => s.exists && s.tier !== 'Illegal' && (!s.isNonstandard || s.isNonstandard === 'Future');
const FAMILY = dex.abilities.all().filter(a => a.exists && a.onModifyType && a.onBasePower
  && /typeChangerBoosted/.test(String(a.onModifyType)));
console.log('\n1. THE FAMILY (abilities whose onModifyType sets typeChangerBoosted): '
  + FAMILY.map(a => a.name + '(' + String(a.onBasePower).match(/chainModify\(\[?([^)]*)\]?\)/)[1] + ')').join(', '));
const holders = {};
for (const s of dex.species.all()) if (legalSp(s)) for (const ab of Object.values(s.abilities))
  for (const a of FAMILY) if (ab === a.name) (holders[a.name] ||= []).push(s);
for (const a of FAMILY) console.log('   ' + a.name.padEnd(12) + ' -> ' + ((holders[a.name] || []).map(s => s.name).join(', ') || 'NO LEGAL HOLDER'));
const EXCL = [...new Set(FAMILY.flatMap(a => (String(a.onModifyType).match(/noModifyType\s*=\s*\[([^\]]*)\]/) || [, ''])[1]
  .match(/[a-z]+/g) || []))];
console.log('   excluded by the handlers: ' + EXCL.join(', '));

/* ---- 2. THE CAST --------------------------------------------------------------------------------------------- */
const V = require(process.env.SHOWDOWN_PATH + '/dist/sim').TeamValidator.get(CS.FORMAT);
const learns = (sp, mv) => {
  const b = dex.species.get(sp.baseSpecies); /* a mega's learnset is its base forme's; validate the base with its OWN ability */
  const set = { species: b.name, ability: b.abilities[0], item: '', moves: [mv],
    nature: 'Hardy', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, level: 50 };
  const p = V.validateSet(set, {}); return !p || !p.length;
};
const DEF = 'Feraligatr', GHOST = 'Gengar';
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function arm(label, o, expectKnob) {
  let sub, ctl;
  try {
    sub = PP.allRolls(Object.assign({ runModifyType: true, iKnowThisPairingIsIllegal: true }, o));
    ctl = PP.allRolls(Object.assign({ runModifyType: true, iKnowThisPairingIsIllegal: true }, o, { attAb: null }));
  } catch (e) { console.log('  NOT STAGED  ' + label + ' — ' + e.message.split('\n')[0]); return false; }
  rows++;
  /* dmgRange leaves `rolls` EMPTY on an immune target rather than sixteen zeros; the authority reports 0 lost. Read
   * an absent roll as 0 on the medicham side -- and ONLY where the authority itself says 0, so a missing roll can
   * never pass against a non-zero one. */
  for (const r of [sub, ctl]) {
    r.medicham = r.medicham.map((x, i) => (x === undefined && r.showdown[i] === 0) ? 0 : x);
    r.agree = r.medicham.every((x, i) => x === r.showdown[i]);
  }
  const moved = sub.showdown.some((x, i) => x !== ctl.showdown[i]);
  const flat = sub.flat && sub.showdown[0] === 0;
  ok(sub.agree && ctl.agree, label + ' — MEDICHAM equals the authority on all 16 rolls, subject AND control',
    'authority ' + sub.showdown.join(',') + '\n           medicham  ' + sub.medicham.join(',')
    + (ctl.agree ? '' : '\n           control: authority ' + ctl.showdown.join(',') + ' / medicham ' + ctl.medicham.join(',')));
  ok(moved === expectKnob, label + ' — the authority\'s knob is ' + (expectKnob ? 'LIVE' : 'DEAD') + ' as the handler says'
    + (flat ? ' (all zero: immune)' : ''), 'control (' + PP.QUIET_ABILITY + ') authority ' + ctl.showdown.join(','));
  return true;
}

console.log('\n2. THE ARMS');
let staged = 0;
for (const a of FAMILY) {
  const hs = holders[a.name] || [];
  if (!hs.length) { console.log('  OUT OF SCOPE  ' + a.name + ' — no legal holder in ' + CS.FORMAT); continue; }
  /* one holder per ability that BOTH engines can build; a mega carries its stone so the body is the real one */
  let done = false;
  for (const sp of hs) {
    const item = sp.requiredItem || (sp.requiredItems && sp.requiredItems[0]) || undefined;
    const base = { att: sp.name, attAb: a.name, attItem: item, def: DEF };
    const conv = ['Body Slam', 'Hyper Voice', 'Double-Edge', 'Facade'].find(m => learns(sp, m));
    if (!conv) continue;
    if (!arm(a.name + ' ' + sp.name + ' ' + conv + ' -> ' + DEF, Object.assign({}, base, { move: conv }), true)) continue;
    staged++; done = true;
    if (learns(sp, 'Weather Ball')) {
      arm(a.name + ' ' + sp.name + ' Weather Ball (no weather) -> ' + DEF, Object.assign({}, base, { move: 'Weather Ball' }), false);
      arm(a.name + ' ' + sp.name + ' Weather Ball (no weather) -> ' + GHOST, Object.assign({}, base, { move: 'Weather Ball', def: GHOST }), false);
      arm(a.name + ' ' + sp.name + ' Weather Ball (sun) -> ' + DEF, Object.assign({}, base, { move: 'Weather Ball', weather: 'sunnyday' }), false);
      arm(a.name + ' ' + sp.name + ' Weather Ball (rain) -> ' + DEF, Object.assign({}, base, { move: 'Weather Ball', weather: 'raindance' }), false);
    } else console.log('  (' + sp.name + ' cannot learn Weather Ball in ' + CS.FORMAT + ')');
  }
  if (!done) { console.log('  NOT STAGED  ' + a.name + ' — no holder both engines can build'); bad++; }
}
console.log('\n' + rows + ' rows, ' + staged + ' holders staged' + (bad ? ' — ' + bad + ' RED' : ' — all green'));
process.exit(bad ? 1 : (rows ? 0 : 2));
