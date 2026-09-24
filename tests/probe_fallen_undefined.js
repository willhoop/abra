#!/usr/bin/env node
/* tests/probe_fallen_undefined.js — SUPREME OVERLORD CLOSES WITH `fallenundefined` WHEN NOTHING HAD FALLEN, BECAUSE
 * THE AUTHORITY DOES. 2026-09-24 (ENGINE, abra/regmc narration, "the last two causes").
 *
 *   node tests/probe_fallen_undefined.js --regulation regmc
 *   SHOWDOWN_PATH=<M-B checkout> node tests/probe_fallen_undefined.js
 *   MEDI_FALLEN_UNDEFINED_SILENT=1   restores the old silence at n = 0 (must exit 1 in both)
 *
 * ================= THE AUTHORITY, READ WHOLE-BLOCK =============================================================
 *
 *   supremeoverlord (data/abilities.ts:4730-4750 in the M-C checkout; the Champions mod does not override it):
 *       onStart(pokemon) {
 *         if (pokemon.side.totalFainted) {
 *           this.add('-activate', pokemon, 'ability: Supreme Overlord');
 *           const fallen = Math.min(pokemon.side.totalFainted, 5);
 *           this.add('-start', pokemon, `fallen${fallen}`, '[silent]');
 *           this.effectState.fallen = fallen;
 *         }
 *       },
 *       onEnd(pokemon) {
 *         this.add('-end', pokemon, `fallen${this.effectState.fallen}`, '[silent]');
 *       },
 *   onStart is guarded and onEnd is NOT, so a body that entered on nobody fallen closes with the template's
 *   `undefined` interpolated: `|-end|p1a: Kingambit|fallenundefined|[silent]`. The End event runs at the two moments
 *   the authority ends an ability: the switch-out (sim/battle-actions.ts:103, above the incoming `|switch|`) and the
 *   faint (sim/battle.ts:2556, below `|faint|`). It is the AUTHORITY'S BUG, and the bar is to match the authority.
 *
 *   Field cases (Reg M-C, lattice 1200, release 78fb4a85b1a0, data/verification/gd-regmc-merged-dump.json):
 *   omit-weather `…2680753653 vs …2680781897` and omit-intimidate `…2679731104 vs …2679711048`.
 *
 * ================= THE ARMS (both engines play the same script; SHOWDOWN IS THE ANSWER) ==========================
 *
 *   OUT      the carrier leads, nothing has fainted, and it switches out on turn 1.
 *   FAINT    the carrier leads, nothing has fainted, and a foe knocks it out.
 *   CONTROL  the same body and the same OUT script, carrying another of its abilities: no `-end` on either side. The
 *            control shows the comparison can tell the ability from its absence.
 * The carrier is found by its TAG (`boostsFromFallen`), never by name.
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_fallen_undefined', ['MEDI_FALLEN_UNDEFINED_SILENT'], { anyRegulation: true });
const path = require('path');
const fs = require('fs');
const { D, ok, SPEC, learns, abil, quiet, bulk, mon, pickDistinct, P, legal, idle } = K;
const ROOT = path.join(__dirname, '..');

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ', ' + K.REGN.fileFor('data/tags.json') + ')');
const TAGS = JSON.parse(fs.readFileSync(path.join(ROOT, K.REGN.fileFor('data/tags.json')), 'utf8'));
const AB = Object.keys(TAGS.abilities).filter(a => (TAGS.abilities[a].params || {}).boostsFromFallen);
const CARRIERS = SPEC.filter(s => abil(s).some(a => AB.includes(a)) && learns(s, 'protect'));
console.log('     boostsFromFallen: ' + AB.join(', ') + '   carriers: ' + CARRIERS.map(s => s.id).join(', '));
if (!CARRIERS.length) { console.log('  NOT RUN — no carrier in ' + K.CS.FORMAT); process.exit(2); }
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect') && idle(s)).sort((a, b) => bulk(b) - bulk(a));
/* the knockout: the foe's strongest sure physical move that is super-effective into the carrier */
const KO = (f, u) => D.moves.all().filter(m => legal(m) && m.category === 'Physical' && m.target === 'normal' && !m.priority
  && (m.accuracy === true || m.accuracy === 100) && !m.flags.charge && !m.flags.recharge && !m.multihit && !m.selfSwitch
  && !m.selfdestruct && !m.basePowerCallback && learns(f, m.id) && D.getImmunity(m.type, u) && D.getEffectiveness(m.type, u) >= 2)
  .sort((a, b) => b.basePower - a.basePower)[0] || null;

const KEEP = /^\|(-end|switch|faint|-activate|-start)\|/;
const OWN = /^\|(-end|switch|faint)\|/;
const SEEN = () => { const S = (K.M && K.M.MEDSEEN) || {}; return { undef: S.fallenUndefinedClosed | 0 }; };

