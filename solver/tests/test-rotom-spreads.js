/* solver/tests/test-rotom-spreads.js — the Stat Points ROTOM plays on the ladder fit the set's own role (solver/rotom/spreads.js).
 *
 *   node solver/tests/test-rotom-spreads.js                     exit 0 GREEN, 1 RED
 *   node solver/tests/test-rotom-spreads.js --break scarf       deliberate break: the first Choice Scarf / Tailwind set loses
 *                                                                one Speed SP (to HP) — must go RED
 *   node solver/tests/test-rotom-spreads.js --break trickroom   deliberate break: the first Trick Room set gains one Speed SP
 *                                                                (from its largest stat) — must go RED
 *   node solver/tests/test-rotom-spreads.js --break record      deliberate break: a team's recorded spread no longer matches
 *                                                                the packed team it plays — must go RED
 *
 *   RULE       the format's levers, read from it: the SP total is the validator's evLimit; 32 in a stat validates and 33
 *              does not; an IV other than 31 does not (so SP and the sheet's nature are the only speed levers).
 *   ROLE       in every rotation a ladder run can play (the default and every one an arms file names): every set holding
 *              Choice Scarf or carrying Tailwind (and not Trick Room) is at the TOP of its speed options — Speed SP at the
 *              cap, and the sim's own Speed stat at that SP is the maximum over every SP it could run — and every Trick
 *              Room set is at the BOTTOM (Speed SP 0, the minimum stat). At least one of each exists, or the clause asks
 *              nothing.
 *   RECORD     every team records six spreads, each equal to the Stat Points in its packed team, each within the total
 *              and the cap, each with a source (derived | observed:<file>); the file records spread_rule (spreads.js's
 *              own text) and spread_source (store sha256, floor, population, speed benchmark, counters); every team
 *              passes the bo3 TeamValidator.
 *   HOOK       the OBSERVED path: a synthetic Smogon moveset block for this format is parsed, and the nature-matched
 *              highest-share spread is taken; a spread over the cap is refused; findObserved() only ever names a file for
 *              this format; the files' `observed` provenance says what findObserved() finds today.
 *   TIER       (2026-09-30) every set that is neither fast nor Trick Room runs the Speed SP spreads.js speedFor gives it
 *              against the rotation's own recorded tiers; no such set whose cap speed reaches the top-tier quantile runs
 *              below the cap. `--break tier` (a top-tier set dropped to 0, the 1.35.0 answer) and env SPREADS_BREAK=median
 *              (the 1.35.0 rule in speedFor) must each go RED. At least one top-tier and one other set, or it asks nothing.
 *   REPRODUCE  when the store the spreads were derived from is on disk at its recorded sha256, re-deriving a fast set, a
 *              Trick Room set and one other gives the recorded spreads. Otherwise NOT CHECKED, named — never a pass.
 *   CONTROL    the ROLE / RECORD checks refuse each of the three breaks on a copy.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
require('../arena/env.js');
const X = require('../human/dex.js');
const SD = require('../xatu/sd.js');
const SP = require('../rotom/spreads.js');
const { Teams, TeamValidator } = require(path.join(X.SHOWDOWN_PATH, 'dist', 'sim'));

const argv = process.argv.slice(2);
const BREAK = argv.includes('--break') ? argv[argv.indexOf('--break') + 1] : null;
let fails = 0, checks = 0, notChecked = 0;
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; console.log('  FAIL [' + clause + '] ' + msg); } };
const clone = o => JSON.parse(JSON.stringify(o));
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const V = TeamValidator.get(X.FORMAT);

/* every rotation a ladder run can play */
const rotFiles = new Set(['solver/rotom/teams/ladder-rotation.json']);
for (const f of fs.readdirSync(path.join(ROOT, 'solver', 'rotom', 'arms'))) {
  const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'arms', f), 'utf8'));
  if (a.rotation) rotFiles.add(a.rotation);
}
const ROTS = [...rotFiles].sort().map(f => [f, JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))]);

/* ---------------- the checks, pure functions of a rotation ---------------- */
/* a set whose recorded spread is OBSERVED (a published tournament spread, solver/rotom/spreads.js hook 0, or a Smogon
 * moveset file) plays what a player chose, not the derivation: ROLE and TIER judge the DERIVED rule only (2026-10-01). */
