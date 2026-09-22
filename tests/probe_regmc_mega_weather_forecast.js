#!/usr/bin/env node
/* tests/probe_regmc_mega_weather_forecast.js — A WEATHER A MEGA EVOLUTION RAISES TURNS A STANDING FORECAST BODY AT ONCE.
 * 2026-09-22 (abra/regmc 0.55.0).
 *
 *   node tests/probe_regmc_mega_weather_forecast.js --regulation regmc                                 # green, exit 0
 *   MEDI_MEGA_WEATHER_NO_FORME_SYNC=1 node tests/probe_regmc_mega_weather_forecast.js --regulation regmc # RED, exit 1
 *   ... --release <id> --medi <path>   the pre-fix release and engine bytes (the RED proof)
 *
 * ================= THE AUTHORITY (M-C checkout; read whole) ======================================
 *
 *   data/mods/champions/abilities.ts forecast :1470-1500   `onWeatherChange(pokemon)`: Castform (not transformed) takes
 *       Castform-Sunny / -Rainy / -Snowy off `pokemon.effectiveWeather()` (`hail` and `snowscape` both -> Snowy),
 *       `formeChange(forme, this.effect, false, '0', '[msg]')`.
 *   sim/field.ts setWeather   ends with `this.battle.eachEvent('WeatherChange', sourceEffect)` -- every active body is
 *       asked the moment the weather is set, whoever set it and however.
 *   A mega evolution runs the mega forme's ability Start inside the evolution (`formeChange` -> `setAbility` -> Start),
 *   so Snow Warning / Drought / Sand Stream set the weather there, and the Castform changes on that instant, above the
 *   next mega evolution of the turn.
 *
 *   The pinned 1950 card (`omit-intimidate …bo3-2681789845` t1): `|-weather|Snowscape|[from] ability: Snow Warning|[of]
 *   p2a: Froslass` then `|-formechange|p2b: Castform|Castform-Snowy|[msg]|[from] ability: Forecast`; this engine wrote
 *   no forme change, so the Castform's Blizzard was a Normal-type Castform's.
 *
 * ================= THE ARMS (both engines play the same scripted turns; SHOWDOWN IS THE ANSWER) ==
 *
 *   MEGA      turn 1 our weather mega evolves (and protects) beside a Castform: the Castform takes the weather's forme.
 *   PLAIN     the same turn with no mega evolution: the Castform stays Castform (the control).
 */
'use strict';
const K = require('./regmc_probe_kit.js').open('probe_regmc_mega_weather_forecast', ['MEDI_MEGA_WEATHER_NO_FORME_SYNC']);
const { D, ok, SPEC, learns, quiet, bulk, mon, pickDistinct, P, legal } = K;

console.log('\n1. THE CAST, DERIVED THIS RUN (' + K.CS.FORMAT + ')');
const SETTERS = D.abilities.all().filter(a => legal(a) && /setWeather/.test(String(a.onStart || '')));
const MEGAS = D.species.all().filter(s => s.isMega && legal(s) && SETTERS.some(a => a.name === s.abilities[0])
  && legal(D.items.get(s.requiredItem)));
const FORECAST = SPEC.filter(s => K.abil(s).includes('forecast'));
console.log('     weather-setting megas: ' + MEGAS.map(s => s.id + ' (' + s.abilities[0] + ')').join(', '));
console.log('     Forecast bodies: ' + FORECAST.map(s => s.id).join(', '));
ok(MEGAS.length > 0 && FORECAST.length > 0, 'the format has a weather mega and a Forecast body');
const SELFUP = ['irondefense', 'amnesia', 'calmmind', 'bulkup', 'swordsdance', 'nastyplot', 'growth', 'workup', 'agility', 'cottonguard', 'acidarmor'];
const idle = s => K.idle(s) || SELFUP.map(x => D.moves.get(x)).find(m => legal(m) && learns(s, m.id)) || null;
const FILL = SPEC.filter(s => quiet(s) && learns(s, 'protect')).sort((a, b) => bulk(b) - bulk(a));
const KEEP = /^\|(-weather|-formechange|detailschange|-mega)\|/;
const OWN = /^\|(-weather|-formechange)\|/;
const counters = () => ({ retyped: K.M.MEDSEEN.weatherRetyped || 0, sync: K.M.MEDSEEN.megaWeatherFormeSynced || 0 });
const play = (tag, A, B, script) => K.play(tag, A, B, script, KEEP, counters);

let MG = null, PL = null, cast = null;
outer: for (const mg of MEGAS) {
  const base = D.species.get(mg.baseSpecies);
  if (!learns(base, 'protect')) continue;
  for (const cf of FORECAST) {
    const ci = idle(cf);
    if (!ci) continue;
    const used = new Set([base.baseSpecies, base.id, cf.baseSpecies, cf.id]);
    const fills = pickDistinct(FILL.filter(s => !used.has(s.baseSpecies)), used, 4);
    if (fills.length < 4) continue;
    const A = [mon(base, mg.requiredItem, ['Protect'], D.abilities.get(Object.values(base.abilities)[0]).id),
      mon(cf, '', ['Protect', ci.name], 'forecast'), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const B = [mon(fills[2], '', ['Protect']), mon(fills[3], '', ['Protect']), mon(fills[0], '', ['Protect']), mon(fills[1], '', ['Protect'])];
    const t = mega => ({ p1: [{ m: 'protect', mega }, { m: ci.id }], p2: [P.protect, P.protect] });
    const r = play('mega', A, B, [t(true)]);
    if (!r.staged) { console.log('   (skip ' + mg.id + '/' + cf.id + ': ' + r.why + ')'); continue; }
    const c = play('plain', A, B, [t(false)]);
    if (!c.staged) { console.log('   (skip plain ' + c.why + ')'); continue; }
    r.cast = base.id + ' @ ' + mg.requiredItem + ' megas into ' + mg.id + ' (' + mg.abilities[0] + ') beside ' + cf.id + ' (' + ci.id + ')';
    c.cast = 'the same, no mega';
    cast = { mg, cf };
    MG = r; PL = c; break outer;
  }
}
const RUNS = [['MEGA', MG], ['PLAIN', PL]];
K.printArms(RUNS);

console.log('\n3. THE FIXTURES, ON THE AUTHORITY');
const fc = R => R.sdK.filter(l => /^\|-formechange\|p1b[^|]*\|castform-/.test(l)).length;
const wIdx = R => R.sdK.findIndex(l => /^\|-weather\|/.test(l) && /\[from\]ability:/.test(l));
const fIdx = R => R.sdK.findIndex(l => /^\|-formechange\|p1b/.test(l));
ok(fc(MG) === 1 && wIdx(MG) >= 0 && fIdx(MG) === wIdx(MG) + 1, 'MEGA — the Castform changes forme on the line straight after the weather the mega raised');
ok(fc(PL) === 0, 'PLAIN — no weather, no forme change');

K.compareArms(RUNS, OWN, '-weather / -formechange');
if (!K.KNOBS.length && !K.MEDI_SRC_PATH) {
  console.log('\n5. THE COUNTERS');
  ok(MG.counters.sync === 1 && PL.counters.sync === 0 && MG.counters.retyped >= 1,
    'the engine\'s receipt: one mega-time forme sync that retyped the Castform in MEGA, none in PLAIN',
    JSON.stringify(RUNS.map(([t, R]) => t + ' ' + JSON.stringify(R.counters))));
}
K.finish();