let OUT = null, FT = null, CT = null;
outer: for (const u of CARRIERS) {
  const carrierAb = abil(u).find(a => AB.includes(a));
  const otherAb = abil(u).find(a => !AB.includes(a));
  /* the carrier's own click: the kit's idle list, else a self-targeted pure stat raise (it can repeat) */
  const uIdle = idle(u) || D.moves.all().filter(m => legal(m) && learns(u, m.id) && m.category === 'Status' && m.target === 'self'
    && m.boosts && !m.onHit && !m.onTry && !m.volatileStatus && !m.self && !m.heal && !m.onTryHit).sort((a, b) => a.id < b.id ? -1 : 1)[0] || null;
  if (!uIdle) { console.log('   (skip ' + u.id + ': no idle click)'); continue; }
  for (const f of FILL.slice().sort((a, b) => b.baseStats.atk - a.baseStats.atk)) {
    if (f.baseSpecies === u.baseSpecies) continue;
    const ko = KO(f, u); if (!ko) continue;
    const used = new Set([u.baseSpecies, u.id, f.baseSpecies, f.id]);
    const fl = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
    if (fl.length < 4 || !uIdle) continue;
    const Aw = ab => [mon(u, '', [uIdle.name, 'Protect'], ab), mon(fl[0], '', ['Protect']), mon(fl[1], '', ['Protect']), mon(fl[2], '', ['Protect'])];
    const B = [mon(f, '', [ko.name, 'Protect']), mon(fl[3], '', ['Protect']), mon(fl[1], '', ['Protect']), mon(fl[0], '', ['Protect'])];
    const outScript = [{ p1: [{ sw: fl[1].id }, P.protect], p2: [P.protect, P.protect] }];
    const o = K.play('out', Aw(carrierAb), B, outScript, KEEP, SEEN);
    const c = K.play('control', Aw(otherAb), B, outScript, KEEP, SEEN);
    /* two turns of the knockout, in case the first roll leaves it standing; the carrier idles */
    const hit = { p1: [{ m: uIdle.id }, P.protect], p2: [{ m: ko.id, t: 0 }, P.protect] };
    const ft = K.play('faint', Aw(carrierAb), B, [hit, hit], KEEP, SEEN);
    if (!o.staged || !c.staged || !ft.staged) { console.log('   (skip ' + u.id + '/' + f.id + ': ' + (o.why || c.why || ft.why) + ')'); continue; }
    if (!ft.sdK.some(l => new RegExp('^\\|faint\\|p1a:' + u.baseSpecies.toLowerCase()).test(l))) { console.log('   (skip ' + f.id + ': ' + ko.id + ' did not knock ' + u.id + ' out in two turns)'); continue; }
    o.cast = u.id + ' (' + carrierAb + ') leads and switches out to ' + fl[1].id + ', nothing fallen';
    c.cast = 'the same with ' + u.id + ' carrying ' + otherAb;
    ft.cast = f.id + ' ' + ko.id + ' knocks ' + u.id + ' (' + carrierAb + ') out, nothing fallen before it';
    OUT = o; CT = c; FT = ft; break outer;
  }
}
if (!OUT) { console.log('  NOT RUN — no arm staged'); process.exit(2); }
const RUNS = [['OUT', OUT], ['FAINT', FT], ['CONTROL', CT]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURE, ON THE AUTHORITY');
const iEnd = R => R.sdK.findIndex(l => /^\|-end\|p1a:[^|]*\|fallenundefined/.test(l));
const iSw = OUT.sdK.findIndex((l, i) => i > 1 && /^\|switch\|p1a:/.test(l));
ok(iEnd(OUT) >= 0 && iEnd(OUT) < iSw, 'OUT — the authority writes `-end … fallenundefined` above the incoming `|switch|`', OUT.sdK.join('  '));
const iF = FT.sdK.findIndex(l => /^\|faint\|p1a:/.test(l));
ok(iEnd(FT) === iF + 1, 'FAINT — and directly below the carrier\'s `|faint|`', FT.sdK.join('  '));
ok(!CT.sdK.some(l => /^\|-end\|/.test(l)), 'CONTROL — no `-end` without the ability', CT.sdK.join('  '));
ok(!OUT.sdK.some(l => /^\|-(activate|start)\|/.test(l)), 'OUT — and nothing on entry (the guarded onStart)');

K.compareArms(RUNS, OWN, '-end / switch / faint');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(OUT.counters.undef === 1 && FT.counters.undef === 1 && CT.counters.undef === 0,
    'the engine\'s receipts: one `fallenundefined` close in OUT and in FAINT, none in CONTROL',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