const observedAt = (t, i) => !!(t.spreads && t.spreads[i] && /^observed:/.test(t.spreads[i].source || ''));
function checkRole(name, rot, tally) {
  const bad = [];
  for (const t of rot.teams) for (const [i, s] of Teams.unpack(t.packed).entries()) {
    if (observedAt(t, i)) continue;
    const r = SP.role(s);
    if (r.role !== 'fast' && r.role !== 'trickroom') continue;
    const f = SP.forme(s);
    const all = []; for (let v = 0; v <= SP.SP_CAP; v++) all.push(SD.statValue(f.species, s.nature, 'spe', v));
    const at = SD.statValue(f.species, s.nature, 'spe', s.evs.spe);
    if (r.role === 'fast') {
      if (tally) tally.fast++;
      if (s.evs.spe !== SP.SP_CAP || at !== Math.max(...all)) bad.push(name + ' ' + t.id + ' ' + s.species + ' (' + r.by + ') runs Speed SP ' + s.evs.spe + ' (stat ' + at + ', max ' + Math.max(...all) + '), not the top of its speed options');
    } else {
      if (tally) tally.tr++;
      if (s.evs.spe !== 0 || at !== Math.min(...all)) bad.push(name + ' ' + t.id + ' ' + s.species + ' (Trick Room) runs Speed SP ' + s.evs.spe + ' (stat ' + at + ', min ' + Math.min(...all) + '), not the bottom of its speed options');
    }
  }
  return bad;
}
/* TIER (2026-09-30): every `other` set runs the Speed SP the rule gives it against the rotation's OWN recorded tiers
 * (spread_source.speed_equilibrium: tiers, top_speed), with the sim's effective speeds; and — the defect this guards —
 * no `other` set whose cap speed reaches the top tier runs below the cap. Uses spreads.js speedFor itself, so
 * SPREADS_BREAK=median (the 1.35.0 rule) turns it red. */
const _spe = Object.assign(Object.create(SP.Deriver.prototype), { _spe: new Map(), counters: { battles: 0 } });
function checkTier(name, rot, tally) {
  const bad = [];
  const eq = rot.spread_source && rot.spread_source.speed_equilibrium;
  if (!(eq && Array.isArray(eq.tiers) && eq.tiers.length && eq.top_speed > 0)) return [name + ' spread_source.speed_equilibrium records no tiers / top_speed'];
  _spe.eq = eq;
  for (const t of rot.teams) for (const [i, s] of Teams.unpack(t.packed).entries()) {
    if (observedAt(t, i)) continue;
    if (SP.role(s).role !== 'other') continue;
    const eff = _spe.speeds(s);
    const want = _spe.speedFor(s, eq.median_speed);
    const top = eff[SP.SP_CAP] >= eq.top_speed;
    if (tally) { tally.other++; if (top) tally.top++; }
    if (s.evs.spe !== want) bad.push(name + ' ' + t.id + ' ' + s.species + ' runs Speed SP ' + s.evs.spe + ' (speed ' + eff[s.evs.spe] + '); the rule gives ' + want + ' (speed ' + eff[want] + ', cap ' + eff[SP.SP_CAP] + ', top tier ' + eq.top_speed + ')');
    if (top && s.evs.spe !== SP.SP_CAP) bad.push(name + ' ' + t.id + ' ' + s.species + ' reaches the top tier (' + eff[SP.SP_CAP] + ' >= ' + eq.top_speed + ') but runs Speed SP ' + s.evs.spe);
  }
  return bad;
}
function checkRecord(name, rot) {
  const bad = [];
  if (rot.spread_rule !== SP.RULE_TEXT) bad.push(name + ' spread_rule is not spreads.js RULE_TEXT');
  const ss = rot.spread_source || {};
  if (!(ss.store_sha256 && ss.floor > 0 && ss.population && ss.population.teams > 0 && ss.speed_equilibrium && ss.speed_equilibrium.median_speed > 0 && ss.counters && ss.observed))
    bad.push(name + ' spread_source incomplete: ' + JSON.stringify(ss).slice(0, 200));
  for (const t of rot.teams) {
    const sets = Teams.unpack(t.packed);
    const pr = V.validateTeam(clone(sets));
    if (pr) bad.push(name + ' ' + t.id + ' TeamValidator: ' + pr.slice(0, 2).join('; '));
    if (!Array.isArray(t.spreads) || t.spreads.length !== 6) { bad.push(name + ' ' + t.id + ' records ' + (t.spreads ? t.spreads.length : 0) + ' spreads, not 6'); continue; }
    sets.forEach((s, i) => {
      const z = t.spreads[i];
      const packedEvs = STATS.map(k => s.evs[k] || 0).join('/'), rec = STATS.map(k => z.evs[k]).join('/');
      if (packedEvs !== rec) bad.push(name + ' ' + t.id + ' ' + s.species + ' recorded ' + rec + ' but plays ' + packedEvs);
      if (X.D.species.get(z.species).id !== X.D.species.get(s.species).id) bad.push(name + ' ' + t.id + ' slot ' + i + ' records ' + z.species + ' for ' + s.species);
      const tot = STATS.reduce((a, k) => a + z.evs[k], 0);
      if (tot > SP.SP_TOTAL || STATS.some(k => z.evs[k] > SP.SP_CAP || z.evs[k] < 0)) bad.push(name + ' ' + t.id + ' ' + s.species + ' spread ' + rec + ' breaks the total or the cap');
      if (!(z.source === 'derived' || /^observed:/.test(z.source || ''))) bad.push(name + ' ' + t.id + ' ' + s.species + ' spread has no source');
    });
  }
  return bad;
}

/* ---------------- the breaks ---------------- */
function editFirst(rot, want, fn) {
  for (const t of rot.teams) { const sets = Teams.unpack(t.packed); const i = sets.findIndex(s => SP.role(s).role === want); if (i >= 0) { fn(sets[i]); t.packed = Teams.pack(sets); if (t.spreads) t.spreads[i].evs = Object.assign({}, sets[i].evs); return rot; } }
  return rot;
}
const BREAKS = {
  scarf: r => editFirst(r, 'fast', s => { s.evs.spe -= 1; s.evs.hp < SP.SP_CAP ? s.evs.hp++ : s.evs.def++; }),
  trickroom: r => editFirst(r, 'trickroom', s => { const k = STATS.filter(x => x !== 'spe').sort((a, b) => s.evs[b] - s.evs[a])[0]; s.evs[k]--; s.evs.spe++; }),
  record: r => { if (!r.teams[0].spreads) return r; const z = r.teams[0].spreads[0]; const k = z.evs.hp > 0 ? 'hp' : 'atk'; z.evs = Object.assign({}, z.evs, { [k]: z.evs[k] + (z.evs[k] > 0 ? -1 : 1) }); return r; },
  /* the first top-tier `other` set drops to Speed SP 0 (the 1.35.0 answer for Sneasler / Gengar-Mega), SP moved to HP / Def */
  tier: r => {
    const eq = r.spread_source && r.spread_source.speed_equilibrium; if (!eq) return r;
    for (const t of r.teams) { const sets = Teams.unpack(t.packed); const i = sets.findIndex(s => SP.role(s).role === 'other' && s.evs.spe > 0 && _spe.speeds(s)[SP.SP_CAP] >= eq.top_speed);
      if (i >= 0) { const s = sets[i]; let n = s.evs.spe; s.evs.spe = 0; for (const k of ['hp', 'def', 'spd', 'atk', 'spa']) { const add = Math.min(n, SP.SP_CAP - s.evs[k]); s.evs[k] += add; n -= add; } t.packed = Teams.pack(sets); if (t.spreads) t.spreads[i].evs = Object.assign({}, s.evs); return r; } }
    return r;
  },
};
if (BREAK && !BREAKS[BREAK]) { console.error('unknown --break ' + BREAK + ' (scarf | trickroom | record | tier)'); process.exit(2); }

/* ---------------- RULE ---------------- */
{
  ok('RULE', V.ruleTable.evLimit === SP.SP_TOTAL, 'SP total ' + SP.SP_TOTAL + ' is the validator evLimit ' + V.ruleTable.evLimit);
  const t = Teams.unpack(ROTS[0][1].teams[0].packed);
  const at = (evs, ivs) => { const c = clone(t); c[0].evs = evs; if (ivs) c[0].ivs = ivs; return V.validateTeam(c); };
  ok('RULE', !at({ hp: SP.SP_CAP, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }), '32 in one stat validates');
  ok('RULE', !!at({ hp: SP.SP_CAP + 1, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }), '33 in one stat is refused');
  ok('RULE', !!at({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 0 }), 'a Speed IV of 0 is refused (IVs are 31)');
}

/* ---------------- ROLE + RECORD ---------------- */
const tally = { fast: 0, tr: 0, other: 0, top: 0 };
for (const [f, rot] of ROTS) {
  const subj = BREAK ? BREAKS[BREAK](clone(rot)) : rot;
  const b1 = checkRole(f, subj, tally);
  ok('ROLE', !b1.length, b1.join(' | '));
  const b2 = checkRecord(f, subj);
  ok('RECORD', !b2.length, b2.join(' | '));
  const b3 = checkTier(f, subj, tally);
  ok('TIER', !b3.length, b3.join(' | '));
}
ok('ROLE', tally.fast >= 1 && tally.tr >= 1, 'the rotations hold ' + tally.fast + ' fast-role and ' + tally.tr + ' Trick Room sets (need >= 1 of each, or ROLE asks nothing)');
ok('TIER', tally.top >= 1 && tally.other > tally.top, 'the rotations hold ' + tally.top + ' top-tier and ' + (tally.other - tally.top) + ' other `other` sets (need >= 1 of each, or TIER asks nothing)');
console.log('  TIER    ' + tally.other + ' `other` sets checked, ' + tally.top + ' of them in the top speed tier');

/* ---------------- HOOK ---------------- */
{
  const sep = ' +----------------------------------------+ ';
  const fx = [sep, ' | Garchomp                               | ', sep, ' | Raw count: 10                          | ', sep, ' | Spreads                                | ',
    ' | Adamant:4/32/0/0/0/30 40.000%           | ', ' | Jolly:2/32/0/0/0/32 30.000%             | ', ' | Jolly:0/32/2/0/0/32 20.000%             | ', ' | Other 10.000%                          | ', sep,
    ' | Moves                                  | ', ' | Protect 90.000%                        | ', sep].join('\n');
  const P = SP.parseMoveset(fx);
  const gid = X.D.species.get('Garchomp').id;
  ok('HOOK', P[gid] && P[gid].length === 3, 'the synthetic moveset block parses to three spreads: ' + JSON.stringify(P).slice(0, 200));
  const obs = { file: 'fixture', bySpecies: P };
  const got = SP.observedSpread({ species: 'Garchomp', nature: 'Jolly' }, obs);
  ok('HOOK', got && SP.evStr(got.evs) === '2/32/0/0/0/32', 'the nature-matched, highest-share spread is taken: ' + JSON.stringify(got));
  ok('HOOK', SP.observedSpread({ species: 'Garchomp', nature: 'Timid' }, obs) === null, 'no spread for the sheet nature -> null (derive)');
  const over = { file: 'x', bySpecies: { [gid]: [{ nature: 'Jolly', evs: { hp: 33, atk: 32, def: 0, spa: 0, spd: 0, spe: 1 }, pct: 50 }] } };
  ok('HOOK', SP.observedSpread({ species: 'Garchomp', nature: 'Jolly' }, over) === null, 'an observed spread over the cap is refused');
  const found = SP.findObserved();
  ok('HOOK', found === null || new RegExp('^' + X.FORMAT + '-\\d+\\.txt$').test(path.basename(found)), 'findObserved names only a file for ' + X.FORMAT + ': ' + found);
  for (const [f, rot] of ROTS) {
    const o = rot.spread_source && rot.spread_source.observed;
    ok('HOOK', found ? (o && o.file === path.relative(ROOT, found).split(path.sep).join('/')) : (typeof o === 'string' && /^none/.test(o)), f + ' records observed = ' + JSON.stringify(o) + ' while findObserved() = ' + found);
  }
}

/* ---------------- REPRODUCE ---------------- */
if (!BREAK) {
  const [f, rot] = ROTS.find(([n]) => /top/.test(n)) || ROTS[0];
  const ss = rot.spread_source || {};
  const sf = ss.store && path.join(ROOT, ss.store);
  const shaOk = sf && fs.existsSync(sf) && crypto.createHash('sha256').update(fs.readFileSync(sf)).digest('hex') === ss.store_sha256;
  if (!shaOk) { notChecked++; console.log('  NOT CHECKED [REPRODUCE] the store the spreads were derived from (' + ss.store + ' @ ' + String(ss.store_sha256).slice(0, 12) + ') is not on disk at that sha256'); }
  else {
    const B = require('../rotom/build_top_rotation.js');
    /* the tournament hook off: this reproduces the DERIVATION the file recorded (the top rotation predates the hook, and a
     * published spread for the same set would otherwise be served instead — which is the hook working, not a re-derive) */
    const { D } = B.spreadDeriver(B.readStore(sf), { tournament: null });
    ok('REPRODUCE', D.eq.median_speed === ss.speed_equilibrium.median_speed, 'the speed benchmark re-derives: ' + D.eq.median_speed + ' vs ' + ss.speed_equilibrium.median_speed);
    const pick = [];
    for (const want of ['fast', 'trickroom', 'other']) for (const t of rot.teams) { const i = t.spreads.findIndex(z => z.role === want); if (i >= 0) { pick.push(t.spreads[i]); break; } }
    for (const z of pick) {
      const re = D.spreadFor(z);
      ok('REPRODUCE', SP.evStr(re.evs) === SP.evStr(z.evs), f + ' ' + z.species + ' (' + z.role + ') re-derives ' + SP.evStr(re.evs) + ', recorded ' + SP.evStr(z.evs));
    }
  }
}

/* ---------------- CONTROL ---------------- */
if (!BREAK) for (const [k, fn] of Object.entries(BREAKS)) {
  let seen = false;
  for (const [f, rot] of ROTS) { const b = clone(rot); fn(b); if ((k === 'record' ? checkRecord(f, b) : k === 'tier' ? checkTier(f, b) : checkRole(f, b)).length) seen = true; }
  ok('CONTROL', seen, 'the ' + k + ' break is refused');
}

console.log((fails ? 'RED' : 'GREEN') + ' ' + (checks - fails) + '/' + checks + (notChecked ? '  (' + notChecked + ' NOT CHECKED, named above)' : '') + (BREAK ? '  (deliberate break: ' + BREAK + ')' : ''));
process.exit(fails ? 1 : 0);
